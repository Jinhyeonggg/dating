import { describe, it, expect } from 'vitest'
import { buildWorldSnippet } from './inject'
import type { WorldContextRow } from './types'

function makeRow(category: string, headline: string): WorldContextRow {
  return {
    id: 'id', date: '2026-04-12', category: category as WorldContextRow['category'],
    headline, details: null, weight: 5, source: 'manual', created_at: '', updated_at: '',
  }
}

describe('buildWorldSnippet', () => {
  it('항목을 카테고리별로 포맷한다', () => {
    const items = [
      makeRow('market', '코스피 3200 돌파'),
      makeRow('weather', '서울 오후 비'),
    ]
    const snippet = buildWorldSnippet(items)
    expect(snippet.promptText).toContain('(market)')
    expect(snippet.promptText).toContain('코스피 3200 돌파')
    expect(snippet.promptText).toContain('(weather)')
    expect(snippet.promptText).toContain('어색하게 뉴스 브리핑하지 말 것')
  })

  it('빈 배열이면 빈 snippet 반환', () => {
    const snippet = buildWorldSnippet([])
    expect(snippet.items).toEqual([])
    expect(snippet.promptText).toBe('')
  })
})
