// ============================================================
//  GrandBar Hub · Function · prospectos
//  API del panel de supervisores para los prospectos que arma el
//  agente cazar-clientes.
//    GET                         → lista los prospectos (ordenados por score)
//    POST {accion:'estado', id, estado, nota}  → el supervisor actualiza uno
//    POST {accion:'config'}      → zonas + hashtags (para la mini-config)
//
//  Lee la sesión del usuario (Hub) y opera con HUB_SERVICE_ROLE.
//  Env: HUB_SERVICE_ROLE
// ============================================================

const { regionDe } = require('./_equipo.js');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const ESTADOS  = ['nuevo', 'contactado', 'interesado', 'visita', 'descartado', 'ya_cliente'];
// Región de un prospecto según su zona (San Luis vs Mendoza).
const regionZona = z => /san\s*luis/i.test(String(z || '')) ? 'san_luis' : 'mendoza';

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });

    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    // ── POST: acciones ──
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');

      if (b.accion === 'estado') {
        if (!b.id || !ESTADOS.includes(b.estado)) return json(400, { error: 'datos inválidos' });
        const patch = { estado: b.estado, supervisor_id: user.id };
        if (b.nota !== undefined) patch.notas = String(b.nota || '').slice(0, 1000);
        const r = await sb('prospectos?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        if (!r.ok) return json(502, { error: 'No se pudo actualizar' });
        return json(200, { ok: true });
      }

      if (b.accion === 'config') {
        const [zR, hR] = await Promise.all([
          sb('prospectos_zonas?select=*&order=nombre'),
          sb('prospectos_hashtags?select=*&order=hashtag'),
        ]);
        return json(200, { zonas: await zR.json().catch(() => []), hashtags: await hR.json().catch(() => []) });
      }

      return json(400, { error: 'acción desconocida' });
    }

    // ── GET: lista ──
    const qs = (event.queryStringParameters || {});
    let path = 'prospectos?select=*&order=estado.asc,score.desc.nullslast,created_at.desc&limit=1000';
    if (qs.estado && ESTADOS.includes(qs.estado)) path = 'prospectos?select=*&estado=eq.' + qs.estado + '&order=score.desc.nullslast,created_at.desc&limit=1000';
    const r = await sb(path);
    let lista = await r.json().catch(() => []);
    if (!Array.isArray(lista)) lista = [];

    // Filtro por supervisor: cada uno ve SU canal + SU región.
    //   Diego → OFF Mendoza · Mollar → ON Mendoza · Martín Juárez → ON+OFF San Luis.
    // Dirección/admin (no supervisores) ven todo.
    const pRes = await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=canal,region,codigo_vendedor,es_supervisor');
    const perfil = (await pRes.json().catch(() => []))[0] || {};
    if (perfil.es_supervisor) {
      const uc = String(perfil.canal || '').toLowerCase();
      const ureg = regionDe(perfil); // 'mendoza' | 'san_luis' | ''
      lista = lista.filter(p => {
        const pc = String(p.canal || '').toLowerCase();
        if (uc === 'on' && pc !== 'on') return false;
        if (uc === 'off' && pc !== 'off') return false; // 'ambos'/'' no filtra por canal
        if (ureg && regionZona(p.zona) !== ureg) return false;
        return true;
      });
    }
    return json(200, { prospectos: lista, perfil: { canal: perfil.canal || null, region: regionDe(perfil) || null, es_supervisor: !!perfil.es_supervisor } });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
