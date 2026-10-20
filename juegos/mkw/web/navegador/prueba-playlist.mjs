// Prueba con el juego: la playlist de la sala con dos pestañas — bitácora §74.
//
// Resumen: abre la página del juego dos veces como dos computadores de la misma sala (A es la anfitriona; malla
// WebRTC con el buzón falso del banco) con ?modo=sala&estilo=playlist y recorre lo que pidió el dueño:
//   1. A arma la playlist con el selector de la página (modo lista con sugerencias) y B ve el selector de SUGERIR
//      (la lista de la sala, sin poder cambiarla); lo que agrega A le aparece a B;
//   2. B sugiere una pista: a A le llega (con «💬 1») y a B le queda «⌛ Esperando»; A la acepta con ✓: entra al final
//      y B la ve «✓ En la lista»;
//   3. recién cuando A confirma la playlist se elige personaje (el selector de B se cierra solo);
//   4. la carrera 1 corre (se termina por código en el mismo cuadro en las dos, como en prueba-sala) y, mientras se ven
//      los resultados, a las dos les aparece la playlist un rato: A con «+ Agregar pistas» y B con «Sugerir pista»;
//   5. B sugiere otra desde ahí; A abre «+ Agregar pistas», la sala espera aunque pasen los resultados, A acepta la de
//      B y sigue: la carrera 2 abre en las dos con la pista que venía y la playlist ya tiene 3.
// Fotos en build/web/datos/playlist/.
//
// Uso:  node web/navegador/prueba-playlist.mjs [--ventana] [--puerto=8157]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = Number((process.argv.find(a => a.startsWith('--puerto=')) || '--puerto=8157').slice(9));
const carpeta = path.join(raiz, 'build/web/datos/playlist');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const hex = n => '0x' + (n >>> 0).toString(16);

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const contexto = await navegador.newContext({ viewport: { width: 1100, height: 680 } });
const sala = 'pl-' + Date.now().toString(36);
const uidA = 'a' + sala, uidB = 'b' + sala;
const registro = [], errores = [];
const t0 = Date.now();
const seg = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
async function abrir(nombre, uid) {
  const p = await contexto.newPage();
  p.on('pageerror', e => { console.log(`[${nombre}] [pageerror] ${e.message}`); errores.push(`[${nombre}] ${e.message}`); });
  p.on('console', m => registro.push(`[${nombre}] ${m.text().slice(0, 300)}`));
  if (nombre === 'B') {
    // §87: B como un perfil nuevo detrás del Worker (así le pasó al dueño en el sitio): sin los nombres de las pistas
    // guardados (las dos pestañas comparten el almacenamiento: A los guarda) y con el índice de las imágenes 3 s más
    // lento. El selector de sugerir tarda en dar su control y llegan estados mientras tanto: no tiene que abrir otro
    await p.addInitScript(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return k === 'mkw.pistas' ? null : g.call(this, k); }; });
    await p.route('**/indice.json', async r => { await espera(3000); await r.continue().catch(() => {}); });
    // cuántos selectores llegó a tener B a la vez (con el bug eran dos: uno quedaba encima de la pantalla de personaje)
    await p.addInitScript(() => {
      window.__maxSelectores = 0;
      const mirar = () => { window.__maxSelectores = Math.max(window.__maxSelectores, document.querySelectorAll('#elegirPista').length); };
      new MutationObserver(mirar).observe(document, { childList: true, subtree: true });
    });
  }
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uid}&sincro=${uidA},${uidB}&jefe=${uidA}` +
    `&semilla=4242&modo=sala&estilo=playlist&carreras=2&cc=c150&cpu=normal&limite=45`);
  return p;
}
const A = await abrir('A', uidA);
await espera(2000);
const B = await abrir('B', uidB);

const leer = p => Promise.race([new Promise(r => setTimeout(() => r(null), 8000)), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730), q = s => document.querySelector(s), qs = s => document.querySelectorAll(s);
  return { s: e.seccion, pagina: e.pagina, sala: window.mkwEstado.sala || null, eleccion: window.mkwEstado.eleccion || null,
    piloto: window.mkwEstado.piloto || null, ls: window.mkwSincro?.lockstep?.estado() || null,
    picker: q('#elegirPista')?.className || '', confirmar: !!q('#listaConfirmar'), nota: !!q('#elegirPista .sugerir-nota'),
    renglones: qs('#elegirPista .renglon').length, sugerencias: qs('#elegirPista .sugerencias:not(.mias):not([hidden]) .sugerencia').length,
    chip: q('#elegirPista .sug-chip:not([hidden])')?.textContent || '', mias: [...qs('#elegirPista .mias .estado')].map(x => x.textContent),
    breve: q('#playlistBreve') ? { agregar: !!q('#pbAgregar'), sugerir: !!q('#pbSugerir'), cab: q('#playlistBreve .pb-cab span')?.textContent || '',
      sigue: q('#playlistBreve li.sigue .num')?.textContent || '', nota: q('#playlistBreve .pb-nota')?.textContent || '' } : null,
    ganadora: L.u32(0x8043319C + 0x10), etapa: ri ? L.u32(ri + 0x28) : -1,
    aviso: q('#avisoJuego')?.hidden ? '' : q('#avisoJuego')?.textContent || '', cortina: !document.body.classList.contains('sin-cortina') };
})]).catch(() => null);
const esperarQue = async (p, cond, tope = 120000) => { for (const hasta = Date.now() + tope; Date.now() < hasta;) { const x = await leer(p); if (x && cond(x)) return x; await espera(500); } return await leer(p); };
const texto = l => (l || []).map(t => `${t.copa}.${t.fila}`).join(' ');
const foto = (p, n) => p.screenshot({ path: path.join(carpeta, n) }).catch(() => {});

try {
  // 1) A arma, B sugiere
  const a1 = await esperarQue(A, x => /modo-lista/.test(x.picker) && x.confirmar);
  ok('A (anfitriona) ve el selector para armar la playlist', /modo-lista/.test(a1?.picker || '') && a1.confirmar, `a los ${seg()}`);
  const b1 = await esperarQue(B, x => /modo-sugerir/.test(x.picker), 60000);
  ok('B ve el selector de SUGERIR (sin Confirmar)', /modo-sugerir/.test(b1?.picker || '') && b1.nota && !b1.confirmar, b1?.picker);
  await A.locator('#elegirPista .pista').nth(0).click();               // (copa 0, pista 0)
  const b2 = await esperarQue(B, x => x.renglones === 1, 20000);
  ok('lo que agrega A le aparece a B en «Lista de la sala»', b2?.renglones === 1 && texto(b2.sala?.lista?.pistas) === '0.0', texto(b2?.sala?.lista?.pistas));
  // 2) B sugiere, A acepta
  await B.locator('#elegirPista .pista').nth(9).click();               // (copa 2, pista 1)
  const a2 = await esperarQue(A, x => x.sugerencias === 1, 20000);
  const b3 = await esperarQue(B, x => (x.mias[0] || '').includes('Esperando'), 10000);
  ok('B sugiere: a A le llega con «💬 1» y a B le queda «⌛ Esperando»', a2?.sugerencias === 1 && a2.chip === '💬 1' && (b3?.mias[0] || '').includes('Esperando'),
     `A ${a2?.sugerencias} ${a2?.chip} · B ${b3?.mias}`);
  await foto(A, '1-A-sugerencia.png'); await foto(B, '1-B-sugiere.png');
  await A.locator('#elegirPista .sugerencia .mini.aceptar').first().click();
  const b4 = await esperarQue(B, x => (x.mias[0] || '').includes('En la lista') && x.renglones === 2, 20000);
  ok('A la acepta con ✓: entra al final y B la ve «✓ En la lista»', (b4?.mias[0] || '').includes('En la lista') && texto(b4?.sala?.lista?.pistas) === '0.0 2.1',
     `${b4?.mias} · ${texto(b4?.sala?.lista?.pistas)}`);
  // 3) A confirma: recién ahí se elige personaje
  await A.click('#listaConfirmar');
  const [a3, b5] = [await esperarQue(A, x => x.sala?.fase === 'elegir' && !x.picker, 20000), await esperarQue(B, x => x.sala?.fase === 'elegir' && !x.picker, 20000)];
  ok('A confirma: las dos pasan a elegir personaje con la playlist de 2 (y el selector de B se cierra solo)',
     [a3, b5].every(x => x?.sala?.fase === 'elegir' && !x.picker && texto(x.sala.pistas) === '0.0 2.1' && x.sala.carreras === 2), `${texto(b5?.sala?.pistas)} · B selector «${b5?.picker}»`);
  const maxB = await B.evaluate(() => window.__maxSelectores).catch(() => -1);
  ok('§87: B nunca tuvo dos selectores a la vez (nombres de las pistas lentos, como un perfil nuevo en el sitio)', maxB === 1, `máximo ${maxB}`);
  const elegir = async (p, derecha) => {
    let visto = false, ultimo = 0;
    for (const hasta = Date.now() + 90000; Date.now() < hasta;) {
      const x = await leer(p);
      if (x?.eleccion) return x;
      if (x && !x.cortina && !x.picker && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina)) {
        if (!visto && x.pagina === 0x6B) { visto = true; await espera(700); if (derecha) { await p.keyboard.down('KeyD'); await espera(150); await p.keyboard.up('KeyD'); await espera(400); } }
        if (Date.now() - ultimo > 1200) { ultimo = Date.now(); await p.keyboard.down('KeyK'); await espera(150); await p.keyboard.up('KeyK'); }
      }
      await espera(300);
    }
    return await leer(p);
  };
  const [ea, eb] = await Promise.all([elegir(A, false), elegir(B, true)]);
  ok('las dos eligieron en las pantallas del juego', !!(ea?.eleccion && eb?.eleccion));

  // 4) la carrera 1 y la playlist entre carreras
  const enCarrera = (x, n) => x?.s === 0x20 && x.piloto?.carrera === n && !x.cortina;
  const [ra, rb] = [await esperarQue(A, x => enCarrera(x, 1), 120000), await esperarQue(B, x => enCarrera(x, 1), 60000)];
  ok('la carrera 1 abrió en las dos con la pista 1 de la playlist', enCarrera(ra, 1) && enCarrera(rb, 1) && [ra, rb].every(x => x.ganadora === 0x100),
     `A ${hex(ra?.ganadora)} B ${hex(rb?.ganadora)} a los ${seg()}`);
  await esperarQue(A, x => x.etapa >= 2, 60000);
  await espera(4000);
  const [la, lb] = [await leer(A), await leer(B)];
  const f = Math.max(la?.ls?.cuadro || 0, lb?.ls?.cuadro || 0) + 180;
  await Promise.all([A, B].map(p => p.evaluate(c => window.mkwTerminarEn(c), f)));
  const [ba, bb] = [await esperarQue(A, x => x.breve, 60000), await esperarQue(B, x => x.breve, 30000)];
  ok('al terminar la 1, a las dos les aparece la playlist: «1 de 2 corridas», sigue la 2',
     [ba, bb].every(x => x?.breve?.cab === '1 de 2 corridas' && x.breve.sigue === '2'), `A ${JSON.stringify(ba?.breve)} · B ${JSON.stringify(bb?.breve)}`);
  ok('A tiene «+ Agregar pistas» y B «Sugerir pista»', ba?.breve?.agregar && !ba.breve.sugerir && bb?.breve?.sugerir && !bb.breve.agregar);
  await foto(A, '2-A-entre.png'); await foto(B, '2-B-entre.png');
  // 5) B sugiere desde ahí; A agrega (la sala espera) y sigue
  await B.click('#pbSugerir');
  await esperarQue(B, x => /modo-sugerir/.test(x.picker), 10000);
  await B.locator('#elegirPista .pista').nth(20).click();              // (copa 5, pista 0)
  await espera(500);
  await B.click('#sugerirListo');
  await A.click('#pbAgregar');
  const a5 = await esperarQue(A, x => /modo-lista/.test(x.picker) && x.sugerencias === 1, 20000);
  ok('A abre «+ Agregar pistas»: ve lo que viene (1) y la sugerencia de B', a5?.renglones === 1 && a5.sugerencias === 1, `${a5?.renglones} renglones, ${a5?.sugerencias} sugerencias`);
  const bEspera = await esperarQue(B, x => /agregando/.test(x.breve?.nota || ''), 10000);
  ok('B ve «El anfitrión está agregando pistas…»', /agregando/.test(bEspera?.breve?.nota || ''), bEspera?.breve?.nota);
  await espera(12000);                                                   // (más que los 9 s de resultados)
  const a6 = await leer(A);
  ok('pasados los resultados, la sala espera a A (sigue en la carrera 1)', a6?.sala?.carrera === 1 && a6.sala.pausa > 0, `carrera ${a6?.sala?.carrera}`);
  await A.locator('#elegirPista .sugerencia .mini.aceptar').first().click();
  await espera(500);
  await foto(A, '3-A-agrega.png');
  await A.click('#listaConfirmar');
  const [sa, sb] = [await esperarQue(A, x => enCarrera(x, 2), 60000), await esperarQue(B, x => enCarrera(x, 2), 60000)];
  ok('A sigue: la carrera 2 abre en las dos con la pista que venía (copa 2, pista 1)', enCarrera(sa, 2) && enCarrera(sb, 2) && [sa, sb].every(x => x.ganadora === 0x100 + 4 * 2 + 1),
     `A ${hex(sa?.ganadora)} B ${hex(sb?.ganadora)}`);
  ok('la playlist ya tiene 3 (la sugerida de B al final), igual en las dos', [sa, sb].every(x => texto(x?.sala?.pistas) === '0.0 2.1 5.0' && x.sala.carreras === 3),
     `A ${texto(sa?.sala?.pistas)} · B ${texto(sb?.sala?.pistas)}`);
  ok('al arrancar la carrera se van el panel y los selectores', [sa, sb].every(x => !x.breve && !x.picker));
  ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3).join(' | '));
} catch (e) {
  ok('la prueba terminó sin errores', false, e.message);
} finally {
  writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
  await navegador.close();
  servidor.kill();
}
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
