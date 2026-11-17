// ============================================================
//  GrandBar Hub · Background · club-campari-background
//  "Club Campari" = automatiza el AVANCE del plan Cobertura de Campari (Incentivos):
//  clientes con compra DISTINTOS por marca en la ventana del período (bimestral Oct–Nov),
//  a nivel empresa. Escribe cobertura_productos.avance (HUB), que es lo que muestra el portal.
//
//  NO llama al ERP: usa la RPC club_campari_avance(desde,hasta) del proyecto Manual, que cuenta
//  ventas_cliente (neto>0) cruzando por SKU con el mapeo club_campari_marcas (Aperol/Campari/
//  Cynar confirmados; Skyy Inf y Others se agregan a ese mapeo cuando Luciana confirme la
//  definición — sin tocar este código). Solo actualiza las marcas que devuelve la RPC; las que
//  no están en el mapeo quedan como estén (carga manual).
//
//  Ventana en club_campari_config (HUB): desde / hasta.
//  Cron 1×/día (club-campari-cron). Prueba: /.netlify/functions/club-campari-background?key=DIAG_KEY
//  Env: HUB_SERVICE_ROLE, MANUAL_ANON_KEY (o key pública Manual), DIAG_KEY.
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = () => process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

function hubHeaders() {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) throw new Error('Falta HUB_SERVICE_ROLE');
  return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
}
const hub = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, Object.assign({}, o, { headers: Object.assign({}, hubHeaders(), o.headers || {}) }));
const man = (p, o = {}) => fetch(MAN_URL + '/rest/v1/' + p, Object.assign({}, o, { headers: Object.assign({ apikey: MAN_KEY(), Authorization: 'Bearer ' + MAN_KEY(), 'Content-Type': 'application/json' }, o.headers || {}) }));

async function calcular() {
  const cfg = await (await hub('club_campari_config?select=k,v')).json();
  const C = {}; (Array.isArray(cfg) ? cfg : []).forEach(r => { C[r.k] = r.v; });
  const desde = C.desde || '2026-10-01';
  const hasta = C.hasta || '2026-11-30';

  const r = await man('rpc/club_campari_avance', { method: 'POST', body: JSON.stringify({ desde, hasta }) });
  if (!r.ok) throw new Error('RPC club_campari_avance: ' + r.status + ' ' + (await r.text()).slice(0, 180));
  const rows = await r.json();
  if (!Array.isArray(rows)) throw new Error('RPC devolvió algo raro');

  const now = new Date().toISOString();
  const actualizadas = [];
  for (const row of rows) {
    const marca = row.marca, av = Number(row.clientes) || 0;
    const up = await hub('cobertura_productos?producto=eq.' + encodeURIComponent(marca), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ avance: av, updated_at: now }),
    });
    if (up.ok) actualizadas.push({ marca, avance: av });
    else actualizadas.push({ marca, error: up.status });
  }

  // Clientes DISTINTOS que compran alguna de las 5 marcas (para el anillo: X de 920).
  let clientesDistintos = null;
  try {
    const rc = await man('rpc/club_campari_clientes', { method: 'POST', body: JSON.stringify({ desde, hasta }) });
    if (rc.ok) {
      clientesDistintos = Number(await rc.json()) || 0;
      await hub('club_campari_config?k=eq.avance_clientes', {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ v: String(clientesDistintos) }),
      });
    }
  } catch (e) {}

  return { desde, hasta, actualizadas, clientesDistintos };
}

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const esPrueba = q.key && process.env.DIAG_KEY && q.key === process.env.DIAG_KEY;
  try {
    const out = await calcular();
    if (esPrueba) return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, ...out }) };
    return { statusCode: 202, body: '' };
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (esPrueba) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) };
    console.error('club-campari-background', msg);
    return { statusCode: 202, body: '' };
  }
};
