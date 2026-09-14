-- ============================================================
--  Segmentación de las acciones y planes de Luciana
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--
--  Cada herramienta de carga (campañas, planes, vino por copa, aperitivos,
--  propuestas, mix ideal, fechas especiales) pasa a guardar dónde se muestra:
--    secciones  uuid[]  secciones/subsecciones del manual (checklist_secciones.id)
--    zonas      text[]  'mendoza' / 'sanluis'
--  Vacío = se ve como hasta ahora. El catálogo de acciones está en otro proyecto:
--  ver segmentacion-catalogo-setup.sql.
--  Se puede correr más de una vez.
-- ============================================================

alter table public.acciones_mensuales
  add column if not exists secciones uuid[] not null default '{}',
  add column if not exists zonas     text[] not null default '{}';

alter table public.checklist_planes
  add column if not exists secciones uuid[] not null default '{}',
  add column if not exists zonas     text[] not null default '{}';

alter table public.vinos_por_copa
  add column if not exists secciones uuid[] not null default '{}',
  add column if not exists zonas     text[] not null default '{}';

alter table public.aperitivos_bienvenida
  add column if not exists secciones uuid[] not null default '{}',
  add column if not exists zonas     text[] not null default '{}';

alter table public.propuestas_incorporacion
  add column if not exists secciones uuid[] not null default '{}',
  add column if not exists zonas     text[] not null default '{}';

alter table public.mixes_ideales
  add column if not exists secciones uuid[] not null default '{}',
  add column if not exists zonas     text[] not null default '{}';

alter table public.acciones_fechas
  add column if not exists secciones uuid[] not null default '{}',
  add column if not exists zonas     text[] not null default '{}';

-- Planes: la pantalla ya intentaba guardar varias secciones, pero faltaba la
-- columna y quedaba solo la primera (seccion_id). Se completa con esa.
update public.checklist_planes
   set secciones = array[seccion_id]
 where seccion_id is not null and secciones = '{}';

-- Comprobar: tiene que listar las 7 tablas con las dos columnas
select table_name, string_agg(column_name, ', ' order by column_name) as columnas
  from information_schema.columns
 where table_schema = 'public' and column_name in ('secciones', 'zonas')
   and table_name in ('acciones_mensuales','checklist_planes','vinos_por_copa','aperitivos_bienvenida',
                      'propuestas_incorporacion','mixes_ideales','acciones_fechas')
 group by table_name order by table_name;
