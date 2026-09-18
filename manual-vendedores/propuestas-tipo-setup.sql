-- Formularios específicos en las propuestas de proveedores (Mix Ideal, Vino por Copa…)
-- Guardan los datos estructurados en payload (jsonb) + el tipo de formulario.
-- Correr en: Supabase proyecto Manual (fzaxwuuo) → SQL Editor.
alter table propuestas_acciones add column if not exists tipo text;
alter table propuestas_acciones add column if not exists payload jsonb default '{}'::jsonb;
