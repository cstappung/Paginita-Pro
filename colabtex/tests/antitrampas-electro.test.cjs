/* Antitrampas de Electrodle (docs/antitrampas/electro.md): partidas de
   robot jugadas con el motor del juego que pasan, y una trampa de cada vía
   que se rechaza. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica/electro.js');
const R=carga('src/juegos/solo/verifica.js');
const M=require('../../juegos/club/electro/motor.js');

/* ---------- el robot ---------- */
function rng(s){return M.mulberry32(s);}
const numeroDe=f=>M.numeroDia(f)-M.numeroDia('2026-10-01')+1;
const masDias=(f,k)=>new Date((M.numeroDia(f)+k)*864e5).toISOString().slice(0,10);
const ahoraDe=f=>new Date(f+'T18:00:00Z');   // 15:00 o 14:00 en Chile: ese mismo día
/* Lo que intenta un robot en un modo de un día: `fallos` intentos errados y
   después el objetivo, o (en un desafío) perder. */
function juega(modo,fecha,r,fallos,pierde){
 const obj=M.objetivoDelDia(modo,fecha),i=[];
 if(modo==='band'){
  const t=M.reto(modo,obj),P=M.X.PERMITIDOS;
  const azar=()=>P.map(l=>l[Math.floor(r()*l.length)].toString(12)).join('');
  const k=pierde?M.X.INTENTOS_BANDAS:Math.min(fallos,M.X.INTENTOS_BANDAS-1);
  while(i.length<k){const c=azar();if(c!==t&&!i.includes(c))i.push(c);}
  if(!pierde)i.push(t);
  return i;
 }
 if(modo==='circ'){
  const t=M.reto(modo,obj).resp;
  const k=pierde?M.X.INTENTOS_CIRCUITO:Math.min(fallos,M.X.INTENTOS_CIRCUITO-1);
  /* Como lo guarda el juego: String(leeNumero(lo escrito)). */
  for(let j=0;j<k;j++)i.push(String(+(t*(2+j)).toPrecision(6)));
  if(!pierde)i.push(String(+t.toPrecision(r()<0.5?6:4)));
  return i.filter(x=>!/e/.test(x));
 }
 if(modo==='conx'){
  const c=M.reto(modo,obj),grupos=c.grupos.map(g=>g.f.map(x=>c.fichas.indexOf(x)).sort((a,b)=>a-b).join('-'));
  const mal=[];for(let a=0;a<4&&mal.length<4;a++)for(let b=a+1;b<4&&mal.length<4;b++){const g1=c.grupos[a].f,g2=c.grupos[b].f;mal.push([g1[0],g1[1],g2[0],g2[1]].map(x=>c.fichas.indexOf(x)).sort((x,y)=>x-y).join('-'));}
  if(pierde)return mal.slice(0,4);
  return mal.slice(0,Math.min(fallos,3)).concat(grupos);
 }
 const L=M.MODO[modo].lista.filter(x=>x.id!==obj);
 while(i.length<fallos){const x=L[Math.floor(r()*L.length)].id;if(!i.includes(x))i.push(x);}
 i.push(obj);
 return i;
}
/* La forma de una persona: entre un intento y el siguiente, un tiempo
   repartido en escala logarítmica entre msIntento[0] y msIntento[1] (unos
   son reflejos, otros piensan un minuto), y unas cuantas teclas o toques. */
const humano=(n,r,[a,b])=>({t:Array.from({length:n},()=>[Math.round(a*Math.pow(b/a,r())),2+Math.floor(r()*12)]),u:0,mc:0});
/* Un día entero, como lo deja el juego (M.registra con lo intentado y su
   forma). `reloj` escala el reloj del juego (1 = honesto). */
function dia(e,fecha,r,{msIntento=[4000,40000],saltea=0,modos=M.DIARIOS,forma=humano,reloj=1}={}){
 for(const modo of modos){
  if(r()<saltea)continue;
  const fallos=Math.floor(r()*(modo==='comp'?9:4))+(modo==='comp'?1:0),pierde=M.MODO[modo].reto&&r()<0.15;
  const i=juega(modo,fecha,r,fallos,pierde),s=M.estado(modo,M.objetivoDelDia(modo,fecha),i);
  assert.ok(s.fin,'el robot termina '+modo+' '+fecha);
  const f=forma&&forma(i.length,r,msIntento,modo);
  const ms=Math.round((f?f.t.reduce((t,x)=>t+x[0],0):i.length*20000)*reloj);
  e=M.registra(e,fecha,modo,i,ms,s.gano,f);
 }
 return e;
}
function historial(desde,dias,semilla,op){
 let e=M.vacio(),r=rng(semilla),f=desde;
 for(let k=0;k<dias;k++,f=masDias(f,1))if(r()>(op&&op.faltan||0))e=dia(e,f,r,op);
 return e;
}
const datoPuntos=e=>{const t=M.total(e);return {categoria:'club-electro-puntos',puntos:t.puntos,tiempo:Math.min(604800000,Math.max(1,t.ms)),partida:'x'};};
const datoRacha=(e,f)=>({categoria:'club-electro-racha',puntos:M.racha(e,f),tiempo:Math.min(604800000,Math.max(1,M.tiempoDia(e,f))),partida:'x'});
const ultimo=e=>Object.keys(e.hist).sort().pop();
const copia=x=>JSON.parse(JSON.stringify(x));

/* ---------- honestos ---------- */
test('Electrodle: un año de juego honesto pasa y su prueba cabe holgada',()=>{
 const e=historial('2026-10-12',365,7,{faltan:0.1}),f=ultimo(e),p=M.prueba(e,f);
 const largo=JSON.stringify(p).length;
 assert.ok(largo<80000,'la prueba de un año ocupa '+largo);
 assert.equal(V.verifica(datoPuntos(e),p,ahoraDe(f)),null);
 /* Lo de hoy, con el reloj real y pasando por el registro, como en la página. */
 const hoy=M.diaChile(),h=dia(M.vacio(),hoy,rng(8));
 return R.verificaClub('electro',datoPuntos(h),M.prueba(h,hoy)).then(m=>assert.equal(m,null));
});
test('Electrodle: lento, rápido-pero-humano, días salteados y desafíos perdidos pasan',()=>{
 for(const [k,op] of [[1,{msIntento:[60000,600000]}],[2,{msIntento:[600,2500]}],[3,{saltea:0.5,faltan:0.5}],[4,{}]]){
  const e=historial('2026-10-13',40,k*101,op),f=ultimo(e);
  assert.equal(V.verifica(datoPuntos(e),M.prueba(e,f),ahoraDe(f)),null,'robot '+k);
 }
});
test('Electrodle: lo guardado antes de la prueba (sin lo intentado) vale hasta el corte',()=>{
 let e=M.vacio();
 /* El estreno, con Científico todavía en el diario, y días viejos como
    los guarda el juego anterior: solo el número de intentos. */
 for(const f of ['2026-10-01','2026-10-02'])for(const m of ['comp','cien','form','simb'])e=M.registra(e,f,m,3,25000,true);
 e=M.registra(e,'2026-10-03','band',6,90000,false);
 e=M.registra(e,'2026-10-03','circ',1,30000,true);
 e=dia(e,'2026-10-12',rng(5));e=dia(e,'2026-10-13',rng(6));
 assert.equal(V.verifica(datoPuntos(e),M.prueba(e,'2026-10-13'),ahoraDe('2026-10-13')),null);
 /* El blob guardado pasa por limpia y mezcla sin perder lo intentado. */
 const otro=M.mezcla(M.vacio(),copia(e));
 assert.deepEqual(M.prueba(otro,'2026-10-13'),M.prueba(e,'2026-10-13'));
 /* A igual puntaje, la mezcla se queda con el que trae lo intentado. */
 const viejo=M.registra(M.vacio(),'2026-10-13','comp',e.hist['2026-10-13'].comp[1],5000,true);
 assert.ok(M.mezcla(viejo,e).hist['2026-10-13'].comp[4]);
 assert.ok(M.mezcla(e,viejo).hist['2026-10-13'].comp[4]);
 /* Pasado el corte, un día sin lo intentado ya no se cree. */
 e=M.registra(e,'2026-10-14','comp',1,20000,true);
 assert.match(V.verifica(datoPuntos(e),M.prueba(e,'2026-10-14'),ahoraDe('2026-10-14')),/sin lo intentado/);
});
test('Electrodle: la racha se prueba con los clásicos de hoy',()=>{
 const e=historial('2026-10-12',20,33),f=ultimo(e);
 assert.equal(M.racha(e,f),20);
 assert.equal(V.verifica(datoRacha(e,f),M.prueba(e,f,true),ahoraDe(f)),null);
 /* Hoy mismo, con el reloj real, por el registro. */
 const hoy=M.diaChile(),h=dia(M.vacio(),hoy,rng(9),{modos:M.CLASICOS});
 return R.verificaClub('electro',datoRacha(h,hoy),M.prueba(h,hoy,true)).then(m=>assert.equal(m,null));
});
test('Electrodle: lo intentado ida y vuelta, y la forma que limpia acepta',()=>{
 const r=rng(3);
 for(let k=0;k<200;k++){
  const f=masDias('2026-10-01',k);
  for(const m of M.IDS_MODOS){const i=juega(m,f,r,4,false);assert.deepEqual(M.decodificaIntentos(m,M.codificaIntentos(m,i)),i,m);}
 }
 assert.equal(M.decodificaIntentos('comp','#'),null);
 assert.equal(M.decodificaIntentos('band','472'),null);
 /* Lo intentado que no cuadra con el número de intentos no se guarda. */
 const e=M.limpia({hist:{'2026-10-20':{comp:[100,2,9000,1,['resistencia']]}}});
 assert.equal(e.hist['2026-10-20'].comp.length,4);
});

/* ---------- trampas ---------- */
const BASE=(()=>{const e=historial('2026-10-12',30,77),f=ultimo(e);return {e,f,p:M.prueba(e,f),ahora:ahoraDe(f)};})();
const rechaza=(dato,p,re,ahora=BASE.ahora)=>{const m=V.verifica(dato,p,ahora);assert.ok(m,'tenía que rechazar');if(re)assert.match(m,re);};
test('Electrodle: un número inventado, sin prueba o con los puntos inflados no pasa',async()=>{
 const d=datoPuntos(BASE.e);
 assert.match(await R.verificaClub('electro',{...d,puntos:999999},null),/sin prueba/);
 rechaza({...d,puntos:d.puntos+100},BASE.p,/puntos declarados/);
 rechaza({...d,puntos:999999},BASE.p,/puntos declarados/);
 rechaza({...d,tiempo:Math.max(1,d.tiempo-60000)},BASE.p,/tiempo declarado/);
 rechaza(d,{v:2,f:BASE.f,m:[],d:[]},/prueba/);
 rechaza(d,null);
});
test('Electrodle: editar el historial guardado no sube los puntos',()=>{
 /* Editar hist a mano: los puntos de lo guardado (v[0]) no se creen. */
 const e=copia(BASE.e);for(const f of Object.keys(e.hist))for(const v of Object.values(e.hist[f]))v[0]=100;
 rechaza(datoPuntos(e),M.prueba(e,BASE.f),/puntos declarados/);
 /* Decir «a la primera» sin cambiar lo intentado: limpia descarta lo
    intentado y el día queda sin respaldo. */
 const e2=copia(BASE.e);for(const f of Object.keys(e2.hist))e2.hist[f].comp&&(e2.hist[f].comp[1]=1);
 rechaza(datoPuntos(M.limpia(e2)),M.prueba(M.limpia(e2),BASE.f),/sin lo intentado/);
 /* Recortar lo intentado a solo el acierto: el modo no es el que se jugó,
    y si se fabrica a mano el historial perfecto, la suerte lo delata. */
 let e3=M.vacio();
 for(let k=0;k<30;k++){const f=masDias('2026-10-12',k);for(const m of M.DIARIOS){const i=juega(m,f,rng(k),0,false);e3=M.registra(e3,f,m,i,30000,true,humano(i.length,rng(k+50),[3000,30000]));}}
 rechaza(datoPuntos(e3),M.prueba(e3,ultimo(e3)),/no es suerte/,ahoraDe(ultimo(e3)));
});
test('Electrodle: un acierto que no es el objetivo de esa fecha y modo no pasa',()=>{
 const d=datoPuntos(BASE.e);
 /* La prueba corrida un día: lo intentado ya no acierta. */
 const p=copia(BASE.p);for(const fila of p.d)fila[0]-=1;
 rechaza(d,p,/no acierta|sigue después/);
 /* La partida de práctica (objetivo al azar) colada como diario. */
 const e=copia(BASE.e),r=rng(4);
 const prac=M.objetivoAlAzar('comp',r,M.objetivoDelDia('comp',BASE.f));
 e.hist[BASE.f].comp=[100,1,20000,1,[prac]];
 rechaza(datoPuntos(e),M.prueba(e,BASE.f),/no acierta/);
 /* Fórmula jugada contra el objetivo de Componente. */
 const p2=copia(BASE.p),k=p2.m.indexOf('comp');p2.m[k]='form';
 rechaza(d,p2);
});
test('Electrodle: Científico (práctica) no suma como diario',()=>{
 const e=copia(BASE.e),f=BASE.f,obj=M.objetivoDelDia('cien',f);
 e.hist[f].cien=[100,1,30000,1,[obj]];
 rechaza(datoPuntos(e),M.prueba(e,f),/práctica/);
});
test('Electrodle: días futuros, de antes del estreno o fuera de la prueba no pasan',()=>{
 const d=datoPuntos(BASE.e);
 /* Jugar mañana adelantando el reloj, y verificar con el de verdad. */
 rechaza(d,BASE.p,/todavía no llega/,ahoraDe(masDias(BASE.f,-1)));
 /* Un día anterior al estreno. */
 const e=dia(copia(BASE.e),'2026-09-20',rng(2));
 rechaza(datoPuntos(e),M.prueba(e,BASE.f));
 const p=copia(BASE.p);p.f='2026-09-30';rechaza(d,p,/antes del estreno/);
 /* Un día después del de la prueba. */
 const e2=dia(copia(BASE.e),masDias(BASE.f,3),rng(2));
 rechaza(datoPuntos(e2),M.prueba(e2,BASE.f),/posterior/);
 /* Días repetidos (el mismo día contado dos veces). */
 const p3=copia(BASE.p);p3.d.push(p3.d[p3.d.length-1]);rechaza({...d,puntos:d.puntos*2},p3,/repetidos/);
});
test('Electrodle: prueba manipulada: seguir después de acertar, repetir, intentos imposibles',()=>{
 const d=datoPuntos(BASE.e);
 const toca=(fn,re)=>{const p=copia(BASE.p);fn(p);rechaza(d,p,re);};
 const k=BASE.p.m.indexOf('comp'),fila=BASE.p.d.findIndex(x=>x[k+1]&&x[k+1][1].length>1);
 toca(p=>{p.d[fila][k+1][1]+=p.d[fila][k+1][1][0];},/sigue después|repite/);
 toca(p=>{const s=p.d[fila][k+1][1];p.d[fila][k+1][1]=s[0]+s;},/repite/);
 toca(p=>{p.d[fila][k+1][1]='~~';},/no se puede leer/);
 toca(p=>{p.d[fila][k+1][0]=-5;},/no se puede leer/);
 toca(p=>{p.d[fila].push(0);},/no se puede leer/);
 toca(p=>{p.m.push('inventado');},/no existen/);
 const kb=BASE.p.m.indexOf('band'),fb=BASE.p.d.findIndex(x=>x[kb+1]);
 toca(p=>{p.d[fb][kb+1][1]='zzzz'+p.d[fb][kb+1][1];},/imposible|no se puede leer/);
 /* Un desafío «ganado» con más intentos de los que admite. */
 const t=M.reto('band',M.objetivoDelDia('band',BASE.f));
 const e=copia(BASE.e);e.hist[BASE.f].band=[50,7,9000,1,['1001','1101','1201','1301','1401','1501'].filter(c=>c!==t).slice(0,6).concat(t)];
 rechaza(datoPuntos(e),M.prueba(e,BASE.f),/sigue después/);
});
test('Electrodle: el reloj frenado no pasa',()=>{
 const e=historial('2026-10-12',15,55,{reloj:0.02}),f=ultimo(e);
 rechaza(datoPuntos(e),M.prueba(e,f),/humano/,ahoraDe(f));
});
test('Electrodle: la racha sin el día completo, sin respaldo o más larga que el juego no pasa',()=>{
 const e=historial('2026-10-12',10,21),f=ultimo(e),d=datoRacha(e,f),a=ahoraDe(f);
 assert.equal(V.verifica(d,M.prueba(e,f,true),a),null);
 rechaza({...d,puntos:400},M.prueba(e,f,true),/más larga/,a);
 rechaza(d,M.prueba(e,f),/solo la de ese día/,a);
 const sin=copia(e);delete sin.hist[f].simb;
 rechaza(datoRacha(sin,f),M.prueba(sin,f,true),/falta Símbolo/,a);
 const leg=M.registra(copia(e),f,'form',2,5000,true);
 rechaza(datoRacha(leg,f),M.prueba(leg,f,true),/sin lo intentado/,a);
 rechaza({...d,tiempo:1},M.prueba(e,f,true),/tiempo/,a);
});
test('Electrodle: sospecha de filas guardadas sin prueba',()=>{
 const a=ahoraDe('2026-10-05');
 assert.equal(V.maximoPuntos('2026-10-05'),700*2+600*3);
 assert.equal(V.sospecha('club-electro-puntos',{puntos:2500,tiempo:900000},a),null);
 assert.match(V.sospecha('club-electro-puntos',{puntos:3300,tiempo:900000},a),/más que acertar/);
 assert.match(V.sospecha('club-electro-puntos',{puntos:2000,tiempo:5000},a),/puntos en/);
 assert.equal(V.sospecha('club-electro-racha',{puntos:5,tiempo:9},a),null);
 assert.match(V.sospecha('club-electro-racha',{puntos:30,tiempo:9},a),/racha/);
});
test('Electrodle: los objetivos de los días ya jugados no se mueven',()=>{
 /* Si esto falla, alguien cambió un catálogo (o el orden de una lista):
    los objetivos de los días pasados cambiaron y el verificador
    rechazaría el historial de todos. Una ficha nueva va al final de su
    lista con `desde` (motor.js, «el objetivo del día»). */
 let s='';
 for(let k=0;k<500;k++){const f=masDias('2026-10-01',k);for(const m of M.IDS_MODOS)s+=M.objetivoDelDia(m,f)+',';}
 assert.equal(M.hash(s),HUELLA,'huella de los objetivos: '+M.hash(s));
 /* Y `desde` deja los días anteriores como estaban. */
 const L=M.MODO.comp.objetivos,antes=M.objetivoDelDia('comp','2027-01-01');
 L.push({...L[0],id:'nuevo-de-prueba',desde:'2027-06-01'});
 try{assert.equal(M.objetivoDelDia('comp','2027-01-01'),antes);}finally{L.pop();}
});
/* ---------- bots ---------- */
test('Electrodle: bots: sintéticos, instantáneos, sin teclas, de metrónomo o sin la forma',()=>{
 const caso=(op,re,dias=10)=>{const e=historial('2026-10-12',dias,91,op),f=ultimo(e);rechaza(datoPuntos(e),M.prueba(e,f),re,ahoraDe(f));return e;};
 /* Despacha eventos: isTrusted falso en cada intento. */
 caso({forma:(n,r,ms)=>({...humano(n,r,ms),u:n})},/sintéticas/);
 /* Instantáneo: 40 ms entre intento e intento. */
 caso({forma:n=>({t:Array.from({length:n},()=>[40,3]),u:0,mc:0})},/ningún humano/);
 /* Intentos sin ninguna acción (llamar al juego por dentro). */
 caso({forma:(n,r,ms)=>({t:humano(n,r,ms).t.map(([dt])=>[dt,0]),u:0,mc:0})},/sin ninguna tecla/);
 /* Rápido pero sobre el piso por intento: el modo entero no llega al
    mínimo (Conexiones en menos de 1,5 s). */
 caso({modos:['conx'],forma:n=>({t:Array.from({length:n},(_,k)=>[160+k*13,5]),u:0,mc:0})},/resuelto en/);
 /* Metrónomo: siempre 3 s, con un 1 % de ruido. */
 caso({forma:(n,r)=>({t:Array.from({length:n},()=>[Math.round(3000*(0.99+0.02*r())),4]),u:0,mc:0})},/metrónomo/);
 /* Sin la forma en lo reciente, pasado el corte. */
 caso({forma:null},/sin la forma/);
 /* La racha también. */
 const e=historial('2026-10-12',3,92,{forma:n=>({t:Array.from({length:n},()=>[40,3]),u:0,mc:0})}),f=ultimo(e);
 rechaza(datoRacha(e,f),M.prueba(e,f,true),/ningún humano/,ahoraDe(f));
});
test('Electrodle: humanos con ruido pasan: muy rápidos, con mando, y la forma solo pesa en lo reciente',()=>{
 /* Muy rápido pero humano: 0,5 a 2 s entre intentos, todos los días. */
 for(const k of [1,2,3]){
  const e=historial('2026-10-12',20,300+k,{msIntento:[500,2000]}),f=ultimo(e);
  assert.equal(V.verifica(datoPuntos(e),M.prueba(e,f),ahoraDe(f)),null,'rápido '+k);
 }
 /* Con mando: sus acciones vienen marcadas y no son sintéticas. */
 const m=historial('2026-10-12',10,404,{forma:(n,r,ms)=>{const h=humano(n,r,ms);return {...h,mc:n*5};}}),fm=ultimo(m);
 assert.equal(V.verifica(datoPuntos(m),M.prueba(m,fm),ahoraDe(fm)),null);
 /* Un día viejo sin forma (fuera de la ventana) no se mira. */
 let e=historial('2026-10-12',1,5,{forma:null});e=dia(e,'2026-12-01',rng(6));
 assert.equal(V.verifica(datoPuntos(e),M.prueba(e,'2026-12-01'),ahoraDe('2026-12-01')),null);
 /* La prueba lleva la forma solo en la ventana. */
 const p=M.prueba(historial('2026-10-12',60,8),'2026-12-10');
 const conForma=p.d.filter(f=>f.slice(1).some(c=>c&&c.length>=3)).length;
 assert.ok(conForma<=M.VENTANA&&conForma>0,'días con forma: '+conForma);
});
const HUELLA=490529170;   // la de motor.js antes de `desde`: no movió nada
