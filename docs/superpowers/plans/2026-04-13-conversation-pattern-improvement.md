# 클론 대화 패턴 개선 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관계별 존댓말/반말 자동 결정 + 대화 중 전환 + 전문용어/기억 과의존 방지 프롬프트 규칙 추가.

**Architecture:** `clone_relationships.speech_register` 컬럼으로 관계별 말투 상태 관리. 초기값은 나이 차이 + interaction_count로 deterministic 결정. 대화 중 `<banmal-switch/>` 태그로 실시간 전환. `pickStyleCards()`가 speech_register를 받아 적절한 카드 매칭. behavior.ts에 3개 규칙 추가.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Vitest

---

### Task 1: DB 마이그레이션 — `speech_register` 컬럼

**Files:**
- Create: `frontend/supabase/migrations/20260413000006_speech_register.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- clone_relationships에 말투 상태 컬럼 추가
alter table clone_relationships
  add column speech_register text default null;

-- 유효값: 'formal', 'casual', 'banmal-ready', null(미결정)
comment on column clone_relationships.speech_register is 'formal | casual | banmal-ready | null';
```

- [ ] **Step 2: Supabase Cloud 적용**

Run: `cd frontend && npx supabase db push --linked`

- [ ] **Step 3: Commit**

```bash
git add frontend/supabase/migrations/20260413000006_speech_register.sql
git commit -m "feat: add speech_register column to clone_relationships"
```

---

### Task 2: 타입 + 상수 + `getSpeechRegister()` 순수 함수

**Files:**
- Modify: `frontend/src/types/relationship.ts`
- Modify: `frontend/src/lib/config/interaction.ts`
- Create: `frontend/src/lib/config/interaction.speech.test.ts`

- [ ] **Step 1: `CloneRelationship` 타입에 `speech_register` 추가**

`frontend/src/types/relationship.ts`에서 `CloneRelationship` 인터페이스에 추가:

```ts
export type SpeechRegister = 'formal' | 'casual' | 'banmal-ready'

export interface CloneRelationship {
  id: string
  clone_id: string
  target_clone_id: string
  interaction_count: number
  summary: string
  memories: RelationshipMemoryItem[]
  speech_register: SpeechRegister | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: `getSpeechRegister()` 함수 + 상수 추가**

`frontend/src/lib/config/interaction.ts` 맨 끝에 추가:

```ts
import type { SpeechRegister } from '@/types/relationship'

export const SPEECH_REGISTERS = ['formal', 'casual', 'banmal-ready'] as const

/**
 * 나이 차이 + interaction_count 기반으로 말투 초기값 결정. deterministic.
 * 이미 DB에 값이 있으면 이 함수를 호출하지 않는다.
 */
export function getSpeechRegister(
  selfAge: number | null,
  partnerAge: number | null,
  interactionCount: number,
): SpeechRegister {
  if (selfAge !== null && partnerAge !== null) {
    const diff = Math.abs(selfAge - partnerAge)
    if (diff >= 5) return 'formal'
    if (interactionCount >= 3) return 'casual'
    return 'banmal-ready'
  }
  // 나이 정보 없음
  return 'banmal-ready'
}
```

**주의**: `import type`을 파일 맨 위에 추가. 기존 export들 아래에 새 코드 추가.

- [ ] **Step 3: 테스트 작성**

`frontend/src/lib/config/interaction.speech.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getSpeechRegister } from './interaction'

describe('getSpeechRegister', () => {
  it('나이 차이 5살 이상 → formal', () => {
    expect(getSpeechRegister(25, 31, 0)).toBe('formal')
    expect(getSpeechRegister(20, 30, 10)).toBe('formal')
  })

  it('나이 차이 4살 이내 & 첫만남 → banmal-ready', () => {
    expect(getSpeechRegister(25, 27, 0)).toBe('banmal-ready')
    expect(getSpeechRegister(25, 25, 0)).toBe('banmal-ready')
  })

  it('나이 차이 4살 이내 & 3회 이상 → casual', () => {
    expect(getSpeechRegister(25, 27, 3)).toBe('casual')
    expect(getSpeechRegister(25, 25, 5)).toBe('casual')
  })

  it('나이 차이 4살 이내 & 1-2회 → banmal-ready', () => {
    expect(getSpeechRegister(25, 27, 1)).toBe('banmal-ready')
    expect(getSpeechRegister(25, 27, 2)).toBe('banmal-ready')
  })

  it('나이 정보 없음 → banmal-ready', () => {
    expect(getSpeechRegister(null, 27, 0)).toBe('banmal-ready')
    expect(getSpeechRegister(25, null, 3)).toBe('banmal-ready')
    expect(getSpeechRegister(null, null, 10)).toBe('banmal-ready')
  })
})
```

- [ ] **Step 4: 테스트 실행**

Run: `cd frontend && npx vitest run src/lib/config/interaction.speech.test.ts`

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/relationship.ts frontend/src/lib/config/interaction.ts frontend/src/lib/config/interaction.speech.test.ts
git commit -m "feat: getSpeechRegister() + SpeechRegister type"
```

---

### Task 3: behavior.ts — 3개 규칙 추가

**Files:**
- Modify: `frontend/src/lib/prompts/behavior.ts`

- [ ] **Step 1: 기존 번호 정리 + 3개 규칙 추가**

`frontend/src/lib/prompts/behavior.ts`에서:

1. 기존 중복 번호 수정: 두 번째 `4.` → `5.`, 기존 `5.` → 그대로 (이미 5), 기존 `6.` → `8.`, 기존 `7.` → `9.`

2. `5. **AI 티 금지**` 뒤, `6. **종료 신호**` 앞에 3개 규칙 삽입:

```
6. **기억 활용 원칙**
   - 이전 대화 기억은 참고 자료이지 대화 스크립트가 아닙니다.
   - 기억은 현재 대화 흐름에 자연스럽게 연결될 때만 꺼내세요. 상대가 관련 주제를 먼저 꺼내거나, 맥락상 자연스러울 때만.
   - 알고 있는 모든 걸 대화에서 언급할 필요 없습니다. 실제 사람도 그렇게 하지 않습니다.
   - 나쁜 예: (상대가 "오늘 뭐 했어?" → "파이프라인 해저드 공부했는데 너 번아웃은 좀 나아졌어? 지난번에 오후 3시에 일어난다고 했잖아") ← 기억 3개를 한번에 쏟아냄
   - 좋은 예: (상대가 "오늘 뭐 했어?" → "공부 좀 했어 ㅋㅋ 너는?") ← 상대 반응 보고 자연스럽게 이어감

7. **상대에 맞춘 언어 수준**
   - 상대방의 직업·배경을 고려해서 말하세요. 상대가 같은 분야가 아니면 전문 용어를 쓰지 말고 일상 언어로 바꾸세요.
   - 나쁜 예: "파이프라인 해저드 때문에 망했어" ← 상대가 CS 전공 아님
   - 좋은 예: "좀 어려운 문제가 있어서 망한 것 같아 ㅋㅋ"
   - 상대가 같은 분야 사람이거나, 먼저 전문적 이야기를 꺼내면 그때 맞춰서 깊게 가도 됩니다.

8. **말투 (존댓말/반말)**
   - system prompt에 [말투: ...] 지시가 있습니다. 반드시 따르세요.
   - '존댓말 사용': 존댓말을 유지하세요.
   - '존댓말 사용 (반말 전환 가능)': 존댓말로 시작하되, 대화가 충분히 편해졌다고 느끼면 자연스럽게 "우리 말 편하게 할까요? ㅋㅋ" 같은 제안을 해도 됩니다. 제안할 때 메시지 끝에 <banmal-switch/>를 붙이세요.
   - '반말 사용': 반말을 사용하세요.
   - <banmal-switch/>는 한 대화에서 한 번만. 상대가 응하든 말든 이후 태그를 반복하지 마세요.
```

3. `말투 오염 금지` 규칙에서 `상대가 반말이어도 당신이 존댓말 페르소나면 존댓말 유지.` 문장을 `상대가 반말이어도 [말투] 지시에 따라 유지하세요.`로 변경.

- [ ] **Step 2: 최종 번호 확인**

전체 번호 순서: 1(정체성) → 2(대화 밀도) → 3(인사) → 4(질문 균형) → 5(말투 오염 금지) → 6(기억 활용) → 7(언어 수준) → 8(말투) → 9(AI 티 금지) → 10(종료 신호) → 11(발화자 태그)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/prompts/behavior.ts
git commit -m "feat: add memory usage, language level, speech register rules to behavior prompt"
```

---

### Task 4: 말투 렌더 함수 + system prompt 주입

**Files:**
- Modify: `frontend/src/lib/prompts/persona.ts`

- [ ] **Step 1: `renderSpeechRegister()` 함수 추가**

`frontend/src/lib/prompts/persona.ts`에서 `renderRelationshipMemory` 함수 앞에 추가:

```ts
import type { SpeechRegister } from '@/types/relationship'

const SPEECH_REGISTER_PROMPTS: Record<SpeechRegister, string> = {
  formal: '존댓말 사용',
  'banmal-ready': '존댓말 사용 (반말 전환 가능 — 자연스러운 타이밍에 "말 놓을까요?" 시도 가능)',
  casual: '반말 사용',
}

export function renderSpeechRegister(register: SpeechRegister | null): string {
  if (!register) return ''
  return `[말투: ${SPEECH_REGISTER_PROMPTS[register]}]`
}
```

- [ ] **Step 2: `EnhancedPromptInput`에 `speechRegister` 추가**

```ts
export interface EnhancedPromptInput {
  // ... existing fields ...
  speechRegister?: SpeechRegister | null
}
```

- [ ] **Step 3: `buildEnhancedSystemPrompt`에서 말투 주입**

관계 기억 주입 (4번) 직후, 메모리 주입 (5번) 직전에 추가:

```ts
  // 4-c. Speech register
  if (input.speechRegister) {
    const rendered = renderSpeechRegister(input.speechRegister)
    if (rendered) parts.push(rendered)
  }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/prompts/persona.ts
git commit -m "feat: renderSpeechRegister() + inject into enhanced system prompt"
```

---

### Task 5: orchestrate.ts — speech_register 결정 + 주입

**Files:**
- Modify: `frontend/src/lib/interaction/orchestrate.ts`

- [ ] **Step 1: import 추가**

```ts
import { getSpeechRegister } from '@/lib/config/interaction'
import type { SpeechRegister } from '@/types/relationship'
```

- [ ] **Step 2: `prepareClonePrompts` 시그니처 확장**

`runtimeConfig` Pick에 추가 필드 불필요 — speech_register는 관계 데이터에서 직접 읽음.

- [ ] **Step 3: 관계 기억 로딩 후 speech_register 결정 로직 추가**

기존 `pairRelationshipMap` 구성 후 (`// 0-a. Pair memory` 블록 끝), `// 0-b. Other memories` 블록 전에 추가:

```ts
  // 0-a-2. speech_register 결정 + DB 저장 (null이면 자동 결정)
  const speechRegisterMap = new Map<string, SpeechRegister>()
  if (participants.length === 2) {
    const [a, b] = participants
    for (const clone of participants) {
      const other = clone.id === a.id ? b : a
      const relKey = `${clone.id}→${other.id}`
      const rel = pairRelationshipMap.get(relKey)
      
      if (rel?.speech_register) {
        speechRegisterMap.set(clone.id, rel.speech_register as SpeechRegister)
      } else {
        const determined = getSpeechRegister(
          clone.persona_json.age,
          other.persona_json.age,
          rel?.interaction_count ?? 0,
        )
        speechRegisterMap.set(clone.id, determined)
        
        // DB에 저장 (다음 대화에서 재사용)
        if (rel) {
          const adminSr = createServiceClient()
          await adminSr
            .from('clone_relationships')
            .update({ speech_register: determined })
            .eq('id', rel.id)
        }
      }
    }
  }
```

- [ ] **Step 4: `buildEnhancedSystemPrompt` 호출에 `speechRegister` 전달**

기존 호출부에서:

```ts
    const systemPrompt = buildEnhancedSystemPrompt({
      // ... existing fields ...
      partnerContext: otherClone
        ? { name: otherClone.name, highlights: partnerHighlights }
        : null,
    })
```

다음을 추가:

```ts
      speechRegister: speechRegisterMap.get(clone.id) ?? null,
```

- [ ] **Step 5: `pickStyleCards` 호출에 `speechRegister` 전달**

기존:
```ts
    const styleCards = pickStyleCards(allStyleCards, persona, memories, mood, {
      topK: REALISM_DEFAULTS.STYLE_CARD_TOP_K,
    })
```

변경:
```ts
    const styleCards = pickStyleCards(allStyleCards, persona, memories, mood, {
      topK: REALISM_DEFAULTS.STYLE_CARD_TOP_K,
      speechRegister: speechRegisterMap.get(clone.id) ?? null,
    })
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/interaction/orchestrate.ts
git commit -m "feat: determine + inject speech_register in orchestration"
```

---

### Task 6: `pickStyleCards` — speechRegister 필터링

**Files:**
- Modify: `frontend/src/lib/styles/match.ts`

- [ ] **Step 1: `pickStyleCards` 옵션에 `speechRegister` 추가**

```ts
import type { SpeechRegister } from '@/types/relationship'

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
    // banmal-ready → formal 카드 사용 (아직 존댓말)
    // mixed 카드는 banmal-ready에서 허용
    filtered = cards.filter((c) => {
      const cardRegister = c.match.register
      if (!cardRegister) return true // register 없는 카드는 항상 포함
      if (sr === 'banmal-ready' && cardRegister === 'mixed') return true
      return cardRegister === registerFilter
    })
    // 필터 후 빈 배열이면 전체 카드로 fallback
    if (filtered.length === 0) filtered = cards
  }

  if (filtered.length === 1) return [filtered[0]]

  const scored = filtered
    .map((card) => ({ card, score: computeCardScore(card, persona, memories, mood) }))
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topK).map((s) => s.card)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/styles/match.ts
git commit -m "feat: pickStyleCards filters by speechRegister"
```

---

### Task 7: engine.ts — `<banmal-switch/>` 태그 파싱 + DB 업데이트

**Files:**
- Modify: `frontend/src/lib/interaction/engine.ts`

- [ ] **Step 1: 태그 정규식 추가**

기존 `CONTINUE_MARKER_RE`, `END_MARKER_RE` 옆에:

```ts
const BANMAL_SWITCH_RE = /<banmal-switch\s*\/?>/gi
```

- [ ] **Step 2: `parseSpeakerHint` 반환 타입에 `wantsBanmalSwitch` 추가**

```ts
function parseSpeakerHint(raw: string): {
  cleanContent: string
  wantsContinue: boolean
  wantsBanmalSwitch: boolean
} {
  const hasContinue = CONTINUE_MARKER_RE.test(raw)
  CONTINUE_MARKER_RE.lastIndex = 0
  const hasBanmalSwitch = BANMAL_SWITCH_RE.test(raw)
  BANMAL_SWITCH_RE.lastIndex = 0
  const clean = raw
    .replace(CONTINUE_MARKER_RE, '')
    .replace(END_MARKER_RE, '')
    .replace(BANMAL_SWITCH_RE, '')
    .trim()
  return { cleanContent: clean, wantsContinue: hasContinue, wantsBanmalSwitch: hasBanmalSwitch }
}
```

- [ ] **Step 3: 턴 루프에서 `wantsBanmalSwitch` 시 DB 업데이트**

기존 `const { cleanContent, wantsContinue } = parseSpeakerHint(rawContent)` 변경:

```ts
      const { cleanContent, wantsContinue, wantsBanmalSwitch } = parseSpeakerHint(rawContent)

      // banmal-switch 감지: 양방향 모두 casual로 전환
      if (wantsBanmalSwitch) {
        const otherCloneId = listener.id
        await admin
          .from('clone_relationships')
          .update({ speech_register: 'casual' })
          .or(`and(clone_id.eq.${speaker.id},target_clone_id.eq.${otherCloneId}),and(clone_id.eq.${otherCloneId},target_clone_id.eq.${speaker.id})`)
      }
```

이 코드를 `const { cleanContent, wantsContinue, wantsBanmalSwitch } = ...` 직후, `// 다음 발화자 결정` 블록 직전에 삽입.

- [ ] **Step 4: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`

Expected: 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/interaction/engine.ts
git commit -m "feat: parse <banmal-switch/> tag + update speech_register in DB"
```

---

### Task 8: 전체 테스트 + tsc + 문서

**Files:**
- Modify: `docs/PROJECT_STATE.md`

- [ ] **Step 1: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`

Expected: 모든 테스트 PASS

- [ ] **Step 2: TypeScript 체크**

Run: `cd frontend && npx tsc --noEmit`

Expected: 에러 없음

- [ ] **Step 3: PROJECT_STATE.md 업데이트**

추가/변경:
- 아키텍처 결정: "관계별 말투(speech_register) — 나이 차이 + 대화 횟수로 자동 결정, 대화 중 <banmal-switch/>로 전환"
- 마이그레이션 목록에 22번 추가
- behavior.ts 규칙 3개 추가 반영

- [ ] **Step 4: Commit**

```bash
git add docs/PROJECT_STATE.md
git commit -m "docs: update PROJECT_STATE with conversation pattern improvements"
```

---

### Task 9: 실제 프롬프트 출력 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: dev server에서 interaction 실행**

1. `/interactions/new`에서 이진형 ↔ 제니 대화 생성 + 실행
2. 대화 완료 후 결과 확인

- [ ] **Step 2: 실제 입력 프롬프트 로깅**

`lib/interaction/engine.ts`의 `callClaude` 호출 직전에 임시 로그 추가하여 실제 system prompt + messages 크기를 콘솔에 출력. 확인 후 로그 제거.

```ts
console.log('[prompt-debug] system:', systemPrompt.length, 'chars, messages:', history.length)
```

- [ ] **Step 3: 로그 확인 후 임시 로그 제거**
