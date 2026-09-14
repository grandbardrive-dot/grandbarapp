-- ============================================================
--  Segmentación de Combos de eventos y Packs de frigobar
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--
--  Igual que segmentacion-setup.sql, pero para las dos pantallas que faltaban
--  (admin-combos.html y admin-frigobar.html). Cada fila guarda dónde se muestra:
--    secciones  uuid[]  secciones/subsecciones del manual (checklist_secciones.id)
--    zonas      text[]  'mendoza' / 'sanluis'
--  Vacío = se ve como hasta ahora.
--  Si alguna de las dos tablas todavía no existe, se saltea sin fallar.
--  Se puede correr más de una vez.
-- ============================================================

do $$
begin
  if to_regclass('public.combos_evento') is not null then
    alter table public.combos_evento
      add column if not exists secciones uuid[] not null default '{}',
      add column if not exists zonas     text[] not null default '{}';
  else
    raise notice 'No existe combos_evento: correr antes combos-evento-setup.sql';
  end if;

  if to_regclass('public.packs_frigobar') is not null then
    alter table public.packs_frigobar
      add column if not exists secciones uuid[] not null default '{}',
      add column if not exists zonas     text[] not null default '{}';
  else
    raise notice 'No existe packs_frigobar: correr antes frigobar-setup.sql';
  end if;
end $$;

-- Comprobar: tiene que listar las 2 tablas con las dos columnas
select table_name, string_agg(column_name, ', ' order by column_name) as columnas
  from information_schema.columns
 where table_schema = 'public' and column_name in ('secciones', 'zonas')
   and table_name in ('combos_evento', 'packs_frigobar')
 group by table_name order by table_name;
