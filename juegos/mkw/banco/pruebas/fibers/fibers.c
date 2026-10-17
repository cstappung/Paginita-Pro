/* Prueba de concepto: "hilos" cooperativos del juego (fibers) sobre JSPI, sin Asyncify.
 *
 * Resumen: el juego de la Wii tiene varios hilos (OSThread) que se turnan: uno corre hasta que se bloquea y le pasa
 * el turno a otro. En el escritorio WiiCompiled lo hace con fibers de Windows o libco (cambiar de pila). En wasm no
 * se puede cambiar de pila a mano, y los fibers de Emscripten 6.0.12 solo existen con Asyncify (que reescribiría
 * las ~33 000 funciones del juego: más grande y más lento).
 *
 * La idea: cada fiber es una llamada a wasm distinta, "promising" (JSPI le da su propia pila de wasm). Para pasar el
 * turno, el fiber actual llama a fiber_cambia(otro): una función JS "suspending" que despierta al otro y devuelve una
 * promesa que se cumple cuando le vuelva a tocar. Además cada fiber tiene su propia pila de C (en la memoria lineal):
 * al cambiar se guarda y restaura el puntero de pila, igual que hace finishContextSwitch de Emscripten.
 *
 * Qué verifica (la página lo muestra): 1) que tres fibers se turnan en el orden pedido; 2) que las variables locales
 * y la pila de C de cada uno sobreviven a los cambios (recursión con arreglos locales en medio de cambios);
 * 3) que un fiber puede además esperar algo asíncrono (como una lectura de disco o la GPU) con JSPI;
 * 4) cuánto cuesta un cambio de fiber (cambios por segundo).
 */
#include <emscripten.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_FIBERS 16
#define PILA_C (256 * 1024)                 /* pila de C de cada fiber: 256 KB (el juego usará más) */

typedef void (*Entrada)(int arg);            /* lo que corre un fiber: una función con un argumento */
typedef struct {
    Entrada entrada;                         /* la función del fiber */
    int arg;                                 /* su argumento */
    uint8_t *pila;                           /* su pila de C (malloc) */
} Fiber;
static Fiber gFibers[MAX_FIBERS];            /* fiber 0 = main (usa la pila normal de Emscripten) */
static int gNum = 1;                         /* cuántos fibers hay (el 0 ya existe) */

/* ---------- la parte JS: guardar/restaurar la pila de C y suspender/despertar con promesas ---------- */

/* Se llama una vez: prepara el estado del planificador del lado JS. */
EM_JS(void, fiber_js_init, (void), {
    Module.fibers = [{ sp: 0, base: 0, limite: 0, despierta: null, empezado: true }];   /* el 0 es main */
    Module.fiberActual = 0;
    Module.cambios = 0;
});

/* Registra un fiber nuevo con los límites de su pila de C (crece hacia abajo: empieza en base+tamaño). */
EM_JS(void, fiber_js_nuevo, (int id, uintptr_t base, uintptr_t tamano), {
    Module.fibers[id] = { sp: base + tamano, base: base + tamano, limite: base, despierta: null, empezado: false };
});

/* El cambio de turno. "EM_ASYNC_JS" = una función JS que el C puede esperar: con JSPI, el fiber que la llama queda
 * suspendido (su pila de wasm guardada por el navegador) hasta que la promesa se cumple. */
EM_ASYNC_JS(void, fiber_cambia_js, (int a), {
    const yo = Module.fiberActual, F = Module.fibers;
    F[yo].sp = stackSave();                              /* 1. guardar dónde iba MI pila de C */
    Module.cambios++;
    const miTurno = new Promise(r => F[yo].despierta = r);   /* 2. la promesa que me despertará */
    queueMicrotask(() => {                               /* 3. cuando yo ya esté suspendido… */
        Module.fiberActual = a;
        const f = F[a];
        _emscripten_stack_set_limits(f.base, f.limite);  /*    …poner la pila de C del otro… */
        stackRestore(f.sp);
        if (!f.empezado) {                               /*    …y arrancarlo (primera vez) o despertarlo */
            f.empezado = true;
            Module._fiber_trampolin(a);                  /*    (export "promising": pila de wasm nueva) */
        } else {
            const d = f.despierta; f.despierta = null; d();
        }
    });
    await miTurno;                                       /* 4. dormir hasta que me devuelvan el turno */
    const f = F[yo];                                     /* 5. me despertaron: recuperar MI pila de C */
    _emscripten_stack_set_limits(f.base, f.limite);
    stackRestore(f.sp);
});

/* Una espera asíncrona dentro de un fiber (como leer un archivo del disco o esperar a la GPU). */
EM_ASYNC_JS(int, espera_algo_js, (int ms), {
    const yo = Module.fiberActual, sp = stackSave();
    await new Promise(r => setTimeout(r, ms));
    stackRestore(sp);                                    /* (por si otro tocó la pila de C mientras) */
    return yo;                                           /* devuelve quién estaba corriendo al esperar */
});

/* ---------- la parte C: lo que usaría el runtime (host_context.cpp) ---------- */

int fiber_crea(Entrada entrada, int arg) {
    int id = gNum++;
    gFibers[id].entrada = entrada;
    gFibers[id].arg = arg;
    gFibers[id].pila = (uint8_t *)malloc(PILA_C);       /* su pila de C propia */
    fiber_js_nuevo(id, (uintptr_t)gFibers[id].pila, PILA_C);
    return id;
}
void fiber_cambia(int a) { fiber_cambia_js(a); }

/* Donde arranca cada fiber nuevo. Exportada como "promising" (JSPI_EXPORTS) para que tenga su propia pila de wasm. */
EMSCRIPTEN_KEEPALIVE void fiber_trampolin(int id) {
    gFibers[id].entrada(gFibers[id].arg);
    /* un fiber del juego nunca termina (OSThread vuelve al planificador); aquí, si termina, devuelve el turno a main */
    for (;;) fiber_cambia(0);
}

/* ---------- las pruebas ---------- */

static char gOrden[256];                     /* en qué orden corrieron (se compara con el esperado) */
static int gLargo = 0;
static void anota(char c) { if (gLargo < 255) gOrden[gLargo++] = c; gOrden[gLargo] = 0; }

static int gA, gB, gC;                       /* ids de los tres fibers de prueba */

/* recursión que usa la pila de C (arreglos locales) y cambia de fiber en el medio: si las pilas se mezclaran,
 * la suma saldría mal */
static int recursivo(int n, int quien) {
    volatile int locales[64];                /* 256 bytes en la pila de C por nivel */
    for (int i = 0; i < 64; i++) locales[i] = n * 1000 + i + quien;
    if (n == 8) fiber_cambia(quien == 1 ? gB : quien == 2 ? gC : gA);  /* cambiar en lo más hondo: A→B→C→A */
    int suma = n > 0 ? recursivo(n - 1, quien) : 0;
    for (int i = 0; i < 64; i++) suma += locales[i] - (n * 1000 + i + quien);   /* debe sumar 0 extra */
    return suma + n;
}

static int gRes[4];                          /* resultado de la recursión de cada fiber */
static int gQuienEspero = -1;

static void fiberA(int arg) {                /* A: anota, pasa a B, vuelve, recursión, termina en main */
    anota('A'); fiber_cambia(gB);
    anota('a'); gRes[1] = recursivo(16, 1);
    anota('1');
}
static void fiberB(int arg) {
    anota('B'); fiber_cambia(gC);
    anota('b'); gRes[2] = recursivo(16, 2);
    anota('2'); fiber_cambia(gA);
}
static void fiberC(int arg) {
    anota('C');
    gQuienEspero = espera_algo_js(30);       /* esperar algo asíncrono en medio (como un archivo del disco) */
    anota('c'); fiber_cambia(gA);
    anota('3'); gRes[3] = recursivo(16, 3);
    fiber_cambia(gB);
}

static volatile int gContador = 0;
static int gPingPong;
static void fiberPing(int vueltas) {         /* para medir: ping-pong con main */
    for (;;) { gContador++; fiber_cambia(0); }
}

/* La página lee estos resultados */
EMSCRIPTEN_KEEPALIVE const char *orden(void) { return gOrden; }
EMSCRIPTEN_KEEPALIVE int resultado(int i) { return gRes[i]; }
EMSCRIPTEN_KEEPALIVE int quien_espero(void) { return gQuienEspero; }

EMSCRIPTEN_KEEPALIVE double mide_cambios(int vueltas) {
    double t0 = emscripten_get_now();
    for (int i = 0; i < vueltas; i++) fiber_cambia(gPingPong);   /* cada vuelta = 2 cambios (ida y vuelta) */
    return emscripten_get_now() - t0;
}

int main(void) {
    fiber_js_init();
    gA = fiber_crea(fiberA, 0);
    gB = fiber_crea(fiberB, 0);
    gC = fiber_crea(fiberC, 0);
    /* Orden esperado: M A B C c a b 3 1 m 2 n o
     *  M→A→B→C, C espera 30 ms y vuelve a A; A, B y C entran a su recursión y en lo más hondo se pasan el turno
     *  (A→B→C→A); A termina y vuelve a main ('m'); main despierta a B, que termina ('2', 'n'), y a C ('o'). */
    anota('M');
    fiber_cambia(gA);
    anota('m');
    fiber_cambia(gB);
    anota('n');
    fiber_cambia(gC);
    anota('o');
    gPingPong = fiber_crea(fiberPing, 0);
    printf("fibers: orden %s\n", gOrden);
    return 0;
}
