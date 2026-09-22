// ─── Torneo Doña Paula · puntos oficiales ────────────────────────────────────
// Desde el 22/09/2026 los puntos salen SOLO del archivo que carga Administración
// en Drive, que lee la función torneo-puntos. Este módulo lo trae una vez por
// pantalla y le busca a cada nombre su vendedor (para el código y la sucursal).
//
// Uso:  const T = await TorneoOficial.cargar();      // usa sb (el del manual)
//       T.porCodigo['029'] → { nombre, codigo, sucursal, total, cats, conceptos }
//       T.ranking('Mendoza') → lista ordenada de esa sucursal
// Necesita _config.js (sb) y _sucursales.js (getSucursal).
window.TorneoOficial = (function () {
  const CATS = ['Acciones', 'Volumen', 'Activaciones'];
  const ICO = { Acciones: '🎯', Volumen: '📦', Activaciones: '⚡' };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  let _cache = null;

  // "Angela Laurito" (archivo) = "Ángeles Laurito" (sistema): mismo apellido y el
  // nombre empieza igual. Primero se busca el nombre exacto.
  function vendedorDe(nombre, vendedores) {
    const n = norm(nombre);
    const exacto = vendedores.find(v => norm(v.nombre) === n);
    if (exacto) return exacto;
    const [pn, ...resto] = n.split(' '); const ap = resto.join(' ');
    return vendedores.find(v => { const [vn, ...vr] = norm(v.nombre).split(' '); return vr.join(' ') === ap && vn.slice(0, 4) === pn.slice(0, 4); }) || null;
  }

  async function traer() {
    const [r, rv] = await Promise.all([
      fetch('/.netlify/functions/torneo-puntos').then(x => x.json()),
      sb.from('vendedores').select('id, codigo, nombre'),
    ]);
    if (!r || r.error) throw new Error((r && r.error) || 'No se pudieron leer los puntos del torneo.');
    const vendedores = rv.data || [];
    const por = {};
    (r.filas || []).forEach(f => {
      const k = norm(f.vendedor);
      const p = por[k] = por[k] || { nombreArchivo: f.vendedor, total: 0, cats: {}, conceptos: [] };
      p.total += Number(f.puntos) || 0;
      p.cats[f.categoria] = (p.cats[f.categoria] || 0) + (Number(f.puntos) || 0);
      p.conceptos.push(f);
    });
    const lista = Object.values(por).map(p => {
      const v = vendedorDe(p.nombreArchivo, vendedores);
      return { ...p, id: v ? v.id : null, nombre: v ? v.nombre : p.nombreArchivo, codigo: v ? v.codigo : null, sucursal: getSucursal(v ? v.codigo : null) };
    });
    const porCodigo = {}, porId = {};
    lista.forEach(p => { if (p.codigo) porCodigo[p.codigo] = p; if (p.id) porId[p.id] = p; });
    const ranking = suc => lista.filter(p => !suc || p.sucursal === suc).sort((a, b) => b.total - a.total);
    const puesto = p => p ? ranking(p.sucursal).indexOf(p) + 1 : 0;
    return { lista, porCodigo, porId, ranking, puesto, leido: r.leido };
  }

  // Si falla, no se guarda el error: el próximo pedido vuelve a intentar.
  function cargar() {
    if (_cache) return _cache;
    _cache = traer().catch(e => { _cache = null; throw e; });
    return _cache;
  }

  return { cargar, CATS, ICO };
})();
