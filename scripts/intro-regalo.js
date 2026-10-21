'use strict';

/**
 * Intro de "caja de regalo" para la wiki de Entheos.
 *
 * Muestra una caja de regalo cerrada sobre el sitio; al hacer clic (o sola
 * tras unos segundos) la tapa salta, sale confeti y se revela la wiki.
 *
 * Sin dependencias: el confeti se dibuja en un <canvas> propio.
 */

(function () {
  const capa = document.getElementById('intro-regalo');
  if (!capa) return;

  const caja = document.getElementById('intro-caja');
  const boton = document.getElementById('intro-boton');
  const lona = document.getElementById('intro-confeti');
  const contexto = lona.getContext('2d');

  const ROJO = ['#d4af37', '#f0d97a', '#8a1c1c', '#c0392b', '#f5f0e6', '#b8860b'];
  let abierto = false;
  let particulas = [];
  let animacion = null;
  let temporizador = null;

  function ajustarLona() {
    const escala = window.devicePixelRatio || 1;
    lona.width = window.innerWidth * escala;
    lona.height = window.innerHeight * escala;
    lona.style.width = window.innerWidth + 'px';
    lona.style.height = window.innerHeight + 'px';
    contexto.setTransform(escala, 0, 0, escala, 0, 0);
  }

  function crearParticula(desdeSombra) {
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    const color = ROJO[Math.floor(Math.random() * ROJO.length)];
    const esCinta = Math.random() < 0.35;

    return {
      x: desdeSombra ? ancho / 2 + (Math.random() - 0.5) * 140 : Math.random() * ancho,
      y: desdeSombra ? alto * 0.45 + (Math.random() - 0.5) * 60 : -20 - Math.random() * alto * 0.4,
      vx: (Math.random() - 0.5) * (desdeSombra ? 9 : 3),
      vy: desdeSombra ? -6 - Math.random() * 7 : 2 + Math.random() * 3,
      ancho: 5 + Math.random() * 7,
      alto: esCinta ? 4 + Math.random() * 5 : 8 + Math.random() * 10,
      color,
      giro: Math.random() * Math.PI * 2,
      velGiro: (Math.random() - 0.5) * 0.3,
      cinta: esCinta,
      vida: 1,
      caida: 0.06 + Math.random() * 0.06,
    };
  }

  function dibujar() {
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    contexto.clearRect(0, 0, ancho, alto);

    for (const p of particulas) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.caida;
      p.vx *= 0.995;
      p.giro += p.velGiro;
      if (p.y > alto + 40) p.vida = 0;

      if (p.vida <= 0) continue;

      contexto.save();
      contexto.translate(p.x, p.y);
      contexto.rotate(p.giro);
      contexto.fillStyle = p.color;
      if (p.cinta) {
        contexto.fillRect(-p.ancho / 2, -p.alto / 4, p.ancho, p.alto / 2);
      } else {
        contexto.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto);
      }
      contexto.restore();
    }

    particulas = particulas.filter((p) => p.vida > 0);

    if (particulas.length > 0) {
      animacion = requestAnimationFrame(dibujar);
    } else {
      contexto.clearRect(0, 0, ancho, alto);
      animacion = null;
    }
  }

  function lanzarConfeti() {
    ajustarLona();
    for (let i = 0; i < 220; i += 1) {
      particulas.push(crearParticula(true));
    }
    if (!animacion) animacion = requestAnimationFrame(dibujar);
  }

  function abrir() {
    if (abierto) return;
    abierto = true;

    clearTimeout(temporizador);
    capa.classList.add('abierta');
    caja.classList.add('explotada');
    lanzarConfeti();

    // Después de la explosión, la intro se desvanece y libera el sitio.
    setTimeout(() => {
      capa.classList.add('fuera');
      setTimeout(() => {
        capa.setAttribute('hidden', '');
        document.body.classList.remove('con-intro');
      }, 700);
    }, 1100);
  }

  boton.addEventListener('click', abrir);
  caja.addEventListener('click', abrir);
  capa.addEventListener('click', abrir);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') abrir();
  });

  window.addEventListener('resize', () => {
    if (abierto && animacion) ajustarLona();
  });

  // Si el visitante no hace nada, la caja se abre sola a los 6 segundos.
  temporizador = setTimeout(abrir, 6000);
})();
