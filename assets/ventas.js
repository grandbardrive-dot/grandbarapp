// ─── Ventas del mes, desde CUBO ──────────────────────────────────────────────
// Una sola lectura compartida por todas las pantallas (Inicio, reporte semanal,
// Mis clientes y la ficha del cliente).
//
// 17/11/2026: antes se leía la planilla "Avance Ventas" de Drive. Administración la
// dejó de actualizar el 27/10 (quedó con octubre y en la papelera), así que el Inicio
// mostraba lo de octubre como "ventas acumuladas" del mes. Ahora sale de la función
// ventas-vendedor: lo facturado en CUBO en el mes en curso (se baja cada 20 minutos),
// productos con IVA, impuesto interno y percepciones, la misma cuenta que la "Venta
// total con impuestos" de Dirección. El vendedor recibe solo lo suyo; supervisores,
// Dirección y Desarrollo, todos los vendedores.
//
// La forma no cambió: totalDe(codVendedor), clientesDe(codVendedor),
// deCliente(codCliente), seLeyo() y formato(). Si no se puede leer, las pantallas
// avisan en vez de mostrar un número inventado.
window.GBVentas = (function () {
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  var cache = null, _cli = null;
  // "027" → 27, "00486" → 486 (las pantallas pasan los códigos de cualquiera de las dos formas)
  var num = function (s) { var n = parseInt(String(s == null ? '' : s).trim(), 10); return isNaN(n) ? null : n; };

  function token() {
    if (!window.supabase) return Promise.reject(new Error('sin supabase'));
    _cli = _cli || window.supabase.createClient(HUB.url, HUB.key);
    return _cli.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s) throw new Error('sin sesión');
      return s.access_token;
    });
  }

  function armar(filas) {
    var porVendedor = {}, porCliente = {};
    (filas || []).forEach(function (f) {
      var v = num(f[0]), c = num(f[1]), m = Number(f[3]);
      if (v == null || c == null || !isFinite(m)) return;
      var lista = porCliente[v] = porCliente[v] || [];
      lista.push({ codigo: c, nombre: f[2] || String(f[1]), monto: m, neto: Number(f[4]) || 0 });
      porVendedor[v] = (porVendedor[v] || 0) + m;
    });
    Object.keys(porCliente).forEach(function (v) { porCliente[v].sort(function (a, b) { return b.monto - a.monto; }); });
    return { porVendedor: porVendedor, porCliente: porCliente };
  }

  // La respuesta se guarda para no pedirla una vez por pantalla. Si falla, NO se guarda
  // el error: el próximo intento la vuelve a pedir.
  function cargar() {
    if (cache) return cache;
    var intento = token()
      .then(function (t) { return fetch('/.netlify/functions/ventas-vendedor', { headers: { Authorization: 'Bearer ' + t } }); })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (d) { var a = armar(d.filas); a.desde = d.desde; a.hasta = d.hasta; return a; })
      .catch(function () { cache = null; return { porVendedor: {}, porCliente: {}, error: true }; });
    cache = intento;
    return intento;
  }

  return {
    cargar: cargar,
    // ¿Se pudieron leer las ventas? Sirve para distinguir "sin ventas este mes" de "no se pudo leer".
    seLeyo: function () { return cargar().then(function (d) { return !d.error; }); },
    // Total vendido en el mes por un vendedor (por su código). null si no tiene ventas.
    totalDe: function (codigoVendedor) {
      var c = num(codigoVendedor);
      return cargar().then(function (d) { return c == null ? null : (d.porVendedor[c] != null ? d.porVendedor[c] : null); });
    },
    // Detalle por cliente de ese vendedor, de mayor a menor.
    clientesDe: function (codigoVendedor) {
      var c = num(codigoVendedor);
      return cargar().then(function (d) { return (c != null && d.porCliente[c]) ? d.porCliente[c] : []; });
    },
    // Lo vendido en el mes a UN cliente (por su código de cliente), de los vendedores que se ven.
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
