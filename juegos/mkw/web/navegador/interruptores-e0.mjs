// Los interruptores de la etapa 0 del plan v4 (bitácora §196–§205): qué valor le pasa la página al programa según la
// dirección. Todos vienen apagados (o sin efecto) si el parámetro no está; prenderlos es solo para medir o probar.
//
// Resumen: cada función recibe el valor del parámetro (o null si no está) y devuelve el modo para la función del
// programa (mkw.mjs las llama si el programa la trae). Están aquí, sin nada del juego, para probarlas en el banco
// (banco/pruebas/interruptores-e0).
//   ?piscina=0|1         W20 (§204): soltar las texturas de copia ociosas (1) o guardarlas (0); sin él, lo del programa
//   ?huesosFilas=1       W9 (§205): las matrices de los huesos leídas por filas (el camino de reserva de las Adreno)
//   ?soltarPipelines=1|2|3 W8 (§203): soltar los pipelines de las otras pistas al entrar a una (2 = y todos los sombreadores; 3 = W26, §248: solo los sombreadores de lo soltado)
//   ?techo=1             W3 (§200): la carrera sin el modelo de la pista (solo con el programa de MKW_TECHO_COMPILAR=1)
//   ?isla=0|1|2          W2 (§199): la traducida, la isla, el comprobador (solo con el de MKW_ISLA_COMPILAR=1)
//   ?sumidero=0|1|2      W1 (§196): nada, contar, deshacer (solo con el de MKW_SUMIDERO_COMPILAR=1)
//   ?fotoCuadro=N        W9 (§205): quedarse quieto en el cuadro de lógica N de la carrera (para sacar la foto)
//   ?azarFijo=1          W9 (§205): sin la sala, el azar de la carrera sale de la semilla de la ficha (no del reloj)

// null = no tocar (el programa sigue con lo suyo)
export const modoPiscina = v => (v === '0' || v === '1') ? Number(v) : null;
export const modoHuesosFilas = v => v === '1' ? 1 : 0;
export const modoSoltarPipelines = v => (v === '1' || v === '2' || v === '3') ? Number(v) : 0;   // (3 = W26, §248)
// ?techo=N (§200, §222): suma de bits, 1 = la pista, 2 = los efectos, 4 = los modelos de la máscara (?techoOp); 0-7
export const modoTecho = v => /^[0-7]$/.test(v ?? '') ? Number(v) : 0;
// ?techoOp=M (§222): qué opciones de dibujo esconde el bit 4 (bit k = opción k, 24 opciones); «0x…» o decimal
export const mascaraTecho = v => {
  if (!/^(0x[0-9a-f]{1,6}|[0-9]{1,8})$/i.test(v ?? '')) return 0;
  const n = Number(v);
  return n > 0 && n <= 0xFFFFFF ? n : 0;
};
export const modoIsla = v => [0, 1, 2].includes(Number(v)) ? Number(v) : 0;
export const modoSumidero = v => [0, 1, 2].includes(Number(v)) ? Number(v) : 0;
// el cuadro de la foto: un entero positivo, si no 0 (= sin foto)
export const cuadroFoto = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
// sin la sala, las semillas del azar de la carrera de la ficha (true) o del reloj, como siempre (false)
export const azarFijo = v => v === '1';
