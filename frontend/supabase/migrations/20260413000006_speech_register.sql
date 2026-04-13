-- clone_relationships에 말투 상태 컬럼 추가
alter table clone_relationships
  add column speech_register text default null;

-- 유효값: 'formal', 'casual', 'banmal-ready', null(미결정)
comment on column clone_relationships.speech_register is 'formal | casual | banmal-ready | null';
