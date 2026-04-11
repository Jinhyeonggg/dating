import { describe, it, expect } from 'vitest'
import {
  renderPersonaCore,
  renderRecentMemories,
  buildSystemPrompt,
} from './persona'
import { BEHAVIOR_INSTRUCTIONS } from './behavior'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
import type { Persona, CloneMemory } from '@/types/persona'

function emptyPersona(overrides: Partial<Persona> = {}): Persona {
  return {
    name: 'Test',
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
    ...overrides,
  }
}

function memory(overrides: Partial<CloneMemory> = {}): CloneMemory {
  return {
    id: 'm1', clone_id: 'c1', kind: 'event',
    content: '영화 봄', tags: [],
    occurred_at: '2026-04-10', created_at: '2026-04-10T00:00:00Z',
    relevance_score: null,
    ...overrides,
  }
}

describe('renderPersonaCore', () => {
  it('name만 있어도 유효한 결과', () => {
    const result = renderPersonaCore(emptyPersona({ name: '지수' }))
    expect(result).toContain('지수')
    expect(result).not.toContain('null')
  })

  it('null 필드는 출력에 포함되지 않음', () => {
    const result = renderPersonaCore(emptyPersona({ name: '지수' }))
    expect(result).not.toContain('mbti')
    expect(result).not.toContain('age')
  })

  it('여러 필드 조합이 올바른 순서로 출력', () => {
    const result = renderPersonaCore(
      emptyPersona({
        name: '지수',
        age: 28,
        mbti: 'INFJ',
        hobbies: ['독서', '요가'],
        core_values: ['진정성', '성장'],
      })
    )
    expect(result).toContain('이름: 지수')
    expect(result).toContain('나이: 28')
    expect(result).toContain('MBTI: INFJ')
    expect(result).toContain('취미: 독서, 요가')
    expect(result).toContain('핵심 가치관: 진정성, 성장')
  })

  it('빈 배열은 생략', () => {
    const result = renderPersonaCore(emptyPersona({ name: '지수', hobbies: [] }))
    expect(result).not.toContain('취미')
  })
})

describe('renderRecentMemories', () => {
  it('빈 배열은 빈 문자열 반환', () => {
    expect(renderRecentMemories([])).toBe('')
  })

  it('메모리는 occurred_at 내림차순으로 정렬', () => {
    const memories = [
      memory({ id: 'm1', occurred_at: '2026-04-09', content: '오래된' }),
      memory({ id: 'm2', occurred_at: '2026-04-11', content: '최근' }),
      memory({ id: 'm3', occurred_at: '2026-04-10', content: '중간' }),
    ]
    const result = renderRecentMemories(memories)
    const lines = result.split('\n').filter((l) => l.includes('- '))
    expect(lines[0]).toContain('최근')
    expect(lines[1]).toContain('중간')
    expect(lines[2]).toContain('오래된')
  })

  it('메모리 섹션 헤더 포함', () => {
    const result = renderRecentMemories([memory({ content: '테스트' })])
    expect(result).toContain('최근 기억')
  })

  it('limit 초과분은 제외', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      memory({
        id: `m${i}`,
        content: `item ${i}`,
        occurred_at: `2026-04-${String(i + 1).padStart(2, '0')}`,
      })
    )
    const result = renderRecentMemories(many)
    const lines = result.split('\n').filter((l) => l.includes('- '))
    expect(lines.length).toBeLessThanOrEqual(
      INTERACTION_DEFAULTS.MEMORY_INJECTION_LIMIT
    )
  })
})

describe('buildSystemPrompt', () => {
  it('persona core + memories + behavior 를 포함', () => {
    const persona = emptyPersona({ name: '지수', age: 28 })
    const memories = [memory({ content: '영화 봄' })]
    const result = buildSystemPrompt(persona, memories)

    expect(result).toContain('이름: 지수')
    expect(result).toContain('영화 봄')
    expect(result).toContain(BEHAVIOR_INSTRUCTIONS)
  })

  it('memories 없어도 동작', () => {
    const result = buildSystemPrompt(emptyPersona({ name: '지수' }), [])
    expect(result).toContain('이름: 지수')
    expect(result).toContain(BEHAVIOR_INSTRUCTIONS)
    expect(result).not.toContain('최근 기억')
  })

  it('behavior 섹션은 항상 끝에', () => {
    const result = buildSystemPrompt(emptyPersona({ name: '지수' }), [])
    expect(result.endsWith(BEHAVIOR_INSTRUCTIONS)).toBe(true)
  })
})
