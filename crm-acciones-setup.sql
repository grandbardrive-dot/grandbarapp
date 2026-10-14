-- ============================================================
--  CRM — Calendario de envíos de acciones por rubro (compartido).
--  Correr en el proyecto HUB / PORTALGRANDBAR (xqhyemccbwmzxqzkrtwa) · SQL Editor.
--  Lo usan Josefina, Nahuel, Sepúlveda y Luciana desde crm-calendario.html.
--  Los cuatro pueden agregar, editar y borrar acciones. Nadie más: la tabla quedó
--  cerrada a sus roles el 14/10/2026 (antes cualquiera con la clave pública podía
--  leer, cargar y borrar). Usa public.mi_rol(), que ya existe en el Hub.
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
drop policy if exists "crm_acciones_equipo" on crm_acciones;
create policy "crm_acciones_equipo" on crm_acciones
  for all to authenticated
  using (coalesce(public.mi_rol() in ('desarrollo','diseno','compras','torneo'), false))
  with check (coalesce(public.mi_rol() in ('desarrollo','diseno','compras','torneo'), false));
revoke all on crm_acciones from anon;

create index if not exists crm_fecha_idx on crm_acciones(fecha);
create index if not exists crm_rubro_idx on crm_acciones(rubro);
