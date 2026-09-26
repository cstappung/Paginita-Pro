import {ambientar} from '../sonido.js';
import {categoriaClub,resultadoClub,mejorClub} from './club-datos.js';

/* El documento del juego conserva su CSS, su audio y sus animaciones.
   Solo este adaptador conoce la cuenta y escribe en Firebase. */
export function crearSolo({juego,usuario,guardar,watch,volver}) {
  let host,frame,off,categoria='',muerto=false,pendientes={},guardando=false;
  const clave='jg.club.pendientes.'+usuario.uid+'.'+juego;
  const ocultos=[];
  try { const valor=JSON.parse(localStorage.getItem(clave)||'{}');
    for (const [k,v] of Object.entries(valor||{})) { const dato=resultadoClub(juego,v);if(dato&&k===dato.categoria)pendientes[k]=dato; }
  } catch {}
  function persistir(){try{localStorage.setItem(clave,JSON.stringify(pendientes));}catch{}}
  function enviar(dato){if(!muerto)frame.contentWindow?.postMessage({canal:'club-parent',...dato},location.origin);}
  function estado(texto,key=categoria){enviar({tipo:'estado',categoria:key,texto});}
  async function sincronizar(){
    if(guardando||muerto)return;guardando=true;const revisados={};
    for(const [key,dato] of Object.entries(pendientes)){
      if(muerto)break;revisados[key]=dato.partida;
      estado('Sincronizando tu récord…',key);
      try{
        await guardar(key,usuario.uid,{...dato,nombre:usuario.name.slice(0,80)});
        if(pendientes[key]?.partida===dato.partida){delete pendientes[key];persistir();}
        estado('Récord sincronizado con tu cuenta.',key);
      }catch{estado('Récord guardado en este dispositivo. No se pudo sincronizar; puedes reintentar.',key);}
    }
    guardando=false;
    if(!muerto&&Object.entries(pendientes).some(([key,dato])=>revisados[key]!==dato.partida))sincronizar();
  }
  function escuchar(key){
    if(off)off();categoria=key;
    off=watch(key,(filas,error)=>{
      if(muerto||categoria!==key)return;
      const orden=(filas||[]).sort((a,b)=>b.puntos-a.puntos||a.tiempo-b.tiempo||a.uid.localeCompare(b.uid));
      enviar({tipo:'ranking',categoria:key,filas:orden.slice(0,10).map(f=>({nombre:f.nombre,puntos:f.puntos,tiempo:f.tiempo,yo:f.uid===usuario.uid})),propio:orden.find(f=>f.uid===usuario.uid)||null,error:!!error});
    });
    sincronizar();
  }
  function mensaje(e){
    if(muerto||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.canal!=='club-child')return;
    const d=e.data;
    if(d.tipo==='alto'&&Number.isFinite(d.alto)){frame.style.height=Math.min(4000,Math.max(600,d.alto))+'px';return;}
    if(d.tipo==='volver'){volver();return;}
    if(d.tipo==='reintentar'){sincronizar();return;}
    if(d.tipo==='categoria'){
      if(categoriaClub(juego,d.categoria))escuchar(d.categoria);
      else if(juego==='snake'&&d.categoria==='zen'){if(off)off();off=null;categoria='zen';}
      return;
    }
    if(d.tipo==='resultado'){
      const dato=resultadoClub(juego,d);if(!dato)return;
      if(mejorClub(dato,pendientes[dato.categoria])){pendientes[dato.categoria]=dato;persistir();}
      sincronizar();
    }
  }
  function montar(el){
    host=el;ambientar('');host.innerHTML='';
    for(const id of ['btnMusica','volMusica','btnSonido']){const el=document.getElementById(id);if(el){ocultos.push([el,el.style.display]);el.style.display='none';}}
    frame=document.createElement('iframe');frame.title=juego==='minas'?'Mina Club — Buscaminas':'Snake Club';
    frame.style.cssText='display:block;width:100%;height:1100px;border:0;border-radius:18px;background:#f5f5ed';
    frame.allow='fullscreen';frame.setAttribute('allowfullscreen','');
    window.addEventListener('message',mensaje);
    frame.src='juegos/club/'+juego+'/index.html?v=club-2&cuenta='+encodeURIComponent(usuario.uid);
    host.appendChild(frame);
  }
  function destruir(){muerto=true;if(off)off();window.removeEventListener('message',mensaje);for(const [el,valor]of ocultos)el.style.display=valor;frame?.remove();host.innerHTML='';ambientar('');}
  return {montar,destruir};
}
