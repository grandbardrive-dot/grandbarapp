// ============================================================
//  GrandBar Hub · Function · apertura-presupuesto
//   Reemplaza el Excel que Seba arma a mano ("Apertura Presupuesto").
//   Botellas vendidas por Equipo (ON/OFF/SL/MAYOR) → Vendedor → Tipo de
//   cliente → Familia (VINOS/ESPIRITUOSAS), con 3 meses base + avance del
//   mes en curso vs objetivo (los objetivos los cargan los supervisores).
//
//   Motor: RPC public.apertura_reporte(desde,hasta) en el Manual (ventas
//   del ERP ya sincronizadas a diario). Objetivos/config: HUB.
//   Regla: solo familia 01 (VINOS) y 02 (ESPIRITUOSAS). unidades = botellas.
//   19/11/2026 (pedido del usuario): cuenta TODO lo facturado, igual que el
//   Inicio del vendedor (antes se excluía "Empresas y Particulares").
//   Tipo de cliente = rubro de CUBO (cuentas_cubo, base de Cobranzas); el del
//   Manual queda de respaldo. Equipos = los de la planilla Presupuesto Ventas
//   (como el Reporte diario), así entra cualquier vendedor nuevo.
//
//   GET  → reporte completo (todos ven los 4 equipos).
//   POST {accion:'guardar', mes, items:[{vcod,familia,objetivo}]} → objetivos.
//   Env: HUB_SERVICE_ROLE (para leer usuarios); objetivos se escriben con el
//   token del usuario (RLS: solo supervisores / compras / dirección).
// ============================================================

const OBJ = require('./_objetivos-vendedores');  // objetivos VINOS/SPIRITS por vendedor (misma planilla que el Reporte diario)

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const { traerTodo } = require('./_paginar.js');

const EQUIPOS = ['ON', 'OFF', 'SL', 'MAYOR'];
// Subtotales de la planilla Presupuesto Ventas → equipo de esta pantalla.
const EQUIPO_DE_GRUPO = { 'EQUIPO ON': 'ON', 'EQUIPO OFF': 'OFF', 'EQUIPO SL': 'SL', 'MAYORISTA MDZ': 'MAYOR', 'MAYORISTA SL': 'MAYOR' };
const EQNOMBRE = { ON: 'Equipo ON', OFF: 'Equipo OFF', SL: 'Equipo SL', MAYOR: 'Equipo MAYOR' };
const FAMILIAS = [['VINOS', 'Vinos'], ['ESP', 'Espirituosas']];
// Orden de tipos como en el Excel.
// Catering y Cafeteria son rubros de CUBO que el Excel no tenía. Si CUBO trae otro, va al final.
const TIPOS = ['Disco', 'Bares', 'Restaurant', 'Cafeteria', 'Vinoteca', 'Hotel', 'Catering', 'Autoservicio',
  'Tienda de Bebidas', 'Distribuidores y Mayoristas', 'Evento', 'Empresas y Particulares', 'Sin tipo'];

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const pct = (a, t) => t > 0 ? Math.round(100 * a / t) : 0;

const MESNOM = ['', '01 - Enero', '02 - Febrero', '03 - Marzo', '04 - Abril', '05 - Mayo', '06 - Junio',
  '07 - Julio', '08 - Agosto', '09 - Septiembre', '10 - Octubre', '11 - Noviembre', '12 - Diciembre'];
const ymLabel = ym => { const m = +ym.slice(5, 7); return MESNOM[m] || ym; };
const addMonth = (ym, d) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + d; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + String(m + 1).padStart(2, '0'); };
const firstDay = ym => ym + '-01';
const lastDay = ym => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

exports.handler = async (event) => {
  try {
    const hubService = process.env.HUB_SERVICE_ROLE;
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const hub = (path) => fetch(HUB_URL + '/rest/v1/' + path, { headers: { apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token) } });
    const perfil = (await (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,codigo_vendedor,es_supervisor')).json())[0] || {};
    const rol = String(perfil.rol || '').toLowerCase();
    const esSup = !!perfil.es_supervisor;
    const VER = ['diseno', 'admin', 'direccion', 'torneo', 'compras', 'desarrollo', 'marketing'];
    const puedeVer = esSup || VER.includes(rol);
    const puedeEditar = esSup || ['compras', 'direccion', 'admin', 'desarrollo', 'diseno'].includes(rol);
    if (!puedeVer) return json(403, { error: 'Solo para supervisores y Dirección/Comercial.' });

    // -------- Períodos (mes actual = hoy; N meses base antes) --------
    const cfg = {}; (await (await hub('presupuesto_config?select=k,v')).json() || []).forEach(r => { cfg[r.k] = r.v; });
    const nBase = Math.max(1, Math.min(6, num(cfg.meses_base) || 3));
    const hoy = new Date();
    const mesActual = cfg.mes_actual || (hoy.getUTCFullYear() + '-' + String(hoy.getUTCMonth() + 1).padStart(2, '0'));
    const mesesBase = []; for (let i = nBase; i >= 1; i--) mesesBase.push(addMonth(mesActual, -i));
    const todos = mesesBase.concat([mesActual]);
    const desde = firstDay(mesesBase[0]);
    const hasta = lastDay(mesActual);

    // -------- POST: guardar objetivos --------
    if (event.httpMethod === 'POST') {
      if (!puedeEditar) return json(403, { error: 'No tenés permiso para cargar objetivos.' });
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
      if (body.accion !== 'guardar') return json(400, { error: 'Acción inválida' });
      const mes = String(body.mes || mesActual);
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return json(400, { error: 'Nada para guardar' });
      const rows = items.map(it => ({
        mes, vendedor_codigo: String(it.vcod), familia: String(it.familia),
        tipo_cliente: 'TOTAL', objetivo: num(it.objetivo), updated_by: user.id, updated_at: new Date().toISOString(),
      }));
      // upsert con el TOKEN del usuario (RLS controla el permiso real)
      const up = await fetch(HUB_URL + '/rest/v1/presupuesto_objetivos?on_conflict=mes,vendedor_codigo,familia,tipo_cliente', {
        method: 'POST',
        headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!up.ok) return json(up.status, { error: 'No se pudo guardar (' + up.status + ')', detalle: await up.text() });
      return json(200, { ok: true, guardados: rows.length });
    }

    // -------- GET: armar el reporte --------
    // Tipo de cliente = rubro de CUBO (19/11/2026). En el Manual, Catering y Cafetería figuraban como
    // "otros" y se contaban como Empresas y Particulares.
    const cobKey = process.env.COBRANZAS_SERVICE_ROLE;
    const cob = (p, o) => fetch(COB_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: cobKey, Authorization: 'Bearer ' + cobKey }, (o && o.headers) || {}) });
    const man = (p) => fetch(MAN_URL + '/rest/v1/' + p, { headers: { apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON } });
    const nc = s => String(s == null ? '' : s).trim().replace(/^0+/, '') || '0';
    const [tiposCubo, objRes, eqRes, vendMan, pres] = await Promise.all([
      (async () => {
        if (!cobKey) return null;
        const filas = await traerTodo(cob, 'cuentas_cubo?select=codigo,rubro&order=codigo');
        const t = {};
        (filas || []).forEach(c => { const r = String(c.rubro || '').trim(); if (r && !/^sin categorizar$/i.test(r)) t[nc(c.codigo)] = r; });
        return t;
      })().catch(() => null),
      hub('presupuesto_objetivos?mes=eq.' + mesActual + '&select=vendedor_codigo,familia,tipo_cliente,objetivo'),
      hub('usuarios?select=nombre,codigo_vendedor&codigo_vendedor=not.is.null'),
      man('vendedores?select=codigo,nombre').then(r => r.ok ? r.json() : []).catch(() => []),
      OBJ.leerPresupuesto().catch(() => null),
    ]);
    const rpcRes = await fetch(MAN_URL + '/rest/v1/rpc/apertura_reporte', {
      method: 'POST', headers: { apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ desde, hasta, p_tipos: tiposCubo }),
    });
    const datos = await rpcRes.json();
    if (!Array.isArray(datos)) return json(500, { error: 'Motor de ventas no disponible', detalle: datos });
    const objetivos = await objRes.json() || [];
    const usuarios = await eqRes.json() || [];

    // Equipo de cada vendedor según la planilla Presupuesto Ventas: cada fila en MAYÚSCULAS
    // (EQUIPO ON, EQUIPO OFF…) cierra el equipo de las de arriba. Si la planilla no responde,
    // queda el equipo de respaldo que trae el motor.
    const vendTodos = (Array.isArray(vendMan) ? vendMan : []).map(v => ({ codigo: v.codigo, nombre: v.nombre }))
      .concat((Array.isArray(usuarios) ? usuarios : []).filter(u => u.codigo_vendedor).map(u => ({ codigo: u.codigo_vendedor, nombre: u.nombre })));
    let equipoDe = null;
    if (Array.isArray(pres)) {
      equipoDe = {};
      let grupo = [];
      for (const fila of pres) {
        if (fila.grupo) { const e = EQUIPO_DE_GRUPO[String(fila.nombre).trim().toUpperCase()]; if (e) grupo.forEach(c => { if (!equipoDe[c]) equipoDe[c] = e; }); grupo = []; continue; }
        const c = OBJ.codigoDeFila(fila, vendTodos); if (c) grupo.push(nc(c));
      }
    }

    // nombre "oficial" del Hub por si el de ventas trae espacios/variantes
    const nombreHub = {}; (Array.isArray(usuarios) ? usuarios : []).forEach(u => { if (u.codigo_vendedor) nombreHub[String(u.codigo_vendedor).replace(/^0+/, '') || '0'] = u.nombre; });
    // objetivo TOTAL por vendedor+familia, cargado a mano en el Hub (tiene prioridad)
    const objMap = {}; (Array.isArray(objetivos) ? objetivos : []).forEach(o => { if (o.tipo_cliente === 'TOTAL') objMap[o.vendedor_codigo + '|' + o.familia] = num(o.objetivo); });
    // Objetivos de la planilla "Presupuesto Ventas" de Administración (la MISMA que usa el Reporte diario):
    // VINOS/SPIRITS por vendedor, se actualiza sola cada mes. Si una celda del Hub pisa, gana el Hub.
    const objSheet = {};
    try {
      const vendList = vendTodos;   // vendedores del Manual + usuarios del Hub (19/11/2026: así entra Emiliano)
      for (const fila of (pres || [])) {
        if (fila.grupo) continue;
        const cod = OBJ.codigoDeFila(fila, vendList);
        if (!cod) continue;
        const vc = String(cod).replace(/^0+/, '') || '0';
        if (fila.vinos != null) objSheet[vc + '|VINOS'] = num(fila.vinos);
        if (fila.spirits != null) objSheet[vc + '|ESP'] = num(fila.spirits);
      }
    } catch (e) { /* si la planilla no responde, seguimos con los objetivos del Hub */ }
    const objDe = (vc, fk) => { const k = vc + '|' + fk; return objMap[k] != null ? objMap[k] : (objSheet[k] || 0); };

    // acumular: eq -> fam -> vcod -> { nombre, tipos:{tipo:{meses}}, meses }
    const acc = {};
    for (const r of datos) {
      const fam = r.familia, vc = String(r.vendedor_codigo);
      const eq = equipoDe ? equipoDe[vc] : r.equipo;
      if (!eq || !fam) continue;   // vendedores fuera de los equipos de la planilla (p. ej. Empleados)
      acc[eq] = acc[eq] || {};
      acc[eq][fam] = acc[eq][fam] || {};
      const V = acc[eq][fam][vc] = acc[eq][fam][vc] || { vcod: vc, nombre: nombreHub[vc] || (r.vendedor_nombre || '').trim(), meses: {}, tipos: {} };
      V.meses[r.mes] = (V.meses[r.mes] || 0) + num(r.botellas);
      const T = V.tipos[r.tipo_cliente] = V.tipos[r.tipo_cliente] || { tipo: r.tipo_cliente, meses: {} };
      T.meses[r.mes] = (T.meses[r.mes] || 0) + num(r.botellas);
    }

    const equipos = EQUIPOS.map(eq => ({
      equipo: eq, nombre: EQNOMBRE[eq],
      familias: FAMILIAS.map(([fk, fn]) => {
        const vmap = (acc[eq] && acc[eq][fk]) || {};
        const vendedores = Object.values(vmap).map(V => {
          const objetivo = objDe(V.vcod, fk);
          const actual = num(V.meses[mesActual]);
          const tipos = TIPOS.concat(Object.keys(V.tipos).filter(t => !TIPOS.includes(t)))
            .filter(t => V.tipos[t])
            .map(t => ({ tipo: t, meses: todos.map(m => num(V.tipos[t].meses[m])), actual: num(V.tipos[t].meses[mesActual]) }));
          return { vcod: V.vcod, nombre: V.nombre, meses: todos.map(m => num(V.meses[m])), actual, objetivo, pct: pct(actual, objetivo), tipos };
        }).sort((a, b) => b.actual - a.actual || a.nombre.localeCompare(b.nombre));
        const totMeses = todos.map((m, i) => vendedores.reduce((s, v) => s + v.meses[i], 0));
        const totObj = vendedores.reduce((s, v) => s + v.objetivo, 0);
        const totAct = vendedores.reduce((s, v) => s + v.actual, 0);
        return { familia: fk, nombre: fn, vendedores, totMeses, totObjetivo: totObj, totActual: totAct, pct: pct(totAct, totObj) };
      }),
    }));

    return json(200, {
      generado: new Date().toISOString(),
      mesActual, mesActualLabel: ymLabel(mesActual),
      meses: todos.map(m => ({ ym: m, label: ymLabel(m), base: m !== mesActual })),
      puedeEditar, usuario: perfil.nombre || '',
      equipos,
    });
  } catch (e) {
    return json(500, { error: 'Error', detalle: String(e && e.message || e) });
  }
};
