type Props = {
  pct: number
  size?: number
  stroke?: number
  label?: string
}

export function ProgressRing({ pct, size = 56, stroke = 5, label }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c

  return (
    <div className="ring" style={{ width: size, height: size }} aria-label={label ?? `${pct}%`}>
      <svg width={size} height={size}>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
        />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="ring-label">{pct}%</span>
    </div>
  )
}
