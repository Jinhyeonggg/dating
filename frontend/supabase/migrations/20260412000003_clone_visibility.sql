-- Clone visibility: public/private toggle + per-field privacy control

alter table clones add column is_public boolean not null default true;
alter table clones add column public_fields text[] not null default '{name,age,gender,occupation,mbti,personality_traits,hobbies,tags,self_description}';

-- Extend RLS: allow reading other users' public clones
drop policy if exists "clones_npc_read" on clones;

create policy "clones_public_read"
  on clones for select
  to authenticated
  using (
    deleted_at is null
    and (
      is_npc = true
      or user_id = auth.uid()
      or (is_public = true and is_npc = false)
    )
  );
