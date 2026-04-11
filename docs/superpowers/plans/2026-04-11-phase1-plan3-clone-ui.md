# Phase 1 · Plan 3: Clone CRUD + Persona UI (Data-Driven)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clone 생성·목록·편집 UI + `/api/clones` 4개 라우트. **데이터 드리븐 패턴**으로 Persona 50+ 필드를 단일 렌더러 + 메타데이터로 처리해 코드량 절반 이하. 완료 시: 로그인 후 `/clones`에서 내 Clone(없음 상태)과 NPC 5개 목록 확인, `/clones/new`에서 빠른 폼으로 생성, `/clones/[id]`에서 상세 보기, `/clones/[id]/edit`에서 전체 필드 편집.

**Architecture:** 데이터 드리븐 — `PERSONA_SECTIONS` 메타데이터 배열 하나가 **폼 렌더링 + Zod 검증 + LLM 프롬프트 생성** 3곳에 쓰임. 10개 카테고리 섹션을 별도 컴포넌트로 안 만들고, `PersonaSection` 렌더러 1개가 메타데이터를 읽어 동적 렌더. `PersonaQuickForm` 은 `QUICK_FORM_FIELD_KEYS` 부분집합으로 같은 렌더러 재사용.

**Tech Stack:** Next.js 16 App Router, React Hook Form + Zod, shadcn/ui (form, tabs, select, dialog, toast, avatar, dropdown-menu), Supabase (RLS)

**Spec Reference:** `docs/superpowers/specs/2026-04-11-phase1-digital-clone-design.md` §4

**Domain Skills:** `.claude/skills/persona/SKILL.md`

**Depends On:** Plan 1 (types, pure functions) + Plan 2 (Supabase clients, auth, clones table, NPC seed)

---

## 데이터 드리븐 전략

### 핵심 아이디어

기존 Plan 1에서 `renderPersonaCore` 가 50+ 필드를 하드코딩으로 `addField/addList` 수동 반복했음. Plan 3에서는 **필드 정의를 데이터로 추출**해 재사용:

```
         ┌────────────────────────────────────┐
         │  PERSONA_SECTIONS (데이터)         │
         │  [                                 │
         │    { category: 'identity',         │
         │      label: '기본 정보',           │
         │      fields: [                     │
         │        { key:'name', type:'text'...}│
         │        ...                         │
         │      ]}, ...                       │
         │  ]                                 │
         └────────┬───────────────────────────┘
                  │
       ┌──────────┼──────────┐
       │          │          │
       ▼          ▼          ▼
 [PersonaSection][Zod schema][renderPersonaCore]
  (폼 렌더러)  (자동 검증)   (LLM 프롬프트)
```

같은 데이터 한 벌로 **UI + 검증 + 프롬프트** 3곳 동시 커버. 필드 하나 추가하려면 배열에 한 줄만 추가.

### 기존 `renderPersonaCore` 리팩터링 포함

Plan 1에서 수동 구현한 `renderPersonaCore` 를 **데이터 드리븐으로 재작성**합니다. 기존 테스트는 여전히 녹색 유지 (입력·출력 계약 동일).

---

## File Structure

```
frontend/src/
├── lib/
│   ├── constants/
│   │   └── personaFields.ts              [create] — 핵심 데이터
│   ├── validation/
│   │   └── persona.ts                    [create] — Zod 스키마 자동 생성
│   └── prompts/
│       └── persona.ts                    [modify] — renderPersonaCore 데이터 드리븐 재작성
├── components/
│   ├── ui/                               [add] — shadcn: form, tabs, select, toast, avatar, dropdown-menu
│   ├── persona/
│   │   ├── PersonaSection.tsx            [create] — 단일 렌더러
│   │   ├── PersonaFieldRow.tsx           [create] — 필드 타입별 분기
│   │   ├── ArrayInput.tsx                [create] — 배열 필드 공통
│   │   ├── PersonaQuickForm.tsx          [create] — 빠른 생성 폼
│   │   ├── PersonaFullEditor.tsx         [create] — 전체 편집 (탭 기반)
│   │   └── PersonaSummaryCard.tsx        [create] — 목록용 요약
│   └── clone/
│       ├── CloneCard.tsx                 [create] — 리스트 아이템
│       ├── CloneList.tsx                 [create] — 내 Clone + NPC 분리
│       └── CloneNpcBadge.tsx             [create] — NPC 마크
└── app/
    ├── clones/
    │   ├── page.tsx                      [modify] — 실제 리스트
    │   ├── new/
    │   │   └── page.tsx                  [create] — 빠른 폼
    │   └── [id]/
    │       ├── page.tsx                  [create] — 상세
    │       └── edit/
    │           └── page.tsx              [create] — 전체 편집
    └── api/
        └── clones/
            ├── route.ts                  [create] — GET (목록) + POST (생성)
            └── [id]/
                └── route.ts              [create] — GET/PATCH/DELETE
```

---

## Milestone A: Foundation

### Task A1: shadcn 프리미티브 추가

**Files:** `frontend/src/components/ui/` 하위에 신규 컴포넌트 파일들 (shadcn CLI 자동 생성)

- [ ] **Step 1: shadcn primitives 일괄 설치**

Run (in `frontend/`):
```bash
bunx shadcn@latest add form tabs select toast avatar dropdown-menu
```
If `bunx` not available, use `npx shadcn@latest add ...`.

Expected: 파일들 `src/components/ui/` 에 추가됨. 기존 button/input/textarea/card/label/skeleton 은 유지.

- [ ] **Step 2: typecheck**

Run: `npm run typecheck` → PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/jh/dating
git add frontend/src/components/ui/ frontend/package.json frontend/package-lock.json
git commit -m "chore: add shadcn primitives (form, tabs, select, toast, avatar, dropdown-menu)"
```

---

### Task A2: Persona 필드 메타데이터

**Files:**
- Create: `frontend/src/lib/constants/personaFields.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/constants/personaFields.ts
// Persona 필드 메타데이터 — 폼/검증/프롬프트 전반에서 재사용
//
// 주의: field.key 값은 types/persona.ts의 Persona 인터페이스 키와 정확히 일치해야 함

import type { Persona } from '@/types/persona'

export type PersonaFieldType =
  | 'text'       // 단일 줄 문자열
  | 'number'     // 정수
  | 'textarea'   // 긴 문자열
  | 'array'      // 문자열 배열 (쉼표 구분 입력)
  | 'select'     // 고정 옵션 중 택1

export interface PersonaFieldDef {
  key: keyof Persona
  label: string
  type: PersonaFieldType
  placeholder?: string
  helpText?: string
  options?: readonly string[]
}

export interface PersonaSectionDef {
  category: string
  label: string
  fields: readonly PersonaFieldDef[]
}

export const PERSONA_SECTIONS: readonly PersonaSectionDef[] = [
  {
    category: 'identity',
    label: '기본 정보',
    fields: [
      { key: 'name', label: '이름', type: 'text', placeholder: '예: 김지수' },
      { key: 'age', label: '나이', type: 'number' },
      { key: 'gender', label: '성별', type: 'select', options: ['여성', '남성', '논바이너리', '기타'] },
      { key: 'location', label: '지역', type: 'text', placeholder: '예: 서울 마포구' },
      { key: 'occupation', label: '직업', type: 'text' },
      { key: 'education', label: '학력', type: 'text' },
      { key: 'languages', label: '사용 언어', type: 'array', helpText: '쉼표로 구분' },
    ],
  },
  {
    category: 'personality',
    label: '성격',
    fields: [
      { key: 'mbti', label: 'MBTI', type: 'text', placeholder: 'INFJ' },
      { key: 'personality_traits', label: '성격 특징', type: 'array' },
      { key: 'strengths', label: '강점', type: 'array' },
      { key: 'weaknesses', label: '약점', type: 'array' },
      { key: 'humor_style', label: '유머 스타일', type: 'textarea' },
      { key: 'emotional_expression', label: '감정 표현 방식', type: 'textarea' },
    ],
  },
  {
    category: 'values',
    label: '가치관 & 신념',
    fields: [
      { key: 'core_values', label: '핵심 가치관', type: 'array' },
      { key: 'beliefs', label: '신념', type: 'array', helpText: '종교·정치관 — 공유하고 싶은 선에서' },
      { key: 'life_philosophy', label: '인생관', type: 'textarea' },
      { key: 'dealbreakers', label: '절대 받아들일 수 없는 것', type: 'array' },
    ],
  },
  {
    category: 'interests',
    label: '취미 & 관심사',
    fields: [
      { key: 'hobbies', label: '취미', type: 'array' },
      { key: 'food_preferences', label: '음식 취향', type: 'array' },
      { key: 'travel_style', label: '여행 스타일', type: 'textarea' },
    ],
  },
  {
    category: 'history',
    label: '과거 & 경험',
    fields: [
      { key: 'background_story', label: '성장 배경', type: 'textarea' },
      { key: 'key_life_events', label: '인생 주요 사건', type: 'array' },
      { key: 'career_history', label: '커리어', type: 'textarea' },
      { key: 'past_relationships_summary', label: '과거 연애사 (선택)', type: 'textarea', helpText: '민감 — 공유 원할 때만' },
    ],
  },
  {
    category: 'relationships',
    label: '인간관계',
    fields: [
      { key: 'family_description', label: '가족', type: 'textarea' },
      { key: 'close_friends_count', label: '친한 친구 수', type: 'number' },
      { key: 'social_style', label: '사교 스타일', type: 'textarea' },
      { key: 'relationship_with_family', label: '가족 관계', type: 'textarea' },
    ],
  },
  {
    category: 'lifestyle',
    label: '라이프스타일',
    fields: [
      { key: 'daily_routine', label: '일과', type: 'textarea' },
      { key: 'sleep_schedule', label: '수면 습관', type: 'text' },
      { key: 'exercise_habits', label: '운동 습관', type: 'text' },
      { key: 'diet', label: '식사', type: 'text' },
      { key: 'pets', label: '반려동물', type: 'text' },
      { key: 'living_situation', label: '거주 형태', type: 'text', placeholder: '1인 가구, 가족과 거주 등' },
    ],
  },
  {
    category: 'communication',
    label: '커뮤니케이션',
    fields: [
      { key: 'communication_style', label: '커뮤니케이션 스타일', type: 'textarea' },
      { key: 'conversation_preferences', label: '대화 선호', type: 'array' },
      { key: 'texting_style', label: '메시지 스타일', type: 'textarea' },
      { key: 'response_speed', label: '응답 속도', type: 'text' },
    ],
  },
  {
    category: 'goals',
    label: '목표 & 바람',
    fields: [
      { key: 'short_term_goals', label: '단기 목표', type: 'array' },
      { key: 'long_term_goals', label: '장기 목표', type: 'array' },
      { key: 'what_seeking_in_others', label: '상대에게 바라는 점', type: 'textarea' },
      { key: 'relationship_goal', label: '관계 목적', type: 'textarea' },
    ],
  },
  {
    category: 'self',
    label: '자기소개',
    fields: [
      { key: 'self_description', label: '자기소개', type: 'textarea' },
      { key: 'tags', label: '태그', type: 'array' },
    ],
  },
] as const

// 빠른 폼에 쓰는 필드 부분집합
export const QUICK_FORM_FIELD_KEYS: ReadonlyArray<keyof Persona> = [
  'name',
  'age',
  'gender',
  'occupation',
  'mbti',
  'personality_traits',
  'core_values',
  'hobbies',
  'communication_style',
  'self_description',
] as const

// 빠른 폼용 필드 정의 배열
export const QUICK_FORM_FIELDS: readonly PersonaFieldDef[] = PERSONA_SECTIONS
  .flatMap((s) => s.fields)
  .filter((f) => QUICK_FORM_FIELD_KEYS.includes(f.key))
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck` → PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/constants/personaFields.ts
git commit -m "feat: add data-driven persona field metadata (PERSONA_SECTIONS)"
```

---

### Task A3: Zod 검증 스키마 (데이터 기반 자동 생성)

**Files:**
- Create: `frontend/src/lib/validation/persona.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/validation/persona.ts
// PERSONA_SECTIONS 데이터로부터 Zod 스키마를 자동 생성
import { z } from 'zod'
import {
  PERSONA_SECTIONS,
  type PersonaFieldDef,
  type PersonaFieldType,
} from '@/lib/constants/personaFields'

function nullableEmptyString(): z.ZodType<string | null> {
  return z
    .union([z.string(), z.null()])
    .transform((v) => (v === '' || v === null ? null : v))
}

function nullableNumber(): z.ZodType<number | null> {
  return z
    .union([z.number(), z.null(), z.string()])
    .transform((v) => {
      if (v === null || v === '' || v === undefined) return null
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : null
    })
}

function nullableStringArray(): z.ZodType<string[] | null> {
  return z
    .union([z.array(z.string()), z.null()])
    .transform((arr) => (arr === null || arr.length === 0 ? null : arr))
}

function fieldToZod(field: PersonaFieldDef): z.ZodTypeAny {
  switch (field.type) {
    case 'text':
    case 'textarea':
      // name 필드만 필수
      if (field.key === 'name') {
        return z.string().min(1, '이름은 필수입니다')
      }
      return nullableEmptyString()
    case 'number':
      return nullableNumber()
    case 'array':
      return nullableStringArray()
    case 'select':
      if (!field.options) return nullableEmptyString()
      return z
        .union([z.enum(field.options as readonly [string, ...string[]]), z.null()])
        .nullable()
  }
}

// PERSONA_SECTIONS 의 모든 필드를 순회해 z.object 빌드
const personaShape: Record<string, z.ZodTypeAny> = {}
for (const section of PERSONA_SECTIONS) {
  for (const field of section.fields) {
    personaShape[field.key as string] = fieldToZod(field)
  }
}

// 특수 필드 (favorite_media 는 중첩 객체)
personaShape.favorite_media = z
  .object({
    movies: nullableStringArray(),
    books: nullableStringArray(),
    music: nullableStringArray(),
    games: nullableStringArray(),
  })
  .nullable()

export const personaSchema = z.object(personaShape)
export type PersonaInput = z.input<typeof personaSchema>
export type PersonaParsed = z.output<typeof personaSchema>

// 부분 업데이트용 (PATCH)
export const personaPartialSchema = personaSchema.partial()

// Clone 생성 요청 스키마
export const createCloneSchema = z.object({
  persona: personaSchema,
})

// Clone PATCH 요청 스키마
export const updateCloneSchema = z.object({
  persona: personaPartialSchema.optional(),
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
})
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck` → PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/validation/persona.ts
git commit -m "feat: auto-generate Persona Zod schema from field metadata"
```

---

### Task A4: `renderPersonaCore` 데이터 드리븐 재작성 (기존 테스트 유지)

**Files:**
- Modify: `frontend/src/lib/prompts/persona.ts`

- [ ] **Step 1: renderPersonaCore 함수 교체**

`frontend/src/lib/prompts/persona.ts` 의 `renderPersonaCore` 를 다음으로 교체:

```ts
import type { Persona, CloneMemory } from '@/types/persona'
import { BEHAVIOR_INSTRUCTIONS } from './behavior'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
import { PERSONA_SECTIONS } from '@/lib/constants/personaFields'

export function renderPersonaCore(persona: Persona): string {
  const lines: string[] = [`이름: ${persona.name}`]

  for (const section of PERSONA_SECTIONS) {
    for (const field of section.fields) {
      if (field.key === 'name') continue // 이미 위에서 추가

      const value = persona[field.key] as unknown
      if (value === null || value === undefined || value === '') continue

      if (Array.isArray(value)) {
        if (value.length === 0) continue
        lines.push(`${field.label}: ${value.join(', ')}`)
      } else if (typeof value === 'object') {
        // favorite_media 같은 중첩 객체는 현재 Phase 1에서 프롬프트에 포함하지 않음
        continue
      } else {
        lines.push(`${field.label}: ${value}`)
      }
    }
  }

  return lines.join('\n')
}
```

나머지 `renderRecentMemories`, `buildSystemPrompt` 는 변경 없음.

- [ ] **Step 2: 테스트 실행 — 기존 테스트 여전히 녹색**

Run: `npx vitest run src/lib/prompts/persona.test.ts`
Expected: **11 passed** (기존 테스트 그대로)

Plan 1 테스트는 `'이름: 지수'`, `'MBTI: INFJ'`, `'나이: 28'`, `'취미: 독서, 요가'`, `'핵심 가치관: 진정성, 성장'` 같은 라벨을 기대하는데, `PERSONA_SECTIONS` 데이터의 label이 정확히 이와 매치됨. 통과해야 함.

만약 실패하면 라벨 불일치 — `PERSONA_SECTIONS` 데이터와 기존 테스트가 기대하는 라벨을 맞춰 수정.

- [ ] **Step 3: 전체 테스트 회귀 확인**

Run: `npm run test:run`
Expected: 45 passed (회귀 없음)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/prompts/persona.ts
git commit -m "refactor: renderPersonaCore uses PERSONA_SECTIONS data (tests still green)"
```

---

## Milestone B: Persona 폼 컴포넌트

### Task B1: ArrayInput 컴포넌트

**Files:**
- Create: `frontend/src/components/persona/ArrayInput.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/persona/ArrayInput.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface ArrayInputProps {
  value: string[] | null
  onChange: (value: string[] | null) => void
  placeholder?: string
}

export function ArrayInput({ value, onChange, placeholder }: ArrayInputProps) {
  const [draft, setDraft] = useState('')
  const items = value ?? []

  function addItem() {
    const trimmed = draft.trim()
    if (trimmed.length === 0) return
    onChange([...items, trimmed])
    setDraft('')
  }

  function removeAt(index: number) {
    const next = items.filter((_, i) => i !== index)
    onChange(next.length === 0 ? null : next)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addItem()
            }
          }}
          placeholder={placeholder ?? '항목 입력 후 Enter'}
        />
        <Button type="button" variant="outline" onClick={addItem}>
          추가
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <Badge key={`${item}-${i}`} variant="secondary" className="gap-1">
              {item}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="ml-1 rounded hover:bg-muted"
                aria-label={`${item} 삭제`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: badge 프리미티브가 없으면 설치**

Run: `cd frontend && bunx shadcn@latest add badge` (if not installed)

- [ ] **Step 3: typecheck + Commit**

```bash
cd /Users/jh/dating
git add frontend/src/components/persona/ArrayInput.tsx frontend/src/components/ui/badge.tsx 2>/dev/null
git commit -m "feat: ArrayInput component for persona array fields"
```

---

### Task B2: PersonaFieldRow 컴포넌트 (단일 필드 렌더러)

**Files:**
- Create: `frontend/src/components/persona/PersonaFieldRow.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/persona/PersonaFieldRow.tsx
'use client'

import type { Control } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrayInput } from './ArrayInput'
import type { PersonaFieldDef } from '@/lib/constants/personaFields'

interface PersonaFieldRowProps {
  field: PersonaFieldDef
  control: Control<any>
}

export function PersonaFieldRow({ field, control }: PersonaFieldRowProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key as string}>{field.label}</Label>

      <Controller
        name={field.key as string}
        control={control}
        render={({ field: rhfField }) => {
          switch (field.type) {
            case 'text':
              return (
                <Input
                  id={field.key as string}
                  value={rhfField.value ?? ''}
                  onChange={(e) => rhfField.onChange(e.target.value || null)}
                  placeholder={field.placeholder}
                />
              )
            case 'number':
              return (
                <Input
                  id={field.key as string}
                  type="number"
                  value={rhfField.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    rhfField.onChange(v === '' ? null : Number(v))
                  }}
                  placeholder={field.placeholder}
                />
              )
            case 'textarea':
              return (
                <Textarea
                  id={field.key as string}
                  value={rhfField.value ?? ''}
                  onChange={(e) => rhfField.onChange(e.target.value || null)}
                  placeholder={field.placeholder}
                  rows={3}
                />
              )
            case 'select':
              return (
                <Select
                  value={rhfField.value ?? ''}
                  onValueChange={(v) => rhfField.onChange(v || null)}
                >
                  <SelectTrigger id={field.key as string}>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            case 'array':
              return (
                <ArrayInput
                  value={rhfField.value ?? null}
                  onChange={rhfField.onChange}
                  placeholder={field.placeholder}
                />
              )
          }
        }}
      />

      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
git add frontend/src/components/persona/PersonaFieldRow.tsx
git commit -m "feat: PersonaFieldRow renders a single field by type"
```

---

### Task B3: PersonaSection 컴포넌트 (카테고리 단위 렌더러)

**Files:**
- Create: `frontend/src/components/persona/PersonaSection.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/persona/PersonaSection.tsx
'use client'

import type { Control } from 'react-hook-form'
import { PersonaFieldRow } from './PersonaFieldRow'
import {
  PERSONA_SECTIONS,
  type PersonaFieldDef,
  type PersonaSectionDef,
} from '@/lib/constants/personaFields'

interface PersonaSectionProps {
  control: Control<any>
  // 카테고리 이름으로 섹션 선택, 또는 직접 필드 배열 전달
  category?: string
  fields?: readonly PersonaFieldDef[]
  showHeader?: boolean
}

export function PersonaSection({
  control,
  category,
  fields,
  showHeader = true,
}: PersonaSectionProps) {
  let section: PersonaSectionDef | undefined
  let targetFields: readonly PersonaFieldDef[]

  if (fields) {
    targetFields = fields
  } else if (category) {
    section = PERSONA_SECTIONS.find((s) => s.category === category)
    if (!section) return null
    targetFields = section.fields
  } else {
    return null
  }

  return (
    <div className="space-y-4">
      {showHeader && section && (
        <h3 className="text-lg font-semibold">{section.label}</h3>
      )}
      <div className="space-y-4">
        {targetFields.map((field) => (
          <PersonaFieldRow key={field.key as string} field={field} control={control} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
git add frontend/src/components/persona/PersonaSection.tsx
git commit -m "feat: PersonaSection data-driven category renderer"
```

---

### Task B4: PersonaQuickForm

**Files:**
- Create: `frontend/src/components/persona/PersonaQuickForm.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/persona/PersonaQuickForm.tsx
'use client'

import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { PersonaSection } from './PersonaSection'
import { QUICK_FORM_FIELDS } from '@/lib/constants/personaFields'
import { personaSchema, type PersonaInput } from '@/lib/validation/persona'

interface PersonaQuickFormProps {
  onSubmit: (persona: PersonaInput) => Promise<void>
  submitting?: boolean
}

export function PersonaQuickForm({ onSubmit, submitting }: PersonaQuickFormProps) {
  const methods = useForm<PersonaInput>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      name: '',
      age: null,
      gender: null,
      location: null,
      occupation: null,
      education: null,
      languages: null,
      mbti: null,
      personality_traits: null,
      strengths: null,
      weaknesses: null,
      humor_style: null,
      emotional_expression: null,
      core_values: null,
      beliefs: null,
      life_philosophy: null,
      dealbreakers: null,
      hobbies: null,
      favorite_media: null,
      food_preferences: null,
      travel_style: null,
      background_story: null,
      key_life_events: null,
      career_history: null,
      past_relationships_summary: null,
      family_description: null,
      close_friends_count: null,
      social_style: null,
      relationship_with_family: null,
      daily_routine: null,
      sleep_schedule: null,
      exercise_habits: null,
      diet: null,
      pets: null,
      living_situation: null,
      communication_style: null,
      conversation_preferences: null,
      texting_style: null,
      response_speed: null,
      short_term_goals: null,
      long_term_goals: null,
      what_seeking_in_others: null,
      relationship_goal: null,
      self_description: null,
      tags: null,
    },
  })

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <PersonaSection
          control={methods.control}
          fields={QUICK_FORM_FIELDS}
          showHeader={false}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? '생성 중...' : 'Clone 생성'}
        </Button>
      </form>
    </FormProvider>
  )
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
git add frontend/src/components/persona/PersonaQuickForm.tsx
git commit -m "feat: PersonaQuickForm uses data-driven QUICK_FORM_FIELDS"
```

---

### Task B5: PersonaFullEditor

**Files:**
- Create: `frontend/src/components/persona/PersonaFullEditor.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/persona/PersonaFullEditor.tsx
'use client'

import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PersonaSection } from './PersonaSection'
import { PERSONA_SECTIONS } from '@/lib/constants/personaFields'
import { personaSchema, type PersonaInput } from '@/lib/validation/persona'
import type { Persona } from '@/types/persona'

interface PersonaFullEditorProps {
  initialPersona: Persona
  onSubmit: (persona: PersonaInput) => Promise<void>
  submitting?: boolean
}

export function PersonaFullEditor({
  initialPersona,
  onSubmit,
  submitting,
}: PersonaFullEditorProps) {
  const methods = useForm<PersonaInput>({
    resolver: zodResolver(personaSchema),
    defaultValues: initialPersona as unknown as PersonaInput,
  })

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <Tabs defaultValue={PERSONA_SECTIONS[0].category}>
          <TabsList className="flex-wrap">
            {PERSONA_SECTIONS.map((s) => (
              <TabsTrigger key={s.category} value={s.category}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {PERSONA_SECTIONS.map((s) => (
            <TabsContent key={s.category} value={s.category} className="mt-4">
              <PersonaSection control={methods.control} category={s.category} />
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
git add frontend/src/components/persona/PersonaFullEditor.tsx
git commit -m "feat: PersonaFullEditor with category tabs (data-driven)"
```

---

### Task B6: PersonaSummaryCard

**Files:**
- Create: `frontend/src/components/persona/PersonaSummaryCard.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/persona/PersonaSummaryCard.tsx
import type { Persona } from '@/types/persona'
import { Badge } from '@/components/ui/badge'

interface PersonaSummaryCardProps {
  persona: Persona
}

export function PersonaSummaryCard({ persona }: PersonaSummaryCardProps) {
  const chips: string[] = []
  if (persona.age !== null) chips.push(`${persona.age}세`)
  if (persona.gender) chips.push(persona.gender)
  if (persona.mbti) chips.push(persona.mbti)
  if (persona.occupation) chips.push(persona.occupation)

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-semibold">{persona.name}</h2>
        {chips.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {chips.join(' · ')}
          </p>
        )}
      </div>

      {persona.self_description && (
        <p className="text-sm">{persona.self_description}</p>
      )}

      {persona.tags && persona.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {persona.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
git add frontend/src/components/persona/PersonaSummaryCard.tsx
git commit -m "feat: PersonaSummaryCard for list/detail display"
```

---

## Milestone C: Clone List 컴포넌트

### Task C1: CloneNpcBadge

**Files:**
- Create: `frontend/src/components/clone/CloneNpcBadge.tsx`

- [ ] **Step 1: 작성**

```tsx
// frontend/src/components/clone/CloneNpcBadge.tsx
import { Badge } from '@/components/ui/badge'

export function CloneNpcBadge() {
  return (
    <Badge variant="secondary" className="text-xs">
      NPC
    </Badge>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/clone/CloneNpcBadge.tsx
git commit -m "feat: CloneNpcBadge"
```

---

### Task C2: CloneCard

**Files:**
- Create: `frontend/src/components/clone/CloneCard.tsx`

- [ ] **Step 1: 작성**

```tsx
// frontend/src/components/clone/CloneCard.tsx
import Link from 'next/link'
import type { Clone } from '@/types/persona'
import { Card } from '@/components/ui/card'
import { CloneNpcBadge } from './CloneNpcBadge'

interface CloneCardProps {
  clone: Clone
}

export function CloneCard({ clone }: CloneCardProps) {
  const persona = clone.persona_json
  const chips: string[] = []
  if (persona.age !== null) chips.push(`${persona.age}`)
  if (persona.occupation) chips.push(persona.occupation)
  if (persona.mbti) chips.push(persona.mbti)

  return (
    <Link href={`/clones/${clone.id}`}>
      <Card className="p-4 transition hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{clone.name}</h3>
          {clone.is_npc && <CloneNpcBadge />}
        </div>
        {chips.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {chips.join(' · ')}
          </p>
        )}
        {persona.self_description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {persona.self_description}
          </p>
        )}
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/clone/CloneCard.tsx
git commit -m "feat: CloneCard list item"
```

---

### Task C3: CloneList

**Files:**
- Create: `frontend/src/components/clone/CloneList.tsx`

- [ ] **Step 1: 작성**

```tsx
// frontend/src/components/clone/CloneList.tsx
import Link from 'next/link'
import type { Clone } from '@/types/persona'
import { Button } from '@/components/ui/button'
import { CloneCard } from './CloneCard'

interface CloneListProps {
  mine: Clone[]
  npcs: Clone[]
}

export function CloneList({ mine, npcs }: CloneListProps) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">내 Clone</h2>
          <Button asChild size="sm">
            <Link href="/clones/new">+ 새 Clone 만들기</Link>
          </Button>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 Clone이 없어요. 새로 만들어보세요.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((c) => (
              <CloneCard key={c.id} clone={c} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">NPC Clone</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {npcs.map((c) => (
            <CloneCard key={c.id} clone={c} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/clone/CloneList.tsx
git commit -m "feat: CloneList with my clones and NPC sections"
```

---

## Milestone D: API Routes

### Task D1: GET/POST /api/clones

**Files:**
- Create: `frontend/src/app/api/clones/route.ts`

- [ ] **Step 1: 작성**

```ts
// frontend/src/app/api/clones/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createCloneSchema } from '@/lib/validation/persona'
import { buildSystemPrompt } from '@/lib/prompts/persona'
import { errors, AppError } from '@/lib/errors'
import type { Persona, Clone } from '@/types/persona'

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

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    // 내 Clone
    const { data: mine, error: mineError } = await supabase
      .from('clones')
      .select('*')
      .eq('is_npc', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (mineError) throw errors.validation(mineError.message)

    // NPC
    const { data: npcs, error: npcsError } = await supabase
      .from('clones')
      .select('*')
      .eq('is_npc', true)
      .is('deleted_at', null)
      .order('name')

    if (npcsError) throw errors.validation(npcsError.message)

    return NextResponse.json({
      mine: mine ?? [],
      npcs: npcs ?? [],
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const body = await request.json()
    const parsed = createCloneSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    const persona = parsed.data.persona as unknown as Persona
    const systemPrompt = buildSystemPrompt(persona, [])

    // Service client로 INSERT (RLS 통과)
    const admin = createServiceClient()
    const { data, error } = await admin
      .from('clones')
      .insert({
        user_id: user.id,
        is_npc: false,
        name: persona.name,
        persona_json: persona,
        system_prompt: systemPrompt,
      })
      .select()
      .single()

    if (error) throw errors.validation(error.message)

    return NextResponse.json({ clone: data as Clone })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: typecheck + build**

Run: `cd frontend && npm run typecheck && npm run build`
Expected: PASS, route `/api/clones` in output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/clones/route.ts
git commit -m "feat: GET/POST /api/clones with validation and service client insert"
```

---

### Task D2: GET/PATCH/DELETE /api/clones/[id]

**Files:**
- Create: `frontend/src/app/api/clones/[id]/route.ts`

- [ ] **Step 1: 작성**

```ts
// frontend/src/app/api/clones/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateCloneSchema } from '@/lib/validation/persona'
import { buildSystemPrompt } from '@/lib/prompts/persona'
import { errors, AppError } from '@/lib/errors'
import type { Persona } from '@/types/persona'

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: clone, error } = await supabase
      .from('clones')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !clone) throw errors.notFound('Clone')

    // 최근 메모리도 함께
    const { data: memories } = await supabase
      .from('clone_memories')
      .select('*')
      .eq('clone_id', id)
      .order('occurred_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      clone,
      memories: memories ?? [],
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    // 소유권 검증
    const { data: existing } = await supabase
      .from('clones')
      .select('id, is_npc, user_id, persona_json')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!existing) throw errors.notFound('Clone')
    if (existing.is_npc) throw errors.forbidden()
    if (existing.user_id !== user.id) throw errors.forbidden()

    const body = await request.json()
    const parsed = updateCloneSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }

    const admin = createServiceClient()
    const updates: Record<string, unknown> = {}

    if (parsed.data.persona !== undefined) {
      // 부분 업데이트 병합
      const merged = {
        ...(existing.persona_json as Persona),
        ...parsed.data.persona,
      } as Persona
      updates.persona_json = merged
      updates.system_prompt = buildSystemPrompt(merged, [])
      if (parsed.data.persona.name) {
        updates.name = parsed.data.persona.name
      }
    }
    if (parsed.data.name) updates.name = parsed.data.name
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active

    const { data, error } = await admin
      .from('clones')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw errors.validation(error.message)
    return NextResponse.json({ clone: data })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    const { data: existing } = await supabase
      .from('clones')
      .select('id, is_npc, user_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!existing) throw errors.notFound('Clone')
    if (existing.is_npc) throw errors.forbidden()
    if (existing.user_id !== user.id) throw errors.forbidden()

    const admin = createServiceClient()
    const { error } = await admin
      .from('clones')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw errors.validation(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: typecheck + build + Commit**

```bash
cd frontend && npm run typecheck && npm run build
cd /Users/jh/dating
git add frontend/src/app/api/clones/[id]/route.ts
git commit -m "feat: GET/PATCH/DELETE /api/clones/[id] with ownership checks"
```

---

## Milestone E: Pages

### Task E1: /clones 목록 페이지

**Files:**
- Modify: `frontend/src/app/clones/page.tsx`

- [ ] **Step 1: 작성**

```tsx
// frontend/src/app/clones/page.tsx
import { createClient } from '@/lib/supabase/server'
import { CloneList } from '@/components/clone/CloneList'
import type { Clone } from '@/types/persona'

export default async function ClonesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [mineResult, npcsResult] = await Promise.all([
    supabase
      .from('clones')
      .select('*')
      .eq('is_npc', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('clones')
      .select('*')
      .eq('is_npc', true)
      .is('deleted_at', null)
      .order('name'),
  ])

  const mine = (mineResult.data ?? []) as Clone[]
  const npcs = (npcsResult.data ?? []) as Clone[]

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Clones</h1>
        <p className="text-sm text-muted-foreground">
          {user?.email}
        </p>
      </header>
      <CloneList mine={mine} npcs={npcs} />
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/clones/page.tsx
git commit -m "feat: /clones list page with mine and NPC sections"
```

---

### Task E2: /clones/new 생성 페이지

**Files:**
- Create: `frontend/src/app/clones/new/page.tsx`

- [ ] **Step 1: 작성**

```tsx
// frontend/src/app/clones/new/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PersonaQuickForm } from '@/components/persona/PersonaQuickForm'
import { Card } from '@/components/ui/card'
import type { PersonaInput } from '@/lib/validation/persona'

export default function NewClonePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(persona: PersonaInput) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/clones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? 'Clone 생성 실패')
      }
      const { clone } = await res.json()
      router.push(`/clones/${clone.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">새 Clone 만들기</h1>
        <p className="text-sm text-muted-foreground">
          핵심 필드만 입력해 빠르게 만들고, 나중에 상세 편집에서 보강할 수 있습니다.
        </p>
      </header>
      <Card className="p-6">
        <PersonaQuickForm onSubmit={handleSubmit} submitting={submitting} />
        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/clones/new/page.tsx
git commit -m "feat: /clones/new quick create page"
```

---

### Task E3: /clones/[id] 상세 페이지

**Files:**
- Create: `frontend/src/app/clones/[id]/page.tsx`

- [ ] **Step 1: 작성**

```tsx
// frontend/src/app/clones/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersonaSummaryCard } from '@/components/persona/PersonaSummaryCard'
import { CloneNpcBadge } from '@/components/clone/CloneNpcBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Clone } from '@/types/persona'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CloneDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: clone } = await supabase
    .from('clones')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single<Clone>()

  if (!clone) notFound()

  const isOwner = !clone.is_npc && clone.user_id === user?.id

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/clones" className="text-sm text-muted-foreground hover:underline">
          ← 목록으로
        </Link>
        {isOwner && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/clones/${clone.id}/edit`}>상세 편집</Link>
          </Button>
        )}
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          {clone.is_npc && <CloneNpcBadge />}
        </div>
        <PersonaSummaryCard persona={clone.persona_json} />
      </Card>

      {/* 메모리 타임라인은 Plan 5에서 추가 */}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/clones/[id]/page.tsx
git commit -m "feat: /clones/[id] detail page with edit link"
```

---

### Task E4: /clones/[id]/edit 상세 편집

**Files:**
- Create: `frontend/src/app/clones/[id]/edit/page.tsx`

- [ ] **Step 1: 작성**

```tsx
// frontend/src/app/clones/[id]/edit/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PersonaFullEditor } from '@/components/persona/PersonaFullEditor'
import { Card } from '@/components/ui/card'
import type { Clone, Persona } from '@/types/persona'
import type { PersonaInput } from '@/lib/validation/persona'

export default function CloneEditPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [clone, setClone] = useState<Clone | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/clones/${params.id}`)
        if (!res.ok) throw new Error('로드 실패')
        const body = await res.json()
        setClone(body.clone)
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  async function handleSubmit(persona: PersonaInput) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/clones/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? '저장 실패')
      }
      router.push(`/clones/${params.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </main>
    )
  }

  if (!clone) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-destructive">Clone을 찾을 수 없습니다.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Clone 상세 편집</h1>
        <p className="text-sm text-muted-foreground">{clone.name}</p>
      </header>
      <Card className="p-6">
        <PersonaFullEditor
          initialPersona={clone.persona_json as Persona}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/clones/[id]/edit/page.tsx
git commit -m "feat: /clones/[id]/edit full persona editor page"
```

---

## Milestone F: Final Verification

### Task F1: 전체 회귀 확인

- [ ] **Step 1: 테스트**

Run: `cd frontend && npm run test:run`
Expected: **45 passed** (Plan 1 테스트 여전히 녹색 — `renderPersonaCore` 리팩터링에도 불구하고)

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck` → PASS

- [ ] **Step 3: 빌드**

Run: `npm run build`
Expected: 빌드 성공, 새 라우트들 출력:
```
/
/login
/clones
/clones/new
/clones/[id]
/clones/[id]/edit
/auth/callback
/api/clones
/api/clones/[id]
```

---

### Task F2: 사용자 브라우저 검증 (사용자 수행)

- [ ] **Step 1: dev 서버 기동**

Run: `npm run dev`

- [ ] **Step 2: 로그인 → /clones 플로우**

1. `http://localhost:3000` → 자동으로 `/clones` (이미 로그인 상태)
2. NPC 5개(지민/태현/서연/민재/하린) 카드 보여야 함
3. "내 Clone" 섹션은 비어있음 — "아직 Clone이 없어요" 메시지

- [ ] **Step 3: Clone 생성 테스트**

1. "+ 새 Clone 만들기" 클릭 → `/clones/new`
2. 빠른 폼에 값 입력 (이름 필수, 나머지는 원하는 만큼)
3. "Clone 생성" 클릭 → 생성 후 `/clones/[id]` 로 이동
4. 방금 만든 Clone의 요약 카드 표시

- [ ] **Step 4: 상세 편집 테스트**

1. "상세 편집" 버튼 → `/clones/[id]/edit`
2. 탭 10개 (기본 정보 / 성격 / 가치관 / ...) 확인
3. 아무 필드 변경 후 "저장" → 상세 페이지로 돌아옴, 변경 반영 확인

- [ ] **Step 5: NPC 상세 보기**

1. NPC 카드 하나 클릭 (예: 지민)
2. NPC 페르소나 요약 카드 표시, **"상세 편집" 버튼은 안 보여야 함** (소유자 아니므로)
3. NPC는 수정 불가

- [ ] **Step 6: Supabase Studio 확인**

프로젝트 대시보드 → Table Editor → `clones` → 방금 생성한 Clone 행이 `is_npc=false`, `user_id=내 uid` 로 보여야 함. `persona_json` 에 입력값이 그대로.

---

### Task F3: Plan 3 완료 태그

- [ ] **Step 1: 태그**

```bash
cd /Users/jh/dating
git tag plan3-clone-ui-complete
git log --oneline HEAD -40
```

---

## Self-Review Notes

**Spec coverage** (§4 Frontend + §3 Clone CRUD API):
- ✅ `/api/clones` GET/POST (D1), `/api/clones/[id]` GET/PATCH/DELETE (D2)
- ✅ Zod 검증 (A3, 데이터 자동 생성)
- ✅ PersonaSection 재사용 (B3) — **10개 카테고리 컴포넌트 없이 1개로 통합**
- ✅ PersonaQuickForm (B4), PersonaFullEditor (B5)
- ✅ 페이지 4개 (E1-E4)
- ✅ 낙관적 업데이트는 단순 refetch 사용 (프로토타입 단계)
- ✅ `renderPersonaCore` 데이터 드리븐 리팩터링 (A4, Plan 1 테스트 녹색 유지)

**데이터 드리븐 효과**:
- 10개 section 컴포넌트 → 1개 `PersonaSection` + `PERSONA_SECTIONS` 상수
- Zod 스키마 수동 작성 → 필드 메타데이터에서 자동 생성
- `renderPersonaCore` 수동 addField → 동일 데이터 순회
- 같은 데이터가 **폼 + 검증 + 프롬프트** 3곳에 쓰임

**Placeholder scan**: 없음. 모든 코드 완전.

**Type consistency**:
- `PERSONA_SECTIONS` 의 `field.key` 는 `keyof Persona` 로 타입 강제
- Zod 스키마의 키는 `PERSONA_SECTIONS` 에서 자동 생성, Persona 인터페이스와 매치
- `favorite_media` 는 중첩 객체라 별도 특수 처리 (데이터 드리븐 예외 케이스)
- API 라우트는 `updateCloneSchema` 의 partial 사용

**Risks flagged:**
1. `favorite_media` 중첩 필드는 현재 UI/프롬프트에 포함 안 됨 — 필요 시 별도 섹션으로 추가
2. 낙관적 업데이트 미구현 (fetch + refetch 방식) — Phase 2 폴리싱에서 고려
3. 큰 persona_json 의 form re-render 성능은 측정 필요 — 50+ 필드 watch 중

---

## 다음 Plan 개요

### Plan 4: Interaction Engine + Realtime Viewer
- `lib/claude.ts` Anthropic SDK 래퍼 (재시도 내장)
- `lib/interaction/engine.ts` (20턴 orchestrator, 순수 함수 조합)
- `POST /api/interactions` (동기 실행, 300s 내)
- `/interactions/new`, `/interactions/[id]` 뷰어
- Realtime 구독 + Heartbeat + TypingIndicator

### Plan 5: Memory + Analysis
- `POST /api/memories`, `POST /api/analyses`
- MemoryInputBox, MemoryTimeline
- AnalysisReport with ScoreBar
- Clone 상세 페이지 완성
