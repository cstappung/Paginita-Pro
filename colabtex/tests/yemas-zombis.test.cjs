// Yemas zombis: la curva de las rondas (`zombis.js`) y el choque con los
// zombis (`mundo.js`), sin Three.js: se cargan solo los trozos puros.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const leer=(f,de,a)=>{const s=fs.readFileSync(f,'utf8');const i=s.indexOf(de),j=s.indexOf(a,i);assert.ok(i>=0&&j>i,f+': no encuentro '+de);return s.slice(i,j).replace(/\bexport\s+/g,'');};
const ctx={};vm.createContext(ctx);
vm.runInContext(leer('../juegos/yemas/js/zombis.js','export const ZB','const r1 =')+
 '\n;globalThis.__Z={hpRonda,totalRonda,velRonda,maxVivos,MAX_ZOMBIS,mordidaRonda,tipoRonda,velCorredor,NOVEDAD_RONDA,novedadRonda,TIPOS,CLASE,FORMA,esPerros,esJefe,jefesRonda,jefeHp,totalPerros,maxPerros,velPerro,maxDe,TOPE_VIVOS};',ctx);
vm.runInContext(leer('../juegos/yemas/js/mundo.js','export const ALTO','const MITAD')+
 leer('../juegos/yemas/js/mundo.js','function solapa','// ---------- Rayos')+
 '\n;globalThis.__M={moverCuerpo,empujaCuerpo,metido,ALTO,RADIO};',ctx);
const Z=ctx.__Z,M=ctx.__M;
const V=(x=0,y=0,z=0)=>({x,y,z});

test('nunca hay más de 24 zombis en pie, ni con cuatro jugadores en la ronda 100',()=>{
 for(let n=1;n<=8;n++)for(let r=1;r<=200;r++)assert.ok(Z.maxVivos(n,r)<=Z.MAX_ZOMBIS);
 assert.equal(Z.MAX_ZOMBIS,24);
 assert.equal(Z.maxVivos(4,60),24);
 assert.ok(Z.maxVivos(1,1)<=8,'la primera ronda en solitario es tranquila');
});

test('la dificultad sube despacio',()=>{
 // Los comunes no alcanzan al jugador caminando (7 m/s) en ninguna ronda.
 for(let r=1;r<=100;r++)assert.ok(Z.velRonda(r)*1.15<7);
 assert.ok(Z.velRonda(5)<3.2,'a la ronda 5 todavía caminan');
 // Hasta la ronda 4 no hay corredores ni grandotes.
 for(let r=1;r<=4;r++)for(const a of [0,0.1,0.5,0.99])assert.equal(Z.tipoRonda(r,a),'n');
 assert.equal(Z.tipoRonda(7,0),'c','en la 7 ya hay corredores pero no grandotes');
 assert.equal(Z.tipoRonda(8,0),'g');
 // El corredor recién alcanza al que camina hacia la ronda 13.
 assert.ok(Z.velCorredor(12)<7&&Z.velCorredor(13)>=7);
 // Con 100 de vida: cuatro mordiscos al principio, dos recién hacia la novena.
 assert.ok(Z.mordidaRonda(1)<34);
 assert.ok(Z.mordidaRonda(8)<50&&Z.mordidaRonda(9)>=50);
 assert.ok(Z.mordidaRonda(500)<=75);
 assert.ok(Z.totalRonda(1,1)<=7&&Z.totalRonda(10,1)<=30);
 for(const r of Object.keys(Z.NOVEDAD_RONDA))assert.ok(+r>=5,'los avisos coinciden con la curva');
});

test('cada clase nueva llega en su ronda, como en Black Ops',()=>{
 const desde={c:5,g:8,t:10,f:15,x:18,k:22};
 const azares=[...Array(200).keys()].map(i=>i/200);
 for(let r=1;r<=40;r++){
  const salen=new Set(azares.map(a=>Z.tipoRonda(r,a)));
  for(const [t,d] of Object.entries(desde))assert.equal(salen.has(t),r>=d,`${t} en la ronda ${r}`);
  assert.ok(!salen.has('p')&&!salen.has('j'),'perros y Mutante no salen en la mezcla');
 }
 // Élite: desde la 28 casi no quedan comunes.
 assert.ok(azares.filter(a=>Z.tipoRonda(30,a)==='n').length===0);
 assert.ok(azares.filter(a=>Z.tipoRonda(20,a)==='n').length>40);
});

test('rondas de perros y del Mutante',()=>{
 const perros=[...Array(40).keys()].map(i=>i+1).filter(Z.esPerros);
 assert.deepEqual(perros,[6,11,16,21,26,31,36]);
 const jefes=[...Array(40).keys()].map(i=>i+1).filter(Z.esJefe);
 assert.deepEqual(jefes,[20,25,30,35,40]);
 assert.ok(!perros.some(r=>Z.esJefe(r)),'nunca coinciden');
 assert.equal(Z.jefesRonda(20,4),1);assert.equal(Z.jefesRonda(30,1),1);assert.equal(Z.jefesRonda(30,2),2);assert.equal(Z.jefesRonda(21,4),0);
 assert.ok(Z.jefeHp(20,4)>Z.jefeHp(20,1),'más jugadores, más vida');
 assert.ok(Z.jefeHp(20,1)>=5*Z.hpRonda(20),"aguanta lo que una horda");
 for(let n=1;n<=8;n++)for(let r=6;r<=60;r+=5){assert.ok(Z.maxPerros(n,r)<=Z.MAX_ZOMBIS);assert.ok(Z.totalPerros(r,n)<=40);}
 assert.ok(Z.velPerro(6)<7&&Z.velPerro(26)>=7,'al principio se les escapa corriendo');
 assert.equal(Z.maxDe('j',20,2),Z.jefeHp(20,2));
 assert.equal(Z.maxDe('g',10,1),Math.round(Z.hpRonda(10)*3));
});

test('hay algo nuevo hasta pasada la ronda 30 y la red no se rompe',()=>{
 // Nunca pasan más de tres rondas sin un aviso de algo nuevo, de la 5 a la 31.
 let ultima=0;
 for(let r=5;r<=31;r++){if(Z.novedadRonda(r)){assert.ok(r-ultima<=3||ultima===0,`hueco antes de la ${r}`);ultima=r;}}
 assert.ok(ultima>=30);
 // Los índices de TIPOS viajan por la red: los tres primeros no se mueven.
 assert.deepEqual([...Z.TIPOS.slice(0,3)],['n','c','g']);
 for(const t of Z.TIPOS){assert.ok(Z.CLASE[t]&&Z.FORMA[t],t);assert.ok(Z.CLASE[t].mordida*Z.mordidaRonda(200)<=120);}
 assert.equal(new Set(Z.TIPOS).size,Z.TIPOS.length);
 // Las formas de mundo.js (MEDIDA_Z) son las de zombis.js.
 const mundo=fs.readFileSync('../juegos/yemas/js/mundo.js','utf8');
 const m=/MEDIDA_Z = (\{[^}]*\})/.exec(mundo);assert.ok(m);
 const med=vm.runInNewContext('('+m[1]+')');
 for(const t of Z.TIPOS){const [e,a]=med[t]||[1,1];assert.equal(e,Z.FORMA[t].e,t);assert.equal(a,Z.FORMA[t].a,t);}
});

// Un muro de 4 m en x ∈ [5, 5.4] y un jugador apretado contra él.
const muro={minx:5,maxx:5.4,minz:-20,maxz:20,miny:0,maxy:4};
const cuerpo=x=>({pos:V(x,0,0),vel:V(),enSuelo:true});

test('un empujón contra un muro no lo atraviesa ni sube al jugador arriba',()=>{
 const c=cuerpo(5-M.RADIO-0.01);
 for(let i=0;i<200;i++){M.empujaCuerpo(c,0.25,0.05,[muro]);M.moverCuerpo(c,1/60,[muro]);}
 assert.ok(c.pos.x<=5-M.RADIO+1e-3,'no atraviesa');
 assert.ok(c.pos.y<0.01,'sigue en el suelo, no parado sobre el muro');
 assert.ok(!M.metido(c.pos,[muro]));
});

test('un cuerpo metido dentro de un muro sale por el costado, no por arriba',()=>{
 const c=cuerpo(5.1);
 M.moverCuerpo(c,1/60,[muro]);
 assert.ok(c.pos.y<0.01,'antes quedaba sobre el muro de cuatro metros, fuera del mapa');
 assert.ok(!M.metido(c.pos,[muro]));
 assert.ok(c.pos.x<5,'por el lado más cercano');
});

test('caer sobre una caja y subir un escalón siguen igual',()=>{
 const caja={minx:-1,maxx:1,minz:-1,maxz:1,miny:0,maxy:1};
 const c={pos:V(0,3,0),vel:V(),enSuelo:false};
 for(let i=0;i<120;i++)M.moverCuerpo(c,1/60,[caja]);
 assert.ok(Math.abs(c.pos.y-1)<1e-6&&c.enSuelo,'se apoya encima');
 const esc={minx:2,maxx:4,minz:-1,maxz:1,miny:0,maxy:0.4};
 const d=cuerpo(1.4);d.vel.x=3;
 for(let i=0;i<60;i++){d.vel.x=3;M.moverCuerpo(d,1/60,[esc]);}
 assert.ok(Math.abs(d.pos.y-0.4)<1e-6,'sube el escalón caminando');
});
