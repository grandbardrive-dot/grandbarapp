// ============================================================
//  DIAGNÓSTICO TEMPORAL — inspección de notas de crédito en el ERP.
//  BORRAR apenas se use. Gated por token de un solo uso.
//  ?k=TOKEN&fac=9999-00153268/A&cod=FAC            → dump del comprobante (ambas empresas)
//  ?k=TOKEN&listar=1&desde=01/09/2026&hasta=30/09/2026&cli=03443  → comprobantes del cliente (filtra NCR)
// ============================================================
const TOKEN = 'd5f6b87034ea8164f4268e27562cd9fdd74bd0d836aa2982';

async function aikon(url, body, ms = 25000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }); const x = await r.text(); try { return JSON.parse(x); } catch { return { _raw: x.slice(0, 300) }; } }
  catch (e) { return { _error: (e && e.message) || String(e) }; } finally { clearTimeout(t); }
}
async function login(empresa) {
  const cuenta = process.env.AIKON_CUENTA;
  const j1 = await aikon(process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL', { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String((j1 && j1.retorno) || '').replace(/\/+$/, '');
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa });
  return { urlCuenta, cuenta, token: j2 && j2.token && j2.token.Codigo, empresa };
}
const EMPRESAS = (process.env.AIKON_EMPRESAS || `${process.env.AIKON_EMPRESA || '9999'},0001`).split(',').map(e => e.trim()).filter((e, i, a) => e && a.indexOf(e) === i);
const J = (s, o) => ({ statusCode: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(o, null, 2) });

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  if (q.k !== TOKEN) return { statusCode: 403, body: 'no' };
  try {
    const out = { empresas: EMPRESAS };
    if (q.listar) {
      const cli = String(q.cli || '').replace(/\D/g, '');
      for (const empresa of EMPRESAS) {
        const c = await login(empresa);
        if (!c.token) { out[empresa] = { token: false }; continue; }
        const jl = await aikon(c.urlCuenta + '/IS3/ListarComprobantes', { cuenta: c.cuenta, token: c.token, FechaDesde: q.desde, FechaHasta: q.hasta }, 40000);
        const lista = Array.isArray(jl.lista) ? jl.lista : (Array.isArray(jl) ? jl : []);
        const delCli = lista.filter(x => String(x.ClienteCodigo == null ? '' : x.ClienteCodigo).replace(/\D/g, '').replace(/^0+/, '') === cli.replace(/^0+/, ''));
        out[empresa] = { total: lista.length, delCliente: delCli.map(x => ({ Codigo: x.Codigo, Sucursal: x.Sucursal, Numero: x.Numero, Tipo: x.Tipo, Fecha: x.FechaEmision, Total: x.Total, Neto: x.Neto })) };
      }
      return J(200, out);
    }
    const fac = String(q.fac || '9999-00153268/A');
    const m = fac.match(/^(\d+)-(\d+)\/?\s*([A-Za-z0-9]*)$/);
    if (!m) return J(400, { error: 'fac inválido' });
    const Sucursal = m[1], Numero = m[2], Tipo = (m[3] || 'A').toUpperCase();
    for (const empresa of EMPRESAS) {
      const c = await login(empresa);
      if (!c.token) { out[empresa] = { token: false }; continue; }
      const jc = await aikon(c.urlCuenta + '/IS3/ObtenerComprobante', { cuenta: c.cuenta, token: c.token, Codigo: q.cod || 'FAC', Sucursal, Numero, Tipo });
      const comp = jc && jc.Comprobante;
      out[empresa] = comp ? { keys: Object.keys(comp), comprobante: comp } : { sinComprobante: true, raw: JSON.stringify(jc).slice(0, 300) };
    }
    return J(200, out);
  } catch (e) { return J(500, { error: (e && e.message) || String(e) }); }
};
