// W1 de la etapa 0 del plan v4 (bitácora §196): ¿el dibujo es un «sumidero»? y ¿cuántas páginas ensucia la carrera?
//
// Resumen. La etapa 1 del plan (W10) quiere llevar el dibujo entero a otro Worker, un cuadro atrás. Eso sirve solo si
// la carrera nunca lee lo que el dibujo escribe (el dibujo es un sumidero: la corriente entra y no vuelve), y cuesta
// según cuántas páginas de 4 KiB de la memoria de la Wii cambia la carrera en cada cuadro (es lo que habría que mandarle
// al Worker del dibujo). Este archivo mide las dos cosas con fotos de la memoria, sin tocar cada lectura y escritura:
//   - Antes del dibujo (EGG::SceneManager::draw, 0x8023AEAC, el que llama el bucle del juego después de la lógica) se
//     compara la memoria con la foto del cuadro anterior: las páginas distintas son las que ensució la carrera (y todo
//     lo que no es el dibujo) en ese cuadro. La foto se pone al día.
//   - Después del dibujo se compara otra vez: lo distinto es lo que escribió el dibujo.
//   - Con el modo 2 («deshacer»), lo que escribió el dibujo se vuelve atrás byte por byte, MENOS lo que escribió
//     ScnMgr::SwitchScnRoot (0x805635E4): esa parte la lee la lógica (ModelDirector::Update, §192) y en W10 la seguiría
//     corriendo el Worker de la carrera. Si con el modo 2 la carrera sale igual (las huellas de la sala, el fantasma),
//     la carrera no leyó nada de lo que el dibujo escribió: el sumidero se cumple.
// Es como medir el consumo por circuito con el medidor general: se anota la lectura antes y después de prender cada
// circuito, sin poner un medidor en cada aparato.
// Solo en un programa aparte: MKW_SUMIDERO_COMPILAR=1 python herramientas/compilar-web.py … (los programas de siempre
// no cambian). Modo por la página (?sumidero=1|2, Module._mkw_sumidero_modo) o en Node con MKW_SUMIDERO=1|2.
// Trampa: si otro hilo del juego (el sonido, el disco) corre DURANTE el dibujo, sus escrituras se cuentan como del
// dibujo y el modo 2 las desharía; por eso también se cuentan los dibujos en que eso pudo pasar (no hay forma barata de
// saberlo aquí: si el modo 2 rompe la carrera, eso es lo primero que hay que mirar).
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

namespace {
constexpr uint32_t kPagina = 4096;
// las dos memorias de la Wii: MEM1 entera y los primeros 64 MiB de MEM2 (lo que tiene la Wii de verdad; el runtime
// reserva 128 y la parte de arriba nunca se usa: se comprueba una vez, `arribaUsada`)
constexpr uint32_t kMem1 = 24u << 20, kMem2 = 64u << 20;
constexpr uint32_t kPaginas = (kMem1 + kMem2) / kPagina;
// dónde está cada página de 4 KiB en la memoria del PC. En wasm la memoria de la Wii va por la tabla de páginas de
// 1 MiB (§182): un bloque de 24 MiB no es continuo, pero cada página de 4 KiB cae dentro de una de 1 MiB y sí lo es
std::vector<uint8_t*> g_host;
uint32_t guestDe(uint32_t pagina) {
    const uint32_t a = pagina * kPagina;
    return a < kMem1 ? 0x80000000u + a : 0x90000000u + (a - kMem1);
}

int g_modo = -1;                 // -1 = sin leer MKW_SUMIDERO todavía; 0 = apagado; 1 = medir; 2 = medir y deshacer
std::vector<uint8_t> g_foto;     // la memoria como quedó antes del último dibujo (sin lo del dibujo)
std::vector<uint8_t> g_guardada; // (en SwitchScnRoot) las páginas que el dibujo ya había ensuciado, como estaban
std::vector<int32_t> g_dondeGuardada;   // página → posición en g_guardada (−1 = no está)
std::vector<uint8_t> g_conservada;      // páginas con bytes de SwitchScnRoot este cuadro (cuentan como de la carrera)
bool g_enDibujo = false, g_primera = true;

// lo contado desde el último reinicio
struct Cuenta {
    double cuadros = 0, carreraPag = 0, carreraMax = 0, dibujoPag = 0, dibujoMax = 0, conservados = 0, deshechos = 0,
           switches = 0, arribaUsada = 0;
} g_c;

uint8_t* host(uint32_t pagina) { return g_host[pagina]; }
bool distinta(const uint8_t* a, const uint8_t* b) {   // 4 KiB de a 8 bytes (el memcmp de musl va de a 1)
    const uint64_t* x = reinterpret_cast<const uint64_t*>(a);
    const uint64_t* y = reinterpret_cast<const uint64_t*>(b);
    for (uint32_t i = 0; i < kPagina / 8; i += 4)
        if ((x[i] ^ y[i]) | (x[i + 1] ^ y[i + 1]) | (x[i + 2] ^ y[i + 2]) | (x[i + 3] ^ y[i + 3])) return true;
    return false;
}

bool preparar() {
    if (g_modo < 0) {
        const char* e = std::getenv("MKW_SUMIDERO");
        g_modo = e ? std::atoi(e) : 0;
    }
    if (g_modo <= 0) return false;
    if (g_host.empty()) {
        g_host.resize(kPaginas);
        // GetPointer con un largo grande no sirve en wasm (el camino rápido solo acepta largos chicos y el lento no tiene
        // regiones): se pide el primer byte de cada página de 4 KiB, que en el PC está dentro de un mismo bloque de
        // 1 MiB, así que la página entera es contigua
        for (uint32_t p = 0; p < kPaginas; p++) g_host[p] = Memory::GetPointer(guestDe(p));
        g_foto.assign(static_cast<size_t>(kPaginas) * kPagina, 0);
        g_dondeGuardada.assign(kPaginas, -1);
        g_conservada.assign(kPaginas, 0);
        g_primera = true;
        // ¿la parte de arriba de MEM2 (64–128 MiB) tiene algo? (si sí, habría que medirla también)
        for (uint32_t i = 0; i < (64u << 20); i += kPagina) {
            if (!Memory::Contains(0x90000000u + kMem2 + i, 1)) continue;   // (sin la memoria, GetPointer se cae)
            const uint8_t* arriba = Memory::GetPointer(0x90000000u + kMem2 + i);
            const uint64_t* p = reinterpret_cast<const uint64_t*>(arriba);
            for (uint32_t k = 0; k < kPagina / 8; k++) if (p[k]) { g_c.arribaUsada += 1; break; }
        }
    }
    return true;
}

void antesDelDibujo() {
    uint32_t sucias = 0;
    for (uint32_t p = 0; p < kPaginas; p++) {
        uint8_t* h = host(p); uint8_t* f = &g_foto[static_cast<size_t>(p) * kPagina];
        if (g_primera || distinta(h, f)) { std::memcpy(f, h, kPagina); sucias++; }
        else if (g_conservada[p]) sucias++;
        g_conservada[p] = 0;
    }
    if (!g_primera) {
        g_c.cuadros++; g_c.carreraPag += sucias; if (sucias > g_c.carreraMax) g_c.carreraMax = sucias;
    }
    g_primera = false;
    g_guardada.clear();
    g_enDibujo = true;
}

void despuesDelDibujo() {
    uint32_t delDibujo = 0; double deshechos = 0;
    for (uint32_t p = 0; p < kPaginas; p++) {
        uint8_t* h = host(p); uint8_t* f = &g_foto[static_cast<size_t>(p) * kPagina];
        g_dondeGuardada[p] = -1;
        if (!distinta(h, f)) continue;
        delDibujo++;
        for (uint32_t i = 0; i < kPagina; i++) deshechos += h[i] != f[i];
        // modo 2: la memoria vuelve a la foto (que ya tiene lo de SwitchScnRoot); modo 1: la foto toma lo del dibujo,
        // así el cuadro siguiente cuenta solo lo de la carrera
        if (g_modo == 2) std::memcpy(h, f, kPagina); else std::memcpy(f, h, kPagina);
    }
    g_c.dibujoPag += delDibujo; if (delDibujo > g_c.dibujoMax) g_c.dibujoMax = delDibujo;
    g_c.deshechos += deshechos;
    g_enDibujo = false;
}

void antesDeSwitch() {   // las páginas que el dibujo ya ensució, como estaban justo antes de SwitchScnRoot
    for (uint32_t p = 0; p < kPaginas; p++) {
        uint8_t* h = host(p);
        if (!distinta(h, &g_foto[static_cast<size_t>(p) * kPagina])) continue;
        g_dondeGuardada[p] = static_cast<int32_t>(g_guardada.size() / kPagina);
        g_guardada.insert(g_guardada.end(), h, h + kPagina);
    }
}

void despuesDeSwitch() {   // lo que escribió SwitchScnRoot pasa a la foto: es de la carrera y no se deshace
    for (uint32_t p = 0; p < kPaginas; p++) {
        uint8_t* h = host(p); uint8_t* f = &g_foto[static_cast<size_t>(p) * kPagina];
        const uint8_t* base = g_dondeGuardada[p] >= 0 ? &g_guardada[static_cast<size_t>(g_dondeGuardada[p]) * kPagina] : f;
        if (!distinta(h, base)) continue;
        for (uint32_t i = 0; i < kPagina; i++)
            if (h[i] != base[i]) { f[i] = h[i]; g_c.conservados++; g_conservada[p] = 1; }
    }
    g_c.switches++;
}
}  // namespace

// (no prepara aquí: la página lo llama mientras carga, antes de que exista la memoria de la Wii; prepara el primer dibujo)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_sumidero_modo(int m) { g_modo = m; g_primera = true; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_sumidero_reiniciar() { const double a = g_c.arribaUsada; g_c = Cuenta{}; g_c.arribaUsada = a; }
// 0 cuadros, 1 páginas de la carrera (suma), 2 máximo, 3 páginas del dibujo (suma), 4 máximo, 5 bytes conservados de
// SwitchScnRoot, 6 bytes deshechos (o que se habrían deshecho), 7 SwitchScnRoot dentro del dibujo, 8 páginas usadas
// arriba de los 64 MiB de MEM2, 9 el modo
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_sumidero_dato(int i) {
    const double v[] = {g_c.cuadros, g_c.carreraPag, g_c.carreraMax, g_c.dibujoPag, g_c.dibujoMax, g_c.conservados,
                        g_c.deshechos, g_c.switches, g_c.arribaUsada, static_cast<double>(g_modo)};
    return i >= 0 && i < 10 ? v[i] : -1;
}

extern "C" void func_8023AEAC_traducida(CpuContext* ctx);   // EGG::SceneManager::draw
extern "C" void func_8023AEAC(CpuContext* ctx) {
    if (!preparar() || g_enDibujo) { func_8023AEAC_traducida(ctx); return; }
    antesDelDibujo();
    func_8023AEAC_traducida(ctx);
    despuesDelDibujo();
    // en Node (MKW_SUMIDERO) un informe cada 600 dibujos
    static uint32_t n = 0;
    if (std::getenv("MKW_SUMIDERO") && ++n % 600 == 0 && g_c.cuadros > 0)
        std::printf("[sumidero] modo %d, %.0f cuadros: carrera %.1f páginas por cuadro (máx %.0f), dibujo %.1f (máx %.0f), "
                    "conservados %.0f B, deshechos %.0f B por cuadro\n", g_modo, g_c.cuadros, g_c.carreraPag / g_c.cuadros,
                    g_c.carreraMax, g_c.dibujoPag / g_c.cuadros, g_c.dibujoMax, g_c.conservados / g_c.cuadros,
                    g_c.deshechos / g_c.cuadros);
}

extern "C" void func_805635E4_traducida(CpuContext* ctx);   // ScnMgr::SwitchScnRoot
extern "C" void func_805635E4(CpuContext* ctx) {
    if (!g_enDibujo || g_modo <= 0) { func_805635E4_traducida(ctx); return; }
    antesDeSwitch();
    func_805635E4_traducida(ctx);
    despuesDeSwitch();
}
