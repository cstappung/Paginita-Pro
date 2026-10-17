/* Prueba de paridad: la matemática de punto flotante del runtime, compilada para x86 (la referencia: el build de PC
 * de WiiCompiled, que coincide con la Wii en los ghosts) y para wasm (nuestro parche: ppc_isa_wasm_neon.h). Las dos
 * deben dar EXACTAMENTE los mismos bits.
 *
 * Se usa el código real del runtime (ppc_isa_float.h / ppc_isa_quantized.h), no copias. Las entradas salen de un
 * generador reproducible con mucha proporción de casos raros (NaN con y sin carga, SNaN, infinitos, subnormales,
 * ceros con signo, extremos). Cada operación se resume en tres huellas (FNV-1a de los bits del resultado), según
 * cuántos operandos NaN tuvo el caso:
 *   - sinNaN: tiene que coincidir siempre.
 *   - unNaN:  tiene que coincidir (el runtime de ARM/wasm reescribe los NaN a la respuesta de x86).
 *   - variosNaN: informativo; ni x86 es determinista ahí (depende del orden de operandos que elija el compilador).
 * Salida: una línea por operación «op clase n huella». Con «volcar <op> <clase> <n>» imprime los primeros n casos
 * de esa clase para encontrar dónde difieren.
 */
#include "isa/ppc_isa_float.h"
#include "isa/ppc_isa_quantized.h"

#include <cinttypes>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

static uint64_t gEstado = 0x243F6A8885A308D3ull;
static inline uint64_t azar() { gEstado ^= gEstado << 13; gEstado ^= gEstado >> 7; gEstado ^= gEstado << 17; return gEstado; }

static const uint32_t kRarosF[] = {
    0x00000000u, 0x80000000u, 0x7F800000u, 0xFF800000u,          // ceros e infinitos
    0x7FC00000u, 0xFFC00000u, 0x7FC12345u, 0xFFE54321u,          // QNaN (con carga y signo)
    0x7F800001u, 0xFF812345u, 0x7FBFFFFFu,                       // SNaN
    0x00000001u, 0x807FFFFFu, 0x00400000u, 0x00800000u, 0x80800000u, // subnormales y FLT_MIN
    0x7F7FFFFFu, 0xFF7FFFFFu, 0x3F800000u, 0xBF800000u, 0x3F800001u, // FLT_MAX, ±1, 1+ulp
};
static const uint64_t kRarosD[] = {
    0x0000000000000000ull, 0x8000000000000000ull, 0x7FF0000000000000ull, 0xFFF0000000000000ull,
    0x7FF8000000000000ull, 0xFFF8000000000000ull, 0x7FF8123456789ABCull, 0x7FF0000000000001ull, 0xFFF4000000000000ull,
    0x0000000000000001ull, 0x800FFFFFFFFFFFFFull, 0x0010000000000000ull, 0x380FFFFFFFFFFFFFull, 0x3810000000000000ull,
    0x36A0000000000000ull, 0x47EFFFFFE0000000ull, 0x3FF0000000000000ull, 0xBFF0000000000000ull,
};

static float floatAzar()
{
    const uint64_t r = azar();
    uint32_t u;
    switch (r & 7) {
    case 0: case 1: u = kRarosF[(r >> 8) % (sizeof kRarosF / 4)]; break;
    case 2: u = static_cast<uint32_t>(r >> 16); break;                                        // bits al azar
    default: u = (static_cast<uint32_t>(r >> 20) & 0x807FFFFFu) | ((107u + (static_cast<uint32_t>(r >> 8) % 40u)) << 23); // normales
    }
    return PpcBitCastToFloatInline(u);
}
static double doubleAzar()
{
    const uint64_t r = azar();
    switch (r & 7) {
    case 0: return PpcBitCastToDoubleInline(kRarosD[(r >> 8) % (sizeof kRarosD / 8)]);
    case 1: return static_cast<double>(floatAzar());                                         // un single ensanchado
    case 2: return PpcBitCastToDoubleInline(azar());
    default: return PpcBitCastToDoubleInline((azar() & 0x800FFFFFFFFFFFFFull) | ((990ull + ((r >> 8) % 60u)) << 52));
    }
}
static inline bool esNaNf(float f) { return (PpcBitCastToU32Inline(f) & 0x7FFFFFFFu) > 0x7F800000u; }
static inline bool esNaNd(double d) { return (PpcBitCastToU64Inline(d) & 0x7FFFFFFFFFFFFFFFull) > 0x7FF0000000000000ull; }

struct Huella { uint64_t h = 0xCBF29CE484222325ull; long n = 0; };
static inline void mete(Huella &f, uint64_t v) { for (int i = 0; i < 8; i++) { f.h ^= (v >> (8 * i)) & 0xFF; f.h *= 0x100000001B3ull; } f.n++; }

enum Op { MUL, ADD, SUB, DIV, MADD, MSUB, NEG, FORCE_SINGLE, FORCE_SINGLE_NI, PSQ_LOAD, PSQ_STORE, FMADD, FNMSUB, FMADDS, FMULS, PS_MADD_LANE, RECIP, RSQRT, FMSUB, FNMADD, FMSUBS, PS_MSUB_LANE, NUM_OPS };
static const char *kNombre[] = { "ps_mul", "ps_add", "ps_sub", "ps_div", "ps_madd", "ps_msub", "ps_neg", "frsp", "frsp_NI",
    "psq_l", "psq_st", "fmadd", "fnmsub", "fmadds", "fmuls", "ps_madd_lane", "fres", "frsqrte", "fmsub", "fnmadd", "fmsubs", "ps_msub_lane" };

static const char *gVolcarOp = nullptr; static int gVolcarClase = -1; static long gVolcarN = 0;
static Huella gH[NUM_OPS][3];

static void anota(int op, int nanes, uint64_t resultado, const uint64_t *ent, int nEnt)
{
    const int clase = nanes == 0 ? 0 : nanes == 1 ? 1 : 2;
    Huella &h = gH[op][clase];
    if (gVolcarOp && !std::strcmp(gVolcarOp, kNombre[op]) && clase == gVolcarClase && h.n < gVolcarN) {
        std::printf("%ld", h.n);
        for (int i = 0; i < nEnt; i++) std::printf(" %016" PRIX64, ent[i]);
        std::printf(" -> %016" PRIX64 "\n", resultado);
    }
    mete(h, resultado);
}

static double par(float ps0, float ps1) { return PpcPackPairedInline(ps0, ps1); }
static int nanesPar(double d) { return esNaNf(PpcGetPs0Inline(d)) + esNaNf(PpcGetPs1Inline(d)); }
#define PAR(x) PpcPsToM128Inline(x)
#define DE_PAR(v) PpcBitCastToU64Inline(PpcM128ToPsInline(v))

int main(int argc, char **argv)
{
    long casos = argc > 1 ? std::atol(argv[1]) : 1000000;
    if (argc > 4 && !std::strcmp(argv[2], "volcar")) { gVolcarOp = argv[3]; gVolcarClase = std::atoi(argv[4]); gVolcarN = argc > 5 ? std::atol(argv[5]) : 10; }

    for (long i = 0; i < casos; i++) {
        // Pares (paired singles): cada lane por separado. Los NaN se cuentan por lane y se clasifica por el peor lane.
        const float a0 = floatAzar(), a1 = floatAzar(), b0 = floatAzar(), b1 = floatAzar(), c0 = floatAzar(), c1 = floatAzar();
        const double A = par(a0, a1), B = par(b0, b1), C = par(c0, c1);
        const uint64_t e3[3] = { PpcBitCastToU64Inline(A), PpcBitCastToU64Inline(B), PpcBitCastToU64Inline(C) };
        const int n2 = std::max(esNaNf(a0) + esNaNf(b0), esNaNf(a1) + esNaNf(b1));
        const int n3 = std::max(esNaNf(a0) + esNaNf(b0) + esNaNf(c0), esNaNf(a1) + esNaNf(b1) + esNaNf(c1));
        anota(MUL, n2, DE_PAR(PpcMulPairInline(PAR(A), PAR(B))), e3, 2);
        anota(ADD, n2, DE_PAR(PpcAddPairInline(PAR(A), PAR(B))), e3, 2);
        anota(SUB, n2, DE_PAR(PpcSubPairInline(PAR(A), PAR(B))), e3, 2);
        anota(DIV, n2, DE_PAR(PpcDivPairInline(PAR(A), PAR(B))), e3, 2);
        anota(MADD, n3, DE_PAR(PpcFmaddPairInline(PAR(A), PAR(B), PAR(C))), e3, 3);
        anota(MSUB, n3, DE_PAR(PpcFmsubPairInline(PAR(A), PAR(B), PAR(C))), e3, 3);
        anota(NEG, nanesPar(A) ? 1 : 0, DE_PAR(PpcNegateNonNanLanesInline(PAR(A))), e3, 1);
        anota(PS_MADD_LANE, esNaNf(a0) + esNaNf(b0) + esNaNf(c0),
              PpcBitCastToU32Inline(PpcAccuratePsMaddLaneNoNiInline<false>(a0, c0, b0)), e3, 3);
        anota(PS_MSUB_LANE, esNaNf(a0) + esNaNf(b0) + esNaNf(c0),
              PpcBitCastToU32Inline(PpcAccuratePsMaddLaneNoNiInline<true>(a0, c0, b0)), e3, 3);
        anota(PSQ_LOAD, 0, PpcLoadPairPsqFloatBitsPackedInline(e3[0]), e3, 1);
        anota(PSQ_STORE, 0, PpcStorePairPsqFloatBitsPackedInline(e3[0]), e3, 1);

        // Escalares en double (fmadd, frsp, fres…).
        const double x = doubleAzar(), y = doubleAzar(), z = doubleAzar();
        const uint64_t d3[3] = { PpcBitCastToU64Inline(x), PpcBitCastToU64Inline(y), PpcBitCastToU64Inline(z) };
        const int m1 = esNaNd(x), m2 = esNaNd(x) + esNaNd(y), m3 = m2 + esNaNd(z);
        anota(FORCE_SINGLE, m1, PpcBitCastToU32Inline(PpcForceSingleValueInline(x)), d3, 1);
        g_mkwNiFlushThreshold = kMkwNiFlushThreshold;
        anota(FORCE_SINGLE_NI, m1, PpcBitCastToU32Inline(PpcForceSingleValueInline(x)), d3, 1);
        g_mkwNiFlushThreshold = 0.0;
        anota(FMADD, m3, PpcBitCastToU64Inline(PpcFmaddInline(x, y, z)), d3, 3);
        anota(FNMSUB, m3, PpcBitCastToU64Inline(PpcFnmsubInline(x, y, z)), d3, 3);
        anota(FMSUB, m3, PpcBitCastToU64Inline(PpcFmsubInline(x, y, z)), d3, 3);
        anota(FNMADD, m3, PpcBitCastToU64Inline(PpcFnmaddInline(x, y, z)), d3, 3);
        anota(FMSUBS, m3, PpcBitCastToU64Inline(PpcFmsubsInline(x, y, z)), d3, 3);
        anota(FMADDS, m3, PpcBitCastToU64Inline(PpcFmaddsInline(x, y, z)), d3, 3);
        anota(FMULS, m2, PpcBitCastToU64Inline(PpcFmulsInline(x, y)), d3, 2);
        anota(RECIP, m1, PpcBitCastToU64Inline(PpcApproximateReciprocalInline(x)), d3, 1);
        anota(RSQRT, m1, PpcBitCastToU64Inline(PpcApproximateReciprocalSquareRootInline(x)), d3, 1);
    }
    if (gVolcarOp) return 0;
    static const char *kClase[] = { "sinNaN", "unNaN", "variosNaN" };
    for (int op = 0; op < NUM_OPS; op++)
        for (int c = 0; c < 3; c++)
            if (gH[op][c].n) std::printf("%s %s %ld %016" PRIX64 "\n", kNombre[op], kClase[c], gH[op][c].n, gH[op][c].h);
    return 0;
}
