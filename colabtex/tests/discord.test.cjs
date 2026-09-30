const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import .*$/mg,'').replace(/\bexport\s+/g,'');
const context={};vm.createContext(context);
vm.runInContext(sin('src/juegos/discord.js')+'\n;globalThis.__D={mensajeSala,WEBHOOK_OK,mensajePodio,puestoSolo,conRecord,marcaSolo,categoriaLegible};',context);
const {mensajeSala,WEBHOOK_OK,mensajePodio,puestoSolo,conRecord,marcaSolo,categoriaLegible}=context.__D;
const base={pid:'-Nabc',juego:'uno',nombre:'UNO',lema:'Quédate sin cartas',color:'#e03a2f',icono:'🟥',
 anfitrion:'Carlos Stappung',foto:'https://lh3.googleusercontent.com/a/x',cupo:4,
 opciones:[['Versión','No Mercy']],enlace:'https://x.github.io/juegos.html#p/-Nabc',vestibulo:'https://x.github.io/juegos.html'};

test('el mensaje lleva juego, anfitrión, opciones y el botón a la sala',()=>{
 const m=JSON.parse(JSON.stringify(mensajeSala(base)));
 const e=m.embeds[0];
 assert.equal(e.title,'🟥 UNO');assert.equal(e.url,base.enlace);assert.equal(e.color,0xe03a2f);
 assert.ok(m.content.includes('Carlos Stappung')&&m.content.includes('UNO'));
 assert.deepEqual(e.fields.map(f=>f.value),['Carlos Stappung','**1** / 4','No Mercy']);
 const b=m.components[0].components;
 assert.equal(b[0].style,5);assert.equal(b[0].url,base.enlace);assert.equal(b[1].url,base.vestibulo);
 assert.deepEqual(m.allowed_mentions.parse,[]);
});
test('sin foto https no hay miniatura, y la mención solo si se configuró',()=>{
 const m=JSON.parse(JSON.stringify(mensajeSala(Object.assign({},base,{foto:'',mencion:'@here',anfitrion:'@everyone'}))));
 assert.equal(m.embeds[0].thumbnail,undefined);assert.equal(m.embeds[0].author.icon_url,undefined);
 assert.ok(m.content.startsWith('@here '));assert.deepEqual(m.allowed_mentions.parse,['everyone','roles']);
});
test('los límites de Discord se respetan',()=>{
 const m=mensajeSala(Object.assign({},base,{anfitrion:'x'.repeat(500),lema:'y'.repeat(5000)}));
 assert.ok(m.embeds[0].author.name.length<=256);assert.ok(m.embeds[0].description.length<=4096);
 for(const f of m.embeds[0].fields)assert.ok(f.value.length<=1024&&f.name.length<=256);
});
test('solo se acepta una URL de webhook de Discord',()=>{
 assert.ok(WEBHOOK_OK.test('https://discord.com/api/webhooks/123/abc_DEF-9'));
 assert.ok(WEBHOOK_OK.test('https://canary.discord.com/api/webhooks/123/abc'));
 assert.ok(!WEBHOOK_OK.test('https://evil.com/api/webhooks/123/abc'));
 assert.ok(!WEBHOOK_OK.test('https://discord.com.evil.com/api/webhooks/123/abc'));
});

const tabla=[{uid:'a',nombre:'Ana',puntos:900,tiempo:50},{uid:'b',nombre:'Beto',puntos:800,tiempo:40},
 {uid:'c',nombre:'Caro',puntos:800,tiempo:60},{uid:'d',nombre:'Dani',puntos:100,tiempo:10}];
test('el puesto sigue el orden del club: puntos, luego tiempo',()=>{
 assert.equal(puestoSolo(tabla,'a'),1);assert.equal(puestoSolo(tabla,'c'),3);assert.equal(puestoSolo(tabla,'zz'),0);
 const f=conRecord(tabla,'d',{nombre:'Dani',puntos:850,tiempo:5});
 assert.equal(puestoSolo(f,'d'),2);assert.equal(f.length,4);assert.equal(f[1].uid,'d');
});
test('el mensaje del podio: medalla, marca, subida y podio',()=>{
 const filas=conRecord(tabla,'d',{nombre:'Dani',puntos:950,tiempo:5});
 const m=JSON.parse(JSON.stringify(mensajePodio({categoria:'club-snake-arcade-grande',uid:'d',nombre:'Dani',puesto:1,antes:4,filas,desbancado:'Ana',enlace:'https://x/juegos.html#solo/snake'})));
 assert.ok(m.content.includes('NÚMERO 1'));assert.ok(m.content.includes('Snake · Arcade · tablero grande'));
 const e=m.embeds[0];assert.equal(e.color,0xf5c518);assert.ok(e.title.startsWith('🥇'));
 const v=Object.fromEntries(e.fields.map(f=>[f.name,f.value]));
 assert.equal(v['🎯 Marca'],'**950 pts**');assert.equal(v['📈 Subida'],'Venía del puesto #4');assert.equal(v['💥 Desbanca a'],'Ana');
 assert.equal(v['🏆 Podio actual'].split('\n').length,3);assert.ok(v['🏆 Podio actual'].startsWith('🥇 **Dani**'));
 assert.equal(m.components[0].components[0].url,'https://x/juegos.html#solo/snake');
});
test('fuera del podio o categoría rara, no hay mensaje; tiempos en buscaminas y sprint',()=>{
 assert.equal(mensajePodio({categoria:'club-minas-hard',uid:'a',puesto:4,filas:tabla}),null);
 assert.equal(mensajePodio({categoria:'otra',uid:'a',puesto:1,filas:tabla}),null);
 assert.equal(marcaSolo('club-minas-easy',{puntos:1,tiempo:83450}),'⏱️ 1:23.45');
 assert.equal(marcaSolo('club-tetris-sprint',{puntos:40,tiempo:61000}),'⏱️ 1:01.00');
 assert.equal(categoriaLegible('club-tetris-ultra').modalidad,'Ultra (2 min)');
 assert.equal(categoriaLegible('club-sortem-20').modalidad,'del 1 al 20');
 assert.equal(categoriaLegible('club-bbtan-rondas').club.nombre,'BBTAN');
 assert.equal(marcaSolo('club-bbtan-rondas',{puntos:42,tiempo:1}),'🟩 Ronda 42');
 assert.ok(mensajePodio({categoria:'club-sortem-10',uid:'a',nombre:'Ana',puesto:1,filas:[{uid:'a',nombre:'Ana',puntos:10,tiempo:9000}],enlace:'https://x/juegos.html#solo/sortem'}));
});
