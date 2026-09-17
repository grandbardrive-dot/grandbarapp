-- ============================================================
--  Agenda de Dirección: "Con quién" con nombre libre
--  Correr en el proyecto del HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--  Guarda el nombre de alguien que no es usuario del Portal (banco, contador,
--  proveedor…) en los eventos personales. Se puede correr más de una vez.
-- ============================================================
alter table public.reuniones add column if not exists con_quien text;

-- Comprobar: tiene que aparecer la columna
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'reuniones' and column_name = 'con_quien';
