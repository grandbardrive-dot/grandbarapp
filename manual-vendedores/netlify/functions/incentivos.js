// ============================================================
//  GrandBar Hub · Function · incentivos
//   Planes de incentivos de proveedores vs objetivo, para supervisores
//   y Marketing/Dirección. Objetivo GLOBAL de la empresa.
//   Plan "Cobertura" (Campari): por producto, Target (objetivo) vs
//   Avance (real) → % de cumplimiento. Datos de la tabla cobertura_productos
//   (editable). Antes leía el Sheet del Plan 5T (ya no existe).
//   Env: HUB_SERVICE_ROLE (o token del usuario).
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const pct = (a, t) => t > 0 ? Math.round(100 * a / t) : 0;

exports.handler = async (event) => {
  try {
    const hubService = process.env.HUB_SERVICE_ROLE;
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const hub = (path) => fetch(HUB_URL + '/rest/v1/' + path, { headers: { apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token) } });
    const perfil = (await (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,canal,region,es_supervisor')).json())[0] || {};
    const rol = String(perfil.rol || '').toLowerCase();
    const esSup = !!perfil.es_supervisor;
    const VER_TODO = ['diseno', 'admin', 'direccion', 'torneo', 'compras', 'desarrollo'];
    if (!esSup && !VER_TODO.includes(rol)) return json(403, { error: 'Solo para supervisores y Dirección/Marketing.' });

    const base = { nombre: perfil.nombre, region: perfil.region, canal: perfil.canal, alcance: 'todo', generado: new Date().toISOString() };

    // Plan Cobertura (objetivo global de la empresa, por producto)
    let rows = await (await hub('cobertura_productos?select=producto,orden,color,target,avance&order=orden.asc')).json();
    if (!Array.isArray(rows)) rows = [];
    const productos = rows.map(r => {
      const target = num(r.target), avance = num(r.avance);
      return { nombre: r.producto, color: r.color || '#c79a3b', target, avance, pct: pct(avance, target) };
    });
    const targetTotal = productos.reduce((a, p) => a + p.target, 0);
    const avanceTotal = productos.reduce((a, p) => a + p.avance, 0);

    const plan = {
      id: 'cobertura', nombre: 'Cobertura',
      detalle: 'Objetivo global de la empresa por producto: cuánto llevamos (avance) contra el target.',
      productos,
      targetTotal, avanceTotal,
      pct: pct(avanceTotal, targetTotal),
    };

    const proveedores = productos.length
      ? [{ id: 'campari', nombre: 'Campari', color: '#C8102E', planes: [plan] }]
      : [];

    return json(200, Object.assign(base, { proveedores }));
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
