import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/config/claude'
import { buildMemoryExtractionPrompt } from '@/lib/prompts/memory'
import {
  parseMemoryExtraction,
  normalizeOccurredAt,
} from '@/lib/memory/extract'
import { createServiceClient } from '@/lib/supabase/service'
import { errors, AppError } from '@/lib/errors'
import type { CloneMemory } from '@/types/persona'

export async function extractAndStoreMemory(
  cloneId: string,
  rawText: string,
  now: Date = new Date()
): Promise<CloneMemory> {
  const prompt = buildMemoryExtractionPrompt(rawText, now)

  const response = await callClaude({
    model: CLAUDE_MODELS.EXTRACTION,
    system: '당신은 짧은 자연어 메모를 구조화 JSON으로 정리하는 도구입니다.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_EXTRACTION,
    temperature: 0.2,
  })

  let parsed: unknown
  try {
    const jsonStart = response.indexOf('{')
    const jsonEnd = response.lastIndexOf('}')
    if (jsonStart < 0 || jsonEnd < 0) {
      throw new Error('JSON 객체를 찾을 수 없음')
    }
    const jsonText = response.slice(jsonStart, jsonEnd + 1)
    parsed = JSON.parse(jsonText)
  } catch (err) {
    throw new AppError(
      'LLM_ERROR',
      `메모리 추출 응답 파싱 실패: ${(err as Error).message}`,
      502,
      { raw: response }
    )
  }

  const extracted = parseMemoryExtraction(parsed)
  const occurredAt = normalizeOccurredAt(extracted.occurred_at, now)

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('clone_memories')
    .insert({
      clone_id: cloneId,
      kind: extracted.kind,
      content: extracted.content,
      tags: extracted.tags,
      occurred_at: occurredAt,
    })
    .select()
    .single()

  if (error) throw errors.validation(error.message)
  return data as CloneMemory
}
