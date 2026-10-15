-- Clientes ocultos que vuelven a comprar → vuelven a verse en el manual (14/10/2026).
-- YA APLICADO en el proyecto del MANUAL (fzaxwuuodseyyinveknn), migración
-- "clientes_ocultos_vuelven_al_comprar". Queda acá como registro.
--
-- Regla (pedido del dueño): cuando un cliente oculto compra, sale de ocultos. Cuenta la
-- compra posterior al día en que se ocultó, también si lo ocultó el vendedor o el
-- supervisor con el botón. Solo compras (unidades > 0; las devoluciones no cuentan).
-- La corre sync-clientes-cron cada hora (reactivarCompradores en sync-clientes-cubo.js).
-- Corre con los permisos de quien la llama (no es security definer).
--
-- El 14/10 se aplicó por primera vez: 225 clientes volvieron a verse (6 de Ángeles
-- Laurito). Respaldo de cómo estaban antes: tabla _backup_reactivados_1410 (cerrada).
--
-- ACTUALIZACIÓN 14/10/2026 (tarde), pedido del dueño: esos 225 se volvieron a ocultar
-- (migración "clientes_revertir_reactivados_y_corte") y la regla ahora tiene un CORTE:
-- solo cuenta una compra posterior al 14/10/2026 (c_corte). Las compras de antes no
-- reactivan a nadie; desde el 15/10, el que compra vuelve a aparecer en la próxima hora
-- (las ventas del día entran cada 20 min). Lo de abajo es la versión SIN corte: la vigente
-- es la de la migración nueva (pg_get_functiondef('public.reactivar_clientes_que_compraron'::regproc)).

-- 1. Desde cuándo está oculto cada cliente.
alter table public.clientes add column if not exists oculto_desde date;

update public.clientes c
   set oculto_desde = coalesce(
     (select (e.updated_at at time zone 'America/Argentina/Buenos_Aires')::date
        from public.clientes_estado e
       where ltrim(trim(e.codigo), '0') = ltrim(trim(c.codigo_cliente), '0') and e.activo = false
       limit 1),
     date '2026-08-26')
 where c.activo = false and c.oculto_desde is null;

-- 2. Cada vez que un cliente se oculta, queda anotado el día; al volver a verse, se borra.
create or replace function public.clientes_marca_oculto() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.activo = false and new.oculto_desde is null then
      new.oculto_desde := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
    end if;
  elsif new.activo is distinct from old.activo then
    new.oculto_desde := case when new.activo = false
      then (now() at time zone 'America/Argentina/Buenos_Aires')::date else null end;
  end if;
  return new;
end $$;

drop trigger if exists clientes_marca_oculto on public.clientes;
create trigger clientes_marca_oculto before insert or update of activo on public.clientes
  for each row execute function public.clientes_marca_oculto();

-- 3. La regla. Con solo_ver = true no cambia nada: devuelve la lista de los que volverían.
create or replace function public.reactivar_clientes_que_compraron(solo_ver boolean default false)
returns jsonb language plpgsql set search_path = public as $$
declare v_ids uuid[]; v_cods text[]; v_lista jsonb;
begin
  with ult as (
    select ltrim(trim(cliente_codigo), '0') cod, max(fecha) ultima
      from ventas_cliente
     where fecha >= current_date - 120 and unidades > 0
     group by 1
  ), est as (
    select ltrim(trim(codigo), '0') cod, activo,
           (updated_at at time zone 'America/Argentina/Buenos_Aires')::date dia
      from clientes_estado
  ), ocultos as (
    select c.id, c.codigo_cliente, c.nombre, c.vendedor_id, ltrim(trim(c.codigo_cliente), '0') cod,
           greatest(case when e.activo = false then e.dia end,
                    case when c.activo = false then coalesce(c.oculto_desde, date '2026-08-26') end) desde
      from clientes c left join est e on e.cod = ltrim(trim(c.codigo_cliente), '0')
     where coalesce(e.activo, c.activo) = false
  )
  select array_agg(o.id), array_agg(o.cod),
         jsonb_agg(jsonb_build_object('codigo', o.codigo_cliente, 'nombre', o.nombre,
           'vendedor', (select v.codigo from vendedores v where v.id = o.vendedor_id),
           'oculto_desde', o.desde, 'compro', u.ultima) order by u.ultima desc)
    into v_ids, v_cods, v_lista
    from ocultos o join ult u on u.cod = o.cod
   where u.ultima > o.desde;

  if v_ids is null then return jsonb_build_object('reactivados', 0); end if;
  if not solo_ver then
    update clientes set activo = true where id = any(v_ids) and activo = false;
    update clientes_estado set activo = true, updated_at = now()
     where ltrim(trim(codigo), '0') = any(v_cods) and activo = false;
  end if;
  return jsonb_build_object('reactivados', array_length(v_ids, 1), 'solo_ver', solo_ver, 'clientes', v_lista);
end $$;

notify pgrst, 'reload schema';

-- Ver qué haría ahora, sin cambiar nada:
--   select public.reactivar_clientes_que_compraron(true);

-- ── Quién debe (15/10/2026: "los que tienen deuda no se ocultan") ──────────
-- clientes.con_deuda la marca sync-clientes-cron cada hora con la lista de deudores de
-- Cobranzas (cuentas_cubo: saldo > 0 o algo vencido). Con lista vacía no toca nada.
alter table clientes add column if not exists con_deuda boolean not null default false;

create or replace function public.marcar_clientes_con_deuda(p_codigos text[])
returns jsonb language plpgsql set search_path = public as $$
declare v_on int; v_off int;
begin
  -- Sin lista no se toca nada (si CUBO no contestó, mejor dejar la marca como estaba).
  if p_codigos is null or array_length(p_codigos, 1) is null then
    return jsonb_build_object('ok', false, 'motivo', 'lista vacía');
  end if;
  update clientes set con_deuda = true
   where not con_deuda and ltrim(trim(codigo_cliente), '0') = any(p_codigos);
  get diagnostics v_on = row_count;
  update clientes set con_deuda = false
   where con_deuda and not (ltrim(trim(codigo_cliente), '0') = any(p_codigos));
  get diagnostics v_off = row_count;
  return jsonb_build_object('ok', true, 'con_deuda_nuevos', v_on, 'sin_deuda_nuevos', v_off);
end $$;

notify pgrst, 'reload schema';
