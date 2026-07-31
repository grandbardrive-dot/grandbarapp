-- ===========================================================
-- GrandBar Hub — setup de auth por rol
-- Correr una vez en Supabase → SQL Editor.
-- ===========================================================

-- 1) Tabla de perfiles: un registro por usuario, con su rol y área.
create table if not exists public.usuarios (
  id      uuid primary key references auth.users(id) on delete cascade,
  nombre  text,
  email   text,
  rol     text not null default 'ventas',   -- admin | ventas | marketing | administracion | compras | mayorista | deposito | reportes | cliente
  activo  boolean not null default true,
  creado  timestamptz not null default now()
);

-- 2) RLS: cada usuario lee (y actualiza) su propio perfil.
--    La gestión de usuarios/roles se hace desde el panel de Supabase
--    (service role), que ignora RLS. Evitamos políticas recursivas.
alter table public.usuarios enable row level security;

drop policy if exists "leer propio perfil" on public.usuarios;
create policy "leer propio perfil"
  on public.usuarios for select
  using ( auth.uid() = id );

drop policy if exists "editar propio perfil" on public.usuarios;
create policy "editar propio perfil"
  on public.usuarios for update
  using ( auth.uid() = id );

-- 3) Al crearse un usuario en Auth, se crea su perfil automáticamente.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.usuarios (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================
-- Cómo dar de alta usuarios:
--   Supabase → Authentication → Users → Add user (email + pass).
--   Se crea solo el perfil en `usuarios` con rol 'ventas'.
--   Después ajustás el rol:
--       update public.usuarios set rol = 'admin'
--       where email = 'tu-email@grandbar.com.ar';
-- ===========================================================
