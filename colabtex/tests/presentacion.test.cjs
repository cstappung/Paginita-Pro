const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const fuente=p=>fs.readFileSync('src/'+p,'utf8');
const tramo=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));

test('Chain Reaction: no revela el final ni los eliminados durante las ondas',()=>{
 const s=fuente('juegos/cadena.js'),html={};
 const e={fase:'fin',motivo:'reaccion',ganador:'a',turno:'',filas:2,cols:2,tab:[{u:'a',n:1}],fuera:{},caidos:{b:true},jugadores:[{uid:'a',nombre:'A'},{uid:'b',nombre:'B'}],ultima:{uid:'a',ondas:[[0]],capturadas:1}};
 const c={host:{},est:e,mostrado:[{u:'b',n:1}],malla:'2x2',uid:'b',animando:true,pendiente:-1,GRIS:'#888',esc:x=>x,set:(id,k,h)=>html[id]=h,q:()=>null,tiñe(){},nombreDe:x=>x,colorDe:()=>'',crCuenta:tab=>({orbes:tab.reduce((a,c)=>(c&&(a[c.u]=(a[c.u]||0)+c.n),a),{})})};
 vm.createContext(c);vm.runInContext(tramo(s,'  function pinta()','  async function alClic'),c);c.pinta();
 assert.ok(!JSON.stringify(html).includes('Partida terminada'));assert.ok(!html.crFase.includes('Gana'));assert.ok(!html.crMarcador.includes('jg-m-fuera'));
 c.animando=false;c.mostrado=e.tab;c.pinta();assert.match(html.crPie,/Partida terminada/);assert.match(html.crFase,/Gana/);assert.match(html.crMarcador,/jg-m-fuera/);
});

test('Revancha: espera a que el módulo termine la animación',()=>{
 const s=fuente('juegos-main.js'),el={innerHTML:''},btn={};let busy=true;
 const c={$:id=>id==='jgRevancha'?el:btn,datosFin:()=>({ganador:'a'}),state:{user:{uid:'a'}},modulo:{ocupado:()=>busy},pidiendoRevancha:false,revancha(){}};
 vm.createContext(c);vm.runInContext(s.slice(s.indexOf('function pintaRevancha(')),c);
 c.pintaRevancha({jugadores:{a:{}}},{});assert.equal(el.innerHTML,'');busy=false;c.pintaRevancha({jugadores:{a:{}}},{});assert.match(el.innerHTML,/Pedir revancha/);
});

test('Flip 7: el estado espera al giro y deja leer la carta antes de perder',()=>{
 const s=fuente('juegos/flip7.js'),timers=[],events=[];let anim;
 const rect={left:0,top:0,width:80,height:100};const el={getBoundingClientRect:()=>rect,appendChild(){}};
 const c={host:{},est:{},enVuelo:new Set([7]),vuelos:0,muerto:false,VUELO_MS:900,ANCHO:62,Element:{prototype:{animate(){}}},quieto:()=>false,$:sel=>sel.includes('Brazo')?null:el,carta:()=>({v:7}),sitioDe:()=>null,asientoDe:()=>el,paraSeisSiete(){},htmlCarta:()=>'',mira(){},suena(){},fantasma:()=>false,aQuienEspera:()=>'',document:{hidden:false,createElement:()=>({style:{},remove:()=>events.push('quita'),animate:()=>anim={}})},destapa:id=>{c.enVuelo.delete(id);events.push('destapa');},efectos:()=>events.push('pierde'),trasVuelos:()=>events.push('listo'),luego:(f,ms)=>timers.push({f,ms})};
 vm.createContext(c);vm.runInContext(tramo(s,'  function pinta()','  /* El brazo en reposo'),c);
 // Sin tocar ningún nodo: todos los metadatos conservan su valor anterior.
 assert.doesNotThrow(()=>c.pinta());c.pinta=()=>events.push('pinta');
 vm.runInContext(tramo(s,'  function lanza(','  /* Un sello sobre'),c);
 c.lanza(7,'a',[{e:'pasa',uid:'a'}]);assert.equal(c.vuelos,1);assert.deepEqual(events,[]);
 anim.onfinish();assert.deepEqual(events,[],'ni siquiera al terminar el giro debe perder inmediatamente');
 timers.find(t=>t.ms===240).f();assert.deepEqual(events,['quita','destapa','pinta','pierde','listo']);assert.equal(c.vuelos,0);assert.equal(c.enVuelo.size,0);
 // El seguro de la animación no puede anunciar la derrota dos veces.
 timers.find(t=>t.ms===1200).f();assert.equal(events.filter(x=>x==='pierde').length,1);
});
