// ============================================================
//  GrandBar Hub · Function BACKGROUND · sync-comprobantes-background  (03/11/2026)
//  Guarda en comprobantes_venta (base de Cobranzas) TODAS las facturas, notas de
//  crédito y de débito emitidas, pagadas o no. La tabla facturas tiene solo las que
//  tienen saldo; con esta el vendedor ve y baja también las ya pagadas (clientes de
//  contado).
//
//  Liviana: usa solo la cabecera de ListarComprobantes (una consulta por día y por
//  empresa), sin pedir cada comprobante. En cada corrida:
//    1) vuelve a leer los últimos DIAS_RECIENTES días (facturas nuevas y anulaciones);
//    2) completa la historia hasta VENTAS_DESDE, el día más nuevo primero, con lo
//       que entre en el tiempo (comprobantes_venta_dias anota los días ya bajados).
//  Disparo: sync-comprobantes-cron (cada 30 min) con la clave SYNC_SECRET.
//  Cada corrida queda en sistema_corridas como 'sync-comprobantes'.
//  Env: AIKON_* (+ AIKON_EMPRESAS), COBRANZAS_SERVICE_ROLE, SYNC_SECRET.
// ============================================================

const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const BUDGET_MS = 720000;      // ~12 min (background dura hasta 15)
const DIAS_RECIENTES = 7;
const DESDE = process.env.VENTAS_DESDE || '2025-01-01';

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
const iso = (d) => d.toISOString().slice(0, 10);
function netDateToISO(s) { const m = String(s || '').match(/\/Date\((\d+)/); if (!m) return null; return new Date(Number(m[1]) - 3 * 3600 * 1000).toISOString().slice(0, 10); }
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const padCod = v => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? d.padStart(5, '0') : d; };
const escalar = (v) => (v != null && typeof v !== 'object' && String(v).trim() !== '' ? String(v).trim() : null);

function hoyAR() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = t => (p.find(x => x.type === t) || {}).value;
  return new Date(Date.UTC(+g('year'), +g('month') - 1, +g('day')));
}

const cob = (path, opts = {}) => {
  const k = process.env.COBRANZAS_SERVICE_ROLE;
  return fetch(COB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
};

// Días ya bajados (paginado: Supabase corta en 1000 filas sin avisar).
async function diasHechos() {
  const set = new Set();
  for (let off = 0; ; off += 1000) {
    const r = await cob(`comprobantes_venta_dias?select=fecha&order=fecha&limit=1000&offset=${off}`);
    if (!r.ok) throw new Error('comprobantes_venta_dias: ' + (await r.text()).slice(0, 160));
    const filas = await r.json();
    filas.forEach(f => set.add(f.fecha));
    if (filas.length < 1000) return set;
  }
}

// Mismo formato que facturas.numero y notas_credito.numero: '0003-00139455/A'.
function numeroDe(c) {
  const suc = String(c.Sucursal == null ? '' : c.Sucursal).trim();
  const nro = String(c.NumeroFiscal || c.Numero || '').trim();
  if (!suc || !nro) return null;
  const s = /^\d+$/.test(suc) ? suc.padStart(4, '0') : suc;
  const n = /^\d+$/.test(nro) ? nro.padStart(8, '0') : nro;
  return `${s}-${n}/${String(c.Tipo || '').trim()}`.replace(/\/$/, '');
}

// Un día en todas las empresas. Si una empresa falla, el día no se marca como bajado.
async function procesarDia(ctxs, d) {
  const fechaStr = fmtDDMMYYYY(d);
  const filas = [], porEmpresa = {};
  for (const ctx of ctxs) {
    const jl = await aikon(ctx.urlCuenta + '/IS3/ListarComprobantes', { cuenta: ctx.cuenta, token: ctx.token, FechaDesde: fechaStr, FechaHasta: fechaStr }, 40000);
    // Sin lista = error del ERP (un día sin ventas devuelve lista: []).
    if (!Array.isArray(jl.lista) && !Array.isArray(jl)) throw new Error(`ListarComprobantes (empresa ${ctx.empresa}) ${fechaStr}: ` + JSON.stringify(jl).slice(0, 160));
    const lista = Array.isArray(jl.lista) ? jl.lista : jl;
    const sirven = lista.filter(c => /^(FA|NC|ND)/i.test(String(c.Codigo || '')));
    porEmpresa[ctx.empresa] = sirven.length;
    for (const c of sirven) {
      const numero = numeroDe(c), codigo = padCod(c.ClienteCodigo);
      if (!numero || !codigo) continue;
      const vend = escalar(c.VendedorCodigo) || escalar(c.CodigoVendedor) || escalar(c.Vendedor);
      filas.push({
        numero, tipo: String(c.Codigo).trim().toUpperCase(), codigo,
        fecha: netDateToISO(c.FechaEmision) || iso(d),
        neto: num(c.Neto) == null ? null : Math.abs(num(c.Neto)),
        total: num(c.Total) == null ? null : Math.abs(num(c.Total)),
        empresa: ctx.empresa,
        vendedor: vend ? (/^\d+$/.test(vend) ? vend.padStart(3, '0') : vend) : null,
        anulado: !!c.FechaAnulacion,
        actualizado: new Date().toISOString(),
      });
    }
  }
  // Una misma clave dos veces en el lote hace fallar el upsert: queda la última.
  const unicas = [...new Map(filas.map(f => [f.numero + '|' + f.tipo, f])).values()];
  for (let i = 0; i < unicas.length; i += 500) {
    const r = await cob('comprobantes_venta?on_conflict=numero,tipo', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(unicas.slice(i, i + 500)) });
    if (!r.ok) throw new Error(`guardar ${fechaStr}: ` + (await r.text()).slice(0, 160));
  }
  const r = await cob('comprobantes_venta_dias?on_conflict=fecha', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ fecha: iso(d), cantidad: unicas.length, por_empresa: porEmpresa, actualizado: new Date().toISOString() }]) });
  if (!r.ok) throw new Error(`marcar ${fechaStr}: ` + (await r.text()).slice(0, 160));
  return unicas.length;
}

exports.handler = async (event) => {
  const secret = process.env.SYNC_SECRET;
  const q = (event && event.queryStringParameters) || {};
  if (secret && (q.key || '') !== secret) { console.warn('sync-comprobantes: key inválida, no se ejecuta.'); return { statusCode: 401, body: 'key' }; }
  if (!process.env.COBRANZAS_SERVICE_ROLE) { console.error('sync-comprobantes: falta COBRANZAS_SERVICE_ROLE'); return { statusCode: 500, body: 'config' }; }
  const t0 = Date.now();
  try {
    const ctxs = await Promise.all(EMPRESAS.map(login));
    const sinToken = ctxs.filter(c => !c.token).map(c => c.empresa);
    if (sinToken.length) throw new Error('Sin token del ERP para la empresa ' + sinToken.join(', '));

    // Recientes siempre; después los días que falten, el más nuevo primero.
    const hoy = hoyAR(), dias = [];
    for (let i = 0; i < DIAS_RECIENTES; i++) { const d = new Date(hoy); d.setUTCDate(d.getUTCDate() - i); dias.push(d); }
    const hechos = await diasHechos();
    const tope = new Date(DESDE + 'T00:00:00Z');
    for (let d = new Date(dias[dias.length - 1]); ; ) {
      d = new Date(d); d.setUTCDate(d.getUTCDate() - 1);
      if (d < tope) break;
      if (!hechos.has(iso(d))) dias.push(d);
    }

    let n = 0, comprobantes = 0;
    for (const d of dias) {
      if (Date.now() - t0 > BUDGET_MS) break;
      comprobantes += await procesarDia(ctxs, d);
      n++;
    }
    const faltan = dias.length - n;
    console.log('sync-comprobantes OK', JSON.stringify({ dias: n, comprobantes, faltan, ms: Date.now() - t0 }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, dias: n, comprobantes, faltan }) };
  } catch (e) {
    console.error('sync-comprobantes ERROR:', (e && e.message) || String(e));
    return { statusCode: 500, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};

exports.handler = require('./_corrida').conRegistro('sync-comprobantes', exports.handler, { siCorre: (e) => !process.env.SYNC_SECRET || ((e && e.queryStringParameters && e.queryStringParameters.key) || '') === process.env.SYNC_SECRET });
