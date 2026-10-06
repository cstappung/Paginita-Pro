"use strict";
/* ============================================================
   Juegos — aviso de sala nueva en Discord

   Cada sala que se abre desde el vestíbulo se anuncia en un canal de
   Discord, y también cada récord de un club que sube a alguien al
   podio de su modalidad (ver `mensajePodio`) con un mensaje que lleva el juego, quién la abrió, lo que
   eligió y un botón para entrar. No hay bot ni servidor: es un
   *webhook* de Discord, y el `POST` lo hace el navegador de quien abre
   la sala (Discord responde a esa llamada con CORS, así que funciona
   desde GitHub Pages tal cual).

   La URL del webhook NO está en el código: vive en `discord/webhook`
   de la base, que solo pueden leer los que tienen sesión y no puede
   escribir nadie desde la web — se pega a mano en la consola
   (CONFIGURAR-FIREBASE.md). Así no aparece en el `juegos-app.js`
   público, y si alguien abusa de ella basta con crear otro webhook y
   cambiar el valor: ni build ni push. Sin valor ahí, no se anuncia
   nada y todo sigue igual.

   Tres decisiones:

   - **Nunca estorba.** El aviso sale después de crear la sala y sin
     esperarlo; un Discord caído, una URL borrada o unas reglas sin
     publicar se quedan en un `console.warn`. Una sala que no se pudo
     anunciar se juega igual.
   - **Solo desde el sitio publicado.** En `localhost` el enlace del
     botón no le sirve a nadie más, así que no se manda.
   - **El botón es un botón de enlace** (`style: 5`), el único que un
     webhook sin aplicación puede mandar, y solo si se pide
     `?with_components=true`. Si Discord lo rechaza se reintenta sin
     componentes: el título del mensaje ya es un enlace a la sala.

   `mensajeSala` es puro (sin DOM ni Firebase) y se prueba en Node.
   ============================================================ */
import { db } from "../firebase.js";
import { ref, get } from "firebase/database";

const WEBHOOK_OK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const recorta = (s, n) => {
  s = String(s == null ? "" : s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};

/* "#e03a2f" → 0xe03a2f, que es como Discord quiere el color. */
const colorInt = c => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
  return m ? parseInt(m[1], 16) : 0x5865f2;
};

/* El mensaje entero, listo para `JSON.stringify`.
   `sala` = {pid, juego, nombre (del juego), lema, color, icono,
             anfitrion, foto, cupo, opciones: [[etiqueta, valor]…],
             enlace, vestibulo, mencion} */
export function mensajeSala(sala) {
  const icono = sala.icono ? sala.icono + " " : "";
  const quien = recorta(sala.anfitrion || "Alguien", 80);
  const juego = recorta(sala.nombre || sala.juego, 80);
  const campos = [
    { name: "👑 Anfitrión", value: quien, inline: true },
    { name: "👥 Plazas", value: `**1** / ${sala.cupo || 2}`, inline: true }
  ];
  for (const [et, val] of (sala.opciones || []).slice(0, 6)) {
    campos.push({ name: "⚙️ " + recorta(et, 40), value: recorta(val, 80), inline: true });
  }
  const aviso = `🎮 **¡Sala nueva!** ${quien} te espera en **${juego}**`;
  const foto = /^https:\/\//.test(sala.foto || "") ? sala.foto : undefined;
  return {
    username: "Laboratorio · Juegos",
    content: (sala.mencion ? recorta(sala.mencion, 100) + " " : "") + aviso,
    embeds: [{
      author: { name: `${quien} abrió una sala`, icon_url: foto },
      title: recorta(`${icono}${juego}`, 200),
      url: sala.enlace,
      description: (sala.lema ? `*${recorta(sala.lema, 300)}*\n\n` : "") +
        "▶️ **Pulsa «Unirse a la sala»** y entra con tu cuenta de Google.",
      color: colorInt(sala.color),
      fields: campos,
      thumbnail: foto ? { url: foto } : undefined,
      footer: { text: "Laboratorio · Juegos · la sala se cierra sola al llenarse" },
      timestamp: new Date().toISOString()
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 5, label: "Unirse a la sala", emoji: { name: "🎮" }, url: sala.enlace },
        { type: 2, style: 5, label: "Ver todas las salas", emoji: { name: "🗂️" }, url: sala.vestibulo }
      ]
    }],
    /* Solo la mención que se configuró (p. ej. @here o un rol); lo que
       escriba alguien en su apodo no puede llamar a nadie. */
    allowed_mentions: { parse: sala.mencion ? ["everyone", "roles"] : [] }
  };
}

/* ---------- el podio de los clubs ----------
   Un récord individual (Mina Club, Snake Club, Tetris Club) que deja a
   su dueño en el top 3 de su modalidad se anuncia a lo grande. Solo
   cuando **sube de puesto**: mejorar la propia marca sin moverse del
   segundo lugar no es noticia, entrar al podio o pasar al primero sí. */

/* El mismo orden que la tabla del club (`solo/club.js`): más puntos,
   luego menos tiempo, y el uid para que un empate no baile. */
export const ordenSolo = (a, b) => b.puntos - a.puntos || a.tiempo - b.tiempo || String(a.uid).localeCompare(String(b.uid));

/* Puesto (1 = primero) de `uid` en `filas`, o 0 si no está. */
export function puestoSolo(filas, uid) {
  return [...filas].sort(ordenSolo).findIndex(f => f.uid === uid) + 1;
}

/* La tabla después del récord: la fila de `uid` sustituida por la nueva. */
export function conRecord(filas, uid, dato) {
  return filas.filter(f => f.uid !== uid).concat([Object.assign({ uid }, dato)]).sort(ordenSolo);
}

const MODALIDADES = {
  easy: "Fácil", medium: "Medio", hard: "Difícil",
  maraton: "Maratón", sprint: "Sprint (40 líneas)", ultra: "Ultra (2 min)",
  classic: "Clásico", arcade: "Arcade", portals: "Portales", reloj: "Contrarreloj",
  espejo: "Espejo", laberinto: "Laberinto",
  10: "del 1 al 10", 20: "del 1 al 20", 30: "del 1 al 30", rondas: "ronda máxima",
  chico: "tablero chico", mediano: "tablero mediano", grande: "tablero grande", gigante: "tablero gigante",
  racha: "racha diaria", puntos: "puntos totales", facil: "Fácil", medio: "Medio", dificil: "Difícil", 8: "8×8", 12: "12×12", 15: "15×15",
  torre: "Torre Batalla", palacio: "Palacio Batalla", fabrica: "Fábrica Batalla", 50: "Nivel 50", abierto: "Nivel Abierto", victorias: "victorias totales",
  experto: "Experto",  // la dificultad más alta del clásico de Sudoku Arcade
  travesia: "travesía", sinfin: "travesía sin fin", jornadas: "jornada más lejana",  // FANAL
  estrellas: "estrellas",  // Atasco
  carrera: "mejor carrera", distancia: "distancia"  // Metro Rush
};
const CLUBS = {
  minas: { nombre: "Mina Club", juego: "Buscaminas", icono: "💣", ruta: "minas" },
  snake: { nombre: "Snake Club", juego: "Snake", icono: "🐍", ruta: "snake" },
  tetris: { nombre: "Tetris Club", juego: "Tetris", icono: "🧱", ruta: "tetris" },
  sortem: { nombre: "sortEm", juego: "sortEm", icono: "🔢", ruta: "sortem" },
  bbtan: { nombre: "BBTAN", juego: "BBTAN", icono: "🟩", ruta: "bbtan" },
  sopa: { nombre: "Sopa de letras", juego: "Sopa de letras", icono: "🔤", ruta: "sopa" },
  electro: { nombre: "Electrodle", juego: "Electrodle", icono: "⚡", ruta: "electro" },
  frontera: { nombre: "Frontera Batalla", juego: "Frontera Batalla", icono: "🏰", ruta: "frontera" },
  sudoku: { nombre: "Sudoku Arcade", juego: "Sudoku Arcade", icono: "🔢", ruta: "sudoku" },
  fanal: { nombre: "FANAL", juego: "FANAL", icono: "🪔", ruta: "fanal" },
  atasco: { nombre: "Atasco", juego: "Atasco", icono: "🚗", ruta: "atasco" },
  aleteo: { nombre: "ALETEO", juego: "ALETEO", icono: "🐦", ruta: "aleteo" },
  metrorush: { nombre: "Metro Rush", juego: "Metro Rush", icono: "🚇", ruta: "metrorush" }
};

/* "club-snake-arcade-grande" → {club, modalidad: "Arcade · tablero grande"} */
export function categoriaLegible(cat) {
  const m = /^club-(minas|snake|tetris|sortem|bbtan|sopa|electro|frontera|sudoku|fanal|atasco|aleteo|metrorush)-(.+)$/.exec(String(cat || ""));
  if (!m) return null;
  return { club: CLUBS[m[1]], modalidad: m[2].split("-").map(k => MODALIDADES[k] || k).join(" · ") };
}

const reloj = ms => {
  const t = Math.max(0, Math.round(ms / 10)), cs = t % 100, s = Math.floor(t / 100) % 60, min = Math.floor(t / 6000);
  return `${min}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};
/* Lo que se lee de una marca: en el buscaminas y el sprint manda el
   tiempo (los puntos son fijos), en el resto los puntos. */
export function marcaSolo(cat, f) {
  if (cat === "club-sopa-racha" || cat === "club-electro-racha" || cat === "club-sudoku-racha") return `🔥 ${f.puntos} ${f.puntos === 1 ? "día" : "días"} seguidos`;
  if (cat === "club-frontera-victorias") return `🏰 ${Number(f.puntos).toLocaleString("es-CL")} victorias`;
  if (/^club-frontera-/.test(cat)) return `🏰 ${f.puntos} ${f.puntos === 1 ? "combate seguido" : "combates seguidos"}`;
  if (cat === "club-electro-puntos") return `⚡ ${Number(f.puntos).toLocaleString("es-CL")} pts`;
  // El arcade del sudoku se lee en puntos, con su mando de recreativa.
  if (cat === "club-sudoku-arcade") return `🕹️ ${Number(f.puntos).toLocaleString("es-CL")} pts`;
  // El clásico del sudoku (puntos fijos en 1) compite por tiempo, como el buscaminas.
  if (/^club-minas-|^club-sortem-|^club-sopa-|^club-sudoku-(facil|medio|dificil|experto)$|^club-tetris-sprint$/.test(cat)) return `⏱️ ${reloj(f.tiempo)}`;
  if (/^club-bbtan-/.test(cat)) return `🟩 Ronda ${f.puntos}`;
  // FANAL: la jornada más lejana se dice en jornadas; la travesía y el sin fin, en puntos.
  if (cat === "club-fanal-jornadas") return `🪔 Jornada ${f.puntos}`;
  if (/^club-fanal-/.test(cat)) return `🪔 ${Number(f.puntos).toLocaleString("es-CL")} pts`;
  // Atasco: las estrellas juntadas en todos los niveles.
  if (cat === "club-atasco-estrellas") return `🚗 ${f.puntos} ★`;
  // ALETEO: los tubos pasados en el mejor vuelo.
  if (cat === "club-aleteo-vuelo") return `🐦 ${f.puntos} ${f.puntos === 1 ? "tubo" : "tubos"}`;
  // Metro Rush: la distancia se dice en metros; la mejor carrera, en puntos.
  if (cat === "club-metrorush-distancia") return `🚇 ${Number(f.puntos).toLocaleString("es-CL")} m`;
  if (cat === "club-metrorush-carrera") return `🚇 ${Number(f.puntos).toLocaleString("es-CL")} pts`;
  return `${Number(f.puntos).toLocaleString("es-CL")} pts`;
}

const MEDALLA = ["🥇", "🥈", "🥉"];
const COLOR_PUESTO = [0xf5c518, 0xc9d1d9, 0xcd7f32];
const TITULAR = [
  "👑 ¡HAY NUEVO NÚMERO 1! 👑",
  "🥈 ¡NUEVO SEGUNDO LUGAR EN EL PODIO! 🥈",
  "🥉 ¡ALGUIEN SE COLÓ EN EL PODIO! 🥉"
];

/* `p` = {categoria, uid, nombre, foto, puesto, antes (puesto previo, 0 si
   no tenía), filas (la tabla ya con el récord), desbancado (nombre o ""),
   enlace, mencion} */
export function mensajePodio(p) {
  const leg = categoriaLegible(p.categoria);
  if (!leg || p.puesto < 1 || p.puesto > 3) return null;
  const i = p.puesto - 1, quien = recorta(p.nombre || "Alguien", 80);
  const yo = p.filas.find(f => f.uid === p.uid) || {};
  const podio = p.filas.slice(0, 3).map((f, k) => {
    const n = recorta(f.nombre || "Alguien", 60);
    return `${MEDALLA[k]} ${f.uid === p.uid ? `**${n}**` : n} — ${marcaSolo(p.categoria, f)}`;
  }).join("\n");
  const subida = p.antes ? `Venía del puesto #${p.antes}` : "Entra al ranking directo al podio";
  const foto = /^https:\/\//.test(p.foto || "") ? p.foto : undefined;
  const campos = [
    { name: "🎯 Marca", value: `**${marcaSolo(p.categoria, yo)}**`, inline: true },
    { name: "📈 Subida", value: subida, inline: true }
  ];
  if (p.desbancado) campos.push({ name: "💥 Desbanca a", value: recorta(p.desbancado, 80), inline: true });
  campos.push({ name: "🏆 Podio actual", value: podio || "—", inline: false });
  return {
    username: "Laboratorio · Juegos",
    content: (p.mencion ? recorta(p.mencion, 100) + " " : "") +
      `# ${TITULAR[i]}\n**${quien}** acaba de ${p.puesto === 1 ? "tomar el trono" : "subir al podio"} de **${leg.club.juego} · ${leg.modalidad}** 🎉`,
    embeds: [{
      author: { name: `${leg.club.nombre} · récord individual`, icon_url: foto },
      title: recorta(`${MEDALLA[i]} ${quien} — puesto #${p.puesto}`, 200),
      url: p.enlace,
      description: `${leg.club.icono} **${leg.club.juego}** · ${leg.modalidad}\n\n` +
        (p.puesto === 1 ? "Nadie en el Laboratorio lo ha hecho mejor. ¿Quién se atreve?" : "¿Alguien puede bajarle del podio?"),
      color: COLOR_PUESTO[i],
      fields: campos,
      thumbnail: foto ? { url: foto } : undefined,
      footer: { text: "Laboratorio · Juegos · ranking por modalidad" },
      timestamp: new Date().toISOString()
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 5, label: "Intentar superarlo", emoji: { name: "⚔️" }, url: p.enlace }
      ]
    }],
    allowed_mentions: { parse: p.mencion ? ["everyone", "roles"] : [] }
  };
}

let config = null;   // la promesa de `discord/`, leída una vez por pestaña

function leeConfig() {
  if (!config) config = get(ref(db, "discord")).then(s => s.val() || {}).catch(e => {
    config = null;   // un fallo de red no apaga el aviso para siempre
    throw e;
  });
  return config;
}

const enLocal = () => /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);

/* Manda el aviso. No lanza nunca: se llama sin `await`. */
export function anunciaSala(sala) {
  return manda(cfg => mensajeSala(Object.assign({ mencion: cfg.mencion || "" }, sala)));
}

/* `p` como en `mensajePodio`, sin `mencion` (sale de la configuración). */
export function anunciaPodio(p) {
  return manda(cfg => mensajePodio(Object.assign({ mencion: cfg.mencion || "" }, p)));
}

async function manda(arma) {
  try {
    if (enLocal()) return;
    const cfg = await leeConfig();
    const url = String(cfg.webhook || "").trim();
    if (!WEBHOOK_OK.test(url)) return;
    const cuerpo = arma(cfg);
    if (!cuerpo) return;
    const post = (u, c) => fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c)
    });
    let r = await post(url + "?with_components=true", cuerpo);
    if (r.status === 400) {
      delete cuerpo.components;
      r = await post(url, cuerpo);
    }
    if (!r.ok) console.warn("Discord no aceptó el aviso:", r.status);
  } catch (e) {
    console.warn("No se pudo avisar en Discord:", e && e.message);
  }
}
