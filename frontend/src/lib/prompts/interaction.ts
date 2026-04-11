export interface FirstUserMessageInput {
  scenarioLabel: string
  scenarioDescription: string
  setting: string | null
  partnerName: string
  selfName: string
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

  return [
    `(상황 설정: ${input.scenarioLabel} — ${input.scenarioDescription}. 당신(${input.selfName})이 ${input.partnerName}에게 먼저 말을 겁니다. ${settingPart})`,
    '',
    `자연스럽게 첫 마디를 건네세요. 어색한 자기소개나 과장된 인사말은 피하세요.`,
  ]
    .filter((l) => l.trim() !== '' || l === '')
    .join('\n')
    .trim()
}
