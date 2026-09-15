// ============================================================
//  GrandBar Hub · Function · curso
//   Curso obligatorio del vendedor. Los MÓDULOS son los rubros de su
//   canal (ON/OFF) y las LECCIONES son las secciones del manual
//   (checklist_secciones): así el curso se mantiene solo.
//   El quiz se corrige acá (las respuestas correctas NO salen al front).
//   Progreso y config: tablas curso_progreso / curso_config (Manual).
//   Env: (ninguna nueva) — usa el token del Hub para identificar al vendedor.
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const qvals = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

// Rubros de cada canal (los que tienen manual armado).
const RUBROS_ON  = ['restaurante', 'bar', 'hotel', 'disco'];
const RUBROS_OFF = ['vinoteca', 'tienda_bebidas', 'autoservicio'];
const RUBRO_LABEL = { restaurante: 'Restaurante', bar: 'Bar', hotel: 'Hotel', disco: 'Disco', vinoteca: 'Vinoteca', tienda_bebidas: 'Tienda de Bebidas', autoservicio: 'Autoservicio' };
const RUBRO_EMOJI = { restaurante: '🍽️', bar: '🍸', hotel: '🏨', disco: '💿', vinoteca: '🍷', tienda_bebidas: '🏬', autoservicio: '🏪' };
function rubrosDe(canal) {
  const c = String(canal || '').toLowerCase();
  if (c === 'off') return RUBROS_OFF.slice();
  if (c === 'ambos') return RUBROS_ON.concat(RUBROS_OFF);
  return RUBROS_ON.slice(); // default ON
}

// ── Ejemplo práctico (mini caso de visita) por rubro ──
const EJEMPLO = {
  restaurante: 'Entrás a un restaurante que ya te compra vinos pero nunca trabajó coctelería. En SPIRITS abrís "Desarrollo de Coctelería", elegís un gin del sistema y la IA te propone dos tragos con su costeo; le mostrás el margen y cerrás la incorporación de 2 cajas.',
  bar: 'En un bar con barra activa, usás las 🛠️ Herramientas IA de SPIRITS: la IA te marca dos productos que dejó de comprar (quiebre). Le armás una reposición y, con "Vino por Copa", le calculás el costo por copa para sumar una etiqueta por copa.',
  hotel: 'Visitás un hotel que quiere ordenar su frigobar. En FRIGOBAR le mostrás un pack pre-armado, y en VINOS le proponés una "Copa de bienvenida" con la calculadora de costo por copa. Sumás todo al carrito eligiendo cajas.',
  disco: 'En una disco preparando la temporada, entrás a "Activaciones & Fechas": elegís la próxima fecha fuerte y con "Proponer Activación" la IA te arma la propuesta y la placa con el logo del local.',
  vinoteca: 'En una vinoteca revisás la góndola: en VINOS cargás una propuesta de incorporación de 3 etiquetas nuevas y con "Acciones de Rotación" le sumás una oferta al carrito por cajas. En FECHAS ESPECIALES dejás agendada una activación.',
  tienda_bebidas: 'En una tienda de bebidas usás "Combos Previa" para ofrecerle un combo de Grupo Campari, y en FRIOS & RTD le proponés una acción para llenar la heladera de cara al finde.',
  autoservicio: 'En un autoservicio chino trabajás la "Lista Amarilla" con los precios foco, acordás una puntera en "Plan de Punteras" y con las 🛠️ Herramientas IA detectás qué de la góndola dejó de reponer.',
};

// ── Banco de preguntas por rubro (la respuesta correcta NO sale al front) ──
// correcta = índice de la opción correcta.
const QUIZ = {
  _comunes: [
    { q: '¿Qué hacés cuando una acción tiene el botón "+" con selector de botellas o cajas?', o: ['La agregás al carrito de la visita eligiendo la cantidad', 'La enviás por mail', 'Solo la leés'], c: 0 },
    { q: 'Las 🛠️ Herramientas IA (Stock & Rotación) se basan en…', o: ['Lo que efectivamente le vendimos a ese cliente', 'Una lista fija igual para todos', 'El clima'], c: 0 },
    { q: 'En "Proponer Activación", ¿qué suma la IA además de la idea?', o: ['La placa lista, con opción de ponerle el logo del cliente', 'Nada, solo texto', 'El precio de la competencia'], c: 0 },
  ],
  restaurante: [
    { q: 'En "Desarrollo de Coctelería", ¿de dónde sale el precio de la botella?', o: ['Del sistema, y dejás un casillero para el descuento', 'Lo inventás', 'Lo pide el cliente'], c: 0 },
    { q: '¿Para qué sirve "Vino por Copa"?', o: ['Calcular el costo por copa de vinos con condición especial', 'Vender botellas cerradas', 'Pedir materiales'], c: 0 },
  ],
  bar: [
    { q: '"Mix Ideal" son…', o: ['Combos de productos de distintas categorías que arma Luci', 'Tragos sin alcohol', 'Precios de la competencia'], c: 0 },
    { q: 'En FRÍOS & RTD el foco está en…', o: ['Disponibilidad y heladera (producto frío listo para servir)', 'Coctelería de autor', 'Vinos de guarda'], c: 0 },
  ],
  hotel: [
    { q: 'Los "Pre-armados" de FRIGOBAR son…', o: ['Packs de productos ya armados que carga Luci', 'Botellas sueltas', 'Materiales POP'], c: 0 },
    { q: '"Copa de bienvenida" funciona igual que…', o: ['Vino por Copa (lista + calculadora de costo por copa)', 'Un combo de previa', 'El catálogo de café'], c: 0 },
    { q: 'La sección SEGAFREDO te permite…', o: ['Mostrar el catálogo y relevar si el cliente usa máquina de café', 'Cargar espumantes', 'Pedir materiales de vidriera'], c: 0 },
  ],
  disco: [
    { q: 'En "Aperitivos de bienvenida o pre cena", los productos los carga…', o: ['Luci desde su panel', 'El cliente', 'La IA sola'], c: 0 },
    { q: '"Eventos pre-armados" sirven para…', o: ['Ofrecer eventos ya armados al local', 'Calcular vino por copa', 'Registrar visibilidad'], c: 0 },
  ],
  vinoteca: [
    { q: '"Acciones de Volumen y Exhibidores" son…', o: ['Acuerdos por volumen y espacios de exhibición destacada', 'Preguntas de café', 'Combos de previa'], c: 0 },
    { q: 'En "Plan de Degustaciones" vos…', o: ['Programás degustaciones en el punto de venta', 'Cargás precios', 'Sacás una foto de evidencia'], c: 0 },
  ],
  tienda_bebidas: [
    { q: '"Combos Previa" están organizados por…', o: ['Proveedor (Grupo Campari, Pernod Ricard, Diageo)', 'Color de la botella', 'Fecha'], c: 0 },
    { q: 'En "Acciones de Incorporación" el vendedor…', o: ['Propone etiquetas nuevas que quedan para seguimiento', 'Cobra la factura', 'Arma el frigobar'], c: 0 },
  ],
  autoservicio: [
    { q: '¿Qué es la "Lista Amarilla"?', o: ['Productos foco con precios competitivos para autoservicios', 'La lista de morosos', 'Un combo de previa'], c: 0 },
    { q: '"Plan de Punteras" sirve para…', o: ['Acordar punteras / cabeceras de góndola', 'Calcular coctelería', 'Registrar café'], c: 0 },
  ],
};
function bancoDe(rubro) { return (QUIZ._comunes || []).concat(QUIZ[rubro] || []); }

async function man(path, opts = {}) {
  return fetch(MAN_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
}

// Lecciones de un rubro = secciones madre activas del manual (mendoza) + sus subsecciones como "incluye".
async function leccionesDe(rubro) {
  const rows = await (await man('checklist_secciones?canal=eq.' + encodeURIComponent(rubro) + '&zona=eq.mendoza&activa=eq.true&select=id,codigo,nombre,icono,intro,orden,parent_id&order=orden.asc')).json();
  if (!Array.isArray(rows)) return [];
  const madres = rows.filter(r => !r.parent_id).sort((a, b) => a.orden - b.orden);
  return madres.map(m => ({
    codigo: m.codigo, nombre: m.nombre, icono: m.icono || '📄', intro: m.intro || '',
    incluye: rows.filter(r => r.parent_id === m.id).sort((a, b) => a.orden - b.orden).map(s => s.nombre),
  }));
}

exports.handler = async (event) => {
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const perfil = (await (await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,canal,codigo_vendedor,es_supervisor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } })).json())[0] || {};
    const vend = String(perfil.codigo_vendedor || '');
    const canal = String(perfil.canal || 'on').toLowerCase();

    const cfg = (await (await man('curso_config?canal=eq.' + encodeURIComponent(canal === 'ambos' ? 'on' : canal) + '&select=*')).json())[0] || { nota_minima: 70, fecha_limite: null, activo: true };
    const notaMin = cfg.nota_minima || 70;

    // ---------- POST ----------
    if (event.httpMethod === 'POST') {
      if (!vend) return json(403, { error: 'Tu usuario no tiene código de vendedor.' });
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

      if (b.accion === 'leccion') {
        if (!b.rubro || !b.leccion) return json(400, { error: 'Faltan datos.' });
        const fila = { vendedor_codigo: vend, canal, rubro: String(b.rubro), leccion: String(b.leccion), tipo: 'leccion', completado: true, updated_at: new Date().toISOString() };
        const r = await man('curso_progreso?on_conflict=vendedor_codigo,rubro,leccion,tipo', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude guardar: ' + (await r.text()).slice(0, 150) });
        return json(200, { ok: true });
      }

      if (b.accion === 'quiz') {
        if (!b.rubro || !Array.isArray(b.respuestas)) return json(400, { error: 'Faltan respuestas.' });
        const banco = bancoDe(String(b.rubro));
        if (!banco.length) return json(400, { error: 'Ese módulo no tiene quiz.' });
        let ok = 0;
        banco.forEach((q, i) => { if (Number(b.respuestas[i]) === q.c) ok++; });
        const nota = Math.round(ok / banco.length * 100);
        const aprobado = nota >= notaMin;
        const fila = { vendedor_codigo: vend, canal, rubro: String(b.rubro), leccion: '', tipo: 'modulo', completado: true, nota, aprobado, updated_at: new Date().toISOString() };
        const r = await man('curso_progreso?on_conflict=vendedor_codigo,rubro,leccion,tipo', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude guardar la nota: ' + (await r.text()).slice(0, 150) });
        return json(200, { ok: true, nota, aprobado, nota_minima: notaMin, correctas: ok, total: banco.length });
      }
      return json(400, { error: 'Acción inválida' });
    }

    const qp = event.queryStringParameters || {};

    // ---------- GET: estado rápido (para el banner del inicio) ----------
    if (qp.vista === 'estado') {
      const total = rubrosDe(canal).length;
      let aprobados = 0;
      if (vend) {
        const prog = await (await man('curso_progreso?vendedor_codigo=eq.' + encodeURIComponent(vend) + '&tipo=eq.modulo&aprobado=eq.true&select=rubro')).json();
        aprobados = new Set((Array.isArray(prog) ? prog : []).map(p => p.rubro)).size;
      }
      return json(200, { canal, total, aprobados, completo: total > 0 && aprobados >= total, fecha_limite: cfg.fecha_limite, activo: cfg.activo !== false });
    }

    // ---------- GET: equipo (supervisor) ----------
    if (qp.vista === 'equipo') {
      if (!perfil.es_supervisor) return json(403, { error: 'Solo para supervisores.' });
      const hubService = process.env.HUB_SERVICE_ROLE;
      const eqRes = await fetch(HUB_URL + '/rest/v1/usuarios?rol=eq.ventas&select=nombre,codigo_vendedor,canal,region', { headers: { apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token) } });
      const pc = String(perfil.canal || '').toLowerCase(), preg = String(perfil.region || '').toLowerCase();
      const team = (await eqRes.json() || []).filter(u => {
        if (!u.codigo_vendedor) return false;
        if (preg && u.region && String(u.region).toLowerCase() !== preg) return false;
        const uc = String(u.canal || '').toLowerCase();
        return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
      });
      const codigos = team.map(u => String(u.codigo_vendedor));
      let prog = [];
      if (codigos.length) {
        prog = await (await man('curso_progreso?tipo=eq.modulo&vendedor_codigo=in.(' + qvals(codigos) + ')&select=vendedor_codigo,rubro,aprobado,nota,updated_at')).json();
        if (!Array.isArray(prog)) prog = [];
      }
      const porV = {};
      prog.forEach(p => { (porV[String(p.vendedor_codigo)] = porV[String(p.vendedor_codigo)] || []).push(p); });
      const equipo = team.map(u => {
        const cod = String(u.codigo_vendedor);
        const total = rubrosDe(u.canal).length;
        const filas = porV[cod] || [];
        const aprobados = new Set(filas.filter(f => f.aprobado).map(f => f.rubro)).size;
        const ultima = filas.map(f => f.updated_at).filter(Boolean).sort().slice(-1)[0] || null;
        return { codigo: cod, nombre: u.nombre || cod, canal: String(u.canal || 'on').toLowerCase(), total, aprobados, completo: total > 0 && aprobados >= total, ultima };
      }).sort((a, b) => (a.aprobados / (a.total || 1)) - (b.aprobados / (b.total || 1)));
      return json(200, { equipo, nota_minima: notaMin, fecha_limite: cfg.fecha_limite });
    }

    // ---------- GET: mi curso ----------
    const rubros = rubrosDe(canal);
    const modulos = [];
    for (const rb of rubros) {
      const lecciones = await leccionesDe(rb);
      if (!lecciones.length) continue;
      const banco = bancoDe(rb);
      modulos.push({
        rubro: rb, label: RUBRO_LABEL[rb] || rb, emoji: RUBRO_EMOJI[rb] || '📘',
        ejemplo: EJEMPLO[rb] || '',
        lecciones,
        quiz: banco.map(q => ({ q: q.q, o: q.o })),   // sin la respuesta correcta
      });
    }

    let progreso = [];
    if (vend) {
      progreso = await (await man('curso_progreso?vendedor_codigo=eq.' + encodeURIComponent(vend) + '&select=rubro,leccion,tipo,nota,aprobado')).json();
      if (!Array.isArray(progreso)) progreso = [];
    }

    return json(200, {
      nombre: perfil.nombre || '', canal, codigo: vend,
      nota_minima: notaMin, fecha_limite: cfg.fecha_limite, activo: cfg.activo !== false,
      modulos, progreso,
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
