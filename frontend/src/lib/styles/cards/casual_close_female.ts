import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'casual_close_female',
  label: '친한 여자친구톤 (20~30대)',
  match: {
    age_range: [20, 35],
    gender: ['여성'],
    register: 'casual',
    energy: 'high',
    humor: 'playful',
  },
  sample: `A: 야
A: 나 오늘 개빡쳐
B: ?? 뭔일
A: 그냥 아 몰라 ㅋㅋㅋ
B: 상사임?
A: ㅇㅇ
A: 진짜 말이 안 통해
B: ㅠㅠㅠ 힘들다 진짜`,
  texture_notes: '반말. ㅋㅋ/ㅠㅠ 자유롭게. 한 문장 쪼개 보내기 자주.',
}
