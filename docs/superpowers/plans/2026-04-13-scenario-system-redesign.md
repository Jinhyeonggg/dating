# 시나리오 시스템 재설계 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 시나리오(관계+분위기 혼합)를 관계 단계(자동) + 대화 분위기(유저 선택)로 분리하여 클론 기억 누적과의 모순 제거.

**Architecture:** `DEFAULT_SCENARIOS` → `CONVERSATION_MOODS` + `RELATIONSHIP_STAGES` 분리. 관계 단계는 `clone_relationships.interaction_count`에서 deterministic 결정. Interaction 생성 시 API가 관계 단계 조회 후 metadata에 저장. 엔진은 관계 단계 + 분위기를 첫 메시지 프롬프트에 분리 전달.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest

---

### Task 1: 상수 변경 — `CONVERSATION_MOODS` + `RELATIONSHIP_STAGES`

**Files:**
- Modify: `frontend/src/lib/config/interaction.ts`

- [ ] **Step 1: `DEFAULT_SCENARIOS`를 `CONVERSATION_MOODS`로 교체 + `RELATIONSHIP_STAGES` 추가**

`frontend/src/lib/config/interaction.ts` 에서 기존 `DEFAULT_SCENARIOS` (line 25-41)를 삭제하고 다음으로 교체:

```ts
export const CONVERSATION_MOODS = [
  {
    id: 'casual',
    label: '가벼운 대화',
    description: '일상적이고 편한 분위기',
  },
  {
    id: 'serious',
    label: '진지한 대화',
    description: '가치관, 인생관을 나누는 분위기',
  },
  {
    id: 'free',
    label: '자유 대화',
    description: '제한 없이 자연스럽게',
  },
] as const

export const RELATIONSHIP_STAGES = [
  { id: 'first-meeting', label: '처음 만나는 사이', minCount: 0, maxCount: 0 },
  { id: 'early-acquaintance', label: '몇 번 대화해 본 사이', minCount: 1, maxCount: 2 },
  { id: 'familiar', label: '여러 번 대화한 사이', minCount: 3, maxCount: Infinity },
] as const

export type RelationshipStageId = (typeof RELATIONSHIP_STAGES)[number]['id']
export type ConversationMoodId = (typeof CONVERSATION_MOODS)[number]['id']

/**
 * interaction_count 기반으로 관계 단계를 결정한다. deterministic.
 */
export function getRelationshipStage(interactionCount: number): { id: RelationshipStageId; label: string } {
  const stage = RELATIONSHIP_STAGES.find(
    (s) => interactionCount >= s.minCount && interactionCount <= s.maxCount
  )
  return stage
    ? { id: stage.id, label: stage.label }
    : { id: 'first-meeting', label: '처음 만나는 사이' }
}
```

`END_PROMISE_MARKER`와 나머지 export는 그대로 유지.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/config/interaction.ts
git commit -m "feat: replace DEFAULT_SCENARIOS with CONVERSATION_MOODS + RELATIONSHIP_STAGES"
```

---

### Task 2: TDD — `getRelationshipStage` 테스트

**Files:**
- Create: `frontend/src/lib/config/interaction.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, it, expect } from 'vitest'
import { getRelationshipStage } from './interaction'

describe('getRelationshipStage', () => {
  it('0회 → first-meeting', () => {
    expect(getRelationshipStage(0)).toEqual({
      id: 'first-meeting',
      label: '처음 만나는 사이',
    })
  })

  it('1회 → early-acquaintance', () => {
    expect(getRelationshipStage(1)).toEqual({
      id: 'early-acquaintance',
      label: '몇 번 대화해 본 사이',
    })
  })

  it('2회 → early-acquaintance', () => {
    expect(getRelationshipStage(2)).toEqual({
      id: 'early-acquaintance',
      label: '몇 번 대화해 본 사이',
    })
  })

  it('3회 → familiar', () => {
    expect(getRelationshipStage(3)).toEqual({
      id: 'familiar',
      label: '여러 번 대화한 사이',
    })
  })

  it('100회 → familiar', () => {
    expect(getRelationshipStage(100)).toEqual({
      id: 'familiar',
      label: '여러 번 대화한 사이',
    })
  })
})
```

- [ ] **Step 2: 테스트 실행**

Run: `cd frontend && npx vitest run src/lib/config/interaction.test.ts`

Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/config/interaction.test.ts
git commit -m "test: add getRelationshipStage unit tests"
```

---

### Task 3: 프롬프트 변경 — `buildFirstUserMessage`

**Files:**
- Modify: `frontend/src/lib/prompts/interaction.ts`
- Modify: `frontend/src/lib/prompts/interaction.test.ts`

- [ ] **Step 1: 테스트 먼저 변경**

`frontend/src/lib/prompts/interaction.test.ts` 전체를 다음으로 교체:

```ts
import { describe, it, expect } from 'vitest'
import { buildFirstUserMessage } from './interaction'

describe('buildFirstUserMessage', () => {
  it('관계 단계와 분위기가 포함되어야 한다', () => {
    const msg = buildFirstUserMessage({
      relationshipStageLabel: '처음 만나는 사이',
      moodLabel: '가벼운 대화',
      moodDescription: '일상적이고 편한 분위기',
      setting: null,
      partnerName: '지민',
      selfName: '태현',
    })
    expect(msg).toContain('처음 만나는 사이')
    expect(msg).toContain('가벼운 대화')
    expect(msg).toContain('지민')
    expect(msg).toContain('태현')
  })

  it('setting 있으면 포함', () => {
    const msg = buildFirstUserMessage({
      relationshipStageLabel: '몇 번 대화해 본 사이',
      moodLabel: '진지한 대화',
      moodDescription: '가치관, 인생관을 나누는 분위기',
      setting: '홍대 카페',
      partnerName: 'A',
      selfName: 'B',
    })
    expect(msg).toContain('홍대 카페')
  })

  it('setting null이면 생략', () => {
    const msg = buildFirstUserMessage({
      relationshipStageLabel: '처음 만나는 사이',
      moodLabel: '자유 대화',
      moodDescription: '제한 없이 자연스럽게',
      setting: null,
      partnerName: 'A',
      selfName: 'B',
    })
    expect(msg).not.toMatch(/장소/)
  })

  it('partnerHighlights 포함', () => {
    const msg = buildFirstUserMessage({
      relationshipStageLabel: '처음 만나는 사이',
      moodLabel: '가벼운 대화',
      moodDescription: '일상적이고 편한 분위기',
      setting: null,
      partnerName: 'A',
      selfName: 'B',
      partnerHighlights: '개발자 / INTJ',
    })
    expect(msg).toContain('개발자 / INTJ')
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && npx vitest run src/lib/prompts/interaction.test.ts`

Expected: FAIL — `FirstUserMessageInput`에 `relationshipStageLabel` 프로퍼티 없음

- [ ] **Step 3: `interaction.ts` 구현 변경**

`frontend/src/lib/prompts/interaction.ts` 전체를 다음으로 교체:

```ts
export interface FirstUserMessageInput {
  relationshipStageLabel: string
  moodLabel: string
  moodDescription: string
  setting: string | null
  partnerName: string
  selfName: string
  partnerHighlights?: string
}

/**
 * 첫 화자에게 전달될 "첫 user 메시지".
 * 관계 단계 + 분위기를 분리해서 전달한다.
 */
export function buildFirstUserMessage(input: FirstUserMessageInput): string {
  const settingPart = input.setting
    ? `장소/매체는 "${input.setting}"입니다.`
    : ''

  const highlightsPart = input.partnerHighlights
    ? ` ${input.partnerName}의 프로필 정보: ${input.partnerHighlights}`
    : ''

  return [
    `(상황 설정: 프로필 매칭 플랫폼에서 대화를 시작합니다.`,
    `관계: ${input.relationshipStageLabel}.`,
    `분위기: ${input.moodLabel} — ${input.moodDescription}. ${settingPart}`,
    ``,
    `당신은 "${input.selfName}"입니다. 당신의 정보는 위 system prompt에 있습니다.`,
    `상대방은 "${input.partnerName}"입니다.${highlightsPart}`,
    ``,
    `당신(${input.selfName})이 ${input.partnerName}에게 먼저 말을 겁니다.`,
    `인사는 짧게 1번만 하고 바로 상대방(${input.partnerName})의 프로필에서 관심 가는 주제로 넘어가세요.)`,
  ]
    .join('\n')
    .trim()
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && npx vitest run src/lib/prompts/interaction.test.ts`

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/prompts/interaction.ts frontend/src/lib/prompts/interaction.test.ts
git commit -m "feat: buildFirstUserMessage — split relationship stage + mood"
```

---

### Task 4: Validation 스키마 변경

**Files:**
- Modify: `frontend/src/lib/validation/interaction.ts`

- [ ] **Step 1: `scenarioId` → `moodId`**

`frontend/src/lib/validation/interaction.ts` 전체를 다음으로 교체:

```ts
// frontend/src/lib/validation/interaction.ts
import { z } from 'zod'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'

export const createInteractionSchema = z.object({
  participantCloneIds: z.array(z.string().min(1)).length(2),
  moodId: z.string().min(1),
  setting: z.string().nullable().optional(),
  maxTurns: z.number().int().min(2).max(40).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>

export const DEFAULT_MAX_TURNS = INTERACTION_DEFAULTS.MAX_TURNS
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/validation/interaction.ts
git commit -m "feat: validation schema — scenarioId to moodId"
```

---

### Task 5: API 변경 — `POST /api/interactions`

**Files:**
- Modify: `frontend/src/app/api/interactions/route.ts`

- [ ] **Step 1: import 변경 + POST handler 업데이트**

import 변경:

```ts
// 기존:
// import { DEFAULT_SCENARIOS, INTERACTION_DEFAULTS } from '@/lib/config/interaction'
// 변경:
import { CONVERSATION_MOODS, INTERACTION_DEFAULTS, getRelationshipStage } from '@/lib/config/interaction'
```

POST handler 내 변경 (기존 line 97 이후):

`scenarioId` → `moodId` 로 변수명 변경:

```ts
    const { participantCloneIds, moodId, setting, maxTurns, metadata } = parsed.data
```

시나리오 validation 로직 교체 (기존 line 113-114):

```ts
    // 기존:
    // const scenario = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId)
    // if (!scenario) throw errors.validation(`unknown scenario: ${scenarioId}`)

    // 변경:
    const mood = CONVERSATION_MOODS.find((m) => m.id === moodId)
    if (!mood) throw errors.validation(`unknown mood: ${moodId}`)
```

관계 단계 조회 추가 (mood validation 직후, `const admin = ...` 직전에):

```ts
    // 관계 단계 조회 (clone_relationships.interaction_count 기반)
    const admin = createServiceClient()
    const [cloneA, cloneB] = participantCloneIds
    const { data: relRows } = await admin
      .from('clone_relationships')
      .select('interaction_count')
      .or(`and(clone_id.eq.${cloneA},target_clone_id.eq.${cloneB}),and(clone_id.eq.${cloneB},target_clone_id.eq.${cloneA})`)
      .limit(1)
    const interactionCount = relRows?.[0]?.interaction_count ?? 0
    const relationshipStage = getRelationshipStage(interactionCount)
```

**주의**: 기존 코드에서 `const admin = createServiceClient()` 가 line 116에 있었으므로, 위에서 이미 생성했으니 기존 line 116의 `const admin = createServiceClient()` 중복을 제거해야 함.

interaction insert 변경 (기존 line 117-130):

```ts
    const { data: interaction, error: iErr } = await admin
      .from('interactions')
      .insert({
        kind: 'pair-chat',
        scenario: mood.label,
        setting: setting ?? null,
        status: 'pending',
        max_turns: maxTurns ?? INTERACTION_DEFAULTS.MAX_TURNS,
        metadata: {
          moodId: mood.id,
          relationshipStage: relationshipStage.id,
          ...(metadata ?? {}),
        },
        created_by: user.id,
      })
      .select()
      .single()
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/api/interactions/route.ts
git commit -m "feat: POST /api/interactions — mood + relationship stage"
```

---

### Task 6: Run route 변경 — 엔진에 관계 단계 + 분위기 전달

**Files:**
- Modify: `frontend/src/app/api/interactions/[id]/run/route.ts`
- Modify: `frontend/src/lib/interaction/engine.ts`

- [ ] **Step 1: `run/route.ts` — import + metadata 파싱 변경**

import 변경:

```ts
// 기존:
// import { DEFAULT_SCENARIOS } from '@/lib/config/interaction'
// 변경:
import { CONVERSATION_MOODS, RELATIONSHIP_STAGES } from '@/lib/config/interaction'
```

metadata 파싱 변경 (기존 line 92-94):

```ts
    // 기존:
    // const metadata = (interaction.metadata ?? {}) as { scenarioId?: string }
    // const scenarioId = metadata.scenarioId ?? DEFAULT_SCENARIOS[0].id
    // const scenario = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId) ?? DEFAULT_SCENARIOS[0]

    // 변경:
    const metadata = (interaction.metadata ?? {}) as {
      moodId?: string
      relationshipStage?: string
      scenarioId?: string // 하위호환
    }
    const moodId = metadata.moodId ?? metadata.scenarioId ?? CONVERSATION_MOODS[0].id
    const mood = CONVERSATION_MOODS.find((m) => m.id === moodId) ?? CONVERSATION_MOODS[0]
    const stageId = metadata.relationshipStage ?? 'first-meeting'
    const stage = RELATIONSHIP_STAGES.find((s) => s.id === stageId)
      ?? { id: 'first-meeting' as const, label: '처음 만나는 사이', minCount: 0, maxCount: 0 }
```

`runInteraction` 호출부의 `scenario` 파라미터 변경 (기존 line 116-118):

```ts
        scenario: {
          id: mood.id,
          label: mood.label,
          description: mood.description,
        },
        relationshipStageLabel: stage.label,
```

- [ ] **Step 2: `engine.ts` — `RunInteractionInput`에 `relationshipStageLabel` 추가 + `buildFirstUserMessage` 호출 변경**

`RunInteractionInput` 인터페이스에 추가:

```ts
  /** 관계 단계 라벨 ("처음 만나는 사이" 등) */
  relationshipStageLabel?: string
```

`buildFirstUserMessage` 호출 변경 (기존 line 142-148):

```ts
        const firstUserMessage = buildFirstUserMessage({
          relationshipStageLabel: input.relationshipStageLabel ?? '처음 만나는 사이',
          moodLabel: input.scenario.label,
          moodDescription: input.scenario.description,
          setting: input.setting,
          partnerName: listener.name,
          selfName: speaker.name,
          partnerHighlights: highlights || undefined,
        })
```

- [ ] **Step 3: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`

Expected: 모든 테스트 PASS

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/api/interactions/[id]/run/route.ts" frontend/src/lib/interaction/engine.ts
git commit -m "feat: run route — pass relationship stage + mood to engine"
```

---

### Task 7: UI 변경 — `MoodPicker` + `new/page.tsx`

**Files:**
- Modify: `frontend/src/components/interaction/ScenarioPicker.tsx` → rename to `MoodPicker.tsx`
- Modify: `frontend/src/app/interactions/new/page.tsx`

- [ ] **Step 1: `ScenarioPicker.tsx` → `MoodPicker.tsx` rename + 내용 변경**

기존 `frontend/src/components/interaction/ScenarioPicker.tsx` 삭제하고, `frontend/src/components/interaction/MoodPicker.tsx` 생성:

```tsx
'use client'

import { CONVERSATION_MOODS } from '@/lib/config/interaction'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (id: string) => void
}

export function MoodPicker({ value, onChange }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {CONVERSATION_MOODS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={cn('text-left', value === m.id ? 'ring-2 ring-primary' : '')}
        >
          <Card className="flex h-full min-h-[6rem] flex-col p-3 transition hover:bg-muted/50">
            <p className="font-medium">{m.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
          </Card>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `new/page.tsx` 변경**

import 변경:

```tsx
// 기존:
// import { ScenarioPicker } from '@/components/interaction/ScenarioPicker'
// import { DEFAULT_SCENARIOS } from '@/lib/config/interaction'
// 변경:
import { MoodPicker } from '@/components/interaction/MoodPicker'
import { CONVERSATION_MOODS } from '@/lib/config/interaction'
```

state 변경:

```tsx
  // 기존: const [scenarioId, setScenarioId] = useState<string>(DEFAULT_SCENARIOS[0].id)
  const [moodId, setMoodId] = useState<string>(CONVERSATION_MOODS[0].id)
```

fetch body 변경:

```tsx
        body: JSON.stringify({
          participantCloneIds: pair,
          moodId,
        }),
```

JSX 변경 — Card 내부:

```tsx
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">대화 분위기</h2>
          <MoodPicker value={moodId} onChange={setMoodId} />
        </Card>
```

header 설명문 변경:

```tsx
        <p className="mt-1 text-sm text-muted-foreground">
          두 Clone을 선택하고 대화 분위기를 고르면 대화가 시작됩니다.
        </p>
```

- [ ] **Step 3: `ScenarioPicker.tsx` 삭제**

Run: `rm frontend/src/components/interaction/ScenarioPicker.tsx`

- [ ] **Step 4: dev server에서 확인**

1. `/interactions/new` 접속
2. 분위기 카드 3개 표시 확인 (가벼운 대화, 진지한 대화, 자유 대화)
3. Clone 선택 + 분위기 선택 + "대화 시작" → interaction 생성 확인

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/interaction/MoodPicker.tsx frontend/src/app/interactions/new/page.tsx
git rm frontend/src/components/interaction/ScenarioPicker.tsx
git commit -m "feat: ScenarioPicker → MoodPicker, new interaction page updated"
```

---

### Task 8: 전체 테스트 + 문서 업데이트

**Files:**
- Modify: `docs/PROJECT_STATE.md`

- [ ] **Step 1: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`

Expected: 모든 테스트 PASS

- [ ] **Step 2: TypeScript 체크**

Run: `cd frontend && npx tsc --noEmit`

Expected: 에러 없음 (ScenarioPicker import 잔여 참조 없어야 함)

- [ ] **Step 3: PROJECT_STATE.md 업데이트**

다음 내용 추가/변경:
- 아키텍처 결정: "시나리오를 관계 단계(자동) + 대화 분위기(유저 선택)로 분리 | 클론 기억 누적과 시나리오 모순 제거"
- 주요 모듈: `config/interaction.ts`에 `getRelationshipStage()` 추가 언급
- 컴포넌트: `ScenarioPicker` → `MoodPicker` 변경 반영
- 다음 작업에서 "시나리오 커스텀" → "관계 단계별 행동 규칙 확장" 으로 변경

- [ ] **Step 4: Commit**

```bash
git add docs/PROJECT_STATE.md
git commit -m "docs: update PROJECT_STATE with scenario system redesign"
```
