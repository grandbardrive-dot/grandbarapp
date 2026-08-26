-- ============================================================
--  Corregir el nombre de Luciana (era "Luciana Pérez" → "Luciana Buenanueva")
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  1) Su ficha en usuarios (de acá sale el autor de los reportes y la campanita).
--  2) Los reportes que ya se enviaron con el nombre viejo (guardan una copia).
-- ============================================================

-- Ver primero a quién va a tocar (opcional):
-- select id, nombre, email, rol from public.usuarios where nombre ilike 'luciana p%';

update public.usuarios
   set nombre = 'Luciana Buenanueva'
 where nombre ilike 'luciana p%';          -- Luciana Pérez / Luciana Perez

update public.reportes
   set autor_nombre = 'Luciana Buenanueva'
 where autor_nombre ilike 'luciana p%';
