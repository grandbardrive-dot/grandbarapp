// GrandBar Hub · Grabar/subir audio de reunión → transcripción IA → minuta.
// Uso: mountMinutaIA(contenedorEl, fill) donde fill({temas,pendientes,notas}).
(function () {
  var MAN = { url: 'https://fzaxwuuodseyyinveknn.supabase.co', key: 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk' };
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  var _man = null;
  function man() { if (!_man) _man = supabase.createClient(MAN.url, MAN.key); return _man; }
  async function hubToken() { try { var c = supabase.createClient(HUB.url, HUB.key); var r = await c.auth.getSession(); return r.data.session && r.data.session.access_token; } catch (e) { return null; } }
  function fmtT(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  window.mountMinutaIA = function (el, fill) {
    if (!el) return;
    el.innerHTML = '<div style="background:#f3eee1;border:1px solid #e7ded0;border-radius:11px;padding:11px 12px;margin-bottom:14px">'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<b style="font-size:12.5px;flex:1;min-width:120px">🎙️ Minuta con IA</b>'
      + '<button type="button" id="miaRec" style="background:#6b5bd0;color:#fff;border:0;border-radius:8px;padding:8px 12px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">🎙️ Grabar</button>'
      + '<label style="background:#fff;border:1px solid #cfe0ec;color:#2c5a80;border-radius:8px;padding:8px 12px;font:inherit;font-weight:700;font-size:12px;cursor:pointer">📎 Subir audio<input type="file" id="miaFile" accept="audio/*" style="display:none"></label>'
      + '</div>'
      + '<div id="miaStatus" style="font-size:11.5px;color:#6d7d85;margin-top:7px"></div></div>';
    var recBtn = el.querySelector('#miaRec'), fileInp = el.querySelector('#miaFile'), status = el.querySelector('#miaStatus');
    var mediaRec = null, chunks = [], recording = false, timer = null, t0 = 0, mime = '';

    recBtn.onclick = async function () {
      if (recording) { mediaRec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { status.textContent = 'Tu navegador no permite grabar. Usá “Subir audio”.'; return; }
      try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
        mediaRec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
        mediaRec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        mediaRec.onstop = async function () {
          recording = false; recBtn.textContent = '🎙️ Grabar'; recBtn.style.background = '#6b5bd0'; clearInterval(timer);
          stream.getTracks().forEach(function (t) { t.stop(); });
          var blob = new Blob(chunks, { type: mime || 'audio/webm' });
          await procesar(blob, (mime.indexOf('mp4') >= 0) ? 'm4a' : 'webm');
        };
        mediaRec.start(); recording = true; t0 = Date.now();
        recBtn.textContent = '⏹ Detener'; recBtn.style.background = '#c0603e';
        timer = setInterval(function () { status.textContent = '● Grabando… ' + fmtT(Math.floor((Date.now() - t0) / 1000)); }, 500);
      } catch (e) { status.textContent = 'No pude acceder al micrófono (¿diste permiso?).'; }
    };
    fileInp.onchange = async function () { var f = fileInp.files[0]; if (!f) return; await procesar(f, (f.name.split('.').pop() || 'm4a').toLowerCase()); };

    async function procesar(blob, ext) {
      try {
        recBtn.disabled = true; fileInp.disabled = true;
        if ((blob.size || 0) > 100 * 1024 * 1024) { status.textContent = 'El audio pesa más de 100MB. Grabá algo más corto.'; recBtn.disabled = false; fileInp.disabled = false; return; }
        status.textContent = '⏳ Subiendo audio…';
        var path = 'reuniones-audio/' + Date.now() + '-' + Math.floor(Math.random() * 99999) + '.' + ext;
        var up = await man().storage.from('Activaciones').upload(path, blob, { upsert: true, contentType: blob.type || 'audio/webm' });
        if (up.error) throw up.error;
        var pub = man().storage.from('Activaciones').getPublicUrl(path);
        var url = pub.data.publicUrl;
        var token = await hubToken();
        status.textContent = '⏳ Transcribiendo con IA…';
        var r = await fetch('/.netlify/functions/transcribir-minuta', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'start', audio_url: url }) });
        var d = await r.json(); if (!r.ok || !d.ok) { status.textContent = 'Error: ' + (d.error || 'no se pudo iniciar'); recBtn.disabled = false; fileInp.disabled = false; return; }
        await poll(d.id, token, 0);
      } catch (e) { status.textContent = 'Error: ' + (e.message || e); recBtn.disabled = false; fileInp.disabled = false; }
    }

    async function poll(id, token, intentos) {
      if (intentos > 150) { status.textContent = 'Tardó demasiado. Probá de nuevo.'; recBtn.disabled = false; fileInp.disabled = false; return; }
      try {
        var r = await fetch('/.netlify/functions/transcribir-minuta', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'estado', id: id }) });
        var d = await r.json();
        if (!r.ok || d.ok === false) { status.textContent = 'Error: ' + (d.error || 'falló la transcripción'); recBtn.disabled = false; fileInp.disabled = false; return; }
        if (d.estado === 'procesando') { status.textContent = '⏳ Transcribiendo con IA… ' + fmtT(intentos * 4); setTimeout(function () { poll(id, token, intentos + 1); }, 4000); return; }
        if (d.estado === 'listo') { try { fill(d.minuta || {}); } catch (e) {} status.textContent = '✓ Minuta armada por IA. Revisá y guardá.'; recBtn.disabled = false; fileInp.disabled = false; return; }
        setTimeout(function () { poll(id, token, intentos + 1); }, 4000);
      } catch (e) { setTimeout(function () { poll(id, token, intentos + 1); }, 4000); }
    }
  };
})();
