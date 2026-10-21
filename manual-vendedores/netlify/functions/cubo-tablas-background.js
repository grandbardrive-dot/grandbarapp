// ============================================================
//  TEMPORAL (21/10/2026) · ¿Qué tiene CUBO de finanzas?
//  Prueba si el ERP deja leer caja, cheques, proveedores y órdenes de compra, para
//  dejar de depender de las planillas que Administración carga a mano en Drive.
//  Solo lectura. Guarda SOLO nombres de tablas, nombres de columnas y cantidad de
//  filas (ningún dato) en tmp_cubo_tablas del Portal. Corre UNA vez y solo si en esa
//  tabla hay una fila tipo 'orden' (la carga Desarrollo desde la base); la consume al
//  arrancar. Se borra apenas se lee el resultado.
//  Env: AIKON_*, HUB_SERVICE_ROLE.
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

const TABLAS = [
  // control (sabemos que existe) y la lista de tablas del sistema
  'CLIENTES', 'INFORMATION_SCHEMA.TABLES', 'sys.tables',
  // caja, bancos y valores
  'CAJAS', 'CAJA', 'MOVCAJA', 'MOVCAJAS', 'MOVIMIENTOSCAJA', 'TESORERIA', 'VALORES', 'CHEQUES', 'CHEQUESTERCEROS', 'CHEQUESPROPIOS',
  'CARTERA', 'CARTERAVALORES', 'BANCOS', 'CUENTASBANCARIAS', 'MOVBANCOS', 'CUPONES', 'TARJETAS',
  // proveedores, compras y pagos
  'PROVEEDORES', 'CTACTEPROVEEDORES', 'CTACTEPROV', 'CUENTASPROVEEDORES', 'SALDOSPROVEEDORES', 'COMPRAS', 'COMPROBANTESCOMPRA',
  'FACTURASCOMPRA', 'ORDENESPAGO', 'ORDENPAGO', 'PAGOS', 'RECIBOS',
  // órdenes de compra
  'ORDENESCOMPRA', 'ORDENCOMPRA', 'OCOMPRA', 'PEDIDOSPROVEEDORES', 'PEDIDOSCOMPRA',
  // contabilidad
  'ASIENTOS', 'MAYOR', 'LIBROMAYOR', 'PLANCUENTAS', 'CUENTASCONTABLES', 'MOVCONTABLES',
];
// La primera vuelta: todos dieron 404 salvo ListarProveedores, que tardó más de 25 s.
const METODOS = ['ListarProveedores'];

async function aikon(url, body, ms) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms || 25000);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const x = await r.text();
    let j = null; try { j = JSON.parse(x); } catch (e) {}
    return { st: r.status, j, raw: j ? null : x.slice(0, 160), ms: Date.now() - t0 };
  } catch (e) { return { st: 0, err: (e && e.message) || String(e), ms: Date.now() - t0 }; }
  finally { clearTimeout(t); }
}
// Solo la forma de la respuesta: cuántas filas y qué columnas. Ningún valor.
function forma(r) {
  if (!r.j) return { existe: false, filas: null, columnas: null, nota: r.err || ('http ' + r.st + ' ' + (r.raw || '')).slice(0, 160) };
  const j = r.j;
  // DtTabla responde { resultado, data } (21/10/2026).
  const lista = Array.isArray(j.data) ? j.data : Array.isArray(j.lista) ? j.lista : Array.isArray(j.retorno) ? j.retorno : Array.isArray(j) ? j : null;
  const res = j.resultado != null ? ('resultado: ' + JSON.stringify(j.resultado)).slice(0, 160) : null;
  if (lista) return { existe: true, filas: lista.length, columnas: lista[0] && typeof lista[0] === 'object' ? Object.keys(lista[0]).slice(0, 80) : [], nota: res };
  // Error del ERP: el mensaje dice si la tabla no existe (sin datos).
  if (res) return { existe: false, filas: null, columnas: Object.keys(j).slice(0, 20), nota: res };
  const msg = [j.mensaje, j.Mensaje, j.error, j.Error, j.estado && j.estado.mensaje].filter(Boolean).join(' ').slice(0, 160) || ('claves: ' + Object.keys(j).join(',')).slice(0, 160);
  return { existe: false, filas: null, columnas: Object.keys(j).slice(0, 20), nota: msg };
}

exports.handler = async (event) => {
  const srole = process.env.HUB_SERVICE_ROLE;
  if (!srole) return;
  // Solo si hay una orden pendiente, y se consume (una sola corrida).
  const cab = { apikey: srole, Authorization: 'Bearer ' + srole };
  const ord = await fetch(HUB_URL + '/rest/v1/tmp_cubo_tablas?tipo=eq.orden&select=id&limit=1', { headers: cab }).then(r => (r.ok ? r.json() : [])).catch(() => []);
  if (!Array.isArray(ord) || !ord.length) return;
  const del = await fetch(HUB_URL + '/rest/v1/tmp_cubo_tablas?id=eq.' + ord[0].id, { method: 'DELETE', headers: Object.assign({ Prefer: 'return=representation' }, cab) }).then(r => (r.ok ? r.json() : [])).catch(() => []);
  if (!Array.isArray(del) || !del.length) return;   // otra corrida la tomó primero
  const guardar = fila => fetch(HUB_URL + '/rest/v1/tmp_cubo_tablas', { method: 'POST', headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(fila) }).catch(() => {});

  const cuenta = process.env.AIKON_CUENTA;
  const j1 = await aikon(process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL', { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String((j1.j && j1.j.retorno) || '').replace(/\/+$/, '');
  const empresas = (process.env.AIKON_EMPRESAS || `${process.env.AIKON_EMPRESA || '9999'},0001`).split(',').map(e => e.trim()).filter(Boolean);
  const ctx = [];
  for (const empresa of empresas) {
    const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa });
    const token = j2.j && j2.j.token && j2.j.token.Codigo;
    await guardar({ empresa, tipo: 'login', nombre: 'ObtenerToken', existe: !!token, nota: token ? null : 'sin token', ms: j2.ms });
    if (token) ctx.push({ empresa, token });
  }
  if (!ctx.length) return;

  // 1) Tipos de comprobante de ayer, por empresa (¿aparecen compras, OC, órdenes de pago?).
  const ayer = new Date(Date.now() - 27 * 3600000);
  const f = String(ayer.getUTCDate()).padStart(2, '0') + '/' + String(ayer.getUTCMonth() + 1).padStart(2, '0') + '/' + ayer.getUTCFullYear();
  for (const c of ctx) {
    const r = await aikon(urlCuenta + '/IS3/ListarComprobantes', { cuenta, token: c.token, FechaDesde: f, FechaHasta: f }, 40000);
    const lista = r.j && (Array.isArray(r.j.lista) ? r.j.lista : Array.isArray(r.j) ? r.j : null);
    const tipos = {};
    (lista || []).forEach(x => { const t = String(x.Codigo || '').slice(0, 3).toUpperCase() || '?'; tipos[t] = (tipos[t] || 0) + 1; });
    await guardar({ empresa: c.empresa, tipo: 'comprobantes', nombre: 'ListarComprobantes ' + f, existe: !!lista, filas: lista ? lista.length : null,
      columnas: Object.entries(tipos).map(([t, n]) => t + ':' + n), nota: lista ? null : forma(r).nota, ms: r.ms });
  }
  // 2) Métodos del WebApi.
  for (const m of METODOS) {
    const r = await aikon(urlCuenta + '/IS3/' + m, { cuenta, token: ctx[0].token }, 60000);
    const fo = forma(r);
    await guardar(Object.assign({ empresa: ctx[0].empresa, tipo: 'metodo', nombre: m, ms: r.ms }, fo, { nota: (fo.nota || '') + (r.st && r.st !== 200 ? ' [http ' + r.st + ']' : '') || null }));
  }
  // 3) Tablas crudas (DtTabla), una por vez para no cargar el ERP.
  for (const t of TABLAS) {
    const r = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token: ctx[0].token, tabla: t }, 25000);
    const fo = forma(r);
    // La lista de tablas del sistema: se guardan SOLO los nombres de las tablas.
    if (/tables/i.test(t) && r.j && Array.isArray(r.j.data)) {
      const nombres = r.j.data.map(x => x && (x.TABLE_NAME || x.name || x.NAME)).filter(Boolean).map(String).sort();
      fo.columnas = nombres.slice(0, 3000);
    }
    await guardar(Object.assign({ empresa: ctx[0].empresa, tipo: 'tabla', nombre: t, ms: r.ms }, fo));
  }
  await guardar({ tipo: 'fin', nombre: 'listo' });
};
