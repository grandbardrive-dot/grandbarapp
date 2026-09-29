-- ============================================================
--  Evidencias del Torneo Doña Paula (29/09/2026)
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--
--  Los vendedores cargan evidencias (línea, acción, cliente, fecha y fotos)
--  y Juan Pablo Sepúlveda las acepta o rechaza. Todo pasa por la función
--  torneo-evidencias: la tabla y la carpeta de fotos NO se abren al
--  navegador (RLS activo sin reglas + carpeta privada).
-- ============================================================

create table if not exists public.torneo_evidencias (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  usuario_id       uuid not null references auth.users(id) on delete cascade,
  vendedor_codigo  text,
  vendedor_nombre  text,
  sucursal         text,
  liga             text,
  linea            text not null,
  accion           text not null,
  cliente_codigo   text,
  cliente_nombre   text not null,
  fecha_activacion date not null,
  fotos            text[] not null default '{}',
  nota             text,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  revisado_por     text,
  revisado_at      timestamptz,
  motivo           text
);

create index if not exists torneo_evidencias_estado_idx  on public.torneo_evidencias (estado, created_at desc);
create index if not exists torneo_evidencias_usuario_idx on public.torneo_evidencias (usuario_id, created_at desc);

-- Cerrada: solo la función (con la clave de servidor) la lee y la escribe.
alter table public.torneo_evidencias enable row level security;
revoke all on public.torneo_evidencias from anon, authenticated;

-- Carpeta PRIVADA para las fotos (se ven con links que vencen en una hora).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('torneo-evidencias', 'torneo-evidencias', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

-- ============================================================
--  Juan Pablo Sepúlveda: rol "torneo" (solo ve la revisión de evidencias).
--  Primero tiene que tener su cuenta en Authentication → Users.
--  Cambiá el email por el suyo y corré estas líneas.
--  (También se puede elegir el rol "Validación del torneo" desde el panel de
--  Usuarios de Desarrollo/Diseño.)
-- ============================================================
-- update public.usuarios set rol = 'torneo', nombre = 'Juan Pablo Sepúlveda'
--  where lower(email) = lower('EMAIL-DE-JUAN-PABLO@grandbar.com.ar');
-- select id, email, nombre, rol from public.usuarios where rol = 'torneo';
