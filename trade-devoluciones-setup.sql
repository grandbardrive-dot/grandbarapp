-- ============================================================
--  Devoluciones de Trade Marketing (06/10/2026)
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--
--  Juan Pablo Sepúlveda (jefe de Trade Marketing, rol "torneo") ve todas las
--  acciones que carga Luciana (manual de vendedores y catálogos), las trabaja con
--  los vendedores y se las devuelve con observaciones. Luciana las ve en su panel
--  ("Devoluciones de Trade Marketing"), responde y las marca resueltas.
--
--  Todo pasa por la función trade-devoluciones: la tabla no se abre al navegador
--  (RLS activo y sin reglas).
-- ============================================================

create table if not exists public.acciones_devoluciones (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  origen         text not null check (origen in ('campania', 'plan', 'fecha', 'catalogo')),
  accion_id      text not null,                  -- id de la acción en su base (manual o catálogo)
  accion_nombre  text not null,
  accion_detalle jsonb not null default '{}',    -- cómo estaba la acción cuando se devolvió
  observacion    text not null,
  vendedores     text,                           -- con quiénes la trabajó (opcional)
  autor_id       uuid references auth.users(id) on delete set null,
  autor_nombre   text,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'vista', 'resuelta')),
  respuesta      text,
  respondido_por text,
  respondido_at  timestamptz
);

create index if not exists acciones_devoluciones_estado_idx on public.acciones_devoluciones (estado, created_at desc);
create index if not exists acciones_devoluciones_accion_idx on public.acciones_devoluciones (origen, accion_id);

alter table public.acciones_devoluciones enable row level security;
revoke all on public.acciones_devoluciones from anon, authenticated;

-- Control: tiene que dar 0 filas y ningún error.
select count(*) as devoluciones from public.acciones_devoluciones;
