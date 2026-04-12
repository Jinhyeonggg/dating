'use client'

import type { Control, FieldValues } from 'react-hook-form'
import { PersonaFieldRow } from './PersonaFieldRow'
import {
  PERSONA_SECTIONS,
  type PersonaFieldDef,
  type PersonaSectionDef,
} from '@/lib/constants/personaFields'

interface PersonaSectionProps<T extends FieldValues> {
  control: Control<T>
  category?: string
  fields?: readonly PersonaFieldDef[]
  showHeader?: boolean
  publicFields?: string[]
  onTogglePublic?: (fieldKey: string) => void
  showPublicToggle?: boolean
}

export function PersonaSection<T extends FieldValues>({
  control,
  category,
  fields,
  showHeader = true,
  publicFields,
  onTogglePublic,
  showPublicToggle,
}: PersonaSectionProps<T>) {
  let section: PersonaSectionDef | undefined
  let targetFields: readonly PersonaFieldDef[]

  if (fields) {
    targetFields = fields
  } else if (category) {
    section = PERSONA_SECTIONS.find((s) => s.category === category)
    if (!section) return null
    targetFields = section.fields
  } else {
    return null
  }

  return (
    <div className="space-y-4">
      {showHeader && section && (
        <h3 className="text-lg font-semibold">{section.label}</h3>
      )}
      <div className="space-y-4">
        {targetFields.map((field) => (
          <PersonaFieldRow
            key={field.key as string}
            field={field}
            control={control}
            isPublicField={publicFields?.includes(field.key as string)}
            onTogglePublic={onTogglePublic}
            showPublicToggle={showPublicToggle}
          />
        ))}
      </div>
    </div>
  )
}
