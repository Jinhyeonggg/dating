import { describe, it, expect } from 'vitest'
import { TEXTURE_RULES } from './texture'

describe('TEXTURE_RULES', () => {
  it('마침표 규칙을 포함한다', () => {
    expect(TEXTURE_RULES).toContain('마침표')
    expect(TEXTURE_RULES).toContain("'.'")
  })

  it('줄임말/구어체 가이드를 포함한다', () => {
    expect(TEXTURE_RULES).toContain('ㅋㅋ')
    expect(TEXTURE_RULES).toContain('ㅠㅠ')
  })

  it('AI스러움 금지 패턴을 포함한다', () => {
    expect(TEXTURE_RULES).toContain('또한')
    expect(TEXTURE_RULES).toContain('그러므로')
  })

  it('register 존중 언급이 있다', () => {
    expect(TEXTURE_RULES).toContain('register')
  })

  it('연속 발화 언급이 있다', () => {
    expect(TEXTURE_RULES).toContain('연속')
  })
})
