// GrandBar Hub · cliente de notificaciones push (reutilizable en cualquier página)
// Uso: poné un <div id="pushMount"></div> y llamá window.pushMount(el) cuando cargue.
(function () {
  var VAPID_PUBLIC = 'BLGioYplqvsOcFZvfGeME6wta6_xI6BDVZFAgpdsE0iKszgAF1ndwCzSKxDOc0heIs7Rpv9HMfQAyRheHJ2UE4c';
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  var soportado = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);

  function u8(base64) {
    var pad = '='.repeat((4 - base64.length % 4) % 4);
    var b = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(b), arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
  async function token() {
    try { var c = supabase.createClient(HUB.url, HUB.key); var r = await c.auth.getSession(); return r.data.session && r.data.session.access_token; }
    catch (e) { return null; }
  }

  window.pushEstado = async function () {
    if (!soportado) return 'none';
    if (Notification.permission === 'granted') {
      try { var reg = await navigator.serviceWorker.getRegistration(); var sub = reg && await reg.pushManager.getSubscription(); return sub ? 'on' : 'off'; }
      catch (e) { return 'off'; }
    }
    return Notification.permission === 'denied' ? 'none' : 'off';
  };
  window.pushActivar = async function () {
    if (!soportado) { alert('Este navegador no soporta avisos. En iPhone: agregá la app a la pantalla de inicio (iOS 16.4+).'); return 'unsupported'; }
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    var reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(VAPID_PUBLIC) });
    var j = sub.toJSON(), t = await token();
    if (!t) return 'notoken';
    var r = await fetch('/.netlify/functions/push-subscribe', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'subscribe', subscription: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } }) });
    var d = await r.json().catch(function () { return {}; });
    return (r.ok && d.ok) ? 'ok' : 'err';
  };
  window.pushProbar = async function () {
    var t = await token(); if (!t) return {};
    var r = await fetch('/.netlify/functions/push-subscribe', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'test' }) });
    return r.json().catch(function () { return {}; });
  };

  // Pinta un banner de activar/probar dentro de `el` (un contenedor con estilos propios).
  window.pushMount = async function (el) {
    if (!el) return;
    var st = await window.pushEstado();
    if (st === 'none') { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    function paint(state) {
      if (state === 'on') {
        el.innerHTML = '<span style="font-size:20px">🔔</span><div style="flex:1;min-width:0"><div style="font-weight:800;font-size:13.5px">✓ Avisos activados en este dispositivo</div><div style="font-size:12px;color:#6d7d85">Te llega al celular aunque no tengas la app abierta.</div></div><button id="pmBtn" style="background:#2f8f6e;color:#fff;border:0;border-radius:9px;padding:9px 14px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer">Probar</button>';
        el.querySelector('#pmBtn').onclick = async function () { this.textContent = 'Enviando…'; var d = await window.pushProbar(); alert(d && d.enviados ? 'Te mandamos una notificación de prueba 🔔' : 'No hay ningún dispositivo suscripto'); this.textContent = 'Probar'; };
      } else {
        el.innerHTML = '<span style="font-size:20px">🔔</span><div style="flex:1;min-width:0"><div style="font-weight:800;font-size:13.5px">Activá los avisos en este dispositivo</div><div style="font-size:12px;color:#6d7d85">Recibí una notificación aunque no tengas la app abierta.</div></div><button id="pmBtn" style="background:#6b5bd0;color:#fff;border:0;border-radius:9px;padding:9px 14px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer">Activar</button>';
        el.querySelector('#pmBtn').onclick = async function () { this.textContent = '…'; var res = await window.pushActivar(); if (res === 'ok') paint('on'); else { if (res === 'denied') alert('No diste permiso para los avisos.'); else if (res !== 'unsupported') alert('No se pudo activar.'); this.textContent = 'Activar'; } };
      }
    }
    paint(st);
  };
})();
