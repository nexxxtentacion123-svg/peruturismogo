-- Ejecuta este archivo completo en Supabase > SQL Editor.
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  progreso jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

alter table public.perfiles add column if not exists username text;
create unique index if not exists perfiles_username_unico
  on public.perfiles (lower(username))
  where username is not null;

alter table public.perfiles enable row level security;

drop policy if exists "Cada usuario lee su perfil" on public.perfiles;
create policy "Cada usuario lee su perfil"
  on public.perfiles for select
  using (auth.uid() = id);

drop policy if exists "Cada usuario crea su perfil" on public.perfiles;
create policy "Cada usuario crea su perfil"
  on public.perfiles for insert
  with check (auth.uid() = id);

drop policy if exists "Cada usuario actualiza su perfil" on public.perfiles;
create policy "Cada usuario actualiza su perfil"
  on public.perfiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
