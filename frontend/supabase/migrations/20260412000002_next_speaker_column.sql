-- 다음 발화자 예고 컬럼
-- 엔진이 각 턴을 저장할 때 "다음에 말할 사람"을 함께 기록.
-- 뷰어가 타이핑 인디케이터 위치를 결정하는 데 사용.
-- 같은 발화자가 연속으로 말하는 경우(next = current)도 자연스럽게 지원.

alter table public.interaction_events
  add column next_speaker_clone_id uuid references public.clones(id);
