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

namespace {
constexpr uint32_t kSectionMgr = 0x809C1E38;    // puntero al SectionMgr
constexpr uint32_t kRksysMgr = 0x809BD748;      // puntero al RKSYS::Mgr (el archivo de guardado ya leído)
constexpr uint32_t kRkpd = 0x524B5044;          // "RKPD": así empieza el bloque de una licencia que existe

int32_t g_pedido = -1;          // la sección pedida por la página (-1 = nada)
int32_t g_cuadros_mando = -1;   // cuadros desde que se registró el mando (-1 = todavía no): el salto va 3 después
int32_t g_licencia = -1;        // la licencia que hay que elegir antes (-1 = no tocarla)
uint8_t g_mii[28] = {};         // el Mii para una licencia nueva: CreateID (8 bytes) + nombre UTF-16 big-endian (20)
uint32_t g_mando = 0x124;       // la identidad del mando del jugador 1 (ver arriba)

// la acción de botón pedida (funcion = 0: nada)
uint32_t g_boton_funcion = 0, g_boton_pagina = 0, g_boton = 0;
constexpr uint32_t BOTONES[] = {0x805F8F54u, 0x80648404u, 0x80648AFCu, 0x8064BCE8u, 0x8064BEA0u, 0x8064C610u,
                                0x8064BDC4u, 0x8183FCC0u};

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
}

extern "C" EMSCRIPTEN_KEEPALIVE void mkw_directo_ir(int32_t seccion, int32_t licencia) {
    g_pedido = seccion; g_licencia = licencia; g_cuadros_mando = -1;
}
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_directo_estado() { return g_pedido >= 0 ? 1 : 0; }
// la acción de un botón del juego, llamada directo en el siguiente Update. 1 = aceptada (está en la lista)
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_directo_boton(uint32_t funcion, uint32_t pagina, uint32_t boton) {
    for (uint32_t f : BOTONES) if (f == funcion) { g_boton_funcion = funcion; g_boton_pagina = pagina; g_boton = boton; return 1; }
    return 0;
}
// la identidad del mando del jugador 1 (por omisión 0x124: GameCube, puerto 1)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_directo_mando(uint32_t id) { g_mando = id; }
// dónde escribe la página el Mii para una licencia nueva (28 bytes: CreateID + nombre)
extern "C" EMSCRIPTEN_KEEPALIVE uint8_t* mkw_directo_mii() { return g_mii; }
// 1 cuando el juego ya leyó el archivo de guardado (recién ahí conviene pedir un salto con licencia)
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_directo_listo() { return guardadoLeido(Memory::Read32(kRksysMgr)) ? 1 : 0; }

EM_JS(void, mkw_web_directo_hecho, (int32_t seccion, int32_t licencia_ok), {
    if (Module.mkwAlIrDirecto) Module.mkwAlIrDirecto(seccion, licencia_ok);
});

extern "C" void rr_overlay_8063550C(CpuContext* MKW_RESTRICT ctx) {
    // ¿hay pedido y el SectionMgr está quieto (sin otro cambio de sección ya en marcha)? fadeSceneAction (+0x30) = 0
    const uint32_t sm = ctx->gpr[3];
    // Primero el mando (como el título) y el salto 3 cuadros después: así el Update del SectionPad alcanza a buscar el
    // resto (el holder, la identidad activa) antes de la pantalla nueva; registrado en el mismo cuadro del salto, la
    // pantalla nueva lo veía "interrumpido" y pedía apretar A.
    if (g_pedido >= 0 && sm && Memory::Read32(sm) && Memory::Read32(sm + 0x30) == 0 && g_cuadros_mando < 0) {
        registrarMando(ctx, sm);
        g_cuadros_mando = 0;
    } else if (g_pedido >= 0 && g_cuadros_mando >= 0 && g_cuadros_mando < 3) {
        g_cuadros_mando++;
    } else if (g_pedido >= 0 && sm && Memory::Read32(sm) && Memory::Read32(sm + 0x30) == 0) {
        const int32_t seccion = g_pedido;
        g_pedido = -1;
        const int ok = g_licencia >= 0 ? elegirLicencia(ctx, sm, static_cast<uint32_t>(g_licencia)) : 1;
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
    rr_overlay_8063550C_traducida(ctx);
}
