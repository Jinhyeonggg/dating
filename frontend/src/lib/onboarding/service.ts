import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/config/claude'
import { buildTraitsInferencePrompt } from '@/lib/prompts/onboarding'
import { parseTraitsInference } from './extract'
import { createServiceClient } from '@/lib/supabase/service'
import { errors, AppError } from '@/lib/errors'
import type { OnboardingAnswer, InferredTraits } from '@/types/onboarding'

export async function inferAndStoreTraits(
  cloneId: string,
  answers: OnboardingAnswer[],
): Promise<InferredTraits> {
  const prompt = buildTraitsInferencePrompt(answers)

  const response = await callClaude({
    model: CLAUDE_MODELS.ONBOARDING,
    system: '당신은 사람의 성격 특성을 분석하는 심리학 도구입니다. JSON으로만 응답하세요.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_ONBOARDING,
    temperature: 0.3,
  })

  let parsed: unknown
  try {
    const jsonStart = response.indexOf('{')
    const jsonEnd = response.lastIndexOf('}')
    if (jsonStart < 0 || jsonEnd < 0) {
      throw new Error('JSON 객체를 찾을 수 없음')
    }
    parsed = JSON.parse(response.slice(jsonStart, jsonEnd + 1))
  } catch (err) {
    throw new AppError(
      'LLM_ERROR',
      `추론 응답 파싱 실패: ${(err as Error).message}`,
      502,
      { raw: response }
    )
  }

  const traits = parseTraitsInference(parsed)

  // raw_answers 보존
  const rawAnswers: Record<string, string> = {}
  for (const a of answers) {
    rawAnswers[a.questionId] = a.value
  }

  const inferredTraits: InferredTraits = {
    ...traits,
    raw_answers: rawAnswers,
  }

  const admin = createServiceClient()
  const { error } = await admin
    .from('clones')
    .update({ inferred_traits: inferredTraits })
    .eq('id', cloneId)

  if (error) throw errors.validation(error.message)

  return inferredTraits
}
