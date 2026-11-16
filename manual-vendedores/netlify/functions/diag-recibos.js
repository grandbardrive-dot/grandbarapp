// ============================================================
//  DIAGNÓSTICO (temporal, 16/11/2026) · ¿cómo se pide un RECIBO al ERP?
//  Moni anota a mano el "RBO 12917" que genera el sistema; para completarlo solo
//  en la planilla hay que poder leer el recibo por número. Prueba ObtenerComprobante
//  con varias series/tipos en las dos empresas y devuelve lo que encuentra.
//    ?key=<DIAG_KEY>&numero=12917[&sucs=0003,0031][&tipos=X,R][&codigos=REC]
//    ?key=<DIAG_KEY>&numero=12917&full=1   → además devuelve el recibo completo
//  Solo lectura. BORRAR cuando terminemos.
// ============================================================

async function aikon(url, body, ms = 25000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const x = await r.text(); try { return JSON.parse(x); } catch { return { raw: x.slice(0, 200) }; }
  } catch (e) { return { err: (e && e.message) || String(e) }; } finally { clearTimeout(t); }
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  const q = (event && event.queryStringParameters) || {};
  if (!process.env.DIAG_KEY || q.key !== process.env.DIAG_KEY) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Falta ?key=' }) };
  const cuenta = process.env.AIKON_CUENTA;
  const j1 = await aikon(process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL', { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const url = String((j1 && j1.retorno) || '').replace(/\/+$/, '');
  if (!url) return { statusCode: 502, headers, body: JSON.stringify({ error: 'sin url' }) };

  const numeros = String(q.numero || '12917').split(',').map((n) => n.replace(/\D/g, '').padStart(8, '0'));
  const numero = numeros.join(',');
  const sucs = String(q.sucs || '0001,0002,0003,0004,0005,0009,0010,0031,9999,1000,0000').split(',');
  const tipos = String(q.tipos || 'X,R,A,B,C').split(',');
  const codigos = String(q.codigos || 'REC,RBO,RC').split(',');
  const empresas = String(process.env.AIKON_EMPRESAS || '9999,0001').split(',');
  const out = { numero, encontrados: [], noEncontrado: null };
  for (const empresa of empresas) {
    const j2 = await aikon(url + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa });
    const token = j2 && j2.token && j2.token.Codigo;
    if (!token) { out['token_' + empresa] = false; continue; }
    const pruebas = [];
    for (const Numero of numeros) for (const Codigo of codigos) for (const Sucursal of sucs) for (const Tipo of tipos) pruebas.push({ Codigo, Sucursal, Tipo, Numero });
    const res = await Promise.all(pruebas.map(async (p) => ({ p, j: await aikon(url + '/IS3/ObtenerComprobante', { cuenta, token, ...p }) })));
    for (const { p, j } of res) {
      const c = j && j.Comprobante;
      if (!c) { if (!out.noEncontrado) out.noEncontrado = JSON.stringify(j).slice(0, 200); continue; }
      const arrays = {};
      for (const k of Object.keys(c)) if (Array.isArray(c[k])) arrays[k] = { n: c[k].length, ej: c[k][0] || null };
      out.encontrados.push({ empresa, ...p, cliente: c.ClienteCodigo, nombre: c.ClienteNombre, total: c.Total, fecha: c.FechaEmision, claves: Object.keys(c), arrays, completo: q.full ? c : undefined });
    }
  }
  return { statusCode: 200, headers, body: JSON.stringify(out, null, 2) };
};
