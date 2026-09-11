-- ============================================================
--  FECHAS & ACTIVACIONES (Bar) — GrandBar
--  El vendedor registra en la visita las próximas fechas del bar
--  (aniversario, show, happy hour…), les propone una activación
--  (con ayuda de IA) y hace seguimiento. Queda guardado por cliente
--  para próximas visitas y genera recordatorios en la agenda.
--
--  Ejecutar en: Supabase (proyecto del Manual, fzaxwuuo) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists fechas_bar (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid,
  vendedor_id uuid,
  tipo text,                         -- Evento propio / DJ o show / Aniversario / Fecha especial / Happy Hour
  nombre text,                       -- "Aniversario del bar"
  fecha date,
  asistencia integer,                -- asistencia estimada (opcional)
  estado text default 'sin_trabajar',-- sin_trabajar / pendiente / aprobada / hecha
  activacion_tipos text[] default '{}', -- Trago especial / Happy Hour / Combo / Degustación / Presencia de marca / Materiales
  activacion_producto text,          -- marca/producto elegido
  activacion_sugerencia text,        -- sugerencia de la IA
  recordar_dias integer,             -- recordar N días antes
  created_at timestamptz default now()
);

alter table fechas_bar enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'fechas_bar' and policyname = 'anon_all_fechas_bar') then
    create policy "anon_all_fechas_bar" on fechas_bar for all using (true) with check (true);
  end if;
end $$;

create index if not exists fechas_bar_cliente on fechas_bar (cliente_id, fecha);
