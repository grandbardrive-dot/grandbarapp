-- ============================================================
-- TABLA ACCIONES MENSUALES — GrandBar
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists acciones_mensuales (
  id               uuid default gen_random_uuid() primary key,
  categoria        text not null,          -- 'vinos' | 'spirits'
  producto         text not null,
  varietales       text,                   -- null si no aplica
  accion           text not null,          -- ej: '2+1', '5+1', 'Precio especial'
  precio_accionado numeric,                -- en pesos, null si no aplica
  aplica_a         text[] not null,        -- ['vinotecas','restaurantes','autoservicios'] o ['todos']
  fecha_inicio     date not null,
  fecha_fin        date not null,
  imagen_url       text,
  activa           boolean default true,
  created_at       timestamptz default now()
);

alter table acciones_mensuales enable row level security;
create policy "anon_all_acciones_mensuales" on acciones_mensuales
  for all using (true) with check (true);

-- Índices
create index if not exists am_activa_idx  on acciones_mensuales(activa);
create index if not exists am_cat_idx     on acciones_mensuales(categoria);
create index if not exists am_fechas_idx  on acciones_mensuales(fecha_inicio, fecha_fin);
