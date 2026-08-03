/* Verificación de TODAS las operaciones contra las reglas de seguridad
   (Auth + Database emulados; FIREBASE_EMU=1). */
import { auth, db } from "./src/firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, get, set, push, remove } from "firebase/database";
import * as Y from "yjs";
import * as fb from "./src/fb-api.js";
import * as rep from "./src/fb-reports.js";
import { RtdbProvider, b64FromBytes } from "./src/y-rtdb.js";

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? "  ✓ " : "  ✗ FALLO: ") + name); };
const denied = async (name, fn) => {
  try { await fn(); ok(name + " (debía denegarse)", false); }
  catch (e) { ok(name, /PERMISSION_DENIED|permission/i.test(String(e))); }
};
const allowed = async (name, fn) => {
  try { await fn(); ok(name, true); }
  catch (e) { console.log("    error:", String(e).slice(0, 120)); ok(name, false); }
};

const A = { email: "ana@test.com", pass: "secret123" };
const B = { email: "beto@test.com", pass: "secret123" };

async function loginAs(u) {
  await signOut(auth).catch(() => {});
  try { const c = await signInWithEmailAndPassword(auth, u.email, u.pass); return c.user; }
  catch (e) { const c = await createUserWithEmailAndPassword(auth, u.email, u.pass); return c.user; }
}

console.log("— Usuario A: crear proyecto y operar —");
const userA = await loginAs(A);
await allowed("perfil de usuario propio", () => fb.ensureUserRecord(userA, "#0d9488"));
let pid = null;
await allowed("crear proyecto", async () => {
  pid = await fb.createProject({ title: "Reglas Test", uid: userA.uid, userName: "Ana", files: { "main.tex": "\\documentclass{article}\\begin{document}x\\end{document}" } });
});
const listA = await fb.listProjects(userA.uid);
ok("listado del propietario", listA.some(p => p.id === pid));
const projA = await fb.getProject(pid, userA.uid);
ok("propietario ve tokens", !!(projA.tokens && projA.tokens.edit && projA.tokens.view));
await allowed("propietario escribe update Yjs", () =>
  set(push(ref(db, `projects/${pid}/doc/updates`)), { u: "AAA=", t: Date.now(), by: 1 }));
await allowed("renombrar (propietario)", () => fb.renameProject(pid, "Reglas Test v2"));
let invite = null;
await allowed("crear invitación (edit)", async () => { invite = await fb.createInvite(pid, { email: "beto@test.com", role: "edit" }); });

console.log("— Usuario B sin acceso —");
const userB = await loginAs(B);
await denied("B no lee meta ajena", () => get(ref(db, `projects/${pid}/meta`)));
await denied("B no lee el documento ajeno", () => get(ref(db, `projects/${pid}/doc`)));
await denied("B no escribe en el documento ajeno", () =>
  set(push(ref(db, `projects/${pid}/doc/updates`)), { u: "AAA=", t: Date.now(), by: 2 }));
await denied("B no puede autoinvitarse con token falso", () =>
  set(ref(db, `projects/${pid}/members/${userB.uid}`), { name: "Beto", role: "edit", viaToken: "tokenfalso" }));

console.log("— Usuario B se une con enlace de SOLO LECTURA —");
const roleView = await fb.joinWithToken(pid, projA.tokens.view, { uid: userB.uid, userName: "Beto" });
ok("unirse con token view → rol view", roleView === "view");
await allowed("viewer lee meta", () => get(ref(db, `projects/${pid}/meta`)));
await allowed("viewer lee el documento", () => get(ref(db, `projects/${pid}/doc/snapshot`)));
await denied("viewer NO escribe el documento", () =>
  set(push(ref(db, `projects/${pid}/doc/updates`)), { u: "AAA=", t: Date.now(), by: 2 }));
await denied("viewer NO lee tokens de compartir", () => get(ref(db, `projects/${pid}/tokens`)));
await denied("viewer NO renombra", () => fb.renameProject(pid, "hackeado"));
await allowed("viewer publica presencia (cursores)", () =>
  set(ref(db, `presence/${pid}/12345`), { b64: "AA==", t: Date.now() }));

console.log("— Usuario B mejora a EDITOR con la invitación —");
const roleEdit = await fb.joinWithToken(pid, invite.token, { uid: userB.uid, userName: "Beto" });
ok("unirse con invitación edit → rol edit", roleEdit === "edit");
await allowed("editor escribe update Yjs", () =>
  set(push(ref(db, `projects/${pid}/doc/updates`)), { u: "AAA=", t: Date.now(), by: 2 }));
await allowed("editor renombra", () => fb.renameProject(pid, "Reglas Test v3"));
const projB = await fb.getProject(pid, userB.uid);
ok("editor ve tokens", !!(projB.tokens && projB.tokens.edit));
await allowed("editor sube asset (respaldo RTDB)", () => fb.uploadAsset(pid, "logo.png", new Uint8Array([137, 80, 78, 71]).buffer));
const assets = await fb.listAssets(pid);
ok("asset en índice (loc rtdb)", assets.length === 1 && assets[0].loc === "rtdb");
const bytes = await fb.fetchAssetBytes(pid, assets[0]);
ok("asset se recupera íntegro", bytes.length === 4 && bytes[0] === 137);
await denied("editor NO elimina el proyecto", () => remove(ref(db, `projects/${pid}`)));
await allowed("editor duplica el proyecto (como suyo)", async () => {
  const dupId = await fb.duplicateProject(pid, { uid: userB.uid, userName: "Beto" });
  const dup = await fb.getProject(dupId, userB.uid);
  ok("duplicado: B es owner", dup.role === "owner");
  await fb.deleteProject(dupId);
});

console.log("— Configuración y membresías —");
await allowed("editor fija el archivo principal", () => fb.updateProjectMeta(pid, { mainFile: "main.tex" }));
await denied("editor NO se autoasciende a owner", () =>
  set(ref(db, `projects/${pid}/members/${userB.uid}/role`), "owner"));
await allowed("editor abandona el proyecto", () => fb.leaveProject(pid, userB.uid));
await denied("tras abandonar ya no lee meta", () => get(ref(db, `projects/${pid}/meta`)));
await allowed("B se vuelve a unir con la invitación", async () => {
  const r = await fb.joinWithToken(pid, invite.token, { uid: userB.uid, userName: "Beto" });
  if (r !== "edit") throw new Error("rol inesperado: " + r);
});

await loginAs(A);
await allowed("owner cambia el rol de B a view", () => fb.setMemberRole(pid, userB.uid, "view"));
await allowed("owner devuelve el rol edit a B", () => fb.setMemberRole(pid, userB.uid, "edit"));
await allowed("owner quita a B del proyecto", () => fb.removeMember(pid, userB.uid));

await loginAs(B);
await denied("B expulsado no lee el documento", () => get(ref(db, `projects/${pid}/doc/snapshot`)));
await allowed("B se reincorpora con la invitación", () =>
  fb.joinWithToken(pid, invite.token, { uid: userB.uid, userName: "Beto" }));

console.log("— Sincronización Yjs completa entre A y B (con reglas) —");
const docB = new Y.Doc();
const provB = new RtdbProvider(pid, docB);
await new Promise(r => provB.once("synced", r));
docB.getMap("files").get("main.tex") || docB.getMap("files").set("main.tex", new Y.Text());
docB.getMap("files").get("main.tex").insert(0, "% B editor\n");
await new Promise(r => setTimeout(r, 1200));
provB.destroy();

await loginAs(A);
const docA = new Y.Doc();
const provA = new RtdbProvider(pid, docA);
await new Promise(r => provA.once("synced", r));
ok("A recibe la edición de B", docA.getMap("files").get("main.tex").toString().includes("% B editor"));
provA.destroy();

console.log("— Eliminación por el propietario —");
await allowed("propietario elimina el proyecto", () => fb.deleteProject(pid));
ok("tokenIndex limpio", (await get(ref(db, `tokenIndex/${projA.tokens.edit}`))).val() === null);
await loginAs(B);
ok("índice de B limpio", (await get(ref(db, `userProjects/${userB.uid}/${pid}`))).val() === null);
const listB = await fb.listProjects(userB.uid);
ok("listado de B no revienta tras el borrado", Array.isArray(listB) && !listB.some(p => p.id === pid));

console.log("— Informes: errores y sugerencias (nodos compartidos) —");
/* Estos dos nodos están FUERA del árbol de proyectos a propósito: los ve
   cualquiera con sesión, que es de lo que va un informe de equipo. Lo que
   sí se acota es el tamaño y quién puede tocar lo ajeno. */
const errRec = {
  app: "colabtex", donde: "compilar el documento", huella: "epruebas1",
  mensaje: "File `pgf.sty' not found", pila: ["f (colabtex-app.js:1:4)"],
  nav: "Chrome 141 · Windows 10/11", ver: "202608030427", at: Date.now()
};
const userA2 = await loginAs(A);
await allowed("A publica un error", () => rep.publishError(errRec, userA2.uid));
await allowed("A vuelve a publicarlo (suma)", () => rep.publishError(errRec, userA2.uid));
ok("el mismo error es UNA fila con contador 2",
  (await get(ref(db, "errors/epruebas1/veces"))).val() === 2);
await denied("nadie cuela un mensaje de 500 caracteres", () =>
  set(ref(db, "errors/egordo"), { app: "colabtex", at: Date.now(), mensaje: "x".repeat(500) }));

let fbId = null;
await allowed("A escribe una sugerencia", async () => {
  fbId = await rep.sendFeedback(
    { tipo: "idea", app: "colabdraw", titulo: "Duplicar una capa entera", cuerpo: "Me ahorraría rehacerla." },
    { uid: userA2.uid, userName: "Ana" });
});
await denied("A no puede firmar algo con el uid de otro", () =>
  set(ref(db, "feedback/falso"), { tipo: "bug", titulo: "x", uid: "otro-uid", at: Date.now() }));

const userB2 = await loginAs(B);
const todo = await rep.readAll();
ok("B ve el informe entero", todo.errores.length >= 1 && todo.feedback.some(f => f.id === fbId));
await allowed("B marca como resuelto lo de A", () => rep.setFeedbackState(fbId, "hecho"));
await denied("B NO puede reescribir el texto de A", () =>
  set(ref(db, `feedback/${fbId}/titulo`), "secuestrado"));
await denied("B NO puede borrar lo de A", () => rep.deleteFeedback(fbId));
await denied("un estado inventado no cuela", () => set(ref(db, `feedback/${fbId}/estado`), "loquesea"));

await loginAs(A);
await allowed("A sí borra lo suyo", () => rep.deleteFeedback(fbId));
await allowed("cualquiera puede quitar un error del informe", () => rep.deleteError("epruebas1"));

await signOut(auth);
await denied("sin sesión no se lee el informe", () => get(ref(db, "errors")));
await denied("sin sesión no se escribe nada", () => set(ref(db, "feedback/x"), { tipo: "bug", titulo: "x", uid: "x" }));

console.log(`\nRESULTADO: ${pass} correctas, ${fail} fallos`);
process.exit(fail ? 1 : 0);
