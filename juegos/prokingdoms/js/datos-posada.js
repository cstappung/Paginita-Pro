// pk-84 (plan Hacha y Pico, P6–P7, propuesta aceptada por el dueño): la Posada de los Viajeros. Tablas: los viajeros
// (retrato con PK.Retratos, oficio, lo que les gusta pedir y su historia en 5 capítulos), los visitantes ilustres, los
// números del tablero, la Diligencia y la Feria. Solo el cliente las usa (el servidor no carga este archivo); el
// edificio vive en data.js como todos. Reglas de diseño (plan §10.1): nada castiga la ausencia, el premio se ve antes
// de entregar y todo sale de una semilla (recargar no cambia un pedido).
(function () {
  'use strict';
  const D = window.PK.D;

  D.POSADA = {
    lugares: L => Math.min(9, 6 + Math.floor(L / 3)),       // pedidos a la vez en el tablero
    cada: L => Math.round(Math.max(6, 12 - 0.6 * (L - 1)) * 60), // segundos entre viajeros
    despedir: 600,                 // un lugar despedido se vuelve a llenar a los 10 min
    valor: era => 50 * Math.pow(1.6, era - 1),     // valor (en oro de mercado) de un pedido común
    paga: 0.6,                     // un pedido paga en oro esta parte de lo que vale (más la fama y algo de monedas); poco, por el antitrampa (LIM.resSlack)
    monedasDia: 30,                // monedas del reino por día, como mucho, de los pedidos comunes
    dilCada: 4 * 3600,             // la Diligencia sale cada 4 h de reloj real
    dilCajas: 9,
    capitulos: [1, 3, 6, 10, 15],  // entregas a un viajero para cada capítulo de su historia
    fama: [0, 8, 25, 50, 90, 140, 210, 300, 420, 560], // fama total para cada nivel (abre viajeros y pedidos)
    feriaPasos: 30,
    feriaPaso: k => 4 + Math.floor(k / 5), // fama de la semana para pasar del escalón k−1 al k
  };
  // lo que se puede pedir y a partir de qué era (y si hace falta un edificio que lo produzca)
  D.POSADA_RES = [
    { r: 'food', era: 1 }, { r: 'wood', era: 1 }, { r: 'stone', era: 1 }, { r: 'gold', era: 2 },
    { r: 'planks', era: 2, b: 'sawmill' }, { r: 'ore', era: 3 }, { r: 'blocks', era: 3, b: 'masonry' }, { r: 'ingots', era: 3, b: 'smelter' },
    { r: 'tools', era: 3, b: 'forge' }, { r: 'books', era: 3, b: 'scriptorium' }, { r: 'marble', era: 4 }, { r: 'gems', era: 4 },
    { r: 'steel', era: 4, b: 'steelworks' }, { r: 'machinery', era: 5, b: 'workshop' },
  ];

  // Viajeros: clase (ropa del retrato), col (su color), fama (nivel desde el que llegan), gusta (lo que más piden).
  const V = (id, nombre, oficio, clase, mujer, col, fama, gusta, historia) => ({ id, nombre, oficio, clase, mujer, col, fama, gusta, historia });
  D.VIAJEROS = [
    V('mirta', 'Mirta', 'herrera enana', 'ingeniera', true, [170, 90, 50], 0, ['ingots', 'stone', 'tools'], [
      'Vengo de las montañas del este. Mi fragua se apagó y busco hierro para encenderla de nuevo.',
      'Con lo que me diste forjé un yunque nuevo. Suena como campana. ¡Mi abuela lloraría de envidia!',
      'Encontré a mi primo Borin en tu mercado. Me debía tres martillos desde hace veinte años.',
      'Los enanos de mi clan quieren conocer tu reino. Les dije que aquí se paga justo y se come mejor.',
      'Vuelvo a casa. Dejé mi marca en tu Centro Urbano: una runa que dice «aquí hay amigos». No la borres.',
    ]),
    V('tadeo', 'Tadeo', 'juglar', 'juglar', false, [200, 60, 80], 0, ['food', 'wood'], [
      'Canto por comida. Y por leña, que las noches en el camino son largas.',
      'Compuse una canción sobre tu reino. Rima «madera» con «primavera». No es mi mejor obra.',
      'Busco a mi hermana Lía. Se fue con una compañía de teatro hace diez inviernos.',
      '¡Alguien en el puerto la vio! Dicen que ahora toca el laúd en una corte del sur.',
      'La encontré. Cantamos juntos en tu plaza y lloró hasta el herrero. Gracias, majestad.',
    ]),
    V('ines', 'Inés', 'botánica', 'guarda', true, [86, 150, 70], 0, ['food', 'wood'], [
      'Estudio las plantas de cada reino. Las tuyas crecen torcidas, pero con ganas.',
      'Descubrí un musgo que solo crece detrás de tus graneros. Lo llamaré Musgo Real.',
      'Tus leñadores me dejan las cortezas raras. Ya tengo cuarenta y dos frascos.',
      'Mi libro de plantas tendrá un capítulo entero sobre tus bosques. Y uno sobre tus cabras.',
      'El libro está terminado. La primera copia es tuya; la segunda, de las cabras.',
    ]),
    V('ruperto', 'Ruperto', 'mercader de telas', 'juglar', false, [90, 70, 150], 0, ['gold', 'food'], [
      'Vendo telas finas. Bueno, vendía. Unos bandidos se llevaron mi carreta.',
      'Con tu ayuda compré una mula. Se llama Duquesa y muerde a quien regatea.',
      'Duquesa y yo abrimos un puesto en tu mercado. Ella cobra, yo sonrío.',
      'Los bandidos que me robaron ahora me compran capas. El mundo da vueltas.',
      'Tengo tres carretas y una mula con mal genio. Todo empezó en tu posada.',
    ]),
    V('olga', 'Olga', 'cantera retirada', 'ingeniera', true, [140, 140, 150], 1, ['stone', 'blocks'], [
      'Treinta años partiendo piedra. Ahora quiero construirme una casita. Con piedra, claro.',
      'Ya tengo los cimientos. Mis vecinos dicen que es demasiado sólida. ¡Es una casa, no un queso!',
      'Le agregué una torre. Pequeña. Para mirar el atardecer y vigilar a los vecinos.',
      'Mi nieta quiere ser cantera como yo. Le regalé mi martillo y un sermón de dos horas.',
      'La casita está lista. Tiene tu escudo tallado en la puerta. Ven a tomar sopa cuando quieras.',
    ]),
    V('fabian', 'Fabián', 'monje copista', 'clerigo', false, [236, 228, 200], 1, ['books', 'planks', 'gold'], [
      'Mi monasterio perdió su biblioteca en un incendio. Junto libros por todos los reinos.',
      'Este libro de tu taller tiene una mancha de tinta con forma de gato. Es perfecto.',
      'El abad está contento. Dice que la mitad de la biblioteca nueva viene de tu reino.',
      'Encontré entre tus libros un mapa viejo. Lo copié tres veces por si acaso.',
      'La biblioteca reabre. Hay un estante con tu nombre. Está un poco torcido, como todo lo nuestro.',
    ]),
    V('nuria', 'Nuria', 'capitana de barcazas', 'guarda', true, [60, 110, 170], 1, ['wood', 'planks', 'food'], [
      'Navego el río con mercancías. Mi barcaza hace agua, pero tiene carácter.',
      'Le cambié tres tablones. Ahora hace menos agua y más ruido.',
      'Llevé tu madera río abajo. Allá preguntan de qué reino viene tan buena leña.',
      'Me ofrecieron una barcaza nueva. La rechacé: la vieja y yo nos entendemos.',
      'Bauticé mi barcaza con el nombre de tu reino. Ojalá no se hunda: sería un mal presagio.',
    ]),
    V('gaspar', 'Gaspar', 'cocinero ambulante', 'juglar', false, [220, 140, 40], 1, ['food', 'gold'], [
      'Cocino en cada pueblo que visito. Necesito ingredientes y un público con hambre.',
      'Mi guiso de tu reino ganó un concurso. El jurado era mi tía, pero cuenta igual.',
      'Tus aldeanos hacen fila por mi pan. Uno vino cuatro veces disfrazado.',
      'Me piden la receta. El secreto es la comida de tus granjas y no decir nunca el secreto.',
      'Abro una fonda en tu reino. El plato del día se llama como tú. Es picante.',
    ]),
    V('ximena', 'Ximena', 'cartógrafa', 'guarda', true, [120, 100, 60], 2, ['planks', 'gold', 'books'], [
      'Dibujo mapas. Los de tu región están mal: ponen un lago donde hay un bosque.',
      'Recorrí tus fronteras. Tus exploradores me ayudaron, aunque uno se perdió dos veces.',
      'Encontré un camino viejo que nadie usaba. Ahora sale en mi mapa con una flecha enorme.',
      'Mi mapa de tu reino se vende en tres ciudades. Aparezco en la esquina, saludando.',
      'Hice un mapa solo para ti, con tus casas una por una. Si te equivocas de calle, es tu culpa.',
    ]),
    V('elias', 'Elías', 'alquimista', 'hechicero', false, [130, 80, 200], 2, ['gems', 'ore', 'gold'], [
      'Busco la piedra filosofal. Por ahora encontré tres piedras normales.',
      'Mezclé tus gemas con un poco de hierro. Explotó, pero de forma muy prometedora.',
      'Mi laboratorio está en una cueva cerca de aquí. Los murciélagos me ayudan con las cuentas.',
      'Logré convertir plomo en… plomo más brillante. Es un avance. Me dicen que es pulir.',
      'Renuncio a la piedra filosofal. Me quedo con tu reino: aquí el oro sale de trabajar.',
    ]),
    V('dulce', 'Dulce', 'pastelera', 'clerigo', true, [240, 170, 190], 2, ['food', 'gold'], [
      'Hago tortas para bodas. Hay una boda en el reino vecino y me falta casi todo.',
      'La torta tenía siete pisos. Los novios se comieron dos antes de la ceremonia.',
      'Ahora me encargan tortas para bautizos, cumpleaños y una para un caballo.',
      'El caballo dijo gracias. Bueno, relinchó. Lo tomo como gracias.',
      'Mi pastelería abre en tu plaza. La torta del primer día es gratis, para ti y tus maestros de obras.',
    ]),
    V('bruno', 'Bruno', 'domador de osos', 'guarda', false, [110, 80, 50], 2, ['food', 'wood'], [
      'Este es Pancho, mi oso. Es manso, salvo con la miel ajena.',
      'Pancho comió tres panales de tu granja. Te pido perdón y te pago en leña.',
      'Pancho aprendió a bailar. Tus aldeanos le tiran manzanas; él las atrapa con la boca.',
      'Un circo quiere comprar a Pancho. Le pregunté y dijo que no. Bueno, gruñó.',
      'Pancho y yo nos quedamos de guardianes del bosque. Si ves un oso bailando, saluda.',
    ]),
    V('celia', 'Celia', 'arquitecta', 'ingeniera', true, [180, 120, 70], 3, ['blocks', 'planks', 'stone'], [
      'Diseño puentes. Tu río merece uno que no se caiga cuando pasa una vaca.',
      'Hice los planos. Son muy bonitos. Ahora falta lo difícil: la piedra.',
      'El puente lleva tres arcos. El del medio lo dediqué a tus canteros.',
      'Una vaca cruzó el puente primero. No se cayó. Ni el puente ni la vaca.',
      'Mi puente sale en los libros de ingeniería. La vaca también.',
    ]),
    V('armando', 'Armando', 'caballero sin caballo', 'paladin', false, [214, 178, 70], 3, ['ingots', 'steel', 'food'], [
      'Mi caballo se fue con otro caballero. Más joven, más rico. Típico.',
      'Con tus lingotes me hicieron una armadura nueva. Hace mucho ruido al caminar.',
      'Salvé a una princesa. Bueno, a una gallina. Era muy importante para la princesa.',
      'Un caballo me siguió hasta tu posada. Creo que me eligió él a mí.',
      'Se llama Trueno. Es lento como la miel, pero leal. Ahora sí soy un caballero completo.',
    ]),
    V('lorena', 'Lorena', 'relojera', 'ingeniera', true, [160, 150, 120], 3, ['tools', 'ingots', 'gems'], [
      'Arreglo relojes. Tu reino mide el tiempo mirando el sol: ¡qué atraso tan encantador!',
      'Armé un reloj para tu Centro Urbano. Se adelanta los lunes; nadie sabe por qué.',
      'Ahora tus aldeanos llegan puntuales a trabajar. Algunos me odian.',
      'Hice un reloj de bolsillo con una gema tuya. Brilla cuando es hora de comer.',
      'Mi taller queda aquí. Si el reloj de la plaza se detiene, toca la campana dos veces y voy.',
    ]),
    V('tomas', 'Tomás', 'minero jubilado', 'ingeniera', false, [120, 90, 60], 3, ['ore', 'stone', 'tools'], [
      'Cuarenta años bajo tierra. Ahora quiero ver el cielo, pero me pica la nostalgia.',
      'Visité tu mina. Les enseñé a tus mineros a escuchar la roca antes de picarla.',
      'Me contaron que en el piso más hondo brilla algo. Yo no bajo: ya cumplí.',
      'Tallé una figurita de cada minero tuyo. Tienen la cara tiznada, como debe ser.',
      'Me quedo en tu reino. Aquí se ve el cielo y, si me pica la nostalgia, la mina queda cerca.',
    ]),
    V('sofia', 'Sofía', 'embajadora', 'clerigo', true, [100, 60, 120], 4, ['gold', 'books', 'marble'], [
      'Represento a un reino lejano. Venimos en son de paz y con muchas preguntas.',
      'Mi rey quiere saber cómo crecen tan rápido sus pueblos. Le diré que es el clima.',
      'Firmamos un acuerdo: ellos mandan especias, nosotros chistes. Ellos salen perdiendo.',
      'Me invitaron a quedarme como embajadora permanente. Pedí una ventana con vista al mercado.',
      'Mi reino y el tuyo son amigos para siempre. Tengo la carta firmada; la mancha es de sopa.',
    ]),
    V('quique', 'Quique', 'aprendiz de mago', 'hechicero', false, [80, 120, 200], 4, ['gems', 'books'], [
      'Mi maestro me mandó a buscar ingredientes. La lista dice «cosas brillantes».',
      'Hice un hechizo de luz. Iluminó la posada tres días. Nadie pudo dormir.',
      'Convertí una rana en príncipe. Era un príncipe convertido en rana; solo deshice el hechizo.',
      'Mi maestro dice que progreso. Me dio un sombrero más alto. Pica.',
      'Pasé el examen de mago. Mi primer hechizo oficial es para tu reino: buen tiempo los domingos.',
    ]),
    V('valentina', 'Valentina', 'escultora', 'clerigo', true, [222, 218, 206], 4, ['marble', 'stone', 'tools'], [
      'Esculpo en mármol. Me dijeron que tu reino tiene el mejor. Vengo a comprobarlo.',
      'Es cierto. Esculpí un caballo. Le salió cara de tu Maestro de Obras.',
      'Me encargaron una fuente para tu plaza. Echará agua por la boca de un pez muy serio.',
      'La fuente funciona. El pez escupe más lejos de lo previsto. Mojó a un embajador.',
      'Mi última obra es una estatua tuya. Te hice un poco más alto. De nada.',
    ]),
    V('ernesto', 'Ernesto', 'inventor', 'ingeniera', false, [200, 120, 50], 5, ['steel', 'machinery', 'tools'], [
      'Inventé una máquina para pelar papas. Pela papas, zapatos y, si te descuidas, dedos.',
      'Con tu acero la hice más segura. Ahora solo pela papas. Y a veces zapatos.',
      'Inventé un carro que anda solo. Anduvo solo hasta el río. Hay que mejorar los frenos.',
      'Tus ingenieros me ayudan. Discutimos mucho y comemos poco, como debe ser.',
      'Mi gran invento: una máquina que fabrica máquinas. Le puse tu nombre por si explota.',
    ]),
    V('clara', 'Clara', 'médica de caminos', 'clerigo', true, [200, 220, 230], 5, ['food', 'books', 'gems'], [
      'Curo a quien encuentro en el camino. Hoy fueron dos viajeros y una gallina coja.',
      'Tus aldeanos están sanos. Les receté comer verduras. Me odian un poco.',
      'Abrí un dispensario junto a tu posada. La primera paciente fue la posadera, que se quemó con sopa.',
      'Enseño a tus aldeanos a curar heridas. Ahora se vendan entre ellos por cualquier cosa.',
      'El dispensario se quedará para siempre. Lo cuidan dos aprendices y una gallina que ya no cojea.',
    ]),
    V('pancracio', 'Pancracio', 'coleccionista', 'juglar', false, [150, 100, 160], 6, ['gems', 'marble', 'machinery'], [
      'Colecciono cosas únicas de cada reino. Tengo una cuchara de cada corte.',
      'Tu gema más rara está en mi vitrina. La miro de noche y suspiro.',
      'Me falta algo de tu reino que nadie más tenga. ¿Un engranaje de tu taller, quizás?',
      'Mi colección tiene un salón entero dedicado a tu reino. Cobro entrada; te mando la mitad.',
      'Dono mi colección a tu reino. Me quedo con la cuchara, eso sí. Fue la primera.',
    ]),
    V('maya', 'Maya', 'domadora de grifos', 'guarda', true, [180, 150, 90], 7, ['food', 'gold', 'gems'], [
      'Mi grifo se llama Borrasca. Come como diez caballos y vuela como ninguno.',
      'Borrasca se posó en tu torre más alta. Tus vigías casi se mueren del susto.',
      'Llevo cartas volando entre tu reino y la costa. Llegan en un día, algo despeinadas.',
      'Borrasca puso un huevo. Nadie sabía que era hembra, ni yo.',
      'El polluelo nació en tu reino. Se llama como tu Centro Urbano. Es enorme y torpe.',
    ]),
    V('leon', 'León', 'viejo rey sin corona', 'paladin', false, [120, 60, 60], 8, ['gold', 'steel', 'books'], [
      'Fui rey de un reino que ya no existe. Ahora viajo ligero: sin corona, sin deudas.',
      'Tu reino me recuerda al mío en sus buenos años. Cuídalo de los consejeros aduladores.',
      'Te escribí un libro de consejos. El primero dice: «escucha a tu cocinero».',
      'Encontré a un antiguo súbdito en tu mercado. Me hizo una reverencia y me vendió nabos.',
      'Te dejo mi anillo de rey. No abre ninguna puerta, pero queda bien en las fotos de los pintores.',
    ]),
  ];
  D.ILUSTRES = [
    { id: 'reina', nombre: 'La Reina Viajera', titulo: 'de paso por tus tierras', clase: 'clerigo', mujer: true, col: [200, 170, 60], gusta: ['gold', 'gems', 'marble'] },
    { id: 'gran_maestre', nombre: 'El Gran Maestre', titulo: 'de la Orden del Yunque', clase: 'paladin', mujer: false, col: [150, 150, 170], gusta: ['steel', 'ingots', 'tools'] },
    { id: 'archimaga', nombre: 'La Archimaga Selene', titulo: 'de la Torre de Cristal', clase: 'hechicero', mujer: true, col: [90, 140, 230], gusta: ['gems', 'books'] },
    { id: 'almirante', nombre: 'El Almirante Ruiz', titulo: 'de la Flota del Sur', clase: 'guarda', mujer: false, col: [40, 70, 130], gusta: ['planks', 'wood', 'food'] },
    { id: 'abadesa', nombre: 'La Abadesa Inmaculada', titulo: 'del Monasterio Blanco', clase: 'clerigo', mujer: true, col: [240, 240, 230], gusta: ['books', 'food', 'gold'] },
    { id: 'principe', nombre: 'El Príncipe Errante', titulo: 'que busca un reino', clase: 'juglar', mujer: false, col: [170, 50, 70], gusta: ['blocks', 'marble', 'machinery'] },
  ];
})();
