import { describe, it, expect } from 'vitest'
import { DEFAULT_PUBLIC_FIELDS, filterPersonaByPublicFields } from './publicFields'
import type { Persona } from '@/types/persona'

const mockPersona: Persona = {
  name: 'Test User',
  age: 25,
  gender: 'female',
  location: 'Seoul',
  occupation: 'Engineer',
  education: 'University',
  languages: ['Korean', 'English'],
  mbti: 'INFJ',
  personality_traits: ['kind', 'creative'],
  strengths: ['empathy'],
  weaknesses: ['overthinking'],
  humor_style: 'dry',
  emotional_expression: 'reserved',
  core_values: ['honesty'],
  beliefs: ['growth mindset'],
  life_philosophy: 'Live fully',
  dealbreakers: ['dishonesty'],
  hobbies: ['reading', 'hiking'],
  favorite_media: { movies: ['Inception'], books: ['Dune'], music: null, games: null },
  food_preferences: ['Korean cuisine'],
  travel_style: 'adventurous',
  background_story: 'Born in Seoul',
  key_life_events: ['Graduated'],
  career_history: 'Software engineer for 3 years',
  past_relationships_summary: 'One long-term relationship',
  family_description: 'Close family',
  close_friends_count: 5,
  social_style: 'ambivert',
  relationship_with_family: 'good',
  daily_routine: 'Morning exercise, work, reading',
  sleep_schedule: '11pm-7am',
  exercise_habits: 'Daily yoga',
  diet: 'Balanced',
  pets: null,
  living_situation: 'Apartment alone',
  communication_style: 'direct',
  conversation_preferences: ['deep talks'],
  texting_style: 'concise',
  response_speed: 'within hours',
  short_term_goals: ['Learn Spanish'],
  long_term_goals: ['Build something meaningful'],
  what_seeking_in_others: 'Intellectual curiosity',
  relationship_goal: 'Long-term partnership',
  self_description: 'A curious soul who loves learning',
  tags: ['bookworm', 'hiker'],
}

describe('DEFAULT_PUBLIC_FIELDS', () => {
  it('has exactly 9 fields', () => {
    expect(DEFAULT_PUBLIC_FIELDS).toHaveLength(9)
  })

  it("includes 'name'", () => {
    expect(DEFAULT_PUBLIC_FIELDS).toContain('name')
  })

  it("includes 'self_description'", () => {
    expect(DEFAULT_PUBLIC_FIELDS).toContain('self_description')
  })
})

describe('filterPersonaByPublicFields', () => {
  it('returns only the fields in publicFields array', () => {
    const result = filterPersonaByPublicFields(mockPersona, ['name', 'age'])
    expect(result).toEqual({ name: 'Test User', age: 25 })
  })

  it('returns empty object when publicFields is empty', () => {
    const result = filterPersonaByPublicFields(mockPersona, [])
    expect(result).toEqual({})
  })

  it('ignores non-existent fields', () => {
    const result = filterPersonaByPublicFields(mockPersona, ['name', 'nonExistentField'])
    expect(result).toEqual({ name: 'Test User' })
  })

  it('returns all DEFAULT_PUBLIC_FIELDS when passed', () => {
    const result = filterPersonaByPublicFields(mockPersona, [...DEFAULT_PUBLIC_FIELDS])
    expect(Object.keys(result)).toHaveLength(9)
    expect(result.name).toBe('Test User')
    expect(result.self_description).toBe('A curious soul who loves learning')
  })
})
