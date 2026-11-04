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
  // pk-19: el muelle (V9) llegó, y con él su nodo
  D.ARBOL.redes = { rama: 'eco', era: 3, name: 'Pesca con redes', desc: 'Los muelles de pesca rinden +30%.', ef: { muelle: 0.3 } };
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

  // ---------- V4. Ánimo del pueblo (pk-19) ----------
  // De 0 a 100 (Vida.animo, cada 10 s). En 50 no cambia nada; en 0 resta 10% y en 100 suma 15% a la recolección
  // (dentro del tope D.VIDA_TOPE) y a los talleres. Pasar de 80 trae un «Día feliz» como mucho cada 2 horas.
  D.ANIMO = { base: 50, malo: 0.1, bueno: 0.15, feliz: 80, felizCada: 2 * 3600 * 1000, decoTope: 25 };

  // ---------- V5. Bonos por cercanía ----------
  // a: el edificio que gana, b: el vecino (alguno de la lista) a r casillas o menos, ef: cuánto (fracción, o +1 de
  // población para las casas). Una vez por regla, aunque haya varios vecinos. Se leen en G.cerca (game.js).
  D.CERCANIA = [
    { a: 'farm', b: ['mill'], r: 3, ef: 0.1, txt: '+10% de comida' },
    { a: 'muelle', b: ['mill'], r: 4, ef: 0.1, txt: '+10% de pesca' },
    { a: 'sawmill', b: ['lumber'], r: 3, ef: 0.1, txt: '+10% de tablones' },
    { a: 'smelter', b: ['mining'], r: 3, ef: 0.1, txt: '+10% de lingotes' },
    { a: 'forge', b: ['smelter'], r: 2, ef: 0.15, txt: '+15% de herramientas (los lingotes pasan directo)' },
    { a: 'scriptorium', b: ['library', 'monastery'], r: 3, ef: 0.1, txt: '+10% de libros' },
    { a: 'masonry', b: ['mining'], r: 3, ef: 0.1, txt: '+10% de sillares' },
    { a: 'house', b: ['plaza', 'fuente'], r: 1, ef: 1, txt: '+1 de población' },
  ];

  // ---------- V6. Maravillas 2.0 ----------
  // Lo que da cada una además del +3% a todo por nivel (BSTATS.wonder): ef(nivel) entra por Vida.bono. `fase` son los
  // nombres de lo que se ve crecer cada 5 niveles (sprites.js dibuja las etapas).
  D.MARAV = {
    m_faro: { ef: L => ({ sell: Math.min(0.1, 0.01 * L), vision: Math.min(8, Math.floor(L / 2)), range: Math.min(20, L) }), txt: L => '+' + Math.min(10, L) + '% de venta en el Mercado, torres +' + Math.min(8, Math.floor(L / 2)) + ' de visión y +' + Math.min(20, L) + ' casillas de exploración', fase: ['la base', 'la torre', 'la linterna', 'el espejo de bronce', 'la galería', 'la llama eterna', 'el halo'] },
    m_coloso: { ef: L => ({ pve_all: Math.min(0.4, 0.02 * L), raidDef: Math.min(0.5, 0.03 * L) }), txt: L => '+' + Math.min(40, 2 * L) + '% de fuerza contra monstruos y +' + Math.min(50, 3 * L) + '% de daño de las torres a los bandidos', fase: ['el pedestal', 'las piernas', 'el torso', 'la cabeza', 'la lanza', 'la antorcha', 'el halo'] },
    m_jardines: { ef: L => ({ gatherP: Math.min(0.15, 0.01 * L), animo: Math.min(20, L) }), txt: L => '+' + Math.min(15, L) + '% de recolección y +' + Math.min(20, L) + ' de ánimo', fase: ['la terraza', 'el segundo piso', 'las cascadas', 'el tercer piso', 'los árboles', 'las flores eternas', 'el halo'] },
    m_catedral: { ef: L => ({ researchP: Math.min(0.5, 0.03 * L), relic: Math.min(0.5, 0.04 * L) }), txt: L => '+' + Math.min(50, 3 * L) + '% de investigación y +' + Math.min(50, 4 * L) + '% de oro de las reliquias', fase: ['los cimientos', 'la nave', 'el rosetón', 'las torres', 'la cúpula', 'las campanas', 'el halo'] },
  };

  // ---------- V7. Desafíos y Retos del Rey ----------
  // Un desafío se cumple una vez y para siempre. `on`: cuándo se revisa ('tick' cada 10 s con el estado, o un evento de
  // Vida.evento: 'batalla', 'era', 'fiesta', 'incursion', 'carta'). `ok(st, ev)` dice si se cumplió. Premio: monedas del
  // reino y gemas; el título de cada uno se puede lucir (Álbum). Los Retos del Rey son 3 por semana de RETOS (`n` veces
  // en la semana), renuevan el lunes (weekKey) y dan un cofre real.
  const sumT = o => Object.values(o || {}).reduce((a, n) => a + (n || 0), 0);
  const soloTipo = (u, k) => sumT(u) > 0 && sumT(u) === (u[k] || 0);
  const ndecos = st => (st.stats.decos || 0);
  D.DESAFIOS = [
    { id: 'arqueros', name: 'Lluvia de flechas', desc: 'Gana un combate usando solo arqueros.', on: 'batalla', ok: (st, e) => e.won && soloTipo(e.units, 'archer') },
    { id: 'lanceros', name: 'Bosque de lanzas', desc: 'Gana un combate usando solo lanceros.', on: 'batalla', ok: (st, e) => e.won && soloTipo(e.units, 'spear') },
    { id: 'milicia', name: 'Gente de a pie', desc: 'Gana un combate usando solo milicianos.', on: 'batalla', ok: (st, e) => e.won && soloTipo(e.units, 'militia') },
    { id: 'caballeros', name: 'Carga de caballería', desc: 'Gana un combate usando solo caballeros.', on: 'batalla', ok: (st, e) => e.won && soloTipo(e.units, 'knight') },
    { id: 'poquitos', name: 'Pocos pero buenos', desc: 'Gana un combate con 5 soldados o menos.', on: 'batalla', ok: (st, e) => e.won && sumT(e.units) <= 5 },
    { id: 'sinbajas', name: 'Ni un rasguño', desc: 'Gana un combate de mazmorra sin bajas.', on: 'batalla', ok: (st, e) => e.won && e.poi !== undefined && !sumT(e.lost) },
    { id: 'contra', name: 'Contra todo pronóstico', desc: 'Gana un combate con menos de 50% de probabilidad.', on: 'batalla', ok: (st, e) => e.won && e.chance < 0.5 },
    { id: 'sinheroe', name: 'Sin capa ni espada', desc: 'Limpia un piso 5 o más sin héroe.', on: 'batalla', ok: (st, e) => e.won && !e.heroe && e.piso >= 5 },
    { id: 'jefe1', name: 'Cazador de jefes', desc: 'Vence a un jefe de mazmorra.', on: 'tick', ok: st => sumT(st.trofeos) >= 1 },
    { id: 'jefe5', name: 'Sala de trofeos', desc: 'Vence a 5 jefes de mazmorra.', on: 'tick', ok: st => sumT(st.trofeos) >= 5 },
    { id: 'jefes', name: 'Ninguno se escapa', desc: 'Vence a 4 jefes distintos.', on: 'tick', ok: st => Object.keys(st.trofeos || {}).filter(k => st.trofeos[k]).length >= 4 },
    { id: 'era3chico', name: 'Pueblo chico, infierno grande', desc: 'Llega a la Era III con menos de 40 aldeanos.', on: 'era', ok: (st, e) => e.era === 3 && e.aldeanos < 40 },
    { id: 'era4chico', name: 'Pocos y bien organizados', desc: 'Llega a la Era IV con menos de 70 aldeanos.', on: 'era', ok: (st, e) => e.era === 4 && e.aldeanos < 70 },
    { id: 'era5sinmercado', name: 'Autosuficiente', desc: 'Llega a la Era V sin haber comprado nunca en el Mercado.', on: 'era', ok: (st, e) => e.era === 5 && !st.stats.compras },
    { id: 'fiestas3', name: 'Fiesta sin fin', desc: 'Haz 3 fiestas del pueblo en un mismo día.', on: 'fiesta', ok: st => (st.fiesta && st.fiesta.day === PK.U.dayKey() ? st.fiesta.n : 0) >= 3 },
    { id: 'defensas3', name: 'Muralla humana', desc: 'Defiende 3 incursiones de bandidos sin que te roben nada.', on: 'incursion', ok: st => (st.stats.defensa_limpia || 0) >= 3 },
    { id: 'defensa1', name: 'Ni un grano', desc: 'Defiende una incursión sin que te roben nada.', on: 'incursion', ok: st => (st.stats.defensa_limpia || 0) >= 1 },
    { id: 'animo90', name: 'El pueblo más feliz', desc: 'Llega a 90 de ánimo.', on: 'tick', ok: st => st.animo && st.animo.v >= 90 },
    { id: 'animo70', name: 'Buen humor', desc: 'Llega a 70 de ánimo.', on: 'tick', ok: st => st.animo && st.animo.v >= 70 },
    { id: 'decos5', name: 'Urbanista', desc: 'Construye 5 decoraciones.', on: 'tick', ok: st => ndecos(st) >= 5 },
    { id: 'decos15', name: 'Paisajista', desc: 'Construye 15 decoraciones.', on: 'tick', ok: st => ndecos(st) >= 15 },
    { id: 'decos_tipos', name: 'De todo un poco', desc: 'Ten 8 tipos de decoración distintos.', on: 'tick', ok: () => D.DECOS.filter(t => PK.Game.countB(t)).length >= 8 },
    { id: 'cercania', name: 'Buenos vecinos', desc: 'Ten 6 edificios con bono por cercanía.', on: 'tick', ok: () => PK.Game.buildings.filter(b => b.owner === 'p' && b.type !== 'house' && PK.Game.cerca(b) > 0).length >= 6 },
    { id: 'muelles', name: 'Puerto pesquero', desc: 'Ten 3 muelles de pesca con pescador.', on: 'tick', ok: () => PK.Game.buildings.filter(b => b.owner === 'p' && b.type === 'muelle' && b.farmer !== null).length >= 3 },
    { id: 'cartas5', name: 'Buena mano', desc: 'Elige 5 cartas de era.', on: 'carta', ok: st => st.cartas.tomadas.length >= 5 },
    { id: 'arbolrama', name: 'Especialista', desc: 'Investiga todos los nodos de una rama del árbol.', on: 'tick', ok: () => Object.keys(D.RAMAS).some(r => PK.Vida.contar(r) === Object.keys(D.ARBOL).filter(id => D.ARBOL[id].rama === r).length) },
    { id: 'arbol10', name: 'Sabio del reino', desc: 'Investiga 10 nodos del árbol.', on: 'tick', ok: () => PK.Vida.contar() >= 10 },
    { id: 'estaciones', name: 'Un año entero', desc: 'Juega las 4 estaciones.', on: 'tick', ok: st => (st.stats.estaciones || 0) >= 4 },
    { id: 'invierno', name: 'Invierno largo', desc: 'Llena el granero en invierno.', on: 'tick', ok: st => PK.Vida.estacion() === 3 && st.res.food >= PK.Game.cap('food') - 1 },
    { id: 'heroes3', name: 'La compañía', desc: 'Ten 3 héroes.', on: 'tick', ok: st => st.heroes && st.heroes.lista.length >= 3 },
    { id: 'heroe20', name: 'Leyenda viva', desc: 'Sube un héroe a nivel 20.', on: 'tick', ok: st => (st.stats.hero_lvl || 0) >= 20 },
    { id: 'legendario', name: 'Tesoro de reyes', desc: 'Consigue un objeto legendario.', on: 'tick', ok: st => st.heroes && st.heroes.inv.some(o => o.r >= 3) },
    { id: 'mapas3', name: 'La X marca el lugar', desc: 'Desentierra 3 mapas del tesoro.', on: 'tick', ok: st => (st.stats.treasures || 0) >= 3 },
    { id: 'leyendas3', name: 'Peregrino', desc: 'Investiga 3 lugares legendarios.', on: 'tick', ok: st => (st.stats.legends || 0) >= 3 },
    { id: 'maravilla', name: 'Para la historia', desc: 'Termina una Maravilla.', on: 'tick', ok: () => !!(PK.Game.maravilla() && PK.Game.maravilla().done) },
    { id: 'maravilla10', name: 'Obra de siglos', desc: 'Sube tu Maravilla a nivel 10.', on: 'tick', ok: () => !!(PK.Game.maravilla() && PK.Game.maravilla().lvl >= 10) },
    { id: 'eventos10', name: 'Pasa de todo', desc: 'Vive 10 eventos del mapa.', on: 'tick', ok: st => (st.stats.events || 0) >= 10 },
    { id: 'lleno0', name: 'Nada se pierde', desc: 'Ten 150 aldeanos y ninguno ocioso.', on: 'tick', ok: () => { const vs = PK.Game.villagers(); return vs.length >= 150 && !vs.some(u => !u.task && !u.inside); } },
    { id: 'capitulo3', name: 'Cronista', desc: 'Cierra el capítulo III de la Crónica.', on: 'tick', ok: st => !!(st.campana && st.campana.hechos && st.campana.hechos[3]) },
    { id: 'diez_mil', name: 'Graneros de oro', desc: 'Junta 10.000 de oro a la vez.', on: 'tick', ok: st => st.res.gold >= 10000 },
  ];
  D.RETOS = [
    { id: 'r_batallas', name: 'Campaña de la semana', desc: 'Gana 8 combates', k: 'exp_won', n: 8 },
    { id: 'r_mejoras', name: 'Obras del rey', desc: 'Completa 25 mejoras', k: 'upgrades', n: 25 },
    { id: 'r_fiestas', name: 'El pueblo festeja', desc: 'Haz 4 fiestas', k: 'fiestas', n: 4 },
    { id: 'r_eventos', name: 'Atento al reino', desc: 'Vive 6 eventos del mapa', k: 'events', n: 6 },
    { id: 'r_madera', name: 'Leña para el invierno', desc: 'Junta 20.000 de madera', k: 'g_wood', n: 20000, esc: true },
    { id: 'r_comida', name: 'Despensa real', desc: 'Junta 25.000 de comida', k: 'g_food', n: 25000, esc: true },
    { id: 'r_piedra', name: 'Canteras del rey', desc: 'Junta 12.000 de piedra', k: 'g_stone', n: 12000, esc: true },
    { id: 'r_pisos', name: 'Bajo tierra', desc: 'Limpia 10 pisos de mazmorra', k: 'floors', n: 10 },
    { id: 'r_decos', name: 'Embellecer el reino', desc: 'Construye 4 decoraciones', k: 'decos', n: 4 },
    { id: 'r_nodos', name: 'La biblioteca del rey', desc: 'Investiga 2 nodos del árbol', k: 'nodos', n: 2 },
    { id: 'r_incursiones', name: 'Defensores', desc: 'Rechaza 2 incursiones', k: 'raids_won', n: 2 },
    { id: 'r_encargos', name: 'Mercenarios', desc: 'Cumple 5 encargos del tablón', k: 'missions_done', n: 5 },
  ];

  // ---------- V8. Tienda del reino (monedas del reino, nunca las de Juegos) ----------
  // Solo se ve y la comodidad no rompe el balance. `t`: color (de banderas y estandartes), marco (de los retratos de
  // héroe), fuegos (al llegar a una era), cola (+1 en la cola del Mayordomo, una vez).
  D.TIENDA = [
    { id: 'c_carmesi', t: 'color', name: 'Carmesí', col: [176, 40, 48], precio: 60 },
    { id: 'c_esmeralda', t: 'color', name: 'Esmeralda', col: [40, 140, 80], precio: 60 },
    { id: 'c_real', t: 'color', name: 'Azul real', col: [44, 72, 176], precio: 60 },
    { id: 'c_purpura', t: 'color', name: 'Púrpura', col: [118, 52, 150], precio: 80 },
    { id: 'c_oro', t: 'color', name: 'Oro viejo', col: [196, 150, 48], precio: 120 },
    { id: 'c_noche', t: 'color', name: 'Noche', col: [36, 36, 52], precio: 120 },
    { id: 'm_bronce', t: 'marco', name: 'Marco de bronce', css: '#a8743c', precio: 40 },
    { id: 'm_plata', t: 'marco', name: 'Marco de plata', css: '#c8ccd6', precio: 80 },
    { id: 'm_oro', t: 'marco', name: 'Marco de oro', css: '#e8b84a', precio: 150 },
    { id: 'f_clasicos', t: 'fuegos', name: 'Fuegos artificiales', precio: 50 },
    { id: 'f_dorados', t: 'fuegos', name: 'Fuegos dorados', precio: 120 },
    { id: 'cola', t: 'cola', name: 'Escribano del Mayordomo', desc: '+1 lugar en la cola de investigación.', precio: 200 },
  ];

  // Tope del multiplicador de recolección que pueden sumar árbol, cartas y estación juntos (Vida.recoleccion). El
  // servidor tiene el mismo número como LIM.vida (server/sim.js): la prueba de prokingdoms.test.cjs los compara.
  D.VIDA_TOPE = 1.6;
})();
