// ============================================================
//  GrandBar Hub · Function · supervisor-equipo
//   Devuelve, para el SUPERVISOR logueado, los datos de TODO su
//   equipo (vendedores de su región + canal):
//     - resumen por vendedor (# clientes, saldo, deuda vencida, tareas hoy)
//     - totales del equipo
//     - ?clientes=1        → lista completa de clientes del equipo
//     - ?vendedor=CODIGO   → clientes de ese vendedor (drill-in)
//   Fuente de clientes/saldo: cuentas_cubo (Cobranzas, service role).
//   Env: COBRANZAS_SERVICE_ROLE, HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const { traerTodo } = require('./_paginar.js');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const qvals = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const normCod = x => (String(x == null ? '' : x).trim().replace(/^0+/, '') || '0');

// Cartera REAL de cada vendedor = clientes del Manual que están activos (misma
// definición que ve el vendedor: manda clientes_estado por código; si no figura,
// vale la columna activo de la tabla). Devuelve:
//   allowed          → Set de códigos activos de todo el equipo
//   vendorsWithManual→ Set de códigos de vendedor que tienen clientes en el Manual
//   countByVendor    → { codigoVendedor: cantidad de clientes activos }
async function carteraManual(codigos) {
  const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON }, (o && o.headers) || {}) });
  const out = { allowed: new Set(), vendorsWithManual: new Set(), countByVendor: {} };
  try {
    const vends = await (await man('vendedores?codigo=in.(' + qvals(codigos) + ')&select=id,codigo')).json();
    if (!Array.isArray(vends) || !vends.length) return out;
    const codOf = {}; vends.forEach(v => { codOf[v.id] = String(v.codigo); });
    const ids = vends.map(v => '"' + v.id + '"').join(',');
    // Las dos pasan las mil filas: van paginadas sí o sí (un "limit" alto no sirve).
    const [cli, est] = await Promise.all([
      traerTodo(man, 'clientes?vendedor_id=in.(' + ids + ')&select=codigo_cliente,vendedor_id,activo&order=codigo_cliente.asc'),
      traerTodo(man, 'clientes_estado?select=codigo,activo&order=codigo.asc'),
    ]);
    const estMap = {}; (Array.isArray(est) ? est : []).forEach(r => { estMap[normCod(r.codigo)] = r.activo; });
    (Array.isArray(cli) ? cli : []).forEach(c => {
      const vcod = codOf[c.vendedor_id]; if (!vcod) return;
      out.vendorsWithManual.add(vcod);
      const k = normCod(c.codigo_cliente);
      const activo = (k in estMap) ? estMap[k] : (c.activo !== false);
      if (activo) { out.allowed.add(k); out.countByVendor[vcod] = (out.countByVendor[vcod] || 0) + 1; }
    });
  } catch (e) {}
  return out;
}

exports.handler = async (event) => {
  try {
    const cobService = process.env.COBRANZAS_SERVICE_ROLE;
    const hubService = process.env.HUB_SERVICE_ROLE;
    if (!cobService) return json(500, { error: 'Falta COBRANZAS_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    // Validar token Hub + traer perfil del supervisor
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,canal,region,codigo_vendedor,es_supervisor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = (await pRes.json())[0] || {};
    if (!perfil.es_supervisor) return json(403, { error: 'Solo para supervisores.' });

    // Aceptan opciones (las usa traerTodo para pedir de a mil filas).
    const hub = (path, o) => fetch(HUB_URL + '/rest/v1/' + path, { headers: Object.assign({ apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token) }, (o && o.headers) || {}) });
    const cob = (path, o) => fetch(COB_URL + '/rest/v1/' + path, { headers: Object.assign({ apikey: cobService, Authorization: 'Bearer ' + cobService }, (o && o.headers) || {}) });

    // Equipo: vendedores de la misma región + canal (o 'ambos')
    const eqRes = await hub('usuarios?rol=eq.ventas&select=nombre,codigo_vendedor,canal,region');
    const pc = String(perfil.canal || '').toLowerCase(), preg = String(perfil.region || '').toLowerCase();
    const equipo = (await eqRes.json() || []).filter(u => {
      if (preg && u.region && String(u.region).toLowerCase() !== preg) return false;
      const uc = String(u.canal || '').toLowerCase();
      return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
    }).filter(u => u.codigo_vendedor);
    const codigos = equipo.map(v => String(v.codigo_vendedor));
    const nombreDeCod = {}; equipo.forEach(v => { nombreDeCod[String(v.codigo_vendedor)] = v.nombre; });

    if (!codigos.length) return json(200, { nombre: perfil.nombre, canal: perfil.canal, region: perfil.region, equipo: [], totales: { vendedores: 0, clientes: 0, saldo: 0, vencida: 0 }, clientes: [] });

    // Clientes de todo el equipo desde cuentas_cubo.
    // PAGINADO: un equipo pasa las mil filas fácil y la base corta ahí sin avisar.
    // Cuando se cortaba, la deuda del supervisor daba menos que la del vendedor
    // (Exequiel: 29 mil acá contra 34 mil en su panel).
    let clientes = await traerTodo(cob, 'cuentas_cubo?vendedor=in.(' + qvals(codigos) + ')&select=codigo,nombre,saldo,vencida,telefono,vendedor,actualizado&order=codigo.asc');
    if (!Array.isArray(clientes)) clientes = [];
    // Fecha real del último sync con el ERP (Aikon) — la más reciente del cubo.
    let actualizado = null;
    for (const c of clientes) { if (c.actualizado && (!actualizado || c.actualizado > actualizado)) actualizado = c.actualizado; }
    // La deuda vencida no puede superar el saldo neto: una nota de crédito / anticipo
    // baja la deuda aunque el cubo viejo la dejara inflada. (Corrige la vista al toque.)
    clientes = clientes.map(c => ({ ...c, vencida: Math.max(0, Math.min(num(c.vencida), num(c.saldo))) }));

    // La PLATA sale de todo lo que el ERP tiene a nombre del vendedor, igual que
    // en su pantalla de deuda: si acá se filtrara por la cartera del Manual, un
    // cliente que debe y quedó fuera de la cartera desaparecía y los dos paneles
    // mostraban números distintos. La cartera se usa solo para CONTAR clientes
    // (ese número sí es el del Manual, el que ve el vendedor en "Mi cartera").
    const cartera = await carteraManual(codigos);

    // ¿drill-in de un vendedor puntual?
    const qp = event.queryStringParameters || {};
    if (qp.vendedor) {
      const cod = String(qp.vendedor);
      let lista = clientes.filter(c => String(c.vendedor) === cod);
      lista = await enriquecerGeo(lista, hubService);
      return json(200, { vendedor: cod, nombre: nombreDeCod[cod] || cod, clientes: lista });
    }

    // Agregados por vendedor
    const agg = {};
    codigos.forEach(cod => { agg[cod] = { codigo: cod, nombre: nombreDeCod[cod] || cod, clientes: 0, saldo: 0, vencida: 0 }; });
    clientes.forEach(c => { const a = agg[String(c.vendedor)]; if (a) { a.clientes++; a.saldo += num(c.saldo); a.vencida += num(c.vencida); } });
    // El número de clientes lo manda la cartera del Manual (lo que ve el vendedor).
    codigos.forEach(cod => { if (cartera.vendorsWithManual.has(cod)) agg[cod].clientes = cartera.countByVendor[cod] || 0; });

    // Tareas completadas hoy por vendedor (señal de cumplimiento)
    let compHoy = {};
    if (hubService) {
      const hoy = new Date().toISOString().slice(0, 10);
      const compRes = await hub('tareas_completadas?fecha=eq.' + hoy + '&vendedor=in.(' + qvals(codigos) + ')&select=vendedor');
      (await compRes.json().catch(() => []) || []).forEach(x => { compHoy[String(x.vendedor)] = (compHoy[String(x.vendedor)] || 0) + 1; });
    }
    const equipoOut = codigos.map(cod => ({ ...agg[cod], tareas_hoy: compHoy[cod] || 0 })).sort((a, b) => b.vencida - a.vencida);
    const totales = equipoOut.reduce((t, v) => ({ vendedores: t.vendedores + 1, clientes: t.clientes + v.clientes, saldo: t.saldo + v.saldo, vencida: t.vencida + v.vencida }), { vendedores: 0, clientes: 0, saldo: 0, vencida: 0 });

    let listaClientes = [];
    if (qp.clientes) {
      listaClientes = await enriquecerGeo(clientes.map(c => ({ ...c, vendedor_nombre: nombreDeCod[String(c.vendedor)] || c.vendedor })), hubService);
    }

    return json(200, { nombre: perfil.nombre, canal: perfil.canal, region: perfil.region, equipo: equipoOut, totales, clientes: listaClientes, actualizado });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

// Agrega dirección/localidad/coords desde clientes_geo (Hub) por código numérico
async function enriquecerGeo(lista, hubService) {
  if (!hubService || !lista.length) return lista;
  const nums = [...new Set(lista.map(c => parseInt(c.codigo, 10)).filter(n => !isNaN(n)))];
  const geoMap = {};
  for (let i = 0; i < nums.length; i += 300) {
    const lote = nums.slice(i, i + 300);
    const gRes = await fetch(HUB_URL + '/rest/v1/clientes_geo?select=codigo,direccion,localidad,lat,lng&codigo=in.(' + lote.join(',') + ')', { headers: { apikey: hubService, Authorization: 'Bearer ' + hubService } });
    const gArr = await gRes.json().catch(() => []);
    if (Array.isArray(gArr)) for (const g of gArr) geoMap[g.codigo] = g;
  }
  return lista.map(c => { const g = geoMap[parseInt(c.codigo, 10)]; return g ? { ...c, direccion: g.direccion, localidad: g.localidad, lat: g.lat, lng: g.lng } : c; });
}
