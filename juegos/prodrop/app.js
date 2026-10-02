'use strict';
/* =========================================================
   PRODROP — abridor de sobres
   ========================================================= */
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- DATOS ---------------- */
// El catálogo, las rarezas y el azar viven en motor.js (compartido con Juegos).
const M = window.ProdropMotor;
const SHINY = M.SHINY;
const TIERS = M.TIERS;
// Lo que el motor no necesita: ataques, tipo y PS de las comunes y las raras.
const VARIANTS = [
  { key: 'original', type: 'Normal', icon: '✦', hp: 60, weak: '✎',
    moves: [['Saludo cordial', 20, 'Lanza una moneda. Si sale cara, el rival queda Confundido.'], ['Reunión de pega', 50]] },
  { key: 'dibujo', type: 'Arte', icon: '✎', hp: 50, weak: '☀',
    moves: [['Trazo de Paint', 10, 'Este ataque no respeta las proporciones del rival.'], ['Garabato salvaje', 40]] },
  { key: 'anime', type: 'Titán', icon: '⚔', hp: 70, weak: '✦',
    moves: [['Mirada intensa', 20, 'Mira al rival directo a los ojos. Muy dramáticamente.'], ['Golpe titán', 50]] },
  { key: 'calvo', type: 'Brillo', icon: '☀', hp: 90, weak: '⚔',
    moves: [['Reflejo cegador', 30, 'El rival no puede atacar durante su próximo turno.'], ['Cabezazo pulido', 70]] },
  { key: 'simpson', type: 'Amarillo', icon: '◉', hp: 80, weak: '✎',
    moves: [["¡D'oh!", 30, 'Se golpea la frente. El rival se ríe tanto que pierde su próximo turno.'], ['Rosquilla glaseada', 60]] },
  { key: 'gta' }, { key: 'cyberpunk' }, { key: 'casino' }, { key: 'shiny' },
].map(v => Object.assign(v, M.VARIANTS.find(x => x.key === v.key)));
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const CARDS = M.CARDS.map(m => {
  const v = VARIANTS.find(x => x.key === m.vkey), h = hash(m.person + v.key);
  return { uid: m.uid, n: m.n, num: m.num, name: m.name, v, tier: m.tier, img: m.img,
    shiny: m.shiny, hp: (v.hp || 0) + (h % 3) * 10, retreat: 1 + (h % 3) };
});
const TOTAL = CARDS.length;
const pad = n => String(n).padStart(3, '0');
const subtitle = c => c.tier === 3 ? `Shiny ${c.shiny[0]}` : c.v.label;
// Colores dominantes de cada imagen épica/legendaria (extraídos de las imágenes)
const PAL = {"angel-abusleme-gta":["#066cf7","#ffe871","#f7461f"],"angel-abusleme-shiny":["#42f77c","#f79963"],"christian-oberli-gta":["#67abf7","#fff27b","#f73618"],"christian-oberli-shiny":["#ff7b86","#f7dd78"],"claudia-prieto-gta":["#ff4c61","#71efff","#ff6300"],"claudia-prieto-shiny":["#f72000","#ffb90c"],"cristian-garces-gta":["#59d7ff","#f72a0f","#ffdb53"],"cristian-garces-shiny":["#64bcf7","#f774a5"],"cristian-tejos-gta":["#77d9ff","#f76203","#7183f7"],"cristian-tejos-shiny":["#f7cd00","#6fa3f7","#f7483c"],"david-watts-gta":["#74ddff","#ffdf6b","#f74134"],"david-watts-shiny":["#f77300"],"felipe-nunez-gta":["#6eb0f7","#ffde7c","#f76183"],"felipe-nunez-shiny":["#09ecf7","#f720d2","#205cf7"],"felix-rojasv2-gta":["#6ad4ff","#6a87f7","#f7d263"],"felix-rojasv2-shiny":["#9e4bf7","#f76177","#f76fde"],"javier-pereda-torres-gta":["#46daff","#5e8ef7","#ffde65"],"javier-pereda-torres-shiny":["#114bf7","#8720f7","#ff5e58"],"marilyn-cruces-gta":["#00e7ff","#ff8900","#ebf765"],"marilyn-cruces-shiny":["#00bbf7","#f72514","#6990f7"],"mario-gac-gta":["#3be0ff","#f7da5c","#f75344"],"mario-gac-shiny":["#f7695b"],"miguel-gutierrez-gta":["#ffdf72","#f75c4f"],"miguel-gutierrez-shiny":["#f70075","#3102f7","#15f700"],"pablo-irarrazaval-gta":["#64a4f7","#ffdf6a","#f72518"],"pablo-irarrazaval-shiny":["#75f700","#00c3f7","#f7cb17"],"rene-botnar-gta":["#58a4f7","#ffdb5d","#f73c2b"],"rene-botnar-shiny":["#f76c00","#f7000c"],"rodrigo-cadiz-gta":["#57e1ff","#ffde65","#f7311d"],"rodrigo-cadiz-shiny":["#00c7f7","#3e79f7","#00f78f"],"rolando-dunner-gta":["#57a5f7","#f7d157","#f76274"],"rolando-dunner-shiny":["#ff798b","#f7d44e"],"tito-arevalo-gta":["#f7425a","#ffdd60","#85d7ff"],"tito-arevalo-shiny":["#f83c44","#85ffeb"],"angel-abusleme-casino":["#f78347"],"christian-oberli-casino":["#f7875e","#f741c5"],"claudia-prieto-casino":["#f79c63"],"cristian-garces-casino":["#f79463"],"cristian-tejos-casino":["#f79863","#3780f7"],"david-watts-casino":["#f79960"],"felipe-nunez-casino":["#f77644"],"felix-rojasv2-casino":["#f79763","#f752bb"],"javier-pereda-torres-casino":["#f7915d"],"marilyn-cruces-casino":["#f78351"],"mario-gac-casino":["#f76d29"],"miguel-gutierrez-casino":["#46b5f7","#c356f7","#f78163"],"pablo-irarrazaval-casino":["#f79657"],"rene-botnar-casino":["#f79863","#5495f7"],"rodrigo-cadiz-casino":["#f79a63"],"rolando-dunner-casino":["#f79a56"],"tito-arevalo-casino":["#f78d5e"],"angel-abusleme-cyberpunk":["#4d92f7","#f78563"],"christian-oberli-cyberpunk":["#f78852","#5dd2f7"],"claudia-prieto-cyberpunk":["#f78663","#f763d2","#8a63f7"],"cristian-garces-cyberpunk":["#f79063","#7cf763"],"cristian-tejos-cyberpunk":["#f79063","#6397f7","#63f7eb"],"david-watts-cyberpunk":["#f79963"],"felipe-nunez-cyberpunk":["#f77c5f"],"felix-rojasv2-cyberpunk":["#f78d5d","#4dd1f7"],"javier-pereda-torres-cyberpunk":["#f78e5a","#6394f7"],"marilyn-cruces-cyberpunk":["#f77d63","#639bf7"],"mario-gac-cyberpunk":["#f79d5b"],"miguel-gutierrez-cyberpunk":["#f78963","#c158f7","#e7f74f"],"pablo-irarrazaval-cyberpunk":["#f79163","#63d8f7"],"rene-botnar-cyberpunk":["#f78263","#63bef7"],"rodrigo-cadiz-cyberpunk":["#f7885c","#cd5bf7"],"rolando-dunner-cyberpunk":["#637af7"],"tito-arevalo-cyberpunk":["#f77a63","#c263f7"]};
const paletteOf = c => {
  const p = [...(PAL[c.uid] || [])], a = accentOf(c);
  if (!p.length) p.push(a);
  if (p.length < 2) p.push(c.tier === 3 ? a : '#c26bff');
  if (p.length < 3) p.push('#ffffff');
  return p;
};
const accentOf = c => c.tier === 3 ? c.shiny[1] : c.tier === 2 ? '#d49bff' : TIERS[c.tier].color;

/* ---------------- ESTADO DE LA CARTA (nota oculta 1..10) ----------------
   Cada carta sale con una nota que no se muestra: solo se nota por el desgaste
   (bordes blanqueados, esquinas gastadas, rayas, manchas, pliegues). Al graduarla
   se encapsula y recién ahí aparece la nota en la etiqueta. */
// la campana (GRADE_W) y las palabras de la nota son del motor: la nota ya viene decidida en el sobre
const GRADE_WORD = M.GRADE_WORD;
const gradeColor = M.colorNota;
// aleatorio con semilla, para que una misma copia se vea igual en todas partes
const mulberry = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function wearHTML(c) {
  const g = c.grade || 10;
  if (g >= 10) return '';
  const R = mulberry(c.wseed || 1), r = (a, b) => a + R() * (b - a), f = n => n.toFixed(2);
  // intensidad por nota: 4–6 solo rasguños y esquinas peladas, daño fuerte solo en 1–3
  const s = [0, .9, .78, .64, .3, .22, .16, .12, .08, .04][g], heavy = g <= 3, W = 100, H = 140, mul = [], scr = [];
  const curve = (x1, y1, x2, y2, bend) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
    return `M${f(x1)} ${f(y1)}Q${f(x1 + dx / 2 - dy / l * bend)} ${f(y1 + dy / 2 + dx / l * bend)} ${f(x2)} ${f(y2)}`;
  };
  // mugre y superficie opaca
  if (g <= 8) mul.push(`<rect width="100" height="140" filter="url(#wGrime${R() * 4 | 0})" opacity="${f(heavy ? .08 + s ** 1.5 * .65 : .05 + s * .22)}"/>`);
  if (heavy) scr.push(`<rect width="100" height="140" filter="url(#wHaze)" opacity="${f(s * .5)}"/>`);
  // manchas de agua / café
  if (g <= 3) for (let i = 0; i < (g <= 2 ? 2 : 1); i++) {
    const x = r(15, 85), y = r(20, 120), rr = r(6, 15);
    mul.push(`<g filter="url(#wBlob)"><circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="#a97b30" opacity="${f(r(.18, .3))}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="none" stroke="#6b4512" stroke-width="${f(r(.6, 1.2))}" opacity=".4"/></g>`);
  }
  // línea de impresión
  if (g <= 7 && g >= 4 && R() < .35) { const x = r(10, 90); scr.push(`<path d="M${f(x)} 0V140" stroke="#fff" stroke-width=".22" opacity=".35"/>`); }
  // rayas finas en la superficie
  const nS = heavy ? Math.round(s ** 1.4 * 16 + 1) : [0, 0, 0, 0, 6, 5, 3, 2, 1, 1][g];
  for (let i = 0; i < nS; i++) {
    // 1–3: rayas curvas con ondulaciones; 4–9: rasguños rectos, cortos y finos
    const x = r(5, 95), y = r(5, 135), a = r(0, 6.28), l = heavy ? r(6, 38) * (.5 + s) : r(3, 12), d = curve(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, heavy ? r(-4, 4) : 0);
    scr.push(`<path d="${d}" fill="none" stroke="#fff" stroke-width="${f(heavy ? r(.12, .4) : r(.1, .25))}" stroke-linecap="round" opacity="${f(r(.3, .75))}"/>`);
    if (heavy && R() < .4) for (let j = 1; j < 4; j++)
      scr.push(`<path d="${d}" transform="translate(${f(j * .7 * Math.sin(a))} ${f(-j * .7 * Math.cos(a))})" fill="none" stroke="#fff" stroke-width=".1" opacity=".35"/>`);
  }
  // pliegues: sombra + brillo + tinta quebrada
  const creases = [];
  if (g <= 3) for (let i = 0; i < 4 - g; i++) {
    const side = R() * 4 | 0, p = [[r(10, 90), 0], [W, r(10, 130)], [r(10, 90), H], [0, r(10, 130)]];
    creases.push([...p[side], ...p[(side + 1 + (R() * 3 | 0)) % 4]]);
  }
  creases.forEach(([x1, y1, x2, y2]) => {
    const d = curve(x1, y1, x2, y2, r(-5, 5)), dash = Array.from({ length: 10 }, () => f(r(.4, 4))).join(' ');
    mul.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="1.8" opacity=".4" filter="url(#wSoft)"/>`);
    scr.push(`<path d="${d}" transform="translate(.45 .3)" fill="none" stroke="#fff" stroke-width=".35" opacity=".6"/>`,
      `<path d="${d}" fill="none" stroke="#fffdf4" stroke-width=".5" stroke-dasharray="${dash}" opacity=".9"/>`);
  });
  // bordes blanqueados
  const nE = Math.round(s ** 1.3 * 90 + 3);
  for (let i = 0; i < nE; i++) {
    const side = R() * 4 | 0, t = r(.05, .95), d = r(0, 1.1) * (.5 + s), len = r(.4, 2.2) * (.4 + s), th = r(.25, .8) * (.5 + s * .8);
    const [x, y, rx, ry] = side < 2 ? [t * W, side ? H - d : d, len, th] : [side === 2 ? d : W - d, t * H, th, len];
    scr.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#fffdf2" opacity="${f(r(.45, .95))}"/>`);
  }
  if (g <= 7) {
    const dash = Array.from({ length: 14 }, () => f(r(.5, 7))).join(' ');
    scr.push(`<rect x=".3" y=".3" width="99.4" height="139.4" rx="4.4" fill="none" stroke="#fffaf0" stroke-width="${f(.3 + s * 1.2)}" stroke-dasharray="${dash}" opacity="${f(s * .75)}"/>`);
  }
  // esquinas gastadas
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([cx0, cy0]) => {
    if (R() > (heavy ? .2 + s : .25 + s * 2)) return;
    const k = r(.4, 1) * (1 + s * 4), x = cx0 ? W - 1.35 : 1.35, y = cy0 ? H - 1.35 : 1.35;
    scr.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(k)}" fill="#fff8e6" opacity="${f(r(.6, .95))}" filter="url(#wSoft)"/>`);
    for (let j = 0; j < 2 + s * 6; j++) {
      const a = r(0, 6.28), l = k * r(.6, 1.6);
      scr.push(`<path d="M${f(x)} ${f(y)}l${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}" stroke="#fff" stroke-width=".25" opacity=".7"/>`);
    }
  });
  const svg = (cls, body) => `<svg class="wear${cls}" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
  return (mul.length ? svg(' mul', mul.join('')) : '') + svg('', scr.join(''));
}
// impresión descentrada (solo cartas con marco)
function offCenter(c) {
  const g = c.grade || 10; if (g >= 9) return '';
  const R = mulberry((c.wseed || 1) + 7), s = (10 - g) / 9;
  return ` style="--ox:${((R() * 2 - 1) * s * 1.6).toFixed(2)}cqw;--oy:${((R() * 2 - 1) * s * 1.4).toFixed(2)}cqw"`;
}

/* ---------------- CUENTA Y COLECCIÓN ----------------
   La colección no vive en este navegador: llega desde Juegos, ya resuelta
   por la economía (sobres válidos, más lo comprado en el mercado o
   recibido en un intercambio, menos lo vendido o cambiado). Cada copia se
   rehace con el motor desde su sobre: `key` = `<origen>~<sobre>.<i>`. */
const cuenta = { uid: '', saldo: 0, parada: false, falta: 0, mias: [], sobres: {}, gratis: 0, ofertas: [], ventas: [], cambios: [],
  jugadores: {}, gente: {}, exh: [], listo: false, desfase: 0 };
let col = {}, copies = {}, abriendo = '';   // el sobre en curso no entra a la colección hasta el resumen
const ahora = () => Date.now() + cuenta.desfase;
// una copia que llega de Juegos ({c, o, k, i, at, gr}) con su nota y su desgaste
function copiaDe(x) {
  const so = M.sobre(x.o, x.k, x.at), c = so.cartas[x.i];
  return { id: c.id, g: c.g, s: c.w, gr: x.gr ? 1 : 0, o: x.o, k: x.k, i: x.i, at: x.at, key: x.c || `${x.o}~${x.k}.${x.i}`, venta: x.venta || '', dios: so.dios };
}
function rehazColeccion() {
  col = {}; copies = {};
  for (const x of cuenta.mias) {
    if (x.o === cuenta.uid && x.k === abriendo) continue;
    const cp = copiaDe(x), uid = M.CARDS[cp.id].uid;
    col[uid] = (col[uid] || 0) + 1;
    (copies[uid] = copies[uid] || []).push(cp);
  }
}
const ownedCount = () => CARDS.filter(c => col[c.uid]).length;
const gradedCount = () => Object.values(copies).flat().filter(cp => cp.gr).length;
const mismaCopia = (a, b) => !!(a && b && a.key === b.key);
function record(c) { c._rec = true; }
// copia instanciada como carta
const fromCopy = (base, cp) => ({ ...base, grade: cp.g, wseed: cp.s, graded: !!cp.gr, _copy: cp, _rec: true });
// la mejor graduada; si no hay, la última sin graduar
function bestCopy(uid) {
  const l = copies[uid] || [], gr = l.filter(cp => cp.gr).sort((a, b) => b.g - a.g);
  return gr[0] || l[l.length - 1];
}
function updateColCount() { $('#colCount').textContent = `${ownedCount()}/${TOTAL}`; }

/* ---------------- RENDER DE CARTAS ---------------- */
const backHTML = () => `<div class="face back"><div class="bk"><div class="bk-ring">✳</div><b>PRODROP</b></div></div>`;

function frontHTML(c, lazy) {
  const t = TIERS[c.tier], v = c.v, no = `${pad(c.num)}/${TOTAL}`, ld = lazy ? ' loading="lazy"' : '';
  const alt = `${c.name} — ${subtitle(c)}`;
  if (c.tier >= 2) {
    return `<div class="face front full ${t.key}" style="--accent:${accentOf(c)}">
      <img src="${c.img}" alt="${alt}" draggable="false"${ld}>
      <div class="holo"><img src="${c.img}" alt="" draggable="false"${ld}></div>
      <div class="glitter"></div><div class="sweep"></div><div class="glare"></div>
      <div class="fa-name"><b>${c.name}</b><span>${subtitle(c)} · ${no} ${t.sym}</span></div>
      ${wearHTML(c)}
    </div>`;
  }
  const [m1, m2] = v.moves, nrg = `<i class="nrg">${v.icon}</i>`;
  return `<div class="face front framed ${t.key} v-${v.key}">
    ${c.tier === 1 ? `<img class="fr-bg" src="${c.img}" alt="" draggable="false"${ld}><i class="fr-glass"></i>` : ''}
    <div class="fr-in"${offCenter(c)}>
      <div class="fr-head">
        <span class="fr-stage">BÁSICO</span>
        <b class="fr-name${c.name.length > 15 ? ' long' : ''}">${c.name}</b>
        <span class="fr-hp"><small>PS</small>${c.hp}</span><i class="nrg big">${v.icon}</i>
      </div>
      <div class="fr-art"><div class="win"><img src="${c.img}" alt="${alt}" draggable="false"${ld}><div class="holo"></div></div></div>
      <div class="fr-strip">${v.label} · Tipo ${v.type} · N.º ${pad(c.num)}</div>
      <div class="fr-moves">
        <div class="mv"><span class="cost">${nrg}</span><b>${m1[0]}</b><span class="dmg">${m1[1]}</span></div>
        <p class="mv-txt">${m1[2]}</p>
        <div class="mv"><span class="cost">${nrg}${nrg}<i class="nrg n">✳</i></span><b>${m2[0]}</b><span class="dmg">${m2[1]}</span></div>
      </div>
      <div class="fr-stats"><span>debilidad<b>${v.weak}×2</b></span><span>resistencia<b>—</b></span><span>retirada<b>${'●'.repeat(c.retreat)}</b></span></div>
      <div class="fr-foot"><span>Ilus. PRODROP Studio</span><span>${no}<b class="rar">${t.sym}</b></span></div>
    </div>
    <div class="glare"></div>
    ${wearHTML(c)}
  </div>`;
}

// caja plástica de graduación (oculta hasta que la carta se gradúa)
function slabHTML(c) {
  const g = c.graded ? c.grade : 0;
  return {
    back: `<div class="slab-back"></div>`,
    front: `<div class="slab-label${g ? ` g${g}` : ''}" style="--gc:${g ? gradeColor(g) : '#fff'}">
      <div class="sl-l"><small>PRODROP GRADING</small><b>${c.name}</b><span>S01 · #${pad(c.num)} · ${subtitle(c)}</span><i class="sl-code"></i></div>
      <div class="sl-r"><span class="g-word">${g ? GRADE_WORD[g] : ''}</span><b class="g-num">${g || ''}</b></div>
    </div><div class="slab-front"></div>`,
  };
}

// Aura detrás de la carta: un resplandor + anillo en CSS; el fuego/humo/estrellas van en un canvas (Aura)
function auraFxHTML(c) {
  return c.tier < 2 ? '' : `<div class="aura-fx"><div class="af-glow"></div><div class="af-ring"></div></div>`;
}

function makeCard(c, { down = false, back = true, lazy = false } = {}) {
  const el = document.createElement('div');
  el.className = `card t${c.tier}${c.graded ? ' slabbed' : ''}`;
  el.style.setProperty('--accent', accentOf(c));
  if (c.tier >= 2) paletteOf(c).forEach((col, i) => el.style.setProperty(`--c${i + 1}`, col));
  if (c.grade && c.grade < 6) { el.classList.add('faded'); el.style.setProperty('--fade', (c.grade <= 3 ? .25 + (3 - c.grade) * .3 : (6 - c.grade) * .06).toFixed(2)); }
  const sl = c.grade ? slabHTML(c) : { back: '', front: '' };
  el.innerHTML = `${auraFxHTML(c)}<div class="tilt">${sl.back}<div class="flip${down ? ' down' : ''}">${back ? backHTML() : ''}${frontHTML(c, lazy)}</div>${sl.front}</div>`;
  el.card = c;
  return el;
}

/* ---------------- AURA DE PARTÍCULAS (épicas y legendarias) ----------------
   Cada carta revelada de rareza alta lleva un canvas detrás, más grande que ella.
   Legendaria: lenguas de fuego (partículas aditivas que suben), humo de color, brasas y destellos.
   Épica: motas de luz suaves y destellos. Los colores salen de la paleta de la imagen. */
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.random() * arr.length | 0];
const Aura = {
  cards: new Set(), sprites: new Map(), raf: 0, last: 0,
  cfg: {
    3: { flame: 170, smoke: 8, ember: 26, star: 5, burst: 110 },
    2: { mote: 14, star: 5, burst: 30 },
  },
  sprite(col, kind) {
    const key = kind + col;
    if (this.sprites.has(key)) return this.sprites.get(key);
    const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'), m = S / 2, gr = g.createRadialGradient(m, m, 0, m, m, m);
    if (kind === 'hot') { gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.22, rgba(col, .8)); gr.addColorStop(.55, rgba(col, .22)); gr.addColorStop(1, rgba(col, 0)); }
    else if (kind === 'soft') { gr.addColorStop(0, rgba(col, .55)); gr.addColorStop(.45, rgba(col, .22)); gr.addColorStop(1, rgba(col, 0)); }
    else { gr.addColorStop(0, '#fff'); gr.addColorStop(.1, rgba(col, .9)); gr.addColorStop(.32, rgba(col, .18)); gr.addColorStop(1, rgba(col, 0)); }
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    if (kind === 'star') { // destello de 4 puntas
      g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,.95)';
      g.beginPath(); g.moveTo(m, 0); g.lineTo(m + 1.6, m); g.lineTo(m, S); g.lineTo(m - 1.6, m); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, m); g.lineTo(m, m - 1.6); g.lineTo(S, m); g.lineTo(m, m + 1.6); g.closePath(); g.fill();
    }
    this.sprites.set(key, cv); return cv;
  },
  attach(el) {
    if (REDUCED || el._aura || el.card.tier < 2) return;
    const fx = el.querySelector('.aura-fx'); if (!fx) return;
    const cv = document.createElement('canvas'); cv.className = 'af-canvas'; fx.prepend(cv);
    el._aura = { cv, ctx: cv.getContext('2d'), parts: [], w: 0, h: 0, acc: {}, pal: paletteOf(el.card), tier: el.card.tier, fresh: true };
    this.cards.add(el);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.step(t)); }
  },
  resize(a, w, h) {
    const d = Math.min(2, devicePixelRatio || 1);
    a.w = w; a.h = h; a.px = w * .62; a.pt = w * .95; a.pb = w * .3;
    a.W = w + a.px * 2; a.H = h + a.pt + a.pb;
    Object.assign(a.cv.style, { left: `${-a.px}px`, top: `${-a.pt}px`, width: `${a.W}px`, height: `${a.H}px` });
    a.cv.width = a.W * d | 0; a.cv.height = a.H * d | 0; a.ctx.setTransform(d, 0, 0, d, 0, 0);
    a.parts.length = 0;
  },
  // punto en el borde de la carta (algo hacia adentro, para que la partícula "salga" de detrás)
  edge(a, wSide, wTop, wBot) {
    const r = Math.random() * (wSide * 2 + wTop + wBot), w = a.w, h = a.h, x0 = a.px, y0 = a.pt, ins = w * .07;
    if (r < wSide) return { x: x0 + ins, y: y0 + rnd(.04, 1) * h, nx: -1, ny: 0 };
    if (r < wSide * 2) return { x: x0 + w - ins, y: y0 + rnd(.04, 1) * h, nx: 1, ny: 0 };
    if (r < wSide * 2 + wTop) return { x: x0 + rnd(.05, .95) * w, y: y0 + ins, nx: 0, ny: -1 };
    return { x: x0 + rnd(.1, .9) * w, y: y0 + h - ins, nx: 0, ny: 1 };
  },
  spawn(a, kind, k) {
    const pal = a.pal, w = a.w, P = { kind, age: 0, seed: Math.random() * 99, rot: rnd(0, 6.28) };
    if (kind === 'flame') {
      const e = this.edge(a, 1, .55, .12), out = rnd(20, 75) * k;
      Object.assign(P, { x: e.x, y: e.y, vx: e.nx * out + rnd(-12, 12) * k, vy: -rnd(55, 140) * k + e.ny * out * .6,
        life: rnd(.75, 1.55), r0: w * rnd(.06, .1), r1: w * rnd(.2, .36), a: rnd(.38, .62),
        spr: this.sprite(pick(pal), Math.random() < .35 ? 'hot' : 'soft'), op: 'lighter' });
    } else if (kind === 'smoke') {
      const e = this.edge(a, 1, 1.2, 0);
      Object.assign(P, { x: e.x + e.nx * w * .15, y: e.y - w * rnd(0, .2), vx: e.nx * rnd(6, 20) * k, vy: -rnd(18, 40) * k,
        life: rnd(2.6, 4.2), r0: w * rnd(.22, .32), r1: w * rnd(.5, .75), a: rnd(.1, .17),
        spr: this.sprite(pal[1] || pal[0], 'soft'), op: 'screen' });
    } else if (kind === 'ember') {
      const e = this.edge(a, 1, .35, 0);
      Object.assign(P, { x: e.x + e.nx * w * .06, y: e.y, vx: e.nx * rnd(10, 45) * k, vy: -rnd(110, 230) * k,
        life: rnd(.8, 1.6), r0: w * rnd(.025, .04), r1: w * .012, a: 1,
        spr: this.sprite(pick(pal), 'hot'), op: 'lighter' });
    } else if (kind === 'mote') {
      const e = this.edge(a, 1, .5, .2);
      Object.assign(P, { x: e.x + e.nx * w * .1, y: e.y, vx: e.nx * rnd(8, 26) * k, vy: -rnd(18, 50) * k,
        life: rnd(1.4, 2.6), r0: w * rnd(.03, .05), r1: w * rnd(.05, .09), a: rnd(.5, .85),
        spr: this.sprite(pick(pal), 'hot'), op: 'lighter' });
    } else { // star: aparece alrededor de la carta, titila y se va
      const e = this.edge(a, 1, .7, .12), d = w * (e.ny > 0 ? rnd(.04, .14) : rnd(.08, .4));
      Object.assign(P, { x: e.x + e.nx * d + (e.ny ? 0 : rnd(-8, 8)), y: e.y + e.ny * d, vx: 0, vy: -rnd(4, 14) * k,
        life: rnd(.5, 1.1), r0: w * rnd(.045, .1), r1: 0, a: 1,
        spr: this.sprite(Math.random() < .5 ? '#ffffff' : pick(pal), 'star'), op: 'lighter', twinkle: true });
    }
    a.parts.push(P);
  },
  step(now) {
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    for (const el of this.cards) {
      const a = el._aura;
      if (!el.isConnected) { this.cards.delete(el); el._aura = null; continue; }
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !el.classList.contains('lit')) continue;           // oculto (overlay cerrado, etc.)
      if (w !== a.w || h !== a.h) this.resize(a, w, h);
      const k = w / 300, cfg = this.cfg[a.tier];
      if (a.fresh) { a.fresh = false; for (let i = 0; i < cfg.burst; i++) this.spawn(a, a.tier === 3 ? 'flame' : 'mote', k * 1.6); }
      for (const kind in cfg) {
        if (kind === 'burst') continue;
        a.acc[kind] = (a.acc[kind] || 0) + cfg[kind] * dt * Math.max(.45, k);
        while (a.acc[kind] >= 1) { a.acc[kind]--; this.spawn(a, kind, k); }
      }
      const g = a.ctx; g.clearRect(0, 0, a.W, a.H);
      const t = now / 1000;
      // humo primero (debajo), luego lo aditivo
      for (const pass of ['screen', 'lighter']) {
        g.globalCompositeOperation = pass;
        for (const p of a.parts) {
          if (p.op !== pass) continue;
          const u = p.age / p.life;
          let alpha, r;
          if (p.twinkle) { const s = Math.sin(Math.PI * u); alpha = s; r = p.r0 * (.35 + .65 * s); }
          else { alpha = p.a * (u < .18 ? u / .18 : (1 - u) / .82) ** 1.3; r = p.r0 + (p.r1 - p.r0) * u; }
          // se apagan suavemente cerca del borde del canvas: nunca se ve un corte
          const m = Math.min(p.x, a.W - p.x, p.y * .7, a.H - p.y) / (a.w * .3);
          if (m < 1) alpha *= Math.max(0, m) ** 2;
          if (alpha <= .002 || r <= .3) continue;
          g.globalAlpha = Math.min(1, alpha);
          if (p.twinkle) {
            g.save(); g.translate(p.x, p.y); g.rotate(p.rot + u * .6); g.drawImage(p.spr, -r, -r, r * 2, r * 2); g.restore();
          } else if (p.kind === 'flame') { // lenguas: más altas que anchas, y se estiran al subir
            const st = 1.25 + u * .9;
            g.drawImage(p.spr, p.x - r * .8, p.y - r * st * .75, r * 1.6, r * st * 2);
          } else g.drawImage(p.spr, p.x - r, p.y - r, r * 2, r * 2);
        }
      }
      g.globalAlpha = 1;
      // física
      for (let i = a.parts.length - 1; i >= 0; i--) {
        const p = a.parts[i];
        p.age += dt;
        if (p.age >= p.life) { a.parts.splice(i, 1); continue; }
        if (p.kind === 'flame' || p.kind === 'ember' || p.kind === 'smoke') {
          p.vx += Math.sin(t * 3.1 + p.seed + p.y * .035) * 90 * k * dt;   // turbulencia
          p.vx *= 1 - 1.4 * dt;
          if (p.kind === 'flame') p.vy -= 40 * k * dt;                         // el calor acelera hacia arriba
        } else if (p.kind === 'mote') p.vx += Math.sin(t * 1.7 + p.seed) * 14 * k * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    this.raf = this.cards.size ? requestAnimationFrame(t => this.step(t)) : 0;
  },
};
const light = el => { el.classList.add('lit'); Aura.attach(el); };

/* ---------------- SONIDO (sintetizado) ---------------- */
const Snd = {
  on: true, ctx: null, master: null, wet: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
    try {
      const a = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = a.createGain(); this.master.gain.value = .7; this.master.connect(a.destination);
      // pequeño eco para los brillos
      const d = a.createDelay(), fb = a.createGain(), lp = a.createBiquadFilter();
      d.delayTime.value = .17; fb.gain.value = .33; lp.frequency.value = 3800;
      this.wet = a.createGain(); this.wet.gain.value = .4;
      this.wet.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);
      return a;
    } catch { return null; }
  },
  tone(f, { t = 0, d = .4, v = .1, type = 'sine', to = null, wet = 0 } = {}) {
    if (!this.on) return; const a = this.init(); if (!a) return;
    const n = a.currentTime + t, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, n);
    if (to) o.frequency.exponentialRampToValueAtTime(to, n + d);
    g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(v, n + .012); g.gain.exponentialRampToValueAtTime(.0001, n + d);
    o.connect(g); g.connect(this.master);
    if (wet) { const s = a.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.wet); }
    o.start(n); o.stop(n + d + .05);
  },
  noise({ t = 0, d = .2, v = .1, f = 2000, q = 1, type = 'bandpass', to = null } = {}) {
    if (!this.on) return; const a = this.init(); if (!a) return;
    const n = a.currentTime + t, len = Math.ceil(a.sampleRate * d), b = a.createBuffer(1, len, a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    src.buffer = b; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, n);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, n + d);
    g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(v, n + .01); g.gain.exponentialRampToValueAtTime(.0001, n + d);
    src.connect(fl); fl.connect(g); g.connect(this.master); src.start(n);
  },
  tick() { this.noise({ d: .03, v: .07, f: 2500 + Math.random() * 3500, q: 2.5 }); },
  rip() {
    for (let i = 0; i < 8; i++) this.noise({ t: i * .022, d: .05, v: .14, f: 1500 + Math.random() * 4000, q: 1.4 });
    this.noise({ d: .4, v: .14, f: 2200, to: 500, q: .8 });
    this.tone(130, { d: .3, v: .22, to: 45 });
  },
  whoosh(v = .14) { this.noise({ d: .35, v, f: 350, to: 2600, q: .9 }); },
  flip() { this.noise({ d: .07, v: .12, f: 2600, q: 1 }); this.tone(1100, { d: .05, v: .03, type: 'triangle' }); },
  land() { this.tone(95, { d: .22, v: .2, to: 45 }); this.noise({ d: .08, v: .05, f: 500, type: 'lowpass' }); },
  charge(tier, ms) {
    if (!this.on) return; const a = this.init(); if (!a) return;
    const n = a.currentTime, d = ms / 1000, o = a.createOscillator(), o2 = a.createOscillator(), fl = a.createBiquadFilter(), g = a.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.setValueAtTime(tier === 3 ? 55 : 70, n); o.frequency.exponentialRampToValueAtTime(tier === 3 ? 440 : 260, n + d);
    o2.frequency.setValueAtTime(tier === 3 ? 55.6 : 70.7, n); o2.frequency.exponentialRampToValueAtTime(tier === 3 ? 446 : 264, n + d);
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(200, n); fl.frequency.exponentialRampToValueAtTime(tier === 3 ? 4200 : 2400, n + d);
    g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(.09, n + d * .9); g.gain.exponentialRampToValueAtTime(.0001, n + d + .08);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(this.master);
    o.start(n); o2.start(n); o.stop(n + d + .1); o2.stop(n + d + .1);
    const steps = tier === 3 ? 14 : 8;
    for (let i = 0; i < steps; i++) this.tone(800 + i * 140, { t: d * (i / steps) ** .7, d: .12, v: .02 + i * .002, type: 'triangle', wet: .5 });
  },
  scan(d) { this.tone(190, { d, v: .035, type: 'sawtooth', to: 380 }); this.noise({ d, v: .025, f: 5200, q: 5 }); },
  blip() { this.tone(2100, { d: .04, v: .02, type: 'square' }); },
  clack() {
    this.noise({ d: .06, v: .28, f: 3000, q: .8 }); this.tone(330, { d: .14, v: .13, type: 'triangle', to: 140 });
    this.noise({ t: .045, d: .04, v: .12, f: 5200, q: 1 });
  },
  grade(g) {
    if (g >= 9) [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => this.tone(f, { t: i * .07, d: 1.3, v: .06, type: 'triangle', wet: .7 }));
    else if (g >= 6) [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, { t: i * .08, d: .7, v: .05, wet: .4 }));
    else if (g >= 4) [440, 554.37].forEach((f, i) => this.tone(f, { t: i * .1, d: .5, v: .05 }));
    else [392, 369.99, 349.23, 329.63].forEach((f, i) => this.tone(f, { t: i * .24, d: i === 3 ? .9 : .26, v: .045, type: 'triangle' }));
    if (g === 10) { this.tone(52, { d: 1.2, v: .35, to: 28 }); [1046.5, 1318.51, 1567.98, 2093].forEach(f => this.tone(f, { t: .5, d: 2.2, v: .03, type: 'triangle', wet: .9 })); }
  },
  reveal(tier) {
    const sets = [[659.25, 987.77], [523.25, 659.25, 783.99, 1046.5],
      [392, 493.88, 587.33, 783.99, 987.77, 1174.66],
      [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]];
    sets[tier].forEach((f, i) => this.tone(f, { t: i * (tier === 3 ? .065 : .055), d: tier >= 2 ? 1.5 : .5, v: tier >= 2 ? .06 : .05, type: tier === 3 ? 'triangle' : 'sine', wet: .6 }));
    if (tier >= 2) {
      this.tone(tier === 3 ? 48 : 62, { d: 1.3, v: .4, to: 28 });
      this.noise({ d: .7, v: .2, f: 1800, to: 150, type: 'lowpass' });
    }
    if (tier === 3) [523.25, 659.25, 783.99, 1046.5].forEach(f => this.tone(f, { t: .6, d: 2.6, v: .035, type: 'triangle', wet: .9 }));
  },
  // monedas que caen en la caja
  coin() { [1318.51, 1975.53].forEach((f, i) => this.tone(f, { t: i * .07, d: .35, v: .05, type: 'square', wet: .4 })); this.noise({ d: .05, v: .06, f: 6000, q: 3 }); },
  // god pack: un acorde que sube y un golpe grave
  god() {
    [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093].forEach((f, i) => this.tone(f, { t: i * .09, d: 2.4, v: .05, type: 'triangle', wet: .9 }));
    this.tone(40, { d: 1.8, v: .45, to: 24 }); this.noise({ d: 1.4, v: .18, f: 900, to: 5000, q: .7 });
  },
};
$('#soundBtn').onclick = () => {
  Snd.on = !Snd.on;
  $('#soundBtn').setAttribute('aria-pressed', String(Snd.on));
  if (Snd.ctx) Snd.on ? Snd.ctx.resume() : Snd.ctx.suspend();
};
const buzz = p => { try { if (!REDUCED && navigator.vibrate) navigator.vibrate(p); } catch {} };

/* ---------------- PARTÍCULAS ---------------- */
const cv = $('#fx'), cx = cv.getContext('2d');
let W = 0, H = 0, parts = [], fxRaf = 0, fxLast = 0;
function resizeFx() {
  const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
}
resizeFx(); addEventListener('resize', resizeFx);

function addParts(list) {
  if (REDUCED) return;
  parts.push(...list);
  if (parts.length > 1200) parts.splice(0, parts.length - 1200);
  if (!fxRaf) { fxLast = performance.now(); fxRaf = requestAnimationFrame(fxStep); }
}
function burst(x, y, o = {}) {
  const { n = 40, colors = ['#fff'], speed = 9, kinds = ['spark'], gravity = .16, spread = Math.PI * 2, angle = 0, life = 1, size = 1 } = o;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - .5) * spread, v = speed * (.3 + Math.random() * .9), k = kinds[i % kinds.length];
    out.push({
      k, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      g: k === 'confetti' ? gravity * .55 : k === 'star' ? gravity * .2 : gravity,
      c: colors[Math.random() * colors.length | 0],
      s: (k === 'confetti' ? 5 + Math.random() * 6 : k === 'star' ? 2 + Math.random() * 3 : 1 + Math.random() * 2.2) * size,
      rot: Math.random() * 6.28, vr: (Math.random() - .5) * .35, life: 1,
      decay: (k === 'confetti' ? .006 + Math.random() * .006 : .012 + Math.random() * .014) / life,
      drag: k === 'confetti' ? .975 : .94,
    });
  }
  addParts(out);
}
function suck(cxp, cyp, r, colors, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = r * (.8 + Math.random() * .6);
    out.push({ k: 'in', x: cxp + Math.cos(a) * d, y: cyp + Math.sin(a) * d, tx: cxp, ty: cyp, c: colors[Math.random() * colors.length | 0], s: 1.2 + Math.random() * 2, life: 1, sp: .035 + Math.random() * .03 });
  }
  addParts(out);
}
function star(x, y, r) {
  cx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .28 : r; cx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  cx.closePath(); cx.fill();
}
function fxStep(t) {
  const dt = Math.min((t - fxLast) / 16.67, 3); fxLast = t;
  cx.clearRect(0, 0, W, H);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.k === 'in') {
      const px = p.x, py = p.y;
      p.x += (p.tx - p.x) * p.sp * dt * 1.6; p.y += (p.ty - p.y) * p.sp * dt * 1.6;
      if (Math.hypot(p.tx - p.x, p.ty - p.y) < 14) p.life = 0;
      cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = .9;
      cx.strokeStyle = p.c; cx.lineWidth = p.s; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(px - (p.x - px) * 3, py - (p.y - py) * 3); cx.lineTo(p.x, p.y); cx.stroke();
      if (p.life <= 0) parts.splice(i, 1);
      continue;
    }
    const dr = Math.pow(p.drag, dt);
    p.vx *= dr; p.vy *= dr; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt;
    if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
    cx.globalAlpha = Math.min(1, p.life * 1.6);
    if (p.k === 'spark') {
      cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = p.c; cx.lineWidth = p.s; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); cx.stroke();
    } else if (p.k === 'star') {
      cx.globalCompositeOperation = 'lighter'; cx.fillStyle = p.c;
      star(p.x, p.y, p.s * (1.6 + Math.sin(t / 70 + p.rot * 5)));
    } else {
      cx.globalCompositeOperation = 'source-over'; cx.fillStyle = p.c;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, Math.cos(p.rot * 2.3));
      cx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); cx.restore();
    }
  }
  cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  if (parts.length) fxRaf = requestAnimationFrame(fxStep); else { fxRaf = 0; cx.clearRect(0, 0, W, H); }
}
const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r]; };

function flash(color = '#fff', peak = .9, ms = 700) {
  const f = $('#flash');
  f.style.background = `radial-gradient(circle at 50% 50%, #fff 0%, ${color} 45%, ${color}00 100%)`;
  f.animate([{ opacity: 0 }, { opacity: peak, offset: .12 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
}

/* ---------------- INCLINACIÓN 3D ---------------- */
// Un solo bucle que inclina el elemento activo (sobre, carta en juego o carta ampliada)
const tilt = { target: null, box: null, amp: 1, x: .5, y: .5, tx: .5, ty: .5, hov: 0, th: 0, last: -1e9 };
function setTilt(target, box = target, amp = 1) { tilt.target = target; tilt.box = box; tilt.amp = amp; }
addEventListener('pointermove', e => {
  if (!tilt.box) return;
  const r = tilt.box.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
  const near = px > -.35 && px < 1.35 && py > -.35 && py < 1.35;
  if (!near) return;
  tilt.tx = clamp(px, 0, 1); tilt.ty = clamp(py, 0, 1); tilt.last = performance.now(); tilt.th = 1;
});
(function tiltLoop(t) {
  if (tilt.target) {
    const idle = t - tilt.last > 1600;
    if (idle) { tilt.tx = .5 + .28 * Math.sin(t / 1300); tilt.ty = .5 + .2 * Math.cos(t / 1700); tilt.th = .35; }
    tilt.x += (tilt.tx - tilt.x) * .1; tilt.y += (tilt.ty - tilt.y) * .1; tilt.hov += (tilt.th - tilt.hov) * .08;
    const s = tilt.target.style, a = tilt.amp * (REDUCED ? .3 : 1);
    s.setProperty('--ry', `${((tilt.x - .5) * 26 * a).toFixed(2)}deg`);
    s.setProperty('--rx', `${((.5 - tilt.y) * 22 * a).toFixed(2)}deg`);
    s.setProperty('--mx', `${(tilt.x * 100).toFixed(1)}%`);
    s.setProperty('--my', `${(tilt.y * 100).toFixed(1)}%`);
    s.setProperty('--hov', tilt.hov.toFixed(3));
  }
  requestAnimationFrame(tiltLoop);
})(0);

// inclinación directa al pasar el mouse (resumen / colección)
function hoverTilt(card) {
  const tl = card.querySelector('.tilt');
  card.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    tl.style.setProperty('--ry', `${(x - .5) * 24}deg`); tl.style.setProperty('--rx', `${(.5 - y) * 20}deg`);
    tl.style.setProperty('--mx', `${x * 100}%`); tl.style.setProperty('--my', `${y * 100}%`); tl.style.setProperty('--hov', 1);
  });
  card.addEventListener('pointerleave', () => { ['--rx', '--ry', '--mx', '--my', '--hov'].forEach(p => tl.style.removeProperty(p)); });
}

/* ---------------- SOBRE ---------------- */
const pack = $('#pack'), packTop = $('#packTop'), packBottom = $('#packBottom'), stack = $('#stack'), wrap = $('#wrap');
const TEAR_Y = 13; // % de la altura del sobre
(function cutPieces() {
  const teeth = 26, amp = .7, pts = [];
  for (let i = 0; i <= teeth * 2; i++) pts.push(`${(i / (teeth * 2) * 100).toFixed(2)}% ${(TEAR_Y + (i % 2 ? amp : -amp)).toFixed(2)}%`);
  packTop.style.clipPath = `polygon(0% 0%, 100% 0%, ${[...pts].reverse().join(',')})`;
  packBottom.style.clipPath = `polygon(${pts.join(',')}, 100% 100%, 0% 100%)`;
})();
function skinHTML(fan) {
  return `<div class="skin">
    <div class="skin-rays"></div><div class="skin-foil"></div>
    <div class="crimp t"></div>
    <div class="skin-badge">SERIE 01</div>
    <div class="skin-logo">PRO<br>DROP<small>DIE COLLECTION</small></div>
    <div class="skin-fan">${fan.map(c => `<img src="${c.img}" alt="" draggable="false">`).join('')}</div>
    <div class="skin-meta">5 CARTAS · EDICIÓN HOLO</div>
    <div class="skin-sheen"></div>
    <div class="crimp b"></div>
  </div>`;
}

let phase = 'pack', pull = [], els = [], current = 0, busy = false, tearP = 0, tearing = false, lastX = 0, lastTick = 0;
const setPhase = p => { phase = p; document.body.dataset.phase = p; };
const hint = txt => { $('#hint').textContent = txt; };

// el sobre comprado: su contenido sale del motor (uid, clave, hora del servidor)
let comprado = null;   // {k, at, dios}
function cardsOf(k, at) {
  const so = M.sobre(cuenta.uid, k, at);
  const antes = new Set(Object.keys(col));
  const vistas = new Set();
  return so.cartas.map((x, i) => {
    const base = CARDS[x.id], cp = { id: x.id, g: x.g, s: x.w, gr: 0, o: cuenta.uid, k, i, at, key: `${cuenta.uid}~${k}.${i}`, venta: '' };
    const nueva = !antes.has(base.uid) && !vistas.has(base.uid);
    vistas.add(base.uid);
    return { ...base, grade: x.g, wseed: x.w, graded: false, _copy: cp, _new: nueva };
  });
}
const preload = list => Promise.all(list.map(c => { const i = new Image(); i.src = c.img; return i.decode().catch(() => {}); }));

// el sobre en la mesa: cerrado y sin pagar (fase `tienda`) o comprado y listo para abrir (`pack`)
function showPack(drop) {
  current = 0; busy = false; tearP = 0; tearing = false;
  $('#summary').hidden = true; $('#tableView').hidden = false;
  hideBanner(); setDots();
  stack.getAnimations().forEach(a => a.cancel());
  stack.style.visibility = 'hidden'; stack.innerHTML = '';
  els = pull.map((c, i) => { const el = makeCard(c, { down: true }); el.style.zIndex = 10 - i; stack.appendChild(el); return el; });
  restack();
  if (drop) {
    const shinyFan = CARDS.filter(c => c.tier >= 2).sort(() => Math.random() - .5).slice(0, 3);
    packTop.innerHTML = packBottom.innerHTML = skinHTML(shinyFan);
    [pack, packTop, $('#packLight')].forEach(e => e.getAnimations().forEach(a => a.cancel()));
    packTop.style.transform = ''; pack.hidden = false;
    pack.classList.remove('started', 'tearing');
    pack.animate([
      { transform: 'perspective(900px) translateY(-80vh) rotate(-14deg)', opacity: 0 },
      { transform: 'perspective(900px) translateY(0) rotate(0)', opacity: 1 },
    ], { duration: REDUCED ? 1 : 850, easing: 'cubic-bezier(.2,1.25,.4,1)' });
    if (!REDUCED) setTimeout(() => Snd.land(), 450);
  }
  updateTear();
  setTilt(pack, pack, 1);
}
function tienda(drop = true) {
  setPhase('tienda');
  comprado = null; pull = []; abriendo = '';
  rehazColeccion();
  showPack(drop);
  hint('');
  pintaCompra();
}
function newPack(k, at, drop = true) {
  const so = M.sobre(cuenta.uid, k, at);
  comprado = { k, at, dios: so.dios };
  abriendo = k; rehazColeccion();        // «nueva» se mide contra lo que tenías antes de este sobre
  pull = cardsOf(k, at);
  try { localStorage.setItem(PENDIENTE(), k); } catch {}
  preload(pull);
  setPhase('pack');
  showPack(drop);
  if (!drop) pack.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06, .95)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  hint('Desliza por la línea punteada para abrir el sobre');
  pintaCompra();
}

function updateTear() {
  $('#tearCut').style.width = `${tearP * 100}%`;
  $('#tearDot').style.left = `${tearP * 100}%`;
  packTop.style.transform = tearP ? `translateY(${-tearP * 5}px) rotate(${tearP * 4.5}deg)` : '';
}
function tearSparks(n = 3) {
  const r = pack.getBoundingClientRect();
  burst(r.left + r.width * tearP, r.top + r.height * TEAR_Y / 100, { n, colors: ['#fff', '#ffe08a', '#ff9ad5'], speed: 5, spread: 2.4, angle: -Math.PI / 2, gravity: .25 });
}
pack.addEventListener('pointerdown', e => {
  if (phase === 'tienda') { avisaCompra(); return; }
  if (phase !== 'pack') return;
  Snd.init();
  tearing = true; lastX = e.clientX;
  pack.classList.add('tearing');
  pack.setPointerCapture(e.pointerId);
  setTilt(pack, pack, .35);
});
pack.addEventListener('pointermove', e => {
  if (!tearing || phase !== 'pack') return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  if (!dx || (dx < 0 && tearP <= 0)) return;
  // se puede abrir y volver a cerrar arrastrando en ambas direcciones
  const w = pack.getBoundingClientRect().width;
  tearP = Math.max(0, Math.min(1, tearP + dx / (w * .85)));
  pack.classList.toggle('started', tearP > 0);
  updateTear();
  const now = performance.now();
  if (now - lastTick > 28) {
    lastTick = now; Snd.tick();
    if (dx > 0) { tearSparks(); buzz(4); }
  }
  if (tearP >= 1) openPack();
});
const endTear = () => { if (!tearing) return; tearing = false; pack.classList.remove('tearing'); if (phase === 'pack') { setTilt(pack, pack, 1); healTear(); } };
// si se suelta a medias, el corte se vuelve a cerrar
function healTear() {
  if (tearP <= 0 || tearP >= 1) return;
  const from = tearP, t0 = performance.now(), dur = 260 + from * 420;
  Snd.noise({ d: dur / 1000, v: .05, f: 3200, to: 900, q: 1.4 });
  (function step(now) {
    if (tearing || phase !== 'pack') return; // volvió a agarrar el sobre
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
    tearP = from * (1 - e); updateTear();
    if (k < 1) return requestAnimationFrame(step);
    tearP = 0; updateTear(); pack.classList.remove('started');
    Snd.land(); buzz(8);
    pack.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.025, .975)' }, { transform: 'scale(.99, 1.01)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
  })(t0);
}
pack.addEventListener('pointerup', endTear);
pack.addEventListener('pointercancel', endTear);

async function autoTear() {
  if (phase !== 'pack') return;
  Snd.init(); setPhase('opening'); pack.classList.add('started');
  const start = tearP, t0 = performance.now(), dur = 650;
  await new Promise(res => {
    (function step(t) {
      const k = clamp((t - t0) / dur, 0, 1);
      tearP = start + (1 - start) * (k * k * (3 - 2 * k));
      updateTear(); tearSparks(2);
      if (t - lastTick > 40) { lastTick = t; Snd.tick(); }
      k < 1 ? requestAnimationFrame(step) : res();
    })(t0);
  });
  openPack(true);
}

async function openPack(force) {
  if (phase !== 'pack' && !force) return;
  setPhase('opening'); tearing = false; setTilt(null, null);
  pack.style.setProperty('--rx', '0deg'); pack.style.setProperty('--ry', '0deg');
  Snd.rip(); buzz([20, 30, 40]);

  const r = pack.getBoundingClientRect(), ty = r.top + r.height * TEAR_Y / 100;
  for (let i = 0; i < 6; i++) burst(r.left + r.width * (i / 5), ty, { n: 10, colors: ['#fff', '#ffe08a', '#ff9ad5', '#9be9ff'], speed: 8, spread: 1.8, angle: -Math.PI / 2, kinds: ['spark', 'spark', 'star'] });

  packTop.animate([
    { transform: packTop.style.transform || 'none', opacity: 1 },
    { transform: 'translate(45%, -170%) rotate(32deg)', opacity: 0 },
  ], { duration: 750, easing: 'cubic-bezier(.25,.6,.35,1)', fill: 'forwards' });
  $('#packLight').animate([{ opacity: 0, transform: 'translateY(-100%) scaleY(.2)' }, { opacity: 1, transform: 'translateY(-100%) scaleY(1)' }],
    { duration: 500, easing: 'ease-out', fill: 'forwards' });
  pack.animate([
    { transform: 'perspective(900px) scale(1)' }, { transform: 'perspective(900px) scale(1.05, .96)' }, { transform: 'perspective(900px) scale(1)' },
  ], { duration: 420, easing: 'ease-out' });
  hint('');
  await sleep(380);
  if (comprado && comprado.dios) await godPack();

  // las cartas asoman desde dentro del sobre
  const cw = els[0].getBoundingClientRect().width;
  stack.style.visibility = 'visible';
  Snd.whoosh(.1);
  await stack.animate([{ transform: `translateY(${cw * .1}px)` }, { transform: `translateY(${-cw * .5}px)` }],
    { duration: 700, easing: 'cubic-bezier(.2,.9,.25,1.15)', fill: 'forwards' }).finished;
  await sleep(120);

  // el sobre cae y el mazo baja al centro
  pack.animate([
    { transform: 'perspective(900px) translateY(0) rotate(0)', opacity: 1 },
    { transform: 'perspective(900px) translateY(85vh) rotate(9deg)', opacity: .6 },
  ], { duration: 650, easing: 'cubic-bezier(.55,0,.85,.4)', fill: 'forwards' });
  await stack.animate([{ transform: `translateY(${-cw * .5}px)` }, { transform: 'translateY(0)' }],
    { duration: 750, easing: 'cubic-bezier(.3,1.25,.5,1)', fill: 'forwards' }).finished;
  Snd.land();
  pack.hidden = true;

  setPhase('reveal'); setDots();
  hint('Toca la carta para darla vuelta');
  focusTop();
  stack.focus({ preventScroll: true });
}

/* ---------------- REVELADO ---------------- */
function restack() {
  els.slice(current).forEach((el, j) => {
    el.style.transform = j ? `translate(${j * 3}px, ${j * 4}px) rotate(${(j % 2 ? 1.6 : -1.4) * Math.min(j, 3)}deg)` : 'none';
  });
}
function focusTop() {
  const el = els[current];
  if (el) setTilt(el.querySelector('.tilt'), el, el.revealed ? 1 : .55);
}
function setDots() {
  [...$('#dots').children].forEach((d, i) => {
    const c = pull[i], on = els[i] && els[i].revealed;
    d.className = on ? 'on' : i === current && phase === 'reveal' ? 'cur' : '';
    d.style.setProperty('--c', on ? accentOf(c) : '');
  });
}
function showBanner(c) {
  const b = $('#banner'), t = TIERS[c.tier];
  b.className = `banner ${t.key}`;
  b.style.setProperty('--c', accentOf(c));
  b.querySelector('.b-tier').textContent = `${t.label.toUpperCase()} ${t.sym}`;
  b.querySelector('.b-name').textContent = c.name;
  b.querySelector('.b-var').innerHTML = `${subtitle(c)} · N.º ${pad(c.num)}${c._new ? '<em>NUEVA</em>' : ''}`;
  requestAnimationFrame(() => b.classList.add('show'));
  document.body.classList.add('has-banner');
}
function hideBanner() { $('#banner').classList.remove('show'); document.body.classList.remove('has-banner'); }

function aura(on, c, legend) {
  const a = $('#aura');
  if (!on) { const op = getComputedStyle(a).opacity; a.getAnimations().forEach(x => x.cancel()); a.animate([{ opacity: op }, { opacity: 0 }], { duration: 350, fill: 'forwards' }); return; }
  const [x, y] = centerOf(els[current]);
  a.style.left = `${x}px`; a.style.top = `${y}px`;
  const pl = paletteOf(c);
  a.style.setProperty('--c', pl[0]); pl.forEach((col, i) => a.style.setProperty(`--c${i + 1}`, col));
  a.classList.toggle('legend', !!legend);
}

function shakeFrames(strength, n = 26) {
  const f = [];
  for (let i = 0; i <= n; i++) {
    const k = (i / n) ** 1.6, a = strength * k;
    f.push({ transform: `translate(${(Math.random() - .5) * a}px, ${(Math.random() - .5) * a - k * 18}px) rotate(${(Math.random() - .5) * a * .25}deg) scale(${1 + k * .07})` });
  }
  f.push({ transform: 'translate(0, -18px) scale(1.07)' });
  return f;
}

async function reveal(el) {
  busy = true;
  const c = el.card, t = c.tier, [x, y, r] = centerOf(el), pl = t >= 2 ? paletteOf(c) : [], colors = t >= 2 ? [...pl, '#fff'] : [accentOf(c), '#fff', TIERS[t].color];
  setTilt(null, null);
  const tl = el.querySelector('.tilt'); tl.style.setProperty('--rx', '0deg'); tl.style.setProperty('--ry', '0deg');

  if (t >= 2) {
    // suspenso: la carta tiembla, se oscurece la sala y aparece el aura
    const ms = REDUCED ? 300 : t === 3 ? 1900 : 1150;
    document.body.classList.add('dim');
    aura(true, c, t === 3);
    const a = $('#aura');
    a.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ms, easing: 'ease-in', fill: 'forwards' });
    Snd.charge(t, ms); buzz(t === 3 ? [30, 60, 30, 60, 30, 40, 60] : [30, 60, 30]);
    const iv = setInterval(() => suck(x, y, r.width * 1.1, colors, t === 3 ? 7 : 4), 40);
    await el.animate(shakeFrames(t === 3 ? 22 : 12), { duration: ms, easing: 'ease-in', fill: 'forwards' }).finished;
    clearInterval(iv);
    flash(pl[0], t === 3 ? .95 : .7, t === 3 ? 1000 : 650);
  } else if (t === 1) {
    burst(x, y, { n: 16, colors: ['#5cc8ff', '#fff'], speed: 5, kinds: ['star'], gravity: 0 });
  }

  record(c);
  Snd.flip();
  el.querySelector('.flip').classList.remove('down');
  el.revealed = true;
  light(el);

  const pop = t >= 2
    ? [{ transform: 'translate(0,-18px) scale(1.07)' }, { transform: 'translate(0,-10px) scale(1.16)', offset: .35 }, { transform: 'none' }]
    : [{ transform: 'none' }, { transform: 'scale(1.06)', offset: .4 }, { transform: 'none' }];
  el.getAnimations().forEach(a => a.cancel());
  el.animate(pop, { duration: t >= 2 ? 800 : 500, easing: 'cubic-bezier(.2,1.3,.4,1)' });

  setTimeout(() => {
    Snd.reveal(t);
    if (t === 3) {
      burst(x, y, { n: 120, colors: [...pl, '#fff', '#ffcc3d'], speed: 17, kinds: ['confetti', 'spark', 'star'], gravity: .2, life: .8 });
      setTimeout(() => burst(x, y - 40, { n: 60, colors: [pl[1], '#fff'], speed: 12, kinds: ['star', 'spark'], gravity: .05 }), 300);
    } else if (t === 2) {
      burst(x, y, { n: 70, colors: [...pl, '#fff'], speed: 13, kinds: ['spark', 'star', 'confetti'], gravity: .15 });
    } else if (t === 1) {
      burst(x, y, { n: 26, colors: ['#5cc8ff', '#fff', '#b4e8ff'], speed: 8, kinds: ['spark', 'star'] });
    } else {
      burst(x, y, { n: 12, colors: ['#fff', '#ffe9a8'], speed: 6, kinds: ['star'], gravity: .02 });
    }
  }, t >= 2 ? 60 : 180);

  showBanner(c); setDots();
  hint('');
  if (t >= 2) setTimeout(() => document.body.classList.remove('dim'), 900);
  await sleep(t >= 2 ? 650 : 300);
  focusTop();
  busy = false;
}

async function dismiss(el, dir = 1) {
  busy = true;
  hideBanner(); aura(false);
  Snd.whoosh();
  setTilt(null, null);
  const from = getComputedStyle(el).transform;
  el.style.transition = 'none';
  await el.animate([
    { transform: from === 'none' ? 'none' : from },
    { transform: `translate(${dir * 115}vw, -8vh) rotate(${dir * 28}deg)` },
  ], { duration: 480, easing: 'cubic-bezier(.45,0,.85,.45)', fill: 'forwards' }).finished;
  el.remove();
  current++;
  if (current >= els.length) { busy = false; return showSummary(); }
  restack(); setDots(); focusTop();
  hint('Toca la carta para darla vuelta');
  busy = false;
}

function act() {
  if (phase !== 'reveal' || busy) return;
  const el = els[current]; if (!el) return;
  el.revealed ? dismiss(el, 1) : reveal(el);
}

// tocar = revelar / siguiente · arrastrar una carta revelada = descartarla
let drag = null;
stack.addEventListener('pointerdown', e => {
  if (phase !== 'reveal' || busy) return;
  const el = els[current]; if (!el) return;
  Snd.init();
  drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, el, moved: false };
  stack.setPointerCapture(e.pointerId);
});
stack.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y;
  if (Math.hypot(drag.dx, drag.dy) > 8) drag.moved = true;
  if (drag.el.revealed && drag.moved) {
    drag.el.style.transition = 'none';
    drag.el.style.transform = `translate(${drag.dx}px, ${drag.dy * .25}px) rotate(${drag.dx * .06}deg)`;
  }
});
const endDrag = () => {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.el.revealed && Math.abs(d.dx) > 80) return dismiss(d.el, Math.sign(d.dx));
  d.el.style.transition = ''; d.el.style.transform = 'none';
  if (!d.moved) act();
};
stack.addEventListener('pointerup', endDrag);
stack.addEventListener('pointercancel', () => { if (drag) { drag.el.style.transition = ''; drag.el.style.transform = 'none'; drag = null; } });

addEventListener('keydown', e => {
  if (['zoom', 'collection', 'market', 'trade'].some(id => !$('#' + id).hidden)) { if (e.key === 'Escape') closeOverlays(); return; }
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
    if (phase === 'pack' && e.target.tagName !== 'BUTTON') { e.preventDefault(); autoTear(); }
    else if (phase === 'reveal') { e.preventDefault(); act(); }
  }
});

/* ---------------- RESUMEN ---------------- */
function sumCard(c) {
  const el = makeCard(c, { back: false });
  light(el);
  if (c._new) el.insertAdjacentHTML('beforeend', '<span class="badge-new">NUEVA</span>');
  el.addEventListener('click', () => openZoom(c));
  hoverTilt(el);
  return el;
}
function showSummary() {
  setPhase('summary');
  setTilt(null, null); aura(false); hideBanner();
  document.body.classList.remove('dim');
  pull.forEach(record);
  abriendo = ''; rehazColeccion(); updateColCount();
  try { localStorage.removeItem(PENDIENTE()); } catch {}
  pintaCompra();
  $('#tableView').hidden = true; $('#summary').hidden = false;
  const box = $('#sumCards'); box.innerHTML = '';
  pull.forEach((c, i) => {
    const el = sumCard(c);
    box.appendChild(el);
    el.animate([{ transform: 'translateY(70px) scale(.8) rotate(-4deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 650, delay: i * 90, easing: 'cubic-bezier(.2,1.25,.4,1)', fill: 'backwards' });
  });
}
// tras graduar en el zoom, la carta del resumen pasa a su caja
function refreshCard(c) {
  if (phase !== 'summary') return;
  const old = [...$('#sumCards').children].find(e => e.card === c);
  if (old) old.replaceWith(sumCard(c));
}
$('#skipBtn').onclick = () => { if (phase === 'reveal' && !busy) showSummary(); };
$('#againBtn').onclick = () => comprar(true);
$('#againFreeBtn').onclick = () => comprar(true, true);
$('#freeBtn').onclick = () => comprar(false, true);
$('#autoBtn').onclick = () => autoTear();
$('#buyBtn').onclick = () => comprar(false);

/* ---------------- ZOOM ---------------- */
let prevTilt = null, zoomC = null, grading = false, gradeSpeed = 1;
function openZoom(c) {
  prevTilt = prevTilt || [tilt.target, tilt.box, tilt.amp];
  zoomC = c;
  const z = $('#zoom'), box = $('#zoomCard');
  box.innerHTML = '';
  const el = makeCard(c, { back: false }); light(el);
  box.appendChild(el);
  zoomUI();
  z.hidden = false;
  setTilt(el.querySelector('.tilt'), el, 1.1);
  Snd.flip();
}
const nombreDe = u => (cuenta.gente[u] && cuenta.gente[u].n) || 'Alguien';
const ofertaDe = id => cuenta.ofertas.find(o => o.id === id);
// la más barata a la venta de esta misma carta (de otros), para orientar el precio
const masBarata = (uid, sinId) => cuenta.ofertas.filter(o => o.id !== sinId && M.CARDS[M.sobre(o.o, o.k, o.at).cartas[o.i].id].uid === uid)
  .reduce((m, o) => (!m || o.p < m.p ? o : m), null);
function zoomUI(recien) {
  const c = zoomC, t = TIERS[c.tier], of = c._oferta, mio = !!c._copy && !c._ajena;
  const venta = mio && c._copy.venta ? ofertaDe(c._copy.venta) : null;
  $('#zoomInfo').innerHTML = `<b>${c.name}</b> · ${subtitle(c)} · ${t.label} ${t.sym} · N.º ${pad(c.num)}/${TOTAL}` +
    (c.graded ? `<br><b class="zi-grade" style="--gc:${gradeColor(c.grade)}">Nota ${c.grade} · ${GRADE_WORD[c.grade]}</b>` : c.grade ? '<br>Sin graduar · su estado es un misterio' : '') +
    (of ? `<br><span class="zi-venta">Vende <b>${esc(of.u === cuenta.uid ? 'tú' : nombreDe(of.u))}</b> · ${MONEDA}<b>${fmt(of.p)}</b></span>` : '') +
    (venta ? `<br><span class="zi-venta">En el mercado por ${MONEDA}<b>${fmt(venta.p)}</b></span>` : '') +
    (c._ajena ? `<br><span class="zi-venta">De <b>${esc(nombreDe(c._ajena))}</b></span>` : '');
  const gb = $('#gradeBtn');
  gb.hidden = !mio || !c.grade || c.graded || !!venta;
  gb.innerHTML = `Enviar a graduar 🔍 <span class="precio">${MONEDA}${M.PRECIO.gradua}</span>`;
  gb.disabled = cuenta.parada || cuenta.saldo < M.PRECIO.gradua;
  gb.title = gb.disabled ? `Te faltan ${M.PRECIO.gradua - cuenta.saldo} monedas` : '';
  $('#gradeSteps').hidden = true;
  // la probabilidad de algo así de bueno: se dice al graduar y queda a la vista
  const go = $('#gradeOdds');
  go.hidden = !c.graded;
  if (c.graded) {
    go.innerHTML = oddsHTML(c);
    if (recien && !REDUCED) go.animate([{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 150, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
  }
  const enSobre = mio && !!abriendo && c._copy.k === abriendo && c._copy.o === cuenta.uid && phase !== 'summary';
  // exhibir en el perfil (hasta MAX_EXH cartas)
  const sb = $('#showBtn'), key = mio && c._copy.key, puesta = !!key && cuenta.exh.includes(key);
  sb.hidden = !key || enSobre;
  sb.classList.toggle('on', puesta);
  sb.innerHTML = puesta ? '★ En tu perfil' : '☆ Exhibir';
  sb.title = puesta ? 'Quitarla de tu perfil' : cuenta.exh.length >= MAX_EXH ? `Ya exhibes ${MAX_EXH}: quita una primero` : 'La verán todos en tu perfil de Juegos';
  sb.disabled = !puesta && cuenta.exh.length >= MAX_EXH;
  // vender / retirar lo propio
  const vb = $('#sellBtn');
  vb.hidden = !mio || enSobre;
  vb.innerHTML = venta ? 'Retirar del mercado' : '💰 Vender';
  vb.classList.toggle('on', !!venta);
  vb.disabled = !venta && cuenta.parada;
  $('#sellBox').hidden = true;
  // comprar (o retirar) desde el mercado
  const bb = $('#buyCardBtn');
  bb.hidden = !of;
  if (of) {
    const propia = of.u === cuenta.uid, falta = of.p - cuenta.saldo;
    bb.innerHTML = propia ? 'Retirar del mercado' : `Comprar <span class="precio">${MONEDA}${fmt(of.p)}</span>`;
    bb.disabled = !propia && (falta > 0 || cuenta.parada);
    bb.title = !propia && falta > 0 ? `Te faltan ${fmt(falta)} monedas` : '';
    bb.classList.toggle('primary', !propia);
  }
  // otras copias de la misma carta
  const list = copies[c.uid] || [], base = CARDS.find(x => x.uid === c.uid), cp = $('#copies');
  cp.innerHTML = list.length > 1 && mio ? `<span>Tus copias:</span>` + list.map((x, i) =>
    `<button data-i="${i}" class="${mismaCopia(x, c._copy) ? 'on' : ''}"${x.gr ? ` style="--gc:${gradeColor(x.g)}"` : ''}>${x.gr ? `<b>${x.g}</b>` : 'Sin graduar'}${x.venta ? ' 💰' : ''}</button>`).join('') : '';
  cp.querySelectorAll('button').forEach(b => b.onclick = () => {
    const x = list[+b.dataset.i]; if (grading || mismaCopia(x, c._copy)) return;
    const pc = pull.find(p => mismaCopia(p._copy, x));
    openZoom(pc || fromCopy(base, x));
  });
}
// llegaron datos nuevos con el zoom abierto: la carta pudo venderse, graduarse o cambiar de dueño
function refrescaZoom() {
  const c = zoomC;
  if (c._oferta) {
    const o = ofertaDe(c._oferta.id);
    if (o) c._oferta = o;
    else {
      // ya no está a la venta: si es porque la compré yo, pasa a ser mía
      const x = (copies[c.uid] || []).find(y => y.key === c._oferta.c);
      if (!x) { cierraZoom(); toast('Esa carta ya no está a la venta.'); return; }
      c._copy = x; c._oferta = null;
    }
  } else if (c._copy && !c._ajena) {
    const x = (copies[c.uid] || []).find(y => mismaCopia(y, c._copy));
    if (x) { c._copy = x; c.graded = !!x.gr; }
    else if (!(abriendo && c._copy.k === abriendo)) { cierraZoom(); toast('Esa carta ya no está en tu colección.'); return; }
  }
  zoomUI();
}
let zoomVuelve = '';   // 'col' o 'mk': a dónde vuelve el zoom al cerrarse
function cierraZoom() {
  $('#zoom').hidden = true; setTilt(null, null);
  if (zoomVuelve === 'col') { renderCollection(); $('#collection').hidden = false; $('#colGrid').scrollTop = colScroll; }
  else if (zoomVuelve === 'mk') { renderMercado(); $('#market').hidden = false; $('#mkGrid').scrollTop = mkScroll; }
  else if (prevTilt) { setTilt(...prevTilt); prevTilt = null; }
  zoomVuelve = '';
}
function closeOverlays() {
  if (grading) return;
  if (!$('#trade').hidden) { $('#trade').hidden = true; $('#market').hidden = false; return; }
  if (!$('#zoom').hidden && zoomVuelve) { cierraZoom(); return; }
  zoomVuelve = '';
  $('#zoom').hidden = true; $('#collection').hidden = true; $('#market').hidden = true;
  if (prevTilt) { setTilt(...prevTilt); prevTilt = null; }
}
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeOverlays);
for (const id of ['zoom', 'collection', 'market', 'trade']) $('#' + id).addEventListener('click', e => { if (e.target.id === id) closeOverlays(); });
$('#gradeBtn').onclick = () => gradeCard();

/* ---------------- VENDER ----------------
   El precio lo pone quien vende. Se le muestra la más barata de la misma
   carta en venta, como referencia; nada más. */
$('#sellBtn').onclick = async () => {
  const c = zoomC; if (!c || !c._copy || grading) return;
  if (c._copy.venta) {
    $('#sellBtn').disabled = true;
    try { const id = c._copy.venta; await Red.pide('retirar', { id }); Snd.flip(); toast('Retirada del mercado.'); quitaVenta(id); }
    catch (e) { avisoZoom(esc(e.message)); }
    $('#sellBtn').disabled = false; return;
  }
  const box = $('#sellBox'), ref = masBarata(c.uid);
  box.innerHTML = `<label>Precio de venta<span class="sell-campo">${MONEDA}<input id="sellPrecio" type="number" inputmode="numeric" min="1" max="100000" step="1" value="${ref ? ref.p : c.tier === 3 ? 1500 : c.tier === 2 ? 300 : c.tier === 1 ? 60 : 15}"></span></label>
    <p class="sell-ref">${ref ? `La más barata a la venta: ${MONEDA}<b>${fmt(ref.p)}</b>${ref.gr ? ` (graduada, nota ${M.sobre(ref.o, ref.k, ref.at).cartas[ref.i].g})` : ''}` : 'Nadie más la vende ahora: tú pones el precio.'}${c.graded ? ' · La tuya va graduada.' : ''}</p>
    <div class="sell-btns"><button class="btn primary" id="sellOk">Publicar</button><button class="btn" id="sellNo">Cancelar</button></div>`;
  box.hidden = false;
  const inp = $('#sellPrecio'); inp.focus(); inp.select();
  $('#sellNo').onclick = () => { box.hidden = true; };
  const publica = async () => {
    const p = Math.round(+inp.value);
    if (!(p >= 1 && p <= 100000)) { inp.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 250 }); return; }
    $('#sellOk').disabled = true;
    try {
      const id = await Red.pide('vender', { c: c._copy.key, p });
      Snd.coin(); box.hidden = true; toast(`Publicada por ${fmt(p)} monedas. Ya está en el mercado.`);
      if (id) marcaVenta(c._copy.key, id, p);
    }
    catch (e) { $('#sellOk').disabled = false; box.querySelector('.sell-ref').innerHTML = `<span class="err">${esc(e.message)}</span>`; }
  };
  $('#sellOk').onclick = publica;
  inp.onkeydown = e => { if (e.key === 'Enter') publica(); e.stopPropagation(); };
};
/* Lo que se acaba de publicar o retirar se anota aquí mismo, sin esperar a
   que Juegos mande los datos nuevos: si no, durante ese rato la carta seguía
   ofreciendo «💰 Vender» y no aparecía en la tienda. Los datos que lleguen
   después mandan. */
function marcaVenta(key, id, p) {
  const x = cuenta.mias.find(y => (y.c || `${y.o}~${y.k}.${y.i}`) === key);
  if (!x) return;
  x.venta = id;
  if (!cuenta.ofertas.some(o => o.id === id))
    cuenta.ofertas.push({ c: key, o: x.o, k: x.k, i: x.i, at: x.at, gr: !!x.gr, id, u: cuenta.uid, p, t: ahora(), estado: 'activa', fin: 0, comprador: '' });
  rehazColeccion();
  if (!$('#zoom').hidden && zoomC && !grading) refrescaZoom();
  if (!$('#market').hidden) renderMercado();
}
function quitaVenta(id) {
  cuenta.ofertas = cuenta.ofertas.filter(o => o.id !== id);
  for (const x of cuenta.mias) if (x.venta === id) x.venta = '';
  rehazColeccion();
  if (!$('#zoom').hidden && zoomC && !grading && !zoomC._oferta) refrescaZoom();
}
$('#buyCardBtn').onclick = async () => {
  const c = zoomC, of = c && c._oferta; if (!of) return;
  const b = $('#buyCardBtn'); b.disabled = true;
  try {
    if (of.u === cuenta.uid) { await Red.pide('retirar', { id: of.id }); toast('Retirada del mercado.'); quitaVenta(of.id); cierraZoom(); if (!$('#market').hidden) renderMercado(); return; }
    await Red.pide('comprarCarta', { id: of.id });
    Snd.coin(); Snd.reveal(Math.min(c.tier, 2));
    const [x, y] = centerOf($('#zoomCard'));
    burst(x, y, { n: 60, colors: [accentOf(c), '#ffcc3d', '#fff'], speed: 11, kinds: ['spark', 'star', 'confetti'], gravity: .15 });
    toast(`¡Es tuya! Pagaste ${fmt(of.p)} monedas.`);
    // pasa a ser una copia propia (si los datos nuevos no llegaron antes)
    if (c._oferta) {
      c._copy = (copies[c.uid] || []).find(y => y.key === of.c) || { id: c.n, g: c.grade, s: c.wseed, gr: c.graded ? 1 : 0, o: of.o, k: of.k, i: of.i, at: of.at, key: of.c, venta: '' };
      c._oferta = null;
    }
    zoomUI();
  } catch (e) { b.disabled = false; avisoZoom(esc(e.message)); }
};

/* Un aviso que aparece y se va. */
function toast(t, err) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : ''); el.textContent = t; document.body.appendChild(el);
  setTimeout(() => { el.classList.add('sale'); setTimeout(() => el.remove(), 400); }, 3200);
}

/* ---------------- GRADUACIÓN ----------------
   inspección (escáner + lupa por superficie, esquinas, bordes y centrado) →
   encapsulado en la caja plástica → la nota gira en la etiqueta y se fija */
const ease = k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
async function gradeCard() {
  const c = zoomC;
  if (!c || !c.grade || c.graded || grading || !c._copy) return false;
  if (cuenta.saldo < M.PRECIO.gradua) { avisoZoom(`Graduar cuesta ${M.PRECIO.gradua} ${MONEDA}: te faltan ${M.PRECIO.gradua - cuenta.saldo}.`); return false; }
  grading = true; Snd.init();
  const z = $('#zoom'), box = $('#zoomCard'), el = box.querySelector('.card'), tl = el.querySelector('.tilt'), sp = REDUCED ? .3 : gradeSpeed;
  z.classList.add('grading'); $('#gradeBtn').hidden = true; $('#showBtn').hidden = true; $('#sellBtn').hidden = true; $('#sellBox').hidden = true; $('#gradeOdds').hidden = true; $('#copies').innerHTML = '';
  $('#zoomInfo').textContent = 'Pagando la graduación…';
  try { await Red.pide('graduar', { c: c._copy.key }); }
  catch (e) { grading = false; z.classList.remove('grading'); zoomUI(); avisoZoom(e.message || 'No se pudo pagar la graduación.'); return false; }
  Snd.coin();
  setTilt(null, null);
  tl.style.setProperty('--rx', '0deg'); tl.style.setProperty('--ry', '0deg'); tl.style.setProperty('--mx', '50%'); tl.style.setProperty('--my', '35%'); tl.style.setProperty('--hov', '0');
  await sleep(250);

  const steps = $('#gradeSteps');
  steps.innerHTML = ['Superficie', 'Esquinas', 'Bordes', 'Centrado'].map(x => `<span class="gs">${x}</span>`).join('');
  steps.hidden = false;
  const st = [...steps.children];
  const stepOn = i => st[i].classList.add('on');
  const stepDone = i => { st[i].classList.remove('on'); st[i].classList.add('done'); Snd.tone(1320, { d: .09, v: .04, type: 'triangle' }); };
  $('#zoomInfo').textContent = 'Inspeccionando la carta…';

  // 1 · escáner
  stepOn(0);
  const scan = document.createElement('div'); scan.className = 'scanline'; box.appendChild(scan);
  Snd.scan(1.5 * sp);
  await scan.animate([{ top: '-2%' }, { top: '99%' }, { top: '-2%' }], { duration: 1500 * sp, easing: 'ease-in-out' }).finished;
  scan.remove();

  // 2 · lupa: muestra la carta aumentada en cada punto
  const W = el.offsetWidth, H = el.offsetHeight, Z = 2.6, D = W * .38, Rr = D / 2;
  const loupe = document.createElement('div'); loupe.className = 'loupe'; loupe.style.width = loupe.style.height = `${D}px`;
  const inner = document.createElement('div');
  inner.className = el.className.replace(/\blit\b/, '') + ' loupe-in';
  inner.style.cssText = el.style.cssText + `;position:absolute;left:0;top:0;width:${W}px;height:${H}px;animation:none;transform-origin:0 0;--mx:50%;--my:50%;--hov:0`;
  inner.innerHTML = el.querySelector('.face.front').outerHTML;
  loupe.appendChild(inner); box.appendChild(loupe);
  const lp = { x: .5, y: .5 };
  const place = () => {
    loupe.style.left = `${lp.x * W}px`; loupe.style.top = `${lp.y * H}px`;
    inner.style.transform = `translate(${Rr - lp.x * W * Z}px, ${Rr - lp.y * H * Z}px) scale(${Z})`;
  };
  const go = (x, y, ms) => new Promise(res => {
    const x0 = lp.x, y0 = lp.y, t0 = performance.now();
    (function f(now) {
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      lp.x = x0 + (x - x0) * e; lp.y = y0 + (y - y0) * e; place();
      if (k < 1) requestAnimationFrame(f); else { Snd.blip(); res(); }
    })(t0);
  });
  place();
  loupe.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  for (const [x, y] of [[.32, .3], [.68, .55], [.4, .78]]) { await go(x, y, 420 * sp); await sleep(140 * sp); }
  stepDone(0); stepOn(1);
  for (const [x, y] of [[.06, .045], [.94, .045], [.94, .955], [.06, .955]]) { await go(x, y, 380 * sp); await sleep(200 * sp); }
  stepDone(1); stepOn(2);
  for (const [x, y] of [[.5, .015], [.985, .5], [.5, .985], [.015, .5]]) { await go(x, y, 380 * sp); await sleep(150 * sp); }
  stepDone(2); stepOn(3);
  await go(.5, .5, 380 * sp);
  await loupe.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished;
  loupe.remove();

  // 3 · centrado: guías sobre los márgenes
  const gd = document.createElement('div'); gd.className = 'cguides'; gd.innerHTML = '<i></i><i></i>';
  box.appendChild(gd);
  Snd.tone(880, { d: .3, v: .03, type: 'sine', to: 1320 });
  await gd.animate([{ opacity: 0, transform: 'scale(1.08)' }, { opacity: 1, transform: 'scale(1)', offset: .3 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: 1000 * sp, easing: 'ease-out' }).finished;
  gd.remove();
  stepDone(3);
  await sleep(250 * sp);

  // 4 · encapsulado
  $('#zoomInfo').textContent = 'Encapsulando…';
  const back = tl.querySelector('.slab-back'), lab = tl.querySelector('.slab-label'), front = tl.querySelector('.slab-front');
  lab.style.opacity = 0; front.style.opacity = 0;
  el.classList.add('slabbing');
  Snd.whoosh(.1);
  back.animate([{ opacity: 0, transform: 'translateZ(-3px) translateY(25%) scale(1.08)' }, { opacity: 1, transform: 'translateZ(-3px)' }],
    { duration: 560 * sp, easing: 'cubic-bezier(.2,1,.3,1)' });
  await sleep(260 * sp);
  el.classList.add('slabbed'); // la carta se encoge hasta su hueco
  await sleep(700 * sp);
  front.style.opacity = '';
  await front.animate([{ opacity: 0, transform: 'translateZ(4px) translateY(-40%)' }, { opacity: 1, transform: 'translateZ(4px)' }],
    { duration: 300, easing: 'cubic-bezier(.6,0,.9,.5)' }).finished;
  Snd.clack(); buzz(25);
  el.animate([{ transform: 'translateY(6px) scale(1.012, .988)' }, { transform: 'none' }], { duration: 280, easing: 'ease-out' });
  front.classList.add('shine');
  { const [x, , r] = centerOf(el); burst(x, r.bottom - r.height * .05, { n: 18, colors: ['#fff', '#cfe8ff'], speed: 5, spread: 1.4, angle: -Math.PI / 2, kinds: ['spark'], gravity: .2 }); }
  await sleep(320 * sp);
  lab.style.opacity = '';
  lab.animate([{ opacity: 0, transform: 'translateZ(2px) translateY(-45%)' }, { opacity: 1, transform: 'translateZ(2px)' }], { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  Snd.flip();
  await sleep(500 * sp);

  // 5 · la nota gira y se fija
  $('#zoomInfo').textContent = 'Calificando…';
  const num = lab.querySelector('.g-num'), word = lab.querySelector('.g-word'), g = c.grade, n = REDUCED ? 3 : 16;
  for (let i = 0; i < n; i++) {
    let v; do v = 1 + (Math.random() * 10 | 0); while (String(v) === num.textContent);
    num.textContent = v; lab.style.setProperty('--gc', gradeColor(v));
    Snd.tone(500 + v * 70, { d: .05, v: .035, type: 'square' });
    await sleep((45 + (i / n) ** 2.4 * 260) * sp);
  }
  num.textContent = g; word.textContent = GRADE_WORD[g];
  lab.style.setProperty('--gc', gradeColor(g)); lab.classList.add(`g${g}`);
  lab.querySelector('.sl-r').animate([{ transform: 'scale(1.7)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  Snd.grade(g); buzz(g >= 9 ? [30, 40, 60] : 20);
  const lr = lab.getBoundingClientRect(), lx = lr.right - lr.width * .16, ly = lr.top + lr.height / 2, gc = gradeColor(g);
  if (g === 10) {
    flash('#ffd23d', .55, 800);
    burst(lx, ly, { n: 110, colors: ['#ffd23d', '#fff', '#ffe9a8', '#ff9ad5'], speed: 15, kinds: ['confetti', 'spark', 'star'], gravity: .2, life: .8 });
    setTimeout(() => burst(lx, ly, { n: 50, colors: ['#fff', '#ffd23d'], speed: 10, kinds: ['star'], gravity: .04 }), 280);
  } else if (g >= 8) burst(lx, ly, { n: 45, colors: [gc, '#fff'], speed: 9, kinds: ['star', 'spark'], gravity: .1 });
  else if (g >= 5) burst(lx, ly, { n: 18, colors: [gc, '#fff'], speed: 6, kinds: ['spark', 'star'], gravity: .12 });
  else burst(lx, ly, { n: 22, colors: ['#8b8798', '#5d596a', gc], speed: 3, kinds: ['spark'], gravity: .45 });

  c.graded = true;
  if (c._copy) c._copy.gr = 1;
  await sleep(400);
  el.classList.remove('slabbing'); front.classList.remove('shine');
  z.classList.remove('grading'); grading = false;
  zoomUI(true);
  setTilt(tl, el, 1.1);
  refreshCard(c);
  return true;
}
/* ---------------- COLECCIÓN ---------------- */
let colFilter = -1, colView = null;
// toca una carta: si tienes varias copias primero las ves todas; con una sola va directo al zoom
const instOf = (c, cp) => pull.find(p => mismaCopia(p._copy, cp)) || fromCopy(c, cp);
function colOpen(c) {
  const list = copies[c.uid] || [];
  if (list.length > 1) { colView = c.uid; renderCollection(); $('#colGrid').scrollTop = 0; return; }
  zoomFromCol(list[0] ? instOf(c, list[0]) : c);
}
function zoomFromCol(inst) {
  colScroll = $('#colGrid').scrollTop;
  $('#collection').hidden = true; zoomVuelve = 'col'; openZoom(inst);
}
let colScroll = 0;
function renderCopies() {
  const c = CARDS.find(x => x.uid === colView), list = [...(copies[c.uid] || [])];
  list.sort((a, b) => (b.gr - a.gr) || (a.gr ? b.g - a.g : 0));
  const gn = list.filter(x => x.gr).length;
  $('#colFilters').innerHTML = `<button class="cv-back">‹ Volver</button><span class="cv-title"><b>${c.name}</b> · ${subtitle(c)} · ${list.length} copias${gn ? ` · ${gn} graduada${gn > 1 ? 's' : ''}` : ''}</span>`;
  $('#colFilters .cv-back').onclick = () => { colView = null; renderCollection(); };
  const grid = $('#colGrid'); grid.innerHTML = ''; grid.classList.add('copies-view');
  list.forEach((cp, i) => {
    const inst = instOf(c, cp), el = makeCard(inst, { back: false, lazy: true });
    el.insertAdjacentHTML('beforeend', `<span class="count cv"${cp.gr ? ` style="--gc:${gradeColor(cp.g)}"` : ''}>${cp.gr ? `Nota <b>${cp.g}</b>` : 'Sin graduar'}</span>${cp.venta ? '<span class="cinta">💰 En venta</span>' : ''}`);
    el.addEventListener('click', () => zoomFromCol(inst));
    el.animate([{ transform: 'translateY(30px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 420, delay: i * 50, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    grid.appendChild(el);
  });
}
function renderCollection() {
  if (colView) return renderCopies();
  $('#colGrid').classList.remove('copies-view');
  const owned = ownedCount();
  const gn = gradedCount();
  $('#colProgress').textContent = `${owned} de ${TOTAL} cartas descubiertas${gn ? ` · ${gn} graduada${gn > 1 ? 's' : ''}` : ''}`;
  $('#colBar').style.width = `${owned / TOTAL * 100}%`;
  $('#colFilters').innerHTML = [[-1, 'Todas', ''], ...TIERS.map((t, i) => [i, t.label, t.sym])]
    .map(([i, l, s]) => {
      const n = i < 0 ? owned : CARDS.filter(c => c.tier === i && col[c.uid]).length, tot = i < 0 ? TOTAL : CARDS.filter(c => c.tier === i).length;
      return `<button data-f="${i}" class="${i === colFilter ? 'on' : ''}" style="--c:${i < 0 ? '#fff' : TIERS[i].color}">${s ? `<i>${s}</i>` : ''}${l} ${n}/${tot}</button>`;
    }).join('');
  $('#colFilters').querySelectorAll('button').forEach(b => b.onclick = () => { colFilter = +b.dataset.f; renderCollection(); });
  const grid = $('#colGrid'); grid.innerHTML = '';
  CARDS.filter(c => colFilter < 0 || c.tier === colFilter).forEach(c => {
    if (col[c.uid]) {
      const cp = bestCopy(c.uid), inst = cp ? fromCopy(c, cp) : c;
      const el = makeCard(inst, { back: false, lazy: true });
      const n = (copies[c.uid] || []).length || col[c.uid];
      if (n > 1) el.insertAdjacentHTML('beforeend', `<span class="count">×${n}</span>`);
      if ((copies[c.uid] || []).some(x => x.venta)) el.insertAdjacentHTML('beforeend', '<span class="cinta">💰 En venta</span>');
      el.addEventListener('click', () => colOpen(c));
      grid.appendChild(el);
    } else {
      grid.insertAdjacentHTML('beforeend', `<div class="slot" style="--c:${TIERS[c.tier].color}"><b>${TIERS[c.tier].sym}</b>N.º ${pad(c.num)}</div>`);
    }
  });
}
function openCollection() {
  prevTilt = prevTilt || [tilt.target, tilt.box, tilt.amp];
  setTilt(null, null);
  colView = null; zoomVuelve = '';
  renderCollection();
  $('#collection').hidden = false;
}
$('#colBtn').onclick = openCollection;
$('#colBtn2').onclick = openCollection;

/* ---------------- RED (con Juegos) ----------------
   El abridor no toca Firebase: pide a la página que lo contiene que cobre
   y escriba, y recibe de ella la cuenta (saldo, sobres, graduadas). */
const EMBEBIDO = window.parent !== window;
const MONEDA = '<svg class="moneda" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#f5b819" stroke="#9a6a08" stroke-width="1.6"/><circle cx="10" cy="10" r="5.6" fill="#ffd54a" stroke="#c98d10" stroke-width="1.2"/><path d="M8.6 7.2v5.6M11.4 7.2v5.6" stroke="#9a6a08" stroke-width="1.4" stroke-linecap="round"/></svg>';
const MAX_EXH = 4;
const PENDIENTE = () => 'prodrop.pendiente.' + cuenta.uid;
const fmt = n => Math.round(n).toLocaleString('es-CL');
const Red = {
  n: 0, espera: new Map(),
  manda(d) { if (EMBEBIDO) parent.postMessage({ canal: 'prodrop-child', ...d }, location.origin); },
  pide(accion, datos) {
    if (!EMBEBIDO) return Promise.reject(new Error('Abre PRODROP desde Juegos para usar tus monedas.'));
    const id = ++this.n;
    return new Promise((ok, mal) => {
      const t = setTimeout(() => { this.espera.delete(id); mal(new Error('Sin respuesta: revisa tu conexión y vuelve a intentarlo.')); }, 20000);
      this.espera.set(id, { ok: x => { clearTimeout(t); ok(x); }, mal: e => { clearTimeout(t); mal(e); } });
      this.manda({ tipo: 'pide', id, accion, ...datos });
    });
  },
};
addEventListener('message', e => {
  if (!EMBEBIDO || e.source !== parent || e.origin !== location.origin || !e.data || e.data.canal !== 'prodrop-parent') return;
  const d = e.data;
  if (d.tipo === 'resp') {
    const w = Red.espera.get(d.id); if (!w) return;
    Red.espera.delete(d.id);
    d.ok ? w.ok(d.dato) : w.mal(new Error(d.error || 'No se pudo.'));
    return;
  }
  if (d.tipo === 'datos') alDatos(d);
});
function alDatos(d) {
  const primera = !cuenta.listo;
  Object.assign(cuenta, { uid: d.uid, saldo: Math.max(0, d.saldo), parada: !!d.parada, falta: d.falta || 0,
    mias: d.mias || [], sobres: d.sobres || {}, gratis: d.gratis || 0, ofertas: d.ofertas || [], ventas: d.ventas || [],
    cambios: d.cambios || [], jugadores: d.jugadores || {}, gente: d.gente || {}, exh: d.exh || [], desfase: d.desfase || 0, listo: true });
  rehazColeccion(); updateColCount(); pintaAvisos();
  if (primera) {
    $('#cargando').hidden = true;
    let k = ''; try { k = localStorage.getItem(PENDIENTE()) || ''; } catch {}
    // un sobre comprado y sin abrir (se cerró la pestaña): se sigue con ese, sin cobrar otra vez
    if (k && cuenta.sobres[k]) newPack(k, cuenta.sobres[k]);
    else tienda();
    return;
  }
  pintaCompra();
  pintaAvisos();
  if (!$('#zoom').hidden && zoomC && !grading) refrescaZoom();
  if (!$('#collection').hidden) renderCollection();
  if (!$('#market').hidden) renderMercado();
}

/* ---------------- COMPRA ----------------
   Un sobre gratis cada 6 horas (desde el último gratis que sacaste) y los
   demás a precio. Ninguno se compra si no alcanza: el botón se apaga, y
   Juegos lo vuelve a comprobar antes de cobrar. */
const precio = () => M.precioSobre(ahora());
const gratisListo = () => cuenta.listo && !cuenta.gratis && !cuenta.parada;
function cuentaAtras(t) {
  const m = Math.max(1, Math.ceil((t - ahora()) / 60000)), h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}
function pintaCompra() {
  const p = precio(), falta = p - cuenta.saldo, promo = p < M.PRECIO.normal, gl = gratisListo();
  $('#saldo').innerHTML = `${MONEDA}<b>${cuenta.listo ? fmt(cuenta.saldo) : '…'}</b>`;
  const f = $('#freeBtn');
  f.innerHTML = gl ? 'Sobre gratis 🎁' : cuenta.gratis ? `🎁 Gratis en ${cuentaAtras(cuenta.gratis)}` : '🎁 Sobre gratis';
  f.disabled = !gl || comprando;
  f.classList.toggle('listo', gl);
  const b = $('#buyBtn');
  b.innerHTML = `Comprar sobre <span class="precio">${promo ? `<s>${M.PRECIO.normal}</s>` : ''}${MONEDA}${p}</span>`;
  b.disabled = !cuenta.listo || falta > 0 || comprando || cuenta.parada;
  b.classList.toggle('primary', !gl); b.classList.toggle('sec', gl);
  const fin = new Date(M.PRECIO.promoHasta - 1).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', timeZone: 'America/Santiago' });
  $('#buyInfo').innerHTML = !cuenta.listo ? 'Cargando tu cuenta…'
    : cuenta.parada ? `<span class="err">Una compra tuya quedó sin fondos y no vale: hasta que ganes ${fmt(cuenta.falta)} monedas más, no puedes gastar.</span>`
    : gl ? `Tu sobre gratis está listo. El siguiente, 6 horas después de abrirlo.`
    : falta > 0 ? `Te faltan <b>${fmt(falta)}</b> monedas para comprar uno. Gánalas jugando en <a href="#" data-volver>Juegos</a>.`
    : promo ? `Precio de lanzamiento hasta el ${fin} (después, ${M.PRECIO.normal}). Tienes ${fmt(cuenta.saldo)}.` : `Tienes ${fmt(cuenta.saldo)} monedas.`;
  const a = $('#againBtn');
  a.innerHTML = `Abrir otro sobre ✳ <span class="precio">${MONEDA}${p}</span>`;
  a.disabled = falta > 0 || comprando || cuenta.parada;
  a.title = falta > 0 ? `Te faltan ${fmt(falta)} monedas` : '';
  const ag = $('#againFreeBtn');
  ag.hidden = !gl; ag.disabled = comprando;
}
setInterval(() => { if (cuenta.listo && cuenta.gratis && ahora() >= cuenta.gratis) cuenta.gratis = 0; if (cuenta.listo) pintaCompra(); }, 20000);
let comprando = false;
async function comprar(drop, gratis) {
  if (comprando || !cuenta.listo) return;
  Snd.init();
  if (gratis ? !gratisListo() : cuenta.parada || cuenta.saldo < precio()) { avisaCompra(); return; }
  comprando = true; pintaCompra();
  $('#buyInfo').textContent = gratis ? 'Abriendo tu sobre gratis…' : 'Comprando…';
  try {
    const r = await Red.pide(gratis ? 'gratis' : 'comprar', gratis ? {} : { p: precio() });
    // la cuenta real llega sola; esto evita ver la vieja un instante
    if (gratis) cuenta.gratis = r.at + 6 * 3600 * 1000; else cuenta.saldo -= r.p;
    cuenta.sobres[r.k] = r.at;
    Snd.coin();
    comprando = false;
    newPack(r.k, r.at, drop);
  } catch (e) {
    comprando = false; pintaCompra();
    $('#buyInfo').innerHTML = `<span class="err">${esc(e.message || 'No se pudo comprar.')}</span>`;
    if (phase === 'summary') toast(e.message || 'No se pudo comprar.', true);
  }
}
function avisaCompra() {
  const b = phase === 'summary' ? $('#againBtn') : $('#buyBtn');
  b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 380 });
  Snd.blip();
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
document.addEventListener('click', e => { const a = e.target.closest('[data-volver]'); if (a) { e.preventDefault(); Red.manda({ tipo: 'volver' }); } });

/* ---------------- GOD PACK ----------------
   2 % de los sobres: cinco épicas o mejores, como mucho una legendaria.
   Se anuncia al romper el sobre, antes de la primera carta. */
async function godPack() {
  const g = $('#god');
  g.hidden = false;
  Snd.god(); buzz([40, 60, 40, 60, 120]);
  flash('#ffe27a', .95, 1200);
  const [x, y] = centerOf(wrap);
  burst(x, y, { n: 160, colors: ['#ffd23d', '#fff', '#ff9ad5', '#9be9ff', '#c26bff'], speed: 18, kinds: ['confetti', 'spark', 'star'], gravity: .12, life: .9 });
  if (!REDUCED) await g.animate([
    { opacity: 0, transform: 'scale(.4) rotate(-6deg)', filter: 'blur(8px)' },
    { opacity: 1, transform: 'scale(1.08) rotate(1deg)', filter: 'blur(0)', offset: .25 },
    { opacity: 1, transform: 'scale(1)', offset: .8 },
    { opacity: 0, transform: 'scale(1.3)', filter: 'blur(4px)' },
  ], { duration: 2300, easing: 'cubic-bezier(.2,.9,.3,1)' }).finished;
  else await sleep(1200);
  g.hidden = true;
}

/* ---------------- PROBABILIDAD ----------------
   Al graduar se dice qué tan raro era sacar algo así: de esta rareza o
   mejor con esta nota o más, por carta y por sobre; y la misma carta con
   esa nota. */
const unoEn = p => p >= 1 ? 'casi todos los sobres' : p > .5 ? `1 de cada ${(1 / p).toFixed(1).replace('.', ',')}` : `1 de cada ${fmt(1 / p)}`;
const pct = p => p >= .1 ? `${(p * 100).toFixed(0)} %` : p >= .001 ? `${(p * 100).toFixed(2).replace('.', ',')} %` : `${(p * 100).toPrecision(2).replace('.', ',')} %`;
function oddsHTML(c) {
  const t = TIERS[c.tier], g = c.grade, p = M.probabilidad(c.n, g);
  const que = `${c.tier === 3 ? 'una Legendaria' : `una ${t.label}${c.tier < 3 ? ' o mejor' : ''}`}${g > 1 ? ` con nota ${g}${g < 10 ? ' o más' : ''}` : ''}`;
  const top = p.porCarta < .001 ? 'épico' : p.porCarta < .02 ? 'raro' : '';
  return `<small>¿QUÉ TAN BUENA ES?</small>
    <p>Sacar ${que}: <b>${unoEn(p.porSobre)}</b> sobres <em>(${pct(p.porCarta)} por carta)</em>.</p>
    <p class="exacta">Esta misma carta con nota ${g}${g < 10 ? ' o más' : ''}: 1 de cada <b>${fmt(1 / p.exacta)}</b> sobres.</p>
    ${top ? `<span class="sello ${top}">${top === 'épico' ? 'Un tirón histórico' : 'Muy por encima de lo normal'}</span>` : ''}`;
}

/* ---------------- EXHIBIR EN EL PERFIL ---------------- */
$('#showBtn').onclick = async () => {
  const c = zoomC; if (!c || !c._copy || grading) return;
  const key = c._copy.key, puesta = cuenta.exh.includes(key);
  const lista = puesta ? cuenta.exh.filter(x => x !== key) : [...cuenta.exh, key].slice(-MAX_EXH);
  const antes = cuenta.exh;
  cuenta.exh = lista; zoomUI(); Snd.flip();
  try { await Red.pide('exhibir', { lista }); }
  catch (e) { cuenta.exh = antes; zoomUI(); avisoZoom(e.message || 'No se pudo guardar.'); }
};
function avisoZoom(t) { $('#zoomInfo').insertAdjacentHTML('beforeend', `<br><span class="err">${t}</span>`); }

/* ---------------- MERCADO ----------------
   Tres pestañas: comprar (lo que otros venden, con filtros), mis ventas
   (y mis compras) e intercambios. Todo lo que se ve llega ya validado
   desde Juegos (la economía): una oferta que se ve está a la venta de
   verdad, y una carta de otro que se ve es suya de verdad. */
const mk = { tab: 'comprar', rareza: -1, grad: 'todas', nota: 0, orden: 'barato', q: '', max: 48 };
let mkScroll = 0;
// una carta de otro (o una oferta) como carta del abridor
function instDe(x) {
  const cp = copiaDe(x), base = CARDS[cp.id];
  return { ...base, grade: cp.g, wseed: cp.s, graded: !!cp.gr, _rec: true };
}
function avatarHTML(u, tam = 22) {
  const g = cuenta.gente[u] || {}, n = g.n || '?', c = /^#[0-9a-f]{6}$/i.test(g.c || '') ? g.c : '#7c5cff';
  const f = typeof g.f === 'string' && /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)[^"'<>()\s\\]+$/.test(g.f) ? g.f : '';
  return `<span class="av" style="--av:${c};width:${tam}px;height:${tam}px">${f ? `<img src="${f}" alt="" referrerpolicy="no-referrer">` : esc(n.trim().charAt(0).toUpperCase() || '?')}</span>`;
}
// miniatura: la imagen con el color de su rareza y su nota, si la tiene
function thumbHTML(x, extra = '') {
  const cp = copiaDe(x), c = CARDS[cp.id];
  return `<span class="mini t${c.tier}" style="--accent:${accentOf(c)}" title="${esc(c.name + ' · ' + subtitle(c) + (cp.gr ? ' · nota ' + cp.g : ''))}">
    <img src="${c.img}" alt="" loading="lazy" draggable="false">${cp.gr ? `<b style="--gc:${gradeColor(cp.g)}">${cp.g}</b>` : ''}${extra}
    <small>${esc(c.name.split(' ')[0])}</small></span>`;
}
const pendientesMios = () => cuenta.cambios.filter(t => t.estado === 'pendiente' && t.para === cuenta.uid).length;
function pintaAvisos() {
  const n = pendientesMios();
  $('#mktBadge').textContent = n || '';
  $('#mktBadge').hidden = !n;
}
function openMercado(tab) {
  prevTilt = prevTilt || [tilt.target, tilt.box, tilt.amp];
  setTilt(null, null);
  if (tab) mk.tab = tab;
  zoomVuelve = '';
  $('#collection').hidden = true;
  renderMercado();
  $('#market').hidden = false;
  $('#mkGrid').scrollTop = 0;
}
$('#mktBtn').onclick = () => openMercado();
function filtradas() {
  const q = mk.q.trim().toLowerCase();
  // las propias también: quien vende tiene que ver que su carta está en la tienda
  let l = cuenta.ofertas.map(o => ({ o, cp: copiaDe(o) }));
  l = l.filter(({ cp }) => {
    const c = CARDS[cp.id];
    if (mk.rareza >= 0 && c.tier !== mk.rareza) return false;
    if (mk.grad === 'si' && !cp.gr) return false;
    if (mk.grad === 'no' && cp.gr) return false;
    if (mk.grad === 'si' && mk.nota && cp.g < mk.nota) return false;
    if (q && !(c.name + ' ' + subtitle(c)).toLowerCase().includes(q)) return false;
    return true;
  });
  const ord = { barato: (a, b) => a.o.p - b.o.p || b.o.t - a.o.t, caro: (a, b) => b.o.p - a.o.p || b.o.t - a.o.t, nuevo: (a, b) => b.o.t - a.o.t };
  return l.sort(ord[mk.orden]);
}
function renderMercado() {
  const nOf = cuenta.ofertas.length, nMias = cuenta.ofertas.filter(o => o.u === cuenta.uid).length, n = pendientesMios();
  $('#mkSub').innerHTML = `${nOf} ${nOf === 1 ? 'carta' : 'cartas'} a la venta${nMias ? ` (${nMias} ${nMias === 1 ? 'tuya' : 'tuyas'})` : ''} · tienes ${MONEDA}<b>${fmt(cuenta.saldo)}</b>`;
  $('#mkTabs').innerHTML = [['comprar', 'Comprar'], ['ventas', 'Mis ventas'], ['cambios', `Intercambios${n ? ` <b>${n}</b>` : ''}`]]
    .map(([k, t]) => `<button role="tab" aria-selected="${mk.tab === k}" data-tab="${k}">${t}</button>`).join('');
  $('#mkTabs').querySelectorAll('button').forEach(b => b.onclick = () => { mk.tab = b.dataset.tab; mk.max = 48; renderMercado(); $('#mkGrid').scrollTop = 0; });
  const grid = $('#mkGrid'), fil = $('#mkFiltros');
  grid.className = 'mk-grid ' + mk.tab;
  if (mk.tab === 'comprar') return renderComprar(fil, grid);
  if (mk.tab === 'ventas') return renderVentas(fil, grid);
  renderCambios(fil, grid);
}
function renderComprar(fil, grid) {
  const enfocado = document.activeElement && document.activeElement.id === 'mkQ';
  fil.innerHTML = `
    <div class="mk-fila">${[[-1, 'Todas', ''], ...TIERS.map((t, i) => [i, t.label, t.sym])].map(([i, l, sy]) =>
      `<button class="mk-chip${i === mk.rareza ? ' on' : ''}" data-r="${i}" style="--c:${i < 0 ? '#fff' : TIERS[i].color}">${sy ? `<i>${sy}</i>` : ''}${l}</button>`).join('')}</div>
    <div class="mk-fila">
      <div class="mk-seg" role="group" aria-label="Graduación">${[['todas', 'Todas'], ['si', 'Graduadas'], ['no', 'Sin graduar']].map(([k, t]) =>
        `<button data-g="${k}" aria-pressed="${mk.grad === k}">${t}</button>`).join('')}</div>
      ${mk.grad === 'si' ? `<label class="mk-sel">Calidad<select id="mkNota"><option value="0">Cualquier nota</option>${[10, 9, 8, 7, 6, 5].map(g =>
        `<option value="${g}"${mk.nota === g ? ' selected' : ''}>${g === 10 ? '10 · GEM MINT' : `${g} o más · ${GRADE_WORD[g]}`}</option>`).join('')}</select></label>` : ''}
      <label class="mk-sel">Ordenar<select id="mkOrden">${[['barato', 'Precio: menor a mayor'], ['caro', 'Precio: mayor a menor'], ['nuevo', 'Más recientes']].map(([k, t]) =>
        `<option value="${k}"${mk.orden === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <input id="mkQ" class="mk-q" type="search" placeholder="Buscar por nombre…" value="${esc(mk.q)}">
    </div>`;
  fil.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { mk.rareza = +b.dataset.r; mk.max = 48; renderMercado(); });
  fil.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { mk.grad = b.dataset.g; if (mk.grad !== 'si') mk.nota = 0; mk.max = 48; renderMercado(); });
  const sn = $('#mkNota'); if (sn) sn.onchange = () => { mk.nota = +sn.value; renderMercado(); };
  $('#mkOrden').onchange = e => { mk.orden = e.target.value; renderMercado(); };
  const qi = $('#mkQ');
  qi.oninput = () => { mk.q = qi.value; pintaGridComprar(grid); };
  qi.onkeydown = e => e.stopPropagation();
  if (enfocado) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  pintaGridComprar(grid);
}
function pintaGridComprar(grid) {
  const l = filtradas();
  grid.innerHTML = '';
  if (!l.length) {
    grid.innerHTML = `<div class="mk-vacio"><b>🃏</b><p>${cuenta.ofertas.length ? 'Nada calza con esos filtros.' : 'Todavía nadie vende cartas. Pon una de las tuyas: ábrela en tu colección y toca «💰 Vender».'}</p></div>`;
    return;
  }
  l.slice(0, mk.max).forEach(({ o }, i) => {
    const inst = instDe(o), el = makeCard(inst, { back: false, lazy: true });
    const propia = o.u === cuenta.uid, caro = !propia && o.p > cuenta.saldo;
    el.insertAdjacentHTML('beforeend', `<div class="mk-tag${caro ? ' caro' : ''}${propia ? ' mia' : ''}"><b>${MONEDA}${fmt(o.p)}</b><span>${propia ? 'Tu oferta' : `${avatarHTML(o.u, 16)}${esc(nombreDe(o.u))}`}</span></div>`);
    if (inst.graded) el.classList.add('slabbed');
    el.addEventListener('click', () => { mkScroll = grid.scrollTop; inst._oferta = o; $('#market').hidden = true; zoomVuelve = 'mk'; openZoom(inst); });
    if (i < 24) el.animate([{ transform: 'translateY(24px) scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: i * 30, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    grid.appendChild(el);
  });
  if (l.length > mk.max) {
    const b = document.createElement('button'); b.className = 'btn mk-mas'; b.textContent = `Ver ${Math.min(48, l.length - mk.max)} más`;
    b.onclick = () => { mk.max += 48; pintaGridComprar(grid); };
    grid.appendChild(b);
  }
}
const cuando = t => { const m = Math.round((ahora() - t) / 60000); return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
function renderVentas(fil, grid) {
  fil.innerHTML = `<p class="mk-nota">Pon una carta a la venta desde tu colección: ábrela y toca «💰 Vender». Mientras está a la venta no se puede graduar ni intercambiar.</p>`;
  const l = cuenta.ventas;
  if (!l.length) { grid.innerHTML = `<div class="mk-vacio"><b>💰</b><p>Todavía no vendes ni compras nada.</p></div>`; return; }
  const ESTADO = { activa: ['En venta', 'act'], vendida: ['Vendida', 'ok'], retirada: ['Retirada', ''], impaga: ['No se pagó', 'mal'] };
  grid.innerHTML = l.map(o => {
    const compra = o.comprador === cuenta.uid && o.u !== cuenta.uid, [et, cl] = compra ? ['Comprada', 'ok'] : ESTADO[o.estado] || [o.estado, ''];
    const quien = compra ? `a ${avatarHTML(o.u, 16)}<b>${esc(nombreDe(o.u))}</b>` : o.estado === 'vendida' ? `a ${avatarHTML(o.comprador, 16)}<b>${esc(nombreDe(o.comprador))}</b>` : '';
    return `<div class="mk-fila-v">${thumbHTML(o)}
      <div class="mk-v-tx"><span class="mk-est ${cl}">${et}</span><b>${esc(CARDS[copiaDe(o).id].name)}</b><small>${esc(subtitle(CARDS[copiaDe(o).id]))} ${quien ? '· ' + quien : ''}</small><small>${cuando(o.fin || o.t)}</small></div>
      <div class="mk-v-p">${compra ? '−' : o.estado === 'vendida' ? '+' : ''}${MONEDA}${fmt(o.p)}</div>
      ${o.estado === 'activa' && o.u === cuenta.uid ? `<button class="btn mk-mini" data-retira="${esc(o.id)}">Retirar</button>` : ''}</div>`;
  }).join('');
  grid.querySelectorAll('[data-retira]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await Red.pide('retirar', { id: b.dataset.retira }); toast('Retirada del mercado.'); } catch (e) { b.disabled = false; toast(e.message, true); }
  });
}
function lado(xs, quien, vacio) {
  return `<div class="tc-lado"><small>${quien}</small><div class="tc-cartas">${xs.length ? xs.map(x => thumbHTML(x)).join('') : `<span class="tc-nada">${vacio}</span>`}</div></div>`;
}
function renderCambios(fil, grid) {
  const otros = Object.keys(cuenta.jugadores).length, mias = cuenta.mias.filter(x => !x.venta).length;
  fil.innerHTML = `<div class="mk-fila"><button class="btn primary" id="tcNuevo"${!otros || !mias || cuenta.parada ? ' disabled' : ''}>⇄ Proponer un intercambio</button>
    <p class="mk-nota">${!mias ? 'Necesitas al menos una carta que no esté a la venta.' : !otros ? 'Todavía nadie más tiene cartas para cambiar.' : 'Ofrece de 1 a 3 cartas tuyas a cambio de hasta 3 de otra persona. Se hace cuando la otra persona acepta.'}</p></div>`;
  $('#tcNuevo').onclick = () => abreTrato();
  const l = cuenta.cambios;
  if (!l.length) { grid.innerHTML = `<div class="mk-vacio"><b>⇄</b><p>No tienes intercambios todavía.</p></div>`; return; }
  const ESTADO = { pendiente: ['Pendiente', 'act'], hecho: ['Hecho', 'ok'], nulo: ['No se pudo', 'mal'], cerrado: ['Cerrado', ''] };
  grid.innerHTML = l.map(t => {
    const yoDoy = t.de === cuenta.uid, otro = yoDoy ? t.para : t.de, [et, cl] = ESTADO[t.estado] || [t.estado, ''];
    const deMi = yoDoy ? t.dar : t.pedir, deEl = yoDoy ? t.pedir : t.dar;
    let acc = '';
    if (t.estado === 'pendiente') acc = yoDoy
      ? `<button class="btn mk-mini" data-cierra="${esc(t.id)}">Cancelar</button>`
      : `<button class="btn primary mk-mini" data-acepta="${esc(t.id)}"${t.posible ? '' : ' disabled title="Alguna carta cambió de dueño o está a la venta"'}>Aceptar</button><button class="btn mk-mini" data-cierra="${esc(t.id)}">Rechazar</button>`;
    return `<div class="tc-fila ${t.estado}">
      <header><span class="mk-est ${cl}">${et}</span>${avatarHTML(otro, 20)}<b>${esc(nombreDe(otro))}</b><small>${yoDoy ? 'le propusiste' : 'te propone'} · ${cuando(t.fin || t.at)}</small></header>
      <div class="tc-cuerpo">${lado(deMi, 'Tú das', 'nada')}<span class="tc-flecha" aria-hidden="true">⇄</span>${lado(deEl, `${esc(nombreDe(otro))} da`, 'nada (un regalo)')}</div>
      ${t.estado === 'pendiente' && !t.posible ? '<p class="mk-nota err">Ya no se puede: alguna carta cambió de dueño o está a la venta.</p>' : ''}
      ${acc ? `<div class="tc-acc">${acc}</div>` : ''}</div>`;
  }).join('');
  grid.querySelectorAll('[data-acepta]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await Red.pide('aceptar', { id: b.dataset.acepta }); Snd.reveal(1); toast('¡Intercambio hecho!'); } catch (e) { b.disabled = false; toast(e.message, true); }
  });
  grid.querySelectorAll('[data-cierra]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await Red.pide('cerrar', { id: b.dataset.cierra }); toast('Cerrado.'); } catch (e) { b.disabled = false; toast(e.message, true); }
  });
}

/* ---------------- PROPONER UN INTERCAMBIO ---------------- */
const trato = { para: '', dar: [], pedir: [] };
const ordenCartas = l => [...l].sort((a, b) => { const ca = copiaDe(a), cb = copiaDe(b); return CARDS[cb.id].tier - CARDS[ca.id].tier || (cb.gr ? cb.g : 0) - (ca.gr ? ca.g : 0) || CARDS[ca.id].num - CARDS[cb.id].num; });
function abreTrato(para) {
  Object.assign(trato, { para: para || '', dar: [], pedir: [] });
  $('#market').hidden = true; $('#trade').hidden = false;
  pintaTrato();
}
function pintaTrato() {
  const box = $('#tradeBody');
  if (!trato.para) {
    const js = Object.entries(cuenta.jugadores).sort((a, b) => nombreDe(a[0]).localeCompare(nombreDe(b[0])));
    box.innerHTML = `<h3>¿Con quién?</h3><div class="tc-gente">${js.map(([u, l]) =>
      `<button class="tc-persona" data-u="${esc(u)}">${avatarHTML(u, 34)}<b>${esc(nombreDe(u))}</b><small>${l.length} ${l.length === 1 ? 'carta' : 'cartas'}</small></button>`).join('')}</div>`;
    box.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { trato.para = b.dataset.u; pintaTrato(); });
    return;
  }
  const mias = ordenCartas(cuenta.mias.filter(x => !x.venta)), suyas = ordenCartas(cuenta.jugadores[trato.para] || []);
  const sel = (l, x) => l.includes(x.c);
  const rej = (l, elegidas, d) => `<div class="tc-rejilla" data-lado="${d}">${l.map(x => `<button class="tc-elige${sel(elegidas, x) ? ' on' : ''}" data-c="${esc(x.c)}">${thumbHTML(x)}</button>`).join('') || '<p class="mk-nota">Nada para elegir.</p>'}</div>`;
  box.innerHTML = `<div class="tc-cab"><button class="btn mk-mini" id="tcOtra">‹ Otra persona</button>${avatarHTML(trato.para, 26)}<b>${esc(nombreDe(trato.para))}</b></div>
    <div class="tc-cols">
      <section><h3>Tú das <small>${trato.dar.length}/3</small></h3>${rej(mias, trato.dar, 'dar')}</section>
      <section><h3>Pides <small>${trato.pedir.length}/3</small></h3>${rej(suyas, trato.pedir, 'pedir')}</section>
    </div>
    <div class="tc-envio"><button class="btn primary" id="tcEnviar"${trato.dar.length ? '' : ' disabled'}>Enviar propuesta</button>
      <span class="mk-nota">${trato.dar.length ? (trato.pedir.length ? '' : 'Sin pedir nada, es un regalo.') : 'Elige al menos una carta tuya.'}</span></div>`;
  $('#tcOtra').onclick = () => { trato.para = ''; trato.dar = []; trato.pedir = []; pintaTrato(); };
  box.querySelectorAll('.tc-rejilla').forEach(r => r.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    const l = trato[r.dataset.lado], c = b.dataset.c, i = l.indexOf(c);
    if (i >= 0) l.splice(i, 1); else if (l.length < 3) l.push(c); else { b.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 220 }); return; }
    Snd.blip(); const top = r.scrollTop; pintaTrato(); const r2 = box.querySelector(`.tc-rejilla[data-lado="${r.dataset.lado}"]`); if (r2) r2.scrollTop = top;
  }));
  $('#tcEnviar').onclick = async () => {
    const b = $('#tcEnviar'); b.disabled = true;
    try {
      await Red.pide('proponer', { para: trato.para, dar: trato.dar, pedir: trato.pedir });
      Snd.coin(); toast(`Propuesta enviada a ${nombreDe(trato.para)}.`);
      $('#trade').hidden = true; mk.tab = 'cambios'; renderMercado(); $('#market').hidden = false;
    } catch (e) { b.disabled = false; toast(e.message, true); }
  };
}

/* ---------------- INICIO ----------------
   Se espera a la cuenta: sin ella no se sabe el saldo ni qué cartas tienes. */
$('#volverBtn').hidden = !EMBEBIDO;
$('#volverBtn').onclick = () => Red.manda({ tipo: 'volver' });
pintaCompra();
if (EMBEBIDO) Red.manda({ tipo: 'listo' });
else $('#cargando').innerHTML = '<p>PRODROP se abre desde <a href="../../juegos.html#cartas">Juegos</a>: ahí están tus monedas y tu colección.</p>';
