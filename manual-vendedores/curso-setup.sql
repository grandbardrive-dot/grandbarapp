-- ============================================================
--  Curso obligatorio de vendedores — GrandBar Hub
--  El curso se arma solo desde el manual (checklist_secciones):
--    módulo = rubro del canal del vendedor · lección = sección del rubro.
--  Acá solo guardamos el PROGRESO de cada vendedor y la config
--  (fecha límite por canal). El contenido y las preguntas viven en
--  la function curso.js (las respuestas correctas nunca llegan al
--  navegador: el quiz se corrige en el servidor).
--
--  Correr en: Supabase proyecto Manual (fzaxwuuo) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

-- Progreso por vendedor: una fila por lección vista y por módulo aprobado.
create table if not exists curso_progreso (
  id uuid primary key default gen_random_uuid(),
  vendedor_codigo text not null,          -- código del vendedor (usuarios.codigo_vendedor)
  canal text not null,                     -- 'on' | 'off' (el canal del vendedor)
  rubro text not null,                     -- rubro/módulo (canal del manual: 'restaurante', 'bar', ...)
  leccion text,                            -- código de la sección/lección; null = fila de módulo (quiz)
  tipo text not null default 'leccion',    -- 'leccion' | 'modulo'
  completado boolean not null default true,
  nota integer,                            -- % de acierto del quiz (solo en filas de módulo)
  aprobado boolean,                        -- pasó la nota mínima (solo módulo)
  updated_at timestamptz not null default now(),
  unique (vendedor_codigo, rubro, leccion, tipo)
);

alter table curso_progreso enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='curso_progreso' and policyname='curso_progreso_anon_all') then
    create policy curso_progreso_anon_all on curso_progreso for all using (true) with check (true);
  end if;
end $$;
create index if not exists curso_progreso_vend on curso_progreso (vendedor_codigo);

-- Config del curso por canal: fecha límite y si está activo.
create table if not exists curso_config (
  canal text primary key,                  -- 'on' | 'off'
  fecha_limite date,
  nota_minima integer not null default 70, -- % para aprobar cada módulo
  activo boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table curso_config enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='curso_config' and policyname='curso_config_anon_all') then
    create policy curso_config_anon_all on curso_config for all using (true) with check (true);
  end if;
end $$;

-- Config inicial (editá la fecha límite cuando quieras).
insert into curso_config (canal, fecha_limite, nota_minima, activo)
  values ('on', null, 70, true), ('off', null, 70, true)
on conflict (canal) do nothing;
