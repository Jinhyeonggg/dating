import type { Persona } from '@/types/persona'

export const DEFAULT_PUBLIC_FIELDS: ReadonlyArray<keyof Persona> = [
  'name', 'age', 'gender', 'occupation',
  'mbti', 'personality_traits',
  'hobbies', 'tags',
  'self_description',
] as const

export function filterPersonaByPublicFields(
  persona: Persona,
  publicFields: string[],
): Partial<Persona> {
  const result: Record<string, unknown> = {}
  for (const field of publicFields) {
    if (field in persona) {
      result[field] = persona[field as keyof Persona]
    }
  }
  return result as Partial<Persona>
}
