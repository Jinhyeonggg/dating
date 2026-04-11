# Phase 1 Design — Digital Clone Platform

**Date**: 2026-04-11
**Scope**: 1:1 Clone 대화 프로토타입 (페르소나 입력 → Clone 생성 → Interaction 실행 → 호환성 분석 → 에피소드 메모리 업데이트)
**Status**: Approved for implementation

## 목적과 배경

사용자의 디지털 클론(AI 페르소나)과 다양한 상대 간의 온라인 대화 상호작용을 시뮬레이션해, 대화 스타일·취미·가치관 궁합을 사전 검증하는 플랫폼의 **프로토타입 코어**.

Phase 1의 목적은 "로직이 맞는지" 검증: role 재매핑, 페르소나 주입, 프롬프트 품질, 분석 결과의 타당성. 자동 배치·n-to-n 확장은 Phase 2 이후.

프로젝트 전반의 비전·용어·코딩 규칙은 `/CLAUDE.md` 참조. 상세 도메인 가이드는 `.claude/skills/persona/`, `.claude/skills/interaction/`, `.claude/skills/db-schema/` 참조.

## 핵심 결정 요약

| 항목 | 선택 | 이유 |
|---|---|---|
| 사용자 모델 | Supabase Auth 켜두되 한 계정이 본인 Clone + NPC Clone과 Interaction | 나중 auth 끼워넣기 부담 제거 + 매칭 UX Phase 2로 미룸 |
| NPC | 시스템 제공 5개 seed (`is_npc=true`) | 사용자가 Clone 하나만 만들어도 다양한 상대와 실험 가능 |
| 페르소나 폼 | 빠른 생성(핵심 필드) + 상세 편집(전체 카테고리), `PersonaSection` 재사용 | 입력 속도 + 스키마 완전성 |
| Interaction UX | Supabase Realtime으로 턴별 이벤트 구독 | 실시간 느낌 + 재접속 복구 + n-to-n 확장 시 동일 패턴 |
| Interaction 실행 | 단일 동기 API Route (20턴 inline 실행) | 300s 한도 내 여유, 구현 단순, Realtime과 자연 결합 |
| 분석 트리거 | 수동 "분석 보기" 버튼 | 비용 제어 + 재시도 단순 |
| 메모리 UI | Clone 상세 페이지 내 입력 + 타임라인 | Phase 1 규모에 맞는 단순한 UX |
| UI 프리미티브 | shadcn/ui | 재사용성 규칙과 일치, 접근성 내장 |
| 테스트 | 핵심 순수 함수만 Vitest, UI/DB는 수동 | 프로토타입 속도와 품질의 균형 |
| 배치 실행 + 랭킹 | **Phase 2로** | Phase 1은 단일 Interaction 로직 검증이 우선 |

---

## §1. 아키텍처 개요

```
Browser (Next.js 클라이언트)
  - 페르소나 폼, Clone 목록, Interaction 뷰어
  - Supabase Realtime 구독 (interaction_events 자동 수신)
         │                         │
   (HTTP POST)              (WebSocket subscribe)
         │                         │
Next.js App Router (Vercel Fluid Compute)
  ├── app/api/clones/         → Clone CRUD
  ├── app/api/interactions/   → 세션 생성/실행/조회
  ├── app/api/memories/       → 자연어 → 메모리 추출·저장
  └── app/api/analyses/       → 호환성 분석 생성

  lib/
  ├── interaction/engine.ts   → 20턴 루프 (§5 순수 함수)
  ├── prompts/                → 프롬프트 템플릿 함수
  ├── claude.ts               → Anthropic SDK 래퍼
  ├── supabase/               → 서버·클라이언트 분리
  └── config/                 → 상수
         │                         │
  (Anthropic API)          (Supabase Postgres)
         │                         │
  Claude API               Supabase
  - sonnet: 대화/분석       - Auth (이메일 매직링크)
  - haiku: 메모리 추출      - DB + RLS
                            - Realtime publish
```

### 사용자 흐름
1. 로그인 → Supabase Auth (이메일 매직링크)
2. Clone 1개 이상 생성 → 빠른 폼 → system prompt 자동 빌드·캐시
3. (선택) 상세 편집 → 카테고리별 섹션 채움
4. Interaction 시작 → "내 Clone × NPC(또는 다른 내 Clone)" 페어 선택 → 뷰어 페이지로 이동
5. 뷰어가 Realtime 구독 → 서버가 20턴 실행하며 INSERT → 화면에 자동 표시
6. 대화 완료 후 "분석 보기" 클릭 → 호환성 리포트 생성·표시
7. Clone 상세에서 "오늘의 업데이트" 입력 → 메모리 타임라인에 추가

### 설계 원칙
- 코어 로직은 순수 함수 (role 재매핑, prompt 빌드, 메모리 파싱) → 테스트 용이
- API Route는 얇게 (파싱·인증·`lib/` 호출·응답만)
- 모든 상수는 `lib/config/` (하드코딩 금지)
- `components/ui/`는 shadcn/ui, 도메인 컴포넌트는 조합만
- RLS는 초기부터 켜둠 (Phase 2에서 붙이면 아픔)

---

## §2. 데이터 모델

전체 스키마 레퍼런스는 `.claude/skills/db-schema/SKILL.md` 참조. 여기서는 Phase 1에서 즉시 필요한 테이블과 NPC 처리 방식만 정리.

### 테이블 요약
- `profiles` — Supabase Auth 확장 (display_name)
- `clones` — 내 Clone + NPC Clone 통합, `is_npc` 플래그로 구분
- `clone_memories` — 에피소드 메모리 (자연어 업데이트 결과)
- `interactions` — 대화 세션 (status + metadata)
- `interaction_participants` — 누가 참여했는지 (n-to-n 대비 조인 테이블)
- `interaction_events` — 개별 턴 (Realtime publish)
- `analyses` — 호환성 분석 리포트

### NPC 처리
`clones` 테이블의 확장 컬럼:
```sql
is_npc       boolean not null default false
user_id      uuid references auth.users(id)  -- NPC는 null 허용
```

**NPC RLS**: `is_npc = true` 행은 모든 인증 사용자가 SELECT 가능, 쓰기는 service role key로만. `is_npc = false` 행은 `user_id = auth.uid()` 소유자만.

### 마이그레이션 파일 (순서대로)
```
frontend/supabase/migrations/
├── 20260411000001_init_profiles.sql
├── 20260411000002_init_clones.sql          -- is_npc 컬럼 포함
├── 20260411000003_init_clone_memories.sql
├── 20260411000004_init_interactions.sql    -- interactions + participants + events
├── 20260411000005_init_analyses.sql
├── 20260411000006_enable_rls.sql           -- 모든 테이블 RLS 정책
└── 20260411000007_enable_realtime.sql      -- interaction_events publication

frontend/supabase/seed.sql                   -- NPC 5개 INSERT (is_npc=true, user_id=null)
```

### NPC seed 구성 (5개, 대화·가치관 스펙트럼)
| 이름 | 나이 | 직업 | 핵심 특징 |
|---|---|---|---|
| 지민 | 28 | 프로덕트 디자이너 | INFJ, 깊은 대화, 드라이한 유머, 진정성 |
| 태현 | 32 | 스타트업 창업자 | ENTJ, 직설, 성장 지향, 효율주의 |
| 서연 | 26 | 프리랜서 일러스트레이터 | ENFP, 즉흥, 감정 풍부, 예술·여행 |
| 민재 | 30 | 의대 레지던트 | ISTJ, 책임감, 안정, 가족 중심 |
| 하린 | 29 | 환경 NGO 활동가 | INFP, 이상주의, 가치관 강함, 예민 |

각 NPC의 `persona_json`은 Persona 인터페이스 전체 필드를 풍부하게 채워 seed로 주입. 나중에 페르소나 완성도 "정답 예시"로도 활용.

### RLS 정책 요약
| 테이블 | SELECT | 쓰기 |
|---|---|---|
| clones (is_npc=true) | 모든 인증 사용자 | service role only |
| clones (is_npc=false) | 소유자 | 소유자 |
| clone_memories | 소유 Clone만 | 소유 Clone만 |
| interactions | 참여 Clone의 소유자 | 생성자 |
| interaction_participants | 참여 Clone의 소유자 | 생성자 |
| interaction_events | 참여 Interaction만 | service role only |
| analyses | 참여 Interaction만 | service role only |

---

## §3. API Routes

모든 라우트는 Next.js App Router, 파일 위치 `frontend/src/app/api/*/route.ts`. 얇은 레이어로 유지 (파싱·인증·`lib/` 호출·응답).

### 라우트 목록
| 메서드 + 경로 | 용도 | 응답 |
|---|---|---|
| `GET /api/clones` | 내 Clone + NPC 목록 | `{ mine: Clone[], npcs: Clone[] }` |
| `POST /api/clones` | 내 Clone 생성 | `{ clone: Clone }` |
| `GET /api/clones/[id]` | 단일 Clone + 최근 메모리 | `{ clone, memories }` |
| `PATCH /api/clones/[id]` | 페르소나 부분 업데이트 | `{ clone }` |
| `DELETE /api/clones/[id]` | Soft delete | `{ ok: true }` |
| `POST /api/interactions` | 새 Interaction 생성 + 실행 | `{ interaction }` |
| `GET /api/interactions/[id]` | 세션 + events 조회 | `{ interaction, events }` |
| `POST /api/memories` | 자연어 → 메모리 추출·저장 | `{ memory }` |
| `POST /api/analyses` | 호환성 분석 생성 | `{ analysis }` |
| `GET /api/analyses/[id]` | 분석 조회 | `{ analysis }` |

### 주요 라우트 로직

**`POST /api/clones`**
1. `auth.uid()` 확인 (미인증 → 401)
2. Zod로 `persona` 검증, 최소 `name` 필수
3. `buildSystemPrompt(persona)` 호출 → `system_prompt` 생성
4. `clones` INSERT `{ user_id, persona_json, system_prompt, is_npc: false }`

**`POST /api/interactions`**
1. 인증 + 참여 Clone 조회 (최소 1개는 `user_id === auth.uid()`)
2. `interactions` INSERT (status='pending')
3. `interaction_participants` 2건 INSERT
4. `status='running'`, `started_at=now()` UPDATE
5. `runInteraction()` 호출 — 20턴 동기 루프, 각 턴 `interaction_events` INSERT (Realtime publish)
6. 성공 → `status='completed'`, 실패 → `'failed'`
7. 완료된 Interaction 반환 (300s 내)

**`POST /api/memories`**
1. 인증 + Clone 소유 확인
2. haiku 추출 호출 → `{ kind, content, tags, occurred_at }`
3. `parseMemoryExtraction()` 검증
4. `clone_memories` INSERT

**`POST /api/analyses`**
1. 인증 + Interaction 참여 확인
2. 기존 analysis 있으면 반환 (캐시)
3. events 전체 + personas 요약 → sonnet 분석 호출
4. `parseAnalysisReport()` 검증
5. `analyses` INSERT

### 공통 에러 응답
```ts
{
  error: {
    code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'VALIDATION' | 'LLM_ERROR' | 'INTERNAL' | 'FORBIDDEN'
    message: string
    details?: unknown
  }
}
```

### 인증 & Supabase 클라이언트
- 브라우저 → API Route: Supabase Auth 쿠키 (`@supabase/ssr`)
- API Route → Supabase:
  - 사용자 컨텍스트 읽기: anon key + RLS
  - 서버 쓰기 (`interaction_events`, `analyses`): service role key (RLS 우회)
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 환경변수만, 클라이언트 노출 금지

---

## §4. Frontend 구조

### App Router 페이지
```
frontend/src/app/
├── layout.tsx                    -- 루트, AuthProvider
├── page.tsx                      -- 랜딩 (로그인 or /clones 리다이렉트)
├── login/page.tsx                -- 매직링크
├── auth/callback/route.ts        -- OAuth 콜백
├── clones/
│   ├── page.tsx                  -- 내 Clone + NPC 목록
│   ├── new/page.tsx              -- 빠른 생성 폼
│   └── [id]/
│       ├── page.tsx              -- 상세 + 메모리 타임라인
│       └── edit/page.tsx         -- 전체 카테고리 상세 편집
├── interactions/
│   ├── page.tsx                  -- 과거 목록
│   ├── new/page.tsx              -- 페어 선택 + 시작
│   └── [id]/page.tsx             -- 대화 뷰어 (Realtime 구독)
└── analyses/[id]/page.tsx        -- 호환성 리포트
```

**Server Components 기본** (목록·상세 초기 로드). **Client Components**: 폼, Realtime 구독 뷰어.

### 컴포넌트 레이어
```
frontend/src/components/
├── ui/                           -- shadcn/ui 프리미티브
│   └── (button, input, textarea, card, badge, select, tabs, dialog, avatar, form, label, skeleton, toast, ...)
├── persona/
│   ├── PersonaQuickForm.tsx      -- 빠른 생성 (핵심 10-15 필드)
│   ├── PersonaFullEditor.tsx     -- 카테고리 탭 기반 상세 편집
│   ├── PersonaSection.tsx        -- 카테고리 단위 재사용
│   ├── PersonaFieldArray.tsx     -- 배열 필드 공통
│   ├── PersonaSummaryCard.tsx
│   └── sections/                 -- 카테고리별 필드 렌더러
│       ├── IdentitySection.tsx
│       ├── PersonalitySection.tsx
│       ├── ValuesSection.tsx
│       ├── InterestsSection.tsx
│       ├── HistorySection.tsx
│       ├── RelationshipsSection.tsx
│       ├── LifestyleSection.tsx
│       ├── CommunicationSection.tsx
│       ├── GoalsSection.tsx
│       └── SelfSection.tsx
├── clone/
│   ├── CloneList.tsx             -- 내 Clone / NPC 섹션 분리
│   ├── CloneCard.tsx
│   ├── CloneNpcBadge.tsx
│   └── MemoryTimeline.tsx
├── interaction/
│   ├── InteractionPairPicker.tsx
│   ├── ScenarioPicker.tsx
│   ├── InteractionViewer.tsx     -- Realtime 구독
│   ├── MessageBubble.tsx
│   ├── TypingIndicator.tsx
│   └── InteractionStatusBadge.tsx
├── memory/
│   ├── MemoryInputBox.tsx
│   └── MemoryItem.tsx
└── analysis/
    ├── AnalysisGenerateButton.tsx
    ├── AnalysisReport.tsx
    ├── ScoreBar.tsx
    └── CategoryCard.tsx
```

**재사용 원칙**: `PersonaSection` + `sections/*` 를 빠른 폼과 상세 편집에서 공유. 필드 정의가 한 곳에. `components/ui/*` 는 도메인 모름, 도메인 컴포넌트는 `ui` 조합.

### 상태관리
- 서버 상태: Server Components + Supabase SSR fetch
- 클라이언트 쿼리: 필요 시 `@tanstack/react-query`
- 폼 상태: `react-hook-form` + `zod` resolver
- Realtime: `@supabase/supabase-js` 브라우저 인스턴스 `postgres_changes` 채널
- 전역 상태 라이브러리 없음 (useContext로 충분)

---

## §5. 핵심 순수 함수 (TDD 대상)

| 파일 | 함수 | 책임 |
|---|---|---|
| `lib/prompts/persona.ts` | `buildSystemPrompt(persona, memories)` | Persona + memories → Clone용 system prompt |
| `lib/prompts/persona.ts` | `renderPersonaCore(persona)` | null 필드 제외, 구조화 텍스트 |
| `lib/prompts/persona.ts` | `renderRecentMemories(memories)` | 시간 역순, relevance 정렬, 토큰 예산 절단 |
| `lib/interaction/remap.ts` | `remapHistoryForSpeaker(events, speakerId)` | events → Claude messages (role + content) |
| `lib/interaction/remap.ts` | `pickSpeaker(participants, turn)` | 턴 번호 → 발화자 Clone |
| `lib/interaction/endCheck.ts` | `shouldEnd(events, maxTurns, lastResponse)` | 종료 조건 |
| `lib/memory/extract.ts` | `parseMemoryExtraction(raw)` | Claude 응답 JSON 파싱·검증 |
| `lib/memory/extract.ts` | `normalizeOccurredAt(raw, now)` | 상대 시간 → ISO 날짜 |
| `lib/analysis/parse.ts` | `parseAnalysisReport(raw)` | 분석 응답 JSON 파싱·검증 |
| `lib/analysis/prompt.ts` | `buildAnalysisPrompt(events, personas)` | 분석용 입력 조립 |

### 대표 검증 케이스

**`remapHistoryForSpeaker(events, speakerId)`**
- 발화자 턴 → `role: 'assistant'`, content 그대로
- 타인 턴 → `role: 'user'`, content에 `[이름]: ...` 접두어
- 빈 events → 빈 배열
- speakerId가 참여자 아님 → 모든 턴이 `user`

**`shouldEnd(events, maxTurns, lastResponse)`**
- `events.length >= maxTurns` → true
- `lastResponse` 에 `<promise>END</promise>` 포함 → true
- 최근 3턴 모두 `content.length < 10` → true
- 그 외 → false

**`parseMemoryExtraction(raw)`**
- 필수 필드 없으면 `ValidationError` throw
- `kind`가 허용 enum 밖이면 throw
- `tags` 없으면 `[]` 기본값
- 추가 필드 무시

**`normalizeOccurredAt(raw, now)`** (now = 2026-04-11 금요일 기준)
- `"오늘"` → `"2026-04-11"`
- `"어제"` → `"2026-04-10"`
- `"지난주"` → `"2026-04-04"` (7일 전 근사)
- 이미 ISO 형식 → 그대로
- 파싱 실패 → throw

**`parseAnalysisReport(raw)`**
- `score` 0-100 밖 → throw
- `categories` 키가 `ANALYSIS_CATEGORIES` 상수 밖 → throw
- 각 카테고리 `score` 숫자, `comment` 문자열 확인

### 테스트 파일 위치
```
frontend/src/lib/
├── prompts/persona.ts + persona.test.ts
├── interaction/remap.ts + remap.test.ts
├── interaction/endCheck.ts + endCheck.test.ts
├── memory/extract.ts + extract.test.ts
└── analysis/parse.ts + parse.test.ts
         + prompt.ts + prompt.test.ts
```

### 테스트 도구
- **Vitest** (`test.environment: 'node'`)
- `package.json`: `"test": "vitest"`, `"test:run": "vitest run"`

### 제외 대상
- API Routes, React 컴포넌트, Supabase 쿼리, Claude API 호출 자체 — 수동/브라우저 확인

---

## §6. 에러 처리

### Claude API 에러
| 상황 | 처리 |
|---|---|
| Rate limit (429) | 지수 백오프 재시도 (max 3, 1s→2s→4s) |
| Context window 초과 | 오래된 턴 요약 후 1회 재시도 → 실패 시 `failed` |
| 네트워크 타임아웃 | 턴 재시도 (max 2) → 실패 시 `failed` |
| 잘못된 JSON 응답 | 1회 재시도 → 실패 시 `failed`, 원문 로그 저장 |

구현: `lib/claude.ts` 래퍼가 모든 재시도 정책 담당. 재시도 상수는 `lib/config/claude.ts`.

### Interaction 실행 중 실패
- 부분 진행된 `interaction_events`는 **보존** (사용자가 흐름 확인 가능)
- `interactions.status = 'failed'` + `metadata.failure_reason` 저장
- 프론트에서 "재시도" 버튼 → 새 interaction 생성 (같은 페어·시나리오)
- 사용자 중단은 `cancelled` 별도 구분

### Supabase 에러
- RLS 위반 → 403 `FORBIDDEN`
- Unique 충돌 (turn_number) → 500, 로그 (버그 신호)
- 연결 실패 → 500 + 1회 재시도

### 검증 에러
- Zod 스키마 API 입구 검증 → 400 `VALIDATION` + `details`

### 공통 팩토리 (`lib/errors.ts`)
```ts
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public details?: unknown
  ) { super(message) }
}

export const errors = {
  unauthorized: () => new AppError('UNAUTHORIZED', '인증이 필요합니다', 401),
  notFound: (resource: string) => new AppError('NOT_FOUND', `${resource}를 찾을 수 없습니다`, 404),
  validation: (details: unknown) => new AppError('VALIDATION', '입력이 올바르지 않습니다', 400, details),
  llm: (cause: Error) => new AppError('LLM_ERROR', 'AI 서비스 오류', 502, { cause: cause.message }),
  forbidden: () => new AppError('FORBIDDEN', '권한이 없습니다', 403),
  internal: () => new AppError('INTERNAL', '서버 오류', 500),
}
```

### 프론트엔드 에러 표시
- `components/ui/toast.tsx` (shadcn)
- Realtime 구독 에러 → 재연결 시도 후 배지 표시
- 전역 `app/error.tsx` error boundary

---

## §7. 테스트 전략

### 범위
- **유닛**: §5 순수 함수 전부 (Vitest)
- **통합**: 없음 (Phase 1)
- **E2E**: 없음 (수동 브라우저)

### TDD 흐름
순수 함수 각각에 대해:
1. 테스트 파일 먼저 작성 (failing)
2. 최소 구현 → green
3. 리팩토링 (녹색 유지)

### 수동 확인 체크리스트 (매 기능 완료 시)
1. `bun run dev` 로컬 실행
2. 브라우저 전체 플로우 확인 (로그인 → Clone 생성 → Interaction → 분석 → 메모리)
3. 콘솔/Network 에러 없음 확인
4. Supabase Studio로 테이블 상태 확인

### Verification-before-completion 원칙
"완료" 주장 전:
- `bun run test:run` 녹색 증명
- 브라우저 동작 스크린샷 또는 구체적 설명
- 통과 없이 완료 주장 금지 (superpowers 규율 준수)

---

## 범위 외 (Phase 2 이후)

- **자동 배치 실행** — "내 Clone × 모든 NPC" 한 번에 돌리고 랭킹
- **호환성 랭킹 뷰 + 대화 비교**
- **n-to-n 그룹 상호작용** — 3인 이상 동시 대화
- **관계 그래프**
- **클론 자율 상호작용 스케줄링** (랜덤 주기 트리거)
- **실제 데이터 파서** (카카오톡/인스타그램 → 페르소나 자동 생성)
- **대화 스트리밍 (토큰 단위 SSE)** — Phase 1은 턴 단위 INSERT로 충분
- **메모리 자동 요약 (compaction)**
- **민감 정보 toggle UI** (`past_relationships_summary`, `beliefs`)
- **여러 버전 Clone 관리 UI** (`clones.version` 컬럼은 Phase 1부터 있으나 UI는 Phase 2)

## 열려 있는 질문 (구현 전 확정)

- NPC 5개의 구체 페르소나 필드 — 구현 시점에 seed SQL을 작성하며 확정
- Interaction 기본 scenario 프리셋 목록 (3-5개 권장) — 구현 시점에 결정
- `buildSystemPrompt`의 토큰 예산 기본값 — 1500 토큰 목표로 시작, 실측 후 조정
- 호환성 분석의 카테고리 목록 — `.claude/skills/interaction/SKILL.md` 기본값 사용, 구현 중 조정
- 매직링크 이메일 발송 공급자 — Supabase 기본 사용, 커스텀 필요 시 Phase 2

## 의존성 설치 목록 (구현 시작 시)

```
next (기존)
react (기존)
tailwindcss (기존)

@supabase/supabase-js
@supabase/ssr
@anthropic-ai/sdk
react-hook-form
@hookform/resolvers
zod
@tanstack/react-query    (선택, 클라이언트 쿼리 필요 시)

# shadcn/ui init으로 설치됨:
class-variance-authority
clsx
tailwind-merge
lucide-react
tailwindcss-animate
@radix-ui/*

# devDependencies
vitest
@vitest/ui              (선택)
```

Supabase 로컬 환경:
```
supabase CLI (brew install supabase/tap/supabase)
```
