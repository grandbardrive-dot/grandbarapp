// ============================================================
//  GrandBar Hub · Function · dir-indicadores  (Panel de Dirección, 24/11/2026)
//  Indicadores financieros que pidió Fernando (dos PDF: "Indicadores de cobranzas" e
//  "Indicadores de pago a proveedores"), con los cierres de mes y la actualización semanal:
//   · Plazo medio hasta recibir el pago = saldo promedio de cuentas corrientes de clientes ÷
//     ventas del mes × días.
//   · Plazo medio estimado hasta la acreditación = (saldo promedio de clientes + saldo promedio
//     de cheques en cartera sin acreditar) ÷ ventas del mes × días.
//   · Ingresos previstos por cheques: los cheques en cartera por semana de acreditación.
//   · Proveedores: saldo promedio a pagar y echeqs sin debitar. El plazo necesita las compras del
//     mes, que CUBO no da: queda sin calcular hasta que se defina de dónde salen.
//  Saldo promedio = (corte de inicio + corte de cierre) ÷ 2. Los cortes los guarda
//  indicadores-corte-cron (tabla indicadores_cortes, desde el 24/11/2026); el del mes en curso es
//  el de ahora. Ventas: todo lo facturado con IVA, interno y percepciones, neto de notas de
//  crédito (RPC ventas_con_iva_por_dia). Fuentes y criterios en _indicadores.js.
//  Solo Dirección (como dir-finanzas: son datos de caja).
//  Env: HUB_SERVICE_ROLE, COBRANZAS_SERVICE_ROLE
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];
const PRIMER_MES = '2026-11';            // los cortes se guardan desde el 24/11/2026
const CAMPOS = ['saldo_clientes', 'cheques_cartera', 'saldo_proveedores', 'cheques_propios'];
const { tomarCorte, ventasPorDia, hoyAR } = require('./_indicadores');

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const p2 = n => String(n).padStart(2, '0');
const finDeMes = m => { const [y, mm] = m.split('-').map(Number); return m + '-' + p2(new Date(Date.UTC(y, mm, 0)).getUTCDate()); };
const mesAnterior = m => { const [y, mm] = m.split('-').map(Number); return mm === 1 ? (y - 1) + '-12' : y + '-' + p2(mm - 1); };
const sumaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lunesDe = iso => { const d = new Date(iso + 'T12:00:00Z'); return sumaDias(iso, -((d.getUTCDay() + 6) % 7)); };

// El cierre de un mes: el último corte de sus últimos 3 días (por si una corrida falló).
function cierreDe(cortes, m) {
  const fin = finDeMes(m), desde = sumaDias(fin, -2);
  const l = cortes.filter(c => c.fecha >= desde && c.fecha <= fin);
  return l.length ? l[l.length - 1] : null;
}
const prom = (a, b, k) => (a && a[k] != null && b && b[k] != null) ? (Number(a[k]) + Number(b[k])) / 2 : (b && b[k] != null ? Number(b[k]) : null);
const plazo = (saldo, ventas, dias) => (saldo != null && ventas > 0) ? Math.round(saldo / ventas * dias * 10) / 10 : null;

// Un período: del inicio del mes a "hasta", con el corte de inicio (cierre del mes anterior) y el
// corte al final. Sin corte de inicio (noviembre de 2026, el primero), se usa solo el del final.
function calcular(ini, fin, ventas, dias) {
  const p = {}; CAMPOS.forEach(k => { p[k] = prom(ini, fin, k); });
  const conIni = !!ini && CAMPOS.some(k => ini[k] != null);
  return {
    dias, ventas: Math.round(ventas),
    ini: ini ? { fecha: ini.fecha, ...Object.fromEntries(CAMPOS.map(k => [k, ini[k] != null ? Number(ini[k]) : null])) } : null,
    fin: fin ? { fecha: fin.fecha, ...Object.fromEntries(CAMPOS.map(k => [k, fin[k] != null ? Number(fin[k]) : null])) } : null,
    promedio: p, soloCierre: !conIni,
    plazo_pago: plazo(p.saldo_clientes, ventas, dias),
    plazo_acreditacion: p.saldo_clientes != null && p.cheques_cartera != null ? plazo(p.saldo_clientes + p.cheques_cartera, ventas, dias) : null,
    // Proveedores: faltan las compras del mes (CUBO no las da).
    plazo_proveedores: null, plazo_debito: null,
  };
}

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,activo', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    if (perfil.activo === false || !DIR_ROLES.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Solo Dirección.' });

    const hoy = hoyAR(), mesHoy = hoy.slice(0, 7);
    const meses = [];
    for (let m = PRIMER_MES; m <= mesHoy; ) { meses.push(m); const [y, mm] = m.split('-').map(Number); m = mm === 12 ? (y + 1) + '-01' : y + '-' + p2(mm + 1); }
    const ultimos = meses.slice(-12);
    const hub = p => fetch(HUB_URL + '/rest/v1/' + p, { headers: { apikey: srole, Authorization: 'Bearer ' + srole } }).then(r => r.ok ? r.json() : []).catch(() => []);
    const [cortes, vivo, ...ventasMes] = await Promise.all([
      hub('indicadores_cortes?select=fecha,' + CAMPOS.join(',') + '&fecha=gte.' + mesAnterior(ultimos[0]) + '-01&order=fecha.asc'),
      tomarCorte(),
      ...ultimos.map(m => ventasPorDia(m + '-01', m === mesHoy ? hoy : finDeMes(m)).catch(() => null)),
    ]);
    const ventasDe = (m, hasta) => { const d = ventasMes[ultimos.indexOf(m)]; if (!d) return null; return Object.entries(d).filter(([f]) => f <= hasta).reduce((s, [, v]) => s + Number(v), 0); };
    // El corte de ahora (si una fuente no se pudo leer, la del corte guardado hoy).
    const guardadoHoy = cortes.find(c => c.fecha === hoy) || {};
    const ahora = { fecha: hoy };
    CAMPOS.forEach(k => { ahora[k] = vivo[k] != null ? vivo[k] : (guardadoHoy[k] != null ? Number(guardadoHoy[k]) : null); });

    // Cierres de mes y el mes en curso.
    const filas = ultimos.map(m => {
      const actual = m === mesHoy, hasta = actual ? hoy : finDeMes(m);
      const ini = cierreDe(cortes, mesAnterior(m));
      const fin = actual ? ahora : cierreDe(cortes, m);
      const ventas = ventasDe(m, hasta);
      const dias = Number(hasta.slice(8, 10));
      const r = ventas == null ? { sinVentas: true } : calcular(ini, fin, ventas, dias);
      return Object.assign({ mes: m, actual, desde: m + '-01', hasta, sinCierre: !actual && !fin }, r);
    }).reverse();

    // Semana a semana del mes en curso: el último corte de cada semana (la de hoy, con el de ahora).
    const semanas = [];
    const iniMes = cierreDe(cortes, mesAnterior(mesHoy));
    for (let lun = lunesDe(mesHoy + '-01'); lun <= hoy; lun = sumaDias(lun, 7)) {
      const dom = sumaDias(lun, 6);
      let c = null;
      if (hoy >= lun && hoy <= dom) c = ahora;
      else { const l = cortes.filter(x => x.fecha >= lun && x.fecha <= dom && x.fecha.slice(0, 7) === mesHoy); c = l.length ? l[l.length - 1] : null; }
      if (!c) continue;
      const v = ventasDe(mesHoy, c.fecha);
      if (v == null) continue;
      semanas.push(Object.assign({ fecha: c.fecha }, calcular(iniMes, c, v, Number(c.fecha.slice(8, 10)))));
    }

    // Ingresos previstos por cheques: los de la cartera, por semana de acreditación.
    let cheques = null;
    if (vivo._cheques) {
      const lun0 = lunesDe(hoy), semanasCh = [];
      for (let i = 0; i < 10; i++) { const d = sumaDias(lun0, 7 * i); semanasCh.push({ desde: d, hasta: sumaDias(d, 6), importe: 0, cantidad: 0 }); }
      const atrasados = { importe: 0, cantidad: 0 }, despues = { importe: 0, cantidad: 0, hasta: null }, sinFecha = { importe: 0, cantidad: 0 };
      vivo._cheques.forEach(x => {
        if (!x.acr) { sinFecha.importe += x.imp; sinFecha.cantidad++; return; }
        if (x.acr < hoy) { atrasados.importe += x.imp; atrasados.cantidad++; return; }
        const s = semanasCh.find(w => x.acr >= w.desde && x.acr <= w.hasta);
        if (s) { s.importe += x.imp; s.cantidad++; return; }
        despues.importe += x.imp; despues.cantidad++; if (!despues.hasta || x.acr > despues.hasta) despues.hasta = x.acr;
      });
      const red = o => Object.assign({}, o, { importe: Math.round(o.importe) });
      cheques = { total: Math.round(vivo._cheques.reduce((s, x) => s + x.imp, 0)), cantidad: vivo._cheques.length,
        atrasados: red(atrasados), semanas: semanasCh.map(red), despues: red(despues), sinFecha: red(sinFecha) };
    }

    return json(200, {
      hoy, ahora, filas, semanas, cheques,
      fuentes: { cheques_al: vivo.detalle.cheques_ultima_recepcion, pagos_al: vivo.detalle.pagos_resumen_al, errores: vivo.detalle.errores || null },
      primerCorte: cortes.length ? cortes[0].fecha : null,
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

module.exports.handler = require('./_errores').conErrores('dir-indicadores', module.exports.handler);
