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
