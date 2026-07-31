-- ============================================================
-- SETUP SUPERVISORES — GrandBar Fuerza de Ventas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Tablas
create table if not exists supervisores (
  id         uuid default gen_random_uuid() primary key,
  nombre     text not null,
  codigo     text unique not null,
  liga       text not null,   -- 'ON' | 'OFF'
  password   text not null,
  created_at timestamptz default now()
);

create table if not exists supervisor_vendedores (
  supervisor_id uuid references supervisores(id) on delete cascade,
  vendedor_id   uuid references vendedores(id)   on delete cascade,
  primary key (supervisor_id, vendedor_id)
);

-- RLS
alter table supervisores          enable row level security;
alter table supervisor_vendedores enable row level security;

create policy "anon_all_supervisores" on supervisores
  for all using (true) with check (true);
create policy "anon_all_sup_vend" on supervisor_vendedores
  for all using (true) with check (true);

-- Supervisores iniciales
insert into supervisores (nombre, codigo, liga, password) values
  ('Juan Pablo Mollar',   'SUP001', 'ON',  'sup001'),
  ('Diego Sebastianelli', 'SUP002', 'OFF', 'sup002')
on conflict (codigo) do nothing;

-- Asignación de vendedores
-- SUP001 (ON)  → 029 Nicolas Garcia, 039 Carolina Heluani, 007 Franco Roldan, 025 Pablo Cofano
-- SUP002 (OFF) → 024 Juan Pablo Fransó, 015 Facundo Ojer, 027 Exequiel Gimenez
insert into supervisor_vendedores (supervisor_id, vendedor_id)
select s.id, v.id
from supervisores s, vendedores v
where
  (s.codigo = 'SUP001' and v.codigo in ('029','039','007','025'))
  or
  (s.codigo = 'SUP002' and v.codigo in ('024','015','027'))
on conflict do nothing;

-- Verificación
select s.nombre, s.codigo, s.liga, v.nombre as vendedor, v.codigo as cod_vendedor
from supervisores s
join supervisor_vendedores sv on sv.supervisor_id = s.id
join vendedores v on v.id = sv.vendedor_id
order by s.codigo, v.nombre;
