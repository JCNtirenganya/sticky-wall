-- Already live on the three-category version? Run this once to make
-- categories dynamic (add / rename / recolour / remove on the board)
-- and to sync the presenter's plan across screens. Existing notes,
-- names and hidden flags are kept.

begin;

-- 1 · free the notes.category column from the fixed three values
alter table public.notes drop constraint if exists notes_category_check;
alter table public.notes drop constraint if exists notes_category_check1;

-- Guard against any later hand-added constraint that pins the values.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.notes'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%category%'
       and pg_get_constraintdef(oid) ilike '%question%'
  loop
    execute format('alter table public.notes drop constraint %I', c.conname);
  end loop;
end $$;

-- 2 · the presenter's category plan
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings for select to anon using (true);

alter table public.settings replica identity full;

-- 3 · RPCs used by the board
create or replace function public.default_categories()
returns jsonb language sql immutable as $$
  select '[
    {"key":"question","label":"Question","short":"Questions","action":"Ask a question","emoji":"❓","hint":"What are you wondering?","color":"#E6E600"},
    {"key":"idea","label":"Idea","short":"Ideas","action":"Give an idea","emoji":"💡","hint":"What if we…","color":"#E60073"},
    {"key":"appreciation","label":"Appreciation","short":"Thanks","action":"Share appreciation","emoji":"💗","hint":"Say thank you…","color":"#00E600"},
    {"key":"resources","label":"Resource","short":"Resources","action":"Share a resource","emoji":"📚","hint":"A link, tool or reading…","color":"#00B4E6"},
    {"key":"requests","label":"Request","short":"Requests","action":"Make a request","emoji":"🙏","hint":"What do you need help with?","color":"#E67300"}
  ]'::jsonb;
$$;
revoke all on function public.default_categories() from public;
grant execute on function public.default_categories() to anon;

create or replace function public.get_categories()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(
    (select value from settings where key = 'categories'),
    default_categories()
  );
$$;
revoke all on function public.get_categories() from public;
grant execute on function public.get_categories() to anon;

create or replace function public.set_categories(p_categories jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cleaned jsonb;
begin
  if p_categories is null or jsonb_typeof(p_categories) <> 'array' then
    raise exception 'categories must be a JSON array';
  end if;

  select coalesce(jsonb_agg(c order by ord), '[]'::jsonb) into cleaned
  from (
    select value as c, ord
    from jsonb_array_elements(p_categories) with ordinality as t(value, ord)
    where jsonb_typeof(value) = 'object'
    order by ord
    limit 9
  ) s;

  insert into settings(key, value, updated_at)
  values ('categories', cleaned, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return cleaned;
end $$;
revoke all on function public.set_categories(jsonb) from public;
grant execute on function public.set_categories(jsonb) to anon;

create or replace function public.reassign_notes(p_from text[], p_to text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  moved integer;
begin
  if p_from is null or array_length(p_from, 1) is null or p_to is null then
    return 0;
  end if;
  update notes set category = p_to where category = any(p_from);
  get diagnostics moved = row_count;
  return moved;
end $$;
revoke all on function public.reassign_notes(text[], text) from public;
grant execute on function public.reassign_notes(text[], text) to anon;

-- 4 · keep submit_note() tolerant of new category keys
create or replace function public.submit_note(p_name text, p_category text, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_category text := left(trim(coalesce(p_category, '')), 64);
begin
  if v_category = '' then
    raise exception 'category is required';
  end if;
  insert into notes(category, text, author_name)
  values (v_category, left(trim(p_text), 200), left(trim(p_name), 40));
end $$;
revoke all on function public.submit_note from public;
grant execute on function public.submit_note to anon;

-- 5 · realtime for both tables (safe to re-run)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;

-- 6 · start from the five-column defaults if this board never saved a plan
insert into public.settings(key, value)
values ('categories', public.default_categories())
on conflict (key) do nothing;

commit;
