const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import .*$/mg,'').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n;globalThis.__L={LOGROS,detecta,deFila,deMarca,reparto,SOLO_PREFIJO,reducir,JUEGOS};',context);
const {LOGROS,detecta,deFila,deMarca,reparto,reducir,JUEGOS}=context.__L;

test('diez logros por juego, con ids válidos y únicos',()=>{
 const juegos=[...Object.keys(JUEGOS),'minas','snake','tetrisclub','sortem','bbtan','sopa','electro','frontera','sudoku','fanal','atasco'];
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
 assert.deepEqual([...deMarca('bbtan',{categoria:'club-bbtan-rondas',puntos:32,tiempo:60000})],['r10','r20','r30']);
 assert.deepEqual([...deMarca('sortem',{categoria:'club-sortem-20',puntos:20,tiempo:35000})],['d20','d20t60','d20t40']);
});
test('Sudoku Arcade: racha, clásico por tiempo y arcade por puntos',()=>{
 assert.deepEqual([...deMarca('sudoku',{categoria:'club-sudoku-racha',puntos:7,tiempo:1})],['dia1','racha3','racha7']);
 assert.deepEqual([...deMarca('sudoku',{categoria:'club-sudoku-medio',puntos:1,tiempo:240000})],['medio5']);
 assert.deepEqual([...deMarca('sudoku',{categoria:'club-sudoku-experto',puntos:1,tiempo:3600000})],['experto']);
 assert.deepEqual([...deMarca('sudoku',{categoria:'club-sudoku-arcade',puntos:26000,tiempo:1})],['a10000','a25000']);
});
test('FANAL: la travesía por jornadas y los puntos de cada modo',()=>{
 // Jornadas completadas: 4 la Nodriza, 8 el Faro, 11 la Esfinge, 13 el Alba.
 assert.deepEqual([...deMarca('fanal',{categoria:'club-fanal-jornadas',puntos:8,tiempo:1})],['j4','j8']);
 assert.deepEqual([...deMarca('fanal',{categoria:'club-fanal-jornadas',puntos:13,tiempo:1})],['j4','j8','j11','alba']);
 assert.deepEqual([...deMarca('fanal',{categoria:'club-fanal-jornadas',puntos:31,tiempo:1})],['j4','j8','j11','alba','sf20','sf30']);
 assert.deepEqual([...deMarca('fanal',{categoria:'club-fanal-travesia',puntos:61000,tiempo:1})],['p20k','p60k']);
 assert.deepEqual([...deMarca('fanal',{categoria:'club-fanal-sinfin',puntos:120000,tiempo:1})],['s100k']);
 // Los puntos del sin fin no dan logros de la travesía, ni al revés.
 assert.deepEqual([...deMarca('fanal',{categoria:'club-fanal-sinfin',puntos:61000,tiempo:1})],[]);
});
test('Atasco: los logros salen de las estrellas juntadas',()=>{
 assert.deepEqual([...deMarca('atasco',{categoria:'club-atasco-estrellas',puntos:1,tiempo:1})],['e1']);
 assert.deepEqual([...deMarca('atasco',{categoria:'club-atasco-estrellas',puntos:65,tiempo:1})],['e1','e30','e60']);
 assert.deepEqual([...deMarca('atasco',{categoria:'club-atasco-estrellas',puntos:720,tiempo:1})].length,10);
 assert.deepEqual([...deMarca('atasco',{categoria:'club-fanal-travesia',puntos:720,tiempo:1})],[]);
});
