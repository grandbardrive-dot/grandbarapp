-- ============================================================
--  Hub: la Agenda del equipo como herramienta propia
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  Estaba adentro del panel de Cobranzas. Pasa a ser su propia tarjeta del Hub,
--  así se entra derecho sin pasar por Cobranzas. Las tareas del equipo siguen
--  adentro del panel.
-- ============================================================

insert into public.hub_herramientas
  (id, nombre, descripcion, icono, area, roles, estado, url, orden, actualizado)
values
  ('agenda-equipo', 'Agenda del equipo',
   'Calendario compartido de administración: reuniones, vencimientos y recordatorios.',
   '📅', 'administracion', '{"admin","administracion","tesoreria"}', 'live',
   'agenda-equipo.html', 175, now())
on conflict (id) do update set
  nombre      = excluded.nombre,
  descripcion = excluded.descripcion,
  icono       = excluded.icono,
  area        = excluded.area,
  roles       = excluded.roles,
  estado      = excluded.estado,
  url         = excluded.url,
  orden       = excluded.orden,
  actualizado = now();

-- Cómo queda el área de administración.
select orden, id, nombre, url, roles
  from public.hub_herramientas
 where area = 'administracion'
 order by orden;
