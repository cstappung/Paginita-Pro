// Arma docs/panel-records-siguiente/vista-previa.html (nombres inventados): el borrador del panel con datos de mentira, en un solo archivo (abre con file://).
const fs=require('fs'),path=require('path');
const R='C:/Users/zilon/Desktop/Gaming/MKW RETRO', S=__dirname;
const html=fs.readFileSync(R+'/terceros/Paginita-Pro/juegos.html','utf8');
const css=html.slice(html.indexOf('<style>')+7, html.indexOf('</style>'));
const sin=t=>t.replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const js=sin(fs.readFileSync(R+'/terceros/Paginita-Pro/colabtex/src/juegos/buscador.js','utf8'))+'\n'+sin(fs.readFileSync(S+'/mkw-records.js','utf8'));
// nombres inventados con el prefijo de consola (los de verdad son privados)
const CONS=['SNES','N64','GBA','GCN','DS','Wii','3DS','Wii U','SW'];const nombres=[];for(let c=0;c<79;c++){nombres[c]=[];for(let f=0;f<4;f++)nombres[c][f]=CONS[(c+f)%CONS.length]+' Pista inventada '+(c+1)+'-'+(f+1);}
// datos de mentira: 9 pilotos inventados, tiempos al azar con semilla
let s=7;const rnd=()=>((s=(s*1103515245+12345)>>>0)/4294967296);
const pil=[['yo','Piloto Uno'],['b','Ana'],['c','Beto'],['d','Carla'],['e','Diego'],['f','Elena'],['g','Fito'],['h','Gabi'],['i','Hugo']];
const raw={};const t0=1762700000000;
const pistas=[0x150,0x151,0x152,0x153,0x154,0x155,0x15c,0x15d,0x160,0x161,0x163,0x100,0x101,0x104,0x114,0x118,0x139,0x13a,0x170,0x171,0x180,0x1a2,0x1c4,0x200,0x210];
for(const cat of ['tt150','tt200','vs150','vs200']){
  const n=cat==='tt150'?pistas.length:cat==='tt200'?9:cat==='vs150'?6:2;
  for(const id of pistas.slice(0,n)){
    const base=(cat.startsWith('tt')?62000:150000)+rnd()*40000-(cat.endsWith('200')?9000:0);
    const k=id.toString(16)+'-'+cat;raw[k]={};
    for(const [u,nom] of pil) if(rnd()<0.55||(u==='yo'&&rnd()<0.6)) raw[k][u]={uid:u,nombre:nom,ms:Math.round(base+rnd()*6000),pista:id.toString(16),cat,version:1,at:t0-Math.round(rnd()*9e8)};
  }
}
const pag=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Récords MKW — vista previa</title><style>${css}
body{background:#f4f6f8;margin:0;font-family:system-ui,sans-serif}
.vp{max-width:880px;margin:0 auto;padding:16px}
.vp-aviso{font-size:12px;color:#8a97a3;margin:0 0 10px}
</style></head><body><div class="vp">
<p class="vp-aviso">Vista previa del borrador (§263) · datos de mentira · todavía no está en el sitio.</p>
<div class="jg-ranks">
 <div class="jg-rk-cats" style="--c:#e60012">
  <div class="jg-rk-fila"><span>Ver</span><div class="jg-rk-seg" role="group"><button class="on" aria-pressed="true">Récords</button><button>Sala</button></div></div>
  <div class="jg-rk-fila"><span>Tabla</span><div class="jg-rk-seg" role="group" id="vpTabla"></div></div>
  <div class="jg-rk-fila" id="vpCcFila" hidden><span>Cilindrada</span><div class="jg-rk-seg" role="group" id="vpCc"></div></div>
 </div>
 <section class="jg-rk" id="vpEscena"></section>
 <div id="vpLista"></div>
</div></div>
<script>
${js}
const RAW=${JSON.stringify(raw)}, NOMBRES=${JSON.stringify(nombres)}, UID='yo';
const tablas=tablasMkw(RAW);
const lista=crearListaMkw({uid:UID,fantasma:async()=>new Uint8Array([82,75,71,68]),
  foto:(f,t)=>'<span class="jg2-inicial" style="display:inline-grid;place-items:center;width:'+t+'px;height:'+t+'px;border-radius:50%;background:#e2e8f0;font-size:11px;font-weight:700;margin-right:6px">'+f.nombre[0]+'</span>'});
ponEstiloMkr();
lista.montar(document.getElementById('vpLista'));
lista.pistas({nombres:NOMBRES});
lista.datos(tablas);
let cat='tt150';
const M=['oro','plata','bronce'],TIT=['Campeón','Subcampeón','Tercer puesto'];
function escena(){
  const p=podioMkw(tablas[cat]||[]);
  const peana=i=>{const f=p[i];const b='<div class="jg-rk-bloque"><b>'+(i+1)+'</b></div>';
    if(!f)return '<div class="jg-rk-p jg-rk-'+M[i]+' libre"><div class="jg-rk-av"><span>?</span></div><b class="jg-rk-nom">Puesto libre</b><span class="jg-rk-tit">¿Tú?</span><div class="jg-rk-pts">&nbsp;</div>'+b+'</div>';
    return '<div class="jg-rk-p jg-rk-'+M[i]+(f.uid===UID?' yo':'')+'"><div class="jg-rk-av"><span>'+f.nombre[0]+'</span></div><b class="jg-rk-nom">'+f.nombre+(f.uid===UID?' <em>(tú)</em>':'')+'</b><span class="jg-rk-tit">'+TIT[i]+'</span><div class="jg-rk-pts"><b>'+f.oro+'</b> '+(f.oro===1?'récord':'récords')+'</div><small>'+f.plata+' 🥈 · '+f.bronce+' 🥉 · '+f.pistas+' pistas</small>'+b+'</div>';};
  const i=p.findIndex(f=>f.uid===UID);
  const tu=i===0?['♛','Llevas la corona',p[1]?p[1].nombre+' tiene '+p[1].oro+' '+(p[1].oro===1?'récord':'récords')+'; tú, '+p[0].oro+'. Que no te alcance.':'Nadie te la disputa.']
    :i>0?['⚔','Vas #'+(i+1),'Tienes '+p[i].oro+' '+(p[i].oro===1?'récord':'récords')+'; '+p[0].nombre+' tiene '+p[0].oro+'. Bate '+(p[0].oro-p[i].oro+1)+' y le quitas la corona.']
    :['⚔','Todavía no tienes un récord','Bate el tiempo de cualquier pista y entras al podio.'];
  document.getElementById('vpEscena').innerHTML='<div class="jg-rk-rayos"></div><header class="jg-rk-cab"><span>Salón de la fama</span><h2>Mario Kart Wii</h2><small>'+MKW_TABLAS[cat]+' · quién tiene más récords</small></header><div class="jg-rk-podio">'+[1,0,2].map(peana).join('')+'</div><div class="jg-rk-tu'+(i>=0&&i<3?' podio':'')+'"><i>'+tu[0]+'</i><div><b>'+tu[1]+'</b><span>'+tu[2]+'</span></div></div>';
}
function botones(){
  const enCarrera=cat.startsWith('vs');
  document.getElementById('vpTabla').innerHTML=[['tt150','Contrarreloj 150cc'],['tt200','Contrarreloj 200cc'],['vs','Carrera ▾']].map(([k,t])=>'<button data-t="'+k+'" class="'+((k===cat)||(k==='vs'&&enCarrera)?'on':'')+'">'+t+'</button>').join('');
  const cc=carrerasConDatos(tablas);
  document.getElementById('vpCcFila').style.display=enCarrera?'':'none';
  document.getElementById('vpCc').innerHTML=cc.map(k=>'<button data-t="'+k+'" class="'+(k===cat?'on':'')+'">'+MKW_CC_CORTO[k]+'</button>').join('');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;let k=b.dataset.t;if(k==='vs')k=carrerasConDatos(tablas)[0]||'vs150';cat=k;lista.tabla(k);botones();escena();});
botones();escena();
</script></body></html>`;
fs.writeFileSync(S+'/vista-previa.html',pag);
console.log('ok',(pag.length/1024|0)+' KB');
