// §274: «⚡ Auto calibración: máxima fluidez» (pedido del dueño, 2026-11-10: «un botón de auto calibración de settings que
// pruebe de manera rápida y elija las settings que hagan que se vea más fluido el juego (menor 1 % lows)
// automáticamente. Recuerda siempre lógica a 60 fps. […] si está en un multiplayer debiera pausar los contadores y los
// juegos […] con un aviso claro. Todo eso debiera ser en máximo 30 segundos»).
//
// Resumen. Al apretar el botón, la página prueba unas pocas combinaciones de los ajustes de imagen que se aplican en el
// momento (sin reiniciar el juego), mide cada una ~2 s y deja puesta la que da la imagen más PAREJA: el mejor «1 % bajo»
// (de todas las imágenes, el 1 % que más tardó, pasado a fps: imagenes-vista.mjs) y, a igualdad, más imágenes por segundo.
//   - Qué se prueba: primero la «Imagen» (N8, §219/§255: 60 siempre, 30 parejas, 30 con imagen intermedia) con la
//     resolución de salida de ahora; después, SOLO si frena la tarjeta de video (las imágenes no llegan y el procesador
//     tiene tiempo de sobra, o la tarjeta tarda más de 12 ms), la resolución de salida (§108) más baja con la mejor
//     Imagen. Los efectos (§252) no se tocan: quitarlos cambia lo que se ve y la regla del proyecto es no sacar efectos
//     (el jugador los puede apagar a mano); las texturas (§253) valen recién desde la pista siguiente y la resolución
//     interna y la fluidez piden reiniciar: no se pueden medir en 30 s (al final se sugieren si hace falta).
//   - La lógica siempre a 60: una combinación con la que el juego no calcula 57 cuadros de carrera por segundo o más
//     queda descartada (jugando solo se mide directo; en la sala, con la lógica congelada, se calcula, ver abajo).
//   - Cada combinación: 0,5 s de calentamiento que no se cuenta (el cambio mismo hace un tirón) y 2 s de medida.
//     Con 3 de Imagen + hasta 3 de salida son ~15 s; todo tiene un tope de 30 s desde el clic (TOPE_MS): si no cabe otra
//     prueba, no se hace.
//   - Dónde: con la escena de verdad, en la carrera. En los menús no hay qué medir (ahí ni N8 se usa y el dibujo es otro):
//     el botón queda «pendiente» y la calibración empieza sola 5 s después de que largue la próxima carrera, con aviso.
//   - En la SALA (§274.3): la sala entera se pausa (sala-carrera.mjs {t:'pausaPido'}): todas las consolas congelan la
//     LÓGICA después del mismo cuadro (lockstep.mjs congelarEn + congelar; web/juego/congelar_nativo.cpp: el juego deja
//     de calcular pero sigue dibujando la escena quieta), así ninguna corre un cuadro sin los botones de todos, el reloj
//     de la carrera (y con él el DNF y el tiempo límite) no avanza, y los plazos de la sala (copa, elección, descanso)
//     quedan quietos. Quien calibra mide sobre esa escena quieta: el dibujo y la tarjeta trabajan como en la carrera; lo
//     que cuesta la lógica se midió justo antes de pausar (base) y se suma (estimarLogica). Al terminar (o a los 30 s),
//     todos siguen desde el mismo cuadro: la huella no cambia porque nadie corrió nada.
// Como el «autotune» de un variador de frecuencia: con el motor en la carga de verdad prueba unos pocos juegos de
// parámetros, mide la respuesta y deja el mejor; si la máquina es compartida (la sala), primero se para la línea.

export const TOPE_MS = 30000;            // todo, desde el clic, como mucho esto (pedido del dueño)
export const CALIENTA_MS = 500;          // tras cada cambio, esto no se cuenta
export const MIDE_MS = 2000;             // lo que se mide de cada combinación
export const RESERVA_MS = 1200;          // lo que queda para volver a lo elegido y soltar la pausa
export const BASE_MS = 1200;             // en la sala: lo que se mide con la lógica andando antes de pedir la pausa
export const LOGICA_MIN = 57;            // cuadros de lógica por segundo: menos = esta combinación no va a 60
export const OCUPADO_MAX = 0.95;         // en la sala: la lógica estimada tiene que caber en el 95 % del cuadro
export const EMPATE = 0.03;              // dos 1 % bajos a menos de un 3 % = empate (decide el promedio)
export const PENDIENTE_TRAS_MS = 5000;   // pendiente: empieza esto después de que la carrera anda (los primeros segundos traen los
                                         // tirones de los pipelines que se arman al largar: medidos, ensucian la primera prueba)
export const N8_MODOS = [0, 1, 2];
export const SALIDAS_PRUEBA = [1080, 900, 720, 540, 360];
export const NOMBRE_N8 = { 0: '60 siempre', 1: '30 parejas', 2: '30 con imagen intermedia' };
export const textoSalida = s => (s ? `salida ${s}` : 'salida de tu pantalla');
export const textoCombo = c => `${NOMBRE_N8[c.n8] ?? c.n8} · ${textoSalida(c.salida)}`;
const f1 = x => (Number.isFinite(x) ? Math.round(x) : '—');

// las salidas que vale la pena probar con el lienzo de `alto` pixeles (las de más arriba no cambian nada): preferidas
// 720, 540 y 360; si la pantalla es más chica que todas, la más alta de las que quedan bajo ella
export function salidasAProbar(alto, max = 3) {
  const bajo = SALIDAS_PRUEBA.filter(v => Number.isFinite(alto) && v < alto * 0.95);
  const pref = [720, 540, 360].filter(v => bajo.includes(v));
  return (pref.length ? pref : bajo.slice(0, 1)).slice(0, max);
}

// La lógica con la sala congelada (estimada). base = lo medido con la lógica andando y la combinación de ahora:
// { logica (cuadros/s), ocupado (fracción del tiempo que el hilo del juego trabajó) }; congeladas, cada combinación da
// { vueltas (vueltas del bucle por segundo, todas sin lógica), ocupado }. El costo de una vuelta (segundos de trabajo):
//   con lógica = base.ocupado / base.logica;  sin lógica (combinación c) = c.ocupado / c.vueltas
//   lógica sola = con lógica − sin lógica (de la combinación de ahora)
//   la combinación c CON lógica = lógica sola + sin lógica de c  →  cabe a 60 si ≤ OCUPADO_MAX / 60
// Devuelve los cuadros de lógica por segundo que daría (tope 60) o null si no se puede estimar.
export function estimarLogica(c, base, actual) {
  const vale = x => x && Number.isFinite(x.ocupado) && x.ocupado >= 0;
  if (!vale(base) || !(base.logica > 0) || !vale(c) || !(c.vueltas > 0) || !vale(actual) || !(actual.vueltas > 0)) return null;
  const logicaSola = Math.max(0, base.ocupado / base.logica - actual.ocupado / actual.vueltas);
  const costo = logicaSola + c.ocupado / c.vueltas;
  if (!(costo > 0)) return 60;
  return Math.min(60, (OCUPADO_MAX / costo));
}
// ¿la lógica llega a 60 con esta combinación? (medida directa si la hay; si no, estimada; sin datos, se da por buena)
export function logicaDe(r, base = null, actual = null) {
  if (Number.isFinite(r?.logica)) return { logica: r.logica, estimada: false };
  const e = estimarLogica(r, base, actual);
  return { logica: e, estimada: true };
}
export const llegaA60 = l => l === null || l === undefined || l >= LOGICA_MIN;

// cuán fiel es la imagen (a igualdad de fluidez se prefiere la más fiel: 60 de verdad, luego la intermedia, luego 30;
// y la salida más alta)
export function fidelidad(c) {
  const n = c.n8 === 0 ? 30 : c.n8 === 2 ? 20 : 10;
  const i = c.salida ? SALIDAS_PRUEBA.indexOf(c.salida) : -1;
  return n + (c.salida ? 8 - Math.max(0, i) : 9);
}
// Elegir entre lo medido: solo las que llegan a 60 de lógica; el mejor 1 % bajo (empate a menos de EMPATE) → más
// imágenes por segundo (a menos de un 2 %) → la más fiel. Si ninguna llega a 60, la de más lógica (sinLogica = true).
export function elegir(resultados) {
  const medidas = resultados.filter(r => r && Number.isFinite(r.bajo1));
  if (!medidas.length) return null;
  const validas = medidas.filter(r => r.llega !== false);
  if (!validas.length) {
    // (las que están a menos de un 5 % de la que más lógica da son empate: entre ellas, el mejor 1 % bajo)
    const maxL = Math.max(...medidas.map(r => r.logicaFinal ?? -1));
    const cerca = medidas.filter(r => (r.logicaFinal ?? -1) >= maxL * 0.95);
    const m = [...cerca].sort((a, b) => b.bajo1 - a.bajo1 || fidelidad(b) - fidelidad(a))[0];
    return { ...m, sinLogica: true };
  }
  const mejorBajo = Math.max(...validas.map(r => r.bajo1));
  const c1 = validas.filter(r => r.bajo1 >= mejorBajo * (1 - EMPATE));
  const mejorFps = Math.max(...c1.map(r => r.fps ?? 0));
  const c2 = c1.filter(r => (r.fps ?? 0) >= mejorFps * 0.98);
  return [...c2].sort((a, b) => fidelidad(b) - fidelidad(a))[0];
}
// ¿frena la tarjeta? (con la mejor Imagen las imágenes no llegan a lo pedido y el procesador tiene tiempo de sobra, o
// la tarjeta tarda más de 12 ms por imagen)
export function frenaTarjeta(r) {
  if (!r) return false;
  const meta = r.n8 === 1 ? 30 : 60;
  if (Number.isFinite(r.bajo1) && r.bajo1 >= 0.95 * meta && Number.isFinite(r.fps) && r.fps >= 0.95 * meta) return false;
  if (Number.isFinite(r.gpuMs) && r.gpuMs > 12) return true;
  return Number.isFinite(r.ocupado) && r.ocupado < 0.85;
}

// La búsqueda. actual = { n8: el modo que corre ahora (0/1/2), salida }, alto = el lienzo en pixeles,
// aplicar(c) (async: pone la combinación), esperar(ms), medir(ms) → { bajo1, fps, logica?, ocupado, vueltas?, gpuMs? },
// base = lo medido antes con la lógica andando (sala) o null, tope = ms desde t0. Devuelve lo elegido y todo lo medido.
export async function calibrar({ actual, alto, aplicar, esperar, medir, ahora = () => performance.now(), t0 = ahora(), tope = TOPE_MS,
                                 base = null, alProgreso = () => {} }) {
  const resultados = [];
  const queda = () => tope - (ahora() - t0);
  // (lo que dura una prueba: lo pedido o, si el aparato tardó más en la anterior —una pestaña trabada—, eso)
  let dura = CALIENTA_MS + MIDE_MS;
  const cabe = () => queda() >= dura + RESERVA_MS;
  let cortado = false;
  const plan = [];
  const probar = async c => {
    if (!cabe()) { cortado = true; return null; }
    alProgreso({ paso: resultados.length + 1, combo: c, queda: queda() });
    const tp = ahora();
    await aplicar(c);
    await esperar(CALIENTA_MS);
    const m = await medir(MIDE_MS);
    const r = { ...c, ...m };
    resultados.push(r);
    dura = Math.max(dura, ahora() - tp);
    return r;
  };
  const revisar = () => {
    const actualMedido = resultados.find(r => r.n8 === actual.n8 && r.salida === actual.salida) || resultados[0];
    for (const r of resultados) { const l = logicaDe(r, base, actualMedido); r.logicaFinal = l.logica; r.logicaEstimada = l.estimada; r.llega = llegaA60(l.logica); }
  };
  // etapa 1: la Imagen (lo de ahora primero: es la base del «antes» y la de la lógica estimada)
  for (const n8 of [actual.n8, ...N8_MODOS.filter(x => x !== actual.n8)]) { plan.push({ n8, salida: actual.salida }); if (!await probar({ n8, salida: actual.salida })) break; }
  revisar();
  const mejor1 = elegir(resultados);
  // etapa 2: la salida, solo si frena la tarjeta
  const frena = frenaTarjeta(mejor1);
  if (frena && mejor1) {
    for (const s of salidasAProbar(alto)) {
      if (s === actual.salida) continue;
      plan.push({ n8: mejor1.n8, salida: s });
      if (!await probar({ n8: mejor1.n8, salida: s })) break;
    }
    revisar();
  }
  const elegido = elegir(resultados);
  const antes = resultados.find(r => r.n8 === actual.n8 && r.salida === actual.salida) || null;
  const queda1 = queda();
  if (elegido) await aplicar({ n8: elegido.n8, salida: elegido.salida });
  else await aplicar(actual);
  return { elegido, antes, resultados, frena, cortado, plan, ms: ahora() - t0, sobro: queda1 };
}

// El texto del resultado: «Elegido: 30 parejas · salida 720 — 1 % bajo 58 fps (antes 31)»
export function textoEleccion(r, { escala = 1, fluidez = 0 } = {}) {
  if (!r?.elegido) return 'No se pudo medir (¿la carrera terminó?). Lo de antes quedó como estaba.';
  const e = r.elegido;
  let t = `Elegido: ${textoCombo(e)} — 1 % bajo ${f1(e.bajo1)} fps` + (r.antes && r.antes !== e ? ` (antes ${f1(r.antes.bajo1)})` : ' (lo que ya tenías era lo mejor)');
  if (e.sinLogica) t += '. Ninguna combinación llegó a 60 de lógica: se dejó la que más se acercó.';
  if ((escala > 1 || fluidez > 0) && Number.isFinite(e.bajo1) && e.bajo1 < 50)
    t += ' Para más fluidez prueba bajar «Resolución interna» o «Fluidez» (piden reiniciar el juego).';
  return t;
}

// ---------------- la página: el controlador ----------------
// d = lo que se necesita de mkw.mjs (todo inyectado, así el banco lo prueba con un juego de mentira):
//   leer() / guardar(g) (mkw.graficos), aplicarN8(v), aplicarSalida(s), modoN8() (el que corre: 0/1/2), alto(),
//   enCarrera() (la carrera andando: etapa 2), medidor: { marca(), resumen(desde) → {bajo1, fps}, logica() → n (cuenta
//   de cuadros de lógica), trabajo() → { t, espera, lastre } (ms acumulados), vueltasCongelado() → n, gpuMs() },
//   congelarJuego(si) (mkw_congelar), sala() → la sala (sala-carrera) o null, lockstep() → el de la carrera o null,
//   yo, nombreDe(uid), nota(t), alEstado({ texto, corriendo, pendiente, deshacer }), aviso (crearAvisoPausa),
//   ahora(), esperar(ms), cada(f, ms)
export function crearAutoCalibrar(d) {
  const ahora = d.ahora || (() => performance.now());
  const esperar = d.esperar || (ms => new Promise(r => setTimeout(r, ms)));
  const est = { corriendo: false, pendiente: false, ultimo: null, previo: null, veces: 0, pausaVista: null, congeladaPor: null, historial: [] };
  const decir = (texto, extra = {}) => { est.texto = texto; d.alEstado?.({ texto, corriendo: est.corriendo, pendiente: est.pendiente, deshacer: !!est.previo, ...extra }); };
  const nota = t => { est.historial.push(t); if (est.historial.length > 40) est.historial.shift(); d.nota?.(`[auto-calibrar] ${t}`); };

  // lo que se mide en una ventana de ms: imágenes (1 % bajo, fps), lógica por segundo, cuánto trabajó el hilo, vueltas
  async function medir(ms, { congelada = false } = {}) {
    const m = d.medidor, t0 = m.trabajo(), marca = m.marca(), l0 = m.logica(), v0 = m.vueltasCongelado?.() ?? 0;
    await esperar(ms);
    const t1 = m.trabajo(), dt = t1.t - t0.t, r = m.resumen(marca) || {};
    const ocupado = dt > 0 ? Math.max(0, Math.min(1, (dt - (t1.espera - t0.espera) + (t1.lastre - t0.lastre)) / dt)) : null;
    const out = { bajo1: r.bajo1 ?? null, fps: r.fps ?? null, imagenes: r.imagenes ?? 0, ocupado, gpuMs: m.gpuMs?.() ?? null };
    if (congelada) out.vueltas = dt > 0 ? ((m.vueltasCongelado?.() ?? 0) - v0) * 1000 / dt : null;
    else { const l1 = m.logica(); out.logica = dt > 0 && Number.isFinite(l1 - l0) && l1 >= l0 ? (l1 - l0) * 1000 / dt : null; }
    return out;
  }
  const aplicar = async c => { d.aplicarN8(c.n8); d.aplicarSalida(c.salida); };

  async function correr(t0, { congelada = false, base = null, tope = TOPE_MS } = {}) {
    const g = d.leer();
    const actual = { n8: d.modoN8(), salida: g.salida };
    nota(`empieza (${congelada ? 'sala congelada' : 'con la carrera andando'}): ahora ${textoCombo(actual)}, lienzo ${d.alto()} px`);
    const r = await calibrar({ actual, alto: d.alto(), aplicar, esperar, medir: ms => medir(ms, { congelada }), ahora, t0, tope, base,
      alProgreso: p => decir(`⚡ Probando ${p.paso}: ${textoCombo(p.combo)}… (quedan ${Math.ceil(p.queda / 1000)} s)`) });
    for (const x of r.resultados) nota(`${textoCombo(x)}: 1 % bajo ${f1(x.bajo1)}, ${f1(x.fps)} fps, lógica ${f1(x.logicaFinal)}${x.logicaEstimada ? ' (estimada)' : ''}, ocupado ${Number.isFinite(x.ocupado) ? Math.round(100 * x.ocupado) + ' %' : '—'}${x.llega === false ? ' — descartada (lógica < 60)' : ''}`);
    if (r.elegido) {
      est.previo = { n8: g.n8, salida: g.salida };
      d.guardar({ ...d.leer(), n8: r.elegido.n8, salida: r.elegido.salida });
    }
    r.texto = textoEleccion(r, g);
    est.ultimo = r; est.veces++;
    nota(`${r.texto} (${(r.ms / 1000).toFixed(1)} s${r.cortado ? ', cortada por el tope' : ''})`);
    return r;
  }

  // la sala: pedir la pausa, esperar que llegue, congelar y medir
  async function enSala(t0, s, ls) {
    // 1) la lógica andando, con lo de ahora: la base de la lógica estimada
    decir('⚡ Midiendo cómo va la carrera…');
    const base = await medir(BASE_MS);
    if (!d.enCarrera()) return { cancelada: 'la carrera terminó' };
    // 2) la pausa: desde 1 s más adelante (todas las consolas llegan a ese cuadro con los botones de todos)
    const cuadro = (ls?.estado?.().cuadro ?? -1) >= 0 ? ls.estado().cuadro + (d.margenCuadros ?? 60) : null;
    const ms = Math.max(5000, Math.floor(TOPE_MS - (ahora() - t0) - 300));
    let no = null;
    est.esperaNo = m => { no = m; };
    if (!s.pedirPausa({ ms, cuadro })) return { cancelada: 'la sala no está lista' };
    decir('⚡ Pidiendo la pausa de la sala…');
    const limite = ahora() + 3000;
    while (!(s.pausa?.de === d.yo) && no === null && ahora() < limite) await esperar(50);
    est.esperaNo = null;
    if (no !== null) return { cancelada: no === 'usada' ? 'ya usaste tu pausa en esta carrera' : no === 'otra' ? 'otro piloto está calibrando' : 'la sala no la permite ahora' };
    if (s.pausa?.de !== d.yo) return { cancelada: 'la sala no contestó' };
    // 3) esperar a quedar congelada (alEstadoSala lo hace al llegar al cuadro)
    const hasta = ahora() + 3000;
    while (est.congeladaPor !== d.yo && ahora() < hasta) await esperar(30);
    if (est.congeladaPor !== d.yo) { s.terminarPausa(); return { cancelada: 'la carrera no llegó a congelarse' }; }
    const resto = s.restan(s.pausa?.hasta);
    const tope = Math.min(TOPE_MS, (ahora() - t0) + resto - 600);
    try { return await correr(t0, { congelada: true, base: { logica: base.logica, ocupado: base.ocupado }, tope }); }
    finally { s.terminarPausa(); }
  }

  async function apretar() {
    if (est.corriendo) return null;
    const s = d.sala?.() || null;
    if (!d.enCarrera()) {
      est.pendiente = true; est.pendienteDesde = null;
      decir('⚡ Pendiente: se calibra sola 5 s después de que largue tu próxima carrera (en los menús no hay carrera que medir).', { pendiente: true });
      nota('pendiente hasta la próxima carrera');
      return null;
    }
    est.pendiente = false;
    est.corriendo = true;
    const t0 = ahora();
    let r;
    try {
      r = s ? await enSala(t0, s, d.lockstep?.()) : await correr(t0);
    } catch (e) { r = { cancelada: String(e?.message || e) }; }
    finally { est.corriendo = false; }
    if (r?.cancelada) { nota(`no se calibró: ${r.cancelada}`); decir(`No se calibró: ${r.cancelada}.`); est.ultimo = r; return r; }
    decir(r.texto, { resultado: r });
    return r;
  }
  function deshacer() {
    if (!est.previo || est.corriendo) return false;
    const p = est.previo; est.previo = null;
    d.guardar({ ...d.leer(), n8: p.n8, salida: p.salida });
    d.aplicarN8(p.n8); d.aplicarSalida(p.salida);
    nota(`deshecho: vuelve a ${p.n8 === 'auto' ? 'Automático' : NOMBRE_N8[p.n8]} · ${textoSalida(p.salida)}`);
    decir('Vuelto como estaba.');
    return true;
  }

  // §274.3: cada consola de la sala, en cada estado nuevo: la pausa (de quien sea) congela; sin pausa, sigue
  function alEstadoSala(estado) {
    const s = d.sala?.(), ls = d.lockstep?.(), p = estado?.pausaSala || null;
    const clave = p ? `${p.id}` : null;
    if (clave && est.pausaVista !== clave) {
      est.pausaVista = clave;
      nota(`pausa de la sala de ${p.de}${p.cuadro !== null && p.cuadro !== undefined ? ` desde el cuadro ${p.cuadro}` : ''}`);
      const congelar = c => {
        if (est.pausaVista !== clave) return;   // (ya terminó)
        d.congelarJuego(true); ls?.congelar(true); est.congeladaPor = p.de;
        nota(`congelada${Number.isFinite(c) ? ` en el cuadro ${c}` : ''}`);
      };
      if (ls && p.cuadro !== null && p.cuadro !== undefined && d.enCarrera()) ls.congelarEn(p.cuadro, congelar);
      else if (d.enCarrera()) congelar(null);
      if (p.de !== d.yo) d.aviso?.mostrar(d.nombreDe?.(p.de) || 'Un piloto', () => s?.restan(p.hasta) ?? 0);
    }
    if (!p && est.pausaVista) soltar('fin de la pausa');
  }
  function soltar(por) {
    const habia = est.congeladaPor !== null;
    est.pausaVista = null;
    if (habia) { d.lockstep?.()?.congelar(false); d.congelarJuego(false); est.congeladaPor = null; nota(`sigue (${por})`); }
    d.aviso?.ocultar();
  }
  // el reloj: lo pendiente arranca en la carrera; la pausa que nadie termina se suelta sola (la anfitriona se fue)
  const reloj = (d.cada || ((f, ms) => setInterval(f, ms)))(() => {
    if (est.pendiente && !est.corriendo) {
      if (!d.enCarrera()) est.pendienteDesde = null;
      else if (est.pendienteDesde === null) est.pendienteDesde = ahora();
      else if (ahora() - est.pendienteDesde >= PENDIENTE_TRAS_MS) { est.pendiente = false; apretar(); }
    }
    const s = d.sala?.(), p = s?.pausa;
    if (est.pausaVista && (!p || s.restan(p.hasta) <= 0) && ahora() - (est.sinPausaDesde ??= ahora()) > 1500) { est.sinPausaDesde = null; soltar('tope'); }
    else if (p && s.restan(p.hasta) > 0) est.sinPausaDesde = null;
  }, 250);
  const alPausaNo = m => est.esperaNo?.(m);
  return { apretar, deshacer, alEstadoSala, alPausaNo, soltar, medir, get estado() { return est; }, reloj };
}

// ---------------- el aviso en todas las consolas de la sala ----------------
const CSS = `
#pausaSala { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; pointer-events: none; }
#pausaSala[hidden] { display: none; }
#pausaSala .ps-caja { pointer-events: auto; max-width: min(520px, calc(100vw - 32px)); padding: 18px 22px; border-radius: 18px;
  background: #17142aee; border: 2px solid #ffd21f; color: #f1effa; text-align: center; box-shadow: 0 8px 30px #0008; }
#pausaSala b { display: block; font: 400 24px 'Lilita One', system-ui, sans-serif; color: #ffd21f; }
#pausaSala p { margin: 6px 0 0; font-size: 15px; line-height: 1.4; }
.ac-fila { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
#autoCalibrar { font-weight: 700; }
#autoCalibrarEstado { margin: 6px 0 0; }
`;
export function crearAvisoPausa(doc = globalThis.document) {
  if (!doc.getElementById('estiloAutoCalibrar')) { const st = doc.createElement('style'); st.id = 'estiloAutoCalibrar'; st.textContent = CSS; doc.head.append(st); }
  const nodo = doc.createElement('div'); nodo.id = 'pausaSala'; nodo.hidden = true; nodo.setAttribute('role', 'alert');
  const caja = doc.createElement('div'); caja.className = 'ps-caja';
  const b = doc.createElement('b'), p = doc.createElement('p');
  caja.append(b, p); nodo.append(caja); doc.body.append(nodo);
  let reloj = null;
  return {
    nodo,
    mostrar(nombre, restan) {
      const pinta = () => {
        const s = Math.max(0, Math.ceil((restan() || 0) / 1000));
        b.textContent = `⏸ ${nombre} está calibrando su imagen — vuelve en ${s} s`;
        p.textContent = 'La carrera y todos los relojes de la sala están en pausa. Nadie pierde puestos ni puntos: todos siguen desde el mismo instante.';
      };
      pinta(); nodo.hidden = false;
      clearInterval(reloj); reloj = setInterval(pinta, 250);
    },
    // §285: el mismo aviso con otro texto (la espera de la carga de la carrera); pinta() lo rehace cada 250 ms
    poner(pinta) { const f = () => { const [t1, t2] = pinta(); b.textContent = t1; p.textContent = t2; }; f(); nodo.hidden = false;
      clearInterval(reloj); reloj = setInterval(f, 250); },
    ocultar() { clearInterval(reloj); reloj = null; nodo.hidden = true; },
    get visible() { return !nodo.hidden; },
    get texto() { return b.textContent; },
  };
}

// el botón de Gráficos (y su estado y «Deshacer»); alApretar/alDeshacer los da quien lo monta
export function montarBotonCalibrar(doc, { alApretar = () => {}, alDeshacer = () => {} } = {}) {
  if (!doc.getElementById('estiloAutoCalibrar')) { const st = doc.createElement('style'); st.id = 'estiloAutoCalibrar'; st.textContent = CSS; doc.head.append(st); }
  const caja = doc.createElement('div'); caja.id = 'autoCalibrarCaja';
  const fila = doc.createElement('div'); fila.className = 'fila ac-fila';
  const boton = doc.createElement('button'); boton.type = 'button'; boton.className = 'boton'; boton.id = 'autoCalibrar';
  boton.textContent = '⚡ Auto calibración: máxima fluidez';
  const desh = doc.createElement('button'); desh.type = 'button'; desh.className = 'boton chico'; desh.id = 'autoCalibrarDeshacer';
  desh.textContent = 'Deshacer'; desh.hidden = true;
  const estado = doc.createElement('p'); estado.className = 'nota-graficos'; estado.id = 'autoCalibrarEstado'; estado.setAttribute('role', 'status');
  estado.textContent = 'Prueba sola, en unos 15–30 s, las opciones de Imagen y de resolución de salida y deja la que se ve más pareja ' +
    '(el mejor «1 % bajo»). La carrera siempre se calcula a 60. En la sala, pausa a todos mientras dura, con un aviso.';
  boton.onclick = () => alApretar();
  desh.onclick = () => alDeshacer();
  fila.append(boton, desh); caja.append(fila, estado);
  return {
    nodo: caja, boton, estado,
    pintar({ texto, corriendo, deshacer }) { if (texto) estado.textContent = texto; boton.disabled = !!corriendo; desh.hidden = !deshacer || !!corriendo; },
  };
}
