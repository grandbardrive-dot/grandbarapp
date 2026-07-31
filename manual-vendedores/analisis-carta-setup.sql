-- ============================================================
-- TABLA: analisis_carta — resultado del análisis IA de la carta (1 fila por cliente)
-- Ejecutar en Supabase → SQL Editor.
--
-- Por qué: la background function (analizar-carta-background) y el front
-- (pollProductosExtraccion, cargarProductosGuardados, guardarProductosCarta,
-- marcarEstadoExtraccion) usan esta tabla con upsert on_conflict=cliente_id.
-- Sin ella, cada análisis escribe en el vacío (404) y el polling espera los
-- 3 minutos completos antes de rendirse → "demora más de lo normal".
--
-- Nota: cartas_cliente (1 fila por FOTO) sigue guardando las fotos. Esta tabla
-- guarda el resultado consolidado por cliente.
-- ============================================================
create table if not exists analisis_carta (
  id                  uuid default gen_random_uuid() primary key,
  cliente_id          uuid not null unique references clientes(id) on delete cascade,
  productos_extraidos jsonb,
  estado_extraccion   text not null default 'pendiente', -- pendiente | procesando | procesado | listo | error
  vendedor_codigo     text,
  actualizado_en      timestamptz not null default now()
);

create index if not exists analisis_carta_cliente_idx on analisis_carta(cliente_id);

alter table analisis_carta enable row level security;
drop policy if exists "anon_all_analisis_carta" on analisis_carta;
create policy "anon_all_analisis_carta" on analisis_carta
  for all using (true) with check (true);
