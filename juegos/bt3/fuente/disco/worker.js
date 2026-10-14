/* El disco privado de BT3: tu ISO en tu Cloudflare, solo para la lista de amigos.

   Resumen: la ISO vive en un bucket R2 (`DISCO`), cortada en pedazos de 1 MiB (`pieza/00000.bin`, ...) más
   `indice.json` ({size, pieza}). La página del juego (juegos/bt3/pagina.js) pide los pedazos que el juego va
   necesitando, con el token de Firebase del jugador (`Authorization: Bearer ...`). Este Worker:
   1. verifica ese token como lo haría Firebase: firma RS256 con las claves públicas de Google, emitido para el
      proyecto (`aud`, `iss`), vigente (`exp`, `iat`);
   2. mira que su correo (verificado por Google) o su uid esté en `AMIGOS` (variable del Worker, separados por
      comas: lo más fácil son los correos con que inician sesión en el sitio). Nadie más pasa: ni los
      demás jugadores del sitio, ni quien copie la dirección;
   3. solo entonces entrega el pedazo. Solo responde a las páginas de `ORIGENES` (CORS).
   Rapidez: R2 no tiene servidores en Sudamérica, así que cada pedazo se guarda además en el caché de Cloudflare
   más cercano (`caches.default`, después de revisar que es amigo: ese caché no es público, solo este Worker lo
   lee). **Solo funciona con un dominio propio** para el Worker (Settings → Domains & Routes → Custom domain);
   en `*.workers.dev` Cloudflare lo ignora y todo sigue saliendo de R2, igual que antes. Al navegador se le dice
   `no-store`: la página guarda los pedazos ella misma (Cache Storage), y así no quedan guardados dos veces.
   `/arranque.json`: qué pedazos lee el juego para llegar al menú y a la primera pelea. Lo escribe la página
   del primer amigo que juega (y lo completan los siguientes); con él, la página del próximo baja esos pedazos
   de una vez, antes de que el juego los pida.
   Para subir la ISO, `/subir` es una página que la lee en tu navegador y la manda por pedazos con la clave
   `CLAVE_SUBIDA` (un secreto del Worker). Sin esa clave no se puede escribir nada.

   Variables del Worker (Settings → Variables and Secrets):
     AMIGOS        correos de Google (o uids de Firebase) con acceso, separados por comas (el tuyo incluido)
     CLAVE_SUBIDA  secreto: la clave para subir la ISO (largo, al azar)
     ORIGENES      opcional: orígenes permitidos, separados por comas (por defecto el sitio)
   Enlace (Bindings): un bucket R2 con el nombre de variable DISCO. */
const PROYECTO = "mi-pagina-pro";                                  // el proyecto de Firebase del sitio
const ORIGENES = "https://paginita-pro.cl,https://www.paginita-pro.cl,http://localhost:8123";
const CLAVES_GOOGLE = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const PIEZA = 1024 * 1024;                                         // tamaño de cada pedazo de la ISO

let claves = null, clavesHasta = 0;                                // las claves públicas de Google, en memoria
const vistos = new Map();                                          // token ya verificado → {uid, exp}: el plan gratis da
                                                                   // poca CPU por pedido y una partida pide miles de pedazos

// ---------- verificar el token de Firebase ----------
const b64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const texto = b => new TextDecoder().decode(b);

async function clavesGoogle() {
  if (claves && Date.now() < clavesHasta) return claves;
  const r = await fetch(CLAVES_GOOGLE);
  const edad = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
  claves = (await r.json()).keys;
  clavesHasta = Date.now() + (edad ? Number(edad[1]) * 1000 : 3600000);   // Google dice cuánto valen
  return claves;
}

/* Si el token es un token de Firebase válido de este proyecto, {uid, correo, exp}; si no, null. */
async function uidDe(token) {
  const v = vistos.get(token);
  if (v && v.exp > Date.now() / 1000) return v.uid;
  const uid = await verifica(token);
  if (uid) {
    if (vistos.size > 200) vistos.clear();
    vistos.set(token, { uid, exp: uid.exp });
  }
  return uid;
}

async function verifica(token) {
  try {
    const [h, c, f] = token.split(".");
    const cab = JSON.parse(texto(b64url(h))), datos = JSON.parse(texto(b64url(c)));
    if (cab.alg !== "RS256") return null;
    const ahora = Math.floor(Date.now() / 1000);
    if (datos.aud !== PROYECTO || datos.iss !== "https://securetoken.google.com/" + PROYECTO) return null;
    if (!(datos.exp > ahora) || !(datos.iat <= ahora + 60) || typeof datos.sub !== "string" || !datos.sub) return null;
    const jwk = (await clavesGoogle()).find(k => k.kid === cab.kid);
    if (!jwk) return null;
    const clave = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", clave, b64url(f), new TextEncoder().encode(h + "." + c));
    // quién es: su uid y, solo si Google lo verificó, su correo (en minúsculas, para comparar con la lista)
    return ok ? { uid: datos.sub, correo: datos.email_verified === true && typeof datos.email === "string" ? datos.email.toLowerCase() : "", exp: datos.exp } : null;
  } catch (e) {
    return null;
  }
}

// ---------- respuestas ----------
function cors(req, env) {
  const origen = req.headers.get("Origin") || "";
  const permitidos = (env.ORIGENES || ORIGENES).split(",").map(s => s.trim());
  if (!permitidos.includes(origen)) return {};
  return { "Access-Control-Allow-Origin": origen, "Access-Control-Allow-Headers": "Authorization, X-Clave, Content-Type",
           "Access-Control-Allow-Methods": "GET, PUT, OPTIONS", "Access-Control-Max-Age": "86400", "Vary": "Origin",
           "Access-Control-Expose-Headers": "X-Borde" };
}
const responde = (cuerpo, estado, cabeceras) => new Response(cuerpo, { status: estado, headers: cabeceras });
const ARRANQUE_MAX = 1500;                                         // pedazos en la lista de arranque, como mucho
// El caché de Cloudflare (null donde no existe: en workers.dev existe pero no guarda nada).
const borde = () => (typeof caches !== "undefined" && caches.default) || null;
const tarde = (ctx, p) => { if (ctx && ctx.waitUntil) ctx.waitUntil(p.catch(() => {})); else return p.catch(() => {}); };

/* Un pedazo: del caché de Cloudflare si está; si no, de R2 (y se deja en el caché para el próximo). La llave del
   caché es la dirección sin el token: el mismo pedazo para todos los amigos. */
async function pedazo(url, env, ctx) {
  const cache = borde(), llave = url.origin + url.pathname;
  if (cache) {
    try { const g = await cache.match(llave); if (g) return { bytes: await g.arrayBuffer(), borde: "HIT" }; } catch (e) {}
  }
  const obj = await env.DISCO.get(url.pathname.slice(1));
  if (!obj) return null;
  const bytes = await new Response(obj.body).arrayBuffer();
  if (cache) await tarde(ctx, cache.put(llave, new Response(bytes, { headers: { "Cache-Control": "public, max-age=2592000" } })));
  return { bytes, borde: cache ? "MISS" : "NO" };
}

/* La lista de arranque que manda una página: [pedazo, ...], enteros dentro del disco. Se junta con la que ya
   había (sin repetir, ordenada) y se guarda con un tope. */
async function sumaArranque(req, env) {
  let nuevos;
  try { nuevos = JSON.parse(await req.text()); } catch (e) { return null; }
  if (!Array.isArray(nuevos) || nuevos.length > ARRANQUE_MAX) return null;
  let max = Infinity;
  try { const i = await env.DISCO.get("indice.json"); if (i) { const d = JSON.parse(await new Response(i.body).text()); max = Math.ceil(d.size / d.pieza); } } catch (e) {}
  if (!nuevos.every(n => Number.isInteger(n) && n >= 0 && n < max)) return null;
  let viejos = [];
  try { const o = await env.DISCO.get("arranque.json"); if (o) viejos = JSON.parse(await new Response(o.body).text()); } catch (e) {}
  const todos = [...new Set([...(Array.isArray(viejos) ? viejos : []), ...nuevos])].filter(n => Number.isInteger(n)).sort((a, b) => a - b).slice(0, ARRANQUE_MAX);
  await env.DISCO.put("arranque.json", new TextEncoder().encode(JSON.stringify(todos)));
  return todos.length;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), c = cors(req, env);
    if (req.method === "OPTIONS") return responde(null, 204, c);

    // La página para subir la ISO (se abre directo en el Worker, no desde el sitio).
    if (url.pathname === "/subir" && req.method === "GET") return responde(PAGINA_SUBIR, 200, { "Content-Type": "text/html; charset=utf-8" });
    // Subir un pedazo o el índice: solo con la clave de subida.
    if (req.method === "PUT" && (/^\/pieza\/\d{5}\.bin$/.test(url.pathname) || url.pathname === "/indice.json")) {
      if (!env.CLAVE_SUBIDA || req.headers.get("X-Clave") !== env.CLAVE_SUBIDA) return responde("sin permiso", 403, c);
      const cuerpo = await req.arrayBuffer();
      if (cuerpo.byteLength > PIEZA + 1024) return responde("pedazo demasiado grande", 413, c);
      await env.DISCO.put(url.pathname.slice(1), cuerpo);
      return responde("ok", 200, c);
    }

    // Leer: el índice o un pedazo, solo para los amigos. `/soy` contesta solo si quien pregunta está en la
    // lista: el sitio lo usa para mostrar BT3 únicamente a los amigos (colabtex/src/juegos/bt3-amigos.js).
    const lee = req.method === "GET" && (url.pathname === "/soy" || url.pathname === "/indice.json" || url.pathname === "/arranque.json" || /^\/pieza\/\d{5}\.bin$/.test(url.pathname));
    if (!lee && !(req.method === "PUT" && url.pathname === "/arranque.json")) return responde("no existe", 404, c);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const quien = token ? await uidDe(token) : null;
    if (!quien) return responde("inicia sesión", 401, c);
    const amigos = (env.AMIGOS || "").split(",").map(s => s.trim()).filter(Boolean);
    const esta = amigos.includes(quien.uid) || (!!quien.correo && amigos.some(a => a.toLowerCase() === quien.correo));
    if (!esta) return responde("sin acceso", 403, c);
    if (url.pathname === "/soy") return responde("amigo", 200, { ...c, "Cache-Control": "no-store" });
    if (req.method === "PUT") {   // la lista de arranque, de un amigo
      const n = await sumaArranque(req, env);
      return n === null ? responde("lista inválida", 400, c) : responde(String(n), 200, c);
    }
    if (url.pathname.startsWith("/pieza/")) {
      const p = await pedazo(url, env, ctx);
      if (!p) return responde("no está subido", 404, c);
      return responde(p.bytes, 200, { ...c, "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "X-Borde": p.borde });
    }
    const obj = await env.DISCO.get(url.pathname.slice(1));
    if (!obj) return responde(url.pathname === "/arranque.json" ? "[]" : "no está subido", url.pathname === "/arranque.json" ? 200 : 404,
      { ...c, "Content-Type": "application/json", "Cache-Control": "no-store" });
    return responde(obj.body, 200, { ...c, "Content-Type": "application/json", "Cache-Control": "no-store" });
  }
};

// ---------- la página para subir ----------
const PAGINA_SUBIR = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Subir la ISO de BT3</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#111;color:#eee;max-width:640px;margin:40px auto;padding:0 16px}
input,button{font:inherit;padding:8px;border-radius:6px;border:1px solid #444;background:#222;color:#eee}button{background:#f28c1e;color:#111;border:0;font-weight:700;cursor:pointer}
progress{width:100%;height:18px}#est{white-space:pre-wrap;color:#aaa}</style>
<h1>Subir la ISO de BT3 a tu disco privado</h1>
<p>Se lee en este navegador y se sube por pedazos de 1 MB a tu bucket R2. Si se corta, aprieta Subir de nuevo: vuelve a mandar todo (los pedazos se reemplazan).</p>
<p><input id="clave" type="password" placeholder="CLAVE_SUBIDA" size="40"></p>
<p><input id="iso" type="file" accept=".iso"></p>
<p><button id="ir">Subir</button></p>
<progress id="barra" value="0" max="1"></progress>
<p id="est"></p>
<script>
const P=${PIEZA}, $=id=>document.getElementById(id);
$('ir').onclick=async()=>{
  const f=$('iso').files[0], k=$('clave').value.trim();
  if(!f||!k){$('est').textContent='Falta la clave o la ISO.';return;}
  const n=Math.ceil(f.size/P); let hechos=0, siguiente=0, fallos=0; $('barra').max=n; $('ir').disabled=true;
  const sube=async i=>{
    for(let intento=0;;intento++){
      try{const r=await fetch('/pieza/'+String(i).padStart(5,'0')+'.bin',{method:'PUT',headers:{'X-Clave':k},body:f.slice(i*P,Math.min(f.size,(i+1)*P))});
        if(r.status===403)throw new Error('clave equivocada');if(!r.ok)throw new Error('HTTP '+r.status);return;}
      catch(e){if(String(e.message).includes('clave')||intento>=5)throw e;await new Promise(o=>setTimeout(o,1000*2**intento));}
    }
  };
  const trabajador=async()=>{while(siguiente<n){const i=siguiente++;await sube(i);hechos++;$('barra').value=hechos;$('est').textContent=hechos+' de '+n+' pedazos';}};
  try{
    await Promise.all(Array.from({length:6},trabajador));
    const r=await fetch('/indice.json',{method:'PUT',headers:{'X-Clave':k},body:JSON.stringify({size:f.size,pieza:P,nombre:f.name})});
    if(!r.ok)throw new Error('índice: HTTP '+r.status);
    $('est').textContent='Listo: '+n+' pedazos ('+(f.size/1073741824).toFixed(2)+' GB). Ya puedes cerrar esta página.';
  }catch(e){$('est').textContent='Se cortó: '+e.message+'. Vuelve a apretar Subir.';$('ir').disabled=false;}
};
</script></html>`;
