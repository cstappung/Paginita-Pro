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
   - La SEGUNDA PARTE (la otra orilla): tres actos más después del Alba
     —los cascos, la seda, la hoguera—, su final y la orden que abre el
     sin fin. La travesía ya no termina: sigue.
   - Los ECOS y la bitácora del modo sin fin, para que la travesía siga
     hablando después del final.
   - Los nombres de lo que se compra en el taller con las brasas, de las
     evoluciones del arma y del fanal, y de los augurios.

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
    "Más allá, dicen otros, está el Sol.",
    "Llevas el fanal: una llama dentro de un vidrio.",
    "Mientras arda, sigues."
  ];

  /* Los actos. El lema dice dónde estás contando estrellas, que es
     lo único que de verdad cambia de un acto al otro. */
  const ACTOS = [
    { n: 1, nombre: "EL ENJAMBRE", lema: "Donde todavía hay estrellas." },
    { n: 2, nombre: "LA NIEBLA", lema: "Donde las estrellas se esconden." },
    { n: 3, nombre: "LO OSCURO", lema: "Donde ya no queda ninguna." },
    { n: 4, nombre: "EL ALBA", lema: "Donde termina la noche, o eso dicen." },
    // La otra orilla (los números 6, 7 y 8 del motor; en pantalla, V, VI y VII).
    { n: 6, nombre: "LOS CASCOS", lema: "Donde se hunden los fanales." },
    { n: 7, nombre: "LA SEDA", lema: "Donde nacen las que te siguen." },
    { n: 8, nombre: "LA HOGUERA", lema: "Adonde van todos los fanales." },
    // Lo alto (9, 10 y 11 del motor; en pantalla, VIII, IX y X).
    { n: 9, nombre: "LA MAREA", lema: "Donde la luna tira de todo." },
    { n: 10, nombre: "EL FIRMAMENTO", lema: "Donde vuelven las estrellas que apagaste." },
    { n: 11, nombre: "EL CENIT", lema: "Donde ya no hace falta un fanal." }
  ];
  /* El acto del sin fin (después del Sol): no tiene número porque no se
     acaba. En pantalla se muestra el acto que vuelve, con su fase. */
  const ACTO_SINFIN = { n: 5, nombre: "LA TRAVESÍA SIN FIN", lema: "Donde ya sabes lo que hay en la oscuridad." };
  /* El acto por su número del motor (1–11; el 5 es el sin fin). */
  const actoInfo = n => (n === 5 ? ACTO_SINFIN : ACTOS.find(a => a.n === n) || ACTOS[0]);
  /* La tarjeta que separa las dos partes, justo después del Alba. */
  const PARTE_DOS = { num: "SEGUNDA PARTE", nombre: "LA OTRA ORILLA", lema: "Donde la noche empieza de nuevo." };
  /* Y la que separa la segunda de la tercera, después de la Hoguera. */
  const PARTE_TRES = { num: "TERCERA PARTE", nombre: "LO ALTO", lema: "Donde la noche termina de verdad." };

  /* Una entrada por jornada (la 1 es BITACORA[0]). Primera persona, sin
     adjetivos con género: quien lleva el fanal no tiene nombre ni cara,
     para que pueda ser cualquiera. Una oleada y un jefe por acto: las
     impares cruzan el enjambre, las pares lo miran a la cara. */
  const BITACORA = [
    "Jornada 1. Encendí el fanal y empecé a remar hacia el norte. El cielo está lleno de luces. Y de polillas.",
    "Jornada 2. Algo grande se mueve detrás del enjambre. Las polillas se apartan para dejarla pasar.",
    "Jornada 3. Entré en la niebla. Mi luz llega hasta la punta del brazo y ahí se rinde.",
    "Jornada 4. Hay otra luz adelante. Gira. Por un momento pensé que era el Alba.",
    "Jornada 5. Ya no hay estrellas. Solo el fanal y lo que el fanal alcanza a tocar.",
    "Jornada 6. Algo me mira desde donde no llega la luz. Tiene el tamaño de la noche.",
    "Jornada 7. El horizonte cambió de color. Las polillas de aquí brillan solas. No disparan.",
    "Jornada 8. Ahí está el Alba. Viene hacia mí.",
    // La otra orilla.
    "Jornada 9. Del otro lado del alba, la noche empieza de nuevo. Hay cascos por todas partes: fanales hundidos, cientos.",
    "Jornada 10. Uno de los cascos todavía arde bajo el agua. Se mueve. Me vio.",
    "Jornada 11. El aire está lleno de hilos. Aquí nacen las que me siguen, envueltas, esperando una luz para abrir los ojos.",
    "Jornada 12. Hay un capullo más grande que los otros. Late con mi pulso.",
    "Jornada 13. Al fondo hay una luz enorme. Todos los fanales van hacia ella. Las polillas también.",
    "Jornada 14. Es una hoguera hecha de fanales. Me llama por mi nombre. No sabía que tuviera uno.",
    // Lo alto.
    "Jornada 15. El agua subió hasta el cielo. Remo hacia arriba y el mar me sigue, como si algo tirara de él.",
    "Jornada 16. Es la Luna. Las polillas se guiaban por ella antes de que hubiera fanales. Me mira como a un error.",
    "Jornada 17. Las estrellas volvieron. Caen de a una, encendidas, sin apuntar a ninguna parte.",
    "Jornada 18. Siete vuelan juntas. Son las primeras que apagué. Se acuerdan.",
    "Jornada 19. Hace tanto calor que el vidrio cruje. Arriba ya no es de noche.",
    "Jornada 20. El Sol. Todo lo que alumbra viene de ahí. También lo que me persigue."
  ];

  /* La bitácora del sin fin (después del Sol): se recorre en círculo, y
     el número de jornada se pone delante. Más corta cada vez, como quien ya
     no necesita explicarse. */
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
    "No sé cuántas jornadas van. El fanal sí: las lleva quemadas.",
    "Me crucé con otro fanal. Nos alumbramos un momento y seguimos.",
    "Hay cascos que todavía me reconocen. Les dejo un poco de luz al pasar.",
    "Un capullo se abrió justo delante. Lo primero que vio fue mi llama. Lo siento.",
    "Pienso en la Hoguera. Desde aquí no se ve. Mejor.",
    "El vidrio está caliente. La noche, igual de fría. Las dos cosas siguen.",
    "Los que vencí vuelven teñidos de rojo. Me conocen mejor que la primera vez.",
    "Ya no hay Sol. Cuando miro hacia arriba, lo que más brilla soy yo."
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
    { acto: 4, texto: "El Alba también lleva un fanal. También cree que va sola." },
    // La otra orilla.
    { acto: 6, texto: "Los fanales hundidos no se apagaron de frío. Se quedaron quietos, y la noche les pasó por encima." },
    { acto: 6, texto: "Anidamos en los cascos porque guardan el calor. Un fanal tarda mucho en enfriarse." },
    { acto: 7, texto: "Abrí los ojos y lo primero fue tu luz. No sé ir hacia ninguna otra cosa." },
    { acto: 7, texto: "Dicen que seguirte es morir. Nadie dice que quedarse a oscuras también." },
    { acto: 8, texto: "La Hoguera no quema. Abriga. Por eso nadie vuelve." },
    { acto: 8, texto: "Si entras, serás tibia para siempre. Si sigues, serás luz. No se pueden las dos cosas." },
    // Lo alto.
    { acto: 9, texto: "Antes de los fanales nos guiábamos por la Luna. Nunca la alcanzábamos, y eso estaba bien." },
    { acto: 9, texto: "La Luna no quema. Por eso nadie la quiso tanto como a ti." },
    { acto: 10, texto: "Las que apagaste no se perdieron. Subieron. Desde aquí arriba te vemos remar." },
    { acto: 10, texto: "Siete de nosotras fuimos las primeras. Volvimos para ver si todavía disparabas." },
    { acto: 11, texto: "El Sol también fue chico. También tuvo un vidrio. Nadie se acuerda." },
    { acto: 11, texto: "Si lo apagas, no quedará en el cielo nada más grande que tú. Piensa si eso es lo que quieres." }
  ];

  /* Los ecos del sin fin: cartas que llegan después del Sol, ya sin
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
    "Quizás el alba sea solo la luz que todavía no alcanzaste.",
    "La Hoguera se volvió a encender. Siempre hay fanales cansados.",
    "Las que nacieron mirándote ya tienen crías. También te miran.",
    "Los cascos se hunden despacio. Tú no te detengas.",
    "Cada brasa que juntas es un jefe que no pudo apagarte.",
    "Ahora vuelas más rápido que nosotras. Igual te alcanzamos en los sueños.",
    "No hay otra orilla. Hay muchas, y todas son esta.",
    "Volvieron todos, más grandes. Así se ve la noche cuando la luz más vieja eres tú.",
    "El Sol se apagó y nadie lo extraña. Algún día dirán lo mismo de ti."
  ];

  /* Los encuentros grandes: nombre, epíteto (la tarjeta con que se
     presentan) y la línea que queda cuando caen. El Faro, el Alba, la
     Hoguera y el Sol no tienen línea propia: después de ellos viene la
     revelación o un final. */
  const JEFES = {
    nodriza: { nombre: "LA NODRIZA", epiteto: "Madre del enjambre", cae: "El enjambre se dispersa. Por un rato, el cielo es tuyo." },
    faro: { nombre: "EL FARO CIEGO", epiteto: "Gira sin ver", cae: "" },
    esfinge: { nombre: "LA ESFINGE", epiteto: "La más vieja de la noche", cae: "La Esfinge se apagó sin ruido. En el cielo queda una sola luz: la tuya." },
    alba: { nombre: "EL ALBA", epiteto: "Viene hacia ti", cae: "" },
    casco: { nombre: "EL CASCO", epiteto: "Se hundió encendido", cae: "El casco se hundió del todo. Su llama tardó en apagarse; bajo el agua, mucho más." },
    crisalida: { nombre: "LA CRISÁLIDA", epiteto: "Lo que todavía no nace", cae: "El capullo se abrió. Lo que salió te miró un momento y voló hacia atrás, hacia la noche que ya cruzaste." },
    hoguera: { nombre: "LA HOGUERA", epiteto: "Adonde van todos los fanales", cae: "" },
    luna: { nombre: "LA LUNA", epiteto: "La primera luz que siguieron", cae: "La Luna se fue por el borde del cielo. El mar bajó despacio, como quien suelta algo." },
    constelacion: { nombre: "LAS SIETE HERMANAS", epiteto: "Las primeras que apagaste", cae: "Las Siete Hermanas se dispersaron. Cada una volvió a su sitio en el cielo, un poco más lejos de ti." },
    sol: { nombre: "EL SOL", epiteto: "El fanal más viejo", cae: "" }
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
  /* La línea que se agrega si en la jornada 7 no apagaste ninguna de las
     polillas que brillan solas. */
  const FINAL_PIEDAD = "Las que no apagaste volaban a tu lado.";
  /* La moraleja que no se dice como moraleja, y la orden que abre la
     segunda parte. */
  const FINAL_CIERRE = "El alba no era un lugar. Era otra luz que viajaba hacia la tuya.";
  const FINAL_ORDEN = "SIGUE.";

  /* La pista de la Hoguera: lo único que se dice de cómo se gana. */
  const AVISO_HOGUERA = "No todo lo que arde en ella es ella.";
  /* El final de la segunda parte, al apagar la Hoguera. Tercer giro: no
     había un lugar adonde llegar. La travesía sigue hacia arriba. */
  const FINAL_HOGUERA = [
    "La Hoguera se apagó despacio, como se duerme alguien.",
    "Los fanales que ardían en ella se soltaron.",
    "Cada uno tomó un rumbo distinto.",
    "Ninguno hacia el mismo sitio.",
    "Las polillas se repartieron entre todas las luces.",
    "Por primera vez, no te seguían solo a ti."
  ];
  /* La línea que se agrega si liberaste a todos los fanales de la Hoguera. */
  const FINAL_HOGUERA_LIBRES = "Los que soltaste te alumbraron un rato el camino. Después, cada uno el suyo.";
  const FINAL_HOGUERA_CIERRE = "No había un lugar al que llegar. Pero arriba, algo seguía encendido.";
  const FINAL_HOGUERA_ORDEN = "SIGUE. HACIA ARRIBA.";

  /* La pista del Sol: lo único que se dice de cómo se gana. */
  const AVISO_SOL = "A la sombra de un casco, ni el Sol te alcanza.";
  /* El final de la historia, al apagar el Sol. Último giro: el Sol era un
     fanal, el primero, y ahora el más viejo eres tú. Por eso, después, los
     jefes vuelven (fase 2 y 3): ahora vienen hacia tu luz. */
  const FINAL_SOL = [
    "El Sol no se apagó de golpe.",
    "Se fue achicando, hasta caber en un vidrio.",
    "Adentro había una mecha, consumida casi hasta el fondo.",
    "Había sido un fanal.",
    "El primero. El que nadie apagó.",
    "Ahora, en todo el cielo, queda una sola luz encendida."
  ];
  const FINAL_SOL_CIERRE = "Todo lo que te seguía se dio vuelta a mirarte. Ahora el fanal más viejo eres tú.";
  const FINAL_SOL_ORDEN = "SIGUE. TODOS VUELVEN.";

  /* Los augurios: lo que la noche aprende cada jornada (ver motor.js). Se
     anuncian en el tránsito, una línea, para que se sepa qué cambió. */
  const AUGURIOS = {
    rafaga: "Disparan más seguido.",
    veloz: "Las escamas caen más rápido.",
    marcha: "La formación marcha más rápido.",
    punteria: "Te apuntan mejor.",
    picada: "Se lanzan en picada más seguido.",
    furia: "Los grandes atacan más seguido.",
    enjambre: "Caben más escamas en el aire.",
    coraza: "Aguantan un golpe más."
  };
  const AUGURIO_PRE = "La noche aprende:";

  /* El taller: lo que se compra con las brasas (una por jefe vencido). Cada
     mejora tiene tres niveles; `d` dice lo que hace cada uno. */
  const RAMAS = { arma: "LA LLAMA", nave: "EL FANAL" };
  const MEJORAS = {
    cadencia: { nombre: "Mecha corta", d: ["Disparas más seguido.", "Más seguido, y un tiro más en el aire.", "Lo más seguido que arde una mecha."] },
    fuerza: { nombre: "Llama viva", d: ["Los tiros afinados hacen más daño.", "Los tiros sin afinar también.", "Los afinados, todavía más."] },
    perfora: { nombre: "Punta de vidrio", d: ["Cada tiro atraviesa una cosa más.", "Los tiros afinados entran más hondo.", "Todos atraviesan una más."] },
    abanico: { nombre: "Pabilo trenzado", d: ["Dos tiros por disparo.", "Tres tiros, en abanico.", "Cuatro tiros, en abanico ancho."] },
    remo: { nombre: "Remos largos", d: ["Remas más rápido.", "Más rápido.", "Lo más rápido que va una barca."] },
    vidrio: { nombre: "Vidrio templado", d: ["Empiezas cada jornada con la campana puesta.", "La campana se rehace sola (40 s).", "Se rehace antes (25 s)."] },
    aceite: { nombre: "Reserva de aceite", d: ["Una llama más de tope.", "Otra más.", "Otra más."] },
    iman: { nombre: "Luz larga", d: ["Más luz; los poderes vienen hacia ti y duran más.", "Más.", "Más."] }
  };
  const LLAMA_TALLER = { nombre: "Encender una llama", d: "Recupera una llama perdida, por dos brasas." };
  /* Las evoluciones: cada tres niveles en una rama, el arma o el fanal
     cambian de nombre, de forma y de lo que pueden. */
  const EVOLUCIONES = {
    arma: [
      { nombre: "Chispa", d: "Una llama chica dentro de un vidrio." },
      { nombre: "Brasa", d: "Los tiros afinados atraviesan una cosa más." },
      { nombre: "Antorcha", d: "Los tiros afinados sueltan dos chispas a los costados." },
      { nombre: "Faro", d: "Los tiros afinados lo atraviesan todo." },
      { nombre: "Estrella", d: "Todos tus tiros hacen un punto más de daño." }
    ],
    nave: [
      { nombre: "Barca", d: "Una barca con un farol encima." },
      { nombre: "Fanal de bronce", d: "Una llama más de tope." },
      { nombre: "Luciérnaga", d: "Una de las que te siguen vuela contigo y se lleva las escamas." },
      { nombre: "Doble vidrio", d: "La campana vuelve sola aunque no tengas vidrio templado." },
      { nombre: "Faro errante", d: "Dos luciérnagas, y cada cuarenta y cinco segundos un pulso que barre las escamas cercanas." }
    ]
  };

  /* Lo que se lee cuando el fanal se apaga. Una al azar: la noche no
     consuela, pero tampoco se repite. */
  const APAGADO = [
    "La noche no se dio cuenta.",
    "Nadie vio apagarse la luz.",
    "Las polillas se quedaron un rato, por si volvía.",
    "El vidrio quedó tibio un momento. Después, nada.",
    "En algún lugar, una estrella menos. Esta vez fuiste tú."
  ];

  /* Lo que se ve en el HUD del sin fin donde antes decía la distancia
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

  /* La entrada de bitácora de cualquier jornada: las veinte de la
     historia tal cual, y las del sin fin en círculo con su número delante. */
  function bitacora(n) {
    if (n >= 1 && n <= BITACORA.length) return BITACORA[n - 1];                 // historia
    const k = (n - BITACORA.length - 1) % BITACORA_SINFIN.length;              // posición en el círculo
    return "Jornada " + n + ". " + BITACORA_SINFIN[(k + BITACORA_SINFIN.length) % BITACORA_SINFIN.length];
  }

  /* El índice del próximo fragmento que puede caer en este acto, o -1 si
     ya se tienen todos los que el acto permite (los actos van en el orden
     de la travesía, 1–4 y después 6–11; el sin fin, 5, no tiene cartas). `tenidos` es un conjunto
     (o arreglo) de índices ya recuperados. Se dan en orden: la carta X no
     llega antes que la IX, porque la IX explica a la X. */
  function fragmentoSiguiente(tenidos, acto) {
    if (acto === 5) return -1;
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
    TITULO, SUBTITULO, INTRO, ACTOS, ACTO_SINFIN, PARTE_DOS, PARTE_TRES, BITACORA, BITACORA_SINFIN,
    FRAGMENTOS, ECOS, JEFES, REVELACION, AVISO_ALBA, FINAL, FINAL_PIEDAD,
    FINAL_CIERRE, FINAL_ORDEN, APAGADO, SIGUIENTE_LUZ, actoInfo,
    AVISO_HOGUERA, FINAL_HOGUERA, FINAL_HOGUERA_LIBRES, FINAL_HOGUERA_CIERRE, FINAL_HOGUERA_ORDEN,
    AVISO_SOL, FINAL_SOL, FINAL_SOL_CIERRE, FINAL_SOL_ORDEN,
    AUGURIOS, AUGURIO_PRE, RAMAS, MEJORAS, LLAMA_TALLER, EVOLUCIONES,
    romano, bitacora, fragmentoSiguiente, ecoSiguiente
  };
});
