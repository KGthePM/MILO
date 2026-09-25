-- Book support: a fourth content type ('book') in the shared movies table.
--
-- As with 0009_podcasts.sql, `movies.type` has no CHECK constraint, so the new
-- value needs no migration — only the book-specific columns do. All are
-- nullable, so existing movie, TV and podcast rows are unaffected. Books also
-- reuse existing columns: publisher, artwork_url (cover), release_year (first
-- published), genre, notes.
--
-- Mirrored in backend/database.js (BOOK_COLUMNS). Keep the two in sync.
--
-- No RLS or index change is needed, for the same reasons given in 0009.

alter table movies add column if not exists author text;
alter table movies add column if not exists page_count integer;
alter table movies add column if not exists pages_read integer;

comment on column movies.author is 'Book author(s), e.g. "Andy Weir". Null for other types.';
comment on column movies.page_count is 'Total pages in the book, populated from Open Library when available.';
comment on column movies.pages_read is 'Pages the user has read (distinct from page_count, the book total).';
