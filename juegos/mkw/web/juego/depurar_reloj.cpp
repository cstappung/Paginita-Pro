// DEPURACIÓN (§83, la C2): quién lee el reloj del procesador durante la carrera sincronizada.
//
// Resumen: en la sala cada consola corre la misma carrera; las funciones del juego que sacan su azar del reloj del
// procesador (lista RELOJ_CARRERA de compilar-web.py) leen un reloj de mentira igual en todas. Si OTRA función lee el
// reloj de verdad y con eso decide algo de la carrera, cada consola decide distinto y la carrera se separa. Con
// MKW_DEPURAR_RELOJ=1, compilar-web.py cambia en TODAS las demás funciones del juego la lectura del reloj (PPC_Mftb)
// por esta, que devuelve lo mismo (el reloj de verdad) pero, con la carrera sincronizada encendida, anota en la
// consola «[RELOJ] función lr cuadro vez»: las 3 primeras veces de cada lugar (función + desde dónde la llamaron) en
// cada carrera, y después la 4.ª, 8.ª, 16.ª… (para ver si lee todo el tiempo sin llenar la consola).
// Como poner un amperímetro en cada rama de un circuito para encontrar la que se lleva la corriente que falta.
#include "ppc_runtime.h"
#include "memory.h"
#include <emscripten/emscripten.h>
#include <cstdint>

extern "C" int g_mkwRelojFijo;
extern "C" unsigned g_mkwRelojGeneracion;

namespace {
struct Lugar { uint32_t dir, lr, veces; };
Lugar g_lugares[512];
unsigned g_cuantos = 0, g_generacion = ~0u;
}

extern "C" unsigned int PPC_MftbVigia(unsigned int dir, unsigned int lr) {
    const uint32_t t = PPC_Mftb();
    if (!g_mkwRelojFijo) return t;
    if (g_generacion != g_mkwRelojGeneracion) { g_generacion = g_mkwRelojGeneracion; g_cuantos = 0; }   // carrera nueva
    const uint32_t ri = Memory::Read32(0x809BD730u);
    if (!Memory::Contains(ri, 0x24)) return t;                     // sin carrera (menús, carga): no interesa
    const uint32_t cuadro = static_cast<uint32_t>(Memory::Read16(ri + 0x1E)) + Memory::Read32(ri + 0x20);
    Lugar* l = nullptr;
    for (unsigned i = 0; i < g_cuantos; i++) if (g_lugares[i].dir == dir && g_lugares[i].lr == lr) { l = &g_lugares[i]; break; }
    if (!l && g_cuantos < 512) { l = &g_lugares[g_cuantos++]; *l = Lugar{dir, lr, 0}; }
    if (!l) return t;
    const uint32_t v = ++l->veces;
    if (v <= 3 || (v & (v - 1)) == 0)
        EM_ASM({ console.log('[RELOJ] ' + ($0 >>> 0).toString(16) + ' lr ' + ($1 >>> 0).toString(16) + ' cuadro ' + $2 + ' vez ' + $3); },
               dir, lr, cuadro, v);
    return t;
}
