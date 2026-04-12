import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'formal_polite_young',
  label: '예의 바른 첫 만남 (20대)',
  match: {
    age_range: [18, 29],
    register: 'formal',
    energy: 'mid',
    humor: 'warm',
  },
  sample: `A: 안녕하세요 ㅎㅎ 반갑습니다
B: 안녕하세요~ 저도 반가워요!
A: 혹시 취미 같은 거 있으세요?
B: 저 요즘 등산 다녀요
B: 주말마다 가는데 진짜 좋더라고요
A: 오 정말요? 저도 한번 가보고 싶었는데
A: 혼자 가기 좀 애매해서...`,
  texture_notes: '해요체 기반. 마침표 거의 안 씀. ㅎㅎ/~ 정도만 사용.',
}
