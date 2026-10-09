-- ============================================================
--  CRM — Calendario de envíos de acciones por rubro (compartido).
--  Correr en el proyecto HUB / PORTALGRANDBAR (xqhyemccbwmzxqzkrtwa) · SQL Editor.
--  Lo usan Josefina, Nahuel, Sepúlveda y Luciana desde crm-calendario.html.
--  Todos son administradores: pueden agregar, editar y borrar acciones.
-- ============================================================

create table if not exists crm_acciones (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null,                 -- día del envío de la acción
  rubro        text not null,                 -- restaurante | bar | hotel | disco | evento | vinoteca | tienda_bebidas | autoservicio | kiosco | mayorista
  nombre       text not null,                 -- Nombre de la acción
  proveedor    text,
  producto     text,
  accion       text,                          -- qué acción / mecánica
  descripcion  text,
  placa_url    text,                          -- imagen de la placa (bucket Activaciones)
  creado_por   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table crm_acciones enable row level security;
drop policy if exists "anon_all_crm_acciones" on crm_acciones;
create policy "anon_all_crm_acciones" on crm_acciones
  for all to anon, authenticated using (true) with check (true);

create index if not exists crm_fecha_idx on crm_acciones(fecha);
create index if not exists crm_rubro_idx on crm_acciones(rubro);
