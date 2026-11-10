// N8 de la etapa 3 del plan v4 (bitácora §219): simular a 60, dibujar a 30 y mostrar 60 con la interpolación de aurora.
//
// Resumen. Con la carrera andando, el juego dibuja uno de cada dos cuadros: en el saltado no corre
// EGG::SceneManager::draw (0x8023AEAC) —solo lo que la lógica lee del dibujo, ScnMgr::SwitchScnRoot, como W10 §207 y R2
// §192— ni la copia a la pantalla EGG::XfbManager::copyEFB (0x80244268), así ese cuadro no le da trabajo a aurora ni a la
// tarjeta. La lógica sigue a 60. Dos modos (mkw_n8_modo, la página lo pide con ?n8=1|2):
//   1 = solo dibujar a 30: cada imagen se ve dos refrescos (30 a la vista);
//   2 = además la interpolación de aurora (120 de «fluidez» = una imagen intermedia por cuadro dibujado): en el cuadro
//       dibujado aurora muestra la imagen de entre medio (entre el dibujado anterior y este) y guarda la de verdad; el
//       cuadro saltado, en el lugar de su copia, la muestra (aurora_mkw_presentar_pendiente, un refresco después).
//       Se ven 60 imágenes distintas por segundo, a cambio de un cuadro (16,7 ms) más de demora y del 2D a 30.
// Como un motor de dos tiempos que solo enciende cada dos vueltas, con un volante (la interpolación) que reparte el
// empuje para que el eje gire parejo. En los menús nunca (allí el dibujo no es un sumidero, §196). Apagado = el juego de
// siempre: las dos envolturas llaman a la función traducida y nada más.
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

#include <cstdint>

extern "C" {
void aurora_set_frame_interpolation_fps(uint32_t targetFps);
uint32_t aurora_get_frame_interpolation_fps();
void aurora_mkw_n8(int on);
int aurora_mkw_presentar_pendiente(int donde);
uint32_t aurora_mkw_n8_cuenta(int i);
double aurora_mkw_n8_espera_ms();
}

namespace {
int g_modo = 0;                 // el modo en uso: 0, 1 o 2
int g_pedido = 0;               // G15 (§255): lo que pidió la página; pasa a g_modo en el borde limpio de un par
double g_cambiosModo = 0;       // G15: cuántas veces cambió el modo
bool g_activo = false;          // N8 corriendo ahora (modo > 0 y la carrera andando)
uint32_t g_fluidezAntes = 0;    // la fluidez de aurora antes de prender el modo 2 (se devuelve al apagar)
uint32_t g_vuelta = 0;          // vueltas del bucle del juego (una por cuadro de lógica, la cuenta el gancho de RR)
uint32_t g_vueltaDibujo = 0;    // la vuelta del último cuadro dibujado
bool g_saltarCopia = false;     // el cuadro saltado tampoco copia a la pantalla
double g_c[6] = {0, 0, 0, 0, 0, 0};   // dibujados, saltados, copias saltadas, reales mostradas en el saltado, prendidas, apagadas

// ¿la carrera andando? (el Raceinfo, 0x809BD730, existe y su etapa, +0x28, es menor que 4: lo mismo que mkw.mjs)
bool carreraAndando() {
    const uint32_t ri = Memory::Read32(0x809BD730u);
    return ri && Memory::Contains(ri, 0x2C) && Memory::Read32(ri + 0x28) < 4;
}

void cambiar(bool activo) {
    if (activo == g_activo) return;
    g_activo = activo;
    g_c[activo ? 4 : 5]++;
    if (g_modo == 2) {
        if (activo) {
            g_fluidezAntes = aurora_get_frame_interpolation_fps();
            aurora_set_frame_interpolation_fps(120);   // (una imagen intermedia por cuadro dibujado)
            aurora_mkw_n8(1);
        } else {
            aurora_mkw_n8(0);
            aurora_set_frame_interpolation_fps(g_fluidezAntes);
        }
    }
    g_saltarCopia = false;
}
// G15 (§255): el modo pedido pasa a ser el de uso solo en un borde limpio: con N8 apagado o en un cuadro que de todos
// modos se dibuja (el par anterior, dibujado + saltado, ya se cerró). Así la imagen de verdad que aurora guardó en el
// modo 2 alcanza a salir (en la copia del saltado o aquí mismo) y nunca queda un hueco ni una imagen repetida: como
// cambiar la marcha de un motor en el punto muerto y no a mitad del giro.
void aplicarPedido() {
    if (g_pedido == g_modo) return;
    if (g_activo && g_vuelta - g_vueltaDibujo == 1) return;   // (este es el saltado de un par: espera al siguiente)
    if (g_modo == 2 && g_activo) aurora_mkw_presentar_pendiente(1);
    cambiar(false);
    g_modo = g_pedido;
    g_cambiosModo++;
}
}  // namespace

// (G15, §255: se puede llamar en cualquier momento, también en plena carrera; se aplica en el cuadro siguiente que se
// dibuja, a más tardar dos cuadros de lógica después. La lógica no se entera: sigue a 60)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_n8_modo(int m) {
    g_pedido = m == 1 || m == 2 ? m : 0;
}
// 0 dibujados, 1 saltados, 2 copias saltadas, 3 reales mostradas en el cuadro saltado, 4 veces prendido, 5 apagado,
// 6 modo, 7 activo; 8–11 la cuenta de aurora (guardadas, mostradas, descartadas, grupos sin intermedia); 12 ms que
// esperaron las reales guardadas hasta salir (sumados); 13 reales que
// salieron al empezar el dibujo del cuadro siguiente; 14 lo pedido (G15); 15 cambios de modo aplicados (G15)
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_n8_estado(int i) {
    if (i >= 0 && i < 6) return g_c[i];
    if (i == 6) return g_modo;
    if (i == 7) return g_activo ? 1 : 0;
    if (i >= 8 && i < 12) return aurora_mkw_n8_cuenta(i - 8);
    if (i == 12) return aurora_mkw_n8_espera_ms();
    if (i == 13) return aurora_mkw_n8_cuenta(4);
    if (i == 14) return g_pedido;        // (G15) lo pedido, todavía sin aplicar si es distinto de 6
    if (i == 15) return g_cambiosModo;   // (G15) cambios de modo aplicados
    return -1;
}
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_n8_reiniciar() { for (double& v : g_c) v = 0; }
// (el gancho del bucle de RR, rr_kamek_81806568 en lockstep_nativo.cpp, cuenta las vueltas: una por cuadro de lógica,
// se dibuje o no; así el patrón es de cuadros de lógica aunque la compensación de lag de RR se salte alguno)
extern "C" void mkw_n8_vuelta() { g_vuelta++; }

extern "C" void func_8023AEAC_traducida(CpuContext* ctx);   // EGG::SceneManager::draw
extern "C" void func_805635E4(CpuContext* ctx);             // ScnMgr::SwitchScnRoot
extern "C" void func_8023AEAC(CpuContext* ctx) {
    aplicarPedido();
    if (!g_modo) { func_8023AEAC_traducida(ctx); return; }
    cambiar(carreraAndando());
    // se salta si el cuadro de lógica anterior se dibujó (nunca dos seguidos por N8)
    if (!g_activo || g_vuelta - g_vueltaDibujo != 1) {
        g_vueltaDibujo = g_vuelta;
        g_c[0]++;
        // (modo 2) si la imagen de verdad del par anterior no salió en el cuadro saltado (su hora caía después de este
        // refresco: un cuadro dibujado más largo que un refresco), sale ahora, al empezar este dibujo, sin esperar
        if (g_modo == 2 && g_activo) aurora_mkw_presentar_pendiente(1);
        func_8023AEAC_traducida(ctx);
        return;
    }
    // lo que la lógica lee del dibujo (lo mismo que DrawMain al final, §192): si el ScnMgr (0x809C1830) no está en pausa
    // de dibujo (+0x44 bit 1), tiene su raíz (+0x20) y pide cambiarla (+0x44 bit 0): SwitchScnRoot(raíz, 1)
    const uint32_t g = 0x809C1830u, banderas = Memory::Read32(g + 0x44), raiz = Memory::Read32(g + 0x20);
    if (!(banderas & 2) && raiz && (banderas & 1)) {
        const uint32_t lr = ctx->lr, r3 = ctx->gpr[3], r4 = ctx->gpr[4];
        ctx->gpr[3] = raiz; ctx->gpr[4] = 1;
        func_805635E4(ctx);
        ctx->lr = lr; ctx->gpr[3] = r3; ctx->gpr[4] = r4;
    }
    g_c[1]++;
    g_saltarCopia = true;
}

extern "C" void func_80244268_traducida(CpuContext* ctx);   // EGG::XfbManager::copyEFB (GXCopyDisp y el giro de los XFB)
extern "C" void func_80244268(CpuContext* ctx) {
    if (!g_saltarCopia) { func_80244268_traducida(ctx); return; }
    g_saltarCopia = false;
    g_c[2]++;
    // (modo 2) la imagen de verdad del cuadro dibujado, guardada por aurora, sale ahora: un refresco después de la
    // intermedia (aurora espera, cediendo, hasta su hora; si esa hora cae después del refresco del cuadro siguiente,
    // no espera aquí: sale al empezar el dibujo del siguiente)
    if (g_modo == 2 && aurora_mkw_presentar_pendiente(0)) g_c[3]++;
}
