import { ejemplosPara } from './reglas-ejemplos.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Un único reloj local. Nunca se inicia al abrir ni escribe en la partida. */
export function montarGuia(host,juego,modo){
 const ejemplos=ejemplosPara(juego,modo);
 if(!ejemplos.length)return {destruir(){}};
 let ejemplo=0,paso=0,reloj=null,reproduciendo=false,muerto=false;
 const movimiento=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
 host.innerHTML=`<div class="jg-guia">
  <div class="jg-guia-cab"><div><small>APRENDE VIÉNDOLO</small><h3>Una jugada, paso a paso</h3></div><span class="jg-guia-cantidad">${ejemplos.length} ejemplo${ejemplos.length===1?'':'s'}</span></div>
  <label class="jg-guia-selector">Elige qué quieres entender<select aria-label="Ejemplo ilustrado">${ejemplos.map((e,i)=>`<option value="${i}">${esc(e.titulo)}</option>`).join('')}</select></label>
  <figure class="jg-guia-figura"><div class="jg-guia-imagen"></div><figcaption aria-live="polite" aria-atomic="true"><span class="jg-guia-paso"></span><h4></h4><p></p></figcaption></figure>
  <div class="jg-guia-controles"><button type="button" data-guia="anterior" aria-label="Paso anterior">← Anterior</button><button type="button" data-guia="play">▶ Reproducir</button><button type="button" data-guia="siguiente" aria-label="Paso siguiente">Siguiente →</button></div>
  <p class="jg-guia-ayuda">Ilustración de ejemplo. Avanza a tu ritmo; no modifica tu partida.</p>
 </div>`;
 const q=s=>host.querySelector(s),anterior=q('[data-guia="anterior"]'),siguiente=q('[data-guia="siguiente"]'),play=q('[data-guia="play"]');
 const duracion=()=>Math.max(4200,ejemplos[ejemplo].pasos[paso].texto.length*37);
 function botones(){
  anterior.disabled=paso===0;siguiente.disabled=paso===ejemplos[ejemplo].pasos.length-1;
  play.textContent=movimiento?.matches?(siguiente.disabled?'↻ Volver al inicio':'Ver otro paso'):reproduciendo?'Ⅱ Pausar':siguiente.disabled?'↻ Repetir':'▶ Reproducir';
  play.setAttribute('aria-label',movimiento?.matches?(siguiente.disabled?'Volver al primer paso':'Ver otro paso'):reproduciendo?'Pausar ejemplo':siguiente.disabled?'Repetir ejemplo':'Reproducir ejemplo');
  play.setAttribute('aria-pressed',String(reproduciendo));
 }
 function pinta(){
  if(muerto)return;
  const e=ejemplos[ejemplo],p=e.pasos[paso];
  q('.jg-guia-imagen').innerHTML=p.imagen;
  q('.jg-guia-paso').textContent=`PASO ${paso+1} DE ${e.pasos.length}`;
  q('h4').textContent=p.titulo;q('figcaption p').textContent=p.texto;botones();
 }
 function pausa(){clearTimeout(reloj);reloj=null;reproduciendo=false;if(!muerto)botones();}
 function programa(){
  clearTimeout(reloj);
  reloj=setTimeout(()=>{
   reloj=null;if(muerto||!reproduciendo)return;
   if(document.hidden){pausa();return;}
   paso++;pinta();
   if(paso>=ejemplos[ejemplo].pasos.length-1)pausa();else programa();
  },duracion());
 }
 anterior.onclick=()=>{pausa();if(paso>0){paso--;pinta();}};
 siguiente.onclick=()=>{pausa();if(paso<ejemplos[ejemplo].pasos.length-1){paso++;pinta();}};
 play.onclick=()=>{
  if(reproduciendo){pausa();return;}
  if(paso===ejemplos[ejemplo].pasos.length-1){paso=0;pinta();if(movimiento?.matches)return;}
  if(movimiento?.matches){paso++;pinta();return;}
  reproduciendo=true;botones();programa();
 };
 q('select').onchange=ev=>{pausa();const i=Number(ev.target.value);if(Number.isInteger(i)&&ejemplos[i]){ejemplo=i;paso=0;pinta();}};
 const visibilidad=()=>{if(document.hidden)pausa();};
 const reduce=()=>{if(movimiento?.matches)pausa();botones();};
 document.addEventListener('visibilitychange',visibilidad);movimiento?.addEventListener?.('change',reduce);
 pinta();
 return {destruir(){pausa();muerto=true;document.removeEventListener('visibilitychange',visibilidad);movimiento?.removeEventListener?.('change',reduce);host.innerHTML='';}};
}
