-- ════════════════════════════════════════════════════════════════════════════
-- GrandBar — Refactor checklist Vinotecas
-- Tablas y columnas nuevas para: carrito de acuerdos, materiales POP,
-- nuevos productos, partners de bodegas, incorporaciones de vinoteca,
-- acciones de isla/exhibiciones especiales.
-- Ejecutar en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── IMPORTANTE: activar la nueva estructura de Vinotecas ───────────────────
-- La app prioriza checklist_secciones (DB) sobre el fallback hardcodeado.
-- Para que se muestren las 12 secciones nuevas (definidas en _checklist-data.js)
-- desactivamos las secciones viejas de vinoteca en la DB. Es reversible:
-- para volver atrás, poné activa = true nuevamente. No se borra nada.
update checklist_secciones set activa = false where canal = 'vinoteca';

-- ─── Visitas: carrito + resumen + seguimiento ───────────────────────────────
alter table visitas add column if not exists carrito           jsonb default '[]';
alter table visitas add column if not exists resumen_pdf_url    text;
alter table visitas add column if not exists proxima_accion     text;
alter table visitas add column if not exists fecha_seguimiento  date;

-- ─── Catálogo de materiales POP ─────────────────────────────────────────────
create table if not exists materiales_pop (
  id uuid default gen_random_uuid() primary key,
  categoria text not null,
  nombre text not null,
  descripcion text,
  foto_url text,
  stock_disponible boolean default true,
  activo boolean default true,
  created_at timestamptz default now()
);
alter table materiales_pop enable row level security;
drop policy if exists "anon_all_materiales" on materiales_pop;
create policy "anon_all_materiales" on materiales_pop for all using (true) with check (true);

-- ─── Nuevos productos / novedades ───────────────────────────────────────────
create table if not exists nuevos_productos (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  descripcion text,
  imagen_url text,
  ficha_url text,
  pdf_url text,
  canal text[],
  activo boolean default true,
  created_at timestamptz default now()
);
alter table nuevos_productos enable row level security;
drop policy if exists "anon_all_nuevos" on nuevos_productos;
create policy "anon_all_nuevos" on nuevos_productos for all using (true) with check (true);

-- ─── Partners y beneficios de bodegas ───────────────────────────────────────
create table if not exists partners_bodegas (
  id uuid default gen_random_uuid() primary key,
  bodega text not null,
  tipo text not null, -- 'degustacion' | 'capacitacion' | 'visita' | 'evento'
  nombre text not null,
  descripcion text,
  pdf_url text,
  imagen_url text,
  canal text[],
  activo boolean default true,
  created_at timestamptz default now()
);
alter table partners_bodegas enable row level security;
drop policy if exists "anon_all_partners" on partners_bodegas;
create policy "anon_all_partners" on partners_bodegas for all using (true) with check (true);

-- ─── Incorporaciones de vinoteca ────────────────────────────────────────────
create table if not exists incorporaciones_vinoteca (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  descripcion text,
  condicion text,          -- ej: '1+1', '1+2 Peñaflor', '%OFF'
  beneficios text,
  pdf_url text,
  imagen_url text,
  canal text[] default array['vinoteca'],
  activo boolean default true,
  created_at timestamptz default now()
);
alter table incorporaciones_vinoteca enable row level security;
drop policy if exists "anon_all_incorp" on incorporaciones_vinoteca;
create policy "anon_all_incorp" on incorporaciones_vinoteca for all using (true) with check (true);

-- ─── Acciones de Isla / Exhibiciones especiales ─────────────────────────────
create table if not exists acciones_isla (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  descripcion text,
  condicion text,
  pdf_url text,
  imagen_url text,
  canal text[] default array['vinoteca'],
  activo boolean default true,
  created_at timestamptz default now()
);
alter table acciones_isla enable row level security;
drop policy if exists "anon_all_isla" on acciones_isla;
create policy "anon_all_isla" on acciones_isla for all using (true) with check (true);

-- ─── Acciones de góndola (vinos / spirits) cargadas por admin ───────────────
-- Reutilizable para las promos de góndola vinos y spirits de vinoteca.
create table if not exists acciones_gondola (
  id uuid default gen_random_uuid() primary key,
  tipo text not null,      -- 'vinos' | 'spirits'
  marca text,
  nombre text not null,
  condicion text,          -- '1+1', '3+1', '5+1', '6+2', '%OFF'
  descripcion text,
  pdf_url text,
  imagen_url text,
  canal text[] default array['vinoteca'],
  activo boolean default true,
  created_at timestamptz default now()
);
alter table acciones_gondola enable row level security;
drop policy if exists "anon_all_gondola" on acciones_gondola;
create policy "anon_all_gondola" on acciones_gondola for all using (true) with check (true);

-- ─── Planes de vidriera (cuando NO hay acuerdo vigente) ─────────────────────
create table if not exists planes_vidriera (
  id uuid default gen_random_uuid() primary key,
  bodega text not null,    -- 'Doña Paula', 'Salentein'...
  tipo text,               -- 'Exclusiva 3 meses', 'Compartida'...
  detalle text,
  regalo text,
  pdf_url text,
  activo boolean default true,
  created_at timestamptz default now()
);
alter table planes_vidriera enable row level security;
drop policy if exists "anon_all_planes_vidriera" on planes_vidriera;
create policy "anon_all_planes_vidriera" on planes_vidriera for all using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════════════
-- Seeds opcionales (descomentar para datos de ejemplo)
-- ════════════════════════════════════════════════════════════════════════════
-- insert into planes_vidriera (bodega, tipo, detalle, regalo) values
--   ('Doña Paula', 'Exclusiva 3 meses', 'Mínimo 12 cajas/mes', '🎁 1 caja + material POP'),
--   ('Salentein',  'Compartida',        'Mínimo 6 cajas/mes Killka o Numina', '🎁 Cenefa + display');
