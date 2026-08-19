// ============================================================
//  GrandBar Hub · notif.js  (campanita para vendedores y supervisores)
//   Botón flotante arriba a la derecha con las notificaciones del usuario.
//   Requiere supabase UMD cargado antes. Sólo actúa si hay sesión.
// ============================================================
(function () {
  if (!window.supabase) return;
  var HUB = { url: "https://xqhyemccbwmzxqzkrtwa.supabase.co", key: "sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc" };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var TOKEN = null, items = [];

  var c = supabase.createClient(HUB.url, HUB.key);
  c.auth.getSession().then(function (r) {
    var s = r.data.session; if (!s) return;
    TOKEN = s.access_token; build(); load(); setInterval(load, 60000);
  });

  var bell, dot, panel;
  function build() {
    bell = document.createElement('button');
    bell.setAttribute('aria-label', 'Notificaciones');
    bell.style.cssText = 'position:fixed;top:10px;right:12px;z-index:9000;width:42px;height:42px;border-radius:50%;border:0;background:#0d2230;color:#fff;box-shadow:0 6px 18px -6px rgba(0,0,0,.5);cursor:pointer;display:grid;place-items:center';
    bell.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
    dot = document.createElement('span');
    dot.style.cssText = 'position:absolute;top:-3px;right:-3px;background:#c0603e;color:#fff;font-size:10px;font-weight:800;border-radius:50%;min-width:17px;height:17px;display:none;place-items:center;padding:0 3px';
    bell.appendChild(dot);
    document.body.appendChild(bell);

    panel = document.createElement('div');
    panel.style.cssText = 'display:none;position:fixed;top:58px;right:12px;width:min(340px,92vw);max-height:72vh;overflow:auto;background:#fff;border:1px solid #e7ded0;border-radius:14px;box-shadow:0 18px 44px -12px rgba(0,0,0,.32);z-index:9000;font-family:Inter,system-ui,sans-serif';
    panel.innerHTML = '<div style="padding:12px 15px;border-bottom:1px solid #e7ded0;font-weight:800;font-size:14px;position:sticky;top:0;background:#fff;color:#1b2a32">🔔 Notificaciones</div><div id="gbNbody"><div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">Cargando…</div></div>';
    document.body.appendChild(panel);

    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      var abierto = panel.style.display === 'block';
      panel.style.display = abierto ? 'none' : 'block';
      if (!abierto) { render(); var top = items[0] ? String(items[0].ts || '') : new Date().toISOString(); localStorage.setItem('gb_notif_seen', top); badge(); }
    });
    document.addEventListener('click', function (e) { if (panel.style.display === 'block' && !panel.contains(e.target) && !bell.contains(e.target)) panel.style.display = 'none'; });
  }

  function render() {
    var seen = localStorage.getItem('gb_notif_seen') || '';
    var body = panel.querySelector('#gbNbody');
    body.innerHTML = items.length ? items.map(function (x) {
      var nueva = String(x.ts || '') > seen;
      var f = x.ts ? new Date(x.ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      return '<a href="' + esc(x.link || '#') + '" style="display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid #eee7d8;align-items:flex-start;color:#1b2a32;text-decoration:none;' + (nueva ? 'background:#fbf7ee' : '') + '">'
        + '<span style="font-size:16px;flex:none">' + esc(x.icon || '•') + '</span><div><div style="font-weight:700;font-size:12.8px">' + esc(x.titulo || '') + '</div><div style="font-size:11.5px;color:#6d7d85;margin-top:2px">' + esc(x.detalle || '') + '</div><div style="font-size:10.5px;color:#6d7d85;margin-top:3px">' + f + '</div></div></a>';
    }).join('') : '<div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">No tenés notificaciones.</div>';
  }
  function badge() {
    var seen = localStorage.getItem('gb_notif_seen') || '';
    var n = items.filter(function (x) { return String(x.ts || '') > seen; }).length;
    if (n > 0) { dot.textContent = n > 9 ? '9+' : n; dot.style.display = 'grid'; } else { dot.style.display = 'none'; }
  }
  function load() {
    fetch('/.netlify/functions/notificaciones', { headers: { Authorization: 'Bearer ' + TOKEN } })
      .then(function (r) { return r.ok ? r.json() : { notificaciones: [] }; })
      .then(function (d) { items = d.notificaciones || []; render(); badge(); });
  }
})();
