#!/usr/bin/env node
"use strict";
/* ============================================================
   Pruebas de ColabTeX y ColabDraw con navegador y motor real.

     npm run test:colab-navegador              todo (~8 min)
     npm run test:colab-navegador -- --rapido  batería corta (~3 min)
     … -- --solo=seguridad,dibujo              solo esos grupos

   Grupos: seguridad · dibujo · nube · local · bateria · rapida

   Cómo funciona: las dos apps se empaquetan con Firebase, la base de
   datos y el proveedor de Yjs sustituidos por imitaciones en memoria
   (imitaciones/), así que el panel, el editor, la compilación y la
   exportación corren de verdad sin cuenta ni red. El modo local usa el
   sistema de archivos privado del navegador (OPFS) en lugar de una
   carpeta del disco. Necesita Playwright con Chromium:
   `npx playwright install chromium` si no está.
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");
const express = require("express");
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }

const COLABTEX = path.resolve(__dirname, "../..");
const ROOT = path.resolve(COLABTEX, "..");
const IMIT = path.join(__dirname, "imitaciones");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "colab-pruebas-"));
const args = process.argv.slice(2);
const RAPIDO = args.includes("--rapido");
const SOLO = (args.find(a => a.startsWith("--solo=")) || "").slice(7).split(",").filter(Boolean);
const quiero = g => !SOLO.length || SOLO.includes(g);

/* ---------- bundles con imitaciones ---------- */
const imitar = { name: "imitar", setup(b) {
  b.onResolve({ filter: /^\.\.?\/(firebase|fb-api|y-rtdb|fb-reports)\.js$/ }, a => {
    if (a.importer.startsWith(IMIT)) return;
    return { path: path.join(IMIT, a.path.match(/(firebase|fb-api|y-rtdb|fb-reports)\.js$/)[0]) };
  });
} };
async function empaqueta(entrada, salida, conImitaciones = true) {
  await esbuild.build({
    entryPoints: [path.join(COLABTEX, entrada)], bundle: true, format: "iife", target: "es2020",
    outfile: path.join(TMP, salida), plugins: conImitaciones ? [imitar] : [], nodePaths: [path.join(COLABTEX, "node_modules")],
    logLevel: "error", absWorkingDir: COLABTEX
  });
  return path.join(TMP, salida);
}

/* ---------- informe ---------- */
const fallos = [];
let pasadas = 0;
const ok = (grupo, nombre, detalle = "") => { pasadas++; console.log(`  ✓ ${nombre}${detalle ? "  " + detalle : ""}`); };
const mal = (grupo, nombre, detalle) => { fallos.push(`[${grupo}] ${nombre}: ${detalle}`); console.log(`  ✗ ${nombre}  ${detalle}`); };
const comprueba = (grupo, nombre, cond, detalle = "") => cond ? ok(grupo, nombre, detalle) : mal(grupo, nombre, detalle || "falló");

async function nuevaPagina(browser, { app, bundle, initScript, initArg } = {}) {
  const p = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  p.errores = [];
  p.on("pageerror", e => p.errores.push(e.message));
  p.on("dialog", d => d.accept(d.type() === "prompt" ? (p.siguiente || d.defaultValue() || "x") : undefined).then(() => { p.siguiente = null; }));
  await p.route(/googleapis|gstatic|firebase|googletagmanager|www\.google\.com/, r => r.abort());
  if (app) await p.route(`**/${app}*`, r => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(bundle, "utf8") }));
  if (initScript) await p.addInitScript(initScript, initArg);
  return p;
}

/* ---------- grupos ---------- */
async function seguridad(browser, base, B) {
  console.log("\n▸ seguridad");
  const Y = require(path.join(COLABTEX, "node_modules/yjs"));
  // ColabDraw: nodos escritos a mano en el Y.Doc compartido
  const doc = new Y.Doc(), frag = new Y.XmlFragment();
  doc.getMap("drawings").set("malo.svg", frag);
  const svg = new Y.XmlElement("svg"); svg.setAttribute("viewBox", "0 0 160 120"); svg.setAttribute("width", "160mm"); svg.setAttribute("height", "120mm");
  const g = new Y.XmlElement("g"); g.setAttribute("data-layer", "Capa 1"); g.setAttribute("id", "l1");
  const img = new Y.XmlElement("image"); img.setAttribute("href", "x:"); img.setAttribute("onerror", "window.__pwned=(window.__pwned||[]).concat('onerror')");
  const scr = new Y.XmlElement("script"); scr.insert(0, [new Y.XmlText("window.__pwned=(window.__pwned||[]).concat('script')")]);
  const rect = new Y.XmlElement("rect"); rect.setAttribute("id", "r1"); rect.setAttribute("width", "50"); rect.setAttribute("height", "50");
  rect.setAttribute("onmouseover", "window.__pwned=(window.__pwned||[]).concat('onmouseover')");
  g.insert(0, [img, scr, rect]); svg.insert(0, [g]); frag.insert(0, [svg]);
  const p = await nuevaPagina(browser, { app: "colabdraw-app.js", bundle: B.draw, initArg: Array.from(Y.encodeStateAsUpdate(doc)),
    initScript: u => { window.__fakeProjects = { pmalo: { id: "pmalo", title: "Compartido", kind: "draw", owner: "u2", ownerName: "Otro", updatedAt: Date.now(), update: new Uint8Array(u) } }; window.__fakeAssets = { pmalo: {} }; } });
  await p.goto(base + "/colabdraw.html?p=pmalo");
  await p.waitForSelector("#viewEditor", { state: "visible", timeout: 15000 });
  await p.waitForTimeout(1200);
  const rb = await p.locator('#canvasHost rect[id="r1"]').boundingBox().catch(() => null);
  if (rb) { await p.mouse.move(rb.x + 10, rb.y + 10); await p.waitForTimeout(200); }
  const vivo = await p.evaluate(() => {
    const layer = window.__fakeDocs.pmalo.getMap("drawings").get("malo.svg").get(0).get(0);
    const El = layer.constructor, Tx = layer.get(1).get(0).constructor;
    const s2 = new El("script"); s2.insert(0, [new Tx("window.__pwned=(window.__pwned||[]).concat('vivo')")]);
    layer.insert(0, [s2]);
    const r2 = new El("rect"); r2.setAttribute("id", "r2"); r2.setAttribute("width", "5"); r2.setAttribute("height", "5");
    layer.insert(1, [r2]);
    layer.get(layer.length - 1).setAttribute("onclick", "window.__pwned=(window.__pwned||[]).concat('attr')");
    layer.delete(0, 1);
    const dom = document.querySelector("#canvasHost g[data-layer]");
    return { dom: Array.from(dom.childNodes).map(n => n.nodeType === 8 ? "#" : n.getAttribute("id") || n.nodeName).join(","), y: layer.toArray().map(n => n.getAttribute("id") || n.nodeName).join(",") };
  });
  const r1 = await p.locator('#canvasHost rect[id="r1"]').boundingBox().catch(() => null);
  if (r1) await p.mouse.click(r1.x + 5, r1.y + 5);
  const pwned = await p.evaluate(() => window.__pwned || []);
  comprueba("seguridad", "ColabDraw no ejecuta nodos escritos a mano en Yjs", pwned.length === 0 && !!rb, pwned.join(",") || "rect visible");
  comprueba("seguridad", "ColabDraw: el DOM sigue alineado con Yjs tras bloquear", vivo.dom.split(",").length === vivo.y.split(",").length, `${vivo.dom} ↔ ${vivo.y}`);
  await p.close();

  // ColabTeX: comentario con id y color envenenados
  const d2 = new Y.Doc();
  d2.getMap("files").set("main.tex", new Y.Text("\\documentclass{article}\n\\begin{document}\nHola\n\\end{document}\n"));
  const t = new Y.Map();
  d2.getMap("comments").set('x"><img src=x onerror="window.__pwned=(window.__pwned||[]).concat(\'id\')">', t);
  t.set("file", "main.tex"); t.set("quote", "Hola"); t.set("createdAt", Date.now());
  const msgs = new Y.Array(); t.set("messages", msgs);
  msgs.push([{ id: "m1", author: { uid: "u2", name: "Malo", color: 'red"><img src=x onerror="window.__pwned=(window.__pwned||[]).concat(\'color\')">' }, text: "hola", createdAt: Date.now() }]);
  const p2 = await nuevaPagina(browser, { app: "colabtex-app.js", bundle: B.tex, initArg: Array.from(Y.encodeStateAsUpdate(d2)),
    initScript: u => { window.__fakeProjects = { pmalo: { id: "pmalo", title: "Compartido", kind: "tex", owner: "u2", ownerName: "Otro", updatedAt: Date.now(), update: new Uint8Array(u) } }; window.__fakeAssets = { pmalo: {} }; } });
  await p2.goto(base + "/colabtex.html?p=pmalo");
  await p2.waitForSelector("#viewEditor", { state: "visible", timeout: 15000 });
  await p2.waitForTimeout(1000);
  await p2.click("#btnCommentsToggle"); await p2.waitForTimeout(600);
  const r = await p2.evaluate(() => ({ pwned: window.__pwned || [], cards: document.querySelectorAll(".comment-card").length }));
  comprueba("seguridad", "Comentarios de ColabTeX no ejecutan id ni color ajenos", r.pwned.length === 0 && r.cards === 1, r.pwned.join(",") || `${r.cards} hilo`);
  await p2.close();
}

async function dibujo(browser, base, B) {
  console.log("\n▸ dibujo (ColabDraw)");
  const p = await nuevaPagina(browser, { app: "colabdraw-app.js", bundle: B.draw });
  await p.goto(base + "/colabdraw.html");
  await p.waitForSelector("#viewDash", { state: "visible", timeout: 15000 });
  await p.click("#btnNewProject");
  await p.waitForSelector("#viewEditor", { state: "visible", timeout: 10000 });
  await p.waitForTimeout(800);
  const h = await p.locator("#canvasHost").boundingBox();
  const cx = h.x + h.width / 2, cy = h.y + h.height / 2;
  const arrastra = async (x1, y1, x2, y2) => { await p.mouse.move(x1, y1); await p.mouse.down(); await p.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 }); await p.mouse.move(x2, y2, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(120); };
  const herr = t => p.click(`[data-tool="${t}"]`);
  const cuantos = () => p.evaluate(() => document.querySelectorAll("#canvasHost svg [data-layer] > *").length);
  for (const [t, a] of [["rect", [-200, -150, -100, -80]], ["ellipse", [-50, -150, 50, -80]], ["line", [100, -150, 200, -80]], ["curve", [-200, 0, -100, 50]], ["poly", [-50, 0, 50, 80]]]) {
    await herr(t); await arrastra(cx + a[0], cy + a[1], cx + a[2], cy + a[3]);
  }
  await herr("text"); await p.mouse.click(cx + 120, cy + 40); await p.waitForTimeout(200); await p.keyboard.type("Hola ñ"); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  comprueba("dibujo", "seis herramientas crean seis figuras", (await cuantos()) === 6, `${await cuantos()} figuras`);
  await herr("select"); await arrastra(cx - 260, cy - 200, cx + 260, cy + 130);
  await p.click("#btnGroup"); await p.click("#btnUngroup"); await p.click("#btnDuplicate");
  for (let i = 0; i < 3; i++) await p.click("#btnUndo");
  await p.click("#btnRedo");
  await p.mouse.click(cx - 150, cy - 115); await p.keyboard.press("Control+c"); await p.keyboard.press("Control+v");
  await p.click("#btnLayerAdd"); await p.click("#btnLayerMoveSel");
  await p.click("#btnExport"); await p.check("#expSvg"); await p.check("#expPng"); await p.click("#btnExportDo"); await p.waitForTimeout(1500);
  comprueba("dibujo", "exporta SVG y PNG", /\.svg.*\.png|\.png.*\.svg/.test(await p.textContent("#expMsg")), await p.textContent("#expMsg"));
  await p.click("#btnExportClose").catch(() => {});
  await p.click("#btnNewDrawing"); await p.waitForTimeout(300);
  await herr("formula"); await p.mouse.click(cx, cy); await p.waitForTimeout(400);
  const ta = await p.$("textarea:visible");
  if (ta) { await ta.fill("\\frac{a}{b}"); await p.waitForTimeout(3500); const bt = await p.$('button:visible:has-text("Insertar"), button:visible:has-text("Aceptar"), button:visible:has-text("Poner")'); if (bt) await bt.click(); await p.waitForTimeout(400); }
  comprueba("dibujo", "inserta una fórmula LaTeX", (await cuantos()) === 1, `${await cuantos()} figuras`);
  await p.setInputFiles("#svgIntoInput", { name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="40" height="20" fill="red"/><script>alert(1)</script></svg>') });
  await p.waitForTimeout(400);
  comprueba("dibujo", "importa un SVG (sin su <script>)", (await p.evaluate(() => document.querySelectorAll("#canvasHost script").length)) === 0 && (await cuantos()) >= 2);
  comprueba("dibujo", "sin errores de página", p.errores.length === 0, p.errores.join(" | "));
  await p.close();
}

async function esperaCompilar(p, boton = "#btnCompile") {
  await p.click(boton);
  await p.waitForFunction(() => !document.getElementById("btnCompile").textContent.includes("▶"), null, { timeout: 5000 }).catch(() => {});
  await p.waitForFunction(() => document.getElementById("btnCompile").textContent.includes("▶"), null, { timeout: 240000 });
  return p.textContent("#logSummary");
}

async function nube(browser, base, B) {
  console.log("\n▸ nube (ColabTeX con Firebase imitado)");
  const p = await nuevaPagina(browser, { app: "colabtex-app.js", bundle: B.tex });
  await p.goto(base + "/colabtex.html");
  await p.waitForSelector("#viewDash", { state: "visible", timeout: 15000 });
  p.siguiente = "Mi artículo";
  await p.click("#btnNewProject");
  await p.waitForSelector("#viewEditor", { state: "visible", timeout: 10000 });
  await p.waitForFunction(() => /listo/i.test(document.getElementById("statusText").textContent), null, { timeout: 240000 });
  comprueba("nube", "compila la plantilla", /✓/.test(await esperaCompilar(p)), await p.textContent("#logSummary"));
  await p.click(".cm-content"); await p.keyboard.press("Control+End"); await p.keyboard.press("ArrowUp"); await p.keyboard.press("End");
  await p.keyboard.type("\n\\section{Prueba}\\label{s:p}\nVer~\\ref{s:p}.\n");
  const s2 = await esperaCompilar(p);
  comprueba("nube", "recompila tras editar con ⚡", /✓.*rápida/.test(s2), s2);
  await p.click("#tabVisual"); await p.waitForTimeout(300); await p.click("#tabCode");
  await p.click("#btnSyncToPdf");
  const pg = await p.$("#pdfScroll .pdf-page"); const bb = await pg.boundingBox();
  await p.mouse.dblclick(bb.x + bb.width * 0.3, bb.y + bb.height * 0.2);
  comprueba("nube", "el PDF tiene texto seleccionable y enlaces", await p.evaluate(() => document.querySelectorAll("#pdfScroll .textLayer span").length > 0));
  p.siguiente = "cap1.tex"; await p.click("#btnNewFile"); await p.waitForTimeout(300);
  const s3 = await esperaCompilar(p, "#btnRecompile");
  comprueba("nube", "«desde cero» no usa ⚡", /✓/.test(s3) && /desde cero/.test(s3) && !/rápida/.test(s3), s3);
  await p.click("#btnBackDash"); await p.waitForTimeout(400);
  await p.click("#projectRows .proj-title");
  await p.waitForSelector("#viewEditor", { state: "visible", timeout: 10000 });
  await p.waitForTimeout(600);
  comprueba("nube", "reabre el proyecto y compila", /✓/.test(await esperaCompilar(p)));
  comprueba("nube", "sin errores de página", p.errores.length === 0, p.errores.join(" | "));
  await p.close();
}

async function local(browser, base, B) {
  console.log("\n▸ local (ColabTeX con carpeta en OPFS)");
  const p = await nuevaPagina(browser, { initScript: () => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      const put = async (n, t) => { const f = await root.getFileHandle(n, { create: true }); const w = await f.createWritable(); await w.write(t); await w.close(); };
      await put("main.tex", "\\documentclass{article}\n\\usepackage[T1]{fontenc}\n\\begin{document}\n\\section{Introducción}\\label{sec:intro}\nUno dos tres, 25°C.\n\\input{cap2}\n\n\\end{document}\n");
      await put("cap2.tex", "\\section{Métodos}\\label{sec:metodos}\nTexto.\n");
      await put("refs.bib", "@book{knuth84, title={The TeXbook}, author={D. Knuth}, year={1984}}\n");
      root.queryPermission = async () => "granted";
      return root;
    };
  } });
  await p.goto(base + "/colabtex.html");
  await p.waitForTimeout(600);
  await p.click("#btnLocalNoAccount");
  await p.waitForSelector("#viewEditor", { state: "visible" });
  await p.waitForTimeout(800);
  const opciones = () => p.$$eval(".cm-tooltip-autocomplete li", ls => ls.map(l => l.textContent));
  await p.click(".cm-content"); await p.keyboard.press("Control+End"); await p.keyboard.press("ArrowUp"); await p.keyboard.press("ArrowUp");
  await p.keyboard.type("Ver \\ref{"); await p.waitForTimeout(350);
  comprueba("local", "\\ref{ sugiere etiquetas de otros archivos", (await opciones()).includes("sec:metodos"), JSON.stringify(await opciones()));
  await p.keyboard.type("sec:m"); await p.keyboard.press("Enter"); await p.keyboard.press("End");
  await p.keyboard.type(" \\cite{"); await p.waitForTimeout(350);
  comprueba("local", "\\cite{ sugiere claves del .bib", (await opciones()).some(o => o.startsWith("knuth84")));
  await p.keyboard.press("Escape"); await p.keyboard.press("End"); await p.keyboard.press("Enter");
  await p.keyboard.type("\\begin{ite"); await p.waitForTimeout(350); await p.keyboard.press("Enter");
  const texto = await p.evaluate(() => document.querySelector(".cm-content").innerText);
  comprueba("local", "\\begin{itemize} escribe su \\end", /\\begin\{itemize\}\s*\n\s*\\item\s*\n\s*\\end\{itemize\}/.test(texto));
  const largo = texto.length;
  for (let i = 0; i < 3; i++) await p.keyboard.press("Control+z");
  comprueba("local", "Ctrl+Z deshace en modo local", (await p.evaluate(() => document.querySelector(".cm-content").innerText.length)) < largo);
  await p.waitForTimeout(500);
  comprueba("local", "esquema con las secciones", (await p.$$eval("#outline .outline-row", rs => rs.map(r => r.textContent))).includes("Introducción"));
  await p.waitForFunction(() => /listo/i.test(document.getElementById("statusText").textContent), null, { timeout: 240000 });
  comprueba("local", "compila T1 sin lmodern y un «°»", /✓/.test(await esperaCompilar(p)), await p.textContent("#logSummary"));
  await p.selectOption("#autoMode", "1");
  await p.click(".cm-content"); await p.keyboard.press("Control+End"); await p.keyboard.type("% x");
  const disparo = await p.waitForFunction(() => !document.getElementById("btnCompile").textContent.includes("▶"), null, { timeout: 6000 }).then(() => true).catch(() => false);
  comprueba("local", "Auto (1 s) compila al dejar de escribir", disparo);
  await p.waitForFunction(() => document.getElementById("btnCompile").textContent.includes("▶"), null, { timeout: 120000 });
  comprueba("local", "sin errores de página", p.errores.length === 0, p.errores.join(" | "));
  await p.close();
}

async function motor(browser, base, B) {
  const p = await nuevaPagina(browser);
  await p.route("**/__pruebas.html", r => r.fulfill({ contentType: "text/html", body: '<!doctype html><script src="/__motor.js"></script>' }));
  await p.route("**/__motor.js", r => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(B.motor, "utf8") }));
  await p.goto(base + "/__pruebas.html");
  await p.waitForFunction(() => window.ok);
  await p.evaluate(() => { window.eng = new LatexEngine({}); return eng.init(); });
  p.compila = (archivos, opts) => p.evaluate(async ([archivos, opts]) => {
    const lista = await Promise.all(Object.entries(archivos).map(async ([path, c]) => ({ path, contents: c.startsWith("data:") ? new Uint8Array(atob(c.slice(5)).split("").map(x => x.charCodeAt(0))) : c })));
    const t = performance.now();
    const res = await eng.compile(lista, "main.tex", opts);
    const s = summ(res);
    return { ms: Math.round(performance.now() - t), pdf: !!res.pdf, paginas: s.pages, errores: s.errors.length, primero: (s.errors[0] || "").slice(0, 120),
      faltan: /File `[^']+' not found|Font \S+ at \d+ not found/.test(s.full), pistas: pistas(s.full), rapida: !!res.rapida };
  }, [archivos, opts]);
  return p;
}

async function bateria(browser, base, B) {
  console.log(`\n▸ batería de compilación${RAPIDO ? " (corta)" : ""}`);
  const docs = JSON.parse(fs.readFileSync(path.join(__dirname, "documentos.json"), "utf8")).documentos;
  const CORTA = ["espanol_basico", "t1_sin_lmodern", "textcomp", "matematicas", "figuras_tikz", "biblatex_defecto", "natbib_apa", "fuentes_newtx", "beamer", "fontspec", "utf8_directo"];
  let p = await motor(browser, base, B), n = 0;
  for (const [nombre, d] of Object.entries(docs)) {
    if (RAPIDO && !CORTA.includes(nombre)) continue;
    if (++n % 20 === 0) { await p.close(); p = await motor(browser, base, B); }      // memoria acotada
    const r = await p.compila(d.archivos, { clean: true });
    if (d.espera === "ok") comprueba("bateria", nombre, r.pdf && !r.errores && !r.faltan, r.pdf ? (r.errores ? r.primero : `${r.paginas} pág · ${r.ms} ms`) : "sin PDF: " + r.primero);
    else comprueba("bateria", nombre + " (pista)", r.pistas.length > 0, r.pistas[0] ? r.pistas[0].slice(0, 70) + "…" : "sin pista");
  }
  await p.close();
}

async function rapida(browser, base, B) {
  console.log("\n▸ compilación rápida (⚡): mismo resultado que la normal");
  const docs = JSON.parse(fs.readFileSync(path.join(__dirname, "documentos.json"), "utf8")).documentos;
  const p = await motor(browser, base, B);
  for (const nombre of ["beamer", "biblatex_defecto", "hyperref_cleveref", "apa7", "glossaries"]) {
    const d = docs[nombre].archivos, edita = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "main.tex" ? v.replace("\\end{document}", "Más.\n\\end{document}") : v]));
    await p.compila(d, { clean: true });
    const normal = await p.compila(edita(d), {});
    await p.compila(d, { rapida: true });
    const rap = await p.compila(edita(d), { rapida: true });
    const igual = normal.paginas === rap.paginas && normal.errores === rap.errores;
    comprueba("rapida", nombre, igual, `${rap.rapida ? "⚡" : "normal (no admite ⚡)"} ${rap.ms} ms vs ${normal.ms} ms`);
  }
  await p.close();
}

/* ---------- arranque ---------- */
(async () => {
  console.log("Empaquetando con imitaciones…");
  fs.writeFileSync(path.join(TMP, "motor-entrada.js"),
    `import { LatexEngine, summarizeLog } from ${JSON.stringify(path.join(COLABTEX, "src/latex.js"))};\n` +
    `import { pistasDeError } from ${JSON.stringify(path.join(COLABTEX, "src/texlog.js"))};\n` +
    "window.LatexEngine = LatexEngine; window.summ = summarizeLog; window.pistas = pistasDeError; window.ok = true;\n");
  const B = {
    tex: await empaqueta("src/main.js", "tex.js"),
    draw: await empaqueta("src/draw-main.js", "draw.js"),
    motor: (esbuild.buildSync({ entryPoints: [path.join(TMP, "motor-entrada.js")], bundle: true, format: "iife", outfile: path.join(TMP, "motor.js"), nodePaths: [path.join(COLABTEX, "node_modules")], logLevel: "error" }), path.join(TMP, "motor.js"))
  };
  const app = express();
  app.use(express.static(ROOT, { setHeaders(res, f) { if (f.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm"); } }));
  const server = app.listen(0);
  const base = "http://localhost:" + server.address().port;
  const browser = await chromium.launch();
  const grupos = { seguridad, dibujo, nube, local, bateria, rapida };
  for (const [g, f] of Object.entries(grupos)) {
    if (!quiero(g)) continue;
    try { await f(browser, base, B); }
    catch (e) { mal(g, "el grupo se interrumpió", e.message.split("\n")[0]); }
  }
  await browser.close();
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pasadas} bien, ${fallos.length} mal`);
  if (fallos.length) { console.log(fallos.map(f => "  · " + f).join("\n")); process.exit(1); }
})();
