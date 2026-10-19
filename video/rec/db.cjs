// Escritura directa al emulador (como dueño, sin reglas)
const NS = 'mi-pagina-pro-default-rtdb';
const url = p => `http://127.0.0.1:9000/${p}.json?ns=${NS}`;
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
module.exports = {
  put: async (p, v) => { const r = await fetch(url(p), { method: 'PUT', headers: H, body: JSON.stringify(v) }); if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + await r.text()); },
  patch: async (p, v) => { const r = await fetch(url(p), { method: 'PATCH', headers: H, body: JSON.stringify(v) }); if (!r.ok) throw new Error(p + ' ' + r.status); },
  get: async p => (await fetch(url(p), { headers: H })).json(),
};
