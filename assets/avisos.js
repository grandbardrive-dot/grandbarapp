// ─── Avisos emergentes para vendedores ───────────────────────────────────────
// Lo carga assets/cuenta-activa.js en todas las pantallas del Portal. Cada aviso
// tiene una fecha límite y una lista de códigos de vendedor; se muestra UNA vez
// por ingreso (por sesión del navegador) mientras esté vigente. Para un aviso
// nuevo alcanza con agregar una entrada en AVISOS.
(function () {
  var AVISOS = [
    {
      // 27/10/2026: sumamos 10 clientes de cada uno a la app de cobranzas (bienvenida + lunes).
      id: 'cobranzas-10-clientes-2610',
      hasta: '2026-10-31',                       // inclusive, hora de Argentina
      vendedores: ['041', '043', '017', '024', '007'],
      icono: '💳',
      titulo: '¡Sumamos 10 de tus clientes a la app de cobranzas!',
      texto: 'Revisá <b>todos los días</b> si tenés pagos por cargar.',
      boton: { texto: 'Ir a Cobranzas', href: '/cobranzas-vendedor.html' },
    },
  ];

  var CLAVE = 'sb-xqhyemccbwmzxqzkrtwa-auth-token';
  var HUB = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
  var ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';

  // Fecha de hoy en Argentina (YYYY-MM-DD): el aviso vale hasta el último minuto del día "hasta".
  var hoy;
  try { hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Mendoza' }); }
  catch (e) { hoy = new Date().toISOString().slice(0, 10); }
  var vigentes = AVISOS.filter(function (a) { return hoy <= a.hasta && !visto(a); });
  if (!vigentes.length) return;              // nada vigente: ni siquiera consulta la base
  // Páginas de paso (login y el ruteador hub.html, que redirige al toque): ahí no.
  if (/^\/(index\.html|hub\.html)?$/i.test(location.pathname)) return;

  function visto(a) { try { return sessionStorage.getItem('gb_aviso_' + a.id) === '1'; } catch (e) { return false; } }
  function marcar(a) { try { sessionStorage.setItem('gb_aviso_' + a.id, '1'); } catch (e) {} }
  var norm = function (c) { return String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, ''); };

  var s;
  try { var v = JSON.parse(localStorage.getItem(CLAVE) || 'null'); s = v && (v.currentSession || v); } catch (e) { s = null; }
  if (!s || !s.user || !s.user.id || !s.access_token) return;   // sin sesión (login): nada

  fetch(HUB + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(s.user.id) + '&select=codigo_vendedor,nombre', {
    headers: { apikey: ANON, Authorization: 'Bearer ' + s.access_token },
  }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
    var u = (rows && rows[0]) || {};
    var cod = norm(u.codigo_vendedor);
    if (!cod) return;
    var a = vigentes.filter(function (x) { return x.vendedores.map(norm).indexOf(cod) > -1; })[0];
    if (!a) return;
    var mostrar = function () { mostrarAviso(a, u.nombre); };
    if (document.body) mostrar(); else document.addEventListener('DOMContentLoaded', mostrar);
  }).catch(function () {});

  function mostrarAviso(a, nombre) {
    if (document.getElementById('gb-aviso')) return;
    var primer = String(nombre || '').trim().split(/\s+/)[0] || '';
    var fondo = document.createElement('div');
    fondo.id = 'gb-aviso';
    fondo.setAttribute('role', 'dialog');
    fondo.setAttribute('aria-modal', 'true');
    fondo.style.cssText = 'position:fixed;inset:0;z-index:2147483100;background:rgba(13,34,56,.55);display:flex;'
      + 'align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif';
    var caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:18px;max-width:420px;width:100%;overflow:hidden;'
      + 'box-shadow:0 24px 60px -12px rgba(0,0,0,.45);text-align:center';
    caja.innerHTML =
      '<div style="background:#0d2238;padding:22px 20px 18px;color:#f5f1e8">'
      + '<div style="font-size:40px;line-height:1">' + a.icono + '</div>'
      + '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c9a13b;font-weight:800;margin-top:10px">'
      + (primer ? 'Hola ' + esc(primer) : 'Novedad') + '</div></div>'
      + '<div style="padding:22px 24px 8px">'
      + '<div style="font-size:19px;font-weight:800;color:#0d2238;line-height:1.3">' + a.titulo + '</div>'
      + '<div style="font-size:15px;color:#4a5a63;margin-top:10px;line-height:1.5">' + a.texto + '</div></div>'
      + '<div style="padding:18px 24px 22px;display:flex;flex-direction:column;gap:9px">'
      + (a.boton ? '<a id="gb-aviso-ir" href="' + a.boton.href + '" style="background:linear-gradient(180deg,#2f6f5e,#245647);color:#fff;'
        + 'text-decoration:none;border-radius:12px;padding:13px;font-weight:800;font-size:15px">' + a.boton.texto + '</a>' : '')
      + '<button id="gb-aviso-ok" type="button" style="background:#f5f1e8;border:1px solid #e9e3d6;color:#1b2a32;border-radius:12px;'
      + 'padding:12px;font:inherit;font-weight:700;font-size:14px;cursor:pointer">Entendido</button></div>';
    fondo.appendChild(caja);
    document.body.appendChild(fondo);
    // Se marca como visto recién cuando lo cierra o toca el botón (si la pantalla se va
    // antes, vuelve a aparecer en la siguiente).
    var cerrar = function () { marcar(a); var f = document.getElementById('gb-aviso'); if (f) f.remove(); };
    document.getElementById('gb-aviso-ok').addEventListener('click', cerrar);
    var ir = document.getElementById('gb-aviso-ir'); if (ir) ir.addEventListener('click', function () { marcar(a); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', k); } });
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
})();
