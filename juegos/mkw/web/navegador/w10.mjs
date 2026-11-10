// W10 de la etapa 1 del plan v4 (bitácora §207): el dibujo en otro Worker, la parte de la página.
//
// Resumen: el programa de MKW_W10_COMPILAR=1 (web/juego/w10_nativo.cpp) junta en cada cuadro de la carrera lo que cambió
// en la memoria de la Wii en una «caja»: tramos [dirección u32][largo u32][bytes] seguidos, alineados a 4. Aquí:
//   - modoW10(v): ?w10=N → el modo del programa (0 nada, 1 techo, 2 + juntar, 3 + mandar, 4 + comprobar la marca;
//     5, 6, 7 = 1, 2, 3 sin presentar);
//   - aplicarCaja(memoria, caja, n): pegar los tramos en una copia de la memoria (MEM1 en 0, MEM2 después: igual que la
//     foto del programa); la usan el Worker del dibujo (w10-dibujo.js) y el banco;
//   - crearMandadero(M): Module.mkwW10Caja = copiar la caja fuera de la memoria del programa a una caja de la cinta
//     (cajas.mjs, §188) y transferirla al Worker, que la pega en su copia y la devuelve. Sin memoria compartida esa copia
//     es inevitable: el modo 3 mide justo eso. Si no hay caja libre, se anota y se pierde el cuadro (contrapresión
//     medida, no esperada: el programa no puede esperar en medio del dibujo).
// Es como un tablero que manda solo las lecturas de los medidores que cambiaron, no la planilla entera.
import { crearCinta } from './cajas.mjs';

// (5, 6 y 7 = 1, 2 y 3 sin presentar nada: como el Worker de la carrera de W10, que no presenta)
// (8 = el Worker del dibujo, 9 = el de la carrera, 10 = el de la carrera que también dibuja: la parte B, §207.4)
export const modoW10 = v => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(Number(v)) ? Number(v) : 0;
// ¿el modo manda la caja a un Worker? (3 y 7)
export const mandaCaja = m => m === 3 || m === 7;

export const MEM1 = 24 << 20, MEM2 = 128 << 20;
// dirección de la Wii → lugar en la copia (MEM1 y sus dos ventanas; MEM2 y las suyas); −1 = fuera
export function lugarDe(dir) {
  const d = dir >>> 0, base = d & 0x3FFFFFFF;
  if ((d >>> 28 === 0x8 || d >>> 28 === 0xC) && base < MEM1) return base;
  if ((d >>> 28 === 0x9 || d >>> 28 === 0xD) && base - 0x10000000 < MEM2) return MEM1 + (base - 0x10000000);
  return -1;
}

// pega los tramos de la caja (los n primeros bytes) en memoria (Uint8Array de MEM1 + MEM2). Devuelve {tramos, bytes, malos}
export function aplicarCaja(memoria, caja, n = caja.length) {
  const v = new DataView(caja.buffer, caja.byteOffset, n);
  let i = 0, tramos = 0, bytes = 0, malos = 0;
  while (i + 8 <= n) {
    const dir = v.getUint32(i, true), largo = v.getUint32(i + 4, true);
    const lugar = lugarDe(dir);
    if (lugar < 0 || i + 8 + largo > n || lugar + largo > memoria.length) { malos++; break; }
    memoria.set(caja.subarray(i + 8, i + 8 + largo), lugar);
    i += 8 + largo; tramos++; bytes += largo;
  }
  return { tramos, bytes, malos };
}

// la huella de una copia de la memoria (FNV-1a de a 4 bytes): la del Worker tiene que dar igual a la de la carrera
export function huellaDe(m) {
  const v = new Uint32Array(m.buffer, m.byteOffset, m.length >> 2);
  let h = 0x811C9DC5;
  for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v[i], 16777619);
  return h >>> 0;
}

// los pedazos [desde, largo] de un tramo [lugar, lugar+largo) que quedan fuera de los rangos [[ini, fin), …]
// (lo que B pega: todo menos sus hilos, §207.5). Como cortar una cinta dejando fuera los trozos marcados
export function recortar(lugar, largo, rangos) {
  let piezas = [[0, largo]];
  for (const [ini, fin] of rangos) {
    if (fin <= lugar || ini >= lugar + largo) continue;
    const a = Math.max(ini - lugar, 0), b = Math.min(fin - lugar, largo), nuevas = [];
    for (const [o, l] of piezas) {
      if (b <= o || a >= o + l) { nuevas.push([o, l]); continue; }
      if (a > o) nuevas.push([o, a - o]);
      if (b < o + l) nuevas.push([b, o + l - b]);
    }
    piezas = nuevas;
  }
  return piezas;
}

// arma una caja con tramos (para el banco): [[dir, Uint8Array], …]
export function armarCaja(tramos) {
  const n = tramos.reduce((s, [, b]) => s + 8 + b.length, 0);
  const caja = new Uint8Array(n), v = new DataView(caja.buffer);
  let i = 0;
  for (const [dir, b] of tramos) { v.setUint32(i, dir >>> 0, true); v.setUint32(i + 4, b.length, true); caja.set(b, i + 8); i += 8 + b.length; }
  return caja;
}

// La parte B (§207.4): dos copias del programa. El Worker de la carrera («A», ?w10=9 o 10) manda sus cajas al Worker del
// dibujo («B», ?w10=8) por un MessagePort; B las pega cuando su bucle iba a calcular y dibuja lo pegado.
// A: Module.mkwW10CajaEspera(p, n, cuadro, fin) = copiar la caja a una de la cinta (si no hay libre, ESPERAR: la
// contrapresión frena a la carrera si el dibujo se atrasa; nunca se pierde una caja, B quedaría distinto para siempre)
export function crearEnlaceA(M, puerto, { piezas = 4, tam = 5 << 20 } = {}) {
  const estado = { mandadas: 0, bytes: 0, msEspera: 0, esperas: 0, grandes: 0 };
  const cinta = crearCinta({ puerto, piezas, tam });
  let desdeA = 0;   // (diagnóstico §240: cuánto lleva A esperando una caja libre en este momento)
  Object.defineProperty(estado, 'esperando', { enumerable: true, get: () => desdeA ? Math.round(performance.now() - desdeA) : 0 });
  Object.defineProperty(estado, 'enCamino', { enumerable: true, get: () => cinta.estado.enCamino });
  M.mkwW10CajaEspera = async (p, n, cuadro, fin) => {
    const t0 = desdeA = performance.now();
    let caja = await cinta.tomar();
    const t1 = performance.now();
    desdeA = 0;
    if (t1 - t0 > 0.05) { estado.esperas++; estado.msEspera += t1 - t0; }
    if (caja.length < n) { estado.grandes++; caja = new Uint8Array(n); }   // (la de la cinta se pierde: rara)
    caja.set(M.HEAPU8.subarray(p, p + n));
    cinta.entregar(caja, n, { cuadro, fin: !!fin });
    estado.mandadas++; estado.bytes += n;
  };
  return { estado, cinta, repite: () => puerto.postMessage({ t: 'repite' }) };
}

// B: Module.mkwW10Pegar() = pegar las cajas que lleguen hasta la del fin del cuadro (esperando si no hay) en la memoria
// del programa (Module._mkw_w10_host(página) = dónde está cada página de 4 KiB) y devolverlas vacías a A. Devuelve
// cuántos tramos pegó. { t: 'repite' } = una vuelta más sin pegar nada (para que B presente lo último, las pruebas)
// (sinHilos = pegar también las pilas y fichas de los hilos, como antes de §207.5: solo para ver que se rompe)
export function crearDibujanteB(M, puerto, { sinHilos = false, choques = false } = {}) {
  // (diagnóstico §240, ?w10Choques=1) los choques: bytes que el dibujo de B cambió y que la caja de A pisa ahora con otro
  // valor. sombraB = lo último que B recibió de A en cada byte; si la memoria de B ya no es eso, lo escribió B.
  const sombraB = choques ? new Uint8Array(MEM1 + MEM2) : null;
  let choquesCuadro = null, choquesDetalle = [];
  const estado = { cajas: 0, cuadros: 0, tramos: 0, bytes: 0, malos: 0, msEspera: 0, repetidos: 0, saltados: 0, hilos: 0 };
  // (diagnóstico §240: en qué fase está el bucle de B y la hora del informe: si la hora no avanza, B está trabado
  // sin soltar el hilo; esperando = cuánto lleva esperando una caja en este momento)
  let desde = 0;
  Object.defineProperty(estado, 'fase', { enumerable: true, get: () => { try { return M._mkw_w10_dato?.(19) ?? -1; } catch (e) { return 'X ' + String(e?.message || e).slice(0, 120); } } });
  Object.defineProperty(estado, 'deshechas', { enumerable: true, get: () => { try { return M._mkw_w10_deshechas?.() ?? -1; } catch { return -2; } } });
  Object.defineProperty(estado, 'dibujos', { enumerable: true, get: () => { try { return [M._mkw_w10_cuenta?.(0), M._mkw_w10_cuenta?.(1)]; } catch { return null; } } });
  Object.defineProperty(estado, 'palabras', { enumerable: true, get: () => { try { return M._mkw_w10_palabras_deshechas?.() ?? -1; } catch { return -2; } } });
  Object.defineProperty(estado, 'ahora', { enumerable: true, get: () => Math.round(performance.now()) });
  Object.defineProperty(estado, 'esperando', { enumerable: true, get: () => desde ? Math.round(performance.now() - desde) : 0 });
  const cola = [];
  let despertar = null;
  puerto.onmessage = e => {
    const m = e.data;
    if (m.t === 'caja' || m.t === 'repite') { cola.push(m); despertar?.(); despertar = null; }
  };
  const siguiente = async () => {
    while (!cola.length) { const t0 = desde = performance.now(); await new Promise(r => { despertar = r; }); desde = 0; estado.msEspera += performance.now() - t0; }
    return cola.shift();
  };
  // los hilos de B (sus fichas y pilas) no se pegan: se leen de B antes de cada cuadro (§207.5)
  let rangos = [];
  const leerHilos = () => {
    if (!M._mkw_w10_hilos || sinHilos) { rangos = []; return; }
    const n = M._mkw_w10_hilos(), r = [];
    for (let k = 0; k < n; k++) {
      const a = M._mkw_w10_rango(2 * k) >>> 0, b = M._mkw_w10_rango(2 * k + 1) >>> 0, l = lugarDe(a);
      if (l >= 0 && b > a) r.push([l, l + (b - a)]);
    }
    rangos = r;
    estado.hilos = n;
  };
  let sombraC = 0, tocadasC = 0, bitsC = 0;   // (§240) dónde están g_sombraB y g_tocadaA en la memoria del programa
  const pegar = (caja, n) => {
    if (!sombraC && M._mkw_w10_sombra_b) { sombraC = M._mkw_w10_sombra_b(); tocadasC = M._mkw_w10_tocadas_a?.() || 0; bitsC = M._mkw_w10_bits_a?.() || 0; }
    const v = new DataView(caja.buffer, caja.byteOffset, n), heap = M.HEAPU8;
    let i = 0, tramos = 0;
    while (i + 8 <= n) {
      const dir = v.getUint32(i, true), largo = v.getUint32(i + 4, true), lugar = lugarDe(dir);
      if (lugar < 0 || i + 8 + largo > n || (lugar & 4095) + largo > 4096) { estado.malos++; break; }
      const h = M._mkw_w10_host(lugar >>> 12);
      if (!h) { estado.malos++; i += 8 + largo; continue; }
      let pegados = 0;
      for (const [o, l] of recortar(lugar, largo, rangos)) {
        if (sombraB) {
          const base = h + (lugar & 4095) + o, sb = lugar + o, cj = i + 8 + o;
          if (estado.cuadros >= 1) {
            let c = 0;
            for (let k = 0; k < l; k++) { const ahora = heap[base + k]; if (ahora !== sombraB[sb + k] && caja[cj + k] !== ahora) c++; }
            if (c) { const pg = (sb + 0) >>> 12; choquesCuadro.set(pg, (choquesCuadro.get(pg) || 0) + c);
              // (las palabras exactas de las páginas chicas fuera de 0x802F7000–0x80308000: dirección B→A)
              if (pg >= 0x2F7 && pg <= 0x308 && choquesDetalle.length < 24) for (let k = 0; k < l; k += 4) {
                const w = (x, j) => ((x[j] << 24) | (x[j + 1] << 16) | (x[j + 2] << 8) | x[j + 3]) >>> 0;
                const bv = w(heap, base + k), av = w(caja, cj + k), sv = w(sombraB, sb + k);
                if (bv !== sv && av !== bv) choquesDetalle.push(`${(((sb + k) < MEM1 ? 0x80000000 + sb + k : 0x90000000 + sb + k - MEM1) >>> 0).toString(16)}=${bv.toString(16)}→${av.toString(16)}`);
              }
            }
          }
          sombraB.set(caja.subarray(cj, cj + l), sb);
        }
        heap.set(caja.subarray(i + 8 + o, i + 8 + o + l), h + (lugar & 4095) + o);
        if (sombraC) { heap.set(caja.subarray(i + 8 + o, i + 8 + o + l), sombraC + lugar + o); if (tocadasC) heap[tocadasC + (lugar >>> 12)] = 1;
          if (bitsC) for (let w = (lugar + o) >>> 2, f = (lugar + o + l + 3) >>> 2; w < f; w++) heap[bitsC + (w >>> 3)] |= 1 << (w & 7); }   // (§240: la sombra de A en B, para deshacer el dibujo de los efectos)
        pegados += l;
      }
      estado.bytes += pegados; estado.saltados += largo - pegados;
      i += 8 + largo; tramos++;
    }
    estado.tramos += tramos;
    return tramos;
  };
  M.mkwW10Pegar = async () => {
    estado.llamadas = (estado.llamadas || 0) + 1;   // (diagnóstico §240)
    if (sombraB) { choquesCuadro = new Map(); choquesDetalle = []; }
    let tramos = 0;
    let leidos = false;
    for (;;) {
      const m = await siguiente();
      if (!leidos) { leerHilos(); leidos = true; }   // (con B parado aquí: sus hilos son los suyos)
      // (§240: A quedó quieto para la foto. B NO vuelve a dibujar el mismo cuadro: lo que el juego calcula al dibujar,
      // como el zoom suave de la cámara, avanzaría un paso más que en A. Sigue esperando con lo último presentado.)
      if (m.t === 'repite') { estado.repetidos++; continue; }
      tramos += pegar(new Uint8Array(m.b, 0, m.n), m.n);
      estado.cajas++;
      puerto.postMessage({ t: 'vuelta', b: m.b, r: null }, [m.b]);
      if (m.x?.fin) break;
    }
    estado.cuadros++;
    if (choquesCuadro?.size) {
      const dirDe = pg => ((pg << 12) < MEM1 ? 0x80000000 + (pg << 12) : 0x90000000 + (pg << 12) - MEM1) >>> 0;
      const lista = [...choquesCuadro].sort((a, b) => b[1] - a[1]);
      estado.choques = (estado.choques || 0) + lista.reduce((t, x) => t + x[1], 0);
      console.log(`[w10m] choques cuadro ${estado.cuadros}: ${lista.length} páginas, ` + lista.slice(0, 6).map(([pg, c]) => `${dirDe(pg).toString(16)}:${c}`).join(' ') + (choquesDetalle.length ? ' | ' + choquesDetalle.join(' ') : ''));
    }
    return tramos;
  };
  return { estado };
}

// la página: el Worker de mentira del dibujo y Module.mkwW10Caja. estado = lo que se midió (para mkwEstado.w10)
export function crearMandadero(M, { piezas = 4, tam = 4 << 20, url = new URL('./w10-dibujo.js', import.meta.url) } = {}) {
  const trabajador = new Worker(url, { type: 'module' });
  const canal = new MessageChannel();
  trabajador.postMessage({ t: 'puerto', puerto: canal.port2 }, [canal.port2]);
  const estado = { mandadas: 0, sinCaja: 0, grandes: 0, msCopia: 0, bytes: 0, aplicadas: 0, malos: 0 };
  const cinta = crearCinta({
    puerto: canal.port1, piezas, tam,
    // (al volver una caja se pide otra: la que vuelve cae justo en ese pedido; sin esto, con todas en camino y ninguna
    // libre, las que volvían se quedaban dentro de la cinta y nadie las pedía: atascado para siempre)
    alVolver: r => { if (r) { estado.aplicadas++; estado.malos += r.malos; } reponer(); },
  });
  // las cajas libres, sin esperar: tomar() devuelve una promesa ya resuelta si hay
  const libres = [];
  let pedidas = 0;   // tomar() que todavía no volvieron
  const reponer = () => {
    while (cinta.estado.enCamino + libres.length + pedidas < piezas) {
      pedidas++;
      cinta.tomar().then(c => { pedidas--; libres.push(c); });
    }
  };
  reponer();
  M.mkwW10Caja = (p, n, cuadro) => {
    const t0 = performance.now();
    let caja = libres.pop();
    if (!caja) { estado.sinCaja++; return; }
    // (la del cuadro que carga no entra: una caja nueva de su largo, que al volver queda en la cinta)
    if (caja.length < n) { estado.grandes++; libres.push(caja); caja = new Uint8Array(n); }
    caja.set(M.HEAPU8.subarray(p, p + n));
    cinta.entregar(caja, n, cuadro);
    estado.mandadas++; estado.bytes += n; estado.msCopia += performance.now() - t0;
    reponer();
  };
  // la huella de la copia del Worker (banco): espera a que vuelvan todas las cajas
  const huella = async () => {
    while (cinta.estado.enCamino > 0) await new Promise(r => setTimeout(r, 5));
    return new Promise(r => {
      const f = e => { if (e.data?.t === 'huella') { trabajador.removeEventListener('message', f); r(e.data.h); } };
      trabajador.addEventListener('message', f);
      trabajador.postMessage({ t: 'huella' });
    });
  };
  // W24 (§227): cuánto se achicó la caja para la red (w10-dibujo.js)
  const compresion = () => new Promise(r => {
    const f = e => { if (e.data?.t === 'compresion') { trabajador.removeEventListener('message', f); r(e.data.r); } };
    trabajador.addEventListener('message', f);
    trabajador.postMessage({ t: 'compresion' });
  });
  return { estado, cinta, huella, compresion, cerrar: () => trabajador.terminate() };
}
