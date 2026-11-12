// Paso 8 (N3/P10, bitácora §186): el «arnés» del juego para la prueba de la puerta A.
//
// Corre el juego entero (bajar el disco, armar los archivos, el programa, la carrera directa) con el MISMO código en
// los dos lugares que se comparan:
//   - dentro de un Worker (trabajador-hilo.mjs), con el lienzo transferido (OffscreenCanvas) y el DOM de mentira de
//     trabajador-dom.mjs: el hilo de la página queda libre (la interfaz, los mandos y la red);
//   - en el hilo de la página, como hoy (trabajador.html?hilo=principal): la referencia.
// Así lo único que cambia entre las dos medidas es DÓNDE corre (comparación eléctrica: el mismo motor probado en dos
// bancos distintos, con la misma carga y el mismo tacómetro).
//
// El disco (disco.mjs + lote.mjs + Cache Storage), la partida (guardado.mjs, IndexedDB) y la lista de pipelines
// (pipelines.mjs) corren aquí dentro: en un Worker existen fetch, caches e indexedDB. La página solo pone el lienzo, el
// sonido (el AudioWorklet de §88: el Worker le habla directo por un MessagePort, sin pasar por la página) y los mandos
// (cada cambio llega como mkw_web_pad, igual que hoy).
//
// Lo que mide: el tramo fijo de §163 (cuadros de lógica por segundo y la CPU por cuadro) y la huella de la carrera
// (huellaCarrera/huellaAmpliada de lockstep.mjs) de cada cuadro de lógica que se ve: con la misma semilla las dos
// corridas tienen que dar la misma carrera, cuadro por cuadro.
//
// correr({ parametros, origen, lienzo, canal }) → Promise<estado>
//   parametros: URLSearchParams (los de la página: modo=directa, pista, semilla, soloCpu, cpu, sinTope, tramo, lastre…)
//   origen: de dónde se bajan /manifiesto.json, /build/, /mkw/… (el servidor de la página)
//   lienzo: el <canvas> (en la página) o el OffscreenCanvas (en el Worker)
//   canal: { log(texto), sonido (el puente de §88: abrir/entregar/nivelMs/objetivoMs), vibrar(puerto, cmd), estado(e) }

import { crearDisco, leerPaquete, memoriaDeBloques } from './disco.mjs';
import { crearLotes } from './lote.mjs';
import { crearGuardado } from './guardado.mjs';
import { crearPipelines } from './pipelines.mjs';
import { crearLector } from './menus.mjs';
import { crearDirecto, armarFicha, prepararMii } from './directo.mjs';
import { huellaCarrera, huellaAmpliada } from './lockstep.mjs';
import { crearTramo, tramoDeParametros, repartoLastre, sinTopeActivo, crearBomba } from './sin-tope.mjs';
import { crearLastreCpu, lastreDeParametros } from './lastre.mjs';
import { modoW10, crearEnlaceA, crearDibujanteB } from './w10.mjs';

const RACEINFO = 0x809BD730;     // el puntero a Raceinfo (etapa +0x28, cuadros de lógica +0x20)

// Qué se baja entero al arrancar (lo mismo que precargar() de mkw.mjs): lo que el runtime abre con el sistema de
// archivos normal; lo demás queda «perezoso» y se lee por pedazos con el lector del disco
export const precargar = (prefijo, ruta) =>
  prefijo === '/wc/runtime/assets/' || prefijo === '/mkw/sd/riivolution/' ||
  (prefijo === '/mkw/disco/' && ruta.startsWith('sys/')) ||
  (prefijo === '/mkw/sd/RetroRewind6/' && /\.(xml|txt)$/i.test(ruta));

// Un turno nuevo del hilo sin temporizador (como enTareaNueva de mkw.mjs): un mensaje a uno mismo
const enTareaNueva = (() => {
  const c = new MessageChannel(), cola = [];
  c.port1.onmessage = () => cola.shift()();
  return f => { cola.push(f); c.port2.postMessage(0); };
})();

export async function correr({ parametros, origen = '', lienzo, canal }) {
  const ORIGEN = origen.replace(/\/+$/, '');
  const estado = globalThis.mkwEstado = {
    donde: typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope ? 'trabajador' : 'principal',
    fase: 'empezando', cuadros: 0, logica: null, enCarrera: false, lecturas: 0, bytes: 0, msEsperaDisco: 0,
    huellas: [], huellasDesde: null, tramo: null, error: '', jspi: 'Suspending' in WebAssembly, webgpu: !!globalThis.navigator?.gpu,
    log: [],
  };
  const escribe = t => { estado.log.push(t); if (estado.log.length > 4000) estado.log.splice(0, 1000); canal.log?.(t); };
  const nota = t => escribe('[nota] ' + t);
  const P = parametros;
  try {
    // 1) El manifiesto del disco y el disco
    estado.fase = 'manifiesto';
    const r = await fetch(ORIGEN + '/manifiesto.json');
    if (!r.ok) throw new Error('manifiesto: ' + r.status);
    const manifiesto = await r.json();
    const direccion = ruta => ORIGEN + ruta.split('/').map(encodeURIComponent).join('/');
    const lotes = P.get('lote') === '0' ? null : crearLotes({ url: ORIGEN + '/lote', base: ORIGEN + '/', registro: nota });
    const disco = crearDisco({ version: r.headers.get('X-Mkw-Version') || 'sin-version', lotes,
                               memoriaMax: memoriaDeBloques(globalThis.navigator?.deviceMemory) });
    await disco.abrir();
    estado.disco = disco.estado;
    const tamaños = new Map(), aBajar = [], carpetasVacias = [];
    for (const [prefijo, archivos] of Object.entries(manifiesto)) for (const [ruta, tam] of archivos) {
      const completa = prefijo + ruta;
      if (tam < 0) carpetasVacias.push(completa);
      else if (precargar(prefijo, ruta)) aBajar.push([completa, tam]);
      else tamaños.set(completa, tam);
    }
    // los diminutos en un paquete (§93) y los chicos de a 16
    estado.fase = 'bajando';
    const diminutos = disco.entero(ORIGEN + '/build/diminutos.bin').then(b => {
      let n = 0; for (const [ruta, datos] of leerPaquete(b)) if (tamaños.get(ruta) === datos.length && disco.fijar(direccion(ruta), datos)) n++;
      nota(`paquete de diminutos: ${n} archivos en la memoria`);
    }).catch(e => nota('sin paquete de diminutos: ' + e.message));
    const contenidos = new Map();
    let sig = 0;
    await Promise.all(Array.from({ length: 16 }, async () => {
      while (sig < aBajar.length) { const [ruta, tam] = aBajar[sig++]; contenidos.set(ruta, await disco.entero(direccion(ruta), tam)); }
    }));
    nota(`archivos chicos: ${contenidos.size}`);
    // la partida guardada en este navegador (IndexedDB) y la lista de pipelines (la semilla del servidor + la propia)
    const guardado = crearGuardado({});
    const pipelines = crearPipelines({ urlSemilla: ORIGEN + '/build/pipelines.bin', documento: globalThis.document });
    const [guardados, listas] = await Promise.all([guardado.cargar().catch(() => new Map()),
      P.get('precalentar') === 'no' ? {} : pipelines.cargar().catch(() => ({}))]);
    await diminutos;

    // 2) El lastre (gama baja simulada, §155/§162) y el tramo fijo (§163), como en mkw.mjs
    const SIN_TOPE = sinTopeActivo(P);
    const LASTRE = lastreDeParametros(P);
    const REPARTO = repartoLastre(P, SIN_TOPE, LASTRE.cpu);
    const lastreCpu = LASTRE.cpu > 1 || LASTRE.medir || REPARTO.cuadro > 1 ? crearLastreCpu({ k: REPARTO.pagina }) : null;
    const conLastre = f => (lastreCpu ? lastreCpu.envolver(f) : f);
    const TRAMO = tramoDeParametros(P);
    const subida = { ms: 0 };
    const nucleos = globalThis.navigator?.hardwareConcurrency || 4;
    const TOPE_PIPES = Math.max(2, Math.floor(nucleos / 4));

    // La espera por reloj del runtime (vi.cpp, sin enganche al monitor): cada cuadro, al terminar, espera aquí. Es el
    // momento de anotar la huella: el cuadro de lógica recién corrido y su huella (lo mismo en los dos lugares)
    let lector = null;
    const anotarHuella = () => {
      if (!lector || !estado.huellasDesde) return;
      const ri = lector.u32(RACEINFO); if (!ri) return;
      const et = lector.u32(ri + 0x28), n = lector.u32(ri + 0x20);
      if (et > 2 || n < estado.huellasDesde[0] || n > estado.huellasDesde[1]) return;
      const h = estado.huellas, ult = h[h.length - 1];
      if (ult && ult[0] === n) return;
      const a = huellaAmpliada(lector);
      h.push([n, huellaCarrera(lector), a.partes.join('.')]);
    };
    // §207.4 (W10, parte B): ?alto=N = al llegar al cuadro de lógica N de la carrera este programa se queda quieto para
    // siempre (para la foto: el Worker del dibujo recibe una vuelta más y presenta lo último que le llegó)
    const ALTO = Number(P.get('alto')) || 0;
    let w10 = null, quieto = false;
    const esperaReloj = (vencimiento, servicioMs) => new Promise(listo => {
      anotarHuella();
      if (ALTO && !quieto && lector) {
        const ri = lector.u32(RACEINFO), et = ri ? lector.u32(ri + 0x28) : -1;
        if (ri && et >= 0 && et <= 2 && lector.u32(ri + 0x20) >= ALTO) {
          quieto = true; estado.alto = lector.u32(ri + 0x20); nota(`quieto en el cuadro de lógica ${estado.alto}`);
          w10?.repite?.();
        }
      }
      if (quieto) return;   // (nunca vuelve: el juego queda quieto con esa imagen)
      const falta = vencimiento - performance.now();
      if (SIN_TOPE && falta <= 0) enTareaNueva(() => listo(1));
      else if (falta <= servicioMs) enTareaNueva(() => setTimeout(() => listo(1), Math.max(0, Math.ceil(falta))));
      else enTareaNueva(() => setTimeout(() => listo(0), servicioMs));
    });
    if (P.has('huellas')) { const m = /^(\d+)-(\d+)$/.exec(P.get('huellas')); if (m) estado.huellasDesde = [Number(m[1]), Number(m[2])]; }

    // 3) El programa
    estado.fase = 'programa';
    const t0 = performance.now();
    const crear = (await import(ORIGEN + '/build/mkw.js')).default;
    const M = await crear({
      canvas: lienzo,
      mkwGpuPreferencia: P.get('gpu') || 'alto',
      mkwVibrar: (p, c) => canal.vibrar?.(p, c),
      locateFile: f => ORIGEN + '/build/' + f,
      print: escribe, printErr: t => escribe('[err] ' + t),
      mkwLeeRango: async (ruta, inicio, largo) => {
        ruta = ruta.replace(/\/+/g, '/');
        const tam = tamaños.get(ruta);
        if (tam === undefined) return -2;
        if (inicio >= tam) return -3;
        const t = performance.now();
        try { const d = await disco.leer(direccion(ruta), tam, inicio, largo); estado.lecturas++; estado.bytes += d.length; return d; }
        catch (e) { escribe('[mkw] ' + e.message); return -1; }
        finally { estado.msEsperaDisco += performance.now() - t; }
      },
      mkwAvisoLectura: (ruta, tam) => { ruta = ruta.replace(/\/+/g, '/'); const t = tamaños.get(ruta); if (t !== undefined) disco.adelantar(direccion(ruta), t); },
      mkwSemillas: () => globalThis.mkwSemillaCarrera || null,
      get mkwRelojFijo() { return P.get('reloj') === 'fijo' || !!globalThis.mkwRelojFijo; },
      mkwLsArreglos: P.has('arreglos') ? (Number(P.get('arreglos')) | 0) : P.get('red') === 'estado' ? 0 : true,   // (§269b: ?arreglos=N = la máscara N de semillas_nativo.cpp; 0 = ninguno; §275b: con red=estado, 0 por omisión: cada consola corre su kart y nada se recalcula igual en todas)
      mkwRecorteDibujo: { '0': 0, modelos: 1 }[P.get('recorteDibujo')] ?? 2,
      mkwVistaPropia: (P.get('vista') === '0' ? 0 : 1) | (P.get('camara') === '0' ? 0 : 2),
      mkwPlantel: () => globalThis.mkwPlantel || null,
      mkwMiPuesto: () => globalThis.mkwMiPuesto ?? null,
      mkwPantallaPropia: () => globalThis.mkwPantallaPropia ?? -1,
      mkwUnaPantalla: P.get('unaPantalla') !== '0',
      mkwPuertos: 4,
      ...(canal.sonido && P.get('audio') !== 'viejo' ? { mkwSonido: canal.sonido } : {}),
      preRun: [m => {
        const FS = m.FS, hechas = new Set();
        const carpeta = ruta => { const c = ruta.slice(0, ruta.lastIndexOf('/')); if (!hechas.has(c)) { FS.mkdirTree(c); hechas.add(c); } };
        for (const [ruta, datos] of contenidos) { carpeta(ruta); FS.writeFile(ruta, datos); }
        for (const [ruta, tam] of tamaños) {
          carpeta(ruta);
          const nodo = FS.create(ruta, 0o444);
          nodo.usedBytes = tam;
          nodo.stream_ops = Object.assign({}, nodo.stream_ops, { read() { escribe('[mkw] perezoso leído por el FS: ' + ruta); throw new FS.ErrnoError(29); } });
        }
        contenidos.clear();
        carpetasVacias.forEach(c => FS.mkdirTree(c));
        guardado.restaurar(FS, guardados);
        pipelines.escribir(FS, listas);
        FS.mkdirTree('/datos/WiiCompiled');
        FS.writeFile('/datos/WiiCompiled/Config.toml', ['# trabajador-juego.mjs (paso 8)', '[audio]', 'mix_worker = false', '',
          '[network]', 'enabled = false', '', '[discord]', 'enabled = false', '',
          '[video]', 'widescreen = true', 'force_16_9 = true', '',
          '[paths]', 'dvd_root = "/mkw/disco"', 'retro_rewind_root = "/mkw/sd/RetroRewind6"', ''].join('\n'));
        m.ENV.XDG_DATA_HOME = '/datos';
        if (P.get('precalentarTope') !== '0') m.ENV.MKW_PRECALENTAR = `tarde:2:${TOPE_PIPES}`;
        FS.chdir('/wc');
      }],
      mkwEsperaReloj: conLastre(esperaReloj),
      ...(lastreCpu || TRAMO ? { mkwEsperaSubida: (() => { const f = conLastre(() => new Promise(r => setTimeout(r, 0)));
        return () => { const t = performance.now(); return Promise.resolve(f()).then(v => { subida.ms += performance.now() - t; return v; }); }; })() } : {}),
    });
    estado.programaMs = Math.round(performance.now() - t0);
    nota(`programa listo en ${estado.programaMs} ms (${estado.donde})`);
    globalThis.mkw = M;
    globalThis.mkwCuadros = () => M._mkw_web_cuadros();
    lector = globalThis.mkwMenus = crearLector(M);
    const directo = crearDirecto({ M, lector, nota });
    if (REPARTO.cuadro > 1 && M._mkw_lastre_cuadro) { M._mkw_lastre_cuadro(REPARTO.cuadro); nota(`lastre por cuadro: K = ${REPARTO.cuadro}`); }
    // §207.4 (W10, parte B): con el programa de MKW_W10_COMPILAR=1 y un cable al otro Worker (canal.w10puerto):
    // ?w10=8 = soy el Worker del dibujo (pego las cajas), 9 = el de la carrera sin dibujo, 10 = el de la carrera que
    // también dibuja (para comprobar). Se prende con la carrera andando (en los menús el dibujo no es un sumidero)
    const W10 = modoW10(P.get('w10'));
    let w10Prendido = false;
    if (W10 >= 8 && M._mkw_w10_modo && canal.w10puerto) {
      w10 = W10 === 8 ? crearDibujanteB(M, canal.w10puerto, { sinHilos: P.get('w10Hilos') === '1', choques: P.get('w10Choques') === '1' }) : crearEnlaceA(M, canal.w10puerto);
      estado.w10 = w10.estado;
      nota(`W10: ${W10 === 8 ? 'Worker del dibujo' : 'Worker de la carrera' + (W10 === 10 ? ' (también dibuja)' : '')}`);
    }

    // ¿Hay carrera andando? (Raceinfo con etapa < 4) y los cuadros de lógica
    setInterval(() => {
      let en = false, n = null;
      try { const ri = lector.u32(RACEINFO); if (ri) { const et = lector.u32(ri + 0x28); en = et < 4; if (et <= 2) n = lector.u32(ri + 0x20); } } catch {}
      estado.enCarrera = en; estado.logica = n; estado.cuadros = M._mkw_web_cuadros();
      if (w10 && en && !w10Prendido) { w10Prendido = true; M._mkw_w10_modo(W10); if (P.get('w10SinEfectos') === '1') M._mkw_w10_sin_efectos?.(1); if (P.get('w10Deshacer') !== null) M._mkw_w10_deshacer_efectos?.(Number(P.get('w10Deshacer')) || 0); if (P.get('w10Hecho') === '0') M._mkw_w10_hecho?.(0); if (P.get('w10Traza')) M._mkw_w10_traza?.(Number(P.get('w10Traza')) || 0); nota(`W10: modo ${W10} con la carrera andando`); }
    }, 100);
    if (SIN_TOPE && M._mkw_prisa) {
      const bomba = crearBomba({ prisa: ms => M._mkw_prisa(ms), enCarrera: () => estado.enCarrera });
      const todo = M._mkw_lastre_cuadro_todo || null;
      setInterval(() => { const ms = bomba.tic(); todo?.(ms > 0 ? 1 : 0); }, 100);
    }
    if (TRAMO) {
      const ec = M._mkw_lastre_cuadro_estado;
      const tramo = crearTramo({ ...TRAMO, leer: () => {
        let logica = null;
        try { const ri = lector.u32(RACEINFO), et = ri ? lector.u32(ri + 0x28) : -1; if (ri && et >= 0 && et <= 2) logica = lector.u32(ri + 0x20); } catch {}
        return { logica, imagenes: M._mkw_web_cuadros(), esperaRuntime: M._mkw_web_ms_espera(), esperaSubida: subida.ms,
                 giro: (REPARTO.cuadro > 1 && ec ? ec(0) : 0) + (lastreCpu?.estado.ms ?? 0) };
      } });
      estado.tramo = { ...TRAMO, empezo: false, resultado: null };
      const reloj = setInterval(() => {
        const res = tramo.tic(); estado.tramo.empezo = tramo.empezo;
        if (!res) return;
        clearInterval(reloj);
        estado.tramo.resultado = res;
        nota(`tramo (§163): ${JSON.stringify(res)}`);
      }, 2);
    }

    // 4) A correr: main() y, con ?modo=directa, la carrera directa (directo.mjs, como en mkw.mjs)
    estado.fase = 'corriendo';
    guardado.vigilar(M.FS);
    pipelines.vigilar(M);
    // la base de Mii con al menos uno: con él el juego crea la licencia 1 si la partida es nueva (como mkw.mjs; sin los
    // invitados de §86, que se sacan de la imagen del juego con un <canvas> de la página)
    const mii = prepararMii(M.FS, P.get('nombre') || 'Piloto');
    directo.ponerMii(mii);
    if (mii.nueva) nota('directo: base de Mii vacía, puse un Mii para la licencia');
    M.callMain([]);
    if (M._mkw_web_pipelines_precalentar && P.get('precalentarTope') !== '0') M._mkw_web_pipelines_precalentar();
    if ((P.get('modo') || 'directa') === 'directa') {
      const [c, f] = (P.get('pista') || '0.0').split('.').map(Number);
      const ficha = armarFicha({ pista: 0x100 + 4 * c + (f || 0), cc: P.get('cc') || 'c150', cpu: P.get('cpu') || 'normal',
        humanos: [{ personaje: Number(P.get('pj') ?? 0), vehiculo: Number(P.get('kart') ?? 1), mando: 0 }],
        semilla: Number(P.get('semilla') || 0) >>> 0, objetos: Number(P.get('objetos') || 0), intro: P.get('intro') === '1' });
      if (P.get('soloCpu') === '1') ficha.puestos[0] = { ...ficha.puestos[0], tipo: 1, mando: -1 };
      estado.ficha = ficha;
      // ?reloj=fijo: el azar de la carrera sale de la semilla de la ficha y del reloj de la carrera (como en la sala,
      // semillas_nativo.cpp): así dos corridas con la misma semilla dan la misma carrera, cuadro por cuadro
      if (P.get('reloj') === 'fijo') globalThis.mkwSemillaCarrera = ficha.semilla;
      directo.carrera(ficha).then(llego => { estado.carrera = llego; nota(`directo: carrera ${llego ? 'abierta' : 'no se pudo'}`); });
    }
    return estado;
  } catch (e) {
    estado.error = String(e && e.stack || e);
    estado.fase = 'falló';
    escribe('[err] ' + estado.error);
    return estado;
  }
}
