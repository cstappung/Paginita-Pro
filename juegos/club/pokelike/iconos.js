/* Pokelike — íconos del mapa en SVG (viewBox 0 0 100 100), dibujados a mano.
   `cuerpo(tipo)` es el contenido para meter dentro de otro <svg> (el mapa
   los anida); `svg(tipo)` es un <svg> suelto para la leyenda y los botones. */
(() => {
  'use strict';

  const TRAZO = 'fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';

  const CUERPOS = {
    captura: `<circle cx="50" cy="50" r="44" fill="#f5f5f5"/>
      <path d="M6 50 A44 44 0 0 1 94 50 Z" fill="#e3350d"/>
      <path d="M22 26 Q34 14 50 13" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="6" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="44" fill="none" stroke="#1d1d1d" stroke-width="6"/>
      <path d="M6 50 H36 M64 50 H94" stroke="#1d1d1d" stroke-width="7"/>
      <circle cx="50" cy="50" r="13" fill="#f5f5f5" stroke="#1d1d1d" stroke-width="6"/>
      <circle cx="50" cy="50" r="5" fill="none" stroke="#b9b9b9" stroke-width="3"/>`,
    salvaje: `<path d="M8 88 H92" stroke="#2b5d22" stroke-width="6" stroke-linecap="round"/>
      <path d="M14 88 C14 64 18 46 26 30 C26 50 28 70 32 88 Z" fill="#3f8f35"/>
      <path d="M26 88 C28 60 34 40 46 18 C42 44 42 66 46 88 Z" fill="#5fb84c"/>
      <path d="M42 88 C46 66 52 50 62 36 C58 56 58 72 60 88 Z" fill="#3f8f35"/>
      <path d="M54 88 C58 58 66 38 80 22 C74 46 72 68 74 88 Z" fill="#7ccf5e"/>
      <path d="M70 88 C74 70 80 58 90 50 C86 64 86 76 88 88 Z" fill="#4ea03f"/>
      <path d="M46 18 C42 44 42 66 46 88 M80 22 C74 46 72 68 74 88" fill="none" stroke="#2b5d22" stroke-width="2" stroke-opacity=".5"/>`,
    entrenador: `<g ${TRAZO}>
      <path d="M28 44 C28 18 72 18 72 44"/><path d="M20 46 H80"/>
      <circle cx="50" cy="30" r="5" fill="currentColor" stroke="none"/>
      <path d="M31 47 C31 66 40 74 50 74 C60 74 69 66 69 47"/>
      <path d="M42 72 V78 C26 80 14 86 12 96 M58 72 V78 C62 79 64 80 66 81"/></g>
      <circle cx="78" cy="84" r="14" fill="#1d2433" stroke="currentColor" stroke-width="6"/>
      <path d="M64 84 H92" stroke="currentColor" stroke-width="5"/>
      <circle cx="78" cy="84" r="4.5" fill="#1d2433" stroke="currentColor" stroke-width="4"/>`,
    centro: `<circle cx="50" cy="50" r="44" fill="#fff4f6" stroke="#e3350d" stroke-width="6"/>
      <path d="M41 20 H59 V41 H80 V59 H59 V80 H41 V59 H20 V41 H41 Z" fill="#e3350d"/>`,
    inicio: `<path d="M12 48 L50 14 L88 48" fill="none" stroke="#e3350d" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 44 V88 H78 V44 L50 20 Z" fill="#f5efe0"/>
      <rect x="42" y="60" width="16" height="28" rx="2" fill="#6b4a2b"/>
      <rect x="28" y="54" width="10" height="10" fill="#7fb4ff"/><rect x="62" y="54" width="10" height="10" fill="#7fb4ff"/>`,
    /* Gimnasio: anillo de pokébola con un puntero, como un marcador de mapa. */
    gimnasio: `<path d="M50 30 A26 26 0 1 0 64 72" fill="none" stroke="currentColor" stroke-width="14"/>
      <circle cx="42" cy="52" r="9" fill="currentColor"/>
      <path d="M56 40 L94 6 L62 96 L58 64 Z" fill="currentColor"/>
      <path d="M26 30 L60 64" stroke="#1d2433" stroke-width="7"/>`,
    /* Ojo relleno (párpado, iris y pupila), legible aun a 14 px. */
    ojo: `<path d="M2 50 C18 18 82 18 98 50 C82 82 18 82 2 50 Z" fill="currentColor"/>
      <circle cx="50" cy="50" r="23" fill="#1d2433"/>
      <circle cx="50" cy="50" r="13" fill="currentColor"/>
      <circle cx="56" cy="44" r="4.5" fill="#1d2433"/>`,
  };

  const cuerpo = tipo => CUERPOS[tipo] || '';
  const svg = (tipo, clase = 'ico-svg') => `<svg class="${clase}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${cuerpo(tipo)}</svg>`;

  window.PokelikeIconos = { cuerpo, svg };
})();
