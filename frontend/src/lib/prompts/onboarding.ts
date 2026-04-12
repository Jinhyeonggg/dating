import type { OnboardingAnswer } from '@/types/onboarding'
import { ONBOARDING_QUESTIONS } from '@/lib/constants/onboardingQuestions'

export function buildTraitsInferencePrompt(answers: OnboardingAnswer[]): string {
  const qaParts = answers.map((a) => {
    const q = ONBOARDING_QUESTIONS.find((q) => q.id === a.questionId)
    if (!q) return ''

    if (q.type === 'choice') {
      const chosen = q.choices?.find((c) => c.id === a.value)
      return `질문: ${q.text}\n답변: ${chosen?.label ?? a.value}`
    }
    return `질문: ${q.text}\n답변: ${a.value}`
  }).filter(Boolean).join('\n\n')

  return `아래는 한 사람이 성격 파악 질문에 답한 내용입니다.

${qaParts}

이 사람의 행동 패턴을 분석해 아래 JSON 형식으로만 응답하세요. 다른 설명 금지.

{
  "personality_summary": "<1-2문장. 핵심 성격 특성>",
  "communication_tendency": "<1문장. 대화/소통 스타일>",
  "social_style": "<1문장. 사회적 에너지 패턴>",
  "value_priorities": ["<중요 가치 3-5개>"],
  "conflict_style": "<1문장. 갈등 대처 방식>",
  "energy_pattern": "<1문장. 에너지 충전/소모 패턴>",
  "conversation_topics": ["<대화 시 즐기는 주제 3-5개>"]
}

규칙:
- 응답에서 직접 드러난 것만 기술. 과도한 추론 금지.
- 한국어로 자연스럽게 서술. "~하는 편", "~인 경향" 같은 톤.
- value_priorities와 conversation_topics는 string 배열.`
}
