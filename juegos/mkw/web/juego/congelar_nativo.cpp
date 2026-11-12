// §274: congelar la LÓGICA del juego y seguir dibujando (la pausa de la sala de la «⚡ Auto calibración: máxima fluidez»).
//
// Resumen. Cada vuelta del bucle principal del juego (RKSystem::Run) primero CALCULA (EGG::SceneManager::calc,
// 0x8023AE60: calcCurrentScene y calcCurrentFader: la carrera, los karts, las CPU, el reloj, los menús) y después
// DIBUJA lo calculado (EGG::SceneManager::draw y la copia a la pantalla). Con mkw_congelar(1), el cálculo no corre:
// el bucle sigue dando vueltas y dibuja una y otra vez la MISMA escena, quieta. Así:
//   - el estado del juego no cambia (ni un cuadro de carrera, ni el azar, ni el reloj de la carrera, ni el plazo DNF ni
//     el tiempo límite, que corren sobre ese reloj);
//   - el lockstep de la sala no corre ningún cuadro: PADRead (pad_web.cpp) solo le pide botones a la página cuando el
//     cuadro de la carrera (Raceinfo +0x1E + +0x20) avanza, y congelado no avanza;
//   - la tarjeta de video y el dibujo trabajan como en la carrera de verdad (es la misma escena): la página mide ahí cada
//     ajuste de imagen (N8, la resolución de salida) sin tocar lo que comparte con los demás.
// Como el «hold» de un osciloscopio: la traza queda quieta en la pantalla, el barrido sigue pintándola, y la señal de
// entrada no se toca. Con mkw_congelar(0) el cálculo vuelve en la vuelta siguiente, desde el mismo cuadro.
// (W10, §240, ya mostró que el bucle dibuja y presenta bien sin el cálculo: su Worker B no calculaba.)
// Va en el programa de siempre (junto con N8: no con W10, que envuelve la misma función).
#include "ppc_runtime.h"

#include <emscripten/emscripten.h>

#include <cstdint>

namespace {
int g_congelar = 0;          // 1 = no calcular (pedido de la página)
uint32_t g_vueltas = 0;      // vueltas del bucle que no calcularon (desde que arrancó el programa)
uint32_t g_veces = 0;        // cuántas veces se congeló
}  // namespace

extern "C" EMSCRIPTEN_KEEPALIVE void mkw_congelar(int si) {
    const int s = si ? 1 : 0;
    if (s && !g_congelar) g_veces++;
    g_congelar = s;
}
// 0 = ¿congelado ahora?, 1 = vueltas sin calcular, 2 = veces que se congeló
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_congelado_estado(int i) {
    return i == 0 ? static_cast<uint32_t>(g_congelar) : i == 1 ? g_vueltas : g_veces;
}

extern "C" void func_8023AE60_traducida(CpuContext* ctx);   // EGG::SceneManager::calc (la del juego)
extern "C" void func_8023AE60(CpuContext* ctx) {
    if (g_congelar) { g_vueltas++; return; }                 // (la escena queda como estaba: el dibujo la repite)
    func_8023AE60_traducida(ctx);
}
