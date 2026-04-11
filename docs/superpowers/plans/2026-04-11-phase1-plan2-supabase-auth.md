# Phase 1 · Plan 2: Supabase DB + Auth + NPC Seed

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase **Cloud** 프로젝트 생성 및 링크, 8개 마이그레이션 (스키마 7개 + NPC seed 1개) 원격 적용, RLS 전부 활성화, `@supabase/ssr` 기반 서버/브라우저 클라이언트 분리, 매직링크 로그인 플로우 완성. 완료 시: Cloud Studio에서 7개 테이블 + NPC 5개 확인 가능, 로그인 페이지 → 실제 이메일 매직링크 → 인증된 세션 → `/clones` 리다이렉트.

**Architecture:** Supabase Cloud (managed Postgres + Auth + Realtime). Docker 불필요. `@supabase/ssr` 로 Next.js App Router 쿠키 기반 auth. Service role key는 서버 전용 (`lib/supabase/service.ts`), anon key + RLS는 사용자 컨텍스트 (`lib/supabase/server.ts`, `client.ts`). Next.js 16은 `proxy.ts` 사용 (not `middleware.ts`).

**Tech Stack:** Supabase CLI (원격 관리용), Supabase Cloud (free tier), `@supabase/supabase-js`, `@supabase/ssr`, Next.js 16 proxy.ts

**Spec Reference:** `docs/superpowers/specs/2026-04-11-phase1-digital-clone-design.md` §2 (데이터 모델), §3 (인증)

**Domain Skill:** `.claude/skills/db-schema/SKILL.md` — 테이블 구조, RLS 전략, n-to-n 확장 체크리스트

**Prerequisites (사용자가 직접 수행):**
- **Supabase 계정** — [supabase.com](https://supabase.com) 가입 (GitHub 계정으로 가능)
- **Supabase Cloud 프로젝트 1개 생성** (무료 티어)
- **Supabase CLI**: `brew install supabase/tap/supabase` (원격 프로젝트 링크·마이그레이션용)
- **Docker는 불필요** (Cloud 사용)

---

## File Structure

```
frontend/
├── .env.local.example                           [create] — 공개 템플릿
├── .env.local                                   [create, gitignored] — 실제 값
├── .gitignore                                   [modify] — .env.local, supabase/.temp
├── supabase/
│   ├── config.toml                              [auto, from `supabase init`]
│   └── migrations/
│       ├── 20260411000001_init_profiles.sql    [create]
│       ├── 20260411000002_init_clones.sql      [create]
│       ├── 20260411000003_init_clone_memories.sql [create]
│       ├── 20260411000004_init_interactions.sql   [create]
│       ├── 20260411000005_init_analyses.sql       [create]
│       ├── 20260411000006_enable_rls.sql          [create]
│       ├── 20260411000007_enable_realtime.sql     [create]
│       └── 20260411000008_seed_npc_clones.sql     [create] — NPC 5개를 마이그레이션으로 주입 (Cloud는 seed.sql 자동 실행 안 함)
├── src/
│   ├── lib/supabase/
│   │   ├── server.ts                            [create] — Server Component 클라이언트
│   │   ├── client.ts                            [create] — 브라우저 클라이언트
│   │   ├── service.ts                           [create] — service role (서버 전용)
│   │   └── proxy.ts                             [create] — 세션 리프레시 헬퍼
│   ├── types/
│   │   └── database.ts                          [create, optional] — generated types
│   └── app/
│       ├── layout.tsx                           [modify] — AuthProvider 제거 (SSR 방식)
│       ├── proxy.ts                             [create] — Next.js 16 proxy (auth gate)
│       ├── page.tsx                             [modify] — 로그인 or /clones 리다이렉트
│       ├── login/
│       │   └── page.tsx                         [create] — 매직링크 폼
│       └── auth/callback/
│           └── route.ts                         [create] — 매직링크 콜백
```

---

## Milestone A: Supabase Cloud 설정

### Task A1: Cloud 프로젝트 생성 (사용자 수행)

**(자동화 불가 — 사용자가 브라우저에서 직접 수행)**

- [ ] **Step 1: Supabase 가입/로그인**

브라우저에서 [supabase.com](https://supabase.com) → 로그인/가입 (GitHub 계정 권장).

- [ ] **Step 2: 새 프로젝트 생성**

Dashboard → "New project"
- **Name**: `digital-clone-platform` (자유)
- **Database Password**: 강한 패스워드 생성 후 **반드시 기록** (비밀번호는 나중에 복구 어려움)
- **Region**: `Northeast Asia (Seoul)` 권장
- **Pricing Plan**: Free

생성에 1-2분 소요.

- [ ] **Step 3: 프로젝트 자격증명 기록**

프로젝트 대시보드 → Settings → API 에서 다음 값 복사:
- **Project URL** (예: `https://abcdefghij.supabase.co`)
- **Project Reference ID** (URL 앞부분, 예: `abcdefghij`)
- **anon / public key** (긴 JWT)
- **service_role / secret key** (긴 JWT, **서버 전용**)

네 값 모두 안전한 곳에 기록.

---

### Task A2: Supabase CLI 설치 & 프로젝트 링크

**Files:**
- Create: `frontend/supabase/config.toml` (via `supabase init`)

- [ ] **Step 1: CLI 설치 확인**

Run: `supabase --version`
Expected: 버전 출력. 없으면 설치:
```bash
brew install supabase/tap/supabase
```

- [ ] **Step 2: CLI 로그인**

Run: `supabase login`
Expected: 브라우저로 리다이렉트 → 인증 → "Finished supabase login" 메시지.

- [ ] **Step 3: 프로젝트 초기화**

Run (in `frontend/`): `supabase init`
Expected: `frontend/supabase/config.toml` 생성. 프롬프트는 기본값(N) 선택.

- [ ] **Step 4: 원격 프로젝트 링크**

Run (in `frontend/`): `supabase link --project-ref <A1에서 기록한 Project Reference ID>`

프롬프트로 DB password 요구 시 A1에서 기록한 값 입력.
Expected: "Finished supabase link" 또는 유사 메시지.

- [ ] **Step 5: Commit**

```bash
git add frontend/supabase/
git commit -m "chore: initialize supabase project and link to cloud"
```

---

### Task A3: 환경변수 설정

**Files:**
- Create: `frontend/.env.local.example`
- Create: `frontend/.env.local`
- Modify: `frontend/.gitignore`

- [ ] **Step 1: .env.local.example 작성**

```
# Supabase (cloud)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Anthropic (Plan 4에서 사용)
ANTHROPIC_API_KEY=your-anthropic-key-here
```

- [ ] **Step 2: .env.local 작성**

Task A1에서 기록한 **실제 Cloud 값**을 붙여넣기:
```
NEXT_PUBLIC_SUPABASE_URL=<A1 Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<A1 anon key>
SUPABASE_SERVICE_ROLE_KEY=<A1 service_role key>
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: .gitignore 확인·보강**

`frontend/.gitignore`에 다음이 있는지 확인, 없으면 추가:
```
# local env
.env.local
.env*.local

# supabase
supabase/.temp/
supabase/.branches/
```

- [ ] **Step 4: Commit (실제 키는 .env.local 이라 제외됨)**

```bash
git add frontend/.env.local.example frontend/.gitignore
git commit -m "chore: add .env.local.example and gitignore supabase artifacts"
```

---

## Milestone B: 마이그레이션 SQL

각 마이그레이션은 독립 파일. `supabase migration new <name>` 대신 **수동 생성**(타임스탬프 정확히 맞추기 위해).

### Task B1: profiles 테이블

**Files:**
- Create: `frontend/supabase/migrations/20260411000001_init_profiles.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 20260411000001_init_profiles.sql
-- Supabase Auth의 auth.users 확장 프로필
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'User profile extensions for auth.users';

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: 마이그레이션 Cloud 적용**

Run (in `frontend/`): `supabase db push`
Expected: 새 마이그레이션을 Cloud에 적용, "Applying migration ..." 출력, 에러 없음.

- [ ] **Step 3: Cloud Studio에서 테이블 확인**

브라우저에서 Supabase 프로젝트 대시보드 → Table Editor → `public.profiles` 존재 확인.

- [ ] **Step 4: Commit**

```bash
git add frontend/supabase/migrations/20260411000001_init_profiles.sql
git commit -m "feat(db): add profiles table and updated_at trigger"
```

---

### Task B2: clones 테이블

**Files:**
- Create: `frontend/supabase/migrations/20260411000002_init_clones.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 20260411000002_init_clones.sql
create table public.clones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  is_npc boolean not null default false,
  version int not null default 1,
  name text not null,
  persona_json jsonb not null,
  system_prompt text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- NPC는 user_id가 null, 일반 Clone은 필수
  constraint clones_user_xor_npc check (
    (is_npc = true and user_id is null) or
    (is_npc = false and user_id is not null)
  )
);

create index clones_user_id_idx on public.clones(user_id) where deleted_at is null;
create index clones_is_npc_idx on public.clones(is_npc) where deleted_at is null;
create index clones_persona_gin on public.clones using gin (persona_json);

create trigger clones_set_updated_at
  before update on public.clones
  for each row execute function public.set_updated_at();

comment on table public.clones is 'Digital clone personas (user-owned or NPC)';
```

- [ ] **Step 2: 재적용**

Run: `supabase db push`
Expected: 에러 없음.

- [ ] **Step 3: Studio에서 확인**

`public.clones` 존재, 컬럼 매치 확인.

- [ ] **Step 4: Commit**

```bash
git add frontend/supabase/migrations/20260411000002_init_clones.sql
git commit -m "feat(db): add clones table with is_npc flag and constraint"
```

---

### Task B3: clone_memories 테이블

**Files:**
- Create: `frontend/supabase/migrations/20260411000003_init_clone_memories.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 20260411000003_init_clone_memories.sql
create table public.clone_memories (
  id uuid primary key default gen_random_uuid(),
  clone_id uuid not null references public.clones(id) on delete cascade,
  kind text not null check (kind in ('event', 'mood', 'fact', 'preference_update')),
  content text not null,
  tags text[] not null default '{}',
  occurred_at timestamptz not null,
  relevance_score numeric,
  created_at timestamptz not null default now()
);

create index clone_memories_clone_occurred_idx
  on public.clone_memories(clone_id, occurred_at desc);
create index clone_memories_tags_gin
  on public.clone_memories using gin (tags);

comment on table public.clone_memories is 'Episodic memories for clones (natural-language updates)';
```

- [ ] **Step 2: 재적용 + Studio 확인**

Run: `supabase db push`

- [ ] **Step 3: Commit**

```bash
git add frontend/supabase/migrations/20260411000003_init_clone_memories.sql
git commit -m "feat(db): add clone_memories table"
```

---

### Task B4: interactions + participants + events

**Files:**
- Create: `frontend/supabase/migrations/20260411000004_init_interactions.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 20260411000004_init_interactions.sql
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  scenario text not null,
  setting text,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed','cancelled')),
  max_turns int not null default 20,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index interactions_status_idx on public.interactions(status);
create index interactions_created_by_idx on public.interactions(created_by);

comment on table public.interactions is 'Interaction sessions between clones (n-to-n ready)';

create table public.interaction_participants (
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  clone_id uuid not null references public.clones(id) on delete cascade,
  role text,
  joined_at timestamptz not null default now(),
  primary key (interaction_id, clone_id)
);

create index interaction_participants_clone_idx
  on public.interaction_participants(clone_id);

comment on table public.interaction_participants is 'Join table for clones in interactions';

create table public.interaction_events (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  turn_number int not null,
  speaker_clone_id uuid not null references public.clones(id),
  content text not null,
  created_at timestamptz not null default now(),
  unique (interaction_id, turn_number)
);

create index interaction_events_interaction_turn_idx
  on public.interaction_events(interaction_id, turn_number);

comment on table public.interaction_events is 'Individual turns (messages) in an interaction';
```

- [ ] **Step 2: 재적용 + Studio 확인**

Run: `supabase db push`
Expected: 3개 테이블(`interactions`, `interaction_participants`, `interaction_events`) 생성.

- [ ] **Step 3: Commit**

```bash
git add frontend/supabase/migrations/20260411000004_init_interactions.sql
git commit -m "feat(db): add interactions, participants, events tables"
```

---

### Task B5: analyses 테이블

**Files:**
- Create: `frontend/supabase/migrations/20260411000005_init_analyses.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 20260411000005_init_analyses.sql
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  score int not null check (score between 0 and 100),
  report_json jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index analyses_interaction_idx on public.analyses(interaction_id);
create unique index analyses_interaction_unique_idx
  on public.analyses(interaction_id);

comment on table public.analyses is 'Compatibility analysis reports for interactions (cached)';
```

- [ ] **Step 2: 재적용 + 확인**

Run: `supabase db push`

- [ ] **Step 3: Commit**

```bash
git add frontend/supabase/migrations/20260411000005_init_analyses.sql
git commit -m "feat(db): add analyses table with unique interaction constraint"
```

---

## Milestone C: RLS 정책

### Task C1: RLS enable + 정책

**Files:**
- Create: `frontend/supabase/migrations/20260411000006_enable_rls.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 20260411000006_enable_rls.sql

-- profiles
alter table public.profiles enable row level security;

create policy "profiles_owner_select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_owner_upsert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_owner_update" on public.profiles
  for update using (auth.uid() = id);

-- clones
alter table public.clones enable row level security;

-- NPC: 모든 인증 사용자가 읽기 가능
create policy "clones_npc_read" on public.clones
  for select using (is_npc = true and deleted_at is null);

-- 본인 소유 Clone: 전체 권한
create policy "clones_owner_all" on public.clones
  for all using (
    is_npc = false
    and user_id = auth.uid()
    and deleted_at is null
  );

-- clone_memories
alter table public.clone_memories enable row level security;

create policy "clone_memories_owner_all" on public.clone_memories
  for all using (
    exists (
      select 1 from public.clones c
      where c.id = clone_memories.clone_id
        and c.user_id = auth.uid()
    )
  );

-- interactions
alter table public.interactions enable row level security;

-- 참여한 Clone 소유자만 조회
create policy "interactions_participant_select" on public.interactions
  for select using (
    exists (
      select 1 from public.interaction_participants ip
      join public.clones c on c.id = ip.clone_id
      where ip.interaction_id = interactions.id
        and c.user_id = auth.uid()
    )
  );

-- 생성자만 쓰기
create policy "interactions_creator_all" on public.interactions
  for all using (created_by = auth.uid());

-- interaction_participants
alter table public.interaction_participants enable row level security;

create policy "interaction_participants_participant_select" on public.interaction_participants
  for select using (
    exists (
      select 1 from public.clones c
      where c.id = interaction_participants.clone_id
        and c.user_id = auth.uid()
    )
    or exists (
      select 1 from public.interactions i
      where i.id = interaction_participants.interaction_id
        and i.created_by = auth.uid()
    )
  );

create policy "interaction_participants_creator_insert" on public.interaction_participants
  for insert with check (
    exists (
      select 1 from public.interactions i
      where i.id = interaction_participants.interaction_id
        and i.created_by = auth.uid()
    )
  );

-- interaction_events (서버가 service role로 씀, 사용자는 읽기만)
alter table public.interaction_events enable row level security;

create policy "interaction_events_participant_select" on public.interaction_events
  for select using (
    exists (
      select 1 from public.interaction_participants ip
      join public.clones c on c.id = ip.clone_id
      where ip.interaction_id = interaction_events.interaction_id
        and c.user_id = auth.uid()
    )
    or exists (
      select 1 from public.interactions i
      where i.id = interaction_events.interaction_id
        and i.created_by = auth.uid()
    )
  );

-- analyses (서버가 service role로 씀, 사용자는 읽기만)
alter table public.analyses enable row level security;

create policy "analyses_participant_select" on public.analyses
  for select using (
    exists (
      select 1 from public.interaction_participants ip
      join public.clones c on c.id = ip.clone_id
      where ip.interaction_id = analyses.interaction_id
        and c.user_id = auth.uid()
    )
    or exists (
      select 1 from public.interactions i
      where i.id = analyses.interaction_id
        and i.created_by = auth.uid()
    )
  );
```

- [ ] **Step 2: 재적용**

Run: `supabase db push`
Expected: 에러 없이 모든 정책 생성.

- [ ] **Step 3: Studio에서 정책 확인**

Studio → Authentication → Policies 에서 각 테이블별 정책이 보여야 함.

- [ ] **Step 4: Commit**

```bash
git add frontend/supabase/migrations/20260411000006_enable_rls.sql
git commit -m "feat(db): enable RLS and add policies for all tables"
```

---

## Milestone D: Realtime + Seed

### Task D1: Realtime publication

**Files:**
- Create: `frontend/supabase/migrations/20260411000007_enable_realtime.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 20260411000007_enable_realtime.sql
-- Realtime publication 에 interaction_events 추가
alter publication supabase_realtime add table public.interaction_events;

-- interactions 테이블도 status 변경 감지용으로 추가
alter publication supabase_realtime add table public.interactions;
```

- [ ] **Step 2: 재적용**

Run: `supabase db push`

- [ ] **Step 3: Commit**

```bash
git add frontend/supabase/migrations/20260411000007_enable_realtime.sql
git commit -m "feat(db): enable realtime for interaction_events and interactions"
```

---

### Task D2: NPC seed (마이그레이션 방식)

**Files:**
- Create: `frontend/supabase/migrations/20260411000008_seed_npc_clones.sql`

**왜 마이그레이션인가**: Supabase Cloud에서는 `seed.sql`이 자동 실행되지 않음 (`supabase db reset --linked`를 명시 호출해야 함, 이는 DB 파괴적). NPC는 **reference data**(불변 seed)이므로 마이그레이션에 두어 `supabase db push` 시 한 번 적용되면 충분. 이후 유저 데이터가 쌓여도 영향 없음.

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 20260411000008_seed_npc_clones.sql
-- NPC 5개: 지민, 태현, 서연, 민재, 하린
-- 각 NPC는 is_npc=true, user_id=null
-- ON CONFLICT DO NOTHING — 재실행 안전

insert into public.clones (id, is_npc, user_id, name, persona_json, is_active)
values
(
  '00000000-0000-0000-0000-000000000001',
  true, null, '지민',
  jsonb_build_object(
    'name', '지민',
    'age', 28,
    'gender', '여성',
    'location', '서울 마포구',
    'occupation', '프로덕트 디자이너',
    'education', '대학교 졸업, 디자인 전공',
    'languages', array['한국어', '영어']::text[],
    'mbti', 'INFJ',
    'personality_traits', array['내향적', '호기심 많음', '계획적', '공감력 높음']::text[],
    'strengths', array['경청', '깊이 있는 대화', '섬세함']::text[],
    'weaknesses', array['결정 지연', '피로 누적']::text[],
    'humor_style', '드라이한 유머, 말장난 좋아함',
    'emotional_expression', '감정 표현 서툼, 글로는 솔직해짐',
    'core_values', array['진정성', '성장', '깊이']::text[],
    'life_philosophy', '천천히, 그러나 꾸준히',
    'dealbreakers', array['무례함', '거짓말']::text[],
    'hobbies', array['독서', '요가', '영화감상', '카페 탐방']::text[],
    'favorite_media', jsonb_build_object(
      'movies', array['패터슨', '이터널 선샤인']::text[],
      'books', array['미드나잇 라이브러리', '인간실격']::text[],
      'music', array['재즈', '로파이']::text[],
      'games', null
    ),
    'food_preferences', array['파스타', '샐러드', '커피']::text[],
    'travel_style', '조용한 곳 선호, 혼자 여행도 좋아함',
    'background_story', '어린 시절 책 속에서 자람. 대학에서 디자인을 만나 인생이 바뀜.',
    'daily_routine', '아침 요가 → 카페에서 작업 → 저녁 산책',
    'sleep_schedule', '12시 취침, 7시 기상',
    'exercise_habits', '주 3회 요가',
    'living_situation', '1인 가구',
    'communication_style', '초반엔 조심스럽지만 친해지면 솔직해짐. 긴 메시지를 선호.',
    'conversation_preferences', array['깊은 대화', '책·영화 이야기', '조용한 분위기']::text[],
    'texting_style', '이모지 적게, 맞춤법 꼼꼼',
    'response_speed', '느긋한 편',
    'long_term_goals', array['독립 스튜디오 운영', '글쓰기']::text[],
    'what_seeking_in_others', '함께 성장할 수 있는 사람',
    'self_description', '조용하지만 호기심이 많고, 깊은 대화를 선호함.',
    'tags', array['내향', '감성', '디자이너']::text[]
  ),
  true
),
(
  '00000000-0000-0000-0000-000000000002',
  true, null, '태현',
  jsonb_build_object(
    'name', '태현',
    'age', 32,
    'gender', '남성',
    'location', '서울 강남구',
    'occupation', '스타트업 창업자',
    'education', '대학교 졸업, 경영학 전공',
    'languages', array['한국어', '영어']::text[],
    'mbti', 'ENTJ',
    'personality_traits', array['외향적', '직설적', '목표 지향', '리더십']::text[],
    'strengths', array['결단력', '비전 제시', '실행력']::text[],
    'weaknesses', array['성급함', '감정 표현 서툼']::text[],
    'humor_style', '유머 감각 있지만 비즈니스 위주',
    'emotional_expression', '직접적이고 솔직',
    'core_values', array['성장', '효율', '성취']::text[],
    'life_philosophy', '크게 생각하고 빠르게 움직여라',
    'dealbreakers', array['게으름', '부정적 태도']::text[],
    'hobbies', array['골프', '러닝', '독서(비즈니스)', '와인']::text[],
    'favorite_media', jsonb_build_object(
      'movies', array['소셜 네트워크', '위대한 개츠비']::text[],
      'books', array['제로투원', '린 스타트업']::text[],
      'music', array['팝', '재즈']::text[],
      'games', null
    ),
    'food_preferences', array['스테이크', '일식', '와인']::text[],
    'travel_style', '유럽 도시 여행, 비즈니스 겸 레저',
    'background_story', '대학 때부터 여러 사업 시도. 현재 두 번째 창업.',
    'daily_routine', '5시 기상 → 러닝 → 미팅 → 저녁 네트워킹',
    'exercise_habits', '매일 아침 러닝, 주말 골프',
    'living_situation', '1인 가구',
    'communication_style', '직설적, 핵심만. 긴 잡담 비선호.',
    'conversation_preferences', array['비즈니스', '도전과 성장', '아이디어']::text[],
    'texting_style', '짧고 명료, 이모지 거의 안 씀',
    'response_speed', '빠름',
    'long_term_goals', array['IPO', '글로벌 진출']::text[],
    'what_seeking_in_others', '자기 세계가 분명한 사람',
    'self_description', '도전을 좋아하고 빠른 의사결정을 추구함.',
    'tags', array['외향', '창업가', '직설적']::text[]
  ),
  true
),
(
  '00000000-0000-0000-0000-000000000003',
  true, null, '서연',
  jsonb_build_object(
    'name', '서연',
    'age', 26,
    'gender', '여성',
    'location', '제주도',
    'occupation', '프리랜서 일러스트레이터',
    'languages', array['한국어']::text[],
    'mbti', 'ENFP',
    'personality_traits', array['즉흥적', '감정 풍부', '창의적', '낙천적']::text[],
    'strengths', array['공감', '열정', '아이디어']::text[],
    'weaknesses', array['산만함', '감정 기복']::text[],
    'humor_style', '감정 섞인 유머, 잘 웃김',
    'emotional_expression', '감정 표현 풍부, 솔직',
    'core_values', array['자유', '창의', '경험']::text[],
    'dealbreakers', array['통제', '비판적 태도']::text[],
    'hobbies', array['그림', '서핑', '여행', '페스티벌']::text[],
    'favorite_media', jsonb_build_object(
      'movies', array['어바웃 타임', '인사이드 아웃']::text[],
      'books', array['나미야 잡화점의 기적']::text[],
      'music', array['인디', '포크']::text[],
      'games', null
    ),
    'food_preferences', array['한식', '디저트']::text[],
    'travel_style', '즉흥적, 배낭여행',
    'background_story', '미술대학 졸업 후 제주로 이주. 프리랜서로 정착.',
    'daily_routine', '늦게 일어나 작업, 밤에 영감을 얻음',
    'sleep_schedule', '불규칙',
    'living_situation', '제주 독채',
    'pets', '고양이 한 마리',
    'communication_style', '말이 많고 감정 풍부. 이모지 많음.',
    'conversation_preferences', array['재미있는 이야기', '여행', '창작']::text[],
    'texting_style', '이모지 많음, 감탄사 많음',
    'response_speed', '기분에 따라',
    'short_term_goals', array['전시회 개최']::text[],
    'what_seeking_in_others', '함께 놀아줄 수 있는 사람',
    'self_description', '감정에 솔직하고 자유로운 영혼',
    'tags', array['예술가', '즉흥', '감성']::text[]
  ),
  true
),
(
  '00000000-0000-0000-0000-000000000004',
  true, null, '민재',
  jsonb_build_object(
    'name', '민재',
    'age', 30,
    'gender', '남성',
    'location', '서울 송파구',
    'occupation', '의대 레지던트',
    'education', '의과대학 졸업',
    'languages', array['한국어', '영어']::text[],
    'mbti', 'ISTJ',
    'personality_traits', array['책임감', '신중', '차분', '계획적']::text[],
    'strengths', array['신뢰감', '일관성', '전문성']::text[],
    'weaknesses', array['유연성 부족', '피로 누적']::text[],
    'humor_style', '건조하고 차분한 유머',
    'emotional_expression', '감정 표현 절제, 내면으로 소화',
    'core_values', array['책임', '가족', '안정']::text[],
    'dealbreakers', array['무책임', '거짓말']::text[],
    'hobbies', array['등산', '요리', '다큐멘터리']::text[],
    'food_preferences', array['한식', '건강식']::text[],
    'background_story', '성실한 가정에서 자람. 어릴 때부터 의사가 꿈.',
    'daily_routine', '병원 근무로 불규칙',
    'exercise_habits', '가능할 때 주말 등산',
    'family_description', '부모님, 동생 1명',
    'living_situation', '가족과 거주',
    'communication_style', '신중하고 차분. 생각 후 말함.',
    'conversation_preferences', array['의미 있는 대화', '가족', '미래']::text[],
    'texting_style', '짧고 단정',
    'response_speed', '근무 중엔 느림',
    'long_term_goals', array['개원', '가정 꾸리기']::text[],
    'relationship_goal', '진지한 연애, 결혼 전제',
    'self_description', '진중하고 책임감 있는 사람.',
    'tags', array['의사', '성실', '진중']::text[]
  ),
  true
),
(
  '00000000-0000-0000-0000-000000000005',
  true, null, '하린',
  jsonb_build_object(
    'name', '하린',
    'age', 29,
    'gender', '여성',
    'location', '서울 성북구',
    'occupation', '환경 NGO 활동가',
    'education', '대학원 환경학',
    'languages', array['한국어', '영어']::text[],
    'mbti', 'INFP',
    'personality_traits', array['이상주의', '섬세', '가치 지향', '예민']::text[],
    'strengths', array['공감', '헌신', '깊은 사고']::text[],
    'weaknesses', array['실망 쉬움', '번아웃 주의']::text[],
    'humor_style', '따뜻하고 위트 있음',
    'core_values', array['정의', '환경', '연대']::text[],
    'beliefs', array['비건 지향', '소비 최소화']::text[],
    'dealbreakers', array['환경 파괴적 라이프스타일', '무관심']::text[],
    'hobbies', array['가드닝', '글쓰기', '다큐 감상']::text[],
    'food_preferences', array['채식', '유기농']::text[],
    'diet', '비건 지향',
    'travel_style', '에코 투어',
    'background_story', '대학 때 환경 동아리에서 전환점. 석사 후 NGO 입사.',
    'living_situation', '공유주택',
    'communication_style', '부드럽지만 가치관 관련해선 단호. 긴 메시지 선호.',
    'conversation_preferences', array['가치관', '사회 이슈', '책']::text[],
    'texting_style', '정성스러움, 문장 완결형',
    'response_speed', '느긋',
    'long_term_goals', array['환경 정책 영향력 확대']::text[],
    'what_seeking_in_others', '가치관을 존중해주는 사람',
    'self_description', '가치에 충실하고 따뜻함을 잃지 않으려 노력.',
    'tags', array['활동가', '가치 드리븐', '비건']::text[]
  ),
  true
)
on conflict (id) do nothing;
```

**중요**: `insert ... values (...)`의 마지막 행 괄호 뒤에 (세미콜론 대신) `on conflict (id) do nothing;` 를 추가한 것. 위 예시 5개 NPC 블록 전체 뒤에 붙인다. 이렇게 하면 이미 존재하는 UUID는 건너뛰어 재실행 안전.

- [ ] **Step 2: Cloud 적용**

Run (in `frontend/`): `supabase db push`
Expected: `Applying migration 20260411000008_seed_npc_clones.sql` 출력.

- [ ] **Step 3: Cloud Studio에서 확인**

Supabase 프로젝트 대시보드 → Table Editor → `clones`. 5개 행이 `is_npc=true`, `user_id=null`, `name` 필드에 지민/태현/서연/민재/하린 보여야 함.

- [ ] **Step 4: Commit**

```bash
git add frontend/supabase/migrations/20260411000008_seed_npc_clones.sql
git commit -m "feat(db): seed 5 NPC clones via migration (idempotent)"
```

---

## Milestone E: Supabase 클라이언트

### Task E1: 브라우저 클라이언트

**Files:**
- Create: `frontend/src/lib/supabase/client.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/supabase/client.ts
git commit -m "feat: add browser Supabase client"
```

---

### Task E2: 서버 컴포넌트 클라이언트

**Files:**
- Create: `frontend/src/lib/supabase/server.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 에서 호출된 경우 setAll 무시 (proxy에서 처리)
          }
        },
      },
    }
  )
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/supabase/server.ts
git commit -m "feat: add server Supabase client with cookie store"
```

---

### Task E3: Service role 클라이언트

**Files:**
- Create: `frontend/src/lib/supabase/service.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/supabase/service.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service role client — bypasses RLS.
 * ONLY use in server-side code (API routes, Route Handlers).
 * Never import from client components.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
```

- [ ] **Step 2: typecheck**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/supabase/service.ts
git commit -m "feat: add service role Supabase client for server-only writes"
```

---

### Task E4: Proxy 헬퍼

**Files:**
- Create: `frontend/src/lib/supabase/proxy.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/lib/supabase/proxy.ts
// Session refresh helper — called from app/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: DO NOT remove — refreshes session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 로그인 필요 페이지 가드
  const pathname = request.nextUrl.pathname
  const isProtected =
    pathname.startsWith('/clones') ||
    pathname.startsWith('/interactions') ||
    pathname.startsWith('/analyses')
  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/auth')

  if (!user && isProtected && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/clones'
    return NextResponse.redirect(url)
  }

  return response
}
```

- [ ] **Step 2: typecheck**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/supabase/proxy.ts
git commit -m "feat: add Supabase session refresh helper with auth gate"
```

---

## Milestone F: Auth 페이지 & Proxy

### Task F1: Next.js 16 proxy.ts

**Files:**
- Create: `frontend/src/proxy.ts`

- [ ] **Step 1: 파일 작성**

Next.js 16에서는 `middleware.ts` 대신 `proxy.ts` 사용.

```ts
// frontend/src/proxy.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image
     * - favicon.ico
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: typecheck**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/proxy.ts
git commit -m "feat: add Next.js 16 proxy.ts for session refresh and auth gate"
```

---

### Task F2: 로그인 페이지 (매직링크)

**Files:**
- Create: `frontend/src/app/login/page.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
// frontend/src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          이메일로 매직링크를 받아 로그인하세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === 'sending' || status === 'sent'}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={status === 'sending' || status === 'sent'}
          >
            {status === 'sending' ? '전송 중...' : '매직링크 보내기'}
          </Button>

          {status === 'sent' && (
            <p className="text-sm text-green-600">
              ✓ {email} 로 매직링크를 보냈습니다. 이메일을 확인하세요.
            </p>
          )}

          {status === 'error' && (
            <p className="text-sm text-destructive">✗ {errorMsg}</p>
          )}
        </form>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: typecheck**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/login/page.tsx
git commit -m "feat: add login page with Supabase magic link"
```

---

### Task F3: Auth 콜백

**Files:**
- Create: `frontend/src/app/auth/callback/route.ts`

- [ ] **Step 1: 파일 작성**

```ts
// frontend/src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/clones'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

- [ ] **Step 2: typecheck**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/auth/callback/route.ts
git commit -m "feat: add auth callback route for magic link exchange"
```

---

### Task F4: 랜딩 페이지 리다이렉트

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: 파일 교체**

```tsx
// frontend/src/app/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/clones')
  } else {
    redirect('/login')
  }
}
```

- [ ] **Step 2: typecheck**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: root page redirects based on auth state"
```

---

### Task F5: /clones 스텁

**Files:**
- Create: `frontend/src/app/clones/page.tsx`

- [ ] **Step 1: 스텁 페이지 작성** (Plan 3에서 실제 구현)

```tsx
// frontend/src/app/clones/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function ClonesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold">Clones</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          로그인됨: {user?.email ?? '(unknown)'}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Plan 3에서 Clone 목록·생성 UI가 여기에 채워집니다.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: typecheck + build 확인**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/clones/page.tsx
git commit -m "feat: add /clones stub page with auth display"
```

---

## Milestone G: 수동 검증

### Task G1: 전체 플로우 확인

**(사용자가 직접 수행하는 브라우저 검증 단계)**

- [ ] **Step 1: dev 서버 기동**

Run: `cd frontend && npm run dev`

- [ ] **Step 2: 미인증 접근 테스트**

브라우저에서 `http://localhost:3000` 접속.
Expected: `/login` 으로 자동 리다이렉트.

`http://localhost:3000/clones` 접속.
Expected: `/login` 으로 자동 리다이렉트 (proxy 동작 증명).

- [ ] **Step 3: 매직링크 테스트**

`/login` 에서 본인 이메일 입력 → "매직링크 보내기"
Expected: "매직링크를 보냈습니다" 메시지.

Supabase Cloud는 **실제 이메일을 발송**합니다. 본인 이메일 수신함 확인 → 매직링크 이메일 ("Confirm your signup" 또는 "Sign in to ...") → "Log In" 또는 "Confirm your email" 링크 클릭.

> 만약 이메일이 스팸함에 있거나 10분이 지나도 안 오면: Cloud 프로젝트 대시보드 → Authentication → Providers → Email 설정 확인. 또는 Authentication → Users 에서 수동으로 사용자 생성 테스트.

- [ ] **Step 4: 인증 후 리다이렉트 확인**

매직링크 클릭 후:
Expected: `/clones` 페이지로 이동, "로그인됨: your@email.com" 표시.

- [ ] **Step 5: Studio에서 auth.users 확인**

Supabase 프로젝트 대시보드 → Authentication → Users. 본인 이메일이 목록에 있어야 함.

- [ ] **Step 6: NPC 확인**

Studio → Table Editor → `clones`. 5명 NPC 보이는지 확인.

- [ ] **Step 7: 로그아웃 테스트 (수동, 아직 UI 없음)**

Studio → Authentication → Users → 본인 유저 → "Delete user" 또는 브라우저 쿠키 삭제.
이후 `/clones` 접근 → `/login` 리다이렉트 확인.

---

### Task G2: Plan 2 완료 태그

- [ ] **Step 1: 테스트 회귀 확인**

Run: `npm run test:run`
Expected: 45 passed (Plan 1 테스트 여전히 녹색)

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 3: 태그**

```bash
git tag plan2-supabase-complete
git log --oneline feat/phase1-plan1-foundation | head -30
```

---

## Self-Review Notes

**Spec coverage** (Phase 1 spec §2, §3 인증 부분):
- ✅ profiles, clones (+is_npc), clone_memories, interactions (+ participants, events), analyses 테이블 (B1-B5)
- ✅ RLS 정책 (C1)
- ✅ Realtime publication (D1)
- ✅ NPC 5개 seed (D2)
- ✅ `@supabase/ssr` 클라이언트 분리 (E1-E4)
- ✅ Next.js 16 proxy.ts (F1)
- ✅ 매직링크 로그인 + 콜백 (F2, F3)
- ✅ Auth gate (proxy 내 보호 경로 검증)

**Placeholder scan**: 모든 SQL·코드 완전. NPC 페르소나도 구체 값.

**Type consistency**:
- `clones.persona_json` jsonb ↔ `types/persona.ts` `Persona` 매치
- `interaction_events` 필드 (turn_number, speaker_clone_id, content) 는 Plan 1 TypeScript 타입과 일치
- `analyses.report_json` ↔ `types/analysis.ts` `AnalysisReport`

**Risks flagged:**
1. **Next.js 16 proxy.ts**: 최신 API. 만약 `proxy.ts` 가 미지원이면 `middleware.ts`로 폴백 (동일 내용).
2. **Cloud 프로젝트 자격증명 관리**: `SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하므로 절대 클라이언트에 노출 금지. 서버 코드(`lib/supabase/service.ts`)에서만 사용.
3. **실제 이메일 발송 한도**: Supabase 무료 티어는 시간당 이메일 발송 제한 있음. 테스트 반복 시 주의.
4. **persona_json 스키마 진화**: JSONB라 마이그레이션 없이 필드 추가 가능. 단 체크 제약 없음 (Zod로 런타임 검증).
5. **마이그레이션 롤백 어려움**: `supabase db push`는 Cloud DB에 직접 적용. 잘못된 마이그레이션은 새 마이그레이션으로 수정해야 함 (프로덕션 롤백 복잡). Plan 2 실행 중엔 신규 프로젝트라 부담 적음.

---

## 다음 Plan 개요 (Plan 3-5 참고)

### Plan 3: Clone CRUD + Persona UI
- `GET/POST/PATCH/DELETE /api/clones` 라우트
- Zod 스키마 (Persona 검증)
- `PersonaQuickForm`, `PersonaFullEditor`, `PersonaSection` (10 카테고리 섹션 재사용)
- `/clones`, `/clones/new`, `/clones/[id]`, `/clones/[id]/edit`
- 낙관적 업데이트 + 에러 핸들링 + 스켈레톤

### Plan 4: Interaction Engine + Realtime Viewer
- `lib/claude.ts` Anthropic SDK 래퍼 (재시도·타임아웃)
- `lib/interaction/engine.ts` (20턴 orchestrator, 순수 함수 조합)
- `POST /api/interactions` (동기 실행, 300s 내 완료)
- `/interactions/new`, `/interactions/[id]` 뷰어
- `InteractionPairPicker`, `InteractionViewer`, `TypingIndicator`, `ConnectionStatus`
- Realtime 구독 + Heartbeat + 진행률 (§8 로딩 UX)

### Plan 5: Memory + Analysis
- `POST /api/memories` (자연어 → haiku 추출)
- `POST /api/analyses` (대화 로그 → sonnet 분석, 캐시)
- `MemoryInputBox`, `MemoryTimeline`
- `AnalysisReport`, `ScoreBar`, `CategoryCard`
- Clone 상세 페이지 완성 (메모리 타임라인 + 입력)
- Analysis 페이지 (수동 트리거)
