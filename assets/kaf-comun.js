// ─── Paneles KAF: lo que comparten el panel del KAF (kaf.html) y el tablero de ───
// Trade Marketing (trade-kaf.html). 19/10/2026. Todo pasa por la función kaf.
// K.modo = 'kaf' (el propio KAF: marca visitas, carga y pide) o 'trade' (Juan Pablo:
// mira, arma objetivos y revisa; K.kaf = el KAF elegido).
window.KAF = (function () {
  const FN = '/.netlify/functions/kaf';
  const HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  const K = { modo: 'kaf', kaf: null, perfil: null, secciones: [], clientes: null, plata: false, hoy: null };
  let sb = null;
  const supa = () => sb || (sb = window.supabase.createClient(HUB.url, HUB.key));

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Math.round(Number(n) || 0).toLocaleString('es-AR');
  const plata = n => '$ ' + num(n);
  const aDate = v => new Date(String(v).length <= 10 ? v + 'T12:00:00' : v);
  const fecha = v => v ? aDate(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  const hora = v => v ? new Date(v).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const dia = v => { if (!v) return ''; const d = aDate(v); return DIAS[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };
  const diaLargo = v => { const s = aDate(v).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const isoLocal = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const hoy = () => isoLocal(new Date());
  const sumaDias = (iso, n) => { const d = aDate(iso); d.setDate(d.getDate() + n); return isoLocal(d); };
  const lunes = iso => { const d = aDate(iso); return sumaDias(iso, -((d.getDay() + 6) % 7)); };
  const mesNombre = m => { const [y, mm] = m.split('-').map(Number); const s = new Date(y, mm - 1, 15).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const mesCorto = m => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 15).toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''); };
  const mesDe = iso => iso.slice(0, 7);
  const mesMenos = (m, n) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 - n, 15); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const TIPO = { restaurante: 'Restó', bar: 'Bares', disco: 'Discos', evento: 'Eventos', hotel: 'Hoteles', vinoteca: 'Vinotecas', autoservicio: 'Autoservicios', 'tienda de bebidas': 'Tiendas de bebidas', mayorista: 'Mayoristas', otros: 'Otros' };
  const TIPO1 = { restaurante: 'Restó', bar: 'Bar', disco: 'Disco', evento: 'Evento', hotel: 'Hotel', vinoteca: 'Vinoteca', autoservicio: 'Autoservicio', 'tienda de bebidas': 'Tienda de bebidas', mayorista: 'Mayorista', otros: 'Otro' };
  const REG = {
    evidencia: { n: 'Evidencia en PDV', uno: 'evidencia', d: 'Fotos de la marca y de la competencia en el punto de venta: lo que está bien ejecutado y lo que está mal.' },
    perfect_serve: { n: 'Perfect Serve', uno: 'Perfect Serve', d: 'Cómo se ejecuta el trago en el punto de venta contra el modelo: receta, medida, cristalería, garnish y precio en carta.' },
    perfect_store: { n: 'Perfect Store', uno: 'Perfect Store', d: 'Surtido, precios y exhibición en el punto de venta contra el modelo.' },
    capacitacion: { n: 'Capacitaciones', uno: 'capacitación', d: 'Cada capacitación: dónde, de qué marcas, quiénes participaron y fotos.' },
    presupuesto: { n: 'Presupuestos', uno: 'presupuesto', d: 'Presupuestos, propuestas y evidencias de gastronomía para presupuestar. Trade Marketing los aprueba o los rechaza.' },
  };
  const ESTADO = { nuevo: 'Nuevo', visto: 'Visto', pendiente: 'Para aprobar', aprobado: 'Aprobado', rechazado: 'Rechazado', enviado: 'Enviado a Andrea', remito: 'Con remito', logrado: 'Logrado', no_logrado: 'No logrado' };
  const ESTADO_OBJ = { pendiente: 'Pendiente', logrado: 'Logrado', no_logrado: 'No logrado' };

  function toast(m, err) { const t = $('toast'); if (!t) return alert(m); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => { t.className = 'toast'; }, 3200); }
  async function token() { const { data: { session } } = await supa().auth.getSession(); return session ? session.access_token : null; }
  async function get(vista, extra) {
    const t = await token();
    if (!t) { location.href = 'index.html'; throw new Error('Tu sesión se cerró.'); }
    const qs = new URLSearchParams(Object.assign({ vista }, K.kaf ? { kaf: K.kaf } : {}, extra || {}));
    const r = await fetch(FN + '?' + qs, { headers: { Authorization: 'Bearer ' + t } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
    return d;
  }
  async function post(body) {
    const t = await token();
    if (!t) { location.href = 'index.html'; throw new Error('Tu sesión se cerró.'); }
    const r = await fetch(FN, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign(K.modo === 'trade' && K.kaf ? { kaf: K.kaf } : {}, body)) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
    return d;
  }
  const secc = k => (K.secciones || []).find(s => s.k === k && s.on) || null;
  const esKaf = () => K.modo === 'kaf';

  // CSV con ";" y BOM: lo abre bien el Excel en castellano.
  function csv(nombre, filas) {
    const txt = '﻿' + filas.map(f => f.map(v => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ── Ventana ────────────────────────────────────────────────────────────────
  function ventana(titulo, sub, html) {
    let ov = $('kaf-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'kaf-ov'; ov.className = 'ov';
      ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="mh"><button class="cerrar" type="button" aria-label="Cerrar">×</button><h3></h3><div class="sub"></div></div><div class="mb"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.cerrar')) cerrar(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('open')) cerrar(); });
    }
    ov.querySelector('h3').textContent = titulo;
    ov.querySelector('.sub').textContent = sub || '';
    ov.querySelector('.sub').style.display = sub ? '' : 'none';
    const mb = ov.querySelector('.mb'); mb.innerHTML = html || '<div class="vacio">Cargando…</div>';
    ov.classList.add('open'); ov.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    return mb;
  }
  function cerrar() { const ov = $('kaf-ov'); if (ov) ov.classList.remove('open'); document.body.style.overflow = ''; if (cerrar.despues) { const f = cerrar.despues; cerrar.despues = null; f(); } }

  // ── Clientes ───────────────────────────────────────────────────────────────
  async function clientes(forzar) {
    if (K.clientes && !forzar) return K.clientes;
    const d = await get('clientes');
    if (d.sinPerfil) { K.clientes = { clientes: [], sinPerfil: true }; return K.clientes; }
    K.clientes = d; K.plata = !!d.plata;
    return d;
  }
  const t5Cuenta = t5 => { if (!t5) return null; const ks = Object.keys(t5); return { si: ks.filter(k => t5[k]).length, tot: ks.length }; };
  function chipsCliente(c) {
    const ch = [];
    if (c.u12 > 0) ch.push(`<span class="chip verde">${num(c.u12)} u. en 12 meses</span>`);
    else if (c.ult) ch.push(`<span class="chip ambar">Devolvió más de lo que compró en 12 meses</span>`);
    else ch.push(`<span class="chip rojo">Sin compras de ${esc((K.perfil || {}).marca || 'la marca')} en 12 meses</span>`);
    if (c.ult) ch.push(`<span class="chip gris">Última compra ${fecha(c.ult)}</span>`);
    const t = t5Cuenta(c.t5); if (t) ch.push(`<span class="chip ${t.si === t.tot ? 'verde' : 'oro'}">5T ${t.si}/${t.tot}</span>`);
    if (c.acu) ch.push(`<span class="chip">${c.acu} acuerdo${c.acu > 1 ? 's' : ''} Campari</span>`);
    if (c.op && c.op.length) ch.push(`<span class="chip ambar">${c.op.length} oportunidad${c.op.length > 1 ? 'es' : ''}</span>`);
    if (c.vis) ch.push(`<span class="chip ${hoy() === isoLocal(new Date(c.vis)) ? 'verde' : 'gris'}">${hoy() === isoLocal(new Date(c.vis)) ? 'Visitado hoy' : 'Visitado ' + fecha(c.vis)}</span>`);
    if (c.obj && c.obj.p) ch.push(`<span class="chip oro">Objetivo pendiente</span>`);
    if (c.obj && c.obj.l && !c.obj.p) ch.push(`<span class="chip verde">Objetivo logrado</span>`);
    return ch.join('');
  }
  const EST_CLI = { tab: '', filtro: '', q: '', orden: 'nombre', max: 150 };
  async function renderClientes(el) {
    el.innerHTML = '<div class="vacio">Cargando los clientes y lo que compran de la marca… (la primera vez tarda unos segundos)</div>';
    let d;
    try { d = await clientes(); } catch (e) { el.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    if (d.sinPerfil) { el.innerHTML = sinPerfilHtml(); return; }
    const P = d.perfil || {};
    const tipos = P.tipos || [];
    const pinta = () => {
      const q = EST_CLI.q.trim().toLowerCase();
      let l = d.clientes.filter(c => (!EST_CLI.tab || c.t === EST_CLI.tab));
      const porTipo = {}; d.clientes.forEach(c => { porTipo[c.t] = (porTipo[c.t] || 0) + 1; });
      if (EST_CLI.filtro === 'baja') l = l.filter(c => (c.op || []).some(o => ['perdido', 'baja', 'dejo'].includes(o.k)));
      if (EST_CLI.filtro === 'sin') l = l.filter(c => !c.ult);
      if (EST_CLI.filtro === 'novis') l = l.filter(c => !c.visMes);
      if (EST_CLI.filtro === 'vis') l = l.filter(c => c.visMes);
      if (EST_CLI.filtro === 'obj') l = l.filter(c => c.obj);
      if (EST_CLI.filtro === 't5') l = l.filter(c => { const t = t5Cuenta(c.t5); return t && t.si < t.tot; });
      if (q) l = l.filter(c => [c.n, c.c, c.v, c.d].join(' ').toLowerCase().includes(q));
      const ord = {
        nombre: (a, b) => a.n.localeCompare(b.n),
        sin: (a, b) => (a.ult || '0') < (b.ult || '0') ? -1 : 1,
        u12: (a, b) => b.u12 - a.u12,
        op: (a, b) => (b.op || []).length - (a.op || []).length || b.u12 - a.u12,
      }[EST_CLI.orden] || ((a, b) => a.n.localeCompare(b.n));
      l.sort(ord);
      el.querySelector('#kc-tabs').innerHTML = `<button data-t="" class="${!EST_CLI.tab ? 'on' : ''}">Todos<span class="n">${d.clientes.length}</span></button>`
        + tipos.map(t => `<button data-t="${esc(t)}" class="${EST_CLI.tab === t ? 'on' : ''}">${esc(TIPO[t] || t)}<span class="n">${porTipo[t] || 0}</span></button>`).join('');
      el.querySelector('#kc-cuenta').textContent = l.length + (l.length === 1 ? ' cliente' : ' clientes') + ' · datos de CUBO' + (d.hayT5 ? ' y del Plan Campari 5T' : '');
      el.querySelector('#kc-lista').innerHTML = !l.length ? '<div class="vacio">No hay clientes con ese filtro.</div>'
        : l.slice(0, EST_CLI.max).map(c => `<div class="fila click" data-c="${esc(c.c)}">
            <div class="cuerpo"><div class="tit">${esc(c.n)} <small style="color:var(--muted);font-weight:500">${esc(c.c)}</small></div>
              <div class="sub">${esc(TIPO1[c.t] || c.t)}${c.v ? ' · Vendedor: ' + esc(c.v) : ''}${c.d ? ' · ' + esc(c.d) : ''}</div>
              <div class="chips">${chipsCliente(c)}</div></div>
            ${K.plata && c.i12 ? `<div class="der"><b style="color:var(--ink);font-size:14px">${plata(c.i12)}</b><br>en 12 meses</div>` : ''}
          </div>`).join('') + (l.length > EST_CLI.max ? `<div style="text-align:center;margin-top:12px"><button class="btn claro" id="kc-mas">Mostrar ${Math.min(150, l.length - EST_CLI.max)} más</button></div>` : '');
      const mas = el.querySelector('#kc-mas'); if (mas) mas.onclick = () => { EST_CLI.max += 150; pinta(); };
      el._lista = l;
    };
    el.innerHTML = `<div class="barra"><div class="tabs" id="kc-tabs"></div></div>
      <div class="barra">
        <select id="kc-filtro" aria-label="Filtro">
          <option value="">Todos</option><option value="baja">Bajaron o dejaron de comprar</option><option value="sin">Sin compras de ${esc(P.marca)} (12 meses)</option>
          <option value="novis">Sin visitar este mes</option><option value="vis">Visitados este mes</option><option value="obj">Con objetivo este mes</option>
          ${d.hayT5 ? '<option value="t5">Les falta algo del Plan 5T</option>' : ''}
        </select>
        <select id="kc-orden" aria-label="Orden"><option value="nombre">Por nombre</option><option value="op">Más oportunidades</option><option value="u12">Más unidades</option><option value="sin">Más tiempo sin comprar</option></select>
        <input type="search" id="kc-q" placeholder="Buscar cliente, código o vendedor…" autocomplete="off">
        <button class="btn claro chico" id="kc-csv" title="Cuadro de oportunidades en Excel">Bajar el cuadro</button>
      </div>
      <div class="cuenta" id="kc-cuenta"></div><div id="kc-lista"></div>`;
    el.querySelector('#kc-filtro').value = EST_CLI.filtro; el.querySelector('#kc-orden').value = EST_CLI.orden; el.querySelector('#kc-q').value = EST_CLI.q;
    el.querySelector('#kc-tabs').onclick = e => { const b = e.target.closest('button[data-t]'); if (!b) return; EST_CLI.tab = b.dataset.t; EST_CLI.max = 150; pinta(); };
    el.querySelector('#kc-filtro').onchange = e => { EST_CLI.filtro = e.target.value; EST_CLI.max = 150; pinta(); };
    el.querySelector('#kc-orden').onchange = e => { EST_CLI.orden = e.target.value; pinta(); };
    el.querySelector('#kc-q').oninput = e => { EST_CLI.q = e.target.value; EST_CLI.max = 150; pinta(); };
    el.querySelector('#kc-lista').onclick = e => { const f = e.target.closest('[data-c]'); if (f) abrirFicha(f.dataset.c); };
    el.querySelector('#kc-csv').onclick = () => {
      const cab = ['Código', 'Cliente', 'Tipo', 'Vendedor', 'Dirección', 'Unidades 12 meses'].concat(K.plata ? ['Importe 12 meses'] : []).concat(['Última compra', 'Marcas que compra'], d.hayT5 ? ['Plan 5T'] : [], ['Oportunidades', 'Última visita KAF']);
      csv('cuadro-oportunidades-' + (P.marca || 'kaf').toLowerCase() + '-' + hoy() + '.csv', [cab].concat((el._lista || d.clientes).map(c => {
        const t = t5Cuenta(c.t5);
        return [c.c, c.n, TIPO1[c.t] || c.t, c.v, c.d, c.u12].concat(K.plata ? [c.i12] : []).concat([c.ult ? fecha(c.ult) : '', (c.m || []).map(x => x.m + ' ' + x.u).join(', ')], d.hayT5 ? [t ? t.si + '/' + t.tot : ''] : [], [(c.op || []).map(o => o.t).join(' | '), c.vis ? fecha(c.vis) : '']);
      })));
    };
    pinta();
  }

  // Ficha del cliente: lo que compra, 5T, acuerdos, visitas, objetivos y acciones.
  async function abrirFicha(codigo) {
    const c0 = K.clientes && K.clientes.clientes.find(x => x.c === codigo);
    const mb = ventana(c0 ? c0.n : 'Cliente', c0 ? [c0.c, TIPO1[c0.t] || c0.t, c0.v ? 'Vendedor: ' + c0.v : ''].filter(Boolean).join(' · ') : '');
    let d;
    try { d = await get('cliente', { codigo }); } catch (e) { mb.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    const c = d.cliente, P = (K.clientes && K.clientes.perfil) || K.perfil || {};
    const mes = mesDe(hoy());
    const objs = d.objetivos || [];
    const visitaHtml = esKaf() ? `<div class="bloque"><h4>Visita</h4>
        <button class="btn ok grande" id="kf-marcar">Marcar visita ahora</button>
        <details style="margin-top:10px"><summary class="lnk" style="display:inline">La visita fue en otro horario o quiero dejar una nota</summary>
          <div class="dos" style="margin-top:10px"><label class="campo"><span>Día y hora</span><input type="datetime-local" id="kf-cuando" max="${hoy()}T23:59"></label>
          <label class="campo"><span>Nota (opcional)</span><input id="kf-nota" maxlength="500" placeholder="Qué se habló, con quién…"></label></div>
          <button class="btn navy" id="kf-marcar2">Marcar con este horario</button>
        </details>
        <div id="kf-vis" style="margin-top:12px"></div></div>` : `<div class="bloque"><h4>Visitas del KAF</h4><div id="kf-vis"></div></div>`;
    const pintaVis = () => {
      const v = d.visitas || [];
      mb.querySelector('#kf-vis').innerHTML = !v.length ? '<div style="font-size:13px;color:var(--muted)">Todavía no hay visitas marcadas a este cliente.</div>'
        : v.slice(0, 8).map(x => `<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line2);font-size:13.5px">
            <b style="min-width:120px">${esc(dia(x.fecha))} ${hora(x.fecha)}</b><span style="flex:1;color:var(--muted)">${esc(x.nota || '')}</span>
            ${esKaf() && Date.now() - new Date(x.registrada_at) < 864e5 ? `<button class="lnk" data-borrar-vis="${esc(x.id)}">Borrar</button>` : ''}</div>`).join('')
          + (v.length > 8 ? `<div style="font-size:12.5px;color:var(--muted);margin-top:4px">y ${v.length - 8} más</div>` : '');
    };
    const objHtml = () => `<div class="bloque"><h4>Objetivos</h4>${!objs.length ? '<div style="font-size:13px;color:var(--muted)">Trade Marketing no le cargó objetivos a este cliente.</div>'
      : objs.map(o => `<div style="padding:8px 0;border-top:1px solid var(--line2)">
          <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap"><b style="flex:1;font-size:14px">${esc(o.objetivo)}</b><span class="estado e-${esc(o.estado)}">${esc(ESTADO_OBJ[o.estado] || o.estado)}</span></div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(mesNombre(o.mes))}${o.creado_por ? ' · lo cargó ' + esc(o.creado_por) : ''}${o.nota_kaf ? ' · Nota: ' + esc(o.nota_kaf) : ''}</div>
          ${esKaf() && o.mes === mes ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <button class="btn ok chico" data-obj="${esc(o.id)}" data-est="logrado">Logrado</button>
              <button class="btn rojo chico" data-obj="${esc(o.id)}" data-est="no_logrado">No se logró</button>
              ${o.estado !== 'pendiente' ? `<button class="btn claro chico" data-obj="${esc(o.id)}" data-est="pendiente">Volver a pendiente</button>` : ''}</div>` : ''}
          ${!esKaf() ? `<button class="lnk" data-borrar-obj="${esc(o.id)}" style="margin-top:4px">Sacar este objetivo</button>` : ''}
        </div>`).join('')}
        ${!esKaf() ? `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input id="kf-obj" maxlength="300" placeholder="Nuevo objetivo para ${esc(mesNombre(mes).split(' ')[0].toLowerCase())}: ej. sumar Aperol en carta" style="flex:1;min-width:200px;border:1px solid var(--line);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px"><button class="btn navy" id="kf-obj-ok">Agregar objetivo</button></div>` : ''}</div>`;
    const marcas = c.m || [];
    const meses = d.meses || [];
    const t5 = c.t5;
    mb.innerHTML = `${visitaHtml}
      <div id="kf-objs">${objHtml()}</div>
      <div class="bloque"><h4>Oportunidades</h4>${c.op && c.op.length ? `<ul class="ops">${c.op.map(o => `<li>${esc(o.t)}</li>`).join('')}</ul>` : '<div style="font-size:13px;color:var(--muted)">No encontramos oportunidades con los datos de CUBO: compra seguido y de todas las marcas foco.</div>'}</div>
      <div class="bloque"><h4>Qué compra de ${esc(P.marca || 'la marca')} (últimos 12 meses)</h4>
        ${!marcas.length ? '<div style="font-size:13px;color:var(--muted)">No compró en los últimos 12 meses' + (c.pri ? ' (la última vez fue antes)' : ' (no hay compras desde enero 2025)') + '.</div>' : `
        <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Marca</th><th class="n">Unidades</th>${d.plata ? '<th class="n">Importe</th>' : ''}<th>Última compra</th><th class="n">Meses con compra</th></tr></thead><tbody>
        ${marcas.map(x => `<tr><td>${esc(x.m)}</td><td class="n">${num(x.u)}</td>${d.plata ? `<td class="n">${plata(x.imp)}</td>` : ''}<td>${x.ult ? fecha(x.ult) : '—'}</td><td class="n">${x.meses}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="tabla-wrap" style="margin-top:10px"><table class="tabla"><thead><tr><th>Unidades por mes</th>${meses.map(m => `<th class="n">${esc(mesCorto(m))}</th>`).join('')}</tr></thead><tbody>
        ${marcas.map(x => `<tr><td>${esc(x.m)}</td>${meses.map(m => { const u = ((d.porMes || {})[x.m] || {})[m]; return `<td class="n">${u ? num(u) : ''}</td>`; }).join('')}</tr>`).join('')}
        </tbody></table></div>`}
        <div style="font-size:12px;color:var(--muted);margin-top:8px">Fuente: facturas de CUBO a GrandBar${c.pri ? ' · primera compra de la marca desde enero 2025: ' + fecha(c.pri) : ''}.</div></div>
      ${t5 ? `<div class="bloque"><h4>Plan Campari 5T</h4><div class="t5">${(d.marcas5t || []).filter(([k]) => k in t5).map(([k, n]) => `<span class="${t5[k] ? '' : 'no'}">${esc(n)}</span>`).join('')}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:6px">De la planilla del Plan 5T (Drive). Tachado = no tiene la marca.</div></div>` : ''}
      ${(d.acuerdos || []).length ? `<div class="bloque"><h4>Acuerdos Campari</h4><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Producto</th><th>Calibre</th><th>Condición</th><th>Mínimo</th><th>Tope s/cargo</th><th>Visibilidad</th></tr></thead><tbody>
        ${d.acuerdos.map(a => `<tr><td>${esc(a.producto)}</td><td>${esc(a.calibre)}</td><td>${esc(a.condicion)}</td><td>${esc(a.minimo)}</td><td>${esc(a.tope)}</td><td>${esc(a.visibilidad)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${esKaf() ? `<div class="bloque"><h4>Cargar en este cliente</h4><div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['evidencia', 'perfect_serve', 'perfect_store', 'capacitacion', 'presupuesto'].filter(secc).map(k => `<button class="btn claro" data-cargar="${k}">${esc(secc(k).t)}</button>`).join('')}
          ${secc('materiales') ? '<button class="btn claro" data-materiales>Pedir materiales</button>' : ''}</div></div>` : ''}
      ${(d.registros || []).length ? `<div class="bloque"><h4>Lo cargado en este cliente</h4>${d.registros.slice(0, 10).map(r => `<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--line2);font-size:13.5px;align-items:center;flex-wrap:wrap">
          <b>${esc((REG[r.tipo] || {}).n || r.tipo)}</b><span style="color:var(--muted)">${fecha(r.fecha)} · ${esc(resumenDatos(r))}</span><span class="estado e-${esc(r.estado)}" style="margin-left:auto">${esc(ESTADO[r.estado] || r.estado)}</span></div>`).join('')}</div>` : ''}`;
    pintaVis();
    const marcar = async (cuando, nota, btn) => {
      btn.disabled = true;
      try {
        const r = await post({ accion: 'visita', codigo, cuando: cuando || undefined, nota: nota || undefined });
        if (r.repetida) toast('Ya estaba marcada (' + hora(r.visita.fecha) + ').');
        else { toast('Visita marcada: ' + diaLargo(isoLocal(new Date(r.visita.fecha))) + ' ' + hora(r.visita.fecha)); d.visitas = [r.visita].concat(d.visitas || []); pintaVis(); }
        if (K.clientes) { const cc = K.clientes.clientes.find(x => x.c === codigo); if (cc) { cc.vis = r.visita.fecha; cc.visMes = (cc.visMes || 0) + (r.repetida ? 0 : 1); } }
        cerrar.despues = K.alCambiar || null;
      } catch (e) { toast(e.message, true); }
      btn.disabled = false;
    };
    if (esKaf()) {
      mb.querySelector('#kf-marcar').onclick = e => marcar(null, mb.querySelector('#kf-nota').value.trim(), e.currentTarget);
      mb.querySelector('#kf-marcar2').onclick = e => {
        const v = mb.querySelector('#kf-cuando').value;
        if (!v) { toast('Elegí el día y la hora.', true); return; }
        marcar(new Date(v).toISOString(), mb.querySelector('#kf-nota').value.trim(), e.currentTarget);
      };
    }
    mb.onclick = async e => {
      const bv = e.target.closest('[data-borrar-vis]');
      if (bv) {
        if (!confirm('¿Borrar esta visita?')) return;
        try { await post({ accion: 'borrar_visita', id: bv.dataset.borrarVis }); d.visitas = d.visitas.filter(x => x.id !== bv.dataset.borrarVis); pintaVis(); toast('Visita borrada'); cerrar.despues = K.alCambiar || null; K.clientes = null; }
        catch (er) { toast(er.message, true); }
        return;
      }
      const bo = e.target.closest('[data-obj]');
      if (bo) {
        const nota = bo.dataset.est === 'pendiente' ? '' : (prompt('Nota para Trade Marketing (opcional):') || '');
        try { await post({ accion: 'objetivo_estado', id: bo.dataset.obj, estado: bo.dataset.est, nota }); const o = objs.find(x => x.id === bo.dataset.obj); if (o) { o.estado = bo.dataset.est; o.nota_kaf = nota || null; } mb.querySelector('#kf-objs').innerHTML = objHtml(); toast('Listo'); cerrar.despues = K.alCambiar || null; }
        catch (er) { toast(er.message, true); }
        return;
      }
      const bb = e.target.closest('[data-borrar-obj]');
      if (bb) {
        if (!confirm('¿Sacar este objetivo?')) return;
        try { await post({ accion: 'borrar_objetivo_cliente', id: bb.dataset.borrarObj }); objs.splice(objs.findIndex(x => x.id === bb.dataset.borrarObj), 1); mb.querySelector('#kf-objs').innerHTML = objHtml(); K.clientes = null; }
        catch (er) { toast(er.message, true); }
        return;
      }
      if (e.target.closest('#kf-obj-ok')) {
        const inp = mb.querySelector('#kf-obj'), txt = inp.value.trim();
        if (!txt) { inp.focus(); return; }
        try { const r = await post({ accion: 'objetivo_cliente', mes, codigo, objetivo: txt }); objs.unshift({ id: r.id, mes, objetivo: txt, estado: 'pendiente', creado_por: 'vos' }); mb.querySelector('#kf-objs').innerHTML = objHtml(); toast('Objetivo cargado: le llega el aviso al KAF'); K.clientes = null; cerrar.despues = K.alCambiar || null; }
        catch (er) { toast(er.message, true); }
        return;
      }
      const bc = e.target.closest('[data-cargar]');
      if (bc) { formRegistro(bc.dataset.cargar, { c: codigo, n: c.n }); return; }
      if (e.target.closest('[data-materiales]')) { cerrar(); if (K.alPedirMateriales) K.alPedirMateriales({ c: codigo, n: c.n }); }
    };
  }

  // ── Elegir un cliente (buscador) ───────────────────────────────────────────
  function picker(cont, elegido, opcional, onCambio) {
    let sel = elegido || null;
    const pinta = () => {
      if (sel) {
        cont.innerHTML = `<div class="elegido"><span>${esc(sel.n)} <small style="color:var(--muted);font-weight:500">${esc(sel.c)}</small></span><button type="button" class="lnk">Cambiar</button></div>`;
        cont.querySelector('button').onclick = () => { sel = null; pinta(); if (onCambio) onCambio(null); };
        return;
      }
      cont.innerHTML = `<div class="picker"><input type="search" placeholder="${opcional ? 'Buscar cliente (opcional)…' : 'Buscar cliente por nombre o código…'}" autocomplete="off" style="width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 11px;font:inherit;font-size:15px"><div class="res" style="display:none"></div></div>`;
      const inp = cont.querySelector('input'), res = cont.querySelector('.res');
      inp.oninput = async () => {
        const q = inp.value.trim().toLowerCase();
        if (q.length < 2) { res.style.display = 'none'; return; }
        let d; try { d = await clientes(); } catch (e) { res.innerHTML = `<div style="padding:10px">${esc(e.message)}</div>`; res.style.display = ''; return; }
        const l = d.clientes.filter(c => (c.n + ' ' + c.c).toLowerCase().includes(q)).slice(0, 30);
        res.innerHTML = l.length ? l.map(c => `<button type="button" data-c="${esc(c.c)}">${esc(c.n)} <small>${esc(c.c)} · ${esc(TIPO1[c.t] || c.t)}${c.v ? ' · ' + esc(c.v) : ''}</small></button>`).join('') : '<div style="padding:10px;color:var(--muted)">No encontré clientes.</div>';
        res.style.display = '';
      };
      res.onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; const c = K.clientes.clientes.find(x => x.c === b.dataset.c); sel = { c: c.c, n: c.n }; pinta(); if (onCambio) onCambio(sel); };
    };
    pinta();
    return () => sel;
  }

  // ── Fotos: se achican en el celular antes de subir ─────────────────────────
  function leerArchivo(file) {
    return new Promise((res, rej) => {
      if (file.type === 'application/pdf') {
        if (file.size > 3.3 * 1024 * 1024) return rej(new Error('El PDF pesa más de 3 MB.'));
        const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('No se pudo leer el PDF.')); fr.readAsDataURL(file); return;
      }
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight; const max = 1400;
        if (Math.max(w, h) > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        let q = 0.82, out = cv.toDataURL('image/jpeg', q);
        while (out.length > 1.25e6 && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
        res(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer una de las fotos.')); };
      img.src = url;
    });
  }

  function resumenDatos(r) {
    const x = r.datos || {};
    if (r.tipo === 'evidencia') return [x.calificacion === 'mal' ? 'Mal ejecutado' : 'Bien ejecutado', x.marca, x.competencia ? 'Competencia' : ''].filter(Boolean).join(' · ');
    if (r.tipo === 'perfect_serve') return [x.trago, x.marca, x.cumple ? 'Cumple: ' + ({ si: 'sí', parcial: 'en parte', no: 'no' }[x.cumple]) : ''].filter(Boolean).join(' · ');
    if (r.tipo === 'perfect_store') return [x.exhibicion, x.cumple ? 'Cumple: ' + ({ si: 'sí', parcial: 'en parte', no: 'no' }[x.cumple]) : ''].filter(Boolean).join(' · ') || 'Relevamiento';
    if (r.tipo === 'capacitacion') return [x.tema, x.participantes != null ? x.participantes + ' participantes' : ''].filter(Boolean).join(' · ');
    if (r.tipo === 'presupuesto') return [x.concepto, x.monto != null ? plata(x.monto) : ''].filter(Boolean).join(' · ');
    return '';
  }
  const cumpleSel = (v) => `<div class="opciones">${[['si', 'Sí'], ['parcial', 'En parte'], ['no', 'No']].map(([k, n]) => `<label><input type="radio" name="kr-cumple" value="${k}" ${v === k ? 'checked' : ''}> ${n}</label>`).join('')}</div>`;

  // Formulario para cargar un registro (evidencia, Perfect Serve/Store, capacitación, presupuesto).
  async function formRegistro(tipo, cliente) {
    const R = REG[tipo], S = secc(tipo) || { t: R.n };
    const mb = ventana('Cargar ' + (tipo === 'evidencia' ? 'evidencia en PDV' : R.uno), S.ayuda || R.d);
    let modelos = [];
    if (tipo === 'perfect_serve' || tipo === 'perfect_store') { try { modelos = (await get('modelos', { tipo })).modelos || []; } catch (e) { modelos = []; } }
    const campos = {
      evidencia: `<label class="campo"><span>¿Cómo está?</span><div class="opciones"><label><input type="radio" name="kr-cal" value="bien"> Bien ejecutado</label><label><input type="radio" name="kr-cal" value="mal"> Mal ejecutado</label></div></label>
        <div class="dos"><label class="campo"><span>Marca</span><input id="kr-marca" maxlength="80" placeholder="Ej. Aperol"></label>
        <label class="campo"><span>&nbsp;</span><div class="opciones"><label><input type="checkbox" id="kr-comp"> Es de la competencia</label></div></label></div>
        <label class="campo"><span>Comentario</span><textarea id="kr-com" maxlength="1000" placeholder="Qué se ve, qué hay que corregir…"></textarea></label>`,
      perfect_serve: `${modelos.length ? `<label class="campo"><span>Modelo</span><select id="kr-mod"><option value="">Sin modelo</option>${modelos.map(m => `<option value="${esc(m.id)}">${esc(m.nombre)}${m.marca ? ' · ' + esc(m.marca) : ''}</option>`).join('')}</select></label>` : '<div class="aviso">Trade Marketing todavía no cargó modelos de Perfect Serve: completá lo que viste.</div>'}
        <div class="dos"><label class="campo"><span>Trago</span><input id="kr-trago" maxlength="120"></label><label class="campo"><span>Marca</span><input id="kr-marca" maxlength="80"></label></div>
        <div class="dos"><label class="campo"><span>Medida (ml)</span><input id="kr-medida" inputmode="decimal"></label><label class="campo"><span>Precio en carta ($)</span><input id="kr-precio" inputmode="decimal"></label></div>
        <div class="dos"><label class="campo"><span>Cristalería</span><input id="kr-cris" maxlength="160"></label><label class="campo"><span>Garnish</span><input id="kr-garn" maxlength="160"></label></div>
        <label class="campo"><span>¿Cumple el modelo?</span>${cumpleSel('')}</label>
        <label class="campo"><span>Comentario</span><textarea id="kr-com" maxlength="1000"></textarea></label>`,
      perfect_store: `${modelos.length ? `<label class="campo"><span>Modelo</span><select id="kr-mod"><option value="">Sin modelo</option>${modelos.map(m => `<option value="${esc(m.id)}">${esc(m.nombre)}</option>`).join('')}</select></label>` : '<div class="aviso">Trade Marketing todavía no cargó modelos de Perfect Store: completá lo que viste.</div>'}
        <label class="campo"><span>Surtido (qué productos hay)</span><textarea id="kr-surt" maxlength="1000"></textarea></label>
        <label class="campo"><span>Precios relevados</span><textarea id="kr-prec" maxlength="600" style="min-height:60px"></textarea></label>
        <label class="campo"><span>Exhibición</span><input id="kr-exh" maxlength="400" placeholder="Góndola, punta, exhibidor, heladera…"></label>
        <label class="campo"><span>¿Cumple el modelo?</span>${cumpleSel('')}</label>
        <label class="campo"><span>Comentario</span><textarea id="kr-com" maxlength="1000"></textarea></label>`,
      capacitacion: `<label class="campo"><span>Tema</span><input id="kr-tema" maxlength="200" placeholder="Ej. Aperol Spritz: receta y servicio"></label>
        <div class="dos"><label class="campo"><span>Marcas</span><input id="kr-marcas" maxlength="200"></label><label class="campo"><span>Cantidad de participantes</span><input id="kr-part" inputmode="numeric"></label></div>
        <label class="campo"><span>Participantes (nombres y puesto)</span><textarea id="kr-nombres" maxlength="1000"></textarea></label>
        <label class="campo"><span>Comentario</span><textarea id="kr-com" maxlength="1000"></textarea></label>`,
      presupuesto: `<label class="campo"><span>Concepto</span><input id="kr-conc" maxlength="200" placeholder="Ej. Barra Aperol para la terraza"></label>
        <label class="campo"><span>Monto ($)</span><input id="kr-monto" inputmode="decimal"></label>
        <label class="campo"><span>Detalle de la propuesta</span><textarea id="kr-desc" maxlength="2000"></textarea></label>`,
    }[tipo];
    mb.innerHTML = `<label class="campo"><span>Cliente${tipo === 'capacitacion' ? ' (opcional)' : ''}</span><div id="kr-cli"></div></label>
      <label class="campo"><span>Fecha</span><input type="date" id="kr-fecha" value="${hoy()}" max="${hoy()}" min="${sumaDias(hoy(), -60)}"></label>
      ${campos}
      <label class="campo"><span>${tipo === 'presupuesto' ? 'Fotos o PDF (hasta 4)' : 'Fotos (hasta 4)'}${tipo === 'evidencia' ? ' — al menos una' : ''}</span>
        <input type="file" id="kr-fotos" accept="image/*${tipo === 'presupuesto' ? ',application/pdf' : ''}" multiple></label>
      <div class="fotos" id="kr-prev"></div>
      <div class="msg" id="kr-msg"></div>
      <div class="acts"><button class="btn claro" type="button" id="kr-cancel">Cancelar</button><button class="btn ok" type="button" id="kr-ok">Guardar</button></div>`;
    const elegido = picker(mb.querySelector('#kr-cli'), cliente || null, tipo === 'capacitacion');
    let archivos = [];
    mb.querySelector('#kr-fotos').onchange = async e => {
      const fs = [...e.target.files].slice(0, 4 - archivos.length);
      for (const f of fs) { try { archivos.push(await leerArchivo(f)); } catch (er) { toast(er.message, true); } }
      e.target.value = '';
      pintaPrev();
    };
    const pintaPrev = () => {
      mb.querySelector('#kr-prev').innerHTML = archivos.map((a, i) => `<a href="#" data-q="${i}" title="Sacar">${a.startsWith('data:application/pdf') ? 'PDF' : `<img src="${a}" alt="">`}</a>`).join('');
    };
    mb.querySelector('#kr-prev').onclick = e => { const a = e.target.closest('[data-q]'); if (!a) return; e.preventDefault(); archivos.splice(Number(a.dataset.q), 1); pintaPrev(); };
    const sel = mb.querySelector('#kr-mod');
    if (sel) sel.onchange = () => {
      const m = modelos.find(x => x.id === sel.value); if (!m || tipo !== 'perfect_serve') return;
      const x = m.datos || {};
      const set = (id, v) => { const i = mb.querySelector(id); if (i && !i.value && v != null) i.value = v; };
      set('#kr-trago', x.trago || m.nombre); set('#kr-marca', m.marca !== 'Todas' ? m.marca : ''); set('#kr-medida', x.medida_ml); set('#kr-cris', x.cristaleria); set('#kr-garn', x.garnish);
    };
    mb.querySelector('#kr-cancel').onclick = cerrar;
    mb.querySelector('#kr-ok').onclick = async ev => {
      const btn = ev.currentTarget;
      const v = id => { const i = mb.querySelector(id); return i ? i.value.trim() : ''; };
      const radio = n => { const i = mb.querySelector('input[name="' + n + '"]:checked'); return i ? i.value : ''; };
      const datos = {
        evidencia: () => ({ calificacion: radio('kr-cal'), marca: v('#kr-marca'), competencia: mb.querySelector('#kr-comp').checked, comentario: v('#kr-com') }),
        perfect_serve: () => ({ modelo_id: v('#kr-mod'), trago: v('#kr-trago'), marca: v('#kr-marca'), medida_ml: v('#kr-medida'), precio_carta: v('#kr-precio'), cristaleria: v('#kr-cris'), garnish: v('#kr-garn'), cumple: radio('kr-cumple'), comentario: v('#kr-com') }),
        perfect_store: () => ({ modelo_id: v('#kr-mod'), surtido: v('#kr-surt'), precios: v('#kr-prec'), exhibicion: v('#kr-exh'), cumple: radio('kr-cumple'), comentario: v('#kr-com') }),
        capacitacion: () => ({ tema: v('#kr-tema'), marcas: v('#kr-marcas'), participantes: v('#kr-part'), nombres: v('#kr-nombres'), comentario: v('#kr-com') }),
        presupuesto: () => ({ concepto: v('#kr-conc'), monto: v('#kr-monto'), descripcion: v('#kr-desc') }),
      }[tipo]();
      const c = elegido();
      const msg = mb.querySelector('#kr-msg'); msg.textContent = '';
      if (!c && tipo !== 'capacitacion') { msg.textContent = 'Elegí el cliente.'; return; }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await post({ accion: 'registro', tipo, codigo: c ? c.c : null, fecha: v('#kr-fecha'), datos, fotos: archivos });
        toast(tipo === 'presupuesto' ? 'Presupuesto enviado: Trade Marketing lo aprueba o lo rechaza.' : 'Guardado: le llega a Trade Marketing.');
        cerrar.despues = K.alCambiar || null; cerrar();
      } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Guardar'; }
    };
  }

  // ── Registros (lista) ──────────────────────────────────────────────────────
  async function renderRegistros(el, tipo) {
    const R = REG[tipo] || { n: 'Todo lo cargado', d: '' };
    const S = tipo ? secc(tipo) : null;
    el.innerHTML = '<div class="vacio">Cargando…</div>';
    let d, modelos = [];
    try {
      [d, modelos] = await Promise.all([get('registros', tipo ? { tipo } : {}), (tipo === 'perfect_serve' || tipo === 'perfect_store') ? get('modelos', { tipo }).then(x => x.modelos || []).catch(() => []) : []]);
    } catch (e) { el.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    if (d.sinPerfil) { el.innerHTML = sinPerfilHtml(); return; }
    const regs = d.registros || [];
    const mods = modelos.length ? `<h2>Modelos de Trade Marketing <small>${modelos.length}</small></h2><div class="grid-mat">${modelos.map(m => modeloHtml(m)).join('')}</div><h2>${esKaf() ? 'Lo que cargaste' : 'Lo que cargó'}</h2>` : '';
    const cab = esKaf() ? `${S && S.ayuda ? `<div class="ayuda">${esc(S.ayuda)}</div>` : ''}<div class="barra"><button class="btn ok" id="kr-nuevo">Cargar ${esc(tipo === 'evidencia' ? 'evidencia' : R.uno)}</button></div>` : '';
    const item = r => {
      const x = r.datos || {};
      const filas = {
        evidencia: [['Cómo está', x.calificacion === 'mal' ? 'Mal ejecutado' : x.calificacion === 'bien' ? 'Bien ejecutado' : ''], ['Marca', (x.marca || '') + (x.competencia ? ' (competencia)' : '')]],
        perfect_serve: [['Modelo', (modelos.find(m => m.id === x.modelo_id) || {}).nombre], ['Trago', x.trago], ['Marca', x.marca], ['Medida', x.medida_ml != null ? x.medida_ml + ' ml' : ''], ['Cristalería', x.cristaleria], ['Garnish', x.garnish], ['Precio en carta', x.precio_carta != null ? plata(x.precio_carta) : ''], ['Cumple', { si: 'Sí', parcial: 'En parte', no: 'No' }[x.cumple]]],
        perfect_store: [['Modelo', (modelos.find(m => m.id === x.modelo_id) || {}).nombre], ['Surtido', x.surtido], ['Precios', x.precios], ['Exhibición', x.exhibicion], ['Cumple', { si: 'Sí', parcial: 'En parte', no: 'No' }[x.cumple]]],
        capacitacion: [['Tema', x.tema], ['Marcas', x.marcas], ['Participantes', [x.participantes, x.nombres].filter(v => v != null && v !== '').join(' · ')]],
        presupuesto: [['Concepto', x.concepto], ['Monto', x.monto != null ? plata(x.monto) : ''], ['Detalle', x.descripcion]],
      }[r.tipo] || [];
      const acciones = esKaf()
        ? (['nuevo', 'pendiente'].includes(r.estado) ? `<button class="lnk" data-borrar="${esc(r.id)}">Borrar</button>` : '')
        : (r.tipo === 'presupuesto'
          ? (r.estado === 'pendiente' ? `<button class="btn ok chico" data-rev="${esc(r.id)}" data-est="aprobado">Aprobar</button><button class="btn rojo chico" data-rev="${esc(r.id)}" data-est="rechazado">Rechazar</button>` : `<button class="btn claro chico" data-rev="${esc(r.id)}" data-est="pendiente">Volver a para aprobar</button>`)
          : (r.estado === 'nuevo' ? `<button class="btn ok chico" data-rev="${esc(r.id)}" data-est="visto">Marcar visto</button><button class="btn claro chico" data-rev="${esc(r.id)}" data-est="visto" data-com="1">Comentar</button>` : `<button class="btn claro chico" data-rev="${esc(r.id)}" data-est="visto" data-com="1">Comentar</button><button class="btn claro chico" data-rev="${esc(r.id)}" data-est="nuevo">Volver a nuevo</button>`));
      return `<div class="fila"><div class="cuerpo">
          <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap"><div class="tit" style="flex:1">${!tipo ? esc(REG[r.tipo].n) + ' · ' : ''}${esc(r.cliente_nombre || 'Sin cliente')} <small style="color:var(--muted);font-weight:500">${esc(r.cliente_codigo || '')}</small></div><span class="estado e-${esc(r.estado)}">${esc(ESTADO[r.estado] || r.estado)}</span></div>
          <div class="sub">${esc(diaLargo(r.fecha))} · cargado ${fecha(r.created_at)} ${hora(r.created_at)}</div>
          ${filas.filter(([, v]) => v).map(([k, v]) => `<div style="font-size:13.5px;margin-top:4px"><span style="color:var(--muted)">${esc(k)}:</span> ${esc(v)}</div>`).join('')}
          ${x.comentario ? `<div style="font-size:13.5px;margin-top:6px;white-space:pre-wrap;background:var(--cream);border-radius:9px;padding:8px 10px">${esc(x.comentario)}</div>` : ''}
          ${(r.fotos_url || []).length ? `<div class="fotos">${r.fotos_url.map((f, i) => f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener" title="Abrir">${f.pdf ? 'PDF' : `<img src="${esc(f.url)}" alt="Foto ${i + 1}" loading="lazy">`}</a>` : '').join('')}</div>` : ''}
          ${r.revision ? `<div style="font-size:13.5px;margin-top:8px;background:var(--green-s);border-left:3px solid var(--green);border-radius:0 9px 9px 0;padding:8px 10px;white-space:pre-wrap"><b>${esc(r.revisado_por || 'Trade Marketing')}:</b> ${esc(r.revision)}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center">${acciones}</div>
        </div></div>`;
    };
    el.innerHTML = cab + mods + (regs.length ? regs.map(item).join('') : `<div class="vacio">${esKaf() ? 'Todavía no cargaste nada en esta sección.' : 'El KAF todavía no cargó nada en esta sección.'}</div>`);
    const nuevo = el.querySelector('#kr-nuevo'); if (nuevo) nuevo.onclick = () => formRegistro(tipo, null);
    el.onclick = async e => {
      const b = e.target.closest('[data-borrar]');
      if (b) { if (!confirm('¿Borrar lo que cargaste?')) return; try { await post({ accion: 'borrar_registro', id: b.dataset.borrar }); toast('Borrado'); renderRegistros(el, tipo); } catch (er) { toast(er.message, true); } return; }
      const rv = e.target.closest('[data-rev]');
      if (rv) {
        let revision = '';
        if (rv.dataset.com || rv.dataset.est === 'rechazado' || rv.dataset.est === 'aprobado') {
          revision = prompt(rv.dataset.est === 'rechazado' ? '¿Por qué no se aprueba? (le llega al KAF)' : 'Comentario para el KAF' + (rv.dataset.est === 'aprobado' ? ' (opcional)' : '') + ':') ;
          if (revision === null) return;
          if (rv.dataset.est === 'rechazado' && !revision.trim()) { toast('Contale por qué no se aprueba.', true); return; }
        }
        rv.disabled = true;
        try { await post({ accion: 'revisar', id: rv.dataset.rev, estado: rv.dataset.est, revision }); toast('Listo'); renderRegistros(el, tipo); if (K.alCambiar) K.alCambiar(); }
        catch (er) { rv.disabled = false; toast(er.message, true); }
      }
    };
  }
  function modeloHtml(m) {
    const x = m.datos || {};
    const costo = x.precio_botella && x.ml_botella && x.medida_ml ? x.precio_botella / x.ml_botella * x.medida_ml : null;
    const filas = m.tipo === 'perfect_serve'
      ? [['Receta', x.receta], ['Medida', x.medida_ml ? x.medida_ml + ' ml' : ''], ['Cristalería', x.cristaleria], ['Garnish', x.garnish], ['Costo por medida', costo ? plata(costo) + ' (botella ' + plata(x.precio_botella) + ' / ' + num(x.ml_botella) + ' ml)' : ''], ['Precio sugerido', x.precio_sugerido ? plata(x.precio_sugerido) : '']]
      : [['Surtido', x.surtido], ['Precio sugerido', x.precio_sugerido], ['Exhibición', x.exhibicion]];
    return `<div class="mat">${m.foto_url ? `<div class="img"><img src="${esc(m.foto_url)}" alt="" loading="lazy"></div>` : ''}<div class="in">
        <div class="nom">${esc(m.nombre)}</div><div class="meta">${esc(m.marca || '')}${m.activo === false ? ' · inactivo' : ''}</div>
        ${filas.filter(([, v]) => v).map(([k, v]) => `<div style="font-size:12.5px;margin-top:3px;white-space:pre-wrap"><span style="color:var(--muted)">${esc(k)}:</span> ${esc(v)}</div>`).join('')}
      </div></div>`;
  }

  // ── Visitas ────────────────────────────────────────────────────────────────
  const EST_VIS = { rango: 'semana', desde: '', hasta: '' };
  function rango() {
    const h = hoy();
    if (EST_VIS.rango === 'semana') return [lunes(h), h];
    if (EST_VIS.rango === 'semana_pasada') { const l = sumaDias(lunes(h), -7); return [l, sumaDias(l, 6)]; }
    if (EST_VIS.rango === 'mes') return [mesDe(h) + '-01', h];
    if (EST_VIS.rango === 'mes_pasado') { const m = mesMenos(mesDe(h), 1); const [y, mm] = m.split('-').map(Number); return [m + '-01', isoLocal(new Date(y, mm, 0))]; }
    return [EST_VIS.desde || lunes(h), EST_VIS.hasta || h];
  }
  async function renderVisitas(el) {
    const [desde, hasta] = rango();
    el.innerHTML = `<div class="barra">
        <select id="kv-rango"><option value="semana">Esta semana</option><option value="semana_pasada">Semana pasada</option><option value="mes">Este mes</option><option value="mes_pasado">Mes pasado</option><option value="otro">Otras fechas</option></select>
        <span id="kv-otro" style="display:${EST_VIS.rango === 'otro' ? 'contents' : 'none'}"><input type="date" id="kv-desde" value="${desde}"><input type="date" id="kv-hasta" value="${hasta}"></span>
        <button class="btn claro chico" id="kv-csv">Bajar en Excel</button>
        ${esKaf() ? '<button class="btn ok chico" id="kv-nueva">Marcar una visita</button>' : ''}
      </div><div class="cuenta" id="kv-cuenta"></div><div id="kv-lista"><div class="vacio">Cargando…</div></div>`;
    el.querySelector('#kv-rango').value = EST_VIS.rango;
    el.querySelector('#kv-rango').onchange = e => { EST_VIS.rango = e.target.value; if (e.target.value === 'otro') { EST_VIS.desde = desde; EST_VIS.hasta = hasta; } renderVisitas(el); };
    ['kv-desde', 'kv-hasta'].forEach(id => el.querySelector('#' + id).onchange = () => { EST_VIS.desde = el.querySelector('#kv-desde').value; EST_VIS.hasta = el.querySelector('#kv-hasta').value; renderVisitas(el); });
    if (esKaf()) el.querySelector('#kv-nueva').onclick = () => {
      const mb = ventana('Marcar una visita', 'Elegí el cliente: se marca con el día y la hora de ahora.');
      mb.innerHTML = '<div id="kv-pick"></div><div class="msg" id="kv-msg"></div>';
      picker(mb.querySelector('#kv-pick'), null, false, sel => { if (sel) { cerrar.despues = () => renderVisitas(el); abrirFicha(sel.c); } });
    };
    let d;
    try { d = await get('visitas', { desde, hasta }); } catch (e) { el.querySelector('#kv-lista').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    const vis = d.visitas || [];
    const obj = {}; (d.objetivos || []).forEach(o => { obj[o.mes] = o.visitas_dia; });
    const porDia = {};
    vis.forEach(v => { const k = isoLocal(new Date(v.fecha)); (porDia[k] = porDia[k] || []).push(v); });
    const dias = Object.keys(porDia).sort().reverse();
    const distintos = new Set(vis.map(v => v.cliente_codigo)).size;
    el.querySelector('#kv-cuenta').textContent = vis.length + (vis.length === 1 ? ' visita' : ' visitas') + ' · ' + distintos + ' clientes distintos · ' + dias.length + (dias.length === 1 ? ' día' : ' días') + ' con visitas';
    el.querySelector('#kv-lista').innerHTML = !dias.length ? '<div class="vacio">No hay visitas marcadas en estas fechas.</div>' : dias.map(k => {
      const l = porDia[k].sort((a, b) => a.fecha < b.fecha ? -1 : 1);
      const n = new Set(l.map(v => v.cliente_codigo)).size, o = obj[mesDe(k)];
      return `<h2>${esc(diaLargo(k))} <small>${n} cliente${n === 1 ? '' : 's'}${o ? ' · objetivo ' + o + (n >= o ? ' — cumplido' : (k === hoy() ? ' — faltan ' : ' — faltaron ') + (o - n)) : ''}</small></h2>`
        + l.map(v => {
          const tarde = new Date(v.registrada_at) - new Date(v.fecha) > 2 * 3600000;
          return `<div class="fila"><div style="font-weight:800;min-width:52px">${hora(v.fecha)}</div><div class="cuerpo"><div class="tit">${esc(v.cliente_nombre || v.cliente_codigo)} <small style="color:var(--muted);font-weight:500">${esc(v.cliente_codigo)}</small></div>
            <div class="sub">${esc(TIPO1[v.tipo_cliente] || v.tipo_cliente || '')}${v.vendedor ? ' · Vendedor: ' + esc(v.vendedor) : ''}${v.nota ? ' · ' + esc(v.nota) : ''}</div>
            ${tarde ? `<div class="chips"><span class="chip gris">Cargada después: ${fecha(v.registrada_at)} ${hora(v.registrada_at)}</span></div>` : ''}</div>
            ${esKaf() && Date.now() - new Date(v.registrada_at) < 864e5 ? `<div class="der"><button class="lnk" data-borrar-vis="${esc(v.id)}">Borrar</button></div>` : ''}</div>`;
        }).join('');
    }).join('');
    el.querySelector('#kv-lista').onclick = async e => {
      const b = e.target.closest('[data-borrar-vis]'); if (!b) return;
      if (!confirm('¿Borrar esta visita?')) return;
      try { await post({ accion: 'borrar_visita', id: b.dataset.borrarVis }); toast('Visita borrada'); K.clientes = null; renderVisitas(el); } catch (er) { toast(er.message, true); }
    };
    el.querySelector('#kv-csv').onclick = () => {
      const nom = (d.kaf && d.kaf.nombre ? d.kaf.nombre : 'kaf').toLowerCase().replace(/[^a-z0-9]+/gi, '-');
      csv('visitas-' + nom + '-' + desde + '-a-' + hasta + '.csv', [['Fecha', 'Día', 'Hora', 'Código', 'Cliente', 'Tipo', 'Vendedor', 'Nota', 'Cargada el']].concat(
        vis.slice().sort((a, b) => a.fecha < b.fecha ? -1 : 1).map(v => [fecha(v.fecha), dia(v.fecha).split(' ')[0], hora(v.fecha), v.cliente_codigo, v.cliente_nombre, TIPO1[v.tipo_cliente] || v.tipo_cliente || '', v.vendedor || '', v.nota || '', fecha(v.registrada_at) + ' ' + hora(v.registrada_at)])));
    };
  }

  // ── Clientes nuevos ────────────────────────────────────────────────────────
  const EST_NUE = { mes: '' };
  async function renderNuevos(el) {
    const m0 = mesDe(hoy());
    const mes = EST_NUE.mes || m0;
    el.innerHTML = `<div class="barra"><select id="kn-mes">${[0, 1, 2, 3, 4, 5].map(i => { const m = mesMenos(m0, i); return `<option value="${m}" ${m === mes ? 'selected' : ''}>${esc(mesNombre(m))}</option>`; }).join('')}</select></div><div id="kn-cont"><div class="vacio">Calculando con las ventas de CUBO…</div></div>`;
    el.querySelector('#kn-mes').onchange = e => { EST_NUE.mes = e.target.value; renderNuevos(el); };
    let d;
    try { d = await get('nuevos', { mes }); } catch (e) { el.querySelector('#kn-cont').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    if (d.sinPerfil) { el.querySelector('#kn-cont').innerHTML = sinPerfilHtml(); return; }
    const O = d.objetivos || {}, marca = d.marcaNombre || 'la marca';
    const kpi = (t, n, o, s) => `<div class="kpi"><div class="k">${esc(t)}</div><div class="v">${n}${o != null ? ` <small>de ${o}</small>` : ''}</div>${o ? `<div class="prog ${n >= o ? 'ok' : ''}"><i style="width:${Math.min(100, Math.round(n / o * 100))}%"></i></div>` : ''}<div class="s">${esc(s)}</div></div>`;
    const fila = (x, extra) => `<div class="fila click" data-c="${esc(x.c)}"><div class="cuerpo"><div class="tit">${esc(x.n)} <small style="color:var(--muted);font-weight:500">${esc(x.c)}</small></div><div class="sub">${esc(TIPO1[x.t] || x.t || '')}${x.v ? ' · Vendedor: ' + esc(x.v) : ''}</div></div><div class="der">${extra}</div></div>`;
    el.querySelector('#kn-cont').innerHTML = `<div class="kpis">${kpi('Nuevos de ' + marca, d.nuevosMarca.length, O.nuevos_marca, 'No le compraban ningún producto de ' + marca + ' a GrandBar')}${kpi('Nuevos de GrandBar', d.nuevosGb.length, O.nuevos_gb, 'Cuenta nueva de la distribuidora')}</div>
      <h2>Nuevos de ${esc(marca)} <small>${esc(mesNombre(mes))}</small></h2>
      ${d.nuevosMarca.length ? d.nuevosMarca.map(x => fila(x, 'Primera compra<br><b style="color:var(--ink)">' + fecha(x.primera) + '</b>')).join('') : '<div class="vacio">Ningún cliente compró ' + esc(marca) + ' por primera vez este mes.</div>'}
      <h2>Nuevos de GrandBar <small>${esc(mesNombre(mes))}</small></h2>
      ${d.nuevosGb.length ? d.nuevosGb.map(x => fila(x, 'Alta ' + fecha(x.alta) + '<br>' + (x.primera ? 'Primera compra <b style="color:var(--ink)">' + fecha(x.primera) + '</b>' : 'Todavía sin compras'))).join('') : '<div class="vacio">No hay cuentas nuevas de GrandBar en tu lista este mes.</div>'}
      <p style="font-size:12.5px;color:var(--muted);margin-top:16px;line-height:1.55">Cómo se cuentan, con los datos de CUBO: <b>nuevo de ${esc(marca)}</b> = su primera compra de la marca (desde enero 2025, que es desde cuando hay datos) cae en este mes. <b>Nuevo de GrandBar</b> = la cuenta se dio de alta en CUBO este mes y no tiene compras de antes. Solo los clientes de tu lista (tu canal y tu zona).</p>`;
    el.querySelector('#kn-cont').onclick = e => { const f = e.target.closest('[data-c]'); if (f) abrirFicha(f.dataset.c).catch(() => {}); };
  }

  // ── Inicio ─────────────────────────────────────────────────────────────────
  async function renderInicio(el) {
    el.innerHTML = '<div class="vacio">Cargando…</div>';
    let d;
    try { d = await get('inicio'); } catch (e) { el.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return null; }
    K.perfil = d.perfil; K.secciones = d.secciones || []; K.hoy = d.hoy;
    if (!d.perfil) { el.innerHTML = sinPerfilHtml(); return d; }
    const O = d.objetivos || {}, V = d.visitas || {}, N = d.nuevos || {};
    const kpi = (t, n, o, s) => `<div class="kpi"><div class="k">${esc(t)}</div><div class="v">${n == null ? '—' : n}${o != null ? ` <small>de ${o}</small>` : ''}</div>${o ? `<div class="prog ${n >= o ? 'ok' : ''}"><i style="width:${Math.min(100, Math.round((n || 0) / o * 100))}%"></i></div>` : ''}<div class="s">${esc(s || '')}</div></div>`;
    const prom = V.diasMes ? Math.round(V.mes / V.diasMes * 10) / 10 : 0;
    const objs = d.objetivosCliente || [];
    el.innerHTML = `${O.nota ? `<div class="ayuda"><b>Trade Marketing:</b> ${esc(O.nota)}</div>` : ''}
      <div class="kpis">
        ${kpi('Clientes visitados hoy', V.hoy, O.visitas_dia, O.visitas_dia ? (V.hoy >= O.visitas_dia ? 'Objetivo del día cumplido' : 'Faltan ' + (O.visitas_dia - V.hoy) + ' para el mínimo del día') : 'Todavía no hay mínimo por día cargado')}
        ${kpi('Visitas del mes', V.mes, null, V.diasMes + (V.diasMes === 1 ? ' día' : ' días') + ' con visitas · ' + String(prom).replace('.', ',') + ' clientes por día')}
        ${secc('nuevos') ? kpi('Nuevos de ' + (d.perfil.marca || 'la marca'), N.error ? null : N.marca, O.nuevos_marca, N.error ? 'No se pudo calcular' : 'en ' + mesNombre(d.mes).split(' ')[0].toLowerCase()) : ''}
        ${secc('nuevos') ? kpi('Nuevos de GrandBar', N.error ? null : N.gb, O.nuevos_gb, N.error ? 'No se pudo calcular' : 'cuentas nuevas') : ''}
      </div>
      <h2>Esta semana <small>clientes visitados por día${O.visitas_dia ? ' · mínimo ' + O.visitas_dia : ''}</small></h2>
      <div class="semana">${(V.semana || []).map(x => `<div class="dia ${x.futuro ? 'futuro' : (O.visitas_dia ? (x.n >= O.visitas_dia ? 'ok' : (x.n ? 'bajo' : '')) : '')} ${x.dia === d.hoy ? 'hoy' : ''}"><div class="d">${esc(dia(x.dia).split(' ')[0])} ${esc(x.dia.slice(8, 10))}</div><div class="n">${x.futuro ? '' : x.n}</div></div>`).join('')}</div>
      <h2>Objetivos por cliente <small>${esc(mesNombre(d.mes))}</small></h2>
      ${objs.length ? objs.map(o => `<div class="fila click" data-c="${esc(o.cliente_codigo)}"><div class="cuerpo"><div class="tit">${esc(o.cliente_nombre || o.cliente_codigo)}</div><div class="sub">${esc(o.objetivo)}${o.nota_kaf ? ' · Nota: ' + esc(o.nota_kaf) : ''}</div></div><div class="der"><span class="estado e-${esc(o.estado)}">${esc(ESTADO_OBJ[o.estado])}</span></div></div>`).join('') : `<div class="vacio">${esKaf() ? 'Trade Marketing todavía no te cargó objetivos por cliente este mes.' : 'Todavía no hay objetivos por cliente este mes: se cargan desde la ficha de cada cliente (pestaña Clientes).'}</div>`}
      <h2>Últimas visitas</h2>
      ${(V.ultimas || []).length ? V.ultimas.map(v => `<div class="fila click" data-c="${esc(v.cliente_codigo)}"><div style="font-weight:800;min-width:96px;font-size:13.5px">${esc(dia(v.fecha))}<br>${hora(v.fecha)}</div><div class="cuerpo"><div class="tit">${esc(v.cliente_nombre || v.cliente_codigo)}</div></div></div>`).join('') : '<div class="vacio">Todavía no hay visitas marcadas.</div>'}
      ${secc('materiales') && (d.pedidos || []).length ? `<h2>Pedidos de materiales</h2>${d.pedidos.map(p => `<div class="fila"><div class="cuerpo"><div class="tit">${esc((p.items || []).map(i => i.cantidad + ' × ' + i.nombre).join(', '))}</div><div class="sub">${fecha(p.created_at)}${p.remito ? ' · Remito ' + esc(p.remito) : ''}</div></div><div class="der"><span class="estado e-${esc(p.estado)}">${esc(ESTADO[p.estado] || p.estado)}</span></div></div>`).join('')}` : ''}`;
    el.onclick = e => { const f = e.target.closest('[data-c]'); if (f) abrirFicha(f.dataset.c); };
    return d;
  }

  // ── Pedidos de materiales (lista) ──────────────────────────────────────────
  function pedidoHtml(p, conAcciones) {
    return `<div class="fila"><div class="cuerpo">
        <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap"><div class="tit" style="flex:1">${esc(p.solicitante || '')}${p.cliente_nombre ? ' · ' + esc(p.cliente_nombre) : ''}</div><span class="estado e-${esc(p.estado)}">${esc(ESTADO[p.estado] || p.estado)}${p.remito ? ' ' + esc(p.remito) : ''}</span></div>
        <div class="sub">Pedido ${esc(String(p.id).slice(0, 8))} · ${fecha(p.created_at)} ${hora(p.created_at)}</div>
        <ul class="ops">${(p.items || []).map(i => `<li><b>${num(i.cantidad)}</b> × ${esc(i.nombre)}${i.id ? '' : ' <span class="chip gris">fuera del catálogo</span>'}${i.stock != null && i.stock < i.cantidad ? ` <span class="chip rojo">stock ${num(i.stock)}</span>` : ''}</li>`).join('')}</ul>
        ${p.nota ? `<div style="font-size:13.5px;margin-top:6px;background:var(--cream);border-radius:9px;padding:8px 10px;white-space:pre-wrap">${esc(p.nota)}</div>` : ''}
        ${p.respuesta ? `<div style="font-size:13.5px;margin-top:8px;background:var(--green-s);border-left:3px solid var(--green);border-radius:0 9px 9px 0;padding:8px 10px"><b>${esc(p.atendido_por || 'Andrea')}:</b> ${esc(p.respuesta)}</div>` : (p.atendido_por ? `<div class="sub" style="margin-top:6px">Lo atendió ${esc(p.atendido_por)} el ${fecha(p.atendido_at)}</div>` : '')}
        ${conAcciones ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${p.estado === 'enviado'
          ? `<button class="btn ok chico" data-at="${esc(p.id)}" data-est="remito">Remito emitido</button><button class="btn rojo chico" data-at="${esc(p.id)}" data-est="rechazado">No sale</button>`
          : `<button class="btn claro chico" data-at="${esc(p.id)}" data-est="enviado">Volver a pendiente</button>`}</div>` : ''}
      </div></div>`;
  }

  function sinPerfilHtml() {
    return esKaf()
      ? '<div class="vacio">Tu panel todavía no está armado: Juan Pablo Sepúlveda (Trade Marketing) elige tu marca y tus clientes. Cuando lo arme, acá vas a ver todo.</div>'
      : '<div class="vacio">Este KAF todavía no tiene el panel armado. Elegí su marca, sus clientes y sus secciones en la pestaña <b>Armado del panel</b>.</div>';
  }

  return { K, $, esc, num, plata, fecha, hora, dia, diaLargo, hoy, mesDe, mesNombre, mesMenos, TIPO, TIPO1, REG, ESTADO, ESTADO_OBJ, toast, get, post, secc, csv, ventana, cerrar, clientes, picker, leerArchivo,
    renderInicio, renderClientes, abrirFicha, renderVisitas, renderNuevos, renderRegistros, formRegistro, modeloHtml, pedidoHtml, sinPerfilHtml, supa };
})();
