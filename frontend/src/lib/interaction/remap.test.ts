import { describe, it, expect } from 'vitest'
import { remapHistoryForSpeaker, pickSpeaker } from './remap'
import type { InteractionEvent } from '@/types/interaction'
import type { Clone } from '@/types/persona'

function makeClone(id: string, name: string): Clone {
  return {
    id,
    user_id: null,
    is_npc: false,
    version: 1,
    name,
    persona_json: {
      name,
      age: null, gender: null, location: null, occupation: null,
      education: null, languages: null,
      mbti: null, personality_traits: null, strengths: null, weaknesses: null,
      humor_style: null, emotional_expression: null,
      core_values: null, beliefs: null, life_philosophy: null, dealbreakers: null,
      hobbies: null, favorite_media: null, food_preferences: null, travel_style: null,
      background_story: null, key_life_events: null, career_history: null,
      past_relationships_summary: null,
      family_description: null, close_friends_count: null, social_style: null,
      relationship_with_family: null,
      daily_routine: null, sleep_schedule: null, exercise_habits: null,
      diet: null, pets: null, living_situation: null,
      communication_style: null, conversation_preferences: null,
      texting_style: null, response_speed: null,
      short_term_goals: null, long_term_goals: null,
      what_seeking_in_others: null, relationship_goal: null,
      self_description: null, tags: null,
    },
    system_prompt: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  }
}

describe('remapHistoryForSpeaker', () => {
  it('빈 events 배열은 빈 결과를 반환한다', () => {
    const result = remapHistoryForSpeaker([], 'clone-a', new Map())
    expect(result).toEqual([])
  })

  it('발화자 본인의 턴은 role=assistant, content 그대로', () => {
    const events: InteractionEvent[] = [
      {
        id: '1', interaction_id: 'i1', turn_number: 0,
        speaker_clone_id: 'clone-a', content: '안녕하세요',
        created_at: '2026-04-11T00:00:00Z',
      },
    ]
    const names = new Map([['clone-a', '지수'], ['clone-b', '태현']])
    const result = remapHistoryForSpeaker(events, 'clone-a', names)
    expect(result).toEqual([
      { role: 'assistant', content: '안녕하세요' },
    ])
  })

  it('타인의 턴은 role=user, [이름]: 접두어', () => {
    const events: InteractionEvent[] = [
      {
        id: '1', interaction_id: 'i1', turn_number: 0,
        speaker_clone_id: 'clone-a', content: '안녕',
        created_at: '2026-04-11T00:00:00Z',
      },
      {
        id: '2', interaction_id: 'i1', turn_number: 1,
        speaker_clone_id: 'clone-b', content: '반가워요',
        created_at: '2026-04-11T00:00:01Z',
      },
    ]
    const names = new Map([['clone-a', '지수'], ['clone-b', '태현']])
    const result = remapHistoryForSpeaker(events, 'clone-a', names)
    expect(result).toEqual([
      { role: 'assistant', content: '안녕' },
      { role: 'user', content: '[태현]: 반가워요' },
    ])
  })

  it('이름 맵에 없는 clone은 Unknown으로 대체', () => {
    const events: InteractionEvent[] = [
      {
        id: '1', interaction_id: 'i1', turn_number: 0,
        speaker_clone_id: 'clone-x', content: 'hi',
        created_at: '2026-04-11T00:00:00Z',
      },
    ]
    const result = remapHistoryForSpeaker(events, 'clone-a', new Map())
    expect(result).toEqual([{ role: 'user', content: '[Unknown]: hi' }])
  })
})

describe('pickSpeaker', () => {
  it('턴 번호 mod N 으로 참여자를 순환 선택', () => {
    const a = makeClone('a', 'A')
    const b = makeClone('b', 'B')
    expect(pickSpeaker([a, b], 0).id).toBe('a')
    expect(pickSpeaker([a, b], 1).id).toBe('b')
    expect(pickSpeaker([a, b], 2).id).toBe('a')
  })

  it('참여자 3명일 때도 순환', () => {
    const a = makeClone('a', 'A')
    const b = makeClone('b', 'B')
    const c = makeClone('c', 'C')
    expect(pickSpeaker([a, b, c], 0).id).toBe('a')
    expect(pickSpeaker([a, b, c], 3).id).toBe('a')
    expect(pickSpeaker([a, b, c], 7).id).toBe('b')
  })

  it('참여자 빈 배열은 throw', () => {
    expect(() => pickSpeaker([], 0)).toThrow()
  })
})
