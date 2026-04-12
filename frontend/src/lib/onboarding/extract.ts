import { errors } from '@/lib/errors'

export interface ParsedTraits {
  personality_summary: string
  communication_tendency: string
  social_style: string
  value_priorities: string[]
  conflict_style: string
  energy_pattern: string
  conversation_topics: string[]
}

const REQUIRED_STRING_FIELDS = [
  'personality_summary',
  'communication_tendency',
  'social_style',
  'conflict_style',
  'energy_pattern',
] as const

export function parseTraitsInference(raw: unknown): ParsedTraits {
  if (typeof raw !== 'object' || raw === null) {
    throw errors.validation('추론 결과가 객체가 아닙니다')
  }
  const obj = raw as Record<string, unknown>

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof obj[field] !== 'string' || obj[field] === '') {
      throw errors.validation(`${field} 필드가 없거나 빈 문자열입니다`)
    }
  }

  const value_priorities = Array.isArray(obj.value_priorities)
    ? obj.value_priorities.filter((v): v is string => typeof v === 'string')
    : []

  const conversation_topics = Array.isArray(obj.conversation_topics)
    ? obj.conversation_topics.filter((v): v is string => typeof v === 'string')
    : []

  return {
    personality_summary: obj.personality_summary as string,
    communication_tendency: obj.communication_tendency as string,
    social_style: obj.social_style as string,
    value_priorities,
    conflict_style: obj.conflict_style as string,
    energy_pattern: obj.energy_pattern as string,
    conversation_topics,
  }
}
