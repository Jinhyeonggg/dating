import { describe, it, expect } from 'vitest'
import { renderRelationshipMemory } from './persona'
import type { CloneRelationship } from '@/types/relationship'

describe('renderRelationshipMemory', () => {
  it('관계 기억을 렌더링한다', () => {
    const rel: CloneRelationship = {
      id: '1',
      clone_id: 'a',
      target_clone_id: 'b',
      interaction_count: 2,
      summary: '영화 취향 비슷하고 유머 코드 맞음',
      memories: [
        { topic: '영화', detail: '호러 영화 좋아함', occurred_at: '2026-04-10' },
        { topic: '직장', detail: '이직 고민 중', occurred_at: '2026-04-12' },
      ],
      created_at: '2026-04-10',
      speech_register: null,
      updated_at: '2026-04-12',
    }
    const result = renderRelationshipMemory(rel, '민지')
    expect(result).toContain('민지')
    expect(result).toContain('2회')
    expect(result).toContain('영화 취향 비슷하고 유머 코드 맞음')
    expect(result).toContain('호러 영화 좋아함')
    expect(result).toContain('이직 고민 중')
  })

  it('null이면 빈 문자열', () => {
    expect(renderRelationshipMemory(null, '민지')).toBe('')
  })

  it('memories가 limit 이상이면 최근 것만', () => {
    const memories = Array.from({ length: 25 }, (_, i) => ({
      topic: `topic${i}`,
      detail: `detail${i}`,
      occurred_at: `2026-04-${String(i + 1).padStart(2, '0')}`,
    }))
    const rel: CloneRelationship = {
      id: '1',
      clone_id: 'a',
      target_clone_id: 'b',
      interaction_count: 5,
      summary: 'test',
      memories,
      speech_register: null,
      created_at: '2026-04-01',
      updated_at: '2026-04-25',
    }
    const result = renderRelationshipMemory(rel, '민지', 20)
    expect(result).toContain('topic24')
    expect(result).not.toContain('topic0')
  })
})
