# Project State — Digital Clone Platform

> **Living document.** 매 Phase 끝에 업데이트. 새 대화를 시작할 때 가장 먼저 읽어야 할 문서.
> 마지막 업데이트: **2026-04-12** (Phase 2 P0 완료 시점)

---

## 요약

| 항목 | 상태 |
|---|---|
| 현재 단계 | **Phase 2 P0 ✅ 완료** (Realism & World Context) |
| 프로덕션 배포 | ✅ `https://frontend-eta-neon-97.vercel.app` |
| 마지막 태그 | `phase1-complete` |
| 다음 단계 | Phase 2 P2 (Matching 기반 Batch Simulation) |
| 기본 브랜치 | `main` |
| 기술 스택 | Next.js 16 · TypeScript · Tailwind v4 · Supabase Cloud · Anthropic Claude · Vercel |

---

## Phase 1 구현 스냅샷

### Plans
- Plan 1: Foundation — 순수 함수 10종, 타입, 상수, 에러 팩토리 (`plan1-foundation-complete`)
- Plan 2: Supabase + Auth — 9개 마이그레이션, RLS, NPC seed 5개, Supabase Auth (`plan2-supabase-complete`)
- Plan 3: Clone CRUD + Persona UI — 데이터 드리븐 폼, 페이지 4개, API (`plan3-clone-ui-complete`)
- Plan 4: Interaction Engine + Realtime Viewer — 20턴 엔진, API, 뷰어, realism 프롬프트 (`plan4-interaction-complete`)
- Plan 5: Memory + Analysis — 메모리 추출(Haiku), 호환성 분석(Sonnet, 캐시), UI (`plan5-memory-analysis-complete`)

- Plan 6: Realism & World Context — 스타일 카드, mood roll, world context, texture rules, dev CLI (`phase2-p0-realism`)

모든 Plan 문서: `docs/superpowers/plans/2026-04-*.md`

### 라우트 목록

**페이지**:
- `/login` — Google OAuth + 이메일 매직링크
- `/clones` — 내 Clone + NPC 목록
- `/clones/mine` — 내 Clone 선택형 뷰 (다중 Clone 대응)
- `/clones/new` — 빠른 생성 폼
- `/clones/[id]` — 상세 + 메모리 (NPC 용도 포함)
- `/clones/[id]/edit` — 상세 편집 (카테고리 탭)
- `/interactions` — 목록 + Hero CTA
- `/interactions/new` — 페어 + 시나리오 선택
- `/interactions/[id]` — Realtime 뷰어 + 분석 버튼
- `/analyses/[id]` — 호환성 리포트

**API**:
- `GET|POST /api/clones` / `GET|PATCH|DELETE /api/clones/[id]`
- `GET|POST /api/interactions` / `GET|DELETE /api/interactions/[id]` / `POST /api/interactions/[id]/run`
- `GET|POST /api/memories`
- `POST /api/analyses` / `GET /api/analyses/[id]`
- `GET|POST /api/world-context` / `DELETE /api/world-context/[id]` / `POST /api/world-context/copy`
- `GET /auth/callback`

**Admin**:
- `/admin/world` — world context 수동 관리 (ADMIN_USER_IDS env var 기반 접근 제어)

### 주요 모듈

**`lib/`**:
- `claude.ts` — Anthropic SDK 래퍼 + 지수 백오프 재시도
- `supabase/{client,server,service,proxy,realtime}.ts` — 4종 Supabase 클라이언트 + Realtime 채널 헬퍼
- `interaction/engine.ts` — 20턴 루프, `<continue/>` / `<end/>` 마커 파싱, 연속 발화 지원 (최대 3턴)
- `interaction/remap.ts` — `remapHistoryForSpeaker`, `pickSpeaker` 순수 함수
- `memory/{service,extract}.ts` — Haiku 추출 서비스 + 파싱/정규화 순수 함수
- `analysis/{service,parse,prompt}.ts` — Sonnet 분석 서비스 (캐시) + 파싱/프롬프트 순수 함수
- `prompts/{persona,behavior,interaction,memory,texture,mood}.ts` — 프롬프트 템플릿 + 텍스처 규칙
- `styles/{types,index,match}.ts` + `styles/cards/*.ts` — 스타일 카드 시스템 (6장 시드, 4-tier matcher)
- `mood/{types,parse,fallback,roll}.ts` — Session-start mood roll (Haiku + code fallback)
- `world/{types,collect,inject}.ts` — 외부 세계 context 수집 + 프롬프트 주입
- `interaction/orchestrate.ts` — modulator 조립 (mood + cards + world → enhanced prompt)
- `admin/guard.ts` — env var 기반 admin 체크
- `config/{claude,interaction,analysis}.ts` — 상수 (모델명, 턴 수, 시나리오, 카테고리, realism defaults)
- `constants/personaFields.ts` — `PERSONA_SECTIONS` 메타데이터 (폼·프롬프트 공유)
- `validation/*.ts` — Zod 스키마 5종 (worldContext 추가)
- `errors.ts` — `AppError` + `errors` 팩토리

**`components/`**:
- `ui/` — shadcn/ui 프리미티브 (card, button, badge, input, textarea, select, tabs, alert-dialog, skeleton, sonner, dropdown-menu, form, label, avatar, page-skeleton)
- `nav/` — `AppNav` (서버) + `NavLinks` + `BackButton` + `LogoutButton` (클라)
- `persona/` — `ArrayInput`, `PersonaFieldRow`, `PersonaSection`, `PersonaQuickForm`, `PersonaFullEditor`, `PersonaSummaryCard`, `PersonaDetailView`, `ExpandablePersonaDetail`
- `clone/` — `CloneCard`, `CloneList`, `CloneNpcBadge`, `DeleteCloneButton`, `MyCloneSelector`
- `interaction/` — `InteractionViewer`, `MessageBubble`, `TypingIndicator`, `InteractionPairPicker`, `ScenarioPicker`, `InteractionStatusBadge`, `InteractionProgressBar`, `NewInteractionHero`, `DeleteInteractionButton`
- `memory/` — `MemoryInputBox`, `MemoryItem`, `MemoryTimeline`
- `analysis/` — `AnalysisReport`, `AnalysisGenerateButton`, `CategoryCard`, `ScoreBar`

### DB 스키마 (Supabase Cloud: `qegpqadsxujgmodocsme`)

테이블: `profiles`, `clones`, `clone_memories`, `interactions`, `interaction_participants`, `interaction_events`, `analyses`, `world_context`

**마이그레이션 9개**:
1. `20260411000001_init_profiles.sql`
2. `20260411000002_init_clones.sql`
3. `20260411000003_init_clone_memories.sql`
4. `20260411000004_init_interactions.sql`
5. `20260411000005_init_analyses.sql`
6. `20260411000006_enable_rls.sql`
7. `20260411000007_enable_realtime.sql`
8. `20260411000008_seed_npc_clones.sql`
9. `20260412000001_fix_rls_recursion.sql` — `interaction_is_mine(uuid)` SECURITY DEFINER 헬퍼로 재귀 제거
10. `20260412000002_next_speaker_column.sql` — `interaction_events.next_speaker_clone_id`

11. `20260413000001_world_context.sql` — `world_context` 테이블 + RLS (Phase 2 P0)

모든 마이그레이션 Supabase Cloud 적용 완료.

### 테스트
- Vitest 128개 passing (Phase 1: 53 + Phase 2 P0: 75)
- 순수 함수 전부 TDD 커버
- UI / API / Supabase / Claude 호출은 수동 검증

### 배포
- Vercel 프로젝트: `frontend` (팀 `team_LMyD0yMaoXewgaVo2p0Lv26W`)
- Root Directory: `frontend`
- Production URL: `https://frontend-eta-neon-97.vercel.app`
- Auto-deploy: `main` 푸시 → 프로덕션
- 환경변수 (Production + Preview):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `ADMIN_USER_IDS` (Production only)

### 인증
- Supabase Auth + Google OAuth (console.cloud.google.com 프로젝트 생성, Supabase Provider 활성화)
- 이메일 매직링크는 백업 (Supabase 무료 플랜 시간당 3-4통 rate limit 있음)
- 로그인 탭이 `onAuthStateChange` 구독 → 다른 탭에서 인증 완료 시 자동 `/clones` 리다이렉트

---

## 주요 아키텍처 결정 (재도전 금지)

| 결정 | 이유 |
|---|---|
| 별도 백엔드 서버 분리 금지 | Next.js API Routes로 통합. Vercel 단일 배포. FastAPI 제거된 이유 |
| Clone 당 stateless Claude 호출 + role 재매핑 | 페르소나 오염 방지. 표준 패턴 |
| persona_json + clone_memories 레이어 분리 | 정적/동적 업데이트 빈도 차이. 섞지 말 것 |
| `interaction_participants` 조인 테이블 | 1:1 하드코딩 금지. n-to-n 대비 |
| 도메인 용어 "Interaction" | "소개팅"·"데이팅" 으로 좁히지 말 것 |
| 데이터 드리븐 폼 (`PERSONA_SECTIONS`) | 폼 + 프롬프트 + Zod 스키마가 단일 소스 공유 |
| 20턴 기본값 | 토큰 비용 + 대화 현실감 balance |
| Interaction create / run 엔드포인트 분리 | 클라이언트가 뷰어로 먼저 이동 후 실행 트리거 → 300초 블로킹 회피 |
| Analysis 캐시 (같은 interaction = 1 analysis) | LLM 비용 절감 |
| 메모리 kind 4종 고정 | `event`/`mood`/`fact`/`preference_update` 이외 확장 금지 (파싱 단순) |
| SECURITY DEFINER `interaction_is_mine` 헬퍼 | RLS 상호 참조 재귀 방지 |
| `next_speaker_clone_id` 컬럼 | AI가 다음 발화자 결정 → 연속 발화 지원. 교대 하드코딩 금지 |
| `<continue/>` / `<end/>` 마커 | `<promise>END</promise>` 와 동일 패턴. 프롬프트에서 강제 |
| `InteractionProgressBar` / `ScoreBar` 만 inline `style` 허용 | dynamic % 필요. 다른 곳에서는 Tailwind 유틸만 |
| UI 안정성 규칙 | 카드/탭/스크롤바 레이아웃 점프 금지 — `h-full`, `min-h`, `\u00A0`, `scrollbar-gutter: stable` 등 |
| Mood는 tint, not driver | session-start 1회 주입, 1~2줄 자연어만. 수치는 prompt에 금지. 대화 중 drift 허용 |
| 스타일 카드는 TS 파일로 관리 | DB 아닌 `lib/styles/cards/*.ts`. 50장 넘어가면 DB 이관 재검토 |
| World context 수동 큐레이션 | v1은 `/admin/world`에서 수동. 미래에 뉴스 API 자동 수집으로 전환 예정. collection vs injection 분리 |
| Admin은 env var 기반 | `ADMIN_USER_IDS` env var. DB 컬럼 아님. 간단함 우선 |
| Claude 4.6 assistant prefill 미지원 | 연속 발화 시 history가 assistant로 끝나면 `(이어서 말해)` continuation prompt 추가 |

---

## 알려진 이슈 & 우회책

### 1. Realtime 채널 연결 불안정
- **증상**: `InteractionViewer` 의 "Realtime: connecting" 이 connected 로 안 넘어갈 때가 있음
- **원인**: 미확인. Plan 4 RLS 마이그레이션 이후 Realtime 재인증 타이밍 / publication 문제 추정
- **우회책**: 3초 polling fallback (`GET /api/interactions/[id]` 에서 events 배열 전체 다시 fetch + 머지). Realtime 실패해도 UX 유지
- **Phase 2 TODO**: 근본 원인 조사, 재연결 정책 개선

### 2. Clone 시뮬레이션 현실감 — Phase 2 P0에서 대폭 개선
- **이전 증상**: 대화가 평탄, 모든 조합 비슷한 톤, 페르소나별 말투 차이 약함
- **P0 해결책**:
  - 메시지 텍스처 규칙 (register-aware: 존댓말/반말 구분)
  - 스타일 카드 6장 시드 + 4-tier persona 매칭
  - Session-start mood roll (Haiku) → 세션마다 다른 톤
  - World context 수동 큐레이션 (`/admin/world`)
  - Dev CLI (`npm run interact`) 로 튜닝 루프 지원
- **현재 상태**: 기본 인프라 완성, 지속적 튜닝으로 개선 중
- **잔여 이슈**: 스타일 카드 다양성 확대 필요, 연속 발화 빈도 목표치(30%) 미달

### 3. Supabase 이메일 매직링크 rate limit
- **증상**: 반복 테스트 시 "email rate limit exceeded" (시간당 3-4통)
- **우회책**: Google OAuth 로 로그인 (현재 주 로그인 수단)
- **Phase 2 TODO (선택)**: Resend/SendGrid 커스텀 SMTP 연결로 rate limit 우회

### 4. Dev CLI 스크립트의 realism 튜닝 루프 — Phase 2 P0에서 해결
- **상태**: `npm run interact` CLI 완성. NPC 이름/번호 축약, clone 이름 검색, 자동 체크리스트 평가 지원
- **Round 1 결과**: 마침표 0%, 감정 자음 40%, 문어체 접속사 0회 (PASS). 연속 메시지 20% (FAIL — 목표 30%)
- **현재**: 유저가 `texture.ts` / `styles/cards/` 수정 → CLI 재실행으로 지속 튜닝 중

---

## Phase 2 백로그

### P0 ✅ 완료 — Realism & World Context
- 메시지 텍스처 규칙 (register-aware)
- 스타일 카드 시스템 (6장 시드 + 4-tier matcher)
- Session-start mood roll (Haiku + fallback)
- World context 수동 큐레이션 + `/admin/world`
- Dev CLI 튜닝 루프
- Spec: `docs/superpowers/specs/2026-04-12-phase2-p0-realism-world-context-design.md`
- Plan: `docs/superpowers/plans/2026-04-12-phase2-p0-realism-world-context.md`

### P2 — Matching 기반 Batch Simulation (다음)
- Persona 기반 top-k 후보 선정 (태그 overlap → 나중에 embedding)
- 선정된 후보와 일괄 시뮬레이션 + 랭킹 뷰
- 분석 리포트 카테고리/시각화 확장

### P3 — Quick wins 묶음
- Memory 편집/삭제 UI
- 시나리오 커스텀 (현재 3개 하드코딩)
- Clone 버전 관리 UI (`clones.version` 컬럼 존재, UI 없음)
- 민감 정보 toggle UI

### 관망 (재현 안 됨 / defer)
- Realtime 채널 안정화 — 유저 테스트에서 재현 안 됨
- Memory compaction — 토큰 문제 발생 시 재논의

### Phase 3 이후 (n-to-n, 메타버스)
- 3인 이상 그룹 상호작용
- 관계 그래프
- Clone 자율 상호작용 스케줄링
- 카카오톡/인스타 파서
- 지속적 메타버스

---

## Skills / 참조 문서

| 영역 | 위치 |
|---|---|
| 프로젝트 비전·규칙 | `CLAUDE.md` (auto-loaded) |
| Persona 스키마·메모리 | `.claude/skills/persona/SKILL.md` |
| Interaction 엔진·분석 | `.claude/skills/interaction/SKILL.md` |
| DB 스키마·RLS | `.claude/skills/db-schema/SKILL.md` |
| 코드 리뷰 체크리스트 | `.claude/skills/review/SKILL.md` |
| Phase 1 설계 스펙 | `docs/superpowers/specs/2026-04-11-phase1-digital-clone-design.md` |
| Phase 2 P0 설계 스펙 | `docs/superpowers/specs/2026-04-12-phase2-p0-realism-world-context-design.md` |
| Plan 문서 6개 | `docs/superpowers/plans/2026-04-*.md` |

---

## 다음 대화 시작 시 체크리스트

새 세션에서 이어서 작업할 때:

1. `CLAUDE.md` 자동 로드 — 프로젝트 비전·규칙 확보
2. **이 파일 (`docs/PROJECT_STATE.md`)** 먼저 읽기 — 현재 상태·이슈·백로그
3. 필요하면 관련 Skill 호출 (persona/interaction/db-schema)
4. Phase 2 P0 완료 상태 — 다음은 P2 (Matching) 또는 P3 (Quick wins)
5. 튜닝 루프는 `npm run interact`로 지속 가능 (blocking 아님)
6. 신규 작업은 항상 **기존 결정 재확인** ("재도전 금지" 섹션) 후 시작
