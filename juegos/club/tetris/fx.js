/* Tetris — efectos y sonido, compartidos por Tetris Club y la sala.

   Nada de esto decide la partida: el motor (`motor.js`) ya fijó, limpió
   y subió basura antes de que llegue aquí, y la prueba del Club se rehace
   sin este archivo. Lo único que lee son los eventos del motor (`fija`
   trae las filas que se fueron con sus colores, `seco` la caída
   instantánea, `basura` las filas que suben) y el estado para pintar.

   Es barato a propósito: cada bloque es un sprite dibujado una sola vez
   por color y tamaño (un `drawImage` por celda, en vez de cinco
   rectángulos), el fondo con su rejilla se cachea por nivel, no hay
   `shadowBlur` en ningún sitio, las partículas tienen tope y el temblor
   se escribe en el `transform` solo cuando cambia. Con `prefers-reduced-
   motion` no tiembla nada y salen menos pedazos.

   El sonido no es el chip de 8 bits del resto de Juegos: el pozo es un
   instrumento. Cada columna es una nota de la pentatónica de La menor (la
   tonalidad de «Neón 84») y suena en estéreo donde está la pieza; cada
   pieza que cae es un bombo seco con un punteo que sube un paso de la
   escala si cae rápido tras la anterior (jugar deprisa toca un arpegio
   que trepa); cada limpieza es un golpe de batería con un arpegio de
   sierra a fusas sobre el acorde siguiente de La m – Fa – Do – Sol, de
   modo que una racha de líneas va armando una progresión; el combo la
   sube de octava. Lo que llega del
   rival suena a metal y a alarma, no a música. */
(function (raiz, fabrica) {
  const M = fabrica();
  if (typeof module === "object" && module.exports) module.exports = M;
  else raiz.TetrisFX = M;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const W = 10, H = 22, OC = 2, HV = H - OC, BLOQUEO_MS = 500;
  const COLOR = { I: "#2fd3e8", J: "#3b6cf6", L: "#f59a23", O: "#f5d432", S: "#46d160", T: "#b04ee8", Z: "#f0455a", G: "#6b7280" };
  const reducido = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  /* k > 0 aclara hacia el blanco, k < 0 oscurece hacia el negro. */
  const tinte = (h, k) => { const c = rgb(h).map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))); return `rgb(${c[0]},${c[1]},${c[2]})`; };
  const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const sal = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

  /* ---------- sprites ---------- */
  const sprites = new Map();
  function sprite(t, c) {
    const k = t + c;
    let sp = sprites.get(k);
    if (sp) return sp;
    sp = document.createElement("canvas");
    sp.width = sp.height = c;
    const g = sp.getContext("2d"), col = COLOR[t] || "#888", b = Math.max(1, Math.round(c * 0.11));
    if (t === "G") {
      g.fillStyle = "#3b4356"; g.fillRect(0, 0, c, c);
      g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = Math.max(1, c / 10);
      g.beginPath();
      for (let i = -c; i < c; i += c / 3) { g.moveTo(i, c); g.lineTo(i + c, 0); }
      g.stroke();
      g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, c - b, c, b); g.fillRect(c - b, 0, b, c);
      g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(0, 0, c, b);
    } else {
      const gr = g.createLinearGradient(0, 0, c, c);
      gr.addColorStop(0, tinte(col, 0.45)); gr.addColorStop(0.5, col); gr.addColorStop(1, tinte(col, -0.45));
      g.fillStyle = gr; g.fillRect(0, 0, c, c);
      /* Un cristal hundido con su reflejo: el bloque se lee como una pieza
         de vidrio y no como el ladrillo plano de antes. */
      const i = b * 2, l = c - b * 4;
      if (l > 2) {
        g.fillStyle = rgba(col, 0.5); g.fillRect(i, i, l, l);
        g.fillStyle = tinte(col, -0.25); g.globalAlpha = 0.45; g.fillRect(i, i, l, l); g.globalAlpha = 1;
        g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(i, i, l, Math.max(1, Math.round(l * 0.32)));
      }
      g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(0, 0, c, 1); g.fillRect(0, 0, 1, c);
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, c - 1, c, 1); g.fillRect(c - 1, 0, 1, c);
    }
    sprites.set(k, sp);
    return sp;
  }

  /* El fondo del pozo cambia de tono con el nivel: subir se ve, no solo se
     lee en el marcador. Una sola copia en caché (la del nivel en curso). */
  let fondoK = "", fondoC = null;
  const tonoNivel = n => (200 + (Math.max(1, n) - 1) * 23) % 360;
  function fondo(c, nivel) {
    const k = c + "|" + nivel;
    if (k === fondoK) return fondoC;
    const cv = fondoC || document.createElement("canvas");
    cv.width = W * c; cv.height = HV * c;
    const g = cv.getContext("2d"), h = tonoNivel(nivel);
    const gr = g.createLinearGradient(0, 0, 0, cv.height);
    gr.addColorStop(0, `hsl(${h},55%,9%)`); gr.addColorStop(1, `hsl(${(h + 30) % 360},45%,4%)`);
    g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = `hsla(${h},80%,70%,.07)`; g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < W; i++) { g.moveTo(i * c + 0.5, 0); g.lineTo(i * c + 0.5, cv.height); }
    for (let j = 1; j < HV; j++) { g.moveTo(0, j * c + 0.5); g.lineTo(cv.width, j * c + 0.5); }
    g.stroke();
    fondoK = k; fondoC = cv;
    return cv;
  }

  function altura(s) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (s.pozo[y * W + x]) return H - y;
    return 0;
  }

  /* ---------- efectos ---------- */
  function crearEfectos(op) {
    const TM = op.TM, c = op.celda, red = reducido(), MAXP = red ? 70 : 260;
    const parts = [], filas = [], destellos = [], estelas = [], ondas = [], rastro = [];
    let temblor = 0, tx = 0, ty = 0, tEscrito = "", reloj = 0, dtPinta = 0;
    let desp = null, despT = 0, subeN = 0, subeT = 0;
    let pulso = 0, fiebre = 0, rojo = 0, tonoFiebre = 0;
    let vx = null, vy = 0, nueva = true, ultimaT = "";
    const velo = [];
    const DESP_MS = 210, SOSTIENE = 70, SUBE_MS = 260;

    const chispa = (x, y, col, o = {}) => {
      if (parts.length >= MAXP) parts.shift();
      const a = o.ang != null ? o.ang : Math.random() * Math.PI * 2, v = (o.v || 0.2) * (0.5 + Math.random()) * c / 30;
      parts.push({ x, y, vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v + (o.vy || 0), g: (o.g == null ? 0.0016 : o.g) * c / 30,
        vida: 0, dura: (o.dura || 600) * (0.7 + Math.random() * 0.6), tam: (o.tam || 0.4) * c * (0.6 + Math.random() * 0.6),
        col, luz: !!o.luz });
    };
    const tiembla = k => { if (!red) temblor = Math.min(16, temblor + k); };

    function evento(e) {
      if (e.e === "seco") {
        const dist = e.a - e.de;
        nueva = true;
        if (dist <= 0) return;
        const cols = {};
        for (const [x, y] of e.celdas) {
          const k = cols[x] || (cols[x] = { x, y0: y - dist, y1: y });
          k.y0 = Math.min(k.y0, y - dist); k.y1 = Math.max(k.y1, y);
        }
        estelas.push({ cols: Object.values(cols), t: 0, col: COLOR[e.t] });
        for (const k of Object.values(cols)) for (let i = 0; i < 2; i++)
          chispa((k.x + 0.5) * c, (k.y1 + 1 - OC) * c, "#cfd8e6", { ang: -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v: 0.12, dura: 380, tam: 0.18, g: 0.0009 });
        tiembla(Math.min(5, 1 + dist * 0.22));
      } else if (e.e === "fija") {
        nueva = true;
        if (e.bloq) destellos.push({ celdas: e.bloq, t: 0 });
        if (e.n) limpia(e);
        else if (e.ts) { ondas.push({ x: W * c / 2, y: HV * c / 2, t: 0, dura: 420, col: COLOR.T }); pulso = 0.6; }
      } else if (e.e === "guarda") nueva = true;
      else if (e.e === "basura") {
        subeN += e.n; subeT = 0;
        tiembla(4 + Math.min(10, e.n * 1.6));
        rojo = 1;
        for (let i = 0; i < Math.min(28, 6 + e.n * 4); i++)
          chispa(Math.random() * W * c, HV * c, i % 3 ? "#ff7a3d" : "#ffd27a",
            { ang: -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v: 0.32, dura: 520, tam: 0.16, luz: true });
      } else if (e.e === "nivel") {
        pulso = 1;
        ondas.push({ x: W * c / 2, y: HV * c / 2, t: 0, dura: 700, col: `hsl(${tonoNivel(e.n)},90%,65%)`, ancho: 4 });
      }
    }

    function limpia(e) {
      const n = e.n, ys = e.filas || [], cols = e.colores || [];
      /* Las filas de arriba bajan después del destello, no de golpe:
         `desp[y]` es cuántas filas tiene que caer la que ahora está en y. */
      const quita = new Set(ys), d = new Array(H).fill(0);
      let k = 0;
      for (let y = H - 1; y >= 0; y--) { if (quita.has(y)) k++; else if (y + k < H) d[y + k] = k; }
      desp = d; despT = 0;
      const grande = n >= 4 || e.pc;
      ys.forEach((y, i) => {
        filas.push({ y: y - OC, t: 0, grande, ts: e.ts });
        const fila = cols[i] || [];
        for (let x = 0; x < W; x++) {
          const t = fila[x] || "G", cx = (x + 0.5) * c, cy = (y - OC + 0.5) * c;
          const empuje = (x - 4.5) / 4.5;
          const veces = red ? (x % 3 ? 0 : 1) : grande ? 3 : 2;
          for (let j = 0; j < veces; j++)
            chispa(cx, cy, COLOR[t] || "#888", { ang: -Math.PI / 2 + empuje * 1.1 + (Math.random() - 0.5) * 1.3, v: grande ? 0.42 : 0.3, dura: 700, tam: j ? 0.22 : 0.42 });
          if (!red && (grande || x % 2)) chispa(cx, cy, "#ffffff", { v: 0.5, dura: 300, tam: 0.12, g: 0, luz: true });
        }
      });
      pulso = Math.max(pulso, 0.35 + n * 0.15);
      tiembla(grande ? 9 : n * 1.3);
      if (grande) {
        fiebre = 1; tonoFiebre = (tonoFiebre + 97) % 360;
        const ym = ys.length ? (ys[0] + ys[ys.length - 1]) / 2 - OC + 0.5 : HV / 2;
        ondas.push({ x: W * c / 2, y: ym * c, t: 0, dura: 650, col: e.pc ? "#ffffff" : COLOR.I, ancho: 6 });
      }
      if (e.ts) ondas.push({ x: W * c / 2, y: ((ys[0] || OC) - OC + 0.5) * c, t: 0, dura: 500, col: COLOR.T, ancho: 4 });
    }

    /* Lo que te mandan antes de que suba: un golpe de aviso. */
    function amenaza(n) {
      rojo = Math.min(1.4, rojo + 0.6 + n * 0.08);
      tiembla(1.5 + Math.min(4, n * 0.5));
      if (red) return;
      for (let i = 0; i < Math.min(14, 3 + n * 2); i++)
        chispa(Math.random() * W * c, -4, i % 2 ? "#ff4d4d" : "#ff9a3d",
          { ang: Math.PI / 2 + (Math.random() - 0.5) * 0.5, v: 0.9, dura: 420, tam: 0.14, g: 0.002, luz: true });
    }

    function paso(dt) {
      reloj += dt; dtPinta += dt;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vida += dt;
        if (p.vida >= p.dura) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
      const envejece = (l, dura) => { for (let i = l.length - 1; i >= 0; i--) { l[i].t += dt; if (l[i].t >= (l[i].dura || dura)) l.splice(i, 1); } };
      envejece(filas, 420); envejece(destellos, 150); envejece(estelas, 220); envejece(ondas, 600); envejece(rastro, 90);
      if (desp) { despT += dt; if (despT >= DESP_MS) desp = null; }
      if (subeN) { subeT += dt; if (subeT >= SUBE_MS) subeN = 0; }
      const cae = k => Math.exp(-dt / k);
      temblor *= cae(70); if (temblor < 0.25) temblor = 0;
      pulso *= cae(160); fiebre *= cae(700); rojo *= cae(380);
      tx = temblor ? (Math.random() - 0.5) * temblor : 0;
      ty = temblor ? (Math.random() - 0.5) * temblor * 0.7 : 0;
    }

    /* El temblor va en el `transform` del lienzo (lo mueve el compositor,
       sin repintar), y solo se escribe cuando cambia. */
    function sacude(el) {
      if (!el) return;
      const v = temblor ? `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)` : "";
      if (v !== tEscrito) { tEscrito = v; el.style.transform = v; }
    }

    function pinta(ctx, s, o = {}) {
      const dtp = Math.min(100, dtPinta); dtPinta = 0;
      const nivel = s.nivel || 1, AW = W * c, AH = HV * c;
      ctx.drawImage(fondo(c, nivel), 0, 0);
      if (pulso > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `hsla(${tonoNivel(nivel)},90%,60%,${(pulso * 0.1).toFixed(3)})`;
        ctx.fillRect(0, 0, AW, AH);
        ctx.globalCompositeOperation = "source-over";
      }
      /* La velocidad se ve: desde el nivel 8 caen rayas por el fondo, más
         y más rápidas cuanto más rápido cae la pieza. */
      if (!s.fin && nivel >= 8 && !red) {
        const n = Math.min(26, (nivel - 7) * 2), v = (0.25 + nivel * 0.05) * c / 30;
        while (velo.length < n) velo.push({ x: Math.random() * AW, y: Math.random() * AH, l: (0.6 + Math.random() * 1.6) * c });
        velo.length = n;
        ctx.fillStyle = `hsla(${tonoNivel(nivel)},90%,75%,.09)`;
        for (const r of velo) {
          r.y += v * dtp * (1.2 + r.l / c);
          if (r.y - r.l > AH) { r.y = -Math.random() * AH * 0.3; r.x = Math.random() * AW; }
          ctx.fillRect(r.x, r.y - r.l, 1.5, r.l);
        }
      }
      /* La basura que viene: una franja roja abajo, del alto que va a subir. */
      const pend = Math.min(HV, o.pendiente || 0);
      if (pend && !s.fin) {
        const h = pend * c, lat = 0.5 + 0.5 * Math.sin(reloj * (0.008 + pend * 0.0012));
        const gr = ctx.createLinearGradient(0, AH - h, 0, AH);
        gr.addColorStop(0, `rgba(255,60,60,${(0.06 + lat * 0.08).toFixed(3)})`); gr.addColorStop(1, `rgba(255,40,40,${(0.18 + lat * 0.14).toFixed(3)})`);
        ctx.fillStyle = gr; ctx.fillRect(0, AH - h, AW, h);
        ctx.fillStyle = `rgba(255,90,80,${(0.55 + lat * 0.4).toFixed(3)})`; ctx.fillRect(0, AH - h, AW, 2);
      }
      /* La pila, con la fila que baja tras limpiar y la basura que sube. */
      const fin = s.fin;
      ctx.globalAlpha = fin ? 0.45 : 1;
      const kD = desp ? 1 - sal((despT - SOSTIENE) / (DESP_MS - SOSTIENE)) : 0;
      const kS = subeN ? subeN * (1 - sal(subeT / SUBE_MS)) : 0;
      for (let y = OC; y < H; y++) {
        const dy = (y - OC + kS - (desp ? desp[y] * kD : 0)) * c;
        if (dy >= AH || dy <= -c) continue;
        for (let x = 0; x < W; x++) {
          const t = s.pozo[y * W + x];
          if (t) ctx.drawImage(sprite(t, c), x * c, dy);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "lighter";
      for (const d of destellos) {
        ctx.fillStyle = `rgba(255,255,255,${(0.6 * (1 - d.t / 150)).toFixed(3)})`;
        for (const [x, y] of d.celdas) if (y >= OC) ctx.fillRect(x * c, (y - OC) * c, c, c);
      }
      for (const e of estelas) {
        const a = 1 - e.t / 220;
        for (const k of e.cols) {
          const y0 = Math.max(0, (k.y0 - OC) * c), y1 = (k.y1 + 1 - OC) * c;
          if (y1 <= y0) continue;
          const gr = ctx.createLinearGradient(0, y0, 0, y1);
          gr.addColorStop(0, rgba(e.col, 0)); gr.addColorStop(1, rgba(e.col, 0.55 * a));
          ctx.fillStyle = gr;
          const w = c * (0.35 + 0.65 * a);
          ctx.fillRect((k.x + 0.5) * c - w / 2, y0, w, y1 - y0);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      if (!fin && s.p) piezaYFantasma(ctx, s, dtp);
      /* Las filas que se van: un destello que se abre y se cierra en una raya. */
      if (filas.length) {
        ctx.globalCompositeOperation = "lighter";
        for (const f of filas) {
          const k = f.t / 420, a = 1 - k;
          const h = c * (k < 0.25 ? 1 : Math.max(0.08, 1 - (k - 0.25) * 1.4));
          const w = AW * (k < 0.18 ? sal(k / 0.18) : 1);
          ctx.fillStyle = f.ts ? `rgba(220,150,255,${a.toFixed(3)})` : f.grande ? `rgba(160,245,255,${a.toFixed(3)})` : `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
          ctx.fillRect((AW - w) / 2, (f.y + 0.5) * c - h / 2, w, h);
        }
        ctx.globalCompositeOperation = "source-over";
      }
      for (const p of parts) {
        const a = 1 - p.vida / p.dura, t = p.tam * (0.4 + 0.6 * a);
        if (p.luz) ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, a * 1.4);
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - t / 2, p.y - t / 2, t, t);
        if (p.luz) ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = 1;
      for (const w of ondas) {
        const k = w.t / (w.dura || 600);
        ctx.strokeStyle = w.col; ctx.globalAlpha = (1 - k) * 0.8; ctx.lineWidth = (w.ancho || 3) * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(w.x, w.y, sal(k) * AW * 0.9, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      /* Peligro: la pila cerca del techo late en rojo arriba; un ataque
         enrojece los bordes. */
      const alto = fin ? 0 : altura(s), peligro = alto >= 15 ? (alto - 14) / 6 : 0;
      if (peligro > 0) {
        const lat = 0.5 + 0.5 * Math.sin(reloj * 0.009);
        const gr = ctx.createLinearGradient(0, 0, 0, AH * 0.35);
        gr.addColorStop(0, `rgba(255,40,60,${(peligro * (0.18 + lat * 0.2)).toFixed(3)})`); gr.addColorStop(1, "rgba(255,40,60,0)");
        ctx.fillStyle = gr; ctx.fillRect(0, 0, AW, AH * 0.35);
      }
      if (rojo > 0.02) {
        const a = Math.min(1, rojo) * 0.55, m = c * 2.2;
        const borde = (x0, y0, x1, y1, x, y, w, h) => {
          const gr = ctx.createLinearGradient(x0, y0, x1, y1);
          gr.addColorStop(0, `rgba(255,30,40,${a.toFixed(3)})`); gr.addColorStop(1, "rgba(255,30,40,0)");
          ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
        };
        borde(0, 0, m, 0, 0, 0, m, AH); borde(AW, 0, AW - m, 0, AW - m, 0, m, AH); borde(0, AH, 0, AH - m, 0, AH - m, AW, m);
      }
      if (fiebre > 0.02) {
        ctx.strokeStyle = `hsla(${(tonoFiebre + reloj * 0.3) % 360},95%,65%,${(fiebre * 0.9).toFixed(3)})`;
        ctx.lineWidth = 2 + fiebre * 4;
        ctx.strokeRect(1, 1, AW - 2, AH - 2);
      }
    }

    /* La pieza se dibuja donde está, pero llega ahí deslizándose (unos
       pocos milisegundos): a velocidad alta deja de teletransportarse y se
       ve caer, con una estela cuando baja más de una fila por cuadro. */
    function piezaYFantasma(ctx, s, dtp) {
      const p = s.p, cs = TM.celdas(p);
      if (nueva || vx === null || p.t !== ultimaT) { vx = p.x; vy = Math.min(p.y, 0); nueva = false; ultimaT = p.t; rastro.length = 0; }
      if (p.y < vy) vy = p.y;
      const antes = vy;
      if (red) { vx = p.x; vy = p.y; }
      else {
        vx += (p.x - vx) * (1 - Math.exp(-dtp / 14)); if (Math.abs(p.x - vx) < 0.02) vx = p.x;
        vy += (p.y - vy) * (1 - Math.exp(-dtp / 18)); if (Math.abs(p.y - vy) < 0.02) vy = p.y;
      }
      if (vy - antes > 0.6) rastro.push({ y0: antes, y1: vy, x: vx, cs: cs.map(([x, y]) => [x - p.x, y - p.y]), t: 0, col: COLOR[p.t] });
      /* fantasma */
      const f = TM.fantasma(s), col = COLOR[f.t];
      ctx.fillStyle = rgba(col, 0.08); ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 2;
      for (const [x, y] of TM.celdas(f)) if (y >= OC) { ctx.fillRect(x * c + 1, (y - OC) * c + 1, c - 2, c - 2); ctx.strokeRect(x * c + 2, (y - OC) * c + 2, c - 4, c - 4); }
      /* estela */
      if (rastro.length) {
        ctx.globalCompositeOperation = "lighter";
        for (const r of rastro) {
          const a = (1 - r.t / 90) * 0.35;
          ctx.fillStyle = rgba(r.col, a);
          for (const [dx, dy] of r.cs) {
            const y0 = (r.y0 + dy - OC) * c, y1 = (r.y1 + dy - OC + 1) * c;
            ctx.fillRect((r.x + dx) * c + c * 0.15, Math.max(0, y0), c * 0.7, Math.max(0, y1 - Math.max(0, y0)));
          }
        }
        ctx.globalCompositeOperation = "source-over";
      }
      /* pieza: se apaga un poco mientras espera a fijarse */
      ctx.globalAlpha = 1 - Math.min(1, s.suelo / BLOQUEO_MS) * 0.35;
      const sp = sprite(p.t, c), ox = (vx - p.x) * c, oy = (vy - p.y) * c;
      for (const [x, y] of cs) if (y + (vy - p.y) >= OC - 1) ctx.drawImage(sp, x * c + ox, (y - OC) * c + oy);
      ctx.globalAlpha = 1;
    }

    return { evento, paso, pinta, sacude, amenaza, ocupado: () => parts.length > 0 || filas.length > 0 };
  }

  /* Una pieza suelta centrada en una caja (cola y reserva), con los mismos sprites. */
  function pintaPieza(ctx, TM, t, cx, cy, c, alfa) {
    if (!t) return;
    const cs = TM.celdas({ t, r: 0, x: 0, y: 0 });
    let x0 = 9, x1 = 0, y0 = 9, y1 = 0;
    for (const [x, y] of cs) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = (x1 - x0 + 1) * c, h = (y1 - y0 + 1) * c, sp = sprite(t, Math.round(c));
    ctx.globalAlpha = alfa == null ? 1 : alfa;
    for (const [x, y] of cs) ctx.drawImage(sp, Math.round(cx - w / 2 + (x - x0) * c), Math.round(cy - h / 2 + (y - y0) * c), Math.round(c), Math.round(c));
    ctx.globalAlpha = 1;
  }

  /* ---------- sonido ---------- */
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
  const DE_PIEZA = { I: 81, J: 76, L: 79, O: 74, S: 72, T: 84, Z: 77 };
  /* La m – Fa – Do – Sol: cada limpieza toca el siguiente. */
  const ACORDES = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]];

  function crearSonido(ac, destino) {
    const sal0 = ac.createGain(); sal0.gain.value = 1;
    let salida = sal0;
    try {
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      sal0.connect(comp); comp.connect(destino);
    } catch (e) { sal0.connect(destino); }
    /* El eco: una corchea a 104 (la de «Neón 84»), filtrado y poco
       realimentado, para que no emborrone el ritmo. Lo usan las
       limpiezas; las caídas van secas. */
    const envio = ac.createGain(), eco = ac.createDelay(1.5), realim = ac.createGain(), filtro = ac.createBiquadFilter(), ecoSal = ac.createGain();
    eco.delayTime.value = 0.2885; realim.gain.value = 0.22; filtro.type = "lowpass"; filtro.frequency.value = 2600; ecoSal.gain.value = 0.5;
    envio.connect(eco); eco.connect(filtro); filtro.connect(realim); realim.connect(eco); filtro.connect(ecoSal); ecoSal.connect(salida);
    const largo = ac.sampleRate;
    const bufRuido = ac.createBuffer(1, largo, ac.sampleRate), datos = bufRuido.getChannelData(0);
    for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
    const curva = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) curva[i] = Math.tanh((i / 511.5 - 1) * 3.2);

    const ahora = () => ac.currentTime + 0.006;
    const sale = (n, o) => {
      let x = n;
      if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); x.connect(p); x = p; }
      x.connect(sal0);
      if (o.eco) { const e = ac.createGain(); e.gain.value = o.eco; x.connect(e); e.connect(envio); }
    };
    const envolvente = (g, t, a, dur, vol) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    };
    function tono(o) {
      const t = o.t || ahora(), os = ac.createOscillator(), g = ac.createGain();
      os.type = o.tipo || "sine";
      os.frequency.setValueAtTime(o.f, t);
      if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || o.dur));
      if (o.det) os.detune.value = o.det;
      let n = os;
      if (o.corte) {
        const fl = ac.createBiquadFilter();
        fl.type = o.filtro || "lowpass"; fl.Q.value = o.q || 1;
        fl.frequency.setValueAtTime(o.corte, t);
        if (o.corte1) fl.frequency.exponentialRampToValueAtTime(o.corte1, t + o.dur);
        n.connect(fl); n = fl;
      }
      if (o.dist) { const ws = ac.createWaveShaper(); ws.curve = curva; n.connect(ws); n = ws; }
      n.connect(g); envolvente(g, t, o.a || 0.004, o.dur, o.vol || 0.1); sale(g, o);
      os.start(t); os.stop(t + o.dur + 0.05);
      os.onended = () => { try { g.disconnect(); } catch (e) {} };
    }
    /* Campana FM: el modulador se apaga antes que la portadora, como un
       vidrio que suena y luego queda en un seno. */
    function campana(o) {
      const t = o.t || ahora(), car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
      car.frequency.value = o.f; mod.frequency.value = o.f * (o.r || 3.01);
      mg.gain.setValueAtTime(o.f * (o.i || 2), t); mg.gain.exponentialRampToValueAtTime(Math.max(1, o.f * (o.i || 2) * 0.04), t + o.dur * 0.6);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g);
      envolvente(g, t, o.a || 0.002, o.dur, o.vol || 0.06); sale(g, o);
      car.start(t); mod.start(t); car.stop(t + o.dur + 0.05); mod.stop(t + o.dur + 0.05);
      car.onended = () => { try { g.disconnect(); mg.disconnect(); } catch (e) {} };
    }
    function ruido(o) {
      const t = o.t || ahora(), src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = bufRuido; src.loop = true;
      fl.type = o.tipo || "bandpass"; fl.Q.value = o.q || 1;
      fl.frequency.setValueAtTime(o.f || 1000, t);
      if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      src.connect(fl); fl.connect(g); envolvente(g, t, o.a || 0.002, o.dur, o.vol || 0.05); sale(g, o);
      src.start(t, Math.random() * 0.9); src.stop(t + o.dur + 0.05);
      src.onended = () => { try { g.disconnect(); } catch (e) {} };
    }
    const lado = x => Math.max(-1, Math.min(1, ((x == null ? 3 : x) + 1 - 4.5) / 4.5));
    let prog = 0, ultMueve = -1, ultGira = -1, racha = 0, ultFija = -9;
    const seguro = f => (...a) => { try { if (ac.state === "running") f(...a); } catch (e) { /* el sonido nunca para el juego */ } };
    /* El bombo y el chasquido de toda pieza que cae. Secos, sin eco y sin
       tono propio: el «bloop» de antes caía en una altura cualquiera y
       desafinaba con la música. */
    const bombo = (t, f0, dur, vol, x) => tono({ t, f: f0, f1: 42, glide: dur * 0.7, dur, vol, pan: lado(x) * 0.4 });
    const chasquido = (t, dur, vol, x, f) => ruido({ t, dur, vol, tipo: "highpass", f: f || 4500, q: 0.8, pan: lado(x) * 0.5 });
    /* La racha: cada pieza que se fija antes de RACHA_S de la anterior sube
       un paso de la pentatónica. Jugando rápido, las caídas suben solas
       como un arpegio; al parar, vuelve a empezar abajo. */
    const RACHA_S = 1.3;
    const pulsa = t => { racha = t - ultFija < RACHA_S ? Math.min(PENTA.length - 1, racha + 1) : 0; ultFija = t; return PENTA[racha]; };
    const punteo = (t, m, vol, x) => tono({ t, f: hz(m), dur: 0.07, vol, tipo: "square", corte: 3200, corte1: 900, pan: lado(x) * 0.6 });

    return {
      ctx: ac,
      mueve: seguro(x => {
        const t = ahora(); if (t - ultMueve < 0.03) return; ultMueve = t;
        const i = Math.max(0, Math.min(9, (x == null ? 3 : x) + 1));
        tono({ t, f: hz(PENTA[i] + 24), dur: 0.018, vol: 0.03, tipo: "square", corte: 5000, pan: lado(x) });
      }),
      gira: seguro((pieza, x) => {
        const t = ahora(); if (t - ultGira < 0.03) return; ultGira = t;
        const m = DE_PIEZA[pieza] || 81;
        tono({ t, f: hz(m), f1: hz(m + 7), glide: 0.035, dur: 0.05, vol: 0.045, tipo: "triangle", pan: lado(x) });
        chasquido(t, 0.012, 0.03, x, 6000);
      }),
      guarda: seguro(() => {
        const t = ahora();
        tono({ t, f: hz(69), dur: 0.045, vol: 0.045, tipo: "square", corte: 2600 });
        tono({ t: t + 0.05, f: hz(81), dur: 0.06, vol: 0.045, tipo: "square", corte: 2600 });
      }),
      /* alto: 0 (pozo vacío) a 1 (al techo): con la pila alta el golpe es
         más seco y agudo, más nervioso. */
      fija: seguro((alto, x) => {
        const t = ahora(), m = pulsa(t);
        bombo(t, 150 + alto * 40, 0.08, 0.32, x);
        chasquido(t, 0.02, 0.05 + alto * 0.03, x);
        punteo(t, m + 12, 0.04, x);
      }),
      /* La caída instantánea: un zumbido que baja en picado, bombo fuerte
         y un golpe de caja. Cuanto más lejos cayó, más fuerte. */
      seco: seguro((dist, x) => {
        const t = ahora(), k = Math.min(1, dist / 18), m = pulsa(t);
        tono({ t, f: 900 + 900 * k, f1: 110, glide: 0.055, dur: 0.07, vol: 0.05 + k * 0.03, tipo: "sawtooth", corte: 3500, pan: lado(x) * 0.5 });
        bombo(t + 0.035, 190, 0.11, 0.32 + k * 0.06, x);
        ruido({ t: t + 0.035, dur: 0.06, vol: 0.09 + k * 0.05, tipo: "bandpass", f: 1900, q: 1.2, pan: lado(x) * 0.5 });
        punteo(t + 0.035, m + 12, 0.045, x);
        punteo(t + 0.07, m + 24, 0.03, x);
      }),
      /* Las líneas: golpe de batería, un arpegio de sierra a fusas sobre el
         acorde que toca y campanas cortas encima. */
      linea: seguro((n, combo, ts, pc, b2b) => {
        const t = ahora(), acorde = ACORDES[prog++ % ACORDES.length], oct = combo >= 3 ? 24 : 12;
        const notas = acorde.slice(0, Math.min(4, n + 1)).map(m => m + oct);
        bombo(t, 170, 0.14, 0.32, 4);
        ruido({ t, dur: 0.12 + n * 0.03, vol: 0.1 + n * 0.02, tipo: "bandpass", f: 2100, q: 0.9 });
        const pasos = n >= 4 ? 12 : 3 + n * 2, paso = 0.045;
        for (let k = 0; k < pasos; k++) {
          const m = acorde[k % acorde.length] + 12 * Math.floor(k / acorde.length) + oct - 12;
          tono({ t: t + k * paso, f: hz(m), dur: paso * 1.6, vol: 0.04, tipo: "sawtooth", corte: 1800 + k * 300, corte1: 700, q: 3, pan: ((k % 4) - 1.5) / 2, eco: 0.12 });
        }
        notas.forEach((m, i) => campana({ t: t + i * 0.02, f: hz(m), r: 2, i: 2.2, dur: 0.4 + n * 0.08, vol: 0.05, pan: (i - (notas.length - 1) / 2) * 0.4, eco: 0.25 }));
        if (combo > 0) campana({ t: t + pasos * paso, f: hz(PENTA[Math.min(9, combo)] + 24), r: 3.5, i: 1, dur: 0.25, vol: 0.045, eco: 0.3 });
        if (n >= 4) {
          tono({ t, f: 88, f1: 30, glide: 0.4, dur: 0.5, vol: 0.28, dist: true });
          ruido({ t, dur: 0.6, vol: 0.06, tipo: "highpass", f: 5000, q: 0.6, eco: 0.2 });
        }
        if (ts) tono({ t, f: hz(57), f1: hz(81), glide: 0.18, dur: 0.24, vol: 0.06, tipo: "sawtooth", corte: 400, corte1: 4000, q: 9, eco: 0.25 });
        if (b2b) campana({ t: t + 0.06, f: hz(notas[0] + 12), r: 4, i: 1.2, dur: 0.4, vol: 0.035, eco: 0.3 });
        if (pc) PENTA.forEach((m, i) => campana({ t: t + 0.15 + i * 0.04, f: hz(m + 24), r: 2, i: 1.5, dur: 0.3, vol: 0.035, pan: (i - 4.5) / 4.5, eco: 0.3 }));
      }),
      nivel: seguro(() => {
        const t = ahora();
        ruido({ t, dur: 0.45, vol: 0.05, tipo: "bandpass", f: 300, f1: 5000, q: 3 });
        [0, 2, 4, 5, 7].forEach((k, i) => campana({ t: t + 0.25 + i * 0.06, f: hz(PENTA[k] + 12), r: 2, i: 1.6, dur: 0.4, vol: 0.045, eco: 0.4 }));
      }),
      inicio: seguro(() => {
        const t = ahora();
        [0, 2, 4, 7].forEach((k, i) => campana({ t: t + i * 0.07, f: hz(PENTA[k] + 12), r: 2, i: 1.8, dur: 0.35, vol: 0.05, pan: (i - 1.5) / 2, eco: 0.35 }));
      }),
      /* Te mandan basura: una sirena corta (más pitidos cuanto más grande)
         y un estruendo lejano. */
      alarma: seguro(n => {
        const t = ahora(), veces = Math.min(4, 1 + Math.floor((n || 1) / 2));
        for (let i = 0; i < veces; i++) {
          tono({ t: t + i * 0.17, f: hz(83), dur: 0.08, vol: 0.04, tipo: "square", corte: 2600 });
          tono({ t: t + i * 0.17 + 0.085, f: hz(78), dur: 0.08, vol: 0.04, tipo: "square", corte: 2600 });
        }
        tono({ t, f: 72, f1: 38, glide: 0.4, dur: 0.5, vol: 0.12, eco: 0.35 });
      }),
      /* La basura sube: metal que cruje y un golpe sordo distorsionado. */
      impacto: seguro(n => {
        const k = Math.min(1, (n || 1) / 6);
        tono({ f: 125, f1: 27, glide: 0.25, dur: 0.42, vol: 0.3, dist: true });
        campana({ f: 175, r: 1.414, i: 6, dur: 0.5 + k * 0.35, vol: 0.06 + k * 0.04, eco: 0.25 });
        ruido({ dur: 0.26 + k * 0.1, vol: 0.09 + k * 0.05, tipo: "lowpass", f: 2200, f1: 180 });
      }),
      /* Mandas basura: un disparo que sube. */
      envia: seguro(n => {
        tono({ f: 210, f1: 1900, glide: 0.16, dur: 0.22, vol: 0.045 + Math.min(8, n || 1) * 0.006, tipo: "sawtooth", corte: 700, corte1: 6500, q: 6, eco: 0.45 });
        ruido({ dur: 0.15, vol: 0.035, tipo: "highpass", f: 2500, f1: 7000, eco: 0.3 });
      }),
      latido: seguro(k => {
        const t = ahora(), v = Math.max(0.2, Math.min(1, k || 0.5));
        tono({ t, f: 64, f1: 40, glide: 0.1, dur: 0.13, vol: 0.2 * v });
        tono({ t: t + 0.17, f: 56, f1: 36, glide: 0.1, dur: 0.15, vol: 0.14 * v });
      }),
      fin: seguro(() => {
        const t = ahora();
        [69, 64, 60, 57, 52].forEach((m, i) => tono({ t: t + i * 0.14, f: hz(m), f1: hz(m - 1), dur: 0.3, vol: 0.05, tipo: "sawtooth", det: i % 2 ? 12 : -12, corte: 2400, corte1: 300, eco: 0.4 }));
        tono({ t: t + 0.7, f: 60, f1: 25, glide: 0.8, dur: 0.9, vol: 0.22, dist: true });
      }),
      record: seguro(() => {
        const t = ahora();
        [0, 2, 4, 5, 7, 9].forEach((k, i) => campana({ t: t + i * 0.07, f: hz(PENTA[k] + 12), r: 2, i: 2, dur: 0.5, vol: 0.05, pan: (i - 2.5) / 3, eco: 0.5 }));
        ACORDES[0].forEach(m => campana({ t: t + 0.5, f: hz(m + 24), r: 2, i: 2.2, dur: 1.2, vol: 0.04, eco: 0.6 }));
      })
    };
  }

  return { crearEfectos, crearSonido, pintaPieza, sprite, altura };
});
