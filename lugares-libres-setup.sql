-- ============================================================
--  Lugares libres del manual: qué lugares ya se le avisaron a cada proveedor
--  (23/10/2026). La usa solo la tarea lugares-libres-cron (con la clave de
--  servicio): avisa por la campanita y el celular cuando aparecen lugares del
--  manual sin ninguna acción que ese proveedor todavía no conocía.
--  Sin políticas a propósito: desde el navegador no se lee ni se escribe.
-- ============================================================
create table if not exists public.lugares_libres_avisos (
  usuario_id uuid not null,
  lugar_id   uuid not null,          -- id de checklist_secciones (base del Manual)
  avisado_at timestamptz not null default now(),
  primary key (usuario_id, lugar_id)
);
alter table public.lugares_libres_avisos enable row level security;
