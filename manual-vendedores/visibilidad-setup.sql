-- ============================================================
--  OPORTUNIDADES DE VISIBILIDAD (Bar) — GrandBar
--  Registro rápido de dónde hay espacio para ganar visibilidad
--  (barra, backbar, mesas, heladera, terraza, ingreso, carta),
--  con foto y una nota corta. Queda pendiente y en la PRÓXIMA visita
--  el vendedor ve el recordatorio de presentar una propuesta.
--
--  Ejecutar en: Supabase (proyecto del Manual, fzaxwuuo) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists oportunidades_visibilidad (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid,
  vendedor_id uuid,
  ubicacion text,                    -- Barra / Backbar / Mesas / Heladera / Terraza / Ingreso / Carta
  nota text,
  foto_url text,
  estado text default 'pendiente',   -- pendiente / presentada
  created_at timestamptz default now()
);

alter table oportunidades_visibilidad enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'oportunidades_visibilidad' and policyname = 'anon_all_oportunidades_visibilidad') then
    create policy "anon_all_oportunidades_visibilidad" on oportunidades_visibilidad for all using (true) with check (true);
  end if;
end $$;

create index if not exists oportunidades_visibilidad_cliente on oportunidades_visibilidad (cliente_id, created_at desc);
