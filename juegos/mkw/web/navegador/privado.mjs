// Lo privado del juego (el programa, el manifiesto, el disco y Retro Rewind) desde el Worker de amigos, con el token de
// Firebase de quien juega — bitácora §65.
//
// Resumen: en el sitio, lo privado no está en GitHub Pages sino en el R2 del dueño, detrás del MISMO Worker que el disco
// de BT3 (juegos/bt3/fuente/disco/worker.js, rutas /mkw/). Ese Worker solo responde a un pedido que trae el token de
// Firebase (`Authorization: Bearer …`) de alguien que está en su lista de amigos. Esta página no tiene la sesión: la
// tiene la página de Juegos que la contiene (su marco padre). Igual que el marco de BT3, se lo pide por postMessage:
//   marco → Juegos:  { canal: 'mkw-hijo',  tipo: 'token', nuevo }      (nuevo = el anterior venció: pide uno fresco)
//   Juegos → marco:  { canal: 'mkw-padre', tipo: 'token', token }      (null = sin sesión)
// y le pone la cabecera a CADA pedido que va al Worker (instala un fetch que envuelve al del navegador: así sirve para
// disco.mjs, pipelines.mjs, imagenes.mjs y el .wasm que baja Emscripten sin tocar cada uno). Si el Worker contesta 401
// (el token dura una hora), pide uno nuevo y reintenta una vez. Un token es como una credencial con foto y fecha de
// vencimiento: el Worker revisa la firma de Google, la fecha y que el nombre esté en la lista.
// El programa (mkw.js) se carga con import(), que no deja poner cabeceras: se baja con fetch (con el token) y se importa
// desde un "blob" (una dirección local a esos bytes). Sin padre que conteste (la página suelta), no hay token: el Worker
// contesta 401 y la página lo dice.
//
// Uso:  const privado = crearPrivado({ origen: 'https://disco.ejemplo/mkw' }); privado.instalar();
//       const modulo = await privado.importar(origen + '/build/mkw.js?v=…');
export function crearPrivado({ origen, padre = globalThis.parent, yo = globalThis, red = globalThis.fetch?.bind(globalThis),
                               origenPagina = globalThis.location?.origin, tope = 4000 } = {}) {
  const base = String(origen || '').replace(/\/+$/, '') + '/';
  const conPadre = !!padre && padre !== yo;
  let token = null, pidiendo = null, sinRespuesta = false;
  const estado = { pedidos: 0, conToken: 0, renovados: 0, sinToken: 0 };

  // Le pide el token a Juegos; una sola pregunta a la vez (al arrancar salen muchos pedidos juntos)
  function pideToken(nuevo = false) {
    if (!conPadre || sinRespuesta) return Promise.resolve(null);
    if (pidiendo) return pidiendo;
    pidiendo = new Promise(listo => {
      let hecho = false;
      const fin = t => {
        if (hecho) return;
        hecho = true; clearTimeout(reloj); yo.removeEventListener('message', oye);
        if (t === undefined) sinRespuesta = true;          // nadie contestó (la página suelta): no volver a esperar
        listo(t || null);
      };
      const oye = e => { if (e.source === padre && e.origin === origenPagina && e.data?.canal === 'mkw-padre' && e.data.tipo === 'token') fin(e.data.token); };
      const reloj = setTimeout(() => fin(undefined), tope);
      yo.addEventListener('message', oye);
      padre.postMessage({ canal: 'mkw-hijo', tipo: 'token', nuevo: !!nuevo }, origenPagina);
    }).then(t => { pidiendo = null; if (t) token = t; return t; });
    return pidiendo;
  }

  const esPrivado = url => typeof url === 'string' && url.startsWith(base);
  const urlDe = recurso => typeof recurso === 'string' ? recurso : recurso instanceof URL ? recurso.href : recurso?.url;

  // fetch con el token para lo que va al Worker; lo demás pasa igual
  async function buscar(recurso, opciones = {}) {
    if (!esPrivado(urlDe(recurso))) return red(recurso, opciones);
    estado.pedidos++;
    for (let intento = 0; ; intento++) {
      const t = intento === 0 ? (token || await pideToken(false)) : await pideToken(true);
      const cab = new Headers(opciones.headers || (typeof recurso === 'object' && recurso.headers) || undefined);
      if (t) { cab.set('Authorization', 'Bearer ' + t); estado.conToken++; } else estado.sinToken++;
      const r = await red(recurso, { ...opciones, headers: cab });
      if (r.status !== 401 || intento >= 1 || !t) return r;
      estado.renovados++;                                  // el token venció: uno nuevo y otra vez
    }
  }

  return {
    estado, pideToken, buscar,
    // reemplaza el fetch de la página: desde ahora todo pedido a `origen` lleva el token
    instalar() { yo.fetch = buscar; return this; },
    // import() de un módulo privado: se baja con el token y se importa desde un blob
    async importar(url) {
      const r = await buscar(url);
      if (!r.ok) throw new Error(`el Worker contestó ${r.status} a ${url.split('?')[0]}` + (r.status === 401 ? ' (sin sesión)' : r.status === 403 ? ' (no estás en la lista de amigos)' : ''));
      const blob = new Blob([await r.arrayBuffer()], { type: 'text/javascript' });
      const dir = URL.createObjectURL(blob);
      try { return await import(dir); } finally { URL.revokeObjectURL(dir); }
    },
  };
}
