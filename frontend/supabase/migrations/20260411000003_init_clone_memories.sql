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
