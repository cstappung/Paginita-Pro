/* FANAL — el relato: todos los textos de la travesía, en un solo sitio.

   Qué hay aquí, en general:
   - Los cuatro ACTOS con su nombre y su lema.
   - La BITACORA: una entrada corta por jornada, escrita por quien lleva
     el fanal. Es la voz del viaje y se lee en el tránsito entre una
     jornada y la siguiente, nunca con el juego en marcha.
   - Los FRAGMENTOS: cartas que lleva la Mensajera (la «nave nodriza» de
     este juego). Solo se leen si se la derriba, y están escritas por
     voces que al principio parecen de otros viajeros y al final se
     entienden como lo que son.
   - La REVELACION (después del Faro Ciego) y el FINAL (al cruzarse con el
     Alba), que se muestran siempre: la historia se entiende entera sin
     fragmentos; los fragmentos la vuelven más honda.
   - Los ECOS y la bitácora del modo sin fin, para que la travesía siga
     hablando después del final.

   Por qué así: el texto separado del juego se revisa de una sentada (el
   tono tiene que ser uno solo) y se comprueba desde Node
   (colabtex/tests/fanal.test.cjs) sin abrir un navegador. UMD:
   `FanalRelato` en la página, `module.exports` en Node. */
(function (raiz, fabrica) {
  // En Node (tests) se exporta como módulo CommonJS.
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  // En el navegador queda colgado de window.FanalRelato.
  else raiz.FanalRelato = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* La portada. El subtítulo no promete llegar: promete ir. */
  const TITULO = "FANAL";
  const SUBTITULO = "una travesía hacia el alba";

  /* Lo primero que se lee, una sola vez por partida nueva. Cada cadena es
     una línea que aparece después de la anterior. */
  const INTRO = [
    "Dicen que al otro lado de la noche está el Alba.",
    "Nadie ha vuelto para contar cómo es.",
    "Llevas el fanal: una llama dentro de un vidrio.",
    "Mientras arda, sigues."
  ];

  /* Los cuatro actos. El lema dice dónde estás contando estrellas, que es
     lo único que de verdad cambia de un acto al otro. */
  const ACTOS = [
    { n: 1, nombre: "EL ENJAMBRE", lema: "Donde todavía hay estrellas." },
    { n: 2, nombre: "LA NIEBLA", lema: "Donde las estrellas se esconden." },
    { n: 3, nombre: "LO OSCURO", lema: "Donde ya no queda ninguna." },
    { n: 4, nombre: "EL ALBA", lema: "Donde termina la noche, o eso dicen." }
  ];
  /* El acto del modo sin fin: no tiene número porque no se acaba. */
  const ACTO_SINFIN = { n: 5, nombre: "LA TRAVESÍA SIN FIN", lema: "Donde ya sabes lo que hay en la oscuridad." };

  /* Una entrada por jornada (la 1 es BITACORA[0]). Primera persona, sin
     adjetivos con género: quien lleva el fanal no tiene nombre ni cara,
     para que pueda ser cualquiera. */
  const BITACORA = [
    "Jornada 1. Encendí el fanal y empecé a remar hacia el norte. El cielo está lleno de luces. Y de polillas.",
    "Jornada 2. No me dejan en paz. Vienen en filas, como si alguien las ordenara. Disparo hasta que el cañón se entibia.",
    "Jornada 3. Pasé junto a un fanal hundido. Usé su casco para cubrirme. No miré adentro.",
    "Jornada 4. Algo grande se mueve detrás del enjambre. Las polillas se apartan para dejarla pasar.",
    "Jornada 5. Entré en la niebla. Mi luz llega hasta la punta del brazo y ahí se rinde.",
    "Jornada 6. Conté las estrellas antes de dormir. Ayer eran más. Me digo que las tapa la niebla.",
    "Jornada 7. Hablé en voz alta para oír algo. La niebla no devuelve eco.",
    "Jornada 8. Hay otra luz adelante. Gira. Por un momento pensé que era el Alba.",
    "Jornada 9. Ahora sé lo que son. Disparo igual. Si me alcanzan, no queda ninguna luz.",
    "Jornada 10. Ya no hay estrellas. Solo el fanal y lo que el fanal alcanza a tocar.",
    "Jornada 11. Algo me mira desde donde no llega la luz. Tiene el tamaño de la noche.",
    "Jornada 12. El horizonte cambió de color. Las polillas de aquí brillan solas. No disparan.",
    "Jornada 13. Ahí está el Alba. Viene hacia mí."
  ];

  /* La bitácora del modo sin fin: se recorre en círculo, y el número de
     jornada se pone delante. Más corta cada vez, como quien ya no necesita
     explicarse. */
  const BITACORA_SINFIN = [
    "Sigo.",
    "Otra luz en el horizonte. No pregunto.",
    "Ahora, cuando apago una, le pido perdón en voz baja.",
    "La noche empezó otra vez, como si nadie la hubiera cruzado.",
    "Ya no cuento las estrellas. Cuento las que me siguen.",
    "Remo despacio. A veces creo que me esperan.",
    "Volví a ver la Nodriza. O a su hija. Aquí todo vuelve.",
    "El vidrio del fanal tiene una grieta nueva. Sigue entero.",
    "Hoy no disparé hasta que fue necesario. Llegó igual.",
    "La niebla me reconoce. O eso quiero creer.",
    "Hay una luz delante. Siempre hay una luz delante.",
    "No sé cuántas jornadas van. El fanal sí: las lleva quemadas."
  ];

  /* Las cartas de la Mensajera, en el orden en que se recuperan. `acto` es
     el primer acto en que puede caer cada una: así no se lee el final en
     la primera jornada. Las voces no se presentan; el jugador decide quién
     las escribió hasta que la novena se lo dice. */
  const FRAGMENTOS = [
    { acto: 1, texto: "Si alguien lee esto: la luz del norte es tibia. Vamos hacia ella." },
    { acto: 1, texto: "Somos muchas. Volamos en filas para no perdernos." },
    { acto: 1, texto: "Hoy vi caer a mi hermana. Dicen que la luz la quemó. Yo creo que llegó." },
    { acto: 1, texto: "La madre nos dio a luz cerca de un fanal. Así se nace aquí: mirando una llama." },
    { acto: 2, texto: "En la niebla cuesta seguirla. A veces la luz se va y nos quedamos quietas, esperando." },
    { acto: 2, texto: "No sé disparar. Solo sé acercarme." },
    { acto: 2, texto: "El polvo de mis alas no es un arma. Es lo que se me cae cuando tengo frío." },
    { acto: 2, texto: "Antes había un fanal que giraba. Nos posamos sobre él hasta cubrirlo. Ahí adentro hacía calor." },
    { acto: 3, texto: "Cada vez que una de nosotras se apaga, en el cielo falta una estrella. ¿No lo habías notado?" },
    { acto: 3, texto: "A la luz que va delante: no te detengas. Si te alcanzamos, te apagamos." },
    { acto: 3, texto: "La Esfinge es la más vieja. Vio otros fanales. Dice que todos iban al mismo sitio." },
    { acto: 4, texto: "Aquí brillamos solas. Nadie sabe por qué. Quizás aprendimos de mirarte." },
    { acto: 4, texto: "El Alba también lleva un fanal. También cree que va sola." }
  ];

  /* Los ecos del modo sin fin: cartas que llegan después del final, ya sin
     orden. Se recuperan como los fragmentos, pero no cuentan para la
     historia: son lo que queda de ella. */
  const ECOS = [
    "Otra vez la noche. Otra vez tú.",
    "Las que cruzaron el alba contigo cuentan que era tibia.",
    "No buscamos llegar. Buscamos no perderte de vista.",
    "Hay fanales que se apagan de cansancio, no de frío.",
    "Si un día te detienes, te alcanzaremos. Ese día será tibio.",
    "La noche no tiene fondo. Por eso se puede cruzar tantas veces.",
    "Contamos tus jornadas. Tú no cuentas las nuestras.",
    "Una luz sola alumbra poco. Pero se ve desde muy lejos.",
    "La Nodriza volvió a nacer. Así es aquí: todo vuelve.",
    "Nadie llega. Algunas se cruzan.",
    "Te seguimos porque eres lo único que no se apaga.",
    "Quizás el alba sea solo la luz que todavía no alcanzaste."
  ];

  /* Los cuatro encuentros grandes: nombre, epíteto (la tarjeta con que se
     presentan) y la línea que queda cuando caen. El Faro y el Alba no
     tienen línea propia: después de ellos viene la revelación y el final. */
  const JEFES = {
    nodriza: { nombre: "LA NODRIZA", epiteto: "Madre del enjambre", cae: "El enjambre se dispersa. Por un rato, el cielo es tuyo." },
    faro: { nombre: "EL FARO CIEGO", epiteto: "Gira sin ver", cae: "" },
    esfinge: { nombre: "LA ESFINGE", epiteto: "La más vieja de la noche", cae: "La Esfinge se apagó sin ruido. En el cielo queda una sola luz: la tuya." },
    alba: { nombre: "EL ALBA", epiteto: "Viene hacia ti", cae: "" }
  };

  /* Lo que se ve al apagar el Faro Ciego. Es el primer giro: lo que el
     jugador estuvo haciendo cambia de nombre. Se muestra línea a línea, en
     silencio. */
  const REVELACION = [
    "El faro se apagó.",
    "Las polillas que lo cubrían no huyeron.",
    "Se quedaron alrededor de tu luz, quietas.",
    "No venían a apagarte.",
    "Venían a calentarse.",
    "Cada una que apagaste era una estrella del cielo."
  ];

  /* La pista que da el juego cuando el Alba empieza a acercarse: es lo
     único que se dice de cómo se gana ese encuentro. */
  const AVISO_ALBA = "Todo lo que lances, volverá.";

  /* El final, al cruzarse con el Alba. Segundo giro: el cielo nunca estuvo
     vacío, solo era más grande que la luz que lo miraba. */
  const FINAL = [
    "Por un instante, las dos luces alumbraron lo mismo.",
    "El cielo no estaba vacío.",
    "Nunca lo estuvo.",
    "Estaba lleno de alas, siguiéndote en silencio,",
    "demasiado lejos de tu luz para que pudieras verlas.",
    "Después el Alba siguió su camino.",
    "Y tú, el tuyo."
  ];
  /* La línea que se agrega si en la jornada 12 no apagaste ninguna de las
     polillas que brillan solas. */
  const FINAL_PIEDAD = "Las que no apagaste volaban a tu lado.";
  /* La moraleja que no se dice como moraleja, y la orden que abre el modo
     sin fin. */
  const FINAL_CIERRE = "El alba no era un lugar. Era otra luz que viajaba hacia la tuya.";
  const FINAL_ORDEN = "SIGUE.";

  /* Lo que se lee cuando el fanal se apaga. Una al azar: la noche no
     consuela, pero tampoco se repite. */
  const APAGADO = [
    "La noche no se dio cuenta.",
    "Nadie vio apagarse la luz.",
    "Las polillas se quedaron un rato, por si volvía.",
    "El vidrio quedó tibio un momento. Después, nada.",
    "En algún lugar, una estrella menos. Esta vez fuiste tú."
  ];

  /* Lo que se ve en el HUD del modo sin fin donde antes decía la distancia
     al alba. La interrogación no se resuelve nunca. */
  const SIGUIENTE_LUZ = "?";

  /* Del número al romano, para numerar las cartas (I … XIII). */
  function romano(n) {
    // Los valores y símbolos de mayor a menor, con las restas (CM, XC, IV…).
    const tabla = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
      [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let s = "";                                     // el resultado se arma de izquierda a derecha
    for (const [v, r] of tabla) while (n >= v) { s += r; n -= v; } // resta el valor más grande que cabe
    return s;
  }

  /* La entrada de bitácora de cualquier jornada: las trece de la historia
     tal cual, y las del modo sin fin en círculo con su número delante. */
  function bitacora(n) {
    if (n >= 1 && n <= BITACORA.length) return BITACORA[n - 1];                 // historia
    const k = (n - BITACORA.length - 1) % BITACORA_SINFIN.length;              // posición en el círculo
    return "Jornada " + n + ". " + BITACORA_SINFIN[(k + BITACORA_SINFIN.length) % BITACORA_SINFIN.length];
  }

  /* El índice del próximo fragmento que puede caer en este acto, o -1 si
     ya se tienen todos los que el acto permite. `tenidos` es un conjunto
     (o arreglo) de índices ya recuperados. Se dan en orden: la carta X no
     llega antes que la IX, porque la IX explica a la X. */
  function fragmentoSiguiente(tenidos, acto) {
    const t = new Set(tenidos || []);                                          // acepta arreglo o conjunto
    for (let i = 0; i < FRAGMENTOS.length; i++) {
      if (FRAGMENTOS[i].acto > acto) return -1;                                // de aquí en adelante aún no toca
      if (!t.has(i)) return i;                                                 // la primera que falta
    }
    return -1;                                                                 // están todas
  }

  /* El índice del próximo eco que falta (en el modo sin fin), o uno al azar
     de los ya leídos si están todos: la Mensajera siempre trae algo. */
  function ecoSiguiente(tenidos, azar) {
    const t = new Set(tenidos || []);
    for (let i = 0; i < ECOS.length; i++) if (!t.has(i)) return i;            // el primero sin leer
    return Math.floor((azar == null ? Math.random() : azar) * ECOS.length) % ECOS.length; // repetido
  }

  return {
    TITULO, SUBTITULO, INTRO, ACTOS, ACTO_SINFIN, BITACORA, BITACORA_SINFIN,
    FRAGMENTOS, ECOS, JEFES, REVELACION, AVISO_ALBA, FINAL, FINAL_PIEDAD,
    FINAL_CIERRE, FINAL_ORDEN, APAGADO, SIGUIENTE_LUZ,
    romano, bitacora, fragmentoSiguiente, ecoSiguiente
  };
});
