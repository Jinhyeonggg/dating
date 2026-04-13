-- 대화 기억 주입 설정: 관계 기억을 system prompt에 주입할지 여부
insert into platform_config (key, value) values
  ('relationship_memory_injection', 'true');
