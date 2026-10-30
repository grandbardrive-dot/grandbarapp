-- Acceso de solo lectura para Power BI (30/10/2026). Pedido de Sebastián (Administración), para un
-- comparativo que le pidió Fernando. Proyecto del MANUAL (fzaxwuuodseyyinveknn), migración
-- "powerbi_solo_lectura". Queda acá como registro.
--
-- Esquema aparte "powerbi" con tres vistas. El usuario powerbi_lectura ve SOLO estas vistas (no las
-- tablas de origen), en transacciones de solo lectura. Se creó SIN contraseña (NOLOGIN): la
-- contraseña la pone Nahuel desde el editor SQL de Supabase:
--     alter role powerbi_lectura with login password '<contraseña larga>';
-- y le pasa a Sebastián por privado: servidor del "Session pooler" (Supabase → Connect), puerto 5432,
-- base postgres, usuario powerbi_lectura.fzaxwuuodseyyinveknn.
-- Para cortarle el acceso: alter role powerbi_lectura nologin;
--
-- ventas_detalle: una fila por día + cliente + artículo + vendedor de la factura (no se guarda el
-- número de comprobante). Desde el 02/01/2025, se actualiza cada 20 minutos (sync-ventas).
--   neto, costo_neto, rentabilidad, unidades: como el panel de Dirección.
--   iva, imp_interno: proporción de ese artículo ese día (ventas_articulos).
--   percepcion_iva: la real de cada renglón (ventas_cliente.percep).
--   total_con_impuestos = neto + iva + imp_interno + percepcion_iva (el "Monto" de la planilla).
--   cuenta_en_planilla = es_producto y no vendedor_excluido (los filtros de "Avance Ventas").
-- Control 01–26/10/2026 con cuenta_en_planilla: neto, rentabilidad y unidades iguales al panel;
-- total $1.728,09 M (panel $1.728,09 M, planilla $1.727,91 M). Leerla entera: ~12 s.

create schema if not exists powerbi;
revoke all on schema powerbi from public;

create or replace view powerbi.ventas_detalle as
select vc.fecha,
       extract(year from vc.fecha)::int  as anio,
       extract(month from vc.fecha)::int as mes,
       vc.cliente_codigo,
       c.nombre                          as cliente_nombre,
       c.tipo                            as cliente_tipo,
       nullif(vc.vendedor, '')           as vendedor_codigo,
       vc.vendedor_nombre,
       vc.sku                            as articulo,
       va.descripcion                    as articulo_descripcion,
       va.marca,
       nullif(trim(va.familia_nombre), '') as linea,
       left(vc.sku, 2)                   as rubro_codigo,
       coalesce(public.dir_tipo_producto(vc.sku), 'Sin clasificación') as tipo_producto,
       left(vc.sku, 4)                   as proveedor_codigo,
       vc.unidades,
       vc.importe                        as neto,
       vc.costo                          as costo_neto,
       vc.importe - vc.costo             as rentabilidad,
       round(vc.importe * r.r_iva, 2)    as iva,
       round(vc.importe * r.r_ii, 2)     as imp_interno,
       coalesce(vc.percep, 0)            as percepcion_iva,
       round(vc.importe * (1 + r.r_iva + r.r_ii), 2) + coalesce(vc.percep, 0) as total_con_impuestos,
       public.dir_es_producto(vc.sku)    as es_producto,
       public.dir_vendedor_excluido(vc.vendedor, vc.vendedor_nombre) as vendedor_excluido,
       public.dir_es_producto(vc.sku) and not public.dir_vendedor_excluido(vc.vendedor, vc.vendedor_nombre) as cuenta_en_planilla
  from public.ventas_cliente vc
  left join public.ventas_articulos va on va.sku = vc.sku and va.fecha = vc.fecha
  left join public.clientes c on c.codigo_cliente = vc.cliente_codigo
  cross join lateral (select case when va.importe is not null and va.importe <> 0 then va.importe_iva / va.importe - 1 else 0.21 end as r_iva,
                             case when va.importe is not null and va.importe <> 0 then va.imp_interno / va.importe else 0 end as r_ii) r;

create or replace view powerbi.clientes as
select c.codigo_cliente, c.nombre, c.tipo, c.activo,
       v.codigo as vendedor_cartera_codigo, v.nombre as vendedor_cartera_nombre, v.zona
  from public.clientes c left join public.vendedores v on v.id = c.vendedor_id;

create or replace view powerbi.vendedores as
select codigo, nombre, zona from public.vendedores;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'powerbi_lectura') then
    create role powerbi_lectura nologin;
  end if;
end $$;
grant usage on schema powerbi to powerbi_lectura;
grant select on all tables in schema powerbi to powerbi_lectura;
alter default privileges in schema powerbi grant select on tables to powerbi_lectura;
revoke all on all tables in schema powerbi from anon, authenticated;
alter role powerbi_lectura set default_transaction_read_only = on;
alter role powerbi_lectura set statement_timeout = '5min';
alter role powerbi_lectura set search_path = powerbi;
