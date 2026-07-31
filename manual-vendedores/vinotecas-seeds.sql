-- ════════════════════════════════════════════════════════════════════════════
-- GrandBar — Seeds de ejemplo para Vinotecas
-- Ejecutar en Supabase → SQL Editor (después de vinotecas-refactor-setup.sql).
-- Datos realistas del portafolio GrandBar (Mendoza / San Luis).
-- Las URLs de PDF/imagen quedan en NULL: cargá los archivos reales desde el panel
-- admin (🍷 Vinotecas) cuando los tengas.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 2 planes de vidriera (S1 — cuando el cliente no tiene acuerdo vigente) ──
insert into planes_vidriera (bodega, tipo, detalle, regalo) values
  ('Doña Paula', 'Exclusiva 3 meses',
   'Vidriera exclusiva Doña Paula con mínimo 12 cajas/mes durante 3 meses. Incluye armado y reposición de material.',
   '🎁 1 caja Estate Malbec + kit POP (cenefa, copa de exhibición y tablas para sorteo)'),
  ('Salentein', 'Compartida',
   'Espacio compartido de vidriera con mínimo 6 cajas/mes entre las líneas Killka o Numina.',
   '🎁 Cenefa + display de madera 6 botellas');

-- ─── 2 promos de góndola de vinos (S2) ──────────────────────────────────────
insert into acciones_gondola (tipo, marca, nombre, condicion, descripcion, canal, activo) values
  ('vinos', 'Doña Paula', 'Sleeve Argentine Edition Mundial',
   '5+1 en caja',
   'Edición especial Mundial. Por cada 5 cajas, 1 sin cargo. Suma exhibidor de regalo y tablas para sortear entre clientes.',
   array['vinoteca'], true),
  ('vinos', 'Zuccardi', 'Serie A — Valle de Uco',
   '3+1 en blend Malbec',
   'Promo de rotación sobre Zuccardi Serie A. Por cada 3 cajas, 1 de regalo. Ideal para puntera o isla.',
   array['vinoteca'], true);

-- ─── 1 incorporación de vinoteca (S3) ───────────────────────────────────────
insert into incorporaciones_vinoteca (nombre, descripcion, condicion, beneficios, canal, activo) values
  ('Peñaflor 11 Tintos',
   'Incorporación de las 11 etiquetas tintas de Peñaflor a la góndola: Alma Mora, Don David, Fond de Cave, Cazador, Mascota, NC, Trapiche Reserva y Medalla.',
   '1+2 — primera compra de cada línea no activa',
   'Sin mínimo de cajas. Por cada caja, 2 sin cargo en la primera compra de cada línea nueva. Mejora el margen y completa segmentos de precio.',
   array['vinoteca'], true);

-- ─── 1 material POP (S10) ───────────────────────────────────────────────────
insert into materiales_pop (categoria, nombre, descripcion, stock_disponible, activo) values
  ('Exhibidores', 'Gondolero Campari 6 botellas',
   'Exhibidor metálico de góndola para 6 botellas de la línea Campari (Aperol, Campari, Cynar). Para punta de góndola o isla.',
   true, true);

-- ─── 1 partner de bodega (S11) ──────────────────────────────────────────────
insert into partners_bodegas (bodega, tipo, nombre, descripcion, canal, activo) values
  ('Doña Paula', 'degustacion',
   'Cata guiada Doña Paula para clientes finales',
   'Activación de degustación en el local con sommelier de la bodega. Incluye material de comunicación y vinos para la cata. Coordinar fecha con supervisor.',
   array['vinoteca'], true);
