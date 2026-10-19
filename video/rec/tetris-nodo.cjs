const TM = require(require('path').resolve(__dirname, '../..') + '/juegos/club/tetris/motor.js');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/tetris-ia.js', 'utf8');
global.window = { addEventListener() {} }; global.document = { dispatchEvent() {} }; global.KeyboardEvent = class {};
eval(src); window.TetrisMotor = TM;
const g = TM.grabadora({ cuenta: 'x', sal: 's', modo: 'maraton' }); const s = g.s;
let n = 0;
// usa el planificador real (expuesto vía closure) moviendo la pieza directo
const plan = eval('(' + src.match(/function planea[\s\S]*?\n  }\n/)[0].replace('function planea', 'function') + ')');
const evalua = eval('(' + src.match(/function evalua[\s\S]*?\n  }\n/)[0].replace('function evalua', 'function') + ')');
while (!s.fin && n < 400) {
  const o = (function () { return eval('(' + plan.toString() + ')')(s); })();
  if (!o) break;
  s.p = { ...s.p, r: o.r, x: o.x }; TM.accion(s, 'caer'); n++;
}
console.log('piezas', n, 'lineas', s.lineas, 'puntos', s.puntos, 'fin', s.fin);
