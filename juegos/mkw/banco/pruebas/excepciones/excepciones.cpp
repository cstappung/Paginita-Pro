/* Prueba de concepto: excepciones C++ (-fwasm-exceptions) cruzando los fibers sobre JSPI.
 *
 * Resumen: el runtime de WiiCompiled lanza una excepción C++ (Memory::AccessViolation) cuando el juego toca memoria
 * inválida; la excepción atraviesa funciones traducidas y la atrapa el fiber que la lanzó (fiber_manager.cpp) o
 * main. Con fibers sobre JSPI cada fiber es otra pila de wasm: hay que comprobar que una excepción solo la ve el
 * try/catch de SU fiber, aunque otro fiber esté suspendido dentro de un try, y aunque el lanzamiento ocurra
 * después de varios cambios de turno.
 *
 * Mismo mecanismo de fibers que banco/pruebas/fibers/fibers.c (ver ahí la explicación línea por línea).
 */
#include <emscripten.h>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <stdexcept>
#include <string>

/* ---- fibers sobre JSPI (copia mínima de fibers.c) ---- */
typedef void (*Entrada)(int);
struct Fiber { Entrada entrada; int arg; uint8_t *pila; };
static Fiber gF[8];
static int gNum = 1;
EM_JS(void, fx_init, (void), { Module.fibers = [{ sp: 0, base: 0, limite: 0, despierta: null, empezado: true }]; Module.fiberActual = 0; });
EM_JS(void, fx_nuevo, (int id, uintptr_t base, uintptr_t tam), { Module.fibers[id] = { sp: base + tam, base: base + tam, limite: base, despierta: null, empezado: false }; });
EM_ASYNC_JS(void, fx_cambia, (int a), {
    const yo = Module.fiberActual, F = Module.fibers;
    F[yo].sp = stackSave();
    const miTurno = new Promise(r => F[yo].despierta = r);
    queueMicrotask(() => {
        Module.fiberActual = a; const f = F[a];
        _emscripten_stack_set_limits(f.base, f.limite); stackRestore(f.sp);
        if (!f.empezado) { f.empezado = true; Module._fx_trampolin(a); } else { const d = f.despierta; f.despierta = null; d(); }
    });
    await miTurno;
    const f = F[yo]; _emscripten_stack_set_limits(f.base, f.limite); stackRestore(f.sp);
});
static int crea(Entrada e, int arg) { int id = gNum++; gF[id] = {e, arg, (uint8_t *)malloc(256 * 1024)}; fx_nuevo(id, (uintptr_t)gF[id].pila, 256 * 1024); return id; }

/* ---- la excepción del runtime (igual forma que Memory::AccessViolation) ---- */
struct AccessViolation : std::runtime_error {
    uint32_t direccion;
    explicit AccessViolation(uint32_t d) : std::runtime_error("acceso inválido"), direccion(d) {}
};

static std::string gRegistro;                /* qué atrapó quién, en orden */
static void anota(const std::string &s) { gRegistro += s; gRegistro += ' '; }
static int gA, gB;

/* una función "traducida" que lee memoria del invitado y, con una dirección mala, lanza (como memory.cpp) */
static int __attribute__((noinline)) lee_invitado(uint32_t dir, int profundidad) {
    volatile int local[16];
    for (int i = 0; i < 16; i++) local[i] = i;
    if (profundidad > 0) return lee_invitado(dir, profundidad - 1) + local[3];
    if (dir >= 0xCC000000u) throw AccessViolation(dir);   /* la ventana MMIO: inválida */
    return local[5];
}

extern "C" EMSCRIPTEN_KEEPALIVE void fx_trampolin(int id) {
    /* como fiber_manager.cpp: el fiber atrapa lo que se le escape a su hilo */
    try { gF[id].entrada(gF[id].arg); }
    catch (const AccessViolation &e) { char b[64]; snprintf(b, sizeof b, "trampolin%d:%08X", id, e.direccion); anota(b); }
    for (;;) fx_cambia(0);
}

static void fiberA(int) {
    try {
        anota("A1");
        fx_cambia(gB);                       /* A queda suspendido DENTRO de su try */
        anota("A2");
        lee_invitado(0x80001000u, 20);       /* dirección buena: no lanza */
        fx_cambia(gB);
        anota("A3");
        lee_invitado(0xCC008000u, 20);       /* mala: lanza desde 21 niveles de profundidad */
        anota("A-no-deberia");
    } catch (const AccessViolation &e) {
        char b[64]; snprintf(b, sizeof b, "A-atrapa:%08X", e.direccion); anota(b);
    }
}
static void fiberB(int) {
    anota("B1");
    try {
        lee_invitado(0xCC000004u, 10);       /* B lanza mientras A está suspendido en su try: lo atrapa B */
    } catch (const AccessViolation &e) {
        char b[64]; snprintf(b, sizeof b, "B-atrapa:%08X", e.direccion); anota(b);
    }
    fx_cambia(gA);
    anota("B2");
    lee_invitado(0xCD000000u, 5);            /* sin try en B: debe llegar al trampolín de B, no al try de A */
}

extern "C" EMSCRIPTEN_KEEPALIVE const char *registro(void) { return gRegistro.c_str(); }

int main() {
    fx_init();
    gA = crea(fiberA, 0);
    gB = crea(fiberB, 0);
    try {
        fx_cambia(gA);                       /* main también suspendido dentro de un try */
        anota("M1");                         /* volvió desde el trampolín de B (que atrapó la de B) */
        fx_cambia(gA);                       /* devolverle el turno a A: lanza la suya y la atrapa A */
        throw AccessViolation(0xDEAD0000u);  /* y al final main lanza y atrapa la suya */
    } catch (const AccessViolation &e) {
        char b[64]; snprintf(b, sizeof b, "M-atrapa:%08X", e.direccion); anota(b);
    }
    std::printf("registro: %s\n", gRegistro.c_str());
    return 0;
}
