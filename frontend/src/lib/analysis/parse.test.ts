import { describe, it, expect } from 'vitest'
import { parseAnalysisReport } from './parse'

const validReport = {
  score: 75,
  categories: {
    conversation_flow: { score: 80, comment: '자연스러움' },
    shared_interests: { score: 70, comment: '영화 취향 유사' },
    values_alignment: { score: 75, comment: '가치관 비슷' },
    communication_fit: { score: 72, comment: '페이스 맞음' },
    potential_conflicts: { score: 60, comment: '성격 차이 있음' },
  },
  summary: '전반적으로 궁합이 좋음',
  recommended_next: 'continue',
}

describe('parseAnalysisReport', () => {
  it('유효한 리포트를 파싱', () => {
    const result = parseAnalysisReport(validReport)
    expect(result.score).toBe(75)
    expect(result.categories.conversation_flow.score).toBe(80)
  })

  it('score 범위 밖이면 throw (0 미만)', () => {
    expect(() =>
      parseAnalysisReport({ ...validReport, score: -1 })
    ).toThrow()
  })

  it('score 범위 밖이면 throw (100 초과)', () => {
    expect(() =>
      parseAnalysisReport({ ...validReport, score: 101 })
    ).toThrow()
  })

  it('객체 아니면 throw', () => {
    expect(() => parseAnalysisReport('not an object')).toThrow()
  })

  it('required 카테고리 누락 시 throw', () => {
    const bad = {
      ...validReport,
      categories: {
        conversation_flow: { score: 80, comment: '' },
      },
    }
    expect(() => parseAnalysisReport(bad)).toThrow()
  })

  it('recommended_next 잘못된 값이면 throw', () => {
    expect(() =>
      parseAnalysisReport({ ...validReport, recommended_next: 'maybe' })
    ).toThrow()
  })
})
