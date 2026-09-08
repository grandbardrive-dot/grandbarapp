-- ============================================================
--  El equipo de cada cuenta, resuelto por vendedor
--  Correr en el proyecto de COBRANZAS (qpaoyfubyaloyhepatlm) → SQL Editor
--
--  Por qué hacía falta: la sincronización con CUBO trae de cada cliente el
--  código, nombre, CUIT, dirección, teléfono, email, vendedor y rubro. La
--  columna 'equipo' no está en esa lista: no se lee de CUBO ni se escribe. Las
--  únicas cuentas que lo tienen son las que quedaron del Excel que se importaba
--  a mano. Todo lo que la sincronización creó desde entonces nació sin equipo.
--
--  La salida: el equipo es una propiedad del VENDEDOR, no de cada cuenta. Y el
--  vendedor sí llega bien en cada sincronización. Así que se guarda el equipo de
--  cada vendedor una vez y la base completa las cuentas sola.
--
--  Vive entero acá adentro: no hay que tocar ni volver a publicar la app de
--  cobranzas, y funciona igual sin importar quién escriba en la tabla.
-- ============================================================

-- ── 1) El equipo de cada vendedor ───────────────────────────
create table if not exists public.equipos_vendedores (
  vendedor    text primary key,
  equipo      text not null,
  actualizado timestamptz not null default now()
);

-- Sin políticas: solo entra con la llave de servicio (el trigger y el Portal).
alter table public.equipos_vendedores enable row level security;


-- ── 2) Se siembra con lo que ya está bien cargado ───────────
-- Si un vendedor aparece con equipo en sus cuentas viejas, ese es su equipo. Si
-- apareciera con más de uno, gana el que más veces se repite.
insert into public.equipos_vendedores (vendedor, equipo)
select vendedor, equipo from (
  select trim(vendedor) as vendedor,
         upper(trim(equipo)) as equipo,
         row_number() over (partition by trim(vendedor) order by count(*) desc) as puesto
    from public.cuentas_cubo
   where coalesce(trim(equipo), '') <> ''
     and coalesce(trim(vendedor), '') <> ''
   group by 1, 2
) t
where puesto = 1
on conflict (vendedor) do nothing;


-- ── 3) Completar las cuentas que quedaron sin equipo ────────
update public.cuentas_cubo c
   set equipo = e.equipo
  from public.equipos_vendedores e
 where coalesce(trim(c.equipo), '') = ''
   and trim(c.vendedor) = e.vendedor;


-- ── 4) Que las cuentas nuevas ya entren con equipo ──────────
-- Acá está la parte que evita que el problema vuelva: no importa que la
-- sincronización no mande el equipo, la base lo completa al entrar.
create or replace function public.completar_equipo()
returns trigger language plpgsql as $$
begin
  if coalesce(trim(new.equipo), '') = '' and coalesce(trim(new.vendedor), '') <> '' then
    select equipo into new.equipo
      from public.equipos_vendedores
     where vendedor = trim(new.vendedor);
  end if;
  return new;
end $$;

drop trigger if exists cuentas_cubo_equipo on public.cuentas_cubo;
create trigger cuentas_cubo_equipo
  before insert or update on public.cuentas_cubo
  for each row execute function public.completar_equipo();


-- ── 5) Qué quedó sin resolver ───────────────────────────────
-- Son los vendedores que nunca aparecieron con equipo cargado: hay que decidir
-- a mano a qué equipo van y agregarlos a equipos_vendedores.
select coalesce(nullif(trim(vendedor), ''), '(sin vendedor)') as vendedor,
       count(*) as cuentas,
       sum(saldo) as cartera
  from public.cuentas_cubo
 where coalesce(trim(equipo), '') = ''
 group by 1
 order by cuentas desc;
