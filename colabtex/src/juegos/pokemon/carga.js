/* Carga el motor de Pokémon (`juegos-pokemon.js`, el simulador de
   Showdown) la primera vez que hace falta: al abrir una sala de Pokémon
   o el editor de equipos. Lleva el `?v=` de la propia página, como el
   motor de fórmulas de ColabDraw, para que nunca llegue una copia vieja
   de la caché junto a una página nueva. Se lee al cargar el bundle,
   porque `document.currentScript` solo vale mientras se ejecuta. */
const VER = (typeof document !== "undefined" && document.currentScript && document.currentScript.src.split("?v=")[1]) || "";
let promesa = null;

export function cargaMotor() {
  if (globalThis.PokeMotor) return Promise.resolve(globalThis.PokeMotor);
  if (promesa) return promesa;
  promesa = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "juegos-pokemon.js" + (VER ? "?v=" + VER : "");
    s.async = true;
    s.onload = () => globalThis.PokeMotor ? ok(globalThis.PokeMotor) : mal(new Error("El motor de Pokémon no se inició."));
    s.onerror = () => { promesa = null; s.remove(); mal(new Error("No se pudo descargar el motor de Pokémon. Revisa la conexión y vuelve a intentarlo.")); };
    document.head.appendChild(s);
  });
  return promesa;
}
export const motorListo = () => globalThis.PokeMotor || null;
/* La dirección completa del motor, con el mismo `?v=`: el verificador de
   la Frontera lo carga en un Worker propio, con su copia limpia del
   simulador (ver solo/verifica/frontera.js). */
export const urlMotor = () => new URL("juegos-pokemon.js" + (VER ? "?v=" + VER : ""), location.href).href;
