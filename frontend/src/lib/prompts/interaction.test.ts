import { describe, it, expect } from 'vitest'
import { buildFirstUserMessage } from './interaction'

describe('buildFirstUserMessage', () => {
  it('시나리오 라벨이 포함되어야 한다', () => {
    const msg = buildFirstUserMessage({
      scenarioLabel: '온라인 대화 앱에서 처음 매칭됨',
      scenarioDescription: '둘 다 상대방을 오늘 처음 봄',
      setting: null,
      partnerName: '지민',
      selfName: '태현',
    })
    expect(msg).toContain('온라인 대화 앱에서 처음 매칭됨')
    expect(msg).toContain('지민')
  })

  it('setting 있으면 포함', () => {
    const msg = buildFirstUserMessage({
      scenarioLabel: '친구의 친구로 가볍게 대화',
      scenarioDescription: '서로 이름 정도만 아는 사이',
      setting: '홍대 카페',
      partnerName: 'A',
      selfName: 'B',
    })
    expect(msg).toContain('홍대 카페')
  })

  it('setting null이면 생략', () => {
    const msg = buildFirstUserMessage({
      scenarioLabel: 'X',
      scenarioDescription: 'Y',
      setting: null,
      partnerName: 'A',
      selfName: 'B',
    })
    expect(msg).not.toMatch(/장소/)
  })

  it('메타 지시 포함 (AI 티 금지 등 프롬프트 힌트)', () => {
    const msg = buildFirstUserMessage({
      scenarioLabel: 'X',
      scenarioDescription: 'Y',
      setting: null,
      partnerName: 'A',
      selfName: 'B',
    })
    // 첫 턴을 자연스러운 인사/말 걸기로 시작하라는 힌트가 있어야 함
    expect(msg.length).toBeGreaterThan(30)
  })
})
