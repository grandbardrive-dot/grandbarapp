-- ============================================================
--  Sync de productos del ERP → productos_grandbar
--  Correr en el proyecto MANUAL (fzaxwuuodseyyinveknn) · SQL Editor.
--  Deja la tabla lista para que sync-productos-background haga UPSERT por codigo.
-- ============================================================

-- 1) Columna con la fecha de la última actualización desde el ERP (si no existe).
alter table productos_grandbar
  add column if not exists actualizado_en timestamptz;

-- 2) Sacar códigos duplicados (nos quedamos con una fila por codigo).
--    Necesario antes de crear el índice único; si no hay duplicados, no borra nada.
delete from productos_grandbar a
using productos_grandbar b
where a.ctid < b.ctid
  and a.codigo = b.codigo;

-- 3) Índice único en codigo → habilita el UPSERT (on_conflict=codigo).
create unique index if not exists productos_grandbar_codigo_key
  on productos_grandbar (codigo);

-- Listo. A partir de acá:
--   - El cron sync-productos-cron corre 1×/día y refresca stock + altas nuevas.
--   - Para forzar la primera carga ahora, abrir en el navegador (logueado como
--     admin no hace falta, va con la clave):
--     https://portalgrandbar.com/.netlify/functions/sync-productos-background?key=<SYNC_SECRET>
