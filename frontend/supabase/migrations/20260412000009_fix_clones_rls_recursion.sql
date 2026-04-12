-- clones_interaction_participant_read 정책이 clones 테이블을 자기 참조하면서 RLS 재귀 발생
-- SECURITY DEFINER 헬퍼 함수로 교체하여 재귀 방지

-- 재귀 유발 정책 삭제
drop policy if exists "clones_interaction_participant_read" on clones;

-- SECURITY DEFINER 헬퍼: 이 clone이 내 clone과 같은 interaction에 참여했는가?
create or replace function public.clone_is_my_interaction_partner(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.interaction_participants ip1
    join public.interaction_participants ip2
      on ip1.interaction_id = ip2.interaction_id
    join public.clones my_clone
      on my_clone.id = ip2.clone_id
    where ip1.clone_id = cid
      and my_clone.user_id = auth.uid()
      and ip1.clone_id != ip2.clone_id
  );
$$;

revoke all on function public.clone_is_my_interaction_partner(uuid) from public;
grant execute on function public.clone_is_my_interaction_partner(uuid) to authenticated;

-- 재작성: SECURITY DEFINER 함수 사용
create policy "clones_interaction_participant_read"
  on clones for select
  to authenticated
  using (public.clone_is_my_interaction_partner(id));
