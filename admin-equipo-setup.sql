-- ============================================================
--  Equipo de administración: agenda compartida y tareas
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  Brenda supervisa a Mónica, Andrea, Laura, Katy y Seba. Hoy solo Mónica tiene
--  cuenta en el Portal, así que el tablero está pensado para funcionar igual:
--  las personas del equipo son filas de una tabla, no cuentas. Cuando alguna
--  tenga cuenta, se le carga el usuario_id y empieza a ver lo suyo sin cambiar
--  nada de lo que ya esté cargado.
--
--  Es aparte del sistema de tareas de los vendedores (tabla 'tareas'), que se
--  arma por canal y código de vendedor: acá no hay ni canal ni código.
-- ============================================================

-- ── Quién puede entrar ──────────────────────────────────────
-- mi_rol() ya existe (usuarios-panel-setup.sql). Se re-crea por las dudas.
create or replace function public.mi_rol()
returns text language sql security definer stable set search_path = public
as $$ select rol from public.usuarios where id = auth.uid() $$;

revoke all on function public.mi_rol() from public;
grant execute on function public.mi_rol() to authenticated;

create or replace function public.es_area_admin()
returns boolean language sql security definer stable set search_path = public
as $$
  select coalesce(public.mi_rol() in
    ('admin', 'administracion', 'tesoreria', 'desarrollo', 'diseno'), false)
$$;

revoke all on function public.es_area_admin() from public;
grant execute on function public.es_area_admin() to authenticated;


-- ── 1) Las personas del equipo ──────────────────────────────
create table if not exists public.admin_equipo (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  puesto     text,
  usuario_id uuid,                      -- cuenta del Portal, cuando tenga
  orden      int  not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_equipo (nombre, puesto, orden) values
  ('Mónica', 'Tesorería',      10),
  ('Andrea', 'Administración', 20),
  ('Laura',  'Administración', 30),
  ('Katy',   'Administración', 40),
  ('Seba',   'Administración', 50)
on conflict (nombre) do nothing;


-- ── 2) Las tareas de cada una ───────────────────────────────
--  frecuencia: 'diaria'   → todos los días
--              'habiles'  → de lunes a viernes
--              'semanal'  → un día fijo de la semana (dia_semana 1=lunes … 7=domingo)
--              'puntual'  → una sola fecha
create table if not exists public.admin_tareas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descripcion text,
  persona_id  uuid references public.admin_equipo(id) on delete cascade,
  frecuencia  text not null default 'diaria'
              check (frecuencia in ('diaria', 'habiles', 'semanal', 'puntual')),
  dia_semana  int check (dia_semana between 1 and 7),
  fecha       date,
  activa      boolean not null default true,
  creado_por  text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_tareas_persona_idx on public.admin_tareas (persona_id, activa);

-- Una tarea se marca hecha una vez por día: así una tarea diaria se puede
-- seguir día por día sin duplicar la tarea.
create table if not exists public.admin_tareas_hechas (
  id         uuid primary key default gen_random_uuid(),
  tarea_id   uuid not null references public.admin_tareas(id) on delete cascade,
  fecha      date not null default current_date,
  quien      text,
  created_at timestamptz not null default now(),
  unique (tarea_id, fecha)
);

create index if not exists admin_tareas_hechas_fecha_idx on public.admin_tareas_hechas (fecha);


-- ── 3) La agenda compartida ─────────────────────────────────
--  persona_id en null = es de todo el equipo.
create table if not exists public.admin_agenda (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  detalle    text,
  fecha      date not null,
  hora       time,
  persona_id uuid references public.admin_equipo(id) on delete set null,
  tipo       text not null default 'evento'
             check (tipo in ('evento', 'reunion', 'vencimiento', 'recordatorio')),
  creado_por text,
  created_at timestamptz not null default now()
);

create index if not exists admin_agenda_fecha_idx on public.admin_agenda (fecha);


-- ── 4) Permisos ─────────────────────────────────────────────
alter table public.admin_equipo        enable row level security;
alter table public.admin_tareas        enable row level security;
alter table public.admin_tareas_hechas enable row level security;
alter table public.admin_agenda        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['admin_equipo', 'admin_tareas', 'admin_tareas_hechas', 'admin_agenda'] loop
    execute format('drop policy if exists "area admin lee %1$s"    on public.%1$I', t);
    execute format('drop policy if exists "area admin escribe %1$s" on public.%1$I', t);
    execute format('create policy "area admin lee %1$s" on public.%1$I
                      for select to authenticated using ( public.es_area_admin() )', t);
    execute format('create policy "area admin escribe %1$s" on public.%1$I
                      for all to authenticated
                      using ( public.es_area_admin() ) with check ( public.es_area_admin() )', t);
  end loop;
end $$;


-- ── 5) Comprobar ────────────────────────────────────────────
select nombre, puesto, activo from public.admin_equipo order by orden;
