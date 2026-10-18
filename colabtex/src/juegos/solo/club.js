import {ambientar} from '../sonido.js';
import {categoriaClub,resultadoClub,mejorClub} from './club-datos.js';
import {verificaClub,DE_INVITADO} from './verifica.js';

/* El documento del juego conserva su CSS, su audio y sus animaciones.
   Solo este adaptador conoce la cuenta y escribe en Firebase.

   Sin `usuario` es el modo invitado del salón: el juego es el mismo, pero
   no se escucha ninguna clasificación (la base no deja leerla sin sesión),
   no se guarda ningún récord ni partida a medias, y el panel del juego
   dice por qué en vez de ofrecer «reintentar». El juego guarda lo suyo con
   la cuenta «invitado», que el salón borra al empezar otra visita.
   En los juegos de `DE_INVITADO` (los destacados del salón) el resultado
   del invitado sí se verifica y queda pendiente en este navegador
   (`jg.club.pendientes.invitado.<juego>`), y `alInvitado(dato, mejoro)`
   lo cuenta y, si es su mejor marca, le ofrece iniciar sesión para guardarlo: al entrar, juegos-main.js lo sube a la
   cuenta (`subeDeInvitado`). `deInvitado` (con cuenta) le dice al juego
   que esta pestaña venía de invitado, para que adopte la partida a medias
   que dejó (`Club.deInvitado` en conexion.js).

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
/* `nombreDe(uid, nombre)`: el nombre que se ve de alguien (su apodo vivo, o el
   de la fila). La fila guarda el nombre que tenía al batir el récord, y sin
   esto el ranking del juego mostraba el de Google donde el resto del sitio
   ya mostraba el apodo. Si el apodo llega después, `refresca()` repinta. */
const PLENO=new Set(['prodefender']);
export function crearSolo({juego,usuario,guardar,watch,volver,alResultado,partida,reportaSospecha,fantasma,logro,nombreDe,alInvitado,deInvitado}) {
  let host,frame,off,temaObserver,categoria='',muerto=false,pendientes={},guardando=false,propios={};
  /* El fantasma (Metro Rush, modos «Fantasma»): la tabla ordenada que ya
     trae la escucha de cada categoría (`tablas`), quienes esperan a que
     llegue (`esperanTabla`) y las pruebas ya bajadas, por partida
     (`pruebasFantasma`): una prueba pesa hasta 200 kB, y el tope de
     descarga diario (consumo.js) no da para bajarla en cada carrera. */
  const tablas={},esperanTabla={},pruebasFantasma=new Map();
  const invitado=!usuario,cuenta=invitado?'invitado':usuario.uid;
  const guardaInvitado=invitado&&DE_INVITADO.has(juego);
  const clave='jg.club.pendientes.'+cuenta+'.'+juego;
  const ocultos=[];
  /* Lo pendiente se vuelve a verificar al cargarlo: hasta que eso termina,
     sincronizar() espera. */
  /* Lo del invitado se verificó al jugarlo y se vuelve a verificar al
     subirlo a la cuenta: aquí solo hace falta para comparar marcas. */
  const cargados=invitado?Promise.resolve().then(()=>{if(guardaInvitado)try{pendientes=JSON.parse(localStorage.getItem(clave)||'{}')||{};}catch{}}):(async()=>{
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
  /* `manual`: lo pidió «Reintentar sincronización». Sin nada pendiente el
     botón no hacía nada visible y parecía roto: ahora lo dice. */
  async function sincronizar(manual){
    if(guardando||muerto||invitado)return;guardando=true;const revisados={};
    await cargados;
    if(manual&&!muerto&&!Object.keys(pendientes).length)estado('No queda nada pendiente en este dispositivo: tu récord está al día con tu cuenta.');
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
  let ultimoRanking=null;
  const nombreVisto=f=>(nombreDe?nombreDe(f.uid,f.nombre):f.nombre)||f.nombre;
  function mandaRanking(){
    const r=ultimoRanking;if(!r||muerto||categoria!==r.key)return;
    const propio=r.orden.find(f=>f.uid===usuario.uid)||null;
    enviar({tipo:'ranking',categoria:r.key,filas:r.orden.slice(0,10).map(f=>({nombre:nombreVisto(f),puntos:f.puntos,tiempo:f.tiempo,yo:f.uid===usuario.uid})),propio:propio&&{...propio,nombre:nombreVisto(propio)},error:r.error});
  }
  function escuchar(key){
    if(off)off();categoria=key;
    if(invitado){off=null;estado(guardaInvitado?'Modo invitado: tu puntaje no se guarda. Inicia sesión (también después de perder) y tu mejor partida pasa a la clasificación.':'Modo invitado: esta partida no se guarda ni entra en la clasificación. Inicia sesión en Juegos para competir.',key);return;}
    off=watch(key,(filas,error)=>{
      if(muerto||categoria!==key)return;
      const orden=(filas||[]).sort((a,b)=>b.puntos-a.puntos||a.tiempo-b.tiempo||a.uid.localeCompare(b.uid));
      propios[key]=orden.find(f=>f.uid===usuario.uid)||null;
      tablas[key]=orden;for(const f of esperanTabla[key]||[])f(orden);delete esperanTabla[key];   // el fantasma que esperaba esta tabla
      if(key in fantasmaVisto&&fantasmaVisto[key]!==firmaTop(orden[0]))mandaFantasma(key,orden);   // cambió el n.º 1: el juego recibe el fantasma nuevo sin pedirlo
      ultimoRanking={key,orden,error:!!error};
      mandaRanking();
    });
    sincronizar();
  }
  /* El fantasma: la fila 1.ª de la tabla (en el orden del club: más
     puntos, menos tiempo, uid; en Metro Rush la tabla del fantasma es la de
     distancia, así que es la carrera más larga) y su prueba, leída POR
     CLAVE (las reglas no dejan leer soloPruebas entera). La tabla sale de
     la escucha que el juego ya abrió para esa categoría (no se baja dos
     veces); si el juego pide otra, se lee una vez. La prueba se guarda por
     partida: el mismo récord no se vuelve a bajar en la visita. Al invitado
     no se le lee nada (sin sesión la base no deja).
     `fantasmaVisto[cat]` recuerda qué n.º 1 se le mandó al juego: cuando la
     escucha trae otro (alguien, o tú mismo, acaba de batir el récord), se le
     manda el nuevo sin que lo pida. Antes el juego lo pedía 3 s después del
     resumen, cuando la fila nueva todavía no estaba escrita (se verifica,
     se escribe la prueba y recién ahí la fila), y le llegaba el anterior. */
  const fantasmaVisto={};
  const topDe=filas=>(filas||[]).slice().sort((a,b)=>b.puntos-a.puntos||a.tiempo-b.tiempo||a.uid.localeCompare(b.uid))[0]||null;
  const firmaTop=top=>top?top.uid+'/'+top.partida+'/'+top.puntos:'';
  function mandaFantasma(cat,filasYa){
    const responde=r=>enviar({tipo:'fantasma',categoria:cat,...r});
    if(invitado){responde({dato:null,motivo:'invitado'});return;}
    if(!fantasma||!categoriaClub(juego,cat)){responde({dato:null,motivo:'sin-fantasma'});return;}
    // la copia en memoria solo vale si es la de la categoría que se escucha
    // en vivo (las otras se quedan viejas: se leen de nuevo, una vez)
    const espera=()=>new Promise(f=>{
      const lista=esperanTabla[cat]=esperanTabla[cat]||[];lista.push(f);
      setTimeout(()=>{const i=lista.indexOf(f);if(i>=0)lista.splice(i,1);f(null);},6000);   // sin respuesta: se suelta (y se borra de la lista)
    }).then(t=>t||fantasma.leerTabla(cat));
    const tabla=filasYa?Promise.resolve(filasYa):cat===categoria?(tablas[cat]?Promise.resolve(tablas[cat]):espera()):fantasma.leerTabla(cat);
    tabla.then(async filas=>{
      const top=topDe(filas);
      fantasmaVisto[cat]=firmaTop(top);                          // este es el que el juego tiene ahora
      if(!top){responde({dato:null,motivo:'vacia'});return;}
      const base={nombre:String(top.nombre||'Jugador').slice(0,80),puntos:top.puntos,tiempo:top.tiempo,yo:top.uid===usuario.uid,partida:top.partida};
      if(typeof top.partida!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(top.partida)){responde({dato:{...base,d:''}});return;}
      const clave=cat+'/'+top.uid+'/'+top.partida;
      if(!pruebasFantasma.has(clave))pruebasFantasma.set(clave,fantasma.leerPrueba(cat,top.uid,top.partida).then(v=>v&&typeof v.d==='string'?v.d:'').catch(e=>{pruebasFantasma.delete(clave);throw e;}));
      responde({dato:{...base,d:await pruebasFantasma.get(clave)}});
    }).catch(()=>responde({error:true}));
  }
  function mensaje(e){
    if(muerto||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.canal!=='club-child')return;
    const d=e.data;
    if(d.tipo==='alto'&&Number.isFinite(d.alto)){if(juego==='sortem')return;frame.style.height=Math.min(4000,Math.max(320,d.alto))+'px';return;}
    if(d.tipo==='volver'){volver();return;}
    // Modo celular: mientras se juega, el iframe ocupa toda la ventana (como sortEm).
    if(d.tipo==='inmersivo'){document.documentElement.classList.toggle('jg-club-inm',!!d.v);return;}
    if(d.tipo==='reintentar'){sincronizar(true);return;}
    /* La partida a medias vive en la cuenta: el juego la pide al abrir y la
       manda al empezar cada ronda. Si no hay cuenta o falla, sigue la local. */
    if(d.tipo==='partida-pedir'){
      if(!partida){enviar({tipo:'partida',dato:null});return;}
      partida.leer().then(dato=>enviar({tipo:'partida',dato:dato||null}),()=>enviar({tipo:'partida',error:true}));return;
    }
    if(d.tipo==='fantasma-pedir'){mandaFantasma(String(d.categoria||''));return;}
    /* La prueba de tu propia fila (Atasco): las partidas que respaldaron tu
       récord, por si este navegador ya no las tiene (otro dispositivo,
       almacenamiento borrado). Se lee por clave, como la del fantasma. */
    if(d.tipo==='prueba-propia-pedir'){
      const cat=String(d.categoria||''),f=propios[cat],responde=r=>enviar({tipo:'prueba-propia',categoria:cat,...r});
      if(invitado||!fantasma||!categoriaClub(juego,cat)||!f||typeof f.partida!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(f.partida)){responde({d:''});return;}
      fantasma.leerPrueba(cat,usuario.uid,f.partida).then(v=>responde({d:v&&typeof v.d==='string'?v.d:''}),()=>responde({error:true}));
      return;
    }
    /* Un logro en vivo (Metro Rush: «Cazafantasmas»). Solo los que el juego
       declara así; la página lo escribe una vez en logros/ (la regla no deja
       reescribirlo) y lo celebra. Como invitado no se guarda nada. */
    if(d.tipo==='logro'){if(logro&&!invitado&&juego==='metrorush'&&d.id==='fan')logro(d.id);return;}
    if(d.tipo==='partida-guardar'){if(partida)partida.guardar(typeof d.d==='string'&&d.d.length<200000?d.d:null,d.at).catch(()=>{});return;}
    if(d.tipo==='categoria'){
      if(categoriaClub(juego,d.categoria))escuchar(d.categoria);
      else if(juego==='snake'&&d.categoria==='zen'){if(off)off();off=null;categoria='zen';}
      return;
    }
    if(d.tipo==='resultado'){
      const dato=resultadoClub(juego,d);if(!dato)return;
      if(invitado&&!guardaInvitado){estado('Buena partida. Como invitado no se guarda: inicia sesión para que tus récords entren en la clasificación.',dato.categoria);return;}
      if(invitado){
        verificaClub(juego,dato,d.prueba,{uid:cuenta}).then(async motivo=>{
          if(muerto)return;
          if(motivo){estado('Esta partida no se pudo comprobar, así que no se podrá guardar: '+motivo,dato.categoria);return;}
          await cargados;
          // La página cuenta cada partida, pero su aviso sale solo con una marca nueva del invitado.
          const mejoro=mejorClub(dato,pendientes[dato.categoria]);
          if(mejoro){pendientes[dato.categoria]={...dato,prueba:d.prueba,h:Date.now()};persistir();}
          estado('Buena partida. Como invitado todavía no se guardó: inicia sesión y tu mejor marca pasa a la clasificación.',dato.categoria);
          if(alInvitado){try{alInvitado(dato,mejoro);}catch(err){/* el aviso no debe romper la partida */}}
        });
        return;
      }
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
    /* PRO DEFENDER es una pantalla entera (mapa, tienda, menús propios): el
       iframe ocupa toda la ventana, como PRO HERO, y vuelve con su botón. */
    if(PLENO.has(juego))document.documentElement.classList.add('jg-club-pleno');
    for(const id of ['btnMusica','volMusica','btnSonido']){const el=document.getElementById(id);if(el){ocultos.push([el,el.style.display]);el.style.display='none';}}
    frame=document.createElement('iframe');frame.title=juego==='minas'?'Mina Club — Buscaminas':juego==='tetris'?'Tetris Club':juego==='sortem'?'sortEm':juego==='bbtan'?'BBTAN':juego==='sopa'?'Sopa de letras':juego==='electro'?'Electrodle':juego==='sudoku'?'Sudoku Arcade':juego==='fanal'?'FANAL':juego==='atasco'?'Atasco':juego==='aleteo'?'ALETEO':juego==='dosmil'?'2048':juego==='trigon'?'Trigon':juego==='protiles'?'PRO TILES':juego==='pokelike'?'Pokelike':juego==='metrorush'?'Metro Rush':juego==='tulones'?'Tulones':juego==='prodefender'?'PRO DEFENDER':'Snake Club';
    frame.className='jg-solo-frame';
    frame.style.height=juego==='tetris'?'880px':juego==='sortem'||juego==='bbtan'||juego==='electro'||juego==='sudoku'||juego==='fanal'||juego==='atasco'||juego==='aleteo'||juego==='dosmil'||juego==='trigon'||juego==='protiles'||juego==='pokelike'||juego==='tulones'||juego==='metrorush'?'900px':'760px';
    const tema=()=>enviar({tipo:'tema',oscuro:document.documentElement.dataset.tema==='oscuro'});
    frame.addEventListener('load',tema);
    if(juego==='sortem')frame.addEventListener('load',()=>frame.focus());
    temaObserver=new MutationObserver(tema);
    temaObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-tema']});
    frame.allow='fullscreen';frame.setAttribute('allowfullscreen','');
    window.addEventListener('message',mensaje);
    frame.src='juegos/club/'+juego+'/index.html?v=club-65&embed=1&cuenta='+encodeURIComponent(cuenta)+(invitado?'&invitado=1':'')+(!invitado&&deInvitado?'&deinvitado=1':'');
    host.appendChild(frame);
  }
  function destruir(){muerto=true;document.documentElement.classList.remove('jg-club-inm','jg-club-pleno');temaObserver?.disconnect();if(off)off();window.removeEventListener('message',mensaje);for(const [el,valor]of ocultos)el.style.display=valor;frame?.remove();host.innerHTML='';ambientar('');}
  return {montar,destruir,refresca:mandaRanking};
}
