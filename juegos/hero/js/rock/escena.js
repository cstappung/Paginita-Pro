// Batalla de Rock — la escena 3D (el escenario, los rockeros, el público, el editor y las cajas).
//
// Es el paquete del dueño («BATALLA DE ROCK», un solo index.html con Three.js) vuelto módulo: el mismo
// código, sin el panel del director ni la grabación, con el catálogo aparte (./catalogo.js) y una API
// (`rock`, al final) con la que PRO HERO lo usa de dos maneras:
// - **el editor** («Tu rockero», en el menú del juego): el rockero se arma con lo que tienes, y las cajas
//   se compran con las monedas de verdad (las abre la página, colabtex/src/juegos/hero.js);
// - **el fondo de una canción**: `enVivo` + `pulso` cada cuadro. Con rival es la batalla (tu rockero a la
//   izquierda, el de tu rival a la derecha, el ánimo sale de los puntajes); sin rival, tocas solo al centro.
// Three.js 0.160.0 viene del mapa de módulos de index.html (cdn.jsdelivr.net), y solo se baja si se usa.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ROCKERS, ED_CAT, PAL, defaultLook, randomLook, normalizeLook, getP, setP, ED_FIELDS, legDefaults, sanitizeLook,
  INV_CATS, invItem, invVar, invId, iniciales, lookPosible, PRECIO_CAJA, REEMBOLSO,
} from './catalogo.js';


/* =====================================================================
   UTILIDADES
   ===================================================================== */
const $ = s => document.querySelector(s);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const smooth = t => t * t * (3 - 2 * t);
const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(Date.now() & 0xffff);
const rr = (a, b) => a + (b - a) * R();
const pick = a => a[Math.floor(R() * a.length)];
const wpick = obj => { let s = 0; for (const k in obj) s += Math.max(0, obj[k]); let r = R() * s; for (const k in obj) { r -= Math.max(0, obj[k]); if (r <= 0) return k; } return Object.keys(obj)[0]; };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const gauss = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));

/* =====================================================================
   CONFIGURACIÓN — edita aquí para crear variantes
   ===================================================================== */
const SY = 1.8;           // altura del piso del escenario
const BPM = 140, BEAT = 60 / BPM, S16 = BEAT / 4, BAR = BEAT * 4;
/* ---------- modelo base: dos cuerpos (hombre / mujer). Todo lo demás es personalizable ---------- */
const BASE_BUILD = {
  m: { sw: 0.28, chest: 0.232, waist: 0.145, hip: 0.165, arm: 1.0, bust: 0, height: 1.0, neck: 0.012, shX: 0.95, shY: 0 },
  f: { sw: 0.215, chest: 0.19, waist: 0.122, hip: 0.168, arm: 1.0, bust: 1, height: 0.96, neck: -0.008, shX: 0.86, shY: 0.03 },   // shX/shY: articulación del hombro (en la mujer más adentro y más baja: hombro caído, sin escalón)
};
const BASE_FACE = {
  m: { eyeSize: 1, eyeGap: 1, nose: 1, noseW: 1, lips: 0.8, mouthW: 1, jaw: 1, chin: 1, cheek: 0.7, browThick: 1, browArch: 0.25, browRidge: 1 },
  f: { eyeSize: 1.12, eyeGap: 1, nose: 0.95, noseW: 1.0, lips: 1.3, mouthW: 0.92, jaw: 0.25, chin: 0.55, cheek: 1, browThick: 0.85, browArch: 0.7, browRidge: 0.35 },
};

const BAND = {
  singer: { name: 'Max', ui: '#ffd23a', body: 'm', skin: 0xe9b98f, face: { eyes: 0x2a4a7a, brow: 0x9a7a3a, jaw: 1.05 },
    hair: { style: 'long', color: 0xe8c86a, color2: 0xf6e3a0 }, beard: { type: 'goatee', color: 0xc8a050 },
    top: { type: 'tee', color: 0x151515 }, bottom: { type: 'jeans', color: 0x2e3d63 }, belt: 0x222222, shoes: { type: 'boot', color: 0x151515 },
    acc: { gloves: 0x111111, wrist: 0x222222 }, build: { sw: 0.275, chest: 0.225, waist: 0.14, hip: 0.16 } },
  drummer: { name: 'Bruno', ui: '#ffffff', body: 'm', skin: 0xe2ad84, face: { eyes: 0x3a2a18, brow: 0x3a2412, nose: 1.15, jaw: 1.2 },
    hair: { style: 'short', color: 0x7a4a22 }, beard: { type: 'full', color: 0x6a3e1a },
    top: { type: 'tee', color: 0xeeeeee }, bottom: { type: 'shorts', color: 0x6b5a3e }, legwear: { type: 'socks', color: 0xffffff },
    shoes: { type: 'sneaker', color: 0xd8262b }, acc: { sweatband: true }, build: { sw: 0.29, chest: 0.24, waist: 0.16, hip: 0.17, arm: 1.05 } },
};

/* ---------- la capa del editor: su CSS y su HTML (los del paquete, sin el panel del director) ---------- */
if (!document.querySelector('link[data-rock-fuentes]')) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.rockFuentes = '';
  l.href = 'https://fonts.googleapis.com/css2?family=Bangers&family=Rubik:wght@500;700;900&display=swap'; document.head.append(l);
}
const ROCK_CSS = `#editor{position:fixed;top:0;right:0;bottom:0;width:min(400px,100vw);background:rgba(12,8,22,.93);border-left:3px solid #000;display:flex;flex-direction:column;z-index:40;font-size:13px;transition:transform .3s;font-family:Rubik,system-ui,sans-serif;color:#fff;box-sizing:border-box}
#editor.off{transform:translateX(105%);pointer-events:none}
#editor .ttl{font-family:Bangers,Impact,sans-serif;font-size:26px;letter-spacing:1px;color:#ffd23a;text-shadow:2px 2px 0 #000;padding:12px 14px 6px}
#edName{display:block;width:calc(100% - 28px);margin:0 14px;background:#221838;border:2px solid #000;border-radius:9px;color:#fff;font:inherit;font-weight:900;font-size:15px;padding:7px 9px}
#edTabs{display:flex;flex-wrap:wrap;gap:4px;padding:10px 14px 6px}
#edPane{flex:1;overflow:auto;padding:2px 14px 14px;scrollbar-width:thin}
#editor button,#edViews button{border:2px solid #000;border-radius:9px;padding:6px 8px;font:inherit;font-weight:900;background:#2b2140;color:#fff;cursor:pointer;box-shadow:0 3px 0 #000}
#editor button:active,#edViews button:active{transform:translateY(2px);box-shadow:0 1px 0 #000}
#editor button:disabled{opacity:.4;cursor:default}
#edTabs button{flex:1 1 auto;padding:6px 7px;font-size:12px}
#edTabs button.on,#edViews button.on,#editor .chip.on{background:#ffd23a;color:#1a1020}
#editor .eg{margin:12px 0 4px}
#editor .eg>b{display:block;color:#c9b8ec;font-size:11px;letter-spacing:.6px;text-transform:uppercase;margin-bottom:6px}
#editor .chips{display:flex;flex-wrap:wrap;gap:5px}
#editor .chip{border-radius:999px;padding:5px 11px;font-weight:700;box-shadow:0 2px 0 #000}
#editor .sws{display:flex;flex-wrap:wrap;gap:6px}
#editor .sw{width:26px;height:26px;padding:0;border-radius:50%;box-shadow:0 2px 0 #000}
#editor .sw.on{outline:3px solid #ffd23a;outline-offset:2px}
#editor .sw.pick{position:relative;overflow:hidden;display:inline-block;border:2px solid #000;background:conic-gradient(#f33,#fd3,#3f6,#3df,#46f,#e4f,#f33);cursor:pointer}
#editor .sw.pick input{position:absolute;inset:-6px;opacity:0;cursor:pointer}
#editor .ehint{color:#a99bc8;font-size:11.5px;line-height:1.4;margin:6px 0}
#editor .tatl{display:flex;align-items:center;gap:8px;background:#221838;border:2px solid #000;border-radius:9px;padding:5px 8px;margin:5px 0;font-weight:700}
#editor .tatl i{width:16px;height:16px;border-radius:50%;border:2px solid #000;flex:none}
#editor .tatl span{flex:1}
#editor .chip.leg{background:linear-gradient(100deg,#3a1660,#8a2a9a,#d0641a,#3a1660);background-size:300% 100%;animation:legS 3s linear infinite;color:#ffe9a8;text-shadow:0 0 6px #ff9a3a}
#editor .chip.leg::before{content:'★ ';color:#ffd23a}
#editor .chip.leg.on{background:linear-gradient(100deg,#ffd23a,#fff4b0,#ff9a2a,#ffd23a);background-size:300% 100%;color:#1a1020;text-shadow:none}
#editor .chip.leg.on::before{color:#b0401a}
@keyframes legS{to{background-position:-300% 0}}
@media (prefers-reduced-motion:reduce){#editor .chip.leg{animation:none}}
#editor .add{width:100%;margin-top:12px;background:linear-gradient(#ff5a3a,#d4231a)}
#edFoot{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 14px 14px;border-top:2px solid #000}
#edFoot .hot{background:linear-gradient(#ff5a3a,#d4231a)}
#edFoot .wide{grid-column:1/3}
#edViews{position:fixed;left:14px;bottom:14px;display:flex;flex-wrap:wrap;gap:6px;z-index:7;font-size:13px}
#edViews.off{display:none}
#edToast{position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#ffd23a;color:#1a1020;border:3px solid #000;border-radius:12px;padding:8px 16px;font-weight:900;z-index:9;opacity:0;transition:opacity .3s;pointer-events:none}
#edToast.on{opacity:1}
#editor .chip.lock{opacity:.6;background:#1a1428;color:#9a8cb8;box-shadow:0 2px 0 #000}
#editor .chip.lock::after{content:' 🔒';font-size:10px}
#editor .chip.leg.lock{animation:none;background:#2a1838;color:#c9a86a;text-shadow:none}
#editor .coins{margin:12px 0 4px;background:linear-gradient(#3a2a10,#22180a);border:2px solid #000;border-radius:12px;padding:9px 12px;font-size:17px;font-weight:900;color:#ffd23a;box-shadow:0 3px 0 #000}
#editor .boxc{display:flex;gap:12px;align-items:center;margin:12px 0 0;background:#221838;border:2px solid #000;border-radius:12px;padding:10px 12px}
#editor .boxi{font-size:40px;line-height:1}
#editor .boxc b{display:block;font-size:15px;color:#fff;margin-bottom:2px}
#editor .boxc span{color:#a99bc8;font-size:12px;line-height:1.4}
#editor .colr{display:grid;grid-template-columns:1fr 70px 70px;align-items:center;gap:8px;margin:6px 0;font-weight:700}
#editor .colr i{height:8px;background:#221838;border:2px solid #000;border-radius:99px;overflow:hidden}
#editor .colr u{display:block;height:100%;background:linear-gradient(90deg,#ff9a2a,#ffd23a)}
#editor .colr em{font-style:normal;color:#c9b8ec;font-size:12px;text-align:right}
#editor.busy #edPane,#editor.busy #edFoot,#editor.busy #edTabs{pointer-events:none;opacity:.5}
.coin{display:inline-block;width:1em;height:1em;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff6b0,#ffc21a 50%,#b8700c);border:2px solid #000;vertical-align:-.18em;box-sizing:border-box}
.dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #000;margin-right:5px;vertical-align:-2px}
#boxUI{position:fixed;left:calc((100vw - min(400px,100vw)) / 2);bottom:60px;transform:translate(-50%,24px);opacity:0;pointer-events:none;transition:opacity .35s,transform .35s;z-index:8;background:rgba(12,8,22,.94);border:3px solid #000;border-radius:16px;padding:12px 16px 14px;text-align:center;min-width:270px;box-shadow:0 5px 0 #000;font-size:13px;color:#fff}
#boxUI.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
#boxUI.leg{border-color:#ffd23a;box-shadow:0 0 0 3px #000,0 0 26px #ffb02a}
#boxUI .rar{font-family:Bangers,Impact,sans-serif;font-size:24px;letter-spacing:1px;text-shadow:2px 2px 0 #000}
#boxUI .nm{font-size:19px;font-weight:900;margin:2px 0 4px}
#boxUI .sub{color:#c9b8ec;margin-bottom:11px}
#boxUI .bt{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
#boxUI button{border:2px solid #000;border-radius:9px;padding:7px 10px;font:inherit;font-weight:900;background:#2b2140;color:#fff;cursor:pointer;box-shadow:0 3px 0 #000}
#boxUI button:active{transform:translateY(2px);box-shadow:0 1px 0 #000}
#boxUI button:disabled{opacity:.4;cursor:default}
#boxUI button.hot{background:linear-gradient(#ff5a3a,#d4231a)}
@media (max-width:700px){#boxUI{left:50%;bottom:calc(56vh + 54px)}}
@media (max-width:700px){#editor{top:auto;height:56vh;width:100vw;border-left:0;border-top:3px solid #000}#edViews{left:8px;bottom:calc(56vh + 8px)}#editor .ttl{display:none}}

.rock-capa,.rock-capa *{box-sizing:border-box}
.rock-capa{font-family:Rubik,system-ui,sans-serif;color:#fff}
#edViews{z-index:39}#edToast{z-index:42}#boxUI{z-index:41}
canvas.rock-lienzo{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
#editor .sws .sw.venta{opacity:.45;position:relative}
#editor .sws .sw.venta::after{content:'🏪';position:absolute;right:-6px;bottom:-6px;font-size:12px}
#editor .sell{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0;background:#221838;border:2px solid #000;border-radius:10px;padding:6px 8px;font-weight:700;font-size:12px}
#editor .sell span{flex:1 1 100%}
#editor .sell input{width:96px;background:#120c20;color:#fff;border:2px solid #000;border-radius:8px;padding:4px 6px;font:inherit}
#editor input:focus{outline:2px solid #ffd23a}`;
document.head.append(Object.assign(document.createElement('style'), { textContent: ROCK_CSS }));
const CAPA = document.createElement('div');
CAPA.className = 'rock-capa';
CAPA.innerHTML = `<div id="editor" class="off">
  <div class="ttl">TU ROCKERO</div>
  <input id="edName" maxlength="24" placeholder="Nombre del rockero" aria-label="Nombre" translate="no">
  <div id="edTabs"></div>
  <div id="edPane"></div>
  <div id="edFoot">
    <button id="edRand">🎲 Aleatorio</button><button id="edSave" class="hot">💾 Guardar</button>
    <button id="edClose" class="wide">✕ Cerrar</button>
  </div>
</div>
<div id="edViews" class="off"></div>
<div id="edToast"></div>
<div id="boxUI" role="dialog" aria-live="polite"></div>`;
document.body.append(CAPA);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* =====================================================================
   INVENTARIO — lo manda la página (colabtex/src/juegos/hero.js): las monedas de verdad, lo inicial y lo que
   sacaste de las cajas. La escena no decide nada que valga dinero: abrir una caja es pedírsela a la página,
   que la compra y la deriva con la hora del servidor (rock-datos.js).
   ===================================================================== */
const BOX_PRICE = PRECIO_CAJA;
const invBg = c => { const cs = Object.values(c).map(cssC); return cs.length < 2 ? cs[0] : `conic-gradient(${cs.map((x, i) => `${x} ${i / cs.length * 100}% ${(i + 1) / cs.length * 100}%`).join(',')})`; };
/* own: [{b, k, t, c, leg, copia?, venta?}] — lo inicial (sin copia) y lo tuyo; last: los últimos premios */
let INV = { coins: 0, parada: false, own: iniciales().map(v => ({ ...v })), opened: 0, last: [] };
/* para ponerse solo cuenta lo que no está a la venta (lo que está en el mercado no se usa) */
const invHas = (b, k, t) => t === 'none' || INV.own.some(v => v.b === b && v.k === k && v.t === t && !v.venta);
const invVariants = (b, k, t) => INV.own.filter(v => v.b === b && v.k === k && v.t === t && !v.venta);
const invTodas = (b, k, t) => INV.own.filter(v => v.b === b && v.k === k && v.t === t);
/* aleatorio del editor: solo piezas del inventario (con sus colores) */
function invClamp(L) {
  for (const k in INV_CATS) {
    const o = L[k]; if (!o?.type) continue;
    const vs = o.type === 'none' ? [] : invVariants(L.body, k, o.type), all = INV.own.filter(v => v.b === L.body && v.k === k && !v.venta);
    const v = vs.length ? pick(vs) : o.type === 'none' ? null : pick(all);
    if (v) Object.assign(o, { type: v.t }, v.c); else if (o.type !== 'none') o.type = 'none';
  }
  return L;
}

/* presets de cara → parámetros numéricos (los números sueltos en cfg.face siguen mandando) */
const FACE_PRE = {
  faceShape: {
    ovalF: { faceW: 0.93 }, corazonF: { faceW: 0.95, jaw: 0.06, chin: 0.38, cheek: 1.35 }, redondaF: { faceW: 1.0, jaw: 0.58, chin: 0.45, cheek: 1.25, faceLong: 0.965 }, fina: { faceW: 0.87, jaw: 0.18, chin: 0.72, faceLong: 1.035 }, suave: { faceW: 0.97, jaw: 0.78, chin: 0.62, cheek: 0.85 },
    cuadrada: { jaw: 1.25, chin: 1.1, faceW: 1.02 }, ovalM: { jaw: 0.7, chin: 0.9, faceW: 0.96 }, alargada: { jaw: 0.95, chin: 1.15, faceW: 0.91, faceLong: 1.045 }, redondaM: { jaw: 0.52, chin: 0.85, faceW: 1.05, cheek: 1.05, faceLong: 0.965 }, angulosa: { jaw: 1.15, chin: 1.3, cheek: 1.35, faceW: 0.95, browRidge: 1.6 },
  },
  eyeShape: {
    grandes: {}, almendra: { eyeSize: 1.06, eyeOpen: 0.82, lowLid: 0.78, tilt: 1.5, irisK: 0.96 }, gata: { eyeSize: 1.1, eyeOpen: 0.74, lowLid: 0.7, tilt: 3, liner: 1.6, irisK: 0.92 }, redondos: { eyeSize: 1.08, eyeOpen: 1.16, lowLid: 1.25, tilt: -0.6, irisK: 0.9 },
    normales: {}, rasgados: { eyeOpen: 0.7, lowLid: 0.72, tilt: 1.3 }, intensos: { eyeOpen: 0.8, tilt: -0.6, irisK: 0.86, browDrop: 0.004 }, abiertos: { eyeSize: 1.12, eyeOpen: 1.1, lowLid: 1.1 }, cansados: { eyeOpen: 0.64, tilt: -1.4, lowLid: 0.9 },
  },
  browStyle: {
    arqueadas: { browThick: 0.85, browArch: 0.95 }, finas: { browThick: 0.52, browArch: 0.75, browLen: 0.95 }, rectasF: { browThick: 0.8, browArch: 0.08, browStraight: 0.5 }, corte: { browThick: 0.85, browArch: 0.7, browSlit: 1 },
    gruesas: { browThick: 1.3, browArch: 0.25, browStraight: 0.4 }, rectasM: { browThick: 1.05, browArch: 0.0, browStraight: 0.85 }, pobladas: { browThick: 1.5, browArch: 0.3, browBushy: 1, browStraight: 0.5 }, cicatriz: { browThick: 1.15, browArch: 0.25, browSlit: 1, scar: 1 },
  },
  mkStyle: {
    ningunoF: { makeup: 0, liner: 0.4 }, natural: { makeup: 0.6 }, ahumado: { makeup: 1.3 }, gotico: { makeup: 1.4, mkGoth: 1, liner: 1.3 }, glam: { makeup: 1.2, glitter: 1, liner: 1.5, lashLen: 1.5 }, estrellaMk: { makeup: 0.4, star: 1 }, cristales: { makeup: 0.7, legMk: 3, liner: 1.4 }, aurora: { makeup: 0, legMk: 4, liner: 1.3, lashLen: 1.3 },
    grietas: { legMk: 5, makeup: 0 }, mariposaMk: { makeup: 0.3, legMk: 6, liner: 1.4, lashLen: 1.4 },
    ninguno: {}, delineado: { guyliner: 1, lineW: 0.78 }, corpse: { corpse: 1, lineW: 0.78 }, guerra: { warpaint: 1 }, ojeras: { bags: 1 }, calaNeon: { lineW: 0.78, legMk: 1, makeup: 0 }, runas: { legMk: 2, makeup: 0 },
  },
};
const IRIS_I = { clasico: 0, brillo: 1, corazon: 2, estrella: 3, degradado: 4, felino: 5, anillo: 6, hetero: 7, fantasma: 8, rayo: 9, eclipse: 10, galaxia: 11, latido: 12, vortice: 13, prisma: 14 };
function faceParams(body, face = {}) {
  const pre = {}; for (const k of ['faceShape', 'eyeShape', 'browStyle', 'mkStyle']) Object.assign(pre, FACE_PRE[k][face[k]] || {});
  const F = { ...BASE_FACE[body], ...pre, ...face };
  if (face.mkColor !== undefined && face.shadow === undefined) F.shadow = face.mkColor;
  F.irisStyle = IRIS_I[face.eyeStyle] ?? 0;
  return F;
}
const ATTACKS = {
  shock:  { name: '¡DESCARGA!',    color: '#6fd8ff', bolt: [1.4, 2.6, 6.0] },
  fire:   { name: '¡LLAMARADA!',   color: '#ff8a2a', bolt: [6.0, 2.2, 0.5] },
  broken: { name: '¡CUERDA ROTA!', color: '#ffd23a', bolt: [5.0, 4.2, 0.8] },
  lefty:  { name: '¡GIRO ZURDO!',  color: '#9dff4a', bolt: [1.4, 5.0, 1.0] },
  amp:    { name: '¡AMP FRITO!',   color: '#e08cff', bolt: [4.0, 1.4, 6.0] },
};
const SONG_SECTIONS = [['intro', 5], ['verse', 8], ['pre', 4], ['chorus', 8], ['verse', 8], ['chorus', 8], ['solo', 8], ['break', 4], ['chorus', 8], ['outro', 2]];
const SECTION_I = { intro: 0.55, verse: 0.62, pre: 0.78, chorus: 1, solo: 1, break: 0.88, outro: 1 };
const ATTACK_BARS = [9, 16, 20, 24, 30, 36, 41, 45, 50, 55, 59];
const KO_BAR = 61;

/* =====================================================================
   RENDER + POSTPROCESO
   ===================================================================== */
const canvas = document.createElement('canvas'); canvas.className = 'rock-lienzo';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(Math.max(2, innerWidth), Math.max(2, innerHeight), false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1b20, 38, 130);
const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 500);
camera.position.set(0, 6, 16);

const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); bvec4 bad = bvec4(c.r != c.r, c.g != c.g, c.b != c.b, c.a != c.a); gl_FragColor = any(bad) ? vec4(0.0, 0.0, 0.0, 1.0) : clamp(c, 0.0, 64.0); }`,
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.5, 1.1);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.42 }, uSat: { value: 1.14 }, uCon: { value: 1.07 }, uGrain: { value: 0.02 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uVig,uSat,uCon,uGrain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec4 c=texture2D(tDiffuse,vUv); vec3 col=c.rgb;
      float l=dot(col,vec3(0.2126,0.7152,0.0722)); col=mix(vec3(l),col,uSat); col=max((col-0.18)*uCon+0.18,0.0);
      vec2 d=vUv-0.5; col*=1.0-uVig*dot(d,d)*2.4;
      col+=(h(vUv*913.0+fract(uTime)*37.0)-0.5)*uGrain*(0.25+l);
      gl_FragColor=vec4(col,c.a); }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

/* overlay 2D (títulos y barras de cine) dibujado dentro del lienzo WebGL para que salga en la grabación */
const ovCanvas = document.createElement('canvas'); const ovCtx = ovCanvas.getContext('2d');
const ovTex = new THREE.CanvasTexture(ovCanvas); ovTex.colorSpace = THREE.SRGBColorSpace;
const ovScene = new THREE.Scene(), ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
ovScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, depthTest: false, toneMapped: false })));

/* ---------- materiales toon + contorno ---------- */
const GRAD = (() => { const d = new Uint8Array([62, 128, 196, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
const GRAD_SOFT = (() => { const d = new Uint8Array([145, 182, 218, 242]); const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();   // sombreado suave para la piel de la cara
const _tc = new Map();
function toon(color, o = {}) {
  const k = color + '|' + JSON.stringify(o, (key, v) => (v && v.isTexture) ? v.uuid : v);
  if (_tc.has(k)) return _tc.get(k);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o }); _tc.set(k, m); return m;
}
const _oc = new Map();
function outlineMat(th, perVertex = false, clip = false) {
  const k = th.toFixed(4) + (perVertex ? 'w' : '') + (clip ? 'c' : ''); if (_oc.has(k)) return _oc.get(k);
  const m = new THREE.MeshBasicMaterial({ color: 0x0a0710, side: THREE.BackSide }); m.userData.ol = true;
  m.onBeforeCompile = s => { s.vertexShader = (perVertex ? 'attribute float olw;\n' : '') + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * ' + th.toFixed(5) + (perVertex ? ' * olw' : '') + ';'); if (clip) clipShader(s); };
  m.customProgramCacheKey = () => 'outline' + k; _oc.set(k, m); return m;
}
/* recorte suave de la ropa: el atributo clp (distancia con signo al borde de la prenda) se interpola y se descarta lo negativo → bordes limpios en vez de escalones de triángulos */
function clipShader(s) {
  s.vertexShader = 'attribute float clp;\nvarying float vClp;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvClp = clp;');
  s.fragmentShader = 'varying float vClp;\n' + s.fragmentShader.replace('void main() {', 'void main() {\n  if (vClp < 0.0) discard;');
}
const _clipC = new Map();
function clipMat(base) {
  if (base.userData.legArgs) { const [k, a, b, o] = base.userData.legArgs; return legMat(k, a, b, { ...o, clip: true }); }   // legendarios: misma animación con recorte
  if (_clipC.has(base)) return _clipC.get(base);
  const m = base.clone(); m.onBeforeCompile = clipShader; m.customProgramCacheKey = () => 'clip'; _clipC.set(base, m); return m;
}
/* =====================================================================
   LEGENDARIOS: materiales con brillo propio y animación (el brillo pasa el umbral del bloom)
   ===================================================================== */
const LEG_T = { value: 0 };   // reloj compartido por todos los materiales legendarios
const LEG_K = { lava: 0, galaxy: 1, holo: 2, glitter: 3, neon: 4, electric: 5, chrome: 6, fire: 7, crystal: 8 };
const LEG_NOISE = /* glsl */`
float lh1(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float lnz(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lh1(i), lh1(i + vec3(1.0, 0.0, 0.0)), f.x), mix(lh1(i + vec3(0.0, 1.0, 0.0)), lh1(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(lh1(i + vec3(0.0, 0.0, 1.0)), lh1(i + vec3(1.0, 0.0, 1.0)), f.x), mix(lh1(i + vec3(0.0, 1.0, 1.0)), lh1(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float lfbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * lnz(p); p = p * 2.03 + 0.17; a *= 0.5; } return s; }
float lcell(vec3 p) {   // distancia al borde entre celdas: grietas y facetas
  vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z)), o = vec3(lh1(i + g), lh1(i + g + 17.3), lh1(i + g + 41.7));
    float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1; }
vec3 lhue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
float lspark(vec3 p) {   // destellos: algunas celdas tienen una chispa que parpadea
  vec3 i = floor(p), f = fract(p) - 0.5; float r = lh1(i), tw = pow(max(0.0, sin(uLT * (1.5 + r * 4.0) + r * 60.0)), 16.0);
  vec3 o = (vec3(lh1(i + 3.1), lh1(i + 5.7), lh1(i + 9.3)) - 0.5) * 0.5;
  return tw * smoothstep(0.22, 0.0, length(f - o)) * step(0.45, r); }
`;
const LEG_GLSL = 'uniform float uLT, uLS, uLK; uniform vec3 uLA, uLB; varying vec3 vLp;\n' + LEG_NOISE + /* glsl */`
void legApply(inout vec3 base, inout vec3 em, vec3 n, vec3 v) {
  vec3 p = vLp * uLS; float fr = 1.0 - abs(dot(n, v));
#ifdef USE_MAP
  float ml = 0.55 + 0.65 * dot(base, vec3(0.333));
#else
  float ml = 1.0;
#endif
  vec3 b = uLA;
#if LK == 0   // lava: roca oscura con grietas incandescentes que laten
  float cr = 1.0 - smoothstep(0.0, 0.09, lcell(p + vec3(0.0, -uLT * 0.12, 0.0)));
  float pu = 0.6 + 0.4 * sin(uLT * 2.6 + lfbm(p * 0.6) * 7.0);
  b = uLA * (0.55 + 0.6 * lfbm(p * 2.5)); b = mix(b, uLB, cr * 0.6);
  em = uLB * (cr * 2.8 * pu + 0.25 * smoothstep(0.55, 0.8, lfbm(p * 0.9 + uLT * 0.2)));
#elif LK == 1   // galaxia: nebulosa que fluye + estrellas que titilan
  float nb = lfbm(p * 0.9 + vec3(uLT * 0.05, uLT * 0.03, -uLT * 0.04));
  vec3 nc = mix(uLA, uLB, smoothstep(0.3, 0.75, lfbm(p * 0.6 - uLT * 0.03)));
  b = mix(vec3(0.03, 0.015, 0.07), nc, smoothstep(0.35, 0.8, nb));
  em = nc * smoothstep(0.5, 0.85, nb) * 0.9 + vec3(1.0, 0.95, 1.0) * (lspark(p * 7.0) * 3.5 + lspark(p * 13.0 + 7.0) * 2.0) + nc * pow(fr, 3.0) * 0.6;
#elif LK == 2   // holográfico: arcoíris que cambia con el ángulo + barrido de brillo
  float h = fract(dot(p, vec3(0.13, 0.21, 0.07)) + fr * 0.55 + uLT * 0.12);
  vec3 rb = lhue(h);
  b = mix(uLA, rb * 0.85 + 0.15, 0.7);
  float sw = smoothstep(0.93, 1.0, sin(dot(p, vec3(0.3, 0.5, 0.15)) * 2.0 - uLT * 2.4));
  em = rb * (0.25 + 1.6 * pow(fr, 2.0)) + vec3(1.0) * (sw * 1.6 + lspark(p * 9.0) * 2.5);
#elif LK == 3   // brillantina: chispas densas que destellan
  b = uLA * (0.85 + 0.3 * fr);
  em = (uLB * 0.6 + 0.4) * (lspark(vLp * 70.0) * 3.5 + lspark(vLp * 110.0 + 3.3) * 2.5) + uLB * pow(fr, 2.5) * 0.5 + uLA * 0.15;
#elif LK == 4   // neón: líneas que corren
  float s = fract((vLp.y + abs(vLp.x) * 0.6) * uLS - uLT * 0.6);
  float ln = smoothstep(0.12, 0.0, abs(s - 0.5) - 0.06);
  vec3 nc = mix(uLA, uLB, 0.5 + 0.5 * sin(vLp.y * uLS * 0.5 - uLT * 1.5));
  b = mix(uLA * 0.3, nc, ln);
  em = nc * (ln * 2.6 + 0.35 + pow(fr, 2.0) * 0.8);
#elif LK == 5   // eléctrico: venas de rayo que saltan
  float j = floor(uLT * 9.0);
  float ln = 1.0 - smoothstep(0.0, 0.018, abs(lfbm(p * 1.4 + vec3(j * 0.31, j * 0.17, 0.0)) - 0.5));
  float fl = 0.6 + 0.4 * step(0.4, lh1(vec3(j)));
  b = mix(uLA * 0.55, uLB, ln * 0.5);
  em = uLB * (ln * 3.2 * fl + 0.06 + pow(fr, 3.0) * 0.5);
#elif LK == 6   // cromado / dorado: reflejo falso (cielo arriba) + barrido de brillo
  float hz = n.y + 0.14 * sin(dot(p, vec3(0.9, 0.3, 0.6)) * 1.5) - 0.05;   // horizonte reflejado: cielo claro arriba, franja oscura, suelo medio
  float band = 1.0 - smoothstep(0.0, 0.09, abs(hz + 0.12));
  float sw = 1.0 - smoothstep(0.0, 0.025, abs(fract(dot(p, vec3(0.08, 0.12, 0.04)) - uLT * 0.3) - 0.5));   // barrido fino
  b = uLA * 0.3;   // el reflejo va casi todo en el brillo propio: las luces del escenario no lo aplanan
  em = uLA * mix(0.1, 0.95, smoothstep(-0.03, 0.05, hz)) * (1.0 - 0.85 * band) + uLB * sw * 1.8 + uLA * pow(fr, 3.0) * 0.6 + vec3(1.0) * lspark(p * 6.0) * 2.0;
#elif LK == 7   // fuego: llamas que suben
  float f = lfbm(vec3(p.x, p.y - uLT * 1.1, p.z) * 1.4);
  float it = smoothstep(0.38, 0.8, f);
  b = mix(uLA * 0.45, uLB, it * 0.7);
  em = mix(uLA, uLB, it) * (it * 2.4 + 0.3) * (0.85 + 0.15 * sin(uLT * 13.0));
#elif LK == 8   // cristal: facetas con borde de luz y destellos
  float e = 1.0 - smoothstep(0.0, 0.07, lcell(p));
  b = mix(uLA * 0.75, vec3(1.0), 0.1 + 0.4 * fr) * (0.75 + 0.45 * lnz(p * 1.5));
  em = uLA * (0.12 + 0.9 * pow(fr, 2.0)) + uLB * e * (0.5 + 0.4 * sin(uLT * 2.0 + p.y)) + vec3(1.0) * lspark(p * 5.0) * 3.0;
#endif
  base = b * ml;
}
`;
const _legC = new Map();
/* material legendario: efecto (kind), color principal a, color de brillo b; o = { scale, k, clip, map, flat, side, alphaTest, mat } */
function legMat(kind, a, b, o = {}) {
  const key = kind + '|' + a + '|' + b + '|' + JSON.stringify(o, (k, v) => (v && v.isTexture) ? v.uuid : v);
  if (_legC.has(key)) return _legC.get(key);
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD, side: o.side ?? THREE.DoubleSide, flatShading: !!o.flat, map: o.map ?? null, alphaTest: o.alphaTest ?? 0, ...(o.mat || {}) });
  const U = { uLT: LEG_T, uLA: { value: new THREE.Color(a) }, uLB: { value: new THREE.Color(b) }, uLS: { value: o.scale ?? 8 }, uLK: { value: o.k ?? 1 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vLp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position;');
    sh.fragmentShader = '#define LK ' + LEG_K[kind] + '\n' + LEG_GLSL + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 lem = vec3(0.0); legApply(diffuseColor.rgb, lem, normalize(normal), normalize(vViewPosition)); totalEmissiveRadiance += lem * uLK; }');
    if (o.clip) clipShader(sh);
  };
  m.customProgramCacheKey = () => 'leg' + kind + (o.clip ? 'c' : '') + (o.map ? 'm' : '') + (o.flat ? 'f' : '') + (o.alphaTest ? 'a' : '');
  m.userData.legArgs = [kind, a, b, o];
  _legC.set(key, m); return m;
}
/* aura legendaria: contorno de luz pegado a la silueta (copia inflada del objeto vista por detrás, como el contorno negro)
   que brilla junto al borde y se apaga hacia fuera; desde los bordes de arriba suben lenguas de fuego */
const _auraC = new Map();
function auraMat(a, b, bolt) {
  const k = a + '|' + b + '|' + !!bolt; if (_auraC.has(k)) return _auraC.get(k);
  const m = new THREE.MeshToonMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const U = { uLT: LEG_T, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uBolt: { value: bolt ? 1 : 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform float uLT; varying vec3 vLp;\n' + LEG_NOISE + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vLp = position; vec3 nn = normalize(normal); float up = max(0.0, nn.y);
      float fl = lfbm(vec3(position.x * 16.0, position.y * 10.0 - uLT * 2.4, position.z * 16.0));
      transformed += nn * (0.02 + 0.05 * up * fl * fl) + vec3(0.0, 0.09 * up * fl * fl * fl, 0.0);`);
    sh.fragmentShader = 'uniform float uLT, uBolt; uniform vec3 uA, uB; varying vec3 vLp;\n' + LEG_NOISE + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float dv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
      float fl = lfbm(vec3(vLp.x * 22.0, vLp.y * 14.0 - uLT * 3.2, vLp.z * 22.0));
      float al = smoothstep(0.0, 0.3, dv) * (1.0 - 0.85 * smoothstep(0.45, 0.9, dv)) * (0.6 + 1.6 * smoothstep(0.35, 0.72, fl));
      if (uBolt > 0.5) al *= 0.55 + 0.9 * step(0.6, fract(sin(floor(uLT * 14.0) * 12.9898) * 43758.5));
      gl_FragColor = vec4(mix(uB, uA, smoothstep(0.15, 0.7, dv)) * al * 2.2, 1.0);`);
  };
  m.customProgramCacheKey = () => 'aura';
  _auraC.set(k, m); return m;
}
const geoCache = {};
const G = (key, fn) => geoCache[key] || (geoCache[key] = fn());
function mesh(parent, geo, mat, { pos, rot, scale, outline = 0.01, shadow = false, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale !== undefined) (typeof scale === 'number') ? m.scale.setScalar(scale) : m.scale.set(...scale);
  m.castShadow = shadow; m.receiveShadow = receive; parent.add(m);
  if (outline > 0) { const avg = (Math.abs(m.scale.x) + Math.abs(m.scale.y) + Math.abs(m.scale.z)) / 3; m.add(new THREE.Mesh(geo, outlineMat(outline / avg))); }
  return m;
}
/* agrupa piezas pequeñas del mismo material en una sola malla (menos draw calls) */
class Batch {
  constructor() { this.g = new Map(); }
  add(mat, geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], outline = 0) {
    const gg = geo.index ? geo.toNonIndexed() : geo.clone(); gg.clearGroups();
    for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a);
    if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
    if (!gg.attributes.normal) gg.computeVertexNormals();
    gg.applyMatrix4(new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl)));
    const k = mat.uuid + '|' + outline; if (!this.g.has(k)) this.g.set(k, { mat, outline, list: [] }); this.g.get(k).list.push(gg);
  }
  build(parent, shadow = false) { for (const { mat, outline, list } of this.g.values()) mesh(parent, mergeGeometries(list), mat, { outline, shadow }); }
}

/* ---------- geometrías orgánicas ---------- */
function latheGeo(prof, segs = 16) { return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0004), y)), segs); }
function limbGeo(len, prof, flat = 0.9, k = 1) {
  const P = [[0.0004, 0], ...prof.map(([t, r]) => [r * k, t * len]), [0.0004, len]];
  const g = latheGeo(P, 14); g.scale(1, 1, flat); return g;
}
function taperTube(pts, r0, r1, segs = 18, radial = 7, flat = 1) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const P = [], T = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; P.push(curve.getPointAt(t)); T.push(curve.getTangentAt(t).normalize()); }
  // marcos estables (transporte paralelo por proyección), sin los saltos de Frenet en curvas rectas
  const ref = Math.abs(T[0].z) < 0.9 ? V(0, 0, 1) : V(0, 1, 0);
  let N = V().crossVectors(T[0], ref).normalize();
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    if (i > 0) { N.addScaledVector(T[i], -N.dot(T[i])); if (N.lengthSq() < 1e-12) N.crossVectors(T[i], ref); N.normalize(); }
    const B = V().crossVectors(T[i], N);
    const r = lerp(r0, r1, t) * (t > 0.85 ? lerp(1, 0.25, (t - 0.85) / 0.15) : 1);
    for (let j = 0; j < radial; j++) { const a = j / radial * Math.PI * 2, cx = Math.cos(a) * r, cy = Math.sin(a) * r * flat; pos.push(P[i].x + N.x * cx + B.x * cy, P[i].y + N.y * cx + B.y * cy, P[i].z + N.z * cx + B.z * cy); }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* mechón plano (cinta gruesa de sección hexagonal): el ancho va tangente a la cabeza; punta afilada o cortada en recto */
function ribbonGeo(pts, w0, w1, th, { tip = 'point', segs = 12, ctr = V(0, 0, -0.01), nrm = null } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts), pos = [], idx = [], SEC = [[1, 0], [0.55, 1], [-0.55, 1], [-1, 0], [-0.55, -1], [0.55, -1]], n = SEC.length;
  const N = V(), W = V();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, P = curve.getPointAt(t), T = curve.getTangentAt(t).normalize();
    if (nrm) N.copy(nrm); else N.subVectors(P, ctr);
    N.addScaledVector(T, -N.dot(T)); if (N.lengthSq() < 1e-10) N.set(1, 0, 0).addScaledVector(T, -T.x); N.normalize(); W.crossVectors(T, N);
    let w = lerp(w0, w1, t), h = th * lerp(1, 0.7, t);
    if (tip === 'point' && t > 0.62) { const k = (t - 0.62) / 0.38; w *= lerp(1, 0.06, k * k * (3 - 2 * k)); h *= lerp(1, 0.3, k); }
    if (t < 0.08) { const k = t / 0.08; w *= lerp(0.7, 1, k); }
    for (const [a, b] of SEC) pos.push(P.x + W.x * a * w + N.x * b * h, P.y + W.y * a * w + N.y * b * h, P.z + W.z * a * w + N.z * b * h);
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  // tapas
  const e0 = pos.length / 3; const P0 = curve.getPointAt(0), P1 = curve.getPointAt(1); pos.push(P0.x, P0.y, P0.z, P1.x, P1.y, P1.z);
  for (let j = 0; j < n; j++) { idx.push(e0, j, (j + 1) % n); const L = segs * n; idx.push(e0 + 1, L + (j + 1) % n, L + j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* zapato con forma de pie: la parte de arriba es una esfera deformada (puntera redonda, empeine que sube al tobillo);
   la suela es una losa con la misma huella. Origen = tobillo */
const SHOE = { ground: { boot: -0.099, sneaker: -0.099, platform: -0.1675 }, sole: { boot: 0.026, sneaker: 0.03, platform: 0.088 } };
const footW = z => 0.052 * (1 + 0.1 * Math.exp(-((z - 0.11) ** 2) / 0.004)) * (z < 0 ? lerp(1, 0.82, clamp(-z / 0.075, 0, 1)) : 1);
/* vivo de la suela: tubo fino que recorre el borde superior */
function weltGeo(kind) {
  const h = SHOE.sole[kind], rb = Math.min(h * 0.45, 0.014), y = SHOE.ground[kind] + h - rb * 0.8, pts = [];
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, z = 0.06 + Math.cos(a) * 0.138; pts.push(V(Math.sin(a) * (footW(z) * 1.12 * (kind === 'platform' ? 0.99 : 1) + 0.0015), y, z)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.0032, 5, true);
}
function shoeGeo(kind) {
  const top = SHOE.ground[kind] + SHOE.sole[kind], g = new THREE.SphereGeometry(1, 30, 20), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), Z = 0.06 + z * 0.13;
    const hT = lerp(kind === 'boot' ? 0.12 : 0.105, kind === 'sneaker' ? 0.05 : 0.046, smooth(clamp((Z - 0.02) / 0.12, 0, 1)));
    p.setXYZ(i, x * footW(Z) * 1.05 * lerp(1, 0.84, smooth(clamp((Z - 0.12) / 0.07, 0, 1))), top - 0.004 + (y > 0 ? y * hT : y * 0.008), Z);
  }
  g.computeVertexNormals(); return g;
}
function soleGeo(kind) {
  const h = SHOE.sole[kind], g = new THREE.CylinderGeometry(1, 1, 1, 40, 12), p = g.attributes.position, rb = Math.min(h * 0.45, 0.014), y0 = SHOE.ground[kind];
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) + 0.5, z0 = p.getZ(i), zz = 0.06 + z0 * 0.138;
    const yb = y0 + (kind === 'platform' ? 0.024 : 0.01) * smooth(clamp((zz - 0.07) / 0.12, 0, 1)), yt = y0 + h, y = lerp(yb, yt, v);   // la puntera se levanta
    const d = Math.min(y - yb, yt - y), ins = d < rb ? rb - Math.sqrt(Math.max(0, rb * rb - (rb - d) ** 2)) : 0;   // canto redondeado
    const z = 0.06 + z0 * (0.138 - ins), fl = kind === 'platform' ? 1 + 0.05 * (0.5 - v) : 1;
    const lug = kind === 'platform' ? 0.003 * Math.max(0, Math.cos(Math.atan2(p.getX(i), z0) * 30)) * smooth(clamp(Math.min(v, 1 - v) * 6 - 0.4, 0, 1)) : 0;   // estrías de la plataforma
    p.setXYZ(i, p.getX(i) * (footW(z) * 1.12 * fl - ins + lug), y, z);
  }
  g.computeVertexNormals(); return g;
}

/* ---------- texturas pintadas ---------- */
const RT = rng(99);
function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t;
}
function speckle(g, w, h, n, cols, rmax = 2, alpha = 0.35) { for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(RT() * cols.length)]; g.globalAlpha = 0.1 + RT() * alpha; g.beginPath(); g.arc(RT() * w, RT() * h, 0.5 + RT() * rmax, 0, 7); g.fill(); } g.globalAlpha = 1; }
function woodTex(cols, rows, rep) {
  return canvasTex(512, 512, (g, w, h) => {
    const ph = h / rows;
    for (let i = 0; i < rows; i++) {
      g.fillStyle = cols[i % cols.length]; g.fillRect(0, i * ph, w, ph);
      for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(30,35,8,${0.06 + RT() * 0.14})`; g.lineWidth = 1 + RT() * 2; const y = i * ph + RT() * ph; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.015 + k) * 2.5); g.stroke(); }
      g.fillStyle = 'rgba(15,18,4,.85)'; g.fillRect(0, i * ph, w, 3); const jx = RT() * w; g.fillRect(jx, i * ph, 3, ph);
      g.fillStyle = 'rgba(25,25,15,.9)'; for (const nx of [jx - 9, jx + 12]) for (const ny of [0.28, 0.72]) { g.beginPath(); g.arc(nx, i * ph + ph * ny, 2.4, 0, 7); g.fill(); }
    }
    speckle(g, w, h, 900, ['#20240a', '#e8e6a0'], 2.2, 0.2);
  }, { repeat: rep });
}
function stoneTex(base, cols, rep) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const rows = 6;
    for (let r = 0; r < rows; r++) { let x = -RT() * 30; const rh = h / rows; while (x < w) { const sw = 30 + RT() * 40; g.fillStyle = cols[Math.floor(RT() * cols.length)]; const pad = 3 + RT() * 2; g.beginPath(); g.roundRect(x + pad, r * rh + pad, sw - pad * 2, rh - pad * 2, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + pad + 2, r * rh + pad + 2, sw - pad * 2 - 4, 4); x += sw; } }
    speckle(g, w, h, 1200, ['#000', '#fff'], 1.5, 0.15);
  }, { repeat: rep });
}
const _stripe = {};
const stripeTex = (a, b, n = 8, rep = [1, 3]) => _stripe[a + b + n + rep] || (_stripe[a + b + n + rep] = canvasTex(32, 64, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(0, i * h / n, w, h / n); } }, { repeat: rep }));
const TX = {};
function makeTextures() {
  TX.wood = woodTex(['#93a043', '#a9b350', '#86933a', '#9daa48'], 8, [2, 1]);
  TX.woodDark = woodTex(['#6b5a2e', '#5e4f27', '#77663a'], 4, [1, 1]);
  TX.stone = stoneTex('#2a332c', ['#6f7b6c', '#5d6a5f', '#7d8877', '#55614f'], [1, 1]);
  TX.wall = stoneTex('#262d28', ['#5f6b5c', '#53604f', '#6c7766'], [4, 1]);
  TX.patio = stoneTex('#2c2f27', ['#4b4d3f', '#55574a', '#45473a', '#5c5a4a'], [7, 6]);
  TX.brick = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#2b1712'; g.fillRect(0, 0, w, h); for (let r = 0; r < h / 16; r++) for (let x = (r % 2) * -21; x < w; x += 42) { g.fillStyle = ['#7a3b2a', '#6b3224', '#844430', '#5e2c20'][Math.floor(RT() * 4)]; g.fillRect(x + 2, r * 16 + 2, 38, 12); } speckle(g, w, h, 500, ['#000', '#c97'], 1.2, 0.2); }, { repeat: [10, 1] });
  TX.hedge = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#16301a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2200, ['#2c5a2a', '#1f4420', '#3b7034', '#0c1f0e'], 5, 0.8); }, { repeat: [10, 1] });
  TX.grass = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#1c3319'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.strokeStyle = ['#2b4a22', '#173015', '#33552a', '#22401c'][i % 4]; g.lineWidth = 1.2; const x = RT() * w, y = RT() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + RT() * 3 - 1.5, y - 4 - RT() * 5); g.stroke(); } }, { repeat: [40, 40] });
  TX.banner = canvasTex(1024, 300, (g, w, h) => {
    g.fillStyle = '#ddd3a8'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, ['#b8ab7c', '#f3ebc8', '#a89a6a'], 1.6, 0.4);
    g.strokeStyle = 'rgba(110,90,50,.12)'; g.lineWidth = 1; for (let x = 0; x < w; x += 5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 5; g.strokeStyle = '#13220e';
    for (let i = 0; i < 12; i++) { const bx = 10 + i * 88 + RT() * 20, bw = 46 + RT() * 40, bh = 60 + RT() * 100, by = 150 - bh; g.fillStyle = i % 3 ? '#62c43a' : '#8be04c'; g.fillRect(bx, by, bw, bh); g.strokeRect(bx, by, bw, bh); g.fillStyle = '#13220e'; for (let wy = by + 10; wy < 140; wy += 20) for (let wx = bx + 8; wx < bx + bw - 10; wx += 16) g.fillRect(wx, wy, 7, 9); }
    const burst = (cx, cy, r, col) => { g.beginPath(); for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, r2 = k % 2 ? r * 0.5 : r; g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); } g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 4; g.strokeStyle = '#111'; g.stroke(); };
    burst(170, 120, 70, '#4db3ff'); burst(830, 110, 64, '#4db3ff'); burst(520, 80, 50, '#ffe14a');
    for (let x = 0; x < w; x += 26) { g.fillStyle = x % 52 ? '#ff9b2a' : '#ffd23a'; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + 6, h - 40 - RT() * 30, x + 13, h - 70 - RT() * 30); g.quadraticCurveTo(x + 20, h - 30, x + 26, h); g.fill(); g.strokeStyle = '#3a1a05'; g.lineWidth = 2; g.stroke(); }
    g.save(); g.translate(w / 2, 200); g.rotate(-0.04); g.font = '150px Bangers, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 22; g.strokeStyle = '#120a18'; g.strokeText('PATIO BASH', 0, 0); g.fillStyle = '#b04ce0'; g.fillText('PATIO BASH', 0, 0); g.lineWidth = 5; g.strokeStyle = '#f2a8ff'; g.strokeText('PATIO BASH', -3, -4); g.restore();
    g.fillStyle = '#7d34b0'; for (let i = 0; i < 14; i++) { const x = 160 + RT() * 700; g.fillRect(x, 250, 5, 15 + RT() * 30); g.beginPath(); g.arc(x + 2.5, 265 + RT() * 25, 4, 0, 7); g.fill(); }
  });
  TX.drumHead = canvasTex(256, 256, (g) => {
    g.fillStyle = '#efe6c8'; g.fillRect(0, 0, 256, 256);
    const st = (r1, r2, n, col, lw) => { g.beginPath(); for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * Math.PI * 2, r = k % 2 ? r2 : r1; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.strokeStyle = col; g.lineWidth = lw; g.stroke(); };
    g.fillStyle = '#ffb04a'; g.beginPath(); g.arc(128, 128, 60, 0, 7); g.fill(); st(118, 50, 16, '#d0201a', 7); st(90, 30, 12, '#ff7a1a', 5); st(46, 16, 10, '#d0201a', 4);
    g.lineWidth = 10; g.strokeStyle = '#222'; g.beginPath(); g.arc(128, 128, 123, 0, 7); g.stroke();
  });
  TX.grill = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#1c1c1f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2c2c30'; for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } });
  TX.lantern = canvasTex(128, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c41a0c'); gr.addColorStop(0.5, '#ff5a24'); gr.addColorStop(1, '#c41a0c'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffb04a'; g.lineWidth = 3; for (let y = 6; y < h; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeStyle = 'rgba(120,10,0,.6)'; g.lineWidth = 2; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } });
  TX.bark = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#3e2e1c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = ['#2a1e11', '#56412a', '#4a3822'][i % 3]; g.lineWidth = 2 + RT() * 4; const x = RT() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 10, h * 0.3, x - 10, h * 0.6, x + 4, h); g.stroke(); } }, { repeat: [2, 3] });
  TX.leaf = canvasTex(128, 512, (g, w, h) => { g.lineCap = 'round'; for (let y = 20; y < h - 10; y += 9) { const L = (1 - y / h) * 0.2 + Math.sin(y / h * Math.PI) * 0.8; g.lineWidth = 7; g.strokeStyle = y % 18 ? '#3f7d2e' : '#2f6223'; g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - 58 * L, y + 34 * L); g.stroke(); g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + 58 * L, y + 34 * L); g.stroke(); } g.lineWidth = 6; g.strokeStyle = '#5b8a32'; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); });
  TX.flame = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,230,140,.9)'); gr.addColorStop(0.6, 'rgba(255,120,30,.35)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  TX.glow = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  TX.smoke = canvasTex(128, 128, (g) => { for (let i = 0; i < 26; i++) { const x = 64 + rr(-26, 26), y = 64 + rr(-26, 26), r = rr(18, 40); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } });
  TX.moon = canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, 'rgba(220,235,220,.25)'); gr.addColorStop(1, 'rgba(220,235,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = '#cfd8c4'; g.beginPath(); g.arc(128, 128, 78, 0, 7); g.fill(); for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(120,135,115,.45)'; g.beginPath(); g.arc(85 + RT() * 90, 85 + RT() * 90, 4 + RT() * 14, 0, 7); g.fill(); } });
  TX.plaid = canvasTex(64, 64, (g) => { g.fillStyle = '#b3242a'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 20, 64, 10); g.fillRect(20, 0, 10, 64); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 48, 64, 4); g.fillRect(48, 0, 4, 64); g.fillStyle = 'rgba(255,220,80,.7)'; g.fillRect(0, 40, 64, 2); g.fillRect(40, 0, 2, 64); }, { repeat: [2, 3] });
  TX.denim = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(0,0,30,.12)'; for (let i = -64; i < 64; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); } speckle(g, 64, 64, 120, ['#fff', '#99a'], 1, 0.3); }, { repeat: [3, 4] });
  TX.skull = canvasTex(64, 128, (g) => { g.fillStyle = '#d8262b'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(32, 50, 16, 0, 7); g.fill(); g.fillRect(24, 58, 16, 12); g.fillStyle = '#d8262b'; g.beginPath(); g.arc(26, 50, 5, 0, 7); g.arc(38, 50, 5, 0, 7); g.fill(); g.fillRect(27, 64, 3, 6); g.fillRect(34, 64, 3, 6); g.strokeStyle = '#f2f2f2'; g.lineWidth = 5; g.beginPath(); g.moveTo(12, 78); g.lineTo(52, 98); g.moveTo(52, 78); g.lineTo(12, 98); g.stroke(); });
  TX.can = canvasTex(64, 64, (g) => { g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c2201a'; g.fillRect(0, 14, 64, 36); g.fillStyle = '#fff'; g.font = 'bold 15px sans-serif'; g.fillText('LATA', 14, 37); });
  TX.rope = canvasTex(64, 16, (g) => { g.fillStyle = '#b8902e'; g.fillRect(0, 0, 64, 16); g.strokeStyle = '#6b4e12'; g.lineWidth = 3; for (let x = -16; x < 80; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 10, 16); g.stroke(); } }, { repeat: [60, 1] });
  TX.chain = canvasTex(64, 64, (g) => { g.strokeStyle = '#8a9590'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke(); }, { repeat: [40, 4] });
  TX.house = canvasTex(256, 128, (g) => { g.fillStyle = '#1a2433'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 6; i++) { const x = 16 + i * 40, y = 30 + (i % 2) * 40; g.fillStyle = RT() < 0.55 ? '#ffcf6a' : '#0d131c'; g.fillRect(x, y, 22, 26); g.strokeStyle = '#0a0d12'; g.lineWidth = 3; g.strokeRect(x, y, 22, 26); g.beginPath(); g.moveTo(x + 11, y); g.lineTo(x + 11, y + 26); g.stroke(); } });
  TX.sky = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#02040a'); gr.addColorStop(0.55, '#0a1a26'); gr.addColorStop(1, '#173a3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  TX.hairStreak = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 420; i++) { const x = RT() * w; g.strokeStyle = RT() < 0.5 ? `rgba(0,0,0,${0.08 + RT() * 0.16})` : `rgba(255,255,255,${0.2 + RT() * 0.3})`; g.lineWidth = 1 + RT() * 2.5; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + RT() * 10 - 5, h * 0.3, x + RT() * 10 - 5, h * 0.7, x + RT() * 8 - 4, h); g.stroke(); } }, { repeat: [1, 1] });
  TX.hairStreak.wrapS = TX.hairStreak.wrapT = THREE.RepeatWrapping;
  TX.skullTee = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#d8262b'; g.fillRect(0, 0, w, h); const cx = 256, cy = 92; g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill(); g.fillRect(cx - 10, cy + 8, 20, 14); g.fillStyle = '#d8262b'; g.beginPath(); g.arc(cx - 7, cy, 6, 0, 7); g.arc(cx + 7, cy, 6, 0, 7); g.fill(); g.fillRect(cx - 5, cy + 15, 3, 7); g.fillRect(cx + 2, cy + 15, 3, 7); g.strokeStyle = '#f2f2f2'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 26, cy + 30); g.lineTo(cx + 26, cy + 52); g.moveTo(cx + 26, cy + 30); g.lineTo(cx - 26, cy + 52); g.stroke(); });
  TX.ampLogo = canvasTex(128, 40, (g) => { g.font = '34px Bangers, Impact'; g.fillStyle = '#e8e2c8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('THUNDER', 64, 22); });
}
function beamMat(color, strength) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: strength } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(normalize(vN),normalize(vV))),1.4); gl_FragColor=vec4(uColor*uI*pow(max(vY,0.0),1.7)*f,1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/* =====================================================================
   ESCENARIO "PATIO BASH"
   ===================================================================== */
const FIRE = V(-5.2, 0, 13.5);
const S = { cans: [], lanterns: [], cones: [], fireSprites: [], lights: {}, amps: [] };
function catenary(a, b, sag, n = 30) { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); } return pts; }
function orientSeg(obj, a, b) { obj.position.copy(a); const d = V().subVectors(b, a); const L = d.length(); if (L > 1e-6) obj.quaternion.setFromUnitVectors(UP, d.divideScalar(L)); }

function buildStage() {
  const woodM = toon(0xffffff, { map: TX.wood }), beamM = toon(0xffffff, { map: TX.woodDark }), stoneM = toon(0xffffff, { map: TX.stone });
  scene.background = TX.sky;
  const grass = new THREE.Mesh(new THREE.CircleGeometry(110, 48).rotateX(-Math.PI / 2), toon(0xffffff, { map: TX.grass })); grass.receiveShadow = true; scene.add(grass);
  const patio = new THREE.Mesh(new THREE.PlaneGeometry(27, 24).rotateX(-Math.PI / 2), toon(0xffffff, { map: TX.patio })); patio.position.set(0, 0.01, 6); patio.receiveShadow = true; scene.add(patio);

  mesh(scene, new THREE.BoxGeometry(15, 0.3, 7.4), woodM, { pos: [0, SY - 0.15, -0.7], outline: 0.03, receive: true, shadow: true });
  mesh(scene, new THREE.BoxGeometry(15.3, 0.42, 0.36), beamM, { pos: [0, SY - 0.26, 3.05], outline: 0.03 });
  mesh(scene, new THREE.BoxGeometry(15.0, 0.3, 0.3), beamM, { pos: [0, SY - 0.62, 2.55], outline: 0.025 });
  for (const x of [-6.3, -2.1, 2.1, 6.3]) for (const z of [2.45, -3.6]) mesh(scene, new THREE.BoxGeometry(1.0, SY - 0.3, 1.0), stoneM, { pos: [x, (SY - 0.3) / 2, z], outline: 0.03, receive: true });
  mesh(scene, new THREE.PlaneGeometry(14, SY - 0.3), toon(0x2a1a10), { pos: [0, (SY - 0.3) / 2, -2.9], outline: 0 });
  const under = new THREE.PointLight(0xff7a2a, 5, 9, 1.3); under.position.set(0, 0.8, 0.4); scene.add(under); S.lights.under = under;
  for (let i = 0; i < 6; i++) mesh(scene, new THREE.BoxGeometry(0.7, 0.6, 0.7), toon(0x5a4020), { pos: [rr(-5, 5), 0.3, rr(-2.4, 1.2)], rot: [0, rr(0, 1), 0], outline: 0.02 });

  mesh(scene, new THREE.BoxGeometry(15, 3.6, 0.6), toon(0xffffff, { map: TX.wall }), { pos: [0, SY + 1.8, -4.6], outline: 0.03, receive: true });
  const bg = new THREE.PlaneGeometry(8.6, 2.5, 24, 1); const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.sin(bp.getX(i) * 1.4) * 0.07 + Math.sin(bp.getX(i) * 3.1) * 0.03);
  bg.computeVertexNormals();
  mesh(scene, bg, toon(0xffffff, { map: TX.banner, side: THREE.DoubleSide }), { pos: [0, SY + 1.62, -4.22], outline: 0, receive: true });
  mesh(scene, new THREE.BoxGeometry(2.4, 0.35, 1.0), stoneM, { pos: [6.0, SY + 0.17, -3.75], outline: 0.025 });
  mesh(scene, new THREE.BoxGeometry(2.4, 0.7, 0.55), stoneM, { pos: [6.0, SY + 0.35, -4.05], outline: 0.025 });

  const amp = (x, z) => {
    const gp = new THREE.Group(); gp.position.set(x, SY, z); scene.add(gp);
    mesh(gp, G('cab', () => new THREE.BoxGeometry(1.05, 1.25, 0.6)), toon(0x1c1c1c), { pos: [0, 0.625, 0], outline: 0.02, shadow: true });
    mesh(gp, G('cabg', () => new THREE.PlaneGeometry(0.92, 1.1)), toon(0xffffff, { map: TX.grill }), { pos: [0, 0.625, 0.302], outline: 0 });
    mesh(gp, G('head', () => new THREE.BoxGeometry(1.05, 0.38, 0.52)), toon(0x232323), { pos: [0, 1.44, -0.03], outline: 0.02 });
    mesh(gp, G('headp', () => new THREE.BoxGeometry(0.95, 0.12, 0.02)), toon(0xc9c3b0), { pos: [0, 1.44, 0.235], outline: 0 });
    for (let k = 0; k < 6; k++) mesh(gp, G('knob', () => new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10).rotateX(Math.PI / 2)), toon(0x111111), { pos: [-0.35 + k * 0.13, 1.44, 0.255], outline: 0 });
    mesh(gp, G('logo', () => new THREE.PlaneGeometry(0.4, 0.125)), new THREE.MeshBasicMaterial({ map: TX.ampLogo, transparent: true }), { pos: [0.22, 1.13, 0.304], outline: 0 });
    const led = new THREE.Mesh(G('led', () => new THREE.SphereGeometry(0.018, 8, 6)), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2) })); led.position.set(0.44, 1.44, 0.25); gp.add(led);
    S.amps.push(gp);
  };
  amp(-4.8, -3.5); amp(4.4, -3.55);
  for (const x of [-3.6, 3.6]) mesh(scene, G('wedge', () => new THREE.BoxGeometry(0.95, 0.42, 0.6)), toon(0x1a1a1a), { pos: [x, SY + 0.2, 2.55], rot: [-0.45, x > 0 ? -0.3 : 0.3, 0], outline: 0.02 });

  for (const x of [-7.0, 7.0]) mesh(scene, new THREE.BoxGeometry(0.4, 5.7, 0.4), beamM, { pos: [x, SY + 2.85, -3.9], outline: 0.025, shadow: true });
  mesh(scene, new THREE.BoxGeometry(14.6, 0.5, 0.5), beamM, { pos: [0, SY + 5.45, -3.9], outline: 0.025 });
  mesh(scene, new THREE.BoxGeometry(6.2, 0.22, 1.6), beamM, { pos: [-2.85, SY + 6.15, -3.75], rot: [0, 0, 0.29], outline: 0.025 });
  mesh(scene, new THREE.BoxGeometry(6.2, 0.22, 1.6), beamM, { pos: [2.85, SY + 6.15, -3.75], rot: [0, 0, -0.29], outline: 0.025 });
  for (const s of [-1, 1]) mesh(scene, new THREE.BoxGeometry(0.22, 2.6, 0.22), beamM, { pos: [s * 6.3, SY + 4.5, -3.9], rot: [0, 0, s * 0.6], outline: 0.02 });

  const can = (pos, tgt, len, base, rad) => {
    const gp = new THREE.Group(); gp.position.copy(pos); scene.add(gp);
    mesh(gp, G('canb', () => new THREE.CylinderGeometry(0.22, 0.3, 0.5, 16).rotateX(Math.PI / 2)), toon(0x2b2b30), { outline: 0.02 });
    mesh(gp, G('canr', () => new THREE.TorusGeometry(0.29, 0.04, 8, 20)), toon(0x4bb0ff), { pos: [0, 0, 0.25], outline: 0 });
    const lensM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.2) });
    mesh(gp, G('lens', () => new THREE.CircleGeometry(0.26, 20)), lensM, { pos: [0, 0, 0.255], outline: 0 });
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glow, color: 0xfff0b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7, fog: false })); gl.position.set(0, 0, 0.35); gl.scale.setScalar(1.8); gp.add(gl);
    const cg = new THREE.CylinderGeometry(0.22, rad, len, 24, 1, true); cg.translate(0, -len / 2, 0); cg.rotateX(-Math.PI / 2);
    const beam = new THREE.Mesh(cg, beamMat(0xfff0b0, base)); gp.add(beam);
    S.cans.push({ g: gp, tgt, lens: lensM, glow: gl, beam, base });
  };
  [[-5.0, 'p1'], [-1.8, 'singer'], [1.8, 'singer'], [5.0, 'p2']].forEach(([x, t]) => can(V(x, SY + 5.05, -3.45), t, 7.5, 0.2, 1.5));
  for (const s of [-1, 1]) can(V(s * 6.9, SY + 0.25, 2.6), s < 0 ? 'p1' : 'p2', 6, 0.14, 1.2);

  scene.add(new THREE.HemisphereLight(0x6f8fc4, 0x2a3a1c, 0.85));
  const key = new THREE.SpotLight(0xfff0d0, 1.7, 0, 0.42, 0.7, 0); key.position.set(0, 13, 13); key.target.position.set(0, SY + 0.6, -0.5);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 6; key.shadow.camera.far = 40; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key, key.target); S.lights.key = key;
  const rim = new THREE.DirectionalLight(0x7ab0ff, 1.2); rim.position.set(2, 9, -14); scene.add(rim);
  for (const s of [-1, 1]) { const sp = new THREE.SpotLight(0xffe08a, 2.2, 20, 0.33, 0.6, 0); sp.position.set(s * 5.0, SY + 5.0, -3.3); scene.add(sp, sp.target); S.lights[s < 0 ? 'spotL' : 'spotR'] = sp; }
  const front = new THREE.SpotLight(0xd9ff9a, 1.6, 25, 0.6, 0.8, 0); front.position.set(0, SY + 0.6, 9); front.target.position.set(0, SY + 1.5, 0); scene.add(front, front.target);
  const fx = new THREE.PointLight(0xff8a3a, 0, 10, 1.2); fx.position.set(0, SY + 1.5, 2); scene.add(fx); S.lights.fx = fx;

  const tree = new THREE.Group(); tree.position.set(8.8, 0, -3.8); scene.add(tree);
  const barkM = toon(0xffffff, { map: TX.bark });
  mesh(tree, new THREE.CylinderGeometry(0.75, 1.3, 14, 14), barkM, { pos: [0, 7, 0], outline: 0.04, shadow: true });
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; mesh(tree, G('root', () => new THREE.ConeGeometry(0.45, 1.6, 6)), barkM, { pos: [Math.cos(a) * 1.2, 0.4, Math.sin(a) * 1.2], rot: [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2], outline: 0.03 }); }
  for (const [x, y, z] of [[-2.6, 9.5, 1.6], [2.2, 10.5, 0.8], [-1.2, 12, -1.5]]) { const L = Math.hypot(x, z) + 1.5; const b = mesh(tree, new THREE.CylinderGeometry(0.22, 0.42, L, 8), barkM, { pos: [x / 2, y - 1, z / 2], outline: 0.03 }); b.lookAt(tree.localToWorld(V(x, y + 1, z))); b.rotateX(Math.PI / 2); }
  for (const [x, y, z, r] of [[0, 14.5, 0, 3.6], [-3.2, 12.5, 1.8, 2.8], [2.8, 12.8, 0.8, 2.9], [-1, 13, -2.6, 3], [1.5, 15.5, -1, 2.6]]) mesh(tree, new THREE.IcosahedronGeometry(r, 1), toon(R() < 0.5 ? 0x1d4a26 : 0x275e2c), { pos: [x, y, z], outline: 0.05 });

  const ropeM = toon(0xffffff, { map: TX.rope });
  const ropes = [catenary(V(-7.0, SY + 5.6, -3.6), V(7.8, SY + 7.0, 1.8), 1.1), catenary(V(-9.5, SY + 4.6, 4.2), V(7.6, SY + 5.6, -2.6), 1.3)];
  for (const pts of ropes) mesh(scene, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 5), ropeM, { outline: 0.015 });
  const lantM = new THREE.MeshBasicMaterial({ map: TX.lantern, color: new THREE.Color(1.25, 1.1, 1.1) }), capM = toon(0x151515);
  const lanternAt = (p, drop, size) => {
    const pivot = new THREE.Group(); pivot.position.copy(p); scene.add(pivot);
    pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V(0, -drop, 0)]), new THREE.LineBasicMaterial({ color: 0x111111 })));
    const body = new THREE.Group(); body.position.y = -drop - size * 0.85; pivot.add(body);
    mesh(body, G('lant', () => new THREE.SphereGeometry(1, 20, 14)), lantM, { scale: [size, size * 0.85, size], outline: 0.02 });
    mesh(body, G('lcap', () => new THREE.CylinderGeometry(0.4, 0.45, 0.12, 12)), capM, { pos: [0, size * 0.85, 0], scale: size, outline: 0.01 });
    mesh(body, G('lcap'), capM, { pos: [0, -size * 0.85, 0], scale: size, outline: 0.01 });
    mesh(body, G('tassel', () => new THREE.ConeGeometry(0.12, 0.6, 6)), toon(0xd8201a), { pos: [0, -size * 0.85 - size * 0.32, 0], rot: [Math.PI, 0, 0], scale: size, outline: 0 });
    S.lanterns.push({ pivot, ph: R() * 6 });
  };
  ropes.forEach((pts, ri) => { for (const t of (ri === 0 ? [0.12, 0.33, 0.55, 0.78, 0.92] : [0.2, 0.45, 0.7])) lanternAt(pts[Math.round(t * (pts.length - 1))], rr(0.15, 0.6), rr(0.32, 0.45)); });
  for (const i of [1, 3]) { const pl = new THREE.PointLight(0xff3a1a, 4, 11, 1.2); const lp = S.lanterns[i].pivot.position; pl.position.set(lp.x, lp.y - 1, lp.z); scene.add(pl); }

  const bulbPts = [];
  const strand = pts => { scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x0f2a12 }))); const curve = new THREE.CatmullRomCurve3(pts); const n = Math.floor(curve.getLength() / 0.48); for (let i = 1; i < n; i++) bulbPts.push(curve.getPointAt(i / n)); };
  const multi = (an, sag) => { let pts = []; for (let i = 0; i < an.length - 1; i++) pts = pts.concat(catenary(an[i], an[i + 1], sag, 14).slice(i ? 1 : 0)); return pts; };
  strand(multi([-7, -3.5, 0, 3.5, 7].map(x => V(x, SY + 5.18, -3.62)), 0.45));
  strand(multi([-7.5, -3.75, 0, 3.75, 7.5].map(x => V(x, SY - 0.1, 3.27)), 0.35));
  strand(multi([-6.8, -2.3, 2.3, 6.8].map(x => V(x, SY + 3.25, -4.28)), 0.5));
  strand(catenary(V(-7.0, SY + 4.4, -3.6), V(-7.6, SY, 3.2), 0.6, 20)); strand(catenary(V(7.0, SY + 4.4, -3.6), V(7.6, SY, 3.2), 0.6, 20));
  const bulbGeo = new THREE.CylinderGeometry(0.035, 0.065, 0.15, 8); bulbGeo.translate(0, -0.07, 0);
  const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), bulbPts.length);
  const BC = [[2.6, 0.3, 0.3], [0.3, 2.4, 0.5], [0.4, 1.0, 2.8], [2.6, 2.1, 0.3], [0.6, 2.3, 2.4], [2.4, 0.5, 2.2]];
  const d = new THREE.Object3D(), c = new THREE.Color();
  bulbPts.forEach((p, i) => { d.position.copy(p); d.rotation.set(rr(-0.3, 0.3), 0, rr(-0.3, 0.3)); d.updateMatrix(); bulbs.setMatrixAt(i, d.matrix); const k = BC[i % BC.length]; bulbs.setColorAt(i, c.setRGB(k[0], k[1], k[2])); });
  scene.add(bulbs); S.bulbs = { mesh: bulbs, BC, n: bulbPts.length };

  const coneGeo = new THREE.CylinderGeometry(0.3, 0.1, 0.16, 24, 1, true).rotateX(Math.PI / 2);
  const coneM = toon(0x3a3a3e, { side: THREE.DoubleSide }), capCM = toon(0x202022);
  const speaker = (x, y, z, w, h, n) => {
    const gp = new THREE.Group(); gp.position.set(x, y, z); scene.add(gp);
    mesh(gp, new THREE.BoxGeometry(w, h, 0.9), toon(0x161618), { pos: [0, h / 2, 0], outline: 0.025, shadow: true });
    const cols = n > 2 ? 2 : 1, rows = n > 2 ? 2 : n;
    for (let i = 0; i < n; i++) {
      const cx = cols > 1 ? (i % 2 - 0.5) * w * 0.48 : 0, cy = h / 2 + (rows > 1 ? (Math.floor(i / cols) - 0.5) * h * 0.48 : 0);
      const cg = new THREE.Group(); cg.position.set(cx, cy, 0.38); gp.add(cg); const sc = Math.min(w, h) / (rows > 1 ? 1.75 : 1.0) / 0.65;
      mesh(cg, coneGeo, coneM, { scale: sc * 0.95, outline: 0 });
      mesh(cg, G('torusS', () => new THREE.TorusGeometry(0.3, 0.035, 8, 24)), toon(0x0e0e10), { pos: [0, 0, 0.08 * sc], scale: sc * 0.95, outline: 0 });
      mesh(cg, G('dcap', () => new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), capCM, { pos: [0, 0, -0.06 * sc], scale: sc, outline: 0 });
      S.cones.push(cg);
    }
  };
  for (const s of [-1, 1]) { speaker(s * 6.7, 0, 4.2, 1.7, 1.6, 4); speaker(s * 6.7, 1.6, 4.2, 1.7, 1.0, 2); }
  speaker(-1.0, 0, 3.4, 1.0, 0.9, 1); speaker(1.1, 0, 3.4, 1.1, 1.0, 1);
  const canM = toon(0xffffff, { map: TX.can });
  const lata = (x, y, z, tip) => mesh(scene, G('lata', () => new THREE.CylinderGeometry(0.075, 0.075, 0.2, 12)), canM, { pos: [x, y + (tip ? 0.075 : 0.1), z], rot: tip ? [Math.PI / 2, rr(0, 6), 0] : [0, rr(0, 6), 0], outline: 0.008 });
  for (let i = 0; i < 7; i++) { const x = rr(-6.5, 6.5); if (Math.abs(Math.abs(x) - 3.4) < 1) continue; lata(x, SY, rr(-2.5, 2.8), R() < 0.4); }
  lata(6.4, 3.2, 4.0, false); lata(6.9, 3.2, 4.3, false); lata(-6.6, 3.2, 4.1, false); lata(1.2, 1.0, 3.4, false);

  // batería
  const Dy = SY + 0.3;
  mesh(scene, new THREE.BoxGeometry(3.4, 0.3, 2.3), beamM, { pos: [0, SY + 0.15, -2.75], outline: 0.025, receive: true });
  const kit = new THREE.Group(); kit.position.set(0, Dy, -2.85); scene.add(kit);
  const shellM = toon(0xd9c23a), chromeM = toon(0xd6d6dc), headM = toon(0xf2ecd8), cymM = toon(0xe0b03a);
  const bd = new THREE.Group(); bd.position.set(0, 0.34, 0.85); kit.add(bd);
  mesh(bd, new THREE.CylinderGeometry(0.34, 0.34, 0.42, 26).rotateX(Math.PI / 2), shellM, { outline: 0.015, shadow: true });
  mesh(bd, new THREE.CircleGeometry(0.33, 26), toon(0xffffff, { map: TX.drumHead }), { pos: [0, 0, 0.215], outline: 0 });
  mesh(bd, new THREE.TorusGeometry(0.34, 0.025, 8, 28), chromeM, { pos: [0, 0, 0.215], outline: 0 });
  S.kick = bd;
  const drum = (x, y, z, r, h, tilt) => { const g2 = new THREE.Group(); g2.position.set(x, y, z); g2.rotation.x = tilt; kit.add(g2); mesh(g2, new THREE.CylinderGeometry(r, r, h, 20), shellM, { outline: 0.012 }); mesh(g2, new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.01, 20), headM, { pos: [0, h / 2 + 0.003, 0], outline: 0 }); return g2; };
  drum(0.22, 0.62, 0.42, 0.17, 0.13, 0.25); drum(0.12, 0.84, 0.72, 0.13, 0.18, 0.5); drum(-0.18, 0.84, 0.72, 0.14, 0.2, 0.5); drum(-0.48, 0.42, 0.42, 0.2, 0.4, 0.1);
  const cym = (x, y, z, r, tilt) => { mesh(kit, new THREE.CylinderGeometry(0.008, 0.012, y, 6), chromeM, { pos: [x, y / 2, z], outline: 0 }); return mesh(kit, new THREE.CylinderGeometry(r * 0.1, r, 0.025, 24), cymM, { pos: [x, y, z], rot: [tilt, 0, x > 0 ? -0.2 : 0.2], outline: 0.008 }); };
  S.cym = [cym(0.5, 0.95, 0.38, 0.17, 0.05), cym(0.62, 1.38, 0.72, 0.3, 0.3), cym(-0.62, 1.25, 0.62, 0.33, 0.25)];
  S.cym.forEach(c => c.userData.r0 = c.rotation.x);
  mesh(kit, new THREE.CylinderGeometry(0.2, 0.22, 0.58, 14), toon(0x222222), { pos: [0, 0.29, -0.05], outline: 0.012 });

  // pie de micro (en un grupo: el editor lo oculta)
  const micSet = S.micSet = new THREE.Group(); scene.add(micSet);
  const mb = V(0.05, SY, 1.85), mt = V(0.0, SY + 1.72, 1.5);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = new THREE.Group(); micSet.add(leg); mesh(leg, G('mleg', () => new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6).translate(0, 0.15, 0)), toon(0x222222), { outline: 0 }); orientSeg(leg, V(mb.x + Math.cos(a) * 0.25, SY + 0.01, mb.z + Math.sin(a) * 0.25), V(mb.x, SY + 0.12, mb.z)); }
  const pole = new THREE.Group(); micSet.add(pole); mesh(pole, new THREE.CylinderGeometry(0.014, 0.016, mb.distanceTo(mt), 8).translate(0, mb.distanceTo(mt) / 2, 0), toon(0x5a6a8a), { outline: 0.006 }); orientSeg(pole, mb, mt);
  const mic = new THREE.Group(); mic.position.copy(mt); micSet.add(mic); mic.lookAt(V(0, SY + 1.85, 1.2));
  mesh(mic, new THREE.CylinderGeometry(0.022, 0.03, 0.14, 10).rotateX(Math.PI / 2), toon(0x1a1a1a), { pos: [0, 0, 0.04], outline: 0.006 });
  mesh(mic, new THREE.SphereGeometry(0.038, 12, 10), toon(0x9a9aa2), { pos: [0, 0, 0.13], outline: 0.006 });
  mesh(micSet, taperTube([mb.clone().add(V(0, 0.4, 0)), V(0.3, SY + 0.05, 1.9), V(0.9, SY + 0.02, 2.1), V(1.8, SY + 0.02, 2.4)], 0.01, 0.01, 20, 5), toon(0x111111), { outline: 0 });
  S.micGrip = new THREE.Object3D(); S.micGrip.position.set(0.0, SY + 1.6, 1.52); scene.add(S.micGrip); S.micGrip.updateMatrixWorld();

  for (const s of [-1, 1]) { mesh(scene, new THREE.BoxGeometry(0.6, 1.4, 26), toon(0xffffff, { map: TX.brick }), { pos: [s * 13.5, 0.7, 6], outline: 0.03 }); mesh(scene, new THREE.BoxGeometry(1.1, 1.0, 26), toon(0xffffff, { map: TX.hedge }), { pos: [s * 13.5, 1.85, 6], outline: 0.03 }); }
  const chain = new THREE.Mesh(new THREE.PlaneGeometry(40, 2.6), new THREE.MeshBasicMaterial({ map: TX.chain, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })); chain.position.set(0, 2.9, -7.6); scene.add(chain);
  for (let x = -20; x <= 20; x += 4) mesh(scene, G('fpost', () => new THREE.CylinderGeometry(0.05, 0.05, 4.2, 6)), toon(0x7a8580), { pos: [x, 2.1, -7.6], outline: 0 });
  const houseM = new THREE.MeshBasicMaterial({ map: TX.house, color: 0xb0b0b0 }), roofM = toon(0x121418), wallM = toon(0x1b2533);
  const house = (x, z, w, h, ry) => { const gp = new THREE.Group(); gp.position.set(x, 0, z); gp.rotation.y = ry; scene.add(gp); mesh(gp, new THREE.BoxGeometry(w, h, 6), wallM, { pos: [0, h / 2, 0], outline: 0.05 }); mesh(gp, new THREE.PlaneGeometry(w * 0.92, h * 0.8), houseM, { pos: [0, h * 0.45, 3.01], outline: 0 }); mesh(gp, new THREE.ConeGeometry(w * 0.75, 2.6, 4), roofM, { pos: [0, h + 1.3, 0], rot: [0, Math.PI / 4, 0], scale: [1, 1, 0.75], outline: 0.05 }); };
  house(-17, -16, 10, 5, 0.25); house(-3, -22, 9, 6, 0); house(13, -19, 11, 5, -0.2); house(-22, 2, 8, 4.5, 1.3); house(24, -2, 9, 5, -1.2);
  const palm = (x, z, h, lean) => {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V(x + Math.sin(t * 1.4) * lean, t * h, z)); }
    mesh(scene, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.24, 7), toon(0x5a4528), { outline: 0.03 });
    const leafGeo = new THREE.PlaneGeometry(1.0, 3.6, 1, 8); leafGeo.translate(0, -1.8, 0); const lp = leafGeo.attributes.position; for (let i = 0; i < lp.count; i++) { const y = lp.getY(i); lp.setZ(i, -(y * y) * 0.07); } leafGeo.computeVertexNormals();
    const leafM = toon(0xffffff, { map: TX.leaf, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(leafGeo, leafM); lf.position.copy(pts[8]); lf.rotation.set(0, i / 9 * Math.PI * 2 + rr(-0.2, 0.2), 0, 'YXZ'); lf.rotateX(-1.0 - rr(0, 0.5)); scene.add(lf); }
  };
  palm(-11.5, -9, 9, 1.2); palm(-8.5, -13, 11, -0.8); palm(12.5, -11, 10, -1.4); palm(-15.5, 1, 8.5, 0.9); palm(16, 5, 9.5, -1); palm(-12.8, -5.5, 4.2, 0.6);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.moon, fog: false, transparent: true, depthWrite: false })); moon.position.set(-38, 46, -110); moon.scale.setScalar(36); scene.add(moon);
  const sp = []; for (let i = 0; i < 1400; i++) { const th = R() * Math.PI * 2, ph = R() * 1.25; sp.push(Math.sin(ph) * Math.cos(th) * 200, Math.cos(ph) * 200 + 10, Math.sin(ph) * Math.sin(th) * 200); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
  const fl = new THREE.Group(); fl.position.set(-8.4, 0, 5.2); fl.rotation.y = 0.8; scene.add(fl); const pinkM = toon(0xff5fa8);
  mesh(fl, new THREE.SphereGeometry(0.28, 14, 10), pinkM, { pos: [0, 0.9, 0], scale: [1, 0.75, 1.4], outline: 0.02 });
  mesh(fl, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0.95, 0.3), V(0, 1.25, 0.42), V(0, 1.5, 0.3), V(0, 1.62, 0.38)]), 12, 0.05, 6), pinkM, { outline: 0.012 });
  mesh(fl, new THREE.SphereGeometry(0.1, 10, 8), pinkM, { pos: [0, 1.66, 0.42], outline: 0.012 });
  mesh(fl, new THREE.ConeGeometry(0.035, 0.16, 6), toon(0x111111), { pos: [0, 1.62, 0.55], rot: [2.0, 0, 0], outline: 0 });
  for (const s of [-0.07, 0.07]) mesh(fl, new THREE.CylinderGeometry(0.012, 0.012, 0.75, 5), toon(0x333333), { pos: [s, 0.38, 0], outline: 0 });
  const fire = new THREE.Group(); fire.position.copy(FIRE); scene.add(fire);
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; mesh(fire, G('rock', () => new THREE.DodecahedronGeometry(0.22, 0)), toon(0x5a5f5a), { pos: [Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75], rot: [R(), R(), R()], outline: 0.012 }); }
  for (let i = 0; i < 4; i++) mesh(fire, G('log', () => new THREE.CylinderGeometry(0.08, 0.1, 1.2, 7)), toon(0x4a3018), { pos: [0, 0.18, 0], rot: [Math.PI / 2 - 0.3, i * 0.8, 0], outline: 0.012 });
  for (let i = 0; i < 22; i++) { const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.flame, color: i % 3 ? 0xff8a2a : 0xffd04a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); fire.add(s2); S.fireSprites.push({ s: s2, ph: R(), x: rr(-0.35, 0.35), z: rr(-0.35, 0.35), sp: rr(0.7, 1.3) }); }
  const fl2 = new THREE.PointLight(0xff8a3a, 6, 14, 1.2); fl2.position.set(FIRE.x, 1.4, FIRE.z); scene.add(fl2); S.lights.fire = fl2;
  // boquillas de pirotecnia en el borde del escenario
  for (const x of [-5.6, -2.0, 2.0, 5.6]) mesh(scene, G('pyro', () => new THREE.CylinderGeometry(0.13, 0.16, 0.22, 10)), toon(0x222226), { pos: [x, SY + 0.11, 2.85], outline: 0.01 });
}

/* =====================================================================
   GUITARRAS
   ===================================================================== */
const shapeFrom = (fn) => { const s = new THREE.Shape(); fn(s); return s; };
const starShape = (cx, cy, Ro, Ri, a0 = Math.PI / 2, n = 5) => shapeFrom(s => { for (let k = 0; k < n * 2; k++) { const a = a0 + k * Math.PI / n, r = k % 2 ? Ri : Ro; k ? s.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : s.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } s.closePath(); });
const heartShape = k => shapeFrom(s => { s.moveTo(0, -k); s.bezierCurveTo(-k * 0.2, -k * 0.6, -k * 1.1, -k * 0.3, -k, k * 0.3); s.bezierCurveTo(-k * 0.95, k * 0.85, -k * 0.25, k * 0.95, 0, k * 0.45); s.bezierCurveTo(k * 0.25, k * 0.95, k * 0.95, k * 0.85, k, k * 0.3); s.bezierCurveTo(k * 1.1, -k * 0.3, k * 0.2, -k * 0.6, 0, -k); });
/* cuerpo en corazón (lóbulos hacia el mástil, punta hacia atrás) */
const heartBody = (k, x0) => shapeFrom(s => { for (let i = 0; i <= 72; i++) { const t = i / 72 * Math.PI * 2, xp = 16 * Math.sin(t) ** 3, yp = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t), X = 0.0155 * k * yp + x0, Y = 0.0115 * k * xp; i ? s.lineTo(X, Y) : s.moveTo(X, Y); } });
/* luna creciente: círculo (c1, R1) menos otro círculo (c2, R2) */
function crescentShape(c1x, c1y, R1, c2x, c2y, R2) {
  const dx = c2x - c1x, dy = c2y - c1y, d = Math.hypot(dx, dy), a = (R1 * R1 - R2 * R2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, R1 * R1 - a * a));
  const mx = c1x + a * dx / d, my = c1y + a * dy / d, A = [mx - h * dy / d, my + h * dx / d], B = [mx + h * dy / d, my - h * dx / d];
  return shapeFrom(s => { s.absarc(c1x, c1y, R1, Math.atan2(B[1] - c1y, B[0] - c1x), Math.atan2(A[1] - c1y, A[0] - c1x), true); s.absarc(c2x, c2y, R2, Math.atan2(A[1] - c2y, A[0] - c2x), Math.atan2(B[1] - c2y, B[0] - c2x), false); });
}
const boltShape = h => shapeFrom(s => { [[0.1, 0.5], [-0.25, 0.02], [0.02, 0.02], [-0.12, -0.5], [0.28, 0.08], [0.0, 0.08], [0.18, 0.5]].forEach(([x, y], i) => i ? s.lineTo(x * h, y * h) : s.moveTo(x * h, y * h)); s.closePath(); });
const GTYPES = {
  offset: {
    shape: () => shapeFrom(s => { s.moveTo(-0.25, 0); s.bezierCurveTo(-0.26, 0.13, -0.16, 0.18, -0.05, 0.165); s.bezierCurveTo(0.05, 0.155, 0.12, 0.2, 0.22, 0.15); s.bezierCurveTo(0.2, 0.09, 0.15, 0.05, 0.12, 0.04); s.lineTo(0.12, -0.04); s.bezierCurveTo(0.16, -0.06, 0.2, -0.09, 0.19, -0.12); s.bezierCurveTo(0.1, -0.19, 0.02, -0.17, -0.06, -0.17); s.bezierCurveTo(-0.17, -0.18, -0.26, -0.12, -0.25, 0); }),
    guard: () => shapeFrom(s => { s.moveTo(0.12, 0.035); s.bezierCurveTo(0.06, 0.07, -0.04, 0.06, -0.09, 0.045); s.bezierCurveTo(-0.16, 0.02, -0.22, -0.06, -0.17, -0.12); s.bezierCurveTo(-0.1, -0.16, 0.02, -0.15, 0.09, -0.11); s.bezierCurveTo(0.14, -0.08, 0.13, -0.05, 0.12, -0.035); s.closePath(); }),
    head: () => shapeFrom(s => { s.moveTo(0, -0.03); s.lineTo(0.07, -0.048); s.lineTo(0.2, -0.03); s.lineTo(0.25, 0.035); s.lineTo(0.18, 0.055); s.lineTo(0.05, 0.048); s.lineTo(0, 0.03); s.closePath(); }),
    tuners: [0.05, 0.075, 0.1, 0.125, 0.15, 0.175].map(x => [x, 0.05, 1]),
    pickups: [['single', -0.065], ['single', 0.03]], bridge: -0.13, trem: true, knobs: [[-0.13, -0.1], [-0.075, -0.125], [-0.185, -0.065]], sw: [0.05, 0.11],
    tailBtn: [-0.26, 0], hornBtn: [0.21, 0.145], tip: [0.25, 0.035],
  },
  vee: {
    shape: () => shapeFrom(s => { s.moveTo(0.15, 0.045); s.lineTo(-0.34, 0.215); s.quadraticCurveTo(-0.43, 0.245, -0.44, 0.17); s.lineTo(-0.17, 0.035); s.quadraticCurveTo(-0.15, 0, -0.17, -0.035); s.lineTo(-0.44, -0.17); s.quadraticCurveTo(-0.43, -0.245, -0.34, -0.215); s.lineTo(0.15, -0.045); s.quadraticCurveTo(0.17, 0, 0.15, 0.045); }),
    guard: () => shapeFrom(s => { s.moveTo(0.14, 0.04); s.lineTo(-0.05, 0.085); s.lineTo(-0.15, 0.06); s.lineTo(-0.15, -0.06); s.lineTo(-0.05, -0.085); s.lineTo(0.14, -0.04); s.closePath(); }),
    head: () => shapeFrom(s => { s.moveTo(0, -0.03); s.lineTo(0.17, -0.065); s.lineTo(0.22, 0); s.lineTo(0.17, 0.065); s.lineTo(0, 0.03); s.closePath(); }),
    tuners: [[0.05, -0.04, -1], [0.095, -0.05, -1], [0.14, -0.06, -1], [0.05, 0.04, 1], [0.095, 0.05, 1], [0.14, 0.06, 1]],
    pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.135, knobs: [[-0.2, -0.115], [-0.27, -0.14], [-0.235, -0.17]], sw: [-0.2, 0.13],
    tailBtn: [-0.42, -0.2], hornBtn: [0.13, 0.055], tip: [0.22, 0],
  },
  sg: {
    shape: () => shapeFrom(s => { s.moveTo(0.1, 0.045); s.bezierCurveTo(0.14, 0.06, 0.2, 0.1, 0.215, 0.16); s.bezierCurveTo(0.16, 0.15, 0.1, 0.13, 0.05, 0.14); s.bezierCurveTo(-0.05, 0.17, -0.2, 0.18, -0.25, 0.1); s.bezierCurveTo(-0.29, 0.05, -0.29, -0.05, -0.25, -0.1); s.bezierCurveTo(-0.2, -0.18, -0.05, -0.17, 0.04, -0.14); s.bezierCurveTo(0.09, -0.13, 0.14, -0.14, 0.185, -0.155); s.bezierCurveTo(0.16, -0.1, 0.13, -0.06, 0.1, -0.045); s.closePath(); }),
    guard: () => shapeFrom(s => { s.moveTo(0.1, -0.04); s.lineTo(0.0, -0.045); s.bezierCurveTo(-0.08, -0.06, -0.12, -0.1, -0.17, -0.13); s.bezierCurveTo(-0.1, -0.15, 0.0, -0.14, 0.06, -0.12); s.bezierCurveTo(0.1, -0.1, 0.11, -0.06, 0.1, -0.04); s.closePath(); }),
    head: () => shapeFrom(s => { s.moveTo(0, -0.03); s.lineTo(0.17, -0.05); s.quadraticCurveTo(0.205, -0.052, 0.2, -0.02); s.quadraticCurveTo(0.185, 0, 0.2, 0.02); s.quadraticCurveTo(0.205, 0.052, 0.17, 0.05); s.lineTo(0, 0.03); s.closePath(); }),
    tuners: [[0.06, -0.04, -1], [0.105, -0.045, -1], [0.15, -0.05, -1], [0.06, 0.04, 1], [0.105, 0.045, 1], [0.15, 0.05, 1]],
    pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.145, knobs: [[-0.15, -0.085], [-0.205, -0.055], [-0.135, -0.13], [-0.195, -0.105]], sw: [0.13, 0.1],
    tailBtn: [-0.28, 0], hornBtn: [0.21, 0.155], tip: [0.2, 0],
  },
};
GTYPES.explorer = {
  shape: () => shapeFrom(s => { s.moveTo(0.12, 0.045); s.lineTo(0.27, 0.13); s.quadraticCurveTo(0.275, 0.16, 0.245, 0.165); s.lineTo(-0.02, 0.13); s.lineTo(-0.2, 0.155); s.quadraticCurveTo(-0.37, 0.16, -0.38, 0.03); s.lineTo(-0.3, -0.125); s.quadraticCurveTo(-0.27, -0.15, -0.2, -0.14); s.lineTo(-0.08, -0.13); s.lineTo(0.06, -0.068); s.lineTo(0.12, -0.045); s.closePath(); }),
  guard: () => shapeFrom(s => { s.moveTo(0.11, 0.04); s.lineTo(0.2, 0.1); s.lineTo(0.0, 0.1); s.lineTo(-0.16, 0.12); s.lineTo(-0.13, 0.03); s.lineTo(-0.05, -0.05); s.lineTo(0.05, -0.055); s.lineTo(0.11, -0.04); s.closePath(); }),
  head: () => shapeFrom(s => { s.moveTo(0, -0.03); s.lineTo(0.2, -0.062); s.quadraticCurveTo(0.245, -0.07, 0.25, -0.035); s.lineTo(0.2, 0.045); s.lineTo(0, 0.03); s.closePath(); }),
  tuners: [0.045, 0.075, 0.105, 0.135, 0.165, 0.195].map(x => [x, 0.035 + x * 0.05, 1]),
  pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.145, knobs: [[-0.17, -0.085], [-0.22, -0.06], [-0.27, -0.035]], sw: [0.09, 0.105],
  tailBtn: [-0.375, 0.03], hornBtn: [0.25, 0.15], tip: [0.25, -0.035],
};
GTYPES.heart = {
  shape: () => heartBody(1, 0.035), guard: () => heartBody(0.62, 0.062), head: GTYPES.offset.head, tuners: GTYPES.offset.tuners,
  pickups: [['hum', -0.03], ['hum', 0.055]], bridge: -0.09, tail: -0.125, knobs: [[-0.09, -0.06], [-0.05, -0.095], [0.0, -0.125]], sw: [0.07, 0.125],
  tailBtn: [-0.225, 0], hornBtn: [0.19, 0.12], tip: [0.25, 0.035],
};
GTYPES.star = {
  shape: () => starShape(-0.03, 0, 0.255, 0.13, Math.PI), guard: () => starShape(-0.03, 0, 0.12, 0.07, Math.PI), head: GTYPES.vee.head, tuners: GTYPES.vee.tuners,
  pickups: [['hum', -0.04], ['hum', 0.045]], bridge: -0.095, tail: -0.13, knobs: [[-0.07, -0.13], [-0.085, -0.17]], sw: [-0.075, 0.15],
  tailBtn: [-0.28, 0], hornBtn: [0.16, 0.135], tip: [0.22, 0],
};
/* guitarras legendarias: cuerpo con forma propia + material animado [efecto, color de brillo, escala del patrón] */
GTYPES.hacha = {   // hacha de doble filo
  shape: () => shapeFrom(s => { s.moveTo(0.13, 0.04); s.lineTo(0.0, 0.055); s.lineTo(0.08, 0.2); s.quadraticCurveTo(-0.12, 0.33, -0.32, 0.2); s.lineTo(-0.2, 0.06); s.quadraticCurveTo(-0.24, 0, -0.2, -0.06); s.lineTo(-0.32, -0.2); s.quadraticCurveTo(-0.12, -0.33, 0.08, -0.2); s.lineTo(0.0, -0.055); s.lineTo(0.13, -0.04); s.closePath(); }),
  guard: null, head: GTYPES.explorer.head, tuners: GTYPES.explorer.tuners,
  pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.135, knobs: [[-0.16, -0.15], [-0.1, -0.17], [-0.22, -0.14]], sw: [-0.1, 0.2],
  tailBtn: [-0.22, 0], hornBtn: [0.07, 0.19], tip: [0.25, -0.035], leg: ['lava', 0xff5a10, 7],
};
GTYPES.rayoG = {   // rayo en zigzag
  shape: () => shapeFrom(s => { [[0.14, 0.045], [0.05, 0.08], [0.2, 0.19], [-0.06, 0.12], [-0.02, 0.15], [-0.3, 0.17], [-0.2, 0.06], [-0.26, 0.0], [-0.16, -0.06], [-0.36, -0.2], [-0.04, -0.11], [-0.08, -0.15], [0.12, -0.12], [0.05, -0.08], [0.14, -0.045]].forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); }),
  guard: null, head: GTYPES.vee.head, tuners: GTYPES.vee.tuners,
  pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.135, knobs: [[-0.13, 0.1], [-0.19, 0.125], [-0.1, 0.13]], sw: [0.06, -0.1],
  tailBtn: [-0.26, 0], hornBtn: [0.18, 0.18], tip: [0.22, 0], leg: ['electric', 0x6ad8ff, 7],
};
GTYPES.mariposa = {   // alas de mariposa
  shape: () => shapeFrom(s => {
    s.moveTo(0.13, 0.04); s.bezierCurveTo(0.17, 0.15, 0.1, 0.28, -0.02, 0.265); s.bezierCurveTo(-0.12, 0.25, -0.15, 0.14, -0.1, 0.075);
    s.bezierCurveTo(-0.2, 0.17, -0.34, 0.15, -0.33, 0.07); s.bezierCurveTo(-0.32, 0.03, -0.27, 0.015, -0.255, 0); s.bezierCurveTo(-0.27, -0.015, -0.32, -0.03, -0.33, -0.07);
    s.bezierCurveTo(-0.34, -0.15, -0.2, -0.17, -0.1, -0.075); s.bezierCurveTo(-0.15, -0.14, -0.12, -0.25, -0.02, -0.265); s.bezierCurveTo(0.1, -0.28, 0.17, -0.15, 0.13, -0.04); s.closePath();
  }),
  guard: null, head: GTYPES.offset.head, tuners: GTYPES.offset.tuners,
  pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.135, knobs: [[-0.24, -0.08], [-0.27, -0.1], [-0.21, -0.11]], sw: [0.02, 0.17],
  tailBtn: [-0.255, 0], hornBtn: [0.0, 0.25], tip: [0.25, 0.035], leg: ['holo', 0xffffff, 6],
};
GTYPES.luna = {   // luna creciente
  shape: () => crescentShape(-0.08, 0, 0.22, -0.32, 0.06, 0.17), guard: null, head: GTYPES.vee.head, tuners: GTYPES.vee.tuners,
  pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.135, knobs: [[-0.1, -0.15], [-0.04, -0.17], [-0.15, -0.12]], sw: [-0.02, 0.17],
  tailBtn: [-0.25, -0.09], hornBtn: [-0.19, 0.17], tip: [0.22, 0], leg: ['galaxy', 0x2ad8ff, 7],
};
GTYPES.llamaG = {   // cuerpo de llamas con lenguas hacia arriba y abajo
  shape: () => shapeFrom(s => { const P = [[0.06, 0.075], [0.11, 0.19], [0.0, 0.12], [-0.04, 0.24], [-0.11, 0.13], [-0.2, 0.22], [-0.21, 0.1], [-0.3, 0.12], [-0.28, 0.03], [-0.33, -0.03], [-0.28, -0.09], [-0.33, -0.19], [-0.2, -0.13], [-0.17, -0.24], [-0.08, -0.14], [0.02, -0.2], [0.05, -0.08], [0.13, -0.04]];
    s.moveTo(0.13, 0.04); s.splineThru(P.map(([x, y]) => new THREE.Vector2(x, y))); s.closePath(); }),
  guard: null, head: GTYPES.explorer.head, tuners: GTYPES.explorer.tuners,
  pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.135, knobs: [[-0.2, -0.1], [-0.15, -0.115], [-0.24, -0.06]], sw: [-0.07, 0.1],
  tailBtn: [-0.3, 0], hornBtn: [-0.04, 0.2], tip: [0.25, -0.035], leg: ['fire', 0xffd040, 7],
};
GTYPES.gema = {   // gema tallada: contorno de facetas rectas
  shape: () => shapeFrom(s => { [[0.13, 0.04], [0.05, 0.16], [-0.12, 0.22], [-0.3, 0.1], [-0.35, 0], [-0.3, -0.1], [-0.12, -0.22], [0.05, -0.16], [0.13, -0.04]].forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); }),
  guard: null, head: GTYPES.vee.head, tuners: GTYPES.vee.tuners,
  pickups: [['hum', -0.045], ['hum', 0.055]], bridge: -0.1, tail: -0.135, knobs: [[-0.2, -0.12], [-0.25, -0.07], [-0.15, -0.15]], sw: [-0.06, 0.13],
  tailBtn: [-0.35, 0], hornBtn: [-0.12, 0.2], tip: [0.22, 0], leg: ['crystal', 0xffffff, 6],
};
const GLOW_G = { hacha: [0xff5a10, 0xffd040], rayoG: [0x4ab8ff, 0xffffff], mariposa: [0xff6ad8, 0x9ae8ff], luna: [0x8a5aff, 0x2ad8ff], llamaG: [0xff6a10, 0xffd040], gema: [0x6ad8ff, 0xffffff] };   // [borde, punta] del aura
const fretX = f => 0.9 - 0.9 * (1 - Math.pow(2, -f / 12));
function makeGuitar(c) {
  const T = GTYPES[c.type]; const g = new THREE.Group(); const B = new Batch();
  const metal = toon(0xd2d5de), dark = toon(0x121212), cream = toon(0xf1e9d2), pearl = toon(0xf6f2e6), rose = toon(0x2b170d), neckM = toon(0xc8935a), knobM = toon(c.knob ?? 0xf6f1df);
  const body = new THREE.ExtrudeGeometry(T.shape(), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.013, bevelSize: 0.012, bevelSegments: 3, curveSegments: 28 }); body.translate(0, 0, -0.025);
  const LG = T.leg, bodyM = LG ? legMat(LG[0], c.body, LG[1], { scale: LG[2], side: THREE.FrontSide }) : toon(c.body);
  mesh(g, body, bodyM, { outline: 0.007, shadow: true });
  if (LG) {   // aura legendaria: el mismo contorno de luz que los peinados, pegado a la silueta del cuerpo
    const [ga, gb] = GLOW_G[c.type] ?? [LG[1], 0xffffff], au = new THREE.Mesh(body, auraMat(ga, gb, LG[0] === 'electric'));
    au.renderOrder = 6; au.frustumCulled = false; g.add(au);
  }
  if (T.guard) B.add(toon(c.guard ?? 0xf2f2f2), new THREE.ExtrudeGeometry(T.guard(), { depth: 0.003, bevelEnabled: false, curveSegments: 20 }), [0, 0, 0.037], [0, 0, 0], [1, 1, 1], 0.002);
  B.add(neckM, new THREE.BoxGeometry(0.8, 0.054, 0.022), [0.5, 0, 0.016]);
  B.add(neckM, new THREE.CylinderGeometry(0.027, 0.027, 0.8, 12, 1, false, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), [0.5, 0, 0.007], [0, 0, 0], [1, 1, 0.65]);
  B.add(rose, new THREE.BoxGeometry(0.77, 0.057, 0.007), [0.515, 0, 0.0295], [0, 0, 0], [1, 1, 1], 0.003);
  for (let n = 1; n <= 22; n++) { const x = fretX(n); if (x < 0.14) break; B.add(metal, new THREE.BoxGeometry(0.003, 0.057, 0.004), [x, 0, 0.034]); }
  const dot = new THREE.CylinderGeometry(0.0055, 0.0055, 0.002, 12).rotateX(Math.PI / 2);
  for (const n of [3, 5, 7, 9, 15, 17, 19]) { const x = (fretX(n) + fretX(n - 1)) / 2; if (x > 0.15) B.add(pearl, dot, [x, 0, 0.0335]); }
  { const x = (fretX(12) + fretX(11)) / 2; B.add(pearl, dot, [x, 0.016, 0.0335]); B.add(pearl, dot, [x, -0.016, 0.0335]); }
  B.add(cream, new THREE.BoxGeometry(0.006, 0.058, 0.008), [0.9, 0, 0.031]);
  // pastillas
  const pole = new THREE.CylinderGeometry(0.0028, 0.0028, 0.004, 6).rotateX(Math.PI / 2);
  for (const [kind, x] of T.pickups) {
    if (kind === 'hum') { B.add(c.guard === 0xf2f2f2 ? cream : dark, new THREE.BoxGeometry(0.052, 0.088, 0.005), [x, 0, 0.039]); B.add(dark, new THREE.BoxGeometry(0.04, 0.076, 0.012), [x, 0, 0.045], [0, 0, 0], [1, 1, 1], 0.002); for (let k = 0; k < 6; k++) for (const dx of [-0.01, 0.01]) B.add(metal, pole, [x + dx, -0.026 + k * 0.0104, 0.052]); }
    else { B.add(cream, new THREE.BoxGeometry(0.024, 0.078, 0.012), [x, 0, 0.045], [0, 0, 0], [1, 1, 1], 0.002); for (let k = 0; k < 6; k++) B.add(dark, pole, [x, -0.026 + k * 0.0104, 0.052]); }
  }
  // puente / cordal / trémolo
  B.add(metal, new THREE.BoxGeometry(0.014, 0.08, 0.012), [T.bridge, 0, 0.047], [0, 0, 0], [1, 1, 1], 0.002);
  for (let k = 0; k < 6; k++) B.add(metal, new THREE.BoxGeometry(0.008, 0.009, 0.006), [T.bridge + 0.004, -0.026 + k * 0.0104, 0.055]);
  if (T.tail !== undefined) B.add(metal, new THREE.CylinderGeometry(0.008, 0.008, 0.085, 10), [T.tail, 0, 0.048], [0, 0, 0], [1, 1, 1], 0.002);
  if (T.trem) { B.add(metal, new THREE.BoxGeometry(0.055, 0.092, 0.004), [T.bridge - 0.01, 0, 0.04], [0, 0, 0], [1, 1, 1], 0.002); B.add(metal, taperTube([V(T.bridge - 0.02, -0.04, 0.045), V(T.bridge - 0.03, -0.07, 0.07), V(T.bridge - 0.06, -0.14, 0.09)], 0.003, 0.003, 10, 5)); }
  for (const [x, y] of T.knobs) { B.add(knobM, new THREE.CylinderGeometry(0.013, 0.015, 0.018, 14).rotateX(Math.PI / 2), [x, y, 0.047], [0, 0, 0], [1, 1, 1], 0.002); B.add(metal, new THREE.CylinderGeometry(0.006, 0.006, 0.004, 10).rotateX(Math.PI / 2), [x, y, 0.057]); }
  B.add(metal, new THREE.CylinderGeometry(0.003, 0.004, 0.028, 6).rotateX(Math.PI / 2 + 0.3), [T.sw[0], T.sw[1], 0.05]); B.add(cream, new THREE.SphereGeometry(0.006, 8, 6), [T.sw[0], T.sw[1] + 0.004, 0.064]);
  for (const b of [T.tailBtn, T.hornBtn]) B.add(metal, new THREE.CylinderGeometry(0.006, 0.006, 0.012, 8).rotateX(Math.PI / 2), [b[0], b[1], 0]);
  // clavijero
  const hs = new THREE.Group(); hs.position.set(0.9, 0, 0.014); hs.rotation.y = 0.17; g.add(hs);
  const hb = new Batch();
  mesh(hs, new THREE.ExtrudeGeometry(T.head(), { depth: 0.017, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }).translate(0, 0, -0.0085), LG && c.head === undefined ? bodyM : toon(c.head ?? c.body), { outline: 0.006 });
  for (const [x, y, s] of T.tuners) { hb.add(metal, new THREE.CylinderGeometry(0.005, 0.006, 0.016, 8).rotateX(Math.PI / 2), [x, y * 0.7, 0.014]); hb.add(metal, new THREE.BoxGeometry(0.012, 0.02, 0.006), [x, y + s * 0.022, -0.012], [0, 0, 0], [1, 1, 1], 0.002); hb.add(metal, new THREE.BoxGeometry(0.016, 0.014, 0.012), [x, y * 0.85, -0.016]); }
  hb.build(hs);
  const tip = new THREE.Object3D(); tip.position.set(T.tip[0], T.tip[1], 0); hs.add(tip);
  B.build(g, true);
  // cuerdas
  const sp = []; for (let i = 0; i < 6; i++) { const y = -0.026 + i * 0.0104; sp.push(T.bridge, y, 0.056, 0.9, y * 0.75, 0.036); }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const strings = new THREE.LineSegments(sgeo, new THREE.LineBasicMaterial({ color: LG ? new THREE.Color(LG[1]).multiplyScalar(2.2) : 0xeeeeee })); g.add(strings);   // las legendarias tienen cuerdas que brillan
  const strum = new THREE.Object3D(); strum.position.set(-0.01, 0, 0.09); g.add(strum);
  const fret = new THREE.Object3D(); fret.position.set(fretX(5), -0.045, 0.0); g.add(fret);
  return { g, strum, fret, tip, T, strings };
}

/* =====================================================================
   PERSONAJES — cuerpo base con esqueleto + piezas personalizables
   ===================================================================== */
const _a = V(), _b = V(), _c = V(), _d = V(), _v2 = V(), _v3 = V(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const DOWN = V(0, -1, 0), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
/* de la mano en reposo (dedos abajo, palma hacia el muslo, pulgar adelante) al marco usado por las poses (dedos +y, palma +z) */
const _hh = V(), _hv = V(), _hd1 = V(), _hd2 = V(), _hq = new THREE.Quaternion(), _hq2 = new THREE.Quaternion(), _hq3 = new THREE.Quaternion();
const _q4 = new THREE.Quaternion(), _q5 = new THREE.Quaternion(), _hf = V(), _hp = V(), _hc = V(), _hm = new THREE.Matrix4();
/* marco de mano: dedos hacia f, palma mirando hacia p (espacio del personaje) → cuaternión del hueso de la mano */
const HAND_BT = [1, -1].map(s => new THREE.Matrix4().makeBasis(V(0, -1, 0), V(-s, 0, 0), V(0, 0, -s)).transpose());
function handFrame(f, p, i, out) {
  f.normalize(); p.addScaledVector(f, -p.dot(f)).normalize(); _hc.crossVectors(f, p);
  return out.setFromRotationMatrix(_hm.makeBasis(f, p, _hc).multiply(HAND_BT[i]));
}
/* manos sobre la guitarra (espacio de la guitarra): mano del mástil rodea el mástil desde abajo; la de la púa cae sobre las cuerdas */
const HAND_G = [{ f: V(0.1, 0.35, 1), p: V(0, 1, -0.25) }, { f: V(0.3, -1, 0.05), p: V(0, 0.1, -1) }];
const HAND_C = [1, -1].map(s => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(0, 0, -s, 0, 0, -1, 0, 0, -s, 0, 0, 0, 0, 0, 0, 1)));
function ik2(a, t, l1, l2, pole, outE, outT) {
  _v2.subVectors(t, a); let d = _v2.length(); _v2.divideScalar(d || 1);
  d = clamp(d, Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.002);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _v3.subVectors(pole, a); _v3.addScaledVector(_v2, -_v3.dot(_v2)); if (_v3.lengthSq() < 1e-8) _v3.set(0, 0, 1); _v3.normalize();
  outE.copy(a).addScaledVector(_v2, x).addScaledVector(_v3, h); outT.copy(a).addScaledVector(_v2, d);
}
const HAND_POSES = {
  grip: [[1.15, 1.25], [1.2, 1.3], [1.25, 1.3], [1.3, 1.3], [0.5, 0.4]],
  pick: [[1.1, 1.15], [1.2, 1.1], [1.25, 1.05], [1.3, 1.0], [0.8, 0.5]],
  fist: [[1.6, 1.7], [1.6, 1.7], [1.6, 1.7], [1.6, 1.7], [0.6, 0.7]],
  open: [[0.15, 0.1], [0.1, 0.05], [0.12, 0.08], [0.2, 0.1], [0.1, 0.1]],
  point: [[0.05, 0.0], [1.6, 1.7], [1.6, 1.7], [1.6, 1.7], [0.6, 0.6]],
  horns: [[0.05, 0.0], [1.6, 1.7], [1.6, 1.7], [0.05, 0.0], [0.7, 0.8]],
};
const POSE0 = { rootX: 0, rootY: 0, rootZ: 0, rootYaw: 0, hipX: 0, hipZ: 0, hipDrop: 0.04, pelvis: 0, bodyYaw: 0, bodyRoll: 0, lean: 0.08, torsoYaw: 0, torsoRoll: 0, headPitch: 0, headYaw: 0, headRoll: 0,
  gx: 0, gy: 0, gz: 0, stance: 0, fwdL: 0, fwdR: 0, liftL: 0, liftR: 0, mouth: 0, brow: 0, lid: 0.36, shake: 0, kneel: 0, ovS: 0, ovF: 0, lookCam: 0, lookOpp: 0, sneer: 0, handS: 'pick', handF: 'grip' };

const B_HIPS = 0, B_SPINE = 1, B_CHEST = 2, B_NECK = 3, B_HEAD = 4, B_JAW = 5, B_UA = [6, 8], B_FA = [7, 9], B_TH = [10, 12], B_SH = [11, 13], B_FTW = [14, 31], B_HAND = [15, 32];   // torsión del antebrazo + mano + 5 dedos × 3 falanges por lado
const L_UP = 0.33, L_FO = 0.31, L_TH = 0.5, L_SH = 0.47;
/* cabeceo: baja acelerando hasta el golpe (en el pulso) y sube suave; ph = fase 0..1 */
const nodCurve = (ph, a = 0.6) => ph < a ? 1 - smooth(ph / a) : ((ph - a) / (1 - a)) ** 2;
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-((x - cx) ** 2) / (2 * sx * sx) - ((y - cy) ** 2) / (2 * sy * sy));

/* interpolación Catmull-Rom de filas de perfil [y, ...valores] */
function crRows(K, step) {
  const out = [], m = K.length;
  for (let i = 0; i < m - 1; i++) {
    const P0 = K[Math.max(0, i - 1)], P1 = K[i], P2 = K[i + 1], P3 = K[Math.min(m - 1, i + 2)];
    const n = Math.max(1, Math.round(Math.abs(P2[0] - P1[0]) / step));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push(P1.map((_, c) => 0.5 * (2 * P1[c] + (-P0[c] + P2[c]) * t + (2 * P0[c] - 5 * P1[c] + 4 * P2[c] - P3[c]) * t2 + (-P0[c] + 3 * P1[c] - 3 * P2[c] + P3[c]) * t3))); }
  }
  out.push(K[m - 1].slice()); return out;
}
/* n muestras entre a y b con densidad variable (más vértices donde importa: cara, boca) */
function warpList(n, a, b, dens) {
  const M = 3000, cdf = [0]; let acc = 0;
  for (let i = 1; i <= M; i++) { acc += dens(a + (b - a) * (i - 0.5) / M); cdf.push(acc); }
  const out = []; let k = 0;
  for (let i = 0; i < n; i++) { const target = acc * i / (n - 1); while (k < M - 1 && cdf[k + 1] < target) k++; const f = (target - cdf[k]) / Math.max(1e-9, cdf[k + 1] - cdf[k]); out.push(a + (b - a) * (k + clamp(f, 0, 1)) / M); }
  return out;
}
/* constructor de mallas con pesos de esqueleto */
class GeoB {
  constructor() { this.P = []; this.UV = []; this.SI = []; this.SW = []; this.C = []; this.I = []; this.M = []; this.n = 0; this.seams = []; }
  vert(x, y, z, u, v, W, meta, col) {
    this.P.push(x, y, z); this.UV.push(u, v);
    W = W.filter(w => w[1] > 1e-4).sort((p, q) => q[1] - p[1]).slice(0, 4); let s = 0; for (const w of W) s += w[1];
    for (let k = 0; k < 4; k++) { this.SI.push(W[k] ? W[k][0] : 0); this.SW.push(W[k] ? W[k][1] / s : 0); }
    if (col) this.C.push(col.r, col.g, col.b);
    this.M.push(meta); return this.n++;
  }
  grid(rows, cols, fn) {
    const base = this.n;
    for (let i = 0; i < rows; i++) for (let j = 0; j <= cols; j++) fn(i, j);
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) { const a = base + i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1; this.I.push(a, b, c, b, d, c); }
    this.seams.push([base, rows, cols]);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    if (this.C.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setIndex(this.I); g.computeVertexNormals();
    const N = g.attributes.normal;
    for (const [base, rows, cols] of this.seams) for (let i = 0; i < rows; i++) { const a = base + i * (cols + 1), b = a + cols; const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b); const l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); }
    return { geo: g, meta: this.M };
  }
}
/* "cáscara": copia una región de la malla base, inflada hacia fuera. Así se hacen ropa, pelo y barbas
   que se deforman exactamente igual que el cuerpo. any=true conserva triángulos con algún vértice válido */
function shellGeo(src, pred, inflate = 0.005, any = false, clip = null) {
  const g = src.geo, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, C = g.attributes.color, OW = g.attributes.olw, I = g.index.array;
  const ok = new Uint8Array(P.count); for (let i = 0; i < P.count; i++) ok[i] = pred(src.meta[i]) ? 1 : 0;
  const map = new Int32Array(P.count).fill(-1); const inf = typeof inflate === 'function' ? inflate : () => inflate;
  const pos = [], nor = [], uv = [], si = [], sw = [], col = [], ow = [], cl = [], idx = [], meta = []; let n = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (any ? !(ok[a] || ok[b] || ok[c]) : !(ok[a] && ok[b] && ok[c])) continue;
    for (const v of [a, b, c]) {
      if (map[v] < 0) {
        map[v] = n++; const k = inf(src.meta[v]);
        pos.push(P.getX(v) + N.getX(v) * k, P.getY(v) + N.getY(v) * k, P.getZ(v) + N.getZ(v) * k); nor.push(N.getX(v), N.getY(v), N.getZ(v));
        uv.push(UV.getX(v), UV.getY(v)); si.push(SI.getX(v), SI.getY(v), SI.getZ(v), SI.getW(v)); sw.push(SW.getX(v), SW.getY(v), SW.getZ(v), SW.getW(v));
        if (C) col.push(C.getX(v), C.getY(v), C.getZ(v)); if (OW) ow.push(OW.getX(v)); if (clip) cl.push(clip(src.meta[v])); meta.push(src.meta[v]);
      }
      idx.push(map[v]);
    }
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  o.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); o.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); o.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  if (C) o.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (OW) o.setAttribute('olw', new THREE.Float32BufferAttribute(ow, 1));
  if (clip) o.setAttribute('clp', new THREE.Float32BufferAttribute(cl, 1));
  o.setIndex(idx); return { geo: o, meta };
}

/* ---------- cuerpo base (una sola malla continua: torso + brazos + piernas) ---------- */
function torsoW(y, x, nkL = 0, sw = 0.28) {
  const h = 1 - smooth(clamp((y + 0.02) / 0.12, 0, 1)), c = smooth(clamp((y - 0.24) / 0.14, 0, 1));
  const nk = smooth(clamp((y - 0.575) / 0.06, 0, 1)), hd = smooth(clamp((y - 0.66 - nkL) / 0.05, 0, 1));
  let W = [[B_HIPS, h], [B_SPINE, (1 - h) * (1 - c)], [B_CHEST, c * (1 - nk)], [B_NECK, nk * (1 - hd)], [B_HEAD, nk * hd]];
  const t = smooth(clamp((-0.07 - y) / 0.09, 0, 1)) * smooth(clamp(Math.abs(x) / 0.07, 0, 1)) * 0.55;
  if (t > 0) { W = W.map(([i, w]) => [i, w * (1 - t)]); W.push([x > 0 ? B_TH[0] : B_TH[1], t]); }
  // hombro: la parte alta y lateral del torso sigue en parte al brazo (sin pliegue entre el deltoides y el trapecio)
  const sh = 0.42 * smooth(clamp((Math.abs(x) - sw * 0.5) / (sw * 0.4), 0, 1)) * smooth(clamp((y - 0.34) / 0.12, 0, 1)) * (1 - nk);
  if (sh > 0) { W = W.map(([i, w]) => [i, w * (1 - sh)]); W.push([x > 0 ? B_UA[0] : B_UA[1], sh]); }
  return W;
}
// busto femenino: elipse por lado (más ancha hacia la axila, pendiente larga arriba, pliegue definido abajo)
const BUST = { x: 0.082, y: 0.416, ro: 0.122, ri: 0.07, ru: 0.096, rl: 0.07, h: 0.054 };
function bustZ(x, y) {
  let bz = 0;
  for (const s of [-1, 1]) {
    const dx = x - s * BUST.x, dy = y - BUST.y, d = (dx / (dx * s > 0 ? BUST.ro : BUST.ri)) ** 2 + (dy / (dy > 0 ? BUST.ru : BUST.rl)) ** 2;
    if (d < 1) bz = Math.max(bz, lerp(Math.pow(1 - d, 0.5), Math.pow(1 - d, 1.2) * (1 + 1.2 * d), smooth(clamp((dy + 0.03) / 0.04, 0, 1))));
  }
  return bz;
}
// sombra pintada del busto (en reposo, espacio del cuerpo): pliegue bajo cada pecho y, en la piel, el escote
const BUST_GLSL = `varying vec3 vRest; uniform float uSp, uBust;
float bustSh(float cl) {
  if (vRest.z < 0.0 || uBust <= 0.0) return 0.0;
  float x = vRest.x, y = vRest.y - uSp, sh = 0.0;
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? -1.0 : 1.0, dx = x - s * ${BUST.x}, dy = y - ${BUST.y};
    float d = length(vec2(dx / (dx * s > 0.0 ? ${BUST.ro} : ${BUST.ri}), dy / (dy > 0.0 ? ${BUST.ru} : ${BUST.rl})));
    sh = max(sh, smoothstep(0.78, 0.97, d) * (1.0 - smoothstep(1.0, 1.24, d)) * (1.0 - smoothstep(-0.035, 0.0, dy)));
    sh = max(sh, cl * 0.8 * smoothstep(0.56, 0.7, d) * (1.0 - smoothstep(0.72, 0.84, d)) * smoothstep(0.004, 0.026, dy) * (1.0 - smoothstep(0.1, 0.85, (dx * s) / ${BUST.ro})));
  }
  float x1 = x / 0.009, x2 = x / 0.026, c = (0.85 * exp(-x1 * x1) + 0.3 * exp(-x2 * x2)) * smoothstep(0.35, 0.39, y) * (1.0 - smoothstep(0.485, 0.525, y));
  return clamp(max(sh, cl * c), 0.0, 1.0) * uBust;
}
`;
function bustShade(sh, U, cl, col) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = 'varying vec3 vRest;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
  sh.fragmentShader = BUST_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb *= mix(vec3(1.0), vec3(${col.join(', ')}), bustSh(${cl.toFixed(1)}));`);
}
const _bsC = new Map();
function bustMat(base, sp, bust) {   // ropa: copia del material con el pliegue bajo el busto
  const k = base.uuid + sp + '|' + bust; if (_bsC.has(k)) return _bsC.get(k);
  const m = base.clone(), prev = base.onBeforeCompile, U = { uSp: { value: sp }, uBust: { value: bust } };
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); bustShade(sh, U, 0, [0.6, 0.56, 0.62]); };
  const pk = base.customProgramCacheKey(); m.customProgramCacheKey = () => pk + '|bust';
  _bsC.set(k, m); return m;
}
function buildBodySrc(fem, b, hipRest) {
  const GB = new GeoB(), ySp = hipRest + 0.06, { sw, chest, waist, hip } = b, bust = b.bust ?? 1, nkL = b.neck ?? 0;
  const K = fem ? [
    [-0.175, 0.02, 1, 1, 0], [-0.16, hip * 0.62, 0.8, 0.8, 0], [-0.12, hip * 1.0, 0.6, 0.72, 0], [-0.06, hip * 1.14, 0.58, 0.74, 0], [0.02, hip * 1.04, 0.6, 0.66, 0],
    [0.1, waist * 1.05, 0.72, 0.7, 0], [0.17, waist, 0.74, 0.7, 0], [0.25, waist * 1.08, 0.74, 0.68, 0], [0.33, chest * 0.9, 0.7, 0.64, 0], [0.4, chest * 0.95, 0.64, 0.6, 0],
    [0.46, chest, 0.58, 0.56, 0], [0.51, sw * 0.98, 0.5, 0.52, 0], [0.545, sw, 0.47, 0.5, -0.002], [0.575, sw * 0.95, 0.45, 0.48, -0.003], [0.598, sw * 0.86, 0.44, 0.48, -0.004], [0.612, sw * 0.74, 0.45, 0.5, -0.005],
    [0.622, sw * 0.58, 0.5, 0.55, -0.006], [0.629, sw * 0.42, 0.62, 0.68, -0.007], [0.636, 0.068, 0.92, 0.98, -0.008], [0.655 + nkL / 2, 0.056, 0.95, 1, -0.01], [0.68 + nkL, 0.056, 0.95, 1.05, -0.012], [0.72 + nkL, 0.06, 0.92, 1.05, -0.014], [0.755 + nkL, 0.045, 1, 1, -0.015], [0.77 + nkL, 0.002, 1, 1, -0.015]]
    : [
    [-0.175, 0.02, 1, 1, 0], [-0.16, hip * 0.6, 0.8, 0.8, 0], [-0.12, hip * 0.96, 0.62, 0.68, 0], [-0.06, hip * 1.08, 0.6, 0.7, 0], [0.02, hip * 1.03, 0.6, 0.64, 0],
    [0.1, waist, 0.7, 0.66, 0], [0.18, waist * 1.04, 0.72, 0.64, 0], [0.27, waist * 1.14, 0.7, 0.62, 0], [0.35, chest * 0.97, 0.66, 0.6, 0.004], [0.42, chest, 0.64, 0.6, 0.006],
    [0.47, sw * 0.88, 0.6, 0.56, 0.004], [0.51, sw * 0.9, 0.5, 0.52, 0], [0.545, sw * 0.76, 0.44, 0.5, -0.004], [0.575, sw * 0.54, 0.48, 0.56, -0.007], [0.6, sw * 0.34, 0.6, 0.66, -0.008],
    [0.615, 0.066, 0.95, 1, -0.008], [0.655 + nkL / 2, 0.058, 0.95, 1, -0.01], [0.7 + nkL, 0.059, 0.95, 1.05, -0.012], [0.74 + nkL, 0.062, 0.92, 1.05, -0.014], [0.765 + nkL, 0.035, 1, 1, -0.015], [0.775 + nkL, 0.002, 1, 1, -0.015]];
  const rows = crRows(K, fem ? 0.011 : 0.016).map(r => { r[1] = Math.max(r[1], 0.0005); return r; });
  const pw = 2 / 2.3;
  const feat = (x, y, ca) => {
    let z = 0;
    if (ca > 0 && fem) z += BUST.h * bust * bustZ(x, y);
    else if (ca > 0) for (const s of [-1, 1]) z += 0.03 * Math.exp(-((x - s * 0.074) ** 2) / 0.0036 - ((y - 0.435) ** 2) / (y > 0.435 ? 0.004 : 0.0007)) - 0.006 * Math.exp(-(x * x) / 0.0004 - ((y - 0.43) ** 2) / 0.004);
    else for (const s of [-1, 1]) z -= (fem ? 0.032 : 0.02) * Math.exp(-((x - s * 0.068) ** 2) / 0.0045 - ((y + 0.065) ** 2) / 0.004);
    return z;
  };
  const NT = fem ? 64 : 40;
  GB.grid(rows.length, NT, (i, j) => {
    const [y, w, kf, kb, zo] = rows[i]; const a = Math.PI + j / NT * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a);
    const x = w * Math.sign(sa) * Math.pow(Math.abs(sa), pw);
    const z = w * (ca > 0 ? kf : kb) * Math.sign(ca) * Math.pow(Math.abs(ca), pw) + feat(x, y, ca) * Math.min(1, w / 0.08) + zo;
    GB.vert(x, ySp + y, z, j / NT, (y + 0.2) / 0.95, torsoW(y, x, nkL, sw), { part: 0, s: y, a: wrapA(a), x, w });
  });
  const torsoAt = y => { let i = 0; while (i < rows.length - 2 && rows[i + 1][0] < y) i++; const A = rows[i], B2 = rows[i + 1], t = clamp((y - A[0]) / (B2[0] - A[0] || 1), 0, 1); return A.map((v, k) => lerp(v, B2[k], t)); };
  const frontZ = y => { const [, w, kf, , zo] = torsoAt(y); return w * kf + feat(0, y, 1) + zo; };
  const backZ = y => { const [, w, , kb, zo] = torsoAt(y); return w * kb - feat(0, y, -1) - zo; };
  // brazos: el tubo sigue sin cortes por la muñeca hasta la palma (que se aplana); los dedos son tubos con 3 falanges
  const cH = fem ? 0.044 : 0.054, armK = [[cH, 0.003], [cH * 0.9, 0.03], [cH * 0.7, 0.048], [cH * 0.4, 0.06], [0, 0.066], [-0.06, 0.064], [-0.12, 0.058], [-0.2, 0.052], [-0.27, 0.045], [-0.31, 0.041], [-0.35, 0.043], [-0.41, 0.05], [-0.48, 0.045], [-0.56, 0.037], [-0.615, 0.031], [-0.645, 0.03], [-0.675, 0.035], [-0.71, 0.037], [-0.733, 0.036], [-0.746, 0.03], [-0.754, 0.018], [-0.758, 0.003]];
  const aRows = crRows(armK.slice().reverse(), 0.01), ak = b.arm ?? 1, fk = fem ? 0.86 : 1;
  const hs = fk, hand = [];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1, Sx = side * sw * (b.shX ?? 0.95), Sy = ySp + 0.5 + (b.shY ?? 0);
    GB.grid(aRows.length, 22, (r, j) => {
      const [s0, r0] = aRows[r]; const s = s0 < -0.62 ? -0.62 + (s0 + 0.62) * hs : s0;
      const a = Math.PI + j / 22 * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a);
      const mus = fem ? -0.1 * gauss(s, -0.03, 0.06) - 0.04 * gauss(s, -0.17, 0.07) : 0.11 * gauss(s, -0.05, 0.05) * (0.6 + 0.4 * Math.max(0, side * sa)) + 0.09 * gauss(s, -0.2, 0.05) * Math.max(0, ca);   // deltoides (más afuera) y bíceps (adelante)
      const rad = Math.max(0.0005, r0 * fk * (1 + mus + (ak - 1) * (gauss(s, -0.1, 0.09) + 0.7 * gauss(s, -0.43, 0.06))));
      const k = smooth(clamp((-0.6 - s0) / 0.07, 0, 1)), fx = lerp(1, 0.45, k), fz = lerp(0.92, 1.13, k);
      const th = 0.007 * fk * gauss(s0, -0.69, 0.022) * Math.max(0, ca) * Math.max(0, -side * sa);   // eminencia tenar (base del pulgar)
      const x = Sx + side * (fem ? 0.004 : 0.01) * gauss(s, -0.01, 0.05) + sa * rad * fx - side * th, z = 0.006 * gauss(s, -0.14, 0.05) + ca * rad * fz + th * 0.4;
      const u = 1 - 0.45 * smooth(clamp((s + 0.01) / 0.06, 0, 1)), f = smooth(clamp((-0.29 - s) / 0.08, 0, 1)), h = smooth(clamp((-0.622 - s0) / 0.04, 0, 1)), tw = clamp((-0.36 - s0) / 0.25, 0, 1);
      GB.vert(x, Sy + s, z, j / 22, s, [[B_CHEST, 1 - u], [B_UA[i], u * (1 - f)], [B_FA[i], u * f * (1 - h) * (1 - tw)], [B_FTW[i], u * f * (1 - h) * tw], [B_HAND[i], h]], { part: 1 + i, s, a: wrapA(a) });
    });
    // dedos (índice, medio, anular, meñique) + pulgar. Posiciones de reposo: mano colgando, palma hacia el muslo
    const W = V(Sx, Sy - L_UP - L_FO, 0), fingers = [];
    const FD = [[0.028, -0.097, [0.043, 0.027, 0.022], 0.0088, 0.06], [0.0095, -0.1, [0.047, 0.03, 0.023], 0.009, 0.01], [-0.009, -0.098, [0.044, 0.028, 0.022], 0.0085, -0.04], [-0.026, -0.09, [0.035, 0.022, 0.02], 0.0077, -0.09]];
    const TH = { base: V(-side * 0.006, -0.024, 0.021), dir: V(-side * 0.18, -0.82, 0.55).normalize(), L: [0.036, 0.031, 0.027], r: 0.011 };
    const fL = fem ? 1.07 : 1, fR = fem ? 0.9 : 1, tips = [];
    const list = FD.map(([z, y, L, r, spread]) => ({ base: V(side * 0.002, y, z), dir: V(0, -1, spread).normalize(), L: L.map(l => l * fL), r: r * fR }));
    TH.L = TH.L.map(l => l * fL); TH.r *= fR;
    list.push(TH);
    list.forEach((F, k) => {
      const base = F.base.clone().multiplyScalar(hs).add(W), L = F.L.map(l => l * hs), r = F.r * hs, tot = L[0] + L[1] + L[2];
      const bi = B_HAND[i] + 1 + k * 3, jn = [0, L[0], L[0] + L[1]];
      fingers.push(jn.map(d => base.clone().addScaledVector(F.dir, d)));
      const nb = (k < 4 ? V(side, 0, 0) : V(side * 0.6, 0, 0.8)); nb.addScaledVector(F.dir, -nb.dot(F.dir)).normalize();   // dorso de la uña
      tips.push({ p: base.clone().addScaledVector(F.dir, tot - L[2] * 0.36).addScaledVector(nb, r * 0.6), d: F.dir.clone(), n: nb, r, l: L[2] });
      const ref = Math.abs(F.dir.x) > 0.9 ? V(0, 1, 0) : V(1, 0, 0), e1 = V().crossVectors(F.dir, ref).normalize(), e2 = V().crossVectors(F.dir, e1);
      const start = k < 4 ? -0.012 * hs : -0.018 * hs, n = 16;
      GB.grid(n + 1, 10, (rr2, j) => {
        const t = rr2 / n, d = lerp(start, tot, Math.pow(t, 0.9)), a = j / 10 * Math.PI * 2;
        let rad = r * (1 - (fem ? 0.3 : 0.22) * clamp(d / tot, 0, 1)) * (1 + 0.07 * (gauss(d, L[0], 0.004) + gauss(d, L[0] + L[1], 0.004)));
        const tip = tot - rad; if (d > tip) rad *= Math.sqrt(Math.max(0, 1 - ((d - tip) / rad) ** 2)); rad = Math.max(rad, 0.0003);
        const p = base.clone().addScaledVector(F.dir, d).addScaledVector(e1, Math.cos(a) * rad * 0.84).addScaledVector(e2, Math.sin(a) * rad);
        const w1 = smooth(clamp((d + 0.004) / 0.01, 0, 1)), w2 = smooth(clamp((d - L[0] + 0.004) / 0.008, 0, 1)), w3 = smooth(clamp((d - L[0] - L[1] + 0.004) / 0.008, 0, 1));
        GB.vert(p.x, p.y, p.z, j / 10, t, [[B_HAND[i], 1 - w1], [bi, w1 * (1 - w2)], [bi + 1, w2 * (1 - w3)], [bi + 2, w3]], { part: 5 + i, s: -0.75, k, t: clamp(d / tot, 0, 1), a: 0 });
      });
    });
    hand.push({ wrist: W, fingers, tips });
  }
  // piernas
  const legK = [[0.11, 0.003], [0.1, 0.035], [0.085, 0.06], [0.05, 0.08], [0, 0.09], [-0.08, 0.087], [-0.2, 0.078], [-0.32, 0.067], [-0.43, 0.058], [-0.5, 0.054], [-0.57, 0.056], [-0.65, 0.059], [-0.75, 0.051], [-0.85, 0.041], [-0.93, 0.035], [-0.965, 0.034], [-0.982, 0.026], [-0.992, 0.003]];
  const lRows = crRows(legK.slice().reverse(), 0.016);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1, Jx = side * hip * 0.56, Jy = hipRest - 0.02;
    GB.grid(lRows.length, 24, (r, j) => {
      const [s, r0] = lRows[r]; const rad = Math.max(0.0005, r0 * (fem ? lerp(1.0, 0.88, smooth(clamp((-s - 0.25) / 0.35, 0, 1))) : 1));
      const a = Math.PI + j / 24 * Math.PI * 2;
      const x = Jx + Math.sin(a) * rad, z = -0.012 * gauss(s, -0.64, 0.07) * (Math.cos(a) < 0 ? 1 : 0.3) + 0.005 * gauss(s, -0.5, 0.03) * Math.max(0, Math.cos(a)) + Math.cos(a) * rad * 0.97;
      const u = smooth(clamp((0.07 - s) / 0.14, 0, 1)), f = smooth(clamp((-0.46 - s) / 0.08, 0, 1));
      GB.vert(x, Jy + s, z, j / 24, s, [[B_HIPS, 1 - u], [B_TH[i], u * (1 - f)], [B_SH[i], u * f]], { part: 3 + i, s, a: wrapA(a) });
    });
  }
  const out = GB.build();
  // grosor del contorno por vértice: más fino en manos y dedos
  out.geo.setAttribute('olw', new THREE.Float32BufferAttribute(out.meta.map(m => m.part >= 5 ? 0.38 : (m.part === 1 || m.part === 2) ? lerp(1, 0.5, smooth(clamp((-0.6 - m.s) / 0.06, 0, 1))) * (fem ? lerp(1, 0.25, smooth(clamp((m.s + 0.07) / 0.09, 0, 1))) : 1) : 1), 1));   // en la mujer el contorno del brazo se apaga al entrar al hombro (sin costura)
  // punto de la superficie del torso a la altura y y el ángulo a (misma forma que la malla)
  const surfAt = (y, a) => { const [, w, kf, kb, zo] = torsoAt(y), sa = Math.sin(a), ca = Math.cos(a), x = w * Math.sign(sa) * Math.pow(Math.abs(sa), pw); return [x, w * (ca > 0 ? kf : kb) * Math.sign(ca) * Math.pow(Math.abs(ca), pw) + feat(x, y, ca) * Math.min(1, w / 0.08) + zo]; };
  return { ...out, torsoAt, frontZ, backZ, surfAt, hand };
}

/* ---------- cabeza esculpida (nariz, labios, pómulos, mandíbula móvil) ---------- */
const FACE_UV = { X: 0.085, Y0: -0.135, Y1: 0.075 };   // zona de la cara que cubre la textura pintada
const HAIRLINE = [[0, 0.62], [0.5, 0.55], [0.9, 0.4], [1.18, 0.12], [1.36, -0.12], [1.48, 0.18], [1.8, 0.1], [2.2, -0.32], [Math.PI, -0.58]];
function hairlineAt(ph, tbl = HAIRLINE) { for (let i = 0; i < tbl.length - 1; i++) if (ph <= tbl[i + 1][0]) { const t = (ph - tbl[i][0]) / (tbl[i + 1][0] - tbl[i][0]); return lerp(tbl[i][1], tbl[i + 1][1], smooth(t)); } return tbl[tbl.length - 1][1]; }
/* interpolación Catmull-Rom de una tabla [[x, y], ...] (x creciente) */
function crTab(T, x) {
  if (x <= T[0][0]) return T[0][1]; const m = T.length; if (x >= T[m - 1][0]) return T[m - 1][1];
  let i = 0; while (T[i + 1][0] < x) i++;
  const P0 = T[Math.max(0, i - 1)][1], P1 = T[i][1], P2 = T[i + 1][1], P3 = T[Math.min(m - 1, i + 2)][1], t = (x - T[i][0]) / (T[i + 1][0] - T[i][0]);
  return 0.5 * (2 * P1 + (-P0 + P2) * t + (2 * P0 - 5 * P1 + 4 * P2 - P3) * t * t + (-P0 + 3 * P1 - 3 * P2 + P3) * t * t * t);
}
/* contorno de la cara bajo los pómulos (t = 0 a la altura de los ojos, 1 = punta del mentón): mujer en "V" estilizada, hombre más cuadrado */
const JAW_F = [[0, 1], [0.14, 0.995], [0.28, 0.94], [0.42, 0.83], [0.56, 0.68], [0.7, 0.52], [0.82, 0.385], [0.91, 0.27], [0.97, 0.16], [1, 0]];
const JAW_M = [[0, 1], [0.14, 1.0], [0.28, 0.975], [0.42, 0.93], [0.56, 0.87], [0.7, 0.8], [0.82, 0.69], [0.91, 0.5], [0.97, 0.25], [1, 0]];
const CHIN_F = [[0, 1], [0.25, 0.99], [0.5, 0.955], [0.7, 0.9], [0.85, 0.83], [0.94, 0.68], [1, 0]];   // profundidad del frente (mentón adelantado)
const CHIN_M = [[0, 1], [0.25, 0.99], [0.5, 0.94], [0.7, 0.86], [0.85, 0.76], [0.94, 0.58], [1, 0]];
function buildHeadSrc(fem, F, look, off) {
  const GB = new GeoB(), R0 = 0.13, lowK = (fem ? 0.93 : 0.96) * (F.faceLong ?? 1), wK = (fem ? 0.84 : 0.88) * (F.faceW ?? 1);
  const mw = 0.027 * F.mouthW, vm = fem ? -0.066 : -0.064, eyeX = (fem ? 0.047 : 0.044) * F.eyeGap, eyeY = 0.014, er = 0.0215 * F.eyeSize;
  const nl = F.nose, nwd = F.noseW, tY = -0.036 - 0.004 * nl;
  const jk = clamp((F.jaw - 0.25) / 0.75, -0.2, 1.3);
  const Yof = ny => ny * R0 * 1.12 * (ny < 0 ? lowK : 1);
  const base = (nx, ny, nz) => {
    const Y = Yof(ny), rr = Math.sqrt(Math.max(1e-8, 1 - ny * ny)), ux = nx / rr, uz = nz / rr;
    // anchura y profundidad del contorno a esta altura
    let W = R0 * wK * rr * (1 + 0.035 * Math.max(ny, 0)), D = R0 * rr;
    if (ny < 0) {
      const t = -ny; W = R0 * wK * lerp(crTab(JAW_F, t), crTab(JAW_M, t), jk) * (1 + 0.035 * (F.cheek - 0.7) * gauss(t, 0.2, 0.1));
      D = R0 * lerp(crTab(CHIN_F, t), crTab(CHIN_M, t), jk) * (1 + 0.05 * (F.chin - 0.8) * gauss(t, 0.85, 0.08));
    }
    // sección: frente más plano (superelipse) y nuca redonda
    let X, Z;
    if (uz > 0) { const e = fem ? 0.86 : 0.8; X = Math.sign(ux) * Math.pow(Math.abs(ux), e) * W; Z = Math.pow(uz, e) * D; }
    else { X = ux * lerp(W, R0 * wK * rr, smooth(clamp(-uz / 0.6, 0, 1))); Z = uz * R0 * rr * 1.07 * (1 - 0.32 * smooth(clamp((-0.2 - ny) / 0.8, 0, 1))); }   // nuca redonda
    const ax = Math.abs(nx), sx = Math.sign(nx);
    if (nz > -0.2) X -= sx * 0.004 * Math.exp(-((ax - 0.85) ** 2 + (ny - 0.35) ** 2) / 0.03);   // sienes
    return [X, Y, Z];
  };
  const front = (X, Y, sock) => {
    const ax = Math.abs(X); let d = 0;
    d += 0.004 * F.browRidge * g2(ax, Y, 0.035, 0.05, 0.03, 0.01);
    if (sock) d -= 0.0032 * g2(ax, Y, eyeX, eyeY + 0.004, 0.02, 0.014);
    d += 0.003 * F.cheek * g2(ax, Y, 0.062, -0.028, 0.02, 0.016);   // pómulo
    const along = clamp((0.03 - Y) / (0.03 - tY), 0, 1), wY = smooth(clamp((0.042 - Y) / 0.014, 0, 1)) * smooth(clamp((Y - (tY - 0.012)) / 0.006, 0, 1));
    d += wY * (0.003 + 0.013 * along * along * nl) * Math.exp(-(X * X) / (2 * (0.005 + 0.0035 * along * nwd) ** 2));
    d += 0.01 * nl * g2(X, Y, 0, tY - 0.002, 0.0085 * nwd, 0.0072);
    d += 0.0068 * g2(ax, Y, 0.0108 * nwd, tY - 0.004, 0.006, 0.0055);
    d -= 0.004 * g2(X, Y, 0, tY - 0.012, 0.011, 0.003);
    const cw = smooth(clamp((mw - ax) / 0.006, 0, 1));
    d += 0.0026 * F.lips * g2(X, Y, 0, vm + 0.0045, mw * 0.75, 0.0035) * cw + 0.0048 * F.lips * g2(X, Y, 0, vm - 0.006, mw * 0.65, 0.0045) * cw;
    d -= 0.0028 * g2(X, Y, 0, vm - 0.018, 0.015, 0.004);
    d += 0.005 * F.chin * g2(X, Y, 0, vm - 0.05, 0.016, 0.012);
    d -= 0.0018 * g2(ax, Y, 0.034, vm + 0.012, 0.006, 0.014);   // surco nasolabial suave
    return d;
  };
  const fmask = nz => smooth(clamp((nz - 0.25) / 0.35, 0, 1));
  const thM = Math.acos(clamp(vm / (R0 * 1.12 * lowK), -1, 1));
  const th = warpList(116, 0.003, Math.PI - 0.003, t => 1 + 2.4 * Math.exp(-((t - 1.75) ** 2) / (2 * 0.34 * 0.34))).filter(t => Math.abs(t - thM) > 0.008);
  // filas del interior de la boca: [desfase, apertura, color] (1 labio, 2 dientes, 3 interior, 5 lengua, 4 labio)
  const band = [[-0.0065, 0, 1], [-0.0042, 0, 2], [-0.0018, 0.14, 2], [-0.0002, 0.18, 3], [0.0016, 0.62, 3], [0.0034, 0.82, 5], [0.005, 0.94, 3], [0.0066, 1, 4]];
  const rowsT = th.map(t => ({ t, b: null })).concat(band.map(([dd, w, k]) => ({ t: thM + dd, b: [w, k] }))).sort((p, q) => q.t - p.t);
  const cols = 96, phis = warpList(cols + 1, 0, 1, u => { const fa = wrapA(Math.PI + u * Math.PI * 2); return 1 + 2.2 * Math.exp(-(fa * fa) / (2 * 0.6 * 0.6)); });
  const C = h => new THREE.Color(h);
  const cSkin = C(look.skin), cLip = C(F.lipColor ?? 0xb0505a), cTeeth = C(0xf1ebe2), cDark = C(0x2a070c), cTongue = C(0x9a3a45);
  const lipC = cSkin.clone().lerp(cLip, fem ? 1 : 0.4);
  // atributos de la cara pintada: fuv = proyección frontal (X,Y) → textura; ffw = cuánto es "cara"; fovr = color forzado (dientes / interior de la boca)
  const FUV = [], FOVR = [], FFW = [];
  GB.grid(rowsT.length, cols, (r, j) => {
    const T = rowsT[r], θ = T.t, u = phis[j], φ = Math.PI + u * Math.PI * 2;
    const nx = Math.sin(θ) * Math.sin(φ), ny = Math.cos(θ), nz = Math.sin(θ) * Math.cos(φ);
    let [X, Y, Z] = base(nx, ny, nz); const fm = fmask(nz); Z += fm * front(X, Y, true);
    const ax = Math.abs(X);
    const mo = smooth(clamp((mw + 0.002 - ax) / 0.007, 0, 1)) * fm;
    const ramp = smooth(clamp((vm + 0.006 - Y) / 0.03, 0, 1)), bw = T.b ? T.b[0] : (θ > thM ? 1 : 0);
    const jm = smooth(clamp((nz + 0.15) / 0.55, 0, 1)) * (ny > -0.93 ? 1 : 0.5);
    const ov = Math.pow(Math.max(0, 1 - (ax / (mw * 1.02)) ** 2), 0.6);   // apertura ovalada: las comisuras quedan juntas
    const jw = jm * lerp(ramp, bw, mo * ov);
    FUV.push((X + FACE_UV.X) / (2 * FACE_UV.X), (Y - FACE_UV.Y0) / (FACE_UV.Y1 - FACE_UV.Y0));
    FFW.push(smooth(clamp((nz - 0.02) / 0.3, 0, 1)));
    if (T.b) { const k = T.b[1], c = k === 2 ? cTeeth : k === 3 ? cDark : k === 5 ? cTongue : lipC; FOVR.push(c.r, c.g, c.b, mo); } else FOVR.push(0, 0, 0, 0);
    GB.vert(X + off.x, Y + off.y, Z + off.z, u * 4, 1 - θ / Math.PI, [[B_HEAD, 1 - jw], [B_JAW, jw]], { nx, ny, nz, X, Y, Z, ph: Math.abs(wrapA(φ)), jw });
  });
  const out = GB.build();
  out.geo.setAttribute('fuv', new THREE.Float32BufferAttribute(FUV, 2));
  out.geo.setAttribute('ffw', new THREE.Float32BufferAttribute(FFW, 1));
  out.geo.setAttribute('fovr', new THREE.Float32BufferAttribute(FOVR, 4));
  // contorno: fino en el frente de la cara (evita que asome en los pliegues de labios y nariz), normal en la silueta
  out.geo.setAttribute('olw', new THREE.Float32BufferAttribute(out.meta.map(m => lerp(1, 0.12, smooth(clamp((m.nz - 0.5) / 0.3, 0, 1)))), 1));
  const lf = 0.7 + 0.3 * F.lips;
  // contorno inferior de la mandíbula (vista frontal) para la sombra sobre el cuello
  const jaw = new Array(13).fill(0); for (const m of out.meta) if (m.nz > 0.05) { const b = Math.round(Math.abs(m.X) / 0.01); if (b < 13) jaw[b] = Math.min(jaw[b], m.Y); }
  for (let b = 1; b < 13; b++) if (jaw[b] === 0) jaw[b] = jaw[b - 1];
  // Z de la superficie frontal en (X, Y): sirve para pegar el flequillo y accesorios a la cara
  const frontZ = (X, Y) => {
    const ny = clamp(Y >= 0 ? Y / (R0 * 1.12) : Y / (R0 * 1.12 * lowK), -0.999, 0.999), rr = Math.sqrt(1 - ny * ny);
    const W = base(rr, ny, 0)[0], ux = Math.min(0.999, Math.pow(Math.min(1, Math.abs(X) / W), 1 / 0.8)), uz = Math.sqrt(1 - ux * ux);
    const p = base(Math.sign(X) * ux * rr, ny, uz * rr); return p[2] + fmask(uz * rr) * front(X, Y, true);
  };
  const contour = Y => { const ny = Y >= 0 ? Y / (R0 * 1.12) : Y / (R0 * 1.12 * lowK); const n = clamp(ny, -0.999, 0.999); return base(Math.sqrt(1 - n * n), n, 0)[0]; };   // media anchura de la cara a la altura Y
  return { ...out, eye: { x: eyeX, y: eyeY, hw: er }, mw, vm, tY, nwd, lf, jaw, contour, frontZ };
}

/* ---------- cara pintada: textura estática (piel, labios, rubor, maquillaje) + ojos y cejas animados en el shader ---------- */
const beardLine = (hs, ax) => (ax < 0.032 ? lerp(hs.tY - 0.008, hs.vm + 0.012, smooth(ax / 0.032)) : lerp(hs.vm + 0.012, 0.006, smooth((ax - 0.032) / 0.055)));
function paintFaceTex(fem, F, look, hs) {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  const { X: FX, Y0, Y1 } = FACE_UV, kx = S / (2 * FX), ky = S / (Y1 - Y0);
  const px = x => (x + FX) * kx, py = y => (Y1 - y) * ky;
  const C3 = c => c.isColor ? c : new THREE.Color(c);
  const col = (c, a = 1) => { const k = C3(c).clone().convertLinearToSRGB(); return 'rgba(' + Math.round(k.r * 255) + ',' + Math.round(k.g * 255) + ',' + Math.round(k.b * 255) + ',' + a + ')'; };
  const mixC = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k), WHITE = 0xffffff;
  const shadeSk = k => mixC(look.skin, 0x6a1e18, k);   // sombra cálida de la piel
  const blob = (x, y, rx, ry, c, a, rot = 0) => { g.save(); g.translate(px(x), py(y)); g.rotate(rot); g.scale(rx * kx, ry * ky); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, col(c, a)); gr.addColorStop(1, col(c, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore(); };
  g.fillStyle = col(look.skin); g.fillRect(0, 0, S, S);
  // pinceladas sutiles (aspecto pintado a mano)
  const rnd = rng(look.skin & 0xffff);
  for (let i = 0; i < 1400; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,242,228,0.035)' : 'rgba(130,55,35,0.028)'; g.beginPath(); g.ellipse(rnd() * S, rnd() * S, 8 + rnd() * 26, 3 + rnd() * 7, rnd() * 3, 0, 7); g.fill(); }
  const E = hs.eye, hw = E.hw, s2 = [-1, 1], hU = hw * (fem ? 0.66 : 0.56) * (F.eyeOpen ?? 1), hL = hw * (fem ? 0.38 : 0.33) * (F.lowLid ?? 1);
  const mk = F.makeup ?? (fem ? 0.6 : F.shadow ? 0.5 : 0), sc = F.shadow ?? 0xc07a90, dk = mixC(sc, 0x1a0820, 0.45);
  for (const s of s2) {
    blob(s * (E.x + 0.003), E.y + hw * 1.0, hw * 1.4, 0.009, shadeSk(0.5), 0.14);                 // cuenca bajo la ceja
    if (mk > 0) {   // maquillaje: sombra en degradado (también cubre el párpado al cerrar el ojo), V exterior oscura, luces
      blob(s * (E.x + hw * 0.1), E.y + hU * 0.45, hw * 1.3, hU * 1.25, sc, 0.5 * mk);
      blob(s * (E.x + hw * 0.25), E.y + hU * 0.5, hw * 1.0, hU * 0.8, sc, 0.3 * mk);
      blob(s * (E.x + hw * 0.85), E.y + hU * 0.55, hw * 0.65, hU * 0.95, dk, 0.5 * mk, s * 0.5);
      blob(s * (E.x + hw * 0.95), E.y + hU * 0.65, hw * 0.35, hU * 0.4, dk, 0.3 * mk, s * 0.6);   // ahumado hacia la cola del delineado
      blob(s * (E.x + hw * 0.2), E.y + hU * 1.45, hw * 1.25, hU * 0.45, sc, 0.2 * mk);
      blob(s * (E.x + hw * 0.55), E.y - hL * 1.25, hw * 0.65, hL * 0.35, dk, 0.32 * mk);
      blob(s * (E.x - hw * 1.0), E.y + hU * 0.05, hw * 0.18, hU * 0.25, WHITE, 0.5 * mk);
      blob(s * (E.x - hw * 0.1), E.y + hU * 0.85, hw * 0.35, hU * 0.25, WHITE, 0.16 * mk);
      blob(s * (E.x + hw * 0.3), E.y + hU + 0.011, hw * 0.9, 0.0025, WHITE, 0.14 * mk);
      blob(s * 0.05, -0.012, 0.016, 0.004, WHITE, 0.12 * mk, -s * 0.3);
    }
    blob(s * E.x, E.y - hw * 0.6, hw * 0.9, 0.0035, 0xd08080, fem ? 0.16 : 0.1);                // bajo el ojo
    blob(s * 0.052, -0.026, 0.026, 0.012, 0xff5f86, fem ? 0.28 + 0.1 * mk : 0.08, -s * 0.25);    // rubor
  }
  // estilos de maquillaje del editor
  const INKC = 0x120a14;
  if (F.guyliner) for (const s of s2) { blob(s * (E.x + hw * 0.1), E.y + hU * 0.2, hw * 1.35, hU * 1.1, INKC, 0.38); blob(s * (E.x + hw * 0.2), E.y - hL * 0.9, hw * 1.05, hL * 0.75, INKC, 0.55); }
  if (F.bags) for (const s of s2) { blob(s * (E.x + hw * 0.1), E.y - hL * 1.7, hw * 1.05, hL * 0.95, 0x5a2050, 0.32); blob(s * (E.x + hw * 0.1), E.y - hL * 1.3, hw * 0.9, hL * 0.5, 0x3a1030, 0.25); }
  if (F.mkGoth) for (const s of s2) {   // delineado inferior corrido y lágrimas de rímel
    blob(s * (E.x + hw * 0.1), E.y - hL * 0.9, hw * 1.15, hL * 0.75, INKC, 0.65);
    g.strokeStyle = col(INKC, 0.8); g.lineCap = 'round';
    for (const [k, L] of [[0.15, 1], [0.6, 0.7]]) { g.lineWidth = 5 - k * 3; g.beginPath(); g.moveTo(px(s * (E.x + hw * k)), py(E.y - hL * 1.1)); g.quadraticCurveTo(px(s * (E.x + hw * k + 0.002)), py(E.y - hL * 2.4), px(s * (E.x + hw * k - 0.001)), py(E.y - hL * (2.4 + 2.2 * L))); g.stroke(); }
  }
  if (F.glitter) for (let i = 0; i < 320; i++) { const s = rnd() < 0.5 ? -1 : 1, x = s * (E.x + (rnd() - 0.35) * hw * 2.3), y = E.y + hU * (0.35 + rnd() * 1.3); g.fillStyle = rnd() < 0.55 ? 'rgba(255,255,255,0.9)' : col(mixC(sc, WHITE, 0.4), 0.95); g.beginPath(); g.arc(px(x), py(y), 1 + rnd() * 2.4, 0, 7); g.fill(); }
  if (F.star) {   // estrella pintada alrededor del ojo izquierdo
    const cx = px(E.x + hw * 0.1), cy = py(E.y + hU * 0.25), Ro = hw * 2.3 * kx, Ri = hw * 1.0 * kx;
    g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? Ri : Ro; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.05); } g.closePath();
    g.fillStyle = col(sc, 0.9); g.fill(); g.lineWidth = 5; g.strokeStyle = col(INKC, 0.85); g.stroke();
  }
  if (F.warpaint) {   // franja sobre los ojos + tres rayas en cada mejilla
    const yT = E.y + hU * 1.25, yB = E.y - hL * 1.7;
    g.fillStyle = col(sc, 0.93); g.beginPath();
    for (let k = 0; k <= 12; k++) { const x = lerp(-0.095, 0.095, k / 12); g.lineTo(px(x), py(yT + (k % 2 ? 0.003 : -0.002) - 0.006 * Math.exp(-(x * x) / 0.0006))); }
    for (let k = 12; k >= 0; k--) { const x = lerp(-0.095, 0.095, k / 12); g.lineTo(px(x), py(yB + (k % 2 ? -0.003 : 0.002) + 0.01 * Math.exp(-(x * x) / 0.0002))); }
    g.closePath(); g.fill();
    g.strokeStyle = col(sc, 0.93); g.lineCap = 'round'; g.lineWidth = 0.0045 * kx;
    for (const s of s2) for (let k = 0; k < 3; k++) { const x0 = s * (E.x - hw * 0.4 + k * hw * 0.55); g.beginPath(); g.moveTo(px(x0), py(yB - 0.004)); g.lineTo(px(x0 + s * 0.004), py(yB - 0.022 + k * 0.003)); g.stroke(); }
  }
  // nariz: lado en sombra, ala, punta con brillo, sombra inferior y fosas
  const tY = hs.tY, nw = hs.nwd;
  g.save(); g.filter = 'blur(5px)'; g.fillStyle = col(shadeSk(0.7), 0.42);   // cuña de sombra del lado oscuro de la nariz
  g.beginPath(); g.moveTo(px(-0.0035), py(E.y + 0.004)); g.lineTo(px(-0.0062 * nw), py(tY + 0.012)); g.lineTo(px(-0.0098 * nw), py(tY - 0.001)); g.lineTo(px(-0.0045 * nw), py(tY - 0.006)); g.lineTo(px(-0.0022), py(tY + 0.006)); g.closePath(); g.fill(); g.restore();
  blob(-0.0085 * nw, tY - 0.0015, 0.0046, 0.0055, shadeSk(0.75), 0.36);
  blob(0.0075 * nw, tY - 0.002, 0.004, 0.005, shadeSk(0.6), 0.14);
  blob(0, tY + 0.001, 0.0085, 0.0065, 0xff7a7a, fem ? 0.15 : 0.1);
  blob(0.0022, tY + 0.0035, 0.0032, 0.0042, WHITE, 0.2);
  g.strokeStyle = col(shadeSk(0.9), 0.5); g.lineWidth = 3; g.lineCap = 'round';   // trazo bajo la punta de la nariz
  g.beginPath(); g.moveTo(px(-0.0078 * nw), py(tY - 0.0055)); g.quadraticCurveTo(px(-0.003), py(tY - 0.0105), px(0.0035), py(tY - 0.0085)); g.stroke();
  blob(0, tY - 0.0098, 0.0092, 0.0026, shadeSk(0.85), 0.36);
  for (const s of s2) { g.fillStyle = col(shadeSk(0.95), 0.5); g.beginPath(); g.ellipse(px(s * 0.0052 * nw), py(tY - 0.0074), 0.0019 * kx, 0.0008 * ky, -s * 0.45, 0, 7); g.fill(); }
  // modelado pintado: sombra suave por dentro del contorno de la cara (más en el lado de la sombra) y bajo los pómulos
  for (let Y = 0.0; Y > -0.128; Y -= 0.004) {
    const W = hs.contour(Y), k = smooth(clamp(-Y / 0.04, 0, 1));
    for (const s of s2) blob(s * (W - 0.006), Y, 0.011, 0.007, shadeSk(0.7), (s < 0 ? 0.13 : 0.07) * k);
  }
  for (const s of s2) blob(s * 0.06, -0.05, 0.012, 0.016, shadeSk(0.6), s < 0 ? 0.1 : 0.05);
  blob(0, -0.118, 0.016, 0.006, 0xffffff, 0.08);   // luz en el mentón
  const vm = hs.vm, mw = hs.mw, lf = hs.lf;
  blob(0, (tY + vm) / 2 - 0.002, 0.0032, 0.008, shadeSk(0.45), 0.12);   // surco del labio superior
  // sombra de barba: sigue la forma de la barba (sin cortes rectos), borde difuso y vellos finos
  const bt = BEARD_LEG[look.beard?.type] ? 'full' : look.beard?.type, stub = bt === 'stubble' ? 0.4 : (bt === 'full' || bt === 'goatee') ? 0.2 : bt === 'mustache' ? 0.08 : 0;
  if (stub) {
    const bc = look.beard?.color ?? look.hair?.color ?? 0x2a1a10, top = x => beardLine(hs, Math.abs(x)) + 0.004;
    g.save(); g.filter = 'blur(7px)'; g.beginPath();
    for (let k = 0; k <= 48; k++) { const x = lerp(-0.1, 0.1, k / 48); g.lineTo(px(x), py(top(x))); }
    g.lineTo(px(0.1), py(-0.17)); g.lineTo(px(-0.1), py(-0.17)); g.closePath(); g.fillStyle = col(bc, stub); g.fill(); g.restore();
    g.strokeStyle = col(bc, Math.min(0.6, stub * 0.9)); g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i < 2600; i++) {
      const x = (rnd() - 0.5) * 0.19, y = -0.16 + rnd() * 0.17; if (y > top(x) - 0.003) continue;
      const a = Math.PI / 2 + Math.sign(x) * (0.2 + rnd() * 0.5), L = 2 + rnd() * 3;
      g.moveTo(px(x), py(y)); g.lineTo(px(x) + Math.cos(a) * L * Math.sign(x || 1), py(y) + Math.sin(a) * L);
    }
    g.stroke();
  }
  // labios: arco de cupido marcado, labio superior más oscuro, inferior carnoso con brillo
  const uh = (fem ? 0.0088 : 0.0066) * lf, lh = (fem ? 0.0118 : 0.0092) * lf, pk = 0.0066 * Math.min(1.2, mw / 0.025);
  const lipC = mixC(look.skin, F.lipColor ?? 0xb0505a, fem ? 1 : 0.35);
  const up = lipC.clone().multiplyScalar(0.8), upHi = lipC.clone().multiplyScalar(0.95), lo = lipC.clone().lerp(new THREE.Color(WHITE), 0.07), loDk = lipC.clone().multiplyScalar(0.7);
  blob(0, vm - lh - 0.0034, mw * 0.62, 0.0028, shadeSk(0.6), 0.22);   // sombra bajo el labio inferior
  g.beginPath(); g.moveTo(px(-mw), py(vm + 0.0005));
  g.bezierCurveTo(px(-mw * 0.72), py(vm + uh * 0.38), px(-pk * 1.55), py(vm + uh * 0.97), px(-pk), py(vm + uh));
  g.quadraticCurveTo(px(-pk * 0.45), py(vm + uh * 0.98), px(0), py(vm + uh * 0.74));
  g.quadraticCurveTo(px(pk * 0.45), py(vm + uh * 0.98), px(pk), py(vm + uh));
  g.bezierCurveTo(px(pk * 1.55), py(vm + uh * 0.97), px(mw * 0.72), py(vm + uh * 0.38), px(mw), py(vm + 0.0005));
  g.bezierCurveTo(px(mw * 0.5), py(vm - 0.0002), px(0.006), py(vm - 0.0004), px(0), py(vm - 0.0011));
  g.bezierCurveTo(px(-0.006), py(vm - 0.0004), px(-mw * 0.5), py(vm - 0.0002), px(-mw), py(vm + 0.0005)); g.closePath();
  let gr = g.createLinearGradient(0, py(vm + uh), 0, py(vm)); gr.addColorStop(0, col(upHi)); gr.addColorStop(1, col(up)); g.fillStyle = gr; g.fill();
  if (mk > 0) { g.strokeStyle = col(lipC.clone().multiplyScalar(0.55), 0.5 * Math.min(1, mk)); g.lineWidth = 2.2; g.stroke(); }   // perfilador
  g.beginPath(); g.moveTo(px(-mw * 0.95), py(vm + 0.0003));
  g.bezierCurveTo(px(-mw * 0.5), py(vm - 0.0005), px(-0.006), py(vm - 0.0007), px(0), py(vm - 0.0011));
  g.bezierCurveTo(px(0.006), py(vm - 0.0007), px(mw * 0.5), py(vm - 0.0005), px(mw * 0.95), py(vm + 0.0003));
  g.bezierCurveTo(px(mw * 0.85), py(vm - lh * 0.72), px(mw * 0.5), py(vm - lh * 1.06), px(0), py(vm - lh));
  g.bezierCurveTo(px(-mw * 0.5), py(vm - lh * 1.06), px(-mw * 0.85), py(vm - lh * 0.72), px(-mw * 0.95), py(vm + 0.0003)); g.closePath();
  gr = g.createLinearGradient(0, py(vm), 0, py(vm - lh)); gr.addColorStop(0, col(loDk)); gr.addColorStop(0.4, col(lo)); gr.addColorStop(1, col(lipC.clone().multiplyScalar(0.86))); g.fillStyle = gr; g.fill();
  if (mk > 0) { g.strokeStyle = col(lipC.clone().multiplyScalar(0.55), 0.45 * Math.min(1, mk)); g.lineWidth = 2.2; g.stroke(); }
  if (fem) {
    blob(0.0045, vm - lh * 0.46, mw * 0.33, lh * 0.17, WHITE, 0.75, -0.08); blob(-0.0065, vm - lh * 0.52, mw * 0.11, lh * 0.08, WHITE, 0.5);
    blob(pk * 0.95, vm + uh * 0.6, 0.0024, 0.0011, WHITE, 0.45); blob(-pk * 1.1, vm + uh * 0.55, 0.0016, 0.0008, WHITE, 0.3);
  }
  // boca entreabierta: hueco oscuro con el borde de los dientes
  const gap = fem ? 0.0009 : 0.0005, gw = mw * (fem ? 0.55 : 0.75);
  g.beginPath(); g.moveTo(px(-gw), py(vm - 0.0002)); g.quadraticCurveTo(px(0), py(vm + gap), px(gw), py(vm - 0.0002)); g.quadraticCurveTo(px(0), py(vm - gap * 1.2 - 0.0004), px(-gw), py(vm - 0.0002)); g.closePath();
  g.fillStyle = '#2a070b'; g.fill();
  g.strokeStyle = col(loDk.clone().multiplyScalar(0.5)); g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(px(-mw), py(vm + 0.0006)); g.bezierCurveTo(px(-mw * 0.5), py(vm - 0.0004), px(mw * 0.5), py(vm - 0.0004), px(mw), py(vm + 0.0006)); g.stroke();
  for (const s of s2) blob(s * mw * 1.02, vm + 0.0007, 0.0024, 0.0016, shadeSk(0.9), 0.55);
  if (F.corpse) {   // corpse paint: base blanca, ojos negros con picos y boca negra con colmillos hacia el mentón
    g.save(); g.translate(px(0), py(-0.03)); g.scale(0.086 * kx, 0.104 * ky); const wg = g.createRadialGradient(0, 0, 0, 0, 0, 1); wg.addColorStop(0, 'rgba(244,242,238,0.93)'); wg.addColorStop(0.8, 'rgba(244,242,238,0.93)'); wg.addColorStop(1, 'rgba(244,242,238,0)'); g.fillStyle = wg; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore();   // óvalo blanco que se funde antes del nacimiento del pelo
    blob(0, E.y - 0.03, 0.06, 0.05, 0x8a8a90, 0.12);
    g.fillStyle = col(INKC, 0.96);
    for (const s of s2) {
      const P = [[-1.2, 0.3], [-0.6, 1.6], [-0.25, 3.2], [0.15, 1.9], [0.75, 3.4], [1.0, 1.7], [1.55, 0.5], [1.15, -1.6], [0.55, -1.2], [0.2, -3.6], [-0.2, -1.4], [-0.9, -0.9]];
      g.beginPath(); P.forEach(([u, v], i) => { const x = px(s * (E.x + u * hw)), y = py(E.y + (v > 0 ? v * hU * 0.75 : v * hL * 1.1)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
    }
    blob(0, tY - 0.003, 0.009, 0.007, INKC, 0.9);
    const Mw = mw * 1.2; g.beginPath(); g.moveTo(px(-Mw), py(vm + uh * 1.3)); g.lineTo(px(Mw), py(vm + uh * 1.3));
    for (const [u, dy] of [[1, -0.012], [0.75, -0.04], [0.5, -0.016], [0.22, -0.05], [0, -0.018], [-0.22, -0.05], [-0.5, -0.016], [-0.75, -0.04], [-1, -0.012]]) g.lineTo(px(u * Mw), py(vm + dy));
    g.closePath(); g.fill();
  }
  if (F.scar) {   // cicatriz que cruza la ceja y baja por la mejilla
    const x0 = E.x + hw * 0.2, a = [x0 + 0.006, E.y + hU + 0.026], b = [x0 - 0.008, E.y - hL - 0.024];
    g.strokeStyle = col(mixC(look.skin, 0xffd0c8, 0.55), 0.95); g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(px(a[0]), py(a[1])); g.lineTo(px(b[0]), py(b[1])); g.stroke();
    g.strokeStyle = col(shadeSk(0.8), 0.6); g.lineWidth = 2.5;
    for (let k = 1; k < 6; k++) { const t2 = k / 6, x = lerp(a[0], b[0], t2), y = lerp(a[1], b[1], t2); g.beginPath(); g.moveTo(px(x - 0.0035), py(y - 0.0012)); g.lineTo(px(x + 0.0035), py(y + 0.0012)); g.stroke(); }
  }
  for (const tt of look.tattoos || []) if (tt.spot === 'mejilla' && TAT_DRAW[tt.design]) {   // tatuaje pequeño bajo el ojo
    const sz = 0.021 * kx; g.save(); g.translate(px(-(E.x + hw * 0.35)) - sz / 2, py(E.y - hL - 0.017) - sz / 2); g.scale(sz / 256, sz / 256); TAT_DRAW[tt.design](g, cssC(tt.color ?? 0x1a1420)); g.restore();
  }
  // maquillaje legendario: dibujo en la cara + máscara de brillo para el shader (r = zona que brilla, g = fase, b = variación)
  let glowTex = null;
  if (F.legMk) {
    const gc = document.createElement('canvas'); gc.width = gc.height = 512; const q = gc.getContext('2d'); q.fillStyle = '#000'; q.fillRect(0, 0, 512, 512);
    const qx = x => px(x) / 2, qy = y => py(y) / 2, hi = col(mixC(sc, WHITE, 0.55));
    const line = (pts, wC, wQ, cc = hi) => { for (const [ctx, X, Y, w, st] of [[g, px, py, wC, cc], [q, qx, qy, wQ, '#f00']]) { ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = st; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke(); } };
    const ell = (cx, cy, rx, ry, wC, wQ) => { for (const [ctx, X, Y, k, w, st] of [[g, px, py, 1, wC, hi], [q, qx, qy, 0.5, wQ, '#f00']]) { ctx.lineWidth = w; ctx.strokeStyle = st; ctx.beginPath(); ctx.ellipse(X(cx), Y(cy), rx * kx * k, ry * ky * k, 0, 0, 7); ctx.stroke(); } };
    if (F.legMk === 1) {   // calavera neón: cuencas oscuras + contorno de hueso que brilla
      g.save(); g.filter = 'blur(5px)'; g.fillStyle = col(INKC, 0.94);   // cuencas sólidas con borde difuso
      for (const s of s2) { g.beginPath(); g.ellipse(px(s * (E.x + hw * 0.1)), py(E.y + (hU - hL) * 0.3), hw * 1.7 * kx, (hU + hL) * 1.45 * ky, 0, 0, 7); g.fill(); }
      g.beginPath(); g.moveTo(px(-0.0075), py(tY + 0.004)); g.lineTo(px(0), py(tY - 0.0095)); g.lineTo(px(0.0075), py(tY + 0.004)); g.closePath(); g.fill(); g.restore();
      for (const s of s2) ell(s * (E.x + hw * 0.1), E.y + (hU - hL) * 0.3, hw * 1.85, (hU + hL) * 1.6, 3.5, 2.6);
      line([[-0.0075, tY + 0.004], [0, tY - 0.0095], [0.0075, tY + 0.004], [-0.0075, tY + 0.004]], 3, 2.2);
      line([[-mw * 1.3, vm + 0.0005], [mw * 1.3, vm + 0.0005]], 3, 2.2);
      for (let k = -3; k <= 3; k++) line([[k * mw * 0.36, vm + 0.0085], [k * mw * 0.36, vm - 0.0095]], 2.6, 2);
      for (const s of s2) line([[s * 0.08, E.y - 0.026], [s * 0.062, tY - 0.004], [s * 0.034, tY - 0.013]], 3, 2.2);
      line([[0.012, E.y + hU + 0.028], [0.02, E.y + hU + 0.042], [0.012, E.y + hU + 0.052], [0.024, E.y + hU + 0.072]], 2.6, 2);
    }
    if (F.legMk === 2) {   // runas de fuego: tres runas en la frente, una línea que cruza el ojo izquierdo y marcas en las mejillas
      const cc = col(mixC(sc, 0x2a0800, 0.35), 0.95);
      const RN = [[[0, -1, 0, 1], [0, 0.15, -0.7, 0.9], [0, 0.15, 0.7, 0.9]], [[-0.4, -1, -0.4, 1], [-0.4, 0.6, 0.5, 0], [0.5, 0, -0.4, -0.6]], [[0, 1, 0.6, 0.3], [0.6, 0.3, 0, -0.3], [0, -0.3, -0.6, 0.3], [-0.6, 0.3, 0, 1], [0, -0.3, 0.6, -1], [0, -0.3, -0.6, -1]]];
      RN.forEach((sg, i) => { const cx = (i - 1) * 0.03, cy = E.y + hU + 0.034, k = 0.0115; for (const [a, b, c2, d] of sg) line([[cx + a * k, cy + b * k], [cx + c2 * k, cy + d * k]], 6, 4, cc); });
      const x0 = -(E.x + hw * 0.12);
      line([[x0 + 0.002, E.y + hU + 0.02], [x0, E.y + hU + 0.004]], 6, 4, cc); line([[x0 - 0.001, E.y - hL - 0.004], [x0 - 0.003, E.y - hL - 0.03]], 6, 4, cc);
      for (const s of s2) for (let k = 0; k < 2; k++) { const xx = s * (E.x + hw * 1.45 + k * 0.009), yy = E.y + 0.002; line([[xx, yy + 0.008], [xx + s * 0.008, yy], [xx, yy - 0.008]], 5.5, 3.6, cc); }   // marcas en las sienes (la barba tapa las mejillas)
    }
    if (F.legMk === 3) {   // lágrimas de cristal: gemas bajo los ojos y una lágrima que cae
      const gem = (x, y, k, ph) => {
        const w = 0.0034 * k, h = 0.0052 * k;
        for (const [ctx, X, Y, isQ] of [[g, px, py, 0], [q, qx, qy, 1]]) {
          ctx.beginPath(); ctx.moveTo(X(x), Y(y + h)); ctx.lineTo(X(x + w), Y(y)); ctx.lineTo(X(x), Y(y - h)); ctx.lineTo(X(x - w), Y(y)); ctx.closePath();
          if (isQ) { ctx.fillStyle = `rgb(255,${Math.round(ph * 255)},${Math.round(rnd() * 255)})`; ctx.fill(); }
          else { ctx.fillStyle = col(mixC(sc, WHITE, 0.45)); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = col(mixC(sc, 0x1a1030, 0.6)); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(X(x - w * 0.3), Y(y + h * 0.3), 1.6, 0, 7); ctx.fill(); }
        }
      };
      for (const s of s2) { [-0.25, 0.2, 0.62].forEach((u, i) => gem(s * (E.x + u * hw), E.y - hL - 0.0058 - i * 0.0006, 0.8 + 0.1 * i, rnd())); gem(s * (E.x + hw * 1.3), E.y + hU * 0.2, 1.1, rnd()); }
      [[0.45, 0.016, 1.15], [0.5, 0.028, 0.9], [0.53, 0.038, 0.7]].forEach(([u, dy, k]) => gem(-(E.x + hw * u), E.y - hL - dy, k, rnd()));
    }
    if (F.legMk === 4) {   // aurora: sombra en forma de ala que brilla y cambia de color + destellos
      const PA = [[-0.95, 0.2], [-0.6, 1.25], [0.2, 1.75], [1.2, 1.95], [2.3, 2.1], [1.55, 1.05], [1.15, 0.2], [0.6, -0.9], [-0.3, -1.0]];
      for (const s of s2) for (const [ctx, X, Y, isQ] of [[g, px, py, 0], [q, qx, qy, 1]]) {
        ctx.save(); ctx.filter = isQ ? 'blur(3px)' : 'blur(6px)'; ctx.beginPath();
        PA.forEach(([u, v], i) => { const x = X(s * (E.x + u * hw)), y = Y(E.y + (v > 0 ? v * hU : v * hL)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
        ctx.fillStyle = isQ ? '#f00' : col(sc, 0.35); ctx.fill(); ctx.restore();
      }
      q.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 70; i++) { const s = rnd() < 0.5 ? -1 : 1, x = s * (E.x + (rnd() * 3 - 0.8) * hw), y = E.y + (rnd() * 2.4 - 0.3) * hU; q.fillStyle = `rgb(0,255,${Math.round(rnd() * 255)})`; q.beginPath(); q.arc(qx(x), qy(y), 1.1 + rnd(), 0, 7); q.fill(); }
      q.globalCompositeOperation = 'source-over';
    }
    if (F.legMk === 5) {   // grietas de lava: fisuras quebradas que bajan desde los ojos y suben por la frente
      const cc = col(mixC(sc, 0x1a0500, 0.45), 0.95), crack = (x, y, dx, dy, n, w) => { const pts = [[x, y]]; for (let k = 0; k < n; k++) { x += dx + (rnd() - 0.5) * 0.006; y += dy + (rnd() - 0.5) * 0.004; pts.push([x, y]); } line(pts, w, w * 0.7, cc); return pts; };
      for (const s of s2) { const a = crack(s * (E.x + hw * 1.15), E.y + 0.002, s * 0.007, 0.007, 4, 9); crack(...a[2], s * 0.002, 0.009, 2, 6); crack(...a[1], s * 0.006, -0.006, 2, 6); crack(s * (E.x + hw * 0.2), E.y - hL - 0.004, s * 0.002, -0.008, 2, 7); }
      const f = crack(0.002, E.y + hU + 0.016, 0.001, 0.011, 4, 9); crack(...f[2], 0.009, 0.006, 3, 6); crack(...f[1], -0.009, 0.005, 3, 6);
    }
    if (F.legMk === 6) {   // alas de mariposa: dos alas desde el rabillo de cada ojo (g = fase de cada ala) + destellos
      for (const s of s2) {
        const ox = s * (E.x + hw * 0.95), oy = E.y + 0.002;
        const wing = (ctx, X, Y, up) => { ctx.beginPath(); ctx.moveTo(X(ox), Y(oy)); if (up) ctx.bezierCurveTo(X(ox + s * 0.01), Y(oy + 0.032), X(ox + s * 0.042), Y(oy + 0.036), X(ox + s * 0.036), Y(oy + 0.008)); else ctx.bezierCurveTo(X(ox + s * 0.024), Y(oy - 0.002), X(ox + s * 0.028), Y(oy - 0.026), X(ox + s * 0.008), Y(oy - 0.02)); ctx.closePath(); };
        for (const up of [true, false]) {
          wing(g, px, py, up); g.fillStyle = col(sc, 0.5); g.fill(); g.lineWidth = 2.6; g.strokeStyle = col(mixC(sc, 0x1a1030, 0.6)); g.stroke();
          wing(q, qx, qy, up); q.fillStyle = up ? 'rgb(255,40,0)' : 'rgb(255,170,0)'; q.fill();
        }
      }
      q.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) { const s = rnd() < 0.5 ? -1 : 1, x = s * (E.x + hw * (1.1 + rnd() * 2.2)), y = E.y + (rnd() * 2.6 - 0.8) * hU; q.fillStyle = 'rgb(0,0,' + Math.round(80 + rnd() * 175) + ')'; q.beginPath(); q.arc(qx(x), qy(y), 1 + rnd(), 0, 7); q.fill(); }
      q.globalCompositeOperation = 'source-over';
    }
    for (const s of s2) { q.fillStyle = '#000'; q.beginPath(); q.ellipse(qx(s * E.x), qy(E.y + (hU - hL) / 2), hw * kx * 0.51, (hU + hL) / 2 * ky * 0.5, 0, 0, 7); q.fill(); }   // el ojo abierto no brilla
    glowTex = new THREE.CanvasTexture(gc);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.userData.glow = glowTex; return tex;
}
const BLACK_TEX = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; })();
const FACE_GLSL = /* glsl */`
varying vec2 vFuv; varying vec4 vOvr; varying float vFw;
uniform sampler2D uFaceTex; uniform vec3 uSkin, uIris, uLash, uBrowC, uSclera;
uniform vec4 uEyeA, uEyeB, uLid, uGaze, uBrow, uBrowS, uFace;
uniform vec3 uIris2; uniform vec4 uIrisS, uBrowT;
uniform float uT; uniform sampler2D uGlowTex; uniform vec4 uGlowS; uniform vec3 uGlowA;
vec3 fEm;   // brillo propio (ojos y maquillaje legendarios)
float fh2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh2(i), fh2(i + vec2(1.0, 0.0)), f.x), mix(fh2(i + vec2(0.0, 1.0)), fh2(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 fhue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
float aas(float e, float x, float w) { return smoothstep(e - w, e + w, x); }
float fdot2(vec2 v) { return dot(v, v); }
float fsdHeart(vec2 p) { p.x = abs(p.x); if (p.y + p.x > 1.0) return sqrt(fdot2(p - vec2(0.25, 0.75))) - 0.35355; return sqrt(min(fdot2(p - vec2(0.0, 1.0)), fdot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y); }
// línea base entre lagrimal (más bajo) y rabillo (más alto)
float baseC(float qn) { return mix(-0.14 * uEyeA.w, uEyeB.y, qn * 0.5 + 0.5); }
float lidL0(float qn) { float e = max(0.0, 1.0 - qn * qn); return baseC(qn) - uEyeB.x * pow(e, 0.85) * (1.0 + 0.2 * qn); }
float lidU(float qn, float close) {
  float e = max(0.0, 1.0 - qn * qn);
  float u0 = baseC(qn) + uEyeA.w * pow(e, 0.62) * (1.0 - 0.1 * qn);
  return mix(u0, lidL0(qn) - 0.0002, close);
}
float lidL(float qn, float squint) { return mix(lidL0(qn), mix(lidL0(qn), lidU(qn, 0.0), 0.35), squint); }
float strokeD(vec2 p, vec2 a, vec2 dir, float L, out float h) { vec2 pa = p - a; h = clamp(dot(pa, dir) / L, 0.0, 1.0); return length(pa - dir * L * h); }
vec3 faceEye(vec3 col, vec2 P, float s, float close, float squint, vec2 gz, float raise, float angry, float aa) {
  float hw = uEyeA.z, hU = uEyeA.w, lk = uFace.w;
  float q = (P.x - s * uEyeA.x) * s, y = P.y - uEyeA.y, qn = q / hw, qc = clamp(qn, -1.0, 1.0);
  float yU = lidU(qc, close), yU0 = lidU(qc, 0.0), yLo = lidL(qc, squint);
  float inX = 1.0 - aas(1.0, abs(qn), aa / hw);
  float inside = aas(yLo, y, aa) * (1.0 - aas(yU, y, aa)) * inX;
  // globo: sombra bajo el párpado y lagrimal rosado
  float shd = smoothstep(0.0, hU * 0.7, yU - y);
  vec3 ec = uSclera * mix(0.6, 1.0, shd);
  ec = mix(ec, vec3(0.92, 0.58, 0.58), smoothstep(-0.75, -0.97, qn) * 0.85);
  // iris con estrías, aro oscuro, pupila y brillos. Estilos: 0 clásico, 1 brillo anime, 2 pupila corazón, 3 pupila estrella, 4 degradado, 5 felino, 6 anillo, 7 heterocromía, 8 fantasma
  float rI = uEyeB.z; vec2 ic = vec2(gz.x * s, gz.y + hU * 0.1), dI = vec2(q, y) - ic; float d = length(dI);
  int sty = int(uIrisS.x + 0.5);
  vec3 IC = (sty == 7 && s > 0.0) ? uIris2 : uIris;
  vec3 ir = mix(IC * 0.3, IC * 1.6 + 0.04, smoothstep(rI * 0.45, -rI * 0.95, dI.y));
  if (sty == 4) ir = mix(uIris2 * 1.5 + 0.05, IC * 0.45, smoothstep(-rI * 0.85, rI * 0.7, dI.y));
  if (sty == 1) ir += IC * 0.9 * smoothstep(rI * 0.95, rI * 0.5, d) * smoothstep(-rI * 0.1, -rI * 0.75, dI.y);
  ir *= 0.86 + 0.14 * sin(atan(dI.y, dI.x) * 13.0 + d * 1700.0);
  ir = mix(ir, IC * 0.2, smoothstep(rI * 0.72, rI, d));
  if (sty == 6) ir = mix(ir, uIris2 * 1.6 + 0.12, 1.0 - aas(rI * 0.075, abs(d - rI * 0.6), aa));
  // legendarios (animados): 9 rayo, 10 eclipse, 11 galaxia, 12 corazón latiente
  vec3 iem = vec3(0.0); float bt = pow(max(0.0, sin(uT * 7.0)), 8.0) + 0.55 * pow(max(0.0, sin(uT * 7.0 - 0.9)), 8.0);   // latido doble
  if (sty >= 9) {
    float an = atan(dI.y, dI.x), r = d / rI;
    if (sty == 9) {   // rayos que saltan desde la pupila
      float j = floor(uT * 11.0 + s * 2.0), bo = 0.0;
      for (int k = 0; k < 5; k++) {
        float fk = float(k), ak = fk * 1.2566 + fh2(vec2(j, fk)) * 1.3, zig = (fn2(vec2(r * 7.0, j * 1.7 + fk * 5.0)) - 0.5) * 1.6 * r;
        float da = abs(mod(an - ak - zig + 3.14159, 6.28318) - 3.14159);
        bo = max(bo, (1.0 - smoothstep(0.0, 0.07, da * r)) * smoothstep(0.22, 0.4, r) * step(fh2(vec2(j * 1.3 + 2.0, fk)), 0.8));
      }
      ir = mix(IC * 0.22 + IC * 0.4 * smoothstep(0.55, 0.2, r), vec3(0.85, 0.95, 1.0), bo);
      iem = IC * (bo * 2.8 + 0.9 * smoothstep(0.5, 0.25, r) * (0.75 + 0.25 * sin(uT * 23.0)));
    } else if (sty == 10) {   // disco negro con una corona de fuego que gira
      float cr = 0.58 + 0.13 * fn2(vec2(an * 2.2 + uT * 1.4, uT * 0.6)) + 0.05 * sin(an * 9.0 - uT * 4.5);
      float ring = smoothstep(cr + 0.32, cr + 0.02, r) * smoothstep(cr - 0.04, cr + 0.02, r);
      vec3 cc = mix(uIris2 * 1.2, IC, smoothstep(cr, cr + 0.3, r));
      ir = mix(vec3(0.012, 0.008, 0.01), cc, ring);
      iem = cc * ring * 2.6 + uIris2 * (1.0 - smoothstep(0.0, 0.05, abs(r - cr + 0.02))) * 1.8;
    } else if (sty == 11) {   // nebulosa en espiral + estrellas que titilan
      float sw = an + r * 4.5 - uT * 0.7, nb = 0.5 + 0.5 * sin(sw * 3.0) * (0.55 + 0.45 * fn2(vec2(r * 6.0, an * 2.0 + uT * 0.3)));
      vec3 nc = mix(IC, uIris2, nb);
      ir = mix(vec3(0.03, 0.012, 0.08), nc, (0.3 + 0.7 * nb) * smoothstep(1.05, 0.25, r));
      vec2 sg = vec2((an + 3.14159) * 2.6 - uT * 0.45, r * 6.0), gi = floor(sg), gf = fract(sg) - 0.5;
      float sr = fh2(gi + s * 13.0), stw = smoothstep(0.2, 0.0, length(gf)) * step(0.5, sr) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * (2.0 + sr * 4.0) + sr * 30.0), 3.0));
      ir += vec3(stw) + vec3(1.0) * smoothstep(0.2, 0.0, r);
      iem = nc * nb * 0.8 + vec3(stw) * 2.4 + vec3(1.0, 0.95, 1.0) * smoothstep(0.24, 0.0, r) * 1.8;
    } else if (sty == 12) {   // brillo que late + tres destellos que orbitan
      iem = IC * (0.25 + 0.5 * bt) * smoothstep(0.3, 1.0, r);
      for (int k = 0; k < 3; k++) {
        float a2 = uT * 1.6 + float(k) * 2.0944 + s; vec2 q2 = abs(dI - vec2(cos(a2), sin(a2)) * rI * 0.8);
        float gl = max(0.0, 1.0 - (q2.x * q2.y) / (rI * rI * 0.0016) - length(q2) / (rI * 0.22));
        ir += vec3(gl); iem += vec3(1.0) * gl * 2.0;
      }
    }
  }
  if (sty == 13) {   // vórtice: espiral de dos colores que gira y late
    float an = atan(dI.y, dI.x), r = d / rI, sp = sin(an * 2.0 + r * 15.0 - uT * 5.0), band = smoothstep(-0.25, 0.55, sp);
    vec3 cc = mix(IC, uIris2, 0.5 + 0.5 * sin(r * 5.0 - uT * 2.2));
    ir = mix(vec3(0.02, 0.01, 0.04), cc, band * smoothstep(1.05, 0.3, r));
    iem = cc * band * (1.0 + 0.7 * sin(uT * 4.0)) * smoothstep(1.0, 0.25, r);
  } else if (sty == 14) {   // prisma: facetas de caleidoscopio con arcoíris que gira y destellos
    float an = atan(dI.y, dI.x), r = d / rI, sg = 6.28318 / 6.0, a2 = abs(mod(an + uT * 0.35, sg) - sg * 0.5) / sg;
    float fc = fract(r * 2.6 + a2 * 1.4), facet = step(0.5, fc), edge = 1.0 - smoothstep(0.0, 0.06, min(fc, 1.0 - fc));
    vec3 cc = mix(mix(IC, uIris2, facet), fhue(an / 6.28318 + r * 0.6 - uT * 0.12), 0.4);
    ir = cc * (0.6 + 0.4 * facet) + vec3(edge * 0.35);
    iem = cc * (0.5 + 0.6 * facet) * smoothstep(1.0, 0.35, r) + vec3(1.0) * edge * 0.6 + vec3(1.0) * pow(max(0.0, sin(uT * 2.6 + an * 3.0)), 24.0) * smoothstep(0.3, 0.9, r) * 2.2;
  }
  float pd = d - rI * (sty == 6 ? 0.3 : sty == 9 ? 0.24 : 0.4); vec3 pc = vec3(0.015, 0.01, 0.02);
  if (sty == 2 || sty == 12) { float hk = rI * 0.62 * (sty == 12 ? 0.85 + 0.25 * bt : 1.0); pd = fsdHeart(dI / hk + vec2(0.0, 0.5)) * hk; pc = sty == 12 ? uIris2 * 1.3 + 0.12 : vec3(0.07, 0.0, 0.03); }
  if (sty == 10 || sty == 11) pd = 1.0;
  if (sty == 3) { float an = atan(dI.x, dI.y); pd = d - rI * 0.52 * (0.42 + 0.58 * pow(abs(cos(2.5 * an)), 2.5)); pc = uIris2 * 1.3 + 0.2; }
  if (sty == 5) pd = (length(dI / vec2(rI * 0.14, rI * 0.82)) - 1.0) * rI * 0.14;
  if (sty == 8) { ir = mix(vec3(0.96, 0.97, 1.0), IC * 0.7 + 0.35, smoothstep(rI * 0.1, rI, d)); pd = 1.0; }
  ir = mix(ir, pc, 1.0 - aas(0.0, pd, aa));
  if (sty == 12) iem += pc * (1.0 - aas(0.0, pd, aa)) * (0.7 + 2.4 * bt);
  ir *= mix(0.42, 1.0, shd);
  ec = mix(ec, ir, 1.0 - aas(rI, d, aa));
  fEm += iem * (1.0 - aas(rI, d, aa)) * inside * mix(0.55, 1.0, shd);
  ec = mix(ec, vec3(1.0), 1.0 - aas(rI * 0.21, length((dI - vec2(0.3 * rI * s, 0.34 * rI)) * vec2(1.0, 0.85)), aa));
  ec = mix(ec, vec3(1.0), (1.0 - aas(rI * 0.085, length(dI - vec2(-0.32 * rI * s, -0.42 * rI)), aa)) * 0.85);
  if (sty == 1) ec = mix(ec, vec3(1.0), (1.0 - aas(rI * 0.065, length(dI - vec2(0.05 * rI * s, -0.62 * rI)), aa)) * 0.8);
  col = mix(col, ec, inside);
  // pliegue del párpado
  float cy = mix(yU0, yU, 0.35) + 0.0048;
  col = mix(col, col * vec3(0.7, 0.58, 0.58), (1.0 - aas(0.00042, abs(y - cy), aa)) * smoothstep(1.0, 0.45, abs(qn - 0.2)) * 0.75);
  // delineado superior que engorda hacia fuera y termina en rabillo
  float tl = lk * mix(0.0008, 0.0025, smoothstep(-0.9, 0.95, qn)), dd = y - yU;
  float liner = aas(-0.3 * tl, dd, aa) * (1.0 - aas(tl, dd, aa)) * (1.0 - aas(1.02, abs(qn), aa / hw));
  float wl = 0.62 * hw * uEyeB.w, tipX = hw + wl, tipY = baseC(1.0) + wl * 0.62;
  float a0 = 0.66 * hw, yTop0 = lidU(0.66, close) + lk * 0.0022;
  float wu = mix(yTop0, tipY, clamp((q - a0) / max(1e-5, tipX - a0), 0.0, 1.0));
  float wlo = q < hw ? lidU(qc, close) : mix(baseC(1.0), tipY, (q - hw) / max(1e-5, wl));
  float wing = aas(wlo, y, aa) * (1.0 - aas(wu, y, aa)) * aas(a0, q, aa) * (1.0 - aas(tipX, q, aa)) * step(0.001, uEyeB.w);
  col = mix(col, uLash, max(liner, wing));
  // pestañas: curvas (dos tramos), más largas hacia fuera; dos más saliendo del rabillo
  if (lk > 0.8) {
    float LL = uBrowS.w, best = 1.0;
    for (int i = 0; i < 9; i++) {
      float fi = float(i) / 8.0, qi = mix(-0.25, 0.97, fi), tli = mix(0.001, 0.003, smoothstep(-0.9, 0.95, qi));
      vec2 a = vec2(qi * hw, lidU(qi, close) + tli * 0.55);
      float an = mix(0.25, 1.05, fi) + close * 1.6;                       // ángulo desde la vertical, hacia fuera
      vec2 d1 = vec2(sin(an), cos(an)), d2 = vec2(sin(an + 0.55), cos(an + 0.55));
      float L = (0.0022 + 0.0042 * fi) * LL, h1, h2;
      float s1 = strokeD(vec2(q, y), a, d1, L * 0.55, h1), s2 = strokeD(vec2(q, y), a + d1 * L * 0.55, d2, L * 0.5, h2);
      best = min(best, min(s1 - mix(0.0009, 0.00055, h1), s2 - mix(0.00055, 0.00006, h2)));
    }
    if (uEyeB.w > 0.0) for (int i = 0; i < 2; i++) {
      float fi = float(i); vec2 a = vec2(hw * (1.0 + 0.35 * uEyeB.w * (0.4 + 0.5 * fi)), baseC(1.0) + 0.0018 + fi * 0.0012 * uEyeB.w);
      float an = 1.15 + 0.2 * fi + close * 0.8, L = (0.004 + 0.0012 * fi) * LL, h1, h2;
      vec2 d1 = vec2(sin(an), cos(an)), d2 = vec2(sin(an + 0.5), cos(an + 0.5));
      float s1 = strokeD(vec2(q, y), a, d1, L * 0.55, h1), s2 = strokeD(vec2(q, y), a + d1 * L * 0.55, d2, L * 0.5, h2);
      best = min(best, min(s1 - mix(0.00085, 0.0005, h1), s2 - mix(0.0005, 0.00006, h2)));
    }
    col = mix(col, uLash, 1.0 - aas(0.0, best, aa));
    for (int i = 0; i < 4; i++) {
      float qi = 0.3 + 0.2 * float(i); vec2 a = vec2(qi * hw, lidL(qi, squint));
      float h, sd = strokeD(vec2(q, y), a, normalize(vec2(0.35 + 0.25 * float(i), -1.0)), (0.0014 + 0.0005 * float(i)) * LL * 0.7, h);
      col = mix(col, uLash, (1.0 - aas(mix(0.00045, 0.00006, h), sd, aa)) * (1.0 - close));
    }
  }
  // línea inferior
  float dl = yLo - y, lw = 0.00028 + 0.00035 * smoothstep(-0.3, 1.0, qn);
  col = mix(col, mix(uLash, col, 0.3), aas(-0.0001, dl, aa) * (1.0 - aas(lw, dl, aa)) * smoothstep(-0.6, 0.2, qn) * inX * (1.0 - close));
  // ceja: cabeza redondeada, arco alto, cola afilada, con textura de pelo
  float bq0 = -1.05 * hw, bq1 = 1.32 * hw * uBrowT.w, t = (q - bq0) / (bq1 - bq0), tc = clamp(t, 0.0, 1.0);
  float by = baseC(0.0) + hU + uBrowS.x + raise;
  float yc = by + uBrowS.z * sin(3.14159 * pow(tc, 1.7)) - 0.0012 * tc - angry * (1.0 - tc) * 0.0055 + angry * 0.001 * tc;
  float T = uBrowS.y * mix(0.6, 1.0, sqrt(clamp(tc / 0.14, 0.0, 1.0))) * mix(1.0, mix(0.16, 0.62, uBrowT.x), smoothstep(0.5, 1.0, tc));
  float rough = uBrowT.z * 0.0011 * (sin(q * 5200.0) * 0.6 + sin(q * 2900.0 + 1.3) * 0.4);   // ceja poblada: borde irregular
  float yl = yc - T * 0.42 - rough * 0.6, yh = yc + T * 0.58 + rough;
  float rnd0 = (y - yc) / max(T, 1e-5) * 2.0;   // cabeza de la ceja redondeada
  float ends = aas(0.0, t - 0.05 * rnd0 * rnd0, 0.015) * (1.0 - aas(1.0, t, 0.02));
  ends *= 1.0 - uBrowT.y * (1.0 - aas(0.028, abs(t - 0.64), 0.01));   // corte en la ceja
  float bm = aas(yl, y, aa * 1.3) * (1.0 - aas(yh, y, aa * 1.3)) * ends;
  float hairs = 0.84 + 0.16 * sin((q * (1.0 - tc * 0.6) + (y - yl) * (0.9 - tc * 0.6)) * 3600.0);
  col = mix(col, uBrowC * hairs, bm * mix(0.78, 1.0, smoothstep(0.0, 0.22, t)));
  return col;
}
vec3 facePaint() {
  fEm = vec3(0.0);
  vec2 P = vec2(mix(-uFace.x, uFace.x, vFuv.x), mix(uFace.y, uFace.z, vFuv.y));
  vec3 col = mix(uSkin, texture2D(uFaceTex, clamp(vFuv, 0.0, 1.0)).rgb, vFw);
  float aa = max(fwidth(P.x), fwidth(P.y)) * 0.75;
  if (uGlowS.x > 0.5 && vFw > 0.01) {   // maquillaje legendario: máscara pintada (r = zona, g/b = fase y destellos), animada aquí
    vec4 gm = texture2D(uGlowTex, clamp(vFuv, 0.0, 1.0)); int md = int(uGlowS.x + 0.5); vec3 ge = vec3(0.0);
    if (md == 1) { float pu = 0.6 + 0.4 * sin(uT * 3.2); col = mix(col, uGlowA * 0.55 + 0.45, gm.r * 0.9); ge = uGlowA * gm.r * (1.0 + 1.8 * pu); }
    else if (md == 2) { float w = 0.5 + 0.5 * sin(uT * 3.0 - vFuv.y * 16.0 + vFuv.x * 5.0), fl = 0.8 + 0.2 * fn2(vec2(uT * 9.0, vFuv.x * 30.0)); col = mix(col, mix(uGlowA, vec3(1.0, 0.85, 0.4), 0.25 * w), gm.r * 0.95); ge = uGlowA * gm.r * (1.3 + 2.8 * w) * fl; }
    else if (md == 3) { float tw = pow(max(0.0, sin(uT * 2.4 + gm.g * 40.0)), 12.0); col = mix(col, mix(uGlowA, vec3(1.0), 0.5 + 0.3 * gm.b), gm.r); ge = uGlowA * gm.r * (0.8 + 0.4 * sin(uT * 2.0 + gm.g * 9.0)) + vec3(1.0) * gm.r * tw * 3.5; }
    else if (md == 5) { float fl = 0.5 + 0.5 * sin(uT * 2.2 - vFuv.y * 22.0 + vFuv.x * 4.0); col = mix(col, mix(uGlowA, vec3(1.0, 0.9, 0.5), 0.4 * fl), gm.r); ge = uGlowA * gm.r * (1.1 + 2.6 * fl) * (0.85 + 0.15 * fn2(vec2(uT * 7.0, vFuv.x * 40.0))); }
    else if (md == 6) { float fl = 0.5 + 0.5 * sin(uT * 3.6 + gm.g * 6.28); vec3 ac = mix(uGlowA, fhue(gm.g * 0.5 + uT * 0.06), 0.35); col = mix(col, ac, gm.r * (0.5 + 0.3 * fl)); ge = ac * gm.r * (0.5 + 1.5 * fl) + vec3(1.0) * gm.b * pow(max(0.0, sin(uT * 3.0 + gm.b * 60.0)), 10.0) * 3.0; }
    else { vec3 ac = mix(uGlowA, fhue(vFuv.x * 1.3 + vFuv.y * 0.9 - uT * 0.1), 0.65); col = mix(col, ac, gm.r * 0.72); ge = ac * gm.r * (0.8 + 0.5 * sin(uT * 1.8 + vFuv.x * 12.0)) + vec3(1.0) * gm.g * pow(max(0.0, sin(uT * 3.0 + gm.b * 60.0)), 10.0) * 3.0; }
    fEm += ge * vFw;
  }
  if (vFw > 0.01) {
    vec3 e0 = fEm;
    vec3 c2 = faceEye(col, P, -1.0, uLid.x, uLid.z, uGaze.xy, uBrow.x, uBrow.z, aa);
    c2 = faceEye(c2, P, 1.0, uLid.y, uLid.w, uGaze.zw, uBrow.y, uBrow.w, aa);
    col = mix(col, c2, vFw); fEm = e0 + (fEm - e0) * vFw;
  }
  return mix(col, vOvr.rgb, vOvr.a);
}`;
function faceMaterial(fem, F, look, hs) {
  const E = hs.eye, hw = E.hw, C = c => new THREE.Color(c), ft = paintFaceTex(fem, F, look, hs);
  const U = {
    uFaceTex: { value: ft }, uSkin: { value: C(look.skin) },
    uIris: { value: C(F.eyes ?? 0x3a2a18) }, uLash: { value: C(F.lash ?? (fem ? 0x1a0a14 : F.brow !== undefined ? shade(F.brow, 0.75) : shade(look.hair?.color ?? 0x2a1a10, 0.35))) },
    uBrowC: { value: C(F.brow ?? shade(look.hair?.color ?? 0x2a1a10, 0.7)) }, uSclera: { value: C(0xe6e0d8) },
    uEyeA: { value: new THREE.Vector4(E.x, E.y, hw, hw * (fem ? 0.66 : 0.56) * (F.eyeOpen ?? 1)) },
    uEyeB: { value: new THREE.Vector4(hw * (fem ? 0.38 : 0.33) * (F.lowLid ?? 1), (fem ? 0.0028 : 0.0012) + 0.001 * (F.tilt ?? 0), hw * (fem ? 0.56 : 0.47) * (F.irisK ?? 1), F.liner ?? (fem ? 1 : 0)) },
    uLid: { value: new THREE.Vector4(0.2, 0.2, 0, 0) }, uGaze: { value: new THREE.Vector4(0, 0, 0, 0) }, uBrow: { value: new THREE.Vector4(0, 0, 0, 0) },
    uBrowS: { value: new THREE.Vector4((fem ? 0.016 : 0.011) - (F.browDrop ?? 0), (fem ? 0.0092 : 0.0085) * F.browThick, (fem ? 0.0042 : 0.0022) * (0.4 + F.browArch) / 1.1, F.lashLen ?? 1) },
    uFace: { value: new THREE.Vector4(FACE_UV.X, FACE_UV.Y0, FACE_UV.Y1, F.lineW ?? (fem ? 1 : 0.55)) },
    uIris2: { value: C(F.eyes2 ?? 0xe8b020) }, uIrisS: { value: new THREE.Vector4(F.irisStyle ?? 0, 0, 0, 0) },
    uBrowT: { value: new THREE.Vector4(F.browStraight ?? 0, F.browSlit ?? 0, F.browBushy ?? 0, F.browLen ?? 1) },
    uT: { value: 0 }, uGlowTex: { value: ft.userData.glow ?? BLACK_TEX }, uGlowS: { value: new THREE.Vector4(F.legMk ?? 0, 0, 0, 0) }, uGlowA: { value: C(F.shadow ?? 0x3affe0) },
  };
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD_SOFT });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute vec2 fuv; attribute vec4 fovr; attribute float ffw;\nvarying vec2 vFuv; varying vec4 vOvr; varying float vFw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFuv = fuv; vOvr = fovr; vFw = ffw;');
    sh.fragmentShader = FACE_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= facePaint();').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fEm;');
  };
  m.customProgramCacheKey = () => 'facePaint';
  return { mat: m, U };
}

/* piel del cuerpo con la sombra que la cabeza proyecta sobre el cuello (sigue el contorno de la mandíbula y se mueve con la cabeza) */
function neckShadowMaterial(skin, hs) {
  const U = { uFaceInv: { value: new THREE.Matrix4() }, uJaw: { value: hs.jaw.slice() }, uNeckSh: { value: new THREE.Color().setRGB(0.74, 0.55, 0.52) }, uSp: { value: 0 }, uBust: { value: 0 } };
  const m = new THREE.MeshToonMaterial({ color: skin, gradientMap: GRAD_SOFT });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vWPos; uniform mat4 uFaceInv; uniform float uJaw[13]; uniform vec3 uNeckSh;
float jawAt(float ax) { float f = clamp(ax / 0.01, 0.0, 11.999); int i = int(f); return mix(uJaw[i], uJaw[i + 1], fract(f)); }
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  vec3 fp = (uFaceInv * vec4(vWPos, 1.0)).xyz; float ax = abs(fp.x), jy = jawAt(ax) + 0.004, dep = mix(0.034, 0.028, clamp(ax / 0.08, 0.0, 1.0));
  float nsh = (1.0 - smoothstep(jy - 0.002, jy, fp.y)) * smoothstep(jy - dep - 0.008, jy - dep + 0.002, fp.y) * smoothstep(-0.07, -0.02, fp.z) * (1.0 - smoothstep(0.075, 0.1, ax));
  diffuseColor.rgb *= mix(vec3(1.0), uNeckSh, nsh);`);
    bustShade(sh, {}, 1, [0.8, 0.6, 0.56]);
  };
  m.customProgramCacheKey = () => 'neckShadow';
  return { mat: m, U };
}

/* ---------- texturas de ropa por color (en caché) ---------- */
const _texC = {};
const cssC = c => typeof c === 'string' ? c : '#' + new THREE.Color(c).getHexString();
const cTex = (k, fn) => _texC[k] || (_texC[k] = fn());
const plaidTex = (c, rep = [2, 3]) => cTex('plaid' + c + rep, () => canvasTex(64, 64, g => { g.fillStyle = cssC(c); g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 20, 64, 10); g.fillRect(20, 0, 10, 64); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 48, 64, 4); g.fillRect(48, 0, 4, 64); g.fillStyle = 'rgba(255,220,80,.7)'; g.fillRect(0, 40, 64, 2); g.fillRect(40, 0, 2, 64); }, { repeat: rep }));
const sideStripeTex = (c, c2) => cTex('ss' + c + c2, () => canvasTex(64, 16, g => { g.fillStyle = cssC(c); g.fillRect(0, 0, 64, 16); g.fillStyle = cssC(c2); for (const x of [16, 48]) g.fillRect(x - 2.5, 0, 5, 16); }, { repeat: [1, 1] }));
const kneeSockTex = (c, c2) => cTex('ks' + c + c2, () => canvasTex(16, 64, g => { g.fillStyle = cssC(c); g.fillRect(0, 0, 16, 64); g.fillStyle = cssC(c2); g.fillRect(0, 33, 16, 4); g.fillRect(0, 40, 16, 4); }, { repeat: [1, 1] }));
const fishnetTex = () => cTex('net', () => canvasTex(64, 64, g => { g.strokeStyle = '#fff'; g.lineWidth = 8; for (const d of [-64, 0, 64]) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + 64, 64); g.stroke(); g.beginPath(); g.moveTo(d + 64, 0); g.lineTo(d, 64); g.stroke(); } }, { repeat: [14, 20] }));
/* corsé: ballenas verticales y cordones cruzados en el centro delantero (u = 0.5) */
const corsetTex = c => cTex('corset' + c, () => canvasTex(512, 256, g => {
  g.fillStyle = cssC(c); g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; for (let k = 0; k < 16; k++) { if (k === 8) continue; const x = k * 32; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = '#120c12'; g.fillRect(244, 0, 24, 256);
  g.strokeStyle = '#f2ece6'; g.lineWidth = 4; for (let y = 6; y < 256; y += 22) { g.beginPath(); g.moveTo(240, y); g.lineTo(272, y + 18); g.moveTo(272, y); g.lineTo(240, y + 18); g.stroke(); }
  g.fillStyle = '#d0d0d8'; for (let y = 6; y < 256; y += 22) for (const x of [238, 274]) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
}));
const SKIRTS = { skirt: { HL: 0.315, flare: 0.075, pleat: 0.045 }, skirtPlaid: { HL: 0.3, flare: 0.07, pleat: 0.04, plaid: true }, mini: { HL: 0.2, flare: 0.022, pleat: 0 }, faldaGalaxia: { HL: 0.3, flare: 0.085, pleat: 0.04, leg: ['galaxy', 0x2ad8ff, 8] }, faldaFuego: { HL: 0.3, flare: 0.08, pleat: 0.045, leg: ['fire', 0xffd040, 8] } };
/* legendarios: zapato base + efecto + color de brillo; barba [efecto, brillo, escala]; peinado: mechones base, efecto, aura y su caja [centro, radios] */
const SHOE_LEG = { botasInfierno: ['boot', 'lava', 0xff5a10], botasCromo: ['boot', 'chrome', 0xffffff], cristal: ['platform', 'crystal', 0xffffff], botasHolo: ['tallboots', 'holo', 0xffffff], zapasNeon: ['sneaker', 'neon', 0x3affd0], botasFuego: ['tallboots', 'fire', 0xffd040] };
const BEARD_LEG = { barbaFuego: ['fire', 0xffd040, 34], escarcha: ['crystal', 0xffffff, 40], barbaRayo: ['electric', 0x9ae8ff, 34] };
const LEG_HAIR = {
  furia: { base: 'furia', fx: 'chrome', sc: 30, k: 1.3, aura: 'spark', box: [0, 0.14, -0.03, 0.25, 0.36, 0.25] },
  trueno: { base: 'mohawk', fx: 'electric', sc: 26, aura: 'bolt', box: [0, 0.14, -0.05, 0.19, 0.38, 0.3] },
  galaxiaH: { base: 'longF', fx: 'galaxy', sc: 16, aura: 'star', box: [0, -0.1, -0.06, 0.26, 0.5, 0.26], shell: false, n: 90 },   // melenas grandes: solo nube de partículas (la cáscara se veía como burbuja)
  neonTw: { base: 'pigtails', fx: 'neon', sc: 24, aura: 'heart', box: [0, -0.08, -0.03, 0.36, 0.48, 0.24], shell: false, n: 80 },
  llamarada: { base: 'spiky', fx: 'fire', sc: 26, aura: 'spark', box: [0, 0.14, -0.03, 0.22, 0.34, 0.24] },
  fenixH: { base: 'ponytail', fx: 'fire', sc: 22, aura: 'spark', box: [0, 0.0, -0.1, 0.24, 0.42, 0.3], shell: false, n: 70 },
};
const SHOE_KIND = { boot: 'boot', chelsea: 'boot', sneaker: 'sneaker', hightops: 'sneaker', platform: 'platform', tallboots: 'platform' };
/* ---------- catálogo de ropa (regiones del cuerpo base) ---------- */
const inT = (m, y0, y1) => m.part === 0 && m.s >= y0 && m.s <= y1;
const inA = (m, s0, s1) => (m.part === 1 || m.part === 2) && m.s <= s0 && m.s >= s1;
const inL = (m, s0, s1) => (m.part === 3 || m.part === 4) && m.s <= s0 && m.s >= s1;
const TOPS = {
  tank: c => [{ clip: m => {   // camiseta sin mangas: escote en U adelante, tirantes anchos sobre el trapecio
    if (m.part !== 0) return -1;
    const f = clamp(0.5 + Math.cos(m.a) * 1.5, 0, 1), top = lerp(0.53, 0.47, f) - lerp(0.02, 0.06, f) * Math.exp(-((m.x / 0.075) ** 2));
    const body = Math.min(top - m.s, m.s + 0.03), strap = Math.min(0.036 - Math.abs(Math.abs(m.x) - 0.105), (m.w - 0.09) * 2);
    return Math.max(body, strap);
  }, inf: 0.006, color: c.color }],
  tee: c => [{ pred: m => inT(m, -0.07, 0.62) || inA(m, 0.09, -0.15), inf: m => m.part === 0 ? 0.008 : 0.01 + 0.012 * clamp(-m.s / 0.15, 0, 1), color: c.color }],
  longsleeve: c => [{ pred: m => inT(m, -0.07, 0.62) || inA(m, 0.09, -0.6), inf: 0.009, color: c.color }],
  jacket: c => [{ pred: m => inT(m, -0.09, 0.64) || inA(m, 0.09, -0.58), inf: m => m.part === 0 ? 0.012 : 0.012 + 0.01 * clamp((-m.s - 0.4) / 0.18, 0, 1), color: c.color }],
  crop: c => [{ clip: m => {   // top corto: cintura al aire, escote corazón y tirantes
    if (m.part !== 0) return -1;
    const f = clamp(0.5 + Math.cos(m.a) * 1.5, 0, 1), ax = Math.abs(m.x);
    const top = lerp(0.51, 0.476, f) + f * 0.012 * Math.exp(-((ax - 0.08) ** 2) / 0.001) - f * 0.03 * Math.exp(-(m.x * m.x) / 0.0006);
    return Math.max(Math.min(top - m.s, m.s - 0.265), Math.min(0.018 - Math.abs(ax - 0.092), (m.s - 0.4) * 2));
  }, inf: 0.006, color: c.color }],
  corset: c => [{ clip: m => {   // corsé: de la cadera al busto, hombros al aire
    if (m.part !== 0) return -1;
    const f = clamp(0.5 + Math.cos(m.a) * 1.5, 0, 1), ax = Math.abs(m.x);
    const top = lerp(0.5, 0.464, f) + f * 0.016 * Math.exp(-((ax - 0.082) ** 2) / 0.0012) - f * 0.024 * Math.exp(-(m.x * m.x) / 0.0005);
    return Math.min(top - m.s, m.s + 0.01);
  }, inf: 0.008, color: 0xffffff, map: corsetTex(c.color ?? 0x7a1020) }],
  leather: c => [
    { pred: m => (inT(m, -0.1, 0.62) && !(Math.abs(m.a) < 0.42 && m.s < 0.53)) || inA(m, 0.09, -0.6), inf: m => m.part === 0 ? 0.017 : 0.014, color: c.color },
    { pred: m => inT(m, -0.05, 0.6), inf: 0.006, color: 0xffffff, map: TX.skullTee },
  ],
  // legendarios (leg = [efecto, color, brillo, escala])
  infernal: c => { const P = TOPS.leather(c); P[0].leg = ['lava', c.color ?? 0x1a0c08, 0xff5a10, 9]; return P; },
  cromo: c => [{ pred: m => inT(m, -0.07, 0.62) || inA(m, 0.09, -0.6), inf: m => m.part === 0 ? 0.011 : 0.01, color: c.color, leg: ['chrome', c.color ?? 0x8a92a6, 0xffffff, 5] }],
  diamante: c => { const P = TOPS.corset({ color: 0xffffff }); P[0].leg = ['glitter', c.color ?? 0xc8c0f0, 0xffffff, 1]; return P; },
  holoTop: c => { const P = TOPS.crop(c); P[0].leg = ['holo', c.color ?? 0xe8e0ff, 0xffffff, 5]; return P; },
  neonTank: c => { const P = TOPS.tank(c); P[0].leg = ['neon', c.color ?? 0x0c0a16, 0x3affd0, 5]; return P; },
  chaquetaNeon: c => { const P = TOPS.jacket(c); P[0].leg = ['neon', c.color ?? 0x14101e, c.accent ?? 0xff3a9a, 5]; return P; },
};
const BOTTOMS = {
  jeans: c => [{ pred: m => inT(m, -0.2, 0.075) || inL(m, 0.12, -0.955), inf: m => m.part === 0 ? 0.012 : 0.013 + 0.018 * clamp((-m.s - 0.55) / 0.4, 0, 1), color: c.color ?? 0x4a5f86, map: TX.denim }],
  jeansRips: c => BOTTOMS.jeans(c),
  plaid: c => [{ pred: m => inT(m, -0.2, 0.075) || inL(m, 0.12, -0.955), inf: m => m.part === 0 ? 0.013 : 0.014 + 0.008 * clamp((-m.s - 0.55) / 0.4, 0, 1), color: 0xffffff, map: c.color === undefined ? TX.plaid : plaidTex(c.color) }],
  pitillo: c => [{ pred: m => inT(m, -0.2, 0.08) || inL(m, 0.12, -0.955), inf: m => m.part === 0 ? 0.008 : 0.006, color: 0xffffff, map: sideStripeTex(c.color ?? 0x161616, c.color2 ?? 0xff4a9a) }],
  shortsF: c => [{ pred: m => inT(m, -0.2, 0.12) || inL(m, 0.12, -0.1), inf: m => m.part === 0 ? 0.008 : 0.009, color: c.color ?? 0x5a7ab0, map: TX.denim }],
  leatherPants: c => [{ pred: m => inT(m, -0.2, 0.075) || inL(m, 0.12, -0.955), inf: m => m.part === 0 ? 0.01 : 0.009, color: shade(c.color ?? 0x1a1a1e, 0.5) }],
  shorts: c => [{ pred: m => inT(m, -0.2, 0.075) || inL(m, 0.12, -0.3), inf: m => m.part === 0 ? 0.014 : 0.016 + 0.02 * clamp(-m.s / 0.3, 0, 1), color: c.color }],
  skirt: c => [{ pred: m => inT(m, -0.2, 0.04), inf: 0.006, color: shade(c.color ?? 0x161616, 0.6) }],
  skirtPlaid: c => BOTTOMS.skirt(c), mini: c => BOTTOMS.skirt(c),
  magma: c => [{ ...BOTTOMS.jeans(c)[0], map: null, leg: ['lava', c.color ?? 0x1c0f0a, 0xff6a1a, 8] }],
  tormenta: c => [{ ...BOTTOMS.leatherPants(c)[0], leg: ['electric', c.color ?? 0x10142a, 0x6ad8ff, 6] }],
  pitilloHolo: c => [{ ...BOTTOMS.pitillo(c)[0], map: null, leg: ['holo', c.color ?? 0xe0d8ff, 0xffffff, 6] }],
  faldaGalaxia: c => [{ pred: m => inT(m, -0.2, 0.04), inf: 0.006, color: 0x111111, leg: ['galaxy', c.color ?? 0x6a2ab8, 0x2ad8ff, 8] }],
  faldaFuego: c => [{ pred: m => inT(m, -0.2, 0.04), inf: 0.006, color: 0x111111, leg: ['fire', c.color ?? 0x2a0805, 0xffd040, 8] }],
  jeansGalaxia: c => [{ ...BOTTOMS.jeans(c)[0], map: null, leg: ['galaxy', c.color ?? 0x1a1050, 0x3ad8ff, 8] }],
};
const LEGWEAR = {
  stockings: c => [{ pred: m => inL(m, -0.16, -0.985), inf: 0.003, color: 0xffffff, map: stripeTex(c.a ?? cssC(c.color ?? 0x62e83c), c.b ?? cssC(c.color2 ?? 0x111111), 8, [1, 4]) }],
  red: c => [{ pred: m => inT(m, -0.2, 0.05) || inL(m, 0.12, -0.985), inf: 0.0025, color: c.color ?? 0x111111, map: fishnetTex(), sheer: true }],
  calcetas: c => [{ pred: m => inL(m, -0.5, -0.985), inf: 0.004, color: 0xffffff, map: kneeSockTex(c.color ?? 0xffffff, c.color2 ?? 0x111111) }],
  tights: c => [{ pred: m => inT(m, -0.2, 0.05) || inL(m, 0.12, -0.985), inf: 0.003, color: c.color ?? 0x161616 }],
  socks: c => [{ pred: m => inL(m, -0.84, -0.985), inf: 0.004, color: c.color ?? 0xffffff }],
  brillantina: c => [{ ...LEGWEAR.tights(c)[0], leg: ['glitter', c.color ?? 0x2a1640, 0xffc8f0, 1] }],
  redNeon: c => [{ ...LEGWEAR.red(c)[0], leg: ['neon', c.color ?? 0xff3a9a, 0x3ad8ff, 5] }],
  mediasRayo: c => [{ ...LEGWEAR.tights(c)[0], leg: ['electric', c.color ?? 0x10142a, 0x6ad8ff, 4] }],
};

/* ---------- tatuajes: diseños dibujados en un lienzo de 256 px (tinta + color de relleno) ---------- */
const TINK = '#1a1018';
const inkP = (g, p, fill, lw = 9) => { if (fill) { g.fillStyle = fill; g.fill(p); } g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = TINK; g.stroke(p); };
const TAT_DRAW = {
  calavera: (g, c) => {
    const p = new Path2D(); p.arc(128, 104, 72, Math.PI * 0.85, Math.PI * 0.15); p.lineTo(176, 168); p.lineTo(168, 206); p.lineTo(88, 206); p.lineTo(80, 168); p.closePath(); inkP(g, p, c);
    g.fillStyle = TINK; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 30, 118, 21, 24, s * 0.2, 0, 7); g.fill(); }
    g.beginPath(); g.moveTo(128, 140); g.lineTo(117, 163); g.lineTo(139, 163); g.closePath(); g.fill();
    g.lineWidth = 6; g.strokeStyle = TINK; for (const x of [106, 120, 136, 150]) { g.beginPath(); g.moveTo(x, 182); g.lineTo(x, 206); g.stroke(); }
    g.beginPath(); g.moveTo(92, 182); g.lineTo(164, 182); g.stroke();
  },
  llamas: (g, c) => {
    const flame = (x, w, h, col) => { const p = new Path2D(); p.moveTo(x - w, 240); p.bezierCurveTo(x - w * 1.3, 240 - h * 0.45, x - w * 0.1, 240 - h * 0.6, x + w * 0.15, 240 - h); p.bezierCurveTo(x + w * 0.2, 240 - h * 0.6, x + w * 1.3, 240 - h * 0.5, x + w, 240); p.closePath(); inkP(g, p, col, 7); };
    flame(80, 46, 150, c); flame(176, 46, 170, c); flame(128, 58, 225, c);
    flame(128, 28, 110, '#ffd23a'); flame(84, 20, 70, '#ffd23a'); flame(172, 20, 80, '#ffd23a');
  },
  tribal: (g, c) => {
    const blade = P => { const p = new Path2D(); p.moveTo(...P[0]); p.bezierCurveTo(...P[1], ...P[2], ...P[3]); p.bezierCurveTo(...P[4], ...P[5], ...P[0]); inkP(g, p, c, 3); };
    blade([[128, 18], [206, 70], [192, 156], [128, 238], [152, 150], [162, 82]]);
    blade([[128, 18], [50, 70], [64, 156], [128, 238], [104, 150], [94, 82]]);
    blade([[22, 120], [76, 84], [112, 108], [128, 132], [98, 124], [66, 112]]);
    blade([[234, 120], [180, 84], [144, 108], [128, 132], [158, 124], [190, 112]]);
  },
  serpiente: (g, c) => {
    const p = new Path2D(); p.moveTo(70, 238); p.bezierCurveTo(210, 200, 36, 146, 150, 112); p.bezierCurveTo(212, 92, 172, 54, 124, 54);
    g.lineCap = 'round'; g.lineWidth = 34; g.strokeStyle = TINK; g.stroke(p); g.lineWidth = 22; g.strokeStyle = c; g.stroke(p);
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.4)'; g.setLineDash([5, 10]); g.stroke(p); g.setLineDash([]);
    const h = new Path2D(); h.ellipse(106, 52, 27, 18, -0.2, 0, 7); inkP(g, h, c, 7);
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(98, 45, 5.5, 0, 7); g.fill(); g.fillStyle = TINK; g.fillRect(97, 41, 2.5, 8);
    g.strokeStyle = '#d8262b'; g.lineWidth = 4; g.beginPath(); g.moveTo(80, 58); g.lineTo(60, 64); g.lineTo(50, 58); g.moveTo(60, 64); g.lineTo(52, 72); g.stroke();
  },
  estrellas: (g, c) => {
    for (const [x, y, r] of [[128, 96, 64], [60, 196, 34], [196, 188, 28]]) { const p = new Path2D(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; k ? p.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : p.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } p.closePath(); inkP(g, p, c, 7); }
  },
  corazon: (g, c) => {
    const p = new Path2D(); p.moveTo(128, 222); p.bezierCurveTo(40, 160, 20, 100, 56, 64); p.bezierCurveTo(88, 34, 122, 52, 128, 82); p.bezierCurveTo(134, 52, 168, 34, 200, 64); p.bezierCurveTo(236, 100, 216, 160, 128, 222); p.closePath(); inkP(g, p, c);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(80, 90, 12, 22, -0.6, 0, 7); g.fill();
    const b = new Path2D(); b.moveTo(22, 122); b.lineTo(234, 122); b.lineTo(220, 142); b.lineTo(234, 162); b.lineTo(22, 162); b.lineTo(36, 142); b.closePath(); inkP(g, b, '#f4ecd8', 6);
    g.fillStyle = TINK; g.font = '34px Bangers, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ROCK', 128, 144);
  },
  rosa: (g, c) => {
    const leaf = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(30, -26, 70, 0); p.quadraticCurveTo(30, 26, 0, 0); inkP(g, p, '#3a9a3a', 6); g.restore(); };
    g.lineWidth = 9; g.strokeStyle = TINK; g.beginPath(); g.moveTo(128, 150); g.quadraticCurveTo(118, 200, 132, 242); g.stroke();
    leaf(126, 186, 0.45); leaf(130, 200, Math.PI - 0.5);
    const o = new Path2D(); o.arc(128, 100, 64, 0, 7); inkP(g, o, c);
    g.lineWidth = 6; g.strokeStyle = TINK; for (const [r, a0, a1] of [[46, 3.6, 6.9], [32, 0.4, 3.9], [19, 3.0, 6.3], [8, 0, 5]]) { g.beginPath(); g.arc(128, 100, r, a0, a1); g.stroke(); }
  },
  murcielago: (g, c) => {
    const p = new Path2D(); p.moveTo(116, 96); p.lineTo(120, 72); p.lineTo(128, 88); p.lineTo(136, 72); p.lineTo(140, 96);
    p.quadraticCurveTo(190, 66, 246, 86); p.quadraticCurveTo(222, 108, 228, 142); p.quadraticCurveTo(202, 124, 188, 152); p.quadraticCurveTo(170, 132, 150, 160); p.quadraticCurveTo(140, 172, 128, 190);
    p.quadraticCurveTo(116, 172, 106, 160); p.quadraticCurveTo(86, 132, 68, 152); p.quadraticCurveTo(54, 124, 28, 142); p.quadraticCurveTo(34, 108, 10, 86); p.quadraticCurveTo(66, 66, 116, 96); p.closePath(); inkP(g, p, c, 7);
    g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 8, 108, 4, 0, 7); g.fill(); }
  },
  golondrina: (g, c) => {
    const w2 = new Path2D(); w2.moveTo(118, 118); w2.quadraticCurveTo(90, 172, 38, 204); w2.quadraticCurveTo(100, 184, 142, 132); w2.closePath(); inkP(g, w2, c, 7);
    const body = new Path2D(); body.moveTo(58, 108); body.quadraticCurveTo(90, 84, 130, 110); body.quadraticCurveTo(172, 132, 216, 198); body.lineTo(186, 170); body.lineTo(196, 216); body.quadraticCurveTo(150, 162, 100, 148); body.quadraticCurveTo(64, 138, 58, 108); body.closePath(); inkP(g, body, c, 7);
    const belly = new Path2D(); belly.moveTo(74, 128); belly.quadraticCurveTo(110, 152, 152, 154); belly.quadraticCurveTo(110, 132, 90, 120); belly.closePath(); inkP(g, belly, '#f4ecd8', 4);
    const wing = new Path2D(); wing.moveTo(118, 116); wing.quadraticCurveTo(150, 38, 238, 28); wing.quadraticCurveTo(190, 80, 168, 132); wing.closePath(); inkP(g, wing, c, 7);
    g.fillStyle = '#d8262b'; g.beginPath(); g.arc(72, 114, 8, 0, 7); g.fill(); g.fillStyle = TINK; g.beginPath(); g.arc(78, 104, 4, 0, 7); g.fill();
    g.beginPath(); g.moveTo(60, 104); g.lineTo(40, 110); g.lineTo(60, 114); g.fill();
  },
  // legendarios: el relleno de color brilla y late (ver tatMat)
  dragon: (g, c) => {   // dragón enroscado con púas en el lomo y llamarada
    const B = [[40, 230], [230, 220], [230, 120], [130, 128], [40, 136], [40, 60], [150, 52]];
    const cub = (P0, P1, P2, P3, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * P0[k] + 3 * u * u * t * P1[k] + 3 * u * t * t * P2[k] + t * t * t * P3[k]); };
    const at = t => t < 0.5 ? cub(B[0], B[1], B[2], B[3], t * 2) : cub(B[3], B[4], B[5], B[6], t * 2 - 1);
    for (let k = 1; k < 14; k++) {
      const t = k / 14, p = at(t), q = at(t + 0.01), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, w = 20 - t * 8;
      const sp = new Path2D(); sp.moveTo(p[0] - dx / L * 9, p[1] - dy / L * 9); sp.lineTo(p[0] + dy / L * w * 1.5, p[1] - dx / L * w * 1.5); sp.lineTo(p[0] + dx / L * 9, p[1] + dy / L * 9); sp.closePath(); inkP(g, sp, '#ffd23a', 5);
    }
    const body = new Path2D(); body.moveTo(...B[0]); body.bezierCurveTo(...B[1], ...B[2], ...B[3]); body.bezierCurveTo(...B[4], ...B[5], ...B[6]);
    g.lineCap = 'round'; g.lineWidth = 38; g.strokeStyle = TINK; g.stroke(body); g.lineWidth = 26; g.strokeStyle = c; g.stroke(body);
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.45)'; g.setLineDash([4, 9]); g.stroke(body); g.setLineDash([]);
    const h = new Path2D(); h.moveTo(140, 36); h.lineTo(196, 40); h.lineTo(214, 56); h.lineTo(188, 62); h.lineTo(204, 74); h.lineTo(150, 74); h.closePath(); inkP(g, h, c, 7);
    const horn = new Path2D(); horn.moveTo(150, 40); horn.quadraticCurveTo(140, 10, 112, 8); horn.quadraticCurveTo(136, 22, 140, 44); inkP(g, horn, '#f4ecd8', 5);
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(172, 50, 5, 0, 7); g.fill(); g.fillStyle = TINK; g.fillRect(171, 46, 2.5, 8);
    const fl = new Path2D(); fl.moveTo(206, 62); fl.quadraticCurveTo(236, 50, 252, 66); fl.quadraticCurveTo(236, 70, 248, 84); fl.quadraticCurveTo(228, 80, 206, 70); fl.closePath(); inkP(g, fl, '#ff8a2a', 5);
  },
  fenix: (g, c) => {   // fénix con alas de fuego abiertas y cola de llamas
    const feather = (x0, y0, ang, len, w, col) => { g.save(); g.translate(x0, y0); g.rotate(ang); const p = new Path2D(); p.moveTo(0, 0); p.bezierCurveTo(w, -len * 0.3, w * 0.6, -len * 0.75, 0, -len); p.bezierCurveTo(-w * 0.2, -len * 0.7, -w * 0.9, -len * 0.35, 0, 0); inkP(g, p, col, 5); g.restore(); };
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) feather(128 + s * 14, 120, s * (0.55 + k * 0.28), 92 - k * 9, 26, k % 2 ? '#ffd23a' : c);
    for (let k = -2; k <= 2; k++) feather(128, 150, Math.PI + k * 0.28, 86 - Math.abs(k) * 10, 20, k % 2 ? c : '#ffd23a');
    const b = new Path2D(); b.ellipse(128, 128, 22, 34, 0, 0, 7); inkP(g, b, c, 7);
    const hd = new Path2D(); hd.arc(128, 86, 15, 0, 7); inkP(g, hd, c, 7);
    const bk = new Path2D(); bk.moveTo(122, 92); bk.lineTo(128, 108); bk.lineTo(134, 92); bk.closePath(); inkP(g, bk, '#ffd23a', 4);
    for (const s of [-1, 1]) feather(128 + s * 4, 74, s * 0.4, 30, 9, '#ffd23a');
    g.fillStyle = TINK; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 6, 84, 2.6, 0, 7); g.fill(); }
  },
  mariposaT: (g, c) => {   // mariposa con alas grandes y manchas claras
    const wing = (s, up) => { const p = new Path2D(); if (up) { p.moveTo(128, 120); p.bezierCurveTo(128 + s * 40, 30, 128 + s * 120, 20, 128 + s * 112, 80); p.bezierCurveTo(128 + s * 108, 112, 128 + s * 60, 124, 128, 124); } else { p.moveTo(128, 128); p.bezierCurveTo(128 + s * 90, 126, 128 + s * 100, 190, 128 + s * 66, 214); p.bezierCurveTo(128 + s * 40, 230, 128 + s * 14, 190, 128, 132); } p.closePath(); inkP(g, p, c, 7); };
    for (const s of [-1, 1]) { wing(s, true); wing(s, false); }
    for (const s of [-1, 1]) for (const [dx, y, r] of [[50, 70, 13], [76, 92, 7], [58, 176, 10]]) { const p = new Path2D(); p.arc(128 + s * dx, y, r, 0, 7); inkP(g, p, 'rgba(255,255,255,.9)', 4); }
    const bd = new Path2D(); bd.ellipse(128, 132, 9, 48, 0, 0, 7); inkP(g, bd, '#2a1a3a', 6);
    g.lineWidth = 5; g.strokeStyle = TINK; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128, 90); g.quadraticCurveTo(128 + s * 10, 52, 128 + s * 30, 44); g.stroke(); g.fillStyle = TINK; g.beginPath(); g.arc(128 + s * 30, 44, 5, 0, 7); g.fill(); }
  },
  lunaT: (g, c) => {   // luna creciente con estrellas en el hueco
    const t = document.createElement('canvas'); t.width = t.height = 256; const q = t.getContext('2d');
    q.fillStyle = TINK; q.beginPath(); q.arc(116, 128, 94, 0, 7); q.fill(); q.fillStyle = c; q.beginPath(); q.arc(116, 128, 86, 0, 7); q.fill();
    q.globalCompositeOperation = 'destination-out'; q.beginPath(); q.arc(160, 100, 74, 0, 7); q.fill();
    q.globalCompositeOperation = 'source-atop'; q.lineWidth = 9; q.strokeStyle = TINK; q.beginPath(); q.arc(160, 100, 78, 0, 7); q.stroke();
    q.fillStyle = 'rgba(255,255,255,.45)'; q.beginPath(); q.ellipse(56, 150, 9, 30, 0.3, 0, 7); q.fill();
    g.drawImage(t, 0, 0);
    for (const [x, y, r] of [[186, 92, 26], [214, 160, 15], [160, 136, 10]]) { const p = new Path2D(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q2 = k % 2 ? r * 0.45 : r; k ? p.lineTo(x + Math.cos(a) * q2, y + Math.sin(a) * q2) : p.moveTo(x + Math.cos(a) * q2, y + Math.sin(a) * q2); } p.closePath(); inkP(g, p, '#ffd23a', 5); }
  },
};
TAT_DRAW.calaveraFuego = (g, c) => {   // calavera de hueso envuelta en llamas (las llamas brillan)
  g.save(); g.translate(0, 8); TAT_DRAW.llamas(g, c); g.restore();
  g.save(); g.translate(128, 126); g.scale(0.72, 0.72); g.translate(-128, -128); TAT_DRAW.calavera(g, '#f4ecd8'); g.restore();
};
TAT_DRAW.rosaNeon = (g, c) => {   // rosa con destellos alrededor
  TAT_DRAW.rosa(g, c);
  for (const [x, y, r] of [[42, 46, 16], [214, 58, 12], [206, 170, 14], [50, 168, 10]]) { const p = new Path2D(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, q = k % 2 ? r * 0.3 : r; k ? p.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : p.moveTo(x + q, y); } p.closePath(); inkP(g, p, c, 4); }
};
const TAT_LEG = new Set(['dragon', 'fenix', 'mariposaT', 'lunaT', 'calaveraFuego', 'rosaNeon']);
const tatTex = (d, c) => cTex('tat' + d + c, () => canvasTex(256, 256, g => TAT_DRAW[d](g, cssC(c))));
const _tatM = {};
const tatMat = (d, c) => _tatM[d + c] || (_tatM[d + c] = (() => {
  const m = new THREE.MeshToonMaterial({ map: tatTex(d, c), gradientMap: GRAD_SOFT, transparent: true, alphaTest: 0.03, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  if (TAT_LEG.has(d)) {   // legendario: el color brilla con una onda que recorre el dibujo
    m.onBeforeCompile = sh => { sh.uniforms.uLT = LEG_T; sh.fragmentShader = 'uniform float uLT;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec4 tc = texture2D(map, vMapUv); float w = 0.5 + 0.5 * sin(uLT * 3.0 - vMapUv.y * 9.0); totalEmissiveRadiance += tc.rgb * tc.a * (0.6 + 2.2 * w); }'); };
    m.customProgramCacheKey = () => 'tatLeg';
  }
  return m;
})());
/* zonas del cuerpo: parte de la malla base, altura s, ángulo a (0 = adelante, + = izquierda del personaje), radio del dibujo */
const TAT_SPOT = {
  brazoI: { part: 1, s: -0.15, a: 1.35, R: 0.066 }, brazoD: { part: 2, s: -0.15, a: -1.35, R: 0.066 },
  antebrazoI: { part: 1, s: -0.47, a: 0.8, R: 0.046 }, antebrazoD: { part: 2, s: -0.47, a: -0.8, R: 0.046 },
  pecho: { part: 0, s: 0.43, a: 0.5, R: 0.07 }, espalda: { part: 0, s: 0.38, a: Math.PI, R: 0.11 }, cuello: { part: 0, s: 0.676, a: 1.35, R: 0.028 },
  manoI: { part: 1, s: -0.685, a: 1.57, R: 0.028 }, manoD: { part: 2, s: -0.685, a: -1.57, R: 0.028 },
  clavicula: { part: 0, s: 0.525, a: 0.45, R: 0.04 }, musloI: { part: 3, s: -0.3, a: 1.1, R: 0.065 }, musloD: { part: 4, s: -0.3, a: -1.1, R: 0.065 },
};
/* calcomanía: cáscara de la piel alrededor del punto elegido, con UV proyectadas en el plano tangente (arriba = hacia la cabeza) */
function tatCenter(src, S) {
  const P = src.geo.attributes.position, N = src.geo.attributes.normal; let best = 0, bd = 1e9;
  src.meta.forEach((m, i) => { if (m.part !== S.part) return; const d = (m.s - S.s) ** 2 + (wrapA(m.a - S.a) * 0.06) ** 2; if (d < bd) { bd = d; best = i; } });
  return { c: V().fromBufferAttribute(P, best), n: V().fromBufferAttribute(N, best).normalize() };
}
function decalGeo(src, S) {
  const P = src.geo.attributes.position, N = src.geo.attributes.normal, { c, n } = tatCenter(src, S);
  const e2 = V(0, 1, 0).addScaledVector(n, -n.y).normalize(), e1 = V().crossVectors(e2, n), R = S.R, inside = new Set(), pp = V(), nn = V();
  for (let i = 0; i < P.count; i++) { if (src.meta[i].part !== S.part) continue; pp.fromBufferAttribute(P, i); nn.fromBufferAttribute(N, i); if (pp.distanceTo(c) < R * 1.15 && nn.dot(n) > 0.15) inside.add(src.meta[i]); }
  const g = shellGeo(src, m => inside.has(m), 0.0016).geo, Q = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < Q.count; i++) { pp.fromBufferAttribute(Q, i).sub(c); uv.setXY(i, 0.5 + pp.dot(e1) / (2 * R), 0.5 + pp.dot(e2) / (2 * R)); }
  return g;
}

class Rocker {
  constructor(cfg, kind = 'guitar') {
    cfg = normalizeLook(cfg); this.cfg = cfg; this.kind = kind; this.seed = R() * 10;
    const fem = this.fem = cfg.body === 'f';
    const b = this.b = { ...BASE_BUILD[cfg.body], ...(cfg.build || {}) };
    const F = this.F = faceParams(cfg.body, cfg.face || {});
    const acc = cfg.acc || {}, hairCfg = cfg.hair || { style: 'bald', color: 0x222222 };
    const root = this.root = new THREE.Group(); this.base = V(); this.baseYaw = 0; this.side = 0;
    this.Lup = L_UP; this.Lfo = L_FO; this.Lth = L_TH; this.Lsh = L_SH;
    const shoeLeg = SHOE_LEG[cfg.shoes?.type], shoeT = shoeLeg ? shoeLeg[0] : cfg.shoes?.type || 'boot', shoeK = SHOE_KIND[shoeT] || 'boot';
    this.ankleH = shoeK === 'platform' ? 0.165 : 0.09;
    this.hipRest = 0.97 + (this.ankleH - 0.09);
    const sw = b.sw, hip = b.hip, waist = b.waist, chest = b.chest;

    /* ---------- esqueleto ---------- */
    const bone = (par, x, y, z) => { const o = new THREE.Bone(); o.position.set(x, y, z); if (par) par.add(o); return o; };
    const hips = bone(null, 0, this.hipRest, 0); root.add(hips);
    const spine = bone(hips, 0, 0.06, 0), chestB = bone(spine, 0, 0.3, 0), neck = bone(chestB, 0, 0.29, 0), head = bone(neck, 0, 0.09 + (b.neck ?? 0), 0.01), jaw = bone(head, 0, 0.117, -0.028);
    const ua = [], fa = [], th = [], sh = [];
    for (const s of [1, -1]) { const u = bone(chestB, s * sw * (b.shX ?? 0.95), 0.2 + (b.shY ?? 0), 0); ua.push(u); fa.push(bone(u, 0, -L_UP, 0)); const t = bone(hips, s * hip * 0.56, -0.02, 0); th.push(t); sh.push(bone(t, 0, -L_TH, 0)); }
    // manos: hueso de muñeca + 3 falanges por dedo (posiciones de reposo sacadas de la malla base)
    const src = this.src = buildBodySrc(fem, b, this.hipRest);
    const handB = [], fingB = [], twB = [];
    for (let i = 0; i < 2; i++) {
      const H = src.hand[i], tw = bone(fa[i], 0, -L_FO, 0), hb = bone(tw, 0, 0, 0); twB.push(tw); handB.push(hb); const fl = [];
      for (const J of H.fingers) { let par = hb, prev = H.wrist; const ch = []; for (const p of J) { const o = bone(par, p.x - prev.x, p.y - prev.y, p.z - prev.z); ch.push(o); par = o; prev = p; } fl.push(ch); }
      fingB.push(fl);
    }
    Object.assign(this, { hips, spine, chest: chestB, neck, head, jaw, ua, fa, th, sh, handB, fingB, twB });
    this.body = hips;
    const torso = this.torso = new THREE.Group(); torso.position.y = -0.3; chestB.add(torso);   // espacio "torso" clásico (hombros en y=0.5)
    const face = this.face = new THREE.Group(); face.position.y = 0.135; head.add(face);
    root.updateMatrixWorld(true);
    this.skel = new THREE.Skeleton([hips, spine, chestB, neck, head, jaw, ua[0], fa[0], ua[1], fa[1], th[0], sh[0], th[1], sh[1], ...[0, 1].flatMap(i => [twB[i], handB[i], ...fingB[i].flat()])]); this._I = new THREE.Matrix4();
    const faceBind = face.getWorldPosition(V());

    this.auraQ = [];   // auras legendarias: se crean al final, cuando todos los huesos están enlazados
    const M = this.M = {
      skin: toon(cfg.skin, { gradientMap: GRAD_SOFT }), skinD: toon(shade(cfg.skin, 0.8), { gradientMap: GRAD_SOFT }), hair: toon(hairCfg.color, { map: TX.hairStreak }), hairS: toon(hairCfg.color), hair2: toon(hairCfg.color2 || hairCfg.color),
      white: toon(0xf8f5ee), iris: toon(F.eyes || 0x3a2a18), pupil: new THREE.MeshBasicMaterial({ color: 0x050505 }), spec: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      brow: toon(F.brow ?? shade(hairCfg.color, 0.6)), metal: toon(0xc9ccd6), gold: toon(0xd9a63a), leather: toon(0x18141a),
      shoe: shoeLeg ? legMat(shoeLeg[1], cfg.shoes.color ?? 0x1a1a1a, shoeLeg[2], { scale: 16, side: THREE.FrontSide }) : toon(cfg.shoes?.color ?? 0x1a1a1a), sole: shoeLeg?.[1] === 'crystal' ? legMat('crystal', 0x9ad8ff, 0xffffff, { scale: 24, side: THREE.FrontSide }) : toon(shoeK === 'platform' ? 0x241a2e : shoeK === 'sneaker' ? 0xf2efe6 : 0x2a2a2a),
    };

    /* ---------- cuerpo + ropa (cáscaras de la malla base) ---------- */
    const pieces = [];
    const add = list => { if (list) pieces.push(...list); };
    add(TOPS[cfg.top?.type]?.(cfg.top)); add(BOTTOMS[cfg.bottom?.type]?.(cfg.bottom || {})); if (cfg.legwear) add(LEGWEAR[cfg.legwear.type]?.(cfg.legwear));
    const shC = cfg.shoes?.color ?? 0x1a1a1a, isLeg = m => m.part === 3 || m.part === 4, shL = shoeLeg ? [shoeLeg[1], shC, shoeLeg[2], 16] : null;
    // caña de la bota: sigue a la tibia (articula en el tobillo)
    if (shoeT === 'boot' || shoeT === 'chelsea') pieces.push({ pred: m => inL(m, -0.8, -0.995), inf: m => 0.014 + 0.006 * smooth(clamp((-m.s - 0.8) / 0.12, 0, 1)), color: shC, leg: shL });
    if (shoeT === 'chelsea') pieces.push({ pred: m => inL(m, -0.83, -0.99) && Math.abs(Math.sin(m.a)) > 0.78, inf: m => 0.0168 + 0.006 * smooth(clamp((-m.s - 0.8) / 0.12, 0, 1)), color: shade(shC, 0.4) });   // elástico lateral
    if (shoeT === 'tallboots') {   // botas hasta la rodilla con tres correas
      const tInf = m => 0.011 + 0.008 * smooth(clamp((m.s + 0.5) / 0.08, 0, 1)) + 0.004 * smooth(clamp((-m.s - 0.85) / 0.1, 0, 1));
      pieces.push({ pred: m => inL(m, -0.42, -0.995), inf: tInf, color: shC, leg: shL });
      for (const y of [-0.58, -0.7, -0.82]) pieces.push({ clip: m => isLeg(m) ? 0.011 - Math.abs(m.s - y) : -1, inf: m => tInf(m) + 0.0045, color: shade(shC, 0.45), leg: shoeLeg ? ['chrome', 0xc8ccd8, 0xffffff, 10] : null });
    }
    if (shoeT === 'hightops') {   // zapatillas de caña alta con borde acolchado
      pieces.push({ pred: m => inL(m, -0.82, -0.995), inf: m => 0.012 + 0.005 * smooth(clamp((-m.s - 0.82) / 0.1, 0, 1)), color: shC });
      pieces.push({ clip: m => isLeg(m) ? 0.012 - Math.abs(m.s + 0.832) : -1, inf: 0.0168, color: 0xf2efe6 });
    }
    // guantes (cada cuerpo tiene los suyos)
    const glT = cfg.gloves?.type && cfg.gloves.type !== 'none' ? cfg.gloves.type : null, glC = cfg.gloves?.color ?? 0x161616, isArm = m => m.part === 1 || m.part === 2;
    if (glT === 'sinDedos' || glT === 'tachas') pieces.push({ pred: m => (isArm(m) && m.s < -0.618) || (m.part >= 5 && m.t < 0.42), inf: 0.0028, color: glC });
    if (glT === 'completos') pieces.push({ pred: m => (isArm(m) && m.s < -0.6) || m.part >= 5, inf: 0.0028, color: glC });
    if (glT === 'mitones') { pieces.push({ pred: m => (isArm(m) && m.s < -0.628) || (m.part >= 5 && m.t < 0.3), inf: 0.0026, color: glC }); pieces.push({ pred: m => inA(m, -0.6, -0.638), inf: m => 0.009 + 0.0035 * Math.cos(m.a * 11), color: cfg.gloves.color2 ?? shade(glC, 3), sheer: true }); }   // volado de encaje
    if (glT === 'red') pieces.push({ pred: m => (isArm(m) && m.s < -0.42) || m.part >= 5, inf: 0.0022, color: glC, map: fishnetTex(), sheer: true });
    if (glT === 'largos') pieces.push({ pred: m => (isArm(m) && m.s < -0.22) || m.part >= 5, inf: 0.003, color: glC });
    const fullG = m => (isArm(m) && m.s < -0.6) || m.part >= 5;   // guantes legendarios
    if (glT === 'tesla') pieces.push({ pred: fullG, inf: 0.0028, color: glC, leg: ['electric', glC, 0x6ad8ff, 30] });
    if (glT === 'garrasMagma') pieces.push({ pred: fullG, inf: 0.0028, color: glC, leg: ['lava', glC, 0xff5a10, 34] });
    if (glT === 'guanteHolo') pieces.push({ pred: m => (isArm(m) && m.s < -0.22) || m.part >= 5, inf: 0.003, color: glC, leg: ['holo', glC, 0xffffff, 10] });
    if (glT === 'estelares') { pieces.push({ pred: m => (isArm(m) && m.s < -0.628) || (m.part >= 5 && m.t < 0.3), inf: 0.0026, color: glC, leg: ['galaxy', glC, 0x2ad8ff, 22] }); pieces.push({ pred: m => inA(m, -0.6, -0.638), inf: m => 0.009 + 0.0035 * Math.cos(m.a * 11), color: glC, sheer: true, leg: ['neon', 0xff7ac8, 0x4ad8ff, 30] }); }
    if (glT === 'cosmicos') pieces.push({ pred: fullG, inf: 0.0028, color: glC, leg: ['galaxy', glC, 0x3ad8ff, 26] });
    if (glT === 'guantesCristal') pieces.push({ pred: m => (isArm(m) && m.s < -0.22) || m.part >= 5, inf: 0.003, color: glC, leg: ['crystal', glC, 0xffffff, 12] });
    if (acc.warmers) pieces.push({ pred: m => inA(m, -0.36, -0.625), inf: 0.006, color: 0xffffff, map: stripeTex(acc.warmers[0], acc.warmers[1], 8, [1, 6]) });
    // prendas con recorte suave (clip): la cáscara incluye una franja de más y el shader corta el borde exacto; la piel solo se quita bien adentro
    const covered = m => pieces.some(p => !p.sheer && (p.clip ? p.clip(m) > 0.03 : p.pred(m)));   // las piezas transparentes (red, encaje) no quitan la piel
    for (const p of pieces) {
      const o = { side: THREE.DoubleSide }; if (p.map) o.map = p.map; if (p.sheer) o.alphaTest = 0.35;
      const mat = p.leg ? legMat(p.leg[0], p.leg[1] ?? p.color, p.leg[2], { scale: p.leg[3] ?? 8, map: p.map, alphaTest: p.sheer ? 0.35 : 0 }) : toon(p.color, o);
      const bm = x => fem && !p.leg ? bustMat(x, this.hipRest + 0.06, b.bust ?? 1) : x;
      if (p.clip) this.skin(shellGeo(src, m => p.clip(m) > -0.045, p.inf, false, p.clip).geo, bm(clipMat(mat)), 0.007);
      else this.skin(shellGeo(src, p.pred, p.inf).geo, bm(mat), p.sheer ? 0 : 0.007);
    }

    /* ---------- cabeza ---------- */
    const hs = this.hsrc = buildHeadSrc(fem, F, cfg, faceBind);
    const nsm = neckShadowMaterial(cfg.skin, hs); this.neckU = nsm.U; nsm.U.uSp.value = this.hipRest + 0.06; nsm.U.uBust.value = fem ? (b.bust ?? 1) : 0;
    this.skin(shellGeo(src, m => !covered(m), 0, true).geo, nsm.mat, 0.009);
    const fm = faceMaterial(fem, F, cfg, hs); this.faceU = fm.U; this.gaze = [V(), V()];
    this.skin(hs.geo, fm.mat, 0.008);
    for (const tt of cfg.tattoos || []) { const S = TAT_SPOT[tt.spot]; if (S && TAT_DRAW[tt.design]) this.skin(decalGeo(src, S), tatMat(tt.design, tt.color ?? 0x1a1420), 0); }
    // marcadores de cada zona de tatuaje (la cámara del editor apunta ahí)
    this.tatMk = {};
    for (const [k, S] of Object.entries(TAT_SPOT)) {
      const i = S.part - 1, bn = S.part === 0 ? (S.s > 0.6 ? neck : chestB) : S.part <= 2 ? (S.s > -0.33 ? ua[i] : S.s > -0.62 ? fa[i] : handB[i]) : th[S.part - 3];
      const mk = new THREE.Object3D(); mk.position.copy(bn.worldToLocal(tatCenter(src, S).c)); bn.add(mk); this.tatMk[k] = mk;
    }
    // barba (cáscaras de la cara: se mueven con la mandíbula)
    const bt0 = cfg.beard?.type, BL = BEARD_LEG[bt0], bt = BL ? 'full' : bt0, bM = BL ? legMat(BL[0], cfg.beard.color ?? 0xff4a10, BL[1], { scale: BL[2], map: TX.hairStreak, mat: { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 } }) : toon(shade(cfg.beard?.color ?? hairCfg.color, 1.35), { map: TX.hairStreak, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });   // un poco más claro: se ven las hebras; desplazada hacia la cámara para que el borde fino no parpadee
    // clip = distancia (m) al borde de la zona de vello; el grosor se afina hacia el borde para que se funda con la piel
    const beard = (clip, base, ol) => this.skin(shellGeo(hs, m => clip(m) > -0.006, m => base(m) * (0.45 + 0.55 * smooth(clamp(clip(m) / 0.007, 0, 1))), false, clip).geo, clipMat(bM), ol);
    const mustacheC = m => {   // más grueso al centro, se afina y cae en las comisuras
      const ax = Math.abs(m.X) / hs.mw, lo = hs.vm + 0.004 - 0.007 * smooth(clamp((ax - 0.65) / 0.45, 0, 1)), hi = hs.tY - 0.008 - 0.007 * ax * ax;
      return Math.min((m.nz - 0.4) * 0.05, hs.mw + 0.005 - Math.abs(m.X), m.Y - lo, hi - m.Y);
    };
    if (bt === 'goatee') { beard(m => Math.min((m.nz - 0.35) * 0.05, 0.021 - 0.005 * smooth(clamp((hs.vm - 0.03 - m.Y) / 0.05, 0, 1)) - Math.abs(m.X), (hs.vm - 0.009) - m.Y, m.Y + 0.14), m => 0.004 + 0.007 * smooth(clamp((hs.vm - 0.02 - m.Y) / 0.04, 0, 1)), 0.004); beard(mustacheC, () => 0.0035, 0.003); }
    if (bt === 'mustache') beard(mustacheC, () => 0.004, 0.003);
    if (bt === 'full') {   // barba completa: borde superior diagonal y dentado (pelo), hueco ovalado para la boca, más volumen en el mentón
      const mouthE = m => (Math.hypot(m.X / hs.mw, (m.Y - hs.vm + 0.001) / 0.0088) - 1) * 0.009;
      beard(m => Math.min((m.nz + 0.15) * 0.05, beardLine(hs, Math.abs(m.X)) + 0.0016 * Math.sin(Math.abs(m.X) * 950) - m.Y, (m.ny + 0.92) * 0.05, mouthE(m)), m => 0.005 + 0.011 * smooth(clamp((-0.05 - m.Y) / 0.07, 0, 1)), 0.005);
    }
    if (bt0 === 'barbaFuego') this.auraQ.push({ kind: BL[0], cols: [cfg.beard.color ?? 0xff4a10], a: cfg.beard.color ?? 0xff4a10, b: 0xffd040 });   // chispas que suben de la barba
    if (bt0 === 'escarcha') {   // dos trenzas de hielo con anillos de luz (en el hueso de la mandíbula: punto de la cara + (0, 0.018, 0.028))
      const iceM = legMat('crystal', cfg.beard.color ?? 0x8ad0ff, 0xffffff, { scale: 60, side: THREE.FrontSide }), ringM = legMat('neon', 0x6ad8ff, 0xffffff, { scale: 90 }), z0 = hs.frontZ(0.016, -0.11);
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
        const x = s * 0.016, y = -0.13 - k * 0.017, z = z0 - 0.004 - k * 0.003;
        mesh(this.jaw, G('braid', () => new THREE.SphereGeometry(0.0105, 10, 8).scale(1, 1.3, 0.85)), iceM, { pos: [x + s * 0.002 * (k % 2 ? 1 : -1), y + 0.018, z + 0.028], rot: [0, 0, k % 2 ? 0.35 : -0.35], outline: 0.0015 });
        if (k === 2 || k === 5) mesh(this.jaw, G('bring', () => new THREE.TorusGeometry(0.0105, 0.0028, 6, 16).rotateX(Math.PI / 2)), ringM, { pos: [x, y + 0.012, z + 0.028], outline: 0 });
      }
    }
    // orejas (los ojos y las cejas van pintados en el shader de la cara)
    for (const s of [-1, 1]) {
      const ex = s * 0.112;
      mesh(face, G('ear', () => new THREE.SphereGeometry(0.027, 14, 10).scale(0.36, 1, 0.7)), M.skin, { pos: [ex, -0.004, -0.012], rot: [0, s * -0.35, 0], outline: 0.004 });
      mesh(face, G('earIn', () => new THREE.SphereGeometry(0.016, 10, 8).scale(0.3, 1, 0.6)), M.skinD, { pos: [ex + s * 0.004, -0.004, -0.008], rot: [0, s * -0.35, 0], outline: 0 });
      const er = cfg.earrings?.type, eM = toon(cfg.earrings?.color ?? 0xc9ccd6), lob = [ex + s * 0.003, -0.031, -0.004], dang = () => mesh(face, G('echain', () => new THREE.CylinderGeometry(0.0009, 0.0009, 0.016, 4)), eM, { pos: [ex + s * 0.004, -0.039, -0.004], outline: 0 });
      if (er === 'argolla' && s < 0) mesh(face, G('ering', () => new THREE.TorusGeometry(0.011, 0.0025, 6, 14)), eM, { pos: lob, rot: [0, Math.PI / 2, 0], outline: 0 });
      if (er === 'arete') mesh(face, G('estud', () => new THREE.IcosahedronGeometry(0.0045, 0)), eM, { pos: [ex + s * 0.004, -0.027, -0.002], outline: 0.001 });
      if (er === 'cruz' && s < 0) { mesh(face, G('ering2', () => new THREE.TorusGeometry(0.006, 0.0015, 5, 10)), eM, { pos: lob, rot: [0, Math.PI / 2, 0], outline: 0 }); mesh(face, G('cross', () => mergeGeometries([new THREE.BoxGeometry(0.0035, 0.026, 0.0035), new THREE.BoxGeometry(0.0035, 0.0035, 0.015).translate(0, 0.004, 0)])), eM, { pos: [lob[0], -0.051, lob[2]], outline: 0.0012 }); }
      if (er === 'aros') mesh(face, G('hoopF', () => new THREE.TorusGeometry(0.021, 0.0018, 6, 28)), eM, { pos: [ex + s * 0.005, -0.051, -0.004], rot: [0, Math.PI / 2, 0], outline: 0.001 });
      if (er === 'estrellas') { dang(); mesh(face, G('estar', () => new THREE.ExtrudeGeometry(starShape(0, 0, 0.011, 0.0048), { depth: 0.002, bevelEnabled: false }).translate(0, 0, -0.001).rotateY(Math.PI / 2)), eM, { pos: [ex + s * 0.005, -0.056, -0.004], outline: 0.001 }); }
      const eL = (k, b2, sc = 160) => legMat(k, cfg.earrings?.color ?? 0xffffff, b2, { scale: sc, side: THREE.FrontSide });   // aros legendarios
      if (er === 'gemaSangre') { mesh(face, G('egem', () => new THREE.OctahedronGeometry(0.0072, 0).scale(1, 1.25, 0.75)), eL('crystal', 0xffd0d8), { pos: [ex + s * 0.005, -0.03, -0.002], outline: 0.001 }); mesh(face, G('egemS', () => new THREE.TorusGeometry(0.0078, 0.0012, 5, 14)), eL('chrome', 0xffffff, 300), { pos: [ex + s * 0.0045, -0.03, -0.002], rot: [0, Math.PI / 2, 0], outline: 0 }); }
      if (er === 'rayoArete' && s < 0) { mesh(face, G('ering2', () => new THREE.TorusGeometry(0.006, 0.0015, 5, 10)), eL('chrome', 0xffffff, 300), { pos: lob, rot: [0, Math.PI / 2, 0], outline: 0 }); mesh(face, G('ebolt', () => new THREE.ExtrudeGeometry(boltShape(0.034), { depth: 0.003, bevelEnabled: false }).translate(0, 0, -0.0015).rotateY(Math.PI / 2)), eL('electric', 0xffffff, 200), { pos: [lob[0] + s * 0.001, -0.054, lob[2]], outline: 0.001 }); }
      if (er === 'fugaces') { dang(); mesh(face, G('estarL', () => new THREE.ExtrudeGeometry(starShape(0, 0, 0.014, 0.006), { depth: 0.003, bevelEnabled: false }).translate(0, 0, -0.0015).rotateY(Math.PI / 2)), eL('glitter', 0xffffff), { pos: [ex + s * 0.005, -0.06, -0.004], outline: 0.001 }); mesh(face, G('estarS', () => new THREE.ExtrudeGeometry(starShape(0, 0, 0.007, 0.003), { depth: 0.002, bevelEnabled: false }).translate(0, 0, -0.001).rotateY(Math.PI / 2)), eL('glitter', 0xffffff), { pos: [ex + s * 0.006, -0.078, -0.012], outline: 0.001 }); }
      if (er === 'gotasDiamante') { mesh(face, G('echainL', () => new THREE.CylinderGeometry(0.0009, 0.0009, 0.028, 4)), eL('chrome', 0xffffff, 300), { pos: [ex + s * 0.004, -0.045, -0.004], outline: 0 }); mesh(face, G('dropL', () => new THREE.OctahedronGeometry(0.0085, 1).translate(0, -0.004, 0).scale(1, 1.9, 1)), eL('crystal', 0xffffff, 200), { pos: [ex + s * 0.005, -0.066, -0.004], outline: 0.001 }); }
      if (er === 'cruzFuego') { mesh(face, G('ering2', () => new THREE.TorusGeometry(0.006, 0.0015, 5, 10)), eL('chrome', 0xffffff, 300), { pos: lob, rot: [0, Math.PI / 2, 0], outline: 0 }); mesh(face, G('crossL', () => mergeGeometries([new THREE.BoxGeometry(0.0042, 0.03, 0.0042), new THREE.BoxGeometry(0.0042, 0.0042, 0.018).translate(0, 0.005, 0)])), legMat('fire', cfg.earrings?.color ?? 0x1a0805, 0xffe060, { scale: 200, side: THREE.FrontSide }), { pos: [lob[0], -0.054, lob[2]], outline: 0.0012 }); }
      if (er === 'corazonesNeon') { dang(); mesh(face, G('eheartN', () => new THREE.ExtrudeGeometry(heartShape(0.012), { depth: 0.003, bevelEnabled: false }).translate(0, 0, -0.0015).rotateY(Math.PI / 2)), eL('neon', 0xffffff, 200), { pos: [ex + s * 0.005, -0.058, -0.004], outline: 0.001 }); }
      if (er === 'gotas') { dang(); mesh(face, G('drop', () => new THREE.SphereGeometry(0.006, 10, 8).translate(0, -0.004, 0).scale(1, 1.6, 1)), eM, { pos: [ex + s * 0.005, -0.048, -0.004], outline: 0.001 }); }
    }

    /* ---------- peinado: mechones planos y facetados (estilo pintado) sobre un casquete que sigue el cráneo ---------- */
    const hair = this.hair = new THREE.Group(); face.add(hair); this.tails = [];
    const HL = LEG_HAIR[hairCfg.style], st = HL ? HL.base : hairCfg.style;   // los legendarios usan mechones de otro estilo (o propios) con material animado
    const capInf = (extra = 0) => m => 0.0045 + 0.009 * Math.max(0, m.ny) ** 1.5 + extra;
    const cap = (mat, extra = 0, tbl) => { const cl = m => m.ny - hairlineAt(m.ph, tbl); this.skin(shellGeo(hs, m => cl(m) > -0.06, capInf(extra), false, cl).geo, clipMat(mat), 0.008); };   // borde recortado suave (sin escalones)
    let HA = toon(hairCfg.color, { flatShading: true }), HB = toon(hairCfg.color2 || hairCfg.color, { flatShading: true }), HC = toon(shade(hairCfg.color, 0.8), { flatShading: true });
    if (HL) {
      const c1 = hairCfg.color, c2 = hairCfg.color2 ?? c1, o = { scale: HL.sc, k: HL.k ?? 1, flat: true, side: THREE.FrontSide };
      HA = legMat(HL.fx, c1, c2, o); HB = legMat(HL.fx, c2, c1, o); HC = legMat(HL.fx, shade(c1, 0.7), c2, o);
      M.hair = legMat(HL.fx, c1, c2, { scale: HL.sc, k: HL.k ?? 1, map: TX.hairStreak, side: THREE.FrontSide });
    }
    const HM = [HA, HB, HA, HC];
    const lock = (par, pts, w0, w1, mat, o = {}) => mesh(par, ribbonGeo(pts, w0, w1, o.th ?? 0.0095, o), mat, { outline: o.ol ?? 0.0042 });
    // mechón articulado: n huesos a lo largo de la curva; cada vértice se reparte entre los dos huesos más cercanos
    this.chains = [];
    const lockC = (par, pts, w0, w1, mat, o = {}) => {
      const n = o.n ?? 4, segs = o.segs ?? 14, geo = ribbonGeo(pts, w0, w1, o.th ?? 0.0095, { ...o, segs }), curve = new THREE.CatmullRomCurve3(pts), J = [];
      for (let k = 0; k <= n; k++) J.push(curve.getPointAt(k / n));
      const cnt = geo.attributes.position.count, si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
      for (let v = 0; v < cnt; v++) {
        const t = v < (segs + 1) * 6 ? Math.floor(v / 6) / segs : v === cnt - 2 ? 0 : 1, f = t * n;
        const lo = clamp(Math.floor(f - 0.5), 0, n - 1), hi = Math.min(lo + 1, n - 1), fr = hi === lo ? 0 : clamp(f - 0.5 - lo, 0, 1);
        si[v * 4] = lo; sw[v * 4] = 1 - fr; si[v * 4 + 1] = hi; sw[v * 4 + 1] = fr;
      }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      const bones = []; for (let k = 0; k < n; k++) { const b = new THREE.Bone(); b.position.copy(k ? J[k].clone().sub(J[k - 1]) : J[0]); (k ? bones[k - 1] : par).add(b); bones.push(b); }
      const m = new THREE.SkinnedMesh(geo, mat), ol = new THREE.SkinnedMesh(geo, outlineMat(o.ol ?? 0.0042)); m.frustumCulled = ol.frustumCulled = false; par.add(m, ol);
      this.chains.push({ par, bones, J, meshes: [m, ol], stiff: o.stiff ?? 10, W: J.map(() => V()), P: null, Pp: null });
    };
    // punto sobre el casquete: a = azimut (0 delante, + hacia la izquierda del personaje), e = elevación
    const sp = (a, e, k = 1) => V(Math.sin(a) * Math.cos(e) * 0.122 * k, Math.sin(e) * 0.15 * k, Math.cos(a) * Math.cos(e) * (Math.cos(a) > 0 ? 0.13 : 0.142) * k);
    const hang = (a, y, k) => V(Math.sin(a) * 0.128 * k, y, Math.cos(a) * (Math.cos(a) > 0 ? 0.13 : 0.145) * k);
    const R2 = rng(Math.floor(this.seed * 1000));
    const rv = (a, b) => lerp(a, b, R2());
    // flequillo recto en bloques, pegado a la frente
    const bangs = () => {
      for (let k = -4; k <= 4; k++) {
        const x = k * 0.0172, yEnd = 0.061 + (k & 1 ? 0.005 : 0) + rv(-0.002, 0.002) + Math.abs(k) * 0.0012, dz = k & 1 ? 0 : 0.004;
        const fz = (xx, yy, o) => hs.frontZ(xx, yy) + o + dz;
        lock(hair, [V(x * 0.5, 0.155, 0.03), V(x * 0.8, 0.14, fz(x * 0.8, 0.14, 0.018)), V(x * 0.95, 0.105, fz(x * 0.95, 0.105, 0.015)), V(x, yEnd, fz(x, yEnd, 0.011))], 0.025, 0.023, HM[(k + 4) % 4], { tip: 'blunt', th: 0.011 });
      }
    };
    // mechones laterales hasta la mandíbula
    const sideLocks = () => { for (const s of [-1, 1]) for (let k = 0; k < 2; k++)
      lockC(hair, [V(s * 0.06, 0.148, 0.07), V(s * 0.108, 0.09, 0.09 - k * 0.01), V(s * (0.126 + k * 0.01), 0.0, 0.072 - k * 0.015), V(s * (0.128 + k * 0.01), -0.08, 0.055 - k * 0.018), V(s * (0.122 + k * 0.012), -0.135 - k * 0.025, 0.042 - k * 0.02)], 0.046, 0.034, HM[k * 2 + 1], { n: 3, stiff: 18 }); };
    if (st === 'long') {
      cap(M.hair);
      for (let i = 0; i < 18; i++) {   // capa de abajo, larga
        const a = lerp(1.2, Math.PI * 2 - 1.2, i / 17) + rv(-0.05, 0.05), L = rv(0.4, 0.5);
        lockC(hair, [sp(a, 0.7, 1.0), sp(a, 0.2, 1.1), hang(a, -0.08, 1.13), hang(a, -0.22, 1.17), hang(a, -L, 1.12).add(V(0, 0, -0.03))], 0.056, 0.042, HM[i % 4], { n: 5, stiff: 14 });
      }
      for (let i = 0; i < 13; i++) {   // capa de encima, desde la coronilla
        const a = lerp(1.0, Math.PI * 2 - 1.0, i / 12) + rv(-0.05, 0.05), L = rv(0.28, 0.4);
        lockC(hair, [sp(a, 1.3, 1.02), sp(a, 0.6, 1.13), sp(a, 0.0, 1.22), hang(a, -0.14, 1.22), hang(a, -L, 1.2).add(V(0, 0, -0.02))], 0.062, 0.046, HM[(i + 1) % 4], { n: 5, stiff: 15 });
      }
      for (const s of [-1, 1]) lock(hair, [V(s * 0.004, 0.16, -0.01), V(s * 0.01, 0.152, 0.06), V(s * 0.035, 0.122, 0.112), V(s * 0.075, 0.08, 0.124), V(s * 0.112, 0.02, 0.108)], 0.045, 0.034, HB);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++)   // raya al medio y mechones que enmarcan la cara
        lockC(hair, [V(s * 0.006, 0.152, 0.045), V(s * (0.05 + k * 0.013), 0.14, 0.095 - k * 0.012), V(s * (0.098 + k * 0.01), 0.075, 0.104 - k * 0.014), V(s * (0.122 + k * 0.007), -0.04, 0.084 - k * 0.014), V(s * (0.13 + k * 0.007), -0.17 - k * 0.05, 0.055 - k * 0.012)], 0.042, 0.03, HM[k + 1], { n: 4, stiff: 16 });
    } else if (st === 'pigtails' || st === 'bob' || st === 'odango' || st === 'longF') {
      cap(M.hair, 0.003); bangs(); sideLocks();
      if (st === 'longF') {   // melena larga en dos capas que cae por la espalda + mechones delanteros
        for (let i = 0; i < 18; i++) {
          const a = lerp(1.25, Math.PI * 2 - 1.25, i / 17) + rv(-0.04, 0.04), L = rv(0.46, 0.56);
          lockC(hair, [sp(a, 0.7, 1.0), sp(a, 0.2, 1.1), hang(a, -0.08, 1.13), hang(a, -0.24, 1.15), hang(a, -L, 1.1).add(V(0, 0, -0.02))], 0.056, 0.04, HM[i % 4], { n: 5, stiff: 13 });
        }
        for (let i = 0; i < 12; i++) {
          const a = lerp(1.15, Math.PI * 2 - 1.15, i / 11) + rv(-0.04, 0.04), L = rv(0.3, 0.42);
          lockC(hair, [sp(a, 1.25, 1.02), sp(a, 0.55, 1.13), sp(a, 0.0, 1.2), hang(a, -0.14, 1.2), hang(a, -L, 1.17).add(V(0, 0, -0.015))], 0.06, 0.044, HM[(i + 1) % 4], { n: 5, stiff: 14 });
        }
        for (const s of [-1, 1]) for (let k = 0; k < 2; k++)
          lockC(hair, [V(s * (0.09 + k * 0.012), 0.11, 0.092 - k * 0.012), V(s * (0.126 + k * 0.01), 0.0, 0.078 - k * 0.012), V(s * (0.138 + k * 0.01), -0.12, 0.07 - k * 0.012), V(s * (0.145 + k * 0.012), -0.23 - k * 0.03, 0.075 - k * 0.015)], 0.042, 0.03, HM[k + 1], { n: 4, stiff: 15 });
      } else {
        // resto de la melena (corta bajo las coletas y los moños, a la altura de la mandíbula en el bob)
        const L = st === 'bob' ? 0.16 : st === 'odango' ? 0.075 : 0.1;
        for (let i = 0; i < 14; i++) {
          const a = lerp(1.25, Math.PI * 2 - 1.25, i / 13);
          lock(hair, [sp(a, 0.9, 1.02), sp(a, 0.3, 1.12), hang(a, -0.03, 1.16), hang(a, -L - rv(0, 0.015), 1.13)], 0.058, 0.05, HM[i % 4], { tip: st === 'bob' ? 'blunt' : 'point' });
        }
      }
      if (st === 'odango') for (const s of [-1, 1]) {   // moños: bola de mechones enrollados + aro de color + puntas sueltas
        const bn = new THREE.Group(); bn.position.set(s * 0.08, 0.142, -0.03); bn.rotation.z = -s * 0.5; hair.add(bn);
        mesh(bn, G('bun', () => new THREE.IcosahedronGeometry(0.052, 1).scale(1, 0.9, 1)), HA, { outline: 0.005 });
        for (let k = 0; k < 6; k++) {
          const a0 = k / 6 * Math.PI * 2, pts = [];
          for (let j = 0; j < 5; j++) { const an = a0 + j * 0.75, el = 1.25 - j * 0.5; pts.push(V(Math.cos(el) * Math.cos(an) * 0.056, Math.sin(el) * 0.056, Math.cos(el) * Math.sin(an) * 0.056)); }
          lock(bn, pts, 0.03, 0.02, HM[k % 4], { ctr: V(0, 0, 0), th: 0.008, ol: 0.003 });
        }
        mesh(bn, G('bunRing', () => new THREE.TorusGeometry(0.034, 0.0075, 6, 20).rotateX(Math.PI / 2)), toon(hairCfg.accent ?? 0xff4a9a), { pos: [0, -0.034, 0], outline: 0.003 });
        for (let j = 0; j < 3; j++) lockC(bn, [V((j - 1) * 0.012, -0.03, -0.02), V((j - 1) * 0.02, -0.08, -0.04), V((j - 1) * 0.025, -0.16, -0.035), V((j - 1) * 0.03, -0.24 - j * 0.02, -0.02)], 0.032, 0.024, HM[(j + 1) % 4], { ctr: V(0, -0.1, 0.1), n: 4, stiff: 10 });
        bn.userData = { s, k: 0.12 }; this.tails.push(bn);
      }
      if (st === 'pigtails') for (const s of [-1, 1]) {
        const pt = new THREE.Group(); pt.position.set(s * 0.085, 0.1, -0.03); hair.add(pt);
        mesh(pt, G('bauble', () => new THREE.SphereGeometry(0.038, 14, 10)), HL ? legMat('glitter', 0xffffff, hairCfg.color2 ?? 0xffffff, { side: THREE.FrontSide }) : toon(hairCfg.accent ?? 0xff9a1a), { outline: 0.005 });
        for (let j = 0; j < 6; j++) {   // coletas: cintas anchas que caen hasta el pecho
          const o = V(rv(-0.02, 0.02), 0, rv(-0.025, 0.025)), L = 0.5 + j * 0.02 + rv(0, 0.04);
          lockC(pt, [V(0, 0.01, 0), V(s * 0.05, 0.02, -0.03).add(o), V(s * 0.1, -0.06, -0.04).add(o), V(s * 0.13 + o.x, -0.2, -0.03 + o.z), V(s * 0.135 + o.x, -0.36, 0.0 + o.z), V(s * 0.125 + o.x, -L, 0.02)], 0.05, 0.038, HM[j % 4], { ctr: V(-s * 0.05, 0.05, 0), th: 0.011, n: 5, segs: 18, stiff: 9 + j * 0.6 });
        }
        for (const r2 of [-0.25, 0.25]) mesh(pt, taperTube([V(0, 0, 0.02), V(s * 0.03, -0.06, 0.04), V(s * (0.04 + r2 * 0.1), -0.16, 0.05), V(s * (0.03 + r2 * 0.15), -0.26, 0.04)], 0.006, 0.004, 10, 4, 0.3), HL ? legMat('neon', hairCfg.color2 ?? 0x3ad8ff, hairCfg.color, { scale: 60 }) : toon(hairCfg.ribbon ?? 0x42d64a), { outline: 0 });
        pt.userData = { s, k: 0.35 }; this.tails.push(pt);
      }
    } else if (st === 'ponytail') {
      cap(M.hair, 0.002); bangs();
      for (const s of [-1, 1]) lock(hair, [V(s * 0.04, 0.148, 0.09), V(s * 0.1, 0.09, 0.098), V(s * 0.124, 0.0, 0.075), V(s * 0.122, -0.09, 0.05)], 0.036, 0.026, HB);
      const pt = new THREE.Group(); pt.position.set(0, 0.085, -0.135); hair.add(pt);
      mesh(pt, G('tie', () => new THREE.TorusGeometry(0.022, 0.008, 6, 14)), toon(hairCfg.accent ?? 0x222222), { rot: [0.6, 0, 0], outline: 0.003 });
      for (let j = 0; j < 7; j++) { const o = V(rv(-0.025, 0.025), 0, rv(-0.015, 0.015)); lockC(pt, [V(0, 0, 0), V(o.x, 0.02, -0.05), V(o.x * 1.5, -0.08, -0.09 + o.z), V(o.x * 2, -0.25, -0.08 + o.z), V(o.x * 2, -0.38 - j * 0.015, -0.05)], 0.045, 0.034, HM[j % 4], { ctr: V(0, -0.1, 0.1), n: 4, stiff: 9 + j * 0.5 }); }
      this.tails.push(pt);
    } else if (st === 'mohawk') {
      { const cl = m => m.ny - hairlineAt(m.ph); this.skin(shellGeo(hs, m => cl(m) > -0.06, 0.0025, false, cl).geo, clipMat(M.skinD), 0.006); }
      const XL = hairCfg.style === 'trueno', nB = XL ? 11 : 9;   // la cresta de trueno es más alta y ancha
      for (let i = 0; i < nB; i++) {   // cresta de cuchillas facetadas
        const t2 = lerp(0.8, -1.55, i / (nB - 1)), len = XL ? 0.17 + Math.sin(i / (nB - 1) * Math.PI) * 0.2 : 0.13 + Math.sin(i / 8 * Math.PI) * 0.12;
        const bse = V(0, Math.cos(t2) * 0.148, Math.sin(t2) * 0.148), dir = V(0, Math.cos(t2 - 0.4), Math.sin(t2 - 0.4));
        lock(hair, [bse.clone().addScaledVector(dir, -0.02), bse.clone().addScaledVector(dir, len * 0.45), bse.clone().addScaledVector(dir, len)], XL ? 0.075 : 0.06, XL ? 0.045 : 0.04, HM[i % 4], { nrm: V(1, 0, 0), th: XL ? 0.013 : 0.01 });
      }
    } else if (st === 'spiky') {
      cap(M.hair, 0.004);
      for (let i = 0; i < 20; i++) {
        const a = R2() * Math.PI * 2, el = rv(0.15, 1.05);
        const d = V(Math.sin(a) * Math.sin(el), Math.cos(el), Math.cos(a) * Math.sin(el) * 0.9 - 0.15).normalize(), bse = d.clone().multiply(V(0.11, 0.14, 0.12));
        lock(hair, [bse.clone().addScaledVector(d, -0.01), bse.clone().addScaledVector(d, 0.05), bse.clone().addScaledVector(d, rv(0.09, 0.14)).add(V(0, 0.02, 0))], 0.05, 0.035, HM[i % 4], { nrm: V().crossVectors(d, V(0.3, 0.2, 1)).normalize(), th: 0.012 });
      }
    } else if (st === 'furia') {   // pelo de energía: puntas gruesas que se levantan hacia arriba y atrás + dos mechones sobre la frente
      cap(M.hair, 0.004);
      const spike = (bse, d, len, w, mat) => { const tA = V(d.z, 0, -d.x); if (tA.lengthSq() < 1e-6) tA.set(1, 0, 0); tA.normalize(); lock(hair, [bse.clone().addScaledVector(d, -0.015), bse.clone().addScaledVector(d, len * 0.5), bse.clone().addScaledVector(d, len)], w, w * 0.6, mat, { nrm: V().crossVectors(tA, d).normalize(), th: 0.016 }); };
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2 + rv(-0.08, 0.08), el = i % 3 === 0 ? rv(1.05, 1.35) : rv(0.45, 1.0), bse = sp(a, el, 0.96), rad = bse.clone().normalize(), front = Math.cos(a) > 0.5;
        const d = front ? rad.clone().multiplyScalar(0.35).add(V(0, 1, 0.05)).normalize() : rad.clone().multiplyScalar(0.55).add(V(0, 1, -0.32)).normalize();
        spike(bse, d, (front ? 0.13 : 0.18) + rv(0, 0.12) * (el > 1 ? 1.4 : 1), front ? 0.055 : 0.07, HM[i % 4]);
      }
      for (const s of [-1, 1]) spike(sp(s * 0.2, 1.05, 0.98), V(s * 0.25, -0.75, 0.62).normalize(), 0.14, 0.04, HB);
    } else if (st === 'short') {
      cap(M.hair, 0.004);
      for (let i = 0; i < 16; i++) {   // mechones cortos peinados hacia delante y a los lados
        const a = lerp(-2.6, 2.6, i / 15) + rv(-0.08, 0.08), e0 = rv(1.1, 1.35);
        lock(hair, [sp(a * 0.25, e0, 1.0), sp(a * 0.6, e0 - 0.3, 1.1), sp(a, e0 - 0.75, 1.12)], 0.05, 0.038, HM[i % 4], { th: 0.011 });
      }
    }
    if (HL) this.auraQ.push({ kind: HL.fx, cols: [hairCfg.color, hairCfg.color2 ?? hairCfg.color, shade(hairCfg.color, 0.7)], a: hairCfg.color, b: hairCfg.color2 ?? hairCfg.color, bolt: HL.aura === 'bolt' });   // aura del peinado legendario
    if (acc.sweatband) mesh(face, G('sband', () => new THREE.TorusGeometry(0.128, 0.016, 8, 30).scale(0.93, 1, 1.04).rotateX(Math.PI / 2 - 0.3)), toon(0xffffff), { pos: [0, 0.078, -0.008], outline: 0.004 });

    /* ---------- accesorios rígidos (atados a huesos) ---------- */
    const ring = (y, extra, r, mat, par, yl, tilt = 0) => { const [, w, kf, kb] = src.torsoAt(y); const pts = []; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a); pts.push(V((w + extra) * sa, yl + sa * tilt, ((ca > 0 ? w * kf : w * kb) + extra) * ca)); } return mesh(par, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 56, r, 6, true), mat, { outline: 0.003 }); };
    const SK = SKIRTS[cfg.bottom?.type], skirt = !!SK, pantsInf = skirt ? 0.028 : 0.016, bY = skirt ? 0.07 : 0.06;   // con falda, el cinturón marca dónde empieza
    if (cfg.belt && cfg.bottom?.type !== 'shorts') {
      const bw = 0.017, bInf = skirt ? 0.03 : 0.022, bc = m => m.part === 0 ? bw - Math.abs(m.s - bY) : -1;
      this.skin(shellGeo(src, m => bc(m) > -0.04, bInf, false, bc).geo, clipMat(toon(cfg.belt, { side: THREE.DoubleSide })), 0.004);
      mesh(hips, G('buckle', () => new THREE.BoxGeometry(0.046, 0.036, 0.008)), M.metal, { pos: [0, bY + 0.06, src.frontZ(bY) + bInf + 0.004], outline: 0.003 });
    }
    if (acc.bulletBelt) {
      const [, w, kf, kb] = src.torsoAt(-0.03); const bb = new Batch(); const bul = new THREE.CylinderGeometry(0.008, 0.008, 0.045, 6), tip = new THREE.ConeGeometry(0.008, 0.016, 6);
      ring(-0.03, 0.024, 0.016, M.leather, hips, 0.03, 0.05);
      for (let i = 0; i < 15; i++) { const a = (i / 14 - 0.5) * 2.2; const sa = Math.sin(a), ca = Math.cos(a); const x = (w + 0.03) * sa, z = (w * kf + 0.03) * ca, y = 0.03 + sa * 0.05; bb.add(M.gold, bul, [x, y, z], [0, -a, 0.35]); bb.add(M.metal, tip, [x - 0.008, y + 0.03, z], [0, -a, 0.35]); }
      bb.build(hips);
    }
    if (acc.chain) { const fz = src.frontZ(0.04) + 0.02; mesh(hips, taperTube([V(-0.06, 0.1, fz), V(-hip * 0.95, -0.02, fz * 0.6), V(-hip * 1.15, -0.07, 0.0), V(-hip * 0.95, 0.05, -src.backZ(0.0) - 0.01)], 0.005, 0.005, 20, 5), M.metal, { outline: 0.002 }); }
    if (SK) {
      // tiro alto: ajustada desde la cintura (s=0.085) hasta la cadera, luego se abre en tablas hasta el ruedo
      const GB = new GeoB(), NR = 14, NC = 64, S0 = 0.075, HL = SK.HL;
      GB.grid(NR + 1, NC, (r, j) => {
        const t = r / NR, sS = S0 - HL * t, a = j / NC * Math.PI * 2;
        const [bx, bz] = src.surfAt(Math.max(sS, -0.07), a), L = Math.hypot(bx, bz) || 1, f = smooth(clamp((-0.04 - sS) / 0.2, 0, 1));
        const rad = L + 0.016 + SK.flare * f, k = 1 + SK.pleat * Math.max(0, Math.cos(a * 16)) * f, x = bx / L * rad * k, z = bz / L * rad * k;
        const wt = 0.8 * smooth(clamp((-0.04 - sS) / 0.24, 0, 1)), pl = smooth(clamp(0.5 + x / 0.16, 0, 1)), W = new Map();
        for (const [bi, bw] of torsoW(sS, x, 0, sw)) W.set(bi, (W.get(bi) || 0) + bw * (1 - wt));
        W.set(B_TH[0], (W.get(B_TH[0]) || 0) + wt * pl); W.set(B_TH[1], (W.get(B_TH[1]) || 0) + wt * (1 - pl));
        GB.vert(x, this.hipRest + 0.06 + sS, z, j / NC, t, [...W], { t });
      });
      const sk = this.skin(GB.build().geo, SK.leg ? legMat(SK.leg[0], cfg.bottom.color ?? 0x6a2ab8, SK.leg[1], { scale: SK.leg[2] }) : SK.plaid ? toon(0xffffff, { side: THREE.DoubleSide, map: plaidTex(cfg.bottom.color ?? 0xb3242a, [8, 2]) }) : toon(cfg.bottom.color ?? 0x161616, { side: THREE.DoubleSide }), 0.008); sk.castShadow = true;
    }
    if (cfg.bottom?.rips || cfg.bottom?.type === 'jeansRips') for (const i of [0, 1]) mesh(th[i], G('rip', () => new THREE.SphereGeometry(0.03, 10, 8).scale(1, 0.6, 0.35)), M.skin, { pos: [i ? -0.01 : 0.01, -0.43, 0.074], outline: 0.003 });
    if (cfg.legwear?.type === 'stockings') for (const i of [0, 1]) mesh(th[i], G('ruffle', () => new THREE.TorusGeometry(0.09, 0.012, 6, 24).rotateX(Math.PI / 2)), toon(cfg.legwear.ruffle ?? cfg.legwear.color ?? 0x8af06a), { pos: [0, -0.165, 0.004], scale: [0.95, 1, 0.95], outline: 0.003 });
    const tt = cfg.top?.type;
    if (tt === 'leather' || tt === 'infernal') {
      const lz = y => src.frontZ(y) + 0.017, lapM = tt === 'infernal' ? legMat('lava', cfg.top.color ?? 0x1a0c08, 0xff5a10, { scale: 12 }) : null;
      for (const s of [-1, 1]) mesh(torso, G('lapel', () => new THREE.BoxGeometry(0.05, 0.24, 0.012)), lapM ?? toon(shade(cfg.top.color, 1.3)), { pos: [s * 0.08, 0.43, lz(0.43) - 0.004], rot: [-0.1, s * 0.25, s * 0.32], outline: 0.004 });
      mesh(torso, G('lcollar' + sw, () => new THREE.CylinderGeometry(0.085, 0.13, 0.1, 18, 1, true, Math.PI * 0.35, Math.PI * 1.3)), lapM ?? toon(shade(cfg.top.color, 1.3), { side: THREE.DoubleSide }), { pos: [0, 0.62, -0.01], outline: 0.004 });
      if (acc.studs) for (const s of [-1, 1]) for (let k = 0; k < 4; k++) mesh(torso, G('stud', () => new THREE.ConeGeometry(0.009, 0.02, 6)), M.metal, { pos: [s * (sw * 0.86 + k * 0.016), 0.59 - k * 0.004, -0.03 + k * 0.02], rot: [0, 0, -s * 0.4], outline: 0 });
    }
    if (tt === 'cromo') {   // hombreras cromadas con púas (siguen al brazo)
      const pM = legMat('chrome', cfg.top.color ?? 0x8a92a6, 0xffffff, { scale: 12 }), spM = legMat('chrome', 0xd8dce6, 0x9ae8ff, { scale: 30, side: THREE.FrontSide });
      for (let i = 0; i < 2; i++) {
        const s = i ? -1 : 1, pg = new THREE.Group(); pg.position.set(s * 0.012, 0.012, 0); pg.rotation.z = -s * 0.42; ua[i].add(pg);
        mesh(pg, G('pauld', () => new THREE.SphereGeometry(0.085, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.62, 1.08)), pM, { outline: 0.004 });
        mesh(pg, G('pauld2', () => new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.62, 1.08)), pM, { pos: [s * 0.012, -0.03, 0], outline: 0.003 });
        for (let k = 0; k < 3; k++) mesh(pg, G('pspike', () => new THREE.ConeGeometry(0.012, 0.05, 6)), spM, { pos: [0, 0.05, (k - 1) * 0.04], rot: [(k - 1) * 0.35, 0, 0], outline: 0.002 });
      }
    }
    if ((tt === 'jacket' || tt === 'chaquetaNeon') && cfg.top.accent) {
      const accM = tt === 'chaquetaNeon' ? legMat('neon', cfg.top.accent, 0xffffff, { scale: 30, side: THREE.DoubleSide }) : toon(cfg.top.accent, { side: THREE.DoubleSide });
      // cuello bebé: banda pegada a los hombros; adelante baja en dos solapas redondas con una muesca al centro
      const yTop = fem ? 0.638 : 0.628, cEdge = a => { const fr = Math.max(0, Math.cos(a)); const A = Math.abs(a); return (fem ? 0.606 : 0.582) - 0.064 * fr * (0.4 + 0.6 * smooth(clamp(A / 0.34, 0, 1))) * (1 - smooth(clamp((A - 0.45) / 1.0, 0, 1))); };
      const cc = m => m.part === 0 ? Math.min(m.s - cEdge(m.a), yTop - m.s) : -1;
      this.skin(shellGeo(src, m => cc(m) > -0.03, m => 0.019 + 0.004 * smooth(clamp(1 - (m.s - cEdge(m.a)) / 0.03, 0, 1)), false, cc).geo, clipMat(accM), 0.004);
      const bowM = toon(cfg.top.bow ?? 0x1a1030), bz = src.frontZ(0.53) + 0.02;
      mesh(torso, G('knot', () => new THREE.SphereGeometry(0.012, 8, 6)), bowM, { pos: [0, 0.53, bz], outline: 0.003 });
      for (const s of [-1, 1]) mesh(torso, G('ribbon', () => new THREE.BoxGeometry(0.012, 0.07, 0.005)), bowM, { pos: [s * 0.011, 0.49, bz - 0.004], rot: [-0.15, 0, s * 0.3], outline: 0.002 });
      for (let k = 0; k < 3; k++) { const y = 0.3 - k * 0.09; mesh(torso, G('button', () => new THREE.SphereGeometry(0.0085, 8, 6)), toon(cfg.top.buttons ?? 0xff7ac8), { pos: [0, y, src.frontZ(y) + 0.015], outline: 0.002 }); }
      const sEnd = Math.min(...src.meta.filter(m => m.part === 1 && m.s >= -0.607 && m.s <= -0.56).map(m => m.s));
      const cuffI = m => { const u = smooth(clamp((-m.s - 0.49) / (-0.49 - sEnd), 0, 1)); return 0.024 + 0.017 * u + 0.004 * u * Math.cos(m.a * 9); };   // se abre poco y ondula (volado)
      this.skin(shellGeo(src, m => inA(m, -0.49, sEnd), cuffI).geo, accM, 0.004);
      this.skin(shellGeo(src, m => inA(m, -0.53, sEnd), m => cuffI(m) - 0.006).geo, toon(shade(cfg.top.accent, 0.82), { side: THREE.DoubleSide }), 0);   // cara interior
      // borde enrollado: tubo que recorre el último anillo de la campana, con los mismos pesos de piel
      const P = src.geo.attributes.position, N = src.geo.attributes.normal, SI = src.geo.attributes.skinIndex, SW = src.geo.attributes.skinWeight;
      for (const part of [1, 2]) {
        const ring = []; src.meta.forEach((m, i) => { if (m.part === part && m.s === sEnd && !ring.some(r => Math.abs(src.meta[r].a - m.a) < 1e-4)) ring.push(i); });
        ring.sort((a, b) => src.meta[a].a - src.meta[b].a);
        const pos = [], si = [], sw = [], idx = [], RS = 6, n = ring.length;
        for (const i of ring) {
          const k = cuffI(src.meta[i]) - 0.002, c = V(P.getX(i), P.getY(i), P.getZ(i)).addScaledVector(V(N.getX(i), N.getY(i), N.getZ(i)), k), nn = V(N.getX(i), 0, N.getZ(i)).normalize();
          for (let j = 0; j < RS; j++) { const t = j / RS * Math.PI * 2; pos.push(c.x + nn.x * Math.cos(t) * 0.0055, c.y + Math.sin(t) * 0.0055, c.z + nn.z * Math.cos(t) * 0.0055); si.push(SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)); sw.push(SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)); }
        }
        for (let a = 0; a < n; a++) for (let j = 0; j < RS; j++) { const b = (a + 1) % n, A = a * RS + j, B = a * RS + (j + 1) % RS, C = b * RS + j, D = b * RS + (j + 1) % RS; idx.push(A, C, B, B, C, D); }
        const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); rg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); rg.setIndex(idx); rg.computeVertexNormals();
        this.skin(rg, accM, 0.003);
      }
    }
    /* collares: cadenas que siguen la superficie (alta detrás del cuello, caen adelante) o bandas ajustadas al cuello */
    const nk = cfg.necklace?.type && cfg.necklace.type !== 'none' ? cfg.necklace.type : null, nkM = toon(cfg.necklace?.color ?? 0xc9ccd6);
    const yAtR = (a, r) => { let lo = 0.5, hi = 0.66; for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (Math.hypot(...src.surfAt(mid, a)) > r) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const chainPts = front => {   // adelante baja sin abrirse hacia los hombros: mantiene la x del cuello y busca la superficie del pecho a esa x
      const pw = 2 / 2.3, cy = a => lerp(yAtR(a, 0.088), front, Math.max(0, Math.cos(a)) ** 1.6), pts = [];
      const chainAt = a => {
        const yb = yAtR(a, 0.088), y = cy(a), xb = src.surfAt(yb, a)[0];
        if (Math.cos(a) <= 0) return [xb, y, src.surfAt(y, a)[1]];
        const w = src.torsoAt(y)[1], sa = Math.sign(xb) * Math.min(1, (Math.abs(xb) / w) ** (1 / pw)), [x, z] = src.surfAt(y, Math.asin(sa));
        return [x, y, z];
      };
      for (let k = 0; k < 48; k++) { const [x, y, z] = chainAt(k / 48 * Math.PI * 2), L = Math.hypot(x, z) || 1; pts.push(V(x / L * (L + 0.007), y, z / L * (L + 0.007))); }
      return { pts, py: cy(0) };
    };
    const neckAt = (y, a, out) => { const [x, z] = src.surfAt(y, a), L = Math.hypot(x, z) || 1; return V(x / L * (L + out), y - 0.59, z / L * (L + out)); };   // en el espacio del hueso del cuello
    if (nk === 'colmillo' || nk === 'placas' || nk === 'corazon') {
      const { pts, py } = chainPts(nk === 'corazon' ? 0.53 : 0.515), fz = y => src.frontZ(y) + 0.011;
      mesh(torso, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 140, nk === 'placas' ? 0.0019 : 0.0026, 5, true), nkM, { outline: 0.0012 });
      mesh(torso, G('loop', () => new THREE.TorusGeometry(0.0055, 0.0016, 5, 12)), nkM, { pos: [0, py - 0.006, fz(py)], outline: 0 });
      if (nk === 'colmillo') mesh(torso, G('pend2', () => new THREE.ConeGeometry(0.011, 0.034, 4).rotateY(Math.PI / 4).scale(1, 1, 0.35)), toon(cfg.necklace.pendant ?? 0xf0e6cc), { pos: [0, py - 0.024, fz(py - 0.024)], rot: [-0.12, 0, Math.PI], outline: 0.0018 });
      if (nk === 'placas') for (const k of [0, 1]) mesh(torso, G('tag', () => new THREE.BoxGeometry(0.02, 0.033, 0.0025)), toon(cfg.necklace.pendant ?? 0xd2d5de), { pos: [k * 0.009 - 0.004, py - 0.025 - k * 0.006, fz(py - 0.025) + 0.002 + k * 0.002], rot: [-0.1, 0, k * 0.3 - 0.12], outline: 0.0015 });
      if (nk === 'corazon') mesh(torso, G('hpend', () => new THREE.ExtrudeGeometry(heartShape(0.016), { depth: 0.004, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2 })), toon(cfg.necklace.pendant ?? 0xff4a9a), { pos: [0, py - 0.026, fz(py - 0.026)], rot: [-0.12, 0, 0], outline: 0.0015 });
    }
    if (nk === 'perlas') { const curve = new THREE.CatmullRomCurve3(chainPts(0.545).pts, true), bb = new Batch(), pg = new THREE.SphereGeometry(0.0062, 8, 6), n = Math.floor(curve.getLength() / 0.0126); for (let k = 0; k < n; k++) { const q = curve.getPointAt(k / n); bb.add(nkM, pg, [q.x, q.y, q.z]); } bb.build(torso); }
    if (['colmilloFuego', 'amuleto', 'corazonCristal', 'lunaCollar', 'calaveraCr', 'mariposaCollar'].includes(nk)) {   // legendarios: cadena con brillo + dije animado
      const { pts, py } = chainPts(nk === 'corazonCristal' || nk === 'lunaCollar' || nk === 'mariposaCollar' ? 0.53 : 0.515), fz = y => src.frontZ(y) + 0.014, nC = cfg.necklace.color ?? 0xff6a1a;
      const chM = nk === 'colmilloFuego' ? legMat('chrome', 0x2a2a30, 0xff8a3a, { scale: 60 }) : nk === 'amuleto' ? legMat('chrome', 0xc9ccd6, 0x9ae8ff, { scale: 60 }) : nk === 'corazonCristal' || nk === 'mariposaCollar' ? legMat('glitter', 0xf0d8ff, 0xffffff) : nk === 'calaveraCr' ? legMat('chrome', 0x9aa0b0, 0xffffff, { scale: 60 }) : legMat('chrome', 0xd9a63a, 0xfff2a0, { scale: 60 });
      mesh(torso, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 140, 0.0027, 5, true), chM, { outline: 0.0012 });
      mesh(torso, G('loop', () => new THREE.TorusGeometry(0.0055, 0.0016, 5, 12)), chM, { pos: [0, py - 0.006, fz(py)], outline: 0 });
      const y1 = py - 0.03, pend = (geo, mat, o = {}) => mesh(torso, geo, mat, { pos: [0, y1, fz(y1) + 0.002], rot: [-0.12, 0, 0], outline: 0.0015, ...o });
      if (nk === 'colmilloFuego') { const fM = legMat('fire', nC, 0xffe060, { scale: 70 }); pend(G('dfang', () => new THREE.ConeGeometry(0.014, 0.05, 5).scale(1, 1, 0.45)), fM, { rot: [-0.12, 0, Math.PI], pos: [0, y1 - 0.008, fz(y1 - 0.008)] }); for (const s of [-1, 1]) mesh(torso, G('dfang2', () => new THREE.ConeGeometry(0.008, 0.026, 5).scale(1, 1, 0.45)), fM, { pos: [s * 0.022, py - 0.016, fz(py - 0.016)], rot: [-0.12, 0, Math.PI + s * 0.35], outline: 0.0012 }); }
      if (nk === 'amuleto') { pend(G('amu', () => new THREE.CylinderGeometry(0.024, 0.024, 0.006, 24).rotateX(Math.PI / 2)), legMat('electric', 0x10184a, nC, { scale: 70 })); pend(G('amuR', () => new THREE.TorusGeometry(0.024, 0.0025, 6, 28)), chM, { outline: 0.001 }); pend(G('amuB', () => new THREE.ExtrudeGeometry(boltShape(0.03), { depth: 0.002, bevelEnabled: false })), new THREE.MeshBasicMaterial({ color: new THREE.Color(nC).multiplyScalar(2.4) }), { pos: [0, y1, fz(y1) + 0.006], outline: 0 }); }
      if (nk === 'calaveraCr') {   // calavera cromada con ojos que brillan
        pend(G('skullP', () => new THREE.SphereGeometry(0.016, 14, 10).scale(1, 1.05, 0.7)), chM);
        mesh(torso, G('skullJ', () => new THREE.BoxGeometry(0.017, 0.01, 0.009)), chM, { pos: [0, y1 - 0.016, fz(y1 - 0.016) + 0.002], outline: 0.0012 });
        const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(nC).multiplyScalar(2.6) });
        for (const sx of [-1, 1]) mesh(torso, G('skullE', () => new THREE.SphereGeometry(0.0042, 8, 6)), eyeM, { pos: [sx * 0.0058, y1 + 0.001, fz(y1) + 0.0105], outline: 0 });
      }
      if (nk === 'mariposaCollar') {   // mariposa holográfica: dos pares de alas y cuerpo
        const W1 = new THREE.ExtrudeGeometry(shapeFrom(q => { q.moveTo(0, 0); q.bezierCurveTo(0.008, 0.022, 0.032, 0.028, 0.03, 0.007); q.bezierCurveTo(0.028, -0.003, 0.013, -0.002, 0.004, -0.001); q.bezierCurveTo(0.022, -0.006, 0.023, -0.026, 0.008, -0.021); q.bezierCurveTo(0.003, -0.016, 0.001, -0.008, 0, 0); }), { depth: 0.003, bevelEnabled: false }).translate(0, 0, -0.0015);
        pend(G('bflyW', () => mergeGeometries([W1, W1.clone().scale(-1, 1, 1)])), legMat('holo', nC, 0xffffff, { scale: 90, side: THREE.DoubleSide }));
        mesh(torso, G('bflyB', () => new THREE.CapsuleGeometry(0.003, 0.02, 3, 6)), toon(0x1a1030), { pos: [0, y1 - 0.002, fz(y1) + 0.004], outline: 0.001 });
      }
      if (nk === 'corazonCristal') pend(G('hpendL', () => new THREE.ExtrudeGeometry(heartShape(0.024), { depth: 0.006, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }).translate(0, 0, -0.003)), legMat('crystal', nC, 0xffffff, { scale: 90 }));
      if (nk === 'lunaCollar') { pend(G('moonP', () => new THREE.ExtrudeGeometry(crescentShape(0, 0, 0.026, -0.014, 0.008, 0.021), { depth: 0.005, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 1 }).translate(0, 0, -0.0025)), legMat('galaxy', nC, 0x2ad8ff, { scale: 90 })); for (const [x, y, r] of [[0.03, 0.014, 0.008], [-0.026, -0.012, 0.006]]) mesh(torso, G('mstar' + r, () => new THREE.ExtrudeGeometry(starShape(0, 0, r, r * 0.42), { depth: 0.002, bevelEnabled: false })), legMat('glitter', 0xffd23a, 0xffffff), { pos: [x, y1 + y, fz(y1 + y) + 0.003], outline: 0.001 }); }
    }
    if (nk === 'pinchos' || nk === 'choker' || nk === 'chokerTachas') {   // banda pegada al cuello (se deforma con él) + piezas rígidas en el hueso del cuello
      const y0 = fem ? 0.654 + (b.neck ?? 0) * 0.5 : 0.652, hw = nk === 'pinchos' ? 0.015 : 0.0105, bc = m => m.part === 0 ? hw - Math.abs(m.s - y0) : -1;
      this.skin(shellGeo(src, m => bc(m) > -0.03, 0.006, false, bc).geo, clipMat(toon(nk === 'choker' ? cfg.necklace.color ?? 0x161616 : 0x161214, { side: THREE.DoubleSide })), 0.003);
      const bb = new Batch();
      if (nk === 'pinchos') for (let k = 0; k < 11; k++) { const a = (k / 10 - 0.5) * 3.4, q = neckAt(y0, a, 0.006); bb.add(nkM, new THREE.ConeGeometry(0.0055, 0.016, 6), [q.x, q.y, q.z], [Math.cos(a) * Math.PI / 2, 0, -Math.sin(a) * Math.PI / 2]); }
      if (nk === 'chokerTachas') for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.8; if (Math.abs(a) < 0.2) continue; const q = neckAt(y0, a, 0.0062); bb.add(nkM, new THREE.SphereGeometry(0.0036, 6, 4), [q.x, q.y, q.z]); }
      bb.build(this.neck);
      const pf = neckAt(y0, 0, 0.0075);
      mesh(this.neck, G('oring', () => new THREE.TorusGeometry(0.0075, 0.0017, 5, 14)), nk === 'choker' ? M.metal : nkM, { pos: [pf.x, pf.y - 0.007, pf.z], outline: 0 });
      if (nk === 'choker') mesh(this.neck, G('hcharm', () => new THREE.ExtrudeGeometry(heartShape(0.008), { depth: 0.003, bevelEnabled: false })), toon(cfg.necklace.pendant ?? 0xff4a9a), { pos: [pf.x, pf.y - 0.02, pf.z], outline: 0.001 });
    }
    /* pulseras (no se ven bajo los puños de la chaqueta) */
    const brT = cfg.bracelets?.type && cfg.bracelets.type !== 'none' && !((tt === 'jacket' || tt === 'chaquetaNeon') && cfg.top.accent) ? cfg.bracelets.type : null, brC = cfg.bracelets?.color ?? 0x161616, brM = toon(brC);
    if (brT) for (const i of [0, 1]) {
      const bb = new Batch(), Y = -0.275, sd = i ? -1 : 1, ring = (n, r, fn) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; fn(a, Math.sin(a) * r, Math.cos(a) * r, k); } };
      const spike = (a, x, z, mat, geo) => bb.add(mat, geo, [x, Y, z], [Math.cos(a) * Math.PI / 2, 0, -Math.sin(a) * Math.PI / 2]);
      if (brT === 'tachas' || brT === 'cuero') mesh(fa[i], G('wrist' + brT, () => new THREE.CylinderGeometry(0.043, 0.045, brT === 'cuero' ? 0.07 : 0.05, 14).translate(0, Y, 0)), brM, { outline: 0.004 });
      if (brT === 'tachas') ring(8, 0.046, (a, x, z) => spike(a, x, z, M.metal, new THREE.ConeGeometry(0.006, 0.012, 5)));
      if (brT === 'cuero') { for (const dy of [-0.017, 0.017]) { bb.add(toon(shade(brC, 0.55)), new THREE.TorusGeometry(0.0465, 0.0035, 5, 20).rotateX(Math.PI / 2), [0, Y + dy, 0]); bb.add(M.metal, new THREE.BoxGeometry(0.004, 0.014, 0.012), [sd * 0.05, Y + dy, 0]); } }
      if (brT === 'cadena') ring(12, 0.045, (a, x, z, k) => bb.add(brM, new THREE.TorusGeometry(0.0065, 0.0018, 4, 8), [x, Y, z], k % 2 ? [Math.PI / 2, 0, 0] : [0, a, 0]));
      if (brT === 'aros') for (let k = 0; k < 3; k++) bb.add(k === 1 ? M.gold : brM, new THREE.TorusGeometry(0.0475, 0.0032, 5, 22).rotateX(Math.PI / 2 + (k - 1) * 0.12), [0, Y + 0.01 - k * 0.012, 0]);
      if (brT === 'perlas') ring(16, 0.047, (a, x, z) => bb.add(brM, new THREE.SphereGeometry(0.0058, 8, 6), [x, Y, z]));
      if (brT === 'puas') { mesh(fa[i], G('wristP', () => new THREE.CylinderGeometry(0.044, 0.045, 0.024, 14).translate(0, Y, 0)), toon(0x161214), { outline: 0.003 }); ring(8, 0.046, (a, x, z) => spike(a, x, z, brM, new THREE.ConeGeometry(0.0045, 0.016, 5))); }
      if (brT === 'magmaBr') { mesh(fa[i], G('wristM', () => new THREE.CylinderGeometry(0.045, 0.047, 0.075, 16).translate(0, Y, 0)), legMat('lava', brC, 0xff5a10, { scale: 50 }), { outline: 0.004 }); ring(8, 0.048, (a, x, z) => spike(a, x, z, legMat('chrome', 0x3a3a44, 0xff8a3a, { scale: 80 }), new THREE.ConeGeometry(0.006, 0.016, 5))); }
      if (brT === 'teslaBr') { mesh(fa[i], G('wristT', () => new THREE.CylinderGeometry(0.044, 0.045, 0.06, 14).translate(0, Y, 0)), legMat('electric', 0x10184a, brC, { scale: 80 }), { outline: 0.003 }); for (let k = 0; k < 4; k++) bb.add(legMat('chrome', 0x9aa0b0, 0xffffff, { scale: 80 }), new THREE.TorusGeometry(0.047, 0.0035, 6, 22).rotateX(Math.PI / 2), [0, Y + 0.024 - k * 0.016, 0]); }
      if (brT === 'diamanteBr') for (let k = 0; k < 3; k++) bb.add(legMat(k === 1 ? 'crystal' : 'glitter', brC, 0xffffff, { scale: 90 }), new THREE.TorusGeometry(0.0475, 0.0042, 6, 24).rotateX(Math.PI / 2 + (k - 1) * 0.12), [0, Y + 0.012 - k * 0.013, 0]);
      if (brT === 'galaxiaBr') { mesh(fa[i], G('wristG', () => new THREE.CylinderGeometry(0.045, 0.047, 0.07, 16).translate(0, Y, 0)), legMat('galaxy', brC, 0x3ad8ff, { scale: 50 }), { outline: 0.004 }); for (const dy of [-0.034, 0.034]) bb.add(legMat('chrome', 0xc9ccd6, 0xffffff, { scale: 80 }), new THREE.TorusGeometry(0.0475, 0.0032, 6, 22).rotateX(Math.PI / 2), [0, Y + dy, 0]); }
      if (brT === 'fuegoBr') for (let k = 0; k < 3; k++) bb.add(legMat('fire', brC, 0xffe060, { scale: 60 }), new THREE.TorusGeometry(0.047, 0.0045, 8, 26).rotateX(Math.PI / 2 + (k - 1) * 0.15), [0, Y + 0.012 - k * 0.012, 0]);
      if (brT === 'luzBr') for (let k = 0; k < 2; k++) bb.add(legMat('neon', brC, 0x4ad8ff, { scale: 60 }), new THREE.TorusGeometry(0.047, 0.005, 8, 26).rotateX(Math.PI / 2), [0, Y + 0.008 - k * 0.016, 0]);
      bb.build(fa[i]);
    }

    /* ---------- manos y pies ---------- */
    if ((cfg.nails || fem) && !['completos', 'largos', 'tesla', 'garrasMagma', 'guanteHolo'].includes(glT)) {   // uñas: óvalo plano sobre la última falange
      const nM = toon(cfg.nails ?? shade(cfg.skin, 1.12)), nG = G('nail', () => new THREE.SphereGeometry(1, 10, 6)), _m = new THREE.Matrix4();
      for (let i = 0; i < 2; i++) src.hand[i].tips.forEach((T, k) => {
        const g = nG.clone(); const ac = V().crossVectors(T.d, T.n);
        g.scale(T.r * 0.66, T.l * 0.3, T.r * 0.28).applyMatrix4(_m.makeBasis(ac, T.d, T.n));
        const J = src.hand[i].fingers[k][2]; mesh(fingB[i][k][2], g, nM, { pos: [T.p.x - J.x, T.p.y - J.y, T.p.z - J.z], outline: 0.0015 });
      });
    }
    if (glT === 'tachas') for (let i = 0; i < 2; i++) { const sd = i ? -1 : 1; for (let k = 0; k < 4; k++) mesh(fingB[i][k][0], G('kstud', () => new THREE.ConeGeometry(0.0042, 0.009, 6)), M.metal, { pos: [sd * 0.0118, -0.003, 0], rot: [0, 0, -sd * Math.PI / 2], outline: 0.0015 }); }
    if (glT === 'garrasMagma') {   // garras de metal en la punta de cada dedo
      const cM = legMat('chrome', 0x3a3a44, 0xff8a3a, { scale: 60, side: THREE.FrontSide }), _m = new THREE.Matrix4();
      for (let i = 0; i < 2; i++) src.hand[i].tips.forEach((T, k) => {
        const g = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0); g.scale(T.r * 0.7, 0.022, T.r * 0.55).applyMatrix4(_m.makeBasis(V().crossVectors(T.d, T.n), T.d, T.n));
        const J = src.hand[i].fingers[k][2]; mesh(fingB[i][k][2], g, cM, { pos: [T.p.x - J.x, T.p.y - J.y, T.p.z - J.z], outline: 0.0015 });
      });
    }
    if (glT === 'tesla') for (let i = 0; i < 2; i++) { const sd = i ? -1 : 1; for (let k = 0; k < 4; k++) mesh(fingB[i][k][0], G('tstud', () => new THREE.SphereGeometry(0.0045, 8, 6)), legMat('neon', 0x6ad8ff, 0xffffff, { scale: 80 }), { pos: [sd * 0.0118, -0.003, 0], outline: 0.001 }); }
    this.arms = [0, 1].map(i => ({ hand: { g: handB[i], fingers: fingB[i] }, elbow: V(), wrist: V(), side: i === 0 ? 1 : -1 }));
    this.tgt = [new THREE.Object3D(), new THREE.Object3D()];
    const weltM = shoeLeg ? new THREE.MeshBasicMaterial({ color: new THREE.Color(({ lava: 0xff6a1a, chrome: 0x9ae8ff, crystal: 0xbfe8ff })[shoeLeg[1]] ?? 0xff9ae8).multiplyScalar(2.2) }) : null;   // vivo de la suela que brilla
    this.legs = [0, 1].map(i => {
      const side = i === 0 ? 1 : -1;
      const foot = new THREE.Group(); root.add(foot);
      mesh(foot, G('shoe' + shoeK, () => shoeGeo(shoeK)), M.shoe, { outline: 0.007, shadow: true });
      mesh(foot, G('sole' + shoeK, () => soleGeo(shoeK)), M.sole, { outline: 0.006 });
      mesh(foot, G('welt' + shoeK, () => weltGeo(shoeK)), weltM ?? toon(cfg.shoes?.trim ?? (shoeK === 'boot' ? 0x6b4a2c : shoeK === 'sneaker' ? 0xd8262b : 0x42d64a)), { outline: 0 });
      // punto de reposo de la superficie de la pierna → espacio del hueso de la tibia
      const legPt = (s0, a, out) => { let bi = 0, bd = 1e9; src.meta.forEach((m, k) => { if (m.part !== 3 + i) return; const d = (m.s - s0) ** 2 + (wrapA(m.a - a) * 0.05) ** 2; if (d < bd) { bd = d; bi = k; } }); const P = src.geo.attributes.position, N = src.geo.attributes.normal; return sh[i].worldToLocal(V().fromBufferAttribute(P, bi).addScaledVector(V().fromBufferAttribute(N, bi), out)); };
      if (shoeT === 'chelsea') mesh(sh[i], G('ptab', () => new THREE.BoxGeometry(0.024, 0.04, 0.005)), toon(shade(shC, 0.6)), { pos: legPt(-0.8, Math.PI, 0.02).toArray(), outline: 0.002 });
      if (shoeT === 'hightops') mesh(sh[i], G('hstar', () => new THREE.ExtrudeGeometry(starShape(0, 0, 0.022, 0.009), { depth: 0.003, bevelEnabled: false }).rotateY(Math.PI / 2)), toon(new THREE.Color(cfg.ui || '#ffffff').getHex()), { pos: legPt(-0.91, side * Math.PI / 2, 0.018).toArray(), rot: [0, side > 0 ? 0 : Math.PI, 0], outline: 0.0015 });
      if (shoeT === 'tallboots') for (const y of [-0.58, -0.7, -0.82]) mesh(sh[i], G('tbuck', () => new THREE.BoxGeometry(0.006, 0.022, 0.018)), M.metal, { pos: legPt(y, side * Math.PI / 2, 0.02).toArray(), outline: 0.0015 });
      if (shoeT === 'boot') for (let k = 0; k < 3; k++) { const z = 0.03 + k * 0.032, y = -0.008 - k * 0.013; for (const s2 of [-1, 1]) mesh(foot, G('lace' + s2, () => new THREE.BoxGeometry(0.044, 0.005, 0.008).rotateY(s2 * 0.5)), toon(0x8a6a44), { pos: [0, y, z], rot: [0.55, 0, 0], outline: 0 }); for (const s2 of [-1, 1]) mesh(foot, G('eyelet', () => new THREE.SphereGeometry(0.0045, 6, 4)), M.metal, { pos: [s2 * 0.024, y - 0.002, z], outline: 0 }); }
      if (cfg.shoes?.type === 'botasCromo') for (let k = 0; k < 2; k++) mesh(foot, G('hspike', () => new THREE.ConeGeometry(0.009, 0.03, 6)), M.shoe, { pos: [0, -0.035 + k * 0.026, -0.085], rot: [-Math.PI / 2, 0, 0], outline: 0.002 });
      if (cfg.shoes?.type === 'botasInfierno' && i === 0) this.auraQ.push({ kind: 'lava', cols: [shC], a: 0xff5a10, b: 0xffd040 });   // brasas en los tobillos
      if (shoeK === 'sneaker') { mesh(foot, G('toecap', () => new THREE.SphereGeometry(0.05, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.55, 0.9)), M.sole, { pos: [0, -0.07, 0.15], outline: 0.004 }); for (let k = 0; k < 3; k++) mesh(foot, G('lace', () => new THREE.BoxGeometry(0.05, 0.006, 0.01)), M.sole, { pos: [0, -0.012 - k * 0.012, 0.045 + k * 0.03], rot: [0.5, 0, 0], outline: 0 }); }
      if (shoeT === 'platform') { mesh(foot, G('pstrap', () => new THREE.TorusGeometry(0.052, 0.008, 6, 18).scale(1, 1, 1.1).rotateX(1.1)), M.shoe, { pos: [0, -0.045, 0.05], outline: 0.003 }); mesh(foot, G('pbtn', () => new THREE.SphereGeometry(0.008, 8, 6)), M.metal, { pos: [0.052, -0.04, 0.05], outline: 0 }); }
      const ft = V(side * 0.21, this.ankleH, side > 0 ? 0.08 : -0.05);
      return { foot, knee: V(), ankle: V(), ft, cur: ft.clone(), yaw: side * 0.28, side };
    });
    this.poleMk = [new THREE.Object3D(), new THREE.Object3D()]; this.poleMk[0].position.set(sw + 0.45, 0.1, -0.4); this.poleMk[1].position.set(-sw - 0.35, 0.55, 0.22); torso.add(...this.poleMk);   // codo de la púa alto y atrás: el antebrazo pasa por encima del borde de la guitarra

    /* ---------- extras según el papel ---------- */
    if (kind === 'guitar') {
      const gt = this.gtr = makeGuitar(cfg.guitar);
      const vx = ({ vee: 0.06, explorer: 0.04, hacha: 0.05, rayoG: 0.05, mariposa: 0.03, luna: 0.02 })[cfg.guitar.type] ?? 0;
      this.gBase = { x: -0.09 + vx, y: 0.08, z: src.frontZ(0.08) + 0.1 + (SK ? 0.01 : 0), rx: -0.1, ry: -0.38, rz: 0.42 };
      gt.g.position.set(this.gBase.x, this.gBase.y, this.gBase.z); gt.g.rotation.set(this.gBase.rx, this.gBase.ry, this.gBase.rz); gt.g.scale.setScalar(0.9); torso.add(gt.g); gt.g.updateMatrix();
      const tb = V(gt.T.tailBtn[0], gt.T.tailBtn[1], -0.02).applyMatrix4(gt.g.matrix), hb = V(gt.T.hornBtn[0], gt.T.hornBtn[1], -0.02).applyMatrix4(gt.g.matrix);
      const ti = ['leather', 'jacket', 'infernal', 'cromo'].includes(tt) ? 0.02 : 0.01;
      const strap = [hb, V(sw * 0.5, 0.44, src.frontZ(0.44) + (fem ? BUST.h * (b.bust ?? 1) * bustZ(sw * 0.5, 0.44) : 0) + ti + 0.012), V(sw * 0.78, fem ? 0.632 : 0.6, 0.0), V(sw * 0.55, 0.5, -src.backZ(0.5) - ti), V(-0.04, 0.28, -src.backZ(0.28) - ti), V(-waist * 1.1, 0.08, -src.backZ(0.08) * 0.6), tb];
      mesh(torso, taperTube(strap, 0.024, 0.024, 40, 6, 0.22), M.leather, { outline: 0.003 });
      mesh(this.arms[1].hand.g, G('plectrum', () => new THREE.CylinderGeometry(0.013, 0.013, 0.002, 3).rotateX(Math.PI / 2)), toon(new THREE.Color(cfg.ui || '#ffffff').getHex()), { pos: [0.014, -0.088, 0.03], rot: [0, 0, Math.PI / 2], outline: 0.002 });
      this.ovS = new THREE.Object3D(); this.ovF = new THREE.Object3D(); torso.add(this.ovS, this.ovF);
    } else if (kind === 'singer') {
      torso.add(this.tgt[0]); this.tgt[0].position.set(0.35, 0.55, 0.4); torso.add(this.tgt[1]);
    } else if (kind === 'drummer') {
      root.add(this.tgt[0], this.tgt[1]);
      for (const A of this.arms) mesh(A.hand.g, G('stick', () => new THREE.CylinderGeometry(0.008, 0.011, 0.42, 6).translate(0, 0.21, 0)), toon(0xe9cf9a), { pos: [-A.side * 0.022, -0.1, -0.06], rot: [Math.PI / 2 + 0.25, 0, 0], outline: 0.004 });
      this.hipRest = 0.62; this.handPtr = [0, 0];
      for (const L of this.legs) { L.ft.set(L.side * 0.24, this.ankleH, 0.42); L.cur.copy(L.ft); }
    }
    root.scale.setScalar(b.height ?? 1);
    root.updateMatrixWorld(true);
    /* todos los mechones en UN solo esqueleto (índices desplazados): 1 subida de huesos a la GPU por personaje en vez de una por mechón */
    if (this.chains.length) {
      const all = []; for (const c of this.chains) { const off = all.length, si = c.meshes[0].geometry.attributes.skinIndex; if (off) { for (let i = 0; i < si.array.length; i++) si.array[i] += off; si.needsUpdate = true; } all.push(...c.bones); }
      this.chainSk = new THREE.Skeleton(all); for (const c of this.chains) for (const m of c.meshes) m.bind(this.chainSk);
    }
    for (const q of this.auraQ) {   // aura: copia inflada de cada malla del objeto legendario (mismo esqueleto)
      const list = []; root.traverse(o => { const L = o.isMesh && !o.material?.userData?.ol && o.material?.userData?.legArgs; if (L && L[0] === q.kind && q.cols.includes(L[1])) list.push(o); });
      const mat = auraMat(q.a, q.b, q.bolt);
      for (const S of list) {
        const A = S.isSkinnedMesh ? new THREE.SkinnedMesh(S.geometry, mat) : new THREE.Mesh(S.geometry, mat);
        A.position.copy(S.position); A.quaternion.copy(S.quaternion); A.scale.copy(S.scale); A.frustumCulled = false; A.renderOrder = 6; S.parent.add(A);
        if (S.isSkinnedMesh) A.bind(S.skeleton, S.bindMatrix);
      }
    }
    this.p = { ...POSE0 }; this.moves = []; this.hs = { hw: 0, hv: 0, hz: 0, hzv: 0, tw: 0, tv: 0, tz: 0, tzv: 0, y: 0, yv: 0 };
    this.st = { strumT: -9, strumDir: 1, strumAmp: 0.07, fret: 5, fx: fretX(5), I: 0.5, conf: 0, blinkAt: 2, blinkT: -9, mouthS: 0, riffPtr: 0, sustainEnd: 0, bend: -9 };
  }
  skin(geo, mat, outline = 0.008) {
    const m = new THREE.SkinnedMesh(geo, mat); m.frustumCulled = false; m.castShadow = true; this.root.add(m); m.bind(this.skel, this._I);
    if (outline > 0) { const o = new THREE.SkinnedMesh(geo, outlineMat(outline, !!geo.attributes.olw, !!geo.attributes.clp)); o.frustumCulled = false; this.root.add(o); o.bind(this.skel, this._I); }
    return m;
  }
  /* física de mechones: la raíz sigue a la cabeza; cada articulación tiene inercia, algo de gravedad y vuelve a su forma (memoria);
     no entran en la cabeza. Los huesos se orientan hacia las partículas */
  simHair(dt) {
    if (!this.chains?.length || dt <= 0) return;
    const h = Math.min(dt, 1 / 30), dmp = Math.pow(0.8, h * 60), head = this.face.getWorldPosition(_hh), R = 0.118 * this.root.scale.x;
    for (const c of this.chains) {
      const n = c.bones.length, W = c.W, P0 = c.P;
      c.par.updateWorldMatrix(true, false);
      for (let k = 0; k <= n; k++) W[k].copy(c.J[k]).applyMatrix4(c.par.matrixWorld);
      if (!P0 || P0[0].distanceToSquared(W[0]) > 0.09) { c.P = W.map(v => v.clone()); c.Pp = W.map(v => v.clone()); }
      const P = c.P, Pp = c.Pp; P[0].copy(W[0]); Pp[0].copy(W[0]);
      for (let k = 1; k <= n; k++) {
        _hv.subVectors(P[k], Pp[k]).multiplyScalar(dmp); Pp[k].copy(P[k]); P[k].add(_hv); P[k].y -= 1.2 * h * h;
        P[k].lerp(W[k], Math.min(1, c.stiff * h * (1 - 0.45 * (k - 1) / n)));
      }
      for (let it = 0; it < 2; it++) for (let k = 1; k <= n; k++) {
        const L = W[k].distanceTo(W[k - 1]); _hv.subVectors(P[k], P[k - 1]); P[k].copy(P[k - 1]).addScaledVector(_hv, L / (_hv.length() || 1));
        _hv.subVectors(P[k], head); const d = _hv.length(); if (d < R && W[k].distanceTo(head) >= R) P[k].copy(head).addScaledVector(_hv, R / (d || 1));
      }
      c.par.getWorldQuaternion(_hq); _hq2.copy(_hq);
      for (let k = 0; k < n; k++) {
        _hd1.subVectors(W[k + 1], W[k]).normalize(); _hd2.subVectors(P[k + 1], P[k]).normalize();
        _hq3.setFromUnitVectors(_hd1, _hd2).multiply(_hq);
        c.bones[k].quaternion.copy(_hq2).invert().multiply(_hq3); _hq2.copy(_hq3);
      }
    }
  }
  dispose() { this.chainSk?.dispose(); this.root.traverse(o => { if (o.geometry && !Object.values(geoCache).includes(o.geometry)) o.geometry.dispose(); }); this.faceU?.uFaceTex.value.userData.glow?.dispose(); this.faceU?.uFaceTex.value.dispose(); this.root.removeFromParent(); }
  /* dedos: flexión en las 3 falanges (hacia la palma), separación al abrir; el pulgar se opone y se dobla */
  setHand(i, pose, extra = 0) {
    const H = HAND_POSES[pose], F = this.arms[i].hand.fingers, s = this.arms[i].side;
    for (let k = 0; k < 4; k++) {
      const [a, b] = H[k], sp = -(1.5 - k) * 0.07 * (1 - clamp(a, 0, 1));
      F[k][0].rotation.set(sp, 0, -s * (a + extra)); F[k][1].rotation.z = -s * (b + extra * 0.5); F[k][2].rotation.z = -s * b * 0.75;
    }
    const [a, b] = H[4]; F[4][0].rotation.set(a * 0.5, 0, -s * a * 0.55); F[4][1].rotation.z = -s * b * 0.6; F[4][2].rotation.z = -s * b * 0.7;
  }
  place(x, y, z, yaw) { this.base.set(x, y, z); this.baseYaw = yaw; this.root.position.set(x, y, z); this.root.rotation.y = yaw; for (const L of this.legs) L.cur.copy(L.ft); }
  addMove(type, t0, dur, data = {}) { this.moves.push({ type, t0, dur, ...data }); }
  clearMoves() { this.moves.length = 0; }
  has(type, t) { return this.moves.some(m => m.type === type && t >= m.t0 && t < m.t0 + m.dur); }
  busyUntil() { let e = 0; for (const m of this.moves) if (!m.react) e = Math.max(e, m.t0 + m.dur); return e; }
  strum(t, amp, dir) { const s = this.st; s.strumT = t; s.strumDir = dir ?? -s.strumDir; s.strumAmp = amp; }

  /* ---------- capas de animación ---------- */
  update(t, mt, dt, K) {
    if (!this.root.visible) return;
    const p = this.p; Object.assign(p, POSE0);
    if (this.kind === 'guitar') this.animGuitar(t, mt, dt, K);
    else if (this.kind === 'singer') this.animSinger(t, mt, dt, K);
    else this.animDrummer(t, mt, dt, K);
    this.applyMoves(t, mt, K);
    this.applyPose(t, dt, K);
    this.simHair(dt);
  }
  animGuitar(t, mt, dt, K) {
    const p = this.p, st = this.st, c = st.conf, I = st.I;
    const dip = nodCurve(K.bp, 0.62) * 0.85;
    const energy = clamp(I * (0.8 + 0.35 * c), 0.2, 1.25);
    p.hipDrop = 0.035 + 0.06 * dip * energy + 0.04 * Math.max(0, -c);
    p.lean = 0.1 + 0.11 * dip * energy + 0.18 * Math.max(0, -c);
    p.headPitch = 0.04 + 0.36 * dip * energy - 0.12 * Math.max(0, c);
    p.bodyRoll = Math.sin(K.beat * Math.PI * 0.5 + this.seed) * 0.05 * energy;
    p.bodyYaw = Math.sin(t * 0.5 + this.seed) * 0.12;
    p.torsoYaw = Math.sin(t * 0.33 + this.seed) * 0.1;
    p.headYaw = Math.sin(t * 0.7 + this.seed * 2) * 0.12;
    p.stance = 0.03 + 0.07 * Math.max(0, c);
    p.brow = c > 0 ? 0.35 * c : 0.5 * c;
    p.lid = c > 0.2 ? 0.44 : 0.34;
    p.sneer = Math.max(0, c) * 0.6;
    p.mouth = (I > 0.9 && dip > 0.55 ? 0.45 * energy : 0) + Math.max(0, c - 0.3) * 0.15;
    // riff: las mismas notas que tocaría la canción → púa y mano izquierda sincronizadas
    const notes = K.notes; let i = st.riffPtr;
    if (i > 0 && notes[i - 1] && notes[i - 1].t > mt) i = 0;
    while (i < notes.length && notes[i].t <= mt) {
      const n = notes[i++];
      if (mt - n.t > 0.25) continue;
      const fumble = c < -0.35 && R() < (-c - 0.3) * 0.35;
      if (!fumble && !this.has('repair', mt)) this.strum(t, n.kind === 'm' ? 0.035 : n.kind === 's' ? 0.028 : 0.085);
      st.fret = n.kind === 's' ? clamp(n.m - 52, 3, 21) : ((n.m - 40) % 12 + 12) % 12 + (n.m >= 50 ? 7 : 3);
      st.sustainEnd = n.kind === 'p' && n.d > BEAT * 0.9 ? mt + n.d : 0;
      st.bend = n.kind === 's' && n.d > BEAT * 0.9 ? mt : -9;
    }
    st.riffPtr = i;
  }
  animSinger(t, mt, dt, K) {
    const p = this.p, st = this.st, I = st.I, dip = nodCurve(K.bp, 0.62) * 0.85;
    p.hipDrop = 0.03 + 0.045 * dip * (0.4 + I); p.bodyYaw = Math.sin(t * 0.5) * 0.12; p.bodyRoll = Math.sin(K.beat * Math.PI * 0.5) * 0.04;
    const sing = K.vocal ? 1 : 0;
    const belt = sing * Math.max(0, Math.sin(t * 0.7));
    st.mouthS = damp(st.mouthS, sing ? clamp(0.25 + 0.75 * Math.abs(Math.sin(t * 9.3 + Math.sin(t * 2.1) * 3)), 0, 1) : 0.05, 14, dt);
    p.mouth = st.mouthS; p.lean = -0.05 - 0.14 * belt + 0.05 * dip;
    p.headPitch = -0.22 * belt + 0.16 * dip * (0.3 + I); p.headYaw = Math.sin(t * 0.6) * 0.1 + (K.lookTo || 0); p.headRoll = Math.sin(t * 0.8) * 0.08;
    p.brow = 0.25 * belt - 0.1; p.lid = 0.3 + 0.4 * belt;
    const ph = Math.floor(K.beat / 8) % 3;
    const g = ph === 0 ? V(0.62, 1.12 + 0.05 * dip, 0.5) : ph === 1 ? V(0.33, 0.52 + 0.14 * dip, 0.42) : V(0.58, 0.42, 0.32);
    this.tgt[0].position.lerp(g, 1 - Math.exp(-8 * dt));
    this.handL = ph === 0 ? 'horns' : ph === 1 ? 'fist' : 'open';
  }
  animDrummer(t, mt, dt, K) {
    const p = this.p, I = this.st.I, dip = nodCurve(K.bp, 0.62) * 0.85;
    p.hipDrop = 0; p.bodyYaw = Math.sin(t * 0.7) * 0.06; p.lean = 0.12 + 0.06 * dip * (0.4 + I); p.torsoRoll = Math.sin(K.beat * Math.PI) * 0.03;
    p.headPitch = 0.05 + 0.3 * dip * (0.3 + I); p.headYaw = Math.sin(t * 0.5) * 0.15; p.mouth = I > 0.9 ? 0.45 : 0.08; p.lid = 0.35;
    p.liftL = 0.05 * Math.exp(-K.bp * 10);
    const hands = K.hands;
    for (let h = 0; h < 2; h++) {
      const hits = hands[h]; let i = this.handPtr[h];
      if (i > 0 && hits[i - 1] && hits[i - 1].t > mt) i = 0;
      while (i < hits.length && hits[i].t <= mt) i++;
      this.handPtr[h] = i;
      const prev = hits[i - 1], next = hits[i];
      const pa = DRUMPOS[prev ? prev.d : (h ? 'snare' : 'hat')], pb = DRUMPOS[next ? next.d : (h ? 'snare' : 'hat')];
      const t0 = prev ? prev.t : mt - 1, t1 = next ? next.t : mt + 1;
      const gap = Math.max(0.05, t1 - t0), q = clamp((mt - t0) / gap, 0, 1);
      const lift = Math.min(0.24, gap * 0.45) * Math.pow(Math.sin(Math.PI * q), 0.7);
      this.tgt[h].position.set(lerp(pa.x, pb.x, smooth(q)), lerp(pa.y, pb.y, smooth(q)) + lift, lerp(pa.z, pb.z, smooth(q)) - lift * 0.3);
    }
  }
  applyMoves(t, mt, K) {
    const p = this.p;
    this.moves = this.moves.filter(m => mt < m.t0 + m.dur + 0.4);
    for (const m of this.moves) {
      if (mt < m.t0) continue;
      const u = clamp((mt - m.t0) / m.dur, 0, 1);
      const w = Math.min(smooth(clamp((mt - m.t0) / 0.18, 0, 1)), smooth(clamp((m.t0 + m.dur - mt) / 0.3, 0, 1)));
      if (w <= 0 && m.type !== 'spin') continue;
      const toward = this.side === 0 ? 1 : -1;
      const beatK = Math.exp(-K.bp * 5);
      switch (m.type) {
        case 'headbang': { const hb = nodCurve((((K.beat % 2) + 2) % 2) / 2, 0.55); p.headPitch += w * (0.75 * hb - 0.22); p.lean += w * 0.3 * hb; p.hipDrop += w * 0.05 * hb; } p.stance += 0.06 * w; p.lid = lerp(p.lid, 0.8, w); break;
        case 'legKick': { const k = Math.sin(Math.PI * u); p.liftL += k * 0.42 * w; p.fwdL += k * 0.3 * w; p.lean -= k * 0.12; p.gz += 0.25 * k; p.mouth = Math.max(p.mouth, k * 0.8); break; }
        case 'guitarRaise': p.gz += 0.75 * w; p.gx += 0.15 * w; p.lean -= 0.32 * w; p.headPitch -= 0.45 * w; p.mouth = Math.max(p.mouth, 0.9 * w); p.brow += 0.25 * w; p.stance += 0.1 * w; p.lid = lerp(p.lid, 0.15, w); break;
        case 'leanBack': p.lean -= 0.5 * w; p.headPitch -= 0.45 * w; p.hipDrop += 0.13 * w; p.stance += 0.13 * w; p.gz += 0.3 * w; p.hipZ += 0.09 * w; p.mouth = Math.max(p.mouth, 0.55 * w); p.lid = lerp(p.lid, 0.85, w); p.brow += 0.3 * w; break;
        case 'spin': p.rootYaw += easeIO(u) * Math.PI * 2 * (m.dir || 1); p.liftR += Math.sin(Math.PI * u) * 0.1; break;
        case 'jump': { const k = Math.sin(Math.PI * u); p.rootY += k * 0.5; p.liftL += k * 0.2; p.liftR += k * 0.26; p.gz += 0.35 * k; p.mouth = Math.max(p.mouth, k); p.hipDrop += (1 - k) * 0.08 * w; break; }
        case 'taunt': p.rootYaw += toward * 0.85 * w; p.rootX += toward * 0.35 * w; p.lean += 0.2 * w; p.headPitch -= 0.08 * w; p.mouth = Math.max(p.mouth, (0.4 + 0.5 * beatK) * w); p.brow += 0.5 * w; p.lid = lerp(p.lid, 0.45, w); p.sneer += w; p.lookOpp = w; break;
        case 'stomp': p.stance += 0.16 * w; p.hipDrop += 0.06 * w; { const s = Math.max(0, Math.sin(K.beat * Math.PI)); if (Math.floor(K.beat) % 2) p.liftR += s * 0.14 * w; else p.liftL += s * 0.14 * w; } break;
        case 'point': p.ovF = w; p.lookOpp = w; p.mouth = Math.max(p.mouth, 0.6 * w); p.brow += 0.4 * w; p.rootYaw += toward * 0.4 * w; break;
        case 'lookGuitar': p.headPitch += 0.5 * w; p.headYaw += 0.35 * w; p.brow -= 0.4 * w; p.lid = lerp(p.lid, 0.1, w); break;
        case 'kneel': p.kneel = Math.max(p.kneel, w); p.gz += 0.4 * w; p.lean -= 0.25 * w; p.headPitch -= 0.4 * w; p.mouth = Math.max(p.mouth, 0.7 * w); break;
        case 'stagger': { const k = Math.pow(1 - u, 1.4) * w; p.lean -= 0.6 * k; p.headPitch -= 0.45 * k; p.rootX -= toward * 0.35 * smooth(Math.min(1, u * 3)) * w; p.rootZ -= 0.15 * smooth(Math.min(1, u * 3)) * w; p.mouth = Math.max(p.mouth, w); p.brow = lerp(p.brow, -0.7, w); p.lid = lerp(p.lid, -0.25, w); p.shake += k * 0.6; p.stance += 0.12 * w; break; }
        case 'shock': p.shake += 1.0 * w; p.mouth = Math.max(p.mouth, w); p.brow = lerp(p.brow, -0.8, w); p.lid = lerp(p.lid, -0.3, w); p.lean -= 0.22 * w; p.stance += 0.12 * w; p.gz += 0.2 * w; break;
        case 'repair': p.headPitch += 0.55 * w; p.headYaw += 0.3 * w; p.brow = lerp(p.brow, -0.6, w); p.mouth = lerp(p.mouth, 0.25, w); p.lean += 0.15 * w; if (Math.floor(mt / 0.075) !== this.lastR) { this.lastR = Math.floor(mt / 0.075); this.strum(t, 0.03); } break;
        case 'dizzy': p.headRoll += Math.sin(t * 5) * 0.32 * w; p.bodyRoll += Math.sin(t * 5 + 1) * 0.13 * w; p.lid = lerp(p.lid, 0.7, w); p.mouth = Math.max(p.mouth, 0.35 * w); p.brow -= 0.4 * w; p.headPitch += 0.15 * w; break;
        case 'struggle': p.lean += 0.18 * w; p.headPitch += 0.2 * w; p.brow -= 0.4 * w; break;
        case 'victory': { const j = Math.abs(Math.sin(K.beat * Math.PI)); p.rootY += j * 0.32 * w; p.gz += 1.0 * w; p.lean -= 0.3 * w; p.headPitch -= 0.5 * w; p.mouth = Math.max(p.mouth, w); p.brow += 0.4 * w; p.lid = lerp(p.lid, 0.1, w); p.ovS = w; p.liftL += j * 0.12 * w; p.liftR += j * 0.14 * w; p.handS = 'fist'; p.lookCam = w; break; }
        case 'defeat': p.kneel = Math.max(p.kneel, w); p.headPitch += 0.75 * w; p.lean += 0.45 * w; p.gz -= 0.55 * w; p.mouth = lerp(p.mouth, 0.05, w); p.brow = lerp(p.brow, -0.6, w); p.lid = lerp(p.lid, 0.6, w); p.ovS = w; p.ovF = w * 0.8; p.handS = 'open'; p.handF = 'open'; break;
        case 'charge': p.gz += 0.6 * w; p.lean -= 0.25 * w; p.headPitch -= 0.3 * w; p.mouth = Math.max(p.mouth, w); p.brow += 0.6 * w; p.lid = lerp(p.lid, 0.35, w); p.lookOpp = w; p.rootYaw += toward * 0.35 * w; break;
      }
    }
  }
  applyPose(t, dt, K) {
    const p = this.p, st = this.st, r = this.root;
    const sh = p.shake;
    const n1 = sh ? (Math.sin(t * 61) + Math.sin(t * 37.3)) * 0.5 * sh : 0, n2 = sh ? (Math.sin(t * 53.7) + Math.sin(t * 29.1)) * 0.5 * sh : 0;
    r.position.set(this.base.x + p.rootX + n1 * 0.02, this.base.y + p.rootY, this.base.z + p.rootZ);
    r.rotation.y = this.baseYaw + p.rootYaw;
    const kneel = p.kneel;
    // columna repartida en cadera / columna / pecho / cuello / cabeza
    this.hips.position.set(p.hipX, this.hipRest - p.hipDrop - kneel * 0.42, p.hipZ + kneel * 0.05);
    this.hips.rotation.set(p.pelvis, p.bodyYaw + n2 * 0.08, p.bodyRoll + n1 * 0.06);
    const ty = p.torsoYaw + n1 * 0.1, tr = p.torsoRoll + n2 * 0.1;
    this.spine.rotation.set(p.lean * 0.6, ty * 0.5, tr * 0.6);
    this.chest.rotation.set(p.lean * 0.4, ty * 0.5, tr * 0.4);
    const hp = p.headPitch + n2 * 0.15, hy = p.headYaw, hr = p.headRoll + n1 * 0.12;
    this.neck.rotation.set(hp * 0.35, hy * 0.4, hr * 0.35);
    this.head.rotation.set(hp * 0.65, hy * 0.6, hr * 0.65);
    // cara
    if (t >= st.blinkAt) { st.blinkT = t; st.blinkAt = t + rr(1.8, 5); }
    const blink = t - st.blinkT < 0.12 ? 1 : 0;
    const lid = Math.max(p.lid, blink);
    const U = this.faceU, cl = clamp((lid - 0.2) / 0.8, -0.35, 1), sq = clamp(Math.max(0, p.brow) * 0.35 + p.sneer * 0.15, 0, 0.6);
    U.uT.value = t; U.uLid.value.set(cl, cl, sq, sq * (1 - p.sneer * 0.6));
    const raise = Math.max(0, -p.brow) * 0.004 + p.mouth * 0.0012, ang = clamp(p.brow, -1, 1);
    U.uBrow.value.set(raise, raise + p.sneer * 0.003 * (this.side ? -1 : 1), ang, ang - p.sneer * 0.4);
    const mo = clamp(p.mouth, 0, 1);
    this.jaw.rotation.set(mo * 0.3, 0, p.sneer * 0.025 * (this.side ? -1 : 1));
    // mirada (los iris se desplazan dentro del ojo pintado)
    let look = null;
    if (p.lookOpp > 0.3 && this.opp) look = this.opp.face.getWorldPosition(_c);
    else if (p.lookCam > 0.3 || (this.kind !== 'drummer' && st.conf > 0.3 && Math.sin(t * 0.37 + this.seed) > 0.6)) look = camera.position;
    const E = this.hsrc.eye;
    if (look) { this.face.updateWorldMatrix(true, false); _b.copy(look); this.face.worldToLocal(_b); }
    for (let i = 0; i < 2; i++) {
      let yaw = Math.sin(t * 0.45 + this.seed) * 0.15, pitch = -0.05;
      if (look) { const dx = _b.x - (i ? E.x : -E.x), dy = _b.y - E.y; yaw = clamp(Math.atan2(dx, _b.z), -0.6, 0.6); pitch = clamp(Math.atan2(dy, Math.hypot(dx, _b.z)), -0.45, 0.45); }
      const gz = this.gaze[i]; gz.x = damp(gz.x, yaw * E.hw * 0.7, 12, dt); gz.y = damp(gz.y, pitch * E.hw * 0.55, 12, dt);
    }
    U.uGaze.value.set(this.gaze[0].x, this.gaze[0].y, this.gaze[1].x, this.gaze[1].y);
    // pelo con inercia
    const hs = this.hs, h = Math.min(dt, 1 / 30);
    const tx = p.headPitch + p.lean, tz = p.headRoll + p.torsoRoll + p.bodyRoll + p.headYaw * 0.3, vy = p.rootY - p.hipDrop - p.kneel * 0.42;
    const spr = (x, v, tg, k, d) => { hs[v] += ((tg - hs[x]) * k - hs[v] * d) * h; hs[x] += hs[v] * h; };
    spr('hw', 'hv', tx, 140, 10); spr('hz', 'hzv', tz, 110, 9);    // pelo pegado a la cabeza
    spr('tw', 'tv', tx, 50, 4.5); spr('tz', 'tzv', tz, 40, 4);     // mechones largos y coletas: más lentos, se pasan y vuelven
    spr('y', 'yv', vy, 70, 5.5);                                    // rebote al saltar o al bajar la cadera
    this.hair.rotation.x = clamp(hs.hw - tx, -0.7, 0.7) * 0.5; this.hair.rotation.z = clamp(hs.hz - tz, -0.6, 0.6) * 0.5;
    const fl = clamp((hs.y - vy) * 5, -0.45, 0.45);
    for (const q of this.tails) {
      const s = q.userData.s ?? 0, k = q.userData.k ?? 1, ph = t * 1.9 + this.seed + s;
      q.rotation.x = (clamp(hs.tw - tx, -0.9, 0.9) * 1.5 + Math.sin(ph * 0.8) * 0.03) * k;
      q.rotation.z = (clamp(hs.tz - tz, -0.8, 0.8) * 1.7 + s * fl + Math.sin(ph) * 0.045) * k;
    }
    // guitarra y manos
    if (this.kind === 'guitar') {
      const gb = this.gBase, gt = this.gtr;
      gt.g.rotation.set(gb.rx + p.gx, gb.ry + p.gy, gb.rz + p.gz);
      const ds = t - st.strumT; let sy;
      if (ds < 0.06) sy = st.strumDir * st.strumAmp * (1 - 2 * smooth(ds / 0.06)); else sy = -st.strumDir * st.strumAmp * Math.exp(-(ds - 0.06) * 7);
      gt.strum.position.set(-0.01, sy, 0.108);
      st.fx = damp(st.fx, fretX(st.fret - 0.45), 16, dt);
      let fy = -0.045;
      if (st.sustainEnd && K.mt < st.sustainEnd) fy += Math.sin(t * 34) * 0.006;
      if (K.mt - st.bend < BEAT * 2) fy += smooth(clamp((K.mt - st.bend) / 0.2, 0, 1)) * 0.018;
      gt.fret.position.set(st.fx, fy, 0);
      if (p.ovS > 0) this.ovS.position.set(p.handS === 'fist' ? -0.32 : -0.25, p.handS === 'fist' ? 0.95 + 0.08 * Math.exp(-K.bp * 6) : 0.05, p.handS === 'fist' ? 0.2 : 0.18);
      if (p.ovF > 0) { if (p.handF === 'open') this.ovF.position.set(0.3, 0.05, 0.16); else this.ovF.position.set(this.side === 0 ? 1.2 : 0.55, 0.75, this.side === 0 ? 0.8 : 1.1); }
      this.setHand(1, p.ovS > 0.5 ? p.handS : 'pick');
      this.setHand(0, p.ovF > 0.5 ? (p.handF === 'open' ? 'open' : 'point') : 'grip', Math.sin(t * 9) * 0.05);
    } else if (this.kind === 'singer') {
      this.setHand(0, this.handL || 'fist'); this.setHand(1, 'grip');
      this.root.updateMatrixWorld(true); this.tgt[1].position.copy(this.torso.worldToLocal(S.micGrip.position.clone()));
    } else { this.setHand(0, 'grip'); this.setHand(1, 'grip'); }
    // pies (con pasito al cambiar de postura)
    for (const L of this.legs) {
      const s = L.side;
      let tx2 = L.ft.x + s * p.stance, tz2 = L.ft.z + (s > 0 ? p.fwdL : p.fwdR), ty2 = this.ankleH + (s > 0 ? p.liftL : p.liftR);
      if (kneel > 0) { if (s > 0) tz2 += 0.22 * kneel; else { tz2 -= 0.38 * kneel; ty2 = lerp(ty2, this.ankleH + 0.06, kneel); } }
      if (this.fem) tx2 *= 0.85;
      const d = Math.hypot(tx2 - L.cur.x, tz2 - L.cur.z);
      L.cur.x = damp(L.cur.x, tx2, 14, dt); L.cur.z = damp(L.cur.z, tz2, 14, dt);
      L.cur.y = ty2 + Math.min(0.1, d * 0.8);
      L.yaw = s * 0.28 * (1 - kneel * 0.5);
    }
    this.solve(kneel);
  }
  /* orienta un hueso (que en reposo apunta hacia abajo) de "from" a "to" (espacio del personaje) */
  aim(bone, from, to) {
    _d.subVectors(to, from).normalize();
    bone.parent.getWorldQuaternion(_qa); this.root.getWorldQuaternion(_qb); _qa.premultiply(_qb.invert()).invert();
    _d.applyQuaternion(_qa); bone.quaternion.setFromUnitVectors(DOWN, _d); bone.updateMatrixWorld(true);
  }
  solve(kneel = 0) {
    const r = this.root; r.updateMatrixWorld(true);
    const p = this.p;
    for (let i = 0; i < 2; i++) {
      const A = this.arms[i];
      this.ua[i].getWorldPosition(_a); r.worldToLocal(_a);
      let tg = this.tgt[i];
      if (this.kind === 'guitar') tg = i === 0 ? this.gtr.fret : this.gtr.strum;
      tg.getWorldPosition(_b);
      if (this.kind === 'guitar') { const w = i === 0 ? p.ovF : p.ovS; if (w > 0) { (i === 0 ? this.ovF : this.ovS).getWorldPosition(_c); _b.lerp(_c, smooth(clamp(w, 0, 1))); } }
      r.worldToLocal(_b);
      this.poleMk[i].getWorldPosition(_c); r.worldToLocal(_c);
      ik2(_a, _b, L_UP, L_FO, _c, A.elbow, A.wrist);
      const sh = _a.clone();
      this.aim(this.ua[i], sh, A.elbow); this.aim(this.fa[i], A.elbow, A.wrist);
      _d.subVectors(A.wrist, A.elbow).normalize();
      // orientación deseada de la mano (espacio del personaje): sigue al antebrazo, o se coloca respecto a la guitarra
      _qa.setFromUnitVectors(UP, _d).multiply(_q2.setFromAxisAngle(UP, A.side * 0.6)).multiply(HAND_C[i]);
      if (this.kind === 'guitar') {
        const w = smooth(clamp(1 - (i === 0 ? p.ovF : p.ovS), 0, 1));
        if (w > 0) {
          this.gtr.g.getWorldQuaternion(_q4); r.getWorldQuaternion(_q5); _q4.premultiply(_q5.invert());
          const Hg = HAND_G[i]; handFrame(_hf.copy(Hg.f).applyQuaternion(_q4), _hp.copy(Hg.p).applyQuaternion(_q4), i, _q5);
          _qa.slerp(_q5, w);
        }
      }
      // el giro de muñeca se reparte: 65% en el antebrazo (hueso de torsión), el resto en la muñeca
      this.fa[i].getWorldQuaternion(_qb); r.getWorldQuaternion(_q3); _qb.premultiply(_q3.invert());
      _q2.copy(_qb).invert().multiply(_qa);
      const tw = wrapA(2 * Math.atan2(_q2.y, _q2.w));
      this.twB[i].quaternion.setFromAxisAngle(UP, tw * 0.65); _qb.multiply(this.twB[i].quaternion);
      this.handB[i].quaternion.copy(_qb.invert().multiply(_qa)); this.twB[i].updateMatrixWorld(true);
    }
    for (let i = 0; i < 2; i++) {
      const Lg = this.legs[i];
      this.th[i].getWorldPosition(_a); r.worldToLocal(_a);
      _c.set(_a.x * 1.8, _a.y * 0.5 + (this.kind === 'drummer' ? 0.6 : 0) - kneel * 0.3, 1.2);
      ik2(_a, Lg.cur, L_TH, L_SH, _c, Lg.knee, Lg.ankle);
      const hp = _a.clone();
      this.aim(this.th[i], hp, Lg.knee); this.aim(this.sh[i], Lg.knee, Lg.ankle);
      Lg.foot.position.copy(Lg.ankle); Lg.foot.rotation.set(Lg.side < 0 && kneel > 0.3 ? -0.6 * kneel : 0, Lg.yaw, 0);
    }
    this.face.updateWorldMatrix(true, false); this.neckU.uFaceInv.value.copy(this.face.matrixWorld).invert();
  }
}
const DRUMPOS = { snare: V(0.2, 0.86, 0.26), hat: V(0.44, 0.98, 0.2), crash: V(0.52, 1.28, 0.42), ride: V(-0.5, 1.12, 0.36), tom1: V(0.1, 0.98, 0.44), tom2: V(-0.16, 0.98, 0.44), ftom: V(-0.42, 0.74, 0.24) };

/* =====================================================================
   PÚBLICO
   ===================================================================== */
class Crowd {
  constructor() {
    const pts = []; let tries = 0;
    while (pts.length < 160 && tries < 9000) { tries++; const x = rr(-12, 12), z = rr(4.7, 19); if (Math.abs(x) > 5.4 && z < 5.9) continue; if (Math.abs(x) < 1.8 && z < 4.2) continue; if (Math.hypot(x - FIRE.x, z - FIRE.z) < 1.9) continue; if (pts.some(p => Math.hypot(p.x - x, p.z - z) < 0.6)) continue; pts.push({ x, z }); }
    const shirts = [0xd8262b, 0x2b2b2b, 0x3a5aa8, 0xe8e8e8, 0x6b3fa0, 0x2f7d3a, 0xd98a2a, 0x991b1b, 0x444444];
    const skins = [0xf1c7a0, 0xdca27a, 0xb57a52, 0x8a5a3a, 0xeab68e], hairs = [0x2a1a10, 0x8a5a2e, 0xe8c86a, 0xd8442a, 0x111111, 0x5a3a20];
    this.p = pts.map(p => ({ ...p, yaw: Math.atan2(-p.x * 0.8, -(p.z + 1.5)), s: rr(0.88, 1.08), ph: R(), style: Math.floor(R() * 4), j: rr(0.08, 0.3) }));
    const n = this.n = this.p.length;
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD });
    this.all = []; const mk = (geo, cnt, outline) => { const m = new THREE.InstancedMesh(geo, mat, cnt); scene.add(m); this.all.push(m); if (outline) { const o = new THREE.InstancedMesh(geo, outlineMat(outline), cnt); o.instanceMatrix = m.instanceMatrix; scene.add(o); this.all.push(o); } return m; };
    this.body = mk(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), n, 0.025);
    this.head = mk(new THREE.SphereGeometry(0.14, 12, 10), n, 0.02);
    this.hair = mk(new THREE.SphereGeometry(0.152, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), n, 0);
    this.arm = mk(new THREE.CapsuleGeometry(0.055, 0.46, 3, 6).translate(0, 0.28, 0), n * 2, 0.02);
    this.leg = mk(new THREE.CylinderGeometry(0.08, 0.07, 0.8, 7).translate(0, 0.4, 0), n * 2, 0);
    const c = new THREE.Color();
    this.p.forEach((P, i) => { const sh = pick(shirts), sk = pick(skins); this.body.setColorAt(i, c.setHex(sh)); this.head.setColorAt(i, c.setHex(sk)); this.hair.setColorAt(i, c.setHex(pick(hairs))); for (let k = 0; k < 2; k++) { this.arm.setColorAt(i * 2 + k, c.setHex(R() < 0.6 ? sk : sh)); this.leg.setColorAt(i * 2 + k, c.setHex(pick([0x2e3d63, 0x222222, 0x3c5482, 0x5a4a3a]))); } });
    this.d = new THREE.Object3D(); this.cheer = 0;
  }
  update(t, K, ex, mom) {
    const d = this.d; this.cheer = Math.max(0, this.cheer - 0.012);
    for (let i = 0; i < this.n; i++) {
      const P = this.p[i]; const bias = 1 + 0.35 * mom * (P.x < 0 ? 1 : -1); const e = clamp(ex * bias + this.cheer, 0, 1.4);
      const lb = ((K.beat + P.ph * 0.3) % 1 + 1) % 1, dip = Math.exp(-lb * 6);
      const y = P.j * e * dip * (P.style === 3 ? 0.4 : 1) + this.cheer * 0.25 * Math.abs(Math.sin(t * 9 + P.ph * 6));
      const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), s = P.s;
      d.scale.setScalar(s);
      d.position.set(P.x, 1.23 * s + y, P.z); d.rotation.set(0.06 * dip * e, P.yaw, 0, 'YXZ'); d.updateMatrix(); this.body.setMatrixAt(i, d.matrix);
      d.position.set(P.x + sy * 0.03 * dip * e, 1.82 * s + y, P.z + cy * 0.03 * dip * e); d.rotation.set(0.25 * dip * e - 0.1, P.yaw, 0, 'YXZ'); d.updateMatrix(); this.head.setMatrixAt(i, d.matrix); this.hair.setMatrixAt(i, d.matrix);
      for (let k = 0; k < 2; k++) {
        const side = k ? -1 : 1; let r, rx = 0;
        switch (P.style) { case 0: r = 2.55 + 0.25 * Math.sin(t * 3 + P.ph * 6 + k); break; case 1: r = side > 0 ? 0.3 : 2.0 + 0.9 * dip * e; break; case 2: r = 2.85 + 0.1 * Math.sin(t * 2 + k); break; default: r = 0.4; rx = 1.0 + 0.6 * dip * e; }
        r = lerp(0.35, r, clamp(e * 1.2, 0, 1)); if (this.cheer > 0.3) { r = lerp(r, 2.8, Math.min(1, this.cheer)); rx = 0; }
        const lx = side * 0.25 * s, ly = 1.56 * s + y;
        d.position.set(P.x + lx * cy, ly, P.z - lx * sy); d.rotation.set(rx, P.yaw, -side * (Math.PI - r), 'YXZ'); d.updateMatrix(); this.arm.setMatrixAt(i * 2 + k, d.matrix);
        d.position.set(P.x + side * 0.1 * s * cy, y * 0.6, P.z - side * 0.1 * s * sy); d.rotation.set(0, P.yaw, 0, 'YXZ'); d.updateMatrix(); this.leg.setMatrixAt(i * 2 + k, d.matrix);
      }
    }
    for (const m of [this.body, this.head, this.hair, this.arm, this.leg]) m.instanceMatrix.needsUpdate = true;
  }
}

/* =====================================================================
   EFECTOS: partículas, rayos, pirotecnia, confeti, humo
   ===================================================================== */
class Particles {
  constructor(n = 2500) {
    this.n = n; this.i = 0; this.alive = 0; this.colDirty = false;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.s0 = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.u = { uScale: { value: 400 }, uMap: { value: TX.glow } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(vC*t.a*vA,1.0); }`,
      vertexColors: true,
    }));
    this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  emit(p, count, o = {}) {
    const col = new THREE.Color(o.color ?? 0xffc060).multiplyScalar(o.bright ?? 2.5);
    const col2 = o.color2 !== undefined ? new THREE.Color(o.color2).multiplyScalar(o.bright ?? 2.5) : col;
    for (let k = 0; k < count; k++) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      const sp0 = o.speed ?? 3, j = o.jitter ?? 0.02;
      const dir = V(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize().multiplyScalar(sp0 * rr(0.4, 1));
      if (o.dir) dir.add(o.dir.clone().multiplyScalar(rr(0.6, 1.2)));
      this.pos.set([p.x + rr(-j, j), p.y + rr(-j, j), p.z + rr(-j, j)], i * 3);
      this.vel.set([dir.x, dir.y, dir.z], i * 3);
      const c2 = R() < 0.5 ? col2 : col;
      this.col.set([c2.r, c2.g, c2.b], i * 3);
      this.alive = 1; this.colDirty = true; this.life[i] = this.max[i] = rr(0.6, 1) * (o.life ?? 0.8); this.grav[i] = o.grav ?? -6; this.drag[i] = o.drag ?? 1.5; this.s0[i] = (o.size ?? 0.05) * rr(0.6, 1.2);
    }
  }
  update(dt) {
    if (!this.alive) return;   // nada vivo: ni cálculo ni subida a la GPU
    const P = this.pos, Vv = this.vel; let n = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      n++; this.life[i] -= dt; const k = Math.exp(-this.drag[i] * dt);
      Vv[i * 3] *= k; Vv[i * 3 + 1] = Vv[i * 3 + 1] * k + this.grav[i] * dt; Vv[i * 3 + 2] *= k;
      P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt;
      if (P[i * 3 + 1] < 0.02) { P[i * 3 + 1] = 0.02; Vv[i * 3 + 1] *= -0.3; }
      const f = this.life[i] / this.max[i]; this.alpha[i] = Math.min(1, f * 2); this.size[i] = this.s0[i] * (0.4 + 0.6 * f);
    }
    const A = this.mesh.geometry.attributes; A.position.needsUpdate = A.size.needsUpdate = A.alpha.needsUpdate = true;
    if (this.colDirty) { A.color.needsUpdate = true; this.colDirty = false; }
    this.alive = n;   // la última pasada deja todo en alfa 0 antes de apagarse
  }
}
class Bolt {
  constructor() {
    this.N = 34; this.active = false;
    const mk = (w, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.N + 1) * 2 * 3), 3)); const idx = []; for (let i = 0; i < this.N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.visible = false; scene.add(m); return { m, w }; };
    this.core = mk(0.018, new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.glow = mk(0.09, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.55 }));
    this.pts = Array.from({ length: this.N + 1 }, () => V());
  }
  fire(fromFn, toFn, dur, rgb) { this.fromFn = fromFn; this.toFn = toFn; this.t0 = clock.t; this.dur = dur; this.active = true; this.glow.m.material.color.setRGB(...rgb); this.core.m.material.color.setRGB(rgb[0] * 0.6 + 3, rgb[1] * 0.6 + 3, rgb[2] * 0.6 + 3); this.regen = 0; }
  update(dt) {
    if (!this.active) return;
    const u = (clock.t - this.t0) / this.dur; if (u > 1) { this.active = false; this.core.m.visible = this.glow.m.visible = false; return; }
    const A = this.fromFn(), B = this.toFn(); const grow = clamp(u * 5, 0, 1);
    this.regen -= dt;
    if (this.regen <= 0) {
      this.regen = 0.045; const amp = A.distanceTo(B) * 0.08;
      for (let i = 0; i <= this.N; i++) { const s = i / this.N * grow; this.pts[i].lerpVectors(A, B, s); const k = Math.sin(Math.PI * (i / this.N)) * amp; this.pts[i].add(V(rr(-k, k), rr(-k, k) + Math.sin(Math.PI * s) * amp * 1.5, rr(-k, k))); }
    }
    const fade = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
    const tan = V(), view = V(), side = V();
    for (const L of [this.core, this.glow]) {
      const pa = L.m.geometry.attributes.position; L.m.visible = true; L.m.material.opacity = (L === this.glow ? 0.55 : 1) * fade * (0.7 + 0.3 * Math.sin(clock.t * 60));
      for (let i = 0; i <= this.N; i++) { const P = this.pts[i], Q = this.pts[Math.min(this.N, i + 1)], O = this.pts[Math.max(0, i - 1)]; tan.subVectors(Q, O).normalize(); view.subVectors(camera.position, P).normalize(); side.crossVectors(tan, view).normalize().multiplyScalar(L.w * (1 - 0.5 * i / this.N)); pa.setXYZ(i * 2, P.x + side.x, P.y + side.y, P.z + side.z); pa.setXYZ(i * 2 + 1, P.x - side.x, P.y - side.y, P.z - side.z); }
      pa.needsUpdate = true;
    }
  }
}
class Pyro {
  constructor(x) {
    this.x = x; this.t0 = -9; this.dur = 0; this.spr = [];
    for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.flame, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.position.set(x, SY, 2.85); scene.add(s); this.spr.push({ s, ph: i / 18 }); }
  }
  fire(dur = 1.2) { this.t0 = clock.t; this.dur = dur; }
  update(t) {
    const age = t - this.t0, on = age < this.dur ? 1 : Math.max(0, 1 - (age - this.dur) / 0.4);
    for (const f of this.spr) {
      if (on <= 0) { f.s.material.opacity = 0; continue; }
      const a = ((t * 2.6 + f.ph) % 1); f.s.position.set(this.x + Math.sin(f.ph * 40 + t * 9) * 0.12 * a, SY + 0.2 + a * 3.2, 2.85 + Math.cos(f.ph * 31) * 0.1 * a);
      f.s.scale.setScalar((0.55 + a * 1.1) * (1 - a * 0.35)); f.s.material.opacity = (1 - a) * on;
      f.s.material.color.setRGB(1.6, lerp(1.4, 0.45, a), lerp(0.8, 0.1, a));
    }
    return on;
  }
}
class Confetti {
  constructor(n = 500) {
    this.n = n; this.on = false; this.m = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), n); this.m.frustumCulled = false; this.m.visible = false; scene.add(this.m);
    const cols = [0xff3b6b, 0xffd23a, 0x5dff5a, 0x4db3ff, 0xc07bff, 0xffffff]; const c = new THREE.Color();
    this.p = Array.from({ length: n }, (_, i) => { this.m.setColorAt(i, c.setHex(cols[i % cols.length]).multiplyScalar(1.4)); return { p: V(), v: V(), r: V(), w: V() }; });
    this.d = new THREE.Object3D();
  }
  burst() { this.on = true; this.m.visible = true; for (const q of this.p) { q.p.set(rr(-7, 7), rr(SY + 5, SY + 9), rr(-2, 8)); q.v.set(rr(-0.4, 0.4), rr(-1.6, -0.8), rr(-0.4, 0.4)); q.r.set(R() * 6, R() * 6, R() * 6); q.w.set(rr(-6, 6), rr(-6, 6), rr(-6, 6)); } }
  update(dt, t) {
    if (!this.on) return;
    this.p.forEach((q, i) => { q.p.addScaledVector(q.v, dt); q.p.x += Math.sin(t * 2 + i) * 0.004; if (q.p.y < 0.05) q.p.y = 0.05; q.r.addScaledVector(q.w, dt); this.d.position.copy(q.p); this.d.rotation.set(q.r.x, q.r.y, q.r.z); this.d.updateMatrix(); this.m.setMatrixAt(i, this.d.matrix); });
    this.m.instanceMatrix.needsUpdate = true;
  }
  stop() { this.on = false; this.m.visible = false; }
}
class Smoke {
  constructor(n = 40) { this.s = []; for (let i = 0; i < n; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.smoke, color: 0x8899aa, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; scene.add(sp); this.s.push({ sp, life: 0, max: 1, v: V() }); } this.i = 0; }
  puff(p, o = {}) { const q = this.s[this.i++ % this.s.length]; q.sp.position.copy(p); q.sp.visible = true; q.life = q.max = o.life ?? 3; q.v.set(rr(-0.2, 0.2), o.rise ?? 0.6, rr(-0.2, 0.2)); q.size = o.size ?? 1.2; q.op = o.op ?? 0.35; q.sp.material.color.set(o.color ?? 0x8899aa); }
  update(dt) { for (const q of this.s) { if (q.life <= 0) { q.sp.visible = false; continue; } q.life -= dt; const f = q.life / q.max; q.sp.position.addScaledVector(q.v, dt); q.sp.scale.setScalar(q.size * (1.6 - f)); q.sp.material.opacity = q.op * Math.min(1, f * 2) * Math.min(1, (1 - f) * 6); } }
}
const haze = [];
function buildHaze() { for (let i = 0; i < 22; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.smoke, color: 0x9ab0c0, transparent: true, depthWrite: false, opacity: rr(0.05, 0.11) })); sp.position.set(rr(-8, 8), rr(SY + 0.3, SY + 3), rr(-3, 6)); sp.scale.setScalar(rr(3, 6)); scene.add(sp); haze.push({ sp, v: rr(-0.15, 0.15), y0: sp.position.y }); } }

/* =====================================================================
   TIEMPO MUSICAL (solo para sincronizar la animación — no hay audio)
   ===================================================================== */
function guitarBar(name, b, r, solo) {
  switch (name) {
    case 'intro': if (b === 0) return [[0, 40, 16, 'p']]; if (b === 1) return [[0, 40, 8, 'p'], [8, 43, 4, 'p'], [12, 45, 4, 'p']]; if (b === 2) return [[0, 40, 8, 'p'], [8, 38, 8, 'p']]; return [40, 40, 43, 40, 40, 45, 43, 47].map((m, i) => [i * 2, m, 2, i % 2 ? 'm' : 'p']);
    case 'verse': { const A = [[0, 40, 1, 'm'], [1, 40, 1, 'm'], [2, 40, 1, 'm'], [3, 43, 1, 'p'], [4, 40, 1, 'm'], [5, 40, 1, 'm'], [6, 45, 2, 'p'], [8, 40, 1, 'm'], [9, 40, 1, 'm'], [10, 40, 1, 'm'], [11, 47, 1, 'p'], [12, 48, 2, 'p'], [14, 47, 2, 'p']]; const B = [[0, 40, 1, 'm'], [1, 40, 1, 'm'], [2, 40, 1, 'm'], [3, 43, 1, 'p'], [4, 40, 1, 'm'], [5, 40, 1, 'm'], [6, 45, 2, 'p'], [8, 40, 1, 'm'], [9, 40, 1, 'm'], [10, 43, 2, 'p'], [12, 45, 2, 'p'], [14, 43, 1, 'p'], [15, 45, 1, 'p']]; return b % 2 ? B : A; }
    case 'pre': { const roots = [48, 50, 47]; if (b < 3) return [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, roots[b], 2, s % 4 ? 'm' : 'p']); return [[0, 47, 4, 'p'], [4, 48, 4, 'p'], [8, 50, 4, 'p'], [12, 52, 4, 'p']]; }
    case 'chorus': { const prog = [48, 50, 40, 40, 43, 50, 48, 47]; const m = prog[b % 8], n = prog[(b + 1) % 8]; return [[0, m, 3, 'p'], [3, m, 3, 'p'], [6, m, 2, 'p'], [8, m, 6, 'p'], [14, n, 2, 'p']]; }
    case 'solo': { const sc = [64, 67, 69, 71, 74, 76, 79]; const rhs = [[0, 2, 4, 6, 8, 10, 12, 14], [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 14], [0, 2, 3, 4, 6, 8, 10, 11, 12], [0, 3, 6, 8, 10, 12]]; const rh = rhs[(b * 7 + 3) % 4]; if (b === 7) return [[0, 76, 2, 's'], [2, 74, 2, 's'], [4, 71, 2, 's'], [6, 69, 2, 's'], [8, 76, 8, 's']]; return rh.map((s, i) => { const len = (rh[i + 1] ?? 16) - s; solo.idx = clamp(solo.idx + (r() < 0.6 ? (b % 2 ? -1 : 1) : (r() < 0.5 ? 1 : -1)) * (r() < 0.25 ? 2 : 1), 0, sc.length - 1); return [s, sc[solo.idx], len, 's']; }); }
    case 'break': { const end = b % 2 ? 46 : 38; return [[0, 40, 3, 'p'], [3, 40, 1, 'm'], [4, 40, 1, 'm'], [6, 41, 2, 'p'], [8, 40, 1, 'm'], [10, 40, 1, 'm'], [12, end, 4, 'p']]; }
    case 'outro': return b === 0 ? [[0, 40, 2, 'p'], [2, 40, 2, 'p'], [4, 40, 2, 'p'], [6, 43, 2, 'p'], [8, 45, 2, 'p'], [10, 47, 2, 'p'], [12, 40, 4, 'p']] : [[0, 40, 16, 'p']];
  }
  return [];
}
function drumBar(name, b, nb) {
  let H = []; const add = (steps, k) => steps.forEach(s => H.push([s, k])); const E = [0, 2, 4, 6, 8, 10, 12, 14];
  switch (name) {
    case 'intro': if (b < 3) { add([0], 'crash'); add([0], 'kick'); if (b === 2) { add([8, 10], 'tom1'); add([12, 13], 'tom2'); add([14, 15], 'ftom'); } return H; } add([0, 8, 10], 'kick'); add([4, 12], 'snare'); add(E, 'hat'); if (b === 3) add([0], 'crash'); break;
    case 'verse': add([0, 3, 8, 10], 'kick'); add([4, 12], 'snare'); add(E, 'hat'); if (b === 0 || b === 4) add([0], 'crash'); break;
    case 'pre': add(E, 'kick'); add([4, 12], 'snare'); add([0, 4, 8, 12], 'hat'); if (b === 0) add([0], 'crash'); break;
    case 'chorus': add([0, 6, 8, 14], 'kick'); add([4, 12], 'snare'); add(E, 'ride'); if (b % 2 === 0) add([0], 'crash'); break;
    case 'solo': add([0, 2, 8, 10, 11], 'kick'); add([4, 12], 'snare'); add(E, 'hat'); if (b % 4 === 0) add([0], 'crash'); break;
    case 'break': add([0, 3, 4, 8, 10], 'kick'); add([8], 'snare'); add([0], 'crash'); add([4, 12], 'hat'); return H;
    case 'outro': if (b === 0) { add([0, 2, 4, 6, 8, 10], 'kick'); add([0, 4, 8], 'snare'); add([0], 'crash'); add([12, 13], 'tom1'); add([14, 15], 'ftom'); } else { add([0], 'kick'); add([0], 'crash'); } return H;
  }
  if (b === nb - 1) { H = H.filter(([s, k]) => s < 8 || k === 'kick'); add([8, 9, 10, 11], 'snare'); add([12, 13], 'tom1'); add([14], 'tom2'); add([15], 'ftom'); }
  return H;
}
function buildSong() {
  const sections = [], notes = [], drums = []; let bar = 0; const r = rng(77), solo = { idx: 2 };
  for (const [name, nb] of SONG_SECTIONS) {
    sections.push({ name, bar0: bar, t0: bar * BAR, t1: (bar + nb) * BAR });
    for (let b = 0; b < nb; b++) { const T0 = (bar + b) * BAR; for (const [s, m, len, kind] of guitarBar(name, b, r, solo)) notes.push({ t: T0 + s * S16, m, d: len * S16, kind }); for (const [s, k] of drumBar(name, b, nb)) drums.push({ t: T0 + s * S16, k }); }
    bar += nb;
  }
  notes.sort((a, b) => a.t - b.t); drums.sort((a, b) => a.t - b.t);
  const hands = [[], []]; let alt = 0;
  for (const e of drums) { if (e.k === 'kick') continue; if (e.k === 'snare') hands[1].push({ t: e.t, d: 'snare' }); else if (e.k === 'hat') hands[0].push({ t: e.t, d: 'hat' }); else if (e.k === 'crash') hands[0].push({ t: e.t, d: 'crash' }); else if (e.k === 'ride') hands[1].push({ t: e.t, d: 'ride' }); else hands[alt++ % 2 ? 0 : 1].push({ t: e.t, d: e.k }); }
  for (const h of hands) for (let i = h.length - 1; i > 0; i--) if (h[i].t - h[i - 1].t < 0.03) h.splice(i, 1);
  return { sections, notes, drums, hands, len: bar * BAR };
}


/* =====================================================================
   INICIO DE ESCENA
   ===================================================================== */
const clock = { t: 0, run: true };
await Promise.race([document.fonts.load('80px Bangers'), sleep(2500)]).catch(() => {});
makeTextures(); buildStage(); buildHaze();
const crowd = new Crowd(), parts = new Particles(), bolt = new Bolt(), smoke = new Smoke(), confetti = new Confetti();
const pyros = [-5.6, -2.0, 2.0, 5.6].map(x => new Pyro(x));
/* cada rockero se arma la primera vez que sale a escena (y se rehace si su configuración cambia) */
const rockers = {};
function ensureRocker(k) { if (!ROCKERS[k]) k = 'violeta'; if (!rockers[k]) { rockers[k] = new Rocker(ROCKERS[k], 'guitar'); rockers[k].root.visible = false; scene.add(rockers[k].root); } return rockers[k]; }
/* pone (o cambia) la configuración de un rockero con clave propia: 'yo', 'u_<uid>'… */
function setRocker(k, cfg) {
  const s = JSON.stringify(cfg);
  if (ROCKERS[k] && JSON.stringify(ROCKERS[k]) === s) return k;
  ROCKERS[k] = JSON.parse(s);
  if (rockers[k]) { rockers[k].dispose(); delete rockers[k]; }
  return k;
}
const singer = new Rocker(BAND.singer, 'singer'); singer.place(0, SY, 1.15, 0); scene.add(singer.root);
const drummer = new Rocker(BAND.drummer, 'drummer'); drummer.place(0, SY + 0.3, -2.85, 0); scene.add(drummer.root);
const SONG = buildSong();
const OPT = { L: 'violeta', Rr: 'rex', win: 'rand', cam: 'auto', titles: true, bars: true, loop: true, fixed: false };
const PL = () => ensureRocker(OPT.L), PR = () => ensureRocker(OPT.Rr);
let fxLight = 0;

/* =====================================================================
   EN VIVO — PRO HERO maneja la escena: el pulso sale de la canción que suena (sus tiempos del chart),
   el ánimo de cómo tocas y la batalla, de los puntajes de verdad. `VIVO.solo`: un solo rockero, sin rival
   (el modo de un jugador); si no, batalla contra el rival.
   ===================================================================== */
const VIVO = { on: false, solo: false, mt: 0, raw: -1, ko: null, animoT: 0, fin: null };
/* la coreografía es una canción de 63 compases: tras la entrada se repite del compás 5 al 59 */
const LOOP_A = 5 * BAR, LOOP_B = 59 * BAR;
const vivoMt = raw => raw < LOOP_B ? Math.max(0, raw) : LOOP_A + (raw - LOOP_A) % (LOOP_B - LOOP_A);
const SOLO = () => VIVO.on && VIVO.solo;
/* lo que tocan juntos en escena (sin rival, el de la derecha no sale) */
const enEscena = () => SOLO() ? [PL()] : [PL(), PR()];

/* =====================================================================
   GUION DE LA BATALLA
   ===================================================================== */
const battle = {
  start() {
    this.t0 = clock.t; this.winner = OPT.win === 'rand' ? (R() < 0.5 ? 0 : 1) : +OPT.win;
    this.mom = 0; this.momT = 0; this.seqs = []; this.ko = false; this.lastBar = -1; this.ei = 0; this.visPtr = 0;
    for (const k in rockers) rockers[k].root.visible = false;
    const L = PL(), Rk = PR(); L.root.visible = true; Rk.root.visible = !SOLO();
    if (SOLO()) L.place(0, SY, 0.95, 0); else { L.place(-3.4, SY, 0.72, 0.3); Rk.place(3.4, SY, 0.72, -0.3); }
    L.side = 0; Rk.side = 1; L.opp = Rk; Rk.opp = L;
    singer.root.visible = S.micSet.visible = !SOLO(); drummer.root.visible = true;
    for (const r of [L, Rk, singer, drummer]) { r.clearMoves(); r.st.riffPtr = 0; r.st.conf = 0; if (r.handPtr) r.handPtr = [0, 0]; }
    // ataques: al principio domina el que acabará perdiendo, luego remontada (en vivo los dispara la partida)
    const events = []; const n = ATTACK_BARS.length; let last = '';
    if (!VIVO.on) ATTACK_BARS.forEach((bar, i) => {
      const prog = i / (n - 1); const pW = prog < 0.35 ? 0.3 : prog < 0.7 ? 0.5 : 0.82;
      const from = i === n - 1 ? this.winner : (R() < pW ? this.winner : 1 - this.winner);
      let kind; do kind = pick(Object.keys(ATTACKS)); while (kind === last); last = kind;
      events.push({ t: bar * BAR - BEAT * 0.1, from, kind });
    });
    this.events = events;
    confetti.stop(); director.reset();
    if (SOLO()) titles.solo(OPT.L); else titles.vs(OPT.L, OPT.Rr);
  },
  mt() { return VIVO.on ? VIVO.mt : clock.t - this.t0; },
  /* la canción volvió atrás (repetición del bucle o el retroceso tras la pausa): los punteros, de cero */
  rewound() {
    this.lastBar = -1; this.visPtr = 0;
    for (const r of [PL(), PR(), singer, drummer]) { r.st.riffPtr = 0; if (r.handPtr) r.handPtr = [0, 0]; if (!this.ko) r.clearMoves(); }
    this.seqs = [];
  },
  attack(from, kind) {
    if (SOLO() || this.ko) return;
    const mt = this.mt(); const A = from === 0 ? PL() : PR(), T = from === 0 ? PR() : PL();
    this.seqs.push({ from, kind, t0: mt, A, T, stage: 0 });
    A.addMove('charge', mt, 1.25, { react: true });
    director.event('attacker', from, 0.7);
  },
  /* un jugador solo: el público y el rockero celebran (Star Power, rachas) */
  hype(kind, text, color) {
    if (this.ko) return;
    const mt = this.mt(), L = PL();
    if (kind === 'sp') { L.addMove('jump', mt, BEAT * 1.2, { react: true }); L.addMove('guitarRaise', mt + BEAT * 1.2, BAR, { react: true }); for (const p of pyros) p.fire(1.2); fxLight = 1; S.lights.fx.position.copy(L.gtr.g.localToWorld(V(0, 0, 0.05))); S.lights.fx.color.set(color || '#6fd8ff'); }
    else if (kind === 'racha') { L.addMove(R() < 0.5 ? 'spin' : 'legKick', mt, BEAT * 1.6, { react: true, dir: 1 }); pyros[R() < 0.5 ? 1 : 2].fire(1); }
    else if (kind === 'falla') { L.addMove(R() < 0.5 ? 'struggle' : 'lookGuitar', mt, BAR, { react: true }); return; }
    crowd.cheer = Math.max(crowd.cheer, kind === 'sp' ? 1 : 0.7);
    if (text) titles.call(text, color || '#ffd23a');
    director.event('target', 0, 1.2);
  },
  update(dt) {
    const mt = this.mt();
    while (this.ei < this.events.length && this.events[this.ei].t <= mt) { const e = this.events[this.ei++]; if (!this.ko) this.attack(e.from, e.kind); }
    for (const s of this.seqs) {
      const u = mt - s.t0;
      if (s.stage === 0) { s.A.gtr.tip.getWorldPosition(_a); if (Math.floor(u * 30) !== s.k) { s.k = Math.floor(u * 30); parts.emit(_a, 3, { color: ATTACKS[s.kind].color, speed: 1.2, life: 0.4, size: 0.06, grav: 0 }); } }
      if (s.stage === 0 && u > 0.55) {
        s.stage = 1; const K = ATTACKS[s.kind];
        const toAmp = s.kind === 'amp'; const ampObj = S.amps[s.T.side === 0 ? 0 : 1];
        bolt.fire(() => s.A.gtr.tip.getWorldPosition(V()), () => toAmp ? ampObj.localToWorld(V(0, 0.9, 0.3)) : s.T.gtr.g.localToWorld(V(0, 0, 0.05)), 0.85, K.bolt);
        director.event('faceoff', s.from, 0.9); director.shake = 0.6;
      }
      if (s.stage === 1 && u > 0.7) {
        s.stage = 2; const K = ATTACKS[s.kind]; const T = s.T; const impact = T.gtr.g.localToWorld(V(0, 0, 0.05));
        parts.emit(impact, 70, { color: K.color, color2: 0xffffff, speed: 4, life: 0.9, size: 0.07 });
        if (!VIVO.on) this.momT = clamp(this.momT + (s.from === 0 ? 1 : -1) * 0.24, -0.85, 0.85);
        crowd.cheer = 0.8; titles.call(K.name, K.color);
        S.lights.fx.position.copy(impact); S.lights.fx.color.set(K.color); fxLight = 1;
        switch (s.kind) {
          case 'shock': T.addMove('shock', mt, 1.7, { react: true }); s.zap = mt + 1.6; break;
          case 'fire': { const py = pyros.reduce((a, b) => Math.abs(b.x - T.base.x) < Math.abs(a.x - T.base.x) ? b : a); py.fire(1.3); T.addMove('stagger', mt, 1.6, { react: true }); smoke.puff(V(T.base.x, SY + 1, 2), { size: 2, life: 3, op: 0.25, color: 0x554433 }); break; }
          case 'broken': T.addMove('stagger', mt, 0.6, { react: true }); T.addMove('repair', mt + 0.45, 2.6, { react: true }); parts.emit(impact, 40, { color: 0xffffff, speed: 2, life: 0.6, size: 0.04 }); break;
          case 'lefty': T.addMove('spin', mt, 0.8, { react: true, dir: T.side ? 1 : -1 }); T.addMove('dizzy', mt + 0.7, 2.2, { react: true }); break;
          case 'amp': { const ap = S.amps[T.side].localToWorld(V(0, 1.0, 0.3)); parts.emit(ap, 90, { color: 0xffd060, color2: K.color, speed: 4.5, life: 1.2, size: 0.07 }); for (let k = 0; k < 6; k++) smoke.puff(ap.clone().add(V(rr(-0.3, 0.3), rr(0, 0.5), 0)), { size: 1.4, life: 4, op: 0.45, color: 0x333338, rise: 0.5 }); s.ampT = mt + 3.5; s.ampPos = ap; T.addMove('stagger', mt, 1.3, { react: true }); T.addMove('lookGuitar', mt + 1.2, 1.2, { react: true }); break; }
        }
      }
      if (s.stage === 2 && u > 1.35) { s.stage = 3; director.event('target', 1 - s.from, 1.5); }
      if (s.zap && mt < s.zap) { const tp = s.T.gtr.g.localToWorld(V(rr(-0.2, 0.2), rr(-0.3, 0.6), 0.1)); parts.emit(tp, 2, { color: 0x6fd8ff, speed: 2.5, life: 0.25, size: 0.05, grav: 0 }); fxLight = Math.max(fxLight, 0.4 + 0.4 * R()); }
      if (s.ampT && mt < s.ampT && R() < 0.15) { parts.emit(s.ampPos, 6, { color: 0xffc060, speed: 2, life: 0.5, size: 0.05 }); smoke.puff(s.ampPos.clone().add(V(rr(-0.3, 0.3), 0.2, 0)), { size: 1.2, life: 3, op: 0.35, color: 0x2a2a2e }); }
    }
    this.seqs = this.seqs.filter(s => mt - s.t0 < 4);
    this.mom = damp(this.mom, this.momT, 1.2, dt);
    const L = PL(), Rk = PR();
    L.st.conf = this.mom; Rk.st.conf = -this.mom;
    // KO (en vivo, cuando PRO HERO lo pide al terminar la canción)
    const koT = KO_BAR * BAR;
    if (!this.ko && (VIVO.on ? VIVO.ko !== null : mt >= koT)) {
      this.ko = true;
      if (VIVO.on) this.winner = VIVO.ko;
      if (SOLO()) {
        L.clearMoves(); L.addMove('jump', mt, 0.55, { react: true }); L.addMove('victory', mt + 0.4, 999, { react: true });
        for (const p of pyros) p.fire(2.2); confetti.burst(); crowd.cheer = 1.4; titles.fin(VIVO.fin || '¡OVACIÓN!', OPT.L);
        director.event('winner', 0, 6);
        return;
      }
      this.momT = this.winner === 0 ? 1 : -1;
      const W = this.winner === 0 ? L : Rk, Lo = this.winner === 0 ? Rk : L;
      W.clearMoves(); Lo.clearMoves(); W.addMove('jump', mt, 0.55, { react: true }); W.addMove('victory', mt + 0.4, 999, { react: true }); Lo.addMove('stagger', mt, 0.9, { react: true }); Lo.addMove('defeat', mt + 0.7, 999, { react: true });
      for (const p of pyros) p.fire(2.2); confetti.burst(); crowd.cheer = 1.4; titles.ko(this.winner === 0 ? OPT.L : OPT.Rr);
      director.event('winner', this.winner, 6);
    }
    if (this.ko && !VIVO.on && mt > koT + 12 && OPT.loop) this.start();
  },
  onBar(bar, sec, mt) {
    // coreografía: cada guitarrista elige un movimiento según la sección y cómo va la batalla
    for (const r of enEscena()) {
      if (this.ko) continue;
      if (r.busyUntil() > mt + 0.05 || r.moves.some(m => m.react && mt < m.t0 + m.dur)) continue;
      const c = r.st.conf, I = SECTION_I[sec.name];
      const secStart = bar === sec.bar0;
      if (secStart && (sec.name === 'chorus' || sec.name === 'outro')) { r.addMove(c > -0.1 ? 'jump' : 'stomp', mt, c > -0.1 ? BEAT * 1.2 : BAR); if (c > 0.15 && R() < 0.5) r.addMove('spin', mt + BEAT * 1.3, BEAT * 1.4, { dir: r.side ? -1 : 1 }); continue; }
      if (sec.name === 'solo') { const lead = c >= 0; if (bar === sec.bar0 + 7 && lead) { r.addMove('kneel', mt, BAR); r.addMove('leanBack', mt, BAR); continue; } const k = wpick({ leanBack: lead ? 2 : 0.6, headbang: 1, guitarRaise: lead ? 1 : 0.2, struggle: lead ? 0 : 1.2, lookGuitar: lead ? 0.2 : 0.8 }); r.addMove(k, mt, k === 'leanBack' ? BAR * 2 : BAR); continue; }
      const k = wpick({ none: 1.2, headbang: 1.1 * I, legKick: (c > 0 ? 0.7 : 0.15) * I, guitarRaise: c > 0 ? 0.6 : 0.1, taunt: !SOLO() && c > 0.15 ? 0.8 : 0.08, stomp: 0.5, point: !SOLO() && c > 0.3 ? 0.4 : 0, struggle: c < -0.2 ? 1.4 : 0, lookGuitar: c < -0.2 ? 0.6 : 0.05, spin: sec.name === 'chorus' && c > 0.3 ? 0.25 : 0 });
      const dur = { headbang: BAR * 2, legKick: BEAT * 1.6, guitarRaise: BAR, taunt: BAR * 2, stomp: BAR, point: BEAT * 2.5, struggle: BAR * 2, lookGuitar: BAR, spin: BEAT * 1.4 }[k];
      if (k !== 'none') r.addMove(k, mt + (k === 'legKick' ? BEAT * 2 : 0), dur, { dir: r.side ? -1 : 1 });
    }
  },
};

/* =====================================================================
   DIRECTOR DE CÁMARA
   ===================================================================== */
const headPos = rk => rk.face.getWorldPosition(V());
const SIDEOF = i => (i === 0 ? PL() : PR());
const SHOTS = {
  establish: u => { const k = smooth(clamp(u / 9, 0, 1)); return { p: V(lerp(-7, 0, k), lerp(14, 6.3, k), lerp(27, 16.5, k)), l: V(0, SY + 1.2, 0), f: 44, hh: 0.2 }; },
  wide: (u, r) => ({ p: V(r.s * 2.5 + Math.sin(u * 0.08) * 1.5, 6.3 - u * 0.04, 17 - u * 0.25), l: V(0, SY + 1.1, 0), f: 42, hh: 0.4 }),
  crowdLow: (u, r) => ({ p: V(r.s * 3 - r.s * u * 0.3, 1.55, 9.5), l: V(0, SY + 1.5, 0), f: 46, hh: 1 }),
  duo: (u, r) => ({ p: V(-1.2 * r.s + u * 0.12 * r.s, SY + 0.75, 6.4 - u * 0.08), l: V(0, SY + 1.45, 0), f: 50, hh: 0.6 }),
  close: (u, r) => { const R2 = SIDEOF(r.who); const h = headPos(R2); const s = r.who === 0 ? 1 : -1; return { p: V(h.x + s * (1.05 - u * 0.05), SY + 0.62, h.z + 2.0 - u * 0.06), l: V(h.x + s * 0.05, h.y - 0.35, h.z), f: 40, hh: 0.8 }; },
  hero: (u, r) => { const R2 = SIDEOF(r.who); const h = headPos(R2), b = R2.root.position; const s = r.who === 0 ? 1 : -1; return { p: V(b.x + s * 0.7, SY + 0.22, b.z + 1.35 + u * 0.03), l: V(h.x, h.y - 0.1, h.z), f: 56, hh: 0.7 }; },
  over: (u, r) => { const b = SIDEOF(r.who).root.position; const s = r.who === 0 ? 1 : -1; return { p: V(b.x - s * 1.4, SY + 2.5, b.z - 2.3 + u * 0.08), l: V(b.x + s * 2.2, SY + 0.4, b.z + 9), f: 58, hh: 0.6 }; },
  guitar: (u, r) => { const R2 = SIDEOF(r.who); const g = R2.gtr.g.localToWorld(V(0.28, 0, 0)); const f = R2.root.localToWorld(V(0, 0, 1)).sub(R2.root.position); return { p: g.clone().addScaledVector(f, 0.85 - u * 0.03).add(V(0, 0.2, 0)), l: R2.gtr.g.localToWorld(V(0.3 + Math.sin(u * 0.4) * 0.15, 0, 0)), f: 34, hh: 0.5 }; },
  singer: u => { const h = headPos(singer); return { p: V(0.95 - u * 0.05, SY + 0.5, h.z + 1.9), l: V(h.x, h.y - 0.2, h.z), f: 46, hh: 0.7 }; },
  drums: u => { const h = headPos(drummer); return { p: V(-1.7 + u * 0.08, SY + 1.9, -0.6), l: V(h.x, h.y - 0.45, h.z), f: 50, hh: 0.5 }; },
  faceoff: u => ({ p: V(Math.sin(u * 0.3) * 0.4, SY + 0.95, 4.3 - u * 0.12), l: V(0, SY + 1.35, 0.6), f: 60, hh: 0.5 }),
  side: (u, r) => { const s = r.who === 0 ? -1 : 1; return { p: V(s * 7.6, SY + 1.45, 1.4 + u * 0.05), l: V(0, SY + 1.3, 0.7), f: 40, hh: 0.5 }; },
  crane: u => { const a = u * 0.11 + 0.5; return { p: V(Math.sin(a) * 13, 5 + Math.sin(u * 0.2) * 1.5, Math.cos(a) * 13 + 1), l: V(0, SY + 1.2, -0.5), f: 42, hh: 0.2 }; },
  track: (u, r) => { const k = clamp(u / 7, 0, 1); return { p: V(lerp(-6, 6, k) * r.s, SY + 1.2, 4.3), l: V(lerp(-4, 4, k) * r.s, SY + 1.3, 0.5), f: 45, hh: 0.4 }; },
};
const SHOT_SETS = {
  intro: ['wide', 'crane', 'crowdLow', 'track', 'singer', 'drums'],
  verse: ['duo', 'close', 'close', 'singer', 'drums', 'guitar', 'over', 'wide', 'crowdLow', 'side', 'track'],
  pre: ['close', 'hero', 'guitar', 'drums', 'side', 'crowdLow'],
  chorus: ['close', 'hero', 'singer', 'wide', 'crowdLow', 'faceoff', 'over', 'crane', 'guitar'],
  solo: ['hero', 'close', 'guitar', 'faceoff', 'hero', 'side', 'over'],
  break: ['drums', 'side', 'crowdLow', 'hero', 'guitar'],
  outro: ['hero', 'close', 'crane', 'wide'],
};
const director = {
  name: 'establish', t0: 0, r: { s: 1, who: 0 }, nextBar: 0, until: 0, shake: 0,
  reset() { this.cut('establish', { s: 1, who: 0 }); this.until = clock.t + 9; this.nextBar = 3; },
  cut(n, r) { this.name = n; this.t0 = clock.t; this.r = r; },
  event(kind, who, dur) {
    if (OPT.cam !== 'auto') return;
    if (SOLO()) who = 0;
    if (kind === 'attacker') this.cut('close', { s: 1, who });
    else if (kind === 'faceoff') this.cut(R() < 0.6 ? 'faceoff' : 'side', { s: 1, who });
    else if (kind === 'target') this.cut(R() < 0.5 ? 'close' : 'hero', { s: 1, who });
    else if (kind === 'winner') this.cut('hero', { s: 1, who });
    this.until = clock.t + dur;
  },
  onBar(bar, sec) {
    if (OPT.cam !== 'auto') return;
    if (clock.t < this.until || bar < this.nextBar) return;
    let set = SHOT_SETS[sec.name] || SHOT_SETS.verse; if (SOLO()) set = set.filter(n => n !== 'singer' && n !== 'faceoff');
    let n; do n = pick(set); while (n === this.name && set.length > 1);
    const lead = battle.mom > 0 ? 0 : 1; const who = SOLO() ? 0 : R() < 0.6 + Math.abs(battle.mom) * 0.3 ? lead : 1 - lead;
    if (battle.ko) n = pick(['hero', 'close', 'crane', 'wide', 'crowdLow']);
    this.cut(n, { s: R() < 0.5 ? 1 : -1, who: battle.ko ? battle.winner : who });
    this.nextBar = bar + (SECTION_I[sec.name] > 0.9 ? 1 + (R() < 0.5 ? 1 : 0) : 2);
  },
  update(t, dt) {
    let name = this.name, r = this.r;
    if (OPT.cam !== 'auto') { const [n, w] = OPT.cam.split(':'); name = n; r = { s: 1, who: +(w || 0) }; if (this.fixedName !== OPT.cam) { this.fixedName = OPT.cam; this.t0 = t; } }
    const s = SHOTS[name](t - this.t0, r);
    this.shake = Math.max(0, this.shake - dt * 2);
    const hh = (s.hh ?? 0.5) * 0.025;
    s.p.x += (Math.sin(t * 1.3) + Math.sin(t * 2.9) * 0.5) * hh + (R() - 0.5) * this.shake * 0.1;
    s.p.y += (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.3) * 0.4) * hh + (R() - 0.5) * this.shake * 0.1;
    camera.position.copy(s.p); camera.lookAt(s.l);
    if (camera.fov !== s.f) { camera.fov = s.f; camera.updateProjectionMatrix(); }
    parts.u.uScale.value = (VPH * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  },
};

/* =====================================================================
   TÍTULOS (dibujados en el lienzo → salen en la grabación)
   ===================================================================== */
const titles = {
  cur: null,
  vs(a, b) { this.cur = { type: 'vs', t0: clock.t, a: ROCKERS[a], b: ROCKERS[b] }; },
  call(text, color) { this.cur = { type: 'call', t0: clock.t, text, color }; },
  ko(w) { this.cur = { type: 'ko', t0: clock.t, w: ROCKERS[w] }; },
  solo(a) { this.cur = { type: 'solo', t0: clock.t, a: ROCKERS[a] }; },
  fin(text, w) { this.cur = { type: 'fin', t0: clock.t, text, w: ROCKERS[w] }; },
};
let barsK = 0;
function comic(g, text, x, y, size, fill, rot = 0, sc = 1, align = 'center', alpha = 1) {
  g.save(); g.globalAlpha = clamp(alpha, 0, 1); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
  g.font = `${size}px Bangers, Impact, sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * 0.16; g.strokeStyle = '#000'; g.strokeText(text, size * 0.06, size * 0.07); g.strokeText(text, 0, 0);
  g.fillStyle = fill; g.fillText(text, 0, 0); g.restore();
}
let ovKey = '';
/* devuelve si hay algo que mostrar; el lienzo solo se redibuja y se sube a la GPU cuando cambia (barras quietas = cero trabajo) */
function drawOverlay(dt) {
  const g = ovCtx, W = ovCanvas.width, H = ovCanvas.height;
  barsK = damp(barsK, OPT.bars && !ED.open ? 1 : 0, 5, dt || 0.016);
  const T = titles.cur, tOn = !!T && OPT.titles && !ED.open, bOn = barsK > 0.002;
  const key = tOn ? 'T' + clock.t : bOn ? W + 'x' + H + ':' + Math.round(barsK * 2000) : '';
  if (key === ovKey) return key !== '';
  ovKey = key; g.clearRect(0, 0, W, H); ovTex.needsUpdate = true;
  if (bOn) { g.fillStyle = '#000'; const bh = H * 0.11 * barsK; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh); }
  if (!tOn) return bOn;
  overlayTitle(g, W, H, T); return true;
}
function overlayTitle(g, W, H, T) {
  const age = clock.t - T.t0, U = H / 1080;
  if (T.type === 'vs') {
    if (age > 5) { titles.cur = null; return; }
    const out = age > 4.4 ? smooth((age - 4.4) / 0.6) : 0, inA = smooth(clamp(age / 0.5, 0, 1)), inB = smooth(clamp((age - 0.25) / 0.5, 0, 1));
    const vsS = age < 0.7 ? 0 : 1 + 2.5 * Math.max(0, 1 - (age - 0.7) / 0.18);
    comic(g, T.a.name.toUpperCase(), lerp(-W * 0.3, W * 0.27, inA) - out * W * 0.5, H * 0.48, 120 * U, T.a.ui, -0.06);
    comic(g, T.b.name.toUpperCase(), lerp(W * 1.3, W * 0.73, inB) + out * W * 0.5, H * 0.6, 120 * U, T.b.ui, -0.06);
    if (vsS > 0) comic(g, 'VS', W / 2, H * 0.54, 190 * U, '#ffd23a', -0.1, vsS, 'center', 1 - out);
    comic(g, 'BATALLA EN EL PATIO', W / 2, H * 0.2, 54 * U, '#ffffff', 0, 1, 'center', clamp(age - 1, 0, 1) * (1 - out));
  } else if (T.type === 'solo') {
    if (age > 5) { titles.cur = null; return; }
    const out = age > 4.4 ? smooth((age - 4.4) / 0.6) : 0, inA = smooth(clamp(age / 0.5, 0, 1));
    comic(g, T.a.name.toUpperCase(), lerp(-W * 0.3, W / 2, inA) - out * W * 0.6, H * 0.5, 130 * U, T.a.ui, -0.06);
    comic(g, 'EN EL ESCENARIO', W / 2, H * 0.22, 54 * U, '#ffffff', 0, 1, 'center', clamp(age - 0.6, 0, 1) * (1 - out));
  } else if (T.type === 'fin') {
    if (age > 9) { titles.cur = null; return; }
    const sc = age < 0.2 ? lerp(3, 1, age / 0.2) : 1;
    comic(g, T.text, W / 2, H * 0.36, 170 * U, '#ffd23a', -0.07, sc, 'center', age > 7 ? 1 - (age - 7) / 2 : 1);
    if (age > 1) { const k = smooth(clamp((age - 1) / 0.5, 0, 1)); comic(g, T.w.name.toUpperCase(), W / 2, H * 0.52, 110 * U, T.w.ui, -0.05, k, 'center', age > 7 ? 1 - (age - 7) / 2 : 1); }
  } else if (T.type === 'call') {
    if (age > 1.8) { titles.cur = null; return; }
    const sc = age < 0.15 ? lerp(2.4, 1, age / 0.15) : 1 + (age - 0.15) * 0.06, a = age > 1.4 ? 1 - (age - 1.4) / 0.4 : 1;
    comic(g, T.text, W / 2, H * 0.27, 130 * U, T.color, -0.07, sc, 'center', a);
  } else if (T.type === 'ko') {
    if (age > 11) { titles.cur = null; return; }
    const sc = age < 0.2 ? lerp(3, 1, age / 0.2) : 1;
    if (age < 3.5) comic(g, '¡K.O.!', W / 2, H * 0.42, 260 * U, '#ffd23a', -0.08, sc, 'center', age > 3 ? 1 - (age - 3) * 2 : 1);
    if (age > 3) { const k = smooth(clamp((age - 3) / 0.5, 0, 1)); comic(g, '¡GANA', W / 2, H * 0.3, 90 * U, '#ffffff', -0.05, k); comic(g, T.w.name.toUpperCase() + '!', W / 2, H * 0.44, 150 * U, T.w.ui, -0.05, k); }
  }
}


let VPW = 0, VPH = 0;

/* =====================================================================
   EDITOR DE PERSONAJES — vista previa en el escenario + panel con catálogo por cuerpo
   ===================================================================== */
const ED = { open: false, L: null, key: null, rk: null, tab: 'cuerpo', view: 'cuerpo', yaw: 0.35, zoom: 1, mt0: 0, tm: 0, snap: true, drag: null, cp: V(), cl: V(), tat: { design: null, spot: null, color: 0x1a1420 } };
const ED_POS = V(0, SY, 1.2);
const ED_TABS = [['cuerpo', 'Cuerpo'], ['cara', 'Cara'], ['pelo', 'Pelo'], ['ropa', 'Ropa'], ['guitarra', 'Guitarra'], ['acc', 'Accesorios'], ['tat', 'Tatuajes'], ['cajas', '📦 Cajas']];
const ED_VIEWS = [['cuerpo', 'Cuerpo'], ['cara', 'Cara'], ['manos', 'Manos'], ['pies', 'Pies']];
/* encuadres: punto que se sigue (en vivo, sobre el hueso), distancia, altura, campo de visión y giro inicial */
const ED_FOCUS = {
  cuerpo: rk => ({ l: rk.root.position.clone().add(V(0, 0.92, 0)), d: 3.9, h: 0.25, fov: 36, yaw: 0.35 }),
  cara: rk => ({ l: rk.face.localToWorld(V(0, -0.025, 0.05)), d: 0.85, h: 0.02, fov: 30, yaw: 0.25 }),
  ojos: rk => ({ l: rk.face.localToWorld(V(0, 0.012, 0.09)), d: 0.5, h: 0.0, fov: 28, yaw: 0.15 }),
  pelo: rk => ({ l: rk.face.localToWorld(V(0, -0.07, -0.01)), d: 1.4, h: 0.12, fov: 32, yaw: 0.6 }),
  torso: rk => ({ l: rk.torso.localToWorld(V(0, 0.36, 0.05)), d: 1.7, h: 0.08, fov: 32, yaw: 0.3 }),
  piernas: rk => ({ l: rk.root.position.clone().add(V(0, 0.55, 0.03)), d: 2.3, h: 0.1, fov: 34, yaw: 0.35 }),
  pies: rk => ({ l: rk.root.position.clone().add(V(0, 0.07, 0.06)), d: 1.5, h: 0.32, fov: 34, yaw: 0.5 }),
  manos: rk => ({ l: rk.handB[0].getWorldPosition(V()).add(rk.handB[1].getWorldPosition(V())).multiplyScalar(0.5), d: 1.0, h: 0.1, fov: 32, yaw: 0.2 }),
  guitarra: rk => ({ l: rk.gtr.g.localToWorld(V(0.2, 0, 0)), d: 1.6, h: 0.1, fov: 34, yaw: 0.15 }),
  caja: () => boxFocus(),
  cuello: rk => ({ l: rk.neck.localToWorld(V(0, 0.01, 0.03)), d: 0.7, h: 0.03, fov: 30, yaw: 0.25 }),
  oreja: rk => { const lg = ['long', 'longF'].includes(rk.cfg.hair?.style); return { l: rk.face.localToWorld(V(lg ? -0.07 : -0.1, -0.045, lg ? 0.03 : 0)), d: lg ? 0.8 : 0.65, h: 0.0, fov: 30, yaw: lg ? -0.55 : -1.25 }; },   // con melena se mira más de frente (el pelo tapa el costado)
  muneca: rk => ({ l: rk.fa[1].localToWorld(V(0, -0.275, 0)), d: 0.95, h: 0.12, fov: 30, yaw: 0.25 }),
};
const TAB_FOCUS = { cuerpo: 'cuerpo', cara: 'cara', pelo: 'pelo', ropa: 'cuerpo', guitarra: 'guitarra', acc: 'cuello', cajas: 'cuerpo' };
/* qué parte enfocar según el control que se toca */
const pathFocus = p => p === 'face.faceShape' || p.startsWith('face.mk') || p === 'face.lipColor' || p.startsWith('beard') ? 'cara' : p.startsWith('face.') ? 'ojos'
  : p.startsWith('hair') ? 'pelo' : p.startsWith('top') ? 'torso' : p.startsWith('bottom') || p === 'belt' || p.startsWith('legwear') ? 'piernas' : p.startsWith('shoes') ? 'pies'
  : p.startsWith('gloves') ? 'manos' : p.startsWith('guitar') ? 'guitarra' : p.startsWith('necklace') ? 'cuello' : p.startsWith('earrings') ? 'oreja' : p.startsWith('bracelets') ? 'muneca' : 'cuerpo';
function edFocus(key, yaw) { if (ED.view === key && yaw === undefined) return; ED.view = key; ED.zoom = 1; ED.yaw = yaw ?? focusYaw(key); }
const focusYaw = key => ED.rk ? (ED_FOCUS[key] || ED_FOCUS.cuerpo)(ED.rk).yaw : 0.35;
/* al elegir zona de tatuaje la cámara gira hacia ella: [vista, giro] */
const TAT_VIEW = { brazoI: ['cuerpo', 1.25], antebrazoI: ['cuerpo', 1.25], manoI: ['manos', 1.3], musloI: ['cuerpo', 1.1], brazoD: ['cuerpo', -1.25], antebrazoD: ['cuerpo', -1.25], manoD: ['manos', -0.9], musloD: ['cuerpo', -1.1], espalda: ['cuerpo', Math.PI], cuello: ['cara', 1.1], mejilla: ['cara', -0.35], pecho: ['cuerpo', 0.2], clavicula: ['cuerpo', 0.3] };
function edViewOffset(W, H) {
  if (!ED.open) { camera.clearViewOffset(); return; }
  if (W > 700) camera.setViewOffset(W, H, Math.round(Math.min(400, innerWidth) / 2 * W / Math.max(1, innerWidth)), 0, W, H);
  else camera.setViewOffset(W, H, 0, Math.round(H * 0.26), W, H);
}
function edRebuild() {
  const old = ED.rk;
  const cfg = JSON.parse(JSON.stringify(ED.L));
  if (ED.tab === 'tat' && ED.tat.spot === 'mejilla' && cfg.tattoos.length < 5 && !cfg.tattoos.some(t => t.spot === 'mejilla')) cfg.tattoos.push({ design: ED.tat.design, spot: 'mejilla', color: ED.tat.color });   // vista previa bajo el ojo
  try { ED.rk = new Rocker(cfg, 'guitar'); } catch (err) { console.error(err); return; }
  scene.add(ED.rk.root); ED.rk.place(ED_POS.x, ED_POS.y, ED_POS.z, 0); ED.rk.st.I = 0.55;
  if (old) old.dispose();
  ED.prev = null; edTatPreview();
}
function edChanged(render = true) { clearTimeout(ED.tm); ED.tm = setTimeout(edRebuild, 80); if (render) edRender(); }
function edSet(p, v) {
  setP(ED.L, p, v); if (p === 'guitar.body') delete ED.L.guitar.head;
  const f = ED_FIELDS.find(x => x[0] === p);
  if (f && ED_CAT[ED.L.body][f[1]].find(o => o[0] === v)?.[2]) { legDefaults(ED.L, p); edToast('★ ¡Legendario!'); }
  const k = p.split('.')[0];
  if (INV_CATS[k] && p === k + '.type') { const vs = invVariants(ED.L.body, k, v); if (vs.length) Object.assign(ED.L[k], vs.at(-1).c); }   // se pone con los colores de tu última variante
  edChanged();
}
let toastT = 0;
function edToast(msg) { const t = $('#edToast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); }
/* cambiar de cuerpo: todo lo propio de un cuerpo vuelve al catálogo del otro; se conservan colores, piel y nombre */
function edSwitchBody(g) {
  const o = ED.L, L = defaultLook(g), C = ED_CAT[g];
  if (o.name !== defaultLook(o.body).name) L.name = o.name;
  Object.assign(L, { skin: o.skin, ui: o.ui, belt: o.belt });
  Object.assign(L.face, { eyes: o.face.eyes, eyes2: o.face.eyes2, brow: o.face.brow });
  Object.assign(L.hair, { color: o.hair.color, color2: o.hair.color2 });
  L.top.color = o.top.color; L.bottom.color = o.bottom.color; L.shoes.color = o.shoes.color; L.guitar.body = o.guitar.body;
  if (L.beard) L.beard.color = shade(o.hair.color, 0.85);
  const has = (list, v) => list.some(d => d[0] === v);
  L.tattoos = o.tattoos.map(t => ({ ...t, design: has(C.tatDesign, t.design) ? t.design : C.tatDesign[0][0], spot: has(C.tatSpot, t.spot) ? t.spot : C.tatSpot[0][0] }));
  ED.L = L; edChanged();
}
function edRender() {
  const L = ED.L, g = L.body, C = ED_CAT[g], f = g === 'f';
  $('#edTabs').innerHTML = ED_TABS.map(([k, n]) => `<button class="${ED.tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('');
  $('#edViews').innerHTML = ED_VIEWS.map(([k, n]) => `<button class="${ED.view === k ? 'on' : ''}" data-view="${k}">${n}</button>`).join('') + '<button data-rot="-1" aria-label="Girar a la izquierda">⟲</button><button data-rot="1" aria-label="Girar a la derecha">⟳</button>';
  if (document.activeElement !== $('#edName')) $('#edName').value = L.name;
  const locked = (path, v) => { const k = path.split('.')[0]; return INV_CATS[k] && path === k + '.type' && !invHas(g, k, v); };
  const chips = (label, path, list, attr = 'p', cur = getP(L, path)) => `<div class="eg"><b>${label}</b><div class="chips">${list.map(([v, n, lg]) => `<button class="chip${lg ? ' leg' : ''}${cur === v ? ' on' : ''}${attr === 'p' && cur !== v && locked(path, v) ? ' lock' : ''}" data-${attr}="${path}" data-v="${v}">${n}</button>`).join('')}</div></div>`;
  /* colores de una pieza del inventario: cada variante ganada en las cajas (las tuyas se pueden vender en el mercado) */
  const vars = k => {
    const t = L[k]?.type; if (!t || t === 'none') return '';
    const vs = invTodas(g, k, t), cur = invId(invVar(g, k, L[k]));
    let h = `<div class="eg"><b>Tus variantes (${vs.length})</b>` + (vs.length ? `<div class="sws">${vs.map((v, i) => `<button class="sw${invId(v) === cur && !v.venta ? ' on' : ''}${v.venta ? ' venta' : ''}" style="background:${invBg(v.c)}" data-var="${k}" data-i="${i}" aria-label="Variante ${i + 1}${v.venta ? ' (a la venta)' : ''}" title="${v.venta ? 'A la venta en el mercado' : v.copia ? 'De una caja' : 'Inicial'}"></button>`).join('')}</div>` : note('Esta pieza no está en tu inventario: sale en las cajas.')) + '</div>';
    const mia = vs.find(v => invId(v) === cur && v.copia && !v.venta);
    if (mia) h += `<div class="sell"><span>🏪 Vender esta variante en el mercado</span><input type="number" min="1" max="100000" step="1" value="${mia.leg ? 1500 : 400}" aria-label="Precio" data-precio="${esc(mia.copia)}"><button class="chip" data-vende="${esc(mia.copia)}">Vender <i class="coin"></i></button></div>`;
    else if (vs.some(v => invId(v) === cur && !v.copia)) h += note('Esta variante es inicial: la tiene todo el mundo y no se vende.');
    if (vs.some(v => v.venta)) h += note('🏪 = a la venta en el mercado: no se puede usar hasta que la retires (en el Mercado de Juegos). <button class="chip" data-mercado="1">Ir al mercado</button>');
    return h;
  };
  const colors = (label, path, pal, attr = 'p', cur = getP(L, path)) => `<div class="eg"><b>${label}</b><div class="sws">${pal.map(c => `<button class="sw${cur === c ? ' on' : ''}" style="background:${cssC(c)}" data-${attr}="${path}" data-c="${c}" title="${cssC(c)}"></button>`).join('')}<label class="sw pick" title="Otro color"><input type="color" data-${attr}="${path}" value="${cssC(cur ?? 0)}"></label></div></div>`;
  const note = t => `<div class="ehint">${t}</div>`;
  let h = '';
  if (ED.tab === 'cuerpo') {
    h = chips('Cuerpo', 'body', [['m', '♂ Hombre'], ['f', '♀ Mujer']]) + note('Cada cuerpo tiene su propio catálogo: al cambiarlo, la ropa, el peinado y los accesorios pasan a los de ese cuerpo.')
      + colors('Piel', 'skin', PAL.skin) + colors('Color del nombre', 'ui', PAL.ui)
      + `<div class="eg"><b>Partir desde</b><div class="chips">${['violeta', 'rex', 'kid'].map(k => `<button class="chip" data-base="${k}">${ROCKERS[k].name}</button>`).join('')}<button class="chip" data-blank="1">✚ En blanco</button></div></div>`
      + note('Tu rockero toca de fondo en PRO HERO (actívalo en Ajustes) y en las salas se enfrenta al de tu rival.');
  } else if (ED.tab === 'cara') {
    h = chips('Forma de la cara', 'face.faceShape', C.faceShape) + chips('Forma de los ojos', 'face.eyeShape', C.eyeShape) + chips('Tipo de ojo', 'face.eyeStyle', C.eyeStyle) + colors('Color de ojos', 'face.eyes', PAL.eyes);
    if (['degradado', 'estrella', 'anillo', 'hetero', 'eclipse', 'galaxia', 'latido', 'vortice', 'prisma'].includes(L.face.eyeStyle)) h += colors(L.face.eyeStyle === 'hetero' ? 'Color del otro ojo' : 'Segundo color del ojo', 'face.eyes2', PAL.eyes);
    h += chips('Cejas', 'face.browStyle', C.browStyle) + colors('Color de cejas', 'face.brow', PAL.brow) + chips(f ? 'Maquillaje' : 'Pintura', 'face.mkStyle', C.mkStyle);
    if (['natural', 'ahumado', 'gotico', 'glam', 'estrellaMk', 'guerra', 'calaNeon', 'runas', 'cristales', 'aurora', 'grietas', 'mariposaMk'].includes(L.face.mkStyle)) h += colors(['calaNeon', 'runas', 'cristales', 'aurora', 'grietas', 'mariposaMk'].includes(L.face.mkStyle) ? 'Color del brillo' : L.face.mkStyle === 'guerra' ? 'Color de la pintura' : L.face.mkStyle === 'estrellaMk' ? 'Color de la estrella' : 'Color de la sombra', 'face.mkColor', PAL.mk);
    h += f ? colors('Labios', 'face.lipColor', PAL.lips) : chips('Barba', 'beard.type', C.beard) + (L.beard.type !== 'none' ? colors('Color de barba', 'beard.color', PAL.brow.concat(PAL.hair.slice(4, 10))) : '');
  } else if (ED.tab === 'pelo') {
    h = chips('Peinado', 'hair.style', C.hair) + (L.hair.style !== 'bald' ? colors('Color principal', 'hair.color', PAL.hair) + colors('Reflejos', 'hair.color2', PAL.hair) : note('Rapado: sin mechones, solo la cabeza.'));
    if (['pigtails', 'ponytail', 'odango'].includes(L.hair.style)) h += colors(L.hair.style === 'ponytail' ? 'Color de la liga' : 'Adornos', 'hair.accent', PAL.cloth);
    if (L.hair.style === 'pigtails') h += colors('Cintas', 'hair.ribbon', PAL.cloth);
  } else if (ED.tab === 'ropa') {
    h = chips('Torso', 'top.type', C.top) + vars('top');
    h += chips(f ? 'Faldas y pantalones' : 'Pantalones', 'bottom.type', C.bottom) + vars('bottom');
    h += colors('Cinturón', 'belt', PAL.cloth);
    if (f) h += chips('Medias', 'legwear.type', C.legwear) + vars('legwear');
    h += chips('Botas y zapatos', 'shoes.type', C.shoes) + vars('shoes') + chips('Guantes', 'gloves.type', C.gloves) + vars('gloves');
  } else if (ED.tab === 'guitarra') {
    h = chips('Modelo', 'guitar.type', C.guitar) + vars('guitar');
  } else if (ED.tab === 'acc') {
    for (const [k, lab] of [['necklace', 'Collar'], ['earrings', 'Aros'], ['bracelets', 'Pulseras']]) { h += chips(lab, k + '.type', C[k]) + vars(k); }
    if ((L.top.type === 'jacket' || L.top.type === 'chaquetaNeon') && L.bracelets.type !== 'none') h += note('Los puños de la chaqueta tapan las pulseras.');
    if (['long', 'longF'].includes(L.hair.style) && L.earrings.type !== 'none') h += note('Con el pelo largo los aros quedan casi tapados.');
  } else if (ED.tab === 'tat') {
    const T = ED.tat, nm = (list, v) => (list.find(o => o[0] === v) || [v, v])[1];
    if (!C.tatDesign.some(o => o[0] === T.design)) T.design = C.tatDesign[0][0];
    if (!C.tatSpot.some(o => o[0] === T.spot)) T.spot = C.tatSpot[0][0];
    h = `<div class="eg"><b>Tus tatuajes (${L.tattoos.length}/5)</b>` + (L.tattoos.length ? L.tattoos.map((t, i) => `<div class="tatl"><i style="background:${cssC(t.color)}"></i><span>${nm(C.tatDesign, t.design)} · ${nm(C.tatSpot, t.spot)}</span><button class="chip" data-tatdel="${i}" aria-label="Quitar">✕</button></div>`).join('') : note('Aún no tiene tatuajes. Elige diseño, lugar y color, y agrégalo.')) + '</div>';
    h += chips('Diseño', 'design', C.tatDesign, 'tp', T.design) + chips('Dónde', 'spot', C.tatSpot, 'tp', T.spot) + colors('Color', 'color', PAL.ink, 'tp', T.color);
    h += `<button class="add" data-tatadd="1" ${L.tattoos.length >= 5 ? 'disabled' : ''}>➕ Agregar tatuaje</button>` + note('La ropa tapa los tatuajes que quedan debajo.');
  } else if (ED.tab === 'cajas') {
    h = `<div class="coins"><i class="coin"></i> <b>${Math.max(0, INV.coins).toLocaleString('es')}</b> monedas</div>`
      + `<div class="boxc"><div class="boxi">📦</div><div><b>Caja de ${f ? 'rockera' : 'rockero'}</b><span>Una prenda, guitarra o accesorio de ${f ? 'mujer' : 'hombre'} con colores al azar.<br>★ Legendario: 1 de cada 10.</span></div></div>`
      + `<button class="add" data-box="1" ${INV.coins < BOX_PRICE || BOX.on || BOX.pidiendo || INV.parada ? 'disabled' : ''}>📦 Abrir caja · ${BOX_PRICE} <i class="coin"></i></button>`
      + (INV.parada ? note('Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes gastar.') : INV.coins < BOX_PRICE ? note(`Te faltan ${(BOX_PRICE - Math.max(0, INV.coins)).toLocaleString('es')} monedas: juega, consigue logros o reclama la recompensa diaria.`) : '');
    h += `<div class="eg"><b>Tu colección (${f ? 'mujer' : 'hombre'})</b>` + Object.keys(INV_CATS).filter(k => C[k]?.length).map(k => {
      const all = C[k].filter(o => o[0] !== 'none'), own = all.filter(o => invHas(g, k, o[0])).length, lg = all.filter(o => o[2]), ol = lg.filter(o => invHas(g, k, o[0])).length;
      return `<div class="colr"><span>${INV_CATS[k].ic} ${INV_CATS[k].n}</span><i><u style="width:${own / all.length * 100}%"></u></i><em>${own}/${all.length} · ★${ol}/${lg.length}</em></div>`;
    }).join('') + '</div>';
    const last = (INV.last || []).map((v, i) => [v, i]).filter(([v]) => v.b === g);
    if (last.length) h += '<div class="eg"><b>Últimos premios</b><div class="chips">' + last.map(([v, i]) => `<button class="chip${v.leg ? ' leg' : ''}" data-lasti="${i}" title="Equipar"><i class="dot" style="background:${invBg(v.c)}"></i>${esc(invItem(v.b, v.k, v.t)?.[1] ?? v.t)}</button>`).join('') + '</div></div>';
    h += note(`Cajas abiertas: ${INV.opened}. Si sale una pieza repetida con los mismos colores, te devuelve monedas (${REEMBOLSO.comun}, o ${REEMBOLSO.leg} si es legendaria). Lo que sacas es tuyo: lo puedes vender en el mercado.`);
  }
  if (['ropa', 'guitarra', 'acc'].includes(ED.tab)) h = note('🔒 = aún no la tienes: sale en las <b>📦 Cajas</b>, con sus propios colores.') + h;
  if (ED.tab !== 'cuerpo' && ED.tab !== 'cajas') h = note('<span style="color:#ffd23a">★ Legendario</span>: brilla y tiene animación propia. Al elegirlo se cargan sus colores.') + h;
  $('#edPane').innerHTML = h;
}
function edFocusSpot(spot) { const v = TAT_VIEW[spot]; if (!v) return; ED.focus = spot; if (spot === 'mejilla') edFocus('cara', v[1]); else { ED.view = 'tat'; ED.zoom = 1; ED.yaw = v[1]; } }
/* vista previa del tatuaje elegido: calcomanía que late + aro punteado donde va a quedar */
function edTatPreview() {
  const rk = ED.rk; if (ED.prev) { for (const m of ED.prev) { m.removeFromParent(); m.geometry.dispose(); } ED.prev = null; }
  if (!rk || !ED.open || ED.tab !== 'tat' || ED.L.tattoos.length >= 5 || ED.L.tattoos.some(t => t.spot === ED.tat.spot && t.design === ED.tat.design && t.color === ED.tat.color)) return;
  const S = TAT_SPOT[ED.tat.spot]; if (!S || !TAT_DRAW[ED.tat.design]) return;   // bajo el ojo se pinta en la cara (ver edRebuild)
  const geo = decalGeo(rk.src, S), off = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 };
  ED.prevMat ??= new THREE.MeshToonMaterial({ ...off, gradientMap: GRAD_SOFT });
  ED.ringMat ??= new THREE.MeshBasicMaterial({ ...off, polygonOffsetFactor: -4, polygonOffsetUnits: -8, toneMapped: false, map: cTex('tatRing', () => canvasTex(256, 256, g => { g.strokeStyle = '#ffd23a'; g.lineWidth = 9; g.setLineDash([20, 13]); g.beginPath(); g.arc(128, 128, 116, 0, 7); g.stroke(); })) });
  ED.prevMat.map = tatTex(ED.tat.design, ED.tat.color); ED.prevMat.needsUpdate = true;
  ED.prev = [rk.skin(geo, ED.prevMat, 0), rk.skin(geo, ED.ringMat, 0)];
}
$('#edTabs').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const was = ED.tab; ED.tab = b.dataset.tab; edRender(); $('#edPane').scrollTop = 0;
  if (ED.tab === 'tat') edFocusSpot(ED.tat.spot); else edFocus(TAB_FOCUS[ED.tab], focusYaw(TAB_FOCUS[ED.tab]));
  if ((was === 'tat') !== (ED.tab === 'tat') && ED.tat.spot === 'mejilla') edChanged(false); else edTatPreview();
};
$('#edViews').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.rot) ED.yaw += +b.dataset.rot * 0.6; else edFocus(b.dataset.view, focusYaw(b.dataset.view)); edRender(); };
$('#edPane').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (b.classList.contains('lock')) { edToast('🔒 Aún no la tienes: ábrela en las cajas'); return; }
  if (d.var) { const v = invTodas(ED.L.body, d.var, ED.L[d.var].type)[+d.i]; if (v?.venta) { edToast('🏪 Está a la venta: retírala en el mercado para usarla'); return; } if (v) { Object.assign(ED.L[d.var], v.c); edFocus(pathFocus(d.var + '.type')); edChanged(); } return; }
  if (d.box) { boxStart(); return; }
  if (d.mercado) { CB.mercado?.(); return; }
  if (d.vende) { edSell(d.vende, b); return; }
  if (d.lasti !== undefined) { const v = INV.last[+d.lasti]; if (v) invEquip(v); return; }
  if (d.base) { const k = d.base, n = ED.L.name; ED.L = lookPosible(sanitizeLook(ROCKERS[k]), INV.own.filter(v => v.copia && !v.venta)); ED.L.name = n; edChanged(); return; }
  if (d.blank) { const n = ED.L.name; ED.L = defaultLook(ED.L.body); ED.L.name = n; edChanged(); return; }
  if (d.tatdel !== undefined) { ED.L.tattoos.splice(+d.tatdel, 1); edChanged(); return; }
  if (d.tatadd) { if (ED.L.tattoos.length < 5) { ED.L.tattoos.push({ design: ED.tat.design, spot: ED.tat.spot, color: ED.tat.color }); edFocusSpot(ED.tat.spot); edChanged(); } return; }
  if (d.tp) { const wasCheek = ED.tat.spot === 'mejilla'; ED.tat[d.tp] = d.tp === 'color' ? +d.c : d.v; if (d.tp === 'design') { const it = ED_CAT[ED.L.body].tatDesign.find(o => o[0] === d.v); if (it?.[2]) { ED.tat.color = it[2].color; edToast('★ ¡Tatuaje legendario!'); } } if (d.tp === 'spot') edFocusSpot(d.v); edRender(); if (wasCheek || ED.tat.spot === 'mejilla') edChanged(false); else edTatPreview(); return; }
  const p = d.p; if (!p) return;
  if (p === 'body') { if (d.v !== ED.L.body) edSwitchBody(d.v); return; }
  edFocus(pathFocus(p));
  edSet(p, d.v !== undefined ? d.v : p === 'ui' ? d.c : +d.c);
};
$('#edPane').onchange = e => {
  const i = e.target; if (i.type !== 'color') return;
  if (!i.dataset.p && !i.dataset.tp) return;
  if (i.dataset.tp) { ED.tat.color = parseInt(i.value.slice(1), 16); edRender(); if (ED.tat.spot === 'mejilla') edChanged(false); else edTatPreview(); return; }
  edSet(i.dataset.p, i.dataset.p === 'ui' ? i.value : parseInt(i.value.slice(1), 16));
};
$('#edName').oninput = e => { ED.L.name = e.target.value; };
$('#edRand').onclick = () => { const n = ED.L.name; ED.L = invClamp(randomLook(ED.L.body, R)); ED.L.name = n; edChanged(); };
function invEquip(v) {
  if (ED.L.body !== v.b || !ED.L[v.k] || !invHas(v.b, v.k, v.t)) return;
  Object.assign(ED.L[v.k], { type: v.t }, v.c); edFocus(pathFocus(v.k + '.type')); edChanged();
}
/* guardar: la página lo escribe en la base (rockLook/<uid>) y lo vuelve a comprobar contra tu inventario */
async function edSave() {
  if (ED.saving) return;
  ED.L.name = ($('#edName').value || '').trim().slice(0, 24) || (ED.L.body === 'f' ? 'Rockera sin nombre' : 'Rockero sin nombre');
  const look = JSON.parse(JSON.stringify(ED.L));
  ED.saving = true; $('#edSave').disabled = true;
  try { await CB.guarda?.(look); ED.saved = JSON.stringify(look); edToast('¡Guardado!'); }
  catch (err) { edToast(err?.message || 'No se pudo guardar'); }
  finally { ED.saving = false; $('#edSave').disabled = false; }
}
$('#edSave').onclick = edSave;
/* vender la variante elegida: la página publica la oferta (el mercado de Juegos la muestra) */
async function edSell(copia, btn) {
  const inp = [...document.querySelectorAll('#edPane [data-precio]')].find(x => x.dataset.precio === copia), p = Math.round(+(inp?.value || 0));
  if (!(p >= 1 && p <= 100000)) { edToast('El precio va de 1 a 100.000 monedas'); return; }
  if (!confirm(`¿Poner esta pieza a la venta por ${p.toLocaleString('es')} monedas? Mientras esté en el mercado no la puedes usar.`)) return;
  btn.disabled = true;
  try { await CB.vende?.(copia, p); edToast('🏪 ¡A la venta en el mercado!'); }
  catch (err) { edToast(err?.message || 'No se pudo vender'); btn.disabled = false; }
}
function edOpen(look) {
  ED.open = true; ED.key = null;
  ED.L = look ? sanitizeLook(look) : defaultLook('f');
  ED.saved = JSON.stringify(ED.L);
  Object.assign(ED, { tab: 'cuerpo', view: 'cuerpo', yaw: 0.35, zoom: 1, mt0: 0, snap: true, prev: null });
  for (const k in rockers) rockers[k].root.visible = false; singer.root.visible = drummer.root.visible = S.micSet.visible = false;
  // la cámara del editor queda donde empieza el público: alguien justo delante tapaba al rockero
  for (const m of crowd.all) m.visible = false;
  titles.cur = null; confetti.stop();
  $('#editor').classList.remove('off'); $('#edViews').classList.remove('off');
  edRebuild(); edRender(); layout();
}
function edClose() {
  if (ED.open && ED.saved !== JSON.stringify(ED.L) && !confirm('Tienes cambios sin guardar. ¿Salir igual?')) return;
  edShut(); CB.cerrar?.();
}
function edShut() {
  boxClose(true); clearTimeout(ED.tm); ED.open = false; if (ED.rk) { ED.rk.dispose(); ED.rk = null; }
  $('#editor').classList.add('off'); $('#edViews').classList.add('off'); $('#boxUI').className = '';
  singer.root.visible = drummer.root.visible = S.micSet.visible = true; for (const m of crowd.all) m.visible = true; layout();
}
$('#edClose').onclick = edClose;
/* cámara del editor: órbita alrededor del personaje (arrastrar para girar, rueda para acercar) */
function edCamera(dt) {
  const rk = ED.rk; if (!rk) return;
  const mk = ED.view === 'tat' && rk.tatMk?.[ED.focus];
  const F = mk ? { l: mk.getWorldPosition(V()), d: 0.9, h: 0.06, fov: 32 } : (ED_FOCUS[ED.view] || ED_FOCUS.cuerpo)(rk);
  // el punto se sigue suavizado (no salta con el cabeceo) y la cámara orbita alrededor de ese mismo punto: siempre queda centrado
  const k = ED.snap ? 1 : 1 - Math.exp(-6 * Math.max(dt, 0.016));
  if (ED.snap) { ED.cl.copy(F.l); ED.cd = F.d * ED.zoom; ED.ch = F.h * ED.zoom; ED.cyaw = ED.yaw; }
  ED.snap = false;
  ED.cl.lerp(F.l, k); ED.cd = lerp(ED.cd, F.d * ED.zoom, k); ED.ch = lerp(ED.ch, F.h * ED.zoom, k); ED.cyaw = lerp(ED.cyaw, ED.yaw, Math.min(1, k * 1.6));
  camera.position.set(ED.cl.x + Math.sin(ED.cyaw) * ED.cd, ED.cl.y + ED.ch, ED.cl.z + Math.cos(ED.cyaw) * ED.cd); camera.lookAt(ED.cl);
  if (BOX.shake > 0.001) camera.position.add(V(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(BOX.shake * 0.035));   // sacudón al caer / reventar la caja
  const fv = lerp(camera.fov, F.fov, k); if (Math.abs(fv - camera.fov) > 1e-3) { camera.fov = fv; camera.updateProjectionMatrix(); }
  parts.u.uScale.value = (VPH * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  if (ED.prevMat) ED.prevMat.opacity = 0.6 + 0.3 * Math.sin(clock.t * 5);
}
canvas.addEventListener('pointerdown', e => { if (BOX.on && !BOX.open && BOX.t > 0.95) BOX.skip = BOX.t; if (!ED.open) return; ED.drag = { x: e.clientX, yaw: ED.yaw }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (ED.drag) ED.yaw = ED.drag.yaw - (e.clientX - ED.drag.x) * 0.012; });
canvas.addEventListener('pointerup', () => { ED.drag = null; });
canvas.addEventListener('pointercancel', () => { ED.drag = null; });

/* =====================================================================
   CAJA DE PREMIO — cae al escenario, tiembla con luz escapando por las rendijas (dorada si es legendario),
   revientan las solapas, sale un haz de luz y sube girando la carta del premio
   ===================================================================== */
const BOX = { on: false, t: 0, res: null, parts: null, open: false, shown: false, skip: null, shake: 0, closeT: -1, camY: 0, landed: false };
const BOX_POS = ED_POS.clone().add(V(0.85, 0, 0.8)), BW = 0.5, BH = 0.38, BD = 0.5;
const boxFocus = () => ({ l: BOX_POS.clone().add(V(-0.12, 0.45 + BOX.camY, 0)), d: 3.3, h: 0.75 - BOX.camY, fov: 34, yaw: -0.38 });
function boxBuild() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.position.copy(BOX_POS); g.rotation.y = -0.3;
  const card = toon(0xc8925a), tape = toon(0xe8cf96), inner = toon(0x5a3818, { side: THREE.BackSide }), hide = new THREE.MeshBasicMaterial({ visible: false });
  mesh(body, new THREE.BoxGeometry(BW, BH, BD).translate(0, BH / 2, 0), [card, card, hide, card, card, card], { outline: 0.012 });
  mesh(body, new THREE.BoxGeometry(BW - 0.012, BH - 0.006, BD - 0.012).translate(0, BH / 2, 0), [inner, inner, hide, inner, inner, inner], { outline: 0 });   // cartón por dentro
  for (const z of [1, -1]) mesh(body, new THREE.BoxGeometry(0.11, 0.15, 0.004), tape, { pos: [0, BH - 0.075, z * (BD / 2 + 0.002)], outline: 0 });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.165), new THREE.MeshToonMaterial({ gradientMap: GRAD, transparent: true, map: canvasTex(400, 165, (c, w, h) => {
    c.fillStyle = '#f4e6c8'; c.beginPath(); c.roundRect(5, 5, w - 10, h - 10, 14); c.fill(); c.lineWidth = 6; c.strokeStyle = '#1a1020'; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#d4231a'; c.font = '66px Bangers, Impact, sans-serif'; c.fillText('⚡ROCK BOX⚡', w / 2, h * 0.43);
    c.font = '900 21px Rubik, system-ui, sans-serif'; c.fillStyle = '#1a1020'; c.fillText('FRÁGIL · ESTE LADO ARRIBA ↑', w / 2, h * 0.8);
  }) }));
  lab.position.set(0, 0.125, BD / 2 + 0.003); body.add(lab);
  // solapas con bisagra en el borde superior: [geometría, pivote, eje, sentido de apertura, cinta]
  const flaps = [];
  const fl = (geo, pos, axis, sgn, tp) => {
    const pv = new THREE.Group(); pv.position.set(...pos); body.add(pv); mesh(pv, geo, card, { outline: 0.008 });
    if (tp) mesh(pv, new THREE.BoxGeometry(0.11, 0.004, BD / 2 - 0.004).translate(0, 0.014, tp * BD / 4), tape, { outline: 0 });
    flaps.push({ pv, axis, sgn });
  };
  fl(new THREE.BoxGeometry(BW * 0.46, 0.01, BD * 0.96).translate(-BW * 0.23, 0.005, 0), [BW / 2, BH, 0], 'z', -1);
  fl(new THREE.BoxGeometry(BW * 0.46, 0.01, BD * 0.96).translate(BW * 0.23, 0.005, 0), [-BW / 2, BH, 0], 'z', 1);
  fl(new THREE.BoxGeometry(BW, 0.012, BD / 2).translate(0, 0.006, -BD / 4), [0, BH + 0.01, BD / 2], 'x', 1, -1);
  fl(new THREE.BoxGeometry(BW, 0.012, BD / 2).translate(0, 0.006, BD / 4), [0, BH + 0.01, -BD / 2], 'x', -1, 1);
  // luz que se escapa por las rendijas
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
  const leakM = new THREE.MeshBasicMaterial({ ...add, opacity: 0 });
  for (const [w, d, x, z] of [[BW * 0.98, 0.018, 0, 0], [BW, 0.012, 0, BD / 2], [BW, 0.012, 0, -BD / 2], [0.012, BD, BW / 2, 0], [0.012, BD, -BW / 2, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, d), leakM); m.position.set(x, BH + 0.012, z); body.add(m); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ ...add, map: TX.glow, opacity: 0 })); glow.position.set(0, BH + 0.06, 0); body.add(glow);
  // rayos que se cuelan por las rendijas mientras tiembla
  const rayM = new THREE.MeshBasicMaterial({ ...add, side: THREE.DoubleSide, opacity: 0, map: cTex('boxRay', () => canvasTex(16, 128, (c, w, h) => { const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); const sg = c.createLinearGradient(0, 0, w, 0); sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(0.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = sg; c.fillRect(0, 0, w, h); })) });
  const rays = [];
  for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + (i % 3) * 0.025, 1).translate(0, 0.5, 0), rayM); r.position.set(i < 5 ? (i - 2) * 0.1 : 0, BH + 0.012, i < 5 ? 0 : (i - 7) * 0.12); r.rotation.set(0, i * 1.1, ((i * 7) % 5 - 2) * 0.22); r.userData.ph = i * 1.7; body.add(r); rays.push(r); }
  // haz de luz al abrir
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 2.8, 32, 1, true).translate(0, 1.4, 0), new THREE.ShaderMaterial({
    ...add, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color() }, uA: { value: 0 }, uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uA, uT; varying vec2 vUv; varying vec3 vN, vV;
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float st = 0.65 + 0.35 * sin(vUv.x * 50.0 + uT * 4.0) * sin(vUv.x * 23.0 - uT * 2.0);
        float a = f * f * (1.0 - vUv.y) * (1.0 - vUv.y) * st * uA; gl_FragColor = vec4(uC * 1.6, clamp(a, 0.0, 1.0)); }`,
  })); beam.position.y = BH * 0.7; beam.scale.y = 0.001; g.add(beam);
  // carta del premio + halo detrás
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ ...add, map: TX.glow, opacity: 0 })); halo.scale.setScalar(1.5); g.add(halo);
  const cardM = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.58), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
  cardM.renderOrder = 8; cardM.visible = false; g.add(cardM);
  return { g, body, flaps, leakM, glow, rayM, rays, beam, halo, card: cardM, gtr: null };
}
function boxCardTex(res) {
  const v = res.v, leg = v.leg, it = invItem(v.b, v.k, v.t), C = INV_CATS[v.k];
  return canvasTex(360, 500, (g, w, h) => {
    const rect = (x, y, W, H, r) => { g.beginPath(); g.roundRect(x, y, W, H, r); };
    const fr = g.createLinearGradient(0, 0, w, h); (leg ? ['#fff4b0', '#ffb02a', '#ff6a1a', '#ffd23a'] : ['#8ad8ff', '#c07bff', '#4a7aff', '#8ad8ff']).forEach((c, i, a) => fr.addColorStop(i / (a.length - 1), c));
    rect(6, 6, w - 12, h - 12, 34); g.fillStyle = fr; g.fill(); g.lineWidth = 8; g.strokeStyle = '#000'; g.stroke();
    g.save(); rect(26, 26, w - 52, h - 52, 22); g.clip();
    const bg = g.createRadialGradient(w / 2, 200, 10, w / 2, 200, 320); bg.addColorStop(0, leg ? '#8a4a10' : '#2e2e7a'); bg.addColorStop(1, leg ? '#2a0c18' : '#120a26'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.2; g.fillStyle = leg ? '#ffd23a' : '#8ad8ff'; for (let i = 0; i < 16; i++) { const a0 = i / 16 * Math.PI * 2; g.beginPath(); g.moveTo(w / 2, 200); g.arc(w / 2, 200, 420, a0, a0 + Math.PI / 30); g.fill(); }
    g.globalAlpha = 1; g.restore(); rect(26, 26, w - 52, h - 52, 22); g.lineWidth = 5; g.strokeStyle = '#000'; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const tag = leg ? '★ LEGENDARIO ★' : res.dup ? 'REPETIDO' : '¡NUEVO!';
    g.font = '40px Bangers, Impact, sans-serif'; g.lineWidth = 7; g.strokeStyle = '#000'; g.fillStyle = leg ? '#ffd23a' : '#8ad8ff'; g.strokeText(tag, w / 2, 66); g.fillText(tag, w / 2, 66);
    g.font = '128px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'; g.fillText(C.ic, w / 2, 200);
    const cs = Object.values(v.c); cs.forEach((c, i) => { g.beginPath(); g.arc(w / 2 + (i - (cs.length - 1) / 2) * 46, 314, 17, 0, 7); g.fillStyle = cssC(c); g.fill(); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke(); });
    g.font = '900 31px Rubik, system-ui, sans-serif'; const lines = []; let ln = '';
    for (const wd of (it?.[1] ?? v.t).split(' ')) { const tr = ln ? ln + ' ' + wd : wd; if (ln && g.measureText(tr).width > w - 80) { lines.push(ln); ln = wd; } else ln = tr; } lines.push(ln);
    lines.forEach((l, i) => { const y = 378 + i * 36; g.lineWidth = 7; g.strokeStyle = '#000'; g.strokeText(l, w / 2, y); g.fillStyle = '#fff'; g.fillText(l, w / 2, y); });
    g.font = '700 19px Rubik, system-ui, sans-serif'; g.fillStyle = '#c9b8ec'; g.fillText(C.n.toUpperCase(), w / 2, h - 52);
  });
}
/* la caja la compra la página (monedas de verdad) y dice qué trajo: {v, dup, refund} */
async function boxStart() {
  if (BOX.on || BOX.pidiendo || !ED.open) return;
  if (INV.parada || INV.coins < BOX_PRICE) { edToast('No te alcanzan las monedas'); return; }
  BOX.pidiendo = true; $('#editor').classList.add('busy'); edToast('📦 Comprando la caja…');
  let res = null;
  try { res = await CB.abreCaja?.(ED.L.body); }
  catch (err) { edToast(err?.message || 'No se pudo abrir la caja'); }
  finally { BOX.pidiendo = false; $('#editor').classList.remove('busy'); }
  if (!res || !ED.open) { if (ED.open) edRender(); return; }
  const P = BOX.parts ??= boxBuild();
  Object.assign(BOX, { on: true, t: 0, res, open: false, shown: false, skip: null, shake: 0, closeT: -1, camY: 0, landed: false });
  P.g.scale.setScalar(1); P.beam.scale.y = 0.001; P.beam.material.uniforms.uA.value = 0; P.card.visible = false; P.halo.material.opacity = 0;
  P.card.material.map?.dispose(); P.card.material.map = boxCardTex(res); P.card.material.needsUpdate = true;
  if (P.gtr) P.gtr.removeFromParent(); P.gtr = null;
  if (res.v.k === 'guitar') { const w = new THREE.Group(), gt = makeGuitar({ type: res.v.t, ...res.v.c }); gt.g.position.x = -0.42; w.add(gt.g); w.visible = false; P.g.add(w); P.gtr = w; }   // la guitarra sale de verdad de la caja
  scene.add(P.g);
  ED.view = 'caja'; ED.zoom = 1; ED.yaw = -0.4;
  $('#editor').classList.add('busy'); $('#edViews').classList.add('off'); $('#boxUI').className = '';
  edRender(); edToast('📦 Toca la pantalla para abrirla ya');
}
function boxUpdate(dt) {
  const B = BOX; if (!B.on) return;
  const P = B.parts, leg = B.res.v.leg, col = leg ? 0xffc23a : 0x7ad8ff, T_LAND = 0.45, T_SHAKE = 0.95, T_OPEN = B.skip ?? 2.5;
  B.t += dt; const t = B.t, at = (x, y, z) => P.g.localToWorld(V(x, y, z));
  let y = 0, sy = 1, rx = 0, rz = 0, lid = 0, leak = 0;
  if (t < T_LAND) { const k = t / T_LAND; y = 2.6 * (1 - k * k); sy = 1.08; }   // cae
  else if (t < T_SHAKE && !B.open) {   // golpe contra el piso: se aplasta y rebota
    const u = (t - T_LAND) / (T_SHAKE - T_LAND); sy = 1 - 0.26 * Math.exp(-5 * u) * Math.cos(u * 15); y = 0.09 * Math.max(0, Math.sin(u * Math.PI * 1.3)) * (1 - u);
    if (!B.landed) { B.landed = true; B.shake = 0.6; for (let i = 0; i < 6; i++) smoke.puff(at(rr(-0.35, 0.35), 0.05, rr(-0.35, 0.35)), { life: 1.2, rise: 0.25, size: 0.5, op: 0.35, color: 0xb8a890 }); }
  } else if (!B.open) {   // tiembla cada vez más; la luz se escapa por las rendijas
    const s = clamp((t - T_SHAKE) / Math.max(0.01, T_OPEN - T_SHAKE), 0, 1), a = (0.025 + 0.085 * s * s) * (leg ? 1.35 : 1);
    rz = a * Math.sin(t * 41); rx = a * 0.6 * Math.sin(t * 33 + 1); y = Math.max(0, Math.sin(t * 11)) * 0.045 * s * s; sy = 1 + 0.04 * Math.sin(t * 22) * s;
    lid = 0.16 * s * Math.abs(Math.sin(t * 17)); leak = 0.3 + 0.9 * s; B.shake = Math.max(B.shake, 0.08 * s);
    if (R() < s * (leg ? 0.8 : 0.35)) parts.emit(at(rr(-0.2, 0.2), BH + 0.03, rr(-0.2, 0.2)), 1, { color: col, color2: 0xffffff, speed: 0.6, dir: V(0, 1.6, 0), life: 0.7, size: 0.035, grav: -1, drag: 1 });
  }
  if (t >= T_OPEN && !B.open) {   // ¡revienta!
    B.open = true; B.tOpen = t; B.shake = leg ? 1.1 : 0.7; const c = at(0, BH + 0.1, 0);
    parts.emit(c, leg ? 170 : 90, { color: col, color2: 0xffffff, speed: 2.6, dir: V(0, 2.8, 0), life: 1.3, size: 0.05, grav: -3, drag: 1.2 });
    if (leg) { parts.emit(c, 70, { color: 0xff7a2a, color2: 0xffd23a, speed: 1.4, dir: V(0, 4.5, 0), life: 1.6, size: 0.06, grav: -2, drag: 0.8 }); confetti.burst(); }
    for (let i = 0; i < 4; i++) smoke.puff(c.clone().add(V(rr(-0.2, 0.2), 0, rr(-0.2, 0.2))), { life: 1.4, rise: 0.6, size: 0.7, op: 0.3, color: leg ? 0xffd8a0 : 0xc8d8ff });
  }
  if (B.open) {
    const o = t - B.tOpen;
    lid = 2.35 * (1 - Math.exp(-o * 7) * Math.cos(o * 13)); leak = Math.max(0, 1 - o * 2);
    const bk = clamp(o * 2.2, 0, 1); P.beam.scale.y = Math.max(0.001, 1 - Math.pow(1 - bk, 3)); P.beam.material.uniforms.uA.value = (leg ? 1.25 : 0.9) * (1 - 0.35 * clamp(o - 0.6, 0, 1));
    const k = clamp((o - 0.12) / 1.0, 0, 1), e = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);   // sube y se pasa un poquito
    const C = P.card, cy = BH * 0.4 + e * 1.05 + (k >= 1 ? Math.sin(t * 2.2) * 0.025 : 0);
    C.visible = true; C.position.set(0, cy, 0); C.scale.setScalar(Math.max(0.01, 0.25 + 0.75 * e));
    C.quaternion.copy(P.g.quaternion).invert().multiply(camera.quaternion); C.rotateY((1 - k) * Math.PI * 4);   // gira y queda de frente a la cámara
    P.halo.position.set(0, cy, -0.04); P.halo.material.opacity = (leg ? 0.95 : 0.6) * k; P.halo.material.color.set(col); P.halo.scale.setScalar((leg ? 1.9 : 1.4) * (1 + 0.05 * Math.sin(t * 5)));
    if (P.gtr) { const gk = clamp((o - 0.3) / 1.0, 0, 1), ge = 1 - Math.pow(1 - gk, 3); P.gtr.visible = gk > 0; P.gtr.position.set(0.05, BH * 0.5 + ge * 0.62, 0.28); P.gtr.rotation.set(0, t * 1.4, 0.55); P.gtr.scale.setScalar(0.2 + 0.5 * ge); }
    B.camY = 0.3 * e;
    if (R() < 0.35) parts.emit(at(rr(-0.15, 0.15), BH, rr(-0.15, 0.15)), 1, { color: col, color2: 0xffffff, speed: 0.3, dir: V(0, 1.4, 0), life: 1.2, size: 0.03, grav: 0.3, drag: 0.5 });
    if (o > 1.25 && !B.shown) { B.shown = true; boxReveal(); }
  }
  for (const f of P.flaps) f.pv.rotation[f.axis] = f.sgn * lid * (f.axis === 'z' ? 0.9 : 1);
  P.body.position.y = y; P.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy)); P.body.rotation.set(rx, 0, rz);
  P.leakM.opacity = leak; P.leakM.color.set(col); P.rayM.opacity = leak * 0.85; P.rayM.color.set(col);
  for (const r of P.rays) r.scale.y = Math.max(0.001, leak * (0.35 + 0.3 * Math.abs(Math.sin(t * 9 + r.userData.ph)))); P.glow.material.opacity = leak * 0.9; P.glow.material.color.set(col); P.glow.scale.setScalar(0.5 + 0.6 * leak + 0.05 * Math.sin(t * 30));
  P.beam.material.uniforms.uT.value = t; P.beam.material.uniforms.uC.value.set(col);
  B.shake = Math.max(0, B.shake - dt * 2.5);
  if (B.closeT >= 0) { B.closeT += dt; const c = clamp(B.closeT / 0.35, 0, 1); P.g.scale.setScalar(Math.max(0.001, 1 - c * c)); if (c >= 1) boxEnd(); }
}
function boxReveal() {
  const { v, dup, refund } = BOX.res, it = invItem(v.b, v.k, v.t), C = INV_CATS[v.k], ui = $('#boxUI');
  ui.className = 'on' + (v.leg ? ' leg' : '');
  ui.innerHTML = `<div class="rar" style="color:${v.leg ? '#ffd23a' : '#8ad8ff'}">${v.leg ? '★ ¡LEGENDARIO! ★' : dup ? 'Repetido' : '¡Nuevo!'}</div><div class="nm">${it?.[1] ?? v.t}</div>`
    + `<div class="sub">${C.ic} ${C.n} · <i class="dot" style="background:${invBg(v.c)}"></i>${dup ? `ya la tenías así: +${refund} <i class="coin"></i>` : 'nueva en tu inventario'}</div>`
    + `<div class="bt"><button class="hot" data-act="equip">Equipar</button><button data-act="again" ${INV.coins < BOX_PRICE || INV.parada ? 'disabled' : ''}>Abrir otra · ${BOX_PRICE} <i class="coin"></i></button><button data-act="close">Listo</button></div>`;
}
function boxClose(instant) { if (!BOX.on) return; $('#boxUI').className = ''; if (instant) boxEnd(); else if (BOX.closeT < 0) BOX.closeT = 0; }
function boxEnd() {
  const P = BOX.parts; BOX.on = false; BOX.closeT = -1; BOX.shake = 0; P.g.removeFromParent(); P.g.scale.setScalar(1); confetti.stop();
  $('#editor').classList.remove('busy'); $('#edViews').classList.remove('off');
  if (ED.view === 'caja') edFocus('cuerpo', focusYaw('cuerpo'));
  if (ED.open) edRender();
}
$('#boxUI').onclick = e => {
  const b = e.target.closest('button'); if (!b || !BOX.on) return; const a = b.dataset.act;
  if (a === 'equip') { const v = BOX.res.v; boxClose(); invEquip(v); edToast('¡Equipado!'); }
  else if (a === 'again') { boxClose(true); boxStart(); }
  else boxClose();
};
canvas.addEventListener('wheel', e => { if (!ED.open) return; e.preventDefault(); ED.zoom = clamp(ED.zoom * Math.exp(e.deltaY * 0.001), 0.45, 1.8); }, { passive: false });


/* =====================================================================
   BUCLE
   ===================================================================== */
let last = performance.now() / 1000, kickPulse = 0, crashPulse = 0, bulbT = 0, msaaCheck = 0;
const _lead = new THREE.Color(), _warm = new THREE.Color(), _cc = new THREE.Color();
function step(dt) {
  clock.t += dt; const t = clock.t; LEG_T.value = t;
  const ed = ED.open;
  if (ed) { ED.mt0 += dt; if (ED.mt0 > 12) { ED.mt0 -= 12; if (ED.rk) ED.rk.st.riffPtr = 0; } }   // en el editor se repite un tramo de la estrofa
  const mt = ed ? 9 + ED.mt0 : battle.mt();
  const beat = mt / BEAT, bp = ((beat % 1) + 1) % 1;
  const sec = SONG.sections.find(s => mt >= s.t0 && mt < s.t1) || SONG.sections[SONG.sections.length - 1];
  const secI = battle.ko ? 0.9 : SECTION_I[sec.name];
  const bar = Math.floor(mt / BAR);
  if (!ed && bar !== battle.lastBar && dt > 0) { battle.lastBar = bar; battle.onBar(bar, sec, mt); director.onBar(bar, sec); }
  const K = { mt, beat, bp, notes: SONG.notes, hands: SONG.hands, vocal: !ed && !battle.ko && ['verse', 'pre', 'chorus', 'outro', 'break'].includes(sec.name) && (beat % 8) < 6.5, lookTo: battle.ko ? (battle.winner === 0 ? -0.5 : 0.5) : 0 };
  if (dt > 0 && !ed) battle.update(dt);
  const D = SONG.drums; if (battle.visPtr > 0 && D[battle.visPtr - 1].t > mt) battle.visPtr = 0;
  while (battle.visPtr < D.length && D[battle.visPtr].t <= mt) { const e = D[battle.visPtr++]; if (e.k === 'kick') kickPulse = 1; if (e.k === 'crash') { crashPulse = 1; S.cym[1].rotation.x = S.cym[1].userData.r0 + 0.25; } if (e.k === 'snare') S.cym[0].rotation.x = S.cym[0].userData.r0 + 0.08; }
  if (battle.ko) kickPulse = Math.max(kickPulse, Math.exp(-bp * 6) * 0.8);
  kickPulse = Math.max(0, kickPulse - dt * 7); crashPulse = Math.max(0, crashPulse - dt * 2.2); fxLight = Math.max(0, fxLight - dt * 2.5);
  for (const c of S.cym) c.rotation.x = damp(c.rotation.x, c.userData.r0, 6, dt);
  S.kick.scale.setScalar(1 + kickPulse * 0.02);
  const act = ed ? (ED.rk ? [ED.rk] : []) : SOLO() ? [PL(), drummer] : [PL(), PR(), singer, drummer];
  for (const r of act) r.st.I = damp(r.st.I, ed ? 0.62 : secI, 2, dt);
  if (dt > 0) for (const r of act) r.update(t, mt, dt, K);
  // pirotecnia en momentos clave
  if (dt > 0 && sec.name === 'chorus' && mt - sec.t0 < dt * 1.5) for (const p of pyros) p.fire(1.1);
  if (sec.name === 'solo' && dt > 0 && R() < 0.5) for (const x of [-6.6, 6.6]) parts.emit(V(x, SY + 0.3, 2.7), 2, { color: 0xffd080, speed: 1.2, dir: V(0, 5.5, 0.3), life: 1.4, size: 0.045, grav: -7, drag: 0.4 });
  let pyroOn = 0; for (const p of pyros) pyroOn = Math.max(pyroOn, p.update(t));
  crowd.update(t, K, clamp(0.4 + secI * 0.5 + crashPulse * 0.2 + (VIVO.on ? VIVO.hype * 0.3 : 0), 0, 1.3), SOLO() ? 0 : battle.mom);
  parts.update(dt); bolt.update(dt); smoke.update(dt); confetti.update(dt, t);
  for (const h of haze) { h.sp.position.x += h.v * dt; if (h.sp.position.x > 9) h.sp.position.x = -9; if (h.sp.position.x < -9) h.sp.position.x = 9; h.sp.position.y = h.y0 + Math.sin(t * 0.2 + h.v * 30) * 0.2; }
  // luces: tintadas hacia quien lleva ventaja
  const flash = Math.max(crashPulse, fxLight * 0.8);
  _lead.set(battle.mom >= 0 || SOLO() ? ROCKERS[OPT.L].ui : ROCKERS[OPT.Rr].ui); _warm.set(0xfff0b0).lerp(_lead, Math.min(0.55, Math.abs(battle.mom) * 0.6));
  for (const c of S.cans) {
    const tg = ed && ED.rk ? ED.rk.root.position : SOLO() || c.tgt === 'p1' ? PL().root.position : c.tgt === 'p2' ? PR().root.position : singer.root.position;
    c.g.lookAt(tg.x + Math.sin(t * 0.7 + c.g.position.x) * 0.4, tg.y + 1.1, tg.z + Math.cos(t * 0.6 + c.g.position.x) * 0.3);
    c.beam.material.uniforms.uI.value = c.base * (0.75 + 0.6 * kickPulse + 0.8 * flash);
    c.beam.material.uniforms.uColor.value.copy(_warm); c.glow.material.opacity = 0.45 + 0.35 * kickPulse;
  }
  S.lights.spotL.target.position.copy(ed && ED.rk ? ED.rk.root.position : PL().root.position).add(V(0, 1, 0)); S.lights.spotR.target.position.copy(ed && ED.rk ? ED.rk.root.position : SOLO() ? PL().root.position : PR().root.position).add(V(0, 1, 0));
  S.lights.spotL.intensity = 2.0 + 1.2 * kickPulse + 2 * flash + Math.max(0, battle.mom) * 1.2; S.lights.spotR.intensity = 2.0 + 1.2 * kickPulse + 2 * flash + Math.max(0, -battle.mom) * 1.2;
  S.lights.key.intensity = 1.7 + 0.9 * flash;
  if (ed) { S.lights.spotL.intensity = S.lights.spotR.intensity = 1.0; }   // en el editor los dos focos apuntan a la misma persona
  S.lights.fx.intensity = fxLight * 14;
  S.lights.under.intensity = 5 + Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3) * 0.5 + pyroOn * 4;
  S.lights.fire.intensity = 6 + Math.sin(t * 17) * 1 + Math.sin(t * 9.1) * 0.8;
  bloom.strength = ed ? 0.3 : 0.42 + 0.3 * flash + 0.1 * kickPulse + pyroOn * 0.15;
  for (const l of S.lanterns) l.pivot.rotation.set(Math.sin(t * 0.9 + l.ph) * 0.06, 0, Math.sin(t * 0.7 + l.ph) * 0.08);
  for (const cg of S.cones) cg.position.z = 0.38 + kickPulse * 0.045;
  for (const f of S.fireSprites) { const a = ((t * f.sp + f.ph) % 1); f.s.position.set(f.x * (1 - a), 0.25 + a * 1.6, f.z * (1 - a)); f.s.scale.setScalar((1 - a) * 1.1 + 0.2); f.s.material.opacity = (1 - a) * 0.9; }
  bulbT += dt; if (bulbT > 0.22) { bulbT = 0; const B = S.bulbs, st = Math.floor(t * 4); for (let i = 0; i < B.n; i++) { const k = B.BC[i % B.BC.length]; const on = (i + st) % 7 !== 0 ? 1 : 0.25; B.mesh.setColorAt(i, _cc.setRGB(k[0] * on, k[1] * on, k[2] * on)); } B.mesh.instanceColor.needsUpdate = true; }
  if (ed) { boxUpdate(dt); edCamera(dt); } else director.update(t, dt); if (kickPulse > 0.95 && secI > 0.9) director.shake = Math.max(director.shake, 0.2);
  grade.uniforms.uTime.value = t;
}
function render(dt) {
  if (!VPW) return;
  composer.render();
  if (msaaCheck < 3 && ++msaaCheck === 3) {
    const gl = renderer.getContext(), px = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (px[0] + px[1] + px[2] === 0) { for (const t of [composer.renderTarget1, composer.renderTarget2]) { t.samples = 0; t.dispose(); } composer.render(); }
  }
  if (drawOverlay(dt)) { renderer.autoClear = false; renderer.render(ovScene, ovCam); renderer.autoClear = true; }
}

/* =====================================================================
   LA ESCENA DENTRO DE PRO HERO — un solo lienzo y una sola escena por documento: se monta donde haga falta
   (detrás de la autopista o en la pantalla del editor) y el bucle corre solo mientras está montada y visible.
   ===================================================================== */
function layout() {
  const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight;
  // de fondo (con la autopista encima) se pinta a menos resolución: el juego necesita el cuadro
  const pr = ED.open ? Math.min(devicePixelRatio, 1.75) : Math.min(devicePixelRatio, 1.25) * (VIVO.alto ? 0.6 : 1);
  if (W < 2 || H < 2) return;
  VPW = W; VPH = H;
  renderer.setPixelRatio(pr); renderer.setSize(W, H, false); composer.setPixelRatio(pr); composer.setSize(W, H);
  camera.aspect = W / H; camera.updateProjectionMatrix(); edViewOffset(W, H);
  ovCanvas.width = Math.round(W * pr); ovCanvas.height = Math.round(H * pr); ovKey = '';
}
addEventListener('resize', () => { if (montada) layout(); });
new ResizeObserver(() => { if (montada) layout(); }).observe(canvas);

let montada = false, raf = 0, CB = {};
function frame() {
  raf = 0;
  if (!montada) return;
  raf = requestAnimationFrame(frame);
  const now = performance.now() / 1000; let dt = Math.min(0.05, now - last); last = now;
  if (document.hidden) return;
  if (!clock.run) dt = 0;
  step(dt); render(dt);
}
const arranca = () => { last = performance.now() / 1000; if (!raf) raf = requestAnimationFrame(frame); };

export const rock = {
  canvas,
  /* pone el lienzo (y la capa del editor) en `host` */
  monta(host) {
    host.append(canvas);
    montada = true; layout(); arranca();
  },
  desmonta() {
    if (ED.open) edShut();
    montada = false; if (raf) cancelAnimationFrame(raf); raf = 0;
    canvas.remove();
    VIVO.on = false;
  },
  /* el inventario de verdad, de la página: {coins, parada, own, opened, last} */
  inventario(inv) {
    INV = { coins: inv.coins | 0, parada: !!inv.parada, own: [...iniciales().map(v => ({ ...v })), ...(inv.own || [])], opened: inv.opened | 0, last: inv.last || [] };
    if (ED.open && !BOX.on) edRender();
  },
  /* el editor: `look` es tu rockero guardado (o null); `cb` = {guarda(look), abreCaja(b), vende(c, p), mercado(), cerrar()} */
  editor(look, cb) {
    CB = cb || {}; VIVO.on = false; VIVO.alto = false;
    // la escena se prepara como en el paquete (con la batalla de demostración): sin eso el editor salía a oscuras
    if (battle.t0 === undefined) battle.start();
    edOpen(look ? lookPosible(sanitizeLook(look), INV.own.filter(v => v.copia && !v.venta)) : null);
  },
  cierraEditor() { if (ED.open) edShut(); },
  /* una canción: `yo` y (en batalla) `rival` son rockeros {look, nombre}; sin rival, toca solo */
  enVivo({ yo, rival = null, alto = false }) {
    if (ED.open) edShut();
    const L = yo?.look ? sanitizeLook(yo.look) : defaultLook('m');
    if (!yo?.look && yo?.nombre) L.name = String(yo.nombre).slice(0, 24);
    OPT.L = setRocker('yo', L);
    VIVO.solo = !rival;
    if (rival) {
      const k = 'u_' + String(rival.uid || 'rival').replace(/[^\w-]/g, '').slice(0, 40);
      let R2 = rival.look ? sanitizeLook(rival.look) : null;
      if (!R2) { const base = ['violeta', 'rex', 'kid'][[...String(rival.uid || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 3]; R2 = sanitizeLook(ROCKERS[base]); R2.name = String(rival.nombre || R2.name).slice(0, 24); }
      OPT.Rr = setRocker(k, R2);
    }
    Object.assign(VIVO, { on: true, mt: 0, raw: -1, ko: null, fin: null, hype: 0, alto: !!alto });
    OPT.bars = false; OPT.cam = 'auto';
    battle.start(); layout();
  },
  /* cada cuadro de la canción: `beats` (pulsos del chart desde el compás 0), `animo` (-1…1: cómo vas, o
     cómo va la batalla a tu favor) y `hype` (0…1, el combo) */
  pulso({ beats, animo = 0, hype = 0 }) {
    if (!VIVO.on) return;
    const raw = Math.max(0, beats) * BEAT, mt = vivoMt(raw);
    if (mt < VIVO.mt - 0.05) battle.rewound();
    VIVO.raw = raw; VIVO.mt = mt; VIVO.hype = clamp(hype, 0, 1);
    battle.momT = clamp(animo, -0.85, 0.85);
  },
  /* en batalla: un ataque de `quien` (0 tú, 1 el rival); solo: 'sp' | 'racha' | 'falla' con su texto */
  ataque(quien) { if (VIVO.on && !VIVO.solo) battle.attack(quien ? 1 : 0, pick(Object.keys(ATTACKS))); },
  hype(kind, text, color) { if (VIVO.on && VIVO.solo) battle.hype(kind, text, color); },
  /* fin de la canción: en batalla el ganador (0 tú, 1 el rival); solo, el título */
  fin(ganador = 0, texto = '') { if (!VIVO.on) return; VIVO.fin = texto || null; VIVO.ko = ganador ? 1 : 0; },
};
window.__rock = { rock, battle, director, ED, BOX, VIVO, ROCKERS, rockers, scene, camera, renderer, step, render };
$('#loading')?.remove();
