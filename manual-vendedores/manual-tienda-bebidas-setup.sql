-- ============================================================
--  Manual de TIENDA DE BEBIDAS
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor
--
--  El rubro ya existe en el sistema: está la pestaña "🏬 Tienda de Bebidas" en
--  Secciones del manual y el código ya manda ahí a los clientes de ese tipo.
--  Lo único que falta es el contenido: hoy tiene cero secciones, así que el
--  vendedor abre la visita y no ve nada.
--
--  Esto copia el manual de Vinoteca (10 secciones, 16 subsecciones y 35 ítems).
--  Es el más parecido: los dos son OFF y venden para llevar, y de hecho la mitad
--  de los clientes de la planilla hoy están cargados como vinoteca.
--
--  Es un PUNTO DE PARTIDA, no el manual definitivo: Luciana después edita,
--  saca lo que no aplique y agrega lo propio, desde Secciones del manual.
--
--  Se puede correr más de una vez sin duplicar nada.
-- ============================================================

-- ── 1) Las secciones madre ──────────────────────────────────
insert into public.checklist_secciones
  (canal, zona, codigo, nombre, descripcion, icono, icono_bg, icono_color,
   especial, intro, orden, activa, pdf_url, parent_id)
select 'tienda_bebidas', s.zona, s.codigo, s.nombre, s.descripcion, s.icono, s.icono_bg, s.icono_color,
       s.especial, s.intro, s.orden, s.activa, s.pdf_url, null
  from public.checklist_secciones s
 where s.canal = 'vinoteca' and s.zona = 'mendoza' and s.parent_id is null
on conflict (canal, zona, codigo) do nothing;


-- ── 2) Las subsecciones ─────────────────────────────────────
-- El parent_id no se puede copiar tal cual: hay que apuntar a la sección madre
-- NUEVA. Se la encuentra por el código, que es único dentro de canal + zona.
insert into public.checklist_secciones
  (canal, zona, codigo, nombre, descripcion, icono, icono_bg, icono_color,
   especial, intro, orden, activa, pdf_url, parent_id)
select 'tienda_bebidas', h.zona, h.codigo, h.nombre, h.descripcion, h.icono, h.icono_bg, h.icono_color,
       h.especial, h.intro, h.orden, h.activa, h.pdf_url,
       (select n.id from public.checklist_secciones n
         where n.canal = 'tienda_bebidas' and n.zona = h.zona and n.codigo = m.codigo)
  from public.checklist_secciones h
  join public.checklist_secciones m on m.id = h.parent_id
 where h.canal = 'vinoteca' and h.zona = 'mendoza' and h.parent_id is not null
on conflict (canal, zona, codigo) do nothing;


-- ── 3) Los ítems del checklist ──────────────────────────────
-- El "not exists" evita duplicar si esto se corre dos veces.
insert into public.checklist_items (seccion_id, texto, descripcion, orden, activo)
select n.id, i.texto, i.descripcion, i.orden, i.activo
  from public.checklist_items i
  join public.checklist_secciones v on v.id = i.seccion_id
  join public.checklist_secciones n
    on n.canal = 'tienda_bebidas' and n.zona = v.zona and n.codigo = v.codigo
 where v.canal = 'vinoteca' and v.zona = 'mendoza'
   and not exists (select 1 from public.checklist_items x where x.seccion_id = n.id);


-- ── 4) Comprobar cómo quedó ─────────────────────────────────
select s.orden,
       case when s.parent_id is null then s.nombre else '    └ ' || s.nombre end as seccion,
       (select count(*) from public.checklist_items i where i.seccion_id = s.id) as items
  from public.checklist_secciones s
 where s.canal = 'tienda_bebidas'
 order by coalesce((select m.orden from public.checklist_secciones m where m.id = s.parent_id), s.orden),
          s.parent_id nulls first, s.orden;
