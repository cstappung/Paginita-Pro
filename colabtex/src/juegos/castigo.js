/* ============================================================
   El castigo del antitrampas.

   Cuando la verificación de un récord del club lo rechaza (solo/club.js,
   frontera.js → `reportaSospecha` → `sospechaClub` en juegos-main.js),
   además del aviso en `sospechas` quien lo mandó se lleva un pantallazo
   azul: la imagen de Windows 10 a pantalla completa con su zumbido, y a
   los `PANTALLAZO_MS` el «wasted» de GTA. Después queda **retenido**
   `RETENCION_MS` (10 min): una capa que tapa todo Juegos con la cuenta
   atrás, y que vuelve a salir si recarga. Mientras dura, juegos-main.js no
   monta ninguna pantalla debajo (`castigoActivo`): sin eso un juego del
   club seguía sonando bajo la capa, o se volvía a montar al recargar.

   La retención se guarda en dos sitios:

   - `users/<uid>/castigo` = `{at}` con la hora **del servidor**, que es la
     verdad para una cuenta: termina en `at + RETENCION_MS` medido con el
     reloj corregido (`fb.ahora`), así que adelantar el reloj del aparato
     no la acorta, y llega a las demás pestañas y aparatos en vivo. Ese nodo
     ya es solo del dueño y no necesita reglas nuevas.
   - `localStorage` (`jg.castigo` = `{h, u}`): vale antes de saber quién
     es (al cargar, antes de la sesión), para un invitado (salir de la
     cuenta no la esquiva) y si la escritura en la cuenta falló. Lleva el
     uid castigado, `u`: en un computador compartido, otra cuenta que entra
     no hereda el castigo de la anterior. Por eso la capa le ofrece al
     invitado entrar con su cuenta.

   El límite honesto: quien sabe abrir la consola puede borrar ambos —los
   dos son suyos—, pero tiene que darse cuenta, y su marca igualmente no
   subió.

   No castiga lo que no es trampa (`esTrampa`): solo lo que se acaba de
   jugar (`vivo`), nunca un pendiente viejo de localStorage ni una marca de
   la Frontera que se re-verifica al entrar (pudo jugarse con otra versión
   del motor); tampoco un verificador que falló («No se pudo comprobar…»)
   ni una prueba que no cabe (una partida larguísima no es trampa). Los
   archivos viven en `juegos/castigo/`.
   ============================================================ */

export const PANTALLAZO_MS = 10000;
export const RETENCION_MS = 10 * 60 * 1000;
const CLAVE = "jg.castigo";
const BASE = "juegos/castigo/";

/* ¿Esta sospecha merece castigo? Pura, para los tests. */
export function esTrampa(s) {
  if (!s || s.vivo !== true) return false;
  const m = String(s.m || "");
  if (/^No se pudo comprobar/.test(m)) return false;
  if (/demasiado grande/.test(m)) return false;
  return true;
}

/* «mm:ss» de lo que falta; "" si ya no falta nada. */
export function restante(hasta, ahora) {
  const ms = Number(hasta) - ahora;
  if (!(ms > 0)) return "";
  const s = Math.ceil(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/* El registro local tal como está guardado ({h, u}); null si no hay. */
export function leeRegistro(texto) {
  if (!texto) return null;
  let v = null;
  try { v = JSON.parse(texto); } catch (e) { return null; }
  if (typeof v === "number") v = { h: v, u: "" };
  if (!v || typeof v !== "object" || !Number.isFinite(+v.h)) return null;
  return { h: +v.h, u: typeof v.u === "string" ? v.u : "" };
}

/* Hasta cuándo dura lo que dice la cuenta (`users/<uid>/castigo`). */
export const hastaDeCuenta = v => v && Number.isFinite(v.at) ? v.at + RETENCION_MS : 0;

/* Hasta cuándo está retenido quien mira; 0 si no lo está. `uid` es
   `undefined` mientras no se sabe quién es y `null` para un invitado: en
   los dos casos manda el registro local, sea de quien sea. Con cuenta, el
   local solo vale si es de esa cuenta, y lo de la cuenta siempre. */
export function vigente(reg, uid, cuenta, ahora) {
  let h = 0;
  if (reg && reg.h > ahora && (!uid || !reg.u || reg.u === uid)) h = reg.h;
  if (uid && cuenta > ahora) h = Math.max(h, cuenta);
  return h;
}

function leeLocal() {
  try { return leeRegistro(localStorage.getItem(CLAVE)); } catch (e) { return null; }
}
function guardaLocal(reg) {
  try { localStorage.setItem(CLAVE, JSON.stringify(reg)); } catch (e) {}
}

/* El reloj corregido con el del servidor, y a quién avisar cuando la capa
   aparece o se va (juegos-main.js desmonta o vuelve a montar la vista). */
let reloj = () => Date.now(), alCambiar = null, entrar = null;
export function configuraCastigo(o = {}) {
  if (typeof o.ahora === "function") reloj = o.ahora;
  if (typeof o.alCambiar === "function") alCambiar = o.alCambiar;
  if (typeof o.entrar === "function") entrar = o.entrar;
}

let capa = null, reloj1 = null, zumbido = null, cambio = null, hasta = 0, enPantallazo = false;
let quien, pintadoPara, enCuenta = 0, ocultos = [];

/* ¿Hay castigo en pantalla (pantallazo o retención)? */
export const castigoActivo = () => !!capa;

const avisa = () => { if (alCambiar) { try { alCambiar(); } catch (e) { console.warn("[castigo]", e); } } };

function bloqueaTeclas(e) {
  if (!capa) return;
  e.preventDefault(); e.stopImmediatePropagation();
}

function pantallaCompleta() {
  const d = document.documentElement;
  try {
    if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  } catch (e) {}
}

function sonar(nombre, bucle) {
  try {
    const a = new Audio(BASE + nombre);
    a.loop = !!bucle;
    a.play().catch(() => {});
    return a;
  } catch (e) { return null; }
}

const ESTILO = `<style>
    .jg-castigo{position:fixed;inset:0;z-index:2147483647;background:#0078d7;cursor:none;user-select:none;-webkit-user-select:none;touch-action:none}
    .jg-castigo img{width:100%;height:100%;object-fit:contain;display:block}
    .jg-castigo.retenido{background:#111;cursor:default;display:grid;place-items:center;text-align:center;color:#ddd;font-family:Pricedown,Impact,"Arial Black",sans-serif}
    .jg-castigo .jg-cs-t{font-size:clamp(56px,14vw,170px);color:#c8102e;letter-spacing:.04em;text-shadow:0 4px 0 #000,0 0 24px #000;animation:jgCsEntra 1.4s ease-out}
    .jg-castigo .jg-cs-m{font-family:system-ui,sans-serif;font-size:clamp(15px,2.4vw,22px);max-width:640px;margin:10px auto 0;line-height:1.45;padding:0 16px}
    .jg-castigo .jg-cs-r{font-family:ui-monospace,monospace;font-size:clamp(34px,7vw,64px);margin-top:18px;color:#fff}
    .jg-castigo .jg-cs-e{font-family:system-ui,sans-serif;font-size:15px;margin-top:22px;padding:9px 16px;border-radius:8px;border:1px solid #555;background:#222;color:#eee;cursor:pointer}
    .jg-castigo .jg-cs-e:hover{background:#333}
    @keyframes jgCsEntra{from{transform:scale(1.6);opacity:0;filter:blur(6px)}to{transform:none;opacity:1;filter:none}}
  </style>`;

function montaCapa() {
  if (capa) return capa;
  capa = document.createElement("div");
  capa.className = "jg-castigo";
  capa.innerHTML = ESTILO + `<img alt="" src="${BASE}bsod.png">`;
  /* Un clic es un gesto: lo que el navegador negó sin él (pantalla
     completa, el audio) se reintenta. El botón de la retención sí se
     deja pulsar. */
  capa.addEventListener("pointerdown", e => {
    if (e.target.closest && e.target.closest(".jg-cs-e")) return;
    e.preventDefault(); pantallaCompleta();
    if (zumbido && zumbido.paused && enPantallazo) zumbido.play().catch(() => {});
  });
  capa.addEventListener("contextmenu", e => e.preventDefault());
  document.body.appendChild(capa);
  window.addEventListener("keydown", bloqueaTeclas, true);
  window.addEventListener("keyup", bloqueaTeclas, true);
  /* Los juegos del club viven en un iframe con foco propio: se le quita.
     juegos-main.js los desmonta en cuanto se le avisa; esto cubre lo que
     quede hasta entonces. */
  try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
  ocultos = [];
  for (const f of document.querySelectorAll("iframe")) {
    try { ocultos.push([f, f.style.visibility]); f.style.visibility = "hidden"; f.contentWindow && f.contentWindow.blur(); } catch (e) {}
  }
  return capa;
}

/* La cuenta atrás: al llegar a cero se vuelve a mirar (la cuenta pudo
   alargarla) y, si ya no queda nada, se libera. */
function tic() {
  const t = restante(hasta, reloj());
  if (!t) { revisaCastigo(); return; }
  const r = capa && capa.querySelector(".jg-cs-r");
  if (r) r.textContent = t;
}

function pintaRetencion() {
  const c = montaCapa();
  c.classList.add("retenido");
  pintadoPara = quien;
  /* La explicación se deja traducir (i18n.js); el «WASTED» y la cuenta
     atrás no. */
  c.innerHTML = ESTILO + `<div>
    <div class="jg-cs-t" translate="no">WASTED</div>
    <div class="jg-cs-m">El antitrampas rechazó tu partida. Quedas retenido: no puedes usar Juegos hasta que termine la cuenta atrás.</div>
    <div class="jg-cs-r" translate="no"></div>
    ${quien === null && entrar ? '<button class="jg-cs-e" type="button">¿No eres tú? Entra con tu cuenta</button>' : ""}</div>`;
  const b = c.querySelector(".jg-cs-e");
  if (b) b.onclick = () => entrar();
  tic();
}

function retiene() {
  enPantallazo = false;
  clearTimeout(cambio); cambio = null;
  if (zumbido) { zumbido.pause(); zumbido = null; }
  pintaRetencion();
  clearInterval(reloj1);
  reloj1 = setInterval(tic, 500);
}

/* Se quita la capa y la página vuelve a montar lo que estaba en la ruta
   (`alCambiar`); no hace falta recargar. */
function libera() {
  clearInterval(reloj1); clearTimeout(cambio); reloj1 = cambio = null;
  enPantallazo = false; hasta = 0;
  if (zumbido) { zumbido.pause(); zumbido = null; }
  window.removeEventListener("keydown", bloqueaTeclas, true);
  window.removeEventListener("keyup", bloqueaTeclas, true);
  if (capa) { capa.remove(); capa = null; }
  for (const [f, v] of ocultos) { try { f.style.visibility = v; } catch (e) {} }
  ocultos = [];
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
  avisa();
}

/* La detección: pantallazo, «wasted» y retención. `escribe()` la guarda
   en la cuenta (fb.ponCastigo). Devuelve si castigó. */
export function castiga(s, { uid, escribe } = {}) {
  if (!esTrampa(s)) return false;
  if (uid) quien = uid;
  hasta = Math.max(hasta, reloj() + RETENCION_MS);
  guardaLocal({ h: hasta, u: uid || "" });
  if (escribe) Promise.resolve().then(escribe).catch(e => console.warn("[castigo] no se pudo guardar en la cuenta", e));
  if (capa) return true;                       // ya está castigado: solo se alarga
  montaCapa();
  enPantallazo = true;
  pantallaCompleta();
  zumbido = sonar("bsod.mp3", true);
  cambio = setTimeout(() => {
    sonar("wasted.mp3", false);
    retiene();
  }, PANTALLAZO_MS);
  avisa();
  return true;
}

/* Al cargar, al cambiar de cuenta, cuando llega lo de la cuenta o se
   corrige el reloj: ¿hay una retención en curso? `o` trae lo que cambió
   (`uid`, `cuenta`); lo demás se recuerda de la vez anterior. */
export function revisaCastigo(o = {}) {
  if ("uid" in o) quien = o.uid;
  if ("cuenta" in o) enCuenta = Number(o.cuenta) || 0;
  const h = vigente(leeLocal(), quien, enCuenta, reloj());
  if (h) {
    hasta = enPantallazo ? Math.max(hasta, h) : h;
    if (!capa) { retiene(); avisa(); }
    else if (!enPantallazo && pintadoPara !== quien) pintaRetencion();   // el botón depende de quién mira
    return true;
  }
  /* El pantallazo de un castigo recién puesto no lo corta una lectura
     que todavía no lo ve (la cuenta aún no devolvió su `at`). */
  if (capa && !enPantallazo) libera();
  return !!capa;
}

/* Otra pestaña castigada en este navegador. */
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("storage", e => { if (e.key === CLAVE) revisaCastigo(); });
}
