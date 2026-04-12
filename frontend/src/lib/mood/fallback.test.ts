import { describe, it, expect } from 'vitest'
import { fallbackMoodRoll } from './fallback'
import { MOOD_PRIMARIES } from './types'
import type { Persona } from '@/types/persona'

function makePersona(overrides: Partial<Persona>): Persona {
  return {
    name: 'Test',
    age: null,
    gender: null,
    location: null,
    occupation: null,
    education: null,
    languages: null,
    mbti: null,
    personality_traits: null,
    strengths: null,
    weaknesses: null,
    humor_style: null,
    emotional_expression: null,
    core_values: null,
    beliefs: null,
    life_philosophy: null,
    dealbreakers: null,
    hobbies: null,
    favorite_media: null,
    food_preferences: null,
    travel_style: null,
    background_story: null,
    key_life_events: null,
    career_history: null,
    past_relationships_summary: null,
    family_description: null,
    close_friends_count: null,
    social_style: null,
    relationship_with_family: null,
    daily_routine: null,
    sleep_schedule: null,
    exercise_habits: null,
    diet: null,
    pets: null,
    living_situation: null,
    communication_style: null,
    conversation_preferences: null,
    texting_style: null,
    response_speed: null,
    short_term_goals: null,
    long_term_goals: null,
    what_seeking_in_others: null,
    relationship_goal: null,
    self_description: null,
    tags: null,
    ...overrides,
  }
}

describe('fallbackMoodRoll', () => {
  it('유효한 MoodState를 반환한다', () => {
    const mood = fallbackMoodRoll(makePersona({}), [], 'seed-1')
    expect(MOOD_PRIMARIES).toContain(mood.primary)
    expect(mood.energy).toBeGreaterThanOrEqual(0)
    expect(mood.energy).toBeLessThanOrEqual(1)
    expect(mood.openness).toBeGreaterThanOrEqual(0)
    expect(mood.warmth).toBeGreaterThanOrEqual(0)
    expect(mood.reason_hint).toBeTruthy()
  })

  it('같은 seed는 같은 결과', () => {
    const p = makePersona({ age: 25 })
    const a = fallbackMoodRoll(p, [], 'same-seed')
    const b = fallbackMoodRoll(p, [], 'same-seed')
    expect(a.primary).toBe(b.primary)
    expect(a.energy).toBe(b.energy)
  })

  it('다른 seed는 다를 수 있다', () => {
    const p = makePersona({ age: 25 })
    const results = new Set(
      Array.from({ length: 20 }, (_, i) => fallbackMoodRoll(p, [], `seed-${i}`).primary)
    )
    expect(results.size).toBeGreaterThan(1)
  })
})
