-- ============================================================
--  Portal del Cliente · última vez que cada cliente USÓ la app (29/10/2026)
--  Proyecto Cobranzas qpaoyfubyaloyhepatlm · SQL Editor.
--
--  last_sign_in_at (auth.users) solo cambia cuando el cliente inicia sesión de
--  nuevo. Si deja la sesión abierta y vuelve otro día, la app renueva el token y
--  eso queda en auth.sessions (refreshed_at). Esta función devuelve, por usuario,
--  la última vez que su sesión estuvo activa. La usa cobranzas-analisis (Hub)
--  para la columna "Último ingreso al portal".
--  Solo la llave de servicio puede llamarla (lee el esquema auth).
-- ============================================================

create or replace function public.portal_ultima_actividad()
returns table (user_id uuid, ultima timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select s.user_id,
         max(greatest(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at))
  from auth.sessions s
  group by s.user_id
$$;
revoke all on function public.portal_ultima_actividad() from public, anon, authenticated;
grant execute on function public.portal_ultima_actividad() to service_role;
