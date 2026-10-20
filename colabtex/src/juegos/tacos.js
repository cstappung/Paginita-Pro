/* Los tacos de Pool y sus cofres: puro y sin importaciones, para que lo
   lean igual las monedas (que cobran), la pantalla (que dibuja) y las
   pruebas en Node.

   Un cofre es `cofres/<uid>/<clave>` = {at, p}, escrito una vez: `at` lo
   pone el servidor (las reglas exigen `at === now`) y `p` es el precio
   fijo. Lo que sale NO se guarda: se calcula con `abreCofre(uid, clave, at)`,
   una función pura de esos tres datos. Nadie puede elegir su premio, porque
   la hora la pone el servidor y la clave ya está escrita cuando la hora
   existe, y nadie puede escribirse un taco, porque lo que se tiene es la
   suma de los cofres que `economia()` aceptó (como los sobres de PRODROP).
   Repetir un taco ya tenido devuelve monedas (`REEMBOLSO`). */

export const PRECIO_COFRE = 500;

/* Probabilidades en milésimas (suman 1000). */
export const RAREZAS = [
  { id: "comun", nombre: "Común", mil: 580, color: "#9aa7b4", reembolso: 100 },
  { id: "poco", nombre: "Poco común", mil: 270, color: "#4ec27c", reembolso: 200 },
  { id: "raro", nombre: "Raro", mil: 110, color: "#4a9bff", reembolso: 400 },
  { id: "epico", nombre: "Épico", mil: 35, color: "#b565ff", reembolso: 1000 },
  { id: "leyenda", nombre: "Legendario", mil: 5, color: "#ffb52e", reembolso: 2500 }
];
export const rarezaDe = id => RAREZAS.find(r => r.id === id) || RAREZAS[0];

/* Cada taco es un estilo de dibujo (`pool-vista.js`): colores del fuste
   (cuatro tonos de la luz al borde), del mango, del aro, de la punta; un
   `veta` y, en los mejores, un `brillo` animado. */
const madera = (a, b, c, d) => [a, b, c, d];
export const TACOS = {
  escuela: { nombre: "Taco de escuela", rareza: "comun", regalo: true,
    fuste: madera("#8a6a3a", "#f1d9a6", "#e0b87a", "#8c6430"), mango: madera("#150a05", "#6b3a22", "#3f1f10", "#0e0603"), aro: "#c8a84a", punta: "#5b8ef0", veta: "liso" },
  fresno: { nombre: "Fresno claro", rareza: "comun",
    fuste: madera("#a98d62", "#f6e6c4", "#e8cf9c", "#a98750"), mango: madera("#2a1b0d", "#8a6238", "#5a3b1c", "#1c1108"), aro: "#d9d9d9", punta: "#4aa3df", veta: "liso" },
  pino: { nombre: "Pino rojizo", rareza: "comun",
    fuste: madera("#a0522d", "#e8a56a", "#cd7f4a", "#7b3d1c"), mango: madera("#3a1608", "#a24a22", "#6b2c12", "#240d05"), aro: "#e6b85c", punta: "#3b6fd6", veta: "rayas" },
  arce: { nombre: "Arce rayado", rareza: "poco",
    fuste: madera("#9c7a45", "#fbe8bd", "#efd195", "#a07e42"), mango: madera("#101010", "#3b3b3b", "#222", "#050505"), aro: "#d4af37", punta: "#e8e8e8", veta: "rayas" },
  ebano: { nombre: "Ébano", rareza: "poco",
    fuste: madera("#1a1410", "#5a4a3c", "#33281f", "#0c0907"), mango: madera("#050505", "#262626", "#111", "#000"), aro: "#c9c9c9", punta: "#2e6fd1", veta: "liso" },
  carmin: { nombre: "Carmín", rareza: "poco",
    fuste: madera("#9c7a45", "#fbe8bd", "#efd195", "#a07e42"), mango: madera("#4a0a0a", "#d0302f", "#8c1818", "#2a0505"), aro: "#ffd76a", punta: "#d63b30", veta: "liso", envoltura: "#2a0505" },
  celta: { nombre: "Nudo celta", rareza: "raro",
    fuste: madera("#7c5a2c", "#e9c98b", "#c9a15f", "#6a4a22"), mango: madera("#07281a", "#1f8a52", "#12603a", "#04180f"), aro: "#e8d28a", punta: "#2fbf71", veta: "nudos", envoltura: "#031a0f" },
  carbono: { nombre: "Fibra de carbono", rareza: "raro",
    fuste: madera("#101214", "#4a4f55", "#262a2e", "#08090a"), mango: madera("#0a0a0c", "#34363c", "#17181c", "#050506"), aro: "#9aa7b4", punta: "#ff7a1a", veta: "carbono" },
  oceano: { nombre: "Océano", rareza: "raro",
    fuste: madera("#0b3b66", "#5cc4ff", "#2a8fd6", "#07294a"), mango: madera("#06203a", "#1a6fb0", "#0e4a7a", "#031225"), aro: "#cdeeff", punta: "#ffffff", veta: "olas" },
  dragon: { nombre: "Dragón rojo", rareza: "epico",
    fuste: madera("#5a0f0a", "#ff6a3d", "#c42a14", "#3a0905"), mango: madera("#1a0504", "#7a1810", "#4a0d08", "#0d0202"), aro: "#ffd76a", punta: "#ffd76a", veta: "escamas", envoltura: "#0d0202", brillo: "#ff7a3a" },
  aurora: { nombre: "Aurora", rareza: "epico",
    fuste: madera("#2a1a5a", "#9be8ff", "#7a6bff", "#1a0f3a"), mango: madera("#120a2c", "#5a3bb0", "#33207a", "#080418"), aro: "#e8ccff", punta: "#7dffd8", veta: "aurora", envoltura: "#080418", brillo: "#8affe0" },
  excalibur: { nombre: "Excalibur", rareza: "leyenda",
    fuste: madera("#7a5a10", "#fff3b0", "#f0c93a", "#6a4a08"), mango: madera("#2a0a05", "#a04a1a", "#6a2a0c", "#150502"), aro: "#fff3b0", punta: "#ffffff", veta: "runas", envoltura: "#150502", brillo: "#ffe27a" },
  galaxia: { nombre: "Galaxia", rareza: "leyenda",
    fuste: madera("#05031a", "#7a4dff", "#2a1a7a", "#02010d"), mango: madera("#03020f", "#3a2a8a", "#1a1050", "#010007"), aro: "#ffd1fb", punta: "#ffffff", veta: "galaxia", envoltura: "#010007", brillo: "#b890ff" }
};
export const IDS_TACOS = Object.keys(TACOS);
/* Los que pueden salir de un cofre: todos menos el de regalo. */
export const IDS_PREMIO = IDS_TACOS.filter(k => !TACOS[k].regalo);
export const esTaco = id => typeof id === "string" && Object.prototype.hasOwnProperty.call(TACOS, id);

/* ---------- el sorteo ---------- */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}
function mulberry(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Qué taco sale del cofre `clave` de `uid` abierto en `at` (ms del servidor). */
export function abreCofre(uid, clave, at) {
  const r = mulberry(hash(uid + "|" + clave + "|" + Math.round(at)));
  const tirada = Math.floor(r() * 1000);
  let acum = 0, rareza = RAREZAS[0];
  for (const x of RAREZAS) { acum += x.mil; if (tirada < acum) { rareza = x; break; } }
  const lista = IDS_PREMIO.filter(k => TACOS[k].rareza === rareza.id);
  return lista[Math.floor(r() * lista.length)];
}
export const reembolsoDe = id => (esTaco(id) ? rarezaDe(TACOS[id].rareza).reembolso : 0);
