// ============================================================
//  GrandBar · Netlify Function · diag-ventas  (DIAGNÓSTICO, one-shot)
//  Se conecta a Córdoba Software (Aikon/Sinergis WebApi IS3) con las
//  MISMAS credenciales que ya usa sync-cuentas / sync-stock, y prueba
//  las tablas/métodos típicos de VENTAS para descubrir de dónde salen
//  las ventas por artículo (con su SKU) y con qué nombres de columna.
//
//  No escribe nada en Supabase: solo lee del ERP y devuelve un resumen
//  (estado HTTP, cantidad, columnas y 1 fila de ejemplo por candidato).
//
//  Uso:  <sitio>/.netlify/functions/diag-ventas   (o ?key=<SYNC_SECRET>)
//        <sitio>/.netlify/functions/diag-ventas?tabla=NOMBRE  → prueba una puntual
//  Env vars: las mismas AIKON_* + (opcional) SYNC_SECRET.
// ============================================================

async function aikonRaw(url, body, ms = 7000) {
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
// DtTabla devuelve la lista bajo distintas claves según la versión.
const listaDe = (j) => {
  if (Array.isArray(j)) return j;
  if (!j || typeof j !== 'object') return [];
  const l = j.lista || j.tabla || j.Tabla || j.datos || j.Datos ||
            j.registros || j.Registros || j.data || j.Lista ||
            j.ListadoVentas || j.Ventas || j.Comprobantes || [];
  return Array.isArray(l) ? l : [];
};

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
  return { urlCuenta, cuenta, token };
}

// Resume un candidato: cantidad, columnas y una fila de ejemplo (recortada).
function resumen(nombre, tipo, res) {
  const bytes = res.text ? res.text.length : 0;
  if (res.error) return { nombre, tipo, status: res.status, error: res.error };
  const j = parse(res.text);
  const arr = listaDe(j);
  if (!arr.length) {
    // No es lista (o vino vacío): mostramos la cabeza del texto para entender la respuesta.
    return { nombre, tipo, status: res.status, bytes, filas: 0, head: String(res.text || '').slice(0, 300) };
  }
  const cols = Object.keys(arr[0] || {});
  return { nombre, tipo, status: res.status, bytes, filas: arr.length, columnas: cols, ejemplo: JSON.stringify(arr[0]).slice(0, 600) };
}

async function diagnosticar(unaTabla) {
  const { urlCuenta, cuenta, token } = await login();

  // Tablas candidatas para DtTabla (nombres típicos de ventas en Sinergis).
  const TABLAS = unaTabla ? [unaTabla] : [
    'VENTAS', 'COMPROBANTES', 'COMPROBANTES_VENTA', 'MOVIMIENTOS', 'MOVART',
    'MOVIMIENTOS_ARTICULOS', 'RENGLONES', 'COMPROBANTES_RENGLONES',
    'VENTAS_DETALLE', 'VENTAS_ARTICULOS', 'FACTURAS_DET', 'ITEMS',
  ];
  // Métodos IS3 candidatos (algunos pueden pedir fechas: capturamos el error igual).
  const METODOS = unaTabla ? [] : [
    'ListarVentas', 'ListarComprobantes', 'ListarComprobantesVenta',
    'ConsultarVentas', 'VentasPorArticulo',
  ];

  const resultados = [];
  let encontrada = null;

  for (const tabla of TABLAS) {
    const res = await aikonRaw(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla });
    const r = resumen(tabla, 'DtTabla', res);
    resultados.push(r);
    if (r.filas > 0) { encontrada = r; break; } // paramos en la primera que trae datos
  }

  if (!encontrada) {
    for (const metodo of METODOS) {
      const res = await aikonRaw(urlCuenta + '/IS3/' + metodo, { cuenta, token });
      const r = resumen(metodo, 'IS3', res);
      resultados.push(r);
      if (r.filas > 0) { encontrada = r; break; }
    }
  }

  return {
    ok: true,
    urlCuenta,
    encontrada: encontrada ? { nombre: encontrada.nombre, tipo: encontrada.tipo, filas: encontrada.filas, columnas: encontrada.columnas } : null,
    detalle: resultados,
    nota: encontrada
      ? 'Se encontró una fuente de ventas. Revisá "columnas" y "ejemplo" para ver el SKU y las cantidades/importes.'
      : 'Ninguna tabla/método candidato devolvió filas. Pasame el nombre exacto de la tabla de ventas (o probá ?tabla=NOMBRE), o lo consultamos a Córdoba Software.',
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
  const key = (event.queryStringParameters && event.queryStringParameters.key) || '';
  if (secret && key !== secret) return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autorizado. Falta ?key=' }) };

  const unaTabla = (event.queryStringParameters && event.queryStringParameters.tabla) || null;
  try {
    return { statusCode: 200, headers, body: JSON.stringify(await diagnosticar(unaTabla), null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
