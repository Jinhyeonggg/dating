import { describe, it, expect } from 'vitest'
import { shouldEnd } from './endCheck'
import type { InteractionEvent } from '@/types/interaction'

function event(turn: number, content: string): InteractionEvent {
  return {
    id: `e${turn}`, interaction_id: 'i1', turn_number: turn,
    speaker_clone_id: turn % 2 === 0 ? 'a' : 'b',
    content, created_at: '',
  }
}

describe('shouldEnd', () => {
  it('events.length >= maxTurns 면 true', () => {
    const events = Array.from({ length: 20 }, (_, i) => event(i, '대화 충분히 긴 내용'))
    expect(shouldEnd(events, 20, '마지막 응답입니다')).toBe(true)
  })

  it('events.length < maxTurns 면 false (긴 응답)', () => {
    const events = [event(0, '안녕하세요 반가워요')]
    expect(shouldEnd(events, 20, '안녕하세요 반가워요')).toBe(false)
  })

  it('lastResponse 에 END 마커 포함되면 true', () => {
    expect(
      shouldEnd([event(0, '안녕')], 20, '잘 가요 <promise>END</promise>')
    ).toBe(true)
  })

  it('최근 5턴 모두 content.length < 4 이면 true', () => {
    const events = [
      event(0, '이것은 충분히 긴 응답입니다'),
      event(1, '네'),
      event(2, '응'),
      event(3, '네'),
      event(4, '응'),
      event(5, '네'),
    ]
    expect(shouldEnd(events, 20, '네')).toBe(true)
  })

  it('최근 5턴 중 하나라도 길면 false', () => {
    const events = [
      event(0, '네'),
      event(1, '오 그래요?'),
      event(2, '응'),
      event(3, '네'),
      event(4, '응'),
    ]
    expect(shouldEnd(events, 20, '응')).toBe(false)
  })
})
