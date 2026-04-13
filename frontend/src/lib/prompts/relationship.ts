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

  return `당신은 ${selfName}입니다. 방금 ${partnerName}과 대화를 마쳤습니다.
아래 대화를 읽고, 당신(${selfName})이 실제로 느끼고 기억하는 것을 1인칭으로 작성하세요.

<나의_성격>
${personaContext}
</나의_성격>

${previousPart}

<conversation>
${conversationLog}
</conversation>

JSON으로만 응답하세요. 다른 설명 금지.

{
  "summary": "<${partnerName}에 대해 내가 느낀 종합 인상. 1-2문장, 1인칭. 이전 요약이 있으면 통합해서 갱신>",
  "new_memories": [
    {
      "topic": "<주제 키워드>",
      "detail": "<내가 기억하는 것, 1문장, 1인칭>"
    }
  ]
}

규칙:
- new_memories는 최대 3개까지만. 가장 인상적인 것만.
- detail은 반드시 20자 이내 1문장. 짧게.
- summary도 2문장 이내.
- JSON만 출력. 마크다운 코드블록(\`\`\`json) 금지.
- **반드시 "나"의 시점으로 작성**: "제니가 ~했다"가 아니라 "제니한테 ~라고 들었다", "~가 좀 인상적이었다" 처럼.

핵심 원칙 — 반드시 지킬 것:

1. **내 솔직한 감상**: 겉으로 공감했더라도 속으로 실제 어떻게 느꼈는지 쓰세요. "별로 관심 없었는데 맞장구쳤다", "의외로 통했다" 같은 솔직한 기억.
2. **온도 차이**: 내가 미지근했거나 상대가 시큰둥했으면 그대로 기억하세요.
3. **부정적 인상도 기록**: "좀 지루했다", "말이 잘 안 통한 느낌", "관심사가 다르다" — 미화하지 마세요.
4. **내 성격 기준으로 판단**: 위 성격/가치관/거부선 기준으로 실제 내가 느꼈을 반응을 쓰세요.
5. **AI스러운 관찰자 시점 금지**:
   - X "제니는 감정적 공감을 원했으나 이진형은 실용적 조언을 제시했음" (← 관찰자)
   - O "제니가 힘들어하는 건 알겠는데, 솔직히 쉬는 게 답이라고밖에 못 해줬다" (← 본인)
   - X "필라테스 강사로 일하며 사람들의 변화를 보는 걸 즐기는 사람" (← 프로필 요약)
   - O "필라테스 강사라는데, 사람 변하는 거 보면 뿌듯하다고 했다" (← 대화에서 들은 기억)

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
