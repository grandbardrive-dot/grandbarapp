-- ============================================================
-- TABLA: productos_grandbar — catálogo/stock completo de GrandBar
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Se carga con scripts/importar-catalogo.mjs (lee data/catalogo-grandbar.xlsx)
-- ============================================================
create table if not exists productos_grandbar (
  id                      uuid default gen_random_uuid() primary key,
  codigo                  text,
  descripcion             text,
  descripcion_normalizada text,   -- minúsculas, sin tildes ni medidas (para cruce flexible)
  stock                   int,
  um                      text,
  creado_en               timestamptz default now()
);

create index if not exists productos_grandbar_norm_idx on productos_grandbar(descripcion_normalizada);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Permisiva con anon key (mismo patrón que cartas_cliente / resto del proyecto).
-- ────────────────────────────────────────────────────────────
alter table productos_grandbar enable row level security;
create policy "anon_all_productos_grandbar" on productos_grandbar
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN (ejecutar aparte)
-- ────────────────────────────────────────────────────────────
-- select count(*) from productos_grandbar;
-- select codigo, descripcion, descripcion_normalizada, stock, um from productos_grandbar limit 20;
