import { describe, it, expect } from 'vitest'
import { parseMoodResponse, moodStateSchema } from './parse'

describe('moodStateSchema', () => {
  it('유효한 MoodState JSON을 파싱한다', () => {
    const raw = {
      primary: '활기',
      energy: 0.8,
      openness: 0.7,
      warmth: 0.6,
      reason_hint: '날씨가 좋아서',
    }
    const result = moodStateSchema.parse(raw)
    expect(result.primary).toBe('활기')
    expect(result.energy).toBe(0.8)
  })

  it('유효하지 않은 primary를 거부한다', () => {
    const raw = { primary: '행복', energy: 0.5, openness: 0.5, warmth: 0.5, reason_hint: '' }
    expect(() => moodStateSchema.parse(raw)).toThrow()
  })

  it('에너지 범위 초과를 거부한다', () => {
    const raw = { primary: '평온', energy: 1.5, openness: 0.5, warmth: 0.5, reason_hint: '' }
    expect(() => moodStateSchema.parse(raw)).toThrow()
  })
})

describe('parseMoodResponse', () => {
  it('JSON 문자열에서 MoodState를 추출한다', () => {
    const raw = '```json\n{"primary":"짜증","energy":0.3,"openness":0.2,"warmth":0.3,"reason_hint":"상사 때문에"}\n```'
    const result = parseMoodResponse(raw)
    expect(result!.primary).toBe('짜증')
  })

  it('bare JSON도 처리한다', () => {
    const raw = '{"primary":"평온","energy":0.5,"openness":0.6,"warmth":0.7,"reason_hint":""}'
    const result = parseMoodResponse(raw)
    expect(result!.primary).toBe('평온')
  })

  it('파싱 불가능하면 null 반환', () => {
    const result = parseMoodResponse('이것은 JSON이 아닙니다')
    expect(result).toBeNull()
  })

  it('스키마 불일치면 null 반환', () => {
    const raw = '{"primary":"존재안함","energy":0.5,"openness":0.5,"warmth":0.5,"reason_hint":""}'
    const result = parseMoodResponse(raw)
    expect(result).toBeNull()
  })
})
