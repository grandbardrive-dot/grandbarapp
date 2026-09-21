/* ===========================================================
   GrandBar — formulario para agendar (lo usan todas las agendas)
   -----------------------------------------------------------
   Una sola ventana para crear o editar un evento, en cualquier panel:
   mi-agenda.html, agenda.html (vendedores) y dir-agenda.html (Dirección).

   - Si no invitás a nadie, es un evento personal (solo lo ves vos).
   - Cada persona del Portal que sumás recibe el aviso y la ve en su agenda.
   - "Otra persona" es texto libre, para alguien que no está en el Portal.

   Uso:
     GBReunion.abrir({ token, evento, fecha, onGuardado })
       evento: el que devuelve la función reuniones (para editar); sin él, crea.
     GBReunion.api(token, { accion, ... })      → POST a la función
     GBReunion.usuarios(token)                  → gente a la que se puede invitar
   =========================================================== */
(function () {
  const API = '/.netlify/functions/reuniones';
  const TIPOS = { reunion: '🤝 Reunión', llamada: '📞 Llamada', visita: '📍 Visita', capacitacion: '🎓 Capacitación' };
  const ROL = { ventas: 'Ventas', direccion: 'Dirección', duenio: 'Dirección', admin: 'Administración', administracion: 'Administración',
    tesoreria: 'Tesorería', compras: 'Compras', diseno: 'Diseño', desarrollo: 'Desarrollo', marketing: 'Marketing',
    deposito: 'Depósito', mayorista: 'Mayorista', reportes: 'Reportes' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  // Si la página no pasa el token, se toma la sesión guardada del Portal.
  function tokenGuardado() {
    try {
      const j = JSON.parse(localStorage.getItem('sb-xqhyemccbwmzxqzkrtwa-auth-token') || 'null');
      return (j && (j.access_token || (j.currentSession && j.currentSession.access_token))) || null;
    } catch (e) { return null; }
  }

  async function api(token, body) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || tokenGuardado()) }, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok || j.error) throw new Error(j.error || ('Error ' + r.status));
    return j;
  }

  let _usuarios = null;
  async function usuarios(token) {
    if (_usuarios) return _usuarios;
    const r = await fetch(API + '?usuarios=1', { headers: { Authorization: 'Bearer ' + (token || tokenGuardado()) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || 'No pude traer la lista de personas');
    _usuarios = j.usuarios || [];
    return _usuarios;
  }
  function miId() {
    try {
      const j = JSON.parse(localStorage.getItem('sb-xqhyemccbwmzxqzkrtwa-auth-token') || 'null');
      return (j && j.user && j.user.id) || null;
    } catch (e) { return null; }
  }

  function estilos() {
    if (document.getElementById('gbr-css')) return;
    const s = document.createElement('style');
    s.id = 'gbr-css';
    s.textContent = `
      .gbr-ov{position:fixed;inset:0;background:rgba(13,34,56,.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:40px 14px;overflow:auto;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
      .gbr-card{background:#fff;border-radius:18px;width:100%;max-width:540px;box-shadow:0 24px 60px rgba(13,34,56,.3);color:#1b2a32}
      .gbr-hd{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 12px;border-bottom:1px solid #efe9dc}
      .gbr-hd h3{margin:0;font-size:17px;color:#0d2238}
      .gbr-x{background:none;border:0;font-size:22px;line-height:1;color:#7a8891;cursor:pointer;padding:4px}
      .gbr-bd{padding:16px 20px 6px;display:grid;gap:12px}
      .gbr-bd label,.gbr-bd .gbr-campo{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:800;color:#7a8891;text-transform:uppercase;letter-spacing:.04em}
      .gbr-bd input,.gbr-bd select,.gbr-bd textarea{font:inherit;font-size:14px;font-weight:500;color:#1b2a32;border:1.5px solid #e9e3d6;border-radius:10px;padding:10px 11px;background:#fff;text-transform:none;letter-spacing:0;width:100%;box-sizing:border-box}
      .gbr-bd input:focus,.gbr-bd select:focus,.gbr-bd textarea:focus{outline:none;border-color:#0d2238}
      .gbr-bd textarea{min-height:70px;resize:vertical}
      .gbr-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .gbr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:2px}
      .gbr-chip{display:inline-flex;align-items:center;gap:6px;background:#e7f1ea;color:#245647;border-radius:20px;padding:5px 6px 5px 11px;font-size:13px;font-weight:600;text-transform:none;letter-spacing:0}
      .gbr-chip button{background:rgba(0,0,0,.08);border:0;border-radius:50%;width:20px;height:20px;line-height:20px;padding:0;cursor:pointer;color:#245647;font-size:13px}
      .gbr-busca{position:relative}
      .gbr-sug{position:absolute;left:0;right:0;top:100%;margin-top:4px;background:#fff;border:1.5px solid #e9e3d6;border-radius:10px;box-shadow:0 12px 30px rgba(13,34,56,.15);z-index:2;max-height:230px;overflow:auto}
      .gbr-sug button{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid #efe9dc;padding:10px 12px;font:inherit;font-size:14px;cursor:pointer;color:#1b2a32;text-transform:none;letter-spacing:0;font-weight:500}
      .gbr-sug button:hover,.gbr-sug button.on{background:#f7efda}
      .gbr-sug small{color:#7a8891;font-size:12px}
      .gbr-hint{font-size:12px;color:#7a8891;font-weight:500;text-transform:none;letter-spacing:0;line-height:1.4}
      .gbr-ft{display:flex;gap:8px;justify-content:flex-end;padding:14px 20px 18px}
      .gbr-b{font:inherit;font-size:14px;font-weight:700;border-radius:10px;padding:10px 16px;cursor:pointer;border:1.5px solid #e9e3d6;background:#fff;color:#0d2238}
      .gbr-b.pri{background:#0d2238;border-color:#0d2238;color:#fff}
      .gbr-b[disabled]{opacity:.55;cursor:default}
      .gbr-err{color:#c0392b;font-size:13px;font-weight:600;padding:0 20px;min-height:0}
      @media(max-width:560px){.gbr-ov{padding:0}.gbr-card{border-radius:0;min-height:100%;max-width:none}.gbr-2{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function etiqueta(u) {
    const r = ROL[String(u.rol || '').toLowerCase()] || u.rol || '';
    return r + (u.canal ? ' · ' + u.canal : '') + (u.es_supervisor ? ' · Supervisor' : '');
  }

  async function abrir(opts) {
    opts = opts || {};
    estilos();
    const ev = opts.evento || null;
    const token = opts.token || tokenGuardado();
    const yo = opts.miId || miId();
    let elegidos = ev ? (ev.participantes || []).map(p => ({ id: String(p.usuario_id), nombre: p.nombre })) : [];
    const hoy = new Date(); const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    const ov = document.createElement('div');
    ov.className = 'gbr-ov';
    ov.innerHTML = `
      <div class="gbr-card" role="dialog" aria-modal="true">
        <div class="gbr-hd"><h3>${ev ? 'Editar' : 'Agendar'}</h3><button class="gbr-x" data-cerrar aria-label="Cerrar">×</button></div>
        <div class="gbr-bd">
          <label>Qué<input id="gbr-tit" maxlength="160" placeholder="Ej: Revisar el plan de octubre" value="${esc(ev ? ev.titulo : '')}"></label>
          <div class="gbr-2">
            <label>Tipo<select id="gbr-tipo">${Object.keys(TIPOS).map(k => `<option value="${k}" ${ev && ev.tipo === k ? 'selected' : ''}>${TIPOS[k]}</option>`).join('')}</select></label>
            <label>Lugar<input id="gbr-lugar" maxlength="200" placeholder="Oficina, Meet, cliente…" value="${esc(ev ? ev.lugar || '' : '')}"></label>
          </div>
          <div class="gbr-2">
            <label>Día<input id="gbr-fecha" type="date" value="${esc(ev ? ev.fecha : (opts.fecha || iso(hoy)))}"></label>
            <label>Hora (opcional)<input id="gbr-hora" type="time" value="${esc(ev && ev.hora ? String(ev.hora).slice(0, 5) : '')}"></label>
          </div>
          <div class="gbr-campo">Con quién del Portal
            <div class="gbr-chips" id="gbr-chips"></div>
            <div class="gbr-busca"><input id="gbr-q" autocomplete="off" placeholder="Escribí un nombre…" aria-label="Buscar persona del Portal"><div class="gbr-sug" id="gbr-sug" hidden></div></div>
            <span class="gbr-hint" id="gbr-hint"></span>
          </div>
          <label>Otra persona (no está en el Portal)<input id="gbr-otro" maxlength="120" placeholder="Ej: el contador, un cliente…" value="${esc(ev ? ev.con_quien || '' : '')}"></label>
          <label>Detalle (opcional)<textarea id="gbr-det" maxlength="4000" placeholder="Temas, qué llevar, link de la videollamada…">${esc(ev ? ev.detalle || '' : '')}</textarea></label>
        </div>
        <div class="gbr-err" id="gbr-err"></div>
        <div class="gbr-ft"><button class="gbr-b" data-cerrar>Cancelar</button><button class="gbr-b pri" id="gbr-ok">${ev ? 'Guardar cambios' : 'Agendar'}</button></div>
      </div>`;
    document.body.appendChild(ov);
    const $ = id => ov.querySelector('#' + id);
    const cerrar = () => { ov.remove(); document.removeEventListener('keydown', teclaEsc); };
    const teclaEsc = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', teclaEsc);
    ov.addEventListener('click', e => { if (e.target === ov || e.target.hasAttribute('data-cerrar')) cerrar(); });

    function pintarChips() {
      $('gbr-chips').innerHTML = elegidos.map(u => `<span class="gbr-chip">${esc(u.nombre)}<button type="button" data-quitar="${esc(u.id)}" aria-label="Quitar">×</button></span>`).join('');
      $('gbr-hint').textContent = elegidos.length
        ? 'A ' + (elegidos.length === 1 ? 'esta persona' : 'cada una') + ' le llega el aviso y la ve en su agenda.'
        : 'Si no sumás a nadie, es un evento personal: solo lo ves vos.';
    }
    $('gbr-chips').addEventListener('click', e => {
      const id = e.target.getAttribute && e.target.getAttribute('data-quitar');
      if (!id) return;
      elegidos = elegidos.filter(u => u.id !== id); pintarChips();
    });
    pintarChips();

    let gente = [], marcado = 0;
    usuarios(token).then(l => { gente = l.filter(u => String(u.id) !== String(yo)); }).catch(err => { $('gbr-hint').textContent = 'No pude traer la lista de personas: ' + err.message; });

    function sugerir() {
      const q = norm($('gbr-q').value);
      const box = $('gbr-sug');
      if (!q) { box.hidden = true; return; }
      const ya = new Set(elegidos.map(u => u.id));
      const res = gente.filter(u => !ya.has(String(u.id)) && (norm(u.nombre).includes(q) || norm(u.email).includes(q))).slice(0, 8);
      if (!res.length) { box.innerHTML = `<button type="button" disabled><span>No hay nadie con ese nombre en el Portal</span></button>`; box.hidden = false; return; }
      marcado = Math.min(marcado, res.length - 1);
      box.innerHTML = res.map((u, i) => `<button type="button" class="${i === marcado ? 'on' : ''}" data-id="${esc(u.id)}"><span>${esc(u.nombre || u.email)}</span><small>${esc(etiqueta(u))}</small></button>`).join('');
      box.hidden = false;
    }
    function sumar(id) {
      const u = gente.find(x => String(x.id) === String(id));
      if (!u || elegidos.some(x => x.id === String(u.id))) return;
      elegidos.push({ id: String(u.id), nombre: u.nombre || u.email });
      $('gbr-q').value = ''; $('gbr-sug').hidden = true; marcado = 0; pintarChips(); $('gbr-q').focus();
    }
    $('gbr-q').addEventListener('input', () => { marcado = 0; sugerir(); });
    $('gbr-q').addEventListener('keydown', e => {
      const bs = [...$('gbr-sug').querySelectorAll('button[data-id]')];
      if (e.key === 'ArrowDown' && bs.length) { e.preventDefault(); marcado = (marcado + 1) % bs.length; sugerir(); }
      else if (e.key === 'ArrowUp' && bs.length) { e.preventDefault(); marcado = (marcado - 1 + bs.length) % bs.length; sugerir(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (bs[marcado]) sumar(bs[marcado].getAttribute('data-id')); }
    });
    $('gbr-sug').addEventListener('mousedown', e => { const b = e.target.closest('button[data-id]'); if (b) { e.preventDefault(); sumar(b.getAttribute('data-id')); } });
    $('gbr-q').addEventListener('blur', () => setTimeout(() => { if ($('gbr-sug')) $('gbr-sug').hidden = true; }, 150));

    $('gbr-ok').addEventListener('click', async () => {
      const body = {
        accion: ev ? 'editar' : 'crear', id: ev ? ev.id : undefined,
        titulo: $('gbr-tit').value.trim(), tipo: $('gbr-tipo').value,
        fecha: $('gbr-fecha').value, hora: $('gbr-hora').value || null,
        lugar: $('gbr-lugar').value.trim(), detalle: $('gbr-det').value.trim(),
        con_quien: $('gbr-otro').value.trim() || null,
        invitados: elegidos.map(u => u.id),
      };
      if (!body.titulo) { $('gbr-err').textContent = 'Poné qué es.'; $('gbr-tit').focus(); return; }
      if (!body.fecha) { $('gbr-err').textContent = 'Poné el día.'; return; }
      const btn = $('gbr-ok'); btn.disabled = true; btn.textContent = 'Guardando…'; $('gbr-err').textContent = '';
      try {
        await api(token, body);
        cerrar();
        if (typeof opts.onGuardado === 'function') opts.onGuardado(body);
      } catch (err) {
        $('gbr-err').textContent = err.message;
        btn.disabled = false; btn.textContent = ev ? 'Guardar cambios' : 'Agendar';
      }
    });
    setTimeout(() => { if (!ev) $('gbr-tit').focus(); }, 30);
  }

  window.GBReunion = { abrir, api, usuarios, TIPOS };
})();
