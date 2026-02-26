interface GaugeChartProps {
  value: number
  label: string
}

export function GaugeChart({ value, label }: GaugeChartProps) {
  const clamped = Math.max(0, Math.min(value, 1))
  const angle = -90 + clamped * 180
  const rad = (angle * Math.PI) / 180
  const x = 100 + Math.cos(rad) * 70
  const y = 100 + Math.sin(rad) * 70

  const color = clamped >= 0.8 ? 'var(--success)' : clamped >= 0.5 ? 'var(--warn)' : 'var(--danger)'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 200 120" className="h-32 w-full max-w-[220px]">
        <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="var(--track-muted)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 30 100 A 70 70 0 0 1 170 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${clamped * 220} 220`}
        />
        <line x1="100" y1="100" x2={x} y2={y} stroke={color} strokeWidth="3" />
        <circle cx="100" cy="100" r="5" fill={color} />
      </svg>
      <p className="font-display text-3xl font-bold" style={{ color }}>
        {Math.round(clamped * 100)}%
      </p>
      <p className="text-xs text-text2">{label}</p>
    </div>
  )
}
