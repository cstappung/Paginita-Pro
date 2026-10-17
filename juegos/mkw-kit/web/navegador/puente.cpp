// Puente entre el juego (wasm) y la página del navegador.
//
// Resumen: la página (web/navegador/mkw.mjs) necesita saber cómo va el juego para mostrarlo en pantalla y para
// las pruebas del banco: cuántos cuadros lleva y cuánto tiempo pasó esperando. Estas funciones solo leen dos
// contadores que lleva el runtime (vi.cpp, con nuestro parche): la página calcula con ellos los cuadros por
// segundo y el "trabajo por cuadro" = (tiempo real − tiempo esperando) / cuadros.
// EMSCRIPTEN_KEEPALIVE = "no borres esta función aunque nadie la llame desde C++": la llama JavaScript.
#include <emscripten.h>

extern "C" unsigned g_mkwCuadros;    // vi.cpp: cuadros entregados a aurora (cada uno = una imagen en el canvas)
extern "C" double g_mkwHostIdleMs;   // vi.cpp: milisegundos totales que el juego pasó esperando la "tele"

extern "C" EMSCRIPTEN_KEEPALIVE unsigned mkw_web_cuadros() { return g_mkwCuadros; }
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_web_ms_espera() { return g_mkwHostIdleMs; }
