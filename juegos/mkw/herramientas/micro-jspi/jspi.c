// La prueba chica de JSPI (N13, bitácora §166): ¿el perfil de V8 sabe a quién cargarle el tiempo de volver de una
// espera de JSPI, o lo deja como «(program)»?
//
// Resumen: un bucle que hace un trabajo conocido (unas sumas, ~0,5 ms) y después se suspende con emscripten_sleep(0),
// como el juego cuando espera el próximo cuadro: el wasm se congela, la promesa se cumple y el wasm sigue dentro de una
// microtarea. Corre 4.000 veces. Se compila con emcc -sJSPI y se corre en Node bajo --cpu-prof y bajo
// --runtime-call-stats (herramientas/micro-jspi/correr.mjs). Si el (program) del perfil crece con las suspensiones y
// los contadores de V8 lo explican, se sabe qué es; si el perfil no puede separarlo, queda demostrado acá, en chico.
// No usa nada del juego.
#include <emscripten.h>
#include <stdint.h>
#include <stdio.h>

static volatile uint32_t sumidero;

__attribute__((noinline)) static void trabajo(int vueltas) {   // un trabajo de largo conocido
  uint32_t x = 1;
  for (int i = 0; i < vueltas; i++) x = x * 1664525u + 1013904223u;
  sumidero = x;
}

int main(int argc, char** argv) {
  int esperas = argc > 1;           // sin argumentos: el mismo trabajo sin esperas (la base)
  double t0 = emscripten_get_now();
  for (int i = 0; i < 4000; i++) {
    trabajo(400000);
    if (esperas) emscripten_sleep(0);
  }
  printf("%s: %.1f ms en total\n", esperas ? "con 4000 esperas JSPI" : "sin esperas", emscripten_get_now() - t0);
  return 0;
}
