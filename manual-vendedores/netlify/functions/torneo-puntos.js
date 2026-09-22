// ============================================================
//  GrandBar Hub · Function · torneo-puntos
//
//  Puntos oficiales del Torneo Doña Paula. Los carga Administración en un
//  CSV de Drive ("TORNEO DOÑA PAULA.csv", columnas Vendedor, Categoría,
//  Concepto, Suma de Puntos) y lo va actualizando. Desde el 22/09/2026 los
//  puntos salen SOLO de ahí (los vendedores ya no registran desde la app).
//
//  El navegador no puede leer Drive directo (no deja, por CORS), así que esta
//  función lo baja y lo devuelve en JSON. Si Administración sube un archivo
//  NUEVO (otro link), hay que cambiar ARCHIVO acá abajo.
// ============================================================

const ARCHIVO = '14vGtRYjcr-0E-5eSSf-5auj3y_WEv9K8';
const URL_CSV = 'https://drive.google.com/uc?export=download&id=' + ARCHIVO;

function json(s, b, cache) {
  return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache || 'no-store' }, body: JSON.stringify(b) };
}

// CSV con comillas (por si algún concepto trae comas)
function partir(l) {
  const out = []; let cur = '', dentro = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch === '"') { if (dentro && l[i + 1] === '"') { cur += '"'; i++; } else dentro = !dentro; }
    else if (ch === ',' && !dentro) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
// "1.234" / "1,5" / "12" → número
const num = s => { const t = String(s || '').replace(/[^\d,.-]/g, ''); if (!t) return 0; const n = parseFloat(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')); return isNaN(n) ? 0 : n; };

exports.handler = async () => {
  try {
    const r = await fetch(URL_CSV, { redirect: 'follow' });
    if (!r.ok) return json(502, { error: 'No se pudo leer el archivo del torneo (Drive respondió ' + r.status + ').' });
    const texto = (await r.text()).replace(/^﻿/, '');
    if (/<html/i.test(texto.slice(0, 200))) return json(502, { error: 'El archivo del torneo no está compartido como "cualquiera con el enlace".' });
    const lineas = texto.split(/\r?\n/).filter(l => l.trim());
    if (!lineas.length) return json(200, { filas: [] });
    // Columnas por nombre, por si cambian de orden
    const cab = partir(lineas[0]).map(norm);
    const col = n => cab.findIndex(c => c.includes(n));
    const iV = col('vendedor'), iC = col('categor'), iK = col('concepto'), iP = col('punto');
    if ([iV, iC, iK, iP].some(i => i < 0)) return json(502, { error: 'El archivo del torneo cambió de columnas (se esperan Vendedor, Categoría, Concepto y Puntos).' });
    const filas = lineas.slice(1).map(partir)
      .map(f => ({ vendedor: f[iV] || '', categoria: f[iC] || '', concepto: f[iK] || '', puntos: num(f[iP]) }))
      .filter(f => f.vendedor);
    // Unos minutos de caché: el archivo cambia cada tanto, no a cada segundo.
    return json(200, { filas, leido: new Date().toISOString() }, 'public, max-age=300');
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
