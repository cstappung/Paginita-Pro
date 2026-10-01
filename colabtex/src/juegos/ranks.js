/* Ranks — la clasificación de cada juego.
 *
 * Cada uno escribe solo su propia fila (`ranks/<juego>/<uid>`, y las
 * reglas no dejan tocar la de nadie más), así que la tabla es la suma de
 * lo que cada navegador ha ido apuntando de sí mismo. Eso tiene un precio
 * que conviene decir en voz alta y que la propia página dice: quien cierra
 * la pestaña antes de que la partida termine no se apunta esa partida. La
 * alternativa —un servidor que arbitre— es exactamente lo que este sitio
 * no tiene, y falsear la fila del rival sigue sin poderse, que es lo que
 * de verdad importa.
 *
 * Se ordena por puntos y no por victorias porque con victorias a secas
 * gana quien más juega; con 3/1/0 gana quien mejor juega. Y se enseña
 * también el porcentaje, que es lo que de verdad se compara cuando uno
 * lleva 200 partidas y otro 6.
 *
 * Encima de la tabla va el podio, y no es adorno: una tabla dice quién va
 * primero, pero no da ganas de ser el primero. El podio pone al #1 más alto
 * que nadie, con corona y la peana de oro, y deja a la vista los puestos
 * libres («¿tú?»), que es la invitación más directa que hay. Debajo, la
 * tarjeta de «tu posición» convierte la distancia en algo que se puede
 * hacer: no «vas quinto», sino «dos victorias y entras al podio».
 */
import { JUEGOS, ordenaRanks, porcentaje } from "./motor.js";
import { mezcla } from "./perfil.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Los tres metales, en el orden del puesto. */
const METAL = ["oro", "plata", "bronce"];
const TITULO = ["Campeón", "Subcampeón", "Tercer puesto"];
const EXTRA = { minas: { nombre: "Mina Club", color: "#eeb765" }, snake: { nombre: "Snake Club", color: "#4be9bc" }, tetrisclub: { nombre: "Tetris Club", color: "#b04ee8" }, sortem: { nombre: "sortEm", color: "#ff006e" }, bbtan: { nombre: "BBTAN", color: "#c4f568" }, sopa: { nombre: "Sopa de letras", color: "#5b8cff" } };

/* Las categorías de los juegos individuales, como botones y no como un
   desplegable: son pocas, se leen de un vistazo y cambiar de una a otra
   es un toque. Solo las que existen hoy — las del archivo viejo eran de
   juegos que ya no están. Snake tiene dos filas (modo y mapa) porque su
   récord es de la pareja; Zen no puntúa y no sale. */
const SOLO = {
  minas: { filas: [{ k: "n", t: "Dificultad", ops: [["easy", "Fácil"], ["medium", "Medio"], ["hard", "Difícil"]] }],
    cat: s => `club-minas-${s.n}` },
  tetrisclub: { filas: [{ k: "n", t: "Modo", ops: [["maraton", "Maratón"], ["sprint", "Sprint 40"], ["ultra", "Ultra 2 min"]] }],
    cat: s => `club-tetris-${s.n}` },
  sortem: { filas: [{ k: "n", t: "Números", ops: [["10", "Del 1 al 10"], ["20", "Del 1 al 20"]] }],
    cat: s => `club-sortem-${s.n}` },
  bbtan: { filas: [{ k: "n", t: "Récord", ops: [["rondas", "Ronda máxima"]] }],
    cat: s => `club-bbtan-${s.n}` },
  /* La racha diaria es una tabla sola; las libres van por dificultad y
     tamaño, y con «Racha diaria» elegida el tamaño no cuenta. */
  sopa: { filas: [
      { k: "m", t: "Tabla", ops: [["racha", "Racha diaria"], ["facil", "Libre · Fácil"], ["medio", "Libre · Medio"], ["dificil", "Libre · Difícil"]] },
      { k: "t", t: "Tamaño", ops: [["8", "8×8"], ["12", "12×12"], ["15", "15×15"]], si: e => e.m !== "racha" }],
    cat: s => s.m === "racha" ? "club-sopa-racha" : `club-sopa-${s.m}-${s.t}`, def: { t: "12" } },
  snake: { filas: [
      { k: "m", t: "Modo", ops: [["classic", "Clásico"], ["arcade", "Arcade"], ["portals", "Portales"], ["reloj", "Contrarreloj"], ["espejo", "Espejo"], ["laberinto", "Laberinto"]] },
      { k: "t", t: "Mapa", ops: [["chico", "Chico"], ["mediano", "Mediano"], ["grande", "Grande"], ["gigante", "Gigante"]] }],
    cat: s => `club-snake-${s.m}-${s.t}`, def: { t: "grande" } }
};
const esSolo = k => !!SOLO[k];

/* La corona es SVG dibujado, no un emoji: cada sistema pinta 👑 a su
   tamaño y su color, y aquí tiene que brillar en el oro del podio. */
const CORONA = `<svg class="jg-rk-corona" viewBox="0 0 64 44" aria-hidden="true">
  <defs><linearGradient id="rkOro" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff6c4"/><stop offset=".45" stop-color="#f4c542"/><stop offset="1" stop-color="#a86f10"/></linearGradient></defs>
  <path d="M4 14 L18 26 L32 4 L46 26 L60 14 L54 40 H10 Z" fill="url(#rkOro)" stroke="#7a4f08" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="4" cy="14" r="3.6" fill="#fff0a0" stroke="#7a4f08" stroke-width="1.5"/>
  <circle cx="32" cy="4" r="3.6" fill="#fff0a0" stroke="#7a4f08" stroke-width="1.5"/>
  <circle cx="60" cy="14" r="3.6" fill="#fff0a0" stroke="#7a4f08" stroke-width="1.5"/>
  <circle cx="32" cy="30" r="4.4" fill="#e0245e" stroke="#7a1030" stroke-width="1.2"/>
  <circle cx="18" cy="32" r="2.8" fill="#2f7cf6"/><circle cx="46" cy="32" r="2.8" fill="#2f7cf6"/>
</svg>`;

/* Cuántas victorias son `n` puntos: cada una vale 3. */
const victorias = n => Math.max(1, Math.ceil(n / 3));
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function crearRanks(ctx) {
  const { uid, watchRanks } = ctx;
  /* La fila de la clasificación guarda el nombre y la foto del día
     en que se apuntó la partida — y su `foto` no puede pasar de 400
     caracteres, así que una foto subida no cabe ahí de ninguna
     manera. El perfil vivo se pone encima al pintar; sin resolutor
     se pinta la fila tal cual, que es lo que había. */
  const perfil = ctx.perfil || (() => null);

  let host = null, muerto = false;
  /* Se abre en lo último que se miró —o en lo que pidió el vestíbulo al
     tocar el podio de su tarjeta—, y si no, en la general: la pregunta
     de quien entra aquí es «¿quién va ganando?», no «¿quién va ganando
     a Órbita?», que era lo que contestaba por ser el primero del objeto. */
  let juego = "general";
  try { const g = localStorage.getItem("jg.rankJuego"); if (g && (g === "general" || JUEGOS[g] || EXTRA[g])) juego = g; } catch (e) { /* sin almacenamiento */ }
  const icono = ctx.icono || {};
  let categoriaSolo = "";
  const eleccion = {};
  let filas = [];
  let cargando = true;
  let fallo = "";
  let parar = null;
  /* La entrada del podio (peanas que suben, corona que cae) se anima una
     vez por juego, no en cada repintado: llegan perfiles después de la
     tabla y cada uno repinta, y el podio no puede estar subiendo sin fin. */
  let animado = "";
  let firma = "";

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-ranks">
        <div class="jg-bar-juegos" id="rkJuegos"></div>
        <div id="rkSolo"></div><div id="rkAviso"></div>
        <section class="jg-rk" id="rkEscena"></section>
        <div class="jg-tabla-caja"><table class="jg-tabla" id="rkTabla"></table></div>
        <p class="jg-nota-larga">
          Se suman 3 puntos por partida ganada y 1 por empate. Cada jugador apunta su propia
          fila desde su navegador cuando la partida acaba, así que una partida que se abandona
          cerrando la pestaña no llega a contarse.
        </p>
      </div>`;
    host.addEventListener("click", alClic);
    if (esSolo(juego)) elige(juego);
    pintaBarra();
    pintaCategorias();
    escucha();
  }

  function destruir() {
    muerto = true;
    if (parar) { try { parar(); } catch (e) {} parar = null; }
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  function escucha() {
    if (parar) { try { parar(); } catch (e) {} parar = null; }
    cargando = true; fallo = ""; filas = []; pinta();
    const individual = esSolo(juego);
    const oye = juego === "general" ? (_, cb) => ctx.watchTodos((todo, err) => cb(suma(todo), err))
      : individual ? ctx.watchSolo : watchRanks;
    parar = oye(individual ? categoriaSolo : juego, (lista, err) => {
      if (muerto) return;
      cargando = false;
      fallo = err ? String(err.code || err.message || err) : "";
      filas = lista || [];
      pinta();
    });
  }

  /* La general: cada jugador con lo de todos los juegos sumado. La racha
     es la mejor de cualquiera de ellos (sumar rachas de juegos distintos
     no significa nada) y «juegos» dice en cuántos tiene fila, que es lo
     que distingue al que gana en todo del que solo juega a uno. */
  function suma(todo) {
    const t = {};
    for (const [k, filas] of Object.entries(todo || {})) {
      if (!JUEGOS[k]) continue;
      for (const [u, f] of Object.entries(filas || {})) {
        if (!f) continue;
        const a = t[u] || (t[u] = { uid: u, nombre: "", foto: "", jugadas: 0, ganadas: 0, perdidas: 0, empates: 0, puntos: 0, mejorRacha: 0, juegos: 0, _at: -1 });
        for (const c of ["jugadas", "ganadas", "perdidas", "empates", "puntos"]) a[c] += +f[c] || 0;
        a.mejorRacha = Math.max(a.mejorRacha, +f.mejorRacha || 0);
        a.juegos++;
        if ((+f.at || 0) >= a._at) { a._at = +f.at || 0; a.nombre = f.nombre || a.nombre; a.foto = f.foto || a.foto; }
      }
    }
    return Object.values(t);
  }

  /* 22 pastillas iguales, sin icono y en el orden del objeto, eran tres
     filas de botones que no se distinguían. Ahora van en tres grupos
     (general, en sala, de un jugador), cada uno con su icono y su color,
     y los de sala por popularidad, como el catálogo. En el móvil es una
     tira que se desliza en vez de medio metro de botones. */
  function pintaBarra() {
    const el = host && host.querySelector("#rkJuegos");
    if (!el) return;
    const orden = ctx.orden ? ctx.orden().filter(k => JUEGOS[k]) : Object.keys(JUEGOS);
    const boton = (k, j) => `<button class="jg-rk-sel${k === juego ? " on" : ""}" data-juego="${k}" style="--c:${j.color}"
         ${k === juego ? 'aria-current="true"' : ""}><i aria-hidden="true">${esc(icono[k] || "●")}</i>${esc(j.nombre)}</button>`;
    el.innerHTML = boton("general", { nombre: "General", color: "#7c5cff" }) +
      `<span class="jg-rk-sep">En sala</span>` + orden.map(k => boton(k, JUEGOS[k])).join("") +
      `<span class="jg-rk-sep">Un jugador</span>` + Object.entries(EXTRA).map(([k, j]) => boton(k, j)).join("");
    const on = el.querySelector(".on");
    if (on && el.scrollWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2;
  }

  function pinta() {
    if (!host) return;
    const av = host.querySelector("#rkAviso");
    if (av) av.innerHTML = fallo
      ? `<div class="jg-aviso">No se puede leer la clasificación (<code>${esc(fallo)}</code>).
         Si pone <code>PERMISSION_DENIED</code> es que las reglas de <code>ranks</code> todavía
         no están publicadas en la consola de Firebase.</div>`
      : "";

    const t = host.querySelector("#rkTabla");
    if (!t) return;
    const solo = esSolo(juego);
    const orden = solo ? [...filas].sort((a,b)=>b.puntos-a.puntos||a.tiempo-b.tiempo||a.uid.localeCompare(b.uid)) : ordenaRanks(filas);
    const general = juego === "general";
    host.querySelector('.jg-nota-larga').textContent = solo ? 'Mejor récord por jugador y categoría. En empate, menor tiempo. Las puntuaciones se calculan en el navegador.'
      : general ? 'La general suma los puntos de todos los juegos en sala (3 por victoria, 1 por empate). «Juegos» dice en cuántos tiene fila cada uno.'
      : 'Se suman 3 puntos por victoria y 1 por empate.';
    pintaEscena(solo ? orden : orden.map(f => mezcla(f, perfil(f.uid))), solo);
    if (!orden.length) {
      t.innerHTML = `<tr><td class="jg-vacio">${cargando ? "Cargando…"
        : "Todavía no ha terminado ninguna partida de este juego. Sé el primero."}</td></tr>`;
      return;
    }
    if (solo) {t.innerHTML = `<thead><tr><th>#</th><th>Jugador</th><th>Récord</th><th>Tiempo</th></tr></thead><tbody>${orden.map((f,i)=>`<tr class="${f.uid===uid?'jg-yo':''}${i<3?' jg-rk-top':''}"><td class="jg-th-n">${puesto(i)}</td><td class="jg-jug" data-perfil="${esc(f.uid)}" data-nombre="${esc(f.nombre)}">${esc(f.nombre)}</td><td>${categoriaSolo.startsWith('club-minas-')?'Completado':categoriaSolo==='club-tetris-sprint'?'40 líneas':categoriaSolo.startsWith('club-sortem-')?f.puntos+' números':categoriaSolo.startsWith('club-bbtan-')?'Ronda '+f.puntos:f.puntos}</td><td>${(f.tiempo/1000).toFixed(2)} s</td></tr>`).join('')}</tbody>`;return;}
    t.innerHTML = `
      <thead><tr>
        <th class="jg-th-n">#</th><th>Jugador</th>
        <th class="jg-num">Jugadas</th><th class="jg-num">Ganadas</th>
        <th class="jg-num">Perdidas</th><th class="jg-num">Empates</th>
        <th class="jg-num">%</th>${general ? `<th class="jg-num">Juegos</th>` : ""}<th class="jg-num">Racha</th>
        <th class="jg-num jg-pts">Puntos</th>
      </tr></thead><tbody>${orden.map((f, i) => fila(f, i)).join("")}</tbody>`;
  }

  function fila(fx, i) {
    const f = mezcla(fx, perfil(fx.uid));
    const yo = f.uid === uid;
    const pc = porcentaje(f);
    return `<tr class="${yo ? "jg-yo" : ""}${i < 3 ? " jg-rk-top" : ""}">
      <td class="jg-th-n">${puesto(i)}</td>
      <td class="jg-jug" data-perfil="${esc(f.uid)}" data-nombre="${esc(f.nombre || "")}">
        ${f.foto ? `<img class="jg-foto" src="${esc(f.foto)}" alt="" referrerpolicy="no-referrer">`
                 : `<span class="jg-foto jg-sin">${esc((f.nombre || "?").slice(0, 1).toUpperCase())}</span>`}
        <span>${esc(f.nombre || "Sin nombre")}${yo ? " <b>(tú)</b>" : ""}</span>
      </td>
      <td class="jg-num">${f.jugadas || 0}</td>
      <td class="jg-num jg-gan">${f.ganadas || 0}</td>
      <td class="jg-num">${f.perdidas || 0}</td>
      <td class="jg-num">${f.empates || 0}</td>
      <td class="jg-num"><span class="jg-barra-pc"><i style="width:${pc}%"></i></span>${pc}%</td>
      ${juego === "general" ? `<td class="jg-num">${f.juegos || 0}</td>` : ""}
      <td class="jg-num">${f.mejorRacha || 0}</td>
      <td class="jg-num jg-pts">${f.puntos || 0}</td>
    </tr>`;
  }

  function puesto(i) {
    return i < 3 ? `<span class="jg-rk-med jg-rk-${METAL[i]}">${i + 1}</span>` : i + 1;
  }

  /* ---- El podio ---- */

  /* Lo que se compara en esta tabla, y cómo se dice. Las del club de
     buscaminas se ganan por tiempo (menos es mejor); el resto, por puntos. */
  function medida(solo) {
    if (solo && (categoriaSolo.startsWith("club-minas-") || categoriaSolo.startsWith("club-sortem-") || categoriaSolo === "club-tetris-sprint" ||
        (categoriaSolo.startsWith("club-sopa-") && categoriaSolo !== "club-sopa-racha")))
      return { valor: f => (f.tiempo || 0) / 1000, txt: v => `${v.toFixed(2)} s`, unidad: "", menor: true };
    /* BBTAN se mide en rondas alcanzadas, no en puntos. */
    if (solo && categoriaSolo.startsWith("club-bbtan-"))
      return { valor: f => f.puntos || 0, txt: v => `ronda ${v}`, unidad: "", menor: false };
    if (solo && categoriaSolo === "club-sopa-racha")
      return { valor: f => f.puntos || 0, txt: v => `${v} ${v === 1 ? "día" : "días"}`, unidad: "", menor: false };
    return { valor: f => f.puntos || 0, txt: v => String(v), unidad: "pts", menor: false };
  }

  function avatar(f) {
    return f.foto
      ? `<img src="${esc(f.foto)}" alt="" referrerpolicy="no-referrer">`
      : `<span>${esc((f.nombre || "?").slice(0, 1).toUpperCase())}</span>`;
  }

  function peana(f, i, m, solo) {
    const cls = `jg-rk-p jg-rk-${METAL[i]}${f && f.uid === uid ? " yo" : ""}${f ? "" : " libre"}`;
    const bloque = `<div class="jg-rk-bloque"><b>${i + 1}</b></div>`;
    if (!f) return `<div class="${cls}">
        <div class="jg-rk-av"><span>?</span></div>
        <b class="jg-rk-nom">Puesto libre</b>
        <span class="jg-rk-tit">¿Tú?</span>
        <div class="jg-rk-pts">&nbsp;</div>
        ${bloque}</div>`;
    const detalle = solo ? (m.menor ? "mejor tiempo" : `${((f.tiempo || 0) / 1000).toFixed(1)} s`)
      : juego === "general" ? `${f.ganadas || 0} G · ${plural(f.juegos || 0, "juego", "juegos")}`
      : `${f.ganadas || 0} G · ${porcentaje(f)} %${f.mejorRacha > 1 ? ` · racha ${f.mejorRacha}` : ""}`;
    return `<div class="${cls}">
        ${i === 0 ? CORONA : ""}
        <div class="jg-rk-av" data-perfil="${esc(f.uid)}" data-nombre="${esc(f.nombre || "")}">${avatar(f)}</div>
        <b class="jg-rk-nom" title="${esc(f.nombre || "")}">${esc(f.nombre || "Sin nombre")}${f.uid === uid ? " <em>(tú)</em>" : ""}</b>
        <span class="jg-rk-tit">${TITULO[i]}</span>
        <div class="jg-rk-pts"><b>${m.txt(m.valor(f))}</b>${m.unidad ? ` ${m.unidad}` : ""}</div>
        <small>${detalle}</small>
        ${bloque}</div>`;
  }

  /* «Tu posición»: la distancia al siguiente escalón, dicha en algo que se
     puede hacer. Para superar a alguien hace falta un punto más que él —
     a puntos iguales desempatan las victorias, y eso no se promete. */
  function tuPosicion(orden, m, solo) {
    const i = orden.findIndex(f => f.uid === uid);
    const falta = (a, b) => m.menor ? m.valor(a) - m.valor(b) : m.valor(b) - m.valor(a);
    const cuanto = (yo, otro) => {
      const d = falta(yo, otro);
      if (m.menor) return `${Math.max(0.01, d + 0.01).toFixed(2)} s menos`;
      const n = d + 1;
      return solo ? plural(n, "punto", "puntos") : `${plural(n, "punto", "puntos")} (${plural(victorias(n), "victoria", "victorias")})`;
    };
    let icono = "⚔", tit, txt;
    if (!orden.length) {
      icono = "♛"; tit = "El trono está vacío";
      txt = solo ? "El primer récord que se apunte se sienta en él." : "La primera victoria que se apunte se sienta en él.";
    } else if (i < 0) {
      tit = "Todavía no estás en la tabla";
      txt = orden.length < 3 ? "Hay un puesto libre en el podio: termina una partida y es tuyo."
        : `El podio empieza en ${m.txt(m.valor(orden[2]))}${m.unidad ? " " + m.unidad : ""}. Juega y entra.`;
    } else if (i === 0) {
      icono = "♛"; tit = "Llevas la corona";
      const r = orden[1];
      txt = !r ? "Nadie te la disputa todavía."
        : falta(orden[0], r) === 0 ? `${esc(r.nombre)} está empatado contigo. Defiéndela.`
        : `${esc(r.nombre)} está a ${m.menor ? `${(m.valor(r) - m.valor(orden[0])).toFixed(2)} s` : plural(falta(r, orden[0]), "punto", "puntos")}. Que no te alcance.`;
    } else if (i < 3) {
      icono = "♛"; tit = `#${i + 1} — a un paso del trono`;
      txt = `Te faltan ${cuanto(orden[i], orden[0])} para quitarle la corona a ${esc(orden[0].nombre)}.`;
    } else {
      tit = `Vas #${i + 1}`;
      txt = `Te faltan ${cuanto(orden[i], orden[2])} para subir al podio` +
        (i > 3 ? `, y ${cuanto(orden[i], orden[i - 1])} para adelantar a ${esc(orden[i - 1].nombre)}.` : ".");
    }
    return `<div class="jg-rk-tu${i >= 0 && i < 3 ? " podio" : ""}"><i>${icono}</i><div><b>${tit}</b><span>${txt}</span></div></div>`;
  }

  function pintaEscena(orden, solo) {
    const el = host && host.querySelector("#rkEscena");
    if (!el) return;
    if (fallo || (cargando && !orden.length)) { el.innerHTML = ""; el.hidden = true; firma = ""; return; }
    el.hidden = false;
    const m = medida(solo);
    const clave = solo ? categoriaSolo : juego;
    const entra = animado !== clave;
    animado = clave;
    const j = JUEGOS[juego] || EXTRA[juego] || { nombre: juego === "general" ? "Todos los juegos" : juego };
    const sub = solo ? subtitulo() : "";
    const html = `
      <div class="jg-rk-rayos"></div>
      <header class="jg-rk-cab"><span>Salón de la fama</span><h2>${esc(j.nombre)}</h2>${sub ? `<small>${esc(sub)}</small>` : ""}</header>
      <div class="jg-rk-podio">${[1, 0, 2].map(i => peana(orden[i], i, m, solo)).join("")}</div>
      ${tuPosicion(orden, m, solo)}`;
    /* Por firma, como el resto de pantallas: reescribir lo mismo reinicia
       los rayos, el halo y la corona, y se ve como un parpadeo. */
    if (!entra && html === firma) return;
    firma = html;
    el.classList.toggle("entra", entra);
    el.innerHTML = html;
  }

  function elige(k) {
    const d = SOLO[k];
    const e = eleccion[k] || (eleccion[k] = Object.assign(
      Object.fromEntries(d.filas.map(f => [f.k, f.ops[0][0]])), d.def || {}));
    categoriaSolo = d.cat(e);
    return e;
  }

  /* Una fila con `si` solo aparece cuando tiene sentido (el tamaño de la
     sopa no cuenta en la tabla de la racha). */
  const visibles = (d, e) => d.filas.filter(f => !f.si || f.si(e));

  function subtitulo() {
    const d = SOLO[juego], e = eleccion[juego];
    return d && e ? visibles(d, e).map(f => (f.ops.find(o => o[0] === e[f.k]) || [])[1]).join(" · ") : "";
  }

  function pintaCategorias() {
    const el = host && host.querySelector("#rkSolo");
    if (!el) return;
    if (!esSolo(juego)) { el.innerHTML = ""; return; }
    const d = SOLO[juego], e = elige(juego);
    el.innerHTML = `<div class="jg-rk-cats" style="--c:${EXTRA[juego].color}">${visibles(d, e).map(f =>
      `<div class="jg-rk-fila"><span>${f.t}</span><div class="jg-rk-seg" role="group" aria-label="${f.t}">${f.ops.map(([v, t]) =>
        `<button type="button" class="${e[f.k] === v ? "on" : ""}" aria-pressed="${e[f.k] === v}" data-cat-k="${f.k}" data-cat-v="${v}">${t}</button>`).join("")}</div></div>`).join("")}</div>`;
  }

  function alClic(ev) {
    const c = ev.target.closest("[data-cat-k]");
    if (c && esSolo(juego)) {
      const e = elige(juego), k = c.getAttribute("data-cat-k"), v = c.getAttribute("data-cat-v");
      if (e[k] === v) return;
      e[k] = v; elige(juego);
      pintaCategorias();
      escucha();
      return;
    }
    const b = ev.target.closest("[data-juego]");
    if (!b) return;
    const k = b.getAttribute("data-juego");
    if (k === juego) return;
    juego = k;
    try { localStorage.setItem("jg.rankJuego", k); } catch (e) { /* nada */ }
    if (esSolo(k)) elige(k);
    pintaCategorias();
    pintaBarra();
    escucha();
  }

  /* Un perfil que llega después de la tabla no trae fila nueva que
     escuchar, así que hay que decirle desde fuera que se repinte. */
  function refresca() { pinta(); }

  return { montar, destruir, refresca };
}
