/* Diagramas propios del manual. Sin imágenes externas ni estado de partida. */
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const C={verde:'#8cddb3',azul:'#88caff',rojo:'#ff9c9c',oro:'#f6d47e',violeta:'#c5b3ff',blanco:'#f2f5ff',gris:'#9eaac3'};
const txt=(x,y,t,size=17,color='#e6edf9',anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="system-ui,sans-serif" text-anchor="${anchor}">${esc(t)}</text>`;
const rect=(x,y,w,h,fill='#273650',stroke='#465773',rx=8)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const circle=(x,y,r,fill,stroke='none')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const line=(x,y,a,b,color=C.verde,w=4)=>`<path d="M${x} ${y} L${a} ${b}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const svg=(nombre,body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 250" role="img" aria-label="${esc(nombre)}"><title>${esc(nombre)}</title><rect width="480" height="250" rx="14" fill="#142139"/>${body}</svg>`;
const tarjeta=(x,y,v,col='blanco',sub='',w=58)=>rect(x,y,w,76,C[col]||col,'#ffffff55',9)+txt(x+w/2,y+43,v,Math.min(25,(w-10)/(String(v).length*.65)),'#17243b','middle')+txt(x+w/2,y+64,sub,Math.min(11,(w-6)/Math.max(1,sub.length*.6)),'#273650','middle');
/* Filas: [etiqueta, [[valor,color,subtítulo], ...]]. */
export const cartas=(filas,nota='')=>svg(filas.map(([n,cs])=>n+': '+cs.map(c=>c.join(' ')).join(', ')).join('. '),filas.map(([n,cs],i)=>{
 const y=24+i*110,w=Math.min(58,390/Math.max(1,cs.length)-8),x=(480-cs.length*(w+8)+8)/2;
 return txt(24,y,n,15)+cs.map((c,k)=>tarjeta(x+k*(w+8),y+10,c[0],c[1],c[2]||'',w)).join('');
}).join('')+(nota?txt(456,238,nota,12,C.gris,'end'):''));
export const cart=(a,b,nota='')=>cartas([a,...(b?[b]:[])],nota);
const dado=(x,y,n,color='blanco')=>{
 const pos={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
 return rect(x,y,44,44,C[color],'#ffffff44',8)+pos[n].map(([a,b])=>circle(x+22+a*11,y+22+b*11,3.5,'#17243b')).join('');
};
export const dados=(filas,nota)=>svg(nota,filas.map(([nom,ds,marca],i)=>txt(24,30+i*95,nom,16)+ds.map((n,k)=>dado(24+54*k,43+i*95,n,marca&&marca(n)?'oro':'blanco')).join('')).join('')+txt(24,237,nota,16,C.verde));
export const tablero=(nombre,cols,rows,celdas,especial={})=>{
 const z=Math.min(54,360/cols,198/rows),ox=(480-cols*z)/2,oy=(250-rows*z)/2;
 return svg(nombre,Array.from({length:cols*rows},(_,i)=>{
  const x=ox+i%cols*z,y=oy+Math.floor(i/cols)*z,v=celdas[i],col=especial[i];
  return rect(x+2,y+2,z-4,z-4,col?C[col]:'#24344e',col?'#fff8':'#465773',5)+(v?txt(x+z/2,y+z/2+7,v,Math.min(23,z*.5),col?'#152139':'#ecf4ff','middle'):'');
 }).join(''));
};
export const orbes=estado=>svg('Esquina y vecinas: '+estado.map((n,i)=>`celda ${i+1}, ${n} orbes`).join('; '),[0,1,2,3].map(i=>{
 const x=151+i%2*90,y=30+Math.floor(i/2)*90,n=estado[i];return rect(x,y,84,84)+(n?Array.from({length:n},(_,k)=>circle(x+30+k*22,y+42,12,C.verde)).join(''):'');
}).join(''));
export const reversi=k=>tablero('Negras encierran y convierten las blancas',5,1,k===0?['●','○','○','','']:k===1?['●','○','○','●','']:['●','●','●','●',''],{0:'azul',...(k?{3:'verde'}:{}),...(k===2?{1:'azul',2:'azul'}:{})});
export const cajas=cerrado=>svg('Caja '+(cerrado?'cerrada por el lado derecho':'con tres lados'),(cerrado?rect(165,40,150,150,'#365d54','#365d54',0):'')+line(165,40,315,40)+line(165,40,165,190)+line(165,190,315,190)+(cerrado?line(315,40,315,190,C.oro,7):'')+[[165,40],[315,40],[165,190],[315,190]].map(([x,y])=>circle(x,y,7,C.blanco)).join('')+txt(240,129,cerrado?'+1':'?',32,C.blanco,'middle'));
const persona=(x,y,gorro,ropa,bolso=false)=>circle(x,y,5,C.oro)+rect(x-6,y+7,12,18,ropa,'none',2)+rect(x-6,y-6,12,4,gorro,'none',1)+(bolso?rect(x+6,y+9,5,10,C.violeta,'none',2):'');
export const paisaje=mostrar=>svg(mostrar?'Persona buscada: gorro rojo, camiseta verde y mochila; círculo de solución':'Multitud con prendas parecidas; busca gorro rojo, camiseta verde y mochila',rect(18,18,444,214,'#233e3c','#45635b',16)+Array.from({length:30},(_,i)=>{
 if(i===14)return "";
 const x=40+i%10*44,y=50+Math.floor(i/10)*65;
 return persona(x,y,i%4?C.azul:C.rojo,i%3?C.verde:C.oro,i%3===1&&i%4!==0);
}).join('')+persona(222,115,C.rojo,C.verde,true)+rect(202,138,52,22,'#866e4d','#b4a380',3)+(mostrar?`<circle cx="222" cy="122" r="27" fill="none" stroke="${C.oro}" stroke-width="3"/>`:'')+txt(240,220,'Gorro rojo · Camiseta verde · Mochila',14,C.blanco,'middle'));
export const tiro=etapa=>svg('Tiro en arco: moverse, apuntar, disparar; ejemplo sin viento',`<path d="M0 205 L0 175 Q100 155 180 186 T480 160 V250 H0" fill="#476b58"/>`+circle(65,153,12,C.azul)+circle(406,148,12,C.rojo)+line(65,153,95,133,C.azul,7)+(etapa>=1?`<path d="M85 143 Q235 -45 396 140" fill="none" stroke="${C.oro}" stroke-width="3" stroke-dasharray="7 8"/>`:'')+(etapa===2?circle(386,135,27,'#ffcc6755')+circle(386,135,13,C.oro):'')+txt(24,32,etapa===0?'1 · Muévete':etapa===1?'2 · Apunta y carga':'3 · Suelta para disparar',19));
export const orbita=etapa=>svg(['Apunta desde tu base: ángulo y potencia','La gravedad curva la sonda y recoge estrellas','El satélite sigue moviéndose en turnos futuros'][etapa],circle(245,125,34,C.oro)+circle(340,62,13,C.violeta)+rect(22,170,40,40,C.azul)+txt(42,197,'A',20,'#142139','middle')+[[103,101],[168,68],[310,179],[364,171]].map(([x,y])=>txt(x,y,'✦',23,C.blanco,'middle')).join('')+`<path d="M62 179 Q88 130 113 115" fill="none" stroke="${C.azul}" stroke-width="4"/>`+(etapa>0?`<path d="M113 115 C160 20 330 30 352 100 S280 234 163 199" fill="none" stroke="${C.azul}" stroke-width="3" stroke-dasharray="5 7"/>`+circle(etapa===1?350:163,etapa===1?91:199,8,C.azul):'')+txt(24,30,etapa===0?'Ángulo + potencia':etapa===1?'La gravedad curva el vuelo':'Sigue capturando en otros turnos',17)+txt(456,235,'Trayectoria ilustrativa',12,C.gris,'end'));
export const serpiente=(body,fruta,portales=[])=>{
 const c=Array(40).fill(''),col={};body.forEach((i,k)=>{c[i]=k===0?'●':'•';col[i]='verde';});if(fruta!=null){c[fruta]='◆';col[fruta]='oro';}portales.forEach(i=>{c[i]='◎';col[i]='violeta';});return tablero('Cabeza ●, cuerpo •, fruta ◆ y portales ◎',8,5,c,col);
};
export const tetris=estado=>{
 const c=Array(48).fill(''),col={};for(let i=40;i<48;i++){if(estado<2&&i===43)continue;if(estado<2){c[i]='■';col[i]='azul';}}
 (estado===0?[11,19,27,35]:estado===1?[19,27,35,43]:[27,35,43]).forEach(i=>{c[i]='■';col[i]='oro';});
 return tablero('La pieza completa una fila; al borrarse, las celdas superiores bajan',8,6,c,col);
};
export const isla=tipo=>svg(tipo===2?'El ladrón bloquea el terreno: no produce recursos':'Trigo 8: poblado en vértice y camino en arista',`<path d="M240 35l92 53v106l-92 53-92-53V88z" fill="#bba563" stroke="#ead9a2" stroke-width="3"/>`+circle(240,128,26,'#fff0c7')+(tipo===2?circle(240,112,10,'#152139')+rect(227,123,26,27,'#152139','#fff',5):txt(240,136,'8',25,'#342a22','middle'))+line(148,88,240,35,C.azul,8)+`<path d="M137 76l11-10 11 10v17h-22z" fill="${C.azul}" stroke="#142139" stroke-width="2"/>`+(tipo>0?`<path d="M319 78h10V65h14v28h-24z" fill="${C.rojo}" stroke="#142139" stroke-width="2"/>`:'')+txt(24,30,tipo===0?'Vértice: poblado · Arista: camino':tipo===2?'Ladrón: terreno bloqueado':'Sale 8: producen los edificios vecinos',16)+(tipo>0?rect(12,198,456,34,'#142139','#142139',8):'')+(tipo===2?txt(240,219,'Este terreno no produce recursos',16,C.oro,'middle'):tipo>0?txt(24,219,'Poblado: 1 trigo',16,C.azul)+txt(290,219,'Ciudad: 2 trigo',16,C.rojo):''));
/* Ajedrez: un trozo de tablero con piezas escritas en texto. Aquí el
   manual sí usa caracteres, como el resto de ilustraciones; el peón negro
   lleva el selector de texto para que ningún sistema lo pinte como emoji. */
export const ajedrez=(nombre,cols,rows,celdas,marcas={})=>{
 const z=Math.min(48,420/cols,214/rows),ox=(480-cols*z)/2,oy=(250-rows*z)/2;
 return svg(nombre,Array.from({length:cols*rows},(_,i)=>{
  const c=i%cols,f=Math.floor(i/cols),x=ox+c*z,y=oy+f*z,v=celdas[i]||'',m=marcas[i];
  const fondo=m?C[m]:((c+f)%2?'#8a6a4c':'#d8c3a0');
  return `<rect x="${x}" y="${y}" width="${z}" height="${z}" fill="${fondo}"/>`+(v?txt(x+z/2,y+z*.72,v==='♟'?'♟︎':v,z*.68,'#17120c','middle'):'');
 }).join('')+`<rect x="${ox}" y="${oy}" width="${cols*z}" height="${rows*z}" fill="none" stroke="#465773" stroke-width="2"/>`);
};
/* FANAL: la formación de polillas, los cascos, el fanal con su llama y el
   metrónomo de abajo. `etapa`: 0 tiro fuera del pulso, 1 tiro afinado, 2 el
   barrido del Faro con su sector, 3 el muro de la Esfinge con su hueco. */
const polillaF=(x,y,c='#b8a088')=>`<path d="M${x} ${y+6}l-2-6l-9-6l-2 9l9 1zM${x} ${y+6}l2-6l9-6l2 9l-9 1z" fill="${c}"/><path d="M${x} ${y-5}v11" stroke="#3a2a22" stroke-width="2.4" stroke-linecap="round"/>`;
const farolF=(x,y)=>`<path d="M${x-16} ${y+10}h32l-5 7h-22z" fill="#6b4a32"/>`+rect(x-7,y-10,14,20,'#2a1a10','#d9a85b',3)+`<path d="M${x} ${y+5}c-5-4-4-9 0-13c4 4 5 9 0 13z" fill="#ffcf6b"/>`;
const cascoF=x=>`<path d="M${x-26} 196q26-30 52 0v8h-12q-14-10-28 0h-12z" fill="#5a4232" stroke="#7d5c40" stroke-width="2"/>`;
export const fanal=etapa=>{
 const nombre=['El tiro sale fuera del pulso: un tiro normal','El tiro cae en el pulso: sale afinado, dorado, y el multiplicador sube','El Faro anuncia su barrido con dos líneas: el sector entre ellas se ilumina','La Esfinge baja un muro de polvo con un solo hueco, que su marca señala'][etapa];
 let cuerpo=`<rect x="0" y="0" width="480" height="250" rx="14" fill="#0e0b1e"/>`;
 if(etapa<2){
  cuerpo+=[0,1,2,3,4,5].map(i=>polillaF(130+i*44,46,i%2?'#c47a3c':'#b8a088')).join('')+[0,1,2,3,4,5].map(i=>polillaF(130+i*44,82,'#9a4a62')).join('');
  cuerpo+=cascoF(150)+cascoF(330)+farolF(240,216);
  cuerpo+=etapa===1?line(240,180,240,120,C.oro,6)+circle(240,118,7,'#fff6d8'):line(240,180,240,130,'#ffe6a8',3);
  // El metrónomo: corcheas chicas, pulsos grandes; el que suena, encendido.
  [0,1,2,3,4,5,6].forEach(i=>{const pulso=[0,2,4].includes(i),on=i===2;cuerpo+=`<rect x="${330+i*16}" y="${pulso?226:231}" width="${on?6:4}" height="${pulso?12:7}" fill="${on?(etapa===1?C.oro:'#fff6d8'):'#8a7a9a'}"/>`;});
  cuerpo+=txt(24,34,etapa===1?'Afinado: doble daño y atraviesa':'Fuera del pulso',17,etapa===1?C.oro:C.blanco)+txt(330,218,'pulso',12,C.gris)+(etapa===1?txt(24,236,'multiplicador ×2',16,C.oro):'');
 }else if(etapa===2){
  cuerpo+=`<rect x="226" y="20" width="28" height="40" rx="4" fill="#2e4442" stroke="#b08a50" stroke-width="3"/>`+circle(240,40,7,'#e6f2d8');
  cuerpo+=`<path d="M240 44L470 235L300 235Z" fill="#e6f6dc" opacity=".22"/>`;
  for(let k=0;k<14;k++){cuerpo+=circle(240+k*16.4,44+k*13.6,2,'#e6f6dc');cuerpo+=circle(240+k*4.3,44+k*13.6,1.6,'#e6f6dc88');}
  cuerpo+=cascoF(330)+`<path d="M318 204L344 204L392 250L355 250Z" fill="#0e0b1e" opacity=".85"/>`+farolF(120,216);
  cuerpo+=txt(24,34,'Sal del sector o escóndete tras un casco',16,C.verde);
 }else{
  cuerpo+=`<path d="M170 34q70-30 140 0l-20 10q-50-16-100 0z" fill="#241a2c" stroke="#9a86b8" stroke-width="2"/>`;
  for(let i=0;i<24;i++)if(i<14||i>16)cuerpo+=`<rect x="${12+i*19}" y="120" width="12" height="8" fill="#8a5cff"/>`;
  cuerpo+=`<path d="M${12+15*19+6} 92l-9-10h18z" fill="#e8dcc8"/>`+circle(12+15*19+6,76,9,'#e8dcc855');
  cuerpo+=farolF(12+15*19+6,216)+txt(24,34,'Busca el hueco que señala la marca',16,C.violeta);
 }
 return svg(nombre,cuerpo);
};
/* Boxhead: vista de arriba, cabezas cuadradas, combo y explosiones. */
const cabeza=(x,y,col,dir='→')=>rect(x-11,y-11,22,22,col,'#142139',3)+txt(x,y+5,dir,13,'#142139','middle');
export const boxhead=etapa=>{
 const nombres=['Una baja tras otra sube el multiplicador','El barril revienta y se lleva a todos los cercanos','Las armas llegan con el multiplicador más alto','En supervivencia, quien cae vuelve en el nivel siguiente','En versus gana el primero en llegar a la meta de bajas'];
 const suelo=rect(18,18,444,214,'#4a4536','#6b6450',12)+[60,140,220,300,380].map(x=>line(x,30,x,220,'#57513f',1)).join('');
 let c='';
 if(etapa===0){c=cabeza(90,125,C.azul)+line(104,125,230,125,C.oro,3)+[250,300,350].map((x,i)=>circle(x,125-(i%2)*20,11,i?'#7fa36a':'#7fa36a88')).join('')+rect(300,190,150,26,'#142139','#465773',6)+rect(304,195,100,16,C.oro,'none',3)+txt(428,209,'×3',16,C.oro,'middle');}
 else if(etapa===1){c=cabeza(80,170,C.azul,'↗')+rect(232,92,26,32,'#c0563f','#142139',4)+circle(245,108,62,'#ffb34744')+circle(245,108,30,'#ffd36b88')+[[205,80],[290,95],[250,160],[200,140]].map(([x,y])=>circle(x,y,10,'#7fa36a')).join('')+line(96,158,232,112,C.oro,3);}
 else if(etapa===2){c=['PISTOLA ×1','UZI ×5','ESCOPETA ×10','BARRILES ×15','GRANADAS ×20','MURO ×25','COHETES ×30','CARGAS ×40'].map((t,i)=>rect(34+(i%4)*108,60+Math.floor(i/4)*80,96,56,i<3?C.oro:'#273650','#465773',6)+txt(82+(i%4)*108,93+Math.floor(i/4)*80,t,12,i<3?'#142139':C.gris,'middle')).join('');}
 else if(etapa===3){c=cabeza(120,120,C.azul)+cabeza(190,140,C.verde)+rect(300,110,22,22,'#55606b','#142139',3)+txt(311,160,'CAÍDO',12,C.rojo,'middle')+txt(240,215,'Nivel limpio → vuelve al empezar el siguiente',15,C.verde,'middle');}
 else {c=cabeza(120,125,C.azul,'→')+cabeza(330,125,C.rojo,'←')+line(134,125,316,125,C.oro,3)+txt(120,170,'A: 9',16,C.azul,'middle')+txt(330,170,'B: 7',16,C.rojo,'middle')+txt(240,215,'Meta: 10 bajas',16,C.oro,'middle');}
 return svg(nombres[etapa],suelo+c);
};
/* Atasco: el estacionamiento de 6×6 visto desde arriba, con la salida a la
   derecha de la 3.ª fila. Un ejemplo de cuatro movidas: `etapa` 0 el auto
   rojo encerrado, 1 el camino abierto (tres movidas), 2 el rojo saliendo. */
const vehA=(x,y,w,h,color,rojo)=>rect(x+3,y+3,w-6,h-6,color,'#1d2330',9)+(rojo?`<path d="M${x+10} ${y+h/2-4}H${x+w-10}M${x+10} ${y+h/2+4}H${x+w-10}" stroke="#fff" stroke-width="3"/>`:'');
export const atasco=etapa=>{
 const nombre=['El auto rojo está encerrado por un auto, un camión y un furgón','Tres movidas abren el camino: el furgón a la izquierda, el camión abajo y el auto arriba','La cuarta movida saca al auto rojo por la salida: cuatro movidas, tres estrellas'][etapa];
 const z=34,ox=28,oy=22,X=c=>ox+c*z,Y=f=>oy+f*z;
 let cuerpo=rect(ox-8,oy-8,6*z+16,6*z+16,'#c9cdd4','#f5b700',12)+`<rect x="${ox}" y="${oy}" width="${6*z}" height="${6*z}" rx="6" fill="#474c56"/>`;
 for(let c=1;c<6;c++)cuerpo+=line(X(c),oy,X(c),oy+6*z,'#ffffff2e',2);
 cuerpo+=`<rect x="${X(6)-2}" y="${Y(2)}" width="14" height="${z}" fill="#474c56"/>`+`<path d="M${X(6)+8} ${Y(2)}v${z}" stroke="#e8322f" stroke-width="5" stroke-dasharray="6 5"${etapa===2?' transform="rotate(-80 '+(X(6)+8)+' '+Y(2)+')"':''}/>`;
 // Posiciones: D (furgón, fila 5), C (camión de pie, col 4), B (auto de pie, col 3), A (el rojo, fila 2).
 const d=etapa?2:3,cf=etapa?3:2,bf=etapa?0:1,ac=etapa===2?4:0;
 cuerpo+=vehA(X(d),Y(5),2*z,z,'#ff8a1e')+vehA(X(4),Y(cf),z,3*z,'#2a9d8f')+vehA(X(3),Y(bf),z,2*z,'#2f7de1');
 cuerpo+=vehA(X(ac),Y(2),2*z,z,'#e8322f',true);
 if(etapa===1){cuerpo+=line(X(4)+z/2,Y(2)+10,X(4)+z/2,Y(3)+z/2,C.oro,3)+line(X(3)+z/2,Y(2)+z-8,X(3)+z/2,Y(1)+z/2,C.oro,3)+line(X(5)-6,Y(5)+z/2,X(4)+6,Y(5)+z/2,C.oro,3);}
 if(etapa===2)cuerpo+=line(X(1),Y(2)+z/2,X(3)+8,Y(2)+z/2,C.oro,3);
 const textos=[['El auto rojo','está encerrado.','Mínimo: 4 movidas'],['Abre el camino','sin sacar nada','del estacionamiento.'],['¡Afuera!','4 movidas:','★★★']][etapa];
 cuerpo+=txt(272,90,textos[0],22,etapa===2?C.oro:C.blanco)+txt(272,122,textos[1],17)+txt(272,150,textos[2],17,etapa===2?C.oro:C.verde);
 return svg(nombre,cuerpo);
};
/* ALETEO: el pájaro entre tubos, de costado. Etapa 0, aletea y sube;
   1, deja de aletear y cae por el hueco; 2, pasa el tubo y suma el punto.
   El cielo es el de la mañana: el manual no cuenta lo que viene después. */
export const aleteo=etapa=>{
 const nombre=['Un aleteo sube al pájaro hacia el hueco entre los tubos','Sin aletear, la gravedad lo baja por el hueco','Pasado el par de tubos, el marcador suma un punto'][etapa];
 let cuerpo=`<rect x="14" y="14" width="452" height="196" rx="10" fill="#3fb6f5"/><rect x="14" y="120" width="452" height="90" fill="#c4efff" opacity=".55"/>`;
 cuerpo+=circle(410,52,22,'#ffe46b')+circle(90,60,14,'#ffffff')+circle(108,56,18,'#ffffff')+circle(126,62,12,'#ffffff');
 const tubo=(x,y,h)=>rect(x,y,52,h,'#6fd04b','#24451a',4)+`<rect x="${x+8}" y="${y+4}" width="9" height="${Math.max(0,h-8)}" fill="#c2f58a" opacity=".7"/>`;
 const tx=etapa===2?120:250,hueco=[96,150];
 cuerpo+=tubo(tx,14,hueco[0]-14)+rect(tx-6,hueco[0]-20,64,20,'#6fd04b','#24451a',4)+tubo(tx,hueco[1],196-(hueco[1]-14))+rect(tx-6,hueco[1],64,20,'#6fd04b','#24451a',4);
 cuerpo+=`<rect x="14" y="196" width="452" height="14" fill="#86cf3c"/><rect x="14" y="206" width="452" height="30" rx="0" fill="#ead79a"/>`;
 const [bx,by]=[[150,150],[262,112],[250,122]][etapa];
 const rot=[-25,25,5][etapa];
 cuerpo+=`<g transform="translate(${bx} ${by}) rotate(${rot})"><ellipse rx="17" ry="13" fill="#ffd23f" stroke="#1a1a1a" stroke-width="2"/><ellipse cx="3" cy="5" rx="9" ry="6" fill="#fff4c2"/><ellipse cx="-6" cy="${etapa===0?-6:3}" rx="9" ry="5" fill="#ffae12" stroke="#1a1a1a" stroke-width="1.5"/><circle cx="7" cy="-4" r="4" fill="#ffffff" stroke="#1a1a1a" stroke-width="1.5"/><circle cx="8" cy="-4" r="1.8" fill="#1a1a1a"/><path d="M14 0 L24 3 L14 7 Z" fill="#ff7a1a" stroke="#1a1a1a" stroke-width="1.5"/></g>`;
 if(etapa===0)cuerpo+=line(bx-30,by+40,bx-4,by+14,C.blanco,3)+txt(bx-60,by+64,'¡aleteo!',16,'#ffffff');
 if(etapa===1)cuerpo+=line(bx-40,by-28,bx-8,by-6,'#ffffffaa',3)+txt(330,190,'cae solo',16,'#173052');
 const pts=etapa===2?1:0;
 cuerpo+=txt(240,48,String(pts),40,'#ffffff','middle');
 if(etapa===2)cuerpo+=txt(330,110,'+1 tubo',22,C.oro)+txt(330,138,'El hueco no',15,'#173052')+txt(330,158,'cambia de ancho',15,'#173052')+txt(330,178,'desde aquí.',15,'#173052');
 return svg(nombre,cuerpo);
};
/* Metro Rush: el corredor visto de costado (salta la barrera baja, rueda
   bajo la alta, sube por la rampa y corre por los techos) y, de espaldas,
   las tres vías con un tren que viene de frente. `etapa`: 0 barrera baja,
   1 barrera alta, 2 tren de frente, 3 la rampa, 4 los techos con monedas. */
const VL={suelo:'#2b2730',riel:'#c9ccd4',durmiente:'#7a5236',tren:'#ff6a3d',trenOsc:'#b8441f',vidrio:'#1f2a3a',piel:'#f1c27d',polera:'#3b82f6',gorra:'#ff6a3d'};
// El suelo de costado: balasto, un riel y los durmientes debajo.
const sueloV=()=>`<rect x="0" y="200" width="480" height="50" fill="${VL.suelo}"/>`+Array.from({length:17},(_,i)=>`<rect x="${6+i*29}" y="201" width="16" height="7" fill="${VL.durmiente}"/>`).join('')+line(0,199,480,199,VL.riel,4);
// El corredor de costado, con los pies en `fy`, mirando a la derecha.
const corredorV=(x,fy)=>{
 const l=(a,b,c,d,col,w)=>line(x+a,fy+b,x+c,fy+d,col,w);
 return l(0,-32,10,-16,C.gris,6)+l(10,-16,4,0,C.gris,6)+l(0,-32,-6,-17,C.gris,6)+l(-6,-17,-17,-8,C.gris,6)+   // piernas
  l(0,-58,10,-46,VL.piel,5)+l(10,-46,18,-56,VL.piel,5)+l(0,-58,-10,-48,VL.piel,5)+l(-10,-48,-14,-38,VL.piel,5)+ // brazos
  l(0,-60,0,-32,VL.polera,11)+circle(x+1,fy-70,10,VL.piel)+`<path d="M${x-10} ${fy-72}q11-14 22-1h7v4h-29z" fill="${VL.gorra}"/>`;    // polera, cabeza y gorra
};
// Hecho un ovillo para rodar, con las rayas de velocidad detrás.
const ovilloV=(x,fy)=>circle(x,fy-18,18,VL.polera,'#88caff')+circle(x+7,fy-24,7,VL.piel)+`<path d="M${x-1} ${fy-27}q8-9 16 0z" fill="${VL.gorra}"/>`+
 [0,1,2].map(i=>line(x-28-i*6,fy-30+i*12,x-44-i*6,fy-30+i*12,C.gris,3)).join('');
// Un vagón de costado: cuerpo naranja, franja, ventanas y ruedas sobre el riel.
const vagonV=(x,w,frente=false)=>rect(x,118,w,74,VL.tren,VL.trenOsc,6)+`<rect x="${x}" y="168" width="${w}" height="8" fill="${VL.trenOsc}"/>`+
 Array.from({length:Math.floor((w-20)/34)},(_,i)=>`<rect x="${x+14+i*34}" y="132" width="24" height="22" rx="3" fill="${VL.vidrio}"/>`).join('')+
 circle(x+22,194,8,'#3a3f4a','#9aa3b3')+circle(x+w-22,194,8,'#3a3f4a','#9aa3b3')+(frente?circle(x+w-6,180,4,'#fff6c2'):'');
const monedaV=(x,y,r=8)=>circle(x,y,r,'#ffc83d','#b07a10')+`<rect x="${x-1.5}" y="${y-r/2}" width="3" height="${r}" fill="#d99a1c"/>`;
export const metrorush=etapa=>{
 const nombre=['La barrera baja, a rayas y a la altura de la cintura, se salta','La barrera alta, con una flecha hacia abajo, se pasa rodando','Un tren que viene de frente por tu carril: cambia de carril para esquivarlo','Un tren detenido con rampa: corre por ella y subes al techo','Por los techos de los trenes, con una fila de monedas encima'][etapa];
 // El cielo de tarde: una banda cálida sobre el azul del manual.
 let cuerpo=`<rect x="0" y="0" width="480" height="250" rx="14" fill="#1d2440"/><rect x="0" y="120" width="480" height="80" fill="#3a2a4a" opacity=".55"/>`;
 if(etapa===0){
  // Barrera baja: dos patas y una tabla a rayas rojas y blancas a la altura de la cintura.
  cuerpo+=sueloV()+rect(282,150,8,50,'#6b7280','none',2)+rect(352,150,8,50,'#6b7280','none',2)+rect(274,150,94,20,C.blanco,'#ff9c9c',3);
  for(let i=0;i<5;i++)cuerpo+=`<path d="M${278+i*19} 168l10-16h8l-10 16z" fill="#e5484d"/>`;
  // El salto: el arco punteado y el corredor en lo más alto, justo encima de la tabla.
  cuerpo+=`<path d="M160 200Q318 44 476 200" fill="none" stroke="${C.oro}" stroke-width="3" stroke-dasharray="7 8"/>`+corredorV(318,122);
  cuerpo+=txt(24,34,'Barrera baja: salta',17,C.blanco)+txt(24,58,'↑, W, Espacio o desliza hacia arriba',14,C.gris);
 }else if(etapa===1){
  // Barrera alta: patas largas, tabla arriba con una flecha hacia abajo; por debajo se pasa rodando.
  cuerpo+=sueloV()+rect(282,96,8,104,'#6b7280','none',2)+rect(352,96,8,104,'#6b7280','none',2)+rect(274,96,94,40,'#facc15','#a16207',4);
  cuerpo+=`<path d="M321 102v18m-9-8l9 10l9-10" stroke="#17243b" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  cuerpo+=`<path d="M120 186H460" stroke="${C.verde}" stroke-width="3" stroke-dasharray="7 8"/>`+ovilloV(318,200)+corredorV(110,200);
  cuerpo+=txt(24,34,'Barrera alta: rueda por debajo',17,C.blanco)+txt(24,58,'↓, S o desliza hacia abajo',14,C.gris);
 }else if(etapa===2){
  // De espaldas: tres carriles que se juntan en el horizonte, con sus durmientes y sus rieles.
  const borde=(y,k)=>{const t=(y-70)/180;return 210-170*t+(60+340*t)*k;};
  cuerpo+=`<path d="M40 250L210 70H270L440 250Z" fill="${VL.suelo}"/>`;
  for(const y of [92,108,128,152,180,212,246])cuerpo+=line(borde(y,0),y,borde(y,1),y,VL.durmiente,y/40);
  for(let c=0;c<3;c++)for(const f of [.22,.78])cuerpo+=line(borde(70,(c+f)/3),70,borde(250,(c+f)/3),250,VL.riel,2.5);
  // El tren de frente en el carril del medio, con los dos focos encendidos.
  cuerpo+=rect(206,84,68,66,VL.tren,VL.trenOsc,8)+`<rect x="214" y="92" width="52" height="24" rx="4" fill="${VL.vidrio}"/>`;
  cuerpo+=circle(218,138,9,'#fff6c255')+circle(262,138,9,'#fff6c255')+circle(218,138,5,'#fff6c2')+circle(262,138,5,'#fff6c2');
  // El corredor de espaldas y la flecha que lo lleva al carril de la izquierda.
  cuerpo+=line(240,212,240,184,VL.polera,14)+line(235,214,233,226,C.gris,5)+line(245,214,247,226,C.gris,5)+circle(240,172,10,VL.piel)+`<path d="M230 168q10-12 20 0z" fill="${VL.gorra}"/>`;
  cuerpo+=`<path d="M228 192Q180 192 156 174" fill="none" stroke="${C.verde}" stroke-width="4" stroke-linecap="round"/><path d="M150 168l14 0l-6 12z" fill="${C.verde}"/>`;
  cuerpo+=txt(24,34,'Tren de frente: cambia de carril',17,C.blanco)+txt(24,58,'← → o desliza a un lado',14,C.gris);
  // El aviso va sobre una placa para que los rieles no lo crucen.
  cuerpo+=`<rect x="238" y="220" width="228" height="24" rx="6" fill="#142139" opacity=".9"/>`+txt(456,237,'Chocar de frente termina la carrera',13,C.rojo,'end');
 }else if(etapa===3){
  // Un tren detenido con su rampa: el corredor sube por ella al techo.
  cuerpo+=sueloV()+vagonV(240,220)+`<path d="M150 199L240 118V199Z" fill="#facc15" stroke="#a16207" stroke-width="3"/>`;
  for(let i=0;i<4;i++)cuerpo+=line(166+i*20,190-i*18,176+i*20,199,'#a16207',3);
  cuerpo+=`<path d="M90 196H150L240 116H300" fill="none" stroke="${C.oro}" stroke-width="3" stroke-dasharray="7 8"/>`+corredorV(196,158);
  cuerpo+=txt(24,34,'Tren detenido con rampa: sube',17,C.blanco)+txt(24,58,'o esquívalo por otro carril',14,C.gris);
 }else{
  // Dos vagones en fila y el corredor arriba, con una fila de monedas sobre los techos.
  cuerpo+=sueloV()+vagonV(30,200)+vagonV(244,206);
  for(let i=0;i<8;i++)cuerpo+=monedaV(150+i*36,92);
  // Los textos van a la derecha: a la izquierda está el corredor sobre el primer techo.
  cuerpo+=corredorV(110,118)+txt(456,34,'Por los techos',17,C.blanco,'end')+txt(456,58,'monedas arriba, trenes abajo',14,C.gris,'end');
 }
 return svg(nombre,cuerpo);
};
