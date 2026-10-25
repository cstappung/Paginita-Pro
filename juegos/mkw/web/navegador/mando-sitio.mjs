// Los mandos como en el resto de Juegos — bitácora §100 (pedido del dueño: «el soporte de mandos como lo hacen los
// otros juegos»).
//
// Resumen: la página de Juegos del sitio carga `juegos/audio/mando.js`. Con un mando conectado y sin juego que lo
// configure, ese archivo maneja un CURSOR en la página de arriba (el stick lo mueve, A hace clic, B vuelve atrás). Con
// Mario Kart en su marco eso era un problema: el cursor andaba encima del juego y cada A del mando también hacía clic
// arriba. Los demás juegos del sitio cargan su propia copia de mando.js dentro de su marco; la de arriba lo nota y se
// aparta mientras el marco se ve. Aquí se hace lo mismo:
//   1. se carga la MISMA copia del sitio (en el marco: la dirección exacta se toma del <script> de la página de arriba;
//      fuera del sitio —servidor.mjs, las pruebas— no hay y no pasa nada);
//   2. se configura para que, en el juego, no haga nada (el juego lee el mando solo, controles.mjs, como un mando de
//      GameCube) y, en los menús de la página (el selector de copa o de pistas, los diálogos, el zócalo del descanso),
//      maneje el cursor igual que en los otros juegos: menu() dice cuándo;
//   3. mientras el cursor maneja la página, el mando no llega al juego (controles.sinMandos): un A en «Jugar la Copa»
//      no es también un A en la pantalla de personajes de atrás. El teclado sigue igual;
//   4. al conectar, el aviso del sitio («🎮 Mando DualSense conectado») con los botones de Mario Kart en la letra de la
//      familia del mando (✕ ○ □ △ en PlayStation, A B X Y en Xbox, B A Y X en Switch), y la ayuda de teclado de la
//      tarjeta de inicio cambiada por esos mismos botones mientras el mando está conectado (§106).
// Como un tablero con dos tomas para el mismo enchufe: el conmutador decide cuál está conectada, nunca las dos.
//
// Uso:  montarMandoSitio({ menu: () => bool, controles });  devuelve una promesa con el Mando del marco (o null)

// los botones de Mario Kart (los nombres lógicos de mando.js: a = el de abajo, b = el de la derecha, …)
// (Select y Start son la pausa del juego: con «select» en la lista, mando.js no agrega su «Select: cursor»)
export const PISTAS_MKW = [['a', 'acelerar'], ['b', 'frenar'], ['rt', 'derrapar'], ['lb lt', 'objeto'], ['arriba', 'truco'], ['x', 'mirar atrás'], ['start select', 'pausa']];

// la dirección del mando.js del sitio: la del <script> de la página de arriba (mismo origen), o null
export function direccionMandoSitio(raiz = globalThis) {
  try {
    if (!raiz.parent || raiz.parent === raiz || !raiz.parent.Mando) return null;
    const s = raiz.parent.document.querySelector('script[src*="audio/mando.js"]');
    return s ? s.src : null;
  } catch { return null; }                       // (otro origen: no se puede mirar arriba)
}

export function montarMandoSitio({ menu = () => false, controles = null, raiz = globalThis, documento = globalThis.document } = {}) {
  const src = direccionMandoSitio(raiz);
  if (!src || !documento) return Promise.resolve(null);
  return new Promise(listo => {
    const s = documento.createElement('script');
    s.src = src;
    s.onerror = () => listo(null);
    s.onload = () => {
      const M = raiz.Mando;
      if (!M) { listo(null); return; }
      // (cursor = el modo de mando.js; con un mando conectado y un menú de la página abierto, el mando es para la página)
      const enCursor = () => { try { return !!M.conectado() && M.estado()?.modo === 'cursor'; } catch { return false; } };
      M.configura({
        botones: { select: () => {} },           // (Select no cambia a cursor: en Mario Kart es Start)
        flechas: false, stick: null,             // (en el juego no se fabrican teclas: el juego lee el mando)
        pistas: PISTAS_MKW,
        // §106: con un mando conectado, la ayuda de teclado de la tarjeta de inicio (.teclas: «K acelerar · J frenar…»)
        // se cambia por los botones del mando en su letra (✕ ○ □ △, A B X Y), como en los otros juegos del sitio
        zonas: [{ sel: '.teclas' }],
        menu: () => { try { return !!menu(); } catch { return false; } },
      });
      controles?.sinMandos?.(enCursor);
      listo(M);
    };
    (documento.head || documento.documentElement).append(s);
  });
}
