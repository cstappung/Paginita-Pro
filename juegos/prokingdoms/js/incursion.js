// Mazmorras 2.0 (H3 del plan de la mega actualización). Cada visita a una mazmorra es una incursión de 5 pisos:
// en cada piso eliges una de 2 o 3 salas (combate, élite, tesoro, trampa, santuario, mercader, misterio) y el
// quinto es el jefe. Te puedes retirar entre salas con lo ganado; si pierdes una pelea, vuelves con la mitad.
// Cada lunes cambian dos afijos para todas las mazmorras (más difíciles, más botín).
//
// Va montado sobre las expediciones (expeditions.js): la incursión es una expedición con r.inc. Cada sala con
// pelea pone r.need y vuelve a la fase 'go' con llegada inmediata, así la batalla en vivo, el cálculo por
// proporción y el cálculo sin conexión son los de siempre. Sin el jugador (sin conexión, o 2 minutos sin elegir)
// se toma la sala por defecto, con una regla fija: el resultado no depende de mirar (regla 8).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const I = (PK.Inc = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);
  const W = () => PK.World;

  I.BLOQUE = 5;
  I.ELEGIR_S = 120; // en vivo, si nadie elige en 2 minutos, se elige solo
  I.SALAS = {
    combate: { name: 'Combate', desc: 'Una pelea del piso. Botín normal.', icon: 'war', pelea: 1, need: 1, botin: 1 },
    elite: { name: 'Élite', desc: 'Más difícil (x1,4). Botín x1,5 y un objeto de equipo.', icon: 'crown', pelea: 1, need: 1.4, botin: 1.5, objeto: true },
    tesoro: { name: 'Tesoro', desc: 'Sin pelea: un cofre del piso.', icon: 'chest', botin: 0.7 },
    trampa: { name: 'Trampa', desc: 'Pierdes un 8% de la tropa (nada con un Guardabosques). Algo de botín.', icon: 'wall', botin: 0.4 },
    santuario: { name: 'Santuario', desc: 'Cura a la mitad de tus caídos o da +12% de fuerza hasta el final.', icon: 'flask' },
    mercader: { name: 'Mercader', desc: 'Cambia recursos especiales por un objeto raro o mejor.', icon: 'market' },
    misterio: { name: 'Misterio', desc: 'Un tesoro, una bendición o una emboscada.', icon: 'scroll' },
    jefe: { name: 'Jefe', desc: 'El guardián del piso. Botín x2,5, un trofeo y un objeto raro o mejor.', icon: 'scale', pelea: 1, need: 1.5, botin: 2.5, objeto: true },
  };
  const PESO = { combate: 3, elite: 1.2, tesoro: 1, trampa: 0.9, santuario: 1, mercader: 0.7, misterio: 1 };
  // Jefes cada 5 pisos (Anexo A2). La mecánica vive en batalla.js (JEFE); aquí, el nombre y cómo se gana.
  I.JEFES = {
    cave: { name: 'Corazón de Cristal', mec: 'Con media vida se parte en tres gólems. Los cristales del suelo explotan si alguien se queda encima.', como: '«Al jefe» con caballeros o catapultas, y «Dispersarse» antes de que se parta.' },
    lair: { name: 'Matriarca Colmillo', mec: 'Aúlla cada 20 s y llama a tres lobos que van por tus tiradores.', como: 'Lanceros, «Cargar» y «Al jefe»: mientras viva, llama más lobos.' },
    crypt: { name: 'El Liche Sin Nombre', mec: 'Levanta a sus esqueletos caídos mientras no tengas clérigos vivos.', como: 'Lleva clérigos (o a la Clériga) y protégelos.' },
    crater: { name: 'Heraldo Estelar', mec: 'Marca círculos en el suelo y 3 s después caen meteoros.', como: '«Dispersarse» al ver las marcas.' },
    swamp: { name: 'Morgana del Pantano', mec: 'Maldice a tus tropas (las frena) y llama fuegos fatuos cada 15 s.', como: 'Caballeros y clérigos, «Cargar» y «Al jefe»: con clérigos vivos la maldición dura la mitad.' },
    giants: { name: 'Ymrok, Rey de los Gigantes', mec: 'Levanta el mazo y golpea el suelo: un círculo grande que aplasta a los que estén juntos.', como: '«Dispersarse» al ver el círculo; catapultas y arqueros de lejos.' },
    temple: { name: 'La Voz del Abismo', mec: 'Su canto encanta a tus tropas cuerpo a cuerpo (se quedan quietas) y sus tentáculos agarran.', como: 'Clérigos para romper el canto y «Cargar»: ir directo a ella («Al jefe») cuesta caro.' },
    nest: { name: 'Ignivor el Antiguo', mec: 'Vuela a ratos: en el aire solo le pegan arqueros y lanceros en línea. En el suelo, fuego en cono.', como: 'Arqueros y lanceros, «Mantener línea» cuando vuela y «Dispersarse» contra el fuego.' },
  };
  // Afijos semanales (Anexo A3). dureza: cuánto más difícil es en el cálculo por proporción (en vivo pesa la mecánica).
  I.AFIJOS = {
    niebla: { name: 'Niebla espesa', desc: '−40% alcance de tus tiradores', premio: '+25% botín', botin: 1.25, dureza: 1.06 },
    furia: { name: 'Furia', desc: 'enemigos +20% daño', premio: '+40% botín', botin: 1.4, dureza: 1.1 },
    tesoro: { name: 'Tesoro escondido', desc: 'una sala de Tesoro más por incursión', premio: '', botin: 1, dureza: 1 },
    plaga: { name: 'Plaga', desc: 'los clérigos no curan', premio: '+30% experiencia de héroe', botin: 1, xp: 0.3, dureza: 1.05 },
    espectral: { name: 'Aliados espectrales', desc: 'al morir, un enemigo deja un espectro', premio: '+1 objeto garantizado', botin: 1, objeto: true, dureza: 1.1 },
    helado: { name: 'Suelo helado', desc: 'todos −20% velocidad', premio: '+20% recursos especiales', botin: 1, sp: 1.2, dureza: 1 },
    sinluna: { name: 'Noche sin luna', desc: 'más oscuro y el doble de salas de élite', premio: 'botín de más rareza', botin: 1, suerte: 1, dureza: 1 },
    doble: { name: 'Botín doble', desc: 'enemigos +30% vida', premio: 'x2 botín', botin: 2, dureza: 1.15 },
  };
  function weekKey() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return U.dayKey(d); }
  I.afijos = function () {
    const rng = U.rng(U.strHash('afijos:' + weekKey())), ids = Object.keys(I.AFIJOS), a = U.pick(ids, rng);
    let b = U.pick(ids, rng);
    while (b === a) b = U.pick(ids, rng);
    return [a, b];
  };
  const af = r => (r.inc && r.inc.afijos) || [];
  I.tiene = (r, id) => af(r).includes(id);
  I.dureza = r => af(r).reduce((m, id) => m * (I.AFIJOS[id].dureza || 1), 1);
  const botinMult = r => af(r).reduce((m, id) => m * (I.AFIJOS[id].botin || 1), 1);
  const spMult = r => af(r).reduce((m, id) => m * (I.AFIJOS[id].sp || 1), 1);

  // ---------- Bloques de pisos ----------
  // Una incursión cubre un bloque (1-5, 6-10, 11-15). Se puede entrar al siguiente sin limpiar y repetir los limpiados.
  I.bloques = function (p) {
    const d = D.DUNGEON[p.kind], site = PK.Exp.site(p.id), out = [];
    for (let a = 1; a <= d.floors; a += I.BLOQUE) if (a <= site.best + 1) out.push({ desde: a, hasta: Math.min(d.floors, a + I.BLOQUE - 1), limpio: site.best >= Math.min(d.floors, a + I.BLOQUE - 1) });
    return out;
  };
  I.finDe = (kind, desde) => Math.min(D.DUNGEON[kind].floors, desde + I.BLOQUE - 1);
  I.esJefe = (kind, piso) => piso % I.BLOQUE === 0 || piso === D.DUNGEON[kind].floors;
  // Botín estimado de todo el bloque (para el planificador): las salas de pelea del bloque más el jefe.
  I.botinBloque = function (kind, desde) {
    const fin = I.finDe(kind, desde), out = {}, site = S().exp.sites, add = (o, k) => { for (const r in o) out[r] = (out[r] || 0) + Math.round(o[r] * k); };
    for (let f = desde; f <= fin; f++) add(D.dungeonLoot(kind, f, false), (I.esJefe(kind, f) ? 2.5 : 1) * I.BOTIN_SALA);
    void site;
    return out;
  };

  // ---------- Empezar y llegar ----------
  I.preparar = function (r, p) {
    r.inc = { desde: r.floor, piso: r.floor, fin: I.finDe(p.kind, r.floor), botin: {}, items: [], bend: 0, perdidos: {}, enviados: Object.assign({}, r.units), log: [], afijos: I.afijos(), tesoros: 0 };
  };
  // Llegó a la puerta (o terminó una sala): a elegir la del piso actual.
  I.llegar = function (r) {
    const inc = r.inc, p = W().pois[r.poi];
    inc.opciones = I.esJefe(p.kind, inc.piso) ? ['jefe'] : opcionesDe(r, inc.piso);
    inc.hasta = G().ahora() + I.ELEGIR_S * 1000;
    r.phase = 'sala';
    r.jefe = null;
    if (!G().offline) toast('Piso ' + inc.piso + ' de ' + D.DUNGEON[p.kind].name + ': ' + (inc.opciones[0] === 'jefe' ? '¡el jefe, ' + I.JEFES[p.kind].name + '!' : 'elige el camino.'), inc.opciones[0] === 'jefe' ? 'bad' : 'info', { label: 'Elegir', fn: () => I.open(r.id) });
  };
  function opcionesDe(r, piso) {
    const rng = U.rng(r.id * 131 + piso * 7 + 3), n = Math.min(4, (rng() < 0.45 ? 3 : 2) + (G().bono ? G().bono('salas') : 0)), peso = Object.assign({}, PESO), out = [];
    if (I.tiene(r, 'sinluna')) peso.elite *= 2;
    while (out.length < n) {
      const libres = Object.keys(peso).filter(k => !out.includes(k)), tot = libres.reduce((s, k) => s + peso[k], 0);
      let x = rng() * tot, k = libres[0];
      for (const id of libres) { x -= peso[id]; if (x <= 0) { k = id; break; } }
      out.push(k);
    }
    // siempre hay al menos una sala con pelea: no se baja un piso solo esquivando
    if (!out.some(k => I.SALAS[k].pelea)) out[0] = 'combate';
    // afijo «Tesoro escondido»: la primera vez, una de las salas es un tesoro
    if (I.tiene(r, 'tesoro') && !r.inc.tesoros && !out.includes('tesoro')) out[out.length - 1] = 'tesoro';
    return out;
  }
  // La sala por defecto (sin jugador): curar si hace falta, después lo seguro, nunca el mercader.
  I.porDefecto = function (r) {
    const o = r.inc.opciones, perdio = Object.values(r.inc.perdidos).some(n => n > 0);
    for (const k of [perdio ? 'santuario' : null, 'tesoro', 'combate', 'misterio', 'santuario', 'jefe', 'elite', 'trampa', 'mercader']) if (k && o.includes(k)) return k;
    return o[0];
  };

  // ---------- Resolver una sala ----------
  I.elegir = function (id, k, extra) {
    const r = S().exp.runs.find(o => o.id === id);
    if (!r || r.phase !== 'sala' || !r.inc.opciones.includes(k)) return false;
    const inc = r.inc, p = W().pois[r.poi], sala = I.SALAS[k], fl = inc.piso, base = D.dungeonLoot(p.kind, fl, fl > PK.Exp.site(p.id).best);
    inc.sala = k;
    inc.log.push('Piso ' + fl + ': ' + sala.name);
    if (k === 'tesoro') { inc.tesoros++; sumar(r, base, sala.botin); return avanzar(r); }
    if (k === 'trampa') {
      if (!guardabosques(r)) perder(r, 0.08);
      sumar(r, base, sala.botin);
      return avanzar(r);
    }
    if (k === 'santuario') {
      const curar = extra === 'curar' || (extra !== 'bendicion' && Object.values(inc.perdidos).some(n => n > 0));
      if (curar) for (const t in inc.perdidos) { const n = Math.floor(inc.perdidos[t] / 2); r.units[t] = (r.units[t] || 0) + n; inc.perdidos[t] -= n; }
      else inc.bend += 0.12;
      inc.log.push(curar ? 'Curó a sus heridos.' : 'Bendición: +12% de fuerza.');
      return avanzar(r);
    }
    if (k === 'mercader') {
      if (extra === 'comprar' && I.puedeComprar(r)) {
        G().pay(I.precio(r));
        inc.items.push(PK.Heroes.crearObjeto(0.9, 1));
        if (inc.items[inc.items.length - 1].r < 1) inc.items[inc.items.length - 1].r = 1;
        inc.log.push('Le compró un objeto al mercader.');
      }
      return avanzar(r);
    }
    if (k === 'misterio') {
      const x = U.rng(r.id * 977 + fl)();
      if (x < 0.4) { sumar(r, base, 1); inc.log.push('Misterio: un tesoro.'); return avanzar(r); }
      if (x < 0.7) { inc.bend += 0.08; inc.log.push('Misterio: una bendición (+8%).'); return avanzar(r); }
      inc.log.push('Misterio: ¡una emboscada!');
      return pelear(r, p, fl, 0.8, 1.3);
    }
    if (k === 'jefe') r.jefe = p.kind;
    return pelear(r, p, fl, sala.need, sala.botin, !!sala.objeto);
  };
  function pelear(r, p, fl, needK, botinK, objeto) {
    const inc = r.inc;
    inc.pelea = { botinK, objeto };
    r.need = Math.round(D.dungeonPower(p.kind, fl) * needK);
    r.power = Math.round(PK.Exp.powerVs(r.units, r.enemy, r.heroe) * (1 + inc.bend));
    r.heal = PK.Exp.heal(r.units);
    r.chance = PK.Exp.chance((r.power * (PK.Exp.TACTICS[r.tactic] || PK.Exp.TACTICS.normal).pow) / Math.max(1, r.need * I.dureza(r)));
    r.name = D.DUNGEON[p.kind].name + ' · piso ' + fl + (r.jefe ? ' · ' + I.JEFES[p.kind].name : '');
    r.floor = fl;
    r.phase = 'go';
    r.arrive = G().ahora() + 2500; // entrar a la sala
    r.warned = true;
    return true;
  }
  const guardabosques = r => { const h = r.heroe && PK.Heroes ? PK.Heroes.de(r.heroe) : null; return !!h && h.clase === 'guarda'; };
  function perder(r, frac) {
    for (const t in r.units) {
      const n = Math.min(r.units[t], Math.round(r.units[t] * frac));
      r.units[t] -= n;
      r.inc.perdidos[t] = (r.inc.perdidos[t] || 0) + n;
    }
  }
  // Una incursión trae 5 pisos de una vez (antes, uno por cada reposo de la mazmorra): cada sala da una parte
  // (I.BOTIN_SALA) para que los recursos especiales sigan saliendo como antes (plan, H3.5). Las monedas, solo la
  // primera vez que se limpia un piso, y sin multiplicar.
  I.BOTIN_SALA = 0.35;
  function sumar(r, loot, k) {
    const b = r.inc.botin, m = botinMult(r), sp = spMult(r);
    for (const res in loot) b[res] = (b[res] || 0) + (res === 'coins' ? loot[res] : Math.round(loot[res] * k * m * I.BOTIN_SALA * (D.SPECIAL.includes(res) ? sp : 1)));
  }
  I.precio = function (r) { const p = W().pois[r.poi], d = D.DUNGEON[p.kind]; return { [d.loot]: 6 + 2 * r.inc.piso }; };
  I.puedeComprar = r => !!PK.Heroes && G().canAfford(I.precio(r));
  // Siguiente piso, o fin del bloque.
  function avanzar(r) {
    const inc = r.inc, p = W().pois[r.poi], site = PK.Exp.site(p.id), st = S();
    if (inc.piso > site.best) {
      site.best = inc.piso;
      st.stats['floor_' + p.kind] = Math.max(st.stats['floor_' + p.kind] || 0, inc.piso);
      st.stats.floor_max = Math.max(st.stats.floor_max || 0, inc.piso);
    }
    inc.sala = null;
    if (inc.piso >= inc.fin) { terminar(r, true); return true; }
    inc.piso++;
    I.llegar(r);
    return true;
  }
  // Lo llama resolve() (expeditions.js) después de cada pelea de la incursión. true: sigue adentro.
  I.tras = function (r) {
    const inc = r.inc, p = W().pois[r.poi];
    // pociones del Herbolario (H4): tras una sala ganada salvan a parte de los caídos de esa pelea
    const poc = r.won ? Math.min(0.9, G().best('herbolario', 'pociones') * (1 + (G().bono ? G().bono('pociones') : 0))) : 0;
    if (poc) { let n = 0; for (const t in r.lost || {}) { const v = Math.floor(r.lost[t] * poc); r.lost[t] -= v; r.units[t] += v; n += v; } if (n) inc.log.push('Pociones: ' + n + ' caídos vuelven a pelear.'); }
    for (const t in r.lost || {}) inc.perdidos[t] = (inc.perdidos[t] || 0) + r.lost[t];
    if (!r.won) { terminar(r, false); return false; }
    const pl = inc.pelea || { botinK: 1 }, first = inc.piso > PK.Exp.site(p.id).best;
    sumar(r, D.dungeonLoot(p.kind, inc.piso, first), pl.botinK);
    if (pl.objeto && PK.Heroes) inc.items.push(PK.Heroes.crearObjeto(0.5 + inc.piso / 30, (I.tiene(r, 'sinluna') ? 1 : 0) + (r.jefe ? 1 : 0)));
    if (r.jefe) {
      const st = S();
      st.trofeos = st.trofeos || {};
      st.trofeos[p.kind] = (st.trofeos[p.kind] || 0) + 1;
      G().stat('bosses_killed', 1);
      const it = inc.items[inc.items.length - 1];
      if (it && it.r < 1) it.r = 1;
      inc.log.push('¡Venció a ' + I.JEFES[p.kind].name + '!');
      if (!G().offline) toast('¡' + I.JEFES[p.kind].name + ' cayó! Trofeo para el Álbum.', 'epic');
    }
    inc.pelea = null;
    r.jefe = null;
    avanzar(r);
    return r.phase === 'sala';
  };
  // Fin: vuelve con todo (o la mitad si perdió una pelea).
  function terminar(r, ok, retirada) {
    const inc = r.inc, p = W().pois[r.poi];
    if (!ok) for (const k in inc.botin) inc.botin[k] = Math.floor(inc.botin[k] / 2);
    if (ok && I.tiene(r, 'espectral') && PK.Heroes) inc.items.push(PK.Heroes.crearObjeto(0.6, 0));
    r.loot = inc.botin;
    r.won = ok;
    r.heroeGano = ok;
    r.lost = Object.assign({}, inc.perdidos);
    r.incFin = { ok, retirada: !!retirada, pisos: inc.piso - inc.desde + (ok && !retirada ? 1 : 0) };
    r.name = D.DUNGEON[p.kind].name + ' · pisos ' + inc.desde + '–' + inc.fin;
    r.floor = inc.desde;
    r.phase = 'fin';
  }
  // Retirarse entre salas, con lo ganado.
  I.retirarse = function (id) {
    const r = S().exp.runs.find(o => o.id === id);
    if (!r || r.phase !== 'sala') return false;
    r.inc.log.push('Se retiraron con el botín.');
    terminar(r, true, true);
    return true;
  };
  // En cada vuelta de Exp.update: sin jugador (o pasado el plazo), la sala por defecto.
  I.update = function (r, offline) {
    if (r.phase !== 'sala') return;
    if (offline || G().ahora() >= r.inc.hasta) I.elegir(r.id, I.porDefecto(r));
  };
  // Al volver al Cuartel: el equipo encontrado (con o sin héroe).
  I.volver = function (r) {
    if (!r.inc || !PK.Heroes) return;
    for (const o of r.inc.items) {
      const it = PK.Heroes.guardarObjeto(o);
      if (it) toast('Equipo de la incursión: ' + PK.Heroes.itemNombre(it) + ' (' + PK.Heroes.RAREZAS[it.r].name + ').', 'epic', { label: 'Ver', fn: () => PK.Heroes.open('inv') });
    }
    r.inc.items = [];
  };

  // ---------- Ventana: elegir sala ----------
  I.open = function (id) {
    const UI = PK.UI;
    UI.modal('incursion', 'Incursión', body => {
      const r = S().exp.runs.find(o => o.id === id);
      if (!r || !r.inc) { body.append(el('p', null, 'Esa incursión ya terminó.')); return; }
      const inc = r.inc, p = W().pois[r.poi], d = D.DUNGEON[p.kind];
      body.append(el('h3', null, d.name + ' · pisos ' + inc.desde + '–' + inc.fin),
        el('div', { class: 'inc-pisos' }, Array.from({ length: inc.fin - inc.desde + 1 }, (_, i) => { const f = inc.desde + i; return el('span', { class: 'inc-p' + (f < inc.piso ? ' ok' : f === inc.piso ? ' aqui' : '') + (I.esJefe(p.kind, f) ? ' jefe' : '') }, I.esJefe(p.kind, f) ? '☠' : String(f)); })),
        el('p', { class: 'small' }, 'Tropa: ' + Object.keys(r.units).filter(k => r.units[k]).map(k => r.units[k] + ' ' + D.ARMY[k].name.toLowerCase()).join(', ') + (inc.bend ? ' · bendición +' + Math.round(inc.bend * 100) + '%' : '')),
        el('div', { class: 'row small' }, el('b', null, 'Botín hasta ahora: '), Object.keys(inc.botin).length ? UI.costEl(inc.botin, 1, true) : 'nada', inc.items.length ? ' + ' + inc.items.length + ' objeto' + (inc.items.length > 1 ? 's' : '') : ''),
        el('p', { class: 'small muted' }, 'Afijos de la semana: ' + inc.afijos.map(a => I.AFIJOS[a].name + ' (' + I.AFIJOS[a].desc + (I.AFIJOS[a].premio ? '; ' + I.AFIJOS[a].premio : '') + ')').join(' · ')));
      if (r.phase !== 'sala') {
        body.append(el('p', null, r.phase === 'battle' ? 'Están peleando.' : r.phase === 'go' ? 'Entrando a la sala…' : 'La incursión terminó.'),
          r.phase === 'battle' ? UI.btn('Ver batalla', () => PK.Batalla.abrir(r.id), { cls: 'gold' }) : '');
        return;
      }
      const jefe = inc.opciones[0] === 'jefe';
      body.append(el('p', null, el('b', null, jefe ? '¡El jefe del piso ' + inc.piso + '!' : 'Piso ' + inc.piso + ': elige el camino')), el('p', { class: 'small muted' }, 'Si no eliges en ' + U.fmtTime(Math.max(0, (inc.hasta - Date.now()) / 1000)) + ', tu capitán elige solo.'));
      const fuerza = Math.round(PK.Exp.powerVs(r.units, r.enemy, r.heroe) * (1 + inc.bend));
      const cards = el('div', { class: 'inc-salas' });
      for (const k of inc.opciones) {
        const s = I.SALAS[k], need = s.pelea ? Math.round(D.dungeonPower(p.kind, inc.piso) * s.need * I.dureza(r)) : 0, ch = need ? PK.Exp.chance(fuerza / need) : 0;
        const acc = k === 'santuario' ? el('div', { class: 'row' }, UI.btn('Curar', () => { I.elegir(r.id, k, 'curar'); UI.rerender(); }, { small: true, cls: 'gold', disabled: !Object.values(inc.perdidos).some(n => n > 0) }), UI.btn('Bendición', () => { I.elegir(r.id, k, 'bendicion'); UI.rerender(); }, { small: true, cls: 'gold' }))
          : k === 'mercader' ? el('div', { class: 'row' }, UI.btn('Comprar', () => { I.elegir(r.id, k, 'comprar'); UI.rerender(); }, { small: true, cls: 'gold', disabled: !I.puedeComprar(r), title: PK.Heroes ? '' : 'Necesitas la Taberna' }), UI.costEl(I.precio(r)), UI.btn('Seguir', () => { I.elegir(r.id, k); UI.rerender(); }, { small: true }))
            : UI.btn(jefe ? '¡A por él!' : 'Entrar', () => { I.elegir(r.id, k); if (r.phase === 'go' && r.watch !== false) r.watch = true; UI.rerender(); }, { small: true, cls: 'gold' });
        cards.append(el('div', { class: 'inc-sala ' + k }, el('img', { class: 'ico', src: PK.Sprites.icon(s.icon), alt: '' }), el('b', null, jefe ? I.JEFES[p.kind].name : s.name),
          el('p', { class: 'small' }, jefe ? I.JEFES[p.kind].mec : s.desc),
          jefe ? el('p', { class: 'small good-t' }, 'Cómo se gana: ' + I.JEFES[p.kind].como) : '',
          need ? el('div', { class: 'bar thin' }, el('div', { class: 'fill ' + (ch >= 0.75 ? 'green' : ch >= 0.45 ? 'gold' : 'red'), style: { width: ch * 100 + '%' } }), el('span', null, 'aprox. ' + Math.round(ch * 100) + '% · fuerza ' + U.fmt(fuerza) + ' contra ' + U.fmt(need))) : '',
          acc));
      }
      body.append(cards, el('div', { class: 'row' }, UI.btn('Volver con el botín', () => { I.retirarse(r.id); UI.closeModal(); }, { small: true, title: 'Se retiran ahora y se quedan con todo lo ganado' })));
    }, { wide: true });
  };
})();
