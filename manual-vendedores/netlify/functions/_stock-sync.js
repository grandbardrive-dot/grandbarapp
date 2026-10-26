// ============================================================
//  GrandBar Hub · Helper compartido · stock del depósito desde Córdoba  (26/10/2026)
//  Lee el stock de cada artículo en Córdoba Software (AIKON IS3, DtTabla ARTICULO,
//  campo st_stock) y lo guarda en stock_sistema (base del Portal). Es la misma
//  sincronización que tenía la app de stock aparte (grandbar-stock, sync-stock.js),
//  ahora dentro del Portal. La usan stock-sync-background (cada hora, ver
//  stock-sync-cron) y el botón "Sincronizar ahora" de deposito-admin.html.
//  El "_" evita que Netlify lo publique como función.
//
//  Cuidados que ya traía:
//   - Upsert por SKU, sin borrar antes: si algo falla, la tabla no queda vacía.
//   - Si todo vino en 0, no se toca nada (la lectura anduvo mal).
//   - Los SKUs que Córdoba ya no devuelve quedan en 0.
//   - resultado.log de DtTabla trae el token de sesión: no se loguea.
//  Env: AIKON_* (las mismas que sync-productos), HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

async function aikon(url, body, ms = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { _raw: text.slice(0, 400) }; }
  } finally { clearTimeout(t); }
}

async function login() {
  const cuenta = process.env.AIKON_CUENTA;
  if (!cuenta || !process.env.AIKON_EMPRESA) throw new Error('Faltan AIKON_CUENTA / AIKON_EMPRESA.');
  const managerUrl = process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const j1 = await aikon(managerUrl, { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
  if (!urlCuenta) throw new Error('CuentaURL no devolvió URL: ' + JSON.stringify(j1).slice(0, 200));
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', {
    cuenta,
    usuario: process.env.AIKON_USUARIO || 'CS',
    'contraseña': process.env.AIKON_PASS || '',
    empresa: process.env.AIKON_EMPRESA,
  });
  const token = j2.token && j2.token.Codigo;
  if (!token) throw new Error('ObtenerToken falló (revisar AIKON_USUARIO / AIKON_PASS / AIKON_EMPRESA).');
  return { urlCuenta, cuenta, token };
}

// DtTabla devuelve la lista con distintos nombres y a veces anidada en "resultado".
function listaDe(o) {
  if (!o) return null;
  if (Array.isArray(o)) return o;
  const l = o.lista || o.tabla || o.Tabla || o.datos || o.Datos || o.registros || o.Registros || o.retorno || o.data;
  return Array.isArray(l) ? l : null;
}

const CAMPOS_STOCK = ['st_stock', 'ar_stockact', 'ar_stock', 'StockActual', 'stock_actual', 'Stock', 'stock', 'Unidades', 'unidades', 'ar_saldo', 'Saldo'];
function campoStock(item) {
  for (const k of CAMPOS_STOCK) if (item[k] != null && String(item[k]).trim() !== '') return k;
  return null;
}

// SKU de 8 dígitos (6 dígitos → +00), igual que el Listado de Stock Básico.
function extraer(item) {
  const val = (...keys) => { for (const k of keys) if (item[k] != null && String(item[k]).trim() !== '') return item[k]; return null; };
  const codigo = val('ar_codigo', 'Codigo', 'codigo', 'ArticuloCodigo', 'CODIGO', 'CodArt', 'cod_articulo');
  if (codigo == null) return null;
  const dig = String(codigo).trim().replace(/\D/g, '');
  if (!dig || dig.length < 6) return null;
  const sku = dig.length === 6 ? dig + '00' : dig.padStart(8, '0').slice(0, 8);
  const k = campoStock(item);
  const stock = k ? (parseFloat(String(item[k]).replace(',', '.')) || 0) : null;
  const d = val('ar_descri', 'ar_descripcion', 'ar_descrip', 'ar_nombre', 'Descripcion', 'descripcion');
  return { sku, stock, articulo: d != null ? String(d).trim().replace(/`/g, "'") : null };
}

// Sector por el prefijo del SKU (los mismos que la app de stock).
const PREF_VINOS = new Set(['01', '11', '12', '13', '14', '15', '16', '17', '18', '19']);
const PREF_SPIRITS = new Set(['02', '03', '04', '05', '07', '08']);
const sectorDe = sku => PREF_VINOS.has(sku.slice(0, 2)) ? 'vinos' : PREF_SPIRITS.has(sku.slice(0, 2)) ? 'spirits' : null;

async function leerStock() {
  const { urlCuenta, cuenta, token } = await login();
  const probadas = [];
  for (const tabla of ['ARTICULO', 'ARTICULOS']) {
    let j;
    try { j = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla }, 90000); }
    catch (e) { probadas.push(tabla + ': error de red'); continue; }
    const arr = listaDe(j) || listaDe(j && j.resultado) || [];
    if (!arr.length) { probadas.push(tabla + ': 0 registros'); continue; }
    if (!arr.some(it => campoStock(it) !== null)) { probadas.push(tabla + ': sin campo de stock'); continue; }
    // Si un código viene repetido (una fila por depósito), se suma.
    const porSku = new Map();
    let omitidos = 0;
    for (const it of arr) {
      const c = extraer(it);
      if (!c || c.stock === null) { omitidos++; continue; }
      const sector = sectorDe(c.sku);
      if (!sector) { omitidos++; continue; }
      const prev = porSku.get(c.sku);
      if (prev) { prev.stock += c.stock; if (!prev.articulo && c.articulo) prev.articulo = c.articulo; }
      else porSku.set(c.sku, { sku: c.sku, stock: c.stock, articulo: c.articulo, sector });
    }
    const rows = [...porSku.values()].map(r => ({ ...r, stock: Math.round(r.stock) }));
    return { tabla, total: arr.length, rows, omitidos };
  }
  throw new Error('Córdoba no devolvió artículos con stock. Probadas: ' + probadas.join(' | '));
}

async function sincronizarStock() {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) throw new Error('Falta HUB_SERVICE_ROLE.');
  const sb = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', ...(o.headers || {}) } });

  const l = await leerStock();
  const conStock = l.rows.filter(r => r.stock > 0).length;
  if (!l.rows.length || !conStock) throw new Error('Córdoba devolvió ' + l.total + ' artículos pero ninguno con stock: no se tocó la tabla.');

  const ahora = new Date().toISOString();
  for (let i = 0; i < l.rows.length; i += 500) {
    const r = await sb('stock_sistema?on_conflict=sku', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(l.rows.slice(i, i + 500).map(x => ({ ...x, actualizado_en: ahora }))),
    });
    if (!r.ok) throw new Error('stock_sistema (lote ' + (i / 500 + 1) + '): ' + (await r.text()).slice(0, 200));
  }
  // Los que tenían stock y Córdoba ya no devuelve → 0.
  const nuevos = new Set(l.rows.map(r => r.sku));
  let antes = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await sb('stock_sistema?select=sku&stock=neq.0&order=sku', { headers: { 'Range-Unit': 'items', Range: desde + '-' + (desde + 999) } });
    if (!r.ok) break;
    const lote = await r.json();
    antes = antes.concat(lote.map(x => x.sku));
    if (lote.length < 1000) break;
  }
  const ausentes = antes.filter(s => !nuevos.has(s));
  for (let i = 0; i < ausentes.length; i += 150) {
    await sb('stock_sistema?sku=in.(' + ausentes.slice(i, i + 150).map(s => '"' + s + '"').join(',') + ')', {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stock: 0, actualizado_en: ahora }),
    });
  }
  return {
    tabla: l.tabla, articulos: l.total, actualizados: l.rows.length, conStock,
    vinos: l.rows.filter(r => r.sector === 'vinos').length, spirits: l.rows.filter(r => r.sector === 'spirits').length,
    omitidos: l.omitidos, ausentesEnCero: ausentes.length, timestamp: ahora,
  };
}

module.exports = { sincronizarStock };
