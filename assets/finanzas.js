// ─── Finanzas: lo que Sebastián deja en Drive ────────────────────────────────
// Cuatro archivos que ya se actualizan solos del lado de Administración. Se leen
// igual que la planilla de ventas (assets/ventas.js): con una consulta a Google
// (gviz), sin bajar el Excel entero y sin claves, porque los cuatro están
// compartidos por link.
//
//   Efectivo.xlsx                → saldo de caja de hoy, por sucursal
//   Cheques.xlsx                 → cartera de cheques y qué se acredita cuándo
//   Proceso_Pago_Proveedores.xlsx→ cuánto hay que pagar, semana por semana
//   Ordenes Compra activa.xlsx   → mercadería pedida que todavía no llegó
//
// Si un archivo no se puede leer, ese número NO se inventa: la pantalla muestra
// "no se pudo leer" y sigue con los demás.
window.GBFinanzas = (function () {
  var ARCHIVOS = {
    efectivo: '1rp6xExmicN-BcsH8ld7_MkWnFCjBqiM2',
    cheques:  '1-EN-FTusyvtCq5iQUGeALVi60u4TG5cA',
    pagos:    '120rJc8l7ohOOb-S7_lbBbSJ2sXXkttY-',
    ordenes:  '1IK14iuaOZ7htMo1pH-hBfksTbuWn9G-c',
  };
  var cache = null;

  function url(id, hoja) {
    return 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(hoja);
  }

  // ── CSV ────────────────────────────────────────────────────────────────────
  function partirLinea(l) {
    var out = [], cur = '', dentro = false;
    for (var i = 0; i < l.length; i++) {
      var ch = l[i];
      if (ch === '"') { if (dentro && l[i + 1] === '"') { cur += '"'; i++; } else dentro = !dentro; }
      else if (ch === ',' && !dentro) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function filas(texto) {
    return String(texto || '').replace(/\r/g, '').split('\n')
      .filter(function (l) { return l.trim() !== ''; }).map(partirLinea);
  }
  async function traer(id, hoja) {
    var r = await fetch(url(id, hoja), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return filas(await r.text());
  }
  // Los montos vienen "$1,864,450,996", "70,281,917.41" o "481000.00".
  function monto(s) {
    var t = String(s == null ? '' : s).replace(/[^\d.,-]/g, '');
    if (!t) return null;
    var coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
    var dec = Math.max(coma, punto);
    if (dec > -1 && t.length - dec - 1 <= 2 && t.length - dec - 1 > 0) {
      t = t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1);
    } else {
      t = t.replace(/[.,]/g, '');
    }
    var n = parseFloat(t);
    return isNaN(n) ? null : n;
  }
  var texto = function (s) { return String(s == null ? '' : s).trim(); };

  // ── Fechas ─────────────────────────────────────────────────────────────────
  function aFecha(dmy) {                       // "09/10/2026" → Date
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto(dmy));
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }
  // Lunes a domingo de la semana en curso.
  function semanaActual() {
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var d = hoy.getDay(), lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((d + 6) % 7));
    var domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    return { desde: lunes, hasta: domingo, hoy: hoy };
  }

  // ── Efectivo en caja ───────────────────────────────────────────────────────
  async function efectivo() {
    var f = await traer(ARCHIVOS.efectivo, 'Dinero en efectivo');
    var por = [], total = null;
    f.forEach(function (fila) {
      var nom = texto(fila[0]), val = monto(fila[1]);
      if (val == null || !nom) return;
      if (/total/i.test(nom)) total = val;
      else if (!/saldo de caja/i.test(nom) || /sucursal/i.test(nom) === false) por.push({ sucursal: nom, saldo: val });
    });
    if (total == null) total = por.reduce(function (a, x) { return a + x.saldo; }, 0);
    // La fecha del corte está en el encabezado del libro mayor.
    var fecha = null;
    try {
      var m = await traer(ARCHIVOS.efectivo, 'Mendoza');
      var cab = (m[0] || []).join(' ');
      var mm = /Hasta:\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec(cab);
      if (mm) fecha = mm[1];
    } catch (e) {}
    return { total: total, sucursales: por, fecha: fecha };
  }

  // ── Cheques en cartera ─────────────────────────────────────────────────────
  async function cheques() {
    var f = await traer(ARCHIVOS.cheques, 'Cheques');
    var cab = f.shift() || [];
    var iAcr = cab.findIndex(function (c) { return /acredit/i.test(c); });
    var iImp = cab.findIndex(function (c) { return /importe/i.test(c); });
    if (iAcr < 0) iAcr = 2;
    if (iImp < 0) iImp = 5;
    var s = semanaActual(), total = 0, semana = 0, atrasados = 0, nSemana = 0, nAtras = 0;
    f.forEach(function (fila) {
      var imp = monto(fila[iImp]); if (imp == null) return;
      total += imp;
      var d = aFecha(fila[iAcr]); if (!d) return;
      if (d < s.hoy) { atrasados += imp; nAtras++; }
      else if (d <= s.hasta) { semana += imp; nSemana++; }
    });
    return { total: total, semana: semana, cantidadSemana: nSemana, atrasados: atrasados, cantidadAtrasados: nAtras };
  }

  // ── Pagos a proveedores ────────────────────────────────────────────────────
  async function pagos() {
    var f = await traer(ARCHIVOS.pagos, 'Dashboard');
    var aPagar = null, conCheques = null, transferencia = null, fecha = null, semanas = [];
    var mf = /·\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec((f[0] || []).join(' '));
    if (mf) fecha = mf[1];
    f.forEach(function (fila) {
      // Los tres totales están en la segunda fila, en las columnas B, E y H.
      if (aPagar == null && monto(fila[1]) != null && monto(fila[4]) != null && monto(fila[7]) != null) {
        aPagar = monto(fila[1]); conCheques = monto(fila[4]); transferencia = monto(fila[7]);
        return;
      }
      var et = texto(fila[4]);
      var m = /^(\d{1,2}\/\d{1,2})\s*[–-]\s*(\d{1,2}\/\d{1,2})$/.exec(et);
      if (!m) return;
      semanas.push({
        etiqueta: m[1] + ' al ' + m[2], desde: m[1], hasta: m[2],
        facturas: monto(fila[5]), cheques: monto(fila[6]), efectivo: monto(fila[7]),
      });
    });
    // ¿Cuál de esas semanas es la de hoy? Se compara por día y mes.
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var anio = hoy.getFullYear();
    semanas.forEach(function (w) {
      var a = w.desde.split('/'), b = w.hasta.split('/');
      var d1 = new Date(anio, +a[1] - 1, +a[0]), d2 = new Date(anio, +b[1] - 1, +b[0]);
      if (d2 < d1) d2.setFullYear(anio + 1);      // la semana cruza de año
      w.esEstaSemana = hoy >= d1 && hoy <= d2;
    });
    return { aPagar: aPagar, conCheques: conCheques, transferencia: transferencia, semanas: semanas, fecha: fecha };
  }

  // ── Mercadería pedida que no llegó ─────────────────────────────────────────
  async function ordenes() {
    var f = await traer(ARCHIVOS.ordenes, 'Orden Compra Activa');
    var cab = f.shift() || [];
    var iSaldo = cab.findIndex(function (c) { return /saldo/i.test(c); });
    var iProv  = cab.findIndex(function (c) { return /proveedor/i.test(c); });
    if (iSaldo < 0) iSaldo = 10;
    if (iProv < 0) iProv = 2;
    var total = 0, porProv = {};
    f.forEach(function (fila) {
      var s = monto(fila[iSaldo]); if (!s) return;     // 0 o vacío = ya llegó
      total += s;
      var p = texto(fila[iProv]) || '—';
      porProv[p] = (porProv[p] || 0) + s;
    });
    var top = Object.keys(porProv).map(function (p) { return { proveedor: p, saldo: porProv[p] }; })
      .sort(function (a, b) { return b.saldo - a.saldo; }).slice(0, 5);
    return { total: total, top: top };
  }

  // Devuelve { efectivo, cheques, pagos, ordenes }, cada uno con sus datos o
  // { error: '…' } si ese archivo no se pudo leer.
  async function cargar(forzar) {
    if (cache && !forzar) return cache;
    var partes = ['efectivo', 'cheques', 'pagos', 'ordenes'];
    var fns = { efectivo: efectivo, cheques: cheques, pagos: pagos, ordenes: ordenes };
    var res = await Promise.all(partes.map(function (k) {
      return fns[k]().catch(function (e) { return { error: (e && e.message) || 'no se pudo leer' }; });
    }));
    cache = {}; partes.forEach(function (k, i) { cache[k] = res[i]; });
    return cache;
  }

  return { cargar: cargar, _monto: monto, _semanaActual: semanaActual };
})();
