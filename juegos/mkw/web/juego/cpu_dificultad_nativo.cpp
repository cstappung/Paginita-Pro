// Los niveles de la CPU de la página (M20, pedido del dueño: la dificultad más alta, con el nivel más difícil «todo al
// máximo»; bitácora §96).
//
// Resumen: los niveles de CPU de Mario Kart Wii son números que el juego lee al empezar cada carrera, en
// AI::Params::Load (en Retro Rewind, su versión rr_overlay_8073ACA8). La página elige el nivel (dificultad-cpu.mjs) y
// le pasa a este archivo cuánto subir cada perilla (mkw_cpu_perfil, antes de abrir la carrera: es parte de la ficha,
// igual en todas las consolas). Aquí se envuelve Load: primero carga el juego lo suyo (la fila de su tabla que eligió
// directo_nativo.cpp) y después se escribe encima:
//   - la velocidad (la única estructura {adv, bias, min} que comparten todas las CPU, Params+4): la base 70 + adv se
//     multiplica por factorBase, el «atraso permitido» bias por factorBias, y la mínima va hacia la base nueva;
//   - el «arrebato» (la persecución del líder humano, una vez por carrera: probabilidad, cuándo empieza y cuánto dura)
//     y la tinta del Blooper, que son constantes del juego en memoria (tabla en 0x808CB388 y 0x808A2B44);
// y se envuelve ItemSlotData::DecideItem (rr_overlay_807BB42C): con «objetosHumano», cuando el que saca es una CPU,
// por esa llamada su tabla es la del humano (playerChances en lugar de cpuChances) y después vuelve a la suya.
// Las constantes del juego se guardan la primera vez y se reponen en cada carrera antes de escribir el nivel nuevo,
// así una carrera «normal» después de una «máximo» vuelve a ser la del juego. Solo se escriben si valen lo que el
// juego trae (lo leído en el código traducido, §96.1): si no, se saltan y mkw_cpu_estado(7) lo dice.
// Nada de esto copia código del juego: son lecturas y escrituras de números en las direcciones que se midieron.
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>
#include <cstring>

namespace {
constexpr uint32_t kRacedata = 0x809BD728;     // Racedata* (+0xB68 los ajustes de la carrera: +0x8 el modo, 1 = VS)
constexpr uint32_t kAiManager = 0x809C2BE8;    // AI::Manager::sInstance (+0x8C Params*)
constexpr uint32_t kArrebato = 0x808CB388;     // la tabla del árbitro de la IA (s16): ver kArrebatoJuego
constexpr uint32_t kTinta = 0x808A2B44;        // float: la velocidad que le queda a una CPU con tinta (0,8)
constexpr uint32_t kItemSlot = 0x809C3670;     // ItemSlotData::sInstance (+0x10 playerChances, +0x18 cpuChances: 8 bytes)
// la tabla del arrebato, de +28 a +52 (s16): probabilidad fácil/normal/difícil (%), el comienzo más temprano (s), el
// más tarde por dificultad (s) y la duración mínima/máxima por dificultad (s)
constexpr int16_t kArrebatoJuego[13] = {60, 80, 80, 30, 100, 120, 140, 30, 50, 40, 60, 50, 70};
constexpr uint32_t kTintaJuego = 0x3F4CCCCDu;  // 0,8f

struct Perfil {
    int32_t nivel = -1;                        // -1 = sin perfil (carreras armadas con los menús): el juego tal cual
    float factorBase = 1, factorBias = 1, mezclaMin = 0;
    int32_t prob = -1, inicio = -1, hasta = -1, durMin = -1, durMax = -1;   // -1 = el del juego
    float tinta = -1;
    int32_t objetosHumano = 0;
} g_perfil;

bool g_guardado = false, g_datosOk = false;    // las constantes del juego, guardadas (y si valían lo esperado)
int16_t g_arrebatoOrig[13] = {};
uint32_t g_tintaOrig = 0;
int32_t g_cargas = 0, g_aplicadas = 0, g_nivelAplicado = -1, g_objetosCambiados = 0, g_objetosActivos = 0;
float g_vel[3] = {0, 0, 0}, g_velJuego[3] = {0, 0, 0};   // lo que quedó escrito y lo que había cargado el juego

float leerF(uint32_t a) { const uint32_t u = Memory::Read32(a); float f; std::memcpy(&f, &u, 4); return f; }
void escribirF(uint32_t a, float f) { uint32_t u; std::memcpy(&u, &f, 4); Memory::Write32(a, u); }
int16_t leer16(uint32_t a) { return static_cast<int16_t>(Memory::Read16(a)); }

void guardarJuego() {
    if (g_guardado) return;
    g_guardado = true;
    bool ok = true;
    for (int i = 0; i < 13; i++) { g_arrebatoOrig[i] = leer16(kArrebato + 28 + 2 * i); ok = ok && g_arrebatoOrig[i] == kArrebatoJuego[i]; }
    g_tintaOrig = Memory::Read32(kTinta);
    g_datosOk = ok && g_tintaOrig == kTintaJuego;
}

void reponerJuego() {
    if (!g_datosOk) return;
    for (int i = 0; i < 13; i++) Memory::Write16(kArrebato + 28 + 2 * i, static_cast<uint16_t>(g_arrebatoOrig[i]));
    Memory::Write32(kTinta, g_tintaOrig);
}

bool esVs() {
    const uint32_t rd = Memory::Read32(kRacedata);
    return rd && Memory::Read32(rd + 0xB68 + 0x8) == 1;
}

// después de que el juego cargó los parámetros de la IA: el nivel de la página encima
void aplicar(uint32_t params) {
    ++g_cargas;
    guardarJuego();
    reponerJuego();                            // primero, todo como lo trae el juego
    g_objetosActivos = 0; g_nivelAplicado = -1;
    if (g_perfil.nivel < 0 || !esVs() || !params) return;
    const uint32_t vel = Memory::Read32(params + 4);
    if (!vel || !Memory::Contains(vel, 12)) return;
    const float adv = leerF(vel), bias = leerF(vel + 4), min = leerF(vel + 8);
    g_velJuego[0] = adv; g_velJuego[1] = bias; g_velJuego[2] = min;
    const float base = (70.0f + adv) * g_perfil.factorBase;   // la velocidad base nueva
    const float advN = base - 70.0f, biasN = bias * g_perfil.factorBias, minN = min + g_perfil.mezclaMin * (base - min);
    escribirF(vel, advN); escribirF(vel + 4, biasN); escribirF(vel + 8, minN);
    g_vel[0] = advN; g_vel[1] = biasN; g_vel[2] = minN;
    if (g_datosOk && g_perfil.prob >= 0) {     // el arrebato: la fila «difícil» (la que usan normal, difícil y máximo)
        Memory::Write16(kArrebato + 32, static_cast<uint16_t>(g_perfil.prob));
        Memory::Write16(kArrebato + 34, static_cast<uint16_t>(g_perfil.inicio));    // (el más temprano es de todas)
        Memory::Write16(kArrebato + 40, static_cast<uint16_t>(g_perfil.hasta > g_perfil.inicio ? g_perfil.hasta : g_perfil.inicio + 1));
        Memory::Write16(kArrebato + 50, static_cast<uint16_t>(g_perfil.durMin));
        Memory::Write16(kArrebato + 52, static_cast<uint16_t>(g_perfil.durMax > g_perfil.durMin ? g_perfil.durMax : g_perfil.durMin + 1));
    }
    if (g_datosOk && g_perfil.tinta >= 0) escribirF(kTinta, g_perfil.tinta);
    g_objetosActivos = g_perfil.objetosHumano;
    g_nivelAplicado = g_perfil.nivel;
    ++g_aplicadas;
}
}  // namespace

// La página (dificultad-cpu.mjs, aplicarPerfilCpu): el perfil del nivel elegido; los factores en milésimas, -1 = el
// del juego. nivel -1 = sin perfil.
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_cpu_perfil(int32_t nivel, int32_t base, int32_t bias, int32_t mezcla, int32_t prob,
                                                     int32_t inicio, int32_t hasta, int32_t durMin, int32_t durMax, int32_t tinta,
                                                     int32_t objetosHumano) {
    g_perfil.nivel = nivel;
    g_perfil.factorBase = base / 1000.0f; g_perfil.factorBias = bias / 1000.0f; g_perfil.mezclaMin = mezcla / 1000.0f;
    g_perfil.prob = prob; g_perfil.inicio = inicio; g_perfil.hasta = hasta; g_perfil.durMin = durMin; g_perfil.durMax = durMax;
    g_perfil.tinta = tinta < 0 ? -1.0f : tinta / 1000.0f;
    g_perfil.objetosHumano = objetosHumano;
}
// Para mirar (pruebas): 0 cargas, 1 aplicadas, 2 nivel aplicado en la última, 3 objetos de humano sacados por CPU,
// 4..6 adv/bias/min escritos ×1000, 7 las constantes del juego valían lo esperado (1) o no (0), 8..10 lo que había
// cargado el juego ×1000, 11 el comienzo más temprano del arrebato ahora (s), 12 la probabilidad difícil ahora (%),
// 13 la tinta ahora ×1000
extern "C" EMSCRIPTEN_KEEPALIVE int32_t mkw_cpu_estado(int32_t k) {
    switch (k) {
        case 0: return g_cargas;
        case 1: return g_aplicadas;
        case 2: return g_nivelAplicado;
        case 3: return g_objetosCambiados;
        case 4: case 5: case 6: return static_cast<int32_t>(g_vel[k - 4] * 1000.0f);
        case 7: return g_guardado ? (g_datosOk ? 1 : 0) : -1;
        case 8: case 9: case 10: return static_cast<int32_t>(g_velJuego[k - 8] * 1000.0f);
        case 11: return leer16(kArrebato + 34);
        case 12: return leer16(kArrebato + 32);
        case 13: return static_cast<int32_t>(leerF(kTinta) * 1000.0f);
        default: return 0;
    }
}

// AI::Params::Load (la de Retro Rewind): r3 = el Params
extern "C" void rr_overlay_8073ACA8_traducida(CpuContext* ctx);
extern "C" void rr_overlay_8073ACA8(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t params = ctx->gpr[3];
    rr_overlay_8073ACA8_traducida(ctx);
    aplicar(params);
}

// ItemSlotData::DecideItem (la de Retro Rewind): r3 = ItemSlotData, r6 = ¿es humano? Con «objetosHumano», para una
// CPU la tabla de la CPU (+0x18, 8 bytes: filas y puntero) es por esta llamada la del humano (+0x10)
extern "C" void rr_overlay_807BB42C_traducida(CpuContext* ctx);
extern "C" void rr_overlay_807BB42C(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t datos = ctx->gpr[3];
    if (!g_objetosActivos || (ctx->gpr[6] & 0xFF) != 0 || !datos || datos != Memory::Read32(kItemSlot)) {
        rr_overlay_807BB42C_traducida(ctx);
        return;
    }
    const uint32_t filas = Memory::Read32(datos + 0x18), tabla = Memory::Read32(datos + 0x1C);
    Memory::Write32(datos + 0x18, Memory::Read32(datos + 0x10));
    Memory::Write32(datos + 0x1C, Memory::Read32(datos + 0x14));
    rr_overlay_807BB42C_traducida(ctx);
    Memory::Write32(datos + 0x18, filas);
    Memory::Write32(datos + 0x1C, tabla);
    ++g_objetosCambiados;
}
