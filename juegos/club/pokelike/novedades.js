/* Pokelike — ventana de novedades: aviso de versión de prueba, registro de
   cambios y lo que viene. Se abre sola al entrar si este navegador no ha
   visto la entrada más nueva de NOVEDADES (versión + fecha), y siempre con
   📰 en la barra.

   REGLA: todo cambio al juego se anota aquí, en lenguaje de jugador.
   - Mientras la versión siga abierta (hoy, v0.1), lo nuevo se agrega a la
     lista `cambios` de su entrada (la primera), se pone `fecha` al día del
     cambio (AAAA-MM-DD) y, si no está, se suma a `autores` el usuario de
     GitHub de quien hizo el cambio (`git config user.name` o el autor del
     commit, nunca «Claude»).
   - Una entrada nueva (v0.2, …) va AL PRINCIPIO solo cuando el dueño del
     juego cierra la versión.
   - Si lo nuevo estaba en PROXIMAMENTE, se saca de ahí. */
(() => {
  'use strict';

  const NOVEDADES = [
    {
      version: 'v0.1', fecha: '2026-10-12', autores: ['Guerra-09'],
      cambios: [
        'Roguelike de Kanto: elige a Bulbasaur, Charmander o Squirtle y recorre un mapa distinto en cada partida, con los 8 gimnasios y la Liga Pokémon.',
        'Combate 1 contra 1 automático o manual (teclas 1–4), con velocidad ×1/×2/×4. Experiencia, niveles, evoluciones y un equipo de hasta 6 que se ordena arrastrando desde las rayitas.',
        'Los 151 Pokémon de Kanto con la tabla de tipos moderna; los rivales salen evolucionados según su nivel. La partida se guarda sola.',
        'Tu entrenador: chico o chica (Rojo u Hoja, estilo Rojo Fuego / Verde Hoja). Con sesión iniciada te llama por tu apodo de Juegos. El Profesor Oak te recibe con consejos.',
        'Al empezar un combate tu entrenador lanza la pokébola; si cae un Pokémon, el siguiente sale de la suya.',
        'Mapa con íconos propios (pokébola, hierba, entrenador, la medalla de cada líder y la cara del Alto Mando). Se desplaza dentro de su recuadro y se centra solo en los caminos que puedes elegir.',
        'Capturas con tu equipo a la vista: con el equipo lleno, eliges el nuevo y tocas a quién reemplaza. Cada Pokémon dice si es nuevo para tu Pokédex.',
        'En combate ves tu equipo al lado (quién pelea, quién sale después, PS y caídos) y las pokébolas del rival con cuántos le quedan.',
        'El ojo 👁 muestra el equipo de líderes, Alto Mando y Campeón, en orden y con sus debilidades.',
        'Líderes, Alto Mando y Campeón hablan antes de pelear (toca para saltar). Cada medalla entra con brillo a tu estuche, y vencer a cada miembro del Alto Mando tiene su mensaje.',
        'Liga difícil: la Calle Victoria no tiene hierba ni Centros Pokémon, y el Alto Mando y el Campeón llevan 6 Pokémon cada uno, con más nivel. Antes de Lorelei tu equipo descansa y se cura entero.',
        'Al ganar la Liga, desfile del Salón de la Fama con tu equipo, tu entrenador y tu nombre. El Salón de la Fama guarda tus equipos campeones, tu puntaje y cuántos tienes en la Pokédex.',
        'Ruta Infinita después de la Liga: entrenadores y capturas sin final. Los rivales parten en Nv 75 y suben 4 niveles cada 3 victorias. Las capturas sirven para la Pokédex, pero salen 15 niveles más bajas.',
        'Puntaje: 100 por medalla, 150 por cada miembro del Alto Mando, 500 por el Campeón, y la Ruta Infinita suma más mientras más lejos llegues.',
        'Pokédex que dura entre partidas, en este navegador y, con sesión iniciada, en tu cuenta.',
        'Botón «Empezar de nuevo» con el mismo inicial, y esta ventana de novedades (📰).',
        'Modo prueba 🐞 para desarrollar, solo en local (en la página publicada no aparece): inmortal, empezar en cualquier gimnasio y atajos.',
      ],
    },
  ];

  const PROXIMAMENTE = [
    'Objetos: Poción, Superpoción, Caramelo raro y objetos equipables.',
    'Música.',
    'Entrada en el Club: monedas, logros y clasificación con el equipo campeón de cada jugador.',
    'Nodos nuevos en el mapa: eventos «?», tutor de movimientos, intercambio y legendarios.',
    'Piedras evolutivas y combates contra el Rival en puntos fijos.',
    'Modos: Nuzlocke y partida diaria con el mismo mapa para todos.',
    'Escenarios y ambiente: fondos y sonido distintos según la zona.',
    'Segunda región: al terminar la Liga, seguir con tu partida en Johto o empezar de nuevo.',
  ];

  const ISSUES = 'https://github.com/cstappung/Paginita-Pro/issues';
  const K_VISTO = 'pokelike.novedades';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const firma = n => `${n.fecha}|${n.version}`;

  $('novAviso').innerHTML = `
    <p><b>Pokelike está en desarrollo.</b> Está inspirado en el juego original
    <a href="https://pokelike.xyz/" target="_blank" rel="noopener">Pokelike</a> y lo intenta imitar,
    aunque es una versión un poco distinta que todavía se está puliendo.</p>
    <p>La idea de esta etapa es que se pruebe: el equilibrio del juego probablemente cambie,
    según si resulta muy fácil o muy difícil. Se aceptan sugerencias: puedes dejar un
    <a href="${ISSUES}" target="_blank" rel="noopener">issue en GitHub</a> contando mejoras o errores
    que encuentres. Y si quieres arreglar algo tú, también puedes hacerlo sin problema
    (anotándolo en la pestaña Cambios).</p>
    <p>Por ahora es una versión experimental. Con las próximas versiones probablemente cambie
    todo el equilibrio, y quizás, al terminar la Liga Pokémon, puedas seguir a la segunda región
    con tu partida o empezar de nuevo.</p>
    <p class="chico">Tu partida se guarda en este navegador y puede reiniciarse entre versiones.</p>`;

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

  function abre(tab) {
    eligePestana(tab || pestanas[0]);
    $('novedades').hidden = false;
    $('novCerrar').focus({ preventScroll: true });
  }
  function cierra() {
    $('novedades').hidden = true;
    try { localStorage.setItem(K_VISTO, firma(NOVEDADES[0])); } catch (_) { /* sin almacenamiento */ }
  }

  $('btnNovedades').onclick = () => abre();
  $('novCerrar').onclick = cierra;
  $('novedades').onclick = ev => { if (ev.target === $('novedades')) cierra(); };
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('novedades').hidden) cierra(); });

  let visto = null;
  try { visto = localStorage.getItem(K_VISTO); } catch (_) { /* sin almacenamiento */ }
  if (visto !== firma(NOVEDADES[0])) abre();
})();
