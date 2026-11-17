// ============================================================
//  GrandBar Hub · Function · dir-archivos  (Panel de Dirección, 17/11/2026)
//  Archivos de Administración que Fernando descarga tal cual, desde Reportes ›
//  Archivos. Por ahora la Comparativa Anual (carpeta SHARE de Drive; Administración
//  la actualiza, probablemente los lunes).
//
//  El Excel pesa ~31 MB y una función no puede devolver más de ~6 MB, así que no se
//  pasa por acá: la función controla que quien pide sea Dirección y devuelve el link
//  de descarga directa de Drive, más la fecha de la última actualización (encabezado
//  Last-Modified de Drive). Siempre baja la versión que esté en Drive en ese momento.
//  Si Administración lo reemplaza por un archivo NUEVO (otro link) en vez de pisarlo,
//  hay que cambiar el ID en _finanzas-archivos.js (estado-sistema avisa si se pone viejo).
//
//  GET ?archivo=comparativa → { nombre, url, actualizado, tamano }
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];
const FIN = require('./_finanzas-archivos');

const ARCHIVOS = {
  comparativa: { id: FIN.comparativa, nombre: 'Comparativa anual' },
};
const descarga = (id) => 'https://drive.usercontent.google.com/download?id=' + id + '&export=download&confirm=t';

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    if (!DIR_ROLES.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Solo Dirección.' });

    const q = event.queryStringParameters || {};
    const a = ARCHIVOS[q.archivo || 'comparativa'];
    if (!a) return json(404, { error: 'Ese archivo no existe.' });

    // HEAD: solo los encabezados (fecha y tamaño), sin bajar los 31 MB.
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
    let r;
    try { r = await fetch(descarga(a.id), { method: 'HEAD', redirect: 'follow', signal: ctrl.signal }); }
    finally { clearTimeout(t); }
    if (!r.ok) return json(502, { error: 'No se pudo leer el archivo en Drive (respondió ' + r.status + ').' });
    const lm = r.headers.get('last-modified');
    return json(200, {
      nombre: a.nombre,
      url: descarga(a.id),
      actualizado: lm ? new Date(lm).toISOString() : null,
      tamano: Number(r.headers.get('content-length')) || null,
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

// Estado del sistema: los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('dir-archivos', module.exports.handler);
