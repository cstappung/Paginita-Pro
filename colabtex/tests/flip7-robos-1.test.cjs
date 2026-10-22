/* Flip 7: el fuzz de robos, semillas 1 a 30 (las demás en flip7-robos-2.test.cjs; partido para que
   `node --test` lo corra en paralelo). */
const {test}=require('node:test');
const {fuzzRobos}=require('./flip7-comun.cjs');

test('fuzz: robos con suplentes, ruido, abandonos y un jugador dormido (1/2)',()=>fuzzRobos(1,30));
