/* Gato — tres en raya y Super Gato, escritos con tiza en una pizarra.
 *
 * El reductor (`redGato` en motor.js) decide todo; esta pantalla solo lo
 * dibuja. Tres decisiones:
 *
 * - **La tiza es un filtro, no una imagen.** Cada trazo es un `<path>`
 *   algo tembloroso (`temblor`, sembrado por la casilla, así que una X
 *   no cambia de forma al repintar) que pasa por `#gt-tiza`: ruido de
 *   turbulencia que desplaza el borde y le come grano por dentro. Sin
 *   archivos que alojar, y nítido a cualquier tamaño.
 * - **La última marca se escribe, las demás ya están.** Solo la ficha
 *   recién puesta (y la raya ganadora) lleva la animación de trazo
 *   (`pathLength="1"` + `stroke-dashoffset`); el SVG se rehace por firma,
 *   una vez por jugada, así que no se repite en cada tic.
 * - **En el Super Gato el gato al que te mandan se rodea con tiza
 *   amarilla**, y si estás libre se rodean todos los que aún admiten
 *   jugada: la regla que nadie recuerda es justo esa, y verla dibujada
 *   ahorra explicarla.
 */
import { gtLinea } from "./motor.js";
import { suena } from "./sonido.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function ultimoAutor(partida) {
  const js = (partida && partida.jugadas) || {};
  const ks = Object.keys(js).sort();
  const u = ks.length ? js[ks[ks.length - 1]] : null;
  return u ? u.uid : "";
}

/* Azar fijo por casilla: la misma X tiembla igual en cada pintada. */
function azar(sem) {
  let s = (sem * 2654435761) >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 10000) / 10000; };
}

/* Una línea de tiza: de (x1,y1) a (x2,y2) con una curva leve. */
function trazo(x1, y1, x2, y2, r, amp) {
  const mx = (x1 + x2) / 2 + (r() - .5) * amp, my = (y1 + y2) / 2 + (r() - .5) * amp;
  const j = () => (r() - .5) * amp * .5;
  return `M${(x1 + j()).toFixed(1)} ${(y1 + j()).toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${(x2 + j()).toFixed(1)} ${(y2 + j()).toFixed(1)}`;
}

/* Un círculo a mano: no cierra del todo y se pasa un poco. */
function circulo(cx, cy, rad, r) {
  const pts = [], a0 = r() * Math.PI * 2, vuelta = Math.PI * 2 * (1.06 + r() * .08);
  for (let k = 0; k <= 22; k++) {
    const a = a0 + vuelta * k / 22;
    const rr = rad * (1 + (r() - .5) * .09) * (1 + .04 * Math.sin(a * 2));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .94]);
  }
  return "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
}

const DEFS = `<defs>
  <filter id="gt-tiza" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="ruido"/>
    <feDisplacementMap in="SourceGraphic" in2="ruido" scale="3.2" result="borde"/>
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="3" result="grano"/>
    <feColorMatrix in="grano" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="mascara"/>
    <feComposite in="borde" in2="mascara" operator="in"/>
  </filter>
  <filter id="gt-polvo"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="11"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .09 -.02"/></filter>
</defs>`;

export function crearGato(ctx) {
  const { uid, jugar, terminar } = ctx;
  let host = null, muerto = false, est = null, p = null, enviando = false, vistas = -1;
  const firmas = {};

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-gato">
        <div class="jg-barra">
          <div class="jg-fase" id="gtFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-marcador" id="gtMarcador"></div>
        </div>
        <div class="jg-tablero"><div class="jg-gt-marco" id="gtTablero"></div></div>
        <div class="jg-pie" id="gtPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
  }

  function destruir() {
    muerto = true;
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  const jugadorDe = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombreDe = u => { const j = jugadorDe(u); return j ? j.nombre : "el rival"; };
  const fichaDe = u => (u === est.equis ? "x" : "o");
  const letra = f => (f === "x" ? "✗" : "○");

  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  /* Una ficha de tiza en la caja (x,y,lado). `nueva` la escribe. */
  function ficha(f, x, y, L, sem, nueva, grueso) {
    const r = azar(sem), m = L * .2, cls = "jg-gt-t jg-gt-" + f + (nueva ? " jg-gt-nueva" : "");
    const w = grueso || L * .075;
    if (f === "x") {
      return `<path class="${cls}" pathLength="1" stroke-width="${w}" d="${trazo(x + m, y + m, x + L - m, y + L - m, r, L * .08)}"/>` +
        `<path class="${cls} jg-gt-2" pathLength="1" stroke-width="${w}" d="${trazo(x + L - m, y + m, x + m, y + L - m, r, L * .08)}"/>`;
    }
    return `<path class="${cls}" pathLength="1" stroke-width="${w}" d="${circulo(x + L / 2, y + L / 2, L * .31, r)}"/>`;
  }

  /* La cuadrícula de un gato: dos y dos rayas. */
  function rejilla(x, y, L, sem, w, cls) {
    const r = azar(sem), t = L / 3, o = L * .03, out = [];
    for (const k of [1, 2]) {
      out.push(`<path class="${cls}" stroke-width="${w}" d="${trazo(x + k * t, y + o, x + k * t, y + L - o, r, L * .03)}"/>`);
      out.push(`<path class="${cls}" stroke-width="${w}" d="${trazo(x + o, y + k * t, x + L - o, y + k * t, r, L * .03)}"/>`);
    }
    return out.join("");
  }

  function rayaGanadora(l, x, y, L, sem, w) {
    if (!l) return "";
    const t = L / 3, c = i => [x + (i % 3) * t + t / 2, y + Math.floor(i / 3) * t + t / 2];
    const [a, , b] = l, [x1, y1] = c(a), [x2, y2] = c(b);
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), e = t * .38;
    return `<path class="jg-gt-t jg-gt-raya jg-gt-nueva" pathLength="1" stroke-width="${w}"
      d="${trazo(x1 - dx / d * e, y1 - dy / d * e, x2 + dx / d * e, y2 + dy / d * e, azar(sem), t * .1)}"/>`;
  }

  function tablero() {
    const sup = est.variante === "super";
    const W = 900, M = 30, L = W - 2 * M;
    const mio = est.fase === "jugando" && est.turno === uid;
    const out = [`<svg viewBox="0 0 ${W} ${W}" class="jg-svg jg-gt-svg">`, DEFS,
      `<rect width="${W}" height="${W}" class="jg-gt-pizarra"/>`,
      `<rect width="${W}" height="${W}" filter="url(#gt-polvo)"/>`,
      `<g filter="url(#gt-tiza)">`];
    if (!sup) {
      out.push(rejilla(M, M, L, 1, 9, "jg-gt-t jg-gt-reja"));
      const t = L / 3;
      for (let i = 0; i < 9; i++) {
        const x = M + (i % 3) * t, y = M + Math.floor(i / 3) * t;
        if (est.tab[i]) out.push(ficha(est.tab[i], x, y, t, i + 17, i === est.ultima, 11));
      }
      if (est.linea) out.push(rayaGanadora(est.linea, M, M, L, 99, 12));
    } else {
      const T = L / 3, pad = T * .07, l = T - 2 * pad, t = l / 3;
      out.push(rejilla(M, M, L, 1, 10, "jg-gt-t jg-gt-reja"));
      for (let g = 0; g < 9; g++) {
        const gx = M + (g % 3) * T + pad, gy = M + Math.floor(g / 3) * T + pad;
        const dueno = est.grande[g];
        const abierto = mio && !dueno && (est.forzado < 0 || est.forzado === g);
        if (abierto) out.push(`<rect class="jg-gt-t jg-gt-aqui" x="${gx - pad * .55}" y="${gy - pad * .55}" width="${l + pad * 1.1}" height="${l + pad * 1.1}" rx="14"/>`);
        else if (!mio && est.fase === "jugando" && !dueno && est.forzado === g)
          out.push(`<rect class="jg-gt-t jg-gt-aqui jg-gt-suyo" x="${gx - pad * .55}" y="${gy - pad * .55}" width="${l + pad * 1.1}" height="${l + pad * 1.1}" rx="14"/>`);
        out.push(`<g class="${dueno ? "jg-gt-cerrado" : ""}">` + rejilla(gx, gy, l, g + 3, 4.5, "jg-gt-t jg-gt-reja2"));
        for (let c = 0; c < 9; c++) {
          const i = g * 9 + c, f = est.tab[i];
          if (f) out.push(ficha(f, gx + (c % 3) * t, gy + Math.floor(c / 3) * t, t, i + 31, i === est.ultima, 5));
        }
        const sub = est.tab.slice(g * 9, g * 9 + 9);
        if (dueno === "x" || dueno === "o") out.push(rayaGanadora(gtLinea(sub), gx, gy, l, g + 50, 5));
        out.push("</g>");
        if (dueno === "x" || dueno === "o")
          out.push(ficha(dueno, gx - pad * .2, gy - pad * .2, l + pad * .4, g + 70, Math.floor(est.ultima / 9) === g, 15));
      }
      if (est.linea) out.push(rayaGanadora(est.linea, M, M, L, 99, 16));
    }
    out.push("</g>");

    /* Las zonas de clic van fuera del filtro y son casillas enteras. */
    if (mio) {
      if (!sup) {
        const t = L / 3;
        for (let i = 0; i < 9; i++) if (!est.tab[i])
          out.push(`<rect class="jg-gt-libre" data-i="${i}" x="${M + (i % 3) * t}" y="${M + Math.floor(i / 3) * t}" width="${t}" height="${t}"/>`);
      } else {
        const T = L / 3, pad = T * .07, l = T - 2 * pad, t = l / 3;
        for (let g = 0; g < 9; g++) {
          if (est.grande[g] || (est.forzado >= 0 && est.forzado !== g)) continue;
          const gx = M + (g % 3) * T + pad, gy = M + Math.floor(g / 3) * T + pad;
          for (let c = 0; c < 9; c++) if (!est.tab[g * 9 + c])
            out.push(`<rect class="jg-gt-libre" data-i="${g * 9 + c}" x="${gx + (c % 3) * t}" y="${gy + Math.floor(c / 3) * t}" width="${t}" height="${t}"/>`);
        }
      }
    }
    out.push("</svg>");
    return out.join("");
  }

  function pinta() {
    if (!host || !est) return;
    const sup = est.variante === "super";
    let fase;
    if (est.fase === "espera") fase = "Esperando a que entre el otro…";
    else if (est.fase === "fin") {
      if (est.motivo === "empate") fase = sup ? "Empate: nadie hizo raya de gatos." : "Empate: el gato se lo lleva.";
      else if (est.motivo === "abandono") fase = est.ganador === uid ? "¡Ganas! El otro se fue." : "Abandonaste la partida.";
      else fase = est.ganador === uid ? "🏆 ¡Tres en raya! Ganas." : "Pierdes: " + nombreDe(est.ganador) + " hizo raya.";
    } else if (est.turno === uid) {
      fase = `Te toca: pon tu ${letra(fichaDe(uid))}` + (sup ? (est.forzado >= 0 ? " en el gato marcado" : " en cualquier gato libre") : "");
    } else fase = `Le toca a ${nombreDe(est.turno)}`;
    set("gtFase", fase, `<span class="jg-gt-fase">${esc(fase)}</span>`);

    const marca = u => {
      const j = jugadorDe(u);
      if (!j) return "";
      const n = sup ? est.grande.filter(v => v === fichaDe(u)).length : 0;
      return `<span class="jg-m jg-gt-m${est.turno === u ? " jg-gt-turno" : ""}" style="--c:${esc(j.color || "#888")}">
        <b class="jg-gt-letra">${letra(fichaDe(u))}</b>${sup ? `<b>${n}</b>` : ""}<span translate="no">${esc(u === uid ? "tú" : j.nombre)}</span></span>`;
    };
    set("gtMarcador", [est.equis, est.circulos, est.turno, est.grande.join("")].join("/"),
      marca(est.equis) + marca(est.circulos));

    set("gtTablero", [est.variante, est.tab.join(""), est.turno, est.fase, est.forzado].join("|"), tablero());

    let pie;
    if (est.fase === "espera") pie = "Pásale el enlace de la sala a quien quieras y empezáis.";
    else if (est.fase === "fin") pie = "Partida terminada.";
    else if (sup) pie = est.forzado >= 0
      ? "La casilla en la que juegas manda al otro al gato que está en esa misma posición."
      : "Te mandaron a un gato ya decidido: puedes jugar en cualquier gato libre.";
    else pie = "Tres iguales en fila, columna o diagonal ganan.";
    set("gtPie", pie, `<span class="jg-nota">${esc(pie)}</span>`);
  }

  async function alClic(ev) {
    const r = ev.target.closest(".jg-gt-libre");
    if (!r || !est || enviando || est.fase !== "jugando" || est.turno !== uid) return;
    const i = Number(r.getAttribute("data-i"));
    enviando = true;
    try { await jugar({ t: "p", uid, i }); }
    finally { if (!muerto) enviando = false; }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    const n = Object.keys((partida && partida.jugadas) || {}).length;
    if (vistas >= 0 && n > vistas) {
      const quien = ultimoAutor(partida);
      if (est.fase === "fin" && est.ganador) suena(est.ganador === uid ? "gana" : "pierde");
      else suena(quien === uid ? "ficha" : "ficha");
    }
    vistas = n;
    pinta();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) terminar(est.ganador, est.motivo);
  }

  return { montar, actualizar, destruir };
}
