-- GrandBar — Campos WhatsApp y logo en clientes
-- Ejecutar en Supabase → SQL Editor.
alter table clientes add column if not exists whatsapp text;
alter table clientes add column if not exists logo_url text;
