/* ============================================================
   El manual de cada juego — el botón 📖 Reglas

   Un modal colgado de `<body>` en `position:fixed`, como el cartel del
   final: se abre desde la cabecera de la sala (a mitad de partida, que
   es cuando alguien pregunta «¿y esto qué hacía?») y desde cada tarjeta
   del vestíbulo, antes de abrir la sala.

   El texto describe **lo que hace el motor**, no lo que dice la caja:
   donde esta versión se aparta de la de mesa (el UNO no reparte de un
   mazo común, el cacho no tiene «ronda de salida», el Flip 7 no
   baraja) el manual cuenta lo que pasa aquí. Si cambia una regla en
   `motor.js`, cambia también aquí — un manual que miente es peor que
   ninguno.

   Los juegos con variantes (UNO, Flip 7, cacho) llevan una pestaña por
   variante, y se abre en la de la sala: quien está jugando al No Mercy
   no tiene por qué leerse antes el clásico entero.
   ============================================================ */

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Cada sección es `[título, html]`. El html es nuestro, no del usuario. */
const lista = xs => "<ul>" + xs.map(x => "<li>" + x + "</li>").join("") + "</ul>";

const UNO_COMUN = [
  ["El objetivo", "Quedarte sin cartas antes que nadie. Se juega una sola mano: quien suelta su última carta gana la partida."],
  ["Tu turno", lista([
    "Juega una carta que coincida con la de arriba del descarte en <b>color</b>, en <b>número</b> o en <b>símbolo</b>. Los comodines (negros) valen siempre, y al jugarlos eliges el color que sigue.",
    "Haz clic en la carta de tu mano; si hace falta elegir color o a quién, el panel de abajo te lo pregunta y la carta sale sola al completarlo."
  ])],
  ["¡UNO!", lista([
    "Cuando vayas a quedarte con <b>una sola carta</b>, activa <b>«¿Decir ¡UNO!?»</b> antes de jugar la penúltima.",
    "Si se te olvida, todavía puedes pulsar <b>¡UNO!</b> para arreglarlo… mientras nadie te pille.",
    "Cualquiera puede pulsar <b>¡Pillado!</b> sobre quien se olvidó, hasta que el siguiente jugador actúe: el despistado roba <b>2</b>."
  ])],
  ["Las cartas son secretas de verdad", "Cada uno roba de su propio mazo barajado con una semilla que solo conoce su navegador, así que nadie —ni la página— puede ver tu mano. Al terminar todos revelan la semilla y se comprueba la partida entera: quien haya hecho trampa aparece en rojo en todas las pantallas."]
];

const REGLAS = {
  orbita: {
    lema: "Duelo por capturar estrellas en una rejilla de 6×6.",
    secciones: [
      ["El objetivo", "Sumar más puntos que tu rival capturando estrellas. Cada estrella vale de 1 a 5."],
      ["Tu turno", lista([
        "Elige una estrella <b>iluminada</b>: solo valen las de la fila o la columna que te marcó tu rival (en la primera jugada, cualquiera).",
        "<b>Antes de capturar</b>, decide con los botones <b>↔ Fila</b> o <b>↕ Columna</b>: tu rival tendrá que jugar en esa línea, pasando por la estrella que acabas de tomar.",
        "Si esa línea ya no tiene estrellas libres, tu rival juega en «órbita libre»: cualquier estrella que quede."
      ])],
      ["El final", "Cuando se capturan las 36 estrellas, gana quien más puntos sume. Puede haber empate."],
      ["Consejo", "Lo importante no es solo lo que tomas, sino la línea que le dejas al otro: a veces conviene una estrella pequeña que lo manda a una fila vacía de cincos."]
    ]
  },
  escondite: {
    lema: "Esconde a tu persona en el paisaje y encuentra la del otro.",
    secciones: [
      ["1 · Esconder", lista([
        "Elige la ropa de tu persona y colócala en el paisaje, detrás de un árbol, entre rocas… donde menos se vea.",
        "Tienes un minuto y medio. Tu escondite queda sellado con un hash: tu rival no puede verlo hasta que los dos hayáis confirmado."
      ])],
      ["2 · Buscar", lista([
        "Los dos buscáis a la vez en el paisaje del otro. Arriba se dice qué ropa lleva la persona que buscas.",
        "Haz clic donde creas que está. Cada fallo te cuesta unos segundos de espera y te dice si vas <b>frío</b>, <b>templado</b> o <b>caliente</b>.",
        "A los 40 segundos aparece un círculo que rodea la zona del escondite, igual para los dos."
      ])],
      ["El final", "Gana quien encuentre primero a la persona del otro."]
    ]
  },
  cartas: {
    lema: "Card-Jitsu: fuego, agua y nieve.",
    secciones: [
      ["Cada ronda", lista([
        "Los dos eligen a la vez una carta de su mano, en secreto. Luego se destapan.",
        "<b>🔥 Fuego</b> gana a <b>❄ Nieve</b>, <b>❄ Nieve</b> gana a <b>💧 Agua</b> y <b>💧 Agua</b> gana a <b>🔥 Fuego</b>.",
        "Con el mismo elemento gana el número más alto; con el mismo número es empate y nadie se la lleva.",
        "Quien gana la ronda se queda su carta como trofeo."
      ])],
      ["Cómo se gana", lista([
        "Tres trofeos del <b>mismo elemento</b> y de <b>tres colores distintos</b>, o",
        "tres trofeos de <b>los tres elementos</b>, también de <b>tres colores distintos</b>."
      ])],
      ["Juego limpio", "Tu mano sale de una semilla que solo conoce tu navegador y la carta elegida viaja cifrada hasta que los dos han jugado. Al final se comprueba todo."]
    ]
  },
  cuadritos: {
    lema: "Puntos y cajas, de 2 a 10 jugadores.",
    secciones: [
      ["Tu turno", lista([
        "Traza <b>una raya</b> entre dos puntos vecinos (horizontal o vertical).",
        "Si con ella cierras el cuarto lado de una caja, la caja es tuya y <b>vuelves a jugar</b>. Puedes encadenar varias.",
        "Si no cierras nada, el turno pasa al siguiente."
      ])],
      ["El final", "Cuando no quedan rayas, gana quien más cajas tenga."],
      ["Consejo", "Evita trazar el tercer lado de una caja: se la regalas al siguiente. El marcador sigue el orden de la mesa para que sepas a quién le estás pasando la cadena."]
    ]
  },
  reversi: {
    lema: "Atrapa las fichas del otro entre las tuyas.",
    secciones: [
      ["Tu turno", lista([
        "Pon una ficha de modo que encierres, en línea recta (horizontal, vertical o diagonal), una o más fichas del rival entre la nueva y otra tuya.",
        "Todas las fichas encerradas se dan la vuelta y pasan a ser tuyas.",
        "Las casillas legales llevan un punto con el número de fichas que girarías."
      ])],
      ["Pasar", "Si no tienes ninguna jugada legal, pasas el turno automáticamente."],
      ["El final", "Cuando ninguno de los dos puede jugar, gana quien tenga más fichas en el tablero."]
    ]
  },
  cadena: {
    lema: "Chain Reaction: carga, estalla y conquista.",
    secciones: [
      ["Tu turno", lista([
        "Pon un orbe en una celda vacía o en una que ya sea tuya.",
        "Cada celda aguanta tantos orbes como vecinas tiene menos uno: <b>1</b> en las esquinas, <b>2</b> en los bordes y <b>3</b> en el centro."
      ])],
      ["La explosión", lista([
        "Cuando una celda llega a su masa crítica (2, 3 o 4 orbes) <b>estalla</b>: manda un orbe a cada vecina y las convierte a tu color.",
        "Si alguna vecina llega también a su masa crítica, estalla a su vez: es una reacción en cadena.",
        "Todas las celdas que llegan al límite en la misma oleada estallan a la vez."
      ])],
      ["El final", "Quien ya ha jugado y se queda sin orbes queda fuera. Gana el último color que quede en el tablero."]
    ]
  },
  flip7: {
    lema: "Pide carta o plántate: siete números distintos y te llevas el bono.",
    secciones: [
      ["Cada ronda", lista([
        "En tu turno eliges: <b>Pedir carta</b> o <b>Plantarte</b> (te quedas con lo que tienes y no juegas más en la ronda).",
        "Si te sale un número que <b>ya tienes</b>, te pasas: esa ronda no puntúas nada.",
        "Si reúnes <b>siete números distintos</b> haces <b>Flip 7</b>: +15 puntos y la ronda se cierra en el acto.",
        "La ronda termina cuando todos se han plantado o pasado."
      ])],
      ["Puntos y final", "Sumas tus números más los modificadores. La partida acaba al cerrar la ronda en la que alguien llega a <b>200</b>, y gana quien tenga más (con empate arriba, se juega otra ronda)."],
      ["Nadie baraja", "Cada carta sale de dos aportes secretos (el tuyo y el de otro jugador), así que nadie puede saber ni elegir la siguiente. Al final se comprueba todo."]
    ],
    modos: {
      normal: {
        nombre: "Normal",
        secciones: [
          ["La baraja", "94 cartas: un 0, un 1, dos 2… hasta doce 12; modificadores +2, +4, +6, +8, +10 y ×2; y tres de cada acción."],
          ["Modificadores", "Los +N se suman al final. El <b>×2</b> dobla solo tus números (no los +N ni el bono)."],
          ["Acciones", lista([
            "<b>Congelar</b>: el elegido se planta a la fuerza con lo que tenga.",
            "<b>Voltea tres</b>: el elegido tiene que robar tres cartas seguidas. Las acciones que salgan en medio se resuelven al final.",
            "<b>Segunda oportunidad</b>: te la guardas; si te sale un número repetido, se descartan las dos y sigues vivo. Solo puedes tener una: si te sale otra, se la regalas a alguien."
          ])]
        ]
      },
      venganza: {
        nombre: "Vengeance",
        secciones: [
          ["La baraja", "108 cartas: números del 0 al 13, modificadores negativos (−2…−10) y ÷2, y acciones para fastidiar."],
          ["Números especiales", lista([
            "<b>El Cero</b>: tu ronda vale 0 salvo que hagas Flip 7, y mientras lo tengas <b>no puedes plantarte</b> si quedan cartas.",
            "<b>El 7 gafe</b>: tira todos tus números y modificadores; te quedas solo con él.",
            "<b>El 13 de la suerte</b>: permite tener dos 13 sin pasarte."
          ])],
          ["Modificadores", "Se le ponen a otro jugador: los −N le restan y el <b>÷2</b> le parte los números por la mitad. La ronda nunca baja de 0."],
          ["Acciones", lista([
            "<b>Voltea cuatro</b>: el elegido roba cuatro cartas seguidas.",
            "<b>Una más</b>: el elegido roba una carta y se planta.",
            "<b>Cambia</b>: intercambias dos cartas de dos jugadores.",
            "<b>Roba</b>: le quitas una carta a otro y te la quedas (puede hacerte pasarte).",
            "<b>Tira</b>: descartas una carta de cualquiera."
          ])]
        ]
      },
      super: {
        nombre: "Super Vengeance",
        secciones: [
          ["Todo lo de Vengeance, y además", lista([
            "<b>Los 14</b>: catorce cartas (doce valen 14, una −14 y una 0). <b>Dos 14 cualesquiera</b> te hacen pasarte.",
            "<b>Cambio de manos</b>: intercambia la mano entera de dos jugadores (puedes ser uno de ellos).",
            "<b>Fulminar</b>: hace pasarse a otro jugador que siga en pie.",
            "<b>Comodín</b>: va a tu fila como el número del 0 al 14 que elijas (los que ya tienes salen tachados).",
            "Más Segundas oportunidades."
          ])],
          ["Nada se queda en cero", "Tu ronda y tu total pueden ser negativos. Si tu ronda suma exactamente 0 (te pasaste, te fulminaron…), los −N y el ÷2 que te pusieron <b>golpean a tu total</b>: por eso en este modo se le pueden poner a alguien que ya se pasó."],
          ["Flip 7 a elegir", "Al hacer Flip 7 decides: <b>+15 para ti</b> o <b>−15 al total de otro</b>."]
        ]
      }
    }
  },
  cacho: {
    lema: "Cacho chileno, modalidad de dudo.",
    secciones: [
      ["Lo básico", lista([
        "Cada uno tiene <b>cinco dados</b> en su vaso y solo ve los suyos.",
        "Por turnos se apuesta cuántos dados de una pinta hay <b>entre todos los vasos</b>: «cuatro quinas», «seis trenes»…",
        "Los <b>ases</b> son comodines: cuentan como cualquier pinta, salvo cuando se apuesta a ases."
      ])],
      ["Subir la apuesta", lista([
        "A una pinta <b>mayor</b> basta la misma cantidad; a una igual o menor hay que subir la cantidad.",
        "Pasar <b>a ases</b>: la mitad redondeando hacia arriba (de 7 quinas a 4 ases).",
        "Volver <b>de ases</b>: el doble más uno (de 3 ases a 7 de lo que sea).",
        "Abrir la ronda con ases solo puede quien tiene un dado."
      ])],
      ["Dudar y calzar", lista([
        "<b>Dudo</b>: crees que no hay tantos. Se levantan los vasos: si había menos, pierde un dado quien apostó; si había al menos esos, lo pierdes tú.",
        "<b>Calzo</b>: crees que hay <b>exactamente</b> esos. Si aciertas recuperas un dado (máximo cinco); si no, pierdes uno. Se puede calzar mientras quede en la mesa al menos la mitad de los dados iniciales.",
        "Abre la siguiente ronda quien perdió el dado (o quien calzó)."
      ])],
      ["El paso", "Una vez por ronda, con una apuesta en la mesa, puedes <b>pasar</b> en vez de subir: dices que tu vaso tiene todos los dados iguales, todos distintos o un full. El siguiente puede dudarte el paso: se mira solo tu vaso y pierde un dado quien se equivocó."],
      ["Obligar", "Quien se queda con <b>un dado</b>, al abrir, puede obligar una vez por partida (con tres o más en la mesa). Los ases dejan de ser comodín y se elige un modo: <b>abierto</b> (ves los dados de los demás, no los tuyos), <b>cerrado</b> (nadie ve nada y se apuesta «X de esta», la pinta del dado de quien obligó) o <b>torbellino</b> (elige una pinta y cada uno pierde los dados que le salgan de ella)."],
      ["El final", "Quien pierde su último dado queda fuera. Gana el último con dados en el vaso."]
    ],
    modos: {
      0: { nombre: "Normal", secciones: [["Partida normal", "Dudar o calzar cuesta siempre un dado."]] },
      1: { nombre: "Siciliana", secciones: [["Partida siciliana", "Dudar la <b>primera apuesta</b> de la ronda se paga doble: quien se equivoca pierde <b>dos dados</b>, sea el que dudó o el que abrió con una apuesta que no estaba. Castiga el farol de salida y el dudo por costumbre."]] }
    }
  },
  worms: {
    lema: "Artillería por turnos con cuadrillas de ingenieros.",
    secciones: [
      ["El objetivo", "Eliminar a las cuadrillas rivales. Cada ingeniero empieza con 120 de vida; gana la última cuadrilla con supervivientes."],
      ["Tu turno", lista([
        "Mueves a tu ingeniero con <b>A</b>/<b>D</b> y saltas con <b>W</b> (hay controles táctiles).",
        "Apuntas con el ratón o las flechas y cargas con <b>Espacio</b>: al soltar, disparas. Un disparo por turno.",
        "Teclas <b>1</b>–<b>9</b> y <b>0</b> para elegir arma. El turno tiene tiempo límite."
      ])],
      ["El terreno", lista([
        "Las explosiones rompen el suelo y dañan a aliados y rivales.",
        "El viento desvía los tiros. Los barriles explotan en cadena.",
        "Caer al agua elimina al instante, y desde la ronda 12 el agua sube."
      ])],
      ["Más ayuda", "Dentro del juego, el botón <b>?</b> abre el manual de campo completo."]
    ]
  },
  uno: {
    lema: "Cinco versiones del clásico, de 2 a 10 jugadores.",
    secciones: UNO_COMUN,
    modos: {
      clasico: {
        nombre: "Clásico",
        secciones: [
          ["Las cartas", lista([
            "Números del 0 al 9 en cuatro colores.",
            "<b>⊘ Salta</b>: el siguiente pierde el turno.",
            "<b>⇄ Invierte</b>: cambia el sentido (con dos jugadores equivale a saltar).",
            "<b>+2</b>: el siguiente roba dos y pierde el turno.",
            "<b>★ Comodín</b>: eliges color.",
            "<b>Comodín +4</b>: eliges color y el siguiente roba cuatro y pierde el turno."
          ])],
          ["Si no puedes (o no quieres) jugar", "Pulsa <b>Robar una</b>. Si la carta robada se puede jugar, puedes jugarla en ese momento; si no, <b>Pasar</b>. Solo vale esa carta, no otra de tu mano."],
          ["El reto del +4", "El +4 solo es legal si no tenías ninguna carta del color que había en la mesa. Quien lo recibe elige: <b>Robar 4</b>, o <b>¡Reto!</b>. Si el +4 era ilegal, lo roba quien lo jugó; si era legal, el que retó roba <b>6</b>. La mano la comprueba el navegador de quien jugó, y la auditoría final lo verifica."],
          ["Sin acumular", "En el clásico las cartas de robar no se acumulan: quien recibe un +2 roba y pierde el turno."]
        ]
      },
      nomercy: {
        nombre: "No Mercy",
        secciones: [
          ["Nada de piedad", lista([
            "Si no puedes jugar, <b>robas hasta que salga una carta jugable</b>, y tienes que jugarla.",
            "Con <b>25 cartas o más</b> quedas eliminado. Si solo queda uno en pie, gana."
          ])],
          ["Acumular", "Las cartas de robar se apilan: sobre un +2 puedes echar otro +2 o cualquiera de robar <b>de igual o mayor valor</b>, sin mirar el color, y la cuenta pasa al siguiente. Quien no puede (o no quiere) seguir la pila pulsa <b>Cargar</b> y se lleva todo."],
          ["Las cartas de color", lista([
            "<b>+2</b> y <b>+4</b> de color.",
            "<b>⊘ Salta</b>, <b>⇄ Invierte</b>, y <b>⊘⊘ Salta a todos</b>: vuelves a jugar tú.",
            "<b>✕ Descarta el color</b>: además de ella, tiras todas las cartas de ese color que quieras.",
            "<b>7</b>: cambias tu mano con la de quien elijas.",
            "<b>0</b>: todos pasan su mano al siguiente, en el sentido del juego."
          ])],
          ["Los comodines", lista([
            "<b>⇄+4 Invierte +4</b>: cambia el sentido y el siguiente (el de antes) roba 4.",
            "<b>+6</b> y <b>+10</b>.",
            "<b>🎡 Ruleta de color</b>: el siguiente elige un color y va robando hasta que le sale una carta de ese color."
          ])],
          ["Intercambios", "Los cambios de mano del 7 y del 0 viajan cifrados entre los dos jugadores: solo quien recibe la mano puede verla."]
        ]
      },
      nomercyx: {
        nombre: "No Mercy + expansión",
        secciones: [
          ["Todo lo del No Mercy, y además", lista([
            "<b>10</b> de cada color (un número más).",
            "<b>✕ Descarte total</b> (comodín): eliges color y tiras todas las cartas de ese color que quieras.",
            "<b>⇄+8 Invierte +8</b>: como el Invierte +4, pero ocho.",
            "<b>⚔ Ataque final</b>: enseñas tu mano; el siguiente roba una carta por cada carta <b>que no sea número</b>. Si enseñas 7 o más, el siguiente roba 25 (queda fuera) y todos los demás 5.",
            "<b>☠ Muerte súbita</b>: todos los que tengan menos de 24 cartas roban hasta tener 24."
          ])],
          ["Las monedas", lista([
            "Antes de empezar cada uno elige una moneda, que se usa <b>una sola vez</b>.",
            "<b>🕊 Piedad</b>: en tu turno tiras toda tu mano (y lo que te estuvieran cargando) y robas 7 nuevas.",
            "<b>💀 Sin piedad</b>: al jugar una carta de robar, <b>doblas</b> lo que roba el siguiente."
          ])]
        ]
      },
      allwild: {
        nombre: "All Wild",
        secciones: [
          ["Todo es comodín", "No hay colores ni números: cualquier carta se puede jugar sobre cualquier otra. Como siempre puedes jugar, nunca se roba por gusto."],
          ["Las cartas", lista([
            "<b>★ Comodín</b>: no hace nada más.",
            "<b>⊘ Salta</b> y <b>⊘² Salta a dos</b>.",
            "<b>⇄ Invierte</b>.",
            "<b>+2</b> y <b>+4</b>: el siguiente roba y pierde el turno.",
            "<b>◎+2 Diana</b>: eliges a quién le toca robar dos.",
            "<b>⇆ Intercambio forzado</b>: cambias tu mano con la de quien elijas."
          ])]
        ]
      },
      liar: {
        nombre: "Liar's",
        secciones: [
          ["Dos clases de cartas", lista([
            "Las cartas normales se juegan boca arriba, como en el clásico.",
            "Las marcadas con <b>🎭</b> son de mentiroso: se juegan <b>boca abajo</b> y anuncias lo que quieras que sean (siempre algo que se pudiera jugar sobre la mesa)."
          ])],
          ["¿Te lo crees?", lista([
            "Tras una carta boca abajo, el siguiente puede decir <b>Te creo</b> (la carta vale lo anunciado), y cualquiera puede gritar <b>¡Mientes!</b>.",
            "Si era verdad, quien dudó roba 1 y la carta hace su efecto.",
            "Si era mentira, el mentiroso recupera su carta, roba 1 y pierde el turno."
          ])],
          ["El reto del mentiroso (?)", lista([
            "Quien lo juega elige un color. Todos los demás tienen que poner una carta <b>boca abajo</b> diciendo que es de ese color.",
            "Luego quien retó <b>destapa</b> las que quiera, una a una: si la carta era de ese color, el reto se acaba; si no, su dueño la recupera y roba 1. Con <b>Basta</b> deja de destapar.",
            "Las cartas que no se destapan se quedan en el descarte. Si alguien se queda sin cartas así, gana."
          ])],
          ["Sin trampas", "Cada carta boca abajo queda sellada con un hash antes de destaparse, así que no se puede cambiar después."]
        ]
      }
    }
  },
  minas: {
    lema: "Mina Club: buscaminas para ti solo.",
    secciones: [
      ["El objetivo", "Abrir todas las casillas que no esconden una mina. El primer clic y sus vecinas siempre están libres."],
      ["Cómo se juega", lista([
        "<b>Clic</b> en una casilla para abrirla; los huecos vacíos se abren en cadena.",
        "Un número dice cuántas minas hay entre las ocho casillas que lo rodean.",
        "<b>Clic derecho</b>, tecla <b>F</b> o pulsación larga para poner una bandera. En el móvil, el selector <b>Descubrir · Bandera</b> sobre el tablero decide qué hace un toque; mantener pulsado hace siempre lo otro.",
        "Pulsa un número que ya tenga a su alrededor tantas banderas como indica para abrir el resto de vecinas de golpe (¡cuidado con las banderas mal puestas!)."
      ])],
      ["Clasificación", "Hay tres dificultades, y cada una guarda tu mejor tiempo."]
    ]
  },
  snake: {
    lema: "Snake Club: la serpiente de siempre, en cuatro modos.",
    secciones: [
      ["Cómo se juega", "Mueve la serpiente con las flechas o <b>WASD</b> (o deslizando el dedo). Cada fruta la alarga y suma puntos; chocar contra una pared o contra tu propia cola acaba la partida."],
      ["Los modos", lista([
        "<b>Clásico</b>: el de siempre.",
        "<b>Arcade</b>: poderes (escudo, cámara lenta, puntos dobles), frutas doradas que valen 50 y obstáculos.",
        "<b>Portales</b>: los bordes llevan al lado contrario y dos portales están conectados. Tu cola sigue siendo peligrosa.",
        "<b>Zen</b>: sin choques ni prisa; atraviesas paredes y tu cola."
      ])],
      ["Ritmo", "Tranqui, Normal o ¡A tope!: cada combinación de modo y ritmo tiene su propia clasificación."]
    ]
  }
};

const NOMBRES_SOLO = { minas: "Mina Club", snake: "Snake Club" };

export const tieneReglas = juego => Object.prototype.hasOwnProperty.call(REGLAS, juego);

let abierto = null;

/* Abre el manual de `juego`. `modo` elige la pestaña de la variante
   (la de la sala); sin él se abre la primera. `nombre` es el título
   (el de `JUEGOS`); los juegos para uno solo traen el suyo. */
export function abreReglas(juego, { modo, nombre } = {}) {
  const r = REGLAS[juego];
  if (!r) return;
  cierra();
  const modos = r.modos ? Object.keys(r.modos) : [];
  let actual = modos.length ? (modos.includes(String(modo)) ? String(modo) : modos[0]) : "";
  const previo = document.activeElement;
  const capa = document.createElement("div");
  capa.className = "jg-reglas-capa";
  capa.innerHTML = `
    <div class="jg-reglas" role="dialog" aria-modal="true" aria-labelledby="jgReglasT">
      <header class="jg-reglas-cab">
        <div><small>📖 Reglas</small><h2 id="jgReglasT">${esc(nombre || NOMBRES_SOLO[juego] || juego)}</h2><p>${r.lema}</p></div>
        <button type="button" class="jg-reglas-x" aria-label="Cerrar las reglas">✕</button>
      </header>
      ${modos.length ? `<div class="jg-reglas-tabs" role="tablist">${modos.map(m =>
        `<button type="button" role="tab" data-modo="${esc(m)}">${esc(r.modos[m].nombre)}</button>`).join("")}</div>` : ""}
      <div class="jg-reglas-cuerpo"></div>
      <footer class="jg-reglas-pie"><button type="button" class="btn jg-reglas-ok">Entendido</button></footer>
    </div>`;
  const cuerpo = capa.querySelector(".jg-reglas-cuerpo");
  const seccion = ([t, h]) => `<section><h3>${esc(t)}</h3>${h.startsWith("<") ? h : "<p>" + h + "</p>"}</section>`;
  const pinta = () => {
    /* La variante va primero: es lo que distingue esta sala; lo común
       (el objetivo, el ¡UNO!) viene detrás. */
    const propio = actual ? r.modos[actual].secciones : [];
    cuerpo.innerHTML = propio.map(seccion).join("") + r.secciones.map(seccion).join("");
    cuerpo.scrollTop = 0;
    for (const b of capa.querySelectorAll("[data-modo]")) {
      const si = b.getAttribute("data-modo") === actual;
      b.setAttribute("aria-selected", String(si));
      b.classList.toggle("on", si);
    }
  };
  for (const b of capa.querySelectorAll("[data-modo]"))
    b.onclick = () => { actual = b.getAttribute("data-modo"); pinta(); };
  const tecla = ev => { if (ev.key === "Escape") { ev.stopPropagation(); cierra(); } };
  capa.addEventListener("click", ev => { if (ev.target === capa) cierra(); });
  capa.querySelector(".jg-reglas-x").onclick = cierra;
  capa.querySelector(".jg-reglas-ok").onclick = cierra;
  document.addEventListener("keydown", tecla, true);
  document.body.appendChild(capa);
  pinta();
  abierto = { capa, tecla, previo };
  capa.querySelector(".jg-reglas-x").focus();
}

export function cierra() {
  if (!abierto) return;
  const { capa, tecla, previo } = abierto;
  abierto = null;
  document.removeEventListener("keydown", tecla, true);
  capa.remove();
  if (previo && typeof previo.focus === "function" && document.contains(previo)) previo.focus();
}
