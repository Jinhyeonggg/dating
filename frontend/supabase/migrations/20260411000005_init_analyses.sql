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
