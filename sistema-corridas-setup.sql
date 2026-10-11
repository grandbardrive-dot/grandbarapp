-- ============================================================
--  Estado del sistema: registro de las tareas automáticas (10/10/2026)
--  Correr en Supabase → proyecto del HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--
--  Cada tarea automática (sync de clientes, ventas, productos, cazador de
--  clientes, avisos de reuniones) anota acá cada corrida: cuándo, si salió bien
--  y el error si falló. La función estado-sistema lo lee para saber si algo está
--  fallando o dejó de correr; n8n la consulta y avisa por WhatsApp.
--  Tabla cerrada: RLS prendido y SIN reglas (solo las funciones, con la clave
--  de servicio). Las filas de más de 30 días se borran solas.
-- ============================================================

create table if not exists public.sistema_corridas (
  id      bigint generated always as identity primary key,
  tarea   text not null,                 -- sync-clientes, sync-ventas, push-cron, sync-productos, cazar-clientes
  inicio  timestamptz not null default now(),
  fin     timestamptz,
  ok      boolean not null,
  detalle text,                          -- el error, si falló
  ms      integer
);
create index if not exists sistema_corridas_tarea_idx on public.sistema_corridas (tarea, inicio desc);

alter table public.sistema_corridas enable row level security;
-- Sin políticas a propósito.

-- Control: tiene que dar una fila con rls = true.
select relname, relrowsecurity as rls from pg_class where relname = 'sistema_corridas';
