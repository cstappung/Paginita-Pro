// THPVideoDecode nativo: reemplaza la función del juego que decodifica un cuadro de video THP (0x801B3BAC).
//
// Resumen: en la pantalla de elegir copa y pista corre detrás un video THP de 672×736 a 60 cuadros por segundo. La
// función traducida del juego (la de la Wii, pasada a C++) tardaba ~25 ms por cuadro en wasm: la Wii lo hacía con
// trucos de su procesador (la caché bloqueada, las "paired singles" con cuantización) que en wasm salen caros.
// Aquí el mismo trabajo lo hace thp_decodificador.cpp, escrito desde el formato público, en ~1 ms.
//
// Cómo se engancha sin volver a traducir el juego: compilar-web.py compila SOLO el shard donde vive la función
// traducida con -Dfunc_801B3BAC=func_801B3BAC_traducida (le cambia el nombre); este archivo define func_801B3BAC con
// el nombre original, así que todas las llamadas del juego (directas y por tabla) llegan aquí. La traducida sigue
// existiendo y se usa para lo raro (punteros nulos, un JPEG que no es como los THP) y para comparar.
//
// La función de la Wii: THPVideoDecode(archivo, texturaY, texturaU, texturaV, trabajo) → 0 si salió bien.
// En los registros: r3..r7 = los cinco argumentos; la respuesta va en r3.
//
// Modos (variable MKW_THP; la página la pone con ?thp=…):
//   (nada)      el nativo
//   traducido   el traducido, como antes (para medir la diferencia)
//   comparar    los dos en cada cuadro; se queda el del traducido y anota en la consola cuánto difieren y tardan
#include "ppc_runtime.h"
#include "memory_access.h"
#include "gx_guest_write.h"

#include "thp_decodificador.h"

#include <emscripten/emscripten.h>

#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

extern "C" void func_801B3BAC_traducida(CpuContext* ctx);   // la del juego, con el nombre cambiado

namespace {

enum Modo { kNativo = 0, kTraducido = 1, kComparar = 2 };

// El decodificador del juego CORTA los decimales al pasar a byte (no redondea): medido con ?thp=comparar, con
// redondeo 0.5 el nativo daba en promedio +0.49 más (bitácora §47). Con 0 se parece más al original.
constexpr float kRedondeo = 0.0f;

int modo() {
    static int m = -1;
    if (m < 0) {
        const char* e = std::getenv("MKW_THP");
        m = (e && !std::strcmp(e, "traducido")) ? kTraducido : (e && !std::strcmp(e, "comparar")) ? kComparar : kNativo;
        std::printf("[thp] decodificador de video: %s\n", m == kNativo ? "nativo" : m == kTraducido ? "traducido" : "comparar");
    }
    return m;
}

// Copia n bytes de la memoria de la Wii a la del programa. Página por página (1 MiB): si la página es memoria común
// se copia de una vez; si es especial (un "registro" de hardware, una copia de la GPU pendiente) se lee byte a byte
// por el camino normal del runtime, que sabe tratarla; si no existe, ceros.
void leerGuest(uint32_t addr, uint8_t* dst, size_t n) {
    using namespace MemoryInline;
    while (n) {
        const size_t k = std::min<size_t>(n, kPageSize - (addr & kPageMask));
        const uint32_t pagina = addr >> kPageShift;
        if (const uintptr_t bias = g_fullReadablePageBias[pagina]) {
            std::memcpy(dst, reinterpret_cast<const uint8_t*>((bias - 1u) + addr), k);
        } else if (g_pageTable[pagina].base) {
            for (size_t i = 0; i < k; ++i)
                dst[i] = (addr & kPageMask) + i < g_pageTable[pagina].limit ? Memory::Read8(addr + uint32_t(i)) : 0;
        } else {
            std::memset(dst, 0, k);
        }
        if (addr > UINT32_MAX - k) break;   // fin del espacio de 32 bits
        addr += uint32_t(k); dst += k; n -= k;
    }
}

// Copia n bytes del programa a la memoria de la Wii, de a 4 KiB (el tamaño de las "páginas" que el runtime vigila
// por si alguien escribe sobre código). Cada pedazo se comprueba con la misma regla que usan las escrituras del
// juego traducido (TryGetWritablePointerFast); si no se puede de una vez, va byte a byte por el camino normal.
// Al final avisa a las cachés de texturas de aurora que esa memoria cambió (si no, podrían mostrar el cuadro viejo).
void escribirGuest(uint32_t addr, const uint8_t* src, size_t n) {
    using namespace MemoryInline;
    const uint32_t inicio = addr;
    const size_t total = n;
    while (n) {
        const size_t k = std::min<size_t>(n, kWritableSubPageSize - (addr & (kWritableSubPageSize - 1u)));
        uint8_t* p0 = nullptr;
        uint8_t* p1 = nullptr;
        if (TryGetWritablePointerFast(addr, 1, p0) && TryGetWritablePointerFast(addr + uint32_t(k - 1), 1, p1) &&
            p1 == p0 + (k - 1)) {
            std::memcpy(p0, src, k);
        } else {
            for (size_t i = 0; i < k; ++i) Memory::Write8(addr + uint32_t(i), src[i]);
        }
        if (addr > UINT32_MAX - k) break;
        addr += uint32_t(k); src += k; n -= k;
    }
    GxGuestWrite::NotifyWrite(inicio, uint32_t(total));
}

// Estadísticas que se anotan en la consola cada 300 cuadros (~5 s)
struct Estadisticas {
    int cuadros = 0;
    double msNativo = 0, msTraducido = 0, msNativoMax = 0;
    uint64_t pixeles = 0, iguales = 0;
    int64_t sumaDif = 0;
    int difMax = 0;
    uint64_t histo[3][4] = {};   // por plano (Y, U, V): |dif| = 1, 2, 3..7, 8 o más
    int ejemplos = 0;
    void anotar(int ancho, int alto) {
        if (++cuadros < 300) return;
        if (modo() == kComparar) {
            std::printf("[thp] comparar %d×%d: %d cuadros; nativo %.2f ms, traducido %.2f ms por cuadro; idénticos %.3f %%, "
                        "diferencia máxima %d, promedio (nativo − traducido) %+.4f\n",
                        ancho, alto, cuadros, msNativo / cuadros, msTraducido / cuadros, 100.0 * iguales / pixeles, difMax,
                        double(sumaDif) / pixeles);
            for (int p = 0; p < 3; ++p)
                std::printf("[thp]   %c: |dif| 1: %llu, 2: %llu, 3-7: %llu, 8+: %llu\n", "YUV"[p],
                            (unsigned long long)histo[p][0], (unsigned long long)histo[p][1],
                            (unsigned long long)histo[p][2], (unsigned long long)histo[p][3]);
        } else {
            std::printf("[thp] nativo %d×%d: %d cuadros, %.2f ms por cuadro (máx %.2f)\n", ancho, alto, cuadros,
                        msNativo / cuadros, msNativoMax);
        }
        *this = Estadisticas{};
    }
};

}  // namespace

extern "C" void func_801B3BAC(CpuContext* ctx) {
    const int m = modo();
    if (m == kTraducido) { func_801B3BAC_traducida(ctx); return; }
    const uint32_t archivo = ctx->gpr[3], texY = ctx->gpr[4], texU = ctx->gpr[5], texV = ctx->gpr[6];
    if (!archivo || !texY || !texU || !texV || !ctx->gpr[7]) { func_801B3BAC_traducida(ctx); return; }   // errores: los da la del juego

    static std::vector<uint8_t> entrada, y, u, v;
    static thp::Cuadro cuadro;
    static Estadisticas est;
    static int avisos = 0;
    const double t0 = emscripten_get_now();
    // El tamaño del cuadro comprimido no llega como argumento (se termina cuando se decodificaron todos los
    // bloques): se copian 128 KB y, si no alcanzan, 4 veces más.
    thp::Resultado r = thp::Resultado::FaltaEntrada;
    for (size_t tam = 128 * 1024; r == thp::Resultado::FaltaEntrada && tam <= 8u * 1024 * 1024; tam *= 4) {
        entrada.assign(tam + 8, 0);                    // + 8 bytes de margen: el lector de bits lee de a 8
        leerGuest(archivo, entrada.data(), tam);
        r = thp::leerCabecera(entrada.data(), tam, cuadro);
        if (r != thp::Resultado::Bien) continue;
        const size_t n = size_t(cuadro.ancho) * cuadro.alto;
        y.resize(n); u.resize(n / 4); v.resize(n / 4);
        r = thp::decodificar(entrada.data(), tam, cuadro, y.data(), u.data(), v.data(), kRedondeo);
    }
    if (r != thp::Resultado::Bien) {
        if (avisos++ < 5) std::printf("[thp] cuadro que el nativo no hace (código %d): uso el traducido\n", int(r));
        func_801B3BAC_traducida(ctx);
        return;
    }
    const double t1 = emscripten_get_now();
    const size_t nY = size_t(cuadro.ancho) * cuadro.alto;
    if (m == kComparar) {
        // El traducido escribe sus texturas (son las que se ven); después se leen y se comparan con las nativas
        func_801B3BAC_traducida(ctx);
        const double t2 = emscripten_get_now();
        static std::vector<uint8_t> otro;
        const struct { uint32_t addr; const std::vector<uint8_t>* nativo; size_t n; } planos[3] = {
            {texY, &y, nY}, {texU, &u, nY / 4}, {texV, &v, nY / 4}};
        for (int pl = 0; pl < 3; ++pl) {
            const auto& p = planos[pl];
            otro.resize(p.n);
            leerGuest(p.addr, otro.data(), p.n);
            for (size_t i = 0; i < p.n; ++i) {
                const int d = int((*p.nativo)[i]) - int(otro[i]), a = std::abs(d);
                est.iguales += d == 0;
                est.sumaDif += d;
                est.difMax = std::max(est.difMax, a);
                if (a) est.histo[pl][a == 1 ? 0 : a == 2 ? 1 : a < 8 ? 2 : 3]++;
                if (a >= 8 && est.ejemplos < 6) {   // dónde (baldosa de 8×4 → píxel) y los dos valores
                    ++est.ejemplos;
                    const int porFila = (pl ? cuadro.ancho / 2 : cuadro.ancho) / 8, b = int(i / 32), r = int(i % 32);
                    std::printf("[thp]   %c x=%d y=%d: nativo %d, traducido %d\n", "YUV"[pl], (b % porFila) * 8 + r % 8,
                                (b / porFila) * 4 + r / 8, (*p.nativo)[i], otro[i]);
                }
            }
            est.pixeles += p.n;
        }
        est.msTraducido += t2 - t1;
    } else {
        escribirGuest(texY, y.data(), nY);
        escribirGuest(texU, u.data(), nY / 4);
        escribirGuest(texV, v.data(), nY / 4);
        ctx->gpr[3] = 0;                                // THP_OK
    }
    const double ms = (m == kComparar ? t1 : emscripten_get_now()) - t0;
    est.msNativo += ms;
    est.msNativoMax = std::max(est.msNativoMax, ms);
    est.anotar(cuadro.ancho, cuadro.alto);
}
