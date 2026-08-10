// ============================================================
//  GrandBar Hub · Function · tareas
//   Supervisor: crea tareas (diarias o puntuales) para su canal
//   o para vendedores puntuales; ve el cumplimiento.
//   Vendedor: ve sus tareas del día y las marca completadas.
//  Todo en la base del Hub, con service role. Valida el token del Hub.
//  Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,canal,region,codigo_vendedor,es_supervisor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = (await pRes.json())[0] || {};

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    // ---------- POST (acciones) ----------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

      if (b.accion === 'crear') {
        if (!perfil.es_supervisor) return json(403, { error: 'Solo los supervisores pueden crear tareas.' });
        if (!b.titulo) return json(400, { error: 'Falta el título.' });
        const fila = {
          titulo: b.titulo, descripcion: b.descripcion || null,
          frecuencia: b.frecuencia === 'puntual' ? 'puntual' : 'diaria',
          fecha: b.frecuencia === 'puntual' ? (b.fecha || null) : null,
          alcance: b.alcance === 'vendedores' ? 'vendedores' : 'canal',
          canal: perfil.canal || null,
          region: perfil.region || null,
          asignados: Array.isArray(b.asignados) ? b.asignados : [],
          creado_por: perfil.nombre || user.email, creado_por_id: user.id,
        };
        const r = await sb('tareas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude crear: ' + (await r.text()).slice(0, 150) });
        return json(200, { ok: true, tarea: (await r.json())[0] });
      }

      if (b.accion === 'desactivar' && b.id) {
        if (!perfil.es_supervisor) return json(403, { error: 'No autorizado.' });
        await sb('tareas?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ activa: false }) });
        return json(200, { ok: true });
      }

      if (b.accion === 'completar' && b.id) {
        const cod = perfil.codigo_vendedor;
        if (!cod) return json(400, { error: 'Sin código de vendedor.' });
        const r = await sb('tareas_completadas?on_conflict=tarea_id,vendedor,fecha', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ tarea_id: b.id, vendedor: cod }) });
        if (!r.ok) return json(502, { error: 'No pude marcar: ' + (await r.text()).slice(0, 150) });
        return json(200, { ok: true });
      }
      if (b.accion === 'descompletar' && b.id) {
        const cod = perfil.codigo_vendedor;
        await sb('tareas_completadas?tarea_id=eq.' + encodeURIComponent(b.id) + '&vendedor=eq.' + encodeURIComponent(cod) + '&fecha=eq.' + new Date().toISOString().slice(0, 10), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // ---------- GET (listar) ----------
    const vista = (event.queryStringParameters && event.queryStringParameters.vista) || (perfil.es_supervisor ? 'supervisor' : 'vendedor');

    if (vista === 'supervisor') {
      if (!perfil.es_supervisor) return json(403, { error: 'No autorizado.' });
      const r = await sb('tareas?creado_por_id=eq.' + encodeURIComponent(user.id) + '&activa=eq.true&select=*&order=created_at.desc');
      const tareas = await r.json();
      const hoy = new Date().toISOString().slice(0, 10);
      const ids = (Array.isArray(tareas) ? tareas : []).map(t => t.id);
      let compMap = {};
      if (ids.length) {
        const c = await sb('tareas_completadas?fecha=eq.' + hoy + '&tarea_id=in.(' + ids.map(x => '"' + x + '"').join(',') + ')&select=tarea_id,vendedor');
        (await c.json() || []).forEach(x => { (compMap[x.tarea_id] = compMap[x.tarea_id] || []).push(x.vendedor); });
      }
      const out = (Array.isArray(tareas) ? tareas : []).map(t => ({ ...t, completadas_hoy: (compMap[t.id] || []).length }));
      // Equipo del supervisor: vendedores de su misma región + canal (o 'ambos')
      const eq = await sb('usuarios?rol=eq.ventas&select=nombre,codigo_vendedor,canal,region');
      const pc = String(perfil.canal || '').toLowerCase(), preg = String(perfil.region || '').toLowerCase();
      const equipo = (await eq.json() || []).filter(u => {
        if (preg && u.region && String(u.region).toLowerCase() !== preg) return false;
        const uc = String(u.canal || '').toLowerCase();
        return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
      }).filter(u => u.codigo_vendedor).map(u => ({ codigo: u.codigo_vendedor, nombre: u.nombre }));
      return json(200, { rol: 'supervisor', canal: perfil.canal, region: perfil.region, nombre: perfil.nombre, equipo, tareas: out });
    }

    // Vendedor: tareas del día que le aplican
    const cod = perfil.codigo_vendedor, canal = perfil.canal, hoy = new Date().toISOString().slice(0, 10);
    const r = await sb('tareas?activa=eq.true&select=*&order=created_at.desc');
    const todas = await r.json();
    const aplica = (Array.isArray(todas) ? todas : []).filter(t => {
      if (t.frecuencia === 'puntual' && t.fecha !== hoy) return false;
      if (t.alcance === 'vendedores') return Array.isArray(t.asignados) && t.asignados.map(String).includes(String(cod));
      // alcance canal = equipo del supervisor: misma región + (canal coincide o alguno es 'ambos')
      if (t.region && perfil.region && String(t.region).toLowerCase() !== String(perfil.region).toLowerCase()) return false;
      const tc = String(t.canal || '').toLowerCase(), vc = String(canal || '').toLowerCase();
      return !tc || tc === 'ambos' || vc === 'ambos' || tc === vc;
    });
    // cuáles completó hoy
    const misComp = await sb('tareas_completadas?vendedor=eq.' + encodeURIComponent(cod || '') + '&fecha=eq.' + hoy + '&select=tarea_id');
    const hechas = new Set((await misComp.json() || []).map(x => x.tarea_id));
    const out = aplica.map(t => ({ id: t.id, titulo: t.titulo, descripcion: t.descripcion, frecuencia: t.frecuencia, completada: hechas.has(t.id) }));
    return json(200, { rol: 'vendedor', tareas: out });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
