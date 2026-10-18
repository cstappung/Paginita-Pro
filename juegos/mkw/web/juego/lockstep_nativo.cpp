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
#include "memory.h"

#include <cstring>

extern "C" int g_mkwRelojFijo;
extern "C" int g_mkwLsArreglos;   // semillas_nativo.cpp: 0 = sin "todo a la vista" ni "no miran la cámara" (?arreglos=0, para comparar)
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
extern "C" void func_80787774_traducida(CpuContext* ctx);
extern "C" void func_80787774(CpuContext* ctx) {
    const uint32_t mgr = ctx->gpr[3];
    func_80787774_traducida(ctx);
    if (!g_mkwRelojFijo || !g_mkwLsArreglos) return;
    const uint32_t lista = Memory::Read32(mgr + 0x10), n = Memory::Read32(mgr + 0x18);
    if (!lista || n > 4096 || !Memory::Contains(lista, n * 0x24)) return;
    for (uint32_t i = 0; i < n; i++) {
        const uint32_t ci = lista + i * 0x24;
        for (uint32_t pantalla = 0; pantalla < 4; pantalla++) {
            const uint8_t m = Memory::Read8(ci + 0x20 + pantalla);
            if (m & 0x20) continue;
            Memory::Write8(ci + 0x20 + pantalla, m & ~3u);
            Memory::Write32(ci + 0xC + 4 * pantalla, 0);
        }
    }
}

// AI::Character::UpdateLookAtCamera (0x807379BC): los pilotos CPU miran a la cámara cuando pasa cerca, y eso arranca
// gestos que sacan números del azar de la carrera (el mismo que deciden los objetos): con cámaras distintas, cada
// consola sacaba distinto. En la carrera sincronizada no miran a la cámara.
extern "C" void func_807379BC_traducida(CpuContext* ctx);
extern "C" void func_807379BC(CpuContext* ctx) {
    if (g_mkwRelojFijo && g_mkwLsArreglos) return;
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
extern "C" void func_80536054(CpuContext* ctx) {
    func_80536054_traducida(ctx);
    if (!g_mkwRelojFijo) return;
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
    if (g_mkwRelojFijo && g_mkwLsArreglos && Memory::Contains(yo + 100, 4) && Memory::Contains(r2 - 25984, 4))
        Memory::Write32(yo + 100, Memory::Read32(r2 - 25984));
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
extern "C" void rr_kamek_81806568_traducida(CpuContext* ctx);
extern "C" void rr_kamek_81806568(CpuContext* ctx) {
    if (!g_mkwRelojFijo || !g_mkwLsArreglos) { rr_kamek_81806568_traducida(ctx); return; }
    const uint32_t sistema = ctx->gpr[21], dibujar = ctx->gpr[25];   // r21 = RKSystem, r25 = "este cuadro se dibuja"
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
