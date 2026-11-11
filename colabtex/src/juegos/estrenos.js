/* Estrenos: la ventana que se abre sola al entrar al salón para enseñar lo
   nuevo, como hizo la tienda de Halloween (tienda-halloween.js). Hoy: el
   juego nuevo Pro Kingdoms y la gran actualización de Pro BoxHead, media
   ventana cada uno, con su botón de jugar.

   Para una campaña nueva se cambia `ESTRENOS` entero (otro `id`, otra
   fecha, otras dos mitades): con otro `id` vuelve a salirle a todos.

   Cuándo sale sola (`debeAbrirEstrenos`, pura): hasta `hasta`, a lo más
   una vez al día por aparato y `VECES` veces en total, y nunca más si la
   persona tocó «No mostrar más». Jugar desde aquí no la apaga: mañana
   enseña el otro juego. `?estrenos=1` la abre siempre (para verla).

   Cada mitad lleva una **captura real del juego** (juegos/estrenos/*.webp,
   1000×1000), no su portada dibujada: la dueña quería ver el juego. `pos`
   es el `object-position` que deja lo interesante dentro de la franja.
   Cómo se sacaron: docs/claude/juegos/salon.md. */

export const ESTRENOS = {
  id: "2026-11-reinos-boxhead",
  hasta: Date.UTC(2026, 10, 26, 3, 0, 0),   // 26 de noviembre, 00:00 de Chile
  mitades: [
    { id: "prokingdoms", foto: "juegos/estrenos/prokingdoms.webp?v=1", pos: "50% 48%", sello: "Juego nuevo", icono: "👑", titulo: "Pro Kingdoms",
      gancho: "Funda tu reino",
      lema: "Un reino en pixel art que sigue creciendo mientras no estás: tus aldeanos trabajan solos y tú decides qué levantar y cuándo pasar de era.",
      puntos: ["De aldea a imperio: eras, héroes y mazmorras con jefes", "Batallas en vivo: tú das las órdenes", "Mundo compartido: gremios, diplomacia y mercado"],
      ruta: "#prokingdoms", boton: "Jugar Pro Kingdoms" },
    { id: "boxhead", foto: "juegos/estrenos/boxhead.webp?v=1", pos: "50% 86%", sello: "Gran actualización", icono: "🧟", titulo: "Pro BoxHead",
      gancho: "La horda volvió más grande",
      lema: "Zombis y diablos de cajas en 3D, ahora con mucho más que matar y con qué matarlo. Solo, con tabla en el Solo Club, o en sala para hasta ocho.",
      puntos: ["4 mapas, 5 enemigos y 4 armas nuevas", "Modos nuevos: jefes, equipos e infectado", "Mejoras a elegir, medallas y aspectos"],
      ruta: "#solo/boxhead", boton: "Jugar Pro BoxHead", ficha: "boxhead", boton2: "Con amigos" }
  ]
};
export const VECES = 3;
const CLAVE = "jg.estrenos";

const diaDe = t => { const f = new Date(t); return `${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}`; };

/* `visto`: lo guardado, `{id, dia, n, no}` (o nada). Lo de otra campaña no cuenta. */
export function debeAbrirEstrenos(ahora, visto, campana = ESTRENOS) {
  if (!(ahora < campana.hasta)) return false;
  const v = visto && visto.id === campana.id ? visto : null;
  if (!v) return true;
  return !v.no && (v.n || 0) < VECES && v.dia !== diaDe(ahora);
}
export function trasVer(ahora, visto, campana = ESTRENOS) {
  const v = visto && visto.id === campana.id ? visto : {};
  return { id: campana.id, dia: diaDe(ahora), n: (v.n || 0) + 1, no: !!v.no };
}

const lee = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { return null; } };
const guarda = v => { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: vuelve a salir */ } };
export const estrenosForzados = () => { try { return new URLSearchParams(location.search).get("estrenos") === "1"; } catch (e) { return false; } };
export const tocaEstrenos = () => estrenosForzados() || debeAbrirEstrenos(Date.now(), lee());

let abierta = null;
export const estrenosAbiertos = () => !!abierta;

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function estrenosHtml(campana = ESTRENOS) {
  return `<div class="jg-es" role="dialog" aria-modal="true" aria-labelledby="jgEsT">
    <h2 id="jgEsT" class="jg-es-tit"><span aria-hidden="true">✦</span> Novedades en Juegos <span aria-hidden="true">✦</span></h2>
    <button type="button" class="jg-es-x" data-es-cerrar aria-label="Cerrar" title="Cerrar">✕</button>
    <div class="jg-es-mitades">${campana.mitades.map(m => `
      <section class="jg-es-mitad jg-es-${esc(m.id)}" aria-labelledby="jgEs-${esc(m.id)}">
        <div class="jg-es-arte" aria-hidden="true"><img class="jg-es-foto" src="${esc(m.foto)}" alt="" width="1000" height="1000" decoding="async" style="object-position:${esc(m.pos)}"></div>
        <div class="jg-es-tx">
          <span class="jg-es-sello">${esc(m.sello)}</span>
          <h3 id="jgEs-${esc(m.id)}"><span aria-hidden="true">${m.icono}</span> ${esc(m.titulo)}</h3>
          <p class="jg-es-gancho">${esc(m.gancho)}</p>
          <p class="jg-es-lema">${esc(m.lema)}</p>
          <ul>${m.puntos.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
          <div class="jg-es-btns">
            <button type="button" class="jg-es-jugar" data-es-ruta="${esc(m.ruta)}">▶ ${esc(m.boton)}</button>
            ${m.ficha ? `<button type="button" class="jg-es-otro" data-es-ficha="${esc(m.ficha)}">${esc(m.boton2)}</button>` : ""}
          </div>
        </div>
      </section>`).join("")}
    </div>
    <div class="jg-es-pie"><button type="button" class="jg-es-no" data-es-no>No mostrar más</button><button type="button" class="jg-es-luego" data-es-cerrar>Ahora no</button></div>
  </div>`;
}

/* ctx: { ir(hash), ficha(id), suena(nombre)? }. Devuelve con qué cerrarla. */
export function abreEstrenos(ctx) {
  if (abierta) return abierta;
  if (!estrenosForzados()) guarda(trasVer(Date.now(), lee()));
  const antes = document.activeElement;
  const capa = document.createElement("div");
  capa.className = "jg-modal-capa jg-es-capa";
  capa.innerHTML = estrenosHtml();
  const cierra = () => {
    if (!abierta) return;
    abierta = null;
    document.removeEventListener("keydown", tecla, true);
    capa.remove();
    if (antes && antes.focus && document.contains(antes)) { try { antes.focus(); } catch (e) { /* ya no está */ } }
  };
  const tecla = e => { if (e.key === "Escape") { e.stopPropagation(); cierra(); } };
  capa.addEventListener("click", e => {
    if (e.target === capa) { cierra(); return; }
    const b = e.target.closest("button");
    if (!b) return;
    if (ctx.suena) ctx.suena("clic");
    if (b.hasAttribute("data-es-no")) guarda(Object.assign(trasVer(Date.now(), lee()), { no: true }));
    const ruta = b.getAttribute("data-es-ruta"), ficha = b.getAttribute("data-es-ficha");
    cierra();
    if (ruta) ctx.ir(ruta);
    else if (ficha) ctx.ficha(ficha);
  });
  document.addEventListener("keydown", tecla, true);
  abierta = cierra;
  document.body.appendChild(capa);
  const primero = capa.querySelector(".jg-es-jugar");
  if (primero) primero.focus({ preventScroll: true });
  return cierra;
}
