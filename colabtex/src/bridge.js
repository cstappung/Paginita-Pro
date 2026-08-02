"use strict";
/* ============================================================
   PUENTE CON EL DISCO — «Abrir en VS Code»

   Enlaza un proyecto de la NUBE con una carpeta real del disco y
   mantiene las dos copias sincronizadas en ambos sentidos mientras
   la pestaña siga abierta:

     Yjs  → disco : al observar cambios (propios o de colaboradores)
                    se reescribe el archivo afectado.
     disco → Yjs  : un sondeo cada segundo mira fechas de modificación
                    y, si algo cambió, calcula el diff mínimo y lo
                    aplica sobre el Y.Text.

   Por qué el diff mínimo y no un «borrar todo e insertar»: Yjs es un
   CRDT, y reemplazar el documento entero destruiría las ediciones
   simultáneas de otros y haría saltar sus cursores. Comparando
   prefijo y sufijo comunes, guardar en VS Code toca solo el trozo
   que de verdad cambió.

   El eco (escribo en disco → el sondeo lo ve → lo reinyecto en Yjs)
   se evita comparando CONTENIDO, no fechas: si el texto del disco ya
   coincide con el del Y.Text no hay nada que hacer. Las fechas solo
   sirven para no leer archivos en vano.

   Requiere File System Access API: Chrome, Edge y Opera de escritorio.
   ============================================================ */
import * as lfs from "./local-fs.js";
import { TEXT_EXT } from "./zip-import.js";
import { minimalDiff } from "./util.js";

const POLL_MS = 1000;        // sondeo del disco
const PUSH_MS = 300;         // retardo antes de volcar Yjs → disco

/* Marca las transacciones que nacen del disco. yCollab distingue por
   origen: con uno propio, estas ediciones no entran en el historial de
   deshacer del usuario ni se confunden con tecleo local. */
export const BRIDGE_ORIGIN = "colabtex-bridge";

/* ---------- lanzadores y el archivo que enseña la ruta ----------

   El navegador NUNCA revela la ruta absoluta de una carpeta (sería una
   fuga de información sobre el disco del usuario), y sin ella no se puede
   lanzar vscode://file/… ni claude://code/new?folder=…  Antes se le pedía
   al usuario que la pegara a mano, que es justo lo que sobra para alguien
   que sabe poco de computación.

   La salida: no preguntársela a él, sino al .bat. Un .bat sí sabe dónde
   vive (%~dp0), así que antes de abrir el editor deja su propia ruta
   escrita en PATHFILE, y el sondeo —que ya recorre la carpeta cada
   segundo— la recoge solo. Un doble clic, una vez en la vida de esa
   carpeta; después el botón de la web abre el editor directamente,
   también en sesiones futuras (la ruta se guarda junto al handle).

   La redirección va DELANTE del echo a propósito: %~dp0 termina en «\» y,
   pegado a «>», cmd lo parsea mal. Aun así el lado JS hace trim(). */
export const PATHFILE = ".colabtex-ruta";
export const LAUNCHER = "abrir-en-vscode.bat";
const LAUNCHER_BODY =
  "@echo off\r\nrem Creado por ColabTeX: abre esta carpeta en VS Code.\r\n" +
  ">\"%~dp0" + PATHFILE + "\" echo %~dp0\r\ncode \"%~dp0.\"\r\n";

export const LAUNCHER_CLAUDE = "abrir-en-claude.bat";
/* `call` porque `claude` suele ser un .cmd de npm: sin él, el .bat cede el
   control y no vuelve. */
const LAUNCHER_CLAUDE_BODY =
  "@echo off\r\nrem Creado por ColabTeX: abre esta carpeta con Claude Code.\r\n" +
  ">\"%~dp0" + PATHFILE + "\" echo %~dp0\r\ncd /d \"%~dp0\"\r\ncall claude\r\n";

/* Instrucciones para Claude Code. Se escriben una sola vez: si el usuario
   las edita, se respetan. */
const CLAUDE_MD = "CLAUDE.md";
const CLAUDE_MD_BODY = mainFile => `# Artículo LaTeX (ColabTeX)

Esta carpeta está sincronizada **en vivo** con ColabTeX, un editor
colaborativo en el navegador. Lo que guardes aquí sube solo en unos
segundos y lo ven los demás colaboradores; no hay ningún comando que
ejecutar para publicar.

- Archivo principal: \`${mainFile || "main.tex"}\`
- Se compila con pdfLaTeX.

## Reglas de esta carpeta

- **Haz cambios pequeños y localizados.** Reescribir un archivo entero
  destruye lo que otra persona esté escribiendo en ese mismo momento.
- **Borrar o mover un archivo aquí lo borra o lo mueve para todo el
  equipo.** Pregunta antes de hacerlo.
- No toques \`.aux\`, \`.log\`, \`.out\`, \`.pdf\` ni el resto de la basura de
  compilación: no se sincronizan y se regeneran solos.
- \`${LAUNCHER}\`, \`${LAUNCHER_CLAUDE}\` y \`${PATHFILE}\` los genera
  ColabTeX. Déjalos donde están.
- El artículo está escrito en español; responde y comenta en español.
`;

const isText = path => {
  const base = path.split("/").pop();
  return base.includes(".") && TEXT_EXT.includes(base.split(".").pop().toLowerCase());
};

/* Archivos que el puente genera: nunca suben al proyecto. Ojo con
   CLAUDE.md — «md» SÍ está en TEXT_EXT, así que sin esto aparecería en el
   árbol de todos los colaboradores y dentro del .zip. */
const IGNORE = new Set([LAUNCHER, LAUNCHER_CLAUDE, PATHFILE, CLAUDE_MD]);

/* ---------- diff mínimo sobre un Y.Text ----------
   `origin` marca de dónde viene el cambio. Por omisión, del disco; main.js
   lo llama con null cuando el cambio nace de la propia aplicación (reescribir
   referencias al mover un archivo), para que sí se vuelque al disco y entre
   en el historial de deshacer. */
export function applyTextToY(ytext, next, origin = BRIDGE_ORIGIN) {
  const cur = ytext.toString();
  if (cur === next) return false;
  const d = minimalDiff(cur, next);
  ytext.doc.transact(() => {
    if (d.to > d.from) ytext.delete(d.from, d.to - d.from);
    if (d.insert) ytext.insert(d.from, d.insert);
  }, origin);
  return true;
}

/* ---------- rutas absolutas ---------- */

/* Normaliza lo que venga: comillas del «Copiar como ruta» de Windows, el
   «\» final que deja %~dp0, el BOM y el salto de línea del echo. */
export function cleanPath(raw) {
  return String(raw || "")
    .replace(/^\uFEFF/, "")
    .split(/[\r\n]/)[0]
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim()
    .replace(/[\\/]+$/, "");
}

export function vscodeUrl(absPath) {
  let p = cleanPath(absPath).replace(/\\/g, "/");
  if (/^[a-zA-Z]:/.test(p)) p = "/" + p;      // D:/Tesis → /D:/Tesis
  if (!p.startsWith("/")) p = "/" + p;
  return "vscode://file" + encodeURI(p);
}

/* App de escritorio de Claude: abre una sesión de Code sobre la carpeta,
   con el prompt ya escrito. La carpeta que llega por enlace se trata
   siempre como no confiable, así que Claude pedirá confirmación — eso no
   se puede evitar desde aquí. */
export function claudeUrl(absPath, prompt) {
  const p = cleanPath(absPath);
  if (!p) return "";
  /* encodeURIComponent y NO URLSearchParams: este último codifica los
     espacios como «+» (formato de formulario), y quien lea el parámetro con
     decodeURIComponent se encontraría un «+» literal en medio del prompt y
     de la ruta. Con %20 no hay ambigüedad para ninguno de los dos lectores. */
  let u = "claude://code/new?folder=" + encodeURIComponent(p);
  if (prompt) u += "&q=" + encodeURIComponent(prompt);
  return u;
}

export function createBridge(hooks) {
  const H = Object.assign({
    onStatus() {}, onLog() {}, onTree() {},
    onPath() {},                    // se aprendió la ruta absoluta
    canWrite: () => true,           // rol «view» no debe subir nada
    newYText: () => null            // main.js provee el constructor de Y.Text
  }, hooks);

  let dir = null;             // FileSystemDirectoryHandle
  let yfiles = null;          // Y.Map ruta → Y.Text
  let projectId = null;
  let absPath = "";
  let mainFile = "";
  let pollTimer = null, pushTimer = null, unobserve = null;
  let running = false, ticking = false;

  /* ruta → {mtime, size} del último estado que conocemos del disco */
  const seen = new Map();
  /* rutas pendientes de volcar a disco */
  const outbox = new Set();

  const state = () => ({ running, folder: dir ? dir.name : "", absPath, files: seen.size });

  /* ---------- Yjs → disco ---------- */
  async function flushOutbox() {
    if (!running || !outbox.size) return;
    const paths = Array.from(outbox);
    outbox.clear();
    for (const p of paths) {
      const t = yfiles.get(p);
      if (!t) continue;
      const text = t.toString();
      try {
        const h = await lfs.writeText(dir, p, text);
        const f = await h.getFile();
        seen.set(p, { mtime: f.lastModified, size: f.size });
      } catch (e) {
        H.onLog("✗ No se pudo escribir «" + p + "» en el disco: " + (e.message || e));
      }
    }
    H.onStatus("VS Code · sincronizado", "#7ee0c2");
  }

  function queuePush(path) {
    outbox.add(path);
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flushOutbox, PUSH_MS);
  }

  function observe() {
    const handler = (events, tr) => {
      if (!running) return;
      // lo que acaba de llegar DEL disco no tiene que volver AL disco
      if (tr && tr.origin === BRIDGE_ORIGIN) return;
      for (const ev of events) {
        // cambio DENTRO de un archivo → ev.path es [ruta]
        if (ev.path && ev.path.length) { queuePush(String(ev.path[0])); continue; }
        // altas y bajas en el mapa de archivos
        if (ev.changes && ev.changes.keys) {
          for (const [key, ch] of ev.changes.keys) {
            if (ch.action === "delete") removeFromDisk(key);
            else queuePush(key);
          }
        }
      }
    };
    yfiles.observeDeep(handler);
    unobserve = () => yfiles.unobserveDeep(handler);
  }

  async function removeFromDisk(path) {
    if (!seen.has(path)) return;
    seen.delete(path);
    try {
      await lfs.deleteEntry(dir, path);
      H.onLog("↓ Borrado en el disco: " + path);
    } catch (e) { /* ya no estaba */ }
  }

  /* ---------- aprender la ruta que dejó el .bat ----------
     Solo mientras no la sepamos: en cuanto se aprende, se guarda junto al
     handle y esto no vuelve a leerse. */
  async function learnPath() {
    if (absPath || !dir) return;
    let txt = "";
    try {
      const h = await dir.getFileHandle(PATHFILE);
      txt = cleanPath(await lfs.readText(h));
    } catch (e) { return; }         // aún no lo han abierto: normal
    if (!txt) return;
    setPath(txt);
    H.onLog("💻 Ruta de la carpeta aprendida: " + txt);
    H.onStatus("VS Code · listo", "#7ee0c2");
    H.onPath(txt);
  }

  /* ---------- disco → Yjs ---------- */
  async function tick() {
    if (!running || ticking) return;
    ticking = true;
    try {
      await learnPath();
      const scan = await lfs.scanTextMeta(dir);
      const live = new Map();
      for (const [p, m] of scan.meta) if (isText(p) && !IGNORE.has(p)) live.set(p, m);

      /* Salvaguarda: si el escaneo vuelve vacío pero teníamos archivos,
         algo va mal (carpeta desmontada, permiso revocado, unidad de red
         caída). Borrar el proyecto entero de la nube por eso sería
         catastrófico, así que no se toca nada. */
      if (!live.size && seen.size) {
        H.onStatus("VS Code · carpeta no disponible", "#e2c08d");
        return;
      }

      let changed = 0, added = 0, removed = 0;

      for (const [p, m] of live) {
        const prev = seen.get(p);
        if (prev && prev.mtime === m.mtime && prev.size === m.size) continue;

        let text;
        try { text = await lfs.readText(m.handle); }
        catch (e) { continue; }
        seen.set(p, { mtime: m.mtime, size: m.size });

        const yt = yfiles.get(p);
        if (yt) {
          // comparar contenido: así el eco de nuestra propia escritura muere aquí
          if (applyTextToY(yt, text)) { changed++; H.onLog("↑ Desde el disco: " + p); }
        } else if (H.canWrite()) {
          const t = H.newYText();
          if (!t) continue;
          t.insert(0, text);
          yfiles.set(p, t);
          added++;
          H.onLog("↑ Archivo nuevo desde el disco: " + p);
        }
      }

      /* desaparecidos del disco → quitarlos también de la nube. Es la
         contrapartida simétrica de removeFromDisk(); sin ella, borrar un
         archivo en VS Code lo vería el sondeo siguiente como «archivo
         nuevo» y lo resucitaría en bucle. */
      if (H.canWrite()) {
        for (const p of Array.from(seen.keys())) {
          if (live.has(p)) continue;
          seen.delete(p);
          if (yfiles.has(p)) { yfiles.delete(p); removed++; H.onLog("↑ Borrado desde el disco: " + p); }
        }
      }

      if (changed || added || removed) {
        H.onTree();
        H.onStatus("VS Code · sincronizado", "#7ee0c2");
      }
    } catch (e) {
      H.onStatus("VS Code · error de lectura", "#e57373");
    } finally {
      ticking = false;
    }
  }

  /* ---------- espejo inicial ---------- */
  async function mirrorDown(getAssets, fetchAsset) {
    const paths = Array.from(yfiles.keys());
    let n = 0;
    for (const p of paths) {
      const t = yfiles.get(p);
      if (!t) continue;
      const h = await lfs.writeText(dir, p, t.toString());
      const f = await h.getFile();
      seen.set(p, { mtime: f.lastModified, size: f.size });
      n++;
      H.onStatus("Copiando al disco… " + n + "/" + paths.length, "#e2c08d");
    }

    /* Las imágenes también bajan: sin ellas la carpeta no compila en
       local y VS Code marcaría todos los \includegraphics en rojo. */
    const assets = (getAssets && getAssets()) || [];
    let a = 0;
    for (const asset of assets) {
      try {
        const bytes = await fetchAsset(asset);
        if (!bytes) continue;
        await lfs.writeBytes(dir, asset.name, bytes);
        a++;
        H.onStatus("Copiando imágenes… " + a + "/" + assets.length, "#e2c08d");
      } catch (e) {
        H.onLog("⚠ No se pudo copiar «" + asset.name + "» al disco: " + (e.message || e));
      }
    }

    try { await lfs.writeText(dir, LAUNCHER, LAUNCHER_BODY); } catch (e) {}
    try { await lfs.writeText(dir, LAUNCHER_CLAUDE, LAUNCHER_CLAUDE_BODY); } catch (e) {}

    /* CLAUDE.md solo si no existe: si el usuario lo ha adaptado, es suyo. */
    try {
      let hay = false;
      try { await dir.getFileHandle(CLAUDE_MD); hay = true; } catch (e) {}
      if (!hay) await lfs.writeText(dir, CLAUDE_MD, CLAUDE_MD_BODY(mainFile));
    } catch (e) {}

    return { texts: n, assets: a };
  }

  /* ---------- API pública ---------- */

  /* Comprueba qué archivos ya existen en la carpeta y difieren del
     proyecto: quien llama decide si sobrescribir. */
  async function inspect(dirHandle) {
    const scan = await lfs.scanTextMeta(dirHandle);
    const clashes = [];
    for (const [p, m] of scan.meta) {
      if (!isText(p) || IGNORE.has(p)) continue;
      clashes.push(p);
    }
    return { existing: clashes, assets: scan.assets.length };
  }

  async function start(opts) {
    const { dirHandle, yFiles, id, path, getAssets, fetchAsset } = opts;
    if (running) await stop();

    dir = dirHandle; yfiles = yFiles; projectId = id; absPath = path || "";
    mainFile = opts.mainFile || "";
    seen.clear(); outbox.clear();
    running = true;

    const counts = await mirrorDown(getAssets, fetchAsset);
    observe();
    await learnPath();          // por si el .bat ya se usó en otra ocasión
    pollTimer = setInterval(tick, POLL_MS);
    H.onStatus("VS Code · sincronizado", "#7ee0c2");
    H.onLog("💻 Carpeta enlazada: " + dir.name + " (" + counts.texts + " archivos, " + counts.assets + " imágenes)");
    lfs.saveBridge(projectId, dir, absPath).catch(() => {});
    return counts;
  }

  async function stop() {
    if (!running) return;
    running = false;
    clearInterval(pollTimer); pollTimer = null;
    clearTimeout(pushTimer); pushTimer = null;
    if (unobserve) { unobserve(); unobserve = null; }
    seen.clear(); outbox.clear();
    dir = null; yfiles = null;
  }

  function setPath(p) {
    absPath = p || "";
    if (projectId && dir) lfs.saveBridge(projectId, dir, absPath).catch(() => {});
  }

  return { start, stop, inspect, setPath, state, get running() { return running; }, get folder() { return dir ? dir.name : ""; }, get absPath() { return absPath; } };
}
