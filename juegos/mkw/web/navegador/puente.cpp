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

// La memoria de la Wii, para que la página sepa en qué pantalla está el juego (bitácora §55, "elegir carrera").
// La memoria del juego vive en dos bloques fijos dentro del wasm (MEM1 = 0x80000000, 24 MB; MEM2 = 0x90000000),
// guardados en big-endian como en la Wii. Esta función da la dirección dentro del wasm de una dirección de la Wii (0 si no
// existe): la página la pide una vez para cada bloque y lee con un DataView sobre HEAPU8 (sin copiar nada). Solo lee
// lo que el juego ya tiene: qué sección y qué página del menú están a la vista, la pista y el modo elegidos.
#include "memory.h"
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_web_mem(unsigned direccion) {
  return Memory::Contains(direccion, 4) ? Memory::GetPointer(direccion, 4) : nullptr;
}
