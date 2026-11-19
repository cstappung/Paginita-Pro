// Héroes (H1 del plan de la mega actualización). Se reclutan en la Taberna, suben de nivel en expediciones,
// eligen talentos cada 5 niveles y llevan equipo (arma, armadura y talismán) que sale de mazmorras y campamentos.
// Mientras están en casa pueden gobernar un edificio (una pasiva de reino según la clase). En una expedición
// suben la fuerza de la compañía contra los enemigos de su especialidad, y en la batalla en vivo usan su
// habilidad (batalla.js). Nunca mueren: si su grupo pierde, vuelven heridos un rato.
//
// Todo vive en el cliente (S.heroes). Los héroes solo suben la fuerza contra mazmorras, campamentos y encargos
// (Exp.powerVs); Social.power, que es lo que ve el servidor (defensa, ataques a territorios), no los cuenta.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const H = (PK.Heroes = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);

  // ---------- Tablas ----------
  // gob: dónde puede gobernar ('*' = cualquier edificio que se mejore). pas: la pasiva mientras gobierna.
  // hab: la habilidad de batalla (batalla.js la ejecuta). vs: contra qué rinde más. sp: el recurso especial para reclutarla.
  H.CLASES = {
    paladin: { name: 'Paladín', rol: 'Primera línea', col: [214, 178, 70], look: 'knight', gob: ['barracks'], pas: { armyTrain: 0.15 }, pasTxt: 'Cuartel: +15% velocidad de entrenamiento',
      hab: { id: 'muro', name: 'Muro de escudos', desc: '−50% de daño recibido por 8 s', cd: 30, dur: 8 }, vs: ['undead', 'bandit'], sp: 'hide' },
    guarda: { name: 'Guardabosques', rol: 'Tirador', col: [86, 150, 70], look: 'archer', gob: ['scout'], pas: { range: 0.2, hunt: 0.2 }, pasTxt: 'Puesto de Exploradores: +20% de radio de exploración y +20% caza',
      hab: { id: 'lluvia', name: 'Lluvia de flechas', desc: 'daño en un área llena de enemigos', cd: 25 }, vs: ['beast', 'dragon', 'giant'], sp: 'hide' },
    clerigo: { name: 'Clériga', rol: 'Apoyo', col: [236, 228, 200], look: 'cleric', gob: ['monastery'], pas: { relicGold: 0.2, heridas: 0.3 }, pasTxt: 'Monasterio: +20% oro de reliquias y −30% tiempo de heridas',
      hab: { id: 'plegaria', name: 'Plegaria', desc: 'cura un 30% de vida a todos', cd: 40 }, vs: ['undead', 'arcane'], sp: 'lore', mujer: true },
    ingeniera: { name: 'Ingeniera', rol: 'Asedio', col: [200, 120, 50], look: 'militia', gob: '*', pas: { upTime: 0.1 }, pasTxt: 'El edificio que gobierna: −10% tiempo de mejora',
      hab: { id: 'bombarda', name: 'Bombarda', desc: 'gran daño a un objetivo, x3 contra gólems', cd: 35 }, vs: ['golem'], sp: 'crystal', mujer: true },
    hechicero: { name: 'Hechicero', rol: 'Daño mágico', col: [130, 80, 200], look: 'cleric', gob: ['library', 'university'], pas: { research: 0.1 }, pasTxt: 'Biblioteca o Universidad: +10% investigación',
      hab: { id: 'rayo', name: 'Rayo encadenado', desc: 'salta entre 5 enemigos', cd: 30 }, vs: ['golem', 'dragon', 'abyss'], sp: 'lore' },
    juglar: { name: 'Juglar', rol: 'Moral', col: [200, 60, 80], look: 'militia', gob: ['tavern', 'tc'], pas: { fiesta: 0.1, missions: 1 }, pasTxt: 'Taberna o Centro Urbano: fiestas +10% y +1 encargo en el tablón',
      hab: { id: 'cancion', name: 'Canción de guerra', desc: '+25% velocidad y daño por 10 s', cd: 45, dur: 10 }, vs: [], sp: 'crystal' },
  };
  // La Corsaria (Fase 9 «d», pk-30): solo se recluta en el archipiélago (Dársena de guerra, con la Escuela de
  // navegantes) y nunca sale en la Taberna. Dirige la armada: su habilidad pone el viento a favor y hace pegar más a
  // los abordajes (batalla.js, 'corrientes'). Una sola entre los dos mundos.
  H.CLASES.corsaria = { name: 'Corsaria', rol: 'Almirante', col: [60, 120, 170], look: 'archer', gob: ['barracks'], pas: { armyTrain: 0.15 }, pasTxt: 'Dársena de guerra: +15% velocidad de armado',
    hab: { id: 'corrientes', name: 'Leer las corrientes', desc: 'el viento sopla a favor y los abordajes pegan +40% por 12 s', cd: 35, dur: 12 }, vs: ['pirata', 'fantasma'], sp: 'especias', mujer: true, mar: true };
  H.ORDEN = ['paladin', 'guarda', 'clerigo', 'ingeniera', 'hechicero', 'juglar'];
  // Efectos (fracciones): fuerza, vs (extra contra su especialidad), bajas (menos bajas), herida (heridas más cortas),
  // xp, botin, viaje (viajes más cortos), pot (potencia de la habilidad), cd (recarga más corta), pasiva, prod
  // (producción del edificio que gobierna), suerte (rareza del botín) y vs_<enemigo>.
  H.RASGOS = {
    valiente: { name: 'Valiente', desc: '+10% fuerza, +10% bajas propias', ef: { fuerza: 0.1, bajas: -0.1 } },
    prudente: { name: 'Prudente', desc: '−15% bajas, −3% fuerza', ef: { bajas: 0.15, fuerza: -0.03 } },
    avaro: { name: 'Avaro', desc: '+20% botín', ef: { botin: 0.2 } },
    erudito: { name: 'Erudito', desc: '+25% experiencia', ef: { xp: 0.25 } },
    robusto: { name: 'Robusto', desc: 'heridas −50%', ef: { herida: 0.5 } },
    veloz: { name: 'Veloz', desc: 'viajes −15%', ef: { viaje: 0.15 } },
    suertudo: { name: 'Suertudo', desc: 'botín de más rareza', ef: { suerte: 1 } },
  };
  // Talentos: 8 escalones (niveles 5, 10 … 40), dos opciones cada uno. El efecto es común; el nombre, de la clase.
  H.TALENTOS = [
    [{ pot: 0.25 }, { cd: 0.2 }], [{ fuerza: 0.04 }, { bajas: 0.08 }], [{ pasiva: 0.5 }, { xp: 0.2 }], [{ vs: 0.08 }, { botin: 0.1 }],
    [{ pot: 0.25 }, { cd: 0.2 }], [{ fuerza: 0.05 }, { herida: 0.3 }], [{ pasiva: 0.5 }, { viaje: 0.1 }], [{ fuerza: 0.06 }, { bajas: 0.12 }],
  ];
  H.TAL_NOMBRES = {
    paladin: ['Escudo de torre', 'Voto de hierro', 'Brazo firme', 'Coraza bendita', 'Mentor del cuartel', 'Guardia veterana', 'Azote de muertos', 'Diezmo sagrado', 'Baluarte', 'Carga sagrada', 'Martillo justo', 'Fe inquebrantable', 'Capitán del reino', 'Marcha forzada', 'Campeón', 'Juramento eterno'],
    guarda: ['Flechas de caza', 'Arco rápido', 'Ojo de halcón', 'Sendero oculto', 'Rastreador', 'Hijo del bosque', 'Cazador de dragones', 'Trampero', 'Lluvia densa', 'Carcaj sin fondo', 'Puntería', 'Piel curtida', 'Mapas del bosque', 'Atajos', 'Flecha negra', 'Sombra entre árboles'],
    clerigo: ['Voz clara', 'Rezo breve', 'Mano firme', 'Paz interior', 'Abadesa', 'Libro de horas', 'Luz contra la cripta', 'Limosnas', 'Gracia', 'Vigilia', 'Luz que quema', 'Bálsamo', 'Gran abadía', 'Peregrina', 'Martillo de luz', 'Manto sagrado'],
    ingeniera: ['Pólvora fina', 'Carga rápida', 'Cálculo', 'Planos de asedio', 'Jefa de obra', 'Cuaderno', 'Rompepiedras', 'Chatarra útil', 'Doble carga', 'Recarga mecánica', 'Ariete', 'Casco de cuero', 'Andamios', 'Carro de bueyes', 'Gran bombarda', 'Refugio blindado'],
    hechicero: ['Chispa', 'Mente rápida', 'Runas de poder', 'Escudo arcano', 'Sabio', 'Estudioso', 'Rayo de cristal', 'Alquimia', 'Tormenta', 'Eco arcano', 'Fuego blanco', 'Piel de piedra', 'Biblioteca viva', 'Portal menor', 'Archimago', 'Velo arcano'],
    juglar: ['Estribillo', 'Ritmo vivo', 'Grito de guerra', 'Coro', 'Maestro de fiestas', 'Cuentacuentos', 'Himno', 'Sombrero pasado', 'Gran balada', 'Tambor', 'Canción del valor', 'Risa contagiosa', 'Fama', 'Caravana', 'Leyenda viva', 'Canto del regreso'],
  };
  const NOMBRES = {
    m: ['Aldric', 'Bruno', 'Ciro', 'Darío', 'Elián', 'Fermín', 'Gael', 'Hugo', 'Íker', 'Joaquín', 'Lisandro', 'Matías', 'Nicanor', 'Osvaldo', 'Rodrigo', 'Tadeo', 'Valerio', 'Zenón', 'Anselmo', 'Baltasar'],
    f: ['Ainhoa', 'Brisa', 'Celeste', 'Dafne', 'Elena', 'Fiona', 'Greta', 'Inés', 'Jimena', 'Lucía', 'Maite', 'Nerea', 'Olivia', 'Renata', 'Selene', 'Tamara', 'Vera', 'Ximena', 'Leonor', 'Amaya'],
  };
  H.MAX = 6;
  H.INV_MAX = 60;
  H.TOPE_FUERZA = 0.6; // héroe + equipo: como mucho +60% sobre la compañía (plan, H1)

  // Equipo: se guarda como semilla + rareza (+ mejora). Los atributos salen de la semilla.
  H.RAREZAS = [
    { name: 'común', col: '#a8a8a8', txt: '#4a4a4a', k: 1, n: 1, esencia: 2 },
    { name: 'rara', col: '#5aa8ff', txt: '#1f5cb8', k: 1.5, n: 2, esencia: 6 },
    { name: 'épica', col: '#c070ff', txt: '#7a2aa8', k: 2.2, n: 2, esencia: 15 },
    { name: 'legendaria', col: '#ffb040', txt: '#a85a00', k: 3, n: 3, esencia: 40 },
  ];
  H.RANURAS = { arma: 'Arma', armadura: 'Armadura', talisman: 'Talismán' };
  const POOL = {
    arma: [['fuerza', 0.02, 0.04], ['vs_beast', 0.05, 0.09], ['vs_bandit', 0.05, 0.09], ['vs_undead', 0.05, 0.09], ['vs_golem', 0.05, 0.09], ['vs_dragon', 0.05, 0.09], ['pot', 0.05, 0.1]],
    armadura: [['bajas', 0.03, 0.06], ['herida', 0.06, 0.12], ['fuerza', 0.015, 0.03]],
    talisman: [['xp', 0.06, 0.12], ['botin', 0.03, 0.06], ['prod', 0.02, 0.04], ['cd', 0.04, 0.08]],
  };
  const BASES = {
    arma: ['Espada', 'Hacha', 'Lanza', 'Arco', 'Maza', 'Bastón'],
    armadura: ['Cota', 'Coraza', 'Capa', 'Peto', 'Gambesón'],
    talisman: ['Amuleto', 'Anillo', 'Broche', 'Colgante', 'Medallón'],
  };
  const DE = ['del Alba', 'del Lobo', 'de la Cripta', 'del Cráter', 'del Dragón', 'de los Reyes', 'de Cristal', 'del Viento', 'de Ceniza', 'de la Luna'];
  // tope de cada efecto sumado (para que el equipo no rompa nada)
  const TOPE = { bajas: 0.5, herida: 0.8, botin: 0.5, xp: 1, prod: 0.25, cd: 0.4, viaje: 0.35, pot: 1, pasiva: 1.5, suerte: 3 };
  H.EF_TXT = { fuerza: 'fuerza', vs: 'contra su especialidad', bajas: 'menos bajas', herida: 'heridas más cortas', xp: 'experiencia', botin: 'botín', viaje: 'viajes más cortos', pot: 'potencia de la habilidad', cd: 'recarga más corta', pasiva: 'pasiva al gobernar', prod: 'producción del edificio que gobierna', suerte: 'suerte con el botín' };
  H.efTxt = function (k, v) {
    if (k.startsWith('vs_')) return '+' + Math.round(v * 100) + '% contra ' + D.ENEMY[k.slice(3)].name.toLowerCase();
    if (k === 'suerte') return '+' + v + ' de suerte con el botín';
    return (v >= 0 ? '+' : '−') + Math.round(Math.abs(v) * 100) + '% ' + (H.EF_TXT[k] || k);
  };

  H.itemStats = function (it) {
    if (it._st) return it._st;
    const rng = U.rng(it.s), R = H.RAREZAS[it.r], pool = POOL[it.t].slice(), out = {};
    const n = Math.min(pool.length, R.n + (it.r >= 2 && rng() < 0.4 ? 1 : 0));
    for (let i = 0; i < n; i++) {
      const [k, a, b] = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      out[k] = Math.round((a + (b - a) * rng()) * R.k * (1 + 0.1 * (it.m || 0)) * 1000) / 1000;
    }
    Object.defineProperty(it, '_st', { value: out, enumerable: false, configurable: true });
    return out;
  };
  H.itemNombre = function (it) {
    const rng = U.rng(it.s * 7 + 3), base = U.pick(BASES[it.t], rng), de = U.pick(DE, rng);
    return base + ' ' + de + (it.m ? ' +' + it.m : '');
  };
  const recalc = it => { delete it._st; return H.itemStats(it); };

  // ---------- Estado ----------
  H.init = function (st) {
    const h = (st.heroes = st.heroes || {});
    h.lista = h.lista || [];
    h.inv = h.inv || [];
    h.esencia = h.esencia || 0;
    h.tab = h.tab || { dia: '', tomados: [] };
    h.nid = h.nid || 1;
    for (const x of h.lista) { x.talentos = x.talentos || []; x.equipo = x.equipo || {}; x.xp = x.xp || 0; }
  };
  const est = () => S().heroes;
  H.lista = () => (est() ? est().lista : []);
  H.de = id => H.lista().find(h => h.id === id) || null;
  H.libres = () => H.lista().filter(h => h.estado === 'libre');

  H.efecto = function (h, k) {
    if (!h) return 0;
    let s = (H.RASGOS[h.rasgo] && H.RASGOS[h.rasgo].ef[k]) || 0;
    h.talentos.forEach((c, i) => { s += (H.TALENTOS[i] && H.TALENTOS[i][c] && H.TALENTOS[i][c][k]) || 0; });
    for (const r in h.equipo) { const it = est().inv.find(o => o.id === h.equipo[r]); if (it) s += H.itemStats(it)[k] || 0; }
    return TOPE[k] !== undefined ? Math.min(TOPE[k], s) : s;
  };
  // Cuánto multiplica la fuerza de la compañía contra esa mezcla de enemigos (1 = nada, 1,6 = el tope).
  H.mult = function (h, enemy) {
    if (!h) return 1;
    const c = H.CLASES[h.clase], tot = Object.values(enemy || {}).reduce((s, v) => s + v, 0) || 1;
    let vs = 0;
    for (const e in enemy || {}) {
      const w = enemy[e] / tot;
      if (c.vs.includes(e)) vs += w * (0.15 + H.efecto(h, 'vs'));
      vs += w * H.efecto(h, 'vs_' + e);
    }
    const bono = 0.08 + 0.006 * h.nivel + H.efecto(h, 'fuerza') + vs + (c.vs.length ? 0 : 0.06); // el Juglar no tiene especialidad: rinde parejo
    return 1 + U.clamp(bono, 0, H.TOPE_FUERZA);
  };

  // ---------- Niveles y talentos ----------
  H.tope = () => Math.min(40, 5 + 3 * S().era);
  H.xpPara = n => 40 + 12 * n;
  H.talentosPendientes = h => Math.max(0, Math.min(8, Math.floor(h.nivel / 5)) - h.talentos.length);
  H.darXp = function (h, n) {
    h.xp += Math.round(n * (1 + H.efecto(h, 'xp') + (G().bono ? G().bono('heroXp') : 0)));
    let subio = 0;
    while (h.nivel < H.tope() && h.xp >= H.xpPara(h.nivel)) { h.xp -= H.xpPara(h.nivel); h.nivel++; subio++; }
    if (h.nivel >= H.tope()) h.xp = Math.min(h.xp, H.xpPara(h.nivel) - 1);
    if (subio) {
      const stt = S().stats;
      stt.hero_lvl = Math.max(stt.hero_lvl || 0, h.nivel);
      toast(h.nombre + ' sube al nivel ' + h.nivel + (H.talentosPendientes(h) ? '. ¡Puede elegir un talento!' : '.'), 'epic', { label: 'Ver', fn: () => H.open('heroes', h.id) });
      if (PK.Sfx) PK.Sfx.play('level');
    }
    return subio;
  };
  H.elegirTalento = function (h, c) {
    if (!H.talentosPendientes(h) || (c !== 0 && c !== 1)) return false;
    h.talentos.push(c);
    return true;
  };
  H.talento = (h, i, c) => ({ name: H.TAL_NOMBRES[h.clase][i * 2 + c], ef: H.TALENTOS[i][c] });

  // ---------- La Taberna: candidatos del día ----------
  H.taberna = () => G().buildings.find(b => b.owner === 'p' && b.done && b.type === 'tavern') || null;
  H.max = () => { const t = H.taberna(); return t ? Math.min(H.MAX, 1 + Math.floor(t.lvl / 2)) : 0; };
  H.candidatos = function () {
    const st = S(), day = U.dayKey(), rng = U.rng(U.strHash('heroes:' + day + ':' + (st.created || 0)));
    // solo del día y de la partida: reclutar a uno no cambia a los otros dos
    const out = [], usadas = new Set();
    const nc = 3 + Math.min(2, G().bono ? G().bono('taberna') : 0); // Patronazgo (cartas de era)
    for (let i = 0; i < nc; i++) {
      // clases distintas
      let clase = U.pick(H.ORDEN, rng);
      while (usadas.has(clase)) clase = U.pick(H.ORDEN, rng);
      usadas.add(clase);
      const c = H.CLASES[clase], mujer = c.mujer || rng() < 0.5;
      out.push({ i, clase, rasgo: U.pick(Object.keys(H.RASGOS), rng), nivel: 1 + Math.floor(rng() * Math.min(5, st.era)), nombre: U.pick(NOMBRES[mujer ? 'f' : 'm'], rng), mujer, semilla: Math.floor(rng() * 1e9) });
    }
    return out;
  };
  H.costo = function (cand) {
    const n = H.lista().length, cost = { gold: Math.round(250 * S().era * (1 + 0.5 * n)) };
    if (n) cost[H.CLASES[cand.clase].sp] = 5 * n;
    return cost;
  };
  H.porQueNo = function (cand) {
    const tab = est().tab;
    if (!H.taberna()) return 'Necesitas una Taberna.';
    if (tab.dia === U.dayKey() && tab.tomados.includes(cand.i)) return 'Ya se unió a tu reino.';
    if (H.lista().length >= H.max()) return H.max() >= H.MAX ? 'Tienes el máximo de héroes (' + H.MAX + ').' : 'La Taberna en nivel ' + (H.max() * 2) + ' recibe un héroe más.';
    if (!G().canAfford(H.costo(cand))) return 'Te falta para pagarle.';
    return null;
  };
  H.contratar = function (i) {
    const st = S(), tab = est().tab, cand = H.candidatos()[i];
    if (!cand || H.porQueNo(cand)) return null;
    G().pay(H.costo(cand));
    if (tab.dia !== U.dayKey()) { tab.dia = U.dayKey(); tab.tomados = []; }
    tab.tomados.push(i);
    const h = { id: est().nid++, clase: cand.clase, nombre: cand.nombre, mujer: cand.mujer, semilla: cand.semilla, rasgo: cand.rasgo, nivel: cand.nivel, xp: 0, talentos: [], equipo: {}, estado: 'libre', hasta: 0, gobierna: null };
    est().lista.push(h);
    G().stat('heroes_hired', 1);
    st.stats.hero_lvl = Math.max(st.stats.hero_lvl || 0, h.nivel);
    toast(h.nombre + ', ' + H.CLASES[h.clase].name.toLowerCase() + ', se une a tu reino.', 'epic');
    if (PK.Sfx) PK.Sfx.play('level');
    return h;
  };
  // ---------- La Corsaria (pk-30) ----------
  const otraLista = () => { const o = S().otro; return (o && o.heroes && o.heroes.lista) || []; };
  H.hayCorsaria = () => H.lista().concat(otraLista()).some(h => h.clase === 'corsaria');
  H.costoCorsaria = () => ({ gold: 2500, especias: 40 });
  H.porQueNoCorsaria = function () {
    if (D.temaActivo !== 'mar') return 'La Corsaria solo se recluta en el archipiélago.';
    if (H.hayCorsaria()) return 'Ya navega contigo.';
    if (!G().countB('escuela')) return 'Necesitas la Escuela de navegantes.';
    if (H.lista().length >= H.MAX) return 'Tienes el máximo de héroes en la isla (' + H.MAX + ').';
    if (!G().canAfford(H.costoCorsaria())) return 'Te falta para pagarle.';
    return null;
  };
  H.nombreCorsaria = () => U.pick(['Isabela la Roja', 'Marina Tormenta', 'Leonor de Ribera', 'Catalina Brisa', 'Inés del Faro'], U.rng(U.strHash('corsaria:' + (S().created || 0))));
  H.contratarCorsaria = function () {
    if (H.porQueNoCorsaria()) return null;
    G().pay(H.costoCorsaria());
    const h = { id: est().nid++, clase: 'corsaria', nombre: H.nombreCorsaria(), mujer: true, semilla: U.strHash('corsaria:' + (S().created || 0)), rasgo: 'valiente', nivel: 3, xp: 0, talentos: [], equipo: {}, estado: 'libre', hasta: 0, gobierna: null };
    est().lista.push(h);
    G().stat('heroes_hired', 1);
    toast(h.nombre + ', la Corsaria, sube a tu flota. Llévala en las batallas del mar: lee las corrientes.', 'epic');
    return h;
  };
  H.renombrar = function (h, nombre) {
    nombre = String(nombre || '').replace(/[<>]/g, '').trim().slice(0, 18);
    if (nombre) h.nombre = nombre;
  };

  // ---------- Gobernar ----------
  H.puedeGobernar = function (h, b) {
    const g = H.CLASES[h.clase].gob;
    return !!b && b.owner === 'p' && b.done && (g === '*' ? !!D.BSTATS[b.type] || b.type === 'tc' : g.includes(b.type));
  };
  H.gobernar = function (h, b) {
    for (const o of H.lista()) if (b && o !== h && o.gobierna === b.id) o.gobierna = null; // un héroe por edificio
    h.gobierna = b ? b.id : null;
  };
  const gobernado = h => (h.gobierna !== null && h.gobierna !== undefined ? G().bById.get(h.gobierna) : null);
  // Suma de una pasiva entre los héroes que gobiernan (en casa y sanos).
  H.pasiva = function (k, b) {
    let s = 0;
    for (const h of H.lista()) {
      if (h.estado !== 'libre') continue;
      const v = H.CLASES[h.clase].pas[k];
      if (!v) continue;
      const gb = gobernado(h);
      if (!gb || !H.puedeGobernar(h, gb) || (b && gb !== b)) continue;
      s += v * (1 + H.efecto(h, 'pasiva'));
    }
    return s;
  };
  // Lo del equipo «producción del edificio que gobierna».
  H.prodEn = function (b) {
    for (const h of H.lista()) if (h.estado === 'libre' && h.gobierna === b.id) return H.efecto(h, 'prod');
    return 0;
  };
  H.gobernanteDe = b => H.lista().find(h => h.gobierna === b.id) || null;

  // ---------- Expediciones ----------
  H.viaje = h => (h ? 1 - H.efecto(h, 'viaje') : 1);
  H.salir = function (h, run) { h.estado = 'expedicion'; h.run = run.id; };
  // Al resolverse la pelea: experiencia, y si perdió, herido al volver. Si ganó, puede encontrar equipo.
  H.resultado = function (r) {
    const h = H.de(r.heroe);
    if (!h) return;
    const xp = (20 + 10 * Math.log2(1 + (r.need || 50) / 50)) * (r.won ? 1 : 0.4) * (r.inc && PK.Inc && PK.Inc.tiene(r, 'plaga') ? 1.3 : 1);
    H.darXp(h, xp);
    r.heroeGano = !!r.won;
    if (r.won) {
      const p = r.poi !== undefined ? 0.35 + 0.02 * (r.floor || 1) : r.camp !== undefined ? 0.2 : 0.25;
      if (Math.random() < p + 0.05 * H.efecto(h, 'suerte')) { const o = H.crearObjeto(nivelBotin(r), H.efecto(h, 'suerte')); if (r.inc) r.inc.items.push(o); else r.objeto = o; }
    }
  };
  function nivelBotin(r) {
    if (r.poi !== undefined) { const p = PK.World.pois[r.poi], d = p && D.DUNGEON[p.kind]; return U.clamp(((r.floor || 1) - 1) / Math.max(1, (d ? d.floors : 10) - 1), 0, 1) * 0.7 + S().era * 0.02; }
    return S().era * 0.03;
  }
  // Rareza: más profundo, más suerte → mejor.
  H.crearObjeto = function (prof, suerte) {
    const x = Math.random(), k = 1 + 0.25 * (suerte || 0);
    const r = x < (0.01 + prof * 0.05) * k ? 3 : x < (0.06 + prof * 0.2) * k ? 2 : x < (0.3 + prof * 0.3) * k ? 1 : 0;
    const t = U.pick(Object.keys(POOL));
    return { t, r, s: Math.floor(Math.random() * 1e9), m: 0 };
  };
  H.guardarObjeto = function (o) {
    const e = est();
    if (e.inv.length >= H.INV_MAX) { // inventario lleno: se funde solo el peor
      const peor = e.inv.filter(it => !equipadoPor(it)).sort((a, b) => a.r - b.r || (a.m || 0) - (b.m || 0))[0];
      if (peor && peor.r <= o.r) H.fundir(peor.id, true); else { e.esencia += H.RAREZAS[o.r].esencia; return null; }
    }
    const it = Object.assign({ id: e.nid++ }, o);
    e.inv.push(it);
    G().stat('items_found', 1);
    return it;
  };
  H.volver = function (r) {
    const h = H.de(r.heroe);
    if (!h) return;
    h.run = null;
    if (r.objeto) {
      const it = H.guardarObjeto(r.objeto);
      if (it) toast(h.nombre + ' trae ' + H.itemNombre(it) + ' (' + H.RAREZAS[it.r].name + ').', 'epic', { label: 'Ver', fn: () => H.open('inv') });
    }
    if (r.heroeGano) { h.estado = 'libre'; return; }
    h.estado = 'herido';
    h.hasta = Date.now() + H.heridaSeg(h) * 1000;
    toast(h.nombre + ' vuelve herido: descansa ' + U.fmtTime(H.heridaSeg(h)) + '.', 'bad');
  };
  H.heridaSeg = function (h) {
    const mon = G().best('monastery', 'relics'); // nivel del Monasterio
    const k = (1 - Math.min(0.5, 0.05 * mon)) * (1 - Math.min(0.6, H.pasiva('heridas'))) * (1 - H.efecto(h, 'herida')) * (1 - G().best('herbolario', 'heridaP')) * (PK.Pase && PK.Pase.dorado() ? 0.7 : 1); // pista dorada del Pase: heridas 30% más cortas
    return Math.round((1800 + 5400 * (h.semilla % 97) / 96) * k);
  };
  // El mejor héroe libre contra ese enemigo (lo usan el planificador, el Mariscal y el piloto).
  H.mejorPara = function (enemy) {
    let mejor = null, m = 1;
    for (const h of H.libres()) { const v = H.mult(h, enemy); if (v > m) { m = v; mejor = h; } }
    return mejor;
  };

  // ---------- Equipo ----------
  function equipadoPor(it) { return H.lista().find(h => Object.values(h.equipo).includes(it.id)) || null; }
  H.equipadoPor = equipadoPor;
  H.equipar = function (h, itId) {
    const it = est().inv.find(o => o.id === itId);
    if (!it || !h) return;
    const otro = equipadoPor(it);
    if (otro) delete otro.equipo[it.t];
    h.equipo[it.t] = it.id;
  };
  H.quitar = (h, ranura) => { delete h.equipo[ranura]; };
  H.costoMejora = it => Math.round(H.RAREZAS[it.r].esencia * 0.8 * ((it.m || 0) + 1));
  H.mejorar = function (itId) {
    const e = est(), it = e.inv.find(o => o.id === itId);
    if (!it || (it.m || 0) >= 5 || e.esencia < H.costoMejora(it)) return false;
    e.esencia -= H.costoMejora(it);
    it.m = (it.m || 0) + 1;
    // Forja de Titanes (H4): a veces sube de rareza (con semilla: recargar no cambia el resultado)
    const ft = G().best('titanforge', 'rareza');
    if (ft && it.r < H.RAREZAS.length - 1 && U.rng(it.s + it.m * 977)() < ft) { it.r++; toast('¡La Forja de Titanes la volvió ' + H.RAREZAS[it.r].name + '!', 'epic'); }
    recalc(it);
    return true;
  };
  H.fundir = function (itId, solo) {
    const e = est(), i = e.inv.findIndex(o => o.id === itId);
    if (i < 0) return 0;
    const it = e.inv[i], n = Math.round(H.RAREZAS[it.r].esencia * (1 + 0.5 * (it.m || 0)));
    const h = equipadoPor(it);
    if (h) delete h.equipo[it.t];
    e.inv.splice(i, 1);
    e.esencia += n;
    if (!solo) toast('+' + n + ' de esencia.', 'good');
    return n;
  };

  // ---------- Bucle ----------
  let t1 = 0;
  H.update = function (dt) {
    if (!est() || (t1 += dt) < 1) return;
    t1 = 0;
    const now = Date.now();
    for (const h of H.lista()) {
      if (h.estado === 'herido' && now >= h.hasta) { h.estado = 'libre'; toast(h.nombre + ' ya se recuperó.', 'good'); }
      if (h.estado === 'travesia' && now >= h.hasta) { h.estado = 'libre'; toast(h.nombre + ' bajó del Galeón: ya está lista para lo que mandes.', 'good'); } // pk-30
      // la expedición que lo llevaba ya no existe (partida vieja, algo raro): vuelve a casa
      if (h.estado === 'expedicion' && !S().exp.runs.some(r => r.id === h.run)) { h.estado = 'libre'; h.run = null; }
      if (h.gobierna !== null && h.gobierna !== undefined && !G().bById.get(h.gobierna)) h.gobierna = null;
    }
  };

  // ---------- Retratos (todo dibujado por código, como el resto del arte) ----------
  const RET = {};
  H.retrato = function (h) {
    // un aspecto del Pase del Reino (js/pase.js) cambia el color y lo que lleva en la cabeza
    const asp = h.aspecto && D.aspecto ? D.aspecto(h.aspecto) : null, ao = asp && asp.o && asp.o.clase === h.clase ? asp : null;
    // un personaje de la historia hecho héroe (el Rey Bandido) conserva su cara
    if (!h.rasgos && D.PERSONAJES) { const P = Object.values(D.PERSONAJES).find(o => o.semilla === h.semilla && o.clase === h.clase && o.rasgos); if (P) h = Object.assign({}, h, { rasgos: P.rasgos }); }
    const key = 'v2:' + h.clase + ':' + h.semilla + ':' + (h.mujer ? 1 : 0) + ':' + (h.rasgo || '') + (h.rasgos ? ':' + JSON.stringify(h.rasgos) : '') + (ao ? ':' + h.aspecto : '');
    if (RET[key]) return RET[key];
    if (typeof document === 'undefined' || !PK.Retratos) return '';
    const cl0 = H.CLASES[h.clase] || H.CLASES.juglar;
    const cl = ao ? Object.assign({}, cl0, { col: ao.tipo === 'heroe2' ? ao.o.col.map(v => 255 - v * 0.6) : ao.o.col }) : cl0;
    // pk-50: el dibujo vive en retratos.js (36x36, con muchas más caras posibles)
    return (RET[key] = PK.Retratos.canvas(h, cl, ao).toDataURL());
  };
  // pk-80: la figura del héroe (mapa, batalla, armada) con la cara de su retrato: piel, pelo, peinado, barba y lo que
  // lleva en la cabeza salen de PK.Retratos.rasgos; el color, de la clase (o del aspecto del Pase). Sp.heroe la dibuja.
  const FIG = {};
  H.figura = function (h) {
    if (!h) return null;
    const asp = h.aspecto && D.aspecto ? D.aspecto(h.aspecto) : null, ao = asp && asp.o && asp.o.clase === h.clase ? asp : null;
    if (!h.rasgos && D.PERSONAJES) { const P = Object.values(D.PERSONAJES).find(o => o.semilla === h.semilla && o.clase === h.clase && o.rasgos); if (P) h = Object.assign({}, h, { rasgos: P.rasgos }); }
    const key = h.clase + ':' + h.semilla + ':' + (h.mujer ? 1 : 0) + ':' + (h.rasgo || '') + (h.rasgos ? ':' + JSON.stringify(h.rasgos) : '') + (ao ? ':' + h.aspecto : '');
    if (FIG[key]) return FIG[key];
    const cl0 = H.CLASES[h.clase] || H.CLASES.juglar, col = ao ? (ao.tipo === 'heroe2' ? ao.o.col.map(v => 255 - v * 0.6) : ao.o.col) : cl0.col;
    const f = PK.Retratos && PK.Retratos.rasgos ? PK.Retratos.rasgos(h, Object.assign({}, cl0, { col })) : null;
    const r = f || { mujer: !!h.mujer, piel: [214, 164, 120], pelo: [74, 46, 28], peinado: h.mujer ? 'largo' : 'corto', barba: '', casco: true, sombrero: true };
    return (FIG[key] = { k: key, clase: h.clase, col: col.map(Math.round), mujer: !!r.mujer, piel: r.piel, pelo: r.pelo, peinado: r.peinado, barba: r.barba || '',
      casco: r.casco !== false, capucha: !!r.capucha, corona: !!r.corona, tricornio: !!r.tricornio, gafas: !!r.gafas, parche: !!r.parche, edad: r.edad });
  };
  // el arma con la que pega en la batalla en vivo (null: el arco o la vara, en su pose)
  H.armaDe = h => ({ paladin: 'sword', guarda: null, clerigo: 'hammer', ingeniera: 'hammer', hechicero: null, juglar: 'sword', corsaria: 'sword' })[h && h.clase] || null;
  H.retratoEl = (h, cls) => el('img', { class: 'h-ret ' + (cls || ''), src: H.retrato(h), alt: '' });
  // pk-50: el mismo retrato con los ojos cerrados (quien habla parpadea: H.parpadear)
  H.retratoCerrado = function (h) {
    let ra = h.rasgos;
    if (!ra && D.PERSONAJES) { const P = Object.values(D.PERSONAJES).find(o => o.semilla === h.semilla && o.clase === h.clase && o.rasgos); if (P) ra = P.rasgos; }
    return H.retrato(Object.assign({}, h, { rasgos: Object.assign({}, ra || {}, { parpado: true }) }));
  };
  // Hace parpadear un retrato de quien habla cada 3 a 5 s mientras esté en la página.
  H.parpadear = function (img, h) {
    if (!img || typeof window === 'undefined' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return img;
    const abierto = img.src, cerrado = H.retratoCerrado(h);
    const ciclo = () => { if (!img.isConnected) return; img.src = cerrado; setTimeout(() => { img.src = abierto; setTimeout(ciclo, 3000 + Math.random() * 2000); }, 140); };
    setTimeout(ciclo, 1500 + Math.random() * 2000);
    return img;
  };

  // ---------- Ventana ----------
  let tab = 'heroes', sel = null;
  const pct = v => Math.round(v * 100) + '%';
  const estadoTxt = h => (h.estado === 'investiga' ? 'Investiga un lugar legendario · ' + U.fmtTime(Math.max(0, (h.hasta - Date.now()) / 1000)) : h.estado === 'explora' ? 'Busca un tesoro · ' + U.fmtTime(Math.max(0, (h.hasta - Date.now()) / 1000)) : h.estado === 'expedicion' ? 'En expedición' : h.estado === 'herido' ? 'Herido · ' + U.fmtTime(Math.max(0, (h.hasta - Date.now()) / 1000)) : h.estado === 'travesia' ? 'Bajando del Galeón · ' + U.fmtTime(Math.max(0, (h.hasta - Date.now()) / 1000)) : gobernado(h) ? 'Gobierna ' + gobernado(h).def.name : 'En casa');
  H.open = function (t, id) {
    const UI = PK.UI;
    if (t) tab = t;
    if (id !== undefined) sel = id;
    UI.modal('heroes', 'Héroes', body => {
      const tabs = el('div', { class: 'book-tabs' });
      for (const [k, n] of [['heroes', 'Tus héroes'], ['taberna', 'Taberna'], ['inv', 'Equipo']]) tabs.append(el('button', { class: 'book-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; UI.rerender(true); } }, n,
        k === 'heroes' && H.lista().some(h => H.talentosPendientes(h)) ? el('span', { class: 'dot' }) : ''));
      body.append(tabs);
      ({ heroes: heroesTab, taberna: tabernaTab, inv: invTab })[tab](body, UI);
    }, { wide: true });
  };
  function heroesTab(body, UI) {
    const lista = H.lista();
    if (!lista.length) {
      if (D.temaActivo === 'mar') { // en el archipiélago no hay Taberna: llegan en el Galeón o es la Corsaria
        body.append(el('div', { class: 'empty-box' }, el('div', null, el('b', null, 'Todavía no hay héroes en tu isla.'),
          el('p', { class: 'small' }, 'Tráelos de tu reino en el Galeón (hasta dos por viaje), o contrata a la Corsaria en la Dársena de guerra cuando tengas la Escuela de navegantes.'))));
        return;
      }
      body.append(el('div', { class: 'empty-box' }, el('div', null, el('b', null, 'Todavía no tienes héroes.'),
        el('p', { class: 'small' }, H.taberna() ? 'En la Taberna hay tres candidatos cada día.' : 'Construye la Taberna (Era II, con un Cuartel): cada día llegan tres candidatos.'),
        H.taberna() ? UI.btn('Ir a la Taberna', () => { tab = 'taberna'; UI.rerender(true); }, { cls: 'gold' }) : G().isUnlocked('tavern') && !G().countAll('tavern') ? UI.btn('Construir la Taberna', () => { UI.closeModal(); PK.Input.startPlacing('tavern'); }, { cls: 'gold' }) : '')));
      return;
    }
    if (!H.de(sel)) sel = lista[0].id;
    body.append(el('div', { class: 'h-lista' }, lista.map(h => el('button', { class: 'h-chip' + (h.id === sel ? ' on' : '') + (h.estado === 'herido' ? ' herido' : ''), onclick: () => { sel = h.id; UI.rerender(); } },
      H.retratoEl(h), el('span', null, el('b', { translate: 'no' }, h.nombre), el('small', null, H.CLASES[h.clase].name + ' · nv ' + h.nivel)), H.talentosPendientes(h) ? el('span', { class: 'dot' }) : ''))));
    body.append(ficha(H.de(sel), UI));
  }
  function ficha(h, UI) {
    const c = H.CLASES[h.clase], R = H.RASGOS[h.rasgo], tope = H.tope();
    const box = el('div', { class: 'h-ficha' });
    const xpBar = el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: (h.nivel >= tope ? 100 : (h.xp / H.xpPara(h.nivel)) * 100) + '%' } }), el('span', null, h.nivel >= tope ? 'Nivel ' + h.nivel + ' (tope de la era)' : 'Nivel ' + h.nivel + ' · ' + h.xp + '/' + H.xpPara(h.nivel) + ' de experiencia'));
    box.append(el('div', { class: 'h-cab' }, H.retratoEl(h, 'grande'),
      el('div', null, el('div', { class: 'row' }, el('b', { class: 'h-nombre', translate: 'no' }, h.nombre), UI.btn('✎', () => { const n = window.prompt('Nuevo nombre:', h.nombre); if (n) { H.renombrar(h, n); UI.rerender(); } }, { small: true, title: 'Cambiar el nombre' })),
        el('div', { class: 'small' }, c.name + ' (' + c.rol.toLowerCase() + ') · ' + R.name + ': ' + R.desc),
        el('div', { class: 'small ' + (h.estado === 'herido' ? 'warn-t' : 'muted') }, estadoTxt(h)), xpBar)));
    // aspectos del Pase del Reino que sirven para su clase
    const asps = PK.Pase ? PK.Pase.aspectosDe('heroe').filter(id => { const a = D.aspecto(id); return a && a.o && a.o.clase === h.clase; }) : [];
    if (asps.length) box.append(el('div', { class: 'row wrap' }, el('span', { class: 'small' }, 'Aspecto: '), UI.btn('Normal', () => { h.aspecto = null; UI.rerender(); }, { small: true, cls: h.aspecto ? '' : 'gold' }),
      asps.map(id => { const a = D.aspecto(id); return UI.btn(a.o.name + (a.tipo === 'heroe2' ? ' (variante)' : ''), () => { h.aspecto = id; UI.rerender(); }, { small: true, cls: h.aspecto === id ? 'gold' : '' }); })));
    // contra quién rinde y cuánto suma
    const ej = {}; for (const e of c.vs) ej[e] = 1;
    box.append(el('p', { class: 'small' }, el('b', null, 'En expedición: '), '+' + pct(H.mult(h, c.vs.length ? ej : { bandit: 1 }) - 1) + ' de fuerza' + (c.vs.length ? ' contra ' + c.vs.map(e => D.ENEMY[e].name.toLowerCase()).join(' y ') : '') + ', +' + pct(H.mult(h, { _: 1 }) - 1) + ' contra el resto (tope +' + pct(H.TOPE_FUERZA) + ').'),
      el('p', { class: 'small' }, el('b', null, 'Habilidad: '), c.hab.name + ' — ' + c.hab.desc + ' (recarga ' + Math.round(c.hab.cd * (1 - H.efecto(h, 'cd'))) + ' s). Se usa sola si no diriges la batalla.'));
    // gobernar
    const cands = G().buildings.filter(b => H.puedeGobernar(h, b));
    const gb = gobernado(h);
    const selG = el('select', { id: 'h-gob', 'aria-label': 'Edificio que gobierna', onchange: e => { const b = G().bById.get(+e.target.value); H.gobernar(h, b || null); UI.rerender(); } },
      el('option', { value: '' }, 'Ninguno'), cands.map(b => el('option', { value: b.id, selected: gb === b }, b.def.name + ' (nv ' + b.lvl + ')' + (H.gobernanteDe(b) && H.gobernanteDe(b) !== h ? ' · ' + H.gobernanteDe(b).nombre : ''))));
    box.append(el('div', { class: 'h-gob' }, el('b', null, 'Gobierna: '), cands.length ? selG : el('span', { class: 'small muted' }, 'No tienes dónde: ' + c.pasTxt.split(':')[0] + '.'),
      el('div', { class: 'small muted' }, c.pasTxt + (H.efecto(h, 'pasiva') ? ' (x' + (1 + H.efecto(h, 'pasiva')).toFixed(1).replace('.', ',') + ')' : '') + '. Solo mientras está en casa y sano.')));
    // talentos
    const tal = el('div', { class: 'h-tal' }, el('h3', null, 'Talentos'));
    for (let i = 0; i < 8; i++) {
      const nv = (i + 1) * 5, elegido = h.talentos[i], abierto = i === h.talentos.length && h.nivel >= nv;
      tal.append(el('div', { class: 'h-tal-row' + (elegido === undefined && !abierto ? ' off' : '') }, el('span', { class: 'small muted' }, 'nv ' + nv),
        [0, 1].map(k => { const t = H.talento(h, i, k), on = elegido === k, txt = Object.keys(t.ef).map(e => H.efTxt(e, t.ef[e])).join(', ');
          return abierto ? UI.btn(t.name, () => { H.elegirTalento(h, k); UI.rerender(); }, { small: true, cls: 'gold', title: txt })
            : el('span', { class: 'h-t' + (on ? ' on' : ''), title: txt }, t.name, el('small', null, txt)); })));
    }
    box.append(tal);
    // equipo
    const eq = el('div', { class: 'h-eq' }, el('h3', null, 'Equipo'));
    for (const rn in H.RANURAS) {
      const it = est().inv.find(o => o.id === h.equipo[rn]);
      eq.append(el('div', { class: 'h-slot' }, el('span', { class: 'small muted' }, H.RANURAS[rn]), it ? itemEl(it) : el('span', { class: 'small muted' }, 'vacío'),
        it ? UI.btn('Quitar', () => { H.quitar(h, rn); UI.rerender(); }, { small: true }) : UI.btn('Elegir', () => { tab = 'inv'; filtro = rn; UI.rerender(true); }, { small: true, disabled: !est().inv.some(o => o.t === rn) })));
    }
    box.append(eq);
    return box;
  }
  function itemEl(it) {
    const st = H.itemStats(it);
    return el('span', { class: 'h-item', style: { borderColor: H.RAREZAS[it.r].col } }, el('b', { style: { color: H.RAREZAS[it.r].txt } }, H.itemNombre(it)),
      el('small', null, Object.keys(st).map(k => H.efTxt(k, st[k])).join(' · ')));
  }
  function tabernaTab(body, UI) {
    const t = H.taberna();
    if (!t) {
      body.append(el('div', { class: 'empty-box' }, el('div', null, el('b', null, 'Sin Taberna no hay héroes.'),
        el('p', { class: 'small' }, G().countB('barracks') ? 'Constrúyela: se desbloquea con el Cuartel.' : 'Primero construye un Cuartel (Era II); con él se desbloquea la Taberna.'),
        G().isUnlocked('tavern') && !G().countAll('tavern') ? UI.btn('Construir la Taberna', () => { UI.closeModal(); PK.Input.startPlacing('tavern'); }, { cls: 'gold' }) : '')));
      return;
    }
    const now = new Date(), man = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    body.append(el('p', { class: 'small' }, 'Tres candidatos por día (nuevos en ' + U.fmtTime((man - now) / 1000) + '). Héroes: ' + H.lista().length + '/' + H.max() + (H.max() < H.MAX ? ' (uno más cada 2 niveles de la Taberna)' : '') + '.'));
    const tab2 = est().tab, hoy = tab2.dia === U.dayKey() ? tab2.tomados : [];
    for (const cand of H.candidatos()) {
      const c = H.CLASES[cand.clase], R = H.RASGOS[cand.rasgo], why = H.porQueNo(cand), tomado = hoy.includes(cand.i);
      body.append(el('div', { class: 'h-cand' + (tomado ? ' off' : '') }, H.retratoEl(cand, 'grande'),
        el('div', { class: 'h-cand-i' }, el('b', { translate: 'no' }, cand.nombre), el('div', { class: 'small' }, c.name + ' · nivel ' + cand.nivel + ' · ' + R.name + ' (' + R.desc + ')'),
          el('div', { class: 'small muted' }, c.hab.name + ': ' + c.hab.desc + '. ' + c.pasTxt + '.'),
          tomado ? el('div', { class: 'small good-t' }, 'Ya está en tu reino.') : el('div', { class: 'row' }, UI.costEl(H.costo(cand)), UI.btn('Reclutar', () => { const h = H.contratar(cand.i); if (h) { sel = h.id; tab = 'heroes'; UI.rerender(true); } }, { small: true, cls: 'gold', disabled: !!why, title: why || '' })),
          why && !tomado ? el('div', { class: 'small warn-t' }, why) : '')));
    }
  }
  let filtro = null;
  function invTab(body, UI) {
    const e = est(), h = H.de(sel) || H.lista()[0];
    body.append(el('p', { class: 'small' }, 'Esencia: ', el('b', null, U.fmt(e.esencia)), ' · ' + e.inv.length + '/' + H.INV_MAX + ' objetos. El equipo sale de mazmorras, campamentos y encargos ganados con un héroe. Fundir da esencia; la esencia mejora objetos (hasta +5).'),
      el('div', { class: 'row' }, ['todo'].concat(Object.keys(H.RANURAS)).map(k => UI.btn(k === 'todo' ? 'Todo' : H.RANURAS[k], () => { filtro = k === 'todo' ? null : k; UI.rerender(); }, { small: true, cls: (filtro || 'todo') === k ? 'gold' : '' }))));
    const lista = e.inv.filter(it => !filtro || it.t === filtro).sort((a, b) => b.r - a.r || (b.m || 0) - (a.m || 0));
    if (!lista.length) { body.append(el('p', { class: 'small muted' }, 'No hay objetos todavía.')); return; }
    for (const it of lista) {
      const por = equipadoPor(it);
      body.append(el('div', { class: 'h-inv-row' }, itemEl(it), el('span', { class: 'small muted' }, por ? 'lo lleva ' : '', por ? el('span', { translate: 'no' }, por.nombre) : ''),
        el('span', { class: 'row' },
          h && por !== h ? UI.btn('Equipar a ' + h.nombre, () => { H.equipar(h, it.id); UI.rerender(); }, { small: true, cls: 'gold' }) : '',
          (it.m || 0) < 5 ? UI.btn('Mejorar (' + H.costoMejora(it) + ')', () => { H.mejorar(it.id); UI.rerender(); }, { small: true, disabled: e.esencia < H.costoMejora(it) }) : '',
          UI.btn('Fundir', () => { H.fundir(it.id); UI.rerender(); }, { small: true, cls: 'danger' }))));
    }
  }
})();
