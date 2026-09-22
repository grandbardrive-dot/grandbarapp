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

exports.handler = async () => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const { urlCuenta, cuenta, token } = await login();
    if (!token) return { statusCode: 502, headers, body: JSON.stringify({ error: 'sin token', urlCuenta }) };
    const r = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla: 'ARTICULOS' }, 25000);

    // Describe cualquier valor sin volcar todo: tipo, tamaño y una pista.
    const describe = (v, depth = 0) => {
      if (v == null) return { tipo: 'null' };
      if (Array.isArray(v)) return { tipo: 'array', largo: v.length, primero: v[0] && depth < 2 ? describe(v[0], depth + 1) : (v[0] ? Object.keys(v[0]) : null) };
      if (typeof v === 'object') { const k = Object.keys(v); return { tipo: 'object', claves: k, hijos: depth < 2 ? Object.fromEntries(k.slice(0, 12).map(x => [x, describe(v[x], depth + 1)])) : undefined }; }
      if (typeof v === 'string') return { tipo: 'string', largo: v.length, preview: v.slice(0, 200) };
      return { tipo: typeof v, valor: v };
    };
    return { statusCode: 200, headers, body: JSON.stringify({ forma: describe(r) }, null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
