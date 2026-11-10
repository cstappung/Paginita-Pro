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

#if defined(__EMSCRIPTEN__)
#include <emscripten.h>
#else
// N1 (§153): el mismo «sin pantalla» compilado como programa de Windows (herramientas/compilar-nativo.py)
#include <chrono>
#define EMSCRIPTEN_KEEPALIVE
static double emscripten_get_now() {
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now().time_since_epoch()).count();
}
#endif

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <vector>

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

// ---- N13 (§165): el guion de botones y el tramo de la carrera, iguales en Node y en el programa de Windows ----
// MKW_HEADLESS_GUION="inicio+duración=máscara,…": del cuadro «inicio», durante «duración» cuadros, el mando del puerto 0
// tiene apretados los botones de «máscara» (hexadecimal, PAD_BUTTON_*: A = 100, B = 200, START = 1000; las que se pisan
// se suman). Ejemplo: "400+6=100,560+6=100" = apretar A dos veces. Así los dos programas recorren los mismos menús en los
// mismos cuadros y llegan a la misma carrera (sin página no hay la entrada directa por código de §73).
// MKW_HEADLESS_ESTADO=1: cada 60 cuadros, la sección y la página de arriba del juego, y la etapa y el cuadro de lógica
// de la carrera (para armar el guion). MKW_HEADLESS_TRAMO="600-2400": al pasar esos cuadros de lógica de la carrera
// (Raceinfo +0x20, desde la cuenta) se anotan la hora y las esperas, y se imprime el trabajo por cuadro de lógica.
namespace {
struct PasoGuion { uint32_t desde, hasta; uint16_t mascara; };
std::vector<PasoGuion> LeerGuion() {
    std::vector<PasoGuion> v;
    const char* g = std::getenv("MKW_HEADLESS_GUION");
    while (g && *g) {
        unsigned a = 0, d = 0, m = 0; int n = 0;
        if (std::sscanf(g, "%u+%u=%x%n", &a, &d, &m, &n) == 3) v.push_back({a, a + d, static_cast<uint16_t>(m)});
        const char* c = std::strchr(g, ',');
        g = c ? c + 1 : nullptr;
    }
    return v;
}
uint32_t LeerSeguro(uint32_t dir) { uint32_t v = 0; return dir && Memory::TryRead32(dir, v) ? v : 0; }
}  // namespace

static void GuionYTramo() {
    static const std::vector<PasoGuion> guion = LeerGuion();
    if (!guion.empty()) {
        uint16_t m = 0;
        for (const auto& p : guion) if (g_frames >= p.desde && g_frames < p.hasta) m |= p.mascara;
        g_pad[0].button = m;
    }
    // la carrera: Raceinfo (0x809BD730) +0x28 = etapa (0 presentación, 1 cuenta, 2 carrera, 3+ fin), +0x20 = cuadros desde la cuenta
    const uint32_t ri = LeerSeguro(0x809BD730);
    const uint32_t etapa = ri ? LeerSeguro(ri + 0x28) : 0xFFFFFFFFu, logica = ri ? LeerSeguro(ri + 0x20) : 0;
    static const bool estado = std::getenv("MKW_HEADLESS_ESTADO") != nullptr;
    if (estado && g_frames % 60 == 0) {
        const uint32_t sm = LeerSeguro(0x809C1E38), sec = sm ? LeerSeguro(sm) : 0;
        const uint32_t n = sec ? LeerSeguro(sec + 0x37C) : 0, pag = n && n < 16 ? LeerSeguro(sec + 0x354 + 4 * (n - 1)) : 0;
        // (W4, §198: y la pista de la ficha de la carrera, Racedata 0x809BD728 +0x20 +0xB48: a qué pista llegó el guion)
        const uint32_t rd = LeerSeguro(0x809BD728);
        std::printf("[aurora-headless] estado cuadro %u: seccion 0x%x pagina 0x%x etapa %d logica %u pista 0x%x\n", g_frames,
                    sec ? LeerSeguro(sec) : 0xFFFFFFFFu, pag ? LeerSeguro(pag + 4) : 0xFFFFFFFFu, static_cast<int>(etapa), logica,
                    rd ? LeerSeguro(rd + 0x20 + 0xB48) : 0xFFFFFFFFu);
    }
    static unsigned desde = 0, hasta = 0;
    static const bool hayTramo = [] { const char* t = std::getenv("MKW_HEADLESS_TRAMO"); return t && std::sscanf(t, "%u-%u", &desde, &hasta) == 2 && hasta > desde; }();
    static double t0 = -1.0, e0 = 0.0; static uint32_t l0 = 0, f0 = 0; static bool listo = false;
    if (!hayTramo || listo || !ri || etapa > 2) return;
    if (t0 < 0.0 && logica >= desde) { t0 = emscripten_get_now(); e0 = g_mkwHostIdleMs; l0 = logica; f0 = g_frames;
        std::printf("[aurora-headless] tramo empieza: logica %u cuadro %u\n", logica, g_frames); }
    else if (t0 >= 0.0 && logica >= hasta) {
        listo = true;
        const double pared = emscripten_get_now() - t0, espera = g_mkwHostIdleMs - e0; const uint32_t n = logica - l0;
        std::printf("[aurora-headless] tramo %u-%u: %u cuadros de logica en %u cuadros, pared %.1f ms, espera %.1f ms, trabajo %.3f ms por cuadro de logica\n",
                    l0, logica, n, g_frames - f0, pared, espera, (pared - espera) / n);
        std::fflush(stdout);
    }
}

extern "C" void aurora_end_frame()
{
    ++g_frames;
    GuionYTramo();
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
#if defined(__EMSCRIPTEN__)
        std::exit(0);
#else
        // §165: en Windows std::exit desde una fibra del juego terminaba en «std::terminate() without current exception»
        // (un cartel de error que esperaba un clic): salir sin destructores, ya con todo escrito
        std::_Exit(0);
#endif
    }
}

// ---- Bajar copias de textura a la memoria del juego (§85, los Mii invitados): sin tarjeta de video no hay qué bajar ----
extern "C" bool aurora_flush_efb_copy_to_ram(void*) { return false; }
extern "C" bool aurora_flush_efb_copies_to_ram() { return false; }

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
