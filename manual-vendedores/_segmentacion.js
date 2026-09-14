// ============================================================
//  GrandBar · Selector de segmentación (pantallas de carga de Luciana)
//
//  Zona (Mendoza / San Luis) + tipo de cliente → sección → subsección.
//  Cada acción o plan guarda:
//    secciones  uuid[]  ids de checklist_secciones donde se muestra
//    zonas      text[]  'mendoza' / 'sanluis'
//  Vacío = se ve como siempre (lo pidió el usuario: marcar es para afinar).
//  La visita lo respeta con segVa() (_checklist-data.js).
//
//  San Luis usa el manual de Mendoza en los rubros donde no tiene uno propio:
//  esas secciones se muestran como "también San Luis".
//
//  Uso:
//    const seg = await Segmentacion.montar('#seg');
//    seg.set({ secciones:[...], zonas:[...] });   // al editar
//    const { secciones, zonas } = seg.valor();    // al guardar
//    const m = await Segmentacion.mapa();          // para listar
//    Segmentacion.texto(fila, m)                   // "Mendoza · Bares · Vinos › Vino por Copa (+1)"
// ============================================================
(function () {
  const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
  const MAN_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
  const CANALES = [
    ['restaurante', '🍽️', 'Restaurantes'], ['bar', '🍺', 'Bares'], ['disco', '🕺', 'Discos'],
    ['hotel', '🏨', 'Hoteles'], ['vinoteca', '🍷', 'Vinotecas'], ['tienda_bebidas', '🏬', 'Tienda de Bebidas'],
    ['autoservicio', '🏪', 'Autoservicios'], ['mayorista', '🛒', 'Mayoristas'], ['evento', '🎉', 'Eventos (mayorista)'],
  ];
  const ZONAS = [['mendoza', 'Mendoza'], ['sanluis', 'San Luis']];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const porOrden = (a, b) => (a.orden || 0) - (b.orden || 0);
  const canalInfo = c => CANALES.find(k => k[0] === c) || [c, '📋', c];
  const zonaLbl = z => (ZONAS.find(k => k[0] === z) || [z, z])[1];

  let _secs = null;
  async function secciones() {
    if (_secs) return _secs;
    const cli = window.supabase.createClient(MAN_URL, MAN_KEY, { auth: { persistSession: false } });
    const { data, error } = await cli.from('checklist_secciones')
      .select('id,canal,zona,codigo,nombre,parent_id,orden,activa').eq('activa', true).order('orden');
    if (error) throw error;
    _secs = data || [];
    return _secs;
  }

  // id → { nombre, madre, canal, zona }
  async function mapa() {
    const S = await secciones();
    const m = {};
    S.forEach(s => { const madre = S.find(x => x.id === s.parent_id); m[s.id] = { ...s, madre: madre ? madre.nombre : null }; });
    return m;
  }

  // Texto corto para las listas.
  function texto(fila, m) {
    const secs = ((fila && fila.secciones) || []).filter(id => m && m[id]);
    const zonas = (fila && fila.zonas) || [];
    const z = zonas.length === 1 ? 'Solo ' + zonaLbl(zonas[0]) : '';
    if (!secs.length) return z ? z + ' · donde corresponda' : 'Sin segmentar (se ve donde corresponde)';
    const canales = [...new Set(secs.map(id => canalInfo(m[id].canal)[2]))];
    const p = m[secs[0]];
    const det = (p.madre ? p.madre + ' › ' : '') + p.nombre;
    return [z, canales.join(', '), det + (secs.length > 1 ? ` (+${secs.length - 1})` : '')].filter(Boolean).join(' · ');
  }

  function estilos() {
    if (document.getElementById('seg-estilos')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="seg-estilos">
      .seg{border:1.5px solid rgba(31,68,127,.16);border-radius:12px;padding:12px;background:#fff}
      .seg-fila{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .seg-lbl{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#9a9187}
      .seg-z{font:inherit;font-size:13px;font-weight:700;color:#5f574c;background:#fff;border:1.5px solid rgba(31,68,127,.22);border-radius:9px;padding:6px 13px;cursor:pointer}
      .seg-z.on{background:#1F447F;border-color:#1F447F;color:#fff}
      .seg-hint{font-size:12px;color:#9a9187}
      .seg-arbol{margin-top:6px;max-height:320px;overflow-y:auto;border-top:1px solid rgba(31,68,127,.10)}
      .seg-canal{border-bottom:1px solid rgba(31,68,127,.08)}
      .seg-canal>summary{display:flex;align-items:center;gap:8px;padding:9px 4px;cursor:pointer;list-style:none;font-size:13.5px}
      .seg-canal>summary::-webkit-details-marker{display:none}
      .seg-canal>summary b{color:#1F1B16}
      .seg-zn{font-size:11.5px;color:#9a9187;flex:1}
      .seg-n{font-size:11px;font-weight:800;color:#9a9187;background:#F0EDE6;border-radius:20px;padding:2px 9px}
      .seg-n.con{background:#1F447F;color:#fff}
      .seg-cuerpo{padding:0 4px 10px 30px}
      .seg-todo{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#1F447F;padding:4px 0 6px;cursor:pointer}
      .seg-madre-t{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#9A6B0E;margin:8px 0 2px}
      .seg-it{display:flex;align-items:center;gap:8px;font-size:13.5px;color:#1F1B16;padding:4px 0;cursor:pointer}
      .seg input[type=checkbox]{width:16px;height:16px;accent-color:#1F447F;flex:none;cursor:pointer}
      .seg-res{margin-top:9px;font-size:12.5px;font-weight:700;color:#1F447F}
      .seg-res .otra{color:#b06a1f}
      .seg-load{padding:12px;color:#9a9187;font-size:13px}
      /* Los formularios de las pantallas estilan label e input en general (mayúsculas, bloque,
         ancho 100%): acá se anula para que el árbol se vea igual en todas. */
      .seg .seg-it,.seg .seg-todo{display:flex;margin:0;text-transform:none;letter-spacing:normal}
      .seg .seg-it{font-size:13.5px;font-weight:500;color:#1F1B16}
      .seg .seg-todo{font-size:12.5px;font-weight:700;color:#1F447F}
      .seg input[type=checkbox]{width:16px;height:16px;min-width:16px;padding:0;margin:0;border:0;box-shadow:none}
    </style>`);
  }

  async function montar(sel) {
    estilos();
    const root = typeof sel === 'string' ? document.querySelector(sel) : sel;
    root.innerHTML = '<div class="seg-load">Cargando secciones…</div>';
    let S = [];
    try { S = await secciones(); }
    catch (e) {
      root.innerHTML = '<div class="seg-load">No se pudieron cargar las secciones del manual.</div>';
      return { valor: () => ({ secciones: [], zonas: [] }), set() {} };
    }
    const st = { secciones: new Set(), zonas: new Set(), abiertos: new Set() };
    const tieneSL = c => S.some(s => s.canal === c && s.zona === 'sanluis');
    const canales = CANALES.map(k => k[0]).concat([...new Set(S.map(s => s.canal))].filter(c => !CANALES.some(k => k[0] === c)));
    const hojasDe = m => { const h = S.filter(s => s.parent_id === m.id).sort(porOrden); return h.length ? h : [m]; };

    // Grupos visibles: un canal por cada zona que se está mirando. Si San Luis no
    // tiene manual propio de ese canal, se usa (y se muestra) el de Mendoza.
    function grupos() {
      const ver = st.zonas.size ? [...st.zonas] : ['mendoza', 'sanluis'];
      const out = [];
      canales.forEach(c => {
        const zonasCanal = [...new Set(ver.map(z => (z === 'sanluis' && !tieneSL(c)) ? 'mendoza' : z))];
        zonasCanal.forEach(z => {
          const madres = S.filter(s => s.canal === c && s.zona === z && !s.parent_id).sort(porOrden);
          if (madres.length) out.push({ c, z, madres, key: c + '|' + z });
        });
      });
      return out;
    }

    function render() {
      const G = grupos();
      const visibles = new Set(G.flatMap(g => g.madres.flatMap(hojasDe)).map(h => h.id));
      const ocultas = [...st.secciones].filter(id => !visibles.has(id)).length;
      root.innerHTML = `<div class="seg">
        <div class="seg-fila"><span class="seg-lbl">Zona</span>
          ${ZONAS.map(([z, l]) => `<button type="button" class="seg-z ${st.zonas.has(z) ? 'on' : ''}" data-z="${z}">${l}</button>`).join('')}
          <span class="seg-hint">${st.zonas.size === 1 ? 'Solo ' + zonaLbl([...st.zonas][0]) : 'Mendoza y San Luis'}</span></div>
        <div class="seg-lbl" style="margin-top:12px">Tipo de cliente › sección › subsección</div>
        <div class="seg-arbol">${G.map((g, gi) => {
          const hojas = g.madres.flatMap(hojasDe);
          const n = hojas.filter(h => st.secciones.has(h.id)).length;
          const [, ico, lbl] = canalInfo(g.c);
          const zn = zonaLbl(g.z) + (g.z === 'mendoza' && !tieneSL(g.c) ? ' · también San Luis' : '');
          return `<details class="seg-canal" data-key="${g.key}" ${st.abiertos.has(g.key) || n ? 'open' : ''}>
            <summary><span>${ico}</span><b>${esc(lbl)}</b><span class="seg-zn">${esc(zn)}</span><span class="seg-n ${n ? 'con' : ''}">${n}/${hojas.length}</span></summary>
            <div class="seg-cuerpo">
              <label class="seg-todo"><input type="checkbox" data-todo="${gi}" ${n && n === hojas.length ? 'checked' : ''}> Todo ${esc(lbl)}</label>
              ${g.madres.map(m => {
                const hs = S.filter(s => s.parent_id === m.id).sort(porOrden);
                if (!hs.length) return `<label class="seg-it"><input type="checkbox" value="${m.id}" ${st.secciones.has(m.id) ? 'checked' : ''}> ${esc(m.nombre)}</label>`;
                return `<div class="seg-madre-t">${esc(m.nombre)}</div>` + hs.map(h =>
                  `<label class="seg-it"><input type="checkbox" value="${h.id}" ${st.secciones.has(h.id) ? 'checked' : ''}> ${esc(h.nombre)}</label>`).join('');
              }).join('')}
            </div></details>`;
        }).join('')}</div>
        <div class="seg-res">${st.secciones.size
          ? `${st.secciones.size} ${st.secciones.size > 1 ? 'secciones marcadas' : 'sección marcada'}${ocultas ? ` <span class="otra">— ${ocultas} de la otra zona, que no estás viendo</span>` : ''}`
          : 'Sin secciones marcadas: se ve donde corresponde, como hasta ahora.'}</div>
      </div>`;
      root._grupos = G;
    }

    root.addEventListener('click', e => {
      const b = e.target.closest('.seg-z');
      if (!b) return;
      const z = b.dataset.z;
      if (st.zonas.has(z)) st.zonas.delete(z); else st.zonas.add(z);
      if (st.zonas.size === 2) st.zonas.clear();   // las dos = sin restricción
      render();
    });
    root.addEventListener('toggle', e => {
      const d = e.target.closest && e.target.closest('.seg-canal');
      if (!d) return;
      if (d.open) st.abiertos.add(d.dataset.key); else st.abiertos.delete(d.dataset.key);
    }, true);
    root.addEventListener('change', e => {
      const cb = e.target;
      if (cb.type !== 'checkbox') return;
      if (cb.dataset.todo != null) {
        const g = root._grupos[Number(cb.dataset.todo)];
        g.madres.flatMap(hojasDe).forEach(h => { if (cb.checked) st.secciones.add(h.id); else st.secciones.delete(h.id); });
        st.abiertos.add(g.key);
      } else if (cb.checked) st.secciones.add(cb.value); else st.secciones.delete(cb.value);
      render();
    });

    render();
    return {
      valor: () => ({ secciones: [...st.secciones], zonas: [...st.zonas] }),
      set(v) {
        st.secciones = new Set((v && v.secciones) || []);
        st.zonas = new Set((v && v.zonas) || []);
        if (st.zonas.size === 2) st.zonas.clear();
        render();
      },
    };
  }

  window.Segmentacion = { montar, mapa, texto, secciones };
})();
