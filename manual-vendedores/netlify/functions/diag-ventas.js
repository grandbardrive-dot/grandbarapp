// ============================================================
//  GrandBar · Netlify Function · diag-ventas  (DIAGNÓSTICO, one-shot)
//  Se conecta a Córdoba Software (Aikon/Sinergis WebApi IS3) con las
//  MISMAS credenciales que ya usa sync-cuentas / sync-stock, y descubre
//  de dónde salen las VENTAS por artículo (con su SKU).
//
//  Hallazgo: el método IS3 `ListarComprobantes` EXISTE, pero necesita
//  un rango de fechas. Esta versión lo llama con fechas, probando los
//  nombres de parámetro típicos de Sinergis hasta que uno devuelve datos.
//
//  No escribe nada en Supabase: solo lee del ERP y devuelve un resumen
//  (estado, cantidad, columnas y 1 fila de ejemplo por intento).
//
//  Uso:
//    /diag-ventas                         → prueba ListarComprobantes (últimos 7 días)
//    /diag-ventas?desde=01/08/2026&hasta=21/08/2026
//    /diag-ventas?metodo=NombreMetodo     → prueba otro método IS3 con fechas
//    /diag-ventas?tabla=NOMBRE            → prueba DtTabla con una tabla puntual
//  Env vars: las mismas AIKON_* + (opcional) SYNC_SECRET.
// ============================================================

async function aikonRaw(url, body, ms = 8000) {
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
    return { status: r.status, text };
  } catch (e) {
    return { status: 0, text: '', error: (e && e.message) || String(e) };
  } finally {
    clearTimeout(t);
  }
}
const parse = (t) => { try { return JSON.parse(t); } catch { return null; } };
const listaDe = (j) => {
  if (Array.isArray(j)) return j;
  if (!j || typeof j !== 'object') return [];
  const l = j.lista || j.tabla || j.Tabla || j.datos || j.Datos ||
            j.registros || j.Registros || j.data || j.Lista ||
            j.ListadoComprobantes || j.Comprobantes || j.ListadoVentas || j.Ventas || [];
  return Array.isArray(l) ? l : [];
};
const dd = (n) => String(n).padStart(2, '0');
const fmtFecha = (date) => dd(date.getDate()) + '/' + dd(date.getMonth() + 1) + '/' + date.getFullYear();

async function login() {
  const cuenta = process.env.AIKON_CUENTA;
  if (!cuenta || !process.env.AIKON_EMPRESA) throw new Error('Faltan AIKON_CUENTA / AIKON_EMPRESA en Netlify.');
  const managerUrl = process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const j1 = parse((await aikonRaw(managerUrl, { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD })).text) || {};
  const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
  if (!urlCuenta) throw new Error('CuentaURL no devolvió URL: ' + JSON.stringify(j1).slice(0, 200));
  const j2 = parse((await aikonRaw(urlCuenta + '/IS3/ObtenerToken', {
    cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa: process.env.AIKON_EMPRESA,
  })).text) || {};
  const token = j2.token && j2.token.Codigo;
  if (!token) throw new Error('ObtenerToken falló: ' + JSON.stringify(j2).slice(0, 200));
  return { urlCuenta, cuenta, token, empresa: process.env.AIKON_EMPRESA };
}

// Resume un intento: log/estado, cantidad, columnas y una fila de ejemplo.
function resumen(nombre, params, res) {
  const bytes = res.text ? res.text.length : 0;
  if (res.error) return { intento: nombre, params, status: res.status, error: res.error };
  const j = parse(res.text);
  const arr = listaDe(j);
  if (!arr.length) {
    // No es lista: mostramos la cabeza del texto (suele traer el error/pista de Sinergis).
    return { intento: nombre, params, status: res.status, bytes, filas: 0, head: String(res.text || '').slice(0, 320) };
  }
  const cols = Object.keys(arr[0] || {});
  // Si la primera fila tiene un array anidado (renglones/detalle), lo mostramos también.
  let detalleAnidado = null;
  for (const k of cols) {
    if (Array.isArray(arr[0][k]) && arr[0][k].length && typeof arr[0][k][0] === 'object') {
      detalleAnidado = { campo: k, columnas: Object.keys(arr[0][k][0]), ejemplo: JSON.stringify(arr[0][k][0]).slice(0, 500) };
      break;
    }
  }
  return { intento: nombre, params, status: res.status, bytes, filas: arr.length, columnas: cols, ejemplo: JSON.stringify(arr[0]).slice(0, 700), detalleAnidado };
}

// Mapa de estilos de nombre de parámetro de fecha.
const VARIANTES = {
  pascal:  (d, h) => ({ FechaDesde: d, FechaHasta: h }),
  camel:   (d, h) => ({ fechaDesde: d, fechaHasta: h }),
  plain:   (d, h) => ({ Desde: d, Hasta: h }),
  emision: (d, h) => ({ FechaEmisionDesde: d, FechaEmisionHasta: h }),
};

async function probarComprobantes(urlCuenta, cuenta, token, empresa, metodo, desde, hasta, estilo) {
  // El hallazgo previo: FechaDesde/FechaHasta (pascal) SÍ se acepta pero tarda.
  // Le damos tiempo (24s) y un rango chico para que responda a tiempo.
  const orden = estilo ? [estilo] : ['pascal']; // una sola llamada: no acumular tiempo
  const out = [];
  for (const est of orden) {
    const build = VARIANTES[est] || VARIANTES.pascal;
    const extra = build(desde, hasta);
    const res = await aikonRaw(urlCuenta + '/IS3/' + metodo, { cuenta, token, ...extra }, 20000);
    const r = resumen(metodo, est + ' (' + Object.keys(extra).join('+') + ')', res);
    out.push(r);
    if (r.filas > 0) return { encontrada: r, intentos: out };
  }
  return { encontrada: null, intentos: out };
}

async function diagnosticar(q) {
  const { urlCuenta, cuenta, token, empresa } = await login();

  // Modo puntual: DtTabla con una tabla concreta.
  if (q.tabla) {
    const res = await aikonRaw(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla: q.tabla });
    return { ok: true, urlCuenta, modo: 'DtTabla', detalle: [resumen(q.tabla, 'tabla', res)] };
  }

  // Rango de fechas (default: último 1 día, para que responda rápido).
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 1 * 24 * 60 * 60 * 1000);
  const desde = q.desde || fmtFecha(ayer);
  const hasta = q.hasta || fmtFecha(hoy);

  const metodo = q.metodo || 'ListarComprobantes';
  const { encontrada, intentos } = await probarComprobantes(urlCuenta, cuenta, token, empresa, metodo, desde, hasta, q.estilo);

  return {
    ok: true,
    _version: 'v3-pascal-1dia',
    urlCuenta,
    metodo,
    rango: { desde, hasta },
    encontrada: encontrada
      ? { intento: encontrada.intento, params: encontrada.params, filas: encontrada.filas, columnas: encontrada.columnas, detalleAnidado: encontrada.detalleAnidado }
      : null,
    intentos,
    nota: encontrada
      ? 'Se obtuvieron comprobantes. Revisá "columnas"/"ejemplo" (y "detalleAnidado" para los renglones con SKU y cantidades).'
      : 'Ninguna variante devolvió datos. Revisá los "head" de cada intento: si el error dejó de mencionar la fecha, ese nombre de parámetro se aceptó y falta otro dato. Si no, lo consultamos a Córdoba Software.',
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const secret = process.env.SYNC_SECRET;
  const q = event.queryStringParameters || {};
  if (secret && (q.key || '') !== secret) return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autorizado. Falta ?key=' }) };

  try {
    return { statusCode: 200, headers, body: JSON.stringify(await diagnosticar(q), null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
