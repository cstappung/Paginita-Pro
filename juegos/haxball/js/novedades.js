/* HaxBall — ventana de novedades: registro de cambios y lo que viene. En la
   práctica se abre sola si este navegador no ha visto la entrada más nueva
   de NOVEDADES (versión + fecha); en línea solo con 📰 del menú, para no
   tapar una partida que ya empezó.

   REGLA: todo cambio al juego se anota aquí, en lenguaje de jugador.
   - Mientras la versión siga abierta (hoy, v0.2), lo nuevo se agrega a la
     lista `cambios` de su entrada (la primera), se pone `fecha` al día del
     cambio (AAAA-MM-DD) y, si no está, se suma a `autores` el usuario de
     GitHub de quien hizo el cambio (nunca «Claude»).
   - Una entrada nueva (v0.3, …) va AL PRINCIPIO solo cuando el dueño del
     juego cierra la versión.
   - Si lo nuevo estaba en PROXIMAMENTE, se saca de ahí. */
(() => {
  'use strict';

  const NOVEDADES = [
    {
      version: 'v0.2', fecha: '2026-10-13', autores: ['Guerra-09'],
      cambios: [
        'Salas desde 2 jugadores: quien abre la sala empieza el partido cuando quiera, con al menos uno por equipo.',
        'Vestíbulo de equipos: al entrar a la sala eliges Rojo, Azul o quedarte sin equipo para mirar. Quien abrió la sala mueve a la gente, reparte con Auto o Al azar y le pone nombre a cada equipo; el nombre sale en el marcador.',
        'Dos en un teclado: en la práctica pueden jugar dos personas en el mismo computador, uno contra otro o juntos contra los bots.',
        'Arreglado: en la práctica los goles no contaban y la pelota se quedaba en la red. Ahora suman, se celebran y saca el equipo que recibió el gol; el que anotó no toca la pelota hasta que el rival la mueva.',
        'Más fricción: el disco frena antes al soltar la tecla, con la misma velocidad máxima.',
        'Cancha Futsal: piso gris, arcos más angostos y una pelota más chica y liviana que sale más rápido. Se elige en la práctica y al abrir la sala.',
        'Nombre y dorsal: tu nombre va bajo tu disco y el dorsal (un número, un emoji o dos letras) dentro. En línea los ven todos.',
        'Sprint: con Shift corres más rápido (×1,4) mientras dure la barra de energía bajo tu nombre. Cada vez que paras de correr hay 1,5 s de espera antes de que recargue; si la vacías, además hay que soltar Shift. Es opcional: se activa o desactiva en el menú de la práctica y al abrir la sala.',
        'Teclas a tu gusto (⌨ en el menú), para J1 y para J2. El mando también tiene sprint (B, LB o LT).',
        'Tiempo límite de 3, 5 o 10 minutos (o sin límite): al acabarse gana el que va arriba y, si van empatados, se juega gol de oro. El reloj se ve en el marcador y solo corre con la pelota en juego.',
        'Líder de la sala (👑): configura goles, tiempo, cancha y sprint desde el vestíbulo, le puede pasar el mando a otro y, con ✎ Ficha, cortar el partido para volver al vestíbulo. Si el líder abandona, manda el segundo que entró.',
        'Cancha Futsal grande: más espacio para correr, y la cámara te sigue sin achicar las fichas; se queda quieta al llegar a los bordes.',
        'En el celular: joystick a la izquierda y botones a la derecha, transparentes sobre la cancha: patear (el grande) y sprint.',
        'Esta ventana de novedades (📰).',
      ],
    },
    {
      version: 'v0.1', fecha: '2026-10-13', autores: ['Jlpezuc'],
      cambios: [
        'Fútbol de discos rojo contra azul en salas de 2 a 8 jugadores, con los equipos según el orden de los asientos.',
        'Meta de 3, 5 o 7 goles; si un equipo se queda sin nadie, gana el otro.',
        'Saque desde el centro: cada uno en su mitad y solo el equipo que saca puede entrar al círculo.',
        'Práctica contra bots de 1 contra 1 a 3 contra 3, en tres niveles.',
        'Controles con teclado, pantalla táctil y mando.',
        'Logros, monedas, marco de campeón, portada en el salón y reglas con ilustraciones.',
      ],
    },
  ];

  const PROXIMAMENTE = [
    'Más canchas: una con hielo.',
    'Estadísticas del partido: goles, asistencias y tiros por jugador.',
    'Chat rápido con frases y emojis durante el partido.',
  ];

  const K_VISTO = 'haxball.novedades';
  const ONLINE = new URLSearchParams(location.search).get('modo') === 'online' && parent !== window;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const firma = n => `${n.fecha}|${n.version}`;

  $('novCambios').innerHTML = NOVEDADES.map(n => `
    <article class="nov-entrada">
      <header><b>${esc(n.version)}</b> <time datetime="${esc(n.fecha)}">${esc(n.fecha)}</time>
        <span class="nov-autor" translate="no">${n.autores.map(a => '@' + esc(a)).join(' · ')}</span></header>
      <ul>${n.cambios.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    </article>`).join('');
  $('novProximo').innerHTML = `<ul>${PROXIMAMENTE.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;

  const pestanas = [...document.querySelectorAll('#novedades [role="tab"]')];
  function eligePestana(tab) {
    for (const t of pestanas) {
      const activa = t === tab;
      t.setAttribute('aria-selected', String(activa));
      t.tabIndex = activa ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !activa;
    }
  }
  pestanas.forEach((t, i) => {
    t.onclick = () => eligePestana(t);
    t.onkeydown = ev => {
      const paso = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!paso) return;
      const sig = pestanas[(i + paso + pestanas.length) % pestanas.length];
      eligePestana(sig); sig.focus();
    };
  });

  function abre() {
    eligePestana(pestanas[0]);
    $('novedades').hidden = false;
    $('novCerrar').focus({ preventScroll: true });
  }
  function cierra() {
    $('novedades').hidden = true;
    try { localStorage.setItem(K_VISTO, firma(NOVEDADES[0])); } catch (_) { /* sin almacenamiento */ }
  }

  $('btnNovedades').onclick = abre;
  $('novCerrar').onclick = cierra;
  $('novedades').onclick = ev => { if (ev.target === $('novedades')) cierra(); };
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('novedades').hidden) cierra(); });

  let visto = null;
  try { visto = localStorage.getItem(K_VISTO); } catch (_) { /* sin almacenamiento */ }
  if (!ONLINE && visto !== firma(NOVEDADES[0])) abre();
})();
