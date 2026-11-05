import { useMemo, useState } from 'react'
import { parseNoteTimestamps } from '../utils/videoRecommend'

type Props = {
  notes?: string
  onSave: (notes: string | undefined) => void
  onJump: (seconds: number) => void
}

/** Editable notes with clickable mm:ss / h:mm:ss timestamps. */
export function VideoNotes({ notes, onSave, onJump }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes ?? '')
  const stamps = useMemo(() => parseNoteTimestamps(notes ?? ''), [notes])

  if (editing) {
    return (
      <div className="yt-notes-edit">
        <textarea
          value={draft}
          rows={3}
          placeholder="Add notes — include timestamps like 12:40 to jump there"
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="yt-notes-edit-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onSave(draft.trim() || undefined)
              setEditing(false)
            }}
          >
            Save notes
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setDraft(notes ?? '')
              setEditing(false)
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="yt-notes-view">
      {notes ? <p className="yt-card-notes">{notes}</p> : null}
      {stamps.length > 0 && (
        <div className="yt-timestamps">
          {stamps.map((s) => (
            <button
              key={`${s.index}-${s.label}`}
              type="button"
              className="yt-ts-chip"
              onClick={() => onJump(s.seconds)}
            >
              ▶ {s.label}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setDraft(notes ?? '')
          setEditing(true)
        }}
      >
        {notes ? 'Edit notes' : 'Add notes'}
      </button>
    </div>
  )
}
