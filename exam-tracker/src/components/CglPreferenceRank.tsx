import { useEffect, useState } from 'react'
import { CGL_PREF_DEFAULT, type CglPrefRow } from '../data/cglPreference'

const KEY = 'exampulse-cgl-pref-order'

function readOrder(): CglPrefRow[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return CGL_PREF_DEFAULT
    const ids = JSON.parse(raw) as string[]
    if (!Array.isArray(ids)) return CGL_PREF_DEFAULT
    const map = Object.fromEntries(CGL_PREF_DEFAULT.map((r) => [r.id, r]))
    const ordered = ids.map((id) => map[id]).filter(Boolean)
    for (const row of CGL_PREF_DEFAULT) {
      if (!ordered.some((r) => r.id === row.id)) ordered.push(row)
    }
    return ordered
  } catch {
    return CGL_PREF_DEFAULT
  }
}

/** F5 — drag-free up/down preference list with tradeoffs. */
export function CglPreferenceRank() {
  const [rows, setRows] = useState(readOrder)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(rows.map((r) => r.id)))
  }, [rows])

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= rows.length) return
    setRows((prev) => {
      const copy = [...prev]
      ;[copy[index], copy[next]] = [copy[next], copy[index]]
      return copy
    })
  }

  return (
    <section className="cgl-pref-rank" aria-label="CGL post preference order">
      <div className="section-head">
        <h2>CGL preference order</h2>
        <span className="soft-chip">post preference after Tier-2</span>
      </div>
      <p className="muted-line plan-intro">
        Rank posts before results — higher = fill first if your score clears.
      </p>
      <ol className="cgl-pref-list">
        {rows.map((row, i) => (
          <li key={row.id}>
            <span className="plan-num">{i + 1}</span>
            <div>
              <strong>{row.label}</strong>
              <em>
                {row.rankHint} — {row.tradeoff}
              </em>
            </div>
            <div className="cgl-pref-move">
              <button
                type="button"
                className="ghost"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="ghost"
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
