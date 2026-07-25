-- Nolimi : schéma Fichiers (projets + dossiers)
-- Un seul script à coller dans Supabase → SQL Editor → Run
-- Peut être relancé sans casser l’existant (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- --- Projets ---
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Sans titre',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_updated_at_idx
  on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_own"
  on public.projects for select
  to authenticated
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  to authenticated
  using (auth.uid() = user_id);

-- --- Dossiers ---
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists folders_user_parent_idx
  on public.folders (user_id, parent_id);

alter table public.projects
  add column if not exists folder_id uuid references public.folders (id) on delete set null;

create index if not exists projects_user_folder_idx
  on public.projects (user_id, folder_id);

alter table public.folders enable row level security;

drop policy if exists "folders_select_own" on public.folders;
drop policy if exists "folders_insert_own" on public.folders;
drop policy if exists "folders_update_own" on public.folders;
drop policy if exists "folders_delete_own" on public.folders;

create policy "folders_select_own"
  on public.folders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "folders_insert_own"
  on public.folders for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "folders_update_own"
  on public.folders for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "folders_delete_own"
  on public.folders for delete
  to authenticated
  using (auth.uid() = user_id);
