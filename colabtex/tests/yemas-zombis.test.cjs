// Yemas zombis: la curva de las rondas (`zombis.js`) y el choque con los
// zombis (`mundo.js`), sin Three.js: se cargan solo los trozos puros.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const leer=(f,de,a)=>{const s=fs.readFileSync(f,'utf8');const i=s.indexOf(de),j=s.indexOf(a,i);assert.ok(i>=0&&j>i,f+': no encuentro '+de);return s.slice(i,j).replace(/\bexport\s+/g,'');};
const ctx={};vm.createContext(ctx);
vm.runInContext(leer('../juegos/yemas/js/zombis.js','export const ZB','const r1 =')+
 '\n;globalThis.__Z={hpRonda,totalRonda,velRonda,maxVivos,MAX_ZOMBIS,mordidaRonda,tipoRonda,velCorredor,NOVEDAD_RONDA};',ctx);
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
