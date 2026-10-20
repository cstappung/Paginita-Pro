// Prueba con el juego: la sala nueva entera, sin Retro WFC, con dos pestañas — bitácora §73.
//
// Resumen: abre la página del juego dos veces como dos computadores de la misma sala (A es la anfitriona; malla
// WebRTC con el buzón falso del banco) con ?modo=sala&estilo=copa&carreras=2 y recorre lo que pidió el dueño:
//   1. el juego de cada una arranca directo en la pantalla de personaje (sin título, licencias ni nada del Wi-Fi);
//      la anfitriona ve el selector de copa de la página y B el aviso «El anfitrión está eligiendo la copa…»;
//      la copa la fija la anfitriona (mkwSala.ponerPistas, lo que hace el selector al confirmar: el selector mismo
//      tiene sus pruebas, prueba-copa/prueba-elegir) y el selector se cierra;
//   2. cada una elige personaje, vehículo y derrape con las pantallas del juego (B otro personaje: mueve a la derecha);
//   3. la carrera 1 abre directo en las dos: la pista 1 de la copa, los dos humanos como jugadores de verdad, cada
//      una con SU pantalla, con lo que eligió cada uno, la misma carrera (huellas iguales) y cada kart con lo suyo;
//   4. la carrera 1 termina DE VERDAD (§75): una carrera entera tarda minutos con dos pestañas, así que los humanos
//      cruzan la meta por código en el MISMO cuadro de la carrera sincronizada (mkwTerminarEn) y el juego da puestos
//      y puntos (suman 73: 15, 12, 10, 8, 7…);
//   5. la carrera 2 abre sola en las dos después de los resultados, con la pista 2; ahí llega solo A y B se queda
//      quieto: 30 s después de que llega A, el juego le termina la carrera a B en el puesto en que va (la regla «DNF»
//      de las carreras en línea, §77), antes del tiempo límite (el del juego en línea; en la prueba ?limite=120 s);
//   6. al terminar la 2, la sala termina y queda la tabla de la copa (12 puestos) con los puntos del juego (146).
//   §82, el VR: al abrir cada carrera cada página deja guardado su peor caso (5000 → 4987: perder contra el otro);
//   al terminar la 1, el que llegó antes +13 y el otro −13, igual en las dos; la 2 se cuenta con esos VR (la foto de
//   la anfitriona) y al terminarla lo que gana uno lo pierde el otro.
// --recarga (§75, volver después de recargar): B recarga la página a mitad de la carrera 1. Su página nueva no entra a
//   esa carrera (avisa que se la salta y A sigue en segundos, sin esperar el margen de 30 s), A la termina sola, y en
//   la 2 B vuelve en su puesto, con lo que había elegido, la misma carrera que A y su kart con sus botones.
//   §82: B, que se fue a mitad de la 1, se queda con su peor caso (4987) y A no gana nada por él (5000).
// Fotos en build/web/datos/sala/ (o sala-recarga/).
//
// Uso:  node web/navegador/prueba-sala.mjs [--ventana] [--puerto=8153] [--recarga]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pantallaPartida } from './foto-pantalla.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const RECARGA = process.argv.includes('--recarga');
const LIMITE = 120;                   // s: el tiempo límite de la carrera en la prueba (el del juego es de minutos)
const DNF = 30;                       // s: el plazo para los que faltan desde que llega el primero, humano o CPU (§77, §78)
const PUERTO = Number((process.argv.find(a => a.startsWith('--puerto=')) || `--puerto=${RECARGA ? 8156 : 8153}`).slice(9));
const carpeta = path.join(raiz, RECARGA ? 'build/web/datos/sala-recarga' : 'build/web/datos/sala');
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
    `&semilla=777&modo=sala&estilo=copa&carreras=2&cc=c150&cpu=normal&limite=${LIMITE}`);
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
    picker: !!document.getElementById('elegirPista'), selectorCopa: !!document.getElementById('copaJugar'),
    tipos: [0, 1, 2].map(i => L.u32(esc + 8 + i * 0xF0 + 0x10)), pantalla: L.u8(esc + 0xB64),
    pjs: [0, 1].map(i => [L.u32(esc + 8 + i * 0xF0 + 0xC), L.u32(esc + 8 + i * 0xF0 + 0x8)]),
    puntos: Array.from({ length: 12 }, (_, i) => L.u16(esc + 8 + i * 0xF0 + 0xDA)),
    reloj: (() => { const r = ri && L.u32(ri + 0x14); return r ? (L.u16(r + 0x8) * 60 + L.u8(r + 0xA)) * 1000 + L.u16(r + 0xC) : -1; })(),
    // §77: ¿A (puesto 0) y B (puesto 1) cruzaron la meta? (RaceinfoPlayer +0x38, bit 0x2)
    llegaron: (() => { try { const lista = L.u32(ri + 0xC); return [0, 1].map(i => (L.u32(L.u32(lista + 4 * i) + 0x38) & 2) ? 1 : 0); } catch { return []; } })(),
    limiteJuego: window.mkwLimiteCarrera?.() ?? null,
    cuenta: window.mkwCuentaDnf?.estado() || null,   // §78: el contador de los que faltan (dnf.mjs)
    puntosMenu: Array.from({ length: 12 }, (_, i) => L.u16(rd + 0xC10 + 8 + i * 0xF0 + 0xDA)),
    ganadora: L.u32(0x8043319C + 0x10), etapa: ri ? L.u32(ri + 0x28) : -1, av,
    cortina: !document.body.classList.contains('sin-cortina'),
    // §82: el VR de la sala (mkw.mjs → vr-sala.mjs) y la copia de esta cuenta en el navegador (vr.mjs)
    vr: window.mkwEstado.vr || null, avisosVr: window.mkwAvisosVr || [],
    vrLocal: (() => { try { return JSON.parse(localStorage.getItem('mkw.vr.' + new URLSearchParams(location.search).get('uid')))?.vr ?? null; } catch { return null; } })() };
})]).catch(() => null);
const esperarQue = async (p, cond, tope = 120000) => { for (const hasta = Date.now() + tope; Date.now() < hasta;) { const x = await leer(p); if (x && cond(x)) return x; await espera(500); } return await leer(p); };

// 1) la copa: A ve el selector, B el aviso
const a1 = await esperarQue(A, x => x.picker);
ok('la anfitriona ve el selector de copa de la página (el de elegir una copa, §74)', !!a1?.picker && a1.selectorCopa, `a los ${seg()}`);
const b1 = await esperarQue(B, x => x.aviso.includes('eligiendo la copa') && !x.cortina, 60000);
ok('B ve «El anfitrión está eligiendo la copa…»', b1?.aviso.includes('eligiendo la copa'), b1?.aviso);
// (el selector de la página sale antes de que el juego termine de arrancar: se espera al juego de cada una)
const [a2, b2] = [await esperarQue(A, x => x.s === 0x49 && !x.cortina, 60000), await esperarQue(B, x => x.s === 0x49 && !x.cortina, 30000)];
ok('el juego de las dos arrancó directo en la pantalla de personaje (sección 0x49), sin el título', [a2, b2].every(x => x?.s === 0x49 && x.pagina === 0x6B),
   `A ${hex(a2?.s)} página ${hex(a2?.pagina)} · B ${hex(b2?.s)} página ${hex(b2?.pagina)}`);
await A.screenshot({ path: path.join(carpeta, '1-A-copa.png') }).catch(() => {});
await B.screenshot({ path: path.join(carpeta, '1-B-espera.png') }).catch(() => {});
// la copa: dos pistas (Luigi Circuit y una retro: una copa del juego son 4 carreras y la prueba sería larguísima),
// fijadas con lo mismo que hace el selector al confirmar; el selector se cierra solo (§74)
const COPA = [{ copa: 0, fila: 0 }, { copa: 13, fila: 2 }];
const puso = await A.evaluate(c => window.mkwSala.ponerPistas(c), COPA);
await espera(300);
const cerrado = await esperarQue(A, x => !x.picker && x.sala?.fase === 'elegir', 10000);
ok('la anfitriona fija la copa de 2 pistas y el selector se cierra', puso === true && !cerrado?.picker && cerrado?.sala?.pistas?.length === 2,
   `${JSON.stringify(cerrado?.sala?.pistas)}`);

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
   `costura en el medio: A ${pa?.pico} (típico ${pa?.tipico}, ancho ${pa?.ancho}), B ${pb?.pico} (típico ${pb?.tipico}, ancho ${pb?.ancho})`);
ok('la carrera sincronizada avanza en las dos', (ca?.ls?.cuadro || 0) > 600 && (cb?.ls?.cuadro || 0) > 600, `A cuadro ${ca?.ls?.cuadro}, B ${cb?.ls?.cuadro}`);
ok('ningún aviso de la página queda encima de la carrera', !ca?.aviso && !cb?.aviso, `A «${ca?.aviso || ''}» · B «${cb?.aviso || ''}»`);
ok('las huellas coinciden (la misma carrera en las dos)', (ca?.ls?.huellasIguales || 0) >= 2 && !ca?.ls?.desincronizado && !cb?.ls?.desincronizado,
   `iguales A ${ca?.ls?.huellasIguales} B ${cb?.ls?.huellasIguales}${ca?.ls?.desincronizado ? ' DESINCRONIZADO ' + JSON.stringify(ca.ls.desincronizado) : ''}`);
// (en las dos pestañas: la misma carrera, así que lo mismo)
const f4 = (x, i) => x?.av?.[i]?.toFixed(4);
ok('cada kart con lo suyo: a los 3,5 s el de A avanzó y el de B (quieto) no, en las dos pestañas',
   [qa, qb].every(x => (x?.av?.[0] || 0) - (x?.av?.[1] || 0) > 0.004), `pestaña A: A ${f4(qa, 0)} B ${f4(qa, 1)} · pestaña B: A ${f4(qb, 0)} B ${f4(qb, 1)} (vueltas)`);
ok('después B aceleró y su kart también avanzó', [ca, cb].every(x => (x?.av?.[1] || 0) > (qa?.av?.[1] || 0) + 0.01), `B ${f4(qa, 1)} → ${f4(ca, 1)}`);
ok('§82: al abrir la carrera 1 cada una guardó su peor caso (perder contra el otro: 5000 → 4987)',
   [ca, cb].every(x => x?.vr?.carrera === 1 && x.vr.antes === 5000 && x.vr.peor === 4987 && x.vrLocal === 4987),
   `A ${JSON.stringify(ca?.vr)} (guardado ${ca?.vrLocal}) · B ${JSON.stringify(cb?.vr)} (guardado ${cb?.vrLocal})`);
// §82: el VR después de una carrera: los dos con su cambio, lo que gana uno lo pierde el otro, el que llegó antes gana
const vrDe = x => x?.vr?.despues;
const vrBien = (xa, xb, n) => {
  const va = xa?.vr, vb = xb?.vr;
  if (va?.carrera !== n || vb?.carrera !== n || va.despues == null || vb.despues == null) return false;
  const puesto = (v, u) => v.corredores?.find(c => c.uid === u)?.puesto;
  const ganaA = puesto(va, uidA) < puesto(va, uidB);
  return va.cambio + vb.cambio === 0 && va.cambio !== 0 && (va.cambio > 0) === ganaA &&
         JSON.stringify(va.corredores) === JSON.stringify(vb.corredores) && xa.vrLocal === va.despues && xb.vrLocal === vb.despues;
};
const vrTexto = (xa, xb) => `A ${xa?.vr?.antes} → ${xa?.vr?.despues} (guardado ${xa?.vrLocal}) · B ${xb?.vr?.antes} → ${xb?.vr?.despues} (guardado ${xb?.vrLocal}); puestos ${JSON.stringify(xa?.vr?.corredores?.map(c => c.puesto))}`;

// 4) el fin de la carrera 1, de verdad (§75): los humanos cruzan la meta en el MISMO cuadro de la carrera sincronizada
// (mkwTerminarEn: el juego llama EndLap hasta la última vuelta, A primero) y el juego da puestos y puntos. Sin
// --recarga, en las dos pestañas; con --recarga, B recarga antes y la 1 la termina A sola.
const sumar = xs => (xs || []).reduce((a, b) => a + b, 0);
const terminarEn = async (pestanas, lecturas, puestos = null) => {
  const f = Math.max(...lecturas.map(x => x?.ls?.cuadro || 0)) + 180;      // 3 s más adelante: todas llegan después
  await Promise.all(pestanas.map(p => p.evaluate(([c, q]) => window.mkwTerminarEn(c, undefined, q), [f, puestos])));
  return f;
};
const dosPrimeros = x => [x?.[0], x?.[1]].sort((a, b) => a - b).join() === '12,15';   // A y B: 15 y 12 (en algún orden)
const puntosCarrera1 = async pestanas => {
  const fines = await Promise.all(pestanas.map(p => esperarQue(p, x => x.etapa >= 4, 60000)));
  await espera(5000);                                                        // (los resultados suman los puntos)
  return { fines, despues: await Promise.all(pestanas.map(p => leer(p))) };
};
let pBrecarga = null;
if (!RECARGA) {
  const f1 = await terminarEn([A, B], [ca, cb]);
  const { fines, despues: [xa, xb] } = await puntosCarrera1([A, B]);
  ok('la carrera 1 termina de verdad en las dos: A y B cruzan la meta en el mismo cuadro y el juego la da por terminada',
     fines.every(x => x?.etapa >= 4), `cuadro ${f1}; etapa A ${fines[0]?.etapa} B ${fines[1]?.etapa}`);
  // (los puntos los deja el juego en el escenario de los MENÚS al terminar la carrera; el de la carrera tiene los de
  // antes de empezarla. El puesto lo da el juego por el lugar en la pista al cruzar la meta, no por el orden de EndLap)
  ok('puntos de la carrera 1 (los da el juego): suman 73 (15, 12, 10, 8…), A y B 15 y 12, iguales en las dos',
     sumar(xa?.puntosMenu) === 73 && dosPrimeros(xa?.puntosMenu) && JSON.stringify(xa.puntosMenu) === JSON.stringify(xb?.puntosMenu),
     `A ${xa?.puntosMenu?.join(',')} · B ${xb?.puntosMenu?.join(',')} (límite del juego ${xa?.limiteJuego} ms)`);
  ok('§82: al terminar la 1 el VR se mueve: el humano que llegó antes +13, el otro −13, lo mismo en las dos y guardado',
     vrBien(xa, xb, 1) && Math.abs(xa.vr.cambio) === 13 && xa.avisosVr.length === 1 && /VR 5000 → (5013|4987)/.test(xa.avisosVr[0]), vrTexto(xa, xb) + ` «${xa?.avisosVr?.[0]}»`);
} else {
  // B recarga la página a mitad de la carrera 1. La página nueva no entra a esa carrera (su consola no tiene los
  // cuadros que ya pasaron): se la salta y lo avisa, y A sigue en segundos (sin el aviso esperaría el margen de 30 s)
  const antes = await leer(A);
  const tRecarga = Date.now();
  await B.reload();
  const a2 = await esperarQue(A, x => (x.ls?.cuadro || 0) > (antes?.ls?.cuadro || 0) + 240, 60000);
  const msSigue = Date.now() - tRecarga;
  ok('B recarga a mitad de la carrera 1: A sigue en pocos segundos (B avisa que se la salta; sin aviso, A esperaría 30 s)',
     (a2?.ls?.cuadro || 0) > (antes?.ls?.cuadro || 0) + 240 && msSigue < 25000 && a2?.ls?.cortes?.[1] >= 0,
     `A en el cuadro ${antes?.ls?.cuadro} → ${a2?.ls?.cuadro} a los ${(msSigue / 1000).toFixed(1)} s; B sin nadie desde el cuadro ${a2?.ls?.cortes?.[1]}`);
  const b2 = await esperarQue(B, x => /carrera siguiente/.test(x.aviso), 30000);
  pBrecarga = await B.screenshot({ path: path.join(carpeta, '4-B-recargada.png') }).catch(() => null);
  ok('B, recargada, ve «La copa ya empezó: entras en la carrera siguiente…» y no entra a la 1', /carrera siguiente/.test(b2?.aviso || '') && b2?.s !== 0x20,
     `«${b2?.aviso}», sección ${hex(b2?.s)}`);
  const f1 = await terminarEn([A], [a2]);
  const { fines, despues: [xa] } = await puntosCarrera1([A]);
  ok('la carrera 1 la termina A sola (B, cortado, no se espera): puntos que suman 73, A 15',
     fines[0]?.etapa >= 4 && sumar(xa?.puntosMenu) === 73 && xa.puntosMenu[0] === 15, `cuadro ${f1}; A ${xa?.puntosMenu?.join(',')}`);
  const xb1 = await leer(B);
  ok('§82: B se fue a mitad de la 1: se queda con su peor caso (4987) y A no gana nada por él (5000)',
     xa?.vr?.carrera === 1 && xa.vr.despues === 5000 && xa.vrLocal === 5000 && xb1?.vrLocal === 4987, vrTexto(xa, xb1));
}

// 5) la carrera 2: sola después de los resultados (con --recarga, B vuelve en su puesto y con lo que eligió)
const [sa, sb] = [await esperarQue(A, x => enCarrera(x, 2), 90000), await esperarQue(B, x => enCarrera(x, 2), 60000)];
const p2 = sa?.sala?.pistas?.[1];
ok('después de los resultados, la carrera 2 abrió sola en las dos con la pista 2', enCarrera(sa, 2) && enCarrera(sb, 2) && [sa, sb].every(x => x.ganadora === 0x100 + 4 * p2.copa + p2.fila),
   `A ${hex(sa?.ganadora)} B ${hex(sb?.ganadora)} (pista 2 ${JSON.stringify(p2)}) a los ${seg()}`);
// §82: la foto de los VR de la carrera 2 (la anfitriona la congela al empezarla): los de después de la 1
const fotoVr2 = sb?.sala?.vrCarrera, esperadoVr2 = RECARGA ? { [uidA]: 5000, [uidB]: 4987 } : null;
ok('§82: la carrera 2 se cuenta con los VR de después de la 1 (la foto de la anfitriona, la misma en las dos)',
   fotoVr2?.n === 2 && JSON.stringify(fotoVr2) === JSON.stringify(sa?.sala?.vrCarrera) &&
   (esperadoVr2 ? fotoVr2.vrs[uidA] === 5000 && fotoVr2.vrs[uidB] === 4987 : fotoVr2.vrs[uidA] + fotoVr2.vrs[uidB] === 10000 && fotoVr2.vrs[uidA] !== 5000),
   JSON.stringify(fotoVr2));
if (RECARGA) {
  ok('B vuelve en la carrera 2 en SU puesto, con SU pantalla y con lo que había elegido antes de recargar',
     sb?.pantalla === 1 && sb.tipos?.[1] === 0 && sb.pjs?.[1]?.[0] === eb?.eleccion?.personaje && sb.pjs[1][1] === eb.eleccion.vehiculo &&
     JSON.stringify(sa?.pjs) === JSON.stringify(sb?.pjs), `pantalla ${sb?.pantalla}, B ${JSON.stringify(sb?.pjs?.[1])} (eligió ${JSON.stringify(eb?.eleccion)})`);
  // ahora maneja B (A quieta): en las dos pestañas, el kart de B avanza y el de A no
  await esperarQue(B, x => x.etapa >= 2, 60000);
  const [q2a] = [await leer(A)];
  await B.keyboard.down('KeyK');
  await espera(6000);
  const [r2a, r2b] = [await leer(A), await leer(B)];
  await B.keyboard.up('KeyK');
  ok('…y su kart va con SUS botones: B acelera y avanza, A (quieta) no, en las dos pestañas',
     [r2a, r2b].every(x => (x?.av?.[1] || 0) - (x?.av?.[0] || 0) > 0.004) && (r2a?.av?.[1] || 0) > (q2a?.av?.[1] || 0) + 0.004,
     `pestaña A: A ${f4(r2a, 0)} B ${f4(r2a, 1)} · pestaña B: A ${f4(r2b, 0)} B ${f4(r2b, 1)}`);
  await A.screenshot({ path: path.join(carpeta, '5-A-carrera2.png') }).catch(() => {});
  const vb2 = await B.screenshot({ path: path.join(carpeta, '5-B-carrera2.png') }).catch(() => null);
  const pb2 = vb2 && await pantallaPartida(B, vb2);
  ok('en la foto de B (recargada) se ve UNA vista, la de su kart', pb2 && !pb2.partida && !pb2.vacia, `costura ${pb2?.pico} (típico ${pb2?.tipico})`);
} else await espera(9000);
const [da, db] = [await leer(A), await leer(B)];
ok('la carrera 2 también es la misma en las dos (sin cortes: los dos corren)', (da?.ls?.carrera || 0) >= 2 && !da?.ls?.desincronizado && !db?.ls?.desincronizado &&
   (da?.ls?.cuadro || 0) > 200 && (da?.ls?.huellasIguales || 0) >= 1 && !Object.keys(da?.ls?.cortes || {}).length && !Object.keys(db?.ls?.cortes || {}).length,
   `carrera A ${da?.ls?.carrera} B ${db?.ls?.carrera}, cuadro A ${da?.ls?.cuadro} B ${db?.ls?.cuadro}, iguales ${da?.ls?.huellasIguales}, cortes A ${JSON.stringify(da?.ls?.cortes)} B ${JSON.stringify(db?.ls?.cortes)}`);

// 6) fin. Sin --recarga: en la 2 llega solo A y B se queda quieto (el error que vio el dueño: la carrera no terminaba
// nunca si un humano no llegaba). §77, la regla «DNF» de las carreras en línea: desde que llega A, B tiene 30 s; al
// vencer, el juego le termina la carrera en el puesto en que va (un tiempo estimado) y la carrera termina, en las dos
// en el mismo cuadro, mucho antes del tiempo límite. Con --recarga: los dos llegan por código. Y la tabla trae los puntos.
if (!RECARGA) {
  const f2 = await terminarEn([A, B], [da, db], [0]);
  // el reloj de la carrera cuando A cruzó la meta (se mira cada 0,5 s: puede ser hasta medio segundo después)
  const llegoA = await esperarQue(A, x => x.llegaron?.[0] === 1, 60000);
  // §78: el contador de los que faltan: B (que sigue corriendo) lo ve con los segundos y la letra del juego (la fuente
  // de la cuenta de salida, leída de UI/Font.szs); A (que ya llegó), el tranquilo
  const [ca, cb] = [await esperarQue(A, x => x.cuenta?.visible, 10000), await esperarQue(B, x => x.cuenta?.visible, 10000)];
  ok('el contador de los que faltan (§78): B lo ve con los segundos y la letra del juego; A, «ESPERANDO A LOS DEMÁS»',
     cb?.cuenta?.modo === 'apurate' && cb.cuenta.segundos > 0 && cb.cuenta.segundos <= DNF && cb.cuenta.fuente === 'juego' &&
     /META|LLEGÓ/.test(cb.cuenta.letrero) && ca?.cuenta?.modo === 'espera', `A: ${ca?.cuenta?.texto} · B: ${cb?.cuenta?.texto} (${cb?.cuenta?.fuente})`);
  const [la, lb] = [await esperarQue(A, x => x.etapa >= 4, 90000), await esperarQue(B, x => x.etapa >= 4, 30000)];
  const desde = llegoA?.llegaron?.[0] === 1 ? llegoA.reloj : -1, plazo = (la?.reloj ?? 0) - desde;
  // (cada pestaña se lee en su momento, y el reloj sigue corriendo después del fin: comparar los relojes leídos mide
  // cuándo se leyó cada una, no el juego —con dos juegos en la PC llegó a 2,3 s—. Se pide que en las dos el juego ya le
  // haya dado la llegada a B; que la carrera sea la misma en las
  // dos lo dice la tabla, igual en las dos, más abajo)
  ok(`la carrera 2 termina sola aunque B no llegue: ${DNF} s después de que A cruza la meta, el juego termina la de B en el puesto en que va (la regla «DNF»), antes del tiempo límite`,
     la?.etapa >= 4 && lb?.etapa >= 4 && desde > 0 && plazo > (DNF - 1) * 1000 && plazo < (DNF + 1.5) * 1000 && la.reloj < LIMITE * 1000 &&
     la.llegaron?.[1] === 1 && lb.llegaron?.[1] === 1,
     `A llega con el reloj en ${desde} ms (cuadro ${f2}); fin con el reloj en A ${la?.reloj} ms, B ${lb?.reloj} ms: ${(plazo / 1000).toFixed(1)} s después`);
} else await terminarEn([A, B], [da, db]);
const fa = await esperarQue(A, x => x.sala?.fase === 'fin' && x.fin, 90000), fb = await esperarQue(B, x => x.sala?.fase === 'fin' && x.fin, 30000);
const total = sumar((fa?.fin || []).map(x => x.puntos));
const ptsA = fa?.fin?.find(x => x.uid === uidA)?.puntos, ptsB = fa?.fin?.find(x => x.uid === uidB)?.puntos;
ok('al terminar la 2 la sala termina en las dos y queda la tabla (12 puestos)', fa?.fin?.length === 12 && fb?.sala?.fase === 'fin',
   (fa?.fin || []).slice(0, 4).map(x => `${x.nombre} ${x.puntos}`).join(', '));
ok('la tabla trae los puntos de verdad: suman 146 (73 por carrera), A y B con puntos, la misma en las dos',
   total === 146 && ptsA > 0 && ptsB > 0 && JSON.stringify(fa?.fin) === JSON.stringify(fb?.fin),
   `total ${total}; A ${ptsA}, B ${ptsB}; ${(fa?.fin || []).map(x => x.puntos).join(',')}`);
await A.screenshot({ path: path.join(carpeta, '6-A-fin.png') }).catch(() => {});
ok('§82: al terminar la 2 también: lo que gana uno lo pierde el otro, guardado en las dos', vrBien(fa, fb, 2) && fa.vr.antes === fotoVr2?.vrs?.[uidA],
   vrTexto(fa, fb));

ok('sin errores de JavaScript en las páginas', !registro.some(l => l.includes('pageerror')), registro.filter(l => l.includes('pageerror')).slice(0, 2).join(' · '));
writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (fotos y registro en ${path.relative(raiz, carpeta)}/)`);
process.exit(mal ? 1 : 0);
