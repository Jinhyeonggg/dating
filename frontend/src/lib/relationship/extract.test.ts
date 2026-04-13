import { describe, it, expect } from 'vitest'
import { parseRelationshipExtraction } from './extract'

describe('parseRelationshipExtraction', () => {
  it('유효한 추출 결과를 파싱한다', () => {
    const raw = {
      summary: '영화 취향 비슷하고 유머 코드 맞음. 운동 쪽은 관심 없는 듯',
      new_memories: [
        { topic: '영화', detail: '호러 영화 좋아함, 조던 필 팬', occurred_at: '2026-04-12' },
        { topic: '직장', detail: '최근 이직 고민 중이라고 함', occurred_at: '2026-04-12' },
      ],
    }
    const result = parseRelationshipExtraction(raw)
    expect(result.summary).toBe('영화 취향 비슷하고 유머 코드 맞음. 운동 쪽은 관심 없는 듯')
    expect(result.new_memories).toHaveLength(2)
    expect(result.new_memories[0].topic).toBe('영화')
  })

  it('summary가 없으면 에러', () => {
    expect(() => parseRelationshipExtraction({ new_memories: [] })).toThrow()
  })

  it('new_memories가 빈 배열이면 에러', () => {
    expect(() =>
      parseRelationshipExtraction({ summary: 'test', new_memories: [] })
    ).toThrow()
  })

  it('new_memories 항목에 필수 필드 누락 시 해당 항목 필터링', () => {
    const raw = {
      summary: 'test',
      new_memories: [
        { topic: '영화', detail: '좋아함', occurred_at: '2026-04-12' },
        { topic: '', detail: '빈 토픽', occurred_at: '2026-04-12' },
        { detail: '토픽 없음', occurred_at: '2026-04-12' },
      ],
    }
    const result = parseRelationshipExtraction(raw)
    expect(result.new_memories).toHaveLength(1)
    expect(result.new_memories[0].topic).toBe('영화')
  })

  it('new_memories 전부 유효하지 않으면 에러', () => {
    expect(() =>
      parseRelationshipExtraction({
        summary: 'test',
        new_memories: [{ topic: '', detail: '', occurred_at: '' }],
      })
    ).toThrow()
  })
})
