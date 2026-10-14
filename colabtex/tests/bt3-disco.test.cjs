/* El disco privado de BT3 (juegos/bt3/fuente/disco/worker.js): solo los amigos de la lista leen, solo con un
   token de Firebase de verdad, y solo quien tiene la clave sube. Las claves de Google se reemplazan por un par
   generado aquí (fetch falso) y el bucket R2 por un Map. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {webcrypto:crypto}=require('node:crypto');

const b64u=b=>Buffer.from(b).toString('base64url');
let par, jwk;
async function token(datos,{firmaCon,alg='RS256'}={}){
  const cab=b64u(JSON.stringify({alg,kid:'k1',typ:'JWT'})),cue=b64u(JSON.stringify(datos));
  const firma=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',(firmaCon||par).privateKey,new TextEncoder().encode(cab+'.'+cue));
  return cab+'.'+cue+'.'+b64u(firma);
}
const ahora=()=>Math.floor(Date.now()/1000);
const datos=(uid,o={})=>({aud:'mi-pagina-pro',iss:'https://securetoken.google.com/mi-pagina-pro',sub:uid,iat:ahora()-10,exp:ahora()+3600,...o});

let W, env;
const pide=(ruta,{metodo='GET',cab={},cuerpo}={})=>W.fetch(new Request('https://disco.ejemplo'+ruta,{method:metodo,headers:{Origin:'https://paginita-pro.cl',...cab},body:cuerpo}),env);

test.before(async()=>{
  par=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  jwk={...await crypto.subtle.exportKey('jwk',par.publicKey),kid:'k1',alg:'RS256',use:'sig'};
  globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'cache-control':'max-age=3600'}});
  W=(await import(path.join(__dirname,'../../juegos/bt3/fuente/disco/worker.js'))).default;
  const r2=new Map([['pieza/00000.bin',new Uint8Array([1,2,3])],['indice.json',new TextEncoder().encode('{"size":3,"pieza":1048576}')]]);
  env={AMIGOS:'yo, amigo1',CLAVE_SUBIDA:'secreto',DISCO:{get:async k=>r2.has(k)?{body:r2.get(k)}:null,put:async(k,v)=>{r2.set(k,new Uint8Array(v));}}};
});

test('un amigo de la lista lee los pedazos y el índice',async()=>{
  const t=await token(datos('amigo1'));
  const r=await pide('/pieza/00000.bin',{cab:{Authorization:'Bearer '+t}});
  assert.equal(r.status,200);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3]);
  assert.equal(r.headers.get('access-control-allow-origin'),'https://paginita-pro.cl');
  assert.equal((await pide('/indice.json',{cab:{Authorization:'Bearer '+t}})).status,200);
  assert.equal((await pide('/soy',{cab:{Authorization:'Bearer '+t}})).status,200,'/soy: es amigo');
});

test('nadie más: sin token, token falso, de otro proyecto, vencido o de alguien fuera de la lista',async()=>{
  assert.equal((await pide('/pieza/00000.bin')).status,401,'sin token');
  const otro=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  assert.equal((await pide('/pieza/00000.bin',{cab:{Authorization:'Bearer '+await token(datos('amigo1'),{firmaCon:otro})}})).status,401,'firmado con otra clave');
  assert.equal((await pide('/pieza/00000.bin',{cab:{Authorization:'Bearer '+await token(datos('amigo1',{aud:'otro-proyecto',iss:'https://securetoken.google.com/otro-proyecto'}))}})).status,401,'otro proyecto');
  assert.equal((await pide('/pieza/00000.bin',{cab:{Authorization:'Bearer '+await token(datos('amigo1',{exp:ahora()-5}))}})).status,401,'vencido');
  assert.equal((await pide('/pieza/00000.bin',{cab:{Authorization:'Bearer '+await token(datos('extraño'))}})).status,403,'no está en la lista');
  assert.equal((await pide('/soy',{cab:{Authorization:'Bearer '+await token(datos('extraño'))}})).status,403,'/soy: no es amigo');
  assert.equal((await pide('/soy')).status,401,'/soy sin sesión');
});

test('también por correo, solo si Google lo verificó',async()=>{
 env.AMIGOS='yo, Amiga@Gmail.com';
 const con=async(o)=>(await pide('/soy',{cab:{Authorization:'Bearer '+await token(datos('uid-cualquiera',o))}})).status;
 assert.equal(await con({email:'amiga@gmail.com',email_verified:true}),200,'correo de la lista, verificado');
 assert.equal(await con({email:'AMIGA@gmail.com',email_verified:true}),200,'sin importar mayúsculas');
 assert.equal(await con({email:'amiga@gmail.com',email_verified:false}),403,'correo sin verificar: no vale');
 assert.equal(await con({email:'otra@gmail.com',email_verified:true}),403,'otro correo');
 env.AMIGOS='yo, amigo1';
});

test('subir pide la clave, y una página de otro sitio no recibe permiso CORS',async()=>{
  assert.equal((await pide('/pieza/00001.bin',{metodo:'PUT',cuerpo:new Uint8Array([9])})).status,403,'sin clave');
  assert.equal((await pide('/pieza/00001.bin',{metodo:'PUT',cab:{'X-Clave':'secreto'},cuerpo:new Uint8Array([9])})).status,200);
  const t=await token(datos('yo'));
  assert.equal((await pide('/pieza/00001.bin',{cab:{Authorization:'Bearer '+t}})).status,200,'lo subido se lee');
  const r=await W.fetch(new Request('https://disco.ejemplo/pieza/00000.bin',{headers:{Origin:'https://otro-sitio.com',Authorization:'Bearer '+t}}),env);
  assert.equal(r.headers.get('access-control-allow-origin'),null,'otro sitio: el navegador no le deja leer la respuesta');
});
