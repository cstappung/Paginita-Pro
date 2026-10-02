const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {salaInactiva,ultimaActividad}=context, INACTIVA_MS=vm.runInContext('INACTIVA_MS',context);
const H=3600e3, ahora=1_800_000_000_000;
const sala=x=>Object.assign({juego:'reversi',estado:'esperando',at:ahora-7*H,jugadores:{a:{nombre:'Ana',orden:0,at:ahora-7*H}}},x);
test('seis horas sin actividad cierran la sala',()=>{
 assert.equal(INACTIVA_MS,6*H);
 assert.equal(salaInactiva(sala(),ahora),true);
 assert.equal(salaInactiva(sala({at:ahora-5*H,jugadores:{}}),ahora),false);
});
test('el toque, una entrada o una jugada con hora la mantienen viva',()=>{
 assert.equal(salaInactiva(sala({toque:ahora-H}),ahora),false);
 assert.equal(salaInactiva(sala({jugadores:{a:{at:ahora-7*H},b:{at:ahora-H}}}),ahora),false,'alguien entró hace una hora');
 assert.equal(salaInactiva(sala({estado:'jugando',jugadas:{'0000':{t:'m',uid:'a',at:ahora-2*H}}}),ahora),false,'ajedrez: la jugada trae su hora');
 assert.equal(ultimaActividad(sala({toque:ahora-H})),ahora-H);
});
test('una sala ya cerrada, vacía o sin datos no se vuelve a cerrar',()=>{
 assert.equal(salaInactiva(sala({fin:{ganador:'',motivo:'abandono',at:ahora-8*H}}),ahora),false);
 assert.equal(salaInactiva(null,ahora),false);
 assert.equal(salaInactiva({juego:'uno'},ahora),false,'sin hora no se sabe: no se toca');
});
