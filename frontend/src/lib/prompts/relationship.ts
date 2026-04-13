import type { Persona } from '@/types/persona'

export interface RelationshipExtractionInput {
  conversationLog: string
  selfName: string
  selfPersona: Persona
  partnerName: string
  previousSummary: string | null
  previousMemories: { topic: string; detail: string }[]
}

export function buildRelationshipExtractionPrompt(input: RelationshipExtractionInput): string {
  const {
    conversationLog,
    selfName,
    selfPersona,
    partnerName,
    previousSummary,
    previousMemories,
  } = input

  const personaContext = [
    selfPersona.personality_traits?.length ? `성격: ${selfPersona.personality_traits.join(', ')}` : '',
    selfPersona.core_values?.length ? `가치관: ${selfPersona.core_values.join(', ')}` : '',
    selfPersona.dealbreakers?.length ? `거부선: ${selfPersona.dealbreakers.join(', ')}` : '',
    selfPersona.hobbies?.length ? `취미: ${selfPersona.hobbies.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const previousPart = previousSummary
    ? `<previous_relationship>
이전 요약: ${previousSummary}
이전 기억:
${previousMemories.map((m) => `- ${m.topic}: ${m.detail}`).join('\n')}
</previous_relationship>`
    : ''

  return `당신은 ${selfName}의 내면을 분석하는 심리학자입니다.
아래 대화를 읽고, ${selfName}의 관점에서 ${partnerName}에 대한 관계 기억을 추출하세요.

<${selfName}_personality>
${personaContext}
</${selfName}_personality>

${previousPart}

<conversation>
${conversationLog}
</conversation>

JSON으로만 응답하세요. 다른 설명 금지.

{
  "summary": "<${partnerName}에 대한 1-2문장 종합 인상. 이전 요약이 있으면 통합해서 갱신>",
  "new_memories": [
    {
      "topic": "<주제 키워드>",
      "detail": "<구체적 사실 또는 인상, 1문장>",
      "occurred_at": "<YYYY-MM-DD>"
    }
  ]
}

핵심 원칙 — 반드시 지킬 것:

1. **솔직한 내면 평가**: 겉으로 공감했더라도 ${selfName}의 성격/가치관 기준으로 실제로 흥미 있었는지, 어색했는지, 지루했는지 판단하세요.
2. **온도 차이 인식**: 한쪽이 열정적이고 다른 쪽이 미지근했으면 그걸 기록하세요.
3. **비호감 요소도 기록**: "말을 끊는 편", "관심사가 안 맞았다", "대화가 피상적" 같은 부정적 인상도 반드시 포함하세요.
4. **페르소나 기반 판단**: ${selfName}의 성격 특성, 가치관, 거부선에 비추어 상대를 어떻게 느꼈을지 추론하세요.
5. **AI스러운 추출 금지**:
   - X "다양한 주제로 대화를 나눔" → O "영화 얘기는 통했는데 운동 쪽은 관심 없는 듯"
   - X "즐거운 대화였음" → O "초반은 어색했고 중반부터 좀 풀림"
   - X "상대의 취미에 관심을 보임" → O "등산 얘기를 길게 했는데 솔직히 별로"

new_memories는 이번 대화에서 새로 알게 된 사실/인상만. 이전 기억과 중복되면 생략.`
}

export function buildResummarizationPrompt(
  previousSummary: string,
  newSummary: string,
  interactionCount: number,
): string {
  return `이전 관계 요약: "${previousSummary}"
이번 대화 후 요약: "${newSummary}"
총 대화 횟수: ${interactionCount}회

두 요약을 통합해서 1-2문장으로 갱신하세요. 변화가 있으면 반영하고, 핵심만 남기세요.
JSON으로 응답: {"summary": "<통합 요약>"}`
}
