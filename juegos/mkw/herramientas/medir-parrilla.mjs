// ¿El «puesto anterior» (+0xE1 de la ficha de cada jugador, escenario de los MENÚS de Racedata) ordena la largada de
// la carrera siguiente? — bitácora §94.3.
//
// Resumen: abre una carrera directa (?modo=directa), la termina por código (Module._mkw_sala_terminar), escribe a mano
// +0xE1 con un orden inventado (el humano 6.º) y abre la carrera 2 con la misma ficha (primera: false). Muestra los
// puestos del juego (RaceinfoPlayer +0x20) al largar y en la cuenta regresiva, y saca una foto: si son los escritos,
// el juego larga según +0xE1 (resultado del 2026-10-20: sí, 6 1 2 3 4 5 7 8 9 10 11 12).
// Uso:  node herramientas/medir-parrilla.mjs [puerto=8169] [carpeta de la foto=build/web/datos]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = Number(process.argv[2] || 8169), salida = process.argv[3] || path.join(raiz, 'build/web/datos');
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const nav = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const p = await (await nav.newContext({ viewport: { width: 960, height: 540 } })).newPage();
await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cpu=normal&semilla=99`);
const espera = ms => new Promise(r => setTimeout(r, ms));
const foto = () => p.evaluate(() => {
  const L = window.mkwMenus; if (!L?.estado) return null;
  const rd = L.u32(0x809BD728), ri = L.u32(0x809BD730), lista = ri ? L.u32(ri + 0xC) : 0;
  const e = (esc, i, o) => L.u8(rd + esc + 8 + i * 0xF0 + o);
  return { s: L.estado().seccion, etapa: ri ? L.u32(ri + 0x28) : -1, ri,
    e1menus: Array.from({ length: 12 }, (_, i) => e(0xC10, i, 0xE1)), e2menus: Array.from({ length: 12 }, (_, i) => e(0xC10, i, 0xE2)),
    e1carrera: Array.from({ length: 12 }, (_, i) => e(0x20, i, 0xE1)), e0carrera: Array.from({ length: 12 }, (_, i) => e(0x20, i, 0xE0)),
    puestos: Array.from({ length: 12 }, (_, i) => { const rp = lista ? L.u32(lista + 4 * i) : 0; return rp ? L.u8(rp + 0x20) : -1; }) };
}).catch(() => null);
let x = null;
for (const fin = Date.now() + 120000; Date.now() < fin; await espera(500)) { x = await foto(); if (x?.etapa >= 2) break; }
console.log('carrera 1 largó:', x?.puestos.join(' '));
await p.evaluate(() => { window.mkw._mkw_sala_dnf?.(2000); window.mkw._mkw_sala_terminar(0); });
for (const fin = Date.now() + 60000; Date.now() < fin; await espera(500)) { x = await foto(); if (x?.etapa >= 4 && x.e2menus.some(v => v)) break; }
console.log('carrera 1 llegada (+0xE2 menús):', x?.e2menus.join(' '), '· Raceinfo:', x?.puestos.join(' '));
const ri1 = x?.ri;
// el orden inventado: el humano (puesto 0) 6.º, los CPU 1.º a 5.º y 7.º a 12.º (distinto de la llegada: así se ve si el juego lo copia solo)
const orden = [6, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];
await p.evaluate(orden => {
  const L = window.mkwMenus, rd = L.u32(0x809BD728);
  orden.forEach((v, i) => L.w8(rd + 0xC10 + 8 + i * 0xF0 + 0xE1, v));
  const f = { ...window.mkwEstado.ficha, primera: false, carrera: 1 };
  window.mkwDirecto.carrera(f, { licencia: -1 }).then(ok => { window.__dos = ok; });
}, orden);
console.log('escrito +0xE1:', orden.join(' '));
for (const fin = Date.now() + 90000; Date.now() < fin; await espera(250)) { x = await foto(); if (x && x.ri !== ri1 && x.etapa >= 0 && x.etapa < 4 && x.puestos[0] > 0) break; }
console.log('carrera 2 etapa', x?.etapa, 'puestos al largar:', x?.puestos.join(' '));
console.log('  escenario de la carrera +0xE0:', x?.e0carrera.join(' '), '· +0xE1:', x?.e1carrera.join(' '));
for (const fin = Date.now() + 30000; Date.now() < fin; await espera(250)) { x = await foto(); if (x?.etapa >= 1) break; }
await espera(1500);
x = await foto();
console.log('carrera 2 etapa', x?.etapa, 'puestos:', x?.puestos.join(' '));
await p.screenshot({ path: path.join(salida, 'parrilla-carrera2.png') });
await nav.close(); servidor.kill();
