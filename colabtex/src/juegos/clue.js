import * as fb from "../fb-juegos.js";
import { votacion, jugadasDe } from "./motor.js";
import CM from "../../../juegos/clue/js/motor.js";

/* El reductor de la sala (`redClue` en motor.js) lo busca aquí. */
globalThis.ClueMotor = globalThis.ClueMotor || CM;

/* Clue: el cartero entre la sala y el juego.

   El juego vive entero en `juegos/clue/` como documento propio (tablero,
   libreta, bots de práctica y el póquer mental) y entra aquí en un
   iframe, igual que Yemas. Este módulo no decide nada: traduce.

   - **Lo de la base hacia el marco**: una vez, `config` con quién soy,
     los jugadores y su promesa (`hmazo`), la semilla de la sala, mi
     secreto de `misPartidas` y el elenco de `clueElenco` (fotos y
     nombres, que no están en el repositorio). Después, en cada cambio,
     el registro entero ya pasado por `votacion`, para que una expulsión
     llegue como el abandono que es.
   - **Lo del marco hacia la base**: cada jugada, que aquí se firma con
     el uid y se escribe con `ctx.jugar`. Solo pasan los tipos que el
     juego conoce y con tamaños acotados.
   - **La configuración espera a que la sala arranque**: antes el marco
     no sabe quiénes van a estar, y el reparto depende de los asientos.
   - **El final espera a las semillas**, como en Flip 7: con `fin`
     escrito ya no entra ninguna jugada, tampoco `{t:"s"}`, y sin las
     semillas nadie puede auditar la mesa. Así que `terminar` se llama
     cuando todos los que siguen sentados revelaron la suya, o pasado
     `ESPERA_SEMILLAS`, y se reintenta cada segundo hasta que `fin`
     exista de verdad.
   - **El cartel del final espera a la animación**: mientras el marco
     avisa que está contando algo (la acusación, la escena del crimen)
     `ocupado()` es verdad y la sala no tapa el tablero; al terminar se
     llama a `listo()`, como en Chain Reaction. Si el marco nunca avisa
     que terminó, `OCUPADO_MAX` lo suelta igual. */
const PADRE = "clue-padre", HIJO = "clue-hijo";
const ESPERA_SEMILLAS = 12000;
const OCUPADO_MAX = 15000;
const TIPOS = new Set(["elige", "suelta", "mezcla", "revuelve", "quita", "mueve", "sugiere", "acusa", "pasa", "paso", "muestra", "abre", "veredicto", "s"]);

/* Lo que se deja pasar de cada jugada: los campos que el motor lee y
   nada más, con los mazos cifrados acotados a su largo. */
function limpia(j) {
  const r = { t: j.t };
  const texto = (v, max) => typeof v === "string" && v.length <= max && /^[A-Za-z0-9_-]*$/.test(v);
  if (j.t === "elige" && texto(j.r, 24)) r.r = j.r;
  if (j.t === "mezcla" && texto(j.c, CM.NC * 64) && texto(j.pk, 64)) { r.c = j.c; r.pk = j.pk; }
  if ((j.t === "revuelve" || j.t === "quita") && texto(j.c, (CM.NC - 3) * 64)) r.c = j.c;
  if (j.t === "abre" && texto(j.c, 3 * 64)) r.c = j.c;
  if (j.t === "mueve" && Number.isInteger(j.a)) { r.a = j.a; r.v = j.v === "pasadizo" ? "pasadizo" : "dado"; }
  if (j.t === "sugiere" && Number.isInteger(j.s) && Number.isInteger(j.a)) { r.s = j.s; r.a = j.a; }
  if (j.t === "acusa" && [j.s, j.a, j.l].every(Number.isInteger)) { r.s = j.s; r.a = j.a; r.l = j.l; }
  if (j.t === "muestra" && typeof j.x === "string" && /^[0-9a-f]{2,40}$/.test(j.x)) r.x = j.x;
  if (j.t === "veredicto") r.ok = !!j.ok;
  if (j.t === "s" && Number.isFinite(Number(j.sem)) && typeof j.sal === "string" && j.sal.length <= 40) { r.sem = Number(j.sem); r.sal = j.sal; }
  return r;
}

export function crearClue({ uid, pid, jugar, terminar, mirando, secreto, listo: alListo }) {
  let host, frame, aviso, muerto = false, listo = false, configurado = false;
  let partida = null, est = null, ultimo = "", finDesde = 0, relojFin = null;
  let animando = false, relojAnima = null;
  function ocupa(v) {
    clearTimeout(relojAnima);
    const antes = animando;
    animando = !!v;
    if (animando) relojAnima = setTimeout(() => ocupa(false), OCUPADO_MAX);
    else if (antes && alListo) alListo();
  }

  const juego = () => !!est?.jugadores?.some(j => j.uid === uid) && !mirando;

  function enviar(tipo, datos = {}) {
    if (muerto || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ canal: PADRE, tipo, ...datos }, location.origin);
  }

  async function configura() {
    configurado = true;
    const [sec, elenco] = await Promise.all([
      juego() ? secreto().catch(() => null) : Promise.resolve(null),
      fb.leerElencoClue()
    ]);
    if (muerto) return;
    enviar("config", {
      yo: uid, mirando: !juego(), semilla: partida.semilla >>> 0,
      sec: sec ? { sem: sec.sem, sal: sec.sal } : null,
      elenco: elenco && elenco.length ? elenco : null,
      jugadores: est.jugadores.map(j => ({ uid: j.uid, nombre: j.nombre || "Jugador", hmazo: j.hmazo || "" }))
    });
    ultimo = "";
    reenvia();
  }

  function reenvia() {
    if (!listo || !partida || !est || muerto) return;
    if (!configurado) {
      if (est.listos) configura();
      return;
    }
    const lista = jugadasDe(votacion(partida).p);
    const firma = lista.length + ":" + (lista.length ? lista[lista.length - 1].k : "");
    if (firma === ultimo) return;
    ultimo = firma;
    enviar("jugadas", { lista });
  }

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { listo = true; reenvia(); return; }
    if (d.tipo === "ocupado") { ocupa(d.v); return; }
    if (!juego() || d.tipo !== "jugar" || !d.j || !TIPOS.has(d.j.t)) return;
    /* Tras el final solo se escribe la semilla (`jugar` deja pasar `s`). */
    if (partida?.fin && d.j.t !== "s") return;
    jugar(Object.assign(limpia(d.j), { uid }))
      .catch(err => console.warn("[clue] no se pudo escribir la jugada", d.j.t, err));
  }

  function pintaAviso() {
    if (!aviso || !est) return;
    const n = est.jugadores.length, cupo = est.cupo || n;
    aviso.hidden = !!est.listos;
    aviso.textContent = est.listos ? "" : "Esperando detectives… " + n + " de " + cupo +
      (cupo > 2 && n >= 2 ? " · el anfitrión puede empezar ya" : "");
  }

  function montar(el) {
    host = el; host.innerHTML = "";
    aviso = document.createElement("p");
    aviso.className = "jg-clue-aviso";
    aviso.setAttribute("role", "status");
    aviso.hidden = true;
    frame = document.createElement("iframe");
    frame.title = "Clue: partida en línea";
    frame.className = "jg-clue-marco";
    window.addEventListener("message", mensaje);
    frame.src = "juegos/clue/index.html?modo=online&v=clue-4";
    host.append(aviso, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    pintaAviso();
    reenvia();
    cierre();
  }

  function cierre() {
    clearTimeout(relojFin);
    if (muerto || !est || est.fase !== "fin" || partida?.fin || !juego()) return;
    if (!finDesde) finDesde = Date.now();
    const faltan = est.jugadores.filter(j => !(est.fuera || {})[j.uid] && !(est.semillas || {})[j.uid]);
    if (!faltan.length || Date.now() - finDesde > ESPERA_SEMILLAS) {
      Promise.resolve(terminar(est.ganador || "", est.motivo || "")).catch(() => {});
    }
    relojFin = setTimeout(cierre, 1000);
  }

  function destruir() {
    muerto = true;
    clearTimeout(relojFin);
    clearTimeout(relojAnima);
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, ocupado: () => animando };
}
