export function buildMoodRollPrompt(
  personaCore: string,
  memoriesText: string,
  worldText: string,
): string {
  return `당신은 감정 시뮬레이터입니다. 아래 인물의 페르소나, 최근 기억, 오늘의 외부 상황을 기반으로 이 사람이 지금 어떤 기분일지 추론하세요.

## 페르소나
${personaCore}

## 최근 기억
${memoriesText || '(없음)'}

## 오늘 외부 상황
${worldText || '(정보 없음)'}

## 지시사항
- 위 정보를 종합해 이 사람의 현재 기분을 JSON으로 반환하세요.
- primary는 반드시 다음 중 하나: "평온", "설렘", "짜증", "우울", "활기", "피곤", "긴장"
- energy/openness/warmth는 0.0~1.0 사이 소수점 한 자리
- reason_hint는 왜 이런 기분인지 한두 문장

반드시 아래 JSON 형식만 출력하세요:
{"primary":"...","energy":0.0,"openness":0.0,"warmth":0.0,"reason_hint":"..."}`
}
