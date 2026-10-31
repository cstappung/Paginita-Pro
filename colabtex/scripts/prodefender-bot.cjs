#!/usr/bin/env node
/* PRO DEFENDER — un bot que juega bien, para medir el balance.

   Juega con el motor de verdad (juegos/club/prodefender/js/, cargado en
   globalThis.PD como en los tests) y decide como un jugador que conoce los
   números:

   - Campo de tiro: al empezar mide, en el mismo mapa y con el mismo motor,
     cuánta vida de enemigos mata por segundo cada torre con cada combinación
     de niveles contra dos filas de muñecos (débiles y sin blindaje, como al
     principio; medianos con blindaje 3; dañar sin matar vale un tercio), y
     cuánto daño sostiene contra una
     fila de eternos con blindaje 8 (los tanques y jefes del final). Así sabe cuánto sube de verdad cada mejora,
     sin tablas a ojo.
   - Gasta por eficiencia: cada compra (torre nueva en el mejor sitio libre o
     mejora, mirando hasta tres niveles adelante en el mismo camino) vale el
     daño que suma dividido por su costo. Si lo mejor no alcanza, ahorra,
     salvo que esté bajo presión (la ronda anterior se le escapó alguno).
   - Lo que el campo de tiro no mide lo cubre con reglas: detección de
     camuflados antes de que lleguen, daño arcano para las fases, el héroe en
     cuanto alcanza, huertos al principio (y venderlos tarde), tótems junto
     al grupo más grande de torres.
   - Anticipación (--anticipa, apagada por defecto): antes de cada ronda juega
     la siguiente en una copia del juego con su plan normal; si se le escapa
     alguno, prueba otros seis (gastarlo todo, solo mejorar, solo torres
     nuevas, variar de torre, volcarse en el héroe, detección en todas) y se
     queda con el mejor. Mira una sola ronda, así que suele sacrificar la
     economía: en las pruebas jugó peor que sin ella.
   - Cada torre vale según la parte de lo que viene que puede atacar: sin
     detección no ve a los camuflados; el mortero y las minas, a los voladores.
   - Usa los tres reintentos.

   «humana» juega como las personas: lee `prodefender-libro.json` (lo escribe
   `prodefender-aprende.cjs` desde una exportación de soloPruebas) y procura tener,
   cada 5 rondas, las torres de cada tipo y los niveles que tenían ellas a esa
   altura (en ese reino, o en todos si nadie llegó tan lejos ahí), sube cada torre
   en el orden de caminos que eligen y les pone su objetivo. Lo que sobra lo gasta
   como la mixta.

   Estrategias (--estrategia): qué torres de daño se permite. «mixta» usa
   todas las de su reino; «control» mete el Ancla y la escarcha (para medir
   el retroceso y las congelaciones); «sinheroe» juega sin héroe (para ver
   cuánto pesa); «espinas» solo Lanzaespinas, Vigía y Prisma.
   «adapta» es la mixta con las respuestas a las mecánicas de la segunda era
   (reinos 5–9, en pruebas): no gasta en electricidad si vienen Elementales de
   Tormenta, pone Pararrayos que cubran sus torres más caras donde hay trueno,
   tinta o tentáculos, asegura fuego contra la Hidra, varía el tipo de daño
   contra los Autómatas, cuenta la niebla como camuflaje y usa la Bruja, las
   Burbujas y el Campanario. La mixta juega esos reinos sin saber nada de eso:
   la diferencia mide cuánto pesan. Solo usa lo que vende cada reino
   (levels.js: `torres`).

   No pasa por la Grabadora: no hace pruebas, solo mide. Imprime por reino:
   hasta qué ronda llega, cuántas vidas pierde por decena de rondas y hasta
   dónde llegan los enemigos (el punto más lejano del camino que alcanzó
   alguno en la ronda, en %). Un bot que gana sin perder vidas y con los
   enemigos al 40 % del camino es un juego fácil.

   Tercera era (--reino tercera, reinos 10–14): elige pactos por una lista de preferencia
   (--pacto rechaza para no tomar ninguno), lanza el Poder del Reino sobre el enemigo más
   fuerte en cuanto se llena y llama al héroe de --heroe (Nyx si no se dice).

   Cuarta era (--reino cuarta, reinos 15–19): como la tercera; el héroe es --heroe si es de los
   cinco nuevos (Kaito si no). La Cronotorre se cuenta como torre de control.
   Uso:  node scripts/prodefender-bot.cjs [--reino 0..19|todos|nuevos|diez|tercera|cuarta|quince|veinte] [--estrategia mixta|control|sinheroe|adapta|humana|todas] [--libro archivo.json] [--torres a,b] [--separa D]
                                          [--semilla N[,M…]] [--motor DIR] [--json] [--rondas] [--fugas] [--anticipa] [--ayuda N]

   --motor DIR   carga el juego de otra carpeta (p. ej. una versión anterior
                 sacada con `git archive`), para comparar antes y después.
   --rondas      una línea por ronda (oro, vidas, avance, torres).
   --fugas       además, qué enemigos se escaparon y, cada 5 rondas, las torres.
   --diff X      juega el reino con esa dificultad (levels.js `diff`), para calibrarla.
   --hilos N     cuántas partidas a la vez, cada una en su proceso (por defecto, una por
                 núcleo; con --rondas o --fugas, una).
   --sin-cache   mide el campo de tiro aunque ya esté guardado (node_modules/.cache).
   --ayuda N     hasta la ronda N las vidas no se acaban (las perdidas se cuentan igual,
                 y no hay oro extra): para medir el juego tardío aunque la apertura del
                 bot, más floja que la de una persona, pierda vidas. */
'use strict';
const path = require('path');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MOTOR = path.resolve(opt('motor', path.join(__dirname, '../../juegos/club/prodefender/js')));
for (const f of ['data/enemies.js', 'data/towers.js', 'data/levels.js', 'engine.js', 'prueba.js']) require(path.join(MOTOR, f));
const PD = globalThis.PD;
const STEP = 1 / 60;
const AYUDA = +opt('ayuda', 0);
// El campo de tiro de una torre en un reino no cambia mientras no cambien el motor, los
// datos, el reino ni este archivo: se guarda en node_modules/.cache/prodefender-bot y la
// próxima partida no lo mide de nuevo (unos 10-20 s). --sin-cache lo mide igual.
const fs = require('fs'), crypto = require('crypto');
const CACHE = args.includes('--sin-cache') ? null : path.join(__dirname, '../node_modules/.cache/prodefender-bot');
let huellaMotor = null;
function huellaCampo(li, type) {
  if (!huellaMotor) {
    const h = crypto.createHash('sha1');
    for (const f of ['data/enemies.js', 'data/towers.js', 'data/levels.js', 'engine.js']) h.update(fs.readFileSync(path.join(MOTOR, f)));
    huellaMotor = h.update(fs.readFileSync(__filename)).digest('hex');
  }
  const L = PD.nivel ? PD.nivel(li, PD.MOTOR_VE) : PD.LEVELS[li];
  const sinCaches = (k, v) => (k[0] === '_' ? undefined : v);
  return crypto.createHash('sha1').update(huellaMotor + li + type + JSON.stringify(L, sinCaches) + JSON.stringify(PD.TOWERS[type]) + JSON.stringify([PD.JEFE, PD.CC])).digest('hex');
}
const SOPORTE = { totem: 1, huerto: 1, faro: 1 };
// de control: lo suyo (sapos, burbujas, eco, proteger) no lo mide el campo de tiro; se ponen por reglas
const CONTROL = { bruja: 1, burbujas: 1, campanario: 1, pararrayos: 1, crono: 1 };
const APARTE = { ...SOPORTE, ...CONTROL };
// planes de gasto que prueba la anticipación (decide los lee en this.modo)
const MODOS = ['normal', 'gasta', 'mejora', 'nueva', 'diversa', 'heroe', 'detecta'];
// «humana» siguiendo un guion: adelantar lo que el guion hace en las rondas siguientes no
// cuesta economía, así que se prueba antes que gastar por su cuenta
const MODOS_GUION = ['normal', 'adelanta1', 'adelanta3', 'adelanta8', 'gasta', 'mejora', 'nueva', 'diversa', 'heroe', 'detecta'];
const DETECTA = { espinas: 1, vigia: 1, voltaico: 1, colmena: 1, balista: 1 };   // camuflados en el 2.º camino, nivel 2
// Estrategias: el orden en que un jugador experto agrega torres de daño en cada reino
// (se repite en ciclo). «control» mete el Ancla y la Escarcha (para medir el retroceso y
// las congelaciones); «sinheroe» es la mixta sin héroe (para ver cuánto pesa).
const MIXTA = [
  ['espinas', 'espinas', 'bumeran', 'espinas', 'voltaico', 'mortero', 'vigia', 'prisma', 'dragon', 'colmena', 'bumeran'],
  ['espinas', 'espinas', 'sierra', 'espinas', 'acido', 'voltaico', 'mortero', 'vigia', 'prisma', 'dragon', 'sierra'],
  ['espinas', 'espinas', 'balista', 'espinas', 'voltaico', 'dragon', 'prisma', 'vigia', 'mortero', 'balista', 'dragon'],
  ['espinas', 'espinas', 'geiser', 'espinas', 'voltaico', 'prisma', 'vigia', 'mortero', 'forja', 'balista', 'geiser'],
  ['espinas', 'espinas', 'vigia', 'espinas', 'prisma', 'segador', 'voltaico', 'balista', 'segador', 'prisma', 'sierra'],
  // segunda era (cada reino vende menos: levels.js `torres`)
  ['espinas', 'espinas', 'bumeran', 'espinas', 'voltaico', 'mortero', 'vigia', 'prisma', 'dragon', 'balista', 'bumeran'],
  ['espinas', 'espinas', 'vigia', 'espinas', 'voltaico', 'mortero', 'prisma', 'dragon', 'balista', 'vigia', 'prisma'],
  ['espinas', 'espinas', 'sierra', 'espinas', 'prisma', 'vigia', 'mortero', 'balista', 'sierra', 'geiser', 'prisma'],
  ['espinas', 'espinas', 'vigia', 'espinas', 'prisma', 'mortero', 'desintegrador', 'balista', 'dragon', 'voltaico', 'desintegrador'],
  ['espinas', 'espinas', 'vigia', 'espinas', 'prisma', 'segador', 'balista', 'mortero', 'desintegrador', 'prisma', 'segador'],
  // tercera era (reinos 10–14)
  ['espinas', 'espinas', 'dragon', 'espinas', 'prisma', 'mortero', 'vigia', 'segador', 'voltaico', 'dragon', 'prisma'],
  ['espinas', 'espinas', 'vigia', 'espinas', 'prisma', 'sierra', 'balista', 'desintegrador', 'mortero', 'dragon', 'vigia'],
  ['espinas', 'espinas', 'voltaico', 'espinas', 'prisma', 'colmena', 'vigia', 'bumeran', 'voltaico', 'colmena', 'prisma'],
  ['espinas', 'espinas', 'vigia', 'espinas', 'prisma', 'balista', 'colmena', 'desintegrador', 'sierra', 'voltaico', 'prisma'],
  ['espinas', 'espinas', 'dragon', 'espinas', 'prisma', 'mortero', 'segador', 'vigia', 'obelisco', 'dragon', 'prisma'],
  // cuarta era (reinos 15–19): con su defensa nueva
  ['espinas', 'espinas', 'jade', 'espinas', 'prisma', 'dragon', 'vigia', 'balista', 'jade', 'mortero', 'prisma'],
  ['espinas', 'espinas', 'ruleta', 'espinas', 'prisma', 'voltaico', 'colmena', 'vigia', 'ruleta', 'bumeran', 'prisma'],
  ['espinas', 'espinas', 'dragon', 'espinas', 'prisma', 'grimorio', 'vigia', 'balista', 'desintegrador', 'grimorio', 'dragon'],
  ['espinas', 'espinas', 'satelite', 'espinas', 'prisma', 'balista', 'vigia', 'sierra', 'desintegrador', 'satelite', 'prisma'],
  ['espinas', 'espinas', 'dragon', 'espinas', 'prisma', 'balista', 'vigia', 'desintegrador', 'obelisco', 'dragon', 'prisma']
];
// Tercera era: el héroe que elige (se puede cambiar con --heroe), el orden en que prefiere los
// pactos (--pacto rechaza los rechaza todos) y el Poder del Reino, que lanza sobre el más fuerte.
const HEROE_TERCERA = opt('heroe', 'heroevacio');
// --diff X: prueba otra dificultad del reino (levels.js `diff`) sin tocar el archivo
// cambia un número del reino también en sus números de la versión 5 (levels.js `v5`, PD.nivel)
const ajustaNivel = (k, v) => { for (const li of String(opt('reino', '')).split(',').map(Number).filter(n => n >= 0)) { const L = PD.LEVELS[li]; L[k] = v; if (L.v5) L.v5[k] = v; delete L._rounds; delete L._v5; } };
if (opt('diff', '')) ajustaNivel('diff', +opt('diff'));
// --pactos a,b,c: otro orden de preferencia (p. ej. el de una persona); --precio P: otro
// pactoPrecio del reino (levels.js), para comparar antes y después
if (opt('precio', '') !== '') ajustaNivel('pactoPrecio', +opt('precio'));
// --jefe vida,vel: otros jefes (engine.js JEFE, desde la versión 5)
if (opt('jefe', '')) { const [v, s, b] = opt('jefe').split(',').map(Number); PD.JEFE.vida = v; PD.JEFE.vel = s; if (b) PD.JEFE.esbirros = b; }
// --tarde desde,hasta,x: otra vidaTarde (levels.js); --vida X / --oro Y: otra vida y otro oro por
// enemigo del reino (levels.js vidaX, oroX)
if (opt('tarde', '')) { const [desde, hasta, x] = opt('tarde').split(',').map(Number); ajustaNivel('vidaTarde', x > 1 ? { desde, hasta, x } : null); }
for (const [o, k] of [['vida', 'vidaX'], ['oro', 'oroX']]) if (opt(o, '') !== '') ajustaNivel(k, +opt(o));
const PACTOS_PREF = opt('pactos', '') ? opt('pactos').split(',') : ['cristal', 'furia', 'ofrenda', 'hierro', 'codicia', 'vision', 'heroe', 'cuervo', 'usura', 'caos', 'mercenario', 'sangre', 'cautela', 'herrero'];
// cuarta era: --heroe si es uno de sus cinco; si no, Kaito
const HEROE_CUARTA = PD.TOWERS[opt('heroe', '')] && PD.TOWERS[opt('heroe')].era4 ? opt('heroe') : 'heroejade';
const heroeDe = li => PD.heroOf(li) || (PD.LEVELS[li].heroes === 'todos' ? HEROE_TERCERA : PD.LEVELS[li].heroes === 'cuarta' ? HEROE_CUARTA : null);
function eligePacto(g) {
  const ofs = g.ofertasPacto();
  if (opt('pacto', '') === 'rechaza') return g.elegirPacto(3);
  let mejor = 3, mv = Infinity;
  ofs.forEach((P, i) => { const v = PACTOS_PREF.indexOf(P.id); if (v >= 0 && v < mv) { mv = v; mejor = i; } });
  return g.elegirPacto(mejor);
}
function lanzaPoder(g) {
  if (!g.poderListo()) return;
  const vivos = g.enemies.filter(e => !e.dead && !e.burrowed);
  if (!vivos.length) return;
  const e = vivos.sort((a, b) => (b.maxHp + (b.d.boss ? 1e12 : 0)) - (a.maxHp + (a.d.boss ? 1e12 : 0)))[0];
  g.lanzarPoder(Math.round(e.x), Math.round(e.y));
}
// --estrategia humana: lo aprendido de las partidas de las personas (prodefender-aprende.cjs
// escribe el libro desde una exportación de soloPruebas; --libro para usar otro)
const LIBRO = (() => {
  try { return JSON.parse(require('fs').readFileSync(path.resolve(opt('libro', path.join(__dirname, 'prodefender-libro.json'))), 'utf8')); }
  catch { return null; }
})();
// hasta qué ronda sigue «humana» la mejor partida de una persona en ese reino (el guion del libro)
const GUION = +opt('guion', 100);
// para comparar estilos: --torres a,b,c (solo esas torres de daño) y --separa D (ninguna torre a
// menos de D px de otra)
const TORRES = opt('torres', '') ? opt('torres').split(',') : null;
const SEPARA = +opt('separa', 0);
// --ciego: juega sin saber la ley del reino (sitio por el alcance de base, sin Faros en la Noche)
const CIEGO = args.includes('--ciego');
const HORIZONTE = +opt('horizonte', 2);
// con guion, la parte de las vidas del reino que se acepta perder en una ronda antes de rescatarla
const UMBRAL = +opt('umbral', 0);
// «humana» sin guion: de qué parte cada ronda antes del rescate («ahorra»: no gastar, y el
// rescate compra lo justo; «normal»: gastar como la mixta con las cuotas de las personas). En
// la Necrópolis «ahorra» llegó a la 49 y «normal» a la 32; en Eclipse y Engranajes, igual.
const BASE = opt('base', 'ahorra');
const ESTRATEGIAS = {
  mixta: { rota: MIXTA },
  humana: { rota: MIXTA, humana: true },
  control: { rota: MIXTA.map(l => l.slice(0, 3).concat(['ancla', 'escarcha'], l.slice(3), ['ancla'])) },
  sinheroe: { rota: MIXTA, sinHeroe: true },
  adapta: { rota: MIXTA, adapta: true }
};
// Orden en que sube los caminos de cada torre (0 o 1 por mejora): el principal llega a 4
// y el otro a 2. Los héroes alternan los dos y al final llevan uno al 5 si el motor deja.
const PLAN = {
  espinas: [0, 1, 1, 0, 1, 1], escarcha: [1, 1, 0, 0, 1, 1], vigia: [1, 1, 0, 0, 1, 1], voltaico: [0, 1, 1, 0, 0, 0],
  sembrador: [0, 0, 1, 1, 0, 0], mortero: [0, 0, 1, 1, 0, 0], dragon: [0, 0, 1, 1, 0, 0], prisma: [0, 1, 1, 0, 0, 0],
  colmena: [0, 1, 1, 0, 0, 0], totem: [1, 1, 0, 0, 1, 1], ancla: [0, 0, 1, 1, 0, 0], huerto: [0, 0, 1, 1, 0],
  bumeran: [0, 0, 1, 1, 0, 0], raices: [0, 0, 1, 1, 0, 0], sierra: [0, 0, 1, 1, 0, 0], acido: [0, 0, 1, 1, 0, 0],
  faro: [0, 0, 1, 1, 0], balista: [0, 1, 1, 0, 0, 0], forja: [0, 0, 1, 1, 0, 0], geiser: [0, 0, 1, 1, 0, 0],
  obelisco: [0, 0, 1, 1, 0, 0], segador: [0, 0, 1, 1, 0, 0],
  bruja: [0, 0, 1, 1, 0, 0], pararrayos: [1, 1, 0, 0, 1, 1], burbujas: [0, 0, 1, 1, 0, 0], desintegrador: [0, 1, 1, 0, 0, 0], campanario: [0, 0, 1, 1, 0, 0]
};
const PLAN_HEROE = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0];

// Muñecos del campo de tiro: no están en el juego, solo existen aquí. Tres filas:
// [tipo, vida]: débiles como al principio, medianos y eternos como al final.
PD.ENEMIES.__m0 = { id: '__m0', name: 'muñeco', hp: 1, speed: 50, bounty: 0, leak: 0, _leak: 0, _threat: 1, r: 12, color: '#fff', shape: 'sprout' };
PD.ENEMIES.__m3 = { ...PD.ENEMIES.__m0, id: '__m3', armor: 3 };
PD.ENEMIES.__m8 = { ...PD.ENEMIES.__m0, id: '__m8', armor: 8 };
// [tipo, vida, cada cuántos s entra uno]: lo bastante seguidos para que no se acaben
const FILAS = [['__m0', 14, 0.3], ['__m3', 90, 0.35], ['__m8', 1e12, 0.5]];

// ------------------------------- campo de tiro -------------------------------
function combinaciones(def) {
  const out = [], n0 = def.paths[0].ups.length, n1 = def.paths[1].ups.length;
  for (let a = 0; a <= n0; a++) for (let b = 0; b <= n1; b++) {
    if (def.hero ? (a > 4 && b > 4) : (a > 2 && b > 2)) continue;
    out.push([a, b]);
  }
  return out;
}
// El daño útil por segundo de una torre con esos niveles, puesta en (x, y), contra una
// fila continua de muñecos de vida `vida` que entra justo donde empieza su alcance.
function tiro(li, type, tiers, x, y, muneco, vida, cada, entradas) {
  const g = new PD.Game(li, null, 12345);
  g.money = 1e12; g.lives = 1e12;
  const t = g.place(type, x, y);
  if (!t) return 0;
  for (let p = 0; p < 2; p++) for (let i = 0; i < tiers[p]; i++) g.upgrade(t, p);
  g.active = true; g.queue = [{ t: 1e9 }]; g.qi = 0;
  const SEG = 24;
  let prox = 0, k = 0;
  const todos = [];
  for (let paso = 0; paso < SEG * 60; paso++) {
    if (g.rt >= prox) { const e = entradas[k++ % entradas.length]; todos.push(g.spawn(muneco, e[0], e[1], vida)); prox += cada; }
    g.update(STEP);
  }
  // contra los que mueren, sobre todo la vida de los que mató (dañar sin matar frena
  // poco: cuenta un tercio, porque otra torre puede rematarlos); contra los eternos, el
  // daño sostenido
  let util = 0;
  for (const e of todos) util += vida < 1e9 ? (e.dead && !e.leaked ? e.maxHp : 0.35 * Math.max(0, e.maxHp - Math.max(0, e.hp))) : e.maxHp - e.hp;
  return util / SEG;
}

class Bot {
  // op: {guion, hasta, sinAnticipa, banco, covBanco}: para jugar a prueba con otro guion, hasta una ronda, sin anticipar o sin medir de nuevo el campo de tiro
  constructor(li, estrategia, semilla, op = {}) {
    this.op = op;
    this.li = li; this.est = ESTRATEGIAS[estrategia]; this.nombre = estrategia; this.semilla = semilla >>> 0;
    this.game = new PD.Game(li, null, this.semilla);
    this.mem = new Map();   // id de torre → {cov, dealt: [por ronda], antes}
    this.cal = {};          // tipo → corrección medida (calibra)
    this.muestras = [];     // [x, y, progreso, camino, distancia]
    this.game.paths.forEach((p, pi) => {
      for (let d = 0; d < p.len; d += 14) {
        const q = PD.posAt(p, d, { x: 0, y: 0, a: 0 });
        if (q.x > 0 && q.x < PD.W && q.y > 0 && q.y < PD.H) this.muestras.push([q.x, q.y, d / p.len, pi, d]);
      }
    });
    this.dens = new Float64Array(this.muestras.length);
    this.sitios = [];
    for (let x = 24; x < PD.W - 20; x += 16) for (let y = 24; y < PD.H - 20; y += 16) this.sitios.push([x, y]);
    const vende = PD.towersFor(li);
    this.rota = this.est.rota[li].filter(x => vende.includes(x));
    if (TORRES) this.rota = TORRES.filter(x => vende.includes(x));
    if (this.est.humana) {
      if (!LIBRO) throw new Error('falta el libro: node scripts/prodefender-aprende.cjs export.json');
      // las torres de daño en el orden en que las ponen las personas (las de este reino, o las de todos)
      const orden = (LIBRO.orden[PD.Prueba.REINOS[li]] || []).concat(LIBRO.orden['*'] || []);
      const rota = [...new Set(orden)].filter(x => vende.includes(x) && !APARTE[x] && !PD.TOWERS[x].hero);
      if (rota.length) this.rota = rota;
    }
    this.ri = 0;
    const heroe = heroeDe(li);
    // las de control solo las usa «adapta» (por reglas, ver adapta())
    const control = this.est.adapta ? Object.keys(CONTROL).filter(x => vende.includes(x)) : [];
    this.permitidas = [...new Set(this.rota.concat(control, heroe && !this.est.sinHeroe ? [heroe] : []))];
    // «humana» usa todo lo que vende el reino (las cuotas dicen cuánto de cada una)
    if (this.est.humana) this.permitidas = [...new Set(vende.filter(x => !PD.TOWERS[x].hero).concat(heroe ? [heroe] : []))];
    // qué mecánicas trae el reino (para «adapta»)
    const pool = PD.LEVELS[li].pool.map(p => PD.ENEMIES[p[0]]).concat([PD.ENEMIES[PD.LEVELS[li].boss]]);
    this.mec = { protege: pool.some(d => d.thunder || d.ink || d.grab), fuego: pool.some(d => d.regenFuego), adapta: pool.some(d => d.adapt) };
    if (op.banco) { this.banco = op.banco; this.covBanco = op.covBanco; } else this.campo();
    if (this.est.humana) this.guion = op.guion || this.guionPropio();
  }
  // mide todas las combinaciones de todas las torres permitidas (una vez por partida)
  campo() {
    this.banco = {};
    this.covBanco = {};
    for (const type of this.permitidas) {
      const archivo = CACHE && path.join(CACHE, huellaCampo(this.li, type) + '.json');
      if (archivo && fs.existsSync(archivo)) { const x = JSON.parse(fs.readFileSync(archivo, 'utf8')); this.banco[type] = x.tabla; this.covBanco[type] = x.cov; continue; }
      const def = PD.TOWERS[type], R = def.base.range || 110;
      const s = this.sitio(type, true);
      if (!s) continue;
      // por dónde entran los muñecos: un poco antes del primer punto del camino que cubre
      const entradas = [];
      this.game.paths.forEach((p, pi) => {
        let dmin = Infinity;
        for (const m of this.muestras) if (m[3] === pi && Math.hypot(m[0] - s[0], m[1] - s[1]) < R + 30) dmin = Math.min(dmin, m[4]);
        if (dmin < Infinity) entradas.push([pi, Math.max(0, dmin - 50)]);
      });
      if (!entradas.length) continue;
      const tabla = {};
      for (const c of combinaciones(def)) tabla[c.join('')] = FILAS.map(([m, v, cada]) => tiro(this.li, type, c, s[0], s[1], m, v, cada, entradas));
      this.banco[type] = tabla;
      this.covBanco[type] = this.cobertura(s[0], s[1], R, true);
      if (archivo) {   // a un temporal y luego renombrar: varios bots a la vez no se pisan
        fs.mkdirSync(CACHE, { recursive: true });
        const tmp = archivo + '.' + process.pid;
        fs.writeFileSync(tmp, JSON.stringify({ tabla, cov: this.covBanco[type] }));
        fs.renameSync(tmp, archivo);
      }
    }
  }
  // Cuánto camino cubre un sitio. El tramo del medio vale más (da tiempo a disparar), el
  // final poco (ya se escapan) y, si no se pide lo contrario, cada punto rinde menos
  // cuantas más torres lo cubren ya: así reparte la defensa entre los caminos.
  cobertura(x, y, R, sinDensidad) {
    let n = 0;
    const M = this.muestras;
    for (let i = 0; i < M.length; i++) {
      const m = M[i], dx = m[0] - x, dy = m[1] - y;
      if (dx * dx + dy * dy >= R * R) continue;
      n += (m[2] > 0.88 ? 0.25 : 1) * (0.7 + 0.6 * Math.sin(Math.PI * m[2])) / (sinDensidad ? 1 : 1 + 0.35 * this.dens[i]);
    }
    return n;
  }
  marca(t) {
    const R = t.s.range || 100;
    this.muestras.forEach((m, i) => { if (Math.hypot(m[0] - t.x, m[1] - t.y) < R) this.dens[i]++; });
  }
  // el mejor sitio libre para una torre: el que más camino cubre (el tótem y la Caldera,
  // el que más torres alcanza con su aura; el huerto, uno que no le quite sitio a nadie)
  sitio(type, vacio) {
    const g = vacio ? new PD.Game(this.li, null, 1) : this.game, def = PD.TOWERS[type];
    const R = def.base.range || 110, aura = type === 'totem' ? R : def.base.aura;
    let mejor = null, mv = -Infinity;
    for (const [x, y] of this.sitios) {
      if (!g.canPlace(type, x, y)) continue;
      if (SEPARA && !vacio && g.towers.some(t => Math.hypot(t.x - x, t.y - y) < SEPARA)) continue;
      let v;
      if (aura && !vacio) {
        v = 0;
        for (const t of g.towers) if (!APARTE[t.type] && Math.hypot(t.x - x, t.y - y) < aura - 6) v += this.poder(t);
        v += this.cobertura(x, y, R) * 1e-3;
      } else if (type === 'huerto') v = -this.cobertura(x, y, 140, true);
      else if (type === 'pararrayos' && !vacio) {
        // donde cubra más oro invertido sin proteger (lo que buscan el trueno y los tentáculos)
        v = 0;
        for (const t of g.towers) if (t.type !== 'pararrayos' && !g.protegida(t) && Math.hypot(t.x - x, t.y - y) < R - 4) v += t.spent;
        v += this.cobertura(x, y, R) * 1e-3;
      }
      // la ley del reino (Altura, Noche) cambia el alcance según el sitio
      else v = this.cobertura(x, y, vacio || CIEGO || !g.leyEn ? R : R * g.leyEn(type, x, y).range, vacio);
      if (v > mv) { mv = v; mejor = [x, y]; }
    }
    return mejor;
  }
  // qué fila del campo de tiro se parece a la ronda: débiles al principio, medianos a
  // media partida, eternos y blindados al final (mezcla suave entre ellas)
  pesos() {
    const r = this.game.round;
    const a = Math.max(0, Math.min(1, (r - 6) / 14)), b = Math.max(0, Math.min(1, (r - 35) / 25));
    return [1 - a, a * (1 - b), a * b];
  }
  dpsDe(type, tiers) {
    const b = this.banco[type] && this.banco[type][tiers.join('')];
    if (!b) return 0;
    const w = this.pesos();
    return b[0] * w[0] + b[1] * w[1] + b[2] * w[2];
  }
  poder(t) {
    const m = this.mem.get(t.id);
    if (!m || !this.covBanco[t.type]) return 0;
    return this.dpsDe(t.type, t.tiers) * Math.min(1.3, m.cov / this.covBanco[t.type]) * (t.def.hero ? 1.5 : 1) * (this.cal[t.type] || 1);
  }
  // Calibración con la partida: cuánto rindió de verdad cada tipo de torre (daño medido en
  // las últimas rondas) frente a lo que predijo el campo de tiro, relativo a la mediana de
  // todas. Corrige lo que el campo de tiro no ve: oleadas menos densas, enemigos que mueren
  // antes de llegar, torres que se roban los blancos.
  calibra() {
    const pares = [];
    for (const t of this.game.towers) {
      if (APARTE[t.type]) continue;
      const m = this.mem.get(t.id), d = m.dealt.slice(-3);
      if (d.length < 2) continue;
      const pred = this.poder(t) / (this.cal[t.type] || 1);
      if (pred > 0) pares.push([t.type, d.reduce((a, b) => a + b, 0) / d.length / pred]);
    }
    if (pares.length < 3) return;
    const med = pares.map(p => p[1]).sort((a, b) => a - b)[Math.floor(pares.length / 2)] || 1;
    const por = {};
    for (const [ty, x] of pares) (por[ty] = por[ty] || []).push(x / med);
    for (const ty in por) { const v = por[ty].sort((a, b) => a - b); this.cal[ty] = Math.max(0.25, Math.min(3, v[Math.floor(v.length / 2)])); }
  }
  coloca(type) {
    const s = this.sitio(type);
    if (!s) return null;
    const t = this.game.place(type, s[0], s[1]);
    if (t) {
      this.mem.set(t.id, { cov: this.cobertura(s[0], s[1], t.s.range || 110, true), dealt: [], antes: 0 });
      if (!APARTE[type]) this.marca(t);
      const modo = this.est.humana && LIBRO.modos[type];
      if (modo && t.def.targeting) t.mode = modo;
    }
    return t;
  }
  // los próximos pasos del plan de una torre (los que ya hizo se descuentan por camino)
  pasosPlan(t) {
    const aprendido = this.est.humana && LIBRO.planes[t.def.hero ? 'heroe' : t.type];
    const plan = aprendido || (t.def.hero ? PLAN_HEROE : PLAN[t.type] || [0, 0, 1, 1, 0, 0]);
    const hechos = [0, 0], fut = [], tt = t.tiers.slice();
    for (const p of plan) {
      if (hechos[p] < t.tiers[p]) { hechos[p]++; continue; }
      const nt = tt.slice(); nt[p]++;
      if (nt[p] > t.def.paths[p].ups.length || (t.def.hero ? (nt[0] > 4 && nt[1] > 4) : (nt[0] > 2 && nt[1] > 2))) continue;
      fut.push(p); tt[p]++;
    }
    return fut;
  }
  // qué traen las tres rondas siguientes; fc y ff: la parte (por amenaza) camuflada y voladora
  vienen(r) {
    const R = this.game.rounds, o = { camo: false, phase: false, shield: false, fc: 0, ff: 0, fe: 0 };
    let tot = 0;
    for (let k = r; k < r + 3 && k <= R.length; k++) for (const gr of R[k - 1].groups) {
      const d = PD.ENEMIES[gr.type], w = PD.enemyThreat(gr.type) * gr.n * (k === r ? 2 : 1);
      tot += w;
      if (d.camo || gr.mod === 'camo' || (this.est.adapta && d.fogAura)) { o.camo = true; o.fc += w; }
      if (d.absorb === 'elec') o.fe += w;
      if (d.flying) o.ff += w;
      if (d.phase) o.phase = true;
      if (d.shield) o.shield = true;
    }
    if (tot) { o.fc /= tot; o.ff /= tot; o.fe /= tot; }
    return o;
  }
  // la parte de lo que viene que una torre con esas estadísticas puede atacar
  ve(s, v) { return (s.camo ? 1 : 1 - v.fc * 0.9) * (s.noFlying ? 1 - v.ff * 0.9 : 1) * (this.est.adapta && s.dtype === 'elec' ? 1 - v.fe : 1); }

  // Gasta entre rondas hasta que no hay nada que valga la pena o decide ahorrar.
  turno() {
    const g = this.game;
    for (let vueltas = 0; vueltas < 80; vueltas++) {
      const acc = this.decide(g.round + 1);
      if (!acc || g.money < acc.cost) return;
      if (acc.k === 'place') { const t = this.coloca(acc.type); if (acc.rota) this.ri++; if (!t) this.vetadas[acc.type] = 1; }
      else if (acc.k === 'up') { if (!g.upgrade(acc.t, acc.p)) return; }
      else if (acc.k === 'sell') g.sell(acc.t);
    }
  }
  decide(r) {
    const g = this.game, T = g.towers, vet = this.vetadas;
    const dmg = T.filter(t => !APARTE[t.type]);
    const nuevo = type => ({ k: 'place', type, cost: PD.TOWERS[type].cost });
    const modo = this.modo || 'normal';
    const presion = this.presion || dmg.length < 2 || modo === 'gasta';
    // tarde, los huertos ya no pagan su sitio: se venden para comprar daño (las personas no)
    if (r >= 78 && !this.est.humana) { const f = T.find(t => t.type === 'huerto'); if (f) return { k: 'sell', t: f, cost: 0 }; }
    // lo que piden las tres rondas siguientes y el campo de tiro no mide
    const vienen = this.vienen(r);
    const camos = dmg.filter(t => t.s.camo).length + (T.some(t => t.type === 'faro') ? 2 : 0);
    const detecta = modo === 'detecta' && camos < dmg.length / 2;   // plan «detección»: la mitad de las torres
    const quiereCamo = (r < 25 ? 2 : 3) + Math.round(vienen.fc * 8);   // más detección cuanto más camuflado viene
    if (vienen.camo && (camos < quiereCamo || detecta)) {
      // la detección llega con el nivel 2 del segundo camino de estas torres
      const e = dmg.filter(t => DETECTA[t.type] && !t.s.camo && t.tiers[1] < 2 && g.canUpgrade(t, 1)).sort((a, b) => b.tiers[1] - a.tiers[1] || g.upgradeCost(a, 1) - g.upgradeCost(b, 1))[0];
      if (e) return { k: 'up', t: e, p: 1, cost: g.upgradeCost(e, 1) };
      const barata = ['espinas', 'vigia', 'voltaico'].find(x => this.permitidas.includes(x) && !vet[x]);
      if (barata && camos < quiereCamo) return nuevo(barata);
    }
    // muchos voladores y casi nada que les pegue: antiaéreo (lo que haría una persona)
    if (vienen.ff > 0.3) {
      const aire = dmg.filter(t => !t.s.noFlying).reduce((a, t) => a + this.poder(t), 0), todo = dmg.reduce((a, t) => a + this.poder(t), 0) || 1;
      const aa = ['prisma', 'voltaico', 'vigia', 'espinas'].find(x => this.permitidas.includes(x) && !vet[x]);
      if (aire / todo < 0.5 && aa) return nuevo(aa);
    }
    if (vienen.phase && !dmg.some(t => t.type === 'prisma' || t.s.dtype === 'arcane') && this.permitidas.includes('prisma') && !vet.prisma) return nuevo('prisma');
    for (const f of this.est.fuerza || []) if (r >= 10 && !T.some(t => t.type === f) && this.permitidas.includes(f) && !vet[f]) return nuevo(f);
    if (this.est.adapta) { const a = this.adapta(r, presion); if (a) return a; }
    if (this.est.humana) { const h = this.humana(r, presion); if (h) return h; }
    const heroe = heroeDe(this.li);
    if (!this.est.humana && heroe && this.permitidas.includes(heroe) && !T.some(t => t.def.hero) && r >= 5 && !vet[heroe] && (!presion || g.money >= PD.TOWERS[heroe].cost)) return nuevo(heroe);
    // Ley de la Noche: un Faro para empezar y otro cada cuatro torres de daño (las demás se
    // ponen donde alumbran, ver sitio)
    if (g.ley === 'noche' && !CIEGO && !vet.faro && PD.towersFor(this.li).includes('faro') && dmg.length) {
      const faros = T.filter(t => t.type === 'faro').length;
      if (faros < 1 + Math.floor(dmg.length / 4) && (!presion || g.money >= PD.TOWERS.faro.cost)) return nuevo('faro');
    }
    const granjas = T.filter(t => t.type === 'huerto').length;
    const quiere = r < 5 ? 0 : r < 12 ? 1 : r < 22 ? 2 : r < 45 ? 3 : 0;
    if (granjas < quiere && dmg.length >= 4 && !presion && !vet.huerto && !this.est.humana) return nuevo('huerto');
    const totems = T.filter(t => t.type === 'totem').length;
    if (((dmg.length >= 7 && totems < 1) || (dmg.length >= 14 && totems < 2)) && !vet.totem && (!presion || g.money >= 760) && !this.est.humana) return nuevo('totem');

    // Lo demás compite por eficiencia: daño que suma cada oro. Cada torre sube por su plan
    // (mirando hasta tres pasos adelante, para que llegue a las mejoras grandes); la torre
    // nueva es la que toca en la rotación.
    const cands = [], granja = [];
    for (const t of T) {
      if (modo === 'nueva' && !t.def.hero) continue;
      const pasos = this.pasosPlan(t);
      if (!pasos.length) continue;
      const p = pasos[0], c = g.upgradeCost(t, p);
      if (t.type === 'huerto') {
        // oro que suma por ronda × las rondas que quedan para aprovecharlo, pasado a daño
        // con lo que rinde el oro en lo demás (abajo)
        const extra = p === 0 ? [30, 72, 180, 600][t.tiers[0]] * (t.s.incomeMult || 1) : t.tiers[1] === 0 ? t.s.income * 0.25 : 0;
        const horiz = Math.max(0, Math.min(30, 55 - r));
        if (extra && horiz) granja.push({ k: 'up', t, p, cost: c, oro: extra * horiz / c });
        continue;
      }
      if (t.type === 'totem' || t.type === 'faro' || CONTROL[t.type]) {
        let cerca = 0; for (const o of dmg) if (Math.hypot(o.x - t.x, o.y - t.y) < t.s.range) cerca += this.poder(o);
        cands.push({ k: 'up', t, p, cost: c, sc: cerca * 0.12 / c });
        continue;
      }
      const m = this.mem.get(t.id), f = Math.min(1.3, m.cov / (this.covBanco[t.type] || 1)) * (t.def.hero ? 1.5 : 1) * (this.cal[t.type] || 1);
      const base = this.poder(t) * this.ve(t.s, vienen);
      // los héroes con los dos caminos al 4 eligen cuál llevar al 5 por el campo de tiro
      const caminos = t.def.hero && t.tiers[0] >= 4 && t.tiers[1] >= 4 ? [[0], [1]].filter(([q]) => g.canUpgrade(t, q)) : [pasos];
      for (const ps of caminos) {
        const tt = t.tiers.slice();
        let cc = 0, mejor = 0;
        for (let k = 0; k < Math.min(3, ps.length); k++) {
          const up = t.def.paths[ps[k]].ups[tt[ps[k]]];
          if (!up) break;
          tt[ps[k]]++; cc += up.cost;
          const s2 = g.baseStats({ def: t.def, tiers: tt });
          mejor = Math.max(mejor, (this.dpsDe(t.type, tt) * f * this.ve(s2, vienen) - base) / cc * (k ? 0.9 : 1));
        }
        cands.push({ k: 'up', t, p: ps[0], cost: g.upgradeCost(t, ps[0]), sc: mejor * (modo === 'heroe' && t.def.hero ? 2 : 1) });
      }
    }
    if (dmg.length < 34 && modo !== 'mejora') {
      // una torre nueva rinde menos cuanto más cubierto está ya el camino
      let dens = 0; for (const x of this.dens) dens += x; dens /= Math.max(1, this.dens.length);
      let type = this.rota[this.ri % this.rota.length];
      if (modo === 'diversa') type = this.rota.find(x => !dmg.some(t => t.type === x) && !vet[x]) || type;
      // «adapta» contra los Autómatas: un tipo de daño que aún no tiene rinde más
      const nuevoTipo = this.est.adapta && this.mec.adapta && !dmg.some(t => t.s.dtype === PD.TOWERS[type].base.dtype) ? 1.6 : 1;
      if (!vet[type]) cands.push({ ...nuevo(type), rota: true, sc: nuevoTipo * this.dpsDe(type, [0, 0]) * (this.cal[type] || 1) * this.ve(PD.TOWERS[type].base, vienen) / PD.TOWERS[type].cost / (1 + 0.2 * dens) });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.sc - a.sc);
    for (const f of granja) cands.push({ ...f, sc: f.oro * cands[0].sc * 0.6 });
    cands.sort((a, b) => b.sc - a.sc);
    // ahorrar solo para lo que se paga en ~1,5 rondas de ingreso; si no, lo mejor que alcance
    const ingreso = PD.roundBonus(r) * 1.5;
    const best = cands.find(c => c.cost - g.money <= ingreso) || cands[cands.length - 1];
    if (best.cost <= g.money) return best;
    const alt = cands.find(c => c.cost <= g.money && c.sc > 0);
    return alt && (presion || alt.sc >= best.sc * 0.75) ? alt : best;
  }

  // ---- «humana»: tener lo que tienen las personas a esta altura de la partida ----
  // Las cuotas del libro (cada 5 rondas: cuántas torres de cada tipo y cuántos niveles
  // por torre, en promedio) son las de este reino o, si nadie llegó tan lejos en él, las
  // de todos, escaladas a lo que este reino vende. Va primero lo que más falta (en
  // proporción); si no alcanza, ahorra para eso, salvo bajo presión.
  humana(r, presion) {
    const g = this.game, T = g.towers, vet = this.vetadas, C = LIBRO.cuotas;
    const rr = Math.min(100, Math.ceil(r / 5) * 5), slug = PD.Prueba.REINOS[this.li];
    const propia = C[slug] && C[slug][rr], fila = propia || (C['*'] && C['*'][rr]);
    if (!fila) return null;
    const heroe = heroeDe(this.li);
    const tipo = x => (x === 'heroe' ? heroe : x);
    const vale = x => x && this.permitidas.includes(x) && !vet[x];
    let escala = 1;
    if (!propia) {
      let todo = 0, aqui = 0;
      for (const [x, [n]] of Object.entries(fila)) { todo += n; if (vale(tipo(x))) aqui += n; }
      escala = aqui ? Math.min(2, todo / aqui) : 1;
    }
    const acc = [];
    for (const [x, [n, niv]] of Object.entries(fila)) {
      const ty = tipo(x);
      if (!vale(ty)) continue;
      const mias = T.filter(t => (x === 'heroe' ? t.def.hero : t.type === ty));
      const quiere = Math.round(n * escala * (x === 'heroe' ? 1 / escala : 1));
      if (mias.length < quiere) acc.push({ k: 'place', type: ty, cost: PD.TOWERS[ty].cost, falta: (quiere - mias.length) / quiere });
      const nivel = Math.round(niv);
      for (const t of mias) {
        const tn = t.tiers[0] + t.tiers[1];
        if (tn >= nivel) continue;
        const p = this.pasosPlan(t)[0];
        if (p === undefined || !g.canUpgrade(t, p)) continue;
        acc.push({ k: 'up', t, p, cost: g.upgradeCost(t, p), falta: (nivel - tn) / nivel });
      }
    }
    if (!acc.length) return null;
    acc.sort((a, b) => b.falta - a.falta || a.cost - b.cost);
    const best = acc[0];
    if (best.cost <= g.money || !presion) return best;
    return acc.find(a => a.cost <= g.money) || best;
  }

  // ---- «adapta»: las respuestas a las mecánicas de la segunda era ----
  adapta(r, presion) {
    const g = this.game, T = g.towers, vet = this.vetadas, puede = x => this.permitidas.includes(x) && !vet[x];
    const nuevo = type => ({ k: 'place', type, cost: PD.TOWERS[type].cost });
    // fuego para cortar la regeneración de la Hidra antes de la ronda 25
    if (this.mec.fuego && r >= 14 && !T.some(t => t.s.dtype === 'fire' || t.s.burnDps) && puede('dragon')) return nuevo('dragon');
    // pararrayos: que las torres más caras queden cubiertas (trueno, tinta y tentáculos)
    if (this.mec.protege && r >= 9 && puede('pararrayos')) {
      const caras = T.filter(t => t.type !== 'pararrayos').sort((a, b) => b.spent - a.spent).slice(0, 6);
      const sin = caras.filter(t => !g.protegida(t)).reduce((a, t) => a + t.spent, 0);
      const rods = T.filter(t => t.type === 'pararrayos').length;
      if (sin > 1500 + rods * 600 && rods < (r < 40 ? 2 : 3) && (!presion || g.money >= PD.TOWERS.pararrayos.cost)) return nuevo('pararrayos');
    }
    // una de control donde la venden (sapos, burbujas, eco), y una segunda más tarde
    for (const c of ['bruja', 'burbujas', 'campanario']) {
      if (!puede(c)) continue;
      const n = T.filter(t => t.type === c).length;
      if (((n < 1 && r >= 10) || (n < 2 && r >= 55)) && (!presion || g.money >= PD.TOWERS[c].cost * 1.5)) return nuevo(c);
    }
    return null;
  }

  // ---- anticipación: probar varios planes de gasto contra la ronda que viene ----
  // copia del bot sobre una copia del juego (la misma foto, otra semilla)
  // («humana» rehace el juego de verdad desde la misma foto y con la misma semilla antes de
  // cada ronda, así que la copia juega exactamente lo que jugaría él con ese plan)
  copia() {
    const c = Object.create(Bot.prototype);
    Object.assign(c, this);
    const exacta = this.est.humana;
    c.game = null; c.gTorres = this.gTorres && this.gTorres.slice();
    c.rehaceDe(JSON.parse(JSON.stringify(this.game.snapshot())), exacta ? this.game.rs : (this.semilla ^ 0x9e3779b9) >>> 0, this.game);
    c.dens = this.dens.slice(); c.cal = { ...this.cal }; c.vetadas = {};
    return c;
  }
  // gasta con ese plan: el guion (adelantado n rondas con «adelantaN») y, si ya no hay guion
  // o el plan es otro, por su cuenta
  // «ahorra» no gasta nada; `acc`, las compras del rescate (abajo), van al final
  planea(modo, acc) {
    const r = this.game.round + 1, adel = /^adelanta(\d+)$/.exec(modo);
    if (modo !== 'ahorra') {
      const enGuion = this.sigueGuion(adel ? r + +adel[1] : r);
      if (!enGuion || (modo !== 'normal' && !adel)) this.turno();
    }
    if (acc) this.aplica(acc);
  }
  // compras sueltas: {k: 'p', type, x, y} poner, {k: 'u', i, p} mejorar la torre n.º i
  // (el orden de g.towers es el mismo en la copia y en el juego de verdad)
  aplica(acc) {
    const g = this.game;
    for (const a of acc) {
      if (a.k === 'p') {
        const t = g.canPlace(a.type, a.x, a.y) ? g.place(a.type, a.x, a.y) : null;
        if (t) { this.mem.set(t.id, { cov: this.cobertura(t.x, t.y, t.s.range || 110, true), dealt: [], antes: 0 }); if (!APARTE[a.type]) this.marca(t); }
      } else {
        const t = g.towers[a.i];
        if (t && g.canUpgrade(t, a.p)) g.upgrade(t, a.p);
        if (t && a.k === 'u2' && g.canUpgrade(t, a.q)) g.upgrade(t, a.q);
      }
    }
  }
  // Gasta con ese plan en la copia y juega ahí la ronda siguiente. «humana» mira una ronda
  // más (`--horizonte`, 2 por defecto) sin más compras que las del guion: lo que pierda en
  // ella cuenta la mitad. Así una compra que rinde dos rondas le gana a una que salva una.
  ensaya(modo, acc) {
    const c = this.copia();
    c.modo = modo; c.planea(modo, acc);
    const g = c.game, H = this.est.humana ? HORIZONTE : 1;
    let perdidas = 0, av = 0;
    for (let h = 0; h < H && !g.over && g.round < PD.MAX_ROUND; h++) {
      if (h) { c.vetadas = {}; c.planea(modo === 'ahorra' ? 'ahorra' : 'normal'); }
      const v0 = g.lives;
      if (g.pactoPendiente()) eligePacto(g);
      g.startRound();
      let pasos = 0;
      while (g.active && !g.over && pasos < 60 * 900) {
        c.enRonda(pasos);
        g.update(STEP); pasos++;
        if (g.era3 && pasos % 30 === 0) lanzaPoder(g);
        if (!h && pasos % 15 === 0) for (const e of g.enemies) { const pr = e.dist / g.paths[e.path].len; if (pr > av) av = pr; }
      }
      perdidas += (v0 - g.lives + (g.over ? 1000 : 0)) * (h ? 0.5 : 1);
      if (!h) var oro = g.money;
    }
    return { perdidas, av, oro };
  }
  // Si el plan normal pasa la ronda sin pérdidas, ese. Si no, el que la pase guardando más
  // oro; y si ninguno la pasa limpia, el que menos pierde (y menos deja avanzar).
  elegir() {
    if (this.est.humana && !args.includes('--sin-anticipa') && !this.op.sinAnticipa) return this.elegirHumana();
    if (!args.includes('--anticipa')) return 'normal';
    const normal = this.ensaya('normal');
    if (normal.perdidas === 0 && normal.av < 0.85) return 'normal';
    const res = [['normal', normal]].concat(MODOS.slice(1).map(m => [m, this.ensaya(m)]));
    const ok = res.filter(([, x]) => x.perdidas === 0 && x.av < 0.85);
    if (ok.length) return ok.sort((a, b) => b[1].oro - a[1].oro)[0][0];
    return res.sort((a, b) => a[1].perdidas - b[1].perdidas || a[1].av - b[1].av)[0][0];
  }

  // «humana»: el primer plan (en el orden de MODOS_GUION) que pasa la ronda sin perder vidas;
  // si ninguno, el que menos pierde. Fuera del guion no se prueban los «adelanta».
  // Con guion, gastar por su cuenta le quita oro a lo que el guion compra después y lo
  // desarma: solo si ni el guion ni adelantarlo bastan y se perderían bastantes vidas.
  // Con guion: el guion o adelantarlo. Sin guion: no gastar nada. Si así pierde vidas (con
  // guion, bastantes: desviarse le quita oro a lo que el guion compra después), el rescate
  // busca las compras más baratas que salvan la ronda; si ni así, los planes de gasto de la
  // anticipación. Gana el que menos pierde.
  elegirHumana() {
    const r = this.game.round + 1, queda = this.guion && r <= GUION && (this.gi || 0) < this.guion.length;
    const umbral = queda ? Math.max(1, Math.round(PD.LEVELS[this.li].lives * UMBRAL)) : 1;
    let mejor = null;
    const prueba = (m, acc) => {
      const x = this.ensaya(m, acc);
      if (process.env.PD_DEBUG) console.log(`    r${r} ${m}${acc ? '+' + acc.length : ''}: pierde ${x.perdidas}, oro ${Math.round(x.oro)}`);
      if (!mejor || x.perdidas < mejor.x.perdidas || x.perdidas === mejor.x.perdidas && x.av < mejor.x.av) mejor = { m, acc, x };
      return x;
    };
    for (const m of queda ? MODOS_GUION.filter(m => /^(normal|adelanta)/.test(m)) : [BASE]) if (prueba(m).perdidas === 0) return this.toma(mejor);
    if (mejor.x.perdidas < umbral) return this.toma(mejor);
    const base = mejor.m, acc = this.rescate(base, mejor.x);
    if (acc.length) prueba(base, acc);
    if (mejor.x.perdidas === 0) return this.toma(mejor);
    for (const m of MODOS) if (prueba(m).perdidas === 0) break;
    return this.toma(mejor);
  }
  toma(x) { this.plan = x.acc || null; return x.m; }
  // Rescate: de a una compra (una torre en el mejor sitio libre o el próximo paso del plan de
  // una torre), la más barata que salva la ronda; si ninguna, la que más vidas salva por oro.
  rescate(modo, x0) {
    const acc = [];
    let best = x0;
    for (let it = 0; it < 8 && best.perdidas > 0; it++) {
      const c0 = this.copia(); c0.planea(modo, acc);
      const g = c0.game, cands = [];
      for (const type of this.permitidas) {
        if (PD.TOWERS[type].hero && g.towers.some(t => t.def.hero)) continue;
        const cost = g.towerCost ? g.towerCost(type) : PD.TOWERS[type].cost;
        if (cost > g.money) continue;
        const s = c0.sitio(type);
        if (s) cands.push({ k: 'p', type, x: s[0], y: s[1], cost });
      }
      g.towers.forEach((t, i) => {
        const [p, q] = c0.pasosPlan(t);
        if (p === undefined || !g.canUpgrade(t, p)) return;
        const c1 = g.upgradeCost(t, p);
        if (c1 <= g.money) cands.push({ k: 'u', i, p, cost: c1 });
        // y dos pasos de una vez (las mejoras grandes no se ven de a uno)
        if (q !== undefined) {
          const tt = { ...t, tiers: t.tiers.slice() }; tt.tiers[p]++;
          const c2 = c1 + g.upgradeCost(tt, q);
          if (c2 <= g.money) cands.push({ k: 'u2', i, p, q, cost: c2 });
        }
      });
      // de la más barata a la más cara (a igual precio, en el orden de cands): la primera que
      // salva es la elegida y las demás no se ensayan; si ninguna salva, se ensayaron todas
      const res = new Array(cands.length);
      let salva = null;
      for (const i of cands.map((a, i) => i).sort((i, j) => cands[i].cost - cands[j].cost)) {
        res[i] = [cands[i], this.ensaya(modo, acc.concat([cands[i]]))];
        if (res[i][1].perdidas === 0) { salva = res[i]; break; }
      }
      if (salva) { acc.push(salva[0]); best = salva[1]; break; }
      let el = null, sc = 0;
      for (const [a, x] of res) { const v = (best.perdidas - x.perdidas) / a.cost; if (v > sc) { sc = v; el = [a, x]; } }
      if (!el) break;
      acc.push(el[0]); best = el[1];
    }
    return acc;
  }

  // Una partida entera. Devuelve el resumen.
  juega(verRondas) {
    const filas = [];
    let g = this.game, reintentos = 3, primeraDerrota = null, foto = null;
    const vidasPerdidas = new Array(10).fill(0);
    while (g.round < (this.op.hasta || PD.MAX_ROUND)) {
      this.vetadas = {};
      if (this.est.humana) { this.rehaceDe(JSON.parse(JSON.stringify(g.snapshot())), g.rs, g); g = this.game; }
      this.plan = null;
      this.modo = this.elegir();
      this.vetadas = {};
      this.planea(this.modo, this.plan);
      foto = JSON.stringify(g.snapshot());
      // lo del bot al empezar la ronda (un reintento vuelve aquí: el guion y las torres de la
      // foto, aunque a mitad de la ronda haya vendido o puesto alguna)
      const fotoBot = { ids: g.towers.map(t => t.id), mem: new Map([...this.mem].map(([k, m]) => [k, { ...m, dealt: m.dealt.slice() }])), gi: this.gi, gTorres: this.gTorres && this.gTorres.slice() };
      for (const t of g.towers) this.mem.get(t.id).antes = t.dealt;
      const r = g.round + 1;
      // --ayuda N: hasta la ronda N las vidas no se acaban (se cuentan igual las que se pierden)
      const ayuda = r <= AYUDA, vidasReal = g.lives;
      if (ayuda) g.lives = 1e9;
      const vidas0 = g.lives;
      const fugas = {};
      g.emit = ev => { if (ev.type === 'leak') fugas[ev.quien] = (fugas[ev.quien] || 0) + ev.amount; };
      const leak = g.leak.bind(g);
      g.leak = e => { const ev = g.emit; g.emit = x => ev({ ...x, quien: e.type }); leak(e); g.emit = ev; };
      if (g.pactoPendiente()) { eligePacto(g); this.turno(); }
      g.startRound();
      let pasos = 0, avance = 0;
      while (g.active && !g.over && pasos < 60 * 900) {
        this.enRonda(pasos);
        g.update(STEP); pasos++;
        if (g.era3 && pasos % 30 === 0) lanzaPoder(g);
        if (pasos % 10 === 0) for (const e of g.enemies) { const pr = e.dist / g.paths[e.path].len; if (pr > avance) avance = pr; }
      }
      for (const t of g.towers) { const m = this.mem.get(t.id); m.dealt.push(t.dealt - m.antes); }
      const perdidas = Math.max(0, vidas0 - g.lives);
      if (ayuda) g.lives = vidasReal;
      vidasPerdidas[Math.min(9, Math.floor((r - 1) / 10))] += perdidas;
      this.presion = perdidas > 0 || avance > 0.85;
      this.calibra();
      const fila = { r, oro: Math.round(g.money), vidas: g.lives, avance: Math.round(avance * 100), seg: Math.round(pasos / 60), torres: g.towers.length, invertido: Math.round(g.towers.reduce((a, t) => a + t.spent, 0)) };
      filas.push(fila);
      if (verRondas) console.log(`  r${String(r).padStart(3)}  oro ${String(fila.oro).padStart(7)}  vidas ${String(fila.vidas).padStart(4)}  avance ${String(fila.avance).padStart(3)}%  ${String(fila.seg).padStart(3)} s  torres ${String(fila.torres).padStart(2)}  invertido ${fila.invertido}` +
        (g.over ? '  ✗ PERDIDA' : '') + (args.includes('--fugas') && Object.keys(fugas).length ? '  fugas ' + JSON.stringify(fugas) : '') +
        (args.includes('--fugas') && (r % 5 === 0 || g.over) ? '\n      ' + g.towers.map(t => t.type + t.tiers.join('')).join(' ') + '  [' + this.modo + ']' : ''));
      if (g.over) {
        if (primeraDerrota === null) primeraDerrota = r;
        if (reintentos <= 0) break;
        reintentos--;
        const snap = JSON.parse(foto); snap.continues = reintentos;
        this.mem = fotoBot.mem; this.gi = fotoBot.gi; this.gTorres = fotoBot.gTorres;
        this.recarga(snap, { towers: fotoBot.ids.map(id => ({ id })) });
        g = this.game;
      }
    }
    const G = this.game;
    const tarde = filas.filter(f => f.r > 60);
    return {
      reino: PD.LEVELS[this.li].short, estrategia: this.nombre, semilla: this.semilla,
      ronda: G.round, gano: !!G.won && !G.over, primeraDerrota, reintentosUsados: 3 - reintentos,
      vidasFinal: G.lives, vidasMax: PD.LEVELS[this.li].lives, vidasPerdidas,
      avanceMedio: Math.round(filas.reduce((a, f) => a + f.avance, 0) / Math.max(1, filas.length)),
      avanceTarde: tarde.length ? Math.round(tarde.reduce((a, f) => a + f.avance, 0) / tarde.length) : null,
      heroe: (G.towers.find(t => t.def.hero) || { tiers: null }).tiers,
      filas
    };
  }
  // «humana», al principio: la mejor partida de una persona en este reino, jugada a jugada
  // (las de las rondas que ya tocan, en orden; si no alcanza el oro, ahorra como ella).
  // Devuelve si sigue en el guion (entonces no gasta por su cuenta).
  // la mejor partida de una persona en este reino, si alguien lo ganó
  guionPropio() {
    const gu = LIBRO.guiones && LIBRO.guiones[PD.Prueba.REINOS[this.li]];
    return gu ? gu.jugadas : null;
  }
  // Hace lo del guion hasta la ronda r. Lo que la persona hizo durante una ronda espera a esa
  // ronda y a su paso (`pasos`, los de la ronda en curso; sin él, se está entre rondas).
  sigueGuion(r, pasos) {
    if (!this.est.humana || !this.guion || r > GUION) return false;
    const g = this.game, J = this.guion, cur = g.round + 1;
    this.gi = this.gi || 0; this.gTorres = this.gTorres || [];
    const torre = n => { const id = this.gTorres[n]; return id === undefined ? null : g.towers.find(t => t.id === id) || null; };
    // Lo que el bot puso por su cuenta (al rescatar una ronda) le quita oro al guion: con el
    // guion de este reino, se vende si con eso alcanza lo que toca.
    const extras = () => g.towers.filter(t => !this.gTorres.includes(t.id) && !t.def.hero).sort((x, y) => g.sellValue(x) - g.sellValue(y));
    const alcanza = costo => g.money + extras().reduce((a, t) => a + g.sellValue(t), 0) >= costo;
    const paga = costo => {
      if (g.money >= costo) return true;
      if (!alcanza(costo)) return false;
      for (const t of extras()) { if (g.money >= costo) break; g.sell(t); this.mem.delete(t.id); }
      return true;
    };
    while (this.gi < J.length && J[this.gi][0] <= r) {
      const [ronda, cuando, k, a, b, c] = J[this.gi];
      if (process.env.PD_DEBUG > 1) console.log(`      guion ${this.gi}: ${JSON.stringify(J[this.gi])} oro ${Math.round(g.money)} paso ${pasos}`);
      if (cuando >= 0 && ronda >= cur && (pasos === undefined || ronda > cur || cuando > pasos)) return true;
      if (k === 'p') {
        if (!paga(g.towerCost ? g.towerCost(a) : PD.TOWERS[a].cost)) return true;
        const s = b === undefined ? this.sitio(a) : [b, c];
        const t = s && g.canPlace(a, s[0], s[1]) ? g.place(a, s[0], s[1]) : null;
        if (t) {
          this.mem.set(t.id, { cov: this.cobertura(t.x, t.y, t.s.range || 110, true), dealt: [], antes: 0 });
          if (!APARTE[a]) this.marca(t);
        }
        this.gTorres.push(t ? t.id : -1);
      } else if (k === 'u') {
        const t = torre(a);
        if (t && g.canUpgrade(t, b)) { if (!paga(g.upgradeCost(t, b))) return true; g.upgrade(t, b); }
      } else if (k === 'v') {
        // vender para pagar lo que sigue: solo si con lo vendido alcanza (si no, se quedaría
        // sin esas torres y sin lo que iba a comprar)
        let oro = g.money, i = this.gi;
        for (; i < J.length && J[i][2] === 'v'; i++) { const v = torre(J[i][3]); if (v) oro += g.sellValue(v); }
        const sig = J[i];
        if (sig) {
          const tt = sig[2] === 'u' ? torre(sig[3]) : null;
          const costo = sig[2] === 'p' ? (g.towerCost ? g.towerCost(sig[3]) : PD.TOWERS[sig[3]].cost) : tt && g.canUpgrade(tt, sig[4]) ? g.upgradeCost(tt, sig[4]) : 0;
          if (!alcanza(costo - (oro - g.money))) return true;
        }
        const t = torre(a); if (t) { g.sell(t); this.mem.delete(t.id); }
      }
      else if (k === 'm') { const t = torre(a); if (t) t.mode = b; }
      else if (k === 'g') g.placeSpikes(a, b);
      else if (k === 'k') { if (g.pactoPendiente()) g.elegirPacto(a); }
      else if (k === 'x') { if (g.poderListo()) g.lanzarPoder(a, b); }
      this.gi++;
    }
    return true;
  }
  // durante la ronda: lo que el guion hace a mitad de ella
  enRonda(pasos) { if (this.guion && this.est.humana && (this.gi || 0) < this.guion.length) this.sigueGuion(this.game.round + 1, pasos); }
  // reintentar: rehace el motor desde la foto del comienzo de la ronda (otra semilla)
  recarga(snap, antes) {
    this.rehaceDe(snap, (this.semilla + 7919 * (4 - snap.continues)) >>> 0, antes || this.game);
  }
  // el juego rehecho desde una foto de `antes` (sus torres, en el mismo orden), con lo que el
  // bot recuerda de cada una pasado a los ids nuevos
  rehaceDe(snap, semilla, antes) {
    const ids = antes.towers.map(t => t.id);
    this.game = new PD.Game(this.li, snap, semilla);
    const mem = new Map(), nuevo = new Map();
    this.game.towers.forEach((t, i) => { const m = this.mem.get(ids[i]); mem.set(t.id, { ...m, dealt: m.dealt.slice() }); nuevo.set(ids[i], t.id); });
    this.mem = mem;
    if (this.gTorres) this.gTorres = this.gTorres.map(id => (nuevo.has(id) ? nuevo.get(id) : -1));
  }
}

function main() {
  const reinoArg = opt('reino', 'todos'), estArg = opt('estrategia', 'mixta');
  const reinos = reinoArg === 'todos' ? [0, 1, 2, 3, 4] : reinoArg === 'nuevos' ? [5, 6, 7, 8, 9] : reinoArg === 'diez' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    : reinoArg === 'tercera' ? [10, 11, 12, 13, 14] : reinoArg === 'cuarta' ? [15, 16, 17, 18, 19] : reinoArg === 'quince' ? [...Array(15).keys()]
    : reinoArg === 'veinte' ? [...Array(20).keys()] : reinoArg.split(',').map(Number);
  const ests = estArg === 'todas' ? Object.keys(ESTRATEGIAS) : estArg.split(',');
  const semillas = String(opt('semilla', '1')).split(',').map(Number);
  const partidas = [];
  for (const li of reinos) for (const est of ests) for (const s of semillas) partidas.push([li, est, s]);
  const linea = x => `${x.reino.padEnd(8)} ${x.estrategia.padEnd(8)} s${x.semilla}  ronda ${String(x.ronda).padStart(3)}${x.gano ? ' GANA' : '     '}  1ª derrota ${x.primeraDerrota ?? '-'}  reintentos ${x.reintentosUsados}  vidas ${x.vidasFinal}/${x.vidasMax}  ` +
    `perdidas/decena [${x.vidasPerdidas.join(' ')}]  avance medio ${x.avanceMedio}% (r>60: ${x.avanceTarde ?? '-'}%)  héroe ${x.heroe ? x.heroe.join('-') : '-'}  ${(x.ms / 1000).toFixed(0)} s`;
  // --hilos N: varias partidas a la vez, cada una en su proceso (por defecto, una por núcleo;
  // con --rondas o --fugas, de a una para que no se mezclen las líneas)
  const porRonda = args.includes('--rondas') || args.includes('--fugas');
  const hilos = Math.min(partidas.length, +opt('hilos', porRonda ? 1 : require('os').cpus().length));
  if (hilos > 1) return enParalelo(partidas, hilos, linea);
  const res = [];
  for (const [li, est, s] of partidas) {
    const t0 = Date.now();
    const bot = new Bot(li, est, s);
    if (args.includes('--rondas')) console.log(`— ${PD.LEVELS[li].short} · ${est} · semilla ${s}`);
    const x = bot.juega(args.includes('--rondas'));
    x.ms = Date.now() - t0;
    res.push(x);
    if (!args.includes('--json')) console.log(linea(x));
  }
  if (args.includes('--json')) console.log(JSON.stringify(res));
}
// Cada partida en un proceso hijo (el mismo script con --json y --hilos 1); los resultados
// salen en el orden de las partidas, cada uno apenas terminan las anteriores.
function enParalelo(partidas, hilos, linea) {
  const { execFile } = require('child_process');
  const quita = { reino: 1, estrategia: 1, semilla: 1, hilos: 1 };
  const base = [];
  for (let i = 0; i < args.length; i++) {
    const k = args[i].startsWith('--') && args[i].slice(2);
    if (quita[k]) { i++; continue; }
    if (k === 'json') continue;
    base.push(args[i]);
  }
  const res = new Array(partidas.length);
  let sig = 0, impresas = 0;
  const imprime = () => {
    while (impresas < partidas.length && res[impresas]) { if (!args.includes('--json')) console.log(linea(res[impresas])); impresas++; }
    if (impresas === partidas.length && args.includes('--json')) console.log(JSON.stringify(res));
  };
  const lanza = () => {
    if (sig >= partidas.length) return;
    const i = sig++, [li, est, s] = partidas[i];
    const hijo = [__filename, ...base, '--reino', String(li), '--estrategia', est, '--semilla', String(s), '--json', '--hilos', '1'];
    execFile(process.execPath, hijo, { maxBuffer: 1 << 28 }, (err, out, errOut) => {
      if (err) { process.stderr.write(`partida ${PD.LEVELS[li].short} ${est} s${s}: ${errOut || err.message}\n`); process.exitCode = 1; res[i] = null; }
      else res[i] = JSON.parse(out.trim().split('\n').pop())[0];
      if (!res[i]) res[i] = { reino: PD.LEVELS[li].short, estrategia: est, semilla: s, ronda: 0, gano: false, reintentosUsados: '-', vidasFinal: '-', vidasMax: '-', vidasPerdidas: [], avanceMedio: '-', ms: 0, error: true };
      imprime();
      lanza();
    });
  };
  for (let k = 0; k < hilos; k++) lanza();
}
if (require.main === module) main();
module.exports = { Bot, ESTRATEGIAS };
