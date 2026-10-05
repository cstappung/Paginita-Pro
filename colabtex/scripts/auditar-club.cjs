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

   La exportación trae nombres y uids: no se sube al repositorio (es
   público). Se deja fuera del árbol o en una carpeta ignorada. */
'use strict';
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');

function cargaVerificadores() {
  const code = esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/juegos/solo/verifica.js')], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports;
}

/* Tablas donde compite el tiempo (menos es mejor); en el resto, los puntos. */
const POR_TIEMPO = /^club-(minas-|sortem-|sopa-(facil|medio|dificil)-|sudoku-(facil|medio|dificil|experto)$|tetris-sprint$)/;
const mediana = v => { const a = v.slice().sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
/* Cuánto se aparta una fila de las demás de su tabla. Con menos de tres
   filas más no hay con qué comparar. Umbrales anchos a propósito: lo que
   marca es «mirar esto», no «es trampa». */
function anomalia(categoria, uid, filas) {
  const yo = filas[uid], otros = Object.entries(filas).filter(([u]) => u !== uid).map(([, f]) => f);
  if (yo.tiempo < 1000 && POR_TIEMPO.test(categoria)) return `terminada en ${yo.tiempo} ms`;
  if (otros.length < 3) return null;
  if (POR_TIEMPO.test(categoria)) {
    /* Además de la mediana, el mejor de los demás (sin contar marcas de
       menos de un segundo): tres personas buenas juntas son un grupo, no
       una anomalía. */
    const m = mediana(otros.map(f => f.tiempo)), mejor = Math.min(...otros.map(f => f.tiempo).filter(t => t >= 1000));
    return yo.tiempo * 2.5 < m && yo.tiempo * 1.6 < mejor ? `${(m / yo.tiempo).toFixed(1)}× más rápida que la mediana de los demás (${(m / 1000).toFixed(1)} s; el mejor de ellos, ${(mejor / 1000).toFixed(1)} s)` : null;
  }
  if (/-racha$/.test(categoria)) return null;
  const ritmo = f => f.puntos / Math.max(1, f.tiempo), mr = mediana(otros.map(ritmo));
  const max = Math.max(...otros.map(f => f.puntos));
  if (ritmo(yo) > 4 * mr && yo.puntos > 1.6 * max) return `ritmo ${(ritmo(yo) / mr).toFixed(1)}× el de la mediana de los demás`;
  return yo.puntos > 2.5 * max ? `${(yo.puntos / max).toFixed(1)}× la mejor marca de los demás` : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* La forma de `partida` que escribe cada camino legítimo. */
function partidaRara(categoria, partida) {
  if (typeof partida !== 'string') return 'sin partida';
  if (categoria.startsWith('yemas-zombis-')) return /^[-_A-Za-z0-9]{6,40}$/.test(partida) ? null : 'partida con forma rara';
  if (categoria.startsWith('club-frontera-')) return /^(frv?-|[-_A-Za-z0-9]+-\d+v?$)/.test(partida) ? null : 'partida con forma rara para la Frontera';
  return UUID.test(partida) ? null : 'partida que no es un UUID: escrita fuera del juego';
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
  const { VERIFICADORES, juegoDeCategoria, verificaClub, sospechaFila } = cargaVerificadores();

  const hallazgos = [];
  for (const [categoria, filas] of Object.entries(ranks)) {
    if (filtro && categoria !== filtro) continue;
    const juego = juegoDeCategoria(categoria);
    for (const [uid, fila] of Object.entries(filas || {})) {
      const motivos = [];
      const rara = partidaRara(categoria, fila.partida);
      if (rara) motivos.push(rara);
      const s = sospechaFila(categoria, fila);
      if (s) motivos.push('inverosímil: ' + s);
      const a = anomalia(categoria, uid, filas);
      if (a) motivos.push('anómala: ' + a);
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
      if (motivos.length) hallazgos.push({ categoria, uid, nombre: fila.nombre, puntos: fila.puntos, tiempo: fila.tiempo, partida: fila.partida, vetado: !!vetados[uid], motivos });
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
