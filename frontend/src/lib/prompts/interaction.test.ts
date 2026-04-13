import { describe, it, expect } from 'vitest'
import { buildFirstUserMessage } from './interaction'

describe('buildFirstUserMessage', () => {
  it('관계 단계와 분위기가 포함되어야 한다', () => {
    const msg = buildFirstUserMessage({
      relationshipStageLabel: '처음 만나는 사이',
      moodLabel: '가벼운 대화',
      moodDescription: '일상적이고 편한 분위기',
      setting: null,
      partnerName: '지민',
      selfName: '태현',
    })
    expect(msg).toContain('처음 만나는 사이')
    expect(msg).toContain('가벼운 대화')
    expect(msg).toContain('지민')
    expect(msg).toContain('태현')
  })

  it('setting 있으면 포함', () => {
    const msg = buildFirstUserMessage({
      relationshipStageLabel: '몇 번 대화해 본 사이',
      moodLabel: '진지한 대화',
      moodDescription: '가치관, 인생관을 나누는 분위기',
      setting: '홍대 카페',
      partnerName: 'A',
      selfName: 'B',
    })
    expect(msg).toContain('홍대 카페')
  })

  it('setting null이면 생략', () => {
    const msg = buildFirstUserMessage({
      relationshipStageLabel: '처음 만나는 사이',
      moodLabel: '자유 대화',
      moodDescription: '제한 없이 자연스럽게',
      setting: null,
      partnerName: 'A',
      selfName: 'B',
    })
    expect(msg).not.toMatch(/장소/)
  })

  it('partnerHighlights 포함', () => {
    const msg = buildFirstUserMessage({
      relationshipStageLabel: '처음 만나는 사이',
      moodLabel: '가벼운 대화',
      moodDescription: '일상적이고 편한 분위기',
      setting: null,
      partnerName: 'A',
      selfName: 'B',
      partnerHighlights: '개발자 / INTJ',
    })
    expect(msg).toContain('개발자 / INTJ')
  })
})
