-- Fresh start: remove every submission collected before the event.
-- Run this once in the Supabase dashboard → SQL Editor, then reload the board.
-- It is safe to run again; empty tables simply stay empty.
--
-- Notes are select-only for anon, so this needs the SQL Editor (service role)
-- rather than the publishable key used by the board and phones.
--
-- Storage files cannot be deleted directly from SQL on current Supabase
-- projects (the storage schema protects against orphaned objects). Empty the
-- `event-media` bucket from Dashboard → Storage, or use Extras → Start fresh →
-- Clear all submissions, which removes the files through the Storage API.

begin;

-- answers first, then the polls they point at
delete from public.poll_votes where true;
delete from public.polls where true;

-- media rows; empty the bucket in Dashboard → Storage separately
delete from public.event_media where true;

-- everything the room wrote on sticky notes
delete from public.notes where true;

commit;
