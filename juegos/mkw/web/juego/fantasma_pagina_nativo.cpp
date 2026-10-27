// La Contrarreloj contra el mejor fantasma de la página (pedido del dueño, bitácora §92).
//
// Resumen: en la Contrarreloj de Retro Rewind, después de elegir la pista sale la pantalla de fantasmas (página 0x71)
// y su primer botón es «correr contra el fantasma». El fantasma que se corre lo carga Pulsar (el motor de Retro
// Rewind) en Ghosts::Mgr::LoadCorrectMainGhost (rr_kamek_81814B0C): lee el archivo .rkg del fantasma elegido (el
// experto de la pista o uno guardado en la carpeta del mod) y lo deja en el búfer de la pantalla GhostManager
// (+0x308: puntero al RKG), de donde el juego lo descomprime para la carrera.
// Aquí se envuelve esa función: después de que Pulsar carga el suyo, si la página trajo el fantasma del mejor tiempo
// de la página para ESA pista y ESE modo (150cc / 200cc), se escribe ese .rkg encima. El juego corre contra él como
// contra cualquier fantasma: su personaje, su vehículo, su Mii y sus botones, vuelta por vuelta.
//   - Solo en lugar del fantasma experto que Retro Rewind pone por omisión al elegir «correr contra el fantasma» en la
//     pantalla de fantasmas (estado 9 de GhostManager, STAFF_GHOST_RACE_FROM_MENU; medido con el juego). Si la persona
//     elige uno de SUS fantasmas guardados de la lista (estado 3), ese manda.
//   - El .rkg lo baja la página (fantasma-pagina.mjs) de Firebase Storage y lo deja aquí con mkw_fantasma_pagina_poner.
//   - Un .rkg es lo que graba el juego de una vuelta de una persona (sus botones cuadro a cuadro, comprimidos), no
//     un archivo del juego.
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

namespace {
constexpr uint32_t kTamRkg = 0x2800;                    // sizeof(RKG): el búfer de un fantasma
constexpr uint32_t kCupsConfig = 0x818A2D9Cu;           // Pulsar: CupsConfig* (+0x10 la pista ganadora, la que se corre)
constexpr uint32_t kSystem = 0x8189FBBCu;               // Pulsar: System* (+0xD0 el modo de Contrarreloj: 0 = 150cc, 1 = 200cc,
                                                        // 2 y 3 = con pluma)
constexpr uint32_t kEstadoMenu = 9;                     // GhostManager +0x94: STAFF_GHOST_RACE_FROM_MENU (el experto, desde el menú)
uint8_t g_rkg[kTamRkg];
uint32_t g_largo = 0, g_pista = 0xFFFFFFFFu, g_modo = 0xFFFFFFFFu;
int g_usado = 0;                                        // cuántas carreras se armaron con el fantasma de la página
uint32_t g_ultimoEstado = 0xFFFFFFFFu;                  // (para mirar) el estado de la última carga
}  // namespace

// La página: dónde escribir el .rkg, y después cuál es (largo, pista, modo). largo 0 = ninguno.
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_fantasma_pagina_bufer() { return g_rkg; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_fantasma_pagina_poner(uint32_t largo, uint32_t pista, uint32_t modo) {
    g_largo = largo <= kTamRkg ? largo : 0;
    g_pista = pista; g_modo = modo;
}
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_fantasma_pagina_usado() { return g_usado; }
// La pista que se corre y el modo de Contrarreloj, para la página: Pulsar vive más allá de los 24 MB de la Wii (0x818…),
// donde el lector de la página (menus.mjs) no llega. 0xFFFFFFFF = todavía no hay.
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_fantasma_pagina_pista() { const uint32_t c = Memory::Read32(kCupsConfig); return c ? Memory::Read32(c + 0x10) : 0xFFFFFFFFu; }
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_fantasma_pagina_modo() { const uint32_t s = Memory::Read32(kSystem); return s ? Memory::Read32(s + 0xD0) : 0xFFFFFFFFu; }
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_fantasma_pagina_estado() { return g_ultimoEstado; }

extern "C" void rr_kamek_81814B0C_traducida(CpuContext* ctx);
extern "C" void rr_kamek_81814B0C(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t pantalla = ctx->gpr[3];                    // Pages::GhostManager
    const uint32_t estado = Memory::Read32(pantalla + 0x94);  // (antes de cargar: Pulsar cambia un 3 por un 9)
    g_ultimoEstado = estado;
    rr_kamek_81814B0C_traducida(ctx);                         // primero Pulsar carga el suyo
    if (!g_largo || estado != kEstadoMenu) return;
    const uint32_t cups = Memory::Read32(kCupsConfig), sistema = Memory::Read32(kSystem);
    if (!cups || !sistema) return;
    if (Memory::Read32(cups + 0x10) != g_pista || Memory::Read32(sistema + 0xD0) != g_modo) return;   // otra pista u otro modo
    const uint32_t rkg = Memory::Read32(pantalla + 0x308);
    if (!rkg || !Memory::Contains(rkg, kTamRkg)) return;
    for (uint32_t k = 0; k < kTamRkg; k++) Memory::Write8(rkg + k, k < g_largo ? g_rkg[k] : 0);   // el resto en cero, como ClearBuffer
    ++g_usado;
}
