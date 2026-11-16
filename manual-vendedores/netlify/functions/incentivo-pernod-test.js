// ============================================================
//  GrandBar Hub · Function · incentivo-pernod-test
//   Prueba RÁPIDA y legible (no background): ¿nuestras credenciales llegan a la
//   empresa 3333 "CUBOS" del ERP y pueden leer ventas de una marca Pernod?
//   Abrir en el navegador:  /.netlify/functions/incentivo-pernod-test?key=SYNC_SECRET
//   Muestra el resultado en la misma pantalla (JSON). No escribe nada.
//   Env: AIKON_CUENTA/_PWD/_USUARIO/_PASS (o CS_*), CS_EMPRESA (def 3333),
//        AIKON_MANAGER_URL, SYNC_SECRET.
// ============================================================

const env = (...ks) => { for (const k of ks) { if (process.env[k]) return process.env[k]; } return ''; };
async function aikon(url, body, ms = 60000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const txt = await r.text(); try { return JSON.parse(txt); } catch { return { _raw: txt.slice(0, 200) }; }
  } catch (e) { return { _error: (e && e.message) || String(e) }; } finally { clearTimeout(t); }
}
const listaDe = j => (Array.isArray(j) ? j : (j && (j.data || j.lista || j.retorno)) || []);
const salida = (s, o) => ({ statusCode: s, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(o, null, 2) });

exports.handler = async (event) => {
  try {
    const secret = process.env.SYNC_SECRET;
    const q = (event && event.queryStringParameters) || {};
    if (secret && (q.key || '') !== secret) return salida(401, { ok: false, error: 'Falta ?key= válida (SYNC_SECRET).' });

    const empresa = env('CS_EMPRESA') || '3333';
    const cuenta = env('CS_CUENTA', 'AIKON_CUENTA');
    if (!cuenta) return salida(500, { ok: false, paso: 'credenciales', error: 'No hay CS_CUENTA ni AIKON_CUENTA en las env vars.' });

    // 1) URL de cuenta
    const managerUrl = env('AIKON_MANAGER_URL') || 'http://aikonmanager.com/Manager/api/CuentaURL';
    const j1 = await aikon(managerUrl, { Cuenta: cuenta, CuentaPwd: env('CS_CUENTA_PWD', 'AIKON_CUENTA_PWD') });
    const url = String((j1 && j1.retorno) || '').replace(/\/+$/, '') + '/';
    if (!j1 || !j1.retorno) return salida(502, { ok: false, paso: 'CuentaURL', error: 'No devolvió URL de cuenta', respuesta: JSON.stringify(j1).slice(0, 200) });

    // 2) Token para la empresa 3333
    const j2 = await aikon(url + 'IS3/ObtenerToken', { cuenta, usuario: env('CS_USUARIO', 'AIKON_USUARIO') || 'CS', 'contraseña': env('CS_PASS', 'AIKON_PASS') || '', empresa });
    const token = j2 && j2.token && j2.token.Codigo;
    if (!token) return salida(200, { ok: false, paso: 'ObtenerToken', empresa, diagnostico: `Nuestras credenciales NO abren la empresa ${empresa}. => hace falta el usuario de solo lectura de JP.`, respuesta: JSON.stringify(j2).slice(0, 220) });

    // 3) Leer ventas de un SKU Pernod (Malibu 02010605) para confirmar lectura real
    const B = { cuenta, token };
    const mov = await aikon(url + 'IS3/ListarMovimientosArticulos', { ...B, FechaDesde: '01/10/2026', FechaHasta: new Date().toLocaleDateString('es-AR'), OrigenMov: 'Ventas', ArCodigo: '02010605' }, 60000);
    const lista = listaDe(mov);
    return salida(200, {
      ok: true,
      empresa,
      diagnostico: `✅ Nuestras credenciales SÍ abren la empresa ${empresa} y leen ventas. NO hace falta JP. Avisale a Josefina para validar.`,
      token_obtenido: true,
      movimientos_malibu_desde_01_10: Array.isArray(lista) ? lista.length : 'respuesta inesperada',
      muestra: (Array.isArray(lista) && lista[0]) ? lista[0] : null,
    });
  } catch (e) {
    return salida(500, { ok: false, error: (e && e.message) || String(e) });
  }
};
