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
//  El conteo se guarda siempre. El mail (con el Excel adjunto) sale por Resend a Laura
//  y a Brenda, y a las dos les llega el aviso a la campanita (26/10/2026: antes eran 5).
//  Env: HUB_SERVICE_ROLE, RESEND_API_KEY (mail), SYNC_SECRET (sincronizar), VAPID_* (push)
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
// Los mismos que tenía la app de stock.
const MAIL_DE = 'Stock GrandBar <stock@grandbar.com.ar>';
// Los conteos les llegan a Laura (encargada del stock) y a Brenda (26/10/2026).
const MAIL_PARA = [ENCARGADA, 'lgonzalez@grandbar.com.ar'];
// Adónde lleva el aviso según el panel de cada uno.
const LINK_ROL = { equipo_admin: '/equipo-panel.html#stock', administracion: '/panel-cobranzas.html#stock' };

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const txt = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const ent = v => { const n = Math.round(Number(v)); return isFinite(n) ? n : 0; };
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));

exports.handler = async (event) => {
  try {
    // Control del mail (provisorio, 26/10): dice si las funciones ven la clave y qué variables
    // parecidas hay. Solo nombres, nunca valores. Sacarlo cuando el mail salga.
    if ((event.queryStringParameters || {}).vista === 'mail-check') {
      const nombres = Object.keys(process.env).filter(k => /resend|mail.*key/i.test(k));
      return json(200, { mail: !!process.env.RESEND_API_KEY, variables: nombres.map(k => JSON.stringify(k)) });
    }
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

        // Mail con el Excel (lo arma el navegador) — igual que la app de stock.
        let mailOk = false, mailError = null;
        const key = process.env.RESEND_API_KEY;
        if (!key) mailError = 'El Portal todavía no tiene la clave de mail (RESEND_API_KEY).';
        else {
          const payload = { from: MAIL_DE, to: MAIL_PARA, subject: '[Stock Grand Bar] ' + SECTOR_LBL[sector] + ' — ' + fecha, html: htmlMail(fila, provObs) };
          const b64 = String(b.excel_base64 || '');
          if (b64 && b64.length < 7e6 && /^[A-Za-z0-9+/=]+$/.test(b64)) payload.attachments = [{ filename: 'stock_' + sector + '_' + fecha + '.xlsx', content: b64 }];
          try {
            const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const d = await r.json().catch(() => ({}));
            mailOk = r.ok; if (!r.ok) mailError = d.message || ('Resend respondió ' + r.status);
          } catch (e) { mailError = 'No se pudo conectar con el servicio de mail.'; }
        }
        await sb('stock_conteos?id=eq.' + guardado.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ mail_ok: mailOk, mail_error: mailError }) });

        // Campanita (y celular) a los que reciben el mail y tienen usuario en el Portal.
        try {
          const dest = await leer('usuarios?email=in.(' + MAIL_PARA.map(m => '"' + m + '"').join(',') + ')&select=id,rol,activo');
          const titulo = 'Conteo de stock: ' + SECTOR_LBL[sector] + ' — ' + nombre;
          const detalle = contados + ' de ' + items.length + ' productos contados · ' + unidades + ' unidades · ' + fecha.split('-').reverse().join('/');
          for (const u of dest.filter(u => u.activo !== false)) {
            const link = LINK_ROL[u.rol] || '/deposito-admin.html#conteos';
            await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: u.id, icono: '📦', titulo, detalle, link }) });
            await pushA(sb, u.id, { title: '📦 ' + titulo, body: detalle, url: link, tag: 'stock-' + guardado.id });
          }
        } catch (e) { console.warn('stock: avisos', e.message); }
        return json(200, { ok: true, id: guardado.id, mail_ok: mailOk, mail_error: mailError });
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
      let q = 'stock_conteos?select=id,sector,usuario_nombre,fecha,proveedores,productos,contados,unidades,mail_ok,mail_error,created_at&order=created_at.desc&limit=200';
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
      return json(200, { filas, conStock, actualizado: ult[0] ? ult[0].actualizado_en : null, corridas, mail: !!process.env.RESEND_API_KEY });
    }
    return json(400, { error: 'Vista inválida.' });
  } catch (e) {
    return json(500, { error: 'No se pudo completar: ' + String((e && e.message) || e).slice(0, 200) });
  }
};

// El mail, armado acá con los datos ya limpios (antes lo armaba el navegador).
function htmlMail(f, provObs) {
  const lbl = SECTOR_LBL[f.sector];
  const provLine = f.proveedores.length ? 'Proveedores: ' + f.proveedores.join(', ') : 'Proveedores: Todos';
  const grupos = {};
  f.items.forEach(p => { (grupos[p.proveedor || '(Sin proveedor)'] = grupos[p.proveedor || '(Sin proveedor)'] || []).push(p); });
  const filas = Object.entries(grupos).map(([prov, items]) =>
    `<tr><td colspan="9" style="padding:10px 10px 4px;font-weight:700;color:#0d2230;border-bottom:2px solid #e7ded0">${esc(prov)}${provObs[prov] ? `<div style="font-weight:400;color:#6d7d85;font-size:12px;margin-top:2px">📝 ${esc(provObs[prov])}</div>` : ''}</td></tr>` +
    items.map(p => {
      const sis = p.stock_sistema + p.promo, dif = p.total - sis;
      const color = dif < 0 ? '#b5482d' : dif > 0 ? '#2f6f5e' : '#8a8f9a';
      const gris = p.total === 0 && !p.obs ? 'color:#9aa3a8;' : '';
      return `<tr style="${gris}">
        <td style="padding:6px 10px;font-family:monospace;font-size:12px;color:#8a8f9a">${esc(p.sku)}</td>
        <td style="padding:6px 10px">${esc(p.articulo)}${p.obs ? `<br><em style="color:#8a8f9a">${esc(p.obs)}</em>` : ''}</td>
        <td style="padding:6px 10px;text-align:center">${sis}</td>
        <td style="padding:6px 10px;text-align:center;color:#8a8f9a">${p.promo || ''}</td>
        <td style="padding:6px 10px;text-align:center">${p.depo1 || ''}</td>
        <td style="padding:6px 10px;text-align:center">${p.local || ''}</td>
        <td style="padding:6px 10px;text-align:center">${p.depo2 || ''}</td>
        <td style="padding:6px 10px;text-align:center;font-weight:700">${p.total}</td>
        <td style="padding:6px 10px;text-align:center;font-weight:700;color:${color}">${dif > 0 ? '+' : ''}${dif}</td></tr>`;
    }).join('')).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f1e8;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#1b2a32">
<div style="max-width:900px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e7ded0">
  <div style="background:#0d2230;padding:20px 28px">
    <div style="color:#c0912f;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Control de stock · Depósito</div>
    <div style="color:#fff;font-size:22px;font-weight:800">${esc(lbl)} — ${esc(f.fecha.split('-').reverse().join('/'))}</div>
    <div style="color:#b9c6cd;font-size:13px;margin-top:6px">${esc(f.usuario_nombre)} · ${esc(provLine)}</div>
  </div>
  <div style="padding:18px 28px;background:#fbf8f2;border-bottom:1px solid #e7ded0">
    <span style="display:inline-block;margin-right:36px"><span style="font-size:11px;color:#6d7d85;text-transform:uppercase;letter-spacing:1px">Contados</span><br><b style="font-size:28px;color:#0d2230">${f.contados}</b> <span style="font-size:12px;color:#6d7d85">de ${f.productos} productos</span></span>
    <span style="display:inline-block"><span style="font-size:11px;color:#6d7d85;text-transform:uppercase;letter-spacing:1px">Total unidades</span><br><b style="font-size:28px;color:#c0912f">${f.unidades}</b></span>
  </div>
  <div style="padding:18px 28px;overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#0d2230;color:#fff">
        <th style="padding:8px 10px;text-align:left">SKU</th><th style="padding:8px 10px;text-align:left">Descripción</th>
        <th style="padding:8px 10px">Stock<br>sistema</th><th style="padding:8px 10px">Promo</th><th style="padding:8px 10px">Depo 1</th>
        <th style="padding:8px 10px">Local</th><th style="padding:8px 10px">Depo 2</th><th style="padding:8px 10px">Total</th><th style="padding:8px 10px">Dif.</th>
      </tr></thead><tbody>${filas}</tbody></table>
  </div>
  <div style="padding:14px 28px;background:#fbf8f2;font-size:11px;color:#8a8f9a;text-align:center">Enviado desde el Portal GrandBar · Depósito</div>
</div></body></html>`;
}

module.exports.handler = require('./_errores').conErrores('stock', module.exports.handler);
