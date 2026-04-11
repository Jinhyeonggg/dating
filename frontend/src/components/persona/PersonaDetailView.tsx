import type { Persona } from '@/types/persona'
import {
  PERSONA_SECTIONS,
  type PersonaFieldDef,
} from '@/lib/constants/personaFields'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

interface PersonaDetailViewProps {
  persona: Persona
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function FieldView({
  field,
  value,
}: {
  field: PersonaFieldDef
  value: unknown
}) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{field.label}</dt>
      <dd>
        {field.type === 'array' && Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1">
            {(value as string[]).map((v) => (
              <Badge key={v} variant="secondary" className="font-normal">
                {v}
              </Badge>
            ))}
          </div>
        ) : field.type === 'textarea' ? (
          <p className="whitespace-pre-wrap">{String(value)}</p>
        ) : (
          <span>{String(value)}</span>
        )}
      </dd>
    </div>
  )
}

export function PersonaDetailView({ persona }: PersonaDetailViewProps) {
  return (
    <div className="space-y-4">
      {PERSONA_SECTIONS.map((section) => {
        const filledFields = section.fields.filter((f) => {
          if (f.key === 'name') return false
          return !isEmpty(persona[f.key])
        })

        if (filledFields.length === 0) return null

        return (
          <Card key={section.category} className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              {section.label}
            </h3>
            <dl className="space-y-3">
              {filledFields.map((field) => (
                <FieldView
                  key={field.key as string}
                  field={field}
                  value={persona[field.key]}
                />
              ))}
            </dl>
          </Card>
        )
      })}
    </div>
  )
}
