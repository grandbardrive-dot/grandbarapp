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
// 'material' (13/11/2026): foto de un exhibidor o material en el punto de venta.
const REG_TIPOS = ['evidencia', 'perfect_serve', 'perfect_store', 'capacitacion', 'presupuesto', 'material'];
const REG_NOMBRE = { evidencia: 'Evidencia en PDV', perfect_serve: 'Perfect Serve', perfect_store: 'Perfect Store', capacitacion: 'Capacitación', presupuesto: 'Presupuesto', material: 'Exhibidor o material' };
// Qué datos guarda cada registro: [campo, tipo, largo]. Lo demás se descarta.
const REG_CAMPOS = {
  evidencia: [['marca', 't', 80], ['competencia', 'b'], ['calificacion', ['bien', 'mal']], ['comentario', 't', 1000]],
  perfect_serve: [['modelo_id', 'u'], ['trago', 't', 120], ['marca', 't', 80], ['medida_ml', 'n'], ['cristaleria', 't', 160], ['garnish', 't', 160], ['precio_carta', 'n'], ['cumple', ['si', 'parcial', 'no']], ['comentario', 't', 1000]],
  perfect_store: [['modelo_id', 'u'], ['surtido', 't', 1000], ['precios', 't', 600], ['exhibicion', 't', 400], ['cumple', ['si', 'parcial', 'no']], ['comentario', 't', 1000]],
  capacitacion: [['tema', 't', 200], ['marcas', 't', 200], ['participantes', 'n'], ['nombres', 't', 1000], ['comentario', 't', 1000]],
  presupuesto: [['concepto', 't', 200], ['monto', 'n'], ['descripcion', 't', 2000]],
  material: [['material', 't', 160], ['marca', 't', 80], ['comentario', 't', 1000]],
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
// Pernod Ricard (20/10/2026, Tomás Muñoz): en CUBO es el proveedor 01 de spirits (0201).
// Mumm (0110) y Etchart/Cafayate (0108) vienen de otros proveedores de CUBO: no van.
// Las seis primeras marcas son las "foco" de las oportunidades.
const PRESET_PERNOD = {
  marca: 'Pernod Ricard', prefijos: ['0201'], planillas_campari: false, region: 'mendoza',
  tipos: ['restaurante', 'bar', 'disco', 'evento'],
  marcas: ['Absolut', 'Havana Club', 'Beefeater', 'Chivas', 'Jameson', "Ballantine's", 'Malibu', 'Ramazzotti', 'Lillet', 'Monkey 47', 'Malfy', 'The Glenlivet',
    'Wyborowa', 'Orloff', 'Cusenier', 'Tia Maria', 'Tia Creamy', 'Ricard', 'Blenders', 'Hiram Walker', 'Doble V', 'Buhero Negro', 'Capri', 'Aberlour', 'Longmorn', 'Scapa', 'The Deacon', 'Brighton', 'Padilla', 'TX'],
};
// Peñaflor (13/11/2026, Maru Fanina): en CUBO son seis proveedores de vinos: 0102 Trapiche,
// 0112 Finca Las Moras, 0127 El Esteco, 0106 Navarro Correas y Los Árboles, 0194 Marantiqua y
// 0117 Frizze. Mumm (0110) y Antares (0512) quedan afuera: en el catálogo son otros proveedores.
// Maru trabaja OFF (vinotecas, Perfect Store). Las seis primeras marcas son las del 11T y van
// primero también para que "Trapiche Medalla" cuente como Medalla y no como Trapiche.
const PRESET_PENAFLOR = {
  marca: 'Peñaflor', prefijos: ['0102', '0112', '0127', '0106', '0194', '0117'], planillas_campari: false, region: 'mendoza',
  tipos: ['vinoteca', 'autoservicio', 'tienda de bebidas'],
  marcas: ['Alma Mora', 'Cazador', 'Don David', 'Fond de Cave', 'Medalla', 'La Mascota', 'Alaris', 'Trapiche', 'Navarro Correas', 'Colección Privada', 'Alegoria', 'Los Arboles',
    'San Telmo', 'Blend de Extremos', 'Elementos', 'Fincas Notables', 'Altimus', 'El Esteco', 'Los Intocables', 'Dada', 'Paz', 'El Bautismo', 'Las Moras', 'Costa & Pampa',
    'Sagrado Pedernal', 'Demencial', 'Marantiqua', 'Frizze'],
};
const PRESETS = [{ k: 'campari', n: 'Campari', p: PRESET_CAMPARI }, { k: 'pernod', n: 'Pernod Ricard', p: PRESET_PERNOD }, { k: 'penaflor', n: 'Peñaflor', p: PRESET_PENAFLOR }];

// ── Etapa 1 de la app de los KAF (13/11/2026, minuta de la reunión con Juan Pablo) ──
// Cada marca tiene su manual, como los rubros del vendedor: secciones en
// checklist_secciones con canal 'kaf_<marca>' (kaf_campari, kaf_pernod_ricard,
// kaf_penaflor), solo Mendoza. Juan Pablo y Luciana los arman en Secciones del manual
// y ubican ahí planes y campañas. Herramientas propias: w:kaf_acciones (lo de la marca
// para ese cliente) y w:kaf_foto (no se marca hecha sin foto).
const CAT_URL = 'https://zlwnoqdxendsgbfvfyue.supabase.co';
const CAT_KEY = 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4';
const slug = s => nrm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const manualKaf = P => 'kaf_' + slug(P && P.marca);
// Tipo de cliente → manual del vendedor (igual que manualDe en _checklist-data.js) y
// → valores de aplica_a de las campañas (igual que _canalesCliente en visita.html).
const MANUAL_VEND = { vinoteca: 'vinoteca', 'tienda de bebidas': 'tienda_bebidas', autoservicio: 'autoservicio', hotel: 'hotel', bar: 'bar', disco: 'disco', mayorista: 'mayorista', evento: 'evento' };
const manualVend = t => MANUAL_VEND[String(t || '').toLowerCase()] || 'restaurante';
const APLICA = {
  restaurante: ['restaurantes', 'restaurante'], vinoteca: ['vinotecas', 'vinoteca'], 'tienda de bebidas': ['tiendas_bebidas', 'tienda_bebidas', 'tienda de bebidas'],
  bar: ['bares', 'bar'], hotel: ['hoteles', 'hotel'], evento: ['eventos', 'evento'], disco: ['discos', 'discotecas', 'disco'],
  autoservicio: ['autoservicios', 'autoservicio', 'kioscos'], mayorista: ['mayorista', 'mayoristas', 'mayorista_mendoza', 'mayorista_sanluis'],
};
const canalCatalogo = t => (t === 'mayorista' ? 'mayorista' : TIPOS_ON.includes(t) ? 'on' : 'off');
const vigente = (ini, fin, hoy) => (!fin || String(fin).slice(0, 10) >= hoy) && (!ini || String(ini).slice(0, 10) <= hoy);
// ¿Es de la marca del KAF? Por el proveedor ("Grupo Peñaflor" = Peñaflor); si no tiene
// proveedor, por alguna de sus marcas en el nombre.
function deLaMarca(P, prov, txt) {
  const m = nrm(P.marca), p = nrm(prov);
  if (m && p) return p.includes(m) || m.includes(p);
  const t = ' ' + nrm(txt).replace(/[^a-z0-9 ]/g, ' ') + ' ';
  return !p && (P.marcas || []).some(x => { const k = nrm(x).replace(/[^a-z0-9 ]/g, ' ').trim(); return k && t.includes(' ' + k + ' '); });
}
// De qué sección del manual sale cada registro de foto de una visita.
const tipoRegDe = s => {
  const n = nrm(s.nombre) + ' ' + String(s.codigo || '');
  if (/serve/.test(n)) return 'perfect_serve';
  if (/store/.test(n)) return 'perfect_store';
  if (/material|exhibi/.test(n)) return 'material';
  if (/capacitac/.test(n)) return 'capacitacion';
  return 'evidencia';
};

// ── Etapa 2 de la app de los KAF, sin stock (13/11/2026) ──
// Exhibidores: lo que queda instalado en un cliente (heladera, exhibidor, cartel luminoso…),
// con foto. Son de la marca, no de la persona: si cambia el KAF, el nuevo los sigue viendo.
// Pedidos especiales: algo que no está en el catálogo y hay que presupuestar (ej. un fondo de
// barra). Los atiende Trade Marketing: presupuesta, aprueba o rechaza y avisa cuando está.
// El stock (cargar lo recibido, sacar, descontar al asignar) espera la mesa de trabajo con
// Juan Pablo, Laura (depósito) y Andrea.
const ESP_ESTADOS = ['pendiente', 'presupuestado', 'aprobado', 'rechazado', 'entregado'];
const ESP_NOMBRE = { pendiente: 'para presupuestar', presupuestado: 'presupuestado', aprobado: 'aprobado', rechazado: 'rechazado', entregado: 'entregado' };
const esDia = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

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
const ALIAS_MARCA = { skyy: ['sky'], espolon: ['espolon'], 'reserva san juan': ['san juan'], 'old smuggler': ['smuggler'],
  'ballantine s': ['ballantine'], 'havana club': ['havana'], 'the glenlivet': ['glenlivet'] };
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
  const prefs = (P.prefijos || []).filter(p => /^\d{2,6}$/.test(p));
  // Todos los clientes de GrandBar (minuta 13/11/2026: "el KAF ve todos los clientes"), no
  // solo los de su canal. Los tipos del perfil quedan como "Mi canal" en la lista.
  const [clientes, estados, vendedores, prods, t5, acu] = await Promise.all([
    manTodo('clientes?select=id,codigo_cliente,nombre,direccion,tipo,vendedor_id,activo,created_at&order=codigo_cliente'),
    manTodo('clientes_estado?select=codigo,activo&order=codigo'),
    man('vendedores?select=id,nombre,codigo,whatsapp&limit=500'),
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

  // Ventas de la marca de estos clientes, de a 150 códigos por consulta. Con todos los
  // clientes (13/11/2026) son ~13 consultas: de a 7 a la vez y sin contar filas (el conteo
  // de las 13 juntas hacía que la base cortara por tiempo).
  const porCli = new Map();
  if (prefs.length && visibles.length) {
    const cods = visibles.map(c => String(c.codigo_cliente)).filter(esCod);
    const trozos = [];
    for (let i = 0; i < cods.length; i += 150) trozos.push(cods.slice(i, i + 150));
    const filtro = '&or=(' + prefs.map(p => 'sku.like.' + p + '*').join(',') + ')&fecha=gte.' + VENTAS_DESDE + '&order=cliente_codigo,sku,fecha';
    const paginas = async path => {
      const out = [];
      for (let d = 0; d < 50000; d += 1000) {
        const r = await fetch(MAN_URL + '/rest/v1/' + path, { headers: manCab({ Range: d + '-' + (d + 999) }) });
        if (!r.ok) throw new Error('Manual ventas_cliente: ' + r.status);
        const l = await r.json();
        out.push(...l);
        if (l.length < 1000) break;
      }
      return out;
    };
    const lotes = [];
    for (let i = 0; i < trozos.length; i += 7) {
      lotes.push(...await Promise.all(trozos.slice(i, i + 7).map(t => paginas('ventas_cliente?select=cliente_codigo,sku,fecha,unidades,importe&cliente_codigo=in.(' + lista(t) + ')' + filtro))));
    }
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

// ── Lo de la marca que corre para un cliente (lo mismo que ve el vendedor) ─────
// Planes y campañas del manual del vendedor y acciones del catálogo de clientes, de
// ese proveedor, vigentes, de la zona y del rubro del cliente. Caché de 10 minutos.
let CACHE_ACC = { t: 0, d: null };
async function baseAcciones() {
  if (CACHE_ACC.d && Date.now() - CACHE_ACC.t < 10 * 60000) return CACHE_ACC.d;
  const cat = async p => { try { const r = await fetch(CAT_URL + '/rest/v1/' + p, { headers: { apikey: CAT_KEY, Authorization: 'Bearer ' + CAT_KEY } }); return r.ok ? r.json() : []; } catch (e) { return []; } };
  const [secs, planes, camps, catAcc, catProv] = await Promise.all([
    manTodo('checklist_secciones?activa=eq.true&select=id,canal&order=id'),
    manTodo('checklist_planes?activo=eq.true&select=id,nombre,proveedor,condicion,descripcion,lineas_participantes,reglas,secciones,seccion_id,zonas,fecha_inicio,fecha_fin,pdf_url&order=id'),
    manTodo('acciones_mensuales?activa=eq.true&select=id,producto,proveedor,accion,categoria,precio_regular,precio_accionado,varietales,aplica_a,secciones,zonas,fecha_inicio,fecha_fin,imagen_url&order=id'),
    cat('catalogo_acciones?activo=eq.true&select=id,proveedor_id,nombre_producto,mecanica,info_adicional,precio_accionado,precio_regular,porcentaje_off,canal,zonas,vigente_hasta,imagen_url&limit=3000'),
    cat('catalogo_proveedores?select=id,nombre&limit=1000'),
  ]);
  const d = { canalSec: new Map(secs.map(s => [s.id, s.canal])), planes, camps, catAcc, catProv: new Map(catProv.map(p => [p.id, p.nombre])) };
  CACHE_ACC = { t: Date.now(), d };
  return d;
}
function accionesCliente(A, P, c, zona) {
  const hoy = hoyAR(), canalVend = manualVend(c.tipo), alias = APLICA[c.tipo] || [c.tipo];
  const zOk = x => !Array.isArray(x.zonas) || !x.zonas.length || x.zonas.includes(zona);
  const secsDe = x => (Array.isArray(x.secciones) && x.secciones.length ? x.secciones : (x.seccion_id ? [x.seccion_id] : []));
  // Ubicada en secciones: tiene que haber alguna del manual de ese rubro (las de los
  // manuales KAF salen en la visita, en su sección).
  const enRubro = s => s.some(id => A.canalSec.get(id) === canalVend);
  const planes = A.planes.filter(p => deLaMarca(P, p.proveedor, p.nombre) && zOk(p) && vigente(p.fecha_inicio, p.fecha_fin, hoy) && (!secsDe(p).length || enRubro(secsDe(p))))
    .map(p => ({ id: p.id, titulo: p.nombre, condicion: p.condicion || '', desc: p.descripcion || '', lineas: p.lineas_participantes || [], reglas: p.reglas || [], hasta: p.fecha_fin || null, pdf: p.pdf_url || null }));
  const campanias = A.camps.filter(a => {
    if (!deLaMarca(P, a.proveedor, a.producto) || !zOk(a) || !vigente(a.fecha_inicio, a.fecha_fin, hoy)) return false;
    if (secsDe(a).length) return enRubro(secsDe(a));
    const ap = (Array.isArray(a.aplica_a) ? a.aplica_a : String(a.aplica_a || '').split(',')).map(x => nrm(x)).filter(Boolean);
    return !ap.length || ap.includes('todos') || ap.some(x => alias.includes(x));
  }).map(a => ({ id: a.id, titulo: a.producto || a.accion || 'Campaña', accion: a.accion || '', detalle: a.varietales || '', regular: a.precio_regular, accionado: a.precio_accionado, hasta: a.fecha_fin || null, imagen: a.imagen_url || null }));
  const canalCat = canalCatalogo(c.tipo);
  const catalogo = A.catAcc.filter(x => deLaMarca(P, A.catProv.get(x.proveedor_id), x.nombre_producto) && zOk(x) && (!x.vigente_hasta || String(x.vigente_hasta).slice(0, 10) >= hoy)
      && (x.canal === canalCat || (x.canal === 'ambos' && canalCat !== 'mayorista')))
    .map(x => ({ id: x.id, producto: x.nombre_producto, mecanica: x.mecanica || '', info: x.info_adicional || '', regular: x.precio_regular, accionado: x.precio_accionado, off: x.porcentaje_off, hasta: x.vigente_hasta || null, imagen: x.imagen_url || null }));
  return { planes, campanias, catalogo };
}

// Cómo compra el cliente (cliente_inteligencia, base del Manual): cada cuánto, la
// última compra y, de las sugerencias, solo los productos de la marca. Sin montos:
// el KAF ve unidades (los montos son de GrandBar).
async function comoCompra(P, codigo) {
  try {
    const r = await fetch(MAN_URL + '/rest/v1/rpc/cliente_inteligencia', { method: 'POST', headers: manCab({ 'Content-Type': 'application/json' }), body: JSON.stringify({ p_codigo: String(codigo) }) });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d) return null;
    const prefs = (P.prefijos || []).filter(p => /^\d{2,6}$/.test(p));
    const deMarca = x => prefs.some(p => String(x.sku || '').startsWith(p));
    return {
      cada_dias: d.cada_dias || null, ultima_compra: d.ultima_compra || null, dias_sin_comprar: d.dias_sin_comprar, pedidos_12m: d.pedidos_12m || 0,
      dejo: (d.dejo_de_comprar || []).filter(deMarca).map(x => ({ nombre: x.nombre, cada: x.cada, veces: x.veces, ultima: x.ultima, dias_sin: x.dias_sin })),
      parecidos: (d.compran_los_parecidos || []).filter(deMarca).map(x => ({ nombre: x.nombre, clientes: x.clientes, pct: x.pct, unidades: x.unidades_prom })),
      pares: d.pares || 0, tipo: d.tipo || null, zona: d.zona || null,
    };
  } catch (e) { return null; }
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

      // Pedidos especiales (para presupuestar): el KAF ve los suyos; Trade, los de todos.
      if (v === 'especiales') {
        let q = 'kaf_especiales?select=*&order=created_at.desc&limit=300';
        if (esKaf) q += '&usuario_id=eq.' + user.id;
        else if (!veTodo) return json(403, { error: 'No autorizado.' });
        else if (esUuid(qp.kaf)) q += '&usuario_id=eq.' + qp.kaf;
        const l = await hub(q);
        const url = await firmar([].concat(...l.map(x => (x.fotos || []).concat(x.presupuesto || []))));
        return json(200, { especiales: l.map(x => Object.assign(x, {
          fotos_url: (x.fotos || []).map(p => ({ url: url[p] || null, pdf: /\.pdf$/i.test(p) })),
          presupuesto_url: x.presupuesto ? { url: url[x.presupuesto] || null, pdf: /\.pdf$/i.test(x.presupuesto) } : null,
        })), puedeAtender: arma });
      }

      // Trade Marketing: los KAF que hay y cómo vienen este mes.
      if (v === 'kafs') {
        if (!veTodo) return json(403, { error: 'No autorizado.' });
        const users = await hub('usuarios?rol=eq.kaf&select=id,nombre,email,activo&order=nombre');
        const ids = users.map(u => u.id);
        const hoy = hoyAR(), mes = mesDe(hoy);
        const [perfiles, visitas, objetivos, regs, peds, esps] = ids.length ? await Promise.all([
          hub('kaf_perfiles?usuario_id=in.(' + ids.join(',') + ')&select=*'),
          hub('kaf_visitas?usuario_id=in.(' + ids.join(',') + ')&fecha=gte.' + mes + '-01T03:00:00Z&select=usuario_id,fecha,cliente_codigo&limit=5000'),
          hub('kaf_objetivos?usuario_id=in.(' + ids.join(',') + ')&mes=eq.' + mes + '&select=*'),
          hub('kaf_registros?usuario_id=in.(' + ids.join(',') + ')&estado=in.(nuevo,pendiente)&select=usuario_id,tipo&limit=2000'),
          hub('kaf_pedidos_materiales?usuario_id=in.(' + ids.join(',') + ')&estado=eq.enviado&select=usuario_id&limit=2000'),
          hub('kaf_especiales?usuario_id=in.(' + ids.join(',') + ')&estado=eq.pendiente&select=usuario_id&limit=2000').catch(() => []),
        ]) : [[], [], [], [], [], []];
        return json(200, {
          hoy, mes, preset: PRESET_CAMPARI, presets: PRESETS, secciones: SECCIONES,
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
              especialesAbiertos: esps.filter(p => p.usuario_id === u.id).length,
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
        // Dividido por marca (etapa 2): "mia" = de la marca del KAF, por el proveedor del
        // material o, si no tiene, por alguna de sus marcas en el nombre (como las acciones).
        const kidM = esKaf ? user.id : (esUuid(qp.kaf) ? qp.kaf : null);
        const [mats, brands, provs, cats, PM] = await Promise.all([
          manTodo('materials_with_stock?is_active=eq.true&visible_to_sellers=eq.true&select=id,name,description,instrucciones,pdf_url,video_url,processed_image_url,original_image_url,stock_actual,unit_type,brand_id,supplier_id,category_id,canales,requires_approval&order=name'),
          man('brands?select=id,name,supplier_id&limit=2000'),
          man('proveedores?select=id,nombre&limit=2000'),
          man('material_categories?select=id,name&limit=200'),
          kidM ? perfilDe(kidM) : null,
        ]);
        const B = new Map(brands.map(b => [b.id, b])), PV = new Map(provs.map(p => [p.id, p.nombre])), C = new Map(cats.map(c => [c.id, c.name]));
        return json(200, {
          marca: PM ? PM.marca : null,
          materiales: mats.map(m => {
            const b = B.get(m.brand_id), prov = PV.get(m.supplier_id || (b && b.supplier_id)) || '';
            return { id: m.id, nombre: m.name, descripcion: m.description || '', instrucciones: m.instrucciones || '', pdf: m.pdf_url || null, video: m.video_url || null,
              foto: m.processed_image_url || m.original_image_url || null, stock: Number(m.stock_actual) || 0, unidad: m.unit_type || '',
              marca: b ? b.name : '', proveedor: prov, categoria: C.get(m.category_id) || '', canales: m.canales || [], aprobacion: !!m.requires_approval,
              mia: PM ? deLaMarca(PM, prov, (b ? b.name + ' ' : '') + m.name) : false };
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

      // Exhibidores de la marca instalados en los clientes (todos, o los de un cliente).
      if (v === 'exhibidores') {
        let q = 'kaf_exhibidores?marca=eq.' + encodeURIComponent(P.marca) + '&select=*&order=instalado.desc,created_at.desc&limit=3000';
        if (esCod(qp.codigo)) q += '&cliente_codigo=eq.' + encodeURIComponent(qp.codigo);
        const ex = await hub(q);
        const url = await firmar([].concat(...ex.map(x => x.fotos || [])));
        return json(200, { marca: P.marca, exhibidores: ex.map(x => Object.assign(x, { fotos_url: (x.fotos || []).map(p => url[p] || null) })) });
      }

      // El manual de la marca: secciones con sus tareas, y los planes y campañas que
      // Luciana o Juan Pablo ubicaron en ellas (vigentes y de la zona).
      if (v === 'manual') {
        const canal = manualKaf(P), zona = P.region === 'san_luis' ? 'sanluis' : 'mendoza';
        const q = z => man('checklist_secciones?canal=eq.' + encodeURIComponent(canal) + '&zona=eq.' + z + '&activa=eq.true&select=id,codigo,nombre,descripcion,intro,especial,parent_id,orden,pdf_url&order=orden');
        let secs = await q(zona);
        if (!secs.length && zona !== 'mendoza') secs = await q('mendoza');
        if (!secs.length) return json(200, { canal, secciones: [] });
        const ids = secs.map(s => s.id), hoy = hoyAR(), zOk = x => !Array.isArray(x.zonas) || !x.zonas.length || x.zonas.includes(zona);
        const [items, planes, camps] = await Promise.all([
          man('checklist_items?seccion_id=in.(' + ids.join(',') + ')&activo=eq.true&select=seccion_id,texto,descripcion,orden&order=orden&limit=2000'),
          man('checklist_planes?activo=eq.true&or=(secciones.ov.{' + ids.join(',') + '},seccion_id.in.(' + ids.join(',') + '))&select=id,nombre,proveedor,condicion,descripcion,lineas_participantes,reglas,secciones,seccion_id,zonas,fecha_inicio,fecha_fin,pdf_url&limit=500'),
          man('acciones_mensuales?activa=eq.true&secciones=ov.{' + ids.join(',') + '}&select=id,producto,proveedor,accion,varietales,precio_regular,precio_accionado,secciones,zonas,fecha_inicio,fecha_fin,imagen_url&limit=500'),
        ]);
        const deSec = (x, id) => (Array.isArray(x.secciones) && x.secciones.length ? x.secciones : [x.seccion_id]).includes(id);
        const nodo = s => ({
          id: s.id, codigo: s.codigo, nombre: s.nombre, descripcion: s.descripcion || '', intro: s.intro || '', especial: s.especial || '', pdf: s.pdf_url || null,
          items: items.filter(i => i.seccion_id === s.id).map(i => ({ texto: i.texto, detalle: i.descripcion || '' })),
          planes: planes.filter(p => deSec(p, s.id) && zOk(p) && vigente(p.fecha_inicio, p.fecha_fin, hoy))
            .map(p => ({ id: p.id, titulo: p.nombre, proveedor: p.proveedor || '', condicion: p.condicion || '', desc: p.descripcion || '', lineas: p.lineas_participantes || [], reglas: p.reglas || [], hasta: p.fecha_fin || null, pdf: p.pdf_url || null })),
          campanias: camps.filter(a => deSec(a, s.id) && zOk(a) && vigente(a.fecha_inicio, a.fecha_fin, hoy))
            .map(a => ({ id: a.id, titulo: a.producto || a.accion || 'Campaña', proveedor: a.proveedor || '', accion: a.accion || '', detalle: a.varietales || '', regular: a.precio_regular, accionado: a.precio_accionado, hasta: a.fecha_fin || null, imagen: a.imagen_url || null })),
        });
        const madres = secs.filter(s => !s.parent_id || !ids.includes(s.parent_id));
        return json(200, { canal, secciones: madres.map(m => Object.assign(nodo(m), { sub: secs.filter(h => h.parent_id === m.id).map(nodo) })) });
      }

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
        if (!c) return json(404, { error: 'Ese cliente no está en tu lista (otra zona u oculto).' });
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
        const vd = D.vend.get(c.vendedor_id) || {};
        const zonaCli = vd.codigo && SAN_LUIS_CODIGOS.has(String(vd.codigo).trim()) ? 'sanluis' : 'mendoza';
        const [vis, regs, objs, A, compra, exh] = await Promise.all([
          hub('kaf_visitas?usuario_id=eq.' + kid + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo_cliente) + '&select=*&order=fecha.desc&limit=100'),
          hub('kaf_registros?usuario_id=eq.' + kid + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo_cliente) + '&select=id,tipo,fecha,estado,datos,created_at,visita_id&order=created_at.desc&limit=100'),
          hub('kaf_objetivos_cliente?usuario_id=eq.' + kid + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo_cliente) + '&select=*&order=mes.desc,created_at&limit=60'),
          baseAcciones().catch(() => null),
          comoCompra(P, c.codigo_cliente),
          hub('kaf_exhibidores?marca=eq.' + encodeURIComponent(P.marca) + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo_cliente) + '&select=*&order=estado.asc,instalado.desc&limit=100').catch(() => []),
        ]);
        const urlEx = await firmar([].concat(...exh.map(x => x.fotos || [])));
        exh.forEach(x => { x.fotos_url = (x.fotos || []).map(p => urlEx[p] || null); });
        return json(200, { cliente: r, meses, porMes: tabla, acuerdos: D.acuerdos.get(normCod(c.codigo_cliente)) || [], visitas: vis, registros: regs, objetivos: objs, marcas5t: MARCAS_5T, plata,
          vendedor: { nombre: vd.nombre || '', codigo: vd.codigo || '', whatsapp: vd.whatsapp || '' }, zona: zonaCli,
          acciones: A ? accionesCliente(A, P, c, zonaCli) : null, compra, exhibidores: exh });
      }

      if (v === 'visitas') {
        const hoy = hoyAR();
        const desde = /^\d{4}-\d{2}-\d{2}$/.test(qp.desde || '') ? qp.desde : lunesDe(hoy);
        const hasta = /^\d{4}-\d{2}-\d{2}$/.test(qp.hasta || '') ? qp.hasta : hoy;
        // Límites del día en Argentina (UTC−3).
        const vis = await hub('kaf_visitas?usuario_id=eq.' + kid + '&fecha=gte.' + desde + 'T03:00:00Z&fecha=lt.' + sumaDias(hasta, 1) + 'T03:00:00Z&select=*&order=fecha.desc&limit=5000');
        const obj = await hub('kaf_objetivos?usuario_id=eq.' + kid + '&mes=in.(' + [...new Set([mesDe(desde), mesDe(hasta)])].join(',') + ')&select=mes,visitas_dia');
        // Fotos del recorrido (links que vencen en una hora).
        const url = await firmar([].concat(...vis.map(x => x.fotos || [])));
        vis.forEach(x => { x.fotos_url = {}; (x.fotos || []).forEach(p => { if (url[p]) x.fotos_url[p] = url[p]; }); });
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

    // ---------- Trade Marketing: atiende un pedido especial ----------
    // pendiente → presupuestado (monto, proveedor, archivo) → aprobado / rechazado → entregado.
    if (ac === 'atender_especial') {
      if (!arma) return json(403, { error: 'Los pedidos especiales los atiende Trade Marketing.' });
      if (!esUuid(b.id) || !ESP_ESTADOS.includes(b.estado)) return json(400, { error: 'Faltan datos.' });
      const x = (await hub('kaf_especiales?id=eq.' + b.id + '&select=id,usuario_id,que,cantidad,cliente_nombre,estado,monto,presupuesto'))[0];
      if (!x) return json(404, { error: 'No encontré el pedido.' });
      const respuesta = texto(b.respuesta, 800);
      const n = b.monto == null || b.monto === '' ? null : Number(String(b.monto).replace(/\$|\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      if (n != null && !(isFinite(n) && n >= 0 && n < 1e11)) return json(400, { error: 'El monto no es un número.' });
      const monto = n != null ? Math.round(n * 100) / 100 : x.monto;
      if (b.estado === 'presupuestado' && !(monto > 0)) return json(400, { error: 'Poné el monto del presupuesto.' });
      if (b.estado === 'rechazado' && !respuesta) return json(400, { error: 'Contale por qué no sale.' });
      let archivo = x.presupuesto;
      if (b.archivo) {
        try { [archivo] = await subir('trade/especiales/' + x.id + '-' + Date.now(), [b.archivo], true); } catch (e) { return json(400, { error: e.message }); }
        if (x.presupuesto) await borrarArchivos([x.presupuesto]);
      }
      const ahora = new Date().toISOString();
      const cambios = { estado: b.estado, monto, proveedor: b.proveedor !== undefined ? texto(b.proveedor, 160) : undefined, presupuesto: archivo, respuesta, updated_at: ahora,
        atendido_por: b.estado === 'pendiente' ? null : quien, atendido_at: b.estado === 'pendiente' ? null : ahora };
      if (cambios.proveedor === undefined) delete cambios.proveedor;
      await escribir('kaf_especiales?id=eq.' + x.id, 'PATCH', cambios, 'return=minimal');
      if (b.estado !== 'pendiente') await avisar(x.usuario_id, { icono: b.estado === 'rechazado' ? '✖️' : '🧾', titulo: 'Pedido especial ' + ESP_NOMBRE[b.estado],
        detalle: x.cantidad + ' × ' + x.que + (x.cliente_nombre ? ' · ' + x.cliente_nombre : '') + (b.estado === 'presupuestado' && monto ? ' · $' + Math.round(monto).toLocaleString('es-AR') : '') + (respuesta ? ' — ' + respuesta.slice(0, 200) : ''),
        link: '/kaf.html#materiales/especiales' });
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
      return { codigo: c.codigo_cliente, nombre: c.nombre, tipo: c.tipo, vendedor: v ? v.nombre : null, vendedorCodigo: v && v.codigo ? String(v.codigo).trim() : null };
    }

    // Una foto del recorrido de la visita: se sube apenas se saca (así la visita no viaja
    // con todas las fotos juntas) y la visita después guarda las rutas.
    if (ac === 'foto') {
      try {
        const [p] = await subir(user.id + '/visitas/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), [b.foto], false);
        const url = await firmar([p]);
        return json(200, { ok: true, path: p, url: url[p] || null });
      } catch (e) { return json(400, { error: e.message }); }
    }

    if (ac === 'visita') {
      let c;
      try { c = await clienteDe(b.codigo, true); } catch (e) { return json(400, { error: e.message }); }
      // Recorrido del manual de la marca (etapa 1, 13/11/2026). Se valida contra la base:
      // solo secciones de su manual, solo fotos suyas de visitas, y las secciones "con foto
      // obligatoria" (w:kaf_foto) no se pueden dar por hechas sin foto.
      let detalle = null, fotosVis = [], secsVis = [];
      if (Array.isArray(b.secciones)) {
        const pref = user.id + '/visitas/';
        const SD = new Map((await man('checklist_secciones?canal=eq.' + encodeURIComponent(manualKaf(P)) + '&select=id,codigo,nombre,especial')).map(s => [s.id, s]));
        for (const s of b.secciones.slice(0, 40)) {
          const sd = SD.get(s && s.id);
          if (!sd) continue;
          const fotos = (Array.isArray(s.fotos) ? s.fotos : []).map(String).filter(p => p.startsWith(pref) && /^[\w\/.-]+$/.test(p)).slice(0, 8);
          const items = (Array.isArray(s.items) ? s.items : []).map(t => texto(t, 300)).filter(Boolean).slice(0, 60);
          const hecho = s.hecho === true, comentario = texto(s.comentario, 1000);
          if (!hecho && !fotos.length && !items.length && !comentario) continue;
          if (hecho && sd.especial === 'w:kaf_foto' && !fotos.length) return json(400, { error: '"' + sd.nombre + '" va con foto: sacala o subila antes de guardar.' });
          secsVis.push({ sd, fotos, items, comentario });
          detalle = detalle || { secciones: [] };
          detalle.secciones.push({ id: sd.id, codigo: sd.codigo, titulo: sd.nombre, hecho, items, comentario, fotos });
          fotosVis.push(...fotos);
        }
        if (detalle) detalle.nota_vendedor = texto(b.nota, 1000);
      }
      const ahora = Date.now();
      let fecha = new Date(ahora);
      if (b.cuando) {
        const f = new Date(b.cuando);
        if (isNaN(f)) return json(400, { error: 'Fecha inválida.' });
        if (f.getTime() > ahora + 5 * 60000) return json(400, { error: 'No se puede marcar una visita que todavía no pasó.' });
        if (f.getTime() < ahora - 7 * 864e5) return json(400, { error: 'Solo se pueden cargar visitas de los últimos 7 días.' });
        fecha = f;
      }
      // Dos toques seguidos no hacen dos visitas. Si antes solo marcó que pasó y ahora carga
      // el recorrido, se completa esa misma visita.
      const previa = (await hub('kaf_visitas?usuario_id=eq.' + user.id + '&cliente_codigo=eq.' + encodeURIComponent(c.codigo) + '&fecha=gte.' + new Date(fecha.getTime() - 30 * 60000).toISOString() + '&fecha=lte.' + new Date(fecha.getTime() + 30 * 60000).toISOString() + '&select=id,fecha,detalle&limit=1'))[0];
      if (previa && (!detalle || previa.detalle)) return json(200, { ok: true, repetida: true, visita: previa });
      const fila = { detalle, fotos: fotosVis, nota: texto(b.nota, 1000) };
      const r = previa
        ? await escribir('kaf_visitas?id=eq.' + previa.id, 'PATCH', fila)
        : await escribir('kaf_visitas', 'POST', Object.assign({ usuario_id: user.id, cliente_codigo: c.codigo, cliente_nombre: c.nombre, tipo_cliente: c.tipo, vendedor: c.vendedor, fecha: fecha.toISOString() }, fila));
      const vis = r[0];
      if (!detalle) return json(200, { ok: true, visita: vis });

      // Las fotos de cada sección quedan también como registros: Juan Pablo las revisa con
      // lo demás (Perfect Serve, Perfect Store, exhibidores…) y salen en la ficha del cliente.
      const dia = diaAR(fecha);
      const regs = secsVis.filter(s => s.fotos.length).map(s => ({ usuario_id: user.id, tipo: tipoRegDe(s.sd), cliente_codigo: c.codigo, cliente_nombre: c.nombre, fecha: dia,
        datos: Object.assign({ seccion: s.sd.nombre }, s.comentario ? { comentario: s.comentario } : {}, s.items.length ? { tareas: s.items } : {}), fotos: s.fotos, estado: 'nuevo', visita_id: vis.id }));
      if (regs.length) await escribir('kaf_registros', 'POST', regs, 'return=minimal');

      const hechas = detalle.secciones.filter(s => s.hecho).map(s => s.titulo);
      const resumen = (hechas.length ? hechas.join(', ') : 'Pasó por el punto de venta') + (fotosVis.length ? ' · ' + fotosVis.length + (fotosVis.length === 1 ? ' foto' : ' fotos') : '');
      for (const t of await trade()) await avisar(t.id, { icono: '📍', titulo: 'Visita de ' + quien + ' a ' + c.nombre, detalle: resumen + (detalle.nota_vendedor ? ' · ' + detalle.nota_vendedor : ''), link: '/trade-kaf.html?kaf=' + user.id + '#visitas' });

      // Aviso al vendedor del cliente (el KAF no carga ventas: ejecuta y le avisa).
      const aviso = { vendedor: c.vendedor || null, a: [], campanita: false };
      if (b.avisar !== false && c.vendedorCodigo) {
        const us = await hub('usuarios?codigo_vendedor=eq.' + encodeURIComponent(c.vendedorCodigo) + '&activo=not.is.false&select=id').catch(() => []);
        for (const u of us) {
          const ok = await avisar(u.id, { icono: '📍', titulo: quien + ' (KAF ' + P.marca + ') visitó a ' + c.nombre, detalle: resumen + (detalle.nota_vendedor ? ' · Nota: ' + detalle.nota_vendedor : ''), link: '/manual-vendedores/clientes.html' });
          aviso.a.push(u.id); aviso.campanita = aviso.campanita || ok;
        }
      }
      await escribir('kaf_visitas?id=eq.' + vis.id, 'PATCH', { aviso }, 'return=minimal').catch(() => {});
      return json(200, { ok: true, visita: Object.assign(vis, { aviso }) });
    }
    if (ac === 'borrar_visita') {
      if (!esUuid(b.id)) return json(400, { error: 'Falta la visita.' });
      const x = (await hub('kaf_visitas?id=eq.' + b.id + '&select=id,usuario_id,registrada_at,fotos'))[0];
      if (!x || x.usuario_id !== user.id) return json(403, { error: 'Solo podés borrar tus visitas.' });
      if (Date.now() - new Date(x.registrada_at).getTime() > 24 * 3600000) return json(400, { error: 'Pasaron más de 24 horas: pedile a Trade Marketing que la saque.' });
      // Con la visita se van sus registros de fotos y los archivos.
      await escribir('kaf_registros?visita_id=eq.' + b.id + '&usuario_id=eq.' + user.id, 'DELETE', null, 'return=minimal');
      await escribir('kaf_visitas?id=eq.' + b.id, 'DELETE', null, 'return=minimal');
      await borrarArchivos(x.fotos);
      return json(200, { ok: true });
    }

    if (ac === 'registro') {
      const tipo = b.tipo;
      if (!REG_TIPOS.includes(tipo)) return json(400, { error: 'Tipo inválido.' });
      const datos = campos(REG_CAMPOS[tipo], b.datos || {});
      const archivos = Array.isArray(b.fotos) ? b.fotos.slice(0, 4) : [];
      if ((tipo === 'evidencia' || tipo === 'material') && !archivos.length) return json(400, { error: 'Sumá al menos una foto.' });
      if (tipo === 'evidencia' && !datos.calificacion) return json(400, { error: 'Marcá si la foto es de algo bien o mal ejecutado.' });
      if (tipo === 'capacitacion' && !datos.tema) return json(400, { error: 'Falta el tema de la capacitación.' });
      if (tipo === 'presupuesto' && (!datos.concepto || datos.monto == null)) return json(400, { error: 'Faltan el concepto y el monto.' });
      // Desde el botón de la cámara alcanza con la foto (13/11/2026); sin foto hay que contar qué se vio.
      if (!archivos.length && ((tipo === 'perfect_serve' && !datos.trago && !datos.modelo_id) || (tipo === 'perfect_store' && !datos.modelo_id && !datos.surtido))) return json(400, { error: 'Elegí el modelo, completá lo que viste o sumá una foto.' });
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
      const x = (await hub('kaf_registros?id=eq.' + b.id + '&select=id,usuario_id,estado,fotos,visita_id'))[0];
      if (!x || x.usuario_id !== user.id) return json(403, { error: 'Solo podés borrar lo tuyo.' });
      if (x.visita_id) return json(400, { error: 'Estas fotos son de una visita: se borran borrando la visita (Mis visitas).' });
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

    // ---------- Exhibidores instalados en un cliente (etapa 2) ----------
    // Alta (con foto), edición, fotos nuevas para mostrar que sigue ahí, y retiro.
    if (ac === 'exhibidor') {
      const id = esUuid(b.id) ? b.id : null;
      let viejo = null, c = null;
      if (id) {
        viejo = (await hub('kaf_exhibidores?id=eq.' + id + '&select=*'))[0];
        if (!viejo || viejo.marca !== P.marca) return json(403, { error: 'Ese exhibidor no es de tu marca.' });
      } else {
        try { c = await clienteDe(b.codigo, true); } catch (e) { return json(400, { error: e.message }); }
      }
      // Si sale del catálogo de materiales, con el nombre y la marca de la base.
      let material = texto(b.material, 160), material_id = null, linea = texto(b.linea, 80);
      if (esUuid(b.material_id)) {
        const m = (await man('materials_with_stock?id=eq.' + b.material_id + '&select=id,name,brand_id'))[0];
        if (m) {
          material_id = m.id; material = m.name;
          const br = m.brand_id ? (await man('brands?id=eq.' + m.brand_id + '&select=name'))[0] : null;
          if (br) linea = br.name;
        }
      }
      const hoy = hoyAR();
      const cantidad = Math.max(1, Math.min(999, Math.round(Number(b.cantidad) || 1)));
      const instalado = esDia(b.instalado) ? b.instalado : hoy;
      if (instalado > hoy) return json(400, { error: 'La fecha de instalación no puede ser futura.' });
      const archivos = (Array.isArray(b.fotos) ? b.fotos : []).slice(0, 4);
      if (!viejo && !material) return json(400, { error: 'Elegí o escribí qué exhibidor es.' });
      if (!viejo && !archivos.length) return json(400, { error: 'Sacale una foto al exhibidor instalado.' });
      let fotos = [];
      if (archivos.length) {
        const cod = String(c ? c.codigo : viejo.cliente_codigo).replace(/[^\w-]/g, '');
        try { fotos = await subir(user.id + '/exhibidores/' + cod + '-' + Date.now(), archivos, false); } catch (e) { return json(400, { error: e.message }); }
      }
      const ahora = new Date().toISOString();
      if (!viejo) {
        const fila = { usuario_id: user.id, marca: P.marca, cliente_codigo: c.codigo, cliente_nombre: c.nombre, material_id, material, linea, cantidad, instalado, fotos, nota: texto(b.nota, 1000), foto_at: ahora };
        const r = (await escribir('kaf_exhibidores', 'POST', fila))[0];
        const det = cantidad + ' × ' + material + (fila.nota ? ' · ' + fila.nota : '');
        for (const t of await trade()) await avisar(t.id, { icono: '📦', titulo: 'Exhibidor instalado por ' + quien + ' en ' + c.nombre, detalle: det, link: '/trade-kaf.html?kaf=' + user.id + '#materiales' });
        // Al vendedor del cliente, como la visita (el KAF ejecuta y le avisa).
        let campanita = false;
        if (b.avisar !== false && c.vendedorCodigo) {
          const us = await hub('usuarios?codigo_vendedor=eq.' + encodeURIComponent(c.vendedorCodigo) + '&activo=not.is.false&select=id').catch(() => []);
          for (const u of us) campanita = (await avisar(u.id, { icono: '📦', titulo: quien + ' (KAF ' + P.marca + ') instaló un exhibidor en ' + c.nombre, detalle: det, link: '/manual-vendedores/clientes.html' })) || campanita;
        }
        return json(200, { ok: true, exhibidor: r, avisoVendedor: campanita ? c.vendedor : null });
      }
      const cambios = { updated_at: ahora };
      if (material) Object.assign(cambios, { material, material_id, linea });
      if (b.cantidad != null) cambios.cantidad = cantidad;
      if (esDia(b.instalado)) cambios.instalado = instalado;
      if (b.nota !== undefined) cambios.nota = texto(b.nota, 1000);
      let todas = viejo.fotos || [], sobran = [];
      if (Array.isArray(b.quitar) && b.quitar.length) { sobran = todas.filter(p => b.quitar.includes(p)); todas = todas.filter(p => !b.quitar.includes(p)); }
      if (fotos.length) { todas = todas.concat(fotos); cambios.foto_at = ahora; }
      if (todas.length > 12) { sobran = sobran.concat(todas.slice(0, todas.length - 12)); todas = todas.slice(-12); }
      if (fotos.length || sobran.length) cambios.fotos = todas;
      if (b.estado === 'retirado') Object.assign(cambios, { estado: 'retirado', retirado: esDia(b.retirado) && b.retirado <= hoy ? b.retirado : hoy, retiro_nota: texto(b.retiro_nota, 500) });
      else if (b.estado === 'instalado') Object.assign(cambios, { estado: 'instalado', retirado: null, retiro_nota: null });
      const r = (await escribir('kaf_exhibidores?id=eq.' + id, 'PATCH', cambios))[0];
      if (sobran.length) await borrarArchivos(sobran);
      return json(200, { ok: true, exhibidor: r });
    }
    if (ac === 'borrar_exhibidor') {
      if (!esUuid(b.id)) return json(400, { error: 'Falta el exhibidor.' });
      const x = (await hub('kaf_exhibidores?id=eq.' + b.id + '&select=id,usuario_id,fotos,created_at'))[0];
      if (!x || x.usuario_id !== user.id) return json(403, { error: 'Solo podés borrar los que cargaste vos.' });
      if (Date.now() - new Date(x.created_at) > 7 * 864e5) return json(400, { error: 'Se cargó hace más de una semana: si ya no está, marcalo como retirado.' });
      await escribir('kaf_exhibidores?id=eq.' + b.id, 'DELETE', null, 'return=minimal');
      await borrarArchivos(x.fotos);
      return json(200, { ok: true });
    }

    // ---------- Pedido especial: algo que no hay y hay que presupuestar (etapa 2) ----------
    if (ac === 'especial') {
      const que = texto(b.que, 200);
      if (!que) return json(400, { error: 'Contá qué necesitás.' });
      let c = null;
      try { c = await clienteDe(b.codigo, false); } catch (e) { return json(400, { error: e.message }); }
      const archivos = (Array.isArray(b.fotos) ? b.fotos : []).slice(0, 4);
      let fotos = [];
      if (archivos.length) {
        try { fotos = await subir(user.id + '/especiales/' + (c ? c.codigo.replace(/[^\w-]/g, '') : 'sin-cliente') + '-' + Date.now(), archivos, true); } catch (e) { return json(400, { error: e.message }); }
      }
      const fila = { usuario_id: user.id, solicitante: quien, marca: P.marca, cliente_codigo: c ? c.codigo : null, cliente_nombre: c ? c.nombre : null, que,
        cantidad: Math.max(1, Math.min(9999, Math.round(Number(b.cantidad) || 1))), medidas: texto(b.medidas, 300), detalle: texto(b.detalle, 2000),
        para_cuando: esDia(b.para_cuando) ? b.para_cuando : null, fotos };
      const r = (await escribir('kaf_especiales', 'POST', fila))[0];
      for (const t of await trade()) await avisar(t.id, { icono: '🧾', titulo: 'Pedido especial de ' + quien + ' para presupuestar', detalle: fila.cantidad + ' × ' + que + (c ? ' · ' + c.nombre : '') + (fila.para_cuando ? ' · para el ' + fila.para_cuando.split('-').reverse().join('/') : ''), link: '/trade-kaf.html?kaf=' + user.id + '#materiales' });
      return json(200, { ok: true, especial: r });
    }
    if (ac === 'borrar_especial') {
      if (!esUuid(b.id)) return json(400, { error: 'Falta el pedido.' });
      const x = (await hub('kaf_especiales?id=eq.' + b.id + '&select=id,usuario_id,estado,fotos'))[0];
      if (!x || x.usuario_id !== user.id) return json(403, { error: 'Ese pedido no es tuyo.' });
      if (x.estado !== 'pendiente') return json(400, { error: 'Trade Marketing ya lo está atendiendo: escribile a Juan Pablo.' });
      await escribir('kaf_especiales?id=eq.' + b.id, 'DELETE', null, 'return=minimal');
      await borrarArchivos(x.fotos);
      return json(200, { ok: true });
    }

    if (ac === 'pedido') {
      const items =(Array.isArray(b.items) ? b.items : []).slice(0, 60).map(i => ({ id: esUuid(i && i.id) ? i.id : null, nombre: texto(i && i.nombre, 160), cantidad: Math.max(1, Math.min(9999, Math.round(Number(i && i.cantidad) || 0))) })).filter(i => i.nombre && i.cantidad);
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
