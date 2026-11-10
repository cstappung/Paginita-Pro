// W2 de la etapa 0 del plan v4 (bitácora §199): la colisión con la pista (KCL) como «isla».
//
// Resumen. La consulta de choques contra el mapa de la pista (KCLController::IsCollidingImpl, 0x807C0884) se cambia
// por una isla: la misma cuenta, pero con sus datos en el orden de bytes del PC (una «sombra» de la KCL hecha una vez
// por pista), el controlador y la pila de la Wii en variables locales, y sin guardar ni reponer registros en la memoria
// de la Wii. El cuerpo lo genera herramientas/islas/generar-kcl.py en terceros/islas/ (código derivado del de
// Nintendo: nunca a git); este archivo es lo nuestro: la sombra, el borde (cómo se lee y escribe), el comprobador y los
// relojes. Es como cambiar un tramo de cable con muchos empalmes por uno entero: la corriente que llega es la misma,
// pero se pierde menos en el camino.
// Modos (MKW_ISLA en Node, ?isla=N en la página con Module._mkw_isla_modo):
//   0 = la traducida (como siempre, pasa por aquí y nada más)
//   1 = la isla (si la isla no puede, la traducida)
//   2 = el comprobador: en cada llamada corre la isla «en seco» (sin escribir en la memoria de la Wii), después la
//       traducida de verdad, y compara lo que sale por el borde (r3, el cursor de la lista, la distancia, la normal y
//       el atributo); mide cuánto tardó cada una
// Solo en un programa aparte: MKW_ISLA_COMPILAR=1 python herramientas/compilar-web.py … (y antes generar-kcl.py).
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"
#include "guest_abi/guest_abi.h"

#include <emscripten/emscripten.h>

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

namespace {
int g_modo = -1;

// la sombra de una KCL: de los vértices (+0x0 del controlador) al árbol (+0xC), palabra por palabra en el orden del PC
struct Sombra { uint32_t vertices = 0, arbol = 0; std::vector<uint32_t> w; };
Sombra g_sombras[8];
int g_proxima = 0;
uint32_t g_raceinfo = 0xFFFFFFFFu;   // si cambia (otra carrera), las sombras se tiran

struct Cuenta {
    double llamadas = 0, isla = 0, traducida = 0, distintas = 0, distintasVolatiles = 0, panicos = 0, sinSombra = 0,
           sombras = 0, msIsla = 0, msTraducida = 0, comparadas = 0;
} g_c;

const Sombra* sombraDe(uint32_t vertices, uint32_t normales, uint32_t prismas, uint32_t arbol) {
    uint32_t ri = 0;
    if (Memory::TryRead32(0x809BD730u, ri) && ri != g_raceinfo) {
        g_raceinfo = ri;
        for (auto& s : g_sombras) s = Sombra{};
    }
    for (auto& s : g_sombras) if (s.vertices == vertices && s.arbol == arbol && !s.w.empty()) return &s;
    // el orden de siempre de una KCL: vértices < normales < prismas < árbol, todo junto y de menos de 16 MB
    if (!(vertices < normales && normales < prismas + 0x10 && prismas + 0x10 < arbol && arbol - vertices < (16u << 20)
          && (vertices & 3) == 0 && (arbol & 3) == 0)) return nullptr;
    // de a una palabra con Read32 (que ya da vuelta los bytes): en wasm la memoria de la Wii va en páginas de 1 MiB
    // (§182) y un bloque de varios MB no es continuo en el PC (un GetPointer de todo el bloque falla)
    std::vector<uint32_t> w((arbol - vertices) / 4);
    for (size_t i = 0; i < w.size(); i++)
        if (!Memory::TryRead32(vertices + 4 * static_cast<uint32_t>(i), w[i])) return nullptr;
    Sombra& s = g_sombras[g_proxima++ % 8];
    s.vertices = vertices; s.arbol = arbol;
    s.w = std::move(w);
    g_c.sombras++;
    return &s;
}
}  // namespace

// El borde de la isla: cómo lee y escribe. Las direcciones de la Wii llegan igual que en la traducida; cada una se
// busca primero en la pila local, después en el controlador copiado, después en la sombra de la KCL y, si no está en
// ninguna, en la memoria de la Wii.
struct IslaKcl {
    bool seco = false, panico = false;
    uint32_t pila0 = 0, ctl0 = 0;
    uint32_t pila[56] = {}; uint64_t pilaVale = 0;          // 224 bytes de pila; un bit por palabra escrita o leída
    uint32_t ctl[27] = {}; uint32_t ctlVale = 0; bool cursorEscrito = false;   // los primeros 0x6C bytes
    const uint32_t* som = nullptr; uint32_t somLo = 0, somN = 0;
    // en seco: lo que la isla habría escrito
    struct Escritura { uint32_t a, bits, tam; };
    Escritura escritas[8]; int nEscritas = 0;
    uint32_t r3 = 0, r4 = 0; double f1 = 0;

    void entrar(uint32_t r1, uint32_t r3_) { pila0 = r1; ctl0 = r3_; }
    uint32_t palabra(uint32_t a) {
        uint32_t d = a - pila0;
        if (d < 224) {
            const uint32_t i = d >> 2;
            if (!(pilaVale >> i & 1)) { pila[i] = Memory::Read32(a); pilaVale |= 1ull << i; }
            return pila[i];
        }
        d = a - ctl0;
        if (d < 0x6C) {
            const uint32_t i = d >> 2;
            if (!(ctlVale >> i & 1)) { ctl[i] = Memory::Read32(a); ctlVale |= 1u << i; }
            return ctl[i];
        }
        d = a - somLo;
        if (d < somN) return som[d >> 2];
        return MemoryInline::FlatRead32(a);
    }
    void poner(uint32_t a, uint32_t v) {   // solo la pila (lo demás que se escribe pasa por w32/wf/w16)
        const uint32_t i = (a - pila0) >> 2;
        if (i < 56) { pila[i] = v; pilaVale |= 1ull << i; return; }
        panico = true;   // (no debería pasar: la traducida solo guarda en su pila)
    }
    float lf(uint32_t a) { return PpcBitCastToFloatInline(palabra(a)); }
    uint32_t l32(uint32_t a) { return palabra(a); }
    uint32_t l16(uint32_t a) {
        const uint32_t d = a - somLo;
        if (d < somN) { const uint32_t w = som[d >> 2]; return (a & 2) ? (w & 0xFFFFu) : (w >> 16); }
        if (a - pila0 < 224 || a - ctl0 < 0x6C) { const uint32_t w = palabra(a & ~3u); return (a & 2) ? (w & 0xFFFFu) : (w >> 16); }
        return MemoryInline::FlatRead16(a);
    }
    double lp2(uint32_t a) {
        const uint64_t v = (static_cast<uint64_t>(palabra(a)) << 32) | palabra(a + 4);
        return PpcBitCastToDoubleInline(PpcLoadPairPsqFloatBitsPackedInline(v));
    }
    double lp1(uint32_t a) { return PpcMakePairedResultInline(PpcBitCastToFloatInline(palabra(a)), 1.0f).d; }
    void sp2(uint32_t a, double v) {
        const uint64_t w = PpcStorePairPsqFloatBitsPackedInline(PpcBitCastToU64Inline(v));
        poner(a, static_cast<uint32_t>(w >> 32)); poner(a + 4, static_cast<uint32_t>(w));
    }
    void sp1(uint32_t a, double v) {
        poner(a, PpcConvertToSingleFTZInline(PpcBitCastToU64Inline(static_cast<double>(PpcGetPs0Inline(v)))));
    }
    void sf(uint32_t a, double v) { poner(a, MemoryInline::ConvertPpcDoubleToSingleBits(v)); }
    void w32(uint32_t a, uint32_t v) {
        if (a == ctl0 + 0x68) { ctl[26] = v; ctlVale |= 1u << 26; cursorEscrito = true; return; }
        panico = true;
    }
    void wf(uint32_t a, double v) {
        if (seco) { if (nEscritas < 8) escritas[nEscritas++] = {a, MemoryInline::ConvertPpcDoubleToSingleBits(v), 4}; return; }
        MemoryInline::FlatWriteFloat32(a, v);
    }
    void w16(uint32_t a, uint32_t v) {
        if (seco) { if (nEscritas < 8) escritas[nEscritas++] = {a, v & 0xFFFFu, 2}; return; }
        MemoryInline::FlatWrite16(a, static_cast<uint16_t>(v));
    }
    void salir(CpuContext* ctx, uint32_t r3_, uint32_t r4_, PPC_FPR f1_) {
        r3 = r3_; r4 = r4_; f1 = f1_.d;
        if (seco) return;
        if (cursorEscrito) MemoryInline::FlatWrite32(ctl0 + 0x68, ctl[26]);
        ctx->gpr[3] = r3_; ctx->gpr[4] = r4_; ctx->fpr[1] = f1_;
    }
};

#include "../../terceros/islas/kcl_807C0884.inc"

namespace {
bool prepararIsla(CpuContext* ctx, IslaKcl& I) {
    if (ctx->gqr[0] != 0) return false;   // la isla supone pares de flotantes sin escala (lo de siempre)
    const uint32_t c = ctx->gpr[3];
    uint32_t v = 0, n = 0, p = 0, a = 0;
    if (!Memory::TryRead32(c, v) || !Memory::TryRead32(c + 4, n) || !Memory::TryRead32(c + 8, p) || !Memory::TryRead32(c + 12, a))
        return false;
    const Sombra* s = sombraDe(v, n, p, a);
    if (!s) { g_c.sinSombra++; return false; }
    I.som = s->w.data(); I.somLo = s->vertices; I.somN = s->arbol - s->vertices;
    return true;
}
uint32_t leer(uint32_t a, uint32_t tam) {
    if (!a) return 0;
    uint32_t v = 0;
    if (tam == 4) Memory::TryRead32(a, v); else v = Memory::Read16(a);   // (las salidas son variables del que llama)
    return v;
}
}  // namespace

extern "C" EMSCRIPTEN_KEEPALIVE void mkw_isla_modo(int m) { g_modo = m; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_isla_reiniciar() { g_c = Cuenta{}; }
// 0 llamadas, 1 por la isla, 2 por la traducida, 3 distintas (el borde), 4 distintas solo en r4/f1, 5 avisos de
// error, 6 sin sombra, 7 sombras armadas, 8 ms en la isla, 9 ms en la traducida (modo 2), 10 comparadas, 11 el modo
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_isla_dato(int i) {
    const double v[] = {g_c.llamadas, g_c.isla, g_c.traducida, g_c.distintas, g_c.distintasVolatiles, g_c.panicos,
                        g_c.sinSombra, g_c.sombras, g_c.msIsla, g_c.msTraducida, g_c.comparadas, static_cast<double>(g_modo)};
    return i >= 0 && i < 12 ? v[i] : -1;
}

extern "C" void func_807C0884_traducida(CpuContext* ctx);   // KCLController::IsCollidingImpl
extern "C" void func_807C0884(CpuContext* ctx) {
    if (g_modo < 0) { const char* e = std::getenv("MKW_ISLA"); g_modo = e ? std::atoi(e) : 0; }
    g_c.llamadas++;
    if (g_modo == 0) { g_c.traducida++; func_807C0884_traducida(ctx); return; }
    IslaKcl I;
    if (!prepararIsla(ctx, I)) { g_c.traducida++; func_807C0884_traducida(ctx); return; }
    if (g_modo == 1) {
        isla_807C0884(ctx, I);
        if (I.panico) { g_c.panicos++; g_c.traducida++; func_807C0884_traducida(ctx); return; }
        g_c.isla++;
        return;
    }
    // modo 2: el comprobador. Lo de antes en las salidas, la isla en seco, la traducida de verdad, y comparar
    const uint32_t c = ctx->gpr[3], r18 = ctx->gpr[4], r19 = ctx->gpr[5], r20 = ctx->gpr[6];
    const uint32_t antes[5] = {leer(r18, 4), leer(r19, 4), leer(r19 + 4, 4), leer(r19 + 8, 4), leer(r20, 2)};
    I.seco = true;
    const double t0 = emscripten_get_now();
    isla_807C0884(ctx, I);
    const double t1 = emscripten_get_now();
    func_807C0884_traducida(ctx);
    const double t2 = emscripten_get_now();
    g_c.traducida++;
    if (I.panico) { g_c.panicos++; return; }
    g_c.comparadas++; g_c.msIsla += t1 - t0; g_c.msTraducida += t2 - t1;
    // lo que la isla dice que quedó: lo de antes con sus escrituras encima
    uint32_t espera[5] = {antes[0], antes[1], antes[2], antes[3], antes[4]};
    const uint32_t dir[5] = {r18, r19, r19 + 4, r19 + 8, r20};
    for (int k = 0; k < I.nEscritas; k++) for (int j = 0; j < 5; j++) if (dir[j] && I.escritas[k].a == dir[j]) espera[j] = I.escritas[k].bits;
    bool igual = I.r3 == ctx->gpr[3] && leer(c + 0x68, 4) == (I.cursorEscrito ? I.ctl[26] : leer(c + 0x68, 4));
    for (int j = 0; j < 5; j++) if (dir[j] && leer(dir[j], j == 4 ? 2 : 4) != espera[j]) igual = false;
    if (!igual) {
        if (g_c.distintas < 5)
            std::printf("[isla] distinta en la llamada %.0f: r3 isla %u traducida %u; cursor isla %08x traducida %08x\n",
                        g_c.llamadas, I.r3, ctx->gpr[3], I.ctl[26], leer(c + 0x68, 4));
        g_c.distintas++;
    } else if (I.r4 != ctx->gpr[4] || PpcBitCastToU64Inline(I.f1) != PpcBitCastToU64Inline(ctx->fpr[1].d)) {
        g_c.distintasVolatiles++;
    }
    if (std::getenv("MKW_ISLA") && static_cast<uint64_t>(g_c.llamadas) % 200000 == 0)
        std::printf("[isla] %.0f llamadas, %.0f comparadas, %.0f distintas (%.0f solo en r4/f1), isla %.1f ns, traducida %.1f ns por llamada\n",
                    g_c.llamadas, g_c.comparadas, g_c.distintas, g_c.distintasVolatiles,
                    g_c.msIsla / g_c.comparadas * 1e6, g_c.msTraducida / g_c.comparadas * 1e6);
}
