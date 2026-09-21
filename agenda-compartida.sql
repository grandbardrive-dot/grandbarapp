-- ============================================================
--  Agenda para todos los paneles (21/09/2026)
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  1) `grupo` junta las filas de una misma reunión con varios invitados
--     (una fila por invitado, todas con el mismo grupo). Las reuniones
--     viejas quedan sin grupo y siguen andando igual.
--  2) Índices para que cada uno traiga rápido lo suyo.
--  3) La tarjeta "Mi agenda" en el Hub (Depósito, Mayorista, Compras,
--     Diseño, Desarrollo, Administración, Tesorería…).
-- ============================================================

alter table public.reuniones add column if not exists grupo uuid;
alter table public.reuniones add column if not exists con_quien text;

create index if not exists reuniones_grupo_idx      on public.reuniones (grupo);
create index if not exists reuniones_usuario_idx    on public.reuniones (usuario_id, fecha);
create index if not exists reuniones_creado_por_idx on public.reuniones (creado_por, fecha);

insert into public.hub_herramientas
  (id, nombre, descripcion, icono, area, roles, estado, url, orden, actualizado)
values
  ('mi-agenda', 'Mi agenda',
   'Tus eventos y reuniones. Lo que agendás con alguien del Portal le aparece en su agenda y le llega el aviso.',
   '📅', 'agenda',
   '{"admin","administracion","tesoreria","compras","diseno","desarrollo","marketing","deposito","mayorista","reportes"}',
   'live', 'mi-agenda.html', 1, now())
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

-- Control: tiene que aparecer la columna grupo y la tarjeta.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'reuniones' and column_name in ('grupo', 'con_quien');
select id, nombre, area, roles from public.hub_herramientas where id = 'mi-agenda';
