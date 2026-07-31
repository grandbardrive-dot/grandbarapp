-- ============================================================
-- TABLA: cartas_cliente — fotos de la carta/menú de cada cliente
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Las fotos se guardan en Storage (bucket "Activaciones", prefijo cartas/)
-- y cada foto queda registrada acá, atada al cliente_id de la visita.
-- ============================================================
create table if not exists cartas_cliente (
  id                  uuid default gen_random_uuid() primary key,
  cliente_id          uuid references clientes(id) on delete cascade,
  foto_url            text not null,
  vendedor_codigo     text,                       -- vendedor.codigo de la visita (si está)
  creado_en           timestamptz not null default now(),

  -- ── Preparado para el paso de IA (NO se usa todavía) ──
  productos_extraidos jsonb,                       -- nullable: se completa con la extracción IA
  estado_extraccion   text not null default 'pendiente'  -- pendiente | procesando | listo | error
);

create index if not exists cartas_cliente_cliente_idx on cartas_cliente(cliente_id);
create index if not exists cartas_cliente_creado_idx  on cartas_cliente(creado_en desc);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Permisiva con anon key (igual que el resto de la app — herramienta interna).
-- ────────────────────────────────────────────────────────────
alter table cartas_cliente enable row level security;
create policy "anon_all_cartas_cliente" on cartas_cliente
  for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN (ejecutar aparte)
-- ────────────────────────────────────────────────────────────
-- select * from cartas_cliente order by creado_en desc;
