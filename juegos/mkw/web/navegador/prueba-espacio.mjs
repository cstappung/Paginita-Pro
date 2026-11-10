// Prueba con el juego: borrar UNA pista con la pantalla «Espacio» y que la otra siga — bitácora §251.
//
// Resumen: un perfil de Chrome nuevo juega dos pistas de Retro Rewind (por omisión 0.0 y 13.2, cada una abierta directo
// con ?modo=directa) y en la segunda, con la carrera andando, abre el cajón → Avanzado → Pistas, marca la PRIMERA con un
// clic en su fila (como una persona: con el ratón), aprieta «Borrar», confirma y espera los 8 s del «Deshacer»: con la carrera andando
// no se borra (espera a que termine, §176); se recarga la página (lo pendiente se pierde) y se repite desde los menús.
// Comprueba:
//   - que las dos pistas aparecen en la lista con su fecha de hoy, y que la de la carrera en curso dice «en uso» y no se
//     puede marcar (no se borra nada que la carrera esté usando: §176);
//   - que a los 8 s los archivos de la primera (Tracks/<n>.szs y su música) ya no están en la caja y los de la segunda sí,
//     enteros (la cuenta de la caja contra el tamaño del manifiesto);
//   - que al volver a jugar la primera, su pista se vuelve a pedir a la red y queda guardada de nuevo, y que la segunda
//     sigue en la caja sin bajarse.
// Corre con el candado de medición si se la llama desde herramientas/tanda-espacio.sh (otra sesión puede estar midiendo).
//
// Uso:  node web/navegador/prueba-espacio.mjs [--pistas 0.0,13.2] [--puerto 8156] [--ventana]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8156));
const [PA, PB] = opcion('--pistas', '0.0,13.2').split(',');
const numero = s => { const [c, f] = s.split('.').map(Number); return 0x100 + 4 * c + (f || 0); };
const NA = numero(PA), NB = numero(PB);
const RR = '/mkw/sd/RetroRewind6';
const pistaA = `${RR}/Tracks/${NA - 0x100}.szs`, pistaB = `${RR}/Tracks/${NB - 0x100}.szs`;
const musicaA = `${RR}/strm/${NA - 0x100}_N.brstm`;
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle !== '' ? ' — ' + detalle : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const perfil = mkdtempSync(path.join(tmpdir(), 'mkw-espacio-'));
const ventana = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const ctx = await chromium.launchPersistentContext(perfil, { channel: 'chrome', headless: !process.argv.includes('--ventana'),
  viewport: { width: 1100, height: 760 },
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${ventana[0]},${ventana[1]}`] });
const p = ctx.pages()[0] || await ctx.newPage();
p.on('pageerror', e => console.log('[pageerror] ' + e.message));
const pedidas = [];                       // lo que la página pidió a la red (direcciones y cuerpos de los lotes)
p.on('request', r => { pedidas.push(decodeURIComponent(r.url()) + ' ' + decodeURIComponent(r.postData() || '')); });

// abrir una pista directo y esperar a la carrera andando (más unos segundos: que se guarde lo bajado)
async function jugar(pista, extra = '') {
  pedidas.length = 0;
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${pista}&cc=c150&cpu=normal&pj=0&kart=1${extra}`);
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const e = await p.evaluate(() => window.mkwEstado?.enCarrera === true && (window.mkwMenus?.u32(window.mkwMenus.u32(0x809BD730) + 0x28) ?? 0) >= 2).catch(() => false);
    if (e) break;
    await p.waitForTimeout(500);
  }
  const corre = await p.evaluate(() => window.mkwEstado?.enCarrera === true).catch(() => false);
  await p.waitForTimeout(4000);
  return { corre, s: ((Date.now() - t0) / 1000).toFixed(0) };
}
// lo guardado de un archivo (bytes, de la caja) y su tamaño en el manifiesto
const guardado = ruta => p.evaluate(async r => {
  const u = new URL(r.split('/').map(encodeURIComponent).join('/'), location.href).href;
  const m = await (await fetch('/manifiesto.json')).json();
  let tam = 0;
  for (const [pre, lista] of Object.entries(m)) for (const [ru, t] of lista) if (pre + ru === r) tam = t;
  const inv = await window.mkwDisco.inventario(x => x === u ? tam : 0);
  return { bytes: inv.get(u) || 0, tam };
}, ruta);

try {
  const j1 = await jugar(PA);
  ok(`la pista ${PA} corre (perfil nuevo)`, j1.corre, `${j1.s} s`);
  const j2 = await jugar(PB);
  ok(`la pista ${PB} corre`, j2.corre, `${j2.s} s`);
  const ga = await guardado(pistaA), gb = await guardado(pistaB);
  ok('las dos pistas quedaron enteras en la caja', ga.bytes === ga.tam && gb.bytes === gb.tam && ga.tam > 0, `${PA}: ${ga.bytes}/${ga.tam}, ${PB}: ${gb.bytes}/${gb.tam}`);
  const uso = await p.evaluate(() => JSON.parse(localStorage.getItem('mkw.pistas.uso') || '{}'));
  ok('la fecha de cada pista se anotó al jugarla y sus archivos quedaron atados',
     Date.now() - (uso[NA]?.t || 0) < 600000 && Date.now() - (uso[NB]?.t || 0) < 300000 && (uso[NA]?.a || []).includes(pistaA), JSON.stringify(uso).slice(0, 200));

  // el cajón → Avanzado → Pistas, con el ratón
  await p.evaluate(() => window.mkwInterfaz.abrirCajon('avanzado'));   // (la barra queda debajo del juego en la carrera)
  await p.waitForTimeout(300);
  await p.evaluate(() => window.mkwEspacio.refrescar());
  await p.click('.esp-parte[data-parte="pistas"]');
  await p.waitForSelector(`.esp-fila[data-clave="p:${NA}"]`, { timeout: 10000 });
  const filaB = await p.$eval(`.esp-fila[data-clave="p:${NB}"]`, f => ({ texto: f.textContent, bloqueada: f.querySelector('input').disabled })).catch(() => null);
  const filaA = await p.$eval(`.esp-fila[data-clave="p:${NA}"]`, f => f.textContent).catch(() => '');
  ok('las dos pistas en la lista, con «hoy»', /hoy/.test(filaA) && !!filaB, filaA);
  ok('la de la carrera en curso dice «en uso» y no se puede marcar', filaB?.bloqueada && /en uso/.test(filaB.texto), filaB?.texto);
  const alto = await p.$eval(`.esp-fila[data-clave="p:${NA}"]`, f => f.getBoundingClientRect().height);
  ok('la fila mide 48 px o más', alto >= 48, `${alto} px`);
  await p.click(`.esp-fila[data-clave="p:${NA}"] .esp-nombre`);
  const boton = await p.textContent('#espBorrar');
  ok('un clic en la fila la marca y el botón dice cuánto borra', /Borrar 1 pista/.test(boton), boton);
  await p.click('#espBorrar');
  await p.click('#dialogo .acciones .boton.peligro');
  await p.waitForTimeout(500);
  const antes = await guardado(pistaA);
  ok('durante los 8 s del «Deshacer» todavía no se borró nada', antes.bytes === antes.tam && !!(await p.$('#espDeshacer')));
  await p.waitForTimeout(9000);
  // con la carrera andando no se toca la caja (§176): lo pedido espera a que termine
  const espera = await p.textContent('#espCuenta').catch(() => '');
  const aun = await guardado(pistaA);
  ok('vencidos los 8 s con la carrera andando, espera a que termine sin borrar', /al terminar la carrera/.test(espera) && aun.bytes === aun.tam, espera);
  // en un jugador la carrera no termina sola por código: se recarga la página (lo pendiente se pierde: nada se borró) y
  // se borra desde los menús, sin carrera
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1`);
  for (let i = 0; i < 120 && !(await p.evaluate(() => !!window.mkwEspacio && !!window.mkwDisco && !!window.mkwMenus).catch(() => false)); i++) await p.waitForTimeout(500);
  await p.waitForTimeout(8000);
  const recargada = await guardado(pistaA);
  ok('al recargar con el borrado pendiente no se borró nada; sin carrera', recargada.bytes === recargada.tam && !(await p.evaluate(() => window.mkwEstado.enCarrera)), `${recargada.bytes}/${recargada.tam}`);
  await p.evaluate(() => window.mkwInterfaz.abrirCajon('avanzado'));
  await p.waitForTimeout(300);
  await p.evaluate(() => window.mkwEspacio.refrescar());
  await p.click('.esp-parte[data-parte="pistas"]');
  await p.waitForSelector(`.esp-fila[data-clave="p:${NA}"]`, { timeout: 10000 });
  await p.click(`.esp-fila[data-clave="p:${NA}"] .esp-nombre`);
  await p.click('#espBorrar');
  await p.click('#dialogo .acciones .boton.peligro');
  await p.waitForTimeout(9500);
  const tras = await guardado(pistaA), musica = await guardado(musicaA), sigue = await guardado(pistaB);
  ok(`desde los menús, a los 8 s la pista ${PA} y su música ya no están en la caja`, tras.bytes === 0 && musica.bytes === 0, `${tras.bytes} y ${musica.bytes} bytes`);
  ok(`la pista ${PB} sigue entera en la caja`, sigue.bytes === sigue.tam && sigue.tam > 0, `${sigue.bytes}/${sigue.tam}`);
  const listo = await p.textContent('#espListo').catch(() => '');
  ok('la pantalla dice cuánto se liberó y ya no muestra la pista', /Listo/.test(listo) && !(await p.$(`.esp-fila[data-clave="p:${NA}"]`)), listo);

  // volver a jugar la borrada: se baja otra vez y queda guardada; la otra sigue sin bajarse
  const j3 = await jugar(PA);
  const fin = r => r.slice(r.indexOf('/Tracks/'));   // (el lote lleva la ruta sin el prefijo de la página)
  const pidioA = pedidas.some(x => x.includes(fin(pistaA))), pidioB = pedidas.some(x => x.includes(fin(pistaB)));
  ok(`la pista ${PA} borrada se vuelve a pedir a la red al jugarla`, j3.corre && pidioA, pedidas.filter(x => x.includes('Tracks/')).map(x => x.slice(0, 160)).join(' | '));
  const otra = await guardado(pistaA), b2 = await guardado(pistaB);
  ok('…y queda guardada de nuevo; la otra sigue en la caja sin haberse bajado', otra.bytes === otra.tam && b2.bytes === b2.tam && !pidioB, `${otra.bytes}/${otra.tam}`);
} catch (e) { ok('la prueba corrió sin errores', false, String(e?.stack || e)); }
await ctx.close();
servidor.kill();
try { rmSync(perfil, { recursive: true, force: true }); } catch {}
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
