-- Nolimi : autoriser tout membre à supprimer un dossier collaboratif
-- À coller dans Supabase → SQL Editor → Run (une seule fois)

drop policy if exists "collab_workspaces_delete" on public.collab_workspaces;

create policy "collab_workspaces_delete"
  on public.collab_workspaces for delete
  to authenticated
  using (auth.uid() = owner_id or public.is_collab_member(id));
