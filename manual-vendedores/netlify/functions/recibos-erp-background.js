// ============================================================
//  GrandBar Hub · Function BACKGROUND · recibos-erp-background  (16/11/2026)
//  Completa SOLO el N° de recibo en la planilla de rendición. Antes Moni procesaba
//  el cobro en el sistema y volvía a la planilla a escribir "RBO 12917" a mano.
//
//  1) RECIBOS DEL ERP → tabla recibos_erp. El WebApi no deja listar recibos, solo
//     pedirlos por número (ObtenerComprobante REC <sucursal>-<numero>/X), así que se
//     sigue cada numeración en orden (tabla recibos_series):
//       MZA  empresa 0001, número 10000000 + n  (los "RBO 12917" de Mendoza)
//       SL   empresa 0001, número n             (San Luis, "3238")
//       NF   empresa 9999, número n             (no fiscal Mendoza, "2157")
//       NFSL empresa 9999, número n             (no fiscal San Luis, "2701")
//     La sucursal del recibo es el código del vendedor que cobró y el contador es
//     compartido entre vendedores, así que cada número se prueba en todos los códigos.
//     Avanza de a VENTANA números mientras aparezcan recibos nuevos.
//  2) EMPAREJAR con las filas de la planilla (mismo cliente): primero por las facturas
//     que cancela el recibo; si el recibo no lista facturas, por importe.
//     Nunca pisa un recibo que Moni escribió a mano (recibo_auto = false con valor).
//
//  Lo dispara recibos-erp-cron (cada 15 min en horario de oficina) y el panel de
//  cobranzas cuando Moni abre una planilla. ?force=1 saltea el freno de 2 min.
//  Env: AIKON_* (+ AIKON_EMPRESAS) y COBRANZAS_SERVICE_ROLE.
// ============================================================

const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const BUDGET_MS = 12 * 60 * 1000;
const VENTANA = 3;        // números que se prueban por vuelta
const SALTO = 12;         // hasta dónde mira si en la ventana no hubo nada (números salteados)
const PARALELO = 8;       // pedidos simultáneos al ERP
const EQUIPOS_VENTA = ['ON', 'OFF', 'SL', 'MAY SL', 'MAY MDZ'];

async function aikon(url, body, ms = 30000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }); const x = await r.text(); try { return JSON.parse(x); } catch { return { _raw: x.slice(0, 200) }; } }
  catch (e) { return { _error: (e && e.message) || String(e) }; } finally { clearTimeout(t); }
}

async function login(empresa) {
  const cuenta = process.env.AIKON_CUENTA;
  const j1 = await aikon(process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL', { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String((j1 && j1.retorno) || '').replace(/\/+$/, '');
  if (!urlCuenta) return { empresa };
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa });
  return { urlCuenta, cuenta, token: j2 && j2.token && j2.token.Codigo, empresa };
}

const cob = (p, o = {}) => {
  const service = process.env.COBRANZAS_SERVICE_ROLE;
  return fetch(COB_URL + '/rest/v1/' + p, { ...o, headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' }, o.headers || {}) });
};
const leer = async (p) => { const r = await cob(p); const j = await r.json().catch(() => []); return Array.isArray(j) ? j : []; };

const padCod = v => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? d.padStart(5, '0') : ''; };
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
function netDateToISO(s) { const m = String(s || '').match(/\/Date\((\d+)/); if (!m) return null; return new Date(Number(m[1]) - 3 * 3600 * 1000).toISOString().slice(0, 10); }
const sumaDias = (iso, d) => { const x = new Date(iso + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const hoyAR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

// "FAC 0003-00139191 A" / "Ref:FAC 0003-00139191/A" / "0005-00037052/A; 0005-…" → "0003-00139191/A"
function facturasDe(texto) {
  const out = new Set();
  const re = /(\d{4})-(\d{8})\s*\/?\s*([A-Z])\b/g;
  let m; const s = String(texto || '').toUpperCase();
  while ((m = re.exec(s))) out.add(m[1] + '-' + m[2] + '/' + m[3]);
  return [...out];
}

// Corre funciones async de a `n` en paralelo.
async function enParalelo(items, n, fn) {
  const res = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]); } }));
  return res;
}

function aRecibo(c, serie) {
  const det = Array.isArray(c.Detalle) ? c.Detalle : [];
  const facturas = new Set();
  det.forEach(d => facturasDe((d.Descripcion || '') + ' ' + (d.Mensaje || '')).forEach(f => facturas.add(f)));
  const pagos = Array.isArray(c.Pagos) ? c.Pagos.reduce((s, p) => s + num(p.Importe), 0) : 0;
  const cliente = padCod(c.ClienteCodigo);
  return {
    empresa: serie.empresa, sucursal: String(c.Sucursal), numero: String(c.Numero), serie: serie.serie,
    n: Number(c.Numero) - Number(serie.base),
    cliente, cliente_nombre: c.ClienteNombre || null,
    fecha: netDateToISO(c.FechaEmision), hora: c.HoraEmision || null,
    total: num(c.TotalCancelacion) || num(c.TotalComprobanteGrabado) || pagos,
    facturas: [...facturas], vendedor: c.VendedorCodigo || c.Cobrador || null,
    anulado: !!c.FechaAnulacion || cliente === '99999',
  };
}

// ---------- 1) Seguir las numeraciones ----------
async function leerSeries(ctxs, codigos, t0, log) {
  const series = await leer('recibos_series?activo=eq.true&order=serie');
  const hayPendientes = (await leer('planilla_cobranzas?select=id&procesado=eq.true&recibo=is.null&fecha_rendicion=gte.' + sumaDias(hoyAR(), -3) + '&limit=1')).length > 0;
  let nuevos = 0;
  for (const s of series) {
    const ctx = ctxs[s.empresa];
    if (!ctx || !ctx.token) { log.push(s.serie + ': sin token ' + s.empresa); continue; }
    // Lock: si otra corrida tiene esta serie hace menos de 14 min, se saltea.
    const lim = new Date(Date.now() - 14 * 60 * 1000).toISOString();
    const lk = await cob('recibos_series?serie=eq.' + s.serie + '&or=(corriendo_desde.is.null,corriendo_desde.lt."' + lim + '")',
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ corriendo_desde: new Date().toISOString() }) });
    const tomada = (await lk.json().catch(() => []))[0];
    if (!tomada) { log.push(s.serie + ': ocupada'); continue; }
    // El contador se relee recién al tomar el candado: otra corrida pudo haberlo movido.
    let cursor = Number(tomada.cursor), cursorFecha = tomada.cursor_fecha, vueltas = 0, hallados = 0;
    const probar = async (desdeN, hastaN) => {
      const pruebas = [];
      for (let n = desdeN; n <= hastaN; n++) for (const suc of codigos) pruebas.push({ n, suc });
      const res = await enParalelo(pruebas, PARALELO, async (p) => {
        const j = await aikon(ctx.urlCuenta + '/IS3/ObtenerComprobante', { cuenta: ctx.cuenta, token: ctx.token, Codigo: 'REC', Sucursal: p.suc, Numero: String(Number(s.base) + p.n).padStart(8, '0'), Tipo: 'X' });
        return j && j.Comprobante ? aRecibo(j.Comprobante, s) : null;
      });
      // El mismo número puede existir en otra sucursal de hace años: solo cuentan los recientes.
      const desde = sumaDias(cursorFecha || hoyAR(), -10);
      return res.filter(r => r && r.fecha && r.fecha >= desde);
    };
    try {
      while (Date.now() - t0 < BUDGET_MS) {
        vueltas++;
        let hits = await probar(cursor + 1, cursor + VENTANA);
        // Hay números salteados (anulados, o de una sucursal que no es de un vendedor).
        // Si la numeración quedó atrás (no llegó a hoy) o hay filas procesadas esperando su
        // recibo, se mira más adelante antes de darse por vencida.
        if (!hits.length && (cursorFecha < hoyAR() || hayPendientes)) hits = await probar(cursor + VENTANA + 1, cursor + SALTO);
        if (!hits.length) break;
        const up = await cob('recibos_erp?on_conflict=empresa,sucursal,numero', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(hits) });
        if (!up.ok) { log.push(s.serie + ': no se pudo guardar ' + (await up.text()).slice(0, 120)); break; }
        hallados += hits.length;
        cursor = Math.max(...hits.map(h => h.n));
        cursorFecha = hits.map(h => h.fecha).sort().pop();
      }
    } finally {
      await cob('recibos_series?serie=eq.' + s.serie, { method: 'PATCH', body: JSON.stringify({ cursor, cursor_fecha: cursorFecha, corriendo_desde: null, actualizado: new Date().toISOString() }) });
    }
    nuevos += hallados;
    log.push(s.serie + ': ' + hallados + ' recibos, va por ' + cursor + ' (' + vueltas + ' vueltas)');
  }
  return nuevos;
}

// ---------- 2) Emparejar con la planilla ----------
const MEDIOS = ['efectivo', 'cheques', 'retenciones', 'transferencia', 'tarjeta', 'echeq'];
const clave = r => r.empresa + '|' + r.sucursal + '|' + r.numero;

async function emparejar(log) {
  const hoy = hoyAR();
  const desde = sumaDias(hoy, -45);
  const filas = await leer('planilla_cobranzas?select=id,codigo,factura,importe,fecha_rendicion,recibo,recibo_auto,recibo_erp,' + MEDIOS.join(',') + '&fecha_rendicion=gte.' + desde + '&order=fecha_rendicion.asc,created_at.asc&limit=5000');
  const recs = await leer('recibos_erp?select=*&anulado=eq.false&fecha=gte.' + sumaDias(desde, -7) + '&limit=10000');
  if (!recs.length) return 0;
  const porCliente = {};
  recs.forEach(r => { (porCliente[r.cliente] = porCliente[r.cliente] || []).push(r); });

  // Recibos ya enlazados → fecha de la planilla que los tomó (un recibo puede cubrir
  // varias filas de la MISMA planilla, nunca de otra).
  const usado = {};
  filas.forEach(f => (Array.isArray(f.recibo_erp) ? f.recibo_erp : []).forEach(x => { usado[clave(x)] = f.fecha_rendicion; }));

  // Una misma factura se paga a veces en partes, en recibos de distintos días: por eso se
  // asigna en tres pasadas, de la coincidencia más segura a la menos segura.
  const libres = filas.filter(f => !f.recibo_auto && !(f.recibo && String(f.recibo).trim())); // las de Moni no se tocan
  const info = libres.map(f => ({
    f, facs: new Set(facturasDe(f.factura)),
    pagado: MEDIOS.reduce((s, m) => s + num(f[m]), 0),
    cands: (porCliente[padCod(f.codigo)] || []).filter(r => r.fecha >= sumaDias(f.fecha_rendicion, -3) && r.fecha <= sumaDias(f.fecha_rendicion, 30)),
  })).filter(x => x.cands.length);
  const libre = (r, f) => !usado[clave(r)] || usado[clave(r)] === f.fecha_rendicion;
  const solapa = (r, x) => (r.facturas || []).some(k => x.facs.has(k));
  const mismoImporte = (r, x) => Math.abs(num(r.total) - x.pagado) <= 1 || Math.abs(num(r.total) - num(x.f.importe)) <= 1;
  const cercania = (r, x) => Math.abs(new Date(r.fecha) - new Date(x.f.fecha_rendicion)); // el más cercano al día de la planilla
  const asignado = new Map(); // id fila → recibos
  const tomar = (x, recs) => { asignado.set(x.f.id, recs); recs.forEach(r => { usado[clave(r)] = x.f.fecha_rendicion; }); };

  // 1) misma factura Y mismo importe → un recibo
  info.forEach(x => {
    const r = x.cands.filter(r => !usado[clave(r)] && solapa(r, x) && mismoImporte(r, x)).sort((a, b) => cercania(a, x) - cercania(b, x))[0];
    if (r) tomar(x, [r]);
  });
  // 2) misma factura (pago en varios recibos, o recibo que cubre varias filas): los del día
  //    más cercano a la planilla
  info.filter(x => !asignado.has(x.f.id)).forEach(x => {
    const sol = x.cands.filter(r => libre(r, x.f) && solapa(r, x));
    if (!sol.length) return;
    const dia = sol.slice().sort((a, b) => cercania(a, x) - cercania(b, x))[0].fecha;
    tomar(x, sol.filter(r => r.fecha === dia));
  });
  // 3) recibo sin facturas (a cuenta): por importe
  info.filter(x => !asignado.has(x.f.id)).forEach(x => {
    const r = x.cands.filter(r => !usado[clave(r)] && !(r.facturas || []).length && mismoImporte(r, x)).sort((a, b) => cercania(a, x) - cercania(b, x))[0];
    if (r) tomar(x, [r]);
  });

  let completadas = 0;
  for (const x of info) {
    const elegidos = asignado.get(x.f.id);
    if (!elegidos) continue;
    elegidos.sort((a, b) => a.n - b.n);
    const recibo_erp = elegidos.map(r => ({ empresa: r.empresa, sucursal: r.sucursal, numero: r.numero, n: r.n, total: num(r.total), fecha: r.fecha }));
    const pr = await cob('planilla_cobranzas?id=eq.' + x.f.id + '&recibo_auto=eq.false', { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ recibo: elegidos.map(r => String(r.n)).join(' + '), recibo_auto: true, recibo_erp }) });
    if (pr.ok) completadas++;
  }
  log.push('planilla: ' + completadas + ' filas con recibo');
  return completadas;
}

exports.handler = async (event) => {
  const t0 = Date.now(), log = [];
  const q = (event && event.queryStringParameters) || {};
  if (!process.env.COBRANZAS_SERVICE_ROLE) { console.log('recibos-erp: falta COBRANZAS_SERVICE_ROLE'); return { statusCode: 500 }; }
  try {
    // Freno: si corrió hace menos de 2 min (el panel la dispara mientras Moni tiene una
    // planilla abierta), no repite: así el ERP no recibe consultas de más.
    if (!q.force) {
      const ult = await leer('recibos_series?select=actualizado&order=actualizado.desc&limit=1');
      if (ult[0] && Date.now() - new Date(ult[0].actualizado).getTime() < 120000) { console.log('recibos-erp: corrió hace poco'); return { statusCode: 200 }; }
    }
    const empresas = (process.env.AIKON_EMPRESAS || `${process.env.AIKON_EMPRESA || '9999'},0001`).split(',').map(e => e.trim()).filter((e, i, a) => e && a.indexOf(e) === i);
    const ctxs = {};
    (await Promise.all(empresas.map(login))).forEach(c => { ctxs[c.empresa] = c; });
    // Códigos de vendedor = sucursales posibles del recibo.
    const [eq, pl] = await Promise.all([
      leer('equipos_vendedores?select=vendedor,equipo'),
      leer('planilla_cobranzas?select=vendedor&fecha_rendicion=gte.' + sumaDias(hoyAR(), -60) + '&limit=5000'),
    ]);
    const cods = new Set(['1000', '9999']); // oficinas: San Luis cobra en mostrador con la sucursal 1000
    eq.filter(e => EQUIPOS_VENTA.includes(String(e.equipo || '').toUpperCase())).forEach(e => cods.add(e.vendedor));
    pl.forEach(p => cods.add(p.vendedor));
    const codigos = [...cods].map(c => String(c || '').replace(/\D/g, '')).filter(Boolean).map(c => c.padStart(4, '0')).filter((c, i, a) => a.indexOf(c) === i).sort();

    if (Object.values(ctxs).some(c => c.token)) await leerSeries(ctxs, codigos, t0, log);
    else log.push('ERP sin respuesta (sin token)');
    await emparejar(log);
  } catch (e) {
    log.push('error: ' + ((e && e.message) || String(e)));
  }
  console.log('recibos-erp:', log.join(' · '), '·', Math.round((Date.now() - t0) / 1000) + 's');
  return { statusCode: 200, body: JSON.stringify({ ok: true, log }) };
};

module.exports.handler = require('./_errores').conErrores('recibos-erp-background', module.exports.handler);
