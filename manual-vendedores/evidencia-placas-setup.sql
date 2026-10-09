-- ============================================================
--  Acciones de proveedores que piden evidencia (09/10/2026)
--  Correr en Supabase → proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--
--  El circuito:
--   1. El proveedor marca "Pide evidencia" al cargar la acción.
--   2. Luciana la aprueba (entra al manual) o toca "Requiere placa": le llega a
--      Diseño y Desarrollo como pedido de placa.
--   3. Nahuel / Josefina suben la placa: recién ahí la acción entra al manual.
--   4. El vendedor le pone el logo del cliente, se la manda y al proveedor le llega
--      el aviso (eso vive en el proyecto del Hub: evidencias-acciones-setup.sql).
--
--  Solo agrega columnas a tablas que ya existen; no cambia permisos.
-- ============================================================

-- Lo que carga el proveedor y lo que decide Luciana / Diseño
alter table public.propuestas_acciones add column if not exists pide_evidencia  boolean not null default false;
alter table public.propuestas_acciones add column if not exists requiere_placa  boolean not null default false;
alter table public.propuestas_acciones add column if not exists placa_url       text;
alter table public.propuestas_acciones add column if not exists placa_subida_at timestamptz;
-- En qué fila del manual quedó (acciones_mensuales o acciones_fechas)
alter table public.propuestas_acciones add column if not exists accion_tabla    text;
alter table public.propuestas_acciones add column if not exists accion_id       uuid;

-- La acción en el manual: de qué propuesta salió y si pide evidencia
alter table public.acciones_mensuales add column if not exists propuesta_id       uuid;
alter table public.acciones_mensuales add column if not exists placa_url          text;
alter table public.acciones_mensuales add column if not exists requiere_evidencia boolean not null default false;
alter table public.acciones_fechas    add column if not exists propuesta_id       uuid;
alter table public.acciones_fechas    add column if not exists requiere_evidencia boolean not null default false;

-- El pedido de placa en la bandeja de Diseño y Desarrollo
alter table public.pedidos_diseno add column if not exists propuesta_id uuid;
alter table public.pedidos_diseno add column if not exists proveedor    text;

notify pgrst, 'reload schema';

-- Control: tiene que dar 13.
select count(*) as columnas_nuevas from information_schema.columns
where table_schema = 'public' and (
  (table_name = 'propuestas_acciones' and column_name in ('pide_evidencia','requiere_placa','placa_url','placa_subida_at','accion_tabla','accion_id')) or
  (table_name = 'acciones_mensuales'  and column_name in ('propuesta_id','placa_url','requiere_evidencia')) or
  (table_name = 'acciones_fechas'     and column_name in ('propuesta_id','requiere_evidencia')) or
  (table_name = 'pedidos_diseno'      and column_name in ('propuesta_id','proveedor')));
