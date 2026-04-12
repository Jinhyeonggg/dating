-- interaction_is_mine: created_by 뿐 아니라, 내 clone이 참여자인 경우도 포함
-- 기존 함수는 created_by만 체크해서 상대가 시작한 interaction이 404 되는 버그 있었음

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
  )
  or exists (
    select 1 from public.interaction_participants ip
    join public.clones c on c.id = ip.clone_id
    where ip.interaction_id = iid
      and c.user_id = auth.uid()
  );
$$;
