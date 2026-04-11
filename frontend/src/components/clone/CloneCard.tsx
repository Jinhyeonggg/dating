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
    <Link href={`/clones/${clone.id}`}>
      <Card className="p-4 transition hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{clone.name}</h3>
          {clone.is_npc && <CloneNpcBadge />}
        </div>
        {chips.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {chips.join(' · ')}
          </p>
        )}
        {persona.self_description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {persona.self_description}
          </p>
        )}
      </Card>
    </Link>
  )
}
