// W9 de la etapa 0 del plan v4 (bitácora §205): ¿la tarjeta de video es una Adreno 6xx/7xx?
//
// Resumen: en KartPad (el Mario Kart Wii nativo para teléfonos) los personajes salen invisibles en las tarjetas Adreno
// de las series 600 y 700 (Galaxy S24, Moto G85, OnePlus, Honor), por cómo su controlador de Vulkan lee las matrices
// de los huesos. Chrome en Android también dibuja con Vulkan (por Dawn), así que a nosotros nos puede pasar, y en este
// PC no se puede ver. Este módulo solo lee lo que el navegador dice de la tarjeta (GPUAdapterInfo: fabricante,
// arquitectura, descripción) y dice si es de las de riesgo, para que el registro y el informe de rendimiento lo anoten.
// Las de la serie 800 no: allí KartPad lo arregló con su modo «Automatic» y no hay reportes.
//
// Uso:  import { riesgoAdreno } from './adreno.mjs';
//       riesgoAdreno(adaptador.info) → { adreno, serie, modelo, riesgo, texto }
//         adreno = es Qualcomm Adreno; serie = 6, 7, 8… (null si no se sabe); modelo = '730' (o null); riesgo = 6xx/7xx

export function riesgoAdreno(info) {
  const i = info || {};
  const fabricante = String(i.vendor || '').toLowerCase();
  const arquitectura = String(i.architecture || '').toLowerCase();     // Dawn: «adreno-6xx», «adreno-7xx», «adreno-8xx»
  const descripcion = String(i.description || '');                     // p. ej. «Adreno (TM) 730»
  const adreno = fabricante.includes('qualcomm') || /adreno/i.test(arquitectura + ' ' + descripcion);
  if (!adreno) return { adreno: false, serie: null, modelo: null, riesgo: false, texto: '' };
  // el modelo de 3 cifras de la descripción («730», «619»); si no viene, la serie de la arquitectura («7xx» → 7)
  const m = descripcion.match(/adreno[^0-9]*([0-9]{3})/i);
  const modelo = m ? m[1] : null;
  const a = arquitectura.match(/adreno-([0-9])xx/);
  const serie = modelo ? Number(modelo[0]) : a ? Number(a[1]) : null;
  const riesgo = serie === 6 || serie === 7;
  const nombre = modelo ? `Adreno ${modelo}` : serie ? `Adreno ${serie}xx` : 'Adreno';
  const texto = riesgo
    ? `${nombre}: en estas tarjetas los personajes pueden salir invisibles (lo vio KartPad, §205). Si pasa, avísanos.`
    : `${nombre}: sin riesgo conocido`;
  return { adreno: true, serie, modelo, riesgo, texto };
}
