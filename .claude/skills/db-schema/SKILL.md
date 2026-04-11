---
name: db-schema
description: Supabase PostgreSQL 스키마(users, clones, clone_memories, interactions, interaction_events, analyses)를 설계·마이그레이션·쿼리할 때 사용. RLS 정책, 인덱스 전략, n-to-n 확장 고려사항 포함.
---

# Supabase DB Schema

Digital Clone Platform의 데이터 모델. **n-to-n 상호작용으로의 확장**을 염두에 두고 설계한다 — 1:1은 특수 케이스.

---

## 핵심 원칙

1. **모든 테이블에 RLS 활성화**. user_id 기반 정책을 기본으로.
2. **조인 테이블로 참여자 관리**: `interaction_participants`를 통해 N명 참여자를 표현. `clone_a_id`/`clone_b_id` 컬럼 금지 (확장 불가).
3. **JSONB 활용**: persona core, analysis 결과처럼 구조가 진화할 필드는 JSONB. 쿼리가 필요한 핵심 축만 별도 컬럼으로.
4. **timestamp는 `timestamptz`**, 기본값 `now()`.
5. **ID는 `uuid`** (`gen_random_uuid()`), sequence 금지.
6. **삭제는 soft delete** 원칙 (`deleted_at timestamptz`) — 사용자 데이터 복구 대비.

---

## 테이블 구조

### `users`
Supabase Auth의 `auth.users`를 그대로 활용. 필요하면 프로필 테이블만 추가.

```sql
-- auth.users는 Supabase가 관리. 확장 필드만 별도 테이블로.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `clones`
```sql
create table public.clones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null default 1,
  name text not null,
  persona_json jsonb not null,      -- Persona 인터페이스 전체
  system_prompt text,                -- 캐시된 프롬프트 (persona 변경 시 invalidate)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index clones_user_id_idx on public.clones(user_id) where deleted_at is null;
create index clones_persona_gin on public.clones using gin (persona_json);
```

### `clone_memories`
```sql
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
create index clone_memories_tags_gin on public.clone_memories using gin (tags);
```

### `interactions`
```sql
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                -- 'casual_chat' | 'deep_talk' | ...
  scenario text not null,
  setting text,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed','cancelled')),
  max_turns int not null default 20,
  metadata jsonb not null default '{}',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index interactions_status_idx on public.interactions(status);
create index interactions_created_by_idx on public.interactions(created_by);
```

### `interaction_participants` (n-to-n 핵심)
```sql
create table public.interaction_participants (
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  clone_id uuid not null references public.clones(id) on delete cascade,
  role text,                         -- 'host' | 'guest' | null (미래 확장)
  joined_at timestamptz not null default now(),
  primary key (interaction_id, clone_id)
);

create index interaction_participants_clone_idx
  on public.interaction_participants(clone_id);
```

### `interaction_events`
```sql
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

-- Realtime 활성화
alter publication supabase_realtime add table public.interaction_events;
```

### `analyses`
```sql
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  score int not null check (score between 0 and 100),
  report_json jsonb not null,        -- 카테고리별 점수 + 서술
  model text not null,
  created_at timestamptz not null default now()
);

create index analyses_interaction_idx on public.analyses(interaction_id);
```

---

## RLS 정책 (초안)

```sql
-- clones: 본인 소유만 SELECT/INSERT/UPDATE/DELETE
alter table public.clones enable row level security;

create policy "clones_owner_all" on public.clones
  for all using (auth.uid() = user_id);

-- clone_memories: 클론 소유자만
alter table public.clone_memories enable row level security;

create policy "clone_memories_owner_all" on public.clone_memories
  for all using (
    exists (
      select 1 from public.clones
      where clones.id = clone_memories.clone_id
        and clones.user_id = auth.uid()
    )
  );

-- interactions: 참여한 클론 소유자만
alter table public.interactions enable row level security;

create policy "interactions_participant_select" on public.interactions
  for select using (
    exists (
      select 1 from public.interaction_participants ip
      join public.clones c on c.id = ip.clone_id
      where ip.interaction_id = interactions.id
        and c.user_id = auth.uid()
    )
  );

create policy "interactions_creator_all" on public.interactions
  for all using (auth.uid() = created_by);

-- interaction_events: 참여한 인터랙션만
alter table public.interaction_events enable row level security;

create policy "interaction_events_participant_select" on public.interaction_events
  for select using (
    exists (
      select 1 from public.interaction_participants ip
      join public.clones c on c.id = ip.clone_id
      where ip.interaction_id = interaction_events.interaction_id
        and c.user_id = auth.uid()
    )
  );

-- analyses: 같은 원칙
alter table public.analyses enable row level security;

create policy "analyses_participant_select" on public.analyses
  for select using (
    exists (
      select 1 from public.interaction_participants ip
      join public.clones c on c.id = ip.clone_id
      where ip.interaction_id = analyses.interaction_id
        and c.user_id = auth.uid()
    )
  );
```

**주의**: API Route에서 쓰기는 service role key로 수행 (INSERT/UPDATE는 RLS 우회). 사용자 노출 읽기만 anon key + RLS로 제어.

---

## 마이그레이션 규칙

- 파일 위치: `frontend/supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- 한 마이그레이션 = 하나의 논리적 변경 (테이블 추가, 컬럼 추가, 인덱스 등)
- `down` 마이그레이션 필수 (Supabase CLI 지원)
- persona_json 구조 변경은 마이그레이션 없이 코드에서만 (JSONB라서 가능)
- 열거형 값 추가는 `check` constraint drop/recreate

---

## n-to-n 확장 체크리스트

1:1 코드를 작성할 때 **n-to-n에서 깨질 수 있는 것들**:

- `participants[0]`, `participants[1]` 하드코딩 → `for` 루프로
- `speaker = turn % 2 === 0 ? a : b` → 발화자 선정 전략 함수로
- 분석 카테고리가 2인 가정("둘의 가치관") → "참여자들의 가치관"으로 일반화
- UI "상대방" 레이블 → 다인 표시 가능한 아바타 리스트로

---

## 관련 파일 (Phase 1 이후 예정 경로)

- `frontend/supabase/migrations/` — SQL 마이그레이션
- `frontend/src/lib/supabase.ts` — 클라이언트 (anon + service role)
- `frontend/src/types/db.ts` — Supabase 생성 타입 (`supabase gen types`)
- `frontend/src/lib/db/` — 테이블별 쿼리 헬퍼
