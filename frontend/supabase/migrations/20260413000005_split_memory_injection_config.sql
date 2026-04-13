-- 기존 relationship_memory_injection을 세분화된 설정으로 분리
delete from platform_config where key = 'relationship_memory_injection';

insert into platform_config (key, value) values
  ('pair_memory_injection', 'true'),
  ('other_memory_injection', 'false'),
  ('pair_memory_injection_limit', '20'),
  ('other_memory_injection_limit', '0');
