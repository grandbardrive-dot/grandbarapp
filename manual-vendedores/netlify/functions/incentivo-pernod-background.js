// ============================================================
//  GrandBar Hub · Function · incentivo-pernod-background
//   Recalcula el incentivo Pernod Ricard Q4 (CCC) leyendo el ERP (empresa 3333
//   "CUBOS", solo lectura) y escribe el resultado en incentivos_snapshots
//   (PR_Q4_2026) para que lo muestre la sección Incentivos del portal.
//
//   Porta el algoritmo validado por JP Sepúlveda (doc de traspaso 06/11/2026):
//   - 6 objetivos marca×canal, piso 3 botellas (Buhero 4), netas de NC.
//   - Promo 5+1 / 3+1 por comprobante (K=5; 3 para Chivas y Buhero).
//   - Canal por tipo de cliente del ERP; San Luis por empresa del comprobante.
//   - Exclusiones R6; mayoristas suman a la marca pero no al vendedor (R7/R8).
//
//   Es BACKGROUND (hasta 15 min). Cachea el detalle de comprobantes en la tabla
//   incentivo_comprobantes_cache (un comprobante emitido no cambia). Si no llega
//   a bajar todos en una corrida, deja la caché tibia y NO pisa el snapshot:
//   la próxima corrida termina. Solo escribe el snapshot cuando el corte está completo.
//
//   Disparo: cron diario (06:00 ART) o manual GET ?key=SYNC_SECRET.
//   Env: AIKON_CUENTA/_PWD/_USUARIO/_PASS (o CS_* equivalentes), CS_EMPRESA (def 3333),
//        AIKON_MANAGER_URL, HUB_SERVICE_ROLE, SYNC_SECRET, opcional PR_BUDGET_MS.
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

const DESDE = '01/10/2026';
const hoyDDMM = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); };
const hoyISO = () => new Date().toISOString().slice(0, 10);

const SL_EMPRESAS = new Set(['0004', '0005', '0006', '0010', '1000']);
const ON = new Set(['Bares', 'Restaurant', 'Disco', 'Hotel', 'Cafeteria', 'Catering', 'Evento', 'On Trade']);
const VIN = new Set(['Vinoteca', 'Tienda de Bebidas']);
// (marca, canal) -> [id, nombre, meta, piso, K]
const OBJ = {
  'MALIBU|ON':    ['MAL_ON',  'Malibu · On Premise',             150, 3, 5],
  'BEEFEATER|ON': ['BEE_ON',  'Beefeater · On Premise',          140, 3, 5],
  'BEEFEATER|VIN':['BEE_VIN', 'Beefeater · Vinotecas',            70, 3, 5],
  'RAMAZZOTTI|OSL':['RAM_OSL','Ramazzotti · Off San Luis',        40, 3, 5],
  'BUHERO|OSL':   ['BUH_OSL', 'Buhero Negro 450 · Off San Luis',  30, 4, 3],
  'CHIVAS|VIN':   ['CHI_VIN', 'Chivas · Vinotecas',               25, 3, 3],
};
const EQUIPOS = {
  'On Premise':   [['MAL_ON', 'BEE_ON'], ['Angela Laurito', 'Nicolas Garcia', 'Pablo Cofano', 'Carolina Heluani', 'Juan Pablo Mollar', 'Martin Juarez', 'Lucas Juarez']],
  'Vinotecas':    [['BEE_VIN', 'CHI_VIN'], ['Diego Sebastianelli', 'Facundo Ojer', 'Juan Pablo Franso', 'Exequiel Gimenez', 'Franco Fernandez', 'Jonathan Guigue', 'Daniel Perez']],
  'Off San Luis': [['RAM_OSL', 'BUH_OSL'], ['Franco Fernandez', 'Jonathan Guigue', 'Daniel Perez']],
};

const env = (...ks) => { for (const k of ks) { if (process.env[k]) return process.env[k]; } return ''; };
const str = v => (v == null ? '' : String(v)).trim();
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function marcaDe(desc, cod) {
  const d = String(desc || '').toLowerCase();
  cod = String(cod || '');
  if (!cod.startsWith('0201') || d.includes('promo') || cod === '02010931') return null;
  if (d.includes('malibu')) return 'MALIBU';
  if (d.includes('beefeater')) return 'BEEFEATER';
  if (d.includes('chivas')) return 'CHIVAS';
  if (d.includes('ramazzotti rosato')) return 'RAMAZZOTTI';
  if (d.includes('buhero') && d.includes('450')) return 'BUHERO';
  return null;
}
function bonifEfectiva(txt) {
  const p = String(txt == null ? '' : txt).match(/[\d.]+/g) || [];
  let r = 1; for (const x of p) r *= (1 - Number(x) / 100);
  return 100 * (1 - r);
}

async function aikon(url, body, ms = 60000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return { _raw: txt.slice(0, 200) }; }
  } catch (e) { return { _error: (e && e.message) || String(e) }; }
  finally { clearTimeout(t); }
}
// DtTabla / ListarMovimientos devuelven data|lista|retorno|array según el método.
const listaDe = j => (Array.isArray(j) ? j : (j && (j.data || j.lista || j.retorno)) || []);

async function login() {
  const cuenta = env('CS_CUENTA', 'AIKON_CUENTA');
  if (!cuenta) throw new Error('Faltan credenciales del ERP (CS_CUENTA / AIKON_CUENTA).');
  const managerUrl = env('AIKON_MANAGER_URL') || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const j1 = await aikon(managerUrl, { Cuenta: cuenta, CuentaPwd: env('CS_CUENTA_PWD', 'AIKON_CUENTA_PWD') });
  const url = String((j1 && j1.retorno) || '').replace(/\/+$/, '') + '/';
  if (!j1 || !j1.retorno) throw new Error('CuentaURL no devolvió URL: ' + JSON.stringify(j1).slice(0, 160));
  const empresa = env('CS_EMPRESA') || '3333';
  const j2 = await aikon(url + 'IS3/ObtenerToken', { cuenta, usuario: env('CS_USUARIO', 'AIKON_USUARIO') || 'CS', 'contraseña': env('CS_PASS', 'AIKON_PASS') || '', empresa });
  const token = j2 && j2.token && j2.token.Codigo;
  if (!token) throw new Error('ObtenerToken (empresa ' + empresa + ') falló: ' + JSON.stringify(j2).slice(0, 160));
  return { cuenta, url, token };
}

exports.handler = async (event) => {
  const log = { paso: 'inicio' };
  try {
    const secret = process.env.SYNC_SECRET;
    const q = (event && event.queryStringParameters) || {};
    if (secret && (q.key || '') !== secret) return { statusCode: 401, body: 'Falta ?key=' };

    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return { statusCode: 500, body: 'Falta HUB_SERVICE_ROLE' };
    const hub = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    const { cuenta, url, token } = await login();
    const B = { cuenta, token };
    const post = (m, body, ms) => aikon(url + 'IS3/' + m, { ...B, ...body }, ms);

    // 1) Maestro de artículos → sku -> marca
    log.paso = 'articulos';
    const AR = {};
    for (const tb of ['ARTICULO', 'ARTICULO_NO_HABILITADO']) {
      const j = await post('DtTabla', { tabla: tb }, 90000);
      for (const x of listaDe(j)) {
        const cod = str(x.ar_codigo || x.AR_CODIGO);
        const desc = str(x.ar_descri || x.AR_DESCRI);
        const m = marcaDe(desc, cod);
        if (m) AR[cod] = m;
      }
    }
    if (!Object.keys(AR).length) throw new Error('No se mapeó ningún SKU de las 5 marcas (revisar acceso a empresa ' + (env('CS_EMPRESA') || '3333') + ').');

    // 2) Clientes y vendedores
    log.paso = 'clientes';
    const CL = {}; for (const c of listaDe(await post('DtTabla', { tabla: 'CLIENTES_TODOS' }, 120000))) CL[str(c.cl_codigo)] = c;
    const VE = {}; for (const v of listaDe(await post('DtTabla', { tabla: 'VENDEDORES' }, 90000))) VE[str(v.ven_codigo)] = str(v.ven_nombre);

    // 3) Movimientos por SKU (01/10 → hoy, o hasta ?hasta=dd/mm/yyyy para validar un corte)
    log.paso = 'movimientos';
    const HASTA = (q.hasta && /^\d{2}\/\d{2}\/\d{4}$/.test(q.hasta)) ? q.hasta : hoyDDMM();
    const movs = [];
    for (const cod of Object.keys(AR)) {
      const j = await post('ListarMovimientosArticulos', { FechaDesde: DESDE, FechaHasta: HASTA, OrigenMov: 'Ventas', ArCodigo: cod }, 90000);
      for (const x of listaDe(j)) movs.push(x);
    }

    // 4) Agregado por (cliente|marca) + claves de comprobante a bajar
    const agg = new Map();  // ckey -> {fact,free,free_ok,dev,ven:{},sl}
    const A = (c, m) => { const k = c + '|' + m; let o = agg.get(k); if (!o) { o = { fact: 0, free: 0, free_ok: 0, dev: 0, ven: {}, sl: false }; agg.set(k, o); } return o; };
    const claves = new Set();
    for (const x of movs) {
      const c = str(x.CodigoResponsable), m = AR[str(x.Articulo)];
      if (!m) continue;
      const o = A(c, m); if (SL_EMPRESAS.has(str(x.Empresa))) o.sl = true;
      if (num(x.Cantidad) > 0) o.dev += num(x.Cantidad);  // NC (entrada)
      else claves.add([str(x.ComprobanteCodigo), str(x.ComprobanteSucursal), str(x.ComprobanteNumero), str(x.ComprobanteTipo)].join('|'));
    }

    // 5) Detalle de comprobantes (con caché en Supabase). De a uno, con pausa.
    log.paso = 'comprobantes';
    const cacheRows = await (await hub('incentivo_comprobantes_cache?select=k,d')).json();
    const cache = {}; (Array.isArray(cacheRows) ? cacheRows : []).forEach(r => { cache[r.k] = r.d; });
    const faltan = [...claves].filter(k => !(k in cache));
    const start = Date.now(); const BUDGET = Number(process.env.PR_BUDGET_MS || 720000);
    const nuevos = [];
    let cortado = false;
    for (const key of faltan) {
      if (Date.now() - start > BUDGET) { cortado = true; break; }
      const [cod, suc, numc, tip] = key.split('|');
      const j = await post('ObtenerComprobante', { Codigo: cod, Sucursal: suc, Numero: numc, Tipo: tip }, 30000);
      const C = (j && (j.Comprobante || j.comprobante)) || null;
      if (!C) { cache[key] = { cl: '', ven: '', l: [] }; nuevos.push({ k: key, d: cache[key] }); continue; }
      const det = (C.Detalle || C.detalle || []).filter(d => AR[str(d.Articulo)]);
      cache[key] = { cl: str(C.ClienteCodigo), ven: str(C.VendedorCodigo || C.vendedorCodigo), l: det.map(d => [str(d.Articulo), num(d.Cantidad), String(d.BonificacionPorcentaje == null ? '' : d.BonificacionPorcentaje)]) };
      nuevos.push({ k: key, d: cache[key] });
      await new Promise(r => setTimeout(r, 150));  // de a uno: en paralelo el servidor corta
    }
    // Persistir los nuevos en la caché (en tandas)
    for (let i = 0; i < nuevos.length; i += 200) {
      await hub('incentivo_comprobantes_cache?on_conflict=k', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(nuevos.slice(i, i + 200)) });
    }
    if (cortado) return { statusCode: 200, body: JSON.stringify({ ok: true, incompleto: true, nota: 'Caché tibia; faltan ' + (faltan.length - nuevos.length) + ' comprobantes. La próxima corrida termina. No se pisó el snapshot.', bajados: nuevos.length }) };

    // 6) Acumular facturadas/sin cargo/promo por (cliente|marca) desde la caché
    for (const key of claves) {
      const d = cache[key]; if (!d || !d.l || !d.l.length) continue;
      const porMarca = {};
      for (const [art, cant, bon] of d.l) {
        const m = AR[art]; if (!m) continue;
        const pm = porMarca[m] || (porMarca[m] = [0, 0]);
        if (bonifEfectiva(bon) >= 99.9) pm[1] += cant; else pm[0] += cant;
      }
      for (const m of Object.keys(porMarca)) {
        const [f, g] = porMarca[m];
        const o = A(d.cl, m);
        o.fact += f; o.free += g;
        o.ven[d.ven] = (o.ven[d.ven] || 0) + f + g;
        const K = (m === 'CHIVAS' || m === 'BUHERO') ? 3 : 5;
        if (g >= 1 && f >= K * g) o.free_ok += g;
      }
    }

    // 7) Filas por cliente×objetivo
    const filas = [];
    for (const [ckey, o] of agg) {
      const [c, m] = ckey.split('|');
      const cli = CL[c] || {}; const tipo = str(cli.cl_tipocliente); const nom = str(cli.cl_nombre);
      if (/consumidor final/i.test(nom) || str(cli.ven_codigo) === '034' || c === '00718') continue;
      if (/distribuidor|mayorista/i.test(tipo)) continue;
      const canal = ON.has(tipo) ? 'ON' : (VIN.has(tipo) ? 'VIN' : ((tipo === 'Autoservicio' && o.sl) ? 'OSL' : null));
      const okey = m + '|' + canal;
      if (!OBJ[okey]) continue;
      const [oid, , meta, piso, K] = OBJ[okey];
      const netas = Math.max(0, o.fact - o.dev);
      const promo = o.free_ok >= 1 && netas >= K * o.free_ok;
      const bot = netas + ((m === 'BUHERO' && promo) ? o.free_ok : 0);
      const venCod = Object.keys(o.ven).length ? Object.keys(o.ven).reduce((a, b) => (o.ven[b] > o.ven[a] ? b : a)) : '';
      filas.push({ codigo: c, cliente: nom, objetivo: oid, vendedor: VE[venCod] || '', botellas: bot, sin_cargo: o.free, promo: promo ? (K === 3 ? '3+1' : '5+1') : null, cuenta: bot >= piso, estado: bot >= piso ? 'Cuenta' : (netas > 0 ? 'Cerca' : 'Sin botellas válidas'), faltan: Math.max(0, piso - bot) });
    }

    // 8) Agregar por objetivo y por vendedor (equipo)
    const objetivos = Object.keys(OBJ).map(k => {
      const [oid, nombre, meta, piso] = OBJ[k];
      const f = filas.filter(x => x.objetivo === oid);
      const logrado = f.filter(x => x.cuenta).length;
      return { id: oid, nombre, meta, piso, logrado, faltan: Math.max(0, meta - logrado), con_promo: f.filter(x => x.cuenta && x.promo).length, cerca: f.filter(x => x.estado === 'Cerca').length };
    });
    const vmap = {};
    for (const eq of Object.keys(EQUIPOS)) {
      const [oids, nombres] = EQUIPOS[eq];
      for (const v of nombres) {
        const e = vmap[v] || (vmap[v] = { vendedor: v, equipos: [], objetivo_individual: null, por_objetivo: [], logrado_total: 0, clientes: [] });
        e.equipos.push(eq);
        for (const oid of oids) {
          const mios = filas.filter(x => x.objetivo === oid && x.vendedor === v && x.cuenta);
          e.por_objetivo.push({ id: oid, logrados: mios.length });
          e.clientes = e.clientes.concat(filas.filter(x => x.objetivo === oid && x.vendedor === v));
        }
      }
    }
    const vendedores = Object.values(vmap).map(e => ({ ...e, logrado_total: e.por_objetivo.reduce((a, x) => a + x.logrados, 0) }));

    // 9) Escribir el snapshot (incentivo = PR_Q4_2026, o ?incentivo=... para una validación aparte)
    log.paso = 'snapshot';
    const incentivoId = q.incentivo || 'PR_Q4_2026';
    const corte = HASTA.split('/').reverse().join('-');
    const data = { corte, periodo: { desde: '2026-10-01', hasta: corte }, nombre: 'Q4 2026 · Clientes con compra', detalle: 'Clientes con compra (CCC) en 5 marcas y 3 canales. Premio trimestral de Pernod Ricard.', objetivos, vendedores };
    const up = await hub('incentivos_snapshots?on_conflict=incentivo', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ incentivo: incentivoId, corte, data, updated_at: new Date().toISOString() }) });
    if (!up.ok) throw new Error('No pude escribir el snapshot: ' + (await up.text()).slice(0, 160));

    const total = objetivos.reduce((a, o) => a + o.logrado, 0);
    return { statusCode: 200, body: JSON.stringify({ ok: true, corte, total_logrado: total, objetivos: objetivos.map(o => ({ id: o.id, logrado: o.logrado, con_promo: o.con_promo, cerca: o.cerca })) }, null, 1) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, paso: log.paso, error: (e && e.message) || String(e) }) };
  }
};
