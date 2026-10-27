-- ============================================================
--  Tareas que Josefina le asigna a Nahuel (agenda compartida).
--  Correr en el proyecto HUB / PORTALGRANDBAR (xqhyemccbwmzxqzkrtwa) · SQL Editor.
-- ============================================================

create table if not exists tareas_para_nahuel (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  detalle       text,
  prioridad     text default 'media',     -- alta | media | baja
  fecha_limite  date,
  estado        text default 'pendiente', -- pendiente | en_curso | hecha
  creado_por    text,
  created_at    timestamptz default now(),
  hecha_at      timestamptz
);

-- La app entra AUTENTICADA (GBAuth), no como anon: la policy tiene que ser
-- para authenticated o el insert falla con "violates row-level security policy".
-- La usan Josefina (diseno) que asigna y Nahuel (desarrollo) que gestiona.
alter table tareas_para_nahuel enable row level security;
drop policy if exists "anon_all_tareas_para_nahuel" on tareas_para_nahuel;
drop policy if exists "tareas_para_nahuel_equipo" on tareas_para_nahuel;
create policy "tareas_para_nahuel_equipo" on tareas_para_nahuel
  for all to authenticated
  using (coalesce(public.mi_rol() in ('diseno','desarrollo','admin'), false))
  with check (coalesce(public.mi_rol() in ('diseno','desarrollo','admin'), false));
revoke all on tareas_para_nahuel from anon;

create index if not exists tpn_estado_idx on tareas_para_nahuel(estado);
create index if not exists tpn_fecha_idx  on tareas_para_nahuel(created_at desc);
