// ============================================================
//  GrandBar Hub · Function · sync-clientes-cubo
//  Mantiene la lista de clientes del MANUAL al día con CUBO.
//
//  Hasta ahora la tabla clientes del manual era una foto: se cargó con una
//  planilla el 1/6/2026 (5.328) y el 26/8 (110), y nunca más. Los clientes
//  nuevos de CUBO no llegaban, y el rubro quedó el de esa planilla: 3.280 en
//  "otros" y ningún disco. CUBO tiene el rubro bien cargado (cl_tipocliente).
//
//  Por cada cliente de CUBO:
//    · si no existe en el manual → lo crea, con su rubro y su vendedor
//    · si existe → actualiza nombre, rubro y vendedor si cambiaron en CUBO, y
//      completa la dirección SOLO si en el manual está vacía
//  Lo que NO toca nunca:
//    · activo / oculto  → lo maneja cada vendedor desde su cartera
//    · whatsapp y logo  → los carga el vendedor en la visita
//    · no borra a nadie
//  El rubro se pisa solo cuando el de CUBO es reconocible (ver RUBROS). Si CUBO
//  dice "Cafetería", "Catering", "Empresas y Particulares" o viene vacío, se
//  respeta lo que ya tiene el manual.
//
//  Modos:
//    ?modo=simulacro (por defecto) → dice qué cambiaría, NO escribe nada
//    ?modo=aplicar                 → escribe
//  Quién puede: sesión del Portal con rol admin / desarrollo / diseno, o
//  ?key=<SYNC_SECRET> (igual que sync-ventas).
//  Env: AIKON_* (las mismas de sync-ventas). Opcional MANUAL_SERVICE_ROLE.
// ============================================================

const { traerTodo } = require('./_paginar');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY  = process.env.MANUAL_SERVICE_ROLE || process.env.MANUAL_ANON_KEY
              || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const ROLES_OK = ['admin', 'desarrollo', 'diseno'];
const PRESUPUESTO_MS = 20000;   // igual que sync-ventas: el plan no tiene funciones largas

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const man = (path, opts = {}) => fetch(MAN_URL + '/rest/v1/' + path, {
  ...opts,
  headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

// ── Rubro de CUBO → tipo del manual ─────────────────────────
// Las claves van sin tildes y en minúscula (se comparan normalizadas).
const RUBROS = {
  'vinoteca': 'vinoteca',
  'restaurant': 'restaurante', 'restaurante': 'restaurante',
  'bares': 'bar', 'bar': 'bar',
  'disco': 'disco', 'discoteca': 'disco', 'boliche': 'disco',
  'autoservicio': 'autoservicio',
  'tienda de bebidas': 'tienda de bebidas',
  'hotel': 'hotel',
  'distribuidores y mayoristas': 'mayorista', 'mayorista': 'mayorista',
};

const norm = s => String(s == null ? '' : s).trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const cod5 = c => { const s = String(c == null ? '' : c).trim(); return /^\d+$/.test(s) ? s.padStart(5, '0') : s; };
const cod3 = c => { const s = String(c == null ? '' : c).trim(); return /^\d+$/.test(s) ? s.padStart(3, '0') : s; };
const val  = (o, ...k) => { for (const x of k) if (o[x] != null && String(o[x]).trim() !== '') return o[x]; return null; };

// ¿Está dado de baja en CUBO? Los nombres de columna de DtTabla no están
// documentados: se prueban los probables y se informa cuál apareció.
const CAMPOS_ESTADO = ['cl_baja', 'cl_inactivo', 'cl_estado', 'cl_activo', 'estado', 'Estado', 'baja'];
function activoEnCubo(o) {
  const b = val(o, 'cl_baja', 'cl_inactivo', 'baja');
  if (b != null && ['s', 'si', '1', 'true', 't', 'x'].includes(norm(b))) return false;
  const e = val(o, 'cl_estado', 'estado', 'Estado', 'cl_activo');
  if (e != null && /baja|inactiv|suspend|^n$|^no$|^0$|^false$/.test(norm(e))) return false;
  return true;
}

// ── El cálculo, separado de la red para poder probarlo ──────
// cubo: filas crudas de DtTabla · manual: clientes del manual · vendedores: del manual
function calcular(cubo, manual, vendedores) {
  const vendId = {};
  vendedores.forEach(v => { vendId[cod3(v.codigo)] = v.id; });
  const porCod = {};
  manual.forEach(c => { porCod[cod5(c.codigo_cliente)] = c; });

  const nuevos = [], cambios = [];
  const sinMapear = {}, vendSinMatch = {}, cambiosRubro = {};
  const porCampo = { nombre: 0, tipo: 0, vendedor: 0, direccion: 0 };
  const vistos = new Set();

  for (const o of cubo) {
    const cod = cod5(val(o, 'cl_codigo', 'Codigo', 'codigo', 'ClienteCodigo'));
    if (!cod || vistos.has(cod)) continue;
    vistos.add(cod);

    const nombre = String(val(o, 'cl_nombre', 'Nombre', 'nombre') || val(o, 'cl_razsoc', 'RazonSocial', 'RazonSoc') || '').trim();
    const direccion = val(o, 'cl_direccion', 'Direccion', 'direccion');
    const ven = cod3(val(o, 'ven_codigo', 'Vendedor', 'vendedor'));
    const rubro = String(val(o, 'cl_tipocliente', 'TipoCliente', 'tipocliente') || '').trim();

    const tipo = RUBROS[norm(rubro)] || null;
    if (rubro && !tipo) sinMapear[rubro] = (sinMapear[rubro] || 0) + 1;
    const vid = ven ? (vendId[ven] || null) : null;
    if (ven && !vid) vendSinMatch[ven] = (vendSinMatch[ven] || 0) + 1;

    const ex = porCod[cod];
    if (!ex) {
      nuevos.push({ codigo_cliente: cod, nombre: nombre || cod, direccion: direccion ? String(direccion).trim() : null,
                    tipo: tipo || 'otros', vendedor_id: vid, activo: activoEnCubo(o), _rubro: rubro, _ven: ven });
      continue;
    }

    // Se manda la fila completa de estas cinco columnas, con lo que ya tenía
    // donde no cambia: así el upsert nunca deja un campo en blanco.
    const fila = { codigo_cliente: ex.codigo_cliente, nombre: ex.nombre, direccion: ex.direccion,
                   tipo: ex.tipo, vendedor_id: ex.vendedor_id };
    const que = [];
    if (nombre && norm(nombre) !== norm(ex.nombre)) { fila.nombre = nombre; que.push('nombre'); porCampo.nombre++; }
    if (tipo && tipo !== ex.tipo) {
      fila.tipo = tipo; que.push('tipo'); porCampo.tipo++;
      const k = (ex.tipo || '(vacío)') + ' → ' + tipo;
      cambiosRubro[k] = (cambiosRubro[k] || 0) + 1;
    }
    if (vid && vid !== ex.vendedor_id) { fila.vendedor_id = vid; que.push('vendedor'); porCampo.vendedor++; }
    if (direccion && !ex.direccion) { fila.direccion = String(direccion).trim(); que.push('direccion'); porCampo.direccion++; }
    if (que.length) cambios.push({ fila, que, antes: ex, _ven: ven });
  }

  const noEnCubo = manual.filter(c => !vistos.has(cod5(c.codigo_cliente))).length;
  return { nuevos, cambios, sinMapear, vendSinMatch, cambiosRubro, porCampo, noEnCubo, vistos: vistos.size };
}

// ── CUBO ────────────────────────────────────────────────────
async function aikon(url, body, ms = 30000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    return await r.json().catch(() => ({}));
  } finally { clearTimeout(t); }
}
async function login() {
  const cuenta = process.env.AIKON_CUENTA;
  if (!cuenta || !process.env.AIKON_EMPRESA) throw new Error('Faltan AIKON_CUENTA / AIKON_EMPRESA en Netlify.');
  const managerUrl = process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const j1 = await aikon(managerUrl, { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
  if (!urlCuenta) throw new Error('CUBO no devolvió la dirección de la cuenta.');
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa: process.env.AIKON_EMPRESA });
  const token = j2.token && j2.token.Codigo;
  if (!token) throw new Error('CUBO no dio token de acceso.');
  return { urlCuenta, cuenta, token };
}
async function clientesDeCubo() {
  const { urlCuenta, cuenta, token } = await login();
  const j = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla: process.env.AIKON_TABLA_CLIENTES || 'CLIENTES' }, 45000);
  const lista = Array.isArray(j) ? j : (j.lista || j.retorno || j.tabla || j.Tabla || j.datos || j.Datos || j.registros || j.Registros || j.data || []);
  if (!Array.isArray(lista) || !lista.length) throw new Error('CUBO no devolvió clientes. Respuesta: ' + JSON.stringify(j).slice(0, 200));
  return lista;
}

// ── Quién llama ─────────────────────────────────────────────
async function autorizado(event) {
  const q = event.queryStringParameters || {};
  if (process.env.SYNC_SECRET && q.key === process.env.SYNC_SECRET) return true;
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const u = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
  if (!u.ok) return false;
  const user = await u.json();
  const p = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
  const perfil = ((await p.json()) || [])[0] || {};
  return ROLES_OK.includes(String(perfil.rol || '').toLowerCase());
}

// ── Escribir ────────────────────────────────────────────────
// Upsert por codigo_cliente, diciendo QUÉ columnas se mandan: así nunca pisa
// activo, whatsapp ni logo, que no están en la lista.
async function escribir(filas, columnas, t0) {
  let ok = 0; const errores = [];
  for (let i = 0; i < filas.length; i += 500) {
    if (Date.now() - t0 > PRESUPUESTO_MS) { errores.push('Se cortó por tiempo: faltan ' + (filas.length - i) + '. Volvé a correrlo, sigue donde quedó.'); break; }
    const lote = filas.slice(i, i + 500);
    const r = await man('clientes?on_conflict=codigo_cliente&columns=' + columnas.join(','), {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(lote),
    });
    if (r.ok) ok += lote.length;
    else errores.push('Lote ' + (i / 500 + 1) + ': ' + (await r.text()).slice(0, 200));
  }
  return { ok, errores };
}

exports.handler = async (event) => {
  const t0 = Date.now();
  try {
    if (!(await autorizado(event))) return json(401, { error: 'Solo Desarrollo, Diseño o admin pueden correr la sincronización.' });
    const modo = ((event.queryStringParameters || {}).modo || 'simulacro').toLowerCase() === 'aplicar' ? 'aplicar' : 'simulacro';

    const [cubo, manual, vendedores] = await Promise.all([
      clientesDeCubo(),
      traerTodo(man, 'clientes?select=id,codigo_cliente,nombre,direccion,tipo,vendedor_id&order=id'),
      traerTodo(man, 'vendedores?select=id,codigo,nombre&order=codigo'),
    ]);
    const r = calcular(cubo, manual, vendedores);
    const nomVend = {}; vendedores.forEach(v => { nomVend[v.id] = cod3(v.codigo) + ' ' + v.nombre; });

    const informe = {
      modo,
      cubo: { clientes: r.vistos, columnas: Object.keys(cubo[0] || {}),
              campo_estado: CAMPOS_ESTADO.find(k => cubo[0] && k in cubo[0]) || null },
      manual: { clientes: manual.length, que_cubo_no_tiene: r.noEnCubo },
      nuevos: r.nuevos.length,
      nuevos_dados_de_baja_en_cubo: r.nuevos.filter(n => !n.activo).length,
      a_actualizar: r.cambios.length,
      por_campo: r.porCampo,
      cambios_de_rubro: r.cambiosRubro,
      rubros_de_cubo_sin_traducir: r.sinMapear,
      vendedores_de_cubo_que_no_estan_en_el_manual: r.vendSinMatch,
      muestras: {
        nuevos: r.nuevos.slice(0, 12).map(n => ({ codigo: n.codigo_cliente, nombre: n.nombre, rubro: n.tipo, vendedor: nomVend[n.vendedor_id] || n._ven || '—' })),
        rubro: r.cambios.filter(c => c.que.includes('tipo')).slice(0, 15).map(c => ({ codigo: c.fila.codigo_cliente, nombre: c.fila.nombre, antes: c.antes.tipo, despues: c.fila.tipo })),
        vendedor: r.cambios.filter(c => c.que.includes('vendedor')).slice(0, 12).map(c => ({ codigo: c.fila.codigo_cliente, nombre: c.fila.nombre, antes: nomVend[c.antes.vendedor_id] || '—', despues: nomVend[c.fila.vendedor_id] || c._ven })),
        nombre: r.cambios.filter(c => c.que.includes('nombre')).slice(0, 12).map(c => ({ codigo: c.fila.codigo_cliente, antes: c.antes.nombre, despues: c.fila.nombre })),
      },
    };

    if (modo === 'aplicar') {
      const ins = await escribir(r.nuevos.map(({ _rubro, _ven, ...f }) => f),
                                 ['codigo_cliente', 'nombre', 'direccion', 'tipo', 'vendedor_id', 'activo'], t0);
      const act = await escribir(r.cambios.map(c => c.fila),
                                 ['codigo_cliente', 'nombre', 'direccion', 'tipo', 'vendedor_id'], t0);
      informe.escrito = { insertados: ins.ok, actualizados: act.ok, errores: ins.errores.concat(act.errores) };
    }
    informe.ms = Date.now() - t0;
    return json(200, informe);
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e), ms: Date.now() - t0 });
  }
};

exports.calcular = calcular;   // para probar el cálculo sin conectarse a CUBO
