-- ============================================================
--  Catálogo: nueva categoría de proveedor "aceites" (ej: Zuelo)
--  Correr en el proyecto del CATÁLOGO (zlwnoqdxendsgbfvfyue) → SQL Editor.
--
--  La tabla catalogo_proveedores solo aceptaba spirits / vinos / cervezas
--  (restricción check). Se reemplaza por una que también acepta aceites.
--  Se puede correr más de una vez.
-- ============================================================

do $$
declare r record;
begin
  -- borra la restricción vieja de categoría, se llame como se llame
  for r in
    select conname from pg_constraint
     where conrelid = 'public.catalogo_proveedores'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%categoria%'
  loop
    execute format('alter table public.catalogo_proveedores drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.catalogo_proveedores
  add constraint catalogo_proveedores_categoria_check
  check (categoria in ('spirits', 'vinos', 'cervezas', 'aceites'));

-- Comprobar: tiene que mostrar la restricción con las 4 categorías
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.catalogo_proveedores'::regclass and contype = 'c';
