-- Run once in Supabase → SQL Editor.
-- Already live on the three-category version? Run
-- supabase/migration-categories.sql instead (it keeps existing notes).

begin;

-- ── notes ──────────────────────────────────────────────────────
-- Categories are dynamic: the presenter adds, renames and recolours
-- them on the board, so the column is free text (not a fixed CHECK).
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  category    text not null check (char_length(category) between 1 and 64),
  text        text not null check (char_length(text) between 1 and 200),
  author_name text not null check (char_length(author_name) between 1 and 40),
  hidden      boolean not null default false   -- moderator can flip this to take a note off the board
);

-- Older installs may still carry the fixed three-category constraint.
alter table public.notes drop constraint if exists notes_category_check;

alter table public.notes enable row level security;

drop policy if exists "read notes" on public.notes;
create policy "read notes" on public.notes for select to anon using (true);

-- ── settings: the presenter's category plan ────────────────────
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings for select to anon using (true);

-- Realtime payloads for settings updates need the full row.
alter table public.settings replica identity full;

-- ── category plan: defaults used until the presenter saves ─────
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

-- Save the presenter's plan. Accepts an array of
-- {key,label,short,action,emoji,hint,color}; keeps at most 9 entries.
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

-- Move every note from removed categories to the fallback category.
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

-- ── the only way to add a note ─────────────────────────────────
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

-- ── realtime ───────────────────────────────────────────────────
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

-- ── moderator helper view (dashboard → Table editor) ──────────
create or replace view public.moderation as
  select created_at, author_name as name, category, text, hidden, id
  from notes order by created_at desc;
-- To hide a note:  update notes set hidden = true where id = '...';

commit;
