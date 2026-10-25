// =====================================================================
//  PRO DEFENDER — La prueba de una partida: grabarla y rehacerla
//
//  El motor (engine.js) es determinista: su azar sale de una semilla y
//  avanza en pasos fijos de 1/60 s. Así que una partida queda entera en
//  la semilla y la lista de lo que hizo quien juega, cada cosa con el paso
//  en que la hizo. La Grabadora es por donde pasa todo lo que el jugador
//  le hace al motor (main.js nunca llama a game.place/upgrade/... directo),
//  y rehace() vuelve a jugarla con el mismo motor: el verificador del club
//  (colabtex/src/juegos/solo/verifica/prodefender.js) comprueba así que la
//  ronda a la que dice haber llegado sale de verdad. Detalles y límites en
//  docs/antitrampas/prodefender.md.
//
//  Una jugada es [paso, código, ...]:
//    [k, 0, torre, x, y]   colocar (torre = índice en PD.TOWER_ORDER)
//    [k, 1, id, camino]    mejorar
//    [k, 2, id]            vender
//    [k, 3, id, modo]      objetivo (índice en MODOS)
//    [k, 4]                empezar la ronda
//    [k, 5, c]             recargar desde la foto de ese instante (reanudar
//                          una partida guardada, c = 0, o reintentar la
//                          ronda perdida, c = 1: gasta un reintento)
//    [k, 6, x, y]          tirar un montón de pinchos en el camino
//    [k, 7, i]             tercera era: elegir el pacto i (0–2) o rechazarlos (3)
//    [k, 8, x, y]          tercera era: lanzar el Poder del Reino en (x, y)
//  `k` cuenta los pasos del motor desde que empezó el tramo; una recarga
//  empieza un tramo nuevo (k vuelve a 0, la semilla cambia con el tramo).
//
//  Entre rondas el motor solo corre QUIETO_MAX pasos (3 s) después de la
//  última jugada o del fin de la ronda: lo que pasa ahí no cambia la foto
//  (no hay enemigos) y así una prueba nunca obliga a simular horas de
//  espera. La pantalla sigue animándose con su propio reloj (ui.vt).
// =====================================================================
(function () {
  const PD = (globalThis.PD = globalThis.PD || {});
  const STEP = 1 / 60;
  const QUIETO_MAX = 180;
  const MODOS = ['first', 'last', 'strong', 'close'];
  const REINOS = ['prado', 'dunas', 'glaciar', 'caldera', 'vacio', 'pantano', 'cumbres', 'fosa', 'engranajes', 'eclipse',
    'necropolis', 'esporas', 'espejos', 'archipielago', 'noche'];
  const MAX_JUGADAS = 8000, MAX_PASOS = 30000000;
  // Sube con cada cambio del motor, los datos o esta regla de pasos: una prueba
  // grabada con otro motor no se rehace igual (y eso es caché, no trampa).
  const VERSION = 4;

  const categoria = r => 'club-prodefender-' + REINOS[r];
  const reinoDe = cat => { const m = /^club-prodefender-([a-z]+)$/.exec(String(cat || '')); return m ? REINOS.indexOf(m[1]) : -1; };

  function hashTexto(t) {
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mezcla(a, b) {
    let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ b;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }
  // La cuenta va en la semilla: una prueba copiada de otra cuenta no se rehace igual.
  const semillaTramo = (s, u, tramo) => mezcla(mezcla(s >>> 0, hashTexto(String(u))), tramo + 1);

  const quieto = g => g.over || (!g.active && g.enemies.length === 0);
  const clona = o => JSON.parse(JSON.stringify(o));

  // Un paso del motor, con el tope de espera entre rondas. false: no avanzó.
  // Mientras hay ronda, `q` se queda en 0; al terminar la ronda empieza a contar.
  function paso(st) {
    const g = st.game;
    if (quieto(g)) { if (st.q >= QUIETO_MAX) return false; st.q++; }
    g.update(STEP);
    st.k++;
    if (!quieto(g)) st.q = 0;
    return true;
  }
  function torreDe(g, id) { return g.towers.find(t => t.id === id) || null; }

  // Aplica una jugada (ya en su paso). Devuelve el motivo si no vale.
  function aplica(st, j) {
    const g = st.game, c = j[1];
    if (g.over && c !== 5) return 'jugada con la partida perdida';
    if (c === 0) {
      const type = PD.TOWER_ORDER[j[2]];
      if (!type || PD.towersFor(st.r).indexOf(type) < 0) return 'torre que no existe en este reino';
      if (!Number.isInteger(j[3]) || !Number.isInteger(j[4])) return 'posición inválida';
      return g.place(type, j[3], j[4]) ? null : 'no se podía colocar esa torre ahí';
    }
    if (c === 1) { const t = torreDe(g, j[2]); return t && (j[3] === 0 || j[3] === 1) && g.upgrade(t, j[3]) ? null : 'mejora imposible'; }
    if (c === 2) { const t = torreDe(g, j[2]); if (!t) return 'venta de una torre que no existe'; g.sell(t); return null; }
    if (c === 3) {
      const t = torreDe(g, j[2]);
      if (!t || !t.def.targeting || !MODOS[j[3]]) return 'objetivo imposible';
      t.mode = MODOS[j[3]]; return null;
    }
    if (c === 4) return g.startRound() ? null : 'ronda que no se podía empezar';
    if (c === 5) {
      if (j[2] !== 0 && j[2] !== 1) return 'recarga inválida';
      if (g.over || g.active || g.enemies.length) return 'recarga a mitad de ronda';
      if (j[2] === 1 && g.continues < 1) return 'reintento sin reintentos';
      recarga(st, clona(g.snapshot()), j[2]);
      return null;
    }
    if (c === 6) {
      if (!Number.isInteger(j[2]) || !Number.isInteger(j[3])) return 'posición inválida';
      return g.placeSpikes(j[2], j[3]) ? null : 'no se podían tirar pinchos ahí';
    }
    if (c === 7) return g.elegirPacto(j[2]) ? null : 'pacto imposible';
    if (c === 8) {
      if (!Number.isInteger(j[2]) || !Number.isInteger(j[3])) return 'posición inválida';
      return g.lanzarPoder(j[2], j[3]) ? null : 'el Poder del Reino no estaba listo';
    }
    return 'jugada desconocida';
  }
  function recarga(st, snap, c) {
    snap.continues -= c;
    st.tramo++;
    st.pasos += st.k;
    st.game = new PD.Game(st.r, snap, semillaTramo(st.s, st.u, st.tramo));
    st.k = 0; st.q = 0;
  }
  function nuevo(r, s, u) {
    return { r, s: s >>> 0, u: String(u), game: new PD.Game(r, null, semillaTramo(s, u, 0)), k: 0, q: 0, tramo: 0, pasos: 0 };
  }
  const tiempoDe = st => Math.max(1, Math.round((st.pasos + st.k) * 1000 / 60));

  // ------------------------------- Grabadora --------------------------------
  // `run`: la partida guardada ({snap, pr}) para reanudarla, o null para una nueva.
  class Grabadora {
    constructor(r, u, run) {
      if (run && run.pr && Array.isArray(run.pr.j)) {
        const pr = run.pr;
        this.st = nuevo(r, pr.s, u);
        this.j = pr.j.slice(0, pr.n);
        this.j.push([pr.k, 5, pr.c ? 1 : 0]);
        this.st.tramo = this.j.filter(x => x[1] === 5).length - 1;
        this.st.pasos = this.j.reduce((a, x) => a + (x[1] === 5 ? x[0] : 0), 0) - pr.k;
        this.st.k = pr.k;
        recarga(this.st, clona(run.snap), pr.c ? 1 : 0);
      } else {
        const a = new Uint32Array(1);
        (globalThis.crypto && crypto.getRandomValues) ? crypto.getRandomValues(a) : (a[0] = Math.random() * 4294967296);
        this.st = nuevo(r, a[0], u);
        this.j = [];
      }
      this.reintento = null;
    }
    get game() { return this.st.game; }
    get paso() { return this.st.k; }
    tick() { return paso(this.st); }
    anota(j) { this.j.push(j); this.st.q = 0; }
    colocar(type, x, y) {
      x = Math.round(x); y = Math.round(y);
      const t = this.game.place(type, x, y);
      if (t) this.anota([this.st.k, 0, PD.TOWER_ORDER.indexOf(type), x, y]);
      return t;
    }
    pinchos(x, y) {
      x = Math.round(x); y = Math.round(y);
      const p = this.game.placeSpikes(x, y);
      if (p) this.anota([this.st.k, 6, x, y]);
      return p;
    }
    mejorar(t, p) { const ok = this.game.upgrade(t, p); if (ok) this.anota([this.st.k, 1, t.id, p]); return ok; }
    pacto(i) { const ok = this.game.elegirPacto(i); if (ok) this.anota([this.st.k, 7, i]); return ok; }
    poder(x, y) {
      x = Math.round(x); y = Math.round(y);
      const ok = this.game.lanzarPoder(x, y);
      if (ok) this.anota([this.st.k, 8, x, y]);
      return ok;
    }
    vender(t) { if (this.game.towers.indexOf(t) < 0) return; this.game.sell(t); this.anota([this.st.k, 2, t.id]); }
    modo(t, m) {
      const i = MODOS.indexOf(m);
      if (i < 0 || !t.def.targeting || t.mode === m) return;
      t.mode = m; this.anota([this.st.k, 3, t.id, i]);
    }
    ronda() {
      const g = this.game;
      if (g.active || g.over || g.round >= PD.MAX_ROUND) return false;
      const snap = g.snapshot(), n = this.j.length, k = this.st.k;
      if (!g.startRound()) return false;
      this.reintento = { snap, n, k };
      this.anota([k, 4]);
      return true;
    }
    // Lo que se guarda para reanudar. Entre rondas, la foto de ahora; a mitad
    // de una ronda (o tras perderla), la del comienzo de esa ronda.
    guardado() {
      const g = this.game, pr = n => ({ ve: VERSION, s: this.st.s, j: this.j.slice(0, n), n, k: 0, c: 0 });
      if (quieto(g) && !g.over) { const p = pr(this.j.length); p.k = this.st.k; return { snap: g.snapshot(), pr: p }; }
      const R = this.reintento;
      if (!R) return null;
      const p = pr(R.n); p.k = R.k; p.c = g.over ? 1 : 0;
      return { snap: clona(R.snap), pr: p };
    }
    tiempo() { return tiempoDe(this.st); }
    prueba() { return { v: 1, ve: VERSION, u: this.st.u, r: this.st.r, s: this.st.s, j: this.j.slice(), k: this.st.k }; }
  }

  // -------------------------------- Rehacer ---------------------------------
  // Vuelve a jugar la prueba. `cache` (opcional, un Map) guarda en qué quedó
  // cada partida ya rehecha, para que la ronda siguiente de la misma partida
  // solo simule lo nuevo; y las fotos de los ratos quietos, para que una
  // recarga (reanudar, reintentar) no obligue a empezar de cero.
  // Devuelve {ronda, tiempo, perdida, ganada} o lanza un Error con el motivo.
  function rehace(p, u, cache) {
    if (!p || p.v !== 1 || !Number.isInteger(p.r) || p.r < 0 || p.r >= REINOS.length ||
      !Number.isInteger(p.s) || p.s < 0 || p.s > 4294967295 || !Array.isArray(p.j) || p.j.length > MAX_JUGADAS ||
      !Number.isInteger(p.k) || p.k < 0 || p.k > MAX_PASOS) throw new Error('La prueba no tiene la forma esperada.');
    if (p.ve !== VERSION) throw new Error('La prueba es de otra versión del juego (recarga la página).');
    if (String(p.u) !== String(u)) throw new Error('La prueba es de otra cuenta.');
    for (const j of p.j) if (!Array.isArray(j) || j.length < 2 || j.length > 5 || !j.every(Number.isInteger) || j[0] < 0 || j[0] > MAX_PASOS) throw new Error('Una jugada no tiene la forma esperada.');
    const clave = u + '|' + p.r + '|' + p.s;
    try { return rehaceCon(p, u, cache, clave); }
    catch (e) { if (cache) cache.delete(clave); throw e; }
  }
  function rehaceCon(p, u, cache, clave) {
    const textos = p.j.map(j => j.join(','));
    let ent = cache && cache.get(clave);
    let st = null, i = 0;
    if (ent) {
      let L = 0;
      while (L < ent.textos.length && L < textos.length && ent.textos[L] === textos[L]) L++;
      const sig = n => (n < p.j.length ? p.j[n][0] : p.k);
      if (ent.i === L && ent.st.k <= sig(L)) { st = ent.st; i = L; }
      else {
        // Otra rama desde la jugada L (una recarga): las fotos de después ya no valen.
        ent.fotos = ent.fotos.filter(f => f.i <= L);
        const j = p.j[L];
        const m = j && j[1] === 5 && ent.fotos.find(f => f.i === L && f.k <= j[0] && j[0] - f.k <= QUIETO_MAX - f.q);
        if (m) {
          if ((j[2] !== 0 && j[2] !== 1) || (j[2] === 1 && m.continues < 1)) throw new Error('La partida no se puede rehacer: recarga inválida.');
          st = { r: p.r, s: p.s, u: String(u), game: null, k: j[0], q: 0, tramo: m.tramo, pasos: m.pasos };
          recarga(st, JSON.parse(m.snap), j[2]);
          i = L + 1;
          ent.textos = textos.slice(0, i); ent.i = i; ent.st = st;
        }
      }
      if (!st) { cache.delete(clave); ent = null; }
    }
    if (!st) st = nuevo(p.r, p.s, u);
    if (!ent && cache) {
      ent = { textos: [], fotos: [], st, i: 0 };
      cache.set(clave, ent);
      if (cache.size > 4) cache.delete(cache.keys().next().value);
    }
    // Una foto de cada rato quieto (al empezar, tras cada jugada entre rondas y al
    // terminar cada ronda): vale para cualquier paso hasta la jugada siguiente.
    const foto = n => {
      if (!ent || !quieto(st.game) || st.game.over) return;
      if (ent.fotos.some(f => f.i === n && f.tramo === st.tramo)) return;
      ent.fotos.push({ i: n, k: st.k, q: st.q, tramo: st.tramo, pasos: st.pasos, continues: st.game.continues, snap: JSON.stringify(st.game.snapshot()) });
      if (ent.fotos.length > 400) ent.fotos.shift();
    };
    const hasta = k => {
      while (st.k < k) {
        const antes = quieto(st.game);
        if (!paso(st)) throw new Error('La prueba espera más de lo que el juego deja esperar entre rondas.');
        if (!antes && quieto(st.game)) foto(i);   // acaba de terminar una ronda
      }
    };
    foto(i);
    for (; i < p.j.length; i++) {
      const j = p.j[i];
      if (j[0] < st.k) throw new Error('Las jugadas no van en orden.');
      hasta(j[0]);
      const motivo = aplica(st, j);
      if (motivo) throw new Error('La partida no se puede rehacer: ' + motivo + '.');
      st.q = 0;
      if (ent) { ent.textos[i] = textos[i]; ent.textos.length = i + 1; ent.i = i + 1; }
      foto(i + 1);
    }
    hasta(p.k);
    if (ent) { ent.st = st; ent.i = p.j.length; ent.textos = textos.slice(); }
    return { ronda: st.game.round, tiempo: tiempoDe(st), perdida: !!st.game.over, ganada: !!st.game.won };
  }

  PD.Prueba = { VERSION, Grabadora, rehace, categoria, reinoDe, REINOS, MODOS, QUIETO_MAX, STEP, semillaTramo };
  if (typeof module === 'object' && module.exports) module.exports = PD.Prueba;
})();
