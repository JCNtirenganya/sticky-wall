-- Live polls for the presenter board and the audience phones.
-- Run once in Supabase → SQL Editor after schema.sql (and after
-- migration-categories.sql if this project started on the old version).
--
-- Safe to re-run: tables, policies, indexes and the realtime publication
-- are all created conditionally.
--
-- Polls are written only by the presenter board. Phones only read polls and
-- insert / update their own row in poll_votes (one row per voter_key per poll).
-- Like the rest of this demo, the presenter link is trusted: there is no
-- presenter login, so the anon key can technically write both tables. Keep
-- the board URL private if that matters for your room.

begin;

-- ── polls ──────────────────────────────────────────────────────
-- id is text (not uuid) because the board generates readable ids such as
-- "poll-<uuid>" and the demo store uses the same ids.
create table if not exists public.polls (
  id           text primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  question     text not null check (char_length(question) between 1 and 160),
  description  text not null default '' check (char_length(description) <= 320),
  type         text not null check (type in ('single', 'multi', 'yesno', 'rating', 'text')),
  category     text not null default 'Feedback' check (char_length(category) between 1 and 32),
  options      jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  max_choices  smallint not null default 1 check (max_choices between 1 and 8),
  status       text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  results      text not null default 'after' check (results in ('always', 'after', 'presenter')),
  position     integer not null default 0
);

alter table public.polls enable row level security;

drop policy if exists "read polls" on public.polls;
create policy "read polls" on public.polls for select to anon using (true);

drop policy if exists "write polls" on public.polls;
create policy "write polls" on public.polls for all to anon using (true) with check (true);

-- Realtime DELETE payloads need the whole old row.
alter table public.polls replica identity full;

create index if not exists polls_order_idx on public.polls (position, created_at);

-- ── poll_votes: one answer per voter per poll ──────────────────
create table if not exists public.poll_votes (
  id           uuid primary key default gen_random_uuid(),
  poll_id      text not null references public.polls(id) on delete cascade,
  voter_key    text not null check (char_length(voter_key) between 8 and 120),
  author_name  text not null default '' check (char_length(author_name) <= 40),
  choice_ids   text[] not null default '{}'::text[],
  rating       smallint check (rating between 1 and 5),
  text         text not null default '' check (char_length(text) <= 280),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (poll_id, voter_key)
);

alter table public.poll_votes enable row level security;

drop policy if exists "read poll votes" on public.poll_votes;
create policy "read poll votes" on public.poll_votes for select to anon using (true);

drop policy if exists "write poll votes" on public.poll_votes;
create policy "write poll votes" on public.poll_votes for all to anon using (true) with check (true);

alter table public.poll_votes replica identity full;

create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

-- ── realtime ───────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'polls'
  ) then
    alter publication supabase_realtime add table public.polls;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_votes'
  ) then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
end $$;

-- ── moderator helpers (Supabase → Table editor / SQL) ──────────
-- Close a poll:      update polls set status = 'closed' where id = '...';
-- Clear its votes:   delete from poll_votes where poll_id = '...';
-- Delete a poll:     delete from polls where id = '...';  (votes cascade)
create or replace view public.poll_results as
  select p.id, p.question, p.status, p.category,
         count(v.id) as responses,
         max(v.updated_at) as last_answer_at
    from polls p
    left join poll_votes v on v.poll_id = p.id
   group by p.id, p.question, p.status, p.category, p.position, p.created_at
   order by p.position, p.created_at;

commit;
