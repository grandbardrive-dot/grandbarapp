-- ============================================================
--  Hub: sacar dos herramientas que ya están adentro de Cobranzas
--  Correr en el proyecto del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  "Portal Cuenta Corriente" y "Recordatorios WhatsApp" eran tarjetas aparte,
--  las dos con url '#' (no llevaban a ningún lado). Lo que prometían ya está
--  adentro del panel de Cobranzas: la cuenta corriente de cada cliente en la
--  sección Clientes, y los avisos en la sección WhatsApp.
-- ============================================================

delete from public.hub_herramientas
 where id in ('portal', 'whatsapp');

-- Cómo quedó el área de administración.
select orden, id, nombre, url, roles
  from public.hub_herramientas
 where area = 'administracion'
 order by orden;
