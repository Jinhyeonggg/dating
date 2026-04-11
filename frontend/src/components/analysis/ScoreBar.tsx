interface Props {
  score: number
  label?: string
}

export function ScoreBar({ score, label }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(score)))
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{pct}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
