// ============================================================
//  GrandBar Hub · Function · kaf  (19/10/2026)
//  Paneles de los KAF: representantes de una marca en la calle (Facu Llaver,
//  Campari). Los arma Juan Pablo Sepúlveda (Trade Marketing, rol torneo).
//
//  KAF (rol kaf), en kaf.html:
//   - Clientes de su canal (Restó, Bares, Discos, Eventos…) con el vendedor de cada
//     uno, la cobertura del Plan Campari 5T, los acuerdos Campari y lo que compra
//     de la marca (CUBO: ventas_cliente). De ahí salen las oportunidades.
//   - Marca la visita (día y hora), carga evidencia en PDV, Perfect Serve / Perfect
//     Store, capacitaciones y presupuestos, y pide materiales (le llega a Andrea).
//   - Clientes nuevos del mes: nuevo de la marca (primera compra de la marca) y
//     nuevo de GrandBar (cuenta dada de alta en CUBO, sin compras antes).
//  Trade Marketing (trade-kaf.html): elige qué marca y qué secciones tiene cada
//  KAF, le carga objetivos (del mes y por cliente) y los modelos de Perfect Serve
//  y Perfect Store, ve todo lo que carga y baja las visitas.
//  Andrea (facturación, equipo-panel.html): los pedidos de materiales, con remito.
//
//  Tablas kaf_* y carpeta kaf de la base del Portal: RLS sin reglas, todo pasa por
//  acá (kaf-setup.sql). Las ventas, los clientes y los materiales se leen del Manual.
//  Env: HUB_SERVICE_ROLE (opcional MANUAL_SERVICE_ROLE).
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = process.env.MANUAL_SERVICE_ROLE || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
// Las mismas planillas que lee la visita (Spirits > Planes Campari).
const SHEET_5T = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQqUyLV4D_AsvxDat8KRQ270n7FYsgUlWSlH-HQ1F3zLwCYuOx6vXYS9CUY3tIyGw/pub?output=csv';
const SHEET_ACUERDOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT0lGUmcLL8FqVNdIDce-lIt6ZRHAjtfxJVzpg4W67y8NBnHdnn3gtBTtdhAYwIK5AVVe9sTXqolBPy/pub?output=csv';
const MARCAS_5T = [['aperol', 'Aperol'], ['bulldog', 'Bulldog'], ['campari', 'Campari'], ['cinzano', 'Cinzano'], ['cynar', 'Cynar'], ['skyy infussion', 'Skyy Infusions']];
const BUCKET = 'kaf';
const VENTAS_DESDE = '2025-01-01';             // ventas_cliente arranca el 02/01/2025
// Andrea (facturación) emite el remito de los pedidos de materiales.
const MATERIALES_A = 'facturacion@grandbar.com.ar';

const VEN_TODO = ['torneo', 'desarrollo', 'diseno', 'direccion', 'admin', 'duenio'];
const ARMAN = ['torneo', 'desarrollo', 'diseno'];
const VEN_PLATA = VEN_TODO;                    // el KAF ve unidades; los montos, solo GrandBar

const { pushA } = require('./_notificar');
const { SAN_LUIS_CODIGOS } = require('./_equipo');

const TIPOS_ON = ['restaurante', 'bar', 'disco', 'evento', 'hotel'];
const TIPOS_OK = TIPOS_ON.concat(['vinoteca', 'autoservicio', 'tienda de bebidas', 'mayorista', 'otros']);
const SECCIONES = [
  { k: 'clientes', t: 'Clientes', fija: true },
  { k: 'visitas', t: 'Mis visitas', fija: true },
  { k: 'nuevos', t: 'Clientes nuevos' },
  { k: 'evidencia', t: 'Evidencia en PDV' },
  { k: 'perfect_serve', t: 'Perfect Serve', canal: 'on' },
  { k: 'perfect_store', t: 'Perfect Store', canal: 'off' },
  { k: 'capacitacion', t: 'Capacitaciones' },
  { k: 'materiales', t: 'Materiales' },
  { k: 'presupuesto', t: 'Presupuestos', canal: 'on' },
];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const REG_TIPOS = ['evidencia', 'perfect_serve', 'perfect_store', 'capacitacion', 'presupuesto'];
const REG_NOMBRE = { evidencia: 'Evidencia en PDV', perfect_serve: 'Perfect Serve', perfect_store: 'Perfect Store', capacitacion: 'Capacitación', presupuesto: 'Presupuesto' };
// Qué datos guarda cada registro: [campo, tipo, largo]. Lo demás se descarta.
const REG_CAMPOS = {
  evidencia: [['marca', 't', 80], ['competencia', 'b'], ['calificacion', ['bien', 'mal']], ['comentario', 't', 1000]],
  perfect_serve: [['modelo_id', 'u'], ['trago', 't', 120], ['marca', 't', 80], ['medida_ml', 'n'], ['cristaleria', 't', 160], ['garnish', 't', 160], ['precio_carta', 'n'], ['cumple', ['si', 'parcial', 'no']], ['comentario', 't', 1000]],
  perfect_store: [['modelo_id', 'u'], ['surtido', 't', 1000], ['precios', 't', 600], ['exhibicion', 't', 400], ['cumple', ['si', 'parcial', 'no']], ['comentario', 't', 1000]],
  capacitacion: [['tema', 't', 200], ['marcas', 't', 200], ['participantes', 'n'], ['nombres', 't', 1000], ['comentario', 't', 1000]],
  presupuesto: [['concepto', 't', 200], ['monto', 'n'], ['descripcion', 't', 2000]],
};
const MOD_CAMPOS = {
  perfect_serve: [['trago', 't', 120], ['receta', 't', 1500], ['medida_ml', 'n'], ['cristaleria', 't', 160], ['garnish', 't', 160], ['precio_botella', 'n'], ['ml_botella', 'n'], ['precio_sugerido', 'n']],
  perfect_store: [['surtido', 't', 1500], ['precio_sugerido', 't', 600], ['exhibicion', 't', 1000]],
};
// Lo que se sugiere al armar el panel de un KAF de Campari (Juan Pablo lo puede cambiar).
const PRESET_CAMPARI = {
  marca: 'Campari', prefijos: ['0204', '0253'], planillas_campari: true, region: 'mendoza',
  tipos: ['restaurante', 'bar', 'disco', 'evento'],
  marcas: ['Aperol', 'Campari', 'Cynar', 'Cinzano', 'Skyy', 'Bulldog', 'Wild Turkey', 'Old Smuggler', 'Espolón', '1800', 'Cuervo', 'Appleton', 'Frangelico', 'Grand Marnier', 'Averna', 'Cazalis', 'Reserva San Juan'],
};

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const texto = (v, max) => { const s = String(v == null ? '' : v).trim().slice(0, max); return s || null; };
const esUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
const esCod = v => /^[\w-]{1,20}$/.test(String(v || ''));
const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const normCod = s => String(s == null ? '' : s).trim().replace(/^0+/, '') || '0';
const fmtAR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const diaAR = d => fmtAR.format(d instanceof Date ? d : new Date(d));
const hoyAR = () => diaAR(new Date());
const sumaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mesDe = iso => String(iso).slice(0, 7);
const esMes = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
const finDeMes = m => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10); };
const lunesDe = iso => { const d = new Date(iso + 'T12:00:00Z'); const w = (d.getUTCDay() + 6) % 7; return sumaDias(iso, -w); };
const lista = a => a.map(x => '%22' + encodeURIComponent(String(x)) + '%22').join(',');
function campos(def, src) {
  const out = {};
  for (const [k, t, max] of def) {
    const v = src && src[k];
    if (v == null || v === '') continue;
    if (Array.isArray(t)) { if (t.includes(v)) out[k] = v; }
    else if (t === 'b') out[k] = v === true || v === 'true' || v === 'si';
    else if (t === 'n') { const n = Number(String(v).replace(',', '.')); if (isFinite(n) && n >= 0 && n < 1e10) out[k] = Math.round(n * 100) / 100; }
    else if (t === 'u') { if (esUuid(v)) out[k] = v; }
    else { const s = texto(v, max); if (s) out[k] = s; }
  }
  return out;
}

function splitCSV(line) {
  const r = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { r.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  r.push(cur.trim()); return r;
}
async function leerCSV(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const lines = (await r.text()).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 1) return null;
    return { head: splitCSV(lines[0]).map(h => h.trim().toLowerCase()), filas: lines.slice(1).map(splitCSV) };
  } catch (e) { return null; }
}

// ── Lecturas del Manual ──────────────────────────────────────────────────────
const manCab = extra => Object.assign({ apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY }, extra || {});
async function man(path) {
  const r = await fetch(MAN_URL + '/rest/v1/' + path, { headers: manCab() });
  if (!r.ok) throw new Error('Manual ' + path.split('?')[0] + ': ' + r.status);
  return r.json();
}
// Todas las filas (la base corta en 1000 sin avisar), de a varias páginas a la vez.
// `path` lleva su order= para que las páginas no se pisen.
async function manTodo(path, tope = 80000) {
  const r = await fetch(MAN_URL + '/rest/v1/' + path, { headers: manCab({ Range: '0-999', Prefer: 'count=exact' }) });
  if (!r.ok) throw new Error('Manual ' + path.split('?')[0] + ': ' + r.status);
  const out = await r.json();
  const n = Number(String(r.headers.get('content-range') || '').split('/')[1]);
  if (!isFinite(n)) {                          // sin total: página por página
    for (let d = 1000; out.length === d && d < tope; d += 1000) {
      const x = await fetch(MAN_URL + '/rest/v1/' + path, { headers: manCab({ Range: d + '-' + (d + 999) }) });
      if (!x.ok) throw new Error('Manual ' + path.split('?')[0] + ': ' + x.status);
      out.push(...(await x.json()));
    }
    return out;
  }
  const total = Math.min(n, tope);
  const desde = [];
  for (let d = 1000; d < total; d += 1000) desde.push(d);
  for (let i = 0; i < desde.length; i += 6) {
    const lotes = await Promise.all(desde.slice(i, i + 6).map(async d => {
      const x = await fetch(MAN_URL + '/rest/v1/' + path, { headers: manCab({ Range: d + '-' + (d + 999) }) });
      if (!x.ok) throw new Error('Manual ' + path.split('?')[0] + ': ' + x.status);
      return x.json();
    }));
    lotes.forEach(l => out.push(...l));
  }
  return out;
}

// ── Perfil del KAF ───────────────────────────────────────────────────────────
function armarSecciones(P) {
  const tipos = (P && P.tipos) || [];
  const esOn = tipos.some(t => TIPOS_ON.includes(t)), esOff = tipos.some(t => !TIPOS_ON.includes(t));
  const guardadas = (P && P.secciones) || {};
  return SECCIONES.map(s => {
    const g = guardadas[s.k] || {};
    const porDefecto = !s.canal || (s.canal === 'on' ? esOn : esOff);
    return { k: s.k, t: texto(g.titulo, 60) || s.t, base: s.t, on: s.fija ? true : (typeof g.on === 'boolean' ? g.on : porDefecto), ayuda: texto(g.ayuda, 600) || '', fija: !!s.fija, canal: s.canal || null };
  });
}

// ── Lo que compra cada cliente de la marca (con caché de 10 minutos) ──────────
const CACHE = new Map();
// Cómo figura cada marca en la descripción de CUBO cuando se escribe distinto
// ("Vodka Sky Raspberry": Skyy). Se busca al principio de una palabra.
const ALIAS_MARCA = { skyy: ['sky'], espolon: ['espolon'], 'reserva san juan': ['san juan'], 'old smuggler': ['smuggler'] };
const marcaDe = (desc, marcas) => {
  const d = ' ' + nrm(desc).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (const m of marcas) {
    const k = nrm(m).replace(/[^a-z0-9 ]/g, ' ').trim();
    if (!k) continue;
    if ([k].concat(ALIAS_MARCA[k] || []).some(x => d.includes(' ' + x))) return m;
  }
  return 'Otros';
};
async function datosMarca(P) {
  const clave = JSON.stringify([P.prefijos, P.marcas, P.tipos, P.region, P.planillas_campari]);
  const c = CACHE.get(clave);
  if (c && Date.now() - c.t < 10 * 60000) return c.d;
  const tipos = (P.tipos || []).filter(t => TIPOS_OK.includes(t));
  const prefs = (P.prefijos || []).filter(p => /^\d{2,6}$/.test(p));
  const [clientes, estados, vendedores, prods, t5, acu] = await Promise.all([
    tipos.length ? manTodo('clientes?select=id,codigo_cliente,nombre,direccion,tipo,vendedor_id,activo,created_at&tipo=in.(' + lista(tipos) + ')&order=codigo_cliente') : [],
    manTodo('clientes_estado?select=codigo,activo&order=codigo'),
    man('vendedores?select=id,nombre,codigo&limit=500'),
    prefs.length ? manTodo('productos_grandbar?select=codigo,descripcion&or=(' + prefs.map(p => 'codigo.like.' + p + '*').join(',') + ')&order=codigo') : [],
    P.planillas_campari ? leerCSV(SHEET_5T) : null,
    P.planillas_campari ? leerCSV(SHEET_ACUERDOS) : null,
  ]);
  const est = new Map(estados.map(e => [String(e.codigo), e.activo]));
  const vend = new Map(vendedores.map(v => [v.id, v]));
  const visibles = clientes.filter(c => {
    const a = est.has(String(c.codigo_cliente)) ? est.get(String(c.codigo_cliente)) : c.activo;
    if (a === false) return false;
    if (!P.region) return true;
    const v = vend.get(c.vendedor_id);
    if (!v || !v.codigo) return true;
    return (SAN_LUIS_CODIGOS.has(String(v.codigo).trim()) ? 'san_luis' : 'mendoza') === P.region;
  });
  const desc = new Map(prods.map(p => [p.codigo, p.descripcion]));
  const marcas = (P.marcas || []).length ? P.marcas : [P.marca];

  // Ventas de la marca de estos clientes, de a 150 códigos por consulta.
  const porCli = new Map();
  if (prefs.length && visibles.length) {
    const cods = visibles.map(c => String(c.codigo_cliente)).filter(esCod);
    const trozos = [];
    for (let i = 0; i < cods.length; i += 150) trozos.push(cods.slice(i, i + 150));
    const filtro = '&or=(' + prefs.map(p => 'sku.like.' + p + '*').join(',') + ')&fecha=gte.' + VENTAS_DESDE + '&order=cliente_codigo,sku,fecha';
    const lotes = await Promise.all(trozos.map(t => manTodo('ventas_cliente?select=cliente_codigo,sku,fecha,unidades,importe&cliente_codigo=in.(' + lista(t) + ')' + filtro)));
    for (const filas of lotes) {
      for (const f of filas) {
        if (!porCli.has(f.cliente_codigo)) porCli.set(f.cliente_codigo, []);
        porCli.get(f.cliente_codigo).push([f.sku, f.fecha, Number(f.unidades) || 0, Number(f.importe) || 0]);
      }
    }
  }

  // Planillas Campari: 5T (1 = tiene la marca) y acuerdos, por código sin ceros.
  const cob = new Map(), acuerdos = new Map();
  if (t5 && t5.head.length) {
    const idx = MARCAS_5T.map(([k]) => t5.head.indexOf(k));
    for (const f of t5.filas) {
      const o = {};
      MARCAS_5T.forEach(([k], i) => { if (idx[i] >= 0) o[k] = f[idx[i]] === '1'; });
      cob.set(normCod(f[0]), o);
    }
  }
  if (acu && acu.head.length) {
    const h = acu.head, ix = n => h.indexOf(n);
    const I = { pdv: ix('pdv id'), producto: ix('producto'), calibre: ix('calibre'), condicion: ix('condición') >= 0 ? ix('condición') : ix('condicion'), minimo: ix('minimo'), tope: ix('tope sin cargo'), visibilidad: ix('visibilidad') };
    for (const f of acu.filas) {
      if (I.pdv < 0) break;
      const k = normCod(f[I.pdv]);
      if (!acuerdos.has(k)) acuerdos.set(k, []);
      const g = n => (I[n] >= 0 ? f[I[n]] || '' : '');
      acuerdos.get(k).push({ producto: g('producto'), calibre: g('calibre'), condicion: g('condicion'), minimo: g('minimo'), tope: g('tope'), visibilidad: g('visibilidad') });
    }
  }

  const d = { visibles, vend, desc, marcas, porCli, cob, acuerdos, hayT5: !!(t5 && t5.head.length), hayAcuerdos: !!(acu && acu.head.length), generado: new Date().toISOString() };
  CACHE.set(clave, { t: Date.now(), d });
  if (CACHE.size > 20) CACHE.delete(CACHE.keys().next().value);
  return d;
}

// Resumen de compras de un cliente: por marca (12 meses), tendencia y oportunidades.
function resumenCliente(D, P, c, conPlata) {
  const hoy = hoyAR(), d12 = sumaDias(hoy, -365), d90 = sumaDias(hoy, -90), d180 = sumaDias(hoy, -180);
  // "Meses con compra": los mismos 12 meses calendario de la tabla por mes de la ficha.
  const mIni = (() => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 11); return d.toISOString().slice(0, 7); })();
  const filas = D.porCli.get(c.codigo_cliente) || [];
  const mk = {};
  let i12 = 0, u12 = 0, i90 = 0, p90 = 0, u90 = 0, pu90 = 0, ult = null, pri = null;
  for (const [sku, fecha, u, imp] of filas) {
    if (imp > 0 && (!pri || fecha < pri)) pri = fecha;
    if (fecha < d12) continue;
    const m = marcaDe(D.desc.get(sku) || '', D.marcas);
    const x = mk[m] || (mk[m] = { u: 0, imp: 0, ult: null, meses: new Set() });
    x.u += u; x.imp += imp;
    if (imp > 0) { if (fecha.slice(0, 7) >= mIni) x.meses.add(fecha.slice(0, 7)); if (!x.ult || fecha > x.ult) x.ult = fecha; if (!ult || fecha > ult) ult = fecha; }
    i12 += imp; u12 += u;
    if (fecha >= d90) { i90 += imp; u90 += u; } else if (fecha >= d180) { p90 += imp; pu90 += u; }
  }
  const v = D.vend.get(c.vendedor_id) || {};
  const t5 = D.cob.get(normCod(c.codigo_cliente)) || null;
  const op = [];
  const nombreMarca = P.marca || 'la marca';
  if (!pri) op.push({ k: 'nunca', t: 'No le compró ' + nombreMarca + ' a GrandBar desde enero 2025' });
  else if (!ult || ult < d90) op.push({ k: 'perdido', t: 'No compra ' + nombreMarca + ' hace ' + Math.round((new Date(hoy) - new Date(ult || pri)) / 864e5) + ' días' });
  else if (pu90 > 0 && u90 < pu90 * 0.7) op.push({ k: 'baja', t: 'Compró ' + Math.round((1 - u90 / pu90) * 100) + '% menos unidades que en los 90 días anteriores' });
  // Marcas foco: las del 5T si hay planilla, si no las primeras seis de la lista.
  const foco = P.planillas_campari ? ['Aperol', 'Campari', 'Cynar', 'Cinzano', 'Skyy', 'Bulldog'] : D.marcas.slice(0, 6);
  if (pri) {
    const dejo = foco.filter(m => mk[m] && mk[m].ult && mk[m].ult < d90);
    const nunca = foco.filter(m => !mk[m] || !mk[m].ult);
    if (dejo.length) op.push({ k: 'dejo', t: 'Dejó de comprar ' + dejo.join(', ') + ' (nada en 90 días)' });
    if (nunca.length) op.push({ k: 'sin', t: 'Sin ' + nunca.join(', ') + ' en los últimos 12 meses' });
  }
  if (t5) {
    const falta = MARCAS_5T.filter(([k]) => k in t5 && !t5[k]).map(([, n]) => n);
    if (falta.length) op.push({ k: '5t', t: 'Plan 5T: le falta ' + falta.join(', ') });
  }
  const porMarca = Object.entries(mk).filter(([, x]) => x.u || x.imp).sort((a, b) => b[1].u - a[1].u)
    .map(([m, x]) => Object.assign({ m, u: Math.round(x.u), ult: x.ult, meses: x.meses.size }, conPlata ? { imp: Math.round(x.imp) } : {}));
  return Object.assign({
    c: c.codigo_cliente, n: c.nombre, d: c.direccion || '', t: c.tipo, v: v.nombre || '', vc: v.codigo || '', alta: c.created_at ? diaAR(c.created_at) : null,
    u12: Math.round(u12), u90: Math.round(u90), pu90: Math.round(pu90), ult, pri, m: porMarca, t5, acu: (D.acuerdos.get(normCod(c.codigo_cliente)) || []).length, op,
  }, conPlata ? { i12: Math.round(i12), i90: Math.round(i90), p90: Math.round(p90) } : {});
}

// Clientes nuevos del mes. Marca: primera compra de la marca (desde enero 2025) en
// el mes. GrandBar: cuenta dada de alta en CUBO (la sync la trae al manual) y sin
// ninguna compra antes del mes.
async function calcularNuevos(P, mes, conPlata) {
  const D = await datosMarca(P);
  const ini = mes + '-01', fin = finDeMes(mes);
  const marca = [];
  for (const c of D.visibles) {
    const r = resumenCliente(D, P, c, conPlata);
    if (r.pri && r.pri >= ini && r.pri <= fin) marca.push({ c: r.c, n: r.n, t: r.t, v: r.v, primera: r.pri, alta: r.alta });
  }
  const candidatos = D.visibles.filter(c => c.created_at && diaAR(c.created_at) >= ini && diaAR(c.created_at) <= fin && esCod(c.codigo_cliente));
  const gb = [];
  for (let i = 0; i < candidatos.length; i += 10) {
    const lote = await Promise.all(candidatos.slice(i, i + 10).map(async c => {
      const cod = encodeURIComponent(c.codigo_cliente);
      const [antes, primera] = await Promise.all([
        man('ventas_cliente?cliente_codigo=eq.' + cod + '&fecha=lt.' + ini + '&importe=gt.0&select=fecha&limit=1'),
        man('ventas_cliente?cliente_codigo=eq.' + cod + '&fecha=gte.' + ini + '&importe=gt.0&select=fecha&order=fecha.asc&limit=1'),
      ]);
      if (antes.length) return null;
      const v = D.vend.get(c.vendedor_id) || {};
      return { c: c.codigo_cliente, n: c.nombre, t: c.tipo, v: v.nombre || '', alta: diaAR(c.created_at), primera: primera[0] ? primera[0].fecha : null };
    }));
    lote.forEach(x => { if (x) gb.push(x); });
  }
  return { marca: marca.sort((a, b) => a.primera < b.primera ? -1 : 1), gb: gb.sort((a, b) => a.alta < b.alta ? -1 : 1) };
}

exports.handler = async (event) => {
  const srole = process.env.HUB_SERVICE_ROLE;
  if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token === 'null' || token === 'undefined') return json(401, { error: 'Sin sesión' });
  const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
  if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
  const user = await uRes.json();

  const cab = extra => Object.assign({ apikey: srole, Authorization: 'Bearer ' + srole }, extra || {});
  const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: cab({ 'Content-Type': 'application/json', ...(opts.headers || {}) }) });
  const st = (path, opts = {}) => fetch(HUB_URL + '/storage/v1/' + path, { ...opts, headers: cab(opts.headers) });
  const hub = async path => { const r = await sb(path); if (!r.ok) throw new Error('Portal ' + path.split('?')[0] + ': ' + r.status + ' ' + (await r.text()).slice(0, 120)); return r.json(); };
  const escribir = async (path, method, body, prefer) => {
    const r = await sb(path, { method, headers: { Prefer: prefer || 'return=representation' }, body: body == null ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error('No se pudo guardar (' + r.status + '). ' + (await r.text()).slice(0, 160));
    return String(prefer || '').includes('return=minimal') ? null : r.json();
  };

  const yo = (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=id,nombre,email,rol,activo'))[0] || {};
  if (yo.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
  const rol = String(yo.rol || '').toLowerCase();
  const esKaf = rol === 'kaf', veTodo = VEN_TODO.includes(rol), arma = ARMAN.includes(rol);
  const esAndrea = String(yo.email || user.email || '').toLowerCase() === MATERIALES_A;
  const quien = yo.nombre || user.email || 'GrandBar';

  // A qué KAF se refiere: el propio, o el que elige Trade Marketing (?kaf= / kaf).
  const kafDe = id => (esKaf ? user.id : (veTodo && esUuid(id) ? id : null));
  async function perfilDe(uid) {
    const p = (await hub('kaf_perfiles?usuario_id=eq.' + uid + '&select=*'))[0] || null;
    return p;
  }
  async function firmar(paths, seg = 3600) {
    const url = {};
    const ps = [...new Set(paths.filter(Boolean))];
    if (!ps.length) return url;
    const r = await st('object/sign/' + BUCKET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: seg, paths: ps }) });
    const l = r.ok ? await r.json() : [];
    (Array.isArray(l) ? l : []).forEach(x => { if (x && x.signedURL) url[x.path] = HUB_URL + '/storage/v1' + x.signedURL; });
    return url;
  }
  async function avisar(destId, n) {
    if (!destId) return false;
    let ok = false;
    try {
      const r = await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: n.icono || '📌', titulo: n.titulo, detalle: n.detalle, link: n.link }) });
      ok = r.ok;
    } catch (e) {}
    try { await pushA(sb, destId, { title: (n.icono || '📌') + ' ' + n.titulo, body: n.detalle, url: n.link }); } catch (e) {}
    return ok;
  }
  async function trade() { try { return await hub('usuarios?rol=eq.torneo&activo=not.is.false&select=id'); } catch (e) { return []; } }
  // Sube archivos (data URL) a la carpeta privada. Devuelve las rutas.
  async function subir(base, archivos, permitePdf) {
    const subidas = [];
    let total = 0;
    for (let i = 0; i < archivos.length; i++) {
      const m = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(String(archivos[i] || ''));
      if (!m || (m[1] === 'application/pdf' && !permitePdf)) throw new Error('Uno de los archivos no es una foto' + (permitePdf ? ' ni un PDF' : '') + '.');
      const buf = Buffer.from(m[3], 'base64');
      total += buf.length;
      if (!buf.length || buf.length > 3.5 * 1024 * 1024 || total > 4.2 * 1024 * 1024) throw new Error('Los archivos pesan demasiado: mandá menos o más livianos.');
      const ext = m[1] === 'application/pdf' ? 'pdf' : (m[2] === 'jpeg' ? 'jpg' : m[2]);
      const p = base + '-' + (i + 1) + '.' + ext;
      const up = await st('object/' + BUCKET + '/' + p, { method: 'POST', headers: { 'Content-Type': m[1], 'x-upsert': 'true' }, body: buf });
      if (!up.ok) {
        if (subidas.length) await st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: subidas }) }).catch(() => {});
        throw new Error('No se pudo subir el archivo. ¿Ya se corrió kaf-setup.sql?');
      }
      subidas.push(p);
    }
    return subidas;
  }
  const borrarArchivos = paths => (paths && paths.length ? st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) }).catch(() => {}) : null);

  try {
    // ======================= GET =======================
    if (event.httpMethod === 'GET') {
      const qp = event.queryStringParameters || {};
      const v = qp.vista || 'inicio';

      // Andrea: pedidos de materiales (también los ve Trade Marketing y el propio KAF).
      if (v === 'pedidos') {
        let q = 'kaf_pedidos_materiales?select=*&order=created_at.desc&limit=300';
        if (esKaf) q += '&usuario_id=eq.' + user.id;
        else if (!veTodo && !esAndrea) return json(403, { error: 'No autorizado.' });
        else if (esUuid(qp.kaf)) q += '&usuario_id=eq.' + qp.kaf;
        if (['enviado', 'remito', 'rechazado'].includes(qp.estado)) q += '&estado=eq.' + qp.estado;
        return json(200, { pedidos: await hub(q), soyDestino: esAndrea });
      }

      // Trade Marketing: los KAF que hay y cómo vienen este mes.
      if (v === 'kafs') {
        if (!veTodo) return json(403, { error: 'No autorizado.' });
        const users = await hub('usuarios?rol=eq.kaf&select=id,nombre,email,activo&order=nombre');
        const ids = users.map(u => u.id);
        const hoy = hoyAR(), mes = mesDe(hoy);
        const [perfiles, visitas, objetivos, regs, peds] = ids.length ? await Promise.all([
          hub('kaf_perfiles?usuario_id=in.(' + ids.join(',') + ')&select=*'),
          hub('kaf_visitas?usuario_id=in.(' + ids.join(',') + ')&fecha=gte.' + mes + '-01T03:00:00Z&select=usuario_id,fecha,cliente_codigo&limit=5000'),
          hub('kaf_objetivos?usuario_id=in.(' + ids.join(',') + ')&mes=eq.' + mes + '&select=*'),
          hub('kaf_registros?usuario_id=in.(' + ids.join(',') + ')&estado=in.(nuevo,pendiente)&select=usuario_id,tipo&limit=2000'),
          hub('kaf_pedidos_materiales?usuario_id=in.(' + ids.join(',') + ')&estado=eq.enviado&select=usuario_id&limit=2000'),
        ]) : [[], [], [], [], []];
        return json(200, {
          hoy, mes, preset: PRESET_CAMPARI, secciones: SECCIONES,
          kafs: users.map(u => {
            const vs = visitas.filter(x => x.usuario_id === u.id);
            return {
              id: u.id, nombre: u.nombre, email: u.email, activo: u.activo !== false,
              perfil: perfiles.find(p => p.usuario_id === u.id) || null,
              secciones: armarSecciones(perfiles.find(p => p.usuario_id === u.id) || null),
              objetivos: objetivos.find(o => o.usuario_id === u.id) || null,
              visitasMes: vs.length, visitasHoy: vs.filter(x => diaAR(x.fecha) === hoy).length,
              sinRevisar: regs.filter(r => r.usuario_id === u.id).length,
              pedidosAbiertos: peds.filter(p => p.usuario_id === u.id).length,
            };
          }),
        });
      }

      // Modelos de Perfect Serve / Perfect Store (los carga Trade Marketing).
      if (v === 'modelos') {
        if (!esKaf && !veTodo) return json(403, { error: 'No autorizado.' });
        let q = 'kaf_modelos?select=*&order=orden.asc,nombre.asc';
        if (qp.tipo === 'perfect_serve' || qp.tipo === 'perfect_store') q += '&tipo=eq.' + qp.tipo;
        let mods = await hub(q);
        if (esKaf) {
          const P = await perfilDe(user.id);
          const mm = nrm(P && P.marca);
          mods = mods.filter(m => m.activo && (!mm || nrm(m.marca) === mm || nrm(m.marca) === 'todas'));
        }
        const url = await firmar(mods.map(m => m.foto));
        return json(200, { modelos: mods.map(m => Object.assign(m, { foto_url: url[m.foto] || null })) });
      }

      // Catálogo de materiales (Manual): activos y visibles para vendedores.
      if (v === 'materiales') {
        if (!esKaf && !veTodo) return json(403, { error: 'No autorizado.' });
        const [mats, brands, provs, cats] = await Promise.all([
          manTodo('materials_with_stock?is_active=eq.true&visible_to_sellers=eq.true&select=id,name,description,processed_image_url,original_image_url,stock_actual,unit_type,brand_id,supplier_id,category_id,canales,requires_approval&order=name'),
          man('brands?select=id,name,supplier_id&limit=2000'),
          man('proveedores?select=id,nombre&limit=2000'),
          man('material_categories?select=id,name&limit=200'),
        ]);
        const B = new Map(brands.map(b => [b.id, b])), PV = new Map(provs.map(p => [p.id, p.nombre])), C = new Map(cats.map(c => [c.id, c.name]));
        return json(200, {
          materiales: mats.map(m => {
            const b = B.get(m.brand_id);
            return { id: m.id, nombre: m.name, descripcion: m.description || '', foto: m.processed_image_url || m.original_image_url || null, stock: Number(m.stock_actual) || 0, unidad: m.unit_type || '',
              marca: b ? b.name : '', proveedor: PV.get(m.supplier_id || (b && b.supplier_id)) || '', categoria: C.get(m.category_id) || '', canales: m.canales || [], aprobacion: !!m.requires_approval };
          }),
        });
      }

      const kid = kafDe(qp.kaf);
      if (!kid) return json(403, { error: esKaf || veTodo ? 'Elegí un KAF.' : 'No autorizado.' });
      const P = await perfilDe(kid);
      const usu = esKaf ? yo : ((await hub('usuarios?id=eq.' + kid + '&select=id,nombre,email,rol'))[0] || {});
      if (!esKaf && String(usu.rol || '') !== 'kaf') return json(404, { error: 'Ese usuario no es KAF.' });
      const plata = VEN_PLATA.includes(rol);
      const secciones = armarSecciones(P);

      if (v === 'inicio') {
        const hoy = hoyAR(), mes = mesDe(hoy), lun = lunesDe(hoy);
        const desde = (lun < mes + '-01' ? lun : mes + '-01');
        const [obj, vis, objCli, peds, regs] = await Promise.all([
          hub('kaf_objetivos?usuario_id=eq.' + kid + '&mes=eq.' + mes + '&select=*'),
          hub('kaf_visitas?usuario_id=eq.' + kid + '&fecha=gte.' + desde + 'T03:00:00Z&select=id,fecha,cliente_codigo,cliente_nombre&order=fecha.desc&limit=3000'),
          hub('kaf_objetivos_cliente?usuario_id=eq.' + kid + '&mes=eq.' + mes + '&select=*&order=created_at'),
          hub('kaf_pedidos_materiales?usuario_id=eq.' + kid + '&select=id,estado,remito,created_at,items&order=created_at.desc&limit=5'),
          hub('kaf_registros?usuario_id=eq.' + kid + '&fecha=gte.' + mes + '-01&select=tipo,estado&limit=3000'),
        ]);
        // Visitas por día: clientes distintos visitados ese día.
        const porDia = {};
        vis.forEach(x => { const d = diaAR(x.fecha); (porDia[d] = porDia[d] || new Set()).add(x.cliente_codigo); });
        const semana = [];
        for (let i = 0; i < 6; i++) { const d = sumaDias(lun, i); semana.push({ dia: d, n: porDia[d] ? porDia[d].size : 0, futuro: d > hoy }); }
        const delMes = Object.keys(porDia).filter(d => d.startsWith(mes));
        let nuevos = null;
        if (P) { try { nuevos = await calcularNuevos(P, mes, plata); nuevos = { marca: nuevos.marca.length, gb: nuevos.gb.length }; } catch (e) { nuevos = { error: e.message }; } }
        const conteo = {};
        regs.forEach(r => { conteo[r.tipo] = (conteo[r.tipo] || 0) + 1; });
        return json(200, {
          kaf: { id: kid, nombre: usu.nombre, email: usu.email }, perfil: P, secciones, hoy, mes, objetivos: obj[0] || null,
          visitas: { hoy: porDia[hoy] ? porDia[hoy].size : 0, semana, mes: delMes.reduce((s, d) => s + porDia[d].size, 0), diasMes: delMes.length,
            ultimas: vis.slice(0, 6) },
          nuevos, objetivosCliente: objCli, pedidos: peds, registrosMes: conteo,
        });
      }

      if (!P) return json(200, { sinPerfil: true, secciones, kaf: { id: kid, nombre: usu.nombre } });

      if (v === 'clientes') {
        const D = await datosMarca(P);
        const mes = mesDe(hoyAR());
        const [vis, objCli] = await Promise.all([
          hub('kaf_visitas?usuario_id=eq.' + kid + '&fecha=gte.' + sumaDias(hoyAR(), -120) + 'T03:00:00Z&select=cliente_codigo,fecha&order=fecha.desc&limit=5000'),
          hub('kaf_objetivos_cliente?usuario_id=eq.' + kid + '&mes=eq.' + mes + '&select=cliente_codigo,estado'),
        ]);
        const ultVis = {};
        vis.forEach(x => { if (!ultVis[x.cliente_codigo]) ultVis[x.cliente_codigo] = x.fecha; });
        const visMes = {};
        vis.forEach(x => { if (diaAR(x.fecha).startsWith(mes)) visMes[x.cliente_codigo] = (visMes[x.cliente_codigo] || 0) + 1; });
        const objs = {};
        objCli.forEach(o => { (objs[o.cliente_codigo] = objs[o.cliente_codigo] || { p: 0, l: 0 })[o.estado === 'logrado' ? 'l' : 'p']++; });
        return json(200, {
          perfil: P, secciones, hayT5: D.hayT5, hayAcuerdos: D.hayAcuerdos, generado: D.generado, plata, marcas5t: MARCAS_5T,
          clientes: D.visibles.map(c => Object.assign(resumenCliente(D, P, c, plata), { vis: ultVis[c.codigo_cliente] || null, visMes: visMes[c.codigo_cliente] || 0, obj: objs[c.codigo_cliente] || null })),
        });
      }

      if (v === 'cliente') {
        if (!esCod(qp.codigo)) return json(400, { error: 'Falta el cliente.' });
        const D = await datosMarca(P);
        const c = D.visibles.find(x => x.codigo_cliente === qp.codigo);
        if (!c) return json(404, { error: 'Ese cliente no está en tu lista (otro canal, otra zona u oculto).' });
        const r = resumenCliente(D, P, c, plata);
        // Por mes y marca, últimos 12 meses.
        const hoy = hoyAR(), meses = [];
        for (let i = 11; i >= 0; i--) { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
        const tabla = {};
        (D.porCli.get(c.codigo_cliente) || []).forEach(([sku, fecha, u]) => {
          const m = fecha.slice(0, 7); if (!meses.includes(m)) return;
          const mk = marcaDe(D.desc.get(sku) || '', D.marcas);
          (tabla[mk] = tabla[mk] || {})[m] = ((tabla[mk] || {})[m] || 0) + u;
        });
        const [vis, regs, objs] = await Promise.all([
          hub('kaf_visitas?usuario_id=eq.' + kid + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo_cliente) + '&select=*&order=fecha.desc&limit=100'),
          hub('kaf_registros?usuario_id=eq.' + kid + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo_cliente) + '&select=id,tipo,fecha,estado,datos,created_at&order=created_at.desc&limit=100'),
          hub('kaf_objetivos_cliente?usuario_id=eq.' + kid + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo_cliente) + '&select=*&order=mes.desc,created_at&limit=60'),
        ]);
        return json(200, { cliente: r, meses, porMes: tabla, acuerdos: D.acuerdos.get(normCod(c.codigo_cliente)) || [], visitas: vis, registros: regs, objetivos: objs, marcas5t: MARCAS_5T, plata });
      }

      if (v === 'visitas') {
        const hoy = hoyAR();
        const desde = /^\d{4}-\d{2}-\d{2}$/.test(qp.desde || '') ? qp.desde : lunesDe(hoy);
        const hasta = /^\d{4}-\d{2}-\d{2}$/.test(qp.hasta || '') ? qp.hasta : hoy;
        // Límites del día en Argentina (UTC−3).
        const vis = await hub('kaf_visitas?usuario_id=eq.' + kid + '&fecha=gte.' + desde + 'T03:00:00Z&fecha=lt.' + sumaDias(hasta, 1) + 'T03:00:00Z&select=*&order=fecha.desc&limit=5000');
        const obj = await hub('kaf_objetivos?usuario_id=eq.' + kid + '&mes=in.(' + [...new Set([mesDe(desde), mesDe(hasta)])].join(',') + ')&select=mes,visitas_dia');
        return json(200, { kaf: { id: kid, nombre: usu.nombre }, desde, hasta, visitas: vis, objetivos: obj });
      }

      if (v === 'nuevos') {
        const mes = esMes(qp.mes) ? qp.mes : mesDe(hoyAR());
        const n = await calcularNuevos(P, mes, plata);
        const obj = (await hub('kaf_objetivos?usuario_id=eq.' + kid + '&mes=eq.' + mes + '&select=*'))[0] || null;
        return json(200, { mes, objetivos: obj, marcaNombre: P.marca, nuevosMarca: n.marca, nuevosGb: n.gb });
      }

      if (v === 'registros') {
        let q = 'kaf_registros?usuario_id=eq.' + kid + '&select=*&order=created_at.desc&limit=300';
        if (REG_TIPOS.includes(qp.tipo)) q += '&tipo=eq.' + qp.tipo;
        const regs = await hub(q);
        const url = await firmar([].concat(...regs.map(r => r.fotos || [])));
        return json(200, { registros: regs.map(r => Object.assign(r, { fotos_url: (r.fotos || []).map(p => ({ url: url[p] || null, pdf: /\.pdf$/i.test(p) })) })) });
      }

      if (v === 'objetivos') {
        const mes = esMes(qp.mes) ? qp.mes : mesDe(hoyAR());
        const [obj, objCli] = await Promise.all([
          hub('kaf_objetivos?usuario_id=eq.' + kid + '&mes=eq.' + mes + '&select=*'),
          hub('kaf_objetivos_cliente?usuario_id=eq.' + kid + '&mes=eq.' + mes + '&select=*&order=created_at'),
        ]);
        return json(200, { mes, objetivos: obj[0] || null, objetivosCliente: objCli });
      }

      return json(400, { error: 'Vista desconocida.' });
    }

    // ======================= POST =======================
    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' });
    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }
    const ac = b.accion;

    // ---------- Andrea: atiende un pedido de materiales ----------
    if (ac === 'atender_pedido') {
      if (!esAndrea && !arma) return json(403, { error: 'Los pedidos de materiales los atiende Andrea (facturación).' });
      if (!esUuid(b.id) || !['remito', 'rechazado', 'enviado'].includes(b.estado)) return json(400, { error: 'Faltan datos.' });
      const ped = (await hub('kaf_pedidos_materiales?id=eq.' + b.id + '&select=id,usuario_id,estado'))[0];
      if (!ped) return json(404, { error: 'No encontré el pedido.' });
      if (b.estado === 'rechazado' && !texto(b.respuesta, 500)) return json(400, { error: 'Contale por qué no sale.' });
      const cambios = b.estado === 'enviado'
        ? { estado: 'enviado', remito: null, respuesta: null, atendido_por: null, atendido_at: null }
        : { estado: b.estado, remito: texto(b.remito, 60), respuesta: texto(b.respuesta, 500), atendido_por: quien, atendido_at: new Date().toISOString() };
      await escribir('kaf_pedidos_materiales?id=eq.' + b.id, 'PATCH', cambios, 'return=minimal');
      if (b.estado !== 'enviado') await avisar(ped.usuario_id, { icono: '📦', titulo: b.estado === 'remito' ? 'Tu pedido de materiales tiene remito' : 'Tu pedido de materiales no sale', detalle: b.estado === 'remito' ? ('Remito ' + (cambios.remito || 'emitido') + (cambios.respuesta ? ' · ' + cambios.respuesta : '')) : cambios.respuesta, link: '/kaf.html#materiales' });
      return json(200, { ok: true });
    }

    // ---------- Trade Marketing: arma el panel ----------
    if (['perfil', 'objetivos', 'objetivo_cliente', 'borrar_objetivo_cliente', 'modelo', 'borrar_modelo', 'revisar'].includes(ac)) {
      if (!arma) return json(403, { error: 'Esto lo arma Trade Marketing.' });

      if (ac === 'revisar') {
        if (!esUuid(b.id) || !['nuevo', 'visto', 'pendiente', 'aprobado', 'rechazado'].includes(b.estado)) return json(400, { error: 'Faltan datos.' });
        const reg = (await hub('kaf_registros?id=eq.' + b.id + '&select=id,usuario_id,tipo,cliente_nombre,datos'))[0];
        if (!reg) return json(404, { error: 'No encontré el registro.' });
        if (reg.tipo === 'presupuesto' && ['nuevo', 'visto'].includes(b.estado)) return json(400, { error: 'Un presupuesto se aprueba o se rechaza.' });
        if (reg.tipo !== 'presupuesto' && ['pendiente', 'aprobado', 'rechazado'].includes(b.estado)) return json(400, { error: 'Estado inválido.' });
        if (b.estado === 'rechazado' && !texto(b.revision, 800)) return json(400, { error: 'Contale por qué no se aprueba.' });
        const revisado = !['nuevo', 'pendiente'].includes(b.estado);
        await escribir('kaf_registros?id=eq.' + b.id, 'PATCH', { estado: b.estado, revision: texto(b.revision, 800), revisado_por: revisado ? quien : null, revisado_at: revisado ? new Date().toISOString() : null }, 'return=minimal');
        if (reg.tipo === 'presupuesto' && revisado) await avisar(reg.usuario_id, { icono: b.estado === 'aprobado' ? '✅' : '✖️', titulo: 'Presupuesto ' + (b.estado === 'aprobado' ? 'aprobado' : 'rechazado'), detalle: ((reg.datos || {}).concepto || 'Presupuesto') + (reg.cliente_nombre ? ' · ' + reg.cliente_nombre : '') + (b.revision ? ' — ' + texto(b.revision, 200) : ''), link: '/kaf.html#presupuesto' });
        else if (texto(b.revision, 800) && revisado) await avisar(reg.usuario_id, { icono: '💬', titulo: 'Comentario de Trade Marketing: ' + REG_NOMBRE[reg.tipo], detalle: texto(b.revision, 200), link: '/kaf.html#' + reg.tipo });
        return json(200, { ok: true });
      }

      if (ac === 'modelo') {
        const tipo = b.tipo;
        if (!MOD_CAMPOS[tipo]) return json(400, { error: 'Tipo de modelo inválido.' });
        const fila = { tipo, marca: texto(b.marca, 80) || 'Todas', nombre: texto(b.nombre, 120), datos: campos(MOD_CAMPOS[tipo], b.datos || {}), activo: b.activo !== false, orden: Math.max(0, Math.min(999, Number(b.orden) || 0)), updated_at: new Date().toISOString() };
        if (!fila.nombre) return json(400, { error: 'Ponele un nombre al modelo.' });
        let id = esUuid(b.id) ? b.id : null, viejo = null;
        if (id) {
          viejo = (await hub('kaf_modelos?id=eq.' + id + '&select=id,foto'))[0];
          if (!viejo) return json(404, { error: 'No encontré el modelo.' });
          await escribir('kaf_modelos?id=eq.' + id, 'PATCH', fila, 'return=minimal');
        } else {
          fila.creado_por = quien;
          id = (await escribir('kaf_modelos', 'POST', fila))[0].id;
        }
        if (b.foto && /^data:image\//.test(b.foto)) {
          const [p] = await subir('modelos/' + id + '-' + Date.now(), [b.foto], false);
          await escribir('kaf_modelos?id=eq.' + id, 'PATCH', { foto: p }, 'return=minimal');
          if (viejo && viejo.foto) await borrarArchivos([viejo.foto]);
        } else if (b.quitarFoto && viejo && viejo.foto) {
          await escribir('kaf_modelos?id=eq.' + id, 'PATCH', { foto: null }, 'return=minimal');
          await borrarArchivos([viejo.foto]);
        }
        return json(200, { ok: true, id });
      }
      if (ac === 'borrar_modelo') {
        if (!esUuid(b.id)) return json(400, { error: 'Falta el modelo.' });
        const viejo = (await hub('kaf_modelos?id=eq.' + b.id + '&select=id,foto'))[0];
        if (!viejo) return json(404, { error: 'No encontré el modelo.' });
        await escribir('kaf_modelos?id=eq.' + b.id, 'DELETE', null, 'return=minimal');
        if (viejo.foto) await borrarArchivos([viejo.foto]);
        return json(200, { ok: true });
      }

      // Lo que sigue es de un KAF en particular.
      if (!esUuid(b.kaf)) return json(400, { error: 'Elegí un KAF.' });
      const k = (await hub('usuarios?id=eq.' + b.kaf + '&select=id,rol'))[0];
      if (!k || k.rol !== 'kaf') return json(404, { error: 'Ese usuario no es KAF.' });

      if (ac === 'perfil') {
        const prefijos = (Array.isArray(b.prefijos) ? b.prefijos : []).map(x => String(x).trim()).filter(x => /^\d{2,6}$/.test(x)).slice(0, 20);
        const marcas = (Array.isArray(b.marcas) ? b.marcas : []).map(x => texto(x, 40)).filter(Boolean).slice(0, 40);
        const tipos = (Array.isArray(b.tipos) ? b.tipos : []).filter(t => TIPOS_OK.includes(t));
        if (!texto(b.marca, 60)) return json(400, { error: 'Falta la marca.' });
        if (!tipos.length) return json(400, { error: 'Elegí al menos un tipo de cliente.' });
        const secciones = {};
        const sIn = b.secciones || {};
        SECCIONES.forEach(s => {
          const g = sIn[s.k] || {};
          const o = {};
          if (!s.fija && typeof g.on === 'boolean') o.on = g.on;
          const t = texto(g.titulo, 60); if (t && t !== s.t) o.titulo = t;
          const a = texto(g.ayuda, 600); if (a) o.ayuda = a;
          if (Object.keys(o).length) secciones[s.k] = o;
        });
        const fila = { usuario_id: b.kaf, marca: texto(b.marca, 60), prefijos, marcas, tipos, region: ['mendoza', 'san_luis'].includes(b.region) ? b.region : null, planillas_campari: !!b.planillas_campari, secciones, updated_at: new Date().toISOString(), updated_by: quien };
        await escribir('kaf_perfiles?on_conflict=usuario_id', 'POST', fila, 'resolution=merge-duplicates,return=minimal');
        return json(200, { ok: true });
      }
      if (ac === 'objetivos') {
        if (!esMes(b.mes)) return json(400, { error: 'Falta el mes.' });
        const ent = x => (x === '' || x == null ? null : Math.max(0, Math.min(9999, Math.round(Number(x)) || 0)));
        const fila = { usuario_id: b.kaf, mes: b.mes, visitas_dia: ent(b.visitas_dia), nuevos_marca: ent(b.nuevos_marca), nuevos_gb: ent(b.nuevos_gb), nota: texto(b.nota, 1000), updated_at: new Date().toISOString(), updated_by: quien };
        await escribir('kaf_objetivos?on_conflict=usuario_id,mes', 'POST', fila, 'resolution=merge-duplicates,return=minimal');
        await avisar(b.kaf, { icono: '🎯', titulo: 'Tus objetivos de ' + MESES[Number(b.mes.slice(5)) - 1], detalle: [fila.visitas_dia != null ? fila.visitas_dia + ' clientes por día' : '', fila.nuevos_marca != null ? fila.nuevos_marca + ' nuevos de la marca' : '', fila.nuevos_gb != null ? fila.nuevos_gb + ' nuevos de GrandBar' : ''].filter(Boolean).join(' · ') || 'Trade Marketing actualizó tus objetivos.', link: '/kaf.html#inicio' });
        return json(200, { ok: true });
      }
      if (ac === 'objetivo_cliente') {
        if (!esMes(b.mes) || !esCod(b.codigo) || !texto(b.objetivo, 300)) return json(400, { error: 'Faltan el cliente o el objetivo.' });
        const c = (await man('clientes?codigo_cliente=eq.' + encodeURIComponent(b.codigo) + '&select=codigo_cliente,nombre'))[0];
        if (!c) return json(404, { error: 'No encontré el cliente.' });
        const fila = { usuario_id: b.kaf, mes: b.mes, cliente_codigo: c.codigo_cliente, cliente_nombre: c.nombre, objetivo: texto(b.objetivo, 300), creado_por: quien };
        const r = await escribir('kaf_objetivos_cliente', 'POST', fila);
        await avisar(b.kaf, { icono: '🎯', titulo: 'Objetivo nuevo en ' + c.nombre, detalle: fila.objetivo, link: '/kaf.html#clientes' });
        return json(200, { ok: true, id: r[0] && r[0].id });
      }
      if (ac === 'borrar_objetivo_cliente') {
        if (!esUuid(b.id)) return json(400, { error: 'Falta el objetivo.' });
        await escribir('kaf_objetivos_cliente?id=eq.' + b.id + '&usuario_id=eq.' + b.kaf, 'DELETE', null, 'return=minimal');
        return json(200, { ok: true });
      }
    }

    // ---------- KAF ----------
    if (!esKaf) return json(403, { error: 'Esto lo carga el KAF desde su panel.' });
    const P = await perfilDe(user.id);
    if (!P) return json(400, { error: 'Tu panel todavía no está armado: avisale a Trade Marketing.' });

    // El cliente, de la base (y que sea de su lista).
    async function clienteDe(codigo, obligatorio) {
      if (!codigo) { if (obligatorio) throw new Error('Elegí el cliente.'); return null; }
      if (!esCod(codigo)) throw new Error('Cliente inválido.');
      const c = (await man('clientes?codigo_cliente=eq.' + encodeURIComponent(codigo) + '&select=codigo_cliente,nombre,tipo,vendedor_id'))[0];
      if (!c) throw new Error('No encontré el cliente.');
      const v = c.vendedor_id ? (await man('vendedores?id=eq.' + c.vendedor_id + '&select=nombre,codigo'))[0] : null;
      return { codigo: c.codigo_cliente, nombre: c.nombre, tipo: c.tipo, vendedor: v ? v.nombre : null };
    }

    if (ac === 'visita') {
      let c;
      try { c = await clienteDe(b.codigo, true); } catch (e) { return json(400, { error: e.message }); }
      const ahora = Date.now();
      let fecha = new Date(ahora);
      if (b.cuando) {
        const f = new Date(b.cuando);
        if (isNaN(f)) return json(400, { error: 'Fecha inválida.' });
        if (f.getTime() > ahora + 5 * 60000) return json(400, { error: 'No se puede marcar una visita que todavía no pasó.' });
        if (f.getTime() < ahora - 7 * 864e5) return json(400, { error: 'Solo se pueden cargar visitas de los últimos 7 días.' });
        fecha = f;
      }
      // Dos toques seguidos no hacen dos visitas.
      const previa = (await hub('kaf_visitas?usuario_id=eq.' + user.id + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo) + '&fecha=gte.' + new Date(fecha.getTime() - 30 * 60000).toISOString() + '&fecha=lte.' + new Date(fecha.getTime() + 30 * 60000).toISOString() + '&select=id,fecha&limit=1'))[0];
      if (previa) return json(200, { ok: true, repetida: true, visita: previa });
      const r = await escribir('kaf_visitas', 'POST', { usuario_id: user.id, cliente_codigo: c.codigo, cliente_nombre: c.nombre, tipo_cliente: c.tipo, vendedor: c.vendedor, fecha: fecha.toISOString(), nota: texto(b.nota, 1000) });
      return json(200, { ok: true, visita: r[0] });
    }
    if (ac === 'borrar_visita') {
      if (!esUuid(b.id)) return json(400, { error: 'Falta la visita.' });
      const x = (await hub('kaf_visitas?id=eq.' + b.id + '&select=id,usuario_id,registrada_at'))[0];
      if (!x || x.usuario_id !== user.id) return json(403, { error: 'Solo podés borrar tus visitas.' });
      if (Date.now() - new Date(x.registrada_at).getTime() > 24 * 3600000) return json(400, { error: 'Pasaron más de 24 horas: pedile a Trade Marketing que la saque.' });
      await escribir('kaf_visitas?id=eq.' + b.id, 'DELETE', null, 'return=minimal');
      return json(200, { ok: true });
    }

    if (ac === 'registro') {
      const tipo = b.tipo;
      if (!REG_TIPOS.includes(tipo)) return json(400, { error: 'Tipo inválido.' });
      const datos = campos(REG_CAMPOS[tipo], b.datos || {});
      const archivos = Array.isArray(b.fotos) ? b.fotos.slice(0, 4) : [];
      if (tipo === 'evidencia' && !archivos.length) return json(400, { error: 'Sumá al menos una foto.' });
      if (tipo === 'evidencia' && !datos.calificacion) return json(400, { error: 'Marcá si la foto es de algo bien o mal ejecutado.' });
      if (tipo === 'capacitacion' && !datos.tema) return json(400, { error: 'Falta el tema de la capacitación.' });
      if (tipo === 'presupuesto' && (!datos.concepto || datos.monto == null)) return json(400, { error: 'Faltan el concepto y el monto.' });
      if ((tipo === 'perfect_serve' && !datos.trago && !datos.modelo_id) || (tipo === 'perfect_store' && !datos.modelo_id && !datos.surtido)) return json(400, { error: 'Elegí el modelo o completá lo que viste.' });
      let c;
      try { c = await clienteDe(b.codigo, tipo !== 'capacitacion'); } catch (e) { return json(400, { error: e.message }); }
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(b.fecha || '') && b.fecha <= hoyAR() && b.fecha >= sumaDias(hoyAR(), -60) ? b.fecha : hoyAR();
      let fotos = [];
      try { fotos = await subir(user.id + '/' + tipo + '/' + (c ? c.codigo.replace(/[^\w-]/g, '') : 'sin-cliente') + '-' + Date.now(), archivos, tipo === 'presupuesto'); }
      catch (e) { return json(400, { error: e.message }); }
      const fila = { usuario_id: user.id, tipo, cliente_codigo: c ? c.codigo : null, cliente_nombre: c ? c.nombre : null, fecha, datos, fotos, estado: tipo === 'presupuesto' ? 'pendiente' : 'nuevo' };
      let r;
      try { r = await escribir('kaf_registros', 'POST', fila); }
      catch (e) { await borrarArchivos(fotos); throw e; }
      const det = (c ? c.nombre + ' · ' : '') + (datos.concepto || datos.tema || datos.trago || datos.marca || REG_NOMBRE[tipo]) + (tipo === 'presupuesto' && datos.monto != null ? ' · $' + Math.round(datos.monto).toLocaleString('es-AR') : '');
      for (const t of await trade()) await avisar(t.id, { icono: tipo === 'presupuesto' ? '🧾' : '📷', titulo: (tipo === 'presupuesto' ? 'Presupuesto para aprobar' : REG_NOMBRE[tipo]) + ' de ' + quien, detalle: det, link: '/trade-kaf.html?kaf=' + user.id + '#registros' });
      return json(200, { ok: true, registro: r[0] });
    }
    if (ac === 'borrar_registro') {
      if (!esUuid(b.id)) return json(400, { error: 'Falta el registro.' });
      const x = (await hub('kaf_registros?id=eq.' + b.id + '&select=id,usuario_id,estado,fotos'))[0];
      if (!x || x.usuario_id !== user.id) return json(403, { error: 'Solo podés borrar lo tuyo.' });
      if (!['nuevo', 'pendiente'].includes(x.estado)) return json(400, { error: 'Ya lo revisó Trade Marketing: no se puede borrar.' });
      await escribir('kaf_registros?id=eq.' + b.id, 'DELETE', null, 'return=minimal');
      await borrarArchivos(x.fotos);
      return json(200, { ok: true });
    }

    if (ac === 'objetivo_estado') {
      if (!esUuid(b.id) || !['pendiente', 'logrado', 'no_logrado'].includes(b.estado)) return json(400, { error: 'Faltan datos.' });
      const x = (await hub('kaf_objetivos_cliente?id=eq.' + b.id + '&select=id,usuario_id'))[0];
      if (!x || x.usuario_id !== user.id) return json(403, { error: 'Ese objetivo no es tuyo.' });
      await escribir('kaf_objetivos_cliente?id=eq.' + b.id, 'PATCH', { estado: b.estado, nota_kaf: texto(b.nota, 500), updated_at: new Date().toISOString() }, 'return=minimal');
      return json(200, { ok: true });
    }

    if (ac === 'pedido') {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 60).map(i => ({ id: esUuid(i && i.id) ? i.id : null, nombre: texto(i && i.nombre, 160), cantidad: Math.max(1, Math.min(9999, Math.round(Number(i && i.cantidad) || 0))) })).filter(i => i.nombre && i.cantidad);
      if (!items.length) return json(400, { error: 'El pedido está vacío.' });
      // Los del catálogo, con el nombre de la base (no el del celular).
      const ids = items.filter(i => i.id).map(i => i.id);
      if (ids.length) {
        const mats = await man('materials_with_stock?id=in.(' + ids.join(',') + ')&select=id,name,stock_actual');
        const M = new Map(mats.map(m => [m.id, m]));
        items.forEach(i => { if (!i.id) return; const m = M.get(i.id); if (!m) { i.id = null; return; } i.nombre = m.name; i.stock = Number(m.stock_actual) || 0; });
      }
      let c = null;
      try { c = await clienteDe(b.codigo, false); } catch (e) { return json(400, { error: e.message }); }
      const fila = { usuario_id: user.id, solicitante: quien, cliente_codigo: c ? c.codigo : null, cliente_nombre: c ? c.nombre : null, items, nota: texto(b.nota, 1000) };
      const r = (await escribir('kaf_pedidos_materiales', 'POST', fila))[0];
      // Aviso a Andrea: campanita + celular. El mail lo manda el KAF desde su teléfono
      // (le preparamos el texto): el sistema todavía no manda mails solo.
      const andrea = (await hub('usuarios?email=eq.' + encodeURIComponent(MATERIALES_A) + '&activo=not.is.false&select=id'))[0];
      const resumen = items.map(i => i.cantidad + ' × ' + i.nombre).join(', ');
      const campanita = andrea ? await avisar(andrea.id, { icono: '📦', titulo: 'Pedido de materiales de ' + quien, detalle: (c ? c.nombre + ' · ' : '') + resumen.slice(0, 220), link: '/equipo-panel.html#materiales' }) : false;
      await escribir('kaf_pedidos_materiales?id=eq.' + r.id, 'PATCH', { aviso: { campanita, a: andrea ? MATERIALES_A : null } }, 'return=minimal');
      const cuerpo = 'Hola Andrea, te paso un pedido de materiales para emitir el remito.\n\n'
        + items.map(i => '- ' + i.cantidad + ' x ' + i.nombre).join('\n')
        + (c ? '\n\nCliente: ' + c.nombre + ' (' + c.codigo + ')' : '')
        + (fila.nota ? '\n\nNota: ' + fila.nota : '')
        + '\n\nPedido N° ' + r.id.slice(0, 8) + ' — también está en tu panel del Portal (Pedidos de materiales).\n' + quien;
      return json(200, { ok: true, pedido: r, avisoAndrea: campanita, mail: { para: MATERIALES_A, asunto: 'Pedido de materiales — ' + quien + (c ? ' — ' + c.nombre : ''), cuerpo } });
    }

    return json(400, { error: 'Acción inválida.' });
  } catch (e) {
    return json(502, { error: e.message || String(e) });
  }
};

module.exports.handler = require('./_errores').conErrores('kaf', exports.handler);
