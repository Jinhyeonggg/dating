import { describe, it, expect } from 'vitest'
import { buildAnalysisPrompt } from './prompt'
import type { InteractionEvent } from '@/types/interaction'
import type { Persona } from '@/types/persona'

function makePersona(name: string): Persona {
  return {
    name,
    age: null, gender: null, location: null, occupation: null, education: null,
    languages: null, mbti: null, personality_traits: null, strengths: null,
    weaknesses: null, humor_style: null, emotional_expression: null,
    core_values: null, beliefs: null, life_philosophy: null, dealbreakers: null,
    hobbies: null, favorite_media: null, food_preferences: null,
    travel_style: null, background_story: null, key_life_events: null,
    career_history: null, past_relationships_summary: null,
    family_description: null, close_friends_count: null, social_style: null,
    relationship_with_family: null, daily_routine: null, sleep_schedule: null,
    exercise_habits: null, diet: null, pets: null, living_situation: null,
    communication_style: null, conversation_preferences: null,
    texting_style: null, response_speed: null, short_term_goals: null,
    long_term_goals: null, what_seeking_in_others: null,
    relationship_goal: null, self_description: null, tags: null,
  }
}

describe('buildAnalysisPrompt', () => {
  it('대화 로그와 페르소나 이름이 포함됨', () => {
    const events: InteractionEvent[] = [
      {
        id: '1', interaction_id: 'i1', turn_number: 0,
        speaker_clone_id: 'a', content: '안녕', created_at: '',
      },
      {
        id: '2', interaction_id: 'i1', turn_number: 1,
        speaker_clone_id: 'b', content: '반가워요', created_at: '',
      },
    ]
    const personas = new Map([
      ['a', makePersona('지수')],
      ['b', makePersona('태현')],
    ])

    const result = buildAnalysisPrompt(events, personas)

    expect(result).toContain('지수')
    expect(result).toContain('태현')
    expect(result).toContain('안녕')
    expect(result).toContain('반가워요')
  })

  it('JSON 출력 형식 지시 포함', () => {
    const result = buildAnalysisPrompt([], new Map())
    expect(result).toContain('JSON')
    expect(result).toContain('score')
    expect(result).toContain('categories')
  })

  it('카테고리 목록 포함', () => {
    const result = buildAnalysisPrompt([], new Map())
    expect(result).toContain('conversation_flow')
    expect(result).toContain('values_alignment')
  })
})
