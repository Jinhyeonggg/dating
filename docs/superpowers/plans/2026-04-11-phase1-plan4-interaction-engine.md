# Plan 4: Interaction Engine + Realtime Viewer

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 Clone 사이의 20턴 대화를 실행하고 Realtime으로 사용자에게 스트리밍하는 엔진 + 뷰어를 구현한다. **Phase 1의 가치 검증 지점이다.** 대화가 "AI 같지 않고 현실적으로" 느껴지는지가 이 Plan의 핵심 성공 지표다.

**Architecture:**
- **API**: `POST /api/interactions` (생성, sync), `POST /api/interactions/[id]/run` (실행 트리거, 서버가 inline 루프), `GET /api/interactions/[id]` (조회). 생성과 실행 분리 → 클라이언트가 먼저 뷰어로 이동한 뒤 실행 트리거 → Realtime으로 턴 수신.
- **엔진**: `lib/interaction/engine.ts`의 `runInteraction`이 pure orchestration. 기존 pure 함수(`pickSpeaker`, `remapHistoryForSpeaker`, `shouldEnd`, `buildSystemPrompt`)를 조립.
- **Realtime**: `lib/supabase/realtime.ts`가 `interaction_events` 채널 wrapper + heartbeat + 자동 재연결. UI는 `InteractionViewer` 클라이언트 컴포넌트가 구독.
- **프롬프트 품질**: 기존 `BEHAVIOR_INSTRUCTIONS`에 "AI 티 금지" 반패턴 명시 + scenario를 첫 user message로 주입 + dev CLI 스크립트로 프롬프트 빠른 튜닝 루프.

**Tech Stack:**
- Next.js 16 (App Router), Vercel Fluid Compute
- @anthropic-ai/sdk (claude-sonnet-4-6)
- Supabase Realtime (`postgres_changes` channel)
- React Hook Form + Zod (폼)
- Vitest (순수 함수 테스트)
- tsx (dev 스크립트 실행)

---

## Non-Goals (이 Plan 범위 외)

- **분석 생성/뷰어** — Plan 5
- **메모리 입력 UI / API** — Plan 5
- **배치 실행, 랭킹** — Phase 2
- **토큰 단위 SSE 스트리밍** — Phase 2 (Plan 4는 턴 단위 DB INSERT → Realtime push)
- **사용자 중단 버튼** — 이번엔 skip, 300s 타임아웃 의존
- **오토 재시도 UI** — 서버 내부 재시도만, UI는 실패 시 새 interaction 생성 안내

---

## Realism 설계 원칙 (Plan 4 최우선)

이 Plan에서 제일 중요한 것은 **"클론이 AI 같지 않게 말하는지"**다. 코드 품질보다 우선.

### AI-like 반패턴 (프롬프트에서 금지)
- 모든 턴마다 상대에게 질문 ("너는?", "그래서 어떻게 생각해?")
- 공감/칭찬 인플레이션 ("와 정말 흥미롭다!", "대단한데?")
- 대화 요약·메타 ("지금까지 얘기해보니...")
- 비대칭 정보 과잉 ("사실 저는 X에 대해 잘 알고 있는데...")
- 어시스턴트 톤 ("도움이 되었으면 좋겠어요", "필요하면 말씀해주세요")
- 상대 말투 미러링 (상대가 반말 → 존댓말 페르소나인데 반말로 바뀜)
- 턴마다 길이가 거의 같음 (진짜 대화는 들쭉날쭉)
- 모든 턴이 완결된 문장 (실제는 끊긴 말, 짧은 반응도 많음)

### 대화 현실감 체크리스트 (G그룹 Quality 검증 단계에서 반드시 사용)
- [ ] 페르소나별로 말투·어휘가 구분되는가? (A는 드라이, B는 감정 풍부 같이)
- [ ] 짧은 턴 (5-10자) 과 긴 턴 (80자+) 이 섞여 있는가?
- [ ] 질문 턴과 진술 턴의 비율이 약 3:7 근처인가? (질문만 하는 대화는 AI 티)
- [ ] "AI로서", "시뮬레이션", "프롬프트" 같은 메타 언급이 없는가?
- [ ] 상대의 문장 구조를 똑같이 따라 하지 않는가?
- [ ] 페르소나 `dealbreakers`, `core_values`와 충돌하는 주제에서 실제로 반응하는가?
- [ ] `past_relationships_summary`처럼 민감한 질문에 자연스럽게 방어·회피하는가?
- [ ] 대화 마무리가 자연스러운가? (어색하게 끊기지 않음)

### 튜닝 루프
1. `scripts/dev-run-interaction.ts` CLI로 두 NPC 간 1회 실행
2. 터미널에 턴별 전사 출력
3. 위 체크리스트 적용
4. 실패 항목 → `BEHAVIOR_INSTRUCTIONS` 또는 `buildFirstUserMessage` 수정
5. 다시 실행, 개선 확인
6. 최소 3개 NPC 조합(예: 지민×태현, 지민×서연, 태현×하린) 각 1회 이상 통과할 때까지 반복

이 루프는 **Group G에서 반드시 수행**. UI 붙이기 전에 CLI에서 먼저 품질을 올린다.

---

## 아키텍처 세부

### 실행 흐름 (분리된 create / run)

```
┌─────────────────┐      ┌────────────────────────┐
│ /interactions/  │─────▶│ POST /api/interactions │  (1) 생성
│    new          │      │  → status='pending'     │
│  (페어 + 시나리오)│      │  → returns { id }      │
└─────────────────┘      └────────────────────────┘
        │                          │
        │ (2) router.push(`/interactions/{id}`)
        ▼                          │
┌─────────────────┐                │
│ /interactions/  │                │
│    [id]         │                │
│ (viewer)        │                │
└─────────────────┘                │
        │                          │
        │ (3) useEffect on mount   │
        │   subscribe Realtime     │
        │   fetch(POST run, no-await)
        ▼                          │
┌─────────────────────────┐        │
│ POST /api/interactions/ │◀───────┘
│   [id]/run              │
│ → runInteraction() loop │ (4) 턴마다 INSERT interaction_events
│ → service role writes   │     → Supabase Realtime publish
└─────────────────────────┘        │
        │                          ▼
        │                  ┌──────────────┐
        │                  │ Viewer 구독  │
        │                  │ 자동 업데이트│
        │                  └──────────────┘
        ▼
  status='completed' (또는 'failed')
```

**왜 분리?**
1. `fetch(POST /api/interactions)` 하나로 생성 + 3-5분 실행을 다 하면, 클라이언트가 그동안 응답을 기다림. 브라우저가 다른 페이지로 이동하면 요청 취소 위험.
2. 분리하면 뷰어 페이지로 즉시 이동 가능. 뷰어가 "실행 시작" 호출을 fire-and-forget 으로 던지고, 이후는 Realtime이 전부 담당.
3. 재시도가 단순해짐 — 뷰어에서 "재시작" 버튼이 `POST /.../run`을 다시 트리거.
4. 테스트 용이 — CLI 스크립트도 같은 `runInteraction(id)` 함수를 호출.

**fire-and-forget 주의**:
- 클라이언트는 `await` 없이 `fetch(...)` 호출만 하고 결과는 무시.
- 네트워크 탭에는 오래 pending 으로 남을 수 있음 — 무해.
- 서버는 Fluid Compute에서 300s 내에 끝난다고 가정.

### 데이터 모델 사용

기존 Plan 2 테이블 그대로 사용. 새 컬럼 없음.

- `interactions` — `{ id, kind, scenario, setting, status, max_turns, metadata, created_by, started_at, ended_at, created_at }`
- `interaction_participants` — `{ interaction_id, clone_id, role, joined_at }` (Plan 4에서 `role`은 null 또는 "speaker")
- `interaction_events` — `{ id, interaction_id, turn_number, speaker_clone_id, content, created_at }`

상태 전이:
- `POST /api/interactions` → `pending`
- `POST /.../run` 진입 → `running` + `started_at = now()`
- `runInteraction` 정상 종료 → `completed` + `ended_at = now()`
- 예외 → `failed` + `metadata.failure_reason` + `ended_at = now()`

### 파일 구조

```
frontend/src/
├── lib/
│   ├── claude.ts                         (새로 작성, Anthropic SDK 래퍼)
│   ├── prompts/
│   │   ├── interaction.ts                (새로 작성, 시나리오 → 첫 user 메시지)
│   │   ├── interaction.test.ts
│   │   └── behavior.ts                   (수정, 반패턴 강화)
│   ├── interaction/
│   │   ├── engine.ts                     (새로 작성, runInteraction)
│   │   ├── remap.ts                      (기존 그대로)
│   │   ├── endCheck.ts                   (기존 그대로)
│   │   └── engine.test.ts                (엔진은 복합 로직 → 간단 통합 테스트만)
│   └── supabase/
│       └── realtime.ts                   (새로 작성, 구독 + heartbeat)
│
├── app/
│   ├── api/interactions/
│   │   ├── route.ts                      (새로 작성, POST 생성, GET 목록)
│   │   └── [id]/
│   │       ├── route.ts                  (새로 작성, GET 상세)
│   │       └── run/route.ts              (새로 작성, POST 실행)
│   └── interactions/
│       ├── page.tsx                      (새로 작성, 목록)
│       ├── new/page.tsx                  (새로 작성, 페어·시나리오 선택)
│       └── [id]/page.tsx                 (새로 작성, 뷰어 shell)
│
├── components/interaction/
│   ├── InteractionPairPicker.tsx         (새로 작성)
│   ├── ScenarioPicker.tsx                (새로 작성)
│   ├── InteractionViewer.tsx             (새로 작성, 클라이언트, Realtime 구독)
│   ├── MessageBubble.tsx                 (새로 작성)
│   ├── TypingIndicator.tsx               (새로 작성)
│   ├── InteractionStatusBadge.tsx        (새로 작성)
│   └── InteractionProgressBar.tsx        (새로 작성)
│
├── components/nav/
│   └── AppNav.tsx                        (수정, Interactions 링크 추가)
│
├── lib/validation/
│   └── interaction.ts                    (새로 작성, Zod 스키마)
│
└── types/
    └── interaction.ts                    (기존 그대로)

frontend/scripts/
└── dev-run-interaction.ts                (새로 작성, CLI 튜닝 도구)
```

### 환경 변수 추가
`.env.local`에 추가:
```
ANTHROPIC_API_KEY=sk-ant-...
```

`.env.local.example` 동기화.

---

## 작업 그룹 개요

| Group | 주제 | 의존성 | 병렬 |
|---|---|---|---|
| A | Claude SDK 래퍼 + 시나리오 프롬프트 + 반패턴 강화 | — | A, D 병렬 가능 |
| B | 인터랙션 엔진 + dev CLI 스크립트 | A | — |
| C | API 라우트 3개 (create, run, read) | B | C, E 병렬 가능 |
| D | Supabase Realtime wrapper | — | A, D 병렬 가능 |
| E | UI 프리미티브 (MessageBubble, TypingIndicator, 등) | — | C, E 병렬 가능 |
| F | 페이지 + 뷰어 통합 | C, D, E | — |
| G | **품질 검증 (realism 체크리스트)** | F | — |

Group G는 **UI까지 다 만든 뒤가 아니라 Group B 끝난 직후**에도 CLI로 1차 수행. 그 다음 F 끝난 뒤 2차 수행.

---

## Group A — Claude Wrapper + 시나리오 프롬프트 + 반패턴

### Task A.1: Anthropic SDK 설치

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: 패키지 설치**

```bash
cd frontend
bun add @anthropic-ai/sdk
```

- [ ] **Step 2: 설치 확인**

```bash
bun pm ls | grep anthropic
```
Expected: `@anthropic-ai/sdk@...` 표시

- [ ] **Step 3: 커밋 없음** (다음 Task와 합쳐서 커밋)

---

### Task A.2: `.env.local.example` 업데이트

**Files:**
- Modify: `frontend/.env.local.example`

- [ ] **Step 1: ANTHROPIC_API_KEY 추가**

기존 파일에 다음 줄 추가:

```
# Anthropic Claude API (Plan 4부터 필수)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

- [ ] **Step 2: 사용자 안내 문서화**

README.md 또는 frontend/README.md 에 "ANTHROPIC_API_KEY 를 `.env.local`에 설정" 한 줄 추가. 없으면 스킵.

---

### Task A.3: `lib/claude.ts` 래퍼 (재시도/백오프 포함)

**Files:**
- Create: `frontend/src/lib/claude.ts`

- [ ] **Step 1: 파일 작성**

```ts
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODELS, CLAUDE_RETRY, CLAUDE_LIMITS } from '@/lib/config/claude'
import { errors, AppError } from '@/lib/errors'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AppError(
      'INTERNAL',
      'ANTHROPIC_API_KEY 가 설정되지 않았습니다',
      500
    )
  }
  client = new Anthropic({ apiKey })
  return client
}

export interface ClaudeCallOptions {
  model: string
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens: number
  temperature?: number
}

/**
 * Claude API를 호출한다. 429 / 5xx / 네트워크 에러에 지수 백오프 재시도.
 * 재시도 후에도 실패하면 AppError('LLM_ERROR') throw.
 */
export async function callClaude(options: ClaudeCallOptions): Promise<string> {
  const c = getClient()
  let lastError: unknown = null

  for (let attempt = 0; attempt < CLAUDE_RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      const response = await c.messages.create({
        model: options.model,
        system: options.system,
        messages: options.messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.9,
      })
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      if (!text) {
        throw new Error('empty response from Claude')
      }
      return text
    } catch (err) {
      lastError = err
      const retriable = isRetriable(err)
      if (!retriable || attempt === CLAUDE_RETRY.MAX_ATTEMPTS - 1) break
      const delay =
        CLAUDE_RETRY.INITIAL_DELAY_MS *
        Math.pow(CLAUDE_RETRY.BACKOFF_MULTIPLIER, attempt)
      await sleep(delay)
    }
  }
  throw errors.llm(lastError instanceof Error ? lastError : new Error(String(lastError)))
}

function isRetriable(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError)) return true // 네트워크 등
  const status = err.status
  if (status === 429) return true
  if (status && status >= 500) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export { CLAUDE_MODELS, CLAUDE_LIMITS }
```

- [ ] **Step 2: 타입 체크**

```bash
cd frontend && npm run typecheck
```
Expected: 에러 없음

- [ ] **Step 3: 커밋 없음** (Group A 끝에 일괄 커밋)

---

### Task A.4: `lib/prompts/behavior.ts` 반패턴 강화

**Files:**
- Modify: `frontend/src/lib/prompts/behavior.ts`

- [ ] **Step 1: 기존 내용 확인**

```bash
cat frontend/src/lib/prompts/behavior.ts
```

- [ ] **Step 2: 파일 교체**

```ts
export const BEHAVIOR_INSTRUCTIONS = `당신은 지금 한 명의 인간 캐릭터를 연기합니다. 당신의 정체성은 위에서 정의된 페르소나 그대로입니다.

다음 원칙을 지키세요.

1. **정체성 유지**
   - 위 페르소나의 성격·가치관·말투·어휘·관심사에 일관되게 응답하세요.
   - 페르소나에 없는 주제는 억지로 지어내지 말고, 자연스럽게 "잘 모르겠어" / "그 쪽은 관심 없어" / 주제 전환으로 피하세요.
   - 페르소나의 \`dealbreakers\`나 \`core_values\`와 충돌하는 주제에는 실제로 반응하세요 (불편해하거나 선을 긋거나).

2. **대화 밀도와 길이**
   - 한 턴에 1-3 문장. 독백·설명·나열 금지.
   - 가끔은 한 단어나 짧은 감탄만 해도 됩니다 ("음.", "그래?", "오 진짜?"). 진짜 사람은 그렇게 말합니다.
   - 매 턴을 똑같은 길이로 쓰지 마세요. 들쭉날쭉해야 자연스럽습니다.

3. **질문의 균형**
   - 매 턴마다 상대에게 질문을 던지지 마세요. 질문 턴과 진술 턴의 비율은 대략 3:7 정도가 자연스럽습니다.
   - 이미 상대가 답한 내용을 다시 묻지 마세요.

4. **말투 오염 금지**
   - 상대방의 말투·어휘를 따라 하지 마세요. 당신의 커뮤니케이션 스타일(존댓말/반말, 이모지 사용, 문장 길이)을 유지하세요.
   - 상대가 반말이어도 당신이 존댓말 페르소나면 존댓말 유지.

5. **AI 티 금지 (가장 중요)**
   - 메타 언급 절대 금지: "AI로서", "시뮬레이션", "프롬프트", "모델" 같은 단어 사용 금지.
   - 어시스턴트 톤 금지: "도움이 되었으면 좋겠어요", "필요하면 말씀해주세요", "알려드릴게요" 같은 상용 챗봇 어투 금지.
   - 공감 인플레이션 금지: "와 정말 흥미롭다!", "대단한데?", "너무 멋있다!" 같은 과장된 칭찬 금지.
   - 대화 요약·메타 금지: "지금까지 얘기해보니", "우리 대화를 정리하면" 같은 멘트 금지.

6. **종료 신호**
   - 대화가 자연스럽게 끝났다고 느껴지면 (인사, 다음에 보자 류) 응답 끝에 \`<promise>END</promise>\` 를 포함하세요. 사용자에게는 보이지 않습니다.
   - 억지로 대화를 끌지 마세요.

지금부터 당신은 위 페르소나 본인입니다. 상대가 다음 메시지를 보낼 것입니다. 자연스럽게 응답하세요.`.trim()
```

- [ ] **Step 3: 기존 persona.test.ts 돌려서 깨지지 않는지 확인**

```bash
cd frontend && npm run test:run -- persona
```
Expected: 11 passed (Plan 1 테스트는 `renderPersonaCore` / `buildSystemPrompt` 구조만 검증하므로 BEHAVIOR_INSTRUCTIONS 내용은 무관)

만약 실패하면 테스트 assertion이 BEHAVIOR 본문 텍스트를 참조하는지 확인 후, 참조하지 않도록 테스트를 수정 (본문은 자주 튜닝될 것이므로 테스트가 본문에 의존하면 안 됨).

---

### Task A.5: `lib/prompts/interaction.ts` — 시나리오 첫 user 메시지

**Files:**
- Create: `frontend/src/lib/prompts/interaction.ts`
- Create: `frontend/src/lib/prompts/interaction.test.ts`

- [ ] **Step 1: failing test 작성**

```ts
// frontend/src/lib/prompts/interaction.test.ts
import { describe, it, expect } from 'vitest'
import { buildFirstUserMessage } from './interaction'

describe('buildFirstUserMessage', () => {
  it('시나리오 라벨이 포함되어야 한다', () => {
    const msg = buildFirstUserMessage({
      scenarioLabel: '온라인 대화 앱에서 처음 매칭됨',
      scenarioDescription: '둘 다 상대방을 오늘 처음 봄',
      setting: null,
      partnerName: '지민',
      selfName: '태현',
    })
    expect(msg).toContain('온라인 대화 앱에서 처음 매칭됨')
    expect(msg).toContain('지민')
  })

  it('setting 있으면 포함', () => {
    const msg = buildFirstUserMessage({
      scenarioLabel: '친구의 친구로 가볍게 대화',
      scenarioDescription: '서로 이름 정도만 아는 사이',
      setting: '홍대 카페',
      partnerName: 'A',
      selfName: 'B',
    })
    expect(msg).toContain('홍대 카페')
  })

  it('setting null이면 생략', () => {
    const msg = buildFirstUserMessage({
      scenarioLabel: 'X',
      scenarioDescription: 'Y',
      setting: null,
      partnerName: 'A',
      selfName: 'B',
    })
    expect(msg).not.toMatch(/장소/)
  })

  it('메타 지시 포함 (AI 티 금지 등 프롬프트 힌트)', () => {
    const msg = buildFirstUserMessage({
      scenarioLabel: 'X',
      scenarioDescription: 'Y',
      setting: null,
      partnerName: 'A',
      selfName: 'B',
    })
    // 첫 턴을 자연스러운 인사/말 걸기로 시작하라는 힌트가 있어야 함
    expect(msg.length).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend && npm run test:run -- interaction.test
```
Expected: `Cannot find module` 또는 `buildFirstUserMessage is not a function` 류 실패

- [ ] **Step 3: 구현**

```ts
// frontend/src/lib/prompts/interaction.ts
export interface FirstUserMessageInput {
  scenarioLabel: string
  scenarioDescription: string
  setting: string | null
  partnerName: string
  selfName: string
}

/**
 * 첫 화자에게 전달될 "첫 user 메시지".
 * 일반 대화의 시작점 역할을 하되, 시나리오 맥락을 자연스럽게 제공.
 * 상대 Clone이 이 메시지를 보는 것이 아니라, 첫 발화자가 "이 상황에서 먼저 말을 건다"는 설정.
 */
export function buildFirstUserMessage(input: FirstUserMessageInput): string {
  const settingPart = input.setting
    ? `장소/매체는 "${input.setting}"입니다.`
    : ''

  return [
    `(상황 설정: ${input.scenarioLabel} — ${input.scenarioDescription}. 당신(${input.selfName})이 ${input.partnerName}에게 먼저 말을 겁니다. ${settingPart})`,
    '',
    `자연스럽게 첫 마디를 건네세요. 어색한 자기소개나 과장된 인사말은 피하세요.`,
  ]
    .filter((l) => l.trim() !== '' || l === '')
    .join('\n')
    .trim()
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npm run test:run -- interaction.test
```
Expected: 4 passed

- [ ] **Step 5: Group A 전체 커밋**

```bash
cd /Users/jh/dating
git add frontend/package.json frontend/bun.lockb frontend/.env.local.example \
  frontend/src/lib/claude.ts \
  frontend/src/lib/prompts/behavior.ts \
  frontend/src/lib/prompts/interaction.ts \
  frontend/src/lib/prompts/interaction.test.ts
git commit -m "feat(interaction): claude wrapper + scenario prompt + anti-AI behavior"
```

---

## Group D — Supabase Realtime Wrapper (A와 병렬 가능)

### Task D.1: `lib/supabase/realtime.ts`

**Files:**
- Create: `frontend/src/lib/supabase/realtime.ts`

- [ ] **Step 1: 타입 정의**

```ts
// frontend/src/lib/supabase/realtime.ts
import { createClient } from './client'
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import type { InteractionEvent } from '@/types/interaction'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface InteractionEventsSubscription {
  unsubscribe: () => void
}

export interface SubscribeOptions {
  interactionId: string
  onEvent: (event: InteractionEvent) => void
  onStatusChange?: (status: ConnectionStatus) => void
}
```

- [ ] **Step 2: 구독 함수 구현**

```ts
export function subscribeInteractionEvents(
  opts: SubscribeOptions
): InteractionEventsSubscription {
  const supabase = createClient()
  let channel: RealtimeChannel | null = null
  let cancelled = false

  function connect(retryCount: number) {
    if (cancelled) return
    opts.onStatusChange?.(retryCount === 0 ? 'connecting' : 'reconnecting')

    channel = supabase
      .channel(`interaction:${opts.interactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interaction_events',
          filter: `interaction_id=eq.${opts.interactionId}`,
        },
        (payload: RealtimePostgresInsertPayload<InteractionEvent>) => {
          if (payload.new) opts.onEvent(payload.new)
        }
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          opts.onStatusChange?.('connected')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          opts.onStatusChange?.('offline')
          const delay = Math.min(30000, 1000 * Math.pow(2, retryCount))
          setTimeout(() => {
            if (cancelled) return
            if (channel) supabase.removeChannel(channel)
            connect(retryCount + 1)
          }, delay)
        }
      })
  }

  connect(0)

  return {
    unsubscribe: () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    },
  }
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd frontend && npm run typecheck
```
Expected: 에러 없음 (만약 `@supabase/supabase-js`가 설치 안 됐으면 이미 Plan 2에서 설치되어 있어야 함. 확인 후 조치)

- [ ] **Step 4: 커밋**

```bash
cd /Users/jh/dating
git add frontend/src/lib/supabase/realtime.ts
git commit -m "feat(realtime): interaction events channel wrapper with reconnect"
```

---

## Group B — Interaction Engine + Dev CLI

### Task B.1: `lib/validation/interaction.ts` Zod 스키마

**Files:**
- Create: `frontend/src/lib/validation/interaction.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/validation/interaction.ts
import { z } from 'zod'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'

export const createInteractionSchema = z.object({
  participantCloneIds: z.array(z.string().uuid()).length(2),
  scenarioId: z.string().min(1),
  setting: z.string().nullable().optional(),
  maxTurns: z.number().int().min(2).max(40).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>

export const DEFAULT_MAX_TURNS = INTERACTION_DEFAULTS.MAX_TURNS
```

- [ ] **Step 2: 타입 체크**

```bash
cd frontend && npm run typecheck
```
Expected: 에러 없음

---

### Task B.2: `lib/interaction/engine.ts` — runInteraction

**Files:**
- Create: `frontend/src/lib/interaction/engine.ts`

- [ ] **Step 1: 엔진 작성**

```ts
// frontend/src/lib/interaction/engine.ts
import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/config/claude'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
import { buildSystemPrompt } from '@/lib/prompts/persona'
import { buildFirstUserMessage } from '@/lib/prompts/interaction'
import { remapHistoryForSpeaker, pickSpeaker } from './remap'
import { shouldEnd } from './endCheck'
import { createServiceClient } from '@/lib/supabase/service'
import { errors, AppError } from '@/lib/errors'
import type { Clone, CloneMemory } from '@/types/persona'
import type { InteractionEvent } from '@/types/interaction'

export interface RunInteractionInput {
  interactionId: string
  participants: Clone[] // length 2
  memoriesByClone: Map<string, CloneMemory[]>
  scenario: {
    id: string
    label: string
    description: string
  }
  setting: string | null
  maxTurns: number
}

export interface RunInteractionResult {
  status: 'completed' | 'failed'
  turnsCompleted: number
  failureReason?: string
}

/**
 * 20턴 대화 루프. 각 턴:
 * 1. pickSpeaker → 이번 발화자 결정
 * 2. remapHistoryForSpeaker → Claude messages 포맷
 * 3. 첫 턴이면 첫 user 메시지 prepend
 * 4. callClaude → 응답 텍스트
 * 5. interaction_events INSERT (service role, RLS 우회)
 * 6. shouldEnd 검사
 */
export async function runInteraction(
  input: RunInteractionInput
): Promise<RunInteractionResult> {
  const admin = createServiceClient()
  const events: InteractionEvent[] = []
  const cloneNames = new Map(input.participants.map((c) => [c.id, c.name]))

  // 기존 이벤트 로드 (재시도 시 이어서 실행 가능하도록)
  const { data: existing } = await admin
    .from('interaction_events')
    .select('*')
    .eq('interaction_id', input.interactionId)
    .order('turn_number', { ascending: true })
  if (existing) events.push(...(existing as InteractionEvent[]))

  try {
    for (
      let turn = events.length;
      turn < input.maxTurns;
      turn++
    ) {
      const speaker = pickSpeaker(input.participants, turn)
      const listener = input.participants.find((c) => c.id !== speaker.id)!

      const persona = speaker.persona_json
      const memories = input.memoriesByClone.get(speaker.id) ?? []
      const systemPrompt = buildSystemPrompt(persona, memories)

      const history = remapHistoryForSpeaker(events, speaker.id, cloneNames)

      // 첫 턴: 시나리오 컨텍스트를 first user 메시지로
      if (turn === 0) {
        const firstUserMessage = buildFirstUserMessage({
          scenarioLabel: input.scenario.label,
          scenarioDescription: input.scenario.description,
          setting: input.setting,
          partnerName: listener.name,
          selfName: speaker.name,
        })
        history.push({ role: 'user', content: firstUserMessage })
      }

      const content = await callClaude({
        model: CLAUDE_MODELS.INTERACTION,
        system: systemPrompt,
        messages: history,
        maxTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_INTERACTION,
        temperature: 0.9,
      })

      const { data: inserted, error } = await admin
        .from('interaction_events')
        .insert({
          interaction_id: input.interactionId,
          turn_number: turn,
          speaker_clone_id: speaker.id,
          content,
        })
        .select()
        .single()

      if (error) {
        throw new AppError('INTERNAL', `event insert failed: ${error.message}`, 500)
      }
      events.push(inserted as InteractionEvent)

      if (shouldEnd(events, input.maxTurns, content)) break
    }

    return { status: 'completed', turnsCompleted: events.length }
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : String(err)
    return {
      status: 'failed',
      turnsCompleted: events.length,
      failureReason: reason,
    }
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd frontend && npm run typecheck
```
Expected: 에러 없음

---

### Task B.3: Dev CLI 스크립트

**Files:**
- Create: `frontend/scripts/dev-run-interaction.ts`

**목적**: UI 없이 두 NPC 간 대화를 CLI에서 실행하고 전사를 출력. realism 튜닝 루프용.

- [ ] **Step 1: 스크립트 작성**

```ts
// frontend/scripts/dev-run-interaction.ts
/**
 * CLI 실행:
 *   cd frontend
 *   bun run scripts/dev-run-interaction.ts <cloneA-id> <cloneB-id> [scenarioId]
 *
 * 예:
 *   bun run scripts/dev-run-interaction.ts $(bun run --silent ./scripts/first-two-npcs.ts)
 *
 * 동작:
 * 1. Supabase service role 로 직접 접속
 * 2. 두 Clone fetch
 * 3. interactions + participants 행 생성 (status='running')
 * 4. runInteraction() 호출
 * 5. 완료 후 interaction_events 전부 fetch 해서 터미널 출력
 * 6. 전사를 체크리스트와 함께 보기 쉽게 표시
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { runInteraction } from '../src/lib/interaction/engine'
import { DEFAULT_SCENARIOS, INTERACTION_DEFAULTS } from '../src/lib/config/interaction'
import type { Clone } from '../src/types/persona'

async function main() {
  const [cloneAId, cloneBId, scenarioId = 'online-first-match'] = process.argv.slice(2)
  if (!cloneAId || !cloneBId) {
    console.error('Usage: dev-run-interaction.ts <cloneA-id> <cloneB-id> [scenarioId]')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) {
    console.error('env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const admin = createClient(url, key)

  // 1. Clones fetch
  const { data: clones, error: cErr } = await admin
    .from('clones')
    .select('*')
    .in('id', [cloneAId, cloneBId])
  if (cErr || !clones || clones.length !== 2) {
    console.error('clones not found', cErr)
    process.exit(1)
  }
  const participants = [
    clones.find((c) => c.id === cloneAId),
    clones.find((c) => c.id === cloneBId),
  ].filter(Boolean) as Clone[]

  // 2. Scenario
  const scenario = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId)
  if (!scenario) {
    console.error(`unknown scenario: ${scenarioId}`)
    process.exit(1)
  }

  // 3. Interaction row
  const { data: interaction, error: iErr } = await admin
    .from('interactions')
    .insert({
      kind: 'dev-cli',
      scenario: scenario.label,
      setting: null,
      status: 'running',
      max_turns: INTERACTION_DEFAULTS.MAX_TURNS,
      metadata: { scenarioId: scenario.id, dev: true },
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (iErr || !interaction) {
    console.error('interaction insert failed', iErr)
    process.exit(1)
  }

  await admin.from('interaction_participants').insert(
    participants.map((p) => ({
      interaction_id: interaction.id,
      clone_id: p.id,
      role: 'speaker',
    }))
  )

  console.log(`\n▶ Interaction ${interaction.id}`)
  console.log(`  ${participants[0].name} × ${participants[1].name}`)
  console.log(`  Scenario: ${scenario.label}\n`)

  // 4. Run engine
  const result = await runInteraction({
    interactionId: interaction.id,
    participants,
    memoriesByClone: new Map(),
    scenario: {
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
    },
    setting: null,
    maxTurns: INTERACTION_DEFAULTS.MAX_TURNS,
  })

  // 5. Status update
  await admin
    .from('interactions')
    .update({
      status: result.status,
      ended_at: new Date().toISOString(),
      metadata: result.failureReason
        ? { failure_reason: result.failureReason }
        : undefined,
    })
    .eq('id', interaction.id)

  // 6. Fetch events & print transcript
  const { data: events } = await admin
    .from('interaction_events')
    .select('*')
    .eq('interaction_id', interaction.id)
    .order('turn_number', { ascending: true })

  console.log('\n─── TRANSCRIPT ───\n')
  for (const e of events ?? []) {
    const name =
      participants.find((p) => p.id === e.speaker_clone_id)?.name ?? '?'
    console.log(`${name}: ${e.content}\n`)
  }
  console.log(`\n[${result.status}] ${result.turnsCompleted} turns`)
  if (result.failureReason) console.log(`  reason: ${result.failureReason}`)

  console.log('\n─── REALISM CHECK ───')
  console.log('위 전사를 보고 아래 항목을 수동 확인:')
  console.log('  [ ] 두 페르소나의 말투·어휘가 구분되는가?')
  console.log('  [ ] 짧은 턴과 긴 턴이 섞여 있는가?')
  console.log('  [ ] 매 턴마다 질문이 아닌가? (질문:진술 ~ 3:7)')
  console.log('  [ ] "AI로서" / 과한 공감 / 어시스턴트 톤이 없는가?')
  console.log('  [ ] dealbreakers·core_values 반응이 자연스러운가?')
  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: `dotenv` 설치 확인**

```bash
cd frontend && bun pm ls | grep dotenv
```
없으면 설치:
```bash
bun add -d dotenv tsx
```

- [ ] **Step 3: 스크립트 실행 (실제 Claude 호출)**

**사용자가 ANTHROPIC_API_KEY를 `.env.local`에 설정해야 함.** 설정 전이면 다음 Task로 넘어가고 G그룹에서 실행.

```bash
cd frontend
# 먼저 NPC ID 2개 확인
bun -e "import {createClient} from '@supabase/supabase-js'; const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); const {data}=await s.from('clones').select('id,name').eq('is_npc',true).limit(5); console.log(data)"

# 위 출력의 id 두 개를 복사 후
bun run scripts/dev-run-interaction.ts <idA> <idB>
```

Expected: 20개 턴 전사 출력 + realism 체크리스트

- [ ] **Step 4: 커밋 (실행 결과와 무관)**

```bash
cd /Users/jh/dating
git add frontend/src/lib/validation/interaction.ts \
  frontend/src/lib/interaction/engine.ts \
  frontend/scripts/dev-run-interaction.ts \
  frontend/package.json frontend/bun.lockb
git commit -m "feat(interaction): engine loop + dev CLI runner"
```

---

### Task B.4 (1차 Realism 튜닝 루프)

**Files:**
- Modify: `frontend/src/lib/prompts/behavior.ts` (필요 시)
- Modify: `frontend/src/lib/prompts/interaction.ts` (필요 시)

- [ ] **Step 1: 3개 NPC 조합 실행**

```bash
cd frontend
# 예: 지민×태현, 지민×서연, 태현×하린
bun run scripts/dev-run-interaction.ts <id1> <id2>
bun run scripts/dev-run-interaction.ts <id1> <id3>
bun run scripts/dev-run-interaction.ts <id2> <id4>
```

- [ ] **Step 2: 전사 3개를 realism 체크리스트로 평가**

각 전사에 대해 위 8개 체크 항목 모두 yes여야 통과. 하나라도 no면 원인 파악:
- "AI로서" 같은 메타 언급 → `BEHAVIOR_INSTRUCTIONS` 문구 강화
- 매 턴마다 질문 → 질문 비율 원칙 더 명확히
- 페르소나별 말투 차이 없음 → persona의 `communication_style`, `humor_style`이 system prompt에 제대로 들어가는지 확인 (NPC seed가 해당 필드를 채웠는지 check)
- 턴 길이 일정 → "한 단어 감탄도 허용" 문구 추가

- [ ] **Step 3: 수정 후 재실행**

같은 스크립트로 3회 재실행 후 모두 통과할 때까지 반복.

- [ ] **Step 4: 튜닝 커밋**

```bash
cd /Users/jh/dating
git add frontend/src/lib/prompts/
git commit -m "chore(prompts): tune realism based on dev CLI observations"
```

만약 수정사항 없으면 이 step skip.

---

## Group C — API 라우트 (B 완료 후)

### Task C.1: `POST /api/interactions` (생성)

**Files:**
- Create: `frontend/src/app/api/interactions/route.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/app/api/interactions/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createInteractionSchema } from '@/lib/validation/interaction'
import { DEFAULT_SCENARIOS, INTERACTION_DEFAULTS } from '@/lib/config/interaction'
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

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw errors.unauthorized()

    // 내가 만든 interaction 목록 (created_by = user.id)
    const { data, error } = await supabase
      .from('interactions')
      .select('*, interaction_participants(clone_id, clones(id, name, is_npc))')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw errors.validation(error.message)
    return NextResponse.json({ interactions: data ?? [] })
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
    const parsed = createInteractionSchema.safeParse(body)
    if (!parsed.success) {
      throw errors.validation('입력 검증 실패', parsed.error.flatten())
    }
    const { participantCloneIds, scenarioId, setting, maxTurns, metadata } = parsed.data

    // Clone 2개 fetch + 소유권 검사
    const { data: clones, error: cErr } = await supabase
      .from('clones')
      .select('*')
      .in('id', participantCloneIds)
    if (cErr) throw errors.validation(cErr.message)
    if (!clones || clones.length !== 2) throw errors.notFound('Clone')

    // 참여자 중 최소 1명은 내 Clone이어야 함
    const ownMine = (clones as Clone[]).some(
      (c) => !c.is_npc && c.user_id === user.id
    )
    if (!ownMine) throw errors.forbidden()

    const scenario = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId)
    if (!scenario) throw errors.validation(`unknown scenario: ${scenarioId}`)

    const admin = createServiceClient()
    const { data: interaction, error: iErr } = await admin
      .from('interactions')
      .insert({
        kind: 'pair-chat',
        scenario: scenario.label,
        setting: setting ?? null,
        status: 'pending',
        max_turns: maxTurns ?? INTERACTION_DEFAULTS.MAX_TURNS,
        metadata: { scenarioId: scenario.id, ...(metadata ?? {}) },
        created_by: user.id,
      })
      .select()
      .single()
    if (iErr || !interaction) throw errors.validation(iErr?.message ?? 'insert failed')

    const { error: pErr } = await admin.from('interaction_participants').insert(
      participantCloneIds.map((id) => ({
        interaction_id: interaction.id,
        clone_id: id,
        role: 'speaker',
      }))
    )
    if (pErr) throw errors.validation(pErr.message)

    return NextResponse.json({ interaction })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd frontend && npm run typecheck
```
Expected: 에러 없음

---

### Task C.2: `POST /api/interactions/[id]/run` (실행 트리거)

**Files:**
- Create: `frontend/src/app/api/interactions/[id]/run/route.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/app/api/interactions/[id]/run/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runInteraction } from '@/lib/interaction/engine'
import { DEFAULT_SCENARIOS } from '@/lib/config/interaction'
import { errors, AppError } from '@/lib/errors'
import type { Clone, CloneMemory } from '@/types/persona'

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

export const maxDuration = 300 // Vercel Fluid Compute, 기본값이 이미 300이나 명시

export async function POST(
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

    // interaction + participants fetch + 소유권 검증
    const { data: interaction, error: iErr } = await supabase
      .from('interactions')
      .select('*')
      .eq('id', id)
      .single()
    if (iErr || !interaction) throw errors.notFound('Interaction')
    if (interaction.created_by !== user.id) throw errors.forbidden()

    // 이미 running/completed/failed 인 경우 중복 실행 방지
    if (interaction.status !== 'pending') {
      return NextResponse.json({ ok: true, status: interaction.status })
    }

    const { data: participantRows } = await supabase
      .from('interaction_participants')
      .select('clone_id, clones(*)')
      .eq('interaction_id', id)

    const participants = (participantRows ?? [])
      .map((r) => (r as { clones: Clone }).clones)
      .filter(Boolean)

    if (participants.length !== 2) throw errors.validation('참여자가 2명이어야 합니다')

    // 메모리 fetch (Plan 5 전에는 비어 있음, 빈 배열로 OK)
    const memoriesByClone = new Map<string, CloneMemory[]>()
    for (const p of participants) memoriesByClone.set(p.id, [])

    const metadata = (interaction.metadata ?? {}) as { scenarioId?: string }
    const scenarioId = metadata.scenarioId ?? DEFAULT_SCENARIOS[0].id
    const scenario = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId) ?? DEFAULT_SCENARIOS[0]

    const admin = createServiceClient()

    // status running + started_at
    await admin
      .from('interactions')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', id)

    const result = await runInteraction({
      interactionId: id,
      participants,
      memoriesByClone,
      scenario: {
        id: scenario.id,
        label: scenario.label,
        description: scenario.description,
      },
      setting: interaction.setting,
      maxTurns: interaction.max_turns,
    })

    await admin
      .from('interactions')
      .update({
        status: result.status,
        ended_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          ...(result.failureReason ? { failure_reason: result.failureReason } : {}),
          turnsCompleted: result.turnsCompleted,
        },
      })
      .eq('id', id)

    return NextResponse.json({ ok: true, status: result.status })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd frontend && npm run typecheck
```
Expected: 에러 없음

---

### Task C.3: `GET /api/interactions/[id]` (조회)

**Files:**
- Create: `frontend/src/app/api/interactions/[id]/route.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/app/api/interactions/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    const { data: interaction, error: iErr } = await supabase
      .from('interactions')
      .select(
        '*, interaction_participants(clone_id, clones(id, name, is_npc, persona_json))'
      )
      .eq('id', id)
      .single()

    if (iErr || !interaction) throw errors.notFound('Interaction')

    const { data: events } = await supabase
      .from('interaction_events')
      .select('*')
      .eq('interaction_id', id)
      .order('turn_number', { ascending: true })

    return NextResponse.json({ interaction, events: events ?? [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}
```

- [ ] **Step 2: 타입 체크 + Group C 커밋**

```bash
cd frontend && npm run typecheck
```
Expected: 통과

```bash
cd /Users/jh/dating
git add frontend/src/app/api/interactions/
git commit -m "feat(api): interactions create, run, and read routes"
```

---

## Group E — UI 프리미티브 (C와 병렬 가능)

### Task E.1: `MessageBubble` 컴포넌트

**Files:**
- Create: `frontend/src/components/interaction/MessageBubble.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// frontend/src/components/interaction/MessageBubble.tsx
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { END_PROMISE_MARKER } from '@/lib/config/interaction'

export interface MessageBubbleProps {
  speakerName: string
  content: string
  side: 'left' | 'right'
  turnNumber: number
}

export function MessageBubble({
  speakerName,
  content,
  side,
  turnNumber,
}: MessageBubbleProps) {
  const cleanContent = content.replaceAll(END_PROMISE_MARKER, '').trim()
  return (
    <div
      className={cn(
        'flex w-full gap-2',
        side === 'right' ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn('max-w-[75%]', side === 'right' ? 'order-2' : '')}>
        <p className="mb-1 text-xs text-muted-foreground">{speakerName}</p>
        <Card
          className={cn(
            'px-4 py-2 text-sm leading-relaxed',
            side === 'right'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          )}
        >
          {cleanContent}
        </Card>
        <p className="mt-1 text-[10px] text-muted-foreground">#{turnNumber + 1}</p>
      </div>
    </div>
  )
}
```

---

### Task E.2: `TypingIndicator`

**Files:**
- Create: `frontend/src/components/interaction/TypingIndicator.tsx`
- Modify: `frontend/src/app/globals.css` (keyframes)

- [ ] **Step 1: keyframes 추가**

`frontend/src/app/globals.css` 하단에 추가:

```css
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.typing-dot {
  animation: typing-bounce 1.2s infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.3s; }
```

- [ ] **Step 2: 컴포넌트 작성**

```tsx
// frontend/src/components/interaction/TypingIndicator.tsx
import { Card } from '@/components/ui/card'

interface TypingIndicatorProps {
  speakerName: string
  side: 'left' | 'right'
}

export function TypingIndicator({ speakerName, side }: TypingIndicatorProps) {
  const justify = side === 'right' ? 'justify-end' : 'justify-start'
  return (
    <div className={`flex w-full ${justify}`}>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">{speakerName}</p>
        <Card className="flex items-center gap-1 bg-muted px-4 py-3">
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        </Card>
      </div>
    </div>
  )
}
```

---

### Task E.3: `InteractionStatusBadge` + `InteractionProgressBar`

**Files:**
- Create: `frontend/src/components/interaction/InteractionStatusBadge.tsx`
- Create: `frontend/src/components/interaction/InteractionProgressBar.tsx`

- [ ] **Step 1: StatusBadge**

```tsx
// frontend/src/components/interaction/InteractionStatusBadge.tsx
import { Badge } from '@/components/ui/badge'
import type { InteractionStatus } from '@/types/interaction'

const LABELS: Record<InteractionStatus, string> = {
  pending: '대기',
  running: '진행 중',
  completed: '완료',
  failed: '실패',
  cancelled: '취소',
}

const VARIANTS: Record<
  InteractionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  running: 'default',
  completed: 'secondary',
  failed: 'destructive',
  cancelled: 'outline',
}

export function InteractionStatusBadge({ status }: { status: InteractionStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>
}
```

- [ ] **Step 2: ProgressBar**

```tsx
// frontend/src/components/interaction/InteractionProgressBar.tsx
interface Props {
  current: number
  total: number
}

export function InteractionProgressBar({ current, total }: Props) {
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>진행</span>
        <span>
          {current}/{total} 턴
        </span>
      </div>
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

**주의**: 여기는 `style={{ width }}` 사용 — dynamic percentage 는 CLAUDE.md 예외 케이스에 해당. 다른 곳에는 inline style 쓰지 말 것.

---

### Task E.4: `InteractionPairPicker`

**Files:**
- Create: `frontend/src/components/interaction/InteractionPairPicker.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// frontend/src/components/interaction/InteractionPairPicker.tsx
'use client'

import { useState } from 'react'
import type { Clone } from '@/types/persona'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CloneNpcBadge } from '@/components/clone/CloneNpcBadge'

interface Props {
  mine: Clone[]
  npcs: Clone[]
  selected: [string | null, string | null]
  onChange: (ids: [string | null, string | null]) => void
}

export function InteractionPairPicker({ mine, npcs, selected, onChange }: Props) {
  return (
    <div className="space-y-6">
      <PickerColumn
        title="내 Clone (필수)"
        clones={mine}
        value={selected[0]}
        onPick={(id) => onChange([id, selected[1]])}
      />
      <PickerColumn
        title="상대 (내 Clone 또는 NPC)"
        clones={[...mine.filter((c) => c.id !== selected[0]), ...npcs]}
        value={selected[1]}
        onPick={(id) => onChange([selected[0], id])}
      />
    </div>
  )
}

function PickerColumn({
  title,
  clones,
  value,
  onPick,
}: {
  title: string
  clones: Clone[]
  value: string | null
  onPick: (id: string) => void
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {clones.length === 0 ? (
        <p className="text-sm text-muted-foreground">선택 가능한 Clone이 없습니다.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {clones.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              className={cn(
                'text-left',
                value === c.id ? 'ring-2 ring-primary' : ''
              )}
            >
              <Card className="flex h-full min-h-[5rem] flex-col p-3 transition hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  {c.is_npc && <CloneNpcBadge />}
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {c.persona_json.self_description ?? '\u00A0'}
                </p>
              </Card>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
```

---

### Task E.5: `ScenarioPicker`

**Files:**
- Create: `frontend/src/components/interaction/ScenarioPicker.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// frontend/src/components/interaction/ScenarioPicker.tsx
'use client'

import { DEFAULT_SCENARIOS } from '@/lib/config/interaction'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (id: string) => void
}

export function ScenarioPicker({ value, onChange }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {DEFAULT_SCENARIOS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn('text-left', value === s.id ? 'ring-2 ring-primary' : '')}
        >
          <Card className="flex h-full min-h-[6rem] flex-col p-3 transition hover:bg-muted/50">
            <p className="font-medium">{s.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
          </Card>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Group E 전체 타입 체크 + 커밋**

```bash
cd frontend && npm run typecheck
```

```bash
cd /Users/jh/dating
git add frontend/src/components/interaction/ frontend/src/app/globals.css
git commit -m "feat(ui): interaction primitives — bubble, typing, pickers, progress"
```

---

## Group F — 페이지 + Viewer 통합

### Task F.1: `InteractionViewer` 클라이언트 컴포넌트

**Files:**
- Create: `frontend/src/components/interaction/InteractionViewer.tsx`

이 컴포넌트가 Plan 4의 UX 심장. 다음 역할:
1. props로 초기 interaction + events + participants 받기
2. mount 시 Realtime 구독 시작
3. mount 시 POST `/api/interactions/[id]/run` fire-and-forget (status=pending 일 때만)
4. 새 event 도착 시 list에 append
5. heartbeat 모니터링 → 5초 넘게 새 이벤트 없으면 TypingIndicator 표시
6. status 전환 표시
7. 진행바 업데이트
8. 완료 시 "분석 보기" 자리 표시 (Plan 5에서 활성화)

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/components/interaction/InteractionViewer.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeInteractionEvents, type ConnectionStatus } from '@/lib/supabase/realtime'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { InteractionStatusBadge } from './InteractionStatusBadge'
import { InteractionProgressBar } from './InteractionProgressBar'
import { Card } from '@/components/ui/card'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
import type { Interaction, InteractionEvent, InteractionStatus } from '@/types/interaction'
import type { Clone } from '@/types/persona'

interface Props {
  interaction: Interaction
  initialEvents: InteractionEvent[]
  participants: Clone[] // length 2, order = side [left, right]
}

export function InteractionViewer({ interaction, initialEvents, participants }: Props) {
  const [events, setEvents] = useState<InteractionEvent[]>(initialEvents)
  const [status, setStatus] = useState<InteractionStatus>(interaction.status)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<number>(() =>
    initialEvents.length > 0 ? Date.now() : Date.now()
  )
  const [heartbeatStale, setHeartbeatStale] = useState(false)
  const runTriggeredRef = useRef(false)

  const [leftClone, rightClone] = participants

  // Realtime 구독
  useEffect(() => {
    const sub = subscribeInteractionEvents({
      interactionId: interaction.id,
      onEvent: (e) => {
        setEvents((prev) => {
          if (prev.some((x) => x.id === e.id)) return prev
          return [...prev, e].sort((a, b) => a.turn_number - b.turn_number)
        })
        setLastEventAt(Date.now())
        setHeartbeatStale(false)
      },
      onStatusChange: setConnection,
    })
    return () => sub.unsubscribe()
  }, [interaction.id])

  // run 트리거 (pending 상태에서만 1회)
  useEffect(() => {
    if (runTriggeredRef.current) return
    if (interaction.status !== 'pending') return
    runTriggeredRef.current = true
    fetch(`/api/interactions/${interaction.id}/run`, { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.status) setStatus(data.status)
      })
      .catch(() => {
        // 네트워크 실패해도 서버가 실행 중일 수 있음 — Realtime이 상태 복구
      })
  }, [interaction.id, interaction.status])

  // heartbeat 모니터링
  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => {
      if (Date.now() - lastEventAt > INTERACTION_DEFAULTS.HEARTBEAT_WARNING_MS) {
        setHeartbeatStale(true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lastEventAt, status])

  // status polling (run 끝나면 Realtime으로 오는 게 아니라 server update → poll로 보완)
  useEffect(() => {
    if (status === 'completed' || status === 'failed') return
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/interactions/${interaction.id}`)
        const data = await r.json()
        if (data?.interaction?.status) {
          setStatus(data.interaction.status)
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [interaction.id, status])

  const sideOf = (cloneId: string): 'left' | 'right' =>
    cloneId === leftClone.id ? 'left' : 'right'

  const maxTurns = interaction.max_turns
  const nextSpeaker = useMemo(() => {
    if (status !== 'running') return null
    const nextTurn = events.length
    if (nextTurn >= maxTurns) return null
    return participants[nextTurn % participants.length]
  }, [events.length, maxTurns, participants, status])

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {leftClone.name} × {rightClone.name}
          </h2>
          <InteractionStatusBadge status={status} />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{interaction.scenario}</p>
        <InteractionProgressBar current={events.length} total={maxTurns} />
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Realtime: {connection}</span>
          {heartbeatStale && status === 'running' && (
            <span className="text-amber-600">응답 기다리는 중...</span>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {events.length === 0 && status === 'pending' && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            대화를 시작하는 중...
          </Card>
        )}
        {events.map((e) => {
          const speaker = participants.find((p) => p.id === e.speaker_clone_id)
          return (
            <MessageBubble
              key={e.id}
              turnNumber={e.turn_number}
              speakerName={speaker?.name ?? '?'}
              content={e.content}
              side={sideOf(e.speaker_clone_id)}
            />
          )
        })}
        {nextSpeaker && (
          <TypingIndicator
            speakerName={nextSpeaker.name}
            side={sideOf(nextSpeaker.id)}
          />
        )}
      </div>

      {status === 'completed' && (
        <Card className="p-4 text-center">
          <p className="mb-2 text-sm">대화가 완료되었습니다.</p>
          <p className="text-xs text-muted-foreground">
            호환성 분석은 Plan 5에서 활성화됩니다.
          </p>
        </Card>
      )}
      {status === 'failed' && (
        <Card className="p-4 text-center text-destructive">
          <p className="text-sm">대화 실행에 실패했습니다. 새 Interaction을 시작해보세요.</p>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd frontend && npm run typecheck
```

---

### Task F.2: `/interactions/[id]/page.tsx`

**Files:**
- Create: `frontend/src/app/interactions/[id]/page.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/app/interactions/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InteractionViewer } from '@/components/interaction/InteractionViewer'
import type { Clone } from '@/types/persona'
import type { Interaction, InteractionEvent } from '@/types/interaction'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ParticipantRow {
  clone_id: string
  clones: Clone
}

export default async function InteractionViewerPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: interaction } = await supabase
    .from('interactions')
    .select('*')
    .eq('id', id)
    .single<Interaction>()
  if (!interaction) notFound()

  const { data: participantRows } = await supabase
    .from('interaction_participants')
    .select('clone_id, clones(*)')
    .eq('interaction_id', id)

  const participants =
    (participantRows as ParticipantRow[] | null)?.map((r) => r.clones) ?? []
  if (participants.length !== 2) notFound()

  const { data: events } = await supabase
    .from('interaction_events')
    .select('*')
    .eq('interaction_id', id)
    .order('turn_number', { ascending: true })

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/interactions"
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Interactions 목록
      </Link>
      <InteractionViewer
        interaction={interaction}
        initialEvents={(events ?? []) as InteractionEvent[]}
        participants={participants}
      />
    </main>
  )
}
```

---

### Task F.3: `/interactions/new/page.tsx`

**Files:**
- Create: `frontend/src/app/interactions/new/page.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/app/interactions/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InteractionPairPicker } from '@/components/interaction/InteractionPairPicker'
import { ScenarioPicker } from '@/components/interaction/ScenarioPicker'
import { DEFAULT_SCENARIOS } from '@/lib/config/interaction'
import type { Clone } from '@/types/persona'

export default function NewInteractionPage() {
  const router = useRouter()
  const [mine, setMine] = useState<Clone[]>([])
  const [npcs, setNpcs] = useState<Clone[]>([])
  const [pair, setPair] = useState<[string | null, string | null]>([null, null])
  const [scenarioId, setScenarioId] = useState<string>(DEFAULT_SCENARIOS[0].id)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clones')
      .then((r) => r.json())
      .then((data) => {
        setMine(data.mine ?? [])
        setNpcs(data.npcs ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleStart() {
    if (!pair[0] || !pair[1]) {
      setError('두 Clone을 선택해주세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantCloneIds: pair,
          scenarioId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? '생성 실패')
      router.push(`/interactions/${data.interaction.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Clone 불러오는 중...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">새 Interaction</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          두 Clone을 선택하고 시나리오를 고르면 대화가 시작됩니다.
        </p>
      </header>

      <div className="space-y-6">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">참여자</h2>
          <InteractionPairPicker
            mine={mine}
            npcs={npcs}
            selected={pair}
            onChange={setPair}
          />
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">시나리오</h2>
          <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button onClick={handleStart} disabled={submitting}>
            {submitting ? '시작 중...' : '대화 시작'}
          </Button>
        </div>
      </div>
    </main>
  )
}
```

---

### Task F.4: `/interactions/page.tsx` (목록)

**Files:**
- Create: `frontend/src/app/interactions/page.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/app/interactions/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { InteractionStatusBadge } from '@/components/interaction/InteractionStatusBadge'
import type { Interaction } from '@/types/interaction'
import type { Clone } from '@/types/persona'

interface InteractionRow extends Interaction {
  interaction_participants: Array<{ clone_id: string; clones: Pick<Clone, 'id' | 'name' | 'is_npc'> }>
}

export default async function InteractionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('interactions')
    .select('*, interaction_participants(clone_id, clones(id, name, is_npc))')
    .eq('created_by', user?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(50)

  const interactions = (data ?? []) as InteractionRow[]

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Interactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clone 간 대화 기록을 확인하고 새로 시작하세요.
          </p>
        </div>
        <Link href="/interactions/new" className={buttonVariants({ size: 'sm' })}>
          + 새 Interaction
        </Link>
      </header>

      {interactions.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          아직 기록이 없어요. 새 Interaction을 시작해보세요.
        </Card>
      ) : (
        <div className="space-y-2">
          {interactions.map((i) => {
            const names = i.interaction_participants
              .map((p) => p.clones?.name ?? '?')
              .join(' × ')
            return (
              <Link key={i.id} href={`/interactions/${i.id}`} className="block">
                <Card className="flex items-center justify-between p-4 transition hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{names}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {i.scenario}
                    </p>
                  </div>
                  <InteractionStatusBadge status={i.status} />
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
```

---

### Task F.5: AppNav 업데이트

**Files:**
- Modify: `frontend/src/components/nav/AppNav.tsx`

- [ ] **Step 1: 기존 내용 확인**

```bash
cat frontend/src/components/nav/AppNav.tsx
```

- [ ] **Step 2: "Interactions" 링크 추가**

네비게이션 링크 목록에 `{ href: '/interactions', label: 'Interactions' }` 추가. 기존 Clones 링크 뒤에 위치.

구체적인 추가 위치는 파일 구조에 따라 적절히 배치. 기존 `/clones` 링크와 나란히.

- [ ] **Step 3: Group F 타입 체크 + 커밋**

```bash
cd frontend && npm run typecheck && npm run build
```
Expected: 모두 통과

```bash
cd /Users/jh/dating
git add frontend/src/components/interaction/InteractionViewer.tsx \
  frontend/src/app/interactions/ \
  frontend/src/components/nav/AppNav.tsx
git commit -m "feat(ui): interactions list, new, and realtime viewer pages"
```

---

## Group G — 품질 검증 (가장 중요)

### Task G.1: 브라우저 E2E 플로우

**Prerequisite**: 사용자가 `.env.local`에 `ANTHROPIC_API_KEY`를 설정.

- [ ] **Step 1: dev 서버 기동**

```bash
cd frontend && bun run dev
```

- [ ] **Step 2: 브라우저에서 테스트**

1. http://localhost:3000 로그인
2. `/clones` 에서 내 Clone이 없으면 하나 생성
3. Navbar → Interactions → "+ 새 Interaction"
4. 내 Clone × NPC 지민 선택, "온라인 대화 앱" 시나리오
5. "대화 시작" → 자동으로 `/interactions/[id]` 이동
6. **관찰**:
   - 진행바가 0/20 부터 시작하는가?
   - 첫 메시지가 5초 내에 나타나는가?
   - 턴이 Realtime으로 하나씩 들어오는가? (새로고침 없이)
   - TypingIndicator 가 다음 발화자 자리에 표시되는가?
   - 최종 status 가 `completed` 로 바뀌는가?
   - 콘솔/Network 에러 없는가?

- [ ] **Step 3: 문제 발견 시 원인별 수정**

| 증상 | 원인 후보 | 조치 |
|---|---|---|
| Realtime 이벤트가 안 옴 | publication 미활성 또는 RLS | Plan 2 migration 07 확인, service role 사용 확인 |
| 첫 메시지 안 나옴 | `run` 라우트 401/404 | 쿠키 전송 / 소유권 체크 |
| 콘솔에 `ANTHROPIC_API_KEY` 에러 | env 누락 | `.env.local` 설정 후 서버 재시작 |
| 턴 간격이 너무 김 | 정상 (Claude sonnet 응답시간) | 진행바와 TypingIndicator로 UX 보완 |

---

### Task G.2: Realism 체크리스트 (브라우저 완료본)

- [ ] **Step 1: 완료된 interaction 2개 이상 관찰**

서로 다른 페어·시나리오 조합으로 2회 이상 실행.

- [ ] **Step 2: Plan 상단 "대화 현실감 체크리스트" 8개 항목 적용**

각 interaction에 대해 8개 항목 평가. 통과/미통과 기록.

- [ ] **Step 3: 미통과 항목 → 프롬프트 조정**

- [ ] **Step 4: 재실행 및 재평가**

- [ ] **Step 5: 최종 튜닝 커밋 (있을 경우)**

```bash
git add frontend/src/lib/prompts/
git commit -m "chore(prompts): final realism tuning"
```

---

### Task G.3: 완료 태깅

- [ ] **Step 1: 전체 테스트 + 빌드 최종 확인**

```bash
cd frontend && npm run typecheck && npm run test:run && npm run build
```
Expected: 전부 통과

- [ ] **Step 2: 태그**

```bash
cd /Users/jh/dating
git tag plan4-interaction-complete
```

- [ ] **Step 3: 사용자 최종 확인 요청**

사용자가 브라우저에서 직접 한 번 더 대화 시나리오를 돌려보고 만족하면 Plan 5로 진행.

---

## Self-Review

### Spec Coverage
- [x] `POST /api/interactions` — C.1
- [x] `GET /api/interactions/[id]` — C.3
- [x] `POST /api/interactions/[id]/run` (spec 변형) — C.2
- [x] Realtime 구독 — D.1, F.1
- [x] 20턴 엔진 — B.2
- [x] Role 재매핑 — 기존 Plan 1 remap.ts 재사용
- [x] 페르소나 system prompt 주입 — 기존 buildSystemPrompt
- [x] 첫 user 메시지로 시나리오 주입 — A.5
- [x] AI-like 반패턴 강화 — A.4
- [x] 뷰어 + 진행바 + TypingIndicator + heartbeat — F.1
- [x] 페어 + 시나리오 선택 UI — F.3
- [x] Interactions 목록 — F.4
- [x] Nav 업데이트 — F.5
- [x] Dev CLI 튜닝 도구 — B.3
- [x] Realism 검증 — G.1-G.3

### 범위 밖 (확인)
- 분석 생성/UI — Plan 5 ✅
- 메모리 입력 UI — Plan 5 ✅
- 사용자 중단 버튼 — skip ✅
- 토큰 단위 SSE — Phase 2 ✅

### 타입 일관성
- `runInteraction` 의 `participants: Clone[]` ↔ 뷰어/엔진 호출 일관 ✅
- `InteractionEvent` 필드 Plan 2 migration 과 일치 ✅
- `DEFAULT_SCENARIOS` id → create/run 양쪽에서 조회 일관 ✅

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-04-11-phase1-plan4-interaction-engine.md`.

**추천 실행 방식**: Subagent-Driven Development (superpowers:subagent-driven-development)
- Group A/D 병렬 dispatch → B → C/E 병렬 → F → G (직접 수행)
- Group G는 **반드시 사용자 눈으로 확인**해야 하므로 메인 세션에서 수행 (subagent 아님)
- 각 Group 끝에 review 체크포인트

**실행 전 사용자 확인 필요**:
1. `ANTHROPIC_API_KEY` 를 `frontend/.env.local` 에 설정했는가?
2. `bun` 이 설치되어 있는가? (Plan 1 때는 없었음 — 필요 시 `npm` 으로 대체)
3. NPC seed 가 Supabase 에 실제로 5개 들어 있는가? (`plan2-supabase-complete` 태그 시점에 완료)
