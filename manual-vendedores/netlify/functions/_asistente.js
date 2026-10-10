// ============================================================
//  Helper compartido de "Mi asistente" (lo usan asistente y
//  asistente-background). El "_" evita que Netlify lo publique.
//
//  Las tablas asistente_* están cerradas (RLS sin reglas): se leen y
//  escriben acá con la llave de servicio, siempre filtrando por la
//  dueña, que sale de su token y nunca de lo que mande el navegador.
//  Env: HUB_SERVICE_ROLE
// ============================================================

const crypto = require('crypto');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';

// Quién conversa con su asistente: Brenda (administración). Diseño y Desarrollo
// también, para probarlo: cada uno habla con el suyo y ve solo lo suyo.
const ROLES_CHAT     = ['administracion', 'desarrollo', 'diseno'];
// Quién ve lo que aprendió cada asistente y lo que todavía no puede hacer.
const ROLES_REVISION = ['desarrollo', 'diseno'];

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });

const sb = (path, opts = {}) => {
  const srole = process.env.HUB_SERVICE_ROLE;
  return fetch(HUB_URL + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
};
const leer = async (path) => { const r = await sb(path); const j = await r.json().catch(() => []); return Array.isArray(j) ? j : []; };

// Quién pregunta, con su token del Portal. null si no hay sesión válida.
async function quienEs(event) {
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
  if (!uRes.ok) return null;
  const user = await uRes.json();
  const perfil = (await leer('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,activo'))[0] || {};
  return {
    token, id: String(user.id), email: user.email,
    nombre: perfil.nombre || user.email,
    rol: String(perfil.rol || '').toLowerCase(),
    activo: perfil.activo !== false,
  };
}

// ── Lo que aprendió ─────────────────────────────────────────
async function leccionesDe(usuarioId) {
  return leer('asistente_lecciones?usuario_id=eq.' + encodeURIComponent(usuarioId)
    + '&activa=eq.true&select=id,texto,origen,created_at,updated_at&order=created_at.asc');
}
// Cambia cada vez que se agrega, corrige o borra una lección: así cada charla
// sabe si tiene que recibir la lista nueva.
const hashLecciones = (ls) => crypto.createHash('sha1')
  .update(ls.map(l => l.id + ':' + l.texto).join('\n')).digest('hex').slice(0, 16);

// Fecha de hoy en Argentina (la del servidor es UTC).
function hoyAR() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // AAAA-MM-DD
}
function hoyLargoAR() {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

// La nota que recibe el asistente cuando arranca una charla, cambia el día o
// cambian las lecciones. Va como mensaje de sistema en medio de la charla
// (no se toca el system de arriba ni nada de lo ya dicho).
function notaDeSistema(nombre, lecciones, { avisarFecha, avisarLecciones }) {
  const partes = ['Quien te habla es ' + nombre + ' (así figura en el Portal; si no sabés cómo prefiere que le digas, preguntale).'];
  if (avisarFecha) partes.push('Hoy es ' + hoyLargoAR() + '.');
  if (avisarLecciones) {
    partes.push(lecciones.length
      ? 'Esto es lo que ' + nombre + ' te enseñó hasta ahora. Esta lista reemplaza a cualquier lista anterior de esta conversación:\n'
        + lecciones.map((l, i) => (i + 1) + '. ' + l.texto).join('\n')
      : nombre + ' todavía no te enseñó nada (la lista de lo que aprendiste está vacía).');
  }
  return partes.join('\n\n');
}

// ── Lo que ve la pantalla ───────────────────────────────────
// Del historial completo (con pensamiento, consultas y resultados) se arma
// solo lo que tiene que ver la persona.
const NOMBRES_CONSULTA = {
  tareas_del_equipo: 'Miró las tareas del equipo',
  agenda_del_equipo: 'Miró la agenda del equipo',
  mi_agenda: 'Miró tu agenda',
  mis_reportes: 'Miró tus reportes',
  cartera_resumen: 'Miró el resumen de la cartera',
  buscar_cuentas: 'Buscó cuentas de clientes',
  ficha_de_cliente: 'Miró la ficha de un cliente',
  clientes_pasados_de_tope: 'Miró los clientes pasados de tope',
  cobros_en_efectivo: 'Miró los cobros en efectivo',
  reclamos: 'Miró los reclamos',
  circuito_de_comprobantes: 'Miró el circuito de comprobantes',
  whatsapp_clientes: 'Miró los mensajes de WhatsApp de clientes',
};

function vistaDe(charla) {
  const out = [];
  const props = charla.propuestas || {};
  const empujarTexto = (de, texto) => {
    if (!texto || !String(texto).trim()) return;
    const ult = out[out.length - 1];
    if (ult && ult.de === de && de === 'asistente') ult.texto += '\n\n' + texto;
    else out.push({ de, texto: String(texto) });
  };
  for (const m of charla.mensajes || []) {
    if (m.role === 'user') {
      if (typeof m.content === 'string') empujarTexto('yo', m.content);
      else (m.content || []).forEach(b => { if (b.type === 'text') empujarTexto('yo', b.text); });
    } else if (m.role === 'assistant') {
      for (const b of (Array.isArray(m.content) ? m.content : [])) {
        if (b.type === 'text') empujarTexto('asistente', b.text);
        else if (b.type === 'tool_use') {
          const inp = b.input || {};
          if (b.name === 'proponer_leccion') {
            const p = props[b.id] || {};
            out.push({ de: 'propuesta', id: b.id, texto: p.texto || inp.texto || '', estado: p.estado || 'pendiente' });
          } else if (b.name === 'anotar_lo_que_no_puedo') {
            out.push({ de: 'nota', texto: 'Lo anoté en "Lo que todavía no puedo hacer": ' + (inp.pedido || '') });
          } else {
            const t = NOMBRES_CONSULTA[b.name];
            const ult = out[out.length - 1];
            if (t && !(ult && ult.de === 'consulta' && ult.texto === t)) out.push({ de: 'consulta', texto: t });
          }
        }
      }
    }
  }
  return out;
}

const resumenCharla = c => ({ id: c.id, titulo: c.titulo, estado: c.estado, updated_at: c.updated_at, created_at: c.created_at });

module.exports = {
  HUB_URL, HUB_ANON, ROLES_CHAT, ROLES_REVISION,
  json, sb, leer, quienEs, leccionesDe, hashLecciones, hoyAR, notaDeSistema, vistaDe, resumenCharla,
};
