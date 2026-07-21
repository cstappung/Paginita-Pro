"use strict";
/* ============================================================
   ColabTeX — divisores arrastrables entre los paneles del editor
   (archivos | código | PDF | asistente). Los tamaños se guardan
   en localStorage y se restauran al volver.
   ============================================================ */
const $ = id => document.getElementById(id);
const STORE = "colabtex_layout";

const MIN = { files: 140, code: 220, pdf: 220, ai: 260 };

function loadSizes() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
}
function saveSizes(s) {
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
}

export function initLayout() {
  const files = document.querySelector(".ed-files");
  const code = document.querySelector(".ed-code");
  const pdf = document.querySelector(".ed-pdf");
  const ai = $("aiPanel");
  if (!files || !code || !pdf) return;

  const sizes = loadSizes();
  if (sizes.files) files.style.width = sizes.files + "px";
  if (sizes.ai && ai) ai.style.width = sizes.ai + "px";
  if (sizes.codeGrow && sizes.pdfGrow) {
    code.style.flexGrow = sizes.codeGrow;
    pdf.style.flexGrow = sizes.pdfGrow;
  }

  /* al soltar: avisar al visor PDF/editor para que se reajusten */
  const settle = () => window.dispatchEvent(new Event("resize"));

  /* --- divisor de ancho fijo (panel lateral en px) --- */
  function fixedSplitter(handle, panel, key, side) {
    if (!handle || !panel) return;
    handle.addEventListener("pointerdown", e => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = panel.getBoundingClientRect().width;
      document.body.classList.add("resizing");

      const move = ev => {
        const dx = ev.clientX - startX;
        // side "left": el panel está a la izquierda del divisor → crece con dx
        const raw = side === "left" ? startW + dx : startW - dx;
        const max = window.innerWidth - 420;
        const w = Math.max(MIN[key], Math.min(raw, max));
        panel.style.width = w + "px";
      };
      const up = ev => {
        handle.releasePointerCapture(e.pointerId);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        document.body.classList.remove("resizing");
        const s = loadSizes();
        s[key] = Math.round(panel.getBoundingClientRect().width);
        saveSizes(s);
        settle();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  /* --- divisor proporcional entre código y PDF (ambos flexibles) --- */
  function flexSplitter(handle, a, b) {
    if (!handle) return;
    handle.addEventListener("pointerdown", e => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const aW = a.getBoundingClientRect().width;
      const bW = b.getBoundingClientRect().width;
      const total = aW + bW;
      document.body.classList.add("resizing");

      const move = ev => {
        const dx = ev.clientX - startX;
        const newA = Math.max(MIN.code, Math.min(aW + dx, total - MIN.pdf));
        a.style.flexGrow = newA;
        b.style.flexGrow = total - newA;
      };
      const up = () => {
        handle.releasePointerCapture(e.pointerId);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        document.body.classList.remove("resizing");
        const s = loadSizes();
        s.codeGrow = parseFloat(a.style.flexGrow) || 1;
        s.pdfGrow = parseFloat(b.style.flexGrow) || 1;
        saveSizes(s);
        settle();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  fixedSplitter($("splitFiles"), files, "files", "left");
  flexSplitter($("splitCode"), code, pdf);
  fixedSplitter($("splitAi"), ai, "ai", "right");

  /* doble clic en un divisor → restablecer proporciones por defecto */
  const reset = () => {
    files.style.width = "200px";
    if (ai) ai.style.width = "360px";
    code.style.flexGrow = 1.15;
    pdf.style.flexGrow = 1;
    saveSizes({});
    settle();
  };
  for (const id of ["splitFiles", "splitCode", "splitAi"]) {
    const h = $(id);
    if (h) { h.ondblclick = reset; h.title = "Arrastra para redimensionar · doble clic para restablecer"; }
  }
}
