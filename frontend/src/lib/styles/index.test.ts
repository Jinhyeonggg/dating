import { describe, it, expect } from 'vitest'
import { getAllStyleCards } from './index'

describe('getAllStyleCards', () => {
  it('시드 카드 6장 이상을 반환한다', () => {
    const cards = getAllStyleCards()
    expect(cards.length).toBeGreaterThanOrEqual(6)
  })

  it('모든 카드가 id와 sample을 가진다', () => {
    const cards = getAllStyleCards()
    for (const card of cards) {
      expect(card.id).toBeTruthy()
      expect(card.sample).toBeTruthy()
    }
  })

  it('default_casual fallback 카드가 있다', () => {
    const cards = getAllStyleCards()
    expect(cards.some((c) => c.id === 'default_casual')).toBe(true)
  })
})
