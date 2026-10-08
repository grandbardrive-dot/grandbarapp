-- ============================================================
--  Pendientes y acuerdos de las reuniones con proveedores.
--  Correr en el proyecto HUB / PORTALGRANDBAR (xqhyemccbwmzxqzkrtwa) · SQL Editor.
--  Se usan en el Tablero de Reunión de Proveedor (reunion-proveedor.html).
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
create policy "anon_all_reunion_pendientes" on reunion_pendientes
  for all to anon using (true) with check (true);

create index if not exists rp_prov_idx on reunion_pendientes(proveedor);
