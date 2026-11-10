// W10 de la etapa 1 del plan v4 (bitácora §207): el dibujo en otro Worker. Primera parte: lo que gana y lo que cuesta
// del lado de la carrera, antes de escribir el Worker del dibujo.
//
// Resumen. W10 quiere que el Worker de la carrera («A») no dibuje: al final de cada cuadro junta lo que cambió en la
// memoria de la Wii y lo manda en una caja al Worker del dibujo («B»), que lo pega en su copia y dibuja. Eso vale la
// pena solo si (1) lo que A se ahorra al no dibujar es grande (el «techo») y (2) juntar y mandar la caja cuesta poco.
// Este archivo mide las dos cosas en el juego de verdad, con la carrera andando:
//   - modo 1 (techo): EGG::SceneManager::draw (0x8023AEAC) no corre; solo lo que la lógica sí lee del dibujo,
//     ScnMgr::SwitchScnRoot (con las mismas condiciones que DrawMain, como R2 §192). La imagen queda vacía: solo medir.
//   - modo 2: el techo + juntar la caja: las páginas de 4 KiB que el juego marcó al escribir (g_mkwSucias, la marca
//     de MKW_SUCIAS en memory_access.h) se comparan de a 8 bytes con una copia «sombra» y lo distinto va a la caja en
//     tramos [dirección, largo, bytes]. Es lo que B necesitaría para quedar igual a A.
//   - modo 3: el modo 2 + la caja sale de la memoria del programa a un Worker de mentira (Module.mkwW10Caja, w10.mjs),
//     que la pega en su copia. Sin memoria compartida esa copia es inevitable: es el costo completo del lado de A.
//   - modos 5, 6 y 7: los modos 1, 2 y 3 sin presentar: además no corre EGG::XfbManager::copyEFB (0x80244268, la copia
//     de la imagen a la pantalla con GXCopyDisp), así el runtime no presenta nada, como el Worker de la carrera de W10
//     (presenta el del dibujo). Sin esto, con la imagen vacía cada cuadro se presentaba y la espera de la presentación
//     marcaba el paso (§207: 45 % del hilo esperando).
//   - modo 4: el modo 2 + comprobar la marca: además compara la memoria entera con la sombra en cada cuadro y cuenta
//     lo que cambió SIN marca (lo que se le escaparía a B). Caro: solo para probar, nunca para medir.
// Como medir un motor en el banco con la carga desconectada (el techo) y después con la caja de cambios puesta.
// Solo en un programa aparte: MKW_W10_COMPILAR=1 python herramientas/compilar-web.py … (pone -DMKW_SUCIAS en todo el
// juego); la página lo prende solo con la carrera andando (?w10=N, mkw.mjs). En los menús el dibujo NO es un sumidero
// (§196): ahí siempre dibuja.
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>
#include <emscripten/console.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>

extern "C" {
uint8_t g_mkwSucias[1u << 20];   // un byte por página de 4 KiB de las direcciones de la Wii (lo escribe MKW_SUCIA)
void mkw_sucias_rango(uint32_t desde, uint32_t largo) {
    if (!largo) return;
    for (uint32_t p = desde >> 12, f = (desde + largo - 1u) >> 12; p <= f; p++) g_mkwSucias[p] = 1;
}
void w10_mandar_espera(const uint8_t* p, uint32_t n, double cuadro, int fin);   // (EM_ASYNC_JS, más abajo)
}

namespace {
constexpr uint32_t kPagina = 4096;
constexpr uint32_t kMem1 = 24u << 20, kMem2 = 128u << 20;   // MEM2: los 128 MiB que reserva el runtime (§196: arriba
constexpr uint32_t kPag1 = kMem1 / kPagina, kPaginas = (kMem1 + kMem2) / kPagina;   // de 64 hay páginas usadas)
// la página p de la foto (MEM1 y después MEM2) y sus dos direcciones en la Wii: con caché (0x8…/0x9…) y sin (0xC…/0xD…)
uint32_t guestDe(uint32_t p) { return p < kPag1 ? 0x80000000u + p * kPagina : 0x90000000u + (p - kPag1) * kPagina; }
bool marcada(uint32_t p) {
    const uint32_t g = guestDe(p) >> 12;
    return g_mkwSucias[g] | g_mkwSucias[g + (0x40000000u >> 12)];
}
void reponer() {   // borrar las marcas de las cuatro ventanas (MEM1 y MEM2, con y sin caché): ~80 KB
    std::memset(&g_mkwSucias[0x80000000u >> 12], 0, kMem1 / kPagina);
    std::memset(&g_mkwSucias[0xC0000000u >> 12], 0, kMem1 / kPagina);
    std::memset(&g_mkwSucias[0x90000000u >> 12], 0, kMem2 / kPagina);
    std::memset(&g_mkwSucias[0xD0000000u >> 12], 0, kMem2 / kPagina);
}

int g_modo = 0;          // lo que pidió la página (0–10)
int g_base = 0;          // 1, 2, 3 o 4 (el modo sin lo de presentar)
bool g_sinPresentar = false;
// la parte B (§207.4): 8 = soy el Worker del dibujo (pego la caja en vez de calcular); 9 = soy el de la carrera de
// verdad (sin dibujo ni presentar; la caja va al Worker del dibujo, esperando caja libre, con la foto entera primero);
// 10 = el de la carrera que además dibuja (para comprobar: la caja lleva solo lo de la lógica)
bool g_dibujante = false, g_enlace = false, g_verifica = false;
std::vector<uint8_t*> g_host;        // página → su lugar en la memoria del PC (nullptr = no existe)
std::vector<uint8_t> g_sombra;       // lo que B ya tiene (la memoria como quedó en la última caja)
std::vector<uint8_t> g_caja;         // la caja del cuadro: tramos [dirección u32][largo u32][bytes], alineados a 4
bool g_conSombra = false;
uint32_t g_errores = 0;
int g_faseB = 0;   // (diagnóstico §240, B en su bucle: 1 dibujando, 2 copiando a la pantalla, 3 pegando o esperando caja)

struct Cuenta {
    double cuadros = 0, saltados = 0, switches = 0, hechos = 0, paginas = 0, paginasMax = 0, bytes = 0, bytesMax = 0, tramos = 0,
           msJuntar = 0, msJuntarMax = 0, msMandar = 0, sinMarca = 0, sinMarcaPag = 0, fotoEntera = 0, msFoto = 0, sinCopia = 0;
    uint32_t primeraSinMarca = 0;
} g_c;

bool preparar() {
    if (!g_host.empty()) return true;
    g_host.assign(kPaginas, nullptr);
    for (uint32_t p = 0; p < kPaginas; p++)
        if (Memory::Contains(guestDe(p), 1)) g_host[p] = Memory::GetPointer(guestDe(p));   // (§196: de a una página)
    g_sombra.assign(static_cast<size_t>(kPaginas) * kPagina, 0);
    g_caja.reserve(16u << 20);
    return true;
}

// la primera vez con la carrera andando: la sombra toma la memoria entera (eso iría una vez a B, «la foto entera»)
void fotoEntera() {
    const double t0 = emscripten_get_now();
    for (uint32_t p = 0; p < kPaginas; p++)
        if (g_host[p]) std::memcpy(&g_sombra[static_cast<size_t>(p) * kPagina], g_host[p], kPagina);
    reponer();
    g_conSombra = true;
    g_c.fotoEntera++; g_c.msFoto += emscripten_get_now() - t0;
}

// la foto entera al Worker del dibujo, en cajas de 1024 páginas (4 MiB) de tramos de una página; después una caja vacía
// con el fin del cuadro
void mandarFotoEntera() {
    const double t0 = emscripten_get_now();
    g_caja.clear();
    for (uint32_t p = 0; p < kPaginas; p++) {
        if (!g_host[p]) continue;
        const uint32_t dir = guestDe(p), largo = kPagina;
        const size_t n = g_caja.size();
        g_caja.resize(n + 8 + largo);
        std::memcpy(&g_caja[n], &dir, 4); std::memcpy(&g_caja[n + 4], &largo, 4);
        std::memcpy(&g_caja[n + 8], &g_sombra[static_cast<size_t>(p) * kPagina], largo);
        if (g_caja.size() >= (4u << 20)) {
            w10_mandar_espera(g_caja.data(), static_cast<uint32_t>(g_caja.size()), -1, 0);
            g_caja.clear();
        }
    }
    w10_mandar_espera(g_caja.data(), static_cast<uint32_t>(g_caja.size()), -1, 0);
    g_caja.clear();
    w10_mandar_espera(g_caja.data(), 0, -1, 1);
    g_c.msFoto += emscripten_get_now() - t0;
}

// (modo 10) lo que escribió el dibujo de este Worker pasa a la sombra: así la caja siguiente lleva solo lo de la lógica
// (el Worker del dibujo tiene lo suyo, escrito por su propio dibujo)
void absorberDibujo() {
    for (uint32_t p = 0; p < kPaginas; p++)
        if (g_host[p] && marcada(p)) std::memcpy(&g_sombra[static_cast<size_t>(p) * kPagina], g_host[p], kPagina);
    reponer();
}

// una página: lo distinto contra la sombra, de a 8 bytes, a la caja en tramos (dos palabras iguales seguidas cortan)
uint32_t compararPagina(uint32_t p) {
    uint8_t* h = g_host[p];
    uint8_t* s = &g_sombra[static_cast<size_t>(p) * kPagina];
    const uint64_t* x = reinterpret_cast<const uint64_t*>(h);
    uint64_t* y = reinterpret_cast<uint64_t*>(s);
    uint32_t bytes = 0;
    for (uint32_t i = 0; i < kPagina / 8;) {
        if (x[i] == y[i]) { i++; continue; }
        uint32_t f = i + 1;
        while (f < kPagina / 8 && (x[f] != y[f] || (f + 1 < kPagina / 8 && x[f + 1] != y[f + 1]))) f++;
        const uint32_t dir = guestDe(p) + i * 8, largo = (f - i) * 8;
        const size_t n = g_caja.size();
        g_caja.resize(n + 8 + largo);
        std::memcpy(&g_caja[n], &dir, 4); std::memcpy(&g_caja[n + 4], &largo, 4);
        std::memcpy(&g_caja[n + 8], h + i * 8, largo);
        std::memcpy(s + i * 8, h + i * 8, largo);
        bytes += largo; g_c.tramos++;
        i = f;
    }
    return bytes;
}

EM_JS(void, w10_mandar, (const uint8_t* p, uint32_t n, double cuadro), {
    if (Module.mkwW10Caja) Module.mkwW10Caja(p, n, cuadro);
});
// (la parte B: mandar al Worker del dibujo esperando caja libre: la contrapresión frena a la carrera si el dibujo se
// atrasa; fin = 1 en la última caja de cada cuadro)
EM_ASYNC_JS(void, w10_mandar_espera, (const uint8_t* p, uint32_t n, double cuadro, int fin), {
    if (Module.mkwW10CajaEspera) await Module.mkwW10CajaEspera(p, n, cuadro, fin);
});
// (el Worker del dibujo: pegar las cajas que lleguen hasta la del fin del cuadro; espera si no hay)
EM_ASYNC_JS(int, w10_pegar_js, (), {
    return Module.mkwW10Pegar ? await Module.mkwW10Pegar() : 0;
});

void juntarCaja() {
    const double t0 = emscripten_get_now();
    g_caja.clear();
    uint32_t paginas = 0, bytes = 0;
    for (uint32_t p = 0; p < kPaginas; p++) {
        if (!g_host[p] || !marcada(p)) continue;
        paginas++;
        bytes += compararPagina(p);
    }
    reponer();
    if (g_base == 4) {   // lo que cambió sin marca: la memoria entera contra la sombra
        for (uint32_t p = 0; p < kPaginas; p++) {
            if (!g_host[p]) continue;
            const size_t antes = g_caja.size();
            const uint32_t b = compararPagina(p);
            if (!b) continue;
            g_c.sinMarca += b; g_c.sinMarcaPag++;
            if (!g_c.primeraSinMarca) g_c.primeraSinMarca = guestDe(p);
            if (g_c.sinMarcaPag <= 12)
                std::printf("[w10] sin marca: página %08x, %u bytes (primer tramo en %08x)\n", guestDe(p), b,
                            *reinterpret_cast<uint32_t*>(&g_caja[antes]));
        }
    }
    const double ms = emscripten_get_now() - t0;
    g_c.msJuntar += ms; if (ms > g_c.msJuntarMax) g_c.msJuntarMax = ms;
    g_c.paginas += paginas; if (paginas > g_c.paginasMax) g_c.paginasMax = paginas;
    g_c.bytes += bytes; if (bytes > g_c.bytesMax) g_c.bytesMax = bytes;
    if (g_base == 3 || g_enlace) {
        const double t1 = emscripten_get_now();
        if (g_enlace) w10_mandar_espera(g_caja.data(), static_cast<uint32_t>(g_caja.size()), g_c.cuadros, 1);
        else w10_mandar(g_caja.data(), static_cast<uint32_t>(g_caja.size()), g_c.cuadros);
        g_c.msMandar += emscripten_get_now() - t1;
    }
}
}  // namespace

extern "C" int g_mkwW10SoloPropios;   // (os_thread.cpp del runtime, con MKW_SUCIAS)
extern "C" int g_mkwW10Traza;        // (gx_copy.cpp del runtime: las marcas de la copia a la pantalla, §240)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_w10_modo(int m) {
    g_modo = m >= 0 && m <= 10 ? m : 0;
    g_base = g_modo >= 5 && g_modo <= 7 ? g_modo - 4 : g_modo <= 4 ? g_modo : g_modo == 8 ? 0 : 2;
    g_sinPresentar = (g_modo >= 5 && g_modo <= 7) || g_modo == 9;
    g_dibujante = g_modo == 8;
    g_mkwW10SoloPropios = g_dibujante;   // (B: los hilos de A sin fibra aquí no entran a las colas de listos, §207.5)
    g_enlace = g_modo == 9 || g_modo == 10;
    g_verifica = g_modo == 10;
    g_conSombra = false;   // al volver a prender, otra foto entera
}
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_w10_reiniciar() { g_c = Cuenta{}; }
// 0 cuadros, 1 saltados, 2 SwitchScnRoot, 3 páginas (suma), 4 máx, 5 bytes (suma), 6 máx, 7 tramos, 8 ms juntar (suma),
// 9 máx, 10 ms mandar (suma), 11 bytes sin marca, 12 páginas sin marca, 13 fotos enteras, 14 ms foto, 15 modo,
// 16 primera página sin marca, 17 errores, 18 copias a la pantalla saltadas
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_w10_dato(int i) {
    const double v[] = {g_c.cuadros, g_c.saltados, g_c.switches, g_c.paginas, g_c.paginasMax, g_c.bytes, g_c.bytesMax,
                        g_c.tramos, g_c.msJuntar, g_c.msJuntarMax, g_c.msMandar, g_c.sinMarca, g_c.sinMarcaPag,
                        g_c.fotoEntera, g_c.msFoto, static_cast<double>(g_modo),
                        static_cast<double>(g_c.primeraSinMarca), static_cast<double>(g_errores), g_c.sinCopia,
                        static_cast<double>(g_faseB)};
    return i >= 0 && i < 20 ? v[i] : -1;
}

extern "C" void func_8023AEAC_traducida(CpuContext* ctx);   // EGG::SceneManager::draw
extern "C" void func_805635E4(CpuContext* ctx);             // ScnMgr::SwitchScnRoot
extern "C" void func_80562520(CpuContext* ctx);             // ScnMgr::DoneDraw
int g_hechoA = 1;
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_w10_hecho(int s) { g_hechoA = s; }
extern "C" void func_8023AEAC(CpuContext* ctx) {
    if (g_modo <= 0 || g_dibujante) { func_8023AEAC_traducida(ctx); return; }
    preparar();
    g_c.cuadros++;
    if (g_base >= 2) {
        if (!g_conSombra) { fotoEntera(); if (g_enlace) mandarFotoEntera(); }
        else juntarCaja();
    }
    if (g_verifica) {   // (modo 10: este Worker dibuja igual; lo que escribe su dibujo no va en la caja)
        func_8023AEAC_traducida(ctx);
        absorberDibujo();
        return;
    }
    // lo que la lógica lee del dibujo (lo mismo que DrawMain al final, §192): si el ScnMgr (0x809C1830) no está en pausa
    // de dibujo (+0x44 bit 1), tiene su raíz (+0x20) y pide cambiarla (+0x44 bit 0): SwitchScnRoot(raíz, 1)
    const uint32_t g = 0x809C1830u, banderas = Memory::Read32(g + 0x44), raiz = Memory::Read32(g + 0x20);
    // (§240) antes, lo que DrawMain hace al terminar de dibujar: ScnMgr::DoneDraw(raíz) (0x80562520) pone en cero las
    // marcas de «dibujado» de la raíz (EGG::ScnRootEx::DoneDraw); sin eso la lógica de A, que nunca dibuja, ve la escena
    // como «sin terminar» y B recibía media escena (la 3D en negro). ?w10Hecho=0 = sin esto (solo para comparar)
    if (g_hechoA && !(banderas & 2) && raiz) {
        const uint32_t lr = ctx->lr, r3 = ctx->gpr[3];
        ctx->gpr[3] = raiz;
        func_80562520(ctx);
        ctx->lr = lr; ctx->gpr[3] = r3;
        g_c.hechos++;
    }
    if (!(banderas & 2) && raiz && (banderas & 1)) {
        const uint32_t lr = ctx->lr, r3 = ctx->gpr[3], r4 = ctx->gpr[4];
        ctx->gpr[3] = raiz; ctx->gpr[4] = 1;
        func_805635E4(ctx);
        ctx->lr = lr; ctx->gpr[3] = r3; ctx->gpr[4] = r4;
        g_c.switches++;
        // (§240) lo que escribe SwitchScnRoot NO va en la caja: B lo hace igual al final de su propio dibujo (DrawMain).
        // Si iba, B cambiaba de raíz dos veces y dibujaba la otra (la 3D en negro a ratos; en el modo 10 no pasaba
        // porque ahí el cambio de raíz es parte del dibujo de A, que se absorbe)
    }
    if (g_base >= 2 && g_conSombra) absorberDibujo();   // (lo de DoneDraw y SwitchScnRoot no va en la caja)
    g_c.saltados++;
    // un informe cada 600 cuadros a la consola (medir-sitio lo guarda en su .log; la nota de la página sale al terminar)
    if (static_cast<uint32_t>(g_c.cuadros) % 600 == 0) {
        const double nj = g_c.cuadros - g_c.fotoEntera > 0 ? g_c.cuadros - g_c.fotoEntera : 1;
        std::printf("[w10] modo %d, %.0f cuadros sin dibujo: %.1f páginas por cuadro (máx %.0f), %.1f KB (máx %.0f), "
                    "juntar %.3f ms (máx %.2f), mandar %.3f ms, foto entera %.1f ms; sin marca %.0f páginas %.0f B\n",
                    g_modo, g_c.cuadros, g_c.paginas / nj, g_c.paginasMax, g_c.bytes / nj / 1024, g_c.bytesMax / 1024,
                    g_c.msJuntar / nj, g_c.msJuntarMax, g_c.msMandar / nj,
                    g_c.fotoEntera ? g_c.msFoto / g_c.fotoEntera : 0, g_c.sinMarcaPag, g_c.sinMarca);
    }
}

extern "C" void func_80244268_traducida(CpuContext* ctx);   // EGG::XfbManager::copyEFB (GXCopyDisp y el giro de los XFB)
namespace {
// (B, §240) el bucle propio del dibujante: los registros de la última copia a la pantalla que hizo el juego en B antes
// de entrar al bucle (this del XfbManager y sus argumentos), para llamarla igual en cada vuelta
bool g_bucleB = true, g_enBucle = false, g_hayCopia = false;
int g_trazaDesde = 0;   // (§240: las marcas a la consola desde ese cuadro de B; 0 = nunca: ?w10Traza=N, solo diagnóstico)
uint32_t g_copiaGpr[8];
PPC_FPR g_copiaFpr[8];
}
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_w10_bucle(int s) { g_bucleB = s != 0; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_w10_traza(int desde) { g_trazaDesde = desde; }
extern "C" double g_mkwW10Cuenta[2];   // (gx_copy.cpp del runtime con MKW_SUCIAS: listas de dibujo y GXBegin)
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_w10_cuenta(int i) { return i == 0 || i == 1 ? g_mkwW10Cuenta[i] : -1; }
void deshacerMarcadas(bool soloTocadas = false, bool paginaEntera = false);
bool w10_deshacer_todo();
bool w10_pagina_entera();
void w10_acumular();
void w10_empezar_todo();
extern "C" void func_80244268(CpuContext* ctx) {
    if (g_dibujante && !g_enBucle) {   // (B antes del bucle: anotar con qué la llama el juego)
        std::memcpy(g_copiaGpr, &ctx->gpr[3], sizeof g_copiaGpr);
        std::memcpy(g_copiaFpr, &ctx->fpr[1], sizeof g_copiaFpr);
        g_hayCopia = true;
    }
    if (!g_sinPresentar) { func_80244268_traducida(ctx); return; }
    g_c.sinCopia++;
}

// la parte B: el Worker del dibujo no calcula: pega las cajas del Worker de la carrera (EGG::SceneManager::calc, 0x8023AE60:
// calcCurrentScene y calcCurrentFader) y deja que el bucle del juego dibuje y presente lo pegado
extern "C" void func_8023AE60_traducida(CpuContext* ctx);
extern "C" void func_8023AE60(CpuContext* ctx) {
    if (!g_dibujante) { func_8023AE60_traducida(ctx); return; }
    preparar();
    g_c.cuadros++;
    const double t0 = emscripten_get_now();
    g_c.tramos += w10_pegar_js();
    g_c.msJuntar += emscripten_get_now() - t0;   // (en B: lo que esperó y pegó)
    if (!g_bucleB || !g_hayCopia) return;   // (sin el bucle: el de §207.4, el bucle entero del juego)
    // §240: el bucle propio de B. Desde aquí B nunca vuelve al bucle del juego: no pasa por el planificador ni por
    // VIWaitForRetrace ni por otros hilos (lo que lo dejó quieto en la 3.ª vuelta). Cada vuelta: dibujar lo pegado
    // (EGG::SceneManager::draw, el mismo this que calc), copiarlo a la pantalla y presentar (copyEFB → GXCopyDisp →
    // VI_HLE_PresentFrame, que espera el retrazado) y pegar la caja siguiente. Como un tablero esclavo que ya no lee
    // su propio reloj de control: solo repite lo que le llega por el bus.
    g_enBucle = true;
    const uint32_t escena = ctx->gpr[3], lr = ctx->lr;
    for (;;) {
        ctx->gpr[3] = escena;
        if (g_trazaDesde && g_c.cuadros >= g_trazaDesde) { g_mkwW10Traza = 1; emscripten_console_log("[w10m] B: dibujar"); }
        g_faseB = 1;
        const bool todo = w10_deshacer_todo();
        if (todo) w10_empezar_todo();
        func_8023AEAC_traducida(ctx);
        std::memcpy(&ctx->gpr[3], g_copiaGpr, sizeof g_copiaGpr);
        std::memcpy(&ctx->fpr[1], g_copiaFpr, sizeof g_copiaFpr);
        if (g_mkwW10Traza) emscripten_console_log("[w10m] B: copiar");
        g_faseB = 2;
        func_80244268_traducida(ctx);
        ctx->lr = lr;
        if (todo) { w10_acumular(); deshacerMarcadas(true, w10_pagina_entera()); }
        g_faseB = 3;
        if (g_mkwW10Traza) emscripten_console_log("[w10m] B: pegar");
        g_c.cuadros++;
        const double t1 = emscripten_get_now();
        g_c.tramos += w10_pegar_js();
        g_c.msJuntar += emscripten_get_now() - t1;
        if (static_cast<uint32_t>(g_c.cuadros) % 600 == 0)
            std::printf("[w10] B en su bucle: %.0f cuadros, pegar+esperar %.3f ms por cuadro\n", g_c.cuadros,
                        g_c.msJuntar / g_c.cuadros);
    }
}
// (B) lo que B NO pega: la ficha de cada hilo de la Wii (OSThread, 0x318 bytes) y su pila (+0x308 fin … +0x304 base).
// Cada hilo es una fibra del runtime parada en su propio punto: si B recibe la pila de A, al volver de una función la
// fibra de B recupera registros guardados que son de A y el programa cae («unreachable»). Como no conectar dos
// tableros por sus bobinas de enclavamiento: cada uno conserva su propio estado de relés.
// mkw_w10_hilos() arma la lista (la cola de hilos 0x800000DC, enlace +0x2FC, y el hilo actual 0x800000E4) y devuelve
// cuántos rangos; mkw_w10_rango(i) = el inicio (par) o el fin (impar) del rango i/2, direcciones de la Wii.
namespace { std::vector<uint32_t> g_rangos; }
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_w10_hilos() {
    g_rangos.clear();
    auto agregar = [](uint32_t t) {
        if (!t) return;
        for (size_t i = 0; i < g_rangos.size(); i += 4) if (g_rangos[i] == t) return;
        const uint32_t base = Memory::Read32(t + 0x304), fin = Memory::Read32(t + 0x308);
        g_rangos.push_back(t); g_rangos.push_back(t + 0x318);
        if (fin < base && base - fin <= (4u << 20)) { g_rangos.push_back(fin); g_rangos.push_back(base); }
        else { g_rangos.push_back(t); g_rangos.push_back(t); }   // (sin pila conocida: un rango vacío)
    };
    // el planificador de B también es de B (§207.5: con la cola de A, B quiso correr un hilo de carga que en B ya no
    // existía, «no fiber for 0x909266e8»): las variables del SO en la memoria baja (contextos, lista y hilo actual),
    // los hilos por omisión y ocioso, las 32 colas de listos, la cola de alarmas y las marcas del planificador
    // (direcciones de os_internal.h del runtime)
    const uint32_t fijos[][2] = {{0x800000C0u, 0x800000F0u}, {0x80347498u, 0x803477B0u + 0x100u},
                                 {0x803478B0u, 0x803478B0u + 0x318u}, {0x80385AE0u, 0x80385AE4u},
                                 {0x803868A0u, 0x803868A8u}, {0x80386918u, 0x80386924u}};
    for (const auto& f : fijos) { g_rangos.push_back(f[0]); g_rangos.push_back(f[1]); g_rangos.push_back(0); g_rangos.push_back(0); }
    // §240, lo que el contador de choques (?w10Choques=1) encontró pisado en cada cuadro con A sin dibujar: el estado
    // «de hardware» de cada copia y una pila que la lista de hilos no cubre. B lo conserva propio:
    //   - el final de las variables globales del programa, 0x80398000 hasta mem1ArenaLo (0x80399180): marcos de pila
    //     (direcciones de vuelta como 0x801267A4 y la cadena de marcos); A los pisaba justo antes de que B se colgara;
    //   - el video (VI) de 0x80386B80 a 0x80386C00 (la cuenta de retrazados, kViRetraceCountAddr, y su cola);
    //   - la fila de búferes del sonido (AI) de 0x80386480 a 0x80386520, y la marca de «dibujo terminado» de GX
    //     (kGxDrawDoneFlagAddr, 0x803867D8) y 0x802ED1EC (B pone 4 al dibujar, A 0).
    const uint32_t propiosB[][2] = {{0x80398000u, 0x80399180u}, {0x80386B80u, 0x80386C00u}, {0x80386480u, 0x80386520u},
                                    {0x803867D8u, 0x803867DCu}, {0x802ED1E8u, 0x802ED1F0u}};
    for (const auto& f : propiosB) { g_rangos.push_back(f[0]); g_rangos.push_back(f[1]); g_rangos.push_back(0); g_rangos.push_back(0); }
    uint32_t t = Memory::Read32(0x800000DCu);
    // §240: con B en su propio bucle, sus otros hilos ya no corren nunca (B no suelta el procesador ni atiende alarmas):
    // sus pilas se pegan como cualquier memoria. Solo el hilo que corre el bucle (el actual) conserva ficha y pila.
    // Algunas listas del juego enlazan objetos que viven en pilas de otros hilos: con esas pilas viejas, B mezclaba
    // eslabones de A con los suyos y la cadena se cerraba en círculo (el bucle sin fin después de dibujar los modelos).
    if (!g_enBucle)
        for (int n = 0; t && n < 64; n++) { agregar(t); t = Memory::Read32(t + 0x2FC); }
    agregar(Memory::Read32(0x800000E4u));
    // §240: la fila de las imágenes (EGG::XfbManager, el this de copyEFB que B anotó) también es de B. Su cola vive en
    // +4 (las libres, enlazadas por +8 de cada Xfb), +8 (la copiada) y +12 (la que se muestra); el aviso del retrazado
    // de A suelta imágenes que A nunca copió (A no presenta), y pegadas en B le desordenan la fila: copyEFB de B daba
    // vueltas para siempre esperando una libre (cuadro de lógica ~250 con A sin dibujar). Cada uno lleva su propia
    // cuenta de qué búfer está ocupado, como dos tableros con su propio registro de cargas.
    if (g_dibujante && g_hayCopia) {
        const uint32_t xm = g_copiaGpr[0];
        auto par = [](uint32_t a, uint32_t b) { g_rangos.push_back(a); g_rangos.push_back(b); g_rangos.push_back(0); g_rangos.push_back(0); };
        par(xm, xm + 0x20);
        uint32_t x = Memory::Read32(xm + 4);
        for (int n = 0; x && n < 8; n++) { par(x, x + 0x10); x = Memory::Read32(x + 8); }
        for (uint32_t o : {8u, 12u}) if (const uint32_t y = Memory::Read32(xm + o)) par(y, y + 0x10);
    }
    return static_cast<int>(g_rangos.size() / 2);
}
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_w10_rango(int i) {
    return i >= 0 && static_cast<size_t>(i) < g_rangos.size() ? g_rangos[i] : 0;
}
// dónde está en la memoria del programa la página p de la foto (MEM1 y después MEM2): la página de JavaScript pega ahí
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_w10_host(uint32_t p) {
    preparar();
    return p < kPaginas ? static_cast<uint32_t>(reinterpret_cast<uintptr_t>(g_host[p])) : 0;
}

// ---------- W11 (§209): las pruebas de «saltar» de lo que solo se ve, del lado de calcular ----------
// Con la carrera andando, mkw_w11_saltar(máscara) deja de correr (como R2, §192, pero cada sistema por separado):
//   1 = calcular los efectos (Effects::Mgr::Update, 0x8067CB88, la última llamada de RaceScene::UpdateRaceInstances);
//   2 = decidir qué suena (EGG::SimpleAudioMgr::Calc, 0x802135D0: el gestor de sonido del juego, una vez por cuadro);
//   4 = el hilo de sonido del juego (nw4r::snd::detail::SoundThread::FrameProcess, 0x800A4AF0: actualizar las voces).
// Si la huella de la sala y el fantasma no cambian con uno saltado, la carrera no lo lee y se podría mover a B.
// Como sacar un fusible por vez y ver si el tablero principal sigue marcando lo mismo.
namespace {
int g_w11 = 0;
double g_w11Saltos[3] = {0, 0, 0};
}
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_w11_saltar(int m) { g_w11 = m; }
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_w11_dato(int i) { return i >= 0 && i < 3 ? g_w11Saltos[i] : g_w11; }
extern "C" void func_8067CB88_traducida(CpuContext* ctx);   // Effects::Mgr::Update
extern "C" void func_8067CB88(CpuContext* ctx) {
    if (g_w11 & 1) { g_w11Saltos[0]++; return; }
    func_8067CB88_traducida(ctx);
}
extern "C" void func_802135D0_traducida(CpuContext* ctx);   // EGG::SimpleAudioMgr::Calc
extern "C" void func_802135D0(CpuContext* ctx) {
    if (g_w11 & 2) { g_w11Saltos[1]++; return; }
    func_802135D0_traducida(ctx);
}
extern "C" void func_800A4AF0_traducida(CpuContext* ctx);   // nw4r::snd::detail::SoundThread::FrameProcess
extern "C" void func_800A4AF0(CpuContext* ctx) {
    if (g_w11 & 4) { g_w11Saltos[2]++; return; }
    func_800A4AF0_traducida(ctx);
}

// §240: el dibujo de los efectos (nw4r::ef, llamado desde aquí) en B. El perfilador de V8 mostró a B dando vueltas para
// siempre en func_80225354, que recorre las listas enlazadas de efectos → emisores → partículas (nw4r::ut::List, el
// «siguiente» de 0x800AF180), con A sin dibujar. mkw_w10_sin_efectos(1) = B no dibuja los efectos (solo para probar).
namespace { int g_sinEfectosB = 0; double g_efectosSaltados = 0; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_w10_sin_efectos(int s) { g_sinEfectosB = s; }
extern "C" void func_8067CF74_traducida(CpuContext* ctx);
// El arreglo (§240): lo que el dibujo de los efectos escribe en B no queda de un cuadro al siguiente. g_sombraB = lo último
// que B recibió de A en cada byte (la escribe w10.mjs al pegar, índice = lugar de lugarDe). Antes del dibujo de los efectos
// se borran las marcas de páginas; al volver, las páginas que ese dibujo marcó vuelven a la sombra (salvo la pila del hilo
// que corre el bucle y los rangos propios de B, que no se tocan). Cada cuadro los efectos se dibujan sobre el estado de A.
namespace { std::vector<uint8_t> g_sombraB; int g_deshacerEfectos = 1; double g_paginasDeshechas = 0;
// (§240, ?w10Deshacer=2) g_tocadaA[p] = A mandó algo de la página p desde que B entró a su bucle (la escribe w10.mjs al
// pegar): solo esas se deshacen tras el dibujo entero. Lo que el dibujo arma una vez y guarda (p. ej. el objeto de
// GlobalScreenCapture) vive en páginas que la lógica de A no toca: esas quedan como las dejó B. g_acum = las páginas que
// marcó el dibujo de este cuadro (el dibujo de los efectos borra las marcas a mitad de camino).
std::vector<uint8_t> g_tocadaA, g_acum, g_bitsA; bool g_tocadasLimpias = false; double g_palabrasDeshechas = 0; }
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_w10_sombra_b() {
    if (!g_deshacerEfectos) return nullptr;   // (sin deshacer no hace falta la sombra: 152 MB menos)
    if (g_sombraB.empty()) {   // (empieza igual a la memoria de B: una página que A nunca cambió no vuelve a cero)
        preparar();   // (la tabla de páginas antes de copiar)
        g_sombraB.assign(kMem1 + kMem2, 0);
        for (uint32_t p = 0; p < kPaginas; p++) if (g_host[p]) std::memcpy(&g_sombraB[p < kPag1 ? p * kPagina : kMem1 + (p - kPag1) * kPagina], g_host[p], kPagina);
    }
    if (g_tocadaA.empty()) { g_tocadaA.assign(kPaginas, 0); g_acum.assign(kPaginas, 0); g_bitsA.assign((kMem1 + kMem2) / 32, 0); }
    return g_sombraB.data();
}
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_w10_tocadas_a() { return g_tocadaA.empty() ? nullptr : g_tocadaA.data(); }
// (por palabra: un bit por cada 4 bytes que A mandó; bit k de g_bitsA[lugar >> 5] = la palabra (lugar >> 2) & 7)
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_w10_bits_a() { return g_bitsA.empty() ? nullptr : g_bitsA.data(); }
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_w10_palabras_deshechas() { return g_palabrasDeshechas; }
void w10_acumular() { for (uint32_t p = 0; p < kPaginas; p++) if (g_host[p] && marcada(p)) g_acum[p] = 1; }
void w10_empezar_todo() {
    preparar();
    if (!g_tocadasLimpias) { std::fill(g_tocadaA.begin(), g_tocadaA.end(), 0); std::fill(g_bitsA.begin(), g_bitsA.end(), 0); g_tocadasLimpias = true; }   // (la foto entera no cuenta)
    std::fill(g_acum.begin(), g_acum.end(), 0);
    reponer();
}
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_w10_deshacer_efectos(int s) { g_deshacerEfectos = s; }
bool w10_deshacer_todo() { return g_deshacerEfectos >= 2 && !g_sombraB.empty(); }
bool w10_pagina_entera() { return g_deshacerEfectos == 3; }   // (3 = las páginas enteras)
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_w10_deshechas() { return g_paginasDeshechas; }
extern "C" void func_8067CF74(CpuContext* ctx) {
    if (g_dibujante && g_enBucle && g_sinEfectosB) { g_efectosSaltados++; return; }
    if (!(g_dibujante && g_enBucle && g_deshacerEfectos >= 1 && !g_sombraB.empty())) { func_8067CF74_traducida(ctx); return; }
    preparar();
    if (w10_deshacer_todo()) w10_acumular();   // (lo marcado antes de los efectos no se pierde)
    reponer();
    func_8067CF74_traducida(ctx);
    deshacerMarcadas();
}
// (§240) devolver a la sombra (lo último de A) las páginas marcadas desde el último reponer(), salvo la pila del hilo
// que corre y los rangos propios de B. Con ?w10Deshacer=2 va alrededor del dibujo entero (no solo los efectos).
void deshacerMarcadas(bool soloTocadas, bool paginaEntera) {
    // la pila del hilo actual (de B) y los rangos propios: esas páginas no se devuelven
    const uint32_t hilo = Memory::Read32(0x800000E4u);
    const uint32_t pilaBase = hilo ? Memory::Read32(hilo + 0x304) : 0, pilaFin = hilo ? Memory::Read32(hilo + 0x308) : 0;
    auto propia = [&](uint32_t g) {
        if (pilaFin < pilaBase && g + kPagina > pilaFin && g < pilaBase) return true;
        for (size_t i = 0; i + 1 < g_rangos.size(); i += 2) if (g_rangos[i + 1] > g_rangos[i] && g + kPagina > g_rangos[i] && g < g_rangos[i + 1]) return true;
        return false;
    };
    for (uint32_t p = 0; p < kPaginas; p++) {
        if (!g_host[p] || !(soloTocadas ? g_acum[p] && (paginaEntera || g_tocadaA[p]) : marcada(p))) continue;
        const uint32_t g = guestDe(p);
        if (propia(g)) continue;
        const uint32_t lugar = p < kPag1 ? p * kPagina : kMem1 + (p - kPag1) * kPagina;
        if (soloTocadas && !paginaEntera) {   // (solo las palabras que A mandó alguna vez: lo que arma el dibujo para sí queda)
            uint32_t* h = reinterpret_cast<uint32_t*>(g_host[p]);
            const uint32_t* sb = reinterpret_cast<const uint32_t*>(&g_sombraB[lugar]);
            const uint8_t* bits = &g_bitsA[lugar >> 5];
            for (uint32_t w = 0; w < kPagina / 4; w++)
                if ((bits[w >> 3] >> (w & 7)) & 1 && h[w] != sb[w]) { h[w] = sb[w]; g_palabrasDeshechas++; }
        } else std::memcpy(g_host[p], &g_sombraB[lugar], kPagina);
        g_paginasDeshechas++;
    }
    reponer();
}
