// ============================================================
//  GrandBar Hub · dir-notif.js  (compartido en TODO el panel de Dirección)
//   - Campanita: notificaciones reales (misma en todas las secciones)
//   - Lupa / Ctrl+K: búsqueda global por cualquier palabra
//  Requiere: supabase UMD cargado antes. Sólo actúa si hay sesión.
// ============================================================
(function () {
  if (!window.supabase) return;
  var HUB = { url: "https://xqhyemccbwmzxqzkrtwa.supabase.co", key: "sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc" };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var TOKEN = null;

  var c = supabase.createClient(HUB.url, HUB.key);
  c.auth.getSession().then(function (r) {
    var s = r.data.session; if (!s) return;
    TOKEN = s.access_token;
    initBell(); initSearch();
  });

  function findBtn(rx) {
    var all = document.querySelectorAll('.ic-btn'); for (var i = 0; i < all.length; i++) { if (rx.test(all[i].innerHTML)) return all[i]; } return null;
  }

  // ---------------- CAMPANITA ----------------
  function initBell() {
    var bell = findBtn(/M6 8a6 6/); if (!bell) return;
    bell.style.position = 'relative';
    var dot = bell.querySelector('.dot'); if (!dot) { dot = document.createElement('span'); dot.className = 'dot'; bell.appendChild(dot); }
    dot.style.display = 'none';

    var panel = document.createElement('div');
    panel.id = 'gbNotifPanel';
    panel.style.cssText = 'display:none;position:fixed;top:64px;right:24px;width:344px;max-height:72vh;overflow:auto;background:#fff;border:1px solid #e7ded0;border-radius:14px;box-shadow:0 18px 44px -12px rgba(0,0,0,.32);z-index:9000;font-family:Inter,system-ui,sans-serif';
    panel.innerHTML = '<div style="padding:12px 15px;border-bottom:1px solid #e7ded0;font-weight:800;font-size:14px;position:sticky;top:0;background:#fff;color:#1b2a32">🔔 Notificaciones</div><div id="gbNotifBody"><div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">Cargando…</div></div>';
    document.body.appendChild(panel);

    var items = [];
    function render() {
      var seen = localStorage.getItem('gb_notif_seen') || '';
      var body = panel.querySelector('#gbNotifBody');
      body.innerHTML = items.length ? items.map(function (x) {
        var nueva = String(x.ts || '') > seen;
        var f = x.ts ? new Date(x.ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
        return '<a href="' + esc(x.link || '#') + '" style="display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid #eee7d8;align-items:flex-start;color:#1b2a32;text-decoration:none;' + (nueva ? 'background:#fbf7ee' : '') + '">'
          + '<span style="font-size:16px;flex:none">' + esc(x.icon || '•') + '</span><div><div style="font-weight:700;font-size:12.8px">' + esc(x.titulo || '') + '</div><div style="font-size:11.5px;color:#6d7d85;margin-top:2px">' + esc(x.detalle || '') + '</div><div style="font-size:10.5px;color:#6d7d85;margin-top:3px">' + f + '</div></div></a>';
      }).join('') : '<div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">No hay novedades.</div>';
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
    load();
    setInterval(load, 60000); // refresca cada minuto

    bell.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var abierto = panel.style.display === 'block';
      panel.style.display = abierto ? 'none' : 'block';
      if (!abierto) {
        render();
        // marcar como visto (baja el contador) pero SIN bloquear reapertura
        var top = items[0] ? String(items[0].ts || '') : new Date().toISOString();
        localStorage.setItem('gb_notif_seen', top);
        badge();
      }
    });
    document.addEventListener('click', function (e) {
      if (panel.style.display === 'block' && !panel.contains(e.target) && !bell.contains(e.target)) panel.style.display = 'none';
    });
  }

  // ---------------- LUPA / BÚSQUEDA GLOBAL ----------------
  function initSearch() {
    var lupa = findBtn(/M21 21l-4-4/);
    var ov = document.createElement('div');
    ov.id = 'gbSearchOv';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(13,34,48,.45);z-index:9500;padding-top:12vh;font-family:Inter,system-ui,sans-serif';
    ov.innerHTML = '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(0,0,0,.5)">'
      + '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #e7ded0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6d7d85" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>'
      + '<input id="gbSearchInput" placeholder="Buscar clientes, vendedores, reportes, secciones…" style="flex:1;border:0;outline:0;font:inherit;font-size:15px;color:#1b2a32;background:none" autocomplete="off">'
      + '<span style="font-size:11px;color:#9db0ba">Esc</span></div>'
      + '<div id="gbSearchResults" style="max-height:56vh;overflow:auto"><div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">Escribí para buscar…</div></div></div>';
    document.body.appendChild(ov);
    var input = ov.querySelector('#gbSearchInput');
    var results = ov.querySelector('#gbSearchResults');
    var lista = [];

    function abrir() { ov.style.display = 'block'; input.value = ''; results.innerHTML = '<div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">Escribí para buscar…</div>'; lista = []; setTimeout(function () { input.focus(); }, 30); }
    function cerrar() { ov.style.display = 'none'; }

    function pinta(arr) {
      lista = arr;
      if (!arr.length) { results.innerHTML = '<div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">Sin resultados</div>'; return; }
      results.innerHTML = arr.map(function (x, i) {
        return '<a href="' + esc(x.link || '#') + '" data-i="' + i + '" style="display:flex;gap:11px;padding:11px 16px;border-bottom:1px solid #eee7d8;align-items:center;color:#1b2a32;text-decoration:none">'
          + '<span style="font-size:17px;flex:none">' + esc(x.icon || '•') + '</span><div style="flex:1"><div style="font-weight:700;font-size:13.5px">' + esc(x.titulo || '') + '</div><div style="font-size:11.5px;color:#6d7d85">' + esc(x.sub || '') + '</div></div>'
          + '<span style="font-size:10px;font-weight:700;color:#a97c22;background:#f7efdc;border-radius:6px;padding:2px 8px">' + esc(x.tipo || '') + '</span></a>';
      }).join('');
    }

    var t = null;
    input && input.addEventListener('input', function () {
      var q = input.value.trim();
      if (t) clearTimeout(t);
      if (q.length < 2) { results.innerHTML = '<div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">Escribí al menos 2 letras…</div>'; lista = []; return; }
      results.innerHTML = '<div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">Buscando…</div>';
      t = setTimeout(function () {
        fetch('/.netlify/functions/buscar?q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + TOKEN } })
          .then(function (r) { return r.ok ? r.json() : { resultados: [] }; })
          .then(function (d) { pinta(d.resultados || []); })
          .catch(function () { results.innerHTML = '<div style="padding:22px;text-align:center;color:#c0603e;font-size:13px">Error de búsqueda</div>'; });
      }, 220);
    });
    input && input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && lista[0]) { location.href = lista[0].link; }
      if (e.key === 'Escape') cerrar();
    });
    ov.addEventListener('click', function (e) { if (e.target.id === 'gbSearchOv') cerrar(); });

    if (lupa) lupa.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); abrir(); });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); abrir(); }
    });
  }
})();
