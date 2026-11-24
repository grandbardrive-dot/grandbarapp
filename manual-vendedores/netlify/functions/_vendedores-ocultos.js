// ============================================================
//  Vendedores ocultos (24/11/2026): los que no van en ninguna lista, selector ni ranking de
//  las pantallas (vendedores.oculto en la base del Manual). Pedido del usuario: Fernando
//  Malanca (002), Fernando Malanca Distribución (030), Gustavo Martínez (001) y Georgina
//  Grosso (035, ya no trabaja). Sus ventas siguen sumando en los totales.
//  Para sacar a alguien más alcanza con marcarlo en la base:
//    update vendedores set oculto = true where codigo = 'xxx';
//  (El "_" evita que Netlify lo publique como función.)
// ============================================================
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const RESPALDO = ['001', '002', '030', '035'];   // si la base no responde
const cod3 = c => { const s = String(c == null ? '' : c).trim(); return /^\d{1,3}$/.test(s) ? s.padStart(3, '0') : s; };

let CACHE = { t: 0, s: null };
// Set con los códigos (3 dígitos) de los vendedores ocultos. Caché de 10 minutos.
async function ocultos() {
  if (CACHE.s && Date.now() - CACHE.t < 10 * 60e3) return CACHE.s;
  try {
    const r = await fetch(MAN_URL + '/rest/v1/vendedores?oculto=is.true&select=codigo', { headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY } });
    if (!r.ok) throw new Error('Manual ' + r.status);
    const l = await r.json();
    CACHE = { t: Date.now(), s: new Set((Array.isArray(l) ? l : []).map(v => cod3(v.codigo))) };
  } catch (e) {
    if (!CACHE.s) return new Set(RESPALDO);
  }
  return CACHE.s;
}
// ¿Este código es de un vendedor oculto? (acepta '2', '02' o '002')
const esOculto = (set, codigo) => !!codigo && set.has(cod3(codigo));

module.exports = { ocultos, esOculto, cod3 };
