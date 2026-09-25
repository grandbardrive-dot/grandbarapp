-- ============================================================
--  Cuentas de los tres supervisores (25/09/2026)
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  Los tres supervisan Y venden. Para que el Portal les muestre el menú de
--  supervisor (con su bloque de vendedor), su fila en `usuarios` tiene que tener:
--    · es_supervisor = true
--    · rol = 'ventas' (el de vendedor; lo de supervisor lo marca es_supervisor)
--    · canal y región de lo que supervisan (arma su equipo):
--        Martín Juárez       → San Luis, los dos canales
--        Diego Sebastianelli → Mendoza, canal OFF
--        Juan Pablo Mollar   → Mendoza, canal ON
--  No se toca su código de vendedor: siguen viendo su propia cartera.
-- ============================================================

-- 1) Cómo están hoy (mirar antes de cambiar)
select u.nombre, a.email, u.rol, u.es_supervisor, u.canal, u.region, u.codigo_vendedor
from public.usuarios u
join auth.users a on a.id = u.id
where u.nombre ilike 'mart%ju%rez%'
   or u.nombre ilike 'diego%sebastian%'
   or u.nombre ilike '%mollar%'
order by u.nombre;

-- 2) Dejarlos como supervisores (cada update toca una sola persona)
update public.usuarios set es_supervisor = true, rol = 'ventas', region = 'san_luis', canal = 'ambos'
where nombre ilike 'mart%ju%rez%';

update public.usuarios set es_supervisor = true, rol = 'ventas', region = 'mendoza', canal = 'off'
where nombre ilike 'diego%sebastian%';

update public.usuarios set es_supervisor = true, rol = 'ventas', region = 'mendoza', canal = 'on'
where nombre ilike '%mollar%';

-- 3) Control: tienen que salir los tres con es_supervisor = true
select u.nombre, a.email, u.rol, u.es_supervisor, u.canal, u.region, u.codigo_vendedor
from public.usuarios u
join auth.users a on a.id = u.id
where u.nombre ilike 'mart%ju%rez%'
   or u.nombre ilike 'diego%sebastian%'
   or u.nombre ilike '%mollar%'
order by u.nombre;
