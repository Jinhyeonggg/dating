import type { Persona } from '@/types/persona'
import { Badge } from '@/components/ui/badge'

interface PersonaSummaryCardProps {
  persona: Persona
}

export function PersonaSummaryCard({ persona }: PersonaSummaryCardProps) {
  const chips: string[] = []
  if (persona.age !== null) chips.push(`${persona.age}세`)
  if (persona.gender) chips.push(persona.gender)
  if (persona.mbti) chips.push(persona.mbti)
  if (persona.occupation) chips.push(persona.occupation)

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-semibold">{persona.name}</h2>
        {chips.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {chips.join(' · ')}
          </p>
        )}
      </div>

      {persona.self_description && (
        <p className="text-sm">{persona.self_description}</p>
      )}

      {persona.tags && persona.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {persona.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
