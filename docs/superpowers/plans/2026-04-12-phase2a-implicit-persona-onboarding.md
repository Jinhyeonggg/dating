# Phase 2-A: Implicit Persona Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clone 생성 후 시나리오 반응형 + 선택지 퀴즈 온보딩(2-3분)으로 행동 패턴을 추론하여 `inferred_traits`에 저장하고, Interaction system prompt에 주입한다.

**Architecture:** 정적 질문 세트(데이터 드리븐) → 유저 응답 수집 → Haiku 1회 호출로 traits 추론 → `clones.inferred_traits` jsonb 저장. 기존 `buildEnhancedSystemPrompt`에 레이어 추가.

**Tech Stack:** Next.js 16 App Router, Supabase, Anthropic Claude (Haiku), Vitest, Zod, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-12-implicit-persona-clone-identity-design.md` 섹션 2

---

## File Structure

### 신규 파일
| 파일 | 책임 |
|---|---|
| `src/lib/constants/onboardingQuestions.ts` | 질문 세트 데이터 (시나리오 3 + 선택지 4) |
| `src/types/onboarding.ts` | `OnboardingQuestion`, `InferredTraits`, `OnboardingAnswer` 타입 |
| `src/lib/validation/onboarding.ts` | 온보딩 응답 Zod 스키마 |
| `src/lib/prompts/onboarding.ts` | traits 추론 프롬프트 템플릿 |
| `src/lib/onboarding/extract.ts` | 추론 결과 파싱 순수 함수 |
| `src/lib/onboarding/extract.test.ts` | 파싱 테스트 |
| `src/lib/onboarding/service.ts` | 추론 + 저장 서비스 |
| `src/app/api/clones/[id]/onboarding/route.ts` | 온보딩 API |
| `src/app/clones/[id]/onboarding/page.tsx` | 온보딩 UI 페이지 |
| `src/components/onboarding/OnboardingCard.tsx` | 단일 질문 카드 컴포넌트 |
| `src/components/onboarding/OnboardingFlow.tsx` | 전체 온보딩 플로우 (상태 관리) |
| `src/components/onboarding/TraitsPreview.tsx` | 추론 결과 프리뷰 + 확인 UI |

### 수정 파일
| 파일 | 변경 |
|---|---|
| `src/types/persona.ts` | `Clone` 인터페이스에 `inferred_traits` 추가 |
| `src/lib/config/claude.ts` | `CLAUDE_MODELS.ONBOARDING`, `CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_ONBOARDING` 추가 |
| `src/lib/prompts/persona.ts` | `renderInferredTraits()` 함수 + `EnhancedPromptInput`에 필드 추가 |
| `src/lib/interaction/orchestrate.ts` | `prepareClonePrompts`에서 `inferred_traits` 전달 |
| `src/app/clones/new/page.tsx` | 생성 후 `/clones/[id]/onboarding`으로 리다이렉트 |
| `src/app/clones/[id]/page.tsx` | 추론 traits 섹션 + 온보딩 CTA 배너 |

---

## Task 1: DB 마이그레이션 — `inferred_traits` 컬럼

**Files:**
- Create: `supabase/migrations/20260412000004_inferred_traits.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 20260412000004_inferred_traits.sql
-- Phase 2-A: Implicit Persona 온보딩 결과 저장

ALTER TABLE clones ADD COLUMN inferred_traits jsonb DEFAULT NULL;

COMMENT ON COLUMN clones.inferred_traits IS '온보딩 시나리오/퀴즈에서 AI가 추론한 행동 패턴. NULL이면 온보딩 미완료.';
```

- [ ] **Step 2: Supabase Cloud에 마이그레이션 적용**

Run: `npx supabase db push --linked`
Expected: 마이그레이션 성공, `clones` 테이블에 `inferred_traits` 컬럼 추가 확인

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260412000004_inferred_traits.sql
git commit -m "feat(db): add inferred_traits jsonb column to clones"
```

---

## Task 2: 타입 + 상수 + 검증 스키마

**Files:**
- Create: `src/types/onboarding.ts`
- Create: `src/lib/constants/onboardingQuestions.ts`
- Create: `src/lib/validation/onboarding.ts`
- Modify: `src/types/persona.ts`

- [ ] **Step 1: 온보딩 타입 정의**

```ts
// src/types/onboarding.ts

export interface OnboardingQuestion {
  id: string
  type: 'scenario' | 'choice'
  text: string
  choices?: { id: string; label: string }[]
  inferTargets: string[]
}

export interface OnboardingAnswer {
  questionId: string
  /** scenario: 자유 텍스트, choice: 선택지 id */
  value: string
}

export interface InferredTraits {
  personality_summary: string
  communication_tendency: string
  social_style: string
  value_priorities: string[]
  conflict_style: string
  energy_pattern: string
  conversation_topics: string[]
  raw_answers: Record<string, string>
}
```

- [ ] **Step 2: 질문 세트 데이터 정의**

```ts
// src/lib/constants/onboardingQuestions.ts
import type { OnboardingQuestion } from '@/types/onboarding'

export const ONBOARDING_QUESTIONS: readonly OnboardingQuestion[] = [
  // 시나리오 반응형 (3문항)
  {
    id: 'scenario_canceled_plans',
    type: 'scenario',
    text: '금요일 저녁, 친구가 갑자기 약속을 취소했어요. 어떻게 보내실 것 같아요?',
    inferTargets: ['personality_summary', 'energy_pattern', 'social_style'],
  },
  {
    id: 'scenario_friend_disagree',
    type: 'scenario',
    text: '친한 친구가 당신이 동의하지 않는 결정을 내렸어요. 어떻게 하실 것 같아요?',
    inferTargets: ['conflict_style', 'value_priorities', 'communication_tendency'],
  },
  {
    id: 'scenario_great_conversation',
    type: 'scenario',
    text: '처음 만난 사람과 대화가 잘 통하고 있어요. 어떤 주제일 때 가장 신나요?',
    inferTargets: ['conversation_topics', 'communication_tendency', 'social_style'],
  },
  // 선택지 퀴즈 (4문항)
  {
    id: 'choice_thinking_style',
    type: 'choice',
    text: '대화할 때 당신에 더 가까운 쪽은?',
    choices: [
      { id: 'think_first', label: '생각을 정리한 다음 말한다' },
      { id: 'think_while_talking', label: '말하면서 생각을 정리한다' },
    ],
    inferTargets: ['communication_tendency'],
  },
  {
    id: 'choice_ideal_weekend',
    type: 'choice',
    text: '주말 이상적인 하루는?',
    choices: [
      { id: 'home', label: '집에서 넷플릭스' },
      { id: 'cafe', label: '카페에서 작업' },
      { id: 'friends', label: '친구들과 외출' },
      { id: 'explore', label: '새로운 장소 탐험' },
    ],
    inferTargets: ['energy_pattern', 'social_style'],
  },
  {
    id: 'choice_conflict',
    type: 'choice',
    text: '갈등이 생겼을 때?',
    choices: [
      { id: 'direct', label: '바로 이야기한다' },
      { id: 'process', label: '시간을 두고 정리한 뒤 이야기한다' },
      { id: 'wait', label: '상대가 먼저 꺼내길 기다린다' },
    ],
    inferTargets: ['conflict_style'],
  },
  {
    id: 'choice_social_energy',
    type: 'choice',
    text: '모임이 끝난 후 기분은?',
    choices: [
      { id: 'energized', label: '에너지가 충전된 느낌' },
      { id: 'drained', label: '즐겁지만 혼자 시간이 필요함' },
      { id: 'depends', label: '사람에 따라 다름' },
    ],
    inferTargets: ['personality_summary', 'energy_pattern'],
  },
] as const
```

- [ ] **Step 3: Zod 검증 스키마 작성**

```ts
// src/lib/validation/onboarding.ts
import { z } from 'zod'

export const onboardingAnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.string().min(1).max(1000),
})

export const submitOnboardingSchema = z.object({
  answers: z.array(onboardingAnswerSchema).min(1).max(20),
})

export type SubmitOnboardingInput = z.infer<typeof submitOnboardingSchema>
```

- [ ] **Step 4: `Clone` 타입에 `inferred_traits` 추가**

`src/types/persona.ts`의 `Clone` 인터페이스에 추가:

```ts
// Clone 인터페이스 내, public_fields 다음에 추가
  inferred_traits: InferredTraits | null
```

파일 상단에 import 추가:
```ts
import type { InferredTraits } from './onboarding'
```

또는 `InferredTraits`를 `persona.ts`에서 re-export. 순환 의존 방지를 위해 `onboarding.ts`에서 정의하고 `persona.ts`에서 import.

- [ ] **Step 5: 커밋**

```bash
git add src/types/onboarding.ts src/lib/constants/onboardingQuestions.ts src/lib/validation/onboarding.ts src/types/persona.ts
git commit -m "feat: add onboarding types, questions, and validation schema"
```

---

## Task 3: 추론 프롬프트 + 파싱 순수 함수 (TDD)

**Files:**
- Create: `src/lib/prompts/onboarding.ts`
- Create: `src/lib/onboarding/extract.ts`
- Create: `src/lib/onboarding/extract.test.ts`

- [ ] **Step 1: 추론 프롬프트 템플릿 작성**

```ts
// src/lib/prompts/onboarding.ts
import type { OnboardingAnswer } from '@/types/onboarding'
import { ONBOARDING_QUESTIONS } from '@/lib/constants/onboardingQuestions'

export function buildTraitsInferencePrompt(answers: OnboardingAnswer[]): string {
  const qaParts = answers.map((a) => {
    const q = ONBOARDING_QUESTIONS.find((q) => q.id === a.questionId)
    if (!q) return ''

    if (q.type === 'choice') {
      const chosen = q.choices?.find((c) => c.id === a.value)
      return `질문: ${q.text}\n답변: ${chosen?.label ?? a.value}`
    }
    return `질문: ${q.text}\n답변: ${a.value}`
  }).filter(Boolean).join('\n\n')

  return `아래는 한 사람이 성격 파악 질문에 답한 내용입니다.

${qaParts}

이 사람의 행동 패턴을 분석해 아래 JSON 형식으로만 응답하세요. 다른 설명 금지.

{
  "personality_summary": "<1-2문장. 핵심 성격 특성>",
  "communication_tendency": "<1문장. 대화/소통 스타일>",
  "social_style": "<1문장. 사회적 에너지 패턴>",
  "value_priorities": ["<중요 가치 3-5개>"],
  "conflict_style": "<1문장. 갈등 대처 방식>",
  "energy_pattern": "<1문장. 에너지 충전/소모 패턴>",
  "conversation_topics": ["<대화 시 즐기는 주제 3-5개>"]
}

규칙:
- 응답에서 직접 드러난 것만 기술. 과도한 추론 금지.
- 한국어로 자연스럽게 서술. "~하는 편", "~인 경향" 같은 톤.
- value_priorities와 conversation_topics는 string 배열.`
}
```

- [ ] **Step 2: 파싱 테스트 작성 (실패 확인)**

```ts
// src/lib/onboarding/extract.test.ts
import { describe, it, expect } from 'vitest'
import { parseTraitsInference } from './extract'

describe('parseTraitsInference', () => {
  it('유효한 추론 결과를 파싱한다', () => {
    const raw = {
      personality_summary: '내향적이면서 호기심이 많은 편',
      communication_tendency: '생각을 정리한 후 말하는 편',
      social_style: '소수와 깊게 사귀는 스타일',
      value_priorities: ['진정성', '자율성'],
      conflict_style: '시간을 두고 정리하는 편',
      energy_pattern: '혼자 시간으로 충전',
      conversation_topics: ['영화', '심리학'],
    }
    const result = parseTraitsInference(raw)
    expect(result.personality_summary).toBe('내향적이면서 호기심이 많은 편')
    expect(result.value_priorities).toEqual(['진정성', '자율성'])
    expect(result.conversation_topics).toEqual(['영화', '심리학'])
  })

  it('personality_summary 누락 시 에러', () => {
    expect(() => parseTraitsInference({ communication_tendency: 'x' })).toThrow()
  })

  it('value_priorities가 배열이 아니면 빈 배열로 폴백', () => {
    const raw = {
      personality_summary: 'test',
      communication_tendency: 'test',
      social_style: 'test',
      value_priorities: 'not array',
      conflict_style: 'test',
      energy_pattern: 'test',
      conversation_topics: [],
    }
    const result = parseTraitsInference(raw)
    expect(result.value_priorities).toEqual([])
  })

  it('conversation_topics가 배열이 아니면 빈 배열로 폴백', () => {
    const raw = {
      personality_summary: 'test',
      communication_tendency: 'test',
      social_style: 'test',
      value_priorities: [],
      conflict_style: 'test',
      energy_pattern: 'test',
      conversation_topics: 'not array',
    }
    const result = parseTraitsInference(raw)
    expect(result.conversation_topics).toEqual([])
  })
})
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run src/lib/onboarding/extract.test.ts`
Expected: FAIL — `parseTraitsInference` 없음

- [ ] **Step 4: 파싱 함수 구현**

```ts
// src/lib/onboarding/extract.ts
import { errors } from '@/lib/errors'

export interface ParsedTraits {
  personality_summary: string
  communication_tendency: string
  social_style: string
  value_priorities: string[]
  conflict_style: string
  energy_pattern: string
  conversation_topics: string[]
}

const REQUIRED_STRING_FIELDS = [
  'personality_summary',
  'communication_tendency',
  'social_style',
  'conflict_style',
  'energy_pattern',
] as const

export function parseTraitsInference(raw: unknown): ParsedTraits {
  if (typeof raw !== 'object' || raw === null) {
    throw errors.validation('추론 결과가 객체가 아닙니다')
  }
  const obj = raw as Record<string, unknown>

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof obj[field] !== 'string' || obj[field] === '') {
      throw errors.validation(`${field} 필드가 없거나 빈 문자열입니다`)
    }
  }

  const value_priorities = Array.isArray(obj.value_priorities)
    ? obj.value_priorities.filter((v): v is string => typeof v === 'string')
    : []

  const conversation_topics = Array.isArray(obj.conversation_topics)
    ? obj.conversation_topics.filter((v): v is string => typeof v === 'string')
    : []

  return {
    personality_summary: obj.personality_summary as string,
    communication_tendency: obj.communication_tendency as string,
    social_style: obj.social_style as string,
    value_priorities,
    conflict_style: obj.conflict_style as string,
    energy_pattern: obj.energy_pattern as string,
    conversation_topics,
  }
}
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run src/lib/onboarding/extract.test.ts`
Expected: 4 tests PASS

- [ ] **Step 6: 커밋**

```bash
git add src/lib/prompts/onboarding.ts src/lib/onboarding/extract.ts src/lib/onboarding/extract.test.ts
git commit -m "feat: add onboarding inference prompt and traits parsing with tests"
```

---

## Task 4: 추론 서비스 + Config

**Files:**
- Create: `src/lib/onboarding/service.ts`
- Modify: `src/lib/config/claude.ts`

- [ ] **Step 1: Claude config에 온보딩 모델/토큰 추가**

`src/lib/config/claude.ts` 수정:

`CLAUDE_MODELS`에 추가:
```ts
  ONBOARDING: 'claude-haiku-4-5-20251001',
```

`CLAUDE_LIMITS`에 추가:
```ts
  MAX_OUTPUT_TOKENS_ONBOARDING: 512,
```

- [ ] **Step 2: 추론 서비스 작성**

```ts
// src/lib/onboarding/service.ts
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
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/onboarding/service.ts src/lib/config/claude.ts
git commit -m "feat: add onboarding inference service with Haiku"
```

---

## Task 5: 온보딩 API 엔드포인트

**Files:**
- Create: `src/app/api/clones/[id]/onboarding/route.ts`

- [ ] **Step 1: API 라우트 작성**

```ts
// src/app/api/clones/[id]/onboarding/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitOnboardingSchema } from '@/lib/validation/onboarding'
import { inferAndStoreTraits } from '@/lib/onboarding/service'
import { errors, AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status }
    )
  }
  console.error('Unhandled error:', err)
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: '서버 오류' } },
    { status: 500 }
  )
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    // 본인 Clone인지 확인
    const { data: clone, error: cloneErr } = await supabase
      .from('clones')
      .select('id, user_id')
      .eq('id', id)
      .single()
    if (cloneErr || !clone) throw errors.notFound('Clone')
    if (clone.user_id !== user.id) throw errors.forbidden()

    const body = await request.json()
    const parsed = submitOnboardingSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('온보딩 응답이 유효하지 않습니다', parsed.error.flatten())
    }

    const inferredTraits = await inferAndStoreTraits(id, parsed.data.answers)

    return NextResponse.json({ ok: true, inferredTraits })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/clones/[id]/onboarding/route.ts
git commit -m "feat: add POST /api/clones/[id]/onboarding endpoint"
```

---

## Task 6: System Prompt 주입 — `renderInferredTraits`

**Files:**
- Modify: `src/lib/prompts/persona.ts`
- Create: `src/lib/prompts/persona.inferred.test.ts`
- Modify: `src/lib/interaction/orchestrate.ts`

- [ ] **Step 1: 렌더링 테스트 작성 (실패 확인)**

```ts
// src/lib/prompts/persona.inferred.test.ts
import { describe, it, expect } from 'vitest'
import { renderInferredTraits } from './persona'

describe('renderInferredTraits', () => {
  it('모든 필드를 렌더링한다', () => {
    const traits = {
      personality_summary: '내향적이면서 호기심이 많은 편',
      communication_tendency: '생각을 정리한 후 말하는 편',
      social_style: '소수와 깊게',
      value_priorities: ['진정성', '자율성'],
      conflict_style: '시간을 두고 정리하는 편',
      energy_pattern: '혼자 시간으로 충전',
      conversation_topics: ['영화', '심리학'],
      raw_answers: {},
    }
    const result = renderInferredTraits(traits)
    expect(result).toContain('내향적이면서 호기심이 많은 편')
    expect(result).toContain('진정성, 자율성')
    expect(result).toContain('영화, 심리학')
    expect(result).not.toContain('raw_answers')
  })

  it('null이면 빈 문자열', () => {
    expect(renderInferredTraits(null)).toBe('')
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run src/lib/prompts/persona.inferred.test.ts`
Expected: FAIL — `renderInferredTraits` 없음

- [ ] **Step 3: `renderInferredTraits` 구현 + `EnhancedPromptInput` 확장**

`src/lib/prompts/persona.ts`에 추가:

import 추가 (파일 상단):
```ts
import type { InferredTraits } from '@/types/onboarding'
```

함수 추가 (`renderRecentMemories` 다음):
```ts
export function renderInferredTraits(traits: InferredTraits | null): string {
  if (!traits) return ''

  const lines = [
    '[AI가 파악한 성격 패턴]',
    `- 성격: ${traits.personality_summary}`,
    `- 소통: ${traits.communication_tendency}`,
    `- 사회적 스타일: ${traits.social_style}`,
  ]

  if (traits.value_priorities.length > 0) {
    lines.push(`- 가치관 우선순위: ${traits.value_priorities.join(', ')}`)
  }

  lines.push(`- 갈등 대처: ${traits.conflict_style}`)
  lines.push(`- 에너지 패턴: ${traits.energy_pattern}`)

  if (traits.conversation_topics.length > 0) {
    lines.push(`- 대화 시 즐기는 주제: ${traits.conversation_topics.join(', ')}`)
  }

  return lines.join('\n')
}
```

`EnhancedPromptInput` 인터페이스에 필드 추가:
```ts
  inferredTraits?: InferredTraits | null
```

`buildEnhancedSystemPrompt` 함수 내부, persona core 렌더링 다음에 추가:
```ts
  // 3. Inferred traits
  if (input.inferredTraits) {
    const rendered = renderInferredTraits(input.inferredTraits)
    if (rendered) parts.push(rendered)
  }
```

(기존 주석 번호 3~7을 4~8로 밀기)

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run src/lib/prompts/persona.inferred.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: `orchestrate.ts`에서 `inferred_traits` 전달**

`src/lib/interaction/orchestrate.ts`의 `prepareClonePrompts` 함수 내부, `buildEnhancedSystemPrompt` 호출 부분 수정:

```ts
    const systemPrompt = buildEnhancedSystemPrompt({
      persona,
      memories,
      inferredTraits: clone.inferred_traits ?? null,
      textureRules: TEXTURE_RULES,
      styleCards,
      mood,
      worldSnippet,
    })
```

`clone.inferred_traits`에 접근하려면 `Clone` 타입에 이미 필드를 추가했으므로 타입 에러 없음.

- [ ] **Step 6: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: 기존 테스트 + 신규 테스트 모두 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/prompts/persona.ts src/lib/prompts/persona.inferred.test.ts src/lib/interaction/orchestrate.ts
git commit -m "feat: inject inferred_traits into system prompt"
```

---

## Task 7: 온보딩 UI 컴포넌트

**Files:**
- Create: `src/components/onboarding/OnboardingCard.tsx`
- Create: `src/components/onboarding/TraitsPreview.tsx`
- Create: `src/components/onboarding/OnboardingFlow.tsx`

- [ ] **Step 1: 단일 질문 카드 컴포넌트**

```tsx
// src/components/onboarding/OnboardingCard.tsx
'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { OnboardingQuestion } from '@/types/onboarding'

interface OnboardingCardProps {
  question: OnboardingQuestion
  value: string
  onChange: (value: string) => void
  onNext: () => void
  canNext: boolean
  current: number
  total: number
}

export function OnboardingCard({
  question,
  value,
  onChange,
  onNext,
  canNext,
  current,
  total,
}: OnboardingCardProps) {
  return (
    <Card className="mx-auto max-w-lg p-6">
      {/* 진행 바 */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{current} / {total}</span>
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      </div>

      <p className="mb-6 text-lg font-medium">{question.text}</p>

      {question.type === 'scenario' ? (
        <textarea
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          rows={4}
          placeholder="자유롭게 답변해 주세요..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {question.choices?.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                value === c.id
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-border hover:bg-muted'
              }`}
              onClick={() => onChange(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={!canNext}>
          {current === total ? '분석하기' : '다음'}
        </Button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: 추론 결과 프리뷰 컴포넌트**

```tsx
// src/components/onboarding/TraitsPreview.tsx
'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { InferredTraits } from '@/types/onboarding'

interface TraitsPreviewProps {
  traits: InferredTraits
  onConfirm: () => void
  onRetry: () => void
  confirming: boolean
}

export function TraitsPreview({ traits, onConfirm, onRetry, confirming }: TraitsPreviewProps) {
  const rows = [
    { label: '성격', value: traits.personality_summary },
    { label: '소통 스타일', value: traits.communication_tendency },
    { label: '사회적 스타일', value: traits.social_style },
    { label: '가치관', value: traits.value_priorities.join(', ') },
    { label: '갈등 대처', value: traits.conflict_style },
    { label: '에너지 패턴', value: traits.energy_pattern },
    { label: '관심 대화 주제', value: traits.conversation_topics.join(', ') },
  ]

  return (
    <Card className="mx-auto max-w-lg p-6">
      <h2 className="mb-4 text-lg font-semibold">AI가 파악한 당신의 성격</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <span className="text-sm font-medium text-muted-foreground">{r.label}</span>
            <p className="text-sm">{r.value || '-'}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={onRetry} disabled={confirming}>
          다시 하기
        </Button>
        <Button onClick={onConfirm} disabled={confirming}>
          {confirming ? '저장 중...' : '확인'}
        </Button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: 전체 플로우 컴포넌트**

```tsx
// src/components/onboarding/OnboardingFlow.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ONBOARDING_QUESTIONS } from '@/lib/constants/onboardingQuestions'
import { OnboardingCard } from './OnboardingCard'
import { TraitsPreview } from './TraitsPreview'
import type { OnboardingAnswer, InferredTraits } from '@/types/onboarding'

type Phase = 'questions' | 'analyzing' | 'preview'

interface OnboardingFlowProps {
  cloneId: string
}

export function OnboardingFlow({ cloneId }: OnboardingFlowProps) {
  const router = useRouter()
  const questions = ONBOARDING_QUESTIONS
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [phase, setPhase] = useState<Phase>('questions')
  const [traits, setTraits] = useState<InferredTraits | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const currentQ = questions[currentIndex]
  const currentValue = answers.get(currentQ?.id ?? '') ?? ''

  function handleChange(value: string) {
    setAnswers((prev) => new Map(prev).set(currentQ.id, value))
  }

  async function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1)
      return
    }
    // 마지막 질문 → 분석
    setPhase('analyzing')
    setError(null)
    try {
      const answerList: OnboardingAnswer[] = Array.from(answers.entries()).map(
        ([questionId, value]) => ({ questionId, value })
      )
      const res = await fetch(`/api/clones/${cloneId}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerList }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? '분석 실패')
      }
      const { inferredTraits } = await res.json()
      setTraits(inferredTraits)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
      setPhase('questions')
    }
  }

  function handleRetry() {
    setCurrentIndex(0)
    setAnswers(new Map())
    setTraits(null)
    setPhase('questions')
  }

  function handleConfirm() {
    setConfirming(true)
    // traits는 이미 API에서 저장됨 → 바로 이동
    router.push(`/clones/${cloneId}`)
  }

  if (phase === 'analyzing') {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mb-4 text-2xl">분석 중...</div>
        <p className="text-sm text-muted-foreground">응답을 분석하고 있습니다</p>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  if (phase === 'preview' && traits) {
    return (
      <TraitsPreview
        traits={traits}
        onConfirm={handleConfirm}
        onRetry={handleRetry}
        confirming={confirming}
      />
    )
  }

  return (
    <>
      <OnboardingCard
        question={currentQ}
        value={currentValue}
        onChange={handleChange}
        onNext={handleNext}
        canNext={currentValue.length > 0}
        current={currentIndex + 1}
        total={questions.length}
      />
      {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
    </>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/onboarding/
git commit -m "feat: add onboarding UI components (card, preview, flow)"
```

---

## Task 8: 온보딩 페이지 + 기존 페이지 수정

**Files:**
- Create: `src/app/clones/[id]/onboarding/page.tsx`
- Modify: `src/app/clones/new/page.tsx`
- Modify: `src/app/clones/[id]/page.tsx`

- [ ] **Step 1: 온보딩 페이지 작성**

```tsx
// src/app/clones/[id]/onboarding/page.tsx
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import Link from 'next/link'

export default async function OnboardingPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">성격 파악 퀴즈</h1>
          <p className="text-sm text-muted-foreground">
            간단한 질문에 답하면 AI가 성격 패턴을 분석합니다 (2-3분)
          </p>
        </div>
        <Link
          href={`/clones/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          나중에 하기
        </Link>
      </header>
      <OnboardingFlow cloneId={id} />
    </main>
  )
}
```

- [ ] **Step 2: Clone 생성 후 온보딩으로 리다이렉트**

`src/app/clones/new/page.tsx`의 `handleSubmit` 내 `router.push` 수정:

기존:
```ts
      router.push(`/clones/${clone.id}`)
```

변경:
```ts
      router.push(`/clones/${clone.id}/onboarding`)
```

- [ ] **Step 3: Clone 상세 페이지에 추론 traits 섹션 + CTA 배너 추가**

`src/app/clones/[id]/page.tsx` 수정. 기존 코드를 읽어서 적절한 위치에 추가해야 함.

Clone 데이터를 이미 fetch하는 부분 이후에:
- `clone.inferred_traits`가 있으면 traits 섹션 표시
- 없으면 "성격 파악 퀴즈를 해보세요" CTA 배너 표시
- 본인 Clone일 때만 "온보딩 다시하기" 링크 표시

이 부분은 기존 페이지 구조에 맞춰 구현. 핵심 JSX:

```tsx
{/* Inferred Traits 섹션 */}
{isOwner && !clone.inferred_traits && (
  <Card className="border-dashed p-4">
    <p className="text-sm text-muted-foreground">
      성격 파악 퀴즈를 하면 AI가 더 정확하게 대화합니다
    </p>
    <Link href={`/clones/${clone.id}/onboarding`}>
      <Button variant="outline" size="sm" className="mt-2">퀴즈 시작</Button>
    </Link>
  </Card>
)}
{clone.inferred_traits && (
  <section className="space-y-2">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">AI가 파악한 성격</h2>
      {isOwner && (
        <Link href={`/clones/${clone.id}/onboarding`} className="text-sm text-muted-foreground hover:underline">
          다시 하기
        </Link>
      )}
    </div>
    {/* traits 렌더링 — TraitsPreview와 비슷하지만 읽기 전용 */}
  </section>
)}
```

- [ ] **Step 4: 브라우저에서 테스트**

Run: `cd frontend && npm run dev`

1. `/clones/new`에서 Clone 생성 → `/clones/[id]/onboarding`으로 이동 확인
2. 7개 질문 답변 → "분석 중..." → 프리뷰 표시 확인
3. "확인" → `/clones/[id]`로 이동, traits 섹션 표시 확인
4. "나중에 하기" → `/clones/[id]`로 이동, CTA 배너 표시 확인
5. "다시 하기" → 온보딩 재진행 확인

- [ ] **Step 5: 커밋**

```bash
git add src/app/clones/[id]/onboarding/page.tsx src/app/clones/new/page.tsx src/app/clones/[id]/page.tsx
git commit -m "feat: add onboarding page + redirect from clone creation + traits display"
```

---

## Task 9: 전체 통합 테스트 + 정리

- [ ] **Step 1: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: 기존 + 신규 테스트 모두 PASS

- [ ] **Step 2: 타입 체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 수동 E2E 검증**

Dev 서버에서:
1. 새 Clone 생성 → 온보딩 → 완료 → 상세에서 traits 확인
2. 해당 Clone으로 Interaction 실행 → system prompt에 inferred_traits가 주입되었는지 서버 로그 확인
3. 온보딩 스킵 → 상세에서 CTA 배너 확인
4. 온보딩 다시하기 → 기존 traits 덮어쓰기 확인

- [ ] **Step 4: PROJECT_STATE.md 업데이트 + 커밋**

```bash
git add docs/PROJECT_STATE.md
git commit -m "docs: update PROJECT_STATE for Phase 2-A onboarding"
```
