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
