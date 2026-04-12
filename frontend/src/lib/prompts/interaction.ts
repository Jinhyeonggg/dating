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
    ? `\n상대방 프로필에서 본 정보: ${input.partnerHighlights}`
    : ''

  return [
    `(상황 설정: 프로필 매칭 플랫폼에서 ${input.partnerName}의 프로필을 보고 관심이 생겨 대화를 시작합니다.`,
    `시나리오: ${input.scenarioLabel} — ${input.scenarioDescription}. ${settingPart}`,
    `당신(${input.selfName})이 먼저 말을 겁니다.${highlightsPart})`,
    '',
    `인사는 짧게 1번만 하고 바로 관심 가는 주제로 넘어가세요. "안녕하세요" + 프로필에서 본 것에 대한 질문/코멘트가 자연스럽습니다.`,
    `예: "안녕하세요 ㅎㅎ 프로필에 등산 좋아하신다고 돼 있어서 연락드렸어요"`,
  ]
    .join('\n')
    .trim()
}
