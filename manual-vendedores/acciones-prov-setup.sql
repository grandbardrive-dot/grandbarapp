-- ============================================================
--  Acciones mensuales que suben los PROVEEDORES (archivo general)
--  Correr en el proyecto MANUAL (fzaxwuuodseyyinveknn) · SQL Editor.
--  El proveedor sube su plan del mes (PDF/PPT/Word/imagen) desde su panel,
--  queda 'pendiente', y Luciana lo aprueba o le pide cambios.
-- ============================================================

create table if not exists acciones_prov_mensuales (
  id                uuid primary key default gen_random_uuid(),
  proveedor_empresa text not null,
  archivo_url       text not null,
  archivo_nombre    text,
  archivo_tipo      text,
  observaciones     text,
  estado            text not null default 'pendiente',   -- pendiente | aprobada | cambios | descartada
  nota_revision     text,                                -- qué cambios pidió Luci
  created_at        timestamptz default now(),
  revisado_at       timestamptz
);

alter table acciones_prov_mensuales enable row level security;

-- Mismo criterio que el resto del portal de proveedores (anon_all): el filtrado
-- por empresa se hace en el panel. Si más adelante querés cerrarlo por RLS real,
-- se cambia acá.
drop policy if exists "anon_all_acciones_prov_mensuales" on acciones_prov_mensuales;
create policy "anon_all_acciones_prov_mensuales" on acciones_prov_mensuales
  for all to anon using (true) with check (true);

create index if not exists apm_estado_idx on acciones_prov_mensuales(estado);
create index if not exists apm_emp_idx    on acciones_prov_mensuales(proveedor_empresa);
create index if not exists apm_fecha_idx  on acciones_prov_mensuales(created_at desc);
