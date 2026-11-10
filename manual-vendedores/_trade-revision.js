// ============================================================
//  GrandBar · Campañas y planes de Trade Marketing (10/11/2026)
//  Juan Pablo Sepúlveda (rol torneo) usa las mismas pantallas que Luciana en
//  "Campañas y planes" (admin-campanias, admin-nueva-campania, admin-nuevo-plan),
//  dentro de su panel (trade-campanias.html, en un marco). Lo que carga se guarda
//  sin publicar y le llega a Luciana, que lo edita, le hace observaciones o lo
//  aprueba: recién ahí lo ven los vendedores.
//  Este script va en esas tres pantallas, después de supabase-js y antes del
//  script de cada una. Expone window.GBRevision:
//    await GBRevision.listo          → { esTrade, esComercial, uid, nombre }
//    GBRevision.camposTrade('campania'|'plan')  → lo que se agrega al guardar en modo Trade
//    GBRevision.editable(fila)       → Juan Pablo puede tocar lo suyo sin aprobar
//    GBRevision.api({ accion, tipo, id, ... })  → función trade-campanias
//    GBRevision.bloque(fila) / GBRevision.revisar(cont, fila, tipo, listo)  → pedazos de pantalla
//  Estado en las columnas revision* (revision-trade-setup.sql).
// ============================================================
(function () {
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  var COMERCIAL = ['compras', 'desarrollo', 'diseno', 'marketing'];
  var embebida = window.top !== window.self;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fHora = function (iso) { return iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; };
  var R = window.GBRevision = { esTrade: false, esComercial: false, uid: null, nombre: '', token: null, embebida: embebida };
  R.ABIERTAS = ['pendiente', 'observada'];
  R.ESTADO = { pendiente: 'Para aprobar', observada: 'Con observaciones', aprobada: 'Aprobada', rechazada: 'No aprobada' };
  var HIST = { envio: 'la mandó a revisar', edito: 'la editó', reenvio: 'la corrigió y la reenvió', observo: 'hizo observaciones', rechazo: 'no la aprobó', aprobo: 'la aprobó y la publicó' };

  var css = '.gbr{background:#FBF6E6;border:1px solid #ecdcb2;border-left:4px solid #C0912F;border-radius:12px;padding:12px 14px;margin:0 0 16px;font-size:13.5px;line-height:1.45;color:#1F1B16}'
    + '.gbr-h{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-weight:800;font-size:14px}'
    + '.gbr-e{font-size:11.5px;font-weight:800;padding:2px 9px;border-radius:20px;background:#fff;color:#8a6412;border:1px solid #ecdcb2}'
    + '.gbr-e.observada{color:#1F447F;border-color:rgba(31,68,127,.25)} .gbr-e.aprobada{color:#2D6A4F;border-color:#cfe3d8} .gbr-e.rechazada{color:#C0392B;border-color:#f0c9c2}'
    + '.gbr-t{margin-top:8px;white-space:pre-wrap} .gbr-t b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a7a2a;margin-bottom:2px}'
    + '.gbr-o{margin-top:8px;background:#fff;border-radius:9px;padding:8px 10px;white-space:pre-wrap} .gbr-o b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#1F447F;margin-bottom:2px}'
    + '.gbr details{margin-top:8px;font-size:12.5px;color:#7a7268} .gbr summary{cursor:pointer;font-weight:600} .gbr ol{margin:6px 0 0;padding-left:18px}'
    + '.gbr-rev{margin-top:14px;border-top:1px solid rgba(31,68,127,.12);padding-top:12px}'
    + '.gbr-rev textarea,.gbr-nota{width:100%;box-sizing:border-box;min-height:70px;border:1.5px solid rgba(31,68,127,.18);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;resize:vertical}'
    + '.gbr-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}'
    + '.gbr-b{border:1.5px solid rgba(31,68,127,.18);background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#1F447F}'
    + '.gbr-b.ok{background:#2D6A4F;border-color:#2D6A4F;color:#fff} .gbr-b.no{color:#C0392B;margin-left:auto} .gbr-b:disabled{opacity:.55;cursor:default}'
    + '.gbr-msg{font-size:13px;font-weight:700;margin-top:6px;min-height:16px}'
    + '.gbr-aviso{background:#fff;border:1px solid rgba(31,68,127,.14);border-left:4px solid #C0912F;border-radius:12px;padding:12px 15px;margin:0 0 16px;font-size:13.5px;line-height:1.5;display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
    + '.gbr-aviso a{color:#1F447F;font-weight:700;text-decoration:underline;cursor:pointer}';
  // En el marco del panel de Juan Pablo, sin el menú ni la barra de Luciana.
  if (embebida) css += 'aside.sidebar,header.topbar,#gb-mtop{display:none!important} .layout{grid-template-columns:1fr!important} body.gb-has-mtop{padding-top:0!important}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  R.listo = (async function () {
    try {
      var c = window.supabase.createClient(HUB.url, HUB.key);
      var s = (await c.auth.getSession()).data.session;
      if (!s) return R;
      R.uid = s.user.id; R.token = s.access_token;
      var q = await c.from('usuarios').select('rol,nombre').eq('id', s.user.id).maybeSingle();
      var rol = String((q.data && q.data.rol) || '').toLowerCase();
      R.nombre = (q.data && q.data.nombre) || '';
      R.esTrade = rol === 'torneo';
      R.esComercial = COMERCIAL.indexOf(rol) >= 0;
      // Juan Pablo entra siempre por su panel: si abre la pantalla suelta, se la muestra adentro.
      if (R.esTrade && !embebida) location.replace('/trade-campanias.html?ir=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
    } catch (e) {}
    return R;
  })();

  R.api = async function (body) {
    await R.listo;
    var r = await fetch('/.netlify/functions/trade-campanias', { method: 'POST', headers: { Authorization: 'Bearer ' + R.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || 'error ' + r.status);
    return d;
  };
  // Lo que se agrega al guardar en modo Trade: queda sin publicar y a su nombre.
  R.camposTrade = function (tipo) {
    var o = { revision_autor: R.uid, revision_autor_nombre: R.nombre };
    o[tipo === 'plan' ? 'activo' : 'activa'] = false;
    return o;
  };
  R.esPropuesta = function (f) { return !!(f && (f.revision || f.revision_autor)); };
  R.abierta = function (f) { return !!f && R.ABIERTAS.indexOf(f.revision) >= 0; };
  R.editable = function (f) { return !!f && f.revision_autor === R.uid && f.revision !== 'aprobada'; };

  // Quién la propuso, su nota, lo que le marcó Luciana y el historial.
  R.bloque = function (f) {
    if (!R.esPropuesta(f)) return '';
    var est = f.revision || 'borrador';
    var hist = (f.revision_historial || []).map(function (h) { return '<li>' + esc(fHora(h.fecha)) + ' · ' + esc(h.quien) + ' ' + esc(HIST[h.que] || h.que) + '</li>'; }).join('');
    return '<div class="gbr"><div class="gbr-h">Propuesta de ' + esc(f.revision_autor_nombre || 'Trade Marketing')
      + '<span class="gbr-e ' + esc(est) + '">' + esc(R.ESTADO[est] || 'Sin mandar a revisar') + '</span></div>'
      + (f.revision_nota ? '<div class="gbr-t"><b>Nota para Luciana</b>' + esc(f.revision_nota) + '</div>' : '')
      + (f.revision_obs && f.revision !== 'aprobada' ? '<div class="gbr-o"><b>' + (f.revision === 'pendiente' ? 'Lo que había marcado ' : '') + esc(f.revision_por || 'Luciana') + ' · ' + esc(fHora(f.revision_at)) + '</b>' + esc(f.revision_obs) + '</div>' : '')
      + (f.revision === 'aprobada' ? '<div class="gbr-t">La aprobó ' + esc(f.revision_por || 'Luciana') + ' el ' + esc(fHora(f.revision_at)) + '. Ya la ven los vendedores.</div>' : '')
      + (hist ? '<details><summary>Historial</summary><ol>' + hist + '</ol></details>' : '')
      + '</div>';
  };

  // Para Luciana: observaciones, aprobar o no aprobar. listo(fila) se llama al terminar.
  R.revisar = function (cont, f, tipo, listo) {
    if (!R.esComercial || !R.abierta(f) || !cont) return;
    var quien = String(f.revision_autor_nombre || 'Trade Marketing').split(' ')[0];
    var box = document.createElement('div'); box.className = 'gbr-rev';
    box.innerHTML = '<textarea maxlength="2000" placeholder="Observaciones para ' + esc(quien) + ' (qué tiene que cambiar)"></textarea>'
      + '<div class="gbr-acts"><button type="button" class="gbr-b ok" data-a="aprobar">✓ Aprobar y publicar</button>'
      + '<button type="button" class="gbr-b" data-a="observar">Enviar observaciones</button>'
      + '<button type="button" class="gbr-b no" data-a="rechazar">No aprobar</button></div><div class="gbr-msg"></div>';
    cont.appendChild(box);
    var ta = box.querySelector('textarea'), msg = box.querySelector('.gbr-msg');
    box.querySelectorAll('[data-a]').forEach(function (btn) {
      btn.onclick = async function () {
        var a = btn.getAttribute('data-a'), obs = ta.value.trim();
        msg.style.color = '#C0392B'; msg.textContent = '';
        if (a === 'observar' && !obs) { msg.textContent = 'Escribí las observaciones.'; ta.focus(); return; }
        if (a === 'aprobar' && !confirm('¿Aprobarla? Se publica en el manual y la ven los vendedores.')) return;
        if (a === 'rechazar' && !confirm('¿No aprobarla? Le avisa a ' + quien + (obs ? ' con tus observaciones.' : '. Si querés contarle por qué, escribilo antes en observaciones.'))) return;
        box.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        try {
          var d = await R.api({ accion: a, tipo: tipo, id: f.id, observacion: obs });
          msg.style.color = '#2D6A4F'; msg.textContent = a === 'aprobar' ? '✓ Aprobada: ya la ven los vendedores.' : (a === 'observar' ? '✓ Observaciones enviadas.' : '✓ Listo.');
          if (listo) listo(d.fila);
        } catch (e) { msg.textContent = e.message; box.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); }
      };
    });
  };
})();
