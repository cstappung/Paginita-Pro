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

let W, env, r2, preguntasAdmin=0;
const pide=(ruta,{metodo='GET',cab={},cuerpo}={})=>W.fetch(new Request('https://disco.ejemplo'+ruta,{method:metodo,headers:{Origin:'https://paginita-pro.cl',...cab},body:cuerpo}),env);

test.before(async()=>{
  par=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  jwk={...await crypto.subtle.exportKey('jwk',par.publicKey),kid:'k1',alg:'RS256',use:'sig'};
  // Lo que el Worker pide afuera: las claves de Google y, para `/amigos`, `admins/<uid>` de la base del sitio
  // (que contesta `true` solo a «jefa» y a «jefe2», y solo si la pregunta lleva un token).
  globalThis.fetch=async u=>{
    const m=/firebaseio\.com\/admins\/([^.]+)\.json\?auth=(.+)$/.exec(String(u));
    if(m){preguntasAdmin++;return new Response(JSON.stringify(m[2]&&(m[1]==='jefa'||m[1]==='jefe2')?true:null));}
    return new Response(JSON.stringify({keys:[jwk]}),{headers:{'cache-control':'max-age=3600'}});
  };
  W=(await import(require('node:url').pathToFileURL(path.join(__dirname,'../../juegos/bt3/fuente/disco/worker.js')).href)).default;   // (file://: en Windows import() no acepta C:\…)
  r2=new Map([['pieza/00000.bin',new Uint8Array([1,2,3])],['indice.json',new TextEncoder().encode('{"size":3,"pieza":1048576}')]]);
  const meta=new Map();   // llave → lo que R2 guarda al lado del objeto (customMetadata)
  env={AMIGOS:'yo, amigo1',CLAVE_SUBIDA:'secreto',DISCO:{get:async k=>r2.has(k)?{body:r2.get(k)}:null,
    put:async(k,v,o)=>{r2.set(k,typeof v==='string'?new TextEncoder().encode(v):new Uint8Array(v));meta.set(k,(o&&o.customMetadata)||{});},
    head:async k=>r2.has(k)?{key:k}:null,delete:async k=>{r2.delete(k);meta.delete(k);},
    list:async({prefix})=>({objects:[...r2.keys()].filter(k=>k.startsWith(prefix)).map(k=>({key:k,uploaded:new Date(1e12),customMetadata:meta.get(k)})),truncated:false})}};
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

test('rapidez: el pedazo va con no-store (la página lo guarda ella) y queda en el caché de Cloudflare para el próximo amigo',async()=>{
  const guardado=new Map();
  globalThis.caches={default:{match:async k=>guardado.has(k)?new Response(guardado.get(k)):undefined,put:async(k,r)=>{guardado.set(k,new Uint8Array(await r.arrayBuffer()));}}};
  try{
    const t=await token(datos('amigo1'));
    const r1=await pide('/pieza/00000.bin',{cab:{Authorization:'Bearer '+t}});
    assert.equal(r1.status,200);assert.equal(r1.headers.get('cache-control'),'no-store','el navegador no lo guarda dos veces');
    assert.equal(r1.headers.get('x-borde'),'MISS');assert.deepEqual([...new Uint8Array(await r1.arrayBuffer())],[1,2,3]);
    assert.ok(guardado.has('https://disco.ejemplo/pieza/00000.bin'),'la llave no lleva el token: sirve para todos los amigos');
    const r2=await pide('/pieza/00000.bin',{cab:{Authorization:'Bearer '+t}});
    assert.equal(r2.headers.get('x-borde'),'HIT');assert.deepEqual([...new Uint8Array(await r2.arrayBuffer())],[1,2,3]);
    assert.equal((await pide('/pieza/00000.bin',{cab:{Authorization:'Bearer '+await token(datos('extraño'))}})).status,403,'el caché no salta la lista');
    assert.equal((await pide('/pieza/00000.bin')).status,401,'ni la sesión');
  }finally{delete globalThis.caches;}
});

test('la lista de arranque: la leen y la completan los amigos, con pedazos que existen',async()=>{
  const t=await token(datos('amigo1')),A={Authorization:'Bearer '+t};
  let r=await pide('/arranque.json',{cab:A});assert.equal(r.status,200);assert.deepEqual(await r.json(),[],'sin lista todavía: vacía');
  env.DISCO.put('indice.json',new TextEncoder().encode(JSON.stringify({size:10*1048576,pieza:1048576})));
  r=await pide('/arranque.json',{metodo:'PUT',cab:A,cuerpo:JSON.stringify([3,1,2])});assert.equal(r.status,200);
  r=await pide('/arranque.json',{metodo:'PUT',cab:A,cuerpo:JSON.stringify([2,5])});assert.equal(await r.text(),'4');
  assert.deepEqual(await (await pide('/arranque.json',{cab:A})).json(),[1,2,3,5],'se juntan, sin repetir y en orden');
  assert.equal((await pide('/arranque.json',{metodo:'PUT',cab:A,cuerpo:JSON.stringify([10])})).status,400,'un pedazo fuera del disco');
  assert.equal((await pide('/arranque.json',{metodo:'PUT',cab:A,cuerpo:'["x"]'})).status,400);
  assert.equal((await pide('/arranque.json',{metodo:'PUT',cab:A,cuerpo:'no es json'})).status,400);
  assert.equal((await pide('/arranque.json',{metodo:'PUT',cuerpo:'[1]'})).status,401,'sin sesión no se escribe');
  assert.equal((await pide('/arranque.json',{metodo:'PUT',cab:{Authorization:'Bearer '+await token(datos('extraño'))},cuerpo:'[1]'})).status,403,'ni alguien fuera de la lista');
  assert.equal((await pide('/indice.json',{metodo:'PUT',cab:A,cuerpo:'{}'})).status,403,'el índice sigue pidiendo la clave de subida');
  env.DISCO.put('indice.json',new TextEncoder().encode('{"size":3,"pieza":1048576}'));
});

test('el relevo TURN: solo para amigos, con la llave guardada en el Worker y sin el puerto 53',async()=>{
  const A={Authorization:'Bearer '+await token(datos('amigo1'))};
  assert.equal((await pide('/turn',{cab:A})).status,404,'sin llave configurada: no hay relevo (se conecta directo)');
  const fetchGoogle=globalThis.fetch;let pedidos=0,llamada=null;
  globalThis.fetch=async(u,o)=>{
    if(!String(u).startsWith('https://rtc.live.cloudflare.com/'))return fetchGoogle(u,o);
    pedidos++;llamada={u:String(u),o};
    return new Response(JSON.stringify({iceServers:[{urls:['stun:stun.cloudflare.com:3478','stun:stun.cloudflare.com:53']},
      {urls:['turn:turn.cloudflare.com:3478?transport=udp','turn:turn.cloudflare.com:53?transport=udp','turns:turn.cloudflare.com:443?transport=tcp'],username:'u',credential:'c'}]}),{status:201});
  };
  try{
    Object.assign(env,{TURN_ID:'llave1',TURN_CLAVE:'clave-secreta'});
    assert.equal((await pide('/turn')).status,401,'sin sesión: nada');
    assert.equal((await pide('/turn',{cab:{Authorization:'Bearer '+await token(datos('extraño'))}})).status,403,'fuera de la lista: nada');
    assert.equal(pedidos,0,'y Cloudflare ni se consulta');
    const r=await pide('/turn',{cab:A});assert.equal(r.status,200);
    const {iceServers}=await r.json();
    assert.match(llamada.u,/\/v1\/turn\/keys\/llave1\/credentials\/generate-ice-servers$/);
    assert.equal(llamada.o.headers.Authorization,'Bearer clave-secreta');
    assert.ok(!JSON.stringify(iceServers).includes(':53'),'sin el puerto 53');
    assert.equal(iceServers[1].username,'u');assert.equal(iceServers[1].urls.length,2);
    assert.ok(!JSON.stringify(iceServers).includes('clave-secreta'),'la llave no sale del Worker');
    await pide('/turn',{cab:A});assert.equal(pedidos,1,'las credenciales se reusan mientras no vencen');
  }finally{globalThis.fetch=fetchGoogle;delete env.TURN_ID;delete env.TURN_CLAVE;}
});

test('la lista de los administradores: solo ellos la leen y la cambian, y quien agregan entra al disco',async()=>{
  const A=async uid=>({Authorization:'Bearer '+await token(datos(uid)),'Content-Type':'application/json'});
  const jefa=await A('jefa'),nueva=await A('nueva');
  // nadie más toca la lista: ni sin sesión, ni un jugador cualquiera, ni un amigo del disco
  assert.equal((await pide('/amigos')).status,401,'sin sesión');
  assert.equal((await pide('/amigos',{cab:await A('extraño')})).status,403,'un jugador cualquiera no la lee');
  assert.equal((await pide('/amigos',{cab:await A('amigo1')})).status,403,'ser amigo no es ser administrador');
  assert.equal((await pide('/amigos',{metodo:'PUT',cab:await A('amigo1'),cuerpo:'{"uid":"colado"}'})).status,403,'ni agrega');
  assert.equal(r2.has('amigos/colado'),false);
  assert.equal((await pide('/amigos',{metodo:'POST',cab:jefa,cuerpo:'{}'})).status,404,'otros métodos no existen');
  // la administradora: no es amiga por serlo, y lee la lista vacía (con los uid del dueño, sin sus correos)
  assert.equal((await pide('/soy',{cab:jefa})).status,403,'ser administradora no da el disco');
  env.AMIGOS='yo, amigo1, Amiga@Gmail.com';
  let r=await pide('/amigos',{cab:jefa});assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{amigos:[],fijos:['yo','amigo1'],correos:1});
  env.AMIGOS='yo, amigo1';
  // agrega a «nueva»: antes no entraba, después sí (el «no» recordado se pisa al agregar)
  assert.equal((await pide('/soy',{cab:nueva})).status,403,'todavía no');
  assert.equal((await pide('/amigos',{metodo:'PUT',cab:jefa,cuerpo:'{"uid":"nueva"}'})).status,200);
  assert.equal((await pide('/soy',{cab:nueva})).status,200,'ya es amiga');
  assert.equal((await pide('/pieza/00000.bin',{cab:nueva})).status,200,'y lee el disco');
  assert.equal((await pide('/amigos',{cab:nueva})).status,403,'pero no administra');
  r=await pide('/amigos',{cab:jefa});
  assert.deepEqual((await r.json()).amigos,[{uid:'nueva',por:'jefa',at:1e12}],'queda anotado quién la puso');
  // lo que no es una cuenta no se guarda (va en una llave de R2)
  for(const malo of ['{"uid":"../indice.json"}','{"uid":"a/b"}','{"uid":""}','{"uid":7}','{}','no es json'])
    assert.equal((await pide('/amigos',{metodo:'PUT',cab:jefa,cuerpo:malo})).status,400,malo);
  assert.deepEqual([...r2.keys()].filter(k=>k.startsWith('amigos/')),['amigos/nueva']);
  // otro administrador la quita: deja de entrar
  assert.equal((await pide('/amigos',{metodo:'DELETE',cab:await A('jefe2'),cuerpo:'{"uid":"nueva"}'})).status,200);
  assert.equal((await pide('/soy',{cab:nueva})).status,403,'ya no');
  assert.equal((await pide('/pieza/00000.bin',{cab:nueva})).status,403);
  // los del dueño (AMIGOS) no dependen de esta lista
  assert.equal((await pide('/amigos',{metodo:'DELETE',cab:jefa,cuerpo:'{"uid":"amigo1"}'})).status,200);
  assert.equal((await pide('/soy',{cab:await A('amigo1')})).status,200,'amigo1 sigue: es de la variable del dueño');
  // CORS deja pasar el DELETE del panel, y a Firebase se le preguntó poco (se recuerda un minuto)
  const pre=await pide('/amigos',{metodo:'OPTIONS'});
  assert.match(pre.headers.get('access-control-allow-methods'),/DELETE/);
  assert.ok(preguntasAdmin<=5,'una pregunta por cuenta, no por llamada: '+preguntasAdmin);
});

test('si Firebase o R2 fallan, nadie pasa de más',async()=>{
  const bueno=globalThis.fetch;
  globalThis.fetch=async u=>/firebaseio/.test(String(u))?new Response('{"error":"Permission denied"}',{status:401}):bueno(u);
  try{
    assert.equal((await pide('/amigos',{cab:{Authorization:'Bearer '+await token(datos('otra-jefa'))}})).status,403,'Firebase dice que no: no administra');
  }finally{globalThis.fetch=bueno;}
  const head=env.DISCO.head;env.DISCO.head=async()=>{throw new Error('R2 caído');};
  try{
    assert.equal((await pide('/soy',{cab:{Authorization:'Bearer '+await token(datos('desconocida'))}})).status,403,'R2 falla: no es amiga');
    assert.equal((await pide('/soy',{cab:{Authorization:'Bearer '+await token(datos('amigo1'))}})).status,200,'los del dueño no dependen de R2');
  }finally{env.DISCO.head=head;}
});
