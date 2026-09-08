// ============================================================
//  Helper compartido: traer TODAS las filas, no las primeras mil.
//  (El "_" evita que Netlify lo publique como función.)
//
//  La base corta en 1000 filas por consulta y NO avisa: contesta 200 con las
//  primeras 1000. Poner "limit=5000" no sirve para nada. Eso hace que una
//  cuenta o una suma dé un número más chico sin que nada falle, que es la peor
//  forma de estar mal: la pantalla anda y el dato miente.
//
//  Usar SIEMPRE que se cuente o se sume sobre una tabla que puede pasar de mil
//  filas. Para listas de pantalla que ya paginan, no hace falta.
//
//  `fetcher` = el helper de cada función que arma la URL y pone las llaves.
//              Tiene que aceptar (path, opts) y devolver la respuesta cruda.
//  `path`    = la consulta SIN "limit=": el límite lo maneja este helper.
// ============================================================
async function traerTodo(fetcher, path, tope = 20000) {
  const filas = [], tam = 1000;
  for (let desde = 0; desde < tope; desde += tam) {
    let r;
    try {
      r = await fetcher(path, { headers: { 'Range-Unit': 'items', Range: desde + '-' + (desde + tam - 1) } });
    } catch (e) { break; }
    if (!r || !r.ok) break;
    const lote = await r.json().catch(() => null);
    if (!Array.isArray(lote) || !lote.length) break;
    filas.push(...lote);
    if (lote.length < tam) break;
  }
  return filas;
}

module.exports = { traerTodo };
