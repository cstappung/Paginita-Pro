/* Pokelike — motor puro. Sin DOM, sin Math.random ni reloj: todo azar sale
   de `run.rng` (mulberry32), que viaja guardado con la partida, así una run
   se puede reproducir entera desde su semilla y las decisiones (lo va a
   necesitar el antitrampas en la Fase 2). Corre en Node para los tests.

   Una run es: mapa por capas → nodos (salvaje, captura, entrenador, centro)
   → jefe (Brock). El combate es 1 contra 1 con el primer Pokémon vivo del
   equipo; cada `pasoCombate` es un turno y devuelve la lista de eventos que
   la pantalla anima. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./especies.js'), require('./datos.js'));
  else raiz.PokelikeMotor = fabrica(raiz.PokelikeEspecies, raiz.PokelikeDatos);
})(typeof self !== 'undefined' ? self : this, function (ESP, D) {
  'use strict';

  // ── Azar ────────────────────────────────────────────────────────────
  // mulberry32 sobre un estado entero; `st` es cualquier objeto con `.rng`.
  function azar(st) {
    let t = st.rng = (st.rng + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const entre = (st, a, b) => a + Math.floor(azar(st) * (b - a + 1));
  function ponderado(st, pesos) {
    const ks = Object.keys(pesos).filter(k => pesos[k] > 0);
    let r = azar(st) * ks.reduce((s, k) => s + pesos[k], 0);
    for (const k of ks) { r -= pesos[k]; if (r < 0) return k; }
    return ks[ks.length - 1];
  }

  // ── Pokémon ─────────────────────────────────────────────────────────
  function stats(e, nv) {
    const b = ESP[e].b;
    const o = x => Math.floor(2 * x * nv / 100) + 5;
    return { ps: Math.floor(2 * b[0] * nv / 100) + nv + 10, atk: o(b[1]), def: o(b[2]), spa: o(b[3]), spd: o(b[4]), vel: o(b[5]) };
  }

  const escalon = nv => { let k = 0; D.NIVEL_ESCALON.forEach((n, i) => { if (nv >= n) k = i; }); return k; };
  const mov = (tipo, k) => { const [nombre, poder, prec] = D.MOVS[tipo][k]; return { nombre, tipo, poder, prec }; };

  /* Movimientos que «sabe» una especie a un nivel: el mejor de cada tipo
     propio, el de su tipo de cobertura (si tiene), uno Normal de apoyo y,
     si queda espacio, el escalón anterior de su tipo principal. Máximo 4,
     sin repetir. */
  function movimientos(e, nv) {
    const [t1, t2] = ESP[e].t;
    const k = escalon(nv);
    const l = [mov(t1, k)];
    if (t2) l.push(mov(t2, k));
    if (D.COBERTURA[e]) l.push(mov(D.COBERTURA[e], k));
    if (t1 !== 'Normal' && t2 !== 'Normal') l.push(mov('Normal', k));
    if (k > 0) l.push(mov(t1, k - 1));
    if (k > 0 && t2) l.push(mov(t2, k - 1));
    const vistos = new Set();
    return l.filter(m => !vistos.has(m.nombre) && vistos.add(m.nombre)).slice(0, 4);
  }

  function crearPokemon(st, e, nv) {
    const p = { uid: (st.uid = (st.uid || 0) + 1), e, nv, xp: 0, ps: 0 };
    p.ps = stats(e, nv).ps;
    return p;
  }

  /* Curva casi cuadrática: a nivel bajo se sube rápido y a nivel alto cuesta,
  para que el equipo no se dispare por encima de los líderes. */
  const xpParaSubir = nv => Math.round((0.6 * nv * nv + 5 * nv + 20) * (1 + Math.max(0, nv - 20) / 25));

  function efectividad(tipo, tiposDef) {
    const f = D.TABLA[tipo];
    return tiposDef.reduce((m, t) => m * (f.x0.includes(t) ? 0 : f.x2.includes(t) ? 2 : f.x05.includes(t) ? 0.5 : 1), 1);
  }

  /* Daño sin azar (lo usa también la IA para elegir). El atacante pega con
     su mejor stat ofensiva y el defensor se cubre con la defensa que
     corresponde. */
  function danoBase(at, df, m) {
    const sa = stats(at.e, at.nv), sd = stats(df.e, df.nv);
    const especial = sa.spa > sa.atk;
    const A = especial ? sa.spa : sa.atk, Dd = especial ? sd.spd : sd.def;
    let d = Math.floor(Math.floor(Math.floor(2 * at.nv / 5 + 2) * m.poder * A / Dd) / 50) + 2;
    if (ESP[at.e].t.includes(m.tipo)) d = Math.floor(d * 1.5);
    const ef = efectividad(m.tipo, ESP[df.e].t);
    return { d: Math.floor(d * ef), ef };
  }

  /* IA: el movimiento de más daño esperado. `torpeza` es la probabilidad
     de elegir uno al azar (los salvajes son torpes, los líderes no). */
  function eligeMov(st, at, df, torpeza = 0) {
    const ms = movimientos(at.e, at.nv);
    if (torpeza && azar(st) < torpeza) return entre(st, 0, ms.length - 1);
    let mejor = 0, valor = -1;
    ms.forEach((m, i) => { const v = danoBase(at, df, m).d * m.prec; if (v > valor) { valor = v; mejor = i; } });
    return mejor;
  }

  // ── Mapa ────────────────────────────────────────────────────────────
  // Gimnasio: inicio, captura, 6 de contenido, centro, jefe.
  // Liga: inicio, captura, 5 de contenido y los cinco jefes en fila. La Calle
  // Victoria es solo entrenadores y capturas: sin hierba ni centros.
  const TAM_GIMNASIO = [1, 2, 3, 4, 3, 4, 3, 4, 1, 1];
  const TAM_LIGA = [1, 2, 3, 4, 3, 4, 3, 1, 1, 1, 1, 1];
  const PESOS = {
    temprano: { salvaje: 40, captura: 30, entrenador: 30, centro: 0 },
    medio:    { salvaje: 30, captura: 18, entrenador: 44, centro: 8 },
    liga:     { salvaje: 0, captura: 25, entrenador: 75, centro: 0 },
  };

  function generarMapa(semilla, tramo = 0) {
    const st = { rng: semilla | 0 };
    const T = D.TRAMOS[tramo], nJefes = T.jefes.length;
    const tam = T.liga ? TAM_LIGA : TAM_GIMNASIO;
    const capas = tam.map((n, c) => Array.from({ length: n }, (_, i) => ({
      id: `${c}-${i}`, capa: c, x: (i + 0.5) / n,
    })));
    const primerJefe = capas.length - nJefes;
    capas.forEach((capa, c) => capa.forEach(nodo => {
      if (c === 0) nodo.tipo = 'inicio';
      else if (c >= primerJefe) { nodo.tipo = 'jefe'; nodo.jefe = c - primerJefe; }
      else if (c === primerJefe - 1 && !T.liga) nodo.tipo = 'centro';
      else if (c === 1) nodo.tipo = 'captura';
      else nodo.tipo = ponderado(st, T.liga ? PESOS.liga : c <= 3 ? PESOS.temprano : PESOS.medio);
    }));
    return { capas, aristas: unir(st, capas) };
  }

  /* Aristas: cada nodo baja al más cercano de la capa siguiente y, a veces,
     también al segundo; después nadie queda sin camino de llegada. */
  function unir(st, capas) {
    const ult = capas.length - 1, aristas = [];
    for (let c = 0; c < ult; c++) {
      const de = capas[c], a = capas[c + 1], llega = new Set();
      for (const n of de) {
        const orden = a.slice().sort((p, q) => Math.abs(p.x - n.x) - Math.abs(q.x - n.x));
        const k = (de.length === 1 || a.length === 1) ? a.length : (azar(st) < 0.65 ? 2 : 1);
        for (const t of orden.slice(0, k)) { aristas.push([n.id, t.id]); llega.add(t.id); }
      }
      for (const t of a) if (!llega.has(t.id)) {
        const n = de.slice().sort((p, q) => Math.abs(p.x - t.x) - Math.abs(q.x - t.x))[0];
        aristas.push([n.id, t.id]);
      }
    }
    // Un pequeño desorden horizontal para que no se vea como grilla.
    capas.forEach(capa => { if (capa.length > 1) capa.forEach(n => { n.x += (azar(st) - 0.5) * 0.08 / capa.length; }); });
    return aristas;
  }

  // ── Ruta Infinita (después de ganar la Liga) ────────────────────────
  /* Pisos sin fin. Cada piso: inicio, tres capas de contenido, un centro,
     tres más y un centro al final, que lleva al piso siguiente. Cada nodo de
     contenido es, mitad y mitad, un entrenador o una captura. Las capturas
     sirven para la Pokédex (cualquier especie de Kanto, sin evolucionar),
     pero salen `INF_CAPTURA_BAJO` niveles bajo los rivales: meter una en el
     equipo lo debilita, y no hay reserva. La dificultad sube cada `INF_CADA` victorias: rivales
     más altos, equipos más grandes y una IA que se equivoca menos. */
  const INF_CADA = 3, INF_NIVEL = 75, INF_SUBE = 4, INF_CAPTURA_BAJO = 15;
  const TAM_INFINITO = [1, 2, 3, 3, 1, 3, 3, 2, 1];
  /* Los rivales salen de las formas finales con buenas stats (sin Mew ni
     Mewtwo, que aparecen desde la dificultad 5). */
  const totalBase = e => ESP[e].b.reduce((a, x) => a + x, 0);
  const POOL_INFINITO = Object.keys(ESP).map(Number).filter(e => !ESP[e].evo.length && totalBase(e) >= 450 && e !== 150 && e !== 151);

  function generarMapaInfinito(semilla) {
    const st = { rng: semilla | 0 };
    const capas = TAM_INFINITO.map((n, c) => Array.from({ length: n }, (_, i) => ({
      id: `${c}-${i}`, capa: c, x: (i + 0.5) / n,
      tipo: c === 0 ? 'inicio' : n === 1 ? 'centro' : null,
    })));
    capas.flat().forEach(n => { if (!n.tipo) n.tipo = azar(st) < 0.5 ? 'entrenador' : 'captura'; });
    return { capas, aristas: unir(st, capas) };
  }
  const dificultad = run => Math.floor((run.infinito ? run.infinito.victorias : 0) / INF_CADA);
  const nivelInfinito = run => INF_NIVEL + INF_SUBE * dificultad(run);

  function ofertaInfinita(run) {
    const nv = Math.max(5, nivelInfinito(run) - INF_CAPTURA_BAJO);
    return [0, 1, 2].map(() => crearPokemon(run, entre(run, 1, 149), nv + entre(run, -2, 2)));
  }

  function equipoInfinito(run) {
    const dif = dificultad(run);
    const cuantos = Math.min(6, 3 + Math.floor(dif / 2));
    const nv = nivelInfinito(run);
    const pool = dif >= 5 ? [...POOL_INFINITO, 150, 151] : POOL_INFINITO;
    return Array.from({ length: cuantos }, () => crearPokemon(run, pool[entre(run, 0, pool.length - 1)], nv + entre(run, -1, 1)));
  }

  /* Tras ganar la Liga: el equipo se cura y empieza el primer piso. */
  function empezarInfinito(run) {
    if (run.resultado !== 'victoria' || run.infinito) return false;
    run.infinito = { victorias: 0, puntos: 0, piso: 1 };
    run.resultado = null;
    nuevoPisoInfinito(run);
    return true;
  }
  function nuevoPisoInfinito(run) {
    run.mapa = generarMapaInfinito((run.semilla + 104729 * run.infinito.piso) | 0);
    run.pos = '0-0'; run.visitados = ['0-0'];
    run.combate = null; run.oferta = null;
    curarTodo(run);
    run.fase = 'mapa';
  }

  /* Puntaje de la run: la historia vale lo mismo para todos los que la
     terminan (1900 con la Liga); la Ruta Infinita es lo que separa. */
  const PUNTOS = { medalla: 100, altoMando: 150, campeon: 500, infinitoBase: 50, infinitoDif: 10 };
  function puntaje(run) {
    return run.medallas * PUNTOS.medalla + (run.ligaVencidos || 0) * PUNTOS.altoMando
      + (run.campeon ? PUNTOS.campeon : 0) + (run.infinito ? run.infinito.puntos : 0);
  }

  const nodo = (run, id) => run.mapa.capas.flat().find(n => n.id === id);
  const siguientes = run => run.mapa.aristas.filter(([d]) => d === run.pos).map(([, a]) => a);
  const profundidad = (run, n) => n.capa / (run.mapa.capas.length - 1);
  const tramoDe = run => D.TRAMOS[run.tramo];

  function zonaDe(run, n) {
    if (run.infinito) return { nombre: `Ruta Infinita · Piso ${run.infinito.piso}` };
    const f = profundidad(run, n), zs = tramoDe(run).zonas;
    let i = 0;
    zs.forEach((z, k) => { if (f >= z.desde) i = k; });
    return zs[i];
  }
  /* Nivel de un rival: dentro de la zona sube con la profundidad del nodo,
     con ±1 de azar. */
  function nivelEn(run, n, extra = 0) {
    const f = profundidad(run, n), zs = tramoDe(run).zonas;
    let i = 0;
    zs.forEach((z, k) => { if (f >= z.desde) i = k; });
    const z = zs[i], fin = i + 1 < zs.length ? zs[i + 1].desde : 1;
    const t = Math.max(0, Math.min(1, (f - z.desde) / Math.max(0.01, fin - z.desde)));
    return Math.max(2, Math.round(z.nv[0] + (z.nv[1] - z.nv[0]) * t) + entre(run, -1, 1) + extra);
  }
  /* Una especie a un nivel alto sale ya evolucionada (un Pidgey Nv 40 es
     Pidgeot). Si hay varias (Eevee), una al azar. */
  function formaPorNivel(st, e, nv) {
    for (let g = 0; g < 3; g++) {
      const ev = ESP[e].evo.filter(x => nv >= x.nv);
      if (!ev.length) break;
      e = ev[entre(st, 0, ev.length - 1)].a;
    }
    return e;
  }
  const crearRival = (st, e, nv) => crearPokemon(st, formaPorNivel(st, e, nv), nv);

  // ── Run ─────────────────────────────────────────────────────────────
  const semillaTramo = (run, t) => (run.semilla + t * 7919) | 0;

  /* FNV-1a y una mezcla de enteros: la cuenta (`u`) entra en la semilla,
     así una partida de otra cuenta no se puede rehacer como propia. */
  function hashTexto(t) {
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mezcla(a, b) {
    let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ b;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) | 0;
  }

  /* `semilla` es la que elige el juego; con cuenta `u`, la semilla real de
     la run sale de las dos. `log` anota cada decisión (ver `acciones`). */
  function nuevaRun(semilla, inicial, u = '') {
    const real = u ? mezcla(semilla >>> 0, hashTexto(String(u))) : semilla | 0;
    const run = {
      v: 2, semilla: real, rng: (real ^ 0x5bd1e995) | 0, uid: 0, inicial,
      tramo: 0, mapa: null, pos: '0-0', visitados: ['0-0'],
      equipo: [], fase: 'mapa', combate: null, oferta: null, medallas: 0, resultado: null, debug: false,
      nonce: semilla >>> 0, u: String(u || ''), log: [], atrapados: [],
    };
    run.mapa = generarMapa(semillaTramo(run, 0), 0);
    run.equipo.push(crearPokemon(run, inicial, D.NIVEL_INICIAL));
    anotaAtrapados(run);
    return run;
  }
  // Especies distintas que pasaron por el equipo en esta run (la tabla «Pokédex» del Club).
  function anotaAtrapados(run) {
    if (!run.atrapados) return;
    for (const p of run.equipo) if (!run.atrapados.includes(p.e)) run.atrapados.push(p.e);
  }

  /* Pasa al mapa del tramo siguiente: equipo curado (se descansó en la
     ciudad del gimnasio). */
  function siguienteTramo(run) {
    run.tramo++;
    run.mapa = generarMapa(semillaTramo(run, run.tramo), run.tramo);
    run.pos = '0-0'; run.visitados = ['0-0'];
    run.combate = null; run.oferta = null;
    curarTodo(run);
    run.fase = 'mapa';
  }

  const vivos = run => run.equipo.filter(p => p.ps > 0);
  const primerVivo = run => run.equipo.findIndex(p => p.ps > 0);

  /* El equipo fijo de un jefe, en orden de salida: [[especie, nivel]]. Sin
     azar, así la pantalla lo puede mostrar antes del combate. */
  function equipoJefe(run, k = 0) {
    const j = tramoDe(run).jefes[k];
    return j.contraInicial ? [...j.equipo, [j.contraInicial[run.inicial] || 9, j.nvInicial]] : j.equipo;
  }
  function jefeDe(run, n) {
    const j = tramoDe(run).jefes[n.jefe || 0];
    return { j, eq: equipoJefe(run, n.jefe || 0).map(([e, nv]) => crearPokemon(run, e, nv)) };
  }

  function entrar(run, id) {
    if (run.fase !== 'mapa' || !siguientes(run).includes(id)) return false;
    const n = nodo(run, id), T = tramoDe(run);
    run.pos = id; run.visitados.push(id);
    const zona = zonaDe(run, n);
    if (n.tipo === 'salvaje') {
      const e = Number(ponderado(run, zona.p));
      iniciaCombate(run, 'salvaje', [crearRival(run, e, nivelEn(run, n))], { nombre: zona.nombre });
    } else if (n.tipo === 'entrenador' && run.infinito) {
      const cl = D.TRAMOS[D.TRAMOS.length - 1].clases[entre(run, 0, D.TRAMOS[D.TRAMOS.length - 1].clases.length - 1)];
      iniciaCombate(run, 'entrenador', equipoInfinito(run), { nombre: cl.clase, sprite: cl.sprite });
      run.combate.torpeza = Math.max(0, 0.2 - 0.04 * dificultad(run));
    } else if (n.tipo === 'entrenador') {
      const cl = T.clases[entre(run, 0, T.clases.length - 1)];
      const f = profundidad(run, n);
      const cuantos = (f < 0.4 || run.tramo === 0) ? entre(run, 1, 2) : entre(run, 2, 3) + (run.tramo >= 3 ? entre(run, 0, 1) : 0);
      const eq = Array.from({ length: cuantos }, () => crearRival(run, cl.p[entre(run, 0, cl.p.length - 1)], nivelEn(run, n, run.tramo > 0 ? 1 : 0)));
      iniciaCombate(run, 'entrenador', eq, { nombre: cl.clase, sprite: cl.sprite });
    } else if (n.tipo === 'jefe') {
      // La Calle Victoria no tiene centros: el equipo descansa antes del Alto Mando.
      if (T.liga && !n.jefe) curarTodo(run);
      const { j, eq } = jefeDe(run, n);
      iniciaCombate(run, 'jefe', eq, { nombre: j.nombre, sprite: j.sprite, titulo: j.titulo, jefe: n.jefe || 0 });
    } else if (n.tipo === 'captura' && run.infinito) {
      run.oferta = ofertaInfinita(run); run.fase = 'captura';
    } else if (n.tipo === 'captura') {
      // Tres de la zona; con suerte, uno es una rareza.
      const nv = nivelEn(run, n, -1);
      const of = [0, 1, 2].map(k => k === 2 && azar(run) < 0.3
        ? crearRival(run, Number(ponderado(run, T.raros)), nv)
        : crearRival(run, Number(ponderado(run, zona.p)), nv));
      run.oferta = of; run.fase = 'captura';
    } else if (n.tipo === 'centro') {
      run.fase = 'centro';
    }
    return true;
  }

  function iniciaCombate(run, tipo, enemigos, rival) {
    const ij = primerVivo(run);
    run.combate = { tipo, rival, enemigos, ie: 0, ij, turno: 0, participantes: [run.equipo[ij].uid], fin: null };
    run.fase = 'combate';
  }

  // ── Combate ─────────────────────────────────────────────────────────
  const TORPEZA = { salvaje: 0.5, entrenador: 0.25, jefe: 0 };
  const RESPIRO = 0.2;

  /* Un turno. `eleccion` es el índice del movimiento del jugador, o null
     para que lo elija el modo automático (la misma IA, sin torpeza). */
  function pasoCombate(run, eleccion = null) {
    const cb = run.combate, ev = [];
    if (!cb || cb.fin) return ev;
    cb.turno++;
    const yo = run.equipo[cb.ij], el = cb.enemigos[cb.ie];
    const msY = movimientos(yo.e, yo.nv);
    const iY = eleccion != null && msY[eleccion] ? eleccion : eligeMov(run, yo, el);
    const iE = eligeMov(run, el, yo, cb.torpeza ?? TORPEZA[cb.tipo]);
    const vY = stats(yo.e, yo.nv).vel, vE = stats(el.e, el.nv).vel;
    const yoPrimero = vY > vE || (vY === vE && azar(run) < 0.5);
    const orden = yoPrimero ? [['j', iY], ['e', iE]] : [['e', iE], ['j', iY]];
    for (const [lado, i] of orden) {
      const at = lado === 'j' ? yo : el, df = lado === 'j' ? el : yo;
      if (at.ps <= 0 || df.ps <= 0) continue;
      const m = movimientos(at.e, at.nv)[i];
      ev.push({ t: 'ataque', lado, mov: m.nombre, tipo: m.tipo });
      if (azar(run) * 100 >= m.prec) { ev.push({ t: 'falla', lado }); continue; }
      let { d, ef } = danoBase(at, df, m);
      const crit = ef > 0 && azar(run) < 1 / 16;
      if (crit) d = Math.floor(d * 1.5);
      d = ef === 0 ? 0 : Math.max(1, Math.floor(d * (0.85 + azar(run) * 0.15)));
      df.ps = Math.max(0, df.ps - d);
      ev.push({ t: 'dano', lado: lado === 'j' ? 'e' : 'j', cant: d, ps: df.ps, ef, crit });
      if (df.ps <= 0) {
        ev.push({ t: 'debilitado', lado: lado === 'j' ? 'e' : 'j', e: df.e });
        if (lado === 'j') enemigoCae(run, el, ev); else jugadorCae(run, ev);
        break;
      }
    }
    return ev;
  }

  function enemigoCae(run, el, ev) {
    const cb = run.combate;
    const mult = cb.tipo === 'salvaje' ? 1 : 1.5;
    const base = ESP[el.e].xp * el.nv / 3 * mult;
    /* Ganar a uno más fuerte rinde más y a uno más débil, menos: así el
       equipo tiende al nivel de la zona en vez de dispararse. Los que
       pelearon se llevan todo; el resto del equipo vivo, la mitad. */
    for (const p of run.equipo) if (p.ps > 0) {
      const f = Math.max(0.1, Math.min(2, Math.pow((el.nv + 5) / (p.nv + 5), 3)));
      const xp = Math.max(1, Math.floor(base * f * (cb.participantes.includes(p.uid) ? 1 : 0.5)));
      ganaXp(run, p, xp, ev);
    }
    if (cb.ie + 1 < cb.enemigos.length) {
      cb.ie++;
      ev.push({ t: 'sale', lado: 'e', e: cb.enemigos[cb.ie].e });
    } else {
      cb.fin = 'gana';
      // Un respiro tras ganar: los vivos recuperan una parte de sus PS.
      for (const p of run.equipo) if (p.ps > 0) p.ps = Math.min(stats(p.e, p.nv).ps, p.ps + Math.ceil(stats(p.e, p.nv).ps * RESPIRO));
      ev.push({ t: 'fin', resultado: 'gana' });
    }
  }

  function jugadorCae(run, ev) {
    const cb = run.combate, i = primerVivo(run);
    if (i < 0) { cb.fin = 'pierde'; ev.push({ t: 'fin', resultado: 'pierde' }); return; }
    cb.ij = i;
    if (!cb.participantes.includes(run.equipo[i].uid)) cb.participantes.push(run.equipo[i].uid);
    ev.push({ t: 'sale', lado: 'j', e: run.equipo[i].e, uid: run.equipo[i].uid });
  }

  function ganaXp(run, p, xp, ev) {
    if (xp <= 0) return;
    p.xp += xp;
    ev.push({ t: 'xp', uid: p.uid, cant: xp });
    while (p.xp >= xpParaSubir(p.nv) && p.nv < 100) {
      p.xp -= xpParaSubir(p.nv);
      const antes = stats(p.e, p.nv).ps, movsAntes = movimientos(p.e, p.nv).map(m => m.nombre);
      p.nv++;
      p.ps += stats(p.e, p.nv).ps - antes;
      ev.push({ t: 'nivel', uid: p.uid, nv: p.nv });
      const evo = ESP[p.e].evo.filter(x => p.nv >= x.nv);
      if (evo.length) {
        const de = p.e, a = evo[entre(run, 0, evo.length - 1)].a; // Eevee: cualquiera de las tres
        const psAntes = stats(de, p.nv).ps;
        p.e = a;
        p.ps += stats(a, p.nv).ps - psAntes;
        ev.push({ t: 'evoluciona', uid: p.uid, de, a });
      }
      for (const m of movimientos(p.e, p.nv)) if (!movsAntes.includes(m.nombre)) ev.push({ t: 'aprende', uid: p.uid, mov: m.nombre });
    }
  }

  /* Cierra el combate ya decidido. Gimnasio ganado ⇒ fase «medalla» (la
     pantalla la muestra y llama a `siguienteTramo`). En la Liga, cada
     miembro del Alto Mando devuelve al mapa; el Campeón termina la run.
     Con `inmortal` (modo prueba) una derrota cuenta como victoria y el
     equipo se cura; la run queda marcada `debug`. */
  function terminarCombate(run, { inmortal = false } = {}) {
    const cb = run.combate;
    if (!cb || !cb.fin) return;
    let gano = cb.fin === 'gana';
    if (!gano && inmortal) { gano = true; run.debug = true; curarTodo(run); }
    run.combate = null;
    if (!gano) { run.fase = 'fin'; run.resultado = 'derrota'; return; }
    if (run.infinito) {
      run.infinito.puntos += PUNTOS.infinitoBase + PUNTOS.infinitoDif * dificultad(run);
      run.infinito.victorias++;
    }
    if (cb.tipo !== 'jefe') { run.fase = 'mapa'; return; }
    const j = tramoDe(run).jefes[cb.rival.jefe || 0];
    if (j.campeon) { run.fase = 'fin'; run.resultado = 'victoria'; run.campeon = true; }
    else if (j.medalla) { run.medallas++; run.fase = 'medalla'; }
    else {
      run.ligaVencidos = (run.ligaVencidos || 0) + 1;
      // Entre miembros del Alto Mando no hay centro; hasta que haya objetos, se cura todo.
      curarTodo(run);
      run.fase = 'mapa';
    }
  }

  // ── Modo prueba ─────────────────────────────────────────────────────
  // Atajos para probar sin jugar todo. Cualquiera marca la run como `debug`.
  function debugGanar(run) {
    const cb = run.combate, ev = [];
    if (!cb || cb.fin) return ev;
    run.debug = true;
    while (!cb.fin) { const el = cb.enemigos[cb.ie]; el.ps = 0; enemigoCae(run, el, ev); }
    return ev;
  }
  /* Lleva al jugador al nodo justo antes del (primer) jefe del mapa. */
  function debugIrAlJefe(run) {
    if (run.infinito) return;
    run.debug = true;
    const capas = run.mapa.capas, c = capas.findIndex(k => k[0].tipo === 'jefe') - 1;
    run.pos = capas[c][0].id; run.visitados.push(run.pos);
    run.combate = null; run.oferta = null; run.fase = 'mapa';
  }
  /* Gana el gimnasio (o la Liga) sin pelear. */
  function debugSaltarTramo(run) {
    run.debug = true;
    if (run.infinito) return;
    if (tramoDe(run).liga) { run.combate = null; run.fase = 'fin'; run.resultado = 'victoria'; run.campeon = true; run.ligaVencidos = 4; return; }
    run.medallas++;
    siguienteTramo(run);
  }
  function debugSubirNiveles(run, n = 5) {
    run.debug = true;
    const ev = [];
    for (const p of run.equipo) for (let k = 0; k < n && p.nv < 100; k++) ganaXp(run, p, xpParaSubir(p.nv) - p.xp, ev);
    curarTodo(run);
    return ev;
  }
  /* Equipo de prueba competitivo: la evolución final del inicial y cinco
     de los fuertes de Kanto, todos al mismo nivel. */
  const EQUIPO_PRUEBA = [149, 65, 94, 143, 135];
  function debugEquipoFuerte(run, nv = 60) {
    run.debug = true;
    run.equipo = [run.inicial + 2, ...EQUIPO_PRUEBA].map(e => crearPokemon(run, e, nv));
  }
  /* A las puertas de la Liga con el equipo de prueba, al nivel medio con
     que se llega jugando (~55-56). */
  function debugLigaFuerte(semilla, inicial, nv = 55) {
    const run = debugEmpezarEn(semilla, inicial, D.TRAMOS.length - 1);
    debugEquipoFuerte(run, nv);
    return run;
  }
  /* Directo a la Ruta Infinita, como si ya se hubiera ganado la Liga. */
  function debugInfinito(semilla, inicial, nv = INF_NIVEL) {
    const run = debugLigaFuerte(semilla, inicial, nv);
    run.ligaVencidos = 4; run.campeon = true; run.resultado = 'victoria';
    empezarInfinito(run);
    return run;
  }
  /* Run nueva que empieza en el tramo `t` con un equipo de 6 al nivel de
     ese tramo: el inicial y cinco de las zonas y rarezas del tramo. */
  function debugEmpezarEn(semilla, inicial, t) {
    const run = nuevaRun(semilla, inicial);
    run.debug = true;
    if (t <= 0) return run;
    run.medallas = Math.min(t, 8);
    run.tramo = t - 1;
    siguienteTramo(run);
    const ant = D.TRAMOS[t - 1].jefes, nv = Math.max(...ant[ant.length - 1].equipo.map(([, l]) => l));
    const p0 = run.equipo[0];
    p0.e = formaPorNivel(run, p0.e, nv); p0.nv = nv;
    const T = tramoDe(run), pool = Object.assign({}, ...T.zonas.map(z => z.p), T.raros);
    while (run.equipo.length < MAX_EQUIPO) run.equipo.push(crearRival(run, Number(ponderado(run, pool)), nv - entre(run, 0, 3)));
    curarTodo(run);
    return run;
  }

  // ── Otros nodos ─────────────────────────────────────────────────────
  const MAX_EQUIPO = 6;
  /* Captura la oferta `i` (o ninguna con null). Con el equipo lleno, `suelta`
     es el índice del Pokémon que se libera: el nuevo ocupa su casilla. */
  function capturar(run, i, suelta = null) {
    if (run.fase !== 'captura') return false;
    if (i != null && run.oferta[i]) {
      if (run.equipo.length >= MAX_EQUIPO) {
        if (suelta == null || !run.equipo[suelta]) return false;
        run.equipo[suelta] = run.oferta[i];
      } else run.equipo.push(run.oferta[i]);
    }
    run.oferta = null; run.fase = 'mapa';
    return true;
  }

  function curarTodo(run) {
    for (const p of run.equipo) p.ps = stats(p.e, p.nv).ps;
  }
  function salirCentro(run) {
    if (run.fase !== 'centro') return false;
    curarTodo(run); run.fase = 'mapa';
    if (run.infinito && nodo(run, run.pos).capa === run.mapa.capas.length - 1) { run.infinito.piso++; nuevoPisoInfinito(run); }
    return true;
  }

  // Sube (dir = -1) o baja (dir = 1) un Pokémon en el orden del equipo. El
  // primero vivo es el que sale a pelear.
  function moverEnEquipo(run, i, dir) {
    const j = i + dir;
    if (run.fase !== 'mapa' || j < 0 || j >= run.equipo.length) return false;
    [run.equipo[i], run.equipo[j]] = [run.equipo[j], run.equipo[i]];
    return true;
  }

  /* Juega una run entera sin pantalla, en automático. Captura la oferta de
     más stats y, con el equipo lleno, cambia al más flojo si conviene.
     Para tests y para balancear. */
  const fuerza = p => ESP[p.e].b.reduce((a, b) => a + b, 0) * p.nv;
  function simular(semilla, inicial, eligeCamino = sig => sig[0]) {
    const run = nuevaRun(semilla, inicial);
    for (let guardia = 0; run.fase !== 'fin' && guardia < 20000; guardia++) {
      if (run.fase === 'mapa') {
        const sig = siguientes(run);
        // Antes de un jefe, al frente el que más daño le hace a su primer Pokémon (como haría una persona).
        if (sig.length === 1 && nodo(run, sig[0]).tipo === 'jefe') {
          const { eq } = jefeDe({ ...run, rng: 1 }, nodo(run, sig[0]));
          const valor = p => p.ps <= 0 ? -1 : Math.max(...movimientos(p.e, p.nv).map(m => danoBase(p, eq[0], m).d * m.prec));
          const i = run.equipo.reduce((m, p, k, e) => valor(p) > valor(e[m]) ? k : m, 0);
          run.equipo.unshift(...run.equipo.splice(i, 1));
        }
        entrar(run, eligeCamino(sig, run));
      }
      else if (run.fase === 'combate') { pasoCombate(run); terminarCombate(run); }
      else if (run.fase === 'medalla') siguienteTramo(run);
      else if (run.fase === 'centro') salirCentro(run);
      else if (run.fase === 'captura') {
        const i = run.oferta.reduce((m, p, k, o) => fuerza(p) > fuerza(o[m]) ? k : m, 0);
        if (run.equipo.length < MAX_EQUIPO) capturar(run, i);
        else {
          const f = run.equipo.reduce((m, p, k, e) => fuerza(p) < fuerza(e[m]) ? k : m, 0);
          capturar(run, fuerza(run.oferta[i]) > fuerza(run.equipo[f]) ? i : null, f);
        }
      }
    }
    return run;
  }

  /* ── Decisiones registradas (antitrampas) ──────────────────────────
     La pantalla usa estas versiones: cada decisión que cambia la run deja
     un token en `run.log`, y `rehace` vuelve a jugar la partida desde la
     semilla aplicando los mismos tokens. Formato:
       e<id> entrar a un nodo · a turno automático · x<n> turno con el
       movimiento n · t cerrar el combate · c<i|-> [.<suelta>] captura ·
       s salir del centro · o<i><+|-> mover en el equipo · n gimnasio
       siguiente · i empezar la Ruta Infinita */
  function registra(run, tok) {
    if (run.log) run.log.push(tok);
    anotaAtrapados(run);
  }
  const acciones = {
    entrar(run, id) { const ok = entrar(run, id); if (ok) registra(run, 'e' + id); return ok; },
    pasoCombate(run, eleccion = null) {
      if (!run.combate || run.combate.fin) return [];
      const ev = pasoCombate(run, eleccion);
      registra(run, eleccion == null ? 'a' : 'x' + eleccion);
      return ev;
    },
    terminarCombate(run, o = {}) {
      if (!run.combate || !run.combate.fin) return;
      terminarCombate(run, o);
      registra(run, 't');
    },
    capturar(run, i, suelta = null) {
      const ok = capturar(run, i, suelta);
      if (ok) registra(run, 'c' + (i == null ? '-' : i) + (suelta == null ? '' : '.' + suelta));
      return ok;
    },
    salirCentro(run) { const ok = salirCentro(run); if (ok) registra(run, 's'); return ok; },
    moverEnEquipo(run, i, dir) { const ok = moverEnEquipo(run, i, dir); if (ok) registra(run, 'o' + i + (dir > 0 ? '+' : '-')); return ok; },
    siguienteTramo(run) {
      if (run.fase !== 'medalla') return false;
      siguienteTramo(run); registra(run, 'n'); return true;
    },
    empezarInfinito(run) { const ok = empezarInfinito(run); if (ok) registra(run, 'i'); return ok; },
  };

  /* Aplica un token a la run. true si era una decisión válida en ese
     momento y quedó registrada igual (forma canónica). */
  function aplica(run, tok) {
    if (typeof tok !== 'string' || !tok) return false;
    const antes = run.log.length, c = tok[0], r = tok.slice(1);
    let m;
    if (c === 'e') acciones.entrar(run, r);
    else if (tok === 'a') acciones.pasoCombate(run, null);
    else if (c === 'x' && /^[0-3]$/.test(r)) acciones.pasoCombate(run, Number(r));
    else if (tok === 't') acciones.terminarCombate(run);
    else if (c === 'c' && (m = /^(-|[0-2])(?:\.([0-5]))?$/.exec(r))) acciones.capturar(run, m[1] === '-' ? null : Number(m[1]), m[2] == null ? null : Number(m[2]));
    else if (tok === 's') acciones.salirCentro(run);
    else if (c === 'o' && (m = /^([0-5])([+-])$/.exec(r))) acciones.moverEnEquipo(run, Number(m[1]), m[2] === '+' ? 1 : -1);
    else if (tok === 'n') acciones.siguienteTramo(run);
    else if (tok === 'i') acciones.empezarInfinito(run);
    return run.log.length === antes + 1 && run.log[antes] === tok;
  }

  /* Rehace una partida entera. { run } o { error } en castellano. */
  function rehace(nonce, u, inicial, tokens) {
    if (!D.INICIALES.includes(inicial)) return { error: 'El inicial de la prueba no es Bulbasaur, Charmander ni Squirtle.' };
    if (!Array.isArray(tokens)) return { error: 'Las decisiones de la prueba no se pueden leer.' };
    const run = nuevaRun(nonce, inicial, u);
    for (let k = 0; k < tokens.length; k++) {
      if (!aplica(run, tokens[k])) return { error: `La decisión ${k + 1} («${String(tokens[k]).slice(0, 12)}») no se puede jugar en la partida rehecha.` };
    }
    return { run };
  }
  const atrapados = run => (run.atrapados || []).length;

  return {
    ESP, D, azar, stats, movimientos, efectividad, danoBase, xpParaSubir, crearPokemon,
    generarMapa, nodo, siguientes, zonaDe, nuevaRun, ...acciones,
    equipoJefe, vivos, simular, MAX_EQUIPO, tramoDe, rehace, aplica, atrapados, hashTexto,
    debugGanar, debugIrAlJefe, debugSaltarTramo, debugSubirNiveles, debugEmpezarEn, debugLigaFuerte, debugInfinito,
    empezarInfinito, dificultad, nivelInfinito, puntaje, PUNTOS, INF_CADA,
  };
});
