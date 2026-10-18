// =====================================================================
//  PRO DEFENDER — Motor de simulación (sin dependencias del DOM)
// =====================================================================
(function () {
  const PD = (globalThis.PD = globalThis.PD || {});
  const W = PD.W, H = PD.H;
  const PATH_HALF = 21;
  const TAU = Math.PI * 2;
  const TOWER_GAP = 14;   // separación mínima extra entre torres (no se pueden amontonar)
  PD.PATH_HALF = PATH_HALF; PD.TOWER_GAP = TOWER_GAP;
  // Fuerza con la que un enemigo rompe muros de raíces y golpea a los gólems (por segundo)
  const chew = e => (e.d.boss ? 60 : Math.max(1, e.d._leak)) * 3;
  // Retroceso total que aguanta un enemigo en toda su vida (px de camino). Lo gastan TODOS
  // los empujes (Ancla, bumerán, balista, géiser, Tormenta de Arena) y los hijos lo heredan
  // del padre: antes la Tormenta no tenía tope y cada hijo empezaba de cero, y con torres
  // potenciadas los enemigos casi no salían nunca.
  const KB_MAX = e => (e.d.boss ? 140 : e.d.big ? 180 : 260);
  // Tras una congelación, el enemigo queda 1 s sin poder volver a congelarse (solo se frena),
  // igual que el aturdimiento: varias torres de hielo ya no lo dejan quieto para siempre.
  const FREEZE_IMM = 1;

  // ------------------------------- Caminos -------------------------------
  function buildPath(pts) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const jump = !!b[2];
      const len = jump ? 0 : Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], len, start: total, jump, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) });
      total += len;
    }
    return { pts, segs, len: total };
  }
  function posAt(path, d, out) {
    const segs = path.segs;
    if (d <= 0) { const s = segs[0]; out.x = s.ax; out.y = s.ay; out.a = s.ang; return out; }
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.jump) continue;
      if (d <= s.start + s.len) {
        const t = (d - s.start) / s.len;
        out.x = s.ax + (s.bx - s.ax) * t; out.y = s.ay + (s.by - s.ay) * t; out.a = s.ang;
        return out;
      }
    }
    const s = segs[segs.length - 1];
    out.x = s.bx; out.y = s.by; out.a = s.ang;
    return out;
  }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }
  PD.buildPath = buildPath; PD.posAt = posAt; PD.distSeg = distSeg;

  // ------------------------- Rejilla espacial ----------------------------
  class Grid {
    constructor() {
      this.cs = 64; this.off = 128;
      this.cols = Math.ceil((W + this.off * 2) / this.cs);
      this.rows = Math.ceil((H + this.off * 2) / this.cs);
      this.cells = [];
      for (let i = 0; i < this.cols * this.rows; i++) this.cells.push([]);
    }
    clear() { for (const c of this.cells) c.length = 0; }
    idx(x, y) {
      let cx = Math.floor((x + this.off) / this.cs), cy = Math.floor((y + this.off) / this.cs);
      if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
      if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
      return [cx, cy];
    }
    add(e) { const [cx, cy] = this.idx(e.x, e.y); this.cells[cy * this.cols + cx].push(e); }
    query(x, y, r, fn) {
      const [x0, y0] = this.idx(x - r, y - r), [x1, y1] = this.idx(x + r, y + r);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[cy * this.cols + cx];
        for (let i = 0; i < cell.length; i++) if (fn(cell[i]) === true) return;
      }
    }
  }

  const tmp = { x: 0, y: 0, a: 0 };

  // ================================ JUEGO =================================
  class Game {
    // `seed`: el azar de la partida (mulberry32). Con la misma semilla y las mismas
    // acciones en los mismos pasos, la partida sale idéntica (prueba.js la rehace).
    constructor(li, snap, seed) {
      this.li = li;
      this.rs = seed === undefined ? (Math.random() * 4294967296) >>> 0 : seed >>> 0;
      this.L = PD.LEVELS[li];
      this.paths = this.L.paths.map(buildPath);
      this.rounds = PD.buildRounds(li);
      this.money = this.L.cash;
      this.lives = this.L.lives;
      this.round = 0;            // rondas completadas
      this.active = false;
      this.enemies = []; this.towers = []; this.projs = []; this.shells = [];
      this.mines = []; this.puddles = []; this.fx = []; this.holes = []; this.rings = [];
      this.walls = []; this.golems = []; this.saws = []; this.rangs = []; this.abLock = {};
      this.queue = []; this.qi = 0; this.rt = 0;
      this.time = 0; this.uid = 1; this.events = [];
      this.wardrum = 0; this.over = false; this.won = false;
      this.continues = 3;
      this.stats = { kills: 0, leaked: 0 };
      this.grid = new Grid();
      this.bosses = [];
      if (snap) this.load(snap);
    }

    rnd() {
      let t = (this.rs = (this.rs + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    curRound() { return this.active ? this.round + 1 : this.round; }
    emit(ev) { this.events.push(ev); }
    // Sonidos: la interfaz asigna game.sounds = [] para recibirlos (nombre, x)
    snd(n, x) { if (this.sounds && this.sounds.length < 96) this.sounds.push(n, x === undefined ? 500 : x); }

    // --------------------------- Guardado ---------------------------------
    snapshot() {
      return {
        li: this.li, round: this.round, money: this.money, lives: this.lives, continues: this.continues,
        stats: { ...this.stats },
        towers: this.towers.map(t => ({ type: t.type, x: t.x, y: t.y, tiers: t.tiers.slice(), mode: t.mode, dealt: t.dealt, spent: t.spent }))
      };
    }
    load(s) {
      this.round = s.round; this.money = s.money; this.lives = s.lives;
      this.continues = s.continues !== undefined ? s.continues : 3;
      if (s.stats) this.stats = { ...s.stats };
      for (const st of s.towers) {
        const t = this.makeTower(st.type, st.x, st.y);
        t.tiers = st.tiers.slice(); t.mode = st.mode || t.mode; t.dealt = st.dealt || 0; t.spent = st.spent;
        this.towers.push(t);
      }
      this.recalcAll();
    }

    // --------------------------- Colocación -------------------------------
    canPlace(type, x, y) {
      const def = PD.TOWERS[type], sz = def.size;
      if (x < sz + 4 || y < sz + 4 || x > W - sz - 4 || y > H - sz - 4) return false;
      for (const p of this.paths) for (const s of p.segs) {
        if (s.jump) continue;
        if (distSeg(x, y, s.ax, s.ay, s.bx, s.by) < PATH_HALF + sz - 3) return false;
      }
      for (const p of this.paths) for (const pt of p.pts) if (pt[2]) {
        if (Math.hypot(x - pt[0], y - pt[1]) < 30 + sz) return false;
      }
      for (const o of this.L.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + sz - 4) return false;
      for (const t of this.towers) if (Math.hypot(x - t.x, y - t.y) < t.def.size + sz + TOWER_GAP) return false;
      if (def.hero && this.hasHero()) return false;   // un solo héroe por partida
      return true;
    }
    hasHero() { return this.towers.some(t => t.def.hero); }
    makeTower(type, x, y) {
      const def = PD.TOWERS[type];
      return {
        id: this.uid++, type, def, x, y, tiers: [0, 0], spent: def.cost, s: null,
        mode: def.defaultTarget || 'first', cdT: 0, ang: -Math.PI / 2, dealt: 0, disabledT: 0,
        abilityCd: 0, drones: [], beams: [], mineCount: 0, shots: 0, shT: 0, spin: 0, ship: null,
        flash: 0, flameOn: 0, spots: null, spotsRange: 0, pspots: null, pspotsRange: 0,
        flashT: 0, sawQ: 0, sawQT: 0, hitMap: new Map()
      };
    }
    place(type, x, y) {
      const def = PD.TOWERS[type];
      if (this.money < def.cost || !this.canPlace(type, x, y)) return null;
      this.money -= def.cost;
      const t = this.makeTower(type, x, y);
      this.towers.push(t);
      this.recalcAll();
      this.emit({ type: 'place', tower: t });
      return t;
    }
    canUpgrade(t, p) {
      const nt = t.tiers.slice(); nt[p]++;
      if (nt[p] > t.def.paths[p].ups.length) return false;
      if (t.def.hero) return !(nt[0] > 4 && nt[1] > 4);   // los héroes suben los dos a 4, pero solo UNO al 5
      if (nt[0] > 2 && nt[1] > 2) return false;
      return true;
    }
    discountFor(t) {
      let d = 0;
      for (const f of this.towers) if (f.def.kind === 'farm' && f.s.discount && f !== t) {
        if (Math.hypot(f.x - t.x, f.y - t.y) <= f.s.range) d = Math.max(d, f.s.discount);
      }
      return d;
    }
    upgradeCost(t, p) {
      const up = t.def.paths[p].ups[t.tiers[p]];
      if (!up) return Infinity;
      return Math.round(up.cost * (1 - this.discountFor(t)));
    }
    upgrade(t, p) {
      if (!this.canUpgrade(t, p)) return false;
      const c = this.upgradeCost(t, p);
      if (this.money < c) return false;
      this.money -= c; t.spent += c; t.tiers[p]++;
      this.recalcAll();
      this.emit({ type: 'upgrade', tower: t });
      return true;
    }
    sellValue(t) { return Math.floor(t.spent * 0.75); }
    sell(t) {
      const i = this.towers.indexOf(t);
      if (i < 0) return;
      this.money += this.sellValue(t);
      this.towers.splice(i, 1);
      this.mines = this.mines.filter(m => m.src !== t);
      this.walls = this.walls.filter(w => w.src !== t);
      for (const gm of this.golems) if (gm.src === t) this.golemDie(gm, true);
      this.golems = this.golems.filter(gm => gm.src !== t);
      this.recalcAll();
      this.emit({ type: 'sell', tower: t });
    }

    baseStats(t) {
      const s = { ...t.def.base };
      s.pierce = s.pierce || 1;
      for (let p = 0; p < 2; p++) for (let i = 0; i < t.tiers[p]; i++) t.def.paths[p].ups[i].apply(s);
      return s;
    }
    recalcAll() {
      for (const t of this.towers) t.s = this.baseStats(t);
      // apoyo: los tótems y el héroe de la Caldera (su aura de forja, radio s.aura)
      const totems = this.towers.filter(t => t.def.kind === 'support' || (t.def.hero && (t.s.buffDmgMult || t.s.buffRate)));
      for (const t of this.towers) {
        if (t.def.kind === 'support' || t.def.kind === 'farm') continue;
        const b = { rate: 0, range: 0, camo: false, dmg: 0, mult: 1, ap: 0, pierce: 0 };
        let any = false;
        for (const k of totems) {
          if (k === t || Math.hypot(k.x - t.x, k.y - t.y) > (k.s.aura || k.s.range)) continue;
          any = true;
          const ks = k.s;
          b.rate = Math.max(b.rate, ks.buffRate || 0);
          b.range = Math.max(b.range, ks.buffRange || 0);
          b.camo = b.camo || !!ks.buffCamo;
          b.dmg = Math.max(b.dmg, ks.buffDmg || 0);
          b.mult = Math.max(b.mult, ks.buffDmgMult || 1);
          b.ap = Math.max(b.ap, ks.buffArmor || 0);
          b.pierce = Math.max(b.pierce, ks.buffPierce || 0);
        }
        t.buffed = any;
        if (!any) continue;
        const s = t.s;
        if (s.cd) s.cd /= 1 + b.rate;
        if (s.droneCd) s.droneCd /= 1 + b.rate;
        if (s.shardCd) s.shardCd /= 1 + b.rate;
        if (s.dps) s.dps *= 1 + b.rate;
        if (s.range < 5000) s.range *= 1 + b.range;
        if (b.camo) s.camo = true;
        if (b.dmg) {
          if (t.def.kind === 'flame') s.dmg += b.dmg * 0.3;
          else if (s.dmg !== undefined) s.dmg += b.dmg;
          if (s.droneDmg !== undefined) s.droneDmg += b.dmg;
          if (s.mineDmg !== undefined) s.mineDmg += b.dmg * 2;
          if (s.dps !== undefined) s.dps += b.dmg * 3;
          if (s.shardDmg) s.shardDmg += b.dmg;
        }
        if (b.mult > 1) {
          for (const k of ['dmg', 'droneDmg', 'mineDmg', 'dps', 'pulseDmg', 'shardDmg', 'burnDps', 'poisonDps', 'kamikaze'])
            if (s[k]) s[k] *= b.mult;
        }
        if (b.ap) s.armorPierce = Math.max(s.armorPierce || 0, b.ap);
        if (b.pierce) s.pierce += b.pierce;
      }
    }

    // ------------------------------ Rondas --------------------------------
    roundPreview(r) {
      const R = this.rounds[r - 1];
      if (!R) return null;
      const agg = {};
      for (const g of R.groups) agg[g.type] = (agg[g.type] || 0) + g.n;
      return { list: Object.entries(agg).sort((a, b) => PD.enemyThreat(b[0]) - PD.enemyThreat(a[0])), special: R.special, boss: R.boss };
    }
    startRound() {
      if (this.active || this.over || this.round >= PD.MAX_ROUND) return false;
      const r = this.round + 1;
      const R = this.rounds[r - 1];
      const q = [];
      for (const g of R.groups) {
        for (let i = 0; i < g.n; i++) {
          let path = g.path === -1 ? (i % this.paths.length) : Math.min(g.path, this.paths.length - 1);
          q.push({ t: g.start + i * g.interval, type: g.type, path, tier: g.bossTier, hpX: g.hpX || 1, mod: g.mod });
        }
      }
      q.sort((a, b) => a.t - b.t);
      this.queue = q; this.qi = 0; this.rt = 0;
      this.hurryT = (q.length ? q[q.length - 1].t : 0) + 90;
      this.active = true;
      this.emit({ type: 'roundStart', round: r, special: R.special, boss: R.boss });
      return true;
    }
    endRound() {
      this.active = false;
      this.walls = []; this.saws = []; this.rangs = [];
      this.round++;
      const r = this.round;
      let bonus = PD.roundBonus(r);
      let farm = 0;
      for (const t of this.towers) if (t.def.kind === 'farm') {
        const inc = t.s.income * (t.s.incomeMult || 1);
        farm += inc;
        this.fx.push({ k: 'text', x: t.x, y: t.y - 20, t: 0, T: 1.4, text: '+' + Math.round(inc), color: '#7dffcf' });
      }
      let interest = 0;
      for (const t of this.towers) if (t.def.kind === 'farm' && t.s.interest) interest = Math.max(interest, t.s.interest);
      const intAmt = interest ? Math.min(360, this.money * interest) : 0;
      for (const t of this.towers) if (t.s.lifeRegen && this.lives < this.L.lives) {
        const n = Math.min(t.s.lifeRegen, this.L.lives - this.lives);
        this.lives += n;
        this.fx.push({ k: 'text', x: t.x, y: t.y - 24, t: 0, T: 1.4, text: '+' + n + ' ❤', color: '#ff9aa8' });
      }
      this.money += bonus + farm + intAmt;
      this.emit({ type: 'roundEnd', round: r, bonus, farm: Math.round(farm + intAmt) });
      if (r === PD.UNLOCK_ROUND) this.emit({ type: 'unlock', round: r });
      if (r >= PD.MAX_ROUND) { this.won = true; this.emit({ type: 'victory' }); }
    }

    // ----------------------------- Enemigos -------------------------------
    spawn(type, path, dist, hpM, tier) {
      const d = PD.ENEMIES[type];
      const boost = PD.hpBoost(this.curRound() || 1, d.boss);
      let hp = d.hp * hpM * boost;
      if (d.boss) hp = d.hp * PD.BOSS_SCALE[tier || 2] * PD.BOSS_GROW[tier || 2] * this.L.diff * boost;
      const shield = (d.shield || 0) * hpM * boost;
      const e = {
        id: this.uid++, d, type, path, dist: Math.max(0, dist), hp, maxHp: hp, shield, maxShield: shield, shieldT: 0,
        x: 0, y: 0, a: 0, vx: 0, vy: 0, hpM, tier: tier || 0,
        slowF: 0, slowT: 0, frozenT: 0, freezeImm: 0, stunT: 0, stunImm: 0, brittleT: 0, brittle: 0, holdT: 0, pulled: 0, rifted: false,
        burnDps: 0, burnT: 0, burnSrc: null, poisDps: 0, poisT: 0, poisSrc: null,
        burrowed: false, burrowT: d.burrow ? d.burrow.every * (0.5 + this.rnd() * 0.5) : 0,
        phased: false, phaseT: d.phase ? d.phase.every * (0.3 + this.rnd() * 0.7) : 0,
        healT: d.heal ? d.heal.every : 0, sabT: d.sabotage ? d.sabotage.every * 0.7 : 0,
        spawnT: d.spawn ? d.spawn.every : 0, tpT: d.teleport ? d.teleport.every : 0,
        revived: false, enraged: false, blinked: false, haste: 1, auraSlow: 0, invulnT: 0,
        corr: 0, corrT: 0, corrAmp: 0, wetT: 0, wetElec: 1.5, wetAmp: 0, liftT: 0, goldT: 0, goldMult: 1,
        hexT: 0, hexAmp: 0, hexExec: 0, hexSpread: 0, hexDps: 0, hexArmor: 0, hexReveal: false, hexSrc: null,
        lit: false, lightAmp: 0, lightPhase: false, shred: 0, blockT: 0, engaged: null,
        dead: false, leaked: false, flash: 0, wob: this.rnd() * TAU
      };
      e.camo = !!d.camo && !(d.boss && tier === 1);
      if (d.boss) e.name = d.name + (tier === 1 ? ' (Joven)' : tier === 3 ? ' (Furioso)' : tier === 4 ? ' (Supremo)' : '');
      posAt(this.paths[path], e.dist, tmp);
      e.x = tmp.x; e.y = tmp.y; e.a = tmp.a;
      this.enemies.push(e);
      if (d.boss) this.emit({ type: 'boss', enemy: e });
      return e;
    }

    // grandes de las rondas especiales tardías (levels.js): camuflados o acelerados; sus hijos también
    modifica(e, mod) {
      e.mod = mod;
      if (mod === 'camo') e.camo = true;
      else if (mod === 'fast') e.fast = 1.35;
    }

    // camuflado visible si la torre lo detecta, un Faro lo ilumina o una Marca del Vacío lo delata
    revealed(e) { return e.lit || (e.hexT > 0 && e.hexReveal); }
    canSee(t, e) {
      if (e.dead || e.burrowed) return false;
      if (e.camo && !t.s.camo && !this.revealed(e)) return false;
      if (e.d.flying && t.s.noFlying) return false;
      return true;
    }
    pick(t, x, y, range, mode, exclude) {
      let best = null, bv = -Infinity;
      const r2base = range;
      for (const e of this.enemies) {
        if (!this.canSee(t, e)) continue;
        if (exclude && exclude.indexOf(e) >= 0) continue;
        const rr = r2base + e.d.r * 0.6;
        const dx = e.x - x, dy = e.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr * rr) continue;
        let v;
        const rem = this.paths[e.path].len - e.dist;
        if (mode === 'first') v = -rem;
        else if (mode === 'last') v = rem;
        else if (mode === 'close') v = -d2;
        else v = (e.d.boss ? 1e9 : 0) + e.maxHp + e.maxShield - rem * 0.001;
        if (v > bv) { bv = v; best = e; }
      }
      return best;
    }

    applySlow(e, f, dur) {
      if (e.d.slowImmune) return;
      if (e.d.boss) f *= 0.5;
      if (f > e.slowF || e.slowT <= 0) { e.slowF = Math.max(f, e.slowT > 0 ? e.slowF : 0); e.slowT = Math.max(e.slowT, dur); }
      else if (f === e.slowF) e.slowT = Math.max(e.slowT, dur);
    }
    applyFreeze(e, dur) {
      if (e.d.freezeImmune || e.d.boss || e.freezeImm > 0) { this.applySlow(e, 0.6, dur); return; }
      e.frozenT = Math.max(e.frozenT, dur);
      e.freezeImm = e.frozenT + FREEZE_IMM;
    }
    // congelar/sabotear una torre; después queda inmune 2 s para evitar bloqueos en cadena
    disableTower(t, dur) {
      if (t.disImm > 0) return;
      t.disabledT = Math.max(t.disabledT, dur);
      t.disImm = t.disabledT + 2;
    }
    applyStun(e, dur) {
      if (e.stunImm > 0) return;   // inmunidad breve tras un aturdimiento (evita bloqueos eternos)
      if (e.d.boss) dur *= 0.25;
      e.stunT = Math.max(e.stunT, dur);
      e.stunImm = e.stunT + 0.8;
    }
    applyBurn(e, dps, dur, src) {
      const res = e.d.resist && e.d.resist.fire !== undefined ? e.d.resist.fire : 1;
      if (res === 0 && !(src && src.s && src.s.fireFloor)) return;
      if (dps >= e.burnDps || e.burnT <= 0) { e.burnDps = dps; e.burnSrc = src; }
      e.burnT = Math.max(e.burnT, dur);
    }
    applyPoison(e, dps, dur, src) {
      if (dps >= e.poisDps || e.poisT <= 0) { e.poisDps = dps; e.poisSrc = src; }
      e.poisT = Math.max(e.poisT, dur);
    }

    damage(e, amt, dtype, src, o) {
      if (e.dead || e.burrowed || e.invulnT > 0 || amt <= 0) return 0;
      if (e.phased && dtype !== 'arcane' && !e.lightPhase) return 0;
      let m = e.d.resist && e.d.resist[dtype] !== undefined ? e.d.resist[dtype] : 1;
      if (dtype === 'fire' && o && o.fireFloor && m < o.fireFloor) m = o.fireFloor;
      if (e.wetT > 0) {
        // mojado: pierde la protección contra el fuego y conduce la electricidad
        if (dtype === 'fire' && m < 1) m = 1;
        else if (dtype === 'elec') m *= e.wetElec;
        else if (dtype === 'ice') m *= 1.3;
      }
      let dmg = amt * m;
      if (dmg <= 0) return 0;
      const dot = o && o.dot;
      if (!dot && e.brittleT > 0) dmg += e.brittle * Math.max(m, 0.3);
      if (e.d.boss && o && o.bossMult) dmg *= o.bossMult;
      if (o && o.armorMult && e.d.armor) dmg *= o.armorMult;
      const armor = Math.max(0, (e.d.armor || 0) - e.corr - (e.hexT > 0 ? e.hexArmor : 0) - e.shred);
      if (armor > 0 && !dot && dtype !== 'arcane' && dtype !== 'fire' && dtype !== 'poison') {
        const ap = Math.min(1, (o && o.ap) || 0);
        dmg = Math.max(dmg * 0.15, dmg - armor * (1 - ap));
      }
      // vulnerabilidades: maldición, corrosión, luz del faro y agua salada
      const amp = (e.hexT > 0 ? e.hexAmp : 0) + e.corr * e.corrAmp + e.lightAmp + (e.wetT > 0 ? e.wetAmp : 0);
      if (amp > 0) dmg *= 1 + amp;
      let dealt = 0;
      if (e.shield > 0) {
        const sm = (o && o.shieldMult) || 1;
        const sd = dmg * sm;
        if (sd >= e.shield) { dealt += e.shield; dmg -= e.shield / sm; e.shield = 0; this.snd('shield', e.x); }
        else { e.shield -= sd; dealt += sd; dmg = 0; }
        e.shieldT = 0;
      }
      if (dmg > 0) { e.hp -= dmg; dealt += dmg; }
      // ejecución (Condena / Guadaña de la Muerte): nunca a jefes
      if (e.hp > 0 && !e.d.boss) {
        const ex = Math.max(e.hexT > 0 ? e.hexExec : 0, (o && o.exec) || 0);
        if (ex && e.hp < e.maxHp * ex) {
          dealt += e.hp; e.hp = 0;
          this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, T: 0.4, r0: 4, r1: e.d.r + 16, color: '#d08bff', w: 3 });
        }
      }
      e.flash = 0.06;
      if (src) src.dealt += dealt;
      if (e.d.blink && !e.blinked && e.hp > 0) {
        e.blinked = true;
        this.fx.push({ k: 'puff', x: e.x, y: e.y, t: 0, T: 0.4, color: '#f3d9a4' });
        this.snd('teleport', e.x);
        e.dist = Math.min(this.paths[e.path].len - 30, e.dist + e.d.blink.dist);
      }
      if (e.hp <= 0) this.kill(e, src);
      return dealt;
    }

    kill(e, src) {
      if (e.dead) return;
      if (e.d.revive && !e.revived) {
        e.revived = true; e.hp = e.maxHp * 0.5; e.invulnT = 1.5;
        e.burnT = 0; e.poisT = 0;
        this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, T: 1, r0: 10, r1: 120, color: '#ffb347', w: 6 });
        this.emit({ type: 'revive', enemy: e });
        this.snd('revive', e.x);
        return;
      }
      e.dead = true;
      this.stats.kills++;
      const cur = this.curRound() || 1;
      this.money += e.d.bounty * PD.incomeMult(cur) * (e.goldT > 0 ? e.goldMult : 1);
      const d = e.d;
      if (e.engaged) this.release(e);
      if (e.hexT > 0 && e.hexSpread) {
        // Plaga: la maldición salta a los enemigos más cercanos
        const near = this.enemies.filter(o => !o.dead && o !== e && !(o.hexT > 1) && Math.hypot(o.x - e.x, o.y - e.y) < 110)
          .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, e.hexSpread);
        for (const o of near) {
          this.curse(o, e.hexSrc, e.hexT + 1);
          this.fx.push({ k: 'bolt', pts: [[e.x, e.y], [o.x, o.y]], t: 0, T: 0.25, color: '#c07bff', w: 2 });
        }
      }
      if (d.children) {
        let k = 0;
        for (const [c, n] of d.children) for (let i = 0; i < n; i++) {
          const ch = this.spawn(c, e.path, e.dist - k * 9 + 4, e.hpM);
          ch.slowF = e.slowF * 0.5; ch.slowT = e.slowT;
          ch.pulled = e.pulled; ch.rifted = e.rifted;   // el retroceso ya gastado se hereda
          if (e.mod) this.modifica(ch, e.mod);
          k++;
        }
      }
      if (d.deathFreeze) {
        for (const t of this.towers) if (Math.hypot(t.x - e.x, t.y - e.y) < d.deathFreeze.radius) this.disableTower(t, d.deathFreeze.dur);
        this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, T: 0.6, r0: 10, r1: d.deathFreeze.radius, color: '#dff4ff', w: 5 });
        this.snd('freezeBurst', e.x);
      }
      if (e.burnT > 0 && e.burnSrc && e.burnSrc.s && e.burnSrc.s.napalm) {
        const src2 = e.burnSrc, bd = e.burnDps;
        this.grid.query(e.x, e.y, 70, o => { if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 70) this.applyBurn(o, bd, 2.5, src2); });
        this.fx.push({ k: 'boom', x: e.x, y: e.y, t: 0, T: 0.35, r: 55, color: '#ff7a2f' });
      }
      this.fx.push({ k: 'pop', x: e.x, y: e.y, t: 0, T: d.boss ? 1.2 : 0.5, r: d.r, color: d.color, big: !!(d.big || d.boss) });
      this.snd(d.boss ? 'bossDeath' : d.big ? 'bigPop' : 'pop', e.x);
      if (d.boss) this.emit({ type: 'bossDown', enemy: e });
    }

    leak(e) {
      e.dead = true; e.leaked = true;
      if (e.engaged) this.release(e);
      this.stats.leaked++;
      const l = e.d.boss ? PD.BOSS_LEAK[e.tier || 2] : e.d._leak;
      this.lives -= l;
      this.emit({ type: 'leak', amount: l });
      this.snd('leak', e.x);
      if (this.lives <= 0) {
        this.lives = 0;
        if (!this.over) { this.over = true; this.emit({ type: 'gameover' }); }
      }
    }

    updateEnemies(dt) {
      const cur = this.curRound() || 1;
      const sm = PD.speedMult(cur);
      const hurry = this.rt > (this.hurryT || 1e9);
      const list = this.enemies;
      // auras
      for (const e of list) { e.haste = 1; e.auraSlow = 0; e.lit = false; e.lightAmp = 0; e.lightPhase = false; e.shred = 0; }
      // auras de los héroes: quitar blindaje (Dunas) y daño recibido (Dunas, Vacío; suma como la luz del faro)
      for (const t of this.towers) if (t.def.hero && t.disabledT <= 0 && (t.s.shredAura || t.s.ampAura)) {
        const s = t.s, R = s.aura || s.range;
        for (const e of list) if (!e.dead && Math.abs(e.x - t.x) < R + 30 && Math.hypot(e.x - t.x, e.y - t.y) < R + e.d.r * 0.5) {
          if (s.shredAura) e.shred = Math.max(e.shred, s.shredAura);
          if (s.ampAura) e.lightAmp = Math.max(e.lightAmp, s.ampAura * (e.d.boss ? 0.5 : 1));
        }
      }
      // Faro Boreal: ilumina (revela camuflados), debilita y puede anular fases
      for (const t of this.towers) if (t.def.kind === 'beacon' && t.disabledT <= 0) {
        const s = t.s, R = s.range;
        for (const e of list) if (!e.dead && Math.abs(e.x - t.x) < R + 20 && Math.hypot(e.x - t.x, e.y - t.y) < R + e.d.r * 0.5) {
          e.lit = true;
          if (s.lightAmp) e.lightAmp = Math.max(e.lightAmp, s.lightAmp * (e.d.boss ? 0.5 : 1));
          if (s.lightPhase) e.lightPhase = true;
        }
      }
      for (const e of list) {
        if (e.dead || !e.d.haste) continue;
        const h = e.d.haste;
        for (const o of list) if (o !== e && !o.dead && Math.abs(o.x - e.x) < h.radius && Math.hypot(o.x - e.x, o.y - e.y) < h.radius) o.haste = Math.max(o.haste, h.mult);
      }
      for (const t of this.towers) if (t.s.slowAura && t.disabledT <= 0) {
        const r = t.s.range;
        for (const e of list) if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) < r + e.d.r * 0.5) e.auraSlow = Math.max(e.auraSlow, t.s.slowAura);
      }
      for (const e of list) {
        if (e.dead) continue;
        const d = e.d;
        e.flash -= dt;
        if (e.invulnT > 0) e.invulnT -= dt;
        if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 0; }
        if (e.frozenT > 0) e.frozenT -= dt;
        if (e.freezeImm > 0) e.freezeImm -= dt;
        if (e.stunT > 0) e.stunT -= dt;
        if (e.stunImm > 0) e.stunImm -= dt;
        if (e.healCd > 0) e.healCd -= dt;
        if (e.wetT > 0) e.wetT -= dt;
        if (e.liftT > 0) e.liftT -= dt;
        if (e.goldT > 0) e.goldT -= dt;
        if (e.corrT > 0) { e.corrT -= dt; if (e.corrT <= 0) e.corr = 0; }
        if (e.hexT > 0) {
          e.hexT -= dt;
          if (e.hexDps) { this.damage(e, e.hexDps * dt, 'arcane', e.hexSrc, { dot: true }); if (e.dead) continue; }
        }
        if (e.brittleT > 0) e.brittleT -= dt;
        if (e.holdT > 0) e.holdT -= dt;
        // DoTs
        if (e.burnT > 0) {
          e.burnT -= dt;
          const ff = e.burnSrc && e.burnSrc.s ? e.burnSrc.s.fireFloor : 0;
          this.damage(e, e.burnDps * dt, 'fire', e.burnSrc, { dot: true, fireFloor: ff });
          if (e.dead) continue;
        }
        if (e.poisT > 0) {
          e.poisT -= dt;
          this.damage(e, e.poisDps * dt, 'poison', e.poisSrc, { dot: true });
          if (e.dead) continue;
        }
        if (d.regen && e.poisT <= 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * d.regen * dt);
        if (e.maxShield > 0 && e.shield < e.maxShield) {
          e.shieldT += dt;
          if (e.shieldT > 3) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.5 * dt);
        }
        if (d.burrow) {
          e.burrowT -= dt;
          if (e.burrowT <= 0) {
            e.burrowed = !e.burrowed;
            e.burrowT = e.burrowed ? d.burrow.dur : d.burrow.every;
            this.fx.push({ k: 'dust', x: e.x, y: e.y, t: 0, T: 0.5, r: d.r * 1.6 });
          }
        }
        if (d.phase) {
          e.phaseT -= dt;
          if (e.phaseT <= 0) { e.phased = !e.phased; e.phaseT = e.phased ? d.phase.dur : d.phase.every; }
        }
        if (d.heal) {
          e.healT -= dt;
          if (e.healT <= 0) {
            e.healT = d.heal.every;
            const R = d.heal.radius;
            // las curas no se acumulan: cada enemigo recibe como mucho una cada 2.5 s
            for (const o of list) if (!o.dead && !o.d.boss && !(o.healCd > 0) && Math.hypot(o.x - e.x, o.y - e.y) < R) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * d.heal.pct); o.healCd = 2.5; }
            this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, T: 0.6, r0: 6, r1: R, color: '#5dff8a', w: 3 });
            this.snd('heal', e.x);
          }
        }
        if (d.sabotage && !e.burrowed) {
          e.sabT -= dt;
          if (e.sabT <= 0) {
            e.sabT = d.sabotage.every;
            const R = d.sabotage.radius;
            for (const t of this.towers) if (Math.hypot(t.x - e.x, t.y - e.y) < R) this.disableTower(t, d.sabotage.dur);
            this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, T: 0.7, r0: 8, r1: R, color: d.boss && this.li === 2 ? '#bfe6ff' : '#b47cff', w: 4 });
            this.snd('sabotage', e.x);
          }
        }
        if (d.spawn) {
          e.spawnT -= dt;
          if (e.spawnT <= 0) {
            e.spawnT = d.spawn.every;
            const hpM = PD.hpMult(this.L, cur);
            for (let i = 0; i < d.spawn.n; i++) this.spawn(d.spawn.type, e.path, e.dist - 20 - i * 14, hpM);
          }
        }
        if (d.teleport) {
          e.tpT -= dt;
          if (e.tpT <= 0) {
            e.tpT = d.teleport.every;
            this.fx.push({ k: 'puff', x: e.x, y: e.y, t: 0, T: 0.6, color: '#8a5bff', r: d.r * 1.5 });
            this.snd('teleport', e.x);
            e.dist = Math.min(this.paths[e.path].len - 60, e.dist + d.teleport.dist);
          }
        }
        if (d.enrage && !e.enraged && e.hp < e.maxHp * d.enrage.below) e.enraged = true;
        // movimiento
        let sp = 0;
        const vel = d.speed * sm * (e.fast || 1);
        if (hurry) { sp = vel; if (e.engaged) this.release(e); }   // ronda eterna: los rezagados avanzan sin frenos
        else if (e.frozenT <= 0 && e.stunT <= 0) {
          sp = vel * (1 - e.slowF) * e.haste;
          if (e.auraSlow && !d.slowImmune) sp *= 1 - e.auraSlow * (d.boss ? 0.5 : 1);
          if (e.burrowed) sp *= d.burrow.speed;
          if (e.enraged) sp *= d.enrage.mult;
          if (e.holdT > 0) sp *= d.boss ? 0.4 : 0.05;
          if (sp > 0 && this.blocked(e, dt)) sp = 0;
        }
        e.dist += sp * dt;
        const path = this.paths[e.path];
        if (e.dist >= path.len) { this.leak(e); continue; }
        const ox = e.x, oy = e.y;
        posAt(path, e.dist, tmp);
        e.x = tmp.x; e.y = tmp.y; e.a = tmp.a;
        if (dt > 0) {
          const jx = (e.x - ox) / dt, jy = (e.y - oy) / dt;
          if (Math.abs(jx) < 600 && Math.abs(jy) < 600) { e.vx = jx; e.vy = jy; }
        }
      }
    }

    // ------------------------------- Torres --------------------------------
    fireProjectile(t, x, y, ang, o) {
      const sp = o.speed || 500;
      this.projs.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: o.life || 1.2, r: o.r || 4,
        dmg: o.dmg, dtype: o.dtype || 'phys', pierce: o.pierce || 1, hit: [], src: t, kind: o.kind || 'thorn',
        opt: o.opt || {}, poison: o.poison, splash: o.splash, homing: o.homing, target: o.target, noFlying: o.noFlying, ang
      });
    }
    aim(t, e, speed) {
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      const time = d / speed;
      return Math.atan2(e.y + e.vy * time - t.y, e.x + e.vx * time - t.x);
    }
    inRange(t, range, fn) {
      for (const e of this.enemies) {
        if (e.dead || e.burrowed) continue;
        const rr = range + e.d.r * 0.6;
        const dx = e.x - t.x, dy = e.y - t.y;
        if (dx * dx + dy * dy <= rr * rr) fn(e);
      }
    }
    anyInRange(t, range) {
      for (const e of this.enemies) {
        if (e.dead || e.burrowed) continue;
        const rr = range + e.d.r * 0.6;
        const dx = e.x - t.x, dy = e.y - t.y;
        if (dx * dx + dy * dy <= rr * rr) return true;
      }
      return false;
    }
    explode(x, y, radius, dmg, dtype, src, o, opts) {
      const hitsFlying = opts && opts.hitsFlying;
      this.grid.query(x, y, radius + 44, e => {
        if (e.dead || (e.d.flying && !hitsFlying)) return;
        if (Math.hypot(e.x - x, e.y - y) > radius + e.d.r * 0.5) return;
        this.damage(e, dmg, dtype, src, o);
        if (opts) {
          if (opts.slow) this.applySlow(e, opts.slow, opts.slowDur || 1.5);
          if (opts.stun) this.applyStun(e, opts.stun);
          if (opts.freeze) this.applyFreeze(e, opts.freeze);
        }
      });
    }

    updateTowers(dt) {
      const rm = this.wardrum > 0 ? 2 : 1;
      // nivel de peligro para las habilidades automáticas
      let n = 0, maxProg = 0, boss = false;
      for (const e of this.enemies) {
        if (e.dead) continue;
        n++;
        const pr = e.dist / this.paths[e.path].len;
        if (pr > maxProg) maxProg = pr;
        if (e.d.boss) boss = true;
      }
      this.threat = { n, maxProg, boss };
      for (const t of this.towers) {
        const s = t.s;
        if (t.flash > 0) t.flash -= dt;
        if (t.flameOn > 0) t.flameOn -= dt;
        if (this.active && t.abilityCd > 0) t.abilityCd -= dt;
        if (t.disImm > 0) t.disImm -= dt;
        if (t.disabledT > 0) { t.disabledT -= dt; t.beams.length = 0; continue; }
        if (s.ability) this.autoAbility(t);
        const kind = t.def.kind;
        const tdt = dt * rm;
        switch (kind) {
          case 'projectile': this.tProjectile(t, s, tdt); break;
          case 'pulse': this.tPulse(t, s, tdt); break;
          case 'chain': this.tChain(t, s, tdt); break;
          case 'mortar': this.tMortar(t, s, tdt); break;
          case 'beam': this.tBeam(t, s, dt, rm); break;
          case 'hive': this.tHive(t, s, dt, rm); break;
          case 'gravity': this.tGravity(t, s, tdt); break;
          case 'sniper': this.tSniper(t, s, tdt); break;
          case 'mines': this.tMines(t, s, tdt); break;
          case 'flame': this.tFlame(t, s, tdt); break;
          case 'boomerang': this.tBoomerang(t, s, tdt); break;
          case 'barrier': this.tBarrier(t, s, tdt); break;
          case 'barracks': this.tBarracks(t, s, tdt); break;
          case 'saw': this.tSaw(t, s, tdt); break;
          case 'acid': this.tAcid(t, s, tdt); break;
          case 'beacon': this.tBeacon(t, s, tdt); break;
          case 'rail': this.tRail(t, s, tdt); break;
          case 'geyser': this.tGeyser(t, s, tdt); break;
          case 'hex': this.tHex(t, s, tdt); break;
          case 'blades': this.tBlades(t, s, tdt); break;
          case 'hero': this.tHero(t, s, tdt); break;
        }
      }
    }
    tProjectile(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      const base = this.aim(t, e, s.projSpeed);
      t.ang = base;
      const o = { ap: s.armorPierce, bossMult: s.bossMult };
      const common = { speed: s.projSpeed, dmg: s.dmg, pierce: s.pierce, dtype: s.dtype, life: (s.range + 60) / s.projSpeed, opt: o, kind: s.spear ? 'spear' : 'thorn', r: s.spear ? 9 : 4 };
      if (s.poisonDps) common.poison = [s.poisonDps, s.poisonDur];
      if (s.radial) {
        t.spin += 0.37;
        for (let i = 0; i < s.count; i++) this.fireProjectile(t, t.x, t.y, t.spin + i * TAU / s.count, common);
      } else {
        for (let i = 0; i < s.count; i++) this.fireProjectile(t, t.x, t.y, base + (i - (s.count - 1) / 2) * s.spread, common);
      }
      t.flash = 0.08;
      this.snd(s.spear ? 'spear' : 'thorn', t.x);
      t.cdT = s.cd;
    }
    tPulse(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT <= 0) {
        if (this.anyInRange(t, s.range)) {
          const o = { ap: s.armorPierce };
          this.inRange(t, s.range, e => {
            this.damage(e, s.dmg, 'ice', t, o);
            if (e.dead) return;
            if (!(e.d.resist && e.d.resist.ice === 0)) {
              this.applySlow(e, s.slow, s.slowDur);
              if (s.freezeChance && this.rnd() < s.freezeChance) this.applyFreeze(e, s.freezeDur);
              if (s.brittle) { e.brittleT = 3; e.brittle = Math.max(e.brittle, s.brittle); }
            }
          });
          this.fx.push({ k: 'ring', x: t.x, y: t.y, t: 0, T: 0.45, r0: 10, r1: s.range, color: '#bfefff', w: 3 });
          this.snd('frost', t.x);
          t.cdT = s.cd;
        } else t.cdT = 0;
      }
      if (s.shardDmg) {
        t.shT -= dt;
        if (t.shT <= 0) {
          const e = this.pick(t, t.x, t.y, s.range + 40, 'first');
          if (e) {
            const a = this.aim(t, e, 600);
            t.ang = a;
            this.snd('shard', t.x);
            this.fireProjectile(t, t.x, t.y, a, { speed: 600, dmg: s.shardDmg, pierce: 3, dtype: 'ice', life: 0.6, kind: 'shard', r: 5, opt: { ap: s.armorPierce } });
            t.shT = s.shardCd;
          } else t.shT = 0;
        }
      }
    }
    tChain(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      t.ang = Math.atan2(e.y - t.y, e.x - t.x);
      const hits = [e];
      let cur = e;
      for (let j = 0; j < s.jumps; j++) {
        let best = null, bd = s.chainRange;
        this.grid.query(cur.x, cur.y, s.chainRange, o => {
          if (o.dead || hits.indexOf(o) >= 0) return;
          const dd = Math.hypot(o.x - cur.x, o.y - cur.y);
          if (dd < bd) { bd = dd; best = o; }
        });
        if (!best) break;
        hits.push(best); cur = best;
      }
      const pts = [[t.x, t.y - 10]];
      const o = { shieldMult: s.shieldMult, ap: s.armorPierce };
      for (const h of hits) {
        pts.push([h.x, h.y]);
        this.damage(h, s.dmg, 'elec', t, o);
        if (s.stun && !h.dead) this.applyStun(h, s.stun);
      }
      this.fx.push({ k: 'bolt', pts, t: 0, T: 0.15, color: '#fff27a', w: s.dmg > 20 ? 4 : 2 });
      this.snd('zap', t.x);
      t.shots++;
      if (s.pulseEvery && t.shots % s.pulseEvery === 0) {
        this.inRange(t, s.range, h => this.damage(h, s.pulseDmg, 'elec', t, o));
        this.fx.push({ k: 'ring', x: t.x, y: t.y, t: 0, T: 0.35, r0: 10, r1: s.range, color: '#fff27a', w: 4 });
        this.snd('zapBig', t.x);
      }
      t.flash = 0.1;
      t.cdT = s.cd;
    }
    tMortar(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      const T = 0.7;
      const tx = e.x + e.vx * T, ty = e.y + e.vy * T;
      t.ang = Math.atan2(ty - t.y, tx - t.x);
      const shells = s.shells || 1;
      for (let k = 0; k < shells; k++) {
        const ox = k ? (this.rnd() - 0.5) * 70 : 0, oy = k ? (this.rnd() - 0.5) * 70 : 0;
        this.shells.push({ x0: t.x, y0: t.y, x1: tx + ox, y1: ty + oy, t: 0, T: T + k * 0.08, src: t, dmg: s.dmg, radius: s.radius, cluster: s.cluster || 0, mini: false });
      }
      t.flash = 0.12;
      this.snd('mortar', t.x);
      t.cdT = s.cd;
    }
    landShell(sh) {
      const t = sh.src, s = t.s;
      if (sh.acid) { this.landAcid(sh); return; }
      if (sh.sun) { this.landSun(sh); return; }
      if (sh.meteor) {
        this.explode(sh.x1, sh.y1, sh.radius, sh.dmg, 'explosive', t, { ap: 1 }, { hitsFlying: true, stun: 0.5 });
        this.fx.push({ k: 'boom', x: sh.x1, y: sh.y1, t: 0, T: 0.6, r: sh.radius, color: '#ff8a3d' });
        this.snd('boom', sh.x1);
        return;
      }
      const o = { ap: s.armorPierce };
      const opts = { slow: s.slow, slowDur: s.slowDur, stun: s.stun, freeze: sh.freeze };
      this.explode(sh.x1, sh.y1, sh.radius, sh.dmg, 'explosive', t, o, opts);
      this.fx.push({ k: 'boom', x: sh.x1, y: sh.y1, t: 0, T: 0.35, r: sh.radius, color: sh.freeze ? '#bfefff' : '#ffb35c' });
      this.snd(sh.mini ? 'boomSmall' : 'boom', sh.x1);
      if (!sh.mini && !sh.mine && s.puddleDps) this.puddles.push({ x: sh.x1, y: sh.y1, r: sh.radius * 0.8, dps: s.puddleDps, t: s.puddleDur, T: s.puddleDur, src: t });
      if (sh.cluster) for (let i = 0; i < sh.cluster; i++) {
        const a = this.rnd() * TAU, d = 25 + this.rnd() * 35;
        this.shells.push({ x0: sh.x1, y0: sh.y1, x1: sh.x1 + Math.cos(a) * d, y1: sh.y1 + Math.sin(a) * d, t: 0, T: 0.25 + this.rnd() * 0.15, src: t, dmg: sh.dmg * 0.5, radius: 30, cluster: 0, mini: true, freeze: sh.freeze, mine: sh.mine });
      }
    }
    tBeam(t, s, dt, rm) {
      const prev = t.beams;
      const keep = [];
      for (const b of prev) {
        const e = b.e;
        if (!e.dead && this.canSee(t, e) && Math.hypot(e.x - t.x, e.y - t.y) <= s.range + e.d.r * 0.6) keep.push(b);
      }
      while (keep.length > s.beams) keep.pop();
      while (keep.length < s.beams) {
        const e = this.pick(t, t.x, t.y, s.range, t.mode, keep.map(b => b.e));
        if (!e) break;
        keep.push({ e, ramp: 1 });
        this.snd('beam', t.x);
      }
      t.beams = keep;
      if (!keep.length) return;
      const o = { bossMult: s.bossMult, dot: true };
      for (const b of keep) {
        b.ramp = Math.min(s.rampMax, b.ramp + (s.rampMax - 1) * dt / s.rampTime);
        const dmg = s.dps * b.ramp * rm * dt;
        const e = b.e;
        if (s.line) {
          const a = Math.atan2(e.y - t.y, e.x - t.x);
          const ex = t.x + Math.cos(a) * s.range * 1.4, ey = t.y + Math.sin(a) * s.range * 1.4;
          b.ex = ex; b.ey = ey;
          for (const o2 of this.enemies) {
            if (o2.dead || o2.burrowed || o2 === e) continue;
            if (distSeg(o2.x, o2.y, t.x, t.y, ex, ey) < o2.d.r + 6) this.damage(o2, dmg * 0.6, 'arcane', t, o);
          }
        } else { b.ex = e.x; b.ey = e.y; }
        this.damage(e, dmg, 'arcane', t, o);
      }
      t.ang = Math.atan2(keep[0].e.y - t.y, keep[0].e.x - t.x);
    }
    tHive(t, s, dt, rm) {
      while (t.drones.length < s.drones) {
        const i = t.drones.length;
        t.drones.push({ ang: i * TAU / Math.max(1, s.drones) + this.rnd(), x: t.x, y: t.y, cdT: this.rnd() * 0.5, state: 0, tx: 0, ty: 0, kamiT: (s.kamiEvery || 5) * this.rnd(), respawn: 0 });
      }
      if (t.drones.length > s.drones) t.drones.length = s.drones;
      const orbitR = Math.min(s.range * 0.55, 90);
      for (let i = 0; i < t.drones.length; i++) {
        const dr = t.drones[i];
        if (dr.state === 2) { dr.respawn -= dt; if (dr.respawn <= 0) { dr.state = 0; dr.x = t.x; dr.y = t.y; } continue; }
        if (dr.state === 1) {
          const dx = dr.tx - dr.x, dy = dr.ty - dr.y, dd = Math.hypot(dx, dy);
          const step = 460 * dt;
          if (dd <= step) {
            this.explode(dr.tx, dr.ty, s.kamiRadius, s.kamikaze, 'explosive', t, { ap: 0.5 }, { hitsFlying: true });
            this.fx.push({ k: 'boom', x: dr.tx, y: dr.ty, t: 0, T: 0.3, r: s.kamiRadius, color: '#ffd84d' });
            this.snd('boomSmall', dr.tx);
            dr.state = 2; dr.respawn = 1.4; dr.kamiT = s.kamiEvery;
          } else { dr.x += dx / dd * step; dr.y += dy / dd * step; }
          continue;
        }
        dr.ang += dt * (i % 2 ? -1.3 : 1.1);
        const rr = orbitR * (0.75 + 0.25 * Math.sin(this.time * 1.7 + i));
        const gx = t.x + Math.cos(dr.ang) * rr, gy = t.y + Math.sin(dr.ang) * rr;
        dr.x += (gx - dr.x) * Math.min(1, dt * 6); dr.y += (gy - dr.y) * Math.min(1, dt * 6);
        dr.cdT -= dt * rm;
        if (s.kamikaze) dr.kamiT -= dt * rm;
        if (dr.cdT <= 0 || (s.kamikaze && dr.kamiT <= 0)) {
          const e = this.pick(t, dr.x, dr.y, s.droneRange, t.mode);
          if (!e) { dr.cdT = 0; continue; }
          if (s.kamikaze && dr.kamiT <= 0) { dr.state = 1; dr.tx = e.x; dr.ty = e.y; continue; }
          const a = this.aim({ x: dr.x, y: dr.y }, e, 650);
          this.snd('drone', dr.x);
          this.fireProjectile(t, dr.x, dr.y, a, { speed: 650, dmg: s.droneDmg, pierce: s.pierce, dtype: s.dtype, life: 0.4, kind: s.dtype === 'arcane' ? 'laser' : 'dart', r: 3, opt: { ap: s.armorPierce } });
          dr.cdT = s.droneCd;
        }
      }
      if (s.mothership) {
        if (!t.ship) t.ship = { ang: 0, x: t.x, y: t.y, cdT: 0 };
        const sh = t.ship;
        sh.ang += dt * 0.6;
        sh.x = t.x + Math.cos(sh.ang) * 34; sh.y = t.y + Math.sin(sh.ang) * 20 - 18;
        sh.cdT -= dt * rm;
        if (sh.cdT <= 0) {
          const e = this.pick(t, sh.x, sh.y, s.range * 1.6, 'strong');
          if (e) {
            const a = Math.atan2(e.y - sh.y, e.x - sh.x);
            this.snd('missile', sh.x);
            this.fireProjectile(t, sh.x, sh.y, a, { speed: 380, dmg: 60 * (s.droneDmg / 2), dtype: 'explosive', life: 2.5, kind: 'missile', r: 6, homing: true, target: e, splash: 55, opt: { ap: 1 } });
            sh.cdT = 0.8;
          } else sh.cdT = 0;
        }
      } else t.ship = null;
    }
    tGravity(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      if (!this.anyInRange(t, s.range)) { t.cdT = 0; return; }
      const o = { armorMult: s.armorMult };
      this.inRange(t, s.range, e => {
        // tope de retroceso acumulado (retrocede): la gravedad frena, pero nunca bloquea una ronda para siempre
        this.retrocede(e, e.d.boss ? (s.bossPull ? s.pull * s.bossPull : 0) : s.pull);
        this.damage(e, s.dmg, s.dtype, t, o);
        if (s.stun && !e.dead) this.applyStun(e, s.stun);
      });
      this.fx.push({ k: 'ring', x: t.x, y: t.y, t: 0, T: 0.5, r0: s.range, r1: 8, color: '#b48cff', w: 4 });
      this.snd('gravity', t.x);
      t.flash = 0.2;
      t.cdT = s.cd;
    }
    tSniper(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      t.ang = Math.atan2(e.y - t.y, e.x - t.x);
      const o = { ap: s.armorPierce, bossMult: s.bossMult, shieldMult: s.shieldMult, exec: s.exec };
      const pts = [[t.x + Math.cos(t.ang) * 16, t.y + Math.sin(t.ang) * 16], [e.x, e.y]];
      const hit = [e];
      this.damage(e, s.dmg, s.dtype, t, o);
      let cur = e;
      for (let b = 0; b < (s.bounces || 0); b++) {
        let best = null, bd = 140;
        this.grid.query(cur.x, cur.y, 140, q => {
          if (q.dead || hit.indexOf(q) >= 0 || (q.camo && !s.camo)) return;
          const dd = Math.hypot(q.x - cur.x, q.y - cur.y);
          if (dd < bd) { bd = dd; best = q; }
        });
        if (!best) break;
        hit.push(best); pts.push([best.x, best.y]);
        this.damage(best, s.dmg, s.dtype, t, o);
        cur = best;
      }
      this.fx.push({ k: 'tracer', pts, t: 0, T: 0.12, color: s.dtype === 'arcane' ? '#b9a8ff' : '#fff6c9' });
      this.snd(s.dtype === 'arcane' ? 'sniperArc' : 'sniper', t.x);
      t.flash = 0.08;
      t.cdT = s.cd;
    }
    mineSpots(t) {
      if (t.spots && t.spotsRange === t.s.range) return t.spots;
      const spots = [];
      for (const p of this.paths) {
        for (let d = 0; d < p.len; d += 8) {
          posAt(p, d, tmp);
          if (Math.hypot(tmp.x - t.x, tmp.y - t.y) < t.s.range && tmp.x > 0 && tmp.x < W && tmp.y > 0 && tmp.y < H) spots.push([tmp.x, tmp.y, tmp.a]);
        }
      }
      t.spots = spots; t.spotsRange = t.s.range;
      return spots;
    }
    tMines(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      if (t.mineCount >= s.maxMines) { t.cdT = 0; return; }
      const spots = this.mineSpots(t);
      if (!spots.length) { t.cdT = 1; return; }
      const sp = spots[Math.floor(this.rnd() * spots.length)];
      const off = (this.rnd() - 0.5) * 22;
      const mx = sp[0] + Math.cos(sp[2] + Math.PI / 2) * off, my = sp[1] + Math.sin(sp[2] + Math.PI / 2) * off;
      this.mines.push({ x: t.x, y: t.y, tx: mx, ty: my, fly: 0, src: t, armed: false });
      t.mineCount++;
      this.snd('mineSet', t.x);
      t.cdT = s.cd;
    }
    updateMines(dt) {
      const out = [];
      for (const m of this.mines) {
        if (!m.armed) {
          m.fly += dt * 2.5;
          if (m.fly >= 1) { m.armed = true; m.x = m.tx; m.y = m.ty; }
          out.push(m); continue;
        }
        let trig = false;
        this.grid.query(m.x, m.y, 50, e => {
          if (e.dead || e.d.flying) return;
          if (Math.hypot(e.x - m.x, e.y - m.y) < 10 + e.d.r) { trig = true; return true; }
        });
        if (trig) {
          const t = m.src, s = t.s;
          this.explode(m.x, m.y, s.mineRadius, s.mineDmg, 'explosive', t, { ap: s.armorPierce }, { stun: s.stun, freeze: s.mineFreeze });
          this.fx.push({ k: 'boom', x: m.x, y: m.y, t: 0, T: 0.35, r: s.mineRadius, color: s.mineFreeze ? '#bfefff' : '#ff8a5c' });
          this.snd(s.mineRadius > 60 ? 'boom' : 'boomSmall', m.x);
          if (s.mineCluster) for (let i = 0; i < s.mineCluster; i++) {
            const a = this.rnd() * TAU, d = 20 + this.rnd() * 30;
            this.shells.push({ x0: m.x, y0: m.y, x1: m.x + Math.cos(a) * d, y1: m.y + Math.sin(a) * d, t: 0, T: 0.2 + this.rnd() * 0.15, src: t, dmg: s.mineDmg * 0.5, radius: 28, cluster: 0, mini: true, mine: true, freeze: s.mineFreeze });
          }
          t.mineCount = Math.max(0, t.mineCount - 1);
        } else out.push(m);
      }
      this.mines = out;
    }
    tFlame(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      const a = Math.atan2(e.y - t.y, e.x - t.x);
      t.ang = a; t.flameOn = 0.2;
      this.snd('flame', t.x);
      const o = { fireFloor: s.fireFloor };
      this.inRange(t, s.range, q => {
        let da = Math.atan2(q.y - t.y, q.x - t.x) - a;
        while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const near = Math.hypot(q.x - t.x, q.y - t.y) < 22;
        if (Math.abs(da) > s.cone && !near) return;
        this.damage(q, s.dmg, 'fire', t, o);
        if (!q.dead) this.applyBurn(q, s.burnDps, s.burnDur, t);
      });
      t.cdT = s.cd;
    }

    // ======================= DEFENSAS DE REINO =======================
    // puntos del camino dentro del alcance, con su recorrido (cacheado por alcance)
    pathSpots(t) {
      if (t.pspots && t.pspotsRange === t.s.range) return t.pspots;
      const out = [];
      this.paths.forEach((p, pi) => {
        for (let d = 0; d < p.len; d += 8) {
          posAt(p, d, tmp);
          if (Math.hypot(tmp.x - t.x, tmp.y - t.y) < t.s.range && tmp.x > 0 && tmp.x < W && tmp.y > 0 && tmp.y < H)
            out.push({ x: tmp.x, y: tmp.y, a: tmp.a, pi, d, prog: d / p.len });
        }
      });
      t.pspots = out; t.pspotsRange = t.s.range;
      return out;
    }
    // empuje hacia atrás con tope acumulado (igual que la gravedad: frena, nunca bloquea para siempre)
    push(e, amt) { this.retrocede(e, e.d.boss ? amt * 0.25 : amt); }
    // todo retroceso pasa por aquí: gasta del tope del enemigo (KB_MAX) y devuelve cuánto retrocedió
    retrocede(e, want) {
      const back = Math.min(want, Math.max(0, KB_MAX(e) - e.pulled), e.dist);
      if (back > 0) { e.dist -= back; e.pulled += back; }
      return back > 0 ? back : 0;
    }

    // ---- Cazador de Bumeranes: golpea a la ida y a la vuelta ----
    tBoomerang(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      const ang = Math.atan2(e.y - t.y, e.x - t.x);
      const D = Math.min(s.range + 15, Math.hypot(e.x - t.x, e.y - t.y) + 25);
      t.ang = ang;
      for (let i = 0; i < s.count; i++) {
        const wd = D * (i === 2 ? 0.16 : 0.5);
        const T = (Math.PI * (D + wd) / 2) / s.rangSpeed;
        this.rangs.push({
          src: t, ox: t.x, oy: t.y, x: t.x, y: t.y, ang, D, wd, side: i % 2 ? -1 : 1, u: 0, T, rot: 0,
          dmg: s.dmg, pierce: s.pierce, hitA: [], hitB: [], push: s.push || 0, big: !!s.big, opt: { ap: s.armorPierce, bossMult: s.bossMult }
        });
      }
      t.flash = 0.1;
      this.snd('rang', t.x);
      t.cdT = s.cd;
    }
    updateRangs(dt) {
      if (!this.rangs.length) return;
      const out = [];
      for (const b of this.rangs) {
        b.u += dt / b.T; b.rot += dt * 16;
        if (b.u >= 1) continue;
        const ph = b.u * TAU, c = Math.cos(b.ang), sn = Math.sin(b.ang);
        const lx = b.D / 2 * (1 - Math.cos(ph)), ly = b.side * b.wd / 2 * Math.sin(ph);
        b.x = b.ox + lx * c - ly * sn; b.y = b.oy + lx * sn + ly * c;
        if (b.pierce > 0) {
          const hit = b.u < 0.5 ? b.hitA : b.hitB, R = b.big ? 14 : 9;
          this.grid.query(b.x, b.y, R + 46, e => {
            if (b.pierce <= 0) return true;
            if (e.dead || hit.indexOf(e.id) >= 0) return;
            if (Math.hypot(e.x - b.x, e.y - b.y) > R + e.d.r) return;
            hit.push(e.id); b.pierce -= e.d.boss ? 4 : 1;
            this.damage(e, b.dmg, 'phys', b.src, b.opt);
            if (b.push && !e.dead) this.push(e, b.push);
          });
        }
        out.push(b);
      }
      this.rangs = out;
    }

    // ---- Guardabosques: murallas de raíces que detienen el avance ----
    tBarrier(t, s, dt) {
      if (!this.active) return;
      t.cdT -= dt;
      if (t.cdT > 0) return;
      let mine = 0;
      for (const w of this.walls) if (w.src === t) mine++;
      if (mine >= s.maxWalls) { t.cdT = 0.3; return; }
      const spots = this.pathSpots(t);
      if (!spots.length) { t.cdT = 1; return; }
      let best = null;
      for (const sp of spots) {
        if (best && sp.prog <= best.prog) continue;
        let ok = true;
        for (const w of this.walls) if (Math.abs(w.x - sp.x) < 44 && Math.hypot(w.x - sp.x, w.y - sp.y) < 44) { ok = false; break; }
        if (!ok) continue;
        // nunca brota encima de un enemigo (quedaría atrapado dentro)
        let busy = false;
        this.grid.query(sp.x, sp.y, 60, e => { if (!e.dead && Math.hypot(e.x - sp.x, e.y - sp.y) < e.d.r + 18) { busy = true; return true; } });
        if (!busy) best = sp;
      }
      if (!best) { t.cdT = 0.4; return; }
      this.walls.push({ src: t, x: best.x, y: best.y, a: best.a, r: 15, hp: s.wallHp, maxHp: s.wallHp, life: s.wallLife, T: s.wallLife, grow: 0, held: 0 });
      this.snd('roots', best.x);
      t.flash = 0.2;
      t.cdT = s.cd;
    }
    updateWalls(dt) {
      if (!this.walls.length) return;
      const out = [];
      for (const w of this.walls) {
        w.grow = Math.min(1, w.grow + dt * 3);
        w.life -= dt;
        if (w.hp > 0 && w.life > 0) { out.push(w); continue; }
        const s = w.src.s;
        this.fx.push({ k: 'puff', x: w.x, y: w.y, t: 0, T: 0.5, color: '#8a6a32', r: 16 });
        if (w.hp <= 0) {
          this.snd('rootsBreak', w.x);
          if (s.sap) {
            this.grid.query(w.x, w.y, 80, e => { if (!e.dead && Math.hypot(e.x - w.x, e.y - w.y) < 62) { this.applySlow(e, 0.5, 2); this.applyPoison(e, s.sap, 3, w.src); } });
            this.fx.push({ k: 'ring', x: w.x, y: w.y, t: 0, T: 0.45, r0: 6, r1: 62, color: '#b8f060', w: 3 });
          }
        }
      }
      this.walls = out;
    }
    // ¿está detenido este enemigo por una muralla o un gólem? (cada enemigo solo puede ser frenado blockCap s en total)
    blocked(e, dt) {
      const d = e.d;
      if (d.flying || e.burrowed) return false;
      if (e.engaged) {
        const g = e.engaged;
        if (g.dead) { e.engaged = null; return false; }
        e.blockT += dt;
        if (e.blockT > (d.boss ? g.src.s.bossBlock || 0 : g.src.s.blockCap)) { this.release(e); return false; }
        return true;
      }
      for (const w of this.walls) {
        if (w.hp <= 0) continue;
        const dx = e.x - w.x, dy = e.y - w.y, rr = w.r + d.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        const s = w.src.s;
        if (d.boss) {
          if (!s.bossHold || w.held >= s.bossHold) { w.hp = 0; continue; }   // los jefes la arrasan
          w.held += dt;
        } else {
          if (e.blockT >= s.blockCap) continue;
          e.blockT += dt;
        }
        w.hp -= chew(e) * dt;
        if (s.thornDps) this.damage(e, s.thornDps * dt, 'phys', w.src, { dot: true });
        return true;
      }
      return false;
    }
    release(e) {
      const g = e.engaged;
      e.engaged = null;
      if (g) g.engaged = g.engaged.filter(o => o !== e);
    }

    // ---- Forja de Gólems: soldados que bloquean y golpean ----
    tBarracks(t, s, dt) {
      if (!t.rally || t.rallyRange !== s.range) {
        const spots = this.pathSpots(t).slice().sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y));
        const pts = [];
        for (const sp of spots) { if (pts.every(p => Math.hypot(p.x - sp.x, p.y - sp.y) > 30)) pts.push(sp); if (pts.length >= 8) break; }
        t.rally = pts; t.rallyRange = s.range;
      }
      if (!t.rally.length) return;
      if (t.forgeT === undefined) t.forgeT = 0;
      const mine = this.golems.filter(g => g.src === t && !g.dead);
      if (mine.length < s.golems) {
        t.forgeT -= dt;
        if (t.forgeT <= 0) {
          const used = mine.map(g => g.slot);
          let slot = 0; while (used.indexOf(slot) >= 0) slot++;
          const rp = t.rally[slot % t.rally.length], k = Math.floor(slot / t.rally.length);
          const g = { src: t, slot, x: t.x, y: t.y, hx: rp.x + k * 9, hy: rp.y - k * 7, hp: s.golemHp, maxHp: s.golemHp, engaged: [], atkT: 0.3, dead: false, face: 1, swing: 0, wob: this.rnd() * 6 };
          this.golems.push(g); mine.push(g);
          this.snd('forge', t.x);
          t.flash = 0.3;
          t.forgeT = 0.8;
        }
      }
      const o = { ap: s.armorPierce };
      for (const g of mine) {
        g.maxHp = s.golemHp;
        if (g.swing > 0) g.swing -= dt;
        g.engaged = g.engaged.filter(e => !e.dead && e.engaged === g);
        if (!g.engaged.length) {
          const dx = g.hx - g.x, dy = g.hy - g.y, dd = Math.hypot(dx, dy);
          if (dd > 1) { const st = Math.min(dd, 75 * dt); g.x += dx / dd * st; g.y += dy / dd * st; g.face = dx >= 0 ? 1 : -1; }
          g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.12 * dt);   // se recompone si no lucha
        }
        if (g.engaged.length < s.block) {
          this.grid.query(g.x, g.y, 50, e => {
            if (g.engaged.length >= s.block) return true;
            if (e.dead || e.engaged || e.d.flying || e.burrowed) return;
            if (e.d.boss ? !s.bossBlock : e.blockT >= s.blockCap) return;
            if (e.d.boss && e.blockT >= s.bossBlock) return;
            if (Math.hypot(e.x - g.x, e.y - g.y) > 11 + e.d.r) return;
            e.engaged = g; g.engaged.push(e);
            g.face = e.x >= g.x ? 1 : -1;
          });
        }
        if (!g.engaged.length) continue;
        let ch = 0;
        for (const e of g.engaged) ch += chew(e);
        g.hp -= ch * dt;
        if (s.golemBurn) for (const e of g.engaged) this.applyBurn(e, s.golemBurn, 1, t);
        g.atkT -= dt;
        if (g.atkT <= 0) {
          g.atkT = 0.6; g.swing = 0.22;
          if (s.golemSplash) this.grid.query(g.x, g.y, 70, e => { if (!e.dead && !e.d.flying && Math.hypot(e.x - g.x, e.y - g.y) < 26 + e.d.r) this.damage(e, s.golemDmg, 'phys', t, o); });
          else this.damage(g.engaged[0], s.golemDmg, 'phys', t, o);
          this.snd('golemHit', g.x);
        }
        if (g.hp <= 0) this.golemDie(g);
      }
    }
    golemDie(g, silent) {
      if (g.dead) return;
      g.dead = true;
      for (const e of g.engaged) if (e.engaged === g) e.engaged = null;
      g.engaged = [];
      if (silent) return;
      const t = g.src, s = t.s;
      this.fx.push({ k: 'puff', x: g.x, y: g.y, t: 0, T: 0.5, color: '#ff8a3d', r: 14 });
      if (s.golemBoom) {
        this.explode(g.x, g.y, 62, s.golemBoom, 'explosive', t, { ap: 1 });
        this.fx.push({ k: 'boom', x: g.x, y: g.y, t: 0, T: 0.4, r: 62, color: '#ff7a2f' });
        this.snd('boomSmall', g.x);
      }
      t.forgeT = Math.max(t.forgeT || 0, s.golemCd);
    }

    // ---- Taller de Sierras: sierras que ruedan contra la corriente ----
    tSaw(t, s, dt) {
      if (t.sawQ > 0) { t.sawQT -= dt; if (t.sawQT <= 0) { this.launchSaw(t, s); t.sawQ--; t.sawQT = 0.22; } }
      t.cdT -= dt;
      if (t.cdT > 0) return;
      let any = false;
      this.inRange(t, s.range + 90, e => { if (!e.d.flying) any = true; });
      if (!any) { t.cdT = 0; return; }
      this.launchSaw(t, s);
      t.sawQ = s.saws - 1; t.sawQT = 0.22;
      t.cdT = s.cd;
    }
    launchSaw(t, s) {
      const spots = this.pathSpots(t);
      if (!spots.length) return;
      let best = spots[0];
      for (const sp of spots) if (sp.prog > best.prog) best = sp;
      this.saws.push({ src: t, pi: best.pi, dist: best.d, x: best.x, y: best.y, a: best.a, sp: s.sawSpeed, left: s.sawDist, dmg: s.dmg, pierce: s.pierce, hit: [], r: s.big ? 15 : 10, rot: 0, bleed: s.bleed || 0, opt: { ap: s.armorPierce, bossMult: s.bossMult } });
      this.snd('saw', best.x);
      t.flash = 0.12;
    }
    updateSaws(dt) {
      if (!this.saws.length) return;
      const out = [];
      for (const w of this.saws) {
        const step = w.sp * dt;
        w.dist -= step; w.left -= step; w.rot += dt * 22;
        if (w.dist <= 0 || w.left <= 0 || w.pierce <= 0) { this.fx.push({ k: 'puff', x: w.x, y: w.y, t: 0, T: 0.3, color: '#d8dee6', r: 8 }); continue; }
        posAt(this.paths[w.pi], w.dist, tmp); w.x = tmp.x; w.y = tmp.y; w.a = tmp.a;
        this.grid.query(w.x, w.y, w.r + 46, e => {
          if (w.pierce <= 0) return true;
          if (e.dead || e.d.flying || w.hit.indexOf(e.id) >= 0) return;
          if (Math.hypot(e.x - w.x, e.y - w.y) > w.r + e.d.r) return;
          w.hit.push(e.id); w.pierce -= e.d.boss ? 8 : e.d.big ? 3 : 1;
          this.damage(e, w.dmg, 'phys', w.src, w.opt);
          if (w.bleed && !e.dead) this.applyPoison(e, w.bleed, 3, w.src);
        });
        out.push(w);
      }
      this.saws = out;
    }

    // ---- Alquimista Corrosivo ----
    tAcid(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      const T = 0.55, tx = e.x + e.vx * T, ty = e.y + e.vy * T;
      t.ang = Math.atan2(ty - t.y, tx - t.x);
      const n = s.shells || 1;
      for (let k = 0; k < n; k++) {
        const ox = k ? (this.rnd() - 0.5) * 80 : 0, oy = k ? (this.rnd() - 0.5) * 80 : 0;
        this.shells.push({ x0: t.x, y0: t.y, x1: tx + ox, y1: ty + oy, t: 0, T: T + k * 0.1, src: t, dmg: s.dmg, radius: s.radius, acid: true });
      }
      t.flash = 0.1;
      this.snd('acid', t.x);
      t.cdT = s.cd;
    }
    corrode(e, s) {
      e.corr = Math.min(e.corr + s.corr, Math.max(e.corr, s.corrMax));
      e.corrT = 6; e.corrAmp = Math.max(e.corrAmp, s.corrAmp);
      if (s.goldMult) { e.goldT = 6; e.goldMult = Math.max(e.goldMult, s.goldMult); }
    }
    landAcid(sh) {
      const t = sh.src, s = t.s, o = { shieldMult: s.shieldMult };
      this.grid.query(sh.x1, sh.y1, sh.radius + 44, e => {
        if (e.dead || Math.hypot(e.x - sh.x1, e.y - sh.y1) > sh.radius + e.d.r * 0.5) return;
        this.corrode(e, s);
        this.damage(e, sh.dmg, 'poison', t, o);
        if (!e.dead && s.acidDps) this.applyPoison(e, s.acidDps, s.acidDur, t);
      });
      this.fx.push({ k: 'splash', x: sh.x1, y: sh.y1, t: 0, T: 0.45, r: sh.radius, color: '#9be04a' });
      this.snd('acidHit', sh.x1);
      if (s.puddleDps) this.puddles.push({ x: sh.x1, y: sh.y1, r: sh.radius * 0.8, dps: s.puddleDps, t: 3, T: 3, src: t, dtype: 'poison', look: 'acid' });
    }

    // ---- Faro Boreal: la luz se calcula en updateEnemies; aquí el destello ----
    tBeacon(t, s, dt) {
      if (!s.flashDmg) return;
      t.flashT -= dt;
      if (t.flashT > 0) return;
      if (!this.anyInRange(t, s.range)) { t.flashT = 0; return; }
      const o = { bossMult: s.bossMult };
      this.inRange(t, s.range, e => { this.damage(e, s.flashDmg, 'arcane', t, o); if (s.flashStun && !e.dead) this.applyStun(e, s.flashStun); });
      this.fx.push({ k: 'ring', x: t.x, y: t.y, t: 0, T: 0.4, r0: 8, r1: s.range, color: '#fff6c0', w: 5 });
      this.snd('flashB', t.x);
      t.flash = 0.25;
      t.flashT = s.flashCd;
    }

    // ---- Balista Rúnica: virote que atraviesa en línea recta ----
    tRail(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      const base = this.aim(t, e, 1400);
      t.ang = base;
      const len = s.range * 1.35, o = { ap: s.armorPierce, bossMult: s.bossMult };
      for (let i = 0; i < s.bolts; i++) {
        const a = base + (i - (s.bolts - 1) / 2) * 0.13, ca = Math.cos(a), sa = Math.sin(a);
        const x0 = t.x + ca * 14, y0 = t.y + sa * 14, x1 = t.x + ca * len, y1 = t.y + sa * len;
        for (const q of this.enemies) {
          if (q.dead || q.burrowed || distSeg(q.x, q.y, x0, y0, x1, y1) > s.width + q.d.r) continue;
          this.damage(q, s.dmg, s.dtype, t, o);
          if (q.dead) continue;
          if (s.slow) this.applySlow(q, s.slow, s.slowDur);
          if (s.freeze) this.applyFreeze(q, s.freeze);
          if (s.push) this.push(q, s.push);
        }
        this.fx.push({ k: 'rail', pts: [[x0, y0], [x1, y1]], t: 0, T: 0.3, w: s.width, color: s.freeze ? '#e8fbff' : '#9fdcff' });
      }
      this.snd('rail', t.x);
      t.flash = 0.12;
      t.cdT = s.cd;
    }

    // ---- Géiser Hirviente: levanta, moja y escalda ----
    tGeyser(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const targets = [];
      for (let k = 0; k < s.erupts; k++) {
        const e = this.pick(t, t.x, t.y, s.range, t.mode, targets);
        if (!e) break;
        targets.push(e);
      }
      if (!targets.length) { t.cdT = 0; return; }
      for (const e of targets) this.erupt(t, s, e.x, e.y);
      this.snd('geyser', t.x);
      t.flash = 0.2;
      t.cdT = s.cd;
    }
    erupt(t, s, x, y) {
      const o = { ap: s.armorPierce };
      this.grid.query(x, y, s.radius + 44, e => {
        if (e.dead || (e.d.flying && s.noFlying)) return;
        if (Math.hypot(e.x - x, e.y - y) > s.radius + e.d.r * 0.5) return;
        this.damage(e, s.dmg, 'steam', t, o);
        if (e.dead) return;
        e.wetT = Math.max(e.wetT, s.wetDur);
        e.wetElec = Math.max(e.wetElec, s.wetElec || 1.5);
        e.wetAmp = Math.max(e.wetAmp, s.wetAmp || 0);
        if (!e.d.flying) {
          if (!(e.stunImm > 0) && !e.d.boss) e.liftT = s.lift;
          this.applyStun(e, s.lift);
          if (s.push) this.push(e, s.push);
        }
      });
      this.fx.push({ k: 'geyser', x, y, t: 0, T: 0.7, r: s.radius });
      if (s.cloudDps) this.puddles.push({ x, y, r: s.radius * 0.9, dps: s.cloudDps, t: s.wetDur > 5 ? 3.5 : 2.5, T: s.wetDur > 5 ? 3.5 : 2.5, src: t, dtype: 'steam', look: 'steam', air: !s.noFlying });
    }

    // ---- Obelisco de la Maldición ----
    curse(e, t, dur) {
      if (!t || !t.s) return;
      const s = t.s, weak = e.d.boss && !s.hexBoss;
      e.hexT = Math.max(e.hexT, Math.min(dur, s.hexDur || dur)); e.hexSrc = t;
      e.hexAmp = Math.max(e.hexAmp, (s.hexAmp || 0) * (weak ? 0.5 : 1));
      e.hexExec = Math.max(e.hexExec, s.hexExec || 0);
      e.hexSpread = Math.max(e.hexSpread, s.hexSpread || 0);
      e.hexDps = Math.max(e.hexDps, s.hexDps || 0);
      e.hexArmor = Math.max(e.hexArmor, s.hexArmor || 0);
      if (s.hexReveal) e.hexReveal = true;
    }
    tHex(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const skip = this.enemies.filter(e => e.hexT > 1.2);
      const chosen = [];
      for (let k = 0; k < s.targets; k++) {
        const e = this.pick(t, t.x, t.y, s.range, t.mode, chosen.concat(skip));
        if (!e) break;
        chosen.push(e);
      }
      if (!chosen.length) { t.cdT = 0.2; return; }
      for (const e of chosen) {
        this.curse(e, t, s.hexDur);
        if (s.dmg) this.damage(e, s.dmg, 'arcane', t, {});
        this.fx.push({ k: 'bolt', pts: [[t.x, t.y - 16], [e.x, e.y]], t: 0, T: 0.22, color: '#c07bff', w: 2 });
      }
      this.snd('hex', t.x);
      t.flash = 0.2;
      t.cdT = s.cd;
    }

    // ---- Segador del Vacío: guadañas giratorias de corto alcance ----
    tBlades(t, s, dt) {
      t.spin += dt * s.spinSpd;
      const n = s.blades, R = s.range, now = this.time;
      const o = { ap: s.armorPierce, bossMult: s.bossMult, exec: s.exec };
      let hits = 0;
      this.grid.query(t.x, t.y, R + 30, e => {
        if (e.dead) return;
        const dx = e.x - t.x, dy = e.y - t.y, dd = Math.hypot(dx, dy);
        if (dd > R + e.d.r * 0.6 || dd < 4) return;
        const last = t.hitMap.get(e.id);
        if (last !== undefined && now - last < s.hitCd) return;
        const ang = Math.atan2(dy, dx), tol = Math.atan2(7 + e.d.r, dd) + 0.06;
        let near = false;
        for (let k = 0; k < n; k++) {
          let da = (ang - t.spin - k * TAU / n) % TAU;
          if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
          if (Math.abs(da) < tol) { near = true; break; }
        }
        if (!near) return;
        t.hitMap.set(e.id, now);
        this.damage(e, s.dmg, s.dtype, t, o);
        if (s.slow && !e.dead) this.applySlow(e, s.slow, 1);
        hits++;
      });
      if (hits) this.snd('blade', t.x);
      if (t.hitMap.size > 400) for (const [id, tm] of t.hitMap) if (now - tm > 2) t.hitMap.delete(id);
    }

    // ---- Héroes: cada uno ataca con su arma (s.atk) ----
    tHero(t, s, dt) {
      switch (s.atk) {
        case 'proj': this.tProjectile(t, s, dt); break;   // Sylva: semillas
        case 'orb': this.tSun(t, s, dt); break;           // Ra'kesh: soles
        case 'lance': this.tRail(t, s, dt); break;        // Freya: lanzas que atraviesan
        case 'slam': this.tSlam(t, s, dt); break;         // Vulkar: martillazo en área
        case 'bolt': this.tSniper(t, s, dt); break;       // Nyx: rayos que rebotan
      }
    }
    tSun(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      const e = this.pick(t, t.x, t.y, s.range, t.mode);
      if (!e) { t.cdT = 0; return; }
      const T = 0.5, tx = e.x + e.vx * T, ty = e.y + e.vy * T;
      t.ang = Math.atan2(ty - t.y, tx - t.x);
      const n = s.shells || 1;
      for (let k = 0; k < n; k++) {
        const ox = k ? (this.rnd() - 0.5) * 70 : 0, oy = k ? (this.rnd() - 0.5) * 70 : 0;
        this.shells.push({ x0: t.x, y0: t.y, x1: tx + ox, y1: ty + oy, t: 0, T: T + k * 0.08, src: t, dmg: s.dmg, radius: s.radius, sun: true });
      }
      t.flash = 0.12;
      this.snd('mortar', t.x);
      t.cdT = s.cd;
    }
    landSun(sh) {
      const t = sh.src, s = t.s, o = { ap: s.armorPierce, bossMult: s.bossMult };
      this.grid.query(sh.x1, sh.y1, sh.radius + 44, e => {
        if (e.dead || Math.hypot(e.x - sh.x1, e.y - sh.y1) > sh.radius + e.d.r * 0.5) return;
        this.damage(e, sh.dmg, 'explosive', t, o);
        if (!e.dead && s.burnDps) this.applyBurn(e, s.burnDps, 3, t);
      });
      this.fx.push({ k: 'boom', x: sh.x1, y: sh.y1, t: 0, T: 0.4, r: sh.radius, color: '#ffd84d' });
      this.snd('boomSmall', sh.x1);
    }
    tSlam(t, s, dt) {
      t.cdT -= dt;
      if (t.cdT > 0) return;
      if (!this.anyInRange(t, s.range)) { t.cdT = 0; return; }
      const o = { ap: s.armorPierce, bossMult: s.bossMult, fireFloor: 0.5 };
      this.inRange(t, s.range, e => {
        this.damage(e, s.dmg, 'fire', t, o);
        if (e.dead) return;
        this.applyBurn(e, s.burnDps, s.burnDur, t);
        if (s.stun) this.applyStun(e, s.stun);
      });
      this.fx.push({ k: 'ring', x: t.x, y: t.y, t: 0, T: 0.45, r0: 12, r1: s.range, color: '#ff8a3d', w: 6 });
      this.fx.push({ k: 'boom', x: t.x, y: t.y, t: 0, T: 0.3, r: 26, color: '#ffb35c' });
      this.snd('golemHit', t.x);
      t.flash = 0.25;
      t.cdT = s.cd;
    }

    // Habilidades automáticas: se lanzan solas cuando hay suficiente peligro
    autoAbility(t) {
      const id = t.s.ability;
      if (!id || !this.active || t.abilityCd > 0 || t.disabledT > 0 || this.abLock[id] > 0) return;
      const T = this.threat;
      if (!T || !T.n) return;
      let go;
      if (id === 'treasure') go = true;
      else if (id === 'supernova' || id === 'inferno' || id === 'blackhole') {
        const R = id === 'supernova' ? 260 : t.s.range + 50;
        let k = 0, b = false;
        this.inRange(t, R, e => { k++; if (e.d.boss) b = true; });
        go = k >= 6 || b || (k >= 2 && T.maxProg > 0.7);
      } else if (id === 'grieta' || id === 'tormenta') go = T.boss || T.maxProg > 0.5 || T.n >= 25;
      else go = T.n >= 8 || T.boss || T.maxProg > 0.6;
      if (go && this.useAbility(t)) this.abLock[id] = 2.5;   // dos torres iguales no la gastan a la vez
    }

    // ----------------------------- Habilidades -----------------------------
    useAbility(t) {
      const id = t.s.ability;
      if (!id || t.abilityCd > 0 || t.disabledT > 0) return false;
      const A = PD.ABILITIES[id];
      t.abilityCd = t.s.abCd || A.cd;
      const s = t.s, hurry = this.rt > (this.hurryT || 1e9);   // ronda eterna: nada los devuelve
      switch (id) {
        case 'absolute':
          for (const e of this.enemies) if (!e.dead) this.applyFreeze(e, 4);
          this.fx.push({ k: 'flashscreen', t: 0, T: 0.6, color: 'rgba(190,240,255,' });
          break;
        case 'judgement': {
          const list = this.enemies.filter(e => !e.dead && !e.burrowed).sort((a, b) => (b.maxHp + (b.d.boss ? 1e9 : 0)) - (a.maxHp + (a.d.boss ? 1e9 : 0))).slice(0, 30);
          for (const e of list) {
            this.fx.push({ k: 'bolt', pts: [[e.x + (this.rnd() - 0.5) * 40, -10], [e.x, e.y]], t: 0, T: 0.35, color: '#fff27a', w: 5 });
            this.damage(e, 250, 'arcane', t, { bossMult: 6 });
          }
          break;
        }
        case 'meteors': {
          const live = this.enemies.filter(e => !e.dead && !e.burrowed);
          for (let i = 0; i < 12; i++) {
            const e = live.length ? live[Math.floor(this.rnd() * live.length)] : null;
            const tx = e ? e.x : 100 + this.rnd() * 800, ty = e ? e.y : 100 + this.rnd() * 440;
            this.shells.push({ x0: tx - 200, y0: ty - 500, x1: tx, y1: ty, t: -i * 0.12, T: 0.8, src: t, dmg: 300, radius: 70, meteor: true });
          }
          break;
        }
        case 'supernova':
          this.inRange(t, 260, e => this.damage(e, 1500, 'arcane', t, {}));
          this.fx.push({ k: 'ring', x: t.x, y: t.y, t: 0, T: 0.8, r0: 10, r1: 260, color: '#ffe08a', w: 14 });
          break;
        case 'blackhole': {
          const spots = this.mineSpots(t);
          const sp = spots.length ? spots[Math.floor(spots.length / 2)] : [t.x, t.y];
          this.holes.push({ x: sp[0], y: sp[1], r: 100, t: 5, T: 5, src: t });
          break;
        }
        case 'treasure':
          this.money += 1500;
          this.fx.push({ k: 'text', x: t.x, y: t.y - 24, t: 0, T: 1.6, text: '+1500', color: '#7dffcf' });
          break;
        // ------------------------------ héroes ------------------------------
        case 'selva':
          // raíces: los terrestres quedan clavados (los jefes solo con Bosque Eterno, y frenados)
          for (const e of this.enemies) {
            if (e.dead || (e.d.flying && !s.selvaAir) || (e.d.boss && !s.selvaBoss)) continue;
            e.holdT = Math.max(e.holdT, s.selvaDur);
            this.applyPoison(e, s.selvaDps, s.selvaDur, t);
            this.fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, T: 0.6, r0: 4, r1: e.d.r + 14, color: '#7ae05a', w: 3 });
          }
          this.fx.push({ k: 'flashscreen', t: 0, T: 0.6, color: 'rgba(120,230,90,' });
          break;
        case 'tormenta':
          if (hurry) break;
          for (const e of this.enemies) {
            if (e.dead || Math.hypot(e.x - t.x, e.y - t.y) > s.stormR) continue;
            const back = this.retrocede(e, s.stormPush * (e.d.boss ? 0.25 : 1));
            if (back > 0) { this.fx.push({ k: 'dust', x: e.x, y: e.y, t: 0, T: 0.5, r: e.d.r * 1.6 }); if (e.engaged) this.release(e); }
            this.applyStun(e, s.stormStun);
          }
          this.fx.push({ k: 'ring', x: t.x, y: t.y, t: 0, T: 0.8, r0: 20, r1: Math.min(700, s.stormR), color: '#ffd38a', w: 12 });
          this.fx.push({ k: 'flashscreen', t: 0, T: 0.6, color: 'rgba(255,210,130,' });
          break;
        case 'invierno':
          for (const e of this.enemies) {
            if (e.dead) continue;
            this.applySlow(e, 0.6, s.winterDur);
            e.brittleT = Math.max(e.brittleT, s.winterDur); e.brittle = Math.max(e.brittle, s.winterBrittle);
            if (s.winterFreeze && !e.d.boss) this.applyFreeze(e, s.winterFreeze);
            if (s.winterDmg) this.damage(e, s.winterDmg, 'ice', t, { ap: 1 });
          }
          this.fx.push({ k: 'flashscreen', t: 0, T: 0.7, color: 'rgba(190,240,255,' });
          break;
        case 'erupcion': {
          const list = this.enemies.filter(e => !e.dead && !e.burrowed).sort((a, b) => (b.maxHp + (b.d.boss ? 1e9 : 0)) - (a.maxHp + (a.d.boss ? 1e9 : 0))).slice(0, s.eruptN);
          list.forEach((e, i) => {
            this.shells.push({ x0: e.x - 120, y0: e.y - 420, x1: e.x, y1: e.y, t: -i * 0.1, T: 0.7, src: t, dmg: s.eruptDmg, radius: 60, meteor: true });
          });
          break;
        }
        case 'grieta':
          if (hurry) break;
          for (const e of this.enemies) {
            // una sola vez por enemigo (y sus hijos tampoco): antes cada Grieta los volvía a
            // devolver y con la recarga corta una ronda podía no terminar nunca
            if (e.dead || e.rifted) continue;
            const back = e.dist * (e.d.boss ? s.riftBoss : s.riftBack);
            if (back <= 1) continue;
            e.rifted = true;
            this.fx.push({ k: 'puff', x: e.x, y: e.y, t: 0, T: 0.6, color: '#c07bff', r: e.d.r * 1.5 });
            e.dist -= back;
            posAt(this.paths[e.path], e.dist, tmp); e.x = tmp.x; e.y = tmp.y; e.a = tmp.a;
            if (e.engaged) this.release(e);
            if (s.riftStun) this.applyStun(e, s.riftStun);
            if (s.riftHex) { e.hexT = Math.max(e.hexT, 6); e.hexAmp = Math.max(e.hexAmp, s.riftHex * (e.d.boss ? 0.5 : 1)); e.hexSrc = e.hexSrc || t; }
            if (s.riftDmg) this.damage(e, s.riftDmg, 'arcane', t, { bossMult: 2 });
            this.fx.push({ k: 'puff', x: e.x, y: e.y, t: 0, T: 0.6, color: '#8a5bff', r: e.d.r * 1.5 });
          }
          this.fx.push({ k: 'flashscreen', t: 0, T: 0.7, color: 'rgba(170,110,255,' });
          break;
        case 'wardrum':
          this.wardrum = 8;
          break;
        case 'inferno':
          this.rings.push({ x: t.x, y: t.y, r: t.s.range + 30, t: 6, T: 6, dps: 400, src: t });
          break;
      }
      this.emit({ type: 'ability', id });
      this.snd('ab_' + id, t.x);
      return true;
    }

    // ---------------------------- Bucle principal --------------------------
    update(dt) {
      if (this.over) return;
      this.time += dt;
      if (this.wardrum > 0) this.wardrum -= dt;
      if (this.active) {
        this.rt += dt;
        while (this.qi < this.queue.length && this.queue[this.qi].t <= this.rt) {
          const q = this.queue[this.qi++];
          const e = this.spawn(q.type, q.path, 0, PD.hpMult(this.L, this.round + 1) * q.hpX, q.tier);   // hpX: grupo reforzado
          if (q.mod) this.modifica(e, q.mod);
        }
      }
      this.grid.clear();
      for (const e of this.enemies) if (!e.dead && !e.burrowed) this.grid.add(e);

      this.updateEnemies(dt);
      if (this.over) return;
      this.updateTowers(dt);
      this.updateProjectiles(dt);
      this.updateShells(dt);
      this.updateMines(dt);
      this.updateSaws(dt);
      this.updateRangs(dt);
      this.updateWalls(dt);
      if (this.golems.length && this.golems.some(g => g.dead)) this.golems = this.golems.filter(g => !g.dead);
      for (const k in this.abLock) if (this.abLock[k] > 0) this.abLock[k] -= dt;
      this.updateAreas(dt);
      for (const f of this.fx) f.t += dt;
      this.fx = this.fx.filter(f => f.t < f.T);
      if (this.fx.length > 700) this.fx.splice(0, this.fx.length - 700);

      if (this.enemies.some(e => e.dead)) this.enemies = this.enemies.filter(e => !e.dead);
      this.bosses = this.enemies.filter(e => e.d.boss);
      if (this.active && this.qi >= this.queue.length && this.enemies.length === 0) this.endRound();
    }
    updateProjectiles(dt) {
      const out = [];
      for (const p of this.projs) {
        if (p.homing && p.target && !p.target.dead) {
          const a = Math.atan2(p.target.y - p.y, p.target.x - p.x);
          const sp = Math.hypot(p.vx, p.vy);
          let cur = Math.atan2(p.vy, p.vx), da = a - cur;
          while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          cur += Math.max(-6 * dt, Math.min(6 * dt, da));
          p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
        }
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        p.ang = Math.atan2(p.vy, p.vx);
        if (p.life <= 0 || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) continue;
        let alive = true;
        this.grid.query(p.x, p.y, p.r + 46, e => {
          if (e.dead || p.hit.indexOf(e.id) >= 0) return;
          if (p.noFlying && e.d.flying) return;
          const rr = p.r + e.d.r;
          const dx = e.x - p.x, dy = e.y - p.y;
          if (dx * dx + dy * dy > rr * rr) return;
          if (p.splash) {
            this.explode(p.x, p.y, p.splash, p.dmg, p.dtype, p.src, p.opt, { hitsFlying: true });
            this.fx.push({ k: 'boom', x: p.x, y: p.y, t: 0, T: 0.35, r: p.splash, color: '#ffb35c' });
            this.snd('boomSmall', p.x);
            alive = false; return true;
          }
          p.hit.push(e.id);
          this.damage(e, p.dmg, p.dtype, p.src, p.opt);
          if (p.poison && !e.dead) this.applyPoison(e, p.poison[0], p.poison[1], p.src);
          p.pierce--;
          if (p.pierce <= 0) { alive = false; return true; }
        });
        if (alive) out.push(p);
      }
      this.projs = out;
    }
    updateShells(dt) {
      const out = [];
      for (const sh of this.shells) {
        sh.t += dt;
        if (sh.t >= sh.T) this.landShell(sh);
        else out.push(sh);
      }
      this.shells = out;
    }
    updateAreas(dt) {
      for (const pd of this.puddles) {
        pd.t -= dt;
        this.grid.query(pd.x, pd.y, pd.r + 40, e => {
          if (e.dead || (e.d.flying && !pd.air)) return;
          if (Math.hypot(e.x - pd.x, e.y - pd.y) < pd.r + e.d.r * 0.5) this.damage(e, pd.dps * dt, pd.dtype || 'fire', pd.src, { dot: true });
        });
      }
      this.puddles = this.puddles.filter(p => p.t > 0);
      for (const h of this.holes) {
        h.t -= dt;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dd = Math.hypot(e.x - h.x, e.y - h.y);
          if (dd < h.r) {
            e.holdT = 0.15;
            this.damage(e, 300 * dt, 'arcane', h.src, { dot: true, bossMult: 2 });
          }
        }
      }
      this.holes = this.holes.filter(h => h.t > 0);
      for (const r of this.rings) {
        r.t -= dt;
        this.inRange(r, r.r, e => this.damage(e, r.dps * dt, 'fire', r.src, { dot: true, fireFloor: 0.5 }));
      }
      this.rings = this.rings.filter(r => r.t > 0);
    }
  }

  PD.Game = Game;
})();
