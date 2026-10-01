/* Comunicación con la sección Juegos; no contiene credenciales ni Firebase. */
(() => {
  const embebido=window.parent!==window;
  if(embebido)document.documentElement.classList.add('club-integrado');
  const cuenta=new URLSearchParams(location.search).get('cuenta')||'local';
  let categoria='',lista,estado,propio,alPartida=null;
  const enviar=d=>{if(embebido)parent.postMessage({canal:'club-child',...d},location.origin);};
  window.Club={
    storageKey:key=>key+'.cuenta.'+cuenta,
    category(key){categoria=key;enviar({tipo:'categoria',categoria:key});if(lista)lista.replaceChildren();if(estado)estado.textContent=key==='zen'?'Zen es libre: conserva tu récord local, sin clasificación competitiva.':'Clasificación por modalidad · cargando…';},
    result(dato){enviar({tipo:'resultado',...dato,partida:crypto.randomUUID()});},
    // La partida a medias, en la cuenta (solo dentro de Juegos).
    guardarPartida(texto){enviar({tipo:'partida-guardar',d:texto||null,at:Date.now()});},
    pedirPartida(cb){if(!embebido){cb(null);return;}alPartida=cb;enviar({tipo:'partida-pedir'});}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const shell=document.querySelector('.site-shell,.shell');
    const volver=document.createElement('a');volver.textContent='← Volver a Juegos';volver.href='../../../juegos.html';volver.className='club-volver';
    volver.onclick=e=>{if(embebido){e.preventDefault();enviar({tipo:'volver'});}};shell.prepend(volver);
    const panel=document.createElement('section');panel.className='club-ranking';
    panel.innerHTML='<h2>Clasificación de este modo</h2><p class="club-propio"></p><ol></ol><p role="status" aria-live="polite"></p><button type="button">Reintentar sincronización</button>';
    const lateral=embebido?shell.querySelector(':is(.game-layout,.layout)>aside'):null;
    (lateral||shell).appendChild(panel);lista=panel.querySelector('ol');estado=panel.querySelector('[role=status]');propio=panel.querySelector('.club-propio');panel.querySelector('button').onclick=()=>enviar({tipo:'reintentar'});
    if(!embebido){estado.textContent='Abre este juego desde Juegos para sincronizar tu clasificación con tu cuenta.';}else window.Club.category(categoria);
    if(embebido){const sonido=document.getElementById('sound-button');if(sonido)shell.querySelector('.scorebar')?.appendChild(sonido);}
    let alto=0;const medir=()=>{const nuevo=Math.ceil(shell.getBoundingClientRect().bottom+32);if(nuevo!==alto){alto=nuevo;enviar({tipo:'alto',alto});}};
    new ResizeObserver(medir).observe(shell);medir();
  });
  window.addEventListener('message',e=>{
    if(!embebido||e.source!==parent||e.origin!==location.origin||e.data?.canal!=='club-parent')return;
    const d=e.data;
    if(d.tipo==='tema'){document.documentElement.dataset.tema=d.oscuro?'oscuro':'claro';return;}
    if(d.tipo==='partida'){const f=alPartida;alPartida=null;if(f)f(d.error?null:d.dato||null);return;}
    if(d.categoria!==categoria)return;
    if(d.tipo==='estado'&&estado){estado.textContent=d.texto;return;}
    if(d.tipo!=='ranking'||!lista)return;
    lista.replaceChildren();const racha=categoria==='club-sopa-racha',minas=!racha&&(categoria.startsWith('club-minas-')||categoria.startsWith('club-sortem-')||categoria.startsWith('club-sopa-')||categoria==='club-tetris-sprint');
    const marca=f=>minas?(f.tiempo/1000).toFixed(2)+' s':racha?f.puntos+(f.puntos===1?' día':' días'):f.puntos+' puntos';
    for(const f of d.filas||[]){const li=document.createElement('li');li.textContent=(f.nombre||'Jugador')+(f.yo?' (tú)':'')+' · '+marca(f);lista.appendChild(li);}
    estado.textContent=d.error?'No se pudo cargar el ranking en línea. Tu récord local se conserva.':d.filas?.length?'Cada modalidad tiene su propia clasificación.':'Todavía no hay récords. ¡Estrena esta clasificación!';
    propio.textContent=d.propio?'Tu récord en la nube: '+marca(d.propio):'';
    if(d.propio)window.dispatchEvent(new CustomEvent('club-record',{detail:{categoria, ...d.propio}}));
  });
})();
