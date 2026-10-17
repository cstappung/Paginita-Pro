// Lo común a Node y a la página: corre la versión wasm y compara cada huella con la de x86.
// sinNaN y unNaN tienen que coincidir; variosNaN es informativo (ni x86 es determinista ahí).
export function parseHuellas(texto) {
  const m = new Map();
  for (const l of texto.trim().split(/\r?\n/)) { const [op, clase, n, h] = l.trim().split(/\s+/); m.set(op + ' ' + clase, { n: +n, h }); }
  return m;
}
export async function correParidad(crea, textoX86, ok, nota, casos = 1000000) {
  const lineas = [];
  const M = await crea({ print: l => lineas.push(l), printErr: () => {} });
  const t = performance.now();
  M.callMain([String(casos)]);
  const ms = performance.now() - t;
  const x86 = parseHuellas(textoX86), wasm = parseHuellas(lineas.join('\n'));
  const ops = [...new Set([...x86.keys()].map(k => k.split(' ')[0]))];
  const informativo = [];
  for (const op of ops) {
    const malas = [];
    for (const clase of ['sinNaN', 'unNaN']) {
      const a = x86.get(op + ' ' + clase), b = wasm.get(op + ' ' + clase);
      if (a && (!b || a.h !== b.h || a.n !== b.n)) malas.push(`${clase}: x86 ${a.h} wasm ${b ? b.h : '—'}`);
    }
    const n = ['sinNaN', 'unNaN'].reduce((s, c) => s + (x86.get(op + ' ' + c)?.n || 0), 0);
    ok(`${op} igual a x86 bit a bit (${n.toLocaleString()} casos sin NaN o con un NaN)`, malas.length === 0, malas.join('; '));
    const v = x86.get(op + ' variosNaN'), w = wasm.get(op + ' variosNaN');
    if (v) informativo.push(`${op} ${v.h === w?.h ? '=' : '≠'}`);
  }
  nota(`varios NaN (informativo, ni x86 es determinista): ${informativo.join(', ')}`);
  nota(`wasm: ${casos.toLocaleString()} casos × ${ops.length} operaciones en ${ms.toFixed(0)} ms`);
  return { x86, wasm };
}
