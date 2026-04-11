import { describe, it, expect } from 'vitest'
import { parseMemoryExtraction, normalizeOccurredAt } from './extract'

describe('parseMemoryExtraction', () => {
  it('유효한 객체를 파싱한다', () => {
    const raw = {
      kind: 'event',
      content: '영화 봄',
      tags: ['영화'],
      occurred_at: '2026-04-11',
    }
    const result = parseMemoryExtraction(raw)
    expect(result).toEqual(raw)
  })

  it('kind 없으면 throw', () => {
    expect(() =>
      parseMemoryExtraction({ content: 'x', occurred_at: '2026-04-11' })
    ).toThrow()
  })

  it('kind가 enum 밖이면 throw', () => {
    expect(() =>
      parseMemoryExtraction({
        kind: 'invalid',
        content: 'x',
        occurred_at: '2026-04-11',
      })
    ).toThrow()
  })

  it('tags 없으면 빈 배열로 기본값', () => {
    const result = parseMemoryExtraction({
      kind: 'event',
      content: '영화 봄',
      occurred_at: '2026-04-11',
    })
    expect(result.tags).toEqual([])
  })

  it('tags가 배열이 아니면 빈 배열', () => {
    const result = parseMemoryExtraction({
      kind: 'event',
      content: '영화 봄',
      occurred_at: '2026-04-11',
      tags: 'not-an-array',
    })
    expect(result.tags).toEqual([])
  })

  it('tags 안의 비문자열 요소는 필터링', () => {
    const result = parseMemoryExtraction({
      kind: 'event',
      content: '영화 봄',
      occurred_at: '2026-04-11',
      tags: ['영화', 123, null, '재미'],
    })
    expect(result.tags).toEqual(['영화', '재미'])
  })

  it('추가 필드는 무시', () => {
    const result = parseMemoryExtraction({
      kind: 'event',
      content: '영화 봄',
      occurred_at: '2026-04-11',
      extra_field: 'ignored',
    })
    expect(result).not.toHaveProperty('extra_field')
  })
})

describe('normalizeOccurredAt', () => {
  const now = new Date('2026-04-11T00:00:00Z') // 금요일

  it('이미 ISO 형식은 그대로', () => {
    expect(normalizeOccurredAt('2026-04-01', now)).toBe('2026-04-01')
  })

  it('"오늘" → now 날짜', () => {
    expect(normalizeOccurredAt('오늘', now)).toBe('2026-04-11')
  })

  it('"어제" → now - 1일', () => {
    expect(normalizeOccurredAt('어제', now)).toBe('2026-04-10')
  })

  it('"그저께" → now - 2일', () => {
    expect(normalizeOccurredAt('그저께', now)).toBe('2026-04-09')
  })

  it('"지난주" → now - 7일', () => {
    expect(normalizeOccurredAt('지난주', now)).toBe('2026-04-04')
  })

  it('파싱 실패하면 throw', () => {
    expect(() => normalizeOccurredAt('언젠가', now)).toThrow()
  })
})
