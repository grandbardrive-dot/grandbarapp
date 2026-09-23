-- ============================================================
--  Sacar los checklist de TODOS los manuales (23/09/2026)
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor
--
--  Las secciones, los textos, las herramientas, los planes, las ofertas y las
--  observaciones quedan igual. Lo único que se va son las tareas para tildar.
--
--  Antes de borrar se guarda una copia completa en otra tabla, por si alguna
--  vez hay que volver atrás. La visita ya está preparada: cuando un manual no
--  tiene tareas, no muestra la barra de avance ni los contadores 0/3.
-- ============================================================

-- 1) Copia de seguridad (queda en la misma base, no se borra sola)
create table if not exists public.checklist_items_backup_20260923 as
  select * from public.checklist_items;

select count(*) as tareas_respaldadas from public.checklist_items_backup_20260923;

-- 2) Borrar las tareas de todos los manuales
delete from public.checklist_items;

-- 3) Control: tiene que dar 0
select count(*) as tareas_que_quedan from public.checklist_items;

-- ── Para volver atrás (NO correr ahora) ─────────────────────
-- insert into public.checklist_items select * from public.checklist_items_backup_20260923;
