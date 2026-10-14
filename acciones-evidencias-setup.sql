-- ============================================================
--  Evidencias de las acciones de Luciana (14/10/2026)
--  Correr en Supabase → proyecto del HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--
--  En la visita, cada acción que carga Luciana (campañas, planes, fechas especiales,
--  catálogo de clientes, vinos sobre la mesa, punteras, volumen y degustaciones) tiene
--  "Cargar evidencia": fotos del punto de venta y un comentario. Se puede cargar en la
--  visita siguiente a la que se cerró (el pedido todavía no llegó el día del cierre).
--  Le llega a Juan Pablo Sepúlveda (Trade Marketing, trade-evidencias.html) y al
--  proveedor de la acción (su portal, sección Evidencias).
--
--  Todo pasa por la función acciones-evidencias (clave de servicio): la tabla y la
--  carpeta de fotos son privadas. RLS prendido y SIN reglas.
-- ============================================================

create table if not exists public.acciones_evidencias (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  tipo              text not null,      -- campania | plan | fecha | catalogo | vino_mesa | puntera | volumen | degustacion
  accion_id         text not null,
  accion_titulo     text not null,
  accion_condicion  text,
  proveedor         text,               -- como figura en la acción
  proveedor_empresa text,               -- el proveedor del portal que la recibe (null si no tiene usuario)
  cliente_id        uuid,
  cliente_codigo    text,
  cliente_nombre    text,
  cliente_tipo      text,
  vendedor_codigo   text,
  vendedor_nombre   text,
  usuario_id        uuid not null,
  fecha_cierre      date,               -- cuándo se cerró la acción, si se sabe
  fotos             text[] not null,    -- rutas en la carpeta privada acciones-evidencias
  comentario        text,
  estado            text not null default 'nueva' check (estado in ('nueva', 'revisada')),
  revisado_por      text,
  revisado_at       timestamptz
);
create index if not exists acciones_evidencias_fecha_idx on public.acciones_evidencias (created_at desc);
create index if not exists acciones_evidencias_cliente_idx on public.acciones_evidencias (cliente_id);
create index if not exists acciones_evidencias_prov_idx on public.acciones_evidencias (proveedor_empresa);

alter table public.acciones_evidencias enable row level security;
-- Sin políticas a propósito.
revoke all on public.acciones_evidencias from anon;

-- Carpeta privada para las fotos (sin políticas: solo la función la usa).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('acciones-evidencias', 'acciones-evidencias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Control: tiene que dar rls = true.
select relname, relrowsecurity as rls from pg_class where relname = 'acciones_evidencias';

-- ── Casilla "Requiere evidencia" (14/10/2026, ya aplicado) ──────────────────
-- El botón del vendedor sale solo en las acciones que Luciana marca. Las campañas
-- (acciones_mensuales), las fechas (acciones_fechas) y el catálogo (catalogo_acciones)
-- ya tenían la columna. Se sumó en:
--   proyecto del MANUAL (fzaxwuuodseyyinveknn):
--     alter table public.checklist_planes add column if not exists requiere_evidencia boolean not null default false;
--   proyecto del PORTAL (xqhyemccbwmzxqzkrtwa):
--     alter table public.vinos_sobre_mesa add column if not exists requiere_evidencia boolean not null default false;
--     alter table public.acciones_herramientas add column if not exists requiere_evidencia boolean not null default false;
