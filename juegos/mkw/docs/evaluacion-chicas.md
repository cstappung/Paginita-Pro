# La evaluación de las mejoras chicas, juntas (etapa E4c, ítem W25)

Preparada el 2026-11-05 por pedido del dueño: «prepara eso de la evaluación después de 4b, pero no lo ejecutes
todavía». **No se ejecuta hasta que el dueño lo diga.** Va después de cerrar la etapa E4b.

## Por qué existe

Durante el plan se descartaron varias mejoras que dieron **+1 a +6 %**. No se descartaron por perder. Se descartaron
porque el ruido de la medición es del mismo tamaño: en la gama baja simulada, dos corridas iguales se separan hasta
±5 %. Una mejora sola de +2 % no se puede distinguir de cero.

El dueño preguntó (2026-11-05): «si acumulas eso, ¿no sería un 30 % con 10 de esos?». La cuenta es correcta: las
mejoras se multiplican, y 1,03¹⁰ = 1,34. El problema es saber cuáles son reales.

La salida es **medirlas juntas**. Una suma de +8 % sí sobresale del ruido. Es como en el osciloscopio: una señal de
3 mV bajo 5 mV de ruido no se ve en un barrido, pero aparece al promediar muchos barridos. Juntar las mejoras agranda
la señal. Repetir la medición achica el ruido (con la raíz del número de medidas, §166).

## Qué entra al paquete

Entra lo que ya se midió **positivo o empatado en algún lado** y que **da la misma carrera** (las pruebas de igualdad).

| Pieza | Qué es | Lo medido | Dónde está hoy | § |
|---|---|---|---|---|
| **C1 · PGO** (el sello, va al final) | Compilar guiado por un perfil de una carrera de verdad (`-fprofile-instr-use`, `-hot-cold-split`). | Gama baja **+2,2 %** de mediana en 6 pares (media +5,3 %). Este PC **+3,2 %**. `.wasm` **−8,3 %**. Medido antes de H6 y M7. | `herramientas/tanda-w4.sh`, `profraw-v11.mjs`, guiones en `build/web/datos/w4/` | §198, §213 |
| **C2 · Texturas BC1** | Subir las texturas CMPR del juego como BC1, sin descomprimirlas en la CPU. Solo en las tarjetas que traen BC (los PC). | Gama baja ≈ **+6 %** de lógica y la tarjeta ≈ −4,5 %. Este PC igual. Tarjeta 15,2 → 1,9 MB. 2 vueltas. | `?texturasBc=1`, solo en `terceros/Wiicompiled/aurora-main` (falta pasarlo a la aurora del motor) | §190.2 |
| **C3 · Funciones calientes** | 3 funciones de matrices escritas a mano, con el comprobador bit a bit. | Por llamada ×1,04 a ×1,24. Por cuadro en Node ×1,010. **Nunca se midió en Chrome.** 0 diferencias. | `web/juego/caliente_nativo.cpp`, `MKW_CALIENTE_COMPILAR=1` (sin la variante SIMD, que perdía) | §181.2 |
| **C4 · Memo ×4** | El memo de las llamadas indirectas con 2048 casillas en vez de 512. | Node ×0,993 (6 pares). Sin medida en Chrome. | `terceros/Wiicompiled-motor-memo`, `parches/motor-m8-memo.diff` | §193 |
| **C5 · No releer r14–r31** | No volver a leer los registros que la llamada no tocó (modo `seguro` de M8). | Node ×1,00 / ×0,99. Lecturas −47 %. 0 avisos de la vigía. Sin medida en la gama baja. | `parches/traductor-m8.diff`, `MKW_M8=seguro` | §178 |
| **C6 · CR seguro** | Guardar del registro de condiciones solo lo que se lee, en el modo exacto. | Node ×0,9928. Exacto. | `terceros/Wiicompiled-motor-seguro` (`8812e4f`), `parches/traductor-w14.diff` | §217 |
| **C7 · `wasm-opt -O3`** | Pasar el programa final por el optimizador de Binaryen. | `.wasm` −2,4 %. CPU 8,17 vs 8,22 ms (empate). Una sola medida, de hace mucho. | se sacó; volver a ponerlo en `compilar-web.py --final` | §54 |

**Lo que no entra, y por qué:**

| Pieza | Por qué no |
|---|---|
| Hojas en línea al doble (§193) | La gama baja pierde un 6 %: el código crece y llena la caché de instrucciones. |
| FMA «punto medio» (§184) | La gama baja pierde un 7,5 %, por la misma razón. |
| VUELTA32 (§212) | La gama baja pierde un 7–10 %. |
| H11, lo frío compilado chico (§214) | La gama baja pierde un 1,4 %. C1 ya hace lo mismo con el perfil. |
| N3, el juego entero en un Worker (§208) | La gama baja pierde un 4 %. Lo reemplaza W10. |
| W12, W13 (§215, §216) | Son techos, no mejoras construidas. El techo no se distinguió del ruido. |
| W14 techo (§217) | Cambia la carrera: la sala se separa en el cuadro 270. |
| W11 (§209) | Sin W10 el juego queda sin efectos ni sonido. Va con W10. |
| W3, los techos de E4 (§200, §222) | Son techos de un dibujo propio que no se construyó. |

**Aparte, por la memoria y no por la velocidad:** W8 modo 2 (`?soltarPipelines=2`, §203). La tarjeta queda en
−140 MB en una copa de 8 pistas, en vez de +1,1 GB. A cambio, al cargar cada pista nueva se saltan un 37 % más de
dibujos. Se evalúa en el teléfono y en la sala, con su propia medida, sin mezclarlo con este paquete.

## Cómo se hace

**Paso 0. Pasar cada pieza a la base de hoy (1–3 días).** Casi todas se midieron sobre programas viejos: antes de H6
(la RAM fija), de M7 (ThinLTO) y de la aurora del motor v0.9.3. La base es la que deje E4b al cerrar (hoy
`build/web-e2w10`). Cada pieza entra con su interruptor de compilación (`MKW_CHICAS=c2,c3,…`) y pasa sola el arranque
(13/13) y el fantasma igual. Así ninguna pieza rota se esconde en el paquete.

**Paso 1. Armar el paquete y probar la igualdad entera.** Dos programas: la base y la base con C2–C7 (C1 todavía no).
- `prueba-arranque` 13/13.
- La sala con los dos programas: `prueba-sincro --directa --build-b=<base>`, huellas 75/75.
- `prueba-fantasma-igual` y `prueba-foto-igual` contra la base. La foto, con C2 apagado: C2 cambia los píxeles un
  poco (51 dB, §190.2) y tiene su propia prueba, `?texturasBc=verifica`.

Estas pruebas no se recortan nunca.

**Paso 2. Medir el paquete contra la base.** El tramo fijo (§163), la gama baja simulada con
`--chrome "--js-flags=--wasm-enforce-bounds-checks"`, N8 apagado (`&n8=0`) y este PC como control, intercalados en la
misma tanda (§166).
- 2 pares deciden si el paquete gana **≥ +8 %** o pierde **≤ −2 %**.
- En la zona gris, hasta **6 pares**.
- **La regla del paquete:** se adopta si la media de los 6 pares es positiva con su intervalo del 95 % por encima de
  cero, y este PC no pierde más de 1,5 %. Es más suave que la de una pieza sola (+8 % o 2 pares) porque todas las
  piezas son exactas: no cambian la carrera y su riesgo es solo mantenerlas.

**Paso 3. Si el paquete gana, ver qué piezas sobran (opcional).** Con ±5 % de ruido no se puede probar el aporte de
cada una. Solo se sacan de a una las que tienen un costo propio: C2 (cambia píxeles) y C5 (toca el traductor). Si el
paquete sin ella no pierde nada medible, se deja afuera.

**Paso 4. El sello: PGO encima.** El perfil depende de la forma exacta del código, por eso va al final, sobre el
paquete ya decidido.
- El perfil sale de la carrera del guion de §165, en Node con `correr-guion.mjs`.
- Se rehace solo en cada `compilar-web.py --final`, con un paso de la tanda. Así deja de ser «hay que rehacerlo a
  mano con cada cambio», que fue la razón para descartarlo.
- Se mide el paquete con PGO contra el paquete sin PGO, con la misma regla del paso 2.
- El perfil lleva nombres del juego: **nunca a git**.

**Paso 5. Documentar.** Va en la bitácora con una sección nueva, en el plan (W25) y en `RETOMAR.md`. Si algo se
adopta, el dueño sube el `.wasm` nuevo a R2.

## Cuánto puede dar (estimado, sin medir)

Si las piezas fueran todas reales y no se pisaran, la suma de lo medido daría **+8 a +12 %** en la gama baja. Lo
realista es **+3 a +8 %**. Puede salir cero: varias medidas son de Node, o de programas viejos que ya cambiaron.

Lo seguro: el `.wasm` queda **un 8–10 % más chico** (C1 y C7), y eso baja la descarga y la compilación al abrir.

Duración: **1–2 semanas**.

## La tanda

`herramientas/tanda-e4c.sh <fases>` se escribe al empezar, con el candado de siempre (`QUIEN=e4c`). Las fases:
`portar`, `compilar`, `igual`, `medir`, `sacar`, `pgo`, `medir-pgo`. Base y variantes en `build/web-e4c-*`.
