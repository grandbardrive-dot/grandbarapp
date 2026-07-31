-- ════════════════════════════════════════════════════════════════════════════
-- GrandBar — Recolector de PROPUESTAS DE ACCIONES
-- Buzón separado para juntar propuestas de todos (Lucy, marketing, supervisores,
-- proveedores) y después decidir en conjunto qué se queda y qué no.
-- NO toca la app de vendedores ni las listas del checklist.
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- (Se puede re-ejecutar sin problema: es idempotente.)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabla principal: propuestas ─────────────────────────────────────────
create table if not exists propuestas_acciones (
  id              uuid default gen_random_uuid() primary key,
  rubro           text not null,               -- 'restaurante' | 'vinoteca' | 'autoservicio'
  seccion         text not null,               -- 1er nivel (ej: 'Vinos' o 'Vidrieras')
  subseccion      text,                         -- 2do nivel (ej: 'Acciones mensuales' o 'Peñaflor')
  titulo          text not null,               -- la acción propuesta
  condicion       text,                        -- ej: '1+1', '3+1', '20% OFF' (opcional)
  descripcion     text,                        -- detalle / argumento
  vigencia_desde  date,                        -- opcional
  vigencia_hasta  date,                        -- opcional
  adjuntos        jsonb default '[]',          -- [{tipo:'pdf'|'presentacion'|'imagen'|'link', url, nombre}]
  autor_nombre    text not null,               -- quién la cargó
  autor_rol       text not null,               -- 'grandbar' | 'marketing' | 'supervisor' | 'proveedor'
  autor_empresa   text,                        -- bodega/empresa (proveedores)
  estado          text default 'pendiente',    -- 'pendiente' | 'aprobada' | 'descartada'
  nota_revision   text,                        -- comentario de la reunión
  created_at      timestamptz default now()
);

-- ─── Upgrade seguro (si ya habías creado la tabla con la versión anterior) ───
alter table propuestas_acciones add column if not exists seccion        text;
alter table propuestas_acciones add column if not exists subseccion     text;
alter table propuestas_acciones add column if not exists vigencia_desde date;
alter table propuestas_acciones add column if not exists vigencia_hasta date;
do $$ begin
  -- si existían columnas viejas NOT NULL, las hacemos opcionales para no romper inserts
  if exists (select 1 from information_schema.columns where table_name='propuestas_acciones' and column_name='seccion_id') then
    alter table propuestas_acciones alter column seccion_id drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_name='propuestas_acciones' and column_name='seccion_nombre') then
    alter table propuestas_acciones alter column seccion_nombre drop not null;
    -- copiar el dato viejo a la nueva columna 'seccion' si quedó vacía
    update propuestas_acciones set seccion = seccion_nombre where seccion is null and seccion_nombre is not null;
  end if;
end $$;

alter table propuestas_acciones enable row level security;
drop policy if exists "anon_all_propuestas" on propuestas_acciones;
create policy "anon_all_propuestas" on propuestas_acciones for all using (true) with check (true);

create index if not exists prop_rubro_idx  on propuestas_acciones(rubro);
create index if not exists prop_estado_idx on propuestas_acciones(estado);
create index if not exists prop_autor_idx  on propuestas_acciones(autor_nombre);

-- ─── 2. Cargadores GrandBar (entran solo con el nombre) ─────────────────────
create table if not exists cargadores (
  id         uuid default gen_random_uuid() primary key,
  nombre     text not null,
  rol        text not null default 'grandbar',  -- 'grandbar' | 'marketing' | 'supervisor'
  activo     boolean default true,
  created_at timestamptz default now()
);

alter table cargadores enable row level security;
drop policy if exists "anon_all_cargadores" on cargadores;
create policy "anon_all_cargadores" on cargadores for all using (true) with check (true);

-- ─── 3. Proveedores (entran con usuario + contraseña) ───────────────────────
create table if not exists proveedores_carga (
  id              uuid default gen_random_uuid() primary key,
  usuario         text unique not null,
  password        text not null,
  empresa         text not null,               -- bodega / marca
  nombre_contacto text,
  activo          boolean default true,
  created_at      timestamptz default now()
);

alter table proveedores_carga enable row level security;
drop policy if exists "anon_all_prov_carga" on proveedores_carga;
create policy "anon_all_prov_carga" on proveedores_carga for all using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. SEEDS iniciales — editá / borrá desde el panel de revisión cuando quieras
-- ════════════════════════════════════════════════════════════════════════════

-- Gente de GrandBar (login por nombre). Agregá al equipo de marketing acá o desde el panel.
insert into cargadores (nombre, rol) values
  ('Luciana',              'grandbar'),
  ('Juan Pablo Mollar',    'supervisor'),
  ('Diego Sebastianelli',  'supervisor')
on conflict do nothing;

-- Proveedor DEMO para probar el login (cambialo / borralo después).
insert into proveedores_carga (usuario, password, empresa, nombre_contacto) values
  ('demo', 'demo123', 'Proveedor Demo', 'Contacto Demo')
on conflict (usuario) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Verificación
-- ════════════════════════════════════════════════════════════════════════════
select 'cargadores' as tabla, count(*) from cargadores
union all select 'proveedores_carga', count(*) from proveedores_carga
union all select 'propuestas_acciones', count(*) from propuestas_acciones;
