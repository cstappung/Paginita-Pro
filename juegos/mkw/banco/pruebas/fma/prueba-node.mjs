// La prueba de FMA en Node: node banco/pruebas/fma/prueba-node.mjs [millones de casos, por defecto 5]
const crea = (await import(new URL('./fma.js', import.meta.url))).default;
const M = await crea();
const millones = Number(process.argv[2]) || 5;
M._corre(millones);
const d = i => M._dato(i), ej = M.UTF8ToString(M._ejemplo());
const linea = (c, t, x) => console.log((c ? '✓ ' : '✗ ') + t + ' — ' + x);
linea(d(1) === 0, 'double (fmadd): mismos bits que musl', `${d(0).toLocaleString()} casos, ${d(1)} distintos`);
linea(d(5) === 0, 'double: empates fabricados', `${d(4).toLocaleString()} casos, ${d(5)} distintos`);
linea(d(3) === 0, 'float (ps_madd): mismos bits que musl', `${d(2).toLocaleString()} casos, ${d(3)} distintos`);
if (ej) console.log('· primer caso distinto: ' + ej);
const ns = ms => (ms * 1e6 / 4e6).toFixed(2) + ' ns';
console.log(`· double: musl ${ns(d(6))}, rápida ${ns(d(7))} (${(d(6) / d(7)).toFixed(1)}× más rápida), sin fusionar ${ns(d(10))}`);
console.log(`· float:  musl ${ns(d(8))}, rápida ${ns(d(9))} (${(d(8) / d(9)).toFixed(1)}× más rápida)`);
