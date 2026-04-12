-- Track when a participant has seen/acknowledged an interaction
alter table interaction_participants add column seen_at timestamptz;
