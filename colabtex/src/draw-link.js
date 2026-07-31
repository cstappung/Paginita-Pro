"use strict";
/* ============================================================
   ColabTeX ⇄ ColabDraw — figuras vinculadas

   Vincular un proyecto de dibujo a uno de LaTeX hace dos cosas:

   1. **Da acceso al dibujo a todo el equipo del artículo.** El vínculo
      guarda el token de invitación del proyecto de dibujo, así que cada
      colaborador se apunta solo la primera vez que abre el `.tex`. Es
      el mismo camino que un enlace para compartir —`joinWithToken`—, o
      sea que las reglas de seguridad no cambian ni una línea.

   2. **Trae sus figuras al árbol de archivos**, como recursos normales
      con `loc: "link"`. Todo lo de aguas abajo (vista previa, insertar
      `\includegraphics`, compilar, el .zip) funciona sin tocar nada,
      porque ya trabaja sobre `state.assets`.

   El vínculo vive en el **documento Yjs** (`Y.Map "links"`), no en un
   nodo propio de la base. Así se sincroniza solo con todo el equipo y
   no hace falta publicar reglas nuevas en la consola de Firebase, que
   es un paso manual y fácil de olvidar. Quien puede leer el documento
   es miembro del proyecto, exactamente la misma gente que podría leer
   ese nodo.

   NO se copian los bytes. La idea de copiarlos venía de que un
   colaborador del artículo podía no tener acceso al dibujo; con el
   vínculo lo tiene, así que la figura del PDF es siempre la última que
   se exportó, sin refrescos ni copias que se quedan viejas.
   ============================================================ */

export const LINK_DIR = "figuras";

/* Un nombre de carpeta que LaTeX acepte: \includegraphics no lleva bien
   los espacios ni los acentos. */
export function slugTitle(title) {
  const base = String(title || "dibujos")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // quita las tildes
    .replace(/[^\w-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "dibujos";
}

export const linkedPath = (title, name) => `${LINK_DIR}/${slugTitle(title)}/${name}`;

export const isLinked = a => !!a && a.loc === "link";

/* Recursos de un proyecto de dibujo → entradas del árbol del .tex. */
export function linkedAssets(link, assets) {
  return (assets || []).map(a => ({
    name: linkedPath(link.title, a.name),
    key: `link:${link.pid}:${a.key}`,
    size: a.size || 0,
    loc: "link",
    pid: link.pid,
    linkTitle: link.title,
    asset: a
  }));
}

/* ---------- el conjunto de vínculos de un proyecto ---------- */

export function createLinks(ydoc) {
  const map = ydoc.getMap("links");

  const norm = (pid, v) => ({
    pid,
    title: (v && v.title) || "Dibujos",
    token: (v && v.token) || "",
    role: (v && v.role) === "view" ? "view" : "edit",
    at: (v && v.at) || 0
  });

  return {
    map,
    list() {
      return Array.from(map.entries())
        .map(([pid, v]) => norm(pid, v))
        .sort((a, b) => a.title.localeCompare(b.title));
    },
    has: pid => map.has(pid),
    get: pid => (map.has(pid) ? norm(pid, map.get(pid)) : null),
    add(pid, { title, token, role }) {
      map.set(pid, {
        title: String(title || "Dibujos"),
        token: String(token || ""),
        role: role === "view" ? "view" : "edit",
        at: Date.now()
      });
    },
    remove: pid => map.delete(pid),
    observe(cb) {
      map.observe(cb);
      return () => { try { map.unobserve(cb); } catch (e) {} };
    }
  };
}

/* ---------- unirse a los proyectos vinculados ----------
   `deps` se pasa desde fuera (getProject / joinWithToken) para que esto
   se pueda probar sin Firebase. Devuelve los vínculos a los que de
   verdad se tiene acceso: si uno falla —el proyecto ya no existe, o le
   quitaron el token— se avisa y se sigue con el resto, que es mejor que
   dejar el árbol entero sin figuras. */
export async function ensureAccess(links, { uid, userName }, deps) {
  const { getProject, joinWithToken } = deps;
  const ok = [], fallos = [];
  for (const link of links) {
    try {
      let p = await getProject(link.pid, uid);
      if (!p || !p.role) {
        if (!link.token) throw new Error("el vínculo no trae invitación");
        await joinWithToken(link.pid, link.token, { uid, userName });
        p = await getProject(link.pid, uid);
      }
      if (!p || !p.role) throw new Error("sin acceso");
      ok.push(Object.assign({}, link, { title: p.title || link.title, role: p.role }));
    } catch (e) {
      fallos.push({ pid: link.pid, title: link.title, error: e.message || String(e) });
    }
  }
  return { ok, fallos };
}
