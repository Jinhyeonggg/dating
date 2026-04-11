export function buildMemoryExtractionPrompt(raw: string, now: Date): string {
  const today = now.toISOString().slice(0, 10)
  return `<user_input>${raw}</user_input>
<current_date>${today}</current_date>

사용자가 방금 자신(또는 자신의 클론)에 대해 쓴 짧은 자연어 메모입니다. 다음 JSON 형식으로만 응답하세요. 다른 설명 금지.

{
  "kind": "event" | "mood" | "fact" | "preference_update",
  "content": "<1-2 문장으로 정리한 본문>",
  "tags": ["<관련 태그 0-5개>"],
  "occurred_at": "<YYYY-MM-DD 또는 '오늘' / '어제' / '지난주' 같은 상대 표현>"
}

규칙:
- kind는 다음 중 내용에 가장 맞는 하나:
  * event: 구체적 사건 ("영화 봤다", "친구 만났다")
  * mood: 감정·상태 ("피곤함", "설렘")
  * fact: 사실·상황 변화 ("고양이 키우기 시작", "이직")
  * preference_update: 취향 변화 ("이제 매운 거 별로")
- content는 1인칭 과거형·현재형으로 간결하게
- occurred_at 명시 없으면 "오늘"
- tags는 핵심 키워드만. 없으면 빈 배열`
}
