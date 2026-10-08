// ============================================================
//  DIAGNÓSTICO (temporal) · plan B para las ventas FISCALES.
//  ListarComprobantes solo trae lo no fiscal (sucursales 9999/1000).
//  ObtenerComprobante sí lee una factura fiscal si le pasamos el número,
//  y la numeración fiscal es correlativa por punto de venta → se puede
//  recorrer "la siguiente" hasta que no haya más.
//  Protegida: ?key=<DIAG_KEY>. Solo lectura. Sin datos de clientes.
//    ?key=XXX&modo=puntos
//        → ListarSaldosClientes agrupado por tipo + punto de venta + letra:
//          cantidad, número mínimo/máximo y fecha más nueva vista.
//    ?key=XXX&modo=probar&codigo=FAC&suc=0003&tipo=A&desde=134000&n=10
//        → ObtenerComprobante para desde..desde+n-1: existe, fecha,
//          cantidad de renglones, neto. (n máx 25)
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

async function login(empresaQ) {
  const cuenta = process.env.AIKON_CUENTA;
  const empresa = empresaQ || process.env.AIKON_EMPRESA;
  if (!cuenta || !empresa) throw new Error('Faltan AIKON_CUENTA / AIKON_EMPRESA.');
  const managerUrl = process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const j1 = await aikon(managerUrl, { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
  if (!urlCuenta) throw new Error('CuentaURL no devolvió URL: ' + JSON.stringify(j1).slice(0, 160));
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa });
  const token = j2.token && j2.token.Codigo;
  if (!token) throw new Error('ObtenerToken falló: ' + JSON.stringify(j2).slice(0, 160));
  return { urlCuenta, cuenta, token };
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const ddmmISO = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const netISO = (s) => { const m = String(s || '').match(/\/Date\((\d+)/); return m ? new Date(Number(m[1]) - 3 * 3600e3).toISOString().slice(0, 10) : null; };

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  const q = (event && event.queryStringParameters) || {};
  if (!process.env.DIAG_KEY || q.key !== process.env.DIAG_KEY) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Falta ?key= válida (env DIAG_KEY).' }) };
  const out = (code, o) => ({ statusCode: code, headers, body: JSON.stringify(o, null, 2) });

  try {
    const { urlCuenta, cuenta, token } = await login(/^\d{4}$/.test(q.empresa || '') ? q.empresa : null);

    if (q.modo === 'puntos') {
      const j = await aikon(urlCuenta + '/IS3/ListarSaldosClientes', { cuenta, token }, 60000);
      const listado = j.ListadoSaldoClientes || [];
      if (!Array.isArray(listado) || !listado.length) return out(502, { error: 'ListarSaldosClientes sin lista', resp: JSON.stringify(j).slice(0, 300) });
      const g = {};
      let sinAprobar = 0, raros = 0;
      for (const cli of listado) for (const c of (cli.ClienteComprobantes || [])) {
        const datos = String(c.Datos || '').trim();
        const m = datos.match(/^(\S+)\s+(\d+)-(\d+)\/?\s*([A-Za-z]?)$/);
        if (!m) { if (/-\s*[A-Za-z]/.test(datos)) sinAprobar++; else raros++; continue; }
        const [, cod, suc, nro, letra] = m;
        const k = `${cod} ${suc}/${letra || '-'}`;
        const n = Number(nro), f = ddmmISO(c.FechaEmision);
        const x = g[k] || (g[k] = { codigo: cod, suc, tipo: letra || null, cantidad: 0, min: n, max: n, fecha_max: f, ejemplo_max: datos });
        x.cantidad++;
        if (n < x.min) x.min = n;
        if (n > x.max) { x.max = n; x.ejemplo_max = datos; }
        if (f && (!x.fecha_max || f > x.fecha_max)) x.fecha_max = f;
      }
      const puntos = Object.values(g).sort((a, b) => b.cantidad - a.cantidad);
      return out(200, { ok: true, clientes: listado.length, sin_aprobar_arca: sinAprobar, formato_raro: raros, puntos });
    }

    if (q.modo === 'probar') {
      const codigo = String(q.codigo || 'FAC').toUpperCase(), suc = String(q.suc || ''), tipo = String(q.tipo || 'A').toUpperCase();
      const desde = Number(q.desde), n = Math.min(25, Math.max(1, Number(q.n) || 10));
      if (!suc || !Number.isFinite(desde)) return out(400, { error: 'Faltan suc y desde' });
      const ancho = Math.max(8, String(q.desde).length);
      const res = [];
      for (let i = 0; i < n; i++) {
        const numero = String(desde + i).padStart(ancho, '0');
        const j = await aikon(urlCuenta + '/IS3/ObtenerComprobante', { cuenta, token, Codigo: codigo, Sucursal: suc, Numero: numero, Tipo: tipo }, 15000);
        const c = j.Comprobante || j.comprobante;
        const det = (c && (c.Detalle || c.detalle)) || [];
        res.push(c && (c.Numero || c.NumeroFiscal || det.length)
          ? { numero, existe: true, fecha: netISO(c.FechaEmision), renglones: det.length, neto: Math.round(num(c.SubTotalComprobante || c.Neto || c.TotalNeto)), cae: !!String(c.CAENumero || '').trim(), anulado: !!c.FechaAnulacion }
          : { numero, existe: false, resp: (j._error || j._raw || JSON.stringify(j)).slice(0, 140) });
      }
      return out(200, { ok: true, codigo, suc, tipo, res });
    }

    return out(400, { error: 'modo=puntos | modo=probar' });
  } catch (e) {
    return out(500, { error: (e && e.message) || String(e) });
  }
};
