import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePdfStudy } from '../hooks/usePdfStudy'
import { formatBytes } from '../utils/pdfStudy'

export function PdfStudyPage() {
  const navigate = useNavigate()
  const { ready, error, docs, addPdf, removePdf, renamePdf } = usePdfStudy()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const onUpload = async (files: FileList | null) => {
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
      setMsg(`Saved ${created.length} PDFs on this device.`)
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
      <header className="section-head yt-page-head">
        <div>
          <h1>PDF study desk</h1>
          <p className="lede">
            Upload PDFs for yourself, open them here, paint / highlight answers,
            and drop named bookmarks. Files stay in this browser only.
          </p>
        </div>
      </header>

      {error && <p className="practice-banner error">{error}</p>}
      {msg && <p className="practice-banner">{msg}</p>}

      <section className="cardish pdf-upload" aria-label="Upload PDF">
        <h2>Add PDF</h2>
        <p className="lede">
          Question papers, notes, mocks — open and mark them without leaving
          ExamPulse. Up to ~200MB per file (stays on this device).
        </p>
        <label className="practice-file practice-file-bulk">
          Choose PDF file(s)
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={busy}
            onChange={(e) => {
              void onUpload(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </section>

      <section aria-label="Your PDFs">
        <header className="section-head">
          <h2>
            Library · {docs.length} file{docs.length === 1 ? '' : 's'}
          </h2>
        </header>
        {docs.length === 0 ? (
          <p className="lede">No PDFs yet — upload one to start marking.</p>
        ) : (
          <ul className="pdf-doc-list">
            {docs.map((d) => (
              <li key={d.id} className="pdf-doc-card">
                <div>
                  <strong>{d.name}</strong>
                  <span>
                    {formatBytes(d.sizeBytes)}
                    {d.pageCount ? ` · ${d.pageCount} pages` : ''}
                    {` · page ${d.lastPage}`}
                    {` · ${new Date(d.updatedAt).toLocaleString()}`}
                  </span>
                </div>
                <div className="pdf-doc-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => navigate(`/pdf/${d.id}`)}
                  >
                    Open
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
                    className="ghost"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete “${d.name}” and all marks/bookmarks on this device?`,
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
