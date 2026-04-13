import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CloneMemory, CloneMemoryKind } from '@/types/persona'

const KIND_LABELS: Record<CloneMemoryKind, string> = {
  event: '사건',
  mood: '기분',
  fact: '사실',
  preference_update: '취향',
}

const KIND_VARIANTS: Record<
  CloneMemoryKind,
  'default' | 'secondary' | 'outline'
> = {
  event: 'default',
  mood: 'secondary',
  fact: 'outline',
  preference_update: 'secondary',
}

function formatDateTime(isoDate: string, isoDatetime: string): string {
  try {
    const d = new Date(isoDatetime)
    const date = isoDate // YYYY-MM-DD
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    const secs = String(d.getSeconds()).padStart(2, '0')
    return `${date} ${hours}:${mins}:${secs}`
  } catch {
    return isoDate
  }
}

export function MemoryItem({ memory }: { memory: CloneMemory }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDateTime(memory.occurred_at, memory.created_at)}</span>
        <Badge variant={KIND_VARIANTS[memory.kind]} className="text-[10px]">
          {KIND_LABELS[memory.kind]}
        </Badge>
      </div>
      <p className="text-sm leading-relaxed">{memory.content}</p>
      {memory.tags && memory.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {memory.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
