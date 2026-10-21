// Prueba del jugar.bat (bitácora §69): la experiencia entera, de punta a punta, en la página de Juegos de esta PC.
//
// Resumen: arranca el ensayo de herramientas/experiencia.mjs (los emuladores de Firebase con las reglas del sitio, las
// cuentas de mentira, el sitio como GitHub Pages y el Worker de verdad) en puertos y carpeta de prueba, y lo recorre
// como lo haría una persona, con tres "PC" (tres contextos de Chrome, cada uno con su sesión):
//   - invitado: el catálogo no muestra nada (Mario Kart solo lo ven los amigos; lo demás lo esconde el filtro local);
//   - Piloto Uno inicia sesión en la ventanita del emulador («Google» de mentira) y ve SOLO Mario Kart: su «un jugador»
//     y su sala;
//   - «Mario Kart Wii · un jugador» → el juego en el marco y el menú de inicio JloKart con la imagen privada (pedida al
//     Worker con el token del emulador, re-firmado, y el correo en la lista AMIGOS); Single Player → el menú «Un
//     jugador» del juego (0x69); las partidas conectadas con la nube (Storage del emulador);
//   - B hasta el título: vuelve el menú; Multiplayer → Online → Juegos abre la ficha de la sala de Mario Kart;
//   - Piloto Uno abre la sala (copa, hasta 4 pilotos), Piloto Dos entra con el enlace: los dos en el vestíbulo;
//   - Intruso (no es amigo): sin Mario Kart en el catálogo, «Este juego es privado» y «Esta sala es privada»;
//   - «¡A correr!» (§73, la sala sin Retro WFC): el juego de los dos se abre en la sala (modo=sala); la anfitriona arma
//     la copa con el selector de la página y Piloto Dos ve «El anfitrión está eligiendo la copa…»; cada uno elige
//     personaje y vehículo con las pantallas del juego; la carrera 1 abre directo en los dos, cada uno con SU
//     pantalla, sincronizados (las huellas coinciden): el buzón de la red pasa por la base del emulador con las reglas;
//   - §87: la ficha no pregunta cuántos pilotos (la sala nace con 4); al final la anfitriona echa a Piloto Dos (con la
//     carrera andando, o en el vestíbulo con --rapida): a él se le va el juego con el aviso y la carrera de Uno sigue.
// Fotos en build/web/datos/experiencia/. Tarda ~6-9 min (la carrera con dos juegos en el mismo PC).
//
// Uso:  node herramientas/prueba-experiencia.mjs [--ventana] [--rapida] [--ya] [--playlist]
//       --rapida: sin la carrera (~2 min).  --ya: usa un ensayo que ya está corriendo en 8154 (no arranca otro).
//       --playlist (§87): la sala en «Modo playlist» (como la abrió el dueño): la anfitriona arma una lista de 2 y la
//       confirma, Piloto Dos ve el selector de sugerir; después lo mismo que la copa (elegir, la carrera 1 en los dos).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dosFotosPartidas } from '../web/navegador/foto-pantalla.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const PUERTO = 8154, SITIO = `http://127.0.0.1:${PUERTO}`;   // el sitio en 8154 y su Worker en 8155
const carpeta = path.join(raiz, 'build/web/datos/experiencia');
fs.mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const foto = (p, nombre) => p.screenshot({ path: path.join(carpeta, nombre) }).catch(() => {});
const registro = [];
const matar = h => { if (!h || h.exitCode !== null) return; if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(h.pid), '/T', '/F']); else h.kill(); };

// 1) el ensayo (lo mismo que abre el jugar.bat, sin ventanas y sin tocar lo jugado: otra carpeta, empezando de cero)
let ensayo = null;
if (!args.includes('--ya')) {
  ensayo = spawn(process.execPath, [path.join(raiz, 'herramientas/experiencia.mjs'), '--sin-ventanas', '--puerto', String(PUERTO),
    '--carpeta', 'build/emuladores-prueba', '--limpiar', '--emu-desplazar', '10000'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const salida = [];
  await new Promise((listo, fallo) => {
    const reloj = setTimeout(() => fallo(new Error('el ensayo no arrancó en 4 min:\n' + salida.join(''))), 240000);
    const mira = d => { salida.push(String(d)); if (/Listo:/.test(String(d))) { clearTimeout(reloj); listo(); } };
    ensayo.stdout.on('data', mira); ensayo.stderr.on('data', mira);
    ensayo.once('exit', c => { clearTimeout(reloj); fallo(new Error(`el ensayo se cerró (código ${c}):\n${salida.join('')}`)); });
  }).catch(e => { console.log('✗ ' + e.message); process.exit(1); });
}

const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });

// Un "PC" nuevo (contexto vacío). Playwright se anuncia con navigator.webdriver y la página esconde el menú de inicio
// a las pruebas automáticas (§67): aquí se lo esconde, para ver lo mismo que una persona.
async function pc(nombre) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch {} });
  const p = await ctx.newPage();
  p.on('pageerror', e => registro.push(`[${nombre}] pageerror ${e.message}`));
  p.on('console', m => registro.push(`[${nombre}] ${m.type()} ${m.text().slice(0, 300)}`));
  await p.goto(SITIO + '/juegos.html');
  return p;
}
// «Iniciar sesión» → la ventanita del emulador → la cuenta
async function entrar(p, nombre) {
  await p.locator('#btnEntrar').waitFor({ timeout: 20000 });
  const [ventanita] = await Promise.all([p.waitForEvent('popup', { timeout: 15000 }), p.locator('#btnEntrar').click()]);
  await ventanita.waitForLoadState();
  // (si la cuenta no aparece, la foto de la ventanita dice por qué)
  await ventanita.locator(`text=${nombre}`).first().click()
    .catch(async e => { await ventanita.screenshot({ path: path.join(carpeta, `ventanita-${nombre.split(' ')[1] || nombre}.png`) }).catch(() => {}); throw e; });
  await p.waitForFunction(n => document.querySelector('#btnEntrar') === null || document.body.textContent.includes(n), nombre.split(' (')[0], { timeout: 20000 });
  await espera(2500);                                   // la lista de amigos (/soy) y el catálogo
}
// Las tarjetas del catálogo de Juegos
const tarjetas = p => p.$$eval('.jg-mn', l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
const hastaQue = async (fn, cond, ms, cada = 300) => {
  let v;
  for (const t0 = Date.now(); Date.now() - t0 < ms; await espera(cada)) { v = await fn().catch(() => null); if (v && cond(v)) return v; }
  return v ?? await fn().catch(() => null);
};
// Lo que interesa del juego en un marco: el menú de inicio, la cortina, el piloto, la nube
const mirar = marco => marco.evaluate(() => {
  const I = window.mkwInicio, e = window.mkwMenus ? window.mkwMenus.estado() : {};
  return {
    visible: !!I?.visible, imagen: I?.estado.imagen, opciones: I?.opciones || [], menu: I?.estado.menu,
    textos: [...document.querySelectorAll('#inicioJlo .ij-boton span')].map(t => t.textContent),
    arte: document.querySelector('#inicioJlo .ij-arte')?.naturalWidth || 0,
    cortina: !document.body.classList.contains('sin-cortina'), seccion: e.seccion, pagina: e.pagina,
    piloto: window.mkwEstado?.piloto || null, nubeLista: window.mkwEstado?.nubeLista, nube: window.mkwNube?.estado ?? null,
  };
});
const esJuego = u => /\/juegos\/mkw\/.*index\.html/.test(u);     // el marco del juego (juegos/mkw/web/navegador/index.html)
const marcoDel = (p, cond) => p.frames().find(f => esJuego(f.url()) && cond(f.url()));
const hastaMarco = async (p, cond, ms) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await espera(250)) { const f = marcoDel(p, cond); if (f) return f; } return null; };
const hex = n => '0x' + (n ?? -1).toString(16);

let codigo = 1;
try {
  // ---------- invitado ----------
  const invitado = await pc('invitado');
  await espera(4000);
  const tInv = await tarjetas(invitado);
  ok('invitado: el catálogo no muestra nada (Mario Kart solo para amigos; lo demás, escondido por el filtro local)', tInv.length === 0, tInv.join(' | '));
  await foto(invitado, '1-invitado.png');
  await invitado.context().close();

  // ---------- Piloto Uno ----------
  const uno = await pc('Piloto Uno');
  await entrar(uno, 'Piloto Uno');
  ok('Piloto Uno inicia sesión con la ventanita del emulador («Google» de mentira)', await uno.locator('#btnEntrar').count() === 0 || (await uno.textContent('body')).includes('Piloto Uno'));
  const tUno = await hastaQue(() => tarjetas(uno), t => t.length >= 2, 15000);
  ok('el catálogo muestra SOLO Mario Kart: su «un jugador» y su sala', tUno?.length === 2 && tUno.every(t => /Mario Kart Wii/.test(t)) && tUno.some(t => /un jugador/.test(t)),
     (tUno || []).map(t => t.slice(0, 45)).join(' | '));
  await foto(uno, '2-catalogo-amigo.png');

  // «Mario Kart Wii · un jugador»: la tarjeta → su ficha → ▶ Practicar
  await uno.locator('.jg-mn', { hasText: 'un jugador' }).first().click();
  await uno.locator('.jg-hoja-ya[data-f=juega]').click();
  let marco = await hastaMarco(uno, () => true, 20000);
  let m = marco && await hastaQue(() => mirar(marco), x => x.visible && x.arte > 0, 30000);
  ok('«un jugador»: el juego en su marco y el menú de inicio JloKart con la imagen privada (Worker: token del emulador + lista AMIGOS)',
     !!m?.visible && m.imagen === 200 && m.arte > 0 && JSON.stringify(m.textos) === '["Single Player","Multiplayer","Options"]',
     `ruta ${new URL(uno.url()).hash}, imagen ${m?.imagen}, botones ${m?.textos?.join(' · ')}`);
  await foto(uno, '3-menu-jlokart.png');

  // Single Player (con el mouse, como una persona) → el menú «Un jugador» del juego
  await marco.locator('#inicioJlo .ij-boton').first().click();
  m = await hastaQue(() => mirar(marco), x => x.piloto?.llego && !x.cortina, 240000, 500);
  ok('Single Player: el piloto deja el juego en su menú «Un jugador» (0x69)', !!m?.piloto?.llego && m.pagina === 0x69 && !m.cortina,
     `página ${hex(m?.pagina)}, sección ${hex(m?.seccion)}`);
  await foto(uno, '4-un-jugador.png');
  ok('las partidas quedaron conectadas con la nube de la cuenta (Storage del emulador, con sus reglas)', m?.nubeLista !== undefined && !!m?.nube,
     JSON.stringify(m?.nube)?.slice(0, 120));

  // B hasta el título del juego: vuelve el menú; Multiplayer → Online → Juegos abre la sala de Mario Kart
  for (let i = 0; i < 5 && !(await mirar(marco)).visible; i++) { await uno.keyboard.down('KeyJ'); await espera(110); await uno.keyboard.up('KeyJ'); await espera(2500); }
  m = await hastaQue(() => mirar(marco), x => x.visible, 8000);
  await marco.locator('#inicioJlo .ij-boton').nth(1).click();
  await espera(400);
  const opciones = (await mirar(marco)).opciones;
  await marco.locator('#inicioJlo .ij-boton', { hasText: 'Online' }).click();
  const ficha = await uno.locator('.jg-hoja-ya[data-f=sala]').waitFor({ timeout: 10000 }).then(() => true, () => false);
  ok('B hasta el título → vuelve el menú; Multiplayer → Online: Juegos abre la ficha de la sala de Mario Kart',
     !!m?.visible && JSON.stringify(opciones) === '["local","salas","volver"]' && ficha, `menú ${m?.visible}, ${opciones.join('/')}, ficha ${ficha}`);
  await foto(uno, '5-ficha-sala.png');
  // §87: la ficha no pregunta cuántos pilotos (la sala nace con el máximo, pedido del dueño); el modo sí
  const opsFicha = await uno.$$eval('.jg-hoja-ops select', l => l.map(s => s.dataset.op)).catch(() => []);
  ok('§87: la ficha no pregunta cuántos pilotos (la sala nace con 4); sí el modo', !opsFicha.includes('cupo') && opsFicha.includes('estilo'), opsFicha.join(', '));

  // la sala: Piloto Uno la abre (copa, hasta 4 pilotos)
  await uno.locator('.jg-hoja-ya[data-f=sala]').click();
  await uno.waitForFunction(() => /#p\//.test(location.hash) && document.querySelector('.jg-mkw-empieza'), null, { timeout: 20000 }).catch(() => {});
  const enlace = uno.url();
  const vUno = (await uno.textContent('.jg-mkw-vest').catch(() => '')).replace(/\s+/g, ' ');
  ok('Piloto Uno abre la sala de Mario Kart (copa): el vestíbulo y «¡A correr!»', /#p\//.test(enlace) && /Piloto Uno/.test(vUno) && /¡A correr!/.test(vUno), vUno.slice(0, 90));

  // Piloto Dos (otro PC) entra con el enlace
  const dos = await pc('Piloto Dos');
  await entrar(dos, 'Piloto Dos');
  await dos.goto(enlace);
  await dos.getByRole('button', { name: /Unirse a la partida/ }).click({ timeout: 20000 });
  const v2 = await hastaQue(async () => [await uno.textContent('.jg-mkw-vest'), await dos.textContent('.jg-mkw-vest')].map(t => t.replace(/\s+/g, ' ')),
    ([a, b]) => /2 de 12/.test(a) && /2 de 12/.test(b) && /Piloto Dos/.test(a), 20000);
  // (§91, C9: la sala nace con 12 lugares; hasta §87 eran 4)
  ok('Piloto Dos entra con el enlace: los dos en el vestíbulo («2 de 12»)', !!v2 && /2 de 12/.test(v2[0]) && /2 de 12/.test(v2[1]) && /Piloto Dos/.test(v2[0]),
     v2 && v2[1].slice(0, 90));
  await foto(dos, '6-vestibulo-dos.png');

  // Intruso: ni el catálogo, ni «un jugador», ni la sala (aunque tenga el enlace)
  const intruso = await pc('Intruso');
  await entrar(intruso, 'Intruso');
  const tIn = await tarjetas(intruso);
  await intruso.goto(SITIO + '/juegos.html#solo/mkw');
  const privadoSolo = await intruso.waitForFunction(() => /Este juego es privado/.test(document.body.textContent), null, { timeout: 15000 }).then(() => true, () => false);
  await foto(intruso, '7-intruso.png');
  await intruso.goto(enlace);
  const privadaSala = await intruso.waitForFunction(() => /Esta sala es privada/.test(document.body.textContent), null, { timeout: 15000 }).then(() => true, () => false);
  const marcoIntruso = intruso.frames().some(f => esJuego(f.url()));
  ok('Intruso (no es amigo): sin Mario Kart en el catálogo, «Este juego es privado» y «Esta sala es privada» (sin el juego)',
     tIn.length === 0 && privadoSolo && privadaSala && !marcoIntruso, `tarjetas ${tIn.length}, solo ${privadoSolo}, sala ${privadaSala}, marco ${marcoIntruso}`);
  await intruso.context().close();

  // M22: la precarga del vestíbulo: la página de cada uno baja el juego escondida (sin arrancarlo) y la fila de cada
  // piloto dice cómo va («⬇ 40 %» → «● listo», por la presencia del buzón de la sala)
  const pre = await hastaQue(async () => (await uno.locator('.jg-mkw-vest .jg2-pre').allTextContents().catch(() => [])).join(' '),
    t => (t.match(/● listo/g) || []).length >= 2, 120000, 1000);
  await foto(uno, '6-precarga-uno.png');
  ok('M22: la precarga: en el vestíbulo de la anfitriona los dos pilotos dicen «● listo»', (pre?.match(/● listo/g) || []).length >= 2, pre || '(nada)');

  // --playlist (§87): la playlist como la abrió el dueño (el modo en el vestíbulo y «¡A correr!»): los dos tienen que
  // llegar a su selector (la anfitriona arma la lista, Piloto Dos sugiere), confirmar, elegir y correr la carrera 1
  const enPlaylist = args.includes('--playlist');
  if (enPlaylist) {
    // (M21: las opciones están detrás de «✎ Cambiar»; el titular de la ficha dice «Playlist · 150cc · CPU máximo»)
    await uno.locator('.jg-mkw-vest [data-cambiar]').click();
    await uno.locator('.jg-mkw-modo[data-e=playlist]').click();
    const vp = await hastaQue(() => dos.textContent('.jg-mkw-vest'), t => /Playlist ·/.test(t), 15000);
    ok('la anfitriona pasa la sala a «Playlist» y Piloto Dos lo ve en el titular', /Playlist ·/.test(vp || ''));
  }
  if (!args.includes('--rapida')) {
    // «¡A correr!» (§73): el juego de los dos se abre en la sala (modo=sala), sin nada del Wi-Fi del juego
    await uno.locator('.jg-mkw-empieza').click();
    const enSala = u => new URL(u).searchParams.get('modo') === 'sala';
    const [mA, mB] = await Promise.all([hastaMarco(uno, enSala, 30000), hastaMarco(dos, enSala, 30000)]);
    const qA = mA && new URL(mA.url()).searchParams, qB = mB && new URL(mB.url()).searchParams;
    ok('«¡A correr!»: el juego se abre en la sala de los dos (modo=sala, la misma semilla, anfitriona Piloto Uno)',
       !!mA && !!mB && qA.get('semilla') === qB.get('semilla') && qA.get('jefe') === qB.get('jefe') && qA.get('jefe') === qA.get('uid'),
       mA ? `${qA.get('estilo')}, ${qA.get('carreras')} carreras, ${qA.get('cc')}` : '');
    // lo que interesa del juego en cada marco (como prueba-sala.mjs)
    const leer = f => Promise.race([espera(10000).then(() => null), f.evaluate(() => {
      const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
      const esc = L.u32(0x809BD728) + 0x20;
      const aviso = document.getElementById('avisoJuego');
      return { s: e.seccion, pagina: e.pagina, ls: window.mkwSincro?.lockstep?.estado() || null, sala: window.mkwEstado?.sala || null,
        eleccion: window.mkwEstado?.eleccion || null, carrera: window.mkwEstado?.piloto?.carrera,
        picker: !!document.getElementById('elegirPista'), modoPicker: document.getElementById('elegirPista')?.className || '',
        confirmar: !!document.getElementById('listaConfirmar'), aviso: aviso && !aviso.hidden ? aviso.textContent : '',
        tipos: [0, 1, 2].map(i => L.u32(esc + 8 + i * 0xF0 + 0x10)), pantalla: L.u8(esc + 0xB64),
        cortina: !document.body.classList.contains('sin-cortina') };
    })]).catch(() => null);
    const esperarQue = async (f, cond, tope) => { for (const hasta = Date.now() + tope; Date.now() < hasta; await espera(500)) { const x = await leer(f); if (x && cond(x)) return x; } return await leer(f); };
    // las teclas van al marco del juego: se le da el foco (como el clic de una persona en el juego)
    const foco = async f => { const el = await f.frameElement().catch(() => null); await el?.focus().catch(() => {}); await f.evaluate(() => window.focus()).catch(() => {}); };
    const tecla = async (p, t, ms = 150) => { await p.keyboard.down(t); await espera(ms); await p.keyboard.up(t); };

    if (enPlaylist) {
      // 1) la playlist: la anfitriona arma la lista y Piloto Dos ve el selector de sugerir (§74)
      const a1 = mA && await esperarQue(mA, x => /modo-lista/.test(x.modoPicker) && x.confirmar, 90000);
      const b1 = mB && await esperarQue(mB, x => /modo-sugerir/.test(x.modoPicker), 60000);
      ok('playlist: la anfitriona ve el selector para armar la lista y Piloto Dos el de sugerir',
         /modo-lista/.test(a1?.modoPicker || '') && /modo-sugerir/.test(b1?.modoPicker || ''), `A «${a1?.modoPicker}» · B «${b1?.modoPicker}» ${b1?.aviso || ''}`);
      const [a2, b2] = [mA && await esperarQue(mA, x => x.s === 0x49 && !x.cortina, 120000), mB && await esperarQue(mB, x => x.s === 0x49 && !x.cortina, 60000)];
      ok('el juego de los dos arrancó directo en la pantalla de personaje (sección 0x49), sin el título ni las licencias',
         [a2, b2].every(x => x?.s === 0x49 && x.pagina === 0x6B), `A ${hex(a2?.s)} página ${hex(a2?.pagina)} · B ${hex(b2?.s)} página ${hex(b2?.pagina)}`);
      await foto(uno, '8-playlist-uno.png'); await foto(dos, '8-sugerir-dos.png');
      // dos pistas (copa 0 pista 0, copa 2 pista 1) y «Confirmar la playlist»
      await mA.locator('#elegirPista .pista').nth(0).click();
      await espera(400);
      await mA.locator('#elegirPista .pista').nth(9).click();
      await espera(600);
      await mA.click('#listaConfirmar');
      const [a3, b3] = [await esperarQue(mA, x => x.sala?.fase === 'elegir' && !x.picker, 20000), await esperarQue(mB, x => x.sala?.fase === 'elegir' && !x.picker, 20000)];
      ok('la anfitriona confirma: los dos pasan a elegir personaje (el selector de Piloto Dos se cierra solo)',
         [a3, b3].every(x => x?.sala?.fase === 'elegir' && !x.picker && x.sala.carreras === 2), `A ${a3?.sala?.fase} · B ${b3?.sala?.fase} selector ${b3?.picker}`);
    } else {
      // 1) la copa: la anfitriona ve el selector de la página, Piloto Dos el aviso
      const a1 = mA && await esperarQue(mA, x => x.picker, 60000);
      const b1 = mB && await esperarQue(mB, x => /eligiendo la copa/.test(x.aviso), 60000);
      ok('la anfitriona ve el selector de copa de la página y Piloto Dos «El anfitrión está eligiendo la copa…»', !!a1?.picker && /eligiendo la copa/.test(b1?.aviso || ''), b1?.aviso || '');
      const [a2, b2] = [mA && await esperarQue(mA, x => x.s === 0x49 && !x.cortina, 120000), mB && await esperarQue(mB, x => x.s === 0x49 && !x.cortina, 60000)];
      ok('el juego de los dos arrancó directo en la pantalla de personaje (sección 0x49), sin el título ni las licencias',
         [a2, b2].every(x => x?.s === 0x49 && x.pagina === 0x6B), `A ${hex(a2?.s)} página ${hex(a2?.pagina)} · B ${hex(b2?.s)} página ${hex(b2?.pagina)}`);
      await foto(uno, '8-copa-uno.png'); await foto(dos, '8-espera-dos.png');
      // (§74: el selector de copas: «Una al azar» marca una copa y «Jugar la Copa N» la confirma)
      await mA.click('#copaAzar');
      await espera(300);
      await mA.click('#copaJugar');
    }

    // 2) cada uno elige personaje, vehículo y derrape con las pantallas del juego (Piloto Dos, antes, uno a la derecha)
    const elegir = async (p, f, derecha) => {
      let visto = false, ultimo = 0;
      for (const hasta = Date.now() + 90000; Date.now() < hasta; await espera(300)) {
        const x = await leer(f);
        if (x?.eleccion) return x;
        if (x && !x.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina)) {
          if (!visto && x.pagina === 0x6B) { visto = true; await foco(f); await espera(700); if (derecha) { await tecla(p, 'KeyD'); await espera(400); } }
          if (Date.now() - ultimo > 1200) { ultimo = Date.now(); await foco(f); await tecla(p, 'KeyK'); }
        }
      }
      return await leer(f);
    };
    const [ea, eb] = await Promise.all([elegir(uno, mA, false), elegir(dos, mB, true)]);
    ok('los dos eligieron personaje y vehículo con las pantallas del juego (otro personaje cada uno)',
       !!(ea?.eleccion && eb?.eleccion) && ea.eleccion.personaje !== eb.eleccion.personaje, `A ${JSON.stringify(ea?.eleccion)} · B ${JSON.stringify(eb?.eleccion)}`);

    // 3) la carrera 1: directo en los dos, cada uno con su pantalla, la misma carrera
    const enCarrera = x => x?.s === 0x20 && x.carrera === 1 && !x.cortina;
    const t0 = Date.now();
    const [ra, rb] = [await esperarQue(mA, enCarrera, 180000), await esperarQue(mB, enCarrera, 60000)];
    ok('la carrera 1 abrió directo en los dos (sección 0x20), los dos como jugadores de verdad y cada uno con SU pantalla',
       enCarrera(ra) && enCarrera(rb) && [ra, rb].every(x => x.tipos[0] === 0 && x.tipos[1] === 0 && x.tipos[2] === 1) && ra.pantalla === 0 && rb.pantalla === 1,
       `A ${hex(ra?.s)} tipos ${ra?.tipos} pantalla ${ra?.pantalla} · B ${hex(rb?.s)} pantalla ${rb?.pantalla} (a los ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    await foco(mA); await uno.keyboard.down('KeyK'); await foco(mB); await dos.keyboard.down('KeyK');
    const x = await hastaQue(async () => [await leer(mA), await leer(mB)], ([a, b]) => (a?.ls?.huellasIguales || 0) >= 3 && (b?.ls?.cuadro || 0) > 600, 120000, 2000);
    // (la foto del marco del juego solo: el detector busca la costura a media altura de la imagen del juego)
    // (§79: dos fotos separadas 1,5 s con los karts acelerando: una costura de verdad sigue ahí, un borde de la pista
    // —la raya de la largada— baja por la imagen)
    const fotoMarco = async (f, nombre) => (await f.frameElement().catch(() => null))?.screenshot({ path: path.join(carpeta, nombre) }).catch(() => null);
    let na = 0, nb = 0;
    const [pa, pb] = await Promise.all([dosFotosPartidas(uno, () => fotoMarco(mA, `9-carrera-uno${na++ ? '-b' : ''}.png`)),
                                        dosFotosPartidas(dos, () => fotoMarco(mB, `9-carrera-dos${nb++ ? '-b' : ''}.png`))]);
    await uno.keyboard.up('KeyK'); await dos.keyboard.up('KeyK');
    // M22: al empezar la copa, la sala pasó sola al modo inmersivo del sitio (el marco llena la pantalla) en los dos
    const inm = p => p.evaluate(() => document.documentElement.classList.contains('jg-inm')).catch(() => null);
    const [iUno, iDos] = [await inm(uno), await inm(dos)];
    await foto(uno, '9-inmersivo-uno.png');
    ok('M22: al empezar la copa la sala pasó sola al modo inmersivo (en los dos)', iUno === true && iDos === true, `Uno ${iUno} · Dos ${iDos}`);
    // (para usar la tira —echar— la anfitriona sale del inmersivo con «Salir», como una persona)
    if (iUno) await uno.click('#jgInm').catch(() => {});
    // (M21: la tira del vestíbulo con la copa andando, la de la anfitriona: el titular, «2 de 12», las fichas con su «⋯»)
    await uno.locator('.jg-mkw-vest').screenshot({ path: path.join(carpeta, '9-tira-uno.png') }).catch(() => {});
    ok('la misma carrera en los dos: las huellas coinciden y ninguno se separó', (x?.[0]?.ls?.huellasIguales || 0) >= 3 && !x?.[0]?.ls?.desincronizado && !x?.[1]?.ls?.desincronizado,
       `huellas iguales ${x?.[0]?.ls?.huellasIguales}, cuadro A ${x?.[0]?.ls?.cuadro}, B ${x?.[1]?.ls?.cuadro}`);
    ok('en la página de cada uno se ve UNA vista (la de su kart), no la pantalla partida', pa && pb && !pa.partida && !pb.partida && !pa.vacia && !pb.vacia,
       `costura en el medio: A ${pa?.pico}/${pa?.segunda?.pico} (típico ${pa?.tipico}), B ${pb?.pico}/${pb?.segunda?.pico} (típico ${pb?.tipico}); barras recortadas A ${pa?.barras} B ${pb?.barras} px`);
  }

  // §87: echar. La anfitriona saca a Piloto Dos con «Echar» (en la prueba larga, con la carrera andando): a Dos se le va
  // el juego y ve el aviso; la sala de Uno queda de 1 y, si había carrera, sigue sin esperarlo
  const enSalaJuego = u => new URL(u).searchParams.get('modo') === 'sala';
  const marcoA = marcoDel(uno, enSalaJuego);
  const lsDe = f => f.evaluate(() => window.mkwSincro?.lockstep?.estado() || null).catch(() => null);
  const cuadroAntes = marcoA ? ((await lsDe(marcoA))?.cuadro || 0) : 0;
  uno.once('dialog', d => d.accept());
  // (M22: en el modo inmersivo la tira no se ve: la anfitriona sale con «Salir»)
  if (await uno.evaluate(() => document.documentElement.classList.contains('jg-inm')).catch(() => false)) await uno.click('#jgInm').catch(() => {});
  // (M21: «Echar» está en el menú «⋯» de cada piloto, en el vestíbulo y en la tira de la carrera)
  await uno.locator('.jg-mkw-vest [data-menu]').first().click({ timeout: 10000 });
  await uno.locator('.jg-mkw-echa').first().click({ timeout: 10000 });
  const vDos = (await hastaQue(() => dos.textContent('.jg-mkw-vest'), t => /te sacó/.test(t), 15000) || '').replace(/\s+/g, ' ');
  const vUno2 = (await hastaQue(() => uno.textContent('.jg-mkw-vest'), t => /1 de 12/.test(t.replace(/\s+/g, ' ')), 10000) || '').replace(/\s+/g, ' ');
  const marcoDos = await hastaQue(async () => marcoDel(dos, enSalaJuego) ? 'sigue' : 'sin juego', v => v === 'sin juego', 10000);
  await foto(dos, '10-echado-dos.png');
  const inmDos = await dos.evaluate(() => document.documentElement.classList.contains('jg-inm')).catch(() => null);
  ok('§87: la anfitriona echa a Piloto Dos: a él se le va el juego (y el modo inmersivo) y ve «El anfitrión te sacó de esta sala»; la sala de Uno queda de 1',
     /te sacó/.test(vDos) && /1 de 12/.test(vUno2) && marcoDos === 'sin juego' && inmDos === false,
     `Dos: «${vDos.slice(-70)}» · Uno «1 de 12» ${/1 de 12/.test(vUno2)} · Dos ${marcoDos}, inmersivo ${inmDos}`);
  if (marcoA && cuadroAntes > 0) {
    await espera(5000);
    const ls = await lsDe(marcoA);
    ok('§87: con la carrera andando, la de Uno sigue sin esperar al echado (lo corta al momento)', !!ls && ls.cuadro > cuadroAntes + 120 && !ls.desincronizado,
       `cuadro ${cuadroAntes} → ${ls?.cuadro}, cortes ${JSON.stringify(ls?.cortes)}`);
  }
  codigo = mal ? 1 : 0;
} catch (e) {
  console.log('✗ la prueba se cortó — ' + (e && e.stack || e));
} finally {
  console.log(`\n${bien} bien, ${mal} mal  (fotos en build/web/datos/experiencia/)`);
  fs.writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
  await navegador.close().catch(() => {});
  matar(ensayo);
  // (§87: el emulador de la base —java— a veces sobrevive al árbol del ensayo y deja su puerto tomado para la próxima
  // vez. Los puertos + 10000 son solo de esta prueba: se cierra lo que siga escuchando en ellos)
  if (ensayo && process.platform === 'win32') {
    const propios = new Set([19099, 19000, 19199, 14400, 14500].map(String));
    const pids = new Set(spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).stdout.split('\n')
      .map(l => l.trim().split(/\s+/)).filter(c => c[3] === 'LISTENING' && propios.has(c[1].split(':').pop())).map(c => c[4]));
    for (const pid of pids) spawnSync('taskkill', ['/pid', pid, '/T', '/F']);
  }
  process.exit(codigo);
}
