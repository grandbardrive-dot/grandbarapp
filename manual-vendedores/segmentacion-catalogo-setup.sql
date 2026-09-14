-- ============================================================
--  Segmentación del catálogo de acciones
--  Correr en el proyecto del CATÁLOGO (zlwnoqdxendsgbfvfyue) → SQL Editor.
--
--  Las ofertas del catálogo (catalogoon / catalogooff) se ubican solas en la
--  visita según la categoría del proveedor. Ahora Luciana puede marcar en qué
--  secciones y zonas del manual aparece cada una:
--    secciones  uuid[]  ids de checklist_secciones (están en el proyecto del manual)
--    zonas      text[]  'mendoza' / 'sanluis'
--  Vacío = se ubica sola, como hasta ahora. No cambia nada en los sitios públicos.
--  Se puede correr más de una vez.
-- ============================================================

alter table public.catalogo_acciones
  add column if not exists secciones uuid[] not null default '{}',
  add column if not exists zonas     text[] not null default '{}';

-- Comprobar
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'catalogo_acciones' and column_name in ('secciones', 'zonas');
