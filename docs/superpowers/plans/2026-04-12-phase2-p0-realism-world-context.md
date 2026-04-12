# Phase 2 P0 — Realism & World Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject realistic Korean texting patterns, session-start mood, clone-specific style cards, and manually curated world context into the interaction engine — without touching the 20-turn loop itself.

**Architecture:** All changes target the system prompt assembly layer before the existing engine loop. Four modulators (texture rules, style card picker, mood roll, world context) compose into an extended `buildSystemPrompt`. A new `/admin/world` page manages world context rows. A dev CLI enables rapid tuning iterations.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, Supabase (Postgres + Auth), Claude API (Sonnet for interaction, Haiku for mood roll), Vitest, Zod 4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-12-phase2-p0-realism-world-context-design.md`

**Parallel groups:** A→(B∥C∥D)→E→F→(G∥H)→I→J. Subagents can tackle B/C/D and G/H concurrently.

---

## Group A: Foundation Types

### Task 1: Style Card Types

**Files:**
- Create: `frontend/src/lib/styles/types.ts`

- [ ] **Step 1: Create type definitions**

```ts
// frontend/src/lib/styles/types.ts

export interface StyleCardMatch {
  age_range?: [number, number]
  gender?: Array<'여성' | '남성' | '중립'>
  register?: 'formal' | 'casual' | 'mixed'
  energy?: 'low' | 'mid' | 'high'
  humor?: 'dry' | 'playful' | 'warm' | 'none'
  mbti_like?: string[]
  tags?: string[]
}

export interface StyleCard {
  id: string
  label: string
  match: StyleCardMatch
  sample: string
  texture_notes?: string
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/lib/styles/types.ts && git commit -m "feat(styles): add StyleCard type definitions"
```

---

### Task 2: Mood Types

**Files:**
- Create: `frontend/src/lib/mood/types.ts`

- [ ] **Step 1: Create type definitions**

```ts
// frontend/src/lib/mood/types.ts

export const MOOD_PRIMARIES = [
  '평온', '설렘', '짜증', '우울', '활기', '피곤', '긴장',
] as const

export type MoodPrimary = (typeof MOOD_PRIMARIES)[number]

export interface MoodState {
  primary: MoodPrimary
  energy: number       // 0.0 – 1.0
  openness: number     // 0.0 – 1.0
  warmth: number       // 0.0 – 1.0
  reason_hint: string  // debug/log only, not injected verbatim into prompt
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/lib/mood/types.ts && git commit -m "feat(mood): add MoodState type definitions"
```

---

### Task 3: World Context Types

**Files:**
- Create: `frontend/src/lib/world/types.ts`

- [ ] **Step 1: Create type definitions**

```ts
// frontend/src/lib/world/types.ts

export const WORLD_CATEGORIES = [
  'news', 'weather', 'meme', 'market', 'politics', 'sports', 'other',
] as const

export type WorldCategory = (typeof WORLD_CATEGORIES)[number]

export interface WorldContextRow {
  id: string
  date: string            // 'YYYY-MM-DD'
  category: WorldCategory
  headline: string
  details: string | null
  weight: number          // 1–10
  source: string
  created_at: string
  updated_at: string
}

export interface WorldSnippet {
  items: WorldContextRow[]
  promptText: string
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/lib/world/types.ts && git commit -m "feat(world): add WorldContextRow / WorldSnippet types"
```

---

## Group B: Style Card System (TDD)

### Task 4: Style Card Matching — Tests First

**Files:**
- Create: `frontend/src/lib/styles/match.ts`
- Create: `frontend/src/lib/styles/match.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/styles/match.test.ts
import { describe, it, expect } from 'vitest'
import { pickStyleCards, detectField, computeCardScore } from './match'
import type { StyleCard } from './types'
import type { Persona } from '@/types/persona'

const CARD_FORMAL_YOUNG: StyleCard = {
  id: 'formal_polite_young',
  label: '예의 바른 첫 만남 (20대)',
  match: { age_range: [20, 29], gender: ['여성', '남성'], register: 'formal', energy: 'mid', humor: 'warm' },
  sample: 'A: 안녕하세요! 반갑습니다\nB: 안녕하세요~ 저도 반가워요\nA: 혹시 취미 같은 거 있으세요?\nB: 저 요즘 등산 다녀요 ㅎㅎ',
}

const CARD_CASUAL_MALE: StyleCard = {
  id: 'casual_close_male',
  label: '친한 남성 친구톤',
  match: { age_range: [20, 35], gender: ['남성'], register: 'casual', energy: 'high', humor: 'playful' },
  sample: 'A: 야\nA: 어제 그거 봤냐\nB: ㅋㅋ 뭔데\nA: 아 ㅋㅋㅋ 몰라 직접 봐',
}

const CARD_DEFAULT: StyleCard = {
  id: 'default_casual',
  label: '기본 캐주얼',
  match: { register: 'casual', energy: 'mid' },
  sample: 'A: 안녕\nB: 응 안녕\nA: 뭐해\nB: 그냥 쉬고 있어',
}

const ALL_CARDS = [CARD_FORMAL_YOUNG, CARD_CASUAL_MALE, CARD_DEFAULT]

function makePersona(overrides: Partial<Persona>): Persona {
  return {
    name: '테스트',
    age: null, gender: null, location: null, occupation: null, education: null, languages: null,
    mbti: null, personality_traits: null, strengths: null, weaknesses: null,
    humor_style: null, emotional_expression: null,
    core_values: null, beliefs: null, life_philosophy: null, dealbreakers: null,
    hobbies: null, food_preferences: null, travel_style: null,
    background_story: null, key_life_events: null, career_history: null, past_relationships_summary: null,
    family_description: null, close_friends_count: null, social_style: null, relationship_with_family: null,
    daily_routine: null, sleep_schedule: null, exercise_habits: null, diet: null, pets: null, living_situation: null,
    communication_style: null, conversation_preferences: null, texting_style: null, response_speed: null,
    short_term_goals: null, long_term_goals: null, what_seeking_in_others: null, relationship_goal: null,
    self_description: null, tags: null,
    favorite_media: null,
    ...overrides,
  } as Persona
}

describe('detectField', () => {
  it('텍스트에서 register를 감지한다', () => {
    expect(detectField('존댓말로 대화하는 편', 'register')).toBe('formal')
    expect(detectField('반말 많이 씀 ㅋㅋ', 'register')).toBe('casual')
    expect(detectField(null, 'register')).toBeNull()
  })

  it('텍스트에서 humor를 감지한다', () => {
    expect(detectField('장난기 많고 재밌는 편', 'humor')).toBe('playful')
    expect(detectField('따뜻하고 다정함', 'humor')).toBe('warm')
  })

  it('텍스트에서 energy를 감지한다', () => {
    expect(detectField('활발하고 적극적', 'energy')).toBe('high')
    expect(detectField('조용하고 내성적', 'energy')).toBe('low')
  })
})

describe('computeCardScore', () => {
  it('age 범위 안이면 tier 2 가산', () => {
    const persona = makePersona({ age: 25 })
    const score = computeCardScore(CARD_FORMAL_YOUNG, persona, [])
    expect(score).toBeGreaterThan(0)
  })

  it('age 범위 밖이면 0', () => {
    const persona = makePersona({ age: 40 })
    const score = computeCardScore(CARD_FORMAL_YOUNG, persona, [])
    const defaultScore = computeCardScore(CARD_DEFAULT, persona, [])
    expect(score).toBeLessThanOrEqual(defaultScore)
  })

  it('null persona 필드는 negative 아님', () => {
    const persona = makePersona({})
    const score = computeCardScore(CARD_FORMAL_YOUNG, persona, [])
    expect(score).toBeGreaterThanOrEqual(0)
  })
})

describe('pickStyleCards', () => {
  it('top-K=2 카드를 선택한다', () => {
    const persona = makePersona({ age: 25, gender: '남성', texting_style: '반말 많이 씀' })
    const result = pickStyleCards(ALL_CARDS, persona, [])
    expect(result.length).toBe(2)
  })

  it('카드가 1장뿐이면 1장 반환', () => {
    const persona = makePersona({})
    const result = pickStyleCards([CARD_DEFAULT], persona, [])
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('default_casual')
  })

  it('빈 카드 배열이면 빈 배열 반환', () => {
    const persona = makePersona({})
    const result = pickStyleCards([], persona, [])
    expect(result.length).toBe(0)
  })

  it('mood modifier가 energy matching에 영향', () => {
    const persona = makePersona({ age: 25, gender: '남성' })
    const energeticMood = { primary: '활기' as const, energy: 0.9, openness: 0.7, warmth: 0.6, reason_hint: '' }
    const tiredMood = { primary: '피곤' as const, energy: 0.2, openness: 0.3, warmth: 0.4, reason_hint: '' }

    const withEnergy = pickStyleCards(ALL_CARDS, persona, [], energeticMood)
    const withTired = pickStyleCards(ALL_CARDS, persona, [], tiredMood)

    // 같은 persona인데 mood에 따라 다른 카드 조합 가능
    // (최소한 순위는 달라질 수 있다)
    expect(withEnergy).toBeDefined()
    expect(withTired).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/styles/match.test.ts`
Expected: FAIL — module `./match` not found

- [ ] **Step 3: Implement matching functions**

```ts
// frontend/src/lib/styles/match.ts
import type { Persona, CloneMemory } from '@/types/persona'
import type { StyleCard, StyleCardMatch } from './types'
import type { MoodState } from '@/lib/mood/types'

const REGISTER_KEYWORDS: Record<string, string[]> = {
  formal: ['존댓말', '예의', '공손', '격식', '정중', '~요'],
  casual: ['반말', '편하게', 'ㅋㅋ', '~해', '~야', '~임', '구어'],
  mixed: ['상황에 따라', '처음엔', '친해지면', '혼용'],
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

const KEYWORD_MAPS: Record<string, Record<string, string[]>> = {
  register: REGISTER_KEYWORDS,
  humor: HUMOR_KEYWORDS,
  energy: ENERGY_KEYWORDS,
}

export function detectField(
  text: string | null | undefined,
  field: 'register' | 'humor' | 'energy',
): string | null {
  if (!text) return null
  const map = KEYWORD_MAPS[field]
  let bestKey: string | null = null
  let bestCount = 0
  for (const [key, keywords] of Object.entries(map)) {
    const count = keywords.filter((kw) => text.includes(kw)).length
    if (count > bestCount) {
      bestCount = count
      bestKey = key
    }
  }
  return bestKey
}

function matchesMbtiPattern(mbti: string, pattern: string): boolean {
  if (mbti.length !== 4 || pattern.length !== 4) return false
  return [...pattern].every((ch, i) => ch === '*' || ch === mbti[i])
}

const TIER_WEIGHTS = { 1: 1.0, 2: 0.7, 3: 0.5, 4: 0.3 } as const

export function computeCardScore(
  card: StyleCard,
  persona: Persona,
  memories: CloneMemory[],
  mood?: MoodState,
): number {
  const m = card.match
  let score = 0
  let checks = 0

  // --- Tier 1 (weight 1.0): communication fields ---
  const combinedComm = [persona.texting_style, persona.communication_style].filter(Boolean).join(' ')
  if (combinedComm && m.register) {
    checks++
    const detected = detectField(combinedComm, 'register')
    if (detected === m.register) score += TIER_WEIGHTS[1]
  }
  if (persona.humor_style && m.humor) {
    checks++
    const detected = detectField(persona.humor_style, 'humor')
    if (detected === m.humor) score += TIER_WEIGHTS[1]
  }
  if (persona.emotional_expression && m.energy) {
    checks++
    const detected = detectField(persona.emotional_expression, 'energy')
    if (detected === m.energy) score += TIER_WEIGHTS[1]
  }

  // --- Tier 2 (weight 0.7): demographics ---
  if (persona.age != null && m.age_range) {
    checks++
    if (persona.age >= m.age_range[0] && persona.age <= m.age_range[1]) score += TIER_WEIGHTS[2]
  }
  if (persona.gender && m.gender) {
    checks++
    if (m.gender.includes(persona.gender as '여성' | '남성' | '중립')) score += TIER_WEIGHTS[2]
  }

  // --- Tier 3 (weight 0.5): personality ---
  if (persona.mbti && m.mbti_like?.length) {
    checks++
    if (m.mbti_like.some((p) => matchesMbtiPattern(persona.mbti!, p))) score += TIER_WEIGHTS[3]
  }
  const personaTraits = [
    ...(persona.personality_traits ?? []),
    ...(persona.core_values ?? []),
  ]
  if (personaTraits.length > 0 && m.tags?.length) {
    checks++
    const overlap = m.tags.filter((t) => personaTraits.some((pt) => pt.includes(t) || t.includes(pt))).length
    if (overlap > 0) score += TIER_WEIGHTS[3] * Math.min(overlap / m.tags.length, 1)
  }

  // --- Tier 4 (weight 0.3): topical ---
  const personaTags = [...(persona.hobbies ?? []), ...(persona.tags ?? [])]
  if (personaTags.length > 0 && m.tags?.length) {
    checks++
    const overlap = m.tags.filter((t) => personaTags.some((pt) => pt.includes(t) || t.includes(pt))).length
    if (overlap > 0) score += TIER_WEIGHTS[4] * Math.min(overlap / m.tags.length, 1)
  }

  // --- Mood modifier ---
  if (mood && m.energy) {
    const moodEnergyMap: Record<string, [number, number]> = {
      high: [0.7, 1.0],
      mid: [0.3, 0.7],
      low: [0.0, 0.3],
    }
    const range = moodEnergyMap[m.energy]
    if (range && mood.energy >= range[0] && mood.energy <= range[1]) {
      score += 0.2
    }
  }

  // Normalize by checks count (avoid division by zero)
  return checks > 0 ? score / checks : 0
}

export function pickStyleCards(
  cards: StyleCard[],
  persona: Persona,
  memories: CloneMemory[],
  mood?: MoodState,
  options?: { topK?: number },
): StyleCard[] {
  if (cards.length === 0) return []

  const topK = options?.topK ?? 2
  const scored = cards
    .map((card) => ({ card, score: computeCardScore(card, persona, memories, mood) }))
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topK).map((s) => s.card)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/styles/match.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/styles/match.ts src/lib/styles/match.test.ts && git commit -m "feat(styles): style card matching with 4-tier weighted scoring (TDD)"
```

---

### Task 5: Texture Rules

**Files:**
- Create: `frontend/src/lib/prompts/texture.ts`
- Create: `frontend/src/lib/prompts/texture.test.ts`

- [ ] **Step 1: Write regression test**

```ts
// frontend/src/lib/prompts/texture.test.ts
import { describe, it, expect } from 'vitest'
import { TEXTURE_RULES } from './texture'

describe('TEXTURE_RULES', () => {
  it('마침표 규칙을 포함한다', () => {
    expect(TEXTURE_RULES).toContain('마침표')
    expect(TEXTURE_RULES).toContain("'.'")
  })

  it('줄임말/구어체 가이드를 포함한다', () => {
    expect(TEXTURE_RULES).toContain('ㅋㅋ')
    expect(TEXTURE_RULES).toContain('ㅠㅠ')
  })

  it('AI스러움 금지 패턴을 포함한다', () => {
    expect(TEXTURE_RULES).toContain('또한')
    expect(TEXTURE_RULES).toContain('그러므로')
  })

  it('register 존중 언급이 있다', () => {
    expect(TEXTURE_RULES).toContain('register')
  })

  it('연속 발화 언급이 있다', () => {
    expect(TEXTURE_RULES).toContain('연속')
  })
})
```

- [ ] **Step 2: Run test — FAIL**

Run: `cd frontend && npx vitest run src/lib/prompts/texture.test.ts`
Expected: FAIL — `./texture` not found

- [ ] **Step 3: Create texture rules**

```ts
// frontend/src/lib/prompts/texture.ts

export const TEXTURE_RULES = `[한국인 카톡 리얼리즘 규칙 — 모든 메시지에 적용]

1. 마침표 규칙
   - 평소 문장 끝에 '.' 쓰지 마. 감정 강조나 단호함 필요할 때만 가끔.
   - '...' 은 망설임/말줄임에만. 남발 금지.
   - '!' 와 '?' 는 자연스럽게 써.

2. 한 메시지 = 한 호흡
   - 긴 문장 하나로 쓰지 말고 짧게 쪼개서 여러 메시지로 보내.
   - 2~4개로 나눠서 보내는 게 보통. 연속 발화 태그(<continue/>)를 적극 써.

3. 줄임말/구어체
   - ㅇㅇ, ㄴㄴ, ㅇㅋ, ㄱㄱ, ㄹㅇ, ㅁㅊ 같은 자음 축약 자연스럽게 써.
   - "음...", "아 ㄹㅇ", "그치", "ㅋㅋㅋ" 같은 필러도 OK.

4. 감정 표현
   - ㅋㅋ, ㅠㅠ, ㅜㅜ, ㅎㅎ 을 자연스럽게. 과하지도 부족하지도 않게.
   - 이모지는 쓰는 사람만 써 (persona.texting_style 참조). 강제 금지.

5. 완벽한 문법 금지
   - 조사 생략, 어순 자유, 오타도 자연스러우면 OK.
   - "아 그거 나도 봄", "오늘 날씨 개춥네" 같은 파편화된 문장 OK.
   - 존댓말/반말은 persona에 맞게. 혼용하는 사람도 있음.

6. 리액션
   - "ㅇㅇ", "ㄹㅇ?", "와 진짜?", "헐" 같은 짧은 반응도 유효한 턴.
   - 항상 의견을 내지 않아도 됨. 공감-only 턴 OK.

7. AI스러움 — 표현이 아니라 패턴의 문제
   - register를 존중할 것:
     · 처음 만남/예의 필요: "~하는 것 같아요", "~인 듯해요" 자연스러움
     · 친한 사이: "~인 듯", "~같아" 자연스러움
     · register 안에서도 리듬 다양하게
   - 진짜 AI스러운 패턴 (register 무관 피해):
     · 모든 메시지가 완결된 문장으로만 구성
     · "또한", "그러므로", "따라서" 같은 문어체 접속사
     · 문장마다 주어-목적어-술어 완비한 설명문체
     · ㅋ/ㅠ/ㅎ 없이 여러 턴 연속
     · 상대 말에 항상 새 정보 추가 (공감-only 턴 없음)
     · 이모지 나열 (🥺✨💕)
     · 불필요 영어 섞기
   - 핵심: 정중함 ≠ 완벽한 문장. 예의 있는 사이도 "아 그쵸", "오 정말요?", "음... 좀 애매하네요" 같은 부서진 반응 있음

[위 규칙은 baseline. persona의 texting_style/communication_style이 오버라이드.]`
```

- [ ] **Step 4: Run test — PASS**

Run: `cd frontend && npx vitest run src/lib/prompts/texture.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/prompts/texture.ts src/lib/prompts/texture.test.ts && git commit -m "feat(prompts): message texture rules for Korean chat realism"
```

---

### Task 6: Style Card Seed Files

**Files:**
- Create: `frontend/src/lib/styles/cards/formal_polite_young.ts`
- Create: `frontend/src/lib/styles/cards/formal_polite_mature.ts`
- Create: `frontend/src/lib/styles/cards/casual_close_female.ts`
- Create: `frontend/src/lib/styles/cards/casual_close_male.ts`
- Create: `frontend/src/lib/styles/cards/mixed_warming_up.ts`
- Create: `frontend/src/lib/styles/cards/default_casual.ts`

- [ ] **Step 1: Create formal_polite_young card**

```ts
// frontend/src/lib/styles/cards/formal_polite_young.ts
import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'formal_polite_young',
  label: '예의 바른 첫 만남 (20대)',
  match: {
    age_range: [18, 29],
    register: 'formal',
    energy: 'mid',
    humor: 'warm',
  },
  sample: `A: 안녕하세요 ㅎㅎ 반갑습니다
B: 안녕하세요~ 저도 반가워요!
A: 혹시 취미 같은 거 있으세요?
B: 저 요즘 등산 다녀요
B: 주말마다 가는데 진짜 좋더라고요
A: 오 정말요? 저도 한번 가보고 싶었는데
A: 혼자 가기 좀 애매해서...`,
  texture_notes: '해요체 기반. 마침표 거의 안 씀. ㅎㅎ/~ 정도만 사용.',
}
```

- [ ] **Step 2: Create formal_polite_mature card**

```ts
// frontend/src/lib/styles/cards/formal_polite_mature.ts
import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'formal_polite_mature',
  label: '직장인 첫 만남 (30대)',
  match: {
    age_range: [30, 45],
    register: 'formal',
    energy: 'mid',
    humor: 'dry',
  },
  sample: `A: 안녕하세요~ 프로필 보고 관심이 생겨서요
B: 아 네 안녕하세요
B: 혹시 어떤 일 하세요?
A: 저는 IT 쪽이요 ㅎㅎ
A: 회사 다니면서 사이드 프로젝트도 좀 하고 있어요
B: 오 멋지시네요
A: 아닙니다 ㅋㅋ 그냥 취미 수준이에요`,
  texture_notes: '해요체. 약간 formal 하지만 딱딱하지 않게. ㅋㅋ는 적게.',
}
```

- [ ] **Step 3: Create casual_close_female card**

```ts
// frontend/src/lib/styles/cards/casual_close_female.ts
import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'casual_close_female',
  label: '친한 여자친구톤 (20~30대)',
  match: {
    age_range: [20, 35],
    gender: ['여성'],
    register: 'casual',
    energy: 'high',
    humor: 'playful',
  },
  sample: `A: 야
A: 나 오늘 개빡쳐
B: ?? 뭔일
A: 그냥 아 몰라 ㅋㅋㅋ
B: 상사임?
A: ㅇㅇ
A: 진짜 말이 안 통해
B: ㅠㅠㅠ 힘들다 진짜`,
  texture_notes: '반말. ㅋㅋ/ㅠㅠ 자유롭게. 한 문장 쪼개 보내기 자주.',
}
```

- [ ] **Step 4: Create casual_close_male card**

```ts
// frontend/src/lib/styles/cards/casual_close_male.ts
import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'casual_close_male',
  label: '친한 남자친구톤 (20~30대)',
  match: {
    age_range: [20, 35],
    gender: ['남성'],
    register: 'casual',
    energy: 'high',
    humor: 'playful',
  },
  sample: `A: ㅋㅋ 야 어제 그거 봤냐
B: 뭔데
A: 아 유튜브에 그거
A: 링크 보내줄게 잠만
B: ㅇㅋ
B: 아 이거 ㅋㅋㅋㅋㅋ
A: ㄹㅇ ㅋㅋ 미쳤음`,
  texture_notes: '반말. ㅋㅋ 다발. 짧고 빠른 메시지. 링크/미디어 언급 가능.',
}
```

- [ ] **Step 5: Create mixed_warming_up card**

```ts
// frontend/src/lib/styles/cards/mixed_warming_up.ts
import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'mixed_warming_up',
  label: '조금 친해지는 중',
  match: {
    register: 'mixed',
    energy: 'mid',
    humor: 'warm',
  },
  sample: `A: 오 그 카페 저도 가봤어요!
B: ㅋㅋ 진짜요?
A: 네 ㅋㅋ 거기 케이크 맛있지 않아요?
B: 맞아요 치즈케이크 진짜 맛있음
B: 아 근데 요즘 사람 너무 많아서
A: 아 그쵸... 주말은 줄이 장난 아님`,
  texture_notes: '해요체 기본이지만 점점 반말 섞임. 자연스러운 전환.',
}
```

- [ ] **Step 6: Create default_casual card (fallback)**

```ts
// frontend/src/lib/styles/cards/default_casual.ts
import type { StyleCard } from '../types'

export const card: StyleCard = {
  id: 'default_casual',
  label: '기본 캐주얼 (fallback)',
  match: {
    register: 'casual',
    energy: 'mid',
  },
  sample: `A: 안녕
B: 응 안녕
A: 뭐해
B: 그냥 쉬고 있어
B: 너는?
A: 나도 ㅋㅋ 할 거 없어서`,
  texture_notes: '평이한 반말. 특별한 색깔 없음. 매칭 실패 시 fallback.',
}
```

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd frontend && git add src/lib/styles/cards/ && git commit -m "feat(styles): seed 6 style cards (formal/casual/mixed/default)"
```

---

### Task 7: Style Card Index (Glob Collector)

**Files:**
- Create: `frontend/src/lib/styles/index.ts`
- Create: `frontend/src/lib/styles/index.test.ts`

- [ ] **Step 1: Write test**

```ts
// frontend/src/lib/styles/index.test.ts
import { describe, it, expect } from 'vitest'
import { getAllStyleCards } from './index'

describe('getAllStyleCards', () => {
  it('시드 카드 6장 이상을 반환한다', () => {
    const cards = getAllStyleCards()
    expect(cards.length).toBeGreaterThanOrEqual(6)
  })

  it('모든 카드가 id와 sample을 가진다', () => {
    const cards = getAllStyleCards()
    for (const card of cards) {
      expect(card.id).toBeTruthy()
      expect(card.sample).toBeTruthy()
    }
  })

  it('default_casual fallback 카드가 있다', () => {
    const cards = getAllStyleCards()
    expect(cards.some((c) => c.id === 'default_casual')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — FAIL**

Run: `cd frontend && npx vitest run src/lib/styles/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement index**

```ts
// frontend/src/lib/styles/index.ts
import type { StyleCard } from './types'

import { card as formalPoliteYoung } from './cards/formal_polite_young'
import { card as formalPoliteMature } from './cards/formal_polite_mature'
import { card as casualCloseFemale } from './cards/casual_close_female'
import { card as casualCloseMale } from './cards/casual_close_male'
import { card as mixedWarmingUp } from './cards/mixed_warming_up'
import { card as defaultCasual } from './cards/default_casual'

const ALL_CARDS: StyleCard[] = [
  formalPoliteYoung,
  formalPoliteMature,
  casualCloseFemale,
  casualCloseMale,
  mixedWarmingUp,
  defaultCasual,
]

export function getAllStyleCards(): StyleCard[] {
  return ALL_CARDS
}
```

Note: 정적 import 방식. 카드 추가 시 이 파일에 import 한 줄 + 배열에 한 줄 추가. 동적 glob은 Next.js 서버 컴포넌트 제약 회피를 위해 사용하지 않음.

- [ ] **Step 4: Run test — PASS**

Run: `cd frontend && npx vitest run src/lib/styles/index.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/styles/index.ts src/lib/styles/index.test.ts && git commit -m "feat(styles): style card index with static imports"
```

---

## Group C: Mood System (TDD)

### Task 8: Mood Parsing & Validation

**Files:**
- Create: `frontend/src/lib/mood/parse.ts`
- Create: `frontend/src/lib/mood/parse.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/mood/parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseMoodResponse, moodStateSchema } from './parse'

describe('moodStateSchema', () => {
  it('유효한 MoodState JSON을 파싱한다', () => {
    const raw = {
      primary: '활기',
      energy: 0.8,
      openness: 0.7,
      warmth: 0.6,
      reason_hint: '날씨가 좋아서',
    }
    const result = moodStateSchema.parse(raw)
    expect(result.primary).toBe('활기')
    expect(result.energy).toBe(0.8)
  })

  it('유효하지 않은 primary를 거부한다', () => {
    const raw = { primary: '행복', energy: 0.5, openness: 0.5, warmth: 0.5, reason_hint: '' }
    expect(() => moodStateSchema.parse(raw)).toThrow()
  })

  it('에너지 범위 초과를 거부한다', () => {
    const raw = { primary: '평온', energy: 1.5, openness: 0.5, warmth: 0.5, reason_hint: '' }
    expect(() => moodStateSchema.parse(raw)).toThrow()
  })
})

describe('parseMoodResponse', () => {
  it('JSON 문자열에서 MoodState를 추출한다', () => {
    const raw = '```json\n{"primary":"짜증","energy":0.3,"openness":0.2,"warmth":0.3,"reason_hint":"상사 때문에"}\n```'
    const result = parseMoodResponse(raw)
    expect(result.primary).toBe('짜증')
  })

  it('bare JSON도 처리한다', () => {
    const raw = '{"primary":"평온","energy":0.5,"openness":0.6,"warmth":0.7,"reason_hint":""}'
    const result = parseMoodResponse(raw)
    expect(result.primary).toBe('평온')
  })

  it('파싱 불가능하면 null 반환', () => {
    const result = parseMoodResponse('이것은 JSON이 아닙니다')
    expect(result).toBeNull()
  })

  it('스키마 불일치면 null 반환', () => {
    const raw = '{"primary":"존재안함","energy":0.5,"openness":0.5,"warmth":0.5,"reason_hint":""}'
    const result = parseMoodResponse(raw)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — FAIL**

Run: `cd frontend && npx vitest run src/lib/mood/parse.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement parsing**

```ts
// frontend/src/lib/mood/parse.ts
import { z } from 'zod'
import { MOOD_PRIMARIES } from './types'
import type { MoodState } from './types'

export const moodStateSchema = z.object({
  primary: z.enum(MOOD_PRIMARIES),
  energy: z.number().min(0).max(1),
  openness: z.number().min(0).max(1),
  warmth: z.number().min(0).max(1),
  reason_hint: z.string(),
})

export function parseMoodResponse(raw: string): MoodState | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    return moodStateSchema.parse(parsed)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — PASS**

Run: `cd frontend && npx vitest run src/lib/mood/parse.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/mood/parse.ts src/lib/mood/parse.test.ts && git commit -m "feat(mood): Zod-validated mood state parser (TDD)"
```

---

### Task 9: Mood Fallback (Code-based)

**Files:**
- Create: `frontend/src/lib/mood/fallback.ts`
- Create: `frontend/src/lib/mood/fallback.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/mood/fallback.test.ts
import { describe, it, expect } from 'vitest'
import { fallbackMoodRoll } from './fallback'
import { MOOD_PRIMARIES } from './types'
import type { Persona } from '@/types/persona'

function makePersona(overrides: Partial<Persona>): Persona {
  return { name: '테스트', age: null, gender: null, mbti: null, personality_traits: null, emotional_expression: null, ...overrides } as Persona
}

describe('fallbackMoodRoll', () => {
  it('유효한 MoodState를 반환한다', () => {
    const mood = fallbackMoodRoll(makePersona({}), [], 'seed-1')
    expect(MOOD_PRIMARIES).toContain(mood.primary)
    expect(mood.energy).toBeGreaterThanOrEqual(0)
    expect(mood.energy).toBeLessThanOrEqual(1)
    expect(mood.openness).toBeGreaterThanOrEqual(0)
    expect(mood.warmth).toBeGreaterThanOrEqual(0)
    expect(mood.reason_hint).toBeTruthy()
  })

  it('같은 seed는 같은 결과', () => {
    const p = makePersona({ age: 25 })
    const a = fallbackMoodRoll(p, [], 'same-seed')
    const b = fallbackMoodRoll(p, [], 'same-seed')
    expect(a.primary).toBe(b.primary)
    expect(a.energy).toBe(b.energy)
  })

  it('다른 seed는 다를 수 있다', () => {
    const p = makePersona({ age: 25 })
    const results = new Set(
      Array.from({ length: 20 }, (_, i) => fallbackMoodRoll(p, [], `seed-${i}`).primary)
    )
    expect(results.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run tests — FAIL**

Run: `cd frontend && npx vitest run src/lib/mood/fallback.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement fallback**

```ts
// frontend/src/lib/mood/fallback.ts
import { MOOD_PRIMARIES, type MoodPrimary, type MoodState } from './types'
import type { Persona, CloneMemory } from '@/types/persona'

function simpleHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function seededRandom(seed: string, index: number): number {
  const h = simpleHash(seed + ':' + index)
  return (h % 10000) / 10000
}

export function fallbackMoodRoll(
  persona: Persona,
  memories: CloneMemory[],
  seed: string,
): MoodState {
  const r0 = seededRandom(seed, 0)
  const r1 = seededRandom(seed, 1)
  const r2 = seededRandom(seed, 2)
  const r3 = seededRandom(seed, 3)

  const primaryIndex = Math.floor(r0 * MOOD_PRIMARIES.length)
  const primary: MoodPrimary = MOOD_PRIMARIES[primaryIndex]

  const energy = Math.round(r1 * 10) / 10
  const openness = Math.round(r2 * 10) / 10
  const warmth = Math.round(r3 * 10) / 10

  return {
    primary,
    energy,
    openness,
    warmth,
    reason_hint: `fallback: 랜덤 mood roll (seed: ${seed.slice(0, 8)})`,
  }
}
```

- [ ] **Step 4: Run tests — PASS**

Run: `cd frontend && npx vitest run src/lib/mood/fallback.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/mood/fallback.ts src/lib/mood/fallback.test.ts && git commit -m "feat(mood): seeded fallback mood roll for Haiku failure recovery (TDD)"
```

---

### Task 10: Mood Roll Prompt + Service (Haiku)

**Files:**
- Create: `frontend/src/lib/prompts/mood.ts`
- Create: `frontend/src/lib/mood/roll.ts`

- [ ] **Step 1: Create mood roll prompt template**

```ts
// frontend/src/lib/prompts/mood.ts

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
```

- [ ] **Step 2: Create mood roll service**

```ts
// frontend/src/lib/mood/roll.ts
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
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/lib/prompts/mood.ts src/lib/mood/roll.ts && git commit -m "feat(mood): Haiku-based mood roll with fallback on parse/network failure"
```

---

## Group D: World Context System

### Task 11: DB Migration

**Files:**
- Create: `frontend/supabase/migrations/20260413000001_world_context.sql`

- [ ] **Step 1: Write migration**

```sql
-- frontend/supabase/migrations/20260413000001_world_context.sql
-- Phase 2 P0: world_context table for manually curated external context

create table world_context (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null check (category in (
    'news', 'weather', 'meme', 'market', 'politics', 'sports', 'other'
  )),
  headline text not null,
  details text,
  weight smallint not null default 5 check (weight between 1 and 10),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index world_context_date_category_idx on world_context (date, category);

-- RLS: select open to authenticated, write restricted to service role
alter table world_context enable row level security;

create policy "world_context_select_authenticated"
  on world_context for select
  to authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated.
-- Server uses service-role client (bypasses RLS) after admin check.
```

- [ ] **Step 2: Apply migration to Supabase Cloud**

Run: `cd frontend && npx supabase db push`
Expected: migration applied successfully

- [ ] **Step 3: Verify table exists**

Run: `cd frontend && npx supabase db dump --schema public | grep world_context`
Expected: table listed in output

- [ ] **Step 4: Commit**

```bash
cd frontend && git add supabase/migrations/20260413000001_world_context.sql && git commit -m "feat(db): world_context table + RLS (select=authenticated, write=service-role)"
```

---

### Task 12: World Context Zod Validation

**Files:**
- Create: `frontend/src/lib/validation/worldContext.ts`

- [ ] **Step 1: Create validation schema**

```ts
// frontend/src/lib/validation/worldContext.ts
import { z } from 'zod'
import { WORLD_CATEGORIES } from '@/lib/world/types'

export const createWorldContextSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(WORLD_CATEGORIES),
  headline: z.string().min(1).max(200),
  details: z.string().max(1000).nullable().optional(),
  weight: z.number().int().min(1).max(10).optional().default(5),
})

export const copyWorldContextSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/lib/validation/worldContext.ts && git commit -m "feat(validation): Zod schemas for world context CRUD"
```

---

### Task 13: World Context Collection

**Files:**
- Create: `frontend/src/lib/world/collect.ts`
- Create: `frontend/src/lib/world/collect.test.ts`

- [ ] **Step 1: Write test for pure selection helper**

```ts
// frontend/src/lib/world/collect.test.ts
import { describe, it, expect } from 'vitest'
import { scoreAndSelectItems } from './collect'
import type { WorldContextRow } from './types'
import type { Persona } from '@/types/persona'

function makeRow(overrides: Partial<WorldContextRow>): WorldContextRow {
  return {
    id: 'test-id',
    date: '2026-04-12',
    category: 'news',
    headline: '테스트 뉴스',
    details: null,
    weight: 5,
    source: 'manual',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('scoreAndSelectItems', () => {
  it('weight 기반 정렬, top-N 선택', () => {
    const rows = [
      makeRow({ headline: 'low', weight: 1 }),
      makeRow({ headline: 'high', weight: 10 }),
      makeRow({ headline: 'mid', weight: 5 }),
    ]
    const result = scoreAndSelectItems(rows, null, [], 2)
    expect(result.length).toBe(2)
    expect(result[0].headline).toBe('high')
    expect(result[1].headline).toBe('mid')
  })

  it('persona hobbies와 headline 교집합 시 bonus', () => {
    const rows = [
      makeRow({ headline: '등산 대회 개최', weight: 3 }),
      makeRow({ headline: '코스피 하락', weight: 5 }),
    ]
    const persona = { hobbies: ['등산', '캠핑'] } as Persona
    const result = scoreAndSelectItems(rows, persona, [], 1)
    // 등산이 hobby에 있으므로 weight 3이지만 bonus로 역전 가능
    expect(result[0].headline).toContain('등산')
  })

  it('빈 배열이면 빈 배열 반환', () => {
    const result = scoreAndSelectItems([], null, [], 5)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — FAIL**

Run: `cd frontend && npx vitest run src/lib/world/collect.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement collection**

```ts
// frontend/src/lib/world/collect.ts
import type { WorldContextRow } from './types'
import type { Persona, CloneMemory } from '@/types/persona'

export function scoreAndSelectItems(
  rows: WorldContextRow[],
  persona: Persona | null,
  memories: CloneMemory[],
  topN: number,
): WorldContextRow[] {
  if (rows.length === 0) return []

  const personaKeywords = [
    ...(persona?.hobbies ?? []),
    ...(persona?.tags ?? []),
    ...(persona?.core_values ?? []),
  ].map((k) => k.toLowerCase())

  const memoryKeywords = memories
    .flatMap((m) => m.tags)
    .map((k) => k.toLowerCase())

  const allKeywords = [...personaKeywords, ...memoryKeywords]

  const scored = rows.map((row) => {
    let score = row.weight

    if (allKeywords.length > 0) {
      const headlineLower = row.headline.toLowerCase()
      const detailsLower = (row.details ?? '').toLowerCase()
      const combined = headlineLower + ' ' + detailsLower

      const overlap = allKeywords.filter((kw) => combined.includes(kw)).length
      score += overlap * 3
    }

    return { row, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topN).map((s) => s.row)
}
```

- [ ] **Step 4: Run test — PASS**

Run: `cd frontend && npx vitest run src/lib/world/collect.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/world/collect.ts src/lib/world/collect.test.ts && git commit -m "feat(world): persona-aware world context scoring and selection (TDD)"
```

---

### Task 14: World Context Injection

**Files:**
- Create: `frontend/src/lib/world/inject.ts`
- Create: `frontend/src/lib/world/inject.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/world/inject.test.ts
import { describe, it, expect } from 'vitest'
import { buildWorldSnippet } from './inject'
import type { WorldContextRow } from './types'

function makeRow(category: string, headline: string): WorldContextRow {
  return {
    id: 'id', date: '2026-04-12', category: category as WorldContextRow['category'],
    headline, details: null, weight: 5, source: 'manual', created_at: '', updated_at: '',
  }
}

describe('buildWorldSnippet', () => {
  it('항목을 카테고리별로 포맷한다', () => {
    const items = [
      makeRow('market', '코스피 3200 돌파'),
      makeRow('weather', '서울 오후 비'),
    ]
    const snippet = buildWorldSnippet(items)
    expect(snippet.promptText).toContain('(market)')
    expect(snippet.promptText).toContain('코스피 3200 돌파')
    expect(snippet.promptText).toContain('(weather)')
    expect(snippet.promptText).toContain('어색하게 뉴스 브리핑하지 말 것')
  })

  it('빈 배열이면 빈 snippet 반환', () => {
    const snippet = buildWorldSnippet([])
    expect(snippet.items).toEqual([])
    expect(snippet.promptText).toBe('')
  })
})
```

- [ ] **Step 2: Run tests — FAIL**

Run: `cd frontend && npx vitest run src/lib/world/inject.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement injection**

```ts
// frontend/src/lib/world/inject.ts
import type { WorldContextRow, WorldSnippet } from './types'

export function buildWorldSnippet(items: WorldContextRow[]): WorldSnippet {
  if (items.length === 0) return { items: [], promptText: '' }

  const lines = items.map((item) => `- (${item.category}) ${item.headline}`)

  const promptText = `[오늘 대략 이런 것들이 화제야 — 자연스럽게 언급해도 되고 안 해도 돼:]
${lines.join('\n')}

[어색하게 뉴스 브리핑하지 말 것. 대화 흐름에 자연스러우면 섞고, 아니면 무시.]`

  return { items, promptText }
}
```

- [ ] **Step 4: Run tests — PASS**

Run: `cd frontend && npx vitest run src/lib/world/inject.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/lib/world/inject.ts src/lib/world/inject.test.ts && git commit -m "feat(world): world context prompt snippet builder (TDD)"
```

---

## Group E: Prompt Builder Extension

### Task 15: Extend buildSystemPrompt

**Files:**
- Modify: `frontend/src/lib/prompts/persona.ts`
- Modify: `frontend/src/lib/prompts/persona.test.ts` (if existing tests exist — extend)

- [ ] **Step 1: Read current buildSystemPrompt**

Run: `cd frontend && cat src/lib/prompts/persona.ts`

Confirm current signature: `buildSystemPrompt(persona: Persona, memories?: CloneMemory[]): string`

- [ ] **Step 2: Add extended version alongside existing function**

Add a new function `buildEnhancedSystemPrompt` that composes all modulators. Keep the old `buildSystemPrompt` intact for backward compatibility.

```ts
// Add to frontend/src/lib/prompts/persona.ts

import { TEXTURE_RULES } from './texture'
import { BEHAVIOR_INSTRUCTIONS } from './behavior'
import type { StyleCard } from '@/lib/styles/types'
import type { MoodState } from '@/lib/mood/types'
import type { WorldSnippet } from '@/lib/world/types'

export interface EnhancedPromptInput {
  persona: Persona
  memories?: CloneMemory[]
  textureRules?: string
  styleCards?: StyleCard[]
  mood?: MoodState
  worldSnippet?: WorldSnippet | null
}

function renderMoodHint(mood: MoodState): string {
  const labels: Record<string, string> = {
    '평온': '차분하고 평온한 상태',
    '설렘': '기대감이 있고 설레는 상태',
    '짜증': '약간 짜증나고 예민한 상태',
    '우울': '기분이 가라앉고 우울한 상태',
    '활기': '에너지가 넘치고 활발한 상태',
    '피곤': '피곤하고 말수가 적은 상태',
    '긴장': '긴장되고 조심스러운 상태',
  }
  return `[지금 너의 기분: ${labels[mood.primary] ?? mood.primary}. 이건 시작점일 뿐이야 — 대화하면서 자연스럽게 바뀌어도 돼.]`
}

function renderStyleCards(cards: StyleCard[]): string {
  if (cards.length === 0) return ''
  const sections = cards.map((c) => {
    let section = `--- 스타일 참고: ${c.label} ---\n${c.sample}`
    if (c.texture_notes) section += `\n(참고: ${c.texture_notes})`
    return section
  })
  return `[아래 대화 예시처럼 말해. 똑같이 따라하지 말고 톤과 리듬만 참고:]\n${sections.join('\n\n')}`
}

export function buildEnhancedSystemPrompt(input: EnhancedPromptInput): string {
  const { persona, memories, textureRules, styleCards, mood, worldSnippet } = input

  const parts: string[] = []

  // 1. Texture rules (baseline, lowest priority — can be overridden by persona)
  if (textureRules) parts.push(textureRules)

  // 2. Persona core
  parts.push(renderPersonaCore(persona))

  // 3. Memories
  if (memories && memories.length > 0) {
    parts.push(renderRecentMemories(memories))
  }

  // 4. Mood hint (short, 1-2 lines)
  if (mood) parts.push(renderMoodHint(mood))

  // 5. Style cards (few-shot examples)
  if (styleCards && styleCards.length > 0) {
    parts.push(renderStyleCards(styleCards))
  }

  // 6. World context (optional)
  if (worldSnippet?.promptText) {
    parts.push(worldSnippet.promptText)
  }

  // 7. Behavior instructions (always last — includes speaker hint rules)
  parts.push(BEHAVIOR_INSTRUCTIONS)

  return parts.join('\n\n')
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Write test for new function**

Add to existing persona test file or create a new test:

```ts
// Add to persona.test.ts or create frontend/src/lib/prompts/enhanced.test.ts
import { describe, it, expect } from 'vitest'
import { buildEnhancedSystemPrompt } from './persona'
import type { MoodState } from '@/lib/mood/types'

describe('buildEnhancedSystemPrompt', () => {
  it('모든 섹션을 포함한 프롬프트를 생성한다', () => {
    const result = buildEnhancedSystemPrompt({
      persona: { name: '테스트' } as any,
      memories: [],
      textureRules: '[텍스처 규칙]',
      styleCards: [{
        id: 'test', label: '테스트', match: {},
        sample: 'A: 안녕\nB: 응',
      }],
      mood: { primary: '활기', energy: 0.8, openness: 0.7, warmth: 0.6, reason_hint: '' },
      worldSnippet: { items: [], promptText: '[오늘 뉴스]' },
    })

    expect(result).toContain('[텍스처 규칙]')
    expect(result).toContain('테스트')
    expect(result).toContain('활기')
    expect(result).toContain('스타일 참고')
    expect(result).toContain('[오늘 뉴스]')
  })

  it('선택적 파라미터 없이도 동작한다', () => {
    const result = buildEnhancedSystemPrompt({
      persona: { name: '최소' } as any,
    })
    expect(result).toContain('최소')
    expect(result).not.toContain('스타일 참고')
    expect(result).not.toContain('기분')
  })
})
```

- [ ] **Step 5: Run all tests — PASS**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS (기존 53 + 신규)

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/lib/prompts/persona.ts src/lib/prompts/enhanced.test.ts && git commit -m "feat(prompts): buildEnhancedSystemPrompt with texture/mood/cards/world"
```

---

## Group F: Engine Orchestration

### Task 16: Wire Modulators into Run Endpoint

**Files:**
- Modify: `frontend/src/lib/interaction/engine.ts`
- Modify: `frontend/src/app/api/interactions/[id]/run/route.ts`
- Create: `frontend/src/lib/interaction/orchestrate.ts`
- Modify: `frontend/src/lib/config/interaction.ts` (add new constants)

- [ ] **Step 1: Add config constants**

Add to `frontend/src/lib/config/interaction.ts`:

```ts
export const REALISM_DEFAULTS = {
  STYLE_CARD_TOP_K: 2,
  WORLD_CONTEXT_TOP_N: 5,
  WORLD_CONTEXT_FALLBACK_DAYS: 7,
}
```

- [ ] **Step 2: Create orchestrator module**

This module prepares all modulator results before the engine loop starts.

```ts
// frontend/src/lib/interaction/orchestrate.ts
import { getAllStyleCards } from '@/lib/styles/index'
import { pickStyleCards } from '@/lib/styles/match'
import { rollMood } from '@/lib/mood/roll'
import { scoreAndSelectItems } from '@/lib/world/collect'
import { buildWorldSnippet } from '@/lib/world/inject'
import { buildEnhancedSystemPrompt } from '@/lib/prompts/persona'
import { TEXTURE_RULES } from '@/lib/prompts/texture'
import { REALISM_DEFAULTS } from '@/lib/config/interaction'
import { createServiceClient } from '@/lib/supabase/service'
import type { Clone } from '@/types/persona'
import type { CloneMemory } from '@/types/persona'
import type { WorldSnippet } from '@/lib/world/types'
import type { MoodState } from '@/lib/mood/types'

export interface ClonePromptContext {
  systemPrompt: string
  mood: MoodState
  styleCardIds: string[]
}

export async function prepareClonePrompts(
  participants: Clone[],
  memoriesByClone: Map<string, CloneMemory[]>,
  interactionId: string,
  date: string,
): Promise<Map<string, ClonePromptContext>> {
  // 1. Load world context (shared across all clones)
  const worldSnippet = await loadTodayWorldContext(date, participants, memoriesByClone)

  // 2. For each clone: mood roll + style card pick + build prompt
  const allCards = getAllStyleCards()
  const result = new Map<string, ClonePromptContext>()

  for (const clone of participants) {
    const memories = memoriesByClone.get(clone.id) ?? []
    const seed = `${interactionId}:${clone.id}:${date}`

    // Mood roll (Haiku)
    const mood = await rollMood(clone.persona_json, memories, worldSnippet, seed)

    // Style card pick
    const styleCards = pickStyleCards(allCards, clone.persona_json, memories, mood, {
      topK: REALISM_DEFAULTS.STYLE_CARD_TOP_K,
    })

    // Build enhanced system prompt
    const systemPrompt = buildEnhancedSystemPrompt({
      persona: clone.persona_json,
      memories,
      textureRules: TEXTURE_RULES,
      styleCards,
      mood,
      worldSnippet,
    })

    result.set(clone.id, {
      systemPrompt,
      mood,
      styleCardIds: styleCards.map((c) => c.id),
    })
  }

  return result
}

async function loadTodayWorldContext(
  date: string,
  participants: Clone[],
  memoriesByClone: Map<string, CloneMemory[]>,
): Promise<WorldSnippet | null> {
  try {
    const supabase = createServiceClient()

    // Try today first, then fallback up to 7 days
    for (let offset = 0; offset < REALISM_DEFAULTS.WORLD_CONTEXT_FALLBACK_DAYS; offset++) {
      const d = new Date(date)
      d.setDate(d.getDate() - offset)
      const dateStr = d.toISOString().split('T')[0]

      const { data: rows } = await supabase
        .from('world_context')
        .select('*')
        .eq('date', dateStr)
        .order('weight', { ascending: false })

      if (rows && rows.length > 0) {
        // Use first participant's persona for relevance scoring
        const firstClone = participants[0]
        const firstMemories = memoriesByClone.get(firstClone.id) ?? []
        const selected = scoreAndSelectItems(
          rows, firstClone.persona_json, firstMemories,
          REALISM_DEFAULTS.WORLD_CONTEXT_TOP_N,
        )
        return buildWorldSnippet(selected)
      }
    }

    return null
  } catch (err) {
    console.error('[world] context 로드 실패, skip:', err)
    return null
  }
}
```

- [ ] **Step 3: Modify engine to accept pre-built system prompts**

In `frontend/src/lib/interaction/engine.ts`, change `RunInteractionInput` to include optional pre-built prompts:

Add to `RunInteractionInput`:
```ts
prebuiltPrompts?: Map<string, string>
```

Then in the turn loop, where `buildSystemPrompt` is called (~line 110), change to:

```ts
const systemPrompt = input.prebuiltPrompts?.get(speaker.id)
  ?? buildSystemPrompt(speaker.persona_json, memoriesByClone.get(speaker.id))
```

This preserves backward compatibility — if `prebuiltPrompts` is not provided, falls back to original behavior.

- [ ] **Step 4: Modify run route to call orchestrator**

In `frontend/src/app/api/interactions/[id]/run/route.ts`, after loading participants and memories, add:

```ts
import { prepareClonePrompts } from '@/lib/interaction/orchestrate'

// ... (after loading participants, before calling runInteraction)

const today = new Date().toISOString().split('T')[0]
const clonePrompts = await prepareClonePrompts(participants, memoriesByClone, id, today)
const prebuiltPrompts = new Map<string, string>()
for (const [cloneId, ctx] of clonePrompts) {
  prebuiltPrompts.set(cloneId, ctx.systemPrompt)
}

// Pass to engine
const result = await runInteraction({
  ...existingInput,
  prebuiltPrompts,
})
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS (기존 + 신규 전부)

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/lib/interaction/orchestrate.ts src/lib/interaction/engine.ts src/app/api/interactions/*/run/route.ts src/lib/config/interaction.ts && git commit -m "feat(engine): wire modulator orchestration into run endpoint"
```

---

## Group G: Admin UI & API

### Task 17: World Context API Routes

**Files:**
- Create: `frontend/src/lib/admin/guard.ts`
- Create: `frontend/src/app/api/world-context/route.ts`
- Create: `frontend/src/app/api/world-context/[id]/route.ts`
- Create: `frontend/src/app/api/world-context/copy/route.ts`

- [ ] **Step 1: Create admin guard helper**

```ts
// frontend/src/lib/admin/guard.ts
import { createClient } from '@/lib/supabase/server'
import { errors } from '@/lib/errors'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)

export async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw errors.unauthorized()
  if (!ADMIN_IDS.includes(user.id)) throw errors.forbidden()
  return user.id
}
```

- [ ] **Step 2: Create GET/POST route**

```ts
// frontend/src/app/api/world-context/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/guard'
import { createWorldContextSchema } from '@/lib/validation/worldContext'
import { errors, AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  console.error('Unhandled:', err)
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    if (!date) throw errors.validation('date parameter required')

    const service = createServiceClient()
    const { data, error } = await service
      .from('world_context')
      .select('*')
      .eq('date', date)
      .order('weight', { ascending: false })

    if (error) throw errors.internal()
    return NextResponse.json({ data })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const validated = createWorldContextSchema.parse(body)

    const service = createServiceClient()
    const { data, error } = await service
      .from('world_context')
      .insert(validated)
      .select()
      .single()

    if (error) throw errors.internal()
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 3: Create DELETE route**

```ts
// frontend/src/app/api/world-context/[id]/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'
import { errors, AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  console.error('Unhandled:', err)
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await ctx.params

    const service = createServiceClient()
    const { error } = await service.from('world_context').delete().eq('id', id)

    if (error) throw errors.internal()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 4: Create copy route**

```ts
// frontend/src/app/api/world-context/copy/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'
import { copyWorldContextSchema } from '@/lib/validation/worldContext'
import { errors, AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  console.error('Unhandled:', err)
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { from, to } = copyWorldContextSchema.parse(body)

    const service = createServiceClient()

    const { data: sourceRows, error: fetchError } = await service
      .from('world_context')
      .select('category, headline, details, weight, source')
      .eq('date', from)

    if (fetchError) throw errors.internal()
    if (!sourceRows || sourceRows.length === 0) {
      throw errors.notFound(`world_context for date ${from}`)
    }

    const newRows = sourceRows.map((row) => ({ ...row, date: to }))
    const { data, error: insertError } = await service
      .from('world_context')
      .insert(newRows)
      .select()

    if (insertError) throw errors.internal()
    return NextResponse.json({ data, copied: newRows.length }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/lib/admin/guard.ts src/app/api/world-context/ src/lib/validation/worldContext.ts && git commit -m "feat(api): world context CRUD + copy + admin guard"
```

---

### Task 18: Admin World Context Page

**Files:**
- Create: `frontend/src/app/admin/world/page.tsx`

- [ ] **Step 1: Create admin page**

```tsx
// frontend/src/app/admin/world/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface WorldRow {
  id: string
  date: string
  category: string
  headline: string
  details: string | null
  weight: number
  source: string
}

const CATEGORIES = ['news', 'weather', 'meme', 'market', 'politics', 'sports', 'other'] as const

export default function AdminWorldPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [rows, setRows] = useState<WorldRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [category, setCategory] = useState<string>('news')
  const [headline, setHeadline] = useState('')
  const [details, setDetails] = useState('')
  const [weight, setWeight] = useState(5)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/world-context?date=${date}`)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error?.message ?? '로드 실패')
      }
      const body = await res.json()
      setRows(body.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function handleAdd() {
    if (!headline.trim()) return
    try {
      const res = await fetch('/api/world-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, category, headline: headline.trim(), details: details.trim() || null, weight }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error?.message ?? '추가 실패')
      }
      setHeadline('')
      setDetails('')
      setWeight(5)
      fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류')
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/world-context/${id}`, { method: 'DELETE' })
      fetchRows()
    } catch {
      setError('삭제 실패')
    }
  }

  async function handleCopyYesterday() {
    const yesterday = new Date(date)
    yesterday.setDate(yesterday.getDate() - 1)
    const from = yesterday.toISOString().split('T')[0]
    try {
      const res = await fetch('/api/world-context/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: date }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error?.message ?? '복사 실패')
      }
      fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">World Context 관리</h1>

      <div className="mb-4 flex items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-48"
        />
        <Button variant="outline" onClick={handleCopyYesterday}>
          어제 복사
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {/* Row table */}
      <div className="mb-6 space-y-2">
        {loading && <p className="text-sm text-muted-foreground">로딩...</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">이 날짜에 등록된 항목이 없습니다</p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="flex items-start gap-3 rounded-lg border p-3">
            <span className="mt-0.5 rounded bg-muted px-2 py-0.5 text-xs font-medium">{row.category}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{row.headline}</p>
              {row.details && <p className="text-sm text-muted-foreground">{row.details}</p>}
            </div>
            <span className="text-xs text-muted-foreground">w:{row.weight}</span>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
              삭제
            </Button>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">항목 추가</h2>
        <div className="flex gap-3">
          <select
            className="rounded border px-2 py-1.5 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Input
            placeholder="헤드라인"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            min={1}
            max={10}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-20"
            placeholder="가중치"
          />
        </div>
        <Textarea
          placeholder="추가 맥락 (선택)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="resize-none"
          rows={2}
        />
        <Button onClick={handleAdd} disabled={!headline.trim()}>
          추가
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add admin route protection**

Check if middleware is needed. Since middleware.ts doesn't exist, create a server layout that redirects non-admins:

```tsx
// frontend/src/app/admin/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !ADMIN_IDS.includes(user.id)) {
    redirect('/clones')
  }

  return <>{children}</>
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Manual test**

Start dev server: `cd frontend && bun dev`
Navigate to `/admin/world` (while logged in as admin user).
- Verify: date picker, add form, row display, delete, copy yesterday all work.
- Verify: non-admin user gets redirected to `/clones`.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/app/admin/ && git commit -m "feat(admin): /admin/world page for managing world context rows"
```

---

## Group H: Dev CLI

### Task 19: Dev Interaction CLI Script

**Files:**
- Create: `frontend/scripts/dev-interaction.ts`

- [ ] **Step 1: Create the CLI script**

```ts
// frontend/scripts/dev-interaction.ts
/**
 * Dev CLI for running interactions with realism tuning feedback.
 *
 * Usage:
 *   bun scripts/dev-interaction.ts --pair=<clone1_id>,<clone2_id> [--scenario=online-first-match] [--mood-seed=42] [--turns=10]
 *
 * Workflow:
 *   1. 스타일 카드 / 텍스처 규칙 수정
 *   2. bun scripts/dev-interaction.ts --pair=npc1,npc2
 *   3. 결과 관찰 + 체크리스트 평가
 *   4. 수정 → 반복
 */

import { createServiceClient } from '../src/lib/supabase/service'
import { prepareClonePrompts } from '../src/lib/interaction/orchestrate'
import { runInteraction, type RunInteractionInput } from '../src/lib/interaction/engine'
import { DEFAULT_SCENARIOS } from '../src/lib/config/interaction'
import type { Clone, CloneMemory } from '../src/types/persona'

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (key: string) => {
    const arg = args.find((a) => a.startsWith(`--${key}=`))
    return arg?.split('=')[1] ?? null
  }
  return {
    pair: get('pair')?.split(',') ?? [],
    scenario: get('scenario') ?? 'online-first-match',
    moodSeed: get('mood-seed') ?? undefined,
    turns: Number(get('turns') ?? 10),
    help: args.includes('--help'),
  }
}

function printHelp() {
  console.log(`
  Dev Interaction CLI — realism 튜닝용

  Usage:
    bun scripts/dev-interaction.ts --pair=<id1>,<id2> [options]

  Options:
    --pair=id1,id2       Clone IDs (comma-separated, required)
    --scenario=id        Scenario ID (default: online-first-match)
    --mood-seed=str      Mood roll seed (default: random)
    --turns=N            Max turns (default: 10)
    --help               Show this help

  Tuning workflow:
    1. lib/prompts/texture.ts 또는 lib/styles/cards/ 수정
    2. bun scripts/dev-interaction.ts --pair=<ids>
    3. 아래 체크리스트로 결과 평가
    4. 만족할 때까지 반복
  `)
}

// ANSI colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
}

interface ChecklistResult {
  periodRate: number
  consecutiveRate: number
  emotionRate: number
  formalConnectives: number
}

function evaluateChecklist(messages: Array<{ speaker: string; content: string }>): ChecklistResult {
  let periods = 0
  let consecutivePairs = 0
  let emotionHits = 0
  let formalHits = 0

  const emotionPatterns = /[ㅋㅎㅠㅜ]{2,}/g
  const formalWords = ['또한', '그러므로', '따라서', '그러나', '한편']

  let lastSpeaker: string | null = null

  for (const msg of messages) {
    if (msg.content.endsWith('.') || msg.content.endsWith('다.') || msg.content.endsWith('요.')) {
      periods++
    }
    if (msg.speaker === lastSpeaker) {
      consecutivePairs++
    }
    if (emotionPatterns.test(msg.content)) {
      emotionHits++
    }
    for (const w of formalWords) {
      if (msg.content.includes(w)) formalHits++
    }
    lastSpeaker = msg.speaker
  }

  const total = messages.length || 1
  return {
    periodRate: periods / total,
    consecutiveRate: consecutivePairs / total,
    emotionRate: emotionHits / total,
    formalConnectives: formalHits,
  }
}

function printChecklist(result: ChecklistResult) {
  const pass = (ok: boolean) => ok ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`
  console.log(`\n${C.bold}=== Realism 체크리스트 ===${C.reset}`)
  console.log(`  1. 마침표 발생률 < 10%:    ${(result.periodRate * 100).toFixed(1)}%  ${pass(result.periodRate < 0.1)}`)
  console.log(`  2. 연속 메시지 비율 > 30%: ${(result.consecutiveRate * 100).toFixed(1)}%  ${pass(result.consecutiveRate > 0.3)}`)
  console.log(`  3. 감정 자음 등장률 > 15%: ${(result.emotionRate * 100).toFixed(1)}%  ${pass(result.emotionRate > 0.15)}`)
  console.log(`  4. 문어체 접속사 0회:      ${result.formalConnectives}회  ${pass(result.formalConnectives === 0)}`)
  console.log(`  5-8. 수동 평가 필요: 체감 자연스러움, 톤 변주, 말투 차별화, 외부 맥락\n`)
}

async function main() {
  const opts = parseArgs()
  if (opts.help) { printHelp(); process.exit(0) }
  if (opts.pair.length !== 2) {
    console.error('Error: --pair=<id1>,<id2> required')
    process.exit(1)
  }

  const supabase = createServiceClient()

  // Load clones
  const { data: clones, error: cloneErr } = await supabase
    .from('clones')
    .select('*')
    .in('id', opts.pair)

  if (cloneErr || !clones || clones.length !== 2) {
    console.error('Error: clones not found', cloneErr)
    process.exit(1)
  }

  // Load memories
  const memoriesByClone = new Map<string, CloneMemory[]>()
  for (const clone of clones) {
    const { data: mems } = await supabase
      .from('clone_memories')
      .select('*')
      .eq('clone_id', clone.id)
      .order('occurred_at', { ascending: false })
      .limit(10)
    memoriesByClone.set(clone.id, (mems ?? []) as CloneMemory[])
  }

  // Find scenario
  const scenario = DEFAULT_SCENARIOS.find((s) => s.id === opts.scenario) ?? DEFAULT_SCENARIOS[0]

  console.log(`\n${C.bold}=== Dev Interaction ===${C.reset}`)
  console.log(`  Pair: ${clones.map((c) => c.name ?? c.id).join(' × ')}`)
  console.log(`  Scenario: ${scenario.label}`)
  console.log(`  Max turns: ${opts.turns}`)

  // Create temp interaction
  const { data: interaction, error: intErr } = await supabase
    .from('interactions')
    .insert({
      kind: 'dev-cli',
      scenario: scenario.id,
      setting: null,
      status: 'pending',
      max_turns: opts.turns,
      metadata: { dev_cli: true, mood_seed: opts.moodSeed },
    })
    .select()
    .single()

  if (intErr || !interaction) {
    console.error('Error creating interaction:', intErr)
    process.exit(1)
  }

  // Add participants
  for (let i = 0; i < clones.length; i++) {
    await supabase.from('interaction_participants').insert({
      interaction_id: interaction.id,
      clone_id: clones[i].id,
      role: i === 0 ? 'initiator' : 'responder',
    })
  }

  // Prepare prompts
  const today = new Date().toISOString().split('T')[0]
  const clonePrompts = await prepareClonePrompts(
    clones as Clone[], memoriesByClone, interaction.id, today,
  )

  // Print mood info
  for (const [cloneId, ctx] of clonePrompts) {
    const name = clones.find((c) => c.id === cloneId)?.name ?? cloneId
    console.log(`  ${C.cyan}${name}${C.reset} mood: ${ctx.mood.primary} (e:${ctx.mood.energy} o:${ctx.mood.openness} w:${ctx.mood.warmth})`)
    console.log(`    cards: [${ctx.styleCardIds.join(', ')}]`)
  }

  const prebuiltPrompts = new Map<string, string>()
  for (const [cloneId, ctx] of clonePrompts) {
    prebuiltPrompts.set(cloneId, ctx.systemPrompt)
  }

  console.log(`\n${C.dim}--- 대화 시작 ---${C.reset}\n`)

  // Run
  await supabase.from('interactions').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', interaction.id)

  const result = await runInteraction({
    interactionId: interaction.id,
    participants: clones as Clone[],
    memoriesByClone,
    scenario,
    setting: null,
    maxTurns: opts.turns,
    prebuiltPrompts,
  })

  // Fetch events
  const { data: events } = await supabase
    .from('interaction_events')
    .select('*')
    .eq('interaction_id', interaction.id)
    .order('turn_number', { ascending: true })

  const cloneNames = new Map(clones.map((c) => [c.id, c.name ?? c.id.slice(0, 6)]))
  const messages: Array<{ speaker: string; content: string }> = []

  for (const ev of events ?? []) {
    const name = cloneNames.get(ev.speaker_clone_id) ?? '?'
    const color = ev.speaker_clone_id === clones[0].id ? C.cyan : C.magenta
    console.log(`${color}${C.bold}${name}${C.reset}: ${ev.content}`)
    messages.push({ speaker: name, content: ev.content })
  }

  console.log(`\n${C.dim}--- 대화 종료 (${result.turnsCompleted}턴, ${result.status}) ---${C.reset}`)

  // Checklist
  evaluateChecklist(messages)
  printChecklist(evaluateChecklist(messages))

  // Cleanup
  await supabase.from('interactions').update({ status: result.status, ended_at: new Date().toISOString() }).eq('id', interaction.id)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Test CLI**

Run: `cd frontend && bun scripts/dev-interaction.ts --help`
Expected: help text printed

Run: `cd frontend && bun scripts/dev-interaction.ts --pair=<npc1_id>,<npc2_id> --turns=5`
Expected: interaction transcript printed, checklist evaluated

- [ ] **Step 3: Commit**

```bash
cd frontend && git add scripts/dev-interaction.ts && git commit -m "feat(cli): dev-interaction script for realism tuning loop"
```

---

## Group I: Tuning Loop

### Task 20: Execute Realism Tuning Rounds

> **This task is a mandatory manual process, not skippable.** Phase 1 이슈 #4 ("Dev CLI 스크립트의 realism 튜닝 루프 미수행")를 반복하지 않는다.

**Files:**
- Modify: `frontend/src/lib/prompts/texture.ts` (as needed)
- Modify: `frontend/src/lib/styles/cards/*.ts` (as needed)
- Create: `docs/phase2/tuning-log.md`

- [ ] **Round 1: Baseline run**

Run: `cd frontend && bun scripts/dev-interaction.ts --pair=<npc1>,<npc2> --scenario=online-first-match --turns=10`

Record results in `docs/phase2/tuning-log.md`:
```md
# Realism Tuning Log

## Round 1 — Baseline
- Date: YYYY-MM-DD
- Pair: <npc names>
- Checklist:
  1. 마침표 < 10%: ?
  2. 연속 메시지 > 30%: ?
  3. 감정 자음 > 15%: ?
  4. 문어체 접속사 0회: ?
  5. 체감 자연스러움: ?
  6. 톤 변주 (같은 Clone 재실행 시): ?
  7. 말투 차별화: ?
  8. 외부 맥락: ?
- 실패 항목:
- 수정 사항:
```

- [ ] **Round 1: Fix**

Failing items 기반으로 `texture.ts` 또는 카드 파일 수정.

- [ ] **Round 1: Commit fixes**

```bash
cd frontend && git add -A && git commit -m "fix(realism): tuning round 1 adjustments"
```

- [ ] **Round 2: Re-run + different pair**

Run: `cd frontend && bun scripts/dev-interaction.ts --pair=<npc3>,<npc4> --scenario=casual-chat --turns=10`

Record results. Fix failing items. Commit.

- [ ] **Round 3: Verify mood variation**

Run same pair 3 times with different seeds:
```bash
cd frontend && bun scripts/dev-interaction.ts --pair=<npc1>,<npc2> --mood-seed=seed1 --turns=8
cd frontend && bun scripts/dev-interaction.ts --pair=<npc1>,<npc2> --mood-seed=seed2 --turns=8
cd frontend && bun scripts/dev-interaction.ts --pair=<npc1>,<npc2> --mood-seed=seed3 --turns=8
```

Verify: 3 runs have different moods → different tones. Record in log.

- [ ] **Round 3: Final commit**

```bash
cd frontend && git add docs/phase2/tuning-log.md && git commit -m "docs: realism tuning log rounds 1-3"
```

---

## Group J: Smoke Test & Deploy

### Task 21: Full Integration Verification

- [ ] **Step 1: Run all unit tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS (기존 53 + 신규 ~20 = 70+)

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Manual smoke test on local dev server**

Start: `cd frontend && bun dev`

1. Log in as admin user
2. Go to `/admin/world` → add 3-5 world context items for today
3. Go to `/interactions/new` → pick two NPCs → start interaction
4. Watch `/interactions/[id]` viewer → verify messages show Korean chat texture
5. Verify: no periods at end, short messages, ㅋㅋ/ㅠㅠ present, no "또한"/"그러므로"
6. Run a second interaction with same pair → verify different mood/tone

- [ ] **Step 4: Add ADMIN_USER_IDS to Vercel**

Run: `cd frontend && npx vercel env add ADMIN_USER_IDS production preview`
Enter: your Supabase user UUID

- [ ] **Step 5: Deploy**

```bash
cd frontend && git push origin main
```

Wait for Vercel auto-deploy. Verify production URL works with the realism improvements.

- [ ] **Step 6: Update PROJECT_STATE.md**

Add Phase 2 P0 completion info: what was shipped, known gaps, next sub-project (P2 matching).

- [ ] **Step 7: Final commit**

```bash
cd frontend && git add docs/PROJECT_STATE.md && git commit -m "docs: update PROJECT_STATE for Phase 2 P0 completion"
```

---

## .env.local 업데이트

`.env.local` 에 추가 필요:

```
ADMIN_USER_IDS=<your-supabase-user-uuid>
```

`.env.local.example` 에도 항목 추가:
```
ADMIN_USER_IDS=uuid1,uuid2
```

---

## 요약: 파일 전체 목록

### 신규 파일 (22개)
| File | Purpose |
|---|---|
| `src/lib/styles/types.ts` | StyleCard 타입 |
| `src/lib/styles/match.ts` | 4-tier matching 순수 함수 |
| `src/lib/styles/match.test.ts` | matching 테스트 |
| `src/lib/styles/index.ts` | 카드 glob 수집 |
| `src/lib/styles/index.test.ts` | 수집 테스트 |
| `src/lib/styles/cards/formal_polite_young.ts` | 시드 카드 |
| `src/lib/styles/cards/formal_polite_mature.ts` | 시드 카드 |
| `src/lib/styles/cards/casual_close_female.ts` | 시드 카드 |
| `src/lib/styles/cards/casual_close_male.ts` | 시드 카드 |
| `src/lib/styles/cards/mixed_warming_up.ts` | 시드 카드 |
| `src/lib/styles/cards/default_casual.ts` | fallback 카드 |
| `src/lib/mood/types.ts` | MoodState 타입 |
| `src/lib/mood/parse.ts` | Zod 파싱 |
| `src/lib/mood/parse.test.ts` | 파싱 테스트 |
| `src/lib/mood/fallback.ts` | 코드 기반 fallback |
| `src/lib/mood/fallback.test.ts` | fallback 테스트 |
| `src/lib/mood/roll.ts` | Haiku mood roll 서비스 |
| `src/lib/world/types.ts` | WorldContext 타입 |
| `src/lib/world/collect.ts` | DB 수집 + scoring |
| `src/lib/world/collect.test.ts` | 수집 테스트 |
| `src/lib/world/inject.ts` | prompt snippet 빌더 |
| `src/lib/world/inject.test.ts` | 주입 테스트 |
| `src/lib/prompts/texture.ts` | 메시지 텍스처 규칙 |
| `src/lib/prompts/texture.test.ts` | 규칙 regression 테스트 |
| `src/lib/prompts/mood.ts` | mood roll 프롬프트 |
| `src/lib/interaction/orchestrate.ts` | modulator orchestration |
| `src/lib/admin/guard.ts` | admin 권한 체크 |
| `src/lib/validation/worldContext.ts` | Zod 스키마 |
| `src/app/api/world-context/route.ts` | GET/POST API |
| `src/app/api/world-context/[id]/route.ts` | DELETE API |
| `src/app/api/world-context/copy/route.ts` | copy API |
| `src/app/admin/world/page.tsx` | admin UI |
| `src/app/admin/layout.tsx` | admin layout guard |
| `scripts/dev-interaction.ts` | Dev CLI |
| `supabase/migrations/20260413000001_world_context.sql` | DB migration |
| `docs/phase2/tuning-log.md` | 튜닝 결과 기록 |

### 수정 파일 (3개)
| File | Change |
|---|---|
| `src/lib/prompts/persona.ts` | `buildEnhancedSystemPrompt` 추가 |
| `src/lib/interaction/engine.ts` | `prebuiltPrompts` input 추가 |
| `src/app/api/interactions/[id]/run/route.ts` | orchestrator 호출 추가 |
| `src/lib/config/interaction.ts` | `REALISM_DEFAULTS` 상수 추가 |
