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
// §99 (M23, pedido del dueño), dos niveles más arriba de «máximo»:
//   - «intenso» = el Hard AI de Retro Rewind: la tabla de velocidad de la IA de RR (kartAISpdParamRR.bin, base 170 a
//     150cc, pegada al tope de 120). Se envuelve GetCustomKartAIParam de Pulsar (rr_kamek_81830C50), que la elige
//     según el ajuste guardado del jugador (0x63001): con un nivel de la página la elegimos nosotros (así un guardado
//     de RR importado con Hard AI no cambia la tabla de una sola consola);
//   - «imposible» = lo mismo y, solo en los karts de CPU, el tope duro de velocidad (Kart::Movement+0x2C, que frena el
//     motor y la física) ×tope, la velocidad base y las aceleraciones de su copia de estadísticas (la que el juego arma
//     para cada kart al crearlo) ×velKart/×acel, el miniturbo ×mt y el giro ×giro: cosas que ningún humano alcanza.
//     Las estadísticas se tocan al crear el kart (envoltura de ApplyPlayerStatChanges de Pulsar, rr_kamek_81839710) y
//     el tope cada cuadro (envoltura de Movement::UpdateAcceleration, rr_overlay_8057B9BC: el juego lo vuelve al
//     global al rescatar o al terminar la bala, y las funciones que lo hacen están copiadas en línea).
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
// §99: la tabla de RR (la cadena que usa Pulsar con el Hard AI) y el tope global de la carrera (Kart::hardSpeedCap,
// 120 × el factor de Pulsar: 200cc, la pista)
constexpr uint32_t kNombreRR = 0x8186DD24;
constexpr char kNombreRRTexto[] = "kartAISpdParamRR.bin";
constexpr uint32_t kTopeGlobal = 0x808B59F4;
constexpr uint32_t kEstadisticasLargo = 0x18C;

struct Perfil {
    int32_t nivel = -1;                        // -1 = sin perfil (carreras armadas con los menús): el juego tal cual
    float factorBase = 1, factorBias = 1, mezclaMin = 0;
    int32_t prob = -1, inicio = -1, hasta = -1, durMin = -1, durMax = -1;   // -1 = el del juego
    float tinta = -1;
    int32_t objetosHumano = 0;
    // §99: los niveles de más arriba (1 = sin cambio)
    int32_t archivoRR = 0;
    float tope = 1, velKart = 1, acel = 1, giro = 1, mt = 1;
} g_perfil;

bool g_guardado = false, g_datosOk = false;    // las constantes del juego, guardadas (y si valían lo esperado)
int16_t g_arrebatoOrig[13] = {};
uint32_t g_tintaOrig = 0;
int32_t g_cargas = 0, g_aplicadas = 0, g_nivelAplicado = -1, g_objetosCambiados = 0, g_objetosActivos = 0;
float g_vel[3] = {0, 0, 0}, g_velJuego[3] = {0, 0, 0};   // lo que quedó escrito y lo que había cargado el juego
// §99: la tabla que se cargó (0 la del juego, 1 la de RR), karts de CPU mejorados, cuántas veces se subió el tope,
// fallos de la tabla de RR, si el tope de las CPU se sube en esta carrera; el tope y la velocidad base escritos
int32_t g_archivo = 0, g_kartsMejorados = 0, g_topesSubidos = 0, g_fallosRR = 0, g_topeActivo = 0;
float g_topeEscrito = 0, g_baseEscrita = 0;

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

// §99: ¿el jugador i de la carrera es una CPU? (tipo 1 en el escenario de la carrera: Racedata +0x20, +0x8 + i·0xF0)
bool esCpu(uint32_t i) {
    const uint32_t rd = Memory::Read32(kRacedata);
    return rd && i < 12 && Memory::Read32(rd + 0x20 + 0x8 + i * 0xF0 + 0x10) == 1;
}
bool nombreRrValido() {
    for (uint32_t k = 0; k < sizeof(kNombreRRTexto); k++)
        if (Memory::Read8(kNombreRR + k) != static_cast<uint8_t>(kNombreRRTexto[k])) return false;
    return true;
}

// después de que el juego cargó los parámetros de la IA: el nivel de la página encima
void aplicar(uint32_t params) {
    ++g_cargas;
    guardarJuego();
    reponerJuego();                            // primero, todo como lo trae el juego
    g_objetosActivos = 0; g_nivelAplicado = -1; g_topeActivo = 0;
    g_kartsMejorados = 0; g_topesSubidos = 0; g_topeEscrito = 0; g_baseEscrita = 0;
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
    g_topeActivo = g_perfil.tope > 1.0f ? 1 : 0;
    ++g_aplicadas;
}

// §99: las estadísticas de un kart de CPU recién creado (st = su copia: vehículo + personaje, ya con lo de Pulsar)
void mejorarKartCpu(uint32_t jugador, uint32_t st) {
    if (g_nivelAplicado < 0 || !esCpu(jugador) || !st || !Memory::Contains(st, kEstadisticasLargo)) return;
    if (g_perfil.velKart == 1.0f && g_perfil.acel == 1.0f && g_perfil.giro == 1.0f && g_perfil.mt == 1.0f) return;
    const float base = leerF(st + 0x18);
    if (!(base > 30.0f && base < 250.0f)) return;            // (no parece la copia de estadísticas: no se toca)
    escribirF(st + 0x18, base * g_perfil.velKart);           // la velocidad base
    g_baseEscrita = base * g_perfil.velKart;
    for (uint32_t o = 0x24; o <= 0x30; o += 4) escribirF(st + o, leerF(st + o) * g_perfil.acel);   // aceleración A[0..3]
    for (uint32_t o = 0x40; o <= 0x44; o += 4) escribirF(st + o, leerF(st + o) * g_perfil.acel);   // en derrape A[0..1]
    for (uint32_t o : {0x4Cu, 0x50u, 0x58u, 0x5Cu}) escribirF(st + o, leerF(st + o) * g_perfil.giro);   // manejo y derrape
    const int32_t mt = static_cast<int32_t>(Memory::Read32(st + 0x6C));
    if (mt > 0 && mt < 10000) Memory::Write32(st + 0x6C, static_cast<uint32_t>(static_cast<int32_t>(mt * g_perfil.mt + 0.5f)));
    ++g_kartsMejorados;
}

// §99: el tope duro de un kart de CPU (mov = su Kart::Movement), cada cuadro: si vale el global de esta carrera (no
// está con la bala ni ya subido), ×tope
void subirTopeCpu(uint32_t mov) {
    if (!mov || !Memory::Contains(mov, 0x30)) return;
    const uint32_t punteros = Memory::Read32(mov);
    if (!punteros || !Memory::Contains(punteros, 8)) return;
    const uint32_t valores = Memory::Read32(punteros), estado = Memory::Read32(punteros + 4);
    if (!valores || !estado || !Memory::Contains(estado, 0x18) || !Memory::Contains(valores, 0x14)) return;
    if (!(Memory::Read32(estado + 0x14) & 1) || !esCpu(Memory::Read8(valores + 0x10))) return;   // (bit 0 = CPU, y en la ficha)
    const float global = leerF(kTopeGlobal), ahora = leerF(mov + 0x2C);
    if (!(global > 0.0f) || ahora != global) return;
    escribirF(mov + 0x2C, global * g_perfil.tope);
    g_topeEscrito = global * g_perfil.tope;
    ++g_topesSubidos;
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
    // (§99: lo del kart vuelve a neutro; mkw_cpu_perfil_kart, después, pone el de los niveles de más arriba. Así una
    // página que solo llama a esta no hereda un «imposible» de la carrera anterior)
    g_perfil.archivoRR = 0; g_perfil.tope = g_perfil.velKart = g_perfil.acel = g_perfil.giro = g_perfil.mt = 1.0f;
}
// §99: lo de los niveles de más arriba (después de mkw_cpu_perfil): la tabla de RR (0/1) y los factores del kart de
// CPU en milésimas (1000 = sin cambio)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_cpu_perfil_kart(int32_t archivoRR, int32_t tope, int32_t velKart, int32_t acel,
                                                          int32_t giro, int32_t mt) {
    const auto f = [](int32_t v) { return v > 0 && v <= 3000 ? v / 1000.0f : 1.0f; };
    g_perfil.archivoRR = archivoRR ? 1 : 0;
    g_perfil.tope = f(tope); g_perfil.velKart = f(velKart); g_perfil.acel = f(acel); g_perfil.giro = f(giro); g_perfil.mt = f(mt);
}
// Para mirar (pruebas): 0 cargas, 1 aplicadas, 2 nivel aplicado en la última, 3 objetos de humano sacados por CPU,
// 4..6 adv/bias/min escritos ×1000, 7 las constantes del juego valían lo esperado (1) o no (0), 8..10 lo que había
// cargado el juego ×1000, 11 el comienzo más temprano del arrebato ahora (s), 12 la probabilidad difícil ahora (%),
// 13 la tinta ahora ×1000; §99: 14 la tabla de la IA cargada (0 la del juego, 1 la de RR), 15 karts de CPU mejorados en
// esta carrera, 16 el tope escrito ×1000, 17 veces que se subió el tope, 18 fallos de la tabla de RR, 19 la velocidad
// base escrita ×1000
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
        case 14: return g_archivo;
        case 15: return g_kartsMejorados;
        case 16: return static_cast<int32_t>(g_topeEscrito * 1000.0f);
        case 17: return g_topesSubidos;
        case 18: return g_fallosRR;
        case 19: return static_cast<int32_t>(g_baseEscrita * 1000.0f);
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

// §99: GetCustomKartAIParam de Pulsar (el Hard AI): r3..r6 = lo de ArchiveMgr::GetFile, r5 = el nombre del archivo.
// Con un nivel de la página en una carrera VS, la tabla la elegimos nosotros (la de RR para intenso e imposible, la del
// juego para los demás), sin mirar el ajuste guardado del jugador; si la de RR no se pudo leer, la del juego
extern "C" void rr_kamek_81830C50_traducida(CpuContext* ctx);
extern "C" void rr_kamek_81830C50(CpuContext* MKW_RESTRICT ctx) {
    if (g_perfil.nivel < 0 || !esVs()) { g_archivo = 0; rr_kamek_81830C50_traducida(ctx); return; }   // los menús: RR tal cual
    const CpuContext antes = *ctx;
    const bool rr = g_perfil.archivoRR && nombreRrValido();
    if (rr) ctx->gpr[5] = kNombreRR;
    InvokeDirectCpu<0x805411FCu>(ctx);                       // ArchiveMgr::GetFile
    if (rr && ctx->gpr[3] == 0) {                            // (sin la tabla de RR: la del juego)
        *ctx = antes;
        InvokeDirectCpu<0x805411FCu>(ctx);
        ++g_fallosRR;
    }
    g_archivo = rr && ctx->gpr[3] ? 1 : 0;
}

// §99: ApplyPlayerStatChanges de Pulsar (al crear cada kart; r28 = el número de jugador): primero lo de RR (200cc, la
// pista, la transmisión) y, si es una CPU, lo del nivel. r3 = la copia de estadísticas de ESE kart
extern "C" void rr_kamek_81839710_traducida(CpuContext* ctx);
extern "C" void rr_kamek_81839710(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t jugador = ctx->gpr[28];
    rr_kamek_81839710_traducida(ctx);
    mejorarKartCpu(jugador, ctx->gpr[3]);
}

// §99: Movement::UpdateAcceleration (la de RR), cada cuadro de cada kart: r3 = su Kart::Movement. El tope de las CPU,
// antes: el mismo cuadro ya frena en el nuevo (y KartSub::Update se lo pasa a la física)
extern "C" void rr_overlay_8057B9BC_traducida(CpuContext* ctx);
extern "C" void rr_overlay_8057B9BC(CpuContext* MKW_RESTRICT ctx) {
    if (g_topeActivo) subirTopeCpu(ctx->gpr[3]);
    rr_overlay_8057B9BC_traducida(ctx);
}
