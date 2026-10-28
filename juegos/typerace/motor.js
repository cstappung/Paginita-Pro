/* Type Race — el motor, compartido.
   Lo usan tres sitios: la práctica de un jugador (este directorio, sin
   compilar), la sala multijugador de Juegos (esbuild lo mete en el
   paquete) y las pruebas de Node. Por eso es UMD y no toca el DOM.

   Dos partes:
   - **El texto.** `palabras(aj, semilla, n)` da las n primeras palabras
     de la carrera. Es determinista y su prefijo es estable: pedir 300
     empieza igual que pedir 50, así que el modo libre puede ir alargando
     el texto sin que nadie vea cambiar lo que ya tenía delante. En una
     sala todos sacan el mismo texto de la semilla de la sala.
   - **El tecleo.** `crear(palabras)` y luego `escribe`, `espacio` y
     `retrocede` sobre lo que hay en el campo de texto. Se trabaja con el
     valor del campo y no con teclas sueltas a propósito: las tildes con
     tecla muerta, los teclados del celular y los IME llegan como
     «el campo ahora dice esto», nunca como una tecla limpia.

   El tiempo lo pone siempre quien llama (`ahora`), como en el Tetris. */
(function (raiz, fabrica) {
  const M = fabrica();
  if (typeof module === "object" && module.exports) module.exports = M;
  else raiz.TypeRaceMotor = M;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- el banco ---------- */
  const PALABRAS = {
    es: ("de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros os mío mía tuyo suyo nuestro " +
      "casa tiempo año día vez hombre mujer vida mundo parte país gente niño ciudad agua forma lugar trabajo noche hora caso punto mano momento palabra ejemplo historia guerra fuerza cuenta camino cabeza puerta calle tierra libro mesa árbol perro gato pájaro río mar montaña cielo sol luna estrella fuego viento lluvia nieve flor fruta pan leche café azúcar sal música canción juego equipo escuela clase pregunta respuesta idea problema razón verdad mentira amigo familia padre madre hermano hija hijo abuelo " +
      "hacer poder decir ir ver dar saber querer llegar pasar deber poner parecer quedar creer hablar llevar dejar seguir encontrar llamar venir pensar salir volver tomar conocer vivir sentir tratar mirar contar empezar esperar buscar existir entrar trabajar escribir perder producir ocurrir entender pedir recibir recordar terminar permitir aparecer conseguir comenzar servir sacar necesitar mantener resultar leer caer cambiar presentar crear abrir considerar oír acabar convertir ganar formar traer partir morir aceptar realizar suponer comprender lograr explicar " +
      "grande nuevo bueno malo pequeño largo corto alto bajo joven viejo mejor peor mismo propio último primero segundo cierto rápido lento fácil difícil claro oscuro feliz triste fuerte débil caliente frío dulce amargo limpio sucio rico pobre lleno vacío abierto cerrado verde azul rojo amarillo blanco negro siempre nunca ahora luego hoy mañana ayer aquí allí cerca lejos bien mal mucho poco tarde temprano después además así quizás todavía").split(" "),
    en: ("the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us " +
      "house water world life hand part child eye woman place week case point number group problem fact city story game music book road river tree door table window garden letter friend family mother father brother sister morning evening night summer winter spring money school answer question paper light sound voice color animal bird horse ocean mountain island forest field flower apple bread sugar coffee cloud storm fire wind rain snow star moon planet engine train market " +
      "find tell ask seem feel try leave call keep let begin help talk turn start show hear play run move live believe hold bring happen write provide sit stand lose pay meet include continue set learn change lead understand watch follow stop create speak read spend grow open walk win offer remember love consider appear buy wait serve die send expect build stay fall cut reach kill remain suggest raise pass sell require report decide pull " +
      "great little own old right big high different small large next early young important few public bad same able last long late hard major better best free strong clear sure whole real easy simple quick slow happy bright dark warm cold quiet loud green blue red yellow white black never always often sometimes here there today tomorrow yesterday again still already soon very really almost together inside outside").split(" ")
  };

  /* Refranes y dichos de siempre: son de todos, no de un autor. */
  const FRASES = {
    es: [
      "Más vale tarde que nunca.",
      "No por mucho madrugar amanece más temprano.",
      "Camarón que se duerme se lo lleva la corriente.",
      "A caballo regalado no se le miran los dientes.",
      "Dime con quién andas y te diré quién eres.",
      "En boca cerrada no entran moscas.",
      "Al mal tiempo, buena cara.",
      "Ojos que no ven, corazón que no siente.",
      "Más vale pájaro en mano que cien volando.",
      "El que mucho abarca poco aprieta.",
      "Perro que ladra no muerde.",
      "No hay mal que por bien no venga.",
      "Cría cuervos y te sacarán los ojos.",
      "A quien madruga, Dios lo ayuda.",
      "El que busca, encuentra.",
      "Poco a poco se anda lejos.",
      "Quien siembra vientos recoge tempestades.",
      "Donde fueres, haz lo que vieres.",
      "Cuando el río suena, piedras trae.",
      "Agua que no has de beber, déjala correr.",
      "La práctica hace al maestro.",
      "No dejes para mañana lo que puedas hacer hoy.",
      "Hablando del rey de Roma, por la puerta se asoma.",
      "Del dicho al hecho hay mucho trecho.",
      "Zapatero, a tus zapatos.",
      "Más sabe el diablo por viejo que por diablo.",
      "El tiempo es oro.",
      "Barriga llena, corazón contento.",
      "Mucho ruido y pocas nueces.",
      "A buen entendedor, pocas palabras bastan.",
      "Cada loco con su tema.",
      "El hábito no hace al monje.",
      "Lo que no mata, engorda.",
      "Querer es poder.",
      "Las apariencias engañan.",
      "Ojo por ojo, diente por diente.",
      "Quien ríe último ríe mejor.",
      "Una golondrina no hace verano."
    ],
    en: [
      "Better late than never.",
      "The early bird catches the worm.",
      "Actions speak louder than words.",
      "Don't count your chickens before they hatch.",
      "Every cloud has a silver lining.",
      "A picture is worth a thousand words.",
      "When in Rome, do as the Romans do.",
      "Practice makes perfect.",
      "Rome wasn't built in a day.",
      "Where there's a will, there's a way.",
      "Don't judge a book by its cover.",
      "Two heads are better than one.",
      "The pen is mightier than the sword.",
      "An apple a day keeps the doctor away.",
      "Birds of a feather flock together.",
      "Look before you leap.",
      "Honesty is the best policy.",
      "A watched pot never boils.",
      "You can't have your cake and eat it too.",
      "Too many cooks spoil the broth.",
      "Necessity is the mother of invention.",
      "Slow and steady wins the race.",
      "Fortune favors the bold.",
      "Time flies when you're having fun.",
      "Beggars can't be choosers.",
      "Don't put all your eggs in one basket.",
      "Curiosity killed the cat.",
      "Knowledge is power.",
      "Laughter is the best medicine.",
      "Every dog has its day.",
      "Still waters run deep.",
      "Strike while the iron is hot.",
      "It takes two to tango.",
      "Absence makes the heart grow fonder.",
      "No news is good news.",
      "Easy come, easy go."
    ]
  };

  /* Cuentos cortos escritos para este juego. */
  const CUENTOS = {
    es: [
      "El faro de la isla llevaba años apagado. Una noche de tormenta, la niña que vivía en la casa de al lado subió los ciento veinte escalones con una linterna de bolsillo. No alumbraba casi nada, pero desde el mar un pescador perdido vio el puntito de luz y supo hacia dónde remar. Desde entonces, en el pueblo nadie dice que una luz pequeña no sirve para nada.",
      "Mi abuelo guardaba los botones sueltos en un frasco de mermelada. Decía que cada botón era una historia: el azul era del abrigo con que conoció a mi abuela, el dorado de un uniforme que nunca quiso usar, el rojo de una muñeca que perdió mi madre. Cuando el frasco pasó a mis manos, entendí que no estaba heredando botones, sino recuerdos con agujeritos.",
      "El robot de la cafetería aprendió a dibujar corazones en la espuma del café. Nadie se lo había enseñado; simplemente observó durante meses a la camarera que trabajaba los domingos. El día que ella se jubiló, el robot dibujó un corazón en cada taza y, por primera vez, nadie se quejó de que el café llegara tarde.",
      "En la biblioteca del barrio había un libro que nadie pedía prestado. Tenía las tapas gastadas y el título borrado. Un martes, un chico lo abrió por aburrimiento y encontró, entre las páginas, cartas de lectores de otras épocas que le contaban qué les había parecido. Él escribió la suya, la dejó en la última página y devolvió el libro a su estante.",
      "La tortuga del parque decidió cruzar el estanque por el puente, como las personas. Tardó toda la tarde. Los patos se burlaban, los niños apostaban y un señor mayor le llevó una hoja de lechuga para darle ánimo. Cuando por fin llegó al otro lado, se dio media vuelta y empezó a cruzar de nuevo, porque lo importante nunca había sido llegar.",
      "Cada mañana, la cartera del pueblo dejaba una carta sin remitente en el buzón de la casa amarilla. La anciana que vivía allí las leía en voz alta en el portal, y los vecinos se fueron acercando a escucharlas. Nunca supieron quién las escribía. Cuando las cartas dejaron de llegar, fueron ellos los que empezaron a escribirle a la anciana."
    ],
    en: [
      "The old lighthouse on the island had been dark for years. One stormy night, the girl who lived next door climbed the hundred and twenty steps with a pocket flashlight. It barely lit anything, but a lost fisherman out at sea saw the tiny spark and knew which way to row. Since then, nobody in town says that a small light is useless.",
      "My grandfather kept loose buttons in an old jam jar. He said every button was a story: the blue one came from the coat he wore when he met my grandmother, the golden one from a uniform he never wanted, the red one from a doll my mother lost. When the jar came to me, I understood I was not inheriting buttons, but memories with little holes.",
      "The robot at the corner cafe learned to draw hearts in the milk foam. Nobody taught it; it simply watched the waitress who worked on Sundays for months. On the day she retired, the robot drew a heart on every single cup, and for the first time, nobody complained that their coffee was late.",
      "There was a book in the neighborhood library that nobody ever borrowed. Its covers were worn and its title had faded away. One Tuesday, a bored boy opened it and found, between the pages, letters from readers of other times telling him what they had thought of it. He wrote his own, tucked it into the last page and put the book back on its shelf.",
      "The turtle in the park decided to cross the pond by the bridge, just like people do. It took the whole afternoon. The ducks laughed, the children placed bets, and an old man brought a lettuce leaf to cheer it on. When it finally reached the other side, it turned around and started crossing again, because the point had never been to arrive.",
      "Every morning, the town mail carrier left an unsigned letter in the mailbox of the yellow house. The old woman who lived there read them aloud on her porch, and the neighbors slowly gathered to listen. They never learned who wrote them. When the letters stopped coming, it was the neighbors who began writing to her."
    ]
  };

  /* ---------- los ajustes ---------- */
  const LARGOS = [10, 25, 50, 100, 200, 0];         // 0 = libre: no se acaba, manda el reloj
  const TIEMPOS = [15, 30, 60, 120, 180];
  const TEXTOS = { palabras: "Palabras al azar", frases: "Frases y refranes", cuentos: "Cuentos" };
  const FINALES = { todos: "Hasta que todos terminen", primero: "Termina el primero y se acaba", tiempo: "Con límite de tiempo" };
  const IDIOMAS = { es: "Español", en: "English" };

  /* Lo que llega (de la sala o del formulario) recortado a lo que existe.
     El libre siempre va con reloj: un texto sin fin necesita algo que lo
     corte. */
  function ajustes(o) {
    o = o || {};
    const idioma = o.idioma === "en" ? "en" : "es";
    const texto = TEXTOS[o.texto] ? o.texto : "palabras";
    const n = Math.floor(Number(o.largo));
    const largo = LARGOS.includes(n) ? n : 50;
    let final = FINALES[o.final] ? o.final : "todos";
    if (largo === 0) final = "tiempo";
    const t = Math.floor(Number(o.tiempo));
    const tiempo = TIEMPOS.includes(t) ? t : 60;
    const acentos = idioma === "es" ? Number(o.acentos) !== 0 : true;
    return { idioma, texto, largo, final, tiempo, acentos };
  }

  /* ---------- el texto ---------- */
  function mulberry32(a) {
    a >>>= 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Sin tildes ni diéresis; la ñ se queda, que es una letra y no un
     acento. */
  const LLANAS = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U" };
  const sinAcentos = s => String(s).replace(/[áéíóúüÁÉÍÓÚÜ]/g, c => LLANAS[c]);

  /* Las n primeras palabras de la carrera. En «palabras» cada una sale al
     azar del banco (sin repetir la anterior); en frases y cuentos se
     barajan las piezas y se van encadenando, y al acabarse el mazo se
     vuelve a barajar. Las dos maneras consumen el azar en orden, así que
     pedir más nunca cambia las primeras. */
  function palabras(aj, semilla, n) {
    aj = ajustes(aj);
    const r = mulberry32((Number(semilla) >>> 0) ^ 0x7e3a11);
    const fuera = [];
    if (aj.texto === "palabras") {
      const banco = PALABRAS[aj.idioma];
      let ant = "";
      while (fuera.length < n) {
        let w = banco[Math.floor(r() * banco.length)];
        if (w === ant) w = banco[(banco.indexOf(w) + 1) % banco.length];
        fuera.push(w); ant = w;
      }
    } else {
      const piezas = (aj.texto === "frases" ? FRASES : CUENTOS)[aj.idioma];
      let mazo = [], ant = -1;
      while (fuera.length < n) {
        if (!mazo.length) {
          mazo = piezas.map((_, i) => i);
          for (let i = mazo.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [mazo[i], mazo[j]] = [mazo[j], mazo[i]]; }
          if (mazo[0] === ant && mazo.length > 1) mazo.push(mazo.shift());
        }
        ant = mazo.shift();
        for (const w of piezas[ant].split(/\s+/)) { if (w) fuera.push(w); if (fuera.length >= n) break; }
      }
    }
    return aj.acentos ? fuera : fuera.map(sinAcentos);
  }
  /* Cuántas palabras pide la pantalla de entrada: el largo elegido, o un
     buen trozo en el libre (que se alarga con `palabras` cuando hace
     falta). */
  const inicial = aj => { aj = ajustes(aj); return aj.largo || 120; };

  /* ---------- el tecleo ---------- */
  function crear(lista, libre) {
    return {
      pal: lista.slice(), libre: !!libre,
      i: 0, esc: "",            // la palabra en curso y lo que dice el campo
      hechas: [],              // lo escrito de cada palabra ya cerrada
      buenas: 0,               // pulsaciones que eran la letra correcta
      malas: 0,                // pulsaciones que no
      t0: 0, tFin: 0, fin: false
    };
  }
  const objetivo = s => s.pal[s.i] || "";

  /* El campo ahora dice `valor` (sin espacios: el espacio es `espacio`).
     Solo se cuentan las letras nuevas al final, una por una, contra la
     letra que tocaba en esa posición; borrar no se cuenta. */
  function escribe(s, valor, ahora) {
    if (s.fin) return null;
    valor = String(valor).replace(/\s+/g, "");
    const ant = s.esc, obj = objetivo(s);
    let ev = null;
    if (valor.length > ant.length && valor.startsWith(ant)) {
      if (!s.t0) s.t0 = ahora;
      for (let k = ant.length; k < valor.length; k++) {
        if (valor[k] === obj[k]) { s.buenas++; ev = ev || "ok"; } else { s.malas++; ev = "mal"; }
      }
    } else if (valor.length > ant.length) {
      if (!s.t0) s.t0 = ahora;
      s.malas++; ev = "mal";
    }
    s.esc = valor;
    /* La última palabra se cierra sola al quedar bien: no hay espacio
       después del final. */
    if (!s.libre && s.i === s.pal.length - 1 && valor === obj) { cierraPalabra(s, ahora); return "fin"; }
    return ev;
  }
  function cierraPalabra(s, ahora) {
    s.hechas.push(s.esc);
    s.i++; s.esc = "";
    if (!s.libre && s.i >= s.pal.length) { s.fin = true; s.tFin = ahora; }
  }
  /* El espacio cierra la palabra, bien o mal escrita (como Monkeytype);
     con el campo vacío no hace nada. */
  function espacio(s, ahora) {
    if (s.fin || !s.esc) return null;
    if (!s.t0) s.t0 = ahora;
    const bien = s.esc === objetivo(s);
    if (bien) s.buenas++; else s.malas++;
    cierraPalabra(s, ahora);
    return s.fin ? "fin" : bien ? "palabra" : "mal";
  }
  /* Borrar con el campo vacío vuelve a la palabra anterior, pero solo si
     quedó mal: lo que está bien escrito ya no se toca. Devuelve lo que
     tiene que decir el campo. */
  function retrocede(s) {
    if (s.fin || s.esc || !s.i) return null;
    const prev = s.hechas[s.hechas.length - 1];
    if (prev === s.pal[s.i - 1]) return null;
    s.hechas.pop(); s.i--; s.esc = prev;
    return prev;
  }

  /* Las cuentas. Las ppm (palabras por minuto) son las de siempre: cinco
     caracteres por palabra, contando solo las palabras bien escritas y
     el espacio que las separa; las «brutas» cuentan todo lo tecleado. */
  function cuentas(s, ahora) {
    let c = 0, todo = 0, ok = 0;
    s.hechas.forEach((w, k) => {
      todo += w.length + 1;
      if (w === s.pal[k]) { c += w.length + 1; ok++; }
    });
    todo += s.esc.length;
    if (s.fin && !s.libre && s.hechas.length && s.hechas[s.hechas.length - 1] === s.pal[s.hechas.length - 1]) c--;   // la última no lleva espacio
    if (!s.fin && s.esc && s.pal[s.i] && s.pal[s.i].startsWith(s.esc)) c += s.esc.length;
    const fin = s.fin ? s.tFin : ahora;
    const ms = s.t0 ? Math.max(1, fin - s.t0) : 0;
    const min = ms / 60000;
    const ppm = min > 0.0005 ? Math.min(400, (c / 5) / min) : 0;
    const brutas = min > 0.0005 ? Math.min(500, (todo / 5) / min) : 0;
    const pulsos = s.buenas + s.malas;
    return {
      ppm: Math.round(ppm), brutas: Math.round(brutas),
      prec: pulsos ? Math.round(100 * s.buenas / pulsos) : 100,
      c: Math.max(0, c), e: s.malas, p: ok, ms,
      avance: s.libre ? 0 : Math.min(1, totalHecho(s) / Math.max(1, totalTexto(s)))
    };
  }
  /* El avance para la pista: caracteres recorridos sobre los del texto. */
  const totalTexto = s => s.pal.reduce((a, w) => a + w.length + 1, -1);
  function totalHecho(s) {
    let n = 0;
    for (let k = 0; k < s.hechas.length; k++) n += s.pal[k].length + 1;
    return n + Math.min(s.esc.length, objetivo(s).length);
  }

  return {
    PALABRAS, FRASES, CUENTOS, LARGOS, TIEMPOS, TEXTOS, FINALES, IDIOMAS,
    ajustes, palabras, inicial, sinAcentos, mulberry32,
    crear, escribe, espacio, retrocede, cuentas, objetivo
  };
});
