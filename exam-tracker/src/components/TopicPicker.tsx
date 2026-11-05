import { useMemo, useState } from 'react'
import { TOPICS } from '../data/topics'

type Props = {
  value: string[]
  onChange: (ids: string[]) => void
  max?: number
}

/** Compact multi-select for linking videos to syllabus topics. */
export function TopicPicker({ value, onChange, max = 5 }: Props) {
  const [q, setQ] = useState('')
  const selected = useMemo(() => new Set(value), [value])

  const options = useMemo(() => {
    const query = q.trim().toLowerCase()
    return TOPICS.filter((t) => {
      if (!query) return true
      return `${t.title} ${t.area} ${t.id}`.toLowerCase().includes(query)
    }).slice(0, 40)
  }, [q])

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(value.filter((x) => x !== id))
      return
    }
    if (value.length >= max) return
    onChange([...value, id])
  }

  const labels = value
    .map((id) => TOPICS.find((t) => t.id === id)?.title ?? id)
    .filter(Boolean)

  return (
    <div className="yt-topic-picker">
      <label>
        <span>Syllabus topics (optional)</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search topics to link…"
        />
      </label>
      {labels.length > 0 && (
        <div className="yt-topic-selected">
          {labels.map((label, i) => (
            <button
              key={value[i]}
              type="button"
              className="yt-tag"
              onClick={() => toggle(value[i])}
              title="Remove"
            >
              {label} ×
            </button>
          ))}
        </div>
      )}
      <div className="yt-topic-options">
        {options.map((t) => {
          const on = selected.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              className={`yt-topic-opt${on ? ' on' : ''}`}
              onClick={() => toggle(t.id)}
              disabled={!on && value.length >= max}
            >
              <strong>{t.title}</strong>
              <em>{t.area}</em>
            </button>
          )
        })}
      </div>
    </div>
  )
}
