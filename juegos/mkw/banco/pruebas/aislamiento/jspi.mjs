// Paso 8 (bitácora §187): ¿anda JSPI aquí? Un módulo wasm diminuto armado a mano (sin nada del juego): importa una
// función asíncrona de JS (envuelta en WebAssembly.Suspending) y exporta g() = f() + 1 (envuelta en
// WebAssembly.promising). Si g() devuelve 42 cuando f() contesta 41 después de esperar, el wasm se SUSPENDIÓ esperando
// a JS y siguió: es lo que hace el juego con el disco y las esperas (JSPI).
const BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,           // «\0asm», versión 1
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,                 // tipos: () → i32
  0x02, 0x07, 0x01, 0x01, 0x65, 0x01, 0x66, 0x00, 0x00,     // importa e.f (tipo 0)
  0x03, 0x02, 0x01, 0x00,                                   // una función propia (tipo 0)
  0x07, 0x05, 0x01, 0x01, 0x67, 0x00, 0x01,                 // exporta «g» = la función 1
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x10, 0x00, 0x41, 0x01, 0x6a, 0x0b,   // g: call f; i32.const 1; i32.add
]);
export async function probarJspi() {
  if (!('Suspending' in WebAssembly) || typeof WebAssembly.promising !== 'function') return false;
  const f = new WebAssembly.Suspending(() => new Promise(r => setTimeout(() => r(41), 5)));
  const { instance } = await WebAssembly.instantiate(BYTES, { e: { f } });
  const g = WebAssembly.promising(instance.exports.g);
  return (await g()) === 42;
}
