/* Motores individuales puros; el reloj, el dibujo y Firebase quedan fuera. */
export const TAMANOS_MINAS = {explorador:[9,9,10],veterano:[16,16,40],leyenda:[30,16,99]};
export function vecinos(i,w,h,cruz=false){
 const out=[],x=i%w,y=Math.floor(i/w);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if((!dx&&!dy)||(cruz&&Math.abs(dx)+Math.abs(dy)!==1))continue;
  if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)out.push((y+dy)*w+x+dx);
 }return out;
}
export function minasNueva(tamano='explorador',variante='clasico'){
 const [w,h,n]=TAMANOS_MINAS[tamano]||TAMANOS_MINAS.explorador;
 return {w,h,n,cruz:variante==='cruz',minas:null,abiertas:new Set(),banderas:new Set(),estado:'lista',golpe:-1};
}
export function abrirMina(s,i,random=Math.random){
 if(!Number.isInteger(i)||i<0||i>=s.w*s.h||s.banderas.has(i)||['gana','pierde'].includes(s.estado))return false;
 if(!s.minas){
  const salvo=new Set([i,...vecinos(i,s.w,s.h,s.cruz)]),pos=[];
  for(let k=0;k<s.w*s.h;k++)if(!salvo.has(k))pos.push(k);
  for(let k=pos.length-1;k>0;k--){const j=Math.floor(random()*(k+1));[pos[k],pos[j]]=[pos[j],pos[k]];}
  s.minas=new Set(pos.slice(0,s.n));s.estado='jugando';
 }
 if(s.abiertas.has(i))return false;
 if(s.minas.has(i)){s.estado='pierde';s.golpe=i;return true;}
 const cola=[i];while(cola.length){const k=cola.pop();if(s.abiertas.has(k)||s.banderas.has(k))continue;
  s.abiertas.add(k);if(!cuenta(s,k))for(const v of vecinos(k,s.w,s.h,s.cruz))if(!s.abiertas.has(v))cola.push(v);
 }
 if(s.abiertas.size===s.w*s.h-s.n)s.estado='gana';return true;
}
export const cuenta=(s,i)=>vecinos(i,s.w,s.h,s.cruz).filter(v=>s.minas?.has(v)).length;
export function bandera(s,i){if(!Number.isInteger(i)||i<0||i>=s.w*s.h||s.abiertas.has(i)||['gana','pierde'].includes(s.estado))return;
 if(s.banderas.has(i))s.banderas.delete(i);else if(s.banderas.size<s.n)s.banderas.add(i);
}
export function acorde(s,i){if(!s.abiertas.has(i)||s.estado!=='jugando')return;
 const v=vecinos(i,s.w,s.h,s.cruz);if(v.filter(k=>s.banderas.has(k)).length===cuenta(s,i))for(const k of v)abrirMina(s,k);
}
export function serpienteNueva(modo='clasico',random=Math.random){
 const s={w:24,h:24,cuerpo:[{x:12,y:12},{x:11,y:12},{x:10,y:12}],dir:{x:1,y:0},cola:[],obstaculos:[],comida:null,puntos:0,estado:'jugando',modo};
 if(modo==='ruinas')for(let i=6;i<18;i++)if(i<10||i>13){s.obstaculos.push({x:i,y:6},{x:i,y:17},{x:6,y:i},{x:17,y:i});}
 nuevaComida(s,random);return s;
}
const igual=(a,b)=>a.x===b.x&&a.y===b.y;
function nuevaComida(s,r){const libres=[];for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){const p={x,y};if(!s.cuerpo.some(b=>igual(b,p))&&!s.obstaculos.some(b=>igual(b,p)))libres.push(p);}
 if(!libres.length){s.estado='gana';s.comida=null;}else s.comida=libres[Math.floor(r()*libres.length)];
}
export function girar(s,d){const ultimo=s.cola.at(-1)||s.dir;if(s.cola.length>=2||Math.abs(d.x)+Math.abs(d.y)!==1||d.x===-ultimo.x&&d.y===-ultimo.y)return;
 if(d.x!==ultimo.x||d.y!==ultimo.y)s.cola.push(d);
}
export function avanzar(s,r=Math.random){if(s.estado!=='jugando')return;
 s.dir=s.cola.shift()||s.dir;const p={x:s.cuerpo[0].x+s.dir.x,y:s.cuerpo[0].y+s.dir.y};
 if(s.modo==='portal'){p.x=(p.x+s.w)%s.w;p.y=(p.y+s.h)%s.h;}
 const come=s.comida&&igual(p,s.comida),cuerpo=come?s.cuerpo:s.cuerpo.slice(0,-1);
 if(p.x<0||p.x>=s.w||p.y<0||p.y>=s.h||cuerpo.some(b=>igual(b,p))||s.obstaculos.some(b=>igual(b,p))){s.estado='pierde';return;}
 s.cuerpo.unshift(p);if(come){s.puntos+=100;nuevaComida(s,r);}else s.cuerpo.pop();
}
