// W21 (etapa E4b del plan de rendimiento v4, bitácora §225): el service worker que aísla SOLO el marco del juego.
//
// Resumen: GitHub Pages no deja poner cabeceras. Un service worker de la carpeta del juego (mismo sitio) contesta la
// carga de la página del juego (index.html, pedida con ?aislar=sw) con la respuesta de siempre más la cabecera
// Document-Isolation-Policy (§187): ese documento —aunque esté dentro del marco de Juegos— pasa a su propio proceso,
// con memoria compartida (crossOriginIsolated = true). La página de afuera (Juegos, su inicio de sesión de Firebase)
// no cambia. Todo lo demás (los archivos, el Worker de R2) pasa de largo, sin tocarlo.
//   ?aislar=sw       → isolate-and-credentialless (lo de otro origen sin CORS llega sin cookies, en vez de fallar)
//   ?aislar=sw-corp  → isolate-and-require-corp (lo de otro origen tiene que venir con CORS o CORP)
// Comparación eléctrica: como poner un transformador de aislación solo para un equipo del tablero: el equipo queda en
// su propio circuito (su proceso), el resto de la instalación sigue igual.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  const modo = new URL(e.request.url).searchParams.get('aislar');
  if (modo !== 'sw' && modo !== 'sw-corp') return;
  e.respondWith(fetch(e.request).then(r => {
    const h = new Headers(r.headers);
    h.set('Document-Isolation-Policy', modo === 'sw-corp' ? 'isolate-and-require-corp' : 'isolate-and-credentialless');
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  }));
});
