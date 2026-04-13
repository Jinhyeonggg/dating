export interface FirstUserMessageInput {
  scenarioLabel: string
  scenarioDescription: string
  setting: string | null
  partnerName: string
  selfName: string
  partnerHighlights?: string
}

/**
 * 첫 화자에게 전달될 "첫 user 메시지".
 * 일반 대화의 시작점 역할을 하되, 시나리오 맥락을 자연스럽게 제공.
 * 상대 Clone이 이 메시지를 보는 것이 아니라, 첫 발화자가 "이 상황에서 먼저 말을 건다"는 설정.
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
    `시나리오: ${input.scenarioLabel} — ${input.scenarioDescription}. ${settingPart}`,
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
