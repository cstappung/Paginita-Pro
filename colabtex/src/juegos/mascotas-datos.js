/* Mascotas vistas desde la página (mercado, perfil, salón): puro y sin DOM.
   Toma los datos del catálogo del juego (los .ts de src/mascotas/data, que
   son solo datos; esbuild los mete en el paquete sin three.js) y la economía,
   y dice cómo se llama cada cosa, con qué emoji, y qué hay que pedirle al
   visor para fotografiarla. */
import { CATALOG, DANCES, SLOT_LABEL } from "../mascotas/data/accessories.ts";
import { DECOR } from "../mascotas/data/decor.ts";
import { SPECIES } from "../mascotas/data/species/index.ts";
import MM from "../../../juegos/mascotas/motor.js";
import { economia, mascotasDe, objetosDe } from "./monedas.js";

export const TIPO_OBJETO = Object.assign({}, SLOT_LABEL, { decor: "Para la casa", dance: "Baile" });
/* Los espacios en el orden del filtro del mercado. */
export const ESPACIOS = ["hat", "outfit", "shoes", "boots", "decor"];
export const NOMBRE_ESPACIO = { hat: "Sombreros", outfit: "Ropa", shoes: "Zapatos", boots: "Botas", decor: "Casa" };
export const ESPECIES = Object.values(SPECIES).map(s => ({ id: s.id, nombre: s.name, etapas: s.stages.map(e => ({ id: e.id, nombre: e.label, emoji: e.emoji })) }));
export const ETAPAS = [["egg", "Huevo o caja"], ["baby", "Cría"], ["adult", "Adulto"]];

/* La ficha de catálogo de un objeto: {nombre, emoji, leg}. */
export function fichaObjeto(kind, id) {
  const d = kind === "decor" ? DECOR.find(x => x.id === id) : kind === "dance" ? DANCES.find(x => x.id === id) : (CATALOG[kind] || []).find(x => x.id === id);
  return d ? { nombre: d.label, emoji: d.emoji, leg: d.rarity === "legendary" } : { nombre: id, emoji: "🎁", leg: false };
}
/* La especie y la etapa de una mascota, en palabras y con su emoji. */
export function fichaMascota(e, etapa) {
  const sp = SPECIES[e] || SPECIES.chicken, st = sp.stages.find(s => s.id === etapa) || sp.stages[0];
  return { especie: sp.name, etapa: st.label, etapaId: st.id, emoji: st.emoji };
}

/* Lo que lleva puesta una mascota según su estado guardado, resuelto contra
   la economía: solo lo que su dueño todavía tiene y no está a la venta (lo
   inicial, `start-<espacio>-<id>`, lo tiene todo el mundo). */
export function puestoDe(estado, dueno, e) {
  const ids = {}, tints = {};
  for (const [slot, uid] of Object.entries((estado && estado.w) || {})) {
    const ini = /^start-([a-z]+)-([a-z]+)$/.exec(uid);
    if (ini) { if (ini[1] === slot) ids[slot] = ini[2]; continue; }
    const r = e.regalos[uid];
    if (!r || e.dueno[uid] !== dueno || e.enVenta[uid] || r.item.kind !== slot) continue;
    ids[slot] = r.item.id;
    if (r.item.tint) tints[slot] = r.item.tint;
  }
  return { ids, tints };
}

/* Lo que se le pide al visor para fotografiar (o mostrar) cada cosa. La
   clave dice todo lo que cambia la foto, así la memoria no sirve una vieja. */
export const pedidoObjeto = it => ({ key: `ob:${it.kind}:${it.id}:${it.tint || 0}`, item: { kind: it.kind, id: it.id, tint: it.tint || 0 } });
export function pedidoMascota(c, m, estado, puesto, baile) {
  const etapa = fichaMascota(m.e, estado && estado.e).etapaId;
  const ids = (puesto && puesto.ids) || {}, tints = (puesto && puesto.tints) || {};
  return {
    key: `ma:${c}:${etapa}:${JSON.stringify([ids, tints])}${baile ? ":" + baile : ""}`,
    mascota: Object.assign({ e: m.e, etapa, semilla: MM.semillaGenes(m.u, m.k, m.at), ids, tints }, baile ? { baile } : {})
  };
}

/* El baile de un objeto o de una clave inicial (`start-dance-salsa` o el id). */
export function baileDe(b, e, dueno) {
  if (!b) return null;
  if (MM.BAILES_INICIALES.includes(b)) return b;
  const ini = /^start-dance-([a-z]+)$/.exec(b);
  if (ini && MM.BAILES_INICIALES.includes(ini[1])) return ini[1];
  const r = e.regalos[b];
  return r && r.item.kind === "dance" && e.dueno[b] === dueno && !e.enVenta[b] ? r.item.id : null;
}

/* Los últimos legendarios que salieron de regalos, del más nuevo al más
   viejo, con quién lo sacó y cuándo (el carrusel del salón). Solo regalos
   válidos: los que la economía aceptó. */
export function mejoresDropsMascotas(datos, n = 24) {
  if (!datos || !datos.completo) return [];
  const e = economia(datos), out = [];
  for (const [c, r] of Object.entries(e.regalos)) if (r.item.leg) out.push({ c, uid: r.u, at: r.at, item: r.item, ficha: fichaObjeto(r.item.kind, r.item.id) });
  return out.sort((a, b) => b.at - a.at || (a.c < b.c ? -1 : 1)).slice(0, n);
}

/* La mascota que se ve en un perfil, re-chequeada contra la economía: que
   esa cuenta siga siendo dueña de la mascota (y que no esté a la venta) y
   del baile. Devuelve {c, m, baile} o null; el estado lo pone quien pinta. */
export function mascotaVisible(uid, perfil, datos) {
  const x = perfil && perfil.mascota;
  if (!x || typeof x.m !== "string" || !datos || !datos.completo) return null;
  const e = economia(datos), m = e.mascotas[x.m];
  if (!m || e.dueno[x.m] !== uid || e.enVenta[x.m]) return null;
  return { c: x.m, m, baile: baileDe(x.b, e, uid) };
}

/* Lo que se puede elegir para el perfil: mis mascotas que no están a la
   venta y mis bailes (los iniciales y los regalos míos). */
export function opcionesMascotaPerfil(uid, datos) {
  if (!datos || !datos.completo) return { mascotas: [], bailes: [] };
  const mascotas = mascotasDe(uid, datos).filter(x => !x.venta).map(x => ({ c: x.c, m: { u: x.o, k: x.k, at: x.at, e: x.e } }));
  const bailes = MM.BAILES_INICIALES.map(id => ({ b: "start-dance-" + id, id, ficha: fichaObjeto("dance", id) }));
  for (const x of objetosDe(uid, datos))
    if (x.kind === "dance" && !x.venta) bailes.push({ b: x.c, id: x.id, leg: x.leg, ficha: fichaObjeto("dance", x.id) });
  return { mascotas, bailes };
}
