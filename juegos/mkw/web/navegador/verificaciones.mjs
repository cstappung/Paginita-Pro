/* Las verificaciones ✓/✗ de la página del juego (las mismas que las páginas del banco: banco/comun.js).
   Resumen: `prueba(id, titulo)` entrega `ok(nombre, condición, detalle)`, `nota(texto)` y `fin()`. Cada verificación
   va a la consola con el formato que leen las pruebas de Playwright ("✓ nombre — detalle"), a la lista #resultados si
   la página la tiene, y el resumen a localStorage. Vive aquí, junto a la página, y no se importa de ../banco: en el
   sitio la página queda en juegos/mkw/web/navegador/ y el banco en juegos/mkw/banco/, así que «./banco/comun.js» no
   existe allá (la página no arrancaba: lo encontró el ensayo del jugar.bat, bitácora §69). */
export function prueba(id, titulo) {
  const lista = document.getElementById('resultados');            // donde se pintan las verificaciones (si hay)
  const resumen = document.getElementById('resumen');             // "N bien, M mal"
  let bien = 0, mal = 0;
  const guarda = () => {                                          // el índice del banco lee esto
    try { localStorage.setItem('banco.' + id, JSON.stringify({ titulo, bien, mal, cuando: Date.now() })); } catch (e) {}
    if (resumen) { resumen.textContent = `${bien} bien, ${mal} mal`; resumen.className = mal ? 'mal' : 'bien'; }
  };
  const ok = (nombre, condicion, detalle = '') => {
    condicion ? bien++ : mal++;
    const linea = (condicion ? '✓ ' : '✗ ') + nombre + (detalle !== '' ? ' — ' + detalle : '');
    console.log(linea);                                           // para Playwright
    if (lista) {
      const li = document.createElement('li');
      li.className = condicion ? 'bien' : 'mal';
      li.textContent = linea;
      lista.append(li);
    }
    guarda();
    return condicion;
  };
  const nota = texto => {                                         // una línea informativa (sin ✓/✗)
    console.log('· ' + texto);
    if (lista) { const li = document.createElement('li'); li.className = 'nota'; li.textContent = '· ' + texto; lista.append(li); }
  };
  const fin = () => { console.log('fin: ' + bien + ' bien, ' + mal + ' mal'); guarda(); document.body.dataset.fin = '1'; };
  guarda();
  return { ok, nota, fin };
}
