-- ============================================================
--  Vino por Copa · elegir en qué rubros aparece cada vino
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--
--  Hasta ahora cada vino que cargaba Luciana (Campañas → Vino por Copa) salía
--  en todos los manuales que tienen esa sección. Ahora elige: Restaurantes,
--  Bares, Discos, Hoteles (en hoteles es "Copa de bienvenida"). Sin ninguno marcado = aparece en todos (así los vinos que ya
--  estaban cargados siguen igual).
--  Los valores son el rubro del manual: 'restaurante', 'bar', 'disco', 'hotel'.
--  Se puede correr más de una vez.
-- ============================================================

alter table public.vinos_por_copa
  add column if not exists rubros text[] not null default '{}';

-- Comprobar
select nombre, proveedor, rubros, activo from public.vinos_por_copa order by orden;
