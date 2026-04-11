interface Props {
  current: number
  total: number
}

export function InteractionProgressBar({ current, total }: Props) {
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>진행</span>
        <span>
          {current}/{total} 턴
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
