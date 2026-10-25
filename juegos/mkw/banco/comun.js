/* Lo común a todas las páginas de prueba del banco.
   Resumen: cada página llama a `prueba(id, titulo)` y obtiene `ok(nombre, condición, detalle)` para anotar cada
   verificación. Las verificaciones se muestran en pantalla (✓ verde / ✗ rojo), en la consola con el mismo formato
   que las pruebas de BT3 ("✓ nombre — detalle", que lee Playwright), y el resumen queda en localStorage para que el
   índice del banco muestre cómo le fue a cada prueba. */
export function prueba(id, titulo) {
  const lista = document.getElementById('resultados');            // donde se pintan las verificaciones
  const resumen = document.getElementById('resumen');             // "N bien, M mal"
  let bien = 0, mal = 0;
  const guarda = () => {                                          // el índice lee esto
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

// Medir cuánto tarda algo (ms con decimales)
export const mide = async fn => { const t0 = performance.now(); const r = await fn(); return [performance.now() - t0, r]; };
