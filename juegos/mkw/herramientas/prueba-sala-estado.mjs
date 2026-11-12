// La sala «Cada uno su kart» con el juego de verdad (bitácora §275b): la sala de siempre (?modo=sala: copa, elegir en
// la pantalla de personajes, la ficha de la página, carreras abiertas por código) con ?red=estado = la carrera SIN
// lockstep, en línea por la red nativa del juego (RKNet) y el DWC falso (red_estado_nativo.cpp + red-estado-sala.mjs).
//
// Resumen: A es la anfitriona; B la otra consola: una pestaña de este PC o, con --telefono, el teléfono por el marco
// seguro (herramientas/telefono-seguro.mjs: pestaña de incógnito al frente con el medidor, la pantalla prendida y
// devuelta, foto antes/después; la señal del banco cruza entre los navegadores por puente-contextos.mjs). La anfitriona
// fija la copa (--pistas, por omisión Luigi Circuit), cada uno elige con las pantallas del juego (tecla A / dedo), y en
// cada carrera, desde el «¡YA!», los dos sueltan el acelerador 1 s a los 1,5 s (la respuesta del botón) y después siguen
// la ruta de las CPU (piloto-ruta.mjs). La sonda (red-estado.mjs) anota la posición de cada kart en cada cuadro. Se mide:
//   - que la carrera abra en línea (Racedata modo 7) con 12 karts, y que los paquetes RACE crucen en los dos sentidos;
//   - el botón propio (cuadros hasta frenar), el error y el atraso del kart remoto, la lógica/s de cada uno y la
//     ventaja de A (cuadros de carrera de A − B cada 2 s), imágenes/s y 1 % bajo de B;
//   - con --lockstep, la MISMA prueba en la sala de siempre (sin ?red=estado, con ?sonda=1): para comparar.
// Uso:  MKW_BUILD=build/web-275/navegador node herramientas/prueba-sala-estado.mjs [--telefono] [--lockstep]
//         [--pistas 0.0] [--segundos 30] [--extra "&…"] [--etiqueta X]      (con el candado: QUIEN=red-estado)
// Salida: build/web/datos/red-estado/sala-<etiqueta>.json (y la corrida del teléfono en build/web/datos/telefono/<fecha>)
import { opcionesNavegador } from './navegador.mjs';   // §289: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';
import { dedos, manejar } from './piloto-ruta.mjs';
import { abrir, crearAdb, buscarAdb, conectarPlaywright, recuerdoPantalla } from './telefono-seguro.mjs';
import { crearTurn } from './turn-local.mjs';
import { errorTrayectoria, atrasoDeVista, ritmo, cuadrosDeRespuesta, distancia, posicionEn } from '../web/navegador/red-estado.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const TELEFONO = process.argv.includes('--telefono'), LOCKSTEP = process.argv.includes('--lockstep'), PERFIL = process.argv.includes('--perfil'), VIGILAR = process.argv.includes('--vigilar');
const DNF = process.argv.includes('--dnf');
const FOTO = process.argv.includes('--foto');
const CALIBRAR = process.argv.includes('--calibrar');   // (3c, §274) B aprieta «⚡ Auto calibración» en la 1.ª carrera: sin lockstep calibra con la carrera andando, sin pausar a A   // (3c) una foto de cada pantalla a los 4 s de la carrera: los nombres y los Mii sobre los karts   // (3c) en la última carrera el humano de B no llega: lo termina el plazo DNF de SU consola
const PUERTO = TELEFONO ? 8140 : Number(opcion('--puerto', 8165));
// El teléfono no está en la red del PC (el Oppo por WiFi 192.168.68.x, el PC por cable 192.168.4.x, sin STUN: el WebRTC
// directo se queda «comprobando» y la PC larga sola). Con --telefono todos van «🛰 todo por el repetidor»
// (&conexion=cloudflare) con el TURN de mentira de este PC: la PC por UDP y el teléfono por TCP a través del cable (adb
// reverse del puerto del TURN), como sala-telefono-mixta.mjs --cable. --sin-cable = sin repetidor (otra red con STUN).
const turn = TELEFONO && !process.argv.includes('--sin-cable') ? await crearTurn() : null;
const CONEXION = turn ? '&conexion=cloudflare' : '';
const SEGUNDOS = Number(opcion('--segundos', 30)), EXTRA = opcion('--extra', '');
// §286: --build-b=CARPETA = B corre OTRO programa (el servidor se lo da con MKW_BUILD_B y &build=b): la sala no debe largar
// (estado.versionDistinta y el aviso «… tiene otra versión: recarguen»); la prueba termina ahí
const BUILD_B = opcion('--build-b', '');
const PISTAS = opcion('--pistas', '0.0').split(',').map(s => { const [copa, fila] = s.split('.').map(Number); return { copa, fila }; });
const ETIQUETA = opcion('--etiqueta', `${LOCKSTEP ? 'lockstep' : 'estado'}${TELEFONO ? '-telefono' : ''}`);
const carpeta = path.join('build', 'web', 'datos', 'red-estado');
fs.mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (t, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${t}${d ? ' — ' + d : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const resultado = { etiqueta: ETIQUETA, telefono: TELEFONO, lockstep: LOCKSTEP, pistas: PISTAS, segundos: SEGUNDOS };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...(BUILD_B ? { MKW_BUILD_B: BUILD_B } : {}) } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));

const leer = p => Promise.race([espera(10000).then(() => ({ colgada: true })), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730), rd = L.u32(0x809BD728);
  return { s: e.seccion, pagina: e.pagina, etapa: ri ? L.u32(ri + 0x28) : -1, logica: ri ? L.u32(ri + 0x1C) + L.u32(ri + 0x20) : 0,
    modo: rd ? L.u32(rd + 0x20 + 0xB48 + 0x8) : -1, eleccion: window.mkwEstado.eleccion || null, sala: window.mkwEstado.sala || null,
    picker: !!document.getElementById('elegirPista'), cortina: !document.body.classList.contains('sin-cortina'),
    red: window.mkwRedEstadoSala?.estado?.() ?? null, karts: (() => { try { return L.u8(L.u32(0x809C18F8) + 0x24); } catch { return -1; } })() };
})]).catch(() => null);
const esperarQue = async (p, f, tope, que) => { let aviso = Date.now() + 15000;
  for (const h = Date.now() + tope; Date.now() < h;) { const x = await leer(p); if (x && f(x)) return x;
    if (Date.now() > aviso) { aviso = Date.now() + 15000; console.log(`  … ${que}: ${JSON.stringify(x && { s: x.s, pagina: x.pagina, etapa: x.etapa, fase: x.sala?.fase, carrera: x.sala?.carrera })}`); }
    await espera(500); } return leer(p); };
// la diferencia de relojes entre la pestaña y este proceso (en el mismo PC: ~0)
async function desfase(p) { let mejor = null;
  for (let i = 0; i < 10; i++) { const t0 = Date.now(); const tp = await p.evaluate(() => performance.timeOrigin + performance.now()).catch(() => null); const t1 = Date.now();
    if (tp !== null && (!mejor || t1 - t0 < mejor.rtt)) mejor = { rtt: t1 - t0, ms: tp - (t0 + t1) / 2 }; await espera(40); }
  return mejor; }
const medirImagen = (p, s) => p.evaluate(async seg => {
  let antes = window.mkwCuadros?.() ?? 0, fin = false; const t = [], t0 = performance.now();
  const paso = h => { if (fin) return; const c = window.mkwCuadros?.() ?? 0; if (c !== antes) { t.push(h); antes = c; } requestAnimationFrame(paso); };
  requestAnimationFrame(paso); await new Promise(r => setTimeout(r, seg * 1000)); fin = true;
  const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]); d.sort((a, b) => a - b);
  const p99 = d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.99))] : null;
  return { imagenes: +(t.length / ((performance.now() - t0) / 1000)).toFixed(1), bajo1: p99 ? +(1000 / p99).toFixed(1) : null };
}, s).catch(e => ({ error: e.message }));

// lo que hace falta para saber por qué una carrera no avanza: la lógica en 2 s, el DWC falso y el final del registro
const diagnostico = p => Promise.race([espera(15000).then(() => ({ colgada: true })), p.evaluate(async () => {
  // (sin el ruido de aurora y del medidor: lo de la sala, la malla y la red)
  const L = window.mkwMenus, ri = () => L.u32(0x809BD730), log = (window.mkwEstado.log || []).filter(l => !/aurora|\[medidor\]|\[thp\]|\[ritmo\]/.test(l)).slice(-60);
  const lee = () => { const r = ri(); return r ? { f1c: L.u32(r + 0x1C), f20: L.u32(r + 0x20), etapa: L.u32(r + 0x28) } : null; };
  const M = window.mkw, juego = () => [0,1,2,3,4,5,6,7].map(i => M?._mkw_red_estado_estado?.(i));
  const a = { ri: lee(), juego: juego(), t: performance.now() };
  await new Promise(r => setTimeout(r, 2000));
  const sala = window.mkwEstado.sala;
  return { antes: a, despues: { ri: lee(), juego: juego() }, red: window.mkwRedEstadoSala?.estado?.(),
    sala: sala && { fase: sala.fase, carrera: sala.carrera, fuera: sala.fuera, listos: sala.listos },
    conexiones: window.mkwEstado.conexiones ?? null, log };
})]).catch(e => ({ error: e.message }));

async function sala(A, B, dB) {
  const r = { carreras: [] };
  await esperarQue(A, x => x.picker, 300000, 'A hasta el selector');
  const puso = await A.evaluate(c => window.mkwSala.ponerPistas(c), PISTAS).catch(e => e.message);
  ok('la anfitriona fija la copa', puso === true, JSON.stringify(PISTAS));
  const elegir = async (p, tel) => {
    let visto = false, ultimo = 0;
    for (const h = Date.now() + 240000; Date.now() < h;) {
      const x = await leer(p);
      if (x?.eleccion) return x;
      if (x && !x.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina)) {
        if (!visto && x.pagina === 0x6B) { visto = true; await espera(800); if (tel) { await p.keyboard.down('KeyD'); await espera(150); await p.keyboard.up('KeyD'); await espera(400); } }
        if (Date.now() - ultimo > 1300) { ultimo = Date.now(); await p.keyboard.down('KeyK'); await espera(150); await p.keyboard.up('KeyK'); }
      }
      await espera(300);
    }
    return leer(p);
  };
  const [ea, eb] = await Promise.all([elegir(A, false), elegir(B, TELEFONO)]);
  ok('las dos consolas eligieron personaje', !!(ea?.eleccion && eb?.eleccion));
  if (BUILD_B) {
    // §286: con dos programas la anfitriona no larga: 60 s en «elegir», el estado dice quién y las dos muestran el aviso
    await espera(60000);
    const v = await Promise.all([A, B].map(p => p.evaluate(() => ({ fase: window.mkwEstado.sala?.fase, otra: window.mkwEstado.sala?.versionDistinta || [],
      programa: window.mkwPrograma, aviso: document.getElementById('esperaCarga')?.hidden === false ? document.getElementById('esperaCarga').textContent : null,
      versiones: window.mkwSala?.versiones?.() })).catch(e => ({ error: e.message }))));
    console.log(`  programas: A ${v[0]?.programa} · B ${v[1]?.programa}`);
    ok('§286: con otro programa en B la sala no larga (60 s en «elegir» con los dos elegidos)', v.every(x => x.fase === 'elegir'), v.map(x => x.fase).join('/'));
    ok('…el estado dice que B tiene otra versión', v.every(x => x.otra.length === 1 && x.otra[0] === uidB), JSON.stringify(v.map(x => x.otra)));
    ok('…y las dos lo muestran («… otra versión … recarg…»)', v.every(x => /otra versión/.test(x.aviso || '') && /recarg/.test(x.aviso || '')), v.map(x => x.aviso).join(' | '));
    return r;
  }
  for (let n = 1; n <= PISTAS.length; n++) {
    const c = { carrera: n };
    const cuenta = await Promise.all([A, B].map((p, k) => esperarQue(p, x => x.sala?.fase === 'correr' && x.sala?.carrera === n && x.etapa >= 0 && x.etapa <= 2 && x.logica > 0, 420000, (k ? 'B' : 'A') + ' hasta la carrera')));
    c.modo = cuenta.map(x => x?.modo); c.karts = cuenta.map(x => x?.karts);
    ok(`carrera ${n}: las dos en la carrera`, cuenta.every(x => x?.etapa >= 0 && x?.etapa <= 2), cuenta.map(x => x?.colgada ? 'colgada' : `etapa ${x?.etapa}`).join(' / '));
    if (!LOCKSTEP) ok(`carrera ${n}: en línea (Racedata modo 7) y 12 karts en las dos`, c.modo.every(m => m === 7) && c.karts.every(k => k === 12), `modo ${c.modo.join('/')}, karts ${c.karts.join('/')}`);
    else ok(`carrera ${n}: 12 karts en las dos`, c.karts.every(k => k === 12), `karts ${c.karts.join('/')}`);
    // plazo: si en 60 s no empieza la cuenta, diagnóstico y cortar (nunca quedarse colgada con el candado)
    const cuentaYa = await Promise.all([A, B].map(p => esperarQue(p, x => x.etapa >= 1, 60000, 'la cuenta')));
    if (!cuentaYa.every(x => x?.etapa >= 1)) {
      for (const [k, p] of [['A', A], ['B', B]]) console.log(`  diagnóstico ${k}: ${JSON.stringify(await diagnostico(p))}`);
      ok(`carrera ${n}: la cuenta empieza antes de 60 s`, false); throw new Error('sin cuenta en 60 s');
    }
    const qa = dB ? await dB.boton('A') : null;
    await A.keyboard.down('KeyK'); if (dB && qa) await dB.poner(1, qa); else await B.keyboard.down('KeyK');
    await Promise.all([A, B].map(p => esperarQue(p, x => x.etapa === 2, 60000, '«¡YA!»')));
    const desde = Date.now();
    await espera(1500);
    const suelta = async (p, esB) => { const f = await p.evaluate(() => window.mkwRedEstado?.marcar('suelta') ?? null);
      if (esB && dB) { await dB.levantar(1); await espera(1000); if (qa) await dB.poner(1, qa); } else { await p.keyboard.up('KeyK'); await espera(1000); await p.keyboard.down('KeyK'); }
      return f; };
    const [fA, fB] = await Promise.all([suelta(A, false), suelta(B, true)]);
    const dA = await desfase(A), dBr = await desfase(B);
    const yoA = await A.evaluate(() => window.mkwRedEstado?.ultima()?.propio ?? 0), yoB = await B.evaluate(() => window.mkwRedEstado?.ultima()?.propio ?? 1);
    const pararA = manejar(A, null, yoA), pararB = manejar(B, dB, yoB);
    let muestreando = true; c.ventajaA = [];
    const muestreo = (async () => { while (muestreando) { const [a, b] = await Promise.all([leer(A), leer(B)]); if (a?.logica && b?.logica) c.ventajaA.push(a.logica - b.logica); await espera(2000); } })();
    // --perfil: el perfil de CPU de cada pestaña (CDP) mientras se mide: qué funciones gastan el tiempo (los picos «otro»)
    const perfiles = PERFIL && !TELEFONO ? await Promise.all([A, B].map(async p => { const s = await p.context().newCDPSession(p);
      await s.send('Profiler.enable'); await s.send('Profiler.setSamplingInterval', { interval: 200 }); await s.send('Profiler.start'); return s; })) : null;
    const marcas = await Promise.all([A, B].map(p => p.evaluate(() => window.mkwImagenesVista?.marca?.() ?? null).catch(() => null)));
    // --vigilar: cada 1 s, en las dos, la lógica por segundo y las imágenes de más de 25 ms (con su causa) del medidor;
    // al lado, el uso de CPU de todo el PC (typeperf): si un tirón coincide con el PC ocupado, la causa es de afuera
    const vigia = VIGILAR ? (() => { let sigue = true; const filas = [];
      const tp = spawn('typeperf', ['\\Processor(_Total)\\% Processor Time', '-si', '1', '-sc', String(SEGUNDOS + 5)], { stdio: ['ignore', 'pipe', 'ignore'] });
      let cpuPc = null; tp.stdout.on('data', d => { const m = String(d).match(/"([\d.]+)"\s*$/m); if (m) cpuPc = +(+m[1]).toFixed(0); });
      const marcasV = [null, null];
      const ciclo = (async () => { while (sigue) {
        const fila = { t: Date.now(), cpuPc };
        for (const [k, p] of [[0, A], [1, B]]) fila[k ? 'B' : 'A'] = await p.evaluate(m => { const v = window.mkwImagenesVista, L = window.mkwMenus, ri = L.u32(0x809BD730);
          const u = v ? v.tiempos({ desde: m }) : []; const largas = [];
          return { marca: v?.marca?.(), logica: ri ? L.u32(ri + 0x1C) + L.u32(ri + 0x20) : 0, imgs: u.length, largas: (v ? v.ultimos(Math.max(1, u.length)) : []).filter(x => x.ms > 25).map(x => `${Math.round(x.ms)}${x.causa ? ':' + x.causa : ''}`) };
        }, marcasV[k]).catch(() => null);
        for (const k of [0, 1]) marcasV[k] = fila[k ? 'B' : 'A']?.marca ?? marcasV[k];
        filas.push(fila); await espera(1000);
      } })();
      return { async parar() { sigue = false; await ciclo; tp.kill(); return filas; } };
    })() : null;
    if (FOTO) for (const [k, p] of [['A', A], ['B', B]]) await p.screenshot({ path: path.join(carpeta, `foto-${ETIQUETA}-${k}-${n}.png`) }).catch(e => console.log('  foto: ' + e.message));
    // con --extra "&gpu=1": cuántos dibujos, pasadas y recetas por cuadro manda B a la tarjeta mientras se mide (perfil-gpu.mjs)
    // con --extra "&trazaDisco=1": qué archivos de karts y pilotos leyó B (para ver si el modo en línea usa otros modelos)
    if (EXTRA.includes('trazaDisco')) { c.archivosB = await B.evaluate(() => [...new Set((window.mkwEstado?.log || []).filter(l => /\[lee\]/.test(l) && /Kart\/|Character\/|Driver/.test(l)).map(l => l.replace(/^.*\[lee\] cuadro \d+ /, '').split(' ')[0]))]).catch(() => null);
      console.log(`  carrera ${n}: B leyó ${c.archivosB?.length} archivos de karts: ${(c.archivosB || []).map(x => x.split('/').pop()).sort().join(' ')}`); }
    // --racedata: la cabecera del escenario de la carrera (Racedata +0x20: +4 jugadores, +5…+7) y el tipo de cada jugador
    // (+0x28 + i·0xF0 + 0x10: 0 local, 1 CPU…): qué decide el modelo completo o el liviano (_4) de cada kart
    if (process.argv.includes('--racedata')) for (const [k, p] of [['A', A], ['B', B]]) console.log(`  carrera ${n}: Racedata ${k} ` + JSON.stringify(await p.evaluate(() => {
      const L = window.mkwMenus, rd = L.u32(0x809BD728), e = rd + 0x20;
      const b = i => (L.u32(e + (i & ~3)) >>> (8 * (3 - (i & 3)))) & 0xFF;
      return { cab: [4, 5, 6, 7].map(b), tipos: Array.from({ length: 12 }, (_, i) => L.u32(e + 8 + i * 0xF0 + 0x10)), modo: L.u32(e + 0xB50) };
    }).catch(x => String(x))));
    // §275b: cuántos karts de afuera armó cada una con el modelo liviano (_4; 0 con ?kartLiviano=0 o un programa viejo)
    if (!LOCKSTEP) { c.livianos = await Promise.all([A, B].map(p => p.evaluate(() => window.mkw?._mkw_red_estado_estado?.(8) ?? null).catch(() => null)));
      console.log(`  carrera ${n}: karts de afuera con el modelo liviano A ${c.livianos[0]} · B ${c.livianos[1]}`); }
    const gpuFoto = () => B.evaluate(() => window.mkwPerfilGpu?.foto?.() ?? null).catch(() => null), gpu0 = await gpuFoto();
    c.imagenB = await medirImagen(B, SEGUNDOS);
    const gpu1 = await gpuFoto();
    if (gpu0 && gpu1) { const d = k => (gpu1[k] ?? 0) - (gpu0[k] ?? 0), nc = Math.max(1, d("cuadros"));
      c.gpuB = Object.fromEntries(['dibujos', 'pasadas', 'recetas', 'grupos', 'subidas', 'bytes'].map(k => [k, +(d(k) / nc).toFixed(1)]));
      c.gpuB.cuadros = nc; console.log(`  carrera ${n}: B a la tarjeta por cuadro ${JSON.stringify(c.gpuB)}`); }
    if (CALIBRAR && n === 1) {
      const leerCal = p => p.evaluate(() => { const a = window.mkwAutoCalibrar?.estado, R = window.mkwRedEstadoSala?.estado?.();
        return { corriendo: !!a?.corriendo, congeladaPor: a?.congeladaPor ?? null, texto: a?.ultimo?.texto ?? null, atraso: R?.alDia?.atraso ?? null }; }).catch(() => null);
      // (§274.6: sin esperar la promesa de apretar(): la prueba miraba recién al terminar la calibración y no veía la pausa)
      await B.evaluate(() => { window.mkwAutoCalibrar?.apretar?.(); }).catch(() => {});
      const visto = { A: false, B: false }; let fin = null;
      for (const h = Date.now() + 45000; Date.now() < h;) {
        const [a, b] = await Promise.all([leerCal(A), leerCal(B)]);
        if (a?.congeladaPor) visto.A = true; if (b?.congeladaPor) visto.B = true;
        if (visto.B && b && !b.corriendo && !b.congeladaPor) { fin = b; break; }
        await espera(300);
      }
      await espera(5000);
      const [a2, b2] = await Promise.all([leerCal(A), leerCal(B)]);
      c.calibrar = { visto, fin, despues: { A: a2, B: b2 } };
      // (§274.6: lo que anotó la auto calibración en cada una, para saber por qué no se pausó)
      c.calibrarHist = await Promise.all([A, B].map(p => p.evaluate(() => ({ h: window.mkwAutoCalibrar?.estado?.historial || [], pausa: window.mkwSala?.pausa ?? null, sala: !!window.mkwSala, lista: window.mkwSala?.lista })).catch(x => String(x))));
      console.log(`  carrera ${n}: calibrar (historial) ${JSON.stringify(c.calibrarHist)}`);
      // (§274.6: lo que anotó la auto calibración en cada una, para saber por qué no se pausó)
      c.calibrarHist = await Promise.all([A, B].map(p => p.evaluate(() => ({ h: window.mkwAutoCalibrar?.estado?.historial || [], pausa: window.mkwSala?.pausa ?? null, sala: !!window.mkwSala, lista: window.mkwSala?.lista })).catch(x => String(x))));
      console.log(`  carrera ${n}: calibrar (historial) ${JSON.stringify(c.calibrarHist)}`);
      console.log(`  carrera ${n}: calibrar ${JSON.stringify(c.calibrar)}`);
      // (§274.6, el dueño: «debiera freezear el juego de todos con el mensaje de aviso»: también en «Cada uno su kart» la
      // pausa de la sala congela a todas; al seguir, el lento al día las empareja)
      ok(`carrera ${n}: «⚡ Auto calibración» en B congela a las dos (A también), termina y quedan parejas (atraso ≤ 5 cuadros)`,
        visto.A && visto.B && !!(fin?.texto || b2?.texto) && Math.abs(a2?.atraso ?? 99) <= 5 && Math.abs(b2?.atraso ?? 99) <= 5, JSON.stringify(c.calibrar).slice(0, 300));
    }
    if (vigia) {
      const filas = await vigia.parar(); c.vigia = filas;
      for (let i = 1; i < filas.length; i++) { const f = filas[i], a = filas[i - 1], dt = (f.t - a.t) / 1000;
        const lg = k => f[k] && a[k] ? ((f[k].logica - a[k].logica) / dt).toFixed(0) : '?';
        const tiron = (f.A?.largas?.length || 0) + (f.B?.largas?.length || 0) > 0 || +lg('A') < 57 || +lg('B') < 57;
        console.log(`  ${tiron ? '⚠' : ' '} s${String(i).padStart(2)}: PC ${f.cpuPc ?? '?'}% · A lógica ${lg('A')}/s img ${f.A?.imgs} ${f.A?.largas?.join(' ') || ''} · B lógica ${lg('B')}/s img ${f.B?.imgs} ${f.B?.largas?.join(' ') || ''}`); }
    }
    // el medidor de la página (el del chip: imágenes, 1 % bajo y la causa de cada pico) en el mismo tramo, en las dos
    c.vista = await Promise.all([A, B].map((p, k) => p.evaluate(m => { const v = window.mkwImagenesVista; if (!v) return null;
      const r = v.resumen(m), u = v.ultimos(600).filter(x => x.ms > 25);
      const causas = {}; for (const x of u) causas[x.causa || 'normal'] = (causas[x.causa || 'normal'] || 0) + 1;
      return { fps: r.fps && +r.fps.toFixed(1), bajo1: r.bajo1 && +r.bajo1.toFixed(1), p99ms: r.p99ms && +r.p99ms.toFixed(1), largas: u.length, causas, peores: u.map(x => Math.round(x.ms)).sort((a, b) => b - a).slice(0, 8) };
    }, marcas[k]).catch(e => ({ error: e.message }))));
    console.log(`  carrera ${n}: medidor A ${JSON.stringify(c.vista[0])} · B ${JSON.stringify(c.vista[1])}`);
    // N8 y el historial por segundo del medidor (imágenes, CPU del juego ms, lógica), los últimos 40 s, en las dos:
    // para saber si Automático se prendió y qué frena (la tarjeta, la CPU o la red)
    c.n8 = await Promise.all([A, B].map(p => p.evaluate(() => ({ n8: window.mkwEstado.n8auto ?? null, modo: [6, 7, 0, 1, 18].map(i => window.mkw?._mkw_n8_estado?.(i) ?? null),   // (modo, activo, dibujados, saltados, saltados por RR)
      hist: (window.mkwEstado.historial || []).slice(-40).map(h => [h.fps, h.juego, h.cpu ?? null, h.video, h.logica]) })).catch(e => ({ error: e.message }))));
    for (const [k, x] of [['A', c.n8[0]], ['B', c.n8[1]]]) console.log(`  carrera ${n}: N8 ${k} ${JSON.stringify(x?.n8 && { prendido: x.n8.prendido, sirve: x.n8.sirve, cambios: x.n8.cambios, ultimo: x.n8.ultimo })} juego [modo, activo, dibujados, saltados, RR] ${JSON.stringify(x?.modo)} · por segundo [img, juego ms, cpu ms, tarjeta ms, lógica] ${JSON.stringify(x?.hist?.slice(-15))}`);
    if (perfiles) c.perfil = await Promise.all(perfiles.map(async (s, k) => {
      const { profile } = await s.send('Profiler.stop');
      fs.writeFileSync(path.join(carpeta, `perfil-${ETIQUETA}-${k ? 'B' : 'A'}-${n}.cpuprofile`), JSON.stringify(profile));
      const dt = (profile.endTime - profile.startTime) / 1000 / profile.samples.length, cuenta = new Map(), nodo = new Map(profile.nodes.map(x => [x.id, x]));
      for (const id of profile.samples) { const f = nodo.get(id).callFrame, k2 = `${f.functionName || '(anónima)'} ${(f.url || '').split('/').pop()}:${f.lineNumber}`; cuenta.set(k2, (cuenta.get(k2) || 0) + dt); }
      const total = (profile.endTime - profile.startTime) / 1000;
      return { ms: Math.round(total), arriba: [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k2, ms]) => `${(100 * ms / total).toFixed(1)}% ${k2}`) };
    }));
    if (c.perfil) c.perfil.forEach((x, k) => console.log(`  perfil ${k ? 'B' : 'A'} (${x.ms} ms):` + x.arriba.map(l => '\n    ' + l).join('')));
    c.manejo = { A: await pararA(), B: await pararB() };
    const fin = await Promise.all([A, B].map(leer));
    c.red = fin.map(x => x?.red);
    if (!LOCKSTEP) ok(`carrera ${n}: los paquetes RACE cruzan en los dos sentidos`, fin.every(x => (x?.red?.recibidos ?? 0) > 100 && (x?.red?.enviados ?? 0) > 100), JSON.stringify(c.red.map(x => x && { env: x.enviados, rec: x.recibidos, tir: x.tirados, juego: x.juego })));
    // las trayectorias (la hora de B pasada a la de este proceso)
    const mA = (await A.evaluate(d => window.mkwRedEstado?.muestras(d) ?? [], desde + (dA?.ms ?? 0))).map(s => ({ ...s, t: s.t - (dA?.ms ?? 0) }));
    const mB = (await B.evaluate(d => window.mkwRedEstado?.muestras(d) ?? [], desde + (dBr?.ms ?? 0))).map(s => ({ ...s, t: s.t - (dBr?.ms ?? 0) }));
    c.ritmo = { A: ritmo(mA), B: ritmo(mB) };
    const tray = (m, i) => m.filter(s => s.karts[i]).map(s => ({ t: s.t, f: s.f, pos: s.karts[i] }));
    const vA = tray(mA, yoA), vAenB = tray(mB, yoA), vB = tray(mB, yoB), vBenA = tray(mA, yoB);
    const moviendo = (v, vista) => vista.filter(x => { const a = posicionEn(v, x.t), b = posicionEn(v, x.t - 100); return a && b && distancia(a, b) > 300; });
    c.errorAenB = errorTrayectoria(vA, moviendo(vA, vAenB)); c.atrasoAenB = atrasoDeVista(vA, moviendo(vA, vAenB), { maxMs: 1500, pasoMs: 8 });
    c.errorBenA = errorTrayectoria(vB, moviendo(vB, vBenA)); c.atrasoBenA = atrasoDeVista(vB, moviendo(vB, vBenA), { maxMs: 1500, pasoMs: 8 });
    const propias = (m, i) => m.filter(s => s.karts[i]).map(s => ({ f: s.f, pos: s.karts[i] }));
    c.respuesta = { A: cuadrosDeRespuesta(propias(mA, yoA), fA), B: cuadrosDeRespuesta(propias(mB, yoB), fB) };
    const fmt = e => e?.n ? `medio ${e.medio.toFixed(0)}, p90 ${e.p90.toFixed(0)}` : 'sin datos';
    console.log(`  carrera ${n}: lógica A ${c.ritmo.A?.toFixed(1)}/s, B ${c.ritmo.B?.toFixed(1)}/s; B ${JSON.stringify(c.imagenB)}; ventaja de A ${c.ventajaA.join(' ')}`);
    console.log(`  carrera ${n}: kart de A en B ${fmt(c.errorAenB)} atraso ${c.atrasoAenB.ms} ms; kart de B en A ${fmt(c.errorBenA)} atraso ${c.atrasoBenA.ms} ms; respuesta ${JSON.stringify(c.respuesta)}`);
    ok(`carrera ${n}: A a ~60 de lógica`, c.ritmo.A >= 57, `${c.ritmo.A?.toFixed(1)}/s`);
    ok(`carrera ${n}: los dos karts se ven moverse en la otra consola`, c.errorAenB.n > 50 && c.errorBenA.n > 50, `n ${c.errorAenB.n} / ${c.errorBenA.n}`);
    // 3b: las CPU (los puestos sin persona) son LAS MISMAS en las dos pantallas: la de A (la anfitriona, la verdad) contra
    // la vista de B, solo con la CPU andando; y que se muevan (la ruta de la IA, no quietas en la largada)
    const humanos = new Set([yoA, yoB]), cpus = [...Array(12).keys()].filter(i => !humanos.has(i));
    const errCpu = cpus.map(i => { const v = tray(mA, i); return { i, ...errorTrayectoria(v, moviendo(v, tray(mB, i))) }; });
    const todos = errCpu.filter(e => e.n);
    c.cpu = { porCpu: errCpu.map(e => ({ i: e.i, n: e.n, medio: e.medio && Math.round(e.medio), p90: e.p90 && Math.round(e.p90) })),
      medio: todos.length ? todos.reduce((a, e) => a + e.medio, 0) / todos.length : null, peorP90: todos.length ? Math.max(...todos.map(e => e.p90)) : null,
      juego: fin.map(x => x?.red?.cpuJuego), lotes: fin.map(x => x?.red?.cpu) };
    console.log(`  carrera ${n}: CPU de A en B: ${todos.length}/${cpus.length} andando, error medio ${c.cpu.medio?.toFixed(0)}, peor p90 ${c.cpu.peorP90?.toFixed(0)}; ${JSON.stringify(c.cpu.lotes)} ${JSON.stringify(c.cpu.juego)}`);
    if (!LOCKSTEP) ok(`carrera ${n}: las CPU son las mismas en las dos (las 10 andando, error medio < 600 ≈ 6 m)`, todos.length === cpus.length && c.cpu.medio < 600,
      `${todos.length}/${cpus.length}, medio ${c.cpu.medio?.toFixed(0)}, peor p90 ${c.cpu.peorP90?.toFixed(0)}`);
    if (!LOCKSTEP) ok(`carrera ${n}: el botón propio en ≤ 1 cuadro en las dos`, c.respuesta.A !== null && c.respuesta.A <= 1 && c.respuesta.B !== null && c.respuesta.B <= 1, JSON.stringify(c.respuesta));
    c.muestras = { A: mA, B: mB };
    r.carreras.push(c);
    await A.keyboard.up('KeyK'); if (dB) await dB.soltarTodo(); else await B.keyboard.up('KeyK');
    // 3c: terminar la carrera en las dos a la vez (mkwTerminarEn: los humanos cruzan la meta; en «Cada uno su kart» cada
    // consola en el momento) y que el juego dé los puestos y los puntos, los mismos en las dos
    const dnfAqui = DNF && n === PISTAS.length;
    await Promise.all([[A, yoA], [B, yoB]].filter(([p]) => !(dnfAqui && p === B)).map(([p, yo]) => p.evaluate(q => window.mkwTerminarEn?.(0, undefined, [q]), yo).catch(() => {})));
    const fines = await Promise.all([A, B].map(p => esperarQue(p, x => x.etapa >= 4 || x.sala?.carrera > n || x.sala?.fase !== 'correr', 60000, 'el fin')));
    if (!fines.every(x => x?.etapa >= 4 || x?.sala?.carrera > n || x?.sala?.fase !== 'correr'))
      for (const [k, p] of [['A', A], ['B', B]]) console.log(`  fin ${k}: ${JSON.stringify(await p.evaluate(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC);
        const r = L.u32(ri + 0x14), M = window.mkw;
        return { etapa: L.u32(ri + 0x28), reloj: (L.u16(r + 0x8) * 60 + L.u8(r + 0xA)) * 1000 + L.u16(r + 0xC), dnfDesde: M._mkw_sala_dnf_desde?.(),
          llegaron: Array.from({ length: 12 }, (_, i) => (L.u32(L.u32(lista + 4 * i) + 0x38) & 2) ? 1 : 0).join(''),
          vueltas: Array.from({ length: 12 }, (_, i) => L.u16(L.u32(lista + 4 * i) + 0x24)).join(','), sala: window.mkwEstado.sala?.fase, fin: window.mkwRedEstadoSala?.estado?.()?.fin };
      }).catch(e => e.message))}`);
    ok(`carrera ${n}: termina en las dos`, fines.every(x => x?.etapa >= 4 || x?.sala?.carrera > n || x?.sala?.fase !== 'correr'), fines.map(x => `etapa ${x?.etapa} fase ${x?.sala?.fase}`).join(' / '));
    if (dnfAqui) {                                                           // (la etapa 4 es «llegaron los míos»: esperar al DNF de B)
      const llego = p => p.evaluate(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC);
        return !!(L.u32(L.u32(lista + 4) + 0x38) & 2); }).catch(() => false);
      for (const fin = Date.now() + 60000; Date.now() < fin && !(await llego(A) && await llego(B));) await espera(500);
    }
    await espera(5000);                                                      // (los resultados suman los puntos)
    c.llegada = await Promise.all([A, B].map(p => p.evaluate(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC);
      const t = q => q ? (L.u16(q + 4) * 60 + L.u8(q + 6)) * 1000 + L.u16(q + 8) : -1;
      return { fin: window.mkwRedEstadoSala?.estado?.()?.fin, etapas: window.mkwRedEstadoSala?.estado?.()?.etapas, humanos: [0, 1].map(i => { const q = L.u32(lista + 4 * i); return { puesto: L.u8(q + 0x20), flags: L.u32(q + 0x38), ms: t(L.u32(q + 0x40)) }; }),
        todos: Array.from({ length: 12 }, (_, i) => { const q = L.u32(lista + 4 * i); return q ? [L.u8(q + 0x20), t(L.u32(q + 0x40))] : [0, -1]; }) };
    }).catch(e => e.message)));
    console.log(`  carrera ${n}: llegada A ${JSON.stringify(c.llegada[0])} · B ${JSON.stringify(c.llegada[1])}`);
    if (dnfAqui) {
      const h = c.llegada.map(x => x?.humanos?.[1]), h0 = c.llegada[0]?.humanos?.[0];
      ok(`carrera ${n}: el humano de B que no llegó lo termina el plazo DNF (≥ 30 s después del primero) con el mismo tiempo en las dos`,
        h[0] && h[1] && h[0].ms === h[1].ms && h0 && h[0].ms >= h0.ms + 29000, `A ${h[0]?.ms} · B ${h[1]?.ms} · el primero ${h0?.ms}`);
    }
    // §275b.12: la tabla del final (página 0x30) muestra el tiempo de cada puesto: los 12 con un tiempo de verdad (entre
    // 5 s y 30 min), mejor puesto = menos tiempo, y los mismos en las dos consolas (el dueño vio el 1.º con 20:13.886 y
    // los demás en 00:00.000)
    {
      const tabla = x => (x?.todos || []).filter(([pu]) => pu > 0).sort((a, b) => a[0] - b[0]);
      const ta = tabla(c.llegada[0]), tb = tabla(c.llegada[1]);
      const sano = t => t.length === 12 && t.every(([, ms]) => ms > 5000 && ms < 1800000) && t.every(([, ms], i) => i === 0 || ms >= t[i - 1][1]);
      const fmt = t => t.map(([pu, ms]) => `${pu}.º ${(ms / 1000).toFixed(3)}`).join(' ');
      ok(`carrera ${n}: la tabla del final trae los 12 tiempos, en orden y los mismos en las dos`, sano(ta) && sano(tb) && JSON.stringify(ta) === JSON.stringify(tb),
        `A ${fmt(ta)} · B ${fmt(tb)}`);
    }
    c.puntos = await Promise.all([A, B].map(p => p.evaluate(() => { const L = window.mkwMenus, rd = L.u32(0x809BD728);
      return Array.from({ length: 12 }, (_, i) => L.u16(rd + 0xC10 + 8 + i * 0xF0 + 0xDA)); }).catch(() => null)));
    const suma = xs => (xs || []).reduce((a, b) => a + b, 0);
    // 3c: el VR (vr-sala.mjs con los puestos del juego): los mismos corredores en las dos; el que llegó antes sube
    c.vr = await Promise.all([A, B].map(p => p.evaluate(() => { const v = window.mkwEstado.vr; return v ? { carrera: v.carrera, cambio: v.cambio, nivelCpu: v.nivelCpu, nivelVr: v.nivelVr, gancho: [7, 2].map(k => window.mkw?._mkw_cpu_estado?.(k)),
      corredores: (v.corredores || []).map(x => `${x.uid || 'cpu'}:${x.puesto}`).join(',') } : null; }).catch(() => null)));
    console.log(`  carrera ${n}: VR A ${JSON.stringify(c.vr[0])} · B ${JSON.stringify(c.vr[1])}`);
    {
      const ganaA = c.llegada[0]?.humanos?.[0]?.puesto < c.llegada[0]?.humanos?.[1]?.puesto;
      ok(`carrera ${n}: el VR, con los mismos corredores en las dos; el que llegó antes gana más, y las CPU cuentan (el nivel aplicado)`,
        c.vr[0]?.carrera === n && c.vr[1]?.carrera === n && c.vr[0].corredores === c.vr[1].corredores &&
        (ganaA ? c.vr[0].cambio > c.vr[1].cambio : c.vr[0].cambio < c.vr[1].cambio) && c.vr.every(v => v.nivelVr === v.nivelCpu), `A ${c.vr[0]?.cambio} · B ${c.vr[1]?.cambio}`);
    }
    ok(`carrera ${n}: el juego da los puntos (suman ${73 * n}) y son los mismos en las dos`, suma(c.puntos[0]) === 73 * n && JSON.stringify(c.puntos[0]) === JSON.stringify(c.puntos[1]),
      `A ${c.puntos[0]?.join(',')} · B ${c.puntos[1]?.join(',')}`);
  }
  // la copa entera: la sala llega al final y las dos tienen la MISMA tabla
  const finCopa = await Promise.all([A, B].map(p => esperarQue(p, x => x.sala?.fase === 'fin', 90000, 'el fin de la copa')));
  r.tablas = finCopa.map(x => x?.sala?.puntos ?? null);
  ok('la copa termina en las dos con la misma tabla de la sala', finCopa.every(x => x?.sala?.fase === 'fin') && JSON.stringify(r.tablas[0]) === JSON.stringify(r.tablas[1]),
    `fase ${finCopa.map(x => x?.sala?.fase).join('/')}; A ${JSON.stringify(r.tablas[0])?.slice(0, 200)} · B ${JSON.stringify(r.tablas[1])?.slice(0, 200)}`);
  return r;
}

const salaId = 'se' + Date.now().toString(36), uidA = 'A' + salaId, uidB = 'B' + salaId;
const q = uid => `/?auto=1&${LOCKSTEP ? 'red=malla&sonda=1' : 'red=estado'}&senal=canal&sala=${salaId}&uid=${uid}&sincro=${uidA},${uidB}&jefe=${uidA}` +
  `&modo=sala&estilo=copa&carreras=${PISTAS.length}&descanso=12&semilla=4242&cc=c150&cpu=normal&pista=${PISTAS[0].copa}.${PISTAS[0].fila}${CONEXION}${EXTRA}`;
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: false,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', `--window-position=${vx},${vy}`] });
const puente = puenteSenal();
try {
  const ctxA = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  await puente.agregar(ctxA);
  const A = await ctxA.newPage();
  A.on('pageerror', e => console.log('[A] [pageerror] ' + e.message));
  await A.goto(`http://127.0.0.1:${PUERTO}${q(uidA)}`);
  // (las credenciales del repetidor, como las daría el sitio: la PC por UDP)
  if (turn) await A.evaluate(ice => window.postMessage({ canal: 'mkw-padre', tipo: 'turn', iceServers: ice }, location.origin), turn.iceServers('udp')).catch(() => {});
  if (!TELEFONO) {
    const ctxB = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
    await puente.agregar(ctxB);
    const B = await ctxB.newPage();
    B.on('pageerror', e => console.log('[B] [pageerror] ' + e.message));
    await B.goto(`http://127.0.0.1:${PUERTO}${q(uidB)}${BUILD_B ? '&build=b' : ''}`);
    resultado.sala = await sala(A, B, null);
  } else {
    const puertos = turn ? [PUERTO, turn.puerto] : [PUERTO];
    const adb = crearAdb({ ejecutable: buscarAdb(), puertos, registro: () => {} });
    const x = await abrir({ adb, puertos, segundos: 2400, aviso: m => console.log('  [teléfono] ' + m), esperar: espera,
      conectar: (p, alCtx) => conectarPlaywright(p, { fps: true }, alCtx), pantalla: true, recuerdo: recuerdoPantalla(),
      ruta: q(uidB), alContexto: async ctx => { await puente.agregar(ctx);
        // (el teléfono, por TCP por el cable; se repite los primeros 20 s: la página escucha recién al armar la malla)
        if (turn) await ctx.addInitScript(ice => { let n = 0; const f = () => { try { window.postMessage({ canal: 'mkw-padre', tipo: 'turn', iceServers: ice }, location.origin); } catch {} if (++n < 40) setTimeout(f, 500); }; setTimeout(f, 200); }, turn.iceServers('tcp')); }, durante: async B => sala(A, B, await dedos(B)) });
    resultado.sala = x.durante;
    // (solo lo que cambió de verdad: los ajustes que el teléfono mueve solo —la hora, el brillo…— ya los aparta telefono-seguro)
    resultado.cambios = x?.cambios ?? null;
    const propios = x?.cambios ? { paquetes: x.cambios.paquetes, ...Object.fromEntries(Object.entries(x.cambios.ajustes || {}).map(([t, d]) => [t, d.propios]).filter(([, v]) => v?.length)) } : null;
    ok('el teléfono quedó igual que antes (apps y ajustes)', !!x?.cambios?.igual, propios ? JSON.stringify(propios).slice(0, 400) : 'sin la foto de después');
  }
} catch (e) { ok('la prueba corrió entera', false, e.stack?.slice(0, 400)); }
finally { await navegador.close().catch(() => {}); servidor.kill();
  if (turn) { resultado.turn = turn.cuenta; console.log(`  repetidor: ${JSON.stringify(turn.cuenta)}`); turn.cerrar(); } }
fs.writeFileSync(path.join(carpeta, `sala-${ETIQUETA}.json`), JSON.stringify(resultado));
console.log(`\n${bien} bien, ${mal} mal  (${path.join(carpeta, `sala-${ETIQUETA}.json`)})`);
process.exit(mal ? 1 : 0);
