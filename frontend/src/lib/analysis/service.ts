// frontend/src/lib/analysis/service.ts
import { createServiceClient } from '@/lib/supabase/service'
import { callClaude, CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/claude'
import { buildAnalysisPrompt } from '@/lib/analysis/prompt'
import { parseAnalysisReport } from '@/lib/analysis/parse'
import { errors } from '@/lib/errors'
import type { Analysis, AnalysisReport } from '@/types/analysis'
import type { InteractionEvent } from '@/types/interaction'
import type { Persona } from '@/types/persona'

export interface GenerateOrFetchAnalysisInput {
  interactionId: string
  events: InteractionEvent[]
  personas: Map<string, Persona>
}

/**
 * Returns cached analysis if one already exists for the interaction.
 * Otherwise builds the prompt, calls Claude, parses + persists the report.
 */
export async function generateOrFetchAnalysis(
  input: GenerateOrFetchAnalysisInput
): Promise<Analysis> {
  const { interactionId, events, personas } = input
  const admin = createServiceClient()

  // Cache hit check
  const { data: existing, error: existingErr } = await admin
    .from('analyses')
    .select('*')
    .eq('interaction_id', interactionId)
    .maybeSingle()
  if (existingErr) {
    throw errors.internal()
  }
  if (existing) {
    return existing as unknown as Analysis
  }

  if (events.length === 0) {
    throw errors.validation('이벤트가 없는 상호작용은 분석할 수 없습니다')
  }

  const prompt = buildAnalysisPrompt(events, personas)

  const text = await callClaude({
    model: CLAUDE_MODELS.ANALYSIS,
    system: '당신은 두 사람의 대화 호환성을 분석하는 전문가입니다. 출력은 반드시 지정된 JSON 형식만 사용하세요.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_ANALYSIS,
    temperature: 0.4,
  })

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw errors.validation('분석 응답에서 JSON을 찾을 수 없습니다')
  }
  const jsonSlice = text.slice(firstBrace, lastBrace + 1)

  let parsedRaw: unknown
  try {
    parsedRaw = JSON.parse(jsonSlice)
  } catch {
    throw errors.validation('분석 응답 JSON 파싱 실패')
  }

  const report: AnalysisReport = parseAnalysisReport(parsedRaw)

  const { data: inserted, error: insertErr } = await admin
    .from('analyses')
    .insert({
      interaction_id: interactionId,
      score: report.score,
      report_json: report,
      model: CLAUDE_MODELS.ANALYSIS,
    })
    .select('*')
    .single()
  if (insertErr || !inserted) {
    throw errors.internal()
  }

  return inserted as unknown as Analysis
}
