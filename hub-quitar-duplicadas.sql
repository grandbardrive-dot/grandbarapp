-- ============================================================
--  Hub: sacar tarjetas del área de administración que no llevaban a ningún lado
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  Las tres tenían url '#'. Las dos primeras además duplicaban lo que ya está
--  adentro del panel de Cobranzas: la cuenta corriente de cada cliente en la
--  sección Clientes, y los avisos en la sección WhatsApp. Cashflow nunca se hizo.
--
--  (Si ya corriste el delete de 'portal' y 'whatsapp', este vuelve a correrse sin
--   problema: borra lo que quede.)
-- ============================================================

delete from public.hub_herramientas
 where id in ('portal', 'whatsapp', 'cashflow');

-- Cómo queda el área de administración: solo las dos de cobranzas.
select orden, id, nombre, url, roles
  from public.hub_herramientas
 where area = 'administracion'
 order by orden;
