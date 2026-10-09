// ============================================================
//  Acción de un proveedor → manual de vendedores (09/10/2026)
//  Lo usan dos pantallas, así las dos la cargan igual:
//   · Luciana (admin-propuestas-proveedores.html): "Aprobar y agregar al manual".
//   · Diseño y Desarrollo (assets/panel-admin.js): al subir la placa de una acción
//     que pide evidencia ("Requiere placa"), recién ahí entra al manual.
//  Recibe el cliente de Supabase del manual (sb) para no depender de uno global.
// ============================================================
(function () {
  const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const PLURAL = { restaurante:'restaurantes', vinoteca:'vinotecas', tienda_bebidas:'tiendas_bebidas', autoservicio:'autoservicios', hotel:'hoteles', bar:'bares', disco:'discos', mayorista:'mayoristas', evento:'eventos' };
  const ON_TRADE = ['restaurante', 'bar', 'hotel', 'disco', 'evento'];

  // El proveedor eligió rubro › sección › subsección por NOMBRE. Se buscan esas
  // secciones en el manual del rubro (Mendoza y San Luis) y la acción se carga:
  //  · como FECHA ESPECIAL (acciones_fechas) si esa sección muestra el calendario
  //    de fechas (herramienta calendario_fechas, en ella o en su sección madre);
  //  · si no, como CAMPAÑA (acciones_mensuales), que la visita muestra en la sección marcada.
  // Queda segmentada a esas secciones (secciones uuid[]), sin limitar la zona.
  async function ubicar(sb, p) {
    const { data, error } = await sb.from('checklist_secciones').select('id,zona,nombre,parent_id,especial,activa').eq('canal', p.rubro);
    if (error) throw error;
    const S = (data || []).filter(s => s.activa !== false);
    const madres = S.filter(s => !s.parent_id && nrm(s.nombre) === nrm(p.seccion));
    const hojas = p.subseccion ? S.filter(s => madres.some(m => m.id === s.parent_id) && nrm(s.nombre) === nrm(p.subseccion)) : [];
    const destino = hojas.length ? hojas : madres;
    // ¿Dónde está el calendario de fechas? En la sección elegida; si no lo tiene, en su
    // madre (así no queda repetida en dos calendarios cuando las dos lo tienen).
    let cal = destino.filter(s => s.especial === 'calendario_fechas');
    if (!cal.length) cal = madres.filter(m => m.especial === 'calendario_fechas' && destino.some(d => d.parent_id === m.id));
    return { destino, calendario: cal.length > 0, ids: [...new Set(destino.concat(cal).map(s => s.id))],
             zonas: [...new Set(destino.map(s => s.zona))], slPropio: S.some(s => s.zona === 'sanluis'),
             subFaltante: !!(p.subseccion && !hojas.length && madres.length) };
  }

  // Lo que impide cargarla (null si se puede).
  function problema(p, u) {
    if (!u.destino.length) return `No encontré la sección "${p.seccion}" en el manual de ese rubro. Puede que la hayan renombrado: pedile cambios al proveedor o cargala desde Campañas.`;
    if (u.calendario && !p.vigencia_hasta) return 'Va al calendario de fechas especiales y no tiene fecha de fin. Pedile al proveedor la vigencia o cargala en Fechas especiales.';
    return null;
  }

  // acciones_mensuales exige categoría (NOT NULL): sale del nombre de la sección.
  function categoria(p) {
    const t = nrm((p.seccion || '') + ' ' + (p.subseccion || ''));
    if (/vino|espumant|copa/.test(t)) return 'Vinos';
    if (/spirit|aperitiv|destilad|coctel/.test(t)) return 'Spirits';
    if (/cervez|rtd|frio/.test(t)) return 'Cervezas';
    return 'General';
  }

  // Carga la acción en el manual y deja la propuesta aprobada, con dónde quedó.
  // extra.placa_url: la placa de Diseño → la acción pide evidencia en la visita.
  async function publicar(sb, p, u, extra) {
    const placa = (extra && extra.placa_url) || null;
    const base = { secciones: u.ids, zonas: [], propuesta_id: p.id };
    if (placa) base.requiere_evidencia = true;
    let tabla, fila;
    if (u.calendario) {
      tabla = 'acciones_fechas';
      fila = { ...base,
        nombre: p.titulo, descripcion: p.descripcion || p.condicion || p.titulo, condicion: p.condicion || null,
        canal: ON_TRADE.includes(p.rubro) ? 'restaurantes' : 'vinotecas', rubros: [p.rubro],
        fecha_inicio: p.vigencia_desde || new Date().toISOString().slice(0, 10), fecha_fin: p.vigencia_hasta, activa: true };
      if (placa) fila.imagen_url = placa;             // el calendario ya muestra la imagen como placa
    } else {
      tabla = 'acciones_mensuales';
      fila = { ...base,
        categoria: categoria(p),
        proveedor: p.autor_empresa || p.autor_nombre || null, producto: p.titulo,
        accion: p.condicion || 'Acción del proveedor',  // la columna es NOT NULL
        varietales: p.descripcion || null,              // la tarjeta lo muestra como detalle
        aplica_a: [PLURAL[p.rubro] || p.rubro], fecha_inicio: p.vigencia_desde || null, fecha_fin: p.vigencia_hasta || null,
        productos: [], materiales: [], activa: true };
      if (placa) fila.placa_url = placa;
    }
    let r = await sb.from(tabla).insert(fila).select('id');
    // Sin evidencia-placas-setup.sql la base no conoce propuesta_id: una acción común entra igual.
    if (r.error && !placa && /propuesta_id/.test(r.error.message || '')) { delete fila.propuesta_id; r = await sb.from(tabla).insert(fila).select('id'); }
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) throw new Error('la base no aceptó el cambio (permisos).');
    const id = r.data[0].id;
    const cambios = { estado: 'aprobada', accion_tabla: tabla, accion_id: id };
    if (placa) Object.assign(cambios, { placa_url: placa, placa_subida_at: new Date().toISOString() });
    let w = await sb.from('propuestas_acciones').update(cambios).eq('id', p.id);
    if (w.error && !placa && /accion_tabla|accion_id/.test(w.error.message || '')) w = await sb.from('propuestas_acciones').update({ estado: 'aprobada' }).eq('id', p.id);
    if (w.error) throw w.error;
    return { tabla, id };
  }

  // Diseño sube otra versión de la placa de una acción que ya está en el manual.
  async function cambiarPlaca(sb, p, placa) {
    const campo = p.accion_tabla === 'acciones_fechas' ? 'imagen_url' : 'placa_url';
    const r = await sb.from(p.accion_tabla).update({ [campo]: placa, requiere_evidencia: true }).eq('id', p.accion_id).select('id');
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) throw new Error('No encontré la acción en el manual (¿la borraron desde Campañas?).');
    const w = await sb.from('propuestas_acciones').update({ placa_url: placa, placa_subida_at: new Date().toISOString() }).eq('id', p.id);
    if (w.error) throw w.error;
  }

  window.PropuestaAlManual = { ubicar, problema, publicar, cambiarPlaca, nrm };
})();
