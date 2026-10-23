// ============================================================
//  GrandBar Hub · Function PROGRAMADA · lugares-libres-cron  (23/10/2026)
//  Corre los días hábiles cada 10 minutos, de 9 a 19 (ver netlify.toml). A cada proveedor del portal le
//  avisa por la campanita y por el celular cuando aparecen lugares del manual de
//  vendedores sin ninguna acción que todavía no le avisamos ("sé el primero").
//  Un solo aviso por día, con el total, que lleva a "Lugares sin ninguna acción".
//
//  Recuerda qué lugares ya le avisó a cada uno (tabla lugares_libres_avisos, ver
//  lugares-libres-setup.sql). Si un lugar se ocupa, se olvida: si vuelve a quedar
//  vacío, se avisa de nuevo. El aviso lleva la referencia lugares-libres:<fecha> y la
//  tabla de notificaciones no deja guardar dos con la misma, así que aunque corra dos
//  veces en el día no repite. El cálculo es el mismo del portal (_lugares-libres.js).
//  Env: HUB_SERVICE_ROLE, VAPID_* (push)
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const { lugaresPara } = require('./_lugares-libres');
const { pushA } = require('./_notificar');

const LINK = '/manual-vendedores/proveedor-manual.html?libres=1';
const RUBRO_PL = { restaurante: 'Restaurantes', bar: 'Bares', vinoteca: 'Vinotecas', autoservicio: 'Autoservicios', tienda_bebidas: 'Tiendas de bebidas', hotel: 'Hoteles', disco: 'Discos', evento: 'Eventos', mayorista: 'Mayoristas' };
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const qids = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

exports.handler = async () => {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
  const hub = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', ...(o.headers || {}) } });

  const ur = await hub('usuarios?rol=eq.proveedor&or=(activo.is.null,activo.eq.true)&select=id,nombre,empresa');
  if (!ur.ok) throw new Error('usuarios ' + ur.status);
  const proveedores = await ur.json();

  const informe = [];
  for (const u of proveedores) {
    const empresa = u.empresa || u.nombre;
    const { lugares } = await lugaresPara(empresa);
    const ar = await hub('lugares_libres_avisos?usuario_id=eq.' + encodeURIComponent(u.id) + '&select=lugar_id');
    if (!ar.ok) throw new Error('lugares_libres_avisos ' + ar.status + ' ' + (await ar.text()).slice(0, 150));
    const avisados = new Set((await ar.json()).map(a => a.lugar_id));
    const ahora = new Set(lugares.map(l => l.id));
    // Los de su categoría primero: vienen así ordenados.
    const nuevos = lugares.filter(l => !avisados.has(l.id));
    const ocupados = [...avisados].filter(id => !ahora.has(id));
    const fila = { empresa, libres: lugares.length, nuevos: nuevos.length, olvidados: ocupados.length, aviso: false, push: 0 };

    if (nuevos.length) {
      const n = nuevos.length;
      const titulo = !avisados.size
        ? (n === 1 ? 'Hay un lugar del manual sin ninguna acción' : 'Hay ' + n + ' lugares del manual sin ninguna acción')
        : (n === 1 ? 'Se liberó un lugar en el manual de vendedores' : 'Se liberaron ' + n + ' lugares en el manual de vendedores');
      const nom = l => (RUBRO_PL[l.rubro] || l.rubro) + ' › ' + l.madre + (l.sub ? ' › ' + l.sub : '');
      const detalle = 'Sé el primero en cargar una acción: ' + nuevos.slice(0, 2).map(nom).join(', ') + (n > 2 ? ' y ' + (n - 2) + ' más.' : '.');
      const r = await hub('notificaciones?on_conflict=destinatario_id,ref', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify([{ destinatario_id: u.id, icono: '📍', titulo, detalle, link: LINK, ref: 'lugares-libres:' + hoyAR() }]),
      });
      if (!r.ok) throw new Error('notificaciones ' + r.status + ' ' + (await r.text()).slice(0, 150));
      // Si hoy ya se le avisó, lo nuevo queda para el próximo día hábil.
      if ((await r.json()).length) {
        fila.aviso = true;
        fila.push = await pushA(hub, u.id, { title: '📍 ' + titulo, body: detalle, url: LINK, tag: 'lugares-libres' });
        const w = await hub('lugares_libres_avisos?on_conflict=usuario_id,lugar_id', {
          method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(nuevos.map(l => ({ usuario_id: u.id, lugar_id: l.id }))),
        });
        if (!w.ok) throw new Error('lugares_libres_avisos (guardar) ' + w.status + ' ' + (await w.text()).slice(0, 150));
      }
    }
    if (ocupados.length) {
      await hub('lugares_libres_avisos?usuario_id=eq.' + encodeURIComponent(u.id) + '&lugar_id=in.(' + qids(ocupados) + ')', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    }
    informe.push(fila);
  }
  console.log('lugares-libres', JSON.stringify(informe));
  return json(200, { ok: true, informe });
};

// Estado del sistema: cada corrida queda en sistema_corridas (ver _corrida.js).
exports.handler = require('./_corrida').conRegistro('lugares-libres', exports.handler);
