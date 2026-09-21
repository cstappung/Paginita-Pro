/* Comunicación con la sección Juegos; no contiene credenciales ni Firebase. */
(() => {
  const embebido=window.parent!==window;
  const cuenta=new URLSearchParams(location.search).get('cuenta')||'local';
  let categoria='',lista,estado,propio;
  const enviar=d=>{if(embebido)parent.postMessage({canal:'club-child',...d},location.origin);};
  window.Club={
    storageKey:key=>key+'.cuenta.'+cuenta,
    category(key){categoria=key;enviar({tipo:'categoria',categoria:key});if(lista)lista.replaceChildren();if(estado)estado.textContent=key==='zen'?'Zen es libre: conserva tu récord local, sin clasificación competitiva.':'Clasificación por modalidad · cargando…';},
    result(dato){enviar({tipo:'resultado',...dato,partida:crypto.randomUUID()});}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const shell=document.querySelector('.site-shell,.shell');
    const volver=document.createElement('a');volver.textContent='← Volver a Juegos';volver.href='../../../juegos.html';volver.className='club-volver';
    volver.onclick=e=>{if(embebido){e.preventDefault();enviar({tipo:'volver'});}};shell.prepend(volver);
    const panel=document.createElement('section');panel.className='club-ranking';
    panel.innerHTML='<h2>Clasificación de este modo</h2><p class="club-propio"></p><ol></ol><p role="status" aria-live="polite"></p><button type="button">Reintentar sincronización</button>';
    shell.appendChild(panel);lista=panel.querySelector('ol');estado=panel.querySelector('[role=status]');propio=panel.querySelector('.club-propio');panel.querySelector('button').onclick=()=>enviar({tipo:'reintentar'});
    if(!embebido){estado.textContent='Abre este juego desde Juegos para sincronizar tu clasificación con tu cuenta.';}else window.Club.category(categoria);
    let alto=0;const medir=()=>{const nuevo=Math.ceil(shell.getBoundingClientRect().bottom+32);if(nuevo!==alto){alto=nuevo;enviar({tipo:'alto',alto});}};
    new ResizeObserver(medir).observe(shell);medir();
  });
  window.addEventListener('message',e=>{
    if(!embebido||e.source!==parent||e.origin!==location.origin||e.data?.canal!=='club-parent'||e.data.categoria!==categoria)return;
    const d=e.data;if(d.tipo==='estado'&&estado){estado.textContent=d.texto;return;}
    if(d.tipo!=='ranking'||!lista)return;
    lista.replaceChildren();const minas=categoria.startsWith('club-minas-');
    for(const f of d.filas||[]){const li=document.createElement('li');li.textContent=(f.nombre||'Jugador')+(f.yo?' (tú)':'')+' · '+(minas?(f.tiempo/1000).toFixed(2)+' s':f.puntos+' puntos');lista.appendChild(li);}
    estado.textContent=d.error?'No se pudo cargar el ranking en línea. Tu récord local se conserva.':d.filas?.length?'Cada modalidad tiene su propia clasificación.':'Todavía no hay récords. ¡Estrena esta clasificación!';
    propio.textContent=d.propio?'Tu récord en la nube: '+(minas?(d.propio.tiempo/1000).toFixed(2)+' s':d.propio.puntos+' puntos'):'';
    if(d.propio)window.dispatchEvent(new CustomEvent('club-record',{detail:{categoria, ...d.propio}}));
  });
})();
