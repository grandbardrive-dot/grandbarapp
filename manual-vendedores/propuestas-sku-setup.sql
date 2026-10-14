-- ============================================================
--  Regla de incorporación por SKU (cada 6 meses) para el bloque
--  "A este cliente podés ofrecerle" de la visita (propuestas_incorporacion).
--  Correr en el proyecto Manual (fzaxwuuodseyyinveknn) · SQL Editor.
--
--  Cada propuesta/línea puede llevar uno o varios SKU de Aikon (separados por
--  coma o espacio). En la visita, si el cliente compró ese SKU en los últimos
--  6 meses (tabla ventas_cliente), la línea NO se le ofrece hasta que pasen 6
--  meses. Las líneas sin SKU cargado siguen apareciendo para todos (como hoy).
-- ============================================================

alter table propuestas_incorporacion add column if not exists sku text;
