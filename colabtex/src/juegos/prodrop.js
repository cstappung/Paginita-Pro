/* PRODROP — el cartero entre el abridor (un iframe en juegos/prodrop/) y
   la cuenta. Como Circuit Breakers o Clue, el documento del juego conserva
   su CSS, su audio y sus animaciones, y no sabe nada de Firebase: este
   módulo le manda la cuenta y el mercado cada vez que cambian, y hace por
   él las escrituras que puede pedir.

   Lo que se le manda sale de la **economía** (juegos/monedas.js), no de
   lo escrito: las cartas que tienes *ahora* (incluidas las compradas o
   recibidas), las ofertas que de verdad están a la venta y los
   intercambios que te tocan. Y antes de cada escritura se vuelve a
   comprobar contra esa misma economía —el iframe podría estar mirando
   algo viejo—, porque las reglas no pueden saber si alcanza el dinero ni
   de quién es una carta: sin esta comprobación, un gasto sin fondos de
   este mismo navegador pararía la cuenta.

   La Serie 01 (Profes) solo le llega a quien está en la lista del admin
   (`veSerie1`, prodrop-cartas.js): para el resto el abridor no recibe sus
   cartas, ni sus sobres, ni la opción de comprarlos. No se le quita nada:
   la economía sigue contándolas como suyas. */
import { ambientar } from "./sonido.js";
import { monedasDe, economia, copiasDe, proximoGratis, leeCopia, claveCopia, esCarta } from "./monedas.js";
import { MOTOR, MAX_EXHIBIDAS, veSerie1, colVisible, copiaVisible } from "./prodrop-cartas.js";
import { pendientesDe, puedeComprar } from "./mercado-datos.js";
import PR from "../../../juegos/prodrop/retos.js";

const MAX_PRECIO = 100000;

export function crearProdrop({ usuario, datos, perfil, quien, fb, volver, ir, abrir = "" }) {
  let host = null, frame = null, off = null, d = null, muerto = false, listo = false, ocupado = Promise.resolve();
  const uid = usuario.uid;

  function manda(x) { if (!muerto && frame && frame.contentWindow) frame.contentWindow.postMessage({ canal: "prodrop-parent", ...x }, location.origin); }
  const eco = () => economia(d);
  const cuenta = () => monedasDe(uid, d);
  // todas las que tiene puestas, también las de una serie que no ve
  function exhibidasTodas() {
    const l = (perfil(uid) || {}).cartas;
    return (Array.isArray(l) ? l : l && typeof l === "object" ? Object.values(l) : [])
      .filter(k => typeof k === "string").map(k => (k.includes("~") ? k : uid + "~" + k)).slice(0, MAX_EXHIBIDAS);
  }
  /* Las que el abridor ve como exhibidas: visibles y todavía suyas. Una
     vendida o usada en un re-roll seguía en la lista guardada, no salía en
     el perfil pero ocupaba cupo, y «Exhibir» quedaba apagado sin razón a la
     vista. Al guardar la próxima vez, esas se van. */
  const exhibidas = () => exhibidasTodas().filter(c => copiaVisible(c) && eco().dueno[c] === uid);
  /* Una copia lista para el iframe: con la hora de su sobre, que es lo que
     hace falta para rehacerla. */
  function copia(e, c) {
    const q = leeCopia(c), so = q && q.tipo === "carta" && e.sobres[q.o + "~" + q.k];
    if (!so || (so.r && q.i !== 0) || !copiaVisible(c)) return null;
    // la de un re-roll no se rehace con un sobre: va con su carta, en `rr`
    // (no en `id`, que en el mercado es el de la oferta)
    return Object.assign({ c, o: q.o, k: q.k, i: q.i, at: so.at, gr: !!e.graduada[c] }, so.r ? { rr: { id: so.r.id, g: so.r.g, w: so.r.w } } : {});
  }
  // lo que es una copia para los desafíos: {id, g, gr}, de su sobre o de su re-roll
  const fichaDe = (e, c) => { const y = copia(e, c); if (!y) return null; const f = y.rr || MOTOR.sobre(y.o, y.k, y.at).cartas[y.i]; return { id: f.id, g: f.g, gr: y.gr }; };
  /* Los desafíos de plantilla: lo que cada cuenta subió a cada plantilla
     (los clubes y los retos de esta semana y la anterior), con las copias
     que sigue teniendo (una que ya no es suya va vacía y la plantilla deja
     de valer), y los premios que ya cobré. */
  function retos(e, persona) {
    const s = (d.plantillas && d.plantillas.s) || {}, semana = PR.semanaDe(fb.ahora()), subidas = {};
    for (const [clave, porUid] of Object.entries(s)) {
      const p = PR.plantilla(clave);
      if (!p || (p.tipo === "reto" && p.semana < semana - 1)) continue;
      const filas = [];
      for (const [u, x] of Object.entries(porUid || {})) {
        if (!x || !Number.isFinite(x.at) || (u !== uid && e.usuarios[u] && e.usuarios[u].parada)) continue;
        const cs = MOTOR.FORMACION.map((_, i) => { const c = x.c && x.c[i]; return typeof c === "string" && e.dueno[c] === u ? copia(e, c) : null; });
        filas.push({ u: persona(u), at: x.at, c: cs });
      }
      subidas[clave] = filas;
    }
    const mios = (d.plantillas && d.plantillas.p && d.plantillas.p[uid]) || {};
    const podiosMios = (d.plantillas && d.plantillas.q && d.plantillas.q[uid]) || {};
    /* El podio de la semana que cerró (semana − 1): clubes y reto, con
       quién quedó 1.º, 2.º y 3.º, y los sobres del reto que me tocan. */
    const pasada = semana - 1, pod = (e.podiosSemana || {})[pasada] || {}, podio = {};
    for (const [clave, us] of Object.entries(pod)) podio[clave] = us.map(persona);
    const yo = ((e.usuarios[uid] || {}).podiosReto) || {}, reto = PR.claveReto(pasada);
    const miPodio = yo[reto] ? { clave: reto, n: yo[reto], cobrado: !!podiosMios[PR.clavePodio(reto, yo[reto])] } : null;
    // los álbumes completos ya cobrados (por club)
    const albumes = {};
    for (const [id, x] of Object.entries((d.plantillas && d.plantillas.a && d.plantillas.a[uid]) || {})) { const club = PR.leeAlbum(id); if (club && x) albumes[club] = x.at || 0; }
    // lo que ganó en los desafíos (premios, podios, álbumes), del más nuevo al más viejo
    const historial = (((e.usuarios[uid] || {}).movs) || []).filter(m => m.c === "plantilla").slice(-150).reverse();
    return { subidas, cobrados: Object.keys(mios), semana, podio: { semana: pasada, tablas: podio, mio: miPodio }, albumes, historial };
  }
  function enviaDatos() {
    if (!listo || !d || !d.completo) return;
    const e = eco(), m = cuenta(), gente = {};
    const persona = u => { if (!gente[u]) { const q = quien(u); gente[u] = { n: q.nombre, f: q.foto || "", c: q.color }; } return u; };
    const parada = u => !!(e.usuarios[u] && e.usuarios[u].parada);
    /* Solo las ofertas de cartas que están a la venta: el abridor las usa
       para decir «En el mercado por…» y para orientar el precio al vender.
       Comprar e intercambiar se hace en la pestaña 🏪 Mercado. */
    const ofertas = [];
    for (const o of Object.values(e.ofertas)) {
      if (o.estado !== "activa" || (o.u !== uid && parada(o.u))) continue;
      const x = copia(e, o.c);
      if (x) ofertas.push(Object.assign(x, { id: o.id, u: persona(o.u), p: o.p, t: o.at, estado: o.estado, fin: 0, comprador: "" }));
    }
    const mio = e.usuarios[uid], sobres = {};
    for (const [k, at] of Object.entries((mio && mio.sobres) || {})) if (colVisible(MOTOR.coleccionDe(k))) sobres[k] = at;
    manda({ tipo: "datos", uid, saldo: m.saldo, parada: m.parada, falta: m.falta, serie1: veSerie1(),
      mias: copiasDe(uid, d).filter(x => copiaVisible(x.c)).map(x => Object.assign({ c: x.c, o: x.o, k: x.k, i: x.i, at: x.at, gr: x.gr, venta: x.venta },
        x.id != null ? { rr: { id: x.id, g: x.g, w: x.w } } : {})),
      sobres, gratis: proximoGratis(uid, d, fb.ahora()),
      ofertas, pendientes: pendientesDe(d, uid), gente,
      exh: exhibidas(), retos: retos(e, persona), desfase: fb.ahora() - Date.now() });
  }

  const falta = p => { const s = cuenta().saldo; return s >= p ? 0 : p - s; };
  function pagable(p, que) {
    const m = cuenta();
    if (m.parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes gastar.");
    if (falta(p)) throw new Error(`${que} cuesta ${p}: te faltan ${falta(p)} monedas.`);
  }
  // una carta suya que ve (las de una serie oculta no se tocan desde aquí)
  const mia = c => economia(d).dueno[c] === uid && copiaVisible(c);
  /* El prefijo de la colección que pide el abridor. Uno viejo (de antes de
     las colecciones, en caché) no la manda: su sobre va sin prefijo y sale
     del catálogo que ese abridor conoce. */
  const prefijo = col => (MOTOR.SOBRE[col] ? MOTOR.SOBRE[col].prefijo : "");
  /* Un sobre sin prefijo es de los profes (`coleccionDe`): un abridor viejo
     en caché tampoco compra la Serie 01 si no la ve. Uno que pide un sobre
     que ya no existe (la Premier o el Clásico de antes) no compra nada. */
  const sobreVisible = col => (col == null || !!MOTOR.SOBRE[col]) && colVisible(MOTOR.coleccionDe(prefijo(col)));
  // lo que cuesta ese sobre (el Plus de fútbol, el doble) y si trae el gratis (solo los de precio normal)
  const multDe = col => (MOTOR.SOBRE[col] ? MOTOR.SOBRE[col].mult : 1);
  const SIN_SOBRE = "Ese sobre no está disponible.";

  /* Una petición a la vez: dos compras seguidas con el saldo justo para
     una no deben pasar las dos el control. */
  function atiende(x) {
    const responde = (ok, dato, error) => manda({ tipo: "resp", id: x.id, ok, dato, error });
    ocupado = ocupado.then(async () => {
      try {
        if (!d || !d.completo) throw new Error("Todavía se está cargando tu cuenta.");
        const e = eco();
        if (x.accion === "comprar") {
          const p = MOTOR.precioSobre(fb.ahora(), multDe(x.col));
          if (!sobreVisible(x.col)) throw new Error(SIN_SOBRE);
          pagable(p, "Un sobre");
          const r = await fb.comprarSobre(uid, p, prefijo(x.col));
          if (!(economia(d).sobres[uid + "~" + r.k])) throw new Error("Otra pestaña gastó tus monedas a la vez: este sobre no vale hasta que ganes las que faltan.");
          responde(true, r);
        } else if (x.accion === "gratis") {
          if (!sobreVisible(x.col)) throw new Error(SIN_SOBRE);
          if (multDe(x.col) > 1) throw new Error("El sobre gratis es solo para el sobre normal.");
          if (proximoGratis(uid, d, fb.ahora())) throw new Error("Tu sobre gratis todavía no está listo.");
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no se abren sobres.");
          const r = await fb.sobreGratis(uid, prefijo(x.col));
          responde(true, r);
        } else if (x.accion === "graduar") {
          const q = leeCopia(x.c);
          if (!esCarta(x.c) || !mia(x.c)) throw new Error("Esa carta no está en tu colección.");
          if (e.graduada[x.c]) throw new Error("Esa carta ya está graduada.");
          if (e.enVenta[x.c]) throw new Error("Retírala del mercado antes de graduarla.");
          pagable(MOTOR.PRECIO.gradua, "Graduar");
          await fb.graduarCarta(uid, q.o, q.k, q.i);
          responde(true, null);
        } else if (x.accion === "reroll") {
          /* Diez de una misma rareza por una de la siguiente. Se comprueba
             aquí lo mismo que la economía comprobará al rehacerlo (que el
             iframe puede estar mirando algo viejo), y la carta que sale se
             lee de la economía cuando llega lo escrito. */
          const cs = [...new Set((Array.isArray(x.c) ? x.c : []).map(String))];
          if (cs.length !== MOTOR.REROLL.n) throw new Error(`Elige ${MOTOR.REROLL.n} cartas distintas.`);
          if (!cs.every(c => esCarta(c) && mia(c))) throw new Error("Alguna de esas cartas ya no es tuya.");
          if (cs.some(c => e.enVenta[c])) throw new Error("Retira del mercado las cartas que quieras usar.");
          const fichas = cs.map(c => { const y = copia(e, c); return y && (y.rr ? y.rr : MOTOR.sobre(y.o, y.k, y.at).cartas[y.i]); });
          if (fichas.some(f => !f)) throw new Error("Alguna de esas cartas ya no existe.");
          const tier = MOTOR.CARDS[fichas[0].id].tier;
          if (tier >= 3) throw new Error("Las legendarias no se pueden cambiar: no hay nada por encima.");
          if (fichas.some(f => MOTOR.CARDS[f.id].tier !== tier)) throw new Error("Las diez tienen que ser de la misma rareza.");
          const col = MOTOR.CARDS[fichas[0].id].col;
          if (fichas.some(f => MOTOR.CARDS[f.id].col !== col)) throw new Error("Las diez tienen que ser de la misma colección.");
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no se puede.");
          const r = await fb.rerollCartas(uid, cs, MOTOR.COL[col].prefijo);
          const nueva = claveCopia(uid, r.k, 0);
          let so = null;
          for (let i = 0; i < 30 && !(so = economia(d).sobres[uid + "~" + r.k]); i++) {
            const escrito = d && d.cartas && d.cartas.r && d.cartas.r[uid] && d.cartas.r[uid][r.k];
            if (escrito && escrito.at === r.at) break;   // ya llegó y la economía no lo aceptó
            await new Promise(ok => setTimeout(ok, 100));
          }
          if (!so || !so.r) throw new Error("El re-roll no valió: alguna carta cambió de manos a la vez.");
          responde(true, { k: r.k, at: r.at, c: nueva, id: so.r.id, g: so.r.g, w: so.r.w, tier: MOTOR.CARDS[so.r.id].tier });
        } else if (x.accion === "exhibir") {
          const lista = (Array.isArray(x.lista) ? x.lista : []).map(String).filter(c => esCarta(c) && mia(c));
          /* Las que tenía puestas de una serie que ya no ve se quedan, si
             caben: el abridor no las conoce y no debe borrarlas. */
          const ocultas = exhibidasTodas().filter(c => !copiaVisible(c) && economia(d).dueno[c] === uid);
          await fb.exhibirCartas(uid, [...new Set([...lista, ...ocultas])].slice(0, MAX_EXHIBIDAS));
          responde(true, null);
        } else if (x.accion === "subeReto" || x.accion === "cobraReto") {
          /* Un desafío de plantilla: se comprueba aquí lo mismo que la
             economía comprobará (que las once sean tuyas y la plantilla
             valga), porque un premio mal reclamado gasta su única vez. */
          const p = PR.plantilla(x.clave);
          if (!p) throw new Error("Esa plantilla no existe.");
          if (!PR.vigente(p, fb.ahora())) throw new Error("Ese reto semanal ya terminó.");
          const lista = Array.isArray(x.lista) ? x.lista.slice(0, 11).map(String) : [];
          if (lista.length !== 11 || new Set(lista).size !== 11 || !lista.every(c => esCarta(c) && mia(c))) throw new Error("Completa las once casillas con cartas tuyas.");
          const fs = lista.map(c => fichaDe(e, c));
          if (fs.some(f => !f)) throw new Error("Alguna de esas cartas ya no existe.");
          const ev = PR.evalua(x.clave, fs);
          if (!ev.valida) throw new Error((ev.checks.find(c => !c.ok) || {}).txt || "La plantilla no cumple.");
          if (x.accion === "subeReto") {
            const r = await fb.subirPlantillaReto(uid, x.clave, lista);
            responde(true, { at: r && r.at, puntaje: ev.puntaje });
          } else {
            const n = Math.round(+x.n), pr = PR.PREMIOS[n - 1];
            if (!pr) throw new Error("Ese premio no existe.");
            const id = PR.claveReclamo(x.clave, n);
            if (((d.plantillas && d.plantillas.p && d.plantillas.p[uid]) || {})[id]) throw new Error("Ese premio ya lo cobraste.");
            if (!PR.premioOk(n, ev)) throw new Error(`Para este premio: ${pr.txt.toLowerCase()}.`);
            const r = await fb.cobrarPlantilla(uid, id, lista, pr.sobres.map(t => MOTOR.SOBRE[t].prefijo));
            responde(true, { ks: r.ks, at: r.at, n, monedas: pr.monedas, sobres: PR.textoSobres(pr) });
          }
        } else if (x.accion === "cobraPodio") {
          /* Los sobres de mi podio en el reto de la semana pasada: la
             economía ya dijo en qué puesto quedé; aquí solo se escriben. */
          const r = PR.leePodio(PR.clavePodio(String(x.clave || ""), Math.round(+x.n))), pr = r && PR.PODIO_RETO[r.n - 1];
          const yo = ((e.usuarios[uid] || {}).podiosReto) || {};
          if (!pr || yo[r.clave] !== r.n) throw new Error("Ese podio no es tuyo.");
          const id = PR.clavePodio(r.clave, r.n);
          if (((d.plantillas && d.plantillas.q && d.plantillas.q[uid]) || {})[id]) throw new Error("Esos sobres ya los cobraste.");
          const w = await fb.cobrarPodio(uid, id, pr.sobres.map(t => MOTOR.SOBRE[t].prefijo));
          responde(true, { ks: w.ks, at: w.at, n: r.n, sobres: PR.textoSobresPodio(pr) });
        } else if (x.accion === "cobraAlbum") {
          /* El álbum completo de un club: se elige aquí una copia tuya de
             cada carta (la que no está a la venta, si hay) y se escribe con su sobre. */
          const club = PR.leeAlbum(PR.claveAlbum(String(x.club || "")));
          if (!club) throw new Error("Ese club no tiene álbum.");
          const id = PR.claveAlbum(club);
          if (((d.plantillas && d.plantillas.a && d.plantillas.a[uid]) || {})[id]) throw new Error("Ese álbum ya lo cobraste.");
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no se puede.");
          // una copia por jugador (la especial vale por la normal), mejor una que no esté a la venta
          const porCarta = {};
          for (const y of copiasDe(uid, d)) {
            const f = fichaDe(e, y.c), h = f && PR.huecoAlbum(club, f.id);
            if (!h) continue;
            if (!porCarta[h.n] || (porCarta[h.n].venta && !y.venta)) porCarta[h.n] = y;
          }
          const faltan = PR.cartasAlbum(club).filter(cd => !porCarta[cd.n]);
          if (faltan.length) throw new Error(`Te faltan ${faltan.length} cartas del ${MOTOR.CLUBES[club]}.`);
          const c = PR.cartasAlbum(club).map(cd => porCarta[cd.n].c);
          const w = await fb.cobrarAlbum(uid, id, c, PR.ALBUM.sobres.map(t => MOTOR.SOBRE[t].prefijo));
          responde(true, { ks: w.ks, at: w.at, monedas: PR.ALBUM.monedas, sobres: PR.textoSobres(PR.ALBUM) });
        } else if (x.accion === "vender") {
          const p = Math.round(+x.p);
          if (!esCarta(x.c) || !mia(x.c)) throw new Error("Esa carta no está en tu colección.");
          if (e.enVenta[x.c]) throw new Error("Esa carta ya está a la venta.");
          if (!(p >= 1 && p <= MAX_PRECIO)) throw new Error(`El precio va de 1 a ${MAX_PRECIO.toLocaleString("es-CL")} monedas.`);
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: no puedes vender hasta ponerte al día.");
          const id = await fb.publicarOferta(uid, x.c, p);
          /* La oferta tiene que quedar válida en el recuento; si no (otra
             pestaña la publicó a la vez, o la carta cambió de manos), se
             retira en el acto para que no quede una oferta fantasma. */
          const fin = economia(d).ofertas[id];
          if (fin && fin.estado !== "activa") {
            await fb.retirarOferta(id).catch(() => {});
            throw new Error("Esa carta ya está a la venta o dejó de ser tuya.");
          }
          responde(true, id);
        } else if (x.accion === "compraOferta") {
          /* Comprar una carta del mercado sin salir de los desafíos de
             plantilla: lo mismo que hace la pestaña 🏪 Mercado. */
          const motivo = puedeComprar(d, uid, x.oferta);
          if (motivo) throw new Error(motivo);
          await fb.comprarOferta(uid, x.oferta);
          const fin = economia(d).ofertas[x.oferta];
          if (!fin || fin.estado !== "vendida" || fin.comprador !== uid) throw new Error("Alguien se te adelantó: eso ya no está a la venta.");
          responde(true, null);
        } else if (x.accion === "retirar") {
          // `oferta`: `id` es el del mensaje, y pisarlo dejaba la respuesta sin destino
          const o = e.ofertas[x.oferta];
          if (!o || o.u !== uid || o.estado !== "activa") throw new Error("Esa oferta ya no está a la venta.");
          await fb.retirarOferta(x.oferta);
          responde(true, null);
        } else throw new Error("Petición desconocida.");
      } catch (e) {
        const permiso = /permission|denied/i.test((e && (e.code || e.message)) || "");
        responde(false, null, permiso
          ? "La base todavía no acepta esto: falta publicar las reglas nuevas en la consola de Firebase."
          : (e && e.message) || "No se pudo.");
      }
    });
  }

  function mensaje(e) {
    if (muerto || !frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const x = e.data;
    if (!x || x.canal !== "prodrop-child") return;
    if (x.tipo === "listo") { listo = true; enviaDatos(); return; }
    if (x.tipo === "volver") { volver(); return; }
    // desde los desafíos de plantilla, el mercado abre filtrado a Fútbol
    if (x.tipo === "mercado") { ir(x.col === "futbol" ? "#mercado/futbol" : "#mercado/prodrop"); return; }
    if (x.tipo === "pide") atiende(x);
  }

  return {
    montar(el) {
      host = el; ambientar(null); host.innerHTML = "";
      frame = document.createElement("iframe");
      frame.className = "jg-prodrop-frame";
      frame.title = "PRODROP — sobres y mercado de cartas";
      frame.allow = "fullscreen";
      window.addEventListener("message", mensaje);
      // `abrir`: lo que se abre al llegar (`#cartas/retos` → los desafíos de plantilla)
      frame.src = "juegos/prodrop/index.html?v=pd-74" + (abrir ? "&abre=" + encodeURIComponent(abrir) : "");
      host.appendChild(frame);
      frame.addEventListener("load", () => frame.focus());
      off = datos(x => { d = x; enviaDatos(); });
    },
    // los perfiles (nombres, exhibidas) llegan por otra escucha
    refresca: enviaDatos,
    destruir() {
      muerto = true; if (off) off(); off = null;
      window.removeEventListener("message", mensaje);
      if (frame) frame.remove(); frame = null;
      if (host) host.innerHTML = ""; host = null;
      ambientar("");
    }
  };
}
