import type { InteractionEvent } from '@/types/interaction'
import type { Persona } from '@/types/persona'
import { ANALYSIS_CATEGORIES } from '@/lib/config/analysis'

export function buildAnalysisPrompt(
  events: InteractionEvent[],
  personas: Map<string, Persona>
): string {
  const personaSummaries = Array.from(personas.entries())
    .map(([id, p]) => `- ${p.name} (${id}): ${p.self_description ?? '자기소개 없음'}`)
    .join('\n')

  const dialogue = events
    .map((e) => {
      const name = personas.get(e.speaker_clone_id)?.name ?? 'Unknown'
      return `${name}: ${e.content}`
    })
    .join('\n')

  const categoryList = ANALYSIS_CATEGORIES.join(', ')

  return `다음은 두 인물의 대화입니다. 아래 참여자들의 페르소나와 대화 로그를 보고 호환성을 분석하세요.

참여자:
${personaSummaries || '(정보 없음)'}

대화 로그:
${dialogue || '(대화 없음)'}

분석 결과를 다음 JSON 스키마로만 출력하세요. 다른 설명 금지.

{
  "score": <0-100 정수>,
  "categories": {
    ${ANALYSIS_CATEGORIES.map((c) => `"${c}": { "score": <0-100>, "comment": "<한 줄>" }`).join(',\n    ')}
  },
  "summary": "<전체 요약 2-3 문장>",
  "recommended_next": "continue" | "pause" | "end"
}

카테고리: ${categoryList}

점수는 0-100 정수. 카테고리는 모두 채워야 합니다.`
}
