# Plan 5: Memory + Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 마지막 기능 완성 — (a) Clone 에 에피소드 메모리를 자연어로 추가·조회, (b) 완료된 Interaction 의 호환성 분석 리포트 생성·조회. Plan 4에서 만든 Interaction 루프가 생성한 대화를 "해석" 하는 레이어.

**Architecture:**
- **메모리 파이프라인**: 사용자가 자유 텍스트 입력 → Haiku 호출로 `{kind, content, tags, occurred_at}` 구조 추출 → `clone_memories` INSERT → Clone 상세 페이지 타임라인에 즉시 노출. Plan 1의 `parseMemoryExtraction` / `normalizeOccurredAt` 순수 함수 재사용.
- **분석 파이프라인**: 완료된 Interaction 에서 "분석 보기" 클릭 → Sonnet 호출 → `buildAnalysisPrompt` 로 조립한 프롬프트 → `parseAnalysisReport` 검증 → `analyses` INSERT. 캐시 → 같은 interaction 재요청하면 기존 analysis 반환.
- **UI**: Clone 상세에 Memory 입력 박스 + 타임라인 추가. Interaction 뷰어의 "Plan 5에서 활성화됩니다" 자리를 "분석 보기" 버튼으로 교체. 분석 리포트는 `/analyses/[id]` 전용 페이지.

**Tech Stack:**
- Next.js 16 (App Router), Vercel Fluid Compute
- @anthropic-ai/sdk (claude-haiku-4-5-20251001 for extraction, claude-sonnet-4-6 for analysis)
- Supabase (service role for writes to `clone_memories` / `analyses`)
- shadcn/ui (Card, Textarea, Button, AlertDialog, Progress)
- Zod v4 (입력 검증)
- Vitest (순수 함수는 Plan 1에서 이미 완료, 신규 테스트 최소)

---

## Non-Goals (이 Plan 범위 외)

- **메모리 자동 요약 (compaction)** — Phase 2
- **메모리 편집/삭제 UI** — 나중 (지금은 추가만)
- **메모리 relevance 재계산** — Phase 2
- **분석 결과 공유·export** — Phase 2
- **여러 분석 재생성 비교** — 1 interaction = 1 analysis (캐시)
- **민감 정보 toggle UI** — Phase 2
- **토큰 단위 스트리밍** — Phase 2

---

## Prerequisites (확인 후 시작)

- ✅ `plan4-interaction-complete` 태그 존재
- ✅ `frontend/.env.local` 에 `ANTHROPIC_API_KEY` 설정 + Vercel 환경변수에도 설정
- ✅ Supabase `clone_memories`, `analyses` 테이블 migration 적용됨 (Plan 2)
- ✅ Plan 1 순수 함수 존재: `lib/memory/extract.ts`, `lib/analysis/parse.ts`, `lib/analysis/prompt.ts`
- ✅ Plan 4 RLS 수정 migration 적용됨 (`interaction_is_mine` 헬퍼)

---

## Design Highlights

### 메모리 kind 4종
```ts
'event'              // "오늘 영화 봤어"
'mood'               // "요즘 좀 지쳤음"
'fact'               // "고양이 키우기 시작함"
'preference_update'  // "이제 매운 음식 별로"
```

### 메모리 추출 프롬프트 (Haiku, JSON mode)
```
<user_input>{raw}</user_input>
<current_date>{now.toISOString().slice(0,10)}</current_date>

사용자가 방금 자신(또는 자신의 클론)에 대해 쓴 짧은 자연어 메모입니다. 다음 JSON 형식으로만 응답하세요:

{
  "kind": "event" | "mood" | "fact" | "preference_update",
  "content": "<1-2 문장으로 정리한 본문>",
  "tags": ["<관련 태그 0-5개>"],
  "occurred_at": "<YYYY-MM-DD 또는 '오늘'·'어제' 같은 상대 표현>"
}

규칙:
- kind는 내용의 성격에 맞게 판단
- content는 1인칭 과거형·현재형으로 정리
- occurred_at은 명시가 없으면 "오늘"
- tags는 핵심 키워드만. 없으면 []
```

`normalizeOccurredAt(raw, now)` 이 상대 표현을 ISO 날짜로 변환 (Plan 1에서 구현됨).

### 분석 파이프라인 (캐시)
1. `POST /api/analyses` 요청 수신
2. `analyses` 테이블에서 `interaction_id` 로 기존 레코드 조회
3. 있으면 그대로 반환 (재생성 없음 → 비용 절약)
4. 없으면 Sonnet 호출 → parse → INSERT → 반환

### 분석 UI 레이아웃
```
총점: 87 / 100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[카드] 대화 흐름         78 ■■■■■■■■░░
       코멘트...

[카드] 공통 관심사       91 ■■■■■■■■■■
       코멘트...

...

요약: 2-3 문장
추천: 계속 대화 / 잠시 쉬기 / 종료
```

---

## 파일 구조

```
frontend/src/
├── lib/
│   ├── prompts/
│   │   ├── memory.ts                (NEW — 추출 프롬프트 템플릿 함수)
│   │   └── memory.test.ts           (NEW — 프롬프트 포함 필드 assertion)
│   ├── memory/
│   │   └── service.ts               (NEW — Haiku 호출 + parse + insert 오케스트레이션)
│   └── analysis/
│       └── service.ts               (NEW — Sonnet 호출 + parse + insert + 캐시)
│
├── lib/validation/
│   ├── memory.ts                    (NEW — Zod createMemorySchema)
│   └── analysis.ts                  (NEW — Zod createAnalysisSchema)
│
├── app/api/
│   ├── memories/route.ts            (NEW — POST create, GET list ?cloneId=)
│   └── analyses/
│       ├── route.ts                 (NEW — POST create-or-fetch)
│       └── [id]/route.ts            (NEW — GET by id)
│
├── app/
│   ├── clones/[id]/page.tsx         (MODIFY — 메모리 섹션 추가)
│   └── analyses/[id]/page.tsx       (NEW — 분석 리포트 페이지)
│
├── components/
│   ├── memory/
│   │   ├── MemoryInputBox.tsx       (NEW — 클라이언트, POST 호출)
│   │   ├── MemoryTimeline.tsx       (NEW — 서버, 리스트 렌더)
│   │   └── MemoryItem.tsx           (NEW — 단일 아이템 카드)
│   ├── analysis/
│   │   ├── AnalysisGenerateButton.tsx   (NEW — 뷰어에서 호출)
│   │   ├── AnalysisReport.tsx       (NEW — 점수·카테고리·요약 렌더)
│   │   ├── CategoryCard.tsx         (NEW — 카테고리별 카드)
│   │   └── ScoreBar.tsx             (NEW — 바 형태 점수 시각화)
│   └── interaction/
│       └── InteractionViewer.tsx    (MODIFY — 완료 섹션에 AnalysisGenerateButton 또는 링크)
│
└── types/                           (already has CloneMemory, Analysis — 변경 없음)
```

---

## 작업 그룹 개요

| Group | 주제 | 의존성 | 병렬 |
|---|---|---|---|
| A | Memory extraction 프롬프트 + service + API + validation | — | A, C 병렬 가능 |
| B | Memory UI (입력 박스 + 타임라인) + Clone 상세 통합 | A | B, D 병렬 가능 (C 완료 후) |
| C | Analysis service + API + validation | — | A, C 병렬 가능 |
| D | Analysis UI (분석 페이지 + 리포트 렌더) + Viewer 통합 | C | B, D 병렬 가능 |
| E | 프로덕션 E2E 검증 + Phase 1 마무리 | B, D | — |

실행 흐름: **A + C 병렬 → B + D 병렬 → E (메인 세션 수동 검증)**

---

## Group A — Memory Extraction Service + API

### Task A.1: Memory 추출 프롬프트 템플릿

**Files:**
- Create: `frontend/src/lib/prompts/memory.ts`
- Create: `frontend/src/lib/prompts/memory.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/src/lib/prompts/memory.test.ts
import { describe, it, expect } from 'vitest'
import { buildMemoryExtractionPrompt } from './memory'

describe('buildMemoryExtractionPrompt', () => {
  it('사용자 입력이 포함되어야 한다', () => {
    const out = buildMemoryExtractionPrompt('오늘 영화 봤어', new Date('2026-04-12'))
    expect(out).toContain('오늘 영화 봤어')
  })

  it('현재 날짜 ISO 형식이 포함되어야 한다', () => {
    const out = buildMemoryExtractionPrompt('안녕', new Date('2026-04-12'))
    expect(out).toContain('2026-04-12')
  })

  it('허용 kind 4개가 명시되어야 한다', () => {
    const out = buildMemoryExtractionPrompt('test', new Date())
    expect(out).toContain('event')
    expect(out).toContain('mood')
    expect(out).toContain('fact')
    expect(out).toContain('preference_update')
  })

  it('JSON 형식 강제 지시가 포함되어야 한다', () => {
    const out = buildMemoryExtractionPrompt('test', new Date())
    expect(out.toLowerCase()).toContain('json')
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
cd frontend && npm run test:run -- memory
```
Expected: `Cannot find module './memory'` 류 FAIL

- [ ] **Step 3: 구현**

```ts
// frontend/src/lib/prompts/memory.ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npm run test:run -- memory
```
Expected: 4 passed

---

### Task A.2: Memory 생성 Zod 스키마

**Files:**
- Create: `frontend/src/lib/validation/memory.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/validation/memory.ts
import { z } from 'zod'

export const createMemorySchema = z.object({
  cloneId: z.string().min(1),
  rawText: z.string().min(1).max(2000),
})

export type CreateMemoryInput = z.infer<typeof createMemorySchema>
```

- [ ] **Step 2: typecheck**

```bash
cd frontend && npm run typecheck
```
Expected: 에러 없음

---

### Task A.3: Memory service (Claude 호출 + parse + insert)

**Files:**
- Create: `frontend/src/lib/memory/service.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/memory/service.ts
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

  let parsed
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
```

- [ ] **Step 2: typecheck**

---

### Task A.4: `POST /api/memories` + `GET /api/memories?cloneId=`

**Files:**
- Create: `frontend/src/app/api/memories/route.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/app/api/memories/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMemorySchema } from '@/lib/validation/memory'
import { extractAndStoreMemory } from '@/lib/memory/service'
import { errors, AppError } from '@/lib/errors'
import type { Clone } from '@/types/persona'

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

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const cloneId = new URL(request.url).searchParams.get('cloneId')
    if (!cloneId) throw errors.validation('cloneId 쿼리 필요')

    // 소유권 검사: 내 Clone만 조회 가능
    const { data: clone } = await supabase
      .from('clones')
      .select('id, user_id, is_npc')
      .eq('id', cloneId)
      .maybeSingle<Pick<Clone, 'id' | 'user_id' | 'is_npc'>>()
    if (!clone) throw errors.notFound('Clone')
    if (clone.is_npc) throw errors.forbidden()
    if (clone.user_id !== user.id) throw errors.forbidden()

    const { data, error } = await supabase
      .from('clone_memories')
      .select('*')
      .eq('clone_id', cloneId)
      .order('occurred_at', { ascending: false })
      .limit(50)
    if (error) throw errors.validation(error.message)

    return NextResponse.json({ memories: data ?? [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const body = await request.json()
    const parsed = createMemorySchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    // 소유권 검사
    const { data: clone } = await supabase
      .from('clones')
      .select('id, user_id, is_npc')
      .eq('id', parsed.data.cloneId)
      .maybeSingle<Pick<Clone, 'id' | 'user_id' | 'is_npc'>>()
    if (!clone) throw errors.notFound('Clone')
    if (clone.is_npc) throw errors.forbidden()
    if (clone.user_id !== user.id) throw errors.forbidden()

    const memory = await extractAndStoreMemory(
      parsed.data.cloneId,
      parsed.data.rawText
    )

    return NextResponse.json({ memory })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: typecheck**

```bash
cd frontend && npm run typecheck
```

- [ ] **Step 3: Group A commit**

```bash
cd /Users/jh/dating
git add frontend/src/lib/prompts/memory.ts \
  frontend/src/lib/prompts/memory.test.ts \
  frontend/src/lib/validation/memory.ts \
  frontend/src/lib/memory/service.ts \
  frontend/src/app/api/memories/route.ts
git commit -m "feat(memory): extraction prompt, service, and API routes"
```

---

## Group C — Analysis Service + API (A와 병렬)

### Task C.1: Analysis Zod 스키마

**Files:**
- Create: `frontend/src/lib/validation/analysis.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/validation/analysis.ts
import { z } from 'zod'

export const createAnalysisSchema = z.object({
  interactionId: z.string().min(1),
})

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>
```

---

### Task C.2: Analysis service

**Files:**
- Create: `frontend/src/lib/analysis/service.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/analysis/service.ts
import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/config/claude'
import { buildAnalysisPrompt } from '@/lib/analysis/prompt'
import { parseAnalysisReport } from '@/lib/analysis/parse'
import { createServiceClient } from '@/lib/supabase/service'
import { errors, AppError } from '@/lib/errors'
import type { Analysis } from '@/types/analysis'
import type { InteractionEvent } from '@/types/interaction'
import type { Persona } from '@/types/persona'

interface GenerateInput {
  interactionId: string
  events: InteractionEvent[]
  personas: Map<string, Persona>
}

/**
 * 기존 analysis가 있으면 반환(캐시), 없으면 Sonnet 호출·저장.
 */
export async function generateOrFetchAnalysis(
  input: GenerateInput
): Promise<Analysis> {
  const admin = createServiceClient()

  // 캐시 확인
  const { data: existing } = await admin
    .from('analyses')
    .select('*')
    .eq('interaction_id', input.interactionId)
    .maybeSingle()
  if (existing) return existing as Analysis

  if (input.events.length === 0) {
    throw errors.validation('분석할 대화 내용이 없습니다')
  }

  const prompt = buildAnalysisPrompt(input.events, input.personas)

  const response = await callClaude({
    model: CLAUDE_MODELS.ANALYSIS,
    system: '당신은 두 사람의 대화를 분석해 호환성 리포트를 작성하는 분석가입니다. 결과는 정확한 JSON 형식으로만 출력하세요.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_ANALYSIS,
    temperature: 0.4,
  })

  let parsedJson
  try {
    const jsonStart = response.indexOf('{')
    const jsonEnd = response.lastIndexOf('}')
    if (jsonStart < 0 || jsonEnd < 0) {
      throw new Error('JSON 객체를 찾을 수 없음')
    }
    const jsonText = response.slice(jsonStart, jsonEnd + 1)
    parsedJson = JSON.parse(jsonText)
  } catch (err) {
    throw new AppError(
      'LLM_ERROR',
      `분석 응답 파싱 실패: ${(err as Error).message}`,
      502,
      { raw: response }
    )
  }

  const report = parseAnalysisReport(parsedJson)

  const { data, error } = await admin
    .from('analyses')
    .insert({
      interaction_id: input.interactionId,
      score: report.score,
      report_json: report,
      model: CLAUDE_MODELS.ANALYSIS,
    })
    .select()
    .single()
  if (error) throw errors.validation(error.message)

  return data as Analysis
}
```

- [ ] **Step 2: typecheck**

---

### Task C.3: `POST /api/analyses` + `GET /api/analyses/[id]`

**Files:**
- Create: `frontend/src/app/api/analyses/route.ts`
- Create: `frontend/src/app/api/analyses/[id]/route.ts`

- [ ] **Step 1: POST 라우트**

```ts
// frontend/src/app/api/analyses/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnalysisSchema } from '@/lib/validation/analysis'
import { generateOrFetchAnalysis } from '@/lib/analysis/service'
import { errors, AppError } from '@/lib/errors'
import type { Clone, Persona } from '@/types/persona'
import type { InteractionEvent } from '@/types/interaction'

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

export const maxDuration = 300

interface ParticipantRow {
  clone_id: string
  clones: Clone
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const body = await request.json()
    const parsed = createAnalysisSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    // 소유권 확인
    const { data: interaction } = await supabase
      .from('interactions')
      .select('id, created_by, status')
      .eq('id', parsed.data.interactionId)
      .maybeSingle()
    if (!interaction) throw errors.notFound('Interaction')
    if (interaction.created_by !== user.id) throw errors.forbidden()
    if (interaction.status !== 'completed') {
      throw errors.validation('완료된 Interaction만 분석할 수 있습니다')
    }

    // events + participants
    const { data: events } = await supabase
      .from('interaction_events')
      .select('*')
      .eq('interaction_id', parsed.data.interactionId)
      .order('turn_number', { ascending: true })

    const { data: participantRows } = await supabase
      .from('interaction_participants')
      .select('clone_id, clones(*)')
      .eq('interaction_id', parsed.data.interactionId)

    const participants =
      (participantRows as unknown as ParticipantRow[] | null)?.map(
        (r) => r.clones
      ) ?? []

    const personas = new Map<string, Persona>()
    for (const p of participants) personas.set(p.id, p.persona_json)

    const analysis = await generateOrFetchAnalysis({
      interactionId: parsed.data.interactionId,
      events: (events ?? []) as InteractionEvent[],
      personas,
    })

    return NextResponse.json({ analysis })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: GET by id 라우트**

```ts
// frontend/src/app/api/analyses/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errors, AppError } from '@/lib/errors'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status }
    )
  }
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: '서버 오류' } },
    { status: 500 }
  )
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: analysis } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!analysis) throw errors.notFound('Analysis')

    return NextResponse.json({ analysis })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 3: typecheck + Group C commit**

```bash
cd frontend && npm run typecheck
```

```bash
cd /Users/jh/dating
git add frontend/src/lib/validation/analysis.ts \
  frontend/src/lib/analysis/service.ts \
  frontend/src/app/api/analyses/
git commit -m "feat(analysis): service with cache + create/read API routes"
```

---

## Group B — Memory UI (A 완료 후)

### Task B.1: `MemoryInputBox` 클라이언트 컴포넌트

**Files:**
- Create: `frontend/src/components/memory/MemoryInputBox.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/memory/MemoryInputBox.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  cloneId: string
}

export function MemoryInputBox({ cloneId }: Props) {
  const router = useRouter()
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!raw.trim()) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloneId, rawText: raw.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? '추가 실패')
      setRaw('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="예: 오늘 영화 봤어. 해리포터 다시 봤는데 여전히 좋아."
        rows={3}
        className="resize-none"
        disabled={pending}
      />
      <div className="flex items-center justify-between">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="ml-auto">
          <Button type="submit" size="sm" disabled={pending || !raw.trim()}>
            {pending ? '추출 중...' : '메모리 추가'}
          </Button>
        </div>
      </div>
    </form>
  )
}
```

---

### Task B.2: `MemoryItem` + `MemoryTimeline`

**Files:**
- Create: `frontend/src/components/memory/MemoryItem.tsx`
- Create: `frontend/src/components/memory/MemoryTimeline.tsx`

- [ ] **Step 1: MemoryItem**

```tsx
// frontend/src/components/memory/MemoryItem.tsx
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CloneMemory, CloneMemoryKind } from '@/types/persona'

const KIND_LABELS: Record<CloneMemoryKind, string> = {
  event: '사건',
  mood: '기분',
  fact: '사실',
  preference_update: '취향',
}

const KIND_VARIANTS: Record<
  CloneMemoryKind,
  'default' | 'secondary' | 'outline'
> = {
  event: 'default',
  mood: 'secondary',
  fact: 'outline',
  preference_update: 'secondary',
}

export function MemoryItem({ memory }: { memory: CloneMemory }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{memory.occurred_at}</span>
        <Badge variant={KIND_VARIANTS[memory.kind]} className="text-[10px]">
          {KIND_LABELS[memory.kind]}
        </Badge>
      </div>
      <p className="text-sm leading-relaxed">{memory.content}</p>
      {memory.tags && memory.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {memory.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: MemoryTimeline**

```tsx
// frontend/src/components/memory/MemoryTimeline.tsx
import { Card } from '@/components/ui/card'
import { MemoryItem } from './MemoryItem'
import type { CloneMemory } from '@/types/persona'

export function MemoryTimeline({ memories }: { memories: CloneMemory[] }) {
  if (memories.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        아직 기록된 메모리가 없습니다. 위에서 하나 추가해보세요.
      </Card>
    )
  }
  return (
    <div className="space-y-2">
      {memories.map((m) => (
        <MemoryItem key={m.id} memory={m} />
      ))}
    </div>
  )
}
```

---

### Task B.3: Clone 상세 페이지 통합

**Files:**
- Modify: `frontend/src/app/clones/[id]/page.tsx`

- [ ] **Step 1: 기존 파일 읽기**

```bash
cat frontend/src/app/clones/\[id\]/page.tsx
```

- [ ] **Step 2: 메모리 섹션 추가**

다음을 추가:
- fetch: `clone_memories` WHERE `clone_id = id` 정렬 desc limit 50
- 페이지 하단 (ExpandablePersonaDetail 아래) 에 "메모리" 섹션:
  - `isOwner && <MemoryInputBox cloneId={clone.id} />` (NPC는 입력 불가)
  - `<MemoryTimeline memories={memories} />`

구체 edit:

파일 상단 import 추가:
```ts
import { MemoryInputBox } from '@/components/memory/MemoryInputBox'
import { MemoryTimeline } from '@/components/memory/MemoryTimeline'
import type { CloneMemory } from '@/types/persona'
```

`const isOwner = ...` 아래에 메모리 fetch:
```ts
const { data: memoriesData } = await supabase
  .from('clone_memories')
  .select('*')
  .eq('clone_id', id)
  .order('occurred_at', { ascending: false })
  .limit(50)
const memories = (memoriesData ?? []) as CloneMemory[]
```

`<ExpandablePersonaDetail />` 뒤에 섹션 추가:
```tsx
<section className="mt-8">
  <h2 className="mb-3 text-lg font-semibold">메모리</h2>
  {isOwner && (
    <div className="mb-4">
      <MemoryInputBox cloneId={clone.id} />
    </div>
  )}
  <MemoryTimeline memories={memories} />
</section>
```

- [ ] **Step 3: typecheck + commit**

```bash
cd frontend && npm run typecheck && npm run build
```

```bash
cd /Users/jh/dating
git add frontend/src/components/memory/ frontend/src/app/clones/\[id\]/page.tsx
git commit -m "feat(memory): input box and timeline on clone detail page"
```

---

## Group D — Analysis UI (C 완료 후)

### Task D.1: `ScoreBar` + `CategoryCard`

**Files:**
- Create: `frontend/src/components/analysis/ScoreBar.tsx`
- Create: `frontend/src/components/analysis/CategoryCard.tsx`

- [ ] **Step 1: ScoreBar** (dynamic width → `style` 예외 허용)

```tsx
// frontend/src/components/analysis/ScoreBar.tsx
interface Props {
  score: number  // 0-100
  label?: string
}

export function ScoreBar({ score, label }: Props) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{pct}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CategoryCard**

```tsx
// frontend/src/components/analysis/CategoryCard.tsx
import { Card } from '@/components/ui/card'
import { ScoreBar } from './ScoreBar'
import { ANALYSIS_CATEGORY_LABELS, type AnalysisCategory } from '@/lib/config/analysis'
import type { CategoryScore } from '@/types/analysis'

interface Props {
  category: AnalysisCategory
  data: CategoryScore
}

export function CategoryCard({ category, data }: Props) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {ANALYSIS_CATEGORY_LABELS[category]}
        </h3>
        <span className="text-sm font-semibold">{data.score}</span>
      </div>
      <ScoreBar score={data.score} />
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
        {data.comment}
      </p>
    </Card>
  )
}
```

---

### Task D.2: `AnalysisReport` 렌더러

**Files:**
- Create: `frontend/src/components/analysis/AnalysisReport.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/analysis/AnalysisReport.tsx
import { Card } from '@/components/ui/card'
import { CategoryCard } from './CategoryCard'
import { ScoreBar } from './ScoreBar'
import { ANALYSIS_CATEGORIES, type AnalysisCategory } from '@/lib/config/analysis'
import type { Analysis } from '@/types/analysis'

const RECOMMENDATION_LABELS = {
  continue: '계속 대화해보기',
  pause: '잠시 쉬었다가 다시',
  end: '여기서 마무리',
} as const

export function AnalysisReport({ analysis }: { analysis: Analysis }) {
  const report = analysis.report_json
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">호환성 점수</h2>
          <span className="text-3xl font-bold">{report.score}</span>
        </div>
        <ScoreBar score={report.score} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {ANALYSIS_CATEGORIES.map((cat) => {
          const c = cat as AnalysisCategory
          const data = report.categories[c]
          if (!data) return null
          return <CategoryCard key={c} category={c} data={data} />
        })}
      </div>

      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold">요약</h3>
        <p className="text-sm leading-relaxed">{report.summary}</p>
      </Card>

      <Card className="p-4 text-center">
        <p className="text-xs text-muted-foreground">추천</p>
        <p className="mt-1 text-sm font-medium">
          {RECOMMENDATION_LABELS[report.recommended_next]}
        </p>
      </Card>
    </div>
  )
}
```

---

### Task D.3: `AnalysisGenerateButton`

**Files:**
- Create: `frontend/src/components/analysis/AnalysisGenerateButton.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/analysis/AnalysisGenerateButton.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  interactionId: string
}

export function AnalysisGenerateButton({ interactionId }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? '분석 실패')
      router.push(`/analyses/${data.analysis.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={handleClick} disabled={pending}>
        {pending ? '분석 중... (약 10-20초)' : '분석 보기'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

---

### Task D.4: `/analyses/[id]` 페이지

**Files:**
- Create: `frontend/src/app/analyses/[id]/page.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/app/analyses/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalysisReport } from '@/components/analysis/AnalysisReport'
import type { Analysis } from '@/types/analysis'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AnalysisPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: analysis } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .maybeSingle<Analysis>()
  if (!analysis) notFound()

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/interactions/${analysis.interaction_id}`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← 대화로 돌아가기
      </Link>
      <AnalysisReport analysis={analysis} />
    </main>
  )
}
```

---

### Task D.5: Viewer 에서 분석 버튼 활성화

**Files:**
- Modify: `frontend/src/components/interaction/InteractionViewer.tsx`

- [ ] **Step 1: 기존 completed 섹션 교체**

현재:
```tsx
{status === 'completed' && (
  <Card className="p-4 text-center">
    <p className="mb-2 text-sm">대화가 완료되었습니다.</p>
    <p className="text-xs text-muted-foreground">
      호환성 분석은 Plan 5에서 활성화됩니다.
    </p>
  </Card>
)}
```

교체:
```tsx
{status === 'completed' && (
  <Card className="p-6 text-center">
    <p className="mb-3 text-sm">대화가 완료되었습니다.</p>
    <AnalysisGenerateButton interactionId={interaction.id} />
  </Card>
)}
```

상단 import 추가:
```ts
import { AnalysisGenerateButton } from '@/components/analysis/AnalysisGenerateButton'
```

- [ ] **Step 2: typecheck + build + commit**

```bash
cd frontend && npm run typecheck && npm run test:run && npm run build
```

```bash
cd /Users/jh/dating
git add frontend/src/components/analysis/ \
  frontend/src/app/analyses/ \
  frontend/src/components/interaction/InteractionViewer.tsx
git commit -m "feat(analysis): report UI, generate button, and viewer integration"
```

---

## Group E — E2E 검증 + Phase 1 마무리

### Task E.1: 프로덕션 배포 + 스모크 테스트

- [ ] **Step 1: push → Vercel 자동 배포**

```bash
git push origin main
```

- [ ] **Step 2: 배포 완료 확인** (Vercel Dashboard)

- [ ] **Step 3: 프로덕션 E2E 체크리스트**

`https://frontend-eta-neon-97.vercel.app` 접속:

메모리:
- [ ] Clone 상세에서 메모리 입력 박스 보임
- [ ] "오늘 영화 봤어" 입력 → 추가 버튼 → 타임라인에 나타남
- [ ] kind 배지(사건/기분/사실/취향) 적절히 분류됨
- [ ] 여러 건 추가했을 때 occurred_at 내림차순 정렬
- [ ] NPC 페이지에는 입력 박스 없음, 타임라인만 (비어 있음)

분석:
- [ ] 완료된 Interaction 뷰어에 "분석 보기" 버튼
- [ ] 클릭 → 10-20초 로딩 → `/analyses/[id]` 이동
- [ ] 총점, 5개 카테고리 카드, 점수 바, 요약, 추천 전부 표시
- [ ] 같은 interaction 다시 "분석 보기" → 캐시 히트 (빠르게 같은 페이지)
- [ ] "대화로 돌아가기" 링크 동작

### Task E.2: Phase 1 완료 태그

- [ ] 모든 체크리스트 통과 후:

```bash
git tag plan5-memory-analysis-complete
git tag phase1-complete
git push origin plan5-memory-analysis-complete
git push origin phase1-complete
```

### Task E.3: CLAUDE.md 업데이트

- [ ] 개발 단계 섹션에서 Phase 1 상태 업데이트:

```markdown
- **Phase 1 ✅ 완료** — 페르소나 입력 폼, Clone CRUD, 1:1 Interaction 엔진, 호환성 리포트, 메모리 업데이트 API
```

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 1 as complete in CLAUDE.md"
git push origin main
```

---

## Self-Review

### Spec Coverage (Phase 1 설계 스펙 대비)
- [x] `POST /api/memories` — A.4
- [x] `POST /api/analyses` — C.3
- [x] `GET /api/analyses/[id]` — C.3
- [x] 메모리 UI (입력 + 타임라인) — B
- [x] 분석 리포트 UI (점수/카테고리/요약/추천) — D
- [x] 뷰어 분석 버튼 통합 — D.5
- [x] 프로덕션 E2E 검증 — E

### 재사용 확인
- [x] `buildMemoryExtractionPrompt` ← 신규 (Plan 1에 없음)
- [x] `parseMemoryExtraction` ← Plan 1 재사용
- [x] `normalizeOccurredAt` ← Plan 1 재사용
- [x] `buildAnalysisPrompt` ← Plan 1 재사용
- [x] `parseAnalysisReport` ← Plan 1 재사용
- [x] `callClaude`, `CLAUDE_MODELS`, `CLAUDE_LIMITS` ← Plan 4 재사용
- [x] `createServiceClient` ← Plan 2 재사용
- [x] `errors` / `AppError` ← Plan 1 재사용

### 타입 일관성
- `CloneMemory` 타입 필드가 DB 컬럼 / API 응답 / UI 렌더 모두 일관 ✅
- `Analysis` 의 `report_json` 이 `AnalysisReport` 형식 일관 ✅
- `POST /api/analyses` 가 `{ analysis }` 반환, `GET /api/analyses/[id]` 도 동일 ✅

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-04-12-phase1-plan5-memory-analysis.md`.

**추천 실행 방식**: Subagent-Driven Development
- **Phase 1**: Group A + Group C 병렬 dispatch
- **Phase 2**: Group B + Group D 병렬 dispatch (A, C 완료 후)
- **Phase 3**: Group E 메인 세션 (수동 E2E)

**실행 전 확인**:
1. Vercel 환경변수에 `ANTHROPIC_API_KEY` 설정 완료
2. Plan 4 `plan4-interaction-complete` 태그 존재
3. 프로덕션에 Interaction 1개 이상 `completed` 상태 존재 (분석 테스트용)
