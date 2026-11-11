/* Los reportes de Pro Kingdoms (errores y sugerencias): la parte pura.

   No tienen nodo propio: son entradas de `feedback/<id>` (el de Informes,
   fb-reports.js) con `app: "prokingdoms"`. Esa regla ya dice lo que se
   pidió: los lee cualquiera con sesión, cada uno escribe los suyos y solo
   un administrador borra los de otro. Así no hay reglas nuevas que publicar
   y los reportes salen también en la página de Informes.

   Aquí va lo que se puede comprobar en Node: limpiar lo que se escribe,
   ordenar la lista y armar el .txt que descarga el administrador. La
   ventana está en prokingdoms.js. */
export const APP_PK = "prokingdoms";
export const LARGO = { titulo: 120, cuerpo: 2000 };   // la regla deja 200 y 4000
export const TIPOS_PK = { bug: "Error", idea: "Sugerencia" };

const sinControl = s => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");

/* Lo que se manda: título en una línea, cuerpo sin saltos de más. Devuelve
   null si no hay título (es lo único obligatorio). */
export function limpiaReporte({ tipo, titulo, cuerpo } = {}) {
  const t = sinControl(titulo).replace(/\s+/g, " ").trim().slice(0, LARGO.titulo);
  if (!t) return null;
  const c = sinControl(cuerpo).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, LARGO.cuerpo);
  return { tipo: tipo === "idea" ? "idea" : "bug", titulo: t, cuerpo: c };
}

/* Solo los de Pro Kingdoms (por si la lectura trajo el nodo entero), del
   más nuevo al más viejo. `filtro`: "" (todos), "bug" o "idea". */
export function ordenaReportes(lista, filtro = "") {
  return (lista || []).filter(r => r && r.app === APP_PK && (!filtro || (r.tipo === "idea" ? "idea" : "bug") === filtro))
    .sort((a, b) => (b.at || 0) - (a.at || 0) || String(b.id).localeCompare(String(a.id)));
}

const p2 = n => String(n).padStart(2, "0");
export const fechaReporte = t => {
  if (!t) return "?";
  const d = new Date(t);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const nombreTxt = t => {
  const d = new Date(t || Date.now());
  return `prokingdoms-reportes-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}.txt`;
};

/* El informe completo, en texto plano y pensado para arreglar: primero lo
   que sigue abierto, los errores antes que las sugerencias y, dentro de
   cada grupo, del más viejo al más nuevo (el orden en que llegaron). */
export function aTxt(lista, generado) {
  const rs = ordenaReportes(lista);
  const bugs = rs.filter(r => r.tipo !== "idea"), ideas = rs.filter(r => r.tipo === "idea");
  const hechos = rs.filter(r => r.estado === "hecho").length;
  const L = [
    "PRO KINGDOMS — REPORTES DE ERRORES Y SUGERENCIAS",
    `Generado: ${fechaReporte(generado || Date.now())}`,
    `Total: ${rs.length} (${bugs.length} ${bugs.length === 1 ? "error" : "errores"}, ${ideas.length} ${ideas.length === 1 ? "sugerencia" : "sugerencias"}) · abiertos: ${rs.length - hechos}, arreglados: ${hechos}`,
    ""
  ];
  const grupos = [
    ["ERRORES ABIERTOS", bugs.filter(r => r.estado !== "hecho")],
    ["SUGERENCIAS ABIERTAS", ideas.filter(r => r.estado !== "hecho")],
    ["YA ARREGLADOS O HECHOS", rs.filter(r => r.estado === "hecho")]
  ];
  let n = 0;
  for (const [titulo, g] of grupos) {
    if (!g.length) continue;
    L.push("=".repeat(64), `${titulo} (${g.length})`, "=".repeat(64), "");
    for (const r of g.slice().reverse()) {
      n++;
      L.push(`#${n} · ${TIPOS_PK[r.tipo === "idea" ? "idea" : "bug"].toUpperCase()} · ${r.estado === "hecho" ? "arreglado" : "abierto"}`);
      L.push(`Título: ${sinControl(r.titulo).replace(/\s+/g, " ").trim()}`);
      L.push(`De: ${sinControl(r.userName || "?").replace(/\s+/g, " ").trim()} (${r.uid || "?"}) · ${fechaReporte(r.at)}`);
      const donde = [r.ver, r.nav].filter(Boolean).join(" · ");
      if (donde) L.push(`Versión: ${donde}`);
      L.push(`Id: ${r.id}`);
      if (r.cuerpo) L.push("", sinControl(r.cuerpo).replace(/\r\n?/g, "\n").trim());
      L.push("", "-".repeat(64), "");
    }
  }
  if (!rs.length) L.push("Todavía no hay reportes.", "");
  return L.join("\n");
}
