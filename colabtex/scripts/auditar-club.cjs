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
     - la marca es inverosímil para un humano (`sospecha()` de cada juego).

   Uso:  node scripts/auditar-club.cjs export.json [--json] [--categoria club-minas-easy]

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
      if (juego) {
        const p = ((pruebas[categoria] || {})[uid] || {})[fila.partida];
        if (p) {
          let prueba = null;
          try { prueba = p.d ? JSON.parse(p.d) : null; } catch { motivos.push('prueba ilegible'); }
          const m = await verificaClub(juego, { categoria, puntos: fila.puntos, tiempo: fila.tiempo, partida: fila.partida }, prueba);
          if (m) motivos.push('la prueba no cuadra: ' + m);
        } else if (VERIFICADORES[juego].PRUEBA > 0) {
          motivos.push('sin prueba (anterior a la verificación, o escrita a mano)');
        }
      }
      if (motivos.length) hallazgos.push({ categoria, uid, nombre: fila.nombre, puntos: fila.puntos, tiempo: fila.tiempo, partida: fila.partida, vetado: !!vetados[uid], motivos });
    }
  }

  if (soloJson) { console.log(JSON.stringify(hallazgos, null, 2)); return; }
  const porUid = {};
  for (const h of hallazgos) (porUid[h.uid] = porUid[h.uid] || { nombre: h.nombre, filas: [] }).filas.push(h);
  const total = Object.values(ranks).reduce((n, f) => n + Object.keys(f || {}).length, 0);
  console.log(`${hallazgos.length} filas sospechosas de ${total}, en ${Object.keys(porUid).length} cuentas.\n`);
  for (const [uid, c] of Object.entries(porUid).sort((a, b) => b[1].filas.length - a[1].filas.length)) {
    console.log(`■ ${c.nombre || '?'} (${uid})${vetados[uid] ? ' — ya vetada' : ''}: ${c.filas.length} filas`);
    for (const h of c.filas) console.log(`   ${h.categoria}: ${h.puntos} pts, ${(h.tiempo / 1000).toFixed(2)} s — ${h.motivos.join('; ')}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
