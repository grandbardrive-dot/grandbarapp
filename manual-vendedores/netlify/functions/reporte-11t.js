// ============================================================
//  GrandBar · Netlify Function · reporte-11t
//  Lee el reporte 11T de Peñaflor ya calculado (Excel GRAND BAR que sube
//  Luciana en admin-11t.html → tabla penaflor_11t_reporte). Devuelve el
//  tablero por canal: CCC (Clientes Con Compra) Real/Objetivo/Alcance/Faltan
//  + el detalle por línea (11T e Innovaciones). NO recalcula ventas: usa los
//  números del sistema tal cual.
//  fzaxwuuodseyyinveknn.  GET ?mes=YYYY-MM (default: mes actual)
// ============================================================

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const CANALES = ['vinotecas', 'tienda_bebidas', 'on_premise', 'on_premise_noche'];
const CANAL_L = { vinotecas: 'Vinotecas', tienda_bebidas: 'Tienda de Bebidas', on_premise: 'On Premise', on_premise_noche: 'On Premise Noche' };
const CANAL_SUB = { vinotecas: 'OFF · 1+1', tienda_bebidas: 'OFF · 1+1', on_premise: 'ON · Restaurantes y Hoteles', on_premise_noche: 'ON · Bares y Discos' };

const alc = (r, o) => (o > 0 ? Math.round((r / o) * 100) : (r > 0 ? 100 : 0));

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const q = (event && event.queryStringParameters) || {};
    const hoy = new Date();

    // ---- Evolución: todos los meses cargados (para comparar mes a mes) ----
    if (q.evolucion) {
      const rr = await fetch(SB_URL + '/rest/v1/penaflor_11t_reporte?select=mes,data,actualizado&order=mes.asc', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
      const all = await rr.json().catch(() => []);
      const meses = (Array.isArray(all) ? all : []).map((row) => {
        const ccc = (row.data && row.data.ccc) || {};
        const canales = {};
        const tot = { real: 0, objetivo: 0 };
        for (const c of CANALES) { const cc = ccc[c] || { real: 0, objetivo: 0 }; canales[c] = { real: cc.real || 0, objetivo: cc.objetivo || 0, alcance: alc(cc.real || 0, cc.objetivo || 0) }; tot.real += cc.real || 0; tot.objetivo += cc.objetivo || 0; }
        tot.alcance = alc(tot.real, tot.objetivo); tot.faltan = Math.max(0, tot.objetivo - tot.real);
        return { mes: row.mes, actualizado: row.actualizado, total: tot, canales };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, meses }) };
    }

    const mes = /^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : (hoy.getUTCFullYear() + '-' + String(hoy.getUTCMonth() + 1).padStart(2, '0'));

    const r = await fetch(SB_URL + '/rest/v1/penaflor_11t_reporte?mes=eq.' + mes + '&select=data,filas,actualizado', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    const rows = await r.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row || !row.data) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mes, hay_datos: false, carga: null, total: { real: 0, objetivo: 0, alcance: 0, faltan: 0 }, canales: {}, vendedores: [] }) };
    }

    const data = row.data || {};
    const ccc = data.ccc || {};
    const lineas = Array.isArray(data.lineas) ? data.lineas : [];

    const fmt = (l) => ({ linea: l.linea, real: l.real || 0, objetivo: l.objetivo || 0, alcance: alc(l.real || 0, l.objetivo || 0), faltan: Math.max(0, (l.objetivo || 0) - (l.real || 0)), por_vendedor: [] });
    const byAlc = (a, b) => a.alcance - b.alcance || b.objetivo - a.objetivo;

    const salida = {};
    const total = { real: 0, objetivo: 0 };
    for (const c of CANALES) {
      const cc = ccc[c] || { real: 0, objetivo: 0 };
      const t11 = lineas.filter((l) => l.canal === c && l.tipo === '11t').map(fmt).sort(byAlc);
      const innov = lineas.filter((l) => l.canal === c && l.tipo === 'innovacion').map(fmt).sort(byAlc);
      const tot = { real: cc.real || 0, objetivo: cc.objetivo || 0 };
      tot.alcance = alc(tot.real, tot.objetivo);
      tot.faltan = Math.max(0, tot.objetivo - tot.real);
      salida[c] = { label: CANAL_L[c], sub: CANAL_SUB[c], t11, innov, tot };
      total.real += tot.real; total.objetivo += tot.objetivo;
    }
    total.alcance = alc(total.real, total.objetivo);
    total.faltan = Math.max(0, total.objetivo - total.real);

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, mes, hay_datos: true,
      carga: { fecha: row.actualizado, filas: row.filas || lineas.length, clientes: total.real },
      total, canales: salida, vendedores: [],
    }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
