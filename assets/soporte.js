/* ===========================================================
   GrandBar — Soporte por WhatsApp
   -----------------------------------------------------------
   El recuadro "Soporte · Estamos para ayudarte" de la barra era
   decorativo: se tocaba y no pasaba nada. Este archivo lo hace
   funcionar en todas las pantallas que lo tengan, sin que cada
   una repita el número ni el mensaje.

   Uso: incluir <script src="assets/soporte.js"></script>.
   Busca los recuadros .sb-support y les pone el click.
   =========================================================== */
(function () {
  const WA_SOPORTE = '5492612452651';

  // El mensaje dice desde qué pantalla se pidió ayuda: así no hay que
  // preguntar "¿dónde estabas?" para poder ayudar.
  function mensaje() {
    let quien = '';
    try {
      const n = (document.getElementById('uName') || {}).textContent || '';
      if (n && !/equipo grandbar/i.test(n)) quien = 'Soy ' + n.trim() + '. ';
    } catch (e) {}
    const pantalla = (location.pathname.split('/').pop() || 'inicio').replace('.html', '') || 'inicio';
    return 'Hola, necesito ayuda con el Portal GrandBar.\n' + quien + 'Estoy en: ' + pantalla + '.';
  }

  function abrir() {
    window.open('https://wa.me/' + WA_SOPORTE + '?text=' + encodeURIComponent(mensaje()), '_blank');
  }
  window.abrirSoporteWA = abrir;

  function activar() {
    document.querySelectorAll('.sb-support').forEach(el => {
      if (el.dataset.wa) return;               // ya activado
      el.dataset.wa = '1';
      el.style.cursor = 'pointer';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('title', 'Escribinos por WhatsApp');
      const s = el.querySelector('.s');
      if (s) s.textContent = 'Escribinos por WhatsApp';
      el.addEventListener('click', abrir);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activar);
  else activar();
})();
