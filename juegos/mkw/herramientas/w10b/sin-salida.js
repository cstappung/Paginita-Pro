// W10b, la puerta (bitácora §284): prender «el dibujo sin salida» de aurora mientras corre la carrera.
// Solo instrumento de medida (se inyecta con Playwright: MKW_INIT_JS=<este archivo> en medir-sitio.mjs y en
// tramo-telefono-dibujante.mjs); nunca va en la página de jugar. Actúa solo si la dirección trae &w10b=1.
//
// Resumen: el programa de la puerta (compilado con MKW_CFLAGS_TODO=-DMKW_W10B) trae mkw_w10b_sin_salida(si). Prendido,
// el juego dibuja como siempre (recorre la escena, ordena, llama a GX) pero GX no le pasa trabajo a la tarjeta: es lo
// que le quedaría por hacer al núcleo de la lógica (A) en W10b. Como hacer andar el tablero con la carga desconectada.
(() => {
  if (!/[?&]w10b=1/.test(location.search)) return;          // (solo la variante que lo pide)
  let prendido = -1, ocupado = false;                         // (-1 = todavía no se sabe)
  const t = setInterval(async () => {
    if (ocupado) return; ocupado = true;
    try {
      const M = window.mkw, E = window.mkwEstado;              // (mkw.mjs: el Module de emscripten y el estado)
      if (!M || !M._mkw_w10b_sin_salida || !E) return;
      const quiero = E.enCarrera ? 1 : 0;                     // solo con la carrera andando (los menús dibujan normal)
      if (quiero !== prendido) {
        const r = await M._mkw_w10b_sin_salida(quiero);       // (con JSPI puede volver como promesa)
        prendido = quiero;
        console.log(`[w10b] sin salida ${quiero ? 'prendido' : 'apagado'} (estado ${r & 1}, ${r >>> 1} MB tirados)`);
      }
      window.__w10b = { prendido, mb: (await M._mkw_w10b_sin_salida(-1)) >>> 1 };
    } catch (e) { console.log('[w10b] ✗ ' + e); clearInterval(t); }
    finally { ocupado = false; }
  }, 250);
})();
