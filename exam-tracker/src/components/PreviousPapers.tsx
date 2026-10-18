import { useState } from 'react'
import { paperFilename, papersForExam, type PyqPaper } from '../data/pyqs'

type Props = {
  examId: string
  examName: string
}

export function PreviousPapers({ examId, examName }: Props) {
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const papers = papersForExam(examId)

  async function downloadPaper(paper: PyqPaper) {
    setError(null)
    setBusyId(paper.id)
    try {
      if (paper.kind === 'page') {
        window.open(paper.url, '_blank', 'noopener,noreferrer')
        return
      }

      const res = await fetch(paper.url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = paperFilename(paper)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      // CORS / hotlink blocks — open so the browser can still save
      setError('Direct download blocked by the host — opened in a new tab instead.')
      window.open(paper.url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="pyq-panel" aria-labelledby="pyq-heading">
      <div className="pyq-head">
        <div>
          <h2 id="pyq-heading">Previous year papers</h2>
          <p className="muted-line">
            Free / official PYQs for {examName}. Open in a new tab or download when a PDF is linked.
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setOpen((v) => !v)
            setError(null)
          }}
          aria-expanded={open}
        >
          {open
            ? 'Hide papers'
            : papers.length
              ? `Fetch previous years papers (${papers.length})`
              : 'Fetch previous years papers'}
        </button>
      </div>

      {open && (
        <div className="pyq-body">
          {papers.length === 0 ? (
            <p className="pyq-empty">
              No curated papers for this exam yet. Check the official careers page when the next
              notification drops.
            </p>
          ) : (
            <ul className="pyq-list">
              {papers.map((paper) => (
                <li key={paper.id} className="pyq-item">
                  <div className="pyq-meta">
                    <span className="pyq-year">{paper.year}</span>
                    <div>
                      <strong>{paper.title}</strong>
                      <p>
                        {paper.stage} · {paper.source}
                        {paper.kind === 'pdf' ? ' · PDF' : ' · web page'}
                        {paper.note ? ` · ${paper.note}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="pyq-actions">
                    <a
                      className="btn ghost-btn"
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busyId === paper.id}
                      onClick={() => void downloadPaper(paper)}
                    >
                      {busyId === paper.id
                        ? 'Fetching…'
                        : paper.kind === 'pdf'
                          ? 'Download'
                          : 'Open & save'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="pyq-error">{error}</p>}
        </div>
      )}
    </section>
  )
}
