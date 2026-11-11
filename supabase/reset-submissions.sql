-- Fresh start: remove every submission collected before the event.
-- Run this once in the Supabase dashboard → SQL Editor, then reload the board.
-- It is safe to run again; empty tables simply stay empty.
--
-- Notes are select-only for anon, so this needs the SQL Editor (service role)
-- rather than the publishable key used by the board and phones.

begin;

-- answers first, then the polls they point at
delete from public.poll_votes;
delete from public.polls;

-- media rows and the files they reference
delete from public.event_media;
delete from storage.objects where bucket_id = 'event-media';

-- everything the room wrote on sticky notes
delete from public.notes;

commit;
