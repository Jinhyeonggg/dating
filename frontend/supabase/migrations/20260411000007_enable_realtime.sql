-- 20260411000007_enable_realtime.sql
-- Realtime publication 에 interaction_events 추가
alter publication supabase_realtime add table public.interaction_events;

-- interactions 테이블도 status 변경 감지용으로 추가
alter publication supabase_realtime add table public.interactions;
