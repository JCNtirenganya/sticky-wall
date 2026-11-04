-- Already using the v2 schema? Run this once to make sender names public
-- on the board. It backfills existing notes from the old private table,
-- rewrites submit_note(), then removes the redundant note_authors table.

begin;

alter table public.notes add column if not exists author_name text not null default '';

-- Copy existing pseudonyms across before dropping the old table.
do $$
begin
  if to_regclass('public.note_authors') is not null then
    execute $sql$
      update public.notes n
         set author_name = a.name
        from public.note_authors a
       where a.note_id = n.id and n.author_name = ''
    $sql$;
  end if;
end $$;

create or replace function public.submit_note(p_name text, p_category text, p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notes(category, text, author_name)
  values (p_category, left(trim(p_text), 200), left(trim(p_name), 40));
end $$;
revoke all on function public.submit_note from public;
grant execute on function public.submit_note to anon;

drop view if exists public.moderation;
drop table if exists public.note_authors;

create view public.moderation as
  select created_at, author_name as name, category, text, hidden, id
  from notes order by created_at desc;

commit;
