import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'default_casual',
  label: '기본 캐주얼 (fallback)',
  match: {
    register: 'casual',
    energy: 'mid',
  },
  sample: `A: 안녕
B: 응 안녕
A: 뭐해
B: 그냥 쉬고 있어
B: 너는?
A: 나도 ㅋㅋ 할 거 없어서`,
  texture_notes: '평이한 반말. 특별한 색깔 없음. 매칭 실패 시 fallback.',
}
