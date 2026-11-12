// El 1 % bajo de las imágenes en los MENÚS (bitácora §270): lo que mide G16 (§256) en la carrera, ahora en cada
// pantalla de menú del juego y en lo de la página encima del juego. Recorre, en una pestaña:
//   - «inicio»: la página sin modo (el título del juego), con la bienvenida encima (?bienvenida=1) y después sin ella;
//   - «sala»: una sala de UN humano (red de mentira de la página): el selector de copa de la página encima de la
//     pantalla de personaje, elegir personaje, la carrera (corta: tiempo límite ?limite), los resultados y el descanso;
//   - «sp»: Single Player por los menús del juego con el piloto de botones (?directo=0, la cortina encima).
// Cada segundo pide a la página los tiempos de las imágenes de ese segundo (mkwEstado.imagenes, de entrega a entrega)
// y los guarda en el «cajón» del lugar: la capa de la página que se ve (bienvenida, selector, cortina, descanso) + la
// sección y la página del juego. Al final, por cajón: fps a la vista, 1 % y 0,1 % bajo, y cuántas imágenes duraron
// cuántos refrescos del monitor.
// Uso:  node herramientas/medir-menus.mjs [--ventana] [--flujos inicio,sala,sp] [--chrome "…"] [--puerto N] ["&param=…" …]
//       (cada variante "&…" se corre entera; p. ej. "" "&menusRitmo=0" = después y antes intercalados)
// Salida: el texto por cajón; con --json ARCHIVO, todos los tiempos por cajón y variante.
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resumir, textoResumen, histograma } from '../web/navegador/imagenes-vista.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : d; };
const VENTANA = args.includes('--ventana'); if (VENTANA) args.splice(args.indexOf('--ventana'), 1);
const PUERTO = Number(opcion('--puerto', 8187));
const FLUJOS = opcion('--flujos', 'inicio,sala,sp').split(',');
const CHROME = opcion('--chrome', '');
const JSON_SALIDA = opcion('--json', '');
const variantes = args.length ? args : [''];
const espera = ms => new Promise(r => setTimeout(r, ms));
const hex = n => (n >>> 0).toString(16);

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !VENTANA,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    ...(VENTANA ? [`--window-position=${process.env.MKW_VENTANA || '-1880,549'}`] : []), ...(CHROME ? CHROME.split(' ') : [])] });

// lo que la página dice de dónde está: la capa de la página que se ve y la sección/página del juego
const LUGAR = () => {
  const L = window.mkwMenus, e = L?.estado?.();
  const ve = id => { const n = document.getElementById(id); return !!n && !n.hidden && n.offsetParent !== null; };
  const capa = document.body.classList.contains('con-bienvenida') ? 'bienvenida'
    : document.getElementById('elegirPista') ? 'selector'
    : !document.body.classList.contains('sin-cortina') ? 'cortina'
    : ve('playlistBreve') ? 'descanso' : '';
  const ri = L?.u32?.(0x809BD730), et = ri ? L.u32(ri + 0x28) : -1;
  return { capa, s: e?.seccion ?? -1, pg: e?.pagina ?? -1, et, picker: !!document.getElementById('elegirPista'),
    eleccion: !!window.mkwEstado?.eleccion, fase: window.mkwEstado?.sala?.fase || '', breve: ve('playlistBreve'),
    periodo: window.mkwRelojMonitor?.p || null };
};

async function correrFlujo(flujo, extra, cajones) {
  const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
  const p = await contexto.newPage();
  const uid = 'm' + Date.now().toString(36), sala = 'menus-' + uid;
  const url = {
    inicio: `/?auto=1&bienvenida=1`,
    sala: `/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uid}&sincro=${uid}&jefe=${uid}&semilla=777&modo=sala&estilo=copa&carreras=2&cc=c150&cpu=maximo&limite=25&descanso=25&copaReloj=40`,
    sp: `/?auto=1&directo=0&modo=vs&copa=0&fila=0&cpu=maximo`,
  }[flujo];
  await p.goto(`http://127.0.0.1:${PUERTO}${url}${extra}`);
  // esperar a que la página tenga el medidor de imágenes
  for (let i = 0; i < 120 && !(await p.evaluate(() => !!window.mkwEstado?.imagenes).catch(() => false)); i++) await espera(500);
  let marca = await p.evaluate(() => window.mkwEstado.imagenes.marca()), marcaJ = await p.evaluate(() => window.mkwRitmoJuego?.total ?? null);
  const fin = Date.now() + (flujo === 'sala' ? 240000 : flujo === 'sp' ? 120000 : 60000);
  let hecho = { pistas: false, elegido: false, bienvenida: false, carreras: 0 }, inicio = Date.now(), ultimaEt = -1;
  while (Date.now() < fin) {
    await espera(1000);
    // (§270: también el ritmo del juego, los cuadros que calcula; null con una página sin mkwRitmoJuego)
    const r = await p.evaluate(([m, mj]) => { const j = window.mkwRitmoJuego;
      return { t: Array.from(window.mkwEstado.imagenes.tiempos(m)), m2: window.mkwEstado.imagenes.marca(),
               j: j && mj !== null ? Array.from(j.tiempos(mj)) : [], mj2: j ? j.total : null }; }, [marca, marcaJ]).catch(() => null);
    const l = await p.evaluate(LUGAR).catch(() => null);
    if (!r || !l) continue;
    marca = r.m2; marcaJ = r.mj2;
    // el primer segundo de cada lugar se tira (la transición de una pantalla a otra no es «estar» en ese lugar)
    const clave = `${flujo} · ${l.capa ? l.capa + ' sobre ' : ''}sección ${hex(l.s)} página ${hex(l.pg)}${l.et >= 0 && l.s >= 0x1f && l.s <= 0x22 ? ' etapa ' + l.et : ''}`;
    const c = cajones[clave] ||= { ms: [], juego: [], seg: 0, periodo: l.periodo, ant: null };
    if (c.ant === 'aqui') { c.ms.push(...r.t); c.juego.push(...r.j); c.seg++; }
    for (const k in cajones) cajones[k].ant = k === clave ? 'aqui' : null;
    // los pasos del flujo
    if (flujo === 'inicio' && !hecho.bienvenida && Date.now() - inicio > 30000) { hecho.bienvenida = true; await p.keyboard.press('Escape').catch(() => {}); }
    if (flujo === 'sala') {
      // el selector de la copa: 15 s a la vista, después se fija una pista (lo mismo que el selector al confirmar)
      if (l.picker && l.s === 0x49 && !hecho.pistas) { hecho.pistasDesde ||= Date.now(); if (Date.now() - hecho.pistasDesde > 15000) { hecho.pistas = true; await p.evaluate(() => window.mkwSala.ponerPistas([{ copa: 0, fila: 0 }, { copa: 0, fila: 1 }])).catch(() => {}); } }
      // elegir personaje: 15 s mirando la pantalla de personaje, después A, A, A, A (personaje, kart, derrape)
      if (hecho.pistas && !hecho.elegido && !l.eleccion && [0x6B, 0x6C, 0x10E, 0x6D].includes(l.pg) && !l.capa) {
        hecho.elegirDesde ||= Date.now();
        if (Date.now() - hecho.elegirDesde > 15000) { for (let i = 0; i < 6; i++) { await p.keyboard.down('KeyK').catch(() => {}); await espera(120); await p.keyboard.up('KeyK').catch(() => {}); await espera(700); } }
      }
      if (l.eleccion) hecho.elegido = true;
      if (ultimaEt >= 3 && l.et < 0 && hecho.elegido) hecho.carreras++;
      ultimaEt = l.et;
      if (hecho.carreras >= 1 && l.breve === false && l.s === 0x49 && Date.now() - inicio > 150000) break;
    }
  }
  // (§270: lo que hizo el ritmo de los menús en este flujo: N al final, cuántas veces cambió, cuadros con compás, corridos)
  const rm = await p.evaluate(() => window.mkwEstado?.ritmoMenus ?? null).catch(() => null);
  if (rm) console.log(`[ritmo de los menús] ${flujo}${extra}: ${JSON.stringify(rm)}`);
  await contexto.close();
}

const salida = {};
for (const extra of variantes) {
  const cajones = {};
  for (const f of FLUJOS) await correrFlujo(f, extra, cajones);
  salida[extra || '(por omisión)'] = {};
  console.log(`\n=== variante "${extra || '(por omisión)'}"`);
  for (const [k, c] of Object.entries(cajones).sort()) {
    if (c.ms.length < 120) continue;   // menos de 2 s de imágenes: no alcanza para un 1 % bajo
    const r = resumir(c.ms);
    salida[extra || '(por omisión)'][k] = { ms: c.ms, juego: c.juego, periodo: c.periodo };
    console.log(`${k} (${c.seg} s): ${textoResumen(r)}`);
    if (c.juego.length >= 120) { const j = resumir(c.juego); console.log(`    juego (cuadros que calcula): ${j.fps.toFixed(1)}/s · 1 % bajo ${j.bajo1.toFixed(1)} · 0,1 % bajo ${j.bajo01.toFixed(1)} · peor ${j.maxMs.toFixed(1)} ms`); }
    if (c.periodo) console.log(`    refrescos por imagen (monitor ${(1000 / c.periodo).toFixed(0)} Hz): ${JSON.stringify(histograma(c.ms, c.periodo))}`);
  }
  // todo junto, por flujo
  for (const f of FLUJOS) {
    const ms = Object.entries(cajones).filter(([k]) => k.startsWith(f + ' ')).flatMap(([, c]) => c.ms);
    const js = Object.entries(cajones).filter(([k]) => k.startsWith(f + ' ')).flatMap(([, c]) => c.juego);
    if (ms.length) console.log(`TODO ${f}: ${textoResumen(resumir(ms))}${js.length ? ` · juego 1 % bajo ${resumir(js).bajo1.toFixed(1)}` : ''}`);
  }
}
if (JSON_SALIDA) fs.writeFileSync(JSON_SALIDA, JSON.stringify(salida));
await navegador.close(); servidor.kill();
process.exit(0);
