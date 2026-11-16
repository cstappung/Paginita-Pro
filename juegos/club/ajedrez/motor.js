/* El motor de Ajedrez Club: las reglas completas del ajedrez, el bot de
   cuatro niveles y la comprobación de los puzles, sin nada que se dibuje.
   juego.js lo usa para jugar, bot.js (el worker) para pensar sin trabar la
   pantalla, y el verificador antitrampas
   (colabtex/src/juegos/solo/verifica/ajedrez.js) para rehacer cada partida
   y cada puzle con el MISMO código.

   - **El tablero es 0x88**: 128 casillas, `fila * 16 + columna`, con la
     fila 0 = la 1 del tablero. Una casilla es válida si `(c & 0x88) === 0`,
     así que salirse por un borde se ve con un AND y no hacen falta tablas
     de bordes. Las piezas son números: blancas positivas, negras negativas
     (1 peón, 2 caballo, 3 alfil, 4 torre, 5 dama, 6 rey).
   - **Una jugada es un entero**: origen | destino << 7 | coronación << 14 |
     banderas << 17 (1 captura, 2 al paso, 4 enroque, 8 avance doble).
     `hacer`/`deshacer` cambian la posición en el sitio y guardan lo
     necesario para volver en una pila de números; la búsqueda no crea
     objetos por nodo.
   - **Las reglas son las de la FIDE, todas**: enroque (el rey no puede
     cruzar casillas atacadas), al paso, coronación a cualquier pieza, y las
     tablas automáticas (ahogado, triple repetición, cincuenta jugadas y
     material insuficiente). `tests/ajedrezclub.test.cjs` corre **perft**
     sobre las mismas cinco posiciones de referencia que el ajedrez de las
     salas: cualquier cambio en la generación tiene que mantener esas cifras.
   - **El bot es determinista.** Busca a profundidad fija (no por tiempo),
     ordena las jugadas siempre igual y su azar sale de mulberry32 con la
     semilla de la partida y el número de jugada (`azarDe`). Por eso el
     verificador puede volver a calcular cada jugada del bot a partir de las
     del jugador: la prueba de una partida trae solo las jugadas de quien
     juega, y un «bot» que se dejara ganar no se puede inventar.
   - **Los cuatro niveles** (`NIVELES`) son la misma búsqueda con más o
     menos profundidad y más o menos ruido en la raíz: el Novato mira una
     jugada sin seguir los cambios y a veces mueve al azar; el Maestro mira
     cuatro jugadas completas más todos los cambios de piezas. El ruido se
     suma a la nota de cada jugada de la raíz, no a la búsqueda, así que el
     bot sigue viendo los mates.
   - **La repetición se mira con una clave zobrist doble** (dos enteros de
     32 bits) que `hacer` actualiza y apila (`k1`/`k2`); la búsqueda la usa
     para no meterse en tablas y el juego para declararlas. La casilla al
     paso solo entra en la clave cuando hay un peón contrario al lado.

   Puro: sin DOM, sin reloj, sin Math.random. Corre igual en Node. */
(function (root) {
  'use strict';

  const PE = 1, CA = 2, AL = 3, TO = 4, DA = 5, RE = 6;
  const VALOR = [0, 100, 320, 330, 500, 900, 0];
  const MATE = 100000, INF = 1000000000;
  const LETRA_FEN = ' pnbrqk';
  const LETRA_ES = ['', '', 'C', 'A', 'T', 'D', 'R'];
  const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const DE = m => m & 127, A = m => (m >> 7) & 127, CORONA = m => (m >> 14) & 7, BANDERAS = m => m >>> 17;
  const jugada = (de, a, cor, f) => de | (a << 7) | (cor << 14) | (f << 17);
  const nombre = c => 'abcdefgh'[c & 7] + ((c >> 4) + 1);
  const casilla = s => (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97);
  const valida = c => (c & 0x88) === 0;

  const N_CAB = [33, 31, 18, 14, -33, -31, -18, -14];
  const N_REY = [1, -1, 16, -16, 15, 17, -15, -17];
  const N_DIAG = [15, 17, -15, -17];
  const N_RECTA = [1, -1, 16, -16];

  /* Lo que cada casilla deja de los derechos de enroque al salir o llegar
     alguien a ella (1 = O-O blanco, 2 = O-O-O blanco, 4 y 8 los negros). */
  const MASCARA = new Int8Array(128).fill(15);
  MASCARA[0] = 13; MASCARA[7] = 14; MASCARA[4] = 12;
  MASCARA[112] = 7; MASCARA[119] = 11; MASCARA[116] = 3;

  /* ---------- Azar repetible ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* El chorro de azar de la jugada `ply` de una partida de semilla `s`. */
  /* La semilla del bot lleva la cuenta: una prueba copiada de otra persona,
     con la cuenta cambiada, hace jugar distinto al bot y no se rehace. */
  function semillaCuenta(s, u) {
    let h = 0x811C9DC5 ^ (s | 0);
    const t = String(u || '');
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193);
    return h | 0;
  }
  const azarDe = (s, ply) => mulberry32((Math.imul(s | 0, 0x9E3779B1) ^ Math.imul(ply + 1, 0x85EBCA77)) | 0);

  /* ---------- Zobrist ---------- */
  const Z1 = new Int32Array(13 * 128), Z2 = new Int32Array(13 * 128);
  const ZE1 = new Int32Array(16), ZE2 = new Int32Array(16), ZP1 = new Int32Array(8), ZP2 = new Int32Array(8);
  let ZL1 = 0, ZL2 = 0;
  (function () {
    const r = mulberry32(0x5eed1234), n = () => (r() * 4294967296) | 0;
    for (let i = 0; i < Z1.length; i++) { Z1[i] = n(); Z2[i] = n(); }
    for (let i = 0; i < 16; i++) { ZE1[i] = n(); ZE2[i] = n(); }
    for (let i = 0; i < 8; i++) { ZP1[i] = n(); ZP2[i] = n(); }
    ZL1 = n(); ZL2 = n();
    ZE1[0] = 0; ZE2[0] = 0;
  })();
  const zi = (pz, c) => (pz + 6) * 128 + c;

  /* ---------- Posición ---------- */
  function vacia() {
    return { t: new Int8Array(128), lado: 1, enroque: 0, ap: -1, medio: 0, n: 1, reyB: -1, reyN: -1, h1: 0, h2: 0, u: [], k1: [], k2: [] };
  }

  function claveDesde(p) {
    let h1 = 0, h2 = 0;
    for (let c = 0; c < 128; c++) { if (c & 0x88) { c += 7; continue; } const pz = p.t[c]; if (pz) { h1 ^= Z1[zi(pz, c)]; h2 ^= Z2[zi(pz, c)]; } }
    h1 ^= ZE1[p.enroque]; h2 ^= ZE2[p.enroque];
    if (p.ap >= 0) { h1 ^= ZP1[p.ap & 7]; h2 ^= ZP2[p.ap & 7]; }
    if (p.lado < 0) { h1 ^= ZL1; h2 ^= ZL2; }
    p.h1 = h1; p.h2 = h2;
  }

  /* Una posición desde FEN (null si no se puede leer). */
  function desdeFEN(fen) {
    const partes = String(fen || '').trim().split(/\s+/);
    if (partes.length < 4) return null;
    const p = vacia(), filas = partes[0].split('/');
    if (filas.length !== 8) return null;
    for (let f = 0; f < 8; f++) {
      let col = 0;
      for (const ch of filas[f]) {
        if (/[1-8]/.test(ch)) { col += +ch; continue; }
        const k = LETRA_FEN.indexOf(ch.toLowerCase());
        if (k < 1 || col > 7) return null;
        const c = (7 - f) * 16 + col, pz = ch === ch.toLowerCase() ? -k : k;
        p.t[c] = pz;
        if (pz === RE) p.reyB = c; else if (pz === -RE) p.reyN = c;
        col++;
      }
      if (col !== 8) return null;
    }
    if (p.reyB < 0 || p.reyN < 0) return null;
    p.lado = partes[1] === 'b' ? -1 : 1;
    p.enroque = (partes[2].includes('K') ? 1 : 0) | (partes[2].includes('Q') ? 2 : 0) | (partes[2].includes('k') ? 4 : 0) | (partes[2].includes('q') ? 8 : 0);
    p.ap = partes[3] !== '-' && /^[a-h][36]$/.test(partes[3]) ? casilla(partes[3]) : -1;
    if (p.ap >= 0) {   // solo si hay un peón que pueda tomar al paso, como hace `hacer`
      const del = p.ap - 16 * p.lado, peon = PE * p.lado;
      if (!((valida(del + 1) && p.t[del + 1] === peon) || (valida(del - 1) && p.t[del - 1] === peon))) p.ap = -1;
    }
    p.medio = Math.max(0, parseInt(partes[4], 10) || 0);
    p.n = Math.max(1, parseInt(partes[5], 10) || 1);
    claveDesde(p);
    p.k1.push(p.h1); p.k2.push(p.h2);
    return p;
  }
  const inicial = () => desdeFEN(INICIAL);

  function aFEN(p) {
    let s = '';
    for (let f = 7; f >= 0; f--) {
      let v = 0;
      for (let col = 0; col < 8; col++) {
        const pz = p.t[f * 16 + col];
        if (!pz) { v++; continue; }
        if (v) { s += v; v = 0; }
        const l = LETRA_FEN[Math.abs(pz)];
        s += pz > 0 ? l.toUpperCase() : l;
      }
      if (v) s += v;
      if (f) s += '/';
    }
    const e = (p.enroque & 1 ? 'K' : '') + (p.enroque & 2 ? 'Q' : '') + (p.enroque & 4 ? 'k' : '') + (p.enroque & 8 ? 'q' : '');
    return `${s} ${p.lado > 0 ? 'w' : 'b'} ${e || '-'} ${p.ap >= 0 ? nombre(p.ap) : '-'} ${p.medio} ${p.n}`;
  }

  /* ---------- Ataques ---------- */
  function atacada(t, c, por) {
    if (por > 0) {
      if (valida(c - 15) && t[c - 15] === PE) return true;
      if (valida(c - 17) && t[c - 17] === PE) return true;
    } else {
      if (valida(c + 15) && t[c + 15] === -PE) return true;
      if (valida(c + 17) && t[c + 17] === -PE) return true;
    }
    const cab = CA * por, rey = RE * por, al = AL * por, to = TO * por, da = DA * por;
    for (let i = 0; i < 8; i++) {
      const d = c + N_CAB[i]; if (valida(d) && t[d] === cab) return true;
      const r = c + N_REY[i]; if (valida(r) && t[r] === rey) return true;
    }
    for (let i = 0; i < 4; i++) {
      let d = c + N_DIAG[i];
      while (valida(d)) { const pz = t[d]; if (pz) { if (pz === al || pz === da) return true; break; } d += N_DIAG[i]; }
      d = c + N_RECTA[i];
      while (valida(d)) { const pz = t[d]; if (pz) { if (pz === to || pz === da) return true; break; } d += N_RECTA[i]; }
    }
    return false;
  }
  const enJaque = p => atacada(p.t, p.lado > 0 ? p.reyB : p.reyN, -p.lado);
  /* Después de `hacer`: ¿quedó en jaque el rey del que acaba de mover? */
  const dejoJaque = p => atacada(p.t, p.lado > 0 ? p.reyN : p.reyB, p.lado);

  /* ---------- Generación (pseudo-legal) ---------- */
  function pon(lista, de, a, f, promo) {
    if (promo) { lista.push(jugada(de, a, DA, f), jugada(de, a, TO, f), jugada(de, a, AL, f), jugada(de, a, CA, f)); }
    else lista.push(jugada(de, a, 0, f));
  }
  /* `soloCapturas`: capturas y coronaciones a dama, para la quiescencia. */
  function generar(p, lista, soloCapturas) {
    const t = p.t, lado = p.lado;
    const adelante = 16 * lado, filaIni = lado > 0 ? 1 : 6, filaCor = lado > 0 ? 7 : 0;
    for (let c = 0; c < 128; c++) {
      if (c & 0x88) { c += 7; continue; }
      const pz = t[c];
      if (!pz || (pz > 0) !== (lado > 0)) continue;
      const tipo = pz * lado;
      if (tipo === PE) {
        const a = c + adelante, cor = (a >> 4) === filaCor;
        if (valida(a) && !t[a]) {
          if (cor) { if (soloCapturas) lista.push(jugada(c, a, DA, 0)); else pon(lista, c, a, 0, true); }
          else if (!soloCapturas) {
            lista.push(jugada(c, a, 0, 0));
            if ((c >> 4) === filaIni && !t[a + adelante]) lista.push(jugada(c, a + adelante, 0, 8));
          }
        }
        for (const lat of [-1, 1]) {
          const x = a + lat;
          if (!valida(x)) continue;
          if (t[x] && (t[x] > 0) !== (lado > 0)) {
            if (cor && soloCapturas) lista.push(jugada(c, x, DA, 1)); else pon(lista, c, x, 1, cor);
          } else if (x === p.ap) lista.push(jugada(c, x, 0, 3));
        }
      } else if (tipo === CA || tipo === RE) {
        const N = tipo === CA ? N_CAB : N_REY;
        for (let i = 0; i < 8; i++) {
          const a = c + N[i];
          if (!valida(a)) continue;
          const o = t[a];
          if (!o) { if (!soloCapturas) lista.push(jugada(c, a, 0, 0)); }
          else if ((o > 0) !== (lado > 0)) lista.push(jugada(c, a, 0, 1));
        }
        if (tipo === RE && !soloCapturas) enroques(p, c, lista);
      } else {
        const dirs = tipo === AL ? N_DIAG : tipo === TO ? N_RECTA : N_REY;
        for (let i = 0; i < dirs.length; i++) {
          let a = c + dirs[i];
          while (valida(a)) {
            const o = t[a];
            if (!o) { if (!soloCapturas) lista.push(jugada(c, a, 0, 0)); }
            else { if ((o > 0) !== (lado > 0)) lista.push(jugada(c, a, 0, 1)); break; }
            a += dirs[i];
          }
        }
      }
    }
    return lista;
  }
  function enroques(p, c, lista) {
    const t = p.t, lado = p.lado, e = p.enroque;
    if (lado > 0 && c === 4) {
      if ((e & 1) && !t[5] && !t[6] && t[7] === TO && !atacada(t, 4, -1) && !atacada(t, 5, -1) && !atacada(t, 6, -1)) lista.push(jugada(4, 6, 0, 4));
      if ((e & 2) && !t[3] && !t[2] && !t[1] && t[0] === TO && !atacada(t, 4, -1) && !atacada(t, 3, -1) && !atacada(t, 2, -1)) lista.push(jugada(4, 2, 0, 4));
    } else if (lado < 0 && c === 116) {
      if ((e & 4) && !t[117] && !t[118] && t[119] === -TO && !atacada(t, 116, 1) && !atacada(t, 117, 1) && !atacada(t, 118, 1)) lista.push(jugada(116, 118, 0, 4));
      if ((e & 8) && !t[115] && !t[114] && !t[113] && t[112] === -TO && !atacada(t, 116, 1) && !atacada(t, 115, 1) && !atacada(t, 114, 1)) lista.push(jugada(116, 114, 0, 4));
    }
  }

  /* ---------- Hacer y deshacer ---------- */
  function hacer(p, m) {
    const t = p.t, de = m & 127, a = (m >> 7) & 127, cor = (m >> 14) & 7, f = m >>> 17;
    const lado = p.lado, pieza = t[de];
    let cap = t[a];
    p.u.push(m, cap, p.enroque, p.ap, p.medio, p.h1, p.h2);
    let h1 = p.h1, h2 = p.h2;
    if (p.ap >= 0) { h1 ^= ZP1[p.ap & 7]; h2 ^= ZP2[p.ap & 7]; }
    h1 ^= Z1[zi(pieza, de)]; h2 ^= Z2[zi(pieza, de)];
    t[de] = 0;
    if (cap) { h1 ^= Z1[zi(cap, a)]; h2 ^= Z2[zi(cap, a)]; }
    if (f & 2) {
      const cc = a - 16 * lado; cap = t[cc]; t[cc] = 0;
      h1 ^= Z1[zi(cap, cc)]; h2 ^= Z2[zi(cap, cc)];
    }
    const puesta = cor ? cor * lado : pieza;
    t[a] = puesta; h1 ^= Z1[zi(puesta, a)]; h2 ^= Z2[zi(puesta, a)];
    if (f & 4) {
      const td = a > de ? de + 3 : de - 4, ta = a > de ? de + 1 : de - 1, torre = t[td];
      t[td] = 0; t[ta] = torre;
      h1 ^= Z1[zi(torre, td)] ^ Z1[zi(torre, ta)]; h2 ^= Z2[zi(torre, td)] ^ Z2[zi(torre, ta)];
    }
    if (pieza === RE) p.reyB = a; else if (pieza === -RE) p.reyN = a;
    h1 ^= ZE1[p.enroque]; h2 ^= ZE2[p.enroque];
    p.enroque &= MASCARA[de] & MASCARA[a];
    h1 ^= ZE1[p.enroque]; h2 ^= ZE2[p.enroque];
    p.ap = -1;
    if (f & 8) {
      const contra = -PE * lado;
      if ((valida(a + 1) && t[a + 1] === contra) || (valida(a - 1) && t[a - 1] === contra)) {
        p.ap = (de + a) >> 1; h1 ^= ZP1[p.ap & 7]; h2 ^= ZP2[p.ap & 7];
      }
    }
    p.medio = (cap || pieza * lado === PE) ? 0 : p.medio + 1;
    if (lado < 0) p.n++;
    p.lado = -lado; h1 ^= ZL1; h2 ^= ZL2;
    p.h1 = h1; p.h2 = h2;
    p.k1.push(h1); p.k2.push(h2);
  }

  function deshacer(p) {
    const u = p.u, t = p.t;
    p.k1.pop(); p.k2.pop();
    p.h2 = u.pop(); p.h1 = u.pop(); p.medio = u.pop(); p.ap = u.pop(); p.enroque = u.pop();
    const cap = u.pop(), m = u.pop();
    const lado = -p.lado; p.lado = lado;
    if (lado < 0) p.n--;
    const de = m & 127, a = (m >> 7) & 127, cor = (m >> 14) & 7, f = m >>> 17;
    const pieza = cor ? PE * lado : t[a];
    t[de] = pieza; t[a] = cap;
    if (f & 2) t[a - 16 * lado] = -PE * lado;
    if (f & 4) {
      const td = a > de ? de + 3 : de - 4, ta = a > de ? de + 1 : de - 1;
      t[td] = t[ta]; t[ta] = 0;
    }
    if (pieza === RE) p.reyB = de; else if (pieza === -RE) p.reyN = de;
  }

  function legales(p) {
    const l = generar(p, [], false), r = [];
    for (const m of l) { hacer(p, m); if (!dejoJaque(p)) r.push(m); deshacer(p); }
    return r;
  }
  function hayLegal(p) {
    const l = generar(p, [], false);
    for (const m of l) { hacer(p, m); const ok = !dejoJaque(p); deshacer(p); if (ok) return true; }
    return false;
  }

  /* ---------- Fin de partida ---------- */
  function repeticiones(p) {
    const n = p.k1.length;
    let r = 1;
    for (let i = n - 3; i >= 0 && i >= n - 1 - p.medio; i -= 2) if (p.k1[i] === p.h1 && p.k2[i] === p.h2) r++;
    return r;
  }
  function materialInsuficiente(p) {
    let menores = 0, alfiles = [];
    for (let c = 0; c < 128; c++) {
      if (c & 0x88) { c += 7; continue; }
      const tipo = Math.abs(p.t[c]);
      if (!tipo || tipo === RE) continue;
      if (tipo === PE || tipo === TO || tipo === DA) return false;
      menores++;
      if (tipo === AL) alfiles.push(((c >> 4) + (c & 7)) & 1);
    }
    if (menores <= 1) return true;
    return alfiles.length === menores && alfiles.every(x => x === alfiles[0]);
  }
  /* null mientras se juega; si no, 'mate' (pierde el que tiene el turno),
     'ahogado', 'repeticion', 'cincuenta' o 'material'. */
  function fin(p) {
    if (!hayLegal(p)) return enJaque(p) ? 'mate' : 'ahogado';
    if (p.medio >= 100) return 'cincuenta';
    if (repeticiones(p) >= 3) return 'repeticion';
    if (materialInsuficiente(p)) return 'material';
    return null;
  }

  /* ---------- Notación ---------- */
  const uci = m => nombre(DE(m)) + nombre(A(m)) + (CORONA(m) ? LETRA_FEN[CORONA(m)] : '');
  /* La jugada legal que dice `s` ("e2e4", "e7e8q"), o 0. */
  function deUci(p, s) {
    if (typeof s !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(s)) return 0;
    const de = casilla(s.slice(0, 2)), a = casilla(s.slice(2, 4)), cor = s[4] ? LETRA_FEN.indexOf(s[4]) : 0;
    for (const m of legales(p)) if (DE(m) === de && A(m) === a && CORONA(m) === cor) return m;
    return 0;
  }
  /* La jugada en notación algebraica española (R D T A C): «Cf3», «exd5»,
     «O-O», «e8=D+», «Dxf7#». `m` tiene que ser legal en `p`. */
  function san(p, m) {
    const de = DE(m), a = A(m), f = BANDERAS(m), tipo = Math.abs(p.t[de]);
    let s;
    if (f & 4) s = a > de ? 'O-O' : 'O-O-O';
    else if (tipo === PE) {
      s = (f & 1 ? nombre(de)[0] + 'x' : '') + nombre(a) + (CORONA(m) ? '=' + LETRA_ES[CORONA(m)] : '');
    } else {
      let misma = false, col = false, fila = false;
      for (const o of legales(p)) {
        if (o === m || A(o) !== a || DE(o) === de || Math.abs(p.t[DE(o)]) !== tipo) continue;
        misma = true;
        if ((DE(o) & 7) === (de & 7)) col = true;
        if ((DE(o) >> 4) === (de >> 4)) fila = true;
      }
      const dis = !misma ? '' : !col ? nombre(de)[0] : !fila ? nombre(de)[1] : nombre(de);
      s = LETRA_ES[tipo] + dis + (f & 1 ? 'x' : '') + nombre(a);
    }
    hacer(p, m);
    if (enJaque(p)) s += hayLegal(p) ? '+' : '#';
    deshacer(p);
    return s;
  }

  /* ---------- Evaluación ---------- */
  /* Las tablas de la «Simplified Evaluation Function» de Tomasz
     Michniewski (Chess Programming Wiki), escritas desde la fila 8 hacia la
     1, para las blancas. Las negras usan la misma tabla reflejada. */
  const TABLAS = {
    [PE]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [CA]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [AL]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [TO]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [DA]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    rm: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    rf: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };
  /* PST[clave][lado 0 blancas / 1 negras][casilla 0x88]. */
  const PST = {};
  for (const k of Object.keys(TABLAS)) {
    const b = new Int16Array(128), n = new Int16Array(128);
    for (let f = 0; f < 8; f++) for (let col = 0; col < 8; col++) {
      b[f * 16 + col] = TABLAS[k][(7 - f) * 8 + col];
      n[f * 16 + col] = TABLAS[k][f * 8 + col];
    }
    PST[k] = [b, n];
  }
  const FASE = [0, 0, 1, 1, 2, 4, 0];
  const centro = c => { const f = c >> 4, col = c & 7; return Math.max(3 - f, f - 4) + Math.max(3 - col, col - 4); };
  const distancia = (x, y) => Math.max(Math.abs((x >> 4) - (y >> 4)), Math.abs((x & 7) - (y & 7)));

  /* La nota de la posición para el que tiene el turno, en centipeones. */
  function evalua(p) {
    const t = p.t;
    let mat = 0, pos = 0, fase = 0, alB = 0, alN = 0, matB = 0, matN = 0;
    for (let c = 0; c < 128; c++) {
      if (c & 0x88) { c += 7; continue; }
      const pz = t[c];
      if (!pz) continue;
      const tipo = pz > 0 ? pz : -pz;
      fase += FASE[tipo];
      if (tipo === RE) continue;
      if (pz > 0) { mat += VALOR[tipo]; pos += PST[tipo][0][c]; if (tipo !== PE) matB += VALOR[tipo]; if (tipo === AL) alB++; }
      else { mat -= VALOR[tipo]; pos -= PST[tipo][1][c]; if (tipo !== PE) matN += VALOR[tipo]; if (tipo === AL) alN++; }
    }
    if (fase > 24) fase = 24;
    const rb = p.reyB, rn = p.reyN;
    const reyM = PST.rm[0][rb] - PST.rm[1][rn], reyF = PST.rf[0][rb] - PST.rf[1][rn];
    let v = mat + pos + (((reyM * fase + reyF * (24 - fase)) / 24) | 0);
    if (alB >= 2) v += 30;
    if (alN >= 2) v -= 30;
    /* Rematar: con ventaja clara y pocas piezas, llevar al rey contrario al
       borde y acercar el propio (sin esto el bot no sabría cerrar un final). */
    if (fase <= 8) {
      if (mat > 250 && matB > 0) v += 10 * centro(rn) + 4 * (14 - distancia(rb, rn));
      else if (mat < -250 && matN > 0) v -= 10 * centro(rb) + 4 * (14 - distancia(rb, rn));
    }
    return p.lado > 0 ? v : -v;
  }

  /* ---------- Búsqueda ---------- */
  function nota(p, m, killers, ply) {
    const f = BANDERAS(m);
    let s = 0;
    if (f & 1) s = 100000 + 10 * VALOR[Math.abs(p.t[A(m)]) || PE] - VALOR[Math.abs(p.t[DE(m)])] / 10;
    if (CORONA(m)) s += 90000 + VALOR[CORONA(m)];
    if (!s && killers) { if (m === killers[2 * ply]) s = 9000; else if (m === killers[2 * ply + 1]) s = 8000; }
    return s;
  }
  function ordena(p, l, killers, ply) {
    const n = l.map(m => nota(p, m, killers, ply));
    const idx = l.map((_, i) => i).sort((x, y) => n[y] - n[x] || x - y);
    return idx.map(i => l[i]);
  }
  function repite(p) {
    const n = p.k1.length;
    for (let i = n - 3; i >= 0 && i >= n - 1 - p.medio; i -= 2) if (p.k1[i] === p.h1 && p.k2[i] === p.h2) return true;
    return false;
  }

  function quies(p, alfa, beta, ply, qd, S) {
    S.nodos++;
    const jaque = qd < 3 && enJaque(p);
    let mejor = -INF;
    if (!jaque) {
      const sp = evalua(p);
      if (sp >= beta || qd >= 8) return sp;
      if (sp > alfa) alfa = sp;
      mejor = sp;
    }
    const l = ordena(p, generar(p, [], !jaque), null, 0);
    let hubo = false;
    for (const m of l) {
      hacer(p, m);
      if (dejoJaque(p)) { deshacer(p); continue; }
      hubo = true;
      const v = -quies(p, -beta, -alfa, ply + 1, qd + 1, S);
      deshacer(p);
      if (v > mejor) { mejor = v; if (v > alfa) { alfa = v; if (v >= beta) break; } }
    }
    if (jaque && !hubo) return -(MATE - ply);
    return mejor;
  }

  function negamax(p, prof, alfa, beta, ply, S) {
    S.nodos++;
    if (ply > 0 && (p.medio >= 100 || repite(p))) return 0;
    const jaque = enJaque(p);
    if (jaque && ply < S.tope) prof++;
    if (prof <= 0) return S.quies ? quies(p, alfa, beta, ply, 0, S) : evalua(p);
    const l = ordena(p, generar(p, [], false), S.killers, ply);
    let mejor = -INF, hubo = false;
    for (const m of l) {
      hacer(p, m);
      if (dejoJaque(p)) { deshacer(p); continue; }
      hubo = true;
      const v = -negamax(p, prof - 1, -beta, -alfa, ply + 1, S);
      deshacer(p);
      if (v > mejor) {
        mejor = v;
        if (v > alfa) {
          alfa = v;
          if (v >= beta) {
            if (!(BANDERAS(m) & 1) && S.killers[2 * ply] !== m) { S.killers[2 * ply + 1] = S.killers[2 * ply]; S.killers[2 * ply] = m; }
            break;
          }
        }
      }
    }
    if (!hubo) return jaque ? -(MATE - ply) : 0;
    return mejor;
  }

  /* Los niveles del bot. `prof`: jugadas completas de media jugada que mira;
     `quies`: si sigue los cambios de piezas hasta que se calman; `ruido`:
     cuántos centipeones de azar se suman a cada jugada de la raíz; `azar`:
     la probabilidad de mover cualquier cosa. */
  const NIVELES = {
    1: { nombre: 'Novato', prof: 1, quies: false, ruido: 260, azar: 0.22 },
    2: { nombre: 'Aficionado', prof: 2, quies: true, ruido: 90, azar: 0.05 },
    3: { nombre: 'Experto', prof: 3, quies: true, ruido: 25, azar: 0 },
    4: { nombre: 'Maestro', prof: 4, quies: true, ruido: 6, azar: 0 }
  };

  /* La jugada del bot en la posición `p` (que no cambia), para el nivel
     dado, con el azar `rnd` (una función como Math.random, pero repetible).
     Devuelve {m, nodos}; m = 0 si no hay jugadas. */
  function eligeBot(p, nivel, rnd) {
    const cfg = NIVELES[nivel] || NIVELES[1];
    const raiz = legales(p);
    if (!raiz.length) return { m: 0, nodos: 0 };
    const ruido = raiz.map(() => cfg.ruido ? Math.floor(rnd() * (2 * cfg.ruido + 1)) - cfg.ruido : 0);
    const loca = rnd();
    if (raiz.length === 1) return { m: raiz[0], nodos: 1 };
    if (loca < cfg.azar) return { m: raiz[Math.floor(rnd() * raiz.length)], nodos: 1 };
    const S = { nodos: 0, quies: cfg.quies, tope: cfg.prof * 2 + 2, killers: new Int32Array(256) };
    let orden = ordena(p, raiz, null, 0).map(m => raiz.indexOf(m));
    let elegida = orden[0];
    for (let d = 1; d <= cfg.prof; d++) {
      const final = d === cfg.prof;
      let B = -INF, mejor = orden[0];
      for (const i of orden) {
        const n = final ? ruido[i] : 0;
        hacer(p, raiz[i]);
        const v = -negamax(p, d - 1, -INF, -(B - n), 1, S);
        deshacer(p);
        if (v + n > B) { B = v + n; mejor = i; }
      }
      elegida = mejor;
      orden = [mejor, ...orden.filter(i => i !== mejor)];
    }
    return { m: raiz[elegida], nodos: S.nodos };
  }

  /* ---------- Una partida contra el bot ---------- */
  /* Rehace una partida desde el principio: `nivel` 1-4, `color` 'b' si el
     jugador lleva las blancas o 'n' si las negras, `semilla` (la del bot,
     ya con la cuenta: `semillaCuenta`) y
     `jugadas`, las del jugador en UCI. Las del bot se vuelven a calcular.
     Devuelve {p, movs (todas, en UCI), fin, gana ('jugador'|'bot'|null),
     error}. Sigue hasta el final o hasta que le toque al jugador sin
     jugadas. `alJugar(m, unica)` se llama con cada jugada del jugador
     (`unica`: era la única legal). */
  function rehaceBot(nivel, color, semilla, jugadas, alJugar) {
    const p = inicial(), lado = color === 'n' ? -1 : 1, movs = [];
    let i = 0, ply = 0;
    for (;;) {
      const f = fin(p);
      if (f) {
        const gana = f === 'mate' ? (p.lado === lado ? 'bot' : 'jugador') : null;
        return { p, movs, fin: f, gana, error: i < jugadas.length ? 'Hay jugadas después del final de la partida.' : null };
      }
      if (p.lado === lado) {
        if (i >= jugadas.length) return { p, movs, fin: null, gana: null, error: null };
        const m = deUci(p, jugadas[i]);
        if (!m) return { p, movs, fin: null, gana: null, error: `La jugada ${i + 1} (${String(jugadas[i]).slice(0, 8)}) no es legal en la partida rehecha.` };
        if (alJugar) alJugar(m, legales(p).length === 1);
        hacer(p, m); movs.push(uci(m)); i++;
      } else {
        const { m } = eligeBot(p, nivel, azarDe(semilla, ply));
        hacer(p, m); movs.push(uci(m));
      }
      ply++;
    }
  }

  /* ---------- Puzles ---------- */
  /* Un puzle es {id, fen, l: [uci...]}: `fen` es la posición antes de la
     jugada del rival, `l[0]` esa jugada (la que se ve al abrir el puzle) y
     después se alternan las del jugador (índices impares) y las respuestas.
     `paso(pz, k, s)`: ¿qué pasa si en el paso k del jugador (0, 1, …) juega
     `s`? 'bien' si es la de la solución y quedan más; 'resuelto' si con ella
     termina, o si da mate aunque no sea la de la línea (como en lichess,
     cualquier mate vale); 'mal' si es legal pero no; 'ilegal'. */
  function posPuzle(pz, k) {
    const p = desdeFEN(pz.fen);
    if (!p) return null;
    for (let i = 0; i <= 2 * k && i < pz.l.length; i++) {
      const m = deUci(p, pz.l[i]);
      if (!m) return null;
      hacer(p, m);
    }
    return p;
  }
  const pasosPuzle = pz => (pz.l.length / 2) | 0;
  function paso(pz, k, s) {
    const p = posPuzle(pz, k);
    if (!p || k < 0 || 2 * k + 1 >= pz.l.length) return 'ilegal';
    const m = deUci(p, s);
    if (!m) return 'ilegal';
    if (uci(m) === pz.l[2 * k + 1]) return 2 * k + 2 >= pz.l.length ? 'resuelto' : 'bien';
    hacer(p, m);
    const mate = enJaque(p) && !hayLegal(p);
    deshacer(p);
    return mate ? 'resuelto' : 'mal';
  }
  /* Las estrellas de un puzle resuelto: tres, menos una por error y una por
     pedir la pista, y nunca menos de una. */
  const estrellas = (errores, pista) => Math.max(1, 3 - (errores | 0) - (pista ? 1 : 0));

  /* Rehace un intento: `r` = {j: [uci...] (las jugadas aceptadas, en orden),
     e: [[k, uci]...] (los errores, cada uno en su paso), p: 0|1 (la pista),
     t: [ms...] (lo que tardó cada jugada aceptada)}. Devuelve {estrellas, ms}
     o {error}. */
  function rehacePuzle(pz, r) {
    if (!r || typeof r !== 'object' || !Array.isArray(r.j) || !Array.isArray(r.e) || !Array.isArray(r.t)) return { error: 'el intento no tiene la forma esperada' };
    if (!r.j.length || r.j.length > pasosPuzle(pz) || r.t.length !== r.j.length || r.e.length > 50) return { error: 'el intento no tiene la forma esperada' };
    if (r.p !== 0 && r.p !== 1) return { error: 'el intento no tiene la forma esperada' };
    let ms = 0;
    for (const t of r.t) { if (!Number.isSafeInteger(t) || t < 0 || t > 3600000) return { error: 'un tiempo está mal formado' }; ms += t; }
    for (let k = 0; k < r.j.length; k++) {
      const v = paso(pz, k, r.j[k]);
      const ultimo = k === r.j.length - 1;
      if (ultimo ? v !== 'resuelto' : v !== 'bien') return { error: `la jugada ${k + 1} no es la de la solución` };
    }
    for (const e of r.e) {
      if (!Array.isArray(e) || e.length !== 2 || !Number.isSafeInteger(e[0]) || e[0] < 0 || e[0] >= r.j.length) return { error: 'un error está mal formado' };
      if (paso(pz, e[0], e[1]) !== 'mal') return { error: 'un error declarado no es una jugada equivocada' };
    }
    return { estrellas: estrellas(r.e.length, r.p), ms };
  }

  const api = {
    PE, CA, AL, TO, DA, RE, MATE, INICIAL, NIVELES,
    DE, A, CORONA, BANDERAS, nombre, casilla, mulberry32, azarDe, semillaCuenta,
    desdeFEN, aFEN, inicial, generar, legales, hayLegal, hacer, deshacer, enJaque, atacada,
    fin, repeticiones, materialInsuficiente, uci, deUci, san, evalua, eligeBot, rehaceBot,
    posPuzle, pasosPuzle, paso, estrellas, rehacePuzle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AjedrezMotor = api;
})(this);
