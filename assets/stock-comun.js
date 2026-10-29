// ─── Stock del depósito: lo que comparten deposito.html (los chicos) y ───────────
// deposito-admin.html (administración). 26/10/2026: antes era la app aparte
// grandbar-stock; la lógica del conteo, las líneas, el Excel y la agenda de los
// lunes es la misma, con el estilo del Portal. Datos: función stock.
// Necesita antes: supabase-js, assets/stock-productos.js (PRODUCTOS_VINOS/SPIRITS)
// y, para el Excel, xlsx-js-style.
window.STOCK = (function () {
  const FN = '/.netlify/functions/stock';
  const HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  let sb = null;
  const supa = () => sb || (sb = window.supabase.createClient(HUB.url, HUB.key));
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Math.round(Number(n) || 0).toLocaleString('es-AR');
  const SECTOR_LBL = { vinos: 'Vinos', spirits: 'Spirits y Gaseosas' };
  const SECTOR_ICO = { vinos: '🍷', spirits: '🥃' };
  const isoLocal = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const hoy = () => isoLocal(new Date());
  const aDate = v => new Date(String(v).length <= 10 ? v + 'T12:00:00' : v);
  const fecha = v => v ? aDate(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const fechaHora = v => v ? new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const diaLargo = v => { const s = aDate(v).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };

  function toast(m, err) { const t = $('toast'); if (!t) return alert(m); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => { t.className = 'toast'; }, 3400); }
  // Depósito (29/10/2026): Mendoza o San Luis. Va en cada pedido; la función igual decide
  // (el que cuenta usa el de su región; administración, uno de los que maneja).
  const DEP_LBL = { mendoza: 'Mendoza', san_luis: 'San Luis' };
  let DEP = null;
  const setDep = d => { DEP = d || null; };
  const dep = () => DEP;
  async function token() { const { data: { session } } = await supa().auth.getSession(); return session ? session.access_token : null; }
  async function get(vista, extra) {
    const t = await token();
    if (!t) { location.href = '/index.html'; throw new Error('Tu sesión se cerró.'); }
    const r = await fetch(FN + '?' + new URLSearchParams(Object.assign({ vista }, DEP ? { deposito: DEP } : {}, extra || {})), { headers: { Authorization: 'Bearer ' + t } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
    return d;
  }
  async function post(body) {
    const t = await token();
    if (!t) { location.href = '/index.html'; throw new Error('Tu sesión se cerró.'); }
    const r = await fetch(FN, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign(DEP ? { deposito: DEP } : {}, body)) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
    return d;
  }

  // ── Catálogo ──────────────────────────────────────────────────────────────
  const productos = sector => sector === 'vinos' ? PRODUCTOS_VINOS : PRODUCTOS_SPIRITS;
  const esPromo = p => String(p.articulo || '').startsWith('Promo ');
  // Proveedores del sector con su cantidad de SKUs (sin los "Promo …", que no se cuentan).
  function proveedores(sector, excluidos) {
    const c = {};
    productos(sector).forEach(p => { if (esPromo(p)) return; const k = (p.proveedor || '').trim(); if (k && !(excluidos && excluidos.has(k))) c[k] = (c[k] || 0) + 1; });
    return Object.entries(c).sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([nombre, cant]) => ({ nombre, cant }));
  }
  // Una "línea" son los SKUs con los mismos 6 primeros dígitos; el nombre son las
  // palabras que comparten (sin el tamaño "x 750ml").
  function nombreComun(nombres) {
    if (!nombres.length) return 'Línea';
    const limpios = nombres.map(n => n.replace(/\s+x\s+[\d,.]+\s*(ml|cc|lt|l|kg|un|bot|pack).*$/i, '').trim());
    if (limpios.length === 1) return limpios[0];
    const pal = limpios.map(n => n.split(/\s+/)), com = [];
    for (let i = 0; i < pal[0].length; i++) { if (pal.every(p => p[i] === pal[0][i])) com.push(pal[0][i]); else break; }
    return com.length ? com.join(' ') : limpios[0].split(/\s+/).slice(0, 2).join(' ');
  }
  function lineas(lista) {
    const g = {};
    lista.filter(p => !esPromo(p)).forEach(p => { const pref = p.sku.slice(0, 6); (g[pref] = g[pref] || { prods: [], proveedor: p.proveedor }).prods.push(p); });
    return Object.entries(g).map(([prefijo, { prods, proveedor }]) => ({ prefijo, nombre: nombreComun(prods.map(p => p.articulo)), cant: prods.length, proveedor }))
      .sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  }

  // ── Filas del conteo (las mismas columnas que el Excel de siempre) ─────────────
  // stock: { sku → stock } de stock_sistema (solo los ≠ 0); hasSync = alguna vez se cargó.
  // Con el stock cargado, el SKU que no está es 0; si nunca se cargó, el del catálogo.
  function filas(todosProductos, values, stock, hasSync) {
    const stk = p => hasSync ? (stock[p.sku] || 0) : (p.stock_sistema || 0);
    // Promo: el stock del "Promo <nombre>" se suma al del producto con ese nombre.
    const promo = {};
    todosProductos.forEach(p => { if (esPromo(p)) promo[p.articulo.slice(6)] = stk(p); });
    return todosProductos.filter(p => !esPromo(p)).map(p => {
      const v = values[p.sku] || {};
      const depo1 = parseInt(v.depo1) || 0, local = parseInt(v.local) || 0, depo2 = parseInt(v.depo2) || 0;
      return { sku: p.sku, proveedor: p.proveedor, articulo: p.articulo, stock_sistema: stk(p), promo: promo[p.articulo] || 0,
        depo1, local, depo2, total: depo1 + local + depo2, obs: v.obs || '' };
    });
  }

  // ── Excel (xlsx-js-style): igual al que mandaba la app de stock ───────────────
  function excel({ sector, usuario, fecha: f, proveedores: provs, todos, provObs, deposito }) {
    const wb = XLSX.utils.book_new();
    const sl = (deposito || DEP) === 'san_luis';   // Mendoza queda como siempre
    const datos = todos.map(p => [p.sku, p.articulo, p.stock_sistema + p.promo, p.promo, p.depo1, p.local, p.depo2, p.total, p.total - (p.stock_sistema + p.promo), (provObs || {})[p.proveedor] || '']);
    const ws = XLSX.utils.aoa_to_sheet([
      [`${sl ? 'San Luis — ' : ''}${SECTOR_LBL[sector]} — ${usuario} — ${f}`],
      ['Proveedores: ' + (provs && provs.length ? provs.join(', ') : 'Todos')],
      [],
      ['SKU', 'Descripción', 'Stock Sistema', 'Promo', 'Depo 1', 'Local', 'Depo 2', 'Total', 'Diferencia', 'Obs. Proveedor'],
      ...datos,
    ]);
    ws['!cols'] = [{ wch: 13 }, { wch: 54 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 40 }];
    if (ws.A1) ws.A1.s = { font: { bold: true, sz: 13, color: { rgb: 'A97C22' } } };
    if (ws.A2) ws.A2.s = { font: { italic: true, color: { rgb: '6D7D85' } } };
    ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4'].forEach(r => { if (ws[r]) ws[r].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0D2230' } }, alignment: { horizontal: 'center' } }; });
    todos.forEach((p, i) => {
      const fila = i + 5, dif = p.total - (p.stock_sistema + p.promo);
      if (p.total === 0 && !p.obs && ws['B' + fila]) ws['B' + fila].s = { font: { color: { rgb: '8A8F9A' } } };
      if (ws['I' + fila]) ws['I' + fila].s = dif < 0 ? { font: { bold: true, color: { rgb: 'B5482D' } } } : dif > 0 ? { font: { bold: true, color: { rgb: '2F6F5E' } } } : {};
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    return { base64: XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }), nombre: `stock_${sl ? 'sanluis_' : ''}${sector}_${f}.xlsx` };
  }
  function descargar(b64, nombre) {
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  // Excel de un conteo guardado (stock_conteos.items).
  function excelDeConteo(c) {
    const x = excel({ sector: c.sector, usuario: c.usuario_nombre || '', fecha: c.fecha, proveedores: c.proveedores || [], todos: c.items || [], provObs: c.prov_obs || {}, deposito: c.deposito || 'mendoza' });
    descargar(x.base64, x.nombre);
  }

  // ── Agenda de los lunes ────────────────────────────────────────────────────
  // Bodegas que ya no se trabajan: no entran en la agenda (estaban fijas en la app de stock).
  const INACTIVAS_VINOS = new Set([
    'BODEGA ACHAVAL FERRER', 'BODEGA ALTOS LAS HORMIGAS', 'BODEGA AMALAYA', 'BODEGA BARBERIS', 'BODEGA BIANCHI', 'BODEGA CAVAS ROSELL BOHER',
    'BODEGA CHAKANA', 'BODEGA CHAMAN', 'BODEGA CLOS DE LOS SIETE', 'BODEGA CORRAL DE PALOS', 'BODEGA CRUZAT', 'BODEGA CUVELIER DE LOS ANDES',
    'BODEGA DIAMANDES', 'BODEGA DIAMANTES', 'BODEGA DOMAINE BOUSQUET', 'BODEGA DURIGUTTI', 'BODEGA EDUARDO VIDAL WINES', 'BODEGA EL EQUILIBRISTA WINES',
    'BODEGA EL RELATOR', 'BODEGA ESCALA HUMANA', 'BODEGA ESMERALDA', 'BODEGA FINCA AGOSTINO', 'BODEGA FINCA BANDINI', 'BODEGA FINCA FLICHMAN',
    'BODEGA FUEGO BLANCO', 'BODEGA LA IGNACIA', 'BODEGA LAMADRID', 'BODEGA LOS COROS', 'BODEGA LOS VALIENTES', 'BODEGA MARRASO',
    'BODEGA MAURICIO LORCA', 'BODEGA MENDEL', 'BODEGA MONTEVIEJO', 'BODEGA MOSQUITA MUERTA', 'BODEGA MOULIN BLUE', 'BODEGA NORTON',
    'BODEGA REVANCHA', 'BODEGA ROLLAND WINE', 'BODEGA SERGIO CASE', 'BODEGA SIETE LEGUAS', 'BODEGA TINTO NEGRO', 'BODEGA TRES 14',
    'BODEGA TUPUN', 'BODEGA VIÑA LOS CHOCOS', 'BODEGA ZORZAL',
  ]);
  const SESION_MIN = 180;   // una mañana de conteo: de 9 a 12
  function proximoLunes() { const d = new Date(); d.setHours(0, 0, 0, 0); const dow = d.getDay(); d.setDate(d.getDate() + (dow === 1 ? 0 : (8 - dow) % 7 || 7)); return d; }
  // Arma los lunes que faltan: primero lo que asignó administración (fechas de hoy en
  // adelante) y el resto repartido de a 3 horas por lunes, empezando por los proveedores
  // con más SKUs. "Hecho" = marcado por los chicos o asignado a un lunes que ya pasó,
  // desde el último reinicio del ciclo.
  function agenda({ sector, registro, excluidos, ciclo, segPorItem }) {
    const hoyS = hoy(), desde = (ciclo && ciclo.desde) || '0000-00-00';
    const fuera = new Set([...(excluidos || [])].concat(sector === 'vinos' ? [...INACTIVAS_VINOS] : []));
    const provs = proveedores(sector, fuera).map(p => ({ name: p.nombre, count: p.cant, minEst: Math.round(p.cant * segPorItem / 60) }))
      .sort((a, b) => b.count - a.count);
    const delSector = (registro || []).filter(r => r.sector === sector);
    const hechos = new Set(delSector.filter(r => r.fecha >= desde && (r.done || r.fecha < hoyS)).map(r => r.proveedor));
    const asignados = new Map();
    delSector.filter(r => !r.done && r.fecha >= hoyS).forEach(r => { if (!asignados.has(r.fecha)) asignados.set(r.fecha, new Set()); asignados.get(r.fecha).add(r.proveedor); });
    const porNombre = new Map(provs.map(p => [p.name, p]));
    const sesiones = [], yaEn = new Set();
    [...asignados.keys()].sort().forEach(f => {
      const l = [...asignados.get(f)].filter(n => !hechos.has(n) && porNombre.has(n)).map(n => porNombre.get(n));
      if (!l.length) return;
      sesiones.push({ fecha: f, provs: l, min: l.reduce((s, p) => s + p.minEst, 0), asignada: true });
      l.forEach(p => yaEn.add(p.name));
    });
    const usadas = new Set(sesiones.map(s => s.fecha));
    const d = proximoLunes();
    const sigLibre = () => { while (usadas.has(isoLocal(d))) d.setDate(d.getDate() + 7); };
    sigLibre();
    let cur = { provs: [], min: 0 };
    provs.filter(p => !hechos.has(p.name) && !yaEn.has(p.name)).forEach(p => {
      if (cur.min > 0 && cur.min + p.minEst > SESION_MIN) { sesiones.push({ fecha: isoLocal(d), provs: cur.provs, min: cur.min }); d.setDate(d.getDate() + 7); sigLibre(); cur = { provs: [], min: 0 }; }
      cur.provs.push(p); cur.min += p.minEst;
    });
    if (cur.provs.length) { sigLibre(); sesiones.push({ fecha: isoLocal(d), provs: cur.provs, min: cur.min }); }
    sesiones.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { sesiones, hechos: provs.filter(p => hechos.has(p.name)), total: provs.length };
  }
  const horas = min => min < 60 ? min + ' min' : Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');

  return { supa, $, esc, num, SECTOR_LBL, SECTOR_ICO, DEP_LBL, setDep, dep, hoy, isoLocal, fecha, fechaHora, diaLargo, toast, get, post,
    productos, esPromo, proveedores, lineas, filas, excel, descargar, excelDeConteo, agenda, horas, INACTIVAS_VINOS, SESION_MIN };
})();
