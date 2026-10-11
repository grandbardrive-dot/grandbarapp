// ============================================================
//  GrandBar Hub · Function · torneo-evidencias
//   Evidencias del Torneo Doña Paula (29/09/2026).
//   - Los vendedores (rol ventas, supervisores incluidos) cargan una evidencia:
//     línea, acción, cliente, fecha de activación y fotos.
//   - Juan Pablo Sepúlveda (rol "torneo") las revisa: acepta o rechaza, y baja
//     la lista para cargar los puntos a mano. Los puntos NO se calculan acá.
//   Todo pasa por esta función: la tabla `torneo_evidencias` y la carpeta
//   privada `torneo-evidencias` no se leen desde el navegador (RLS sin reglas).
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const BUCKET = 'torneo-evidencias';
const VALIDAN = ['torneo', 'desarrollo', 'diseno'];   // Juan Pablo y quienes mantienen el sistema
const ESTADOS = ['pendiente', 'aceptada', 'rechazada'];
const MAX_FOTOS = 2, MAX_BYTES = 3 * 1024 * 1024;
// Un video corto por evidencia (29/09). Es pesado para pasar por la función:
// el celular lo sube directo a la carpeta con un permiso de un solo uso.
const MAX_VIDEO = 50 * 1024 * 1024;
const VIDEO_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp' };

const { LINEAS, accionesPara, ligaDe } = require('./_torneo-estructura');
const { regionDe } = require('./_equipo');
const { traerTodo } = require('./_paginar');
const { pushA } = require('./_notificar');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const cab = (extra) => Object.assign({ apikey: srole, Authorization: 'Bearer ' + srole }, extra || {});
    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: cab({ 'Content-Type': 'application/json', ...(opts.headers || {}) }) });
    const st = (path, opts = {}) => fetch(HUB_URL + '/storage/v1/' + path, { ...opts, headers: cab(opts.headers) });

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,email,rol,canal,region,codigo_vendedor,activo')).json())[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();
    const valida = VALIDAN.includes(rol);
    const vende = rol === 'ventas';

    // Links temporales (1 hora) para ver las fotos: la carpeta es privada.
    async function conFotos(filas) {
      const paths = [].concat(...filas.map(f => (f.fotos || []).concat(f.video ? [f.video] : [])));
      const url = {};
      if (paths.length) {
        const r = await st('object/sign/' + BUCKET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600, paths }) });
        const lista = r.ok ? await r.json() : [];
        (Array.isArray(lista) ? lista : []).forEach(x => { if (x && x.signedURL) url[x.path] = HUB_URL + '/storage/v1' + x.signedURL; });
      }
      return filas.map(f => ({ ...f, fotos_url: (f.fotos || []).map(p => url[p]).filter(Boolean), video_url: f.video ? (url[f.video] || null) : null }));
    }
    async function notificar(destId, n) {
      if (!destId) return;
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: n.icono, titulo: n.titulo, detalle: n.detalle || null, link: n.link || null }) }); } catch (e) {}
      try { await pushA(sb, destId, { title: n.icono + ' ' + n.titulo, body: n.detalle || '', url: '/' + (n.link || '') }); } catch (e) {}
    }
    async function contar(estado) {
      const r = await sb('torneo_evidencias?select=id&estado=eq.' + estado, { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0' } });
      const cr = r.headers.get('content-range') || '';
      return Number(cr.split('/')[1]) || 0;
    }

    // ---------------- GET ----------------
    if (event.httpMethod === 'GET') {
      const qp = event.queryStringParameters || {};

      if (qp.vista === 'estructura') {
        if (!vende && !valida) return json(403, { error: 'No autorizado.' });
        return json(200, { lineas: LINEAS, grupos: accionesPara(perfil.canal) });
      }

      if (qp.vista === 'mias') {
        if (!vende) return json(403, { error: 'Solo para vendedores.' });
        const r = await sb('torneo_evidencias?usuario_id=eq.' + encodeURIComponent(user.id) + '&select=*&order=created_at.desc&limit=300');
        if (!r.ok) return json(502, { error: 'No se pudieron leer las evidencias.' });   // p. ej. falta crear la tabla
        const filas = await r.json();
        return json(200, { evidencias: await conFotos(Array.isArray(filas) ? filas : []) });
      }

      if (qp.vista === 'revisar' || qp.vista === 'csv') {
        if (!valida) return json(403, { error: 'Solo para quien valida el torneo.' });
        let q = 'torneo_evidencias?select=*&order=created_at.desc';
        if (ESTADOS.includes(qp.estado)) q += '&estado=eq.' + qp.estado;
        if (qp.vista === 'csv') {
          const filas = await traerTodo(sb, q);
          const col = ['Fecha de activación', 'Vendedor', 'Código', 'Sucursal', 'Liga', 'Línea', 'Acción', 'Cliente', 'Código cliente', 'Estado', 'Revisada por', 'Revisada el', 'Motivo', 'Cargada el', 'Nota del vendedor', 'Fotos', 'Video'];
          const celda = v => { const s = String(v == null ? '' : v).replace(/\r?\n/g, ' '); return /[";]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
          const fecha = v => v ? new Date(v).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '';
          const lineas = filas.map(f => [f.fecha_activacion, f.vendedor_nombre, f.vendedor_codigo, f.sucursal, f.liga, f.linea, f.accion, f.cliente_nombre, f.cliente_codigo, f.estado, f.revisado_por, fecha(f.revisado_at), f.motivo, fecha(f.created_at), f.nota, (f.fotos || []).length, f.video ? 'Sí' : 'No'].map(celda).join(';'));
          return { statusCode: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' }, body: '﻿' + [col.join(';')].concat(lineas).join('\r\n') };
        }
        const rl = await sb(q + '&limit=300');
        if (!rl.ok) return json(502, { error: 'No se pudieron leer las evidencias. ¿Ya se corrió torneo-evidencias-setup.sql?' });
        const filas = await rl.json();
        const [pendiente, aceptada, rechazada] = await Promise.all(ESTADOS.map(contar));
        return json(200, { evidencias: await conFotos(Array.isArray(filas) ? filas : []), totales: { pendiente, aceptada, rechazada }, validador: perfil.nombre || '' });
      }
      return json(400, { error: 'Vista desconocida.' });
    }

    // ---------------- POST ----------------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }

      if (b.accion === 'permiso_video') {
        // Permiso de un solo uso para subir el video directo a la carpeta privada.
        if (!vende) return json(403, { error: 'Solo los vendedores cargan evidencias.' });
        const ext = VIDEO_EXT[String(b.tipo || '').toLowerCase()];
        if (!ext) return json(400, { error: 'Ese formato de video no se acepta. Grabalo con la cámara del celular.' });
        if (!(Number(b.tamano) > 0) || Number(b.tamano) > MAX_VIDEO) return json(400, { error: 'El video pesa más de 50 MB. Grabá uno más corto.' });
        const path = user.id + '/' + Date.now() + '-v.' + ext;
        const r = await st('object/upload/sign/' + BUCKET + '/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const d = r.ok ? await r.json() : {};
        if (!d.url) return json(502, { error: 'No se pudo preparar la subida del video.' });
        return json(200, { path, url: HUB_URL + '/storage/v1' + d.url });
      }

      if (b.accion === 'crear') {
        if (!vende) return json(403, { error: 'Solo los vendedores cargan evidencias.' });
        const linea = texto(b.linea, 60), accion = texto(b.accion_torneo, 80);
        if (!LINEAS.includes(linea)) return json(400, { error: 'Elegí la línea.' });
        if (!accionesPara(perfil.canal).some(g => g.acciones.includes(accion))) return json(400, { error: 'Elegí la acción.' });
        const cliente = texto(b.cliente_nombre, 120);
        if (!cliente) return json(400, { error: 'Poné el cliente (el punto de venta).' });
        const fecha = texto(b.fecha_activacion, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyAR()) return json(400, { error: 'La fecha de activación no es válida.' });
        const fotos = Array.isArray(b.fotos) ? b.fotos.slice(0, MAX_FOTOS) : [];
        // El video ya está subido: se confirma que sea de este vendedor y que exista.
        let video = null;
        if (b.video) {
          const vp = String(b.video);
          const pre = user.id + '/';
          if (vp.indexOf(pre) !== 0 || !/^\d+-v\.(mp4|mov|webm|3gp)$/.test(vp.slice(pre.length))) return json(400, { error: 'El video no es válido.' });
          const nom = vp.slice(pre.length);
          const lr = await st('object/list/' + BUCKET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: user.id, search: nom, limit: 5 }) });
          const obj = (lr.ok ? await lr.json() : []).find(o => o && o.name === nom);
          if (!obj) return json(400, { error: 'El video no terminó de subir. Probá de nuevo.' });
          video = vp;
        }
        if (!fotos.length && !video) return json(400, { error: 'Sumá al menos una foto o el video.' });
        const borrarVideo = () => video ? st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [video] }) }).catch(() => {}) : null;

        const subidas = [];
        for (let i = 0; i < fotos.length; i++) {
          const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(fotos[i] || ''));
          if (!m) return json(400, { error: 'Una de las fotos no es una imagen.' });
          const buf = Buffer.from(m[2], 'base64');
          if (!buf.length || buf.length > MAX_BYTES) return json(400, { error: 'Una de las fotos es demasiado pesada.' });
          const path = user.id + '/' + Date.now() + '-' + i + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
          const up = await st('object/' + BUCKET + '/' + path, { method: 'POST', headers: { 'Content-Type': 'image/' + m[1], 'x-upsert': 'false' }, body: buf });
          if (!up.ok) {
            if (subidas.length) await st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: subidas }) }).catch(() => {});
            await borrarVideo();
            return json(502, { error: 'No se pudo guardar la foto. Probá de nuevo.' });
          }
          subidas.push(path);
        }
        const reg = regionDe(perfil);
        const fila = {
          usuario_id: user.id, vendedor_codigo: perfil.codigo_vendedor || null, vendedor_nombre: perfil.nombre || perfil.email || null,
          sucursal: reg === 'san_luis' ? 'San Luis' : 'Mendoza', liga: ligaDe(accion, perfil.canal),
          linea, accion, cliente_codigo: texto(b.cliente_codigo, 20) || null, cliente_nombre: cliente,
          fecha_activacion: fecha, fotos: subidas, nota: texto(b.nota, 500) || null, estado: 'pendiente',
        };
        if (video) fila.video = video;
        const r = await sb('torneo_evidencias', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) {
          if (subidas.length) await st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: subidas }) }).catch(() => {});
          await borrarVideo();
          return json(502, { error: 'No se pudo guardar la evidencia.' });
        }
        return json(200, { ok: true, evidencia: (await r.json())[0] });
      }

      if (b.accion === 'borrar') {
        // El vendedor puede sacar una evidencia suya mientras nadie la revisó.
        if (!vende) return json(403, { error: 'No autorizado.' });
        const f = (await (await sb('torneo_evidencias?id=eq.' + encodeURIComponent(b.id) + '&usuario_id=eq.' + encodeURIComponent(user.id) + '&select=*')).json())[0];
        if (!f) return json(404, { error: 'No encontré la evidencia.' });
        if (f.estado !== 'pendiente') return json(409, { error: 'Ya fue revisada: no se puede borrar.' });
        await sb('torneo_evidencias?id=eq.' + encodeURIComponent(f.id), { method: 'DELETE' });
        const archivos = (f.fotos || []).concat(f.video ? [f.video] : []);
        if (archivos.length) await st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: archivos }) }).catch(() => {});
        return json(200, { ok: true });
      }

      if (b.accion === 'revisar') {
        if (!valida) return json(403, { error: 'Solo para quien valida el torneo.' });
        if (!ESTADOS.includes(b.estado)) return json(400, { error: 'Estado inválido.' });
        const motivo = texto(b.motivo, 500);
        if (b.estado === 'rechazada' && !motivo) return json(400, { error: 'Escribí por qué la rechazás: se lo avisamos al vendedor.' });
        const pend = b.estado === 'pendiente';
        const cambios = { estado: b.estado, motivo: pend ? null : (motivo || null), revisado_por: pend ? null : (perfil.nombre || perfil.email || 'Validación'), revisado_at: pend ? null : new Date().toISOString() };
        const r = await sb('torneo_evidencias?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(cambios) });
        const f = r.ok ? (await r.json())[0] : null;
        if (!f) return json(404, { error: 'No encontré la evidencia.' });
        if (!pend) {
          const ok = b.estado === 'aceptada';
          await notificar(f.usuario_id, {
            icono: ok ? '✅' : '❌',
            titulo: ok ? 'Aceptaron tu evidencia del torneo' : 'Rechazaron tu evidencia del torneo',
            detalle: f.accion + ' · ' + f.linea + ' · ' + f.cliente_nombre + (ok ? '' : ' — ' + motivo),
            link: 'torneo-vendedor.html#evidencias',
          });
        }
        return json(200, { ok: true, evidencia: (await conFotos([f]))[0] });
      }
      return json(400, { error: 'Acción desconocida.' });
    }
    return json(405, { error: 'Método no permitido' });
  } catch (e) {
    return json(500, { error: 'Error: ' + (e.message || e) });
  }
};

// Estado del sistema (11/10/2026): los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('torneo-evidencias', module.exports.handler);
