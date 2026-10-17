// aurora "sin pantalla" (headless), parte escrita a mano.
//
// Resumen: aurora es la librería de WiiCompiled que convierte los gráficos de la Wii (funciones GX) en dibujos
// con WebGPU, y que además lee los mandos (PAD) y maneja la ventana. Para correr el juego en Node (sin pantalla
// ni tarjeta de video) se reemplaza por esta versión de mentira: la mayoría de sus funciones no hacen nada
// (esas las escribe solas herramientas/generar_aurora_vacia.py en aurora_vacia.cpp), y las de este archivo son
// las pocas que el juego necesita que respondan algo con sentido:
//   - GXGetTexBufferSize: el juego la usa para saber cuánta memoria reservar para una textura. Tiene que dar el
//     número correcto (copiada de aurora-main/lib/dolphin/gx/GXTexture.cpp, licencia MIT, (c) 2022 Luke Street).
//   - Las colas de comandos (FIFO) de GX: el juego guarda y vuelve a poner su puntero; hay que devolverle uno válido.
//   - Los mandos: un mando conectado en el puerto 0 que el programa de Node puede "apretar" (mkw_headless_set_pad),
//     para navegar los menús sin manos.
//   - aurora_initialize / aurora_update / aurora_begin_frame: arranque y bucle de cuadros sin ventana.
// Cada cuadro que el juego termina se cuenta (mkw_headless_frames) y se avisa en el log cada 60.
#include <aurora/aurora.h>
#include <aurora/event.h>
#include <aurora/gfx.h>
#include <dolphin/gx.h>
#include <dolphin/gx/GXAurora.h>
#include <dolphin/pad.h>
#include <dolphin/vi.h>

#include "memory.h"

#include <emscripten.h>

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>

extern "C" double g_mkwHostIdleMs;  // vi.cpp: tiempo total que el juego pasó esperando

namespace {
GXFifoObj g_cpuFifo{};            // la FIFO "actual" que el juego consulta con GXGetCPUFifo
PADStatus g_pad[4]{};             // lo que devuelve PADRead; Node lo cambia con mkw_headless_set_pad
uint32_t g_frames = 0;            // cuadros terminados (aurora_end_frame)
const AuroraEvent kNoEvents[1] = {{AURORA_NONE}};
}  // namespace

// ---- Para el programa de Node ----
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_headless_frames() { return g_frames; }

// Aprieta botones del mando de un puerto (valores PAD_BUTTON_* de GameCube) y mueve el stick (-128..127).
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_headless_set_pad(int port, int buttons, int stickX, int stickY)
{
    if (port < 0 || port > 3) return;
    g_pad[port].button = static_cast<u16>(buttons);
    g_pad[port].stickX = static_cast<s8>(stickX);
    g_pad[port].stickY = static_cast<s8>(stickY);
}

// ---- Arranque y cuadros ----
extern "C" AuroraInfo aurora_initialize(int, char*[], const AuroraConfig* config)
{
    std::printf("[aurora-headless] inicio sin pantalla (%ux%u pedidos)\n",
                config ? config->windowWidth : 0u, config ? config->windowHeight : 0u);
    for (int i = 0; i < 4; ++i) g_pad[i].err = i == 0 ? PAD_ERR_NONE : PAD_ERR_NO_CONTROLLER;
    AuroraInfo info{};
    info.backend = BACKEND_NULL;
    info.userPath = config ? config->userPath : nullptr;
    info.cachePath = config ? config->cachePath : nullptr;
    info.window = nullptr;
    info.windowSize = AuroraWindowSize{640, 528, 640, 528, 640, 528, 1.0f};  // ventana, framebuffer GX, nativo
    info.initializationStatus = AURORA_INITIALIZATION_SUCCESS;
    return info;
}

extern "C" const AuroraEvent* aurora_update() { return kNoEvents; }
extern "C" bool aurora_begin_frame() { return true; }
// Guarda la RAM entera de la Wii (MEM1 24 MB + MEM2 128 MB) en un archivo, para revisarla o compararla después.
static void VuelcaMemoria(const char* ruta)
{
    std::ofstream f(ruta, std::ios::binary);
    if (!f) { std::printf("[aurora-headless] no pude escribir %s\n", ruta); return; }
    f.write(reinterpret_cast<const char*>(Memory::GetPointer(Memory::kMem1CachedBase)), 24u * 1024u * 1024u);
    f.write(reinterpret_cast<const char*>(Memory::GetPointer(Memory::kMem2CachedBase)), Memory::kMem2Size);
    std::printf("[aurora-headless] volcado de memoria (MEM1 + MEM2, 152 MB) en %s\n", ruta);
}

extern "C" void aurora_end_frame()
{
    ++g_frames;
    // Cada 60 cuadros (1 s de juego): cuánto tardaron de verdad, para ver si alcanza los 60 fps, y cuánto de cada
    // cuadro fue trabajo (el resto el juego esperó al siguiente barrido de la tele: vi.cpp suma esas esperas).
    static double ultimo = emscripten_get_now();
    static double ultimaEspera = 0.0;
    if (g_frames % 60 == 0) {
        const double ahora = emscripten_get_now();
        const double trabajo = ((ahora - ultimo) - (g_mkwHostIdleMs - ultimaEspera)) / 60.0;
        std::printf("[aurora-headless] cuadro %u (%.1f fps, trabajo %.2f ms por cuadro de 16.67)\n",
                    g_frames, 60000.0 / (ahora - ultimo), trabajo);
        ultimo = ahora;
        ultimaEspera = g_mkwHostIdleMs;
    }
    // MKW_HEADLESS_FRAMES=N: terminar el programa después de N cuadros (para pruebas automáticas).
    static const long limite = [] {
        const char* v = std::getenv("MKW_HEADLESS_FRAMES");
        return v ? std::strtol(v, nullptr, 10) : 0L;
    }();
    if (limite > 0 && g_frames >= static_cast<uint32_t>(limite)) {
        std::printf("[aurora-headless] listo: %u cuadros\n", g_frames);
        // MKW_HEADLESS_DUMP=ruta: además, guardar la memoria del juego al terminar
        if (const char* ruta = std::getenv("MKW_HEADLESS_DUMP")) VuelcaMemoria(ruta);
        std::fflush(stdout);
        std::exit(0);
    }
}

// ---- GX: tamaño de texturas (fórmula real de aurora) ----
extern "C" u32 GXGetTexBufferSize(u16 width, u16 height, u32 fmt, GXBool mips, u8 maxLod)
{
    if (fmt == GX_TF_R8_PC || fmt == GX_TF_RGBA8_PC) {
        const u32 bytesPerPixel = fmt == GX_TF_R8_PC ? 1u : 4u;
        const u32 mipCount = mips ? static_cast<u32>(maxLod) + 1u : 1u;
        u64 byteCount = 0;
        for (u32 mip = 0; mip < mipCount; ++mip) {
            byteCount += static_cast<u64>(width) * height * bytesPerPixel;
            if (width == 1 && height == 1) break;
            width = width / 2 > 1 ? width / 2 : 1;
            height = height / 2 > 1 ? height / 2 : 1;
        }
        return static_cast<u32>(byteCount);
    }
    s32 shiftX = 0, shiftY = 0;
    switch (fmt) {
    case GX_TF_I4: case GX_TF_C4: case GX_TF_CMPR: case GX_CTF_R4: case GX_CTF_Z4:
        shiftX = 3; shiftY = 3; break;
    case GX_TF_I8: case GX_TF_IA4: case GX_TF_C8: case GX_TF_Z8: case GX_CTF_RA4: case GX_CTF_A8:
    case GX_CTF_R8: case GX_CTF_G8: case GX_CTF_B8: case GX_CTF_Z8M: case GX_CTF_Z8L:
        shiftX = 3; shiftY = 2; break;
    case GX_TF_IA8: case GX_TF_RGB565: case GX_TF_RGB5A3: case GX_TF_RGBA8: case GX_TF_C14X2:
    case GX_TF_Z16: case GX_TF_Z24X8: case GX_CTF_RA8: case GX_CTF_RG8: case GX_CTF_GB8: case GX_CTF_Z16L:
        shiftX = 2; shiftY = 2; break;
    default: break;
    }
    const u32 bitSize = fmt == GX_TF_RGBA8 || fmt == GX_TF_Z24X8 ? 64 : 32;
    u32 bufLen = 0;
    const u32 mipCount = mips ? static_cast<u32>(maxLod) + 1 : 1;
    for (u32 mip = 0; mip < mipCount; ++mip) {
        const u32 tileX = (width + (1 << shiftX) - 1) >> shiftX;
        const u32 tileY = (height + (1 << shiftY) - 1) >> shiftY;
        bufLen += bitSize * tileX * tileY;
        if (!mips || (width == 1 && height == 1)) break;
        width = width < 2 ? 1 : width / 2;
        height = height < 2 ? 1 : height / 2;
    }
    return bufLen;
}

// ---- GX: colas de comandos ----
extern "C" void GXInitFifoBase(GXFifoObj* fifo, void*, u32) { if (fifo) std::memset(fifo, 0, sizeof(*fifo)); }
extern "C" GXFifoObj* GXGetCPUFifo(void) { return &g_cpuFifo; }
extern "C" void GXSetCPUFifo(GXFifoObj* fifo) { if (fifo) g_cpuFifo = *fifo; }
extern "C" void GXSetGPFifo(GXFifoObj*) {}
extern "C" void GXSaveCPUFifo(GXFifoObj* fifo) { if (fifo) *fifo = g_cpuFifo; }

// Interna de aurora (lib/dolphin/gx/__gx.h, sin cabecera pública): recalcula registros de texturas.
extern "C" void __GXSetSUTexRegs() {}

// ---- Pantalla ----
extern "C" void AuroraGetSurfaceSize(u32* width, u32* height)
{
    if (width) *width = 640;
    if (height) *height = 528;
}

// ---- Mandos ----
extern "C" BOOL PADInit() { return TRUE; }
extern "C" u32 PADRead(PADStatus* status)
{
    if (status) std::memcpy(status, g_pad, sizeof(g_pad));
    return 0;
}
extern "C" u32 PADCount() { return 1; }
extern "C" s32 PADGetIndexForPort(u32 port) { return port == 0 ? 0 : -1; }
extern "C" const char* PADGetNameForControllerIndex(u32 idx) { return idx == 0 ? "Mando de prueba (Node)" : nullptr; }

// Lo dibuja la versión real de aurora; sin pantalla no hay nada que dibujar, pero hay que decir "hecho".
namespace aurora::gx::fifo {
bool submit_raw_draw(GXPrimitive, GXVtxFmt, const uint8_t*, uint16_t, uint32_t) { return true; }
}
