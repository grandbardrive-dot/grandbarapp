-- ============================================================
--  GrandBar · Plan 11T Peñaflor · setup
--  Proyecto Supabase del Manual: fzaxwuuodseyyinveknn
--  Corré TODO esto una vez en el SQL Editor.
-- ============================================================

-- 1) VENTAS POR CLIENTE (base del "Real" del 11T y de la condición 6 meses).
--    La llena sync-ventas día por día (idempotente).
create table if not exists ventas_cliente (
  cliente_codigo text not null,
  sku            text not null,
  fecha          date not null,
  unidades       numeric default 0,
  primary key (cliente_codigo, sku, fecha)
);
create index if not exists vc_fecha   on ventas_cliente (fecha);
create index if not exists vc_cliente on ventas_cliente (cliente_codigo);
create index if not exists vc_sku     on ventas_cliente (sku);
alter table ventas_cliente enable row level security;
drop policy if exists "anon_all_ventas_cliente" on ventas_cliente;
create policy "anon_all_ventas_cliente" on ventas_cliente for all using (true) with check (true);

-- 2) OBJETIVOS del 11T por mes / canal / línea (se cargan a mano cada mes).
create table if not exists objetivos_11t (
  id        bigint generated always as identity primary key,
  mes       text not null,               -- 'YYYY-MM'
  canal     text not null,               -- vinotecas | tienda_bebidas | on_premise | on_premise_noche
  linea     text not null,               -- nombre de la línea comercial
  tipo      text not null default '11t', -- '11t' | 'innovacion'
  objetivo  int  default 0,
  unique (mes, canal, linea, tipo)
);
alter table objetivos_11t enable row level security;
drop policy if exists "anon_all_objetivos_11t" on objetivos_11t;
create policy "anon_all_objetivos_11t" on objetivos_11t for all using (true) with check (true);

-- 3) SEED · objetivos de AGOSTO 2026 (extraídos del Excel).
insert into objetivos_11t (mes,canal,linea,tipo,objetivo) values
('2026-08','vinotecas','Blend de Extremos','11t',49),
('2026-08','on_premise','ALMA MORA','11t',84),
('2026-08','vinotecas','COSTA&PAMPA','11t',23),
('2026-08','on_premise','CAZADOR','11t',8),
('2026-08','vinotecas','EL ESTECO','11t',13),
('2026-08','on_premise','DON DAVID','11t',50),
('2026-08','vinotecas','Fond de Cave Reserva','11t',86),
('2026-08','on_premise','FOND DE CAVE','11t',50),
('2026-08','vinotecas','JW BLACK','11t',61),
('2026-08','on_premise','Fond de Cave Reserva','11t',50),
('2026-08','vinotecas','JW GOLD Reserve','11t',28),
('2026-08','on_premise','JW BLACK','11t',44),
('2026-08','vinotecas','LA MASCOTA','11t',16),
('2026-08','on_premise','JW RED','11t',50),
('2026-08','vinotecas','MEDALLA','11t',19),
('2026-08','on_premise','LA MASCOTA','11t',16),
('2026-08','vinotecas','NC ESPUMANTES','11t',39),
('2026-08','on_premise','MEDALLA','11t',23),
('2026-08','vinotecas','TANQUERAY','11t',41),
('2026-08','on_premise','NC ESPUMANTES','11t',20),
('2026-08','vinotecas','TRAPICHE RESERVA','11t',49),
('2026-08','on_premise','TRAPICHE RESERVA','11t',49),
('2026-08','vinotecas','NAVARRO CORREAS LATA','11t',9),
('2026-08','on_premise','MEDALLA ESPUMANTE','11t',4),
('2026-08','vinotecas','ANTARES XPA','11t',25),
('2026-08','on_premise','ALMA MORA LOW BLANCO','11t',15),
('2026-08','vinotecas','GORDON´S TROPICAL','11t',57),
('2026-08','on_premise','BLEND DE EXTREMOS PINOT','11t',2),
('2026-08','vinotecas','DADA TINTO DE VERANO','11t',36),
('2026-08','on_premise','ANTARES 660','11t',4),
('2026-08','vinotecas','DADA EXTRA BRUT','11t',15),
('2026-08','on_premise','ALMA MORA LOW TINTO','11t',17),
('2026-08','vinotecas','MEDALLA ESPUMANTE','11t',16),
('2026-08','on_premise','DON DAVID LOW TORRONTES','11t',16),
('2026-08','vinotecas','ALMA MORA LOW BLANCO','11t',11),
('2026-08','vinotecas','ALMA MORA LOW TINTO','11t',17),
('2026-08','vinotecas','DON DAVID RED BLEND','11t',18),
('2026-08','vinotecas','FRIZZE MANZANA','11t',3),
('2026-08','vinotecas','ANTARES 330','11t',9),
('2026-08','vinotecas','ANTARES 660','11t',31),
('2026-08','vinotecas','DON DAVID LOW TORRONTES','11t',15),
('2026-08','vinotecas','CAZADOR ROSADO','11t',5),
('2026-08','vinotecas','ARBOLES BLANCO Y ROSADO','11t',39),
('2026-08','tienda_bebidas','ALMA MORA','11t',12),
('2026-08','on_premise_noche','ALARIS','11t',18),
('2026-08','tienda_bebidas','ANTARES','11t',7),
('2026-08','on_premise_noche','ALMA MORA','11t',23),
('2026-08','tienda_bebidas','CAZADOR','11t',7),
('2026-08','on_premise_noche','GORDON´S','11t',88),
('2026-08','tienda_bebidas','DADÁ','11t',4),
('2026-08','on_premise_noche','JW BLACK','11t',70),
('2026-08','tienda_bebidas','FOND DE CAVE','11t',11),
('2026-08','on_premise_noche','JW GOLD Reserve','11t',16),
('2026-08','tienda_bebidas','Fond de Cave Reserva','11t',9),
('2026-08','on_premise_noche','JW RED','11t',88),
('2026-08','tienda_bebidas','GORDON´S','11t',12),
('2026-08','on_premise_noche','LOS INTOCABLES','11t',48),
('2026-08','tienda_bebidas','JW RED','11t',17),
('2026-08','on_premise_noche','NC ESPUMANTES','11t',35),
('2026-08','tienda_bebidas','LOS INTOCABLES','11t',9),
('2026-08','on_premise_noche','SMIRNOFF','11t',80),
('2026-08','tienda_bebidas','Smirnoff Flavors','11t',12),
('2026-08','on_premise_noche','Smirnoff Flavors','11t',60),
('2026-08','tienda_bebidas','SMIRNOFF ICE','11t',6),
('2026-08','on_premise_noche','TANQUERAY','11t',39),
('2026-08','tienda_bebidas','DADA EXTRA BRUT','11t',5),
('2026-08','on_premise_noche','GORDON´S TROPICAL','11t',20),
('2026-08','tienda_bebidas','ANTARES XPA','11t',5),
('2026-08','on_premise_noche','FRIZZE MANZANA','11t',1),
('2026-08','tienda_bebidas','ANTARES 330','11t',1),
('2026-08','on_premise_noche','ANTARES 660','11t',4),
('2026-08','tienda_bebidas','DADA SIDRA','11t',10),
('2026-08','tienda_bebidas','GORDON´S TROPICAL','11t',12),
('2026-08','tienda_bebidas','ALMA MORA LOW BLANCO','11t',2),
('2026-08','tienda_bebidas','BLEND DE EXTREMOS PINOT','11t',15),
('2026-08','tienda_bebidas','DON DAVID RED BLEND','11t',1),
('2026-08','tienda_bebidas','NAVARRO CORREAS LATA','11t',9),
('2026-08','tienda_bebidas','FRIZZE MANZANA','11t',1),
('2026-08','tienda_bebidas','MEDALLA ESPUMANTE','11t',2),
('2026-08','tienda_bebidas','ANTARES 660','11t',6),
('2026-08','tienda_bebidas','ALMA MORA LOW TINTO','11t',2),
('2026-08','tienda_bebidas','DON DAVID LOW TORRONTES','11t',1),
('2026-08','tienda_bebidas','DADA LOW WHITE','11t',1),
('2026-08','tienda_bebidas','DADA LOW TINTO','11t',1),
('2026-08','tienda_bebidas','DADA TINTO DE VERANO','11t',3),
('2026-08','tienda_bebidas','ARBOLES BLANCO Y ROSADO','11t',4)
on conflict (mes,canal,linea,tipo) do update set objetivo=excluded.objetivo;

-- FIN
