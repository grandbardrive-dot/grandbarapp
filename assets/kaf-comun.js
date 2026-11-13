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
    material: { n: 'Exhibidores y materiales', uno: 'foto de exhibidor o material', d: 'Fotos de los exhibidores y materiales de la marca en el punto de venta.' },
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
  const porTipoTxt = (l, t) => num(l.filter(c => c.t === t).length);
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
  // Todos los clientes de GrandBar (13/11/2026). "Mi canal" (los tipos del perfil) es la
  // pestaña de entrada; "Todos" trae el resto, con filtro por tipo.
  const EST_CLI = { tab: 'canal', tipo: '', vend: '', filtro: '', q: '', orden: 'nombre', max: 150 };
  async function renderClientes(el) {
    el.innerHTML = '<div class="vacio">Cargando los clientes y lo que compran de la marca… (la primera vez tarda unos segundos)</div>';
    let d;
    try { d = await clientes(); } catch (e) { el.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    if (d.sinPerfil) { el.innerHTML = sinPerfilHtml(); return; }
    const P = d.perfil || {};
    const tipos = P.tipos || [], mio = new Set(tipos);
    if (!tipos.length && EST_CLI.tab === 'canal') EST_CLI.tab = 'todos';
    const vendedores = [...new Map(d.clientes.filter(c => c.vc).map(c => [c.vc, c.v])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    const tiposTodos = [...new Set(d.clientes.map(c => c.t))].sort((a, b) => String(TIPO[a] || a).localeCompare(String(TIPO[b] || b)));
    const pinta = () => {
      const q = EST_CLI.q.trim().toLowerCase();
      let l = d.clientes.filter(c => EST_CLI.tab === 'canal' ? mio.has(c.t) : EST_CLI.tab === 'todos' ? (!EST_CLI.tipo || c.t === EST_CLI.tipo) : c.t === EST_CLI.tab);
      if (EST_CLI.vend) l = l.filter(c => c.vc === EST_CLI.vend);
      const porTipo = {}; d.clientes.forEach(c => { porTipo[c.t] = (porTipo[c.t] || 0) + 1; });
      const enCanal = d.clientes.filter(c => mio.has(c.t)).length;
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
      el.querySelector('#kc-tabs').innerHTML = (tipos.length ? `<button data-t="canal" class="${EST_CLI.tab === 'canal' ? 'on' : ''}">Mi canal<span class="n">${enCanal}</span></button>` : '')
        + (tipos.length > 1 ? tipos.map(t => `<button data-t="${esc(t)}" class="${EST_CLI.tab === t ? 'on' : ''}">${esc(TIPO[t] || t)}<span class="n">${porTipo[t] || 0}</span></button>`).join('') : '')
        + `<button data-t="todos" class="${EST_CLI.tab === 'todos' ? 'on' : ''}">Todos los clientes<span class="n">${d.clientes.length}</span></button>`;
      const st = el.querySelector('#kc-tipo'); st.style.display = EST_CLI.tab === 'todos' ? '' : 'none'; st.value = EST_CLI.tipo;
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
        <select id="kc-tipo" aria-label="Tipo de cliente"><option value="">Todos los tipos</option>${tiposTodos.map(t => `<option value="${esc(t)}">${esc(TIPO[t] || t)} (${porTipoTxt(d.clientes, t)})</option>`).join('')}</select>
        <select id="kc-vend" aria-label="Vendedor"><option value="">Todos los vendedores</option>${vendedores.map(([k, n]) => `<option value="${esc(k)}">${esc(n || k)}</option>`).join('')}</select>
        <select id="kc-orden" aria-label="Orden"><option value="nombre">Por nombre</option><option value="op">Más oportunidades</option><option value="u12">Más unidades</option><option value="sin">Más tiempo sin comprar</option></select>
        <input type="search" id="kc-q" placeholder="Buscar cliente, código o vendedor…" autocomplete="off">
        <button class="btn claro chico" id="kc-csv" title="Cuadro de oportunidades en Excel">Bajar el cuadro</button>
      </div>
      <div class="cuenta" id="kc-cuenta"></div><div id="kc-lista"></div>`;
    el.querySelector('#kc-filtro').value = EST_CLI.filtro; el.querySelector('#kc-orden').value = EST_CLI.orden; el.querySelector('#kc-q').value = EST_CLI.q; el.querySelector('#kc-vend').value = EST_CLI.vend;
    el.querySelector('#kc-tabs').onclick = e => { const b = e.target.closest('button[data-t]'); if (!b) return; EST_CLI.tab = b.dataset.t; EST_CLI.max = 150; pinta(); };
    el.querySelector('#kc-tipo').onchange = e => { EST_CLI.tipo = e.target.value; EST_CLI.max = 150; pinta(); };
    el.querySelector('#kc-vend').onchange = e => { EST_CLI.vend = e.target.value; EST_CLI.max = 150; pinta(); };
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

  // ── Ficha del cliente ──────────────────────────────────────────────────────
  // El KAF la abre como pantalla (#cliente/<código>) y de ahí empieza la visita; Trade
  // Marketing la ve en una ventana. Vendedor, cobertura, cómo compra, lo de la marca que
  // corre para ese cliente (planes, campañas, catálogo), oportunidades, objetivos y visitas.
  const CMP_RUBRO = { vinoteca: 'otras vinotecas', restaurante: 'otros restaurantes', bar: 'otros bares', autoservicio: 'otros autoservicios', disco: 'otras discos', hotel: 'otros hoteles', 'tienda de bebidas': 'otras tiendas de bebidas' };
  const hace = n => n === 0 ? 'hoy' : n === 1 ? 'ayer' : 'hace ' + num(n) + ' días';
  function compraHtml(x, marca) {
    if (!x) return '';
    if (!x.ultima_compra) return `<div class="bloque"><h4>Cómo compra</h4><div style="font-size:13px;color:var(--muted)">No tiene compras a GrandBar en los últimos dos años.</div></div>`;
    const frenado = x.dias_sin_comprar != null && (x.cada_dias ? x.dias_sin_comprar > Math.max(30, 2 * x.cada_dias) : x.dias_sin_comprar > 90);
    const quienes = (CMP_RUBRO[x.tipo] || 'otros clientes del mismo rubro') + (x.zona === 'sanluis' ? ' de San Luis' : x.zona === 'mendoza' ? ' de Mendoza' : '');
    return `<div class="bloque"><h4>Cómo compra</h4>
      ${frenado ? `<div class="aviso" style="margin-bottom:10px">${x.cada_dias ? 'Suele comprar cada ~' + x.cada_dias + ' días y la' : 'La'} última compra a GrandBar fue ${hace(x.dias_sin_comprar)} (${fecha(x.ultima_compra)}).</div>` : ''}
      <div class="kpis chicos">
        <div class="kpi"><div class="k">Compra a GrandBar</div><div class="v">${x.cada_dias ? 'cada ~' + x.cada_dias + ' días' : x.pedidos_12m ? x.pedidos_12m + (x.pedidos_12m === 1 ? ' vez' : ' veces') + ' en el año' : '—'}</div></div>
        <div class="kpi"><div class="k">Última compra</div><div class="v">${fecha(x.ultima_compra)}</div><div class="s">${hace(x.dias_sin_comprar)}</div></div>
        <div class="kpi"><div class="k">Pedidos en 12 meses</div><div class="v">${num(x.pedidos_12m)}</div></div>
      </div>
      ${(x.dejo || []).length ? `<div class="sub-t">Dejó de comprar de ${esc(marca)}</div><ul class="ops">${x.dejo.map(p => `<li><b>${esc(p.nombre)}</b> — lo compraba cada ~${p.cada} días (${p.veces} veces); la última, ${fecha(p.ultima)}</li>`).join('')}</ul>` : ''}
      ${(x.parecidos || []).length ? `<div class="sub-t">Lo compran ${esc(quienes)} y este no</div><ul class="ops">${x.parecidos.map(p => `<li><b>${esc(p.nombre)}</b> — lo compran ${p.clientes} de ${x.pares} (${p.pct}%), unas ${num(p.unidades)} u. cada uno en 4 meses</li>`).join('')}</ul>` : ''}
      <div style="font-size:12px;color:var(--muted);margin-top:8px">Facturas de CUBO. En "Dejó de comprar" y "Lo compran…" van solo productos de ${esc(marca)} con stock.</div></div>`;
  }
  const precio = (reg, acc) => (acc ? `<b>${plata(acc)}</b>` : '') + (reg && acc && Number(reg) !== Number(acc) ? ` <s style="color:var(--muted)">${plata(reg)}</s>` : (!acc && reg ? plata(reg) : ''));
  const hastaTxt = h => h ? 'hasta el ' + fecha(h) : '';
  function planHtml(p) {
    return `<div class="acc"><div class="acc-t"><b>${esc(p.titulo)}</b>${p.condicion ? `<span class="chip oro">${esc(p.condicion)}</span>` : ''}<span class="chip gris">Plan</span></div>
      ${p.desc ? `<div class="acc-d">${esc(p.desc)}</div>` : ''}
      ${(p.lineas || []).length ? `<div class="chips">${p.lineas.map(l => `<span class="chip">${esc(l)}</span>`).join('')}</div>` : ''}
      ${(p.reglas || []).length ? `<div class="acc-r"><b>Condiciones</b>${p.reglas.map(r => `<div>${esc(r)}</div>`).join('')}</div>` : ''}
      <div class="acc-s">${esc([p.proveedor, hastaTxt(p.hasta)].filter(Boolean).join(' · '))}${p.pdf ? ` · <a class="lnk" href="${esc(p.pdf)}" target="_blank" rel="noopener">Ver PDF</a>` : ''}</div></div>`;
  }
  function campHtml(a) {
    return `<div class="acc"><div class="acc-t"><b>${esc(a.titulo)}</b><span class="chip gris">Campaña</span></div>
      ${a.accion ? `<div class="acc-d">${esc(a.accion)}</div>` : ''}${a.detalle ? `<div class="acc-d">${esc(a.detalle)}</div>` : ''}
      <div class="acc-s">${[precio(a.regular, a.accionado), esc(hastaTxt(a.hasta))].filter(Boolean).join(' · ')}</div></div>`;
  }
  function catHtml(x) {
    return `<div class="acc"><div class="acc-t"><b>${esc(x.producto)}</b>${x.mecanica ? `<span class="chip oro">${esc(x.mecanica)}</span>` : ''}<span class="chip gris">Catálogo</span></div>
      ${x.info ? `<div class="acc-d">${esc(x.info)}</div>` : ''}
      <div class="acc-s">${[precio(x.regular, x.accionado), x.off ? esc(x.off + '% off') : '', esc(hastaTxt(x.hasta))].filter(Boolean).join(' · ')}</div></div>`;
  }
  function accionesHtml(A, marca, enVisita) {
    if (!A) return enVisita ? '' : `<div class="bloque"><h4>Planes, campañas y ofertas de ${esc(marca)}</h4><div style="font-size:13px;color:var(--muted)">No se pudieron leer.</div></div>`;
    const n = A.planes.length + A.campanias.length + A.catalogo.length;
    const cuerpo = !n ? `<div style="font-size:13px;color:var(--muted)">No hay planes, campañas ni ofertas de ${esc(marca)} vigentes para este tipo de cliente.</div>`
      : A.planes.map(planHtml).join('') + A.campanias.map(campHtml).join('') + A.catalogo.map(catHtml).join('');
    return enVisita ? `<div class="kv-acc">${cuerpo}</div>`
      : `<div class="bloque"><h4>Planes, campañas y ofertas de ${esc(marca)} <small>${n} para este cliente</small></h4>${cuerpo}
        <div style="font-size:12px;color:var(--muted);margin-top:8px">Lo mismo que ve el vendedor: lo que cargó Luciana para este tipo de cliente y zona, y el catálogo de clientes.</div></div>`;
  }
  const wa = n => { const d = String(n || '').replace(/\D/g, ''); return d ? (d.startsWith('54') ? d : '549' + d.replace(/^0/, '')) : ''; };
  function resumenVisita(v) {
    const det = (v.detalle && v.detalle.secciones) || [];
    const hechas = det.filter(s => s.hecho).map(s => s.titulo);
    const nf = (v.fotos || []).length;
    return [hechas.length ? hechas.join(', ') : (det.length ? 'Recorrido sin secciones hechas' : ''), nf ? nf + (nf === 1 ? ' foto' : ' fotos') : ''].filter(Boolean).join(' · ');
  }

  async function abrirFicha(codigo, el) {
    if (!el && esKaf()) { cerrar.despues = null; cerrar(); location.hash = '#cliente/' + encodeURIComponent(codigo); return; }
    const c0 = K.clientes && K.clientes.clientes.find(x => x.c === codigo);
    const pagina = !!el;
    const mb = pagina ? el : ventana(c0 ? c0.n : 'Cliente', c0 ? [c0.c, TIPO1[c0.t] || c0.t, c0.v ? 'Vendedor: ' + c0.v : ''].filter(Boolean).join(' · ') : '');
    if (pagina) mb.innerHTML = `<a class="lnk volver" href="#clientes">‹ Clientes</a><div class="vacio">Cargando el cliente…</div>`;
    let d;
    try { d = await get('cliente', { codigo }); } catch (e) { mb.innerHTML = (pagina ? '<a class="lnk volver" href="#clientes">‹ Clientes</a>' : '') + `<div class="vacio">${esc(e.message)}</div>`; return; }
    K.ficha = d;
    const c = d.cliente, P = (K.clientes && K.clientes.perfil) || K.perfil || {};
    const mes = mesDe(hoy());
    const objs = d.objetivos || [];
    const V = d.vendedor || {}, tel = wa(V.whatsapp), t5c = t5Cuenta(c.t5);
    const cab = pagina ? `<a class="lnk volver" href="#clientes">‹ Clientes</a>
      <div class="fc-cab"><div class="fc-id"><h1>${esc(c.n)}</h1>
          <p>${esc([c.c, TIPO1[c.t] || c.t, c.d].filter(Boolean).join(' · '))}</p>
          <div class="chips">${chipsCliente(Object.assign({}, c, c0 ? { vis: c0.vis, obj: c0.obj } : {}))}</div></div>
        <div class="fc-vend"><div class="k">Vendedor</div><div class="v">${esc(V.nombre || c.v || 'Sin vendedor')}</div>
          ${tel ? `<a class="btn claro chico" href="https://wa.me/${esc(tel)}" target="_blank" rel="noopener">Escribirle por WhatsApp</a>` : ''}
          ${t5c ? `<div class="k" style="margin-top:10px">Cobertura</div><div class="v">Plan 5T: ${t5c.si} de ${t5c.tot} marcas</div>` : ''}</div></div>
      ${esKaf() ? `<button class="btn ok grande" id="kf-recorrido" style="margin:4px 0 14px">${borrador(codigo) ? 'Seguir con la visita que empezaste' : 'Empezar visita'}</button>` : ''}` : '';
    const visitaHtml = esKaf() ? `<div class="bloque"><h4>${pagina ? 'Mis visitas a este cliente' : 'Visita'}</h4>
        ${pagina ? '' : '<button class="btn ok grande" id="kf-marcar">Marcar visita ahora</button>'}
        <details style="margin-top:${pagina ? 0 : 10}px"><summary class="lnk" style="display:inline">${pagina ? 'Solo marcar que pasé (sin recorrido), o en otro horario' : 'La visita fue en otro horario o quiero dejar una nota'}</summary>
          ${pagina ? '<button class="btn navy" id="kf-marcar" style="margin-top:10px">Marcar que pasé ahora</button>' : ''}
          <div class="dos" style="margin-top:10px"><label class="campo"><span>Día y hora</span><input type="datetime-local" id="kf-cuando" max="${hoy()}T23:59"></label>
          <label class="campo"><span>Nota (opcional)</span><input id="kf-nota" maxlength="500" placeholder="Qué se habló, con quién…"></label></div>
          <button class="btn navy" id="kf-marcar2">Marcar con este horario</button>
        </details>
        <div id="kf-vis" style="margin-top:12px"></div></div>` : `<div class="bloque"><h4>Visitas del KAF</h4><div id="kf-vis"></div></div>`;
    const pintaVis = () => {
      const v = d.visitas || [];
      mb.querySelector('#kf-vis').innerHTML = !v.length ? '<div style="font-size:13px;color:var(--muted)">Todavía no hay visitas marcadas a este cliente.</div>'
        : v.slice(0, 8).map(x => `<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line2);font-size:13.5px">
            <b style="min-width:120px">${esc(dia(x.fecha))} ${hora(x.fecha)}</b><span style="flex:1;color:var(--muted)">${esc([resumenVisita(x), x.nota].filter(Boolean).join(' · '))}</span>
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
    const exh = d.exhibidores || [];
    // Después de tocar un exhibidor se vuelve a la ficha (la página del KAF o la ventana de Trade).
    const volverFicha = () => abrirFicha(codigo, pagina ? el : undefined);
    const t5 = c.t5;
    mb.innerHTML = `${cab}${pagina ? '' : visitaHtml}
      <div id="kf-objs">${objHtml()}</div>
      <div class="bloque"><h4>Oportunidades</h4>${c.op && c.op.length ? `<ul class="ops">${c.op.map(o => `<li>${esc(o.t)}</li>`).join('')}</ul>` : '<div style="font-size:13px;color:var(--muted)">No encontramos oportunidades con los datos de CUBO: compra seguido y de todas las marcas foco.</div>'}</div>
      ${accionesHtml(d.acciones, P.marca || 'la marca')}
      ${compraHtml(d.compra, P.marca || 'la marca')}
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
      ${secc('materiales') || exh.length ? `<div class="bloque"><h4>Exhibidores de ${esc(P.marca || 'la marca')} en este cliente <small>${exh.filter(x => x.estado === 'instalado').length} instalados</small></h4>
          ${exh.length ? `<div class="kv-exh">${exh.map(x => exhibidorFila(x, false)).join('')}</div>` : '<div style="font-size:13px;color:var(--muted)">Todavía no hay exhibidores registrados en este cliente.</div>'}
          ${esKaf() ? '<button class="btn claro" type="button" data-exh-nuevo style="margin-top:10px">Registrar exhibidor</button>' : ''}</div>` : ''}
      ${esKaf() ? `<div class="bloque"><h4>Cargar en este cliente</h4><div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['evidencia', 'perfect_serve', 'perfect_store', 'capacitacion', 'presupuesto'].filter(secc).map(k => `<button class="btn claro" data-cargar="${k}">${esc(secc(k).t)}</button>`).join('')}
          ${secc('materiales') ? '<button class="btn claro" data-materiales>Pedir materiales</button><button class="btn claro" data-especial>Pedido especial</button>' : ''}</div></div>` : ''}
      ${(d.registros || []).length ? `<div class="bloque"><h4>Lo cargado en este cliente</h4>${d.registros.slice(0, 10).map(r => `<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--line2);font-size:13.5px;align-items:center;flex-wrap:wrap">
          <b>${esc((REG[r.tipo] || {}).n || r.tipo)}</b><span style="color:var(--muted)">${fecha(r.fecha)} · ${esc(resumenDatos(r))}</span><span class="estado e-${esc(r.estado)}" style="margin-left:auto">${esc(ESTADO[r.estado] || r.estado)}</span></div>`).join('')}</div>` : ''}
      ${pagina ? visitaHtml : ''}`;
    pintaVis();
    const rec = mb.querySelector('#kf-recorrido');
    if (rec) rec.onclick = () => { location.hash = '#visita/' + encodeURIComponent(codigo); };
    const marcar = async (cuando, nota, btn) => {
      btn.disabled = true;
      try {
        const r = await post({ accion: 'visita', codigo, cuando: cuando || undefined, nota: nota || undefined });
        if (r.repetida) toast('Ya estaba marcada (' + hora(r.visita.fecha) + ').');
        else { toast('Visita marcada: ' + diaLargo(isoLocal(new Date(r.visita.fecha))) + ' ' + hora(r.visita.fecha)); d.visitas = [r.visita].concat(d.visitas || []); pintaVis(); }
        if (K.clientes) { const cc = K.clientes.clientes.find(x => x.c === codigo); if (cc) { cc.vis = r.visita.fecha; cc.visMes = (cc.visMes || 0) + (r.repetida ? 0 : 1); } }
        if (!pagina) cerrar.despues = K.alCambiar || null;
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
      if (e.target.closest('[data-materiales]')) { cerrar(); if (K.alPedirMateriales) K.alPedirMateriales({ c: codigo, n: c.n }); return; }
      if (e.target.closest('[data-especial]')) { formEspecial({ c: codigo, n: c.n }, null); return; }
      if (e.target.closest('[data-exh-nuevo]')) { formExhibidor(null, { c: codigo, n: c.n }, { alGuardar: volverFicha }); return; }
      const ex = e.target.closest('[data-ex]');
      if (ex) { const x = exh.find(y => y.id === ex.dataset.ex); if (x) { if (!pagina) cerrar.despues = null; verExhibidor(x, volverFicha); if (!pagina) cerrar.despues = volverFicha; } }
    };
  }

  // ── Visita: el recorrido del manual de la marca (13/11/2026) ─────────────────
  // Sección por sección: tareas para tildar, lo de la marca para ese cliente, fotos
  // (se suben apenas se sacan) y un comentario. Al final, la nota para el vendedor, que
  // recibe el aviso. Lo hecho se guarda en el celular mientras tanto: si se corta la
  // señal o se cierra la página, al volver sigue donde quedó.
  const BORR = cod => 'kaf_visita_v1_' + cod;
  const borrador = cod => { try { return JSON.parse(localStorage.getItem(BORR(cod)) || 'null'); } catch (e) { return null; } };
  const guardarBorrador = (cod, B) => { try { localStorage.setItem(BORR(cod), JSON.stringify(B)); } catch (e) {} };
  const borrarBorrador = cod => { try { localStorage.removeItem(BORR(cod)); } catch (e) {} };
  const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  async function manualMarca(forzar) { if (K.manual && !forzar) return K.manual; K.manual = await get('manual'); return K.manual; }

  async function renderVisita(el, codigo) {
    el.innerHTML = `<a class="lnk volver" href="#cliente/${encodeURIComponent(codigo)}">‹ Volver a la ficha</a><div class="vacio">Cargando el manual de la marca…</div>`;
    let M, d;
    try { [M, d] = await Promise.all([manualMarca(), K.ficha && K.ficha.cliente && K.ficha.cliente.c === codigo ? K.ficha : get('cliente', { codigo })]); }
    catch (e) { el.innerHTML = `<a class="lnk volver" href="#cliente/${encodeURIComponent(codigo)}">‹ Volver a la ficha</a><div class="vacio">${esc(e.message)}</div>`; return; }
    K.ficha = d;
    const c = d.cliente, P = K.perfil || {}, V = d.vendedor || {};
    const B = borrador(codigo) || { inicio: new Date().toISOString(), s: {}, nota: '', avisar: true };
    guardarBorrador(codigo, B);
    const S = id => (B.s[id] = B.s[id] || { hecho: false, items: [], comentario: '', fotos: [] });
    const secs = [];
    (M.secciones || []).forEach(s => { secs.push(s); (s.sub || []).forEach(h => secs.push(Object.assign({}, h, { hija: true }))); });
    const subiendo = {};
    const fotosHtml = s => S(s.id).fotos.map((f, i) => `<a href="${esc(f.url || '#')}" target="_blank" rel="noopener"><img src="${esc(f.url || '')}" alt="Foto ${i + 1}"><button type="button" class="quitar" data-quitar="${i}" aria-label="Sacar la foto">×</button></a>`).join('')
      + Array.from({ length: subiendo[s.id] || 0 }, () => '<a class="subiendo">Subiendo…</a>').join('');
    const secHtml = s => {
      const st = S(s.id), conFoto = s.especial === 'w:kaf_foto';
      return `<section class="kv-sec${s.hija ? ' hija' : ''}${st.hecho ? ' hecha' : ''}" data-s="${esc(s.id)}">
        <div class="kv-h"><div class="kv-t"><b>${esc(s.nombre)}</b>${s.descripcion ? `<small>${esc(s.descripcion)}</small>` : ''}</div>
          <label class="kv-hecho"><input type="checkbox" data-hecho ${st.hecho ? 'checked' : ''}> Hecho</label></div>
        ${s.intro ? `<div class="kv-intro">${esc(s.intro)}</div>` : ''}
        ${(s.items || []).length ? `<div class="kv-items">${s.items.map((it, i) => `<label class="kv-item"><input type="checkbox" data-item="${i}" ${st.items.includes(it.texto) ? 'checked' : ''}><span>${esc(it.texto)}${it.detalle ? `<small>${esc(it.detalle)}</small>` : ''}</span></label>`).join('')}</div>` : ''}
        ${s.especial === 'w:kaf_acciones' ? accionesHtml(d.acciones, P.marca || 'la marca', true) : ''}
        ${s.especial === 'w:kaf_exhibidores' ? exhVisita() : ''}
        ${(s.planes || []).map(p => planHtml(p)).join('')}${(s.campanias || []).map(a => campHtml(a)).join('')}
        ${s.pdf ? `<a class="lnk" href="${esc(s.pdf)}" target="_blank" rel="noopener">Ver el PDF de la sección</a>` : ''}
        <div class="fotos kv-fotos" data-fotos>${fotosHtml(s)}</div>
        <label class="btn claro kv-foto-btn${conFoto && !st.fotos.length ? ' falta' : ''}">${CAM} ${conFoto ? 'Foto (obligatoria para darla por hecha)' : 'Sacar o subir foto'}<input type="file" accept="image/*" multiple data-file hidden></label>
        <textarea class="kv-com" data-com maxlength="1000" rows="2" placeholder="Comentario (opcional)">${esc(st.comentario)}</textarea>
      </section>`;
    };
    // Sección de exhibidores (w:kaf_exhibidores, etapa 2): los que ya están en el cliente,
    // para sumarles una foto o darlos de baja, y el alta de uno nuevo. Se guardan al toque.
    function exhVisita() {
      const l = (d.exhibidores || []).filter(x => x.estado === 'instalado');
      return `<div class="kv-exh">${l.length ? l.map(x => exhibidorFila(x, false)).join('') : '<div class="kv-intro" style="color:var(--muted);margin:0">Todavía no hay exhibidores registrados en este cliente.</div>'}
        <div><button class="btn claro chico" type="button" data-exh-nuevo>Registrar exhibidor nuevo</button></div></div>`;
    }
    const recargarExh = async () => {
      try { d.exhibidores = (await get('exhibidores', { codigo })).exhibidores || []; } catch (e) { toast(e.message, true); }
      secs.filter(s => s.especial === 'w:kaf_exhibidores').forEach(s => repintar(s));
    };
    const vendNom = V.nombre || c.v || '';
    el.innerHTML = `<a class="lnk volver" href="#cliente/${encodeURIComponent(codigo)}">‹ Volver a la ficha</a>
      <div class="head"><div><h1>Visita a ${esc(c.n)}</h1><p>${esc([TIPO1[c.t] || c.t, vendNom ? 'Vendedor: ' + vendNom : '', 'empezó ' + diaLargo(isoLocal(new Date(B.inicio))).toLowerCase() + ' ' + hora(B.inicio)].filter(Boolean).join(' · '))}</p></div></div>
      ${secs.length ? secs.map(secHtml).join('') : `<div class="vacio">El manual de ${esc(P.marca || 'la marca')} todavía no tiene secciones: Juan Pablo las arma en Secciones del manual. Igual podés guardar la visita con una nota.</div>`}
      <section class="kv-sec kv-pie">
        <label class="campo"><span>Nota para ${esc(vendNom || 'el vendedor')}</span><textarea id="kv-nota" maxlength="1000" placeholder="Qué hiciste, qué le quedó pendiente, qué pidió el cliente…">${esc(B.nota)}</textarea></label>
        ${vendNom ? `<label class="kv-item" style="border:0;padding:0 0 10px"><input type="checkbox" id="kv-avisar" ${B.avisar !== false ? 'checked' : ''}><span>Avisarle a ${esc(vendNom)} (le llega a la campanita del Portal)</span></label>` : ''}
        <div class="msg" id="kv-msg"></div>
        <button class="btn ok grande" id="kv-guardar">Guardar visita</button>
        <button class="lnk" id="kv-descartar" style="margin-top:12px">Descartar esta visita</button>
      </section>`;
    const secDe = n => secs.find(s => s.id === n.closest('[data-s]').dataset.s);
    const repintar = s => { const box = el.querySelector(`[data-s="${s.id}"]`); if (!box) return; box.outerHTML = secHtml(s); };
    el.onchange = async e => {
      const t = e.target;
      if (t.id === 'kv-avisar') { B.avisar = t.checked; guardarBorrador(codigo, B); return; }
      const s = t.closest('[data-s]') && secDe(t); if (!s) return;
      const st = S(s.id);
      if (t.matches('[data-hecho]')) { st.hecho = t.checked; t.closest('.kv-sec').classList.toggle('hecha', t.checked); }
      else if (t.matches('[data-item]')) {
        const tx = s.items[Number(t.dataset.item)].texto;
        st.items = t.checked ? [...new Set(st.items.concat(tx))] : st.items.filter(x => x !== tx);
      } else if (t.matches('[data-file]')) {
        const fs = [...t.files].slice(0, Math.max(0, 8 - st.fotos.length));
        t.value = '';
        if (!fs.length) { toast('Hasta 8 fotos por sección.', true); return; }
        subiendo[s.id] = (subiendo[s.id] || 0) + fs.length; repintar(s);
        for (const f of fs) {
          try { const r = await post({ accion: 'foto', foto: await leerArchivo(f) }); st.fotos.push({ path: r.path, url: r.url }); guardarBorrador(codigo, B); }
          catch (er) { toast(er.message, true); }
          subiendo[s.id]--; repintar(s);
        }
      }
      guardarBorrador(codigo, B);
    };
    el.oninput = e => {
      if (e.target.id === 'kv-nota') { B.nota = e.target.value; guardarBorrador(codigo, B); return; }
      if (e.target.matches('[data-com]')) { S(secDe(e.target).id).comentario = e.target.value; guardarBorrador(codigo, B); }
    };
    el.onclick = async e => {
      if (e.target.closest('[data-exh-nuevo]')) { formExhibidor(null, { c: codigo, n: c.n }, { alGuardar: recargarExh }); return; }
      const ex = e.target.closest('[data-ex]');
      if (ex) { const x = (d.exhibidores || []).find(y => y.id === ex.dataset.ex); if (x) verExhibidor(x, recargarExh); return; }
      const q = e.target.closest('[data-quitar]');
      if (q) { e.preventDefault(); const s = secDe(q); S(s.id).fotos.splice(Number(q.dataset.quitar), 1); guardarBorrador(codigo, B); repintar(s); return; }
      if (e.target.closest('#kv-descartar')) {
        if (!confirm('¿Descartar esta visita? Se pierde lo que marcaste (las fotos quedan sin usar).')) return;
        borrarBorrador(codigo); location.hash = '#cliente/' + encodeURIComponent(codigo); return;
      }
      const g = e.target.closest('#kv-guardar'); if (!g) return;
      const msg = el.querySelector('#kv-msg'); msg.textContent = '';
      if (Object.values(subiendo).some(n => n > 0)) { msg.textContent = 'Esperá a que terminen de subir las fotos.'; return; }
      const falta = secs.find(s => s.especial === 'w:kaf_foto' && S(s.id).hecho && !S(s.id).fotos.length);
      if (falta) { msg.textContent = '"' + falta.nombre + '" va con foto: sacala o subila, o destildá Hecho.'; el.querySelector(`[data-s="${falta.id}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const algo = secs.some(s => { const st = S(s.id); return st.hecho || st.items.length || st.fotos.length || st.comentario.trim(); });
      if (!algo && !B.nota.trim() && !confirm('No marcaste nada del recorrido. ¿Guardar igual que pasaste por el cliente?')) return;
      g.disabled = true; g.textContent = 'Guardando…';
      try {
        const viejo = Date.now() - new Date(B.inicio).getTime() > 6 * 864e5;
        const r = await post({ accion: 'visita', codigo, cuando: viejo ? undefined : B.inicio, nota: B.nota.trim(), avisar: B.avisar !== false,
          secciones: secs.map(s => { const st = S(s.id); return { id: s.id, hecho: st.hecho, items: st.items, comentario: st.comentario.trim(), fotos: st.fotos.map(f => f.path) }; }) });
        borrarBorrador(codigo);
        if (K.clientes) { const cc = K.clientes.clientes.find(x => x.c === codigo); if (cc) { cc.vis = r.visita.fecha; cc.visMes = (cc.visMes || 0) + (r.repetida ? 0 : 1); } }
        const av = (r.visita && r.visita.aviso) || {};
        toast(r.repetida ? 'Esa visita ya estaba guardada.' : 'Visita guardada' + (av.a && av.a.length ? ': le avisamos a ' + (av.vendedor || 'el vendedor') : '') + '.');
        location.hash = '#cliente/' + encodeURIComponent(codigo);
      } catch (er) { msg.textContent = er.message; g.disabled = false; g.textContent = 'Guardar visita'; }
    };
  }

  // ── Botón de la cámara: fotos al toque desde cualquier pantalla (13/11/2026) ──
  const TIPOS_FOTO = [['evidencia', 'Ejecución'], ['perfect_serve', 'Perfect Serve'], ['perfect_store', 'Perfect Store'], ['material', 'Exhibidor o material']];
  function fotoRapida(cliente) {
    const mb = ventana('Cargar fotos', 'Elegí el cliente y qué es. Le llega a Trade Marketing y queda en la ficha del cliente.');
    let archivos = [];
    mb.innerHTML = `<label class="campo"><span>Cliente</span><div id="fr-cli"></div></label>
      ${secc('nuevos') ? '<div style="font-size:12.5px;color:var(--muted);margin:-6px 0 12px">¿Todavía no es cliente? <button class="lnk" type="button" id="fr-pdv">Cargalo como punto de venta nuevo</button></div>' : ''}
      <div class="campo"><span>¿Qué es?</span><div class="opciones grilla">${TIPOS_FOTO.map(([k, n]) => `<label><input type="radio" name="fr-tipo" value="${k}" ${k === 'evidencia' ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div></div>
      <div class="campo" id="fr-cal"><span>¿Cómo está?</span><div class="opciones"><label><input type="radio" name="fr-cal" value="bien" checked> Bien ejecutado</label><label><input type="radio" name="fr-cal" value="mal"> Mal ejecutado</label></div></div>
      <div class="aviso" id="fr-exh" style="display:none">¿Es un exhibidor que queda instalado en el cliente? <button class="lnk" type="button" id="fr-exh-ok">Registralo como exhibidor</button>: queda en la ficha del cliente para seguirlo con fotos.</div>
      <label class="btn navy grande" style="margin:2px 0 8px">${CAM} Sacar o subir fotos<input type="file" id="fr-file" accept="image/*" multiple hidden></label>
      <div class="fotos" id="fr-prev"></div>
      <label class="campo" style="margin-top:12px"><span>Comentario (opcional)</span><textarea id="fr-com" maxlength="1000" placeholder="Qué se ve, qué hay que corregir…"></textarea></label>
      <div class="msg" id="fr-msg"></div>
      <div class="acts"><button class="btn claro" type="button" id="fr-cancel">Cancelar</button><button class="btn ok" type="button" id="fr-ok">Guardar</button></div>`;
    const elegido = picker(mb.querySelector('#fr-cli'), cliente || null, false);
    const tipo = () => (mb.querySelector('input[name="fr-tipo"]:checked') || {}).value || 'evidencia';
    mb.querySelector('.opciones').onchange = () => { mb.querySelector('#fr-cal').style.display = tipo() === 'evidencia' ? '' : 'none'; mb.querySelector('#fr-exh').style.display = tipo() === 'material' && secc('materiales') ? '' : 'none'; };
    mb.querySelector('#fr-exh-ok').onclick = () => formExhibidor(null, elegido(), { archivos });
    const frp = mb.querySelector('#fr-pdv'); if (frp) frp.onclick = () => formPdv(archivos, null);
    const prev = () => { mb.querySelector('#fr-prev').innerHTML = archivos.map((a, i) => `<a href="#" data-q="${i}" title="Sacar"><img src="${a}" alt=""></a>`).join(''); };
    mb.querySelector('#fr-file').onchange = async e => {
      for (const f of [...e.target.files].slice(0, 4 - archivos.length)) { try { archivos.push(await leerArchivo(f)); } catch (er) { toast(er.message, true); } }
      e.target.value = ''; prev();
      if (archivos.length >= 4) toast('Hasta 4 fotos por carga.');
    };
    mb.querySelector('#fr-prev').onclick = e => { const a = e.target.closest('[data-q]'); if (!a) return; e.preventDefault(); archivos.splice(Number(a.dataset.q), 1); prev(); };
    mb.querySelector('#fr-cancel').onclick = cerrar;
    mb.querySelector('#fr-ok').onclick = async ev => {
      const btn = ev.currentTarget, msg = mb.querySelector('#fr-msg'), c = elegido(), t = tipo();
      msg.textContent = '';
      if (!c) { msg.textContent = 'Elegí el cliente.'; return; }
      if (!archivos.length) { msg.textContent = 'Sacá o subí al menos una foto.'; return; }
      const com = mb.querySelector('#fr-com').value.trim();
      const datos = t === 'evidencia' ? { calificacion: (mb.querySelector('input[name="fr-cal"]:checked') || {}).value || 'bien', comentario: com } : { comentario: com };
      btn.disabled = true; btn.textContent = 'Guardando…';
      try { await post({ accion: 'registro', tipo: t, codigo: c.c, datos, fotos: archivos }); toast('Guardado: le llega a Trade Marketing.'); cerrar.despues = K.alCambiar || null; cerrar(); }
      catch (er) { msg.textContent = er.message; btn.disabled = false; btn.textContent = 'Guardar'; }
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
    // Fotos cargadas en el recorrido de una visita (13/11/2026): la sección y el comentario.
    if (x.seccion) return ['En la visita: ' + x.seccion, x.comentario].filter(Boolean).join(' · ');
    if (r.tipo === 'material') return [x.material, x.marca, x.comentario].filter(Boolean).join(' · ') || 'Foto';
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
          // Recorrido (13/11/2026): secciones hechas, comentarios, fotos y el aviso al vendedor.
          const det = (v.detalle && v.detalle.secciones) || [];
          const fotos = (v.fotos || []).map(p => (v.fotos_url || {})[p]).filter(Boolean);
          const av = v.aviso || {};
          return `<div class="fila"><div style="font-weight:800;min-width:52px">${hora(v.fecha)}</div><div class="cuerpo"><div class="tit">${esc(v.cliente_nombre || v.cliente_codigo)} <small style="color:var(--muted);font-weight:500">${esc(v.cliente_codigo)}</small></div>
            <div class="sub">${esc(TIPO1[v.tipo_cliente] || v.tipo_cliente || '')}${v.vendedor ? ' · Vendedor: ' + esc(v.vendedor) : ''}</div>
            ${det.length ? `<div class="chips">${det.map(s => `<span class="chip ${s.hecho ? 'verde' : 'gris'}">${esc(s.titulo)}${s.hecho ? '' : ' (sin terminar)'}</span>`).join('')}</div>` : (v.detalle ? '' : '<div class="chips"><span class="chip gris">Solo marcó que pasó</span></div>')}
            ${det.filter(s => s.comentario || (s.items || []).length).map(s => `<div class="sub" style="margin-top:4px"><b style="color:var(--ink)">${esc(s.titulo)}:</b> ${esc([(s.items || []).join(', '), s.comentario].filter(Boolean).join(' — '))}</div>`).join('')}
            ${v.nota ? `<div class="sub" style="margin-top:4px"><b style="color:var(--ink)">Nota${v.detalle ? ' para el vendedor' : ''}:</b> ${esc(v.nota)}</div>` : ''}
            ${fotos.length ? `<div class="fotos">${fotos.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="Abrir"><img src="${esc(u)}" alt="Foto ${i + 1}" loading="lazy"></a>`).join('')}</div>` : ''}
            ${(av.a || []).length ? `<div class="sub" style="margin-top:4px">Le llegó el aviso a ${esc(av.vendedor || 'el vendedor')}.</div>` : ''}
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
      csv('visitas-' + nom + '-' + desde + '-a-' + hasta + '.csv', [['Fecha', 'Día', 'Hora', 'Código', 'Cliente', 'Tipo', 'Vendedor', 'Secciones hechas', 'Fotos', 'Nota', 'Cargada el']].concat(
        vis.slice().sort((a, b) => a.fecha < b.fecha ? -1 : 1).map(v => [fecha(v.fecha), dia(v.fecha).split(' ')[0], hora(v.fecha), v.cliente_codigo, v.cliente_nombre, TIPO1[v.tipo_cliente] || v.tipo_cliente || '', v.vendedor || '',
          ((v.detalle && v.detalle.secciones) || []).filter(s => s.hecho).map(s => s.titulo).join(', '), (v.fotos || []).length, v.nota || '', fecha(v.registrada_at) + ' ' + hora(v.registrada_at)])));
    };
  }

  // ── Clientes nuevos ────────────────────────────────────────────────────────
  // ── Clientes nuevos (13/11/2026): dos partes. "Puntos de venta nuevos": lugares que el KAF
  // encontró y todavía no son clientes (nombre, ubicación y foto), para que los den de alta.
  // "Nuevos en CUBO": los que empezaron a comprar en el mes.
  const EST_NUE = { mes: '', pest: 'pdv' };
  async function renderNuevos(el, pest) {
    if (pest === 'pdv' || pest === 'cubo') EST_NUE.pest = pest;
    const P = EST_NUE.pest;
    el.innerHTML = `<div class="barra"><div class="tabs" id="kn-tabs"><button type="button" data-n="pdv" class="${P === 'pdv' ? 'on' : ''}">Puntos de venta nuevos</button><button type="button" data-n="cubo" class="${P === 'cubo' ? 'on' : ''}">Nuevos en CUBO</button></div></div><div id="kn-box"></div>`;
    el.querySelector('#kn-tabs').onclick = e => { const b = e.target.closest('[data-n]'); if (b) renderNuevos(el, b.dataset.n); };
    const box = el.querySelector('#kn-box');
    return P === 'pdv' ? renderPdv(box) : renderNuevosCubo(box);
  }
  const mapaDe = x => x.lat != null && x.lng != null ? 'https://www.google.com/maps?q=' + x.lat + ',' + x.lng : (x.direccion ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(x.direccion) : '');
  const EST_PDV_N = { nuevo: ['Para dar de alta', 'pendiente'], alta: ['Ya es cliente', 'aprobado'], descartado: ['Descartado', 'rechazado'] };
  function pdvHtml(x, puede) {
    const fs = (x.fotos_url || []).filter(Boolean), m = mapaDe(x), est = EST_PDV_N[x.estado] || [x.estado, ''];
    const mio = !K.yo || x.usuario_id === K.yo;
    return `<div class="fila"><div class="cuerpo">
        <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap"><div class="tit" style="flex:1">${esc(x.nombre)}</div><span class="estado e-${est[1]}">${esc(est[0])}${x.cliente_codigo ? ' · ' + esc(x.cliente_codigo) : ''}</span></div>
        <div class="sub">${esc([esKaf() && mio ? '' : x.solicitante, 'cargado el ' + fecha(x.created_at) + ' ' + hora(x.created_at)].filter(Boolean).join(' · '))}</div>
        ${datoHtml('Dirección', x.direccion)}
        ${m ? `<div style="font-size:13.5px;margin-top:4px"><a class="lnk" href="${esc(m)}" target="_blank" rel="noopener">Ver en el mapa</a>${x.lat != null ? ` <span style="color:var(--muted);font-size:12px">ubicación tomada con el celular${x.precision_m ? ' (±' + num(x.precision_m) + ' m)' : ''}</span>` : ''}</div>` : ''}
        ${x.comentario ? `<div style="font-size:13.5px;margin-top:6px;white-space:pre-wrap;background:var(--cream);border-radius:9px;padding:8px 10px">${esc(x.comentario)}</div>` : ''}
        ${fs.length ? `<div class="fotos">${fs.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="Abrir"><img src="${esc(u)}" alt="Foto ${i + 1}" loading="lazy"></a>`).join('')}</div>` : ''}
        ${x.revision ? `<div style="font-size:13.5px;margin-top:8px;background:var(--green-s);border-left:3px solid var(--green);border-radius:0 9px 9px 0;padding:8px 10px;white-space:pre-wrap"><b>${esc(x.revisado_por || 'Trade Marketing')}:</b> ${esc(x.revision)}</div>` : ''}
        ${esKaf() ? (x.estado === 'nuevo' && mio ? `<div style="margin-top:8px"><button class="lnk" type="button" data-pv-borrar="${esc(x.id)}">Borrar</button></div>` : '')
          : puede ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${x.estado === 'nuevo'
            ? `<button class="btn ok chico" type="button" data-pv="${esc(x.id)}" data-est="alta">Ya es cliente</button><button class="btn rojo chico" type="button" data-pv="${esc(x.id)}" data-est="descartado">Descartar</button>`
            : `<button class="btn claro chico" type="button" data-pv="${esc(x.id)}" data-est="nuevo">Volver a para dar de alta</button>`}</div>` : ''}
      </div></div>`;
  }
  const EST_PDV = { estado: 'nuevo' };
  async function renderPdv(el) {
    el.innerHTML = '<div class="vacio">Cargando…</div>';
    let d;
    try { d = await get('pdv'); } catch (e) { el.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    if (d.sinPerfil) { el.innerHTML = sinPerfilHtml(); return; }
    const L = d.pdv || [];
    el.innerHTML = `<div class="barra">${esKaf() ? '<button class="btn ok" type="button" id="pv-nuevo">Cargar punto de venta nuevo</button>' : ''}
        <select id="pv-est"><option value="nuevo">Para dar de alta</option><option value="alta">Ya son clientes</option><option value="descartado">Descartados</option><option value="">Todos</option></select>
        ${L.length ? '<button class="btn claro chico" type="button" id="pv-csv">Bajar Excel</button>' : ''}</div>
      <div class="cuenta" id="pv-cuenta"></div><div id="pv-l"></div>`;
    el.querySelector('#pv-est').value = EST_PDV.estado;
    const filtrados = () => L.filter(x => !EST_PDV.estado || x.estado === EST_PDV.estado);
    const pinta = () => {
      const l = filtrados();
      el.querySelector('#pv-cuenta').textContent = l.length ? num(l.length) + (l.length === 1 ? ' punto de venta' : ' puntos de venta') : '';
      el.querySelector('#pv-l').innerHTML = l.length ? l.map(x => pdvHtml(x, d.puedeAtender)).join('')
        : `<div class="vacio">${L.length ? 'No hay puntos de venta con ese filtro.' : esKaf() ? 'Todavía no cargaste puntos de venta nuevos. Cuando encuentres un lugar que todavía no es cliente, cargalo con el nombre, la ubicación y una foto: le llega a Trade Marketing para darlo de alta.' : 'Este KAF todavía no cargó puntos de venta nuevos.'}</div>`;
    };
    pinta();
    el.querySelector('#pv-est').onchange = e => { EST_PDV.estado = e.target.value; pinta(); };
    const nu = el.querySelector('#pv-nuevo'); if (nu) nu.onclick = () => formPdv(null, () => { EST_PDV.estado = 'nuevo'; renderPdv(el); });
    const cv = el.querySelector('#pv-csv');
    if (cv) cv.onclick = () => csv('puntos-de-venta-nuevos-' + slugMarca() + '-' + hoy() + '.csv', [['Nombre', 'Dirección', 'Latitud', 'Longitud', 'Mapa', 'Cargado por', 'Fecha', 'Estado', 'Código de cliente', 'Comentario']]
      .concat(filtrados().map(x => [x.nombre, x.direccion, x.lat, x.lng, mapaDe(x), x.solicitante, fecha(x.created_at), (EST_PDV_N[x.estado] || [x.estado])[0], x.cliente_codigo, x.comentario])));
    el.querySelector('#pv-l').onclick = async e => {
      const bb = e.target.closest('[data-pv-borrar]');
      if (bb) { if (!confirm('¿Borrar este punto de venta?')) return; try { await post({ accion: 'borrar_pdv', id: bb.dataset.pvBorrar }); toast('Borrado'); renderPdv(el); } catch (er) { toast(er.message, true); } return; }
      const b = e.target.closest('[data-pv]'); if (!b) return;
      const x = L.find(y => y.id === b.dataset.pv), est = b.dataset.est;
      let codigo = '', revision = '';
      if (est === 'alta') { const c = prompt('Código de cliente en CUBO (si ya lo tiene; si no, dejalo vacío):', ''); if (c === null) return; codigo = c.trim(); revision = prompt('Comentario para el KAF (opcional):', '') || ''; }
      if (est === 'descartado') { const r = prompt('¿Por qué se descarta? (le llega al KAF)'); if (r === null) return; if (!r.trim()) { toast('Contale por qué se descarta.', true); return; } revision = r; }
      b.disabled = true;
      try { await post({ accion: 'atender_pdv', id: x.id, estado: est, codigo, revision }); toast(est === 'nuevo' ? 'Volvió a para dar de alta' : 'Listo: le avisamos al KAF'); renderPdv(el); if (K.alCambiar && !esKaf()) K.alCambiar(); }
      catch (er) { b.disabled = false; toast(er.message, true); }
    };
  }
  // Cargar un punto de venta nuevo: nombre, ubicación (la del celular o la dirección) y foto.
  function formPdv(archivos0, alGuardar) {
    const mb = ventana('Punto de venta nuevo', 'Un lugar que todavía no es cliente: nombre, ubicación y una foto. Le llega a Trade Marketing para darlo de alta.');
    let archivos = (archivos0 || []).slice(0, 4), geo = null;
    mb.innerHTML = `<label class="campo"><span>Nombre del punto de venta</span><input id="pv-nom" maxlength="160" placeholder="Ej. Bar La Esquina"></label>
      <div class="campo"><span>Ubicación</span>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn navy" type="button" id="pv-gps">Usar mi ubicación</button><span id="pv-gps-t" style="font-size:13px;color:var(--muted)">Estando en el lugar, tomá la ubicación del celular.</span></div>
        <input id="pv-dir" maxlength="300" placeholder="Dirección (calle, número, localidad)" style="margin-top:8px"></div>
      <label class="btn navy grande" style="margin:2px 0 8px">${CAM} Sacar o subir fotos<input type="file" id="pv-file" accept="image/*" multiple hidden></label>
      <div class="fotos kv-fotos" id="pv-prev"></div>
      <label class="campo" style="margin-top:12px"><span>Comentario (opcional)</span><textarea id="pv-com" maxlength="1000" placeholder="Qué tipo de lugar es, con quién hablaste, qué marcas tiene…"></textarea></label>
      <div class="msg" id="pv-msg"></div>
      <div class="acts"><button class="btn claro" type="button" id="pv-cancel">Cancelar</button><button class="btn ok" type="button" id="pv-ok">Guardar</button></div>`;
    const prev = () => { mb.querySelector('#pv-prev').innerHTML = archivos.map((a, i) => `<a href="#"><img src="${a}" alt=""><button type="button" class="quitar" data-q="${i}" aria-label="Sacar la foto">×</button></a>`).join(''); };
    prev();
    mb.querySelector('#pv-prev').onclick = e => { if (e.target.closest('a')) e.preventDefault(); const q = e.target.closest('[data-q]'); if (q) { archivos.splice(Number(q.dataset.q), 1); prev(); } };
    mb.querySelector('#pv-file').onchange = async e => {
      for (const f of [...e.target.files].slice(0, 4 - archivos.length)) { try { archivos.push(await leerArchivo(f)); } catch (er) { toast(er.message, true); } }
      e.target.value = ''; prev();
      if (archivos.length >= 4) toast('Hasta 4 fotos.');
    };
    mb.querySelector('#pv-gps').onclick = () => {
      const t = mb.querySelector('#pv-gps-t');
      if (!navigator.geolocation) { t.textContent = 'Este celular no da la ubicación: escribí la dirección.'; return; }
      t.textContent = 'Buscando la ubicación…';
      navigator.geolocation.getCurrentPosition(p => {
        geo = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy };
        t.innerHTML = `Ubicación tomada (±${num(geo.precision)} m) · <a class="lnk" href="https://www.google.com/maps?q=${geo.lat},${geo.lng}" target="_blank" rel="noopener">Ver en el mapa</a>`;
      }, er => { t.textContent = er && er.code === 1 ? 'No diste permiso para usar la ubicación: activalo o escribí la dirección.' : 'No se pudo tomar la ubicación: escribí la dirección.'; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    };
    mb.querySelector('#pv-cancel').onclick = () => { cerrar.despues = null; cerrar(); };
    mb.querySelector('#pv-ok').onclick = async ev => {
      const btn = ev.currentTarget, msg = mb.querySelector('#pv-msg'), v = id => mb.querySelector(id).value.trim();
      msg.textContent = '';
      if (!v('#pv-nom')) { msg.textContent = 'Poné el nombre del punto de venta.'; return; }
      if (!geo && !v('#pv-dir')) { msg.textContent = 'Falta la ubicación: tocá "Usar mi ubicación" o escribí la dirección.'; return; }
      if (!archivos.length) { msg.textContent = 'Sacale una foto al punto de venta.'; return; }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await post(Object.assign({ accion: 'pdv', nombre: v('#pv-nom'), direccion: v('#pv-dir'), comentario: v('#pv-com'), fotos: archivos }, geo || {}));
        toast('Guardado: le llega a Trade Marketing para darlo de alta.');
        cerrar.despues = alGuardar || null; cerrar();
      } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Guardar'; }
    };
  }
  async function renderNuevosCubo(el) {
    const m0 = mesDe(hoy());
    const mes = EST_NUE.mes || m0;
    el.innerHTML = `<div class="barra"><select id="kn-mes">${[0, 1, 2, 3, 4, 5].map(i => { const m = mesMenos(m0, i); return `<option value="${m}" ${m === mes ? 'selected' : ''}>${esc(mesNombre(m))}</option>`; }).join('')}</select></div><div id="kn-cont"><div class="vacio">Calculando con las ventas de CUBO…</div></div>`;
    el.querySelector('#kn-mes').onchange = e => { EST_NUE.mes = e.target.value; renderNuevosCubo(el); };
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

  // ── Etapa 2 (13/11/2026): materiales sin stock ─────────────────────────────
  // Catálogo dividido por marca (la foto se baja o se comparte), exhibidores que quedan
  // instalados en los clientes (con foto, los ven Trade y el vendedor) y pedidos especiales
  // de algo que no está en el catálogo, que Trade Marketing presupuesta.
  const ESP = { pendiente: 'Para presupuestar', presupuestado: 'Presupuestado', aprobado: 'Aprobado', rechazado: 'Rechazado', entregado: 'Entregado' };
  async function catalogo(forzar) {
    if (K.mats && K.mats._kaf === K.kaf && !forzar) return K.mats;
    K.mats = Object.assign(await get('materiales'), { _kaf: K.kaf });
    return K.mats;
  }
  const archivoDe = m => (String(m.nombre || 'material').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-') || 'material')
    + '.' + ((/\.(png|jpe?g|webp)(\?|$)/i.exec(m.foto || '') || [0, 'jpg'])[1]);
  const datoHtml = (k, v) => v ? `<div style="font-size:13.5px;margin-top:4px;white-space:pre-wrap"><span style="color:var(--muted)">${esc(k)}:</span> ${esc(v)}</div>` : '';

  // Un material del catálogo, grande: para mostrárselo al cliente, bajarlo o mandarlo.
  function verMaterial(m, botones) {
    const mb = ventana(m.nombre, [m.marca || m.proveedor, m.categoria].filter(Boolean).join(' · '));
    const baja = m.foto ? m.foto + (m.foto.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(archivoDe(m)) : '';
    mb.innerHTML = `${m.foto ? `<div class="foto-grande"><img src="${esc(m.foto)}" alt="${esc(m.nombre)}"></div>
        <div class="acts" style="justify-content:flex-start;margin-top:10px"><a class="btn navy" href="${esc(baja)}" download="${esc(archivoDe(m))}">Descargar la foto</a>${navigator.share ? '<button class="btn claro" type="button" id="vm-comp">Compartir</button>' : ''}</div>`
        : '<div class="vacio">Este material no tiene foto cargada.</div>'}
      <div class="bloque">${datoHtml('Marca', m.marca)}${datoHtml('Proveedor', m.proveedor)}${datoHtml('Categoría', m.categoria)}${datoHtml('Stock en el depósito', num(m.stock) + (m.unidad ? ' ' + m.unidad : ''))}
        ${datoHtml('Descripción', m.descripcion)}${datoHtml('Cómo se usa', m.instrucciones)}
        ${m.pdf || m.video ? `<div style="display:flex;gap:14px;margin-top:8px;flex-wrap:wrap">${m.pdf ? `<a class="lnk" href="${esc(m.pdf)}" target="_blank" rel="noopener">Ver el PDF</a>` : ''}${m.video ? `<a class="lnk" href="${esc(m.video)}" target="_blank" rel="noopener">Ver el video</a>` : ''}</div>` : ''}</div>
      ${botones || ''}`;
    const comp = mb.querySelector('#vm-comp');
    if (comp) comp.onclick = async () => {
      try {
        const bl = await (await fetch(m.foto)).blob();
        const f = new File([bl], archivoDe(m), { type: bl.type || 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: m.nombre });
        else await navigator.share({ title: m.nombre, url: m.foto });
      } catch (e) { if (e && e.name !== 'AbortError') toast('No se pudo compartir: bajá la foto y mandala.', true); }
    };
    return mb;
  }

  // ── Exhibidores ────────────────────────────────────────────────────────────
  const diasDesde = v => v ? Math.max(0, Math.floor((Date.now() - new Date(v)) / 864e5)) : null;
  function exhibidorFila(x, conCliente) {
    const fs = (x.fotos_url || []).filter(Boolean), u = fs[fs.length - 1], d = diasDesde(x.foto_at || x.created_at);
    return `<div class="fila click exh" data-ex="${esc(x.id)}">
        <div class="exh-img">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : ''}</div>
        <div class="cuerpo"><div class="tit">${num(x.cantidad)} × ${esc(x.material)}</div>
          <div class="sub">${esc([conCliente ? (x.cliente_nombre || x.cliente_codigo) : '', x.linea, 'instalado el ' + fecha(x.instalado)].filter(Boolean).join(' · '))}</div>
          <div class="chips">${x.estado === 'retirado' ? `<span class="chip gris">Retirado${x.retirado ? ' el ' + fecha(x.retirado) : ''}</span>`
            : `<span class="chip ${d > 90 ? 'ambar' : 'verde'}">Última foto: ${d === 0 ? 'hoy' : 'hace ' + num(d) + (d === 1 ? ' día' : ' días')}</span>`}</div></div></div>`;
  }
  function verExhibidor(x, alCambiar) {
    const mb = ventana(num(x.cantidad) + ' × ' + x.material, [x.cliente_nombre, x.cliente_codigo].filter(Boolean).join(' · '));
    const fs = (x.fotos_url || []).filter(Boolean);
    const borrable = esKaf() && (!K.yo || x.usuario_id === K.yo) && Date.now() - new Date(x.created_at) < 7 * 864e5;
    mb.innerHTML = `${fs.length ? `<div class="foto-grande"><img id="vx-img" src="${esc(fs[fs.length - 1])}" alt="Foto del exhibidor"></div>
        ${fs.length > 1 ? `<div class="fotos">${fs.map((u, i) => `<a href="#" data-f="${i}" title="Ver"><img src="${esc(u)}" alt="Foto ${i + 1}"></a>`).join('')}</div>` : ''}` : '<div class="vacio">Sin fotos.</div>'}
      <div class="bloque"><span class="estado e-${esc(x.estado)}">${x.estado === 'retirado' ? 'Retirado' + (x.retirado ? ' el ' + fecha(x.retirado) : '') : 'Instalado'}</span>
        ${datoHtml('Marca', x.linea)}${datoHtml('Instalado el', fecha(x.instalado))}${datoHtml('Última foto', x.foto_at ? fecha(x.foto_at) : '')}${datoHtml('Nota', x.nota)}${datoHtml('Por qué se retiró', x.retiro_nota)}</div>
      ${esKaf() ? `<div class="acts" style="justify-content:flex-start">
          <label class="btn navy">${CAM} Sumar foto nueva<input type="file" id="vx-file" accept="image/*" multiple hidden></label>
          <button class="btn claro" type="button" id="vx-editar">Corregir datos</button>
          ${x.estado === 'instalado' ? '<button class="btn rojo" type="button" id="vx-retirar">Ya no está</button>' : '<button class="btn claro" type="button" id="vx-reinst">Volvió a estar</button>'}</div>` : ''}
      <div class="msg" id="vx-msg"></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px"><button class="lnk" type="button" id="vx-ficha">Ver la ficha del cliente</button>${borrable ? '<button class="lnk" type="button" id="vx-borrar">Borrar (lo cargué por error)</button>' : ''}</div>`;
    const listo = (t, ex) => { toast(t); cerrar.despues = alCambiar ? () => alCambiar(ex) : null; cerrar(); };
    const enviar = async (body, t) => {
      mb.querySelector('#vx-msg').textContent = '';
      try { const r = await post(Object.assign({ accion: 'exhibidor', id: x.id }, body)); listo(t, r.exhibidor); }
      catch (e) { mb.querySelector('#vx-msg').textContent = e.message; }
    };
    mb.onclick = async e => {
      const f = e.target.closest('[data-f]');
      if (f) { e.preventDefault(); mb.querySelector('#vx-img').src = fs[Number(f.dataset.f)]; return; }
      if (e.target.closest('#vx-ficha')) { cerrar.despues = null; cerrar(); abrirFicha(x.cliente_codigo); return; }
      if (e.target.closest('#vx-editar')) { formExhibidor(x, null, { alGuardar: alCambiar }); return; }
      if (e.target.closest('#vx-retirar')) { const n = prompt('¿Qué pasó? (opcional: lo sacaron, se rompió, lo devolvieron…)'); if (n === null) return; enviar({ estado: 'retirado', retiro_nota: n }, 'Marcado como retirado'); return; }
      if (e.target.closest('#vx-reinst')) { enviar({ estado: 'instalado' }, 'Volvió a instalado'); return; }
      if (e.target.closest('#vx-borrar')) {
        if (!confirm('¿Borrar este exhibidor? Se borran también sus fotos.')) return;
        try { await post({ accion: 'borrar_exhibidor', id: x.id }); listo('Borrado', null); } catch (er) { mb.querySelector('#vx-msg').textContent = er.message; }
      }
    };
    const fi = mb.querySelector('#vx-file');
    if (fi) fi.onchange = async () => {
      const arch = [];
      for (const fl of [...fi.files].slice(0, 4)) { try { arch.push(await leerArchivo(fl)); } catch (er) { toast(er.message, true); } }
      fi.value = '';
      if (!arch.length) return;
      mb.querySelector('#vx-msg').textContent = 'Subiendo…';
      enviar({ fotos: arch }, 'Foto nueva guardada');
    };
  }
  // Alta o corrección. Del catálogo de la marca, o escrito a mano si no está.
  async function formExhibidor(x, cliente, op) {
    op = op || {};
    const mb = ventana(x ? 'Corregir exhibidor' : 'Registrar exhibidor', x ? [x.cliente_nombre, x.cliente_codigo].filter(Boolean).join(' · ') : 'Lo que queda instalado en el cliente (heladera, exhibidor, cartel luminoso…), con foto. Le llega a Trade Marketing y al vendedor.');
    let mats = [];
    try { mats = ((await catalogo()).materiales || []).filter(m => m.mia); } catch (e) { mats = []; }
    if (op.material && !mats.some(m => m.id === op.material.id)) mats = [op.material].concat(mats);
    const elegidoMat = x ? (x.material_id || '') : (op.material ? op.material.id : '');
    const enCat = !!elegidoMat && mats.some(m => m.id === elegidoMat);
    let archivos = (op.archivos || []).slice(0, 4), quitar = [];
    const viejas = x ? (x.fotos || []).map((p, i) => ({ p, u: (x.fotos_url || [])[i] })) : [];
    mb.innerHTML = `${x ? '' : '<label class="campo"><span>Cliente</span><div id="ke-cli"></div></label>'}
      <label class="campo"><span>¿Qué exhibidor es?</span><select id="ke-mat">
        ${mats.length ? `<optgroup label="Del catálogo de materiales">${mats.map(m => `<option value="${esc(m.id)}" ${enCat && m.id === elegidoMat ? 'selected' : ''}>${esc(m.nombre)}${m.marca ? ' · ' + esc(m.marca) : ''}</option>`).join('')}</optgroup>` : ''}
        <option value="" ${enCat ? '' : 'selected'}>${mats.length ? 'Otro, no está en el catálogo' : 'Lo escribo'}</option></select></label>
      <label class="campo" id="ke-otro-c"><span>Qué es</span><input id="ke-otro" maxlength="160" value="${esc(x && !enCat ? x.material : '')}" placeholder="Ej. Heladera Aperol de una puerta"></label>
      <div class="dos"><label class="campo"><span>Cantidad</span><input id="ke-cant" inputmode="numeric" value="${x ? x.cantidad : 1}"></label>
        <label class="campo"><span>Instalado el</span><input type="date" id="ke-fecha" value="${x ? esc(x.instalado) : hoy()}" max="${hoy()}"></label></div>
      <label class="campo"><span>Nota (opcional)</span><textarea id="ke-nota" maxlength="1000" placeholder="Dónde está, en qué estado, qué se acordó con el cliente…">${esc(x ? x.nota || '' : '')}</textarea></label>
      <label class="btn navy grande" style="margin:2px 0 8px">${CAM} ${x ? 'Sumar fotos' : 'Sacar o subir fotos'}<input type="file" id="ke-file" accept="image/*" multiple hidden></label>
      <div class="fotos kv-fotos" id="ke-prev"></div>
      ${x ? '' : '<label class="kv-item" style="border:0;padding:6px 0"><input type="checkbox" id="ke-avisar" checked><span>Avisarle al vendedor del cliente (le llega a la campanita del Portal)</span></label>'}
      <div class="msg" id="ke-msg"></div>
      <div class="acts"><button class="btn claro" type="button" id="ke-cancel">Cancelar</button><button class="btn ok" type="button" id="ke-ok">Guardar</button></div>`;
    const elegido = x ? null : picker(mb.querySelector('#ke-cli'), cliente || null, false);
    const sel = mb.querySelector('#ke-mat'), otro = mb.querySelector('#ke-otro-c');
    const sync = () => { otro.style.display = sel.value ? 'none' : ''; };
    sel.onchange = sync; sync();
    const prev = () => {
      mb.querySelector('#ke-prev').innerHTML = viejas.filter(f => !quitar.includes(f.p)).map(f => `<a href="#"><img src="${esc(f.u || '')}" alt=""><button type="button" class="quitar" data-qv="${esc(f.p)}" aria-label="Sacar la foto">×</button></a>`).join('')
        + archivos.map((a, i) => `<a href="#"><img src="${a}" alt=""><button type="button" class="quitar" data-q="${i}" aria-label="Sacar la foto">×</button></a>`).join('');
    };
    prev();
    mb.querySelector('#ke-file').onchange = async e => {
      for (const f of [...e.target.files].slice(0, 4 - archivos.length)) { try { archivos.push(await leerArchivo(f)); } catch (er) { toast(er.message, true); } }
      e.target.value = ''; prev();
      if (archivos.length >= 4) toast('Hasta 4 fotos por vez.');
    };
    mb.querySelector('#ke-prev').onclick = e => {
      const q = e.target.closest('[data-q]'), qv = e.target.closest('[data-qv]');
      if (q || qv || e.target.closest('a')) e.preventDefault();
      if (q) { archivos.splice(Number(q.dataset.q), 1); prev(); }
      if (qv) { quitar.push(qv.dataset.qv); prev(); }
    };
    mb.querySelector('#ke-cancel').onclick = () => { cerrar.despues = null; cerrar(); };
    mb.querySelector('#ke-ok').onclick = async ev => {
      const btn = ev.currentTarget, msg = mb.querySelector('#ke-msg'), c = x ? null : elegido();
      const material_id = sel.value || null, material = sel.value ? '' : mb.querySelector('#ke-otro').value.trim();
      msg.textContent = '';
      if (!x && !c) { msg.textContent = 'Elegí el cliente.'; return; }
      if (!material_id && !material) { msg.textContent = 'Elegí del catálogo o escribí qué exhibidor es.'; return; }
      if (!x && !archivos.length) { msg.textContent = 'Sacale una foto al exhibidor instalado.'; return; }
      if (x && viejas.length && viejas.every(f => quitar.includes(f.p)) && !archivos.length) { msg.textContent = 'Dejale al menos una foto.'; return; }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const r = await post({ accion: 'exhibidor', id: x ? x.id : undefined, codigo: c ? c.c : undefined, material_id, material, cantidad: mb.querySelector('#ke-cant').value,
          instalado: mb.querySelector('#ke-fecha').value, nota: mb.querySelector('#ke-nota').value, fotos: archivos, quitar, avisar: x ? undefined : mb.querySelector('#ke-avisar').checked });
        toast(x ? 'Exhibidor corregido' : 'Exhibidor registrado' + (r.avisoVendedor ? ': le avisamos a ' + r.avisoVendedor : ''));
        cerrar.despues = op.alGuardar ? () => op.alGuardar(r.exhibidor) : null; cerrar();
      } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Guardar'; }
    };
  }
  const EST_EX = { estado: 'instalado', q: '' };
  async function renderExhibidores(el) {
    el.innerHTML = '<div class="vacio">Cargando…</div>';
    let d;
    try { d = await get('exhibidores'); } catch (e) { el.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    if (d.sinPerfil) { el.innerHTML = sinPerfilHtml(); return; }
    const L = d.exhibidores || [];
    el.innerHTML = `<div class="barra">${esKaf() ? '<button class="btn ok" type="button" id="ex-nuevo">Registrar exhibidor</button>' : ''}
        <select id="ex-est"><option value="instalado">Instalados</option><option value="retirado">Retirados</option><option value="">Todos</option></select>
        <input type="search" id="ex-q" placeholder="Buscar cliente o exhibidor…" value="${esc(EST_EX.q)}" autocomplete="off">
        ${L.length ? '<button class="btn claro chico" type="button" id="ex-csv">Bajar Excel</button>' : ''}</div>
      <div class="cuenta" id="ex-cuenta"></div><div id="ex-l"></div>`;
    el.querySelector('#ex-est').value = EST_EX.estado;
    const filtrados = () => { const q = EST_EX.q.trim().toLowerCase(); return L.filter(x => (!EST_EX.estado || x.estado === EST_EX.estado) && (!q || [x.cliente_nombre, x.cliente_codigo, x.material, x.linea, x.nota].join(' ').toLowerCase().includes(q))); };
    const pinta = () => {
      const l = filtrados(), nc = new Set(l.map(x => x.cliente_codigo)).size;
      el.querySelector('#ex-cuenta').textContent = l.length ? num(l.length) + (l.length === 1 ? ' exhibidor' : ' exhibidores') + ' en ' + num(nc) + (nc === 1 ? ' cliente' : ' clientes') : '';
      el.querySelector('#ex-l').innerHTML = l.length ? l.map(x => exhibidorFila(x, true)).join('')
        : `<div class="vacio">${L.length ? 'No hay exhibidores con ese filtro.' : esKaf() ? 'Todavía no registraste exhibidores. Cuando instales uno en un cliente, registralo con una foto: queda en su ficha y le llega a Trade Marketing y al vendedor.' : 'Este KAF todavía no registró exhibidores.'}</div>`;
    };
    pinta();
    el.querySelector('#ex-est').onchange = e => { EST_EX.estado = e.target.value; pinta(); };
    el.querySelector('#ex-q').oninput = e => { EST_EX.q = e.target.value; pinta(); };
    const nu = el.querySelector('#ex-nuevo'); if (nu) nu.onclick = () => formExhibidor(null, null, { alGuardar: () => renderExhibidores(el) });
    const cv = el.querySelector('#ex-csv');
    if (cv) cv.onclick = () => csv('exhibidores-' + slugMarca() + '-' + hoy() + '.csv', [['Cliente', 'Código', 'Exhibidor', 'Marca', 'Cantidad', 'Instalado', 'Estado', 'Retirado', 'Última foto', 'Nota']]
      .concat(filtrados().map(x => [x.cliente_nombre, x.cliente_codigo, x.material, x.linea, x.cantidad, fecha(x.instalado), x.estado === 'retirado' ? 'Retirado' : 'Instalado', x.retirado ? fecha(x.retirado) : '', x.foto_at ? fecha(x.foto_at) : '', x.nota])));
    el.querySelector('#ex-l').onclick = e => { const f = e.target.closest('[data-ex]'); if (!f) return; verExhibidor(L.find(x => x.id === f.dataset.ex), () => renderExhibidores(el)); };
  }
  const slugMarca = () => String((K.perfil || {}).marca || 'kaf').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

  // ── Pedidos especiales ─────────────────────────────────────────────────────
  function formEspecial(cliente, alGuardar) {
    const mb = ventana('Pedido especial', 'Algo que no está en el catálogo y hay que presupuestar (por ejemplo, un fondo de barra). Le llega a Trade Marketing.');
    let archivos = [];
    mb.innerHTML = `<label class="campo"><span>¿Qué necesitás?</span><input id="ks-que" maxlength="200" placeholder="Ej. Fondo de barra con la marca"></label>
      <div class="dos"><label class="campo"><span>Cantidad</span><input id="ks-cant" inputmode="numeric" value="1"></label>
        <label class="campo"><span>¿Para cuándo? (opcional)</span><input type="date" id="ks-cuando" min="${hoy()}"></label></div>
      <label class="campo"><span>Medidas (si hace falta)</span><input id="ks-med" maxlength="300" placeholder="Ej. 3 m de ancho por 1,10 m de alto"></label>
      <label class="campo"><span>Cliente (opcional)</span><div id="ks-cli"></div></label>
      <label class="campo"><span>Detalle</span><textarea id="ks-det" maxlength="2000" placeholder="Para qué es, cómo lo imaginás, qué pone el cliente…"></textarea></label>
      <label class="campo"><span>Fotos del lugar o de referencia, o un PDF (hasta 4)</span><input type="file" id="ks-fotos" accept="image/*,application/pdf" multiple></label>
      <div class="fotos" id="ks-prev"></div>
      <div class="msg" id="ks-msg"></div>
      <div class="acts"><button class="btn claro" type="button" id="ks-cancel">Cancelar</button><button class="btn ok" type="button" id="ks-ok">Enviar a Trade Marketing</button></div>`;
    const elegido = picker(mb.querySelector('#ks-cli'), cliente || null, true);
    const prev = () => { mb.querySelector('#ks-prev').innerHTML = archivos.map((a, i) => `<a href="#" data-q="${i}" title="Sacar">${a.startsWith('data:application/pdf') ? 'PDF' : `<img src="${a}" alt="">`}</a>`).join(''); };
    mb.querySelector('#ks-fotos').onchange = async e => {
      for (const f of [...e.target.files].slice(0, 4 - archivos.length)) { try { archivos.push(await leerArchivo(f)); } catch (er) { toast(er.message, true); } }
      e.target.value = ''; prev();
    };
    mb.querySelector('#ks-prev').onclick = e => { const a = e.target.closest('[data-q]'); if (!a) return; e.preventDefault(); archivos.splice(Number(a.dataset.q), 1); prev(); };
    mb.querySelector('#ks-cancel').onclick = () => { cerrar.despues = null; cerrar(); };
    mb.querySelector('#ks-ok').onclick = async ev => {
      const btn = ev.currentTarget, msg = mb.querySelector('#ks-msg'), v = id => mb.querySelector(id).value.trim(), c = elegido();
      msg.textContent = '';
      if (!v('#ks-que')) { msg.textContent = 'Contá qué necesitás.'; return; }
      btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        await post({ accion: 'especial', que: v('#ks-que'), cantidad: v('#ks-cant'), para_cuando: v('#ks-cuando'), medidas: v('#ks-med'), detalle: v('#ks-det'), codigo: c ? c.c : null, fotos: archivos });
        toast('Pedido enviado: Trade Marketing lo presupuesta y te avisa.');
        cerrar.despues = alGuardar || null; cerrar();
      } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Enviar a Trade Marketing'; }
    };
  }
  function especialHtml(p, puedeAtender) {
    const archivos = (p.fotos_url || []).filter(f => f.url);
    const pz = p.presupuesto_url && p.presupuesto_url.url ? p.presupuesto_url : null;
    return `<div class="fila"><div class="cuerpo">
        <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap"><div class="tit" style="flex:1">${num(p.cantidad)} × ${esc(p.que)}</div><span class="estado e-${esc(p.estado)}">${esc(ESP[p.estado] || p.estado)}</span></div>
        <div class="sub">${esc([esKaf() ? '' : p.solicitante, 'pedido el ' + fecha(p.created_at), p.cliente_nombre ? p.cliente_nombre + ' (' + p.cliente_codigo + ')' : ''].filter(Boolean).join(' · '))}</div>
        ${datoHtml('Medidas', p.medidas)}${datoHtml('Para cuándo', p.para_cuando ? fecha(p.para_cuando) : '')}
        ${p.detalle ? `<div style="font-size:13.5px;margin-top:6px;white-space:pre-wrap;background:var(--cream);border-radius:9px;padding:8px 10px">${esc(p.detalle)}</div>` : ''}
        ${archivos.length ? `<div class="fotos">${archivos.map((f, i) => `<a href="${esc(f.url)}" target="_blank" rel="noopener" title="Abrir">${f.pdf ? 'PDF' : `<img src="${esc(f.url)}" alt="Foto ${i + 1}" loading="lazy">`}</a>`).join('')}</div>` : ''}
        ${p.monto != null || p.proveedor || pz ? `<div class="presu"><b>Presupuesto</b>${esc([p.monto != null ? plata(p.monto) : '', p.proveedor].filter(Boolean).join(' · '))}${pz ? ` <a class="lnk" href="${esc(pz.url)}" target="_blank" rel="noopener">Ver ${pz.pdf ? 'el PDF' : 'la foto'}</a>` : ''}</div>` : ''}
        ${p.respuesta ? `<div style="font-size:13.5px;margin-top:8px;background:var(--green-s);border-left:3px solid var(--green);border-radius:0 9px 9px 0;padding:8px 10px;white-space:pre-wrap"><b>${esc(p.atendido_por || 'Trade Marketing')}:</b> ${esc(p.respuesta)}</div>` : ''}
        ${esKaf() ? (p.estado === 'pendiente' ? `<div style="margin-top:8px"><button class="lnk" type="button" data-borrar-esp="${esc(p.id)}">Borrar</button></div>` : '')
          : puedeAtender ? `<div style="margin-top:8px"><button class="btn navy chico" type="button" data-atender="${esc(p.id)}">${p.estado === 'pendiente' ? 'Presupuestar o responder' : 'Cambiar estado'}</button></div>` : ''}
      </div></div>`;
  }
  async function renderEspeciales(el) {
    el.innerHTML = '<div class="vacio">Cargando…</div>';
    let d;
    try { d = await get('especiales'); } catch (e) { el.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; return; }
    const L = d.especiales || [];
    el.innerHTML = `${esKaf() ? '<div class="barra"><button class="btn ok" type="button" id="es-nuevo">Nuevo pedido especial</button></div>' : ''}
      ${L.length ? L.map(p => especialHtml(p, d.puedeAtender)).join('') : `<div class="vacio">${esKaf() ? 'Todavía no hiciste pedidos especiales. Si necesitás algo que no está en el catálogo (un fondo de barra, una carta, un exhibidor a medida), pedilo acá: Trade Marketing lo presupuesta y te avisa.' : 'Este KAF todavía no hizo pedidos especiales.'}</div>`}`;
    const nu = el.querySelector('#es-nuevo'); if (nu) nu.onclick = () => formEspecial(null, () => renderEspeciales(el));
    el.onclick = async e => {
      const b = e.target.closest('[data-borrar-esp]');
      if (b) { if (!confirm('¿Borrar este pedido especial?')) return; try { await post({ accion: 'borrar_especial', id: b.dataset.borrarEsp }); toast('Borrado'); renderEspeciales(el); } catch (er) { toast(er.message, true); } return; }
      const a = e.target.closest('[data-atender]');
      if (a) atenderEspecial(L.find(x => x.id === a.dataset.atender), () => { if (K.alCambiar) K.alCambiar(); else renderEspeciales(el); });
    };
  }
  // Trade Marketing: presupuesta, aprueba o rechaza, y avisa cuando está.
  function atenderEspecial(p, alGuardar) {
    const mb = ventana('Pedido especial de ' + (p.solicitante || 'el KAF'), num(p.cantidad) + ' × ' + p.que + (p.cliente_nombre ? ' · ' + p.cliente_nombre : ''));
    let archivo = null;
    const est0 = p.estado === 'pendiente' ? 'presupuestado' : p.estado;
    mb.innerHTML = `<div class="campo"><span>Estado</span><div class="opciones grilla">${Object.keys(ESP).map(k => `<label><input type="radio" name="ae-est" value="${k}" ${k === est0 ? 'checked' : ''}> ${esc(ESP[k])}</label>`).join('')}</div></div>
      <div class="dos"><label class="campo"><span>Monto del presupuesto ($)</span><input id="ae-monto" inputmode="decimal" value="${p.monto != null ? esc(p.monto) : ''}"></label>
        <label class="campo"><span>Proveedor</span><input id="ae-prov" maxlength="160" value="${esc(p.proveedor || '')}"></label></div>
      <label class="campo"><span>Presupuesto en PDF o foto (opcional${p.presupuesto ? '; reemplaza el que está' : ''})</span><input type="file" id="ae-arch" accept="image/*,application/pdf"></label>
      <label class="campo"><span>Mensaje para el KAF</span><textarea id="ae-resp" maxlength="800" placeholder="Qué incluye, plazos, por qué no sale…">${esc(p.respuesta || '')}</textarea></label>
      <div class="msg" id="ae-msg"></div>
      <div class="acts"><button class="btn claro" type="button" id="ae-cancel">Cancelar</button><button class="btn ok" type="button" id="ae-ok">Guardar y avisarle</button></div>`;
    mb.querySelector('#ae-arch').onchange = async e => { const f = e.target.files[0]; archivo = null; if (!f) return; try { archivo = await leerArchivo(f); } catch (er) { toast(er.message, true); e.target.value = ''; } };
    mb.querySelector('#ae-cancel').onclick = () => { cerrar.despues = null; cerrar(); };
    mb.querySelector('#ae-ok').onclick = async ev => {
      const btn = ev.currentTarget, msg = mb.querySelector('#ae-msg');
      const estado = (mb.querySelector('input[name="ae-est"]:checked') || {}).value;
      msg.textContent = '';
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await post({ accion: 'atender_especial', id: p.id, estado, monto: mb.querySelector('#ae-monto').value.trim(), proveedor: mb.querySelector('#ae-prov').value, respuesta: mb.querySelector('#ae-resp').value, archivo: archivo || undefined });
        toast(estado === 'pendiente' ? 'Volvió a para presupuestar' : 'Guardado: le avisamos al KAF');
        cerrar.despues = alGuardar || null; cerrar();
      } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Guardar y avisarle'; }
    };
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
    renderInicio, renderClientes, abrirFicha, renderVisitas, renderNuevos, renderRegistros, formRegistro, modeloHtml, pedidoHtml, sinPerfilHtml, supa,
    renderVisita, fotoRapida, borrador,
    ESP, catalogo, verMaterial, formExhibidor, renderExhibidores, formEspecial, renderEspeciales, formPdv };
})();
