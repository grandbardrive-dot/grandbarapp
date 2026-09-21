// GrandBar Hub · Botón flotante "Minuta IA" para TODOS los paneles.
// Graba/sube el audio de una reunión → IA arma temas/pendientes/notas →
// se guarda como "minuta suelta" a nombre del usuario logueado.
// Solo aparece si hay sesión del Hub (la transcripción IA la necesita).
(function () {
  if (window.__minutaFab) return; window.__minutaFab = true;
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  var MAN = { url: 'https://fzaxwuuodseyyinveknn.supabase.co', key: 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk' };
  var hub, man, USER = null, TRANSCRIPT = '';

  function load(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  async function deps() {
    if (!window.supabase) await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    if (!window.mountMinutaIA) await load('/assets/minuta-ia.js');
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var lines = function (v) { return String(v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };

  async function init() {
    try {
      await deps();
      hub = supabase.createClient(HUB.url, HUB.key);
      var s = await hub.auth.getSession();
      if (!s.data.session) return;                     // sin sesión del Hub → sin botón
      var uid = s.data.session.user.id;
      var p = await hub.from('usuarios').select('nombre').eq('id', uid).maybeSingle();
      USER = { id: uid, nombre: (p.data && p.data.nombre) || s.data.session.user.email };
      man = supabase.createClient(MAN.url, MAN.key, { auth: { persistSession: false } });
      pintarBoton();
    } catch (e) { /* si algo falla, no rompe el panel */ }
  }

  function pintarBoton() {
    if (document.getElementById('mfab-btn')) return;
    var b = document.createElement('button');
    b.id = 'mfab-btn';
    b.title = 'Minuta con IA';
    b.innerHTML = '🎙️';
    b.setAttribute('style', 'position:fixed;right:18px;bottom:18px;z-index:99998;width:54px;height:54px;border-radius:50%;border:0;background:#6b5bd0;color:#fff;font-size:23px;cursor:pointer;box-shadow:0 8px 22px rgba(107,91,208,.45);display:flex;align-items:center;justify-content:center');
    b.onclick = abrir;
    document.body.appendChild(b);
  }

  function overlay() {
    var ov = document.getElementById('mfab-ov');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'mfab-ov';
    ov.setAttribute('style', 'display:none;position:fixed;inset:0;background:rgba(13,34,48,.55);z-index:99999;align-items:flex-end;justify-content:center');
    ov.innerHTML =
      '<div id="mfab-sheet" style="background:#fff;width:100%;max-width:560px;max-height:90vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px;font-family:Inter,system-ui,sans-serif;color:#1b2a32">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><b style="font-size:18px;flex:1">🎙️ Minuta con IA</b>'
      + '<button id="mfab-mis" style="background:#eef3f7;color:#2c5a80;border:1px solid #cfe0ec;border-radius:9px;padding:8px 12px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer">Mis minutas</button>'
      + '<button id="mfab-x" style="background:none;border:0;font-size:24px;line-height:1;color:#6d7d85;cursor:pointer">×</button></div>'
      + '<div id="mfab-body"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target.id === 'mfab-ov') cerrar(); });
    ov.querySelector('#mfab-x').onclick = cerrar;
    ov.querySelector('#mfab-mis').onclick = verMisMinutas;
    return ov;
  }
  function cerrar() { var ov = document.getElementById('mfab-ov'); if (ov) ov.style.display = 'none'; }

  var L = 'display:block;font-size:12px;font-weight:700;color:#5a6870;margin:12px 0 5px';
  var I = 'width:100%;border:1.5px solid #e0d8c8;border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;box-sizing:border-box;outline:none';
  var TA = I + ';min-height:66px;resize:vertical';

  function abrir() {
    var ov = overlay(); TRANSCRIPT = '';
    ov.querySelector('#mfab-body').innerHTML =
      '<div id="mfab-mia"></div>'
      + '<label style="' + L + '">Título</label><input id="mfab-tit" style="' + I + '" placeholder="Ej: Reunión con Peñaflor">'
      + '<label style="' + L + '">Temas tratados <span style="font-weight:400;color:#9a9187">(uno por línea)</span></label><textarea id="mfab-temas" style="' + TA + '"></textarea>'
      + '<label style="' + L + '">Pendientes / tareas <span style="font-weight:400;color:#9a9187">(uno por línea)</span></label><textarea id="mfab-pend" style="' + TA + '"></textarea>'
      + '<label style="' + L + '">Notas</label><textarea id="mfab-notas" style="' + TA + '"></textarea>'
      + '<button id="mfab-save" style="width:100%;margin-top:16px;border:0;border-radius:11px;background:#2f8f6e;color:#fff;font:inherit;font-weight:800;font-size:15px;padding:13px;cursor:pointer">✔ Guardar minuta</button>'
      + '<div id="mfab-msg" style="font-size:13px;font-weight:600;margin-top:10px;text-align:center"></div>';
    ov.style.display = 'flex';
    if (window.mountMinutaIA) window.mountMinutaIA(document.getElementById('mfab-mia'), function (m, transcript) {
      if (m.temas) document.getElementById('mfab-temas').value = (m.temas || []).join('\n');
      if (m.pendientes) document.getElementById('mfab-pend').value = (m.pendientes || []).join('\n');
      if (m.notas != null) document.getElementById('mfab-notas').value = m.notas || '';
      if (transcript) TRANSCRIPT = transcript;
    });
    document.getElementById('mfab-save').onclick = guardar;
  }

  async function guardar() {
    var btn = document.getElementById('mfab-save'), msg = document.getElementById('mfab-msg');
    var temas = lines(document.getElementById('mfab-temas').value);
    var pend = lines(document.getElementById('mfab-pend').value);
    var notas = document.getElementById('mfab-notas').value.trim();
    if (!temas.length && !pend.length && !notas) { msg.style.color = '#c0603e'; msg.textContent = 'Cargá al menos un tema, pendiente o nota.'; return; }
    btn.disabled = true; msg.style.color = '#6d7d85'; msg.textContent = 'Guardando…';
    try {
      var fila = { usuario_id: USER.id, usuario_nombre: USER.nombre, titulo: document.getElementById('mfab-tit').value.trim() || 'Minuta', temas: temas, pendientes: pend, notas: notas || null, transcript: TRANSCRIPT || null };
      var r = await man.from('minutas_sueltas').insert(fila);
      if (r.error) throw r.error;
      msg.style.color = '#2f8f6e'; msg.textContent = '✅ Minuta guardada.';
      setTimeout(cerrar, 900);
    } catch (e) { msg.style.color = '#c0603e'; msg.textContent = 'No se pudo guardar: ' + (e.message || e); btn.disabled = false; }
  }

  async function verMisMinutas() {
    var ov = overlay(); ov.style.display = 'flex';
    var body = ov.querySelector('#mfab-body');
    body.innerHTML = '<div style="text-align:center;color:#6d7d85;padding:20px">Cargando…</div>';
    try {
      var r = await man.from('minutas_sueltas').select('*').eq('usuario_id', USER.id).order('created_at', { ascending: false }).limit(60);
      var arr = r.data || [];
      var head = '<button id="mfab-nueva" style="width:100%;border:1.5px dashed #cfe0ec;background:#f6fafd;color:#2c5a80;border-radius:11px;padding:12px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:12px">＋ Nueva minuta</button>';
      if (!arr.length) { body.innerHTML = head + '<div style="text-align:center;color:#6d7d85;padding:14px">Todavía no guardaste minutas.</div>'; document.getElementById('mfab-nueva').onclick = abrir; return; }
      body.innerHTML = head + arr.map(function (x) {
        var f = new Date(x.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
        var nt = (x.temas || []).length, np = (x.pendientes || []).length;
        return '<div class="mfab-item" data-id="' + x.id + '" style="border:1px solid #e7ded0;border-radius:12px;padding:12px 14px;margin-bottom:9px;cursor:pointer">'
          + '<div style="font-weight:700;font-size:14px">' + esc(x.titulo || 'Minuta') + '</div>'
          + '<div style="font-size:12px;color:#6d7d85;margin-top:2px">' + f + ' · ' + nt + ' temas · ' + np + ' pendientes</div></div>';
      }).join('');
      document.getElementById('mfab-nueva').onclick = abrir;
      Array.prototype.forEach.call(body.querySelectorAll('.mfab-item'), function (el) {
        el.onclick = function () { var x = arr.find(function (a) { return a.id === el.dataset.id; }); if (x) verMinuta(x); };
      });
    } catch (e) { body.innerHTML = '<div style="text-align:center;color:#c0603e;padding:20px">No se pudieron cargar tus minutas.</div>'; }
  }

  function verMinuta(x) {
    var body = document.getElementById('mfab-body');
    var f = new Date(x.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    var lista = function (arr) { return (arr && arr.length) ? '<ul style="margin:6px 0 0;padding-left:18px">' + arr.map(function (t) { return '<li style="margin-bottom:3px">' + esc(t) + '</li>'; }).join('') + '</ul>' : '<div style="color:#9a9187;font-size:13px">—</div>'; };
    body.innerHTML =
      '<button id="mfab-volver" style="background:none;border:0;color:#2c5a80;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer;padding:0;margin-bottom:10px">‹ Volver a mis minutas</button>'
      + '<div style="font-size:18px;font-weight:800">' + esc(x.titulo || 'Minuta') + '</div>'
      + '<div style="font-size:12.5px;color:#6d7d85;margin-bottom:12px">' + f + ' · ' + esc(x.usuario_nombre || '') + '</div>'
      + '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6d7d85;margin-top:10px">Temas</div>' + lista(x.temas)
      + '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6d7d85;margin-top:14px">Pendientes</div>' + lista(x.pendientes)
      + (x.notas ? '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6d7d85;margin-top:14px">Notas</div><div style="font-size:13.5px;margin-top:6px;white-space:pre-wrap">' + esc(x.notas) + '</div>' : '');
    document.getElementById('mfab-volver').onclick = verMisMinutas;
  }

  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
