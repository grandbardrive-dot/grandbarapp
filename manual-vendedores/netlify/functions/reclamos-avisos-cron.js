// ============================================================
//  GrandBar Hub · Function PROGRAMADA · reclamos-avisos-cron
//  Corre cada 10 minutos (ver netlify.toml). Avisa a la administración de cada
//  zona cuando un cliente de esa zona abre un reclamo en el Portal del Cliente o
//  escribe en uno que ya tenía (19/10/2026: "que los reclamos de los clientes de
//  San Luis le lleguen a Romina").
//
//  Le llega a cada usuario de tesorería o administración que tenga región en su
//  perfil (Romina: san_luis), por dos lados:
//    - la campanita del Hub (tabla notificaciones), que lleva a Cobranzas › Reclamos;
//    - el aviso al celular o la compu, si lo activó (push, igual que la agenda).
//  Quien no tiene región (Mónica, Brenda) no recibe nada nuevo: a Brenda le sigue
//  llegando el WhatsApp que manda el Portal del Cliente con cada reclamo.
//
//  No repite: cada aviso lleva una referencia (reclamo:<id> o reclamo-msg:<id>) y la
//  tabla no deja guardar dos veces la misma para la misma persona. Mira las últimas
//  24 horas, así una corrida que falle no hace perder avisos.
//  Env: HUB_SERVICE_ROLE, COBRANZAS_SERVICE_ROLE, VAPID_* (push)
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const { traerTodo } = require('./_paginar');
const { zonaDe, armarZona } = require('./_zona-cobranzas');
const { sendPush } = require('./_webpush');

const VENTANA_HORAS = 24;
const LINK = '/panel-cobranzas.html#reclamos';
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const corto = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const qids = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

exports.handler = async () => {
  const hubKey = process.env.HUB_SERVICE_ROLE, cobKey = process.env.COBRANZAS_SERVICE_ROLE;
  if (!hubKey || !cobKey) return json(500, { error: 'Falta HUB_SERVICE_ROLE o COBRANZAS_SERVICE_ROLE.' });
  const hub = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: hubKey, Authorization: 'Bearer ' + hubKey, 'Content-Type': 'application/json', ...(o.headers || {}) } });
  const cob = (p, o = {}) => fetch(COB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: cobKey, Authorization: 'Bearer ' + cobKey, 'Content-Type': 'application/json', ...(o.headers || {}) } });
  const leer = async p => { const r = await cob(p); if (!r.ok) throw new Error(p.split('?')[0] + ' ' + r.status + ' ' + (await r.text()).slice(0, 150)); return r.json(); };

  // ── Quiénes reciben: tesorería o administración CON región ──
  const ur = await hub('usuarios?rol=in.(tesoreria,administracion)&region=not.is.null&or=(activo.is.null,activo.eq.true)&select=id,nombre,region');
  const usuarios = ur.ok ? await ur.json() : [];
  if (!ur.ok) throw new Error('usuarios ' + ur.status);
  const porZona = {};
  usuarios.forEach(u => { const z = zonaDe(u); if (z) (porZona[z] = porZona[z] || []).push(u); });
  if (!Object.keys(porZona).length) return json(200, { ok: true, destinatarios: 0 });

  // ── Lo nuevo de las últimas 24 horas ──
  const desde = new Date(Date.now() - VENTANA_HORAS * 3600000).toISOString();
  const nuevos = await leer('reclamos?created_at=gte.' + desde + '&select=id,nro,asunto,codigo,cliente_id,created_at,cliente:clientes(comercio,nombre)&order=created_at.asc');
  const msgs = await leer('reclamos_mensajes?autor=eq.cliente&created_at=gte.' + desde + '&select=id,reclamo_id,texto,archivo_url,created_at&order=created_at.asc');
  // Reclamos de esos mensajes (pueden ser viejos).
  const idsRec = [...new Set(msgs.map(m => m.reclamo_id).filter(Boolean))];
  const deMsgs = idsRec.length
    ? await leer('reclamos?id=in.(' + qids(idsRec) + ')&select=id,nro,asunto,codigo,cliente_id,created_at,cliente:clientes(comercio,nombre)')
    : [];
  const recPorId = {}; [...nuevos, ...deMsgs].forEach(r => { recPorId[r.id] = r; });
  const quien = r => (r && r.cliente && (r.cliente.comercio || r.cliente.nombre)) || (r && r.codigo ? 'Cliente ' + r.codigo : 'Un cliente');
  const caso = r => (r && r.nro ? ' #' + r.nro : '');

  // Un aviso por reclamo nuevo; y por cada reclamo con mensajes nuevos del cliente, uno por
  // el último. El primer mensaje que se guarda junto con el reclamo no cuenta como respuesta.
  const eventos = nuevos.map(r => ({
    fila: r, ref: 'reclamo:' + r.id, icono: '💬',
    titulo: 'Reclamo nuevo' + caso(r) + ' · ' + corto(quien(r), 60),
    detalle: corto(r.asunto || 'Sin asunto', 140),
  }));
  const ultimo = {};
  msgs.forEach(m => {
    const r = recPorId[m.reclamo_id]; if (!r) return;
    if (Math.abs(new Date(m.created_at) - new Date(r.created_at)) < 5 * 60000) return;
    ultimo[m.reclamo_id] = m;
  });
  Object.values(ultimo).forEach(m => {
    const r = recPorId[m.reclamo_id];
    eventos.push({
      fila: r, ref: 'reclamo-msg:' + m.id, icono: '💬',
      titulo: 'Respondió en el reclamo' + caso(r) + ' · ' + corto(quien(r), 60),
      detalle: m.texto ? corto(m.texto, 140) : (m.archivo_url ? 'Mandó un archivo.' : ''),
    });
  });
  if (!eventos.length) return json(200, { ok: true, eventos: 0 });

  // ── A cada zona, lo suyo ──
  const subsDe = {};
  const enviarPush = async (uid, payload) => {
    if (!process.env.VAPID_PRIVATE) return 0;
    if (!subsDe[uid]) { const r = await hub('push_subscriptions?usuario_id=eq.' + encodeURIComponent(uid) + '&select=endpoint,p256dh,auth'); subsDe[uid] = r.ok ? await r.json() : []; }
    let ok = 0;
    for (const s of subsDe[uid]) {
      try {
        const r = await sendPush(s, payload);
        if (r.status >= 200 && r.status < 300) ok++;
        else if (r.gone) await hub('push_subscriptions?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      } catch (e) { /* un celular que no contesta no frena al resto */ }
    }
    return ok;
  };

  const informe = {};
  for (const [zona, users] of Object.entries(porZona)) {
    const Z = await armarZona(zona, p => traerTodo(cob, p));
    const deZona = eventos.filter(e => Z.filaOk(e.fila));
    informe[zona] = { eventos: deZona.length, avisos: 0, push: 0 };
    if (!deZona.length) continue;
    for (const u of users) {
      const filas = deZona.map(e => ({ destinatario_id: u.id, icono: e.icono, titulo: e.titulo, detalle: e.detalle, link: LINK, ref: e.ref }));
      // ignore-duplicates: lo que ya se avisó no se vuelve a guardar y no vuelve en la respuesta.
      const r = await hub('notificaciones?on_conflict=destinatario_id,ref', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(filas) });
      if (!r.ok) throw new Error('notificaciones ' + r.status + ' ' + (await r.text()).slice(0, 150));
      const nuevas = await r.json();
      informe[zona].avisos += nuevas.length;
      for (const n of nuevas) {
        informe[zona].push += await enviarPush(u.id, { title: n.titulo, body: n.detalle || '', url: LINK, tag: n.ref });
      }
    }
  }
  console.log('reclamos-avisos', JSON.stringify(informe));
  return json(200, { ok: true, informe });
};

// Estado del sistema: cada corrida queda en sistema_corridas (ver _corrida.js).
exports.handler = require('./_corrida').conRegistro('reclamos-avisos', exports.handler);
