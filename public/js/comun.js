// menú para celular
(function () {
  const cabecera = document.getElementById('cabecera');
  const boton = document.getElementById('menu-boton');
  if (!cabecera || !boton) return;

  function alternarMenu(abierto) {
    cabecera.classList.toggle('menu-abierto', abierto);
    boton.setAttribute('aria-expanded', String(abierto));
    boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  }

  boton.addEventListener('click', () => {
    alternarMenu(!cabecera.classList.contains('menu-abierto'));
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') alternarMenu(false);
  });
})();

// los elementos aparecen con una animación al hacer scroll
(function () {
  if (!document.documentElement.classList.contains('js')) return;

  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CON_FADE = '.seccion-titulo, .tarjeta, .regla, .paso, .bloque-oscuro, .recuadro, .persona, ' +
    '.logo-explicado > *, .dos-columnas > *, .formulario-tarjeta, .info-lateral > *, ' +
    '.franja .contenedor, .area-cabecera, .lista-nodos li, .lista-motivos li, .pregunta';
  const SOLO_MARCA = '.pasos';

  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      entrada.target.classList.add('visible');
      observador.unobserve(entrada.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  window.revelar = function (raiz = document) {
    raiz.querySelectorAll(CON_FADE).forEach((elemento) => {
      if (elemento.classList.contains('reveal')) return;
      elemento.classList.add('reveal');

      const hermanos = [...elemento.parentElement.children].filter((h) => h.matches(CON_FADE));
      elemento.style.setProperty('--retraso', `${Math.min(hermanos.indexOf(elemento), 5) * 70}ms`);

      if (sinMovimiento) elemento.classList.add('visible');
      else observador.observe(elemento);
    });

    raiz.querySelectorAll(SOLO_MARCA).forEach((elemento) => {
      if (sinMovimiento) elemento.classList.add('visible');
      else observador.observe(elemento);
    });
  };

  window.revelar();
})();

// la portada solo se anima mientras se ve en pantalla
(function () {
  const portada = document.querySelector('.hero');
  if (!portada || !('IntersectionObserver' in window)) return;

  new IntersectionObserver((entradas) => {
    const ultima = entradas[entradas.length - 1];
    portada.classList.toggle('pausada', !ultima.isIntersecting);
  }).observe(portada);
})();

if (matchMedia('(hover: hover)').matches) {
  document.addEventListener('pointermove', (evento) => {
    const tarjeta = evento.target.closest?.('.tarjeta');
    if (!tarjeta) return;
    const caja = tarjeta.getBoundingClientRect();
    tarjeta.style.setProperty('--mx', `${evento.clientX - caja.left}px`);
    tarjeta.style.setProperty('--my', `${evento.clientY - caja.top}px`);
  }, { passive: true });
}
