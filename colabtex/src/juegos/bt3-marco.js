import { crearMalla } from "./malla.js";

/* La red de BT3 dentro de su marco (`juegos/bt3/index.html`). Se empaqueta aparte, a `juegos/bt3/red.js`
   (`npm run build:bt3`), porque vive en el iframe y no en la página de la sala.

   Resumen: el juego (gs/net.c, compilado a WebAssembly) manda y recibe paquetes como si fueran UDP por
   `Module.netSend` / `Module.netRecv`. Aquí esos paquetes viajan por la misma malla WebRTC del resto de
   los juegos (`malla.js`), pero abierta EN el marco: un paquete va del juego a la red sin pasar por la página
   de la sala, y llega al juego sin esperar a que ella esté libre. Lo único que sale del marco es la
   presentación (oferta, respuesta, candidatos): la página de la sala tiene la sesión de Firebase y presta su
   buzón por postMessage (`bt3.js`, `senalOp`). Durante la pelea no se toca Firebase.

   El canal es el de la malla: sin orden y sin reenvíos, como el UDP para el que se escribió el juego; cada
   paquete del juego ya repite los botones de los últimos 16 cuadros, así que uno perdido no importa. */
const PADRE = "bt3-padre", HIJO = "bt3-hijo";
const ESPERA_CONEXION = 45000;   // un rival que nunca conecta (otra red que no deja): no para siempre
const KEEP = new Uint8Array([0x42, 0x54, 0x33, 0x4e, 9, 0, 0, 0]);   // «sigo aquí» (gs/net.c), cada medio segundo

const padre = (tipo, datos = {}) => window.parent.postMessage({ canal: HIJO, tipo, ...datos }, location.origin);

// ---------- el buzón de la sala, por postMessage (la misma forma que `fb.senalMalla`) ----------
let alMsj = null, alPres = null, pedidos = 0;
const esperando = new Map();   // id → resolver de `entra`
const senal = {
  entra(s) {
    const id = ++pedidos;
    return new Promise((ok, mal) => { esperando.set(id, r => r ? ok() : mal(new Error("sin permiso"))); padre("senal", { op: "entra", id, s }); });
  },
  sale() { padre("senal", { op: "sale" }); },
  alPresentes(cb) { alPres = cb; padre("senal", { op: "presentes", on: true }); return () => { alPres = null; padre("senal", { op: "presentes", on: false }); }; },
  envia(para, m) { padre("senal", { op: "envia", para, m }); },
  alMensajes(cb) { alMsj = cb; padre("senal", { op: "mensajes", on: true }); return () => { alMsj = null; padre("senal", { op: "mensajes", on: false }); }; },
};

// ---------- lo que dice la sala ----------
let estado = null;
const alEstado = new Set();
window.addEventListener("message", e => {
  if (e.source !== window.parent || e.origin !== location.origin || e.data?.canal !== PADRE) return;
  const d = e.data;
  if (d.tipo === "estado") { estado = d; for (const cb of alEstado) cb(d); }
  else if (d.tipo === "senal-mensaje") alMsj?.(d.de, d.m);
  else if (d.tipo === "senal-presentes") alPres?.(d.v);
  else if (d.tipo === "senal-entro") { esperando.get(d.id)?.(d.ok); esperando.delete(d.id); }
});

// ---------- la conexión con el rival ----------
let malla = null, rival = "", keep = 0;
const cola = [];   // paquetes que llegaron y el juego todavía no leyó

/* Abre la malla y espera a tener canal sano con `uidRival`. Resuelve true si conectó. */
function conecta(yo, uidRival) {
  rival = uidRival;
  return new Promise(ok => {
    let hecho = false;
    const fin = r => { if (!hecho) { hecho = true; clearTimeout(reloj); ok(r); } };
    malla = crearMalla({
      uid: yo, senal,
      quiere: u => u === rival,                     // solo el rival: nada de terceros en un uno contra uno
      alBinario: (u, bytes) => {
        if (u !== rival) return;
        if (cola.length > 1024) cola.shift();        // (un marco que se quedó atrás: los viejos vienen repetidos en los nuevos)
        cola.push(bytes);
        window.Module?.netWake?.();                  // el juego esperaba esto: que siga ya
      },
      alCambiar: () => { if (malla?.sano(rival)) fin(true); },
    });
    const reloj = setTimeout(() => fin(false), ESPERA_CONEXION);
    malla.entrar().then(r => { if (!r) fin(false); }, () => fin(false));
  }).then(ok => {
    if (ok) keep = setInterval(() => envia(KEEP), 500);
    return ok;
  });
}

function envia(bytes) {
  malla?.enviaBin(bytes, [rival]);
  return bytes.length;
}

function cierra() {
  clearInterval(keep);
  malla?.salir();
  malla = null;
}

window.BT3Sala = {
  activo: new URLSearchParams(location.search).get("modo") === "online",
  estado: () => estado,
  alEstado: cb => { alEstado.add(cb); if (estado) cb(estado); },
  avisa: (tipo, datos) => padre(tipo, datos),       // "listo", "disco", "termino"
  conecta, envia, cierra,
  recibe: () => cola.shift() || null,
  hay: () => cola.length > 0,
  sano: () => !!malla?.sano(rival),
};
