// ============================================================
//  GrandBar Hub · módulo · _comp-vendedor  (16/11/2026)
//  Comprobantes que mandan los vendedores (WhatsApp o "subir varios" en la planilla),
//  tabla comprobantes_vendedor de la base cobranzas. Lo usan la planilla del vendedor
//  (planilla-cobranzas) y el panel de Moni (cobranzas-panel) para:
//    - listar los que no encontraron su fila ("sin asignar"),
//    - asignarlos a mano a una fila o descartarlos,
//    - disparar la lectura con IA (comprobantes-wa-background).
//  `cob` es el fetch a la base cobranzas con la llave de servicio de cada función.
// ============================================================

const BASE = () => process.env.URL || 'https://portalgrandbar.com';

// Comprobantes de un vendedor que todavía no tienen fila, de los días alrededor de `fecha`
// (o de los últimos 6 días si no hay fecha).
async function sinAsignar(cob, vendedor, fecha) {
  let rango;
  if (fecha) {
    const d0 = new Date(fecha + 'T12:00:00Z').getTime();
    rango = '&recibido_at=gte.' + new Date(d0 - 4 * 864e5).toISOString() + '&recibido_at=lt.' + new Date(d0 + 4 * 864e5).toISOString();
  } else rango = '&recibido_at=gte.' + new Date(Date.now() - 6 * 864e5).toISOString();
  const r = await cob('comprobantes_vendedor?select=id,origen,url,mime,nombre,recibido_at,estado,monto,pagador,pagador_cuit,fecha_pago,banco,nota'
    + '&vendedor=eq.' + encodeURIComponent(vendedor) + '&estado=in.(nuevo,leyendo,leido,sin_asignar,error)' + rango + '&order=recibido_at.asc');
  const j = r.ok ? await r.json() : [];
  return Array.isArray(j) ? j : [];
}

// Asigna un comprobante a una fila de la planilla (lo agrega a sus comprobantes).
// `vendedor` = si viene, la fila y el comprobante tienen que ser de ese vendedor.
async function asignar(cob, compId, filaId, quien, vendedor) {
  const c = ((await (await cob('comprobantes_vendedor?select=*&id=eq.' + encodeURIComponent(compId))).json()) || [])[0];
  if (!c) return { error: 'Ese comprobante ya no existe.', status: 404 };
  const f = ((await (await cob('planilla_cobranzas?select=id,vendedor,comprobantes&id=eq.' + encodeURIComponent(filaId))).json()) || [])[0];
  if (!f) return { error: 'Esa fila ya no existe.', status: 404 };
  if (vendedor && (String(c.vendedor) !== String(vendedor) || String(f.vendedor) !== String(vendedor))) return { error: 'Ese comprobante o esa fila no son tuyos.', status: 403 };
  if (String(c.vendedor) !== String(f.vendedor)) return { error: 'La fila es de otro vendedor.', status: 400 };
  const lista = Array.isArray(f.comprobantes) ? f.comprobantes.filter(x => !(x && x.comp_id === c.id)) : [];
  lista.push({ url: c.url, nombre: (c.origen === 'whatsapp' ? 'WhatsApp' : 'Subido') + (c.monto ? ' · $' + Math.round(Number(c.monto)).toLocaleString('es-AR') : ''), origen: c.origen, comp_id: c.id, monto_ia: c.monto != null ? Number(c.monto) : null, pagador: c.pagador || null });
  const up = await cob('planilla_cobranzas?id=eq.' + encodeURIComponent(filaId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ comprobantes: lista }) });
  if (!up.ok) return { error: 'No se pudo guardar.', status: 500 };
  // Si estaba enganchado a otra fila, se saca de ahí.
  if (c.fila_id && c.fila_id !== filaId) {
    const o = ((await (await cob('planilla_cobranzas?select=id,comprobantes&id=eq.' + encodeURIComponent(c.fila_id))).json()) || [])[0];
    if (o) await cob('planilla_cobranzas?id=eq.' + encodeURIComponent(o.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ comprobantes: (o.comprobantes || []).filter(x => !(x && x.comp_id === c.id)) }) });
  }
  await cob('comprobantes_vendedor?id=eq.' + encodeURIComponent(compId), { method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ estado: 'asignado', fila_id: filaId, asignado_por: quien || 'a mano', asignado_at: new Date().toISOString() }) });
  return { ok: true, comprobantes: lista };
}

async function descartar(cob, compId, quien, vendedor) {
  const filtro = 'id=eq.' + encodeURIComponent(compId) + (vendedor ? '&vendedor=eq.' + encodeURIComponent(vendedor) : '');
  const r = await cob('comprobantes_vendedor?' + filtro, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ estado: 'descartado', asignado_por: quien || null, asignado_at: new Date().toISOString() }) });
  const j = r.ok ? await r.json() : [];
  return Array.isArray(j) && j.length ? { ok: true } : { error: 'Ese comprobante ya no existe.', status: 404 };
}

// Dispara la lectura con IA sin esperarla (la background contesta 202 al toque).
async function procesar() {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
  await fetch(BASE() + '/.netlify/functions/comprobantes-wa-background', { method: 'POST', signal: ctl.signal }).catch(() => {});
  clearTimeout(t);
}

module.exports = { sinAsignar, asignar, descartar, procesar };
