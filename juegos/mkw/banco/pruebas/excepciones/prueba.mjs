// Lo común a Node y a la página: corre el programa y compara el registro con el esperado.
// Esperado: A1 B1 B-atrapa:CC000004 A2 A3 A-atrapa:CC008000 M1 M-atrapa:DEAD0000 … y B2 + trampolin2:CD000000
// (el orden exacto lo explica excepciones.cpp; lo importante es QUIÉN atrapa cada excepción).
export async function correExcepciones(crea, ok) {
  const M = await crea({ print: () => {} });
  await M.callMain([]);
  const r = M.UTF8ToString(M._registro()).trim().split(' ');
  ok('B atrapa su excepción aunque A esté suspendido dentro de un try', r.includes('B-atrapa:CC000004') && r.indexOf('B-atrapa:CC000004') < r.indexOf('A2'), r.join(' '));
  ok('A atrapa la suya, lanzada a 21 niveles de profundidad tras varios cambios', r.includes('A-atrapa:CC008000') && !r.includes('A-no-deberia'));
  ok('B lanza sin try propio: la atrapa el trampolín de B, no el try suspendido de A', r.includes('trampolin2:CD000000') && r.indexOf('trampolin2:CD000000') < r.indexOf('A3'));
  ok('main atrapa la suya después de que los fibers corrieron', r.includes('M-atrapa:DEAD0000'));
  return { M, r };
}
