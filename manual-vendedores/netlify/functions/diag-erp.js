// ============================================================
//  DIAGNÓSTICO (temporal) · qué métodos expone el WebApi IS3 de Córdoba Software
//  Sirve para saber si podemos leer PEDIDOS / REMITOS / STOCK (no solo facturas).
//  Protegida por clave: ?key=<DIAG_KEY del env>. Devuelve SOLO metadatos
//  (qué método existe y cuántas filas trae), no vuelca datos de clientes.
//  Uso: /.netlify/functions/diag-erp?key=XXX&dia=25/08/2026
//  BORRAR cuando terminemos de diagnosticar.
// ============================================================

async function aikon(url, body, ms = 30000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const x = await r.text(); try { return { ok: r.ok, j: JSON.parse(x) }; } catch { return { ok: r.ok, raw: x.slice(0, 200) }; }
  } catch (e) { return { ok: false, err: (e && e.message) || String(e) }; } finally { clearTimeout(t); }
}

async function login() {
  const cuenta = process.env.AIKON_CUENTA;
  const j1 = await aikon(process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL', { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String((j1.j && j1.j.retorno) || '').replace(/\/+$/, '');
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa: process.env.AIKON_EMPRESA });
  return { urlCuenta, cuenta, token: j2.j && j2.j.token && j2.j.token.Codigo };
}

function conteo(resp) {
  const j = resp.j;
  if (!j) return { existe: !!resp.ok, filas: 0, nota: resp.raw ? resp.raw.slice(0, 120) : (resp.err || '') };
  const noExiste = /No se ha encontrado|no existe|not found/i.test(JSON.stringify(j).slice(0, 300));
  const lista = Array.isArray(j.lista) ? j.lista : (Array.isArray(j) ? j : (Array.isArray(j.retorno) ? j.retorno : null));
  return { existe: !noExiste, filas: lista ? lista.length : (j.retorno != null ? 1 : 0), campos: lista && lista[0] ? Object.keys(lista[0]).slice(0, 12) : undefined, head: JSON.stringify(j).slice(0, 140) };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const q = (event && event.queryStringParameters) || {};
    if (!process.env.DIAG_KEY || q.key !== process.env.DIAG_KEY) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Falta ?key= válida (env DIAG_KEY).' }) };

    const dia = q.dia || '25/08/2026';
    const desde = q.desde || dia, hasta = q.hasta || dia;
    const { urlCuenta, cuenta, token } = await login();
    if (!token) return { statusCode: 502, headers, body: JSON.stringify({ error: 'No obtuve token del ERP', urlCuenta }) };

    // Métodos "de fecha" (pedidos / remitos / movimientos)
    const conFecha = ['ListarComprobantes', 'ListarPedidos', 'ListarNotasPedido', 'ListarNotaPedido', 'ListarRemitos', 'ListarPresupuestos', 'ListarComprobantesNoFiscales', 'ListarComprobantesTodos', 'ListarMovimientos', 'ListarOrdenes'];
    // Métodos "de stock" (sin fecha)
    const stock = ['ListarStock', 'ObtenerStock', 'ConsultarStock', 'ListarExistencias', 'ListarArticulosStock', 'ListarArticulos'];

    const res = {};
    for (const m of conFecha) {
      const r = await aikon(urlCuenta + '/IS3/' + m, { cuenta, token, FechaDesde: desde, FechaHasta: hasta }, 25000);
      res[m] = conteo(r);
    }
    for (const m of stock) {
      const r = await aikon(urlCuenta + '/IS3/' + m, { cuenta, token }, 25000);
      res[m] = conteo(r);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, rango: { desde, hasta }, metodos: res }, null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
