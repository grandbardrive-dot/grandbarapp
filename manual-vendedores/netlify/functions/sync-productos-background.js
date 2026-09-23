// ============================================================
//  GrandBar Hub · BACKGROUND Function · sync-productos-background
//  Sincroniza el master de artículos del ERP (Córdoba Software / AIKON IS3)
//  contra la tabla `productos_grandbar` (proyecto Manual). Así el SCANNER DE
//  CARTA siempre cruza contra el stock REAL y al día (antes era un snapshot
//  de junio 2026 que no se actualizaba → falsos negativos con altas nuevas).
//
//  Es BACKGROUND (sufijo -background): Netlify le da hasta 15 min, sin el
//  límite de 10s. Responde 202 al toque y sigue trabajando.
//
//  Disparo:
//   - Automático: la función programada sync-productos-cron la llama 1×/día.
//   - Manual: GET /.netlify/functions/sync-productos-background?key=<SYNC_SECRET>
//
//  Env vars (Netlify, sitio grandbar-hub — mismas que sync-ventas/diag-erp):
//    AIKON_CUENTA, AIKON_CUENTA_PWD, AIKON_USUARIO, AIKON_PASS, AIKON_EMPRESA,
//    AIKON_MANAGER_URL (opcional), MANUAL_ANON_KEY (opcional), SYNC_SECRET (opcional)
// ============================================================

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const sb = (path, opts = {}) => fetch(SB_URL + '/rest/v1/' + path, {
  ...opts,
  headers: {
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  },
});

// ── AIKON helper ─────────────────────────────────────────────
async function aikon(url, body, ms = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
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
  if (!token) throw new Error('ObtenerToken falló: ' + JSON.stringify(j2).slice(0, 200));
  return { urlCuenta, cuenta, token };
}

// En esta cuenta del ERP (109) la tabla se llama ARTICULO (singular) y la lista
// viene anidada en resultado.retorno. Cols: ar_codigo, ar_descri, st_stock, ma_descri…
function _listaDe(o) {
  if (!o) return null;
  if (Array.isArray(o)) return o;
  return o.lista || o.tabla || o.Tabla || o.datos || o.Datos || o.registros || o.Registros || o.retorno || o.data || null;
}
async function traerArticulos(urlCuenta, cuenta, token) {
  const r = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla: 'ARTICULO' }, 90000);
  const lista = _listaDe(r) || _listaDe(r && r.resultado);
  const arr = Array.isArray(lista) ? lista : [];
  if (!arr.length && r && r.resultado && r.resultado.log) console.log('ARTICULO log:', String(r.resultado.log).slice(0, 160));
  if (arr[0]) console.log('ARTICULO cols:', JSON.stringify(Object.keys(arr[0])));
  return arr;
}

// Normaliza la descripción igual que el scanner (para descripcion_normalizada).
function normalizar(desc) {
  let s = String(desc || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/\bx?\s*\d+([.,]\d+)?\s*(ml|cc|cl|lts?|lt|l|litros?|grs?|gr|g|kg|mg)\b/g, ' ');
  s = s.replace(/\bx\s*\d+\b/g, ' ').replace(/[×*]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function extraer(item) {
  const val = (...keys) => {
    for (const k of keys) {
      if (item[k] != null && String(item[k]).trim() !== '') return item[k];
    }
    return null;
  };
  const codigoRaw = val('ar_codigo', 'Codigo', 'codigo', 'ArticuloCodigo', 'CODIGO', 'CodArt', 'cod_articulo');
  const descRaw = val('ar_descri', 'ar_descripcion', 'ar_descrip', 'ar_nombre', 'ar_detalle', 'ar_desc',
                      'Descripcion', 'descripcion', 'Detalle', 'Nombre', 'nombre', 'ArticuloDescripcion');
  const stockRaw = val('st_stock', 'ar_stockact', 'ar_stock', 'StockActual', 'stock_actual', 'Stock', 'stock',
                       'Unidades', 'unidades', 'ar_saldo', 'Saldo');
  if (codigoRaw == null) return null;
  const digits = String(codigoRaw).trim().replace(/\D/g, '');
  if (!digits || digits.length < 6) return null;
  const codigo = digits.length === 6 ? digits + '00' : digits.padStart(8, '0').slice(0, 8);
  const descripcion = descRaw != null ? String(descRaw).trim() : '';
  if (!descripcion) return null; // sin descripción no sirve para el scanner
  const stock = Math.round(parseFloat(String(stockRaw ?? '0').replace(',', '.')) || 0);
  return { codigo, descripcion, descripcion_normalizada: normalizar(descripcion), stock };
}

async function sincronizar() {
  const { urlCuenta, cuenta, token } = await login();
  const arr = await traerArticulos(urlCuenta, cuenta, token);
  if (!arr.length) throw new Error('AIKON no devolvió artículos (revisá logs: nombres de columnas).');

  // Dedup por código (nos quedamos con el último visto) + fecha de corrida.
  const ahora = new Date().toISOString();
  const porCodigo = new Map();
  let omitidos = 0;
  for (const item of arr) {
    const f = extraer(item);
    if (!f) { omitidos++; continue; }
    porCodigo.set(f.codigo, { ...f, actualizado_en: ahora });
  }
  const rows = [...porCodigo.values()];
  if (!rows.length) throw new Error(`AIKON devolvió ${arr.length} filas pero ninguna con código+descripción válidos.`);

  // Upsert por código en lotes (requiere índice único en codigo — ver
  // productos-grandbar-sync-setup.sql). No borra la tabla: si algo falla,
  // el scanner sigue con los datos anteriores.
  const BATCH = 1000;
  let ok = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const r = await sb('productos_grandbar?on_conflict=codigo', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Supabase lote ${Math.floor(i / BATCH) + 1} falló (${r.status}): ${err.slice(0, 300)}`);
    }
    ok += chunk.length;
  }
  console.log(`sync-productos OK: ${ok} artículos actualizados (${arr.length} leídos, ${omitidos} omitidos).`);
  return { ok: true, leidos: arr.length, actualizados: ok, omitidos, timestamp: ahora };
}

exports.handler = async (event) => {
  // Background: Netlify ya respondió 202. Igual gateamos el disparo manual.
  const secret = process.env.SYNC_SECRET;
  if (secret) {
    const key = (event && event.queryStringParameters && event.queryStringParameters.key) || '';
    if (key !== secret) { console.warn('sync-productos: key inválida, no se ejecuta.'); return; }
  }
  try {
    await sincronizar();
  } catch (e) {
    console.error('sync-productos ERROR:', (e && e.message) || String(e));
  }
};
