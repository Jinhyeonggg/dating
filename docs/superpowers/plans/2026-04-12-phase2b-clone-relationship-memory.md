# Phase 2-B: Clone Relationship Memory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interaction 종료 후 양방향 관계 기억을 자동 추출하여 `clone_relationships`에 저장하고, 재대화 시 system prompt에 주입하여 Clone 간 연속성을 부여한다.

**Architecture:** Interaction 종료 → 기존 에피소드 메모리 추출과 병렬로 관계 기억 추출 (Haiku, Clone별 1회 × 2) → `clone_relationships` UPSERT. 재대화 시 `orchestrate.ts`에서 조회하여 system prompt에 주입.

**Tech Stack:** Next.js 16 App Router, Supabase, Anthropic Claude (Haiku), Vitest, Zod, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-12-implicit-persona-clone-identity-design.md` 섹션 3

**선행 조건:** Phase 2-A 완료 (필수는 아니지만, 풍부한 페르소나가 있어야 관계 기억 품질이 높음)

---

## File Structure

### 신규 파일
| 파일 | 책임 |
|---|---|
| `src/types/relationship.ts` | `CloneRelationship`, `ExtractedRelationshipMemory`, `RelationshipMemoryItem` 타입 |
| `src/lib/validation/relationship.ts` | 관계 기억 추출 결과 Zod 스키마 |
| `src/lib/prompts/relationship.ts` | 관계 기억 추출 프롬프트 템플릿 (솔직한 내면 평가 원칙 포함) |
| `src/lib/relationship/extract.ts` | 추출 결과 파싱 순수 함수 |
| `src/lib/relationship/extract.test.ts` | 파싱 테스트 |
| `src/lib/relationship/service.ts` | 추출 + UPSERT 서비스 |
| `src/lib/prompts/persona.relationship.test.ts` | `renderRelationshipMemory` 테스트 |

### 수정 파일
| 파일 | 변경 |
|---|---|
| `src/lib/config/interaction.ts` | `RELATIONSHIP_MEMORY_INJECTION_LIMIT` 상수 추가 |
| `src/lib/config/claude.ts` | `CLAUDE_MODELS.RELATIONSHIP`, `CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_RELATIONSHIP` 추가 |
| `src/lib/prompts/persona.ts` | `renderRelationshipMemory()` 함수 + `EnhancedPromptInput`에 필드 추가 |
| `src/lib/interaction/orchestrate.ts` | 관계 기억 조회 + system prompt 주입 |
| `src/app/api/interactions/[id]/run/route.ts` | Interaction 종료 후 관계 기억 추출 트리거 |

---

## Task 1: DB 마이그레이션 — `clone_relationships` 테이블

**Files:**
- Create: `supabase/migrations/20260412000005_clone_relationships.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 20260412000005_clone_relationships.sql
-- Phase 2-B: Clone 간 관계 기억

CREATE TABLE clone_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clone_id uuid NOT NULL REFERENCES clones(id) ON DELETE CASCADE,
  target_clone_id uuid NOT NULL REFERENCES clones(id) ON DELETE CASCADE,
  interaction_count int NOT NULL DEFAULT 1,
  summary text NOT NULL,
  memories jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clone_id, target_clone_id)
);

-- 인덱스: clone_id 기준 빈번 조회
CREATE INDEX idx_clone_relationships_clone_id ON clone_relationships(clone_id);
CREATE INDEX idx_clone_relationships_pair ON clone_relationships(clone_id, target_clone_id);

-- RLS
ALTER TABLE clone_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their clones' relationships"
  ON clone_relationships FOR SELECT
  USING (clone_id IN (SELECT id FROM clones WHERE user_id = auth.uid()));

COMMENT ON TABLE clone_relationships IS '각 Clone이 특정 상대 Clone에 대해 갖는 관계 기억. (A,B)와 (B,A)는 별개 row.';
```

- [ ] **Step 2: Supabase Cloud에 마이그레이션 적용**

Run: `npx supabase db push --linked`
Expected: 마이그레이션 성공, `clone_relationships` 테이블 생성 확인

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260412000005_clone_relationships.sql
git commit -m "feat(db): add clone_relationships table with RLS"
```

---

## Task 2: 타입 + 검증 스키마 + Config 상수

**Files:**
- Create: `src/types/relationship.ts`
- Create: `src/lib/validation/relationship.ts`
- Modify: `src/lib/config/interaction.ts`
- Modify: `src/lib/config/claude.ts`

- [ ] **Step 1: 관계 기억 타입 정의**

```ts
// src/types/relationship.ts

export interface RelationshipMemoryItem {
  topic: string
  detail: string
  occurred_at: string  // ISO date
}

export interface CloneRelationship {
  id: string
  clone_id: string
  target_clone_id: string
  interaction_count: number
  summary: string
  memories: RelationshipMemoryItem[]
  created_at: string
  updated_at: string
}

export interface ExtractedRelationshipMemory {
  summary: string
  new_memories: RelationshipMemoryItem[]
}
```

- [ ] **Step 2: 추출 결과 Zod 스키마**

```ts
// src/lib/validation/relationship.ts
import { z } from 'zod'

export const relationshipMemoryItemSchema = z.object({
  topic: z.string().min(1),
  detail: z.string().min(1),
  occurred_at: z.string().min(1),
})

export const extractedRelationshipMemorySchema = z.object({
  summary: z.string().min(1),
  new_memories: z.array(relationshipMemoryItemSchema).min(1),
})

export type ValidatedRelationshipMemory = z.infer<typeof extractedRelationshipMemorySchema>
```

- [ ] **Step 3: Config 상수 추가**

`src/lib/config/interaction.ts`의 `INTERACTION_DEFAULTS`에 추가:
```ts
  RELATIONSHIP_MEMORY_INJECTION_LIMIT: 20,
```

`src/lib/config/claude.ts`의 `CLAUDE_MODELS`에 추가:
```ts
  RELATIONSHIP: 'claude-haiku-4-5-20251001',
```

`CLAUDE_LIMITS`에 추가:
```ts
  MAX_OUTPUT_TOKENS_RELATIONSHIP: 512,
```

- [ ] **Step 4: 커밋**

```bash
git add src/types/relationship.ts src/lib/validation/relationship.ts src/lib/config/interaction.ts src/lib/config/claude.ts
git commit -m "feat: add relationship memory types, validation, and config"
```

---

## Task 3: 관계 기억 추출 프롬프트

**Files:**
- Create: `src/lib/prompts/relationship.ts`

- [ ] **Step 1: 프롬프트 템플릿 작성**

```ts
// src/lib/prompts/relationship.ts
import type { Persona } from '@/types/persona'

export interface RelationshipExtractionInput {
  conversationLog: string
  selfName: string
  selfPersona: Persona
  partnerName: string
  previousSummary: string | null
  previousMemories: { topic: string; detail: string }[]
}

export function buildRelationshipExtractionPrompt(input: RelationshipExtractionInput): string {
  const {
    conversationLog,
    selfName,
    selfPersona,
    partnerName,
    previousSummary,
    previousMemories,
  } = input

  const personaContext = [
    selfPersona.personality_traits?.length ? `성격: ${selfPersona.personality_traits.join(', ')}` : '',
    selfPersona.core_values?.length ? `가치관: ${selfPersona.core_values.join(', ')}` : '',
    selfPersona.dealbreakers?.length ? `거부선: ${selfPersona.dealbreakers.join(', ')}` : '',
    selfPersona.hobbies?.length ? `취미: ${selfPersona.hobbies.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const previousPart = previousSummary
    ? `<previous_relationship>
이전 요약: ${previousSummary}
이전 기억:
${previousMemories.map((m) => `- ${m.topic}: ${m.detail}`).join('\n')}
</previous_relationship>`
    : ''

  return `당신은 ${selfName}의 내면을 분석하는 심리학자입니다.
아래 대화를 읽고, ${selfName}의 관점에서 ${partnerName}에 대한 관계 기억을 추출하세요.

<${selfName}_personality>
${personaContext}
</${selfName}_personality>

${previousPart}

<conversation>
${conversationLog}
</conversation>

JSON으로만 응답하세요. 다른 설명 금지.

{
  "summary": "<${partnerName}에 대한 1-2문장 종합 인상. 이전 요약이 있으면 통합해서 갱신>",
  "new_memories": [
    {
      "topic": "<주제 키워드>",
      "detail": "<구체적 사실 또는 인상, 1문장>",
      "occurred_at": "<YYYY-MM-DD>"
    }
  ]
}

핵심 원칙 — 반드시 지킬 것:

1. **솔직한 내면 평가**: 겉으로 공감했더라도 ${selfName}의 성격/가치관 기준으로 실제로 흥미 있었는지, 어색했는지, 지루했는지 판단하세요.
2. **온도 차이 인식**: 한쪽이 열정적이고 다른 쪽이 미지근했으면 그걸 기록하세요.
3. **비호감 요소도 기록**: "말을 끊는 편", "관심사가 안 맞았다", "대화가 피상적" 같은 부정적 인상도 반드시 포함하세요.
4. **페르소나 기반 판단**: ${selfName}의 성격 특성, 가치관, 거부선에 비추어 상대를 어떻게 느꼈을지 추론하세요.
5. **AI스러운 추출 금지**:
   - X "다양한 주제로 대화를 나눔" → O "영화 얘기는 통했는데 운동 쪽은 관심 없는 듯"
   - X "즐거운 대화였음" → O "초반은 어색했고 중반부터 좀 풀림"
   - X "상대의 취미에 관심을 보임" → O "등산 얘기를 길게 했는데 솔직히 별로"

new_memories는 이번 대화에서 새로 알게 된 사실/인상만. 이전 기억과 중복되면 생략.`
}

export function buildResummarizationPrompt(
  previousSummary: string,
  newSummary: string,
  interactionCount: number,
): string {
  return `이전 관계 요약: "${previousSummary}"
이번 대화 후 요약: "${newSummary}"
총 대화 횟수: ${interactionCount}회

두 요약을 통합해서 1-2문장으로 갱신하세요. 변화가 있으면 반영하고, 핵심만 남기세요.
JSON으로 응답: {"summary": "<통합 요약>"}`
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/prompts/relationship.ts
git commit -m "feat: add relationship memory extraction prompt with honest-evaluation principles"
```

---

## Task 4: 추출 결과 파싱 순수 함수 (TDD)

**Files:**
- Create: `src/lib/relationship/extract.ts`
- Create: `src/lib/relationship/extract.test.ts`

- [ ] **Step 1: 파싱 테스트 작성**

```ts
// src/lib/relationship/extract.test.ts
import { describe, it, expect } from 'vitest'
import { parseRelationshipExtraction } from './extract'

describe('parseRelationshipExtraction', () => {
  it('유효한 추출 결과를 파싱한다', () => {
    const raw = {
      summary: '영화 취향 비슷하고 유머 코드 맞음. 운동 쪽은 관심 없는 듯',
      new_memories: [
        { topic: '영화', detail: '호러 영화 좋아함, 조던 필 팬', occurred_at: '2026-04-12' },
        { topic: '직장', detail: '최근 이직 고민 중이라고 함', occurred_at: '2026-04-12' },
      ],
    }
    const result = parseRelationshipExtraction(raw)
    expect(result.summary).toBe('영화 취향 비슷하고 유머 코드 맞음. 운동 쪽은 관심 없는 듯')
    expect(result.new_memories).toHaveLength(2)
    expect(result.new_memories[0].topic).toBe('영화')
  })

  it('summary가 없으면 에러', () => {
    expect(() => parseRelationshipExtraction({ new_memories: [] })).toThrow()
  })

  it('new_memories가 빈 배열이면 에러', () => {
    expect(() =>
      parseRelationshipExtraction({ summary: 'test', new_memories: [] })
    ).toThrow()
  })

  it('new_memories 항목에 필수 필드 누락 시 해당 항목 필터링', () => {
    const raw = {
      summary: 'test',
      new_memories: [
        { topic: '영화', detail: '좋아함', occurred_at: '2026-04-12' },
        { topic: '', detail: '빈 토픽', occurred_at: '2026-04-12' },  // topic 비어있음
        { detail: '토픽 없음', occurred_at: '2026-04-12' },  // topic 자체 없음
      ],
    }
    const result = parseRelationshipExtraction(raw)
    expect(result.new_memories).toHaveLength(1)
    expect(result.new_memories[0].topic).toBe('영화')
  })

  it('new_memories 전부 유효하지 않으면 에러', () => {
    expect(() =>
      parseRelationshipExtraction({
        summary: 'test',
        new_memories: [{ topic: '', detail: '', occurred_at: '' }],
      })
    ).toThrow()
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run src/lib/relationship/extract.test.ts`
Expected: FAIL — `parseRelationshipExtraction` 없음

- [ ] **Step 3: 파싱 함수 구현**

```ts
// src/lib/relationship/extract.ts
import { errors } from '@/lib/errors'
import type { ExtractedRelationshipMemory, RelationshipMemoryItem } from '@/types/relationship'

export function parseRelationshipExtraction(raw: unknown): ExtractedRelationshipMemory {
  if (typeof raw !== 'object' || raw === null) {
    throw errors.validation('관계 기억 추출 결과가 객체가 아닙니다')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.summary !== 'string' || obj.summary.length === 0) {
    throw errors.validation('summary 필드가 없거나 비어있습니다')
  }

  if (!Array.isArray(obj.new_memories)) {
    throw errors.validation('new_memories 필드가 배열이 아닙니다')
  }

  const validMemories: RelationshipMemoryItem[] = obj.new_memories
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null
    )
    .filter((item) =>
      typeof item.topic === 'string' && item.topic.length > 0 &&
      typeof item.detail === 'string' && item.detail.length > 0 &&
      typeof item.occurred_at === 'string' && item.occurred_at.length > 0
    )
    .map((item) => ({
      topic: item.topic as string,
      detail: item.detail as string,
      occurred_at: item.occurred_at as string,
    }))

  if (validMemories.length === 0) {
    throw errors.validation('유효한 new_memories가 없습니다')
  }

  return {
    summary: obj.summary,
    new_memories: validMemories,
  }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run src/lib/relationship/extract.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/relationship/extract.ts src/lib/relationship/extract.test.ts
git commit -m "feat: add relationship memory extraction parser with tests"
```

---

## Task 5: 관계 기억 추출 + UPSERT 서비스

**Files:**
- Create: `src/lib/relationship/service.ts`

- [ ] **Step 1: 서비스 작성**

```ts
// src/lib/relationship/service.ts
import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/config/claude'
import {
  buildRelationshipExtractionPrompt,
  buildResummarizationPrompt,
  type RelationshipExtractionInput,
} from '@/lib/prompts/relationship'
import { parseRelationshipExtraction } from './extract'
import { createServiceClient } from '@/lib/supabase/service'
import { AppError } from '@/lib/errors'
import type { Persona } from '@/types/persona'
import type { CloneRelationship, RelationshipMemoryItem } from '@/types/relationship'
import type { InteractionEvent } from '@/types/interaction'

function buildConversationLog(events: InteractionEvent[], cloneNames: Map<string, string>): string {
  return events
    .map((e) => `${cloneNames.get(e.speaker_clone_id) ?? '?'}: ${e.content}`)
    .join('\n')
}

function parseJsonResponse(response: string): unknown {
  const jsonStart = response.indexOf('{')
  const jsonEnd = response.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < 0) {
    throw new Error('JSON 객체를 찾을 수 없음')
  }
  return JSON.parse(response.slice(jsonStart, jsonEnd + 1))
}

async function extractForOneClone(
  selfCloneId: string,
  selfName: string,
  selfPersona: Persona,
  targetCloneId: string,
  targetName: string,
  conversationLog: string,
  existing: CloneRelationship | null,
): Promise<void> {
  const input: RelationshipExtractionInput = {
    conversationLog,
    selfName,
    selfPersona,
    partnerName: targetName,
    previousSummary: existing?.summary ?? null,
    previousMemories: existing?.memories ?? [],
  }

  const prompt = buildRelationshipExtractionPrompt(input)

  const response = await callClaude({
    model: CLAUDE_MODELS.RELATIONSHIP,
    system: '당신은 대화 참여자의 내면을 분석하는 심리학자입니다. JSON으로만 응답하세요.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_RELATIONSHIP,
    temperature: 0.3,
  })

  let parsed: unknown
  try {
    parsed = parseJsonResponse(response)
  } catch (err) {
    throw new AppError(
      'LLM_ERROR',
      `관계 기억 추출 파싱 실패: ${(err as Error).message}`,
      502,
      { raw: response }
    )
  }

  const extracted = parseRelationshipExtraction(parsed)

  const admin = createServiceClient()

  if (existing) {
    // 기존 row: summary 재요약 + memories append
    let finalSummary = extracted.summary

    // 이전 summary가 있고, 추출된 summary가 이전과 다르면 통합 재요약
    if (existing.summary && existing.summary !== extracted.summary) {
      const newCount = existing.interaction_count + 1
      const resummarizeResponse = await callClaude({
        model: CLAUDE_MODELS.RELATIONSHIP,
        system: 'JSON으로만 응답하세요.',
        messages: [{ role: 'user', content: buildResummarizationPrompt(
          existing.summary,
          extracted.summary,
          newCount,
        )}],
        maxTokens: 256,
        temperature: 0.2,
      })
      try {
        const resumParsed = parseJsonResponse(resummarizeResponse) as { summary?: string }
        if (typeof resumParsed.summary === 'string' && resumParsed.summary.length > 0) {
          finalSummary = resumParsed.summary
        }
      } catch {
        // 재요약 실패 시 새 summary 그대로 사용
      }
    }

    const mergedMemories: RelationshipMemoryItem[] = [
      ...existing.memories,
      ...extracted.new_memories,
    ]

    const { error } = await admin
      .from('clone_relationships')
      .update({
        summary: finalSummary,
        memories: mergedMemories,
        interaction_count: existing.interaction_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      console.error(`[relationship] update failed for ${selfCloneId} → ${targetCloneId}:`, error.message)
    }
  } else {
    // 신규 row
    const { error } = await admin
      .from('clone_relationships')
      .insert({
        clone_id: selfCloneId,
        target_clone_id: targetCloneId,
        interaction_count: 1,
        summary: extracted.summary,
        memories: extracted.new_memories,
      })

    if (error) {
      console.error(`[relationship] insert failed for ${selfCloneId} → ${targetCloneId}:`, error.message)
    }
  }
}

/**
 * Interaction 종료 후 양방향 관계 기억 추출.
 * 두 Clone 각각의 관점에서 병렬로 추출한다.
 */
export async function extractRelationshipMemories(
  events: InteractionEvent[],
  participants: { id: string; name: string; persona_json: Persona }[],
): Promise<void> {
  if (participants.length !== 2 || events.length === 0) return

  const [cloneA, cloneB] = participants
  const cloneNames = new Map<string, string>([
    [cloneA.id, cloneA.name],
    [cloneB.id, cloneB.name],
  ])
  const conversationLog = buildConversationLog(events, cloneNames)

  // 기존 관계 조회
  const admin = createServiceClient()
  const { data: existingRows } = await admin
    .from('clone_relationships')
    .select('*')
    .or(`and(clone_id.eq.${cloneA.id},target_clone_id.eq.${cloneB.id}),and(clone_id.eq.${cloneB.id},target_clone_id.eq.${cloneA.id})`)

  const existingMap = new Map<string, CloneRelationship>()
  for (const row of (existingRows ?? []) as CloneRelationship[]) {
    existingMap.set(`${row.clone_id}→${row.target_clone_id}`, row)
  }

  // 양방향 병렬 추출
  await Promise.allSettled([
    extractForOneClone(
      cloneA.id, cloneA.name, cloneA.persona_json,
      cloneB.id, cloneB.name,
      conversationLog,
      existingMap.get(`${cloneA.id}→${cloneB.id}`) ?? null,
    ),
    extractForOneClone(
      cloneB.id, cloneB.name, cloneB.persona_json,
      cloneA.id, cloneA.name,
      conversationLog,
      existingMap.get(`${cloneB.id}→${cloneA.id}`) ?? null,
    ),
  ])
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/relationship/service.ts
git commit -m "feat: add relationship memory extraction and UPSERT service"
```

---

## Task 6: System Prompt 주입 — `renderRelationshipMemory` (TDD)

**Files:**
- Create: `src/lib/prompts/persona.relationship.test.ts`
- Modify: `src/lib/prompts/persona.ts`
- Modify: `src/lib/interaction/orchestrate.ts`

- [ ] **Step 1: 렌더링 테스트 작성 (실패 확인)**

```ts
// src/lib/prompts/persona.relationship.test.ts
import { describe, it, expect } from 'vitest'
import { renderRelationshipMemory } from './persona'
import type { CloneRelationship } from '@/types/relationship'

describe('renderRelationshipMemory', () => {
  it('관계 기억을 렌더링한다', () => {
    const rel: CloneRelationship = {
      id: '1',
      clone_id: 'a',
      target_clone_id: 'b',
      interaction_count: 2,
      summary: '영화 취향 비슷하고 유머 코드 맞음',
      memories: [
        { topic: '영화', detail: '호러 영화 좋아함', occurred_at: '2026-04-10' },
        { topic: '직장', detail: '이직 고민 중', occurred_at: '2026-04-12' },
      ],
      created_at: '2026-04-10',
      updated_at: '2026-04-12',
    }
    const result = renderRelationshipMemory(rel, '민지')
    expect(result).toContain('민지')
    expect(result).toContain('2회')
    expect(result).toContain('영화 취향 비슷하고 유머 코드 맞음')
    expect(result).toContain('호러 영화 좋아함')
    expect(result).toContain('이직 고민 중')
  })

  it('null이면 빈 문자열', () => {
    expect(renderRelationshipMemory(null, '민지')).toBe('')
  })

  it('memories가 limit 이상이면 최근 것만', () => {
    const memories = Array.from({ length: 25 }, (_, i) => ({
      topic: `topic${i}`,
      detail: `detail${i}`,
      occurred_at: `2026-04-${String(i + 1).padStart(2, '0')}`,
    }))
    const rel: CloneRelationship = {
      id: '1',
      clone_id: 'a',
      target_clone_id: 'b',
      interaction_count: 5,
      summary: 'test',
      memories,
      created_at: '2026-04-01',
      updated_at: '2026-04-25',
    }
    const result = renderRelationshipMemory(rel, '민지', 20)
    // 최근 20개만 포함되어야 함 (occurred_at 역순)
    expect(result).toContain('topic24')
    expect(result).not.toContain('topic0')
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run src/lib/prompts/persona.relationship.test.ts`
Expected: FAIL — `renderRelationshipMemory` 없음

- [ ] **Step 3: `renderRelationshipMemory` 구현 + `EnhancedPromptInput` 확장**

`src/lib/prompts/persona.ts`에 추가:

import 추가:
```ts
import type { CloneRelationship } from '@/types/relationship'
```

import 추가 (config):
```ts
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
```
(이미 import 되어있으면 생략)

함수 추가 (`renderInferredTraits` 다음, 또는 Phase 2-A가 없으면 `renderRecentMemories` 다음):
```ts
export function renderRelationshipMemory(
  relationship: CloneRelationship | null,
  partnerName: string,
  limit: number = INTERACTION_DEFAULTS.RELATIONSHIP_MEMORY_INJECTION_LIMIT,
): string {
  if (!relationship) return ''

  const lines = [
    `[이전 대화 기억 — 상대: ${partnerName}]`,
    `대화 ${relationship.interaction_count}회. ${relationship.summary}`,
  ]

  const sorted = [...relationship.memories].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  )
  const picked = sorted.slice(0, limit)

  for (const m of picked) {
    lines.push(`- ${m.detail} (${m.occurred_at})`)
  }

  return lines.join('\n')
}
```

`EnhancedPromptInput` 인터페이스에 필드 추가:
```ts
  relationshipMemory?: { relationship: CloneRelationship; partnerName: string } | null
```

`buildEnhancedSystemPrompt` 함수 내부, inferred traits 주입 다음에 추가 (또는 persona core 다음에):
```ts
  // 4. Relationship memory
  if (input.relationshipMemory) {
    const rendered = renderRelationshipMemory(
      input.relationshipMemory.relationship,
      input.relationshipMemory.partnerName,
    )
    if (rendered) parts.push(rendered)
  }
```

(기존 주석 번호를 적절히 밀기)

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run src/lib/prompts/persona.relationship.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/prompts/persona.ts src/lib/prompts/persona.relationship.test.ts
git commit -m "feat: add renderRelationshipMemory and inject into system prompt"
```

---

## Task 7: Orchestrate + Run Route 통합

**Files:**
- Modify: `src/lib/interaction/orchestrate.ts`
- Modify: `src/app/api/interactions/[id]/run/route.ts`

- [ ] **Step 1: `orchestrate.ts`에서 관계 기억 조회 + 주입**

`src/lib/interaction/orchestrate.ts`의 `prepareClonePrompts` 함수 수정:

함수 시그니처는 유지. 내부에서 관계 기억을 조회하여 `buildEnhancedSystemPrompt`에 전달.

import 추가:
```ts
import type { CloneRelationship } from '@/types/relationship'
```

`prepareClonePrompts` 내부, mood roll 전에 관계 기억 조회 추가:

```ts
  // 0. Load relationship memories (shared lookup)
  const relationshipMap = new Map<string, CloneRelationship>()
  if (participants.length === 2) {
    const [a, b] = participants
    const { data: relRows } = admin
      ? await createServiceClient()
          .from('clone_relationships')
          .select('*')
          .or(`and(clone_id.eq.${a.id},target_clone_id.eq.${b.id}),and(clone_id.eq.${b.id},target_clone_id.eq.${a.id})`)
      : { data: [] }
    for (const row of (relRows ?? []) as CloneRelationship[]) {
      relationshipMap.set(`${row.clone_id}→${row.target_clone_id}`, row)
    }
  }
```

실제로는 `admin`을 이미 for loop 내에서 안 쓰고 있으므로 top-level에서 service client 생성:
```ts
  const adminForRel = createServiceClient()
  // ... 관계 기억 조회
```

`buildEnhancedSystemPrompt` 호출 시 관계 기억 전달:
```ts
    // 이 Clone에서 상대 Clone으로의 관계 기억 조회
    const otherClone = participants.find((p) => p.id !== clone.id)
    const relKey = otherClone ? `${clone.id}→${otherClone.id}` : null
    const relationship = relKey ? relationshipMap.get(relKey) ?? null : null

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

- [ ] **Step 2: `run/route.ts`에서 Interaction 종료 후 관계 기억 추출 트리거**

`src/app/api/interactions/[id]/run/route.ts` 수정:

import 추가:
```ts
import { extractRelationshipMemories } from '@/lib/relationship/service'
```

Interaction 종료 후 (`await admin.from('interactions').update(...)` 다음에) 추가:

```ts
    // 관계 기억 추출 (성공/실패와 무관하게 best-effort)
    if (result.status === 'completed') {
      const { data: events } = await admin
        .from('interaction_events')
        .select('*')
        .eq('interaction_id', id)
        .order('turn_number', { ascending: true })

      if (events && events.length > 0) {
        // fire-and-forget: 실패해도 응답에 영향 없음
        extractRelationshipMemories(
          events as import('@/types/interaction').InteractionEvent[],
          participants.map((p) => ({
            id: p.id,
            name: p.name,
            persona_json: p.persona_json,
          })),
        ).catch((err) => {
          console.error('[relationship] extraction failed (non-blocking):', err)
        })
      }
    }
```

이 추출은 fire-and-forget으로 실행. Interaction 응답은 바로 반환하고, 관계 기억 추출은 비동기로 처리. 실패해도 유저 경험에 영향 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/interaction/orchestrate.ts src/app/api/interactions/[id]/run/route.ts
git commit -m "feat: integrate relationship memory into orchestrate + post-interaction extraction"
```

---

## Task 8: 전체 통합 테스트 + 정리

- [ ] **Step 1: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: 기존 + 신규 테스트 모두 PASS

- [ ] **Step 2: 타입 체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 수동 E2E 검증**

Dev 서버에서:
1. Clone A와 Clone B 사이에 Interaction 실행
2. 완료 후 `clone_relationships` 테이블 확인 → 2개 row (A→B, B→A) 생성 확인
3. summary와 memories가 사람스러운 평가인지 확인 (AI스러운 긍정 표현 없는지)
4. 같은 Clone 쌍으로 두 번째 Interaction 실행
5. `clone_relationships` 확인 → `interaction_count` 2, memories append, summary 재요약 확인
6. 두 번째 Interaction의 대화에서 이전 대화 기억이 반영되었는지 확인 (예: "저번에 얘기했던...")

- [ ] **Step 4: PROJECT_STATE.md 업데이트 + 커밋**

```bash
git add docs/PROJECT_STATE.md
git commit -m "docs: update PROJECT_STATE for Phase 2-B relationship memory"
```

- [ ] **Step 5: 참조 문서 업데이트**

`docs/reference/clone-data-fields.md`의 Phase 3+ 필드들이 실제 구현과 일치하는지 확인. 필요 시 업데이트.

```bash
git add docs/reference/clone-data-fields.md
git commit -m "docs: update clone data fields reference"
```
