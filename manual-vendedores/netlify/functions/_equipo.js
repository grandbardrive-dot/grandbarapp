// ============================================================
//  Helper compartido: de qué sucursal es cada uno, para armar el equipo
//  de un supervisor. (El "_" evita que Netlify lo publique como función.)
//
//  Antes cada función repetía:
//      if (preg && u.region && u.region !== preg) return false;
//  y un vendedor SIN región cargada pasaba ese filtro: aparecía en el equipo
//  de todos los supervisores. Así le salían a Martín Juárez (San Luis)
//  Carolina Carrada, Georgina Grosso y Laura Puga, que son de Mendoza.
//
//  Regla: vale la región del usuario si está cargada; si no, se deduce del
//  código de vendedor con la MISMA lista que usa la app
//  (manual-vendedores/_sucursales.js). Si no hay ni región ni código, no es
//  de ningún equipo con región.
// ============================================================

// Mismo listado que manual-vendedores/_sucursales.js (el resto es Mendoza).
const SAN_LUIS_CODIGOS = new Set(['006', '010', '017', '041', '043']);

const norm = v => String(v == null ? '' : v).trim().toLowerCase();

function regionDe(u) {
  const r = norm(u && u.region).replace(/\s+/g, '_');
  if (r) return r;                                   // 'mendoza' | 'san_luis'
  const c = String((u && u.codigo_vendedor) == null ? '' : u.codigo_vendedor).trim();
  if (!c) return '';
  return SAN_LUIS_CODIGOS.has(c) ? 'san_luis' : 'mendoza';
}

module.exports = { regionDe, SAN_LUIS_CODIGOS };
