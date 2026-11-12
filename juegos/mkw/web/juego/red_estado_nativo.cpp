// §275b: la sala «Cada uno su kart» — la red NATIVA del juego (RKNet) sin Wi-Fi de Nintendo ni Retro WFC: un DWC falso.
//
// Resumen. En la carrera en línea del Mario Kart Wii cada consola corre SU kart y les manda a las demás un paquete RACE
// (RACEHEADER_1 + RACEDATA + ITEM + EVENT, armado por RKNet::PacketMgr y RKNet::Controller) por DWC, la biblioteca de
// red de Nintendo. Aquí DWC no se conecta nunca: la sala de la página (sala-carrera.mjs) ya sabe quién juega, y la malla
// WebRTC lleva los paquetes. Este archivo hace de DWC «de mentira», solo con lo que la carrera usa:
//   - SALIDA: DWC_SendUnreliable (0x800E8654; RR la reemplaza) — el juego entrega el paquete RACE para la consola `aid`
//     → se copia y se le da a la página (Module.mkwRedEstadoEnviar(aid, bytes)), que lo manda por la malla.
//   - ENTRADA: la página deja cada paquete que llegó en una cola (mkw_red_estado_entregar); al empezar cada
//     RKNet::PacketMgr::Update (0x80653728, la de RR) se copia al búfer de recepción de esa consola (Pulsar:
//     CustomRKNetController +0x25B4 fullPulRecvPackets[aid]) y se llama a UserRecvCallback (0x806585F4), como hace DWC.
//   - QUIÉN ESTÁ: las consultas que hace el juego a DWC (cuántas consolas, mi aid, el de la anfitriona, el mapa de bits de
//     los conectados, los datos de cada conexión) contestan con lo que configuró la página (mkw_red_estado_config).
//   - EL ENVÍO DE CADA CUADRO: con DWC apagado nadie llama a RKNet::Controller::SendPacketsAndUpdateUSER (0x80657A70; el
//     bucle de red de Nintendo lo pide por un puntero): se llama al final de cada PacketMgr::Update.
//   - EL ESTADO DE RKNet::Controller (0x809C20D8): «conectado a una sala» (connectionState +0x28 = 6), el tipo de sala
//     (+0xE8: 5 anfitriona / 6 invitada de una sala de amigos) y qué aid tiene cada jugador (+0x2920 [12]).
// Todo apagado hasta que la página lo pide (mkw_red_estado_config(1, …)): sin eso, cada envoltura llama a la del juego.
// Como cambiar el módem de un equipo por un cable directo a la placa: el equipo sigue hablando su protocolo de siempre,
// y nosotros llevamos los bytes por otro medio.
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

#include <cstdint>
#include <cstring>

namespace {
constexpr uint32_t kControlador = 0x809C20D8;    // RKNet::Controller::sInstance
constexpr uint32_t kTope = 2048;                 // bytes de un paquete RACE (el de Pulsar es menor)
constexpr int kCola = 96;                        // paquetes esperando a entrar

int g_activo = 0;
uint32_t g_mi_aid = 0, g_anfitriona = 0, g_mapa = 0, g_consolas = 1, g_tipo_sala = 5;
uint8_t g_aid_de[12];                            // jugador → aid (lo que el juego guarda en +0x2920)
uint8_t g_jugadores_en[12];                      // aid → jugadores en esa consola (ConnectionUserData)
uint8_t g_salida[kTope];                         // el último paquete que el juego mandó (la página lo lee de aquí)
uint8_t g_llegada[kTope];                        // donde la página deja un paquete antes de encolarlo
struct Entrada { uint8_t aid; uint32_t tam; uint8_t datos[kTope]; };
Entrada g_cola[kCola];
int g_cola_ini = 0, g_cola_n = 0;
uint32_t g_paso = 0;                             // dónde va Update (0 terminó, 1 estado, 2 entrega, 3 la del juego, 4 envío)
uint32_t g_enviados = 0, g_recibidos = 0, g_tirados = 0, g_actualizaciones = 0, g_entregados = 0;
uint32_t g_oido[16];                              // (3c) el cuadro de red en que llegó lo último de cada aid (paquete RACE, lote de CPU o aviso)

template <uint32_t Funcion>
void llamar(const CpuContext* ctx, uint32_t r3, uint32_t r4 = 0, uint32_t r5 = 0, uint32_t r6 = 0) {
    CpuContext c = *ctx;
    c.gpr[3] = r3; c.gpr[4] = r4; c.gpr[5] = r5; c.gpr[6] = r6;
    InvokeDirectCpu<Funcion>(&c);
}

// deja a RKNet::Controller «en una sala» con los de la página (cada cuadro: el juego puede pisarlo)
void ponerEstado(const CpuContext* ctx) {
    const uint32_t c = Memory::Read32(kControlador);
    if (!c || !Memory::Contains(c, 0x2934)) return;
    Memory::Write32(c + 0x28, 6);                                    // CONNECTIONSTATE_ROOM
    Memory::Write32(c + 0xE8, g_tipo_sala);
    for (int i = 0; i < 12; i++) Memory::Write8(c + 0x2920 + i, g_aid_de[i]);
    Memory::Write32(c + 0x292C, 0);                                  // nadie desconectado (los cortes van por la sala)
    // las dos «subs» (+0x38, 0x58 cada una, ControllerSub de Pulsar) se llenan aquí. No se llama a UpdateSubsAndVR
    // (0x80658DE0): sin WFC, los datos de usuario de DWC no existen y esa función leía su código «RMCP» como un puntero
    // (el juego se caía en el cuadro 2 de la carrera). Las dos iguales, así no importa cuál marque currentSub (+0x291C).
    uint32_t jugadores = 0;
    for (int a = 0; a < 12; a++) if (g_mapa >> a & 1) jugadores += g_jugadores_en[a] ? g_jugadores_en[a] : 1;
    for (int k = 0; k < 2; k++) {
        const uint32_t s = c + 0x38 + 0x58 * k;
        Memory::Write32(s + 0x8, g_consolas);                         // connectionCount
        Memory::Write32(s + 0xC, jugadores);                          // playerCount
        Memory::Write32(s + 0x10, g_mapa);                            // availableAids
        Memory::Write32(s + 0x14, g_mapa & ~(1u << g_mi_aid));        // directConnectedAids
        Memory::Write32(s + 0x18, 1);                                 // groupId (cualquiera fijo)
        Memory::Write32(s + 0x1C, 0);                                 // friendToJoin
        Memory::Write8(s + 0x20, g_jugadores_en[g_mi_aid] ? g_jugadores_en[g_mi_aid] : 1);   // localPlayerCount
        Memory::Write8(s + 0x21, static_cast<uint8_t>(g_mi_aid));     // localAid
        Memory::Write8(s + 0x22, static_cast<uint8_t>(g_anfitriona)); // hostAid
        for (int a = 0; a < 12; a++) {                                // connectionUserDatas[aid] = {jugadores, 0, 0, 0}
            Memory::Write8(s + 0x23 + 4 * a, (g_mapa >> a & 1) ? (g_jugadores_en[a] ? g_jugadores_en[a] : 1) : 0);
            Memory::Write8(s + 0x24 + 4 * a, 0); Memory::Write8(s + 0x25 + 4 * a, 0); Memory::Write8(s + 0x26 + 4 * a, 0);
        }
        Memory::Write8(s + 0x53, 0);                                  // matchingSuspended
    }
    (void)ctx;
}
}  // namespace

// La página: prender/apagar y decir quién es quién. mapa = bit por aid conectado (incluido el mío)
// activo: bit 0 = prendido; bit 1 = los karts de afuera con el modelo completo, como el juego en línea (?kartLiviano=0)
namespace { int g_kart_liviano = 1; uint32_t g_kart_liviano_n = 0; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_red_estado_config(int activo, uint32_t miAid, uint32_t anfitriona, uint32_t mapa, uint32_t consolas) {
    g_activo = activo & 1;
    g_kart_liviano = (activo & 2) ? 0 : 1;
    g_mi_aid = miAid & 0xF; g_anfitriona = anfitriona & 0xF; g_mapa = mapa & 0xFFF; g_consolas = consolas ? consolas : 1;
    g_tipo_sala = g_mi_aid == g_anfitriona ? 5u : 6u;
    if (!activo) g_cola_n = 0;
}
// jugador (0-11) → aid de su consola; y cuántos jugadores tiene cada consola (1 o 2)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_red_estado_jugador(uint32_t jugador, uint32_t aid, uint32_t enConsola) {
    if (jugador < 12) g_aid_de[jugador] = static_cast<uint8_t>(aid);
    if (aid < 12) g_jugadores_en[aid] = static_cast<uint8_t>(enConsola);
}
// donde la página escribe un paquete que llegó (kTope bytes) y lo encola
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_red_estado_llegada() { return g_llegada; }
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_red_estado_salida() { return g_salida; }
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_red_estado_entregar(uint32_t aid, uint32_t tam) {
    if (!g_activo || aid >= 12 || !tam || tam > kTope) { g_tirados++; return 0; }
    if (g_cola_n == kCola) { g_cola_ini = (g_cola_ini + 1) % kCola; g_cola_n--; g_tirados++; }   // se tira el más viejo
    Entrada& e = g_cola[(g_cola_ini + g_cola_n) % kCola];
    e.aid = static_cast<uint8_t>(aid); e.tam = tam; std::memcpy(e.datos, g_llegada, tam);
    g_cola_n++; g_recibidos++;
    return 1;
}
// 0 activo, 1 enviados, 2 recibidos, 3 tirados, 4 actualizaciones de PacketMgr, 5 entregados al juego, 6 en cola, 7 paso,
// 8 armados de karts de afuera con el modelo liviano (_4; Init y CreateModel: 2 por kart)
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_red_estado_estado(int i) {
    const uint32_t v[] = {static_cast<uint32_t>(g_activo), g_enviados, g_recibidos, g_tirados, g_actualizaciones, g_entregados, static_cast<uint32_t>(g_cola_n), g_paso, g_kart_liviano_n};
    return i >= 0 && i < 9 ? v[i] : 0;
}

EM_JS(void, mkw_red_estado_enviar_js, (int aid, int tam), {
    if (Module.mkwRedEstadoEnviar) Module.mkwRedEstadoEnviar(aid, tam);
});

// ---- SALIDA: DWC_SendUnreliable(aid, búfer, tamaño) → la página ----
extern "C" void rr_overlay_800E8654_traducida(CpuContext* ctx);
extern "C" void rr_overlay_800E8654(CpuContext* ctx) {
    if (!g_activo) { rr_overlay_800E8654_traducida(ctx); return; }
    const uint32_t aid = ctx->gpr[3] & 0xFF, buf = ctx->gpr[4], tam = ctx->gpr[5];
    if (aid < 12 && tam && tam <= kTope && Memory::Contains(buf, tam)) {
        for (uint32_t i = 0; i < tam; i++) g_salida[i] = Memory::Read8(buf + i);
        mkw_red_estado_enviar_js(static_cast<int>(aid), static_cast<int>(tam));
        g_enviados++;
        ctx->gpr[3] = 1;
    } else ctx->gpr[3] = 0;
}
extern "C" void func_800E8654_traducida(CpuContext* ctx);
extern "C" void func_800E8654(CpuContext* ctx) {
    if (!g_activo) { func_800E8654_traducida(ctx); return; }
    rr_overlay_800E8654(ctx);
}

// ---- LOS KARTS DE AFUERA CON EL MODELO LIVIANO (§275b) ----
// Cada kart con su piloto viene en dos versiones: Race/Kart/<kart>-<piloto>.szs (el modelo completo) y <…>_4.szs (el
// liviano, el de la pantalla partida). Lo decide el byte +7 del escenario de la carrera (Racedata +0x20 +7, que escribe
// RacedataScenario::Init con las pantallas contadas antes del arreglo de RR = los humanos locales): con 2 o más,
// RaceScene::OnEnter le pasa a ArchiveMgr::LoadKartArchive (0x80540E3C, r8) el 2 = «_4» para los tipos 1 (CPU) y 4 (en
// línea), y Kart::BRRESHandle::__ct (en Kart::Player::Init) y DriverController::Load (en Kart::Player::CreateModel) buscan dentro los
// nombres del liviano. En «Cada uno su kart» hay un humano por consola: +7 = 1 y los 11 de afuera van con el completo.
// Aquí, solo para los karts de afuera (tipo ≠ 0) y solo mientras se cargan: el archivo _4 y, durante su
// Kart::Player::Init, el byte +7 en 2 (vuelve al valor de antes al salir). Lo demás que lee +7 (la cámara, los efectos,
// los objetos, las luces) sigue viendo 1. Solo cambia lo que se ve; la lógica del kart no lee el modelo.
// (Pedir solo el archivo _4, sin el +7, hacía caer el juego: BRRESHandle buscaba los nombres del completo.)
namespace {
constexpr uint32_t kRacedataPtr = 0x809BD728;   // Racedata* (+0x20 el escenario; +0x27 el byte; jugador i en +0x28 + i·0xF0, tipo +0x10)
bool esDeAfuera(uint32_t i, uint32_t& rd) {
    rd = Memory::Contains(kRacedataPtr, 4) ? Memory::Read32(kRacedataPtr) : 0;
    if (!g_activo || !g_kart_liviano || i >= 12 || !rd || !Memory::Contains(rd + 0x28 + i * 0xF0 + 0x10, 4)) return false;
    return Memory::Read32(rd + 0x28 + i * 0xF0 + 0x10) != 0;
}
void archivoLiviano(CpuContext* ctx) {
    uint32_t rd; if (esDeAfuera(ctx->gpr[4] & 0xFF, rd) && ctx->gpr[8] == 0) ctx->gpr[8] = 2;
}
}  // namespace
extern "C" void rr_overlay_80540E3C_traducida(CpuContext* ctx);
extern "C" void rr_overlay_80540E3C(CpuContext* ctx) { archivoLiviano(ctx); rr_overlay_80540E3C_traducida(ctx); }
extern "C" void func_80540E3C_traducida(CpuContext* ctx);
extern "C" void func_80540E3C(CpuContext* ctx) { archivoLiviano(ctx); func_80540E3C_traducida(ctx); }
// Kart::Player::Init(this) (BRRESHandle, 0x8058E22C) y Kart::Player::CreateModel(this) (DriverController::Load, las
// animaciones del piloto, 0x8058F820): el jugador sale de this +0x14 → +0x10 (como lo lee el juego para BRRESHandle)
namespace {
template <void (*F)(CpuContext*)> void conMasPantallas(CpuContext* ctx) {
    const uint32_t p = Memory::Contains(ctx->gpr[3] + 0x14, 4) ? Memory::Read32(ctx->gpr[3] + 0x14) : 0;
    const uint32_t i = p && Memory::Contains(p + 0x10, 1) ? Memory::Read8(p + 0x10) : 0xFF;
    uint32_t rd;
    if (!esDeAfuera(i, rd) || !Memory::Contains(rd + 0x27, 1) || Memory::Read8(rd + 0x27) >= 2) { F(ctx); return; }
    const uint8_t antes = Memory::Read8(rd + 0x27);
    Memory::Write8(rd + 0x27, 2);
    F(ctx);
    Memory::Write8(rd + 0x27, antes);
    g_kart_liviano_n++;
}
}  // namespace
extern "C" void func_8058E22C_traducida(CpuContext* ctx);
extern "C" void func_8058E22C(CpuContext* ctx) { conMasPantallas<func_8058E22C_traducida>(ctx); }
extern "C" void func_8058F820_traducida(CpuContext* ctx);
extern "C" void func_8058F820(CpuContext* ctx) { conMasPantallas<func_8058F820_traducida>(ctx); }

// ---- QUIÉN ESTÁ: las consultas a DWC ----
#define MKW_DWC_RESPUESTA(dir, valor)                                   \
    extern "C" void func_##dir##_traducida(CpuContext* ctx);            \
    extern "C" void func_##dir(CpuContext* ctx) {                       \
        if (!g_activo) { func_##dir##_traducida(ctx); return; }         \
        ctx->gpr[3] = (valor);                                          \
    }
MKW_DWC_RESPUESTA(800D2158, g_consolas)                                // DWC_GetNumConnectionHost
MKW_DWC_RESPUESTA(800D2170, g_mi_aid)                                  // DWC_GetMyAid
MKW_DWC_RESPUESTA(800D225C, g_mapa)                                    // DWC_GetDirectConnectedAIDBitmap
MKW_DWC_RESPUESTA(800D24B4, g_mapa)                                    // DWC_GetAidBitmap
MKW_DWC_RESPUESTA(800D26E8, g_anfitriona)                              // DWC_GetServerAid
MKW_DWC_RESPUESTA(800D2760, g_mi_aid == g_anfitriona ? 1u : 0u)        // DWC_IsServerMyself
MKW_DWC_RESPUESTA(800D49B4, 0u)                                        // DWC_GetSuspendMatch
// DWC_GetLastErrorEx(&código, &tipo): sin error (0 en los dos y en la respuesta)
extern "C" void func_800CCB64_traducida(CpuContext* ctx);
extern "C" void func_800CCB64(CpuContext* ctx) {
    if (!g_activo) { func_800CCB64_traducida(ctx); return; }
    if (ctx->gpr[3] && Memory::Contains(ctx->gpr[3], 4)) Memory::Write32(ctx->gpr[3], 0);
    if (ctx->gpr[4] && Memory::Contains(ctx->gpr[4], 4)) Memory::Write32(ctx->gpr[4], 0);
    ctx->gpr[3] = 0;
}
// DWC_GetConnectionUserData(aid, puntero a 4 bytes): {jugadores en esa consola, 0, 0, 0}
extern "C" void func_800D4AC8_traducida(CpuContext* ctx);
extern "C" void func_800D4AC8(CpuContext* ctx) {
    if (!g_activo) { func_800D4AC8_traducida(ctx); return; }
    const uint32_t aid = ctx->gpr[3] & 0xFF, p = ctx->gpr[4];
    const bool hay = aid < 12 && (g_mapa >> aid & 1);
    if (hay && Memory::Contains(p, 4)) Memory::Write32(p, static_cast<uint32_t>(g_jugadores_en[aid] ? g_jugadores_en[aid] : 1) << 24);
    ctx->gpr[3] = hay ? 1u : 0u;
}

void mkwRedEstadoCpuMandar(const CpuContext* ctx);
void mkwRedEstadoFinCuadro(const CpuContext* ctx);
// ---- ENTRADA y el envío de cada cuadro: alrededor de RKNet::PacketMgr::Update (la de RR) ----
extern "C" void rr_overlay_80653728_traducida(CpuContext* ctx);
extern "C" void rr_overlay_80653728(CpuContext* ctx) {
    if (!g_activo) { rr_overlay_80653728_traducida(ctx); return; }
    g_actualizaciones++;
    g_paso = 1; ponerEstado(ctx); g_paso = 2;
    const uint32_t c = Memory::Read32(kControlador);
    // lo que llegó: al búfer de recepción de esa consola y UserRecvCallback, como DWC
    while (g_cola_n && c) {
        Entrada& e = g_cola[g_cola_ini];
        g_cola_ini = (g_cola_ini + 1) % kCola; g_cola_n--;
        const uint32_t buf = Memory::Read32(c + 0x25B4 + 4 * e.aid);
        if (!buf || !Memory::Contains(buf, e.tam)) { g_tirados++; continue; }
        for (uint32_t i = 0; i < e.tam; i++) Memory::Write8(buf + i, e.datos[i]);
        llamar<0x806585F4u>(ctx, e.aid, buf, e.tam);
        g_entregados++; if (e.aid < 16) g_oido[e.aid] = g_actualizaciones;
    }
    g_paso = 3; rr_overlay_80653728_traducida(ctx);
    // el envío: lo que hace SendPacketsAndUpdateUSER (0x80657A70) SIN su último paso, USERHandler::Update (0x806629C0),
    // que arma el paquete USER (código de amigo, Mii) con los datos de usuario de DWC: sin WFC no existen y el juego se
    // caía leyendo su «RMCP» como un puntero. Los nombres y los Mii de la carrera los pone la sala (nombres_nativo.cpp).
    g_paso = 4; if (c) { llamar<0x80657AB0u>(ctx, c); llamar<0x80657E30u>(ctx, c); }   // CombineSplitSendPackets, TrySendNextRACEPacket
    g_paso = 5; mkwRedEstadoCpuMandar(ctx); mkwRedEstadoFinCuadro(ctx);                             // (3b) las CPU que corro, juntas
    g_paso = 0;
}
extern "C" void func_80653728_traducida(CpuContext* ctx);
extern "C" void func_80653728(CpuContext* ctx) {
    if (!g_activo) { func_80653728_traducida(ctx); return; }
    rr_overlay_80653728(ctx);
}

// ---- 3b: las CPU (siempre 12 karts). La anfitriona las corre; las demás las mueven como karts remotos ----
// En la carrera en línea del juego no hay CPU, y cada consola manda solo los karts de sus personas (2 como mucho por
// consola en el paquete RACE). Para que las 10 CPU sean LAS MISMAS en todas las pantallas:
//   - la anfitriona las corre de verdad (tipo 1) y, cuando el juego guarda el registro de 64 bytes de un kart para mandarlo
//     (ExportRacedata 0x80653960, desde sendRacedataRecord 0x8058CABC, cada 2 cuadros), si ese kart es una CPU nos lo
//     quedamos (no entra al paquete del juego) y al terminar el cuadro de red la página los manda juntos;
//   - en las demás consolas esas CPU son karts remotos (tipo 4, de la consola anfitriona) y cuando el juego pide su
//     registro (GetRacedata 0x80653ABC, desde el RacedataHandler del kart remoto) le damos el último que llegó.
// Los registros que llegan se guardan en la memoria del juego, en la parte del RKNet::Controller que Pulsar dejó sin uso
// (`defaultBuffer`, desde +0x361: Pulsar recibe en búferes propios), 64 bytes por jugador desde +0x380.
// Como un repetidor de telemetría: la anfitriona mide sus 10 motores y le pasa la lectura a cada sala de control.
namespace {
constexpr uint32_t kCpuGuardado = 0x380;          // + 64·jugador dentro del Controller (hasta +0x680; libre hasta +0x25B0)
uint8_t g_cpu_modo[12];                            // 0 nada, 1 la corro yo y la mando, 2 me llega de la anfitriona
uint8_t g_cpu_salida[2 + 12 * 65];                 // [0xA9, 0xFE, (jugador, 64 bytes)…] para la página
uint32_t g_cpu_n = 0;                              // cuántas CPU hay en g_cpu_salida
uint32_t g_cpu_capturados = 0, g_cpu_llegados = 0, g_cpu_dados = 0, g_cpu_sin_fabrica = 0;
}  // namespace

EM_JS(void, mkw_red_estado_cpu_js, (int tam), {
    if (Module.mkwRedEstadoCpu) Module.mkwRedEstadoCpu(tam);
});

// ¿el puesto j es una CPU de la sala? (nombres_nativo.cpp: las skins de las CPU en «Cada uno su kart»)
extern "C" int mkw_red_estado_es_cpu(int jugador) { return g_activo && jugador >= 0 && jugador < 12 && g_cpu_modo[jugador] != 0; }
// la página: qué hace cada jugador CPU en esta consola
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_red_estado_cpu(uint32_t jugador, uint32_t modo) {
    if (jugador < 12) g_cpu_modo[jugador] = static_cast<uint8_t>(modo);
}
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_red_estado_cpu_salida() { return g_cpu_salida; }
// la página dejó en mkw_red_estado_llegada() un lote [0xA9, 0xFE, (jugador, 64 bytes)…]: a la memoria del juego
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_red_estado_cpu_entregar(uint32_t tam) {
    if (g_anfitriona < 16) g_oido[g_anfitriona] = g_actualizaciones;
    const uint32_t c = Memory::Read32(kControlador);
    if (!g_activo || !c || tam < 2 || tam > sizeof(g_cpu_salida)) return 0;
    int n = 0;
    for (uint32_t p = 2; p + 65 <= tam; p += 65) {
        const uint32_t j = g_llegada[p];
        if (j >= 12 || g_cpu_modo[j] != 2) continue;
        for (uint32_t i = 0; i < 64; i++) Memory::Write8(c + kCpuGuardado + 64 * j + i, g_llegada[p + 1 + i]);
        n++;
    }
    g_cpu_llegados += n;
    return n;
}
// 0 capturados (anfitriona), 1 llegados, 2 dados al juego, 3 CPU sin fábrica
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_red_estado_cpu_estado(int i) {
    const uint32_t v[] = {g_cpu_capturados, g_cpu_llegados, g_cpu_dados, g_cpu_sin_fabrica};
    return i >= 0 && i < 4 ? v[i] : 0;
}
// lo que se juntó en este cuadro de red sale a la página (lo llama la envoltura de PacketMgr::Update, con su ctx).
// El juego NO arma el registro de las CPU: Kart::Player::ApplyPhysics llama a sendRacedataRecord solo si el kart es de una
// persona de esta consola (bit 4 de las banderas del jugador). Así que aquí, cada 2 cuadros como el juego, para cada CPU
// que corro: su fábrica de RACEDATA (Kart::Player +0x58, la crea Kart::Player::Init en toda carrera en línea) arma el
// registro (pack 0x8058CB30, que lo deja en fábrica +0x14) y lo copio al lote.
// Kart::Player::Init crea la fábrica solo para los karts de personas: a cada CPU se la armo yo, a mano, en la parte del
// Controller que Pulsar no usa (+0x700 + 0x90·jugador). Es lo que harían sus constructores (0x8058CA28 y 0x8058D3CC):
// dos «proxies» del kart (+0 = el accessor del kart, el mismo que Kart::Player +0; +0xC = su tabla de funciones) sin
// meterlas en la lista global de proxies (esa lista se recorre cuando se arma un kart: ya pasó). La fábrica (0x5C bytes)
// apunta en +0x10 a su ayudante (0x28 bytes, +0x10/+0x14/+0x18 en 0), y en +0x14 deja el registro de 64 bytes.
uint32_t fabricaDeCpu(uint32_t j, uint32_t jugador) {
    const uint32_t c = Memory::Read32(kControlador);
    if (!c) return 0;
    const uint32_t fab = c + 0x700 + 0x90 * j, ayu = fab + 0x60, acc = Memory::Read32(jugador);
    if (!acc) return 0;
    if (Memory::Read32(fab) == acc && Memory::Read32(fab + 0xC) == 0x808B6288u) return fab;   // (ya armada para este kart)
    for (uint32_t i = 0; i < 0x90; i += 4) Memory::Write32(fab + i, 0);
    Memory::Write32(fab + 0x0, acc); Memory::Write32(fab + 0xC, 0x808B6288u); Memory::Write32(fab + 0x10, ayu);
    Memory::Write32(ayu + 0x0, acc); Memory::Write32(ayu + 0xC, 0x808B6298u);
    return fab;
}
void mkwRedEstadoCpuMandar(const CpuContext* ctx) {
    static uint32_t paridad = 0;
    const uint32_t km = Memory::Read32(0x809C18F8);                  // Kart::Manager
    if (km && (++paridad & 1) == 0) {
        const uint32_t lista = Memory::Read32(km + 0x20), n = Memory::Read8(km + 0x24);
        for (uint32_t j = 0; j < n && j < 12 && lista; j++) {
            if (g_cpu_modo[j] != 1 || g_cpu_n >= 12) continue;
            const uint32_t jugador = Memory::Read32(lista + 4 * j);
            uint32_t fab = jugador ? Memory::Read32(jugador + 0x58) : 0;
            if (!fab && jugador) fab = fabricaDeCpu(j, jugador);
            if (!fab || !Memory::Contains(fab + 0x14, 64)) { g_cpu_sin_fabrica++; continue; }
            llamar<0x8058CB30u>(ctx, fab);                            // RacedataFactory: arma el registro
            uint8_t* d = g_cpu_salida + 2 + 65 * g_cpu_n;
            d[0] = static_cast<uint8_t>(j);
            for (uint32_t i = 0; i < 64; i++) d[1 + i] = Memory::Read8(fab + 0x14 + i);
            g_cpu_n++; g_cpu_capturados++;
        }
    }
    if (!g_cpu_n) return;
    g_cpu_salida[0] = 0xA9; g_cpu_salida[1] = 0xFE;
    mkw_red_estado_cpu_js(static_cast<int>(2 + 65 * g_cpu_n));
    g_cpu_n = 0;
}

// ExportRacedata(PacketMgr, registro, 64, jugador): el de una CPU que corro yo se queda aquí
extern "C" void func_80653960_traducida(CpuContext* ctx);
extern "C" void func_80653960(CpuContext* ctx) {
    const uint32_t j = ctx->gpr[6] & 0xFF, reg = ctx->gpr[4];
    if (!g_activo || j >= 12 || g_cpu_modo[j] != 1) { func_80653960_traducida(ctx); return; }
    if (Memory::Contains(reg, 64) && g_cpu_n < 12) {
        uint8_t* d = g_cpu_salida + 2 + 65 * g_cpu_n;
        d[0] = static_cast<uint8_t>(j);
        for (uint32_t i = 0; i < 64; i++) d[1 + i] = Memory::Read8(reg + i);
        g_cpu_n++; g_cpu_capturados++;
    }
}
// GetRacedata(·, jugador) → el registro de ese kart remoto; el de una CPU de la anfitriona, el último que llegó
extern "C" void func_80653ABC_traducida(CpuContext* ctx);
extern "C" void func_80653ABC(CpuContext* ctx) {
    const uint32_t j = ctx->gpr[4];
    func_80653ABC_traducida(ctx);                                    // (solo lee: deja los demás registros como siempre)
    if (!g_activo || j >= 12 || g_cpu_modo[j] != 2) return;
    const uint32_t c = Memory::Read32(kControlador);
    if (!c) return;
    ctx->gpr[3] = c + kCpuGuardado + 64 * j;
    g_cpu_dados++;
}

// ---- 3c: el fin de la carrera ----
// Cada consola es dueña de la llegada de SUS karts (sus personas y, la anfitriona, también las 10 CPU): el juego de
// esa consola los ve cruzar la meta de verdad. En las otras consolas esos karts son remotos y el juego no los da por
// llegados (no lleva la cuenta de vueltas de un kart remoto). Por eso cada consola manda, cada 15 cuadros, quiénes de
// los suyos ya llegaron y con qué tiempo ([0xA9, 0xFD, máscara, tiempo en ms de cada uno]), y quien lo recibe termina
// ese kart remoto con ese tiempo (RaceinfoPlayer::EndRace 0x805347F4, la misma que corre al cruzar la meta, sin cámara):
// así el juego de cada consola arma la tabla con los MISMOS tiempos. La carrera termina, como en la sala de siempre,
// cuando llegaron todos los humanos (GMDataVS::CanRaceEnd en lockstep_nativo.cpp). Si una consola deja de avisar (se
// cortó), a los 3 s de vencido el plazo DNF a sus humanos se les pone el tiempo de ese momento.
extern "C" uint32_t g_mkwHumanos;                   // (semillas_nativo.cpp: bit i = el puesto i es un humano de la sala)
extern "C" int32_t mkw_sala_dnf_desde();            // (lockstep_nativo.cpp: el reloj de la carrera cuando llegó el primero)
namespace {
uint32_t g_llego_remoto = 0;                        // bit i = el kart i (de otra consola) avisó que llegó
uint32_t g_llego_ms[12];                            // con este tiempo
uint32_t g_llego_puestos = 0;                       // bit i = ya lo terminé aquí (EndRace)
uint32_t g_llego_avisos = 0, g_fin_por_dnf = 0, g_endrace = 0;
uint32_t g_dnf_ms = 30000;
uint32_t g_por_etapa[8];                          // (diagnóstico) cuadros de red vistos en cada etapa de Raceinfo
uint32_t g_salto_mask = 0, g_salto_flags = 0, g_salto_ms = 0;   // (diagnóstico) a quién no se terminó y por qué
uint32_t g_mios_antes = 0;                         // los míos que ya había avisado (para avisar apenas cambia)
uint32_t g_humanos_red = 0;                        // bit i = el puesto i es un humano de la sala (de esta consola o de otra)
uint32_t g_tiempos_mios[12];                        // lo que mando: el tiempo de cada uno de los míos que llegó
uint32_t jugadorDe(uint32_t i) {
    const uint32_t ri = Memory::Read32(0x809BD730u);
    if (!ri || !Memory::Contains(ri, 0x2C)) return 0;
    const uint32_t lista = Memory::Read32(ri + 0xC);
    if (!lista || !Memory::Contains(lista, 48)) return 0;
    const uint32_t p = Memory::Read32(lista + 4 * i);
    return p && Memory::Contains(p, 0x54) ? p : 0;
}
uint32_t llegaronAqui() {                           // bit i = el jugador i cruzó la meta en esta consola
    uint32_t m = 0;
    for (uint32_t i = 0; i < 12; i++) { const uint32_t p = jugadorDe(i); if (p && (Memory::Read32(p + 0x38) & 2u)) m |= 1u << i; }
    return m;
}
uint32_t tiempoMs(uint32_t t) {                     // un Timer del juego (+4 minutos, +6 segundos, +8 milésimas) en ms
    return t && Memory::Contains(t, 0xC) ? (Memory::Read16(t + 4) * 60u + Memory::Read8(t + 6)) * 1000u + Memory::Read16(t + 8) : 0;
}
uint32_t relojCarrera() {
    const uint32_t ri = Memory::Read32(0x809BD730u), r = ri ? Memory::Read32(ri + 0x14) : 0;
    return r && Memory::Contains(r, 0x10) ? (Memory::Read16(r + 0x8) * 60u + Memory::Read8(r + 0xA)) * 1000u + Memory::Read16(r + 0xC) : 0;
}
// termina aquí el kart remoto i con `ms` (un Timer armado en la parte libre del Controller, +0xE00 + 0x10·i)
void terminarRemoto(const CpuContext* ctx, uint32_t i, uint32_t ms) {
    const uint32_t p = jugadorDe(i), c = Memory::Read32(kControlador);
    if (!p || !c || (Memory::Read32(p + 0x38) & 2u)) {
        g_salto_mask |= 1u << i; g_salto_flags = p ? Memory::Read32(p + 0x38) | (c ? 0 : 0x80000000u) : 0xFFFFFFFFu; g_salto_ms = relojCarrera();
        g_llego_puestos |= 1u << i; return;
    }
    const uint32_t t = c + 0xE00 + 0x10 * i;
    Memory::Write32(t, 0x808B2D44u);                                  // Timer: tabla, minutos, segundos, milésimas, activo
    Memory::Write16(t + 4, static_cast<uint16_t>(ms / 60000)); Memory::Write8(t + 6, static_cast<uint8_t>(ms / 1000 % 60));
    Memory::Write8(t + 7, 0); Memory::Write16(t + 8, static_cast<uint16_t>(ms % 1000)); Memory::Write8(t + 0xA, 1); Memory::Write8(t + 0xB, 0);
    llamar<0x805347F4u>(ctx, p, t, 1, 1);                            // EndRace(tiempo, sin cámara, 1)
    g_llego_puestos |= 1u << i; g_endrace++;
}
}  // namespace
EM_JS(void, mkw_red_estado_llego_js, (int mascara), {
    if (Module.mkwRedEstadoLlego) Module.mkwRedEstadoLlego(mascara);
});
// el tiempo (ms) del jugador i de esta consola que llegó (la página lo pone en el aviso)
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_red_estado_llego_tiempo(uint32_t i) { return i < 12 ? g_tiempos_mios[i] : 0; }
// la página: el aviso de la consola `aid`: el jugador i llegó con `ms` (solo cuentan los karts de esa consola)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_red_estado_llego(uint32_t aid, uint32_t i, uint32_t ms) {
    if (!g_activo || aid >= 12 || i >= 12 || aid == g_mi_aid || g_aid_de[i] != aid) return;
    g_oido[aid] = g_actualizaciones;
    if (!(g_llego_remoto >> i & 1)) { g_llego_remoto |= 1u << i; g_llego_ms[i] = ms; }
}
// la página: los humanos de la sala. semillas_nativo.cpp arma g_mkwHumanos solo con los que tienen mando en ESTA consola;
// sin los de las otras, GMDataVS::CanRaceEnd (lockstep_nativo.cpp) daba la carrera por terminada apenas llegaba el mío y
// el juego les ponía a los demás un tiempo estimado. Se suman en cada cuadro de red (semillas los borra al armar la carrera).
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_red_estado_humanos(uint32_t mascara) { g_humanos_red = mascara & 0xFFF; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_red_estado_dnf(uint32_t ms) { g_dnf_ms = ms ? ms : 30000; }
// 0 llegaron aquí, 1 avisados por las otras, 2 avisos mandados, 3 bit i = el kart i lo terminó el respaldo (su consola
// dejó de avisar: se fue; el VR lo cuenta como cortado), 4 EndRace hechos
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_red_estado_fin(int i) {
    const uint32_t v[] = {llegaronAqui(), g_llego_remoto, g_llego_avisos, g_fin_por_dnf, g_endrace};
    if (i >= 10 && i < 18) return g_por_etapa[i - 10];
    if (i == 5) return g_salto_mask; if (i == 6) return g_salto_flags; if (i == 7) return g_salto_ms;   // 10+e = cuadros de red en la etapa e
    return i >= 0 && i < 5 ? v[i] : 0;
}
// (para lockstep_nativo.cpp: GMDataVS::CanRaceEnd = cuando terminaron todos los humanos, también en esta carrera)
extern "C" int mkw_red_estado_activo() { return g_activo; }
// (para lockstep_nativo.cpp: el plazo DNF y el tiempo límite no terminan aquí a un humano de otra consola)
extern "C" int mkw_red_estado_ajeno(uint32_t i) { return g_activo && i < 12 && g_aid_de[i] != g_mi_aid; }
// (para GMDataVS::CanRaceEnd en lockstep_nativo.cpp) 1 = algún kart de otra consola todavía no está terminado aquí: la
// carrera espera su aviso (si no, el juego le pondría a ese kart un tiempo estimado por ESTA consola, distinto). Si esa
// consola se cortó, el respaldo de abajo (plazo DNF + 3 s) lo termina igual.
extern "C" int mkw_red_estado_espera() {
    if (!g_activo) return 0;
    for (uint32_t i = 0; i < 12; i++) {
        if (g_aid_de[i] >= 12 || g_aid_de[i] == g_mi_aid) continue;
        const uint32_t p = jugadorDe(i);
        if (p && !(Memory::Read32(p + 0x38) & 2u)) return 1;
    }
    return 0;
}
// cada cuadro de red (desde la envoltura de PacketMgr::Update)
void mkwRedEstadoFinCuadro(const CpuContext* ctx) {
    const uint32_t ri = Memory::Read32(0x809BD730u);
    const uint32_t etapa = ri && Memory::Contains(ri, 0x2C) ? Memory::Read32(ri + 0x28) : 0;
    g_por_etapa[etapa < 7 ? etapa : 7]++;
    g_mkwHumanos |= g_humanos_red;
    if (etapa < 2) { g_llego_remoto = 0; g_llego_puestos = 0; g_mios_antes = 0; g_salto_mask = 0; g_fin_por_dnf = 0; for (auto& t : g_tiempos_mios) t = 0; if (etapa == 0) for (auto& n : g_por_etapa) n = 0; return; }
    if (etapa > 4) return;                                          // (3 un cuadro y 4 = los de esta consola ya llegaron y los demás siguen corriendo)
    // los avisos que llegaron: terminar esos karts remotos aquí, con su tiempo
    for (uint32_t i = 0; i < 12; i++) if ((g_llego_remoto >> i & 1) && !(g_llego_puestos >> i & 1)) terminarRemoto(ctx, i, g_llego_ms[i]);
    // el DNF venció hace 3 s y un kart de otra consola (humano o, si se cortó la anfitriona, CPU) no avisó: con el tiempo de ahora
    // (con la llegada del PRIMERO según los tiempos de la carrera, que son los mismos en todas las consolas —no con el reloj de
    // cada una, que va unos cuadros corrido—: el tiempo que se le pone es el mismo en todas)
    uint32_t primero = 0xFFFFFFFFu;
    for (uint32_t i = 0; i < 12; i++) { const uint32_t p = jugadorDe(i);
        if (p && (Memory::Read32(p + 0x38) & 2u)) { const uint32_t t = tiempoMs(Memory::Read32(p + 0x40)); if (t && t < primero) primero = t; } }
    if (primero != 0xFFFFFFFFu && relojCarrera() >= primero + g_dnf_ms + 3000) {
        const uint32_t t = primero + g_dnf_ms + 3000;
        g_salto_flags = primero; g_salto_ms = relojCarrera();             // (diagnóstico: con qué «primero» y a qué hora)
        for (uint32_t i = 0; i < 12; i++)
            // (solo los de una consola que se calló —más de 2 s, 120 cuadros de red, sin nada de ella—: si sigue mandando,
            // su aviso va a llegar: las CPU de la anfitriona todavía corren cuando vence el plazo)
            if (g_aid_de[i] < 12 && g_aid_de[i] != g_mi_aid && !(g_llego_puestos >> i & 1) && g_actualizaciones - g_oido[g_aid_de[i]] > 120) {
                terminarRemoto(ctx, i, t); g_fin_por_dnf |= 1u << i; }
    }
    // mi aviso cada 15 cuadros: los míos (personas y, si soy la anfitriona, las CPU) que ya llegaron, con su tiempo
    static uint32_t k = 0;
    uint32_t m = 0;
    for (uint32_t i = 0; i < 12; i++) {
        if (g_aid_de[i] != g_mi_aid) continue;
        const uint32_t p = jugadorDe(i);
        if (p && (Memory::Read32(p + 0x38) & 2u)) { m |= 1u << i; g_tiempos_mios[i] = tiempoMs(Memory::Read32(p + 0x40)); }
    }
    // apenas llega uno de los míos, en el mismo cuadro; después se repite cada 15 cuadros (por si se pierde uno)
    if (m && (m != g_mios_antes || ++k % 15 == 0)) { mkw_red_estado_llego_js(static_cast<int>(m)); g_llego_avisos++; g_mios_antes = m; }
}

// Raceinfo::CreateGMData(raceinfo, modo) (0x80532188): en «Cada uno su kart» la carrera se juega con las reglas de la
// carrera VS de siempre (GMDataVS, modo 1) y no con las de la carrera en línea (GMDataOnlineVS, modo 7: su fin espera
// los paquetes RH2 de todos, y aquí las 10 CPU de la anfitriona nunca los mandan). Los karts de las otras consolas los
// sigue moviendo la red (eso no depende de este objeto). Así cada consola termina su carrera cuando su humano cruza la
// meta (GMDataVS::CanRaceEnd), con el plazo DNF y el tiempo límite de la sala como siempre (lockstep_nativo.cpp).
extern "C" void func_80532188_traducida(CpuContext* ctx);
extern "C" void func_80532188(CpuContext* ctx) {
    if (g_activo && ctx->gpr[4] == 7) ctx->gpr[4] = 1;
    func_80532188_traducida(ctx);
}
