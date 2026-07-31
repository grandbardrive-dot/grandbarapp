-- ============================================================
-- SETUP SUCURSAL SAN LUIS — GrandBar Fuerza de Ventas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Agregar SUP003 (Martin Juarez — San Luis, maneja ambas ligas)
INSERT INTO supervisores (nombre, codigo, liga, password) VALUES
  ('Martin Juarez', 'SUP003', 'AMBAS', 'sup003')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar vendedores San Luis a SUP003
-- 006 Daniel Perez, 010 Martin Juarez (él mismo), 017 Lucas Juarez,
-- 041 Franco Fernandez, 043 Jonathan Guigue
INSERT INTO supervisor_vendedores (supervisor_id, vendedor_id)
SELECT s.id, v.id
FROM supervisores s, vendedores v
WHERE s.codigo = 'SUP003'
  AND v.codigo IN ('006','010','017','041','043')
ON CONFLICT DO NOTHING;

-- Verificación final — todos los supervisores y sus equipos
SELECT
  s.nombre        AS supervisor,
  s.codigo        AS cod_sup,
  s.liga,
  v.nombre        AS vendedor,
  v.codigo        AS cod_vend
FROM supervisores s
JOIN supervisor_vendedores sv ON sv.supervisor_id = s.id
JOIN vendedores v ON v.id = sv.vendedor_id
ORDER BY s.codigo, v.nombre;
