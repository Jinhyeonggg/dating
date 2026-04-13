# 롤 매핑 명확화 + 안정적 관계 기억 추출 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) AI가 자신/상대 정체성을 혼동하지 않도록 system prompt에 역할 컨텍스트 명시. (B) 관계 기억 추출을 Vercel 타임아웃과 분리하여 안정적으로 실행.

**Architecture:** (A) `buildEnhancedSystemPrompt`에 `partnerContext` 파라미터 추가. (B) `run/route.ts`에서 `after()` API로 추출을 response 이후로 이동 + `/interactions/[id]` 페이지에서 fallback 추출 트리거.

**Tech Stack:** Next.js 16 (`after` from `next/server`), Supabase, Anthropic Claude (Haiku)

---

## File Structure

### 수정 파일
| 파일 | 변경 |
|---|---|
| `src/lib/prompts/persona.ts` | `EnhancedPromptInput`에 `partnerContext` 추가 + 렌더링 |
| `src/lib/interaction/orchestrate.ts` | 상대 Clone 정보를 `partnerContext`로 전달 |
| `src/app/api/interactions/[id]/run/route.ts` | 관계 기억 추출을 `after()`로 이동 + placeholder 제거 |
| `src/app/interactions/[id]/page.tsx` | fallback: 관계 기억 없으면 추출 API 호출 |

### 신규 파일
| 파일 | 책임 |
|---|---|
| `src/app/api/interactions/[id]/extract-memories/route.ts` | 관계 기억 추출 전용 API (fallback + 수동 재시도) |

---

## Task 1: System Prompt에 상대방 컨텍스트 추가

**Files:**
- Modify: `src/lib/prompts/persona.ts`
- Modify: `src/lib/interaction/orchestrate.ts`

- [ ] **Step 1: `EnhancedPromptInput`에 `partnerContext` 필드 추가**

`src/lib/prompts/persona.ts`의 `EnhancedPromptInput` 인터페이스에 추가:

```ts
  /** 대화 상대 기본 정보 — 역할 혼동 방지용 */
  partnerContext?: { name: string; highlights: string } | null
```

- [ ] **Step 2: `buildEnhancedSystemPrompt`에서 역할 컨텍스트 렌더링**

`buildEnhancedSystemPrompt` 함수 내부, persona core (섹션 2) 바로 전에 삽입:

```ts
  // 1.5. Role context — 자신/상대 명확화
  if (input.partnerContext) {
    parts.push(
      `[역할]\n당신은 "${persona.name}"입니다. 위 페르소나가 당신의 정보입니다.\n상대방은 "${input.partnerContext.name}"입니다.${input.partnerContext.highlights ? ` (${input.partnerContext.highlights})` : ''}\n당신의 정보를 상대방의 것으로 착각하지 마세요.`
    )
  }
```

기존 `// 2. Persona core` 주석 위에 삽입. 주석 번호 재정렬은 불필요 (기능에 영향 없음).

- [ ] **Step 3: `orchestrate.ts`에서 `partnerContext` 전달**

`src/lib/interaction/orchestrate.ts`의 `buildEnhancedSystemPrompt` 호출 부분 수정:

기존:
```ts
    const systemPrompt = buildEnhancedSystemPrompt({
      persona,
      memories,
      inferredTraits: clone.inferred_traits ?? null,
      relationshipMemory: relationship && otherClone
        ? { relationship, partnerName: otherClone.name }
        : null,
      textureRules: TEXTURE_RULES,
      styleCards,
      mood,
      worldSnippet,
    })
```

변경:
```ts
    // 상대방 핵심 정보 추출 (역할 혼동 방지)
    const partnerHighlights = otherClone
      ? [
          otherClone.persona_json.occupation,
          otherClone.persona_json.age ? `${otherClone.persona_json.age}세` : null,
          otherClone.persona_json.mbti,
        ].filter(Boolean).join(', ')
      : ''

    const systemPrompt = buildEnhancedSystemPrompt({
      persona,
      memories,
      inferredTraits: clone.inferred_traits ?? null,
      partnerContext: otherClone
        ? { name: otherClone.name, highlights: partnerHighlights }
        : null,
      relationshipMemory: relationship && otherClone
        ? { relationship, partnerName: otherClone.name }
        : null,
      textureRules: TEXTURE_RULES,
      styleCards,
      mood,
      worldSnippet,
    })
```

- [ ] **Step 4: 전체 테스트**

Run: `cd /Users/jh/dating/frontend && npx vitest run`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/lib/prompts/persona.ts frontend/src/lib/interaction/orchestrate.ts
git commit -m "feat: add partner context to system prompt to prevent role confusion"
```

---

## Task 2: 관계 기억 추출 전용 API

**Files:**
- Create: `src/app/api/interactions/[id]/extract-memories/route.ts`

- [ ] **Step 1: 추출 전용 API 작성**

```ts
// src/app/api/interactions/[id]/extract-memories/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { FEATURE_FLAGS } from '@/lib/config/interaction'
import { extractRelationshipMemories } from '@/lib/relationship/service'
import { errors, AppError } from '@/lib/errors'
import type { Clone } from '@/types/persona'
import type { InteractionEvent } from '@/types/interaction'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status }
    )
  }
  console.error('Unhandled error:', err)
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: '서버 오류' } },
    { status: 500 }
  )
}

export const maxDuration = 60

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { id } = await ctx.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const admin = createServiceClient()

    // interaction 상태 확인
    const { data: interaction } = await admin
      .from('interactions')
      .select('id, status')
      .eq('id', id)
      .single()
    if (!interaction) throw errors.notFound('Interaction')
    if (interaction.status !== 'completed') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_completed' })
    }

    // 이미 추출된 기억이 있는지 확인 (interaction_count > 0)
    const { data: participants } = await admin
      .from('interaction_participants')
      .select('clone_id, clones(*)')
      .eq('interaction_id', id)
    const clones = (participants ?? [])
      .map((r) => (r as unknown as { clones: Clone }).clones)
      .filter(Boolean)
    if (clones.length !== 2) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_2_participants' })
    }

    // 이미 추출 완료되었는지 확인
    const [a, b] = clones
    const { data: existingRels } = await admin
      .from('clone_relationships')
      .select('interaction_count')
      .or(`and(clone_id.eq.${a.id},target_clone_id.eq.${b.id}),and(clone_id.eq.${b.id},target_clone_id.eq.${a.id})`)
    const alreadyExtracted = (existingRels ?? []).some((r) => r.interaction_count > 0)
    if (alreadyExtracted) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'already_extracted' })
    }

    // events 조회
    const { data: events } = await admin
      .from('interaction_events')
      .select('*')
      .eq('interaction_id', id)
      .order('turn_number', { ascending: true })
    if (!events || events.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_events' })
    }

    // 추출 실행
    await extractRelationshipMemories(
      events as InteractionEvent[],
      clones.map((c) => ({ id: c.id, name: c.name, persona_json: c.persona_json })),
      id,
    )

    return NextResponse.json({ ok: true, extracted: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/app/api/interactions/[id]/extract-memories/route.ts
git commit -m "feat: add dedicated extract-memories API endpoint for fallback extraction"
```

---

## Task 3: `run/route.ts` — `after()`로 이동 + placeholder 제거

**Files:**
- Modify: `src/app/api/interactions/[id]/run/route.ts`

- [ ] **Step 1: `after` import 추가**

파일 상단에 추가:
```ts
import { after } from 'next/server'
```

- [ ] **Step 2: placeholder 생성 코드 제거**

108~131행의 placeholder 코드 전체 삭제:
```ts
    // 양방향 placeholder 관계 기억 생성 (대화 진행 중 상태)
    if (FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY && participants.length === 2) {
      ...전체 삭제...
    }
```

- [ ] **Step 3: 기존 `await extractRelationshipMemories` 블록을 `after()`로 교체**

176~199행의 기존 추출 코드:
```ts
    // 관계 기억 자동 추출 (feature flag + completed 일 때만)
    if (FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY && result.status === 'completed') {
      const { data: events } = await admin
        ...
    }
```

교체:
```ts
    // 관계 기억 자동 추출 — after()로 response 반환 후 실행
    if (FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY && result.status === 'completed') {
      const participantData = participants.map((p) => ({
        id: p.id,
        name: p.name,
        persona_json: p.persona_json,
      }))
      after(async () => {
        try {
          const bgAdmin = createServiceClient()
          const { data: events } = await bgAdmin
            .from('interaction_events')
            .select('*')
            .eq('interaction_id', id)
            .order('turn_number', { ascending: true })

          if (events && events.length > 0) {
            await extractRelationshipMemories(
              events as InteractionEvent[],
              participantData,
              id,
            )
          }
        } catch (err) {
          console.error('[relationship] after() extraction failed:', err)
        }
      })
    }
```

- [ ] **Step 4: 전체 테스트**

Run: `cd /Users/jh/dating/frontend && npx vitest run`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/app/api/interactions/[id]/run/route.ts
git commit -m "feat: move relationship extraction to after() + remove placeholder"
```

---

## Task 4: Interaction 뷰어에서 fallback 추출 트리거

**Files:**
- Modify: `src/app/interactions/[id]/page.tsx`

- [ ] **Step 1: 페이지에서 completed interaction 확인 후 fallback API 호출**

`src/app/interactions/[id]/page.tsx`의 클라이언트 부분에서 처리해야 합니다. 서버 컴포넌트에서 API를 호출하면 복잡해지므로, 간단한 클라이언트 컴포넌트를 만듭니다.

`src/components/interaction/RelationshipExtractTrigger.tsx` (신규):

```tsx
'use client'

import { useEffect } from 'react'

interface Props {
  interactionId: string
  status: string
}

/**
 * completed interaction 페이지 방문 시 관계 기억 추출이 안 되어 있으면 트리거.
 * after() 실패 시 fallback 역할.
 */
export function RelationshipExtractTrigger({ interactionId, status }: Props) {
  useEffect(() => {
    if (status !== 'completed') return

    // 약간의 딜레이 후 실행 (after()가 먼저 완료될 시간 확보)
    const timer = setTimeout(() => {
      fetch(`/api/interactions/${interactionId}/extract-memories`, {
        method: 'POST',
      }).catch(() => {
        // silent — best effort
      })
    }, 3000)

    return () => clearTimeout(timer)
  }, [interactionId, status])

  return null
}
```

- [ ] **Step 2: `interactions/[id]/page.tsx`에서 사용**

import 추가:
```ts
import { RelationshipExtractTrigger } from '@/components/interaction/RelationshipExtractTrigger'
```

return JSX 내부, `<InteractionViewer .../>` 바로 아래에 추가:
```tsx
      <RelationshipExtractTrigger
        interactionId={interaction.id}
        status={interaction.status}
      />
```

- [ ] **Step 3: 전체 테스트**

Run: `cd /Users/jh/dating/frontend && npx vitest run`

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/interaction/RelationshipExtractTrigger.tsx frontend/src/app/interactions/[id]/page.tsx
git commit -m "feat: fallback relationship extraction trigger on interaction viewer page"
```

---

## Task 5: 통합 테스트 + 배포

- [ ] **Step 1: 전체 테스트 + 타입 체크**

Run: `cd /Users/jh/dating/frontend && npx vitest run && npx tsc --noEmit 2>&1 | grep -v ".next/dev"`

- [ ] **Step 2: 배포**

```bash
git push
```

- [ ] **Step 3: E2E 검증**

1. 새 interaction 시작 → 완료까지 대기
2. 내 Clone 페이지 → 대화 기억 탭 → 기억이 채워졌는지 확인
3. 대화 내용에서 역할 혼동 없는지 확인 (speaker가 자기 정보를 상대에게 질문하지 않는지)
4. interaction 뷰어에서 3초 후 fallback 트리거 확인 (이미 추출 완료면 skip)
