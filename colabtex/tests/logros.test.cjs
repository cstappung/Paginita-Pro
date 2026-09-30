const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import .*$/mg,'').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n;globalThis.__L={LOGROS,detecta,deFila,deMarca,reparto,SOLO_PREFIJO,reducir,JUEGOS};',context);
const {LOGROS,detecta,deFila,deMarca,reparto,reducir,JUEGOS}=context.__L;

test('diez logros por juego, con ids válidos y únicos',()=>{
 const juegos=[...Object.keys(JUEGOS),'minas','snake','tetrisclub','sortem'];
 for(const j of juegos){
  assert.ok(LOGROS[j],j);assert.equal(LOGROS[j].length,10,j);
  const ids=LOGROS[j].map(x=>x.id);assert.equal(new Set(ids).size,10,j);
  for(const x of LOGROS[j]){assert.match(x.id,/^[a-z0-9]{1,20}$/,j+'/'+x.id);assert.ok(x.n&&x.d&&x.i,j+'/'+x.id);}
 }
 const reglas=JSON.parse(fs.readFileSync('../firebase/database.rules.json','utf8'));
 const re=new RegExp(reglas.rules.logros.$juego['.validate'].match(/matches\(\/(.*)\/\)/)[1]);
 for(const j of Object.keys(JUEGOS))assert.ok(re.test(j),'regla sin '+j);
});
test('los de la fila salen de ganadas, racha y jugadas',()=>{
 assert.deepEqual([...deFila(null)],[]);
 assert.deepEqual([...deFila({ganadas:1,jugadas:1,mejorRacha:1})],['primera']);
 assert.deepEqual([...deFila({ganadas:10,jugadas:30,mejorRacha:3})].sort(),['asiduo','diez','primera','racha']);
});
test('los individuales salen de la marca y su categoría',()=>{
 assert.deepEqual([...deMarca('minas',{categoria:'club-minas-easy',puntos:1,tiempo:4000})].sort(),['easy','easy10','easy5']);
 assert.deepEqual([...deMarca('snake',{categoria:'club-snake-classic-gigante',puntos:1600,tiempo:1})].sort(),['classic','gigante','p1500']);
 assert.deepEqual([...deMarca('tetrisclub',{categoria:'club-tetris-sprint',puntos:40,tiempo:100000})].sort(),['s120','s180','sprint']);
});
test('detecta no revienta en partidas vacías ni terminadas',()=>{
 for(const juego of Object.keys(JUEGOS)){
  const p={juego,semilla:1,estado:'jugando',cupo:2,jugadores:{a:{nombre:'a',orden:0},b:{nombre:'b',orden:1}},jugadas:{}};
  let est;try{est=reducir(p);}catch(e){continue;}
  assert.ok(Array.isArray([...detecta(p,est,'a')]),juego);
  p.jugadas['0000']={t:'voto',uid:'a',contra:'b'};
  try{est=reducir(p);}catch(e){continue;}
  const r=[...detecta(p,est,'a')];
  for(const id of r)assert.ok(LOGROS[juego].some(x=>x.id===id),juego+'/'+id);
 }
});
test('reparto junta fila, marca y guardados, y cuenta la gente',()=>{
 const R=reparto({reversi:{a:{ganadas:1,jugadas:1,mejorRacha:1},b:{ganadas:0,jugadas:2}}},
  {'club-minas-easy':{a:{puntos:1,tiempo:20000}}},{reversi:{b:{esquinas:123}}});
 assert.ok(R.tiene.reversi.primera.has('a'));assert.ok(!R.tiene.reversi.primera.has('b'));
 assert.ok(R.tiene.reversi.esquinas.has('b'));assert.equal(R.gente.reversi.size,2);
 assert.ok(R.tiene.minas.easy.has('a'));assert.ok(!R.tiene.minas.easy10.has('a'));assert.equal(R.gente.minas.size,1);
});
test('sortEm: los logros salen del modo y del tiempo',()=>{
 assert.deepEqual([...deMarca('sortem',{categoria:'club-sortem-10',puntos:10,tiempo:14000})],['d10','d10t30','d10t15']);
 assert.deepEqual([...deMarca('sortem',{categoria:'club-sortem-30',puntos:30,tiempo:100000})],['d30','d30t120']);
});
