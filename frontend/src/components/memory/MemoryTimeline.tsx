import { Card } from '@/components/ui/card'
import { MemoryItem } from './MemoryItem'
import type { CloneMemory } from '@/types/persona'

export function MemoryTimeline({ memories }: { memories: CloneMemory[] }) {
  if (memories.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        아직 기록된 메모리가 없습니다. 위에서 하나 추가해보세요.
      </Card>
    )
  }
  return (
    <div className="space-y-2">
      {memories.map((m) => (
        <MemoryItem key={m.id} memory={m} />
      ))}
    </div>
  )
}
