-- interactions 테이블 SELECT에 참여자 정책 추가
-- 기존: interactions_creator_all (created_by만) → 상대가 시작한 interaction 404
-- 수정: interaction_is_mine 헬퍼 사용하는 별도 SELECT 정책 추가

-- 참여자도 interaction을 SELECT 할 수 있는 정책
create policy "interactions_participant_select" on public.interactions
  for select using (public.interaction_is_mine(id));
