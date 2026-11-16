// Libro mayor (pk-43, plan de logística L3): cada bodega guarda lo suyo.
//  - Bodegas del pueblo (Centro Urbano, Almacén, Granero: lo que tiene tope de almacén) llevan b.inv. S.res sigue
//    siendo el total del pueblo y es lo que paga todo; Lb.conciliar reparte las diferencias después de cada paso
//    (un gasto sale de la que más tiene; una entrada sin lugar va a la que tiene espacio más cerca del Centro Urbano;
//    lo que no cabe en ninguna queda en el Centro Urbano: los premios pasan del tope, regla de pk-34).
//  - Los campamentos (Maderero, Minero, y el Molino fuera de tu tierra) guardan aparte: b.inv que NO suma a S.res y
//    no sirve para pagar. Los vacía un carromato. El Molino en tu tierra es del pueblo (decisión 4): descarga directo.
//  - Lo que tiene un lugar toca el edificio y S.res juntos (descargar, cargar una carreta, un saqueo).
// Una partida de antes no necesita migración: la primera conciliación mete su S.res en sus bodegas.
(function () {
  'use strict';
  const PK = window.PK, D = PK.D, W = PK.World;
  const Lb = (PK.Libro = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;

  // ¿Recurso que ocupa lugar? (los tesoros especiales no: van sin edificio)
  Lb.fisico = r => !!(D.RES[r] && !D.RES[r].special);
  Lb.CAMPOS = { lumber: 1, mining: 1 };
  // ¿En una isla que no es la de casa? (el mar, pk-46: ahí todo lo que se junta va al Muelle de la colonia)
  const enColonia = b => !!(G().enMar && G().enMar() && PK.Arch && PK.Arch.islaDe(b.cx, b.cy) > 0);
  // Molino fuera de tu tierra: un campamento más (decisión 4). El Muelle de la colonia también guarda aparte (L6).
  // tipoCampo: por tipo y lugar (logística lo pregunta también de obras sin terminar); esCampo: además tuyo y hecho
  Lb.tipoCampo = b => !!(b && (Lb.CAMPOS[b.type] || b.type === 'colonia' || (b.type === 'mill' && (W.ownerAt(Math.floor(b.cx), Math.floor(b.cy)) !== 'p' || enColonia(b)))));
  Lb.esCampo = b => !!(b && b.owner === 'p' && b.done && Lb.tipoCampo(b));
  // Dónde queda lo que se descarga en un edificio: en el mar, un campamento o una Lonja de una colonia manda todo al
  // Muelle de esa isla (lo vacía la barcaza; los carromatos no cruzan el agua).
  Lb.almacenDe = function (b) {
    if (!b || b.type === 'colonia' || !enColonia(b)) return b;
    const i = PK.Arch.islaDe(b.cx, b.cy);
    return G().buildings.find(o => o.owner === 'p' && o.done && o.type === 'colonia' && PK.Arch.islaDe(o.cx, o.cy) === i) || b;
  };
  Lb.esBodega = b => !!(b && b.owner === 'p' && b.done && !b.remote && (G().capDe(b, 'food') > 0 || G().capDe(b, 'wood') > 0));
  Lb.bodegas = () => G().buildings.filter(Lb.esBodega);
  Lb.campos = () => G().buildings.filter(Lb.esCampo);
  const inv = b => b.inv || (b.inv = {});
  Lb.inv = inv;

  // ---------- Campamentos ----------
  Lb.capCampo = b => (b.type === 'colonia' && D.coloniaCap ? D.coloniaCap(b.lvl) : D.campoCap(b.lvl));
  Lb.totalCampo = b => { let n = 0; const o = inv(b); for (const r in o) n += o[r]; return n; };
  Lb.campoLleno = b => Lb.totalCampo(b) >= Lb.capCampo(b) - 0.5;
  Lb.ponerCampo = function (b, r, n) {
    const k = Math.max(0, Math.min(n, Lb.capCampo(b) - Lb.totalCampo(b)));
    if (k > 0) inv(b)[r] = (inv(b)[r] || 0) + k;
    return k;
  };
  Lb.sacarCampo = function (b, r, n) {
    const o = inv(b), k = Math.max(0, Math.min(n, o[r] || 0));
    o[r] = (o[r] || 0) - k;
    if (o[r] < 0.01) delete o[r];
    return k;
  };
  // Al demoler o mudar un campamento, lo que tenía va al pueblo entero (la carga nunca se pierde, pk-36).
  Lb.vaciarAlPueblo = function (b) {
    const o = b.inv, st = S();
    if (!o || Lb.esBodega(b)) return;
    for (const r in o) if (o[r] > 0) st.res[r] = (st.res[r] || 0) + o[r];
    b.inv = {};
  };

  // ---------- Bodegas del pueblo ----------
  Lb.lugar = (b, r) => Math.max(0, G().capDe(b, r) - (inv(b)[r] || 0));
  // Sacar de una bodega concreta (una carreta que carga ahí): baja el edificio y el total del pueblo.
  Lb.sacar = function (b, r, n) {
    const st = S();
    let k = Math.max(0, Math.min(n, st.res[r] || 0));
    if (!Lb.esBodega(b)) { st.res[r] -= k; return k; }
    const aqui = Math.min(k, inv(b)[r] || 0);
    inv(b)[r] = (inv(b)[r] || 0) - aqui;
    st.res[r] -= k; // si la bodega tenía menos, la conciliación saca el resto de las demás
    return k;
  };
  // Poner en una bodega concreta: hasta su lugar y el tope del pueblo. Devuelve cuánto entró.
  Lb.poner = function (b, r, n) {
    const st = S(), k = Math.max(0, Math.min(n, G().cap(r) - (st.res[r] || 0)));
    if (k <= 0) return 0;
    st.res[r] = (st.res[r] || 0) + k;
    if (Lb.esBodega(b)) inv(b)[r] = (inv(b)[r] || 0) + Math.min(k, Lb.lugar(b, r)); // lo que no cabe aquí, a otra
    return k;
  };

  // ---------- Conciliación ----------
  // S.res manda: lo que cambió sin lugar (pagar, premiar, mercado, consejo…) se reparte entre las bodegas.
  let orden = null, ordenK = '';
  function bodegasOrden() {
    const g = G(), k = g.blockVer + ':' + g.buildings.length;
    if (orden && ordenK === k) return orden;
    const bs = Lb.bodegas(), tc = bs.find(b => b.type === 'tc') || bs[0];
    orden = tc ? bs.sort((a, b) => (a === tc ? -1 : b === tc ? 1 : Math.hypot(a.cx - tc.cx, a.cy - tc.cy) - Math.hypot(b.cx - tc.cx, b.cy - tc.cy))) : [];
    ordenK = k;
    return orden;
  }
  Lb.conciliar = function () {
    const st = S(), g = G();
    if (!st || !st.res) return;
    const bs = bodegasOrden();
    if (!bs.length) return;
    for (const r in st.res) {
      if (!Lb.fisico(r)) continue;
      let suma = 0;
      for (const b of bs) suma += inv(b)[r] || 0;
      let d = (st.res[r] || 0) - suma;
      if (Math.abs(d) < 1e-6) continue;
      if (d < 0) { // salió: de la que más tiene
        for (let guard = 0; d < -1e-6 && guard < 50; guard++) {
          let mx = null;
          for (const b of bs) if ((inv(b)[r] || 0) > 1e-9 && (!mx || inv(b)[r] > inv(mx)[r])) mx = b;
          if (!mx) break;
          const k = Math.min(-d, inv(mx)[r]);
          inv(mx)[r] -= k; d += k;
          if (inv(mx)[r] < 1e-9) delete inv(mx)[r];
        }
      } else { // entró: donde haya lugar, del Centro Urbano hacia afuera; lo que sobra, al Centro Urbano
        for (const b of bs) {
          if (d <= 1e-9) break;
          const k = Math.min(d, Math.max(0, g.capDe(b, r) - (inv(b)[r] || 0)));
          if (k > 0) { inv(b)[r] = (inv(b)[r] || 0) + k; d -= k; }
        }
        if (d > 1e-9) inv(bs[0])[r] = (inv(bs[0])[r] || 0) + d;
      }
    }
    // lo que una bodega guarda de un recurso que ya no está en S.res (borrado del todo)
    for (const b of bs) for (const r in inv(b)) if (!(r in st.res)) delete inv(b)[r];
  };
  // Lo que hay fuera del pueblo: en los campamentos y arriba de las carretas y carromatos. Va en la foto al servidor:
  // si solo contara el pueblo, descargar un carromato parecería un salto y el servidor lo recortaría como trampa.
  Lb.fuera = function (r) {
    let n = 0;
    for (const b of Lb.campos()) n += (b.inv && b.inv[r]) || 0;
    for (const u of G().units) if (u.owner === 'p' && (u.kind === 'cart' || u.kind === 'carromato' || u.kind === 'barcaza') && u.carryRes === r) n += u.carry || 0;
    return n;
  };
})();
