// ============================================================
//  DIAGNÓSTICO (temporal) de sync-productos.
//  Hace login al ERP, lee DtTabla ARTICULOS y DEVUELVE (sin escribir en la DB):
//  cuántas filas, los nombres de columnas, una fila de muestra y qué extraería
//  la función real. Sirve para ajustar el nombre del campo descripción.
//  Abrir: /.netlify/functions/sync-productos-diag   (sitio sin SYNC_SECRET)
//  BORRAR cuando el sync ande.
// ============================================================

async function aikon(url, body, ms = 25000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const x = await r.text(); try { return JSON.parse(x); } catch { return { _raw: x.slice(0, 300) }; }
  } finally { clearTimeout(t); }
}

async function login() {
  const cuenta = process.env.AIKON_CUENTA;
  const j1 = await aikon(process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL', { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa: process.env.AIKON_EMPRESA });
  return { urlCuenta, cuenta, token: j2.token && j2.token.Codigo };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const { urlCuenta, cuenta, token } = await login();
    if (!token) return { statusCode: 502, headers, body: JSON.stringify({ error: 'sin token', urlCuenta }) };

    const q = (event && event.queryStringParameters) || {};
    const listaDe = (r) => Array.isArray(r) ? r
      : (r && (r.lista || r.tabla || r.Tabla || r.datos || r.Datos || r.registros || r.Registros || r.retorno || r.data)) || null;
    const probar = async (tabla) => {
      const r = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla }, 25000);
      const est = r && r.resultado && r.resultado.estado;
      const log = r && r.resultado && r.resultado.log;
      const lista = listaDe(r) || (r && r.resultado && listaDe(r.resultado));
      const arr = Array.isArray(lista) ? lista : null;
      return { tabla, estado: est || (arr ? 'OK' : 'sin_lista'), filas: arr ? arr.length : 0,
               columnas: arr && arr[0] ? Object.keys(arr[0]) : undefined,
               muestra: arr && arr[0] ? arr[0] : undefined,
               error: /error|invalida/i.test(String(log || '')) ? String(log).slice(0, 160) : undefined };
    };

    if (q.tabla) return { statusCode: 200, headers, body: JSON.stringify(await probar(q.tabla), null, 2) };

    const candidatas = ['ARTICULO', 'ART', 'ARTICULOSTOCK', 'ARTSTOCK', 'STOCK', 'STOCKARTICULOS', 'STOCK_ARTICULOS',
      'EXISTENCIAS', 'EXISTENCIA', 'PRODUCTOS', 'PRODUCTO', 'MERCADERIA', 'MERCADERIAS', 'ITEMS', 'ITEM',
      'INVENTARIO', 'SALDOSTOCK', 'STKACTUAL', 'CLIENTES'];
    const out = [];
    for (const t of candidatas) { try { out.push(await probar(t)); } catch (e) { out.push({ tabla: t, error: String(e.message || e) }); } }
    return { statusCode: 200, headers, body: JSON.stringify({ pruebas: out }, null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
