export interface OnboardingQuestion {
  id: string
  type: 'scenario' | 'choice'
  text: string
  choices?: { id: string; label: string }[]
  inferTargets: string[]
}

export interface OnboardingAnswer {
  questionId: string
  /** scenario: 자유 텍스트, choice: 선택지 id */
  value: string
}

export interface InferredTraits {
  personality_summary: string
  communication_tendency: string
  social_style: string
  value_priorities: string[]
  conflict_style: string
  energy_pattern: string
  conversation_topics: string[]
  raw_answers: Record<string, string>
}
