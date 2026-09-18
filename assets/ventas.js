// ─── Ventas desde la planilla de Google ──────────────────────────────────────
// Una sola lectura compartida por todas las pantallas (inicio, reporte semanal,
// ficha del cliente).
//
// Desde el 18/09/2026 se lee el archivo "Avance Ventas" que Administración
// actualiza a diario:
//   https://docs.google.com/spreadsheets/d/1oMIgtZ5KI83_1oyP9TFLKV2fAEpJY_Hc
//
// Ese archivo tiene tres hojas: "Ventas" (el detalle, una fila por artículo
// facturado), "Resumen" y "Monto vendido" (la tabla dinámica de siempre).
// Se lee la hoja de detalle, pero NO entera: son ~10.000 filas / 9 MB y esto lo
// abren los vendedores desde el celular. Google suma del lado del servidor con
// una consulta (gviz) y devuelve solo el total por vendedor y cliente (~190 KB).
// Las notas de crédito ya vienen en negativo en la planilla, así que la suma es
// la venta neta.
//
// Si la consulta falla (cambió el archivo, sin permiso, sin señal), se usa la
// hoja "Monto vendido" como respaldo y, si tampoco se puede, las pantallas
// avisan "no se pudo leer la planilla" en vez de mostrar un número inventado.
window.GBVentas = (function () {
  var ARCHIVO = '1oMIgtZ5KI83_1oyP9TFLKV2fAEpJY_Hc';
  var GVIZ = 'https://docs.google.com/spreadsheets/d/' + ARCHIVO + '/gviz/tq';
  var HOJA_DETALLE = 'Ventas', HOJA_PIVOT = 'Monto vendido';
  // Columnas de la hoja de detalle. Se verifican contra el encabezado que
  // devuelve Google; si el archivo cambia de forma, se buscan por nombre.
  var COL = { vend: 'C', cli: 'E', cliNom: 'F', monto: 'Q' };
  var cache = null;

  function url(hoja, tq) {
    return GVIZ + '?tqx=out:csv&sheet=' + encodeURIComponent(hoja) + '&tq=' + encodeURIComponent(tq);
  }

  // CSV con comillas: un monto puede traer comas adentro.
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
  function aFilas(texto) {
    return String(texto || '').replace(/\r/g, '').split('\n')
      .filter(function (l) { return l.trim() !== ''; }).map(partirLinea);
  }
  var limpiar = function (s) { return String(s == null ? '' : s).trim(); };

  // Los montos llegan de varias formas según de dónde salgan:
  //   1.057645857E7   (Google suma y devuelve el número crudo)
  //   $ 10,576,458.57 (la tabla dinámica, con formato de Excel)
  //   $ 10.576.458,57 (formato argentino)
  function aMonto(s) {
    if (s == null) return null;
    var t = String(s).replace(/[^\d.,eE+-]/g, '');
    if (t === '' || t === '-') return null;
    if (/^[-+]?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$/.test(t)) { var p = parseFloat(t); return isNaN(p) ? null : p; }
    // Con separadores: el último que aparece, si le siguen 1 o 2 dígitos, es el decimal.
    var dec = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
    if (dec > -1 && /^\d{1,2}$/.test(t.slice(dec + 1))) t = t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1);
    else t = t.replace(/[.,]/g, '');
    var n = parseFloat(t);
    return isNaN(n) ? null : n;
  }
  // "00486" → 486 (los códigos vienen con ceros adelante y espacios al final)
  var num = function (s) { var n = parseInt(limpiar(s), 10); return isNaN(n) ? null : n; };

  function traer(u, ms) {
    return new Promise(function (resolve, reject) {
      var listo = false;
      var corte = setTimeout(function () { if (!listo) { listo = true; reject(new Error('tardó demasiado')); } }, ms || 15000);
      fetch(u).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (t) { if (listo) return; listo = true; clearTimeout(corte); resolve(t); })
        .catch(function (e) { if (listo) return; listo = true; clearTimeout(corte); reject(e); });
    });
  }

  // Google devuelve el nombre de cada columna en la primera fila: sirve para
  // confirmar que C/E/F/Q siguen siendo vendedor, cliente y monto.
  function encabezadoOk(f) {
    var t = f.map(function (c) { return limpiar(c).toLowerCase(); });
    return /vendedor/.test(t[0] || '') && /cliente/.test(t[1] || '') && /monto/.test(t[3] || '');
  }

  // Si el archivo cambió de forma, se busca cada columna por su nombre.
  function buscarColumnas() {
    return traer(url(HOJA_DETALLE, 'select * limit 1')).then(function (txt) {
      var f = aFilas(txt)[0] || [];
      var letra = function (i) {
        var s = '';
        for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
        return s;
      };
      var c = {};
      f.forEach(function (t, j) {
        t = limpiar(t).toLowerCase();
        if (/(nro|n°|c[oó]digo)[\s.]*vendedor/.test(t) && !c.vend) c.vend = letra(j);
        else if (/cod.*cliente/.test(t) && !c.cli) c.cli = letra(j);
        else if (t === 'cliente' && !c.cliNom) c.cliNom = letra(j);
        else if (/monto/.test(t) && !c.monto) c.monto = letra(j);
      });
      if (!c.vend || !c.cli || !c.monto) throw new Error('la planilla cambió de columnas');
      if (!c.cliNom) c.cliNom = c.cli;
      return c;
    });
  }

  function consultarDetalle(col) {
    var tq = 'select ' + col.vend + ', ' + col.cli + ', ' + col.cliNom + ', sum(' + col.monto + ')' +
             ' group by ' + col.vend + ', ' + col.cli + ', ' + col.cliNom;
    return traer(url(HOJA_DETALLE, tq)).then(function (txt) {
      var filas = aFilas(txt);
      if (!filas.length) throw new Error('planilla vacía');
      if (!encabezadoOk(filas[0])) throw new Error('columnas distintas');
      return armar(filas.slice(1), 0, 1, 2, 3);
    });
  }

  // Respaldo: la tabla dinámica "Monto vendido". El código del vendedor aparece
  // solo en su primera fila (las de abajo quedan en blanco), así que se arrastra;
  // las filas "Total 00486" son subtotales y no se suman.
  function consultarPivot() {
    return traer(url(HOJA_PIVOT, 'select *')).then(function (txt) {
      var filas = aFilas(txt), cab = null;
      for (var i = 0; i < filas.length && !cab; i++) {
        var t = filas[i].map(function (c) { return limpiar(c).toLowerCase(); });
        var c = {};
        t.forEach(function (x, j) {
          if (/(nro|n°|c[oó]digo)[\s.]*vendedor/.test(x) && c.vend == null) c.vend = j;
          else if (/cod.*cliente/.test(x) && c.cli == null) c.cli = j;
          else if (x === 'cliente' && c.cliNom == null) c.cliNom = j;
          else if (/monto/.test(x) && c.monto == null) c.monto = j;
        });
        if (c.vend != null && c.cli != null && c.monto != null) { cab = c; filas = filas.slice(i + 1); }
      }
      if (!cab) throw new Error('no se entiende la tabla');
      return armar(filas, cab.vend, cab.cli, cab.cliNom != null ? cab.cliNom : cab.cli, cab.monto);
    });
  }

  function armar(filas, iVend, iCli, iCliNom, iMonto) {
    var porVendedor = {}, porCliente = {}, ultimoVend = null, hubo = false;
    filas.forEach(function (f) {
      var v = num(f[iVend]); if (v != null) ultimoVend = v; else v = ultimoVend;
      var c = num(f[iCli]), m = aMonto(f[iMonto]);
      if (v == null || c == null || m == null) return;               // filas vacías
      if (/total/i.test(limpiar(f[iCli]))) return;                   // subtotales de la dinámica
      hubo = true;
      var nom = limpiar(f[iCliNom]) || String(c);
      var lista = porCliente[v] = porCliente[v] || [];
      var ya = null;
      for (var k = 0; k < lista.length; k++) if (lista[k].codigo === c) { ya = lista[k]; break; }
      if (ya) ya.monto += m; else lista.push({ codigo: c, nombre: nom, monto: m });
      porVendedor[v] = (porVendedor[v] || 0) + m;
    });
    if (!hubo) throw new Error('sin filas de ventas');
    Object.keys(porCliente).forEach(function (v) { porCliente[v].sort(function (a, b) { return b.monto - a.monto; }); });
    return { porVendedor: porVendedor, porCliente: porCliente };
  }

  // La respuesta se guarda para no leer la planilla una vez por pantalla. Si falla,
  // NO se guarda el error: el próximo intento vuelve a pedirla.
  function cargar() {
    if (cache) return cache;
    var intento = consultarDetalle(COL)
      .catch(function () { return buscarColumnas().then(consultarDetalle); })
      .catch(function () { return consultarPivot(); })
      .catch(function () { cache = null; return { porVendedor: {}, porCliente: {}, error: true }; });
    cache = intento;
    return intento;
  }

  return {
    cargar: cargar,
    // ¿Se pudo leer la planilla? Sirve para distinguir "no figurás" de "no la pude leer".
    seLeyo: function () { return cargar().then(function (d) { return !d.error && Object.keys(d.porVendedor).length > 0; }); },
    // Total vendido por un vendedor (por su código). null si no figura.
    totalDe: function (codigoVendedor) {
      var c = num(codigoVendedor);
      return cargar().then(function (d) { return c == null ? null : (d.porVendedor[c] != null ? d.porVendedor[c] : null); });
    },
    // Detalle por cliente de ese vendedor, de mayor a menor.
    clientesDe: function (codigoVendedor) {
      var c = num(codigoVendedor);
      return cargar().then(function (d) { return (c != null && d.porCliente[c]) ? d.porCliente[c] : []; });
    },
    // Lo vendido a UN cliente (por su código de cliente), sin importar el vendedor.
    deCliente: function (codigoCliente) {
      var c = num(codigoCliente);
      return cargar().then(function (d) {
        if (c == null) return null;
        var total = null;
        Object.keys(d.porCliente).forEach(function (v) {
          d.porCliente[v].forEach(function (x) { if (x.codigo === c) total = (total || 0) + x.monto; });
        });
        return total;
      });
    },
    formato: function (n) { return n == null ? '—' : '$ ' + Math.round(n).toLocaleString('es-AR'); },
  };
})();
