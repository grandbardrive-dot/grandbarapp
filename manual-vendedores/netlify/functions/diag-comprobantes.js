// DIAGNÓSTICO: cuántos comprobantes trae ListarComprobantes en un día y cómo se
// reparten por Codigo (tipo de doc) y Sucursal. Para entender por qué vemos pocas
// ventas. Uso: /diag-comprobantes?dia=25/08/2026   (o rango ?desde=&hasta=)
async function aikon(url, body, ms = 40000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }); const x = await r.text(); try { return JSON.parse(x); } catch { return { _raw: x.slice(0, 200) }; } }
  catch (e) { return { _error: (e && e.message) || String(e) }; } finally { clearTimeout(t); }
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
    const q = (event && event.queryStringParameters) || {};
    const desde = q.desde || q.dia || '25/08/2026';
    const hasta = q.hasta || q.dia || desde;
    const { urlCuenta, cuenta, token } = await login();

    // Modo PROBE: buscar métodos que traigan las ventas NO facturadas (remitos/pedidos/movimientos).
    if (q.probe) {
      const metodos = ['ListarRemitos', 'ListarPedidos', 'ListarMovimientos', 'ListarComprobantesTodos', 'ListarNotasPedido', 'ListarComprobantesNoFiscales', 'ListarPresupuestos', 'ListarFacturas'];
      const res = [];
      for (const m of metodos) {
        const j = await aikon(urlCuenta + '/IS3/' + m, { cuenta, token, FechaDesde: desde, FechaHasta: hasta }, 25000);
        const lista = Array.isArray(j.lista) ? j.lista : (Array.isArray(j) ? j : null);
        res.push({ metodo: m, existe: !(j._raw && /No se ha encontrado/i.test(j._raw)), filas: lista ? lista.length : 0, head: JSON.stringify(j).slice(0, 160) });
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, rango: { desde, hasta }, probe: res }, null, 2) };
    }

    const jc = await aikon(urlCuenta + '/IS3/ListarComprobantes', { cuenta, token, FechaDesde: desde, FechaHasta: hasta }, 60000);
    const comps = Array.isArray(jc.lista) ? jc.lista : (Array.isArray(jc) ? jc : []);
    const porCodigo = {}, porSucursal = {}, clientes = new Set();
    let anulados = 0;
    for (const c of comps) {
      porCodigo[c.Codigo || '?'] = (porCodigo[c.Codigo || '?'] || 0) + 1;
      porSucursal[c.Sucursal || '?'] = (porSucursal[c.Sucursal || '?'] || 0) + 1;
      if (c.ClienteCodigo != null) clientes.add(String(c.ClienteCodigo).trim());
      if (c.FechaAnulacion) anulados++;
    }
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, rango: { desde, hasta }, total_comprobantes: comps.length,
      clientes_distintos: clientes.size, anulados,
      por_codigo: porCodigo, por_sucursal: porSucursal,
      ejemplo: comps[0] ? { Codigo: comps[0].Codigo, Sucursal: comps[0].Sucursal, ClienteCodigo: comps[0].ClienteCodigo, ClienteNombre: comps[0].ClienteNombre } : null,
    }, null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
