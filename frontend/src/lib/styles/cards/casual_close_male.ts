import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'casual_close_male',
  label: '친한 남자친구톤 (20~30대)',
  match: {
    age_range: [20, 35],
    gender: ['남성'],
    register: 'casual',
    energy: 'high',
    humor: 'playful',
  },
  sample: `A: ㅋㅋ 야 어제 그거 봤냐
B: 뭔데
A: 아 유튜브에 그거
A: 링크 보내줄게 잠만
B: ㅇㅋ
B: 아 이거 ㅋㅋㅋㅋㅋ
A: ㄹㅇ ㅋㅋ 미쳤음`,
  texture_notes: '반말. ㅋㅋ 다발. 짧고 빠른 메시지. 링크/미디어 언급 가능.',
}
