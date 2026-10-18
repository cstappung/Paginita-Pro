// RacedataScenario::InitRng con las semillas de la página: «Copa a tu gusto» juega con SU semilla — bitácora §56.
//
// Resumen: cada carrera tiene dos "semillas" (Racedata, ajustes de la carrera +0x2C y +0x30): los números de los
// que sale todo su azar (qué objeto toca en cada caja, qué hacen los CPU). Al preparar la carrera, el juego llama a
// RacedataScenario::InitRng (0x8052F924), que en GP y VS las reemplaza por el reloj de la consola (la instrucción
// mftb: el "cuentavueltas" del procesador), así cada carrera sale distinta. Para «Copa a tu gusto» la página elige
// la semilla (la muestra y cambia con cada 🎲): con esta versión, después de la del juego, si la página tiene una
// semilla para esta carrera (Module.mkwSemillas → [s1, s2]), se escriben esas. Sin pedido de la página (los demás
// modos, en línea, Node) queda exactamente lo del juego.
//
// Cómo se engancha: igual que web/dvd (compilar-web.py, REEMPLAZOS): la traducida pasa a llamarse
// func_8052F924_traducida y esta define func_8052F924, así le llegan todas las llamadas.
#include "ppc_runtime.h"
#include "memory.h"

#include <emscripten/emscripten.h>

extern "C" void func_8052F924_traducida(CpuContext* ctx);   // la del juego, con el nombre cambiado

// La semilla que la página quiere para la carrera que se prepara (1 = hay, y quedó en s[0], s[1])
EM_JS(int, mkw_web_semillas, (uint32_t* s), {
    const v = Module.mkwSemillas && Module.mkwSemillas();
    if (!v) return 0;
    HEAPU32[s >> 2] = v[0] >>> 0;
    HEAPU32[(s >> 2) + 1] = v[1] >>> 0;
    return 1;
});

// La carrera sincronizada de la sala con CPU (lockstep, bitácora §61): la página pide el reloj fijo. Desde aquí
// (preparar la carrera: el mismo momento en todas las consolas) el reloj del azar (PPC_MftbCarrera, ppc_helpers.cpp)
// es un contador que empieza en el mismo número en todas, así el azar que el juego saca del reloj sale igual.
// Solo con semilla de la página (la sala la reparte): sin ella no hay número común del que partir.
EM_JS(int, mkw_web_reloj_pedido, (), { return Module.mkwRelojFijo ? 1 : 0; });
// ¿Los arreglos de "todo a la vista" y "los CPU no miran la cámara" (lockstep_nativo.cpp)? Module.mkwLsArreglos (?arreglos=0 los apaga)
EM_JS(int, mkw_web_ls_arreglos, (), { return Module.mkwLsArreglos === false ? 0 : 1; });
extern "C" int g_mkwLsArreglos = 1;
// ¿Sonido, HUD y cámara de mi kart (vista propia)? Module.mkwVistaPropia: bit 0 sonido/HUD, bit 1 cámara (?vista=0, ?camara=0 para comparar)
EM_JS(int, mkw_web_vista_propia, (), { return Module.mkwVistaPropia === undefined ? 3 : Module.mkwVistaPropia | 0; });
extern "C" int g_mkwVistaPropia = 3;
extern "C" int g_mkwRelojFijo;
extern "C" unsigned g_mkwRelojGeneracion;   // ppc_helpers.cpp: cambia en cada carrera
extern "C" uint64_t g_mkwRelojValor;
extern "C" uint32_t g_mkwHumanos = 0;              // bit i = el puesto i es un humano de la sala (lo usa pad_web.cpp)
extern "C" int8_t g_mkwPuestoDeMando[4] = {-1, -1, -1, -1};   // mando → puesto de su kart (pad_web.cpp, lockstep_nativo.cpp)
extern "C" uint32_t g_mkwCortados = 0;             // bit i = el humano del puesto i se fue (lo pone pad_web.cpp)
extern "C" int g_mkwMiPuesto = -1;                  // el puesto de esta consola en la carrera sincronizada (lo pone pad_web.cpp; -1 = no hay)

// El plantel de la carrera sincronizada: personaje y vehículo de cada uno de los 12 puestos, que la página reparte
// igual a todas las consolas (los CPU de VS eligen al azar en los menús, con el reloj real: cada consola elegiría
// otros). Module.mkwPlantel → [[vehículo, personaje, tipo, mando], …12] (-1 = no tocar; el tipo lo usa el piloto).
// mando ≥ 0: ese puesto lo maneja el mando de GameCube número `mando` (los otros humanos de la sala: la página pone
// en ese puerto lo que tocan ellos). El juego lo cree un CPU (así no arma pantalla dividida) pero el kart lee sus
// botones del mando: RaceinfoPlayer elige de dónde lee según el "índice de mando" del jugador (+0x6), no su tipo.
EM_JS(int, mkw_web_plantel, (int32_t* p), {
    const v = Module.mkwPlantel && Module.mkwPlantel();
    if (!v || v.length !== 12) return 0;
    for (let i = 0; i < 12; i++) for (let k = 0; k < 4; k++) HEAP32[(p >> 2) + i * 4 + k] = (v[i][k] ?? -1) | 0;
    return 1;
});


extern "C" void func_8052F924(CpuContext* ctx) {
    const uint32_t escenario = ctx->gpr[3];        // r3 = this (el RacedataScenario que se prepara)
    func_8052F924_traducida(ctx);                  // primero lo del juego (no cambia nada más que las semillas)
    uint32_t s[2];
    if (mkw_web_semillas(s)) {
        Memory::Write32(escenario + 0xB74, s[0]);  // ajustes (+0xB48) + 0x2C: semilla 1
        Memory::Write32(escenario + 0xB78, s[1]);  // ajustes + 0x30: semilla 2
        // carrera sincronizada: el reloj del azar arranca en un número que sale de la semilla (igual en todas)
        if (mkw_web_reloj_pedido()) {
            g_mkwRelojValor = (static_cast<uint64_t>(s[0]) << 12) ^ s[1];
            g_mkwRelojFijo = 1;
            ++g_mkwRelojGeneracion;                     // la hora de la carrera (os_time.cpp) empieza de cero
            g_mkwLsArreglos = mkw_web_ls_arreglos();
            g_mkwVistaPropia = mkw_web_vista_propia();
        }
        // personaje y vehículo de los 12 puestos (los tipos los escribe el piloto en los menús, menus.mjs: aquí ya
        // se contaron jugadores, pantallas y mandos). Jugadores: escenario + 0x8 + i·0xF0; vehículo +0x8, personaje +0xC
        int32_t plantel[48];
        g_mkwHumanos = 0; g_mkwCortados = 0;
        for (int m = 0; m < 4; m++) g_mkwPuestoDeMando[m] = -1;
        if (mkw_web_plantel(plantel)) {
            const uint32_t entrada = Memory::Read32(0x809BD70C);             // Input::Manager
            for (int i = 0; i < 12; i++) {
                const uint32_t j = escenario + 0x8 + i * 0xF0;
                const int32_t* x = plantel + i * 4;
                if (x[0] >= 0) Memory::Write32(j + 0x8, x[0]);
                if (x[1] >= 0) Memory::Write32(j + 0xC, x[1]);
                if (x[3] >= 0 && x[3] < 4 && entrada) {
                    g_mkwHumanos |= 1u << i;
                    g_mkwPuestoDeMando[x[3]] = static_cast<int8_t>(i);
                    Memory::Write8(j + 0x6, static_cast<uint8_t>(x[3]));      // índice de mando
                    // RealControllerHolder[mando] (Input::Manager + 4 + mando·0xEC) → el mando de GameCube de ese
                    // puerto (Input::Manager + 0x3BA0 + mando·0xB0); sin esto apunta al mando "vacío"
                    const uint32_t holder = entrada + 4 + x[3] * 0xEC, mando = entrada + 0x3BA0 + x[3] * 0xB0;
                    Memory::Write32(holder + 4, mando); Memory::Write32(holder + 8, mando); Memory::Write32(holder + 12, mando);
                }
            }
        }
        // La pantalla NO se mueve: la tabla de pantallas de Racedata la mira parte de la lógica (cuándo termina la
        // carrera, Lakitu, las marcas del kart con pantalla…), así que tiene que ser igual en todas las consolas (el
        // juego la pone en el puesto 0). Cada consola solo apunta su cámara a su kart (pad_web.cpp, cámara +0x9C).
    }
}
