// ============================================================
//  GrandBar Hub · Function · lugares-libres  (23/10/2026)
//   Lugares del manual de vendedores donde hoy no hay NINGUNA acción, para avisarle
//   al proveedor en su portal (anuncio del inicio y marcas en "Manual de vendedores"):
//   "sé el primero en cargar una acción ahí".
//   - Un "lugar" es una subsección (o una sección sin subsecciones) de los manuales de
//     Mendoza donde una acción de proveedor tiene sentido. No cuentan las de estructura
//     (introducción, cierre, materiales, vidrieras, beneficios con su herramienta…) ni
//     las herramientas del vendedor (buscador de precios, coctelería, seguimiento…).
//   - Está ocupado si el vendedor ya ve algo ahí: un plan, una campaña, una fecha
//     especial, una oferta del catálogo, una acción de las herramientas de Luciana
//     (punteras, volumen, degustaciones, sobre la mesa, vino por copa, mixes,
//     aperitivos, frigobar, incorporaciones) o una propuesta de proveedor pendiente o
//     aprobada. Mismo criterio que la visita (widgetDe en visita.html), simplificado.
//   - Las secciones con nombre de un proveedor (GRUPO PEÑAFLOR, ZUELO…) solo se le
//     ofrecen a ese proveedor.
//   Lo del manual se calcula una vez cada 10 minutos; las propuestas se leen en cada
//   pedido, así un lugar deja de salir apenas alguien propone ahí. Después se ordena
//   para el proveedor: primero los de su categoría (vinos, spirits, cervezas).
//   El equipo puede ver lo de una empresa con ?empresa=.
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const CAT_URL = 'https://zlwnoqdxendsgbfvfyue.supabase.co';
const CAT_KEY = 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4';
const EQUIPO = ['desarrollo', 'diseno', 'compras', 'marketing', 'direccion'];
const RUBROS = ['restaurante', 'bar', 'vinoteca', 'autoservicio', 'tienda_bebidas', 'hotel', 'disco', 'evento', 'mayorista'];
// Cómo nombran el rubro las campañas (aplica_a), igual que _canalesCliente de la visita.
const ALIAS = {
  restaurante: ['restaurantes', 'restaurante'], vinoteca: ['vinotecas', 'vinoteca'],
  tienda_bebidas: ['tiendas_bebidas', 'tienda_bebidas', 'tienda de bebidas'], bar: ['bares', 'bar'],
  hotel: ['hoteles', 'hotel'], evento: ['eventos', 'evento'], disco: ['discos', 'discotecas', 'disco'],
  autoservicio: ['autoservicios', 'autoservicio', 'kioscos'], mayorista: ['mayorista', 'mayoristas', 'mayorista_mendoza', 'mayorista_sanluis'],
};
const OFF = ['vinoteca', 'tienda_bebidas', 'autoservicio'];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
// Nombre de proveedor para comparar: sin acentos ni "grupo/group/bodega(s)" (igual que proveedor-materiales).
const nrmProv = s => nrm(s).replace(/\b(grupo|group|bodegas?|s\.?a\.?)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const mismaEmpresa = (a, b) => a.length >= 4 && b.length >= 4 && (a === b || (' ' + a + ' ').includes(' ' + b + ' ') || (' ' + b + ' ').includes(' ' + a + ' '));
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

// Categoría de producto por el nombre (subsección primero, después la madre): como
// _categoriaDeSeccion de la visita.
function catDe(nombre) {
  const n = nrm(nombre).toUpperCase();
  if (n.includes('VINO')) return 'vinos';
  if (n.includes('SPIRIT') || n.includes('APERITIV')) return 'spirits';
  if (n.includes('RTD') || n.includes('FRIO') || n.includes('HELADERA') || n.includes('CERVEZA')) return 'cervezas';
  if (n.includes('CAFE')) return 'cafe';
  return null;
}
function catCampania(a) {
  const c = nrm(a.categoria);
  if (!c) return '';
  if (/vino|espumant/.test(c)) return 'vinos';
  if (/spirit|aperitiv|destilad/.test(c)) return 'spirits';
  if (/cervez|rtd|frio/.test(c)) return 'cervezas';
  return c;
}

// Qué muestra la visita en cada sección (widgetDe de visita.html y DC_WIDGETS de
// _disco-tools.js). 'no' = herramienta del vendedor o estructura: no es un lugar.
const POR_W = {
  ofertas: 'ofertas', propuestas_vino: 'propuestas:vino', propuestas_spirit: 'propuestas:spirit', propuestas_futuras: 'propuestas:futuras',
  vino_copa: 'copa', aperitivos: 'aperitivos', mix_ideal: 'mix', frigobar: 'frigobar', calendario: 'calendario',
  punteras: 'plano', volumen: 'plano', degustaciones: 'plano', vinos_mesa: 'plano',
};
const POR_CODIGO = {
  s1: 'propuestas:vino', sp_incorp: 'propuestas:spirit', precio_futuras: 'propuestas:futuras', vt_incorporaciones: 'propuestas:vino',
  s2: 'ofertas', s_acciones_mensuales: 'ofertas', sp_rotacion: 'ofertas', sp_mensuales: 'ofertas', cafe_acciones: 'ofertas',
  vt_acciones_mensuales: 'ofertas', vt_acciones_de_rotacion: 'ofertas', vt_gondola_spirits: 'ofertas', vt_heladera: 'ofertas',
  oportunidades_en_carta: 'mix', vino_por_copa: 'copa', vino_por_copa_de_bienvenid: 'copa', pre_armados: 'frigobar',
  proximas_fechas: 'calendario', fe_fechas: 'calendario',
  sp_campari: 'no', desarrollo_de_cocteleria: 'no', proponer_activacion: 'no', seguimiento: 'no', materiales_entregados_evid: 'no',
  oportunidades_de_visibilid: 'no', fe_materiales: 'no', cafe_catalogos: 'no', cafe_preguntas: 'no',
};
const POR_CODIGO_DISCO = {
  incorporaciones_2: 'propuestas:vino', incorporaciones: 'propuestas:spirit', dc_cervezas_rtd: 'ofertas', dc_espumantes: 'ofertas',
  proponer_activacion: 'no', dc_eventos_mes: 'no', dc_acuerdos_marca: 'no', dc_sunset: 'no', dc_activaciones: 'no', dc_mat_restringidos: 'no', dc_eventos_cliente: 'no',
};
const ESPECIAL_NO = new Set(['cierre_resumen', 'vt_cierre', 'vt_materiales', 'ev_materiales', 'vt_vidrieras', 'vt_partners', 'ev_paquetes', 'ev_combos']);
const NOMBRE_NO = /introduccion|cierre|material|buscador|seguimiento|proponer activ|cocteler|evidencia|visibilidad|pedido de accion|entretenimiento|precio por cantidad|catalogo|pregunta|vidriera/;
// Secciones de una marca (además de las que se llaman como un proveedor del catálogo).
const MARCA_PROPIA = /penaflor|zuelo|segaf+red+o|campari/;

function tipoDe(h, madre, rubro) {
  const esp = String(h.especial || '');
  if (ESPECIAL_NO.has(esp)) return 'no';
  if (NOMBRE_NO.test(nrm(h.nombre))) return 'no';
  if (esp.startsWith('w:')) return POR_W[esp.slice(2)] || 'no';
  const cod = String(h.codigo || '');
  if (rubro === 'disco' && POR_CODIGO_DISCO[cod]) return POR_CODIGO_DISCO[cod];
  if (POR_CODIGO[cod]) return POR_CODIGO[cod];
  if (esp === 'calendario_fechas') return 'calendario';
  if (esp === 'acciones_mensuales') return 'ofertas';
  const n = nrm(h.nombre);
  if (/mix ideal/.test(n)) return 'mix';
  if (/vino por copa|copa de bienvenida/.test(n)) return 'copa';
  if (/aperitivos? de bienvenida|pre[\s-]*cena/.test(n)) return 'aperitivos';
  if (/acciones? (de )?(rotaci|mensual)/.test(n)) {
    const c = catDe(h.nombre) || catDe(madre && madre.nombre);
    if ((c && c !== 'cafe') || rubro === 'mayorista') return 'ofertas';
  }
  return 'plano';
}
// Herramienta de Luciana (vinos_sobre_mesa / acciones_herramientas) propia de la sección.
function herrPropia(h, madre) {
  const esp = String(h.especial || ''), n = nrm(h.nombre), mn = nrm(madre && madre.nombre);
  const t = [];
  if (esp === 'w:vinos_mesa' || /sobre la mesa/.test(n) || (/sobre la mesa/.test(mn) && /vino/.test(n))) t.push('vino_mesa');
  if (esp === 'w:punteras' || /puntera/.test(n)) t.push('puntera');
  if (esp === 'w:volumen' || /acciones? de volumen/.test(n)) t.push('volumen');
  if (esp === 'w:degustaciones' || /degustaci/.test(n)) t.push('degustacion');
  return t;
}

async function leer(base, key, path) {
  const r = await fetch(base + '/rest/v1/' + path, { headers: { apikey: key, Authorization: 'Bearer ' + key, 'Range-Unit': 'items', Range: '0-4999' } });
  if (!r.ok) throw new Error(path.split('?')[0] + ' ' + r.status);
  return r.json();
}

// Los lugares del manual y si hoy tienen algo (sin mirar las propuestas, que van aparte).
let CACHE = { t: 0, data: null };
async function lugaresDelManual() {
  if (CACHE.data && Date.now() - CACHE.t < 10 * 60000) return CACHE.data;
  const man = p => leer(MAN_URL, MAN_KEY, p), hubA = p => leer(HUB_URL, HUB_ANON, p), cat = p => leer(CAT_URL, CAT_KEY, p);
  const [secs, planes, camp, fechas, vpc, mixes, aper, frig, incorp, mesa, herr, catAcc, catProv] = await Promise.all([
    man('checklist_secciones?zona=eq.mendoza&activa=eq.true&select=id,canal,codigo,nombre,parent_id,especial,orden&order=orden'),
    man('checklist_planes?activo=eq.true&select=seccion_id,secciones,zonas,fecha_inicio,fecha_fin'),
    man('acciones_mensuales?activa=eq.true&select=categoria,aplica_a,seccion_checklist,secciones,zonas,fecha_inicio,fecha_fin'),
    man('acciones_fechas?activa=eq.true&select=canal,rubros,secciones,zonas,fecha_fin'),
    man('vinos_por_copa?activo=eq.true&select=rubros,secciones,zonas'),
    man('mixes_ideales?activo=eq.true&select=canal,secciones,zonas'),
    man('aperitivos_bienvenida?activo=eq.true&select=rubros,secciones,zonas'),
    man('packs_frigobar?activo=eq.true&select=secciones,zonas'),
    man('propuestas_incorporacion?activo=eq.true&select=categoria,secciones,zonas'),
    hubA('vinos_sobre_mesa?activo=eq.true&select=secciones,zonas'),
    hubA('acciones_herramientas?activo=eq.true&select=tipo,secciones,zonas,fecha_hasta'),
    cat('catalogo_acciones?activo=eq.true&select=proveedor_id,canal,secciones,zonas'),
    cat('catalogo_proveedores?select=id,nombre,categoria'),
  ]);
  const hoy = hoyAR();
  const enZona = x => !Array.isArray(x.zonas) || !x.zonas.length || x.zonas.includes('mendoza');
  const seg = x => Array.isArray(x.secciones) && x.secciones.length > 0;
  const vigente = x => (!x.fecha_inicio || String(x.fecha_inicio).slice(0, 10) <= hoy) && (!x.fecha_fin || String(x.fecha_fin).slice(0, 10) >= hoy);
  const Z = (arr, f) => (arr || []).filter(x => enZona(x) && (!f || f(x)));
  const P = Z(planes, vigente), C = Z(camp, vigente), F = Z(fechas, x => !x.fecha_fin || String(x.fecha_fin).slice(0, 10) >= hoy);
  const H = Z(mesa).map(x => ({ ...x, tipo: 'vino_mesa' })).concat(Z(herr, x => !x.fecha_hasta || String(x.fecha_hasta) >= hoy));
  const provCat = {}, provNom = {}; catProv.forEach(p => { provCat[p.id] = String(p.categoria || '').toLowerCase(); provNom[p.id] = nrmProv(p.nombre); });
  const CA = Z(catAcc).map(a => ({ ...a, categoria: provCat[a.proveedor_id] || '', prov: provNom[a.proveedor_id] || '', canal: String(a.canal || 'ambos').toLowerCase() }));
  const nomsProv = catProv.map(p => nrmProv(p.nombre)).filter(n => n.length >= 4);
  // La sección es de un proveedor si se llama como él ("GRUPO PEÑAFLOR" contiene "penaflor"); al revés
  // no: "VINOS" no es de "Peñaflor Vinos".
  const dueno = nombre => { const n = nrmProv(nombre); if (!n) return null; if (MARCA_PROPIA.test(n)) return n; return nomsProv.find(p => n === p || (' ' + n + ' ').includes(' ' + p + ' ')) || null; };

  const S = (secs || []).filter(s => RUBROS.includes(s.canal));
  const porId = {}; S.forEach(s => { porId[s.id] = s; });
  const hijas = {}; S.forEach(s => { if (s.parent_id) (hijas[s.parent_id] = hijas[s.parent_id] || []).push(s); });
  const lugares = [];
  for (const madre of S.filter(s => !s.parent_id)) {
    const rubro = madre.canal;
    const hs = hijas[madre.id] || [];
    const lista = hs.length ? hs.map(h => [h, madre]) : [[madre, null]];
    for (const [h, m] of lista) {
      const tipo = tipoDe(h, m, rubro);
      if (tipo === 'no') continue;
      // Lo que cuelga de la sección madre se ve arriba, en la madre: la subsección sigue vacía.
      // Solo el calendario mira también la madre (las fechas se cargan en las dos).
      const ids = [h.id], idsCal = [h.id].concat(m ? [m.id] : []);
      const enSec = x => seg(x) && x.secciones.some(id => ids.includes(id));
      const cat = catDe(h.nombre) || catDe(m && m.nombre);
      const duenoL = dueno(m ? m.nombre : '') || dueno(h.nombre);
      const canalCat = rubro === 'mayorista' ? 'mayorista' : OFF.includes(rubro) ? 'off' : 'on';
      const delRubro = x => (x.aplica_a || []).some(v => ALIAS[rubro].includes(v) || v === 'todos');
      const partes = x => String(x.seccion_checklist || '').split(',').map(s => s.trim()).filter(Boolean);
      const general = x => { const p = partes(x); return !p.length || p.includes('general') || p.includes('s_acciones_mensuales'); };
      const rubrosOk = x => !Array.isArray(x.rubros) || !x.rubros.length || x.rubros.includes(rubro) || x.rubros.includes('todos');
      let ocupado =
        P.some(p => (seg(p) ? p.secciones : [p.seccion_id]).some(id => ids.includes(id))) ||
        C.some(enSec) || H.some(enSec) ||
        C.some(a => !seg(a) && delRubro(a) && partes(a).includes(h.codigo)) ||
        H.some(a => !seg(a) && herrPropia(h, m).includes(a.tipo));
      if (!ocupado) {
        const [t, sub] = tipo.split(':');
        // La sección de un proveedor (GRUPO PEÑAFLOR) muestra solo las ofertas de ese proveedor.
        if (t === 'ofertas') ocupado =
          CA.some(a => seg(a) ? a.secciones.includes(h.id) : ((a.canal === canalCat || a.canal === 'ambos') &&
            (duenoL ? (a.prov === duenoL || (' ' + duenoL + ' ').includes(' ' + a.prov + ' ')) : cat ? a.categoria === cat : rubro === 'mayorista'))) ||
          C.some(a => !seg(a) && delRubro(a) && general(a) && (!catCampania(a) || !cat || catCampania(a) === cat));
        else if (t === 'propuestas') ocupado = Z(incorp).some(p => seg(p) ? p.secciones.includes(h.id) : p.categoria === sub);
        else if (t === 'copa') ocupado = Z(vpc).some(v => seg(v) ? v.secciones.includes(h.id) : rubrosOk(v));
        else if (t === 'aperitivos') ocupado = Z(aper).some(v => seg(v) ? v.secciones.includes(h.id) : rubrosOk(v));
        else if (t === 'mix') ocupado = Z(mixes).some(v => seg(v) ? v.secciones.includes(h.id) : true);
        else if (t === 'frigobar') ocupado = Z(frig).some(v => seg(v) ? v.secciones.includes(h.id) : true);
        else if (t === 'calendario') ocupado = F.some(f => {
          if (seg(f)) return f.secciones.some(id => idsCal.includes(id));
          const rr = Array.isArray(f.rubros) && f.rubros.length ? f.rubros
            : f.canal === 'restaurantes' ? ['restaurante', 'bar', 'hotel', 'disco', 'evento']
            : f.canal === 'vinotecas' ? ['vinoteca', 'tienda_bebidas', 'autoservicio', 'mayorista'] : ['todos'];
          return rr.includes('todos') || rr.includes(rubro);
        });
      }
      if (ocupado) continue;
      lugares.push({
        id: h.id, rubro, madre: m ? m.nombre : h.nombre, sub: m ? h.nombre : null, cat,
        dueno: duenoL,
        orden: RUBROS.indexOf(rubro) * 1e6 + (m ? m.orden || 0 : h.orden || 0) * 1e3 + (m ? h.orden || 0 : 0),
      });
    }
  }
  lugares.sort((a, b) => a.orden - b.orden);
  CACHE = { t: Date.now(), data: { lugares, catProv } };
  return CACHE.data;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' });
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || token === 'null' || token === 'undefined') return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,empresa,activo', { headers: { apikey: srole, Authorization: 'Bearer ' + srole } });
    const perfil = (pRes.ok ? await pRes.json() : [])[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();
    const qp = event.queryStringParameters || {};
    let empresa;
    if (rol === 'proveedor') empresa = perfil.empresa || perfil.nombre;
    else if (EQUIPO.includes(rol)) empresa = String(qp.empresa || '').slice(0, 80);
    else return json(403, { error: 'No autorizado.' });

    const [{ lugares, catProv }, props] = await Promise.all([
      lugaresDelManual(),
      leer(MAN_URL, MAN_KEY, 'propuestas_acciones?estado=in.(pendiente,aprobada)&select=rubro,seccion,subseccion'),
    ]);
    // Donde ya hay una propuesta (de cualquier proveedor) ya no es "ser el primero".
    const tomado = l => props.some(p => p.rubro === l.rubro && nrm(p.seccion) === nrm(l.madre) && (!p.subseccion || !l.sub || nrm(p.subseccion) === nrm(l.sub)));
    const en = nrmProv(empresa);
    const suyas = catProv.filter(p => mismaEmpresa(nrmProv(p.nombre), en)).map(p => String(p.categoria || '').toLowerCase()).filter(Boolean);
    const categorias = [...new Set(suyas)];
    const lista = lugares
      .filter(l => !l.dueno || (en && mismaEmpresa(l.dueno, en)))
      .filter(l => !tomado(l))
      .map(l => ({ id: l.id, rubro: l.rubro, madre: l.madre, sub: l.sub, cat: l.cat, tuyo: !!(l.dueno || (l.cat && categorias.includes(l.cat))) }));
    // Primero los de su categoría (o de su marca); después los generales; al final el resto.
    const peso = l => l.tuyo ? 0 : !l.cat ? 1 : 2;
    lista.sort((a, b) => peso(a) - peso(b));
    return json(200, { empresa: empresa || null, categorias, total: lista.length, tuyos: lista.filter(l => l.tuyo).length, lugares: lista });
  } catch (e) {
    return json(502, { error: 'No se pudieron revisar los lugares del manual.', detalle: String((e && e.message) || e).slice(0, 200) });
  }
};

module.exports.handler = require('./_errores').conErrores('lugares-libres', module.exports.handler);
