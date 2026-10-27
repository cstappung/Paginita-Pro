// Depuración del corte en la carrera en línea (solo con MKW_DEPURAR=1 al compilar) — bitácora §72.
//
// Resumen: a los 30 s de carrera las dos consolas se desconectan («You were disconnected from the other players») sin
// que la red pierda un paquete. Retro Rewind revisa cada paquete de carrera que llega (Pulsar,
// Network/PacketExpansion.cpp, CheckPacket: en el C++ traducido rr_kamek_818B4854, llamado desde DWC::UserRecvCallback
// 0x806585F4): si su suma de control (CRC32) no coincide o un trozo viene más grande que su lugar, marca a ese
// jugador en CustomRKNetController +0x25B0 (toDisconnectAids) y en la vuelta siguiente lo desconecta.
// Esta versión llama a la original y, si dejó una marca nueva, avisa a la consola del navegador con el jugador (aid),
// el largo, la cabecera del paquete (magia, CRC, los 8 largos) y el CRC calculado aquí (con el campo del CRC en 0).
#include "ppc_runtime.h"
#include "memory.h"

#include <emscripten/emscripten.h>
#include <cstdio>

extern "C" void rr_kamek_818B4854_traducida(CpuContext* ctx);   // CheckPacket de Pulsar

EM_JS(void, mkw_depurar_paq, (const char* t), { console.log('[depurar-paquete] ' + UTF8ToString(t)); });

static uint32_t Crc32(uint32_t dir, uint32_t largo) {           // el CRC32 de siempre (polinomio 0xEDB88320)
    uint32_t c = 0xFFFFFFFFu;
    for (uint32_t i = 0; i < largo; i++) {
        uint8_t b = Memory::Read8(dir + i);
        if (i >= 4 && i < 8) b = 0;                                // el campo del CRC (+0x4) va en 0 al calcularlo
        c ^= b;
        for (int k = 0; k < 8; k++) c = (c >> 1) ^ (0xEDB88320u & (0u - (c & 1u)));
    }
    return ~c;
}

extern "C" void rr_kamek_818B4854(CpuContext* ctx) {
    const uint32_t ctrl = ctx->gpr[3], paquete = ctx->gpr[4], largo = ctx->gpr[5], aid = ctx->gpr[7];
    const uint32_t antes = ctrl ? Memory::Read32(ctrl + 0x25B0) : 0;
    static uint32_t n = 0;
    ++n;
    rr_kamek_818B4854_traducida(ctx);
    const uint32_t despues = ctrl ? Memory::Read32(ctrl + 0x25B0) : 0;
    if ((despues & ~antes) == 0 && n % 600 != 1) return;           // sin marca nueva: solo uno de cada 600, de muestra
    char b[256];
    std::snprintf(b, sizeof b, "%s n=%u aid=%u largo=%u magia=%08X crc=%08X calculado=%08X largos=%02X %02X %02X %02X %02X %02X %02X %02X",
                  (despues & ~antes) ? "MARCA PARA DESCONECTAR" : "muestra", n, aid, largo, Memory::Read32(paquete),
                  Memory::Read32(paquete + 4), Crc32(paquete, largo),
                  Memory::Read8(paquete + 8), Memory::Read8(paquete + 9), Memory::Read8(paquete + 10), Memory::Read8(paquete + 11),
                  Memory::Read8(paquete + 12), Memory::Read8(paquete + 13), Memory::Read8(paquete + 14), Memory::Read8(paquete + 15));
    mkw_depurar_paq(b);
}
