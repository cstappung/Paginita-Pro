// El banco sin tope (§161, pedido del dueño): con el tope de 60, «59 fps» no dice cuánto le sobra a un aparato.
// Con ?sinTope=1 la página suelta la cuadrícula del juego del monitor y, durante la carrera, le pide «ponerse al día»
// sin fin (mkw_prisa de vi.cpp, §99): el juego corre sus cuadros seguidos, como un motor en un dinamómetro sin carga.
// Solo para medir: apagado por omisión, y nunca en la sala ni en línea (ahí todas las consolas tienen que ir al mismo
// ritmo). Aquí está lo que se puede probar sin el juego (banco `sin-tope`); mkw.mjs lo usa.

// ¿Vale el banco sin tope con esta dirección? Solo con sinTope=1 y fuera de la sala, de en línea y de la red
export function sinTopeActivo(parametros) {
  return parametros.get('sinTope') === '1' && !parametros.has('sincro') && !parametros.has('red') &&
    !['sala', 'enlinea'].includes(parametros.get('modo'));
}

// Lo que se le pide al runtime cada vez: en la carrera, 2 s de cuadrícula para ganar (el tope de mkw_prisa); fuera, 0
// (los menús a su ritmo: el piloto de la página los recorre con sus tiempos)
export const PRISA_MS = 2000;
export function crearBomba({ prisa, enCarrera }) {
  let ultima = null;
  return {
    tic() { ultima = enCarrera() ? PRISA_MS : 0; prisa(ultima); return ultima; },
    get ultima() { return ultima; },
  };
}

// El margen contra 60 cuadros por segundo: cuántas veces entra la CPU pura de un cuadro en 16,7 ms
// (> 1 = sobra; < 1 = falta). Es lo que los fps con tope no muestran
export function margen(cpuPuraMs) {
  if (!(cpuPuraMs > 0)) return null;
  const veces = (1000 / 60) / cpuPuraMs;
  return { veces, texto: veces >= 1 ? `×${veces.toFixed(2)} de sobra` : `le falta ×${(1 / veces).toFixed(2)}` };
}

// §162: qué lastre de CPU va dónde. El de la página (lastre.mjs, §155) gira en las esperas y sin tope casi no hay
// esperas; el del runtime (mkw_lastre_cuadro de vi.cpp) gira al empezar cada cuadro del juego, espere o no. Reglas:
//   ?lastreCuadro=K  → el del runtime con K (para comparar, también con tope);
//   ?sinTope=1 y ?lastre=K → el del runtime con K (la escalera sin tope con las mismas banderas de §159);
//   lo demás → el de la página, como siempre (las cifras de §155 no cambian).
// Cuando va el del runtime, el de la página queda en K = 1: solo mide la CPU pura (que ya incluye lo girado).
// Devuelve { cuadro: K del runtime (1 = apagado), pagina: K de la página }.
export function repartoLastre(parametros, sinTope, lastreCpu) {
  const v = Number(parametros.get('lastreCuadro'));
  const pedido = Number.isFinite(v) && v > 1 ? Math.min(20, v) : null;
  const cuadro = pedido ?? (sinTope && lastreCpu > 1 ? lastreCpu : 1);
  return { cuadro, pagina: cuadro > 1 ? 1 : lastreCpu };
}

// §163: el tramo fijo para comparar. Con ?tramo=600-2400 la página mira el contador de cuadros de lógica de la carrera
// (Raceinfo +0x20, desde la cuenta, §124) muy seguido y anota todo al pasar el cuadro «desde» y al pasar «hasta»: la
// pared, las imágenes, las esperas del runtime, las de aurora a sus búferes de subida y lo girado por el lastre. Así
// dos corridas se comparan en los MISMOS cuadros del juego (misma pista, misma semilla), no en «los últimos 10 s».
// leer() → { logica, imagenes, esperaRuntime, esperaSubida, giro } (números que solo crecen; logica = null fuera de la carrera)
export function tramoDeParametros(parametros) {
  const m = /^(\d+)-(\d+)$/.exec(parametros.get('tramo') || '');
  return m && Number(m[2]) > Number(m[1]) ? { desde: Number(m[1]), hasta: Number(m[2]) } : null;
}
export function crearTramo({ desde, hasta, leer, ahora = () => performance.now() }) {
  let inicio = null, resultado = null;
  return {
    tic() {
      if (resultado) return resultado;
      const x = leer(); if (x.logica == null) return null;
      if (!inicio) { if (x.logica >= desde) inicio = { ...x, t: ahora() }; return null; }
      if (x.logica < hasta) return null;
      const d = k => x[k] - inicio[k], ms = ahora() - inicio.t, n = d('logica');
      const porCuadro = k => Math.round(d(k) / n * 1000) / 1000;
      resultado = {
        desde: inicio.logica, hasta: x.logica, ms: Math.round(ms), logicaPorSeg: Math.round(n / ms * 1e5) / 100,
        imagenesPorSeg: Math.round(d('imagenes') / ms * 1e5) / 100,
        // por cuadro de lógica (ms): la pared, las esperas del runtime, las de aurora a la subida, lo girado y el resto
        porCuadro: { pared: Math.round(ms / n * 1000) / 1000, esperaRuntime: porCuadro('esperaRuntime'), esperaSubida: porCuadro('esperaSubida'),
          giro: porCuadro('giro'), trabajo: Math.round((ms - d('esperaRuntime') - d('esperaSubida') - d('giro')) / n * 1000) / 1000 },
      };
      // el techo de la CPU sola: los cuadros por segundo si no hubiera ninguna espera (solo trabajo y lastre)
      resultado.cpuPorSeg = Math.round(1000 / (resultado.porCuadro.trabajo + resultado.porCuadro.giro) * 100) / 100;
      return resultado;
    },
    get resultado() { return resultado; },
    get empezo() { return !!inicio; },
  };
}
