import { describe, it, expect } from 'vitest'
import { buildMemoryExtractionPrompt } from './memory'

describe('buildMemoryExtractionPrompt', () => {
  it('사용자 입력이 포함되어야 한다', () => {
    const out = buildMemoryExtractionPrompt('오늘 영화 봤어', new Date('2026-04-12'))
    expect(out).toContain('오늘 영화 봤어')
  })

  it('현재 날짜 ISO 형식이 포함되어야 한다', () => {
    const out = buildMemoryExtractionPrompt('안녕', new Date('2026-04-12'))
    expect(out).toContain('2026-04-12')
  })

  it('허용 kind 4개가 명시되어야 한다', () => {
    const out = buildMemoryExtractionPrompt('test', new Date())
    expect(out).toContain('event')
    expect(out).toContain('mood')
    expect(out).toContain('fact')
    expect(out).toContain('preference_update')
  })

  it('JSON 형식 강제 지시가 포함되어야 한다', () => {
    const out = buildMemoryExtractionPrompt('test', new Date())
    expect(out.toLowerCase()).toContain('json')
  })
})
