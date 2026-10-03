// Los mapas de Yemas zombis (`juegos/yemas/js/mapas.js`): datos puros, así
// que se recorren desde Node. Cada enlace del grafo tiene que caminarse de
// verdad (ningún muro, mueble ni máquina en medio), cada ventana tiene que
// dar a algún nodo y todo el grafo tiene que estar conectado.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('../juegos/yemas/js/mapas.js','utf8').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(src+'\n;globalThis.__M={MAPAS,LISTA_MAPAS,huellas};',ctx);
const {MAPAS,LISTA_MAPAS,huellas}=ctx.__M;
const R=0.3;          // medio ancho de un zombi, con algo de holgura
const PASO=0.6;       // un escalón se sube, uno más alto ya choca

const solidosDe=M=>M.__s||(M.__s=[...M.cajas.map(c=>({minx:c[0],minz:c[1],maxx:c[2],maxz:c[3],miny:c[4],maxy:c[5],o:c[7]})),...huellas(M)]);
const toca=(b,x,z)=>!(x+R<=b.minx||x-R>=b.maxx||z+R<=b.minz||z-R>=b.maxz);
// La caja que frena a alguien parado en (x, y, z). `sin` es la puerta del
// enlace (abierta, no cuenta).
function choca(M,x,z,y,sin){
 return solidosDe(M).find(b=>!(b.o?.puerta&&b.o.puerta===sin)&&toca(b,x,z)&&b.maxy>y+PASO&&b.miny<y+1.6);
}
// Camina de a hacia b como lo haría un cuerpo: sube lo que mide un escalón,
// cae si se acaba el piso. Devuelve el choque o la altura a la que llega.
function camina(M,[ax,az,ay],[bx,bz],sin){
 const L=Math.hypot(bx-ax,bz-az),n=Math.max(2,Math.ceil(L/0.1));let y=ay||0;
 for(let k=0;k<=n;k++){
  const t=k/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
  const c=choca(M,x,z,y,sin);if(c)return {c,x,z};
  let piso=0;for(const b of solidosDe(M))if(!(b.o?.puerta&&b.o.puerta===sin)&&toca(b,x,z)&&b.maxy<=y+PASO&&b.maxy>piso)piso=b.maxy;
  y=piso;
 }
 return {y};
}
const nombre=b=>`[${['minx','minz','maxx','maxz','miny','maxy'].map(k=>+(+b[k]).toFixed(2)).join(', ')}]`;

for(const [id] of LISTA_MAPAS){
 const M=MAPAS[id];
 test(`${id}: los nodos no están dentro de nada y los enlaces se caminan`,()=>{
  const mal=[];
  M.nodos.forEach(([x,z,y],i)=>{const b=choca(M,x,z,y,null);if(b)mal.push(`nodo ${i} (${x}, ${z}) dentro de ${nombre(b)}`);});
  for(const [a,b,p] of M.enlaces)for(const [u,v] of [[a,b],[b,a]]){
   const r=camina(M,M.nodos[u],M.nodos[v],p);
   if(r.c){mal.push(`enlace ${u}-${v} choca en (${r.x.toFixed(1)}, ${r.z.toFixed(1)}) con ${nombre(r.c)}`);break;}
   if(Math.abs(r.y-(M.nodos[v][2]||0))>0.7){mal.push(`enlace ${u}-${v} llega a la altura ${r.y.toFixed(2)}, no a la del nodo`);break;}
  }
  assert.deepEqual(mal,[],id);
 });
 test(`${id}: el grafo está conectado y cada ventana da a un nodo`,()=>{
  const ady=M.nodos.map(()=>[]);for(const [a,b] of M.enlaces){ady[a].push(b);ady[b].push(a);}
  const visto=new Set([0]),cola=[0];while(cola.length){const i=cola.pop();for(const j of ady[i])if(!visto.has(j)){visto.add(j);cola.push(j);}}
  assert.equal(visto.size,M.nodos.length,`${id}: nodos sueltos`);
  for(const v of M.ventanas){
   const d=Math.min(...M.nodos.filter(n=>Math.abs((n[2]||0)-v.y)<1).map(([x,z])=>Math.hypot(x-v.ix,z-v.iz)));
   assert.ok(d<9,`${id}: la ventana de (${v.x}, ${v.z}) queda a ${d.toFixed(1)} m del nodo más cercano`);
   assert.ok(!choca(M,v.ix,v.iz,v.y,null),`${id}: se cae dentro de algo en la ventana (${v.x}, ${v.z})`);
  }
  for(const [x,z] of M.brotes)assert.ok(!choca(M,x,z,0,null),`${id}: brote (${x}, ${z}) dentro de algo`);
  for(const [x,z] of M.spawns)assert.ok(!choca(M,x,z,0,null),`${id}: aparición (${x}, ${z}) dentro de algo`);
 });
}
