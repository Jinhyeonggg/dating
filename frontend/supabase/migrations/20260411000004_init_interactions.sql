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
