-- ============================================================
--  Manuales por ZONA: Mendoza y San Luis
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor
--
--  Hasta ahora el manual se elegía solo por el TIPO de cliente (restaurante,
--  vinoteca, mayorista…). San Luis necesita los mismos rubros pero con otro
--  contenido, así que se agrega una segunda dimensión: la ZONA.
--
--  Cómo queda: cada sección pertenece a un rubro Y a una zona. El vendedor ve
--  las secciones de su zona; si su zona todavía no tiene nada cargado para ese
--  rubro, ve las de Mendoza (así nada queda en blanco mientras se carga).
-- ============================================================

-- ── 1) La zona en las secciones del manual ──────────────────
alter table public.checklist_secciones
  add column if not exists zona text not null default 'mendoza';

-- Todo lo que existe hoy es de Mendoza.
update public.checklist_secciones set zona = 'mendoza' where zona is null;

-- El código de una sección era único por canal. Ahora puede repetirse entre
-- zonas (el 's0' de Mendoza y el 's0' de San Luis son secciones distintas),
-- así que la unicidad pasa a ser por canal + zona + código.
alter table public.checklist_secciones drop constraint if exists cl_sec_canal_codigo;
alter table public.checklist_secciones
  add constraint cl_sec_canal_zona_codigo unique (canal, zona, codigo);

-- Para que el manual abra rápido filtrando por las dos cosas.
create index if not exists cl_sec_canal_zona_idx
  on public.checklist_secciones (canal, zona, orden);


-- ── 2) La zona de cada vendedor ─────────────────────────────
-- Los cuatro de San Luis. El resto queda en Mendoza.
update public.vendedores set zona = 'mendoza'
 where zona is null or zona = '';

update public.vendedores set zona = 'sanluis'
 where codigo in ('041', '006', '043', '017');


-- ── 3) Comprobar cómo quedó ─────────────────────────────────
select codigo, nombre, zona from public.vendedores
 where zona = 'sanluis' order by codigo;

select zona, canal, count(*) as secciones
  from public.checklist_secciones
 group by zona, canal order by zona, canal;
