import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePdfStudy } from '../hooks/usePdfStudy'
import {
  PDF_FOLDERS,
  formatBytes,
  progressPct,
  type PdfDocMeta,
} from '../utils/pdfStudy'

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
  const {
    ready,
    error,
    cloudNote,
    docs,
    addPdf,
    removePdf,
    renamePdf,
    patchDoc,
  } = usePdfStudy(user?.uid, { syncOnMount: true })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [query, setQuery] = useState('')
  const [folderFilter, setFolderFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [onlyMarked, setOnlyMarked] = useState(false)
  const [uploadFolder, setUploadFolder] = useState<string>('Unfiled')
  const inputRef = useRef<HTMLInputElement>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const d of docs) for (const t of d.tags || []) set.add(t)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [docs])

  const continueDoc = docs[0] ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs.filter((d) => {
      if (folderFilter !== 'all' && (d.folder || 'Unfiled') !== folderFilter) {
        return false
      }
      if (tagFilter !== 'all' && !(d.tags || []).includes(tagFilter)) {
        return false
      }
      if (onlyMarked && progressPct(d) <= 0 && !(d.visitedPages || []).length) {
        return false
      }
      if (!q) return true
      const hay = `${d.name} ${d.folder || ''} ${(d.tags || []).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [docs, folderFilter, onlyMarked, query, tagFilter])

  const onUpload = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : []
    if (!list.length) return
    setBusy(true)
    setMsg('')
    try {
      const created = []
      for (const file of list) {
        created.push(await addPdf(file, { folder: uploadFolder }))
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

  const editTags = async (d: PdfDocMeta) => {
    const raw = prompt(
      'Tags (comma-separated)',
      (d.tags || []).join(', '),
    )
    if (raw == null) return
    const tags = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12)
    await patchDoc(d.id, { tags })
  }

  const editFolder = async (d: PdfDocMeta) => {
    const next = prompt(
      `Folder (${PDF_FOLDERS.join(', ')})`,
      d.folder || 'Unfiled',
    )
    if (next == null || !next.trim()) return
    await patchDoc(d.id, { folder: next.trim().slice(0, 40) })
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
            Papers, notes, and PYQs — mark, bookmark doubts, and pick up where
            you left off.
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

      {continueDoc && (
        <section className="pdf-continue" aria-label="Continue reading">
          <button
            type="button"
            className="pdf-continue-card"
            onClick={() => navigate(`/pdf/${continueDoc.id}`)}
          >
            <span className="pdf-continue-cover">
              {continueDoc.coverDataUrl ? (
                <img src={continueDoc.coverDataUrl} alt="" />
              ) : (
                <span className="pdf-doc-icon">PDF</span>
              )}
            </span>
            <span className="pdf-continue-copy">
              <span className="pdf-kicker">Continue reading</span>
              <strong>{continueDoc.name}</strong>
              <span>
                Page {continueDoc.lastPage}
                {continueDoc.pageCount ? ` / ${continueDoc.pageCount}` : ''}
                {` · ${formatWhen(continueDoc.updatedAt)}`}
              </span>
              <span
                className="pdf-progress"
                aria-label={`${progressPct(continueDoc)}% visited`}
              >
                <span style={{ width: `${progressPct(continueDoc)}%` }} />
              </span>
            </span>
          </button>
        </section>
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
        <div className="pdf-drop-actions">
          <label className="pdf-inline-label">
            Folder
            <select
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
            >
              {PDF_FOLDERS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Choose PDF
          </button>
        </div>
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

      <section className="pdf-quiz-tip" aria-label="Auto test tip">
        <p className="lede">
          In the reader, tap <strong>Detect test</strong> on a question page to
          pull MCQs (√, powers, brackets cleaned for BODMAS-style equations),
          then start a timed test — or map answers on a solutions page.
        </p>
      </section>

      <section className="pdf-library" aria-label="Your PDFs">
        <header className="pdf-library-head">
          <h2>
            Library
            <span className="pdf-count">{filtered.length}</span>
          </h2>
        </header>

        <div className="pdf-filters">
          <input
            type="search"
            placeholder="Search name, folder, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
            aria-label="Filter folder"
          >
            <option value="all">All folders</option>
            {PDF_FOLDERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label="Filter tag"
          >
            <option value="all">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="pdf-check">
            <input
              type="checkbox"
              checked={onlyMarked}
              onChange={(e) => setOnlyMarked(e.target.checked)}
            />
            Started only
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="pdf-empty">No PDFs match — upload or clear filters.</p>
        ) : (
          <ul className="pdf-doc-list">
            {filtered.map((d) => {
              const pct = progressPct(d)
              return (
                <li key={d.id} className="pdf-doc-row">
                  <button
                    type="button"
                    className="pdf-doc-open"
                    onClick={() => navigate(`/pdf/${d.id}`)}
                  >
                    <span className="pdf-doc-thumb">
                      {d.coverDataUrl ? (
                        <img src={d.coverDataUrl} alt="" />
                      ) : (
                        <span className="pdf-doc-icon">PDF</span>
                      )}
                    </span>
                    <span className="pdf-doc-meta">
                      <strong>{d.name}</strong>
                      <span>
                        {d.folder || 'Unfiled'}
                        {d.tags && d.tags.length
                          ? ` · ${d.tags.slice(0, 3).join(', ')}`
                          : ''}
                        {` · ${formatBytes(d.sizeBytes)}`}
                        {d.pageCount ? ` · ${d.pageCount}p` : ''}
                        {` · p.${d.lastPage}`}
                      </span>
                      <span className="pdf-progress" aria-hidden>
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="pdf-progress-label">
                        {pct}% visited · {formatWhen(d.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <div className="pdf-doc-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void editFolder(d)}
                    >
                      Folder
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void editTags(d)}
                    >
                      Tags
                    </button>
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
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
