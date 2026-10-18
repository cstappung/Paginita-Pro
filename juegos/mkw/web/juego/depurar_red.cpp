// Depuración de la red en línea (solo con MKW_DEPURAR=1 al compilar) — bitácora §58.
//
// Resumen: cuando la consola se "desconecta de los demás", el juego (DWC, la biblioteca de red de Nintendo) primero
// anota un error con DWCi_SetError (0x800CCC68: r3 = tipo de error, r4 = código) y después RKNet cierra todo
// (DWC_CloseAllConnectionsHard, 0x800D1D90). Estas versiones nativas avisan a la consola del navegador con el
// error y la CADENA DE LLAMADAS (quién llamó a quién: cada función guarda en la pila de la Wii la dirección a la
// que debe volver; se recorre la pila y se anotan esas direcciones). Las direcciones se pasan a nombres con la
// tabla de símbolos. Después llaman a la original: no cambian nada del juego.
#include "ppc_runtime.h"
#include "memory.h"

#include <emscripten/emscripten.h>
#include <cstdio>
#include <string>

extern "C" void func_800CCC68_traducida(CpuContext* ctx);   // DWCi_SetError

EM_JS(void, mkw_depurar_log, (const char* t), { console.log('[depurar-red] ' + UTF8ToString(t)); });

// la cadena: primero LR (a dónde vuelve esta función), después cada marco de la pila (r1 → marco anterior; +4 = LR)
static std::string Cadena(CpuContext* ctx) {
    char b[24];
    std::string s;
    std::snprintf(b, sizeof b, "%08X", ctx->lr);
    s += b;
    uint32_t sp = ctx->gpr[1], v = 0;
    std::snprintf(b, sizeof b, " [r1=%08X]", sp);
    s += b;
    for (int i = 0; i < 16; i++) {                  // la pila puede estar en MEM1 (0x80…) o en MEM2 (0x90…)
        if (!Memory::TryRead32(sp, v) || v == 0 || v == 0xFFFFFFFFu) break;
        sp = v;
        if (!Memory::TryRead32(sp + 4, v)) break;
        std::snprintf(b, sizeof b, " %08X", v);
        s += b;
    }
    return s;
}

extern "C" void func_800CCC68(CpuContext* ctx) {
    char b[96];
    std::snprintf(b, sizeof b, "DWCi_SetError error=%d codigo=%d cadena: ", (int)ctx->gpr[3], (int)ctx->gpr[4]);
    if (ctx->gpr[3] != 0) mkw_depurar_log((std::string(b) + Cadena(ctx)).c_str());
    func_800CCC68_traducida(ctx);
}

// las demás: solo avisar quién llamó (nombre de la función del juego + cadena) y seguir con la original
#define GANCHO(dir, nombre)                                                          \
    extern "C" void func_##dir##_traducida(CpuContext* ctx);                         \
    extern "C" void func_##dir(CpuContext* ctx) {                                    \
        mkw_depurar_log((std::string(nombre " cadena: ") + Cadena(ctx)).c_str());    \
        func_##dir##_traducida(ctx);                                                 \
    }
GANCHO(800D1D90, "DWC_CloseAllConnectionsHard")
GANCHO(800D0FEC, "DWC_ShutdownFriendsMatch")
GANCHO(806561A8, "RKNet::Controller::ScheduleShutdown")
GANCHO(80656FF8, "RKNet::Controller::SetConnectionStateToFailed")
GANCHO(80653DDC, "RKNet::PacketMgr::ProcessPlayerDC")
GANCHO(800D2000, "DWC::CloseConnectionHard")
GANCHO(800DAD9C, "DWCi_ShutdownMatch")
GANCHO(800FBA4C, "gpDisconnect")

// DWCi_RecvCallback (0x800E8814): cada mensaje que llega de otra consola. Anota cuántos llegan y, cada 300, el
// reloj "último dato recibido" de cada jugador (DWC: control en [r13-26856], 64 bytes por jugador, +56/+60) y el
// tiempo máximo sin datos permitido (+2068, en ms)
extern "C" void func_800E8814_traducida(CpuContext* ctx);
extern "C" void func_800E8814(CpuContext* ctx) {
    static uint32_t n = 0;
    const uint32_t largo = ctx->gpr[5], r13 = ctx->gpr[13];
    func_800E8814_traducida(ctx);
    if (++n % 300 == 1) {
        uint32_t dwc = 0, limite = 0;
        Memory::TryRead32(r13 - 26856, dwc);
        if (dwc) Memory::TryRead32(dwc + 2068, limite);
        char b[256];
        int k = std::snprintf(b, sizeof b, "RecvCallback n=%u largo=%u limite=%u ms ultimo:", n, largo, limite);
        for (uint32_t aid = 0; aid < 4 && dwc && k < 200; aid++) {
            uint32_t hi = 0, lo = 0;
            Memory::TryRead32(dwc + aid * 64 + 56, hi); Memory::TryRead32(dwc + aid * 64 + 60, lo);
            k += std::snprintf(b + k, sizeof b - k, " [%u]=%08X%08X", aid, hi, lo);
        }
        mkw_depurar_log(b);
    }
}

// Section::ScheduleDisconnection (0x80623054): la pantalla pide "desconectar". Con el estado de error de RKNet
// (RKNet::Controller en [0x809C20D8]: +40 estado, +44 tipo de error, +48 código, +10071 bandera) y la del sistema
// ([[0x80385FC0] + 80/81])
extern "C" void func_80623054_traducida(CpuContext* ctx);
extern "C" void func_80623054(CpuContext* ctx) {
    uint32_t c = 0, e40 = 0, e44 = 0, e48 = 0, w = 0, sis = 0, s80 = 0;
    Memory::TryRead32(0x809C20D8u, c);
    if (c) { Memory::TryRead32(c + 40, e40); Memory::TryRead32(c + 44, e44); Memory::TryRead32(c + 48, e48); Memory::TryRead32(c + 10068, w); }
    Memory::TryRead32(0x80385FC0u, sis);
    if (sis) Memory::TryRead32(sis + 80, s80);
    char b[200];
    std::snprintf(b, sizeof b, "Section::ScheduleDisconnection estado=%u error=%u codigo=%u banderas@10068=%08X sistema@80=%08X cadena: ",
                  e40, e44, e48, w, s80);
    mkw_depurar_log((std::string(b) + Cadena(ctx)).c_str());
    func_80623054_traducida(ctx);
}

// las funciones que pueden pedir el apagado de RKNet (escriben RKNet::Controller+10069): avisar SOLO si la
// bandera pasó de 0 a 1 durante la llamada
static uint8_t BanderaApagado() {
    uint32_t c = 0, w = 0;
    Memory::TryRead32(0x809C20D8u, c);
    if (c) Memory::TryRead32(c + 10068, w);
    return (w >> 16) & 0xFF;                       // +10069 = segundo byte de la palabra en +10068
}
#define GANCHO_APAGADO(dir, nombre)                                                   \
    extern "C" void func_##dir##_traducida(CpuContext* ctx);                         \
    extern "C" void func_##dir(CpuContext* ctx) {                                    \
        const std::string cadena = Cadena(ctx);                                      \
        const uint8_t antes = BanderaApagado();                                      \
        func_##dir##_traducida(ctx);                                                 \
        if (!antes && BanderaApagado())                                              \
            mkw_depurar_log((std::string(nombre " PIDIO APAGADO cadena: ") + cadena).c_str()); \
    }
GANCHO_APAGADO(80666288, "func_80666288 (pagina, ServerMgr)")
GANCHO_APAGADO(8063519C, "SectionMgr::ExitSection")
GANCHO_APAGADO(8067552C, "func_8067552C (ServerMgr)")

// quién pide cambiar de escena (SetNextSection: r4 = escena siguiente; RequestSceneChange/Reinit), con argumentos
#define GANCHO_ARGS(nombreC, nombre)                                                  \
    extern "C" void nombreC##_traducida(CpuContext* ctx);                            \
    extern "C" void nombreC(CpuContext* ctx) {                                       \
        char b[120];                                                                 \
        std::snprintf(b, sizeof b, nombre " r3=%08X r4=%08X r5=%08X cadena: ",       \
                      ctx->gpr[3], ctx->gpr[4], ctx->gpr[5]);                        \
        mkw_depurar_log((std::string(b) + Cadena(ctx)).c_str());                     \
        nombreC##_traducida(ctx);                                                    \
    }
GANCHO_ARGS(func_80635A3C, "SectionMgr::SetNextSection")
GANCHO_ARGS(rr_overlay_80635A3C, "SetNextSection (RR)")
GANCHO_ARGS(func_80635AC8, "SectionMgr::RequestSceneChange")
GANCHO_ARGS(func_80635B2C, "SectionMgr::RequestSceneReinit")
