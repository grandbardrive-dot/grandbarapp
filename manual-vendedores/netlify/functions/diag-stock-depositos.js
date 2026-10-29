// ============================================================
//  DIAGNÓSTICO (temporal, 29/10/2026) · ¿Córdoba da el stock por depósito?
//  Para el depósito de San Luis (Cristian): hoy stock_sistema guarda un solo
//  número por artículo (DtTabla ARTICULO, st_stock). Acá se prueba, SOLO LECTURA:
//   - las dos empresas (9999 / 0001 / la del entorno): ¿cambia st_stock?
//   - DtTabla ARTICULO con un parámetro de depósito: ¿cambia st_stock?
//   - nombres de tabla y métodos IS3 que podrían traer depósitos o stock.
//  Protegida con una clave de un solo uso (se compara su sha256).
//  No devuelve tokens ni el "log" de AIKON. BORRAR cuando terminemos.
// ============================================================
const crypto = require('crypto');
const CLAVE_SHA = 'bc89f2d29bf5215fffe9891f5cedaee427b2b5e98c7265bc65c9adde49729b3d';
const SKUS = ['02060101', '01290611', '01290612', '01290601', '02010101', '01010203'];

async function aikon(url, body, ms = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = { _raw: text.slice(0, 200) }; }
    return { status: r.status, j };
  } catch (e) { return { status: 0, j: { _error: (e && e.message) || String(e) } }; }
  finally { clearTimeout(t); }
}

async function login(empresa) {
  const cuenta = process.env.AIKON_CUENTA;
  const mgr = process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const r1 = await aikon(mgr, { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String((r1.j && r1.j.retorno) || '').replace(/\/+$/, '');
  if (!urlCuenta) return { error: 'sin URL de cuenta' };
  const r2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa });
  const token = r2.j && r2.j.token && r2.j.token.Codigo;
  if (!token) return { error: 'ObtenerToken falló para empresa ' + empresa };
  return { urlCuenta, cuenta, token };
}

function listaDe(o) {
  if (!o) return null;
  if (Array.isArray(o)) return o;
  const l = o.lista || o.tabla || o.Tabla || o.datos || o.Datos || o.registros || o.Registros || o.retorno || o.data;
  return Array.isArray(l) ? l : null;
}
const arrDe = j => listaDe(j) || listaDe(j && j.resultado) || [];
const sku8 = c => { const d = String(c || '').replace(/\D/g, ''); return d.length === 6 ? d + '00' : d.padStart(8, '0').slice(0, 8); };

// Saca cualquier rastro del token y los "log" de AIKON.
function limpio(o, token) {
  const s = JSON.stringify(o, (k, v) => (k === 'log' || k === 'token' || k === 'Codigo') ? '[oculto]' : v);
  return JSON.parse(token ? s.split(token).join('[oculto]') : s);
}

async function stockDe(ses, extra = {}) {
  const r = await aikon(ses.urlCuenta + '/IS3/DtTabla', { cuenta: ses.cuenta, token: ses.token, tabla: 'ARTICULO', ...extra }, 90000);
  const arr = arrDe(r.j);
  const m = {};
  arr.forEach(it => { const s = sku8(it.ar_codigo); if (SKUS.includes(s)) m[s] = (m[s] || 0) + (Number(it.st_stock) || 0); });
  const repetidos = arr.length - new Set(arr.map(it => it.ar_codigo)).size;
  return { status: r.status, estado: r.j && r.j.resultado && r.j.resultado.estado, filas: arr.length, repetidos, muestra: m };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const q = (event && event.queryStringParameters) || {};
  const h = crypto.createHash('sha256').update(String(q.key || '')).digest('hex');
  if (h !== CLAVE_SHA) return { statusCode: 403, headers, body: '{"error":"no"}' };
  const out = o => ({ statusCode: 200, headers, body: JSON.stringify(o, null, 1) });
  const modo = q.modo || 'empresas';
  const res = { empresaEntorno: process.env.AIKON_EMPRESA || null, modo };
  try {
    const ses = await login(process.env.AIKON_EMPRESA);
    if (ses.error) return out({ ...res, error: ses.error });

    if (modo === 'empresas') {
      // Stock de unos SKUs conocidos con cada empresa.
      res.porEmpresa = {};
      for (const emp of [...new Set([process.env.AIKON_EMPRESA, '9999', '0001', '0002', '1000'])]) {
        const s = await login(emp);
        res.porEmpresa[emp] = s.error ? { error: s.error } : await stockDe(s);
      }
      return out(limpio(res, ses.token));
    }

    if (modo === 'parametros') {
      // ¿ARTICULO acepta un filtro de depósito?
      res.base = await stockDe(ses);
      res.conParam = {};
      for (const [k, v] of [['deposito', '1'], ['deposito', '2'], ['de_codigo', '2'], ['Deposito', '2'], ['sucursal', '2'], ['filtro', "de_codigo=2"]]) {
        res.conParam[k + '=' + v] = await stockDe(ses, { [k]: v });
      }
      return out(limpio(res, ses.token));
    }

    if (modo === 'tablas') {
      const tablas = ['DEPOSITO', 'DEPOSITOS', 'STOCK', 'STOCKS', 'STOCKDEPOSITO', 'STOCK_DEPOSITO', 'STOCKDEP', 'ARTICULO_STOCK',
        'ARTICULOSTOCK', 'STOCKARTICULO', 'SUCURSAL', 'SUCURSALES', 'EMPRESA', 'EMPRESAS', 'ALMACEN', 'ALMACENES', 'UBICACIONES', 'MOVSTOCK'];
      res.tablas = {};
      for (const t of tablas) {
        const r = await aikon(ses.urlCuenta + '/IS3/DtTabla', { cuenta: ses.cuenta, token: ses.token, tabla: t }, 40000);
        const arr = arrDe(r.j);
        res.tablas[t] = arr.length
          ? { filas: arr.length, columnas: Object.keys(arr[0] || {}), ejemplo: arr.slice(0, 3) }
          : { status: r.status, estado: r.j && r.j.resultado && r.j.resultado.estado, error: !!(r.j && r.j.resultado && /invalid/i.test(String(r.j.resultado.log || ''))) ? 'tabla invalida' : undefined };
      }
      return out(limpio(res, ses.token));
    }

    if (modo === 'metodos') {
      const metodos = ['ListarDepositos', 'ListarStock', 'ListarStockArticulos', 'ListarStockDeposito', 'ObtenerStock', 'ObtenerStockArticulo',
        'ListarArticulos', 'ObtenerArticulo', 'ListarSucursales', 'ListarEmpresas', 'StockArticulo', 'ConsultarStock'];
      res.metodos = {};
      for (const m of metodos) {
        const r = await aikon(ses.urlCuenta + '/IS3/' + m, { cuenta: ses.cuenta, token: ses.token, codigo: '02060101', articulo: '02060101' }, 40000);
        const arr = arrDe(r.j);
        res.metodos[m] = {
          status: r.status,
          claves: r.j && typeof r.j === 'object' ? Object.keys(r.j).slice(0, 15) : null,
          estado: r.j && r.j.resultado && r.j.resultado.estado,
          filas: arr.length || undefined,
          columnas: arr[0] ? Object.keys(arr[0]) : undefined,
          ejemplo: arr.length ? arr.slice(0, 2) : (r.status === 200 ? JSON.stringify(r.j).slice(0, 300) : undefined),
        };
      }
      return out(limpio(res, ses.token));
    }
    if (modo === 'deps') {
      // DtTabla STOCK: una fila por depósito y artículo (de_codigo, ar_codigo, st_stock).
      const r = await aikon(ses.urlCuenta + '/IS3/DtTabla', { cuenta: ses.cuenta, token: ses.token, tabla: 'STOCK' }, 90000);
      const arr = arrDe(r.j);
      const art = await stockDe(ses);
      const deps = {};
      for (const it of arr) {
        const d = String(it.de_codigo);
        const x = deps[d] || (deps[d] = { filas: 0, conStock: 0, negativos: 0, unidades: 0, muestra: {} });
        const n = Number(it.st_stock) || 0;
        x.filas++; if (n > 0) x.conStock++; if (n < 0) x.negativos++; x.unidades += n;
        const s = sku8(it.ar_codigo);
        if (SKUS.includes(s)) x.muestra[s] = n;
      }
      // ¿ARTICULO.st_stock = suma de depósitos o uno solo?
      const suma = {}; arr.forEach(it => { const s = sku8(it.ar_codigo); if (SKUS.includes(s)) suma[s] = (suma[s] || 0) + (Number(it.st_stock) || 0); });
      res.filas = arr.length; res.columnas = arr[0] ? Object.keys(arr[0]) : [];
      res.depositos = deps; res.sumaDepositos = suma; res.articuloStStock = art.muestra;
      return out(limpio(res, ses.token));
    }
    return out({ ...res, error: 'modo inválido' });
  } catch (e) {
    return out({ ...res, error: String((e && e.message) || e).slice(0, 200) });
  }
};
