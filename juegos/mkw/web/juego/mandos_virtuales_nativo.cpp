// Más de 4 humanos en la sala: los "mandos virtuales" (PLAN C9, bitácora §91).
//
// Resumen: en la carrera sincronizada de la sala cada humano es un jugador de verdad (tipo 0) en todas las consolas y
// su kart lee los botones de "su" mando (semillas_nativo.cpp, §73). La Wii tiene 4 puertos de mando de GameCube: así
// cabían 4 humanos. Mario Kart en línea admite 12 porque los jugadores de otras consolas no usan un puerto: cada kart
// lee sus botones de un PORTADOR (ControllerHolder) y el juego tiene, además de los 4 reales, 12 portadores VIRTUALES,
// uno por puesto de la carrera (Input::Manager +0x3B4 + puesto·0x180: los que usan la CPU y los remotos en línea).
//   - Cuál usa cada kart lo decide el constructor de RaceinfoPlayer (0x80533ED8, en 0x80534108): si el jugador tiene
//     mando en esta consola (Racedata, jugador +0x6, "realControllerChannel") usa el portador real de ese puerto
//     (Input::Manager + 4 + mando·0xEC); si vale -1, el virtual de su puesto. El kart lo lee de RaceinfoPlayer +0x48
//     (Kart::Link::GetControllerHolder, 0x805903F4).
//   - A los humanos que no tienen puerto (mando de la sala ≥ g_mkwPuertos) semillas_nativo.cpp les pone -1: el juego
//     solo les da su portador virtual.
//   - Los botones de un portador virtual solo cambian con AIControllerHolder::CopyCPUInputs (0x805219AC: copia un
//     estado de botones al mando de la CPU y actualiza el portador en el acto: el de antes pasa a "anterior"). El
//     Input::Manager actualiza en cada cuadro solo los 4 reales (Update, 0x805238F0; la de Retro Rewind). Por eso, justo después de esa
//     función (el mismo momento en que se actualizan los reales), aquí se llama CopyCPUInputs una vez por cuadro para
//     cada humano sin puerto, con SUS botones de ese cuadro (los reparte lockstep.mjs y los deja pad_web.cpp).
//   - El estado de botones (Input::State: acciones, stick en 15 pasos, la cruz) se arma con la MISMA cuenta del juego
//     para un mando de GameCube (GCNController::UpdateImpl, 0x805201B0), así el kart responde igual que con un puerto.
//     Esa cuenta lee los botones de la tabla del Input::Manager (padStatuses, +0x4120 + canal·12, con CopyPADStatus) y
//     recuerda cosas del cuadro anterior dentro del objeto del mando. Se usa un mando "prestado" (el del canal
//     kPrestado): se guarda tal como está, se le pone la memoria propia de ESE humano y sus botones en la tabla, se hace
//     la cuenta, se guarda su memoria nueva y se devuelve el mando como estaba. Como un multímetro que se pasa de un
//     circuito a otro: se mide uno, se anota y se vuelve a dejar todo conectado como antes.
// Todo sale de los mismos botones en todas las consolas y de nada propio de cada una: la carrera sigue igual en todas.
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

#include <cstring>

// pad_web.cpp: los botones de cada mando virtual en este cuadro y si la carrera sincronizada está en curso
struct MkwPadVirtual { uint16_t botones; int8_t sx, sy, cx, cy; uint8_t gl, gr; uint8_t conectado; };
extern "C" MkwPadVirtual g_mkwPadVirtual[12];
extern "C" int mkw_pad_en_carrera();                    // 1 = el último PADRead fue de la carrera sincronizada
extern "C" uint32_t g_mkwHumanos;                       // semillas_nativo.cpp: bit i = el puesto i es un humano
extern "C" int8_t g_mkwVirtualDe[12];                   // semillas_nativo.cpp: puesto → su mando virtual (-1 = no tiene)
extern "C" int8_t g_mkwDerrapeVirtual[12];              // semillas_nativo.cpp: puesto → 1 manual, 2 automático (0 = no se sabe)

// Input::Manager::Update: Retro Rewind trae su propia versión (rr_overlay_805238F0, la que llama el juego; como
// SectionMgr::Update en §71): se envuelve esa
extern "C" void rr_overlay_805238F0_traducida(CpuContext* ctx);

namespace {
constexpr uint32_t kManager = 0x809BD70Cu;              // Input::Manager*
constexpr uint32_t kRaceinfo = 0x809BD730u;             // Raceinfo*
constexpr uint32_t kVirtuales = 0x3B4, kTamVirtual = 0x180;   // AIControllerHolder[12]
constexpr uint32_t kGcn = 0x3BA0, kTamGcn = 0xB0;       // GCNController[4]
constexpr uint32_t kPads = 0x4120, kTamPad = 12;        // PAD::Status[4]
constexpr uint32_t kPrestado = 3;                       // el mando que se presta para la cuenta
// lo que la cuenta del mando recuerda entre cuadros, dentro del objeto (el resto se escribe o se pisa en cada cuenta):
// +0x50..+0x5B (si dio error, batería) y +0x90..+0xAF (sus botones, el canal, el stick C, los botones de antes)
constexpr uint32_t kMem1 = 0x50, kTamMem1 = 0x0C, kMem2 = 0x90, kTamMem2 = 0x20;
uint8_t g_memoria[12][kTamMem1 + kTamMem2];             // la memoria de mando de cada puesto
uint32_t g_raceinfo = 0;                                // la carrera para la que se preparó todo
int g_cuadros = 0;                                      // (para mirar) cuántos cuadros se alimentaron
}  // namespace

extern "C" EMSCRIPTEN_KEEPALIVE int mkw_virtuales_cuadros() { return g_cuadros; }

// La dirección del portador virtual del puesto i (para mirar desde las pruebas)
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_virtual_portador(int i) {
    const uint32_t m = Memory::Read32(kManager);
    return (m && i >= 0 && i < 12) ? m + kVirtuales + static_cast<uint32_t>(i) * kTamVirtual : 0;
}

static void copiar(uint32_t destino, const uint8_t* desde, uint32_t n) { for (uint32_t k = 0; k < n; k++) Memory::Write8(destino + k, desde[k]); }
static void leer(uint8_t* hacia, uint32_t desde, uint32_t n) { for (uint32_t k = 0; k < n; k++) hacia[k] = Memory::Read8(desde + k); }

// Carrera nueva: la memoria de mando de cada puesto en cero (igual en todas las consolas) y el estado de botones del
// mando de cada portador virtual con humano, vacío (State::Reset 0x8051E85C, UIState::Reset 0x8051E904): lo que haya
// quedado ahí de antes (menús, otra partida) puede ser distinto en cada consola.
static void prepararCarrera(CpuContext* ctx, uint32_t m) {
    std::memset(g_memoria, 0, sizeof g_memoria);
    for (int i = 0; i < 12; i++) {
        if (g_mkwVirtualDe[i] < 0 || !(g_mkwHumanos & (1u << i))) continue;
        const uint32_t portador = m + kVirtuales + i * kTamVirtual, mando = Memory::Read32(portador + 4);
        if (!mando) continue;
        CpuContext c = *ctx; c.gpr[3] = mando + 0x90; InvokeDirectCpu<0x8051E85Cu>(&c);
        c = *ctx; c.gpr[3] = mando + 0x1C; InvokeDirectCpu<0x8051E904u>(&c);
    }
}

extern "C" void rr_overlay_805238F0(CpuContext* MKW_RESTRICT ctx) {
    rr_overlay_805238F0_traducida(ctx);                       // primero el juego: los 4 mandos reales de este cuadro
    if (!g_mkwHumanos || !mkw_pad_en_carrera()) return;
    const uint32_t m = Memory::Read32(kManager), ri = Memory::Read32(kRaceinfo);
    if (!m || !ri) return;
    bool alguno = false;
    for (int i = 0; i < 12 && !alguno; i++) alguno = g_mkwVirtualDe[i] >= 0 && (g_mkwHumanos & (1u << i));
    if (!alguno) return;
    if (ri != g_raceinfo) { g_raceinfo = ri; prepararCarrera(ctx, m); }

    const uint32_t gcn = m + kGcn + kPrestado * kTamGcn, pad = m + kPads + kPrestado * kTamPad;
    uint8_t guardaGcn[kTamGcn], guardaPad[kTamPad];
    leer(guardaGcn, gcn, kTamGcn);                      // el mando prestado, tal como está
    leer(guardaPad, pad, kTamPad);
    for (int i = 0; i < 12; i++) {
        const int v = g_mkwVirtualDe[i];
        if (v < 0 || v >= 12 || !(g_mkwHumanos & (1u << i))) continue;
        const uint32_t portador = m + kVirtuales + i * kTamVirtual, mando = Memory::Read32(portador + 4);
        if (!mando) continue;
        // su derrape (1 manual, 2 automático) en su portador: de ahí lo lee su kart (como SetDriftType en un real)
        if (g_mkwDerrapeVirtual[i] == 1 || g_mkwDerrapeVirtual[i] == 2) Memory::Write16(portador + 0xC0, g_mkwDerrapeVirtual[i] == 2 ? 1 : 0);
        // 1) la memoria de mando de este humano y sus botones en la casilla del canal prestado
        copiar(gcn + kMem1, g_memoria[i], kTamMem1);
        copiar(gcn + kMem2, g_memoria[i] + kTamMem1, kTamMem2);
        Memory::Write32(gcn + 0x9C, kPrestado);         // el canal (de ahí copia sus botones)
        const MkwPadVirtual& b = g_mkwPadVirtual[v];
        Memory::Write16(pad + 0, b.botones);
        Memory::Write8(pad + 2, static_cast<uint8_t>(b.sx)); Memory::Write8(pad + 3, static_cast<uint8_t>(b.sy));
        Memory::Write8(pad + 4, static_cast<uint8_t>(b.cx)); Memory::Write8(pad + 5, static_cast<uint8_t>(b.cy));
        Memory::Write8(pad + 6, b.gl); Memory::Write8(pad + 7, b.gr);
        Memory::Write8(pad + 8, 0); Memory::Write8(pad + 9, 0);
        Memory::Write8(pad + 10, 0);                    // err = PAD_ERR_NONE (conectado)
        Memory::Write8(pad + 11, 0);
        // 2) la cuenta del juego: GCNController::UpdateImpl(mando, estado, estadoUI) → el estado del mando de la CPU
        //    de su portador (+0x90: el que copia CopyCPUInputs) y su estado de menús (+0x1C)
        CpuContext c = *ctx;
        c.gpr[3] = gcn; c.gpr[4] = mando + 0x90; c.gpr[5] = mando + 0x1C;
        InvokeDirectCpu<0x805201B0u>(&c);
        // 3) lo que recordó, para el cuadro siguiente de este humano
        leer(g_memoria[i], gcn + kMem1, kTamMem1);
        leer(g_memoria[i] + kTamMem1, gcn + kMem2, kTamMem2);
        // 4) al portador: AIControllerHolder::CopyCPUInputs(portador, estado) (el de antes pasa a "anterior")
        c = *ctx;
        c.gpr[3] = portador; c.gpr[4] = mando + 0x90;
        InvokeDirectCpu<0x805219ACu>(&c);
    }
    copiar(gcn, guardaGcn, kTamGcn);                    // el mando prestado, como estaba
    copiar(pad, guardaPad, kTamPad);
    ++g_cuadros;
}

// ---------------------------------------------------------------------------------------------------------------------
// Las listas de 4 humanos del juego (lo que se rompía con el 5.º). El juego nunca tuvo más de 4 jugadores de verdad (tipo
// 0) en una carrera, y algunas partes guardan a los humanos en lugares para 4. Pasarse de 4 escribe sobre lo que sigue en
// la memoria (como un registro de desplazamiento de 4 etapas al que le meten un 5.º bit: se derrama en el de al lado).
//
// AI (0x807414B8, lo llama 0x8073922C al armar cada kart): anota cada kart en el objeto de la IA de la carrera
// (AI::Manager +0x84): las CPU en una lista de 12 (+0xE8, de a 8 bytes, cuenta en +0x178) y los demás en una de 4
// (+0x148, cuenta en +0x17C). El 5.º humano se escribía en +0x168, que es el puntero a una lista de la IA: al terminar de
// armarse, la IA llamaba por ese puntero y la carrera se caía («salto a la dirección 0», bitácora §91). Desde el 5.º no se
// anota: esa lista la IA la usa para mirar a los humanos, y con los 4 primeros alcanza (lo mismo en todas las consolas).
extern "C" void func_807414B8_traducida(CpuContext* ctx);
extern "C" void func_807414B8(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t ia = ctx->gpr[3], kart = ctx->gpr[4];
    // de qué puesto es el kart (como 0x80590A5C: **kart + 0x10) y su tipo en la ficha (Racedata, jugador +0x10; 1 = CPU)
    const uint32_t a = Memory::Read32(kart), b = a ? Memory::Read32(a) : 0;
    const uint32_t rd = Memory::Read32(0x809BD728u);
    if (b && rd) {
        const uint32_t puesto = Memory::Read8(b + 0x10);
        const bool cpu = puesto < 12 && Memory::Read32(rd + 0x20 + 0x8 + puesto * 0xF0 + 0x10) == 1;
        if (!cpu && Memory::Read32(ia + 0x17C) >= 4) return;   // la lista de los humanos ya está llena
    }
    func_807414B8_traducida(ctx);
}

// RacedataScenario::InitScreens (0x8052F4E8; Retro Rewind trae su copia, rr_overlay_8052F4E8, que es la que se llama):
// a cada jugador de verdad (tipo 0) le da, en orden, una pantalla (+0x5), un mando (+0x6) y el tipo de su mando (+0xD0),
// que le pregunta al portador real de ese mando (Input::Manager + 4 + mando·0xEC). Desde el 5.º no hay portador real: el
// "mando 4" caía en los portadores virtuales y con 12 humanos llamaba por un puntero que no era (la carrera se caía al
// armarse). Mientras corre, los humanos después del 4.º pasan por CPU (tipo 1: no reciben pantalla ni mando); al volver
// son humanos otra vez, sin pantalla (0xFF), sin mando en esta consola (0xFF: el portador virtual de su puesto, como dice
// semillas_nativo.cpp) y con el mismo tipo de mando que el primer humano (el de GameCube de la sala).
extern "C" void rr_overlay_8052F4E8_traducida(CpuContext* ctx);
extern "C" void rr_overlay_8052F4E8(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t escenario = ctx->gpr[3];
    auto jugador = [escenario](int i) { return escenario + 0x8 + static_cast<uint32_t>(i) * 0xF0; };
    uint32_t prestados = 0;                             // bit i = humano que pasa por CPU mientras se reparten las pantallas
    for (int i = 0, locales = 0; i < 12; i++)
        if (Memory::Read32(jugador(i) + 0x10) == 0 && ++locales > 4) { Memory::Write32(jugador(i) + 0x10, 1); prestados |= 1u << i; }
    rr_overlay_8052F4E8_traducida(ctx);
    if (!prestados) return;
    uint32_t tipoMando = 0xFFFFFFFFu;                   // el del primer humano que recibió mando
    for (int i = 0; i < 12 && tipoMando == 0xFFFFFFFFu; i++)
        if (!(prestados & (1u << i)) && Memory::Read32(jugador(i) + 0x10) == 0) tipoMando = Memory::Read32(jugador(i) + 0xD0);
    for (int i = 0; i < 12; i++) {
        if (!(prestados & (1u << i))) continue;
        Memory::Write32(jugador(i) + 0x10, 0);          // humano otra vez
        Memory::Write8(jugador(i) + 0x5, 0xFF);         // sin pantalla
        Memory::Write8(jugador(i) + 0x6, 0xFF);         // sin mando en esta consola
        Memory::Write32(jugador(i) + 0xD0, tipoMando);
    }
}
