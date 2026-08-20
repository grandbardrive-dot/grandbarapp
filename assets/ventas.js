// ─── Ventas desde la planilla de Google ──────────────────────────────────────
// Una sola lectura del CSV publicado, compartida por todas las pantallas.
//
// La planilla es una tabla dinámica y su formato cambió (antes: total por vendedor;
// ahora: además el detalle por cliente). Para que un cambio de columnas no vuelva a
// romper nada, las columnas se buscan POR NOMBRE en la fila de encabezado, y se
// soportan los dos formatos:
//
//   viejo:  CODIGO VENDEDOR | VENDEDOR | MONTO VENDIDO
//   nuevo:  Nro. Vendedor | Vendedor | Cod. Cliente | Cliente | Suma de Monto
//
// En el formato nuevo cada cliente aparece dos veces (la fila de subtotal del código,
// sin nombre, y la fila con el nombre): se toma la que tiene nombre.
window.GBVentas = (function () {
  var CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4uT-97Qq1m5Tr-RZR6TVtHaFFjChInCu42dwEiTla9rnb8h6qvyFkQlK-zcWsbKdesszy4KrncWBG/pub?output=csv';
  var cache = null;

  // CSV con comillas: "$ 1.234,56" puede tener comas adentro.
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

  // "$ 1.234.567,89" → 1234567.89
  function aMonto(s) {
    if (s == null) return null;
    var t = String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(t);
    return isNaN(n) ? null : n;
  }

  var num = s => { var n = parseInt(String(s || '').trim(), 10); return isNaN(n) ? null : n; };

  function analizar(texto) {
    var filas = texto.trim().split('\n').map(function (l) { return partirLinea(l.replace(/\r$/, '')); });
    var col = null, desde = 0;

    for (var i = 0; i < filas.length && !col; i++) {
      var f = filas[i].map(function (c) { return String(c || '').trim().toLowerCase(); });
      var c = {};
      f.forEach(function (t, j) {
        if (/(nro|n°|codigo|código)[\s.]*vendedor/.test(t)) c.vend = j;
        else if (t === 'vendedor') c.vendNom = j;
        else if (/cod.*cliente/.test(t)) c.cli = j;
        else if (t === 'cliente') c.cliNom = j;
        else if (/monto/.test(t)) c.monto = j;
      });
      if (c.vend != null && c.monto != null) { col = c; desde = i + 1; }
    }
    if (!col) return { porVendedor: {}, porCliente: {}, total: null };

    var porVendedor = {}, porCliente = {};
    for (var k = desde; k < filas.length; k++) {
      var f2 = filas[k];
      var codV = num(f2[col.vend]);
      var monto = aMonto(f2[col.monto]);
      if (codV == null || monto == null) continue;                 // "Total general" y filas vacías
      var codC = col.cli != null ? num(f2[col.cli]) : null;
      var nomC = col.cliNom != null ? String(f2[col.cliNom] || '').trim() : '';

      if (codC == null) {
        // Fila de total del vendedor (puede venir dos veces: con y sin nombre).
        if (porVendedor[codV] == null) porVendedor[codV] = monto;
      } else if (nomC) {
        // Fila del cliente (la que trae el nombre; la otra es el subtotal del código).
        (porCliente[codV] = porCliente[codV] || []).push({ codigo: codC, nombre: nomC, monto: monto });
      }
    }
    // Si la planilla no trae total por vendedor, se suma el detalle.
    Object.keys(porCliente).forEach(function (v) {
      if (porVendedor[v] == null) porVendedor[v] = porCliente[v].reduce(function (a, c) { return a + c.monto; }, 0);
      porCliente[v].sort(function (a, b) { return b.monto - a.monto; });
    });
    return { porVendedor: porVendedor, porCliente: porCliente };
  }

  // La respuesta se guarda para no leer la planilla una vez por pantalla. Si la lectura
  // falla o se queda colgada (celular con mala señal, pestaña en segundo plano), NO se
  // guarda el error: el próximo intento vuelve a pedirla en vez de quedar en "Cargando…".
  function cargar() {
    if (cache) return cache;
    var intento = new Promise(function (resolve) {
      var listo = false;
      var corte = setTimeout(function () { if (!listo) { listo = true; cache = null; resolve({ porVendedor: {}, porCliente: {}, error: true }); } }, 12000);
      fetch(CSV).then(function (r) { return r.text(); }).then(function (t) {
        if (listo) return;
        listo = true; clearTimeout(corte);
        try { resolve(analizar(t)); }
        catch (e) { cache = null; resolve({ porVendedor: {}, porCliente: {}, error: true }); }
      }).catch(function () {
        if (listo) return;
        listo = true; clearTimeout(corte); cache = null;
        resolve({ porVendedor: {}, porCliente: {}, error: true });
      });
    });
    cache = intento;
    return intento;
  }

  return {
    cargar: cargar,
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
