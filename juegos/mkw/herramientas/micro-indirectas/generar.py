# Genera la prueba chica de las llamadas indirectas (N13, bitácora §166): ¿cuánto más cuesta en wasm que en el
# programa de Windows llamar a una función por su puntero, como hace el juego en cada «bctrl» (InvokeIndirectCpu)?
#
# Resumen: escribe build/micro-indirectas/indirectas.c con 20.000 funciones chicas de la misma forma que las traducidas (reciben un puntero
# al contexto, tocan un par de campos) y tres bucles:
#   1. «directa»: cada vuelta llama a UNA función conocida (sin poder meterla adentro: noinline) → lo que cuesta llamar;
#   2. «por puntero»: cada vuelta llama por un puntero tomado de una lista de destinos (2.000 distintos, en orden de
#      azar fijo) → llamar por la tabla (en wasm es call_indirect: revisa el índice y la firma);
#   3. «como el juego»: además busca el destino por su dirección en un memo de 512 entradas, como
#      FindRawByAddressPtr (hash de la dirección, compara, toma el registro y llama a su puntero).
# Cada bucle hace 20 millones de llamadas y dice ns por llamada. El mismo .c se compila con clang (Windows) y con emcc
# (wasm en Node): la diferencia por llamada × las llamadas por cuadro del juego (§152: ~9–11 mil) = el costo por cuadro.
# No usa nada del juego.
import random, pathlib
N, DISTINTAS = 20000, 2000
aqui = pathlib.Path(__file__).resolve().parents[2] / 'build/micro-indirectas'   # 2 MB generados: fuera de git
aqui.mkdir(parents=True, exist_ok=True)
r = random.Random(165)
l = ['// Generado por herramientas/micro-indirectas/generar.py: la prueba chica de las llamadas indirectas (§166).',
     '#include <stdint.h>', '#include <stdio.h>', '#include <time.h>',
     '#ifdef _WIN32', '#include <windows.h>',
     'static double ahora(void) { LARGE_INTEGER f, c; QueryPerformanceFrequency(&f); QueryPerformanceCounter(&c); return (double)c.QuadPart / f.QuadPart; }',
     '#else', 'static double ahora(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec + t.tv_nsec * 1e-9; }', '#endif',
     'typedef struct { uint32_t gpr[32]; uint32_t lr, ctr; } Ctx;',
     'typedef void (*Fn)(Ctx*);']
for i in range(N):
    a, b = r.randrange(32), r.randrange(32)
    l.append(f'__attribute__((noinline)) void f{i}(Ctx* c) {{ c->gpr[{a}] += {i} ^ c->gpr[{b}]; c->lr = {0x80000000 + 4 * i}u; }}')
l.append('Fn tabla[%d] = {%s};' % (N, ','.join(f'f{i}' for i in range(N))))
destinos = [r.randrange(N) for _ in range(DISTINTAS)]
orden = [r.randrange(DISTINTAS) for _ in range(4096)]
l.append('static const uint16_t destinos[%d] = {%s};' % (DISTINTAS, ','.join(map(str, destinos))))
l.append('static const uint16_t orden[4096] = {%s};' % ','.join(map(str, orden)))
l += [
 'typedef struct { uint32_t address; Fn entry; } Registro;',
 'typedef struct { uint32_t valid, address; const Registro* record; } Memo;',
 'static Registro registros[%d]; static Memo memo[512];' % N,
 '__attribute__((noinline)) static const Registro* buscar(uint32_t a) {   // el memo de FindRawByAddressPtr',
 '  Memo* m = &memo[((a >> 2) * 2654435761u) & 511];',
 '  if (m->valid && m->address == a) return m->record;',
 '  const Registro* r = &registros[(a - 0x80000000u) >> 2]; m->valid = 1; m->address = a; m->record = r; return r; }',
 'volatile int quien = 7;',
 'int main(void) {',
 '  static Ctx c; const long V = 20000000; double t;',
 '  for (int i = 0; i < %d; i++) { registros[i].address = 0x80000000u + 4u * i; registros[i].entry = tabla[i]; }' % N,
 '  Fn una = tabla[quien];',
 '  for (int k = 0; k < 3; k++) {',
 '    t = ahora(); for (long i = 0; i < V; i++) f7(&c); double d = (ahora() - t) / V * 1e9;',
 '    t = ahora(); for (long i = 0; i < V; i++) tabla[destinos[orden[i & 4095]]](&c); double p = (ahora() - t) / V * 1e9;',
 '    t = ahora(); for (long i = 0; i < V; i++) { const Registro* r = buscar(0x80000000u + 4u * destinos[orden[i & 4095]]); r->entry(&c); } double j = (ahora() - t) / V * 1e9;',
 '    t = ahora(); for (long i = 0; i < V; i++) una(&c); double u = (ahora() - t) / V * 1e9;',
 '    printf("vuelta %d: directa %.3f ns · por puntero, siempre la misma %.3f ns · por puntero, 2000 destinos %.3f ns · como el juego (memo + puntero) %.3f ns\\n", k, d, u, p, j);',
 '  }',
 '  printf("(%u)\\n", c.gpr[0] ^ c.gpr[5]); return 0; }']
(aqui / 'indirectas.c').write_text('\n'.join(l) + '\n', encoding='utf-8')
print('escrito', aqui / 'indirectas.c')
