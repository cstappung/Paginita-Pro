// node --experimental-wasm-jspi banco/pruebas/excepciones/prueba-node.mjs
const { correExcepciones } = await import(new URL('./prueba.mjs', 'file:///C:/Users/zilon/Desktop/Gaming/MKW%20RETRO/banco/pruebas/excepciones/'));
const crea = (await import('file:///C:/Users/zilon/Desktop/Gaming/MKW%20RETRO/banco/pruebas/excepciones/excepciones.js')).default;
const { r } = await correExcepciones(crea, (n, c, x = '') => console.log((c ? 'OK ' : 'MAL ') + n + (x ? ' -- ' + x : '')));
console.log('registro:', r.join(' '));
