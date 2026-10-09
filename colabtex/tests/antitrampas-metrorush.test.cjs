/* Antitrampas de Metro Rush (docs/antitrampas/metrorush.md).

   Metro Rush no se rehace cuadro a cuadro: la prueba es la semilla de la
   pista, los pedidos al generador y los eventos que cambian el puntaje
   (juegos/club/metrorush/prueba.js), y el verificador recalcula los puntos
   exactos, mira los metros contra la velocidad y el reloj de juego contra
   el real.

   Aquí: un ROBOT que corre cuadro a cuadro como juego.js (cuadros de largo
   variable, la velocidad del motor, la pista de la semilla, recoge las
   estrellas y los 2× que le quedan a menos de un metro, la mochila con su
   cinta de monedas, un túnel, choca, sigue corriendo y vuelve a chocar) y
   lleva los puntos por su cuenta, cuadro a cuadro, como el juego (si el
   verificador sumara mal por tramos, aquí no coincidiría). Sus carreras
   pasan; y cada vía de trampa se rechaza: resultado inventado, puntos o
   metros inflados, tiempo recortado, prueba de otra cuenta, una estrella o
   un 2× que no están en la pista o recogidos lejos, el 2× estirado, el
   multiplicador base imposible, el +5 tarde, la cámara rápida, metros que
   no da la velocidad, entradas sintéticas y una pista que no es la de la
   semilla. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const carga=(entry,extra='')=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text+extra)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const MV=carga('src/juegos/solo/verifica/metrorush.js');
const DIR=path.join(__dirname,'../../juegos/club/metrorush');
const M=require(path.join(DIR,'motor.js')),MP=require(path.join(DIR,'prueba.js'));
const copia=x=>JSON.parse(JSON.stringify(x));

/* ---------- El robot ----------
   `muertes`: tiempos de juego en que choca (después de cada uno, menos el
   último, sigue corriendo). `mochilaEn`: tiempo en que toma una mochila
   cohete (pide la cinta de monedas). `pot`: usa el +5 a los `pot` s.
   `atrapado`: el último choque es el inspector que te atrapa, y entonces
   (como en juego.js) el corredor no se para en seco: resbala frenando con
   M.FRENADA hasta quedar quieto. */
function robot(o={}){
 const op=Object.assign({semilla:12345,base:3,md:2,u:'uid-robot',muertes:[70,140],mochilaEn:25,pot:2,tunelEn:1500,pausa:4,semillaDt:7},o);
 let az=op.semillaDt>>>0;const azar=()=>((az=(az*1664525+1013904223)>>>0)/4294967296);
 const gen=M.crearGenerador(op.semilla),prueba=MP.nueva({s:op.semilla,b:op.base,md:op.md,u:op.u});
 const st={t:0,D:0,V:M.velocidad(0),puntos:0,estrellas:0,doble:0,extra:0,vivo:true,r:0};
 const objetos=new Map(),tomados=new Set();
 const anota=(cod,x,D)=>MP.evento(prueba,cod,st.t,D!=null?D:st.D,st.r,x);
 const pedido=(tipo,...d)=>MP.pedido(prueba,tipo,gen.estado().dSig,...d);
 const agrega=l=>{for(const ob of l)objetos.set(ob.id,ob);};
 const mult=()=>M.multiplicador({base:op.base,estrellas:st.estrellas,doble:st.doble>0,extra:st.extra});
 const durDoble=M.duracionPoder('doble',op.md);
 agrega(gen.generarHasta(230,{V:st.V}));pedido('B',1,420);gen.pedirBoleto(1,420);
 let sigMuestra=MP.PASO_MUESTRA,muerte=0,tunelPedido=false,mochila=false,usoPot=false;
 for(let paso=0;paso<200000;paso++){
  const dt=0.008+azar()*0.042;                      // cuadros de 8 a 50 ms, como un aparato que va y viene
  st.r+=dt*1000+azar()*3;                            // el reloj real: lo mismo, y un poco más (el cuadro tarda en procesarse)
  st.t+=dt;
  st.V=st.vivo?M.velocidad(st.t):0;
  const dD=st.V*dt;st.D+=dD;
  if(st.vivo)st.puntos+=M.puntosPorTramo(dD,mult());
  agrega(gen.generarHasta(st.D+230,{V:Math.max(13,st.V)}));
  if(!st.vivo)continue;
  // chocar (y seguir corriendo, menos la última vez). Como en juego.js, el
  // choque va antes de recoger, y en el cuadro del choque no se recoge nada
  // ni se gasta el 2×.
  if(muerte<op.muertes.length&&st.t>=op.muertes[muerte]){
   const ultima=muerte===op.muertes.length-1,resbala=op.atrapado&&ultima;
   anota('m');st.vivo=false;if(!resbala)st.D=Math.max(0,st.D-0.35);muerte++;
   let v=resbala?st.V:0;                                            // atrapado: sigue de largo frenando
   for(let k=0;k<60||v>0;k++){const d2=0.016;v=Math.max(0,v-M.FRENADA*d2);st.D+=v*d2;st.t+=d2;st.r+=d2*1000;}   // la caída
   st.r+=op.pausa*1000;                                             // «¿Seguir corriendo?» (el reloj de juego no corre)
   if(muerte<op.muertes.length){anota('s');st.vivo=true;continue;}
   anota('f');break;
  }
  // recoger: estrellas y 2× a menos de un metro
  for(const ob of objetos.values()){
   if(tomados.has(ob.id)||Math.abs(ob.d-st.D)>1.0)continue;
   if(ob.tipo==='estrella'){tomados.add(ob.id);anota('e',ob.id);st.estrellas=Math.min(M.MAX_ESTRELLAS,st.estrellas+1);}
   else if(ob.tipo==='poder'&&ob.clase==='doble'){tomados.add(ob.id);anota('d',ob.id);st.doble=durDoble;}
  }
  if(!mochila&&op.mochilaEn&&st.t>=op.mochilaEn){mochila=true;const h=st.D+12+st.V*8;pedido('C',st.D+12,h,1);agrega(gen.monedasCielo(st.D+12,h,1));}
  if(!tunelPedido&&op.tunelEn&&st.D>=op.tunelEn){tunelPedido=true;pedido('T',st.D+40,1);gen.pedirTunel(st.D+40,1);}
  if(op.pot&&!usoPot&&st.t>=op.pot){usoPot=true;anota('p');st.extra=M.POTENCIADORES.puntos.extra;}
  if(st.doble>0){st.doble=Math.max(0,st.doble-dt);if(st.doble===0)anota('x');}
  if(st.t>=sigMuestra){anota('w');sigMuestra=st.t+MP.PASO_MUESTRA;}
 }
 const puntos=Math.floor(st.puntos),metros=Math.floor(st.D),tiempo=Math.max(1,Math.round(st.t*1000));
 return {prueba:MP.cierra(prueba,{sn:0}),puntos,metros,tiempo,estrellas:st.estrellas};
}
const dato=(r,cat='club-metrorush-carrera')=>({categoria:cat,puntos:cat==='club-metrorush-carrera'?r.puntos:r.metros,tiempo:r.tiempo,partida:'x'});
const ctx={uid:'uid-robot'};

test('Metro Rush: la carrera de un robot pasa, y el verificador da sus mismos puntos',async()=>{
 for(const s of [12345,777,2026]){
  const r=robot({semilla:s,semillaDt:s});
  const re=MP.rehace(r.prueba);
  assert.equal(re.motivo,undefined,'semilla '+s+': '+re.motivo);
  assert.ok(Math.abs(re.puntos-r.puntos)<=1,'puntos: verificador '+re.puntos+' robot '+r.puntos);
  assert.equal(re.metros,r.metros);assert.ok(Math.abs(re.tiempo-r.tiempo)<=1);
  assert.ok(r.estrellas>=1,'el robot recogió estrellas (si no, la prueba no prueba nada)');
  assert.equal(MV.verifica(dato(r),r.prueba,ctx),null);
  assert.equal(MV.verifica(dato(r,'club-metrorush-distancia'),r.prueba,ctx),null);
  assert.equal(await V.verificaClub('metrorush',dato(r),r.prueba,ctx),null,'por el registro del club');
 }
 // sin choques intermedios, sin mochila, sin túnel y sin +5 también
 const r=robot({muertes:[40],mochilaEn:0,tunelEn:0,pot:0});
 assert.equal(MV.verifica(dato(r),r.prueba,ctx),null);
 // una carrera larga (10 minutos, varias estaciones): la prueba cabe de sobra
 const larga=robot({muertes:[300,600],tunelEn:3000});
 assert.equal(MV.verifica(dato(larga),larga.prueba,ctx),null);
 assert.ok(JSON.stringify(larga.prueba).length<V.PRUEBA_MAX/4,'la prueba de 10 min ocupa '+JSON.stringify(larga.prueba).length);
});

test('Metro Rush: a 50 m/s, que te atrape el inspector (resbalando ~21 m) también pasa',()=>{
 // a los 400 s ya va a 50 m/s: frenando con M.FRENADA resbala 50²/(2·60) = 20,8 m después del choque
 assert.equal(M.velocidad(400),50);
 const r=robot({muertes:[400],atrapado:true,mochilaEn:0,tunelEn:0,pot:0,semilla:99,semillaDt:99});
 const m=r.prueba.e.find(e=>e[0]==='m'),f=r.prueba.e[r.prueba.e.length-1];
 assert.ok(f[2]-m[2]>20&&f[2]-m[2]<21.5,'resbaló '+(f[2]-m[2]).toFixed(1)+' m');
 assert.equal(MP.rehace(r.prueba).motivo,undefined);
 assert.equal(MV.verifica(dato(r),r.prueba,ctx),null);
 assert.equal(MV.verifica(dato(r,'club-metrorush-distancia'),r.prueba,ctx),null);
});

test('Metro Rush: tres choques con el 2× puesto (y seguir corriendo) también pasan',()=>{
 // primero se busca cuándo toma el robot su primer 2×, y se le hace chocar tres veces mientras dura
 const ida=robot({muertes:[300],semilla:4242,semillaDt:4242});
 const d=ida.prueba.e.find(e=>e[0]==='d');
 assert.ok(d,'el robot toma un 2×');
 const t=d[1];
 const r=robot({muertes:[t+2,t+5,t+8,t+30],semilla:4242,semillaDt:4242});
 const re=MP.rehace(r.prueba);
 assert.equal(re.motivo,undefined,re.motivo);
 assert.equal(MV.verifica(dato(r),r.prueba,ctx),null);
 // y una carrera que se corta en la pausa (sin choque) se cierra con su choque: también pasa
 assert.ok(r.prueba.e.filter(e=>e[0]==='m').length===4);
});

test('Metro Rush: resultado inventado, inflado o de otra cuenta, se rechaza',async()=>{
 const r=robot();
 assert.match(await V.verificaClub('metrorush',dato(r),null,ctx),/sin prueba/,'Club.result desde la consola');
 assert.match(MV.verifica({...dato(r),puntos:r.puntos*2},r.prueba,ctx),/puntos declarados/);
 assert.match(MV.verifica({...dato(r,'club-metrorush-distancia'),puntos:r.metros+500},r.prueba,ctx),/metros declarados/);
 assert.match(MV.verifica({...dato(r),tiempo:Math.round(r.tiempo/2)},r.prueba,ctx),/tiempo declarado/);
 assert.match(MV.verifica(dato(r),r.prueba,{uid:'otra-cuenta'}),/otra cuenta/);
 assert.match(MV.verifica({...dato(r),categoria:'club-metrorush-x'},r.prueba,ctx),/Categoría desconocida/);
});

test('Metro Rush: una prueba editada no cuadra',()=>{
 const r=robot();
 const conEvento=(f)=>{const p=copia(r.prueba);f(p);return MV.verifica(dato(r),p,ctx);};
 const primero=(p,cod)=>p.e.findIndex(e=>e[0]===cod);
 // una estrella que no existe, o recogida lejos, o dos veces
 assert.match(conEvento(p=>{p.e[primero(p,'e')][4]=999999;}),/estrella que no está/);
 assert.match(conEvento(p=>{p.e[primero(p,'e')][2]+=30;}),/./);
 assert.match(conEvento(p=>{const i=primero(p,'e');p.e.splice(i+1,0,copia(p.e[i]));}),/dos veces/);
 // el 2× estirado: se borra su fin
 if(primero(r.prueba,'x')>=0)assert.match(conEvento(p=>{p.e.splice(primero(p,'x'),1);}),/2×/);
 // el multiplicador base imposible, o el nivel del 2× imposible
 assert.match(conEvento(p=>{p.b=31;}),/multiplicador base/);
 assert.match(conEvento(p=>{p.md=9;}),/nivel del 2×/);
 // un multiplicador base más alto que el de verdad: los puntos ya no son los declarados
 assert.match(conEvento(p=>{p.b=30;}),/puntos declarados/);
 // el +5 a mitad de carrera
 assert.match(conEvento(p=>{const i=primero(p,'p');p.e[i][1]=40;p.e.splice(i,1);const j=p.e.findIndex(e=>e[1]>40);p.e.splice(j,0,['p',40,p.e[j-1][2],p.e[j-1][3]]);}),/./);
 // entradas que no hizo una persona
 assert.match(conEvento(p=>{p.sn=3;}),/no hizo una persona/);
 // otra semilla: la pista ya no es la misma
 assert.match(conEvento(p=>{p.s=p.s+1;}),/pista|estrella|2×/);
 // un pedido a la pista corrido
 assert.match(conEvento(p=>{p.i[0][1]+=5;}),/pista/);
 // la prueba sin el fin
 assert.match(conEvento(p=>{p.e.pop();}),/fin de la carrera/);
 // otra versión
 assert.match(conEvento(p=>{p.v=99;}),/otra versión/);
});

test('Metro Rush: la cámara rápida y los metros de más se notan',()=>{
 const r=robot();
 // el reloj real a la mitad: el juego habría corrido al doble (avanza(), un reloj trucado)
 const rapida=copia(r.prueba);for(const e of rapida.e)e[3]=Math.round(e[3]/2);
 assert.match(MV.verifica(dato(r),rapida,ctx),/más rápido que el reloj/);
 // metros inflados un 20 % (como si corriera más rápido que el juego)
 const lejos=copia(r.prueba);for(const e of lejos.e)e[2]*=1.2;
 assert.match(MV.verifica(dato(r),lejos,ctx),/metros|recogió lejos|estrella/);
 // tiempo de juego recortado (las mismas cosas en menos tiempo)
 const corta=copia(r.prueba);for(const e of corta.e)e[1]*=0.8;
 assert.match(MV.verifica(dato(r),corta,ctx),/metros|2×|tiempo/);
});

test('Metro Rush: lo imposible en una fila guardada sin prueba',()=>{
 const t=60;// en un minuto se corren unos 1 024 m como mucho
 assert.equal(MV.sospecha('club-metrorush-distancia',{puntos:900,tiempo:t*1000}),null);
 assert.match(MV.sospecha('club-metrorush-distancia',{puntos:3000,tiempo:t*1000}),/más rápido que el juego/);
 assert.equal(MV.sospecha('club-metrorush-carrera',{puntos:300000,tiempo:t*1000}),null);
 assert.match(MV.sospecha('club-metrorush-carrera',{puntos:5e6,tiempo:t*1000}),/multiplicador máximo/);
 assert.match(MV.sospecha('club-metrorush-carrera',{puntos:5}),/sin tiempo/);
 // y una carrera de verdad no es sospechosa
 const r=robot();
 assert.equal(MV.sospecha('club-metrorush-carrera',{puntos:r.puntos,tiempo:r.tiempo}),null);
 assert.equal(MV.sospecha('club-metrorush-distancia',{puntos:r.metros,tiempo:r.tiempo}),null);
 assert.equal(V.sospechaFila('club-metrorush-carrera',{puntos:r.puntos,tiempo:r.tiempo}),null);
});

test('Metro Rush: el juego anota la prueba y la manda con el resultado',()=>{
 const fs=require('node:fs'),js=fs.readFileSync(path.join(DIR,'juego.js'),'utf8'),html=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
 assert.match(html,/prueba\.js\?v=/,'la página carga prueba.js');
 assert.match(html,/conexion\.js\?v=club-(1[1-9]|[2-9]\d)/,'con la conexión que manda la prueba');
 // la mejor carrera va a la tabla de su modo (la del clásico es club-metrorush-carrera); la distancia, solo del clásico
 assert.match(js,/Club\.result\(\{ categoria: c\.modo\.categoria.*\}, prueba\)/);
 assert.match(js,/Club\.result\(\{ categoria: 'club-metrorush-distancia'.*\}, prueba\)/);
 for(const cod of ["'e'","'d'","'x'","'p'","'m'","'s'","'w'","'f'"])assert.ok(js.includes('anota('+cod),'anota '+cod);
 for(const tipo of ["'T'","'B'","'C'"])assert.ok(js.includes('anotaPedido('+tipo),'pide '+tipo);
 // los ganchos que cambian la carrera la vuelven de prueba
 for(const g of ['puntos','pulsa','poder','inmortal'])assert.match(js,new RegExp(g+': [^\\n]*toca\\(\\)'),g);
 assert.match(js,/avanza: \(seg = 5\) => \{ toca\(\);/);
});
