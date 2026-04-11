import Link from 'next/link'
import type { Clone } from '@/types/persona'
import { Card } from '@/components/ui/card'
import { CloneNpcBadge } from './CloneNpcBadge'

interface CloneCardProps {
  clone: Clone
}

export function CloneCard({ clone }: CloneCardProps) {
  const persona = clone.persona_json
  const chips: string[] = []
  if (persona.age !== null) chips.push(`${persona.age}`)
  if (persona.occupation) chips.push(persona.occupation)
  if (persona.mbti) chips.push(persona.mbti)

  return (
    <Link href={`/clones/${clone.id}`} className="block h-full">
      <Card className="flex h-full flex-col p-4 transition hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold">{clone.name}</h3>
          {clone.is_npc && <CloneNpcBadge />}
        </div>
        <p className="mt-1 line-clamp-1 min-h-[1rem] text-xs text-muted-foreground">
          {chips.length > 0 ? chips.join(' · ') : '\u00A0'}
        </p>
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
          {persona.self_description ?? '\u00A0'}
        </p>
      </Card>
    </Link>
  )
}
