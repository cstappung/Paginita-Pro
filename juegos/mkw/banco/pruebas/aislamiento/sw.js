// Paso 8 (P9, bitácora §187): ¿basta un service worker para poner Document-Isolation-Policy? GitHub Pages no deja
// poner cabeceras, pero un service worker del mismo sitio puede contestar la carga de una página con una respuesta
// armada por él, con las cabeceras que quiera. Aquí: solo las páginas pedidas con ?sw=dip (el resto pasa de largo).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.mode !== 'navigate' || u.searchParams.get('sw') !== 'dip') return;
  e.respondWith(fetch(e.request).then(r => {
    const h = new Headers(r.headers);
    h.set('Document-Isolation-Policy', 'isolate-and-require-corp');
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  }));
});
