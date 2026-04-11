# Phase 1 · Plan 1: Foundation + Core Pure Functions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend 빌드 체인 셋업, shadcn/ui 초기화, Vitest 환경, `lib/` 하위 도메인 로직 순수 함수를 TDD로 전부 구현한다. 완료 시 `bun run test` 녹색, `bun run dev` 로 빈 Next.js 셸이 로딩되며, 핵심 비즈니스 로직 10개 함수가 검증된 상태.

**Architecture:** Next.js 15 App Router + TypeScript strict + Tailwind v4 + shadcn/ui. 모든 도메인 로직은 `lib/` 에 외부 의존성 없는 순수 함수로 존재하고 Vitest로 테스트된다. UI·DB·Claude API는 이후 Plan에서 얇게 얹는다.

**Tech Stack:** Next.js 16.2, React 19, TypeScript 5, Tailwind v4, shadcn/ui, Vitest, Zod, react-hook-form, @hookform/resolvers

**Spec Reference:** [`docs/superpowers/specs/2026-04-11-phase1-digital-clone-design.md`](../specs/2026-04-11-phase1-digital-clone-design.md) §5 (순수 함수 리스트), §2 (Persona 타입)

**Domain Skills:**
- `.claude/skills/persona/SKILL.md` — Persona 전체 스키마, null 처리 원칙
- `.claude/skills/interaction/SKILL.md` — role 재매핑, 종료 조건
- `.claude/skills/db-schema/SKILL.md` — (Plan 2에서 사용, 참고만)

---

## File Structure

```
frontend/
├── package.json                             [modify] — deps 추가
├── tsconfig.json                            [modify] — strict + paths
├── vitest.config.ts                         [create] — 테스트 설정
├── components.json                          [create] — shadcn 설정
├── tailwind.config.ts                       [create] — 토큰 + 플러그인
├── src/
│   ├── app/
│   │   ├── layout.tsx                       [modify] — 폰트, 메타
│   │   ├── page.tsx                         [modify] — 임시 랜딩
│   │   └── globals.css                      [modify] — shadcn 토큰 주입
│   ├── lib/
│   │   ├── config/
│   │   │   ├── interaction.ts               [create] — MAX_TURNS 등
│   │   │   ├── claude.ts                    [create] — 모델 ID, 재시도
│   │   │   └── analysis.ts                  [create] — 카테고리 상수
│   │   ├── constants/
│   │   │   └── persona.ts                   [create] — 열거형 상수
│   │   ├── prompts/
│   │   │   ├── persona.ts                   [create] — buildSystemPrompt 등
│   │   │   ├── persona.test.ts              [create] — 유닛 테스트
│   │   │   ├── interaction.ts               [create] — scenario 템플릿
│   │   │   ├── memory.ts                    [create] — 추출 프롬프트
│   │   │   └── behavior.ts                  [create] — 행동 지시 상수
│   │   ├── interaction/
│   │   │   ├── remap.ts                     [create] — role 재매핑, pickSpeaker
│   │   │   ├── remap.test.ts                [create]
│   │   │   ├── endCheck.ts                  [create] — shouldEnd
│   │   │   └── endCheck.test.ts             [create]
│   │   ├── memory/
│   │   │   ├── extract.ts                   [create] — parseMemoryExtraction, normalizeOccurredAt
│   │   │   └── extract.test.ts              [create]
│   │   ├── analysis/
│   │   │   ├── parse.ts                     [create] — parseAnalysisReport
│   │   │   ├── parse.test.ts                [create]
│   │   │   ├── prompt.ts                    [create] — buildAnalysisPrompt
│   │   │   └── prompt.test.ts               [create]
│   │   ├── errors.ts                        [create] — AppError 팩토리
│   │   └── utils.ts                         [create] — shadcn cn 헬퍼
│   └── types/
│       ├── persona.ts                       [create] — Persona, CloneMemory
│       ├── interaction.ts                   [create] — Interaction, InteractionEvent
│       └── analysis.ts                      [create] — Analysis
```

---

## Milestone A: 빌드 체인 셋업

### Task A1: 의존성 추가

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: 런타임 의존성 추가**

Run (in `frontend/`):
```bash
bun add @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk zod react-hook-form @hookform/resolvers class-variance-authority clsx tailwind-merge lucide-react tailwindcss-animate
```

- [ ] **Step 2: dev 의존성 추가**

Run:
```bash
bun add -d vitest @vitejs/plugin-react @types/node
```

- [ ] **Step 3: scripts에 test 추가**

Edit `frontend/package.json` scripts 블록:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest",
  "test:run": "vitest run",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 4: 설치 검증**

Run: `bun install`
Expected: 에러 없음, `node_modules/` 생성.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/bun.lockb
git commit -m "chore: add runtime and dev dependencies for Phase 1"
```

---

### Task A2: TypeScript strict + path alias

**Files:**
- Modify: `frontend/tsconfig.json`

- [ ] **Step 1: tsconfig 수정**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: typecheck 실행**

Run: `bun run typecheck`
Expected: PASS (파일 없어도 에러 없음)

- [ ] **Step 3: Commit**

```bash
git add frontend/tsconfig.json
git commit -m "chore: enable TypeScript strict mode and @/ path alias"
```

---

### Task A3: Vitest 설정

**Files:**
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1: vitest.config.ts 생성**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: 동작 확인용 임시 테스트**

Create `frontend/src/lib/__smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 3: 테스트 실행**

Run: `bun run test:run`
Expected: `1 passed`

- [ ] **Step 4: 스모크 테스트 제거**

Run: `rm frontend/src/lib/__smoke.test.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/vitest.config.ts
git commit -m "chore: configure vitest with node env and @/ alias"
```

---

### Task A4: shadcn/ui 초기화

**Files:**
- Create: `frontend/components.json`
- Modify: `frontend/src/app/globals.css`
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/tailwind.config.ts`

- [ ] **Step 1: shadcn init 실행**

Run (in `frontend/`): `bunx shadcn@latest init`
Answers:
- Style: Default
- Base color: Slate
- CSS variables: Yes

이 명령이 `components.json`, `src/lib/utils.ts`, `src/app/globals.css`(토큰 추가), `tailwind.config.ts`를 자동 생성/수정합니다.

- [ ] **Step 2: utils.ts 확인**

`frontend/src/lib/utils.ts`는 아래와 같아야 함:
```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: 프리미티브 설치 (Plan 1에서 쓸 것만)**

Run: `bunx shadcn@latest add button input textarea card label skeleton`
Expected: `src/components/ui/` 에 파일 생성.

- [ ] **Step 4: typecheck 확인**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components.json frontend/src/lib/utils.ts frontend/src/app/globals.css frontend/tailwind.config.ts frontend/src/components/ui
git commit -m "chore: initialize shadcn/ui with base primitives"
```

---

### Task A5: 빈 dev 서버 동작 확인

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: 임시 랜딩 페이지 작성**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold">Digital Clone Platform</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Phase 1 — Plan 1 부팅 완료
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: dev 서버 실행 + 브라우저 확인**

Run: `bun run dev`
Expected: `http://localhost:3000` 에서 "Digital Clone Platform" 표시. 콘솔 에러 없음.

확인 후 Ctrl-C 로 종료.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: temporary landing page for Plan 1 boot verification"
```

---

## Milestone B: 도메인 타입 정의

### Task B1: Persona 타입

**Files:**
- Create: `frontend/src/types/persona.ts`

- [ ] **Step 1: Persona 인터페이스 정의**

```ts
export interface Persona {
  // Identity
  name: string
  age: number | null
  gender: string | null
  location: string | null
  occupation: string | null
  education: string | null
  languages: string[] | null

  // Personality
  mbti: string | null
  personality_traits: string[] | null
  strengths: string[] | null
  weaknesses: string[] | null
  humor_style: string | null
  emotional_expression: string | null

  // Values
  core_values: string[] | null
  beliefs: string[] | null
  life_philosophy: string | null
  dealbreakers: string[] | null

  // Interests
  hobbies: string[] | null
  favorite_media: {
    movies: string[] | null
    books: string[] | null
    music: string[] | null
    games: string[] | null
  } | null
  food_preferences: string[] | null
  travel_style: string | null

  // History
  background_story: string | null
  key_life_events: string[] | null
  career_history: string | null
  past_relationships_summary: string | null

  // Relationships
  family_description: string | null
  close_friends_count: number | null
  social_style: string | null
  relationship_with_family: string | null

  // Lifestyle
  daily_routine: string | null
  sleep_schedule: string | null
  exercise_habits: string | null
  diet: string | null
  pets: string | null
  living_situation: string | null

  // Communication
  communication_style: string | null
  conversation_preferences: string[] | null
  texting_style: string | null
  response_speed: string | null

  // Goals
  short_term_goals: string[] | null
  long_term_goals: string[] | null
  what_seeking_in_others: string | null
  relationship_goal: string | null

  // Self
  self_description: string | null
  tags: string[] | null
}

export type CloneMemoryKind = 'event' | 'mood' | 'fact' | 'preference_update'

export interface CloneMemory {
  id: string
  clone_id: string
  kind: CloneMemoryKind
  content: string
  tags: string[]
  occurred_at: string   // ISO date
  created_at: string    // ISO datetime
  relevance_score: number | null
}

export interface Clone {
  id: string
  user_id: string | null
  is_npc: boolean
  version: number
  name: string
  persona_json: Persona
  system_prompt: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/persona.ts
git commit -m "feat: add Persona, CloneMemory, Clone types"
```

---

### Task B2: Interaction 타입

**Files:**
- Create: `frontend/src/types/interaction.ts`

- [ ] **Step 1: 타입 작성**

```ts
export type InteractionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface Interaction {
  id: string
  kind: string
  scenario: string
  setting: string | null
  status: InteractionStatus
  max_turns: number
  metadata: Record<string, unknown>
  created_by: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface InteractionEvent {
  id: string
  interaction_id: string
  turn_number: number
  speaker_clone_id: string
  content: string
  created_at: string
}

export interface InteractionParticipant {
  interaction_id: string
  clone_id: string
  role: string | null
  joined_at: string
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/interaction.ts
git commit -m "feat: add Interaction types"
```

---

### Task B3: Analysis 타입

**Files:**
- Create: `frontend/src/types/analysis.ts`

- [ ] **Step 1: 타입 작성**

```ts
export interface CategoryScore {
  score: number
  comment: string
}

export interface AnalysisReport {
  score: number  // 0-100
  categories: Record<string, CategoryScore>
  summary: string
  recommended_next: 'continue' | 'pause' | 'end'
}

export interface Analysis {
  id: string
  interaction_id: string
  score: number
  report_json: AnalysisReport
  model: string
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/analysis.ts
git commit -m "feat: add Analysis types"
```

---

## Milestone C: 설정 상수

### Task C1: Interaction 설정 상수

**Files:**
- Create: `frontend/src/lib/config/interaction.ts`

- [ ] **Step 1: 상수 작성**

```ts
export const INTERACTION_DEFAULTS = {
  MAX_TURNS: 20,
  MIN_RESPONSE_LENGTH: 10,
  END_SIGNAL_SHORT_TURNS_THRESHOLD: 3,
  MEMORY_INJECTION_LIMIT: 10,
  SYSTEM_PROMPT_TOKEN_BUDGET: 1500,
  HEARTBEAT_WARNING_MS: 5000,
  HEARTBEAT_DANGER_MS: 30000,
} as const

export const END_PROMISE_MARKER = '<promise>END</promise>'

export const DEFAULT_SCENARIOS = [
  {
    id: 'online-first-match',
    label: '온라인 대화 앱에서 처음 매칭됨',
    description: '둘 다 상대방을 오늘 처음 봄',
  },
  {
    id: 'casual-chat',
    label: '친구의 친구로 가볍게 대화',
    description: '서로 이름 정도만 아는 사이',
  },
  {
    id: 'deep-talk',
    label: '깊은 주제 토론',
    description: '가치관·인생관을 나누는 분위기',
  },
] as const
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/config/interaction.ts
git commit -m "feat: add interaction config constants"
```

---

### Task C2: Claude 설정 상수

**Files:**
- Create: `frontend/src/lib/config/claude.ts`

- [ ] **Step 1: 상수 작성**

```ts
export const CLAUDE_MODELS = {
  INTERACTION: 'claude-sonnet-4-6',
  EXTRACTION: 'claude-haiku-4-5-20251001',
  ANALYSIS: 'claude-sonnet-4-6',
} as const

export const CLAUDE_RETRY = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const

export const CLAUDE_LIMITS = {
  MAX_OUTPUT_TOKENS_INTERACTION: 512,
  MAX_OUTPUT_TOKENS_EXTRACTION: 256,
  MAX_OUTPUT_TOKENS_ANALYSIS: 2048,
} as const
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/config/claude.ts
git commit -m "feat: add Claude model and retry constants"
```

---

### Task C3: Analysis 카테고리 상수

**Files:**
- Create: `frontend/src/lib/config/analysis.ts`

- [ ] **Step 1: 상수 작성**

```ts
export const ANALYSIS_CATEGORIES = [
  'conversation_flow',
  'shared_interests',
  'values_alignment',
  'communication_fit',
  'potential_conflicts',
] as const

export type AnalysisCategory = (typeof ANALYSIS_CATEGORIES)[number]

export const ANALYSIS_CATEGORY_LABELS: Record<AnalysisCategory, string> = {
  conversation_flow: '대화 흐름',
  shared_interests: '공통 관심사',
  values_alignment: '가치관 일치',
  communication_fit: '커뮤니케이션 궁합',
  potential_conflicts: '잠재 갈등 지점',
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/config/analysis.ts
git commit -m "feat: add analysis category constants"
```

---

### Task C4: 행동 지시 상수

**Files:**
- Create: `frontend/src/lib/prompts/behavior.ts`

- [ ] **Step 1: 상수 작성**

```ts
export const BEHAVIOR_INSTRUCTIONS = `당신은 지금 한 명의 인간 캐릭터를 연기합니다. 다음 원칙을 지키세요.

1. 위에서 정의된 당신의 정체성(페르소나)에 충실하게 응답하세요.
2. 알 수 없는 주제는 억지로 지어내지 말고, 자연스럽게 회피하거나 "잘 모르겠어" 식으로 답하세요.
3. 상대방의 말투를 따라 하지 마세요. 당신의 커뮤니케이션 스타일을 유지하세요.
4. 한 번에 1-3 문장으로 짧게 답하세요. 독백이나 긴 설명 금지.
5. 대화가 자연스럽게 끝났다고 느껴지면 응답 끝에 <promise>END</promise> 를 포함하세요.
6. 메타 언급 금지 ("AI로서", "시뮬레이션", "프롬프트" 등 언급하지 않음).
`.trim()
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/prompts/behavior.ts
git commit -m "feat: add clone behavior instruction constants"
```

---

## Milestone D: 순수 함수 TDD — Interaction 로직

### Task D1: `remapHistoryForSpeaker` — 빈 입력

**Files:**
- Create: `frontend/src/lib/interaction/remap.test.ts`
- Create: `frontend/src/lib/interaction/remap.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// remap.test.ts
import { describe, it, expect } from 'vitest'
import { remapHistoryForSpeaker } from './remap'
import type { InteractionEvent } from '@/types/interaction'

describe('remapHistoryForSpeaker', () => {
  it('빈 events 배열은 빈 결과를 반환한다', () => {
    const result = remapHistoryForSpeaker([], 'clone-a', new Map())
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `bun run test:run remap`
Expected: FAIL ("Cannot find module './remap'")

- [ ] **Step 3: 최소 구현**

```ts
// remap.ts
import type { InteractionEvent, ClaudeMessage } from '@/types/interaction'

export function remapHistoryForSpeaker(
  events: InteractionEvent[],
  speakerCloneId: string,
  cloneNames: Map<string, string>
): ClaudeMessage[] {
  return []
}
```

- [ ] **Step 4: 테스트 실행 → 통과**

Run: `bun run test:run remap`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/interaction/remap.ts frontend/src/lib/interaction/remap.test.ts
git commit -m "test: remap empty events returns empty array"
```

---

### Task D2: `remapHistoryForSpeaker` — 발화자 자신

**Files:**
- Modify: `frontend/src/lib/interaction/remap.test.ts`
- Modify: `frontend/src/lib/interaction/remap.ts`

- [ ] **Step 1: 실패 테스트 추가**

```ts
// remap.test.ts — 기존 describe 블록에 추가
it('발화자 본인의 턴은 role=assistant, content 그대로', () => {
  const events: InteractionEvent[] = [
    {
      id: '1', interaction_id: 'i1', turn_number: 0,
      speaker_clone_id: 'clone-a', content: '안녕하세요',
      created_at: '2026-04-11T00:00:00Z',
    },
  ]
  const names = new Map([['clone-a', '지수'], ['clone-b', '태현']])
  const result = remapHistoryForSpeaker(events, 'clone-a', names)
  expect(result).toEqual([
    { role: 'assistant', content: '안녕하세요' },
  ])
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `bun run test:run remap`
Expected: FAIL (현재 빈 배열 반환)

- [ ] **Step 3: 구현 갱신**

```ts
// remap.ts
export function remapHistoryForSpeaker(
  events: InteractionEvent[],
  speakerCloneId: string,
  cloneNames: Map<string, string>
): ClaudeMessage[] {
  return events.map((e) => {
    if (e.speaker_clone_id === speakerCloneId) {
      return { role: 'assistant' as const, content: e.content }
    }
    const name = cloneNames.get(e.speaker_clone_id) ?? 'Unknown'
    return { role: 'user' as const, content: `[${name}]: ${e.content}` }
  })
}
```

- [ ] **Step 4: 테스트 실행 → 통과**

Run: `bun run test:run remap`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/interaction/remap.ts frontend/src/lib/interaction/remap.test.ts
git commit -m "feat: remap speaker's own turns as assistant role"
```

---

### Task D3: `remapHistoryForSpeaker` — 타인 발화

**Files:**
- Modify: `frontend/src/lib/interaction/remap.test.ts`

- [ ] **Step 1: 테스트 추가 (이미 구현은 처리)**

```ts
it('타인의 턴은 role=user, [이름]: 접두어', () => {
  const events: InteractionEvent[] = [
    {
      id: '1', interaction_id: 'i1', turn_number: 0,
      speaker_clone_id: 'clone-a', content: '안녕',
      created_at: '2026-04-11T00:00:00Z',
    },
    {
      id: '2', interaction_id: 'i1', turn_number: 1,
      speaker_clone_id: 'clone-b', content: '반가워요',
      created_at: '2026-04-11T00:00:01Z',
    },
  ]
  const names = new Map([['clone-a', '지수'], ['clone-b', '태현']])
  const result = remapHistoryForSpeaker(events, 'clone-a', names)
  expect(result).toEqual([
    { role: 'assistant', content: '안녕' },
    { role: 'user', content: '[태현]: 반가워요' },
  ])
})

it('이름 맵에 없는 clone은 Unknown으로 대체', () => {
  const events: InteractionEvent[] = [
    {
      id: '1', interaction_id: 'i1', turn_number: 0,
      speaker_clone_id: 'clone-x', content: 'hi',
      created_at: '2026-04-11T00:00:00Z',
    },
  ]
  const result = remapHistoryForSpeaker(events, 'clone-a', new Map())
  expect(result).toEqual([{ role: 'user', content: '[Unknown]: hi' }])
})
```

- [ ] **Step 2: 테스트 실행 → 통과**

Run: `bun run test:run remap`
Expected: `4 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/interaction/remap.test.ts
git commit -m "test: remap covers other speakers with name prefix"
```

---

### Task D4: `pickSpeaker`

**Files:**
- Modify: `frontend/src/lib/interaction/remap.ts`
- Modify: `frontend/src/lib/interaction/remap.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { pickSpeaker } from './remap'
import type { Clone } from '@/types/persona'

function makeClone(id: string, name: string): Clone {
  return {
    id, user_id: null, is_npc: false, version: 1, name,
    persona_json: { name } as Clone['persona_json'],
    system_prompt: null, is_active: true,
    created_at: '', updated_at: '',
  }
}

describe('pickSpeaker', () => {
  it('턴 번호 mod N 으로 참여자를 순환 선택', () => {
    const a = makeClone('a', 'A')
    const b = makeClone('b', 'B')
    expect(pickSpeaker([a, b], 0).id).toBe('a')
    expect(pickSpeaker([a, b], 1).id).toBe('b')
    expect(pickSpeaker([a, b], 2).id).toBe('a')
  })

  it('참여자 3명일 때도 순환', () => {
    const a = makeClone('a', 'A')
    const b = makeClone('b', 'B')
    const c = makeClone('c', 'C')
    expect(pickSpeaker([a, b, c], 0).id).toBe('a')
    expect(pickSpeaker([a, b, c], 3).id).toBe('a')
    expect(pickSpeaker([a, b, c], 7).id).toBe('b')
  })

  it('참여자 빈 배열은 throw', () => {
    expect(() => pickSpeaker([], 0)).toThrow()
  })
})
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `bun run test:run remap`
Expected: FAIL (pickSpeaker undefined)

- [ ] **Step 3: 구현**

```ts
// remap.ts 에 추가
import type { Clone } from '@/types/persona'

export function pickSpeaker(participants: Clone[], turnNumber: number): Clone {
  if (participants.length === 0) {
    throw new Error('pickSpeaker: participants cannot be empty')
  }
  return participants[turnNumber % participants.length]
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run remap`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/interaction/remap.ts frontend/src/lib/interaction/remap.test.ts
git commit -m "feat: pickSpeaker cycles through participants by turn"
```

---

### Task D5: `shouldEnd` — 최대 턴 도달

**Files:**
- Create: `frontend/src/lib/interaction/endCheck.test.ts`
- Create: `frontend/src/lib/interaction/endCheck.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// endCheck.test.ts
import { describe, it, expect } from 'vitest'
import { shouldEnd } from './endCheck'
import type { InteractionEvent } from '@/types/interaction'

function event(turn: number, content: string): InteractionEvent {
  return {
    id: `e${turn}`, interaction_id: 'i1', turn_number: turn,
    speaker_clone_id: turn % 2 === 0 ? 'a' : 'b',
    content, created_at: '',
  }
}

describe('shouldEnd', () => {
  it('events.length >= maxTurns 면 true', () => {
    const events = Array.from({ length: 20 }, (_, i) => event(i, '대화'))
    expect(shouldEnd(events, 20, '마지막 응답')).toBe(true)
  })

  it('events.length < maxTurns 면 false (긴 응답)', () => {
    const events = [event(0, '안녕하세요 반가워요')]
    expect(shouldEnd(events, 20, '안녕하세요 반가워요')).toBe(false)
  })
})
```

- [ ] **Step 2: 실행 → 실패**

Run: `bun run test:run endCheck`
Expected: FAIL

- [ ] **Step 3: 최소 구현**

```ts
// endCheck.ts
import type { InteractionEvent } from '@/types/interaction'
import {
  INTERACTION_DEFAULTS,
  END_PROMISE_MARKER,
} from '@/lib/config/interaction'

export function shouldEnd(
  events: InteractionEvent[],
  maxTurns: number,
  lastResponse: string
): boolean {
  if (events.length >= maxTurns) return true
  return false
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run endCheck`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/interaction/endCheck.ts frontend/src/lib/interaction/endCheck.test.ts
git commit -m "feat: shouldEnd detects max turns reached"
```

---

### Task D6: `shouldEnd` — END 시그널

**Files:**
- Modify: `frontend/src/lib/interaction/endCheck.test.ts`
- Modify: `frontend/src/lib/interaction/endCheck.ts`

- [ ] **Step 1: 테스트 추가**

```ts
it('lastResponse 에 END 마커 포함되면 true', () => {
  expect(
    shouldEnd([event(0, '안녕')], 20, '잘 가요 <promise>END</promise>')
  ).toBe(true)
})
```

- [ ] **Step 2: 실행 → 실패**

Run: `bun run test:run endCheck`

- [ ] **Step 3: 구현 갱신**

```ts
export function shouldEnd(
  events: InteractionEvent[],
  maxTurns: number,
  lastResponse: string
): boolean {
  if (events.length >= maxTurns) return true
  if (lastResponse.includes(END_PROMISE_MARKER)) return true
  return false
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run endCheck`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/interaction/endCheck.ts frontend/src/lib/interaction/endCheck.test.ts
git commit -m "feat: shouldEnd detects END promise marker"
```

---

### Task D7: `shouldEnd` — 연속 짧은 응답

**Files:**
- Modify: `frontend/src/lib/interaction/endCheck.test.ts`
- Modify: `frontend/src/lib/interaction/endCheck.ts`

- [ ] **Step 1: 테스트 추가**

```ts
it('최근 3턴 모두 content.length < 10 이면 true', () => {
  const events = [
    event(0, '이것은 충분히 긴 응답입니다'),
    event(1, '네'),
    event(2, '응'),
    event(3, '응'),
  ]
  expect(shouldEnd(events, 20, '응')).toBe(true)
})

it('최근 3턴 중 하나라도 길면 false', () => {
  const events = [
    event(0, '네'),
    event(1, '이것은 충분히 긴 응답이에요!'),
    event(2, '응'),
  ]
  expect(shouldEnd(events, 20, '응')).toBe(false)
})
```

- [ ] **Step 2: 실행 → 실패**

Run: `bun run test:run endCheck`

- [ ] **Step 3: 구현 갱신**

```ts
export function shouldEnd(
  events: InteractionEvent[],
  maxTurns: number,
  lastResponse: string
): boolean {
  if (events.length >= maxTurns) return true
  if (lastResponse.includes(END_PROMISE_MARKER)) return true

  const threshold = INTERACTION_DEFAULTS.END_SIGNAL_SHORT_TURNS_THRESHOLD
  if (events.length >= threshold) {
    const recent = events.slice(-threshold)
    const allShort = recent.every(
      (e) => e.content.length < INTERACTION_DEFAULTS.MIN_RESPONSE_LENGTH
    )
    if (allShort) return true
  }
  return false
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run endCheck`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/interaction/endCheck.ts frontend/src/lib/interaction/endCheck.test.ts
git commit -m "feat: shouldEnd detects consecutive short responses"
```

---

## Milestone E: 순수 함수 TDD — Prompt 빌더

### Task E1: `renderPersonaCore` — null 필드 제외

**Files:**
- Create: `frontend/src/lib/prompts/persona.ts`
- Create: `frontend/src/lib/prompts/persona.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// persona.test.ts
import { describe, it, expect } from 'vitest'
import { renderPersonaCore } from './persona'
import type { Persona } from '@/types/persona'

function emptyPersona(overrides: Partial<Persona> = {}): Persona {
  return {
    name: 'Test',
    age: null, gender: null, location: null, occupation: null,
    education: null, languages: null,
    mbti: null, personality_traits: null, strengths: null, weaknesses: null,
    humor_style: null, emotional_expression: null,
    core_values: null, beliefs: null, life_philosophy: null, dealbreakers: null,
    hobbies: null, favorite_media: null, food_preferences: null, travel_style: null,
    background_story: null, key_life_events: null, career_history: null,
    past_relationships_summary: null,
    family_description: null, close_friends_count: null, social_style: null,
    relationship_with_family: null,
    daily_routine: null, sleep_schedule: null, exercise_habits: null,
    diet: null, pets: null, living_situation: null,
    communication_style: null, conversation_preferences: null,
    texting_style: null, response_speed: null,
    short_term_goals: null, long_term_goals: null,
    what_seeking_in_others: null, relationship_goal: null,
    self_description: null, tags: null,
    ...overrides,
  }
}

describe('renderPersonaCore', () => {
  it('name만 있어도 유효한 결과', () => {
    const result = renderPersonaCore(emptyPersona({ name: '지수' }))
    expect(result).toContain('지수')
    expect(result).not.toContain('null')
  })

  it('null 필드는 출력에 포함되지 않음', () => {
    const result = renderPersonaCore(emptyPersona({ name: '지수' }))
    expect(result).not.toContain('mbti')
    expect(result).not.toContain('age')
  })
})
```

- [ ] **Step 2: 실행 → 실패**

Run: `bun run test:run persona`

- [ ] **Step 3: 최소 구현**

```ts
// persona.ts
import type { Persona, CloneMemory } from '@/types/persona'
import { BEHAVIOR_INSTRUCTIONS } from './behavior'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'

export function renderPersonaCore(persona: Persona): string {
  const lines: string[] = [`이름: ${persona.name}`]

  const addField = (label: string, value: string | number | null) => {
    if (value !== null && value !== undefined && value !== '') {
      lines.push(`${label}: ${value}`)
    }
  }
  const addList = (label: string, value: string[] | null) => {
    if (value && value.length > 0) {
      lines.push(`${label}: ${value.join(', ')}`)
    }
  }

  addField('나이', persona.age)
  addField('성별', persona.gender)
  addField('지역', persona.location)
  addField('직업', persona.occupation)
  addField('학력', persona.education)
  addList('사용 언어', persona.languages)

  addField('MBTI', persona.mbti)
  addList('성격 특징', persona.personality_traits)
  addList('강점', persona.strengths)
  addList('약점', persona.weaknesses)
  addField('유머 스타일', persona.humor_style)
  addField('감정 표현', persona.emotional_expression)

  addList('핵심 가치관', persona.core_values)
  addList('신념', persona.beliefs)
  addField('인생관', persona.life_philosophy)
  addList('절대 받아들일 수 없는 것', persona.dealbreakers)

  addList('취미', persona.hobbies)
  addList('음식 취향', persona.food_preferences)
  addField('여행 스타일', persona.travel_style)

  addField('성장 배경', persona.background_story)
  addList('인생 주요 사건', persona.key_life_events)
  addField('커리어', persona.career_history)

  addField('가족', persona.family_description)
  addField('가족 관계', persona.relationship_with_family)
  addField('사교 스타일', persona.social_style)

  addField('일과', persona.daily_routine)
  addField('수면 습관', persona.sleep_schedule)
  addField('운동 습관', persona.exercise_habits)
  addField('식사', persona.diet)
  addField('반려동물', persona.pets)
  addField('거주 형태', persona.living_situation)

  addField('커뮤니케이션 스타일', persona.communication_style)
  addList('대화 선호', persona.conversation_preferences)
  addField('메시지 스타일', persona.texting_style)
  addField('응답 속도', persona.response_speed)

  addList('단기 목표', persona.short_term_goals)
  addList('장기 목표', persona.long_term_goals)
  addField('상대에게 바라는 점', persona.what_seeking_in_others)

  addField('자기소개', persona.self_description)
  addList('태그', persona.tags)

  return lines.join('\n')
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run persona`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/prompts/persona.ts frontend/src/lib/prompts/persona.test.ts
git commit -m "feat: renderPersonaCore outputs non-null fields only"
```

---

### Task E2: `renderPersonaCore` — 다양한 필드 조합 테스트

**Files:**
- Modify: `frontend/src/lib/prompts/persona.test.ts`

- [ ] **Step 1: 추가 테스트**

```ts
it('여러 필드 조합이 올바른 순서로 출력', () => {
  const result = renderPersonaCore(
    emptyPersona({
      name: '지수',
      age: 28,
      mbti: 'INFJ',
      hobbies: ['독서', '요가'],
      core_values: ['진정성', '성장'],
    })
  )
  expect(result).toContain('이름: 지수')
  expect(result).toContain('나이: 28')
  expect(result).toContain('MBTI: INFJ')
  expect(result).toContain('취미: 독서, 요가')
  expect(result).toContain('핵심 가치관: 진정성, 성장')
})

it('빈 배열은 생략', () => {
  const result = renderPersonaCore(emptyPersona({ name: '지수', hobbies: [] }))
  expect(result).not.toContain('취미')
})
```

- [ ] **Step 2: 실행 → 통과**

Run: `bun run test:run persona`
Expected: `4 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/prompts/persona.test.ts
git commit -m "test: renderPersonaCore field combinations"
```

---

### Task E3: `renderRecentMemories`

**Files:**
- Modify: `frontend/src/lib/prompts/persona.ts`
- Modify: `frontend/src/lib/prompts/persona.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { renderRecentMemories } from './persona'
import type { CloneMemory } from '@/types/persona'

function memory(overrides: Partial<CloneMemory> = {}): CloneMemory {
  return {
    id: 'm1', clone_id: 'c1', kind: 'event',
    content: '영화 봄', tags: [],
    occurred_at: '2026-04-10', created_at: '2026-04-10T00:00:00Z',
    relevance_score: null,
    ...overrides,
  }
}

describe('renderRecentMemories', () => {
  it('빈 배열은 빈 문자열 반환', () => {
    expect(renderRecentMemories([])).toBe('')
  })

  it('메모리는 occurred_at 내림차순으로 정렬', () => {
    const memories = [
      memory({ occurred_at: '2026-04-09', content: '오래된' }),
      memory({ occurred_at: '2026-04-11', content: '최근' }),
      memory({ occurred_at: '2026-04-10', content: '중간' }),
    ]
    const result = renderRecentMemories(memories)
    const lines = result.split('\n').filter((l) => l.includes('-'))
    expect(lines[0]).toContain('최근')
    expect(lines[1]).toContain('중간')
    expect(lines[2]).toContain('오래된')
  })

  it('메모리 섹션 헤더 포함', () => {
    const result = renderRecentMemories([memory({ content: '테스트' })])
    expect(result).toContain('최근 기억')
  })

  it('limit 초과분은 제외', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      memory({ id: `m${i}`, content: `item ${i}`, occurred_at: `2026-04-${i + 1}` })
    )
    const result = renderRecentMemories(many)
    const lines = result.split('\n').filter((l) => l.includes('- '))
    expect(lines.length).toBeLessThanOrEqual(
      INTERACTION_DEFAULTS.MEMORY_INJECTION_LIMIT
    )
  })
})
```

- [ ] **Step 2: import 추가**

```ts
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
```

- [ ] **Step 3: 실행 → 실패**

Run: `bun run test:run persona`

- [ ] **Step 4: 구현**

```ts
// persona.ts 에 추가
export function renderRecentMemories(
  memories: CloneMemory[],
  limit: number = INTERACTION_DEFAULTS.MEMORY_INJECTION_LIMIT
): string {
  if (memories.length === 0) return ''

  const sorted = [...memories].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  )
  const picked = sorted.slice(0, limit)
  const lines = picked.map((m) => `- ${m.occurred_at}: ${m.content}`)
  return `최근 기억:\n${lines.join('\n')}`
}
```

- [ ] **Step 5: 실행 → 통과**

Run: `bun run test:run persona`
Expected: `8 passed`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/prompts/persona.ts frontend/src/lib/prompts/persona.test.ts
git commit -m "feat: renderRecentMemories sorts by date desc, applies limit"
```

---

### Task E4: `buildSystemPrompt` — 통합

**Files:**
- Modify: `frontend/src/lib/prompts/persona.ts`
- Modify: `frontend/src/lib/prompts/persona.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { buildSystemPrompt } from './persona'
import { BEHAVIOR_INSTRUCTIONS } from './behavior'

describe('buildSystemPrompt', () => {
  it('persona core + memories + behavior 를 포함', () => {
    const persona = emptyPersona({ name: '지수', age: 28 })
    const memories = [memory({ content: '영화 봄' })]
    const result = buildSystemPrompt(persona, memories)

    expect(result).toContain('이름: 지수')
    expect(result).toContain('영화 봄')
    expect(result).toContain(BEHAVIOR_INSTRUCTIONS)
  })

  it('memories 없어도 동작', () => {
    const result = buildSystemPrompt(emptyPersona({ name: '지수' }), [])
    expect(result).toContain('이름: 지수')
    expect(result).toContain(BEHAVIOR_INSTRUCTIONS)
    expect(result).not.toContain('최근 기억')
  })

  it('behavior 섹션은 항상 끝에', () => {
    const result = buildSystemPrompt(emptyPersona({ name: '지수' }), [])
    expect(result.endsWith(BEHAVIOR_INSTRUCTIONS)).toBe(true)
  })
})
```

- [ ] **Step 2: 실행 → 실패**

Run: `bun run test:run persona`

- [ ] **Step 3: 구현**

```ts
// persona.ts 에 추가
export function buildSystemPrompt(
  persona: Persona,
  memories: CloneMemory[] = []
): string {
  const sections = [
    renderPersonaCore(persona),
    renderRecentMemories(memories),
    BEHAVIOR_INSTRUCTIONS,
  ].filter((s) => s.length > 0)
  return sections.join('\n\n')
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run persona`
Expected: `11 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/prompts/persona.ts frontend/src/lib/prompts/persona.test.ts
git commit -m "feat: buildSystemPrompt composes core + memories + behavior"
```

---

## Milestone F: 순수 함수 TDD — Memory 추출

### Task F1: `parseMemoryExtraction` — 필수 필드 검증

**Files:**
- Create: `frontend/src/lib/memory/extract.ts`
- Create: `frontend/src/lib/memory/extract.test.ts`
- Create: `frontend/src/lib/errors.ts` (이 태스크에서 도입)

- [ ] **Step 1: errors.ts 작성**

```ts
// errors.ts
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'LLM_ERROR'
  | 'FORBIDDEN'
  | 'INTERNAL'

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errors = {
  unauthorized: () => new AppError('UNAUTHORIZED', '인증이 필요합니다', 401),
  notFound: (resource: string) =>
    new AppError('NOT_FOUND', `${resource}를 찾을 수 없습니다`, 404),
  validation: (message: string, details?: unknown) =>
    new AppError('VALIDATION', message, 400, details),
  llm: (cause: Error) =>
    new AppError('LLM_ERROR', 'AI 서비스 오류', 502, { cause: cause.message }),
  forbidden: () => new AppError('FORBIDDEN', '권한이 없습니다', 403),
  internal: () => new AppError('INTERNAL', '서버 오류', 500),
}
```

- [ ] **Step 2: 실패 테스트 작성**

```ts
// extract.test.ts
import { describe, it, expect } from 'vitest'
import { parseMemoryExtraction } from './extract'

describe('parseMemoryExtraction', () => {
  it('유효한 객체를 파싱한다', () => {
    const raw = {
      kind: 'event',
      content: '영화 봄',
      tags: ['영화'],
      occurred_at: '2026-04-11',
    }
    const result = parseMemoryExtraction(raw)
    expect(result).toEqual(raw)
  })

  it('kind 없으면 throw', () => {
    expect(() =>
      parseMemoryExtraction({ content: 'x', occurred_at: '2026-04-11' })
    ).toThrow()
  })

  it('kind가 enum 밖이면 throw', () => {
    expect(() =>
      parseMemoryExtraction({
        kind: 'invalid',
        content: 'x',
        occurred_at: '2026-04-11',
      })
    ).toThrow()
  })
})
```

- [ ] **Step 3: 실행 → 실패**

Run: `bun run test:run extract`

- [ ] **Step 4: 구현**

```ts
// extract.ts
import type { CloneMemoryKind } from '@/types/persona'
import { errors } from '@/lib/errors'

const VALID_KINDS: readonly CloneMemoryKind[] = [
  'event',
  'mood',
  'fact',
  'preference_update',
]

export interface ExtractedMemory {
  kind: CloneMemoryKind
  content: string
  tags: string[]
  occurred_at: string
}

export function parseMemoryExtraction(raw: unknown): ExtractedMemory {
  if (typeof raw !== 'object' || raw === null) {
    throw errors.validation('추출 결과가 객체가 아닙니다')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.kind !== 'string') {
    throw errors.validation('kind 필드가 없습니다')
  }
  if (!VALID_KINDS.includes(obj.kind as CloneMemoryKind)) {
    throw errors.validation(`알 수 없는 kind: ${obj.kind}`)
  }
  if (typeof obj.content !== 'string' || obj.content.length === 0) {
    throw errors.validation('content 필드가 없습니다')
  }
  if (typeof obj.occurred_at !== 'string') {
    throw errors.validation('occurred_at 필드가 없습니다')
  }

  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string')
    : []

  return {
    kind: obj.kind as CloneMemoryKind,
    content: obj.content,
    tags,
    occurred_at: obj.occurred_at,
  }
}
```

- [ ] **Step 5: 실행 → 통과**

Run: `bun run test:run extract`
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/errors.ts frontend/src/lib/memory/extract.ts frontend/src/lib/memory/extract.test.ts
git commit -m "feat: parseMemoryExtraction validates required fields"
```

---

### Task F2: `parseMemoryExtraction` — tags 기본값, 추가 필드 무시

**Files:**
- Modify: `frontend/src/lib/memory/extract.test.ts`

- [ ] **Step 1: 테스트 추가 (구현은 이미 처리)**

```ts
it('tags 없으면 빈 배열로 기본값', () => {
  const result = parseMemoryExtraction({
    kind: 'event',
    content: '영화 봄',
    occurred_at: '2026-04-11',
  })
  expect(result.tags).toEqual([])
})

it('tags가 배열이 아니면 빈 배열', () => {
  const result = parseMemoryExtraction({
    kind: 'event',
    content: '영화 봄',
    occurred_at: '2026-04-11',
    tags: 'not-an-array',
  })
  expect(result.tags).toEqual([])
})

it('tags 안의 비문자열 요소는 필터링', () => {
  const result = parseMemoryExtraction({
    kind: 'event',
    content: '영화 봄',
    occurred_at: '2026-04-11',
    tags: ['영화', 123, null, '재미'],
  })
  expect(result.tags).toEqual(['영화', '재미'])
})

it('추가 필드는 무시', () => {
  const result = parseMemoryExtraction({
    kind: 'event',
    content: '영화 봄',
    occurred_at: '2026-04-11',
    extra_field: 'ignored',
  })
  expect(result).not.toHaveProperty('extra_field')
})
```

- [ ] **Step 2: 실행 → 통과**

Run: `bun run test:run extract`
Expected: `7 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/memory/extract.test.ts
git commit -m "test: parseMemoryExtraction tags defaults and extra fields"
```

---

### Task F3: `normalizeOccurredAt` — 절대 날짜

**Files:**
- Modify: `frontend/src/lib/memory/extract.ts`
- Modify: `frontend/src/lib/memory/extract.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { normalizeOccurredAt } from './extract'

describe('normalizeOccurredAt', () => {
  const now = new Date('2026-04-11T00:00:00Z') // 금요일

  it('이미 ISO 형식은 그대로', () => {
    expect(normalizeOccurredAt('2026-04-01', now)).toBe('2026-04-01')
  })

  it('"오늘" → now 날짜', () => {
    expect(normalizeOccurredAt('오늘', now)).toBe('2026-04-11')
  })

  it('"어제" → now - 1일', () => {
    expect(normalizeOccurredAt('어제', now)).toBe('2026-04-10')
  })

  it('"그저께" → now - 2일', () => {
    expect(normalizeOccurredAt('그저께', now)).toBe('2026-04-09')
  })

  it('"지난주" → now - 7일', () => {
    expect(normalizeOccurredAt('지난주', now)).toBe('2026-04-04')
  })

  it('파싱 실패하면 throw', () => {
    expect(() => normalizeOccurredAt('언젠가', now)).toThrow()
  })
})
```

- [ ] **Step 2: 실행 → 실패**

Run: `bun run test:run extract`

- [ ] **Step 3: 구현**

```ts
// extract.ts 에 추가
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const RELATIVE_DAYS: Record<string, number> = {
  '오늘': 0,
  '어제': -1,
  '그저께': -2,
  '내일': 1,
  '모레': 2,
  '지난주': -7,
  '다음주': 7,
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normalizeOccurredAt(raw: string, now: Date): string {
  if (ISO_DATE_REGEX.test(raw)) return raw

  const dayDelta = RELATIVE_DAYS[raw.trim()]
  if (dayDelta !== undefined) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() + dayDelta)
    return formatDate(d)
  }

  throw errors.validation(`occurred_at 파싱 실패: ${raw}`)
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run extract`
Expected: `13 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/memory/extract.ts frontend/src/lib/memory/extract.test.ts
git commit -m "feat: normalizeOccurredAt handles ISO and Korean relative dates"
```

---

## Milestone G: 순수 함수 TDD — Analysis 파싱

### Task G1: `parseAnalysisReport` — 기본 스키마

**Files:**
- Create: `frontend/src/lib/analysis/parse.ts`
- Create: `frontend/src/lib/analysis/parse.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseAnalysisReport } from './parse'

const validReport = {
  score: 75,
  categories: {
    conversation_flow: { score: 80, comment: '자연스러움' },
    shared_interests: { score: 70, comment: '영화 취향 유사' },
    values_alignment: { score: 75, comment: '가치관 비슷' },
    communication_fit: { score: 72, comment: '페이스 맞음' },
    potential_conflicts: { score: 60, comment: '성격 차이 있음' },
  },
  summary: '전반적으로 궁합이 좋음',
  recommended_next: 'continue',
}

describe('parseAnalysisReport', () => {
  it('유효한 리포트를 파싱', () => {
    const result = parseAnalysisReport(validReport)
    expect(result.score).toBe(75)
    expect(result.categories.conversation_flow.score).toBe(80)
  })

  it('score 범위 밖이면 throw (0 미만)', () => {
    expect(() =>
      parseAnalysisReport({ ...validReport, score: -1 })
    ).toThrow()
  })

  it('score 범위 밖이면 throw (100 초과)', () => {
    expect(() =>
      parseAnalysisReport({ ...validReport, score: 101 })
    ).toThrow()
  })

  it('객체 아니면 throw', () => {
    expect(() => parseAnalysisReport('not an object')).toThrow()
  })
})
```

- [ ] **Step 2: 실행 → 실패**

Run: `bun run test:run parse`

- [ ] **Step 3: 구현**

```ts
// parse.ts
import type { AnalysisReport, CategoryScore } from '@/types/analysis'
import { ANALYSIS_CATEGORIES } from '@/lib/config/analysis'
import { errors } from '@/lib/errors'

export function parseAnalysisReport(raw: unknown): AnalysisReport {
  if (typeof raw !== 'object' || raw === null) {
    throw errors.validation('분석 결과가 객체가 아닙니다')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.score !== 'number' || obj.score < 0 || obj.score > 100) {
    throw errors.validation('score는 0-100 범위여야 합니다')
  }

  if (typeof obj.categories !== 'object' || obj.categories === null) {
    throw errors.validation('categories 객체가 없습니다')
  }
  const rawCategories = obj.categories as Record<string, unknown>
  const categories: Record<string, CategoryScore> = {}

  for (const key of ANALYSIS_CATEGORIES) {
    const entry = rawCategories[key]
    if (typeof entry !== 'object' || entry === null) {
      throw errors.validation(`categories.${key} 누락`)
    }
    const e = entry as Record<string, unknown>
    if (typeof e.score !== 'number') {
      throw errors.validation(`categories.${key}.score 누락`)
    }
    if (typeof e.comment !== 'string') {
      throw errors.validation(`categories.${key}.comment 누락`)
    }
    categories[key] = { score: e.score, comment: e.comment }
  }

  if (typeof obj.summary !== 'string') {
    throw errors.validation('summary 누락')
  }

  const next = obj.recommended_next
  if (next !== 'continue' && next !== 'pause' && next !== 'end') {
    throw errors.validation('recommended_next 값이 유효하지 않음')
  }

  return {
    score: obj.score,
    categories,
    summary: obj.summary,
    recommended_next: next,
  }
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run parse`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/analysis/parse.ts frontend/src/lib/analysis/parse.test.ts
git commit -m "feat: parseAnalysisReport validates schema and ranges"
```

---

### Task G2: `parseAnalysisReport` — 카테고리 누락

**Files:**
- Modify: `frontend/src/lib/analysis/parse.test.ts`

- [ ] **Step 1: 테스트 추가**

```ts
it('required 카테고리 누락 시 throw', () => {
  const bad = {
    ...validReport,
    categories: {
      conversation_flow: { score: 80, comment: '' },
      // 나머지 누락
    },
  }
  expect(() => parseAnalysisReport(bad)).toThrow()
})

it('recommended_next 잘못된 값이면 throw', () => {
  expect(() =>
    parseAnalysisReport({ ...validReport, recommended_next: 'maybe' })
  ).toThrow()
})
```

- [ ] **Step 2: 실행 → 통과**

Run: `bun run test:run parse`
Expected: `6 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/analysis/parse.test.ts
git commit -m "test: parseAnalysisReport missing categories and invalid next"
```

---

### Task G3: `buildAnalysisPrompt`

**Files:**
- Create: `frontend/src/lib/analysis/prompt.ts`
- Create: `frontend/src/lib/analysis/prompt.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// prompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildAnalysisPrompt } from './prompt'
import type { InteractionEvent } from '@/types/interaction'
import type { Persona } from '@/types/persona'

function makePersona(name: string): Persona {
  return {
    name,
    age: null, gender: null, location: null, occupation: null, education: null,
    languages: null, mbti: null, personality_traits: null, strengths: null,
    weaknesses: null, humor_style: null, emotional_expression: null,
    core_values: null, beliefs: null, life_philosophy: null, dealbreakers: null,
    hobbies: null, favorite_media: null, food_preferences: null,
    travel_style: null, background_story: null, key_life_events: null,
    career_history: null, past_relationships_summary: null,
    family_description: null, close_friends_count: null, social_style: null,
    relationship_with_family: null, daily_routine: null, sleep_schedule: null,
    exercise_habits: null, diet: null, pets: null, living_situation: null,
    communication_style: null, conversation_preferences: null,
    texting_style: null, response_speed: null, short_term_goals: null,
    long_term_goals: null, what_seeking_in_others: null,
    relationship_goal: null, self_description: null, tags: null,
  }
}

describe('buildAnalysisPrompt', () => {
  it('대화 로그와 페르소나 이름이 포함됨', () => {
    const events: InteractionEvent[] = [
      {
        id: '1', interaction_id: 'i1', turn_number: 0,
        speaker_clone_id: 'a', content: '안녕', created_at: '',
      },
      {
        id: '2', interaction_id: 'i1', turn_number: 1,
        speaker_clone_id: 'b', content: '반가워요', created_at: '',
      },
    ]
    const personas = new Map([
      ['a', makePersona('지수')],
      ['b', makePersona('태현')],
    ])

    const result = buildAnalysisPrompt(events, personas)

    expect(result).toContain('지수')
    expect(result).toContain('태현')
    expect(result).toContain('안녕')
    expect(result).toContain('반가워요')
  })

  it('JSON 출력 형식 지시 포함', () => {
    const result = buildAnalysisPrompt([], new Map())
    expect(result).toContain('JSON')
    expect(result).toContain('score')
    expect(result).toContain('categories')
  })

  it('카테고리 목록 포함', () => {
    const result = buildAnalysisPrompt([], new Map())
    expect(result).toContain('conversation_flow')
    expect(result).toContain('values_alignment')
  })
})
```

- [ ] **Step 2: 실행 → 실패**

Run: `bun run test:run prompt`

- [ ] **Step 3: 구현**

```ts
// prompt.ts
import type { InteractionEvent } from '@/types/interaction'
import type { Persona } from '@/types/persona'
import { ANALYSIS_CATEGORIES } from '@/lib/config/analysis'

export function buildAnalysisPrompt(
  events: InteractionEvent[],
  personas: Map<string, Persona>
): string {
  const personaSummaries = Array.from(personas.entries())
    .map(([id, p]) => `- ${p.name} (${id}): ${p.self_description ?? '자기소개 없음'}`)
    .join('\n')

  const dialogue = events
    .map((e) => {
      const name = personas.get(e.speaker_clone_id)?.name ?? 'Unknown'
      return `${name}: ${e.content}`
    })
    .join('\n')

  const categoryList = ANALYSIS_CATEGORIES.join(', ')

  return `다음은 두 인물의 대화입니다. 아래 참여자들의 페르소나와 대화 로그를 보고 호환성을 분석하세요.

참여자:
${personaSummaries || '(정보 없음)'}

대화 로그:
${dialogue || '(대화 없음)'}

분석 결과를 다음 JSON 스키마로만 출력하세요. 다른 설명 금지.

{
  "score": <0-100 정수>,
  "categories": {
    ${ANALYSIS_CATEGORIES.map((c) => `"${c}": { "score": <0-100>, "comment": "<한 줄>" }`).join(',\n    ')}
  },
  "summary": "<전체 요약 2-3 문장>",
  "recommended_next": "continue" | "pause" | "end"
}

카테고리: ${categoryList}

점수는 0-100 정수. 카테고리는 모두 채워야 합니다.`
}
```

- [ ] **Step 4: 실행 → 통과**

Run: `bun run test:run prompt`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/analysis/prompt.ts frontend/src/lib/analysis/prompt.test.ts
git commit -m "feat: buildAnalysisPrompt composes personas, dialogue, JSON schema"
```

---

## Milestone H: 최종 검증

### Task H1: 전체 테스트 녹색 확인

- [ ] **Step 1: 테스트 일괄 실행**

Run: `bun run test:run`
Expected: 모든 테스트 PASS, 최소 **30개 이상**의 테스트 통과

- [ ] **Step 2: 타입체크**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: 린트**

Run: `bun run lint`
Expected: 에러 없음 (경고는 허용)

---

### Task H2: Dev 서버 수동 확인

- [ ] **Step 1: 서버 기동**

Run: `bun run dev`

- [ ] **Step 2: 브라우저 확인**

Open: `http://localhost:3000`
Expected:
- "Digital Clone Platform" 타이틀 보임
- 콘솔 에러 없음
- Network 탭 200 응답
- Tailwind 스타일 적용됨 (flex, centering 확인)

- [ ] **Step 3: 서버 종료**

Ctrl-C

---

### Task H3: Plan 1 완료 커밋

- [ ] **Step 1: Plan 1 완료 태그**

```bash
git tag plan1-foundation-complete
git log --oneline -20
```

Plan 1 완료 시점: Vitest 녹색, 10개 순수 함수 완성, dev 서버 동작. **Plan 2 (Supabase + Auth + DB)로 진행 가능**.

---

## Self-Review Notes

**Spec coverage** (Phase 1 spec §5 순수 함수 리스트 확인):
- ✅ `buildSystemPrompt` (E4)
- ✅ `renderPersonaCore` (E1-E2)
- ✅ `renderRecentMemories` (E3)
- ✅ `remapHistoryForSpeaker` (D1-D3)
- ✅ `pickSpeaker` (D4)
- ✅ `shouldEnd` (D5-D7)
- ✅ `parseMemoryExtraction` (F1-F2)
- ✅ `normalizeOccurredAt` (F3)
- ✅ `parseAnalysisReport` (G1-G2)
- ✅ `buildAnalysisPrompt` (G3)

Plan 1 범위 외 (Plan 2+에서 다룸):
- Supabase 클라이언트, Auth, 마이그레이션, RLS, NPC seed
- Claude API 호출 래퍼 (`lib/claude.ts`)
- API Routes, React 컴포넌트, 페이지
- Realtime 구독

**Placeholder scan**: 모든 step에 실제 코드/명령 포함. TODO/TBD 없음.

**Type consistency**:
- `InteractionEvent` 필드 통일 (`speaker_clone_id`, `turn_number`)
- `ClaudeMessage.role` 은 `'user' | 'assistant'` 두 값만
- `CloneMemoryKind` enum 4개 값 `parseMemoryExtraction` 과 `types/persona.ts` 일치
- `ANALYSIS_CATEGORIES` 는 `parseAnalysisReport` 와 `buildAnalysisPrompt` 양쪽에서 사용

---

## 다음 Plan 개요 (참고용)

### Plan 2: Supabase DB + Auth + NPC Seed
- Supabase 로컬 셋업 (`supabase init`, `supabase start`)
- `@supabase/ssr` 미들웨어 (서버·클라이언트 분리)
- 7개 마이그레이션 SQL 작성
- RLS 정책 적용
- 매직링크 로그인 페이지 + 콜백
- NPC 5개 seed 페르소나 작성
- Supabase Studio에서 테이블·seed 확인

### Plan 3: Clone CRUD + Persona UI
- `/api/clones` 라우트 4개
- PersonaSection 10개 카테고리 컴포넌트 (재사용 단위)
- PersonaQuickForm, PersonaFullEditor
- `/clones`, `/clones/new`, `/clones/[id]`, `/clones/[id]/edit` 페이지
- zod 스키마 기반 검증
- 낙관적 업데이트 + 에러 핸들링

### Plan 4: Interaction Engine + Realtime Viewer
- `lib/claude.ts` Anthropic SDK 래퍼 (재시도 포함)
- `lib/interaction/engine.ts` (순수 함수 조합해 orchestrate)
- `/api/interactions` 라우트
- InteractionPairPicker, InteractionViewer, TypingIndicator
- Realtime 구독 + Heartbeat
- Interaction 뷰어의 진행 UX (§8)
- 실패 복구 UI

### Plan 5: Memory + Analysis
- `/api/memories` 자연어 추출 플로우
- `/api/analyses` 호환성 분석
- MemoryInputBox, MemoryTimeline
- AnalysisReport, ScoreBar, CategoryCard
- Clone 상세 페이지 완성
- Analysis 페이지

각 Plan은 이전 Plan 완료 후 작성·실행.
