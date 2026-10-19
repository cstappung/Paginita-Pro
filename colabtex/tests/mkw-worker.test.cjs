/* Mario Kart Wii en el Worker de amigos (juegos/bt3/fuente/disco/worker.js, rutas /mkw/): solo los amigos de la
   lista leen, con el mismo token de Firebase que BT3; los pedazos (Range) salen exactos; el programa va ya comprimido
   y guardable con su huella; nada fuera de las carpetas de Mario Kart. Las claves de Google se reemplazan por un par
   generado aquí (fetch falso) y el bucket R2 por un Map con bytes INVENTADOS (nada del juego). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {webcrypto:crypto}=require('node:crypto');

const b64u=b=>Buffer.from(b).toString('base64url');
let par;
async function token(uid,o={}){
  const ahora=Math.floor(Date.now()/1000);
  const cab=b64u(JSON.stringify({alg:'RS256',kid:'k1',typ:'JWT'}));
  const cue=b64u(JSON.stringify({aud:'mi-pagina-pro',iss:'https://securetoken.google.com/mi-pagina-pro',sub:uid,iat:ahora-10,exp:ahora+3600,...o}));
  const firma=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',par.privateKey,new TextEncoder().encode(cab+'.'+cue));
  return cab+'.'+cue+'.'+b64u(firma);
}

/* El bucket falso: get(k, {range}) como R2 (size = el objeto entero; un rango que pasa del final se rechaza, el caso
   más estricto: el Worker debe medir y recortar), head(k) → {size}. */
const bytes=n=>Uint8Array.from({length:n},(_,i)=>(i*7+3)&255);
const r2=new Map();
const pon=(k,v,meta)=>r2.set(k,typeof v==='string'?new TextEncoder().encode(v):v);
const R2={
  async get(k,o={}){
    if(!r2.has(k))return null;
    const v=r2.get(k);
    if(o.range){
      const {offset=0,length=v.length-offset}=o.range;
      if(offset>=v.length||offset+length>v.length)throw new Error('rango fuera del objeto');
      return {body:v.slice(offset,offset+length),size:v.length};
    }
    return {body:v,size:v.length};
  },
  async head(k){return r2.has(k)?{size:r2.get(k).length}:null;},
  async put(k,v){r2.set(k,new Uint8Array(v));}
};
let W,env,tAmigo,tExtrano;
const pide=(ruta,cab={},metodo='GET')=>W.fetch(new Request('https://disco.ejemplo'+ruta,{method:metodo,headers:{Origin:'https://paginita-pro.cl',...cab}}),env);
const amigo=(ruta,cab={},metodo)=>pide(ruta,{Authorization:'Bearer '+tAmigo,...cab},metodo);
const cuerpo=async r=>[...new Uint8Array(await r.arrayBuffer())];

test.before(async()=>{
  par=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk={...await crypto.subtle.exportKey('jwk',par.publicKey),kid:'k1',alg:'RS256',use:'sig'};
  globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'cache-control':'max-age=3600'}});
  W=(await import(pathToFileURL(path.join(__dirname,'../../juegos/bt3/fuente/disco/worker.js')).href)).default;
  pon('mkw/version.json',JSON.stringify({version:'v-prueba-1',build:'b1234'}));
  pon('mkw/manifiesto.json',JSON.stringify({'/mkw/disco/':[['files/a.szs',1000]]}));
  pon('mkw/mkw/disco/files/a.szs',bytes(1000));
  pon('mkw/mkw/sd/RetroRewind6/Mi Pista.szs',bytes(50));
  pon('mkw/build/mkw.js','export default 1;');
  pon('mkw/build/mkw.wasm',bytes(300));
  pon('mkw/build/mkw.wasm.br',bytes(40));
  pon('indice.json','{"size":3,"pieza":1048576}');      // de BT3: no se lee por /mkw/
  env={AMIGOS:'yo, amigo1',CLAVE_SUBIDA:'secreto',DISCO:R2};
  tAmigo=await token('amigo1'); tExtrano=await token('extraño');
});

test('solo los amigos de la lista: sin token 401, fuera de la lista 403, amigo 200 con las versiones a la vista',async()=>{
  assert.equal((await pide('/mkw/manifiesto.json')).status,401,'sin token');
  assert.equal((await pide('/mkw/manifiesto.json',{Authorization:'Bearer '+tExtrano})).status,403,'no está en la lista');
  assert.equal((await pide('/mkw/mkw/disco/files/a.szs',{Authorization:'Bearer '+tExtrano,Range:'bytes=0-9'})).status,403,'tampoco un pedazo');
  const r=await amigo('/mkw/manifiesto.json');
  assert.equal(r.status,200);
  assert.deepEqual(JSON.parse(await r.text()),{'/mkw/disco/':[['files/a.szs',1000]]});
  assert.equal(r.headers.get('x-mkw-version'),'v-prueba-1');
  assert.equal(r.headers.get('x-mkw-build'),'b1234');
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'),'https://paginita-pro.cl');
  assert.match(r.headers.get('access-control-expose-headers'),/X-Mkw-Version/);
  assert.match(r.headers.get('access-control-expose-headers'),/Content-Range/);
});

test('la pregunta previa (CORS) deja pedir con Range y Authorization; otro sitio no recibe permiso',async()=>{
  const r=await pide('/mkw/mkw/disco/files/a.szs',{'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,range'},'OPTIONS');
  assert.equal(r.status,204);
  assert.match(r.headers.get('access-control-allow-headers'),/Range/);
  assert.match(r.headers.get('access-control-allow-headers'),/Authorization/);
  const otro=await W.fetch(new Request('https://disco.ejemplo/mkw/manifiesto.json',{headers:{Origin:'https://otro.sitio',Authorization:'Bearer '+tAmigo}}),env);
  assert.equal(otro.headers.get('access-control-allow-origin'),null,'otro origen: sin permiso CORS');
});

test('los pedazos salen exactos (Range), recortados al final, y lo que no se puede pedir se rechaza',async()=>{
  const todo=bytes(1000);
  let r=await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=10-19'});
  assert.equal(r.status,206); assert.deepEqual(await cuerpo(r),[...todo.slice(10,20)]);
  assert.equal(r.headers.get('content-range'),'bytes 10-19/1000');
  assert.equal(r.headers.get('cache-control'),'no-store','la página guarda los pedazos ella misma');
  r=await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=990-1500'});
  assert.equal(r.status,206,'pasa del final: se recorta'); assert.deepEqual(await cuerpo(r),[...todo.slice(990)]);
  assert.equal(r.headers.get('content-range'),'bytes 990-999/1000');
  r=await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=900-'});
  assert.equal(r.status,206,'hasta el final'); assert.deepEqual(await cuerpo(r),[...todo.slice(900)]);
  r=await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=1000-1010'});
  assert.equal(r.status,416,'empieza después del final'); assert.equal(r.headers.get('content-range'),'bytes */1000');
  assert.equal((await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=20-10'})).status,416,'al revés');
  assert.equal((await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=0-1,5-9'})).status,416,'varios rangos');
  assert.equal((await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=-10'})).status,416,'los últimos N');
  assert.equal((await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=0-40000000'})).status,416,'más de 32 MB de una vez');
  r=await amigo('/mkw/mkw/sd/RetroRewind6/Mi%20Pista.szs',{Range:'bytes=0-4'});
  assert.equal(r.status,206,'nombres con espacios (la página codifica cada parte)'); assert.deepEqual(await cuerpo(r),[...bytes(50).slice(0,5)]);
  r=await amigo('/mkw/mkw/disco/files/a.szs');
  assert.equal(r.status,200,'sin Range: el archivo entero'); assert.equal((await cuerpo(r)).length,1000);
  r=await amigo('/mkw/mkw/disco/files/a.szs',{},'HEAD');
  assert.equal(r.status,200); assert.equal(r.headers.get('content-length'),'1000'); assert.equal(r.body,null,'HEAD: sin cuerpo');
  assert.equal((await amigo('/mkw/mkw/disco/files/no-esta.szs',{Range:'bytes=0-9'})).status,404);
});

test('el programa: ya comprimido (brotli) y guardable para siempre solo con su huella vigente',async()=>{
  let r=await amigo('/mkw/build/mkw.wasm?v=b1234',{'Accept-Encoding':'gzip, deflate, br, zstd'});
  assert.equal(r.status,200); assert.equal(r.headers.get('content-encoding'),'br');
  assert.deepEqual(await cuerpo(r),[...bytes(40)],'los bytes del .br tal cual');
  assert.equal(r.headers.get('content-type'),'application/wasm');
  assert.equal(r.headers.get('cache-control'),'public, max-age=31536000, immutable');
  assert.match(r.headers.get('vary'),/Accept-Encoding/);
  r=await amigo('/mkw/build/mkw.wasm?v=vieja',{'Accept-Encoding':'br'});
  assert.equal(r.headers.get('cache-control'),'no-store','huella vieja: sin guardar');
  r=await amigo('/mkw/build/mkw.wasm',{'Accept-Encoding':'gzip'});
  assert.equal(r.headers.get('content-encoding'),null,'sin brotli: el .wasm sin comprimir'); assert.equal((await cuerpo(r)).length,300);
  r=await amigo('/mkw/build/mkw.js?v=b1234',{'Accept-Encoding':'br'});
  assert.equal(r.status,200,'mkw.js sin .br: va normal'); assert.equal(await r.text(),'export default 1;');
  assert.equal(r.headers.get('content-type'),'text/javascript; charset=utf-8');
  assert.equal(r.headers.get('cache-control'),'public, max-age=31536000, immutable');
});

test('nada fuera de las carpetas de Mario Kart: ni lo de BT3, ni subir ni escapar con ..',async()=>{
  assert.equal((await amigo('/mkw/indice.json')).status,404,'lo de BT3 no se lee por /mkw/');
  assert.equal((await amigo('/mkw/version.json')).status,404,'version.json solo da las cabeceras');
  // (un .. —también %2e%2e— lo resuelve la dirección misma antes de llegar al Worker: /mkw/build/../version.json es
  // /mkw/version.json, que no está entre las rutas; y lo que pasa a /mkw/ codificado dos veces es solo un nombre raro)
  assert.equal((await amigo('/mkw/build/%2e%2e/version.json')).status,404,'.. codificado: queda fuera de las rutas');
  assert.equal((await amigo('/mkw/build/%252e%252e/%252e%252e/indice.json')).status,404,'codificado dos veces');
  assert.equal((await amigo('/mkw/mkw/disco/..%5c..%5cindice.json')).status,404,'barra invertida');
  assert.equal((await amigo('/mkw/otra/cosa')).status,404);
  assert.equal((await pide('/mkw/build/mkw.js',{Authorization:'Bearer '+tAmigo,'X-Clave':'secreto'},'PUT')).status,404,'no se sube por aquí');
});

test('rapidez: el pedazo queda en el caché de Cloudflare (con la versión en la llave) para el próximo amigo',async()=>{
  const guardado=new Map();
  globalThis.caches={default:{match:async k=>guardado.has(k)?guardado.get(k).clone():undefined,put:async(k,r)=>{guardado.set(k,new Response(await r.arrayBuffer(),{headers:r.headers}));}}};
  try{
    const r1=await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=100-199'});
    assert.equal(r1.headers.get('x-borde'),'MISS');
    assert.ok([...guardado.keys()].some(k=>k.includes('?r=100-199')&&k.includes('v-prueba-1')),'llave con el rango y la versión');
    const r2_=await amigo('/mkw/mkw/disco/files/a.szs',{Range:'bytes=100-199'});
    assert.equal(r2_.status,206); assert.equal(r2_.headers.get('x-borde'),'HIT');
    assert.equal(r2_.headers.get('content-range'),'bytes 100-199/1000');
    assert.deepEqual(await cuerpo(r2_),[...bytes(1000).slice(100,200)]);
    assert.equal((await pide('/mkw/mkw/disco/files/a.szs',{Authorization:'Bearer '+tExtrano,Range:'bytes=100-199'})).status,403,'el caché tampoco se le da a un extraño');
  }finally{delete globalThis.caches;}
});
