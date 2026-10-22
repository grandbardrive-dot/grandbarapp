// ============================================================
//  GrandBar Hub · Function · factura-vendedor
//  Descarga de la FACTURA de un cliente para el VENDEDOR (misma factura que ve el
//  cliente en su portal). Autenticada por el vendedor del Hub:
//   1) valida al vendedor (token del Hub → usuarios.codigo_vendedor)
//   2) verifica que el cliente (codigo) sea de SU cartera (cuentas_cubo.vendedor)
//      y que la factura (numero) sea de ese cliente (tabla facturas)
//   3) pide el comprobante a Sinergis/Aikon (igual que factura-pdf del portal) y
//      arma el HTML listo para imprimir/guardar como PDF.
//  GET ?tipo=FAC&numero=0005-00036374/A&codigo=07267  (&modo=pago opcional)
//  Env: COBRANZAS_SERVICE_ROLE + AIKON_* (ya usadas por las funciones de sync del Hub)
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';

const A = {
  cuenta: process.env.AIKON_CUENTA, pwd: process.env.AIKON_CUENTA_PWD,
  usuario: process.env.AIKON_USUARIO, pass: process.env.AIKON_PASS || '', empresa: process.env.AIKON_EMPRESA,
  managerUrl: process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL',
};
const EMISOR = {
  razon: 'Grandbar SA', dom: 'Cervantes 2511 C.P. (5501)', loc: 'Godoy Cruz / Mendoza',
  tel: '(0261) 4391300', email: 'administracion@grandbar.com.ar', web: 'www.grandbar.com.ar',
  cuit: '30-71237995-9', iibb: '913-906593', inicio: '01/08/2012', comInd: '1234512345', condIva: 'I.V.A. Resp. Inscripto',
};

const html = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: b });
const padCod = v => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? d.padStart(5, '0') : ''; };
const normCod = v => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? d.padStart(5, '0') : ''; };

async function aikon(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({}));
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n, d = 2) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: d });
function fechaNet(s) { const m = String(s || '').match(/\/Date\((\d+)/); return m ? new Date(Number(m[1])).toLocaleDateString('es-AR') : '—'; }

const _UNID = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const _DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const _CENT = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
function _menor100(x) { if (x < 30) return _UNID[x]; const d = Math.floor(x / 10), u = x % 10; return u ? _DEC[d] + ' y ' + _UNID[u] : _DEC[d]; }
function _menor1000(x) { if (x === 100) return 'cien'; const c = Math.floor(x / 100), r = x % 100; const cw = c ? _CENT[c] : '', rw = r ? _menor100(r) : ''; return ((cw + (cw && rw ? ' ' : '') + rw).trim()) || 'cero'; }
function _entLetras(x) {
  if (x === 0) return 'cero';
  let out = '';
  const millones = Math.floor(x / 1000000), miles = Math.floor((x % 1000000) / 1000), resto = x % 1000;
  if (millones) out += (millones === 1 ? 'un millón' : _menor1000(millones).replace(/uno$/, 'ún') + ' millones');
  if (miles) out += (out ? ' ' : '') + (miles === 1 ? 'mil' : _menor1000(miles).replace(/uno$/, 'ún') + ' mil');
  if (resto) out += (out ? ' ' : '') + _menor1000(resto);
  return out.trim();
}
function enLetras(n) {
  const v = Math.abs(Number(n) || 0);
  const ent = Math.floor(v);
  const cent = String(Math.round((v - ent) * 100)).padStart(2, '0');
  return _entLetras(ent) + ' con ' + cent + '/100';
}

function reciboHTML({ nroDoc, fecha, cliente, cuit, letras, leyenda, filasHtml, valoresHtml, total }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recibo ${nroDoc}</title>
<style>
  @page{size:A4;margin:14mm}
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;padding:22px;font-size:12px;background:#fff}
  .hoja{max-width:760px;margin:0 auto}
  .dot{border-top:1px dotted #444;margin:10px 0}.dot2{border-top:1px dotted #999;margin:6px 0}
  .cab{display:grid;grid-template-columns:1fr 1fr}
  .cab .izq b{font-size:12px}.cab .izq div{line-height:1.45}
  .cab .der{text-align:center}.cab .der .t{font-size:12px;letter-spacing:1px}
  .recibi{line-height:1.5;margin:2px 0}
  table.cmp{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}
  table.cmp th{font-weight:400;text-align:left;padding:2px 6px}
  table.cmp td{padding:2px 6px;vertical-align:top}
  .mid{border-left:1px solid #000}.cmp-wrap{min-height:150px}
  .det-tit{text-align:center;letter-spacing:1px;margin:2px 0}
  .val{display:flex;gap:40px;padding:2px 6px}.val .lbl{min-width:220px}
  .espacio{min-height:120px}.total{text-align:center;letter-spacing:1px;padding:4px 0}
  .imprimir{max-width:760px;margin:6px auto 14px;text-align:center}
  .imprimir button{background:#1f447f;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer}
  @media print{.imprimir{display:none}}
</style></head><body>
  <div class="imprimir"><button onclick="window.print()">🖨️ Descargar / Imprimir</button></div>
  <div class="hoja">
    <div class="dot"></div>
    <div class="cab">
      <div class="izq"><b>GRANDBAR DISTRIBUCIONES</b>
        <div style="margin-top:10px">Cervantes 2511 CP (5501)</div>
        <div>Godoy Cruz | Mendoza | Arg</div>
        <div>Cel (0261) 4391300- 4391824</div>
        <div>administracion@grandbar.com.ar</div>
      </div>
      <div class="der"><div class="t">RECIBO</div>
        <div style="margin-top:12px">${fecha}</div>
        <div>REC ${nroDoc}</div>
        <div style="margin-top:14px">Documento no válido como factura</div>
      </div>
    </div>
    <div class="dot"></div>
    <div class="recibi">Recibí de: ${cliente} , Cuit ${cuit} , la suma de pesos ${esc(letras)}.- , ${leyenda}</div>
    <div class="dot"></div>
    <div class="cmp-wrap"><table class="cmp">
      <thead><tr>
        <th style="width:24%">COMPROBANTE</th><th style="width:13%">FECHA</th><th style="width:13%">IMPORTE</th>
        <th class="mid" style="width:24%;padding-left:14px">COMPROBANTE</th><th style="width:13%">FECHA</th><th style="width:13%">IMPORTE</th>
      </tr></thead>
      <tbody>${filasHtml}</tbody>
    </table></div>
    <div class="dot"></div>
    <div class="det-tit">DETALLE DE VALORES RECIBIDOS</div>
    <div class="dot2"></div>
    ${valoresHtml}
    <div class="espacio"></div>
    <div class="dot"></div>
    <div class="total">TOTAL $ ${money(total)}</div>
    <div class="dot"></div>
  </div>
</body></html>`;
}
function filasComprobantes(refs) {
  const mitad = Math.ceil(refs.length / 2);
  const izq = refs.slice(0, mitad), der = refs.slice(mitad);
  const nFilas = Math.max(izq.length, der.length, 5);
  let out = '';
  for (let i = 0; i < nFilas; i++) {
    const a = izq[i], b = der[i];
    out += `<tr><td>${a ? a.ref : ''}</td><td>${a ? a.fecha : ''}</td><td>${a ? money(a.importe) : ''}</td><td class="mid" style="padding-left:14px">${b ? b.ref : ''}</td><td>${b ? b.fecha : ''}</td><td>${b ? money(b.importe) : ''}</td></tr>`;
  }
  return out;
}
function renderRecibo(c) {
  const cliente = `[${esc(c.ClienteCodigo)}] ${esc(c.ClienteRazonSocial || c.ClienteNombre)}`;
  const total = Number(c.TotalPagosComp || c.TotalCancelacion || c.TotalComprobante || c.TotalComprobanteGrabado || 0);
  const fecha = fechaNet(c.FechaEmision);
  const nroDoc = `${esc(c.Sucursal)}-${esc(c.NumeroFiscal || c.Numero)}${c.Tipo ? '/' + esc(c.Tipo) : ''}`;
  const refs = [];
  for (const d of (c.Detalle || [])) {
    const ref = d.Referencia || (d.ReferenciaNumero ? `${d.ReferenciaCodigo} ${d.ReferenciaSucursal}-${d.ReferenciaNumero}/${d.ReferenciaTipo}` : (d.Descripcion || ''));
    if (!ref) continue;
    refs.push({ ref: esc(ref), fecha: fechaNet(d.ReferenciaFechaEmision) || fecha, importe: Number(d.ImporteUni || d.ImporteUnitario || d.Total || 0) });
  }
  if (!refs.length) refs.push({ ref: `${esc(c.Codigo || '')} ${nroDoc}`, fecha, importe: total });
  let pagos = (c.Pagos || []).filter((p) => Number(p.Importe)).map((p) => ({ desc: esc(p.Descripcion || 'Pago'), imp: Number(p.Importe) }));
  if (!pagos.length) pagos = [{ desc: 'Pago en Efectivo', imp: total }];
  const valoresHtml = pagos.map((p) => `<div class="val"><span class="lbl">$ ${p.desc}</span><span>${money(p.imp)}</span></div>`).join('');
  return reciboHTML({ nroDoc, fecha, cliente, cuit: esc(c.ClienteCUIT || ''), letras: enLetras(total), leyenda: 'en los siguientes valores que una vez efectivizados serán aplicados al pago según detalle.', filasHtml: filasComprobantes(refs), valoresHtml, total });
}
function renderComprobantePago(c) {
  const cliente = `[${esc(c.ClienteCodigo)}] ${esc(c.ClienteRazonSocial || c.ClienteNombre)}`;
  const total = Number(c.TotalCancelacion || c.TotalComprobante || 0);
  const fechaPago = fechaNet(c.FechaCancelacion) || fechaNet(c.FechaEmision);
  const facRef = `${esc(c.Codigo || 'FAC')} ${esc(c.Sucursal)}-${esc(c.NumeroFiscal || c.Numero)}/${esc(c.Tipo || '')}`;
  const nroDoc = `${esc(c.Sucursal)}-${esc(c.NumeroFiscal || c.Numero)}${c.Tipo ? '/' + esc(c.Tipo) : ''}`;
  const refs = [{ ref: facRef, fecha: fechaNet(c.FechaEmision), importe: total }];
  const valoresHtml = `<div class="val"><span class="lbl">$ Pago recibido</span><span>${money(total)}</span></div>`;
  return reciboHTML({ nroDoc, fecha: fechaPago, cliente, cuit: esc(c.ClienteCUIT || ''), letras: enLetras(total), leyenda: 'en cancelación de la factura detallada a continuación.', filasHtml: filasComprobantes(refs), valoresHtml, total });
}
function render(c) {
  const letra = c.Tipo || 'A';
  const nroFactura = `${c.Codigo} - Nº: ${c.Sucursal} - ${c.NumeroFiscal || c.Numero} ${letra}`;
  const remito = (c.Detalle && c.Detalle[0] && c.Detalle[0].Referencia) || '';
  const filas = (c.Detalle || []).map((d) => `
    <tr>
      <td class="c">${esc(d.Articulo)}</td>
      <td>${esc(d.Descripcion)}</td>
      <td class="r">${num(d.Cantidad, 2)}</td>
      <td class="c">${esc(d.UnidadMedidaActiva || d.UnidadMedidaCodigo)}</td>
      <td class="r">${money(d.ImporteUnitarioConDescuento)}</td>
      <td class="r">${esc(d.BonificacionPorcentaje || '0')}</td>
      <td class="r">${money(d.ImporteImpIntUnitario)}</td>
      <td class="r">${num(d.AlicuotaIvaPorcentaje, 2)}</td>
      <td class="r">${money(d.TotalNeto)}</td>
    </tr>`).join('');
  const tot = (l, v, big) => `<tr class="${big ? 'big' : ''}"><td>${l}</td><td class="r">$ ${money(v)}</td></tr>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factura ${esc(c.Sucursal)}-${esc(c.NumeroFiscal || c.Numero)} ${esc(letra)}</title>
<style>
  @page{size:A4;margin:12mm}
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1a2740;margin:0;padding:16px;font-size:12px}
  .hoja{max-width:820px;margin:0 auto;border:1px solid #1a2740}
  .top{display:grid;grid-template-columns:1fr 90px 1fr;border-bottom:1px solid #1a2740}
  .marca{padding:14px 16px} .marca b{font-size:26px;color:#1f447f;letter-spacing:1px} .marca .sub{letter-spacing:6px;color:#1f447f;font-size:11px}
  .letra{border-left:1px solid #1a2740;border-right:1px solid #1a2740;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .letra .big{font-size:40px;font-weight:800;line-height:1} .letra .cod{font-size:9px}
  .tit{padding:14px 16px;text-align:right} .tit .f{font-size:22px;font-weight:800} .tit .n{font-weight:700;margin-top:6px}
  .emisor{display:grid;grid-template-columns:1.3fr 1fr;border-bottom:2px solid #1a2740;font-size:11px}
  .emisor .l{padding:8px 16px} .emisor .r{padding:8px 16px;border-left:1px solid #cbd3e0}
  .cliente{display:grid;grid-template-columns:1fr 1fr 1fr;padding:8px 16px;border-bottom:2px solid #1a2740;font-size:11px;gap:2px 12px}
  .cliente .full{grid-column:1/-1;font-weight:700;font-size:12px}
  table.items{width:100%;border-collapse:collapse;font-size:11px}
  table.items th{background:#eef1f6;border-bottom:1px solid #1a2740;padding:5px 6px;text-align:right} table.items th:nth-child(1),table.items th:nth-child(2){text-align:left}
  table.items td{padding:4px 6px;border-bottom:1px solid #eef} td.r{text-align:right} td.c{text-align:center}
  .pie{display:grid;grid-template-columns:1fr 320px;gap:16px;padding:12px 16px}
  .cae{font-size:11px;align-self:end} .cae b{font-size:13px}
  table.tot{width:100%;border-collapse:collapse} table.tot td{padding:4px 6px;border-bottom:1px solid #eef} table.tot td.r{text-align:right;font-variant-numeric:tabular-nums}
  table.tot tr.big td{border-top:2px solid #1a2740;font-weight:800;font-size:14px;color:#1f447f}
  .imprimir{max-width:820px;margin:10px auto;text-align:center}
  .imprimir button{background:#1f447f;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer}
  @media print{.imprimir{display:none}}
</style></head><body>
  <div class="imprimir"><button onclick="window.print()">🖨️ Descargar / Imprimir factura</button></div>
  <div class="hoja">
    <div class="top">
      <div class="marca"><b>GRANDBAR</b><div class="sub">DISTRIBUCIONES</div></div>
      <div class="letra"><div class="big">${esc(letra)}</div><div class="cod">Cod Nº 001</div></div>
      <div class="tit"><div class="f">${esc(c.Descripcion1 || 'Comprobante')}</div><div class="n">${esc(nroFactura)}</div><div>Fecha: ${fechaNet(c.FechaEmision)}</div></div>
    </div>
    <div class="emisor">
      <div class="l"><b>Razón Social:</b> ${esc(EMISOR.razon)}<br><b>Domicilio:</b> ${esc(EMISOR.dom)}<br>Loc/Pcia: ${esc(EMISOR.loc)}<br><b>Tel.:</b> ${esc(EMISOR.tel)} · <b>Email:</b> ${esc(EMISOR.email)}<br><b>Web:</b> ${esc(EMISOR.web)}</div>
      <div class="r"><b>CUIT:</b> ${esc(EMISOR.cuit)}<br><b>IIBB:</b> ${esc(EMISOR.iibb)}<br><b>Inicio de Actividades:</b> ${esc(EMISOR.inicio)}<br><b>Nro. Com. e Ind.:</b> ${esc(EMISOR.comInd)}<br><b>Condición ante IVA:</b> ${esc(EMISOR.condIva)}</div>
    </div>
    <div class="cliente">
      <div class="full">Sres: [${esc(c.ClienteCodigo)}] ${esc(c.ClienteRazonSocial || c.ClienteNombre)} ${c.ClienteNombre && c.ClienteNombre !== c.ClienteRazonSocial ? '(' + esc(c.ClienteNombre.trim()) + ')' : ''}</div>
      <div><b>Domicilio:</b> ${esc(c.ClienteDireccionFiscal || c.ClienteDireccion)}</div>
      <div><b>CUIT:</b> ${esc(c.ClienteCUIT)}</div>
      <div><b>Remito:</b> ${esc(remito)}</div>
      <div><b>CP/LOC:</b> [${esc(c.ClienteCodPos)}] ${esc(c.ClienteLocalidad)} Pcia: ${esc(c.ClienteProvinciaNombre)}</div>
      <div><b>IVA:</b> ${esc(c.ClienteCondIVADescripcion)}</div>
      <div><b>Consolidado:</b> ${esc(c.ConsolidadoNumero || '')}</div>
      <div><b>Cond. de venta:</b> ${esc(c.CondicionVentaDescri)}</div>
      <div><b>IIBB:</b> ${esc(c.ClienteIIBB || '')}</div>
      <div><b>Vendedor:</b> ${esc(c.VendedorNombre || '')}</div>
    </div>
    <table class="items">
      <thead><tr><th>CÓDIGO</th><th>DESCRIPCIÓN</th><th>CANT.</th><th>U.M.</th><th>UNI C/DTO</th><th>%BONIF</th><th>IMP INT</th><th>%IVA</th><th>TOTAL</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="pie">
      <div class="cae">
        <b>CAE Nº:</b> ${esc(c.CAENumero)}<br>
        <b>Vto. CAE:</b> ${fechaNet(c.CAEFechaVenc)}<br>
        <b>Vencimiento pago:</b> ${fechaNet(c.FechaVencimiento)}
      </div>
      <table class="tot">
        ${tot('Subtotal neto', c.SubTotalComprobante)}
        ${Number(c.TotalIVA21) ? tot('IVA 21%', c.TotalIVA21) : ''}
        ${Number(c.TotalIVA105) ? tot('IVA 10,5%', c.TotalIVA105) : ''}
        ${Number(c.TotalImpInt) ? tot('Impuesto Interno', c.TotalImpInt) : ''}
        ${Number(c.TotalPercepIVA) ? tot('Percepción IVA', c.TotalPercepIVA) : ''}
        ${Number(c.TotalPercepIIBB) ? tot('Percepción IIBB', c.TotalPercepIIBB) : ''}
        ${tot('TOTAL', c.TotalComprobante, true)}
      </table>
    </div>
  </div>
</body></html>`;
}

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return html(500, '<h3>Falta configuración (COBRANZAS_SERVICE_ROLE).</h3>');

    const q = event.queryStringParameters || {};
    const esLista = q.que === 'lista';
    const resp = esLista
      ? (s, obj) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) })
      : (s, h) => html(s, h);
    const err = (s, msg) => resp(s, esLista ? { error: msg } : '<h3>' + msg + '</h3>');

    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return err(401, 'Iniciá sesión para ver las facturas.');
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return err(401, 'Tu sesión venció. Volvé a entrar.');
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=codigo_vendedor,es_supervisor,rol', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = (((await pRes.json()) || [])[0] || {});
    const codVend = perfil.codigo_vendedor;
    const rol = String(perfil.rol || '').toLowerCase();
    // Acceso amplio: supervisores y roles de administración/dirección ven cualquier cliente.
    const amplio = perfil.es_supervisor === true || ['admin', 'direccion', 'desarrollo', 'diseno', 'administracion', 'tesoreria'].includes(rol);

    const cod = padCod(q.codigo);
    if (!cod) return err(400, 'Falta el código del cliente.');

    const cob = p => fetch(COB_URL + '/rest/v1/' + p, { headers: { apikey: service, Authorization: 'Bearer ' + service } });
    const cc = (((await (await cob('cuentas_cubo?codigo=eq.' + encodeURIComponent(cod) + '&select=nombre,vendedor&limit=1')).json())) || [])[0];
    if (!cc) return err(404, 'No encontré ese cliente.');
    if (!amplio && String(cc.vendedor || '') !== String(codVend || '')) return err(403, 'Ese cliente no es de tu cartera.');

    // Modo lista: devuelve las facturas con saldo (JSON) para mostrarlas en la ficha.
    if (esLista) {
      const facs = await (await cob('facturas?codigo=eq.' + encodeURIComponent(cod) + '&saldo=neq.0&select=numero,tipo,fecha,vencimiento,importe,saldo&order=vencimiento.asc.nullslast&limit=300')).json();
      return resp(200, { razon_social: cc.nombre || null, facturas: Array.isArray(facs) ? facs : [] });
    }

    // Modo descarga.
    const tipo = q.tipo || 'FAC';
    const numero = String(q.numero || '').trim();
    if (!numero) return err(400, 'Falta la factura.');
    const fac = (((await (await cob('facturas?codigo=eq.' + encodeURIComponent(cod) + '&numero=eq.' + encodeURIComponent(numero) + '&select=numero&limit=1')).json())) || [])[0];
    if (!fac) return html(404, '<h3>No encontré esa factura en la cuenta del cliente.</h3>');

    const m = numero.match(/^(\d+)-(\d+)\/?\s*([A-Za-z0-9]*)$/);
    if (!m) return html(400, '<p>Número inválido.</p>');
    const Sucursal = m[1], Numero = m[2], Tipo = (m[3] || 'A').toUpperCase();

    const j1 = await aikon(A.managerUrl, { Cuenta: A.cuenta, CuentaPwd: A.pwd });
    const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
    if (!urlCuenta) return html(502, '<h3>No se pudo conectar con el sistema (CuentaUrl).</h3>');
    const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta: A.cuenta, usuario: A.usuario, 'contraseña': A.pass, empresa: A.empresa });
    const tk = j2.token && j2.token.Codigo;
    if (!tk) return html(502, '<h3>No se pudo autenticar con el sistema.</h3>');
    const jc = await aikon(urlCuenta + '/IS3/ObtenerComprobante', { cuenta: A.cuenta, token: tk, Codigo: tipo, Sucursal, Numero, Tipo });
    const comp = jc && jc.Comprobante;
    if (!comp) return html(404, '<h3>No se encontró el comprobante en el sistema.</h3>');
    // Seguridad extra: el comprobante tiene que ser del cliente verificado.
    if (normCod(comp.ClienteCodigo) !== cod) return html(403, '<h3>Esa factura no corresponde al cliente.</h3>');

    if (q.modo === 'pago') return html(200, renderComprobantePago(comp));
    const esRecibo = String(comp.Codigo || '').toUpperCase() === 'REC';
    return html(200, esRecibo ? renderRecibo(comp) : render(comp));
  } catch (e) {
    return html(500, '<h3>Error generando la factura.</h3><pre>' + String((e && e.message) || e).slice(0, 200) + '</pre>');
  }
};
