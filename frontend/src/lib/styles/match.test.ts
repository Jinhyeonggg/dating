import { describe, it, expect } from 'vitest'
import { detectField, computeCardScore, pickStyleCards } from './match'
import type { StyleCard } from './types'
import type { MoodState } from '@/lib/mood/types'
import type { Persona, CloneMemory } from '@/types/persona'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePersona(overrides: Partial<Persona> = {}): Persona {
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

const NO_MEMORIES: CloneMemory[] = []

function makeCard(overrides: Partial<StyleCard> = {}): StyleCard {
  return {
    id: 'card-default',
    label: 'Default Card',
    match: {},
    sample: 'sample text',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// detectField
// ---------------------------------------------------------------------------

describe('detectField', () => {
  describe('register', () => {
    it('detects formal from "존댓말을 씁니다"', () => {
      expect(detectField('존댓말을 씁니다', 'register')).toBe('formal')
    })

    it('detects formal from "공손하게 말해요"', () => {
      expect(detectField('공손하게 말해요', 'register')).toBe('formal')
    })

    it('detects casual from "반말로 편하게 해요"', () => {
      expect(detectField('반말로 편하게 해요', 'register')).toBe('casual')
    })

    it('detects casual from "ㅋㅋ 그냥 ~해 스타일"', () => {
      expect(detectField('ㅋㅋ 그냥 ~해 스타일', 'register')).toBe('casual')
    })

    it('detects mixed from "상황에 따라 달라요"', () => {
      expect(detectField('상황에 따라 달라요', 'register')).toBe('mixed')
    })

    it('detects mixed from "처음엔 격식, 친해지면 반말"', () => {
      expect(detectField('처음엔 격식, 친해지면 반말', 'register')).toBe('mixed')
    })

    it('returns null for unrecognised text', () => {
      expect(detectField('특별한 키워드 없음', 'register')).toBeNull()
    })

    it('returns null for null input', () => {
      expect(detectField(null, 'register')).toBeNull()
    })
  })

  describe('humor', () => {
    it('detects dry from "시니컬한 유머"', () => {
      expect(detectField('시니컬한 유머', 'humor')).toBe('dry')
    })

    it('detects dry from "블랙코미디 좋아함"', () => {
      expect(detectField('블랙코미디 좋아함', 'humor')).toBe('dry')
    })

    it('detects playful from "장난치는 거 좋아요"', () => {
      expect(detectField('장난치는 거 좋아요', 'humor')).toBe('playful')
    })

    it('detects warm from "따뜻한 유머"', () => {
      expect(detectField('따뜻한 유머', 'humor')).toBe('warm')
    })

    it('detects none from "진지한 편이에요"', () => {
      expect(detectField('진지한 편이에요', 'humor')).toBe('none')
    })

    it('returns null for null input', () => {
      expect(detectField(null, 'humor')).toBeNull()
    })
  })

  describe('energy', () => {
    it('detects high from "활발하고 에너지 넘쳐요"', () => {
      expect(detectField('활발하고 에너지 넘쳐요', 'energy')).toBe('high')
    })

    it('detects high from "텐션이 높아요"', () => {
      expect(detectField('텐션이 높아요', 'energy')).toBe('high')
    })

    it('detects mid from "차분하고 보통이에요"', () => {
      expect(detectField('차분하고 보통이에요', 'energy')).toBe('mid')
    })

    it('detects low from "조용하고 말수가 적어요"', () => {
      expect(detectField('조용하고 말수가 적어요', 'energy')).toBe('low')
    })

    it('detects low from "내성적이에요"', () => {
      expect(detectField('내성적이에요', 'energy')).toBe('low')
    })

    it('returns null for null input', () => {
      expect(detectField(null, 'energy')).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// computeCardScore
// ---------------------------------------------------------------------------

describe('computeCardScore', () => {
  it('returns 0 for empty match criteria against null-field persona', () => {
    const card = makeCard({ match: {} })
    const persona = makePersona()
    const score = computeCardScore(card, persona, NO_MEMORIES)
    expect(score).toBe(0)
  })

  it('null persona fields contribute 0, not negative', () => {
    const card = makeCard({
      match: {
        age_range: [25, 35],
        register: 'formal',
        energy: 'high',
      },
    })
    const persona = makePersona() // all null
    const score = computeCardScore(card, persona, NO_MEMORIES)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  describe('age_range scoring', () => {
    it('scores positively when age is within range', () => {
      const card = makeCard({ match: { age_range: [20, 30] } })
      const inRange = makePersona({ age: 25 })
      const outRange = makePersona({ age: 40 })
      expect(computeCardScore(card, inRange, NO_MEMORIES)).toBeGreaterThan(
        computeCardScore(card, outRange, NO_MEMORIES)
      )
    })

    it('scores 0 for age below lower bound', () => {
      const card = makeCard({ match: { age_range: [25, 35] } })
      const persona = makePersona({ age: 18 })
      const scoreWithAge = computeCardScore(card, persona, NO_MEMORIES)
      const scoreNoAge = computeCardScore(card, makePersona(), NO_MEMORIES)
      // Out-of-range age should not score higher than no age
      expect(scoreWithAge).toBeLessThanOrEqual(scoreNoAge)
    })

    it('scores 0 for null age', () => {
      const card = makeCard({ match: { age_range: [20, 30] } })
      const persona = makePersona({ age: null })
      expect(computeCardScore(card, persona, NO_MEMORIES)).toBe(0)
    })
  })

  describe('gender scoring', () => {
    it('scores positively when gender matches card gender list', () => {
      const card = makeCard({ match: { gender: ['여성'] } })
      const matched = makePersona({ gender: '여성' })
      const unmatched = makePersona({ gender: '남성' })
      expect(computeCardScore(card, matched, NO_MEMORIES)).toBeGreaterThan(
        computeCardScore(card, unmatched, NO_MEMORIES)
      )
    })

    it('scores 0 for null gender', () => {
      const card = makeCard({ match: { gender: ['여성'] } })
      const persona = makePersona({ gender: null })
      expect(computeCardScore(card, persona, NO_MEMORIES)).toBe(0)
    })
  })

  describe('register scoring (Tier 1)', () => {
    it('scores higher when texting_style contains formal keywords and card wants formal', () => {
      const card = makeCard({ match: { register: 'formal' } })
      const formalPersona = makePersona({ texting_style: '존댓말 위주로 공손하게' })
      const casualPersona = makePersona({ texting_style: '반말로 편하게 ㅋㅋ' })
      expect(computeCardScore(card, formalPersona, NO_MEMORIES)).toBeGreaterThan(
        computeCardScore(card, casualPersona, NO_MEMORIES)
      )
    })

    it('also checks communication_style for register detection', () => {
      const card = makeCard({ match: { register: 'casual' } })
      const persona = makePersona({ communication_style: '반말로 친근하게 ~야 스타일' })
      expect(computeCardScore(card, persona, NO_MEMORIES)).toBeGreaterThan(0)
    })
  })

  describe('humor scoring (Tier 1)', () => {
    it('scores higher when humor_style matches card humor', () => {
      const card = makeCard({ match: { humor: 'dry' } })
      const dryPerson = makePersona({ humor_style: '시니컬하고 건조한 유머' })
      const warmPerson = makePersona({ humor_style: '따뜻하고 다정한 유머' })
      expect(computeCardScore(card, dryPerson, NO_MEMORIES)).toBeGreaterThan(
        computeCardScore(card, warmPerson, NO_MEMORIES)
      )
    })
  })

  describe('energy scoring (Tier 1)', () => {
    it('scores higher when emotional_expression matches card energy', () => {
      const card = makeCard({ match: { energy: 'high' } })
      const highEnergy = makePersona({ emotional_expression: '활발하고 에너지 넘치는 표현' })
      const lowEnergy = makePersona({ emotional_expression: '조용하고 내성적인 표현' })
      expect(computeCardScore(card, highEnergy, NO_MEMORIES)).toBeGreaterThan(
        computeCardScore(card, lowEnergy, NO_MEMORIES)
      )
    })
  })

  describe('mbti scoring (Tier 3)', () => {
    it('matches exact MBTI', () => {
      const card = makeCard({ match: { mbti_like: ['ENFP', 'INFP'] } })
      const matched = makePersona({ mbti: 'ENFP' })
      const unmatched = makePersona({ mbti: 'ISTJ' })
      expect(computeCardScore(card, matched, NO_MEMORIES)).toBeGreaterThan(
        computeCardScore(card, unmatched, NO_MEMORIES)
      )
    })

    it('matches wildcard MBTI pattern E*F*', () => {
      const card = makeCard({ match: { mbti_like: ['E*F*'] } })
      const matched = makePersona({ mbti: 'ENFP' })
      const unmatched = makePersona({ mbti: 'ISTJ' })
      expect(computeCardScore(card, matched, NO_MEMORIES)).toBeGreaterThan(
        computeCardScore(card, unmatched, NO_MEMORIES)
      )
    })

    it('scores 0 for null mbti', () => {
      const card = makeCard({ match: { mbti_like: ['ENFP'] } })
      const persona = makePersona({ mbti: null })
      expect(computeCardScore(card, persona, NO_MEMORIES)).toBe(0)
    })
  })

  describe('tags scoring (Tier 3 & 4)', () => {
    it('scores higher with more tag overlap', () => {
      const card = makeCard({ match: { tags: ['독서', '영화', '음악'] } })
      const highOverlap = makePersona({ tags: ['독서', '영화', '여행'] })
      const lowOverlap = makePersona({ tags: ['스포츠', '게임'] })
      expect(computeCardScore(card, highOverlap, NO_MEMORIES)).toBeGreaterThan(
        computeCardScore(card, lowOverlap, NO_MEMORIES)
      )
    })

    it('hobbies contribute to tags overlap', () => {
      const card = makeCard({ match: { tags: ['독서', '영화'] } })
      const persona = makePersona({ hobbies: ['독서', '영화'] })
      expect(computeCardScore(card, persona, NO_MEMORIES)).toBeGreaterThan(0)
    })

    it('personality_traits contribute to tags overlap', () => {
      const card = makeCard({ match: { tags: ['독서'] } })
      const persona = makePersona({ personality_traits: ['독서', '사려깊음'] })
      expect(computeCardScore(card, persona, NO_MEMORIES)).toBeGreaterThan(0)
    })

    it('core_values contribute to tags overlap', () => {
      const card = makeCard({ match: { tags: ['성실'] } })
      const persona = makePersona({ core_values: ['성실', '정직'] })
      expect(computeCardScore(card, persona, NO_MEMORIES)).toBeGreaterThan(0)
    })
  })

  describe('mood modifier', () => {
    it('adds +0.2 boost when mood energy is high and card energy is high', () => {
      const card = makeCard({ match: { energy: 'high' } })
      const persona = makePersona({ emotional_expression: '활발하고 에너지 넘침' })
      const highMood: MoodState = {
        primary: '활기',
        energy: 0.85,
        openness: 0.5,
        warmth: 0.5,
        reason_hint: 'test',
      }
      const noMoodScore = computeCardScore(card, persona, NO_MEMORIES)
      const moodScore = computeCardScore(card, persona, NO_MEMORIES, highMood)
      expect(moodScore).toBeCloseTo(noMoodScore + 0.2, 5)
    })

    it('adds +0.2 boost when mood energy is mid and card energy is mid', () => {
      const card = makeCard({ match: { energy: 'mid' } })
      const persona = makePersona({ emotional_expression: '차분하고 안정된 편' })
      const midMood: MoodState = {
        primary: '평온',
        energy: 0.5,
        openness: 0.5,
        warmth: 0.5,
        reason_hint: 'test',
      }
      const noMoodScore = computeCardScore(card, persona, NO_MEMORIES)
      const moodScore = computeCardScore(card, persona, NO_MEMORIES, midMood)
      expect(moodScore).toBeCloseTo(noMoodScore + 0.2, 5)
    })

    it('adds +0.2 boost when mood energy is low and card energy is low', () => {
      const card = makeCard({ match: { energy: 'low' } })
      const persona = makePersona({ emotional_expression: '조용하고 내성적' })
      const lowMood: MoodState = {
        primary: '피곤',
        energy: 0.1,
        openness: 0.5,
        warmth: 0.5,
        reason_hint: 'test',
      }
      const noMoodScore = computeCardScore(card, persona, NO_MEMORIES)
      const moodScore = computeCardScore(card, persona, NO_MEMORIES, lowMood)
      expect(moodScore).toBeCloseTo(noMoodScore + 0.2, 5)
    })

    it('does not boost when mood energy mismatches card energy', () => {
      const card = makeCard({ match: { energy: 'low' } })
      const persona = makePersona()
      const highMood: MoodState = {
        primary: '활기',
        energy: 0.9,
        openness: 0.5,
        warmth: 0.5,
        reason_hint: 'test',
      }
      const noMoodScore = computeCardScore(card, persona, NO_MEMORIES)
      const moodScore = computeCardScore(card, persona, NO_MEMORIES, highMood)
      expect(moodScore).toBeCloseTo(noMoodScore, 5)
    })

    it('does not boost when card has no energy field', () => {
      const card = makeCard({ match: {} })
      const persona = makePersona()
      const highMood: MoodState = {
        primary: '활기',
        energy: 0.9,
        openness: 0.5,
        warmth: 0.5,
        reason_hint: 'test',
      }
      const noMoodScore = computeCardScore(card, persona, NO_MEMORIES)
      const moodScore = computeCardScore(card, persona, NO_MEMORIES, highMood)
      expect(moodScore).toBe(noMoodScore)
    })
  })
})

// ---------------------------------------------------------------------------
// pickStyleCards
// ---------------------------------------------------------------------------

describe('pickStyleCards', () => {
  it('returns empty array for empty cards input', () => {
    const persona = makePersona()
    expect(pickStyleCards([], persona, NO_MEMORIES)).toEqual([])
  })

  it('returns the single card regardless of score', () => {
    const card = makeCard({ id: 'only' })
    const persona = makePersona() // all null, score will be 0
    const result = pickStyleCards([card], persona, NO_MEMORIES)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('only')
  })

  it('returns top-K cards by score (default topK=3)', () => {
    const cards = [
      makeCard({ id: 'c1', match: { register: 'formal' } }),
      makeCard({ id: 'c2', match: { register: 'casual' } }),
      makeCard({ id: 'c3', match: { energy: 'high' } }),
      makeCard({ id: 'c4', match: { humor: 'dry' } }),
    ]
    const persona = makePersona({ texting_style: '존댓말 위주, 공손하게' })
    const result = pickStyleCards(cards, persona, NO_MEMORIES)
    expect(result.length).toBeLessThanOrEqual(3)
    // c1 should be included since it matches register:formal
    const ids = result.map((c) => c.id)
    expect(ids).toContain('c1')
  })

  it('respects custom topK option', () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeCard({ id: `c${i}`, match: {} })
    )
    const persona = makePersona()
    const result = pickStyleCards(cards, persona, NO_MEMORIES, undefined, { topK: 2 })
    expect(result).toHaveLength(2)
  })

  it('returns all cards when topK exceeds card count', () => {
    const cards = [makeCard({ id: 'a' }), makeCard({ id: 'b' })]
    const persona = makePersona()
    const result = pickStyleCards(cards, persona, NO_MEMORIES, undefined, { topK: 10 })
    expect(result).toHaveLength(2)
  })

  it('orders results by descending score', () => {
    const cards = [
      makeCard({ id: 'low', match: { register: 'casual' } }),
      makeCard({ id: 'high', match: { register: 'formal' } }),
    ]
    const persona = makePersona({
      texting_style: '격식있게 존댓말, 정중하게',
      communication_style: '예의 바르게 ~요체',
    })
    const result = pickStyleCards(cards, persona, NO_MEMORIES, undefined, { topK: 2 })
    expect(result[0].id).toBe('high')
  })

  it('applies mood modifier in card selection', () => {
    const highCard = makeCard({ id: 'high-energy', match: { energy: 'high' } })
    const lowCard = makeCard({ id: 'low-energy', match: { energy: 'low' } })
    const mood: MoodState = {
      primary: '활기',
      energy: 0.9,
      openness: 0.5,
      warmth: 0.5,
      reason_hint: 'test',
    }
    const persona = makePersona()
    const result = pickStyleCards([highCard, lowCard], persona, NO_MEMORIES, mood, { topK: 1 })
    expect(result[0].id).toBe('high-energy')
  })
})
