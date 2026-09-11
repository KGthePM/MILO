-- Podcast support: a third content type ('podcast') in the shared movies table.
--
-- `movies.type` has no CHECK constraint, so the new value itself needs no
-- migration — only these podcast-specific columns do. All are nullable, so
-- existing movie and TV rows are unaffected.
--
-- Mirrored in backend/database.js (PODCAST_COLUMNS). Keep the two in sync.
--
-- No RLS change is needed: the owner policies on `movies` are row-scoped via
-- auth.uid() = user_id and are content-type agnostic. No new index is needed
-- either: movies_user_type_idx (user_id, type) from 0001_init.sql already
-- covers filtering by type.

alter table movies add column if not exists host text;
alter table movies add column if not exists publisher text;
alter table movies add column if not exists episodes_heard integer;
alter table movies add column if not exists artwork_url text;

comment on column movies.host is 'Podcast host, e.g. "PJ Vogt". Null for movies/TV.';
comment on column movies.publisher is 'Podcast network/publisher. Null for movies/TV.';
comment on column movies.episodes_heard is 'Episodes the user has listened to (distinct from total_episodes, the show total).';
comment on column movies.artwork_url is 'Cover art URL, populated from the iTunes Search API.';
