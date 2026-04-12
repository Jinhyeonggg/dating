import { describe, it, expect } from 'vitest'
import { parseTraitsInference } from './extract'

describe('parseTraitsInference', () => {
  it('유효한 추론 결과를 파싱한다', () => {
    const raw = {
      personality_summary: '내향적이면서 호기심이 많은 편',
      communication_tendency: '생각을 정리한 후 말하는 편',
      social_style: '소수와 깊게 사귀는 스타일',
      value_priorities: ['진정성', '자율성'],
      conflict_style: '시간을 두고 정리하는 편',
      energy_pattern: '혼자 시간으로 충전',
      conversation_topics: ['영화', '심리학'],
    }
    const result = parseTraitsInference(raw)
    expect(result.personality_summary).toBe('내향적이면서 호기심이 많은 편')
    expect(result.value_priorities).toEqual(['진정성', '자율성'])
    expect(result.conversation_topics).toEqual(['영화', '심리학'])
  })

  it('personality_summary 누락 시 에러', () => {
    expect(() => parseTraitsInference({ communication_tendency: 'x' })).toThrow()
  })

  it('value_priorities가 배열이 아니면 빈 배열로 폴백', () => {
    const raw = {
      personality_summary: 'test',
      communication_tendency: 'test',
      social_style: 'test',
      value_priorities: 'not array',
      conflict_style: 'test',
      energy_pattern: 'test',
      conversation_topics: [],
    }
    const result = parseTraitsInference(raw)
    expect(result.value_priorities).toEqual([])
  })

  it('conversation_topics가 배열이 아니면 빈 배열로 폴백', () => {
    const raw = {
      personality_summary: 'test',
      communication_tendency: 'test',
      social_style: 'test',
      value_priorities: [],
      conflict_style: 'test',
      energy_pattern: 'test',
      conversation_topics: 'not array',
    }
    const result = parseTraitsInference(raw)
    expect(result.conversation_topics).toEqual([])
  })
})
