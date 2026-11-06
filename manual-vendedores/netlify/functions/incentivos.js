// ============================================================
//  GrandBar Hub · Function · incentivos
//   Planes de incentivos de proveedores vs objetivo, para supervisores
//   y Marketing/Dirección. Objetivo GLOBAL de la empresa.
//   Proveedores:
//    - Campari · "Cobertura": por producto, Target vs Avance → % cumplimiento.
//      Fuente: tabla cobertura_productos (editable).
//    - Pernod Ricard · "Q4 2026 · Clientes con compra": por objetivo (marca×canal)
//      meta/logrado/cerca/promo + por vendedor. Fuente: incentivos_snapshots
//      (la escribe el script diario que corre en una PC de GrandBar contra el ERP).
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
    const proveedores = [];

    // ---- Campari · Cobertura (tabla cobertura_productos) ----
    try {
      let rows = await (await hub('cobertura_productos?select=producto,orden,color,target,avance&order=orden.asc')).json();
      if (Array.isArray(rows) && rows.length) {
        const productos = rows.map(r => {
          const target = num(r.target), avance = num(r.avance);
          return { nombre: r.producto, color: r.color || '#c79a3b', target, avance, pct: pct(avance, target) };
        });
        const targetTotal = productos.reduce((a, p) => a + p.target, 0);
        const avanceTotal = productos.reduce((a, p) => a + p.avance, 0);
        proveedores.push({ id: 'campari', nombre: 'Campari', color: '#C8102E', planes: [{
          id: 'cobertura', nombre: 'Cobertura',
          detalle: 'Objetivo global de la empresa por producto: cuánto llevamos (avance) contra el target.',
          productos, targetTotal, avanceTotal, pct: pct(avanceTotal, targetTotal),
        }] });
      }
    } catch (e) {}

    // ---- Pernod Ricard · Q4 2026 (incentivos_snapshots) ----
    try {
      const snap = (await (await hub('incentivos_snapshots?incentivo=eq.PR_Q4_2026&select=corte,data,updated_at')).json())[0];
      if (snap && snap.data) {
        const d = snap.data;
        const objetivos = (d.objetivos || []).map(o => ({
          id: o.id, nombre: o.nombre, meta: num(o.meta), logrado: num(o.logrado),
          faltan: num(o.faltan != null ? o.faltan : Math.max(0, num(o.meta) - num(o.logrado))),
          con_promo: num(o.con_promo), cerca: num(o.cerca), pct: pct(num(o.logrado), num(o.meta)),
        }));
        const metaTotal = objetivos.reduce((a, o) => a + o.meta, 0);
        const logradoTotal = objetivos.reduce((a, o) => a + o.logrado, 0);
        const vendedores = (d.vendedores || []).slice().sort((a, b) => num(b.logrado_total) - num(a.logrado_total));
        proveedores.push({ id: 'pernod', nombre: 'Pernod Ricard', color: '#1F447F', planes: [{
          id: 'pr_q4', nombre: d.nombre || 'Q4 2026', detalle: d.detalle || '',
          corte: d.corte || snap.corte,
          objetivos, vendedores,
          targetTotal: metaTotal, avanceTotal: logradoTotal, pct: pct(logradoTotal, metaTotal),
        }] });
      }
    } catch (e) {}

    return json(200, Object.assign(base, { proveedores }));
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
