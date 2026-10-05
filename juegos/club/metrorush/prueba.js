/* Metro Rush — la prueba de una carrera: lo que se anota mientras se corre
   y cómo se rehace (docs/antitrampas/metrorush.md).

   QUÉ HACE, EN GLOBAL
   - Mientras se corre, `juego.js` anota en la PRUEBA:
       · la semilla de la pista, el multiplicador base con que se empezó y
         el nivel de mejora del 2× (de eso depende cuánto dura);
       · los cambios que el juego le pide al generador de la pista (un
         túnel, un boleto, la cinta de monedas de la mochila cohete), con el
         punto exacto de la pista en que se pidieron;
       · los EVENTOS que cambian el puntaje: cada estrella y cada 2× que se
         recogen (con el número del objeto en la pista), el fin del 2×, el
         Potenciador +5, cada choque y cada «seguir corriendo»;
       · cada 2 s de carrera, una MUESTRA: el tiempo de juego, los metros y
         el reloj real.
   - `rehace(prueba)` vuelve a generar la pista con la misma semilla y los
     mismos pedidos, comprueba que cada estrella y cada 2× existían ahí, y
     recalcula los puntos exactos: 10 por metro × el multiplicador de cada
     tramo. También comprueba que los metros son los que da la velocidad
     (que solo depende del tiempo de juego) y que el tiempo de juego no corre
     más rápido que el reloj real.

   POR QUÉ ASÍ Y NO REPITIENDO LA CARRERA CUADRO A CUADRO
   La física del corredor va mezclada con el dibujo y con el tiempo de cada
   cuadro (que cambia de un aparato a otro). Pero los puntos no salen de la
   física: salen de los metros (que da la velocidad) y del multiplicador (que
   solo cambia con estrellas, el 2× y el +5). Con eso se recalcula el puntaje
   exacto. Lo que no se puede probar sin la física (que el corredor estaba en
   el carril de la estrella, que esquivó lo que esquivó) queda escrito como
   límite en la doc.

   Ejemplo: base ×3, sin estrellas, 100 m → 3 000 puntos; recoge una
   estrella (×4) y corre 50 m más → 2 000 puntos más: 5 000 en total.

   UMD: `MetroRushPrueba` en la página, `module.exports` en Node y en el
   verificador del club (colabtex/src/juegos/solo/verifica/metrorush.js). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(require("./motor.js"));
  else raiz.MetroRushPrueba = fabrica(raiz.MetroRushMotor);
})(typeof self !== "undefined" ? self : this, function (M) {
  "use strict";

  const VERSION = 1;
  const PASO_MUESTRA = 2;         // segundos de carrera entre dos muestras
  const MAX_EVENTOS = 60000;      // una carrera de una hora deja ~2 000: esto es un tope de seguridad
  const MAX_METROS = 1000000;     // el tope de la tabla de distancia

  /* Tolerancias (en el lado de no castigar a nadie honesto):
     - los metros se suman cuadro a cuadro (V·dt) y aquí se integran exactos:
       la diferencia medida es de centímetros, se aceptan 1 % + 1,5 m;
     - el reloj de juego no puede adelantarse al real (cada cuadro suma como
       mucho lo que pasó de verdad); se aceptan 5 % + 0,4 s de holgura;
     - un objeto se recoge a menos de 1 m (en el juego); se acepta 1,3 m;
     - el 2× dura lo que dice su nivel; se aceptan ±0,15 s (un cuadro). */
  const TOL_METROS = 0.01, TOL_METROS_FIJO = 1.5;
  const TOL_RELOJ = 1.05, TOL_RELOJ_FIJO = 0.4;
  const TOL_RECOGE = 1.3;
  const TOL_DOBLE = 0.15;
  const TOL_DOBLE_CHOQUE = 0.06;  // el cuadro del choque no gasta el 2×: cada choque con el 2× puesto lo alarga hasta un cuadro
  const DERIVA_MUERTE = 12;       // metros que puede seguir resbalando el corredor al caer (de 30 m/s a 0)

  const r4 = x => Math.round(x * 1e4) / 1e4;   // tiempos y relojes: a la décima de milésima basta

  /* ---------------------------------------------------------------
     Lo que anota el juego
     --------------------------------------------------------------- */

  /* Una prueba nueva. `s`: la semilla de la pista; `b`: el multiplicador
     base con que empieza la carrera; `md`: el nivel de mejora del 2×
     (0 a 5); `u`: la cuenta (para que la prueba de otra persona no valga). */
  function nueva({ s, b, md, u }) {
    return { v: VERSION, s: s >>> 0, b: b | 0, md: md | 0, u: String(u || ""), i: [], e: [] };
  }
  /* Un pedido al generador, con el punto de la pista (`dSig`, el metro donde
     va el próximo bloque) en que se hizo. Tipos:
       ["T", dSig, desde, estacion]        un túnel
       ["B", dSig, n, desde]               un boleto dorado
       ["C", dSig, desde, hasta, carril]   la cinta de monedas de la mochila
     Los números van tal cual (sin redondear): el generador tiene que
     repetir exactamente lo mismo, objeto por objeto. */
  function pedido(p, tipo, dSig, ...datos) {
    if (p && p.i.length < MAX_EVENTOS) p.i.push([tipo, dSig, ...datos]);
  }
  /* Un evento. `t`: tiempo de juego (s); `D`: metros; `r`: reloj real (ms
     desde que empezó la carrera); `x`: el número del objeto, si es una
     estrella o un 2×. Códigos:
       e estrella   d 2× recogido   x fin del 2×   p Potenciador +5
       m choque (los puntos paran)   s seguir corriendo   w muestra   f fin
     Los metros de las muestras van al centímetro (solo se usan para mirar la
     velocidad); los demás, tal cual, porque son los bordes de los tramos de
     puntos. */
  function evento(p, cod, t, D, r, x) {
    if (!p || p.e.length >= MAX_EVENTOS) return;
    const ev = [cod, r4(t), cod === "w" ? Math.round(D * 100) / 100 : D, Math.round(r)];
    if (x != null) ev.push(x);
    p.e.push(ev);
  }
  /* Cierra la prueba: `sn` cuántas entradas no las hizo una persona (teclas o
     toques despachados por un script; las del mando no cuentan). */
  function cierra(p, { sn = 0 } = {}) {
    if (!p) return null;
    p.sn = sn | 0;
    return p;
  }

  /* ---------------------------------------------------------------
     Lo que hace el verificador
     --------------------------------------------------------------- */

  /* Los metros que se corren entre los tiempos de juego a y b: la integral
     de M.velocidad (30 − 17·e^(−t/150)). Ejemplo: de 0 a 10 s, 135,6 m. */
  function metrosEntre(a, b) {
    const VMAX = 30, DV = 17, TAU = 150;
    return VMAX * (b - a) + DV * TAU * (Math.exp(-Math.max(0, b) / TAU) - Math.exp(-Math.max(0, a) / TAU));
  }

  /* Rehace la carrera. Devuelve {motivo} si no cuadra, o
     {puntos, metros, tiempo} (como los manda el juego). */
  function rehace(p) {
    const mal = m => ({ motivo: m });
    if (!p || typeof p !== "object") return mal("no hay prueba");
    if (p.v !== VERSION) return mal("la prueba es de otra versión del juego");
    if (!Number.isInteger(p.s) || p.s < 0 || p.s > 0xffffffff) return mal("la semilla no es válida");
    if (!Number.isInteger(p.b) || p.b < 1 || p.b > M.MAX_BASE) return mal("el multiplicador base no es válido");
    if (!Number.isInteger(p.md) || p.md < 0 || p.md > M.MAX_MEJORA) return mal("el nivel del 2× no es válido");
    if (!Array.isArray(p.i) || !Array.isArray(p.e) || p.e.length > MAX_EVENTOS || p.i.length > MAX_EVENTOS) return mal("la prueba no tiene la forma esperada");
    if (p.sn > 0) return mal(p.sn + " entradas que no hizo una persona");
    const fin = p.e[p.e.length - 1];
    if (!fin || fin[0] !== "f") return mal("la prueba no termina en el fin de la carrera");
    const Dfin = fin[2];
    if (!Number.isFinite(Dfin) || Dfin < 0 || Dfin > MAX_METROS) return mal("los metros finales no son válidos");

    // 1) La pista: la misma semilla y los mismos pedidos, en el mismo punto.
    //    Solo hacen falta las estrellas y los 2× (lo que cambia el puntaje).
    const gen = M.crearGenerador(p.s), objetos = new Map();
    const guarda = lista => { for (const o of lista) if (o.tipo === "estrella" || (o.tipo === "poder" && o.clase === "doble")) objetos.set(o.id, o); };
    for (const q of p.i) {
      if (!Array.isArray(q) || !Number.isFinite(q[1]) || q[1] > MAX_METROS + 1000) return mal("un pedido a la pista no es válido");
      guarda(gen.generarHasta(q[1], { V: 20 }));
      if (gen.estado().dSig !== q[1]) return mal("la pista no es la de la semilla");
      if (q[0] === "T" && Number.isFinite(q[2])) gen.pedirTunel(q[2], q[3]);
      else if (q[0] === "B" && Number.isInteger(q[2]) && Number.isFinite(q[3])) gen.pedirBoleto(q[2], q[3]);
      else if (q[0] === "C" && Number.isFinite(q[2]) && Number.isFinite(q[3]) && q[3] - q[2] < 2000 && Number.isInteger(q[4])) guarda(gen.monedasCielo(q[2], q[3], q[4]));
      else return mal("un pedido a la pista no es válido");
    }
    guarda(gen.generarHasta(Dfin + 240, { V: 20 }));

    // 2) Los eventos, en orden: los puntos tramo a tramo y lo que se puede comprobar.
    const durDoble = M.duracionPoder("doble", p.md);
    let puntos = 0, estrellas = 0, doble = false, dobleVivo = 0, holguraDoble = 0, extra = 0, usoPot = false;
    let vivo = true, Dpuntos = 0;                          // dónde empieza el tramo de puntos en curso
    let ant = { t: 0, D: 0, r: 0 }, base = { t: 0, D: 0 }; // el evento anterior y el último punto «vivo» para medir la velocidad
    let Dmuerte = 0;
    const usados = new Set();
    for (let k = 0; k < p.e.length; k++) {
      const ev = p.e[k];
      if (!Array.isArray(ev)) return mal("un evento no es válido");
      const [cod, t, D, r, x] = ev;
      if (!Number.isFinite(t) || !Number.isFinite(D) || !Number.isFinite(r)) return mal("un evento no es válido");
      if (t < ant.t - 1e-6) return mal("el tiempo de juego va hacia atrás");
      if (r < ant.r - 1) return mal("el reloj real va hacia atrás");
      // el reloj de juego no se adelanta al real (acelerar el juego lo delata)
      if (t - ant.t > (r - ant.r) / 1000 * TOL_RELOJ + TOL_RELOJ_FIJO) return mal("el juego corrió más rápido que el reloj");
      if (vivo) {
        const dt = t - ant.t;
        if (doble) { dobleVivo += dt; if (dobleVivo > durDoble + TOL_DOBLE + holguraDoble) return mal("el 2× duró más de lo que dura"); }
        // los metros que da la velocidad desde el último punto vivo
        const esperado = metrosEntre(base.t, t), hecho = D - base.D;
        if (Math.abs(hecho - esperado) > esperado * TOL_METROS + TOL_METROS_FIJO) return mal("los metros no son los que da la velocidad (" + Math.round(hecho) + " m en vez de " + Math.round(esperado) + ")");
        // los puntos del tramo, con el multiplicador que había
        if (cod !== "w") {
          if (D < Dpuntos - 1e-9) return mal("los metros van hacia atrás");
          puntos += M.puntosPorTramo(D - Dpuntos, M.multiplicador({ base: p.b, estrellas, doble, extra }));
          Dpuntos = D;
        }
      }
      switch (cod) {
        case "w": break;
        case "e": case "d": {
          if (!vivo) return mal("algo se recogió estando caído");
          const o = objetos.get(x);
          if (!o || (cod === "e" ? o.tipo !== "estrella" : o.clase !== "doble")) return mal(cod === "e" ? "una estrella que no está en la pista" : "un 2× que no está en la pista");
          if (usados.has(x)) return mal("el mismo objeto se recogió dos veces");
          if (Math.abs(o.d - D) > TOL_RECOGE) return mal("algo se recogió lejos de donde estaba");
          usados.add(x);
          if (cod === "e") estrellas = Math.min(M.MAX_ESTRELLAS, estrellas + 1);
          else { doble = true; dobleVivo = 0; holguraDoble = 0; }
          break;
        }
        case "x":
          if (!doble) return mal("terminó un 2× que no estaba");
          if (dobleVivo < durDoble - TOL_DOBLE || dobleVivo > durDoble + TOL_DOBLE + holguraDoble) return mal("el 2× no duró lo que dura");
          doble = false; break;
        case "p":
          if (usoPot || !vivo || t > 6.5) return mal("el Potenciador +5 no se usó al empezar");
          usoPot = true; extra = M.POTENCIADORES.puntos.extra; break;
        case "m":
          if (!vivo) return mal("dos choques sin seguir corriendo entre medio");
          vivo = false; Dmuerte = D; if (doble) holguraDoble += TOL_DOBLE_CHOQUE; break;
        case "s":
          if (vivo) return mal("seguir corriendo sin haber chocado");
          if (D < Dmuerte - 0.5 || D > Dmuerte + DERIVA_MUERTE) return mal("al seguir corriendo, los metros no cuadran");
          vivo = true; Dpuntos = D; base = { t, D }; break;
        case "f":
          if (k !== p.e.length - 1) return mal("hay eventos después del fin");
          if (vivo) return mal("la carrera terminó sin choque");
          if (D < Dmuerte - 0.5 || D > Dmuerte + DERIVA_MUERTE) return mal("los metros finales no cuadran con el choque");
          break;
        default: return mal("un evento desconocido");
      }
      if (vivo && cod !== "s") base = { t, D };
      ant = { t, D, r };
    }
    return { puntos: Math.floor(puntos), metros: Math.floor(Dfin), tiempo: Math.max(1, Math.round(fin[1] * 1000)), eventos: p.e.length };
  }

  return { VERSION, PASO_MUESTRA, nueva, pedido, evento, cierra, rehace, metrosEntre };
});
