// ============================================================
//  GrandBar Hub · BACKGROUND Function · proveedores-deuda-background  (19/11/2026)
//  Deuda con proveedores desde CUBO, para la franja Finanzas del Inicio de Dirección
//  (pedido del usuario: un número de finanzas que no dependa de los Excel de Administración).
//
//  ListarProveedores (WebApi IS3) trae cada proveedor con su Deuda y tarda unos 36 s: por eso
//  va en una función de fondo y deja una foto en finanzas_snapshots (base del Portal,
//  clave 'proveedores_deuda'). dir-finanzas la lee. La dispara proveedores-deuda-cron cada hora.
//
//  La foto: total adeudado (suma de las deudas positivas), saldo a favor (las negativas),
//  cuántos proveedores tienen deuda y los 10 de más deuda. CUBO no da vencimientos ni qué se
//  paga cada semana: eso sigue en el Excel de pagos de Administración.
//  Env: AIKON_* y VENTAS_EMPRESAS (los mismos de las ventas), HUB_SERVICE_ROLE.
//  Ojo: las respuestas de CUBO pueden traer el token de sesión: nunca se guardan ni se muestran.
// ============================================================
const { loginTodas } = require('./sync-ventas');

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

async function aikon(url, body, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { _sinJson: true, _status: r.status }; }
  } catch (e) { return { _error: (e && e.message) || String(e) }; }
  finally { clearTimeout(t); }
}

// "1234.56", 1234.56, "1.234,56" o "1,234.56" → número.
function plata(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v == null ? '' : v).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
  if (coma > punto) s = s.replace(/\./g, '').replace(',', '.');   // 1.234,56
  else s = s.replace(/,/g, '');                                     // 1,234.56
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
const campo = (o, ...ks) => { for (const k of ks) if (o && o[k] != null && String(o[k]).trim() !== '') return o[k]; return null; };

exports.handler = async () => {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) throw new Error('Falta HUB_SERVICE_ROLE');
  const ctxs = await loginTodas();

  const porCodigo = {};   // codigo → { codigo, nombre, deuda } (sumando empresas)
  const empresas = [];
  for (const ctx of ctxs) {
    const j = await aikon(ctx.urlCuenta + '/IS3/ListarProveedores', { cuenta: ctx.cuenta, token: ctx.token }, 120000);
    const lista = Array.isArray(j) ? j : Array.isArray(j && j.lista) ? j.lista : Array.isArray(j && j.data) ? j.data : null;
    if (!lista) {
      // Sin el cuerpo: puede traer el token. Solo qué campos vinieron.
      throw new Error('ListarProveedores (empresa ' + ctx.empresa + ') no devolvió la lista. Campos: ' + Object.keys(j || {}).join(','));
    }
    let total = 0;
    lista.forEach(p => {
      const cod = String(campo(p, 'Codigo', 'codigo', 'Cod') || '').trim();
      const deuda = plata(campo(p, 'Deuda', 'deuda', 'Saldo', 'saldo'));
      if (!cod) return;
      const x = porCodigo[cod] || (porCodigo[cod] = { codigo: cod, nombre: String(campo(p, 'Nombre', 'nombre', 'RazonSocial') || '').trim(), deuda: 0 });
      x.deuda += deuda;
      total += deuda;
    });
    empresas.push({ empresa: ctx.empresa, proveedores: lista.length, neto: Math.round(total) });
  }

  const todos = Object.values(porCodigo);
  const conDeuda = todos.filter(p => p.deuda > 0.5);
  const aFavor = todos.filter(p => p.deuda < -0.5);
  const data = {
    total: Math.round(conDeuda.reduce((a, p) => a + p.deuda, 0)),
    a_favor: Math.round(-aFavor.reduce((a, p) => a + p.deuda, 0)),
    con_deuda: conDeuda.length,
    proveedores: todos.length,
    top: conDeuda.sort((a, b) => b.deuda - a.deuda).slice(0, 10).map(p => ({ codigo: p.codigo, nombre: p.nombre, deuda: Math.round(p.deuda) })),
    empresas,
  };

  const r = await fetch(HUB_URL + '/rest/v1/finanzas_snapshots?on_conflict=clave', {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ clave: 'proveedores_deuda', data, actualizado: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error('No se pudo guardar la foto (' + r.status + ')');
  console.log('proveedores-deuda: ' + data.proveedores + ' proveedores, ' + data.con_deuda + ' con deuda, total ' + data.total);
  return { statusCode: 200, body: JSON.stringify({ ok: true, total: data.total, con_deuda: data.con_deuda }) };
};

// Cada corrida queda en sistema_corridas (estado-sistema y n8n avisan si falla).
exports.handler = require('./_corrida').conRegistro('proveedores-deuda', exports.handler);
