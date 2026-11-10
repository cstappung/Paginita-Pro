# W23 (etapa E4b del plan v4, bitácora §226): la prueba chica de call_ref contra call_indirect, sin nada del juego.
#
# Resumen: el código traducido del juego salta a muchas funciones por su puntero (cada «bctrl»). En wasm eso hoy es
# call_indirect: busca el índice en la tabla de funciones, revisa la firma y salta. V8 (el motor de wasm de Chrome)
# puede ADIVINAR el destino de un salto que casi siempre va al mismo lugar y meter esa función en línea («inlining
# especulativo»), y lo hace seguro con call_ref (saltar a una referencia de función tipada). Esta prueba escribe a mano
# (en texto WAT, armado con wasm-as de binaryen) el mismo módulo con 2.000 funciones chicas de la forma de las
# traducidas (reciben el puntero al contexto, tocan dos registros y el LR) y bucles que llaman por puntero de las dos
# formas, con tres grados de «polimorfismo» del mismo lugar de llamada:
#   uno     = siempre el mismo destino (como una llamada virtual que casi nunca cambia),
#   cuatro  = 4 destinos que se turnan,
#   muchos  = 2.000 destinos en orden de azar fijo (como el despacho general).
# Además una directa (call a una función conocida) como referencia. Salida: build/micro-callref/callref.wat y .wasm
# (fuera de git, se regenera). Correr: node herramientas/micro-indirectas/correr-callref.mjs [--chrome].
# Comparación eléctrica: call_indirect es pasar cada vez por un conmutador que mira el número de la salida; call_ref es
# tener el cable ya conectado a la salida, y el inlining especulativo es soldar el cable de la salida que más se usa.
import random, pathlib, subprocess, sys
N = 2000
raiz = pathlib.Path(__file__).resolve().parents[2]
aqui = raiz / 'build/micro-callref'
aqui.mkdir(parents=True, exist_ok=True)
r = random.Random(226)
w = ['(module',
     ' (type $f (func (param i32)))',
     ' (memory (export "memoria") 1)',
     f' (table $t {N} funcref)',
     f' (table $r {N} (ref null $f))']
for i in range(N):
    a, b = r.randrange(32) * 4, r.randrange(32) * 4
    w.append(f' (func $f{i} (type $f) (param $c i32) (i32.store offset={a} (local.get $c) (i32.add (i32.load offset={a} (local.get $c))'
             f' (i32.xor (i32.const {i}) (i32.load offset={b} (local.get $c))))) (i32.store offset=128 (local.get $c) (i32.const {0x80000000 + 4 * i - 2**32})))')
w.append(' (elem (table $t) (i32.const 0) func ' + ' '.join(f'$f{i}' for i in range(N)) + ')')
w.append(' (elem (table $r) (i32.const 0) (ref null $f) ' + ' '.join(f'(ref.func $f{i})' for i in range(N)) + ')')
# los órdenes (4096 índices u16 cada uno) en la memoria: uno en 4096, cuatro en 12288, muchos en 20480
ordenes = {'uno': [7] * 4096, 'cuatro': [[11, 503, 1207, 1999][k & 3] for k in range(4096)], 'muchos': [r.randrange(N) for _ in range(4096)]}
bases = {'uno': 4096, 'cuatro': 12288, 'muchos': 20480}
for nombre, lista in ordenes.items():
    datos = b''.join(int(x).to_bytes(2, 'little') for x in lista)
    w.append(f' (data (i32.const {bases[nombre]}) "' + ''.join(f'\\{c:02x}' for c in datos) + '")')
# los bucles: (n, base del orden) → nada; la vuelta i llama al destino orden[i & 4095]
def bucle(nombre, llamada):
    return (f' (func (export "{nombre}") (param $n i32) (param $base i32) (local $i i32)'
            ' (loop $l (' + llamada + ')'
            ' (local.set $i (i32.add (local.get $i) (i32.const 1)))'
            ' (br_if $l (i32.lt_u (local.get $i) (local.get $n)))))')
idx = '(i32.load16_u (i32.add (local.get $base) (i32.shl (i32.and (local.get $i) (i32.const 4095)) (i32.const 1))))'
w.append(bucle('directa', f'drop (i32.const 0)) (call $f7 (i32.const 0)'))
w.append(bucle('indirecta', f'call_indirect $t (type $f) (i32.const 0) {idx}'))
w.append(bucle('ref', f'call_ref $f (i32.const 0) (table.get $r {idx})'))
w.append(')')
(aqui / 'callref.wat').write_text('\n'.join(w), encoding='utf-8')
emsdk = raiz / 'herramientas/emsdk/upstream/bin/wasm-as'
res = subprocess.run([str(emsdk), '-all', str(aqui / 'callref.wat'), '-o', str(aqui / 'callref.wasm')], capture_output=True, text=True)
if res.returncode:
    print(res.stdout, res.stderr); sys.exit(1)
print('listo:', aqui / 'callref.wasm', (aqui / 'callref.wasm').stat().st_size, 'bytes; bases', bases)
