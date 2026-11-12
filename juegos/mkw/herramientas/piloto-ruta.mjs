// El piloto automático que sigue la ruta de la pista, para las pruebas con el juego (bitácora §269b y §275).
//
// Resumen: copiado tal cual de herramientas/prueba-sala-telefono.mjs (§269b, donde nació: «pésima la conducción», el
// dueño) para que lo usen también las pruebas del modelo «host + predicción» (§275, el dueño: «deberías coreografiar las
// pruebas, con un camino para que no solo choque con la pared»). Tres piezas:
//   dedos(p)            los toques de verdad en la pestaña de un teléfono (Input.dispatchTouchEvent de DevTools)
//   PILOTO              lo que corre dentro de la página: dónde está mi kart y hacia dónde queda la ruta de las CPU
//   manejar(p, d, yo)   el bucle de afuera: cada 50 ms mueve el stick (dedo o teclas A/D), derrapa con R, frena en las
//                       curvas cerradas, retrocede si se traba y usa el objeto cada ~3 s. Devuelve la función para parar.
// Antes de llamar a manejar: el acelerador ya apretado (tecla K en el PC, el dedo 1 en el botón A en el teléfono).
const espera = ms => new Promise(r => setTimeout(r, ms));
// ---- los dedos en la pestaña del teléfono (Input.dispatchTouchEvent: toques de verdad, solo dentro de esa pestaña) ----
async function dedos(p) {
  const cdp = await p.context().newCDPSession(p);
  const puestos = new Map();
  const enviar = tipo => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: [...puestos].map(([id, q]) => ({ x: q.x, y: q.y, id, radiusX: 8, radiusY: 8 })) });
  const boton = pieza => p.evaluate(id => { const e = document.querySelector(`.mkw-tactil [data-pieza="${id}"]`); if (!e) return null;
    const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, pieza);
  const juego = () => p.evaluate(() => { const c = window.mkwControles; const q = c?.estado?.puertos?.[0]; const t = c?.tactilDedos?.();
    return { botones: q?.botones ?? null, dedos: t?.dedos ?? null, activo: c?.tactilActivo?.() ?? null }; }).catch(() => null);
  return {
    juego, boton,
    poner: async (id, q) => { puestos.set(id, q); await enviar('touchStart'); },
    mover: async (id, q) => { puestos.set(id, q); await enviar('touchMove'); },
    stick: () => p.evaluate(() => { const e = document.querySelector('.mkw-tactil [data-pieza="stick"]'); if (!e) return null;
      const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 } : null; }),
    levantar: async id => { puestos.delete(id); await enviar('touchEnd'); },
    soltarTodo: async () => { if (puestos.size) { puestos.clear(); await enviar('touchEnd').catch(() => {}); } },
  };
}
const A_BIT = 0x0100;

// ---- manejar como una persona (el dueño: «el lag aparece con las interacciones»; «pésima la conducción»): un piloto
// automático. En la pestaña, cada vez que se le pregunta, lee dónde está el kart de esta consola y la ruta de las CPU
// del course.kmp ya cargado, y dice hacia dónde mover el stick para ir al punto de la ruta que está ~1.800 unidades más
// adelante, y si derrapar (curva cerrada y rápido). Afuera, cada 50 ms, el dedo de verdad en el stick del teléfono (o las
// teclas en el PC) hace eso: dobla con el stick, derrapa con R en las curvas (y suelta para el turbo), usa el objeto con L
// cada ~3 s y hace un truco en los saltos de vez en cuando. Los choques con los otros karts salen solos.
// Las direcciones (PAL, leídas en la memoria del juego corriendo, §269b): CourseMap 0x809BD6E8 +0x18 = la ruta de las CPU
// (ENPT: +0 el arreglo, +4 la cuenta; cada punto → sus datos: x, y, z, ancho); el kart: Kart::Manager 0x809C18F8 +0x20
// → kart → Pointers (+0x1C) +0x24 → +0xA0 la posición x, y, z. El kart de esta consola es el que tiene mando
// (RaceinfoPlayer +0x48), como en vibracion-eventos.mjs. Devuelve una función para parar, que suelta todo. ----
const PILOTO = yo => {
  const L = window.mkwMenus, dv = new DataView(new ArrayBuffer(4));
  const f = a => { dv.setUint32(0, L.u32(a)); return dv.getFloat32(0); };
  const ram = a => (a >= 0x80000000 && a < 0x81800000) || (a >= 0x90000000 && a < 0x94000000);
  let idx = -1, rutaDe = 0, sig = null, pts = null, antes = null;
  const huellas = []; let guiaFijo = -1;
  // la ruta y quién sigue a quién: los grupos ENPH (+0x14: cada uno el primer punto, cuántos, de dónde viene y a dónde
  // va: 6 bytes cada lista, 255 = nada). En un desvío se sigue el primero.
  const armar = () => {
    const cm = L.u32(0x809BD6E8), acc = L.u32(cm + 0x18), arr = L.u32(acc), m = L.u16(acc + 4);
    const h = L.u32(cm + 0x14), harr = L.u32(h), hn = L.u16(h + 4);
    if (!ram(arr) || !m || !ram(harr)) return false;
    pts = []; for (let i = 0; i < m; i++) { const r = L.u32(L.u32(arr + 4 * i)); pts.push([f(r), f(r + 8)]); }
    const grupos = []; for (let g = 0; g < hn; g++) { const r = L.u32(L.u32(harr + 4 * g)); grupos.push({ ini: L.u8(r), n: L.u8(r + 1), sig: L.u8(r + 8) }); }
    sig = pts.map((_, i) => i + 1);
    for (const g of grupos) { const fin = g.ini + g.n - 1; if (fin < m) sig[fin] = g.sig < hn ? grupos[g.sig].ini : 0; }
    rutaDe = arr; return true;
  };
  window.__piloto = { idx: () => idx, leer() {
    const ri = L.u32(0x809BD730); if (!ram(ri) || L.u32(ri + 0x28) !== 2) return null;
    const acc = L.u32(L.u32(0x809BD6E8) + 0x18);
    if (!pts || L.u32(acc) !== rutaDe) { idx = -1; if (!armar()) return null; }
    const km = L.u32(0x809C18F8), kart = L.u32(L.u32(km + 0x20) + 4 * yo), b = L.u32(kart + 0x1C + 0x8);
    if (!ram(b)) return null;
    // KartBody: la matriz del kart (3 filas de 4 desde +0x1C): la última columna es dónde está, la tercera hacia dónde mira
    // KartBody: la matriz del kart (3 filas de 4 desde +0x1C): la última columna es dónde está. Hacia dónde va: lo que se
    // movió desde la última vez (parado, la dirección de la ruta)
    const x = f(b + 0x28), z = f(b + 0x48);
    const movido = antes ? Math.hypot(x - antes[0], z - antes[1]) : 0;
    let hx = movido > 20 ? x - antes[0] : 0, hz = movido > 20 ? z - antes[1] : 0;
    const m = pts.length, d2 = i => (pts[i][0] - x) ** 2 + (pts[i][1] - z) ** 2;
    // al principio (o perdido): el punto más cercano que apunte hacia donde va el kart (parado: el más cercano)
    const buscar = () => { let mejor = -1; for (let i = 0; i < m; i++) if ((mejor < 0 || d2(i) < d2(mejor)) && (!(movido > 20) || (pts[sig[i]][0] - pts[i][0]) * hx + (pts[sig[i]][1] - pts[i][1]) * hz > 0)) mejor = i; return mejor < 0 ? 0 : mejor; };
    if (idx < 0) idx = buscar();
    if (!(movido > 20)) { hx = pts[sig[idx]][0] - pts[idx][0]; hz = pts[sig[idx]][1] - pts[idx][1]; }
    // avanzar por la ruta mientras el punto siguiente quede más cerca (o el kart ya pasó el actual)
    for (let k = 0; k < 6; k++) { const n = sig[idx]; const pasado = (pts[n][0] - pts[idx][0]) * (x - pts[idx][0]) + (pts[n][1] - pts[idx][1]) * (z - pts[idx][1]) > 0; if (d2(n) < d2(idx) || pasado) idx = n; else break; }
    // si quedó lejos de la ruta (se cayó, lo rescataron): buscar otra vez, ahora mismo («lejos» = más que dos tramos de la
    // ruta: en las pistas grandes los puntos están separados)
    const tramo = Math.hypot(pts[sig[idx]][0] - pts[idx][0], pts[sig[idx]][1] - pts[idx][1]);
    if (Math.sqrt(d2(idx)) > Math.max(5000, 2 * tramo)) idx = buscar();
    // el objetivo: el primer punto a más de 1.800 de distancia hacia adelante
    let o = idx;
    for (let k = 0; k < 10; k++) { o = sig[o]; if (Math.hypot(pts[o][0] - x, pts[o][1] - z) > (window.__mira || 1300)) break; }
    let tx = pts[o][0] - x, tz = pts[o][1] - z, por = 'ruta';
    // mejor: la huella del kart que va justo adelante (por dónde pasó de verdad: las CPU no se meten contra los muros, y
    // en las pistas de varios pisos la altura cuenta). Cada llamada anota dónde está cada kart (hasta 600 lugares).
    const ri2 = L.u32(0x809BD730), lista = L.u32(ri2 + 0xC), n = Math.min(12, L.u8(km + 0x24)), y = f(b + 0x38);
    const av = i => f(L.u32(lista + 4 * i) + 0xC);
    for (let i = 0; i < n; i++) { const bi = L.u32(L.u32(L.u32(km + 0x20) + 4 * i) + 0x1C + 0x8); if (!ram(bi)) continue;
      const h = huellas[i] ||= []; const q = [f(bi + 0x28), f(bi + 0x38), f(bi + 0x48)], u = h[h.length - 1];
      if (!u || Math.hypot(q[0] - u[0], q[2] - u[2]) > 120 || Math.abs(q[1] - u[1]) > 300) { if (u && Math.hypot(q[0] - u[0], q[2] - u[2]) > 3000) h.length = 0; h.push(q); if (h.length > 600) h.shift(); } }
    // el guía: el que va justo adelante; se mantiene mientras siga adelante y a menos de un cuarto de vuelta
    const mio = av(yo);
    if (!(guiaFijo >= 0 && guiaFijo < n && av(guiaFijo) > mio && av(guiaFijo) - mio < 0.25)) {
      guiaFijo = -1; for (let i = 0; i < n; i++) if (i !== yo && av(i) > mio && (guiaFijo < 0 || av(i) < av(guiaFijo))) guiaFijo = i; }
    const guia = guiaFijo;
    const h = guia >= 0 ? huellas[guia] : null;
    if (window.__huella && h && h.length > 5) {   // (seguir la huella: probado, no mejoró; solo con window.__huella)
      let c = -1, dc = Infinity;
      for (let k = 0; k < h.length; k++) { const d = Math.hypot(h[k][0] - x, h[k][2] - z) + 2 * Math.abs(h[k][1] - y); if (d < dc) { dc = d; c = k; } }
      if (dc < 2500 && c < h.length - 2) {
        let k = c, recorrido = 0;
        while (k < h.length - 1 && recorrido < (window.__mira || 900)) { recorrido += Math.hypot(h[k + 1][0] - h[k][0], h[k + 1][2] - h[k][2]); k++; }
        tx = h[k][0] - x; tz = h[k][2] - z; por = 'huella ' + guia;
      }
    }
    const ang = Math.atan2(hx * tz - hz * tx, hx * tx + hz * tz);   // >0 = el objetivo queda a la derecha (medido: el eje x del juego va al revés)
    const rapidez = antes ? movido / Math.max(1, performance.now() - antes[2]) * 1000 : 0;
    if (!antes || movido > 20 || performance.now() - antes[2] > 400) antes = [x, z, performance.now()];
    const s = Math.max(-1, Math.min(1, ang / 0.5));
    return { s: +s.toFixed(2), ang: +(ang * 57.3).toFixed(0), derrape: Math.abs(ang) > 0.4 && rapidez > 1500, rapidez: Math.round(rapidez), idx, m, por };
  } };
};
function manejar(p, d, yo = 0) {
  let parar = false;
  const hecho = (async () => {
    await p.evaluate(PILOTO, yo);
    const leer = () => p.evaluate(() => window.__piloto.leer()).catch(() => null);
    let derrapando = false, soltando = false, ultObjeto = Date.now(), cuenta = { pasos: 0, derrapes: 0, objetos: 0, frenadas: 0, sinDato: 0 }, lado = 0;
    const st = d ? await d.stick() : null, qr = d ? await d.boton('R') : null, ql = d ? await d.boton('L') : null;
    if (d && !st) return { error: 'sin stick' };
    if (d) await d.poner(2, { x: st.x, y: st.y });
    let quietoDesde = 0;
    while (!parar) {
      const v = await leer();
      cuenta.pasos++;
      if (!v) { cuenta.sinDato++; await espera(50); continue; }
      // trabado contra algo más de 1,5 s: marcha atrás 1 s con el stick al revés (lo que hace una persona)
      if (v.rapidez < 300) { quietoDesde ||= Date.now(); } else quietoDesde = 0;
      if (quietoDesde && Date.now() - quietoDesde > 1500) {
        cuenta.atras = (cuenta.atras || 0) + 1; quietoDesde = 0;
        const qb = d ? await d.boton('B') : null;
        if (d) { if (derrapando) { await d.levantar(3); derrapando = false; } await d.levantar(1); if (qb) await d.poner(5, qb); await d.mover(2, { x: st.x - Math.sign(v.s || 1) * st.r * 0.85, y: st.y }); }
        else { await p.keyboard.up('KeyL'); derrapando = false; await p.keyboard.up('KeyK'); await p.keyboard.down('KeyJ'); }
        await espera(1000);
        if (d) { if (qb) await d.levantar(5); const qa = await d.boton('A'); if (qa) await d.poner(1, qa); }
        else { await p.keyboard.up('KeyJ'); await p.keyboard.down('KeyK'); }
        continue;
      }
      // el derrape: se empieza en una curva cerrada yendo rápido y se suelta al enderezar (así sale el turbo)
      const quiere = derrapando ? Math.abs(v.ang) > 8 : v.derrape;
      if (quiere !== derrapando) {
        derrapando = quiere; if (quiere) cuenta.derrapes++;
        if (d) { if (quiere && qr) await d.poner(3, qr); else if (!quiere) await d.levantar(3); }
        else if (quiere) await p.keyboard.down('KeyL'); else await p.keyboard.up('KeyL');
      }
      // una curva muy cerrada yendo rápido: soltar el acelerador hasta que el kart apunte (lo que hace una persona)
      const soltar = Math.abs(v.ang) > 50 && v.rapidez > 2500 || (soltando && Math.abs(v.ang) > 30);
      if (soltar !== soltando) {
        soltando = soltar; cuenta.frenadas += soltar ? 1 : 0;
        if (d) { const qa = await d.boton('A'); if (soltar) await d.levantar(1); else if (qa) await d.poner(1, qa); }
        else if (soltar) await p.keyboard.up('KeyK'); else await p.keyboard.down('KeyK');
      }
      if (d) await d.mover(2, { x: st.x + v.s * st.r * 0.85, y: st.y });
      else {   // el teclado es todo o nada: se aprieta el lado si hace falta doblar
        const quiereLado = v.s > 0.25 ? 1 : v.s < -0.25 ? -1 : 0;
        if (quiereLado !== lado) { if (lado) await p.keyboard.up(lado > 0 ? 'KeyD' : 'KeyA'); if (quiereLado) await p.keyboard.down(quiereLado > 0 ? 'KeyD' : 'KeyA'); lado = quiereLado; }
      }
      if (Date.now() - ultObjeto > 3000 && !derrapando) {
        ultObjeto = Date.now(); cuenta.objetos++;
        if (d && ql) { await d.poner(4, ql); await espera(80); await d.levantar(4); } else if (!d) { await p.keyboard.down('Space'); await espera(80); await p.keyboard.up('Space'); }
      }
      await espera(50);
    }
    if (d) { await d.levantar(3).catch(() => {}); await d.levantar(2).catch(() => {}); }
    else { for (const k of ['KeyL', 'KeyA', 'KeyD']) await p.keyboard.up(k).catch(() => {}); }
    return cuenta;
  })().catch(e => ({ error: e.message }));
  return async () => { parar = true; return hecho; };
}


export { dedos, A_BIT, PILOTO, manejar };
