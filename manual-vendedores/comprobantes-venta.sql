-- ============================================================
--  Base de COBRANZAS (qpaoyfubyaloyhepatlm) · migración comprobantes_venta (03/11/2026)
--  Ya aplicada. Queda acá como registro.
--  Facturas, notas de crédito y de débito EMITIDAS, pagadas o no. La tabla facturas
--  tiene solo las que tienen saldo; esta guarda todas, para que el vendedor vea y baje
--  también las ya pagadas (factura-vendedor ?que=lista → "pagadas").
--  La llena sync-comprobantes-background (cada 30 min) con la cabecera de
--  ListarComprobantes de CUBO, las dos empresas, desde 2025.
-- ============================================================
create table if not exists public.comprobantes_venta (
  numero      text not null,               -- '0003-00139455/A', mismo formato que facturas.numero
  tipo        text not null,               -- FAC, FAR, NCR, NDE…
  codigo      text not null,               -- cliente, 5 dígitos
  fecha       date not null,
  neto        numeric,
  total       numeric,
  empresa     text,
  vendedor    text,
  anulado     boolean not null default false,
  actualizado timestamptz not null default now(),
  primary key (numero, tipo)
);
create index if not exists comprobantes_venta_cliente on public.comprobantes_venta (codigo, fecha desc);
create index if not exists comprobantes_venta_fecha on public.comprobantes_venta (fecha);

-- Días ya bajados (para completar la historia de a poco, el más nuevo primero).
create table if not exists public.comprobantes_venta_dias (
  fecha       date primary key,
  cantidad    int not null default 0,
  por_empresa jsonb,
  actualizado timestamptz not null default now()
);

-- Cerradas: sin políticas, solo las funciones del Portal (service role) leen y escriben.
alter table public.comprobantes_venta enable row level security;
alter table public.comprobantes_venta_dias enable row level security;
revoke all on public.comprobantes_venta, public.comprobantes_venta_dias from anon, authenticated;
