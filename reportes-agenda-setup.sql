-- ============================================================
--  GrandBar Hub · Reportes + Agenda de Dirección
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- REUNIONES (Dirección le programa a un usuario) ----------
create table if not exists public.reuniones (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null,               -- a quién se le programa
  titulo            text not null,
  detalle           text,
  tipo              text default 'reunion',       -- reunion / llamada / visita / capacitacion
  fecha             date not null,
  hora              time,
  lugar             text,
  estado            text default 'programada',    -- programada / confirmada / realizada / cancelada / rechazada
  respuesta         text,                         -- motivo del usuario si no puede asistir
  creado_por        uuid,                         -- Fernando
  creado_por_nombre text,
  created_at        timestamptz default now()
);
-- si la tabla ya existía sin la columna:
alter table public.reuniones add column if not exists respuesta text;
alter table public.reuniones enable row level security;   -- solo el service role (las Functions) accede
create index if not exists reuniones_usuario_idx on public.reuniones(usuario_id, fecha);

-- ---------- REPORTES (usuario carga → Dirección revisa) ----------
create table if not exists public.reportes (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null,               -- quién lo sube
  autor_nombre       text,
  area               text,                         -- Ventas Mendoza ON, Marketing, etc.
  tipo               text default 'diario',        -- diario / semanal / mensual / puntual
  periodo            text,                         -- "Semana 19-25 May", "Abril 2025"...
  titulo             text not null,
  contenido          text,                         -- el reporte escrito
  enlace             text,                         -- opcional: link a Drive/PDF
  estado             text default 'pendiente',     -- pendiente / aprobado / rechazado / revision
  devolucion         text,                         -- feedback de Fernando
  revisado_por       uuid,
  revisado_por_nombre text,
  revisado_at        timestamptz,
  created_at         timestamptz default now()
);
alter table public.reportes enable row level security;    -- solo el service role (las Functions) accede
create index if not exists reportes_usuario_idx on public.reportes(usuario_id, created_at desc);
create index if not exists reportes_estado_idx  on public.reportes(estado, created_at desc);
