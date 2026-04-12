import { describe, it, expect } from 'vitest'
import { renderInferredTraits } from './persona'

describe('renderInferredTraits', () => {
  it('모든 필드를 렌더링한다', () => {
    const traits = {
      personality_summary: '내향적이면서 호기심이 많은 편',
      communication_tendency: '생각을 정리한 후 말하는 편',
      social_style: '소수와 깊게',
      value_priorities: ['진정성', '자율성'],
      conflict_style: '시간을 두고 정리하는 편',
      energy_pattern: '혼자 시간으로 충전',
      conversation_topics: ['영화', '심리학'],
      raw_answers: {},
    }
    const result = renderInferredTraits(traits)
    expect(result).toContain('내향적이면서 호기심이 많은 편')
    expect(result).toContain('진정성, 자율성')
    expect(result).toContain('영화, 심리학')
    expect(result).not.toContain('raw_answers')
  })

  it('null이면 빈 문자열', () => {
    expect(renderInferredTraits(null)).toBe('')
  })
})
