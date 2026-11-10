-- ============================================================
--  Acciones del catálogo que propone Trade Marketing (10/11/2026)
--  Juan Pablo Sepúlveda (rol torneo) carga una acción como lo hace Luciana en el
--  catálogo de clientes, pero no se publica: le llega a Luciana, que la revisa, la
--  edita o le hace observaciones, y recién cuando la aprueba se crea en
--  catalogo_acciones (base del catálogo) y sale en el catálogo y en el manual.
--  Base del Portal (Hub). Cerrada al navegador: solo la función trade-catalogo
--  (service role) la lee y la escribe.
-- ============================================================
create table if not exists public.trade_catalogo_propuestas (
  id            uuid primary key default gen_random_uuid(),
  autor_id      uuid not null,
  autor_nombre  text,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'observada', 'aprobada', 'rechazada')),
  datos         jsonb not null,                    -- los campos de catalogo_acciones
  nota          text,                              -- lo que Juan Pablo le dice a Luciana
  observacion   text,                              -- lo último que le contestó Luciana
  historial     jsonb not null default '[]'::jsonb, -- [{fecha, quien, que, texto}]
  revisado_por  text,
  revisado_at   timestamptz,
  accion_id     uuid,                              -- catalogo_acciones.id, al aprobarla
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists trade_catalogo_propuestas_estado on public.trade_catalogo_propuestas (estado, created_at desc);
create index if not exists trade_catalogo_propuestas_autor on public.trade_catalogo_propuestas (autor_id, created_at desc);

alter table public.trade_catalogo_propuestas enable row level security;
revoke all on public.trade_catalogo_propuestas from anon, authenticated;
