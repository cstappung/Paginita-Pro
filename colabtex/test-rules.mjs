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
await denied("un editor no fabrica un enlace de dueño", () =>
  set(ref(db, "tokenIndex/tokendueno"), { pid, role: "owner" }));
await denied("ni se nombra dueño con él", () =>
  set(ref(db, `projects/${pid}/members/${userB.uid}`), { name: "Beto", role: "owner", viaToken: "tokendueno" }));

console.log("— Registro de usuario privado, perfil público —");
await denied("B no lee el registro de A (su correo)", () => get(ref(db, `users/${userA.uid}`)));
await allowed("B escribe su perfil", () =>
  set(ref(db, `users/${userB.uid}/perfil`), { nick: "Beto", color: "#112233", at: Date.now() }));
await denied("un color con HTML no cuela", () =>
  set(ref(db, `users/${userB.uid}/perfil/color`), '"><img src=x onerror=alert(1)>'));
await denied("una foto javascript: no cuela", () =>
  set(ref(db, `users/${userB.uid}/perfil/foto`), "javascript:alert(1)"));
await denied("un campo inventado no cuela", () =>
  set(ref(db, `users/${userB.uid}/perfil/otro`), "x"));
await loginAs(A);
ok("A lee el perfil de B", (await get(ref(db, `users/${userB.uid}/perfil/nick`))).val() === "Beto");
await denied("A no lee el registro entero de B", () => get(ref(db, `users/${userB.uid}`)));
await loginAs(B);

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
await denied("B NO marca como resuelto lo de A (solo admins)", () => rep.setFeedbackState(fbId, "hecho"));
await denied("B NO borra un error del informe", () => rep.deleteError("epruebas1"));
await denied("B NO reescribe el mensaje de un error", () => set(ref(db, "errors/epruebas1/mensaje"), "otra cosa"));
await denied("B NO infla el contador", () => set(ref(db, "errors/epruebas1/veces"), 1000));
await allowed("B sí suma una vez", () => rep.publishError(errRec, userB2.uid));
await allowed("B lee el webhook de Discord (para anunciar sus salas)", () => get(ref(db, "discord")));
await denied("B NO puede reescribir el texto de A", () =>
  set(ref(db, `feedback/${fbId}/titulo`), "secuestrado"));
await denied("B NO puede borrar lo de A", () => rep.deleteFeedback(fbId));
await denied("un estado inventado no cuela", () => set(ref(db, `feedback/${fbId}/estado`), "loquesea"));

await loginAs(A);
await allowed("A marca como resuelto lo suyo", () => rep.setFeedbackState(fbId, "hecho"));
await allowed("A sí borra lo suyo", () => rep.deleteFeedback(fbId));
await denied("sin ser admin no se quita un error", () => rep.deleteError("epruebas1"));

console.log("— Monedas: días seguidos (diario) —");
{
  const { registraDia, diaChile } = await import("./src/juegos/monedas.js");
  const { serverTimestamp } = await import("firebase/database");
  const ua = await loginAs(A), hoy = diaChile();
  const apunta = reg => set(ref(db, `diario/${ua.uid}`), Object.assign({}, reg, { at: serverTimestamp() }));
  await remove(ref(db, `diario/${ua.uid}`)).catch(() => {});
  await denied("ni con el pago viejo de 10", () => apunta({ dia: hoy, racha: 1, mejor: 1, dias: 1, bono: 10 }));
  await denied("no se empieza con una racha inventada", () => apunta({ dia: hoy, racha: 5, mejor: 5, dias: 5, bono: 2500 }));
  await denied("no se apunta mañana", () => apunta(registraDia(null, hoy + 1)));
  await denied("ni un día de hace una semana", () => apunta(registraDia(null, hoy - 7)));
  await allowed("A apunta hoy", () => apunta(registraDia(null, hoy)));
  await denied("hoy no se apunta dos veces", () => apunta({ dia: hoy, racha: 2, mejor: 2, dias: 2, bono: 750 }));
  await denied("un campo de más no cuela", () => set(ref(db, `diario/${ua.uid}/extra`), 1));
  await loginAs(B);
  ok("B lee el diario de A (para el top)", (await get(ref(db, `diario/${ua.uid}/bono`))).val() === 250);
  await denied("B no escribe el diario de A", () => set(ref(db, `diario/${ua.uid}`), { dia: hoy, racha: 1, mejor: 1, dias: 1, bono: 250, at: serverTimestamp() }));
  await loginAs(A);
}

console.log("— Tienda del perfil —");
{
  const { serverTimestamp } = await import("firebase/database");
  const ua = await loginAs(A);
  const compra = (uid, item, p, extra) => set(ref(db, `tienda/${uid}/${item}`), Object.assign({ at: serverTimestamp(), p }, extra || {}));
  await denied("no se paga menos", () => compra(ua.uid, "cometa", 1));
  await denied("ni se compra lo que no existe", () => compra(ua.uid, "dorado", 5000));
  await denied("ni se elige la hora", () => set(ref(db, `tienda/${ua.uid}/cometa`), { at: 1700000000000, p: 5000 }));
  await denied("ni se cuela un campo", () => compra(ua.uid, "cometa", 5000, { gratis: true }));
  await allowed("A compra un marco", () => compra(ua.uid, "cometa", 5000));
  await denied("una compra no se reescribe", () => compra(ua.uid, "cometa", 5000));
  await denied("ni se borra (es gasto)", () => remove(ref(db, `tienda/${ua.uid}/cometa`)));
  const ub = await loginAs(B);
  ok("B lee la compra de A (para ver su marco)", (await get(ref(db, `tienda/${ua.uid}/cometa/p`))).val() === 5000);
  await denied("B no compra a nombre de A", () => compra(ua.uid, "olas", 5000));
  await allowed("B compra un fondo", () => compra(ub.uid, "olas", 5000));
  await loginAs(A);
}

console.log("— PRODROP: sobres y graduaciones —");
{
  const { serverTimestamp, push } = await import("firebase/database");
  const PM = (await import("../juegos/prodrop/motor.js")).default;
  const ua = await loginAs(A), precio = PM.precioSobre(Date.now());
  const sobre = (uid, p, extra) => set(push(ref(db, `cartas/s/${uid}`)), Object.assign({ at: serverTimestamp(), p }, extra || {}));
  await allowed("A compra un sobre al precio de hoy", () => sobre(ua.uid, precio));
  await denied("no se paga menos", () => sobre(ua.uid, precio - 1));
  await denied("ni se elige la hora (sin `now`)", () => set(push(ref(db, `cartas/s/${ua.uid}`)), { at: 1700000000000, p: precio }));
  await denied("ni se cuela un campo", () => sobre(ua.uid, precio, { dios: true }));
  const k = Object.keys((await get(ref(db, `cartas/s/${ua.uid}`))).val())[0];
  await denied("un sobre no se reescribe", () => set(ref(db, `cartas/s/${ua.uid}/${k}`), { at: serverTimestamp(), p: precio }));
  await denied("ni se borra (es gasto)", () => remove(ref(db, `cartas/s/${ua.uid}/${k}`)));
  const grad = (kk, i, p) => set(ref(db, `cartas/g/${ua.uid}/${kk}/${i}`), { at: serverTimestamp(), p });
  await denied("graduar cuesta 100, no 1", () => grad(k, 0, 1));
  await denied("no se gradúa la carta 7", () => grad(k, 7, 100));
  await denied("ni una carta de un sobre que no existe", () => grad("noexisteeste", 0, 100));
  await allowed("A gradúa la carta 4 de su sobre", () => grad(k, 4, 100));
  await denied("la misma carta no se gradúa dos veces", () => grad(k, 4, 100));
  await allowed("A exhibe esa carta en su perfil", () => set(ref(db, `users/${ua.uid}/perfil/cartas`), [k + ".4"]));
  await denied("una clave rara no se exhibe", () => set(ref(db, `users/${ua.uid}/perfil/cartas`), ["<img>.4"]));
  await loginAs(B);
  ok("B ve los sobres de A (para los mejores drops)", !!(await get(ref(db, `cartas/s/${ua.uid}/${k}`))).val());
  await denied("B no compra a nombre de A", () => sobre(ua.uid, precio));
  await denied("B no gradúa las cartas de A", () => set(ref(db, `cartas/g/${ua.uid}/${k}/3`), { at: serverTimestamp(), p: 100 }));
  await loginAs(A);
}

console.log("— PRODROP: sobre gratis, mercado e intercambios —");
{
  const { serverTimestamp, push, update } = await import("firebase/database");
  const ua = await loginAs(A);
  const gratis = () => { const k = push(ref(db, `cartas/s/${ua.uid}`)).key;
    return update(ref(db), { [`cartas/s/${ua.uid}/${k}`]: { at: serverTimestamp(), p: 0 }, [`cartas/gratis/${ua.uid}`]: { at: serverTimestamp(), k } }); };
  await remove(ref(db, `cartas/gratis/${ua.uid}`)).catch(() => {});
  await denied("un sobre a 0 sin el registro de gratis no cuela", () => set(push(ref(db, `cartas/s/${ua.uid}`)), { at: serverTimestamp(), p: 0 }));
  await allowed("A saca su sobre gratis", gratis);
  await denied("y otro gratis antes de 6 horas, no", gratis);
  await denied("el registro de gratis no se borra para empezar de nuevo", () => remove(ref(db, `cartas/gratis/${ua.uid}`)));
  const k = Object.keys((await get(ref(db, `cartas/s/${ua.uid}`))).val())[0], copia = `${ua.uid}~${k}.3`;
  const oferta = push(ref(db, "mercado/o"));
  await denied("no se vende a nombre de otro", () => set(oferta, { u: "otro123456", c: copia, p: 10, at: serverTimestamp() }));
  await denied("ni a precio 0", () => set(oferta, { u: ua.uid, c: copia, p: 0, at: serverTimestamp() }));
  await denied("ni con una venta ya puesta", () => set(oferta, { u: ua.uid, c: copia, p: 10, at: serverTimestamp(), v: { u: ua.uid, at: serverTimestamp() } }));
  await allowed("A pone una carta a la venta", () => set(oferta, { u: ua.uid, c: copia, p: 120, at: serverTimestamp() }));
  await denied("el precio no se cambia", () => set(ref(db, `mercado/o/${oferta.key}/p`), 1));
  await denied("A no se compra a sí mismo", () => set(ref(db, `mercado/o/${oferta.key}/v`), { u: ua.uid, at: serverTimestamp() }));
  const ub = await loginAs(B);
  await denied("B no retira la oferta de A", () => set(ref(db, `mercado/o/${oferta.key}/x`), serverTimestamp()));
  await denied("B no compra a nombre de otro", () => set(ref(db, `mercado/o/${oferta.key}/v`), { u: ua.uid, at: serverTimestamp() }));
  await allowed("B compra la oferta de A", () => set(ref(db, `mercado/o/${oferta.key}/v`), { u: ub.uid, at: serverTimestamp() }));
  await denied("nadie la compra dos veces", () => set(ref(db, `mercado/o/${oferta.key}/v`), { u: ub.uid, at: serverTimestamp() }));
  await loginAs(A);
  await denied("vendida, ya no se retira", () => set(ref(db, `mercado/o/${oferta.key}/x`), serverTimestamp()));
  const o2 = push(ref(db, "mercado/o"));
  await allowed("A pone otra", () => set(o2, { u: ua.uid, c: `${ua.uid}~${k}.2`, p: 50, at: serverTimestamp() }));
  await allowed("y la retira", () => set(ref(db, `mercado/o/${o2.key}/x`), serverTimestamp()));
  await loginAs(B);
  await denied("retirada, ya no se compra", () => set(ref(db, `mercado/o/${o2.key}/v`), { u: ub.uid, at: serverTimestamp() }));
  await loginAs(A);
  const t = push(ref(db, "mercado/t"));
  await denied("un intercambio no nace aceptado", () => set(t, { de: ua.uid, para: ub.uid, dar: [`${ua.uid}~${k}.1`], at: serverTimestamp(), ok: serverTimestamp() }));
  await denied("ni con uno mismo", () => set(t, { de: ua.uid, para: ua.uid, dar: [`${ua.uid}~${k}.1`], at: serverTimestamp() }));
  await allowed("A propone un intercambio a B", () => set(t, { de: ua.uid, para: ub.uid, dar: [`${ua.uid}~${k}.1`], pedir: [`${ua.uid}~${k}.3`], at: serverTimestamp() }));
  await denied("A no acepta por B", () => set(ref(db, `mercado/t/${t.key}/ok`), serverTimestamp()));
  await loginAs(B);
  await allowed("B lo acepta", () => set(ref(db, `mercado/t/${t.key}/ok`), serverTimestamp()));
  await denied("aceptado, ya no se cierra", () => set(ref(db, `mercado/t/${t.key}/x`), serverTimestamp()));
  await allowed("B gradúa una carta de un sobre de A (o = A)", () => set(ref(db, `cartas/g/${ub.uid}/${k}/3`), { at: serverTimestamp(), p: 100, o: ua.uid }));
  await loginAs(A);
}

console.log("— Monedas: partidas del club y podios —");
{
  const { registraJugadaClub, diaChile } = await import("./src/juegos/monedas.js");
  const { serverTimestamp } = await import("firebase/database");
  const ua = await loginAs(A), hoy = diaChile();
  const apunta = reg => set(ref(db, `clubJugadas/${ua.uid}/bbtan`), Object.assign({}, reg, { at: serverTimestamp() }));
  await remove(ref(db, `clubJugadas/${ua.uid}/bbtan`)).catch(() => {});
  await denied("no se empieza con muchas partidas", () => apunta({ dia: hoy, hoy: 1, total: 50 }));
  await denied("ni en un juego que no es del club", () => set(ref(db, `clubJugadas/${ua.uid}/uno`), { dia: hoy, hoy: 1, total: 1, at: serverTimestamp() }));
  let reg = registraJugadaClub(null, hoy, "bbtan");
  await allowed("A apunta su primera partida del club", () => apunta(reg));
  await denied("no se salta de a dos", () => apunta({ dia: hoy, hoy: reg.hoy + 2, total: reg.total + 2 }));
  for (let i = 0; i < 9; i++) { reg = registraJugadaClub(reg, hoy, "bbtan"); await set(ref(db, `clubJugadas/${ua.uid}/bbtan`), Object.assign({}, reg, { at: serverTimestamp() })); }
  ok("diez partidas hoy", reg.hoy === 10);
  await denied("la undécima de hoy ya no paga", () => apunta({ dia: hoy, hoy: 11, total: reg.total + 1 }));
  await denied("ni mañana", () => apunta({ dia: hoy + 1, hoy: 1, total: reg.total + 1 }));
  {
    const minas = r => set(ref(db, `clubJugadas/${ua.uid}/minas`), Object.assign({}, r, { at: serverTimestamp() }));
    await remove(ref(db, `clubJugadas/${ua.uid}/minas`)).catch(() => {});
    let m = registraJugadaClub(null, hoy, "minas");
    await minas(m);
    for (let i = 0; i < 14; i++) { m = registraJugadaClub(m, hoy, "minas"); await minas(m); }
    ok("en Mina Club pagan quince al día", m.hoy === 15);
    await denied("la decimosexta ya no", () => minas({ dia: hoy, hoy: 16, total: m.total + 1 }));
  }
  // podios: solo justo después del récord que nombra
  await set(ref(db, `soloRanks/club-bbtan-rondas/${ua.uid}`), { nombre: "A", puntos: 7, tiempo: 1000, partida: "partidaA1" }).catch(() => {});
  const fila = (await get(ref(db, `soloRanks/club-bbtan-rondas/${ua.uid}`))).val() || {};
  const cobra = (k, x) => set(ref(db, `podios/${ua.uid}/${k}`), Object.assign({ at: serverTimestamp() }, x));
  await denied("no se cobra un podio de un récord que no existe", () => cobra("otraPartida", { c: "club-bbtan-rondas", p: 1, q: "usuarioOtro1" }));
  await denied("ni a uno mismo", () => cobra(fila.partida, { c: "club-bbtan-rondas", p: 1, q: ua.uid }));
  await denied("ni un puesto 4", () => cobra(fila.partida, { c: "club-bbtan-rondas", p: 4, q: "usuarioOtro1" }));
  await allowed("A cobra el podio de su récord", () => cobra(fila.partida, { c: "club-bbtan-rondas", p: 1, q: "usuarioOtro1" }));
  await denied("y no lo cobra dos veces", () => cobra(fila.partida, { c: "club-bbtan-rondas", p: 1, q: "usuarioOtro2" }));
  await loginAs(B);
  await denied("B no cobra a nombre de A", () => set(ref(db, `podios/${ua.uid}/x123456`), { c: "club-bbtan-rondas", p: 1, q: "usuarioOtro1", at: serverTimestamp() }));
  await loginAs(A);
}

console.log("— PRODROP: re-roll —");
{
  const { serverTimestamp } = await import("firebase/database");
  const ua = await loginAs(A);
  const diez = Array.from({ length: 10 }, (_, i) => `${ua.uid}~-Nk00000000${i}.${i % 5}`);
  const r = push(ref(db, `cartas/r/${ua.uid}`));
  await denied("nueve no son un re-roll", () => set(r, { at: serverTimestamp(), c: diez.slice(0, 9) }));
  await denied("la hora no se inventa", () => set(r, { at: Date.now() - 5000, c: diez }));
  await denied("ni una copia mal escrita", () => set(r, { at: serverTimestamp(), c: [...diez.slice(0, 9), "<script>"] }));
  await allowed("A hace un re-roll con diez copias", () => set(r, { at: serverTimestamp(), c: diez }));
  await denied("y no lo reescribe", () => set(ref(db, `cartas/r/${ua.uid}/${r.key}/c/0`), diez[1]));
  await allowed("A gradúa la carta que salió", () => set(ref(db, `cartas/g/${ua.uid}/${r.key}/0`), { at: serverTimestamp(), p: 100 }));
  await denied("pero un re-roll tiene una sola carta", () => set(ref(db, `cartas/g/${ua.uid}/${r.key}/1`), { at: serverTimestamp(), p: 100 }));
  const ub = await loginAs(B);
  await denied("B no escribe re-rolls de A", () => set(push(ref(db, `cartas/r/${ua.uid}`)), { at: serverTimestamp(), c: diez }));
  await allowed("B gradúa la carta de A si la tiene (o = A)", () => set(ref(db, `cartas/g/${ub.uid}/${r.key}/0`), { at: serverTimestamp(), p: 100, o: ua.uid }));
  await loginAs(A);
}

console.log("— Salas dormidas: se cierran solas a las seis horas —");
{
  const { serverTimestamp } = await import("firebase/database");
  const ua = await loginAs(A);
  const SEIS = 6 * 3600e3;
  const sala = async (at, extra) => {
    const r = push(ref(db, "partidas"));
    await set(r, Object.assign({ juego: "reversi", estado: "esperando", anfitrion: ua.uid, at, cupo: 2,
      jugadores: { [ua.uid]: { nombre: "Ana", orden: 0 } } }, extra || {}));
    return r.key;
  };
  const vieja = await sala(Date.now() - SEIS - 60e3), nueva = await sala(Date.now() - 60e3), tocada = await sala(Date.now() - SEIS - 60e3);
  await allowed("un jugador apunta el toque de su sala", () => set(ref(db, `partidas/${tocada}/toque`), serverTimestamp()));
  await denied("el toque no se inventa", () => set(ref(db, `partidas/${tocada}/toque`), Date.now() + SEIS));
  await loginAs(B);
  const cierra = (k, x) => set(ref(db, `partidas/${k}/fin`), Object.assign({ ganador: "", motivo: "inactiva", at: Date.now() }, x || {}));
  await denied("B no apunta el toque de una sala ajena", () => set(ref(db, `partidas/${nueva}/toque`), serverTimestamp()));
  await denied("B no cierra una sala reciente", () => cierra(nueva));
  await denied("ni una vieja con jugadas recientes", () => cierra(tocada));
  await denied("ni dándole la victoria a alguien", () => cierra(vieja, { ganador: ua.uid }));
  await denied("ni con otro motivo", () => cierra(vieja, { motivo: "abandono" }));
  await denied("no pone el estado en fin antes de cerrarla", () => set(ref(db, `partidas/${vieja}/estado`), "fin"));
  await allowed("B cierra la sala dormida seis horas", () => cierra(vieja));
  await allowed("y la saca del vestíbulo", () => set(ref(db, `partidas/${vieja}/estado`), "fin"));
  await denied("pero no la reabre", () => set(ref(db, `partidas/${vieja}/estado`), "esperando"));
  await denied("ni toca su cierre", () => cierra(vieja, { motivo: "inactiva", at: 1 }));
  await loginAs(A);
}

console.log("— Yemas: la malla del directo (vivo/<pid>/rtc) —");
{
  const { update } = await import("firebase/database");
  const ua = await loginAs(A);
  const r = push(ref(db, "partidas"));
  await set(r, { juego: "yemas", estado: "esperando", anfitrion: ua.uid, at: Date.now(), cupo: 2,
    jugadores: { [ua.uid]: { nombre: "Ana", orden: 0 } } });
  const k = r.key;
  await denied("el jugador ya no escribe su huevo en la base (el respaldo viejo)", () => set(ref(db, `vivo/${k}/y/${ua.uid}`), { x: 1, q: 1 }));
  await denied("ni de un golpe, escribiendo todo el nodo", () => set(ref(db, `vivo/${k}/y`), { [ua.uid]: { x: 1 } }));
  await denied("ni por un update al padre", () => update(ref(db, `vivo/${k}`), { [`y/${ua.uid}`]: { x: 1 } }));
  await allowed("el jugador se presenta en la malla", () => set(ref(db, `vivo/${k}/rtc/en/${ua.uid}`), "s1"));
  const ub = await loginAs(B);
  await allowed("un mirón se presenta en la malla", () => set(ref(db, `vivo/${k}/rtc/en/${ub.uid}`), "s2"));
  await allowed("el mirón le manda señal al jugador", () => set(push(ref(db, `vivo/${k}/rtc/b/${ua.uid}`)), { de: ub.uid, t: "ice", s: "s2" }));
  await denied("el mirón no firma por otro", () => set(push(ref(db, `vivo/${k}/rtc/b/${ua.uid}`)), { de: ua.uid, t: "ice" }));
  await denied("el mirón no presenta a otro", () => set(ref(db, `vivo/${k}/rtc/en/${ua.uid}`), "x"));
  await denied("el mirón no escribe huevos", () => set(ref(db, `vivo/${k}/y/${ub.uid}`), { x: 1 }));
  await denied("ni borra los de la sala", () => remove(ref(db, `vivo/${k}/y`)));
  await allowed("el mirón lee vivo (vacío: no hay respaldo que descargar)", () => get(ref(db, `vivo/${k}/y/${ua.uid}`)));
  await allowed("y se va de la malla", () => remove(ref(db, `vivo/${k}/rtc/en/${ub.uid}`)));
  await loginAs(A);
  await allowed("el jugador lee y borra su buzón", () => remove(ref(db, `vivo/${k}/rtc/b/${ua.uid}`)));
  await set(ref(db, `partidas/${k}/fin`), { ganador: ua.uid, motivo: "bajas", at: Date.now() });
  await denied("con fin no se escribe el huevo", () => set(ref(db, `vivo/${k}/y/${ua.uid}`), { x: 2 }));
  await allowed("con fin se borran los huevos", () => remove(ref(db, `vivo/${k}/y`)));
  await allowed("y la malla", () => remove(ref(db, `vivo/${k}/rtc`)));
}

await signOut(auth);
await denied("sin sesión no se lee el informe", () => get(ref(db, "errors")));
await denied("sin sesión no se escribe nada", () => set(ref(db, "feedback/x"), { tipo: "bug", titulo: "x", uid: "x" }));

console.log(`\nRESULTADO: ${pass} correctas, ${fail} fallos`);
process.exit(fail ? 1 : 0);
