// W32 (bitácora §258): la IA de las CPU piensa uno de cada dos cuadros; la física de todos sigue a 60.
//
// Resumen. Cada cuadro de lógica, el juego recorre los 12 karts y a cada uno le corre su «cerebro» (la máquina de
// estados de la IA: elegir la ruta, girar, derrapar, el miniturbo, los objetos y la velocidad). La entrada de eso, para
// cada kart, es func_807261B8 (leída en el código traducido, nada copiado: pone en 0 una marca del objeto, mira si la
// carrera está en pausa y llama al método «calc» del cerebro, que corre la máquina de estados func_8074AF38). Lo que el
// cerebro decide queda escrito en el objeto de la IA y el kart lo lee en su física.
// Aquí se envuelve esa entrada (REEMPLAZOS de compilar-web.py, solo con MKW_IA30_COMPILAR=1: nunca en el programa de
// jugar). Con el modo 1 y la carrera andando (Raceinfo +0x28 = 2), la CPU número k piensa solo en los cuadros en que
// (cuadro + k) es par; en el otro cuadro no se corre nada de su cerebro, así lo que decidió en el cuadro anterior sigue
// escrito y el kart lo usa otra vez (un retenedor de orden cero: la orden se toma a 30 por segundo y se mantiene entre
// toma y toma). Como la mitad de las CPU piensa en los pares y la otra mitad en los impares, cada cuadro cuesta lo
// mismo. Los humanos no se tocan (su cerebro corre siempre: es el que maneja su kart cuando cruzan la meta).
// El cuadro es el del juego (Raceinfo +0x1C + +0x20: los cuadros de la presentación y desde la cuenta), igual en todas
// las consolas de la sala: el resultado no depende de la PC.
// El número de cada kart sale del orden en que el juego los recorre (el gestor de karts los recorre del 0 al 11): el
// primer objeto que llega en una carrera es el kart 0, el segundo el 1… La tabla se rehace cuando cambia la carrera
// (otro Raceinfo o el cuadro que vuelve atrás).
// El modo: 0 = el juego tal cual (por omisión), 1 o 2 = cada CPU piensa uno de cada 2 cuadros, 3 = uno de cada 3 (N = uno
// de cada N, hasta 8; en cada cuadro piensa una N-ésima parte de las CPU). Se lee una vez de la dirección de la página
// (?ia30=N) o, en Node, de la variable MKW_IA30; mkw_ia30_modo(N) lo cambia desde la página.
// Para comparar el manejo (con cualquier modo, también el 0): en cada cuadro de la carrera andando se leen las 5 palabras
// de marcas del estado de cada kart CPU (KartObjectManager 0x809C18F8 +0x20 → kart → su accesor → +4 el estado, palabras
// +0x4…+0x14: cada bit es una cosa que está pasando, como derrapar, el turbo, tocar el suelo, el golpe) y se cuenta, por
// bit y sumando las CPU, cuántas veces se prende y cuántos cuadros está prendido (mkw_ia30_bits); y el cuadro exacto en
// que cada kart empieza cada vuelta (el avance de su RaceinfoPlayer +0xC pasa a la vuelta siguiente: mkw_ia30_vuelta).
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>
#include <cstring>

namespace {
constexpr uint32_t kRacedata = 0x809BD728;     // Racedata* (+0x20 el escenario de la carrera: jugador i en +8 + i·0xF0, tipo +0x10)
constexpr uint32_t kRaceinfo = 0x809BD730;     // Raceinfo* (+0x1C y +0x20 los cuadros, +0x28 la etapa: 2 = corriendo)

int32_t g_modo = -1;                           // -1 = todavía sin leer
uint32_t g_raceinfo = 0, g_ultimoCuadro = 0;   // para saber cuándo empieza otra carrera
uint32_t g_objetos[12] = {};                   // el objeto de la IA de cada kart, en el orden en que llegan
int32_t g_cpu[12] = {};                        // ¿el kart k es una CPU? (Racedata, al anotarlo)
int32_t g_karts = 0;
// lo que se cuenta (mkw_ia30_estado): llamadas, pensadas, retenidas, carreras, karts anotados, CPU anotadas, desbordes
int32_t g_llamadas = 0, g_pensadas = 0, g_retenidas = 0, g_carreras = 0, g_desbordes = 0;
// el manejo: 5 palabras × 32 bits; por bit, veces que se prende y cuadros prendido (sumando las CPU); cuadros contados
constexpr uint32_t kKom = 0x809C18F8;          // KartObjectManager* (+0x20 → el arreglo de los 12 karts)
constexpr int32_t kBits = 5 * 32, kVueltas = 9;
int32_t g_prendidas[kBits] = {}, g_cuadrosBit[kBits] = {}, g_cuadrosCpu = 0;
uint32_t g_antes[12][5] = {};                  // las palabras del cuadro anterior de cada kart
int32_t g_cpuIdx[12] = {};                     // ¿el jugador i es CPU? (por número de jugador, al empezar la carrera)
int32_t g_vuelta[12] = {};                     // la vuelta en que va cada kart (el entero del avance)
uint32_t g_cuadroVuelta[12][kVueltas] = {};    // el cuadro del juego en que empezó cada vuelta (0 = todavía no)
uint32_t g_cuadroContado = 0xFFFFFFFFu;

int32_t leerModo() {
    // la página: ?ia30=N; Node: MKW_IA30=N (sin nada = 0)
    return EM_ASM_INT({
        try {
            if (typeof location !== 'undefined' && location.search) {
                const v = new URLSearchParams(location.search).get('ia30');
                if (v !== null) return Number(v) | 0;
            }
            if (typeof process !== 'undefined' && process.env && process.env.MKW_IA30) return Number(process.env.MKW_IA30) | 0;
        } catch (e) {}
        return 0;
    });
}

bool esCpu(int32_t i) {
    const uint32_t rd = Memory::Read32(kRacedata);
    return rd && i >= 0 && i < 12 && Memory::Read32(rd + 0x20 + 0x8 + i * 0xF0 + 0x10) == 1;
}

// el número del kart de este objeto (−1 si no cabe en la tabla)
int32_t kartDe(uint32_t objeto) {
    for (int32_t k = 0; k < g_karts; k++) if (g_objetos[k] == objeto) return k;
    if (g_karts >= 12) { ++g_desbordes; return -1; }
    g_objetos[g_karts] = objeto;
    g_cpu[g_karts] = esCpu(g_karts) ? 1 : 0;
    return g_karts++;
}
// leer una palabra solo si la dirección es memoria del juego (sin excepciones: cada cuadro, barato)
inline bool leer(uint32_t a, uint32_t& v) { if (!Memory::Contains(a, 4)) return false; v = Memory::Read32(a); return true; }

int32_t periodo() { return g_modo == 1 ? 2 : (g_modo > 8 ? 8 : g_modo); }

void empezarCarrera() {
    for (int32_t i = 0; i < 12; i++) {
        g_cpuIdx[i] = esCpu(i) ? 1 : 0; g_vuelta[i] = 0;
        for (int32_t w = 0; w < 5; w++) g_antes[i][w] = 0;
        for (int32_t v = 0; v < kVueltas; v++) g_cuadroVuelta[i][v] = 0;
    }
}

// una vez por cuadro de la carrera andando: las marcas de cada kart CPU y las vueltas de todos
void contar(uint32_t ri, uint32_t cuadro) {
    uint32_t kom = 0, arr = 0, lista = 0;
    if (!leer(kKom, kom) || !kom || !leer(kom + 0x20, arr) || !arr) return;
    leer(ri + 0xC, lista);
    for (int32_t i = 0; i < 12; i++) {
        if (lista) {                                                   // la vuelta: el entero del avance
            uint32_t p = 0, crudo = 0;
            if (leer(lista + 4 * i, p) && p && leer(p + 0xC, crudo)) {
                float av; std::memcpy(&av, &crudo, 4);
                const int32_t v = av > 0.f && av < 20.f ? static_cast<int32_t>(av) : 0;
                if (v > g_vuelta[i]) { if (v < kVueltas && !g_cuadroVuelta[i][v]) g_cuadroVuelta[i][v] = cuadro; g_vuelta[i] = v; }
            }
        }
        if (!g_cpuIdx[i]) continue;
        uint32_t kart = 0, acc = 0, est = 0;
        if (!leer(arr + 4 * i, kart) || !kart || !leer(kart, acc) || !acc ||
            !leer(acc + 4, est) || !est || !Memory::Contains(est, 0x18)) continue;
        ++g_cuadrosCpu;
        for (int32_t w = 0; w < 5; w++) {
            const uint32_t x = Memory::Read32(est + 4 + 4 * w), subio = x & ~g_antes[i][w];
            for (int32_t b = 0; b < 32; b++) {
                if (x & (1u << b)) ++g_cuadrosBit[w * 32 + b];
                if (subio & (1u << b)) ++g_prendidas[w * 32 + b];
            }
            g_antes[i][w] = x;
        }
    }
}
}  // namespace

extern "C" void func_807261B8_traducida(CpuContext* ctx);
extern "C" void func_807261B8(CpuContext* MKW_RESTRICT ctx) {
    if (g_modo < 0) g_modo = leerModo();
    const uint32_t ri = Memory::Read32(kRaceinfo);
    if (!ri || !Memory::Contains(ri, 0x2C)) { func_807261B8_traducida(ctx); return; }
    if (g_modo >= 1) ++g_llamadas;
    const uint32_t cuadro = Memory::Read32(ri + 0x1C) + Memory::Read32(ri + 0x20);
    if (ri != g_raceinfo || cuadro < g_ultimoCuadro) {            // otra carrera: la tabla de los karts de nuevo
        g_raceinfo = ri; g_karts = 0; ++g_carreras; g_cuadroContado = 0xFFFFFFFFu;
        empezarCarrera();
    }
    g_ultimoCuadro = cuadro;
    const int32_t k = kartDe(ctx->gpr[3]);
    const bool corriendo = Memory::Read32(ri + 0x28) == 2;
    if (corriendo && cuadro != g_cuadroContado) { g_cuadroContado = cuadro; contar(ri, cuadro); }
    // sin el modo, fuera de la carrera andando (la presentación, la cuenta, la meta de todos), un humano, un kart sin
    // número o el cuadro en que le toca pensar a esta CPU: igual que siempre
    const uint32_t n = static_cast<uint32_t>(periodo());
    if (g_modo < 1 || k < 0 || !g_cpu[k] || !corriendo || (cuadro + static_cast<uint32_t>(k)) % n == 0) {
        if (g_modo >= 1 && k >= 0 && g_cpu[k]) ++g_pensadas;
        func_807261B8_traducida(ctx);
        return;
    }
    ++g_retenidas;                                                   // esta CPU no piensa: sigue con lo del cuadro anterior
}

// 0 = el juego tal cual, 1 o 2 = uno de cada 2 cuadros, 3 = uno de cada 3 (se puede cambiar en cualquier momento)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_ia30_modo(int32_t m) { g_modo = m; }

// 0 modo, 1 llamadas (con el modo 1), 2 pensadas por CPU, 3 retenidas, 4 carreras vistas, 5 karts anotados en esta,
// 6 CPU entre ellos, 7 desbordes de la tabla (más de 12 objetos en una carrera: algo no es como se leyó)
extern "C" EMSCRIPTEN_KEEPALIVE int32_t mkw_ia30_estado(int32_t q) {
    int32_t cpus = 0;
    for (int32_t k = 0; k < g_karts; k++) cpus += g_cpu[k];
    switch (q) {
        case 0: return g_modo;
        case 1: return g_llamadas;
        case 2: return g_pensadas;
        case 3: return g_retenidas;
        case 4: return g_carreras;
        case 5: return g_karts;
        case 6: return cpus;
        case 7: return g_desbordes;
        default: return -1;
    }
}

// el manejo: i < 160 = veces que se prendió el bit i (palabra i / 32 del estado, bit i % 32 = 1 << (i % 32)), sumando las
// CPU; 160 ≤ i < 320 = cuadros con el bit i − 160 prendido; 320 = cuadros de CPU contados (karts × cuadros)
extern "C" EMSCRIPTEN_KEEPALIVE int32_t mkw_ia30_bits(int32_t i) {
    if (i >= 0 && i < kBits) return g_prendidas[i];
    if (i >= kBits && i < 2 * kBits) return g_cuadrosBit[i - kBits];
    return i == 2 * kBits ? g_cuadrosCpu : -1;
}

// el cuadro del juego en que el jugador i / 9 empezó la vuelta i % 9 (0 = todavía no; la 1 es la largada)
extern "C" EMSCRIPTEN_KEEPALIVE int32_t mkw_ia30_vuelta(int32_t i) {
    return i >= 0 && i < 12 * kVueltas ? static_cast<int32_t>(g_cuadroVuelta[i / kVueltas][i % kVueltas]) : -1;
}
