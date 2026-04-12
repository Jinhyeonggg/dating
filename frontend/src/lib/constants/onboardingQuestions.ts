import type { OnboardingQuestion } from '@/types/onboarding'

export const ONBOARDING_QUESTIONS: readonly OnboardingQuestion[] = [
  // 시나리오 반응형 (3문항)
  {
    id: 'scenario_canceled_plans',
    type: 'scenario',
    text: '금요일 저녁, 친구가 갑자기 약속을 취소했어요. 어떻게 보내실 것 같아요?',
    inferTargets: ['personality_summary', 'energy_pattern', 'social_style'],
  },
  {
    id: 'scenario_friend_disagree',
    type: 'scenario',
    text: '친한 친구가 당신이 동의하지 않는 결정을 내렸어요. 어떻게 하실 것 같아요?',
    inferTargets: ['conflict_style', 'value_priorities', 'communication_tendency'],
  },
  {
    id: 'scenario_great_conversation',
    type: 'scenario',
    text: '처음 만난 사람과 대화가 잘 통하고 있어요. 어떤 주제일 때 가장 신나요?',
    inferTargets: ['conversation_topics', 'communication_tendency', 'social_style'],
  },
  // 선택지 퀴즈 (4문항)
  {
    id: 'choice_thinking_style',
    type: 'choice',
    text: '대화할 때 당신에 더 가까운 쪽은?',
    choices: [
      { id: 'think_first', label: '생각을 정리한 다음 말한다' },
      { id: 'think_while_talking', label: '말하면서 생각을 정리한다' },
    ],
    inferTargets: ['communication_tendency'],
  },
  {
    id: 'choice_ideal_weekend',
    type: 'choice',
    text: '주말 이상적인 하루는?',
    choices: [
      { id: 'home', label: '집에서 넷플릭스' },
      { id: 'cafe', label: '카페에서 작업' },
      { id: 'friends', label: '친구들과 외출' },
      { id: 'explore', label: '새로운 장소 탐험' },
    ],
    inferTargets: ['energy_pattern', 'social_style'],
  },
  {
    id: 'choice_conflict',
    type: 'choice',
    text: '갈등이 생겼을 때?',
    choices: [
      { id: 'direct', label: '바로 이야기한다' },
      { id: 'process', label: '시간을 두고 정리한 뒤 이야기한다' },
      { id: 'wait', label: '상대가 먼저 꺼내길 기다린다' },
    ],
    inferTargets: ['conflict_style'],
  },
  {
    id: 'choice_social_energy',
    type: 'choice',
    text: '모임이 끝난 후 기분은?',
    choices: [
      { id: 'energized', label: '에너지가 충전된 느낌' },
      { id: 'drained', label: '즐겁지만 혼자 시간이 필요함' },
      { id: 'depends', label: '사람에 따라 다름' },
    ],
    inferTargets: ['personality_summary', 'energy_pattern'],
  },
] as const
