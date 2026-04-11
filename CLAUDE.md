# Digital Clone Platform — Project Guide

## 프로젝트 비전

사용자의 **디지털 클론(AI 페르소나)** 을 생성하고, 클론들이 서로 상호작용하며 **관계의 호환성**을 탐색하는 플랫폼.

- 실제 만남 전에 온라인 대화로 대화 스타일·취미·가치관 궁합을 **저비용 사전 검증**
- 사용자가 직접 많은 사람과 대화하지 않아도 클론이 대신 탐색
- 궁극적으로 **1:1 매칭을 넘어 n-to-n 상호작용 메타버스** 지향

> **도메인 용어 원칙**: "소개팅"·"데이팅"으로 범위를 좁혀 설계하지 말 것. 현재 1:1 대화는 *관계 탐색의 가장 단순한 형태*일 뿐이며, 모든 스키마·API·용어는 **`Interaction`(n-to-n 확장 가능)** 을 기준으로 설계한다.

**현재 단계 (Phase 1)**: 2인 클론 간 대화 프로토타입. 사용자가 직접 입력하는 페르소나 기반.

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + 재사용 컴포넌트 |
| DB / Auth / Realtime | Supabase |
| LLM | Anthropic Claude API (`claude-sonnet-4-6` 기본, 경량 태스크는 `claude-haiku-4-5-20251001`) |
| 배포 | Vercel |

---

## 코딩 규칙

### 공통
- 커밋: `feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:` 접두사
- 환경변수는 `.env` 관리, `.env.example` 최신 유지
- API 키·비밀키 하드코딩 금지

### 재사용성 & 분리 (중요)
사용자가 명시적 예외를 두지 않는 한:
- **하드코딩 최소화**: 매직 넘버/문자열은 `lib/constants/` 또는 `lib/config/`에 상수로
- **Inline CSS 금지**: Tailwind 유틸리티 또는 컴포넌트화된 클래스만. `style={{...}}` 사용 금지 (동적 트랜스폼 같은 불가피한 경우만 예외)
- **Inline HTML 반복 금지**: 동일/유사 마크업이 2회 이상 등장하면 즉시 컴포넌트로 분리
- **프리미티브 레이어**: `components/ui/`에 Button/Input/Card/Badge 등을 모아두고 feature 컴포넌트는 이를 조합
- **인터페이스 분리**: 도메인 타입은 `types/`, API 계약(request/response)은 별도 인터페이스
- **함수/훅 추출**: 컴포넌트 내 비즈니스 로직이 커지면 `useXxx` 훅 또는 `lib/` 함수로

### UI 안정성 (레이아웃 점프 금지)
동적 콘텐츠(필드 개수·텍스트 길이·탭 전환 등)에 따라 **같은 역할의 컴포넌트 크기가 변하면 안 된다.** 사용자는 화면이 "들썩이는" 것을 나쁜 품질로 인식한다.

- **카드·리스트 아이템**: 같은 그리드·리스트 안에서 높이·너비 동일. `h-full flex flex-col` + 콘텐츠 슬롯마다 `min-h-[...]` 또는 placeholder(`\u00A0`) 로 고정
- **탭·아코디언**: 탭/패널 전환 시 래퍼 너비 고정 (`grid-cols-[Xrem_minmax(0,1fr)]`), 높이는 `min-h-[...]` 로 하한 보장
- **스크롤바 점프 방지**: 긴 콘텐츠로 스크롤바가 생길 때 가로 흔들림 발생 → `html { scrollbar-gutter: stable }` (globals.css) 전역 적용
- **textarea·input**: `resize-none` 기본, 자동 리사이즈 금지
- **목록 로딩**: 스켈레톤은 최종 레이아웃과 **동일한 크기** 로 렌더. 빈 상태도 리스트 영역 자체는 유지
- **이미지·아바타**: 항상 명시적 `width/height` 또는 `aspect-ratio`

적용 시점: 새 컴포넌트 작성할 때 "이 컴포넌트는 입력값에 따라 크기가 바뀌는가?" 를 항상 먼저 체크. 바뀌면 위 규칙으로 고정 후 PR.

### TypeScript
- `strict: true`, `any` 금지 (불가피하면 `unknown` + 좁히기)
- 함수형 컴포넌트, `'use client'`는 인터랙션 리프로 최소화
- 파일명: 컴포넌트 `PascalCase.tsx`, 유틸/훅 `camelCase.ts`

### Claude API
- 프롬프트는 `lib/prompts/`에 **템플릿 함수**로 관리 (상수 문자열 금지)
- rate limit / context window / 네트워크 에러 모두 핸들링
- 스트리밍 응답 활용
- 상세 패턴은 `interaction` / `persona` skill 참조

---

## 프로젝트 구조

```
dating/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/                # Next.js API Routes
│   │   │   │   ├── clones/         # Clone CRUD
│   │   │   │   ├── interactions/   # 상호작용 세션
│   │   │   │   ├── memories/       # 에피소드 메모리 업데이트
│   │   │   │   └── analyses/       # 호환성 분석
│   │   │   └── (pages)/
│   │   ├── components/
│   │   │   ├── ui/                 # 프리미티브 (Button, Input, ...)
│   │   │   ├── persona/
│   │   │   └── interaction/
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── claude.ts
│   │   │   ├── prompts/
│   │   │   ├── config/             # 설정 상수
│   │   │   └── constants/
│   │   └── types/
│   ├── supabase/migrations/
│   └── .env.local.example
├── .claude/skills/                 # 도메인별 상세 가이드
│   ├── persona/                    # Persona 스키마 + 메모리
│   ├── interaction/                # 상호작용 엔진
│   ├── db-schema/                  # Supabase 스키마 + RLS
│   └── review/
├── docs/
└── CLAUDE.md
```

---

## 도메인 핵심 개념

| 개념 | 설명 | 상세 skill |
|---|---|---|
| **User** | 실제 사용자 (Supabase Auth) | — |
| **Clone** | User의 디지털 페르소나. User당 여러 버전 가능 | `persona` |
| **Persona** | Clone 정체성 정의 (코어 속성 + 에피소드 메모리) | `persona` |
| **Interaction** | 둘 이상 Clone의 상호작용 세션. 1:1은 특수 케이스 | `interaction` |
| **InteractionEvent** | 상호작용 내 개별 턴 | `interaction` |
| **Analysis** | 상호작용 로그 기반 호환성 리포트 | `interaction` |
| **Memory** | Clone 에피소드 메모리 (자연어 업데이트) | `persona` |

**상세 스키마·SQL·API 로직**은 관련 skill에 있다. 해당 영역 작업 시 skill을 참조할 것.

---

## 주요 의사결정 기록

| 결정 | 이유 |
|------|------|
| Next.js API Routes (FastAPI 제거) | 별도 서버 불필요, Vercel 단일 배포 |
| Supabase | managed DB + Auth + Realtime 통합 |
| 클론당 stateless Claude 호출 | 컨텍스트 분리로 페르소나 오염 방지 |
| 턴 수 기본 20 | 토큰 비용 제어 + 대화 현실감 |
| App Router | 서버 컴포넌트 + 스트리밍 UI |
| 페르소나 코어 / 에피소드 메모리 분리 | 업데이트 빈도·수명 상이 |
| 도메인 용어 "Interaction" | n-to-n 확장 대비, 소개팅 도메인 비구속 |
| Persona 필드 풍부 + null 허용 | 사용자 정보량 다양성 수용 |
| `interaction_participants` 조인 테이블 | 1:1 하드코딩 금지, n명 참여자 표현 |

---

## 개발 단계

- **Phase 1 (현재)** — 페르소나 입력 폼, Clone CRUD, 1:1 Interaction 엔진, 호환성 리포트, 메모리 업데이트 API
- **Phase 2** — Realtime 스트리밍, 리포트 시각화, 배치 상호작용, 메모리 compaction
- **Phase 3** — n-to-n 그룹 상호작용, 관계 그래프, 자율 스케줄링
- **Phase 4** — 실제 데이터 연동 (카카오톡/인스타 파서 → 페르소나 자동 생성)
- **Phase 5** — 지속적 메타버스, Clone 자율 에이전트, Human handoff

---

## 작업 시 참조할 Skill

| 작업 영역 | Skill |
|---|---|
| 페르소나 폼, `/api/clones`, `/api/memories`, system prompt | `persona` |
| `/api/interactions`, `/api/analyses`, 턴 엔진, 분석 | `interaction` |
| Supabase 마이그레이션, 테이블, RLS | `db-schema` |
| 코드 리뷰 체크리스트 | `review` |
