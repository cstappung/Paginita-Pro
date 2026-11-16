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
    { id: 0, nombre: 'Pistola', tipo: 'bala', d: 15, cad: 0.28, ini: Infinity, caja: 0, max: Infinity, alc: 360, desbloquea: 1 },
    { id: 1, nombre: 'Uzi', tipo: 'bala', d: 9, pen: 1, cad: 0.08, ini: 150, caja: 100, max: 400, alc: 340, desv: 0.06, desbloquea: 5 },
    { id: 2, nombre: 'Escopeta', tipo: 'perdigon', d: 13, cad: 0.75, ini: 25, caja: 15, max: 60, alc: 240, perdigones: 8, abre: 0.42, desbloquea: 10 },
    { id: 3, nombre: 'Barriles', tipo: 'objeto', obj: 'barril', d: 120, r: 84, cad: 0.4, ini: 5, caja: 3, max: 15, desbloquea: 15 },
    { id: 4, nombre: 'Granadas', tipo: 'granada', d: 90, r: 70, cad: 0.6, ini: 10, caja: 5, max: 30, desbloquea: 20 },
    { id: 5, nombre: 'Muro falso', tipo: 'objeto', obj: 'muro', vida: 160, cad: 0.35, ini: 10, caja: 5, max: 30, desbloquea: 25 },
    { id: 6, nombre: 'Cohetes', tipo: 'cohete', d: 110, r: 72, cad: 0.9, ini: 10, caja: 5, max: 30, vel: 380, desbloquea: 30 },
    { id: 7, nombre: 'Cargas', tipo: 'objeto', obj: 'carga', d: 150, r: 96, cad: 0.35, ini: 5, caja: 3, max: 15, desbloquea: 40 },
    /* 8 y 9 no son armas del jugador: son los códigos de la mordida y de la
       bola de fuego en los golpes y en el registro de la sala (`a`). Quedan
       aquí para que `ARMAS[id]` siga valiendo por id; lo que recorre las
       armas del jugador usa `ARMAS_J`. */
    { id: 8, nombre: 'Mordida', tipo: 'enemigo', d: 0, desbloquea: Infinity },
    { id: 9, nombre: 'Bola de fuego', tipo: 'enemigo', d: 0, desbloquea: Infinity },
    /* Fase 3.3. `llama`: quema todo lo que hay en un cono corto (`alc`,
       `abre`), atravesando. `gira` (minigun): la cadencia arranca a un 30 %
       y sube mientras se mantiene el gatillo. `rayo`: pega al primero que
       ve delante y salta a `saltos` más, cada uno a menos de `salto` px,
       perdiendo un 20 % por salto. */
    { id: 10, nombre: 'Lanzallamas', tipo: 'llama', d: 6, cad: 0.06, ini: 200, caja: 100, max: 400, alc: 130, abre: 0.55, desbloquea: 60 },
    { id: 11, nombre: 'Ballesta', tipo: 'bala', d: 70, pen: 4, cad: 0.65, ini: 20, caja: 10, max: 60, alc: 520, desv: 0.004, desbloquea: 80 },
    { id: 12, nombre: 'Minigun', tipo: 'bala', d: 9, pen: 1, cad: 0.045, gira: true, ini: 300, caja: 150, max: 900, alc: 360, desv: 0.1, desbloquea: 120 },
    { id: 13, nombre: 'Rayo', tipo: 'rayo', d: 50, cad: 0.5, ini: 15, caja: 8, max: 45, alc: 280, saltos: 4, salto: 110, desbloquea: 160 }
  ];
  const ARMAS_J = ARMAS.filter(a => a.tipo !== 'enemigo');

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
    7: [['d', 1.15, 'más daño'], ['r', 1.1, 'explosión mayor'], ['max', 1.3, 'más munición']],
    10: [['d', 1.12, 'más daño'], ['alc', 1.1, 'más alcance'], ['abre', 1.1, 'llama más ancha'], ['max', 1.25, 'más combustible']],
    11: [['d', 1.15, 'más daño'], ['pen', 1, 'atraviesa un enemigo más'], ['cad', 0.88, 'recarga más rápida'], ['max', 1.3, 'más virotes']],
    12: [['d', 1.12, 'más daño'], ['desv', 0.85, 'más precisión'], ['max', 1.25, 'más munición'], ['pen', 1, 'atraviesa un enemigo más']],
    13: [['d', 1.15, 'más daño'], ['saltos', 1, 'salta a un enemigo más'], ['salto', 1.12, 'saltos más largos'], ['cad', 0.9, 'descarga más rápida']]
  };
  /* Topes: cad como mucho baja a un tercio, d hasta ×4 (y 500), r 200… */
  function tope(a, k) {
    const b = ARMAS[a.id];
    switch (k) {
      case 'd': return Math.min(b.d * 4, 500);
      case 'cad': return Math.max(b.cad / 3, 0.04);
      case 'alc': return a.tipo === 'llama' ? 200 : 640;
      case 'desv': return 0.012;
      case 'perdigones': return 16;
      case 'pen': return a.id === 2 ? 2 : a.id === 11 ? 6 : 4;
      case 'abre': return a.tipo === 'llama' ? 0.9 : 1.1;
      case 'saltos': return 8;
      case 'salto': return 170;
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
          let v = k === 'perdigones' || k === 'pen' || k === 'saltos' ? (antes || 0) + 1 : antes * f;
          v = baja(k) ? Math.max(v, lim) : Math.min(v, lim);
          if (k === 'perdigones' || k === 'pen' || k === 'saltos' || k === 'salto' || k === 'max' || k === 'vida' || k === 'd' || k === 'alc' || k === 'vel' || k === 'r') v = Math.round(v);
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
  const CAMPOS = ['d', 'cad', 'alc', 'desv', 'perdigones', 'pen', 'abre', 'r', 'vel', 'max', 'caja', 'vida', 'saltos', 'salto'];   // sin `saltos`/`salto`, las mejoras del Rayo no hacían nada

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
    for (const a of ARMAS_J) if (a.desbloquea > antes && a.desbloquea <= ahora) out.push({ arma: a.id, txt: '¡Nueva arma! ' + a.nombre });
    for (const m of MEJORAS) if (m.m > antes && m.m <= ahora) out.push({ mejora: m.id, txt: m.txt });
    return out;
  }

  /* El combo: cuánto dura la barra llena con este multiplicador. */
  const duracionCombo = mul => Math.max(1.6, 4 - mul * 0.04);
  /* Al vaciarse, el multiplicador baja uno y la barra vuelve a la mitad. */
  const bajadaCombo = mul => duracionCombo(mul) * 0.5;
  /* Puntos por baja (× multiplicador), por tipo de enemigo. */
  const PUNTOS = [10, 20, 15, 40, 25, 25, 300, 300, 300, 300, 300, 1000, 1000, 1000, 1000, 1000, 50, 40, 5, 45, 35, 40, 45, 60, 50];
  /* **La chatarra es la moneda de la tienda; los puntos, solo la puntuación.**
     Cada baja propia suelta chatarra (sin multiplicador: con él, pasado el
     nivel 10 la tienda salía gratis). Comprar ya no baja los puntos, que son
     los que deciden el coop, la tabla de la sala y los logros. */
  const chatarraDe = k => Math.round((PUNTOS[k] || 10) * 1.5);
  /* **El multiplicador de chatarra (Fase 4b).** El «×» grande del marcador
     ya no multiplica los puntos (se inflaban sin techo: ×4500 en la ronda
     70): multiplica la chatarra de cada baja. Empieza en ×1,00 y cada baja
     lo sube 0,01 / mc² (cada centésima cuesta más cuanto más alto está), y
     baja solo, más rápido cuanto más alto (∝ (mc − 1)·mc²), y `corte` veces
     más rápido si pasan `pausa` s sin una baja. La racha de bajas (el
     entero de siempre, `yo.mul`) sigue dando armas y mejoras. */
  const MULTI_CHATARRA = { paso: 0.01, decae: 0.004, corte: 6, pausa: 2.5 };
  const subeMultiChatarra = mc => mc + MULTI_CHATARRA.paso / (mc * mc);
  const bajaMultiChatarra = (mc, dt, cortado) => Math.max(1, mc - MULTI_CHATARRA.decae * (mc - 1) * mc * mc * (cortado ? MULTI_CHATARRA.corte : 1) * dt);

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
       `talla` la escala del dibujo. `hab` dice qué hace y `cd` cada cuánto.
       `hab2`: la segunda habilidad, que alterna con la primera bajo el 50 %
       de vida (o desde el comienzo si es corrupto); `invoca`: a quién levanta
       la habilidad 'invoca' (zombis si no dice). */
    { id: 6, nombre: 'El Carnicero', jefe: 'mini', hab: 'embiste', hab2: 'pisoton', onda: 80, dOnda: 30, cd: 4.5, vida: 900, vel: 50, velMax: 70, golpe: 20, radio: 13, rg: 20, talla: 1.6, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'se agacha, brilla y embiste en línea recta' },
    { id: 7, nombre: 'El Nigromante', jefe: 'mini', hab: 'invoca', hab2: 'anillo', cd: 6.5, vida: 700, vel: 38, velMax: 56, golpe: 12, radio: 12, rg: 18, talla: 1.45, fuego: 12, cadFuego: 3, alcFuego: 300, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'levanta zombis del suelo a su alrededor' },
    { id: 8, nombre: 'La Bruja', jefe: 'mini', hab: 'anillo', hab2: 'salta', cd: 4, vida: 750, vel: 44, velMax: 62, golpe: 12, radio: 12, rg: 18, talla: 1.45, fuego: 14, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'lanza anillos de fuego; dos seguidos cuando está herida' },
    { id: 9, nombre: 'La Larva Madre', jefe: 'mini', hab: 'cria', hab2: 'hidra', fuego: 10, acido: true, cd: 5, vida: 1000, vel: 30, velMax: 44, golpe: 16, radio: 14, rg: 22, talla: 1.7, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'pare corredores, y al morir revienta en más' },
    { id: 10, nombre: 'El Espectro', jefe: 'mini', hab: 'salta', hab2: 'embiste', cd: 5, vida: 650, vel: 60, velMax: 80, golpe: 14, radio: 11, rg: 17, talla: 1.4, desde: Infinity, parte: 0, tope: 0, masa: 0.1,
      txt: 'se desvanece y reaparece a tu lado' },
    { id: 11, nombre: 'El Coloso', jefe: 'grande', hab: 'pisoton', hab2: 'roca', cd: 5, vida: 3200, vel: 36, velMax: 52, golpe: 30, radio: 14, rg: 28, talla: 2.2, onda: 110, dOnda: 45, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'pisa el suelo y lanza una onda; marca el círculo antes' },
    { id: 12, nombre: 'La Reina de la Colmena', jefe: 'grande', hab: 'enjambre', hab2: 'anillo', cd: 6, vida: 2800, vel: 32, velMax: 46, golpe: 22, radio: 14, rg: 26, talla: 2, fuego: 12, cadFuego: 2.5, alcFuego: 340, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'pare enjambres de corredores y explosivos' },
    { id: 13, nombre: 'El Archidiablo', jefe: 'grande', hab: 'espiral', hab2: 'invoca', invoca: 1, cd: 6, vida: 3000, vel: 42, velMax: 58, golpe: 24, radio: 14, rg: 26, talla: 2.1, fuego: 16, cadFuego: 1.6, alcFuego: 420, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'gira soltando una espiral de fuego y dispara en abanico' },
    { id: 14, nombre: 'La Hidra', jefe: 'grande', hab: 'hidra', hab2: 'pisoton', onda: 100, dOnda: 40, cd: 3.5, vida: 3400, vel: 30, velMax: 44, golpe: 22, radio: 14, rg: 28, talla: 2.2, fuego: 12, acido: true, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'escupe ácido en cinco direcciones; al perder vida le brotan escupidores' },
    { id: 15, nombre: 'El Titán', jefe: 'grande', hab: 'roca', hab2: 'pisoton', cd: 3, vida: 4000, vel: 34, velMax: 50, golpe: 34, radio: 14, rg: 30, talla: 2.4, onda: 70, dOnda: 40, desde: Infinity, parte: 0, tope: 0, masa: 0.05,
      txt: 'lanza rocas que estallan donde caen; herido, se enfurece' },
    /* El Demoledor: el único que va derecho a tus muros y barriles (`rompe`)
       y los tira a mazazos (`dObj`: cuánto más daño les hace). Los demás
       buscan otro camino y solo rompen si no hay ninguno. Es raro a
       propósito: entra en el nivel 6 y nunca pasa del 5 % de la horda. */
    { id: 16, nombre: 'Demoledor', vida: 190, vel: 40, velMax: 58, golpe: 14, radio: 13, rompe: true, dObj: 4, desde: 6, parte: 0.01, tope: 0.05, masa: 0.35 },
    /* Fase 3: la horda nueva, siempre agregada al final (los índices por k no
       se mueven). `escudo`: lo que absorbe de un golpe de frente (no de una
       explosión) · `grupo`: cuántos salen juntos · `cura`: cuánto cura a los
       de alrededor (fracción de su vida) cada `cd` s, a `alcCura` · `cava`:
       viaja bajo tierra, intocable, y sale cerca del jugador · `vigia`:
       apunta con un láser `apunta` s y dispara una bala `fuego` a `velBala`.
       `lejos`: la distancia que intenta guardar con su blanco. */
    { id: 17, nombre: 'Escudero', vida: 170, vel: 40, velMax: 58, golpe: 12, radio: 12, escudo: 0.8, desde: 12, parte: 0.02, tope: 0.1, masa: 0.5,
      txt: 'un escudo de frente se come el 80 % de cada bala: rodéalo o usa explosivos' },
    { id: 18, nombre: 'Enjambre', vida: 5, vel: 92, velMax: 118, golpe: 4, radio: 7, grupo: 8, desde: 14, parte: 0.02, tope: 0.07, masa: 1.6,
      txt: 'salen de a ocho y caen de un tiro: la escopeta y las explosiones los barren' },
    { id: 19, nombre: 'Chamán', vida: 120, vel: 36, velMax: 52, golpe: 8, radio: 11, cura: 0.25, alcCura: 120, cd: 2.6, lejos: 190, desde: 16, parte: 0.015, tope: 0.06, masa: 0.8,
      txt: 'se queda atrás curando a la horda: mátalo primero' },
    { id: 20, nombre: 'Excavador', vida: 150, vel: 72, velMax: 92, golpe: 16, radio: 11, cava: true, desde: 20, parte: 0.015, tope: 0.06, masa: 0.6,
      txt: 'avanza bajo tierra; el suelo se agrieta un segundo antes de que salga' },
    { id: 21, nombre: 'Vigía', vida: 90, vel: 38, velMax: 54, golpe: 6, radio: 10, vigia: true, fuego: 18, velBala: 430, apunta: 0.9, cd: 3.6, lejos: 270, alcFuego: 420, desde: 25, parte: 0.015, tope: 0.05, masa: 0.9,
      txt: 'dispara de lejos; antes marca con un láser hacia dónde' },
    /* Fase 4 (la Noche Eterna): tres enemigos de las rondas altas. */
    { id: 22, nombre: 'Tóxico', vida: 140, vel: 40, velMax: 58, golpe: 12, radio: 12, acido: true, charcos: 3, dCharco: 16, desde: 32, parte: 0.015, tope: 0.06, masa: 0.6,
      txt: 'al morir deja charcos de ácido: no los pises' },
    { id: 23, nombre: 'Portaestandarte', vida: 220, vel: 34, velMax: 50, golpe: 10, radio: 13, estandarte: true, alcAura: 130, auraVel: 1.3, auraDef: 0.35, lejos: 150, desde: 38, parte: 0.012, tope: 0.04, masa: 0.4,
      txt: 'los que van con él corren más y aguantan más: mátalo primero' },
    { id: 24, nombre: 'Sombra', vida: 110, vel: 58, velMax: 80, golpe: 15, radio: 10, sombra: true, cd: 5, salto: 70, desde: 45, parte: 0.015, tope: 0.05, masa: 1.1,
      txt: 'se desvanece y reaparece detrás de ti' }
  ];
  /* **Élites** (desde el nivel 12, del 5 % al 12 % de lo que sale de la
     mezcla; nunca jefes ni el enjambre). `el` en el enemigo: 1 blindado
     (más vida), 2 veloz, 3 vampiro (se cura al morder), 4 divisor (al morir
     se parte en dos más chicos), 5 ígneo (revienta al morir). Cada uno con
     su aura (`color`). */
  const ELITES = [null,
    { id: 1, nombre: 'Blindado', vida: 2.2, vel: 1, color: '#9fb8d8' },
    { id: 2, nombre: 'Veloz', vida: 1.2, vel: 1.45, color: '#f2d94e' },
    { id: 3, nombre: 'Vampiro', vida: 1.4, vel: 1.05, cura: 0.2, color: '#e0303a' },
    { id: 4, nombre: 'Divisor', vida: 1.4, vel: 1, partes: 2, color: '#6ee05a' },
    { id: 5, nombre: 'Ígneo', vida: 1.3, vel: 1, revienta: { r: 56, d: 26 }, color: '#ff8a1f' },
    // solo jefes: la segunda vuelta de la rotación (desde el nivel 51) los trae corruptos
    { id: 6, nombre: 'Corrupto', vida: 1.5, vel: 1.2, cd: 0.75, color: '#b04dff', jefe: true }];
  const CORRUPTO_DESDE = 51, ELITE_CORRUPTO = 6;
  const corrupto = n => n >= CORRUPTO_DESDE;
  /* Fase 4 (la Noche Eterna): desde el nivel 26 las élites siguen subiendo,
     hasta un 25 %. Hasta el 25 todo queda exactamente igual. */
  const TARDE = 25;
  const tarde = n => Math.max(0, n - TARDE);
  /* Fase 4b, tercera pendiente: pasada la 55 (donde la segunda topaba) sigue
     subiendo, más despacio: élites hasta un 35 %, ritmo hasta 0,12 s, horda
     hasta 200, velocidad hasta +25 % y golpe +3 % por ronda. Los vivos a la
     vez siguen en 72: más cuesta en rendimiento y en red. */
  const MUY_TARDE = 55;
  const muyTarde = n => Math.max(0, n - MUY_TARDE);
  const parteElites = n => (n < 12 ? 0 : n <= TARDE ? Math.min(0.12, 0.05 + 0.007 * (n - 12)) : n <= MUY_TARDE ? Math.min(0.25, 0.12 + 0.005 * tarde(n)) : Math.min(0.35, 0.25 + 0.004 * muyTarde(n)));
  // ¿Sale élite? `r1` decide si, `r2` cuál (los dos en [0, 1)).
  const eliteDe = (k, n, r1, r2) => (!ENEMIGOS[k] || ENEMIGOS[k].jefe || ENEMIGOS[k].grupo || r1 >= parteElites(n) ? 0 : 1 + Math.min(4, Math.floor(r2 * 5)));
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
  const vidaJefe = (k, n, np) => Math.round(ENEMIGOS[k].vida * (1 + 0.06 * (n - 1) + 0.05 * Math.max(0, n - 30)) * (1 + 0.6 * (Math.max(1, np) - 1)));
  /* Fase 4: el jefe grande ya no llega solo desde la 30 (traía la ronda más
     fácil de todas): viene con parte de la horda, y desde la 60 lo acompaña
     también el mini jefe de la rotación. */
  const escoltaGrande = n => (n < 30 ? 0 : Math.min(0.5, 0.25 + 0.01 * (n - 30)));
  const duoDe = n => (n >= 60 && n % 10 === 0 ? MINIS[(n / 10) % MINIS.length] : -1);
  /* Fase 3 de los corruptos: por debajo del 25 % se enfurecen del todo. */
  const FASE3 = { bajo: 0.25, cd: 0.6, vel: 1.15 };
  /* La dificultad sube recta y despacio: cada nivel un poco más de vida,
     velocidad, golpe, cantidad y ritmo. Antes subía el doble de rápido en
     cantidad y ritmo a la vez, y del nivel 8 al 12 pasaba de fácil a muro. */
  /* **Fase 4, segunda pendiente (desde el 26).** Antes todo lo que aprieta
     topaba entre el 22 y el 31 y solo crecía la vida: los niveles altos
     eran largos, no difíciles. Ahora, pasado el 25, la vida crece mucho más
     despacio (+3 % de la base por nivel en vez de +8 %) y lo que sube es la
     presión: aparecen más rápido (`ritmoNivel`), caben más a la vez
     (`maxVivos`), corren un poco más que su `velMax` y hay más élites. Así
     un nivel alto dura menos y cuesta más. */
  const vidaEnemigo = (k, n) => Math.round(ENEMIGOS[k].vida * (n <= TARDE ? 1 + 0.08 * (n - 1) : 1 + 0.08 * (TARDE - 1) + 0.03 * tarde(n)));
  const velEnemigo = (k, n) => {
    const C = ENEMIGOS[k];
    const extra = m => Math.min(C.velMax * 0.15, 0.5 * tarde(m));
    const mas = n <= TARDE ? 0 : n <= MUY_TARDE ? extra(n) : Math.min(C.velMax * 0.25, extra(MUY_TARDE) + 0.4 * muyTarde(n));
    return Math.min(C.vel + 1 * (n - 1), C.velMax + mas);
  };
  const golpeNivel = (k, n) => Math.round(ENEMIGOS[k].golpe * (1 + 0.02 * (n - 1) + 0.01 * muyTarde(n)));
  /* Fase 3.6, dificultad en sierra: la cantidad y el ritmo de la horda
     suben dentro de cada tramo de cinco niveles y aflojan después de cada
     jefe (el nivel 6, 11, 16… respira). La vida, la velocidad y el golpe
     siguen rectos: lo que sube y baja es cuánta presión hay a la vez, no
     cuánto aguanta cada uno. El nivel del jefe vale 1: no se suma a él. */
  const SIERRA = [0.85, 0.95, 1.05, 1.15, 1];
  const sierra = n => SIERRA[(Math.max(1, Math.floor(n)) - 1) % SIERRA.length];
  const totalNivel = n => Math.round((n <= TARDE ? Math.min(16 + 4 * (n - 1), 120) : n <= MUY_TARDE ? Math.min(120 + 1.5 * tarde(n), 160) : Math.min(160 + muyTarde(n), 200)) * sierra(n));   // la sierra va sobre el tope: sigue en los niveles altos
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
  const topeVivos = n => (n <= TARDE ? 48 : Math.min(72, 48 + Math.floor(0.8 * tarde(n))));
  const maxVivos = (n, jug) => Math.min(14 + 3 * jug + n, topeVivos(n));
  // Desde el 26 el ritmo sigue bajando de 0,35 s hasta 0,16 s (el nivel 50)
  const ritmoNivel = n => (n <= TARDE ? Math.max(0.35, 1.0 - 0.03 * (n - 1)) : n <= MUY_TARDE ? Math.max(0.16, 0.35 - 0.0076 * tarde(n)) : Math.max(0.12, 0.16 - 0.001 * muyTarde(n))) / sierra(n);

  /* ---------- tienda y armadura ----------
     Se compra con la chatarra, de pie junto a una estación de suministros
     (`$` en el mapa). `potencia` sube el daño de todas las armas un 10 %
     por nivel; cada nivel cuesta más. */
  const ARMADURA = { max: 100, absorbe: 0.6, caja: 35 };
  const TIENDA = [
    { id: 'balas', nombre: 'Munición', tecla: 'B', precio: 250, txt: 'rellena todas tus armas' },
    { id: 'armadura', nombre: 'Armadura', tecla: 'R', precio: 400, txt: '+50 de armadura' },
    { id: 'botiquin', nombre: 'Botiquín', tecla: 'H', precio: 300, txt: '+50 de vida' },
    { id: 'potencia', nombre: 'Potencia', tecla: 'G', precio: 800, txt: '+10 % de daño', max: 5 },
    { id: 'blindado', nombre: 'Muro reforzado', tecla: 'M', precio: 450, txt: 'un muro de acero; F lo pone', max: 6 }
  ];
  /* El muro reforzado se compra por unidad (se llevan hasta `max`) y se pone
     con F. Es un muro como los otros —los enemigos lo rodean y el Demoledor
     va a por él—, pero de acero: aguanta lo que seis muros falsos. */
  const MURO_BLINDADO = { vida: 1000, max: 6 };

  /* ---------- mejoras de armas en la tienda ----------
     Aparte de las del multiplicador, cada arma sube hasta `NIVEL_ARMA.max`
     niveles con chatarra (tecla U, el arma en la mano, o clic en la tienda).
     Cada nivel cuesta `sube` veces el anterior y da +15 % de daño, −6 % de
     tiempo entre disparos, +20 % de munición, +6 % de radio de explosión y
     +25 % de vida a los muros. Con el nivel cambia cómo se ve el arma:
     pulida (1–2), dorada (3–4) y de plasma (5). */
  /* `max` es el nivel de la habilidad (★, plasma); desde la ronda `desde`
     (Fase 4, el **Arsenal legendario**) se puede seguir hasta `leyenda`. */
  const NIVEL_ARMA = { max: 5, leyenda: 8, desde: 26, sube: 1.8, base: [300, 500, 600, 500, 600, 400, 800, 800, 0, 0, 900, 1000, 1100, 1300] };
  const RANGOS_ARMA = ['Normal', 'Pulida', 'Pulida', 'Dorada', 'Dorada', 'Plasma', 'Legendaria', 'Legendaria', 'Legendaria'];
  const rangoArma = n => (n > NIVEL_ARMA.max ? 4 : Math.max(0, Math.min(3, n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0)));
  function precioNivelArma(id, nivel, ronda) {
    const n = nivel | 0, b = NIVEL_ARMA.base[id];
    if (!b || n < 0 || n >= NIVEL_ARMA.leyenda || (n >= NIVEL_ARMA.max && !((ronda | 0) >= NIVEL_ARMA.desde))) return Infinity;
    return Math.round(b * Math.pow(NIVEL_ARMA.sube, n) / 50) * 50;
  }
  /* El arma (ya con las mejoras del multiplicador) con `n` niveles de tienda. */
  function conNivel(a, n) {
    n = Math.max(0, Math.min(NIVEL_ARMA.leyenda, n | 0));
    if (!a || !n) return a;
    const b = Object.assign({}, a, { nivel: n });
    if (b.d) b.d = Math.min(500, Math.round(b.d * (1 + 0.15 * n)));
    if (b.cad) b.cad = Math.max(0.03, Math.round(b.cad * (1 - 0.06 * n) * 1000) / 1000);
    if (Number.isFinite(b.max)) { b.max = Math.round(b.max * (1 + 0.2 * n)); b.caja = Math.round((b.caja || 0) * (1 + 0.2 * n)); }
    if (b.r) b.r = Math.min(200, Math.round(b.r * (1 + 0.06 * n)));
    if (b.vida) b.vida = Math.min(1200, Math.round(b.vida * (1 + 0.25 * n)));
    return b;
  }
  /* ---------- habilidad de nivel máximo ----------
     Un arma al nivel 5 de tienda (plasma) gana una habilidad propia. Sus
     efectos viven en juego.js detrás de `especial(id)`; aquí, lo que dice
     la tienda y el aviso. Cambiar uno cambia la simulación: subir `VE`. */
  const ESPECIALES = {
    0: { nombre: 'Bala perforante', txt: 'Cada 5.º disparo atraviesa a todos y pega el doble.', cada: 5, por: 2 },
    1: { nombre: 'Ráfaga doble', txt: 'Dispara dos balas por cada una que gasta.' },
    2: { nombre: 'Doble cartucho', txt: 'Cada disparo suelta una segunda descarga gratis.', tras: 0.13 },
    3: { nombre: 'Barril doble', txt: 'Pone dos barriles por cada uno que gasta.' },
    4: { nombre: 'Racimo', txt: 'Al explotar suelta cuatro granaditas.', n: 4, r: 0.55, d: 0.45 },
    5: { nombre: 'Muralla', txt: 'Pone tres muros en fila por cada uno que gasta.' },
    6: { nombre: 'Abanico', txt: 'Lanza tres cohetes en abanico.', abre: 0.2 },
    7: { nombre: 'Minas', txt: 'Las cargas explotan solas si un enemigo pasa cerca.', alc: 0.5 },
    10: { nombre: 'Napalm', txt: 'Deja charcos de fuego que siguen quemando.', r: 26, t: 2.6, cada: 0.3, d: 0.7, tope: 10 },
    11: { nombre: 'Saeta explosiva', txt: 'La saeta estalla donde se detiene.', r: 56, d: 0.8 },
    12: { nombre: 'Al rojo vivo', txt: 'Arranca girando al máximo y sus balas atraviesan dos más.', pen: 2 },
    13: { nombre: 'Tormenta', txt: 'Salta a cuatro enemigos más, más lejos y sin perder fuerza.', saltos: 4, salto: 1.5 },
  };
  const especialDe = (id, nivel) => ((nivel | 0) >= NIVEL_ARMA.max && ESPECIALES[id]) || null;
  /* La munición y el muro reforzado suben un 5 % por ronda, hasta ×2,5 en la
     31 y ×4 después: más adelante se gana más chatarra y la tienda debe
     seguir pesando. El botiquín y la armadura suben por compra (abajo). La
     potencia es permanente y no sube con la ronda. */
  const factorNivelTienda = n => ((n | 0) <= 31 ? Math.min(2.5, 1 + 0.05 * Math.max(0, (n | 0) - 1)) : Math.min(4, 2.5 + 0.03 * ((n | 0) - 31)));   // Fase 4: pasado el 31 sigue subiendo, hasta ×4
  /* **Botiquín y armadura (Fase 4c, el pedido del dueño)**: no suben con la
     ronda; suben con cada compra de la MISMA ronda: el primero vale su
     precio, el segundo ×1,5, el tercero ×3, y después el doble cada vez.
     La ronda siguiente vuelve al precio de base. Así comprar uno es barato
     siempre, y comprar vida sin parar no. */
  const POR_COMPRA = ['botiquin', 'armadura'];
  const factorCompras = comprados => ((comprados | 0) <= 0 ? 1 : 1.5 * Math.pow(2, (comprados | 0) - 1));
  /* La munición cobra por lo que falta: la media de lo que le falta a cada
     arma con munición que tengas (0 = todas llenas), con un mínimo de un
     cuarto del precio. Antes cobraba entero aunque estuvieras lleno. */
  const factorMunicion = falta => (falta <= 0 ? 0 : Math.max(0.25, Math.min(1, falta)));
  const precioTienda = (id, nivel, nivelJuego) => {
    const t = TIENDA.find(x => x.id === id);
    if (!t) return Infinity;
    if (id === 'potencia') return (nivel || 0) >= t.max ? Infinity : t.precio * ((nivel || 0) + 1);
    if (POR_COMPRA.includes(id)) return t.precio;
    return Math.round(t.precio * factorNivelTienda(nivelJuego) / 10) * 10;
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
    { id: 'robot', nombre: 'Robot', piel: '#b8c2cc', camisa: '#7d8a96', pantalon: '#55606b', pelo: '#e33', extra: 'antena' },
    // Las que se ganan con una medalla del juego (`medalla`): sin ella salen con candado en el menú.
    { id: 'cazador', nombre: 'Cazador', piel: '#d8ad7e', camisa: '#a8874f', pantalon: '#5a4a2e', pelo: '#3b2a18', extra: 'sombrero', medalla: 'coloso' },
    { id: 'calavera', nombre: 'Calavera', piel: '#ece6d8', camisa: '#1c1a20', pantalon: '#1c1a20', pelo: '#121015', extra: 'capucha', medalla: 'x100' },
    { id: 'dinamita', nombre: 'Dinamita', piel: '#e6bf92', camisa: '#d8402a', pantalon: '#2a2a30', pelo: '#f3b81f', extra: 'gorra', medalla: 'diez' },
    { id: 'armero', nombre: 'Armero', piel: '#c99a6c', camisa: '#5d646e', pantalon: '#e07a1f', pelo: '#f0a020', extra: 'casco', medalla: 'maestro' },
    { id: 'rey', nombre: 'Rey', piel: '#f0cfa8', camisa: '#6a2a8a', pantalon: '#2a1036', pelo: '#e8c040', extra: 'corona', medalla: 'nivel20' },
    { id: 'careta', nombre: 'Careta', piel: '#e2d2c0', camisa: '#3e4a2e', pantalon: '#2a3020', pelo: '#2a2a2a', extra: 'careta', medalla: 'mapas' },
    // Fase 4: las de las rondas altas
    { id: 'centinela', nombre: 'Centinela', piel: '#c8a07a', camisa: '#2c3a52', pantalon: '#1a2230', pelo: '#9aa6b8', extra: 'casco', medalla: 'nivel40' },
    { id: 'dorado', nombre: 'Dorado', piel: '#f0cfa8', camisa: '#e0b030', pantalon: '#8a6a10', pelo: '#fff2b0', extra: 'corona', medalla: 'nivel50' },
    { id: 'nocturno', nombre: 'Nocturno', piel: '#d8c0a8', camisa: '#1a1640', pantalon: '#0e0c24', pelo: '#3a2c7a', extra: 'mascara', medalla: 'noche' },
    { id: 'espectro', nombre: 'Espectro', piel: '#e4dcf4', camisa: '#4a1e6e', pantalon: '#24102e', pelo: '#b04dff', extra: 'capucha', medalla: 'corrupto' }
  ];
  /* ---------- medallas: los logros del propio juego ----------
     Se ganan jugando (práctica, Solo Club o en línea) y se guardan en el
     dispositivo (`boxhead.medallas`), también sin cuenta. Seis abren un
     personaje (SKINS[].medalla). Las cuenta juego.js (`medalla(id)`). */
  const MEDALLAS = [
    { id: 'jefe', nom: 'Primer jefe', i: '💀', txt: 'Derrota a un jefe.' },
    { id: 'coloso', nom: 'Matagigantes', i: '🗿', txt: 'Derrota a un jefe grande (ronda 10, 20, 30…).' },
    { id: 'x50', nom: 'En llamas', i: '🔥', txt: 'Llega a una racha de 50 bajas.' },
    { id: 'x100', nom: 'Imparable', i: '☠️', txt: 'Llega a una racha de 100 bajas.' },
    { id: 'limpio', nom: 'Sin un rasguño', i: '✨', txt: 'Supera una ronda desde la 3 sin recibir daño.' },
    { id: 'nivel10', nom: 'Dos cifras', i: '🔟', txt: 'Llega a la ronda 10.' },
    { id: 'nivel20', nom: 'Veinte noches', i: '👑', txt: 'Llega a la ronda 20.' },
    { id: 'nivel30', nom: 'Fin del mundo', i: '🌋', txt: 'Llega a la ronda 30.' },
    { id: 'mapas', nom: 'Trotamundos', i: '🗺️', txt: 'Llega a la ronda 10 en los cinco mapas clásicos (Patio, Sótano, Cruce, Fortaleza y Laberinto).' },
    { id: 'arsenal', nom: 'Arsenal', i: '🧰', txt: 'Gana todas las armas en una partida.' },
    { id: 'maestro', nom: 'Maestro armero', i: '🔧', txt: 'Sube un arma al nivel 5 en la tienda.' },
    { id: 'diez', nom: 'Diez de un golpe', i: '💥', txt: 'Haz 10 bajas en el mismo instante.' },
    { id: 'chatarra', nom: 'Chatarrero', i: '🔩', txt: 'Junta 5000 de chatarra en una partida.' },
    { id: 'ventajas', nom: 'A medida', i: '🃏', txt: 'Lleva 10 niveles de ventajas en una partida.' },
    { id: 'epicas', nom: 'Coleccionista', i: '💎', txt: 'Elige tres ventajas épicas en una partida.' },
    { id: 'equipo', nom: 'Escuadrón', i: '👥', txt: 'Llega a la ronda 5 en una sala cooperativa con más gente.' },
    // Fase 4 (la Noche Eterna): metas para después de la ronda 30
    { id: 'nivel40', nom: 'Noche cerrada', i: '🌑', txt: 'Llega a la ronda 40.' },
    { id: 'nivel50', nom: 'Medio siglo', i: '🏅', txt: 'Llega a la ronda 50.' },
    { id: 'nivel75', nom: 'Sin amanecer', i: '🌘', txt: 'Llega a la ronda 75.' },
    { id: 'nivel100', nom: 'Centenario', i: '💯', txt: 'Llega a la ronda 100.' },
    { id: 'noche', nom: 'Hijo de la noche', i: '🌙', txt: 'Sobrevive a una Noche (las rondas 27, 37, 47…).' },
    { id: 'corrupto', nom: 'Purificador', i: '🟣', txt: 'Derrota a un jefe corrupto (desde la ronda 55).' },
    { id: 'intocable', nom: 'Intocable', i: '🛡️', txt: 'Derrota a un jefe grande sin recibir daño en su ronda.' },
    { id: 'x500', nom: 'Leyenda viva', i: '⚡', txt: 'Llega a una racha de 500 bajas.' },
    // Fase 4b: el multiplicador de chatarra
    { id: 'mc2', nom: 'Chatarrero de lujo', i: '🔩', txt: 'Lleva el multiplicador de chatarra a ×2,00.' },
    { id: 'mc25', nom: 'Mina de oro', i: '💰', txt: 'Lleva el multiplicador de chatarra a ×2,50.' }
  ];
  const medallaDe = id => MEDALLAS.find(m => m.id === id) || null;
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
    },
    /* Fase 3.4. La Fábrica tiene cintas transportadoras (`>` `<` `^` `v`:
       suelo que empuja hacia ahí a jugadores y enemigos) y el Apagón está
       a oscuras (`oscuro`: solo se ve cerca de los jugadores y del fuego). */
    planta: {
      nombre: 'Planta', suelo: ['#a9ad9f', '#9fa394'], muro: ['#7d8a6a', '#5f6a50', '#4c553f'],
      filas: [
        '################################',
        '#S.......#..........#.........S#',
        '#..$.....#....cc....#..........#',
        '#..##....#..........#.....##...#',
        '#..##.........b...........##...#',
        '#..............................#',
        '####..######......######..######',
        '#........#..........#..........#',
        '#..cc....#...P..P...#.....cc...#',
        'S..........b..............b....S',
        'S........#...P..P...#..........S',
        '#..cc....#..........#.....cc...#',
        '#........#..........#..........#',
        '####..######......######..######',
        '#..............................#',
        '#..##...........b.........##...#',
        '#..##....#..........#.....##...#',
        '#........#....cc....#.....$....#',
        '#S.......#..........#.........S#',
        '################################'
      ]
    },
    hangar: {
      nombre: 'Hangar', suelo: ['#b9bcc0', '#afb2b6'], muro: ['#8a8f96', '#6b7076', '#565a60'],
      filas: [
        '####################################',
        '#S...............SS...............S#',
        '#..$...............................#',
        '#.......cc..................cc.....#',
        '#.....b.........................b..#',
        '#..............####................#',
        '#...............##.................#',
        '#.......##########..########.......#',
        '#...............##.................#',
        'S.......b.......##.......P..P....b.S',
        'S...............##.......P..P......S',
        '#...............##.................#',
        '#.......##########..########.......#',
        '#...............##.................#',
        '#..............####................#',
        '#..b.............................b.#',
        '#.....cc....................cc.....#',
        '#..............................$...#',
        '#S...............SS...............S#',
        '####################################'
      ]
    },
    fabrica: {
      nombre: 'Fábrica', suelo: ['#b3a58c', '#a89a81'], muro: ['#9a6a3a', '#76502b', '#5f4022'],
      filas: [
        '##################################',
        '#S..............SS..............S#',
        '#.$..............................#',
        '#..>>>>>>>>>>>>....<<<<<<<<<<<<..#',
        '#................................#',
        '#...cc....##..........##....cc...#',
        '#.........##..........##.........#',
        '#..v...............b..........^..#',
        'S..v.......P..P...............^..S',
        'S..v.......P..P...............^..S',
        '#..v.....b....................^..#',
        '#.........##..........##.........#',
        '#...cc....##..........##....cc...#',
        '#................................#',
        '#..>>>>>>>>>>>>....<<<<<<<<<<<<..#',
        '#..............................$.#',
        '#S..............SS..............S#',
        '##################################'
      ]
    },
    apagon: {
      nombre: 'Apagón', suelo: ['#8a8f9a', '#80858f'], muro: ['#4d5566', '#3a4150', '#2c3240'], oscuro: true,
      filas: [
        '################################',
        '#S.....#........#.............S#',
        '#..$...#...b....#....#####.....#',
        '#......#........#........#.....#',
        '#..######...cc......##...#.....#',
        '#...........cc......##.........#',
        '#.....#...............######...#',
        '###...#.....P..P..........#..###',
        'S.....#.....P..P....b.....#....S',
        'S..........................#...S',
        '#...######......####.......#...#',
        '#........#......#..............#',
        '#...b....#..cc..#....######....#',
        '#........#......#.........#....#',
        '#####....#..........b.....#..$.#',
        '#S.............######.........S#',
        '################################'
      ]
    }
  };
  const ORDEN_MAPAS = ['patio', 'sotano', 'cruce', 'fortaleza', 'laberinto', 'planta', 'hangar', 'fabrica', 'apagon'];
  // los cinco de siempre: la medalla Trotamundos (y la skin Careta) se ganan con ellos
  const MAPAS_CLASICOS = ORDEN_MAPAS.slice(0, 5);
  // las cintas: el carácter → hacia dónde empuja (índice de DIRS)
  const CINTAS = { '>': 0, 'v': 2, '<': 4, '^': 6 }, VEL_CINTA = 48;
  const mapaValido = m => (MAPAS[m] ? m : 'patio');

  /* El mapa listo para jugar: rejilla de sólidos y los puntos marcados. */
  function cargaMapa(id) {
    const M = MAPAS[mapaValido(id)];
    const ancho = Math.max(...M.filas.map(f => f.length)), alto = M.filas.length;
    const celdas = [], spawnsE = [], spawnsP = [], barriles = [], tiendas = [], cinta = [];
    let hayCintas = false;
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
        // 0 sin cinta; 1 + la dirección de DIRS
        const ci = CINTAS[c];
        cinta.push(ci === undefined ? 0 : ci + 1);
        if (ci !== undefined) hayCintas = true;
      }
    }
    return { id: mapaValido(id), nombre: M.nombre, suelo: M.suelo, muro: M.muro, ancho, alto, celdas, spawnsE, spawnsP, barriles, tiendas, cinta: hayCintas ? cinta : null, oscuro: !!M.oscuro };
  }

  /* Las 8 direcciones, como en el original: 0 = este y en sentido horario. */
  const DIRS = [];
  for (let i = 0; i < 8; i++) DIRS.push([Math.round(Math.cos(i * Math.PI / 4) * 1e6) / 1e6, Math.round(Math.sin(i * Math.PI / 4) * 1e6) / 1e6]);
  const dirDe = (dx, dy) => (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  /* La dirección de un stick con histéresis: mientras el ángulo no se aleje
     más de `hist` radianes del borde del sector de `prev`, sigue en `prev`.
     Sin esto, un stick entre «derecha» y «abajo-derecha» tiritaba entre las
     dos y el personaje disparaba hacia ambos lados. */
  function dirStick(dx, dy, prev, hist) {
    const a = Math.atan2(dy, dx), d = dirDe(dx, dy);
    if (!(prev >= 0 && prev < 8) || prev === d) return d;
    const c = prev * Math.PI / 4;
    const dif = Math.abs(((a - c + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    return dif <= Math.PI / 8 + (hist === undefined ? 0.14 : hist) ? prev : d;
  }

  /* ---------- ventajas a elección (Fase 2.2) ----------
     Al empezar cada nivel desde el 2 se elige una de tres. Cada una sube de
     a un nivel hasta su `max`; `rar` es la rareza (0 común, 1 rara, 2
     épica) y pesa en el sorteo. Las `equipo` solo salen en una sala con
     más de un jugador. Lo que hace cada una lo aplica juego.js (`vt(id)`);
     aquí están el nombre, el texto y el sorteo, que es puro: recibe el azar
     (en la práctica, el de la semilla) para que una prueba se rehaga igual. */
  const VENTAJAS = [
    // ofensivas
    { id: 'filo', nom: 'Filo', rar: 0, max: 5, tipo: 'ataque', txt: '+10 % de daño' },
    { id: 'gatillo', nom: 'Gatillo ligero', rar: 0, max: 4, tipo: 'ataque', txt: '+8 % de cadencia' },
    { id: 'mira', nom: 'Mira larga', rar: 0, max: 2, tipo: 'ataque', txt: '+15 % de alcance de balas y perdigones' },
    { id: 'critico', nom: 'Golpe crítico', rar: 0, max: 3, tipo: 'ataque', txt: 'Un 10 % más de disparos hace el doble de daño' },
    { id: 'perfora', nom: 'Perforante', rar: 1, max: 2, tipo: 'ataque', txt: 'Balas y perdigones atraviesan un enemigo más' },
    { id: 'ignea', nom: 'Bala ígnea', rar: 1, max: 3, tipo: 'ataque', txt: 'Cada 10 disparos uno estalla (8 y 6 en los niveles siguientes)' },
    { id: 'furia', nom: 'Furia', rar: 1, max: 1, tipo: 'ataque', txt: 'Con menos de 30 de vida haces un 40 % más de daño' },
    { id: 'estallido', nom: 'Estallido', rar: 2, max: 2, tipo: 'ataque', txt: 'Un 15 % de tus bajas revientan y dañan alrededor' },
    // defensivas
    { id: 'piel', nom: 'Piel dura', rar: 0, max: 4, tipo: 'defensa', txt: '−8 % de daño recibido' },
    { id: 'coraza', nom: 'Coraza', rar: 0, max: 3, tipo: 'defensa', txt: '+25 de armadura al empezar cada nivel' },
    { id: 'aguante', nom: 'Aguante', rar: 1, max: 3, tipo: 'defensa', txt: '+20 de vida máxima' },
    { id: 'vampiro', nom: 'Vampirismo', rar: 1, max: 3, tipo: 'defensa', txt: 'Cada baja te cura 1 de vida' },
    { id: 'regenera', nom: 'Regeneración', rar: 1, max: 2, tipo: 'defensa', txt: 'Si no te pegan en 3 s, recuperas 1 de vida por segundo' },
    { id: 'segunda', nom: 'Segunda oportunidad', rar: 2, max: 1, tipo: 'defensa', txt: 'Una vez por partida, un golpe mortal te deja con 40 de vida' },
    // utilidad
    { id: 'iman', nom: 'Imán', rar: 0, max: 2, tipo: 'utilidad', txt: 'La chatarra llega desde más lejos' },
    { id: 'codicia', nom: 'Codicia', rar: 0, max: 3, tipo: 'utilidad', txt: '+20 % de chatarra' },
    { id: 'pies', nom: 'Pies ligeros', rar: 0, max: 3, tipo: 'utilidad', txt: '+7 % de velocidad' },
    { id: 'cargador', nom: 'Cargador grande', rar: 0, max: 2, tipo: 'utilidad', txt: 'Las cajas traen un 30 % más de munición' },
    { id: 'albanil', nom: 'Albañil', rar: 0, max: 2, tipo: 'utilidad', txt: 'Tus muros aguantan un 50 % más' },
    { id: 'polvora', nom: 'Pólvora extra', rar: 0, max: 2, tipo: 'utilidad', txt: 'Tus barriles y cargas: +25 % de radio y daño' },
    { id: 'racha', nom: 'Racha larga', rar: 1, max: 3, tipo: 'utilidad', txt: 'El combo dura un 20 % más' },
    { id: 'dron', nom: 'Dron', rar: 2, max: 2, tipo: 'utilidad', txt: 'Un dron dispara al enemigo más cercano (más seguido en el nivel 2)' },
    // de equipo
    { id: 'compania', nom: 'En compañía', rar: 1, max: 2, tipo: 'equipo', equipo: true, txt: '+15 % de daño con un aliado a menos de 4 casillas' },
    { id: 'relevo', nom: 'Relevo', rar: 1, max: 1, tipo: 'equipo', equipo: true, txt: 'Cuando vuelves al juego, vuelves con 50 de armadura' },
    // legendarias (Fase 4): solo desde la ronda `LEGENDARIAS`
    { id: 'verdugo', nom: 'Verdugo', rar: 3, max: 1, tipo: 'ataque', txt: '+30 % de daño a jefes y élites' },
    { id: 'titan', nom: 'Titán', rar: 3, max: 1, tipo: 'defensa', txt: '+50 de vida máxima y −15 % de daño recibido' },
    { id: 'fenix', nom: 'Fénix', rar: 3, max: 1, tipo: 'defensa', txt: 'Al empezar cada ronda recuperas la mitad de la vida' },
    { id: 'infinita', nom: 'Recámara infinita', rar: 3, max: 1, tipo: 'utilidad', txt: 'Un 30 % de los disparos no gasta munición' }
  ];
  const LEGENDARIAS = 30;
  /* Cuando ya no queda ninguna ventaja por subir, el panel ofrece esto en
     vez de no salir (antes se agotaban hacia la ronda 58). */
  const RELLENO = [
    { id: '_botin', nom: 'Botín', rar: 0, max: Infinity, tipo: 'utilidad', txt: '+1500 de chatarra', chat: 1500 },
    { id: '_blindaje', nom: 'Blindaje', rar: 0, max: Infinity, tipo: 'defensa', txt: 'Armadura completa', arm: 1 },
    { id: '_cura', nom: 'Curación', rar: 0, max: Infinity, tipo: 'defensa', txt: 'Vida completa', vida: 1 }
  ];
  const RAREZAS = ['Común', 'Rara', 'Épica', 'Legendaria'];
  const PESO_RAREZA = [6, 3, 1, 1.2];
  const ventaja = id => VENTAJAS.find(v => v.id === id) || RELLENO.find(v => v.id === id) || null;
  /* Hasta `n` ventajas distintas que aún se pueden subir, por peso de
     rareza. `azar` es una función que da [0, 1). */
  function sorteaVentajas(azar, niveles, equipo, n = 3, ronda = 0) {
    const lib = VENTAJAS.filter(v => ((niveles && niveles[v.id]) || 0) < v.max && (!v.equipo || equipo) && (v.rar < 3 || ronda >= LEGENDARIAS));
    if (!lib.length) return RELLENO.map(v => v.id).slice(0, n);
    const out = [];
    while (out.length < n && lib.length) {
      let tot = 0; for (const v of lib) tot += PESO_RAREZA[v.rar];
      let r = azar() * tot, i = 0;
      for (; i < lib.length - 1; i++) { r -= PESO_RAREZA[lib[i].rar]; if (r < 0) break; }
      out.push(lib.splice(i, 1)[0].id);
    }
    return out;
  }
  const ESPERA_VENTAJA = 10;

  /* ---------- topes del director (en línea) ----------
     Lo más que puede hacer un golpe de cada arma: con todas las mejoras del
     multiplicador, nivel 5 de tienda, potencia 5 y las ventajas que suben
     el daño al tope (filo 5 ×1,5, furia ×1,4, en compañía 2 ×1,3, crítico
     ×2). 60 de base como mínimo: el estallido y la bala ígnea. Barriles y
     cargas suman la pólvora extra (×1,5 en daño y radio). El director
     recorta a esto lo que le llega de los demás. */
  /* Punto débil de los jefes: por la espalda, o mientras avisan una
     habilidad (est 2), cada golpe vale `DEBIL` veces. Entra en el tope. */
  const DEBIL = 1.5;
  /* Caja dorada (Fase 3.3): rara (0,6 % de las bajas, y una por jefe);
     `DORADA_T` s de furia dorada: ×`DORADA` de daño sin gastar munición. */
  const DORADA = 2, DORADA_T = 12, PARTE_DORADA = 0.006;
  const TOPE_VENTAJAS = 1.5 * 1.4 * 1.3 * 2 * DEBIL * DORADA * 1.3;   // el último 1,3: Verdugo (Fase 4)
  function armaTope(w) {
    const a = ARMAS[w];
    if (!a) return null;
    return conNivel(arma(w, new Set(MEJORAS.filter(m => m.arma === w).map(m => m.id))), NIVEL_ARMA.leyenda);
  }
  function topeGolpe(w) {
    const b = armaTope(w);
    if (!b) return 0;
    const polvora = b.obj === 'barril' || b.obj === 'carga' ? 1.5 : 1;
    // la bala perforante de la pistola al máximo pega ×2: si no, el director la recortaba
    const esp = w === 0 ? ESPECIALES[0].por : 1;
    return Math.ceil(Math.max(b.d || 0, 60) * factorPotencia(5) * TOPE_VENTAJAS * polvora * esp);
  }
  /* ---------- el zb comprimido (Fase 3.6) ----------
     Cada enemigo del zb es la tupla [id, k, x, y, pc, d, atk, aturd] y, si
     hace falta (jefe, élite, estado o vida distinta), [max, est, el,
     (ax, ay)]. En vez de una lista de listas viaja `z`, una lista plana de
     seis números por enemigo (id como diferencia con el anterior, k, x, y,
     pc y una bandera d | atk<<3 | aturd<<4 | extra<<5), y `zx`, lo extra
     de los que lo llevan, en el mismo orden. Un 30–40 % menos de JSON con
     la horda llena. `desempacaZb` también lee el `e` de antes. */
  function empacaZb(lista) {
    const z = [], zx = [];
    let prev = 0;
    for (const t of lista) {
      const extra = t.length > 8;
      z.push(t[0] - prev, t[1], t[2], t[3], t[4], (t[5] & 7) | (t[6] ? 8 : 0) | (t[7] ? 16 : 0) | (extra ? 32 : 0));
      prev = t[0];
      if (extra) zx.push(t.slice(8));
    }
    return { z, zx };
  }
  function desempacaZb(zb) {
    if (!zb || typeof zb !== 'object') return [];
    if (Array.isArray(zb.e)) return zb.e.filter(Array.isArray);
    const z = Array.isArray(zb.z) ? zb.z : [], zx = Array.isArray(zb.zx) ? zb.zx : [];
    const out = [];
    let id = 0, j = 0;
    for (let i = 0; i + 5 < z.length; i += 6) {
      id += +z[i] || 0;
      const f = z[i + 5] | 0, t = [id, z[i + 1], z[i + 2], z[i + 3], z[i + 4], f & 7, (f >> 3) & 1, (f >> 4) & 1];
      if (f & 32) { const x = zx[j++]; if (Array.isArray(x)) t.push(...x.slice(0, 5)); }
      out.push(t);
    }
    return out;
  }

  /* ---------- salas en línea: modo jefes y mutadores (Fase 3.5) ----------
     En el modo jefes cada nivel de la sala vale cinco de la rotación: el 1
     es el nivel 5 (el Carnicero), el 2 el 10 (el Coloso)… y desde el 11 los
     jefes vuelven corruptos. Cada uno trae una escolta corta. */
  const PASO_JEFES = 5;
  const nivelJefes = n => PASO_JEFES * Math.max(1, Math.floor(n));
  const escoltaJefes = n => 4 + 2 * Math.max(1, Math.floor(n));
  /* Un mutador cambia una regla de toda la sala. La lista es la misma que
     `BX_MUTADORES` de colabtex/src/juegos/motor.js (un test lo fija). No
     existen en la práctica ni en el Club: la simulación de las tablas no
     los conoce. */
  const MUTADORES = {
    sangre: { nombre: 'Sed de sangre', txt: 'cada baja te cura', cura: 4 },
    cristal: { nombre: 'Cristal', txt: 'pegas y recibes el doble', dano: 2, recibe: 2 },
    veloz: { nombre: 'Horda veloz', txt: 'los enemigos corren un 30 % más', vel: 1.3 },
    municion: { nombre: 'Munición sin fin', txt: 'ningún arma se gasta' },
    blindados: { nombre: 'Blindados', txt: 'la mitad de enemigos, con el triple de vida', vida: 3, cuantos: 0.5 }
  };
  const mutador = k => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(MUTADORES, k) ? k : '');

  /* ---------- Fase 4: la Noche Eterna ----------
     **Noches**: las rondas 27, 37, 47… tienen una regla de mutador (los
     mismos campos que `MUTADORES`, que juego.js mezcla en `mutD()`). Quien
     sigue en pie al acabarla gana chatarra, furia dorada y la medalla.
     **Eventos**: las rondas 28, 33, 38, 43… (sin jefe ni noche) cambian qué
     sale. Hasta la 26 no hay nada de esto, así que el principio es igual. */
  const NOCHES = {
    veloz: { nombre: 'Noche veloz', txt: 'la horda corre un 30 % más', vel: 1.3 },
    hierro: { nombre: 'Noche de hierro', txt: 'la mitad de enemigos, con el triple de vida', vida: 3, cuantos: 0.5 },
    cristal: { nombre: 'Noche de cristal', txt: 'pegas y recibes el doble', dano: 2, recibe: 2 },
    apagon: { nombre: 'Apagón total', txt: 'a oscuras, y corren un 15 % más', vel: 1.15, oscuro: true },
    // Fase 4b: dos más, así el ciclo es de 60 rondas
    luna: { nombre: 'Luna roja', txt: 'los enemigos pegan un 50 % más', golpe: 1.5 },
    escasez: { nombre: 'Noche de escasez', txt: 'los enemigos no sueltan cajas', sinCajas: true }
  };
  const ORDEN_NOCHES = ['veloz', 'hierro', 'cristal', 'apagon', 'luna', 'escasez'];
  const nocheDe = n => (n >= 27 && n % 10 === 7 ? ORDEN_NOCHES[((n - 27) / 10) % ORDEN_NOCHES.length] : '');
  const premioNoche = n => 1000 + 40 * Math.max(0, n - 27);
  const EVENTOS = {
    estampida: { nombre: 'Estampida', txt: 'llegan enjambres por todos lados', ks: [18], parte: 0.15 },
    asedio: { nombre: 'Asedio', txt: 'demoledores y brutos contra tus muros', ks: [16, 3], parte: 0.35 },
    lluvia: { nombre: 'Lluvia dorada', txt: 'las cajas doradas caen mucho más', dorada: 8 },
    marea: { nombre: 'Marea de élites', txt: 'el doble de élites', elites: 2 },
    // Fase 4b: dos más (ciclo de 30 rondas)
    brujeria: { nombre: 'Brujería', txt: 'chamanes y vigías se quedan atrás y te castigan de lejos', ks: [19, 21], parte: 0.25 },
    polvorin: { nombre: 'Polvorín', txt: 'explosivos y tóxicos por todos lados', ks: [4, 22], parte: 0.3 }
  };
  const ORDEN_EVENTOS = ['estampida', 'asedio', 'lluvia', 'marea', 'brujeria', 'polvorin'];
  const eventoDe = n => (n >= 26 && (n % 10 === 3 || n % 10 === 8) ? ORDEN_EVENTOS[Math.floor((n - 23) / 5) % ORDEN_EVENTOS.length] : '');
  // El tipo de un enemigo en una ronda con evento que fuerza tipos (`r1` si, `r2` cuál).
  function tipoEvento(ev, n, r1, r2) {
    const E = EVENTOS[ev];
    if (E && E.ks && r1 < E.parte) return E.ks[Math.min(E.ks.length - 1, Math.floor(r2 * E.ks.length))];
    return tipoEnemigo(n, r2);
  }
  // Dos reglas a la vez (el mutador de la sala y la noche): se multiplican.
  function mezclaMut(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const o = Object.assign({}, a, b);
    for (const k of ['dano', 'recibe', 'vel', 'vida', 'cuantos', 'golpe']) if (a[k] && b[k]) o[k] = a[k] * b[k];
    if (a.cura && b.cura) o.cura = a.cura + b.cura;
    return o;
  }
  /* Las metas a la vista (la línea del HUD): cuántas rondas faltan para el
     próximo jefe, la próxima noche y la próxima medalla de ronda. */
  const MEDALLAS_RONDA = [[10, 'nivel10'], [20, 'nivel20'], [30, 'nivel30'], [40, 'nivel40'], [50, 'nivel50'], [75, 'nivel75'], [100, 'nivel100']];
  function proximas(n) {
    const o = {};
    for (let k = n; k < n + 30; k++) {
      if (o.jefe === undefined && jefeDeNivel(k) >= 0) o.jefe = k;
      if (o.noche === undefined && nocheDe(k)) o.noche = k;
      if (o.evento === undefined && eventoDe(k)) o.evento = k;
    }
    const m = MEDALLAS_RONDA.find(([r]) => r > n);
    if (m) o.medalla = m[0];
    return o;
  }

  const topeRadio = w => { const b = armaTope(w); return b && b.r ? Math.ceil(b.r * 1.5) : 0; };   // segundos para elegir; después se queda la primera

  return {
    TS, ARMAS, ARMAS_J, MEJORAS, PASOS, arma, nivelArma, premios, duracionCombo, bajadaCombo, PUNTOS, chatarraDe, ENEMIGOS, MINIS, GRANDES, jefeDeNivel, esJefe, vidaJefe, vidaEnemigo, velEnemigo,
    ELITES, parteElites, eliteDe, CORRUPTO_DESDE, ELITE_CORRUPTO, corrupto, DEBIL, DORADA, DORADA_T, PARTE_DORADA, golpeNivel, totalNivel, SIERRA, sierra, mezclaNivel, tipoEnemigo, parteDiablos, maxVivos, ritmoNivel,
    ARMADURA, TIENDA, precioTienda, factorNivelTienda, factorPotencia, ALCANCE_TIENDA, MURO_BLINDADO, NIVEL_ARMA, RANGOS_ARMA, rangoArma, precioNivelArma, conNivel, ESPECIALES, especialDe, SKINS, skin, MAPAS, ORDEN_MAPAS, MAPAS_CLASICOS, CINTAS, VEL_CINTA, mapaValido,
    cargaMapa, DIRS, dirDe, dirStick, VENTAJAS, RAREZAS, PESO_RAREZA, ventaja, sorteaVentajas, ESPERA_VENTAJA, MEDALLAS, medallaDe, topeGolpe, topeRadio,
    PASO_JEFES, nivelJefes, escoltaJefes, MUTADORES, mutador, empacaZb, desempacaZb,
    MULTI_CHATARRA, subeMultiChatarra, bajaMultiChatarra, TARDE, topeVivos, escoltaGrande, duoDe, FASE3, POR_COMPRA, factorCompras, factorMunicion, LEGENDARIAS, RELLENO, NOCHES, nocheDe, premioNoche, EVENTOS, eventoDe, tipoEvento, mezclaMut, MEDALLAS_RONDA, proximas
  };
});
