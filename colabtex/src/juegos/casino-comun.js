/* Lo que repiten la ruleta, el blackjack, el póker y el plinko: guardar
   preferencias, el control de la apuesta y el mensaje de un error. */
import { APUESTA_MIN, PALOS, VALORES } from "./casino-motor.js";
import { MONEDA } from "./monedas-vista.js";

export const lee = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } };
export const guarda = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
export const espera = ms => new Promise(r => setTimeout(r, ms));
export const errorDe = (e, que = "apostar") => (e && e.message && !/PERMISSION/i.test(e.message) ? e.message
  : `No se pudo ${que}. Si recién se estrenó este juego, faltan publicar las reglas de la base.`);

/* El monto (− [entrada] +) y los atajos Mín · ½ · 2× · Máx. */
export const htmlApuesta = () => `
  <div class="jg-cs-monto">
    <button type="button" data-paso="-1" aria-label="Menos">−</button>
    <span>${MONEDA}<input type="number" inputmode="numeric" min="${APUESTA_MIN}" step="1" data-p></span>
    <button type="button" data-paso="1" aria-label="Más">+</button>
  </div>
  <div class="jg-cs-chips">
    <button type="button" data-x="min">Mín</button><button type="button" data-x="0.5">½</button>
    <button type="button" data-x="2">2×</button><button type="button" data-x="max">Máx</button>
  </div>`;

/* Liga el monto dentro de `caja`: `tope()` es el máximo de ahora,
   `bloqueado()` si no se puede tocar y `cambio()` se llama al cambiar.
   Devuelve {valor(), pon(p)}. */
export function ligaApuesta(caja, { api, clave, def = 50, tope, bloqueado = () => false, cambio = () => {} }) {
  const inP = caja.querySelector("[data-p]");
  const valor = () => Math.max(APUESTA_MIN, Math.min(tope(), Math.round(+inP.value) || APUESTA_MIN));
  const pon = p => { inP.value = String(Math.max(APUESTA_MIN, Math.min(tope(), Math.round(p) || APUESTA_MIN))); guarda(clave, inP.value); cambio(); };
  inP.value = String(Math.round(+lee(clave, def)) || def);
  inP.value = String(valor());
  caja.addEventListener("click", e => {
    const b = e.target.closest("button[data-x], button[data-paso]");
    if (!b || bloqueado()) return;
    let p = valor();
    if (b.dataset.paso) p += (+b.dataset.paso) * (p >= 200 ? 50 : p >= 50 ? 10 : 5);
    else if (b.dataset.x === "min") p = APUESTA_MIN;
    else if (b.dataset.x === "max") { const c = api.cuenta(); p = c ? Math.min(tope(), Math.max(APUESTA_MIN, Math.floor(c.saldo))) : tope(); }
    else p = Math.round(p * +b.dataset.x);
    pon(p); api.suena("clic");
  });
  inP.oninput = () => cambio();
  inP.onchange = () => pon(valor());
  return {
    valor, pon,
    bloquea(si) { for (const el of caja.querySelectorAll("input, button[data-x], button[data-paso]")) el.disabled = si; }
  };
}

/* Las teclas de un juego, salvo cuando se escribe en un campo. */
export function teclas(f) {
  const h = e => { if (!/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "") && !e.ctrlKey && !e.metaKey && !e.altKey) f(e); };
  document.addEventListener("keydown", h);
  return () => document.removeEventListener("keydown", h);
}

/* Un naipe del DOM (blackjack y póker): `.in` gira en 3D entre la cara y
   el dorso; `tapada` lo deja boca abajo. */
export function naipe(c, tapada) {
  const el = document.createElement("div");
  el.className = "jg-cs-naipe" + (tapada ? " tapada" : "");
  el.innerHTML = `<div class="in"><div class="cara"></div><div class="dorso"></div></div>`;
  if (c != null) ponCara(el, c);
  return el;
}
export function ponCara(el, c) {
  const v = VALORES[c % 13], p = PALOS[Math.floor(c / 13)], rojo = p === "♥" || p === "♦";
  el.classList.toggle("rojo", rojo);
  el.dataset.c = c;
  el.querySelector(".cara").innerHTML = `<b>${v}<i>${p}</i></b><em>${c % 13 >= 10 ? `<span class="fig">${v}</span>` : ""}${p}</em><b class="abajo">${v}<i>${p}</i></b>`;
}
