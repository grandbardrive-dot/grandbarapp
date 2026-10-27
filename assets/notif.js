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

  // ---- Sonido gracioso para cuando entra una tarea nueva ----------------
  // "Boing" de dibujito + silbato que sube. Se arma con WebAudio (sin archivo).
  // El navegador necesita un toque/clic antes de dejar sonar: se desbloquea solo
  // con la primera interacción del usuario en el Hub.
  var actx = null;
  function unlock() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
  ['click', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true }); });
  function sonidoGracioso() {
    try {
      unlock(); if (!actx) return;
      var t = actx.currentTime, dur = 1.0;
      // Grito de mujer (sintetizado): cuerda vocal (sawtooth) aguda con vibrato y el
      // tono que sube y tiembla, pasada por formantes de "aaah", + aire (ruido).
      var o = actx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(700, t);
      o.frequency.linearRampToValueAtTime(1150, t + 0.14);
      o.frequency.linearRampToValueAtTime(980, t + 0.5);
      o.frequency.linearRampToValueAtTime(1080, t + 0.8);
      o.frequency.linearRampToValueAtTime(620, t + dur);
      var vib = actx.createOscillator(), vibg = actx.createGain();
      vib.frequency.value = 12; vibg.gain.value = 40; vib.connect(vibg); vibg.connect(o.frequency);
      function formante(freq, q, gain) {
        var f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
        var g = actx.createGain(); g.gain.value = gain; f.connect(g); return { f: f, g: g };
      }
      var F1 = formante(850, 8, 1.0), F2 = formante(1300, 10, 0.85), F3 = formante(2900, 12, 0.6);
      // Aire / aspereza del grito
      var len = Math.floor(actx.sampleRate * dur);
      var nb = actx.createBuffer(1, len, actx.sampleRate), ch = nb.getChannelData(0);
      for (var i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      var noise = actx.createBufferSource(); noise.buffer = nb;
      var nbp = actx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 2000; nbp.Q.value = 2;
      var ng = actx.createGain(); ng.gain.value = 0.22;
      // Envolvente fuerte: entra de golpe, se sostiene y cae
      var master = actx.createGain();
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.9, t + 0.06);
      master.gain.setValueAtTime(0.9, t + 0.72);
      master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(F1.f); o.connect(F2.f); o.connect(F3.f);
      F1.g.connect(master); F2.g.connect(master); F3.g.connect(master);
      noise.connect(nbp); nbp.connect(ng); ng.connect(master);
      master.connect(actx.destination);
      o.start(t); vib.start(t); noise.start(t);
      o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05); noise.stop(t + dur + 0.05);
    } catch (e) {}
  }
  window.GBNotifSonido = sonidoGracioso; // para probarlo desde la consola

  // ¿La notificación nueva es una tarea? (así el sonido gracioso suena para las tareas)
  function esTarea(x) { return x && ((x.link && String(x.link).indexOf('tareas-nahuel') >= 0) || /^Nueva tarea/i.test(String(x.titulo || ''))); }

  // Aviso del navegador (suena y se ve aunque la pestaña esté de fondo). Necesita
  // permiso una sola vez; se lo pedimos cuando abre la campanita.
  function pedirPermiso() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }
  function avisoNavegador(x) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      var n = new Notification(String(x.titulo || 'Nueva tarea'), { body: String(x.detalle || ''), tag: x.id || 'tarea', renotify: true });
      n.onclick = function () { try { window.focus(); location.href = x.link || 'tareas-nahuel.html'; } catch (e) {} };
    } catch (e) {}
  }
  function avisarTarea(x) { sonidoGracioso(); avisoNavegador(x); }

  var c = supabase.createClient(HUB.url, HUB.key);
  c.auth.getSession().then(function (r) {
    var s = r.data.session; if (!s) return;
    TOKEN = s.access_token; build(); load(); setInterval(load, 20000);
  });

  var bell, dot, panel;
  function build() {
    // Si la página ya tiene su campanita en la barra, se usa ESA. Antes se agregaba
    // siempre una flotante: quedaban las dos superpuestas y la de la barra no hacía
    // nada (su contador "3" era de maqueta).
    var propia = document.querySelector('[data-gb-bell]') || document.querySelector('.bell') || document.querySelector('.tb-bell');
    if (propia) {
      bell = propia;
      var falso = bell.querySelector('.dot');
      if (falso) falso.parentNode.removeChild(falso);
      bell.style.cursor = 'pointer';
      if (getComputedStyle(bell).position === 'static') bell.style.position = 'relative';
    } else {
      bell = document.createElement('button');
      bell.setAttribute('aria-label', 'Notificaciones');
      bell.style.cssText = 'position:fixed;top:10px;right:12px;z-index:9000;width:42px;height:42px;border-radius:50%;border:0;background:#0d2230;color:#fff;box-shadow:0 6px 18px -6px rgba(0,0,0,.5);cursor:pointer;display:grid;place-items:center';
      bell.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
      document.body.appendChild(bell);
    }
    dot = document.createElement('span');
    dot.style.cssText = 'position:absolute;top:-5px;right:-5px;background:#c0603e;color:#fff;font-size:10px;font-weight:800;border-radius:50%;min-width:17px;height:17px;display:none;place-items:center;padding:0 3px;line-height:1';
    bell.appendChild(dot);

    panel = document.createElement('div');
    panel.style.cssText = 'display:none;position:fixed;top:58px;right:12px;width:min(340px,92vw);max-height:72vh;overflow:auto;background:#fff;border:1px solid #e7ded0;border-radius:14px;box-shadow:0 18px 44px -12px rgba(0,0,0,.32);z-index:9000;font-family:Inter,system-ui,sans-serif';
    panel.innerHTML = '<div style="padding:12px 15px;border-bottom:1px solid #e7ded0;font-weight:800;font-size:14px;position:sticky;top:0;background:#fff;color:#1b2a32">🔔 Notificaciones</div><div id="gbNbody"><div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">Cargando…</div></div>';
    document.body.appendChild(panel);

    // El panel se ubica debajo de la campanita que se esté usando (la de la barra
    // no está siempre en la misma esquina que la flotante).
    function ubicar() {
      var r = bell.getBoundingClientRect();
      panel.style.top = Math.round(r.bottom + 8) + 'px';
      panel.style.right = Math.max(12, Math.round(window.innerWidth - r.right)) + 'px';
    }
    window.addEventListener('resize', function () { if (panel.style.display === 'block') ubicar(); });

    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      var abierto = panel.style.display === 'block';
      if (!abierto) ubicar();
      panel.style.display = abierto ? 'none' : 'block';
      if (!abierto) { pedirPermiso(); render(); var top = items[0] ? String(items[0].ts || '') : new Date().toISOString(); localStorage.setItem('gb_notif_seen', top); badge(); }
    });
    document.addEventListener('click', function (e) { if (panel.style.display === 'block' && !panel.contains(e.target) && !bell.contains(e.target)) panel.style.display = 'none'; });
  }

  // Avisos del panel que no son notificaciones guardadas sino cosas pendientes
  // (panel comercial: propuestas para revisar, campañas por vencer). La página los
  // deja en window.GBNotifExtra y llama a GBNotifActualizar() (30/09/2026).
  function extras() { return Array.isArray(window.GBNotifExtra) ? window.GBNotifExtra : []; }
  window.GBNotifActualizar = function () { if (panel) { render(); badge(); } };
  function extraHTML(x) {
    return '<a href="' + esc(x.link || '#') + '" style="display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid #eee7d8;align-items:flex-start;color:#1b2a32;text-decoration:none;background:#fbf7ee">'
      + '<span style="font-size:16px;flex:none">' + esc(x.icon || '•') + '</span><div><div style="font-weight:700;font-size:12.8px">' + esc(x.titulo || '') + '</div>'
      + (x.detalle ? '<div style="font-size:11.5px;color:#6d7d85;margin-top:2px">' + esc(x.detalle) + '</div>' : '') + '</div></a>';
  }

  function render() {
    var seen = localStorage.getItem('gb_notif_seen') || '';
    var body = panel.querySelector('#gbNbody');
    var ex = extras();
    body.innerHTML = (ex.length || items.length) ? ex.map(extraHTML).join('') + items.map(function (x) {
      var nueva = String(x.ts || '') > seen;
      var f = x.ts ? new Date(x.ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      return '<a href="' + esc(x.link || '#') + '" style="display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid #eee7d8;align-items:flex-start;color:#1b2a32;text-decoration:none;' + (nueva ? 'background:#fbf7ee' : '') + '">'
        + '<span style="font-size:16px;flex:none">' + esc(x.icon || '•') + '</span><div><div style="font-weight:700;font-size:12.8px">' + esc(x.titulo || '') + '</div><div style="font-size:11.5px;color:#6d7d85;margin-top:2px">' + esc(x.detalle || '') + '</div><div style="font-size:10.5px;color:#6d7d85;margin-top:3px">' + f + '</div></div></a>';
    }).join('') : '<div style="padding:22px;text-align:center;color:#6d7d85;font-size:13px">No tenés notificaciones.</div>';
  }
  function badge() {
    var seen = localStorage.getItem('gb_notif_seen') || '';
    // Los pendientes del panel cuentan mientras sigan pendientes.
    var n = items.filter(function (x) { return String(x.ts || '') > seen; }).length + extras().length;
    if (n > 0) { dot.textContent = n > 9 ? '9+' : n; dot.style.display = 'grid'; } else { dot.style.display = 'none'; }
  }
  function load() {
    fetch('/.netlify/functions/notificaciones', { headers: { Authorization: 'Bearer ' + TOKEN } })
      .then(function (r) { return r.ok ? r.json() : { notificaciones: [] }; })
      .then(function (d) {
        items = d.notificaciones || [];
        var top = items[0] || null;
        // Suena y avisa UNA sola vez por tarea, aunque Nahuel abra el Hub DESPUÉS de
        // que se la asignaron (antes solo sonaba si ya tenía la pestaña abierta).
        if (top && esTarea(top) && top.id) {
          var rang = ''; try { rang = localStorage.getItem('gb_tarea_rang') || ''; } catch (e) {}
          if (top.id !== rang) {
            try { localStorage.setItem('gb_tarea_rang', top.id); } catch (e) {}
            avisarTarea(top);
          }
        }
        render(); badge();
      });
  }
})();
