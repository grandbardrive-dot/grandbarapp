-- Ventas del panel de Dirección con los filtros de la planilla "Avance Ventas" (26/10/2026).
-- Proyecto del MANUAL (fzaxwuuodseyyinveknn), migración "dir_ventas_filtros_planilla".
-- Queda acá como registro (lo anterior, en dir-ventas-setup.sql).
--
-- Pedido del usuario, con la tabla dinámica de Administración: no se cuentan
--   * los vendedores 018 Luciana Buenanueva, 023 Gestión Administrativa, 034 Empleados Grandbar,
--     042 Luisina Brenda Gonzalez y 044 Operaciones Especiales;
--   * los tipos de producto Administración, Alimentos, Otros, POP, Promos y los sin clasificación
--     (renglones sin código de artículo).
--   Se cuentan Vinos, Espirituosas, Cervezas, Bebidas sin alcohol y Cafés e infusiones.
-- El tipo de producto de la planilla es el rubro de CUBO (2 primeros dígitos del código),
-- comprobado artículo por artículo con octubre de 2026.
-- El vendedor es el DE LA FACTURA (no el de la cartera del cliente): sync-ventas lo guarda
-- desde el 26/10/2026 en ventas_cliente.vendedor ('' = día todavía no vuelto a bajar,
-- '?' = la factura no lo trae). sync-ventas-background rellena los días viejos de a 10.

alter table public.ventas_cliente add column if not exists vendedor text not null default '';
alter table public.ventas_cliente add column if not exists vendedor_nombre text;
alter table public.ventas_cliente drop constraint if exists ventas_cliente_pkey;
alter table public.ventas_cliente add constraint ventas_cliente_pkey primary key (cliente_codigo, sku, fecha, vendedor);
create index if not exists vc_sin_vendedor on public.ventas_cliente (fecha) where vendedor = '';

create or replace function public.ventas_dias_sin_vendedor(p_desde date, p_lim int)
returns table(fecha date) language sql stable set search_path = public as $$
  select distinct fecha from ventas_cliente
   where vendedor = '' and fecha >= p_desde
   order by fecha desc limit greatest(1, least(p_lim, 60))
$$;

-- Tipo de producto, con los nombres de la planilla. null = sin clasificación (sin código).
create or replace function public.dir_tipo_producto(p_sku text) returns text
language sql immutable as $$
  select case when p_sku !~ '^[0-9]' then null else case left(p_sku, 2)
    when '01' then 'Vinos' when '02' then 'Espirituosas' when '03' then 'Alimentos'
    when '04' then 'Cafés e infusiones' when '05' then 'Cervezas'
    when '07' then 'Bebidas sin alcohol' when '08' then 'Bebidas sin alcohol'
    when '09' then 'POP' when '10' then 'Promos'
    when '06' then 'Administración' when '14' then 'Administración'
    else 'Otros' end end $$;

-- Lo que se cuenta como venta de productos.
create or replace function public.dir_es_producto(p_sku text) returns boolean
language sql immutable as $$ select left(p_sku, 2) in ('01', '02', '04', '05', '07', '08') $$;

-- Vendedores que no se cuentan (por código; el nombre por si la factura no trae el código).
create or replace function public.dir_vendedor_excluido(p_cod text, p_nom text) returns boolean
language sql immutable as $$
  select coalesce(p_cod, '') in ('018', '023', '034', '042', '044')
      or lower(trim(coalesce(p_nom, ''))) in ('luciana buenanueva', 'gestion administrativa', 'gestión administrativa',
                                              'empleados grandbar', 'luisina brenda gonzalez', 'operaciones especiales')
$$;

-- dir_ventas: versión final (migraciones "dir_ventas_filtros_rapida" y "dir_ventas_filtros_plan_con_fechas").
-- Lee ventas_cliente UNA vez con grouping sets (artículo+vendedor, día, vendedor+cliente), con
-- collate "C" y work_mem 64MB para agrupar en memoria, y arma la consulta con EXECUTE y las
-- fechas escritas: como función SQL el plan no conocía el rango y el año tardaba 2 s (la base
-- corta a los 3 s al rol anon); así tarda ~0,6 s el año y ~0,1 s el mes.
-- El cuerpo completo: select pg_get_functiondef('public.dir_ventas(date,date)'::regprocedure);
-- Devuelve: venta, costo, margen, unidades, facturado, dias, dias_sin_vendedor, actualizado,
--   fuera_vendedores [{codigo,nombre,venta}], fuera_tipos [{nombre,venta}], por_dia, por_rubro
--   (tipo de producto), por_proveedor, por_linea, por_producto, por_vendedor (el de la factura;
--   '' = días todavía sin vendedor) y vendedor_completo.

-- Probar sin la pantalla:
--   select public.dir_ventas(date_trunc('month', current_date)::date, current_date);

-- 27/10/2026, migración "dir_ventas_total_con_iva": dir_ventas devuelve también 'total' = la
-- venta de productos (mismos filtros) con IVA e impuesto interno. ventas_cliente guarda solo el
-- neto: a cada artículo se le aplica su proporción (importe_iva + imp_interno) / importe del
-- período, sacada de ventas_articulos (da lo mismo que sumar ventas_articulos directo: $36 de
-- diferencia en octubre). La planilla "Avance Ventas" además suma percepciones de Ingresos
-- Brutos (3% del neto en algunos clientes): da ~1,3% más. El año tarda ~1 s.
-- En la pantalla: "Venta total con IVA", "Venta de productos NETO" y "Rentabilidad Neta" (antes
-- "margen bruto"; en la base sigue llamándose margen).
