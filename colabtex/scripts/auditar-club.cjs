#!/usr/bin/env node
/* Auditoría de las tablas del club (docs/antitrampas.md).

   Lee una exportación JSON de la Realtime Database —la de la raíz entera o
   la de un solo nodo (`soloRanks`), hecha en la consola de Firebase con
   ⋮ → Exportar JSON— y lista las filas sospechosas, con el motivo:

     - la fila tiene prueba (`soloPruebas`) y el verificador del juego la
       rechaza: es trampa o un error del verificador, y hay que mirarla;
     - la fila no tiene prueba y su juego ya la exige;
     - la `partida` no tiene la forma que le pone el juego (un UUID en el
       club): la fila se escribió a mano, saltándose la página;
     - la marca es inverosímil para un humano (`sospecha()` de cada juego);
     - la marca es anómala frente al resto de la tabla: mucho más rápida
       que la mediana de los demás, o con un ritmo (puntos por segundo)
       varias veces el de ellos. Es una señal más débil —alguien puede ser
       muy bueno— y por eso va aparte, como «anómala».

   Uso:  node scripts/auditar-club.cjs export.json [--json] [--todo] [--categoria club-minas-easy]

   Lo mismo se puede hacer sin exportar nada desde el panel de
   administración de Juegos (juegos.html#admin → Auditoría), que además
   recuerda lo ya auditado y deja eliminar la fila con un clic.

   La exportación trae nombres y uids: no se sube al repositorio (es
   público). Se deja fuera del árbol o en una carpeta ignorada. */
'use strict';
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');

/* Los verificadores y las señales de la auditoría, en un solo paquete.
   Las señales viven en src/juegos/admin-datos.js: son las mismas que usa
   el panel de administración de Juegos (#admin), así los dos nunca
   discrepan. */
function cargaVerificadores() {
  const code = esbuild.buildSync({
    stdin: {
      contents: "export * from './juegos/solo/verifica.js'; export { senalesFila, hallazgo } from './juegos/admin-datos.js';",
      resolveDir: path.join(__dirname, '../src'), loader: 'js'
    },
    bundle: true, format: 'cjs', platform: 'node', write: false
  }).outputFiles[0].text;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports;
}

async function main() {
  const args = process.argv.slice(2);
  const archivo = args.find(a => !a.startsWith('--'));
  if (!archivo) { console.error('Uso: node scripts/auditar-club.cjs export.json [--json] [--categoria X]'); process.exit(2); }
  const soloJson = args.includes('--json');
  const filtro = args.includes('--categoria') ? args[args.indexOf('--categoria') + 1] : null;
  const raiz = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const ranks = raiz.soloRanks || (Object.keys(raiz).some(k => /^club-|^yemas-zombis-/.test(k)) ? raiz : {});
  const pruebas = raiz.soloPruebas || {};
  const vetados = raiz.vetados || {};
  const { VERIFICADORES, juegoDeCategoria, verificaClub, sospechaFila, senalesFila, hallazgo } = cargaVerificadores();

  const hallazgos = [];
  for (const [categoria, filas] of Object.entries(ranks)) {
    if (filtro && categoria !== filtro) continue;
    const juego = juegoDeCategoria(categoria);
    for (const [uid, fila] of Object.entries(filas || {})) {
      if (!fila) continue;
      const motivos = senalesFila(categoria, uid, filas, sospechaFila);
      if (juego) {
        const p = ((pruebas[categoria] || {})[uid] || {})[fila.partida];
        if (p) {
          let prueba = null;
          try { prueba = p.d ? JSON.parse(p.d) : null; } catch { motivos.push('prueba ilegible'); }
          const m = await verificaClub(juego, { categoria, puntos: fila.puntos, tiempo: fila.tiempo, partida: fila.partida }, prueba, { uid, ahora: Number.isFinite(p.at) ? p.at : undefined });
          if (m) motivos.push('la prueba no cuadra: ' + m);
        } else if (VERIFICADORES[juego].PRUEBA > 0) {
          motivos.push('sin prueba (anterior a la verificación, o escrita a mano)');
        }
      }
      if (motivos.length) hallazgos.push(hallazgo(categoria, uid, fila, motivos, vetados));
    }
  }

  if (soloJson) { console.log(JSON.stringify(hallazgos, null, 2)); return; }
  /* Una fila cuyo único motivo es no tener prueba suele ser anterior a la
     verificación de su juego: se cuenta aparte, para no tapar lo que sí
     llama la atención (con --todo se listan igual). */
  const SIN_PRUEBA = /^sin prueba/;
  const soloSinPrueba = hallazgos.filter(h => h.motivos.every(m => SIN_PRUEBA.test(m)));
  if (!args.includes('--todo')) hallazgos.splice(0, hallazgos.length, ...hallazgos.filter(h => !soloSinPrueba.includes(h)));
  const porUid = {};
  for (const h of hallazgos) (porUid[h.uid] = porUid[h.uid] || { nombre: h.nombre, filas: [] }).filas.push(h);
  const total = Object.values(ranks).reduce((n, f) => n + Object.keys(f || {}).length, 0);
  console.log(`${hallazgos.length} filas sospechosas de ${total}, en ${Object.keys(porUid).length} cuentas.`);
  if (soloSinPrueba.length && !args.includes('--todo')) console.log(`(${soloSinPrueba.length} filas más no tienen prueba y no llaman la atención por otra cosa: anteriores a la verificación. --todo las lista.)`);
  console.log('');
  for (const [uid, c] of Object.entries(porUid).sort((a, b) => b[1].filas.length - a[1].filas.length)) {
    const nombres = [...new Set(Object.values(ranks).map(f => (f || {})[uid]).filter(Boolean).map(f => f.nombre))];
    console.log(`■ ${nombres.join(' / ') || '?'} (${uid})${vetados[uid] ? ' — ya vetada' : ''}: ${c.filas.length} filas`);
    for (const h of c.filas) console.log(`   ${h.categoria}: ${h.puntos} pts, ${(h.tiempo / 1000).toFixed(2)} s — ${h.motivos.join('; ')}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
