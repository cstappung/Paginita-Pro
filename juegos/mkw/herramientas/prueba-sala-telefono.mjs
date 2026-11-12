// La sala entre aparatos de verdad: este PC + el celular del dueño por el cable USB (bitácora §269b; el dueño conectó su
// teléfono para probar el multijugador entre aparatos, lo que con dos PC no se podía).
//
// Resumen: todo lo que toca el teléfono va por el marco seguro (herramientas/telefono-seguro.mjs: lista blanca de
// órdenes, pestaña de incógnito que se borra al cerrarla, limpieza garantizada, foto antes/después, vigía del calor,
// la pantalla prendida con el cable y devuelta exacta al terminar). Dos partes, cada una en su pestaña de incógnito:
//   1. Single Player en el teléfono: una carrera directa (la misma pista y semilla), el dedo en A en pantalla 20 s,
//      y se mide imágenes/s, el 1 % bajo y la lógica/s (la queja: «el móvil va peor que en las pruebas automáticas»).
//   2. La sala PC + celular (?modo=sala, una copa de 2 carreras): el PC es la anfitriona (A), el teléfono la invitada
//      (B). La señal del banco cruza entre los dos navegadores por herramientas/puente-contextos.mjs (Node copia cada
//      mensaje); la carrera va por WebRTC entre el PC y el teléfono. Cada uno elige personaje con las pantallas del
//      juego; en cada carrera, desde el «¡YA!», el PC acelera con su tecla y el teléfono con el dedo en el botón A de la
//      pantalla (toques de verdad por DevTools en esa pestaña). Se mira:
//        - los botones del teléfono responden después del «¡YA!»: su kart avanza (en las dos consolas);
//        - nada queda pegado: al levantar el dedo, A suelto y 0 dedos puestos;
//        - las huellas iguales (la misma carrera en las dos);
//        - imágenes/s, 1 % bajo y lógica/s del teléfono en la sala, contra el Single Player de la parte 1;
//        - si el teléfono se cae: la caja negra (mkw.caida) en el informe.
// Uso:  MKW_BUILD=build/web-final-w30/navegador node herramientas/prueba-sala-telefono.mjs [--pistas 0.0,13.2]
//       [--solo sp|sala] [--segundos 20] [--extra "&…"]
//   (el teléfono con la depuración USB y Chrome abierto; TELEFONO_ADB=ruta de adb.exe; con el candado de medición)
// Salida: build/web/datos/telefono/<fecha>/sala-telefono.json
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';
import { abrir, crearAdb, buscarAdb, conectarPlaywright, recuerdoPantalla } from './telefono-seguro.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PUERTO = 8140;                    // el que el teléfono ve como su propio 127.0.0.1 (el túnel del cable)
const EXTRA = opcion('--extra', ''), SOLO = opcion('--solo', null), SEGUNDOS = Number(opcion('--segundos', 20));
const PISTAS = opcion('--pistas', '0.0,13.2').split(',').map(s => { const [copa, fila] = s.split('.').map(Number); return { copa, fila }; });
const carpeta = path.join('build', 'web', 'datos', 'telefono', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
fs.mkdirSync(carpeta, { recursive: true });
const lineas = [];
const registro = l => { lineas.push(`${new Date().toISOString()} ${l}`); fs.writeFileSync(path.join(carpeta, 'registro.txt'), lineas.join('\n') + '\n'); };
let bien = 0, mal = 0;
const ok = (t, c, d = '') => { c ? bien++ : mal++; const l = `${c ? '✓' : '✗'} ${t}${d ? ' — ' + d : ''}`; console.log(l); registro(l); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const puente = puenteSenal();
const resultado = { pistas: PISTAS, extra: EXTRA };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const adb = crearAdb({ ejecutable: buscarAdb(), puertos: [PUERTO], registro });

// ---- lo que se lee de una pestaña (la del PC o la del teléfono) ----
const leer = p => Promise.race([espera(10000).then(() => ({ colgada: true })), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730), ls = window.mkwSincro?.lockstep?.estado?.();
  const f = x => new DataView(new Uint32Array([x]).buffer).getFloat32(0, true);
  const av = []; try { const lista = L.u32(ri + 0xC); for (let i = 0; i < 12; i++) av.push(f(L.u32(L.u32(lista + 4 * i) + 0xC))); } catch {}
  return { s: e.seccion, pagina: e.pagina, etapa: ri ? L.u32(ri + 0x28) : -1, av, eleccion: window.mkwEstado.eleccion || null,
    cortina: !document.body.classList.contains('sin-cortina'), picker: !!document.getElementById('elegirPista'), sala: window.mkwEstado.sala || null,
    enCarrera: !!window.mkwEstado.enCarrera, cuadro: ls?.cuadro ?? 0, huellas: ls?.huellasIguales ?? null, desinc: ls?.desincronizado ?? null,
    recibidos: ls?.recibidosDe ?? null, caida: (() => { try { return localStorage.getItem('mkw.caida'); } catch { return null; } })() };
})]).catch(() => null);
// (cada 10 s, una línea con lo que hace la pestaña mientras se espera: si se ve, la cortina, el registro; solo leer)
const comoVa = p => p.evaluate(() => ({ visible: document.visibilityState, cortina: document.getElementById('cortina')?.innerText?.slice(0, 80) ?? null,
  juego: !!window.mkwMenus?.estado?.(), ultimo: (window.mkwEstado?.log || []).slice(-1)[0]?.toString().slice(0, 120) ?? null })).catch(e => ({ error: e.message.slice(0, 80) }));
const esperarQue = async (p, f, tope = 120000) => { let aviso = Date.now() + 10000;
  for (const h = Date.now() + tope; Date.now() < h;) { const x = await leer(p); if (x?.caida) ultimaCaja.set(p, x.caida); if (x && f(x)) return x;
    if (Date.now() > aviso) { aviso = Date.now() + 10000; console.log(`  … ${p === telefonoPagina ? 'teléfono' : 'PC'}: ${JSON.stringify(x ? { s: x.s, pagina: x.pagina, etapa: x.etapa } : await comoVa(p))}`); }
    await espera(500); } return leer(p); };
let telefonoPagina = null;
// medir N s: cada cuadro nuevo del juego visto por requestAnimationFrame (imágenes/s, 1 % bajo) y la lógica (Raceinfo)
const medir = (p, s) => p.evaluate(async seg => {
  const L = window.mkwMenus, ri = L.u32(0x809BD730), l0 = L.u32(ri + 0x20), t0 = performance.now(), t = [];
  let antes = window.mkwCuadros?.() ?? 0, fin = false;
  // el gráfico del tiempo de cada imagen (§256, ?verGrafico=1, se ve en la pantalla): su marca para leer después el
  // resumen, la causa de cada pico (pipeline, disco, sala, juego, otro) y los tiempos de este rato
  const IV = window.mkwEstado.imagenes, m0 = IV?.marca?.() ?? null;
  const paso = h => { if (fin) return; const c = window.mkwCuadros?.() ?? 0; if (c !== antes) { t.push(h); antes = c; } requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
  // cada segundo, lo que ve la vigía de N8 (imágenes, lógica, CPU por cuadro y «ocupado») y lo esperado a la sala: en el
  // teléfono la sala prendía N8 (30 imágenes) y el Single Player no (45): ¿la sala parece más ocupada sin estarlo?
  const vig = [], iv = setInterval(() => { const e = window.mkwEstado, a = e.n8auto;
    vig.push({ u: a?.ultimo ? { i: Math.round(a.ultimo.imagenes), l: Math.round(a.ultimo.logica), ms: +a.ultimo.juegoMs.toFixed(1), oc: +a.ultimo.ocupado.toFixed(2) } : null,
      pr: a?.prendido ?? null, aj: a?.ajenos ?? 0, tr: +(e.trabajo ?? 0).toFixed(1), sala: e.esperaSala?.ms ?? null }); }, 1000);
  await new Promise(r => setTimeout(r, seg * 1000)); fin = true; clearInterval(iv);
  const dur = (performance.now() - t0) / 1000, d = [];
  for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
  d.sort((a, b) => a - b);
  const p99 = d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.99))] : null;
  // el ritmo (el dueño: «lo importante del frame pacing»): la desviación de los intervalos entre imágenes, la mediana y
  // cuántos intervalos salen más de 1,5 veces la mediana (tirones: una imagen que se repitió de más en la pantalla)
  const med = d.length ? d[Math.floor(d.length / 2)] : null, prom = d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
  const desv = d.length ? Math.sqrt(d.reduce((a, b) => a + (b - prom) ** 2, 0) / d.length) : null;
  const ritmo = d.length ? { medianaMs: +med.toFixed(1), desvMs: +desv.toFixed(1), tirones: d.filter(x => x > 1.5 * med).length, tironesPct: +(100 * d.filter(x => x > 1.5 * med).length / d.length).toFixed(1) } : null;
  return { imagenes: +(t.length / dur).toFixed(1), bajo1: p99 ? +(1000 / p99).toFixed(1) : null, ritmo, logica: +((L.u32(ri + 0x20) - l0) / dur).toFixed(1),
    n8: (() => { try { return window.mkwEstado.n8?.()?.activo ?? null; } catch { return null; } })(), vigia: vig,
    grafico: m0 === null ? null : { resumen: IV.resumen(m0), causas: IV.causas(m0), tiempos: IV.tiempos(m0).map(x => Math.round(x * 10) / 10) } };
}, s).catch(e => ({ error: e.message }));

// ---- los dedos en la pestaña del teléfono (Input.dispatchTouchEvent: toques de verdad, solo dentro de esa pestaña) ----
async function dedos(p) {
  const cdp = await p.context().newCDPSession(p);
  const puestos = new Map();
  const enviar = tipo => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: [...puestos].map(([id, q]) => ({ x: q.x, y: q.y, id, radiusX: 8, radiusY: 8 })) });
  const boton = pieza => p.evaluate(id => { const e = document.querySelector(`.mkw-tactil [data-pieza="${id}"]`); if (!e) return null;
    const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, pieza);
  const juego = () => p.evaluate(() => { const c = window.mkwControles; const q = c?.estado?.puertos?.[0]; const t = c?.tactilDedos?.();
    return { botones: q?.botones ?? null, dedos: t?.dedos ?? null, activo: c?.tactilActivo?.() ?? null }; }).catch(() => null);
  return {
    juego, boton,
    // (las reglas de Input.dispatchTouchEvent: touchStart solo con la pantalla libre; sumar, mover o levantar uno con
    // otros puestos va como touchMove con los que quedan; touchEnd, sin ninguno, cuando se levanta el último)
    poner: async (id, q) => { const vacia = puestos.size === 0; puestos.set(id, q); await enviar(vacia ? 'touchStart' : 'touchMove'); },
    mover: async (id, q) => { if (!puestos.has(id)) return; puestos.set(id, q); await enviar('touchMove'); },
    levantar: async id => { if (!puestos.delete(id)) return; if (puestos.size) await enviar('touchMove'); else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    soltarTodo: async () => { if (puestos.size) { puestos.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {}); } },
  };
}
const A_BIT = 0x0100;

// ---- manejar como una persona (el dueño: «el lag aparece con las interacciones»; «pésima la conducción»): un piloto
// automático. En la pestaña, cada vez que se le pregunta, lee dónde está el kart de esta consola y la ruta de las CPU
// del course.kmp ya cargado, y dice hacia dónde mover el stick para ir al punto de la ruta que está ~1.800 unidades más
// adelante, y si derrapar (curva cerrada y rápido). Afuera, cada 50 ms, el dedo de verdad en el stick del teléfono (o las
// teclas en el PC) hace eso: dobla con el stick, derrapa con R en las curvas (y suelta para el turbo), usa el objeto con L
// cada ~3 s y hace un truco en los saltos de vez en cuando. Los choques con los otros karts salen solos.
// Las direcciones (PAL, leídas en la memoria del juego corriendo, §269b): CourseMap 0x809BD6E8 +0x18 = la ruta de las CPU
// (ENPT: +0 el arreglo, +4 la cuenta; cada punto → sus datos: x, y, z, ancho); el kart: Kart::Manager 0x809C18F8 +0x20
// → kart → Pointers (+0x1C) +0x24 → +0xA0 la posición x, y, z. El kart de esta consola es el que tiene mando
// (RaceinfoPlayer +0x48), como en vibracion-eventos.mjs. Devuelve una función para parar, que suelta todo. ----
const PILOTO = yo => {
  const L = window.mkwMenus, dv = new DataView(new ArrayBuffer(4));
  const f = a => { dv.setUint32(0, L.u32(a)); return dv.getFloat32(0); };
  const ram = a => (a >= 0x80000000 && a < 0x81800000) || (a >= 0x90000000 && a < 0x94000000);
  let idx = -1, rutaDe = 0, sig = null, pts = null, antes = null;
  const huellas = []; let guiaFijo = -1;
  // la ruta y quién sigue a quién: los grupos ENPH (+0x14: cada uno el primer punto, cuántos, de dónde viene y a dónde
  // va: 6 bytes cada lista, 255 = nada). En un desvío se sigue el primero.
  const armar = () => {
    const cm = L.u32(0x809BD6E8), acc = L.u32(cm + 0x18), arr = L.u32(acc), m = L.u16(acc + 4);
    const h = L.u32(cm + 0x14), harr = L.u32(h), hn = L.u16(h + 4);
    if (!ram(arr) || !m || !ram(harr)) return false;
    pts = []; for (let i = 0; i < m; i++) { const r = L.u32(L.u32(arr + 4 * i)); pts.push([f(r), f(r + 8)]); }
    const grupos = []; for (let g = 0; g < hn; g++) { const r = L.u32(L.u32(harr + 4 * g)); grupos.push({ ini: L.u8(r), n: L.u8(r + 1), sig: L.u8(r + 8) }); }
    sig = pts.map((_, i) => i + 1);
    for (const g of grupos) { const fin = g.ini + g.n - 1; if (fin < m) sig[fin] = g.sig < hn ? grupos[g.sig].ini : 0; }
    rutaDe = arr; return true;
  };
  window.__piloto = { idx: () => idx, leer() {
    const ri = L.u32(0x809BD730); if (!ram(ri) || L.u32(ri + 0x28) !== 2) return null;
    const acc = L.u32(L.u32(0x809BD6E8) + 0x18);
    if (!pts || L.u32(acc) !== rutaDe) { idx = -1; if (!armar()) return null; }
    const km = L.u32(0x809C18F8), kart = L.u32(L.u32(km + 0x20) + 4 * yo), b = L.u32(kart + 0x1C + 0x8);
    if (!ram(b)) return null;
    // KartBody: la matriz del kart (3 filas de 4 desde +0x1C): la última columna es dónde está, la tercera hacia dónde mira
    // KartBody: la matriz del kart (3 filas de 4 desde +0x1C): la última columna es dónde está. Hacia dónde va: lo que se
    // movió desde la última vez (parado, la dirección de la ruta)
    const x = f(b + 0x28), z = f(b + 0x48);
    const movido = antes ? Math.hypot(x - antes[0], z - antes[1]) : 0;
    let hx = movido > 20 ? x - antes[0] : 0, hz = movido > 20 ? z - antes[1] : 0;
    const m = pts.length, d2 = i => (pts[i][0] - x) ** 2 + (pts[i][1] - z) ** 2;
    // al principio (o perdido): el punto más cercano que apunte hacia donde va el kart (parado: el más cercano)
    const buscar = () => { let mejor = -1; for (let i = 0; i < m; i++) if ((mejor < 0 || d2(i) < d2(mejor)) && (!(movido > 20) || (pts[sig[i]][0] - pts[i][0]) * hx + (pts[sig[i]][1] - pts[i][1]) * hz > 0)) mejor = i; return mejor < 0 ? 0 : mejor; };
    if (idx < 0) idx = buscar();
    if (!(movido > 20)) { hx = pts[sig[idx]][0] - pts[idx][0]; hz = pts[sig[idx]][1] - pts[idx][1]; }
    // avanzar por la ruta mientras el punto siguiente quede más cerca (o el kart ya pasó el actual)
    for (let k = 0; k < 6; k++) { const n = sig[idx]; const pasado = (pts[n][0] - pts[idx][0]) * (x - pts[idx][0]) + (pts[n][1] - pts[idx][1]) * (z - pts[idx][1]) > 0; if (d2(n) < d2(idx) || pasado) idx = n; else break; }
    // si quedó lejos de la ruta (se cayó, lo rescataron): buscar otra vez, ahora mismo («lejos» = más que dos tramos de la
    // ruta: en las pistas grandes los puntos están separados)
    const tramo = Math.hypot(pts[sig[idx]][0] - pts[idx][0], pts[sig[idx]][1] - pts[idx][1]);
    if (Math.sqrt(d2(idx)) > Math.max(5000, 2 * tramo)) idx = buscar();
    // el objetivo: el primer punto a más de 1.800 de distancia hacia adelante
    let o = idx;
    for (let k = 0; k < 10; k++) { o = sig[o]; if (Math.hypot(pts[o][0] - x, pts[o][1] - z) > (window.__mira || 1300)) break; }
    let tx = pts[o][0] - x, tz = pts[o][1] - z, por = 'ruta';
    // mejor: la huella del kart que va justo adelante (por dónde pasó de verdad: las CPU no se meten contra los muros, y
    // en las pistas de varios pisos la altura cuenta). Cada llamada anota dónde está cada kart (hasta 600 lugares).
    const ri2 = L.u32(0x809BD730), lista = L.u32(ri2 + 0xC), n = Math.min(12, L.u8(km + 0x24)), y = f(b + 0x38);
    const av = i => f(L.u32(lista + 4 * i) + 0xC);
    for (let i = 0; i < n; i++) { const bi = L.u32(L.u32(L.u32(km + 0x20) + 4 * i) + 0x1C + 0x8); if (!ram(bi)) continue;
      const h = huellas[i] ||= []; const q = [f(bi + 0x28), f(bi + 0x38), f(bi + 0x48)], u = h[h.length - 1];
      if (!u || Math.hypot(q[0] - u[0], q[2] - u[2]) > 120 || Math.abs(q[1] - u[1]) > 300) { if (u && Math.hypot(q[0] - u[0], q[2] - u[2]) > 3000) h.length = 0; h.push(q); if (h.length > 600) h.shift(); } }
    // el guía: el que va justo adelante; se mantiene mientras siga adelante y a menos de un cuarto de vuelta
    const mio = av(yo);
    if (!(guiaFijo >= 0 && guiaFijo < n && av(guiaFijo) > mio && av(guiaFijo) - mio < 0.25)) {
      guiaFijo = -1; for (let i = 0; i < n; i++) if (i !== yo && av(i) > mio && (guiaFijo < 0 || av(i) < av(guiaFijo))) guiaFijo = i; }
    const guia = guiaFijo;
    const h = guia >= 0 ? huellas[guia] : null;
    if (window.__huella && h && h.length > 5) {   // (seguir la huella: probado, no mejoró; solo con window.__huella)
      let c = -1, dc = Infinity;
      for (let k = 0; k < h.length; k++) { const d = Math.hypot(h[k][0] - x, h[k][2] - z) + 2 * Math.abs(h[k][1] - y); if (d < dc) { dc = d; c = k; } }
      if (dc < 2500 && c < h.length - 2) {
        let k = c, recorrido = 0;
        while (k < h.length - 1 && recorrido < (window.__mira || 900)) { recorrido += Math.hypot(h[k + 1][0] - h[k][0], h[k + 1][2] - h[k][2]); k++; }
        tx = h[k][0] - x; tz = h[k][2] - z; por = 'huella ' + guia;
      }
    }
    const ang = Math.atan2(hx * tz - hz * tx, hx * tx + hz * tz);   // >0 = el objetivo queda a la derecha (medido: el eje x del juego va al revés)
    const rapidez = antes ? movido / Math.max(1, performance.now() - antes[2]) * 1000 : 0;
    if (!antes || movido > 20 || performance.now() - antes[2] > 400) antes = [x, z, performance.now()];
    const s = Math.max(-1, Math.min(1, ang / 0.5));
    return { s: +s.toFixed(2), ang: +(ang * 57.3).toFixed(0), derrape: Math.abs(ang) > 0.4 && rapidez > 1500, rapidez: Math.round(rapidez), idx, m, por };
  } };
};
function manejar(p, d, yo = 0) {
  let parar = false;
  const hecho = (async () => {
    await p.evaluate(PILOTO, yo);
    const leer = () => p.evaluate(() => window.__piloto.leer()).catch(() => null);
    let derrapando = false, soltando = false, ultObjeto = Date.now(), cuenta = { pasos: 0, derrapes: 0, objetos: 0, frenadas: 0, sinDato: 0 }, lado = 0;
    const st = d ? await d.stick() : null, qr = d ? await d.boton('R') : null, ql = d ? await d.boton('L') : null;
    if (d && !st) return { error: 'sin stick' };
    if (d) await d.poner(2, { x: st.x, y: st.y });
    let quietoDesde = 0;
    while (!parar) {
      const v = await leer();
      cuenta.pasos++;
      if (!v) { cuenta.sinDato++; await espera(50); continue; }
      // trabado contra algo más de 1,5 s: marcha atrás 1 s con el stick al revés (lo que hace una persona)
      if (v.rapidez < 300) { quietoDesde ||= Date.now(); } else quietoDesde = 0;
      if (quietoDesde && Date.now() - quietoDesde > 1500) {
        cuenta.atras = (cuenta.atras || 0) + 1; quietoDesde = 0;
        const qb = d ? await d.boton('B') : null;
        if (d) { if (derrapando) { await d.levantar(3); derrapando = false; } await d.levantar(1); if (qb) await d.poner(5, qb); await d.mover(2, { x: st.x - Math.sign(v.s || 1) * st.r * 0.85, y: st.y }); }
        else { await p.keyboard.up('KeyL'); derrapando = false; await p.keyboard.up('KeyK'); await p.keyboard.down('KeyJ'); }
        await espera(1000);
        if (d) { if (qb) await d.levantar(5); const qa = await d.boton('A'); if (qa) await d.poner(1, qa); }
        else { await p.keyboard.up('KeyJ'); await p.keyboard.down('KeyK'); }
        continue;
      }
      // el derrape: se empieza en una curva cerrada yendo rápido y se suelta al enderezar (así sale el turbo)
      const quiere = derrapando ? Math.abs(v.ang) > 8 : v.derrape;
      if (quiere !== derrapando) {
        derrapando = quiere; if (quiere) cuenta.derrapes++;
        if (d) { if (quiere && qr) await d.poner(3, qr); else if (!quiere) await d.levantar(3); }
        else if (quiere) await p.keyboard.down('KeyL'); else await p.keyboard.up('KeyL');
      }
      // una curva muy cerrada yendo rápido: soltar el acelerador hasta que el kart apunte (lo que hace una persona)
      const soltar = Math.abs(v.ang) > 50 && v.rapidez > 2500 || (soltando && Math.abs(v.ang) > 30);
      if (soltar !== soltando) {
        soltando = soltar; cuenta.frenadas += soltar ? 1 : 0;
        if (d) { const qa = await d.boton('A'); if (soltar) await d.levantar(1); else if (qa) await d.poner(1, qa); }
        else if (soltar) await p.keyboard.up('KeyK'); else await p.keyboard.down('KeyK');
      }
      if (d) await d.mover(2, { x: st.x + v.s * st.r * 0.85, y: st.y });
      else {   // el teclado es todo o nada: se aprieta el lado si hace falta doblar
        const quiereLado = v.s > 0.25 ? 1 : v.s < -0.25 ? -1 : 0;
        if (quiereLado !== lado) { if (lado) await p.keyboard.up(lado > 0 ? 'KeyD' : 'KeyA'); if (quiereLado) await p.keyboard.down(quiereLado > 0 ? 'KeyD' : 'KeyA'); lado = quiereLado; }
      }
      if (Date.now() - ultObjeto > 3000 && !derrapando) {
        ultObjeto = Date.now(); cuenta.objetos++;
        if (d && ql) { await d.poner(4, ql); await espera(80); await d.levantar(4); } else if (!d) { await p.keyboard.down('Space'); await espera(80); await p.keyboard.up('Space'); }
      }
      await espera(50);
    }
    // (al terminar, el acelerador como estaba al empezar: si una curva lo había soltado, vuelve el dedo a A)
    if (soltando) { if (d) { const qa = await d.boton('A'); if (qa) await d.poner(1, qa); } else await p.keyboard.down('KeyK'); }
    if (d) { await d.levantar(3).catch(() => {}); await d.levantar(2).catch(() => {}); }
    else { for (const k of ['KeyL', 'KeyA', 'KeyD']) await p.keyboard.up(k).catch(() => {}); }
    return cuenta;
  })().catch(e => ({ error: e.message }));
  return async () => { parar = true; return hecho; };
}

// ---- parte 1: Single Player en el teléfono ----
// (si la pestaña del teléfono se cae: lo último que anotó la caja negra, leído antes de la caída)
const vigilarCaida = (B, r) => { B.on('crash', () => { r.caida = { cuando: new Date().toISOString(), cajaNegra: ultimaCaja.get(B) ?? null }; console.log('  ✗ la pestaña del teléfono se cayó: ' + JSON.stringify(r.caida).slice(0, 400)); }); };
const ultimaCaja = new Map();
async function singlePlayer(B) {
  telefonoPagina = B;
  const r = {};
  vigilarCaida(B, r);
  const x = await esperarQue(B, y => y.enCarrera && y.etapa === 2, 420000);
  ok('teléfono, Single Player: llega a la carrera', !!(x?.enCarrera && x.etapa === 2), x?.colgada ? 'pestaña colgada' : `etapa ${x?.etapa}`);
  if (!(x?.enCarrera)) return r;
  const d = await dedos(B);
  const qa = await d.boton('A');
  ok('teléfono: el mando en pantalla está puesto', !!qa, JSON.stringify(await d.juego()));
  if (qa) await d.poner(1, qa);
  await espera(3000);
  const pararSP = manejar(B, d, 0);
  r.medida = await medir(B, SEGUNDOS);
  r.manejo = await pararSP();
  const j = await d.juego();
  ok('teléfono, Single Player: con el dedo en A el juego ve A', !!(j && j.botones & A_BIT), JSON.stringify(j));
  await d.levantar(1); await espera(500);
  const j2 = await d.juego();
  ok('teléfono, Single Player: al levantar el dedo, A suelto y 0 dedos', !!j2 && !(j2.botones & A_BIT) && j2.dedos === 0, JSON.stringify(j2));
  console.log(`  teléfono, Single Player: ${JSON.stringify(r.medida)}`);
  return r;
}

// ---- parte 2: la sala PC + celular ----
async function sala(A, B) {
  telefonoPagina = B;
  const r = { carreras: [] };
  vigilarCaida(B, r);
  // §269b (el «azar» que se separa en el teléfono): con un programa de depuración (MKW_DEPURAR_LS=1, depurar_lockstep.cpp)
  // y DEPURA=1, las líneas «[DEPURA]» de cada consola van a su archivo, para compararlas
  if (process.env.DEPURA) for (const [p, n] of [[A, 'pc'], [B, 'telefono']]) {
    const arch = path.join(carpeta, `depura-${n}.txt`); fs.writeFileSync(arch, '');
    p.on('console', m => { const t = m.text(); if (t.startsWith('[DEPURA]')) fs.appendFileSync(arch, t + String.fromCharCode(10)); });
  }
  await esperarQue(A, x => x.picker, 300000);
  const puso = await A.evaluate(c => window.mkwSala.ponerPistas(c), PISTAS).catch(e => e.message);
  ok('la anfitriona (PC) fija la copa', puso === true, JSON.stringify(PISTAS));
  // cada uno elige con las pantallas del juego: el PC con su tecla A (K); el teléfono con el dedo en el A de la pantalla,
  // o con la tecla si en los menús no está el mando en pantalla
  const dB = await dedos(B);
  const elegir = async (p, esTel) => {
    let visto = false, ultimo = 0, aviso = 0;
    for (const h = Date.now() + 180000; Date.now() < h;) {
      const x = await leer(p);
      if (x?.eleccion) return x;
      // (cada 10 s, dónde está cada consola mientras elige: §269b, el teléfono que largó 2,6 min tarde)
      if (Date.now() > aviso) { aviso = Date.now() + 10000; const l = `  … eligiendo, ${esTel ? 'teléfono' : 'PC'}: ${JSON.stringify(x ? { s: x.s, pagina: x.pagina, cortina: x.cortina, etapa: x.etapa } : await comoVa(p))}`; console.log(l); registro(l); }
      if (x && !x.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina)) {
        if (!visto && x.pagina === 0x6B) { visto = true; await espera(800); if (esTel) { await p.keyboard.down('KeyD'); await espera(150); await p.keyboard.up('KeyD'); await espera(400); } }
        if (Date.now() - ultimo > 1300) { ultimo = Date.now(); await p.keyboard.down('KeyK'); await espera(150); await p.keyboard.up('KeyK'); }
      }
      await espera(300);
    }
    return leer(p);
  };
  const [ea, eb] = await Promise.all([elegir(A, false), elegir(B, true)]);
  ok('el PC y el teléfono eligieron personaje', !!(ea?.eleccion && eb?.eleccion));
  for (let carrera = 1; carrera <= PISTAS.length; carrera++) {
    const pista = `${PISTAS[carrera - 1].copa}.${PISTAS[carrera - 1].fila}`, c = { carrera, pista };
    const enCuenta = await Promise.all([A, B].map(p => esperarQue(p, x => x.sala?.fase === 'correr' && x.sala?.carrera === carrera && x.s === 0x20 && x.etapa >= 0 && x.etapa <= 1, 420000)));
    ok(`carrera ${carrera} (${pista}): las dos consolas en la cuenta`, enCuenta.every(x => x?.etapa >= 0 && x?.etapa <= 1), enCuenta.map(x => x?.colgada ? 'colgada' : `etapa ${x?.etapa}`).join(' / '));
    const ya = await Promise.all([A, B].map(p => esperarQue(p, x => x.etapa === 2, 120000)));
    // desde el «¡YA!»: el PC con la tecla, el teléfono con el dedo en A
    await A.keyboard.down('KeyK');
    const qa = await dB.boton('A');
    if (qa) await dB.poner(1, qa);
    await espera(2500);
    const av0 = await Promise.all([A, B].map(leer));
    const pararA = manejar(A, null, 0), pararB = manejar(B, dB, 1);   // (el PC es el jugador 0 y el teléfono el 1: el orden de sincro)
    // el dueño vio «el PC le gana por 2 segundos»: cada 2 s, el cuadro de la carrera de las dos consolas leído en el mismo
    // instante (las dos lecturas salen juntas; por el cable la del teléfono tarda pocos ms) → cuántos cuadros va el PC
    // delante. Con el lockstep no debería pasar del retraso (unos cuadros).
    const cuadroDe = p => p.evaluate(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730), ls = window.mkwSincro?.lockstep?.estado?.();
      return { logica: L.u32(ri + 0x20), cuadro: ls?.cuadro ?? null, retraso: ls?.retraso ?? null }; }).catch(() => null);
    let muestreando = true; c.adelantoPC = [];
    const muestreo = (async () => { while (muestreando) { const t0 = Date.now(); const [a, b] = await Promise.all([cuadroDe(A), cuadroDe(B)]);
      if (a && b) c.adelantoPC.push({ ms: Date.now() - t0, logica: a.logica - b.logica, cuadro: (a.cuadro ?? 0) - (b.cuadro ?? 0), retraso: [a.retraso, b.retraso] }); await espera(2000); } })();
    c.medidaTelefono = await medir(B, SEGUNDOS);
    muestreando = false; await muestreo;
    const ad = c.adelantoPC.map(x => x.logica);
    c.adelantoResumen = ad.length ? { min: Math.min(...ad), max: Math.max(...ad), medio: +(ad.reduce((a, b) => a + b, 0) / ad.length).toFixed(1) } : null;
    // lo que dice el lockstep de cada una: autoridad, inventados por la autoridad, relevos, frenos, quién va atrás, largadas
    c.lockstep = await Promise.all([A, B].map(p => p.evaluate(() => { const e = window.mkwSincro?.lockstep?.estado?.(); if (!e) return null;
      const k = ['autoridad', 'arbitro', 'retraso', 'retrasoMedio', 'inventados', 'inventadosViejos', 'relevos', 'relevadosAhora', 'yoRelevado', 'tardeVivo', 'frenos', 'msFrenado', 'adelanto',
        'atrasados', 'deuda', 'delantes', 'sinAlcance', 'pausasAhora', 'conflictos', 'traspasos', 'subidas', 'bajadas', 'huellasIguales', 'parteDistinta', 'desincronizado', 'largadas'];
      return Object.fromEntries(k.filter(x => x in e).map(x => [x, e[x]])); }).catch(e => ({ error: e.message }))));
    ok(`carrera ${carrera}: el PC no va adelante del teléfono más que unos cuadros (lockstep)`, !!c.adelantoResumen && Math.abs(c.adelantoResumen.max) <= 15 && Math.abs(c.adelantoResumen.min) <= 15,
      `cuadros de lógica PC − teléfono: ${JSON.stringify(c.adelantoResumen)}`);
    console.log(`  carrera ${carrera}: lockstep PC ${JSON.stringify(c.lockstep[0]).slice(0, 700)}`);
    console.log(`  carrera ${carrera}: lockstep teléfono ${JSON.stringify(c.lockstep[1]).slice(0, 700)}`);
    const av1 = await Promise.all([A, B].map(leer));
    const jB = await dB.juego();
    c.manejo = [await pararA(), await pararB()];
    // ¿quién es quién en la tabla de la carrera? el PC es el puesto 0 y el teléfono el 1 (la sala da los mandos en el orden de sincro)
    const avanza = (x0, x1, k) => (x1?.av?.[k] ?? 0) - (x0?.av?.[k] ?? 0);
    c.avanceTelefono = [avanza(av0[0], av1[0], 1), avanza(av0[1], av1[1], 1)];
    c.avancePC = [avanza(av0[0], av1[0], 0), avanza(av0[1], av1[1], 0)];
    ok(`carrera ${carrera}: el teléfono maneja después del «¡YA!» (con el dedo en A el juego ve A y su kart avanza en las dos consolas)`,
      !!qa && !!(jB && jB.botones & A_BIT) && c.avanceTelefono.every(v => v > 0.05), `A visto ${!!(jB && jB.botones & A_BIT)}, avance del teléfono en PC/teléfono ${c.avanceTelefono.map(v => v.toFixed(3)).join(' / ')}`);
    ok(`carrera ${carrera}: el kart del PC también avanza en las dos`, c.avancePC.every(v => v > 0.05), c.avancePC.map(v => v.toFixed(3)).join(' / '));
    await dB.levantar(1); await A.keyboard.up('KeyK');
    await espera(700);
    const jB2 = await dB.juego();
    ok(`carrera ${carrera}: al levantar el dedo nada queda pegado (A suelto, 0 dedos)`, !!jB2 && !(jB2.botones & A_BIT) && jB2.dedos === 0, JSON.stringify(jB2));
    const fin = await Promise.all([A, B].map(leer));
    c.huellas = fin.map(x => x?.huellas); c.desinc = fin.map(x => x?.desinc);
    ok(`carrera ${carrera}: las huellas iguales en el PC y en el teléfono (la misma carrera)`, fin.every(x => (x?.huellas ?? 0) >= 3 && !x?.desinc),
      `iguales ${c.huellas.join(' / ')}${fin.some(x => x?.desinc) ? ' · DESINCRONIZADO ' + JSON.stringify(c.desinc) : ''}`);
    console.log(`  carrera ${carrera}: teléfono en la sala ${JSON.stringify(c.medidaTelefono)}; recibidos PC ${JSON.stringify(fin[0]?.recibidos)} teléfono ${JSON.stringify(fin[1]?.recibidos)}`);
    r.carreras.push(c);
    // terminar la carrera en el mismo cuadro en las dos (los resultados, el descanso y la siguiente)
    const f = Math.max(...fin.map(x => x?.cuadro || 0)) + 180;
    await Promise.all([A, B].map(p => p.evaluate(q => window.mkwTerminarEn(q), f).catch(() => {})));
    await Promise.all([A, B].map(p => esperarQue(p, x => x.etapa >= 4 || x.s !== 0x20, 120000)));
  }
  await dB.soltarTodo();
  return r;
}

const comun = `&semilla=4242&cc=c150&cpu=normal&pista=${PISTAS[0].copa}.${PISTAS[0].fila}&verGrafico=1${EXTRA}`;   // (§256: el gráfico de cada imagen, a la vista)
const cortes = { aviso: m => { console.log('  [teléfono] ' + m); registro('[teléfono] ' + m); }, esperar: ms => espera(ms),
  conectar: (p, alCtx) => conectarPlaywright(p, { fps: true }, alCtx), pantalla: true,   // (como «abrir»: la pestaña al frente, a pantalla real, con el medidor de fps)
  recuerdo: recuerdoPantalla() };
const resumenCorrida = (n, x) => {
  ok(`${n}: el teléfono quedó igual que antes (apps y ajustes)`, !!x?.cambios?.igual, x?.cambios ? JSON.stringify(x.cambios).slice(0, 300) : 'sin la foto de después');
  const caida = x?.informe?.caidaAnterior ?? null;
  if (caida) console.log(`  ${n}: la caja negra del teléfono: ${JSON.stringify(caida).slice(0, 400)}`);
  return { motivo: x?.motivo, cambios: x?.cambios?.igual, historial: x?.historial, informe: x?.informe, consola: x?.consola?.slice(-200) };
};
try {
  if (SOLO !== 'sala') {
    const x = await abrir({ adb, puertos: [PUERTO], segundos: 900, ...cortes, ruta: `/?auto=1&modo=directa&pj=0&kart=1${comun}`, durante: B => singlePlayer(B) });
    resultado.singlePlayer = { ...x.durante, corrida: resumenCorrida('Single Player', x) };
  }
  if (SOLO !== 'sp') {
    const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
    const navegador = await chromium.launch({ channel: 'chrome', headless: false,
      args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows', `--window-position=${vx},${vy}`] });
    try {
      const salaId = 'tf' + Date.now().toString(36), uidA = 'A' + salaId, uidB = 'B' + salaId;
      const q = uid => `/?auto=1&red=malla&senal=canal&sala=${salaId}&uid=${uid}&sincro=${uidA},${uidB}&jefe=${uidA}&modo=sala&estilo=copa&carreras=${PISTAS.length}&descanso=12${comun}`;
      const ctxA = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
      await puente.agregar(ctxA);
      const A = await ctxA.newPage();
      A.on('pageerror', e => console.log('[PC] [pageerror] ' + e.message));
      await A.goto(`http://127.0.0.1:${PUERTO}${q(uidA)}`);
      const x = await abrir({ adb, puertos: [PUERTO], segundos: 2400, ...cortes, ruta: q(uidB), alContexto: ctx => puente.agregar(ctx), durante: B => sala(A, B) });
      resultado.sala = { ...x.durante, corrida: resumenCorrida('sala', x) };
    } finally { await navegador.close().catch(() => {}); }
  }
} catch (e) { ok('la prueba corrió entera', false, e.message); }
finally { servidor.kill(); }
const sp = resultado.singlePlayer?.medida, enSala = resultado.sala?.carreras?.map(c => c.medidaTelefono) || [];
if (sp) console.log(`\nteléfono, Single Player: ${sp.imagenes} imágenes/s, 1 % bajo ${sp.bajo1}, lógica ${sp.logica}/s`);
for (const [i, m] of enSala.entries()) if (m) console.log(`teléfono, sala carrera ${i + 1}: ${m.imagenes} imágenes/s, 1 % bajo ${m.bajo1}, lógica ${m.logica}/s`);
fs.writeFileSync(path.join(carpeta, 'sala-telefono.json'), JSON.stringify(resultado, null, 1));
console.log(`\n${bien} bien, ${mal} mal  (${carpeta})`);
process.exit(mal ? 1 : 0);
