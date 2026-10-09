/* Comunicación con la sección Juegos; no contiene credenciales ni Firebase. */
(() => {
  const embebido=window.parent!==window;
  if(embebido)document.documentElement.classList.add('club-integrado');
  const cuenta=new URLSearchParams(location.search).get('cuenta')||'local';
  // Modo invitado (el salón sin sesión): se juega igual, pero la tabla no
  // se lee ni se escribe; el panel lo dice y no ofrece «reintentar».
  const invitado=new URLSearchParams(location.search).get('invitado')==='1';
  const AVISO_INVITADO='Modo invitado: esta partida no se guarda ni entra en la clasificación. Inicia sesión en Juegos para competir.';
  let categoria='',lista,estado,propio,alPartida=null,quiere=false;
  /* El fantasma (Metro Rush, modos «Fantasma»): la mejor carrera de una tabla
     con su prueba, que pide el juego y lee la página (el juego no toca
     Firebase). Varias esperas por categoría, por si se pide dos veces. */
  const alFantasma=new Map();
  const enviar=d=>{if(embebido)parent.postMessage({canal:'club-child',...d},location.origin);};
  /* `result(dato, prueba)`: la prueba es lo que el verificador de cada juego
     necesita para rehacer la partida (docs/antitrampas.md). Si la página
     la rechaza, llega un `rechazo` y se avisa con el evento `club-rechazo`. */
  window.Club=Object.freeze({
    storageKey:key=>key+'.cuenta.'+cuenta,
    category(key){categoria=key;enviar({tipo:'categoria',categoria:key});if(lista)lista.replaceChildren();if(estado)estado.textContent=invitado?AVISO_INVITADO:key==='zen'?'Zen es libre: conserva tu récord local, sin clasificación competitiva.':'Clasificación por modalidad · cargando…';},
    result(dato,prueba){const {prueba:p0,...resto}=dato||{};enviar({tipo:'resultado',...resto,partida:crypto.randomUUID(),prueba:prueba===undefined?p0:prueba});},
    // La partida a medias, en la cuenta (solo dentro de Juegos).
    guardarPartida(texto){enviar({tipo:'partida-guardar',d:texto||null,at:Date.now()});},
    pedirPartida(cb){if(!embebido){cb(null);return;}alPartida=cb;enviar({tipo:'partida-pedir'});},
    /* `pedirFantasma(cat, cb)`: cb(dato, motivo). dato = {nombre, puntos,
       tiempo, yo, d (la prueba como texto)} o null; motivo dice por qué no
       hay: 'fuera' (no está dentro de Juegos), 'invitado', 'vacia' (nadie
       corrió aún esa tabla), 'error' o lo que diga la página. */
    pedirFantasma(cat,cb){if(!embebido){cb(null,'fuera');return;}if(invitado){cb(null,'invitado');return;}
      if(!alFantasma.has(cat))alFantasma.set(cat,[]);alFantasma.get(cat).push(cb);enviar({tipo:'fantasma-pedir',categoria:cat});},
    /* Pantalla completa en celular mientras se juega (CLAUDE.md, «Modo
       celular»): solo en pantallas táctiles de 600 px o menos, medidas en la
       ventana de arriba, porque el iframe mide lo que la página le dio. */
    celular(){const m=w=>matchMedia('(pointer:coarse)').matches&&Math.min(w.innerWidth,w.innerHeight)<=600&&w.innerHeight>w.innerWidth;try{return m(window.top);}catch(e){return m(window);}},
    /* `logro(id)`: un logro que el juego detecta en vivo (Metro Rush,
       «Cazafantasmas»). La página lo anota en la cuenta; el juego no toca Firebase. */
    logro(id){if(embebido&&!invitado&&typeof id==='string')enviar({tipo:'logro',id});},
    inmersivo(on){quiere=!!on;const v=quiere&&window.Club.celular();
      for(const el of document.querySelectorAll('.i18n-flota'))el.style.visibility=v?'hidden':'';
      if(document.documentElement.classList.contains('club-inm')===v)return v;document.documentElement.classList.toggle('club-inm',v);enviar({tipo:'inmersivo',v});return v;}
  });
  /* Girar el teléfono a horizontal sale del modo; volver a vertical lo recupera. */
  addEventListener('resize',()=>{if(quiere)window.Club.inmersivo(true);});
  document.addEventListener('DOMContentLoaded',()=>{
    const shell=document.querySelector('.site-shell,.shell');
    const volver=document.createElement('a');volver.textContent='← Volver a Juegos';volver.href='../../../juegos.html';volver.className='club-volver';
    volver.onclick=e=>{if(embebido){e.preventDefault();enviar({tipo:'volver'});}};shell.prepend(volver);
    const panel=document.createElement('section');panel.className='club-ranking';
    panel.innerHTML='<h2>Clasificación de este modo</h2><p class="club-propio"></p><ol></ol><p role="status" aria-live="polite"></p><button type="button">Reintentar sincronización</button>';
    const lateral=embebido?shell.querySelector(':is(.game-layout,.layout)>aside'):null;
    (lateral||shell).appendChild(panel);lista=panel.querySelector('ol');estado=panel.querySelector('[role=status]');propio=panel.querySelector('.club-propio');panel.querySelector('button').onclick=()=>enviar({tipo:'reintentar'});
    if(invitado){panel.classList.add('club-invitado');panel.querySelector('button').hidden=true;}
    if(!embebido){estado.textContent='Abre este juego desde Juegos para sincronizar tu clasificación con tu cuenta.';}else window.Club.category(categoria);
    if(embebido){const sonido=document.getElementById('sound-button');if(sonido)shell.querySelector('.scorebar')?.appendChild(sonido);}
    // Volumen y silencio (../../audio/volumen.js): si el juego no le dio un sitio, junto al marcador o flotando en una esquina.
    if(window.VolumenJuego&&!document.querySelector('.vj-ctl')){const barra=shell.querySelector('.scorebar');if(barra)VolumenJuego.control(barra);else{const f=document.createElement('div');f.className='club-vol-flota';document.body.appendChild(f);VolumenJuego.control(f);}}
    let alto=0;const medir=()=>{const nuevo=Math.ceil(shell.getBoundingClientRect().bottom+32);if(nuevo!==alto){alto=nuevo;enviar({tipo:'alto',alto});}};
    new ResizeObserver(medir).observe(shell);medir();
  });
  window.addEventListener('message',e=>{
    if(!embebido||e.source!==parent||e.origin!==location.origin||e.data?.canal!=='club-parent')return;
    const d=e.data;
    if(d.tipo==='tema'){document.documentElement.dataset.tema=d.oscuro?'oscuro':'claro';return;}
    if(d.tipo==='partida'){const f=alPartida;alPartida=null;if(f)f(d.error?null:d.dato||null);return;}
    if(d.tipo==='fantasma'){const l=alFantasma.get(d.categoria)||[];alFantasma.delete(d.categoria);for(const f of l)f(d.error?null:d.dato||null,d.error?'error':d.motivo||(d.dato?'':'vacia'));
      // nadie lo pidió: la página lo manda porque cambió el n.º 1 de la tabla (alguien batió el récord)
      if(!l.length&&!d.error)window.dispatchEvent(new CustomEvent('club-fantasma',{detail:{categoria:d.categoria,dato:d.dato||null,motivo:d.motivo||(d.dato?'':'vacia')}}));return;}
    if(d.tipo==='rechazo'){window.dispatchEvent(new CustomEvent('club-rechazo',{detail:{categoria:d.categoria,partida:d.partida,motivo:d.motivo}}));if(d.categoria===categoria&&estado)estado.textContent='Esta partida no se guardó: '+d.motivo;return;}
    if(d.categoria!==categoria)return;
    if(d.tipo==='estado'&&estado){estado.textContent=d.texto;return;}
    if(d.tipo!=='ranking'||!lista)return;
    lista.replaceChildren();const racha=/^club-(sopa|electro|sudoku)-racha$/.test(categoria),minas=!racha&&(categoria.startsWith('club-minas-')||categoria.startsWith('club-sortem-')||categoria.startsWith('club-sopa-')||/^club-sudoku-(facil|medio|dificil|experto)$/.test(categoria)||categoria==='club-tetris-sprint');
    const estrellas=categoria==='club-atasco-estrellas',metros=/^club-metrorush-(city)?distancia$/.test(categoria);
    const marca=f=>minas?(f.tiempo/1000).toFixed(2)+' s':racha?f.puntos+(f.puntos===1?' día':' días'):estrellas?f.puntos+' ★':metros?f.puntos+' m':f.puntos+' puntos';
    for(const f of d.filas||[]){const li=document.createElement('li');li.textContent=(f.nombre||'Jugador')+(f.yo?' (tú)':'')+' · '+marca(f);lista.appendChild(li);}
    estado.textContent=d.error?'No se pudo cargar el ranking en línea. Tu récord local se conserva.':d.filas?.length?'Cada modalidad tiene su propia clasificación.':'Todavía no hay récords. ¡Estrena esta clasificación!';
    propio.textContent=d.propio?'Tu récord en la nube: '+marca(d.propio):'';
    if(d.propio)window.dispatchEvent(new CustomEvent('club-record',{detail:{categoria, ...d.propio}}));
  });
})();
