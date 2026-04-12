'use client'

import type { Clone } from '@/types/persona'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CloneNpcBadge } from '@/components/clone/CloneNpcBadge'

export interface InteractionPairPickerProps {
  mine: Clone[]
  community: Clone[]
  npcs: Clone[]
  selected: [string | null, string | null]
  onChange: (pair: [string | null, string | null]) => void
}

type CloneWithBadge = Clone & { _badgeType?: 'community' | 'npc' }

export function InteractionPairPicker({
  mine,
  community,
  npcs,
  selected,
  onChange,
}: InteractionPairPickerProps) {
  const partnerClones: CloneWithBadge[] = [
    ...mine.filter((c) => c.id !== selected[0]),
    ...community.map((c) => ({ ...c, _badgeType: 'community' as const })),
    ...npcs.map((c) => ({ ...c, _badgeType: 'npc' as const })),
  ]

  return (
    <div className="space-y-6">
      <PickerColumn
        title="내 Clone (필수)"
        clones={mine}
        value={selected[0]}
        onPick={(id) => onChange([id, selected[1]])}
      />
      <PickerColumn
        title="상대 (내 Clone / 커뮤니티 / NPC)"
        clones={partnerClones}
        value={selected[1]}
        onPick={(id) => onChange([selected[0], id])}
      />
    </div>
  )
}

function CloneBadge({ clone }: { clone: CloneWithBadge }) {
  if (clone._badgeType === 'community') {
    return (
      <Badge variant="secondary" className="text-xs">
        커뮤니티
      </Badge>
    )
  }
  if (clone._badgeType === 'npc' || clone.is_npc) {
    return <CloneNpcBadge />
  }
  return null
}

function PickerColumn({
  title,
  clones,
  value,
  onPick,
}: {
  title: string
  clones: CloneWithBadge[]
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
                  <CloneBadge clone={c} />
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
