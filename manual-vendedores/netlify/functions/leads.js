// ============================================================
//  GrandBar Hub · Function · leads
//   Vendedor: ve y trabaja SUS leads asignados.
//   Supervisor/Dirección: ve sin asignar + los del equipo y ASIGNA.
//   Tabla `leads` en el Hub. Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];
const ESTADOS = ['nuevo', 'asignado', 'contactado', 'convertido', 'descartado'];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const qv = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

const { pushA } = require('./_notificar');
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
    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,canal,region,codigo_vendedor,es_supervisor')).json())[0] || {};
    const isDir = DIR_ROLES.includes(String(perfil.rol || '').toLowerCase());
    const puedeAsignar = isDir || perfil.es_supervisor;

    async function equipoCodigos() {
      const rows = await (await sb('usuarios?rol=eq.ventas&select=nombre,codigo_vendedor,canal,region')).json();
      const pc = String(perfil.canal || '').toLowerCase(), preg = String(perfil.region || '').toLowerCase();
      return (rows || []).filter(u => {
        if (!u.codigo_vendedor) return false;
        if (!isDir) { if (preg && u.region && String(u.region).toLowerCase() !== preg) return false; const uc = String(u.canal || '').toLowerCase(); if (!(!pc || pc === 'ambos' || uc === 'ambos' || pc === uc)) return false; }
        return true;
      });
    }
    async function notificar(destId, n) {
      if (!destId) return;
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: n.icono || '🔔', titulo: n.titulo, detalle: n.detalle || null, link: n.link || null }) }); } catch (e) {}
      try { await pushA(sb, destId, { title: (n.icono ? n.icono + ' ' : '') + n.titulo, body: n.detalle || '', url: (n.link && String(n.link).startsWith('/')) ? n.link : ('/' + (n.link || '')), tag: n.tag }); } catch (e) {}
    }
    async function idDeVendedor(cod) { const u = (await (await sb('usuarios?codigo_vendedor=eq.' + encodeURIComponent(cod) + '&select=id&limit=1')).json())[0]; return u ? u.id : null; }

    // ---------------- POST ----------------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

      if (b.accion === 'crear') {
        if (!puedeAsignar) return json(403, { error: 'No autorizado.' });
        if (!b.nombre && !b.telefono) return json(400, { error: 'Poné al menos nombre o teléfono.' });
        const fila = { nombre: b.nombre || null, telefono: b.telefono || null, email: b.email || null, origen: 'manual', zona: b.zona || null, canal: b.canal || null, mensaje: b.mensaje || null, estado: 'nuevo' };
        const r = await sb('leads', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude crear: ' + (await r.text()).slice(0, 150) });
        return json(200, { ok: true, lead: (await r.json())[0] });
      }

      if (b.accion === 'asignar' && b.id) {
        if (!puedeAsignar) return json(403, { error: 'Solo supervisor/dirección asigna.' });
        if (!b.vendedor) return json(400, { error: 'Elegí el vendedor.' });
        if (!isDir) { const eq = (await equipoCodigos()).map(u => String(u.codigo_vendedor)); if (!eq.includes(String(b.vendedor))) return json(403, { error: 'Ese vendedor no es de tu equipo.' }); }
        await sb('leads?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ vendedor: String(b.vendedor), estado: 'asignado', asignado_por: perfil.nombre || user.email, updated_at: new Date().toISOString() }) });
        const cur = (await (await sb('leads?id=eq.' + encodeURIComponent(b.id) + '&select=nombre')).json())[0] || {};
        await notificar(await idDeVendedor(b.vendedor), { icono: '🎯', titulo: 'Te asignaron un lead nuevo', detalle: (cur.nombre || 'Nuevo contacto') + ' — contactalo pronto', link: 'leads.html' });
        return json(200, { ok: true });
      }

      if (b.accion === 'estado' && b.id) {
        const est = String(b.estado || '');
        if (!ESTADOS.includes(est)) return json(400, { error: 'Estado inválido.' });
        const cur = (await (await sb('leads?id=eq.' + encodeURIComponent(b.id) + '&select=vendedor')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        const esMio = String(cur.vendedor || '') === String(perfil.codigo_vendedor || '__');
        if (!puedeAsignar && !esMio) return json(403, { error: 'No autorizado.' });
        const patch = { estado: est, updated_at: new Date().toISOString() };
        if (b.nota !== undefined) patch.nota = b.nota || null;
        await sb('leads?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // ---------------- GET ----------------
    const qp = event.queryStringParameters || {};
    const vista = qp.vista || (perfil.codigo_vendedor ? 'mios' : 'sin_asignar');

    if (vista === 'sin_asignar') {
      if (!puedeAsignar) return json(403, { error: 'No autorizado.' });
      const rows = await (await sb('leads?vendedor=is.null&estado=eq.nuevo&select=*&order=created_at.desc&limit=300')).json();
      const equipo = (await equipoCodigos()).map(u => ({ codigo: String(u.codigo_vendedor), nombre: u.nombre }));
      return json(200, { leads: Array.isArray(rows) ? rows : [], equipo });
    }

    if (vista === 'equipo') {
      if (!puedeAsignar) return json(403, { error: 'No autorizado.' });
      const equipo = await equipoCodigos();
      const codes = equipo.map(u => String(u.codigo_vendedor));
      let asignados = [];
      if (codes.length) asignados = await (await sb('leads?vendedor=in.(' + qv(codes) + ')&select=*&order=created_at.desc&limit=500')).json();
      const sin = await (await sb('leads?vendedor=is.null&estado=eq.nuevo&select=id')).json();
      return json(200, { leads: Array.isArray(asignados) ? asignados : [], equipo: equipo.map(u => ({ codigo: String(u.codigo_vendedor), nombre: u.nombre })), sin_asignar: (sin || []).length });
    }

    // Vendedor: mis leads
    const cod = perfil.codigo_vendedor;
    if (!cod) return json(200, { leads: [], puede_asignar: puedeAsignar });
    const rows = await (await sb('leads?vendedor=eq.' + encodeURIComponent(cod) + '&select=*&order=created_at.desc&limit=300')).json();
    return json(200, { leads: Array.isArray(rows) ? rows : [], puede_asignar: puedeAsignar });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
