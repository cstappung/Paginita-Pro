import {ambientar} from '../sonido.js';
import {categoriaClub,resultadoClub,mejorClub} from './club-datos.js';

/* El documento del juego conserva su CSS, su audio y sus animaciones.
   Solo este adaptador conoce la cuenta y escribe en Firebase.

   Sin `usuario` es el modo invitado del salón: el juego es el mismo, pero
   no se escucha ninguna clasificación (la base no deja leerla sin sesión),
   no se guarda ningún récord ni partida a medias, y el panel del juego
   dice por qué en vez de ofrecer «reintentar». El juego guarda lo suyo con
   la cuenta «invitado», que el salón borra al empezar otra visita. */
export function crearSolo({juego,usuario,guardar,watch,volver,alResultado,partida}) {
  let host,frame,off,temaObserver,categoria='',muerto=false,pendientes={},guardando=false,propios={};
  const invitado=!usuario,cuenta=invitado?'invitado':usuario.uid;
  const clave='jg.club.pendientes.'+cuenta+'.'+juego;
  const ocultos=[];
  if(!invitado) try { const valor=JSON.parse(localStorage.getItem(clave)||'{}');
    for (const [k,v] of Object.entries(valor||{})) { const dato=resultadoClub(juego,v);if(dato&&k===dato.categoria)pendientes[k]=dato; }
  } catch {}
  function persistir(){try{localStorage.setItem(clave,JSON.stringify(pendientes));}catch{}}
  function enviar(dato){if(!muerto)frame.contentWindow?.postMessage({canal:'club-parent',...dato},location.origin);}
  function estado(texto,key=categoria){enviar({tipo:'estado',categoria:key,texto});}
  async function sincronizar(){
    if(guardando||muerto||invitado)return;guardando=true;const revisados={};
    for(const [key,dato] of Object.entries(pendientes)){
      if(muerto)break;revisados[key]=dato.partida;
      estado('Sincronizando tu récord…',key);
      try{
        await guardar(key,usuario.uid,{...dato,nombre:usuario.name.slice(0,80)});
        if(pendientes[key]?.partida===dato.partida){delete pendientes[key];persistir();}
        estado('Récord sincronizado con tu cuenta.',key);
      }catch(err){
        /* PERMISSION_DENIED en una categoría nueva es casi siempre que las
           reglas del repo aún no se publican en la consola: decirlo, porque
           «puedes reintentar» no lo arregla. El récord sigue pendiente y
           sube solo la próxima vez que se abra el juego. */
        estado(/permission/i.test(String(err&&(err.code||err.message)||err))
          ?'Récord guardado en este dispositivo. El servidor todavía no acepta esta clasificación (faltan publicar las reglas de Firebase); se subirá sola cuando estén.'
          :'Récord guardado en este dispositivo. No se pudo sincronizar; puedes reintentar.',key);
      }
    }
    guardando=false;
    if(!muerto&&Object.entries(pendientes).some(([key,dato])=>revisados[key]!==dato.partida))sincronizar();
  }
  function escuchar(key){
    if(off)off();categoria=key;
    if(invitado){off=null;estado('Modo invitado: esta partida no se guarda ni entra en la clasificación. Inicia sesión en Juegos para competir.',key);return;}
    off=watch(key,(filas,error)=>{
      if(muerto||categoria!==key)return;
      const orden=(filas||[]).sort((a,b)=>b.puntos-a.puntos||a.tiempo-b.tiempo||a.uid.localeCompare(b.uid));
      propios[key]=orden.find(f=>f.uid===usuario.uid)||null;
      enviar({tipo:'ranking',categoria:key,filas:orden.slice(0,10).map(f=>({nombre:f.nombre,puntos:f.puntos,tiempo:f.tiempo,yo:f.uid===usuario.uid})),propio:orden.find(f=>f.uid===usuario.uid)||null,error:!!error});
    });
    sincronizar();
  }
  function mensaje(e){
    if(muerto||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.canal!=='club-child')return;
    const d=e.data;
    if(d.tipo==='alto'&&Number.isFinite(d.alto)){if(juego==='sortem')return;frame.style.height=Math.min(4000,Math.max(320,d.alto))+'px';return;}
    if(d.tipo==='volver'){volver();return;}
    if(d.tipo==='reintentar'){sincronizar();return;}
    /* La partida a medias vive en la cuenta: el juego la pide al abrir y la
       manda al empezar cada ronda. Si no hay cuenta o falla, sigue la local. */
    if(d.tipo==='partida-pedir'){
      if(!partida){enviar({tipo:'partida',dato:null});return;}
      partida.leer().then(dato=>enviar({tipo:'partida',dato:dato||null}),()=>enviar({tipo:'partida',error:true}));return;
    }
    if(d.tipo==='partida-guardar'){if(partida)partida.guardar(typeof d.d==='string'&&d.d.length<200000?d.d:null,d.at).catch(()=>{});return;}
    if(d.tipo==='categoria'){
      if(categoriaClub(juego,d.categoria))escuchar(d.categoria);
      else if(juego==='snake'&&d.categoria==='zen'){if(off)off();off=null;categoria='zen';}
      return;
    }
    if(d.tipo==='resultado'){
      const dato=resultadoClub(juego,d);if(!dato)return;
      if(invitado){estado('Buena partida. Como invitado no se guarda: inicia sesión para que tus récords entren en la clasificación.',dato.categoria);return;}
      if(alResultado){try{alResultado(dato,propios[dato.categoria]||pendientes[dato.categoria]||null);}catch(err){/* un logro no debe romper la partida */}}
      if(mejorClub(dato,pendientes[dato.categoria])){pendientes[dato.categoria]=dato;persistir();}
      sincronizar();
    }
  }
  function montar(el){
    host=el;ambientar(null);host.innerHTML='';
    for(const id of ['btnMusica','volMusica','btnSonido']){const el=document.getElementById(id);if(el){ocultos.push([el,el.style.display]);el.style.display='none';}}
    frame=document.createElement('iframe');frame.title=juego==='minas'?'Mina Club — Buscaminas':juego==='tetris'?'Tetris Club':juego==='sortem'?'sortEm':juego==='bbtan'?'BBTAN':juego==='sopa'?'Sopa de letras':juego==='electro'?'Electrodle':juego==='sudoku'?'Sudoku Arcade':juego==='fanal'?'FANAL':'Snake Club';
    frame.className='jg-solo-frame';
    frame.style.height=juego==='tetris'?'880px':juego==='sortem'||juego==='bbtan'||juego==='electro'||juego==='sudoku'||juego==='fanal'?'900px':'760px';
    const tema=()=>enviar({tipo:'tema',oscuro:document.documentElement.dataset.tema==='oscuro'});
    frame.addEventListener('load',tema);
    if(juego==='sortem')frame.addEventListener('load',()=>frame.focus());
    temaObserver=new MutationObserver(tema);
    temaObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-tema']});
    frame.allow='fullscreen';frame.setAttribute('allowfullscreen','');
    window.addEventListener('message',mensaje);
    frame.src='juegos/club/'+juego+'/index.html?v=club-19&embed=1&cuenta='+encodeURIComponent(cuenta)+(invitado?'&invitado=1':'');
    host.appendChild(frame);
  }
  function destruir(){muerto=true;temaObserver?.disconnect();if(off)off();window.removeEventListener('message',mensaje);for(const [el,valor]of ocultos)el.style.display=valor;frame?.remove();host.innerHTML='';ambientar('');}
  return {montar,destruir};
}
