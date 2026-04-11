export const INTERACTION_DEFAULTS = {
  MAX_TURNS: 20,
  MIN_RESPONSE_LENGTH: 10,
  END_SIGNAL_SHORT_TURNS_THRESHOLD: 3,
  MEMORY_INJECTION_LIMIT: 10,
  SYSTEM_PROMPT_TOKEN_BUDGET: 1500,
  HEARTBEAT_WARNING_MS: 5000,
  HEARTBEAT_DANGER_MS: 30000,
} as const

export const END_PROMISE_MARKER = '<promise>END</promise>'

export const DEFAULT_SCENARIOS = [
  {
    id: 'online-first-match',
    label: '온라인 대화 앱에서 처음 매칭됨',
    description: '둘 다 상대방을 오늘 처음 봄',
  },
  {
    id: 'casual-chat',
    label: '친구의 친구로 가볍게 대화',
    description: '서로 이름 정도만 아는 사이',
  },
  {
    id: 'deep-talk',
    label: '깊은 주제 토론',
    description: '가치관·인생관을 나누는 분위기',
  },
] as const
