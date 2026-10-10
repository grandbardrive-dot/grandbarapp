-- ============================================================
--  Mi asistente (Brenda, administración) — 10/10/2026
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  Un asistente que Brenda va educando:
--   · asistente_charlas     las conversaciones (cada una de su dueña)
--   · asistente_lecciones   lo que aprendió: solo se guarda cuando ella toca "Guardar"
--   · asistente_pendientes  lo que le pidieron y todavía no puede hacer
--                           (le sirve a Desarrollo para saber qué agregarle)
--
--  Las tres tablas quedan CERRADAS: RLS prendido y sin ninguna regla, así que
--  desde el navegador no se lee ni se escribe nada. Todo pasa por las functions
--  asistente y asistente-background, que verifican la sesión y el rol y usan la
--  llave de servicio. Las conversaciones las ve solo su dueña; las lecciones y
--  los pendientes, su dueña y Desarrollo (decidido 10/10/2026).
-- ============================================================

create table if not exists public.asistente_charlas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null,
  titulo          text,
  -- La conversación tal cual se le manda a Claude (con los bloques de
  -- pensamiento sin tocar: si se editan, la API los rechaza). Solo se agrega.
  mensajes        jsonb not null default '[]'::jsonb,
  -- Lecciones que propuso el asistente: { tool_use_id: {texto, estado} }
  propuestas      jsonb not null default '{}'::jsonb,
  -- Con qué versión de "lo que aprendió" viene hablando y qué día le avisamos
  lecciones_hash  text,
  ultima_fecha    date,
  estado          text not null default 'listo'
                  check (estado in ('listo', 'pensando', 'trabajando', 'error')),
  error           text,
  pensando_desde  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists asistente_charlas_usuario_idx on public.asistente_charlas (usuario_id, updated_at desc);

create table if not exists public.asistente_lecciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null,
  texto       text not null check (length(texto) between 1 and 2000),
  origen      text not null default 'propuesta' check (origen in ('propuesta', 'manual')),
  charla_id   uuid references public.asistente_charlas(id) on delete set null,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists asistente_lecciones_usuario_idx on public.asistente_lecciones (usuario_id, activa);

create table if not exists public.asistente_pendientes (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null,
  pedido          text not null,
  que_haria_falta text,
  charla_id       uuid references public.asistente_charlas(id) on delete set null,
  estado          text not null default 'nuevo' check (estado in ('nuevo', 'visto', 'hecho', 'descartado')),
  nota            text,
  created_at      timestamptz not null default now()
);
create index if not exists asistente_pendientes_usuario_idx on public.asistente_pendientes (usuario_id, created_at desc);

alter table public.asistente_charlas    enable row level security;
alter table public.asistente_lecciones  enable row level security;
alter table public.asistente_pendientes enable row level security;

-- Sin reglas a propósito: con RLS prendido y ninguna regla, solo la llave de
-- servicio (las functions) puede leer o escribir. Por las dudas se borra
-- cualquier regla que alguien haya creado a mano.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('asistente_charlas', 'asistente_lecciones', 'asistente_pendientes') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

revoke all on public.asistente_charlas, public.asistente_lecciones, public.asistente_pendientes from anon, authenticated;

-- Comprobar: las tres tienen que dar rls = true y reglas = 0
select c.relname as tabla, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as reglas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'asistente_%' and c.relkind = 'r'
order by 1;
