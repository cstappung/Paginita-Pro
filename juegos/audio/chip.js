/* Chip — el motor chiptune que comparten los juegos.

   Tres canales como los de una consola de 8 bits (pulso, triángulo, ruido) y
   un cuarto de arpegio, que es lo que suena a «arcade» más que ninguna otra
   cosa: un acorde que no se toca a la vez sino ciclando sus notas cada
   cuarenta y cinco milésimas, porque el chip original no tenía voces para
   tocarlo entero. Todo se sintetiza aquí: no hay archivos que servir, ni CORS,
   ni nada que esperar.

   Lo usan tres clases de página, y por eso es un UMD sin dependencias: el
   bundle de `juegos-app.js` lo importa, los documentos de `juegos/club/` y
   `juegos/worms/` lo cargan con un `<script>` (queda en `window.Chip`), y los
   tests lo ejecutan en Node (queda en `module.exports`).

   Cuatro cosas de las que depende todo lo demás:

   - **Las ondas se construyen, no se eligen.** El pulso al 12,5 % y al 25 %
     es el timbre de una consola; el `square` del navegador es solo el del
     50 %. Salen de su serie de Fourier en forma cerrada, y el triángulo de la
     transformada de la escalera de 32 peldaños del chip, que es lo que le da
     ese zumbido. Si el navegador no sabe de `PeriodicWave`, se cae a
     `square`/`triangle`: suena menos a consola, pero suena.
   - **Una canción es texto.** Cada pista es una tira de fichas —una nota
     (`E5`), un acorde (`Am`, `G7`, `Fmaj7:5`), `-` para sostener, `.` para
     callar— o, en la batería, un carácter por paso. Las pistas cortas se
     repiten dentro de su sección, así que un bajo de cuatro pasos basta para
     un compás entero.
   - **Se programa por delante, nunca en el instante.** `tick()` deja
     agendado lo que suena en las próximas dos décimas y nada más. Un
     temporizador de la página es impuntual —se duerme en una pestaña de
     fondo—, el reloj del audio no.
   - **Volver no es ponerse al día.** Si el reloj ya pasó de largo lo
     agendado (pestaña dormida, pausa), la canción sigue desde ahora en vez de
     disparar de golpe todas las notas atrasadas. */
(function (root) {
  "use strict";

  const TONOS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const ACORDES = {
    "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
    dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7], 5: [0, 7, 12], add9: [0, 4, 7, 14]
  };

  /** "C#4" → 61. Devuelve NaN si la ficha no es una nota. */
  function midi(s) {
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(s));
    if (!m) return NaN;
    return 12 * (+m[3] + 1) + TONOS[m[1].toUpperCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  }
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  /** "Am" → [57, 60, 64] (octava 4 por omisión); "G7:3" la baja una octava. */
  function acorde(s, oct) {
    const m = /^([A-G])([#b]?)([a-z0-9]*)(?::(-?\d))?$/.exec(String(s));
    if (!m || !(m[3] in ACORDES)) return null;
    const base = midi(m[1] + m[2] + (m[4] != null ? m[4] : oct != null ? oct : 4));
    return ACORDES[m[3]].map(i => base + i);
  }

  /* ---------- Ondas ---------- */

  const ARMONICOS = 48;
  const cacheOndas = typeof WeakMap === "function" ? new WeakMap() : null;

  /** Coeficientes del pulso de ciclo d en forma cerrada. */
  function coefPulso(d) {
    const re = new Float32Array(ARMONICOS + 1), im = new Float32Array(ARMONICOS + 1);
    for (let n = 1; n <= ARMONICOS; n++) {
      re[n] = 2 / (n * Math.PI) * Math.sin(2 * Math.PI * n * d);
      im[n] = 2 / (n * Math.PI) * (1 - Math.cos(2 * Math.PI * n * d));
    }
    return [re, im];
  }
  /** El triángulo del chip: 32 peldaños de 4 bits, transformados a mano. */
  function coefTriangulo() {
    const N = 32, x = [];
    for (let k = 0; k < N; k++) x.push(((k < 16 ? 15 - k : k - 16) / 7.5) - 1);
    const re = new Float32Array(17), im = new Float32Array(17);
    for (let n = 1; n <= 16; n++) {
      let a = 0, b = 0;
      for (let k = 0; k < N; k++) { a += x[k] * Math.cos(2 * Math.PI * n * k / N); b += x[k] * Math.sin(2 * Math.PI * n * k / N); }
      re[n] = 2 * a / N; im[n] = 2 * b / N;
    }
    return [re, im];
  }

  function ondas(ctx) {
    if (cacheOndas && cacheOndas.has(ctx)) return cacheOndas.get(ctx);
    const o = {};
    if (typeof ctx.createPeriodicWave === "function") {
      try {
        for (const [k, d] of [["p12", .125], ["p25", .25], ["p50", .5]]) o[k] = ctx.createPeriodicWave(...coefPulso(d));
        o.tri = ctx.createPeriodicWave(...coefTriangulo());
      } catch (e) { for (const k in o) delete o[k]; }
    }
    if (cacheOndas) cacheOndas.set(ctx, o);
    return o;
  }

  function ponOnda(ctx, osc, onda) {
    const w = ondas(ctx)[onda];
    if (w && typeof osc.setPeriodicWave === "function") osc.setPeriodicWave(w);
    else osc.type = onda === "tri" ? "triangle" : onda === "sine" ? "sine" : onda === "saw" ? "sawtooth" : "square";
  }

  /* ---------- Ruido (registro de desplazamiento del chip) ---------- */

  const cacheRuido = typeof WeakMap === "function" ? new WeakMap() : null;
  /** Dos búferes: el largo (hiss) y el corto de 93 pasos, metálico. */
  function ruidos(ctx) {
    if (cacheRuido && cacheRuido.has(ctx)) return cacheRuido.get(ctx);
    let r = null;
    if (typeof ctx.createBuffer === "function") {
      try {
        const sr = ctx.sampleRate || 44100, n = Math.floor(sr * .5);
        r = {};
        for (const [k, tap] of [["largo", 1], ["corto", 6]]) {
          const b = ctx.createBuffer(1, n, sr), a = b.getChannelData(0);
          let reg = 1, v = 1;
          const hold = Math.max(1, Math.round(sr / (k === "largo" ? 22000 : 11000)));
          for (let i = 0; i < n; i++) {
            if (i % hold === 0) {
              const bit = (reg ^ (reg >> tap)) & 1;
              reg = (reg >> 1) | (bit << 14);
              v = reg & 1 ? .8 : -.8;
            }
            a[i] = v;
          }
          r[k] = b;
        }
      } catch (e) { r = null; }
    }
    if (cacheRuido) cacheRuido.set(ctx, r);
    return r;
  }

  /* ---------- Voces sueltas (sirven a la música y a los efectos) ---------- */

  function sostiene(voces, fuente, nodos, fin) {
    if (voces) voces.add({ fuente, nodos, fin });
    fuente.onended = () => { for (const n of nodos) { try { n.disconnect(); } catch (e) {} } };
  }

  /**
   * Una nota con envolvente de chip: ataque seco, caída a `sus` y corte.
   * o = {t, f, f1?, dur, vol, onda, sus?, vib?, arp?, paso?}
   *   f1  → barrido de tono hasta f1 (efectos).
   *   vib → profundidad del vibrato retardado (0.006 ≈ un cuarto de semitono).
   *   arp → lista de frecuencias que se ciclan cada `paso` segundos.
   */
  function voz(ctx, dest, o, voces) {
    const t = o.t, dur = Math.max(.02, o.dur), vol = Math.max(.0002, o.vol);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    ponOnda(ctx, osc, o.onda || "p50");
    const fq = osc.frequency;
    fq.setValueAtTime(o.f, t);
    if (o.arp && o.arp.length > 1) {
      const paso = o.paso || .045, n = Math.min(160, Math.floor(dur / paso));
      for (let i = 1; i <= n; i++) fq.setValueAtTime(o.arp[i % o.arp.length], t + i * paso);
    } else if (o.f1) {
      fq.exponentialRampToValueAtTime(Math.max(1, o.f1), t + dur);
    } else if (o.vib && dur > .22) {
      const n = Math.min(40, Math.floor((dur - .16) / .07));
      fq.setValueAtTime(o.f, t + .16);   // la nota empieza limpia; el vibrato llega después
      for (let i = 1; i <= n; i++) fq.linearRampToValueAtTime(o.f * (1 + (i % 2 ? o.vib : -o.vib)), t + .16 + i * .07);
    }
    const sus = o.sus != null ? o.sus : .7;
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + .004);
    g.gain.linearRampToValueAtTime(vol * sus, t + Math.min(.09, dur * .5));
    g.gain.setValueAtTime(vol * sus, t + dur * .88);
    g.gain.linearRampToValueAtTime(.0001, t + dur);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + .02);
    sostiene(voces, osc, [osc, g], t + dur + .02);
    return osc;
  }

  /** Golpe de ruido. o = {t, dur, vol, corto?, tono?} (tono = playbackRate). */
  function ruido(ctx, dest, o, voces) {
    const r = ruidos(ctx);
    if (!r || typeof ctx.createBufferSource !== "function") return null;
    const s = ctx.createBufferSource(), g = ctx.createGain(), t = o.t, dur = Math.max(.01, o.dur);
    s.buffer = o.corto ? r.corto : r.largo;
    if (s.loop !== undefined) s.loop = true;
    if (o.tono && s.playbackRate) s.playbackRate.setValueAtTime(o.tono, t);
    if (o.tono1 && s.playbackRate) s.playbackRate.exponentialRampToValueAtTime(o.tono1, t + dur);
    g.gain.setValueAtTime(Math.max(.0002, o.vol), t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + .01);
    sostiene(voces, s, [s, g], t + dur + .01);
    return s;
  }

  const Sinte = {
    pulso: (ctx, dest, o, voces) => voz(ctx, dest, Object.assign({ onda: "p25", sus: .8 }, o), voces),
    triangulo: (ctx, dest, o, voces) => voz(ctx, dest, Object.assign({ onda: "tri", sus: 1 }, o), voces),
    ruido,
    bombo(ctx, dest, t, vol, voces) {
      voz(ctx, dest, { t, f: 170, f1: 42, dur: .16, vol: vol * 1.2, onda: "tri", sus: .5 }, voces);
    },
    caja(ctx, dest, t, vol, voces) {
      if (!ruido(ctx, dest, { t, dur: .13, vol: vol * .55, tono: 1.4 }, voces))
        voz(ctx, dest, { t, f: 900, f1: 300, dur: .06, vol: vol * .2, onda: "p50" }, voces);
      voz(ctx, dest, { t, f: 210, f1: 120, dur: .07, vol: vol * .5, onda: "tri", sus: .4 }, voces);
    },
    plato(ctx, dest, t, vol, dur, voces) {
      ruido(ctx, dest, { t, dur: dur || .045, vol: vol * .22, corto: true, tono: 2.2 }, voces);
    },
    tambor(ctx, dest, t, vol, agudo, voces) {
      voz(ctx, dest, { t, f: agudo ? 260 : 150, f1: agudo ? 130 : 62, dur: agudo ? .15 : .24, vol: vol, onda: "tri", sus: .5 }, voces);
    },
    platillo(ctx, dest, t, vol, voces) {
      ruido(ctx, dest, { t, dur: .7, vol: vol * .3, tono: 1.8, tono1: .9 }, voces);
    }
  };

  /* ---------- Partituras ---------- */

  /**
   * Una pista de texto → {largo, ev: [{paso, dur, v}]}.
   * tipo: "mel" (notas), "arp" (acordes), "bat" (un carácter por paso).
   */
  function pista(txt, tipo, oct) {
    if (!txt) return { largo: 0, ev: [] };
    const fichas = tipo === "bat" ? String(txt).replace(/\s+/g, "").split("") : [];
    /* `E5*4` es `E5 - - -` y `.*4` son cuatro silencios: sin eso una
       blanca ocupaba ocho fichas y la partitura no se podía leer. */
    if (tipo !== "bat") for (const f of String(txt).trim().split(/\s+/)) {
      const m = /^(.+)\*(\d+)$/.exec(f);
      if (!m) { fichas.push(f); continue; }
      fichas.push(m[1]);
      for (let i = 1; i < +m[2]; i++) fichas.push(m[1] === "." ? "." : "-");
    }
    const ev = [];
    let ult = null;
    fichas.forEach((f, i) => {
      if (f === "-") { if (ult) ult.dur++; return; }
      ult = null;
      if (f === ".") return;
      let v = null;
      if (tipo === "bat") v = f;
      else if (tipo === "arp") v = acorde(f, oct);
      else { const n = /^\d{1,3}$/.test(f) ? +f : midi(f); v = Number.isFinite(n) ? n : null; }
      if (v == null) return;
      ult = { paso: i, dur: 1, v };
      ev.push(ult);
    });
    return { largo: fichas.length, ev };
  }

  function compila(cancion) {
    const secciones = {};
    for (const [nombre, s] of Object.entries(cancion.secciones || {})) {
      const p = {
        lead: pista(s.lead, "mel"), bajo: pista(s.bajo, "mel"),
        arp: pista(s.arp, "arp", (cancion.arp && cancion.arp.oct) || 4), bat: pista(s.bat, "bat")
      };
      const largo = Math.max(1, s.pasos || 0, p.lead.largo, p.bajo.largo, p.arp.largo, p.bat.largo);
      const porPaso = {};
      for (const canal of ["lead", "bajo", "arp", "bat"]) {
        const { largo: l, ev } = p[canal];
        if (!l) continue;
        const arr = porPaso[canal] = new Array(largo).fill(null);
        for (let base = 0; base < largo; base += l)
          for (const e of ev) if (base + e.paso < largo) arr[base + e.paso] = { dur: Math.min(e.dur, largo - base - e.paso), v: e.v };
      }
      secciones[nombre] = { largo, porPaso };
    }
    const orden = String(cancion.orden || Object.keys(secciones).join(" ")).trim().split(/\s+/)
      .map(f => { const m = /^([^+-]+)([+-]\d+)?$/.exec(f); return m && secciones[m[1]] ? { s: secciones[m[1]], tr: +(m[2] || 0) } : null; })
      .filter(Boolean);
    return orden.length ? orden : [{ s: { largo: 16, porPaso: {} }, tr: 0 }];
  }

  const VOL = { lead: .16, arp: .07, bajo: .2, bat: .36 };

  /**
   * Reproductor de una canción:
   *   {bpm, swing?, lead:{onda, vol?, vib?, eco?}, bajo:{onda?, vol?},
   *    arp:{onda?, vol?, oct?, paso?}, bat:{vol?}, secciones:{A:{lead,bajo,arp,bat}}, orden:"A A+5 B"}
   * `capas` multiplica cada canal (0 lo calla sin gastar nodos), `tempo`
   * multiplica el bpm y `paso` cuenta los semicorcheas tocadas.
   */
  class Reproductor {
    constructor(ctx, destino, cancion) {
      this.ctx = ctx; this.cancion = cancion;
      this.orden = compila(cancion);
      this.capas = { lead: 1, arp: 1, bajo: 1, bat: 1 };
      this.tempo = 1; this.paso = 0; this.i = 0; this.s = 0;
      this.voces = new Set();
      this.sig = ctx.currentTime + .05;
      this.salida = ctx.createGain(); this.salida.gain.value = 1; this.salida.connect(destino);
      this.canal = {};
      for (const c of ["lead", "arp", "bajo", "bat"]) { this.canal[c] = ctx.createGain(); this.canal[c].gain.value = 1; this.canal[c].connect(this.salida); }
      const eco = cancion.lead && cancion.lead.eco;
      if (eco && typeof ctx.createDelay === "function") {
        try {
          const d = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
          d.delayTime.value = Math.min(.9, eco.t || 60 / cancion.bpm * .75);
          fb.gain.value = eco.fb != null ? eco.fb : .35; wet.gain.value = eco.mezcla != null ? eco.mezcla : .3;
          this.canal.lead.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(this.salida);
          this.eco = [d, fb, wet];
        } catch (e) { this.eco = null; }
      }
    }
    duracionPaso(k) {
      const base = 60 / (this.cancion.bpm * (this.tempo || 1)) / 4, sw = this.cancion.swing || 0;
      return base * (k % 2 ? 1 - sw : 1 + sw);
    }
    /** Agenda lo que falte hasta `margen` segundos por delante del reloj. */
    tick(margen) {
      const ctx = this.ctx, ahora = ctx.currentTime, hasta = ahora + (margen || .2);
      if (this.sig < ahora - .25) this.sig = ahora + .03;
      for (const v of this.voces) if (v.fin < ahora - .5) this.voces.delete(v);
      let n = 0;
      while (this.sig < hasta && n++ < 64) {
        const d = this.duracionPaso(this.s);
        this.toca(this.orden[this.i], this.s, Math.max(this.sig, ahora), d);
        this.sig += d; this.paso++;
        if (++this.s >= this.orden[this.i].s.largo) { this.s = 0; this.i = (this.i + 1) % this.orden.length; }
      }
    }
    toca(ent, k, t, d) {
      const c = this.cancion, pp = ent.s.porPaso, ctx = this.ctx, V = this.voces;
      const cap = x => (this.capas[x] == null ? 1 : this.capas[x]);
      const lead = pp.lead && pp.lead[k];
      if (lead && cap("lead") > 0) {
        const L = c.lead || {};
        voz(ctx, this.canal.lead, { t, f: hz(lead.v + ent.tr), dur: d * lead.dur * .95, vol: (L.vol || VOL.lead) * cap("lead"), onda: L.onda || "p25", vib: L.vib != null ? L.vib : .006, sus: .75 }, V);
      }
      const bajo = pp.bajo && pp.bajo[k];
      if (bajo && cap("bajo") > 0) {
        const B = c.bajo || {};
        voz(ctx, this.canal.bajo, { t, f: hz(bajo.v + ent.tr), dur: d * bajo.dur * .9, vol: (B.vol || VOL.bajo) * cap("bajo"), onda: B.onda || "tri", sus: 1 }, V);
      }
      const arp = pp.arp && pp.arp[k];
      if (arp && cap("arp") > 0) {
        const A = c.arp || {}, fs = arp.v.map(n => hz(n + ent.tr));
        voz(ctx, this.canal.arp, { t, f: fs[0], arp: fs, paso: A.paso || .045, dur: d * arp.dur * .96, vol: (A.vol || VOL.arp) * cap("arp"), onda: A.onda || "p12", sus: .6 }, V);
      }
      const bat = pp.bat && pp.bat[k];
      if (bat && cap("bat") > 0) {
        const vol = ((c.bat && c.bat.vol) || VOL.bat) * cap("bat"), dest = this.canal.bat;
        switch (bat.v) {
          case "k": Sinte.bombo(ctx, dest, t, vol, V); break;
          case "s": Sinte.caja(ctx, dest, t, vol, V); break;
          case "h": Sinte.plato(ctx, dest, t, vol, .04, V); break;
          case "o": Sinte.plato(ctx, dest, t, vol * 1.1, .2, V); break;
          case "x": Sinte.platillo(ctx, dest, t, vol, V); break;
          case "t": Sinte.tambor(ctx, dest, t, vol, false, V); break;
          case "T": Sinte.tambor(ctx, dest, t, vol, true, V); break;
        }
      }
    }
    /** Calla todo lo agendado, también lo que aún no ha empezado. */
    detener() {
      for (const v of this.voces) {
        try { v.fuente.stop(0); } catch (e) {}
        for (const n of v.nodos) { try { n.disconnect(); } catch (e) {} }
      }
      this.voces.clear();
      this.sig = this.ctx.currentTime + .05;
    }
    reinicia() { this.detener(); this.i = 0; this.s = 0; this.paso = 0; }
    destruir() {
      this.detener();
      for (const n of [this.salida, ...Object.values(this.canal), ...(this.eco || [])]) { try { n.disconnect(); } catch (e) {} }
    }
  }

  const Chip = { midi, hz, acorde, pista, compila, ondas, coefPulso, coefTriangulo, voz, ruido, Sinte, Reproductor };
  if (typeof module === "object" && module.exports) module.exports = Chip;
  else root.Chip = Chip;
})(typeof globalThis !== "undefined" ? globalThis : this);
