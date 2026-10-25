// Abrir directo una pantalla del juego, por código — bitácora §71.
//
// Resumen: el juego está armado en "secciones" (Section): el título, el menú principal, el menú de un jugador, cada
// tipo de carrera, el modo en línea… Quien manda es el SectionMgr (0x809C1E38). Para cambiar de sección el propio juego
// hace dos llamadas: SetNextSection(id, animación) (0x80635A3C: "la que sigue es esta") y RequestSceneChange(espera,
// color) (0x80635AC8: "cámbiala"). Este módulo deja que la PÁGINA pida eso: Module._mkw_directo_ir(id, licencia) anota
// el pedido y, en el siguiente SectionMgr::Update (0x8063550C, una vez por cuadro, en el hilo del juego), se hace con el
// SectionMgr de verdad. Así la página abre de una el menú de un jugador o el modo en línea: no hay cortina tapando ni un
// "piloto" apretando botones por detrás (lo que pidió el dueño, 2026-10-19).
// Como un conmutador de canales: en vez de apretar "siguiente" diez veces, se marca el número del canal.
//
// Antes de saltar desde el título hace falta lo que haría la pantalla de licencias al elegir una (es la función
// 0x805EB7A0 del juego, leída en el C++ traducido): la copiamos paso a paso.
//   1. SectionParams::ChangeLicense (0x805E40A8): borra lo elegido con la licencia anterior (personaje, kart…).
//   2. SectionParams +0x4E8 = número de licencia.
//   3. RKSYS::Mgr::SetCurLicense (0x80544CD8): la licencia actual del archivo de guardado (si es una licencia de
//      verdad: su bloque empieza con "RKPD").
//   4. MiiGroup::LoadStoreMii (0x805FA6E0) en SectionParams +0x238 (el Mii del jugador): carga el Mii de la licencia
//      desde la base de Miis con su CreateID (licencia +0x16), como hace el juego al crear una licencia (0x805ECF2C).
//   5. SetNextSection + RequestSceneChange con la sección pedida.
// Y el mando del jugador 1: en el juego se registra al apretar A en el título (SectionPad, SectionMgr +0x34: la casilla 0
// pasa de "esperando un botón" a "conectado" con la identidad del mando que apretó). Sin eso, la pantalla nueva pide
// «se interrumpió la comunicación con el mando, aprieta A». Es lo que hace el juego al ver el botón (Input::Manager
// 0x80523EBC, leída en el C++ traducido), sin el botón:
//   - Input::Manager (0x809BD70C): el "portador" del jugador 1 (+0x4) toma el mando de GameCube del puerto
//     (+0x3BA0 + puerto·0xB0; los Wiimote están en +0x1720 + n·0x920) con RealControllerHolder::SetController (0x80521554), +0x10 = +0x8, y 0x80522364;
//   - SectionPad::SetID(0, identidad) (0x8061B490) y estado 0: el Update del SectionPad completa el resto.
// La identidad es la que vimos en el juego para el mando de GameCube del puerto 1 (el teclado y el primer mando):
// 0x124 (canal 1 << 8 | 0x24 = GameCube). Module._mkw_directo_mando(id) la cambia.
// Si la casilla de la licencia está vacía (una partida nueva) y la página dio un Mii (Module._mkw_directo_mii(): 8 bytes
// de CreateID + 20 de nombre), antes se CREA la licencia como lo hace el juego al terminar «Crear licencia»
// (0x805ECF2C): RKSYS::Mgr::CreateLicense(n, CreateID*, nombre*) (0x80548030) y el pedido de guardar el archivo.
// Nada de esto corre si el juego todavía no leyó el archivo de guardado (RKSYS::Mgr +0x24FF8): así no se pisa una
// partida que aún no se cargó.
// Direcciones: Pulsar (github.com/MelgMKW/Pulsar, GameSource: SectionMgr.hpp, SectionParams.hpp, RKSYSMgr.hpp,
// LicenseMgr.hpp, MiiGroup.hpp) y el C++ traducido. Secciones (Identifiers.hpp): 0x3F título/menú principal, 0x41 menú
// principal, 0x48 un jugador, 0x54 multijugador en la consola, 0x55 en línea (Retro WFC), 0x1E-0x2B las carreras.
//
// Uso desde la página:  Module._mkw_directo_ir(0x48, 0)   → con la licencia 1 (la 0), el menú de un jugador
//                       Module._mkw_directo_ir(0x55, -1)  → el modo en línea, sin tocar la licencia (ya elegida)
//                       Module._mkw_directo_estado()      → 1 mientras queda un pedido sin hacer
// Al hacerlo avisa a Module.mkwAlIrDirecto(seccion, licenciaOk).
//
// Además, la acción de un botón del juego, llamada directo (sin apretar nada): Module._mkw_directo_boton(funcion,
// pagina, boton) llama en el siguiente Update a la función que el juego tiene para ese botón — la misma que corre
// cuando una persona lo aprieta — con la página y el botón de verdad (r3 = página, r4 = botón, r5 = mando 0). Solo las
// de la lista de abajo (BOTONES), para que la página no pueda llamar a cualquier cosa.
//   0x805F8F54 Click::OnClick (r4 = mando 0)      (los carteles que se cierran con A: 0x4D «Welcome to Retro Wi-Fi
//                                                  Connection!», 0x51…; cierra la página como al apretar A)
//   0x80648404 WFCDataStatement::OnButtonClick   (la página 0x85, el aviso de datos de Nintendo WFC: «Siguiente», +0x578)
//   0x80648AFC WFCAllowData::OnButtonClick       (la página 0x86 «¿Usar Nintendo WFC?»: el botón de arriba, +0x58C)
//   0x8064BCE8 WFCMainMenu::OnWorldwideButtonClick (la página 0x8B, menú Wi-Fi: «Mundial», +0x230)
//   0x8064BEA0 WFCMainMenu::OnFriendsButtonClick   (la página 0x8B: «Amigos», +0x6D8)
//   0x8064C610 WFCModeSelect::OnModeButtonClick    (la página 0x8C: VS +0x208 / Batalla +0x45C)
//   0x8064BDC4 WFCMainMenu::OnRegionalButtonClick  (la página 0x8B: «Regional», +0x484; Retro Rewind lo esconde y su
//                                                  botón «Main modes» (las retro) llama a esta, §72)
//   0x80649FD8 DisconnectError::OnClick (r4 = mando 0) (la página 0x89, el aviso «You were disconnected…»: lo cierra
//                                                  como al apretar A y el juego vuelve al menú principal, 0x41, §73)
//   0x8183FCC0 ExpWFCModeSel::OnModeButtonClick de Retro Rewind (la página 0x8C: fija la región de RR, 0x0A = retros
//                                                  con el botón VS +0x208, sus «contextos», y llama a 0x8064C610, §72)
// Retro Rewind trae su propia versión de algunas de estas funciones (rr_overlay_X: la del juego con los parches de
// Pulsar). SectionMgr::Update es una: el bucle del juego llama a rr_overlay_8063550C, así que la que se envuelve es esa.
// Las otras se llaman con InvokeDirectCpu<dirección>, que elige la versión activa (la de RR si la hay), como hace el
// código traducido.
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

extern "C" void rr_overlay_8063550C_traducida(CpuContext* ctx);   // SectionMgr::Update de RR, con el nombre cambiado
extern "C" void rr_overlay_80634E44_traducida(CpuContext* ctx);   // SectionMgr::Init de RR, con el nombre cambiado
extern "C" void rr_overlay_806024B0_traducida(CpuContext* ctx);   // Page::ChangeSectionBySceneChange de RR
extern "C" void func_80837720_traducida(CpuContext* ctx);         // MenuInteractable::LoadNextPageById
extern "C" void func_8083761C_traducida(CpuContext* ctx);         // MenuInteractable::LoadNextPageWithDelayById
extern "C" void mkw_invitados_cuadro(const CpuContext* ctx);      // §86: los Mii invitados (invitados_nativo.cpp)

namespace {
constexpr uint32_t kSectionMgr = 0x809C1E38;    // puntero al SectionMgr
constexpr uint32_t kRksysMgr = 0x809BD748;      // puntero al RKSYS::Mgr (el archivo de guardado ya leído)
constexpr uint32_t kRkpd = 0x524B5044;          // "RKPD": así empieza el bloque de una licencia que existe

int32_t g_pedido = -1;          // la sección pedida por la página (-1 = nada)
uint32_t g_locales = 2;         // §84: jugadores en la consola para el multijugador local (0x54): 2, 3 o 4
int32_t g_cuadros_mando = -1;   // cuadros desde que se registró el mando (-1 = todavía no): el salto va 3 después
int32_t g_licencia = -1;        // la licencia que hay que elegir antes (-1 = no tocarla)
uint8_t g_mii[28] = {};         // el Mii para una licencia nueva: CreateID (8 bytes) + nombre UTF-16 big-endian (20)
uint32_t g_mando = 0x124;       // la identidad del mando del jugador 1 (ver arriba)

// la acción de botón pedida (funcion = 0: nada)
uint32_t g_boton_funcion = 0, g_boton_pagina = 0, g_boton = 0;
constexpr uint32_t BOTONES[] = {0x805F8F54u, 0x80648404u, 0x80648AFCu, 0x8064BCE8u, 0x8064BEA0u, 0x8064C610u,
                                0x8064BDC4u, 0x8183FCC0u, 0x80649FD8u};

// Llama a una función del juego con los argumentos r3..r6 sobre una copia del contexto: la pila (r1) es la del juego
// (cada llamada arma su marco más abajo) y los registros que la Update del juego necesita quedan intactos.
template <uint32_t Funcion>
void llamar(const CpuContext* ctx, uint32_t r3, uint32_t r4 = 0, uint32_t r5 = 0, uint32_t r6 = 0) {
    CpuContext c = *ctx;
    c.gpr[3] = r3; c.gpr[4] = r4; c.gpr[5] = r5; c.gpr[6] = r6;
    InvokeDirectCpu<Funcion>(&c);
}

// ¿Ya leyó el juego el archivo de guardado? (RKSYS::Mgr: el puntero al archivo crudo +0x14 y hasReadLicenses +0x24FF8)
bool guardadoLeido(uint32_t rk) { return rk && Memory::Read32(rk + 0x14) && Memory::Read8(rk + 0x24FF8); }

// Crea la licencia n con el Mii que dio la página, como el final de «Crear licencia» del juego (0x805ECF2C).
// CreateLicense copia el CreateID y el nombre desde dos punteros del juego: se dejan primero en la misma LicenseMgr de
// esa casilla (nombre +0x0, CreateID +0x16), que CreateLicense recién reescribe al final (ReadLicense), después de copiar.
bool crearLicencia(const CpuContext* ctx, uint32_t sm, uint32_t rk, uint32_t n) {
    bool hayMii = false;
    for (int i = 0; i < 8; i++) hayMii |= g_mii[i] != 0;
    if (!hayMii) return false;
    const uint32_t licencia = rk + 0x38 + n * 0x93F0;
    for (uint32_t i = 0; i < 20; i++) Memory::Write8(licencia + i, g_mii[8 + i]);   // el nombre (10 letras)
    Memory::Write16(licencia + 20, 0);                                            // y su fin
    for (uint32_t i = 0; i < 8; i++) Memory::Write8(licencia + 0x16 + i, g_mii[i]);  // el CreateID
    llamar<0x80548030u>(ctx, rk, n, licencia + 0x16, licencia);                  // CreateLicense
    const uint32_t sp = Memory::Read32(sm + 0x98);
    Memory::Write8(sp + 0x4C0 + n, 0);                                           // como 0x805ECF2C
    // el pedido de guardar (lo mismo que hace 0x805ECF2C con el RKSYSRequester del SectionMgr, +0x90)
    const uint32_t pedidor = Memory::Read32(sm + 0x90);
    if (pedidor && Memory::Read8(pedidor + 20) && Memory::Read32(pedidor + 12)) {
        Memory::Write8(pedidor + 2, 1); Memory::Write8(pedidor + 22, 0);
    }
    return true;
}

// El mando del jugador 1 registrado como lo deja el título (si todavía está "esperando un botón")
void registrarMando(const CpuContext* ctx, uint32_t sm) {
    const uint32_t pad = sm + 0x34;                                     // SectionPad
    const uint32_t info = pad + 4;                                      // padInfos[0]: id, id activo, estado, holder
    if (Memory::Read32(info + 8) == 0 && Memory::Read32(info)) return;  // ya conectado
    const uint32_t entrada = Memory::Read32(0x809BD70C);                 // Input::Manager
    const uint32_t puerto = ((g_mando >> 8) - 1) & 3;
    if (entrada) {
        const uint32_t mando = entrada + 0x3BA0 + puerto * 0xB0;         // el mando de GameCube de ese puerto
        llamar<0x80521554u>(ctx, entrada + 4, mando, 0);                 // el portador del jugador 1 lo toma
        Memory::Write32(entrada + 16, Memory::Read32(entrada + 8));
        llamar<0x80522364u>(ctx, entrada + 204, mando);
    }
    llamar<0x8061B490u>(ctx, pad, 0, g_mando);                          // SetID(0, mando)
    Memory::Write32(info + 8, 0);                                       // estado: conectado
    Memory::Write32(pad + 0x58, Memory::Read32(pad + 0x58) | 1);         // el jugador 1 está
}

// Los pasos 1-4 de arriba. Devuelve 1 si la licencia existe (o se creó) y quedó elegida.
int elegirLicencia(const CpuContext* ctx, uint32_t sm, uint32_t n) {
    const uint32_t rk = Memory::Read32(kRksysMgr);
    const uint32_t sp = Memory::Read32(sm + 0x98);                       // SectionMgr->sectionParams
    if (!guardadoLeido(rk) || !sp || n > 3) return 0;
    const uint32_t crudo = Memory::Read32(rk + 0x14);                     // el archivo rksys como se leyó
    Memory::Write8(sp + 0x4E8, static_cast<uint8_t>(n));                   // 2. licenseNum (CreateLicense ya lo mira)
    if (Memory::Read32(crudo + 8 + n * 0x8CC0) != kRkpd && !crearLicencia(ctx, sm, rk, n)) return 0;   // vacía y sin Mii
    if (Memory::Read32(crudo + 8 + n * 0x8CC0) != kRkpd) return 0;
    llamar<0x805E40A8u>(ctx, sp);                                              // 1. ChangeLicense
    Memory::Write8(sp + 0x4E8, static_cast<uint8_t>(n));                   // 2. licenseNum
    llamar<0x80544CD8u>(ctx, rk, n);                                           // 3. SetCurLicense
    const uint32_t licencia = rk + 0x38 + n * 0x93F0;                     // RKSYS::Mgr.licenses[n] (LicenseMgr)
    llamar<0x805FA6E0u>(ctx, sp + 0x238, 0, licencia + 0x16);                  // 4. el Mii de la licencia (CreateID)
    return 1;
}

// ---- §73: la carrera directa (sin menús) ----
// La "ficha" de la carrera la escribe la página (Module._mkw_directo_ficha(): 64 enteros, ver FICHA_* abajo) y aquí se
// deja en Racedata.menusScenario (+0xC10) igual que la dejan los menús del juego (medido con herramientas/
// ficha-carrera.mjs en una carrera VS armada a mano: build/web/datos/ficha/vs-1p.json). Al entrar a la carrera el
// juego (Racedata::InitRace, 0x805302C4) cuenta jugadores/pantallas/mandos y copia esa ficha a la de la carrera.
// La pista de Retro Rewind la elige Pulsar en su CupsConfig: CupsConfig::SetWinning (rr_kamek_818476A4) guarda la
// pista ganadora (+0x10), su variante (+0x18) y la "casilla" del juego que ocupa (+0x8, el número de pista que va en
// Racedata): la misma función que corre al confirmar la pista en el menú.
constexpr uint32_t kRacedata = 0x809BD728;
constexpr uint32_t kCups = 0x8043319C;          // CupsConfig de Pulsar (dirección fija en esta versión de RR, menus.mjs)
enum { FICHA_PISTA, FICHA_VARIANTE, FICHA_CC, FICHA_ESPEJO, FICHA_CPU, FICHA_OBJETOS, FICHA_MODO, FICHA_CARRERA,
       FICHA_CARRERAS, FICHA_SEMILLA1, FICHA_SEMILLA2, FICHA_JUGADORES, FICHA_PANTALLAS, FICHA_VUELTAS, FICHA_PRIMERA,
       FICHA_INTRO, FICHA_PUESTOS = 16 };    // y desde 16, por puesto (12): tipo, personaje, vehículo, mando (-1 = ninguno)
int32_t g_ficha[64] = {};
int g_hay_ficha = 0;            // 1 = el próximo salto es a una carrera con esta ficha
// M20 (§96): el nivel de la CPU de la ficha es el de la página (0 fácil, 1 normal, 2 difícil, 3 máximo), más alto que
// los del juego. Al juego va una fila de su tabla un nivel más arriba (fácil → su normal; normal, difícil y máximo →
// su difícil) y cpu_dificultad_nativo.cpp sube «difícil» y «máximo» cuando el juego carga los parámetros de la IA.
constexpr uint32_t kFilaDelJuego[6] = {1, 2, 2, 2, 2, 2};   // (§99: intenso e imposible, la difícil)
int32_t g_nivel_cpu = -1;       // el de la última ficha escrita (-1 = ninguna: una carrera armada con los menús)
int32_t g_espejo = 0;           // §96: la última ficha pidió espejo (la marca va en la carrera, ver rr_kamek_81855954)
int32_t g_espejos = 0;          // (para mirar) cuántas carreras quedaron en espejo así
int g_registrar_al_entrar = 0;  // 1 = arrancó directo en la sección pedida: falta registrar el mando del jugador 1

bool cupsValido() {             // lo mismo que cupsValido de menus.mjs: que ahí esté de verdad el CupsConfig
    const uint32_t c = Memory::Read32(kCups), sel = Memory::Read32(kCups + 0x14), n = Memory::Read32(kCups + 0x24);
    return n > 0 && n < 400 && (c < 8 || (c >= 0x40 && c < 0x40 + n)) && sel < 0x100 + 4 * n;
}

bool escribirFicha(const CpuContext* ctx, uint32_t sm) {
    const uint32_t rd = Memory::Read32(kRacedata), sp = Memory::Read32(sm + 0x98);
    if (!rd || !sp) return false;
    const int32_t* f = g_ficha;
    // 1. la pista: con la de Pulsar (0x100 + 4·copa + fila) se elige como en el menú; una del juego (< 0x2A) va tal cual
    uint32_t pista = static_cast<uint32_t>(f[FICHA_PISTA]);
    if (pista >= 0x100) {
        if (!cupsValido()) return false;
        llamar<0x818476A4u>(ctx, kCups, pista, static_cast<uint32_t>(f[FICHA_VARIANTE]));   // SetWinning
        Memory::Write32(kCups, 0x40 + (pista - 0x100) / 4);   // la copa elegida (para el menú que venga después)
        Memory::Write32(kCups + 0x14, pista);                  // la pista elegida
        pista = Memory::Read8(kCups + 0x8);                    // su casilla en el juego
    }
    // 2. los ajustes (menusScenario.settings, +0xB48)
    const uint32_t esc = rd + 0xC10, aj = esc + 0xB48;
    Memory::Write32(aj + 0x0, pista);
    Memory::Write32(aj + 0x4, static_cast<uint32_t>(f[FICHA_CC]));         // 0 50cc, 1 100cc, 2 150cc
    Memory::Write32(aj + 0x8, static_cast<uint32_t>(f[FICHA_MODO]));       // 1 = VS
    // tipo de partida: 0 = normal; 5 = «carrera de CPU», que es como el juego arma la PRESENTACIÓN (sección 0x1A: el
    // vuelo sobre la pista con «VS 1/4» y el nombre, manejan todos solos). Al terminar el vuelo (o con A) el juego
    // pone 0 aquí y abre la carrera (Raceinfo, etapa 0: 0x80533364)
    Memory::Write32(aj + 0xC, f[FICHA_INTRO] ? 5u : 0u);
    Memory::Write32(aj + 0x10, 0);
    g_nivel_cpu = f[FICHA_CPU] < 0 ? 0 : f[FICHA_CPU] > 5 ? 5 : f[FICHA_CPU];
    Memory::Write32(aj + 0x14, kFilaDelJuego[g_nivel_cpu]);                // la fila del juego: 1 normal, 2 difícil
    Memory::Write32(aj + 0x18, static_cast<uint32_t>(f[FICHA_OBJETOS]));
    Memory::Write32(aj + 0x20, 0);                                         // la copa (solo GP)
    Memory::Write8(aj + 0x24, static_cast<uint8_t>(f[FICHA_CARRERA]));
    Memory::Write8(aj + 0x25, static_cast<uint8_t>(f[FICHA_VUELTAS] > 0 ? f[FICHA_VUELTAS] : 3));   // RR la ajusta a la pista
    // bit 0: espejo. §96: NO en la ficha de los menús: fuera de línea Retro Rewind usa esa marca del menú como «100cc»
    // (Pulsar, Racedata_InitRace = rr_kamek_81855954: con ella borra el espejo de la carrera y pone 100cc; el espejo de
    // Retro Rewind es solo de las salas de amigos). La marca va en la carrera, después de Pulsar (abajo)
    Memory::Write32(aj + 0x28, Memory::Read32(aj + 0x28) & ~1u);
    g_espejo = f[FICHA_ESPEJO] ? 1 : 0;
    if (f[FICHA_SEMILLA1] || f[FICHA_SEMILLA2]) {
        Memory::Write32(aj + 0x2C, static_cast<uint32_t>(f[FICHA_SEMILLA1]));
        Memory::Write32(aj + 0x30, static_cast<uint32_t>(f[FICHA_SEMILLA2]));
    }
    // 3. los 12 puestos: tipo (0 persona de esta consola, 1 CPU, 5 nadie), personaje, vehículo y su mando
    int jugadores = 0, locales = 0;
    for (int i = 0; i < 12; i++) {
        const int32_t* q = f + FICHA_PUESTOS + 4 * i;
        const uint32_t j = esc + 0x8 + i * 0xF0;
        const uint32_t tipo = q[0] < 0 ? 5u : static_cast<uint32_t>(q[0]);
        Memory::Write32(j + 0x10, tipo);
        if (tipo == 5) continue;
        jugadores++;
        if (q[1] >= 0) Memory::Write32(j + 0xC, static_cast<uint32_t>(q[1]));
        if (q[2] >= 0) Memory::Write32(j + 0x8, static_cast<uint32_t>(q[2]));
        const bool persona = tipo == 0;
        Memory::Write8(j + 0x6, static_cast<uint8_t>(persona && q[3] >= 0 ? q[3] : -1));   // índice de mando
        Memory::Write8(j + 0x5, static_cast<uint8_t>(persona ? locales : -1));             // su pantalla
        Memory::Write32(j + 0xCC, 2);                                                       // equipo: ninguno
        Memory::Write32(j + 0xD0, persona ? 3u : 0xFFFFFFFFu);                              // mando de GameCube
        // (con FICHA_PANTALLAS = 1, la sala: los demás humanos también son personas, pero la pantalla es solo la del
        // primero de ESTA consola; semillas_nativo.cpp deja la tabla de pantallas así al preparar la carrera)
        const int tope = f[FICHA_PANTALLAS] > 0 ? f[FICHA_PANTALLAS] : 4;
        if (persona && locales < tope) {     // lo que eligió en los menús (SectionParams): personaje +0x12C, vehículo +0x13C
            Memory::Write32(sp + 0x12C + 4 * locales, static_cast<uint32_t>(q[1]));
            Memory::Write32(sp + 0x13C + 4 * locales, static_cast<uint32_t>(q[2]));
            Memory::Write8(aj + 0x1C + locales, static_cast<uint8_t>(i));                  // la pantalla muestra a este
            locales++;
        }
        if (f[FICHA_PRIMERA]) {              // primera carrera: puntos en cero y la largada como en los menús
            Memory::Write16(j + 0xD8, 0); Memory::Write16(j + 0xDA, 0);
        } else {
            // §75: las siguientes, los puntos "de antes de esta carrera" (+0xD8) = el total que lleva (+0xDA). El juego
            // suma así: total = de antes + los de esta (RacedataScenario::UpdatePoints, 0x8052E950); el "de antes" lo deja
            // su menú de la carrera siguiente, que aquí no pasa (sin esto la tabla de la copa traía solo la última)
            Memory::Write16(j + 0xD8, Memory::Read16(j + 0xDA));
        }
    }
    if (f[FICHA_PRIMERA]) {                  // el puesto "anterior" ordena la largada: las personas atrás, como el juego
        int k = jugadores;
        for (int i = 0; i < 12; i++) {
            const uint32_t j = esc + 0x8 + i * 0xF0;
            if (Memory::Read32(j + 0x10) != 5) Memory::Write8(j + 0xE1, static_cast<uint8_t>(k--));
        }
    }
    for (int k = locales; k < 4; k++) {
        Memory::Write8(aj + 0x1C + k, 0xFF);
        Memory::Write32(sp + 0x12C + 4 * k, 0xFFFFFFFFu);
        Memory::Write32(sp + 0x13C + 4 * k, 0xFFFFFFFFu);
    }
    Memory::Write8(esc + 4, static_cast<uint8_t>(jugadores));
    Memory::Write8(esc + 5, static_cast<uint8_t>(locales ? locales : 1));
    Memory::Write8(esc + 6, static_cast<uint8_t>(locales));
    // 4. SectionParams: cuántos juegan aquí, la última pista, el número de carrera VS (desde 1) y cuántas son
    Memory::Write32(sp + 0x124, static_cast<uint32_t>(locales));
    Memory::Write32(sp + 0x128, 0);
    Memory::Write32(sp + 0x14C, pista);
    Memory::Write32(sp + 0x60, static_cast<uint32_t>(f[FICHA_CARRERA]));    // la presentación muestra este + 1
    Memory::Write32(sp + 0x64, static_cast<uint32_t>(f[FICHA_CARRERAS] > 0 ? f[FICHA_CARRERAS] : 4));
    return true;
}

// §82 (solo pruebas): el VR de la sala lo calcula la página (vr-sala.mjs) con la regla del juego; para comprobar que da
// lo mismo, se le pregunta al juego mismo. La página pide un tramo de diferencias (VR del perdedor − VR del ganador) y
// en el próximo Update, para cada una, se arman dos «puntajes» en la pila del juego (muy por debajo de la que usa: el
// VR va en +4, dos bytes) y se llama a las dos funciones del juego: 0x8052D118 (lo que gana el que llegó antes; se la
// llama con el suyo y el del otro, como UpdatePoints) y 0x8052D1C0 (lo que pierde el que llegó después: el suyo y el
// del otro). Las respuestas quedan en g_vr_res para la página.
constexpr int32_t VR_PRUEBA_MAX = 20000;
int32_t g_vr_desde = 0, g_vr_cuantos = 0;      // el tramo pedido (0 = nada pendiente)
int32_t g_vr_res[2 * VR_PRUEBA_MAX];           // [gana el ganador, «gana» el perdedor (negativo)] de cada diferencia
void probarVr(const CpuContext* ctx) {
    const uint32_t base = (ctx->gpr[1] - 0x400u) & ~0xFu;
    const uint32_t ganador = base, perdedor = base + 0x10;
    for (int32_t k = 0; k < g_vr_cuantos; k++) {
        const int32_t d = g_vr_desde + k;
        const int32_t vg = d < 0 ? 9999 : 1, vp = vg + d;             // los dos VR entre 1 y 9999, como en el juego
        Memory::Write16(ganador + 4, static_cast<uint16_t>(vg));
        Memory::Write16(perdedor + 4, static_cast<uint16_t>(vp));
        CpuContext c = *ctx;
        c.gpr[1] = base - 0x100; c.gpr[3] = ganador; c.gpr[4] = perdedor;
        InvokeDirectCpu<0x8052D118u>(&c);
        g_vr_res[2 * k] = static_cast<int32_t>(c.gpr[3]);
        c = *ctx;
        c.gpr[1] = base - 0x100; c.gpr[3] = perdedor; c.gpr[4] = ganador;
        InvokeDirectCpu<0x8052D1C0u>(&c);
        g_vr_res[2 * k + 1] = static_cast<int32_t>(c.gpr[3]);
    }
    g_vr_cuantos = 0;
}
}

extern "C" EMSCRIPTEN_KEEPALIVE void mkw_directo_ir(int32_t seccion, int32_t licencia) {
    g_pedido = seccion; g_licencia = licencia; g_cuadros_mando = -1;
}
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_directo_estado() { return g_pedido >= 0 ? 1 : 0; }
// §73: dónde escribe la página la ficha de la carrera, y el pedido de ir a ella (sección 0x1A = la presentación de la
// carrera VS, que sigue sola a la carrera)
extern "C" EMSCRIPTEN_KEEPALIVE int32_t* mkw_directo_ficha() { return g_ficha; }
// M20: el nivel de la página de la última ficha (cpu_dificultad_nativo.cpp y las pruebas)
extern "C" EMSCRIPTEN_KEEPALIVE int32_t mkw_directo_nivel_cpu() { return g_nivel_cpu; }
extern "C" EMSCRIPTEN_KEEPALIVE int32_t mkw_directo_espejos() { return g_espejos; }

// §96: el espejo de verdad. Racedata_InitRace de Pulsar (rr_kamek_81855954) envuelve a Racedata::InitRace (que copia la
// ficha de los menús a la de la carrera): fuera de línea, con la marca de espejo en los menús, la borra de la carrera
// y pone 100cc (el «100cc» de Retro Rewind sale del botón «espejo» del menú del juego). La ficha de la página ya no
// pone esa marca en los menús; aquí, después de Pulsar, si la ficha pidió espejo, la marca va en la carrera (ajustes
// +0x28 bit 0 de racesScenario, Racedata +0x20 +0xB48): la carrera sigue en 150cc y la pista se corre dada vuelta.
extern "C" void rr_kamek_81855954_traducida(CpuContext* ctx);
void mkwNombresEnCarrera();                       // M22: nombres_nativo.cpp (los nombres de los humanos de la sala)
void mkwNombresCpu(const CpuContext* ctx);        // M22: nombres_nativo.cpp (el texto de cada CPU, ya en la carrera)
extern "C" void rr_kamek_81855954(CpuContext* MKW_RESTRICT ctx) {
    rr_kamek_81855954_traducida(ctx);
    mkwNombresEnCarrera();
    if (!g_espejo) return;
    const uint32_t rd = Memory::Read32(kRacedata);
    if (!rd || Memory::Read32(rd + 0x20 + 0xB48 + 0x8) != 1) return;     // solo en una carrera VS
    const uint32_t banderas = rd + 0x20 + 0xB48 + 0x28;
    Memory::Write32(banderas, Memory::Read32(banderas) | 1u);
    ++g_espejos;
}
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_directo_carrera(int32_t seccion, int32_t licencia) {
    g_pedido = seccion; g_licencia = licencia; g_cuadros_mando = -1; g_hay_ficha = 1;
}
// la acción de un botón del juego, llamada directo en el siguiente Update. 1 = aceptada (está en la lista)
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_directo_boton(uint32_t funcion, uint32_t pagina, uint32_t boton) {
    for (uint32_t f : BOTONES) if (f == funcion) { g_boton_funcion = funcion; g_boton_pagina = pagina; g_boton = boton; return 1; }
    return 0;
}
// §84: cuántos juegan en la consola en el multijugador local (sección 0x54): 2 a 4
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_directo_locales(uint32_t n) { g_locales = n < 2 ? 2 : n > 4 ? 4 : n; }
// la identidad del mando del jugador 1 (por omisión 0x124: GameCube, puerto 1)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_directo_mando(uint32_t id) { g_mando = id; }
// dónde escribe la página el Mii para una licencia nueva (28 bytes: CreateID + nombre)
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_directo_mii() { return g_mii; }
// 1 cuando el juego ya leyó el archivo de guardado (recién ahí conviene pedir un salto con licencia)
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_directo_listo() { return guardadoLeido(Memory::Read32(kRksysMgr)) ? 1 : 0; }
// §82 (solo pruebas): pedir al juego los puntos de VR de `cuantos` diferencias desde `desde` (se calculan en el próximo
// cuadro; mkw_vr_prueba_lista() = 1 cuando están); devuelve dónde quedan
extern "C" EMSCRIPTEN_KEEPALIVE int32_t* mkw_vr_prueba(int32_t desde, int32_t cuantos) {
    g_vr_desde = desde; g_vr_cuantos = cuantos < 0 ? 0 : (cuantos > VR_PRUEBA_MAX ? VR_PRUEBA_MAX : cuantos);
    return g_vr_res;
}
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_vr_prueba_lista() { return g_vr_cuantos == 0 ? 1 : 0; }

EM_JS(void, mkw_web_directo_hecho, (int32_t seccion, int32_t licencia_ok), {
    if (Module.mkwAlIrDirecto) Module.mkwAlIrDirecto(seccion, licencia_ok);
});

// §73: arrancar DIRECTO en la sección pedida. SectionMgr::Init (0x80634E44; RR tiene su versión) decide con qué
// sección arranca el juego: la deja en bootSectionId (+0x4) y en nextSectionId (+0xC), y de ahí sale la primera escena
// (menús o carrera, GetBootSectionSceneId 0x80634FA0) y la primera sección que se carga (LoadSection 0x80634FBC). Para
// eso el juego ya leyó la partida guardada (la sección de arranque depende de ella: partida nueva, dañada…). Si la
// página dejó un pedido antes de arrancar (Module._mkw_directo_carrera / _ir antes de callMain), aquí mismo se elige la
// licencia, se escribe la ficha y la sección de arranque pasa a ser la pedida: el juego nunca crea el título ni la
// pantalla de licencias. Si algo falta (sin partida leída, sin licencia), queda el camino de siempre (el salto en el
// primer Update que pueda, abajo).
extern "C" void rr_overlay_80634E44(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t sm = ctx->gpr[3];
    CpuContext copia = *ctx;                     // los registros con que se llamó (r1: la pila del juego)
    rr_overlay_80634E44_traducida(ctx);
    const int32_t arranque = sm ? static_cast<int32_t>(Memory::Read32(sm + 0x4)) : -1;
    if (g_pedido < 0 || !sm || arranque != 0x3F) return;    // solo en lugar del título (no si la partida está dañada…)
    if (g_licencia >= 0 && !guardadoLeido(Memory::Read32(kRksysMgr))) return;
    int ok = g_licencia >= 0 ? elegirLicencia(&copia, sm, static_cast<uint32_t>(g_licencia)) : 1;
    if (ok && g_hay_ficha) ok = escribirFicha(&copia, sm) ? 1 : 0;
    if (!ok) return;                             // que lo intente el Update (o avise que no se pudo)
    const int32_t seccion = g_pedido;
    g_pedido = -1; g_hay_ficha = 0;
    Memory::Write32(sm + 0x4, static_cast<uint32_t>(seccion));
    Memory::Write32(sm + 0xC, static_cast<uint32_t>(seccion));
    g_registrar_al_entrar = 1;                   // el mando del jugador 1, cuando ya haya sección (en el Update)
    mkw_web_directo_hecho(seccion, 1);
}

// §73: «elegir personaje y vehículo» con los menús del juego, para la sala. La página abre la sección 0x49 (la de
// «cambiar personaje» de Contrarreloj: empieza en la pantalla de personaje) con Module._mkw_directo_eleccion(1). La
// persona elige personaje, vehículo y derrape con los menús del juego; al confirmar el derrape la pantalla pide pasar a
// la sección siguiente (MenuInteractable::ChangeSectionById → Page::ChangeSectionBySceneChange, 0x806024B0): en el
// modo elección ese cambio NO se hace y se le avisa a la página lo elegido (Module.mkwAlElegir(personaje, vehículo,
// derrape)). La pantalla queda quieta (el juego la bloquea al confirmar) hasta que la página salta a la carrera.
//   personaje: SectionParams +0x12C, vehículo +0x13C (los que dejan las pantallas de personaje y vehículo);
//   derrape: el que el botón guardó en la licencia (+0x9124: 1 o 2), el mismo que SectionParams +0x164 al cambiar de
//   licencia (ChangeLicense, 0x805E40A8), que es de donde lo saca la carrera.
int g_eleccion = 0;
constexpr uint32_t kPaginaDerrape = 0x6D;
EM_JS(void, mkw_web_eligio, (int32_t personaje, int32_t vehiculo, int32_t derrape), {
    if (Module.mkwAlElegir) Module.mkwAlElegir(personaje, vehiculo, derrape);
});
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_directo_eleccion(int32_t si) { g_eleccion = si ? 1 : 0; }

// En el modo elección, ¿esta página es la de derrape? Entonces se avisa lo elegido y no se sigue (devuelve true)
bool eligioDerrape(uint32_t pagina) {
    if (!g_eleccion || !pagina || Memory::Read32(pagina + 4) != kPaginaDerrape) return false;
    {
        const uint32_t sm = Memory::Read32(kSectionMgr), sp = sm ? Memory::Read32(sm + 0x98) : 0;
        const uint32_t rk = Memory::Read32(kRksysMgr);
        int32_t derrape = -1;
        if (rk) {
            const int16_t n = static_cast<int16_t>(Memory::Read16(rk + 54));       // la licencia actual
            if (n >= 0 && n < 4) derrape = static_cast<int32_t>(Memory::Read32(rk + 0x38 + n * 0x93F0 + 0x9124));
        }
        if (sp && derrape > 0) Memory::Write32(sp + 0x164, static_cast<uint32_t>(derrape));   // el del jugador 1
        mkw_web_eligio(sp ? static_cast<int32_t>(Memory::Read32(sp + 0x12C)) : -1,
                       sp ? static_cast<int32_t>(Memory::Read32(sp + 0x13C)) : -1, derrape);
    }
    return true;                                 // sin seguir: la página decide cuándo correr
}

// el derrape sigue de una de estas tres formas según la sección: cambio de sección o página siguiente (con o sin espera)
extern "C" void rr_overlay_806024B0(CpuContext* MKW_RESTRICT ctx) {
    if (!eligioDerrape(ctx->gpr[3])) rr_overlay_806024B0_traducida(ctx);
}
extern "C" void func_80837720(CpuContext* MKW_RESTRICT ctx) {
    if (!eligioDerrape(ctx->gpr[3])) func_80837720_traducida(ctx);
}
extern "C" void func_8083761C(CpuContext* MKW_RESTRICT ctx) {
    if (!eligioDerrape(ctx->gpr[3])) func_8083761C_traducida(ctx);
}

extern "C" void rr_overlay_8063550C(CpuContext* MKW_RESTRICT ctx) {
    mkwNombresCpu(ctx);                           // M22: si la página lo pidió y ya es la carrera
    // ¿hay pedido y el SectionMgr está quieto (sin otro cambio de sección ya en marcha)? fadeSceneAction (+0x30) = 0
    const uint32_t sm = ctx->gpr[3];
    // §73: el pedido puede llegar antes de que el juego arranque (la página lo deja puesto apenas carga): se espera a que
    // el juego haya leído la partida guardada (sin ella no hay licencia que elegir), y se salta en ese mismo cuadro,
    // sin esperar a que se vea el título
    const bool puede = g_pedido >= 0 && (g_licencia < 0 || guardadoLeido(Memory::Read32(kRksysMgr)));
    if (g_registrar_al_entrar && sm && Memory::Read32(sm)) {   // arrancó directo (Init): el mando, como el título
        g_registrar_al_entrar = 0;
        registrarMando(ctx, sm);
    }
    // Primero el mando (como el título) y el salto 3 cuadros después: así el Update del SectionPad alcanza a buscar el
    // resto (el holder, la identidad activa) antes de la pantalla nueva; registrado en el mismo cuadro del salto, la
    // pantalla nueva lo veía "interrumpido" y pedía apretar A.
    if (puede && sm && Memory::Read32(sm) && Memory::Read32(sm + 0x30) == 0 && g_cuadros_mando < 0) {
        registrarMando(ctx, sm);
        g_cuadros_mando = 0;
    } else if (puede && g_cuadros_mando >= 0 && g_cuadros_mando < 3) {
        g_cuadros_mando++;
    } else if (puede && sm && Memory::Read32(sm) && Memory::Read32(sm + 0x30) == 0) {
        const int32_t seccion = g_pedido;
        g_pedido = -1;
        int ok = g_licencia >= 0 ? elegirLicencia(ctx, sm, static_cast<uint32_t>(g_licencia)) : 1;
        if (ok && g_hay_ficha) ok = escribirFicha(ctx, sm) ? 1 : 0;   // §73: la carrera, escrita como los menús
        g_hay_ficha = 0;
        // el modo elección termina con el salto (a la carrera). M22: salvo el salto a la pantalla de personajes misma
        // (volver a elegir en el descanso: ese salto va por aquí, y apagaba el modo antes de confirmar; al empezar la
        // copa el salto va por la envoltura de SectionMgr::Init y no pasaba)
        if (ok && seccion != 0x49) g_eleccion = 0;
        // §84: el multijugador en la consola (0x54), como el botón «2/3/4 Players» del menú principal
        // (MainMenu::OnButtonClick, 0x8085110C): anota qué botón fue (SectionParams +296) y llama a
        // MainMenu::ResetSectionParamsAndRacedataScenario1 (0x808516BC, no usa la página: r3 da igual) con la cantidad
        // de jugadores: la deja en SectionParams +292, marca personas y CPU en la ficha de los menús y suelta los mandos
        // de los puestos que sobran. Sin esto la pantalla de mandos veía al jugador 1 «desconectado» y pedía apretar A.
        if (ok && seccion == 0x54) {
            const uint32_t sp = Memory::Read32(sm + 0x98);
            if (sp) Memory::Write32(sp + 296, g_locales - 1);
            llamar<0x808516BCu>(ctx, 0, g_locales);
        }
        if (ok) {                       // sin licencia no se salta (los menús sin Mii dejan al juego esperando para siempre)
            llamar<0x80635A3Cu>(ctx, sm, static_cast<uint32_t>(seccion), 0);    // la que sigue: esta
            llamar<0x80635AC8u>(ctx, sm, 0, 0x000000FFu);                       // cámbiala ya, fundido negro
        }
        mkw_web_directo_hecho(seccion, ok);
    }
    if (g_boton_funcion && sm && Memory::Read32(sm + 0x30) == 0) {
        CpuContext c = *ctx;
        c.gpr[3] = g_boton_pagina; c.gpr[4] = g_boton; c.gpr[5] = 0;
        const uint32_t f = g_boton_funcion;
        g_boton_funcion = 0;
        InvokeIndirectCpu(f, &c);       // elige la versión activa (la de RR si la parcheó), como el código traducido
    }
    if (g_vr_cuantos) probarVr(ctx);    // §82, solo pruebas
    mkw_invitados_cuadro(ctx);          // §86: las caras de los Mii invitados, si la página las pidió
    rr_overlay_8063550C_traducida(ctx);
}
