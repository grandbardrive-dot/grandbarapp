-- ============================================================
--  Evidencias de las acciones de proveedores (09/10/2026)
--  Correr en Supabase → proyecto del HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--
--  Una fila por cada placa que un vendedor le mandó a un cliente: qué acción,
--  qué cliente, cuándo y quién. El proveedor la ve en su panel y le llega el aviso.
--  Tabla cerrada: RLS prendido y SIN reglas. Solo la lee y escribe la función
--  /.netlify/functions/evidencias-acciones (con la clave de servicio), que se fija
--  quién es cada uno: el vendedor carga, el proveedor ve solo lo suyo.
-- ============================================================

create table if not exists public.evidencias_acciones (
  id                uuid primary key default gen_random_uuid(),
  propuesta_id      uuid not null,              -- propuestas_acciones.id (proyecto del manual)
  proveedor_empresa text not null,              -- el autor de la propuesta
  accion_titulo     text,
  accion_condicion  text,
  rubro             text,
  seccion           text,
  cliente_id        uuid,                       -- clientes.id (proyecto del manual)
  cliente_codigo    text,
  cliente_nombre    text,
  cliente_tipo      text,
  cliente_direccion text,
  vendedor_codigo   text,
  vendedor_nombre   text,
  usuario_id        uuid,                       -- quién la mandó (cuenta del Portal)
  placa_url         text,                       -- la placa que se mandó, con el logo del cliente
  con_logo          boolean not null default false,
  medio             text,                       -- compartir | whatsapp
  accionado_at      timestamptz not null default now()
);
create index if not exists evidencias_acciones_prov_idx on public.evidencias_acciones (proveedor_empresa, accionado_at desc);
create index if not exists evidencias_acciones_prop_idx on public.evidencias_acciones (propuesta_id);

alter table public.evidencias_acciones enable row level security;
-- Sin políticas a propósito: nadie la lee ni la escribe desde el navegador.

-- Control: tiene que dar una fila con rls = true.
select relname, relrowsecurity as rls from pg_class where relname = 'evidencias_acciones';
