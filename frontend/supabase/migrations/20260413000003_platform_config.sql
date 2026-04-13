-- platform_config: 런타임 플랫폼 설정 (key-value)
create table platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table platform_config enable row level security;

-- 인증 유저 읽기 가능 (엔진 서버에서 조회)
create policy "Authenticated users can read config"
  on platform_config for select
  to authenticated
  using (true);

-- 쓰기는 service client(admin API)만 가능 — RLS 정책 없음

-- 초기 데이터
insert into platform_config (key, value) values
  ('interaction_mode', '"economy"'),
  ('relationship_memory_enabled', 'true');
