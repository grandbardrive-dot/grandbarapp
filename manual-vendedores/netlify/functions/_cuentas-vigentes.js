// ============================================================
//  Cuentas de CUBO vigentes (17/11/2026).
//  cuentas_cubo (base de Cobranzas) la llena el Portal del Cliente cada hora con
//  DtTabla CLIENTES de CUBO, que devuelve solo los clientes activos (2.405 ese día).
//  Pero graba sin borrar: las cuentas que CUBO dio de baja se quedan con
//  'actualizado' viejo (eran 3.423 de 5.828, algunas con un saldo congelado).
//  Vigente = actualizada en la última corrida, con un día de margen por si alguna
//  corrida falla.
//  Lo usa lo que ve Dirección (Fernando): Inicio, Cobranzas y Análisis.
//  cob(path) → Response de la base de Cobranzas. Devuelve el filtro para PostgREST
//  ('actualizado=gte.…') o '' si no se pudo leer (entonces se cuenta todo, como antes).
// ============================================================
async function filtroVigentes(cob) {
  try {
    const r = await cob('cuentas_cubo?select=actualizado&actualizado=not.is.null&order=actualizado.desc&limit=1');
    const j = r && r.ok ? await r.json() : [];
    const mx = Array.isArray(j) && j[0] && j[0].actualizado;
    if (!mx) return '';
    return 'actualizado=gte.' + encodeURIComponent(new Date(new Date(mx).getTime() - 86400000).toISOString());
  } catch (e) { return ''; }
}

module.exports = { filtroVigentes };
