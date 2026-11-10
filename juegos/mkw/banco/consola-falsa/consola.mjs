// V7 (plan v4, etapa E6, bitácora §235): una consola de la sala sin el juego («consola de mentira»).
//
// Resumen: la sala de 12 no se puede armar con 12 juegos en este PC (12 juegos en un procesador van cada uno a una
// fracción). Así que se arma con 3–4 juegos de verdad y el resto con estas consolas: cada una entra a la sala por la
// MISMA malla (malla.mjs, el buzón falso del banco) y corre el MISMO lockstep (lockstep.mjs) que la página, a 60 cuadros
// por segundo, con botones grabados. No corre la carrera: para el resto de la sala es un jugador más que manda sus
// botones a tiempo (o tarde, con la red mala de mentira), recibe los de todos y contesta pings e informes. Como una carga
// de prueba resistiva en un banco de generadores: no hace nada útil, pero consume lo mismo que un aparato de verdad.
//
// Espera a que una consola de verdad empiece la carrera (su primer paquete de botones) y recién ahí arranca su reloj: el
// juego tarda en cargar y el lockstep no tiene que esperar a nadie antes de tiempo.
// Uso:  crearConsolaFalsa({ sala, uid, sincro: [uid…], arbitro, soloCarga }) → { resumen(), parar() }
import { crearMalla, senalCanal } from '/web/navegador/malla.mjs';
import { crearLockstep, MARCA } from '/web/navegador/lockstep.mjs';

const CUADRO_MS = 1000 / 60;

export function crearConsolaFalsa({ sala, uid, sincro, arbitro = true, soloCarga = false }) {
  const humanos = sincro.map((u, mando) => ({ uid: u, mando }));
  const yo = humanos.find(h => h.uid === uid);
  const registro = [];
  let ls = null, empezo = false, parado = false, cuadro = 0, empezoEn = 0;
  const res = { cuadros: 0, atrasos: 0, msAtrasoMax: 0, paquetes: 0, conectados: 0 };
  // los botones grabados: A siempre (acelerar), el volante de un lado a otro con el ritmo de esta consola, y el derrape
  // (R) de vez en cuando. 7 números: botones, stick x/y, stick C x/y, gatillos L/R
  const fase = (yo?.mando ?? 0) * 0.7, periodo = 90 + 23 * (yo?.mando ?? 0);
  const local = () => {
    const x = Math.round(90 * Math.sin(fase + (2 * Math.PI * cuadro) / periodo));
    const r = (cuadro % 240) > 200 ? 0x0020 : 0;
    return [0x0100 | r, x, 0, 0, 0, 0, r ? 255 : 0];
  };
  const malla = crearMalla({ uid, senal: senalCanal({ sala, uid }), colaUdp: 8192,
    alBinario: (de, b) => {
      if (b[0] !== MARCA) return;
      // R8/R4 también empaqueta botones como tipo 15 (13 es el formato anterior).
      // Esperar solamente 13 dejaba las nueve consolas quietas y a los juegos esperando en el cuadro cero.
      if (!empezo && (b[1] === 13 || b[1] === 15)) arrancar();
      ls?.alBinario(de, b);
    },
    alCambiar: () => { res.conectados = malla.conectados?.().length ?? 0; } });
  ls = crearLockstep({ yo: uid, humanos, local, arbitro, huella: null,
    // En V7 una consola sin juego sería una candidata artificialmente rápida. Le anunciamos el perfil de un
    // teléfono justo de CPU y de subida para que la elección normal prefiera un juego de verdad si lo hay.
    capacidad: soloCarga ? () => ({ margen: 0, subida: 1, telefono: true }) : null,
    enviar: (u, b, canal) => { res.paquetes++; malla.enviar(u, b, canal); },
    registro: t => { registro.push(t); if (registro.length > 500) registro.shift(); } });
  malla.entrar();
  addEventListener('pagehide', () => malla.salir());

  // el reloj: el cuadro k a los k × 16,7 ms de la largada; si va atrás (el lockstep esperó), sigue sin dormir
  async function arrancar() {
    if (empezo) return;
    empezo = true; empezoEn = performance.now();
    while (!parado) {
      await ls.pad(cuadro);
      cuadro++; res.cuadros = cuadro;
      const falta = empezoEn + cuadro * CUADRO_MS - performance.now();
      if (falta > 1) await new Promise(r => setTimeout(r, falta));
      else if (falta < -50) { res.atrasos++; res.msAtrasoMax = Math.max(res.msAtrasoMax, -falta); empezoEn -= falta + 50; }   // (no correr para alcanzar: como un juego, sigue desde ahí)
    }
  }
  return {
    resumen: () => {
      const e = ls.estado();
      return { uid, empezo, cuadro, ...res, segundos: empezo ? Math.round((performance.now() - empezoEn) / 1000) : 0,
               esperas: e.esperas, msEsperando: Math.round(e.msEsperando), maxEspera: Math.round(e.maxEspera), esperasLargas: e.esperasLargas,
               retraso: e.retraso, autoridad: e.autoridad, relevos: e.relevos, cortes: e.cortes, fuera: e.fuera };
    },
    registro: () => registro.slice(),
    arrancar: () => { arrancar(); },
    parar: () => { parado = true; malla.salir(); },
  };
}
