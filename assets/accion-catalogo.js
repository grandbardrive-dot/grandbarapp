// ============================================================
//  GrandBar · Formulario de una acción del catálogo de clientes (10/11/2026)
//  El mismo "Nueva acción" que usa Luciana en el catálogo (catalogo-admin/js/admin.js),
//  para las acciones que propone Trade Marketing:
//    - trade-catalogo.html: Juan Pablo Sepúlveda la carga y se la manda a Luciana;
//    - manual-vendedores/admin-trade-catalogo.html: Luciana la revisa y la edita.
//  Necesita supabase-js y manual-vendedores/_segmentacion.js cargados antes.
//
//  Uso:
//    const provs = await AccionCatalogo.proveedores();
//    AccionCatalogo.abrir({ titulo, datos, proveedores: provs, nota: { valor, etiqueta } | null,
//      botones: [{ texto, clase: 'pri'|'ok'|'', accion: async (datos, nota) => 'error' | undefined }] });
//    AccionCatalogo.resumen(datos, mapaSegmentacion)   // filas para las tarjetas
// ============================================================
(function () {
  const CAT = { url: 'https://zlwnoqdxendsgbfvfyue.supabase.co', key: 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4' };
  const BUCKET = 'Activaciones', CARPETA = 'catalogo/productos';
  const CANALES = [['ambos', 'ON y OFF'], ['on', 'Solo ON'], ['off', 'Solo OFF'], ['mayorista', 'Mayorista']];
  const CANAL = { ambos: 'Catálogos ON y OFF', on: 'Catálogo ON', off: 'Catálogo OFF', mayorista: 'Catálogo mayorista' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = (n) => (n == null || n === '' || isNaN(Number(n))) ? '' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const num = (v) => { const s = String(v == null ? '' : v).trim().replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };

  let _cli = null;
  const cli = () => _cli || (_cli = window.supabase.createClient(CAT.url, CAT.key, { auth: { persistSession: false } }));

  // Proveedores del catálogo, en orden alfabético (como los desplegables de Luciana).
  async function proveedores() {
    const { data, error } = await cli().from('catalogo_proveedores').select('id,nombre,categoria,activo');
    if (error) throw error;
    return (data || []).sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));
  }

  async function subirFoto(file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = CARPETA + '/trade_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now() + '.' + ext;
    const up = await cli().storage.from(BUCKET).upload(path, file, { upsert: true, cacheControl: '3600' });
    if (up.error) throw up.error;
    return cli().storage.from(BUCKET).getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
  }

  function estilos() {
    if (document.getElementById('gbac-css')) return;
    const st = document.createElement('style'); st.id = 'gbac-css';
    st.textContent = `
      .gbac-ov{position:fixed;inset:0;background:rgba(13,34,48,.6);display:flex;align-items:flex-start;justify-content:center;z-index:120;padding:24px 16px;overflow-y:auto}
      .gbac-m{background:#fff;border-radius:16px;width:100%;max-width:620px;padding:20px 22px;color:#1b2a32;font-family:inherit;box-shadow:0 24px 60px rgba(0,0,0,.25)}
      .gbac-m h3{margin:0 0 4px;font-size:18px;font-weight:800}
      .gbac-m .gbac-sub{margin:0 0 6px;color:#6d7d85;font-size:13.5px;line-height:1.45}
      .gbac-m label{display:block;font-size:12.5px;font-weight:700;color:#6d7d85;margin:13px 0 5px}
      .gbac-m input[type=text],.gbac-m input[type=number],.gbac-m select,.gbac-m textarea{width:100%;box-sizing:border-box;border:1px solid #e3dccd;border-radius:10px;padding:10px 11px;font:inherit;font-size:14px;background:#fff;color:#1b2a32}
      .gbac-m textarea{min-height:76px;resize:vertical}
      .gbac-m input:focus,.gbac-m select:focus,.gbac-m textarea:focus{outline:none;border-color:var(--gbac-pri,#1F447F)}
      .gbac-g2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
      .gbac-off{display:flex;gap:6px}.gbac-off input{flex:1}
      .gbac-chk{display:flex!important;align-items:center;gap:9px;font-size:14px!important;color:#1b2a32!important;font-weight:600!important;cursor:pointer;margin-top:16px!important}
      .gbac-chk input{width:18px;height:18px;margin:0}
      .gbac-foto{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .gbac-foto img{width:64px;height:64px;object-fit:contain;border-radius:10px;background:#f5f1e8;border:1px solid #e3dccd}
      .gbac-ayuda{font-size:12.5px;color:#6d7d85;margin-top:6px;line-height:1.4}
      .gbac-err{color:#b5482d;font-size:13.5px;font-weight:600;min-height:18px;margin-top:12px}
      .gbac-acts{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px}
      .gbac-b{border:1.5px solid #e3dccd;background:#fff;color:#1b2a32;border-radius:10px;padding:10px 15px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}
      .gbac-b.pri{background:var(--gbac-pri,#1F447F);border-color:var(--gbac-pri,#1F447F);color:#fff}
      .gbac-b.ok{background:#2D6A4F;border-color:#2D6A4F;color:#fff}
      .gbac-b:disabled{opacity:.55;cursor:default}
      .gbac-b.chico{padding:7px 11px;font-size:12.5px}
      .gbac-snap{display:grid;grid-template-columns:110px 1fr;gap:5px 12px;font-size:13.5px;margin-top:10px}
      .gbac-snap b{color:#8a949a;font-weight:700}
      .gbac-snap span{color:#1b2a32;white-space:pre-wrap;word-break:break-word}
      @media(max-width:600px){ .gbac-ov{padding:0} .gbac-m{border-radius:0;min-height:100%;padding:18px 16px} .gbac-g2{grid-template-columns:1fr} .gbac-snap{grid-template-columns:96px 1fr} }`;
    document.head.appendChild(st);
  }

  function abrir(o) {
    estilos();
    const d = o.datos || {};
    const ov = document.createElement('div'); ov.className = 'gbac-ov';
    const provOpts = (o.proveedores || []).map((p) => '<option value="' + esc(p.id) + '"' + (p.id === d.proveedor_id ? ' selected' : '') + '>'
      + esc(p.nombre) + (p.categoria ? ' (' + esc(p.categoria) + ')' : '') + (p.activo === false ? ' · oculto' : '') + '</option>').join('');
    const val = (v) => (v == null ? '' : esc(v));
    ov.innerHTML = '<div class="gbac-m" role="dialog" aria-modal="true">'
      + '<h3>' + esc(o.titulo || 'Nueva acción') + '</h3>' + (o.subtitulo ? '<p class="gbac-sub">' + esc(o.subtitulo) + '</p>' : '')
      + '<label for="gbac-prov">Proveedor</label><select id="gbac-prov"><option value="">Elegí el proveedor…</option>' + provOpts + '</select>'
      + '<label for="gbac-nom">Producto</label><input type="text" id="gbac-nom" maxlength="200" placeholder="Ej: FERNET BUHERO NEGRO" value="' + val(d.nombre_producto) + '">'
      + '<label for="gbac-sku">SKU promo</label><input type="text" id="gbac-sku" maxlength="80" placeholder="SKU promo (opcional)" value="' + val(d.sku_promo) + '">'
      + '<div class="gbac-g2">'
      + '<div><label for="gbac-acc">Precio accionado</label><input type="number" step="any" id="gbac-acc" placeholder="precio accionado" value="' + val(d.precio_accionado) + '"></div>'
      + '<div><label for="gbac-reg">Precio regular</label><input type="number" step="any" id="gbac-reg" placeholder="precio regular (opcional)" value="' + val(d.precio_regular) + '"></div>'
      + '<div><label for="gbac-sug">Sugerido de venta</label><input type="number" step="any" id="gbac-sug" placeholder="opcional" value="' + val(d.sugerido_venta) + '"></div>'
      + '<div><label for="gbac-off">% OFF</label><div class="gbac-off"><input type="number" step="1" id="gbac-off" placeholder="opcional" value="' + val(d.porcentaje_off) + '">'
      + '<button type="button" class="gbac-b chico" id="gbac-auto" title="Calcular desde los precios">auto</button></div></div>'
      + '</div>'
      + '<label for="gbac-mec">Mecánica</label><input type="text" id="gbac-mec" maxlength="400" placeholder="mecánica (ej: 5+1)" value="' + val(d.mecanica) + '">'
      + '<label for="gbac-info">Info adicional</label><input type="text" id="gbac-info" maxlength="600" placeholder="info adicional (opcional)" value="' + val(d.info_adicional) + '">'
      + '<label for="gbac-canal">Canal</label><select id="gbac-canal">' + CANALES.map(([v, t]) => '<option value="' + v + '"' + ((d.canal || 'ambos') === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>'
      + '<label class="gbac-chk"><input type="checkbox" id="gbac-evid"' + (d.requiere_evidencia ? ' checked' : '') + '> Requiere evidencia (muestra el cartel en la acción)</label>'
      + '<label>Foto del producto (opcional)</label><div class="gbac-foto"><img id="gbac-img" alt=""' + (d.imagen_url ? ' src="' + esc(d.imagen_url) + '"' : ' hidden') + '>'
      + '<input type="file" id="gbac-file" accept="image/*" hidden><button type="button" class="gbac-b chico" id="gbac-elegir">' + (d.imagen_url ? 'Cambiar foto' : 'Elegir foto') + '</button>'
      + '<button type="button" class="gbac-b chico" id="gbac-quitar"' + (d.imagen_url ? '' : ' hidden') + '>Quitar</button></div>'
      + '<label>¿Dónde se ve en el manual? (opcional)</label><div id="gbac-seg"><div class="gbac-ayuda">Cargando secciones…</div></div>'
      + '<div class="gbac-ayuda">Si no marcás nada, la oferta se ubica sola según su categoría, como hasta ahora.</div>'
      + (o.nota ? '<label for="gbac-nota">' + esc(o.nota.etiqueta || 'Nota') + '</label><textarea id="gbac-nota" maxlength="1500" placeholder="' + esc(o.nota.placeholder || '') + '">' + esc(o.nota.valor || '') + '</textarea>' : '')
      + '<div class="gbac-err" id="gbac-err"></div>'
      + '<div class="gbac-acts"><button type="button" class="gbac-b" id="gbac-cancel">Cancelar</button>'
      + (o.botones || []).map((b, i) => '<button type="button" class="gbac-b ' + esc(b.clase || '') + '" data-i="' + i + '">' + esc(b.texto) + '</button>').join('') + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    const $ = (id) => ov.querySelector('#' + id);
    const cerrar = () => { ov.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', esc_);
    $('gbac-cancel').onclick = cerrar;

    $('gbac-auto').onclick = () => {
      const acc = num($('gbac-acc').value), reg = num($('gbac-reg').value);
      if (!acc || !reg) { $('gbac-err').textContent = 'Para calcular el % OFF faltan los dos precios.'; return; }
      $('gbac-off').value = Math.round((1 - acc / reg) * 100); $('gbac-err').textContent = '';
    };

    // Foto: se sube recién al guardar.
    let imagen = d.imagen_url || null, archivo = null;
    $('gbac-elegir').onclick = () => $('gbac-file').click();
    $('gbac-file').onchange = () => {
      const f = $('gbac-file').files[0]; if (!f) return;
      archivo = f; $('gbac-img').src = URL.createObjectURL(f); $('gbac-img').hidden = false; $('gbac-quitar').hidden = false; $('gbac-elegir').textContent = 'Cambiar foto';
    };
    $('gbac-quitar').onclick = () => { archivo = null; imagen = null; $('gbac-img').hidden = true; $('gbac-quitar').hidden = true; $('gbac-file').value = ''; $('gbac-elegir').textContent = 'Elegir foto'; };

    let seg = null;
    if (window.Segmentacion) {
      window.Segmentacion.montar($('gbac-seg')).then((s) => { seg = s; s.set({ secciones: d.secciones || [], zonas: d.zonas || [] }); })
        .catch(() => { $('gbac-seg').innerHTML = '<div class="gbac-ayuda">No se pudo cargar el selector de secciones.</div>'; });
    } else $('gbac-seg').innerHTML = '<div class="gbac-ayuda">No se pudo cargar el selector de secciones (recargá la página).</div>';

    ov.querySelectorAll('[data-i]').forEach((btn) => btn.onclick = async () => {
      const b = o.botones[+btn.dataset.i];
      const err = $('gbac-err'); err.textContent = '';
      if (!$('gbac-prov').value) { err.textContent = 'Elegí un proveedor.'; return; }
      if (!$('gbac-nom').value.trim()) { err.textContent = 'Poné un nombre de producto.'; return; }
      const botones = ov.querySelectorAll('.gbac-acts button');
      botones.forEach((x) => x.disabled = true);
      const txtAntes = btn.textContent; btn.textContent = 'Guardando…';
      try {
        if (archivo) { imagen = await subirFoto(archivo); archivo = null; }
        const s = seg ? seg.valor() : { secciones: d.secciones || [], zonas: d.zonas || [] };
        const datos = {
          proveedor_id: $('gbac-prov').value, nombre_producto: $('gbac-nom').value.trim(), sku_promo: $('gbac-sku').value.trim(),
          precio_accionado: $('gbac-acc').value, precio_regular: $('gbac-reg').value, sugerido_venta: $('gbac-sug').value,
          porcentaje_off: $('gbac-off').value, mecanica: $('gbac-mec').value.trim(), info_adicional: $('gbac-info').value.trim(),
          canal: $('gbac-canal').value, requiere_evidencia: $('gbac-evid').checked, imagen_url: imagen, secciones: s.secciones, zonas: s.zonas,
        };
        const r = await b.accion(datos, o.nota ? $('gbac-nota').value.trim() : null);
        if (r) throw new Error(r);
        cerrar();
      } catch (e) {
        err.textContent = (e && e.message) || String(e);
        botones.forEach((x) => x.disabled = false); btn.textContent = txtAntes;
      }
    });
    setTimeout(() => $(d.proveedor_id ? 'gbac-nom' : 'gbac-prov').focus(), 50);
    return { cerrar };
  }

  // Los datos de la acción para mostrar en una tarjeta.
  function resumen(d, mapa) {
    d = d || {};
    const precios = [d.precio_accionado != null ? plata(d.precio_accionado) + ' accionado' : '', d.precio_regular != null ? plata(d.precio_regular) + ' regular' : '']
      .filter(Boolean).join(' · ');
    const donde = ((d.secciones || []).length || (d.zonas || []).length) && mapa && window.Segmentacion
      ? window.Segmentacion.texto(d, mapa) : 'Se ubica sola según su categoría';
    const filas = [
      ['Proveedor', (d.proveedor_nombre || '') + (d.proveedor_categoria ? ' (' + d.proveedor_categoria + ')' : '')],
      ['Mecánica', d.mecanica], ['Precios', precios],
      ['Sugerido', d.sugerido_venta != null ? plata(d.sugerido_venta) : ''], ['% OFF', d.porcentaje_off != null ? d.porcentaje_off + '%' : ''],
      ['SKU promo', d.sku_promo], ['Info adicional', d.info_adicional],
      ['Catálogo', CANAL[d.canal || 'ambos']], ['En el manual', donde],
      ['Evidencia', d.requiere_evidencia ? 'Requiere evidencia' : ''],
    ].filter((f) => f[1]);
    return '<div class="gbac-snap">' + filas.map((f) => '<b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span>').join('') + '</div>';
  }

  estilos();
  window.AccionCatalogo = { proveedores, abrir, resumen, CANAL };
})();
