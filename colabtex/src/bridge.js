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

const POLL_MS = 1000;        // sondeo del disco
const PUSH_MS = 300;         // retardo antes de volcar Yjs → disco

/* Marca las transacciones que nacen del disco. yCollab distingue por
   origen: con uno propio, estas ediciones no entran en el historial de
   deshacer del usuario ni se confunden con tecleo local. */
export const BRIDGE_ORIGIN = "colabtex-bridge";

/* Lanzador que no necesita saber la ruta absoluta: %~dp0 es la carpeta
   donde vive el propio .bat. */
const LAUNCHER = "abrir-en-vscode.bat";
const LAUNCHER_BODY = "@echo off\r\nrem Creado por ColabTeX: abre esta carpeta en VS Code.\r\ncode \"%~dp0.\"\r\n";

const isText = path => {
  const base = path.split("/").pop();
  return base.includes(".") && TEXT_EXT.includes(base.split(".").pop().toLowerCase());
};

/* Archivos que el puente genera o que LaTeX deja tirados: nunca suben. */
const IGNORE = new Set([LAUNCHER]);

/* ---------- diff mínimo sobre un Y.Text ---------- */
export function applyTextToY(ytext, next) {
  const cur = ytext.toString();
  if (cur === next) return false;

  const max = Math.min(cur.length, next.length);
  let pre = 0;
  while (pre < max && cur[pre] === next[pre]) pre++;
  let suf = 0;
  while (suf < max - pre && cur[cur.length - 1 - suf] === next[next.length - 1 - suf]) suf++;

  const delLen = cur.length - pre - suf;
  const ins = next.slice(pre, next.length - suf);
  ytext.doc.transact(() => {
    if (delLen > 0) ytext.delete(pre, delLen);
    if (ins) ytext.insert(pre, ins);
  }, BRIDGE_ORIGIN);
  return true;
}

/* ---------- URL de VS Code a partir de una ruta absoluta ---------- */
export function vscodeUrl(absPath) {
  let p = String(absPath || "").trim().replace(/^["']|["']$/g, "").replace(/\\/g, "/");
  p = p.replace(/\/+$/, "");
  if (/^[a-zA-Z]:/.test(p)) p = "/" + p;      // D:/Tesis → /D:/Tesis
  if (!p.startsWith("/")) p = "/" + p;
  return "vscode://file" + encodeURI(p);
}

export function createBridge(hooks) {
  const H = Object.assign({
    onStatus() {}, onLog() {}, onTree() {},
    canWrite: () => true,           // rol «view» no debe subir nada
    newYText: () => null            // main.js provee el constructor de Y.Text
  }, hooks);

  let dir = null;             // FileSystemDirectoryHandle
  let yfiles = null;          // Y.Map ruta → Y.Text
  let projectId = null;
  let absPath = "";
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

  /* ---------- disco → Yjs ---------- */
  async function tick() {
    if (!running || ticking) return;
    ticking = true;
    try {
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
    seen.clear(); outbox.clear();
    running = true;

    const counts = await mirrorDown(getAssets, fetchAsset);
    observe();
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
