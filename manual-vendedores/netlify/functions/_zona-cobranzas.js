// ============================================================
//  Helper compartido: hasta dónde ve cada uno en Cobranzas (19/10/2026).
//  (El "_" evita que Netlify lo publique como función.)
//
//  Romina es la administración de San Luis: los reclamos y las cobranzas de
//  San Luis van a ella. Tiene el mismo rol que Mónica (tesorería) y en su
//  usuario la región "san_luis"; con eso estas funciones le muestran solo lo
//  de San Luis. La región del usuario decide:
//    'san_luis' → solo San Luis
//    'mendoza'  → todo menos San Luis
//    sin región → todo (Mónica, Brenda, Dirección)
//
//  San Luis = las cuentas de CUBO con equipo "SL" o "MAY SL"
//  (cuentas_cubo.equipo). Lo que cuelga de la ficha del portal (comprobantes,
//  reclamos, cobros en efectivo) se ubica por el codigo_cubo de esa ficha o por
//  el código que guarda la fila. Las planillas de rendición van por vendedor:
//  es de San Luis el vendedor que tiene la mayoría de sus cuentas en esos equipos
//  (hoy 006, 010, 017, 041, 043, 008 y 032).
// ============================================================

const EQUIPOS_SL = new Set(['SL', 'MAY SL']);
const normCod = v => String(v == null ? '' : v).trim().replace(/^0+/, '');

function zonaDe(perfil) {
  const r = String((perfil && perfil.region) || '').trim().toLowerCase().replace(/\s+/g, '_');
  return r === 'san_luis' || r === 'mendoza' ? r : null;
}

// leerTodo(path) → todas las filas (paginado). Devuelve null si el usuario ve todo.
async function armarZona(zona, leerTodo) {
  if (!zona) return null;
  const [cuentas, fichas] = await Promise.all([
    leerTodo('cuentas_cubo?select=codigo,equipo,vendedor&order=codigo'),
    leerTodo('clientes?select=id,codigo_cubo&order=id'),
  ]);
  // Sin la cartera no se puede saber qué es de San Luis: mejor cortar que mostrar de más.
  if (!Array.isArray(cuentas) || !cuentas.length) throw new Error('No pude leer la cartera para separar San Luis.');

  const slCod = new Set(), porVend = {};
  cuentas.forEach(c => {
    const sl = EQUIPOS_SL.has(String(c.equipo || '').trim().toUpperCase());
    if (sl) slCod.add(normCod(c.codigo));
    const v = String(c.vendedor || '').trim();
    if (!v) return;
    porVend[v] = porVend[v] || { sl: 0, n: 0 };
    porVend[v].n++; if (sl) porVend[v].sl++;
  });
  const slVend = new Set(Object.keys(porVend).filter(v => porVend[v].sl * 2 > porVend[v].n));
  const slCli = new Set((Array.isArray(fichas) ? fichas : [])
    .filter(f => f.codigo_cubo && slCod.has(normCod(f.codigo_cubo))).map(f => String(f.id)));

  const esSL = zona === 'san_luis';
  const ok = x => (esSL ? x : !x);
  const codSL = c => !!c && slCod.has(normCod(c));
  const cliSL = id => !!id && slCli.has(String(id));
  return {
    zona,
    nombre: esSL ? 'San Luis' : 'Mendoza',
    codOk:  c => ok(codSL(c)),
    cliOk:  id => ok(cliSL(id)),
    vendOk: v => ok(slVend.has(String(v == null ? '' : v).trim())),
    // Filas con código de cliente y/o ficha del portal (reclamos, cobros en efectivo).
    filaOk: f => ok(codSL(f && f.codigo) || cliSL(f && f.cliente_id)),
    // Para filtrar cuentas_cubo en la misma consulta (un solo parámetro, así no
    // choca con el "or" del buscador).
    filtroEquipo: esSL
      ? 'equipo=in.(SL,%22MAY%20SL%22)'
      : 'and=(or(equipo.is.null,equipo.not.in.(SL,%22MAY%20SL%22)))',
  };
}

module.exports = { zonaDe, armarZona, EQUIPOS_SL };
