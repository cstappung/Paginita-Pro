// Diagnóstico: ¿qué se ve cuando el kart se cae de la pista y Lakitu lo rescata? (el dueño vio "una leve pantalla en
// negro", bitácora §68).
//
// Resumen: abre el juego en Contrarreloj (sin fantasma ni CPU) en una pista con bordes sin baranda, espera a que
// termine la cuenta regresiva y maneja solo: acelera y dobla (las teclas pasan por el mismo camino que una persona).
// Mientras, graba lo que Chrome MUESTRA (el "screencast" de las DevTools: cada imagen que llega a la pantalla, con su
// hora) y, cada 25 ms, el contador de cuadros del juego. Después se mide el brillo de cada imagen:
//   - si la pantalla se pone negra MIENTRAS el contador del juego sigue subiendo 60 por segundo, el negro lo dibuja el
//     juego (un fundido a propósito, o algo que el port dibuja mal);
//   - si el contador se queda quieto, el juego se trabó (cargando algo) y lo negro es lo que quedó en pantalla.
// Resultado (§68): es la transición del juego para el rescate de Lakitu: una cortina de rayas horizontales que se
// cierra (~0,5 s), negro (~1,4 s) y se abre (~0,5 s), con el juego corriendo a 60 cuadros por segundo todo el rato.
// Comprueba (5 puntos ✓/✗): que hubo rescate y la imagen volvió; que durante el negro el juego siguió a 60 cuadros/s
// (si un día se traba ahí, esto lo dice); que se cierra de a poco (la cortina, no un corte); que cada rescate dura
// lo mismo (lo cuenta el juego); y que la cortina tapa toda la imagen, bordes incluidos (con --ancho/--alto se prueba
// una ventana de otra forma: la página nunca estira la imagen, así que debe tapar todo igual).
// §79: la ventana se abre en 16:9 y cambia a --ancho×--alto YA EN CARRERA, como el marco del sitio (que cambia de tamaño
// después de cargar): SDL3 agranda el canvas a su recuadro con cada cambio de tamaño. Con la imagen estirada (el bug
// del dueño, ?aspecto=libre) la escena 3D llenaba ese recuadro y la cortina tapaba solo la franja 16:9 del medio.
// Por eso hay 6.º y 7.º punto: el canvas siguió a la ventana (la prueba reproduce el caso) y, fuera del negro, la imagen
// del juego es 16:9 (lo que sobra del canvas, negro): no estirada. Y la cortina se mide en los 4 bordes.
// Deja en build/web/datos/caida/: NNNN.jpg (las imágenes) y linea.json (hora, brillo y cuadro del juego, tramos).
//
// Uso:  node web/navegador/prueba-caida.mjs [--copa 4 --fila 3] [--plan "K+A:1800 K:5000"] [--segundos 22] [--ventana]
//   (por defecto SNES Rainbow Road: doblando a la izquierda desde la largada se cae ~3 veces en 22 s)
//   --plan: lo que se mantiene apretado y cuánto (K = acelerar, A/D = doblar, J = frenar); se repite hasta el final
//   --extra "&x=y": parámetros más para la página
//   --ancho N --alto N: el tamaño de la ventana en la carrera (por defecto 960×792; se abre en 960×540 y cambia)
//   --sin-cambiar: abrir ya en --ancho×--alto, sin el cambio de tamaño (como antes de §79)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, porDefecto) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : porDefecto; };
const COPA = Number(opcion('--copa', 4)), FILA = Number(opcion('--fila', 3));   // SNES Rainbow Road: bordes sin baranda
const PLAN = opcion('--plan', 'K+A:1800 K:5000').split(/\s+/).map(p => { const [t, ms] = p.split(':'); return { teclas: t.split('+'), ms: Number(ms) }; });
const SEGUNDOS = Number(opcion('--segundos', 22));
const PUERTO = Number(opcion('--puerto', 8131));
const TECLA = { K: 'KeyK', J: 'KeyJ', A: 'KeyA', D: 'KeyD', W: 'KeyW', S: 'KeyS', L: 'KeyL' };
const carpeta = path.join(raiz, 'build/web/datos/caida');
rmSync(carpeta, { recursive: true, force: true });
mkdirSync(carpeta, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));
let bien = 0, mal = 0;

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const ANCHO = Number(opcion('--ancho', 960)), ALTO = Number(opcion('--alto', 792));   // la ventana (con una ancha, el juego se estira: §68)
const CAMBIAR = !args.includes('--sin-cambiar');
const pagina = await navegador.newPage({ viewport: CAMBIAR ? { width: 960, height: 540 } : { width: ANCHO, height: ALTO } });
pagina.on('pageerror', e => console.log('[pageerror] ' + e.message));
let codigo = 1;
try {
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=tt&copa=${COPA}&fila=${FILA}&fantasma=0${opcion('--extra', '')}`);
  const llego = await pagina.waitForFunction(() => window.mkwEstado?.piloto, null, { timeout: 150000, polling: 500 }).then(h => h.jsonValue(), () => null);
  if (!llego?.llego) throw new Error('el piloto no llegó a la carrera');
  // la cuenta regresiva: Raceinfo +0x28 (0-1 presentación y cuenta, 2 corriendo)
  await pagina.waitForFunction(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730); return ri && L.u32(ri + 0x28) >= 2; }, null, { timeout: 60000, polling: 50 });
  const medirLienzo = () => pagina.evaluate(() => { const c = document.getElementById('canvas'), r = c.getBoundingClientRect(); return { w: c.width, h: c.height, cw: r.width, ch: r.height, x: r.left, y: r.top }; });
  const antes = await medirLienzo();
  if (CAMBIAR) { await pagina.setViewportSize({ width: ANCHO, height: ALTO }); await espera(1500); }   // como el marco del sitio
  const lienzo = await medirLienzo();
  console.log(`carrera andando; ventana ${ANCHO}×${ALTO}, canvas ${antes.w}×${antes.h} → ${lienzo.w}×${lienzo.h} (en pantalla ${lienzo.cw}×${lienzo.ch}); grabando…`);

  // lo que se muestra: el screencast (cada imagen compuesta que llega a la pantalla, con su hora en segundos)
  const cdp = await pagina.context().newCDPSession(pagina);
  const imagenes = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const n = imagenes.length;
    writeFileSync(path.join(carpeta, String(n).padStart(4, '0') + '.jpg'), Buffer.from(data, 'base64'));
    imagenes.push({ n, t: metadata.timestamp * 1000 });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  // el contador del juego, cada 25 ms, con la misma hora (Date.now en el navegador = la hora del screencast)
  await pagina.evaluate(() => {
    window.__caida = [];
    const L = window.mkwMenus;
    window.__caidaReloj = setInterval(() => {
      const ri = L.u32(0x809BD730);
      window.__caida.push([Date.now(), window.mkwCuadros(), ri ? L.u32(ri + 0x28) : -1]);
    }, 25);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 480, maxHeight: Math.round(480 * ALTO / ANCHO), everyNthFrame: 1 });

  const fin = Date.now() + SEGUNDOS * 1000;
  for (let i = 0; Date.now() < fin; i++) {
    const p = PLAN[i % PLAN.length];
    for (const t of p.teclas) await pagina.keyboard.down(TECLA[t]);
    await espera(Math.min(p.ms, fin - Date.now()));
    for (const t of p.teclas) if (!PLAN[(i + 1) % PLAN.length].teclas.includes(t)) await pagina.keyboard.up(TECLA[t]);
  }
  for (const t of Object.values(TECLA)) await pagina.keyboard.up(t);
  await cdp.send('Page.stopScreencast');
  const contador = await pagina.evaluate(() => { clearInterval(window.__caidaReloj); return window.__caida; });
  await espera(300);                                     // las últimas imágenes que estaban en camino

  // Dónde queda el canvas en la pantalla: agrandado sin deformarse (object-fit: contain) dentro de su recuadro; lo de
  // afuera son las barras negras de la página. En fracciones de la foto. Si SDL3 agrandó el canvas a su recuadro, llena
  // todo el recuadro. Adentro, la imagen 16:9 del juego (`img`): con force_16_9 (§79) lo que sobra del canvas son barras
  // negras de aurora; con la imagen estirada (?aspecto=libre), la escena llena el canvas entero.
  const esc = Math.min(lienzo.cw / lienzo.w, lienzo.ch / lienzo.h), vw = lienzo.w * esc, vh = lienzo.h * esc;
  const rect = { x: (lienzo.x + (lienzo.cw - vw) / 2) / ANCHO, y: (lienzo.y + (lienzo.ch - vh) / 2) / ALTO, w: vw / ANCHO, h: vh / ALTO };
  const iw = Math.min(vw, vh * 16 / 9), ih = Math.min(vh, vw * 9 / 16);
  const img = { x: rect.x + (vw - iw) / 2 / ANCHO, y: rect.y + (vh - ih) / 2 / ALTO, w: iw / ANCHO, h: ih / ALTO };
  const sobra = vw - iw > 4 || vh - ih > 4;              // ¿el canvas tiene otra forma que 16:9? (barras de aurora)
  // El brillo de cada imagen (0 negro … 255 blanco), medido en el mismo Chrome: el centro (80 %) de la imagen 16:9 del
  // juego (sin las barras: si no, una ventana alta oscurece el promedio), lo más claro de los 4 bordes del canvas (8 %
  // de su ancho o alto: si la cortina no tapara todo, ahí se vería) y lo que sobra del canvas fuera de la imagen 16:9
  for (let i = 0; i < imagenes.length; i += 60) {
    const lote = imagenes.slice(i, i + 60).map(im => readFileSync(path.join(carpeta, String(im.n).padStart(4, '0') + '.jpg')).toString('base64'));
    const brillos = await pagina.evaluate(async ({ lista, rect, img, sobra }) => {
      const c = new OffscreenCanvas(96, 80), g = c.getContext('2d', { willReadFrequently: true });
      const sal = [];
      for (const b64 of lista) {
        const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
        const medir = (x, y, w, h) => {
          g.clearRect(0, 0, 96, 80);
          g.drawImage(bmp, bmp.width * x, bmp.height * y, Math.max(1, bmp.width * w), Math.max(1, bmp.height * h), 0, 0, 96, 80);
          const d = g.getImageData(0, 0, 96, 80).data;
          let s = 0;
          for (let k = 0; k < d.length; k += 4) s += 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
          return s / (d.length / 4);
        };
        const bx = 0.08 * rect.w, by = 0.08 * rect.h;
        const bordes = Math.max(medir(rect.x, rect.y, bx, rect.h), medir(rect.x + rect.w - bx, rect.y, bx, rect.h),
                                medir(rect.x, rect.y, rect.w, by), medir(rect.x, rect.y + rect.h - by, rect.w, by));
        // fuera de la imagen 16:9: las dos franjas que sobran (arriba y abajo, o a los lados), un poco hacia adentro
        const fuera = !sobra ? 0 : img.h < rect.h - 0.004
          ? Math.max(medir(rect.x, rect.y, rect.w, (img.y - rect.y) * 0.8), medir(rect.x, img.y + img.h + (img.y - rect.y) * 0.2, rect.w, (img.y - rect.y) * 0.8))
          : Math.max(medir(rect.x, rect.y, (img.x - rect.x) * 0.8, rect.h), medir(img.x + img.w + (img.x - rect.x) * 0.2, rect.y, (img.x - rect.x) * 0.8, rect.h));
        sal.push([medir(img.x + 0.1 * img.w, img.y + 0.1 * img.h, 0.8 * img.w, 0.8 * img.h), bordes, fuera]);
      }
      return sal;
    }, { lista: lote, rect, img, sobra });
    brillos.forEach(([b, bordes, fuera], k) => { imagenes[i + k].brillo = b; imagenes[i + k].bordes = bordes; imagenes[i + k].fuera = fuera; });
  }
  // el cuadro del juego a la hora de cada imagen (la lectura del contador más cercana)
  const cuadroEn = t => { let mejor = contador[0]; for (const c of contador) if (Math.abs(c[0] - t) < Math.abs(mejor[0] - t)) mejor = c; return mejor[1]; };
  // Los tramos oscuros: brillo < 25 seguidos (con huecos de menos de 100 ms)
  const OSCURO = 25, tramos = [];
  for (const im of imagenes) {
    if (im.brillo >= OSCURO) continue;
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && im.t - ultimo.hasta < 100) { ultimo.hasta = im.t; ultimo.imagenes++; ultimo.negras += im.brillo < 3; }
    else tramos.push({ desde: im.t, hasta: im.t, imagenes: 1, negras: +(im.brillo < 3) });
  }
  const t0 = imagenes[0]?.t || 0;
  for (const tr of tramos) {
    tr.ms = tr.hasta - tr.desde;
    tr.cuadros = cuadroEn(tr.hasta) - cuadroEn(tr.desde);
    tr.ritmo = tr.ms > 0 ? tr.cuadros / (tr.ms / 1000) : 0;          // cuadros del juego por segundo durante el negro
    // cuánto tarda en cerrarse: el brillo de referencia es el de 0,6 a 0,9 s antes del negro total (justo antes de la
    // cortina; más atrás el kart todavía venía cayendo y la imagen cambia sola); desde la última imagen con ≥ 90 % de
    // esa referencia hasta la primera negra del todo
    const negra = imagenes.find(im => im.t >= tr.desde && im.brillo < 3);
    const ref = negra ? imagenes.filter(im => im.t >= negra.t - 900 && im.t <= negra.t - 600) : [];
    const normal = ref.length ? ref.reduce((s, im) => s + im.brillo, 0) / ref.length : 0;
    const empieza = negra ? imagenes.filter(im => im.t < negra.t && im.brillo >= normal * 0.9).pop() : null;
    tr.cierre = empieza && negra ? negra.t - empieza.t : 0;
    tr.vuelve = imagenes.filter(im => im.t > tr.hasta && im.t < tr.hasta + 1500).some(im => im.brillo >= Math.max(30, normal * 0.6));
    tr.cortado = imagenes[imagenes.length - 1].t - tr.hasta < 300;    // la grabación terminó en pleno negro: no se cuenta
    // ¿tapa toda la imagen? lo más claro de los dos bordes en el "corazón" del negro: las imágenes negras del todo en el
    // centro, dejando fuera los primeros y los últimos 100 ms (ahí todavía quedan las últimas rayas finas, que cruzan de
    // lado a lado y también se ven en los bordes)
    const negras = imagenes.filter(im => im.t >= tr.desde && im.t <= tr.hasta && im.brillo < 3);
    const corazon = negras.filter(im => im.t >= (negras[0]?.t ?? 0) + 100 && im.t <= (negras[negras.length - 1]?.t ?? 0) - 100);
    tr.bordes = Math.max(0, ...corazon.map(im => im.bordes));
    console.log(`  oscuro a los ${((tr.desde - t0) / 1000).toFixed(2)} s: ${tr.ms.toFixed(0)} ms (${tr.negras} imágenes negras del todo), ` +
                `el juego avanzó ${tr.cuadros} cuadros (${tr.ritmo.toFixed(1)}/s), se cerró en ${tr.cierre.toFixed(0)} ms, bordes ${tr.bordes.toFixed(1)}, ` +
                (tr.cortado ? 'cortado por el fin de la grabación' : tr.vuelve ? 'la imagen volvió' : 'NO volvió'));
  }
  writeFileSync(path.join(carpeta, 'linea.json'), JSON.stringify({ copa: COPA, fila: FILA, plan: PLAN, imagenes, contador, tramos }));
  console.log(`${imagenes.length} imágenes, ${contador.length} lecturas del contador → ${path.relative(raiz, carpeta)}`);

  const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
  const rescates = tramos.filter(tr => tr.ms >= 500 && !tr.cortado);
  ok('el kart se cayó y Lakitu lo rescató (pantalla oscura ≥ 0,5 s y después vuelve la imagen)', rescates.length >= 1 && rescates.every(tr => tr.vuelve),
     `${rescates.length} rescates`);
  ok('durante el negro el juego siguió a 60 cuadros por segundo (lo dibuja el juego: no es un tirón)', rescates.length >= 1 && rescates.every(tr => tr.ritmo >= 56 && tr.ritmo <= 63),
     rescates.map(tr => tr.ritmo.toFixed(1)).join(', ') + ' cuadros/s');
  ok('se cierra de a poco (la cortina de rayas del juego, ≥ 0,25 s), no de golpe', rescates.length >= 1 && rescates.every(tr => tr.cierre >= 250),
     rescates.map(tr => tr.cierre.toFixed(0) + ' ms').join(', '));
  const largos = rescates.map(tr => tr.ms);
  ok('cada rescate dura lo mismo (lo cuenta el juego en cuadros: diferencia ≤ 100 ms)', largos.length >= 2 ? Math.max(...largos) - Math.min(...largos) <= 100 : largos.length === 1,
     largos.map(ms => ms.toFixed(0) + ' ms').join(', '));
  ok(`la cortina tapa TODA la imagen del juego, también sus 4 bordes (ventana ${ANCHO}×${ALTO}, canvas en pantalla ${Math.round(vw)}×${Math.round(vh)})`,
     rescates.length >= 1 && rescates.every(tr => tr.bordes < 5), 'brillo de los bordes en el negro: ' + rescates.map(tr => tr.bordes.toFixed(1)).join(', '));
  if (CAMBIAR) {
    // 6: la prueba reproduce el caso del sitio: SDL3 agrandó el canvas a su recuadro al cambiar la ventana
    const sigue = Math.abs(lienzo.w / lienzo.h - lienzo.cw / lienzo.ch) < 0.02;
    ok('al cambiar la ventana en carrera, el canvas siguió a su recuadro (como en el marco del sitio)', sigue,
       `canvas ${antes.w}×${antes.h} → ${lienzo.w}×${lienzo.h}, recuadro ${Math.round(lienzo.cw)}×${Math.round(lienzo.ch)}`);
    // 7: fuera del negro, la imagen del juego es 16:9: lo que sobra del canvas (si tiene otra forma) queda negro
    const normales = imagenes.filter(im => im.brillo >= 30);
    const fuera = normales.length ? normales.reduce((s, im) => s + im.fuera, 0) / normales.length : 99;
    ok('la imagen del juego queda 16:9, sin estirarse: lo que sobra del canvas es negro (barras), también fuera del negro',
       !sobra || fuera < 5, sobra ? `imagen 16:9 ${Math.round(iw)}×${Math.round(ih)} en el canvas; brillo de lo que sobra: ${fuera.toFixed(1)} (en ${normales.length} imágenes)` : 'el canvas ya es 16:9: no sobra nada');
  }
  codigo = mal ? 1 : 0;
} catch (e) {
  console.log('✗ se cortó — ' + (e && e.stack || e));
} finally {
  console.log(`
${bien} bien, ${mal} mal`);
  await navegador.close().catch(() => {});
  servidor.kill();
  process.exit(codigo);
}
