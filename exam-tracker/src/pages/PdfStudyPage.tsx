import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePdfStudy } from '../hooks/usePdfStudy'
import { formatBytes } from '../utils/pdfStudy'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function PdfStudyPage() {
  const navigate = useNavigate()
  const { user, signInWithGoogle } = useAuth()
  const { ready, error, cloudNote, docs, addPdf, removePdf, renamePdf } =
    usePdfStudy(user?.uid, { syncOnMount: true })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onUpload = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : []
    if (!list.length) return
    setBusy(true)
    setMsg('')
    try {
      const created = []
      for (const file of list) {
        created.push(await addPdf(file))
      }
      if (created.length === 1) {
        navigate(`/pdf/${created[0].id}`)
        return
      }
      setMsg(`Saved ${created.length} PDFs.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="pdf-study-page">
        <p className="lede">Loading PDF desk…</p>
      </div>
    )
  }

  return (
    <div className="pdf-study-page">
      <header className="pdf-study-head">
        <div>
          <p className="pdf-kicker">Study materials</p>
          <h1>PDF desk</h1>
          <p className="lede">
            Upload papers and notes, mark answers, bookmark pages. Saved on this
            device{user ? ' and synced to your cloud library when signed in' : ''}.
          </p>
        </div>
        {!user && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => void signInWithGoogle()}
          >
            Sign in to sync
          </button>
        )}
      </header>

      {(error || msg || cloudNote) && (
        <div className="pdf-status-row" role="status">
          {error && <p className="pdf-status error">{error}</p>}
          {msg && <p className="pdf-status">{msg}</p>}
          {cloudNote && !msg && <p className="pdf-status muted">{cloudNote}</p>}
        </div>
      )}

      <section
        className={`pdf-dropzone${dragOver ? ' over' : ''}${busy ? ' busy' : ''}`}
        aria-label="Upload PDF"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void onUpload(e.dataTransfer.files)
        }}
      >
        <div className="pdf-drop-copy">
          <strong>{busy ? 'Saving…' : 'Drop PDFs here'}</strong>
          <span>or choose files · up to 200MB each</span>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Choose PDF
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          disabled={busy}
          onChange={(e) => {
            void onUpload(e.target.files)
            e.target.value = ''
          }}
        />
      </section>

      <section className="pdf-library" aria-label="Your PDFs">
        <header className="pdf-library-head">
          <h2>
            Library
            <span className="pdf-count">{docs.length}</span>
          </h2>
        </header>
        {docs.length === 0 ? (
          <p className="pdf-empty">No PDFs yet — upload a paper to start marking.</p>
        ) : (
          <ul className="pdf-doc-list">
            {docs.map((d) => (
              <li key={d.id} className="pdf-doc-row">
                <button
                  type="button"
                  className="pdf-doc-open"
                  onClick={() => navigate(`/pdf/${d.id}`)}
                >
                  <span className="pdf-doc-icon" aria-hidden>
                    PDF
                  </span>
                  <span className="pdf-doc-meta">
                    <strong>{d.name}</strong>
                    <span>
                      {formatBytes(d.sizeBytes)}
                      {d.pageCount ? ` · ${d.pageCount}p` : ''}
                      {` · p.${d.lastPage}`}
                      {` · ${formatWhen(d.updatedAt)}`}
                    </span>
                  </span>
                </button>
                <div className="pdf-doc-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const name = prompt('Rename PDF', d.name)
                      if (name != null) void renamePdf(d.id, name)
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete “${d.name}” and all marks/bookmarks?`,
                        )
                      ) {
                        void removePdf(d.id)
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
