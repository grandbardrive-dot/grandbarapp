-- ─────────────────────────────────────────────────────────────────────────────
-- Materiales · Fase 2 · Auditoría del procesamiento de IA (Photoroom)
-- Correr en Supabase → SQL editor.  Guarda un registro por cada intento de
-- procesar una foto (proveedor, estado, urls, error, intentos).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists material_ai_jobs (
  id            uuid primary key default gen_random_uuid(),
  material_id   uuid references materials(id) on delete cascade,
  status        text,                 -- completed | failed | usa_original | none
  provider      text,                 -- ej: photoroom-v2
  original_url  text,
  processed_url text,
  error_message text,
  attempts      integer default 0,
  processed_at  timestamptz,
  created_at    timestamptz default now(),
  created_by    text
);

create index if not exists idx_ai_jobs_material on material_ai_jobs(material_id);

-- RLS permisiva (modo soft, igual que el resto de la app; el login real llega en Fase 3)
alter table material_ai_jobs enable row level security;
drop policy if exists ai_jobs_all on material_ai_jobs;
create policy ai_jobs_all on material_ai_jobs for all to anon, authenticated using (true) with check (true);
grant all on table material_ai_jobs to anon, authenticated;

-- Recargar el cache de la API
notify pgrst, 'reload schema';
