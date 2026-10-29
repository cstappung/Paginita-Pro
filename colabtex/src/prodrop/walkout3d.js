/* PRODROP · la escena 3D del walkout de fútbol (three.js).
   Se empaqueta aparte (`npm run build:walkout` → juegos/prodrop/walkout3d.js,
   ESM) y `walkout.js` la importa solo al abrir un sobre de fútbol con una
   épica o mejor. No usa luces ni modelos: todo es MeshBasic con texturas
   pintadas en un canvas, así que pesa poco y anda en un celular.

   La cámara recorre un pasillo de cemento con focos en el techo y una
   franja LED del color de la carta, sale a la cancha (un estadio con
   público, focos y flashes de fotos) y se queda mirando el centro, donde
   `walkout.js` pone la bandera, la posición, el escudo y la carta en HTML.
   `crear(canvas, o)` devuelve `{ cuadro(t), tamano(w, h), fuegos(n), fin() }`;
   `t` son los segundos desde el inicio y `o.tunel` lo que dura el pasillo. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Fog, Color, Vector3,
  PlaneGeometry, CylinderGeometry, BufferGeometry, BufferAttribute,
  Mesh, Points, Sprite, Group,
  MeshBasicMaterial, PointsMaterial, SpriteMaterial,
  CanvasTexture, RepeatWrapping, AdditiveBlending, BackSide, DoubleSide,
  SRGBColorSpace,
} from 'three';

const LARGO = 42;            // el pasillo va de z = 0 a z = -LARGO
const ANCHO = 6, ALTO = 4.4;
const CENTRO = new Vector3(0, 0, -92);   // el centro de la cancha

const lienzo = (w, h, pinta) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  pinta(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
};
// un azar con semilla: la escena sale igual cada vez
const azar = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

function texCemento(r) {
  return lienzo(512, 256, (g, w, h) => {
    g.fillStyle = '#5a5d66'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 70 + r() * 50 | 0;
      g.fillStyle = `rgba(${v},${v},${v + 6},${.12 + r() * .2})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    // paneles: juntas verticales y una franja más oscura abajo
    g.strokeStyle = '#2c2e35'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = '#33353d'; g.fillRect(0, h * .78, w, h * .22);
    g.fillStyle = '#23252b'; g.fillRect(0, h * .77, w, 4);
  });
}
function texPiso() {
  return lienzo(256, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#15161b'); gr.addColorStop(.5, '#24262e'); gr.addColorStop(1, '#15161b');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff10';
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 2);
  });
}
function texGlow() {
  return lienzo(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
// la franja LED: trazos de luz que corren por el pasillo (se mueve el offset)
function texLed() {
  return lienzo(512, 8, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 128) {
      const gr = g.createLinearGradient(x, 0, x + 110, 0);
      gr.addColorStop(0, '#000'); gr.addColorStop(.8, '#fff'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.fillRect(x, 0, 110, h);
    }
  });
}
function texCancha() {
  return lienzo(512, 1024, (g, w, h) => {
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#2f7a34' : '#36883b'; g.fillRect(0, i * h / 12, w, h / 12); }
    g.strokeStyle = '#e9f5e9cc'; g.lineWidth = 5;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.beginPath(); g.moveTo(24, h / 2); g.lineTo(w - 24, h / 2); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 70, 0, Math.PI * 2); g.stroke();
    g.strokeRect(w / 2 - 120, 24, 240, 130); g.strokeRect(w / 2 - 120, h - 154, 240, 130);
  });
}
// el público: filas de puntos de colores sobre gradas oscuras
function texPublico(r, tinte) {
  return lienzo(1024, 256, (g, w, h) => {
    const fondo = g.createLinearGradient(0, 0, 0, h); fondo.addColorStop(0, '#1c2236'); fondo.addColorStop(1, '#2a3150');
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    const cols = ['#e8e8f0', '#c7cad6', '#1e3a8a', '#b91c1c', '#facc15', '#16a34a', tinte, tinte];
    for (let y = 6; y < h; y += 7) {
      g.fillStyle = '#ffffff08'; g.fillRect(0, y + 4, w, 1);
      for (let x = r() * 4; x < w; x += 4 + r() * 3) {
        if (r() < .12) continue;
        g.fillStyle = cols[r() * cols.length | 0];
        g.globalAlpha = .65 + r() * .35;
        g.fillRect(x, y, 2.4, 3.2);
      }
    }
    g.globalAlpha = 1;
  });
}

/* El estadio (cancha, gradas con público, focos, haz del centro, flashes y
   fuegos artificiales): lo usan el walkout y el fondo de los sobres. */
function armaEstadio(scene, r, tinte, glow, guarda, color2) {
  const estadio = new Group(); scene.add(estadio);
  const cancha = texCancha();
  const mCancha = new MeshBasicMaterial({ map: cancha }), gCancha = new PlaneGeometry(70, 108); guarda(cancha, gCancha, mCancha);
  const pasto = new Mesh(gCancha, mCancha); pasto.rotation.x = -Math.PI / 2; pasto.position.copy(CENTRO); estadio.add(pasto);
  const mBorde = new MeshBasicMaterial({ color: '#1d4d22' }), gBorde = new PlaneGeometry(130, 150); guarda(null, gBorde, mBorde);
  const borde = new Mesh(gBorde, mBorde); borde.rotation.x = -Math.PI / 2; borde.position.set(CENTRO.x, -.02, CENTRO.z); estadio.add(borde);
  const pub = texPublico(r, '#' + tinte.getHexString()); pub.wrapS = RepeatWrapping; pub.repeat.set(5, 3);
  const mGradas = new MeshBasicMaterial({ map: pub, side: BackSide });
  const gGradas = new CylinderGeometry(96, 58, 34, 72, 1, true); guarda(pub, gGradas, mGradas);
  const gradas = new Mesh(gGradas, mGradas); gradas.position.set(CENTRO.x, 17, CENTRO.z); estadio.add(gradas);
  // el techo del estadio: un anillo oscuro arriba, para que no se vea el borde
  const mAnillo = new MeshBasicMaterial({ color: '#07080e', side: DoubleSide }), gAnillo = new CylinderGeometry(112, 96, 6, 72, 1, true); guarda(null, gAnillo, mAnillo);
  const anillo = new Mesh(gAnillo, mAnillo); anillo.position.set(CENTRO.x, 36, CENTRO.z); estadio.add(anillo);
  // cuatro torres de focos
  const mTorre = new SpriteMaterial({ map: glow, color: '#f4f7ff', transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false, fog: false }); guarda(null, null, mTorre);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, s = new Sprite(mTorre);
    s.scale.set(30, 30, 1); s.position.set(CENTRO.x + Math.cos(a) * 88, 42, CENTRO.z + Math.sin(a) * 88); estadio.add(s);
  }
  // el resplandor de los focos sobre el estadio (cielo y gradas)
  const mCielo = new SpriteMaterial({ map: glow, color: '#9fb4ff', transparent: true, opacity: .35, blending: AdditiveBlending, depthWrite: false, fog: false }); guarda(null, null, mCielo);
  const cielo = new Sprite(mCielo); cielo.scale.set(260, 120, 1); cielo.position.set(CENTRO.x, 40, CENTRO.z - 40); estadio.add(cielo);
  // el haz del centro: un cono de luz del color de la carta
  const mHaz = new MeshBasicMaterial({ color: tinte, transparent: true, opacity: .16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const gHaz = new CylinderGeometry(.6, 7, 40, 40, 1, true); guarda(null, gHaz, mHaz);
  const haz = new Mesh(gHaz, mHaz); haz.position.set(CENTRO.x, 20, CENTRO.z); estadio.add(haz);
  const mPiscina = new MeshBasicMaterial({ map: glow, color: tinte, transparent: true, opacity: .7, blending: AdditiveBlending, depthWrite: false }); const gPiscina = new PlaneGeometry(18, 18); guarda(null, gPiscina, mPiscina);
  const piscina = new Mesh(gPiscina, mPiscina); piscina.rotation.x = -Math.PI / 2; piscina.position.set(CENTRO.x, .05, CENTRO.z); estadio.add(piscina);

  // flashes de fotos en las gradas: puntos que se prenden al azar (aditivos: negro = apagado)
  const NF = 420, posF = new Float32Array(NF * 3), colF = new Float32Array(NF * 3);
  for (let i = 0; i < NF; i++) {
    const a = r() * Math.PI * 2, h = 3 + r() * 28, rad = 58 + (h / 34) * 38 - 1.5;
    posF[i * 3] = CENTRO.x + Math.cos(a) * rad; posF[i * 3 + 1] = h; posF[i * 3 + 2] = CENTRO.z + Math.sin(a) * rad;
  }
  const gFlash = new BufferGeometry(); gFlash.setAttribute('position', new BufferAttribute(posF, 3)); gFlash.setAttribute('color', new BufferAttribute(colF, 3));
  const mFlash = new PointsMaterial({ size: 1.6, map: glow, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false });
  guarda(null, gFlash, mFlash);
  const flashes = new Points(gFlash, mFlash); estadio.add(flashes);

  // fuegos artificiales: un fondo común de partículas
  const NP = 1800, posP = new Float32Array(NP * 3), colP = new Float32Array(NP * 3), vel = new Float32Array(NP * 3), vida = new Float32Array(NP), base = new Float32Array(NP * 3);
  const gFuego = new BufferGeometry(); gFuego.setAttribute('position', new BufferAttribute(posP, 3)); gFuego.setAttribute('color', new BufferAttribute(colP, 3));
  const mFuego = new PointsMaterial({ size: 1.1, map: glow, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false });
  guarda(null, gFuego, mFuego);
  const fuego = new Points(gFuego, mFuego); fuego.frustumCulled = false; estadio.add(fuego);
  let libre = 0;
  const paleta = [tinte, tinte.clone().lerp(new Color('#ffffff'), .6), new Color('#ffffff'), new Color(color2 || '#ffffff')];
  function estalla(x, y, z) {
    const col = paleta[r() * paleta.length | 0], n = 140;
    for (let k = 0; k < n; k++) {
      const i = libre; libre = (libre + 1) % NP;
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), v = 9 + r() * 5;
      posP[i * 3] = x; posP[i * 3 + 1] = y; posP[i * 3 + 2] = z;
      vel[i * 3] = s * Math.cos(th) * v; vel[i * 3 + 1] = u * v + 2; vel[i * 3 + 2] = s * Math.sin(th) * v;
      vida[i] = 1.6 + r() * .8; base[i * 3] = col.r; base[i * 3 + 1] = col.g; base[i * 3 + 2] = col.b;
    }
  }
  let pendientes = 0, proximo = 0;
  const fuegos = n => { pendientes += n; };

  function paso(t, dt) {
    if (!estadio.visible) return;
    haz.rotation.y += dt * .35;
    mHaz.opacity = .13 + Math.sin(t * 2.2) * .04;
    for (let i = 0; i < NF; i++) {
      const on = r() < .012 ? 1 : 0, v = on ? 1 : colF[i * 3] * .72;
      colF[i * 3] = colF[i * 3 + 1] = colF[i * 3 + 2] = v;
    }
    gFlash.attributes.color.needsUpdate = true;
    if (pendientes > 0 && t >= proximo) {
      pendientes--; proximo = t + .28 + r() * .3;
      estalla(CENTRO.x + (r() - .5) * 60, 22 + r() * 14, CENTRO.z - 10 - r() * 30);
    }
    for (let i = 0; i < NP; i++) {
      if (vida[i] <= 0) { colP[i * 3] = colP[i * 3 + 1] = colP[i * 3 + 2] = 0; continue; }
      vida[i] -= dt;
      vel[i * 3 + 1] -= 9.8 * .35 * dt; vel[i * 3] *= .985; vel[i * 3 + 1] *= .985; vel[i * 3 + 2] *= .985;
      posP[i * 3] += vel[i * 3] * dt; posP[i * 3 + 1] += vel[i * 3 + 1] * dt; posP[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const a = Math.min(1, vida[i]);
      colP[i * 3] = base[i * 3] * a; colP[i * 3 + 1] = base[i * 3 + 1] * a; colP[i * 3 + 2] = base[i * 3 + 2] * a;
    }
    gFuego.attributes.position.needsUpdate = true; gFuego.attributes.color.needsUpdate = true;
  }
  // tiñe el haz, el charco de luz y los fuegos del color de otra carta
  function tinta(c) {
    tinte.set(c); mHaz.color.copy(tinte); mPiscina.color.copy(tinte);
    paleta[1] = tinte.clone().lerp(new Color('#ffffff'), .6);
  }
  return { estadio, paso, fuegos, tinta };
}

export function crear(canvas, o = {}) {
  const r = azar(7);
  const tinte = new Color(o.color || '#ffd23d');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  scene.background = new Color('#05060b');
  scene.fog = new Fog('#05060b', 14, 150);
  const cam = new PerspectiveCamera(62, 1, .1, 400);
  const tex = [], geo = [], mat = [];
  const guarda = (t, g, m) => { if (t) tex.push(t); if (g) geo.push(g); if (m) mat.push(m); };
  const glow = texGlow(); guarda(glow);

  /* ---------- el pasillo ---------- */
  const tunel = new Group(); scene.add(tunel);
  const cem = texCemento(r); cem.wrapS = cem.wrapT = RepeatWrapping; cem.repeat.set(LARGO / 6, 1);
  const mPared = new MeshBasicMaterial({ map: cem, color: '#8e919c' });
  const gPared = new PlaneGeometry(LARGO, ALTO); guarda(cem, gPared, mPared);
  for (const lado of [-1, 1]) {
    const p = new Mesh(gPared, mPared);
    p.position.set(lado * ANCHO / 2, ALTO / 2, -LARGO / 2); p.rotation.y = -lado * Math.PI / 2;
    tunel.add(p);
  }
  const mTecho = new MeshBasicMaterial({ color: '#1b1c22' }), gTecho = new PlaneGeometry(ANCHO, LARGO); guarda(null, gTecho, mTecho);
  const techo = new Mesh(gTecho, mTecho); techo.rotation.x = Math.PI / 2; techo.position.set(0, ALTO, -LARGO / 2); tunel.add(techo);
  const piso = texPiso(); piso.wrapS = piso.wrapT = RepeatWrapping; piso.repeat.set(1, LARGO / 8);
  const mPiso = new MeshBasicMaterial({ map: piso }), gPiso = new PlaneGeometry(ANCHO, LARGO); guarda(piso, gPiso, mPiso);
  const suelo = new Mesh(gPiso, mPiso); suelo.rotation.x = -Math.PI / 2; suelo.position.set(0, .01, -LARGO / 2); tunel.add(suelo);
  // focos del techo y su charco de luz en el piso (cada 3,5 m)
  const mFoco = new MeshBasicMaterial({ color: '#fff7e8' }), gFoco = new PlaneGeometry(.5, 2.6); guarda(null, gFoco, mFoco);
  const mCharco = new MeshBasicMaterial({ map: glow, color: '#ffe9c4', transparent: true, opacity: .32, blending: AdditiveBlending, depthWrite: false });
  const gCharco = new PlaneGeometry(4.2, 4.2); guarda(null, gCharco, mCharco);
  const mHalo = new SpriteMaterial({ map: glow, color: '#fff4dc', transparent: true, opacity: .55, blending: AdditiveBlending, depthWrite: false }); guarda(null, null, mHalo);
  for (let z = -2; z > -LARGO + 1; z -= 3.5) {
    const f = new Mesh(gFoco, mFoco); f.rotation.x = Math.PI / 2; f.position.set(0, ALTO - .02, z); tunel.add(f);
    const c = new Mesh(gCharco, mCharco); c.rotation.x = -Math.PI / 2; c.position.set(0, .03, z); tunel.add(c);
    const h = new Sprite(mHalo); h.scale.set(2.6, 1.4, 1); h.position.set(0, ALTO - .3, z); tunel.add(h);
  }
  // franjas LED del color de la carta, a los dos lados
  const led = texLed(); led.wrapS = RepeatWrapping; led.repeat.set(6, 1);
  const mLed = new MeshBasicMaterial({ map: led, color: tinte, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const gLed = new PlaneGeometry(LARGO, .14); guarda(led, gLed, mLed);
  for (const lado of [-1, 1]) for (const y of [.9, ALTO - .5]) {
    const l = new Mesh(gLed, mLed); l.position.set(lado * (ANCHO / 2 - .02), y, -LARGO / 2); l.rotation.y = -lado * Math.PI / 2; tunel.add(l);
  }
  // la boca del pasillo: una luz blanca que se tiñe del color de la carta
  const mBoca = new MeshBasicMaterial({ color: '#ffffff' }), gBoca = new PlaneGeometry(ANCHO, ALTO); guarda(null, gBoca, mBoca);
  const boca = new Mesh(gBoca, mBoca); boca.position.set(0, ALTO / 2, -LARGO - .2); tunel.add(boca);
  const mBocaHalo = new SpriteMaterial({ map: glow, color: tinte.clone().lerp(new Color('#ffffff'), .5), transparent: true, opacity: .9, blending: AdditiveBlending, depthWrite: false });
  guarda(null, null, mBocaHalo);
  const bocaHalo = new Sprite(mBocaHalo); bocaHalo.scale.set(16, 12, 1); bocaHalo.position.set(0, ALTO / 2, -LARGO + .5); tunel.add(bocaHalo);

  const est = armaEstadio(scene, r, tinte, glow, guarda, o.color2), estadio = est.estadio;
  estadio.visible = false;

  /* ---------- la cámara ---------- */
  const tTunel = o.tunel ?? 2.8, z0 = o.desde ?? 0, SALIDA = 1.4;
  const ease = x => (x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  const mira = new Vector3();
  let ultimo = 0;

  function cuadro(t) {
    const dt = Math.min(.05, Math.max(0, t - ultimo)); ultimo = t;
    led.offset.x -= dt * 2.4;
    if (t < tTunel) {
      const k = ease(t / tTunel), z = z0 + (-LARGO + 1.5 - z0) * k;
      cam.position.set(Math.sin(t * 3.1) * .05, 1.65 + Math.sin(t * 6.2) * .035, z);
      mira.set(0, 1.7, z - 10);
      mBoca.color.set('#ffffff').lerp(tinte, .25);
      boca.visible = true; estadio.visible = false; tunel.visible = true;
      scene.fog.near = 14; scene.fog.far = 150;
    } else if (t < tTunel + SALIDA) {
      // sale a la cancha: avanza, sube y gira hacia el centro
      const k = ease((t - tTunel) / SALIDA);
      boca.visible = false; estadio.visible = true; tunel.visible = k < .35;
      scene.fog.near = 14 + k * 70; scene.fog.far = 150 + k * 170;
      cam.position.set(0, 1.65 + k * 3.6, -LARGO + 1.5 - k * 20);
      mira.set(0, 1.7 + k * 1.8, -LARGO - 10 - k * 30);
    } else {
      // de pie frente al centro, con una deriva lenta
      const s = t - tTunel - SALIDA;
      tunel.visible = false; estadio.visible = true;
      scene.fog.near = 84; scene.fog.far = 320;
      cam.position.set(Math.sin(s * .22) * 5, 5.25 + Math.sin(s * .5) * .25, -LARGO - 18.5 - s * .5);
      mira.set(CENTRO.x, 3.5, CENTRO.z);
    }
    cam.lookAt(mira);
    est.paso(t, dt);
    renderer.render(scene, cam);
  }
  function tamano(w, h) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < .8 ? 74 : 62; cam.updateProjectionMatrix(); }
  function fin() {
    tex.forEach(t => t.dispose()); geo.forEach(g => g.dispose()); mat.forEach(m => m.dispose());
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch {}
  }
  return { cuadro, tamano, fuegos: est.fuegos, fin };
}

/* El fondo de los sobres de fútbol: el mismo estadio, sin pasillo, con la
   cámara alta detrás de un arco girando despacio. Más oscuro y a menos
   resolución (va detrás de las cartas). `tinta(color)` y `fuegos(n)` para
   celebrar una épica o mejor. */
export function crearFondo(canvas, o = {}) {
  const r = azar(11);
  const tinte = new Color(o.color || '#5cc8ff');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  scene.background = new Color('#05060b');
  scene.fog = new Fog('#05060b', 84, 320);
  const cam = new PerspectiveCamera(58, 1, .5, 500);
  const tex = [], geo = [], mat = [];
  const guarda = (t, g, m) => { if (t) tex.push(t); if (g) geo.push(g); if (m) mat.push(m); };
  const glow = texGlow(); guarda(glow);
  const est = armaEstadio(scene, r, tinte, glow, guarda, '#ffffff');
  let ultimo = 0;
  function cuadro(t) {
    const dt = Math.min(.05, Math.max(0, t - ultimo)); ultimo = t;
    const a = Math.PI / 2 + Math.sin(t * .045) * .55;
    cam.position.set(CENTRO.x + Math.cos(a) * 44, 15 + Math.sin(t * .12) * 1.5, CENTRO.z + Math.sin(a) * 44);
    cam.lookAt(CENTRO.x, 2, CENTRO.z);
    est.paso(t, dt);
    renderer.render(scene, cam);
  }
  function tamano(w, h) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < .8 ? 72 : 58; cam.updateProjectionMatrix(); }
  function fin() {
    tex.forEach(x => x.dispose()); geo.forEach(g => g.dispose()); mat.forEach(m => m.dispose());
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch {}
  }
  return { cuadro, tamano, fuegos: est.fuegos, tinta: est.tinta, fin };
}
