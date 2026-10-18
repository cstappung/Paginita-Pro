// DEPURACIÓN TEMPORAL (§61): quién saca números del azar de la carrera (Raceinfo +4 / +8) y en qué cuadro.
#include "ppc_runtime.h"
#include "memory.h"
#include <emscripten/emscripten.h>
extern "C" void mkw_vigia_poner(uint32_t desde, uint32_t tam);
static void anota(const char* que, CpuContext* ctx) {
    const uint32_t ri = Memory::Read32(0x809BD730);
    if (ri < 0x80000000u || ri >= 0x81800000u) return;
    const uint32_t r1 = Memory::Read32(ri + 4), r2 = Memory::Read32(ri + 8), yo = ctx->gpr[3];
    if (yo != r1 && yo != r2) return;
    const uint32_t f = Memory::Read32(ri + 0x20);
    // el tramo de cuadros sale de la dirección: ?depura=desde-hasta (por omisión 380-600)
    static int desde = -1, hasta = -1;
    if (desde < 0) {
        desde = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec(new URLSearchParams(location.search).get('depura') || (typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[1] : 380; });
        hasta = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec(new URLSearchParams(location.search).get('depura') || (typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[2] : 600; });
    }
    if (static_cast<int>(f) < desde || static_cast<int>(f) > hasta) return;
    uint32_t sp = ctx->gpr[1], cadena[4] = {0, 0, 0, 0};
    for (int i = 0; i < 4; i++) { if (!Memory::Contains(sp, 8)) break; sp = Memory::Read32(sp); if (!Memory::Contains(sp, 8)) break; cadena[i] = Memory::Read32(sp + 4); }
    EM_ASM({ console.log('[DEPURA] azar' + $0 + ' ' + UTF8ToString($1) + ' cuadro ' + $2 + ' estado ' + ($8 >>> 0).toString(16) + ':' + ($9 >>> 0).toString(16) + ' desde ' + ($3 >>> 0).toString(16) + ' < ' + [$4, $5, $6, $7].map(x => (x >>> 0).toString(16)).join(' < ')); },
           yo == r1 ? 1 : 2, que, f, ctx->lr, cadena[0], cadena[1], cadena[2], cadena[3], Memory::Read32(yo + 8), Memory::Read32(yo + 12));
}
#define ENGANCHE(dir, nombre) \
    extern "C" void func_##dir##_traducida(CpuContext* ctx); \
    extern "C" void func_##dir(CpuContext* ctx) { anota(nombre, ctx); func_##dir##_traducida(ctx); }
ENGANCHE(80555578, "Next")
ENGANCHE(805555CC, "NextLimited")
ENGANCHE(80555628, "NextFloat")
ENGANCHE(805556A8, "NextFloatLimited")

// Las funciones con una copia "en línea" de Random::next (el traductor las encuentra por la constante del
// multiplicador; lista en compilar-web.py): cada una se envuelve y, si cambia el estado de azar1 o azar2 durante
// su llamada, se anota cuál fue (la más interna anota primero).
extern "C" void mkw_vigila_azar(const char* dir, CpuContext* ctx, void (*f)(CpuContext*)) {
    const uint32_t ri = Memory::Read32(0x809BD730);
    const bool ok = ri >= 0x80000000u && ri < 0x81800000u;
    uint32_t r1 = 0, r2 = 0, a1 = 0, b1 = 0, a2 = 0, b2 = 0, lr = ctx->lr;
    if (ok) { r1 = Memory::Read32(ri + 4); r2 = Memory::Read32(ri + 8);
        if (Memory::Contains(r1, 16)) { a1 = Memory::Read32(r1 + 8); b1 = Memory::Read32(r1 + 12); }
        if (Memory::Contains(r2, 16)) { a2 = Memory::Read32(r2 + 8); b2 = Memory::Read32(r2 + 12); } }
    f(ctx);
    if (!ok) return;
    const uint32_t fr = Memory::Read32(ri + 0x20);
    static int desde = -1, hasta = -1;
    if (desde < 0) {
        desde = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec((typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[1] : 380; });
        hasta = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec((typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[2] : 600; });
    }
    if (static_cast<int>(fr) < desde || static_cast<int>(fr) > hasta) return;
    for (int n = 1; n <= 2; n++) {
        const uint32_t r = n == 1 ? r1 : r2;
        if (!Memory::Contains(r, 16)) continue;
        const uint32_t a = Memory::Read32(r + 8), b = Memory::Read32(r + 12);
        if (a != (n == 1 ? a1 : a2) || b != (n == 1 ? b1 : b2))
            EM_ASM({ console.log('[DEPURA] cambia azar' + $0 + ' en ' + UTF8ToString($1) + ' cuadro ' + $2 + ' estado ' + ($3 >>> 0).toString(16) + ':' + ($4 >>> 0).toString(16) + ' lr ' + ($5 >>> 0).toString(16)); },
                   n, dir, fr, a, b, lr);
    }
}

// Cada pedido de memoria (lockstep_nativo.cpp) mientras la carrera sincronizada se arma: hasta el cuadro 2 de Raceinfo.
extern "C" int g_mkwRelojFijo;
extern "C" void mkw_traza_alloc(uint32_t heap, uint32_t tam, uint32_t alin, uint32_t dir, uint32_t lr, int tipo) {
    if (!g_mkwRelojFijo) return;
    const uint32_t ri = Memory::Read32(0x809BD730);
    if (tipo == 9 || tipo == 8 || tipo == 7) {   // cuadro de pantalla (9) / CalcWorld (8): con el cuadro del juego, en el tramo de ?depura
        if (!(ri >= 0x80000000u && ri < 0x81800000u)) return;
        const int f = static_cast<int>(Memory::Read32(ri + 0x20));
        const int d = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec((typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[1] : 380; });
        const int h = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec((typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[2] : 600; });
        if (f >= d && f <= h) EM_ASM({ Error.stackTraceLimit = 60; const pila = $1 == 8 ? (new Error().stack || '').split(String.fromCharCode(10)).map(l => (l.match(/mkw\.wasm\.([A-Za-z_0-9:]+)/) || [])[1]).filter(Boolean).slice(4, 40).join(' < ') : ''; console.log('[DEPURA] ' + ($1 == 9 ? 'pantalla' : $1 == 8 ? 'calcworld' : 'dibujo') + ' cuadro ' + $0 + ' ' + pila); }, f, tipo);
        return;
    }
    if (ri >= 0x80000000u && ri < 0x81800000u && Memory::Read32(ri + 0x20) > 2) return;
    uint32_t sp = 0, cadena[3] = {0, 0, 0};
    (void)sp;
    EM_ASM({ console.log('[DEPURA] alloc' + $5 + ' heap ' + ($0 >>> 0).toString(16) + ' tam ' + ($1 >>> 0).toString(16) + ' alin ' + ($2 | 0) + ' -> ' + ($3 >>> 0).toString(16) + ' lr ' + ($4 >>> 0).toString(16)); },
           heap, tam, alin, dir, lr, tipo);
    (void)cadena;
}

// El "delegado" de las acciones de la IA (0x807351DC: llama a la función miembro guardada en this+8 sobre el objeto
// this+4): qué acción, sobre qué objeto y en qué cuadro.
extern "C" void func_807351DC_traducida(CpuContext* ctx);
extern "C" void func_807351DC(CpuContext* ctx) {
    const uint32_t yo = ctx->gpr[3], ri = Memory::Read32(0x809BD730);
    if (ri >= 0x80000000u && ri < 0x81800000u && Memory::Contains(yo, 20)) {
        const int f = static_cast<int>(Memory::Read32(ri + 0x20));
        static int desde = -1, hasta = -1;
        if (desde < 0) {
            desde = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec((typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[1] : 380; });
            hasta = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec((typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[2] : 600; });
        }
        if (f >= desde && f <= hasta)
            EM_ASM({ console.log('[DEPURA] accion cuadro ' + $0 + ' obj ' + ($1 >>> 0).toString(16) + ' ptmf ' + [$2, $3, $4].map(x => (x >>> 0).toString(16)).join(' ') + ' lr ' + ($5 >>> 0).toString(16)); },
                   f, Memory::Read32(yo + 4), Memory::Read32(yo + 8), Memory::Read32(yo + 12), Memory::Read32(yo + 16), ctx->lr);
    }
    func_807351DC_traducida(ctx);
}

// AI::Player::Update (0x80732678): por cada CPU y cuadro, una huella de su objeto (0x400 bytes) y de lo que apunta
// (0x100 bytes de cada puntero), sin contar los punteros (cambian con el lugar de la memoria). ?depura=a-b; con
// window.mkwDepuraVolcar = cuadro se escriben además las palabras del objeto en ese cuadro.
static bool esPuntero(uint32_t v) { return (v >= 0x80000000u && v < 0x81800000u) || (v >= 0x90000000u && v < 0x94000000u); }
static uint32_t huella(uint32_t base, uint32_t tam) {
    uint32_t h = 2166136261u;
    for (uint32_t o = 0; o < tam; o += 4) { uint32_t v = Memory::Read32(base + o); if (esPuntero(v)) v = 0xBEEF; h = (h ^ v) * 16777619u; }
    return h;
}
extern "C" void func_80732678_traducida(CpuContext* ctx);
extern "C" void func_80732678(CpuContext* ctx) {
    const uint32_t yo = ctx->gpr[3], ri = Memory::Read32(0x809BD730);
    if (ri >= 0x80000000u && ri < 0x81800000u && Memory::Contains(yo, 0x400)) {
        const int f = static_cast<int>(Memory::Read32(ri + 0x20));
        static int desde = -1, hasta = -1, volcar = -1;
        if (desde < 0) {
            desde = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec((typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[1] : 380; });
            hasta = EM_ASM_INT({ const m = /([0-9]+)-([0-9]+)/.exec((typeof window !== 'undefined' && window.mkwDepura) || ''); return m ? +m[2] : 600; });
            volcar = EM_ASM_INT({ return (typeof window !== 'undefined' && window.mkwDepuraVolcar) || -1; });
        }
#ifdef MKW_VIGIA
        {   // window.mkwVigiaIA = [cuadro, índice, desplazamiento, tamaño]: vigilar esa parte de la IA número índice
            static int vc = -2, vi = 0, vo = 0, vt = 0, orden = 0, ultimo = -1;
            if (vc == -2) { vc = EM_ASM_INT({ const v = typeof window !== 'undefined' && window.mkwVigiaIA; return v ? v[0] : -1; });
                vi = EM_ASM_INT({ return window.mkwVigiaIA ? window.mkwVigiaIA[1] : 0; }); vo = EM_ASM_INT({ return window.mkwVigiaIA ? window.mkwVigiaIA[2] : 0; });
                vt = EM_ASM_INT({ return window.mkwVigiaIA ? window.mkwVigiaIA[3] : 0; }); }
            if (f != ultimo) { ultimo = f; orden = 0; } else orden++;
            if (f == vc && orden == vi) mkw_vigia_poner(yo + vo, vt);
        }
#endif
        if (f >= desde && f <= hasta) {
            uint32_t hijos = 0;
            for (uint32_t o = 0; o < 0x400; o += 4) { const uint32_t v = Memory::Read32(yo + o); if (esPuntero(v) && Memory::Contains(v, 0x100)) hijos = hijos * 31u + huella(v, 0x100); }
            EM_ASM({ console.log('[DEPURA] ia cuadro ' + $0 + ' obj ' + ($1 >>> 0).toString(16) + ' h ' + ($2 >>> 0).toString(16) + ' hijos ' + ($3 >>> 0).toString(16)); },
                   f, yo, huella(yo, 0x400), hijos);
            if (f == volcar) {
                for (uint32_t o = 0; o < 0x400; o += 4) {
                    const uint32_t v = Memory::Read32(yo + o);
                    EM_ASM({ console.log('[DEPURA] volcado ' + ($0 >>> 0).toString(16) + ' +' + $1.toString(16) + ' ' + ($2 >>> 0).toString(16)); }, yo, o, esPuntero(v) ? 0xBEEFu : v);
                    if (esPuntero(v) && Memory::Contains(v, 0x100))
                        for (uint32_t k = 0; k < 0x100; k += 4) { const uint32_t w = Memory::Read32(v + k);
                            EM_ASM({ console.log('[DEPURA] volcado ' + ($0 >>> 0).toString(16) + ' +' + $1.toString(16) + '>' + $2.toString(16) + ' ' + ($3 >>> 0).toString(16)); }, yo, o, k, esPuntero(w) ? 0xBEEFu : w); }
                }
            }
        }
    }
    func_80732678_traducida(ctx);
}

#ifdef MKW_VIGIA
// El punto de vigilancia (memory_access.h): la página lo pone con Module._mkw_vigia_poner(desde, tam); cada escritura
// ahí se anota con el cuadro y la pila de llamadas de wasm (los nombres func_XXXXXXXX dicen qué función del juego fue).
extern "C" { uint32_t g_mkwVigiaDesde = 0, g_mkwVigiaTam = 0; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_vigia_poner(uint32_t desde, uint32_t tam) { g_mkwVigiaDesde = desde; g_mkwVigiaTam = tam; }
extern "C" void mkw_vigia_toque(uint32_t address, uint32_t size) {
    const uint32_t ri = Memory::Read32(0x809BD730);
    const int f = (ri >= 0x80000000u && ri < 0x81800000u) ? static_cast<int>(Memory::Read32(ri + 0x20)) : -1;
    EM_ASM({ const pila = (new Error().stack || '').split('\n').map(l => (l.match(/(func_[0-9A-Fa-f]+|rr_overlay_[0-9A-Fa-f]+)/) || [])[1]).filter(Boolean).slice(0, 8).join(' < ');
             console.log('[DEPURA] vigia cuadro ' + $0 + ' dir ' + ($1 >>> 0).toString(16) + ' tam ' + $2 + ' pila ' + pila); }, f, address, size);
}
#endif

// EGG::ScnRootEx::CalcWorld (0x8023C920): cuándo se calculan las matrices del gráfico de escena (en qué cuadro del juego)
extern "C" void func_8023C920_traducida(CpuContext* ctx);
extern "C" void func_8023C920(CpuContext* ctx) { mkw_traza_alloc(0, 0, 0, 0, 0, 8); func_8023C920_traducida(ctx); }
// GameScene::draw (0x8051BC78): en qué cuadros del juego se dibuja
extern "C" void func_8051BC78_traducida(CpuContext* ctx);
extern "C" void func_8051BC78(CpuContext* ctx) { mkw_traza_alloc(0, 0, 0, 0, 0, 7); func_8051BC78_traducida(ctx); }
