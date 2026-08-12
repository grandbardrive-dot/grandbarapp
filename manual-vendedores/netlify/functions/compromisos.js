// ============================================================
//  GrandBar Hub · Function · compromisos (agenda compartida)
//   Vendedor: CRUD sobre SUS compromisos.
//   Supervisor: CRUD sobre los de cualquier vendedor de su equipo
//               (misma región + canal) → le arma la agenda.
//   Tabla `compromisos` en el Hub. Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const qvals = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,canal,region,codigo_vendedor,es_supervisor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = (await pRes.json())[0] || {};

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    // Códigos del equipo del supervisor (región + canal)
    async function equipoCodigos() {
      const eqRes = await sb('usuarios?rol=eq.ventas&select=codigo_vendedor,canal,region');
      const pc = String(perfil.canal || '').toLowerCase(), preg = String(perfil.region || '').toLowerCase();
      return (await eqRes.json() || []).filter(u => {
        if (preg && u.region && String(u.region).toLowerCase() !== preg) return false;
        const uc = String(u.canal || '').toLowerCase();
        return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
      }).map(u => String(u.codigo_vendedor)).filter(Boolean);
    }
    // ¿Puede tocar la agenda de este vendedor?
    async function puede(vendCod) {
      if (!vendCod) return false;
      if (String(perfil.codigo_vendedor) === String(vendCod)) return true;
      if (perfil.es_supervisor) { const eq = await equipoCodigos(); return eq.includes(String(vendCod)); }
      return false;
    }

    // ---------- POST ----------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
      const rol = perfil.es_supervisor ? 'supervisor' : 'vendedor';

      if (b.accion === 'crear') {
        const vend = String(b.vendedor || perfil.codigo_vendedor || '');
        if (!(await puede(vend))) return json(403, { error: 'No podés cargar en esta agenda.' });
        if (!b.fecha) return json(400, { error: 'Falta la fecha.' });
        const fila = {
          vendedor: vend, cliente_codigo: b.cliente_codigo || null, cliente_nombre: b.cliente_nombre || null,
          tipo: ['visita', 'reunion', 'llamada', 'tarea'].includes(b.tipo) ? b.tipo : 'visita',
          fecha: b.fecha, hora: b.hora || null, duracion_min: b.duracion_min ? Number(b.duracion_min) : 60,
          objetivo: b.objetivo || null, creado_por: perfil.nombre || user.email, creado_por_rol: rol, creado_por_id: user.id,
        };
        const r = await sb('compromisos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude crear: ' + (await r.text()).slice(0, 150) });
        return json(200, { ok: true, compromiso: (await r.json())[0] });
      }

      if (b.accion === 'editar' && b.id) {
        const cur = (await (await sb('compromisos?id=eq.' + encodeURIComponent(b.id) + '&select=vendedor')).json())[0];
        if (!cur || !(await puede(cur.vendedor))) return json(403, { error: 'No autorizado.' });
        const patch = {};
        ['cliente_codigo', 'cliente_nombre', 'tipo', 'fecha', 'hora', 'objetivo'].forEach(k => { if (b[k] !== undefined) patch[k] = b[k]; });
        if (b.duracion_min !== undefined) patch.duracion_min = Number(b.duracion_min);
        await sb('compromisos?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        return json(200, { ok: true });
      }

      if ((b.accion === 'completar' || b.accion === 'descompletar') && b.id) {
        const cur = (await (await sb('compromisos?id=eq.' + encodeURIComponent(b.id) + '&select=vendedor')).json())[0];
        if (!cur || !(await puede(cur.vendedor))) return json(403, { error: 'No autorizado.' });
        await sb('compromisos?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: b.accion === 'completar' ? 'completado' : 'pendiente' }) });
        return json(200, { ok: true });
      }

      if (b.accion === 'borrar' && b.id) {
        const cur = (await (await sb('compromisos?id=eq.' + encodeURIComponent(b.id) + '&select=vendedor')).json())[0];
        if (!cur || !(await puede(cur.vendedor))) return json(403, { error: 'No autorizado.' });
        await sb('compromisos?id=eq.' + encodeURIComponent(b.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // ---------- GET ----------
    const qp = event.queryStringParameters || {};

    // Vista equipo (supervisor): resumen de compromisos por vendedor
    if (qp.equipo) {
      if (!perfil.es_supervisor) return json(403, { error: 'Solo supervisores.' });
      const codes = await equipoCodigos();
      if (!codes.length) return json(200, { equipo: [] });
      const hoy = new Date().toISOString().slice(0, 10);
      const r = await sb('compromisos?vendedor=in.(' + qvals(codes) + ')&fecha=gte.' + hoy + '&select=vendedor,fecha,estado&order=fecha.asc&limit=2000');
      const rows = await r.json();
      const agg = {}; codes.forEach(c => agg[c] = { codigo: c, hoy: 0, proximos: 0, pendientes: 0 });
      (Array.isArray(rows) ? rows : []).forEach(x => { const a = agg[String(x.vendedor)]; if (!a) return; if (x.fecha === hoy) a.hoy++; else a.proximos++; if (x.estado !== 'completado') a.pendientes++; });
      return json(200, { equipo: Object.values(agg) });
    }

    // Agenda de un vendedor (propia o de un miembro del equipo)
    const vend = String(qp.vendedor || perfil.codigo_vendedor || '');
    if (!vend) return json(200, { vendedor: null, compromisos: [], puede_editar: false });
    if (!(await puede(vend))) return json(403, { error: 'No podés ver esta agenda.' });
    let path = 'compromisos?vendedor=eq.' + encodeURIComponent(vend) + '&select=*&order=fecha.asc,hora.asc';
    if (qp.desde) path += '&fecha=gte.' + qp.desde;
    if (qp.hasta) path += '&fecha=lte.' + qp.hasta;
    path += '&limit=1000';
    const r = await sb(path);
    const compromisos = await r.json();
    // nombre del vendedor
    let nombreVend = null;
    if (String(vend) !== String(perfil.codigo_vendedor)) {
      const nv = await sb('usuarios?codigo_vendedor=eq.' + encodeURIComponent(vend) + '&select=nombre');
      nombreVend = ((await nv.json())[0] || {}).nombre || null;
    } else nombreVend = perfil.nombre;
    return json(200, { vendedor: vend, nombre_vendedor: nombreVend, es_propia: String(vend) === String(perfil.codigo_vendedor), puede_editar: true, compromisos: Array.isArray(compromisos) ? compromisos : [] });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
