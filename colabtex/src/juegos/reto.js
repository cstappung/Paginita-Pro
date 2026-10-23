/*
 * «Reta a un amigo»: un enlace con una marca del club para superar.
 *
 * Es la mitad pura (la otra, el banner y el botón, vive en juegos-main.js)
 * y no toca Firebase: el reto viaja entero en la URL
 * (`juegos.html?rc=<categoría>&rp=<puntos>&rt=<ms>&rn=<nombre>#solo/<x>`),
 * así que funciona igual con o sin cuenta y no hace falta ninguna regla
 * nueva. La parte de búsqueda (`?…`) no estorba al enrutado, que solo lee
 * el `#`. Lo que llega por el enlace lo escribió otra persona: se valida
 * campo por campo y el nombre se pinta con `translate="no"`.
 *
 * El honesto límite: la marca no se comprueba (no hay prueba ni servidor
 * que la verifique), así que alguien puede mandar un reto inventado. Solo
 * se usa para un aviso en el navegador de quien lo abre; nada se guarda
 * ni se paga por superarlo.
 */
import { limpiaNombreInvitado } from "./salon-datos.js";
import { mejorClub } from "./solo/club-datos.js";

const CATEGORIA = /^club-[a-z0-9]+(-[a-z0-9]+){0,4}$/;
const entero = (v, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

/* El reto que trae una URL (su `location.search`), o null si no trae o no
   es válido. */
export function leeReto(search) {
  let q;
  try { q = new URLSearchParams(search || ""); } catch (e) { return null; }
  const categoria = q.get("rc") || "";
  if (!CATEGORIA.test(categoria) || categoria.length > 60) return null;
  const puntos = entero(q.get("rp"), 1e9), tiempo = entero(q.get("rt") || "0", 1e9);
  if (puntos === null || tiempo === null) return null;
  return { categoria, puntos, tiempo, nombre: limpiaNombreInvitado(q.get("rn")) || "Alguien" };
}

/* La parte `?…` de un reto, para armar el enlace. */
export function enlaceReto({ categoria, puntos, tiempo, nombre }) {
  const q = new URLSearchParams({ rc: categoria, rp: String(Math.max(0, Math.floor(+puntos || 0))) });
  if (tiempo) q.set("rt", String(Math.max(0, Math.floor(+tiempo || 0))));
  const n = limpiaNombreInvitado(nombre);
  if (n) q.set("rn", n);
  return "?" + q.toString();
}

/* ¿La partida `dato` supera el reto? El mismo orden de la tabla del club
   (más puntos; a igualdad, menos tiempo). Un empate exacto no supera. */
export const superaReto = (dato, reto) => !!dato && !!reto && dato.categoria === reto.categoria &&
  mejorClub({ puntos: +dato.puntos || 0, tiempo: +dato.tiempo || 0 }, { puntos: reto.puntos, tiempo: reto.tiempo || 0 });

/* El texto que acompaña al enlace al compartirlo. */
export const textoReto = (juego, marca) => marca
  ? `Hice ${marca} en ${juego}. ¿Me ganas? Se juega gratis y sin cuenta, también en el celular:`
  : `Juega ${juego} conmigo: gratis, sin cuenta y también en el celular:`;
