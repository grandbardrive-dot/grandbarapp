-- ============================================================
--  Paneles de los KAF (19/10/2026) · base del Portal (Hub)
--  KAF = representante de una marca en la calle (Facu Llaver, Campari).
--  Juan Pablo Sepúlveda (Trade Marketing, rol torneo) arma el panel de cada uno:
--  marca, secciones, objetivos y modelos de Perfect Serve / Perfect Store.
--  Todo pasa por la función kaf (clave de servicio): las tablas tienen RLS y
--  NINGUNA regla, así que la clave pública no lee ni escribe nada.
-- ============================================================

-- Cómo está armado el panel de cada KAF.
create table if not exists public.kaf_perfiles (
  usuario_id  uuid primary key,
  marca       text not null default 'Campari',
  prefijos    text[] not null default '{}',          -- primeros 4 dígitos del código de artículo en CUBO
  marcas      text[] not null default '{}',          -- marcas que se siguen (se buscan en la descripción del artículo)
  tipos       text[] not null default '{restaurante,bar,disco,evento}',
  region      text check (region in ('mendoza', 'san_luis')),   -- vacío = las dos
  planillas_campari boolean not null default false,  -- Plan Campari 5T y Acuerdos Campari (planillas de Drive)
  secciones   jsonb not null default '{}'::jsonb,    -- { clave: { on, titulo, ayuda } }
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Objetivos del mes (los carga Juan Pablo).
create table if not exists public.kaf_objetivos (
  usuario_id   uuid not null,
  mes          text not null check (mes ~ '^\d{4}-\d{2}$'),
  visitas_dia  integer check (visitas_dia >= 0),
  nuevos_marca integer check (nuevos_marca >= 0),
  nuevos_gb    integer check (nuevos_gb >= 0),
  nota         text,
  updated_at   timestamptz not null default now(),
  updated_by   text,
  primary key (usuario_id, mes)
);

-- Objetivos por cliente (salen de las oportunidades).
create table if not exists public.kaf_objetivos_cliente (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null,
  mes            text not null check (mes ~ '^\d{4}-\d{2}$'),
  cliente_codigo text not null,
  cliente_nombre text,
  objetivo       text not null,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'logrado', 'no_logrado')),
  nota_kaf       text,
  creado_por     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists kaf_obj_cli_idx on public.kaf_objetivos_cliente (usuario_id, mes);

-- Visitas marcadas por el KAF (día y hora).
create table if not exists public.kaf_visitas (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null,
  cliente_codigo text not null,
  cliente_nombre text,
  tipo_cliente   text,
  vendedor       text,
  fecha          timestamptz not null default now(),  -- cuándo fue la visita
  registrada_at  timestamptz not null default now(),  -- cuándo la marcó (si la cargó después, se ve)
  nota           text
);
create index if not exists kaf_visitas_idx on public.kaf_visitas (usuario_id, fecha desc);

-- Evidencia en PDV, Perfect Serve, Perfect Store, capacitaciones y presupuestos.
create table if not exists public.kaf_registros (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null,
  tipo           text not null check (tipo in ('evidencia', 'perfect_serve', 'perfect_store', 'capacitacion', 'presupuesto')),
  cliente_codigo text,
  cliente_nombre text,
  fecha          date not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
  datos          jsonb not null default '{}'::jsonb,
  fotos          text[] not null default '{}',        -- rutas en la carpeta privada kaf
  estado         text not null default 'nuevo' check (estado in ('nuevo', 'visto', 'pendiente', 'aprobado', 'rechazado')),
  revision       text,
  revisado_por   text,
  revisado_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists kaf_registros_idx on public.kaf_registros (usuario_id, tipo, created_at desc);

-- Modelos de Perfect Serve (ON) y Perfect Store (OFF) que carga Juan Pablo.
create table if not exists public.kaf_modelos (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('perfect_serve', 'perfect_store')),
  marca      text not null,
  nombre     text not null,
  datos      jsonb not null default '{}'::jsonb,
  foto       text,
  activo     boolean not null default true,
  orden      integer not null default 0,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pedidos de materiales (el "sumador"): le llegan a Andrea para el remito.
create table if not exists public.kaf_pedidos_materiales (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null,
  solicitante    text,
  cliente_codigo text,
  cliente_nombre text,
  items          jsonb not null default '[]'::jsonb,  -- [{ id, nombre, cantidad }]
  nota           text,
  estado         text not null default 'enviado' check (estado in ('enviado', 'remito', 'rechazado')),
  remito         text,
  respuesta      text,
  atendido_por   text,
  atendido_at    timestamptz,
  aviso          jsonb,                               -- cómo se le avisó a Andrea (campanita, mail)
  created_at     timestamptz not null default now()
);
create index if not exists kaf_pedidos_idx on public.kaf_pedidos_materiales (created_at desc);

alter table public.kaf_perfiles           enable row level security;
alter table public.kaf_objetivos          enable row level security;
alter table public.kaf_objetivos_cliente  enable row level security;
alter table public.kaf_visitas            enable row level security;
alter table public.kaf_registros          enable row level security;
alter table public.kaf_modelos            enable row level security;
alter table public.kaf_pedidos_materiales enable row level security;
revoke all on public.kaf_perfiles, public.kaf_objetivos, public.kaf_objetivos_cliente, public.kaf_visitas,
  public.kaf_registros, public.kaf_modelos, public.kaf_pedidos_materiales from anon, authenticated;

-- Carpeta privada para fotos y presupuestos (se ven con links que vencen).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kaf', 'kaf', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
