import * as Y from "yjs";
const P = (window.__fakeProjects ||= {});
const A = (window.__fakeAssets ||= {});
export const encKey = n => encodeURIComponent(n).replace(/\./g, "%2E");
export const decKey = k => decodeURIComponent(k);
export const KIND_TEX = "tex", KIND_DRAW = "draw";
export const kindOf = m => (m && m.kind) || KIND_TEX;
export async function ensureUserRecord() {}
let n = 0;
export async function createProject({ title, uid, userName, files, kind, init }) {
  const id = "p" + (++n) + Date.now().toString(36);
  const doc = new Y.Doc();
  if (files) { const f = doc.getMap("files"); for (const [k, v] of Object.entries(files)) f.set(k, new Y.Text(v)); }
  if (init) init(doc);
  P[id] = { id, title, kind: kind || KIND_TEX, owner: uid, ownerName: userName, updatedAt: Date.now(), update: Y.encodeStateAsUpdate(doc) };
  A[id] = {};
  return id;
}
const out = p => ({ id: p.id, title: p.title, ownerId: p.owner, ownerName: p.ownerName, kind: p.kind, updatedAt: p.updatedAt, memberCount: 1, role: "owner", mainFile: p.mainFile || null, tokens: { edit: "te", view: "tv" }, members: [{ uid: "u1", name: "Tester", role: "owner" }] });
export async function listProjects() { return Object.values(P).map(out).sort((a, b) => b.updatedAt - a.updatedAt); }
export async function getProject(pid) { return P[pid] ? out(P[pid]) : null; }
export function touchProject(pid) { if (P[pid]) P[pid].updatedAt = Date.now(); }
export async function renameProject(pid, t) { P[pid].title = t; }
export async function updateProjectMeta(pid, { title, mainFile }) { if (title) P[pid].title = title; if (mainFile !== undefined) P[pid].mainFile = mainFile; }
export async function setMemberRole() {} export async function removeMember() {} export async function leaveProject(pid) { delete P[pid]; }
export async function deleteProject(pid) { delete P[pid]; }
export async function duplicateProject(pid, { uid, userName }) { const s = P[pid]; const id = s.id + "c"; P[id] = { ...s, id, title: s.title + " (copia)" }; A[id] = { ...A[pid] }; return id; }
export async function resolveToken() { return null; }
export async function joinWithToken() {}
export async function createInvite() { return "inv"; }
export async function uploadAsset(pid, name, bytes) { A[pid][encKey(name)] = { name, size: bytes.byteLength, loc: "storage", bytes: new Uint8Array(bytes) }; window.dispatchEvent(new Event("fake-assets")); }
const lst = pid => Object.entries(A[pid] || {}).map(([key, a]) => ({ key, name: a.name, size: a.size, loc: a.loc }));
export async function listAssets(pid) { return lst(pid); }
export function watchAssets(pid, cb) { const f = () => cb(lst(pid)); f(); window.addEventListener("fake-assets", f); return () => window.removeEventListener("fake-assets", f); }
export async function fetchAssetBytes(pid, asset) { const a = A[pid][asset.key || encKey(asset.name)]; if (!a) throw new Error("no existe"); return a.bytes.slice(); }
export async function renameAsset(pid, asset, newName) { const a = A[pid][asset.key]; delete A[pid][asset.key]; A[pid][encKey(newName)] = { ...a, name: newName }; }
export async function deleteAsset(pid, asset) { delete A[pid][asset.key]; window.dispatchEvent(new Event("fake-assets")); }
export function watchMembers(pid, cb) { cb([{ uid: "u1", name: "Tester", role: "owner" }]); return () => {}; }
