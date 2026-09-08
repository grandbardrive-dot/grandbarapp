// ─── Configuración Supabase ────────────────────────────────────────────────
const SUPABASE_URL      = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

// Contraseña del panel admin — cambiala cuando quieras
const ADMIN_PASSWORD = 'admin2024';

// Cliente Supabase (disponible globalmente en todos los HTML que incluyan este archivo)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Traer TODAS las filas, no las primeras mil ────────────────────────────
// La base corta en 1000 filas por consulta y no avisa: contesta bien, con las
// primeras mil. Si sobre eso se cuenta o se suma, el número queda corto y la
// pantalla no falla, que es la peor forma de estar mal.
//
// Se le pasa una FUNCIÓN que arma la consulta, no la consulta ya armada: así
// cada página sale con una consulta nueva y limpia.
//   const filas = await traerTodo(() => sb.from('clientes').select('id,nombre'));
async function traerTodo(armarConsulta, tope = 20000) {
  const filas = [], tam = 1000;
  for (let desde = 0; desde < tope; desde += tam) {
    const { data, error } = await armarConsulta().range(desde, desde + tam - 1);
    if (error || !data || !data.length) break;
    filas.push(...data);
    if (data.length < tam) break;
  }
  return filas;
}
