/* Boxhead — los datos del juego: armas y cuándo se ganan, mejoras,
   enemigos, aspectos y mapas. Puro (UMD en `BoxheadDatos`), así que corre en
   Node y los tests lo recorren sin navegador.

   **Las armas se ganan con el multiplicador**, como en el original: cada
   baja sube el multiplicador en uno y rellena la barra de combo; la barra se
   vacía sola y, cada vez que llega a cero, el multiplicador baja uno y la
   barra se rellena a medias (`bajadaCombo`), hasta volver a ×1. Lo que se
   desbloquea no se pierde: cuenta el multiplicador más alto alcanzado.
   En el modo versus se empieza con todo.

   Los ids de arma no se renumeran: viajan en los golpes de la malla. */
(function (raiz, fab) {
  if (typeof module === 'object' && module.exports) module.exports = fab();
  else raiz.BoxheadDatos = fab();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TS = 32;

  /* d: daño por impacto · cad: segundos entre disparos · ini: munición al
     ganarla · caja: lo que da una caja de munición · max: tope · alc:
     alcance de la bala · r: radio de explosión · tipo: cómo dispara. */
  const ARMAS = [
    { id: 0, nombre: 'Pistola', tipo: 'bala', d: 12, cad: 0.32, ini: Infinity, caja: 0, max: Infinity, alc: 360, desbloquea: 1 },
    { id: 1, nombre: 'Uzi', tipo: 'bala', d: 9, cad: 0.08, ini: 150, caja: 100, max: 400, alc: 340, desv: 0.06, desbloquea: 5 },
    { id: 2, nombre: 'Escopeta', tipo: 'perdigon', d: 9, cad: 0.75, ini: 25, caja: 15, max: 60, alc: 220, perdigones: 7, abre: 0.42, desbloquea: 10 },
    { id: 3, nombre: 'Barriles', tipo: 'objeto', obj: 'barril', d: 120, r: 84, cad: 0.4, ini: 5, caja: 3, max: 15, desbloquea: 15 },
    { id: 4, nombre: 'Granadas', tipo: 'granada', d: 90, r: 70, cad: 0.6, ini: 10, caja: 5, max: 30, desbloquea: 20 },
    { id: 5, nombre: 'Muro falso', tipo: 'objeto', obj: 'muro', vida: 160, cad: 0.35, ini: 10, caja: 5, max: 30, desbloquea: 25 },
    { id: 6, nombre: 'Cohetes', tipo: 'cohete', d: 110, r: 72, cad: 0.9, ini: 10, caja: 5, max: 30, vel: 380, desbloquea: 30 },
    { id: 7, nombre: 'Cargas', tipo: 'objeto', obj: 'carga', d: 150, r: 96, cad: 0.35, ini: 5, caja: 3, max: 15, desbloquea: 40 }
  ];

  /* **Cada nivel de multiplicador que no trae arma trae una mejora**, y van
     rotando entre las armas ya ganadas (en orden de id, la última recién
     ganada entra en la rueda sola). Cada arma tiene su lista de mejoras
     (`PASOS`), que recorre en ciclo: más daño, más cadencia, más
     perdigones o más dispersión en la escopeta, explosiones mayores…
     Son multiplicativas y acumulativas, con un tope por estadística; una
     que ya llegó al tope se salta, y un arma con todo al tope sale de la
     rueda. Cada mejora guarda el valor *absoluto* que deja, así `arma()`
     solo tiene que aplicarlas en orden. Se generan una vez, al cargar:
     todos los navegadores sacan la misma lista. */
  const PASOS = {
    0: [['d', 1.15, 'más daño'], ['cad', 0.88, 'disparo más rápido'], ['pen', 1, 'atraviesa un enemigo más'], ['alc', 1.1, 'más alcance']],
    1: [['d', 1.12, 'más daño'], ['cad', 0.9, 'más cadencia'], ['pen', 1, 'atraviesa un enemigo más'], ['desv', 0.8, 'más precisión'], ['max', 1.25, 'más munición']],
    2: [['d', 1.12, 'más daño'], ['perdigones', 1, 'más perdigones'], ['pen', 1, 'perdigones perforantes'], ['cad', 0.88, 'recarga más rápida'], ['abre', 1.12, 'más dispersión'], ['alc', 1.1, 'más alcance']],
    3: [['r', 1.12, 'explosión mayor'], ['d', 1.15, 'más daño'], ['max', 1.3, 'más munición']],
    4: [['r', 1.1, 'explosión mayor'], ['d', 1.15, 'más daño'], ['cad', 0.88, 'lanzamiento más rápido'], ['max', 1.3, 'más munición']],
    5: [['vida', 1.3, 'muros más resistentes'], ['max', 1.3, 'más munición']],
    6: [['d', 1.15, 'más daño'], ['r', 1.1, 'explosión mayor'], ['cad', 0.88, 'recarga más rápida'], ['vel', 1.15, 'cohetes más rápidos']],
    7: [['d', 1.15, 'más daño'], ['r', 1.1, 'explosión mayor'], ['max', 1.3, 'más munición']]
  };
  /* Topes: cad como mucho baja a un tercio, d hasta ×4 (y 500), r 200… */
  function tope(a, k) {
    const b = ARMAS[a.id];
    switch (k) {
      case 'd': return Math.min(b.d * 4, 500);
      case 'cad': return Math.max(b.cad / 3, 0.04);
      case 'alc': return 640;
      case 'desv': return 0.012;
      case 'perdigones': return 16;
      case 'pen': return a.id === 2 ? 2 : 4;
      case 'abre': return 1.1;
      case 'r': return 200;
      case 'vel': return 900;
      case 'max': return b.max * 5;
      case 'vida': return 1200;
    }
    return Infinity;
  }
  const baja = k => k === 'cad' || k === 'desv';
  const MULTI_MEJORAS = 200;
  function generaMejoras() {
    const out = [], est = {}, ciclo = {}, armasEn = new Set(ARMAS.map(a => a.desbloquea));
    for (const a of ARMAS) { est[a.id] = Object.assign({}, a); ciclo[a.id] = 0; }
    let cursor = -1;
    for (let m = 2; m <= MULTI_MEJORAS; m++) {
      if (armasEn.has(m)) continue;
      const libres = ARMAS.filter(a => a.desbloquea < m).map(a => a.id);
      let hecho = false;
      for (let intento = 0; intento < libres.length && !hecho; intento++) {
        const i = libres.find(x => x > cursor);
        const id = i === undefined ? libres[0] : i;
        cursor = id;
        const a = est[id], lista = PASOS[id];
        for (let j = 0; j < lista.length && !hecho; j++) {
          const [k, f, txt] = lista[(ciclo[id] + j) % lista.length];
          const lim = tope(a, k), antes = a[k];
          let v = k === 'perdigones' || k === 'pen' ? (antes || 0) + 1 : antes * f;
          v = baja(k) ? Math.max(v, lim) : Math.min(v, lim);
          if (k === 'perdigones' || k === 'pen' || k === 'max' || k === 'vida' || k === 'd' || k === 'alc' || k === 'vel' || k === 'r') v = Math.round(v);
          else v = Math.round(v * 1000) / 1000;
          if (v === antes) continue;
          ciclo[id] = (ciclo[id] + j + 1) % lista.length;
          a[k] = v;
          const valores = { [k]: v };
          if (k === 'max' && a.caja) { a.caja = Math.round(a.caja * f); valores.caja = a.caja; }
          out.push(Object.assign({ m, id: 'm' + m, arma: id, k, txt: a.nombre + ': ' + txt }, valores));
          hecho = true;
        }
      }
    }
    return out;
  }
  const MEJORAS = generaMejoras();
  const CAMPOS = ['d', 'cad', 'alc', 'desv', 'perdigones', 'pen', 'abre', 'r', 'vel', 'max', 'caja', 'vida'];

  /* Un arma con las mejoras que ya se tienen aplicadas. */
  function arma(id, mejoras) {
    const base = ARMAS[id];
    if (!base) return null;
    const a = Object.assign({}, base);
    if (mejoras && mejoras.size) for (const m of MEJORAS) if (m.arma === id && mejoras.has(m.id)) {
      for (const k of CAMPOS) if (m[k] !== undefined) a[k] = m[k];
    }
    return a;
  }

  /* Cuántas mejoras tiene cada arma (para el inventario). */
  function nivelArma(id, mejoras) {
    let n = 0;
    if (mejoras) for (const m of MEJORAS) if (m.arma === id && mejoras.has(m.id)) n++;
    return n;
  }

  /* Lo que se gana al llegar a `mul` por primera vez. */
  function premios(antes, ahora) {
    const out = [];
    for (const a of ARMAS) if (a.desbloquea > antes && a.desbloquea <= ahora) out.push({ arma: a.id, txt: '¡Nueva arma! ' + a.nombre });
    for (const m of MEJORAS) if (m.m > antes && m.m <= ahora) out.push({ mejora: m.id, txt: m.txt });
    return out;
  }

  /* El combo: cuánto dura la barra llena con este multiplicador. */
  const duracionCombo = mul => Math.max(1.6, 4 - mul * 0.04);
  /* Al vaciarse, el multiplicador baja uno y la barra vuelve a la mitad. */
  const bajadaCombo = mul => duracionCombo(mul) * 0.5;
  /* Puntos por baja (× multiplicador), por tipo de enemigo. */
  const PUNTOS = [10, 20, 15, 40, 25, 25, 300, 300, 300, 300, 300, 1000, 1000, 1000, 1000, 1000];

  /* ---------- enemigos ----------
     `desde`: primer nivel en que aparece · `parte`/`tope`: cuánto crece su
     parte del nivel por nivel y hasta dónde · `velMax`: su techo de
     velocidad · `masa`: cuánto le mueve un impacto (1 = como un zombi). */
  const ENEMIGOS = [
    { id: 0, nombre: 'Zombi', vida: 40, vel: 46, velMax: 74, golpe: 9, radio: 11, desde: 1, parte: 0, tope: 0, masa: 1 },
    { id: 1, nombre: 'Diablo', vida: 110, vel: 58, velMax: 84, golpe: 12, radio: 12, fuego: 14, cadFuego: 2.6, alcFuego: 320, desde: 3, parte: 0.05, tope: 0.3, masa: 0.8 },
    { id: 2, nombre: 'Corredor', vida: 24, vel: 86, velMax: 112, golpe: 6, radio: 10, desde: 4, parte: 0.04, tope: 0.22, masa: 1.3 },
    { id: 3, nombre: 'Bruto', vida: 260, vel: 34, velMax: 52, golpe: 22, radio: 15, desde: 7, parte: 0.025, tope: 0.12, masa: 0.2 },
    { id: 4, nombre: 'Explosivo', vida: 30, vel: 54, velMax: 76, golpe: 0, radio: 11, explota: 46, radioExplota: 66, desde: 5, parte: 0.03, tope: 0.14, masa: 1 },
    { id: 5, nombre: 'Escupidor', vida: 70, vel: 40, velMax: 60, golpe: 7, radio: 11, fuego: 10, cadFuego: 2.2, alcFuego: 260, acido: true, desde: 9, parte: 0.03, tope: 0.14, masa: 0.9 },
    /* Jefes. Nunca salen de la mezcla (`desde: Infinity`): los pone el
       director al empezar un nivel que termina en 5 (mini) o en 0 (grande).
       `radio` es el de chocar con los muros, como los demás, para que
       quepan por los pasillos; `rg` es el de recibir balas y morder, y
       `talla` la escala del dibujo. `hab` dice qué hace y `cd` cada cuánto. */
    { id: 6, nombre: 'El Carnicero', jefe: 'mini', hab: 'embiste', cd: 4.5, vida: 900, vel: 50, velMax: 70, golpe: 20, radio: 13, rg: 20, talla: 1.6, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'se agacha, brilla y embiste en línea recta' },
    { id: 7, nombre: 'El Nigromante', jefe: 'mini', hab: 'invoca', cd: 6.5, vida: 700, vel: 38, velMax: 56, golpe: 12, radio: 12, rg: 18, talla: 1.45, fuego: 12, cadFuego: 3, alcFuego: 300, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'levanta zombis del suelo a su alrededor' },
    { id: 8, nombre: 'La Bruja', jefe: 'mini', hab: 'anillo', cd: 4, vida: 750, vel: 44, velMax: 62, golpe: 12, radio: 12, rg: 18, talla: 1.45, fuego: 14, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'lanza anillos de fuego; dos seguidos cuando está herida' },
    { id: 9, nombre: 'La Larva Madre', jefe: 'mini', hab: 'cria', cd: 5, vida: 1000, vel: 30, velMax: 44, golpe: 16, radio: 14, rg: 22, talla: 1.7, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'pare corredores, y al morir revienta en más' },
    { id: 10, nombre: 'El Espectro', jefe: 'mini', hab: 'salta', cd: 5, vida: 650, vel: 60, velMax: 80, golpe: 14, radio: 11, rg: 17, talla: 1.4, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'se desvanece y reaparece a tu lado' },
    { id: 11, nombre: 'El Coloso', jefe: 'grande', hab: 'pisoton', cd: 5, vida: 3200, vel: 36, velMax: 52, golpe: 30, radio: 14, rg: 28, talla: 2.2, onda: 110, dOnda: 45, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'pisa el suelo y lanza una onda; marca el círculo antes' },
    { id: 12, nombre: 'La Reina de la Colmena', jefe: 'grande', hab: 'enjambre', cd: 6, vida: 2800, vel: 32, velMax: 46, golpe: 22, radio: 14, rg: 26, talla: 2, fuego: 12, cadFuego: 2.5, alcFuego: 340, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'pare enjambres de corredores y explosivos' },
    { id: 13, nombre: 'El Archidiablo', jefe: 'grande', hab: 'espiral', cd: 6, vida: 3000, vel: 42, velMax: 58, golpe: 24, radio: 14, rg: 26, talla: 2.1, fuego: 16, cadFuego: 1.6, alcFuego: 420, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'gira soltando una espiral de fuego y dispara en abanico' },
    { id: 14, nombre: 'La Hidra', jefe: 'grande', hab: 'hidra', cd: 3.5, vida: 3400, vel: 30, velMax: 44, golpe: 22, radio: 14, rg: 28, talla: 2.2, fuego: 12, acido: true, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'escupe ácido en cinco direcciones; al perder vida le brotan escupidores' },
    { id: 15, nombre: 'El Titán', jefe: 'grande', hab: 'roca', cd: 3, vida: 4000, vel: 34, velMax: 50, golpe: 34, radio: 14, rg: 30, talla: 2.4, onda: 70, dOnda: 40, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'lanza rocas que estallan donde caen; herido, se enfurece' }
  ];
  /* Los jefes rotan en este orden: 5, 15, 25, 35, 45 los minis y 10, 20,
     30, 40, 50 los grandes; después vuelve a empezar. */
  const MINIS = [6, 7, 8, 9, 10];
  const GRANDES = [11, 12, 13, 14, 15];
  function jefeDeNivel(n) {
    n = Math.floor(n);
    if (!(n > 0)) return -1;
    if (n % 10 === 5) return MINIS[((n - 5) / 10) % MINIS.length];
    if (n % 10 === 0) return GRANDES[(n / 10 - 1) % GRANDES.length];
    return -1;
  }
  const esJefe = k => !!(ENEMIGOS[k] && ENEMIGOS[k].jefe);
  /* Vida del jefe: crece con el nivel (cada vuelta de la rotación pega más)
     y con la gente en la sala, porque lo reparten entre todos. */
  const vidaJefe = (k, n, np) => Math.round(ENEMIGOS[k].vida * (1 + 0.06 * (n - 1)) * (1 + 0.6 * (Math.max(1, np) - 1)));
  /* La dificultad sube recta y despacio: cada nivel un poco más de vida,
     velocidad, golpe, cantidad y ritmo. Antes subía el doble de rápido en
     cantidad y ritmo a la vez, y del nivel 8 al 12 pasaba de fácil a muro. */
  const vidaEnemigo = (k, n) => Math.round(ENEMIGOS[k].vida * (1 + 0.08 * (n - 1)));
  const velEnemigo = (k, n) => Math.min(ENEMIGOS[k].vel + 1 * (n - 1), ENEMIGOS[k].velMax);
  const golpeNivel = (k, n) => Math.round(ENEMIGOS[k].golpe * (1 + 0.02 * (n - 1)));
  const totalNivel = n => Math.min(16 + 4 * (n - 1), 120);
  /* Qué parte del nivel es de cada tipo: cada uno entra en su `desde` y
     crece de a poco; los zombis comunes son siempre al menos el 20 %. */
  function mezclaNivel(n) {
    const p = ENEMIGOS.map(e => (e.id && n >= e.desde ? Math.min(e.tope, e.parte * (n - e.desde + 1)) : 0));
    const suma = p.reduce((a, b) => a + b, 0);
    if (suma > 0.8) for (let i = 1; i < p.length; i++) p[i] *= 0.8 / suma;
    p[0] = 1 - p.reduce((a, b) => a + b, 0);
    return p;
  }
  /* El tipo de un enemigo nuevo del nivel n, con r en [0, 1). */
  function tipoEnemigo(n, r) {
    const p = mezclaNivel(n);
    let acc = 0;
    for (let k = 0; k < p.length; k++) { acc += p[k]; if (r < acc) return k; }
    return 0;
  }
  const parteDiablos = n => mezclaNivel(n)[1];
  /* Cuántos caben a la vez, para que el nivel 20 no sea una alfombra. */
  const maxVivos = (n, jug) => Math.min(14 + 3 * jug + n, 48);
  const ritmoNivel = n => Math.max(0.35, 1.0 - 0.03 * (n - 1));

  /* ---------- tienda y armadura ----------
     Se compra con los puntos, de pie junto a una estación de suministros
     (`$` en el mapa). `potencia` sube el daño de todas las armas un 10 %
     por nivel; cada nivel cuesta más. */
  const ARMADURA = { max: 100, absorbe: 0.6, caja: 35 };
  const TIENDA = [
    { id: 'balas', nombre: 'Munición', tecla: 'B', precio: 250, txt: 'rellena todas tus armas' },
    { id: 'armadura', nombre: 'Armadura', tecla: 'R', precio: 400, txt: '+50 de armadura' },
    { id: 'botiquin', nombre: 'Botiquín', tecla: 'H', precio: 300, txt: '+50 de vida' },
    { id: 'potencia', nombre: 'Potencia', tecla: 'G', precio: 800, txt: '+10 % de daño', max: 5 }
  ];
  const precioTienda = (id, nivel) => {
    const t = TIENDA.find(x => x.id === id);
    if (!t) return Infinity;
    if (id === 'potencia') return (nivel || 0) >= t.max ? Infinity : t.precio * ((nivel || 0) + 1);
    return t.precio;
  };
  const factorPotencia = nivel => 1 + 0.1 * Math.max(0, Math.min(5, nivel || 0));
  const ALCANCE_TIENDA = 40;

  /* ---------- aspectos ---------- */
  const SKINS = [
    { id: 'bambo', nombre: 'Bambo', piel: '#f2d2a9', camisa: '#f4f4f4', pantalon: '#3b5b9c', pelo: '#4a2e1b', extra: 'pelo' },
    { id: 'jon', nombre: 'Jon', piel: '#e9c08e', camisa: '#2f6fd6', pantalon: '#2b2b2b', pelo: '#1b1b1b', extra: 'pelo' },
    { id: 'soldado', nombre: 'Soldado', piel: '#d9b083', camisa: '#4f6b32', pantalon: '#3a4a26', pelo: '#3f5528', extra: 'casco' },
    { id: 'medico', nombre: 'Médico', piel: '#f0cfa8', camisa: '#e9f1f1', pantalon: '#6cb6b0', pelo: '#7a4a24', extra: 'gorro' },
    { id: 'ninja', nombre: 'Ninja', piel: '#e6c39a', camisa: '#1d1d24', pantalon: '#1d1d24', pelo: '#1d1d24', extra: 'mascara' },
    { id: 'policia', nombre: 'Policía', piel: '#c99a6c', camisa: '#21386b', pantalon: '#18264a', pelo: '#111', extra: 'gorra' },
    { id: 'payaso', nombre: 'Payaso', piel: '#fafafa', camisa: '#e23b3b', pantalon: '#f3c623', pelo: '#ff7a00', extra: 'nariz' },
    { id: 'robot', nombre: 'Robot', piel: '#b8c2cc', camisa: '#7d8a96', pantalon: '#55606b', pelo: '#e33', extra: 'antena' }
  ];
  const skin = id => SKINS.find(s => s.id === id) || SKINS[0];

  /* ---------- mapas ----------
     `#` muro, `.` suelo, `c` caja fija (también sólida, más baja), `S` por
     donde entran los enemigos, `P` donde aparecen los jugadores, `b` un
     barril explosivo que vuelve a estar al empezar cada nivel y `$` una
     estación de suministros (la tienda). Las filas
     se rellenan con muro hasta la más larga y el borde siempre es muro. */
  const MAPAS = {
    patio: {
      nombre: 'Patio', suelo: ['#bfb79b', '#b3ab8e'], muro: ['#8c8c8c', '#6b6b6b', '#5a5a5a'],
      filas: [
        '################################',
        '#S............SS..............S#',
        '#......$.......................#',
        '#...####..............####.....#',
        '#...#.........cc.........#.....#',
        '#...#....................#.....#',
        '#..............b...............#',
        '#.........#####..#####.........#',
        '#.........#..........#.........#',
        '#..cc.....#..........#.....cc..#',
        'S.....b...#...P..P...#.........S',
        'S.........#...P..P...#...b.....S',
        '#..cc.....#..........#.....cc..#',
        '#.........#..........#.........#',
        '#.........#####..#####.........#',
        '#...............b..............#',
        '#...#....................#.....#',
        '#...#.........cc.........#.....#',
        '#...####..............####.....#',
        '#.......................$......#',
        '#S............SS..............S#',
        '################################'
      ]
    },
    sotano: {
      nombre: 'Sótano', suelo: ['#8d8478', '#847b70'], muro: ['#7a5a43', '#5c4332', '#4a3528'],
      filas: [
        '##################################',
        '#S.......#.....$.....#..........S#',
        '#........#...........#...........#',
        '#........#....c.c....#...........#',
        '#....b.........................cc#',
        '#........#...........#...........#',
        '####.#####...........#####.#######',
        '#........#....#.#....#...........#',
        '#..cc....#...........#.....cc....#',
        'S...........P...b.P..............S',
        'S...........P.....P..............S',
        '#..cc....#...........#.....cc....#',
        '#........#....#.#....#...........#',
        '####.#####...........#####.#######',
        '#........#...........#...........#',
        '#cc.........................b....#',
        '#........#....c.c....#.....$.....#',
        '#........#...........#...........#',
        '#S.......#...........#..........S#',
        '##################################'
      ]
    },
    cruce: {
      nombre: 'Cruce', suelo: ['#7d7d7d', '#737373'], muro: ['#a35a43', '#7d4231', '#653426'],
      filas: [
        '##############SS##############',
        '#....$....#........#.........#',
        '#..####...#........#...####..#',
        '#..####...#...cc...#...####..#',
        '#..####......................#',
        '#.........#...b....#.........#',
        '####..#####........#####..####',
        'S.....b......P..P............S',
        'S............P..P............S',
        '####..#####........#####..####',
        '#.........#....b...#.........#',
        '#..####......................#',
        '#..####...#...cc...#...####..#',
        '#..####...#........#...####..#',
        '#.........#........#....$....#',
        '##############SS##############'
      ]
    },
    fortaleza: {
      nombre: 'Fortaleza', suelo: ['#a7b48c', '#9caa80'], muro: ['#9a9a88', '#76766a', '#5f5f55'],
      filas: [
        '####################################',
        '#S................................S#',
        '#.................b................#',
        '#....############....##########....#',
        '#....#.....$....#....#........#....#',
        '#....#..cc..........P....cc...#....#',
        '#....#..........#....#........#....#',
        '#....####..######....####..####....#',
        '#.b................................#',
        'S.................PP...............S',
        'S.................PP...............S',
        '#................................b.#',
        '#....####..######....####..####....#',
        '#....#..........#....#........#....#',
        '#....#..cc..........P....cc...#....#',
        '#....#..........#....#...$....#....#',
        '#....############....##########....#',
        '#................b.................#',
        '#S................................S#',
        '####################################'
      ]
    },
    laberinto: {
      nombre: 'Laberinto', suelo: ['#9fb0bf', '#94a5b4'], muro: ['#5d6d7e', '#465464', '#37424f'],
      filas: [
        '################################',
        '#S.$...#.........#............S#',
        '#......#...###...#....####.....#',
        '#..##......#.........#.........#',
        '#..#.......#.b..cc...#....##...#',
        '#..#...#####.........#.....#...#',
        '#......#.......####........#...#',
        '###..###..P.P..#.......#####...#',
        'S.........P.P..#...............S',
        '#....cc........#.......cc......#',
        '#........####......####........#',
        '#.......b......#...............#',
        'S......#####...#....P.P...#....S',
        '#..........#...#..b.P.P...#....#',
        '#...##.....#..........#####....#',
        '#....#.........cc..............#',
        '#S...#.....####........#....$.S#',
        '################################'
      ]
    }
  };
  const ORDEN_MAPAS = ['patio', 'sotano', 'cruce', 'fortaleza', 'laberinto'];
  const mapaValido = m => (MAPAS[m] ? m : 'patio');

  /* El mapa listo para jugar: rejilla de sólidos y los puntos marcados. */
  function cargaMapa(id) {
    const M = MAPAS[mapaValido(id)];
    const ancho = Math.max(...M.filas.map(f => f.length)), alto = M.filas.length;
    const celdas = [], spawnsE = [], spawnsP = [], barriles = [], tiendas = [];
    for (let y = 0; y < alto; y++) {
      const fila = M.filas[y].padEnd(ancho, '#');
      for (let x = 0; x < ancho; x++) {
        let c = fila[x];
        const borde = x === 0 || y === 0 || x === ancho - 1 || y === alto - 1;
        if (c === 'S') spawnsE.push({ x: x * TS + TS / 2, y: y * TS + TS / 2, tx: x, ty: y });
        if (c === 'P') spawnsP.push({ x: x * TS + TS / 2, y: y * TS + TS / 2 });
        if (c === 'b') barriles.push({ x: x * TS + TS / 2, y: y * TS + TS / 2 });
        if (c === '$') tiendas.push({ x: x * TS + TS / 2, y: y * TS + TS / 2, tx: x, ty: y });
        if (borde && c !== 'S') c = '#';
        celdas.push(c === '#' ? 1 : c === 'c' ? 2 : 0);
      }
    }
    return { id: mapaValido(id), nombre: M.nombre, suelo: M.suelo, muro: M.muro, ancho, alto, celdas, spawnsE, spawnsP, barriles, tiendas };
  }

  /* Las 8 direcciones, como en el original: 0 = este y en sentido horario. */
  const DIRS = [];
  for (let i = 0; i < 8; i++) DIRS.push([Math.round(Math.cos(i * Math.PI / 4) * 1e6) / 1e6, Math.round(Math.sin(i * Math.PI / 4) * 1e6) / 1e6]);
  const dirDe = (dx, dy) => (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;

  return {
    TS, ARMAS, MEJORAS, PASOS, arma, nivelArma, premios, duracionCombo, bajadaCombo, PUNTOS, ENEMIGOS, MINIS, GRANDES, jefeDeNivel, esJefe, vidaJefe, vidaEnemigo, velEnemigo,
    golpeNivel, totalNivel, mezclaNivel, tipoEnemigo, parteDiablos, maxVivos, ritmoNivel,
    ARMADURA, TIENDA, precioTienda, factorPotencia, ALCANCE_TIENDA, SKINS, skin, MAPAS, ORDEN_MAPAS, mapaValido,
    cargaMapa, DIRS, dirDe
  };
});
