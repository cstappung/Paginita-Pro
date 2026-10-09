/* FANAL — el motor, puro: jornadas, dificultad, puntos, ritmo y progreso.

   Qué hace, en general:
   - Describe la travesía como una lista de JORNADAS: veinte en la
     historia, cada una una oleada de polillas seguida de su jefe (ocho
     hasta el Alba, seis en la otra orilla y seis en lo alto, que termina
     en el Sol), y una función que fabrica las del sin fin a partir de la
     21: los mismos jefes en su fase 2 (la primera vuelta) y 3 (todas las
     que siguen), con una oleada entre cada dos. La travesía es una sola y
     no se acaba: después del Sol sigue sola hacia el sin fin.
   - Los AUGURIOS: cada jornada que pasas, la noche aprende algo (un poco
     más de fuego, escamas más rápidas, polillas que aguantan un golpe
     más…). Son fijos por número de jornada, iguales para todos.
   - Las MEJORAS: cada jefe vencido da una brasa, y cada brasa sube un
     nivel de una mejora del arma o del fanal. Cada tres niveles en una rama
     el arma o el fanal EVOLUCIONA. `armas()` y `nave()` traducen los
     niveles a números de juego, y los usan la pantalla y el verificador.
   - Dice cuánto vale cada polilla, cómo sube la Resonancia (el
     multiplicador que premia disparar al pulso de la música), qué bonus
     deja cada jornada y en qué puntajes se gana una llama extra.
   - Juzga si un disparo cayó «afinado»: dentro de la ventana de un pulso.
   - Mezcla el progreso guardado en el navegador con el de la cuenta
     (fragmentos leídos, final visto, punto de control, récords).

   Por qué así: todo lo que decide el juego y no depende de pintar ni de
   sonar vive aquí, sin DOM ni almacenamiento, para comprobarlo desde Node
   (colabtex/tests/fanal.test.cjs). Las cifras de dificultad están juntas
   en una tabla para que la curva se lea y se ajuste de un vistazo. UMD:
   `FanalMotor` en la página, `module.exports` en Node. */
(function (raiz, fabrica) {
  // En Node (tests) se exporta como módulo CommonJS.
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  // En el navegador queda colgado de window.FanalMotor.
  else raiz.FanalMotor = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* El lienzo lógico: todo el juego se dibuja en 240×320 píxeles y se
     escala después. Las posiciones de abajo están en esos píxeles. */
  const ANCHO = 240, ALTO = 320;
  const Y_FANAL = 300;        // altura del fanal (centro del casco)
  const Y_NAUFRAGIOS = 258;   // altura de los cascos hundidos que sirven de escudo
  const Y_LIMITE = 284;       // si una polilla baja hasta aquí, alcanza la llama
  const Y_FORMACION = 46;     // altura de la primera fila al empezar una oleada

  /* Lo que cambia de un acto a otro en el juego (no en el dibujo ni en la
     música): cuánta oscuridad hay alrededor de la luz y cuánto alcanza la
     llama. `oscuro` va de 0 (todo visible) a 1 (solo se ve lo que toca la
     luz); `radio` es el alcance de la llama en píxeles lógicos. */
  const ACTOS = {
    1: { oscuro: 0.18, radio: 92 },
    2: { oscuro: 0.48, radio: 74 },
    3: { oscuro: 0.88, radio: 64 },
    4: { oscuro: 0.32, radio: 80 },
    5: { oscuro: 0.62, radio: 74 },
    6: { oscuro: 0.55, radio: 78 },   // los cascos: agua negra, la luz rebota en el metal
    7: { oscuro: 0.36, radio: 84 },   // la seda: blanca, devuelve la luz
    8: { oscuro: 0.22, radio: 96 },   // la hoguera: por primera vez, sobra luz
    9: { oscuro: 0.5, radio: 82 },    // la marea: de noche otra vez, con luna
    10: { oscuro: 0.72, radio: 76 },  // el firmamento: negro y estrellas
    11: { oscuro: 0.08, radio: 104 }  // el cenit: mediodía, casi no hay sombra
  };
  /* El número romano con que se presenta cada acto: el sin fin (5) no
     tiene número; los de la otra orilla (6, 7 y 8) son el V, el VI y el VII. */
  const ROMANO_ACTO = { 1: "I", 2: "II", 3: "III", 4: "IV", 6: "V", 7: "VI", 8: "VII", 9: "VIII", 10: "IX", 11: "X" };

  /* Puntos por tipo de polilla y acto. Las filas de arriba (tipo c) valen
     más, como en el original, porque son las últimas en bajar. En el acto 4
     valen casi nada: apagarlas no es lo que importa ahí. */
  const PUNTOS = {
    1: { a: 10, b: 20, c: 30 },
    2: { a: 15, b: 25, c: 40 },
    3: { a: 20, b: 35, c: 50 },
    4: { a: 5, b: 5, c: 5 },
    5: { a: 40, b: 60, c: 90 },
    6: { a: 30, b: 45, c: 70 },
    7: { a: 35, b: 55, c: 80 },
    8: { a: 40, b: 60, c: 90 },
    9: { a: 45, b: 65, c: 95 },
    10: { a: 50, b: 70, c: 100 },
    11: { a: 55, b: 80, c: 110 }
  };
  /* Lo que paga la Mensajera: uno de estos, al azar, como el platillo del
     original, que nunca valía lo mismo dos veces seguidas. */
  const PUNTOS_MENSAJERA = [100, 150, 200, 300, 500];
  /* Lo que paga cada encuentro grande al terminar. */
  const PUNTOS_JEFE = { nodriza: 2000, faro: 3500, esfinge: 5000, alba: 8000, casco: 6000, crisalida: 8000, hoguera: 12000, luna: 14000, constelacion: 16000, sol: 20000 };
  /* Llamas extra: en estos puntajes y luego cada 100 000. */
  const LLAMAS_EXTRA = [30000, 80000, 150000];
  const LLAMAS_INICIO = 3, LLAMAS_MAX = 5;   // el máximo sin mejoras (ver llamasMax)

  /* La vida de los jefes, en golpes normales (un tiro afinado quita dos). */
  const VIDA_JEFE = { nodriza: 76, faro: 84, esfinge: 104, casco: 110, crisalida: 120, hoguera: 150, luna: 160, constelacion: 175, sol: 200 };
  /* El encuentro con el Alba no se gana con vida sino con distancia: parte
     en DISTANCIA_ALBA brazas, se acerca CIERRE_ALBA por segundo y cada tiro
     que la toca la aleja EMPUJE_ALBA (y vuelve hacia ti). */
  const DISTANCIA_ALBA = 600, CIERRE_ALBA = 10, EMPUJE_ALBA = 25;

  /* La ventana del pulso, en segundos a cada lado: un disparo dentro de
     ella cuenta como afinado. 95 ms es lo que perdona un juego de ritmo
     «normal»; menos castiga a quien juega con un teclado lento. */
  const VENTANA_PULSO = 0.095;

  /* Las veinte jornadas de la historia: una oleada y su jefe, acto por
     acto (el acto IV, el del Alba, tiene las lumbres en vez de oleada).
     Cada oleada dice:
     - filas: el tipo de polilla de cada fila, de arriba abajo (a, b o c);
     - cols: cuántas columnas tiene la formación;
     - paso: cuántos píxeles avanza de lado en cada pulso de la música;
     - fuego: disparos por segundo de toda la formación;
     - balas: cuántas escamas puede haber a la vez en pantalla;
     - apunta: qué parte de esas escamas va dirigida al fanal;
     - picada: cuántas polillas por segundo dejan la fila y bajan a la luz;
     - deriva: cuánto se mecen (en píxeles) entre un paso y otro;
     - vida: golpes que aguanta cada tipo (por omisión, uno);
     - mensajeras: cuántas veces cruza la Mensajera;
     - niebla, ceniza, cascos, hilos, ascuas, marea, fugaces: lo particular
       de cada acto.
     `nivel` es lo que pesa la jornada para los augurios y la vida del jefe:
     el número que tenía en la travesía de veinticinco, cuando había tres
     oleadas por acto. Con una sola, contar por `n` dejaba a cada jefe con
     la mitad de la noche encima que antes; contar por `nivel` deja la curva
     donde estaba aunque la travesía sea más corta.
     Cada oleada es la última (la más dura) de su acto en aquella travesía,
     un poco más dura todavía; la del acto I es la de siempre, para
     aprender. */
  const JORNADAS = [
    { n: 1, nivel: 1, acto: 1, tipo: "oleada", filas: ["c", "b", "b", "a", "a"], cols: 9, paso: 2, fuego: 0.45, balas: 2, apunta: 0, picada: 0, deriva: 1, mensajeras: 4 },   // las cuatro cartas del enjambre
    { n: 2, nivel: 4, acto: 1, tipo: "jefe", jefe: "nodriza" },
    { n: 3, nivel: 8, acto: 2, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 10, paso: 2.6, fuego: 1.15, balas: 4, apunta: 0.32, picada: 0.14, deriva: 5, niebla: 0.75, vida: { c: 2 }, mensajeras: 4 },
    { n: 4, nivel: 8, acto: 2, tipo: "jefe", jefe: "faro" },
    { n: 5, nivel: 11, acto: 3, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 10, paso: 2.8, fuego: 1.3, balas: 5, apunta: 0.37, picada: 0.15, deriva: 3, ceniza: true, vida: { c: 2, b: 2 }, mensajeras: 3 },
    { n: 6, nivel: 11, acto: 3, tipo: "jefe", jefe: "esfinge" },
    { n: 7, nivel: 12, acto: 4, tipo: "lumbre", filas: ["a", "a", "a"], cols: 8, paso: 0, fuego: 0, balas: 0, apunta: 0, picada: 0, deriva: 6, mensajeras: 2 }, // las dos cartas del alba
    { n: 8, nivel: 13, acto: 4, tipo: "jefe", jefe: "alba" },
    /* La otra orilla. V · los cascos: los fanales hundidos derivan (son
       escudos que se mueven) y las polillas anidan en ellos. */
    { n: 9, nivel: 17, acto: 6, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 10, paso: 2.8, fuego: 1.4, balas: 5, apunta: 0.37, picada: 0.13, deriva: 2.5, cascos: 6, vida: { c: 2, b: 2 }, mensajeras: 2 },
    { n: 10, nivel: 17, acto: 6, tipo: "jefe", jefe: "casco" },
    /* VI · la seda: las polillas cuelgan hilos que enredan los remos. */
    { n: 11, nivel: 21, acto: 7, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 10, paso: 2.9, fuego: 1.45, balas: 6, apunta: 0.38, picada: 0.15, deriva: 5, hilos: 0.45, vida: { c: 3, b: 2 }, mensajeras: 2 },
    { n: 12, nivel: 21, acto: 7, tipo: "jefe", jefe: "crisalida" },
    /* VII · la hoguera: cada polilla apagada puede soltar un ascua que cae. */
    { n: 13, nivel: 25, acto: 8, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 11, paso: 3.1, fuego: 1.6, balas: 6, apunta: 0.41, picada: 0.17, deriva: 3, ascuas: 0.45, vida: { c: 3, b: 2, a: 2 }, mensajeras: 2 },
    { n: 14, nivel: 25, acto: 8, tipo: "jefe", jefe: "hoguera" },
    /* Lo alto. VIII · la marea: la formación sube y baja con la luna
       (`marea`, en píxeles de amplitud). */
    { n: 15, nivel: 28, acto: 9, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 10, paso: 3, fuego: 1.6, balas: 6, apunta: 0.4, picada: 0.16, deriva: 4, marea: 12, vida: { c: 3, b: 2, a: 2 }, mensajeras: 2 },
    { n: 16, nivel: 28, acto: 9, tipo: "jefe", jefe: "luna" },
    /* IX · el firmamento: caen estrellas fugaces en diagonal (`fugaces`,
       por segundo). */
    { n: 17, nivel: 31, acto: 10, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 11, paso: 3.1, fuego: 1.65, balas: 6, apunta: 0.42, picada: 0.17, deriva: 3, fugaces: 0.35, vida: { c: 3, b: 2, a: 2 }, mensajeras: 2 },
    { n: 18, nivel: 31, acto: 10, tipo: "jefe", jefe: "constelacion" },
    /* X · el cenit: un poco de todo lo de antes, a pleno sol. */
    { n: 19, nivel: 34, acto: 11, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 11, paso: 3.2, fuego: 1.7, balas: 7, apunta: 0.44, picada: 0.18, deriva: 3, ascuas: 0.3, marea: 6, fugaces: 0.2, vida: { c: 3, b: 3, a: 2 }, mensajeras: 2 },
    { n: 20, nivel: 34, acto: 11, tipo: "jefe", jefe: "sol" }
  ];
  const JORNADA_ALBA = 8;                     // el cruce con el Alba: el final de la primera parte
  const JORNADA_HOGUERA = 14;                 // la Hoguera: el final de la segunda
  const JORNADAS_HISTORIA = JORNADAS.length;   // 20: el Sol cierra la historia; después, el sin fin

  /* El primer número de jornada de cada acto (el 5 es el sin fin): ahí
     cambian la piel, el cielo y la música. */
  const INICIO_ACTO = { 1: 1, 2: 3, 3: 5, 4: 7, 6: 9, 7: 11, 8: 13, 9: 15, 10: 17, 11: 19, 5: 21 };

  /* Los augurios: lo que la noche aprende en cada jornada que pasas. La
     jornada n trae los n − 1 primeros de esta rueda (dando vueltas, cada
     vuelta otra capa), así que cada jornada es un poco más dura que la
     anterior y siempre se sabe en qué. No dependen de la partida: el
     mismo número de jornada es igual de duro para todos. */
  const AUGURIOS = ["rafaga", "veloz", "marcha", "punteria", "picada", "furia", "enjambre", "coraza"];
  /* Cuántas capas del augurio `cual` (nombre o índice) pesan en la jornada `n`. */
  function nivelAugurio(n, cual) {
    const i = typeof cual === "number" ? cual : AUGURIOS.indexOf(cual);
    if (i < 0 || n < 2 + i) return 0;
    return Math.floor((n - 2 - i) / AUGURIOS.length) + 1;
  }
  /* El augurio que llega al empezar la jornada `n` (el que se anuncia en el
     tránsito), o null en la primera. */
  const augurioDe = n => (n >= 2 ? AUGURIOS[(n - 2) % AUGURIOS.length] : null);
  /* Aplica los augurios a una jornada ya armada. Los topes son donde la
     pantalla deja de ser justa. */
  function aplicaAugurios(j) {
    const nv = j.nivel || j.n;
    const s = k => nivelAugurio(nv, k);
    j.presion = Math.max(0, nv - 1);
    j.velEscama = +Math.min(1.8, Math.pow(1.05, s("veloz"))).toFixed(4);   // lo usa la pantalla
    j.furia = +Math.min(2, Math.pow(1.07, s("furia"))).toFixed(4);          // los jefes atacan más seguido
    if (j.tipo !== "oleada") return j;
    j.fuego = +Math.min(4, j.fuego * Math.pow(1.07, s("rafaga"))).toFixed(3);
    j.paso = +Math.min(6, j.paso * Math.pow(1.05, s("marcha"))).toFixed(3);
    j.apunta = +Math.min(0.75, (j.apunta || 0) + 0.04 * s("punteria")).toFixed(3);
    j.picada = +Math.min(0.6, (j.picada || 0) + 0.02 * s("picada")).toFixed(3);
    j.balas = Math.min(12, (j.balas || 0) + s("enjambre"));
    // La coraza: la primera capa endurece a las grandes (c), la segunda a
    // las medianas (b), la tercera a las chicas (a), y vuelve a empezar.
    const cor = s("coraza");
    if (cor > 0) {
      const vida = Object.assign({}, j.vida || {});
      ["c", "b", "a"].forEach((t, k) => {
        const extra = cor > k ? Math.floor((cor - 1 - k) / 3) + 1 : 0;
        if (extra && j.filas.includes(t)) vida[t] = Math.min(4, (vida[t] || 1) + extra);
      });
      j.vida = vida;
    }
    return j;
  }

  /* Qué tan dura es una jornada del sin fin: sube un 6 % por jornada
     después del Sol y se detiene en ×2,4, que con los augurios encima ya
     es una pantalla llena de escamas. */
  function dificultad(n) {
    if (n <= JORNADAS_HISTORIA) return 1;                                       // la historia ya trae su curva
    return Math.min(2.4, 1 + 0.06 * (n - JORNADAS_HISTORIA));
  }

  /* El sin fin recorre los nueve actos de pelea en bloques de dos: una
     oleada y el jefe del acto, que vuelve en otra fase. La primera vuelta
     entera es la fase 2; de ahí en adelante, la 3 (y cada vuelta más
     fuerte por la dificultad). */
  const CICLO_SINFIN = [1, 2, 3, 6, 7, 8, 9, 10, 11];
  const JEFE_DE_ACTO = { 1: "nodriza", 2: "faro", 3: "esfinge", 6: "casco", 7: "crisalida", 8: "hoguera", 9: "luna", 10: "constelacion", 11: "sol" };
  /* La oleada que el sin fin copia y endurece en cada acto. La del acto I
     no es la de la historia (esa es para aprender) sino una más dura. */
  const OLEADA_DE_ACTO = { 2: 3, 3: 5, 6: 9, 7: 11, 8: 13, 9: 15, 10: 17, 11: 19 };
  const OLEADA_I_SINFIN = { acto: 1, tipo: "oleada", filas: ["c", "c", "b", "b", "a", "a"], cols: 10, paso: 2.4, fuego: 0.95, balas: 3, apunta: 0.22, picada: 0.07, deriva: 1.5, mensajeras: 1 };
  const oleadaBase = acto => (acto === 1 ? OLEADA_I_SINFIN : JORNADAS[OLEADA_DE_ACTO[acto] - 1]);
  /* La fase de los jefes de una vuelta del sin fin (en la historia, 1). */
  const faseDeVuelta = vuelta => (vuelta >= 1 ? 3 : 2);

  /* Una jornada cualquiera, con sus augurios: las de la historia de la
     tabla y las del sin fin fabricadas. */
  function jornada(n) {
    if (n >= 1 && n <= JORNADAS_HISTORIA) return aplicaAugurios(Object.assign({ fase: 1 }, JORNADAS[n - 1])); // copia, para no tocar la tabla
    const k = Math.max(0, n - JORNADAS_HISTORIA - 1);   // 0 en la jornada 21
    const bloque = Math.floor(k / 2);             // cada bloque es un acto con su jefe
    const pos = k % 2;                            // 0 oleada · 1 jefe
    const actoBase = CICLO_SINFIN[bloque % CICLO_SINFIN.length];
    const vuelta = Math.floor(bloque / CICLO_SINFIN.length); // cuántas veces se recorrieron los nueve
    const fase = faseDeVuelta(vuelta);
    const m = dificultad(n);                      // multiplicador de esta jornada
    const nivel = 34 + (n - JORNADAS_HISTORIA);  // los augurios siguen sumando uno por jornada
    if (pos === 1) return aplicaAugurios({ n, nivel, acto: 5, actoBase, tipo: "jefe", jefe: JEFE_DE_ACTO[actoBase], fuerza: m, vuelta, fase });
    // La oleada copia la del acto base y la endurece; desde la segunda
    // vuelta suma una fila de las chicas si cabe, y una columna.
    const base = oleadaBase(actoBase);
    const filas = vuelta >= 1 && base.filas.length < 6 ? base.filas.concat(["a"]) : base.filas.slice();
    return endurece(aplicaAugurios({
      n, nivel, acto: 5, actoBase, tipo: "oleada", vuelta, fase,
      filas,
      cols: Math.min(11, base.cols + (vuelta >= 1 ? 1 : 0)),
      paso: +(base.paso * (1 + (m - 1) * 0.35)).toFixed(2),            // marcha algo más rápida
      fuego: +(base.fuego * m).toFixed(2),                             // más escamas por segundo…
      balas: Math.min(8, base.balas + Math.floor((m - 1) * 3)),        // …y más a la vez
      apunta: Math.min(0.6, base.apunta + (m - 1) * 0.15),
      picada: +(base.picada * m).toFixed(3),
      deriva: base.deriva,
      niebla: actoBase === 2 ? base.niebla : 0,
      ceniza: actoBase === 3,
      cascos: base.cascos || 0, hilos: base.hilos || 0, ascuas: base.ascuas || 0, marea: base.marea || 0, fugaces: base.fugaces || 0,
      vida: Object.assign({}, base.vida || {}, m > 1.6 ? { a: Math.max(2, (base.vida && base.vida.a) || 1) } : {}), // muy adentro, hasta las chicas aguantan dos
      mensajeras: 1
    }), Math.floor(k / 6));
  }
  /* En el sin fin la formación se endurece además un golpe cada seis
     jornadas (hasta ocho): con el arma llena, sin esto las oleadas caían
     en siete segundos y la noche dejaba de crecer. */
  function endurece(j, extra) {
    if (!extra || !j.vida) return j;
    for (const t of ["a", "b", "c"]) if (j.filas.includes(t)) j.vida[t] = Math.min(8, (j.vida[t] || 1) + extra);
    return j;
  }

  /* Los parámetros de juego del acto de una jornada (el sin fin usa los del
     acto que recorre, un poco más oscuros: ya no hay estrellas que vuelvan). */
  function actoDe(j) {
    if (j.acto !== 5) return ACTOS[j.acto];
    const b = ACTOS[j.actoBase];
    return { oscuro: Math.min(0.92, b.oscuro + 0.1), radio: b.radio - 4 };
  }

  /* La vida de un jefe en una jornada: crece con el nivel de la jornada
     (el arma también crece, con las mejoras) hasta el cuádruple, en el sin
     fin con la fuerza, y en las fases 2 y 3 un poco más. */
  const VIDA_FASE = { 1: 1, 2: 1.15, 3: 1.3 };
  function vidaJefe(j) {
    const base = VIDA_JEFE[j.jefe] || 0;
    const porJornada = Math.min(4, 1 + 0.05 * Math.max(0, (j.nivel || j.n || 4) - 4));
    return Math.round(base * porJornada * (j.fuerza ? 0.7 + 0.3 * j.fuerza : 1) * (VIDA_FASE[j.fase] || 1));
  }

  /* ---------------------------------------------------------------
     Brasas, mejoras y evoluciones
     --------------------------------------------------------------- */
  /* Ocho mejoras en dos ramas, tres niveles cada una; cada nivel cuesta
     una brasa. `codigo` es la letra con que la compra queda en la prueba. */
  const MEJORAS = {
    cadencia: { rama: "arma", codigo: "c", max: 3 },   // la mecha corta: dispara más seguido
    fuerza: { rama: "arma", codigo: "f", max: 3 },     // la llama viva: más daño
    perfora: { rama: "arma", codigo: "p", max: 3 },    // la punta de vidrio: atraviesa más
    abanico: { rama: "arma", codigo: "b", max: 3 },    // el pabilo trenzado: más tiros por disparo
    remo: { rama: "nave", codigo: "r", max: 3 },       // remos largos: más rápido
    vidrio: { rama: "nave", codigo: "v", max: 3 },     // vidrio templado: la campana vuelve sola
    aceite: { rama: "nave", codigo: "o", max: 3 },     // reserva de aceite: una llama más de tope
    iman: { rama: "nave", codigo: "i", max: 3 }        // luz larga: más luz, poderes que se acercan
  };
  const LISTA_MEJORAS = Object.keys(MEJORAS);
  const POR_CODIGO = {};
  for (const k of LISTA_MEJORAS) POR_CODIGO[MEJORAS[k].codigo] = k;
  /* La otra cosa que compran las brasas: una llama de vuelta (si cabe).
     Cuesta dos: con una sola, el taller curaba una llama por jornada para
     siempre y el sin fin no se acababa. */
  const CODIGO_LLAMA = "l", COSTO_LLAMA = 2;
  /* Las evoluciones: a los 3, 6, 9 y 12 niveles de una rama. */
  const EVOLUCION = [3, 6, 9, 12];

  function mejorasVacias() { const m = {}; for (const k of LISTA_MEJORAS) m[k] = 0; return m; }
  /* Unos niveles cualesquiera, limpios: solo las ocho mejoras, enteros entre 0 y su tope. */
  function limpiaMejoras(m) {
    const r = mejorasVacias();
    if (m && typeof m === "object") for (const k of LISTA_MEJORAS) { const v = Math.floor(+m[k] || 0); r[k] = Math.max(0, Math.min(MEJORAS[k].max, v)); }
    return r;
  }
  const puntosRama = (m, rama) => LISTA_MEJORAS.reduce((s, k) => s + (MEJORAS[k].rama === rama ? (m && m[k]) || 0 : 0), 0);
  /* La evolución de una rama: 0 al empezar, 4 con la rama llena. */
  const evolucion = (m, rama) => EVOLUCION.filter(u => puntosRama(m, rama) >= u).length;

  /* Lo que puede tener el fanal como tope de llamas. */
  function llamasMax(m) {
    return LLAMAS_MAX + ((m && m.aceite) || 0) + (evolucion(m, "nave") >= 1 ? 1 : 0);
  }
  /* El tope con todo comprado (para leer números guardados sin las mejoras a mano). */
  const LLAMAS_TOPE = LLAMAS_MAX + MEJORAS.aceite.max + 1;

  /* El arma con estas mejoras, en números de juego. La pantalla dispara
     con esto y el verificador acota con esto: no pueden divergir.
     - cool: segundos entre dos tiros; auto: espera del disparo sostenido;
     - tope: tiros en el aire a la vez;
     - patron: las balas de cada tiro ({dx, vx}: desde dónde salen y hacia
       dónde se abren);
     - danoN / danoA: daño de un tiro sin afinar / afinado;
     - perfN / perfA: cuántas cosas atraviesa (además de la que toca);
     - chispas: los tiros afinados sueltan dos chispas a los costados;
     - rayo: los tiros afinados lo atraviesan todo. */
  const PATRONES = [
    [{ dx: 0, vx: 0 }],
    [{ dx: -3, vx: 0 }, { dx: 3, vx: 0 }],
    [{ dx: 0, vx: 0 }, { dx: -2, vx: -42 }, { dx: 2, vx: 42 }],
    [{ dx: -3, vx: 0 }, { dx: 3, vx: 0 }, { dx: -2, vx: -58 }, { dx: 2, vx: 58 }]
  ];
  function armas(m) {
    m = m || {};
    const t = evolucion(m, "arma"), c = m.cadencia || 0, f = m.fuerza || 0, p = m.perfora || 0, b = m.abanico || 0;
    return {
      evolucion: t,
      cool: [0.16, 0.14, 0.125, 0.11][c],
      auto: [0.3, 0.25, 0.21, 0.18][c],
      tope: [2, 3, 3, 3][c],
      patron: PATRONES[b],
      danoN: 1 + (f >= 2 ? 1 : 0) + (t >= 4 ? 1 : 0),
      danoA: 2 + (f >= 1 ? 1 : 0) + (f >= 3 ? 1 : 0) + (t >= 4 ? 1 : 0),
      perfN: [0, 1, 1, 2][p],
      perfA: 1 + [0, 1, 1, 2][p] + (t >= 1 ? 1 : 0),
      chispas: t >= 2,
      rayo: t >= 3
    };
  }
  /* El fanal con estas mejoras: velocidad, campana, luciérnagas, luz e imán. */
  function nave(m) {
    m = m || {};
    const t = evolucion(m, "nave"), v = m.vidrio || 0, i = m.iman || 0;
    return {
      evolucion: t,
      vel: [104, 120, 136, 152][m.remo || 0],
      campana: v >= 1 || t >= 3,                    // empieza cada jornada con la campana puesta
      regenera: v >= 3 ? 25 : v >= 2 ? 40 : t >= 3 ? 45 : 0, // segundos para que la campana vuelva sola (0: no vuelve)
      luciernagas: t >= 4 ? 2 : t >= 2 ? 1 : 0,     // las que te siguen, y se llevan escamas
      luz: 1 + 0.1 * i,
      iman: [0, 30, 50, 75][i],
      durPoder: 1 + 0.25 * i,
      probPoder: 1 + 0.35 * i,
      pulso: t >= 4 ? 45 : 0                        // cada tantos segundos, un pulso que barre las escamas cercanas
    };
  }
  /* Una compra en el taller. `est` = {mej, brasas, llamas}; la cambia y
     devuelve null, o devuelve por qué no se pudo. La usan la pantalla y el
     verificador. */
  function compra(est, codigo) {
    if (!(est.brasas >= 1)) return "sin brasas";
    if (codigo === CODIGO_LLAMA) {
      if (est.llamas >= llamasMax(est.mej)) return "las llamas ya están llenas";
      if (est.brasas < COSTO_LLAMA) return "faltan brasas";
      est.brasas -= COSTO_LLAMA; est.llamas++;
      return null;
    }
    const k = POR_CODIGO[codigo];
    if (!k) return "mejora desconocida";
    if ((est.mej[k] || 0) >= MEJORAS[k].max) return "mejora al máximo";
    est.brasas--; est.mej[k] = (est.mej[k] || 0) + 1;
    return null;
  }

  /* El tipo de cada polilla y su sitio en la formación, relativo a la
     esquina de arriba a la izquierda. Las columnas se aprietan un poco
     cuando son muchas, para que la formación deje espacio para marchar. */
  function formacion(j) {
    const sepX = j.cols >= 11 ? 15 : j.cols >= 10 ? 16 : 17;   // separación horizontal
    const sepY = 15;                                            // separación vertical
    const lista = [];
    j.filas.forEach((tipo, f) => {
      for (let c = 0; c < j.cols; c++) {
        lista.push({ fila: f, col: c, tipo, dx: c * sepX, dy: f * sepY, vida: (j.vida && j.vida[tipo]) || 1 });
      }
    });
    const ancho = (j.cols - 1) * sepX + 11;   // 11 = ancho del sprite de una polilla
    return { lista, ancho, alto: (j.filas.length - 1) * sepY + 9, sepX, sepY };
  }

  /* Cuántas polillas trae una jornada (las oleadas; los jefes traen las
     suyas por su cuenta). Sirve para el contador de luces del cielo. */
  function polillasDe(j) {
    return j.tipo === "jefe" ? 0 : j.filas.length * j.cols;
  }

  /* La Resonancia: cada cuatro notas afinadas seguidas, una más, hasta ×8.
     Una «nota» es un tiro afinado que toca algo. */
  function resonancia(notas) {
    return Math.min(8, 1 + Math.floor(Math.max(0, notas) / 4));
  }

  /* Lo que vale apagar una polilla: su valor por la Resonancia, y la mitad
     más si el tiro fue afinado. El sin fin sube un 10 % por vuelta. */
  function puntosPolilla(acto, tipo, mult, afinado, vuelta) {
    const base = (PUNTOS[acto] || PUNTOS[1])[tipo] || 10;
    const extra = 1 + 0.1 * (vuelta || 0);
    return Math.round(base * extra * (mult || 1) * (afinado ? 1.5 : 1));
  }

  /* El bonus de una jornada: por no recibir daño y por puntería. */
  const BONUS_ACTO = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 7, 6: 5, 7: 5, 8: 6, 9: 6, 10: 7, 11: 7 };
  function bonusJornada({ acto, sinDanio, disparos, aciertos }) {
    const a = BONUS_ACTO[acto] || 4;                            // la otra orilla y el sin fin pagan más
    const precision = disparos > 0 ? Math.min(1, aciertos / disparos) : 0;
    return { sinDanio: sinDanio ? 500 * a : 0, precision: Math.round(precision * 500 * a), total: (sinDanio ? 500 * a : 0) + Math.round(precision * 500 * a) };
  }

  /* Cuántas llamas extra se ganaron al pasar de `antes` a `ahora` puntos. */
  function llamasGanadas(antes, ahora) {
    const umbral = i => (i < LLAMAS_EXTRA.length ? LLAMAS_EXTRA[i] : LLAMAS_EXTRA[LLAMAS_EXTRA.length - 1] + 100000 * (i - LLAMAS_EXTRA.length + 1));
    let n = 0;
    for (let i = 0; i < 60; i++) { const u = umbral(i); if (u > ahora) break; if (u > antes) n++; } // cada umbral cruzado
    return n;
  }

  /* ¿El disparo hecho en el instante `t` cae en un pulso? `previo` y
     `siguiente` son los instantes de los pulsos que lo rodean (en el mismo
     reloj). Devuelve si fue afinado y por cuánto se erró (con signo:
     negativo = antes del pulso). */
  function juzgaPulso(t, previo, siguiente, ventana) {
    const v = ventana == null ? VENTANA_PULSO : ventana;
    const dPrev = previo == null ? Infinity : t - previo;          // tiempo desde el pulso anterior
    const dSig = siguiente == null ? Infinity : siguiente - t;     // tiempo hasta el siguiente
    const error = dPrev <= dSig ? dPrev : -dSig;                   // el más cercano manda
    return { afinado: Math.abs(error) <= v, error };
  }

  /* La velocidad de la marcha según cuántas polillas quedan: el latido del
     original, que se acelera cuando queda poca formación. `fraccion` es lo
     que queda (1 al empezar, 0 al final). Devuelve un factor ≥ 1. */
  function latido(fraccion) {
    const f = Math.max(0, Math.min(1, fraccion));
    return 1 + 0.6 * Math.pow(1 - f, 1.4);
  }

  /* El progreso que se guarda, vacío. `frag` y `ecos` son índices leídos;
     `alba`, `hoguera` y `sol`, qué finales se vieron; `piedad`, si alguna
     vez se cruzó la jornada de las lumbres sin apagar ninguna; `punto`, la
     travesía a medias (con `at` para saber cuál es la más nueva, y `j: 0`
     cuando se terminó); `mejor`, los récords locales.
     `punto` no es un punto de control: no hay dónde reintentar. Es la
     partida que quedó abierta cuando alguien cerró la página, y se borra
     en cuanto la travesía acaba (apagándose o terminándola). Se reescribe
     al empezar cada jornada y cada vez que se pierde una llama
     (`perdidas`: las de la jornada en curso), para que salir y volver no
     devuelva lo que se perdió. `sinfin` en `mejor` queda de cuando había
     dos modos, para no tirar el récord de nadie. */
  function progresoVacio() {
    return { v: 1, frag: [], ecos: [], alba: false, hoguera: false, sol: false, piedad: false, punto: { j: 0, at: 0 }, mejor: { travesia: 0, sinfin: 0, jornada: 0 } };
  }

  /* Junta dos progresos (el del navegador y el de la cuenta): lo leído se
     suma, el final visto no se olvida, los récords se quedan con el mayor
     y el punto de control con el más reciente. Acepta basura y la ignora. */
  function mezclaProgreso(a, b) {
    const limpio = p => (p && typeof p === "object" ? p : {});
    const x = limpio(a), y = limpio(b), r = progresoVacio();
    const indices = (l, max) => (Array.isArray(l) ? l.filter(i => Number.isInteger(i) && i >= 0 && i < max) : []);
    r.frag = [...new Set([...indices(x.frag, 64), ...indices(y.frag, 64)])].sort((p, q) => p - q);
    r.ecos = [...new Set([...indices(x.ecos, 64), ...indices(y.ecos, 64)])].sort((p, q) => p - q);
    r.alba = !!(x.alba || y.alba);
    r.hoguera = !!(x.hoguera || y.hoguera);
    r.sol = !!(x.sol || y.sol);
    r.piedad = !!(x.piedad || y.piedad);
    const pa = limpio(x.punto), pb = limpio(y.punto);
    const pt = (+pb.at || 0) > (+pa.at || 0) ? pb : pa;           // el más nuevo, incluido un borrado
    r.punto = Number.isInteger(pt.j) && pt.j > 0
      ? { j: pt.j, puntos: Math.max(0, +pt.puntos || 0), llamas: Math.max(1, Math.min(LLAMAS_TOPE, +pt.llamas || LLAMAS_INICIO)), at: +pt.at || 0 }
      : { j: 0, at: +pt.at || 0 };
    if (r.punto.j > 0 && Number.isFinite(+pt.luces)) r.punto.luces = Math.max(0, Math.round(+pt.luces));
    // Las mejoras y las brasas guardadas con el punto (si la prueba viaja
    // con él, se rehacen de ella; esto es para cuando no).
    if (r.punto.j > 0 && pt.mej) r.punto.mej = limpiaMejoras(pt.mej);
    if (r.punto.j > 0 && Number.isFinite(+pt.br)) r.punto.br = Math.max(0, Math.min(999, Math.floor(+pt.br)));
    if (r.punto.j > 0) r.punto.llamas = Math.min(llamasMax(r.punto.mej), r.punto.llamas);
    // Las llamas perdidas en la jornada a medias, y la racha de notas
    // afinadas con que se empezó (la Resonancia no se reinicia entre
    // jornadas).
    if (r.punto.j > 0) r.punto.perdidas = Math.max(0, Math.min(LLAMAS_TOPE, Math.floor(+pt.perdidas || 0)));
    if (r.punto.j > 0) r.punto.notas = Math.max(0, Math.min(1e6, Math.floor(+pt.notas || 0)));
    // Lo comprado en el taller para la jornada a medias (va a su prueba).
    if (r.punto.j > 0 && typeof pt.u === "string" && /^[a-z]{0,80}$/.test(pt.u)) r.punto.u = pt.u;
    if (r.punto.j > 0 && Number.isInteger(pt.ver)) r.punto.ver = pt.ver;
    // La prueba de lo jugado hasta el punto de control (ver prueba.js): sin
    // ella, seguir desde aquí no entra en la clasificación. Se guarda tal
    // cual (el verificador la rehace entera) si tiene la forma y cabe.
    const pr = pt.pr;
    if (r.punto.j > 0 && pr && typeof pr === "object" && typeof pr.id === "string" && Array.isArray(pr.J)) {
      let largo = Infinity;
      try { largo = JSON.stringify(pr).length; } catch (e) { /* una prueba que no se puede escribir no se guarda */ }
      if (largo <= PRUEBA_PUNTO_MAX) r.punto.pr = pr;
    }
    const ma = limpio(x.mejor), mb = limpio(y.mejor);
    for (const k of ["travesia", "sinfin", "jornada"]) r.mejor[k] = Math.max(0, +ma[k] || 0, +mb[k] || 0);
    return r;
  }

  /* Lo más que ocupa la prueba guardada con la travesía a medias: el
     progreso entero viaja a la cuenta en un blob de menos de 200 000
     caracteres, y veinte jornadas reales ocupan unas decenas de miles. Muy
     adentro del sin fin puede no caber: entonces la partida se sigue igual,
     pero ya no entra en la clasificación. */
  const PRUEBA_PUNTO_MAX = 180000;

  /* Un hash de texto de 53 bits (cyrb53), en base 36. No es una firma: lo
     que hace es encadenar las jornadas de la prueba (cada una lleva el
     hash de la anterior), para que una jornada no se pueda cambiar, quitar
     ni mover sin rehacer todas las que siguen. */
  function hashTexto(texto, semilla) {
    let h1 = 0xdeadbeef ^ (semilla || 0), h2 = 0x41c6ce57 ^ (semilla || 0);
    const s = String(texto);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  /* Lo que paga la Mensajera número `k` (0, 1…) de la jornada `n` en la
     partida `id`. Sale de la semilla de la partida y no de Math.random,
     para que el verificador lo pueda recalcular: si no, cada Mensajera de
     la prueba podría declararse de 500. */
  function valorMensajera(id, n, k) {
    const r = mulberry32(parseInt(hashTexto(id + ":" + n + ":" + k).slice(-6), 36))();
    return PUNTOS_MENSAJERA[Math.floor(r * PUNTOS_MENSAJERA.length)];
  }

  /* Un generador con semilla (mulberry32): mismas estrellas, mismas
     siluetas, para que el cielo de un acto se vea igual cada vez. */
  function mulberry32(semilla) {
    let s = semilla >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    ANCHO, ALTO, Y_FANAL, Y_NAUFRAGIOS, Y_LIMITE, Y_FORMACION,
    ACTOS, PUNTOS, PUNTOS_MENSAJERA, PUNTOS_JEFE, LLAMAS_EXTRA, LLAMAS_INICIO, LLAMAS_MAX,
    VIDA_JEFE, DISTANCIA_ALBA, CIERRE_ALBA, EMPUJE_ALBA, VENTANA_PULSO,
    JORNADAS, JORNADAS_HISTORIA, INICIO_ACTO, JORNADA_HOGUERA, OLEADA_DE_ACTO, faseDeVuelta, VIDA_FASE,
    dificultad, jornada, actoDe, vidaJefe, formacion, polillasDe,
    resonancia, puntosPolilla, bonusJornada, llamasGanadas, juzgaPulso, latido,
    progresoVacio, mezclaProgreso, mulberry32, hashTexto, valorMensajera, PRUEBA_PUNTO_MAX,
    ROMANO_ACTO, JORNADA_ALBA, AUGURIOS, nivelAugurio, augurioDe, aplicaAugurios, CICLO_SINFIN, JEFE_DE_ACTO,
    MEJORAS, LISTA_MEJORAS, POR_CODIGO, CODIGO_LLAMA, COSTO_LLAMA, EVOLUCION, PATRONES, BONUS_ACTO,
    LLAMAS_TOPE, mejorasVacias, limpiaMejoras, puntosRama, evolucion, llamasMax, armas, nave, compra
  };
});
