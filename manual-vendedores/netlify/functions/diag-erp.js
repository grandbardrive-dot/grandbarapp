// ============================================================
//  DIAGNÓSTICO (temporal) · qué TABLAS del ERP podemos leer con DtTabla.
//  El WebApi IS3 solo tiene el método ListarComprobantes (facturas); NO tiene
//  ListarPedidos/Remitos/Stock. Pero DtTabla lee tablas crudas (CLIENTES,
//  ARTICULOS con ar_stockact, etc.). Acá probamos nombres de tabla candidatos
//  para encontrar PEDIDOS / RESERVAS / STOCK.
//  Protegida por clave: ?key=<DIAG_KEY>. Devuelve columnas + cantidad de filas
//  (una fila de muestra con los nombres de campos, NO todos los datos).
//    ?key=XXX                 → prueba la lista de tablas candidatas
//    ?key=XXX&tabla=PEDIDOS   → lee una tabla puntual (columnas + 1 muestra)
//  BORRAR cuando terminemos.
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

// DtTabla suele devolver { estado, lista:[...] } o { retorno:[...] }
function resumenTabla(resp) {
  const j = resp.j;
  if (!j) return { existe: false, nota: resp.raw ? resp.raw.slice(0, 120) : (resp.err || 'sin respuesta') };
  const s = JSON.stringify(j).slice(0, 300);
  const noExiste = /No se ha encontrado|no existe|not found|error/i.test(s) && !/lista|retorno/i.test(s);
  const lista = Array.isArray(j.lista) ? j.lista : (Array.isArray(j.retorno) ? j.retorno : (Array.isArray(j) ? j : null));
  if (!lista) return { existe: !noExiste, filas: 0, head: s.slice(0, 160) };
  return { existe: true, filas: lista.length, columnas: lista[0] ? Object.keys(lista[0]) : [] };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const q = (event && event.queryStringParameters) || {};
    if (!process.env.DIAG_KEY || q.key !== process.env.DIAG_KEY) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Falta ?key= válida (env DIAG_KEY).' }) };

    const { urlCuenta, cuenta, token } = await login();
    if (!token) return { statusCode: 502, headers, body: JSON.stringify({ error: 'No obtuve token del ERP', urlCuenta }) };

    // Modo tabla puntual: columnas + 1 fila de muestra
    if (q.tabla) {
      const r = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla: q.tabla }, 40000);
      const res = resumenTabla(r);
      const lista = r.j && (r.j.lista || r.j.retorno);
      res.muestra = Array.isArray(lista) && lista[0] ? lista[0] : undefined;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, tabla: q.tabla, ...res }, null, 2) };
    }

    // Modo prueba: tablas candidatas
    const tablas = ['CLIENTES', 'ARTICULOS', 'PEDIDOS', 'PEDIDO', 'NOTAPEDIDO', 'NOTASPEDIDO', 'PEDIDOSCAB', 'REMITOS', 'REMITO', 'MOVIMIENTOS', 'MOVSTOCK', 'COMPROBANTES', 'VENTAS', 'PRESUPUESTOS', 'RESERVAS', 'STOCK', 'EXISTENCIAS', 'DEPOSITOS'];
    const out = {};
    for (const t of tablas) {
      const r = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla: t }, 20000);
      out[t] = resumenTabla(r);
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, tablas: out }, null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
