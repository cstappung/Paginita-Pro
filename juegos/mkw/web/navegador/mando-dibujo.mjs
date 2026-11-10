// La vista «del mando» de la hoja Controles, al estilo de Steam Big Picture — bitácora §263 (el dueño: «haz un leve
// rework de la interfaz de reasignacion de botones con mando, debiera verse algo parecido al de Steam big picture»).
//
// Resumen: en vez de empezar por una lista de acciones, se ve el DIBUJO de un mando (el mapeo «standard» del navegador:
// gatillos, botones de hombro, la cruz, los dos sticks, los cuatro botones de la cara, Select y Start) y, a cada lado,
// un rótulo por botón con lo que hace en Mario Kart («RT · Derrapar y saltar»), como los globos de Big Picture.
//   · Apretar un botón del mando de verdad lo enciende en el dibujo y en su rótulo (el dibujo es también el probador).
//   · Pasar o poner el foco en un rótulo marca su botón en el dibujo.
//   · Tocar un rótulo (o A con el cursor del mando) abre «¿Qué hace RT?»: una cuadrícula de acciones grandes; la que
//     tiene ahora va con ✓. Elegir una la SUMA a ese botón (los otros botones de esa acción siguen: un botón nuevo no
//     le quita nada a otro, como en Big Picture); «Nada» le quita todo a ese botón; «← Volver» no cambia nada.
//   · Un stick se elige entero: «Manejar (girar)», «Stick C» o «Nada».
// Lo demás de la hoja (la lista con el teclado, el asistente, la zona muerta) no cambia: esta es solo otra cara del
// mismo mapa (asignacion-mando.mjs). Como pasar del listado de circuitos de un tablero al plano con cada interruptor
// rotulado: es la misma instalación, vista donde está cada cosa.
//
// Uso:  const v = montarDibujoMando(nodo, { nombres, tipoDe, alElegir });
//       v.pintar({ mapa, tipo, estandar, gamepad })   (cada 100 ms: solo cambia textos y clases)

import { nombreFuente, activa, fotoMando, capturar } from './asignacion-mando.mjs';
import { PASOS } from './disposicion-mando.mjs';

// Los botones físicos (mapeo «standard»): fuente, lado de su rótulo y su forma en el dibujo (viewBox 0 0 400 240).
// Los gatillos y los hombros son trazos pegados al borde de arriba (d = el trazo; tx/ty = dónde va su letra); la cruz,
// cuatro brazos de una sola pieza; los sticks, aro + capuchón; la cara, cuatro botones en rombo.
const espejo = d => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${400 - +x} ${y}`);
const LT = 'M70 62 C74 34 96 20 122 18 L138 19 C146 21 148 28 147 36 L145 46 C116 46 92 52 74 66 Z';
const LB = 'M56 86 C70 60 100 46 146 44 L150 46 L148 56 C110 58 86 68 68 90 Z';
export const FISICOS = [
  { f: 'b6', lado: 'izq', forma: 'gatillo', d: LT, tx: 116, ty: 37 },
  { f: 'b4', lado: 'izq', forma: 'hombro', d: LB, tx: 104, ty: 58 },
  { f: 'si', lado: 'izq', forma: 'stick', x: 112, y: 112, r: 25, ejes: ['a0-', 'a0+', 'a1-', 'a1+'] },
  { f: 'b12', lado: 'izq', forma: 'cruz', x: 151, y: 136, w: 16, h: 17, flecha: 'M159 141 l-4 6 h8 Z' },
  { f: 'b14', lado: 'izq', forma: 'cruz', x: 133, y: 153, w: 18, h: 16, flecha: 'M138 161 l6 -4 v8 Z' },
  { f: 'b15', lado: 'izq', forma: 'cruz', x: 167, y: 153, w: 18, h: 16, flecha: 'M180 161 l-6 -4 v8 Z' },
  { f: 'b13', lado: 'izq', forma: 'cruz', x: 151, y: 169, w: 16, h: 17, flecha: 'M159 181 l-4 -6 h8 Z' },
  { f: 'b8', lado: 'izq', forma: 'menu', x: 170, y: 101, w: 18, h: 11 },
  { f: 'b7', lado: 'der', forma: 'gatillo', d: espejo(LT), tx: 284, ty: 37 },
  { f: 'b5', lado: 'der', forma: 'hombro', d: espejo(LB), tx: 296, ty: 58 },
  { f: 'b3', lado: 'der', forma: 'cara', x: 288, y: 88, r: 13 },
  { f: 'b2', lado: 'der', forma: 'cara', x: 262, y: 113, r: 13 },
  { f: 'b1', lado: 'der', forma: 'cara', x: 314, y: 113, r: 13 },
  { f: 'b0', lado: 'der', forma: 'cara', x: 288, y: 138, r: 13 },
  { f: 'sd', lado: 'der', forma: 'stick', x: 246, y: 160, r: 25, ejes: ['a2-', 'a2+', 'a3-', 'a3+'] },
  { f: 'b9', lado: 'der', forma: 'menu', x: 212, y: 101, w: 18, h: 11 },
];
// El color de la letra de cada botón de la cara, por familia (como los mandos de verdad)
const COLOR_CARA = {
  xbox: { b0: '#5fd38d', b1: '#ff6b6b', b2: '#5aa9ff', b3: '#ffd23f' },
  playstation: { b0: '#8fb8ff', b1: '#ff7a8a', b2: '#ff9ad5', b3: '#4fdcb0' },
};
// Lo que puede hacer un botón (los controles de GameCube que son botones) y un stick
export const POCO_USO = new Set(['Y', 'Z', 'abajo', 'izquierda', 'derecha']);   // (casi no se usan en la carrera)
export const ACCIONES_BOTON = ['A', 'B', 'R', 'L', 'X', 'arriba', 'START', 'Y', 'Z', 'abajo', 'izquierda', 'derecha'];
export const MODOS_STICK = [['stick', ['stick.izq', 'stick.der', 'stick.arr', 'stick.aba'], 'Manejar (girar)'],
                            ['c', ['c.izq', 'c.der', 'c.arr', 'c.aba'], 'Stick C']];

// ¿qué controles usan esta fuente? (una fuente puede llevar el reposo de un gatillo: «a5+@-1»)
const usa = (lista, f) => (lista || []).some(x => x === f || x.startsWith(f + '@'));
export function accionesDeFuente(mapa, f) { return Object.keys(mapa || {}).filter(id => usa(mapa[id], f)); }
// un stick: 'stick' | 'c' | 'otro' | 'nada', según adónde van sus 4 direcciones
export function modoDeStick(mapa, ejes) {
  for (const [modo, objs] of MODOS_STICK) if (objs.every((o, i) => usa(mapa?.[o], ejes[i]))) return modo;
  return ejes.some(e => accionesDeFuente(mapa, e).length) ? 'otro' : 'nada';
}
// cambiar el mapa: el botón f hace `objetivo` (sumado: sus otros botones siguen) o nada (objetivo = null)
export function ponerBoton(mapa, f, objetivo, max = 3) {
  const m = {};
  for (const [id, l] of Object.entries(mapa || {})) m[id] = (l || []).filter(x => !(x === f || x.startsWith(f + '@')));
  if (objetivo && m[objetivo]) m[objetivo] = [...m[objetivo], f].slice(-max);
  return m;
}
// un stick entero a un modo ('stick', 'c' o null = nada)
export function ponerStick(mapa, ejes, modo, max = 3) {
  let m = mapa;
  for (const e of ejes) m = ponerBoton(m, e, null, max);
  const objs = MODOS_STICK.find(([k]) => k === modo)?.[1];
  if (objs) ejes.forEach((e, i) => { m = ponerBoton(m, e, objs[i], max); });
  return m;
}
// el lugar del dibujo de un paso (las direcciones de un stick marcan el stick)
const lugarDibujo = l => /^a[01]/.test(l || '') ? 'si' : /^a[23]/.test(l || '') ? 'sd' : l;
// (la cruz, con flechas cortas en todos los mandos: «Izquierda» no cabía en el globo del genérico)
const FLECHA = { arriba: '↑', abajo: '↓', izquierda: '←', derecha: '→' };
const glifoDe = (f, tipo) => { if (f === 'si') return 'LS'; if (f === 'sd') return 'RS';
  const g = nombreFuente(f, tipo, true).replace(/^Cruz /i, ''); return FLECHA[g.toLowerCase()] || g; };

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const el = (tag, props = {}, ...hijos) => { const e = Object.assign(document.createElement(tag), props); e.append(...hijos.filter(h => h != null)); return e; };
const texto = (n, t) => { if (n.textContent !== t) n.textContent = t; };
const clase = (n, c, si) => { if (n.classList.contains(c) !== !!si) n.classList.toggle(c, !!si); };

// nombres: { objetivo → nombre de la acción } (los de la hoja Controles). alElegir({ f, objetivo }) para un botón y
// alElegir({ f, modo }) para un stick; el que llama cambia el mapa y lo guarda.
export function montarDibujoMando(nodo, { nombres = {}, alElegir = () => {}, alCambiarVista = null } = {}) {
  if (!nodo) return null;
  const nombre = id => nombres[id] || id;
  // ---- el dibujo ----
  const svg = svgEl('svg', { viewBox: '0 0 400 240', class: 'bp-dibujo', 'aria-hidden': 'true' });
  const uid = 'bp' + Math.random().toString(36).slice(2, 7);   // (los degradados llevan nombre propio: puede haber dos dibujos)
  const defs = svgEl('defs', {});
  const degradado = (tipo, id, attrs, paradas) => { const gr = svgEl(tipo, { id: uid + id, ...attrs }); for (const [o, c] of paradas) gr.append(svgEl('stop', { offset: o, 'stop-color': c })); defs.append(gr); };
  degradado('linearGradient', 'cuerpo', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0', '#3f3780'], ['0.55', '#2a2459'], ['1', '#1d1940']]);
  degradado('linearGradient', 'brillo', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0', '#ffffff2e'], ['1', '#ffffff00']]);
  degradado('radialGradient', 'capuchon', { cx: 0.42, cy: 0.38, r: 0.7 }, [['0', '#3b3478'], ['0.7', '#211c48'], ['1', '#15122e']]);
  degradado('radialGradient', 'boton', { cx: 0.4, cy: 0.35, r: 0.75 }, [['0', '#34306a'], ['1', '#17142f']]);
  svg.append(defs);
  const CUERPO = 'M130 52 C165 45 235 45 270 52 C306 56 332 62 348 86 C368 116 384 168 388 198 C392 226 370 240 350 232 ' +
    'C334 226 318 202 300 184 C284 172 262 168 246 170 L154 170 C138 168 116 172 100 184 C82 202 66 226 50 232 ' +
    'C30 240 8 226 12 198 C16 168 32 116 52 86 C68 62 94 56 130 52 Z';
  const piezas = svgEl('g', {});
  // primero lo que va DETRÁS del cuerpo (los gatillos), después el cuerpo, su brillo, los huecos y el botón guía
  const atras = svgEl('g', {});
  svg.append(atras,
    svgEl('path', { class: 'bp-cuerpo', d: CUERPO, fill: `url(#${uid}cuerpo)` }),
    svgEl('path', { class: 'bp-brillo', d: 'M134 58 C168 52 232 52 266 58 C296 62 318 68 332 86 C300 76 250 70 200 70 C150 70 100 76 68 86 C82 68 104 62 134 58 Z', fill: `url(#${uid}brillo)` }),
    svgEl('circle', { class: 'bp-hueco', cx: 112, cy: 112, r: 32 }), svgEl('circle', { class: 'bp-hueco', cx: 246, cy: 160, r: 32 }),
    svgEl('path', { class: 'bp-hueco', d: 'M148 133 h22 v17 h18 v22 h-18 v17 h-22 v-17 h-18 v-22 h18 Z' }),
    svgEl('circle', { class: 'bp-guia', cx: 200, cy: 80, r: 12 }),
    piezas);
  const formas = new Map();
  for (const p of FISICOS) {
    const g = svgEl('g', { 'data-f': p.f, class: 'bp-g bp-g-' + p.forma });
    let tx, ty;
    if (p.forma === 'stick') {
      g.append(svgEl('circle', { cx: p.x, cy: p.y, r: p.r, class: 'bp-aro' }),
               svgEl('circle', { cx: p.x, cy: p.y, r: p.r - 7, class: "bp-pieza", style: `fill:url(#${uid}capuchon)` }),
               svgEl('circle', { cx: p.x, cy: p.y, r: p.r - 12, class: 'bp-concavo' }));
      tx = p.x; ty = p.y + 4;
    } else if (p.forma === 'cara') {
      g.append(svgEl('circle', { cx: p.x, cy: p.y + 1.5, r: p.r, class: 'bp-sombra' }),
               svgEl('circle', { cx: p.x, cy: p.y, r: p.r, class: "bp-pieza", style: `fill:url(#${uid}boton)` }));
      tx = p.x; ty = p.y + 4.5;
    } else if (p.d) {
      g.append(svgEl('path', { d: p.d, class: 'bp-pieza' }));
      tx = p.tx; ty = p.ty + 4;
    } else {
      g.append(svgEl('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.forma === 'cruz' ? 2.5 : 5.5, class: 'bp-pieza' }));
      if (p.flecha) g.append(svgEl('path', { d: p.flecha, class: 'bp-flecha' }));
      tx = p.x + p.w / 2; ty = p.y + p.h / 2 + 4;
    }
    const t = svgEl('text', { x: tx, y: ty, class: 'bp-letra bp-letra-' + p.forma });
    g.append(t);
    (p.forma === 'gatillo' ? atras : piezas).append(g);
    formas.set(p.f, { g, t });
  }
  // ---- los rótulos, a cada lado ----
  const rotulos = new Map();
  const columna = lado => el('div', { className: 'bp-col bp-' + lado },
    ...FISICOS.filter(p => p.lado === lado).map(p => {
      const glifo = el('span', { className: 'bp-glifo' }), accion = el('span', { className: 'bp-accion' });
      const b = el('button', { type: 'button', className: 'bp-rotulo' }, glifo, accion);
      b.dataset.f = p.f;
      b.onclick = () => abrirElegir(p);
      const marcar = si => clase(formas.get(p.f).g, 'marcado', si);
      b.onmouseenter = () => marcar(true); b.onmouseleave = () => marcar(document.activeElement === b);
      b.onfocus = () => marcar(true); b.onblur = () => marcar(false);
      rotulos.set(p.f, { b, glifo, accion });
      return b;
    }));
  const vista = el('div', { className: 'bp-vista' }, columna('izq'), el('div', { className: 'bp-centro' }, svg), columna('der'));
  // ---- «¿Qué hace RT?»: la cuadrícula de acciones ----
  const tituloElegir = el('b', { className: 'bp-titulo' });
  const rejilla = el('div', { className: 'bp-rejilla' });
  const volver = el('button', { type: 'button', className: 'boton', textContent: '← Volver' });
  const elegir = el('div', { className: 'bp-elegir', hidden: true, role: 'dialog', 'aria-label': 'Elegir qué hace este botón' },
    el('div', { className: 'bp-elegir-cabeza' }, volver, tituloElegir), rejilla,
    el('p', { className: 'ctl-nota', textContent: 'Los demás botones que hacen lo mismo no cambian.' }));
  let abierto = null, ultimo = { mapa: {}, tipo: 'generico' };
  function cerrarElegir() {
    if (!abierto) return;
    const f = abierto.f; abierto = null; elegir.hidden = true; vista.hidden = false;
    try { rotulos.get(f)?.b.focus(); } catch {}
  }
  volver.onclick = cerrarElegir;
  elegir.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarElegir(); } });
  function abrirElegir(p) {
    abierto = p;
    const stick = p.forma === 'stick';
    texto(tituloElegir, `¿Qué hace ${glifoDe(p.f, ultimo.tipo)}?`);
    const ahora = stick ? [modoDeStick(ultimo.mapa, p.ejes)] : accionesDeFuente(ultimo.mapa, p.f);
    const opciones = stick ? [...MODOS_STICK.map(([k, , n]) => [k, n]), [null, 'Nada']]
      : [...ACCIONES_BOTON.map(id => [id, nombre(id)]), [null, 'Nada']];
    rejilla.replaceChildren(...opciones.map(([id, n]) => {
      const puesta = id === null ? (stick ? ahora[0] === 'nada' : !ahora.length) : ahora.includes(id);
      const b = el('button', { type: 'button', className: 'bp-opcion' + (puesta ? ' puesta' : '') + (id === null ? ' nada' : ''), textContent: (puesta ? '✓ ' : '') + n });
      b.dataset.objetivo = id ?? '';
      b.onclick = () => { const f = p.f; cerrarElegir(); stick ? alElegir({ f, ejes: p.ejes, modo: id }) : alElegir({ f, objetivo: id }); };
      return b;
    }));
    vista.hidden = true; elegir.hidden = false;
    try { (rejilla.querySelector('.puesta') || rejilla.firstChild).focus(); } catch {}
  }
  // ---- «Enséñale tu mando»: el dibujo marca cada lugar y la persona aprieta el suyo (disposicion-mando.mjs) ----
  const pasoTexto = el('b', { className: 'bp-paso-texto' }), pasoCuenta = el('small', { className: 'bp-paso-cuenta' });
  const saltar = el('button', { type: 'button', className: 'boton', textContent: 'Saltar (no lo tiene)' });
  const cancelarE = el('button', { type: 'button', className: 'boton', textContent: 'Cancelar' });
  const paso = el('div', { className: 'bp-paso', hidden: true, role: 'status', 'aria-live': 'polite' },
    pasoCuenta, pasoTexto, el('div', { className: 'fila-botones' }, saltar, cancelarE));
  let ensenando = null;
  // leer() = el Gamepad CRUDO de este mando (el del navegador, sin estandarizar); alTerminar(respuestas | null)
  function ensenar({ leer, alTerminar = () => {}, ms = 8000 }) {
    cerrarElegir(); terminarEnsenar(null, false);
    const yo = ensenando = { i: 0, resp: {}, base: null, hasta: 0, soltar: false, reloj: null };
    const marcar = () => { for (const [f, s] of formas) clase(s.g, 'marcado', f === lugarDibujo(PASOS[yo.i]?.[0])); };
    const empezarPaso = () => {
      if (yo.i >= PASOS.length) return terminarEnsenar(yo.resp, true);
      const [, txt] = PASOS[yo.i];
      texto(pasoCuenta, `Paso ${yo.i + 1} de ${PASOS.length}`); texto(pasoTexto, `${PASOS[yo.i][0].startsWith("a") ? "Mueve" : "Aprieta"} ${txt}`);
      yo.base = fotoMando(leer()); yo.hasta = performance.now() + ms; yo.soltar = false; marcar();
    };
    saltar.onclick = () => { if (ensenando === yo) { yo.i++; empezarPaso(); } };
    cancelarE.onclick = () => terminarEnsenar(null, true);
    yo.alTerminar = alTerminar;
    yo.reloj = setInterval(() => {
      if (ensenando !== yo) return;
      const g = leer();
      if (!g) return;
      if (yo.soltar) {                    // (esperar que suelte lo que apretó: si no, el mismo botón contaba dos veces)
        if (!capturar(yo.base0, g)) { yo.i++; empezarPaso(); }
        return;
      }
      const f = capturar(yo.base, g);
      if (f) {
        if (Object.values(yo.resp).includes(f)) return;     // (ya lo usó en otro lugar: se ignora)
        yo.resp[PASOS[yo.i][0]] = f; yo.soltar = true; yo.base0 = yo.base;
      } else if (performance.now() > yo.hasta) { yo.i++; empezarPaso(); }
    }, 40);
    vista.hidden = false; elegir.hidden = true; paso.hidden = false;
    nodo.classList.add('ensenando');
    empezarPaso();
    try { saltar.focus({ preventScroll: true }); } catch {}
    // (el paso y el dibujo a la vista: en el cajón quedaban más abajo del borde)
    try { nodo.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
  }
  function terminarEnsenar(resp, avisar = true) {
    const e = ensenando;
    if (!e) return;
    ensenando = null; clearInterval(e.reloj);
    paso.hidden = true; nodo.classList.remove('ensenando');
    for (const [, s] of formas) clase(s.g, 'marcado', false);
    if (avisar) e.alTerminar?.(resp);
  }
  nodo.classList.add('bp-caja');
  // §263 (el crítico): lo que casi no se usa en la carrera (Y, Z, la cruz salvo ↑, el stick C) va en gris, con su leyenda
  const leyenda = el('p', { className: 'bp-leyenda', textContent: 'En gris: casi no se usa en la carrera.' });
  nodo.replaceChildren(paso, vista, leyenda, elegir);

  // ---- pintar: los rótulos y las luces (solo lo que cambió) ----
  function pintar({ mapa = {}, tipo = 'generico', gamepad = null } = {}) {
    ultimo = { mapa, tipo };
    for (const p of FISICOS) {
      const r = rotulos.get(p.f), s = formas.get(p.f);
      const glifo = glifoDe(p.f, tipo);
      texto(r.glifo, glifo); texto(s.t, p.forma === 'cruz' || p.forma === 'menu' ? '' : glifo);
      const color = p.forma === 'cara' ? (COLOR_CARA[tipo]?.[p.f] || '#e9e5ff') : '';
      if (s.t.style.fill !== color) s.t.style.fill = color;   // (en estilo: la regla .bp-letra le ganaría al atributo)
      let acc;
      if (p.forma === 'stick') { const m = modoDeStick(mapa, p.ejes); acc = m === 'nada' ? '' : m === 'otro' ? 'Varias' : MODOS_STICK.find(([k]) => k === m)[2]; }
      else acc = accionesDeFuente(mapa, p.f).map(nombre).join(' + ');
      texto(r.accion, acc || '—');
      clase(r.b, 'vacio', !acc);
      const poco = p.forma === 'stick' ? modoDeStick(mapa, p.ejes) === 'c' : !!acc && accionesDeFuente(mapa, p.f).every(id => POCO_USO.has(id));
      clase(r.b, 'poco', poco);
      const lit = !!gamepad && (p.ejes ? p.ejes.some(e => activa(gamepad, e)) : activa(gamepad, p.f));
      clase(r.b, 'encendido', lit); clase(s.g, 'encendido', lit);
    }
  }
  return { pintar, cerrarElegir, ensenar, cancelarEnsenar: () => terminarEnsenar(null, true), get ensenando() { return ensenando ? { paso: ensenando.i, resp: { ...ensenando.resp } } : null; }, get abierto() { return abierto?.f || null; }, abrir: f => { const p = FISICOS.find(x => x.f === f); if (p) abrirElegir(p); } };
}

// Los estilos (todo bajo .bp-): un panel oscuro con el mando al centro y los rótulos como globos a los lados
export const CSS_DIBUJO = `
.bp-vista { display: grid; grid-template-columns: 1fr minmax(150px, 1.25fr) 1fr; gap: 6px; align-items: center; padding: 10px 6px;
  border-radius: 14px; background: radial-gradient(ellipse at 50% 40%, #2a2358, #120f26 75%); border: 1px solid #3d3378; }
.bp-col { display: grid; gap: 4px; }
.bp-rotulo { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 3px 8px 3px 4px; border-radius: 999px; border: 1px solid #3d3378;
  background: #1b1640e6; color: var(--texto, #f1effa); cursor: pointer; text-align: left; font: 600 12px 'IBM Plex Sans', system-ui, sans-serif; min-width: 0; }
.bp-der .bp-rotulo { flex-direction: row-reverse; text-align: right; padding: 3px 4px 3px 8px; }
.bp-rotulo:hover, .bp-rotulo:focus-visible { border-color: var(--amarillo, #ffd21f); background: #2a2350; outline: none; }
.bp-glifo { flex: none; min-width: 26px; height: 26px; padding: 0 5px; box-sizing: border-box; display: grid; place-items: center; border-radius: 999px;
  background: #3a3170; color: #fff; font: 700 11px 'IBM Plex Sans', system-ui, sans-serif; }
.bp-accion { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bp-rotulo.poco .bp-accion { color: var(--suave, #a7a3bd); font-weight: 400; font-style: italic; }
.bp-leyenda { margin: 4px 0 0; font-size: 12px; color: var(--suave, #a7a3bd); text-align: center; }
.bp-caja.ensenando .bp-leyenda { display: none; }
.bp-rotulo.vacio .bp-accion { color: var(--suave, #a7a3bd); font-weight: 400; }
.bp-rotulo.encendido { border-color: var(--amarillo, #ffd21f); }
.bp-rotulo.encendido .bp-glifo { background: var(--amarillo, #ffd21f); color: #2a1a00; box-shadow: 0 0 10px #ffd21f88; }
.bp-dibujo { width: 100%; height: auto; display: block; overflow: visible; filter: drop-shadow(0 6px 10px #0008); }
.bp-cuerpo { stroke: #6a5cc4; stroke-width: 1.5; }
.bp-hueco { fill: #15122c; opacity: .55; }
.bp-guia { fill: #1a1636; stroke: #6a5cc4; stroke-width: 1.5; }
.bp-pieza { fill: #1d1a3c; stroke: #7a6bd6; stroke-width: 1.4; transition: fill .08s; }
.bp-g-gatillo .bp-pieza, .bp-g-hombro .bp-pieza { fill: #2e2862; }
.bp-g-cruz .bp-pieza { fill: #221e48; stroke-width: 1; }
.bp-g-menu .bp-pieza { fill: #221e48; }
.bp-aro { fill: #120f26; stroke: #4a3f94; stroke-width: 1.5; }
.bp-concavo { fill: none; stroke: #ffffff14; stroke-width: 3; }
.bp-sombra { fill: #0b0918; }
.bp-flecha { fill: #8f84d8; pointer-events: none; }
.bp-letra { fill: #d8d2fb; font: 700 11px 'IBM Plex Sans', system-ui, sans-serif; text-anchor: middle; pointer-events: none; }
.bp-letra-cara { font-size: 13px; }
.bp-letra-stick { fill: #8f84d8; font-size: 10px; }
g.marcado .bp-pieza, g.encendido .bp-pieza { fill: var(--amarillo, #ffd21f) !important; filter: drop-shadow(0 0 5px #ffd21fcc); }
g.encendido .bp-letra, g.encendido .bp-flecha { fill: #2a1a00 !important; }
.bp-paso { display: grid; gap: 6px; justify-items: center; text-align: center; padding: 12px; margin-bottom: 8px; border-radius: 14px; background: #221a4a; border: 2px solid var(--amarillo, #ffd21f); }
.bp-paso-texto { font: 400 20px 'Lilita One', system-ui, sans-serif; color: var(--amarillo, #ffd21f); }
.bp-paso-cuenta { color: var(--suave, #a7a3bd); }
.ensenando .bp-col { opacity: .45; pointer-events: none; }
.bp-elegir { display: grid; gap: 10px; padding: 12px; border-radius: 14px; background: #161233; border: 2px solid var(--amarillo, #ffd21f); }
.bp-elegir-cabeza { display: flex; align-items: center; gap: 10px; }
.bp-titulo { font: 400 22px 'Lilita One', system-ui, sans-serif; color: var(--amarillo, #ffd21f); }
.bp-rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; }
.bp-opcion { min-height: 48px; padding: 6px 10px; border-radius: 12px; border: 1px solid #3d3378; background: #221d47; color: var(--texto, #f1effa);
  font: 600 13px 'IBM Plex Sans', system-ui, sans-serif; cursor: pointer; text-align: left; }
.bp-opcion:hover, .bp-opcion:focus-visible { border-color: var(--amarillo, #ffd21f); outline: none; background: #2a2350; }
.bp-opcion.puesta { border-color: var(--verde, #3fd59a); color: var(--verde, #3fd59a); }
.bp-opcion.nada { color: var(--suave, #a7a3bd); font-style: italic; }
.bp-caja { container: bp / inline-size; }
.bp-caja [hidden] { display: none !important; }
@container bp (max-width: 560px) { .bp-vista { grid-template-columns: 1fr 1fr; } .bp-centro { grid-column: 1 / -1; grid-row: 1; max-width: 360px; justify-self: center; width: 100%; } }
`;
