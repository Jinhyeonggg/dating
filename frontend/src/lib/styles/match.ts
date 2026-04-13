import type { StyleCard, StyleCardMatch } from './types'
import type { MoodState } from '@/lib/mood/types'
import type { Persona, CloneMemory } from '@/types/persona'
import type { SpeechRegister } from '@/types/relationship'

// ---------------------------------------------------------------------------
// Keyword maps for detectField
// ---------------------------------------------------------------------------

// Note: mixed is checked first so that text like "처음엔 격식, 친해지면 반말"
// (which contains both mixed and formal keywords) resolves to mixed.
const REGISTER_KEYWORDS: Record<string, string[]> = {
  mixed: ['상황에 따라', '처음엔', '친해지면', '혼용'],
  formal: ['존댓말', '예의', '공손', '격식', '정중', '~요'],
  casual: ['반말', '편하게', 'ㅋㅋ', '~해', '~야', '~임', '구어'],
}

const HUMOR_KEYWORDS: Record<string, string[]> = {
  dry: ['시니컬', '건조', '냉소', '드라이', '블랙'],
  playful: ['장난', '재미', '유쾌', '웃긴', '밝은', '개그'],
  warm: ['따뜻', '다정', '포근', '부드러운', '상냥'],
  none: ['진지', '무표정', '덤덤', '무뚝뚝'],
}

const ENERGY_KEYWORDS: Record<string, string[]> = {
  high: ['활발', '에너지', '열정', '적극', '밝은', '텐션', '외향'],
  mid: ['보통', '차분', '안정', '무난'],
  low: ['조용', '내성적', '말수가 적', '소극적', '피곤', '느긋'],
}

const FIELD_KEYWORD_MAPS = {
  register: REGISTER_KEYWORDS,
  humor: HUMOR_KEYWORDS,
  energy: ENERGY_KEYWORDS,
} as const

// ---------------------------------------------------------------------------
// Tier weights
// ---------------------------------------------------------------------------

const WEIGHT_TIER1 = 1.0 // Communication fields
const WEIGHT_TIER2 = 0.7 // Demographics
const WEIGHT_TIER3 = 0.5 // Personality
const WEIGHT_TIER4 = 0.3 // Topical

// ---------------------------------------------------------------------------
// detectField
// ---------------------------------------------------------------------------

/**
 * Detects a categorical field value from Korean text by keyword matching.
 * Returns the first category whose keyword list has any match, or null.
 */
export function detectField(
  text: string | null,
  field: 'register' | 'humor' | 'energy'
): string | null {
  if (text === null) return null
  const map = FIELD_KEYWORD_MAPS[field]
  for (const [category, keywords] of Object.entries(map)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return category
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if mbti matches the pattern where '*' is a wildcard character.
 */
function matchesMbtiPattern(mbti: string, pattern: string): boolean {
  if (pattern.length !== mbti.length) return false
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '*' && pattern[i] !== mbti[i]) return false
  }
  return true
}

/**
 * Counts overlapping items between two arrays (case-insensitive string compare).
 */
function countOverlap(a: string[], b: string[]): number {
  const setB = new Set(b.map((s) => s.toLowerCase()))
  return a.filter((s) => setB.has(s.toLowerCase())).length
}

/**
 * Maps a numeric mood energy to the corresponding energy tier.
 */
function moodEnergyTier(energy: number): 'high' | 'mid' | 'low' {
  if (energy >= 0.7) return 'high'
  if (energy >= 0.3) return 'mid'
  return 'low'
}

// ---------------------------------------------------------------------------
// computeCardScore
// ---------------------------------------------------------------------------

/**
 * Computes a weighted compatibility score between a StyleCard and a Persona.
 *
 * Tier 1 (weight 1.0): Communication — register, humor, energy
 * Tier 2 (weight 0.7): Demographics — age_range, gender
 * Tier 3 (weight 0.5): Personality  — mbti_like, personality/values tags
 * Tier 4 (weight 0.3): Topical       — hobbies/tags overlap
 *
 * Null persona fields contribute 0 (not negative).
 * Mood energy match adds +0.2 boost.
 */
export function computeCardScore(
  card: StyleCard,
  persona: Persona,
  _memories: CloneMemory[],
  mood?: MoodState
): number {
  const m: StyleCardMatch = card.match
  let score = 0

  // ---- Tier 1: Communication (weight 1.0) ---------------------------------

  // register: check texting_style first, then communication_style
  if (m.register !== undefined) {
    const fromTexting = detectField(persona.texting_style, 'register')
    const fromComm = detectField(persona.communication_style, 'register')
    const detected = fromTexting ?? fromComm
    if (detected !== null) {
      score += detected === m.register ? WEIGHT_TIER1 : 0
    }
  }

  // humor: check humor_style
  if (m.humor !== undefined) {
    const detected = detectField(persona.humor_style, 'humor')
    if (detected !== null) {
      score += detected === m.humor ? WEIGHT_TIER1 : 0
    }
  }

  // energy: check emotional_expression
  if (m.energy !== undefined) {
    const detected = detectField(persona.emotional_expression, 'energy')
    if (detected !== null) {
      score += detected === m.energy ? WEIGHT_TIER1 : 0
    }
  }

  // ---- Tier 2: Demographics (weight 0.7) ----------------------------------

  // age_range
  if (m.age_range !== undefined && persona.age !== null) {
    const [lo, hi] = m.age_range
    if (persona.age >= lo && persona.age <= hi) {
      score += WEIGHT_TIER2
    }
  }

  // gender
  if (m.gender !== undefined && persona.gender !== null) {
    const genderList = m.gender as string[]
    if (genderList.includes(persona.gender)) {
      score += WEIGHT_TIER2
    }
  }

  // ---- Tier 3: Personality (weight 0.5) -----------------------------------

  // mbti_like: pattern matching
  if (m.mbti_like !== undefined && persona.mbti !== null) {
    const matched = m.mbti_like.some((pattern) =>
      matchesMbtiPattern(persona.mbti as string, pattern)
    )
    if (matched) score += WEIGHT_TIER3
  }

  // personality_traits + core_values overlap with card tags
  if (m.tags !== undefined) {
    const cardTags = m.tags
    const personalityItems: string[] = [
      ...(persona.personality_traits ?? []),
      ...(persona.core_values ?? []),
    ]
    if (personalityItems.length > 0) {
      const overlap = countOverlap(cardTags, personalityItems)
      if (overlap > 0) {
        const ratio = overlap / cardTags.length
        score += WEIGHT_TIER3 * ratio
      }
    }
  }

  // ---- Tier 4: Topical (weight 0.3) ---------------------------------------

  // hobbies + persona tags overlap with card tags
  if (m.tags !== undefined) {
    const cardTags = m.tags
    const topicalItems: string[] = [
      ...(persona.hobbies ?? []),
      ...(persona.tags ?? []),
    ]
    if (topicalItems.length > 0) {
      const overlap = countOverlap(cardTags, topicalItems)
      if (overlap > 0) {
        const ratio = overlap / cardTags.length
        score += WEIGHT_TIER4 * ratio
      }
    }
  }

  // ---- Mood modifier (+0.2) -----------------------------------------------

  if (mood !== undefined && m.energy !== undefined) {
    const moodTier = moodEnergyTier(mood.energy)
    if (moodTier === m.energy) {
      score += 0.2
    }
  }

  return score
}

// ---------------------------------------------------------------------------
// pickStyleCards
// ---------------------------------------------------------------------------

/**
 * Selects the top-K most compatible StyleCards for a persona.
 *
 * - Empty cards → return []
 * - Single card → return it regardless of score
 * - topK defaults to 3
 */
export function pickStyleCards(
  cards: StyleCard[],
  persona: Persona,
  memories: CloneMemory[],
  mood?: MoodState,
  options?: { topK?: number; speechRegister?: SpeechRegister | null }
): StyleCard[] {
  if (cards.length === 0) return []

  const topK = options?.topK ?? 3
  const sr = options?.speechRegister

  // speech_register로 카드 사전 필터링
  let filtered = cards
  if (sr) {
    const registerFilter = sr === 'casual' ? 'casual' : 'formal'
    filtered = cards.filter((c) => {
      const cardRegister = c.match.register
      if (!cardRegister) return true
      if (sr === 'banmal-ready' && cardRegister === 'mixed') return true
      return cardRegister === registerFilter
    })
    if (filtered.length === 0) filtered = cards
  }

  if (filtered.length === 1) return [filtered[0]]

  const scored = filtered
    .map((card) => ({ card, score: computeCardScore(card, persona, memories, mood) }))
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topK).map((s) => s.card)
}
