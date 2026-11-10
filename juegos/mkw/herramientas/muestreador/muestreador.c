// Muestreador de CPU para un programa de Windows (N13 del plan de rendimiento, bitácora §160).
//
// Resumen: lanza el programa que se le pasa y, cada ~25 µs, mira el hilo suyo que más CPU gasta (el del juego):
// lo congela un instante (SuspendThread), lee en qué instrucción iba (el registro RIP), lo suelta y anota cuántos ciclos
// de CPU gastó ese hilo desde la mirada anterior. Al final, cada función recibe los ciclos de las muestras que cayeron
// dentro de ella (con el mapa de símbolos del enlazador, /MAP). Es lo que hace un osciloscopio con disparo periódico:
// no ve todo, pero con miles de muestras la proporción es fiel.
// Sin permisos de administrador (el muestreador del sistema, WPR, los pide).
//
// Uso:  muestreador.exe <salida.bin> <programa.exe> [argumentos…]
//       (el programa hereda la carpeta actual, las variables de entorno y la consola de salida; una línea «fin» por la
//       entrada del muestreador termina el programa y cierra la medida: el juego nativo no sale solo, §153)
// Cada cuánto: MUESTREO_US microsegundos (25); el muestreador gira en un núcleo propio entre mirada y mirada.
// Salida: registros {u32 hilo, u32 ms desde el arranque, u64 ciclos, u32 n, u64 direcciones[n]} (la pila: la primera
//         es donde iba; las demás, quién la llamó) y, cada 5 s, un archivo <salida.bin>.modulos con «base tamaño nombre» por línea.
// Compilar: clang -O2 muestreador.c -o muestreador.exe -lpsapi -lwinmm -ldbghelp   (lo hace herramientas/perfil-impuesto.mjs)
#define WIN32_LEAN_AND_MEAN
#define _CRT_SECURE_NO_WARNINGS
#include <windows.h>
#include <tlhelp32.h>
#include <psapi.h>
#include <mmsystem.h>
#include <dbghelp.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

#define MAX_HILOS 256
#define PROFUNDIDAD 24

typedef struct { DWORD id; HANDLE h; ULONG64 ciclos, vistos; unsigned quietas; } Hilo;   // un hilo del programa y sus ciclos de la mirada anterior
static Hilo hilos[MAX_HILOS];
static int nhilos = 0, principal = 0;
static volatile LONG terminar = 0;
// ntdll está en la misma dirección en todos los procesos (hasta reiniciar Windows): con la pila de las muestras que
// caen ahí se separa el reloj de la espera del ritmo (QueryPerformanceCounter) de un trabajo de verdad del sistema
static uint64_t ntdllBase = 0, ntdllFin = 0;
static int enNtdll(uint64_t pc) { return pc >= ntdllBase && pc < ntdllFin; }                              // llegó «fin» por la entrada

static DWORD WINAPI leer_entrada(LPVOID x) {
  char l[64];
  while (fgets(l, sizeof l, stdin)) if (!strncmp(l, "fin", 3)) { InterlockedExchange(&terminar, 1); break; }
  return 0;
}

// agrega los hilos nuevos del proceso (la foto de Toolhelp es cara: se toma cada 200 ms)
static void refrescar_hilos(DWORD pid) {
  HANDLE foto = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);
  if (foto == INVALID_HANDLE_VALUE) return;
  THREADENTRY32 te; te.dwSize = sizeof te;
  for (BOOL ok = Thread32First(foto, &te); ok; ok = Thread32Next(foto, &te)) {
    if (te.th32OwnerProcessID != pid) continue;
    int ya = 0;
    for (int i = 0; i < nhilos; i++) if (hilos[i].id == te.th32ThreadID) { ya = 1; break; }
    if (ya || nhilos >= MAX_HILOS) continue;
    HANDLE h = OpenThread(THREAD_SUSPEND_RESUME | THREAD_GET_CONTEXT | THREAD_QUERY_INFORMATION, FALSE, te.th32ThreadID);
    if (!h) continue;
    hilos[nhilos].id = te.th32ThreadID; hilos[nhilos].h = h; hilos[nhilos].ciclos = 0; hilos[nhilos].quietas = 0; hilos[nhilos].vistos = 0;
    QueryThreadCycleTime(h, &hilos[nhilos].ciclos);
    nhilos++;
  }
  CloseHandle(foto);
}

// escribe los módulos cargados (el .exe y las DLL) con su dirección base y tamaño
static void escribir_modulos(HANDLE proc, const char *ruta) {
  HMODULE mods[1024]; DWORD necesita = 0;
  if (!EnumProcessModulesEx(proc, mods, sizeof mods, &necesita, LIST_MODULES_ALL)) return;
  FILE *f = fopen(ruta, "w");
  if (!f) return;
  for (DWORD i = 0; i < necesita / sizeof(HMODULE); i++) {
    MODULEINFO mi; char nombre[MAX_PATH];
    if (!GetModuleInformation(proc, mods[i], &mi, sizeof mi)) continue;
    if (!GetModuleBaseNameA(proc, mods[i], nombre, sizeof nombre)) strcpy(nombre, "?");
    fprintf(f, "%llx %lx %s\n", (unsigned long long)(uintptr_t)mi.lpBaseOfDll, (unsigned long)mi.SizeOfImage, nombre);
  }
  fclose(f);
}

int main(int argc, char **argv) {
  if (argc < 3) { fprintf(stderr, "uso: muestreador salida.bin programa.exe [args]\n"); return 2; }
  // la línea de órdenes del programa: cada argumento entre comillas
  char linea[32768] = {0};
  for (int i = 2; i < argc; i++) { strcat(linea, "\""); strcat(linea, argv[i]); strcat(linea, "\" "); }
  STARTUPINFOA si; PROCESS_INFORMATION pi;
  memset(&si, 0, sizeof si); si.cb = sizeof si;
  // el programa no hereda la entrada (es del muestreador: por ahí llega «fin»), sí la salida y los errores
  SECURITY_ATTRIBUTES sa = { sizeof sa, NULL, TRUE };
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdInput = CreateFileA("NUL", GENERIC_READ, FILE_SHARE_READ, &sa, OPEN_EXISTING, 0, NULL);
  si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE); si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
  if (!CreateProcessA(NULL, linea, NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi)) {
    fprintf(stderr, "muestreador: no se pudo lanzar %s (%lu)\n", argv[2], GetLastError()); return 3;
  }
  FILE *sal = fopen(argv[1], "wb");
  char rutaMods[MAX_PATH]; snprintf(rutaMods, sizeof rutaMods, "%s.modulos", argv[1]);
  timeBeginPeriod(1);
  const char *iu = getenv("MUESTREO_US");
  long long intervaloUs = iu ? atoll(iu) : 25;
  // MUESTREO_PILA=1: también la pila (StackWalk64). Cuesta ~decenas de µs por mirada con el hilo congelado y en §160
  // cambiaba el reparto de una corrida a otra: por omisión solo la dirección donde iba
  const char *ip = getenv("MUESTREO_PILA");
  int conPila = ip && atoi(ip);
  { MODULEINFO mi; HMODULE nt = GetModuleHandleA("ntdll.dll");
    if (nt && GetModuleInformation(GetCurrentProcess(), nt, &mi, sizeof mi)) { ntdllBase = (uint64_t)(uintptr_t)mi.lpBaseOfDll; ntdllFin = ntdllBase + mi.SizeOfImage; } }
  // la frecuencia del contador de ciclos: QueryThreadCycleTime cuenta ciclos del reloj de referencia (TSC);
  // se mide cuántos hay por milisegundo comparando __rdtsc con el contador de alta resolución
  LARGE_INTEGER f0, q0, q1; QueryPerformanceFrequency(&f0); QueryPerformanceCounter(&q0);
  unsigned long long t0 = __rdtsc();
  DWORD inicio = GetTickCount(), ultimoRefresco = 0, ultimoMods = 0;
  unsigned long long muestras = 0;
  refrescar_hilos(pi.dwProcessId);
  int simbolosListos = 0;
  CreateThread(NULL, 0, leer_entrada, NULL, 0, NULL);
  while (WaitForSingleObject(pi.hProcess, 0) == WAIT_TIMEOUT) {
    if (terminar) { escribir_modulos(pi.hProcess, rutaMods); TerminateProcess(pi.hProcess, 0); break; }
    DWORD ahora = GetTickCount() - inicio;
    if (ahora - ultimoRefresco >= 200) {
      refrescar_hilos(pi.dwProcessId); ultimoRefresco = ahora;
      // solo se mira el hilo que más CPU gastó en los últimos 200 ms (el del juego): congelar los ~10 hilos en cada
      // mirada hacía que se mirara una vez cada ~600 µs y los ciclos del trabajo caían sobre la espera (§160)
      ULONG64 mejor = 0;
      for (int k = 0; k < nhilos; k++) {
        ULONG64 c = 0; QueryThreadCycleTime(hilos[k].h, &c);
        if (c - hilos[k].vistos >= mejor) { mejor = c - hilos[k].vistos; principal = k; }
        hilos[k].vistos = c;
      }
    }
    if (ahora - ultimoMods >= 5000) { escribir_modulos(pi.hProcess, rutaMods); ultimoMods = ahora; }
    // las tablas de desenrollar de los módulos ya cargados (una vez, cuando el programa ya cargó sus DLL; las que
    // carga después se piden al vuelo por SymGetModuleBase64)
    if (!simbolosListos && ahora > 300) { SymSetOptions(SYMOPT_DEFERRED_LOADS); SymInitialize(pi.hProcess, NULL, TRUE); simbolosListos = 1; }
    if (!simbolosListos) { Sleep(1); continue; }
    for (int i = principal; i >= 0 && i <= principal && i < nhilos; i++) {
      // primero se lo congela y DESPUÉS se leen sus ciclos: el contador de un hilo que está corriendo no se actualiza en
      // vivo (llega a saltos, en los cambios de contexto); con el hilo congelado es exacto. Leerlo antes repartía los
      // ciclos sobre muestras al azar (§160: el nativo daba 0,12–0,38 ms en corridas iguales)
      if (SuspendThread(hilos[i].h) == (DWORD)-1) continue;
      ULONG64 c = 0;
      if (!QueryThreadCycleTime(hilos[i].h, &c)) { ResumeThread(hilos[i].h); continue; }
      ULONG64 d = c - hilos[i].ciclos;
      hilos[i].ciclos = c;
      // no corrió desde la última mirada: se lo suelta (cada ~40 miradas se anota dónde está parado, con 0 ciclos)
      if (d < 2000 && (++hilos[i].quietas % 40)) { ResumeThread(hilos[i].h); continue; }
      CONTEXT ctx; ctx.ContextFlags = CONTEXT_FULL;
      if (GetThreadContext(hilos[i].h, &ctx)) {
        // la pila: dónde iba y quién la llamó (hasta PROFUNDIDAD direcciones), con las tablas de desenrollar del .exe y
        // de las DLL (dbghelp). Así se sabe, por ejemplo, si una muestra en ntdll es una espera del ritmo o trabajo.
        uint64_t pcs[PROFUNDIDAD]; uint32_t n = 0;
        STACKFRAME64 fr; memset(&fr, 0, sizeof fr);
        fr.AddrPC.Offset = ctx.Rip; fr.AddrPC.Mode = AddrModeFlat;
        fr.AddrFrame.Offset = ctx.Rbp; fr.AddrFrame.Mode = AddrModeFlat;
        fr.AddrStack.Offset = ctx.Rsp; fr.AddrStack.Mode = AddrModeFlat;
        // (con el hilo parado la pila sale siempre: no le cuesta nada a un hilo que no corre, y dice dónde se bloquea)
        while ((conPila || d < 2000) && n < PROFUNDIDAD && StackWalk64(IMAGE_FILE_MACHINE_AMD64, pi.hProcess, hilos[i].h, &fr, &ctx, NULL,
                                              SymFunctionTableAccess64, SymGetModuleBase64, NULL)) {
          if (!fr.AddrPC.Offset) break;
          pcs[n++] = fr.AddrPC.Offset;
        }
        if (!n) pcs[n++] = ctx.Rip;
        struct { uint32_t hilo, ms; uint64_t ciclos; uint32_t n; } r = { hilos[i].id, ahora, d < 2000 ? 0 : d, n };
        fwrite(&r, sizeof r, 1, sal);
        fwrite(pcs, sizeof(uint64_t), n, sal);
        muestras++;
      }
      ResumeThread(hilos[i].h);
    }
    // la próxima mirada: girando (sin dormir) hasta que pasen MUESTREO_US microsegundos (25 por omisión). El hilo del
    // juego trabaja ~1 ms por cuadro y duerme el resto: a 1 kHz casi siempre se lo vería dormido (§160)
    LARGE_INTEGER a, b; QueryPerformanceCounter(&a);
    do { YieldProcessor(); QueryPerformanceCounter(&b); } while ((b.QuadPart - a.QuadPart) * 1000000 / f0.QuadPart < intervaloUs);
  }
  QueryPerformanceCounter(&q1);
  unsigned long long t1 = __rdtsc();
  double ms = (double)(q1.QuadPart - q0.QuadPart) * 1000.0 / (double)f0.QuadPart;
  fclose(sal);
  DWORD codigo = 0; GetExitCodeProcess(pi.hProcess, &codigo);
  fprintf(stderr, "[muestreador] %llu muestras en %.0f ms; ciclos por ms %.0f\n", muestras, ms, (double)(t1 - t0) / ms);
  char rutaInfo[MAX_PATH]; snprintf(rutaInfo, sizeof rutaInfo, "%s.info", argv[1]);
  FILE *fi = fopen(rutaInfo, "w");
  if (fi) { fprintf(fi, "{\"muestras\":%llu,\"ms\":%.1f,\"ciclosPorMs\":%.1f}\n", muestras, ms, (double)(t1 - t0) / ms); fclose(fi); }
  timeEndPeriod(1);
  return (int)codigo;
}
