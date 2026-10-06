const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir,meToca}=context;

const sala=(variante='clasico',semilla=2)=>({juego:'gato',variante,semilla,estado:'jugando',anfitrion:'a',jugadores:{a:{nombre:'Ana',orden:0},b:{nombre:'Beto',orden:1}},jugadas:{}});
const pon=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p);};
/* Juega casillas alternando según el turno que dice el reductor. */
const serie=(p,is)=>{let est=reducir(p);for(const i of is)est=pon(p,{t:'p',uid:est.turno,i});return est;};

test('Clásico: la X abre y tres en raya gana',()=>{
 const p=sala();let est=reducir(p);
 assert.equal(est.fase,'jugando');assert.equal(est.turno,est.equis);assert.ok(meToca(est,est.equis));
 est=serie(p,[0,4,1,8,2]);
 assert.equal(est.fase,'fin');assert.equal(est.ganador,est.equis);assert.equal(est.motivo,'raya');
 assert.deepEqual([...est.linea],[0,1,2]);
});

test('Clásico: nueve casillas sin raya es empate',()=>{
 const est=serie(sala(),[0,1,2,4,3,5,7,6,8]);
 assert.equal(est.ganador,'');assert.equal(est.motivo,'empate');
});

test('La semilla decide quién lleva la X',()=>{
 assert.equal(reducir(sala('clasico',2)).equis,'a');
 assert.equal(reducir(sala('clasico',3)).equis,'b');
});

test('Fuera de turno, casilla ocupada o fuera del tablero no cuentan',()=>{
 const p=sala();let est=reducir(p);const o=est.circulos;
 est=pon(p,{t:'p',uid:o,i:0});assert.equal(est.movs,0);
 est=pon(p,{t:'p',uid:est.equis,i:0});
 est=pon(p,{t:'p',uid:o,i:0});assert.equal(est.movs,1);
 est=pon(p,{t:'p',uid:o,i:9});assert.equal(est.movs,1);
 assert.equal(est.turno,o);
});

test('Super: la casilla jugada manda al gato de esa posición',()=>{
 const p=sala('super');let est=reducir(p);
 assert.equal(est.tab.length,81);assert.equal(est.forzado,-1);
 est=pon(p,{t:'p',uid:est.equis,i:4*9+2});    // gato central, casilla 2
 assert.equal(est.forzado,2);
 const o=est.circulos;
 est=pon(p,{t:'p',uid:o,i:0*9+5});assert.equal(est.movs,1,'fuera del gato obligado no vale');
 est=pon(p,{t:'p',uid:o,i:2*9+7});assert.equal(est.movs,2);assert.equal(est.forzado,7);
});

test('Super: si te mandan a un gato cerrado, eliges libre',()=>{
 const p=sala('super');
 let est=serie(p,[0,3,3*9+1,9+0,1,9+4,36+0,4,36+8,72+0,2]);
 assert.equal(est.grande[0],'x','X gana el gato de arriba a la izquierda');
 assert.equal(est.forzado,2);
 est=pon(p,{t:'p',uid:est.turno,i:2*9+0});          // casilla 0 → gato 0, ya cerrado
 assert.equal(est.forzado,-1);
 est=pon(p,{t:'p',uid:est.turno,i:8*9+8});assert.equal(est.tab[80],'x');
 const antes=est.movs;est=pon(p,{t:'p',uid:est.turno,i:0*9+8});
 assert.equal(est.movs,antes,'no se juega en un gato ganado');
});

test('Super: tres gatos en raya ganan la partida',()=>{
 const p=sala('super');
 // X gana los gatos 0, 1 y 2 de la fila de arriba; O responde donde le manden.
 let est=reducir(p);let guard=0;
 const objetivo=[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]];
 while(est.fase==='jugando'&&guard++<200){
  let i;
  if(est.turno===est.equis){
   const op=objetivo.find(([g,c])=>!est.tab[g*9+c]&&!est.grande[g]&&(est.forzado<0||est.forzado===g));
   i=op?op[0]*9+op[1]:est.tab.findIndex((v,k)=>!v&&!est.grande[Math.floor(k/9)]&&(est.forzado<0||Math.floor(k/9)===est.forzado));
  }else{
   i=est.tab.findIndex((v,k)=>{const g=Math.floor(k/9);return !v&&!est.grande[g]&&(est.forzado<0||g===est.forzado)&&g>2;});
   if(i<0)i=est.tab.findIndex((v,k)=>{const g=Math.floor(k/9);return !v&&!est.grande[g]&&(est.forzado<0||g===est.forzado);});
  }
  est=pon(p,{t:'p',uid:est.turno,i});
 }
 assert.equal(est.fase,'fin');assert.ok(est.motivo==='raya'||est.motivo==='empate');
 if(est.motivo==='raya')assert.ok(est.linea&&est.linea.length===3);
});

test('Abandonar da la partida al otro',()=>{
 const p=sala();let est=serie(p,[4]);
 est=pon(p,{t:'abandona',uid:est.equis});
 assert.equal(est.fase,'fin');assert.equal(est.ganador,est.circulos);assert.equal(est.motivo,'abandono');
});
