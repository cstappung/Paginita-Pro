/* ============================================================
   El color del nombre — puro y verificable en Node.

   Se desbloquea trayendo gente (referidos.js) y cada escalón trae un
   efecto más llamativo que el anterior: 1 referido, rojo con una brasa
   que respira; 3, verde claro con un destello y una chispa; 5, azul con
   un reflejo que recorre las letras; 10, dorado con reflejo, aura que
   late y dos chispas. Es opcional: cada uno elige uno de los que tiene o
   ninguno («Normal»), y se guarda en `users/<uid>/perfil/tinta` (sin regla
   nueva: `users/<uid>` ya lo escribe solo su dueño).

   **Se re-chequea donde se ve**, como los marcos: un color escrito a mano
   por quien no trajo a nadie se guarda, pero los demás ven el nombre
   normal. Mientras las lecturas están a medias se confía en lo guardado,
   para que el color no parpadee al cargar.

   **Una sola hoja para toda la página.** Cada nombre pintado va en
   `<span class="jg-nm" data-nm="<uid>">` (`nombreHtml`), y `cssTintas`
   escribe una regla por color con los uid que lo llevan, más las clases
   `jg-tn-<id>` de la vista previa del editor (que mandan: llevan `html`
   delante). Cambiar de color no repinta nada: se reescribe la hoja. Los
   valores (`--tn-*`) y las animaciones están en juegos.html y cambian
   según el fondo: sobre uno claro el verde claro y el dorado llevan un
   contorno oscuro, porque solos no se leen sobre blanco.

   El reflejo (azul y dorado) pinta las letras con `background-clip:
   text`; por eso su halo y su contorno van en `filter: drop-shadow`, que
   se aplica sobre lo ya pintado: un `text-shadow` taparía el relleno.
   ============================================================ */

export const TINTAS = [
  { id: "rojo", n: 1, nombre: "Rojo", efecto: "brasa" },
  { id: "verde", n: 3, nombre: "Verde claro", efecto: "destello" },
  { id: "azul", n: 5, nombre: "Azul", efecto: "reflejo" },
  { id: "dorado", n: 10, nombre: "Dorado", efecto: "aura dorada" }
];
export const tintaDe = id => TINTAS.find(t => t.id === id) || null;

/* Lo que pinta cada color: el nombre (`d`) y sus chispas (`antes`,
   `despues`). Cada escalón suma algo al anterior. */
const REFLEJO = id => `background:linear-gradient(105deg,var(--tn-${id}) 36%,var(--tn-${id}-luz) 50%,var(--tn-${id}) 64%) 0 0/250% 100%;` +
  "-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;text-shadow:none;";
/* Una chispa: hereda el relleno transparente del reflejo, así que lleva
   el suyo. */
const CHISPA = (c, color, dur, retraso) => `content:"${c}";display:inline-block;font-size:.78em;line-height:1;color:${color};` +
  `-webkit-text-fill-color:${color};text-shadow:none;animation:jgTnChispa ${dur} ease-in-out ${retraso} infinite`;
export const EFECTOS = {
  rojo: { d: "color:var(--tn-rojo);text-shadow:var(--tn-rojo-s);animation:jgTnBrasa 3.2s ease-in-out infinite" },
  verde: {
    d: "color:var(--tn-verde);text-shadow:var(--tn-verde-s);animation:jgTnDestello 2.4s ease-in-out infinite",
    despues: "margin-left:.2em;" + CHISPA("✧", "var(--tn-verde-chispa)", "2.4s", "0s")
  },
  azul: {
    d: "color:var(--tn-azul);" + REFLEJO("azul") + "filter:var(--tn-azul-f);animation:jgTnReflejo 2.8s linear infinite",
    despues: "margin-left:.2em;" + CHISPA("✦", "var(--tn-azul-chispa)", "2s", "0s")
  },
  dorado: {
    d: "color:var(--tn-dorado);" + REFLEJO("dorado") + "filter:var(--tn-dorado-f);animation:jgTnReflejo 2.2s linear infinite,jgTnAura 2.2s ease-in-out infinite",
    antes: "margin-right:.2em;" + CHISPA("✦", "var(--tn-chispa)", "1.6s", "-.8s"),
    despues: "margin-left:.2em;" + CHISPA("✦", "var(--tn-chispa)", "1.6s", "0s")
  }
};

/* El color que se ve: el elegido, si `n` referidos alcanzan (o si todavía
   no se sabe cuántos son, `n` nulo). */
export function tintaVisible(id, n) {
  const t = tintaDe(id);
  if (!t) return "";
  return n == null || n >= t.n ? t.id : "";
}

/* El próximo color por desbloquear con `n` referidos (o null). */
export const siguienteTinta = n => TINTAS.find(t => n < t.n) || null;

const RE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Un nombre, ya escapado, envuelto para que la hoja lo pueda pintar.
   `fija`: un color (o "normal") que manda sobre la hoja; es la vista
   previa del editor, que enseña lo elegido antes de guardarlo. */
export function nombreHtml(uid, nombreEsc, fija) {
  const f = fija && (fija === "normal" || tintaDe(fija)) ? ` jg-tn-${fija}` : "";
  if (!f && !(uid && RE_UID.test(uid))) return nombreEsc;
  return `<span class="jg-nm${f}"${uid && RE_UID.test(uid) ? ` data-nm="${esc(uid)}"` : ""}>${nombreEsc}</span>`;
}

/* Las reglas de un color para un selector. */
function reglas(sel, e) {
  return `${sel}{${e.d}}\n` + (e.antes ? `${sel}::before{${e.antes}}\n` : "") + (e.despues ? `${sel}::after{${e.despues}}\n` : "");
}

/* La hoja: `porUid` = {uid: id del color visible}. Un uid raro no entra
   (va dentro de un selector). Primero los nombres y después la vista
   previa, que gana por especificidad y por orden. */
export function cssTintas(porUid) {
  const grupos = {};
  for (const [u, id] of Object.entries(porUid || {}))
    if (RE_UID.test(u) && tintaDe(id)) (grupos[id] = grupos[id] || []).push(`.jg-nm[data-nm="${u}"]`);
  let css = "";
  for (const t of TINTAS) if (grupos[t.id]) css += reglas(`:is(${grupos[t.id].join(",")})`, EFECTOS[t.id]);
  for (const t of TINTAS) css += reglas(`html .jg-nm.jg-tn-${t.id}`, EFECTOS[t.id]);
  return css;
}
