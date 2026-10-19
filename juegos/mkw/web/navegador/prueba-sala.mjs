// Prueba con el juego: la sala nueva entera, sin Retro WFC, con dos pestañas — bitácora §73.
//
// Resumen: abre la página del juego dos veces como dos computadores de la misma sala (A es la anfitriona; malla
// WebRTC con el buzón falso del banco) con ?modo=sala&estilo=copa&carreras=2 y recorre lo que pidió el dueño:
//   1. el juego de cada una arranca directo en la pantalla de personaje (sin título, licencias ni nada del Wi-Fi);
//      la anfitriona ve el selector de copa de la página y B el aviso «El anfitrión está eligiendo la copa…»;
//      A arma la copa (🎲 y Confirmar);
//   2. cada una elige personaje, vehículo y derrape con las pantallas del juego (B otro personaje: mueve a la derecha);
//   3. la carrera 1 abre directo en las dos: la pista 1 de la copa, los dos humanos como jugadores de verdad, cada
//      una con SU pantalla, con lo que eligió cada uno, la misma carrera (huellas iguales) y cada kart con lo suyo;
//   4. la carrera 2 (la anfitriona da la 1 por terminada: una carrera entera tarda minutos con dos pestañas) abre
//      sola en las dos después de los resultados, con la pista 2;
//   5. al terminar la 2, la sala termina y queda la tabla de la copa (12 puestos).
// Fotos en build/web/datos/sala/.
//
// Uso:  node web/navegador/prueba-sala.mjs [--ventana] [--puerto=8153]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pantallaPartida } from './foto-pantalla.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = Number((process.argv.find(a => a.startsWith('--puerto=')) || '--puerto=8153').slice(9));
const carpeta = path.join(raiz, 'build/web/datos/sala');
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
const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
const sala = 'sala-' + Date.now().toString(36);
const uidA = 'a' + sala, uidB = 'b' + sala;
const registro = [];
const t0 = Date.now();
const seg = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
async function abrir(nombre, uid) {
  const p = await contexto.newPage();
  p.on('pageerror', e => { console.log(`[${nombre}] [pageerror] ${e.message}`); registro.push(`[${nombre}] pageerror ${e.message}`); });
  p.on('console', m => registro.push(`[${nombre}] ${m.text().slice(0, 300)}`));
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uid}&sincro=${uidA},${uidB}&jefe=${uidA}` +
    `&semilla=777&modo=sala&estilo=copa&carreras=2&cc=c150&cpu=normal`);
  return p;
}
const A = await abrir('A', uidA);
await espera(2000);
const B = await abrir('B', uidB);

const leer = p => Promise.race([new Promise(r => setTimeout(() => r(null), 8000)), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const rd = L.u32(0x809BD728), esc = rd + 0x20, ri = L.u32(0x809BD730);
  const f = x => new DataView(new Uint32Array([x]).buffer).getFloat32(0, true);
  let av = []; try { const lista = L.u32(ri + 0xC); for (let i = 0; i < 12; i++) av.push(f(L.u32(L.u32(lista + 4 * i) + 0xC))); } catch {}
  return { s: e.seccion, pagina: e.pagina, sala: window.mkwEstado.sala || null, eleccion: window.mkwEstado.eleccion || null,
    piloto: window.mkwEstado.piloto || null, ficha: window.mkwEstado.ficha || null, fin: window.mkwEstado.finModo || null,
    ls: window.mkwSincro?.lockstep?.estado() || null, aviso: document.getElementById('avisoJuego')?.hidden ? '' : document.getElementById('avisoJuego')?.textContent || '',
    picker: !!document.getElementById('elegirPista'), casillas: document.querySelectorAll('#elegirPista .casillas li').length,
    tipos: [0, 1, 2].map(i => L.u32(esc + 8 + i * 0xF0 + 0x10)), pantalla: L.u8(esc + 0xB64),
    pjs: [0, 1].map(i => [L.u32(esc + 8 + i * 0xF0 + 0xC), L.u32(esc + 8 + i * 0xF0 + 0x8)]),
    ganadora: L.u32(0x8043319C + 0x10), etapa: ri ? L.u32(ri + 0x28) : -1, av,
    cortina: !document.body.classList.contains('sin-cortina') };
})]).catch(() => null);
const esperarQue = async (p, cond, tope = 120000) => { for (const hasta = Date.now() + tope; Date.now() < hasta;) { const x = await leer(p); if (x && cond(x)) return x; await espera(500); } return await leer(p); };

// 1) la copa: A ve el selector, B el aviso
const a1 = await esperarQue(A, x => x.picker && x.casillas > 0);
ok('la anfitriona ve el selector de copa de la página (2 casillas: carreras=2)', a1?.picker && a1.casillas === 2, `${a1?.casillas} casillas a los ${seg()}`);
const b1 = await esperarQue(B, x => x.aviso.includes('eligiendo la copa') && !x.cortina, 60000);
ok('B ve «El anfitrión está eligiendo la copa…»', b1?.aviso.includes('eligiendo la copa'), b1?.aviso);
// (el selector de la página sale antes de que el juego termine de arrancar: se espera al juego de cada una)
const [a2, b2] = [await esperarQue(A, x => x.s === 0x49 && !x.cortina, 60000), await esperarQue(B, x => x.s === 0x49 && !x.cortina, 30000)];
ok('el juego de las dos arrancó directo en la pantalla de personaje (sección 0x49), sin el título', [a2, b2].every(x => x?.s === 0x49 && x.pagina === 0x6B),
   `A ${hex(a2?.s)} página ${hex(a2?.pagina)} · B ${hex(b2?.s)} página ${hex(b2?.pagina)}`);
await A.screenshot({ path: path.join(carpeta, '1-A-copa.png') }).catch(() => {});
await B.screenshot({ path: path.join(carpeta, '1-B-espera.png') }).catch(() => {});
await A.click('#copaAzar');
await espera(300);
await A.locator('#elegirPista .tu-copa button', { hasText: 'Confirmar' }).click();

// 2) elegir personaje: cada una con A (B antes a la derecha)
const elegir = async (p, nombre, derecha) => {
  let visto = false, ultimo = 0;
  for (const hasta = Date.now() + 90000; Date.now() < hasta;) {
    const x = await leer(p);
    if (x?.eleccion) return x;
    if (x && !x.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina)) {
      if (!visto && x.pagina === 0x6B) {
        visto = true; await espera(700); await p.screenshot({ path: path.join(carpeta, `2-${nombre}-personaje.png`) }).catch(() => {});
        if (derecha) { await p.keyboard.down('KeyD'); await espera(150); await p.keyboard.up('KeyD'); await espera(400); }
      }
      if (Date.now() - ultimo > 1200) { ultimo = Date.now(); await p.keyboard.down('KeyK'); await espera(150); await p.keyboard.up('KeyK'); }
    }
    await espera(300);
  }
  return await leer(p);
};
const [ea, eb] = await Promise.all([elegir(A, 'A', false), elegir(B, 'B', true)]);
ok('las dos eligieron personaje, vehículo y derrape con las pantallas del juego', !!(ea?.eleccion && eb?.eleccion),
   `A ${JSON.stringify(ea?.eleccion)} · B ${JSON.stringify(eb?.eleccion)}`);
ok('B eligió otro personaje que A', ea?.eleccion && eb?.eleccion && ea.eleccion.personaje !== eb.eleccion.personaje);

// 3) la carrera 1
const enCarrera = (x, n) => x?.s === 0x20 && x.piloto?.carrera === n && !x.cortina;
const [ra, rb] = [await esperarQue(A, x => enCarrera(x, 1), 120000), await esperarQue(B, x => enCarrera(x, 1), 60000)];
ok('la carrera 1 abrió directo en las dos (sección 0x20)', enCarrera(ra, 1) && enCarrera(rb, 1), `A ${hex(ra?.s)} B ${hex(rb?.s)} a los ${seg()}`);
const p1 = ra?.sala?.pistas?.[0];
ok('corre la pista 1 de la copa que armó la anfitriona', p1 && [ra, rb].every(x => x.ganadora === 0x100 + 4 * p1.copa + p1.fila), `${JSON.stringify(p1)} → A ${hex(ra?.ganadora)} B ${hex(rb?.ganadora)}`);
ok('los dos humanos son jugadores de verdad (tipo 0), el resto CPU, en las dos', [ra, rb].every(x => x?.tipos?.[0] === 0 && x.tipos[1] === 0 && x.tipos[2] === 1), `A ${ra?.tipos} B ${rb?.tipos}`);
ok('cada una tiene SU pantalla (A la del puesto 0, B la del puesto 1)', ra?.pantalla === 0 && rb?.pantalla === 1, `A ${ra?.pantalla} B ${rb?.pantalla}`);
ok('en las dos, el kart de A tiene lo que eligió A y el de B lo de B', [ra, rb].every(x => x?.pjs?.[0]?.[0] === ea?.eleccion?.personaje && x.pjs[0][1] === ea.eleccion.vehiculo &&
   x.pjs[1][0] === eb?.eleccion?.personaje && x.pjs[1][1] === eb.eleccion.vehiculo), `A ${JSON.stringify(ra?.pjs)} B ${JSON.stringify(rb?.pjs)}`);
// manejar (después de la cuenta regresiva): A acelera derecho; B se queda quieto 3,5 s (se mide ahí: el de A avanzó y
// el de B no, en las dos pestañas) y después acelera también. (Más tarde no sirve comparar: el que va derecho choca en
// la primera curva y los dos quedan contra el mismo muro.)
await esperarQue(A, x => x.etapa >= 2, 60000);
await A.keyboard.down('KeyK');
await espera(3500);
const [qa, qb] = [await leer(A), await leer(B)];
await B.keyboard.down('KeyK');
await espera(16000);
const [ca, cb] = [await leer(A), await leer(B)];
// (la foto de la página entera: la del lienzo solo a veces sale en blanco; los avisos de la página van arriba, lejos del medio)
const va = await A.screenshot({ path: path.join(carpeta, '3-A-carrera.png') }).catch(() => null);
const vb = await B.screenshot({ path: path.join(carpeta, '3-B-carrera.png') }).catch(() => null);
const [pa, pb] = [va && await pantallaPartida(A, va), vb && await pantallaPartida(B, vb)];
await A.keyboard.up('KeyK'); await B.keyboard.up('KeyK');
ok('en la foto de cada una se ve UNA vista (la de su kart), no la pantalla partida', pa && pb && !pa.partida && !pb.partida && !pa.vacia && !pb.vacia,
   `costura en el medio: A ${pa?.pico} (típico ${pa?.tipico}), B ${pb?.pico} (típico ${pb?.tipico})`);
ok('la carrera sincronizada avanza en las dos', (ca?.ls?.cuadro || 0) > 600 && (cb?.ls?.cuadro || 0) > 600, `A cuadro ${ca?.ls?.cuadro}, B ${cb?.ls?.cuadro}`);
ok('ningún aviso de la página queda encima de la carrera', !ca?.aviso && !cb?.aviso, `A «${ca?.aviso || ''}» · B «${cb?.aviso || ''}»`);
ok('las huellas coinciden (la misma carrera en las dos)', (ca?.ls?.huellasIguales || 0) >= 2 && !ca?.ls?.desincronizado && !cb?.ls?.desincronizado,
   `iguales A ${ca?.ls?.huellasIguales} B ${cb?.ls?.huellasIguales}${ca?.ls?.desincronizado ? ' DESINCRONIZADO ' + JSON.stringify(ca.ls.desincronizado) : ''}`);
// (en las dos pestañas: la misma carrera, así que lo mismo)
const f4 = (x, i) => x?.av?.[i]?.toFixed(4);
ok('cada kart con lo suyo: a los 3,5 s el de A avanzó y el de B (quieto) no, en las dos pestañas',
   [qa, qb].every(x => (x?.av?.[0] || 0) - (x?.av?.[1] || 0) > 0.004), `pestaña A: A ${f4(qa, 0)} B ${f4(qa, 1)} · pestaña B: A ${f4(qb, 0)} B ${f4(qb, 1)} (vueltas)`);
ok('después B aceleró y su kart también avanzó', [ca, cb].every(x => (x?.av?.[1] || 0) > (qa?.av?.[1] || 0) + 0.01), `B ${f4(qa, 1)} → ${f4(ca, 1)}`);

// 4) la carrera 2: la anfitriona da la 1 por terminada (en una sala de verdad lo avisa el juego al cruzar la meta)
await A.evaluate(() => window.mkwSala.termine(1));
const [sa, sb] = [await esperarQue(A, x => enCarrera(x, 2), 90000), await esperarQue(B, x => enCarrera(x, 2), 60000)];
const p2 = sa?.sala?.pistas?.[1];
ok('después de los resultados, la carrera 2 abrió sola en las dos con la pista 2', enCarrera(sa, 2) && enCarrera(sb, 2) && [sa, sb].every(x => x.ganadora === 0x100 + 4 * p2.copa + p2.fila),
   `A ${hex(sa?.ganadora)} B ${hex(sb?.ganadora)} (pista 2 ${JSON.stringify(p2)}) a los ${seg()}`);
await espera(15000);
const [da, db] = [await leer(A), await leer(B)];
ok('la carrera 2 también es la misma en las dos', (da?.ls?.carrera || 0) >= 2 && !da?.ls?.desincronizado && !db?.ls?.desincronizado && (da?.ls?.cuadro || 0) > 200,
   `carrera A ${da?.ls?.carrera} B ${db?.ls?.carrera}, cuadro A ${da?.ls?.cuadro} B ${db?.ls?.cuadro}, iguales ${da?.ls?.huellasIguales}`);

// 5) fin
await A.evaluate(() => window.mkwSala.termine(2));
const fa = await esperarQue(A, x => x.sala?.fase === 'fin' && x.fin, 60000), fb = await esperarQue(B, x => x.sala?.fase === 'fin', 30000);
ok('al terminar la 2 la sala termina en las dos y queda la tabla (12 puestos)', fa?.fin?.length === 12 && fb?.sala?.fase === 'fin',
   (fa?.fin || []).slice(0, 4).map(x => `${x.nombre} ${x.puntos}`).join(', '));
await A.screenshot({ path: path.join(carpeta, '5-A-fin.png') }).catch(() => {});

ok('sin errores de JavaScript en las páginas', !registro.some(l => l.includes('pageerror')), registro.filter(l => l.includes('pageerror')).slice(0, 2).join(' · '));
writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (fotos y registro en build/web/datos/sala/)`);
process.exit(mal ? 1 : 0);
