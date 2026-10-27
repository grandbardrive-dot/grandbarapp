-- ============================================================
--  Presupuestos (Marketing) — compartido.
--  Correr en el proyecto HUB / PORTALGRANDBAR (xqhyemccbwmzxqzkrtwa) · SQL Editor.
--  Lo usan Josefina (Diseño), Nahuel (Desarrollo), Sepúlveda (Trade) y
--  Fernando (Dirección) desde mi-panel.html y presupuestos.html.
--  Los cuatro pueden ver, agregar, editar y borrar. Nadie más.
--  Usa public.mi_rol(), que ya existe en el Hub.
-- ============================================================

create table if not exists presupuestos (
  id             uuid primary key default gen_random_uuid(),
  proveedor      text not null,                -- nombre del proveedor
  link           text,                         -- link al proveedor / web / cotización
  foto_url       text,                         -- imagen del presupuesto o del producto (bucket Activaciones)
  estado         text not null default 'consultado', -- consultado | pedir | pedido | aceptado | rechazado
  minimo_compra  text,                         -- condición: mínimo de compra
  costos         text,                         -- condición: costos / precios / condiciones
  notas          text,
  creado_por     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table presupuestos enable row level security;
drop policy if exists "anon_all_presupuestos" on presupuestos;
drop policy if exists "presupuestos_equipo" on presupuestos;
create policy "presupuestos_equipo" on presupuestos
  for all to authenticated
  using (coalesce(public.mi_rol() in ('desarrollo','diseno','torneo','direccion','admin'), false))
  with check (coalesce(public.mi_rol() in ('desarrollo','diseno','torneo','direccion','admin'), false));
revoke all on presupuestos from anon;

create index if not exists presupuestos_estado_idx on presupuestos(estado);
create index if not exists presupuestos_creado_idx on presupuestos(created_at desc);
