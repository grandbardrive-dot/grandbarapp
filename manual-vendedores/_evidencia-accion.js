// ============================================================
//  GrandBar · _evidencia-accion.js  (14/10/2026)
//  Evidencia de las acciones de Luciana en la visita: campañas, planes, fechas
//  especiales, vinos sobre la mesa, punteras, volumen y degustaciones (el catálogo
//  de clientes no lleva evidencia). Las que Luciana marcó "Requiere evidencia" tienen
//  "📷 Cargar evidencia" (fotos + comentario); las demás, no.
//  El día del cierre el pedido todavía no llegó: la evidencia se carga en la visita
//  siguiente. Por eso la Introducción muestra "Evidencias pendientes": lo que se
//  cerró en visitas anteriores con este cliente y todavía no tiene fotos.
//  Le llega a Trade Marketing (Juan Pablo Sepúlveda) y al proveedor de la acción
//  (función acciones-evidencias).
//
//  Uso (visita.html):
//    GBEvid.init({ cliente, token: _hubToken, sb, toast: showToast })
//    GBEvid.boton({ t:'campania', id, titulo, prov, req }) → HTML del botón ('' si req no es true)
//    GBEvid.pendientes(elemento)                          → lista de pendientes
// ============================================================
(function () {
  if (window.GBEvid) return;
  var FN = '/.netlify/functions/acciones-evidencias';
  var TIPO = { campania: 'Campaña', plan: 'Plan', fecha: 'Fecha especial', vino_mesa: 'Sobre la mesa', puntera: 'Puntera', volumen: 'Acción de volumen', degustacion: 'Degustación' };
  // Estados del carrito que significan "el cliente cerró la acción".
  var CIERRAN = /^(aceptada|cerrada|oferta|incorporaci|agregad)/i;
  var MAX_FOTOS = 3;
  var CFG = null, YA = new Map(), META = null, FOTOS = [], ELPEND = null;

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clave = function (t, id) { return t + '|' + id; };
  var fCorta = function (f) { if (!f) return ''; var p = String(f).slice(0, 10).split('-'); return p[2] + '/' + p[1]; };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function aviso(m, tipo) { if (CFG && CFG.toast) CFG.toast(m, tipo); else alert(m); }

  // ── Estilos y ventana (una sola vez) ─────────────────────────────────────
  function montar() {
    if (document.getElementById('gbevOv')) return;
    var st = document.createElement('style');
    st.textContent = [
      '.gbev-btn{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:6px 11px;border-radius:8px;border:1px solid var(--azul,#1F447F);background:#fff;color:var(--azul,#1F447F);font:inherit;font-size:12px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.gbev-btn.ya{border-color:#bfe0d0;background:#eaf5ef;color:#2f6f5e}',
      '.gbev-ov{position:fixed;inset:0;background:rgba(15,35,64,.55);display:flex;align-items:flex-end;justify-content:center;z-index:9000}',
      '.gbev-ov[hidden]{display:none}',
      '.gbev-md{background:#fff;width:100%;max-width:480px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.25)}',
      '@media(min-width:600px){.gbev-ov{align-items:center}.gbev-md{border-radius:18px}}',
      '.gbev-hd{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;background:var(--azul,#1F447F);color:#fff;font-size:15.5px}',
      '.gbev-x{background:rgba(255,255,255,.16);border:0;color:#fff;width:32px;height:32px;border-radius:8px;font-size:15px;cursor:pointer}',
      '.gbev-bd{padding:15px 18px;display:grid;gap:9px}',
      '.gbev-acc{background:#f6f3ee;border-radius:11px;padding:10px 12px;font-size:13.5px;line-height:1.4}',
      '.gbev-acc small{display:block;color:#6d7d85;margin-top:2px}',
      '.gbev-lb{font-size:12.5px;font-weight:800;color:#1b2a32;margin-top:4px}',
      '.gbev-lb small{font-weight:500;color:#8a929a}',
      '.gbev-fotos{display:flex;gap:8px;flex-wrap:wrap}',
      '.gbev-f{position:relative;width:86px;height:86px;border-radius:10px;overflow:hidden;background:#eee}',
      '.gbev-f img{width:100%;height:100%;object-fit:cover;display:block}',
      '.gbev-f button{position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:13px;cursor:pointer}',
      '.gbev-add{display:flex;align-items:center;justify-content:center;gap:6px;border:1.5px dashed #b9c3cc;border-radius:11px;padding:13px;font-size:13.5px;font-weight:700;color:var(--azul,#1F447F);cursor:pointer}',
      '.gbev-in{width:100%;border:1.5px solid #dfe3e6;border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;background:#fdfcfa;box-sizing:border-box}',
      'textarea.gbev-in{min-height:64px;resize:vertical}',
      '.gbev-msg{font-size:13px;color:#b5482d;min-height:1px}',
      '.gbev-ft{display:flex;gap:8px;padding:12px 18px 18px}',
      '.gbev-ft button{flex:1;border-radius:11px;padding:13px;font:inherit;font-weight:800;font-size:14px;cursor:pointer}',
      '.gbev-no{background:#fff;border:1.5px solid #dfe3e6;color:#5b6670}',
      '.gbev-si{background:var(--azul,#1F447F);border:0;color:#fff}',
      '.gbev-si:disabled{opacity:.55;cursor:default}',
      '.gbev-pend{background:#fff;border:1px solid #e8dcc0;border-left:4px solid var(--dorado,#CBB86A);border-radius:12px;padding:12px 14px;margin:10px 0}',
      '.gbev-pend-t{font-weight:800;font-size:14px}',
      '.gbev-pend-s{font-size:12px;color:#6d7d85;margin:2px 0 6px}',
      '.gbev-pend-it{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0ebe0}',
      '.gbev-pend-it b{font-size:13.5px}',
      '.gbev-pend-it small{display:block;font-size:11.5px;color:#6d7d85}',
      '.gbev-pend-it .gbev-btn{margin-top:0}'
    ].join('\n');
    document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend',
      '<div class="gbev-ov" id="gbevOv" hidden><div class="gbev-md" role="dialog" aria-modal="true" aria-labelledby="gbevTit">' +
      '<div class="gbev-hd"><b id="gbevTit">Cargar evidencia</b><button type="button" class="gbev-x" data-gbev-cerrar aria-label="Cerrar">✕</button></div>' +
      '<div class="gbev-bd">' +
      '<div class="gbev-acc" id="gbevAcc"></div>' +
      '<div class="gbev-lb">Fotos del punto de venta <small>(hasta 3)</small></div>' +
      '<div class="gbev-fotos" id="gbevFotos"></div>' +
      '<label class="gbev-add" id="gbevAdd"><input type="file" accept="image/*" multiple id="gbevFile" hidden>📷 Agregar foto</label>' +
      '<label class="gbev-lb" for="gbevFecha">¿Cuándo se cerró la acción? <small>(opcional)</small></label>' +
      '<input type="date" id="gbevFecha" class="gbev-in">' +
      '<label class="gbev-lb" for="gbevCom">Comentario <small>(opcional)</small></label>' +
      '<textarea id="gbevCom" class="gbev-in" maxlength="500" placeholder="Qué se ve en la foto, dónde quedó la acción…"></textarea>' +
      '<div class="gbev-msg" id="gbevMsg"></div>' +
      '</div>' +
      '<div class="gbev-ft"><button type="button" class="gbev-no" data-gbev-cerrar>Cancelar</button><button type="button" class="gbev-si" id="gbevOk">Enviar evidencia</button></div>' +
      '</div></div>');
    document.getElementById('gbevFile').addEventListener('change', function (e) { sumarFotos(e.target.files); e.target.value = ''; });
    document.getElementById('gbevOk').addEventListener('click', enviar);
    document.getElementById('gbevOv').addEventListener('click', function (e) { if (e.target.id === 'gbevOv' || e.target.closest('[data-gbev-cerrar]')) cerrar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('gbevOv').hidden) cerrar(); });
  }

  // Un botón en cualquier tarjeta: el click se toma acá (antes que el de la tarjeta).
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-gbev]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    try { abrir(JSON.parse(decodeURIComponent(b.getAttribute('data-gbev')))); } catch (err) {}
  }, true);

  function boton(meta) {
    if (!meta || meta.req !== true || !meta.t || !meta.id || !TIPO[meta.t]) return '';
    var k = clave(meta.t, meta.id), ya = YA.has(k);
    return '<button type="button" class="gbev-btn' + (ya ? ' ya' : '') + '" data-gbev-k="' + esc(k) + '" data-gbev="' + esc(encodeURIComponent(JSON.stringify(meta))) + '">' +
      (ya ? '✓ Evidencia cargada · sumar otra' : '📷 Cargar evidencia') + '</button>';
  }
  function repintar() {
    document.querySelectorAll('[data-gbev-k]').forEach(function (b) {
      var ya = YA.has(b.getAttribute('data-gbev-k'));
      b.classList.toggle('ya', ya);
      b.textContent = ya ? '✓ Evidencia cargada · sumar otra' : '📷 Cargar evidencia';
    });
  }

  function abrir(meta) {
    if (!CFG) { aviso('Esperá un segundo y probá de nuevo.'); return; }
    montar();
    META = meta; FOTOS = [];
    document.getElementById('gbevAcc').innerHTML = '<b>' + esc(meta.titulo || 'Acción') + '</b><small>' + esc(TIPO[meta.t] || '') + (meta.prov ? ' · ' + esc(meta.prov) : '') + '</small>';
    var f = document.getElementById('gbevFecha'); f.max = hoy(); f.value = meta.fecha ? String(meta.fecha).slice(0, 10) : '';
    document.getElementById('gbevCom').value = '';
    document.getElementById('gbevMsg').textContent = '';
    pintarFotos();
    document.getElementById('gbevOv').hidden = false;
  }
  function cerrar() { var o = document.getElementById('gbevOv'); if (o) o.hidden = true; META = null; FOTOS = []; }

  // Las fotos se achican en el celular (lado mayor 1400 px, JPEG) para que suban rápido.
  function comprimir(file) {
    return new Promise(function (ok, ko) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        var q = 0.82, d = c.toDataURL('image/jpeg', q);
        while (d.length > 1200000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
        ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('No se pudo leer esa foto.')); };
      img.src = url;
    });
  }
  async function sumarFotos(files) {
    var lista = Array.prototype.slice.call(files || []);
    for (var i = 0; i < lista.length && FOTOS.length < MAX_FOTOS; i++) {
      try { FOTOS.push(await comprimir(lista[i])); } catch (e) { document.getElementById('gbevMsg').textContent = e.message; }
    }
    if (lista.length && FOTOS.length >= MAX_FOTOS) document.getElementById('gbevMsg').textContent = FOTOS.length === MAX_FOTOS ? '' : 'Hasta 3 fotos.';
    pintarFotos();
  }
  function pintarFotos() {
    var box = document.getElementById('gbevFotos');
    box.innerHTML = FOTOS.map(function (d, i) { return '<div class="gbev-f"><img src="' + d + '" alt="Foto ' + (i + 1) + '"><button type="button" data-q="' + i + '" aria-label="Quitar foto">✕</button></div>'; }).join('');
    box.querySelectorAll('button[data-q]').forEach(function (b) { b.onclick = function () { FOTOS.splice(+b.getAttribute('data-q'), 1); pintarFotos(); }; });
    document.getElementById('gbevAdd').style.display = FOTOS.length >= MAX_FOTOS ? 'none' : 'flex';
  }

  async function enviar() {
    var msg = document.getElementById('gbevMsg'), btn = document.getElementById('gbevOk');
    if (!META) return;
    if (!FOTOS.length) { msg.textContent = 'Sumá al menos una foto.'; return; }
    btn.disabled = true; var txt = btn.textContent; btn.textContent = 'Enviando…'; msg.textContent = '';
    try {
      var tok = await CFG.token();
      if (!tok) throw new Error('Tu sesión del Portal venció: volvé a entrar y probá de nuevo.');
      var r = await fetch(FN, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'cargar', tipo: META.t, accion_id: META.id, cliente_id: CFG.cliente.id, fotos: FOTOS,
          comentario: document.getElementById('gbevCom').value.trim() || null, fecha_cierre: document.getElementById('gbevFecha').value || null }) });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar la evidencia.');
      var k = clave(META.t, META.id);
      YA.set(k, (YA.get(k) || []).concat([{ created_at: new Date().toISOString() }]));
      cerrar(); repintar(); pintarPendientes();
      aviso('📷 Evidencia enviada: le llegó a Trade Marketing' + (d.proveedor ? ' y a ' + d.proveedor : '') + '.', 'success');
    } catch (e) { msg.textContent = e.message || String(e); }
    finally { btn.disabled = false; btn.textContent = txt; }
  }

  // ── Evidencias pendientes (acciones cerradas en visitas anteriores) ────────
  var PEND = [];
  async function pendientes(el) {
    ELPEND = el || ELPEND;
    if (!ELPEND || !CFG || !CFG.sb) return;
    try {
      var res = await CFG.sb.from('visitas').select('fecha,carrito,progreso').eq('cliente_id', CFG.cliente.id).order('fecha', { ascending: false }).limit(15);
      var vistos = new Map();
      (res.data || []).forEach(function (v) {
        var cart = Array.isArray(v.carrito) ? v.carrito : ((v.progreso && v.progreso._carrito) || []);
        cart.forEach(function (c) {
          // Solo las que pedían evidencia cuando se cerraron (origen.ev).
          if (!c || !c.origen || !c.origen.ev || !c.origen.t || !c.origen.id || !CIERRAN.test(c.estado || '')) return;
          var k = clave(c.origen.t, c.origen.id);
          if (!vistos.has(k)) vistos.set(k, { t: c.origen.t, id: c.origen.id, req: true, titulo: c.nombre, fecha: String(v.fecha || '').slice(0, 10) });
        });
      });
      PEND = Array.from(vistos.values());
    } catch (e) { PEND = []; }
    pintarPendientes();
  }
  function pintarPendientes() {
    if (!ELPEND) return;
    var faltan = PEND.filter(function (it) {
      return !(YA.get(clave(it.t, it.id)) || []).some(function (e) { return String(e.created_at || '').slice(0, 10) >= it.fecha; });
    });
    ELPEND.innerHTML = !faltan.length ? '' :
      '<div class="gbev-pend"><div class="gbev-pend-t">📷 Evidencias pendientes</div>' +
      '<div class="gbev-pend-s">Acciones que se cerraron con este cliente en visitas anteriores. Si ya llegó el pedido, cargá las fotos.</div>' +
      faltan.map(function (it) {
        return '<div class="gbev-pend-it"><div><b>' + esc(it.titulo || 'Acción') + '</b><small>' + esc(TIPO[it.t] || '') + ' · cerrada el ' + fCorta(it.fecha) + '</small></div>' + boton(it) + '</div>';
      }).join('') + '</div>';
  }

  async function init(cfg) {
    CFG = cfg || {};
    if (!CFG.cliente || !CFG.cliente.id) return;
    try {
      var tok = CFG.token ? await CFG.token() : null;
      if (tok) {
        var r = await fetch(FN + '?vista=cliente&cliente_id=' + encodeURIComponent(CFG.cliente.id), { headers: { Authorization: 'Bearer ' + tok } });
        var d = r.ok ? await r.json() : {};
        YA = new Map();
        (d.evidencias || []).forEach(function (e) { var k = clave(e.tipo, e.accion_id); YA.set(k, (YA.get(k) || []).concat([e])); });
      }
    } catch (e) {}
    repintar();
  }

  window.GBEvid = { init: init, boton: boton, pendientes: pendientes, abrir: abrir };
})();
