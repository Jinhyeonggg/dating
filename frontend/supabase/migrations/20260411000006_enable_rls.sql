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
