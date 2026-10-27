const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../src/juegos/motor.js'),'utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);
vm.runInContext(code+';Object.assign(this,{TR_CUENTA_MS,TR_HOLGURA_MS,ajustesTyperace,clasificaTyperace});',context);
const {reducir,meToca,progreso,TR_CUENTA_MS,TR_HOLGURA_MS,ajustesTyperace}=context;
const M=require('../../juegos/typerace/motor.js');

const sala=(n,extra={})=>{
 const p={juego:'typerace',semilla:777,estado:'jugando',anfitrion:'a',cupo:10,jugadores:{},jugadas:{},...extra};
 for(let i=0;i<n;i++)p.jugadores['abcdefghij'[i]]={nombre:'abcdefghij'[i].toUpperCase(),orden:i};
 return p;
};
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p);};
const T0=1e6, SAL=T0+TR_CUENTA_MS;

test('el texto es determinista y su prefijo no cambia al pedir más',()=>{
 for(const texto of ['palabras','frases','cuentos'])for(const idioma of ['es','en']){
  const a=M.palabras({texto,idioma},42,60),b=M.palabras({texto,idioma},42,400);
  assert.equal(a.length,60);
  assert.deepEqual(a,b.slice(0,60),texto+'/'+idioma);
  assert.deepEqual(a,M.palabras({texto,idioma},42,60));
  assert.notDeepEqual(a,M.palabras({texto,idioma},43,60));
 }
 const w=M.palabras({texto:'palabras'},1,500);
 for(let i=1;i<w.length;i++)assert.notEqual(w[i],w[i-1],'no repite la palabra anterior');
});

test('sin tildes quita acentos y deja la ñ; en inglés no hay opción',()=>{
 assert.equal(M.sinAcentos('canción pingüino árbol niño'),'cancion pinguino arbol niño');
 const sin=M.palabras({texto:'cuentos',idioma:'es',acentos:0},9,300).join(' ');
 assert.ok(!/[áéíóúü]/i.test(sin));
 assert.equal(M.ajustes({idioma:'en',acentos:0}).acentos,true);
});

test('el libre siempre va con reloj, y los ajustes raros se recortan',()=>{
 assert.equal(M.ajustes({largo:0,final:'todos'}).final,'tiempo');
 assert.deepEqual(M.ajustes({largo:7,tiempo:9999,texto:'x',final:'y'}),{idioma:'es',texto:'palabras',largo:50,final:'todos',tiempo:60,acentos:true});
 assert.deepEqual(JSON.parse(JSON.stringify(ajustesTyperace({largo:0}))),M.ajustes({largo:0}),'el reductor y la pantalla leen igual la sala');
 assert.deepEqual(JSON.parse(JSON.stringify(ajustesTyperace({idioma:'en',texto:'frases',largo:100,final:'primero',tiempo:30}))),M.ajustes({idioma:'en',texto:'frases',largo:100,final:'primero',tiempo:30}));
});

test('el tecleo: errores, espacio, volver a la palabra mala y la última sin espacio',()=>{
 const s=M.crear(['hola','mundo','feliz']);
 assert.equal(M.escribe(s,'h',1000),'ok');
 assert.equal(M.escribe(s,'hx',1100),'mal');
 M.escribe(s,'h',1150);M.escribe(s,'hola',1300);
 assert.equal(M.espacio(s,1400),'palabra');
 M.escribe(s,'mudno',1800);
 assert.equal(M.espacio(s,1900),'mal');
 assert.equal(M.retrocede(s),'mudno','vuelve a la palabra mala con lo escrito');
 M.escribe(s,'mu',1950);M.escribe(s,'mundo',2100);M.espacio(s,2200);
 assert.equal(M.retrocede(s),null,'la palabra bien escrita ya no se toca');
 assert.equal(M.escribe(s,'feliz',3000),'fin');
 assert.ok(s.fin);
 const c=M.cuentas(s,9999);
 assert.equal(c.ms,2000);
 assert.equal(c.c,'hola mundo feliz'.length);
 assert.equal(c.p,3);
 assert.equal(c.avance,1);
 assert.ok(c.prec<100&&c.e>0);
 assert.equal(c.ppm,Math.round(16/5/(2/60)));
});

test('hasta que todos terminen: gana el más rápido aunque llegue su meta después',()=>{
 const p=sala(3);
 let e=reducir(p);
 assert.equal(e.etapa,'arranque');
 e=mover(p,{t:'arranca',uid:'a',at:T0});
 assert.equal(e.salida,SAL);
 assert.equal(e.plazo,0);
 mover(p,{t:'arranca',uid:'b',at:T0+500});
 assert.equal(reducir(p).salida,SAL,'el segundo arranca del relevo no hace nada');
 e=mover(p,{t:'meta',uid:'b',at:SAL+30000,ok:1,c:250,e:2,p:50,ms:30000});
 assert.equal(e.fase,'jugando');
 assert.ok(meToca(e,'a')&&!meToca(e,'b'));
 mover(p,{t:'meta',uid:'c',at:SAL+40000,ok:1,c:250,e:0,p:50,ms:40000});
 /* La meta de a llega tarde (red lenta) pero dice que tardó menos. */
 e=mover(p,{t:'meta',uid:'a',at:SAL+29500,ok:1,c:250,e:5,p:50,ms:29000});
 assert.equal(e.fase,'fin');
 assert.equal(e.ganador,'a');
 assert.equal(e.motivo,'tecleo');
 assert.deepEqual([...e.orden],['a','b','c']);
 assert.equal(e.puntos.b,100);
});

test('una meta no puede decir que tardó menos de lo que pasó desde la largada',()=>{
 const p=sala(2);
 mover(p,{t:'arranca',uid:'a',at:T0});
 const e=mover(p,{t:'meta',uid:'a',at:SAL+5000,ok:1,c:250,e:0,p:50,ms:999999});
 assert.ok(e.metas.a.ms<=6500);
 const q=sala(2);
 mover(q,{t:'arranca',uid:'a',at:T0});
 assert.equal(mover(q,{t:'meta',uid:'a',at:T0+100,ok:1,c:250,e:0,p:50,ms:10}).metas.a,undefined,'antes de la largada no vale');
});

test('termina el primero: los demás quedan donde iban y no pueden llegar después',()=>{
 const p=sala(3,{final:'primero'});
 mover(p,{t:'arranca',uid:'a',at:T0});
 let e=mover(p,{t:'meta',uid:'c',at:SAL+20000,ok:1,c:200,e:0,p:40,ms:20000});
 assert.equal(e.etapa,'cierre');
 assert.equal(e.corte,SAL+20000);
 e=mover(p,{t:'meta',uid:'a',at:SAL+21000,ok:1,c:200,e:0,p:40,ms:20500});
 assert.equal(e.metas.a.ok,0,'llegó después del corte: queda a medias');
 assert.equal(e.fase,'jugando');
 e=mover(p,{t:'corta',uid:'a',at:SAL+20000+1000});
 assert.equal(e.fase,'jugando','el corta antes de la holgura no cierra');
 e=mover(p,{t:'corta',uid:'a',at:SAL+20000+TR_HOLGURA_MS});
 assert.equal(e.fase,'fin');
 assert.equal(e.ganador,'c');
 assert.deepEqual([...e.orden],['c','a','b']);
});

test('con límite de tiempo gana quien más escribió bien, y la meta tardía no cuenta',()=>{
 const p=sala(3,{final:'tiempo',tiempo:30,largo:0});
 let e=mover(p,{t:'arranca',uid:'a',at:T0});
 assert.equal(e.plazo,SAL+30000);
 e=mover(p,{t:'meta',uid:'a',at:SAL+30200,ok:0,c:180,e:4,p:36,ms:30000});
 assert.equal(e.corte,SAL+30000);
 mover(p,{t:'meta',uid:'b',at:SAL+30300,ok:0,c:180,e:1,p:36,ms:30000});
 e=mover(p,{t:'meta',uid:'c',at:SAL+30000+TR_HOLGURA_MS+500,ok:0,c:400,e:0,p:80,ms:30000});
 assert.equal(e.metas.c,undefined,'fuera de la holgura no vale');
 e=mover(p,{t:'corta',uid:'b',at:SAL+30000+TR_HOLGURA_MS+800});
 assert.equal(e.fase,'fin');
 assert.equal(e.ganador,'b','mismos caracteres, menos errores');
 assert.equal(e.motivo,'cronometro');
 assert.equal(e.puntos.a,72);
});

test('solo: el anfitrión empieza con uno y corre contra el reloj',()=>{
 const p=sala(1,{estado:'esperando',cupo:4});
 assert.equal(reducir(p).fase,'espera');
 p.estado='jugando';
 mover(p,{t:'arranca',uid:'a',at:T0});
 const e=mover(p,{t:'meta',uid:'a',at:SAL+10000,ok:1,c:100,e:0,p:20,ms:10000});
 assert.equal(e.fase,'fin');
 assert.equal(e.ganador,'a');
 assert.ok(progreso(reducir(sala(1)),'typerace')===0);
});

test('abandonar y ser expulsado cuentan como irse; si se van todos, nadie gana',()=>{
 const p=sala(3);
 mover(p,{t:'arranca',uid:'a',at:T0});
 mover(p,{t:'meta',uid:'a',at:SAL+9000,ok:1,c:100,e:0,p:20,ms:9000});
 let e=mover(p,{t:'abandona',uid:'c'});
 assert.deepEqual([...e.debe],['b']);
 e=mover(p,{t:'voto',uid:'a',contra:'b'});
 assert.equal(e.fase,'fin','con c fuera, el voto de a basta para echar a b');
 assert.equal(e.ganador,'a');
 const q=sala(2);
 mover(q,{t:'arranca',uid:'a',at:T0});
 mover(q,{t:'abandona',uid:'a'});
 e=mover(q,{t:'abandona',uid:'b'});
 assert.equal(e.fase,'fin');
 assert.equal(e.ganador,'');
 const r=sala(2);
 mover(r,{t:'arranca',uid:'a',at:T0});
 e=mover(r,{t:'abandona',uid:'b'});
 assert.equal(e.fase,'jugando','quien queda sigue corriendo');
 e=mover(r,{t:'meta',uid:'a',at:SAL+9000,ok:1,c:100,e:0,p:20,ms:9000});
 assert.equal(e.ganador,'a');
});

test('una robot-carrera de diez llega al final',()=>{
 const p=sala(10,{final:'todos',largo:25});
 mover(p,{t:'arranca',uid:'a',at:T0});
 const ids='abcdefghij'.split('');
 ids.forEach((u,i)=>mover(p,{t:'meta',uid:u,at:SAL+20000+i*700,ok:1,c:150,e:i,p:25,ms:20000+i*700}));
 const e=reducir(p);
 assert.equal(e.fase,'fin');
 assert.deepEqual([...e.orden],ids);
 assert.equal(e.ganador,'a');
});
