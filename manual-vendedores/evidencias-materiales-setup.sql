-- ============================================================
--  EVIDENCIAS DE MATERIALES (PDV) — GrandBar
--  Foto que saca el vendedor en la visita mostrando que el cliente
--  está usando los materiales que solicitó y que le entregamos.
--  Queda guardada por cliente/visita. El recordatorio para presentarla
--  se crea como tarea en la agenda del vendedor (tabla compromisos).
--
--  Ejecutar en: Supabase (proyecto del Manual, fzaxwuuo) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists evidencias_materiales (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid,
  vendedor_id uuid,
  visita_id uuid,
  material text,                      -- nombre del material
  foto_url text not null,
  nota text,
  created_at timestamptz default now()
);

alter table evidencias_materiales enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'evidencias_materiales' and policyname = 'anon_all_evidencias_materiales') then
    create policy "anon_all_evidencias_materiales" on evidencias_materiales for all using (true) with check (true);
  end if;
end $$;

create index if not exists evidencias_materiales_cliente on evidencias_materiales (cliente_id, created_at desc);
