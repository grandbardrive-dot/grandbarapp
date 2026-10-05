-- ============================================================
--  Panel del equipo de administración (05/10/2026)
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--
--  Sebastián (analista de datos), Andrea (facturación), Laura (pagos y
--  proveedores) y Khaty (contadora) tienen su panel: equipo-panel.html.
--  Rol nuevo: equipo_admin. Ven sus tareas (las asigna Brenda), la agenda del
--  equipo (compartida con Brenda y Mónica) y su agenda personal.
-- ============================================================

-- 1) El rol nuevo entra a las tablas del equipo (tareas y agenda compartida).
create or replace function public.es_area_admin()
returns boolean language sql security definer stable set search_path = public
as $$
  select coalesce(public.mi_rol() in
    ('admin', 'administracion', 'tesoreria', 'desarrollo', 'diseno', 'equipo_admin'), false)
$$;
revoke all on function public.es_area_admin() from public;
grant execute on function public.es_area_admin() to authenticated;

-- 2) Nombres y puestos del equipo (Seba → Sebastián, Katy → Khaty).
update public.admin_equipo set nombre = 'Sebastián', puesto = 'Analista de datos'   where nombre in ('Seba', 'Sebastián', 'Sebastian');
update public.admin_equipo set puesto = 'Facturación'                               where nombre = 'Andrea';
update public.admin_equipo set puesto = 'Pagos y proveedores'                       where nombre = 'Laura';
update public.admin_equipo set nombre = 'Khaty', puesto = 'Contadora'               where nombre in ('Katy', 'Khaty');

-- 3) Las cuentas: primero se crean en Authentication → Users (una por persona).
--    Después, el rol se elige en el panel de Usuarios de Desarrollo/Diseño
--    ("Equipo de administración") o con esta línea, cambiando los mails:
-- update public.usuarios set rol = 'equipo_admin'
--  where lower(email) in ('mail-de-sebastian@…', 'mail-de-andrea@…', 'mail-de-laura@…', 'mail-de-khaty@…');
--    La primera vez que cada una entra a su panel, queda vinculada sola a su fila
--    del equipo (por el nombre). Si el nombre de la cuenta no coincide, vincularla así:
-- update public.admin_equipo set usuario_id = (select id from public.usuarios where lower(email) = lower('mail@…'))
--  where nombre = 'Laura';

-- 4) Control
select e.nombre, e.puesto, e.activo, u.nombre as cuenta, u.rol
from public.admin_equipo e left join public.usuarios u on u.id = e.usuario_id
order by e.orden;
