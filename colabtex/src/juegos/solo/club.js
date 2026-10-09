import {ambientar} from '../sonido.js';
import {categoriaClub,resultadoClub,mejorClub} from './club-datos.js';
import {verificaClub} from './verifica.js';

/* El documento del juego conserva su CSS, su audio y sus animaciones.
   Solo este adaptador conoce la cuenta y escribe en Firebase.

   Sin `usuario` es el modo invitado del salón: el juego es el mismo, pero
   no se escucha ninguna clasificación (la base no deja leerla sin sesión),
   no se guarda ningún récord ni partida a medias, y el panel del juego
   dice por qué en vez de ofrecer «reintentar». El juego guarda lo suyo con
   la cuenta «invitado», que el salón borra al empezar otra visita.

   Antes de guardar nada, el resultado pasa por el verificador de su juego
   (verifica.js, docs/antitrampas.md) con la prueba que mandó el juego. Si
   no cuadra, no se guarda, no paga y no da logros: el juego se entera
   (`rechazo`) y queda un aviso en `sospechas` (`reportaSospecha`). Lo que
   había pendiente en localStorage se vuelve a verificar al cargarlo
   (con la hora en que se jugó, `h`: un diario de ayer sigue valiendo),
   porque ese almacén también se puede editar a mano. `guardar` recibe la
   prueba como cuarto argumento, para escribirla junto al récord, y
   `alResultado` como tercero, para la mejor partida del día del salón
   (rieles.js), que se guarda aunque no sea récord. */
export function crearSolo({juego,usuario,guardar,watch,volver,alResultado,partida,reportaSospecha}) {
  let host,frame,off,temaObserver,categoria='',muerto=false,pendientes={},guardando=false,propios={};
  const invitado=!usuario,cuenta=invitado?'invitado':usuario.uid;
  const clave='jg.club.pendientes.'+cuenta+'.'+juego;
  const ocultos=[];
  /* Lo pendiente se vuelve a verificar al cargarlo: hasta que eso termina,
     sincronizar() espera. */
  const cargados=invitado?Promise.resolve():(async()=>{
    let valor={};try{valor=JSON.parse(localStorage.getItem(clave)||'{}')||{};}catch{}
    for (const [k,v] of Object.entries(valor)) { const dato=resultadoClub(juego,v);if(!dato||k!==dato.categoria)continue;
      /* Un pendiente de antes de la verificación (sin prueba) se descarta en
         silencio: no es trampa, es una versión vieja. */
      if(v.prueba===undefined||v.prueba===null)continue;
      const motivo=await verificaClub(juego,dato,v.prueba,{uid:cuenta,ahora:Number.isFinite(v.h)&&v.h<=Date.now()&&Date.now()-v.h<3*864e5?v.h:undefined});
      if(motivo){sospecha(dato,motivo,'pendiente');continue;}
      if(mejorClub(dato,pendientes[k]))pendientes[k]={...dato,prueba:v.prueba,h:v.h};
    }
    persistir();
  })();
  function persistir(){try{localStorage.setItem(clave,JSON.stringify(pendientes));}catch{}}
  function sospecha(dato,motivo,donde){
    console.warn('[club] partida rechazada',juego,dato.categoria,motivo);
    /* `vivo`: la partida se acaba de jugar. Solo eso castiga (castigo.js);
       un pendiente de localStorage pudo quedar de otra versión del juego. */
    if(reportaSospecha&&!invitado)Promise.resolve().then(()=>reportaSospecha({c:dato.categoria,m:motivo,p:dato.puntos,t:dato.tiempo,d:donde,vivo:donde==='en vivo'})).catch(()=>{});
  }
  function enviar(dato){if(!muerto)frame.contentWindow?.postMessage({canal:'club-parent',...dato},location.origin);}
  function estado(texto,key=categoria){enviar({tipo:'estado',categoria:key,texto});}
  async function sincronizar(){
    if(guardando||muerto||invitado)return;guardando=true;const revisados={};
    await cargados;
    for(const [key,dato] of Object.entries(pendientes)){
      if(muerto)break;revisados[key]=dato.partida;
      estado('Sincronizando tu récord…',key);
      try{
        const {prueba,h,...fila}=dato;
        await guardar(key,usuario.uid,{...fila,nombre:usuario.name.slice(0,80)},prueba);
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
    // Modo celular: mientras se juega, el iframe ocupa toda la ventana (como sortEm).
    if(d.tipo==='inmersivo'){document.documentElement.classList.toggle('jg-club-inm',!!d.v);return;}
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
      const prueba=d.prueba;
      verificaClub(juego,dato,prueba,{uid:cuenta}).then(motivo=>{
        if(muerto)return;
        if(motivo){
          sospecha(dato,motivo,'en vivo');
          estado('Esta partida no se guardó: '+motivo,dato.categoria);
          enviar({tipo:'rechazo',categoria:dato.categoria,partida:dato.partida,motivo});
          return;
        }
        if(alResultado){try{alResultado(dato,propios[dato.categoria]||pendientes[dato.categoria]||null,prueba);}catch(err){/* un logro no debe romper la partida */}}
        if(mejorClub(dato,pendientes[dato.categoria])){pendientes[dato.categoria]={...dato,prueba,h:Date.now()};persistir();}
        sincronizar();
      });
    }
  }
  function montar(el){
    host=el;ambientar(null);host.innerHTML='';
    for(const id of ['btnMusica','volMusica','btnSonido']){const el=document.getElementById(id);if(el){ocultos.push([el,el.style.display]);el.style.display='none';}}
    frame=document.createElement('iframe');frame.title=juego==='minas'?'Mina Club — Buscaminas':juego==='tetris'?'Tetris Club':juego==='sortem'?'sortEm':juego==='bbtan'?'BBTAN':juego==='sopa'?'Sopa de letras':juego==='electro'?'Electrodle':juego==='sudoku'?'Sudoku Arcade':juego==='fanal'?'FANAL':juego==='atasco'?'Atasco':juego==='aleteo'?'ALETEO':juego==='dosmil'?'2048':juego==='metrorush'?'Metro Rush':juego==='tulones'?'Tulones':'Snake Club';
    frame.className='jg-solo-frame';
    frame.style.height=juego==='tetris'?'880px':juego==='sortem'||juego==='bbtan'||juego==='electro'||juego==='sudoku'||juego==='fanal'||juego==='atasco'||juego==='aleteo'||juego==='dosmil'||juego==='tulones'||juego==='metrorush'?'900px':'760px';
    const tema=()=>enviar({tipo:'tema',oscuro:document.documentElement.dataset.tema==='oscuro'});
    frame.addEventListener('load',tema);
    if(juego==='sortem')frame.addEventListener('load',()=>frame.focus());
    temaObserver=new MutationObserver(tema);
    temaObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-tema']});
    frame.allow='fullscreen';frame.setAttribute('allowfullscreen','');
    window.addEventListener('message',mensaje);
    frame.src='juegos/club/'+juego+'/index.html?v=club-46&embed=1&cuenta='+encodeURIComponent(cuenta)+(invitado?'&invitado=1':'');
    host.appendChild(frame);
  }
  function destruir(){muerto=true;document.documentElement.classList.remove('jg-club-inm');temaObserver?.disconnect();if(off)off();window.removeEventListener('message',mensaje);for(const [el,valor]of ocultos)el.style.display=valor;frame?.remove();host.innerHTML='';ambientar('');}
  return {montar,destruir};
}
