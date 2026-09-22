-- ============================================================
--  Tareas de la auditoría de los manuales (22/09/2026)
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  La lista de tareas vive en la pantalla (auditoria-tareas.html), así se
--  actualiza con un deploy y no hace falta tocar la base. Acá se guarda
--  solamente el ESTADO de cada tarea: a quién le toca, si está hecha, quién
--  la marcó y cuándo, y la nota que haya dejado.
--
--  La ven y la escriben Nahuel, Josefina, Luciana y Dirección.
-- ============================================================

-- ── Quién puede entrar ──────────────────────────────────────
-- mi_rol() ya existe (usuarios-panel-setup.sql). Se re-crea por las dudas.
create or replace function public.mi_rol()
returns text language sql security definer stable set search_path = public
as $$ select rol from public.usuarios where id = auth.uid() $$;

revoke all on function public.mi_rol() from public;
grant execute on function public.mi_rol() to authenticated;

create or replace function public.es_equipo_manual()
returns boolean language sql security definer stable set search_path = public
as $$
  select coalesce(public.mi_rol() in
    ('admin', 'desarrollo', 'diseno', 'compras', 'direccion'), false)
$$;

revoke all on function public.es_equipo_manual() from public;
grant execute on function public.es_equipo_manual() to authenticated;


-- ── El estado de cada tarea ─────────────────────────────────
create table if not exists public.auditoria_tareas (
  tarea_id    text primary key,          -- el id que usa la pantalla (bar-1, luci-3…)
  responsable text,                      -- nahuel | josefina | luciana | fernando
  hecho       boolean not null default false,
  hecho_por   text,                      -- nombre de quien la marcó
  hecho_en    timestamptz,
  nota        text,
  actualizado timestamptz not null default now()
);

create index if not exists auditoria_tareas_resp_idx on public.auditoria_tareas (responsable);


-- ── Permisos ────────────────────────────────────────────────
alter table public.auditoria_tareas enable row level security;

drop policy if exists "equipo manual lee tareas"    on public.auditoria_tareas;
drop policy if exists "equipo manual escribe tareas" on public.auditoria_tareas;

create policy "equipo manual lee tareas" on public.auditoria_tareas
  for select to authenticated using ( public.es_equipo_manual() );

create policy "equipo manual escribe tareas" on public.auditoria_tareas
  for all to authenticated
  using ( public.es_equipo_manual() ) with check ( public.es_equipo_manual() );


-- ── Que se vea al instante en la pantalla del otro ──────────
-- Sin esto igual funciona: la pantalla se actualiza al volver a la pestaña
-- y sola cada 45 segundos.
do $$
begin
  alter publication supabase_realtime add table public.auditoria_tareas;
exception when duplicate_object then null;
end $$;


-- ── Comprobar ───────────────────────────────────────────────
-- Recién creada está vacía: se llena sola a medida que marcan tareas.
select count(*) as tareas_con_estado from public.auditoria_tareas;
