// La carrera sincronizada de la sala con CPU (lockstep, bitácora §61): memoria nueva en cero y "todo a la vista".
//
// Resumen: en la sala con CPU todas las consolas corren LA MISMA carrera a la vez (cada una calcula a los 12 karts
// con los mandos de todos), así que el juego tiene que dar exactamente lo mismo en todas. Una fuente de diferencias:
// la memoria que el juego pide al "montón" (heap) trae restos de lo que hubo antes ahí, y esos restos dependen de lo
// que pasó en los menús de cada consola. Si alguna parte del juego lee un campo antes de escribirlo, cada consola
// leería otra cosa. Con el reloj fijo encendido (ppc_helpers.cpp), estas versiones de MEMAllocFromExpHeapEx y
// MEMAllocFromFrmHeapEx (las dos maneras de pedir memoria de la Wii: el resto de los "new" del juego terminan aquí)
// llenan con ceros lo que entregan. Fuera de la sala con CPU no hacen nada distinto.
//
// Y la otra fuente de diferencias, la que de verdad separaba las carreras: cada consola mira desde otro kart, y el
// juego decide qué está "a la vista" de la cámara (ClipInfoMgr::Update: por cada objeto, kart u objeto de la pista,
// guarda por pantalla la distancia a la cámara y dos marcas, bit 0 = fuera de la vista, bit 1 = lejos). Parte de la
// lógica mira eso (los objetos que no se ven se actualizan menos: una caja de objetos que reaparece, un caparazón),
// así que cada consola calculaba un poco distinto. Con el reloj fijo encendido, después de calcularlo se pone todo
// como "a la vista y cerca" (marcas en 0, distancia 0), igual en todas. El costo: se dibuja todo lo de la pista
// aunque esté detrás de la cámara (la tarjeta de video lo descarta enseguida).
//
// Cómo se engancha: como semillas_nativo.cpp (compilar-web.py, REEMPLAZOS).
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

#include <cstring>

extern "C" int g_mkwRelojFijo;
extern "C" int g_mkwLsArreglos;   // semillas_nativo.cpp: máscara (§269b): 1 todo a la vista, 2 los CPU no miran la cámara, 4 la fracción fija, 8 dibujar siempre (?arreglos=0 = ninguno, para comparar)
extern "C" void func_80198D88_traducida(CpuContext* ctx);   // MEM::AllocFromExpHeapEx(heap, tamaño, alineación)
extern "C" void func_801994E4_traducida(CpuContext* ctx);   // MEM::AllocFromFrmHeapEx(heap, tamaño, alineación)

static void limpiar(uint32_t direccion, uint32_t tam) {
    if (!direccion || tam == 0 || tam > 0x4000000u || !Memory::Contains(direccion, tam)) return;
    std::memset(Memory::GetPointer(direccion, tam), 0, tam);
}

// depuración (depurar_lockstep.cpp, solo con MKW_DEPURAR_LS=1): anota cada pedido de memoria
extern "C" __attribute__((weak)) void mkw_traza_alloc(uint32_t heap, uint32_t tam, uint32_t alin, uint32_t dir, uint32_t lr, int tipo);

extern "C" void func_80198D88(CpuContext* ctx) {
    const uint32_t tam = ctx->gpr[4], heap = ctx->gpr[3], alin = ctx->gpr[5], lr = ctx->lr;
    func_80198D88_traducida(ctx);
    if (g_mkwRelojFijo) limpiar(ctx->gpr[3], tam);
    if (mkw_traza_alloc) mkw_traza_alloc(heap, tam, alin, ctx->gpr[3], lr, 0);
}

extern "C" void func_801994E4(CpuContext* ctx) {
    const uint32_t tam = ctx->gpr[4], heap = ctx->gpr[3], alin = ctx->gpr[5], lr = ctx->lr;
    func_801994E4_traducida(ctx);
    if (g_mkwRelojFijo) limpiar(ctx->gpr[3], tam);
    if (mkw_traza_alloc) mkw_traza_alloc(heap, tam, alin, ctx->gpr[3], lr, 1);
}

// ClipInfoMgr::Update (0x80787774): ClipInfoMgr +0x10 = lista de ClipInfo (0x24 bytes cada uno), +0x18 = cuántos.
// ClipInfo: +0xC distancia a la cámara de cada pantalla (4 floats), +0x20 marcas de cada pantalla (4 bytes; bit 0x20 =
// apagado, no se toca).
// §179 (G1): antes de ponerlas en «a la vista», se guardan las marcas y distancias de verdad (las de MI cámara) de cada
// ClipInfo. La lógica sigue viendo «todo a la vista», igual en todas las consolas; solo las dos funciones que pasan las
// marcas a las opciones de dibujo de cada modelo (abajo) ven las de verdad, así el dibujo recorta lo que no se ve
extern "C" int g_mkwRecorteDibujo;   // semillas_nativo.cpp: 0 = el dibujo también ve todo (?recorteDibujo=0, como antes)
static constexpr uint32_t kMaxClip = 4096;
static uint32_t s_clipLista = 0, s_clipN = 0, s_clipMgr = 0;
// §248: la lista guardada vale solo mientras viva el ClipInfoMgr que la armó. Su puntero único del juego
// (ClipInfoMgr::sInstance, 0x809C2EF8: DestroyInstance, 0x80787538, lo pone en 0 al salir de la carrera) tiene que
// seguir siendo ese, con la misma lista y la misma cantidad. Antes la dirección quedaba guardada después de la carrera
// y ScnMgr::DrawMain de los menús seguía escribiendo marcas en esa memoria ya liberada: en la pantalla de personajes
// del descanso (M22) ahí vivían los layouts de los botones, y al salir el juego se caía (Layout::__dt, puntero nulo)
static constexpr uint32_t kClipInstancia = 0x809C2EF8u;
static bool clipVigente() {
    if (!s_clipN) return false;
    if (Memory::Read32(kClipInstancia) != s_clipMgr || !s_clipMgr || !Memory::Contains(s_clipMgr, 0x1C) ||
        Memory::Read32(s_clipMgr + 0x10) != s_clipLista || Memory::Read32(s_clipMgr + 0x18) != s_clipN) {
        s_clipN = 0; s_clipLista = 0; s_clipMgr = 0;    // (la carrera terminó: no se vuelve a tocar)
        return false;
    }
    return Memory::Contains(s_clipLista, s_clipN * 0x24);
}
static uint8_t s_clipMarcas[kMaxClip][4];
static uint32_t s_clipDist[kMaxClip][4];
static uint32_t s_recortes = 0;      // cuántas veces el dibujo usó las marcas de verdad (para la página y las pruebas)
// §269b (instrumento, solo pruebas): las ClipInfo de [s_realA, s_realB) quedan con sus marcas de verdad también para la
// lógica (no «todo a la vista»): para buscar, partiendo la lista por la mitad, qué cosa de la pista hace dibujar de más en
// la sala. mkw_clip_reales(a, b) (a = b = 0: ninguna, lo de siempre); mkw_clip_n() = cuántas hay en la lista
static uint32_t s_realA = 0, s_realB = 0;
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_clip_reales(uint32_t a, uint32_t b) { s_realA = a; s_realB = b; }
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_clip_n() { return s_clipN; }
// (la dirección de la ClipInfo número i, y la de su dueño si la guarda: para nombrarla después)
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_clip_dir(uint32_t i) { return i < s_clipN ? s_clipLista + i * 0x24 : 0; }
extern "C" void func_80787774_traducida(CpuContext* ctx);
extern "C" void func_80787774(CpuContext* ctx) {
    const uint32_t mgr = ctx->gpr[3];
    func_80787774_traducida(ctx);
    s_clipN = 0;
    if (!g_mkwRelojFijo || !(g_mkwLsArreglos & 1)) return;
    const uint32_t lista = Memory::Read32(mgr + 0x10), n = Memory::Read32(mgr + 0x18);
    if (!lista || n > kMaxClip || !Memory::Contains(lista, n * 0x24)) return;
    for (uint32_t i = 0; i < n; i++) {
        const uint32_t ci = lista + i * 0x24;
        for (uint32_t pantalla = 0; pantalla < 4; pantalla++) {
            const uint8_t m = Memory::Read8(ci + 0x20 + pantalla);
            s_clipMarcas[i][pantalla] = m;
            s_clipDist[i][pantalla] = Memory::Read32(ci + 0xC + 4 * pantalla);
            if (m & 0x20) continue;
            if (i >= s_realA && i < s_realB) continue;   // (el instrumento de arriba)
            Memory::Write8(ci + 0x20 + pantalla, m & ~3u);
            Memory::Write32(ci + 0xC + 4 * pantalla, 0);
        }
    }
    s_clipLista = lista; s_clipN = n; s_clipMgr = mgr;
}

// ModelDirector::SetAllScnOptionsFromClipInfo (0x8055D448) y ::SetDisableDrawScnOptionsFromClipInfo (0x8055D554):
// leen la ClipInfo del modelo (ModelDirector +0x44) y deciden si se dibuja. Mientras corren, su ClipInfo tiene las
// marcas de verdad; al volver, otra vez «a la vista y cerca» (la lógica no se entera). Solo si ese ClipInfo está en la
// lista que guardó ClipInfoMgr::Update en este cuadro
template <void (*Original)(CpuContext*)>
static void conMarcasDeVerdad(CpuContext* ctx) {
    const uint32_t md = ctx->gpr[3];
    uint32_t ci = 0, i = 0;
    if (g_mkwRelojFijo && (g_mkwLsArreglos & 1) && g_mkwRecorteDibujo && clipVigente() && Memory::Contains(md + 0x44, 4)) {
        ci = Memory::Read32(md + 0x44);
        if (ci >= s_clipLista && ci < s_clipLista + s_clipN * 0x24 && (ci - s_clipLista) % 0x24 == 0) i = (ci - s_clipLista) / 0x24;
        else ci = 0;
    }
    if (!ci) { Original(ctx); return; }
    uint8_t antes[4]; uint32_t distAntes[4];
    for (uint32_t p = 0; p < 4; p++) {
        antes[p] = Memory::Read8(ci + 0x20 + p); distAntes[p] = Memory::Read32(ci + 0xC + 4 * p);
        if (antes[p] & 0x20) continue;
        Memory::Write8(ci + 0x20 + p, static_cast<uint8_t>((antes[p] & ~3u) | (s_clipMarcas[i][p] & 3u)));
        Memory::Write32(ci + 0xC + 4 * p, s_clipDist[i][p]);
    }
    Original(ctx);
    for (uint32_t p = 0; p < 4; p++) { Memory::Write8(ci + 0x20 + p, antes[p]); Memory::Write32(ci + 0xC + 4 * p, distAntes[p]); }
    s_recortes++;
}
extern "C" void func_8055D448_traducida(CpuContext* ctx);
extern "C" void func_8055D554_traducida(CpuContext* ctx);
extern "C" void func_8055D448(CpuContext* ctx) { conMarcasDeVerdad<func_8055D448_traducida>(ctx); }
extern "C" void func_8055D554(CpuContext* ctx) { conMarcasDeVerdad<func_8055D554_traducida>(ctx); }

// §179.2: el dibujo ENTERO con las marcas de verdad (g_mkwRecorteDibujo == 2, lo de siempre): ScnMgr::DrawMain
// (0x80564D60) corre después de la lógica del cuadro; antes de empezar, cada ClipInfo de la lista vuelve a sus marcas y
// distancias de verdad (todos los que las leen al dibujar: los modelos, el nivel de detalle por la distancia, los
// objetos de la pista que miran su ClipInfo por su cuenta) y al terminar, otra vez «a la vista y cerca», así la lógica
// del cuadro siguiente ve lo mismo en todas las consolas. Con 1 (?recorteDibujo=modelos) solo las dos funciones de
// arriba; con 0, nada (como antes)
static int s_enDibujo = 0;
static uint32_t s_dibujosEnteros = 0;   // cuántos ScnMgr::DrawMain corrieron con las marcas de verdad

// §192 (R2): saltarse el dibujo de un cuadro sin tocar la lógica (para simular a 60 y dibujar menos: N8 de paso 7).
// La página pide «el cuadro siguiente no se dibuja» con mkw_dibujo_saltar(1) (vale para UN cuadro: se fija en el gancho
// del bucle principal, rr_kamek_81806568, abajo) o un patrón fijo con mkw_dibujo_patron(n) (n = 2: uno de cada dos;
// solo para pruebas). Mientras corre ese cuadro, mkw_dibujo_este_saltado() devuelve 1: aurora lo lee y no presenta lo
// que llegue (eso es de su lado). Con el modo 2 (mkw_dibujo_modo(2), lo de siempre) además el juego no arma el dibujo
// 3D: ScnMgr::DrawMain corre solo lo que la lógica lee después, ScnMgr::SwitchScnRoot (0x805635E4), que es donde
// ModelDirector::Update copia la posición de cada kart a su modelo y la IA de los CPU la usa (§62, §85). Lo demás de
// DrawMain (las luces, la lista de cosas que dibujan y ScnMgr::DoneDraw) solo manda trabajo a la tarjeta. Con el modo 1
// el juego dibuja todo y solo queda la marca (el paso seguro: la lógica es la misma por construcción).
static int s_saltarPedido = 0, s_esteSaltado = 0, s_modoSalto = 2, s_patron = 0;
static uint32_t s_saltados = 0, s_saltadosJuego = 0, s_vueltasDibujo = 0;
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_dibujo_saltar(int v) { s_saltarPedido = v ? 1 : 0; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_dibujo_patron(int n) { s_patron = n > 1 ? n : 0; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_dibujo_modo(int m) { s_modoSalto = m == 1 ? 1 : 2; }
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_dibujo_este_saltado() { return s_esteSaltado; }
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_dibujos_saltados() { return s_saltados; }
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_dibujos_saltados_juego() { return s_saltadosJuego; }
// (el gancho del bucle llama esto cuando el bucle va a dibujar: fija si ESTE cuadro se salta)
static void fijarSalto() {
    s_vueltasDibujo++;
    s_esteSaltado = s_saltarPedido || (s_patron && s_vueltasDibujo % static_cast<uint32_t>(s_patron) == 0);
    s_saltarPedido = 0;
    if (s_esteSaltado) s_saltados++;
}

static void marcasDeVerdad(bool deVerdad);   // (abajo: las marcas de verdad de mi cámara, o «todo a la vista»)
extern "C" void func_80564D60_traducida(CpuContext* ctx);
extern "C" void func_805635E4(CpuContext* ctx);   // ScnMgr::SwitchScnRoot
extern "C" void func_80564D60(CpuContext* ctx) {
    if (s_esteSaltado && s_modoSalto == 2) {
        // (lo mismo que hace DrawMain al final, con las mismas condiciones: si el ScnMgr —0x809C1830— no está en pausa
        // de dibujo (+0x44 bit 1), tiene su raíz (+0x20) y pide cambiarla (+0x44 bit 0): SwitchScnRoot(raíz, 1))
        const uint32_t g = 0x809C1830u, banderas = Memory::Read32(g + 0x44), raiz = Memory::Read32(g + 0x20);
        if (!(banderas & 2) && raiz && (banderas & 1)) {
            const uint32_t lr = ctx->lr, r3 = ctx->gpr[3], r4 = ctx->gpr[4];
            ctx->gpr[3] = raiz; ctx->gpr[4] = 1;
            func_805635E4(ctx);
            ctx->lr = lr; ctx->gpr[3] = r3; ctx->gpr[4] = r4;
        }
        s_saltadosJuego++;
        return;
    }
    if (!(g_mkwRelojFijo && (g_mkwLsArreglos & 1) && g_mkwRecorteDibujo == 2 && !s_enDibujo && clipVigente())) {
        func_80564D60_traducida(ctx); return; }
    marcasDeVerdad(true);
    s_enDibujo = 1;
    func_80564D60_traducida(ctx);
    s_enDibujo = 0;
    marcasDeVerdad(false);
    s_dibujosEnteros++;
}
static void marcasDeVerdad(bool deVerdad) {
    for (uint32_t i = 0; i < s_clipN; i++) {
        const uint32_t ci = s_clipLista + i * 0x24;
        for (uint32_t p = 0; p < 4; p++) {
            const uint8_t m = Memory::Read8(ci + 0x20 + p);
            if (m & 0x20) continue;
            if (deVerdad) {
                Memory::Write8(ci + 0x20 + p, static_cast<uint8_t>((m & ~3u) | (s_clipMarcas[i][p] & 3u)));
                Memory::Write32(ci + 0xC + 4 * p, s_clipDist[i][p]);
            } else {                       // (otra vez «a la vista y cerca», igual en todas las consolas)
                Memory::Write8(ci + 0x20 + p, m & ~3u);
                Memory::Write32(ci + 0xC + 4 * p, 0);
            }
        }
    }
}
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_dibujos_enteros() { return s_dibujosEnteros; }
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_recortes_dibujo() { return s_recortes; }

// AI::Character::UpdateLookAtCamera (0x807379BC): los pilotos CPU miran a la cámara cuando pasa cerca, y eso arranca
// gestos que sacan números del azar de la carrera (el mismo que deciden los objetos): con cámaras distintas, cada
// consola sacaba distinto. En la carrera sincronizada no miran a la cámara.
extern "C" void func_807379BC_traducida(CpuContext* ctx);
extern "C" void func_807379BC(CpuContext* ctx) {
    if (g_mkwRelojFijo && (g_mkwLsArreglos & 2)) return;
    func_807379BC_traducida(ctx);
}

// El HUD (posición, vuelta, tiempo, ventana del objeto, globos de objetos) muestra los datos del jugador que tiene la
// pantalla en Racedata. Esa tabla queda igual en todas las consolas (puesto 0: la mira la lógica, semillas_nativo.cpp),
// así que cada consola le dice al HUD, solo al HUD, que su jugador es el suyo: CtrlRaceBase::GetPlayerId (0x807EC7F8)
// y CtrlRaceTime::GetPlayerId (0x807F7E80) devuelven el puesto de esta consola (g_mkwMiPuesto, lo pone pad_web.cpp).
extern "C" int g_mkwMiPuesto;
extern "C" uint32_t g_mkwHumanos, g_mkwCortados;
extern "C" int g_mkwVistaPropia;   // semillas_nativo.cpp: bit 0 = el HUD y el sonido de mi kart
extern "C" void func_807EC7F8_traducida(CpuContext* ctx);
extern "C" void func_807EC7F8(CpuContext* ctx) {
    func_807EC7F8_traducida(ctx);
    if (g_mkwRelojFijo && (g_mkwVistaPropia & 1) && g_mkwMiPuesto >= 0 && g_mkwMiPuesto < 12) ctx->gpr[3] = static_cast<uint32_t>(g_mkwMiPuesto);
}
extern "C" void func_807F7E80_traducida(CpuContext* ctx);
extern "C" void func_807F7E80(CpuContext* ctx) {
    func_807F7E80_traducida(ctx);
    if (g_mkwRelojFijo && (g_mkwVistaPropia & 1) && g_mkwMiPuesto >= 0 && g_mkwMiPuesto < 12) ctx->gpr[3] = static_cast<uint32_t>(g_mkwMiPuesto);
}

// Cuándo termina la carrera: GMDataVS::CanRaceEnd (0x80536054) mira solo al jugador que tiene la pantalla (el puesto 0,
// igual en todas las consolas): apenas ese kart cruzaba la meta, la carrera se acababa para todos, aunque los otros
// humanos siguieran corriendo. En la carrera sincronizada termina cuando TODOS los humanos que siguen conectados
// cruzaron la meta (RaceinfoPlayer +0x38, bit 0x2 = terminó). Los que se fueron (g_mkwCortados, lo sabe cada consola
// en el mismo cuadro: viaja en los botones) no se esperan. Sin humanos conectados, decide el juego como siempre.
extern "C" void func_80536054_traducida(CpuContext* ctx);
extern "C" __attribute__((weak)) int mkw_red_estado_activo();   // (§275b, red_estado_nativo.cpp; débil: sin MKW_RED_ESTADO no existe)
extern "C" __attribute__((weak)) int mkw_red_estado_ajeno(uint32_t jugador);   // (§275b: 1 = un kart de otra consola)
extern "C" __attribute__((weak)) int mkw_red_estado_espera();   // (§275b: 1 = falta el aviso de llegada de algún kart de otra consola)
extern "C" void func_80536054(CpuContext* ctx) {
    func_80536054_traducida(ctx);
    // (§275b: también en «Cada uno su kart», la carrera sin lockstep: termina cuando llegaron todos los humanos)
    if (!g_mkwRelojFijo && !(mkw_red_estado_activo && mkw_red_estado_activo())) return;
    const uint32_t vivos = g_mkwHumanos & ~g_mkwCortados;
    if (!vivos) return;
    const uint32_t ri = Memory::Read32(0x809BD730u);
    if (!ri || !Memory::Contains(ri, 0x10)) return;
    const uint32_t lista = Memory::Read32(ri + 0xC);
    if (!lista || !Memory::Contains(lista, 12 * 4)) return;
    for (int i = 0; i < 12; i++) {
        if (!(vivos & (1u << i))) continue;
        const uint32_t jugador = Memory::Read32(lista + 4 * i);
        if (!jugador || !Memory::Contains(jugador, 0x3C)) return;
        if (!(Memory::Read32(jugador + 0x38) & 2u)) { ctx->gpr[3] = 0; return; }   // alguno todavía corre
    }
    // (§275b: y en «Cada uno su kart», hasta que llegó el aviso de cada kart de otra consola, también las CPU de la anfitriona)
    if (mkw_red_estado_espera && mkw_red_estado_espera()) { ctx->gpr[3] = 0; return; }
    ctx->gpr[3] = 1;
}

// EGG::AsyncDisplay::beginFrame (0x8020FE24): al empezar cada cuadro mide con el reloj REAL (mftb) cuánto falta
// para el próximo refresco y guarda esa fracción en +100 (tope: la constante de r2-25984). Parte del juego la usa
// para avanzar (la animación de los pilotos saca números de azar2 según eso), así que una consola que iba un poco
// más lenta hacía las cosas un cuadro antes o después que las otras. En la carrera sincronizada se deja siempre en
// el tope, como si cada cuadro hubiera llegado a tiempo: igual en todas.
extern "C" void func_8020FE24_traducida(CpuContext* ctx);
extern "C" void func_8020FE24(CpuContext* ctx) {
    const uint32_t yo = ctx->gpr[3], r2 = ctx->gpr[2];
    if (mkw_traza_alloc) mkw_traza_alloc(0, 0, 0, 0, 0, 9);   // depuración: "empieza un cuadro de pantalla"
    func_8020FE24_traducida(ctx);
    if (g_mkwRelojFijo && (g_mkwLsArreglos & 4) && Memory::Contains(yo + 100, 4) && Memory::Contains(r2 - 25984, 4))
        Memory::Write32(yo + 100, Memory::Read32(r2 - 25984));
}

// §83 (la C2): OS::GetTick (0x801AAD74) LLAMADO durante la carrera sincronizada. Casi todo el juego copia el mftb de
// GetTick adentro de cada función (eso ya lo cubre RELOJ_CARRERA en compilar-web.py), pero Retro Rewind lo llama de
// verdad en dos lugares que deciden la carrera, y cada consola leía su propio reloj:
//  - el sorteo de reserva de los objetos de Pulsar (rr_kamek_81836190, se llama desde 0x81836284): cuando el objeto
//    que tocó en la caja ya no tiene cupo (demasiados en la pista), elige otro con un LCG propio cuya semilla, la
//    primera vez, sale de GetTick. En la copa 65.0/75.0/39.0/74.1 (semilla 3549642503) pasa en el cuadro 5975 de la
//    carrera 1: desde ahí la misma caja daba otro objeto en cada consola y la carrera se separaba (~6100);
//  - los objetos condicionales de las pistas retro (rr_kamek_818044F8, desde 0x81804548): un número del 0 al 7 decide
//    cuáles aparecen; en contrarreloj vale 0, en línea sale de la semilla compartida y en VS... del reloj.
// (y MiiHeadsModel::Init, desde 0x807DC270, que solo anima caras). Con la carrera corriendo (hay Raceinfo) y el
// reloj fijo, GetTick devuelve el reloj de la carrera de ese lugar (PPC_MftbCarreraEn: cuadro, lugar, lr): lo mismo
// en todas. Fuera de la carrera (menús, cargas) sigue el reloj real.
extern "C" uint32_t PPC_MftbCarreraEn(uint32_t sitio, uint32_t lr);
extern "C" void func_801AAD74_traducida(CpuContext* ctx);
extern "C" void func_801AAD74(CpuContext* ctx) {
    const uint32_t ri = g_mkwRelojFijo ? Memory::Read32(0x809BD730u) : 0;   // Raceinfo
    if (ri && Memory::Contains(ri, 0x24)) { ctx->gpr[3] = PPC_MftbCarreraEn(100u, ctx->lr); return; }   // 100: lejos de los sitios de RELOJ_CARRERA
    func_801AAD74_traducida(ctx);
}

// La "compensación de lag" de Retro Rewind (Pulsar, rr_kamek_81806568: se engancha en RKSystem::Run en 0x800095C4).
// Cada vuelta del bucle principal mira cuántos refrescos de pantalla REALES pasaron (AsyncDisplay +108, lo sube la
// interrupción de cada refresco) y, si el juego va atrasado, se salta el dibujo de ese cuadro (devuelve 0: no llama a
// AsyncDisplay::beginFrame ni a GameScene::draw) para correr la lógica una vez más y alcanzar al reloj. Pero el dibujo
// también calcula cosas que la lógica lee después (ModelDirector::Update copia la posición de cada kart a su modelo, y
// la IA de los CPU la usa para decidir): cada consola se salta cuadros distintos según lo cargada que esté, y las
// carreras se separaban. En la carrera sincronizada se hace lo del juego original: si el bucle quiere dibujar (r25 ≠ 0)
// se empieza el cuadro de pantalla (AsyncDisplay::beginFrame, la versión de arriba) y se dibuja siempre. Si una consola
// no da abasto, su carrera va más lenta, y la sala la espera (lockstep).
// §207.3: mkw_dibujar_siempre(1) = lo mismo también jugando solo (solo para medir: con el lastre de la gama baja la
// compensación se salta casi todos los dibujos y la carrera suelta no se parece a la de la sala; ?dibujarSiempre=1)
static int g_mkwDibujarSiempre = 0;
static uint32_t s_rrSaltos = 0;   // (§269b: cuántas veces RR quiso saltarse un dibujo y la sala lo dibujó igual)
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_rr_saltos() { return s_rrSaltos; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_dibujar_siempre(int s) { g_mkwDibujarSiempre = s; }
extern "C" void rr_kamek_81806568_traducida(CpuContext* ctx);
extern "C" __attribute__((weak)) void mkw_n8_vuelta() {}   // (§219, N8: n8_nativo.cpp; sin él, nada)
extern "C" __attribute__((weak)) void mkw_n8_saltar_uno() {}   // (§269b: n8_nativo.cpp; sin él, se dibuja igual)
extern "C" void rr_kamek_81806568(CpuContext* ctx) {
    mkw_n8_vuelta();                  // (§219: una vuelta del bucle = un cuadro de lógica, para el patrón de N8)
    if (ctx->gpr[25]) fijarSalto();   // (§192: el bucle va a dibujar este cuadro: ¿se salta?)
    if ((!g_mkwRelojFijo || !(g_mkwLsArreglos & 8)) && !g_mkwDibujarSiempre) { rr_kamek_81806568_traducida(ctx); return; }
    const uint32_t sistema = ctx->gpr[21], dibujar = ctx->gpr[25];   // r21 = RKSystem, r25 = "este cuadro se dibuja"
    // §269b (bit 16 de la máscara): la función de RR tal cual (ajusta el divisor de cuadros de la pantalla, AsyncDisplay
    // +8, y sus contadores, y decide), y SOLO si decidió saltarse el dibujo de un cuadro que el bucle quería dibujar, el
    // cuadro empieza igual (lo de abajo). Medido: con el reemplazo entero (sin la función de RR) la sala dibujaba una
    // pasada de más (29 dibujos) y dos copias diminutas que el Single Player no hace
    if (g_mkwLsArreglos & 16) {
        const uint32_t lr = ctx->lr;
        rr_kamek_81806568_traducida(ctx);
        if (!dibujar || ctx->gpr[3]) return;          // no había que dibujar, o RR ya empezó el cuadro: igual que RR
        ctx->lr = lr;
        s_rrSaltos++;
        // §269b (bit 32): el cuadro empieza (abajo) pero su dibujo se salta como lo salta N8 (n8_nativo.cpp: solo lo que
        // la lógica lee del dibujo): la misma compensación de lag que jugando solo, sin separar la carrera
        if (g_mkwLsArreglos & 32) mkw_n8_saltar_uno();
    }
    uint32_t resultado = 0;
    if (dibujar) {
        const uint32_t display = Memory::Read32(sistema + 76);      // RKSystem +0x4C = EGG::AsyncDisplay
        if (display) {
            const uint32_t lr = ctx->lr;
            ctx->gpr[3] = display;
            func_8020FE24(ctx);                                      // AsyncDisplay::beginFrame (espera el refresco)
            ctx->lr = lr;
        }
        resultado = 1;
    }
    ctx->gpr[3] = resultado;
    ctx->gpr[25] = resultado;
    ctx->cr = (ctx->cr & 0x0FFFFFFFu) | (resultado ? 0x40000000u : 0x20000000u);   // cr0: "mayor" o "igual" que 0
}

// §75: el fin de la carrera en la sala, con las reglas del juego.
//
// (1) El tiempo límite, como en la carrera EN LÍNEA del juego. En nuestras salas la carrera corre como una VS "local"
// (GMDataVS), que espera a que TODOS los humanos crucen la meta: si uno no llega (se quedó quieto, se fue al baño), la
// carrera no terminaba nunca. En línea el juego tiene un límite: GMDataOnlineVS::Update (0x8053F2A4) mira el reloj de la
// carrera (Raceinfo +0x14 → minutos +0x8, segundos +0xA, milésimas +0xC) y, cuando pasa del límite (5:00 en el juego
// original; Retro Rewind lo cambia por el número que guarda en 0x818759B0, rr_kamek_81811238), a cada piloto que todavía
// no cruzó la meta (RaceinfoPlayer +0x38, bit 0x2) le termina la carrera con un tiempo estimado por lo que avanzó
// (0x805342E8 con 4 y 1). Aquí se hace lo mismo con los humanos de la sala: el reloj de la carrera es parte de la
// simulación (reloj fijo), así que pasa en el MISMO cuadro en todas las consolas. Nadie sale de la sala por quedarse
// quieto (mkw_modos_inactividad sigue apagado): solo termina SU carrera, con su puesto. Module._mkw_sala_limite(ms) =
// otro límite (solo pruebas: ?limite=N segundos); 0 = el del juego.
//
// (2) Terminar la carrera de los humanos que siguen conectados, como si hubieran cruzado la meta (para las pruebas:
// una carrera entera tarda minutos y en la prueba nadie maneja). Module._mkw_sala_terminar(máscara) pone una bandera
// (bit i = el puesto i; 0 = todos); la página la pone en el MISMO cuadro en todas las consolas (lockstep.mjs enCuadro:
// el cuadro viaja con la carrera sincronizada), y aquí, con la carrera corriendo (etapa 2), se llama
// RaceinfoPlayer::EndLap (0x805349B8, la que corre al cruzar la meta) hasta pasar la última vuelta de cada humano, en el
// orden de los puestos. Lo demás —el puesto, el tiempo, el fin de la carrera (GMDataVS::CanRaceEnd, arriba), los
// puntos— lo hace el juego como siempre. (mkw_modos_terminar, §72, hace lo mismo pero engancha el control de
// inactividad de la carrera EN LÍNEA del juego, que en nuestras salas, una carrera VS "local", no corre.)
//
// (3) Los puntos, una vez por carrera y en el mismo cuadro en todas. El juego suma los puntos de la carrera
// (RacedataScenario::UpdatePoints, 0x8052E950, sobre el escenario de los MENÚS, Racedata +0xC10: de ahí los copia a la
// carrera siguiente) recién cuando la pantalla de resultados llena la tabla (GPVSLeaderboardUpdate::FillRows,
// 0x8085C858; y otras tablas: 0x8085CE8C, 0x8085EA54, rr_kamek_81829848). En la sala esa pantalla puede no llegar a
// llenarse (la carrera siguiente abre directo, o se la salta quien recargó), así que la tabla de la copa salía con los
// puntos de una sola carrera. Aquí, en la sala, se llaman en el primer cuadro con la carrera terminada (etapa 4 o más:
// los puestos ya son los finales) y una bandera hace que las llamadas de las tablas, en esa misma carrera, no sumen otra
// vez. La bandera se baja cuando corre una carrera nueva (etapa menor que 4).
//
// (4) §77, el reloj de los que faltan («DNF», pedido del dueño, como en las carreras en línea de Mario Kart 8): en el
// cuadro en que el PRIMER corredor cruza la meta —humano o CPU, lo pidió así el dueño— empieza a correr un plazo de 30 s
// (del reloj de la carrera); al vencer, a cada humano que todavía no llegó el juego le termina la carrera en el puesto
// en que va (la misma función del tiempo límite: 0x805342E8 con 4 y 1, un tiempo estimado por lo que avanzó; las CPU
// las termina el juego solo cuando terminan los humanos). Así nadie espera a uno que va muy atrás o se quedó quieto.
// Como el tiempo límite, corre sobre el reloj de la carrera: vence en el mismo cuadro en todas las consolas.
// Module._mkw_sala_dnf(ms) = otro plazo (0 = 30 s; la página pone el suyo, dnf.mjs, para que su contador diga lo
// mismo); mkw_sala_dnf_desde() = el reloj de la carrera cuando llegó el primero (-1 = todavía nadie).
//
// Los cuatro van al final de Raceinfo::Update (la versión de RR, 0x805331B4: en Retro Rewind el despacho usa esa).
namespace { int32_t g_salaTerminar = 0; uint32_t g_salaMascara = 0; uint32_t g_salaLimite = 0; int32_t g_salaPuntos = 0;
            uint32_t g_salaDnf = 0; int32_t g_salaPrimero = -1; }
constexpr uint32_t kDnfMs = 30000;              // los 30 s después de que llega el primero
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_sala_dnf(uint32_t ms) { g_salaDnf = ms; }
extern "C" EMSCRIPTEN_KEEPALIVE int32_t mkw_sala_dnf_desde() { return g_salaPrimero; }
extern "C" void func_8052E950_traducida(CpuContext* ctx);
extern "C" void func_8052E950(CpuContext* ctx) {                       // RacedataScenario::UpdatePoints
    if (g_mkwHumanos && g_salaPuntos) return;                           // (sala) los de esta carrera ya se sumaron
    func_8052E950_traducida(ctx);
    if (g_mkwHumanos) g_salaPuntos = 1;
}
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_sala_puntos_sumados() { return g_salaPuntos; }   // (para mirar)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_sala_terminar(uint32_t mascara) { g_salaTerminar = 1; g_salaMascara = mascara; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_sala_limite(uint32_t ms) { g_salaLimite = ms; }
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t mkw_sala_limite_juego() {   // (para mirar: el límite que usa el juego, en ms)
    const uint32_t rr = Memory::Contains(0x818759B0u, 4) ? Memory::Read32(0x818759B0u) : 0;
    return rr ? rr : 300000u;
}
extern "C" void rr_overlay_805331B4_traducida(CpuContext* ctx);
extern "C" void rr_overlay_805331B4(CpuContext* ctx) {
    rr_overlay_805331B4_traducida(ctx);
    if (!g_salaTerminar && !g_mkwHumanos) return;
    const uint32_t ri = Memory::Read32(0x809BD730u);                    // Raceinfo
    if (!ri || !Memory::Contains(ri, 0x2C)) return;
    const uint32_t etapa = Memory::Read32(ri + 0x28);
    if (g_mkwHumanos) {                                                 // (3) los puntos de la carrera
        if (etapa < 2) g_salaPrimero = -1;                              // (4) carrera nueva: nadie llegó todavía
        if (etapa < 4) g_salaPuntos = 0;
        else if (!g_salaPuntos) {
            CpuContext c = *ctx;
            c.gpr[3] = Memory::Read32(0x809BD728u) + 0xC10;               // como FillRows: el escenario de los menús
            if (c.gpr[3] != 0xC10) func_8052E950(&c);
        }
    }
    if (g_salaTerminar && etapa > 2) { g_salaTerminar = 0; return; }   // ya terminó: no queda para la próxima
    if (etapa != 2) return;                                             // presentación o cuenta regresiva: espera
    const uint32_t lista = Memory::Read32(ri + 0xC);                   // RaceinfoPlayer* de cada jugador
    if (!lista || !Memory::Contains(lista, 12 * 4)) return;
    // quiénes son humanos: los de la sala (g_mkwHumanos); sin sala, los jugadores de verdad (tipo 0) de la carrera
    // (Racedata 0x809BD728, escenario +0x20, jugador i en +0x8 + i·0xF0, tipo +0x10)
    uint32_t humanos = g_mkwHumanos;
    if (!humanos) {
        const uint32_t rd = Memory::Read32(0x809BD728u);
        for (int i = 0; rd && i < 12; i++) if (Memory::Read32(rd + 0x20 + 0x8 + i * 0xF0 + 0x10) == 0) humanos |= 1u << i;
    }
    if (g_salaTerminar) {
        g_salaTerminar = 0;
        const uint32_t quienes = (humanos & ~g_mkwCortados) & (g_salaMascara ? g_salaMascara : 0xFFFu);
        for (int i = 0; i < 12; i++) {
            if (!(quienes & (1u << i))) continue;
            const uint32_t p = Memory::Read32(lista + 4 * i);
            if (!p || !Memory::Contains(p, 0x40)) continue;
            // currentLap (+0x24) contra maxLap (+0x26): EndLap termina la carrera al pasar la última; tope de 8 por las dudas
            for (int v = 0; v < 8 && Memory::Read16(p + 0x24) <= Memory::Read8(p + 0x26); v++) {
                CpuContext c = *ctx;                                    // sobre una copia, como modos_nativo.cpp
                c.gpr[3] = p;
                InvokeDirectCpu<0x805349B8u>(&c);
            }
        }
    }
    if (!g_mkwHumanos) return;                                          // (el tiempo límite: solo en la sala)
    const uint32_t reloj = Memory::Read32(ri + 0x14);                  // el reloj de la carrera
    if (!reloj || !Memory::Contains(reloj, 0x10)) return;
    const uint32_t ms = (Memory::Read16(reloj + 0x8) * 60u + Memory::Read8(reloj + 0xA)) * 1000u + Memory::Read16(reloj + 0xC);
    // (4) ¿ya llegó alguien, humano o CPU? (RaceinfoPlayer +0x38, bit 0x2) — se anota el reloj de ese cuadro. Los que
    // corren: los primeros N de la lista (N = Racedata, escenario de la carrera +0x4)
    const uint32_t rdCarrera = Memory::Read32(0x809BD728u);
    const uint32_t corren = rdCarrera ? (Memory::Read8(rdCarrera + 0x20 + 4) < 12 ? Memory::Read8(rdCarrera + 0x20 + 4) : 12u) : 12u;
    for (uint32_t i = 0; g_salaPrimero < 0 && i < corren; i++) {
        const uint32_t p = Memory::Read32(lista + 4 * i);
        if (p && Memory::Contains(p, 0x40) && (Memory::Read32(p + 0x38) & 2u)) g_salaPrimero = static_cast<int32_t>(ms);
    }
    const uint32_t limite = g_salaLimite ? g_salaLimite : mkw_sala_limite_juego();
    const bool vencioDnf = g_salaPrimero >= 0 && ms >= static_cast<uint32_t>(g_salaPrimero) + (g_salaDnf ? g_salaDnf : kDnfMs);
    if (ms <= limite && !vencioDnf) return;                             // ni el tiempo límite ni los 30 s
    for (int i = 0; i < 12; i++) {
        if (!(humanos & (1u << i))) continue;
        // (§275b: en «Cada uno su kart» al humano de OTRA consola lo termina su consola y llega por su aviso, con su tiempo)
        if (mkw_red_estado_ajeno && mkw_red_estado_ajeno(static_cast<uint32_t>(i))) continue;
        const uint32_t p = Memory::Read32(lista + 4 * i);
        if (!p || !Memory::Contains(p, 0x40) || (Memory::Read32(p + 0x38) & 2u)) continue;   // ya cruzó la meta
        CpuContext c = *ctx;
        c.gpr[3] = p; c.gpr[4] = 4; c.gpr[5] = 1;                       // como GMDataOnlineVS::Update
        InvokeDirectCpu<0x805342E8u>(&c);
    }
}
