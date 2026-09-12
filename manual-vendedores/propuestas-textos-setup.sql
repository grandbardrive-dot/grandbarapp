-- ============================================================
--  Propuestas de incorporación · texto por proveedor
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--
--  El texto que aparece arriba de las propuestas de un proveedor en la visita
--  (ej. Peñaflor: "Condición especial 1+2…") estaba fijo en el código. Ahora lo
--  edita Luciana en Propuestas de incorporación → ✏️ Texto.
--  Si un proveedor no tiene fila, la visita usa el texto fijo de siempre.
--  Se puede correr más de una vez.
-- ============================================================

create table if not exists public.propuestas_textos (
  proveedor  text primary key,
  texto      text,
  updated_at timestamptz not null default now()
);

alter table public.propuestas_textos enable row level security;
do $$ begin
  create policy "anon_all_propuestas_textos" on public.propuestas_textos
    for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- El de Peñaflor arranca con el texto que ya se veía
insert into public.propuestas_textos (proveedor, texto) values
  ('Peñaflor', 'Condición especial 1+2 para las líneas participantes de Peñaflor. Ideal para activar múltiples etiquetas en un solo pedido y maximizar el beneficio para el cliente.')
on conflict (proveedor) do nothing;

-- Comprobar
select proveedor, texto from public.propuestas_textos;
