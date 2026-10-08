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

alter table tareas_para_nahuel enable row level security;
drop policy if exists "anon_all_tareas_para_nahuel" on tareas_para_nahuel;
create policy "anon_all_tareas_para_nahuel" on tareas_para_nahuel
  for all to anon using (true) with check (true);

create index if not exists tpn_estado_idx on tareas_para_nahuel(estado);
create index if not exists tpn_fecha_idx  on tareas_para_nahuel(created_at desc);
