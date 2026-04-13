import { describe, it, expect } from 'vitest'
import { getRelationshipStage } from './interaction'

describe('getRelationshipStage', () => {
  it('0회 → first-meeting', () => {
    expect(getRelationshipStage(0)).toEqual({
      id: 'first-meeting',
      label: '처음 만나는 사이',
    })
  })

  it('1회 → early-acquaintance', () => {
    expect(getRelationshipStage(1)).toEqual({
      id: 'early-acquaintance',
      label: '몇 번 대화해 본 사이',
    })
  })

  it('2회 → early-acquaintance', () => {
    expect(getRelationshipStage(2)).toEqual({
      id: 'early-acquaintance',
      label: '몇 번 대화해 본 사이',
    })
  })

  it('3회 → familiar', () => {
    expect(getRelationshipStage(3)).toEqual({
      id: 'familiar',
      label: '여러 번 대화한 사이',
    })
  })

  it('100회 → familiar', () => {
    expect(getRelationshipStage(100)).toEqual({
      id: 'familiar',
      label: '여러 번 대화한 사이',
    })
  })
})
