"use strict";
/* ============================================================
   ColabTeX — capa de datos sobre Firebase
   Realtime Database:
     users/<uid>                     perfil
     userProjects/<uid>/<pid>        índice de proyectos por usuario
     projects/<pid>/meta             título, propietario, fechas
     projects/<pid>/members/<uid>    {name, role, viaToken?}
     projects/<pid>/tokens           {edit, view} (enlaces compartidos)
     projects/<pid>/invites/<token>  {email, role}
     projects/<pid>/doc              snapshot + updates Yjs (ver y-rtdb.js)
     projects/<pid>/assetsIndex/<k>  índice de binarios
     tokenIndex/<token>              {pid, role} — para unirse por enlace
   Storage (con respaldo base64 en RTDB si Storage no está disponible):
     projects/<pid>/assets/<nombre>
   ============================================================ */
import { db, storage } from "./firebase.js";
import {
  ref, get, set, update, remove, push, serverTimestamp, onValue
} from "firebase/database";
import { ref as sRef, uploadBytes, getBytes, deleteObject } from "firebase/storage";
import * as Y from "yjs";
import { b64FromBytes, bytesFromB64 } from "./y-rtdb.js";

const randToken = () => {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
};

/* claves RTDB no admiten . # $ / [ ] */
export const encKey = name => encodeURIComponent(name).replace(/\./g, "%2E");
export const decKey = key => decodeURIComponent(key);

/* ---------- usuarios ---------- */
export async function ensureUserRecord(user, color) {
  await update(ref(db, "users/" + user.uid), {
    name: user.displayName || user.email || "Usuario",
    email: user.email || "",
    photo: user.photoURL || "",
    color,
    lastLogin: serverTimestamp()
  });
}

/* ---------- proyectos ---------- */
export async function createProject({ title, uid, userName, files }) {
  const pid = push(ref(db, "projects")).key;
  const tokens = { edit: randToken(), view: randToken() };

  // documento Yjs inicial → snapshot
  const doc = new Y.Doc();
  const map = doc.getMap("files");
  doc.transact(() => {
    for (const [name, contents] of Object.entries(files)) {
      const t = new Y.Text();
      t.insert(0, contents);
      map.set(name, t);
    }
  });
  const snapshot = b64FromBytes(Y.encodeStateAsUpdate(doc));
  doc.destroy();

  // 1) el proyecto completo en UNA sola escritura: las reglas ven al creador
  //    como owner dentro del mismo newData (un update multi-ruta se valida
  //    ruta por ruta y fallaría con permission_denied)
  await set(ref(db, `projects/${pid}`), {
    meta: {
      title, owner: uid, ownerName: userName,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    },
    members: { [uid]: { name: userName, role: "owner", addedAt: serverTimestamp() } },
    tokens,
    doc: { snapshot }
  });
  // 2) índices (ya somos miembros, las reglas lo permiten)
  try {
    await update(ref(db), {
      [`userProjects/${uid}/${pid}`]: true,
      [`tokenIndex/${tokens.edit}`]: { pid, role: "edit" },
      [`tokenIndex/${tokens.view}`]: { pid, role: "view" }
    });
  } catch (e) {
    await remove(ref(db, `projects/${pid}`)).catch(() => {});
    throw e;
  }
  return pid;
}

export async function listProjects(uid) {
  const idx = (await get(ref(db, "userProjects/" + uid))).val() || {};
  const out = [];
  await Promise.all(Object.keys(idx).map(async pid => {
    let meta, members;
    try {
      [meta, members] = await Promise.all([
        get(ref(db, `projects/${pid}/meta`)).then(s => s.val()),
        get(ref(db, `projects/${pid}/members`)).then(s => s.val())
      ]);
    } catch (e) {
      return; // proyecto borrado o acceso revocado: se omite del listado
    }
    if (!meta) return;
    out.push({
      id: pid, title: meta.title, ownerId: meta.owner, ownerName: meta.ownerName,
      updatedAt: meta.updatedAt || meta.createdAt || 0,
      memberCount: members ? Object.keys(members).length : 1,
      role: members && members[uid] ? members[uid].role : null
    });
  }));
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(pid, uid) {
  const [meta, members] = await Promise.all([
    get(ref(db, `projects/${pid}/meta`)).then(s => s.val()),
    get(ref(db, `projects/${pid}/members`)).then(s => s.val())
  ]);
  if (!meta) return null;
  const role = members && members[uid] ? members[uid].role : null;
  let tokens = null;
  if (role === "owner" || role === "edit") {
    tokens = (await get(ref(db, `projects/${pid}/tokens`))).val();
  }
  return {
    id: pid, title: meta.title, ownerId: meta.owner, ownerName: meta.ownerName,
    updatedAt: meta.updatedAt, mainFile: meta.mainFile || null, role, tokens,
    members: Object.entries(members || {}).map(([id, m]) => ({ uid: id, name: m.name, role: m.role }))
  };
}

export function touchProject(pid) {
  return update(ref(db, `projects/${pid}/meta`), { updatedAt: serverTimestamp() }).catch(() => {});
}

export function renameProject(pid, title) {
  return update(ref(db, `projects/${pid}/meta`), { title, updatedAt: serverTimestamp() });
}

/* title y/o mainFile (null borra la preferencia de archivo principal) */
export function updateProjectMeta(pid, { title, mainFile }) {
  const fields = { updatedAt: serverTimestamp() };
  if (title !== undefined) fields.title = title;
  if (mainFile !== undefined) fields.mainFile = mainFile;
  return update(ref(db, `projects/${pid}/meta`), fields);
}

/* ---------- miembros (configuración) ---------- */
export function setMemberRole(pid, memberUid, role) {
  return set(ref(db, `projects/${pid}/members/${memberUid}/role`), role);
}

export function removeMember(pid, memberUid) {
  return update(ref(db), {
    [`projects/${pid}/members/${memberUid}`]: null,
    [`userProjects/${memberUid}/${pid}`]: null
  });
}

export function leaveProject(pid, uid) {
  return update(ref(db), {
    [`projects/${pid}/members/${uid}`]: null,
    [`userProjects/${uid}/${pid}`]: null
  });
}

export async function deleteProject(pid) {
  const [members, tokens, invites, assetsIdx] = await Promise.all([
    get(ref(db, `projects/${pid}/members`)).then(s => s.val() || {}),
    get(ref(db, `projects/${pid}/tokens`)).then(s => s.val() || {}),
    get(ref(db, `projects/${pid}/invites`)).then(s => s.val() || {}),
    get(ref(db, `projects/${pid}/assetsIndex`)).then(s => s.val() || {})
  ]);
  // borrar binarios de Storage (los b64 caen con el nodo del proyecto)
  for (const [key, a] of Object.entries(assetsIdx)) {
    if (a.loc === "storage") {
      try { await deleteObject(sRef(storage, `projects/${pid}/assets/${decKey(key)}`)); } catch (e) {}
    }
  }
  const updates = {};
  for (const uid of Object.keys(members)) updates[`userProjects/${uid}/${pid}`] = null;
  for (const tok of Object.values(tokens)) updates[`tokenIndex/${tok}`] = null;
  for (const tok of Object.keys(invites)) updates[`tokenIndex/${tok}`] = null;
  updates[`projects/${pid}`] = null;
  updates[`presence/${pid}`] = null;
  await update(ref(db), updates);
}

export async function duplicateProject(pid, { uid, userName }) {
  const meta = (await get(ref(db, `projects/${pid}/meta`))).val();
  const docNode = (await get(ref(db, `projects/${pid}/doc`))).val() || {};
  // fusionar snapshot + updates pendientes en un solo snapshot
  const doc = new Y.Doc();
  if (docNode.snapshot) Y.applyUpdate(doc, bytesFromB64(docNode.snapshot));
  for (const u of Object.values(docNode.updates || {})) {
    try { Y.applyUpdate(doc, bytesFromB64(u.u)); } catch (e) {}
  }
  const snapshot = b64FromBytes(Y.encodeStateAsUpdate(doc));
  doc.destroy();

  const newPid = push(ref(db, "projects")).key;
  const tokens = { edit: randToken(), view: randToken() };
  // igual que en createProject: primero el proyecto entero, luego los índices
  await set(ref(db, `projects/${newPid}`), {
    meta: {
      title: (meta ? meta.title : "Proyecto") + " (copia)", owner: uid, ownerName: userName,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    },
    members: { [uid]: { name: userName, role: "owner", addedAt: serverTimestamp() } },
    tokens,
    doc: { snapshot }
  });
  try {
    await update(ref(db), {
      [`userProjects/${uid}/${newPid}`]: true,
      [`tokenIndex/${tokens.edit}`]: { pid: newPid, role: "edit" },
      [`tokenIndex/${tokens.view}`]: { pid: newPid, role: "view" }
    });
  } catch (e) {
    await remove(ref(db, `projects/${newPid}`)).catch(() => {});
    throw e;
  }

  // copiar assets
  const assetsIdx = (await get(ref(db, `projects/${pid}/assetsIndex`))).val() || {};
  for (const [key, a] of Object.entries(assetsIdx)) {
    if (a.loc === "rtdb") {
      await set(ref(db, `projects/${newPid}/assetsIndex/${key}`), a);
    } else {
      try {
        const bytes = await getBytes(sRef(storage, `projects/${pid}/assets/${decKey(key)}`));
        await uploadBytes(sRef(storage, `projects/${newPid}/assets/${decKey(key)}`), bytes);
        await set(ref(db, `projects/${newPid}/assetsIndex/${key}`), a);
      } catch (e) {}
    }
  }
  return newPid;
}

/* ---------- unirse por enlace / invitaciones ---------- */
export async function resolveToken(token) {
  if (!token) return null;
  return (await get(ref(db, `tokenIndex/${token}`))).val(); // {pid, role}
}

const ROLE_RANK = { view: 1, edit: 2, owner: 3 };

export async function joinWithToken(pid, token, { uid, userName }) {
  const info = await resolveToken(token);
  if (!info || info.pid !== pid) return null;
  const current = (await get(ref(db, `projects/${pid}/members/${uid}`))).val();
  if (current && ROLE_RANK[current.role] >= ROLE_RANK[info.role]) {
    await update(ref(db), { [`userProjects/${uid}/${pid}`]: true });
    return current.role;
  }
  const updates = {};
  updates[`projects/${pid}/members/${uid}`] = {
    name: userName, role: info.role, viaToken: token, addedAt: serverTimestamp()
  };
  updates[`userProjects/${uid}/${pid}`] = true;
  await update(ref(db), updates);
  return info.role;
}

export async function createInvite(pid, { email, role }) {
  const token = randToken();
  const r = role === "view" ? "view" : "edit";
  const updates = {};
  updates[`projects/${pid}/invites/${token}`] = { email: email || "", role: r, createdAt: serverTimestamp() };
  updates[`tokenIndex/${token}`] = { pid, role: r };
  await update(ref(db), updates);
  return { token, role: r, email };
}

/* ---------- assets binarios ---------- */
const RTDB_ASSET_LIMIT = 3 * 1024 * 1024; // 3 MB si hay que caer a base64

export async function uploadAsset(pid, name, bytes) {
  const key = encKey(name);
  try {
    await uploadBytes(sRef(storage, `projects/${pid}/assets/${name}`), bytes);
    await set(ref(db, `projects/${pid}/assetsIndex/${key}`), { name, size: bytes.byteLength, loc: "storage" });
  } catch (e) {
    // Storage no disponible (p. ej. plan Spark sin bucket): respaldo en RTDB
    if (bytes.byteLength > RTDB_ASSET_LIMIT)
      throw new Error("Storage no disponible y el archivo supera 3 MB: " + name);
    const b64 = b64FromBytes(new Uint8Array(bytes));
    await set(ref(db, `projects/${pid}/assetsIndex/${key}`), { name, size: bytes.byteLength, loc: "rtdb", b64 });
  }
  touchProject(pid);
}

export async function listAssets(pid) {
  const idx = (await get(ref(db, `projects/${pid}/assetsIndex`))).val() || {};
  return Object.entries(idx).map(([key, a]) => ({ key, name: a.name || decKey(key), size: a.size || 0, loc: a.loc }));
}

export async function fetchAssetBytes(pid, asset) {
  if (asset.loc === "rtdb") {
    const a = (await get(ref(db, `projects/${pid}/assetsIndex/${asset.key}`))).val();
    return bytesFromB64(a.b64);
  }
  const buf = await getBytes(sRef(storage, `projects/${pid}/assets/${asset.name}`));
  return new Uint8Array(buf);
}

export async function deleteAsset(pid, asset) {
  if (asset.loc === "storage") {
    try { await deleteObject(sRef(storage, `projects/${pid}/assets/${asset.name}`)); } catch (e) {}
  }
  await remove(ref(db, `projects/${pid}/assetsIndex/${asset.key}`));
  touchProject(pid);
}

/* miembros en vivo (para el modal compartir) */
export function watchMembers(pid, cb) {
  const r = ref(db, `projects/${pid}/members`);
  const unsub = onValue(r, snap => {
    const v = snap.val() || {};
    cb(Object.entries(v).map(([id, m]) => ({ uid: id, name: m.name, role: m.role })));
  });
  return unsub;
}
