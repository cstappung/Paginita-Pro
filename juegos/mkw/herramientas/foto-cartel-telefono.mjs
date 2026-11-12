// foto-cartel-telefono.mjs — fotos del cartel de la carga (§276b) en el teléfono de verdad, 1.ª visita (incógnito).
//
// Resumen: todo pasa por el marco seguro (telefono-seguro.mjs: lista blanca de órdenes de adb, pestaña de incógnito que
// Chrome borra al cerrarla, limpieza garantizada, la pantalla prendida y devuelta exacta). Dentro de esa pestaña, cada
// 200 ms lee lo que dice la cortina; cada texto distinto queda anotado con su hora y cada FASE nueva (lo de antes de «:»
// o «…») lleva una foto 0,5 s después (la cortina tiene un fundido de 0,4 s). Al ver el menú de inicio elige Single
// Player, como un toque en el botón, y sigue igual en la espera de los gráficos de los menús hasta el menú «Un jugador».
// Uso (con el candado; antes nada en el puerto 8140):
//   MKW_BUILD=build/web-final-w30/navegador node herramientas/foto-cartel-telefono.mjs [--etiqueta oppo]
// Salida: build/vistas/cartel-<etiqueta>-NN.png + cartel-<etiqueta>.json (los textos con su hora)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir, crearAdb, buscarAdb, conectarPlaywright, recuerdoPantalla } from './telefono-seguro.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PUERTO = 8140, ETIQUETA = opcion('--etiqueta', 'oppo');
const carpeta = path.join(raiz, 'build/vistas'); fs.mkdirSync(carpeta, { recursive: true });
const registro = l => fs.appendFileSync(path.join(carpeta, `cartel-${ETIQUETA}-registro.txt`), `${new Date().toISOString()} ${l}\n`);
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: process.env });
await new Promise((listo, mal) => { servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }); servidor.on('exit', c => mal(new Error(`el servidor salió (${c}): ¿el puerto ${PUERTO} está ocupado?`))); });

const textos = [];
async function mirar(p) {
  const t0 = Date.now(), fases = new Set();
  let n = 0, elegido = false;
  // dentro de la página, cada 100 ms: lo que dice la cortina y si DE VERDAD se ve (opacidad y visibilidad calculadas;
  // por el cable cada pregunta tarda, así que la página anota sola y aquí solo se lee lo anotado)
  await p.evaluate(() => {
    window.__cartel = [];
    let ultimo = '';
    setInterval(() => {
      const c = document.getElementById('cortina'); if (!c) return;
      const s = getComputedStyle(c), texto = document.getElementById('cortinaTexto')?.textContent || '';
      const visible = s.visibility !== 'hidden' && Number(s.opacity) > 0.9;
      let sp = ""; try { const e = window.mkwMenus?.estado?.(); sp = e ? `${e.seccion}/${e.pagina}` : ""; } catch {}
      const firma = `${texto}|${visible}|${sp}`;
      if (firma !== ultimo) { ultimo = firma; window.__cartel.push({ ms: Math.round(performance.now()), texto, visible, sp,
        vivo: document.getElementById('cortinaVivo')?.textContent || '', calma: document.getElementById('cortinaCalma')?.textContent || '' }); }
    }, 100);
  }).catch(e => registro('anotador: ' + e.message));
  let leidos = 0;
  while (Date.now() - t0 < 300000) {
    const c = await p.evaluate(() => ({ anotado: window.__cartel || [], inicio: !!window.mkwInicio?.visible,
      un: window.mkwArranque?.marcas.unJugador != null, ms: Math.round(performance.now()),
      ahora: (() => { const s = getComputedStyle(document.getElementById('cortina')); return { texto: document.getElementById('cortinaTexto')?.textContent,
        visible: s.visibility !== 'hidden' && Number(s.opacity) > 0.9 }; })() })).catch(() => null);
    if (c) {
      for (const x of c.anotado.slice(leidos)) textos.push(x);
      leidos = c.anotado.length;
      // la foto en seguida, solo si la cortina se ve ahora y es una fase nueva
      const fase = (c.ahora.texto || '').split(/[:…]/)[0];
      if (c.ahora.visible && !fases.has(fase)) {
        fases.add(fase);
        await p.screenshot({ path: path.join(carpeta, `cartel-${ETIQUETA}-${String(++n).padStart(2, '0')}.png`) }).catch(e => registro('foto: ' + e.message));
      }
    }
    if (c?.inicio && !elegido) { elegido = true; textos.push({ ms: c.ms, texto: '(menú de inicio: Single Player)' }); await p.evaluate(() => { window.mkwInicio.elegir(0); window.mkwInicio.aceptar(); }).catch(() => {}); }
    if (c?.un) { textos.push({ ms: c.ms, texto: '(menú «Un jugador»)' }); break; }
    await espera(100);
  }
  const resto = await p.evaluate(() => window.__cartel || []).catch(() => []);
  for (const x of resto.slice(leidos)) textos.push(x);
  return { fotos: n, textos };
}

const adb = crearAdb({ ejecutable: buscarAdb(), puertos: [PUERTO], registro });
try {
  const r = await abrir({ adb, puertos: [PUERTO], ruta: '/?inicio=1&bienvenida=0', segundos: 400,
    conectar: (p, alCtx) => conectarPlaywright(p, {}, alCtx), pantalla: true, recuerdo: recuerdoPantalla(),
    esperar: ms => espera(ms), durante: mirar });
  fs.writeFileSync(path.join(carpeta, `cartel-${ETIQUETA}.json`), JSON.stringify({ textos, motivo: r.motivo, cambios: r.cambios }, null, 2));
  for (const x of textos.sort((a, b) => a.ms - b.ms)) console.log(`  ${(x.ms / 1000).toFixed(1).padStart(6)} s  ${x.visible === false ? "(no se ve) " : ""}${x.texto}${x.sp ? ` {juego ${x.sp}}` : ""}${x.vivo ? `   [${x.vivo}]` : ""}${x.calma ? "  · " + x.calma : ""}`);
  console.log(`${r.durante?.fotos ?? '?'} fotos → build/vistas/cartel-${ETIQUETA}-*.png · fin: ${r.motivo}`);
  console.log(r.cambios?.igual ? '✓ el teléfono quedó igual que antes (apps y ajustes)' : `✗ algo cambió: ${JSON.stringify(r.cambios)}`);
} finally {
  servidor.kill();
}
