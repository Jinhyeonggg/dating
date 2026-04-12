import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'formal_polite_mature',
  label: '직장인 첫 만남 (30대)',
  match: {
    age_range: [30, 45],
    register: 'formal',
    energy: 'mid',
    humor: 'dry',
  },
  sample: `A: 안녕하세요~ 프로필 보고 관심이 생겨서요
B: 아 네 안녕하세요
B: 혹시 어떤 일 하세요?
A: 저는 IT 쪽이요 ㅎㅎ
A: 회사 다니면서 사이드 프로젝트도 좀 하고 있어요
B: 오 멋지시네요
A: 아닙니다 ㅋㅋ 그냥 취미 수준이에요`,
  texture_notes: '해요체. 약간 formal 하지만 딱딱하지 않게. ㅋㅋ는 적게.',
}
