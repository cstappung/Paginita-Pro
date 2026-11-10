// N14 del plan de rendimiento (paso 7, bitácora §181): funciones calientes del juego reescritas a mano, con un
// comprobador que exige el mismo resultado bit por bit.
//
// Resumen: el perfil de la carrera (§160/§165) dice qué funciones traducidas pesan más. Las más pesadas que son «hojas»
// (no llaman a nadie: se pueden correr dos veces sin efectos aparte de su memoria y sus registros) se reescriben aquí.
// La versión traducida queda como func_X_traducida (compilar-web.py la renombra, como con los demás *_nativo.cpp) y
// func_X elige según MKW_CALIENTE:
//   0 = la traducida (como siempre), 1 = la nuestra, 2 = COMPROBAR: corre las dos con la misma entrada (los registros y
//   la memoria del juego de ese momento, en la carrera de verdad) y compara la salida: todos los registros (CpuContext
//   entero) y la memoria que escribe; cada MKW_CALIENTE_COMPLETA llamadas (997 por omisión) compara la memoria ENTERA
//   de la Wii (MEM1, MEM2, el overlay de Kamek y la caché bloqueada) por su huella, así una escritura fuera de lo
//   previsto también se ve. El juego sigue siempre con lo que dio la traducida.
// MKW_CALIENTE_SOLO=80199D64,… = solo esas (las demás, la traducida). mkw_caliente_estado(i, k) da las cuentas.
//
// Qué se gana: las cuentas son las mismas (las mismas operaciones de pares del runtime, en el mismo orden: el orden de
// una multiplicación-suma cambia el redondeo), pero cada bloque de memoria se resuelve UNA vez (la tabla de páginas de
// 1 MiB) en lugar de una vez por número, y la GQR se mira una vez. Si un bloque no está entero en una página común
// (o la GQR no es la de números de coma flotante), se llama a la traducida: mismo resultado por definición.
//
// Es código propio escrito leyendo el traducido para entender qué hace cada función (la regla de «decompilar uno
// mismo»): no copia el código de Nintendo; vive en el .wasm privado como todo el juego.
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <xxhash.h>
#include <wasm_simd128.h>
#include <emscripten/emscripten.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

namespace {

// ---- la memoria de la Wii por bloques ----
// [addr, addr+len) dentro de una página de 1 MiB que se lee sin casos especiales: el puntero; si no, null.
// (Lo mismo que el camino rápido de Memory::Read32, pero una vez por bloque.)
inline const uint8_t* leible(uint32_t addr, uint32_t len) {
    if ((addr & MemoryInline::kPageMask) + len > MemoryInline::kPageSize) return nullptr;
    const uintptr_t b = MemoryInline::g_fullReadablePageBias[addr >> MemoryInline::kPageShift];
    return b ? reinterpret_cast<const uint8_t*>((b - 1u) + addr) : nullptr;
}
// Igual para escribir: la página entera sin código ejecutable ni E/S (el camino rápido de Memory::Write32).
inline uint8_t* escribible(uint32_t addr, uint32_t len) {
    if ((addr & MemoryInline::kPageMask) + len > MemoryInline::kPageSize) return nullptr;
    const uintptr_t b = MemoryInline::g_fullWritablePageBias[addr >> MemoryInline::kPageShift];
    return b ? reinterpret_cast<uint8_t*>((b - 1u) + addr) : nullptr;
}
inline double par(const uint8_t* p) { return PpcLoadPairPsqFloatFromHostInline(p); }   // psq_l de 2 floats
inline void ponPar(uint8_t* p, double v) { PpcStorePairPsqFloatToHostInline(p, v); }     // psq_st de 2 floats
inline double uno(const uint8_t* p) {                                                     // psq_l de 1 float (el 2.º = 1)
    uint32_t raw;
    std::memcpy(&raw, p, 4);
    return PpcMakePairedResultInline(PpcBitCastToFloatInline(__builtin_bswap32(raw)), 1.0f).d;
}
inline void ponUno(uint8_t* p, double v) {                                                // psq_st de 1 float
    const uint32_t bits = __builtin_bswap32(PpcConvertToSingleFTZInline(
        PpcBitCastToU64Inline(static_cast<double>(PpcGetPs0Inline(v)))));
    std::memcpy(p, &bits, 4);
}
inline void ponPalabra(uint8_t* p, uint32_t v) { v = __builtin_bswap32(v); std::memcpy(p, &v, 4); }
// La GQR0 de números de coma flotante sin escala (la que el juego deja siempre): carga y guardado.
inline bool gqrFlotante(const CpuContext* ctx) { return ctx->gqr[0] == 0; }

// ---- ps_madds0/1 con la FMA «punto medio», de a pares con SIMD (§181, MKW_CALIENTE_MADD=1) ----
// El runtime hace cada mitad del par con su FMA exacta de software (TwoSum + redondeo a impar). Aquí: las dos mitades a
// la vez en un registro SIMD de dos double, s = m·k + a (el producto de dos float cabe exacto en un double) y s bajado
// a float, que es el resultado correcto salvo que s caiga JUSTO en un punto medio entre dos float (los 29 bits de abajo
// = 1000…0) o fuera del rango normal de float (cero, subnormal, infinito, NaN). Esos casos, raros, van por la del
// runtime (banco fma: 0 diferencias en 70 M casos). El par vive en un double: los 32 bits de abajo = ps1, los de arriba
// = ps0 (como en ppc_isa_float.h).
bool g_maddRapida = false;
template <int L>                                  // L = 0: ps_madds0 (multiplica por ps0 de k); 1: ps_madds1
inline double madds(double m, double k, double a) {
    if (g_maddRapida) {
        const v128_t vm = wasm_f64x2_promote_low_f32x4(wasm_f64x2_splat(m));
        const v128_t va = wasm_f64x2_promote_low_f32x4(wasm_f64x2_splat(a));
        const float kk = wasm_f32x4_extract_lane(wasm_f64x2_splat(k), L == 0 ? 1 : 0);
        const v128_t s = wasm_f64x2_add(wasm_f64x2_mul(vm, wasm_f64x2_splat(static_cast<double>(kk))), va);
        const v128_t medio = wasm_i64x2_eq(wasm_v128_and(s, wasm_i64x2_splat(0x1FFFFFFF)), wasm_i64x2_splat(0x10000000));
        const v128_t e = wasm_v128_and(wasm_u64x2_shr(s, 52), wasm_i64x2_splat(0x7FF));
        const v128_t fuera = wasm_v128_or(wasm_i64x2_lt(e, wasm_i64x2_splat(1023 - 126)),
                                          wasm_i64x2_gt(e, wasm_i64x2_splat(1023 + 127)));
        if (!wasm_v128_any_true(wasm_v128_or(medio, fuera)))
            return wasm_f64x2_extract_lane(wasm_f32x4_demote_f64x2_zero(s), 0);
    }
    return L == 0 ? PPC_PsMadds0Inline(m, k, a) : PPC_PsMadds1Inline(m, k, a);
}

// ---- las funciones ----
struct Funcion {
    const char* nombre;
    uint32_t dir;
    void (*traducida)(CpuContext*);
    bool (*nueva)(CpuContext*);                 // false = no pudo (bloque raro): se llama a la traducida
    // lo que escribe en memoria, calculado de la entrada (la comprobación rápida de cada llamada)
    int (*escribe)(const CpuContext*, uint32_t* dir, uint32_t* len);
    int modo = -1;
    uint64_t llamadas = 0, comprobadas = 0, completas = 0, diferencias = 0, sinNueva = 0;
    uint64_t nsTraducida = 0, nsNueva = 0, medidas = 0;
};

}  // namespace

// PSMTXConcat (0x80199D64): AB = A·B, matrices 3×4 de float (12 números, filas de 4). r3 = A, r4 = B, r5 = AB.
// La cuarta columna de B se completa con (0, 1) de la constante del SDK en 0x80385A08 (así la traslación de A suma).
extern "C" void func_80199D64_traducida(CpuContext* ctx);
static bool concat_nueva(CpuContext* ctx) {
    if (!gqrFlotante(ctx)) return false;
    const uint32_t r1 = ctx->gpr[1], ra = ctx->gpr[3], rb = ctx->gpr[4], rab = ctx->gpr[5];
    constexpr uint32_t kUnoCero = 0x80385A08u;
    const uint8_t* A = leible(ra, 48);
    const uint8_t* B = leible(rb, 48);
    const uint8_t* K = leible(kUnoCero, 8);
    uint8_t* AB = escribible(rab, 48);
    uint8_t* pila = escribible(r1 - 64, 4);
    if (!A || !B || !K || !AB || !pila) return false;
    // el marco de pila se escribe antes de leer: si cayera encima de lo que se lee, la traducida
    const auto pisa = [&](uint32_t d, uint32_t l) { return (r1 - 64) - d < l || d - (r1 - 64) < 4; };
    if (pisa(ra, 48) || pisa(rb, 48) || pisa(kUnoCero, 8)) return false;
    // todo se lee antes de escribir (AB puede ser A o B)
    const double a00 = par(A), a01 = par(A + 8), a10 = par(A + 16), a11 = par(A + 24), a20 = par(A + 32), a21 = par(A + 40);
    const double b0 = par(B), b1 = par(B + 8), b2 = par(B + 16), b3 = par(B + 24), b4 = par(B + 32), b5 = par(B + 40);
    const double k = par(K);
    ponPalabra(pila, r1);                                     // el marco de pila que abre (stwu): queda en la memoria
    // fila 0 y fila 1, columnas 0-1 y 2-3 (cada una: B0·a + B1·a' + B2·a'' [+ (0,1)·tx])
    double s00 = PPC_PsMuls0Inline(b0, a00), s01 = PPC_PsMuls0Inline(b1, a00);
    double s10 = PPC_PsMuls0Inline(b0, a10), s11 = PPC_PsMuls0Inline(b1, a10);
    s00 = madds<1>(b2, a00, s00);
    s10 = madds<1>(b2, a10, s10);
    s01 = madds<1>(b3, a00, s01);
    s11 = madds<1>(b3, a10, s11);
    s00 = madds<0>(b4, a01, s00);
    s01 = madds<0>(b5, a01, s01);
    s10 = madds<0>(b4, a11, s10);
    s11 = madds<0>(b5, a11, s11);
    // fila 2
    double s20 = PPC_PsMuls0Inline(b0, a20);
    s01 = madds<1>(k, a01, s01);
    double s21 = PPC_PsMuls0Inline(b1, a20);
    s11 = madds<1>(k, a11, s11);
    s20 = madds<1>(b2, a20, s20);
    s21 = madds<1>(b3, a20, s21);
    s20 = madds<0>(b4, a21, s20);
    s21 = madds<0>(b5, a21, s21);
    s21 = madds<1>(k, a21, s21);
    ponPar(AB, s00); ponPar(AB + 16, s10); ponPar(AB + 8, s01); ponPar(AB + 24, s11); ponPar(AB + 32, s20); ponPar(AB + 40, s21);
    // los registros como los deja la función: f0..f13 con lo que quedó en cada uno; f14, f15 y f31 los repone; r6 la
    // dirección de la constante
    ctx->gpr[6] = kUnoCero;
    ctx->fpr[0].d = s21; ctx->fpr[1].d = a01; ctx->fpr[2].d = s20; ctx->fpr[3].d = a11; ctx->fpr[4].d = a20;
    ctx->fpr[5].d = a21; ctx->fpr[6].d = b0; ctx->fpr[7].d = b1; ctx->fpr[8].d = b2; ctx->fpr[9].d = b3;
    ctx->fpr[10].d = b4; ctx->fpr[11].d = b5; ctx->fpr[12].d = s00; ctx->fpr[13].d = s01;
    return true;
}
static int concat_escribe(const CpuContext* ctx, uint32_t* d, uint32_t* l) {
    d[0] = ctx->gpr[5]; l[0] = 48; d[1] = ctx->gpr[1] - 64; l[1] = 4;
    return 2;
}

// PSMTXMultVec (0x8019A91C): v' = M·v, M 3×4 (r3), v de 3 floats (r4), v' de 3 floats (r5), con la traslación.
extern "C" void func_8019A91C_traducida(CpuContext* ctx);
static bool multvec_nueva(CpuContext* ctx) {
    if (!gqrFlotante(ctx)) return false;
    const uint8_t* M = leible(ctx->gpr[3], 48);
    const uint8_t* V = leible(ctx->gpr[4], 12);
    uint8_t* R = escribible(ctx->gpr[5], 12);
    if (!M || !V || !R) return false;
    // la traducida lee la última fila de M después de escribir el primer número: si se pisan, la traducida
    if (ctx->gpr[5] - ctx->gpr[3] < 48 || ctx->gpr[3] - ctx->gpr[5] < 12) return false;
    const double f0 = par(V), f1 = uno(V + 8);                // (x, y) y (z, 1)
    const double m00 = par(M), m01 = par(M + 8), m10 = par(M + 16), m11 = par(M + 24), m20 = par(M + 32), m21 = par(M + 40);
    // cada fila: (m0·x, m1·y) + (m2·z, m3·1), y la suma de los dos lados queda en el primero
    double f4 = PPC_PsMulInline(m00, f0);
    double f5 = PPC_PsMaddInline(m01, f1, f4);
    const double f6 = PPC_PsSum0Inline(f5, f5, PPC_PsFromScalarInline(ctx->fpr[6].d));
    const double f10 = PPC_PsMulInline(m10, f0);
    const double f11 = PPC_PsMaddInline(m11, f1, f10);
    const double f12 = PPC_PsSum0Inline(f11, f11, PPC_PsFromScalarInline(ctx->fpr[12].d));
    f4 = PPC_PsMulInline(m20, f0);
    f5 = PPC_PsMaddInline(m21, f1, f4);
    const double f6b = PPC_PsSum0Inline(f5, f5, f6);
    ponUno(R, f6); ponUno(R + 4, f12); ponUno(R + 8, f6b);
    ctx->fpr[0].d = f0; ctx->fpr[1].d = f1; ctx->fpr[2].d = m20; ctx->fpr[3].d = m21; ctx->fpr[4].d = f4;
    ctx->fpr[5].d = f5; ctx->fpr[6].d = f6b; ctx->fpr[8].d = m10; ctx->fpr[9].d = m11; ctx->fpr[10].d = f10;
    ctx->fpr[11].d = f11; ctx->fpr[12].d = f12;
    return true;
}
static int multvec_escribe(const CpuContext* ctx, uint32_t* d, uint32_t* l) {
    d[0] = ctx->gpr[5]; l[0] = 12;
    return 1;
}

// 0x80085AB0: r3 = M·v con M de 3×3 (filas de 4 floats: los primeros 3 de cada una, desde r4) y v de 3 floats (r5),
// en números sueltos (fmuls y sumas redondeadas a float); deja el resultado también en su marco de pila (r1-32+8..16).
extern "C" void func_80085AB0_traducida(CpuContext* ctx);
static inline float leeF(const uint8_t* p) {
    uint32_t b;
    std::memcpy(&b, p, 4);
    b = __builtin_bswap32(b);
    float f;
    std::memcpy(&f, &b, 4);
    return f;
}
static inline void ponF(uint8_t* p, double v) { ponPalabra(p, MemoryInline::ConvertPpcDoubleToSingleBits(v)); }
static inline double sumaS(double a, double b) { return static_cast<double>(PpcForceSingleValueInline(a + b)); }
static bool mtx33vec_nueva(CpuContext* ctx) {
    const uint32_t r1 = ctx->gpr[1];
    const uint8_t* M = leible(ctx->gpr[4], 44);
    const uint8_t* V = leible(ctx->gpr[5], 12);
    uint8_t* R = escribible(ctx->gpr[3], 12);
    uint8_t* P = escribible(r1 - 32, 20);          // la palabra del marco (r1-32) y los 3 floats (r1-24..-12)
    if (!M || !V || !R || !P) return false;
    // el marco se escribe después de leer todo; pero r3 se escribe intercalado con el marco: si se pisan, la traducida
    if ((r1 - 32) - ctx->gpr[3] < 12 || ctx->gpr[3] - (r1 - 32) < 20) return false;
    const double x = leeF(V), y = leeF(V + 4), z = leeF(V + 8);
    const double m00 = leeF(M), m01 = leeF(M + 4), m02 = leeF(M + 8);
    const double m10 = leeF(M + 16), m11 = leeF(M + 20), m12 = leeF(M + 24);
    const double m20 = leeF(M + 32), m21 = leeF(M + 36), m22 = leeF(M + 40);
    // cada fila: (m0·x + m1·y) + m2·z, con el orden de la traducida
    const double f7 = PpcFmulsInline(m00, x), f4 = PpcFmulsInline(m10, x), f1 = PpcFmulsInline(m20, x);
    const double f6m = PpcFmulsInline(m01, y), f0m = PpcFmulsInline(m21, y), f3m = PpcFmulsInline(m11, y);
    const double f6 = sumaS(f7, f6m);
    const double f8 = PpcFmulsInline(m02, z);
    const double f3a = sumaS(f4, f3m);
    const double f5 = PpcFmulsInline(m12, z);
    const double rx = sumaS(f8, f6);
    const double f2 = PpcFmulsInline(m22, z);
    const double ry = sumaS(f5, f3a);
    const double f0a = sumaS(f1, f0m);
    const double rz = sumaS(f2, f0a);
    ponPalabra(P, r1);
    ponF(P + 8, rx); ponF(P + 12, ry); ponF(R, rx); ponF(P + 16, rz); ponF(R + 4, ry); ponF(R + 8, rz);
    ctx->fpr[0].d = rz; ctx->fpr[1].d = f1; ctx->fpr[2].d = f2; ctx->fpr[3].d = ry; ctx->fpr[4].d = rx;
    ctx->fpr[5].d = f5; ctx->fpr[6].d = f6; ctx->fpr[7].d = f7; ctx->fpr[8].d = f8; ctx->fpr[9].d = z;
    return true;
}
static int mtx33vec_escribe(const CpuContext* ctx, uint32_t* d, uint32_t* l) {
    d[0] = ctx->gpr[3]; l[0] = 12; d[1] = ctx->gpr[1] - 32; l[1] = 4; d[2] = ctx->gpr[1] - 24; l[2] = 12;
    return 3;
}

namespace {
Funcion g_funciones[] = {
    {"func_80199D64 (PSMTXConcat)", 0x80199D64u, func_80199D64_traducida, concat_nueva, concat_escribe},
    {"func_8019A91C (PSMTXMultVec)", 0x8019A91Cu, func_8019A91C_traducida, multvec_nueva, multvec_escribe},
    {"func_80085AB0 (matriz 3x3 por vector)", 0x80085AB0u, func_80085AB0_traducida, mtx33vec_nueva, mtx33vec_escribe},
};
constexpr int kFunciones = sizeof(g_funciones) / sizeof(g_funciones[0]);

void informe(Funcion& f);
int g_modoGeneral = -1;
uint64_t g_cadaCompleta = 997;
uint64_t g_maxCompletas = 400;

void leerModo() {
    if (g_modoGeneral >= 0) return;
    const char* m = std::getenv("MKW_CALIENTE");
#ifndef MKW_CALIENTE_DEF
#define MKW_CALIENTE_DEF 0   // E4c C3: MKW_CHICAS=c3 lo pone en 1 (la nueva por omisión)
#endif
    g_modoGeneral = m ? std::atoi(m) : MKW_CALIENTE_DEF;   // (por omisión, la traducida: se cambia al adoptar, §181)
    if (const char* c = std::getenv("MKW_CALIENTE_COMPLETA")) g_cadaCompleta = std::strtoull(c, nullptr, 10);
    if (const char* c = std::getenv("MKW_CALIENTE_MAXCOMPLETAS")) g_maxCompletas = std::strtoull(c, nullptr, 10);
    if (const char* c = std::getenv("MKW_CALIENTE_MADD")) g_maddRapida = std::atoi(c) != 0;
    const char* solo = std::getenv("MKW_CALIENTE_SOLO");
    for (auto& f : g_funciones) {
        f.modo = g_modoGeneral;
        if (solo && *solo) {
            char hex[16];
            std::snprintf(hex, sizeof hex, "%08X", f.dir);
            std::string s(solo);
            for (auto& ch : s) ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
            if (s.find(hex) == std::string::npos) f.modo = 0;
        }
    }
    if (g_modoGeneral != 0) std::atexit([] { for (auto& f : g_funciones) informe(f); });   // al salir (Node)
    std::printf("[caliente] modo %d (0 traducida, 1 nueva, 2 comprobar), madd %s; completa cada %llu, como mucho %llu\n",
                g_modoGeneral, g_maddRapida ? "punto medio (SIMD)" : "del runtime", static_cast<unsigned long long>(g_cadaCompleta),
                static_cast<unsigned long long>(g_maxCompletas));
}

// ---- la memoria entera de la Wii (para la comprobación completa) ----
struct Banco { uint8_t* host; size_t tam; };
std::vector<Banco>& bancos() {
    static std::vector<Banco> b;
    if (b.empty()) {
        const std::pair<uint32_t, size_t> regiones[] = {
            {Memory::kMem1CachedBase, Memory::kMem1Size}, {Memory::kMem2CachedBase, Memory::kMem2Size},
            {0x81800000u, 0x200000u}, {0xE0000000u, MemoryInline::kPageSize + 4096u}};
        for (auto [base, tam] : regiones) {
            try {
                if (uint8_t* p = Memory::GetPointer(base, tam)) b.push_back({p, tam});
            } catch (...) {
            }
        }
    }
    return b;
}
uint64_t huellaMemoria() {
    uint64_t h = 0;
    for (const auto& b : bancos()) h = XXH3_64bits_withSeed(b.host, b.tam, h);
    return h;
}
std::vector<uint8_t>& copiaMemoria() { static std::vector<uint8_t> c; return c; }
void guardarMemoria() {
    auto& c = copiaMemoria();
    size_t total = 0;
    for (const auto& b : bancos()) total += b.tam;
    c.resize(total);
    size_t o = 0;
    for (const auto& b : bancos()) { std::memcpy(c.data() + o, b.host, b.tam); o += b.tam; }
}
void reponerMemoria() {
    const auto& c = copiaMemoria();
    size_t o = 0;
    for (const auto& b : bancos()) { std::memcpy(b.host, c.data() + o, b.tam); o += b.tam; }
}

void contarDiferencia(Funcion& f, const CpuContext& t, const CpuContext& n, const char* que) {
    if (++f.diferencias <= 8) {
        std::printf("[caliente] DIFERENCIA en %s (%s), llamada %llu\n", f.nombre, que,
                    static_cast<unsigned long long>(f.llamadas));
        for (int i = 0; i < 32; ++i)
            if (std::memcmp(&t.fpr[i], &n.fpr[i], sizeof(PPC_FPR)) != 0)
                std::printf("  f%d: traducida %016llx nueva %016llx\n", i,
                            static_cast<unsigned long long>(PpcBitCastToU64Inline(t.fpr[i].d)),
                            static_cast<unsigned long long>(PpcBitCastToU64Inline(n.fpr[i].d)));
        for (int i = 0; i < 32; ++i)
            if (t.gpr[i] != n.gpr[i]) std::printf("  r%d: traducida %08x nueva %08x\n", i, t.gpr[i], n.gpr[i]);
    }
}

void informe(Funcion& f) {
    std::printf("[caliente] %s: llamadas %llu, comprobadas %llu (memoria entera %llu), diferencias %llu, sin nueva %llu",
                f.nombre, static_cast<unsigned long long>(f.llamadas), static_cast<unsigned long long>(f.comprobadas),
                static_cast<unsigned long long>(f.completas), static_cast<unsigned long long>(f.diferencias),
                static_cast<unsigned long long>(f.sinNueva));
    if (f.medidas)
        std::printf(", ns por llamada: traducida %.1f nueva %.1f (x%.2f)", double(f.nsTraducida) / f.medidas,
                    double(f.nsNueva) / f.medidas, f.nsNueva ? double(f.nsTraducida) / f.nsNueva : 0.0);
    std::printf("\n");
}

// COMPROBAR: la traducida y la nueva con la misma entrada; sigue con lo de la traducida
void comprobar(Funcion& f, CpuContext* ctx) {
    const CpuContext entrada = *ctx;
    uint32_t dir[4], len[4];
    const int n = f.escribe(&entrada, dir, len);
    uint8_t antes[4][64], trad[4][64];
    for (int i = 0; i < n; ++i) {
        const uint8_t* p = leible(dir[i], len[i]);
        if (!p || len[i] > 64) { f.traducida(ctx); return; }
        std::memcpy(antes[i], p, len[i]);
    }
    const bool completa = g_cadaCompleta && f.comprobadas % g_cadaCompleta == 0 && f.completas < g_maxCompletas;
    if (completa) guardarMemoria();
    // 1) la traducida
    f.traducida(ctx);
    const CpuContext salidaT = *ctx;
    for (int i = 0; i < n; ++i) std::memcpy(trad[i], leible(dir[i], len[i]), len[i]);
    const uint64_t huellaT = completa ? huellaMemoria() : 0;
    // 2) la nueva, desde la misma entrada
    const auto host = [&](int i) { return const_cast<uint8_t*>(leible(dir[i], len[i])); };
    const auto reponer = [&](uint8_t (*de)[64]) { for (int i = 0; i < n; ++i) std::memcpy(host(i), de[i], len[i]); };
    if (completa) reponerMemoria();
    else reponer(antes);
    CpuContext nuevo = entrada;
    if (!f.nueva(&nuevo)) {
        ++f.sinNueva;
        f.traducida(&nuevo);
    }
    bool igual = std::memcmp(&nuevo, &salidaT, sizeof(CpuContext)) == 0;
    if (!igual) contarDiferencia(f, salidaT, nuevo, "registros");
    for (int i = 0; i < n && igual; ++i)
        if (std::memcmp(trad[i], leible(dir[i], len[i]), len[i]) != 0) {
            igual = false;
            contarDiferencia(f, salidaT, nuevo, "memoria que escribe");
        }
    if (completa) {
        ++f.completas;
        if (igual && huellaMemoria() != huellaT) {
            igual = false;
            contarDiferencia(f, salidaT, nuevo, "memoria entera");
        }
    }
    // 3) cada tanto, cuánto tarda cada una: 32 veces cada una desde la misma entrada (lo escrito se repone antes de
    // cada vez, igual en las dos: A·B puede escribir encima de A)
    if (f.comprobadas % 64 == 0 && igual) {
        constexpr int kVeces = 32;
        CpuContext c;
        double t0 = emscripten_get_now();
        for (int k = 0; k < kVeces; ++k) { reponer(antes); c = entrada; f.traducida(&c); }
        double t1 = emscripten_get_now();
        for (int k = 0; k < kVeces; ++k) { reponer(antes); c = entrada; if (!f.nueva(&c)) f.traducida(&c); }
        double t2 = emscripten_get_now();
        f.nsTraducida += static_cast<uint64_t>((t1 - t0) * 1e6 / kVeces);
        f.nsNueva += static_cast<uint64_t>((t2 - t1) * 1e6 / kVeces);
        ++f.medidas;
    }
    // el juego sigue con lo de la traducida
    if (!igual && completa) {
        reponerMemoria();
        CpuContext otra = entrada;
        f.traducida(&otra);
    } else {
        reponer(trad);
    }
    *ctx = salidaT;
    if (++f.comprobadas % 200000 == 0) informe(f);
}

inline void llamar(Funcion& f, CpuContext* ctx) {
    if (f.modo < 0) leerModo();
    ++f.llamadas;
    switch (f.modo) {
        case 1:
            if (!f.nueva(ctx)) { ++f.sinNueva; f.traducida(ctx); }
            return;
        case 2:
            comprobar(f, ctx);
            return;
        default:
            f.traducida(ctx);
    }
}
}  // namespace

extern "C" void func_80199D64(CpuContext* MKW_RESTRICT ctx) { llamar(g_funciones[0], ctx); }
extern "C" void func_8019A91C(CpuContext* MKW_RESTRICT ctx) { llamar(g_funciones[1], ctx); }
extern "C" void func_80085AB0(CpuContext* MKW_RESTRICT ctx) { llamar(g_funciones[2], ctx); }

// La página o las pruebas: mkw_caliente_estado(i, k): i = función, k: 0 llamadas, 1 comprobadas, 2 completas,
// 3 diferencias, 4 sin nueva, 5 ns traducida, 6 ns nueva (promedios), 7 modo. mkw_caliente_informe() = al registro.
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_caliente_estado(int i, int k) {
    if (i < 0 || i >= kFunciones) return -1;
    const Funcion& f = g_funciones[i];
    switch (k) {
        case 0: return double(f.llamadas);
        case 1: return double(f.comprobadas);
        case 2: return double(f.completas);
        case 3: return double(f.diferencias);
        case 4: return double(f.sinNueva);
        case 5: return f.medidas ? double(f.nsTraducida) / f.medidas : 0;
        case 6: return f.medidas ? double(f.nsNueva) / f.medidas : 0;
        case 7: return f.modo;
        default: return 0;
    }
}
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_caliente_informe() {
    for (auto& f : g_funciones) informe(f);
}
