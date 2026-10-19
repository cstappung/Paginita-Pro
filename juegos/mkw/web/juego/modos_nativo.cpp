// Los modos de la sala dentro del Retro WFC del juego: la pista de la playlist y la cilindrada del anfitrión — §72.
//
// Resumen: en línea, el ANFITRIÓN de la sala del juego decide la pista y la cilindrada (cc) de cada carrera y se las
// manda a los demás en el paquete SELECT (el "acta" de la votación). Retro Rewind (Pulsar) cambió esas dos decisiones
// por funciones suyas, que en el C++ traducido son:
//   rr_kamek_81864290 = ExpSELECTHandler::DecideTrack(self)  (Pulsar, Network/PulSELECT.cpp): sortea uno de los votos
//                       y escribe la pista ganadora en el paquete a mandar (self + 0x8 + 0x3A, pulWinningTrack, u16)
//   rr_kamek_81864878 = DecideCC(handler): 10 % 100cc, 65 % 150cc, 25 % espejo → engineClass (self + 0x8 + 0x37, u8)
// y el voto de cada uno lo guarda SELECTHandler::SetPlayerData(handler, personaje, kart, voto, jugador, estrella)
// (0x80660750, con el parche de Pulsar: rr_overlay_80660750), que corre cuando la persona confirma su voto.
// Este módulo las envuelve (en compilar-web.py, REEMPLAZOS: la traducida pasa a llamarse _traducida):
//   - Modo playlist: con una pista puesta por la página (Module._mkw_modos_pista(id)), el VOTO de cada uno pasa a ser
//     esa pista (así la ruleta muestra la misma pista en todas las tarjetas) y la decisión del anfitrión también (por
//     si alguien no votó). El id es el de Pulsar: 0x100 + 4·copa + fila (como el resto de la página).
//   - Cilindrada del anfitrión (copa y playlist): Module._mkw_modos_cc(1..3) = 100cc, 150cc o espejo (0 = la de RR).
// Como un selector con prioridad sobre la votación: la votación sigue igual, pero el resultado sale del selector.
//
// El voto "sin elegir" de Pulsar es 0x43 (NO_TRACK_SELECTED): ese no se cambia (si no, el juego creería que todos ya
// votaron mientras eligen personaje). El "al azar" (0xFF) sí: es un voto.
// Avisa a Module.mkwAlDecidir(pista, cc, votada) cuando el anfitrión decide (para la prueba y la bitácora).
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

extern "C" void rr_kamek_81864290_traducida(CpuContext* ctx);    // DecideTrack de Pulsar
extern "C" void rr_kamek_81864878_traducida(CpuContext* ctx);    // DecideCC de Pulsar
extern "C" void rr_overlay_80660750_traducida(CpuContext* ctx);  // SetPlayerData (con el parche de Pulsar)

namespace {
constexpr uint32_t kEnviar = 0x8;            // ExpSELECTHandler: el paquete a mandar (PulSELECT) empieza en +0x8
constexpr uint32_t kGanadora = kEnviar + 0x3A;   // pulWinningTrack (u16)
constexpr uint32_t kVariante = kEnviar + 0x3C;   // variantIdx (u8): la variante de la pista (0 = la normal)
constexpr uint32_t kCc = kEnviar + 0x37;         // engineClass (u8): 1 = 100cc, 2 = 150cc, 3 = espejo
constexpr uint32_t kSinVoto = 0x43;              // NO_TRACK_SELECTED de Pulsar

int32_t g_pista = -1;     // la pista que la página fija para la carrera que viene (-1 = la votación decide)
int32_t g_cc = 0;         // la cilindrada fija (0 = la de Retro Rewind)
}

extern "C" EMSCRIPTEN_KEEPALIVE void mkw_modos_pista(int32_t pista) { g_pista = pista; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_modos_cc(int32_t cc) { g_cc = (cc >= 1 && cc <= 3) ? cc : 0; }

EM_JS(void, mkw_web_modos_decidio, (int32_t pista, int32_t cc, int32_t votada), {
    if (Module.mkwAlDecidir) Module.mkwAlDecidir(pista, cc, votada);
});

// El voto de la persona (r6) → la pista de la playlist
extern "C" void rr_overlay_80660750(CpuContext* MKW_RESTRICT ctx) {
    if (g_pista >= 0 && (ctx->gpr[6] & 0xFFFF) != kSinVoto) ctx->gpr[6] = static_cast<uint32_t>(g_pista);
    rr_overlay_80660750_traducida(ctx);
}

// La decisión del anfitrión: primero la de Pulsar (el sorteo, lo que guarda para no repetir pistas…) y después, si la
// página fijó una, esa
extern "C" void rr_kamek_81864290(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t h = ctx->gpr[3];
    rr_kamek_81864290_traducida(ctx);
    if (!h) return;
    const int32_t votada = Memory::Read16(h + kGanadora);
    if (g_pista >= 0) {
        Memory::Write16(h + kGanadora, static_cast<uint16_t>(g_pista));
        Memory::Write8(h + kVariante, 0);
    }
    mkw_web_modos_decidio(Memory::Read16(h + kGanadora), Memory::Read8(h + kCc), votada);
}

extern "C" void rr_kamek_81864878(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t h = ctx->gpr[3];
    rr_kamek_81864878_traducida(ctx);
    if (h && g_cc) Memory::Write8(h + kCc, static_cast<uint8_t>(g_cc));
}

// ---- Para las pruebas: dar la carrera en línea por terminada ----
// El juego desconecta a quien no toca NINGÚN botón durante 30 s de carrera en línea (es del Mario Kart Wii original:
// GMDataOnlineVS, 0x8053F184, pregunta al InputMgr si ese mando lleva 1800 cuadros quieto; si sí, marca +0x114 y la
// página DisconnectMgr corta la conexión: «You were disconnected from the other players»). Una persona maneja y no le
// pasa, pero en la prueba nadie maneja, así que no llegaría nunca a la meta.
// Module._mkw_modos_terminar() pide terminar la carrera de los pilotos de esta consola: en el cuadro siguiente se
// llama RaceinfoPlayer::EndLap (0x805349B8, la que corre al cruzar la meta; la versión de RR, que sabe las vueltas de
// cada pista) hasta pasar la última vuelta, como si hubieran cruzado la meta. Lo demás (el tiempo, el puesto, avisar a
// las otras consolas, los puntos) lo hace el juego como siempre.
// Se hace dentro de 0x8053F184 porque esa corre en cada cuadro de la carrera en línea, en el lugar justo
// (GMDataOnlineVS::Update), y recibe el GMData en r3: +0x4 = Raceinfo, +0x108/+0x109 = ids de los pilotos de aquí.
extern "C" void func_8053F184_traducida(CpuContext* ctx);   // el control de inactividad del juego

namespace { int32_t g_terminar = 0; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_modos_terminar() { g_terminar = 1; }

extern "C" void func_8053F184(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t gm = ctx->gpr[3];
    const uint32_t ri = gm ? Memory::Read32(gm + 0x4) : 0;          // Raceinfo
    if (g_terminar && ri && Memory::Read32(ri + 0x28) == 2) {       // etapa 2 = corriendo
        g_terminar = 0;
        const uint32_t lista = Memory::Read32(ri + 0xC);           // RaceinfoPlayer* de cada jugador
        for (uint32_t k = 0; k < 2; k++) {
            const uint32_t id = Memory::Read8(gm + 0x108 + k);       // 0xFF = no hay segundo piloto aquí
            const uint32_t p = (id == 0xFF || !lista) ? 0 : Memory::Read32(lista + 4 * id);
            // currentLap (+0x24) contra maxLap (+0x26): EndLap termina la carrera al pasar la última; tope de 8 por las dudas
            for (int v = 0; p && v < 8 && Memory::Read16(p + 0x24) <= Memory::Read8(p + 0x26); v++) {
                CpuContext c = *ctx;                                // sobre una copia, como directo_nativo.cpp
                c.gpr[3] = p;
                InvokeDirectCpu<0x805349B8u>(&c);
            }
        }
    }
    func_8053F184_traducida(ctx);
}
