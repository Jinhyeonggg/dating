import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS } from '@/lib/config/claude'
import { renderPersonaCore, renderRecentMemories } from '@/lib/prompts/persona'
import { buildMoodRollPrompt } from '@/lib/prompts/mood'
import { parseMoodResponse } from './parse'
import { fallbackMoodRoll } from './fallback'
import type { MoodState } from './types'
import type { Persona, CloneMemory } from '@/types/persona'
import type { WorldSnippet } from '@/lib/world/types'

export async function rollMood(
  persona: Persona,
  memories: CloneMemory[],
  world: WorldSnippet | null,
  seed: string,
): Promise<MoodState> {
  try {
    const personaCore = renderPersonaCore(persona)
    const memoriesText = renderRecentMemories(memories)
    const worldText = world?.promptText ?? ''

    const prompt = buildMoodRollPrompt(personaCore, memoriesText, worldText)

    const response = await callClaude({
      model: CLAUDE_MODELS.EXTRACTION,
      system: '감정 시뮬레이터. JSON만 출력.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 256,
      temperature: 0,
    })

    const parsed = parseMoodResponse(response)
    if (parsed) return parsed

    console.warn('[mood] Haiku 파싱 실패, fallback 사용:', response.slice(0, 100))
    return fallbackMoodRoll(persona, memories, seed)
  } catch (err) {
    console.error('[mood] Haiku 호출 실패, fallback 사용:', err)
    return fallbackMoodRoll(persona, memories, seed)
  }
}
