"use strict";
/* Utilidades compartidas */

const PALETTE = ["#0d9488", "#d97706", "#7c3aed", "#0f62fe", "#dc2626", "#16a34a", "#db2777", "#ca8a04"];

export function colorForUid(uid) {
  let h = 0;
  for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function colorLight(hex) {
  // versión translúcida para el fondo de selección remota
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.25)`;
}

export function timeAgo(ts) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "hace unos segundos";
  if (s < 3600) return "hace " + Math.floor(s / 60) + " min";
  if (s < 86400) return "hace " + Math.floor(s / 3600) + " h";
  if (s < 172800) return "ayer";
  return new Date(ts).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
