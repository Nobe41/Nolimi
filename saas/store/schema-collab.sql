-- Nolimi : projets collaboratifs (workspaces partagés)
-- À coller dans Supabase → SQL Editor → Run
-- Après le script schema-fichiers.sql

-- --- Workspaces collaboratifs ---
create table if not exists public.collab_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists collab_workspaces_owner_idx
  on public.collab_workspaces (owner_id);

-- --- Membres d’un workspace ---
create table if not exists public.collab_workspace_members (
  workspace_id uuid not null references public.collab_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists collab_members_user_idx
  on public.collab_workspace_members (user_id);

-- Lien projet → workspace (null = projet perso)
alter table public.projects
  add column if not exists collab_workspace_id uuid
    references public.collab_workspaces (id) on delete cascade;

create index if not exists projects_collab_workspace_idx
  on public.projects (collab_workspace_id);

-- Helpers RLS (security definer pour éviter les boucles de policies)
create or replace function public.is_collab_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.collab_workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_collab_workspace_owner(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.collab_workspaces w
    where w.id = ws
      and w.owner_id = auth.uid()
  );
$$;

alter table public.collab_workspaces enable row level security;
alter table public.collab_workspace_members enable row level security;

drop policy if exists "collab_workspaces_select" on public.collab_workspaces;
drop policy if exists "collab_workspaces_insert" on public.collab_workspaces;
drop policy if exists "collab_workspaces_update" on public.collab_workspaces;
drop policy if exists "collab_workspaces_delete" on public.collab_workspaces;

create policy "collab_workspaces_select"
  on public.collab_workspaces for select
  to authenticated
  using (auth.uid() = owner_id or public.is_collab_member(id));

create policy "collab_workspaces_insert"
  on public.collab_workspaces for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "collab_workspaces_update"
  on public.collab_workspaces for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "collab_workspaces_delete"
  on public.collab_workspaces for delete
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "collab_members_select" on public.collab_workspace_members;
drop policy if exists "collab_members_insert" on public.collab_workspace_members;
drop policy if exists "collab_members_delete" on public.collab_workspace_members;

create policy "collab_members_select"
  on public.collab_workspace_members for select
  to authenticated
  using (public.is_collab_member(workspace_id) or public.is_collab_workspace_owner(workspace_id));

create policy "collab_members_insert"
  on public.collab_workspace_members for insert
  to authenticated
  with check (
    public.is_collab_workspace_owner(workspace_id)
    or user_id = auth.uid()
  );

create policy "collab_members_delete"
  on public.collab_workspace_members for delete
  to authenticated
  using (public.is_collab_workspace_owner(workspace_id) or user_id = auth.uid());

-- Policies projets : perso OU membre collab
drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;
drop policy if exists "projects_select_access" on public.projects;
drop policy if exists "projects_insert_access" on public.projects;
drop policy if exists "projects_update_access" on public.projects;
drop policy if exists "projects_delete_access" on public.projects;

create policy "projects_select_access"
  on public.projects for select
  to authenticated
  using (
    (collab_workspace_id is null and auth.uid() = user_id)
    or (collab_workspace_id is not null and public.is_collab_member(collab_workspace_id))
  );

create policy "projects_insert_access"
  on public.projects for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      collab_workspace_id is null
      or public.is_collab_member(collab_workspace_id)
    )
  );

create policy "projects_update_access"
  on public.projects for update
  to authenticated
  using (
    (collab_workspace_id is null and auth.uid() = user_id)
    or (collab_workspace_id is not null and public.is_collab_member(collab_workspace_id))
  )
  with check (
    (collab_workspace_id is null and auth.uid() = user_id)
    or (collab_workspace_id is not null and public.is_collab_member(collab_workspace_id))
  );

create policy "projects_delete_access"
  on public.projects for delete
  to authenticated
  using (
    (collab_workspace_id is null and auth.uid() = user_id)
    or (collab_workspace_id is not null and (
      auth.uid() = user_id or public.is_collab_workspace_owner(collab_workspace_id)
    ))
  );
