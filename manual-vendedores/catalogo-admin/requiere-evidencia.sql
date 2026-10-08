-- Cartel "Requiere evidencia" en las acciones del catálogo (08/10/2026).
-- Correr en Supabase, proyecto del CATÁLOGO (zlwnoqdxendsgbfvfyue) → SQL Editor.
-- Luciana lo marca por acción desde su panel (Catálogo clientes → columna "evidencia"
-- o al crear la acción). Sale en catalogoon.com / catalogooff.com y en la oferta de la visita.
-- No toca permisos: la columna queda bajo las mismas políticas que el resto de la tabla.

alter table public.catalogo_acciones
  add column if not exists requiere_evidencia boolean not null default false;

notify pgrst, 'reload schema';

-- Control: tiene que dar una fila con "requiere_evidencia".
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'catalogo_acciones' and column_name = 'requiere_evidencia';
