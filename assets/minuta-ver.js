// GrandBar Hub · Visor de minuta (HTML lindo) + Resumen con IA.
//   verMinutaHTML(reunion)         → vista de solo lectura de la minuta.
//   verResumen(reunion, saveFn)    → resumen IA (genera y cachea; saveFn(html) persiste).
(function () {
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  async function hubToken() { try { var c = supabase.createClient(HUB.url, HUB.key); var r = await c.auth.getSession(); return r.data.session && r.data.session.access_token; } catch (e) { return null; } }

  function modalEl() {
    var ov = document.getElementById('mvOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'mvOverlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(13,34,48,.55);z-index:70;align-items:center;justify-content:center;padding:14px';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:620px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)">'
      + '<div style="display:flex;align-items:center;gap:10px;padding:16px 18px 10px;border-bottom:1px solid #eee7d8"><b id="mvTit" style="font-size:16px;flex:1"></b><button id="mvX" style="background:none;border:0;font-size:22px;cursor:pointer;color:#6d7d85">×</button></div>'
      + '<div id="mvBody" style="padding:16px 18px;overflow:auto;font-size:14px;color:#1b2a32;line-height:1.5"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target.id === 'mvOverlay') cerrar(); });
    ov.querySelector('#mvX').onclick = cerrar;
    return ov;
  }
  function abrir(titulo, html) { var ov = modalEl(); ov.querySelector('#mvTit').textContent = titulo; ov.querySelector('#mvBody').innerHTML = html; ov.style.display = 'flex'; }
  function cerrar() { var ov = document.getElementById('mvOverlay'); if (ov) ov.style.display = 'none'; }
  window.cerrarMinutaVer = cerrar;

  window.verMinutaHTML = function (reunion) {
    var m = (reunion && reunion.minuta) || {};
    var f = reunion.fecha ? new Date(reunion.fecha + 'T00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    var h = '<div style="color:#6d7d85;font-size:12.5px;margin-bottom:14px">' + esc(f) + (reunion.hora ? ' · ' + esc(String(reunion.hora).slice(0, 5)) + ' hs' : '') + (reunion.destinatario ? ' · ' + esc(reunion.destinatario) : '') + '</div>';
    if (m.temas && m.temas.length) h += '<h3 style="font-size:14px;margin:0 0 6px;color:#1f447f">📝 Temas que se hablaron</h3><ul style="margin:0 0 16px;padding-left:20px">' + m.temas.map(function (t) { return '<li style="margin:3px 0">' + esc(t) + '</li>'; }).join('') + '</ul>';
    if (m.pendientes && m.pendientes.length) h += '<h3 style="font-size:14px;margin:0 0 6px;color:#c0912f">⏭️ Pendientes para la próxima</h3><ul style="margin:0 0 16px;padding-left:20px">' + m.pendientes.map(function (t) { return '<li style="margin:3px 0">' + esc(t) + '</li>'; }).join('') + '</ul>';
    if (m.notas) h += '<h3 style="font-size:14px;margin:0 0 6px">🗒️ Notas / acuerdos</h3><p style="margin:0 0 16px;white-space:pre-wrap">' + esc(m.notas) + '</p>';
    if (m.transcript) h += '<details style="margin-top:10px;border:1px solid #e7ded0;border-radius:10px;padding:10px 12px"><summary style="cursor:pointer;font-weight:700;font-size:13px;color:#1f447f">📄 Transcripción completa</summary><div style="white-space:pre-wrap;font-size:13px;color:#3a4650;margin-top:10px;max-height:340px;overflow:auto">' + esc(m.transcript) + '</div></details>';
    if (!m.temas && !m.pendientes && !m.notas && !m.transcript) h += '<div style="color:#6d7d85">Esta reunión todavía no tiene minuta cargada.</div>';
    abrir('Minuta · ' + (reunion.titulo || ''), h);
  };

  window.verResumen = async function (reunion, saveFn) {
    var m = (reunion && reunion.minuta) || {};
    if (m.resumen_html) { abrir('Resumen · ' + (reunion.titulo || ''), m.resumen_html); return; }
    if (!m.transcript && !(m.temas && m.temas.length)) { abrir('Resumen', '<div style="color:#6d7d85">Para el resumen necesito el contenido de la reunión. Hacé la minuta (grabá o escribí los temas) primero.</div>'); return; }
    abrir('Resumen · ' + (reunion.titulo || ''), '<div style="text-align:center;color:#6d7d85;padding:26px">✨ Armando el resumen con IA…<br><span style="font-size:12px">(unos segundos)</span></div>');
    try {
      var token = await hubToken();
      var r = await fetch('/.netlify/functions/transcribir-minuta', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'resumen', titulo: reunion.titulo, transcript: m.transcript || '', temas: m.temas || [], pendientes: m.pendientes || [] }) });
      var d = await r.json();
      if (!r.ok || !d.ok || !d.html) { abrir('Resumen', '<div style="color:#c0603e">No se pudo generar el resumen: ' + esc((d && d.error) || ('error ' + r.status)) + '</div>'); return; }
      m.resumen_html = d.html;
      abrir('Resumen · ' + (reunion.titulo || ''), d.html);
      if (typeof saveFn === 'function') { try { saveFn(d.html); } catch (e) {} }
    } catch (e) { abrir('Resumen', '<div style="color:#c0603e">Error: ' + esc(e.message || e) + '</div>'); }
  };
})();
