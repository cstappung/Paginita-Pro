// Tablas de la Fase 3 del plan de la mega actualización, «Vida en el reino» (pk-18): el árbol de tecnologías 2.0
// (V1), las cartas de era (V2) y las estaciones (V3). Van aparte de data.js porque el servidor no las necesita:
// data.js lo carga también server/sim.js, y estos bonos solo le llegan como el margen LIM.vida (regla 4 del plan).
//
// Los efectos (`ef`) son claves que suma PK.Vida.bono(k) (js/vida.js), y cada una tiene un solo lugar donde se usa.
// Las claves de G.perk (gatherP, craftP, researchP, upgradeP, expSpeed, xpBoost) entran por G.perk, igual que los
// decretos. Las demás:
//   g_food g_wood g_stone g_mine g_gold   recolección de ese recurso (g_mine: piedra, oro, hierro, mármol y gemas)
//   berry hunt farm                       bayas, caza y granjas
//   c_<receta>                            producción de un taller (c_books, c_planks, c_ingots, c_tools…)
//   farmLvl                               niveles máximos extra de las granjas
//   capFood capAll                        tope de las bodegas (comida / todo)
//   road cartCap belt                     caminos, carga de carretas, ritmo de las cintas
//   sell buy                              mejor precio de venta / de compra en el Mercado
//   relic                                 oro de las reliquias
//   upSpeed build train cost              mejoras más rápidas, construcción, entrenar aldeanos, costo de obras (+ = caro)
//   fiesta                                descuento en la fiesta del pueblo
//   pve_all pve_<tropa> dragon            fuerza contra monstruos (solo PvE: Exp.powerVs, nunca Social.power)
//   bajas heroXp                          menos bajas en expediciones, experiencia de héroes
//   raidDef                               daño de torres y Centro Urbano a los bandidos de las incursiones
//   vision range dirigido                 visión de las torres, alcance de exploradores, exploradores dirigidos
//   slots_<edificio>                      puestos de trabajo extra
//   cola taberna mercader salas pociones  cola del Mayordomo, candidatos de la Taberna, mercader errante,
//                                         opciones de sala en las incursiones, pociones del Herbolario
(function () {
  'use strict';
  const PK = window.PK, D = PK.D;

  // ---------- V1. Árbol de tecnologías 2.0 ----------
  // Las 15 técnicas de D.TECHS siguen como «Fundamentos». El árbol desbloquea cosas. Cada era de la II a la IX tiene
  // un par enfrentado (`ex`): investigar uno bloquea al otro hasta la era siguiente. `lib` es el nivel de Biblioteca
  // que pide (la Biblioteca sigue fijando el ritmo). Costo y tiempo salen de la era (Vida.costoNodo / tiempoNodo).
  D.RAMAS = {
    eco: { name: 'Economía', icon: 'food', color: '#d8b04a' },
    ind: { name: 'Industria', icon: 'tools', color: '#c57a3a' },
    gue: { name: 'Guerra', icon: 'war', color: '#c4513f' },
    sab: { name: 'Saber', icon: 'flask', color: '#6a8fd0' },
  };
  D.ARBOL = {
    // Economía
    empedrado: { rama: 'eco', era: 2, name: 'Caminos empedrados', desc: 'Los caminos rinden ×1,5: aldeanos y carretas van más rápido sobre ellos.', ef: { road: 0.5 } },
    rotacion: { rama: 'eco', era: 2, ex: 'graneros', name: 'Rotación de cultivos', desc: 'Las granjas pueden subir 2 niveles más que el máximo de la era.', ef: { farmLvl: 2 } },
    graneros: { rama: 'eco', era: 2, ex: 'rotacion', name: 'Graneros comunitarios', desc: '+20% de tope de comida.', ef: { capFood: 0.2 } },
    arado: { rama: 'eco', era: 3, name: 'Arado de hierro', desc: '+15% de comida de las granjas.', ef: { farm: 0.15 } },
    acunada: { rama: 'eco', era: 4, name: 'Moneda acuñada', desc: 'En el Mercado vendes 5% más caro y compras 5% más barato.', ef: { sell: 0.05, buy: 0.05 } },
    bodegas: { rama: 'eco', era: 5, name: 'Bodegas reales', desc: '+10% de tope de todas las bodegas.', ef: { capAll: 0.1 } },
    cosechadoras: { rama: 'eco', era: 6, name: 'Cosechadoras', desc: '+15% de comida de las granjas y +10% de bayas.', ef: { farm: 0.15, berry: 0.1 } },
    archivo: { rama: 'eco', era: 9, ex: 'diplomacia', name: 'Archivo real', desc: 'La cola del Mayordomo admite 2 investigaciones más.', ef: { cola: 2 } },
    // Industria
    molinoagua: { rama: 'ind', era: 2, name: 'Molino de agua', desc: 'Un Aserradero a 4 casillas o menos del agua produce +25%.', ef: { aguaPlanks: 0.25 } },
    fuelles: { rama: 'ind', era: 3, name: 'Fuelles', desc: '+20% de lingotes en la Fundición.', ef: { c_ingots: 0.2 } },
    imprenta: { rama: 'ind', era: 4, ex: 'escribas', name: 'Imprenta', desc: 'Los Talleres de Copistas producen el doble de libros.', ef: { c_books: 1 } },
    escribas: { rama: 'ind', era: 4, ex: 'imprenta', name: 'Escribas devotos', desc: '+30% de oro de las reliquias y +20% de libros.', ef: { relic: 0.3, c_books: 0.2 } },
    altoshornos: { rama: 'ind', era: 5, ex: 'cintas', name: 'Altos hornos', desc: '+1 puesto de trabajo en cada Fundición y Acería.', ef: { slots_smelter: 1, slots_steelworks: 1 } },
    cintas: { rama: 'ind', era: 5, ex: 'altoshornos', name: 'Cintas reforzadas', desc: 'Las cintas transportadoras llevan ×1,5 y las carretas cargan +20%.', ef: { belt: 0.5, cartCap: 0.2 } },
    minas: { rama: 'ind', era: 6, name: 'Minas profundas', desc: '+15% de minería (piedra, oro, hierro, mármol y gemas).', ef: { g_mine: 0.15 } },
    polvora: { rama: 'ind', era: 6, ex: 'arqueria', name: 'Pólvora', desc: 'Las catapultas pasan a ser cañones: +40% de fuerza contra monstruos.', ef: { pve_catapult: 0.4 } },
    // Guerra
    vigias: { rama: 'gue', era: 2, name: 'Vigías', desc: 'Las torres ven 2 casillas más lejos.', ef: { vision: 2 } },
    herraduras: { rama: 'gue', era: 3, ex: 'arcos', name: 'Herraduras', desc: 'Expediciones 10% más rápidas, y +15% de fuerza de los caballeros contra monstruos.', ef: { expSpeed: 0.1, pve_knight: 0.15 } },
    arcos: { rama: 'gue', era: 3, ex: 'herraduras', name: 'Arcos compuestos', desc: '+20% de fuerza de los arqueros contra monstruos.', ef: { pve_archer: 0.2 } },
    adiestramiento: { rama: 'gue', era: 4, name: 'Adiestramiento', desc: '+20% de experiencia de las tropas.', ef: { xpBoost: 0.2 } },
    murallas: { rama: 'gue', era: 5, name: 'Saeteras', desc: 'Torres y Centro Urbano hacen +25% de daño a los bandidos que asaltan tu pueblo.', ef: { raidDef: 0.25 } },
    arqueria: { rama: 'gue', era: 6, ex: 'polvora', name: 'Arqueros de élite', desc: '+30% de fuerza de los arqueros contra monstruos y +10% al resto.', ef: { pve_archer: 0.3, pve_all: 0.1 } },
    medicina: { rama: 'gue', era: 7, ex: 'doctrina', name: 'Medicina de campaña', desc: '−20% de bajas en las expediciones.', ef: { bajas: 0.2 } },
    doctrina: { rama: 'gue', era: 7, ex: 'medicina', name: 'Doctrina', desc: '+25% de experiencia de los héroes.', ef: { heroXp: 0.25 } },
    asedio: { rama: 'gue', era: 7, name: 'Ingenieros de asedio', desc: '+10% de fuerza contra monstruos.', ef: { pve_all: 0.1 } },
    // Saber
    escuelas: { rama: 'sab', era: 2, name: 'Escuelas', desc: '+5% de investigación.', ef: { researchP: 0.05 } },
    cartografia: { rama: 'sab', era: 3, name: 'Cartografía avanzada', desc: 'Un explorador dirigido más (banderas de exploración) y +4 casillas de alcance.', ef: { dirigido: 1, range: 4 } },
    academia: { rama: 'sab', era: 5, name: 'Academia', desc: '+10% de investigación y mejoras 5% más rápidas.', ef: { researchP: 0.1, upSpeed: 0.05 } },
    astronomia: { rama: 'sab', era: 8, ex: 'alquimia', name: 'Astronomía', desc: 'Una opción de sala más en cada piso de las incursiones.', ef: { salas: 1 } },
    alquimia: { rama: 'sab', era: 8, ex: 'astronomia', name: 'Alquimia', desc: 'Las pociones del Herbolario salvan el doble.', ef: { pociones: 1 } },
    granbiblioteca: { rama: 'sab', era: 8, name: 'Gran biblioteca', desc: '+10% de investigación.', ef: { researchP: 0.1 } },
    diplomacia: { rama: 'sab', era: 9, ex: 'archivo', name: 'Diplomacia', desc: 'Encargos del tablón con +20% de premio y el mercader errante pasa el doble.', ef: { misiones: 0.2, mercader: 1 } },
  };
  for (const id in D.ARBOL) D.ARBOL[id].lib = Math.max(1, D.ARBOL[id].era - 1);

  // ---------- V2. Cartas de era ----------
  // Al llegar a cada era (de la II en adelante) se eligen 1 de 3 cartas. La mano sale con semilla de la partida y la
  // era: recargar no cambia las cartas. En las Eras VII y X la mano son los decretos (D.DECREES), las cartas reales.
  // `al` hace algo una sola vez al elegirla (Vida.CARTA_AL).
  D.CARTAS = {
    fiebre: { name: 'Fiebre del oro', desc: '+30% oro, −10% comida.', ef: { g_gold: 0.3, g_food: -0.1 } },
    brazos: { name: 'Brazos fuertes', desc: '+15% madera y piedra.', ef: { g_wood: 0.15, g_stone: 0.15 } },
    oficios: { name: 'Escuela de oficios', desc: '+20% talleres, −10% recolección.', ef: { craftP: 0.2, gatherP: -0.1 } },
    puertas: { name: 'Puertas abiertas', desc: 'Mercado 8% mejor para vender y comprar, −10% de defensa ante incursiones.', ef: { sell: 0.08, buy: 0.08, raidDef: -0.1 } },
    muros: { name: 'Muros altos', desc: '+30% de defensa ante incursiones, mejoras 10% más lentas.', ef: { raidDef: 0.3, upSpeed: -0.1 } },
    sangre: { name: 'Sangre joven', desc: 'Los aldeanos se entrenan 30% más rápido.', ef: { train: 0.3 } },
    veteranos: { name: 'Veteranos', desc: '+1 rango a todas tus tropas.', al: 'rango' },
    fertil: { name: 'Tierra fértil', desc: '+2 niveles máximos a las granjas.', ef: { farmLvl: 2 } },
    mapas: { name: 'Mapas antiguos', desc: 'Revela las 2 mazmorras más cercanas que no conoces.', al: 'mazmorras' },
    patronazgo: { name: 'Patronazgo', desc: '+1 candidato en la Taberna cada día.', ef: { taberna: 1 } },
    fiestas: { name: 'Fiestas populares', desc: 'Las fiestas del pueblo cuestan 30% menos.', ef: { fiesta: 0.3 } },
    mercaderes: { name: 'Mercaderes amigos', desc: 'El mercader errante pasa el doble.', ef: { mercader: 1 } },
    arquitectos: { name: 'Arquitectos del rey', desc: 'Mejoras 15% más rápidas, obras 10% más caras.', ef: { upSpeed: 0.15, cost: 0.1 } },
    cazadragones: { name: 'Cazadores de dragones', desc: '+25% de fuerza contra dragones.', ef: { dragon: 0.25 } },
    bibliotecarios: { name: 'Bibliotecarios', desc: '+20% de investigación.', ef: { researchP: 0.2 } },
    hachas: { name: 'Hachas del norte', desc: '+25% madera, −10% piedra.', ef: { g_wood: 0.25, g_stone: -0.1 } },
    canteros: { name: 'Canteros', desc: '+20% minería, −10% madera.', ef: { g_mine: 0.2, g_wood: -0.1 } },
    pastores: { name: 'Pastores y cazadores', desc: '+30% caza y +15% bayas.', ef: { hunt: 0.3, berry: 0.15 } },
    caravanas: { name: 'Caravaneros', desc: 'Carretas con +30% de carga y caminos ×1,3.', ef: { cartCap: 0.3, road: 0.3 } },
    herreros: { name: 'Herreros', desc: '+30% herramientas y +20% lingotes.', ef: { c_tools: 0.3, c_ingots: 0.2 } },
    copistas: { name: 'Copistas', desc: '+30% libros.', ef: { c_books: 0.3 } },
    peregrinaje: { name: 'Peregrinaje', desc: '+40% oro de las reliquias.', ef: { relic: 0.4 } },
    audaces: { name: 'Exploradores audaces', desc: '+6 casillas de alcance de exploración.', ef: { range: 6 } },
    guerra: { name: 'Escuela de guerra', desc: '+15% de fuerza contra monstruos, −5% recolección.', ef: { pve_all: 0.15, gatherP: -0.05 } },
    cirujanos: { name: 'Cirujanos', desc: '−20% de bajas en las expediciones.', ef: { bajas: 0.2 } },
    gesta: { name: 'Cantares de gesta', desc: '+30% de experiencia de los héroes.', ef: { heroXp: 0.3 } },
    reales: { name: 'Caminos reales', desc: 'Expediciones 15% más rápidas.', ef: { expSpeed: 0.15 } },
    profundas: { name: 'Bodegas profundas', desc: '+15% de tope de todas las bodegas.', ef: { capAll: 0.15 } },
    llenos: { name: 'Graneros llenos', desc: '+25% de tope de comida.', ef: { capFood: 0.25 } },
    albaniles: { name: 'Gremio de albañiles', desc: 'Las obras nuevas se levantan 30% más rápido.', ef: { build: 0.3 } },
    recaudadores: { name: 'Recaudadores', desc: '+15% oro, aldeanos 10% más lentos de entrenar.', ef: { g_gold: 0.15, train: -0.1 } },
  };

  // ---------- V3. Estaciones ----------
  // Salen del reloj real: una cada 6 horas (Vida.estacion). Bonos suaves (decisión pendiente 1 del plan: sin consumo
  // de comida en invierno, para no castigar al que se va 12 horas).
  D.ESTACION_H = 6;
  D.ESTACIONES = [
    { id: 'primavera', name: 'Primavera', icon: '🌸', desc: '+15% granjas y bayas.', ef: { farm: 0.15, berry: 0.15 } },
    { id: 'verano', name: 'Verano', icon: '☀️', desc: '+10% de recolección.', ef: { gatherP: 0.1 } },
    { id: 'otono', name: 'Otoño', icon: '🍂', desc: '+20% caza y madera.', ef: { hunt: 0.2, g_wood: 0.2 } },
    { id: 'invierno', name: 'Invierno', icon: '❄️', desc: '−20% granjas, +20% minería: se trabaja bajo techo.', ef: { farm: -0.2, g_mine: 0.2 } },
  ];

  // Tope del multiplicador de recolección que pueden sumar árbol, cartas y estación juntos (Vida.recoleccion). El
  // servidor tiene el mismo número como LIM.vida (server/sim.js): la prueba de prokingdoms.test.cjs los compara.
  D.VIDA_TOPE = 1.6;
})();
