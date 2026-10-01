const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir,ajLegales,ajAplica,meToca,progreso}=context;

/* FEN → la posición del motor (solo para las pruebas). */
function fen(s){
 const [filas,color,enroque,ep,medio,n]=s.split(' ');
 const tab=[];for(const ch of filas.replace(/\//g,''))if(/\d/.test(ch))for(let k=0;k<+ch;k++)tab.push('.');else tab.push(ch);
 const alPaso=ep&&ep!=='-'?'abcdefgh'.indexOf(ep[0])+(8-+ep[1])*8:-1;
 return {tab,color,enroque:enroque==='-'?'':enroque,alPaso,medio:+(medio||0),n:+(n||1)};
}
function perft(pos,d){if(!d)return 1;const l=ajLegales(pos);if(d===1)return l.length;let n=0;for(const m of l)n+=perft(ajAplica(pos,m),d-1);return n;}

test('perft: el generador coincide con las cifras de referencia',()=>{
 const casos=[
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',[20,400,8902,197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039,97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812,43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486,62379]]
 ];
 for(const [f,ns] of casos)ns.forEach((n,i)=>assert.equal(perft(fen(f),i+1),n,f+' d'+(i+1)));
});

const sala=(extra={})=>({juego:'ajedrez',semilla:2,estado:'jugando',anfitrion:'a',jugadores:{a:{nombre:'Ana',orden:0},b:{nombre:'Beto',orden:1}},jugadas:{},...extra});
const juega=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p);};
/* Jugadas en algebraica pura: "e2e4", "e7e8q". Alterna el autor según el turno. */
function partida(p,lista){let e=reducir(p);for(const s of lista)e=juega(p,{t:'m',uid:e.turno,de:s.slice(0,2),a:s.slice(2,4),...(s[4]?{pr:s[4]}:{})});return e;}

test('bandos: el anfitrión elige o decide la semilla',()=>{
 assert.equal(reducir(sala({semilla:2})).blancas,'a');
 assert.equal(reducir(sala({semilla:3})).blancas,'b');
 assert.equal(reducir(sala({semilla:3,color:'blancas'})).blancas,'a');
 assert.equal(reducir(sala({semilla:2,color:'negras'})).blancas,'b');
 const p=sala();delete p.jugadores.b;assert.equal(reducir(p).fase,'espera');
});

test('mate del pastor, con la notación en español',()=>{
 const p=sala(),e=partida(p,['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7']);
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');assert.equal(e.motivo,'mate');
 assert.deepEqual(JSON.parse(JSON.stringify(e.movs.map(m=>m.san))),['e4','e5','Ac4','Cc6','Dh5','Cf6','Dxf7#']);
 assert.equal(meToca(e,'b'),false);assert.equal(e.legales.length,0);
});

test('una jugada ilegal o fuera de turno no existe',()=>{
 const p=sala();let e=reducir(p);
 e=juega(p,{t:'m',uid:'b',de:'e7',a:'e5'});assert.equal(e.movs.length,0);
 e=juega(p,{t:'m',uid:'a',de:'e2',a:'e5'});assert.equal(e.movs.length,0);
 e=juega(p,{t:'m',uid:'a',de:'f1',a:'c4'});assert.equal(e.movs.length,0);
 e=juega(p,{t:'m',uid:'a',de:'e2',a:'e4'});assert.equal(e.movs.length,1);assert.equal(e.turno,'b');
 assert.ok(meToca(e,'b'));assert.ok(!meToca(e,'a'));
});

test('enroque, al paso y coronación',()=>{
 let e=partida(sala(),['e2e4','a7a6','g1f3','a6a5','f1e2','a5a4','e1g1']);
 assert.equal(e.movs.at(-1).san,'O-O');assert.equal(e.tab[62],'K');assert.equal(e.tab[61],'R');
 e=partida(sala(),['e2e4','a7a6','e4e5','d7d5','e5d6']);
 assert.equal(e.movs.at(-1).san,'exd6');assert.ok(e.movs.at(-1).ep);assert.equal(e.tab[27],'.');
 e=partida(sala(),['h2h4','g7g5','h4g5','h7h6','g5h6','a7a6','h6h7','a6a5','h7g8n']);
 assert.equal(e.movs.at(-1).san,'hxg8=C');assert.equal(e.tab[6],'N');
 const p=sala();partida(p,['a2a4','b7b5','a4b5','a7a6','b5a6','c8b7','a6b7','e7e6']);
 e=juega(p,{t:'m',uid:'a',de:'b7',a:'a8'});assert.equal(e.movs.length,8,'coronar sin elegir pieza no vale');
 e=juega(p,{t:'m',uid:'a',de:'b7',a:'a8',pr:'q'});assert.equal(e.tab[0],'Q');
});

test('tablas: ahogado, repetición, acuerdo; y rendirse',()=>{
 /* Ahogado clásico (Sam Loyd, 10 jugadas). */
 let e=partida(sala(),['e2e3','a7a5','d1h5','a8a6','h5a5','h7h5','h2h4','a6h6','a5c7','f7f6','c7d7','e8f7','d7b7','d8d3','b7b8','d3h7','b8c8','f7g6','c8e6']);
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'');assert.equal(e.motivo,'ahogado');
 e=partida(sala(),['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']);
 assert.equal(e.motivo,'repeticion');
 const p=sala();partida(p,['e2e4']);
 e=juega(p,{t:'tablas',uid:'a'});assert.equal(e.oferta,'a');
 e=juega(p,{t:'acepta',uid:'a'});assert.equal(e.fase,'jugando','no se acepta la propia oferta');
 e=juega(p,{t:'rechaza',uid:'b'});assert.equal(e.oferta,'');
 e=juega(p,{t:'tablas',uid:'a'});assert.equal(e.oferta,'','una oferta por jugada');
 e=juega(p,{t:'tablas',uid:'b'});e=juega(p,{t:'acepta',uid:'a'});
 assert.equal(e.fase,'fin');assert.equal(e.motivo,'acuerdo');assert.equal(e.ganador,'');
 const q=sala();partida(q,['e2e4']);e=juega(q,{t:'rinde',uid:'b'});
 assert.equal(e.ganador,'a');assert.equal(e.motivo,'rendicion');
 const r=sala();partida(r,['e2e4']);e=juega(r,{t:'tablas',uid:'b'});e=partida(r,['e7e5']);
 assert.equal(e.oferta,'b','mover no retira la propia oferta');e=partida(r,['d2d4']);assert.equal(e.oferta,'','mover la rechaza');
});

test('material insuficiente, progreso y votación',()=>{
 assert.ok(context.ajInsuficiente(fen('8/8/8/4k3/8/8/2B5/4K3 w - - 0 1').tab));
 assert.ok(!context.ajInsuficiente(fen('8/8/8/4k3/8/8/2R5/4K3 w - - 0 1').tab));
 assert.ok(context.ajInsuficiente(fen('8/8/2b5/4k3/8/8/2B5/4K3 w - - 0 1').tab));
 const p=sala();let e=partida(p,['e2e4','d7d5','e4d5']);
 assert.ok(progreso(e,'ajedrez')>0);assert.equal(e.perdidas.b.join(),'P');
 e=juega(p,{t:'voto',uid:'a',contra:'b'});assert.equal(e.ganador,'a');assert.equal(e.motivo,'abandono');
});
