/* Antitrampas de sortEm: partidas de robot jugadas con el motor del juego
   (juegos/club/sortem/motor.js) que pasan, y una trampa de cada vía que el
   verificador rechaza. Ver docs/antitrampas/sortem.md. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const S=carga('src/juegos/solo/verifica/sortem.js');
const M=require('../../juegos/club/sortem/motor.js');

/* Un jugador que piensa: en cada paso elige el bloque y el destino que
   más «cortes» arreglan por tecla gastada (un corte es un par de vecinos
   que no son consecutivos). Queda cerca de lo óptimo (mediana de 28 teclas
   en el de 10 contra 24 del óptimo; 80 en el de 20), como alguien bueno. */
function cortes(b,n){const f=[0,...b.flat(),n+1];let c=0;for(let i=0;i+1<f.length;i++)if(f[i+1]!==f[i]+1)c++;return c;}
function macro(e,i,j){let a='';const d=i>e.sel?'R':'L';for(let k=0;k<Math.abs(i-e.sel);k++)a+=d;a+='A';const d2=j>i?'R':'L';for(let k=0;k<Math.abs(j-i);k++)a+=d2;return a+'A';}
function resuelve(n,semilla){
 const e=M.nuevo(n,semilla);let a='';
 for(let vuelta=0;!e.ganado;vuelta++){
  assert.ok(vuelta<200,'el robot no termina');
  const c0=cortes(e.bloques,n);let mejor=null;
  for(let i=0;i<e.bloques.length;i++)for(let j=0;j<e.bloques.length;j++){
   if(i===j)continue;
   const s=macro(e,i,j),x={...e,bloques:e.bloques.map(b=>b.slice())};
   for(const c of s)M.aplica(x,c);
   const nota=(c0-(x.ganado?0:cortes(x.bloques,n)))*8-s.length;
   if(!mejor||nota>mejor.nota)mejor={nota,s};
  }
  for(const c of mejor.s){a+=c;M.aplica(e,c);if(e.ganado)break;}
 }
 return a;
}

/* Le pone tiempos de persona a una secuencia: intervalos irregulares
   (lognormal) con pausas para pensar, a veces una tecla mantenida que se
   autorrepite, y la duración de cada pulsación. `ritmo` es el intervalo
   típico entre pulsaciones. */
function humano(n,semilla,{ritmo=200,piensa=0.15,pausa=[300,1500],manten=true,azar=1,varia=0.35}={}){
 const r=M.mulberry32(semilla^azar*0x9E3779B9);
 const gauss=()=>{let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
 const acc=resuelve(n,semilla);
 let a='',t=[],f='',k=[];
 for(let i=0;i<acc.length;){
  let j=i;while(j<acc.length&&acc[j]===acc[i])j++;
  const largo=j-i;
  const mantiene=manten&&acc[i]!=='A'&&largo>=4;
  for(let q=0;q<largo;q++){
   let dt;
   if(a.length===0)dt=210+Math.floor(r()*17);
   else if(mantiene&&q>0)dt=q===1?Math.round(230+r()*40):Math.round(31+r()*4);
   else{dt=Math.round(ritmo*Math.exp(varia*gauss()));if(r()<piensa)dt+=Math.round(pausa[0]+r()*(pausa[1]-pausa[0]));}
   a+=mantiene&&q>0?acc[i].toLowerCase():acc[i];
   t.push(Math.max(dt,8));f+='.';
   k.push(mantiene&&q>0?-1:Math.round(85*Math.exp(0.3*gauss())));
  }
  i=j;
 }
 if(k.length)k[k.length-1]=-1; // la última se suelta después de ganar
 const T=t.reduce((x,y)=>x+y,0);
 const w=T+Math.floor(r()*30);
 const p={v:1,n,s:semilla>>>0,d:1790000000000,w,a,t,f,k};
 return {dato:{categoria:'club-sortem-'+n,puntos:n,tiempo:M.tiempoDe(T,w),partida:'x'},p};
}
const v=(dato,p)=>V.verificaClub('sortem',dato,p);
const copia=x=>JSON.parse(JSON.stringify(x));

test('sortEm: el motor reparte sin vecinos consecutivos y siempre igual por semilla',()=>{
 for(let s=1;s<200;s++)for(const n of [10,20]){
  const a=M.reparto(n,s*7919);
  assert.deepEqual([...a].sort((x,y)=>x-y),Array.from({length:n},(_,i)=>i+1));
  for(let i=0;i+1<n;i++)assert.notEqual(Math.abs(a[i]-a[i+1]),1);
  assert.deepEqual(M.reparto(n,s*7919),a);
 }
 assert.notDeepEqual(M.reparto(10,1),M.reparto(10,2));
});

test('sortEm: el motor imita al juego (cursor, agarrar, mover, soltar y fundir)',()=>{
 const e={n:4,semilla:0,bloques:[[3],[1],[4],[2]],sel:0,agarrado:false,ganado:false};
 assert.equal(M.aplica(e,'L').cambio,false);           // borde: no se mueve
 M.aplica(e,'R');assert.equal(e.sel,1);
 M.aplica(e,'A');assert.ok(e.agarrado);
 M.aplica(e,'L');assert.deepEqual(e.bloques,[[1],[3],[4],[2]]);assert.equal(e.sel,0);
 let r=M.aplica(e,'A');assert.equal(r.fusiones,0);assert.equal(r.gano,false);
 M.aplica(e,'R');M.aplica(e,'R');M.aplica(e,'R');M.aplica(e,'A');
 M.aplica(e,'L');M.aplica(e,'L');
 r=M.aplica(e,'A');                                       // [1][2][3][4] → [1,2,3,4]
 assert.deepEqual(e.bloques,[[1,2,3,4]]);assert.ok(r.gano);assert.equal(r.fusiones,3);
 assert.equal(M.aplica(e,'R'),null);                      // ganada: no se mueve nada
 assert.equal(M.tiempoDe(5000,5100),5000);assert.equal(M.tiempoDe(5000,9000),9000);
});

test('sortEm: partidas humanas de robot pasan (lentas, normales y muy rápidas)',async()=>{
 let pasan=0,minimo=Infinity;
 for(let s=1;s<=60;s++){
  for(const n of [10,20]){
   for(const op of [{ritmo:260,piensa:0.25},{ritmo:170},{ritmo:110,piensa:0.06,pausa:[80,300]},{ritmo:170,manten:false}]){
    const {dato,p}=humano(n,(s*2654435761)>>>0,{...op,azar:s+n});
    if(dato.tiempo<S.MINIMO[n])continue; // un reparto de suerte con un robot más rápido que el piso
    assert.equal(await v(dato,p),null,JSON.stringify({s,n,op,t:dato.tiempo}));
    pasan++;if(n===10)minimo=Math.min(minimo,dato.tiempo);
   }
  }
 }
 assert.ok(pasan>=460,'pasaron '+pasan);
 assert.ok(minimo<4000,'la más rápida del de 10 tardó '+minimo); // tan rápida como la mejor marca real
});

test('sortEm: una partida a 3,5 s en el de 10 pasa (la mejor marca real)',async()=>{
 /* Unas 30 teclas a ~110 ms con muy pocas pausas: el ritmo de quien
    hizo 3,51 s. */
 let vistas=0;
 for(let s=1;s<=300&&vistas<10;s++){
  const {dato,p}=humano(10,s,{ritmo:95,piensa:0.03,pausa:[60,200],azar:7});
  if(dato.tiempo>3600||dato.tiempo<S.MINIMO[10])continue;
  vistas++;assert.equal(await v(dato,p),null,'tiempo '+dato.tiempo);
 }
 assert.ok(vistas>=3,'partidas de ~3,5 s encontradas: '+vistas);
});

test('sortEm: una persona muy rápida y muy constante no se confunde con un bot',async()=>{
 /* Diez teclas por segundo o más, con un ritmo muy parejo (CV ~0,1) y sin
    pausas: solo la juntaría alguien excepcional, pero suelta las teclas
    como una persona, así que pasa. */
 let vistas=0;
 for(let s=1;s<=40;s++)for(const n of [10,20]){
  const {dato,p}=humano(n,s*101,{ritmo:85,piensa:0,varia:0.1,manten:false,azar:s});
  if(dato.tiempo<S.MINIMO[n])continue;
  vistas++;assert.equal(await v(dato,p),null,n+' '+dato.tiempo);
 }
 assert.ok(vistas>=40,'vistas '+vistas);
});

test('sortEm: un ordenador que durmió a mitad de partida cuenta el reloj de pared',async()=>{
 const {dato,p}=humano(10,4242);
 const T=p.t.reduce((x,y)=>x+y,0);
 p.w=T+60000;dato.tiempo=M.tiempoDe(T,p.w);
 assert.equal(dato.tiempo,p.w);
 assert.equal(await v(dato,p),null);
 /* Pero declarar el tiempo de las teclas cuando el reloj de pared vio un
    minuto más (performance.now frenado desde la consola) no vale. */
 assert.match(await v({...dato,tiempo:T},p),/tiempo declarado/);
});

test('sortEm: resultados inventados y pruebas manipuladas se rechazan',async()=>{
 const {dato,p}=humano(10,777);
 assert.equal(await v(dato,p),null);
 // 1. Club.result a mano, sin prueba
 assert.match(await v({categoria:'club-sortem-10',puntos:10,tiempo:1,partida:'x'},undefined),/sin prueba/);
 assert.match(await v(dato,{v:1,n:10}),/reparto/);
 assert.match(await v(dato,{v:1}),/otro modo/);
 // puntos que no son los del modo, prueba de otro modo
 assert.match(await v({...dato,puntos:20},p),/puntos/);
 assert.match(await v({...dato,categoria:'club-sortem-20',puntos:20},p),/otro modo/);
 // 2. tiempo recortado
 assert.match(await v({...dato,tiempo:dato.tiempo-1000},p),/tiempo declarado/);
 // 3. otra semilla (la prueba de otra partida) o jugadas tocadas
 assert.match(await v(dato,{...p,s:(p.s+1)>>>0}),/no quedan ordenados|después/);
 const q=copia(p);q.a=q.a.slice(0,-1);q.t.pop();q.f=q.f.slice(0,-1);q.k.pop();
 assert.match(await v(dato,q),/no quedan ordenados/);
 const q2=copia(p);q2.a+='R';q2.t.push(100);q2.f+='.';q2.k.push(-1);
 assert.match(await v({...dato,tiempo:M.tiempoDe(q2.t.reduce((x,y)=>x+y,0),q2.w+100)},{...q2,w:q2.w+100}),/después de ordenar/);
 // formato roto
 assert.match(await v(dato,{...p,a:p.a+'X'}),/no se pueden leer/);
 assert.match(await v(dato,{...p,t:p.t.slice(1)}),/instantes/);
 assert.match(await v(dato,{...p,f:''}),/de dónde/);
 assert.match(await v(dato,{...p,v:2}),/versión/);
 // la primera tecla antes de la transición del juego
 const q3=copia(p);q3.t[1]+=q3.t[0]-50;q3.t[0]=50;
 assert.match(await v(dato,q3),/reaccionar/);
});

test('sortEm: el reloj acelerado o comprimido se rechaza',async()=>{
 const {dato,p}=humano(20,31337,{ritmo:180});
 assert.equal(await v(dato,p),null);
 for(const factor of [0.1,0.15]){
  const q=copia(p);q.t=q.t.map(x=>Math.round(x*factor));q.t[0]=Math.max(q.t[0],210);
  const T=q.t.reduce((x,y)=>x+y,0);q.w=T+5;
  assert.notEqual(await v({...dato,tiempo:M.tiempoDe(T,q.w)},q),null,'factor '+factor);
 }
 /* Marcar todo como autorrepetición para escapar del ritmo de pulsaciones
    no sirve: una repetición que no sigue a su misma tecla es pulsación. */
 const q=copia(p);q.a=q.a.toLowerCase();q.t=q.t.map((x,i)=>i?Math.round(x*0.2):x);
 const T=q.t.reduce((x,y)=>x+y,0);q.w=T;
 assert.notEqual(await v({...dato,tiempo:M.tiempoDe(T,q.w)},q),null);
});

/* Los bots: juegan partidas válidas (el motor las acepta), pero no como
   una persona. */
function bot(n,semilla,{paso=60,jitter=0,flag='u',hold=-1,azar=3}={}){
 const r=M.mulberry32(semilla^azar);
 const a=resuelve(n,semilla);
 const t=[...a].map((_,i)=>i?Math.max(1,Math.round(paso*(1+jitter*(2*r()-1)))):210);
 const T=t.reduce((x,y)=>x+y,0);
 const p={v:1,n,s:semilla,d:0,w:T+3,a,t,f:flag.repeat(a.length),k:t.map(()=>typeof hold==='function'?hold(r):hold)};
 return {dato:{categoria:'club-sortem-'+n,puntos:n,tiempo:M.tiempoDe(T,p.w),partida:'x'},p};
}
test('sortEm: bots de consola, de metrónomo y de ritmo inhumano se rechazan',async()=>{
 for(const s of [11,22,33]){
  for(const n of [10,20]){
   // eventos sintéticos (dispatchEvent) sin mando: isTrusted false
   let b=bot(n,s,{paso:300});assert.match(await v(b.dato,b.p),/script/);
   // cliente reescrito que se marca «de confianza»: metrónomo exacto
   b=bot(n,s,{paso:250,flag:'.',hold:60});assert.match(await v(b.dato,b.p),/metrónomo/);
   // metrónomo con un poco de ruido (±4 %)
   b=bot(n,s,{paso:250,jitter:0.07,flag:'.',hold:60});assert.match(await v(b.dato,b.p),/metrónomo|programa/);
   // ritmo inhumano (25 ms entre teclas)
   b=bot(n,s,{paso:25,jitter:0.5,flag:'.',hold:r=>Math.round(20+r()*80)});assert.notEqual(await v(b.dato,b.p),null);
   // ruido moderado pero sin soltar teclas y a más de 10 por segundo
   b=bot(n,s,{paso:85,jitter:0.2,flag:'.',hold:-1});assert.match(await v(b.dato,b.p),/programa|imposible/);
  }
 }
});

test('sortEm: las teclas de un mando conectado (mando.js) valen',async()=>{
 const {dato,p}=humano(10,9090);
 const q=copia(p);q.f=q.f.replace(/\./g,'m');
 assert.equal(await v(dato,q),null);
 const q2=copia(p);q2.f=q2.f.slice(0,5)+'u'+q2.f.slice(6);
 assert.match(await v(dato,q2),/script/);
});

test('sortEm: sospecha() de lo ya guardado sin prueba',()=>{
 assert.equal(S.sospecha('club-sortem-10',{puntos:10,tiempo:3510}),null);
 assert.equal(S.sospecha('club-sortem-10',{puntos:10,tiempo:14000}),null);
 assert.equal(S.sospecha('club-sortem-20',{puntos:20,tiempo:23600}),null);
 assert.match(S.sospecha('club-sortem-20',{puntos:20,tiempo:10200}),/inverosímil/);
 assert.match(S.sospecha('club-sortem-10',{puntos:10,tiempo:800}),/inverosímil/);
 assert.match(S.sospecha('club-sortem-10',{puntos:11,tiempo:8000}),/puntos/);
 assert.match(S.sospecha('club-sortem-10',{puntos:10}),/inverosímil/);
 assert.equal(V.sospechaFila('club-sortem-20',{puntos:20,tiempo:25000}),null);
});

test('sortEm: la prueba es compacta',()=>{
 const {p}=humano(20,5);
 assert.ok(JSON.stringify(p).length<6000,JSON.stringify(p).length);
});
