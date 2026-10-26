// ============================================================
//  GrandBar Hub · Function · stock  (26/10/2026)
//  El stock del depósito dentro del Portal (antes era la app aparte grandbar-stock).
//   - deposito.html: Lucas Porro (vinos) y Lucas Buenanueva (spirits), rol deposito.
//     Cuentan el stock (Depo 1 + Local + Depo 2) por proveedor y línea, lo envían y
//     marcan la agenda de los lunes.
//   - deposito-admin.html: Laura (la encargada del stock), Brenda, Diseño y Desarrollo.
//     Estado del stock de Córdoba (sincronizar / subir Excel), agenda de los lunes,
//     proveedores excluidos y conteos recibidos.
//  Tablas en el Portal sin políticas (stock-deposito-setup.sql): todo pasa por acá.
//
//  GET  ?vista=yo | stock | agenda | conteos[&sector=] | conteo&id= | estado
//  POST {accion: conteo | agenda-asignar | agenda-quitar | agenda-hecho |
//        agenda-reiniciar | excluir | subir-stock | sincronizar | mi-sector}
//
//  El conteo se guarda y a Laura y a Brenda les llega el aviso a la campanita y al celular;
//  el Excel lo bajan desde Conteos recibidos. Sin mail: decidido el 26/10/2026 (la app de
//  stock lo mandaba por Resend; con el aviso en el Portal alcanza).
//  Env: HUB_SERVICE_ROLE, SYNC_SECRET (sincronizar), VAPID_* (push)
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const { traerTodo } = require('./_paginar');
const { pushA } = require('./_notificar');

const DEPO = ['deposito'];
// Laura es la encargada del stock (26/10/2026): del equipo de administración, solo ella.
// Brenda (administración) supervisa; Diseño y Desarrollo mantienen el sistema.
const ENCARGADA = 'proveedores@grandbar.com.ar';
const ADMIN = ['administracion', 'desarrollo', 'diseno'];
const SECTORES = ['vinos', 'spirits'];
const SECTOR_LBL = { vinos: 'Vinos', spirits: 'Spirits y Gaseosas' };
// Los conteos les llegan a Laura (encargada del stock) y a Brenda (26/10/2026).
const AVISO_PARA = [ENCARGADA, 'lgonzalez@grandbar.com.ar'];
// Adónde lleva el aviso según el panel de cada uno.
const LINK_ROL = { equipo_admin: '/equipo-panel.html#stock', administracion: '/panel-cobranzas.html#stock' };

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const txt = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const ent = v => { const n = Math.round(Number(v)); return isFinite(n) ? n : 0; };
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || token === 'null' || token === 'undefined') return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const sb = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(o.headers || {}) } });
    const leer = async p => { const r = await sb(p); if (!r.ok) throw new Error(p.split('?')[0] + ': ' + (await r.text()).slice(0, 160)); return r.json(); };

    const perfil = (await leer('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,canal,activo,email'))[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();
    const esDepo = DEPO.includes(rol);
    const esAdmin = ADMIN.includes(rol) || (rol === 'equipo_admin' && String(perfil.email || user.email || '').toLowerCase() === ENCARGADA);
    if (!esDepo && !esAdmin) return json(403, { error: 'Esta sección es del depósito: la maneja Laura.' });
    // El sector de cada uno de los chicos va en usuarios.canal (vinos | spirits).
    const miSector = SECTORES.includes(String(perfil.canal || '').toLowerCase()) ? String(perfil.canal).toLowerCase() : null;
    const nombre = perfil.nombre || user.email || 'Depósito';
    const qp = event.queryStringParameters || {};

    // ════════ ESCRITURA ════════
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }
      const sector = String(b.sector || '').toLowerCase();
      const sectorOk = SECTORES.includes(sector);
      // Los chicos solo tocan su sector (si ya lo tienen definido).
      const puedeSector = s => esAdmin || !miSector || miSector === s;

      if (b.accion === 'mi-sector') {
        if (!esDepo) return json(403, { error: 'Solo para el depósito.' });
        if (miSector) return json(400, { error: 'Tu sector ya está definido. Si hay que cambiarlo, avisale a Desarrollo.' });
        if (!sectorOk) return json(400, { error: 'Elegí Vinos o Spirits.' });
        const r = await sb('usuarios?id=eq.' + encodeURIComponent(user.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ canal: sector }) });
        if (!r.ok) return json(502, { error: 'No se pudo guardar.' });
        return json(200, { ok: true, sector });
      }

      if (b.accion === 'conteo') {
        if (!sectorOk || !puedeSector(sector)) return json(403, { error: 'Ese sector no es el tuyo.' });
        const fecha = fechaOk(b.fecha) ? b.fecha : hoyAR();
        const items = (Array.isArray(b.items) ? b.items : []).slice(0, 6000).map(p => ({
          sku: txt(p.sku, 12), proveedor: txt(p.proveedor, 120), articulo: txt(p.articulo, 200),
          stock_sistema: ent(p.stock_sistema), promo: ent(p.promo),
          depo1: Math.max(0, ent(p.depo1)), local: Math.max(0, ent(p.local)), depo2: Math.max(0, ent(p.depo2)),
          obs: txt(p.obs, 300),
        })).map(p => ({ ...p, total: p.depo1 + p.local + p.depo2 }));
        if (!items.length) return json(400, { error: 'El conteo no tiene productos.' });
        const provObs = {};
        Object.entries(b.prov_obs || {}).slice(0, 300).forEach(([k, v]) => { const t = txt(v, 500); if (t) provObs[txt(k, 120)] = t; });
        const proveedores = (Array.isArray(b.proveedores) ? b.proveedores : []).slice(0, 300).map(x => txt(x, 120)).filter(Boolean);
        const lineas = (Array.isArray(b.lineas) ? b.lineas : []).slice(0, 600).map(x => txt(x, 12)).filter(Boolean);
        const contados = items.filter(p => p.total > 0 || p.obs).length;
        const unidades = items.reduce((s, p) => s + p.total, 0);
        const fila = {
          sector, usuario_id: user.id, usuario_nombre: nombre, fecha, proveedores, lineas,
          productos: items.length, contados, unidades, items, prov_obs: provObs,
        };
        const ins = await sb('stock_conteos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!ins.ok) return json(502, { error: 'No se pudo guardar el conteo: ' + (await ins.text()).slice(0, 150) });
        const guardado = (await ins.json())[0];

        // Campanita y celular a Laura y a Brenda (el Excel lo bajan desde el Portal).
        try {
          const dest = await leer('usuarios?email=in.(' + AVISO_PARA.map(m => '"' + m + '"').join(',') + ')&select=id,rol,activo');
          const titulo = 'Conteo de stock: ' + SECTOR_LBL[sector] + ' — ' + nombre;
          const detalle = contados + ' de ' + items.length + ' productos contados · ' + unidades + ' unidades · ' + fecha.split('-').reverse().join('/');
          for (const u of dest.filter(u => u.activo !== false)) {
            const link = LINK_ROL[u.rol] || '/deposito-admin.html#conteos';
            await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: u.id, icono: '📦', titulo, detalle, link }) });
            await pushA(sb, u.id, { title: '📦 ' + titulo, body: detalle, url: link, tag: 'stock-' + guardado.id });
          }
        } catch (e) { console.warn('stock: avisos', e.message); }
        return json(200, { ok: true, id: guardado.id });
      }

      if (b.accion === 'agenda-hecho') {
        const prov = txt(b.proveedor, 120);
        if (!sectorOk || !prov || !puedeSector(sector)) return json(400, { error: 'Faltan datos.' });
        await sb('stock_agenda?sector=eq.' + sector + '&proveedor=eq.' + encodeURIComponent(prov), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        if (b.hecho) {
          const r = await sb('stock_agenda', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ fecha: hoyAR(), sector, proveedor: prov, done: true }) });
          if (!r.ok) return json(502, { error: 'No se pudo marcar.' });
        }
        return json(200, { ok: true });
      }

      if (b.accion === 'agenda-reiniciar') {
        if (!sectorOk || !puedeSector(sector)) return json(400, { error: 'Falta el sector.' });
        const r = await sb('stock_ciclos?on_conflict=sector', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ sector, desde: hoyAR(), por: nombre, updated_at: new Date().toISOString() }) });
        if (!r.ok) return json(502, { error: 'No se pudo reiniciar.' });
        return json(200, { ok: true, desde: hoyAR() });
      }

      // ── De acá en adelante, solo administración ──
      if (!esAdmin) return json(403, { error: 'Eso lo hace administración.' });

      if (b.accion === 'agenda-asignar') {
        const prov = txt(b.proveedor, 120);
        if (!sectorOk || !prov || !fechaOk(b.fecha)) return json(400, { error: 'Faltan datos.' });
        // Un proveedor está una sola vez por sector: si estaba en otro lunes, se mueve.
        await sb('stock_agenda?sector=eq.' + sector + '&proveedor=eq.' + encodeURIComponent(prov), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        const r = await sb('stock_agenda', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ fecha: b.fecha, sector, proveedor: prov, done: false }) });
        if (!r.ok) return json(502, { error: 'No se pudo guardar.' });
        return json(200, { ok: true });
      }
      if (b.accion === 'agenda-quitar') {
        const prov = txt(b.proveedor, 120);
        if (!sectorOk || !prov) return json(400, { error: 'Faltan datos.' });
        await sb('stock_agenda?sector=eq.' + sector + '&proveedor=eq.' + encodeURIComponent(prov), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return json(200, { ok: true });
      }
      if (b.accion === 'excluir') {
        const prov = txt(b.proveedor, 120);
        if (!sectorOk || !prov) return json(400, { error: 'Faltan datos.' });
        const r = b.excluido
          ? await sb('stock_proveedores_excluidos?on_conflict=sector,proveedor', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ sector, proveedor: prov }) })
          : await sb('stock_proveedores_excluidos?sector=eq.' + sector + '&proveedor=eq.' + encodeURIComponent(prov), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        if (!r.ok) return json(502, { error: 'No se pudo guardar.' });
        return json(200, { ok: true });
      }
      if (b.accion === 'subir-stock') {
        // El Listado de Stock Básico de Córdoba, leído en el navegador: [{sku, stock}].
        const filas = (Array.isArray(b.filas) ? b.filas : []).slice(0, 20000)
          .filter(f => /^\d{8}$/.test(String(f.sku || ''))).map(f => ({ sku: String(f.sku), stock: ent(f.stock), actualizado_en: new Date().toISOString() }));
        if (!filas.length) return json(400, { error: 'El archivo no trae SKUs válidos.' });
        for (let i = 0; i < filas.length; i += 500) {
          const r = await sb('stock_sistema?on_conflict=sku', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(filas.slice(i, i + 500)) });
          if (!r.ok) return json(502, { error: 'Se cortó en el lote ' + (i / 500 + 1) + ': ' + (await r.text()).slice(0, 150) });
        }
        return json(200, { ok: true, guardados: filas.length });
      }
      if (b.accion === 'sincronizar') {
        const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://portalgrandbar.com';
        const sec = process.env.SYNC_SECRET || '';
        const r = await fetch(base + '/.netlify/functions/stock-sync-background?origen=' + encodeURIComponent('admin') + (sec ? '&key=' + encodeURIComponent(sec) : ''), { method: 'POST' });
        if (!(r.status === 202 || r.ok)) return json(502, { error: 'No se pudo lanzar la sincronización (' + r.status + ').' });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida.' });
    }

    // ════════ LECTURA ════════
    const vista = qp.vista || 'yo';
    if (vista === 'yo') return json(200, { nombre, rol, sector: miSector, esAdmin, esDepo });

    if (vista === 'stock') {
      // Solo los que tienen stock ≠ 0: el resto es 0. 'filas' dice si alguna vez se cargó.
      const [con, cuenta] = await Promise.all([
        traerTodo(sb, 'stock_sistema?select=sku,stock&stock=neq.0&order=sku'),
        sb('stock_sistema?select=sku', { headers: { Prefer: 'count=exact', Range: '0-0' } }),
        ]);
      const filas = Number((cuenta.headers.get('content-range') || '*/0').split('/')[1]) || 0;
      const ult = (await leer('stock_sistema?select=actualizado_en&order=actualizado_en.desc&limit=1'))[0];
      const stock = {}; con.forEach(r => { stock[r.sku] = r.stock; });
      return json(200, { stock, filas, actualizado: ult ? ult.actualizado_en : null });
    }

    if (vista === 'agenda') {
      const [registro, excluidos, ciclos] = await Promise.all([
        traerTodo(sb, 'stock_agenda?select=fecha,sector,proveedor,done&order=fecha.desc'),
        leer('stock_proveedores_excluidos?select=sector,proveedor&order=proveedor'),
        leer('stock_ciclos?select=sector,desde,por'),
      ]);
      return json(200, { registro, excluidos, ciclos, hoy: hoyAR() });
    }

    if (vista === 'conteos') {
      let q = 'stock_conteos?select=id,sector,usuario_nombre,fecha,proveedores,productos,contados,unidades,created_at&order=created_at.desc&limit=200';
      const s = String(qp.sector || '').toLowerCase();
      if (esDepo && !esAdmin && miSector) q += '&sector=eq.' + miSector;
      else if (SECTORES.includes(s)) q += '&sector=eq.' + s;
      return json(200, { conteos: await leer(q) });
    }

    if (vista === 'conteo') {
      const id = parseInt(qp.id, 10);
      if (!id) return json(400, { error: 'Falta el conteo.' });
      const c = (await leer('stock_conteos?id=eq.' + id + '&select=*'))[0];
      if (!c) return json(404, { error: 'No existe ese conteo.' });
      if (esDepo && !esAdmin && miSector && c.sector !== miSector) return json(403, { error: 'Ese conteo no es de tu sector.' });
      return json(200, { conteo: c });
    }

    if (vista === 'estado') {
      if (!esAdmin) return json(403, { error: 'Solo administración.' });
      const cuenta = async filtro => { const r = await sb('stock_sistema?select=sku' + filtro, { headers: { Prefer: 'count=exact', Range: '0-0' } }); return Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0; };
      const [filas, conStock, ult, corridas] = await Promise.all([
        cuenta(''), cuenta('&stock=gt.0'),
        leer('stock_sistema?select=actualizado_en&order=actualizado_en.desc&limit=1'),
        leer('sistema_corridas?tarea=eq.stock-sync&select=inicio,fin,ok,detalle&order=inicio.desc&limit=5'),
      ]);
      return json(200, { filas, conStock, actualizado: ult[0] ? ult[0].actualizado_en : null, corridas });
    }
    return json(400, { error: 'Vista inválida.' });
  } catch (e) {
    return json(500, { error: 'No se pudo completar: ' + String((e && e.message) || e).slice(0, 200) });
  }
};

module.exports.handler = require('./_errores').conErrores('stock', module.exports.handler);
