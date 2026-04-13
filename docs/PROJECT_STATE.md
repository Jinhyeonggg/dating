# Project State — Digital Clone Platform

> **Living document.** 매 Phase 끝에 업데이트. 새 대화를 시작할 때 가장 먼저 읽어야 할 문서.
> 마지막 업데이트: **2026-04-13**

---

## 요약

| 항목 | 상태 |
|---|---|
| 현재 단계 | **Phase 2-A ✅ + Phase 2-B ✅ + Admin Runtime Config ✅ + 시나리오 재설계 ✅ + 대화 패턴 개선 ✅** |
| 프로덕션 배포 | ✅ `https://frontend-eta-neon-97.vercel.app` |
| 마지막 태그 | `phase1-complete` |
| 다음 단계 | 개발 환경 agent 구축 + 튜닝 + super_meme NPC |
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
- Plan 7: Clone Visibility + Admin Interactions — 유저 간 Clone 공개, 필드별 프라이버시, admin 대시보드
- Plan 8: Implicit Persona Onboarding — 시나리오+퀴즈 온보딩, inferred_traits, system prompt 주입
- Plan 9: Clone Relationship Memory — 양방향 관계 기억, 자동 추출, system prompt 주입
- Plan 10: Role Clarity + Reliable Extraction — 롤 매핑 명확화, after() 추출, fallback

모든 Plan 문서: `docs/superpowers/plans/2026-04-*.md`

### 라우트 목록

**페이지**:
- `/login` — Google OAuth + 이메일 매직링크
- `/clones` — 내 Clone + 커뮤니티 Clone + NPC 3섹션
- `/clones/mine` — 내 Clone 선택형 뷰 (다중 Clone 대응)
- `/clones/new` — 빠른 생성 폼 → 생성 후 `/clones/[id]/onboarding`으로 자동 이동
- `/clones/[id]` — 상세 + 추론 traits 섹션 + 메모리 (NPC 용도 포함)
- `/clones/[id]/edit` — 상세 편집 (카테고리 탭) + 공개/비공개 토글 + 필드별 프라이버시 칩
- `/clones/[id]/onboarding` — 성격 파악 퀴즈 (시나리오 3 + 선택지 4), 스킵 가능, 재진행 가능
- `/interactions` — "받은 대화 요청" / "내가 시작한 대화" 2섹션 + Hero CTA
- `/interactions/new` — 페어 + 시나리오 선택
- `/interactions/[id]` — Realtime 뷰어 + 분석 버튼 (admin은 service client로 모든 interaction 열람 가능)
- `/analyses/[id]` — 호환성 리포트

**API**:
- `GET|POST /api/clones` / `GET|PATCH|DELETE /api/clones/[id]`
- `POST /api/clones/[id]/onboarding` — 온보딩 응답 제출 → Haiku 추론 → inferred_traits 저장
- `GET|POST /api/interactions` / `GET|DELETE /api/interactions/[id]` / `POST /api/interactions/[id]/run`
- `POST /api/interactions/[id]/seen` — 알림 seen 처리
- `POST /api/interactions/[id]/extract-memories` — 관계 기억 추출 (fallback + 수동 재시도, 60초 타임아웃)
- `DELETE /api/clone-relationships/[id]` — 관계 기억 삭제 (소유권 확인)
- `GET /api/notifications` — 미읽은 알림 목록
- `GET|POST /api/memories`
- `POST /api/analyses` / `GET /api/analyses/[id]`
- `GET|POST /api/world-context` / `DELETE /api/world-context/[id]` / `POST /api/world-context/copy`
- `GET /auth/callback`

**Admin**:
- `/admin/world` — world context 수동 관리
- `/admin/interactions` — 전체 interaction 조회 + 삭제 + "Stuck 정리" 버튼 (1시간+ running → failed 전환)
- `/admin/clones` — 전체 clone 조회 + 삭제 (관련 interaction 일괄 삭제)
- `/admin/config` — 플랫폼 설정 (Interaction 모드, 관계 기억 추출, 대상/다른 클론 기억 주입 + limit)
- `GET|POST /api/admin/interactions` / `DELETE /api/admin/interactions/[id]`
- `GET /api/admin/clones` / `DELETE /api/admin/clones/[id]`
- `GET|PATCH /api/admin/config` — 런타임 설정 조회/변경
- (ADMIN_USER_IDS env var 기반 접근 제어)

### 주요 모듈

**`lib/`**:
- `claude.ts` — Anthropic SDK 래퍼 + 지수 백오프 재시도
- `supabase/{client,server,service,proxy,realtime}.ts` — 4종 Supabase 클라이언트 + Realtime 채널 헬퍼
- `interaction/engine.ts` — 20턴 루프, `<continue/>` / `<end/>` 마커 파싱, 연속 발화 지원 (최대 3턴), **270초 타임아웃 가드** (Vercel 300초 전 자동 completed)
- `interaction/remap.ts` — `remapHistoryForSpeaker`, `pickSpeaker` 순수 함수
- `interaction/orchestrate.ts` — modulator 조립 (mood + cards + world + **inferred_traits** → enhanced prompt)
- `onboarding/{extract,service}.ts` — 온보딩 추론 파싱 순수 함수 + Haiku 추론 서비스
- `memory/{service,extract}.ts` — Haiku 추출 서비스 + 파싱/정규화 순수 함수
- `analysis/{service,parse,prompt}.ts` — Sonnet 분석 서비스 (캐시) + 파싱/프롬프트 순수 함수
- `prompts/{persona,behavior,interaction,memory,texture,mood,onboarding}.ts` — 프롬프트 템플릿 + 텍스처 규칙 + 온보딩 추론. behavior.ts — 기억 활용, 언어 수준, 말투(speech_register) 규칙 추가
- `styles/{types,index,match}.ts` + `styles/cards/*.ts` — 스타일 카드 시스템 (6장 시드, 4-tier matcher)
- `mood/{types,parse,fallback,roll}.ts` — Session-start mood roll (Haiku + code fallback)
- `world/{types,collect,inject}.ts` — 외부 세계 context 수집 + 프롬프트 주입
- `admin/guard.ts` — env var 기반 admin 체크
- `clone/publicFields.ts` — 공개 필드 상수 + persona 필터 함수
- `config/{claude,interaction,analysis}.ts` — 상수 (모델명, 턴 수, 카테고리, realism defaults, `CLAUDE_MODELS.ONBOARDING`)
- `config/runtime.ts` — 런타임 설정 조회 (`getRuntimeConfig`), `INTERACTION_PRESETS`, `CONVERSATION_MOODS`, `RELATIONSHIP_STAGES`, `getRelationshipStage()`, `getSpeechRegister()`, 프리셋 매핑
- `constants/{personaFields,onboardingQuestions}.ts` — `PERSONA_SECTIONS` + 온보딩 질문 세트 (시나리오 3 + 선택지 4)
- `validation/*.ts` — Zod 스키마 6종 (onboarding 추가)
- `errors.ts` — `AppError` + `errors` 팩토리

**`components/`**:
- `ui/` — shadcn/ui 프리미티브 (card, button, badge, input, textarea, select, tabs, alert-dialog, skeleton, sonner, dropdown-menu, form, label, avatar, page-skeleton)
- `nav/` — `AppNav` (서버, 받은 요청 개수 뱃지 포함) + `NavLinks` + `BackButton` + `LogoutButton` + `NotificationBell` (드롭다운 + seen 처리) + **`TipBanner`** (랜덤 팁, 세션별)
- `persona/` — `ArrayInput`, `PersonaFieldRow`, `PersonaSection`, `PersonaQuickForm`, `PersonaFullEditor`, `PersonaSummaryCard`, `PersonaDetailView`, `ExpandablePersonaDetail`
- `clone/` — `CloneCard`, `CloneList`, `CloneNpcBadge`, `DeleteCloneButton`, `MyCloneSelector`
- `interaction/` — `InteractionViewer`, `MessageBubble`, `TypingIndicator`, `InteractionPairPicker`, `MoodPicker`, `InteractionStatusBadge`, `InteractionProgressBar`, `NewInteractionHero`, `DeleteInteractionButton`
- `memory/` — `MemoryInputBox`, `MemoryItem`, `MemoryTimeline`, **`MemoryPromptBanner`** (1시간 미접속 후 재방문 시 메모리 업데이트 유도, 현재 테스트용 5초)
- `onboarding/` — `OnboardingCard` (질문 카드 + 진행 바), `TraitsPreview` (추론 결과 프리뷰), `OnboardingFlow` (전체 흐름 관리 + 에러 화면 + 스피너)
- `analysis/` — `AnalysisReport`, `AnalysisGenerateButton`, `CategoryCard`, `ScoreBar`

### DB 스키마 (Supabase Cloud: `qegpqadsxujgmodocsme`)

테이블: `profiles`, `clones`, `clone_memories`, `interactions`, `interaction_participants`, `interaction_events`, `analyses`, `world_context`

**마이그레이션 22개**:
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
12. `20260412000003_clone_visibility.sql` — `clones.is_public`, `clones.public_fields` + RLS 확장
13. `20260412000004_participant_seen_at.sql` — `interaction_participants.seen_at`
14. `20260412000005_inferred_traits.sql` — `clones.inferred_traits` jsonb (Phase 2-A)
15. `20260412000006_fix_rls_participant_visibility.sql` — `interaction_is_mine` 함수 수정 (참여자도 조회 가능)
16. `20260412000007_fix_interactions_select_rls.sql` — `interactions` 테이블 SELECT 정책 추가 (참여자 포함)
17. `20260412000008_fix_clones_interaction_participant_rls.sql` — 비공개 clone도 interaction 상대이면 조회 가능
18. `20260412000009_fix_clones_rls_recursion.sql` — `clone_is_my_interaction_partner` SECURITY DEFINER로 재귀 방지
19. `20260413000003_platform_config.sql` — platform_config 테이블 + 초기 데이터
20. `20260413000004_relationship_memory_injection.sql` — 대화 기억 주입 설정 초기 데이터
21. `20260413000005_split_memory_injection_config.sql` — 기억 주입 설정 pair/other 분리
22. `20260413000006_speech_register.sql` — clone_relationships.speech_register 컬럼

**RLS 헬퍼 함수 (SECURITY DEFINER)**:
- `interaction_is_mine(uuid)` — 내가 생성했거나 내 clone이 참여한 interaction인지 판정
- `clone_is_my_interaction_partner(uuid)` — 해당 clone이 내 clone과 같은 interaction에 참여했는지 판정

모든 마이그레이션 Supabase Cloud 적용 완료.

### 테스트
- Vitest 159개 passing (Phase 1: 53 + Phase 2 P0: 75 + Clone Visibility: 7 + Phase 2-A: 6 + Conversation Pattern: 18)
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
| Clone 데이터 4레이어 분리 | `persona_json`(유저 입력) / `inferred_traits`(AI 추론) / `clone_memories`(에피소드) / `clone_relationships`(관계 기억, Phase 2-B). 각 레이어 역할 섞지 말 것 |
| 온보딩은 폼과 독립적 | 폼의 빈 필드를 채우는 것이 아니라, 폼으로 잡기 어려운 행동 패턴을 별도 추출 |
| `interaction_participants` 조인 테이블 | 1:1 하드코딩 금지. n-to-n 대비 |
| 도메인 용어 "Interaction" | "소개팅"·"데이팅" 으로 좁히지 말 것 |
| 데이터 드리븐 폼 (`PERSONA_SECTIONS`) | 폼 + 프롬프트 + Zod 스키마가 단일 소스 공유 |
| 20턴 기본값 + 270초 타임아웃 가드 | 토큰 비용 + 대화 현실감 balance. Vercel 300초 전에 자동 completed |
| Interaction create / run 엔드포인트 분리 | 클라이언트가 뷰어로 먼저 이동 후 실행 트리거 → 300초 블로킹 회피 |
| Interaction run 에러 시 failed 전환 | try/catch로 엔진 에러 잡아서 status 업데이트. stuck 방지 |
| Analysis 캐시 (같은 interaction = 1 analysis) | LLM 비용 절감 |
| 메모리 kind 4종 고정 | `event`/`mood`/`fact`/`preference_update` 이외 확장 금지 (파싱 단순) |
| SECURITY DEFINER 헬퍼 함수 2종 | `interaction_is_mine` + `clone_is_my_interaction_partner` — RLS 상호 참조 재귀 방지 |
| `next_speaker_clone_id` 컬럼 | AI가 다음 발화자 결정 → 연속 발화 지원. 교대 하드코딩 금지 |
| `<continue/>` / `<end/>` 마커 | `<promise>END</promise>` 와 동일 패턴. 프롬프트에서 강제 |
| `InteractionProgressBar` / `ScoreBar` / `OnboardingCard 진행바` 만 inline `style` 허용 | dynamic % 필요. 다른 곳에서는 Tailwind 유틸만 |
| UI 안정성 규칙 | 카드/탭/스크롤바 레이아웃 점프 금지 — `h-full`, `min-h`, `\u00A0`, `scrollbar-gutter: stable` 등 |
| Mood는 tint, not driver | session-start 1회 주입, 1~2줄 자연어만. 수치는 prompt에 금지. 대화 중 drift 허용 |
| 스타일 카드는 TS 파일로 관리 | DB 아닌 `lib/styles/cards/*.ts`. 50장 넘어가면 DB 이관 재검토 |
| World context 수동 큐레이션 | v1은 `/admin/world`에서 수동. 미래에 뉴스 API 자동 수집으로 전환 예정. collection vs injection 분리 |
| Admin은 env var 기반 | `ADMIN_USER_IDS` env var. DB 컬럼 아님. 간단함 우선 |
| Admin은 service client로 모든 데이터 접근 | interaction viewer에서 admin이면 RLS 우회 |
| 런타임 설정은 platform_config 테이블 | 배포 없이 admin 토글 전환. 코드 상수는 fallback |
| Clone 기본 공개 + 필드별 프라이버시 | `is_public` default true, `public_fields` 배열로 필드별 공개/비공개 제어. Interaction에서는 전체 persona 사용, 열람 시만 필터링 |
| Persona 필드 필터링은 API 레이어 | RLS는 row 단위만 가능. column masking은 서버 코드(`filterPersonaByPublicFields`)에서 수행 |
| 인사는 1턴 제한 | behavior 규칙으로 강제. 2턴째부터 본론(프로필 기반 질문/관심사)으로 |
| 첫 메시지에 상대 프로필 하이라이트 주입 | 엔진이 listener의 persona에서 직업/취미/MBTI 추출 → first user message에 포함 |
| 시나리오를 관계 단계(자동) + 대화 분위기(유저 선택)로 분리 | 클론 기억 누적과 시나리오 모순 제거. interaction_count 기반 deterministic |
| 기억 주입을 pair/other로 분리 + limit 설정 | 대상 클론 기억과 다른 클론 기억을 독립 제어. admin 런타임 토글 |
| 관계별 말투(speech_register) | 나이 차이 + 대화 횟수로 자동 결정. 대화 중 <banmal-switch/>로 전환. 스타일 카드 매칭 연동 |

---

## System Prompt 조립 순서

Interaction 시 Clone별 system prompt는 다음 순서로 조립 (`orchestrate.ts` → `buildEnhancedSystemPrompt`):

```
 1. TEXTURE_RULES              ← lib/prompts/texture.ts (카톡 리얼리즘)
 1.5 ROLE CONTEXT              ← "당신은 X. 상대방은 Y (직업, 나이, MBTI)." 역할 혼동 방지
 2. PERSONA CORE               ← persona_json (null 필드 제외)
 3. INFERRED TRAITS             ← inferred_traits (null이면 생략, Phase 2-A)
 4. RELATIONSHIP MEMORY         ← clone_relationships (해당 상대, 없으면 생략)
 5. EPISODIC MEMORIES           ← clone_memories 최근 10개
 6. MOOD HINT                   ← rollMood() (Haiku + fallback)
 7. STYLE CARDS                 ← pickStyleCards() (최대 2장)
 8. WORLD CONTEXT               ← world_context 테이블
 9. BEHAVIOR INSTRUCTIONS       ← lib/prompts/behavior.ts
```

- 관계 기억: 1인칭 주관적 기억 (2026-04-13 변경). pair/other 분리, limit admin 설정.

**현재 제약 (토큰 절약 모드):**
- 메모리/관계 기억의 system prompt 반영은 최소한으로 제한 중
- 이상적으로는 압축해서라도 전부 주입하는 것이 best지만, 현재는 토큰 비용 때문에 제한
- 추후 메모리 compaction, 요약 파이프라인 도입 시 주입량 확대 예정

튜닝 포인트: `docs/reference/clone-data-fields.md` 참조.

---

## UX 기능

### 알림 벨 (`NotificationBell`)
- 30초 간격 polling (`/api/notifications`)
- 미읽은 interaction 드롭다운 (unread count 뱃지)
- 클릭 → seen 처리 + interaction 페이지 이동
- 읽은 알림만 개별 제거 (전체 삭제 아님)

### 메모리 탭 UI (`MemoryTabs`)
- Clone 상세 페이지 (`/clones/[id]`, `/clones/mine`)에서 탭으로 메모리/대화 기억 전환
- 📝 **메모리** — 유저 직접 입력. `created_at` 기준 시:분:초까지 표시
- 💬 **대화 기억** — Interaction 후 자동 추출. 상대 clone별 카드, 마지막 대화 시각, "보기" 링크로 해당 interaction 이동, 삭제 버튼
- 본인 clone에서만 표시 (NPC/커뮤니티 clone에서는 숨김)

### 관계 기억 자동 추출
- Interaction 완료 후 `after()` API로 response 반환 후 백그라운드 추출
- 양방향 순차 실행 (rate limit 충돌 방지)
- Fallback: interaction 뷰어 방문 시 3초 후 `/api/interactions/[id]/extract-memories` 자동 호출 (양방향 모두 완료될 때까지)
- 추출 실패 시 에러 로깅만 (유저 경험 차단 없음)
- `FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY`로 on/off 가능

### 메모리 업데이트 유도 배너 (`MemoryPromptBanner`)
- localStorage로 마지막 접속 시각 추적
- 1시간 이상 미접속 후 재방문 시 파란색 그라데이션 배너 표시
- 클릭 → 인라인 메모리 입력 확장 (다중 clone 선택 지원)
- "닫기" / "나중에" → 이번 탭 세션에서 dismiss

### 랜덤 팁 배너 (`TipBanner`)
- 세션별 랜덤 팁 1개 표시 (amber 그라데이션)
- 팁 목록: 상호작용 안내, 메모리 업데이트, 상세 정보 수정
- sessionStorage 기반 dismiss (새 탭에선 다시 표시)
- 액션 링크 버튼으로 관련 페이지 이동

### Clone Picker 접기
- Interaction 생성 시 참여자 선택 후 나머지 카드 자동 접힘
- 선택된 카드 클릭 → 선택 해제 + 전체 펼침
- "변경" 힌트로 재선택 가능 표시

### 레이아웃 구조 (layout.tsx)
```
AppNav → TipBanner → MemoryPromptBanner → {children}
```

---

## 알려진 이슈 & 우회책

### 1. Realtime 채널 연결 불안정
- **증상**: `InteractionViewer` 의 "Realtime: connecting" 이 connected 로 안 넘어갈 때가 있음
- **우회책**: 3초 polling fallback. Realtime 실패해도 UX 유지
- **TODO**: 근본 원인 조사

### 2. Anthropic API Rate Limit — 동시 요청 시 속도 저하
- **증상**: 여러 유저가 동시에 interaction 실행 시 답변 속도 현저히 느려짐, 관계 기억 추출 한쪽 실패
- **원인**: 1 Interaction = ~17 API 호출 (mood 1 + 턴 15 + 관계 추출 2). 동시 실행 시 429 rate limit
- **현재 대응**: 
  - `callClaude` 지수 백오프 재시도 (1초→2초→4초)
  - 관계 기억 추출은 순차 실행 (병렬 rate limit 충돌 방지)
  - fallback API로 실패 시 재시도
- **중기**: Anthropic Tier 업그레이드, 큐잉 시스템

### 7. 임시 설정 — ✅ Admin 런타임 토글로 해결
- `/admin/config` 페이지에서 "절약/정상" 프리셋 토글로 전환
- 절약: Haiku + 15턴 + 200토큰, 정상: Sonnet + 20턴 + 512토큰
- 관계 기억 on/off 독립 토글
- `platform_config` 테이블 (마이그레이션 19번)

### 8. AI 역할 혼동 — 완화됨 + 관계 기억 1인칭 수정
- **증상**: AI가 자기 프로필 정보를 상대방의 것으로 착각하고 질문
- **원인**: system prompt에 자기 정보만 있고 상대가 누구인지 명시 안 됨 + Haiku의 약한 instruction following
- **완화**: `[역할]` 컨텍스트 추가. Sonnet 복원 시 크게 개선될 것으로 예상
- **추가 관찰 필요**: Haiku에서 "알지 못하는 것을 아는 척" 하는 문제 (예: 롤토체스를 모를 법한 clone이 설명하는 척)
- 관계 기억 추출 프롬프트를 3인칭 관찰자 → 1인칭 주관적 기억으로 변경

### 3. Stuck Interaction 방지 — 해결됨 (2026-04-13)
- **이전 증상**: Vercel 300초 타임아웃 또는 엔진 에러 시 status가 `running`으로 영구 남음
- **해결**:
  1. 엔진에 270초 타임아웃 가드 → 자동 `completed`
  2. `runInteraction` try/catch → 에러 시 `failed` 업데이트
  3. 10분+ stuck 시 재실행 허용
  4. Admin "Stuck 정리" 버튼 (1시간+ → failed 전환)

### 4. RLS 관련 404 — 해결됨 (2026-04-12~13)
- **이전 증상**: 상대가 시작한 interaction, 비공개 clone 상대 → 페이지 404
- **원인**: `interaction_is_mine` 함수가 `created_by`만 체크, `interactions` SELECT 정책에 참여자 누락, 비공개 clone RLS 차단
- **해결**: 마이그레이션 15~18로 3중 수정
  - `interaction_is_mine` 확장 (참여자 포함)
  - `interactions` SELECT 정책 추가
  - `clone_is_my_interaction_partner` SECURITY DEFINER 헬퍼

### 5. Supabase 이메일 매직링크 rate limit
- **우회책**: Google OAuth 로 로그인 (현재 주 로그인 수단)

### 6. 메모리 배너 간격 — ✅ 복원 완료
- `MemoryPromptBanner.tsx`의 `ONE_HOUR_MS` = `60 * 60 * 1000` (1시간)

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

### Clone Visibility + Notification ✅ 완료
- 유저 간 Clone 공개 (`is_public` + `public_fields` 컬럼)
- `/clones` 3섹션: 내 Clone → 커뮤니티 → NPC
- 필드별 프라이버시 칩 (편집 페이지 인라인)
- Pair picker에 커뮤니티 Clone 추가
- `/admin/interactions` 관리 대시보드 + Stuck 정리
- `/admin/clones` 관리 대시보드 (clone + 관련 interaction 삭제)
- Interaction 목록 "받은 요청" / "내가 시작한" 분리 + navbar 알림
- 알림 벨 (unread count + 드롭다운 + seen 처리)
- 인사 반복 방지 + 플랫폼 맥락 프롬프트 개선
- Spec: `docs/superpowers/specs/2026-04-12-clone-visibility-admin-interactions-design.md`
- Plan: `docs/superpowers/plans/2026-04-12-clone-visibility-admin-interactions.md`

### Phase 2-A ✅ 완료 — Implicit Persona Onboarding
- Clone 생성 후 시나리오(3) + 선택지(4) 퀴즈 온보딩 (2-3분)
- Haiku 1회 호출로 `InferredTraits` 추론 → `clones.inferred_traits` jsonb 저장
- 추론 결과 프리뷰 + 확인/재진행 UI
- System prompt에 inferred_traits 레이어 주입 (persona core 다음)
- Clone 상세 페이지에 traits 섹션 + 온보딩 CTA
- 에러 화면 (분석 실패 시 재시도/스킵 선택)
- Spec: `docs/superpowers/specs/2026-04-12-implicit-persona-clone-identity-design.md`
- Plan: `docs/superpowers/plans/2026-04-12-phase2a-implicit-persona-onboarding.md`

### UX 개선 ✅ 완료 (2026-04-13)
- 메모리 업데이트 유도 배너 (1시간 미접속 후 재방문)
- 랜덤 팁 배너 (세션별 1개)
- 온보딩 분석 중 스피너 + 에러 화면
- Admin interaction viewer 접근 (service client)

### Phase 2-B ✅ 완료 — Clone 관계 기억
- `clone_relationships` 테이블 (양방향, 1급 엔티티)
- Interaction 종료 후 양방향 관계 기억 자동 추출 (Haiku, 순차)
- 솔직한 내면 평가 원칙 (AI스러운 긍정 편향 억제)
- System prompt에 관계 기억 주입 + 역할 컨텍스트로 혼동 방지
- `after()` API로 Vercel 타임아웃과 분리 + fallback 추출 트리거
- 탭 UI (`MemoryTabs`)로 메모리/대화 기억 분리 표시 + 삭제 기능
- `FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY`로 on/off 가능
- Phase 3+에 주관적 평가 (`impression`, `affinity_score`) 확장
- Spec: `docs/superpowers/specs/2026-04-12-implicit-persona-clone-identity-design.md` 섹션 3
- Plan: `docs/superpowers/plans/2026-04-12-phase2b-clone-relationship-memory.md`
- Bugfix Plan: `docs/superpowers/plans/2026-04-13-role-clarity-and-reliable-extraction.md`

### 롤 매핑 + 추출 안정화 ✅ 완료 (2026-04-13)
- System prompt에 `[역할]` 컨텍스트 추가 (자신/상대 명시, 상대 직업·나이·MBTI 포함)
- 관계 기억 추출: `after()` + fallback API + 순차 실행
- JSON 파싱 강화: 마크다운 코드블록 제거, 토큰 한도 512→1024
- 프롬프트: memory item 최대 3개, detail 20자 제한

### P2 — Matching 기반 Batch Simulation
- Persona 기반 top-k 후보 선정 (태그 overlap → 나중에 embedding)
- 선정된 후보와 일괄 시뮬레이션 + 랭킹 뷰
- 분석 리포트 카테고리/시각화 확장

### 다음 작업 (우선순위)
- **개발 환경 agent 구축** — 위 "개발 환경 TODO" 4개 항목
- **super_meme NPC 클론** — 밈 문화 특화 NPC
- **전략 방향 결정** — 데이팅 매칭 vs 메타버스 (분석 문서 작성 완료)
- **메모리 compaction** — 메모리/관계 기억을 압축해서 system prompt에 더 많이 주입
- **관계 단계별 행동 규칙 확장** — 예: 친해진 사이면 농담 허용 범위 확대
- Interaction 후 자동 에피소드 메모리 추출
- 실제 프롬프트 출력 로깅 + 토큰 사용량 모니터링

### P2 — Matching 기반 Batch Simulation
- Persona 기반 top-k 후보 선정 (태그 overlap → 나중에 embedding)
- 선정된 후보와 일괄 시뮬레이션 + 랭킹 뷰
- 분석 리포트 카테고리/시각화 확장

### P3 — Quick wins 묶음
- Memory 편집/삭제 UI
- 관계 단계별 행동 규칙 확장 (예: 친해진 사이면 반말 허용)
- Clone 버전 관리 UI (`clones.version` 컬럼 존재, UI 없음)

### Phase 3 이후 (n-to-n, 메타버스)
- 3인 이상 그룹 상호작용
- 관계 그래프
- Clone 자율 상호작용 스케줄링
- 주관적 평가 + 호감도 추적
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
| Clone 데이터 필드 맵 | `docs/reference/clone-data-fields.md` |
| Phase 1 설계 스펙 | `docs/superpowers/specs/2026-04-11-phase1-digital-clone-design.md` |
| Phase 2 P0 설계 스펙 | `docs/superpowers/specs/2026-04-12-phase2-p0-realism-world-context-design.md` |
| Clone Visibility 설계 스펙 | `docs/superpowers/specs/2026-04-12-clone-visibility-admin-interactions-design.md` |
| Phase 2-A/2-B 설계 스펙 | `docs/superpowers/specs/2026-04-12-implicit-persona-clone-identity-design.md` |
| 전략 분석 (데이팅 vs 메타버스) | `docs/reference/strategic-analysis-dating-vs-metaverse.md` |
| 튜닝 가이드 | `docs/reference/tuning-guide.md` |
| Plan 문서 10개 | `docs/superpowers/plans/2026-04-*.md` |

---

## 개발 환경 TODO

프로젝트 개발과 직접 관련된 기능은 아니지만, 효율적 개발을 위해 갖춰야 할 도구들.

### 1. 대화 패턴 품질 평가 agent
- 클론 대화가 자연스러운지 판단하는 전문 agent
- 프롬프트 변경 전후 품질 비교
- 존댓말/반말 전환, 전문용어 사용, 기억 활용 등 체크

### 2. 토큰 최적화 리서치 agent
- 현재 턴당 ~4,600 토큰 → 최적화 여지 탐색
- VectorDB, RAG 등 기법 리서치 (기억 주입 방식 개선)
- Anthropic prompt caching 적용 (TEXTURE_RULES + BEHAVIOR가 입력의 55%)
- 메모리 compaction 전략 설계

### 3. 프롬프트 디버깅 agent
- Interaction 실행 시 실제 system prompt + messages 로깅
- 턴별 토큰 수/비용 트래킹
- 현재는 블랙박스 — 문제 발생 시 추측으로 디버깅 중

### 4. 자동 회귀 테스트 agent
- 프롬프트 변경 후 같은 클론 쌍으로 N번 대화 실행
- 품질 비교 자동화 (수동 확인 대체)
- A/B 테스트 프레임워크

---

## 다음 대화 시작 시 체크리스트

새 세션에서 이어서 작업할 때:

1. `CLAUDE.md` 자동 로드 — 프로젝트 비전·규칙 확보
2. **이 파일 (`docs/PROJECT_STATE.md`)** 먼저 읽기 — 현재 상태·이슈·백로그
3. 필요하면 관련 Skill 호출 (persona/interaction/db-schema)
4. **임시 설정 확인** — 현재 Haiku + 15턴 + 200 토큰. Sonnet 복원 시 "알려진 이슈 #7" 참조
5. **`FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY`** — 현재 `true`. 토큰 절약 시 `false`로
6. 튜닝 가이드: `docs/reference/tuning-guide.md`
7. 전략 분석: `docs/reference/strategic-analysis-dating-vs-metaverse.md`
8. 신규 작업은 항상 **기존 결정 재확인** ("재도전 금지" 섹션) 후 시작
