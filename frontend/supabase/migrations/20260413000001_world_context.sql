-- Phase 2 P0: world_context table for manually curated external context

create table world_context (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null check (category in (
    'news', 'weather', 'meme', 'market', 'politics', 'sports', 'other'
  )),
  headline text not null,
  details text,
  weight smallint not null default 5 check (weight between 1 and 10),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index world_context_date_category_idx on world_context (date, category);

alter table world_context enable row level security;

create policy "world_context_select_authenticated"
  on world_context for select
  to authenticated
  using (true);
