const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir,minimoDe}=context;
const [JUEGOS,BX_MAPAS,BX_ARMAS]=vm.runInContext('[JUEGOS,BX_MAPAS,BX_ARMAS]',context);
const D=require('../../juegos/boxhead/js/datos.js');
const copia=x=>JSON.parse(JSON.stringify(x));
const sala=(n=3,extra={})=>({juego:'boxhead',semilla:1,estado:'jugando',cupo:n,
 jugadores:Object.fromEntries(['a','b','c','d','e','f','g','h'].slice(0,n).map((u,i)=>[u,{nombre:u,orden:i}])),jugadas:{},...extra});
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};

test('boxhead: de 1 a 8 jugadores, versus pide 2',()=>{
 assert.equal(JUEGOS.boxhead.cupo,8);
 assert.equal(minimoDe({juego:'boxhead',variante:'coop'}),1);
 assert.equal(minimoDe({juego:'boxhead',variante:'versus'}),2);
 for(const n of [1,2,5,8]){const e=reducir(sala(n));assert.equal(e.fase,'jugando');assert.equal(e.jugadores.length,n);}
});

test('boxhead coop: los niveles van de uno en uno y reviven a los caídos',()=>{
 const p=sala(3);
 let e=mover(p,{t:'muere',uid:'a',por:'',a:8,pts:500,k:20,n:1});
 assert.deepEqual(copia(e.caidos),['a']);assert.equal(e.fase,'jugando');
 e=mover(p,{t:'nivel',uid:'b',n:3});assert.equal(e.nivel,1);           // se salta uno: no vale
 e=mover(p,{t:'nivel',uid:'b',n:2});assert.equal(e.nivel,2);assert.deepEqual(copia(e.caidos),[]);
 e=mover(p,{t:'nivel',uid:'c',n:2});assert.equal(e.nivel,2);           // repetido: no cuenta
});

test('boxhead coop: termina cuando caen todos y gana el de más puntos',()=>{
 const p=sala(3);
 mover(p,{t:'muere',uid:'a',por:'',a:8,pts:900,k:40});
 mover(p,{t:'muere',uid:'a',por:'',a:8,pts:99999});                    // ya caído: no cuenta
 mover(p,{t:'muere',uid:'b',por:'',a:9,pts:1200,k:30});
 let e=reducir(p);assert.equal(e.fase,'jugando');
 e=mover(p,{t:'muere',uid:'c',por:'',a:8,pts:300});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'b');assert.equal(e.motivo,'caidos');
 assert.equal(e.puntos.a,900);
});

test('boxhead coop: quien se va no bloquea el final',()=>{
 const p=sala(2);
 mover(p,{t:'muere',uid:'a',por:'',a:8,pts:100});
 const e=mover(p,{t:'abandona',uid:'b'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');
});

test('boxhead versus: la meta, el suicidio y el abandono',()=>{
 const p=sala(3,{variante:'versus',meta:5});
 let e=reducir(p);assert.equal(e.meta,5);
 e=mover(p,{t:'muere',uid:'a',por:'a',a:3});assert.equal(e.bajas.a,0);assert.equal(e.muertes.a,1);
 e=mover(p,{t:'muere',uid:'a',por:'zz',a:0});assert.equal(e.bajas.a,0);
 for(let i=0;i<4;i++)e=mover(p,{t:'muere',uid:i%2?'b':'c',por:'a',a:6});
 assert.equal(e.fase,'jugando');assert.equal(e.bajas.a,4);
 e=mover(p,{t:'muere',uid:'b',por:'a',a:6});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');assert.equal(e.motivo,'meta');
 const q=sala(2,{variante:'versus'});
 e=mover(q,{t:'abandona',uid:'a'});assert.equal(e.ganador,'b');assert.equal(e.motivo,'abandono');
 for(const m of [0,7,'x'])assert.equal(reducir(sala(2,{variante:'versus',meta:m})).meta,10);
});

test('boxhead: mapa, variante y armas se recortan a lo que existe',()=>{
 assert.equal(reducir(sala(2,{mapa:'luna'})).mapa,'patio');
 assert.equal(reducir(sala(2,{mapa:'sotano'})).mapa,'sotano');
 assert.equal(reducir(sala(2,{variante:'otra'})).variante,'coop');
 assert.deepEqual(Object.keys(BX_MAPAS),copia(D.ORDEN_MAPAS));
 assert.equal(D.ARMAS.length,BX_ARMAS);
});

test('boxhead: datos del juego — armas, mejoras, skins',()=>{
 const mul=D.ARMAS.map(a=>a.mul);
 assert.deepEqual(mul,[...mul].sort((x,y)=>x-y));
 assert.equal(D.SKINS.length,14);
 assert.equal(new Set(D.SKINS.map(s=>s.id)).size,14);
 // las ocho de siempre son libres; las seis nuevas, cada una con una medalla distinta que existe
 assert.ok(D.SKINS.slice(0,8).every(s=>!s.medalla));
 const conM=D.SKINS.filter(s=>s.medalla);
 assert.equal(conM.length,6);assert.equal(new Set(conM.map(s=>s.medalla)).size,6);
 for(const s of conM)assert.ok(D.medallaDe(s.medalla),s.id);
 assert.equal(new Set(D.MEDALLAS.map(m=>m.id)).size,D.MEDALLAS.length);
 for(const m of D.MEDALLAS)assert.ok(m.nom&&m.i&&m.txt,m.id);
 for(const a of D.ARMAS)assert.ok(a.nombre&&a.id!==undefined||a.nombre);
});

test('boxhead: en cada mapa se llega de los jugadores a todas las entradas',()=>{
 for(const id of D.ORDEN_MAPAS){
  const m=D.cargaMapa(id);
  assert.ok(m.spawnsP.length>=4,id+': puntos de aparición (se reparten en rueda)');
  assert.ok(m.spawnsE.length>=2,id+': entradas de enemigos');
  const libre=(x,y)=>x>=0&&y>=0&&x<m.ancho&&y<m.alto&&m.celdas[y*m.ancho+x]===0;
  const ts=D.TS,ini=m.spawnsP[0],sx=Math.floor(ini.x/ts),sy=Math.floor(ini.y/ts);
  const visto=new Set([sx+','+sy]),cola=[[sx,sy]];
  while(cola.length){const [x,y]=cola.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(!visto.has(k)&&libre(nx,ny)){visto.add(k);cola.push([nx,ny]);}}}
  for(const p of m.spawnsP)assert.ok(visto.has(Math.floor(p.x/ts)+','+Math.floor(p.y/ts)),id+': jugador aislado');
  for(const s of m.spawnsE){
   const vecino=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>visto.has((s.tx+dx)+','+(s.ty+dy)));
   assert.ok(visto.has(s.tx+','+s.ty)||vecino,id+': entrada aislada en '+s.tx+','+s.ty);
  }
 }
});

test('boxhead: una mejora en cada multiplicador sin arma, rotando y con tope',()=>{
 const armas=new Set(D.ARMAS.map(a=>a.desbloquea));
 const ms=new Set(D.MEJORAS.map(m=>m.m));
 for(let m=2;m<=60;m++)if(!armas.has(m))assert.ok(ms.has(m),'falta mejora en ×'+m);
 const usadas=new Set(D.MEJORAS.filter(m=>m.m<=60).map(m=>m.arma));
 assert.ok(usadas.size>=6,'las mejoras rotan entre armas');
 const todas=new Set(D.MEJORAS.map(m=>m.id));
 for(const a of D.ARMAS){
  const f=D.arma(a.id,todas);
  if(a.d)assert.ok(f.d>=a.d&&f.d<=a.d*4,a.nombre+' daño con tope');
  if(a.cad)assert.ok(f.cad<=a.cad&&f.cad>0,a.nombre+' cadencia');
  if(a.id===2)assert.ok(f.perdigones>a.perdigones&&f.abre!==a.abre,'la escopeta mejora perdigones y apertura');
 }
});

test('boxhead: el combo baja de a uno con barras más cortas',()=>{
 for(let m=2;m<60;m++){
  assert.ok(D.bajadaCombo(m)>0);
  assert.ok(D.bajadaCombo(m)<=D.duracionCombo(m));
 }
});

test('boxhead: la mezcla de enemigos suma 1 y cada tipo entra en su nivel',()=>{
 for(let n=1;n<=60;n++){
  const p=D.mezclaNivel(n);
  assert.ok(Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-9,'suma 1 en '+n);
  assert.ok(p[0]>=0.2-1e-9,'zombis comunes ≥ 20 % en '+n);
  for(const e of D.ENEMIGOS)if(e.id&&n<e.desde)assert.equal(p[e.id],0,e.nombre+' antes de tiempo');
  for(const e of D.ENEMIGOS)if(e.id&&n>=e.desde)assert.ok(p[e.id]>0,e.nombre+' falta en '+n);
  assert.equal(D.tipoEnemigo(n,0),p[0]>0?0:D.tipoEnemigo(n,0));
  assert.ok(D.tipoEnemigo(n,0.999999)>=0&&D.tipoEnemigo(n,0.999999)<D.ENEMIGOS.length);
 }
});

test('boxhead: la dificultad sube de forma pausada y sin saltos',()=>{
 let prev=null;
 for(let n=1;n<=40;n++){
  const c={total:D.totalNivel(n),ritmo:D.ritmoNivel(n),vida:D.vidaEnemigo(0,n),vel:D.velEnemigo(0,n),golpe:D.golpeNivel(0,n),max:D.maxVivos(n,1)};
  if(prev){
   assert.ok(c.total>=prev.total&&c.total-prev.total<=4,'total recto en '+n);
   assert.ok(c.ritmo<=prev.ritmo&&prev.ritmo-c.ritmo<=0.031,'ritmo recto en '+n);
   assert.ok(c.vida>=prev.vida&&c.vida/prev.vida<=1.1,'vida suave en '+n);
   assert.ok(c.vel>=prev.vel&&c.vel-prev.vel<=1,'velocidad suave en '+n);
   assert.ok(c.golpe>=prev.golpe&&c.golpe-prev.golpe<=1,'golpe suave en '+n);
   assert.ok(c.max>=prev.max&&c.max-prev.max<=1,'vivos a la vez suave en '+n);
  }
  prev=c;
 }
});

test('boxhead: tienda, potencia y armadura',()=>{
 for(const t of D.TIENDA){assert.ok(t.precio>0&&/^[A-Z]$/.test(t.tecla),t.id);}
 assert.equal(new Set(D.TIENDA.map(t=>t.tecla)).size,D.TIENDA.length,'teclas distintas');
 assert.equal(D.precioTienda('balas',0),250);
 assert.equal(D.precioTienda('potencia',0),800);
 assert.equal(D.precioTienda('potencia',2),2400);
 assert.equal(D.precioTienda('potencia',5),Infinity);
 assert.equal(D.precioTienda('nada',0),Infinity);
 assert.equal(D.factorPotencia(0),1);
 assert.ok(Math.abs(D.factorPotencia(5)-1.5)<1e-9);
 assert.ok(Math.abs(D.factorPotencia(9)-1.5)<1e-9,'potencia con tope');
 assert.ok(D.ARMADURA.absorbe>0&&D.ARMADURA.absorbe<1&&D.ARMADURA.max>0);
});

test('boxhead: niveles de arma en la tienda, cada vez más caros y con tope',()=>{
 for(const a of D.ARMAS){
  let antes=0;
  for(let n=0;n<D.NIVEL_ARMA.max;n++){const p=D.precioNivelArma(a.id,n);assert.ok(p>antes,a.nombre+' nivel '+n+' más caro');antes=p;}
  assert.equal(D.precioNivelArma(a.id,D.NIVEL_ARMA.max),Infinity,a.nombre+' tope');
  const b=D.arma(a.id),m=D.conNivel(b,D.NIVEL_ARMA.max);
  if(b.d){assert.ok(m.d>b.d&&m.d<=500,a.nombre+' daño');}
  if(b.cad){assert.ok(m.cad<b.cad&&m.cad>=0.03,a.nombre+' cadencia');}
  if(Number.isFinite(b.max))assert.ok(m.max>b.max,a.nombre+' munición');
  assert.equal(D.conNivel(b,0),b,'nivel 0 no toca nada');
  assert.equal(D.conNivel(b,99).nivel,D.NIVEL_ARMA.max,'nivel acotado');
 }
 assert.deepEqual([0,1,2,3,4,5].map(D.rangoArma),[0,1,1,2,2,3]);
 assert.equal(D.precioNivelArma(0,0),300);
 assert.equal(D.precioNivelArma(99,0),Infinity);
});

test('boxhead: el muro reforzado se vende por unidad y aguanta más',()=>{
 const t=D.TIENDA.find(x=>x.id==='blindado');
 assert.ok(t&&t.tecla==='M'&&t.precio>0);
 assert.equal(D.precioTienda('blindado',0),t.precio);
 assert.ok(D.MURO_BLINDADO.vida>=D.ARMAS[5].vida*5&&D.MURO_BLINDADO.vida<=1200,'más que cinco muros falsos, dentro del tope del director');
 assert.ok(D.MURO_BLINDADO.max>=1);
});

test('boxhead: la penetración se gana con mejoras y tiene tope',()=>{
 const todas=new Set(D.MEJORAS.map(m=>m.id));
 const conPen=D.ARMAS.filter(a=>(D.PASOS[a.id]||[]).some(p=>p[0]==='pen'));
 assert.ok(conPen.length>=2,'al menos dos armas atraviesan');
 for(const a of conPen){
  const f=D.arma(a.id,todas);
  assert.ok((f.pen||0)>(a.pen||0),a.nombre+' gana penetración');
  assert.ok((f.pen||0)<=6,a.nombre+' penetración con tope');
 }
});

test('boxhead: cada mapa tiene tienda y barriles a los que se llega',()=>{
 for(const id of D.ORDEN_MAPAS){
  const m=D.cargaMapa(id),ts=D.TS;
  assert.ok(m.tiendas.length>=1,id+': sin tienda');
  assert.ok(m.barriles.length>=1,id+': sin barriles');
  const libre=(x,y)=>x>=0&&y>=0&&x<m.ancho&&y<m.alto&&m.celdas[y*m.ancho+x]===0;
  const ini=m.spawnsP[0],sx=Math.floor(ini.x/ts),sy=Math.floor(ini.y/ts);
  const visto=new Set([sx+','+sy]),cola=[[sx,sy]];
  while(cola.length){const [x,y]=cola.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(!visto.has(k)&&libre(nx,ny)){visto.add(k);cola.push([nx,ny]);}}}
  const llega=(px,py)=>{const tx=Math.floor(px/ts),ty=Math.floor(py/ts);return visto.has(tx+','+ty)||[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>visto.has((tx+dx)+','+(ty+dy)));};
  for(const t of m.tiendas)assert.ok(llega(t.x,t.y),id+': tienda aislada');
  for(const b of m.barriles)assert.ok(llega(b.x,b.y),id+': barril aislado');
 }
});

test('boxhead: jefes en los niveles 5/15/25… (mini) y 10/20/30… (grande), rotando',()=>{
 assert.equal(D.jefeDeNivel(3),-1);assert.equal(D.jefeDeNivel(12),-1);
 assert.equal(D.jefeDeNivel(5),6);assert.equal(D.jefeDeNivel(15),7);assert.equal(D.jefeDeNivel(45),10);assert.equal(D.jefeDeNivel(55),6);
 assert.equal(D.jefeDeNivel(10),11);assert.equal(D.jefeDeNivel(50),15);assert.equal(D.jefeDeNivel(60),11);
 assert.ok(D.MINIS.length>=5&&D.GRANDES.length>=5,'al menos cinco de cada');
 const habs=new Set();
 for(const k of [...D.MINIS,...D.GRANDES]){
  const C=D.ENEMIGOS[k];
  assert.ok(D.esJefe(k),C.nombre+' es jefe');
  for(const c of ['hab','cd','rg','talla','txt'])assert.ok(C[c],C.nombre+' sin '+c);
  habs.add(C.hab);
  assert.ok(D.vidaJefe(k,30,1)>D.vidaJefe(k,5,1),'la vida crece con el nivel');
  assert.ok(D.vidaJefe(k,5,4)>D.vidaJefe(k,5,1),'y con los jugadores');
 }
 assert.equal(habs.size,D.MINIS.length+D.GRANDES.length,'cada jefe con su habilidad');
 for(const k of D.MINIS)assert.equal(D.ENEMIGOS[k].jefe,'mini');
 for(const k of D.GRANDES)assert.equal(D.ENEMIGOS[k].jefe,'grande');
});

test('boxhead: la mezcla normal nunca saca un jefe',()=>{
 for(let n=1;n<=80;n++){
  const p=D.mezclaNivel(n);
  for(let k=0;k<p.length;k++)if(D.esJefe(k))assert.equal(p[k],0);
  for(let i=0;i<50;i++)assert.ok(!D.esJefe(D.tipoEnemigo(n,i/50)));
 }
});

/* El dibujo (grafico.js): cada enemigo tiene su paleta y su sangre, cada
   arma su modelo con boca, y un punto proyectado sale donde debe. */
test('boxhead: paletas, armas en la mano y proyección del dibujo',()=>{
 const G=require('../../juegos/boxhead/js/grafico.js').BoxheadGrafico;
 assert.equal(G.PAL_E.length,D.ENEMIGOS.length,'una paleta por enemigo');
 for(const p of G.PAL_E){for(const c of ['piel','camisa','pantalon','pelo'])assert.match(p[c],/^#[0-9a-f]{3,6}$/i);assert.ok(['zombi','lado'].includes(p.brazos));}
 for(let k=0;k<D.ENEMIGOS.length;k++)assert.equal(G.sangreDe(k).length,3);
 for(const a of D.ARMAS){const m=G.partesArma(a.id);assert.ok(m.p.length>=1,a.nombre+' sin modelo');assert.equal(m.b.length,3);}
 for(const s of D.SKINS)assert.equal(G.palJugador(s).brazos,'arma');
 // mirando al este, la boca del arma queda a la derecha del jugador y en alto
 const b=G.boca(100,100,0,0);
 assert.ok(b[2]>110&&Math.abs(b[3]-100)<3&&b[4]>12&&b[1]<b[3]);
 // inclinado 90° hacia atrás, la cabeza queda en el suelo detrás de los pies
 const q=G.proyecta(100,100,0,0,0,30,1,Math.PI/2);
 assert.ok(q[2]<75&&Math.abs(q[4])<1e-6);
});

test('el Demoledor: el único que va a romper, poco común; cada tipo tiene sus puntos',()=>{
 assert.equal(D.PUNTOS.length,D.ENEMIGOS.length,'una entrada de PUNTOS por enemigo');
 const rompen=D.ENEMIGOS.filter(e=>e.rompe);
 assert.deepEqual(rompen.map(e=>e.id),[16]);
 for(let n=1;n<=60;n++)assert.ok(D.mezclaNivel(n)[16]<=0.05+1e-9,'nivel '+n);
 assert.equal(D.mezclaNivel(5)[16],0);assert.ok(D.mezclaNivel(6)[16]>0);
});

test('la chatarra: moneda aparte de los puntos, sin multiplicador; los suministros suben con el nivel',()=>{
 for(let k=0;k<D.ENEMIGOS.length;k++){const c=D.chatarraDe(k);assert.ok(Number.isInteger(c)&&c>0,'chatarra de '+k);}
 assert.ok(D.chatarraDe(11)>D.chatarraDe(6)&&D.chatarraDe(6)>D.chatarraDe(0),'un jefe grande da más que uno chico, y este más que un zombi');
 // sin nivel (o nivel 1) el precio es el de siempre
 assert.equal(D.precioTienda('balas',0,1),250);
 assert.equal(D.precioTienda('botiquin',0),300);
 // sube con el nivel, con tope ×2,5, y la potencia no sube
 let antes=0;for(let n=1;n<=40;n++){const p=D.precioTienda('armadura',0,n);assert.ok(p>=antes,'nivel '+n);antes=p;}
 assert.equal(D.precioTienda('armadura',0,200),1000);
 assert.equal(D.precioTienda('potencia',1,30),D.precioTienda('potencia',1,1));
 assert.ok(D.precioTienda('blindado',0,11)>D.precioTienda('blindado',0,1));
});

test('el stick del mando: ocho direcciones con histéresis, sin tiritar en el borde',()=>{
 const a=g=>[Math.cos(g),Math.sin(g)];
 assert.equal(D.dirStick(1,0,-1),0);assert.equal(D.dirStick(0,1,-1),2);assert.equal(D.dirStick(-1,0,-1),4);
 // justo pasado el borde entre «derecha» (0) y «abajo-derecha» (1): sigue en la que traía
 const borde=Math.PI/8+0.05;
 assert.equal(D.dirStick(...a(borde),0),0,'se queda en derecha');
 assert.equal(D.dirStick(...a(borde),-1),1,'sin dirección previa, la del sector');
 // lejos del borde cambia
 assert.equal(D.dirStick(...a(Math.PI/8+0.3),0),1);
 // igual por el otro lado y dando la vuelta por ±π
 assert.equal(D.dirStick(...a(-borde),0),0);
 assert.equal(D.dirStick(...a(Math.PI-borde),4),4);
});

/* Fase 2: el motor determinista. Se juega una práctica sin pantalla
   (sin-pantalla.js) con un «jugador» de teclas que cambia cada tanto, con
   la grabadora encendida, y la prueba se rehace en OTRO contexto: tiene que
   terminar en el mismo paso, nivel y puntos. */
const RAIZ='../juegos/boxhead/js/';
function boxheadSinPantalla(){
 const ctx={console,Math,JSON,Date,Map,Set,Array,Object,Number,String,Boolean,Symbol,Proxy,Error,Int32Array,Float32Array,Uint8Array,URLSearchParams,Infinity,NaN,isFinite,parseInt,parseFloat};
 vm.createContext(ctx);
 for(const f of ['sin-pantalla.js','datos.js','juego.js'])vm.runInContext(fs.readFileSync(RAIZ+f,'utf8'),ctx,{filename:f});
 return ctx.__boxhead;
}
// Un bot que pasa por la grabadora (__boxhead.entrada): mira al enemigo más
// cercano, dispara siempre y se aleja si lo rodean; cambia de arma y compra.
const DIRS8=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const dir8=(x,y)=>((Math.round(Math.atan2(y,x)/(Math.PI/4))%8)+8)%8;
function juegaPartida(bx,{maxPasos=60*60*20,azar=1,semilla=12345,cuenta='local'}={}){
 bx.practica(semilla,true,cuenta);let t=0;
 for(let i=0;i<maxPasos&&!bx.estado().terminado;i++){
  if(i%4===0){
   const m=bx.mundo();let best=null,bd=1e9,cx=0,cy=0;
   for(const e of m.E){const d=Math.hypot(e.x-m.yo.x,e.y-m.yo.y);if(d<bd){bd=d;best=e}if(d<160){cx+=e.x-m.yo.x;cy+=e.y-m.yo.y}}
   const en={dx:0,dy:0,vel:1,mira:-1,fija:false,disp:true};
   if(best){en.mira=dir8(best.x-m.yo.x,best.y-m.yo.y);
    if(bd<130){const d=DIRS8[dir8(-cx,-cy)];en.dx=d[0];en.dy=d[1]}
    else{t++;const d=DIRS8[(Math.floor(t/40)+azar)%8];en.dx=d[0];en.dy=d[1];en.vel=0.6}}
   bx.entrada(en);
  }
  // una ventaja al rato de que salga la elección (la otra mitad de las veces se queda la primera sola)
  if(i%300===150&&azar%2&&bx.estado().eleccion)bx.accion(7,(i/300|0)%3);
  if(i%400===200)bx.accion(1,1);
  if(i%1000===500)bx.accion(6,0);
  bx.paso(1/60);
 }
 return bx.prueba();
}
test('topes del director: ningún golpe legítimo los pasa, y cada arma tiene su nicho',()=>{
 const todasDe=w=>new Set(D.MEJORAS.filter(m=>m.arma===w).map(m=>m.id));
 for(const a of D.ARMAS){
  const b=D.conNivel(D.arma(a.id,todasDe(a.id)),5);
  // lo más que hace jugando: potencia 5, filo 5, furia, en compañía 2 y crítico
  const real=(b.d||0)*D.factorPotencia(5)*1.5*1.4*1.3*2*(b.obj==='barril'||b.obj==='carga'?1.5:1);
  assert.ok(D.topeGolpe(a.id)>=Math.round(real),a.nombre+' tope '+D.topeGolpe(a.id)+' < '+real);
  if(b.r)assert.ok(D.topeRadio(a.id)>=Math.round(b.r*1.25),a.nombre+' radio');
  assert.ok(D.topeGolpe(a.id)>=60*1.5*5.46,'cubre el estallido y la bala ígnea');
 }
 assert.equal(D.topeGolpe(99),0);
 // la uzi atraviesa de entrada; la escopeta derriba y el cohete atraviesa (en juego.js)
 assert.equal(D.ARMAS[1].pen,1);
 const js=fs.readFileSync(RAIZ+'juego.js','utf8');
 assert.match(js,/ATURDE_ARMA = \{ 2: /);assert.match(js,/p\.pasa = 1/);
 assert.match(js,/gastaCupo\(de\)/);assert.match(js,/TOPE_GOLPE\[w \| 0\]/);
});
test('ventajas a elección: el sorteo es puro, sin repetir, con su tope y las de equipo solo en sala',()=>{
 assert.equal(D.VENTAJAS.length,24);
 assert.equal(new Set(D.VENTAJAS.map(v=>v.id)).size,24);
 for(const v of D.VENTAJAS){assert.ok(v.max>=1&&[0,1,2].includes(v.rar)&&v.nom&&v.txt,v.id);}
 const azar=s=>()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 assert.deepEqual(D.sorteaVentajas(azar(7),{},false),D.sorteaVentajas(azar(7),{},false));
 for(let k=1;k<200;k++){
  const ops=D.sorteaVentajas(azar(k),{},false);
  assert.equal(ops.length,3);assert.equal(new Set(ops).size,3);
  for(const id of ops)assert.ok(!D.ventaja(id).equipo,'sin equipo en solitario');
 }
 const llenas=Object.fromEntries(D.VENTAJAS.map(v=>[v.id,v.max]));llenas.filo=0;
 assert.deepEqual(D.sorteaVentajas(azar(3),llenas,true),['filo']);
 llenas.filo=5;assert.deepEqual(D.sorteaVentajas(azar(3),llenas,true),[]);
 // las comunes salen más que las épicas
 const c=[0,0,0];for(let k=1;k<3000;k++)for(const id of D.sorteaVentajas(azar(k),{},true,1))c[D.ventaja(id).rar]++;
 assert.ok(c[0]>c[1]&&c[1]>c[2]&&c[2]>0,String(c));
});
test('motor determinista: una práctica grabada se rehace idéntica en otro contexto',()=>{
 const a=boxheadSinPantalla();
 const p=juegaPartida(a,{azar:1,semilla:3});
 assert.ok(a.estado().nivel>=3,'la partida de prueba pasa de nivel');
 assert.ok(p.j.some(j=>j[1]===7),'eligió alguna ventaja a mano');
 assert.ok(Object.keys(a.estado().vt).length>=2,'tiene ventajas');
 const fin=a.estado();
 assert.ok(fin.terminado,'el jugador de prueba tiene que morir');
 assert.ok(p.j.length>10&&p.k>0);
 const b=boxheadSinPantalla();
 const r=b.rehace(JSON.parse(JSON.stringify(p)));
 assert.equal(r.terminada,true);
 assert.equal(r.pasos,p.k);
 assert.equal(r.nivel,fin.nivel);
 assert.equal(r.pts,fin.yo.pts);
 // rehacerla otra vez en el mismo contexto da lo mismo (practica lo pone todo a cero)
 const r2=b.rehace(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(r2,r);
});
test('motor determinista: una prueba tocada no llega al mismo final',()=>{
 const a=boxheadSinPantalla();
 const p=juegaPartida(a,{azar:3});
 const b=boxheadSinPantalla();
 const ok=b.rehace(JSON.parse(JSON.stringify(p)));
 const otra=JSON.parse(JSON.stringify(p));otra.s=(otra.s+1)>>>0;
 const r=b.rehace(otra);
 assert.ok(r.pasos!==ok.pasos||r.pts!==ok.pts||!r.terminada,'otra semilla, otra partida');
 assert.throws(()=>b.rehace({...p,ve:999}),/forma esperada/);
 assert.throws(()=>b.rehace({...p,j:[[5,0,4,20,0,0],[2,1,1]]}),/orden/);
});
test('Solo Club: el verificador rehace la prueba y rechaza la de otra cuenta, otro mapa o tocada',async()=>{
 const esbuild=require('esbuild');
 const mod={exports:{}};
 new Function('module','exports','require',esbuild.buildSync({entryPoints:['src/juegos/solo/verifica/boxhead.js'],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);
 const V=mod.exports;
 globalThis.BoxheadRehace=require('../../juegos/boxhead/js/rehace-node.cjs').rehace;
 try{
  const a=boxheadSinPantalla();
  const p=juegaPartida(a,{azar:2,cuenta:'uidA'});
  assert.equal(p.u,'uidA');
  const MAPAS=['patio','sotano','cruce','fortaleza','laberinto'];
  const r=globalThis.BoxheadRehace(p);
  assert.equal(r.nivel,a.estado().nivel,'el nivel rehecho es el de la partida');
  const dato={categoria:'club-boxhead-'+MAPAS[p.m],puntos:r.nivel,tiempo:V.tiempoDe(r.pasoNivel)};
  const ctx={uid:'uidA'};
  assert.equal(await V.verifica(dato,p,ctx),null);
  assert.match(await V.verifica(dato,p,{uid:'uidB'}),/otra cuenta/);
  // la misma partida con la cuenta cambiada en la prueba ya no llega al mismo final
  assert.ok(await V.verifica(dato,{...p,u:'uidB'},{uid:'uidB'}));
  const otro=MAPAS[(p.m+1)%MAPAS.length];
  assert.match(await V.verifica({...dato,categoria:'club-boxhead-'+otro},p,ctx),/otro mapa/);
  assert.match(await V.verifica({...dato,puntos:dato.puntos+1},p,ctx),/nivel/);
  assert.match(await V.verifica({...dato,tiempo:dato.tiempo-1},p,ctx),/tiempo/);
  assert.ok(await V.verifica(dato,{...p,k:p.k+60},ctx));
  // quitarle jugadas de la mitad de la partida la cambia (las del final, ya muerto, pueden no importar)
  assert.ok(await V.verifica(dato,{...p,j:p.j.filter((x,i)=>i<5||i%3)},ctx));
  assert.match(await V.verifica({...dato,categoria:'club-boxhead-luna'},p,ctx),/tabla/);
  assert.match(await V.verifica({...dato,puntos:1000},p,ctx),/no es posible/);
  // la sospecha mira solo la fila
  assert.equal(V.sospecha(dato.categoria,{puntos:dato.puntos,tiempo:dato.tiempo}),null);
  assert.ok(V.sospecha(dato.categoria,{puntos:20,tiempo:5000}));
 }finally{delete globalThis.BoxheadRehace;}
});
test('Solo Club: categorías y tope de Pro BoxHead en club-datos',async()=>{
 const esbuild=require('esbuild');
 const mod={exports:{}};
 new Function('module','exports','require',esbuild.buildSync({entryPoints:['src/juegos/solo/club-datos.js'],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);
 const C=mod.exports;
 for(const m of ['patio','sotano','cruce','fortaleza','laberinto'])assert.ok(C.categoriaClub('boxhead','club-boxhead-'+m),m);
 assert.ok(!C.categoriaClub('boxhead','club-boxhead-luna'));
});
test('nicho de las armas: la uzi atraviesa a uno y el cohete pasa al primero y revienta en el segundo',()=>{
 const bx=boxheadSinPantalla();
 function dispara(w){
  bx.practica(1);bx.inmortal(true);bx.armas();bx.calma();
  const m=bx.mundo(),x=m.yo.x,y=m.yo.y;
  const ids=[bx.enemigo(0,x+60,y),bx.enemigo(0,x+110,y),bx.enemigo(0,x+260,y)];
  bx.elige(w);bx.entrada({dx:0,dy:0,vel:1,mira:0,fija:true,disp:false});
  for(let i=0;i<12;i++)bx.paso(1/60);            // el cambio de arma demora 0,15 s
  const hp0=new Map(bx.mundo().E.map(e=>[e.id,e.hp])),toca=new Set();
  bx.entrada({dx:0,dy:0,vel:1,mira:0,fija:true,disp:true});bx.paso(1/60);
  bx.entrada({dx:0,dy:0,vel:1,mira:0,fija:true,disp:false});
  for(let i=0;i<40;i++){for(const e of bx.mundo().E)if(e.hp<hp0.get(e.id))toca.add(e.id);bx.paso(1/60);}
  const vivos=new Set(bx.mundo().E.map(e=>e.id));
  return ids.map(id=>!vivos.has(id)||toca.has(id));
 }
 assert.deepEqual(dispara(1),[true,true,false],'uzi: un disparo pega en dos');
 assert.deepEqual(dispara(6),[true,true,false],'cohete: atraviesa al primero, revienta en el segundo');
});

test('enemigos de la Fase 3: datos de los cinco nuevos y de las élites',()=>{
 const por=n=>D.ENEMIGOS.find(e=>e.nombre===n);
 for(const n of ['Escudero','Enjambre','Chamán','Excavador','Vigía'])assert.ok(por(n),n+' existe');
 assert.ok(por('Escudero').escudo>0&&por('Escudero').escudo<1);
 assert.equal(por('Enjambre').grupo,8);
 assert.equal(D.ELITES[0],null);
 for(let i=1;i<D.ELITES.length;i++){const el=D.ELITES[i];assert.equal(el.id,i);assert.ok(el.vida>=1&&el.vel>=1);assert.match(el.color,/^#[0-9a-f]{6}$/i);}
 for(let n=1;n<=80;n++){
  const p=D.parteElites(n);assert.ok(p>=0&&p<=0.12,'parte '+n);
  if(n<12)assert.equal(p,0);
  for(const e of D.ENEMIGOS){
   const r=D.eliteDe(e.id,n,0,0.99);
   if(e.jefe||e.grupo||n<12)assert.equal(r,0,e.nombre+' en '+n+' no es élite');
   else{assert.ok(r>=1&&r<D.ELITES.length);assert.equal(D.eliteDe(e.id,n,0.5,0.5),0,'r1 alto: común');}
  }
 }
});

test('enemigos de la Fase 3: el escudo para de frente, el excavador es inmune bajo tierra, el vigía dispara y el chamán cura',()=>{
 const bx=boxheadSinPantalla();
 const pista={dx:0,dy:0,vel:1,mira:0,fija:true,disp:false};
 function prepara(){bx.practica(1);bx.inmortal(true);bx.armas();bx.calma();bx.elige(0);bx.entrada(pista);for(let i=0;i<12;i++)bx.paso(1/60);return bx.mundo().yo;}
 const tiro=()=>{bx.entrada({...pista,disp:true});bx.paso(1/60);bx.entrada(pista);};
 const de=id=>bx.mundo().E.find(e=>e.id===id);
 // Escudero de frente contra un zombi común: el mismo tiro le quita un 20 %.
 function pierde(k){const yo=prepara();const id=bx.enemigo(k,yo.x+70,yo.y);for(let i=0;i<20;i++)bx.paso(1/60);const h0=de(id).hp;tiro();return h0-de(id).hp;}
 const comun=pierde(0),escudo=pierde(17);
 assert.ok(comun>0,'el tiro pega');
 assert.ok(Math.abs(escudo-comun*0.2)<1e-6,'de frente entra el 20 %: '+escudo+' de '+comun);
 // Excavador: bajo tierra no se le pega; al salir sí.
 let yo=prepara();
 const ex=bx.enemigo(20,yo.x+200,yo.y);
 assert.equal(de(ex).est,1,'nace bajo tierra');
 const hx=de(ex).hp;tiro();for(let i=0;i<5;i++)bx.paso(1/60);
 assert.equal(de(ex).hp,hx,'bajo tierra es inmune');
 let n=0;while(de(ex)&&de(ex).est!==0&&n++<600)bx.paso(1/60);
 assert.ok(de(ex)&&de(ex).est===0,'sale a la superficie');
 const s=de(ex);yo=bx.mundo().yo;
 bx.entrada({...pista,mira:dir8(s.x-yo.x,s.y-yo.y),disp:true});bx.paso(1/60);bx.entrada(pista);
 for(let i=0;i<3;i++)bx.paso(1/60);
 assert.ok(!de(ex)||de(ex).hp<hx,'afuera se le pega');
 // Vigía: apunta y suelta una bala propia.
 yo=prepara();
 bx.enemigo(21,yo.x+150,yo.y);   // a la vista: retrocede hasta la pared y apunta
 let bala=false;for(let i=0;i<60*6&&!bala;i++){bx.paso(1/60);bala=bx.mundo().F.some(f=>f.k===21);}
 assert.ok(bala,'el vigía dispara');
 // Chamán: el zombi herido a su lado recupera vida.
 yo=prepara();
 const z=bx.enemigo(0,yo.x+120,yo.y);bx.enemigo(19,yo.x+150,yo.y);
 tiro();const hz=de(z).hp;assert.ok(hz<de(z).max,'el zombi quedó herido');
 let curado=false;for(let i=0;i<60*3&&de(z)&&!curado;i++){bx.paso(1/60);curado=de(z)&&de(z).hp>hz;}
 assert.ok(curado,'el chamán lo cura');
});
