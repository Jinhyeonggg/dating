import { describe, it, expect } from 'vitest'
import { scoreAndSelectItems } from './collect'
import type { WorldContextRow } from './types'
import type { Persona } from '@/types/persona'

function makeRow(overrides: Partial<WorldContextRow>): WorldContextRow {
  return {
    id: 'test-id', date: '2026-04-12', category: 'news',
    headline: '테스트 뉴스', details: null, weight: 5,
    source: 'manual', created_at: '', updated_at: '',
    ...overrides,
  }
}

describe('scoreAndSelectItems', () => {
  it('weight 기반 정렬, top-N 선택', () => {
    const rows = [
      makeRow({ headline: 'low', weight: 1 }),
      makeRow({ headline: 'high', weight: 10 }),
      makeRow({ headline: 'mid', weight: 5 }),
    ]
    const result = scoreAndSelectItems(rows, null, [], 2)
    expect(result.length).toBe(2)
    expect(result[0].headline).toBe('high')
    expect(result[1].headline).toBe('mid')
  })

  it('persona hobbies와 headline 교집합 시 bonus', () => {
    const rows = [
      makeRow({ headline: '등산 대회 개최', weight: 3 }),
      makeRow({ headline: '코스피 하락', weight: 5 }),
    ]
    const persona = { hobbies: ['등산', '캠핑'] } as Persona
    const result = scoreAndSelectItems(rows, persona, [], 1)
    expect(result[0].headline).toContain('등산')
  })

  it('빈 배열이면 빈 배열 반환', () => {
    expect(scoreAndSelectItems([], null, [], 5)).toEqual([])
  })
})
