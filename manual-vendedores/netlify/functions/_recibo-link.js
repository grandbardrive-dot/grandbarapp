// ============================================================
//  GrandBar Hub · módulo · _recibo-link  (19/11/2026)
//  Link FIRMADO a un recibo del ERP (tabla recibos_erp): abre el recibo oficial de
//  GrandBar (mismo diseño que el portal de clientes) sin iniciar sesión, para que el
//  vendedor lo vea, lo descargue o se lo reenvíe al cliente. Solo se puede abrir con la
//  firma (HMAC con una llave del servidor), así nadie puede adivinar otros recibos.
//    r = <empresa>-<sucursal>-<numero>-<firma>   (ej. 0001-0047-10012917-a1b2c3...)
//  Lo arman cobranzas-panel (Moni lo manda por WhatsApp) y planilla-cobranzas (los
//  recibos del vendedor); lo abre factura-vendedor?r=...
// ============================================================

const crypto = require('crypto');
const BASE = () => process.env.URL || 'https://portalgrandbar.com';
const llave = () => process.env.COBRANZAS_SERVICE_ROLE || '';

const firma = (clave) => crypto.createHmac('sha256', llave()).update('recibo:' + clave).digest('hex').slice(0, 24);

function token(r) {
  const clave = [r.empresa, r.sucursal, r.numero].join('-');
  return clave + '-' + firma(clave);
}

function url(r) { return BASE() + '/.netlify/functions/factura-vendedor?r=' + encodeURIComponent(token(r)); }

// Devuelve { empresa, sucursal, numero } si la firma es válida; si no, null.
function leer(t) {
  const m = String(t || '').match(/^(\d{4})-(\d{4})-(\d{8})-([0-9a-f]{24})$/);
  if (!m) return null;
  const clave = m[1] + '-' + m[2] + '-' + m[3];
  const a = Buffer.from(firma(clave)), b = Buffer.from(m[4]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { empresa: m[1], sucursal: m[2], numero: m[3] };
}

module.exports = { token, url, leer };
