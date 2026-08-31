-- ============================================================
--  Usuarios y roles desde el panel
--  Correr en el proyecto del HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  Hoy la regla de la tabla usuarios es "cada uno lee y edita SOLO su propio
--  perfil". Por eso el panel no puede listar a nadie. Esto agrega una segunda
--  regla: quien tenga rol admin, desarrollo o diseno puede ver y editar a todos.
--  La regla vieja no se toca: cada uno sigue viendo lo suyo.
--
--  El truco para no caer en recursión (una regla sobre usuarios que necesita
--  leer usuarios) es preguntar el rol con una función SECURITY DEFINER, que
--  corre por fuera de las reglas.
-- ============================================================

create or replace function public.mi_rol()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid()
$$;

revoke all on function public.mi_rol() from public;
grant execute on function public.mi_rol() to authenticated;

-- Quiénes pueden administrar usuarios.
create or replace function public.puede_administrar_usuarios()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.mi_rol() in ('admin', 'desarrollo', 'diseno'), false)
$$;

revoke all on function public.puede_administrar_usuarios() from public;
grant execute on function public.puede_administrar_usuarios() to authenticated;

drop policy if exists "admins ven todos los usuarios"   on public.usuarios;
drop policy if exists "admins editan todos los usuarios" on public.usuarios;

create policy "admins ven todos los usuarios"
  on public.usuarios for select to authenticated
  using ( public.puede_administrar_usuarios() );

create policy "admins editan todos los usuarios"
  on public.usuarios for update to authenticated
  using ( public.puede_administrar_usuarios() )
  with check ( public.puede_administrar_usuarios() );

-- Comprobar (con tu sesión iniciada, desde la app):
--   select nombre, email, rol, activo from public.usuarios order by nombre;
--
--  OJO: crear cuentas y cambiar contraseñas NO se puede desde la app.
--  Eso va sí o sí por Supabase → Authentication → Users. El panel deja
--  cambiar el rol, el nombre y activar o desactivar, que es el día a día.
