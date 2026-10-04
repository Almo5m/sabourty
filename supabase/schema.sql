-- سبورتي: جدول اللوحات + الحماية على مستوى الصفوف (RLS)
-- شغّل هذا الملف كامل في: Supabase Dashboard -> SQL Editor -> New query

create table if not exists public.boards (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode text not null default 'freeform',
  canvas_json jsonb,
  pdf_pages jsonb,
  current_page_index integer not null default 0,
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_user_id_idx on public.boards (user_id);

alter table public.boards enable row level security;

drop policy if exists "Users can view their own boards" on public.boards;
create policy "Users can view their own boards"
  on public.boards for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own boards" on public.boards;
create policy "Users can insert their own boards"
  on public.boards for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own boards" on public.boards;
create policy "Users can update their own boards"
  on public.boards for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own boards" on public.boards;
create policy "Users can delete their own boards"
  on public.boards for delete
  using (auth.uid() = user_id);
