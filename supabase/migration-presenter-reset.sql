-- Presenter passphrase reset ─ clear the event without exposing a service key.
--
-- Run this file once in the Supabase dashboard → SQL Editor, then set your own
-- passphrase in step 2 before using the Extras → Clear all submissions button.
--
-- How it works:
--   • presenter_config stores one bcrypt hash. RLS is on and there are no
--     policies, so the publishable key cannot read or write the table.
--   • presenter_clear(p_secret) is SECURITY DEFINER. It is the only thing anon
--     may execute; it checks the passphrase, then deletes submissions.
--   • Five wrong passphrases lock the reset for five minutes.

-- 1 · schema ----------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.presenter_config (
  id boolean primary key default true check (id),
  secret_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz not null default 'epoch',
  updated_at timestamptz not null default now()
);

alter table public.presenter_config enable row level security;

-- No policies on purpose: only the SECURITY DEFINER function reaches the row.
revoke all on table public.presenter_config from anon, authenticated;

-- Seed one row with an unguessable hash. Nobody can use the reset until step 2
-- replaces it with a passphrase the presenter knows.
insert into public.presenter_config (id, secret_hash)
values (true, extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf', 12)))
on conflict (id) do nothing;

-- 2 · choose the passphrase ------------------------------------------------
-- Copy the statement below into the SQL Editor, replace the text between the
-- quotes with a long passphrase you will remember, and run it once.
-- Treat this like a password: do not commit it or paste it into chat.
--
-- update public.presenter_config
-- set secret_hash = extensions.crypt('replace with a long presenter passphrase', extensions.gen_salt('bf', 12)),
--     failed_attempts = 0,
--     locked_until = 'epoch',
--     updated_at = now()
-- where id;

-- 3 · reset function --------------------------------------------------------
create or replace function public.presenter_clear(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  cfg public.presenter_config;
  note_count integer := 0;
  poll_count integer := 0;
  vote_count integer := 0;
  media_count integer := 0;
  file_count integer := 0;
begin
  select * into cfg from public.presenter_config where id for update;

  if not found then
    raise exception 'Presenter reset is not configured';
  end if;

  if cfg.locked_until > now() then
    raise exception 'Too many attempts. Try again later.';
  end if;

  if p_secret is null or crypt(p_secret, cfg.secret_hash) <> cfg.secret_hash then
    update public.presenter_config
    set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
        locked_until = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else locked_until end,
        updated_at = now()
    where id;
    raise exception 'Incorrect passphrase';
  end if;

  update public.presenter_config
  set failed_attempts = 0,
      locked_until = 'epoch',
      updated_at = now()
  where id;

  -- Answers before the polls they point at, then media rows and the files
  -- they reference, then the notes.
  delete from public.poll_votes;
  get diagnostics vote_count = row_count;

  delete from public.polls;
  get diagnostics poll_count = row_count;

  delete from public.event_media;
  get diagnostics media_count = row_count;

  delete from storage.objects where bucket_id = 'event-media';
  get diagnostics file_count = row_count;

  delete from public.notes;
  get diagnostics note_count = row_count;

  return jsonb_build_object(
    'notes', note_count,
    'polls', poll_count,
    'votes', vote_count,
    'media', media_count,
    'files', file_count
  );
end;
$$;

revoke all on function public.presenter_clear(text) from public;
grant execute on function public.presenter_clear(text) to anon;

comment on function public.presenter_clear(text) is
  'Presenter-only reset: deletes notes, polls, votes, media rows and files. Requires the bcrypt passphrase stored in presenter_config.';
