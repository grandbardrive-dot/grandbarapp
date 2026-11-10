-- ============================================================
--  Campañas y planes que propone Trade Marketing (10/11/2026)
--  Juan Pablo Sepúlveda (rol torneo) carga campañas y planes con las mismas
--  pantallas que Luciana (admin-nueva-campania / admin-nuevo-plan), pero se
--  guardan sin publicar (activa / activo = false: los vendedores no las ven).
--  Luciana las revisa: las edita, le hace observaciones o las aprueba; al
--  aprobarlas se publican en el manual. La función trade-campanias cambia el
--  estado y manda los avisos.
--  revision: null = cargada por Luciana (como siempre).
--  Base del manual (fzaxwuuodseyyinveknn).
-- ============================================================
alter table public.acciones_mensuales
  add column if not exists revision text check (revision in ('pendiente', 'observada', 'aprobada', 'rechazada')),
  add column if not exists revision_autor uuid,
  add column if not exists revision_autor_nombre text,
  add column if not exists revision_nota text,           -- lo que Juan Pablo le dice a Luciana
  add column if not exists revision_obs text,            -- lo último que le contestó Luciana
  add column if not exists revision_por text,
  add column if not exists revision_at timestamptz,
  add column if not exists revision_historial jsonb not null default '[]'::jsonb;

alter table public.checklist_planes
  add column if not exists revision text check (revision in ('pendiente', 'observada', 'aprobada', 'rechazada')),
  add column if not exists revision_autor uuid,
  add column if not exists revision_autor_nombre text,
  add column if not exists revision_nota text,
  add column if not exists revision_obs text,
  add column if not exists revision_por text,
  add column if not exists revision_at timestamptz,
  add column if not exists revision_historial jsonb not null default '[]'::jsonb;

create index if not exists acciones_mensuales_revision on public.acciones_mensuales (revision) where revision is not null;
create index if not exists checklist_planes_revision on public.checklist_planes (revision) where revision is not null;
