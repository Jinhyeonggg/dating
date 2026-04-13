export interface FirstUserMessageInput {
  relationshipStageLabel: string
  moodLabel: string
  moodDescription: string
  setting: string | null
  partnerName: string
  selfName: string
  partnerHighlights?: string
}

/**
 * 첫 화자에게 전달될 "첫 user 메시지".
 * 관계 단계 + 분위기를 분리해서 전달한다.
 */
export function buildFirstUserMessage(input: FirstUserMessageInput): string {
  const settingPart = input.setting
    ? `장소/매체는 "${input.setting}"입니다.`
    : ''

  const highlightsPart = input.partnerHighlights
    ? ` ${input.partnerName}의 프로필 정보: ${input.partnerHighlights}`
    : ''

  return [
    `(상황 설정: 프로필 매칭 플랫폼에서 대화를 시작합니다.`,
    `관계: ${input.relationshipStageLabel}.`,
    `분위기: ${input.moodLabel} — ${input.moodDescription}. ${settingPart}`,
    ``,
    `당신은 "${input.selfName}"입니다. 당신의 정보는 위 system prompt에 있습니다.`,
    `상대방은 "${input.partnerName}"입니다.${highlightsPart}`,
    ``,
    `당신(${input.selfName})이 ${input.partnerName}에게 먼저 말을 겁니다.`,
    `인사는 짧게 1번만 하고 바로 상대방(${input.partnerName})의 프로필에서 관심 가는 주제로 넘어가세요.)`,
  ]
    .join('\n')
    .trim()
}
