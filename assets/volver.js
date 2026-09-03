/* ===========================================================
   GrandBar — la flecha de "volver" vuelve a donde entraste
   -----------------------------------------------------------
   Varias pantallas tenían la flecha clavada a inicio.html, que
   es el tablero DEL VENDEDOR. Así, Luciana entraba a Mis
   reportes desde el Hub, tocaba volver, y aterrizaba en un
   panel de vendedora que no es el suyo.

   Ahora: si venís de otra pantalla del Portal, vuelve ahí. Si
   entraste directo (un favorito, un link), va al Hub, que le
   muestra a cada uno sus propias herramientas.

   Uso: incluir <script src="assets/volver.js"></script>.
   =========================================================== */
(function () {
  function mismoSitio(url) {
    try { return new URL(url).origin === location.origin; } catch (e) { return false; }
  }

  function activar() {
    document.querySelectorAll('a.back').forEach(a => {
      if (a.dataset.volver) return;
      a.dataset.volver = '1';
      // El destino de respaldo: el Hub, no el tablero del vendedor.
      const fallback = 'hub.html';
      a.addEventListener('click', e => {
        if (mismoSitio(document.referrer) && history.length > 1) {
          e.preventDefault();
          history.back();
          return;
        }
        // Sin historial propio: al Hub.
        e.preventDefault();
        location.href = fallback;
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activar);
  else activar();
})();
