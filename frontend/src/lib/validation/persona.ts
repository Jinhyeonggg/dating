import { z } from 'zod'
import { PERSONA_SECTIONS, type PersonaFieldDef } from '@/lib/constants/personaFields'

function nullableEmptyString(): z.ZodType<string | null> {
  return z
    .union([z.string(), z.null()])
    .transform((v) => (v === '' || v === null ? null : v))
}

function nullableNumber(): z.ZodType<number | null> {
  return z
    .union([z.number(), z.null(), z.string()])
    .transform((v) => {
      if (v === null || v === '' || v === undefined) return null
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : null
    })
}

function nullableStringArray(): z.ZodType<string[] | null> {
  return z
    .union([z.array(z.string()), z.null()])
    .transform((arr) => (arr === null || arr.length === 0 ? null : arr))
}

function fieldToZod(field: PersonaFieldDef): z.ZodTypeAny {
  switch (field.type) {
    case 'text':
    case 'textarea':
      if (field.key === 'name') {
        return z.string().min(1, '이름은 필수입니다')
      }
      return nullableEmptyString()
    case 'number':
      return nullableNumber()
    case 'array':
      return nullableStringArray()
    case 'select':
      if (!field.options) return nullableEmptyString()
      return z
        .union([z.enum(field.options as readonly [string, ...string[]]), z.null()])
        .nullable()
  }
}

const personaShape: Record<string, z.ZodTypeAny> = {}
for (const section of PERSONA_SECTIONS) {
  for (const field of section.fields) {
    personaShape[field.key as string] = fieldToZod(field)
  }
}

personaShape.favorite_media = z
  .object({
    movies: nullableStringArray(),
    books: nullableStringArray(),
    music: nullableStringArray(),
    games: nullableStringArray(),
  })
  .nullable()

export const personaSchema = z.object(personaShape)
export type PersonaInput = z.input<typeof personaSchema>
export type PersonaParsed = z.output<typeof personaSchema>

export const personaPartialSchema = personaSchema.partial()

export const createCloneSchema = z.object({
  persona: personaSchema,
})

export const updateCloneSchema = z.object({
  persona: personaPartialSchema.optional(),
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
})
