# Admin Runtime Config Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin이 배포 없이 "절약/정상" 모드와 관계 기억 on/off를 런타임 토글할 수 있게 한다.

**Architecture:** Supabase `platform_config` 테이블에 설정 2개 row 저장. `getRuntimeConfig()` 함수가 DB에서 조회 → 프리셋 매핑 → 엔진에 주입. Admin API(`GET/PATCH /api/admin/config`)로 CRUD. `/admin/config` 페이지에서 토글 UI.

**Tech Stack:** Next.js 16 App Router, Supabase, TypeScript, Tailwind CSS

---

### Task 1: Supabase 마이그레이션 — `platform_config` 테이블

**Files:**
- Create: `frontend/supabase/migrations/20260413000003_platform_config.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- platform_config: 런타임 플랫폼 설정 (key-value)
create table platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table platform_config enable row level security;

-- 인증 유저 읽기 가능 (엔진 서버에서 조회)
create policy "Authenticated users can read config"
  on platform_config for select
  to authenticated
  using (true);

-- 쓰기는 service client(admin API)만 가능 — RLS 정책 없음

-- 초기 데이터
insert into platform_config (key, value) values
  ('interaction_mode', '"economy"'),
  ('relationship_memory_enabled', 'true');
```

- [ ] **Step 2: Supabase Cloud에 마이그레이션 적용**

Run: `cd frontend && npx supabase db push --linked`

Expected: migration applied, `platform_config` 테이블 생성 + 초기 데이터 2 rows

- [ ] **Step 3: 적용 확인**

Run: `cd frontend && npx supabase db push --linked --dry-run`

Expected: "No pending migrations" (이미 적용됨)

- [ ] **Step 4: Commit**

```bash
git add frontend/supabase/migrations/20260413000003_platform_config.sql
git commit -m "feat: add platform_config table for runtime settings"
```

---

### Task 2: 런타임 설정 조회 함수 — `lib/config/runtime.ts`

**Files:**
- Create: `frontend/src/lib/config/runtime.ts`
- Modify: `frontend/src/lib/config/claude.ts` (TODO 주석 제거)
- Modify: `frontend/src/lib/config/interaction.ts` (TODO 주석 제거)

- [ ] **Step 1: `runtime.ts` 작성**

```ts
import { createServiceClient } from '@/lib/supabase/service'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from './claude'
import { INTERACTION_DEFAULTS, FEATURE_FLAGS } from './interaction'

export const INTERACTION_PRESETS = {
  economy: {
    model: 'claude-haiku-4-5-20251001' as const,
    maxTurns: 15,
    maxOutputTokens: 200,
  },
  normal: {
    model: 'claude-sonnet-4-6' as const,
    maxTurns: 20,
    maxOutputTokens: 512,
  },
} as const

export type InteractionMode = keyof typeof INTERACTION_PRESETS

export interface RuntimeConfig {
  interactionMode: InteractionMode
  interactionModel: string
  maxTurns: number
  maxOutputTokens: number
  relationshipMemoryEnabled: boolean
}

/** 코드 상수 기반 fallback (DB 조회 실패 시) */
function fallbackConfig(): RuntimeConfig {
  return {
    interactionMode: 'economy',
    interactionModel: CLAUDE_MODELS.INTERACTION,
    maxTurns: INTERACTION_DEFAULTS.MAX_TURNS,
    maxOutputTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_INTERACTION,
    relationshipMemoryEnabled: FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY,
  }
}

/**
 * Supabase platform_config 테이블에서 런타임 설정 조회.
 * 조회 실패 시 코드 상수 fallback 반환. 에러 로깅만, UX 차단 없음.
 */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const service = createServiceClient()
    const { data, error } = await service
      .from('platform_config')
      .select('key, value')
      .in('key', ['interaction_mode', 'relationship_memory_enabled'])

    if (error || !data) {
      console.warn('[runtime-config] DB fetch failed, using fallback:', error?.message)
      return fallbackConfig()
    }

    const configMap = new Map(data.map((row) => [row.key, row.value]))

    const modeRaw = configMap.get('interaction_mode')
    const mode: InteractionMode =
      modeRaw === 'economy' || modeRaw === 'normal' ? modeRaw : 'economy'
    const preset = INTERACTION_PRESETS[mode]

    const relMemRaw = configMap.get('relationship_memory_enabled')
    const relationshipMemoryEnabled =
      typeof relMemRaw === 'boolean' ? relMemRaw : true

    return {
      interactionMode: mode,
      interactionModel: preset.model,
      maxTurns: preset.maxTurns,
      maxOutputTokens: preset.maxOutputTokens,
      relationshipMemoryEnabled,
    }
  } catch (err) {
    console.warn('[runtime-config] Unexpected error, using fallback:', err)
    return fallbackConfig()
  }
}
```

- [ ] **Step 2: `claude.ts` — TODO 주석 제거**

`frontend/src/lib/config/claude.ts` 에서:
- Line 2: `// TODO: 테스트 후 'claude-sonnet-4-6'으로 복원` 삭제
- Line 17: `// TODO: Sonnet 복원 시 512로 되돌리기. Haiku는 토큰을 꽉 채우는 경향` 삭제

```ts
export const CLAUDE_MODELS = {
  INTERACTION: 'claude-haiku-4-5-20251001',
  EXTRACTION: 'claude-haiku-4-5-20251001',
  ANALYSIS: 'claude-sonnet-4-6',
  ONBOARDING: 'claude-haiku-4-5-20251001',
  RELATIONSHIP: 'claude-haiku-4-5-20251001',
} as const

export const CLAUDE_RETRY = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const

export const CLAUDE_LIMITS = {
  MAX_OUTPUT_TOKENS_INTERACTION: 200,
  MAX_OUTPUT_TOKENS_EXTRACTION: 256,
  MAX_OUTPUT_TOKENS_ANALYSIS: 2048,
  MAX_OUTPUT_TOKENS_ONBOARDING: 512,
  MAX_OUTPUT_TOKENS_RELATIONSHIP: 1024,
} as const
```

- [ ] **Step 3: `interaction.ts` — TODO 주석 제거**

`frontend/src/lib/config/interaction.ts` 에서:
- Line 8: `// TODO: 테스트 후 20으로 복원` 삭제
- Line 19: `/** Phase 2-B: 관계 기억 추출 feature flag. 테스트 후 false로 전환 (API 토큰 절약) */` → `/** 관계 기억 추출 feature flag. 런타임 설정(platform_config)으로 제어. 여기는 fallback 기본값. */` 로 변경

```ts
export const INTERACTION_DEFAULTS = {
  MAX_TURNS: 15,
  MIN_RESPONSE_LENGTH: 4,
  END_SIGNAL_SHORT_TURNS_THRESHOLD: 5,
  MEMORY_INJECTION_LIMIT: 10,
  SYSTEM_PROMPT_TOKEN_BUDGET: 1500,
  HEARTBEAT_WARNING_MS: 5000,
  HEARTBEAT_DANGER_MS: 30000,
  RELATIONSHIP_MEMORY_INJECTION_LIMIT: 20,
} as const

/** 관계 기억 추출 feature flag. 런타임 설정(platform_config)으로 제어. 여기는 fallback 기본값. */
export const FEATURE_FLAGS = {
  ENABLE_RELATIONSHIP_MEMORY: true,
} as const
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/config/runtime.ts frontend/src/lib/config/claude.ts frontend/src/lib/config/interaction.ts
git commit -m "feat: add getRuntimeConfig() with preset mapping + remove TODO comments"
```

---

### Task 3: 엔진 통합 — `run/route.ts`, `orchestrate.ts`, `engine.ts`

**Files:**
- Modify: `frontend/src/app/api/interactions/[id]/run/route.ts`
- Modify: `frontend/src/lib/interaction/orchestrate.ts`
- Modify: `frontend/src/lib/interaction/engine.ts`

- [ ] **Step 1: `orchestrate.ts` — `prepareClonePrompts`에 런타임 설정 파라미터 추가**

변경 내용:
1. `FEATURE_FLAGS` import 제거
2. 파라미터에 `runtimeConfig` 옵션 추가
3. 관계 기억 로딩 조건을 `runtimeConfig`에서 읽기

```ts
// 기존 import 변경
// 삭제: import { REALISM_DEFAULTS, FEATURE_FLAGS } from '@/lib/config/interaction'
// 추가:
import { REALISM_DEFAULTS } from '@/lib/config/interaction'
import type { RuntimeConfig } from '@/lib/config/runtime'
```

함수 시그니처 변경:

```ts
export async function prepareClonePrompts(
  participants: Clone[],
  memoriesByClone: Map<string, CloneMemory[]>,
  interactionId: string,
  date: string,
  runtimeConfig?: Pick<RuntimeConfig, 'relationshipMemoryEnabled'>,
): Promise<Map<string, ClonePromptContext>> {
```

관계 기억 로딩 조건 변경 (line 67):

```ts
  // 기존: if (FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY && participants.length === 2) {
  const relMemEnabled = runtimeConfig?.relationshipMemoryEnabled ?? true
  if (relMemEnabled && participants.length === 2) {
```

- [ ] **Step 2: `engine.ts` — `RunInteractionInput`에 model/maxOutputTokens 추가**

변경 내용:
1. `CLAUDE_MODELS`, `CLAUDE_LIMITS` import 유지 (fallback용)
2. `RunInteractionInput`에 optional 필드 추가
3. `callClaude` 호출에서 input 값 우선 사용

`RunInteractionInput` 인터페이스에 추가:

```ts
export interface RunInteractionInput {
  interactionId: string
  participants: Clone[]
  memoriesByClone: Map<string, CloneMemory[]>
  scenario: {
    id: string
    label: string
    description: string
  }
  setting: string | null
  maxTurns: number
  prebuiltPrompts?: Map<string, string>
  startedAt?: number
  /** 런타임 설정에서 주입. 없으면 코드 상수 fallback */
  model?: string
  maxOutputTokens?: number
}
```

`runInteraction` 함수 내 `callClaude` 호출 변경 (기존 line 156-162):

```ts
      const rawContent = await callClaude({
        model: input.model ?? CLAUDE_MODELS.INTERACTION,
        system: systemPrompt,
        messages: history,
        maxTokens: input.maxOutputTokens ?? CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_INTERACTION,
        temperature: 0.9,
      })
```

- [ ] **Step 3: `run/route.ts` — `getRuntimeConfig()` 호출 + 엔진에 전달**

변경 내용:
1. `FEATURE_FLAGS` import 제거, `getRuntimeConfig` import 추가
2. handler 시작부에서 `getRuntimeConfig()` 호출
3. `prepareClonePrompts`에 런타임 설정 전달
4. `runInteraction`에 model, maxOutputTokens, maxTurns 전달
5. 관계 기억 추출 조건을 런타임 설정으로 변경

import 변경:

```ts
// 삭제: import { DEFAULT_SCENARIOS, FEATURE_FLAGS } from '@/lib/config/interaction'
// 추가:
import { DEFAULT_SCENARIOS } from '@/lib/config/interaction'
import { getRuntimeConfig } from '@/lib/config/runtime'
```

POST handler 내, `const metadata = ...` 줄 직전에 추가:

```ts
    const runtimeConfig = await getRuntimeConfig()
```

`prepareClonePrompts` 호출 변경 (기존 line 96):

```ts
    const clonePrompts = await prepareClonePrompts(participants, memoriesByClone, id, today, runtimeConfig)
```

`runInteraction` 호출 변경 (기존 line 110-123):

```ts
      result = await runInteraction({
        interactionId: id,
        participants,
        memoriesByClone,
        scenario: {
          id: scenario.id,
          label: scenario.label,
          description: scenario.description,
        },
        setting: interaction.setting,
        maxTurns: runtimeConfig.maxTurns,
        prebuiltPrompts,
        startedAt: Date.now(),
        model: runtimeConfig.interactionModel,
        maxOutputTokens: runtimeConfig.maxOutputTokens,
      })
```

관계 기억 추출 조건 변경 (기존 line 152):

```ts
    // 기존: if (FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY && result.status === 'completed') {
    if (runtimeConfig.relationshipMemoryEnabled && result.status === 'completed') {
```

- [ ] **Step 4: 수동 검증**

1. 기존 테스트 통과 확인: `cd frontend && npx vitest run`
2. dev server에서 interaction 실행 가능한지 확인 (기존 동작 유지)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/interactions/[id]/run/route.ts frontend/src/lib/interaction/orchestrate.ts frontend/src/lib/interaction/engine.ts
git commit -m "feat: wire getRuntimeConfig() into interaction engine pipeline"
```

---

### Task 4: Admin API — `GET/PATCH /api/admin/config`

**Files:**
- Create: `frontend/src/app/api/admin/config/route.ts`

- [ ] **Step 1: API route 작성**

```ts
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { AppError } from '@/lib/errors'
import type { InteractionMode } from '@/lib/config/runtime'

function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status }
    )
  }
  console.error('Unhandled:', err)
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: '서버 오류' } },
    { status: 500 }
  )
}

/** GET /api/admin/config — 현재 설정 조회 */
export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceClient()
    const { data, error } = await service
      .from('platform_config')
      .select('key, value')
      .in('key', ['interaction_mode', 'relationship_memory_enabled'])

    if (error) throw new AppError('INTERNAL', error.message, 500)

    const configMap = new Map(
      (data ?? []).map((row) => [row.key, row.value])
    )

    return NextResponse.json({
      interactionMode: configMap.get('interaction_mode') ?? 'economy',
      relationshipMemoryEnabled: configMap.get('relationship_memory_enabled') ?? true,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

const VALID_MODES: InteractionMode[] = ['economy', 'normal']

/** PATCH /api/admin/config — 설정 변경 */
export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const service = createServiceClient()
    const now = new Date().toISOString()

    if (body.interactionMode !== undefined) {
      if (!VALID_MODES.includes(body.interactionMode)) {
        throw new AppError('VALIDATION', `Invalid mode: ${body.interactionMode}`, 400)
      }
      await service
        .from('platform_config')
        .upsert({
          key: 'interaction_mode',
          value: body.interactionMode,
          updated_at: now,
        })
    }

    if (body.relationshipMemoryEnabled !== undefined) {
      if (typeof body.relationshipMemoryEnabled !== 'boolean') {
        throw new AppError('VALIDATION', 'relationshipMemoryEnabled must be boolean', 400)
      }
      await service
        .from('platform_config')
        .upsert({
          key: 'relationship_memory_enabled',
          value: body.relationshipMemoryEnabled,
          updated_at: now,
        })
    }

    // 변경 후 현재 상태 반환
    const { data } = await service
      .from('platform_config')
      .select('key, value')
      .in('key', ['interaction_mode', 'relationship_memory_enabled'])

    const configMap = new Map(
      (data ?? []).map((row) => [row.key, row.value])
    )

    return NextResponse.json({
      interactionMode: configMap.get('interaction_mode') ?? 'economy',
      relationshipMemoryEnabled: configMap.get('relationship_memory_enabled') ?? true,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/api/admin/config/route.ts
git commit -m "feat: add GET/PATCH /api/admin/config for runtime settings"
```

---

### Task 5: Admin UI — `/admin/config` 페이지

**Files:**
- Create: `frontend/src/app/admin/config/page.tsx`

- [ ] **Step 1: 페이지 작성**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { INTERACTION_PRESETS, type InteractionMode } from '@/lib/config/runtime'

interface ConfigState {
  interactionMode: InteractionMode
  relationshipMemoryEnabled: boolean
}

const MODE_LABELS: Record<InteractionMode, string> = {
  economy: '절약',
  normal: '정상',
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<ConfigState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (!res.ok) throw new Error('설정을 불러올 수 없습니다')
      const data = await res.json()
      setConfig(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  async function updateConfig(patch: Partial<ConfigState>) {
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('설정 변경에 실패했습니다')
      const data = await res.json()
      setConfig(data)
      setToast('설정이 변경되었습니다')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">플랫폼 설정</h1>
        <p className="text-muted-foreground">불러오는 중...</p>
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">플랫폼 설정</h1>
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  const mode = config!.interactionMode
  const preset = INTERACTION_PRESETS[mode]
  const otherMode: InteractionMode = mode === 'economy' ? 'normal' : 'economy'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">플랫폼 설정</h1>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Link href="/admin/interactions" className="hover:underline">Interactions</Link>
          <span>·</span>
          <Link href="/admin/clones" className="hover:underline">Clones</Link>
          <span>·</span>
          <Link href="/admin/world" className="hover:underline">World</Link>
        </div>
      </div>

      {toast && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {toast}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Interaction 모드 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Interaction 모드</CardTitle>
          <CardDescription>모델, 턴 수, 출력 토큰을 프리셋으로 전환</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant={mode === 'economy' ? 'default' : 'outline'}
              size="sm"
              disabled={saving || mode === 'economy'}
              onClick={() => updateConfig({ interactionMode: 'economy' })}
            >
              절약
            </Button>
            <Button
              variant={mode === 'normal' ? 'default' : 'outline'}
              size="sm"
              disabled={saving || mode === 'normal'}
              onClick={() => updateConfig({ interactionMode: 'normal' })}
            >
              정상
            </Button>
          </div>
          <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">
            <p>현재: <strong>{MODE_LABELS[mode]}</strong></p>
            <p className="text-muted-foreground">
              모델: {preset.model} · 턴: {preset.maxTurns} · 토큰: {preset.maxOutputTokens}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 관계 기억 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">관계 기억</CardTitle>
          <CardDescription>Interaction 종료 후 양방향 관계 기억 자동 추출</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant={config!.relationshipMemoryEnabled ? 'default' : 'outline'}
              size="sm"
              disabled={saving || config!.relationshipMemoryEnabled}
              onClick={() => updateConfig({ relationshipMemoryEnabled: true })}
            >
              ON
            </Button>
            <Button
              variant={!config!.relationshipMemoryEnabled ? 'default' : 'outline'}
              size="sm"
              disabled={saving || !config!.relationshipMemoryEnabled}
              onClick={() => updateConfig({ relationshipMemoryEnabled: false })}
            >
              OFF
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {config!.relationshipMemoryEnabled
              ? 'Interaction 완료 시 관계 기억이 자동 추출됩니다.'
              : '관계 기억 추출이 비활성화되어 있습니다. 토큰을 절약합니다.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: 기존 admin 페이지들에 `/admin/config` 크로스링크 추가**

`frontend/src/app/admin/interactions/page.tsx` — 기존 `/admin/clones` 링크 옆에 추가:

```tsx
<Link href="/admin/clones" className="text-sm text-muted-foreground hover:underline">
  Clones 관리 →
</Link>
```

뒤에 추가:

```tsx
<Link href="/admin/config" className="text-sm text-muted-foreground hover:underline">
  설정 →
</Link>
```

`frontend/src/app/admin/clones/page.tsx` — 기존 `/admin/interactions` 링크 옆에 동일하게:

```tsx
<Link href="/admin/config" className="text-sm text-muted-foreground hover:underline">
  설정 →
</Link>
```

- [ ] **Step 3: dev server에서 확인**

1. `cd frontend && npm run dev`
2. `/admin/config` 접속 → 현재 설정 표시 확인
3. "정상" 버튼 클릭 → PATCH 성공 + toast + 세부 값 변경 확인
4. "절약"으로 다시 전환 → 정상 동작 확인
5. 관계 기억 ON/OFF 토글 확인
6. 다른 admin 페이지에서 `/admin/config` 링크 동작 확인

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/config/page.tsx frontend/src/app/admin/interactions/page.tsx frontend/src/app/admin/clones/page.tsx
git commit -m "feat: add /admin/config page with interaction mode + relationship memory toggles"
```

---

### Task 6: 통합 테스트 + extract-memories fallback 업데이트

**Files:**
- Modify: `frontend/src/app/api/interactions/[id]/extract-memories/route.ts` (fallback에서도 런타임 설정 사용)

- [ ] **Step 1: extract-memories fallback API에서 런타임 설정 조회**

`extract-memories/route.ts`에서 `FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY`를 직접 참조하고 있다면, `getRuntimeConfig()`로 교체:

```ts
import { getRuntimeConfig } from '@/lib/config/runtime'

// handler 내:
const runtimeConfig = await getRuntimeConfig()
if (!runtimeConfig.relationshipMemoryEnabled) {
  return NextResponse.json({ ok: true, skipped: true })
}
```

- [ ] **Step 2: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`

Expected: 기존 141개 테스트 전부 통과

- [ ] **Step 3: E2E 수동 검증**

1. `/admin/config`에서 "정상" 모드로 전환
2. Interaction 생성 + 실행 → Sonnet 모델 + 20턴 + 512토큰으로 동작하는지 확인
3. 관계 기억 OFF → Interaction 완료 후 관계 기억 추출 안 되는지 확인
4. "절약" 모드로 복원 → Haiku + 15턴 + 200토큰으로 동작 확인

- [ ] **Step 4: Commit (if extract-memories changed)**

```bash
git add frontend/src/app/api/interactions/[id]/extract-memories/route.ts
git commit -m "feat: use getRuntimeConfig() in extract-memories fallback API"
```

---

### Task 7: 문서 업데이트

**Files:**
- Modify: `docs/PROJECT_STATE.md`

- [ ] **Step 1: PROJECT_STATE.md 업데이트**

아래 내용 추가/변경:
- 요약 테이블: "Admin Runtime Config" 완료 추가
- API 목록에 `GET|PATCH /api/admin/config` 추가
- Admin 섹션에 `/admin/config` 추가
- 주요 모듈에 `lib/config/runtime.ts` 추가
- "알려진 이슈 #7 임시 설정"을 "해결됨 — admin 런타임 토글"로 변경
- 마이그레이션 19번 `platform_config` 추가
- 아키텍처 결정에 "런타임 설정은 platform_config 테이블" 추가

- [ ] **Step 2: Commit**

```bash
git add docs/PROJECT_STATE.md
git commit -m "docs: update PROJECT_STATE with admin runtime config"
```
