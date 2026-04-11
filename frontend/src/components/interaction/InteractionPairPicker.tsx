'use client'

import type { Clone } from '@/types/persona'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CloneNpcBadge } from '@/components/clone/CloneNpcBadge'

interface Props {
  mine: Clone[]
  npcs: Clone[]
  selected: [string | null, string | null]
  onChange: (ids: [string | null, string | null]) => void
}

export function InteractionPairPicker({ mine, npcs, selected, onChange }: Props) {
  return (
    <div className="space-y-6">
      <PickerColumn
        title="내 Clone (필수)"
        clones={mine}
        value={selected[0]}
        onPick={(id) => onChange([id, selected[1]])}
      />
      <PickerColumn
        title="상대 (내 Clone 또는 NPC)"
        clones={[...mine.filter((c) => c.id !== selected[0]), ...npcs]}
        value={selected[1]}
        onPick={(id) => onChange([selected[0], id])}
      />
    </div>
  )
}

function PickerColumn({
  title,
  clones,
  value,
  onPick,
}: {
  title: string
  clones: Clone[]
  value: string | null
  onPick: (id: string) => void
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {clones.length === 0 ? (
        <p className="text-sm text-muted-foreground">선택 가능한 Clone이 없습니다.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {clones.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              className={cn(
                'text-left',
                value === c.id ? 'ring-2 ring-primary' : ''
              )}
            >
              <Card className="flex h-full min-h-[5rem] flex-col p-3 transition hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  {c.is_npc && <CloneNpcBadge />}
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {c.persona_json.self_description ?? '\u00A0'}
                </p>
              </Card>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
