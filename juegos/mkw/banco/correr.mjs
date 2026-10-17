// Corre páginas del banco en Chrome sin ventana y dice cómo les fue (✓/✗ de cada una) — bitácora §55.
//
// Resumen: levanta el servidor del banco (servir.cjs, solo en 127.0.0.1), abre cada página pedida con Playwright (sin
// sonido, como pidió el dueño), espera a que la página diga que terminó (document.body.dataset.fin = '1', lo pone
// fin() de comun.js) y copia a la consola sus líneas ✓/✗. Sale con código 1 si alguna falló.
//
// Uso:  node banco/correr.mjs licencias mii guardado      (los nombres son los de PRUEBAS en banco/index.html)
//       node banco/correr.mjs                             (sin nombres: todas las páginas pruebas/*/index.html)
import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(aqui, 'package.json'))('playwright-core');
const PUERTO = 8133;
const pedidas = process.argv.slice(2);
const todas = readdirSync(path.join(aqui, 'pruebas')).filter(d => existsSync(path.join(aqui, 'pruebas', d, 'index.html')));
const lista = pedidas.length ? pedidas : todas;

const servidor = spawn(process.execPath, [path.join(aqui, 'servir.cjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => { servidor.stdout.on('data', r); setTimeout(r, 1500); });
const navegador = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--enable-unsafe-webgpu'] });
let falla = 0;
for (const id of lista) {
  const pagina = await navegador.newPage();
  const lineas = [];
  pagina.on('console', m => { const t = m.text(); if (/^[✓✗·]|^fin:/.test(t)) lineas.push(t); });
  pagina.on('pageerror', e => lineas.push('✗ error en la página: ' + e.message));
  await pagina.goto(`http://127.0.0.1:${PUERTO}/pruebas/${id}/index.html`);
  const termino = await pagina.waitForFunction(() => document.body.dataset.fin === '1', null, { timeout: 120000 }).then(() => true, () => false);
  const mal = lineas.filter(l => l.startsWith('✗')).length + (termino ? 0 : 1);
  falla += mal ? 1 : 0;
  console.log(`\n== ${id}: ${mal ? '✗' : '✓'} ${termino ? '' : '(no terminó a tiempo)'}`);
  for (const l of lineas) console.log('  ' + l);
  await pagina.close();
}
await navegador.close();
servidor.kill();
console.log(`\n${lista.length - falla} de ${lista.length} páginas bien`);
process.exit(falla ? 1 : 0);
