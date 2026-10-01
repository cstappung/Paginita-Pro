const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const M = require('../../juegos/clue/js/motor.js');
const B = require('../../juegos/clue/js/bots.js');

/* Una sala entera sin Firebase: cada jugador tiene su marco (`red.js`
   en su propio contexto, con su secreto), y la «sala» hace de cartero:
   firma cada jugada con el uid del marco que la mandó, la añade al
   registro y reparte el registro a todos. Los mensajes van por una cola,
   como `postMessage`, para que nada se llame a sí mismo. */
const RED = fs.readFileSync(path.join(__dirname, '../../juegos/clue/js/red.js'), 'utf8');
const ORIGEN = 'http://sala.test';

function montaSala(n, semilla) {
  const js = Array.from({ length: n }, (_, i) => {
    const sem = 5000 + i * 7 + semilla, sal = 's' + i + ':' + semilla;
    return { uid: 'u' + i, nombre: 'J' + i, sem, sal, hmazo: M.compromiso(sem, sal) };
  });
  const log = [], cola = [], marcos = [];
  const entrega = () => {
    for (let g = 0; g < 200000 && cola.length; g++) cola.shift()();
  };
  for (const j of js) {
    const oyentes = [];
    const padre = {
      postMessage(msg) {
        cola.push(() => {
          if (msg.tipo === 'listo') return;
          if (msg.tipo !== 'jugar') return;
          log.push(Object.assign({}, msg.j, { k: String(log.length).padStart(4, '0'), uid: j.uid }));
          const copia = log.map(x => Object.assign({}, x));
          for (const m of marcos) cola.push(() => m.recibe({ canal: 'clue-padre', tipo: 'jugadas', lista: copia }));
        });
      }
    };
    const ctx = {
      ClueMotor: M, console, TextEncoder, setTimeout, clearTimeout, Date, JSON, Math, BigInt,
      location: { origin: ORIGEN },
      localStorage: { getItem: () => null, setItem: () => {} },
      addEventListener: (t, f) => { if (t === 'message') oyentes.push(f); },
      removeEventListener: () => {}
    };
    ctx.parent = padre;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(RED, ctx);
    const marco = {
      j, ctx,
      recibe: data => oyentes.forEach(f => f({ source: padre, origin: ORIGEN, data }))
    };
    marcos.push(marco);
  }
  return { js, log, cola, marcos, entrega, op: { semilla: semilla >>> 0, cripto: true } };
}

async function juegaSala(n, semilla) {
  const S = montaSala(n, semilla);
  const cons = await Promise.all(S.marcos.map(m => {
    const p = m.ctx.ClueRed.conectar();
    m.recibe({
      canal: 'clue-padre', tipo: 'config', yo: m.j.uid, mirando: false, semilla,
      sec: { sem: m.j.sem, sal: m.j.sal }, elenco: null,
      jugadores: S.js.map(x => ({ uid: x.uid, nombre: x.nombre, hmazo: x.hmazo }))
    });
    return p;
  }));
  const vistas = cons.map(() => null);
  cons.forEach((c, i) => c.suscribir(v => { vistas[i] = v; }));
  cons.forEach((c, i) => c.jugar({ t: 'elige', r: 'abcdef'[i] }));
  S.entrega();
  const bots = [];
  for (let paso = 0; paso < 4000; paso++) {
    S.entrega();
    const e = vistas[0] && vistas[0].est;
    if (!e) continue;
    if (e.fase === 'fin') break;
    if (e.fase !== 'jugando') continue;
    const u = e.debe[0];
    const i = Number(u.slice(1));
    const v = vistas[i];
    if (!v.priv.mano) continue;
    if (!bots[i]) bots[i] = B.crear({ uid: u, mano: v.priv.mano, jugadores: S.js.map(x => x.uid) });
    if (e.paso === 'refuta') {
      if (e.sug.espera === u) cons[i].refutar(bots[i].refuta(e.sug, e));
      continue;
    }
    if (e.paso === 'abre' || e.paso === 'veredicto') continue;   // lo hace el marco solo
    if (e.turno !== u) continue;
    bots[i].observa(e, v.priv.vistas);
    cons[i].jugar(bots[i].decide(e, v.priv.vistas));
  }
  S.entrega();
  return { S, cons, vistas };
}

test('clue en línea: tres marcos reparten, juegan, acusan, revelan y la auditoría sale limpia', async () => {
  const { S, vistas } = await juegaSala(3, 12345);
  const e = vistas[0].est;
  assert.equal(e.fase, 'fin', 'la partida termina');
  /* Las manos que abrió cada marco son disjuntas y no tocan el sobre. */
  const manos = vistas.map(v => v.priv.mano);
  assert.equal(new Set(manos.flat()).size, M.NC - 3);
  /* Todos revelaron la semilla y todos auditan lo mismo, sin problemas. */
  for (const v of vistas) {
    assert.deepEqual(v.priv.problemas, []);
    assert.equal(v.priv.sobre.length, 3);
    assert.ok(!manos.flat().some(c => v.priv.sobre.includes(c)));
  }
  assert.deepEqual(vistas[1].priv.sobre, vistas[2].priv.sobre);
  if (e.motivo === 'acierto') {
    assert.deepEqual([M.cartaS(e.solucion[0]), M.cartaA(e.solucion[1]), M.cartaL(e.solucion[2])], vistas[0].priv.sobre);
  }
  /* Cada carta que me enseñaron estaba en la mano de quien la enseñó. */
  vistas.forEach((v, i) => {
    for (const s of e.sugerencias.filter(x => x.uid === 'u' + i && x.mostro)) {
      const c = v.priv.vistas[s.k];
      assert.ok(manos[Number(s.mostro.slice(1))].includes(c), 'la carta vista es de quien la mostró');
    }
  });
  assert.ok(S.log.some(j => j.t === 'muestra'), 'hubo al menos una carta enseñada');
});

test('clue en línea: con cinco también', async () => {
  const { vistas } = await juegaSala(5, 777);
  assert.equal(vistas[0].est.fase, 'fin');
  for (const v of vistas) assert.deepEqual(v.priv.problemas, []);
});
