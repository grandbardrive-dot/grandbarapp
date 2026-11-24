-- ============================================================
--  Cuentas Corrientes Mendoza (24/11/2026) · base del Portal (xqhyemccbwmzxqzkrtwa)
--  Lo que Agostina y Administración cargan sobre el tablero cuentas-corrientes-mendoza.html:
--  estado de gestión por cliente, compromisos de pago, autorizaciones de pedidos y la
--  configuración (WhatsApp de Facturación, quién autoriza). Una fila por (coleccion, id),
--  los datos en JSON, igual que los guardaba el tablero original.
--  Los saldos NO están acá: los sirve la función ctasctes-mendoza desde el listado del ERP.
-- ============================================================

-- mi_rol() ya existe (usuarios-panel-setup.sql). Se re-crea por las dudas.
create or replace function public.mi_rol()
returns text language sql security definer stable set search_path = public
as $$ select rol from public.usuarios where id = auth.uid() $$;
revoke all on function public.mi_rol() from public;
grant execute on function public.mi_rol() to authenticated;

create table if not exists public.cc_mendoza_gestion (
  coleccion   text not null,                         -- gestion | compromisos | autorizaciones | config
  id          text not null,                         -- código de cliente, id del compromiso/autorización o 'general'
  datos       jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now(),
  por         uuid references auth.users (id),
  primary key (coleccion, id)
);

-- Quién lee: los roles de Cobranzas (Agostina = reclamos, Brenda = administracion, Mónica = tesoreria)
-- más quienes mantienen el sistema y Dirección. Quién escribe: los mismos menos Dirección, que mira.
create or replace function public.es_cobranzas_mza()
returns boolean language sql security definer stable set search_path = public
as $$
  select coalesce(public.mi_rol() in
    ('reclamos', 'administracion', 'tesoreria', 'admin', 'desarrollo', 'diseno', 'direccion'), false)
$$;
revoke all on function public.es_cobranzas_mza() from public;
grant execute on function public.es_cobranzas_mza() to authenticated;

create or replace function public.opera_cobranzas_mza()
returns boolean language sql security definer stable set search_path = public
as $$
  select coalesce(public.mi_rol() in
    ('reclamos', 'administracion', 'tesoreria', 'desarrollo', 'diseno'), false)
$$;
revoke all on function public.opera_cobranzas_mza() from public;
grant execute on function public.opera_cobranzas_mza() to authenticated;

alter table public.cc_mendoza_gestion enable row level security;
drop policy if exists "cobranzas mza lee"     on public.cc_mendoza_gestion;
drop policy if exists "cobranzas mza escribe" on public.cc_mendoza_gestion;
create policy "cobranzas mza lee" on public.cc_mendoza_gestion
  for select to authenticated using ( public.es_cobranzas_mza() );
create policy "cobranzas mza escribe" on public.cc_mendoza_gestion
  for all to authenticated
  using ( public.opera_cobranzas_mza() ) with check ( public.opera_cobranzas_mza() );
