// Lo que se compra y se toca en el modo zombis: las puertas, las tablas de las
// ventanas, la electricidad, las bebidas, la caja misteriosa, las armas de
// pared, el Pack-a-Punch y los teletransportadores. mapas.js dice dónde va
// cada cosa; aquí se dibuja, se decide qué ofrece el cartel de abajo (E: …) y
// se lleva el estado compartido.
//
// Qué es de todos y qué es de cada uno, como en Black Ops: las puertas, la
// luz, las tablas, dónde está la caja y el enlace del teletransportador son de
// la sala, y los lleva el director (el mismo que mueve a los zombis) en su
// `zb` (claves o, l, k, n, t, f, w: no chocan con las de zombis.js). Los
// puntos, las bebidas y las armas son de cada uno: se pagan y se reciben en el
// propio marco, sin preguntarle a nadie.
//
// Quien no dirige pide lo compartido con un golpe de daño cero a `p:<qué>`
// (red.js lo entrega como petición) y lo aplica en su pantalla de una vez,
// sin esperar: abrir una puerta o encender la luz solo van en un sentido, así
// que no hay nada que el director pueda contradecir. Las tablas sí van y
// vienen, y ahí manda lo que publica el director.
import * as THREE from 'three';
import { etiqueta } from 'yemas/mundo';
import { huella, MEDIDA, zonaLibre } from 'yemas/mapas';
import { ARMAS, BEBIDAS, CAJA_ARMAS, CAJA_PRECIO, PAP_PRECIO, NOMBRE_ARMA } from 'yemas/armas';
import { sonido } from 'yemas/audio';

export const TABLAS = 6;
const CERCA = 1.7, TABLA_CADA = 0.9, CAJA_GIRA = 3.2, CAJA_ESPERA = 9, PAP_TARDA = 3.2, PAP_MUNICION = 4500;
const r1 = x => Math.round(x * 10) / 10;

// Un cartel plano con texto, para el frente de las máquinas y la tiza de las
// armas de pared.
function cartel(texto, w, h, { fondo = null, tinta = '#fff', borde = null, sub = '', fuente = 'bold' } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = Math.max(32, Math.round(256 * h / w));
  const g = cv.getContext('2d');
  if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, cv.width, cv.height); }
  if (borde) {
    g.strokeStyle = borde; g.lineWidth = 5; g.setLineDash([14, 6]);
    g.strokeRect(6, 6, cv.width - 12, cv.height - 12);
  }
  g.fillStyle = tinta; g.textAlign = 'center'; g.textBaseline = 'middle';
  const alto = sub ? cv.height * 0.36 : cv.height * 0.5;
  g.font = `${fuente} ${Math.round(Math.min(alto * 0.8, 520 / Math.max(4, texto.length)))}px system-ui, sans-serif`;
  g.fillText(texto, cv.width / 2, sub ? cv.height * 0.38 : cv.height / 2);
  if (sub) {
    g.font = `bold ${Math.round(cv.height * 0.22)}px system-ui, sans-serif`;
    g.fillText(sub, cv.width / 2, cv.height * 0.74);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: !fondo }));
}
const caja3 = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
};

// cb: pos() (los pies), puedo(), puntos(), gasta(n) → bool, suma(n),
//     director() → bool, envia(que), solo() → bool, ronda(),
//     arma: {tiene(id), enMano() → id|null, compra(id), llena(id), pap(id), tienePap(id)},
//     bebida: {tiene(t), toma(t)}, recalcula(), teleporta(x, y, z),
//     modelo(id) → Object3D, aviso(txt), prompt(txt | null)
export function crearInteractivo(escena, M, colisores, mundo, cb) {
  const grupo = new THREE.Group();
  escena.add(grupo);
  const propios = [];     // los colisores que puse yo, para sacarlos al desmontar
  const choque = (b) => { colisores.push(b); propios.push(b); return b; };
  const sacaChoque = (b) => {
    for (const lista of [colisores, propios]) { const i = lista.indexOf(b); if (i >= 0) lista.splice(i, 1); }
  };

  // ---------- Estado compartido ----------
  const abiertas = new Set();
  let luz = !!M.luzSiempre, k = 0, n = 0, f = 0, w = 0;
  const tablas = M.ventanas.map(() => TABLAS);

  // ---------- Puertas ----------
  const puertas = M.puertas.map(p => {
    let rotulo = null;
    if (!p.auto) {
      rotulo = etiqueta(`${p.nombre} · ${p.precio}`);
      rotulo.scale.set(2.2, 0.55, 1);
      rotulo.position.set(p.x, p.y + 2.2, p.z);
      grupo.add(rotulo);
    }
    return { p, rotulo };
  });
  function abre(id, sonar = true) {
    if (abiertas.has(id)) return;
    abiertas.add(id);
    mundo.quitaPuerta(id);
    const d = puertas.find(x => x.p.id === id);
    if (d?.rotulo) { grupo.remove(d.rotulo); d.rotulo.material.map.dispose(); d.rotulo.material.dispose(); d.rotulo = null; }
    if (sonar) sonido.puerta();
    cb.recalcula();
  }
  const zonaActiva = z => zonaLibre(z) || M.puertas.some(p => abiertas.has(p.id) && p.abre.includes(z));

  // ---------- Tablas ----------
  const matTabla = [new THREE.MeshLambertMaterial({ color: '#7a5a36' }), new THREE.MeshLambertMaterial({ color: '#8d6a40' })];
  const ventanas = M.ventanas.map((v, i) => {
    const g = new THREE.Group();
    g.position.set(v.x + v.nx * 0.28, v.y, v.z + v.nz * 0.28);
    g.rotation.y = v.eje === 'x' ? 0 : Math.PI / 2;
    const piezas = [];
    for (let j = 0; j < TABLAS; j++) {
      const m = caja3(v.w + 0.3, 0.17, 0.06, matTabla[j & 1], 0, 0.98 + j * 0.23, 0);
      m.rotation.z = (((j * 7 + i * 3) % 5) - 2) * 0.07;
      g.add(m);
      piezas.push(m);
    }
    grupo.add(g);
    return { v, piezas };
  });
  function pintaTablas() {
    ventanas.forEach(({ piezas }, i) => piezas.forEach((m, j) => { m.visible = j < tablas[i]; }));
  }

  // ---------- Electricidad ----------
  let palanca = null;
  if (M.luz) {
    const [x, z, ry, y] = M.luz;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.add(caja3(0.8, 1.1, 0.25, new THREE.MeshLambertMaterial({ color: '#4a4f45' }), 0, 1.5, 0.12));
    g.add(caja3(0.12, 0.6, 0.1, new THREE.MeshLambertMaterial({ color: '#2a2a2a' }), 0, 1.45, 0.3));
    palanca = new THREE.Group();
    palanca.position.set(0, 1.45, 0.32);
    const brazo = caja3(0.06, 0.45, 0.06, new THREE.MeshLambertMaterial({ color: '#b02a20' }), 0, 0.2, 0.05);
    palanca.add(brazo);
    palanca.rotation.x = 0.7;
    g.add(palanca);
    const r = cartel('ELECTRICIDAD', 0.7, 0.18, { fondo: '#d8c84a', tinta: '#1a1a1a' });
    r.position.set(0, 2.15, 0.26);
    g.add(r);
    grupo.add(g);
  }
  function enciende(sonar = true) {
    if (luz) return;
    luz = true;
    mundo.enciende();
    if (palanca) palanca.rotation.x = -0.7;
    if (sonar) { sonido.luz(); cb.aviso('¡Hay electricidad! Las bebidas funcionan'); }
    pintaMaquinas();
  }

  // ---------- Bebidas ----------
  const maquinas = M.bebidas.map(([tipo, x, z, ry, y = 0, ronda = 0]) => {
    const b = BEBIDAS[tipo];
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const [ancho, hondo, alto] = MEDIDA.bebida;
    const color = new THREE.Color(b.color);
    const cuerpo = new THREE.MeshLambertMaterial({ color });
    const brillo = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 0 });
    g.add(caja3(ancho, alto, hondo, cuerpo, 0, alto / 2, 0));
    g.add(caja3(ancho + 0.06, 0.12, hondo + 0.06, new THREE.MeshLambertMaterial({ color: '#2a2a2a' }), 0, 0.06, 0));
    g.add(caja3(ancho + 0.06, 0.1, hondo + 0.06, new THREE.MeshLambertMaterial({ color: '#2a2a2a' }), 0, alto - 0.05, 0));
    // El letrero que se ilumina, la ventanita con las latas y la bandeja.
    g.add(caja3(ancho * 0.86, 0.42, 0.04, brillo, 0, alto - 0.45, hondo / 2 + 0.01));
    const nombre = cartel(b.nombre, ancho * 0.8, 0.34, { tinta: '#fff' });
    nombre.position.set(0, alto - 0.45, hondo / 2 + 0.035);
    g.add(nombre);
    g.add(caja3(ancho * 0.55, 0.7, 0.03, new THREE.MeshLambertMaterial({ color: '#141414' }), 0, 1.05, hondo / 2 + 0.01));
    for (let j = 0; j < 3; j++) {
      const lata = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), brillo);
      lata.position.set(-0.15 + j * 0.15, 0.95 + (j % 2) * 0.22, hondo / 2 + 0.04);
      g.add(lata);
    }
    g.add(caja3(ancho * 0.5, 0.14, 0.14, new THREE.MeshLambertMaterial({ color: '#333' }), 0, 0.5, hondo / 2 + 0.07));
    const foco = new THREE.PointLight(color, 0, 5, 1.5);
    foco.position.set(0, alto + 0.3, hondo / 2 + 0.5);
    g.add(foco);
    grupo.add(g);
    const caja = huella(x, z, ry, y, MEDIDA.bebida);
    const fx = x + Math.sin(ry) * (hondo / 2 + 0.6), fz = z + Math.cos(ry) * (hondo / 2 + 0.6);
    const mq = { tipo, b, g, y, ronda, brillo, cuerpo, color, foco, caja, fx, fz, cae: ronda ? -1 : 1, puesto: false };
    if (!ronda) { choque(caja); mq.puesto = true; }
    else g.visible = false;
    return mq;
  });
  const prendida = mq => (luz || mq.b.luz === false) && mq.cae >= 1;
  function pintaMaquinas() {
    for (const mq of maquinas) {
      const on = prendida(mq);
      mq.brillo.emissiveIntensity = on ? 1.2 : 0;
      mq.cuerpo.color.copy(mq.color).multiplyScalar(on ? 1 : 0.35);
      mq.foco.intensity = on ? 6 : 0;
    }
    pintaPap();
  }

  // ---------- Caja misteriosa ----------
  const caja = new THREE.Group();
  const madera = new THREE.MeshLambertMaterial({ color: '#5a3b1e' });
  const [cw, cd, ch] = MEDIDA.caja;
  caja.add(caja3(cw, ch * 0.75, cd, madera, 0, ch * 0.375, 0));
  for (const s of [-1, 1]) caja.add(caja3(0.06, ch * 0.78, cd + 0.04, new THREE.MeshLambertMaterial({ color: '#2a2a2a' }), s * cw * 0.35, ch * 0.39, 0));
  const tapa = new THREE.Group();
  tapa.position.set(0, ch * 0.75, -cd / 2);
  tapa.add(caja3(cw, ch * 0.25, cd, madera, 0, ch * 0.125, cd / 2));
  caja.add(tapa);
  for (const s of [-1, 1]) {
    const q = cartel('?', 0.45, 0.45, { tinta: '#ffe680' });
    q.position.set(s * cw * 0.17, ch * 0.4, cd / 2 + 0.01);
    caja.add(q);
  }
  // El haz de luz azul que delata dónde está, como en el original.
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#7fb8ff', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  haz.position.y = 15;
  caja.add(haz);
  const luzCaja = new THREE.PointLight('#8fc0ff', 4, 4, 1.5);
  luzCaja.position.set(0, 1.2, 0.6);
  caja.add(luzCaja);
  grupo.add(caja);
  let cajaChoque = null;
  // giro: lo que pasa en mi caja (es de cada uno, como en Black Ops):
  // {t, arma, mod, osito, listo}
  let giro = null, mudando = 0;
  function ponCaja(i) {
    k = ((i % M.caja.length) + M.caja.length) % M.caja.length;
    const [x, z, ry, y = 0] = M.caja[k];
    caja.position.set(x, y, z);
    caja.rotation.y = ry;
    caja.visible = true;
    tapa.rotation.x = 0;
    if (cajaChoque) sacaChoque(cajaChoque);
    cajaChoque = choque(huella(x, z, ry, y, MEDIDA.caja));
  }
  const frenteCaja = () => {
    const [x, z, ry] = M.caja[k];
    return [x + Math.sin(ry) * (cd / 2 + 0.6), z + Math.cos(ry) * (cd / 2 + 0.6), M.caja[k][3] || 0];
  };
  function quitaModelo() {
    if (giro?.mod) { grupo.remove(giro.mod); giro.mod.traverse(o => o.geometry?.dispose()); giro.mod = null; }
  }
  function muestra(id) {
    quitaModelo();
    const m = cb.modelo(id);
    m.scale.setScalar(1.6);
    grupo.add(m);
    giro.mod = m;
  }
  function osito() {
    const g = new THREE.Group();
    const piel = new THREE.MeshLambertMaterial({ color: '#8a5a32' });
    const esf = (r, x, y, z) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), piel); s.position.set(x, y, z); g.add(s); };
    esf(0.2, 0, 0, 0); esf(0.14, 0, 0.28, 0); esf(0.05, -0.1, 0.4, 0); esf(0.05, 0.1, 0.4, 0);
    esf(0.07, -0.2, 0.05, 0.05); esf(0.07, 0.2, 0.05, 0.05); esf(0.08, -0.1, -0.2, 0.05); esf(0.08, 0.1, -0.2, 0.05);
    return g;
  }
  function abreCaja() {
    if (giro || mudando > 0 || !cb.gasta(CAJA_PRECIO)) return;
    sonido.caja();
    // A partir del cuarto uso en el mismo sitio, un osito de cada seis.
    const conOsito = n >= 4 && Math.random() < 1 / 6;
    pide('caja');
    const opciones = CAJA_ARMAS.filter(id => !cb.arma.tiene(id));
    const final = (opciones.length ? opciones : CAJA_ARMAS)[Math.floor(Math.random() * (opciones.length || CAJA_ARMAS.length))];
    giro = { t: 0, arma: final, mod: null, osito: conOsito, cambia: 0, listo: false, ultimo: -1 };
  }
  function pasoCaja(dt) {
    haz.material.opacity = 0.12 + 0.05 * Math.sin(performance.now() / 300);
    if (mudando > 0) {
      mudando -= dt;
      caja.position.y += dt * 4;
      caja.rotation.y += dt * 3;
      if (mudando <= 0) { caja.visible = false; if (cb.director()) aplica('osito'); else envia('osito'); }
      return;
    }
    if (!giro) { tapa.rotation.x = Math.max(0, tapa.rotation.x - dt * 3); return; }
    giro.t += dt;
    tapa.rotation.x = Math.min(1.9, tapa.rotation.x + dt * 4);
    const [fx, fz] = frenteCaja();
    const [x, z, ry, y = 0] = M.caja[k];
    const sube = Math.min(1, giro.t / CAJA_GIRA);
    if (giro.t < CAJA_GIRA) {
      giro.cambia -= dt;
      if (giro.cambia <= 0) {
        giro.cambia = 0.08 + 0.2 * sube;
        let id;
        do id = CAJA_ARMAS[Math.floor(Math.random() * CAJA_ARMAS.length)]; while (id === giro.ultimo && CAJA_ARMAS.length > 1);
        giro.ultimo = id;
        muestra(id);
      }
    } else if (!giro.listo) {
      giro.listo = true;
      if (giro.osito) {
        quitaModelo();
        giro.mod = osito();
        grupo.add(giro.mod);
        sonido.osito();
        cb.suma(CAJA_PRECIO);
        cb.aviso('¡El osito! La caja se va a otro lado (te devuelve los puntos)');
      } else muestra(giro.arma);
    }
    if (giro.mod) {
      giro.mod.position.set(x, y + 0.7 + sube * 0.5, z);
      giro.mod.rotation.set(0, ry + Math.PI / 2, 0);
      if (giro.osito && giro.listo) giro.mod.rotation.y = ry;
    }
    if (giro.osito && giro.listo && giro.t > CAJA_GIRA + 1.5) {
      quitaModelo(); giro = null; mudando = 1.6;
      return;
    }
    if (giro.t > CAJA_GIRA + CAJA_ESPERA) { quitaModelo(); giro = null; }
    void fx; void fz;
  }
  function tomaDeCaja() {
    if (!giro?.listo || giro.osito) return;
    cb.arma.compra(giro.arma);
    quitaModelo();
    giro = null;
  }

  // ---------- Armas de pared ----------
  const paredes = M.pared.map(([arma, x, y, z, ry, precio]) => {
    const tiza = cartel(NOMBRE_ARMA[arma], 1.3, 0.6, { borde: 'rgba(240,240,230,0.85)', tinta: 'rgba(240,240,230,0.9)', sub: `💰 ${precio}`, fuente: '600' });
    tiza.position.set(x + Math.sin(ry) * 0.02, y, z + Math.cos(ry) * 0.02);
    tiza.rotation.y = ry;
    grupo.add(tiza);
    const mod = cb.modelo(arma);
    mod.scale.setScalar(1.3);
    mod.position.set(x + Math.sin(ry) * 0.08, y + 0.08, z + Math.cos(ry) * 0.08);
    mod.rotation.set(0, ry + Math.PI / 2, 0);
    grupo.add(mod);
    return { arma, precio, fx: x + Math.sin(ry) * 0.8, fz: z + Math.cos(ry) * 0.8, piso: y - 1.5 };
  });

  // ---------- Pack-a-Punch ----------
  let pap = null;
  if (M.pap) {
    const [x, z, ry, y = 0, ronda = 0] = M.pap;
    const [ancho, hondo, alto] = MEDIDA.pap;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const metal = new THREE.MeshLambertMaterial({ color: '#3a3a44' });
    const morado = new THREE.MeshLambertMaterial({ color: '#2a1440', emissive: '#a040ff', emissiveIntensity: 0 });
    g.add(caja3(ancho, alto * 0.7, hondo, metal, 0, alto * 0.35, 0));
    g.add(caja3(ancho * 0.9, 0.12, hondo * 0.9, morado, 0, alto * 0.7 + 0.06, 0));
    const rodillos = [];
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, ancho * 0.85, 12), morado);
      r.rotation.z = Math.PI / 2;
      r.position.set(0, alto * 0.82, s * 0.2);
      g.add(r);
      rodillos.push(r);
    }
    g.add(caja3(ancho * 0.6, 0.3, 0.05, morado, 0, alto * 0.45, hondo / 2 + 0.01));
    const r = cartel('PACK-A-PUNCH', ancho * 0.9, 0.22, { fondo: '#141414', tinta: '#c58bff' });
    r.position.set(0, alto * 0.2, hondo / 2 + 0.01);
    g.add(r);
    const foco = new THREE.PointLight('#b060ff', 0, 6, 1.5);
    foco.position.set(0, alto + 0.4, hondo / 2 + 0.4);
    g.add(foco);
    grupo.add(g);
    choque(huella(x, z, ry, y, MEDIDA.pap));
    pap = { g, ronda, morado, rodillos, foco, y, ry, x, z, fx: x + Math.sin(ry) * (hondo / 2 + 0.7), fz: z + Math.cos(ry) * (hondo / 2 + 0.7), mio: null };
  }
  const papPrendido = () => pap && (luz || M.luzSiempre) && (!pap.ronda || cb.ronda() >= pap.ronda);
  function pintaPap() {
    if (!pap) return;
    const on = papPrendido();
    pap.morado.emissiveIntensity = on ? 0.9 : 0;
    pap.foco.intensity = on ? 7 : 0;
  }
  function usaPap() {
    const id = cb.arma.enMano();
    if (pap.mio || id == null || ARMAS[id]?.melee) return;
    if (cb.arma.tienePap(id)) {
      if (!cb.gasta(PAP_MUNICION)) return;
      cb.arma.llena(id);
      sonido.compra();
      return;
    }
    if (!cb.gasta(PAP_PRECIO)) return;
    sonido.pap();
    const m = cb.modelo(id);
    m.scale.setScalar(1.4);
    grupo.add(m);
    pap.mio = { id, t: 0, m };
  }
  function pasoPap(dt) {
    if (!pap) return;
    const on = papPrendido();
    for (const r of pap.rodillos) r.rotation.x += dt * (on ? 6 : 0);
    if (!pap.mio) return;
    const p = pap.mio;
    p.t += dt;
    // Entra por la boca, se queda adentro y sale con otro color.
    const k2 = p.t < 0.8 ? 1 - p.t / 0.8 : p.t < PAP_TARDA - 0.8 ? 0 : (p.t - (PAP_TARDA - 0.8)) / 0.8;
    p.m.position.set(pap.x + Math.sin(pap.ry) * (0.3 + k2 * 0.6), pap.y + MEDIDA.pap[2] * 0.82 + 0.1, pap.z + Math.cos(pap.ry) * (0.3 + k2 * 0.6));
    p.m.rotation.set(0, pap.ry + Math.PI / 2, 0);
    p.m.visible = p.t < 0.8 || p.t > PAP_TARDA - 0.8;
    if (p.t >= PAP_TARDA) {
      grupo.remove(p.m); p.m.traverse(o => o.geometry?.dispose());
      pap.mio = null;
      cb.arma.pap(p.id);
    }
  }

  // ---------- Teletransportadores ----------
  let tele = null, viaje = 0;
  if (M.teleporter) {
    const T = M.teleporter;
    const plataforma = (x, z, y, r) => {
      const mat = new THREE.MeshLambertMaterial({ color: '#2a3440', emissive: '#4ab0ff', emissiveIntensity: 0 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, 0.12, 24), mat);
      m.position.set(x, y + 0.06, z);
      m.receiveShadow = true;
      grupo.add(m);
      return mat;
    };
    const padMat = plataforma(T.pad[0], T.pad[1], T.pad[2], 1.1);
    // El enlace: el proyector en Kino, el «mainframe» en Der Riese.
    const [ex, ez, ey] = T.enlace;
    const eMat = new THREE.MeshLambertMaterial({ color: '#30363c', emissive: '#4ab0ff', emissiveIntensity: 0 });
    const consola = caja3(0.7, 1.1, 0.5, eMat, ex, ey + 0.55, ez);
    grupo.add(consola);
    choque({ minx: ex - 0.35, maxx: ex + 0.35, minz: ez - 0.25, maxz: ez + 0.25, miny: ey, maxy: ey + 1.1 });
    tele = { T, padMat, eMat };
  }
  const kino = () => !!tele && !tele.T.abre;
  function pintaTele() {
    if (!tele) return;
    const listo = kino() ? (f & 1) : abiertas.has(tele.T.abre);
    tele.padMat.emissiveIntensity = listo ? 0.9 : kino() || w <= 0 ? 0 : 0.4 + 0.4 * Math.sin(performance.now() / 120);
    tele.eMat.emissiveIntensity = listo ? 0.9 : 0;
  }

  // ---------- Pedir y aplicar ----------
  function aplica(que) {
    const [a, b] = que.split(':');
    if (a === 'puerta') abre(b);
    else if (a === 'tabla') { const i = +b; if (tablas[i] !== undefined && tablas[i] < TABLAS) { tablas[i]++; pintaTablas(); } }
    else if (a === 'luz') enciende();
    else if (a === 'caja') n++;
    else if (a === 'osito') {
      let s = k;
      if (M.caja.length > 1) while (s === k) s = Math.floor(Math.random() * M.caja.length);
      n = 0;
      ponCaja(s);
    } else if (a === 'enlace' && tele) {
      if (kino()) { if (luz) f |= 1; }
      else if (w > 0) { w = 0; abre(tele.T.abre); cb.aviso('¡Teletransportador enlazado! El Pack-a-Punch está abierto'); }
    } else if (a === 'pad' && tele && !kino() && luz) w = tele.T.ventana || 30;
    else if (a === 'tele') f &= ~1;
  }
  function envia(que) { cb.envia(que); }
  // Lo que pido yo: en mi pantalla ya, y al director si no lo soy.
  function pide(que) {
    if (que !== 'osito' && que !== 'caja') aplica(que);
    if (cb.director()) { if (que === 'caja') aplica(que); }
    else envia(que);
  }
  // Lo que me piden los demás (solo lo atiende el director).
  function peticion(que) {
    if (typeof que !== 'string' || !cb.director()) return;
    aplica(que);
  }
  function quitaTabla(i) {
    if (tablas[i] > 0) { tablas[i]--; pintaTablas(); }
  }

  // ---------- La red ----------
  function estado() {
    let o = 0;
    M.puertas.forEach((p, i) => { if (abiertas.has(p.id)) o |= 1 << i; });
    return { o, l: luz ? 1 : 0, k, n, t: tablas.join(''), f, w: r1(w) };
  }
  function desdeRed(zb) {
    if (!zb || typeof zb !== 'object') return;
    const o = zb.o | 0;
    M.puertas.forEach((p, i) => { if (o & (1 << i)) abre(p.id); });
    if (zb.l) enciende();
    if (Number.isInteger(zb.k) && zb.k !== k && zb.k >= 0 && zb.k < M.caja.length && mudando <= 0) {
      giro && quitaModelo();
      giro = null;
      ponCaja(zb.k);
    }
    n = zb.n | 0;
    if (typeof zb.t === 'string' && zb.t.length === tablas.length) {
      for (let i = 0; i < tablas.length; i++) tablas[i] = Math.max(0, Math.min(TABLAS, +zb.t[i] || 0));
      pintaTablas();
    }
    f = zb.f | 0;
    w = +zb.w || 0;
  }

  // ---------- Qué hay cerca y qué hace E ----------
  let opcion = null, reparando = 0;
  function cercaDe(px, pz, py, x, z, y, r = CERCA) {
    const d = Math.hypot(px - x, pz - z);
    return d < r && Math.abs(py - y) < 1.3 ? d : Infinity;
  }
  function busca() {
    if (!cb.puedo()) return null;
    const p = cb.pos();
    let mejor = null, dm = Infinity;
    const ofrece = (d, o) => { if (d < dm) { dm = d; mejor = o; } };
    for (const { p: d } of puertas) {
      if (d.auto || abiertas.has(d.id)) continue;
      const a = d.eje === 'x' ? Math.abs(p.x - d.x) : Math.abs(p.z - d.z);
      const b = d.eje === 'x' ? p.z - d.z : p.x - d.x;
      const dist = Math.hypot(Math.max(0, a - d.w / 2), b);
      if (dist < 1.8 && Math.abs(p.y - d.y) < 1.4) ofrece(dist, { t: 'puerta', d, precio: d.precio });
    }
    ventanas.forEach(({ v }, i) => {
      if (tablas[i] >= TABLAS) return;
      ofrece(cercaDe(p.x, p.z, p.y, v.x - v.nx * 0.9, v.z - v.nz * 0.9, v.y, 1.6) + 0.3, { t: 'tabla', i });
    });
    if (M.luz && !luz) ofrece(cercaDe(p.x, p.z, p.y, M.luz[0] + Math.sin(M.luz[2]) * 0.7, M.luz[1] + Math.cos(M.luz[2]) * 0.7, M.luz[3] || 0), { t: 'luz' });
    for (const mq of maquinas) {
      if (mq.cae < 1) continue;
      ofrece(cercaDe(p.x, p.z, p.y, mq.fx, mq.fz, mq.y), { t: 'bebida', mq });
    }
    if (caja.visible && mudando <= 0) {
      const [fx, fz, fy] = frenteCaja();
      ofrece(cercaDe(p.x, p.z, p.y, fx, fz, fy), { t: 'caja' });
    }
    for (const pw of paredes) ofrece(cercaDe(p.x, p.z, p.y, pw.fx, pw.fz, pw.piso, 1.4), { t: 'pared', pw });
    if (pap && (!pap.ronda || cb.ronda() >= pap.ronda)) ofrece(cercaDe(p.x, p.z, p.y, pap.fx, pap.fz, pap.y), { t: 'pap' });
    if (tele) {
      const T = tele.T;
      ofrece(cercaDe(p.x, p.z, p.y, T.pad[0], T.pad[1], T.pad[2], 1.3), { t: 'pad' });
      const [ex, ez, ey] = T.enlace;
      ofrece(cercaDe(p.x, p.z, p.y, ex, ez, ey, 1.6), { t: 'enlace' });
    }
    return mejor;
  }
  const falta = precio => { const f2 = precio - cb.puntos(); return f2 > 0 ? ` (te faltan ${f2})` : ''; };
  function texto(o) {
    if (!o) return null;
    switch (o.t) {
      case 'puerta': return `E: abrir ${o.d.nombre} · 💰 ${o.precio}${falta(o.precio)}`;
      case 'tabla': return 'Mantén E: reparar la ventana (+10)';
      case 'luz': return 'E: encender la electricidad';
      case 'bebida': {
        const { mq } = o, b = mq.b;
        if (cb.bebida.tiene(mq.tipo)) return `Ya tienes ${b.nombre}`;
        if (!prendida(mq)) return `${b.nombre}: necesita electricidad`;
        const precio = mq.tipo === 'revive' && cb.solo() ? b.solo : b.precio;
        return `E: ${b.nombre} (${b.texto}) · 💰 ${precio}${falta(precio)}`;
      }
      case 'caja':
        if (giro?.listo && !giro.osito) return `E: tomar la ${NOMBRE_ARMA[giro.arma]} (${ARMAS[giro.arma].corto})`;
        if (giro) return '…';
        return `E: caja misteriosa · 💰 ${CAJA_PRECIO}${falta(CAJA_PRECIO)}`;
      case 'pared': {
        const { pw } = o, a = ARMAS[pw.arma];
        if (cb.arma.tiene(pw.arma)) {
          const precio = cb.arma.tienePap(pw.arma) ? PAP_MUNICION : Math.round(pw.precio / 2);
          return `E: munición de la ${a.nombre} · 💰 ${precio}${falta(precio)}`;
        }
        return `E: comprar la ${a.nombre} (${a.corto}) · 💰 ${pw.precio}${falta(pw.precio)}`;
      }
      case 'pap': {
        if (!papPrendido()) return 'Pack-a-Punch: necesita electricidad';
        if (pap.mio) return 'Mejorando…';
        const id = cb.arma.enMano();
        if (id == null || ARMAS[id]?.melee) return 'Pack-a-Punch: saca un arma de fuego';
        if (cb.arma.tienePap(id)) return `E: munición (Pack-a-Punch) · 💰 ${PAP_MUNICION}${falta(PAP_MUNICION)}`;
        return `E: Pack-a-Punch a la ${ARMAS[id].nombre} · 💰 ${PAP_PRECIO}${falta(PAP_PRECIO)}`;
      }
      case 'pad': {
        if (!luz) return 'Teletransportador: necesita electricidad';
        if (kino()) return f & 1 ? `E: teletransportarse · 💰 ${tele.T.precio}${falta(tele.T.precio)}` : 'Teletransportador: enlázalo en el proyector';
        if (abiertas.has(tele.T.abre)) return 'Teletransportador enlazado';
        return w > 0 ? `Corre al mainframe: ${Math.ceil(w)} s` : 'E: activar el teletransportador';
      }
      case 'enlace': {
        if (!luz) return 'Necesita electricidad';
        if (kino()) return f & 1 ? 'Teletransportador enlazado' : 'E: enlazar el teletransportador';
        if (abiertas.has(tele.T.abre)) return 'Teletransportador enlazado';
        return w > 0 ? 'E: enlazar el teletransportador' : 'Primero activa el teletransportador';
      }
    }
    return null;
  }
  // Una pulsación de E.
  function usar() {
    const o = opcion;
    if (!o || !cb.puedo()) return false;
    switch (o.t) {
      case 'puerta':
        if (cb.gasta(o.precio)) pide('puerta:' + o.d.id);
        break;
      case 'luz': pide('luz'); break;
      case 'bebida': {
        const { mq } = o;
        if (cb.bebida.tiene(mq.tipo) || !prendida(mq)) break;
        if (cb.gasta(mq.tipo === 'revive' && cb.solo() ? mq.b.solo : mq.b.precio)) { sonido.bebida(); cb.bebida.toma(mq.tipo); }
        break;
      }
      case 'caja':
        if (giro?.listo) tomaDeCaja();
        else abreCaja();
        break;
      case 'pared': {
        const { pw } = o;
        if (cb.arma.tiene(pw.arma)) {
          if (cb.gasta(cb.arma.tienePap(pw.arma) ? PAP_MUNICION : Math.round(pw.precio / 2))) { cb.arma.llena(pw.arma); sonido.compra(); }
        } else if (cb.gasta(pw.precio)) { sonido.compra(); cb.arma.compra(pw.arma); }
        break;
      }
      case 'pap': if (papPrendido()) usaPap(); break;
      case 'pad':
        if (!luz || !tele) break;
        if (kino()) {
          if (f & 1 && viaje <= 0 && cb.gasta(tele.T.precio)) {
            sonido.teleport();
            const [x, z, y] = tele.T.destino;
            cb.teleporta(x, y, z);
            viaje = tele.T.dura;
            cb.aviso(`¡Al Pack-a-Punch! Vuelves en ${tele.T.dura} s`);
            pide('tele');
          }
        } else if (!abiertas.has(tele.T.abre) && w <= 0) { sonido.luz(); pide('pad'); cb.aviso('Tienes 30 s para enlazarlo en el mainframe'); }
        break;
      case 'enlace':
        if (luz && !(kino() && f & 1)) { sonido.teleport(); pide('enlace'); }
        break;
      default: return false;
    }
    return true;
  }

  // Cada cuadro: lo que se mueve, la cuenta del enlace, las bebidas que caen
  // en Nuketown, la vuelta del teletransportador y el cartel. `e`: E apretada.
  function actualizar(dt, e) {
    const ronda = cb.ronda();
    w = Math.max(0, w - dt);
    for (const mq of maquinas) {
      if (mq.cae >= 1) continue;
      if (mq.cae < 0) {
        if (!mq.ronda || ronda < mq.ronda) continue;
        mq.cae = 0; mq.g.visible = true;
        cb.aviso(`¡Cayó ${mq.b.nombre}!`);
      }
      mq.cae = Math.min(1, mq.cae + dt / 1.4);
      mq.g.position.y = mq.y + (1 - mq.cae) * (1 - mq.cae) * 30;
      if (mq.cae >= 1) {
        sonido.explosion(cb.pos().distanceTo(mq.g.position));
        if (!mq.puesto) { choque(mq.caja); mq.puesto = true; }
        pintaMaquinas();
      }
    }
    pintaPap();
    pintaTele();
    pasoCaja(dt);
    pasoPap(dt);
    if (viaje > 0) {
      viaje -= dt;
      if (viaje <= 0 && tele) {
        const [x, z, y] = tele.T.vuelta;
        sonido.teleport();
        cb.teleporta(x, y, z);
      }
    }
    opcion = busca();
    // Las tablas se reparan manteniendo E: una cada TABLA_CADA segundos.
    if (opcion?.t === 'tabla' && e) {
      reparando += dt;
      if (reparando >= TABLA_CADA) {
        reparando = 0;
        pide('tabla:' + opcion.i);
        sonido.tabla();
        cb.suma(10);
      }
    } else reparando = Math.min(reparando, TABLA_CADA * 0.6);
    cb.prompt(texto(opcion));
  }

  function desmonta() {
    if (giro) quitaModelo();
    if (pap?.mio) grupo.remove(pap.mio.m);
    escena.remove(grupo);
    grupo.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { o.material.map?.dispose(); o.material.dispose?.(); }
    });
    for (const b of [...propios]) sacaChoque(b);
  }

  ponCaja(0);
  pintaTablas();
  pintaMaquinas();

  return {
    estado, desdeRed, peticion, usar, actualizar, desmonta, quitaTabla, zonaActiva,
    puertaAbierta: id => abiertas.has(id),
    enAislado: p => (M.aislado || []).some(([x0, x1, z0, z1]) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1),
    enLava: p => p.y < 0.3 && (M.lava || []).some(([x0, x1, z0, z1]) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1),
    tablas,
    get luz() { return luz; },
    get viajando() { return viaje > 0; },
  };
}
