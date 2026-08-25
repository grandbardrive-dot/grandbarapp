-- ============================================================
--  GrandBar · Fechas especiales por RUBRO (multi-select)
--  Proyecto Supabase del Manual: fzaxwuuodseyyinveknn
--  Corré esto UNA vez en el SQL Editor.
-- ============================================================

-- Columna nueva: lista de rubros a los que aplica la fecha.
alter table acciones_fechas add column if not exists rubros text[];

-- Migrar las fechas ya cargadas (que solo tenían `canal`) a la nueva lista:
update acciones_fechas set rubros = case
  when canal = 'restaurantes' then array['restaurante','bar','hotel','disco','evento']
  when canal = 'vinotecas'    then array['vinoteca','autoservicio','kiosco','mayorista']
  else array['todos']
end
where rubros is null;
