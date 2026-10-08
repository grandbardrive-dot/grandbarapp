-- ============================================================
--  Reuniones con proveedores: pendientes y cuestionario por marca.
--  Correr en el proyecto HUB / PORTALGRANDBAR (xqhyemccbwmzxqzkrtwa) · SQL Editor.
--  Se usan en reunion-proveedor.html (pendientes) y reunion-marca.html
--  (cuestionario: descuento, tope, sin cargo, acción, ejecución, materiales,
--  vigencia). Las páginas guardan con la sesión del Hub (rol authenticated).
-- ============================================================

create table if not exists reunion_pendientes (
  id          uuid primary key default gen_random_uuid(),
  proveedor   text not null,
  texto       text not null,
  hecho       boolean default false,
  creado_por  text,
  created_at  timestamptz default now(),
  hecho_at    timestamptz
);

alter table reunion_pendientes enable row level security;
drop policy if exists "anon_all_reunion_pendientes" on reunion_pendientes;
drop policy if exists "hub_reunion_pendientes" on reunion_pendientes;
create policy "hub_reunion_pendientes" on reunion_pendientes
  for all to anon, authenticated using (true) with check (true);

create index if not exists rp_prov_idx on reunion_pendientes(proveedor);

-- Cuestionario de la reunión por marca (una fila por marca + rubro + reunión).
create table if not exists reunion_fichas (
  id          uuid primary key default gen_random_uuid(),
  proveedor   text,
  marca       text not null,          -- lo que se buscó: "johnny", "smirnoff"…
  rubro       text,                   -- tipo de cliente o 'todos'
  periodo     text,                   -- "2026-01-01..2026-10-07"
  lectura     jsonb,                  -- foto de los números al guardar (vs 2025)
  respuestas  jsonb not null,         -- descuento, tope, sin_cargo, accion, ejecucion, materiales, vigencia…
  creado_por  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table reunion_fichas enable row level security;
drop policy if exists "hub_reunion_fichas" on reunion_fichas;
create policy "hub_reunion_fichas" on reunion_fichas
  for all to authenticated using (true) with check (true);

create index if not exists rf_marca_idx on reunion_fichas(lower(marca), created_at desc);
