// V7 (plan v4, etapa E6, bitácora §235): una sala de 12 con lo que hay — unos pocos juegos de verdad y el resto
// consolas de mentira.
//
// Resumen: 12 juegos en este PC irían cada uno a una fracción (prueba-doce.mjs), así que no dicen si la sala llena va
// fluida. Aquí la sala tiene 12 humanos: R juegos de verdad (por omisión 3; uno de ellos «teléfono de gama media» con el
// aparato de mentira de H1 y ?comoTelefono=1) y 12 − R consolas de mentira (banco/consola-falsa: el mismo lockstep y la
// misma malla WebRTC, botones grabados a 60 por segundo, sin el juego), cada una con la red mala de mentira de una casa
// cualquiera (?redMala). Por cada carrera (--carreras N, por omisión 3; cada una con la sala nueva):
//   - todas llegan: los juegos a la carrera (sección 0x20) y las consolas de mentira arrancan su reloj;
//   - en todos los juegos los 12 humanos son jugadores (tipo 0);
//   - durante --segundos s de carrera (por omisión 60, pasados los primeros 600 cuadros): cuadros de lógica por
//     segundo de cada juego (meta: 60, con margen de medida hasta 57), las esperas de más de 50 ms durante la
//     ventana y desde la largada hasta la meta (meta: 0), los refrescos del monitor (mkwEstado.vsync,
//     como medir-enlinea), el retraso y los relevos;
//   - las huellas iguales entre los juegos de verdad (la misma carrera);
//   - la meta por código en el mismo cuadro y los resultados en todos; ninguna página se cayó.
// Cada juego va en un Chrome independiente. El buzón HTTP local de prueba cruza perfiles; la malla WebRTC es real.
// Solo el Chrome del teléfono fuerza la comprobación de límites de Android; los PC conservan su configuración normal.
// Uso:  node web/navegador/prueba-sala-doce.mjs [--reales 3] [--carreras 3] [--segundos 60] [--sin-telefono]
//       [--puerto 8166] [--ventana] [--extra "&x=y"] [--pista 13.2] [--datos carpeta] (MKW_BUILD = otro build)
import { opcionesNavegador } from '../../herramientas/navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { crearBuzonHttp, instalarBuzon } from '../../banco/consola-falsa/buzon-http.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const N = 12;
const R = Math.max(2, Math.min(6, Number(opcion('--reales', 3))));
const CARRERAS = Math.max(1, Number(opcion('--carreras', 3)));
const SEGUNDOS = Math.max(10, Number(opcion('--segundos', 60)));
const PUERTO = Number(opcion('--puerto', 8166));
const PISTA = opcion('--pista', '13.2');
const EXTRA = opcion('--extra', '');
const TELEFONO = !args.includes('--sin-telefono');
// el teléfono de gama media simulado (H1, §155): la CPU 4 veces más lenta, el hilo del sonido, la caché ensuciada y la tarjeta
const GAMA_MEDIA = '&lastre=4&lastreAyuda=3&ladron=64&lastreGpu=6&comoTelefono=1';
// la red de cada consola de mentira: ms de demora, ± ms, % perdido (lo que le llega; ",ida" también lo que manda)
const CASAS = ['15,5,0', '25,8,0.5', '40,10,1', '60,20,2', '30,5,0', '80,30,3,ida', '20,10,1', '50,15,1,ida', '35,10,0.5', '45,10,1'];
const carpeta = path.resolve(raiz, opcion('--datos', 'build/web/datos/sala-doce'));
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
const buzon = await crearBuzonHttp();
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', `--window-position=${vx},${vy}`] });
const registro = [], resumen = [];

const leer = p => Promise.race([new Promise(r => setTimeout(() => r({ colgada: true }), 10000)), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ls = window.mkwSincro?.lockstep?.estado();
  const rd = L.u32(0x809BD728), esc = rd + 0x20, ri = L.u32(0x809BD730);
  const v = window.mkwEstado?.vsync || {};
  return { s: e.seccion, etapa: ri ? L.u32(ri + 0x28) : -1, t: performance.now(),
    ri, logica: ri ? L.u32(ri + 0x1C) + L.u32(ri + 0x20) : null, metaPrueba: window.mkwMetaPruebaV7,
    ultimaRed: ls?.fuera || ls?.desincronizado ? window.mkwRed?.registro?.filter(l => l.includes('[lockstep]')).slice(-20) : undefined,
    ls: ls && { cuadro: ls.cuadro, cuadros: ls.cuadros, esperas: ls.esperas, esperasLargas: ls.esperasLargas, maxEspera: ls.maxEspera,
                msEsperando: ls.msEsperando, retraso: ls.retraso, relevos: ls.relevos, huellasIguales: ls.huellasIguales,
                desincronizado: ls.desincronizado, autoridad: ls.autoridad, fuera: ls.fuera, tirones: ls.tirones || 0,
                esperando: ls.esperando },
    vs: { ref: v.refrescos, uno: v.unoJusto, rep: v.repetidos, sal: v.saltados },
    tipos: Array.from({ length: 12 }, (_, i) => L.u32(esc + 8 + i * 0xF0 + 0x10)) };
})]).catch(() => null);
const leerFalsa = p => Promise.race([new Promise(r => setTimeout(() => r(null), 5000)), p.evaluate(() => window.consola?.resumen())]).catch(() => null);

for (let carrera = 1; carrera <= CARRERAS; carrera++) {
  console.log(`\n=== carrera ${carrera} de ${CARRERAS} (${R} juegos de verdad${TELEFONO ? ', el último como teléfono de gama media' : ''}, ${N - R} consolas de mentira)`);
  const contexto = await navegador.newContext({ viewport: { width: 640, height: 360 } });
  await contexto.addInitScript(instalarBuzon, { url: buzon.url, streams: buzon.streams });
  const otrosChrome = [];
  const sala = `doce${carrera}-` + Date.now().toString(36);
  const uids = Array.from({ length: N }, (_, i) => `j${i}${sala}`);
  const caidas = [];
  const reales = [], falsas = [];
  // primero las consolas de mentira (no cargan nada: quedan esperando el primer paquete de botones de un juego)
  for (let i = R; i < N; i++) {
    const p = await contexto.newPage();
    p.on('pageerror', e => { caidas.push(`[falsa ${i}] ${e.message}`); registro.push(`[c${carrera} f${i}] pageerror ${e.message}`); });
    await p.goto(`http://127.0.0.1:${PUERTO}/banco/consola-falsa/index.html?sala=${sala}&uid=${uids[i]}&sincro=${uids.join(',')}&soloCarga=1&redMala=${CASAS[(i - R) % CASAS.length]}${EXTRA}`);
    falsas.push(p);
  }
  for (let i = 0; i < R; i++) {
    const tel = TELEFONO && i === R - 1;
    let ctx = contexto;
    if (i > 0) {
      const chrome = await chromium.launch({ ...opcionesNavegador(), headless: !args.includes('--ventana'),
        args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
          '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
          `--window-position=${vx},${vy}`, ...(tel ? ['--js-flags=--wasm-enforce-bounds-checks'] : [])] });
      otrosChrome.push(chrome);
      ctx = await chrome.newContext({ viewport: { width: 640, height: 360 }, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
      await ctx.addInitScript(instalarBuzon, { url: buzon.url, streams: buzon.streams });
    }
    const p = await ctx.newPage();
    p.on('pageerror', e => { caidas.push(`[${i}] ${e.message}`); registro.push(`[c${carrera} ${i}] pageerror ${e.message}`); });
    p.on('console', m => registro.push(`[c${carrera} ${i}] ${m.text().slice(0, 300)}`));
    await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uids[i]}&sincro=${uids.join(',')}` +
      // Las falsas no tienen huella: sin la decisión por islas, cualquier diferencia real falla de inmediato.
      `&modo=directa&pista=${PISTA}&semilla=${4242 + carrera}&cpu=normal&n8=0&islas=0${tel ? GAMA_MEDIA : ''}${EXTRA}`);
    reales.push({ p, i, tel });
    await espera(1500);
  }
  // 1) llegan
  const llego = Array(R).fill(0);
  for (const limite = Date.now() + 8 * 60000; Date.now() < limite && llego.some(x => !x);) {
    for (const r of reales) if (!llego[r.i]) { const x = await leer(r.p); if (x?.s === 0x20) { llego[r.i] = Date.now(); console.log(`  juego ${r.i}${r.tel ? ' (teléfono)' : ''}: en la carrera a los ${((Date.now() - t0) / 1000).toFixed(0)} s`); } }
    await espera(1000);
  }
  ok(`c${carrera}: los ${R} juegos llegaron a la carrera`, llego.every(Boolean), `${llego.filter(Boolean).length} de ${R}`);
  // El envío de una tecla también puede bloquearse si el hilo del juego no responde.
  const teclas = await Promise.all(reales.map(r => Promise.race([
    r.p.keyboard.down('KeyK').then(() => true, () => false),
    espera(10000).then(() => false),
  ])));
  ok(`c${carrera}: los juegos responden al teclado`, teclas.every(Boolean), teclas.join(','));
  if (teclas.some(x => !x)) {
    writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
    writeFileSync(path.join(carpeta, 'bloqueo.json'), JSON.stringify({ carrera, fase: 'teclado', teclas }, null, 2));
    // El supervisor externo termina este proceso y todos sus hijos si Chrome tampoco cierra.
    for (const chrome of otrosChrome) await chrome.close();
    await navegador.close(); servidor.kill(); buzon.cerrar(); process.exit(1);
  }
  // pasar los primeros 600 cuadros (la largada: cargas y la cuenta)
  let ultimaNota = 0;
  for (const limite = Date.now() + 5 * 60000; Date.now() < limite;) {
    const x = await Promise.all(reales.map(r => leer(r.p)));
    if (Date.now() - ultimaNota > 10000) {
      ultimaNota = Date.now();
      const f = await Promise.all(falsas.map(leerFalsa));
      const estado = { carrera, fase: 'largada', reales: x, falsas: f };
      writeFileSync(path.join(carpeta, 'progreso.json'), JSON.stringify(estado, null, 2));
      console.log(`  largada: juegos ${x.map(y => y?.colgada ? 'sin respuesta' : y?.ls?.cuadro ?? 'sin lockstep').join(', ')}; falsas ${f.map(y => y?.cuadro ?? 'sin respuesta').join(', ')}`);
    }
    // El teléfono necesita estar corriendo al comenzar el minuto común. No tiene que llegar a 600 cuadros.
    if (x.every((y, k) => y?.etapa === 2 && (reales[k].tel || (y.ls?.cuadro ?? -1) >= 600)) ||
        x.some((y, k) => y?.ls?.fuera || y?.ls?.desincronizado || (!reales[k].tel && y?.etapa >= 3))) break;
    await espera(2000);
  }
  const fa = await Promise.all(falsas.map(leerFalsa));
  ok(`c${carrera}: las ${N - R} consolas de mentira arrancaron y corren`, fa.every(f => f?.empezo && f.cuadro > 300), fa.map(f => f?.cuadro ?? '—').join(' '));
  const a = await Promise.all(reales.map(r => leer(r.p)));
  const tipos = a[0]?.tipos || [];
  ok(`c${carrera}: los 12 humanos son jugadores (tipo 0) en todos los juegos`, a.every(y => y?.tipos?.every(t => t === 0)), a.map(y => y?.tipos?.join('')).join(' · '));
  // 2) la ventana medida
  await espera(SEGUNDOS * 1000);
  const b = await Promise.all(reales.map(r => leer(r.p)));
  const fb = await Promise.all(falsas.map(leerFalsa));
  const medidas = reales.map((r, k) => {
    const A = a[k], B = b[k]; if (!A?.ls || !B?.ls) return { i: r.i, tel: r.tel, falta: true };
    const s = (B.t - A.t) / 1000, ref = (B.vs.ref - A.vs.ref) || 1;
    // El contador del lockstep deja de subir al salir de la carrera compartida; no es el fps propio del juego.
    const logicaValida = A.ri && A.ri === B.ri && A.etapa === 2 && B.etapa === 2 && B.logica > A.logica && s > 0;
    if (!logicaValida) return { i: r.i, tel: r.tel, falta: true, etapas: [A.etapa, B.etapa], esperando: B.ls.esperando };
    return { i: r.i, tel: r.tel, cuadrosPorSeg: logicaValida ? (B.logica - A.logica) / s : 0,
      sincronizadosPorSeg: (B.ls.cuadros - A.ls.cuadros) / s, fuera: B.ls.fuera,
      largas: B.ls.esperasLargas - A.ls.esperasLargas,
      esperaPendienteLarga: B.ls.esperando?.ms > 50,
      msEspPorCuadro: (B.ls.msEsperando - A.ls.msEsperando) / Math.max(1, B.ls.cuadros - A.ls.cuadros),
      maxEspera: B.ls.maxEspera, retraso: B.ls.retraso, relevos: B.ls.relevos - A.ls.relevos, tirones: B.ls.tirones - A.ls.tirones,
      unoJusto: 100 * (B.vs.uno - A.vs.uno) / ref, repetidos: 100 * (B.vs.rep - A.vs.rep) / ref, saltados: 100 * (B.vs.sal - A.vs.sal) / ref,
      huellas: B.ls.huellasIguales - A.ls.huellasIguales, desinc: B.ls.desincronizado };
  });
  for (const m of medidas) if (!m.falta) console.log(`  juego ${m.i}${m.tel ? ' (teléfono)' : ''}: ${m.cuadrosPorSeg.toFixed(1)} cuadros/s · esperas >50 ms ${m.largas} · espera ${m.msEspPorCuadro.toFixed(2)} ms/cuadro · retraso ${m.retraso} · relevos +${m.relevos} · tirones +${m.tirones} · refrescos: justo ${m.unoJusto.toFixed(1)} %, repetidos ${m.repetidos.toFixed(1)} %, saltados ${m.saltados.toFixed(1)} %`);
  const fMed = falsas.map((p, k) => ({ i: R + k, cps: fa[k] && fb[k] ? (fb[k].cuadro - fa[k].cuadro) / SEGUNDOS : 0, largas: (fb[k]?.esperasLargas ?? 0) - (fa[k]?.esperasLargas ?? 0), retraso: fb[k]?.retraso }));
  console.log(`  consolas de mentira: ${fMed.map(f => `${f.i}: ${f.cps.toFixed(1)}/s, >50 ms ${f.largas}, retraso ${f.retraso}`).join(' · ')}`);
  const pcs = medidas.filter(m => !m.tel && !m.falta), tel = medidas.find(m => m.tel && !m.falta);
  ok(`c${carrera}: los juegos de PC a 60 (≥ 57 cuadros de lógica por segundo en ${SEGUNDOS} s)`, pcs.length === R - (TELEFONO ? 1 : 0) && pcs.every(m => !m.fuera && m.cuadrosPorSeg >= 57 && m.sincronizadosPorSeg >= 57),
     pcs.map(m => m.cuadrosPorSeg.toFixed(1)).join(' '));
  ok(`c${carrera}: ninguna espera de más de 50 ms en el minuto medido en los PC`, pcs.length === R - (TELEFONO ? 1 : 0) &&
    pcs.every(m => m.largas === 0 && !m.esperaPendienteLarga), pcs.map(m => String(m.largas)).join(' · '));
  if (TELEFONO) ok(`c${carrera}: el teléfono simulado cumple su meta de 60 (≥ 57)`, !!tel && !tel.fuera && tel.cuadrosPorSeg >= 57 && tel.sincronizadosPorSeg >= 57 && tel.largas === 0 && !tel.esperaPendienteLarga,
    tel ? `${tel.cuadrosPorSeg.toFixed(1)} de lógica/s, ${tel.sincronizadosPorSeg.toFixed(1)} sincronizados/s, fuera ${JSON.stringify(tel.fuera)}, esperas >50 ms ${tel.largas}` : 'sin medida');
  ok(`c${carrera}: las consolas de mentira siguen el ritmo (≥ 55 por segundo)`, fMed.every(f => f.cps >= 55), fMed.map(f => f.cps.toFixed(1)).join(' '));
  ok(`c${carrera}: las huellas iguales entre los juegos de verdad`, medidas.every(m => !m.falta && m.huellas >= 3 && !m.desinc), medidas.map(m => m.huellas).join(' '));
  // 3) la meta por código (los 12 en el mismo cuadro) y los resultados
  await Promise.all(reales.map(r => r.p.keyboard.up('KeyK').catch(() => {})));
  const ahora = await Promise.all(reales.map(r => r.p.evaluate(() => window.mkwSincro?.lockstep?.estado().cuadro ?? 0).catch(() => 0)));
  const meta = Math.max(...ahora) + 300;
  await Promise.all(reales.map(r => r.p.evaluate(([c]) => { const ls = window.mkwSincro.lockstep;
    ls.enCuadro(ls.estado().carrera, c, () => {
      window.mkw._mkw_sala_terminar(0xFFF);
      window.mkwMetaPruebaV7 = c;
    }); return true; }, [meta]).catch(() => false)));
  let fin = [];
  for (const limite = Date.now() + 4 * 60000; Date.now() < limite;) {
    fin = await Promise.all(reales.map(r => leer(r.p)));
    if (fin.every(y => y && (y.etapa >= 4 || y.ls?.fuera))) break;
    await espera(3000);
  }
  ok(`c${carrera}: los juegos marcaron la meta de los 12 y pasaron a resultados`, fin.every(y => y?.metaPrueba === meta && y.etapa >= 4), fin.map(y => y?.colgada ? 'colgada' : `${y?.etapa}/${y?.metaPrueba ?? 'sin marca'}`).join(' '));
  const esperasCarrera = fin.map(y => y?.ls && { largas: y.ls.esperasLargas, maxMs: Math.round(y.ls.maxEspera), pendienteMs: y.ls.esperando?.ms ?? 0 });
  ok(`c${carrera}: ninguna espera de más de 50 ms en los juegos durante toda la carrera`,
    esperasCarrera.every(e => e && e.largas === 0 && e.pendienteMs <= 50),
    esperasCarrera.map(e => e ? `${e.largas} (máx ${e.maxMs} ms, abierta ${e.pendienteMs} ms)` : 'sin dato').join(' · '));
  const autoridades = [...new Set([...a, ...b, ...fin].map(y => y?.ls?.autoridad).filter(Boolean))];
  ok(`c${carrera}: las autoridades observadas fueron juegos de verdad`, autoridades.length > 0 && autoridades.every(u => uids.indexOf(u) >= 0 && uids.indexOf(u) < R),
    autoridades.map(u => uids.indexOf(u)).join(', '));
  ok(`c${carrera}: ninguna página se cayó`, !caidas.length, caidas.slice(0, 3).join(' | '));
  resumen.push({ carrera, medidas, falsas: fMed, esperasCarrera, autoridades, fin });
  writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
  writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify(resumen, null, 1));
  await Promise.all(reales.map((r, k) => r.p.locator('#canvas').screenshot({ path: path.join(carpeta, `c${carrera}-${r.i}.png`) }).catch(() => {})));
  for (const p of falsas) await p.evaluate(() => window.consola?.parar()).catch(() => {});
  await contexto.close();
  for (const chrome of otrosChrome) await chrome.close();
}
await navegador.close(); servidor.kill(); buzon.cerrar();
console.log(`\n${bien} bien, ${mal} mal  (${((Date.now() - t0) / 60000).toFixed(1)} min; en ${path.relative(raiz, carpeta).replaceAll('\\', '/')}/)`);
process.exit(mal ? 1 : 0);
