import { describe, it, expect } from 'vitest'
import { getSpeechRegister } from './interaction'

describe('getSpeechRegister', () => {
  it('나이 차이 5살 이상 → formal', () => {
    expect(getSpeechRegister(25, 31, 0)).toBe('formal')
    expect(getSpeechRegister(20, 30, 10)).toBe('formal')
  })

  it('나이 차이 4살 이내 & 첫만남 → banmal-ready', () => {
    expect(getSpeechRegister(25, 27, 0)).toBe('banmal-ready')
    expect(getSpeechRegister(25, 25, 0)).toBe('banmal-ready')
  })

  it('나이 차이 4살 이내 & 3회 이상 → casual', () => {
    expect(getSpeechRegister(25, 27, 3)).toBe('casual')
    expect(getSpeechRegister(25, 25, 5)).toBe('casual')
  })

  it('나이 차이 4살 이내 & 1-2회 → banmal-ready', () => {
    expect(getSpeechRegister(25, 27, 1)).toBe('banmal-ready')
    expect(getSpeechRegister(25, 27, 2)).toBe('banmal-ready')
  })

  it('나이 정보 없음 → banmal-ready', () => {
    expect(getSpeechRegister(null, 27, 0)).toBe('banmal-ready')
    expect(getSpeechRegister(25, null, 3)).toBe('banmal-ready')
    expect(getSpeechRegister(null, null, 10)).toBe('banmal-ready')
  })
})
