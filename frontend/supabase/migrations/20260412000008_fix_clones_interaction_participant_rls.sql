-- 비공개 clone이라도 내가 참여한 interaction의 상대 clone은 조회 가능해야 함
-- 기존: is_public=false인 타인 clone은 무조건 조회 불가 → interaction 뷰어에서 404

create policy "clones_interaction_participant_read"
  on clones for select
  to authenticated
  using (
    exists (
      select 1
      from public.interaction_participants ip1
      join public.interaction_participants ip2
        on ip1.interaction_id = ip2.interaction_id
      join public.clones my_clone
        on my_clone.id = ip2.clone_id
      where ip1.clone_id = clones.id
        and my_clone.user_id = auth.uid()
        and ip1.clone_id != ip2.clone_id
    )
  );
