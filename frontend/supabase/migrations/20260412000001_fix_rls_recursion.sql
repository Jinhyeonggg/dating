-- RLS 무한 재귀 수정
-- 기존 정책은 interactions <-> interaction_participants 를 상호 참조해 재귀 발생.
-- SECURITY DEFINER 헬퍼 함수로 RLS 우회해서 "이 interaction이 내 것인지" 만 판정.

create or replace function public.interaction_is_mine(iid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.interactions
    where id = iid and created_by = auth.uid()
  );
$$;

revoke all on function public.interaction_is_mine(uuid) from public;
grant execute on function public.interaction_is_mine(uuid) to authenticated;

-- interactions: 재귀 유발하던 participant_select 제거.
-- creator_all 정책이 Phase 1 전 케이스를 커버 (사용자가 직접 생성한 것만 봄).
drop policy if exists "interactions_participant_select" on public.interactions;

-- interaction_participants: 헬퍼 함수로 재작성
drop policy if exists "interaction_participants_participant_select" on public.interaction_participants;

create policy "interaction_participants_mine_select" on public.interaction_participants
  for select using (public.interaction_is_mine(interaction_id));

-- interaction_events: 동일 수정
drop policy if exists "interaction_events_participant_select" on public.interaction_events;

create policy "interaction_events_mine_select" on public.interaction_events
  for select using (public.interaction_is_mine(interaction_id));

-- analyses: 동일 수정
drop policy if exists "analyses_participant_select" on public.analyses;

create policy "analyses_mine_select" on public.analyses
  for select using (public.interaction_is_mine(interaction_id));
