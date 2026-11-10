// G11 de la etapa 7 (bitácora §252): los gráficos opcionales del jugador. El juego dibuja la escena 3D por «caminos de
// dibujo» de EGG (DrawPath), cada uno con su pasada en la tarjeta de video:
//   bit 1 = el brillo (bloom, EGG::DrawPathBloom::DrawImpl, 0x8021CCC0): copia la imagen, la desenfoca y la suma encima;
//   bit 2 = la profundidad de campo (EGG::DrawPathDOF::DrawImpl, 0x8021EEC0): el desenfoque de lo lejano, otra copia;
//   bit 4 = las sombras por volumen (EGG::DrawPathShadowVolume::DrawImpl, 0x80220D7C): «sombras simples» = sin ellas
//           (las manchas de sombra de los karts son modelos aparte y quedan);
//   bit 8 = el mapa de luz (EGG::DrawPathLightMap::DrawImpl, 0x802218EC);
//   bit 16 = las partículas de la carrera (G13, §254: el dibujo de Effects::Mgr, 0x8067CF74, justo después de su
//           Update 0x8067CB88 en los símbolos de Pulsar; el cálculo de las partículas sigue igual, solo no se dibujan).
// mkw_graficos_quitar(máscara) = qué caminos NO se dibujan (0 = todo, como siempre: lo de omisión). Solo toca el dibujo:
// la lógica no lee nada de esto (la carrera es la misma: huellas iguales). Como apagar circuitos de iluminación decorativa
// de un tablero: el motor sigue igual, se gasta menos.
#include "ppc_runtime.h"
#include <cstdint>
#include <emscripten/emscripten.h>

namespace {
int g_quitar = 0;                 // la máscara de arriba
double g_saltados[5] = {0, 0, 0, 0, 0};   // cuántas veces se saltó cada camino
}
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_graficos_quitar(int mascara) { g_quitar = mascara & 31; }
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_graficos_dato(int i) { return i >= 0 && i < 5 ? g_saltados[i] : g_quitar; }

extern "C" void func_8021CCC0_traducida(CpuContext* ctx);   // EGG::DrawPathBloom::DrawImpl
extern "C" void func_8021EEC0_traducida(CpuContext* ctx);   // EGG::DrawPathDOF::DrawImpl
extern "C" void func_80220D7C_traducida(CpuContext* ctx);   // EGG::DrawPathShadowVolume::DrawImpl
extern "C" void func_802218EC_traducida(CpuContext* ctx);   // EGG::DrawPathLightMap::DrawImpl
extern "C" void func_8021CCC0(CpuContext* ctx) { if (g_quitar & 1) { g_saltados[0]++; return; } func_8021CCC0_traducida(ctx); }
extern "C" void func_8021EEC0(CpuContext* ctx) { if (g_quitar & 2) { g_saltados[1]++; return; } func_8021EEC0_traducida(ctx); }
extern "C" void func_80220D7C(CpuContext* ctx) { if (g_quitar & 4) { g_saltados[2]++; return; } func_80220D7C_traducida(ctx); }
extern "C" void func_802218EC(CpuContext* ctx) { if (g_quitar & 8) { g_saltados[3]++; return; } func_802218EC_traducida(ctx); }
#ifndef MKW_SUCIAS   // (el programa de W10, §240, ya envuelve esta función: ahí G13 no va)
extern "C" void func_8067CF74_traducida(CpuContext* ctx);   // el dibujo de Effects::Mgr (las partículas de la carrera)
extern "C" void func_8067CF74(CpuContext* ctx) { if (g_quitar & 16) { g_saltados[4]++; return; } func_8067CF74_traducida(ctx); }
#endif
