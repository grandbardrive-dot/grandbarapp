-- ============================================================
--  Pedidos de diseño — bandeja de Josefina y Nahuel
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor
--
--  Hoy el vendedor toca "Pedir diseño y flyers" y solo se abre un WhatsApp:
--  no queda registro de qué se pidió, para qué cliente ni si se entregó.
--  Con esta tabla el pedido queda cargado y se ve en el panel.
-- ============================================================

create table if not exists public.pedidos_diseno (
  id              uuid primary key default gen_random_uuid(),

  -- Quién pide
  vendedor_id     uuid,
  vendedor_nombre text,
  vendedor_codigo text,

  -- Para quién
  cliente_id      uuid,
  cliente_nombre  text,
  cliente_whatsapp text,

  -- Qué necesita
  tipo            text not null default 'otro',   -- placa | flyer | evento | otro
  detalle         text,                           -- qué tiene que decir la pieza
  nota            text,                           -- aclaraciones del vendedor
  fecha_necesita  date,                           -- para cuándo lo necesita

  -- Seguimiento
  estado          text not null default 'nuevo',  -- nuevo | en_curso | listo | cancelado
  pieza_url       text,                           -- la pieza terminada
  respuesta       text,                           -- lo que contesta diseño
  atendido_por    text,
  entregado_en    timestamptz,

  created_at      timestamptz not null default now()
);

-- Para que la bandeja abra rápido: primero los nuevos, después por fecha.
create index if not exists pedidos_diseno_estado_idx on public.pedidos_diseno (estado, created_at desc);

-- Permisos: el manual y el panel entran con la clave pública (anon), igual que
-- el resto de las tablas del manual (combos_evento, checklist_secciones...).
alter table public.pedidos_diseno enable row level security;

drop policy if exists "pedidos_diseno_lectura"   on public.pedidos_diseno;
drop policy if exists "pedidos_diseno_alta"      on public.pedidos_diseno;
drop policy if exists "pedidos_diseno_edicion"   on public.pedidos_diseno;
drop policy if exists "pedidos_diseno_borrado"   on public.pedidos_diseno;

create policy "pedidos_diseno_lectura" on public.pedidos_diseno
  for select using (true);

create policy "pedidos_diseno_alta" on public.pedidos_diseno
  for insert with check (true);

create policy "pedidos_diseno_edicion" on public.pedidos_diseno
  for update using (true) with check (true);

create policy "pedidos_diseno_borrado" on public.pedidos_diseno
  for delete using (true);

-- Comprobar que quedó:
--   select count(*) from public.pedidos_diseno;
