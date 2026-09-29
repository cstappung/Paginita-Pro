"use strict";
/* ============================================================
   Juegos — aviso de sala nueva en Discord

   Cada sala que se abre desde el vestíbulo se anuncia en un canal de
   Discord con un mensaje que lleva el juego, quién la abrió, lo que
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
export async function anunciaSala(sala) {
  try {
    if (enLocal()) return;
    const cfg = await leeConfig();
    const url = String(cfg.webhook || "").trim();
    if (!WEBHOOK_OK.test(url)) return;
    const cuerpo = mensajeSala(Object.assign({ mencion: cfg.mencion || "" }, sala));
    const manda = (u, c) => fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c)
    });
    let r = await manda(url + "?with_components=true", cuerpo);
    if (r.status === 400) {
      delete cuerpo.components;
      r = await manda(url, cuerpo);
    }
    if (!r.ok) console.warn("Discord no aceptó el aviso de sala:", r.status);
  } catch (e) {
    console.warn("No se pudo avisar en Discord:", e && e.message);
  }
}
