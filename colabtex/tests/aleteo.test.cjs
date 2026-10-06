/* ALETEO (juegos/club/aleteo/): el motor es repetible, el lore sube sin
   escalones y el verificador rehace el vuelo de un bot honesto y rechaza
   cada vía de trampa. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VA=carga('src/juegos/solo/verifica/aleteo.js');
const D=path.join(__dirname,'../../juegos/club/aleteo');
const M=require(path.join(D,'motor.js')),L=require(path.join(D,'lore.js'));
const CAT='club-aleteo-vuelo';

/* Un bot que aletea cuando cae por debajo del centro del próximo hueco,
   hasta `max` tubos; después se deja caer. */
function vuela(semilla,u,max=60){
 const E=M.nueva(semilla,u),aleteos=[];
 while(!E.muerto&&E.t<200000){
  const tb=E.tubos.find(t=>t.x+M.TW>M.PX-M.R);
  let a=E.t===0;
  if(!a&&E.puntos<max&&tb&&E.vy>=0&&E.y>tb.c+tb.g/2-34)a=true;
  if(a)aleteos.push([E.t,E.t%3?'r':'k']);
  M.paso(E,a);
 }
 return {E,aleteos};
}
const prueba=(semilla,u,max)=>{const {E,aleteos}=vuela(semilla,u,max);return {E,p:{v:1,s:semilla,u,f:M.codifica(aleteos),n:E.t,r:M.msDe(E.t)+50}};};
const dato=(E,u)=>({categoria:CAT,uid:u,puntos:E.puntos,tiempo:M.msDe(E.t)});

test('el motor es determinista y la cuenta cambia el cielo',()=>{
 const a=vuela(7,'ana'),b=vuela(7,'ana'),c=M.nueva(7,'beto'),d=M.nueva(7,'ana');
 assert.equal(a.E.t,b.E.t);assert.equal(a.E.puntos,b.E.puntos);
 assert.notDeepEqual(c.tubos.map(t=>t.c),d.tubos.map(t=>t.c));
 assert.ok(a.E.puntos>=20,`el bot pasa ${a.E.puntos} tubos`);
});

test('codifica y decodifica los aleteos',()=>{
 const al=[[0,'r'],[5,'t'],[40,'k'],[1000,'m'],[1001,'x']];
 assert.deepEqual(M.decodifica(M.codifica(al)),al);
 assert.equal(M.decodifica('r0,zz!'),null);
 assert.deepEqual(M.decodifica(''),[]);
});

test('rehace el vuelo del bot',()=>{
 for(const s of [1,2,3,12345]){
  const {E,aleteos}=vuela(s,'uid'+s);
  const r=M.rehace(s,'uid'+s,M.decodifica(M.codifica(aleteos)),E.t);
  assert.equal(r.error,undefined);assert.equal(r.puntos,E.puntos);
  assert.ok(E.t>=M.ticksMinimos(E.puntos));
 }
});

test('el lore sube de 0 a 5 sin escalones',()=>{
 assert.equal(L.corrupcion(0),0);assert.equal(L.corrupcion(1000),5);
 let prev=0;for(let p=0;p<=200;p+=0.5){const c=L.corrupcion(p);assert.ok(c>=prev&&c-prev<0.05);prev=c;}
 assert.equal(Object.keys(L.paleta(2.5)).length,21);
 assert.equal(L.etiqueta('logo',0),'ALETEO');assert.equal(L.etiqueta('logo',5),'ENCIERRO');
 assert.equal(L.corrompe('hola',0),'hola');
 assert.equal(L.choque(0,0),L.choque(0,0));
 assert.equal(M.medalla(9),'');assert.equal(M.medalla(50),'oro');
 assert.deepEqual(M.mezclaProgreso({mejor:5,hondo:2},{mejor:3,vuelos:4}),{v:1,mejor:5,hondo:2,vuelos:4});
});

test('el verificador acepta el vuelo honesto y rechaza las trampas',async()=>{
 const {E,p}=prueba(99,'ana');
 assert.equal(await V.verificaClub('aleteo',dato(E,'ana'),p),null);
 const mal=async(d,q)=>assert.notEqual(await V.verificaClub('aleteo',d,q),null);
 await mal({...dato(E,'ana'),puntos:E.puntos+1},p);
 await mal({...dato(E,'ana'),tiempo:M.msDe(E.t)-100},p);
 await mal(dato(E,'beto'),p);
 await mal(dato(E,'ana'),{...p,u:'beto'});
 await mal(dato(E,'ana'),{...p,r:M.msDe(E.t)*0.5});
 await mal(dato(E,'ana'),{...p,n:p.n+1});
 await mal(dato(E,'ana'),{...p,f:'x'+p.f.slice(1)});
 await mal(dato(E,'ana'),{...p,s:p.s+1});
 await mal(dato(E,'ana'),{...p,v:2});
});

test('sospecha de tiempos imposibles',()=>{
 assert.equal(VA.sospecha(CAT,{puntos:10,tiempo:M.msDe(M.ticksMinimos(10))+500}),null);
 assert.notEqual(VA.sospecha(CAT,{puntos:10,tiempo:1000}),null);
 assert.notEqual(VA.sospecha(CAT,{puntos:200000,tiempo:1e9}),null);
});

test('las versiones y las reglas',()=>{
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 assert.match(html,/\?v=aleteo-\d+/);
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.match(reglas,/aleteo-vuelo/);
});
