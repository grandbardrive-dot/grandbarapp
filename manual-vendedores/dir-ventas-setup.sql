-- Ventas y margen del panel de Dirección (14/10/2026).
-- OJO (26/10/2026): dir_ventas y dir_es_producto se reemplazaron con los filtros de la planilla
-- "Avance Ventas" (vendedores y tipos de producto que no se cuentan): ver dir-ventas-filtros.sql.
-- YA APLICADO en el proyecto del MANUAL (fzaxwuuodseyyinveknn), migraciones
-- "dir_ventas_resumen", "dir_ventas_v2_productos", "dir_ventas_v3_rapida" y
-- "ventas_sync_helpers". Queda acá como registro.
--
-- De dónde salen los números: sync-ventas baja de CUBO (las dos empresas) las facturas y
-- notas de crédito, por artículo y por día (ventas_articulos) y por cliente (ventas_cliente).
-- Corre cada 20 minutos y, desde el 14/10/2026, también baja el día de HOY (parcial).
--
-- Definiciones (verificadas contra la planilla "Avance Ventas" de Administración):
--   * Venta = neto sin IVA de facturas menos notas de crédito. Las notas de débito (cheques
--     rechazados, recupero de gastos) NO son venta; la planilla sí las suma (por eso da más).
--   * PRODUCTOS = renglones con código de artículo, sin los rubros 06 ("Cheque / Varios") ni
--     14 (artículos compensadores, cheques, diferencias de precio, gastos bancarios).
--   * Margen bruto = venta neta − costo neto, los dos sin IVA, solo productos. El impuesto
--     interno es de paso (el cliente lo paga aparte). Ojo: la fórmula "con IVA − costo pleno"
--     de resultados-acciones.js da márgenes negativos en spirits porque le suma el impuesto
--     interno al costo y no a la venta.
--   * SIN CÓDIGO = renglones sin artículo (eventos a Consumidor Final, servicios, facturas a
--     proveedores): son venta, pero CUBO no les carga costo. Se muestran aparte.
--   * El código de artículo empieza con la familia: 2 dígitos de rubro + 2 de proveedor + 2 de línea.

-- Venta y costo por cliente (para ventas por vendedor). Las filas viejas quedan en null hasta
-- que sync-ventas-background las vuelve a bajar (relleno de a 10 días por corrida).
alter table public.ventas_cliente add column if not exists importe numeric;
alter table public.ventas_cliente add column if not exists costo numeric;

create or replace function public.dir_es_producto(p_sku text) returns boolean
language sql immutable as $$ select p_sku ~ '^[0-9]' and left(p_sku, 2) not in ('06', '14') $$;

create or replace function public.dir_rubro(p_sku text) returns text
language sql immutable as $$
  select case left(p_sku, 2)
    when '01' then 'Vinos y espumantes' when '02' then 'Spirits' when '03' then 'Almacén'
    when '04' then 'Café' when '05' then 'Cervezas' when '07' then 'Gaseosas y aguas'
    when '08' then 'Gaseosas y aguas' when '09' then 'Material POP' when '10' then 'Combos y promos'
    when '13' then 'Combos y promos' else 'Otros' end $$;

-- dir_ventas(desde, hasta): totales, por día, rubro, proveedor (código CUBO de 4 dígitos,
-- nombrado con sus líneas), línea, producto y vendedor (cartera). CTE materializadas:
-- el año completo tarda ~0,8 s (la v2 tardaba 5 s y cortaba por tiempo).
-- Ver el cuerpo completo en la migración "dir_ventas_v3_rapida" (pg_get_functiondef).

-- Ayudas de sync-ventas-background:
create or replace function public.ventas_sync_hechos(p_desde date)
returns table(desde date, ultima timestamptz) language sql stable set search_path = public as $$
  select desde, max(created_at) from ventas_sync_log
   where ok and detalle like 'v2%' and desde >= p_desde group by desde
$$;
create or replace function public.ventas_dias_sin_monto(p_desde date, p_lim int)
returns table(fecha date) language sql stable set search_path = public as $$
  select distinct fecha from ventas_cliente
   where importe is null and fecha >= p_desde
   order by fecha desc limit greatest(1, least(p_lim, 60))
$$;

-- Probar sin la pantalla:
--   select public.dir_ventas(date_trunc('month', current_date)::date, current_date);
