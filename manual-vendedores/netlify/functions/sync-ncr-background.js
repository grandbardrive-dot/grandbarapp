// ============================================================
//  GrandBar Hub · Function BACKGROUND · sync-ncr-background
//  Baja las NOTAS DE CRÉDITO del ERP (Córdoba Software) y las guarda en la tabla
//  notas_credito, linkeadas a la factura que acreditan (para que el vendedor y el
//  cliente puedan verlas aunque estén aplicadas DENTRO de una factura).
//
//  Recorre día por día (las dos empresas), lista comprobantes, se queda con los
//  NCR y, por cada uno, pide el comprobante para sacar el detalle y la factura
//  referenciada. Upsert por (numero, tipo).
//
//    POST/GET ?desde=DD/MM/YYYY&hasta=DD/MM/YYYY   → backfill de ese rango
//    POST/GET ?dias=N                              → últimos N días (default 5)
//
//  Env: AIKON_* (+ AIKON_EMPRESAS) y COBRANZAS_SERVICE_ROLE.
// ============================================================

const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const BUDGET_MS = 780000; // ~13 min (background dura hasta 15)

async function aikon(url, body, ms = 40000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }); const x = await r.text(); try { return JSON.parse(x); } catch { return { _raw: x.slice(0, 200) }; } }
  catch (e) { return { _error: (e && e.message) || String(e) }; } finally { clearTimeout(t); }
}

const EMPRESAS = (process.env.AIKON_EMPRESAS || `${process.env.AIKON_EMPRESA || '9999'},0001`)
  .split(',').map(e => e.trim()).filter((e, i, a) => e && a.indexOf(e) === i);

async function login(empresa) {
  const cuenta = process.env.AIKON_CUENTA;
  const j1 = await aikon(process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL', { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String((j1 && j1.retorno) || '').replace(/\/+$/, '');
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa });
  return { urlCuenta, cuenta, token: j2 && j2.token && j2.token.Codigo, empresa };
}

const dd = (n) => String(n).padStart(2, '0');
const fmtDDMMYYYY = (d) => dd(d.getUTCDate()) + '/' + dd(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
function netDateToISO(s) { const m = String(s || '').match(/\/Date\((\d+)/); if (!m) return null; return new Date(Number(m[1]) - 3 * 3600 * 1000).toISOString().slice(0, 10); }
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const padCod = v => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? d.padStart(5, '0') : d; };

// hoy en Argentina (YYYY-MM-DD) y helper para armar lista de días (más nuevo primero)
function hoyAR() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = t => (p.find(x => x.type === t) || {}).value;
  return new Date(Date.UTC(+g('year'), +g('month') - 1, +g('day')));
}
const parseDDMMYYYY = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null; };

// Guarda (upsert) un lote de notas de crédito en la tabla.
async function guardar(rows) {
  if (!rows.length) return;
  const service = process.env.COBRANZAS_SERVICE_ROLE;
  await fetch(COB_URL + '/rest/v1/notas_credito?on_conflict=numero,tipo', {
    method: 'POST',
    headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

// Procesa un día en una empresa: lista comprobantes, se queda con NCR, baja el
// detalle de cada uno y arma las filas.
async function procesarDia(ctx, fechaStr) {
  const jl = await aikon(ctx.urlCuenta + '/IS3/ListarComprobantes', { cuenta: ctx.cuenta, token: ctx.token, FechaDesde: fechaStr, FechaHasta: fechaStr }, 40000);
  const lista = Array.isArray(jl.lista) ? jl.lista : (Array.isArray(jl) ? jl : []);
  const ncrs = lista.filter((c) => /^NC/i.test(String(c.Codigo || '')) && !c.FechaAnulacion);
  const rows = [];
  for (const c of ncrs) {
    const jc = await aikon(ctx.urlCuenta + '/IS3/ObtenerComprobante', { cuenta: ctx.cuenta, token: ctx.token, Codigo: c.Codigo, Sucursal: c.Sucursal, Numero: c.Numero, Tipo: c.Tipo }, 15000);
    const comp = jc && jc.Comprobante;
    if (!comp) continue;
    const det = Array.isArray(comp.Detalle) ? comp.Detalle : [];
    // Factura que acredita: primera referencia no vacía del detalle.
    let factura_ref = null;
    for (const d of det) {
      if (d && d.ReferenciaNumero) { factura_ref = `${d.ReferenciaSucursal}-${d.ReferenciaNumero}/${d.ReferenciaTipo || ''}`.replace(/\/$/, ''); break; }
    }
    const detalle = det.map((d) => ({ d: String(d.Descripcion || '').slice(0, 80), c: num(d.Cantidad), t: num(d.TotalNeto || d.ImporteUni || d.Total) })).filter((x) => x.d);
    const numero = `${comp.Sucursal}-${comp.NumeroFiscal || comp.Numero}/${comp.Tipo || c.Tipo || ''}`.replace(/\/$/, '');
    rows.push({
      empresa: ctx.empresa,
      codigo: padCod(comp.ClienteCodigo),
      numero,
      tipo: String(comp.Codigo || c.Codigo || 'NCR').toUpperCase(),
      fecha: netDateToISO(comp.FechaEmision) || netDateToISO(c.FechaEmision),
      total: Math.abs(num(comp.TotalComprobante || c.Total)),
      factura_ref,
      detalle,
    });
  }
  await guardar(rows);
  return { ncrs: ncrs.length, guardadas: rows.length };
}

exports.handler = async (event) => {
  const t0 = Date.now();
  try {
    if (!process.env.COBRANZAS_SERVICE_ROLE) return { statusCode: 500, body: 'Falta COBRANZAS_SERVICE_ROLE' };
    const q = (event && event.queryStringParameters) || {};

    // Rango de días (más nuevo primero).
    let dias = [];
    const desde = parseDDMMYYYY(q.desde), hasta = parseDDMMYYYY(q.hasta);
    if (desde && hasta) {
      for (let d = new Date(hasta); d >= desde; d.setUTCDate(d.getUTCDate() - 1)) dias.push(new Date(d));
    } else {
      const n = Math.min(60, Math.max(1, parseInt(q.dias || '5', 10)));
      const hoy = hoyAR();
      for (let i = 0; i < n; i++) { const d = new Date(hoy); d.setUTCDate(d.getUTCDate() - i); dias.push(d); }
    }

    // Login a las dos empresas una sola vez.
    const ctxs = (await Promise.all(EMPRESAS.map(login))).filter((c) => c.token);
    if (!ctxs.length) return { statusCode: 502, body: 'Sin token del ERP' };

    let totalDias = 0, totalNcr = 0, totalGuardadas = 0;
    for (const d of dias) {
      if (Date.now() - t0 > BUDGET_MS) break;
      const fechaStr = fmtDDMMYYYY(d);
      for (const ctx of ctxs) {
        const r = await procesarDia(ctx, fechaStr);
        totalNcr += r.ncrs; totalGuardadas += r.guardadas;
      }
      totalDias++;
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, dias: totalDias, ncr: totalNcr, guardadas: totalGuardadas, ms: Date.now() - t0 }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
