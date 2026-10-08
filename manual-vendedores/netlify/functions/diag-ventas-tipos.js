// ============================================================
//  DIAGNÓSTICO (temporal) · ¿por qué las ventas del WebApi no llegan
//  a lo que muestra CuboVentas?
//  sync-ventas solo se queda con comprobantes FA*/NC*. Acá contamos TODO
//  lo que devuelve ListarComprobantes en un día, agrupado por tipo, para
//  ver cuánto estamos descartando.
//  Protegida: ?key=<DIAG_KEY>. Solo lectura. Devuelve conteos y nombres
//  de campos (ningún dato de clientes).
//    ?key=XXX&fecha=15/09/2026            → conteo por tipo de un día
//    ?key=XXX&fecha=15/09/2026&ver=REM    → además, 1 comprobante de ese
//                                           tipo: campos del detalle
//  Para tablas crudas del ERP usar diag-erp?tabla=NOMBRE.
//  BORRAR cuando terminemos.
// ============================================================

async function aikon(url, body, ms = 40000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { _raw: text.slice(0, 300) }; }
  } catch (e) { return { _error: (e && e.message) || String(e) }; }
  finally { clearTimeout(t); }
}

async function login() {
  const cuenta = process.env.AIKON_CUENTA;
  if (!cuenta || !process.env.AIKON_EMPRESA) throw new Error('Faltan AIKON_CUENTA / AIKON_EMPRESA.');
  const managerUrl = process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const j1 = await aikon(managerUrl, { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
  if (!urlCuenta) throw new Error('CuentaURL no devolvió URL: ' + JSON.stringify(j1).slice(0, 160));
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa: process.env.AIKON_EMPRESA });
  const token = j2.token && j2.token.Codigo;
  if (!token) throw new Error('ObtenerToken falló: ' + JSON.stringify(j2).slice(0, 160));
  return { urlCuenta, cuenta, token };
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  const q = (event && event.queryStringParameters) || {};
  if (!process.env.DIAG_KEY || q.key !== process.env.DIAG_KEY) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Falta ?key= válida (env DIAG_KEY).' }) };
  const fecha = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(q.fecha || '') ? q.fecha : null;
  if (!fecha) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pasá ?fecha=dd/mm/aaaa' }) };

  try {
    const { urlCuenta, cuenta, token } = await login();
    const jc = await aikon(urlCuenta + '/IS3/ListarComprobantes', { cuenta, token, FechaDesde: fecha, FechaHasta: fecha }, 40000);
    const comps = Array.isArray(jc.lista) ? jc.lista : (Array.isArray(jc) ? jc : []);
    if (!comps.length) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, fecha, total: 0, respuesta: JSON.stringify(jc).slice(0, 300) }, null, 2) };

    const porTipo = {};
    const clientesTodos = new Set(), clientesFaNc = new Set();
    for (const c of comps) {
      const k = `${String(c.Codigo || '?').trim()} ${String(c.Tipo || '').trim()}`.trim();
      const anulado = !!c.FechaAnulacion;
      const t = porTipo[k] || (porTipo[k] = { cantidad: 0, anulados: 0, neto: 0, total: 0, clientes: new Set(), entra_en_sync: /^(FA|NC)/i.test(String(c.Codigo || '')) });
      t.cantidad++;
      if (anulado) t.anulados++;
      t.neto += num(c.Neto); t.total += num(c.Total);
      const cli = String(c.ClienteCodigo == null ? '' : c.ClienteCodigo).trim();
      if (cli && !anulado) { t.clientes.add(cli); clientesTodos.add(cli); if (t.entra_en_sync) clientesFaNc.add(cli); }
    }
    const tipos = Object.entries(porTipo)
      .map(([tipo, t]) => ({ tipo, cantidad: t.cantidad, anulados: t.anulados, clientes: t.clientes.size, neto: Math.round(t.neto), total: Math.round(t.total), entra_en_sync: t.entra_en_sync }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const out = {
      ok: true, fecha,
      total_comprobantes: comps.length,
      entran_en_sync: comps.filter((c) => /^(FA|NC)/i.test(String(c.Codigo || '')) && !c.FechaAnulacion).length,
      clientes_distintos: { todos_los_tipos: clientesTodos.size, solo_FA_NC: clientesFaNc.size },
      tipos,
      campos_cabecera: Object.keys(comps[0] || {}),
      // ¿Aparecen las sucursales no fiscales (9999 Mendoza / 1000 San Luis)?
      por_sucursal: comps.reduce((m, c) => { const k = String(c.Sucursal ?? '?'); m[k] = (m[k] || 0) + 1; return m; }, {}),
      por_fiscalizado: comps.reduce((m, c) => { const k = String(c.Fiscalizado ?? '?'); m[k] = (m[k] || 0) + 1; return m; }, {}),
    };

    // Opcional: mirar un comprobante de un tipo que hoy descartamos (¿trae renglones?).
    if (q.ver) {
      const c = comps.find((x) => String(x.Codigo || '').toUpperCase().startsWith(String(q.ver).toUpperCase()) && !x.FechaAnulacion);
      if (!c) out.ver = { tipo: q.ver, encontrado: false };
      else {
        const j = await aikon(urlCuenta + '/IS3/ObtenerComprobante', { cuenta, token, Codigo: c.Codigo, Sucursal: c.Sucursal, Numero: c.Numero, Tipo: c.Tipo }, 15000);
        const comp = j.Comprobante || j.comprobante || {};
        const det = comp.Detalle || comp.detalle || [];
        out.ver = {
          tipo: `${c.Codigo} ${c.Tipo || ''}`.trim(), encontrado: true,
          renglones: Array.isArray(det) ? det.length : 0,
          campos_comprobante: Object.keys(comp),
          campos_renglon: Array.isArray(det) && det[0] ? Object.keys(det[0]) : [],
          error: j._error || (j._raw ? j._raw.slice(0, 160) : null),
        };
      }
    }
    return { statusCode: 200, headers, body: JSON.stringify(out, null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
