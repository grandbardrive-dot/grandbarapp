// ============================================================
//  GrandBar Hub · Function · agenda-eficiente
//   Flujo de "Agenda Eficiente" del vendedor:
//    1) categorizar clientes por frecuencia (semanal/quincenal/mensual)
//    2) armar plan MENSUAL (qué día visita a cada cliente)
//    3) enviar al supervisor -> aprobar / pedir cambios / seguimiento
//    4) agenda del día (marcar visitado + tiempo)
//   Vendedor: sobre lo suyo. Supervisor: sobre su equipo (region+canal).
//   Env: HUB_SERVICE_ROLE, COBRANZAS_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const FREC = ['semanal', 'quincenal', 'mensual'];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const qv = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    const cobService = process.env.COBRANZAS_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const cob = (path) => cobService ? fetch(COB_URL + '/rest/v1/' + path, { headers: { apikey: cobService, Authorization: 'Bearer ' + cobService } }) : Promise.resolve({ json: async () => [] });

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,canal,region,codigo_vendedor,es_supervisor')).json())[0] || {};

    async function equipoCodigos() {
      const rows = await (await sb('usuarios?rol=eq.ventas&select=codigo_vendedor,canal,region')).json();
      const pc = String(perfil.canal || '').toLowerCase(), preg = String(perfil.region || '').toLowerCase();
      return (rows || []).filter(u => {
        if (!u.codigo_vendedor) return false;
        if (preg && u.region && String(u.region).toLowerCase() !== preg) return false;
        const uc = String(u.canal || '').toLowerCase();
        return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
      }).map(u => String(u.codigo_vendedor)).filter(x => x && x !== 'null');
    }
    async function puede(cod) {
      if (!cod) return false;
      if (String(perfil.codigo_vendedor) === String(cod)) return true;
      if (perfil.es_supervisor) return (await equipoCodigos()).includes(String(cod));
      return false;
    }
    async function notificar(destId, n) {
      if (!destId) return;
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: n.icono || '🔔', titulo: n.titulo, detalle: n.detalle || null, link: n.link || null }) }); } catch (e) {}
    }
    // supervisores del equipo del vendedor actual (por region+canal)
    async function supervisoresDe() {
      const rows = await (await sb('usuarios?es_supervisor=eq.true&select=id,canal,region')).json();
      const pc = String(perfil.canal || '').toLowerCase(), preg = String(perfil.region || '').toLowerCase();
      return (rows || []).filter(u => {
        if (preg && u.region && String(u.region).toLowerCase() !== preg) return false;
        const uc = String(u.canal || '').toLowerCase();
        return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
      }).map(u => u.id);
    }
    async function idDeVendedor(cod) {
      const u = (await (await sb('usuarios?codigo_vendedor=eq.' + encodeURIComponent(cod) + '&select=id&limit=1')).json())[0];
      return u ? u.id : null;
    }
    // vendedor sobre el que se opera
    const qp = event.queryStringParameters || {};
    async function vendObjetivo(bodyVend) {
      const v = String(bodyVend || qp.vendedor || perfil.codigo_vendedor || '');
      return v;
    }

    // ---------------- POST ----------------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
      const vend = await vendObjetivo(b.vendedor);

      if (b.accion === 'frecuencia') {
        if (String(perfil.codigo_vendedor) !== vend) return json(403, { error: 'Solo el vendedor categoriza sus clientes.' });
        if (!b.cliente_codigo) return json(400, { error: 'Falta el cliente.' });
        const frec = FREC.includes(b.frecuencia) ? b.frecuencia : 'mensual';
        const fila = { vendedor: vend, cliente_codigo: String(b.cliente_codigo), cliente_nombre: b.cliente_nombre || null, frecuencia: frec, updated_at: new Date().toISOString() };
        const r = await sb('agenda_frecuencia?on_conflict=vendedor,cliente_codigo', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude guardar: ' + (await r.text()).slice(0, 150) });
        return json(200, { ok: true });
      }

      if (b.accion === 'plan-dia') {
        if (String(perfil.codigo_vendedor) !== vend) return json(403, { error: 'Solo el vendedor arma su plan.' });
        if (!b.fecha) return json(400, { error: 'Falta la fecha.' });
        const mes = String(b.fecha).slice(0, 7);
        // reemplaza las asignaciones de ese día
        await sb('agenda_plan?vendedor=eq.' + encodeURIComponent(vend) + '&fecha=eq.' + encodeURIComponent(b.fecha), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        const clientes = Array.isArray(b.clientes) ? b.clientes : [];
        if (clientes.length) {
          const filas = clientes.map(c => ({ vendedor: vend, mes, fecha: b.fecha, cliente_codigo: String(c.codigo), cliente_nombre: c.nombre || null, estado: 'pendiente' }));
          const r = await sb('agenda_plan', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(filas) });
          if (!r.ok) return json(502, { error: 'No pude guardar el día: ' + (await r.text()).slice(0, 150) });
        }
        return json(200, { ok: true });
      }

      if (b.accion === 'enviar') {
        if (String(perfil.codigo_vendedor) !== vend) return json(403, { error: 'No autorizado.' });
        if (!b.mes) return json(400, { error: 'Falta el mes.' });
        const fila = { vendedor: vend, mes: b.mes, estado: 'enviada', updated_at: new Date().toISOString() };
        await sb('agenda_plan_envio?on_conflict=vendedor,mes', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(fila) });
        // avisar a los supervisores del equipo
        const sups = await supervisoresDe();
        await Promise.all(sups.map(id => notificar(id, { icono: '🗓️', titulo: (perfil.nombre || 'Un vendedor') + ' te envió su agenda mensual', detalle: 'Para revisar y aprobar · ' + b.mes, link: 'supervisor-agendas.html' })));
        return json(200, { ok: true });
      }

      if (b.accion === 'revisar') {
        if (!perfil.es_supervisor) return json(403, { error: 'Solo el supervisor aprueba.' });
        if (!(await puede(vend))) return json(403, { error: 'Ese vendedor no es de tu equipo.' });
        const est = ['aprobada', 'cambios'].includes(b.estado) ? b.estado : null;
        if (!est || !b.mes) return json(400, { error: 'Datos incompletos.' });
        const fila = { vendedor: vend, mes: b.mes, estado: est, nota_supervisor: b.nota || null, revisado_por: perfil.nombre || user.email, updated_at: new Date().toISOString() };
        await sb('agenda_plan_envio?on_conflict=vendedor,mes', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(fila) });
        // avisar al vendedor
        const vid = await idDeVendedor(vend);
        if (est === 'aprobada') await notificar(vid, { icono: '✅', titulo: (perfil.nombre || 'Tu supervisor') + ' aprobó tu agenda', detalle: 'Mes ' + b.mes, link: 'agenda-eficiente.html' });
        else await notificar(vid, { icono: '📝', titulo: (perfil.nombre || 'Tu supervisor') + ' te pidió cambios en la agenda', detalle: b.nota ? b.nota : 'Revisá tu agenda mensual', link: 'agenda-eficiente.html' });
        return json(200, { ok: true });
      }

      // Supervisor: copia una visita del vendedor a SU agenda privada (no avisa al vendedor)
      if (b.accion === 'mi-agenda-add') {
        if (!perfil.es_supervisor) return json(403, { error: 'Solo supervisores.' });
        if (!b.fecha || !b.cliente_nombre) return json(400, { error: 'Faltan datos.' });
        const fila = {
          supervisor_id: user.id, fecha: b.fecha, hora: b.hora || null,
          cliente_codigo: b.cliente_codigo || null, cliente_nombre: b.cliente_nombre || null,
          vendedor: b.vendedor || null, vendedor_nombre: b.vendedor_nombre || null, nota: b.nota || null,
        };
        const r = await sb('agenda_supervisor', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude agregar: ' + (await r.text()).slice(0, 150) });
        return json(200, { ok: true, item: (await r.json())[0] });
      }
      if (b.accion === 'mi-agenda-del' && b.id) {
        if (!perfil.es_supervisor) return json(403, { error: 'No autorizado.' });
        await sb('agenda_supervisor?id=eq.' + encodeURIComponent(b.id) + '&supervisor_id=eq.' + encodeURIComponent(user.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return json(200, { ok: true });
      }

      if (b.accion === 'marcar' || b.accion === 'desmarcar') {
        if (!b.id) return json(400, { error: 'Falta id.' });
        const cur = (await (await sb('agenda_plan?id=eq.' + encodeURIComponent(b.id) + '&select=vendedor')).json())[0];
        if (!cur || !(await puede(cur.vendedor))) return json(403, { error: 'No autorizado.' });
        const patch = b.accion === 'marcar'
          ? { estado: 'visitado', visitado_at: new Date().toISOString(), duracion_min: b.duracion_min ? Number(b.duracion_min) : null }
          : { estado: 'pendiente', visitado_at: null, duracion_min: null };
        await sb('agenda_plan?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // ---------------- GET ----------------
    const vista = qp.vista || 'plan';

    // Supervisor: estado de los planes del equipo
    if (vista === 'equipo') {
      if (!perfil.es_supervisor) return json(403, { error: 'Solo supervisores.' });
      const mes = qp.mes || new Date().toISOString().slice(0, 7);
      const codes = await equipoCodigos();
      if (!codes.length) return json(200, { equipo: [], mes });
      const nombres = {};
      (await (await sb('usuarios?codigo_vendedor=in.(' + qv(codes) + ')&select=codigo_vendedor,nombre')).json() || []).forEach(u => { nombres[String(u.codigo_vendedor)] = u.nombre; });
      const envios = await (await sb('agenda_plan_envio?vendedor=in.(' + qv(codes) + ')&mes=eq.' + mes + '&select=vendedor,estado,nota_supervisor,updated_at')).json();
      const envioDe = {}; (envios || []).forEach(e => { envioDe[String(e.vendedor)] = e; });
      const plan = await (await sb('agenda_plan?vendedor=in.(' + qv(codes) + ')&mes=eq.' + mes + '&select=vendedor,estado')).json();
      const agg = {}; codes.forEach(c => { agg[c] = { visitas: 0, visitadas: 0 }; });
      (plan || []).forEach(p => { const a = agg[String(p.vendedor)]; if (a) { a.visitas++; if (p.estado === 'visitado') a.visitadas++; } });
      const equipo = codes.map(c => ({ codigo: c, nombre: nombres[c] || c, estado: (envioDe[c] && envioDe[c].estado) || 'borrador', nota: envioDe[c] && envioDe[c].nota_supervisor, visitas: agg[c].visitas, visitadas: agg[c].visitadas }));
      return json(200, { equipo, mes });
    }

    // Agenda privada del supervisor
    if (vista === 'mi-agenda') {
      if (!perfil.es_supervisor) return json(403, { error: 'Solo supervisores.' });
      let path = 'agenda_supervisor?supervisor_id=eq.' + encodeURIComponent(user.id) + '&select=*&order=fecha.asc,hora.asc&limit=1000';
      if (qp.desde) path += '&fecha=gte.' + qp.desde;
      if (qp.hasta) path += '&fecha=lte.' + qp.hasta;
      const rows = await (await sb(path)).json();
      return json(200, { items: Array.isArray(rows) ? rows : [] });
    }

    // Clientes del vendedor + su frecuencia
    if (vista === 'clientes') {
      const vend = await vendObjetivo();
      if (!(await puede(vend))) return json(403, { error: 'No autorizado.' });
      const cli = await (await cob('cuentas_cubo?vendedor=eq.' + encodeURIComponent(vend) + '&select=codigo,nombre&order=nombre.asc&limit=2000')).json();
      const frec = await (await sb('agenda_frecuencia?vendedor=eq.' + encodeURIComponent(vend) + '&select=cliente_codigo,frecuencia')).json();
      const fmap = {}; (frec || []).forEach(f => { fmap[String(f.cliente_codigo)] = f.frecuencia; });
      const clientes = (Array.isArray(cli) ? cli : []).map(c => ({ codigo: String(c.codigo), nombre: c.nombre, frecuencia: fmap[String(c.codigo)] || null }));
      return json(200, { vendedor: vend, clientes });
    }

    // Agenda del día
    if (vista === 'dia') {
      const vend = await vendObjetivo();
      if (!(await puede(vend))) return json(403, { error: 'No autorizado.' });
      const fecha = qp.fecha || new Date().toISOString().slice(0, 10);
      const rows = await (await sb('agenda_plan?vendedor=eq.' + encodeURIComponent(vend) + '&fecha=eq.' + encodeURIComponent(fecha) + '&select=*&order=cliente_nombre.asc')).json();
      return json(200, { vendedor: vend, fecha, visitas: Array.isArray(rows) ? rows : [] });
    }

    // Plan mensual (default)
    const vend = await vendObjetivo();
    if (!(await puede(vend))) return json(403, { error: 'No autorizado.' });
    const mes = qp.mes || new Date().toISOString().slice(0, 7);
    const rows = await (await sb('agenda_plan?vendedor=eq.' + encodeURIComponent(vend) + '&mes=eq.' + mes + '&select=*&order=fecha.asc')).json();
    const envio = (await (await sb('agenda_plan_envio?vendedor=eq.' + encodeURIComponent(vend) + '&mes=eq.' + mes + '&select=estado,nota_supervisor,revisado_por,updated_at')).json())[0] || { estado: 'borrador' };
    const frec = await (await sb('agenda_frecuencia?vendedor=eq.' + encodeURIComponent(vend) + '&select=cliente_codigo,frecuencia')).json();
    return json(200, { vendedor: vend, mes, plan: Array.isArray(rows) ? rows : [], envio, frecuencias: (frec || []).length, es_propia: String(perfil.codigo_vendedor) === String(vend), puede_editar: String(perfil.codigo_vendedor) === String(vend) });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
