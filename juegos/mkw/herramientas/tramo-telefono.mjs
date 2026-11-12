// tramo-telefono.mjs — el tramo fijo de §163 en el teléfono de verdad, dos programas intercalados (§277).
//
// Resumen: compara dos programas (p. ej. el motor de antes y el de después) en el celular del dueño con la MISMA
// carrera: Luigi Circuit, 12 CPU en máximo, semilla fija, sin tope (la carrera corre tan rápido como pueda el
// procesador del teléfono) y el tramo de cuadros 600-2400. Cada corrida levanta el servidor del juego con un programa,
// abre la pestaña por el marco seguro (herramientas/telefono-seguro.mjs: lista blanca de órdenes, incógnito que Chrome
// borra al cerrar, limpieza garantizada, foto antes/después, vigía del calor, pantalla prendida y devuelta exacta),
// espera el resultado del tramo (window.mkwEstado.tramo.resultado) y cierra. Las corridas van alternadas A B B A A B …
// porque el teléfono cambia de velocidad con el calor y su gestor de energía (como pesar en una balanza que deriva:
// se pesa A, B, B, A y la deriva se cancela).
// Uso (con el candado; nada en el puerto 8143):
//   node herramientas/tramo-telefono.mjs --a build/web-403-base/navegador --b build/web-403-todo/navegador
//        [--pares 2] [--etiqueta X] [--extra "&…"] [--espera 30]
// Salida: build/web/datos/telefono/tramo-<etiqueta>.json y una línea por corrida (lógica/s = el techo del procesador).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir, crearAdb, buscarAdb, conectarPlaywright, recuerdoPantalla } from './telefono-seguro.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PUERTO = 8143;
const LADOS = { a: opcion('--a'), b: opcion('--b') };
if (!LADOS.a || !LADOS.b) { console.log('uso: node herramientas/tramo-telefono.mjs --a <carpeta> --b <carpeta> [--pares 2] [--etiqueta X]'); process.exit(1); }
const PARES = Number(opcion('--pares', 2)), ETIQUETA = opcion('--etiqueta', 'tramo'), EXTRA = opcion('--extra', '');
const ENFRIAR = Number(opcion('--espera', 30)) * 1000;   // entre corridas: que la batería no suba de una a otra
const RUTA = `/?modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0&dibujarSiempre=1&n8=0&bienvenida=0${EXTRA}`;
const espera = ms => new Promise(r => setTimeout(r, ms));
const carpeta = path.join('build', 'web', 'datos', 'telefono');
fs.mkdirSync(carpeta, { recursive: true });
const lineas = [];
const registro = l => { lineas.push(`${new Date().toISOString()} ${l}`); fs.writeFileSync(path.join(carpeta, `tramo-${ETIQUETA}-registro.txt`), lineas.join('\n') + '\n'); };

async function corrida(lado) {
  // el servidor del juego con ESTE programa (el teléfono lo ve como su propio 127.0.0.1 por el túnel del cable)
  const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
    { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_BUILD: LADOS[lado] } });
  await new Promise((listo, mal) => { servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }); servidor.on('exit', c => mal(new Error(`el servidor salió (${c})`))); });
  const adb = crearAdb({ ejecutable: buscarAdb(), puertos: [PUERTO], registro });
  try {
    const r = await abrir({ adb, puertos: [PUERTO], ruta: RUTA, segundos: 600, esperar: espera, pantalla: true, recuerdo: recuerdoPantalla(),
      conectar: (p, alCtx) => conectarPlaywright(p, { fps: true }, alCtx),
      // durante la corrida: esperar el resultado del tramo (como mucho 9 min: carga + cuenta + 1800 cuadros)
      durante: async p => {
        const t0 = Date.now();
        while (Date.now() - t0 < 540000) {
          const t = await p.evaluate(() => window.mkwEstado?.tramo?.resultado ?? null).catch(() => null);
          if (t) return { tramo: t, cpuPura: await p.evaluate(() => window.mkwLastre?.()?.cpuPuraMs ?? null).catch(() => null) };
          await espera(2000);
        }
        return { tramo: null };
      } });
    const t = r.durante?.tramo;
    console.log(`${lado} ${path.basename(path.dirname(LADOS[lado]))}: ${t ? `lógica ${t.logicaPorSeg}/s · imágenes ${t.imagenesPorSeg}/s · trabajo ${t.porCuadro.trabajo} ms/cuadro · cpu ${t.cpuPorSeg}/s` : 'SIN tramo'} · ${r.cambios?.igual ? 'teléfono igual que antes ✓' : '✗ ' + JSON.stringify(r.cambios)} · ${r.historial?.at(-1)?.grados ?? '?'} °C`);
    return { lado, build: LADOS[lado], tramo: t ?? null, motivo: r.motivo, igual: r.cambios?.igual ?? null, grados: r.historial?.map(h => h.grados) };
  } finally { servidor.kill(); await espera(1000); }
}

const orden = [];
for (let i = 0; i < PARES; i++) orden.push(...(i % 2 ? ['b', 'a'] : ['a', 'b']));
const corridas = [];
for (const [k, lado] of orden.entries()) {
  if (k > 0) await espera(ENFRIAR);
  corridas.push(await corrida(lado));
  fs.writeFileSync(path.join(carpeta, `tramo-${ETIQUETA}.json`), JSON.stringify({ etiqueta: ETIQUETA, lados: LADOS, ruta: RUTA, corridas }, null, 2));
}
const media = l => { const v = corridas.filter(c => c.lado === l && c.tramo).map(c => c.tramo.logicaPorSeg); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : NaN; };
const pares = [];
for (let i = 0; i + 1 < corridas.length; i += 2) {
  const a = corridas.slice(i, i + 2).find(c => c.lado === 'a')?.tramo, b = corridas.slice(i, i + 2).find(c => c.lado === 'b')?.tramo;
  if (a && b) pares.push(Math.round((b.logicaPorSeg / a.logicaPorSeg - 1) * 1000) / 10);
}
console.log(`\nmedia lógica/s: a ${media('a').toFixed(1)} · b ${media('b').toFixed(1)} · b contra a ${((media('b') / media('a') - 1) * 100).toFixed(1)} % · por par: ${pares.join(' / ')} %`);
console.log(`→ ${path.join(carpeta, `tramo-${ETIQUETA}.json`)}`);
