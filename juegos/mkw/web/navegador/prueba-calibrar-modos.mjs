// Prueba con el juego: la «⚡ Auto calibración» pausa la carrera en todos los modos de una consola — bitácora §287.
//
// Resumen: el dueño pidió «autocalibracion debe pausar a todos en todos los modos de juego». Para cada modo (Single
// Player directo, VS, Contrarreloj y GP por los menús, Local de 2 con la pantalla partida, y la sala de 1 humano con
// «Cada uno su kart», que desde §288 corre la carrera de siempre) abre la página, espera la carrera andando, aprieta el
// botón de verdad de Gráficos y mira cada 250 ms: mientras calibra el reloj de la carrera (Raceinfo +0x1C + +0x20) no
// avanza y se ve el aviso «⏸ Calibrando tu imagen — vuelve en N s»; al terminar el aviso se va y la carrera sigue.
// Las salas de 2 o más consolas van en prueba-sala --calibrar y prueba-sala-estado --calibrar.
//
// Uso:  MKW_BUILD=build/web-final-v22/navegador node web/navegador/prueba-calibrar-modos.mjs [--casos sp,vs,tt,gp,sala1[,local2]]
//       [--ventana] [--puerto 8176]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8176));
const VENTANA = process.argv.includes('--ventana');
const carpeta = path.join(raiz, 'build/web/datos/auto-calibrar/modos');
mkdirSync(carpeta, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

// los modos: la dirección de cada uno (los de los menús los maneja el piloto de la página, §66)
const uid = 'solo-calib';
const CASOS = {
  sp: { nombre: 'Single Player (carrera directa, 11 CPU)', q: 'modo=directa&pista=13.2&cc=c150&cpu=maximo&pj=0&kart=1' },
  vs: { nombre: 'VS por los menús', q: 'modo=vs&copa=0&fila=0&cpu=maximo' },
  tt: { nombre: 'Contrarreloj por los menús', q: 'modo=tt&copa=0&fila=0' },
  gp: { nombre: 'Grand Prix por los menús', q: 'modo=gp&copa=0&cpu=maximo' },
  local2: { nombre: 'Local de 2 (pantalla partida)', q: 'modo=directa&vistas=2&pista=13.2&cc=c150&cpu=maximo&pj=0&kart=1' },
  sala1: { nombre: 'la sala de 1 humano («Cada uno su kart»: la carrera de siempre, §288)',
           q: `modo=sala&red=estado&sincro=${uid}&uid=${uid}&jefe=${uid}&semilla=4321&estilo=copa&carreras=1&cc=c150&cpu=maximo&copaReloj=8&eleccion=8&descanso=5` },
};
// (local2 aparte: la página no logra darle al juego el mando del jugador 2 —con mandos de mentira la carrera queda
// en la página 0x3A, cuadro 22— y Local está «en obra» en el producto, §116; el camino es el mismo de Single Player)
const casos = opcion('--casos', 'sp,vs,tt,gp,sala1').split(',').filter(c => CASOS[c]);

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);   // (el monitor de 144 Hz)
const navegador = await chromium.launch({ channel: 'chrome', headless: !VENTANA,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', ...(VENTANA ? [`--window-position=${vx},${vy}`] : [])] });
const resultado = {};
try {
  for (const k of casos) {
    const caso = CASOS[k];
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
    // (Local de 2: dos mandos de mentira conectados y quietos: sin el mando del jugador 2 el juego para la carrera con su
    // aviso de mando desconectado, la página 0x3A)
    if (k === 'local2') await ctx.addInitScript(() => {
      const mando = i => ({ id: `Mando de mentira ${i} (STANDARD GAMEPAD Vendor: 0001 Product: 000${i})`, index: i, connected: true, mapping: 'standard',
        timestamp: performance.now(), axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), vibrationActuator: null });
      const lista = [mando(0), mando(1)];
      Object.defineProperty(navigator, 'getGamepads', { value: () => { lista.forEach(m => { m.timestamp = performance.now(); }); return lista; }, configurable: true });
    });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', e => errores.push(e.message));
    try {
      await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&${caso.q}`);
      // la carrera andando (etapa 2); en la sala, la copa: la anfitriona (yo) confirma la que marque el selector
      const vista = () => p.evaluate(() => { const L = window.mkwMenus, ri = L?.u32?.(0x809BD730), a = window.mkwAutoCalibrar?.estado;
        const av = document.getElementById('pausaSala');
        return { etapa: ri ? L.u32(ri + 0x28) : null, reloj: ri ? L.u32(ri + 0x1C) + L.u32(ri + 0x20) : null,
          cong: a?.congeladaPor ?? null, corriendo: !!a?.corriendo, texto: a?.texto ?? null, aviso: av && !av.hidden ? av.querySelector('b')?.textContent : '',
          copa: !!document.getElementById('copaJugar'), h: (a?.historial || []).slice(-10) }; }).catch(e => ({ error: e.message }));
      let v = null;
      for (const h = Date.now() + (k === 'local2' ? 180000 : 420000); Date.now() < h;) {
        v = await vista();
        if (v?.etapa === 2) break;
        if (v?.copa) await p.evaluate(() => document.getElementById('copaJugar')?.click()).catch(() => {});
        await espera(1000);
      }
      if (v?.etapa !== 2) {
        const log = await p.evaluate(() => { const E = window.mkwEstado || {}, L = window.mkwMenus;
          return JSON.stringify({ cong: window.mkw?._mkw_congelado_estado?.(0), oculta: E.pausaOculta, paquete: E.esperaPaquete, menus: L?.estado?.(), ficha: E.ficha && { pantallas: E.ficha.pantallas, puestos: (E.ficha.puestos || []).slice(0, 3) } })
            + String.fromCharCode(10) + (E.log || []).filter(l => !/aurora::gfx/.test(l)).slice(-30).join(String.fromCharCode(10)); }).catch(e => e.message);
        ok(`${caso.nombre}: la carrera anda`, false, JSON.stringify(v).slice(0, 300)); console.log(log); continue; }
      await p.keyboard.down('KeyK').catch(() => {});   // (acelerar: el kart propio se mueve)
      await espera(6000);
      const apretado = await p.evaluate(() => { const b = document.getElementById('autoCalibrar'); if (!b) return false; b.click(); return true; });
      const relojes = [], avisos = new Set();
      let fin = null, visto = false;
      for (const h = Date.now() + 45000; Date.now() < h;) {
        const x = await vista();
        if (x?.cong) { visto = true; relojes.push(x.reloj); }
        if (x?.aviso) avisos.add(x.aviso.replace(/\d+ s$/, 'N s'));
        if (visto && x && !x.corriendo && !x.cong) { fin = x; break; }
        if (x && !x.corriendo && /No se calibró/.test(x.texto || '')) { fin = x; break; }
        await espera(250);
      }
      const r1 = (await vista())?.reloj; await espera(3000); const despues = await vista();
      const quieto = relojes.length > 4 && Math.max(...relojes) - Math.min(...relojes) <= 1;
      resultado[k] = { apretado, relojes: [relojes[0], relojes.at(-1), relojes.length], avisos: [...avisos], fin, despues, errores };
      console.log(`  ${k}: ${JSON.stringify(resultado[k]).slice(0, 1500)}`);
      ok(`${caso.nombre}: la carrera queda quieta mientras calibra, con el aviso «⏸ Calibrando tu imagen…»`,
         apretado && visto && quieto && [...avisos].some(a => /Calibrando tu imagen/.test(a)),
         `reloj ${relojes[0]}–${relojes.at(-1)} en ${relojes.length} vistas · ${[...avisos].join(' | ')}`);
      ok(`${caso.nombre}: termina, el aviso se va y la carrera sigue (más de 100 cuadros en 3 s)`,
         !!fin?.texto && /^Elegido: /.test(fin.texto) && !despues?.aviso && (despues?.reloj ?? 0) - (r1 ?? 0) > 100,
         `${fin?.texto || ''} · ${r1} → ${despues?.reloj}`);
      await p.screenshot({ path: path.join(carpeta, `${k}.png`) }).catch(() => {});
    } catch (e) { ok(`${caso.nombre}: sin errores de la prueba`, false, e.stack || String(e)); }
    finally { await ctx.close().catch(() => {}); }
  }
} finally {
  writeFileSync(path.join(carpeta, 'modos.json'), JSON.stringify(resultado, null, 1));
  console.log(`\n${bien} bien, ${mal} mal`);
  await navegador.close().catch(() => {});
  servidor.kill();
}
process.exit(mal ? 1 : 0);
