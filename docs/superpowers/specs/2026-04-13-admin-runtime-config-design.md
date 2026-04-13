# Admin Runtime Config Toggle — Design Spec

> **Date**: 2026-04-13
> **Status**: Approved
> **Goal**: Admin 페이지에서 토글로 interaction 설정을 런타임 전환. 배포 없이 "절약/정상" 모드 스위칭.

---

## 배경

현재 interaction 모델(Haiku/Sonnet), 턴 수(15/20), 출력 토큰(200/512)이 코드 상수로 하드코딩되어 있어 변경 시 매번 배포가 필요하다. Admin이 런타임에 토글로 전환할 수 있어야 한다.

## 범위

### 토글 2개

1. **Interaction 모드 프리셋**: `economy` / `normal` — 3개 값을 한번에 전환
2. **관계 기억 (Relationship Memory)**: 독립 on/off 토글

### Interaction 모드 프리셋 매핑

| 항목 | economy | normal |
|---|---|---|
| 모델 | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` |
| 턴 수 | 15 | 20 |
| 출력 토큰 | 200 | 512 |

---

## 1. DB: `platform_config` 테이블

```sql
create table platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- RLS: 인증 유저 읽기 가능, 쓰기는 service client(admin API)만
alter table platform_config enable row level security;

create policy "Authenticated users can read config"
  on platform_config for select
  to authenticated
  using (true);

-- 초기 데이터
insert into platform_config (key, value) values
  ('interaction_mode', '"economy"'),
  ('relationship_memory_enabled', 'true');
```

- `value`는 jsonb → 문자열, boolean, 객체 모두 수용
- 쓰기는 RLS 정책 없음 → service client만 가능 (admin API에서 사용)

## 2. 런타임 조회 함수

**파일**: `lib/config/runtime.ts`

```ts
// 프리셋 정의
const INTERACTION_PRESETS = {
  economy: {
    model: 'claude-haiku-4-5-20251001',
    maxTurns: 15,
    maxOutputTokens: 200,
  },
  normal: {
    model: 'claude-sonnet-4-6',
    maxTurns: 20,
    maxOutputTokens: 512,
  },
} as const;

type InteractionMode = keyof typeof INTERACTION_PRESETS;

interface RuntimeConfig {
  interactionMode: InteractionMode;
  interactionModel: string;
  maxTurns: number;
  maxOutputTokens: number;
  relationshipMemoryEnabled: boolean;
}

async function getRuntimeConfig(supabase): Promise<RuntimeConfig>
```

- Supabase에서 `platform_config` 2개 row 조회
- 프리셋 키로 매핑하여 `RuntimeConfig` 반환
- **조회 실패 시**: 기존 코드 상수(fallback) 반환. 에러 로깅만, UX 차단 없음

## 3. 엔진 통합 — 변경 지점

### 3-1. `/app/api/interactions/[id]/run/route.ts`

- `getRuntimeConfig()` 호출
- `runtimeConfig.maxTurns`를 `runInteraction()`에 전달
- `runtimeConfig.relationshipMemoryEnabled`로 관계 기억 추출 제어
- `runtimeConfig`를 `prepareClonePrompts()`에 전달

### 3-2. `lib/interaction/orchestrate.ts`

- `prepareClonePrompts()`가 `runtimeConfig` 수신
- `runtimeConfig.interactionModel` 사용 (기존: `CLAUDE_MODELS.INTERACTION` import)
- `runtimeConfig.relationshipMemoryEnabled` 사용 (기존: `FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY`)

### 3-3. `lib/interaction/engine.ts`

- `runInteraction()`이 `runtimeConfig` 또는 개별 값(model, maxOutputTokens) 수신
- `callClaude()` 호출 시 `runtimeConfig.interactionModel`, `runtimeConfig.maxOutputTokens` 사용

### 3-4. 기존 상수 처리

- `lib/config/claude.ts`: `CLAUDE_MODELS.INTERACTION`, `CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_INTERACTION` — fallback 기본값으로 유지. TODO 주석 제거
- `lib/config/interaction.ts`: `INTERACTION_DEFAULTS.MAX_TURNS`, `FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY` — fallback 기본값으로 유지. TODO 주석 제거
- 다른 모델/토큰 설정(EXTRACTION, ANALYSIS, ONBOARDING, RELATIONSHIP)은 변경 없음

## 4. API

### `GET /api/admin/config`

- Admin 권한 체크 (`isAdmin`)
- Service client로 `platform_config` 전체 조회
- 응답: `{ interactionMode, relationshipMemoryEnabled }`

### `PATCH /api/admin/config`

- Admin 권한 체크
- Body: `{ interactionMode?: "economy" | "normal", relationshipMemoryEnabled?: boolean }`
- Service client로 해당 row upsert
- 응답: 업데이트된 설정

## 5. Admin UI: `/admin/config`

### 페이지 구성

- 제목: "플랫폼 설정"
- **Interaction 모드** 카드:
  - "절약" / "정상" 토글 (현재 활성 값 강조)
  - 활성 모드 아래에 세부 값 표시 (모델명, 턴 수, 토큰)
- **관계 기억** 카드:
  - on/off 토글
  - 설명: "Interaction 종료 후 양방향 관계 기억 자동 추출"
- 변경 시 즉시 PATCH 호출 → 성공 시 toast ("설정이 변경되었습니다")
- Admin layout 기존 패턴 재사용 (nav에 `/admin/config` 링크 추가)

### 레이아웃 안정성

- 토글 2개만이므로 복잡한 레이아웃 불필요
- 카드 높이 고정 (`min-h` 보장)

## 6. Admin Nav 변경

기존 admin 네비게이션에 "설정" 링크 추가:
- `/admin/world` — World Context
- `/admin/interactions` — Interactions
- `/admin/clones` — Clones
- `/admin/config` — **설정** (신규)

---

## 범위 밖 (Not In Scope)

- 프리셋 커스텀 (개별 값 직접 수정) — 현재는 프리셋 토글만
- 다른 모델 설정(EXTRACTION, ANALYSIS 등) 런타임 전환
- 설정 변경 이력(audit log)
- 캐시 레이어 (serverless 환경에서 의미 제한적)
