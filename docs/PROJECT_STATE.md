# Project State — Digital Clone Platform

> **Living document.** 매 Phase 끝에 업데이트. 새 대화를 시작할 때 가장 먼저 읽어야 할 문서.
> 마지막 업데이트: **2026-04-12** (Phase 1 완료 시점)

---

## 요약

| 항목 | 상태 |
|---|---|
| 현재 단계 | **Phase 1 ✅ 완료** |
| 프로덕션 배포 | ✅ `https://frontend-eta-neon-97.vercel.app` |
| 마지막 태그 | `phase1-complete` |
| 다음 단계 | Phase 2 설계 대기 |
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
- `GET /auth/callback`

### 주요 모듈

**`lib/`**:
- `claude.ts` — Anthropic SDK 래퍼 + 지수 백오프 재시도
- `supabase/{client,server,service,proxy,realtime}.ts` — 4종 Supabase 클라이언트 + Realtime 채널 헬퍼
- `interaction/engine.ts` — 20턴 루프, `<continue/>` / `<end/>` 마커 파싱, 연속 발화 지원 (최대 3턴)
- `interaction/remap.ts` — `remapHistoryForSpeaker`, `pickSpeaker` 순수 함수
- `memory/{service,extract}.ts` — Haiku 추출 서비스 + 파싱/정규화 순수 함수
- `analysis/{service,parse,prompt}.ts` — Sonnet 분석 서비스 (캐시) + 파싱/프롬프트 순수 함수
- `prompts/{persona,behavior,interaction,memory}.ts` — 모든 프롬프트 템플릿
- `config/{claude,interaction,analysis}.ts` — 상수 (모델명, 턴 수, 시나리오, 카테고리)
- `constants/personaFields.ts` — `PERSONA_SECTIONS` 메타데이터 (폼·프롬프트 공유)
- `validation/*.ts` — Zod 스키마 4종
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

테이블: `profiles`, `clones`, `clone_memories`, `interactions`, `interaction_participants`, `interaction_events`, `analyses`

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

모든 마이그레이션 Supabase Cloud 적용 완료.

### 테스트
- Vitest 53개 passing
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

---

## 알려진 이슈 & 우회책

### 1. Realtime 채널 연결 불안정
- **증상**: `InteractionViewer` 의 "Realtime: connecting" 이 connected 로 안 넘어갈 때가 있음
- **원인**: 미확인. Plan 4 RLS 마이그레이션 이후 Realtime 재인증 타이밍 / publication 문제 추정
- **우회책**: 3초 polling fallback (`GET /api/interactions/[id]` 에서 events 배열 전체 다시 fetch + 머지). Realtime 실패해도 UX 유지
- **Phase 2 TODO**: 근본 원인 조사, 재연결 정책 개선

### 2. Clone 시뮬레이션 현실감
- **증상**: 대화가 평탄하게 진행, 모든 조합이 비슷한 톤으로 수렴. 페르소나별 말투 차이 약함
- **원인**:
  - NPC seed 의 페르소나 core 정보가 충분히 구체적이지 않음
  - 외부 맥락(그날 이벤트, 뉴스, 상대방에 대한 선지식) 부재
  - 랜덤성(기분, 태도) 없음
- **우회책**: 없음. Phase 2 최우선 과제
- **유저 제안** (미결정):
  - 클론 정보 세부 입력 (입력 장벽 큼)
  - 기분·태도 랜덤성 주입 (make-sense 수준)
  - 외부 환경 context (뉴스/SNS, 규모 큼)

### 3. Supabase 이메일 매직링크 rate limit
- **증상**: 반복 테스트 시 "email rate limit exceeded" (시간당 3-4통)
- **우회책**: Google OAuth 로 로그인 (현재 주 로그인 수단)
- **Phase 2 TODO (선택)**: Resend/SendGrid 커스텀 SMTP 연결로 rate limit 우회

### 4. Dev CLI 스크립트의 realism 튜닝 루프 미수행
- **상태**: Plan 4 Group B.4 의 1차 튜닝은 smoke test 1회만 실시. Group G.2 2차 체크리스트 평가도 체계적으로 안 함
- **영향**: 위 이슈 2번과 연결. 현실감 개선 여지 많음
- **Phase 2 TODO**: realism 체크리스트 8개 항목 기반 체계적 튜닝

---

## Phase 2 백로그

### High priority (사용자 가치 직결)
1. **시뮬레이션 현실감 개선** — 랜덤성, 외부 맥락, 페르소나 말투 차별화
2. **Realtime 안정화** — 근본 원인 조사 + polling fallback 제거
3. **Memory compaction** — 메모리 많아지면 토큰 낭비. 자동 요약
4. **분석 리포트 고도화** — 더 다양한 카테고리, 시각화, 차트

### Mid priority
5. **배치 실행** — "내 Clone × 모든 NPC" 한 번에 + 랭킹 뷰
6. **Clone 버전 관리 UI** — `clones.version` 컬럼은 존재, UI 없음
7. **Memory 편집/삭제 UI** — 현재는 추가만
8. **시나리오 커스텀** — 현재 3개 하드코딩, 사용자 직접 작성

### Low priority / 후순위
9. **토큰 단위 SSE 스트리밍** — 턴 INSERT 기반보다 체감 개선
10. **커스텀 SMTP** — Resend/SendGrid, rate limit 우회
11. **민감 정보 toggle UI** — `past_relationships_summary`, `beliefs`
12. **OG image, SEO** — 공개용 단장

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
| Plan 문서 5개 | `docs/superpowers/plans/2026-04-*.md` |

---

## 다음 대화 시작 시 체크리스트

새 세션에서 이어서 작업할 때:

1. `CLAUDE.md` 자동 로드 — 프로젝트 비전·규칙 확보
2. **이 파일 (`docs/PROJECT_STATE.md`)** 먼저 읽기 — 현재 상태·이슈·백로그
3. 필요하면 관련 Skill 호출 (persona/interaction/db-schema)
4. 사용자 요청에 따라 Phase 2 spec 설계 → Plan 6 작성 → 실행
5. 신규 작업은 항상 **기존 결정 재확인** ("재도전 금지" 섹션) 후 시작
