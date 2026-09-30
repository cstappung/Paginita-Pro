import { montarGuia } from "./reglas-guia.js";

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

   Los juegos con variantes (UNO, Flip 7, cacho, Catan) llevan una pestaña por
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
    lema: "Lanza sondas con la gravedad: roba estrellas y derriba satélites.",
    secciones: [
      ["El objetivo", "Sumar más puntos que los demás capturando estrellas. Una estrella normal vale 1; cerca de un planeta o del sol vale 2 o 3, y las <b>novas</b> (poco comunes) valen 5."],
      ["Tu turno", lista([
        "Apunta desde tu base: arrastra en el campo (la distancia es la fuerza) o usa los deslizadores de <b>ángulo</b> y <b>potencia</b>, y pulsa <b>🚀 Lanzar</b>.",
        "Solo se ve el primer tramo de la trayectoria: el resto depende de cómo la curven el sol y los planetas.",
        "Tu sonda vuela un rato y se queda en el campo como <b>satélite</b>: en cada turno siguiente (el tuyo y el de los demás) sigue moviéndose y capturando estrellas para ti, hasta que se le acaba la vida (el arco que la rodea)."
      ])],
      ["Choques", lista([
        "Si una sonda nueva toca un satélite de otro jugador, <b>los dos revientan</b> y quien lanzó gana <b>+3</b> por el derribo. Dos satélites viejos de distinto dueño que se tocan también revientan, sin puntos para nadie.",
        "Los satélites en órbita enseñan en puntos su camino del próximo turno: es lo que te deja apuntarles.",
        "Lo que cae en el sol o en un planeta, o sale del campo, se pierde."
      ])],
      ["El cielo", "Cuando se capturan estrellas aparecen otras nuevas, siempre en los mismos sitios para todos. El sol y los planetas salen de la semilla de la sala."],
      ["El final", "Cada jugador lanza un número fijo de sondas (7 en duelo, 6 con tres, 5 con cuatro). Cuando todos han lanzado las suyas, gana quien más puntos tenga. Puede haber empate."],
      ["Consejo", "Una órbita cerrada alrededor del sol sigue sumando turno tras turno, pero es un blanco fácil. Una pasada rápida por un racimo de estrellas cobra ya y no deja nada que derribar."]
    ]
  },
  escondite: {
    lema: "Esconde a tu persona en el paisaje y encuentra la del otro.",
    secciones: [
      ["1 · Esconder", lista([
        "Cada uno tiene su escena: una playa, un mercado, una feria, una estación de esquí o un campamento, llenos de gente.",
        "Viste a tu persona con un <b>gorro</b>, una <b>camiseta</b> y lo que lleva en la mano (nada, mochila, globo o bastón). Nadie de la multitud lleva tu combinación entera, pero muchos comparten dos prendas.",
        "Colócala donde menos se vea: entre gente parecida, detrás de un puesto, en el agua (solo asoman cabeza y hombros)… Lo que tengas justo delante tapa tus piernas, nunca la cabeza.",
        "Tienes un minuto y medio. Tu escondite queda sellado con un hash: tu rival no puede verlo hasta que los dos hayáis confirmado."
      ])],
      ["2 · Buscar", lista([
        "Los dos buscáis a la vez en la escena del otro, con su cartel de <b>SE BUSCA</b> a la vista.",
        "Con ratón, una lupa amplía lo que tienes debajo. También puedes hacer zoom y desplazarte.",
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
      ["El paso", "Una vez por ronda, con una apuesta en la mesa, puedes <b>pasar</b> en vez de subir: dices que tienes <b>exactamente cinco dados</b>, todos iguales, todos distintos o un full. Puedes decir «paso» aunque tengas menos o no cumplas la combinación; si te dudan, pierdes un dado. El siguiente puede dudarte el paso: se mira solo tu vaso y pierde un dado quien se equivocó."],
      ["Obligar", "Quien se queda con <b>un dado</b>, al abrir, puede obligar una vez por partida. <b>Torbellino también está permitido en 1 contra 1</b>; abierto y cerrado requieren tres o más. Los ases dejan de ser comodín y se elige un modo: <b>abierto</b> (ves los dados de los demás, no los tuyos), <b>cerrado</b> (nadie ve nada y se apuesta «X de esta», la pinta del dado de quien obligó) o <b>torbellino</b> (elige una pinta y cada uno pierde los dados que le salgan de ella)."],
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
            "<b>🎡 Ruleta de color</b>: quien la tira no pide color; el siguiente elige uno y va sacando cartas de una en una (un clic cada una, o en el mazo) hasta que le sale una de ese color. Todas se quedan en su mano, y si llega a 25 queda fuera."
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
  spicy: {
    lema: "Faroles picantes: de 2 a 6 jugadores, gana quien consiga dos trofeos.",
    secciones: [
      ["Las cartas", lista([
        "Números del 1 al 10 en tres especias: <b>🌶 ají</b>, <b>🍃 wasabi</b> y <b>⚫ pimienta</b>.",
        "<b>Comodín de especia</b>: vale por cualquier especia, pero no tiene número. <b>Comodín de número</b>: vale por cualquier número, pero no tiene especia.",
        "Cada uno empieza con 6 cartas."
      ])],
      ["Tu turno", lista([
        "Juegas una carta <b>boca abajo</b> y dices qué es. Puede ser mentira.",
        "Con la pila vacía abres con un 1, 2 o 3 de la especia que quieras. Después hay que decir la <b>misma especia</b> y un número <b>mayor</b>; sobre un 10 se vuelve a empezar del 1 al 3 en esa especia.",
        "Si no quieres o no puedes, <b>pasas</b>: robas una carta y sigue el siguiente."
      ])],
      ["Dudar", lista([
        "Cualquiera puede dudar de la última carta, del <b>número</b> o de la <b>especia</b> (no de las dos).",
        "Se destapa sola. Si mentía, quien dudó se lleva la pila: un punto por carta. Si era verdad, se la lleva quien la jugó y quien dudó roba dos.",
        "Dudar de lo que un comodín no tiene (el número de un comodín de especia, por ejemplo) es acertar siempre."
      ])],
      ["Trofeos y final", lista([
        "Si juegas tu última carta y nadie la desmiente, ganas un <b>trofeo</b> 🏆 y robas 6 nuevas. <b>Dos trofeos</b> ganan la partida.",
        "El mazo tiene un <b>Fin del Mundo</b>: después del reparto se cuentan las cartas robadas y, al llegar al límite de la mesa (30 con dos, 5 más por cada jugador), la partida se acaba.",
        "Entonces gana quien más puntos tenga: cartas ganadas + 10 por trofeo − cartas en la mano."
      ])],
      ["Sin trampas", "Cada uno roba de un mazo propio que solo su navegador conoce, y cada carta jugada queda sellada con un hash: nadie puede cambiarla después ni ver la mano de otro. Al final todos revelan su semilla y la mesa comprueba cada carta; a quien mintió se le marca en rojo."]
    ]
  },
  tetris: {
    lema: "Tetris a la vez: de 2 a 8 pozos, gana el último en pie.",
    secciones: [
      ["Cómo se juega", lista([
        "Todos reciben las <b>mismas piezas</b> en el mismo orden; cada uno juega en su propio pozo.",
        "<b>← →</b> mover · <b>↑ o X</b> girar · <b>Z</b> girar al revés · <b>↓</b> bajar rápido · <b>Espacio</b> soltar · <b>C o Mayús</b> guardar una pieza. En el móvil, los botones de abajo.",
        "Cada 30 segundos sube el nivel y las piezas caen más rápido."
      ])],
      ["Basura", lista([
        "Las líneas que limpias mandan <b>basura</b> al siguiente jugador en pie: un doble manda 1, un triple 2 y un Tetris 4; los T-Spin, los combos y el <i>back-to-back</i> suman más, y una limpieza total manda 10.",
        "La barra roja al lado de tu pozo es la basura que te espera. Limpiar líneas antes de que caiga la cancela."
      ])],
      ["El final", "Cuando una pieza ya no cabe, quedas fuera. El último que sigue apilando gana la sala."],
      ["Para practicar", "Tetris Club, en la portada, tiene Maratón, Sprint de 40 líneas y Ultra de dos minutos para jugar solo."]
    ]
  },
  yemas: {
    lema: "Shooter de huevos en primera persona, de 2 a 8 jugadores, en tres modos.",
    secciones: [
      ["Controles", lista([
        "Haz click en el juego para capturar el mouse; <b>Esc</b> lo suelta.",
        "<b>WASD</b> o flechas para moverte, <b>Espacio</b> para saltar, el mouse para mirar.",
        "<b>Click</b> dispara, <b>R</b> recarga, <b>1 2 3</b> o la rueda cambian de arma y <b>Tab</b> muestra la tabla."
      ])],
      ["Las armas", lista([
        "<b>1 · Batidora</b>: automática, 30 balas, 17 de daño.",
        "<b>2 · Revuelta</b>: escopeta de 9 perdigones; de cerca fríe de un tiro, de lejos pierde fuerza.",
        "<b>3 · Poché</b>: francotirador. <b>Click derecho</b> para la mira; 90 de daño al cuerpo y fríe de un tiro a la cabeza."
      ])],
      ["Vida y muerte", lista([
        "Tienes 100 de vida. La parte de arriba del huevo es la cabeza y ahí el daño sube.",
        "Al morir vuelves a los tres segundos, lo más lejos posible de tus rivales, con un segundo y medio de protección."
      ])],
      ["Chat de voz", lista([
        "Arriba del juego está <b>🎙 Entrar a la voz</b>. La primera vez el navegador pide permiso para el micrófono.",
        "Por defecto se habla <b>manteniendo apretada la V</b>; en la barra se puede cambiar a micrófono abierto, y <b>🔈</b> silencia a los demás.",
        "La voz va directo de navegador a navegador, sin pasar por el sitio. Si dos redes no dejan una conexión directa (pasa con algunas de celular), ese par no se oye y su nombre sale en rojo."
      ])],
      ["Sin servidor", "Cada navegador decide si lo alcanzaron y anota su propia muerte en el registro. Nadie puede anotarse una baja que no le dieron, pero un navegador modificado podría no morirse: es el mismo límite honesto del resto de los juegos."],
      ["Para practicar", "El juego suelto (<code>juegos/yemas/</code>) se juega contra cuatro bots, todos contra todos."]
    ],
    modos: {
      todos: { nombre: "Todos contra todos", secciones: [["Todos contra todos", "Cada uno por su cuenta. Gana el primero que llega a la meta de bajas: 10, 15 o 25 según el largo que eligió quien abrió la sala."]] },
      equipos: { nombre: "Duelo por equipos", secciones: [["Duelo por equipos", lista([
        "Rojo contra azul: los asientos se reparten alternados, así que los equipos quedan parejos.",
        "Las bajas suman para el equipo; gana el que llega primero a 20, 30 o 50.",
        "No hay fuego amigo: las balas atraviesan a los compañeros. Cada equipo aparece en su mitad del mapa.",
        "Si un equipo se queda sin nadie, gana el otro."
      ])]] },
      bandera: { nombre: "Captura la bandera", secciones: [["Captura la bandera", lista([
        "Cada equipo tiene su bandera en su base: la roja al norte y la azul al sur.",
        "Pasa por encima de la bandera rival para tomarla y llévala a tu base. <b>Solo se captura si la tuya está en casa.</b>",
        "Quien muere con la bandera la suelta donde cayó. Si es la tuya, tócala para devolverla; si nadie la toca, vuelve sola a los 25 segundos.",
        "Gana el equipo que captura 1, 3 o 5 banderas, según el largo de la partida."
      ])]] }
    }
  },
  clue: {
    lema: "Un crimen en el edificio, de 2 a 6 detectives.",
    secciones: [
      ["El objetivo", "En el sobre del patio hay tres cartas: <b>quién</b>, <b>con qué</b> y <b>dónde</b>. Gana el primero que acusa y acierta las tres."],
      ["Antes de empezar", lista([
        "Cada jugador elige su personaje; los sospechosos que falten hasta seis se sortean entre los que nadie eligió.",
        "Las 21 cartas que no están en el sobre se reparten entre todos. Tus cartas no son el culpable: táchalas en la <b>libreta</b>."
      ])],
      ["Las armas", "Son nueve, todas de Electricidad, y cada sala empieza con una: la <b>Carta de Smith</b>, la <b>Transformada de Fourier</b>, la <b>Resistencia</b>, el <b>Capacitor</b>, el <b>Inductor</b>, el <b>Transistor</b>, la <b>Fuente de poder</b>, el <b>Amplificador operacional</b> y el <b>Diodo LED</b>. Toca un arma en el tablero para ver qué hace, y al final el arma del crimen muestra cómo fue."],
      ["Tu turno", lista([
        "Tira los dos dados y avanza como mucho esa cantidad de casillas por el pasillo. Las fichas tapan su casilla. Entrar en una sala termina el movimiento, y no puedes volver a la sala de la que saliste en el mismo turno.",
        "Desde el <b>mirador</b> la <b>escalera</b> baja al hall azul, y desde los <b>lockers</b> el <b>montacargas</b> llega a la bodega: usarlos reemplaza a los dados.",
        "Si otro jugador te trajo a una sala con su sugerencia, en tu turno puedes sugerir ahí mismo sin moverte."
      ])],
      ["Sugerir", lista([
        "Al entrar en una sala puedes sugerir un sospechoso y un arma <i>en esa sala</i>. Los dos vienen a la sala.",
        "Los demás, en orden, dicen si tienen alguna de las tres cartas. El primero que tenga te enseña <b>una</b>, solo a ti; los demás solo ven que te enseñó algo.",
        "Si nadie tiene ninguna, es una pista enorme."
      ])],
      ["Acusar", "Cuando creas saberlo, acusa (en tu turno, cuando quieras). Si aciertas, ganas. Si no, quedas fuera: ya no juegas turnos, pero sigues enseñando cartas cuando te lo pidan. Si solo queda uno sin acusar mal, gana ese."],
      ["Sin servidor, sin trampas", lista([
        "Nadie reparte: la baraja se mezcla y se reparte cifrada con póquer mental (SRA), así que nadie, ni quien abre la sala, sabe las cartas de los demás ni lo que hay en el sobre. Al empezar hay unos segundos de «barajando».",
        "La carta que enseñas viaja cifrada solo para quien sugirió.",
        "Al terminar, todos revelan su semilla y cada pantalla rehace la partida entera: si alguien dijo «no tengo» teniendo, o enseñó una carta que no era suya, sale su nombre.",
        "El límite honesto: si alguien se va a mitad de partida sin revelar su semilla, sus cartas y el sobre quedan cerrados para siempre y la partida se anula."
      ])],
      ["Para practicar", "El juego suelto (<code>juegos/clue/</code>) se juega contra bots, sin sala."]
    ]
  },
  presidente: {
    lema: "El «culo»: de 3 a 10 jugadores, ronda tras ronda y sin final fijo.",
    secciones: [
      ["El objetivo", "Quedarte sin cartas antes que nadie. El orden en que se acaba da los papeles de la ronda siguiente: el primero es el <b>Presidente</b> 👑, el segundo el <b>Vicepresidente</b> 🎩, el penúltimo el <b>Viceculo</b> 🧹 y el último el <b>Culo</b> 💩; el resto es Pueblo."],
      ["Las cartas", lista([
        "Del <b>2</b> (la más baja) al <b>A</b> (la más alta normal): 2 3 4 5 6 7 8 9 10 J Q K A. Los palos no cuentan.",
        "Hay <b>dos jokers</b> en total. Con más de ocho se usan dos barajas normales más esos dos jokers (106 cartas; en mesa pequeña, 54).",
        "Se reparte todo el mazo; a unos les puede tocar una carta más que a otros."
      ])],
      ["Tu turno", lista([
        "Con la mesa limpia abres con cartas <b>del mismo número</b> (hasta cuatro; hasta ocho con dos barajas). También puedes abrir con uno o dos jokers.",
        "Sobre la mesa hay que poner <b>la misma cantidad</b> de cartas y de un número <b>más alto</b>. Si no puedes o no quieres, pasas.",
        "Cada baza da <b>una sola vuelta</b>: cada jugador juega o pasa una vez, incluido quien abre.",
        "Al terminar esa vuelta se limpia la mesa y abre quien puso la jugada más alta. Ejemplo: 1 → 2 → 3; si 3 supera, abre 3. Si pasa y la mayor era de 2, abre 2. Si el ganador se quedó sin cartas o salió, abre el siguiente con cartas.",
        "Ni el A ni el joker limpian al instante: se completa la vuelta.",
        "Si no tienes con qué superar la mesa, la pantalla pasa por ti."
      ])],
      ["Los comodines", lista([
        "Un <b>joker solo</b> supera cualquier simple o par. Los <b>dos juntos</b> superan también un trío. Se juegan solos, sin mezclarlos con cartas normales.",
        "La baza conserva su tamaño: un joker sobre un par sigue siendo una baza de pares.",
        "Solo <b>otro joker</b> supera un joker, respetando el tamaño de la baza. No sirven contra grupos de cuatro o más."
      ])],
      ["El cambio de cartas", lista([
        "Desde la segunda ronda, el Culo da sus <b>dos mejores cartas</b> al Presidente, y este le devuelve dos que elija. El Viceculo da <b>una</b> al Vicepresidente, que le devuelve una.",
        "Las mejores las da la pantalla sola: no hay nada que decidir. Lo que devuelves sí lo eliges tú; si tardas mucho, van las más bajas.",
        "El Presidente abre la ronda y los asientos se ordenan por los papeles."
      ])],
      ["Una mesa que no se acaba", lista([
        "Entre ronda y ronda puede sentarse gente nueva o levantarse quien quiera: los papeles de la ronda anterior se conservan para los que siguen.",
        "Quien pide levantarse a media ronda la termina; quien llega a media ronda espera a la siguiente.",
        "Hacen falta al menos tres para repartir.",
        "Cada ronda da puntos: tantos como jugadores quedan detrás de ti.",
        "Cuando la mitad de la mesa vota <b>✋ Acabar la partida</b>, se termina y gana quien más puntos tenga."
      ])],
      ["Nadie reparte con trampa", "No hay crupier: cada uno baraja con su candado y luego lo quita, así que nadie sabe las cartas de los demás. Las cartas del cambio viajan en sobres cerrados. Al acabar cada ronda se revelan las llaves y todos comprueban que nadie jugó cartas que no tenía; quien hizo trampa sale en rojo."],
      ["Si alguien se duerme", "Pasado un rato aparece <b>Saltarle</b>: en su turno pasa por él; en el reparto o el cambio se le levanta de la ronda. También se le puede echar con ⏏."]
    ]
  },
  catan: {
    lema: "Coloniza la isla, comercia y construye hasta llegar a la meta.",
    secciones: [
      ["El objetivo", "Llegar a la meta de <b>puntos de victoria</b> en tu turno: 10 en el juego base, 12 con Navegantes (más o menos según la sala; la cifra está arriba, junto a la bandera 🏁). Cada <b>poblado</b> vale 1, cada <b>ciudad</b> 2, y hay puntos extra por la ruta más larga, el mayor ejército y las cartas de punto de victoria."],
      ["La colocación", lista([
        "Cada uno coloca <b>un poblado y un camino</b> junto a él, y luego lo mismo en orden inverso: el último en poner el primero pone también el segundo.",
        "Un poblado nunca puede estar a un paso de otro (ni tuyo ni ajeno).",
        "Con el <b>segundo</b> poblado recibes una carta de cada terreno que toca.",
        "Quién empieza lo decide el azar entre todos, no quien abrió la sala."
      ])],
      ["Tu turno", lista([
        "<b>Tira los dados.</b> Cada terreno con ese número da una carta a cada poblado que lo toca y dos a cada ciudad: <b>bosque</b> madera, <b>colinas</b> arcilla, <b>pastos</b> lana, <b>campos</b> trigo y <b>montañas</b> mineral. El desierto no da nada.",
        "Después, en el orden que quieras: <b>comercia</b>, <b>construye</b> y <b>juega</b> una carta de desarrollo. Termina con <b>Terminar el turno</b>.",
        "Costes: camino = madera + arcilla · poblado = madera + arcilla + lana + trigo · ciudad = 2 trigo + 3 mineral (sustituye a un poblado) · carta de desarrollo = lana + trigo + mineral.",
        "Caminos y poblados tienen que tocar tu red. Hay 15 caminos, 5 poblados y 4 ciudades por jugador."
      ])],
      ["El siete y el ladrón", lista([
        "Con un <b>7</b> nadie produce. Quien tenga <b>más de 7 cartas</b> descarta la mitad (redondeando hacia abajo).",
        "Quien tiró mueve el <b>ladrón</b> a otro terreno, que deja de producir mientras esté ahí, y roba una carta al azar a alguien con un edificio al lado."
      ])],
      ["Comerciar", lista([
        "Con la <b>banca</b>: 4 cartas iguales por 1 cualquiera. Un <b>puerto 3:1</b> mejora eso a 3 de lo que sea; un <b>puerto 2:1</b>, a 2 de su recurso. Para usarlo tienes que tener un poblado o ciudad en él.",
        "Con la <b>mesa</b>: en tu turno ofreces un trato; los demás lo aceptan o no, y tú eliges con quién cerrarlo. Quien no tiene el turno puede <b>proponerte</b> otro trato."
      ])],
      ["Cartas de desarrollo", lista([
        "<b>Caballero</b>: mueve el ladrón y roba. Se puede jugar antes de tirar.",
        "<b>Construcción de carreteras</b>: dos caminos (o barcos) gratis.",
        "<b>Año de la abundancia</b>: dos recursos de la banca, los que quieras.",
        "<b>Monopolio</b>: eliges un recurso y todos te dan todas sus cartas de ese recurso.",
        "<b>Punto de victoria</b>: vale un punto, en secreto. Se revela solo cuando te da la victoria.",
        "Una carta por turno como mucho, y nunca la comprada en ese mismo turno."
      ])],
      ["Puntos especiales", lista([
        "<b>Ruta comercial más larga</b> (+2): el primero con 5 tramos seguidos. Otro se la quita al superarla; un poblado ajeno en medio la corta.",
        "<b>Mayor ejército</b> (+2): el primero con 3 caballeros jugados. Se pierde si alguien juega más."
      ])],
      ["Cinco o seis jugadores", lista([
        "La isla crece a 30 terrenos, con más puertos y más cartas de desarrollo.",
        "<b>Fase especial de construcción</b>: al acabar cada turno, los demás, en orden, pueden construir o comprar cartas (sin comerciar ni jugarlas). A quien no le llega para nada se le salta solo."
      ])],
      ["Variantes de la sala", lista([
        "<b>Baraja de eventos</b>: en vez de dados, un mazo de 36 cartas con las 36 combinaciones de dos dados. Se rebaraja cuando quedan 5. La suerte se reparte más: al final sale todo.",
        "<b>Ladrón amistoso</b>: el ladrón (y el pirata) no pueden ir junto a quien tiene 2 puntos o menos, ni robarle.",
        "<b>Maestro del puerto</b> (+2): el primero que suma 3 puntos de puerto (poblado en puerto 1, ciudad 2), y quien le supere después. La meta sube un punto.",
        "<b>Partida corta o larga</b>: la meta baja o sube dos puntos."
      ])],
      ["Lo que es distinto aquí", lista([
        "No hay servidor que tire los dados: cada tirada junta una llave secreta de quien tira y otra de otro jugador (el siguiente en la mesa, o la víctima en un robo). Ninguno puede elegir el resultado. Si alguien no contesta, lo hace otro a los pocos segundos.",
        "Cada uno roba sus cartas de desarrollo de un mazo propio que solo ve su navegador, con las proporciones de la caja. Al acabar se revelan las semillas y se comprueba que cada carta jugada fuera la de verdad: quien mintió sale en rojo.",
        "La banca no se agota, y el mazo de desarrollo tampoco.",
        "Las cartas de recurso de los rivales se ven solo como un número, pero quien abra la consola del navegador podría contarlas: en la mesa de verdad también se pueden contar."
      ])]
    ],
    modos: {
      base: { nombre: "Base", secciones: [["La isla", "Diecinueve terrenos rodeados de mar, con nueve puertos en la costa. Con cinco o seis jugadores, treinta terrenos y once puertos."]] },
      mar: {
        nombre: "Navegantes",
        secciones: [
          ["Navegantes", lista([
            "La isla principal está rodeada de <b>islotes</b>. Todos empiezan en la principal; los islotes hay que alcanzarlos por mar.",
            "<b>Barco</b> = madera + lana. Va en un tramo junto al agua y tiene que enlazar con un edificio tuyo o con otro barco tuyo. Caminos y barcos solo se enlazan a través de un poblado o ciudad propios.",
            "Una vez por turno puedes <b>mover un barco abierto</b> (el del extremo de una línea, sin edificio propio detrás) a otro sitio válido. No el que botaste este turno.",
            "El primer poblado de cada jugador en cada islote da <b>+2 puntos</b>.",
            "El <b>río de oro</b> no da oro: quien lo toca elige el recurso que quiera (uno por poblado, dos por ciudad).",
            "Con un 7 o un caballero puedes mover el <b>ladrón</b> o el <b>pirata</b>. El pirata va por el mar: roba a quien tenga un barco al lado, y mientras esté ahí no se pueden botar ni mover barcos junto a él.",
            "La ruta comercial más larga cuenta caminos y barcos juntos.",
            "Se juega a 12 puntos."
          ])]
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
  tetrisclub: {
    lema: "Tetris Club: para ti solo, en tres modos.",
    secciones: [
      ["Cómo se juega", "<b>← →</b> mover · <b>↑ o X</b> girar · <b>Z</b> girar al revés · <b>↓</b> bajar rápido · <b>Espacio</b> soltar · <b>C</b> guardar · <b>P</b> pausa. Completa filas para limpiarlas."],
      ["Los modos", lista([
        "<b>Maratón</b>: hasta que el pozo se llene; el nivel sube cada 10 líneas.",
        "<b>Sprint</b>: 40 líneas lo más rápido posible. Cuenta el tiempo.",
        "<b>Ultra</b>: dos minutos para hacer tantos puntos como puedas."
      ])]
    ]
  },
  sortem: {
    lema: "sortEm: ordena la fila del 1 al N lo más rápido que puedas.",
    secciones: [
      ["Cómo se juega", "<b>← →</b> eligen un bloque · <b>Espacio</b> lo toma o lo suelta · <b>Enter</b> reinicia. Con un bloque tomado, <b>← →</b> lo cambian de lugar con su vecino. Al soltarlo, si queda pegado a su número consecutivo (el 4 justo después del 3) los dos se funden en un solo bloque que ya no se separa. Ganas cuando toda la fila es un bloque ordenado."],
      ["Los modos", lista([
        "<b>10 números</b>: del 1 al 10, para calentar.",
        "<b>20 números</b>: del 1 al 20, la fila entera de lado a lado.",
        "En la pantalla de inicio, <b>↑ ↓</b> (o un clic) cambian el modo."
      ])],
      ["Clasificación", "El reloj corre desde el primer movimiento. Cada modo tiene su propia clasificación por tiempo, y tu mejor marca sale en la Clasificación del sitio junto a tu nombre."]
    ]
  },
  snake: {
    lema: "Snake Club: la serpiente de siempre, en siete modos y cuatro tamaños.",
    secciones: [
      ["Cómo se juega", "Mueve la serpiente con las flechas o <b>WASD</b> (o deslizando el dedo). Cada fruta la alarga y suma puntos; chocar contra una pared, un muro o tu propia cola acaba la partida."],
      ["Los modos", lista([
        "<b>Clásico</b>: el de siempre.",
        "<b>Arcade</b>: poderes (escudo, cámara lenta, puntos dobles), combos, frutas doradas que valen 50 y obstáculos que van apareciendo.",
        "<b>Portales</b>: los bordes llevan al lado contrario y dos portales están conectados; cada 4 frutas los portales cambian de sitio.",
        "<b>Contrarreloj</b>: empiezas con 40 s; cada fruta suma 2,5 s y los relojes dorados, 6 s y 30 puntos. A cero, se acabó.",
        "<b>Espejo</b>: cada 5 frutas los controles se invierten (y vuelven). Al revés, cada fruta vale 15.",
        "<b>Laberinto</b>: cada 6 frutas pasas de nivel y aparecen muros nuevos (más un premio de 25 × nivel). Los bordes llevan al otro lado.",
        "<b>Zen</b>: sin choques ni prisa; atraviesas paredes y tu cola. No puntúa."
      ])],
      ["Tamaño y ritmo", "El mapa puede ser Chico, Mediano, Grande o Gigante, y cada combinación de modo y tamaño tiene su propia clasificación. El ritmo multiplica los puntos: Tranqui ×1, Normal ×2, ¡A tope! ×3."]
    ]
  }
};

const NOMBRES_SOLO = { minas: "Mina Club", snake: "Snake Club", tetrisclub: "Tetris Club", sortem: "sortEm" };

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
  let guia = null;
  const seccion = ([t, h]) => `<section><h3>${esc(t)}</h3>${h.startsWith("<") ? h : "<p>" + h + "</p>"}</section>`;
  const pinta = () => {
    /* La variante va primero: es lo que distingue esta sala; lo común
       (el objetivo, el ¡UNO!) viene detrás. */
    const propio = actual ? r.modos[actual].secciones : [];
    guia?.destruir();
    cuerpo.innerHTML = '<div class="jg-reglas-visual"></div><h3 class="jg-reglas-lectura">Las reglas, en detalle</h3>' + propio.map(seccion).join("") + r.secciones.map(seccion).join("");
    guia = montarGuia(cuerpo.querySelector(".jg-reglas-visual"), juego, actual);
    cuerpo.scrollTop = 0;
    for (const b of capa.querySelectorAll("[data-modo]")) {
      const si = b.getAttribute("data-modo") === actual;
      b.setAttribute("aria-selected", String(si));
      b.classList.toggle("on", si);
    }
  };
  for (const b of capa.querySelectorAll("[data-modo]"))
    b.onclick = () => { actual = b.getAttribute("data-modo"); pinta(); };
  const tecla = ev => {
    if (ev.key === "Escape") { ev.stopPropagation(); cierra(); }
    if (ev.key === "Tab") {
      const controles = [...capa.querySelectorAll('button:not([disabled]), select, a[href]')];
      const primero = controles[0], ultimo = controles[controles.length - 1];
      if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
    }
  };
  capa.addEventListener("click", ev => { if (ev.target === capa) cierra(); });
  capa.querySelector(".jg-reglas-x").onclick = cierra;
  capa.querySelector(".jg-reglas-ok").onclick = cierra;
  document.addEventListener("keydown", tecla, true);
  document.body.appendChild(capa);
  pinta();
  abierto = { capa, tecla, previo, destruirGuia: () => guia?.destruir() };
  capa.querySelector(".jg-reglas-x").focus();
}

export function cierra() {
  if (!abierto) return;
  const { capa, tecla, previo, destruirGuia } = abierto;
  abierto = null;
  document.removeEventListener("keydown", tecla, true);
  destruirGuia();
  capa.remove();
  if (previo && typeof previo.focus === "function" && document.contains(previo)) previo.focus();
}
