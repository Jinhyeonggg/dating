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
  const isBlock = field.type === 'textarea' || field.type === 'array'
  return (
    <div
      className={
        isBlock
          ? 'space-y-1.5'
          : 'flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4'
      }
    >
      <dt
        className={
          'text-xs font-medium uppercase tracking-wide text-muted-foreground ' +
          (isBlock ? '' : 'sm:w-32 sm:shrink-0')
        }
      >
        {field.label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm leading-relaxed">
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
  const filledSections = PERSONA_SECTIONS.map((section) => ({
    section,
    filledFields: section.fields.filter((f) => {
      if (f.key === 'name') return false
      return !isEmpty(persona[f.key])
    }),
  })).filter((s) => s.filledFields.length > 0)

  if (filledSections.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        추가로 입력된 정보가 없습니다. 상세 편집에서 더 많은 필드를 채워보세요.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {filledSections.map(({ section, filledFields }) => (
        <Card key={section.category} className="p-6">
          <h3 className="mb-4 border-b pb-2 text-sm font-semibold">
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
      ))}
    </div>
  )
}
