# Soluciones de arquitectura: más núcleos y menos trabajo por cuadro

*Escrito el 2026-10-31. No se compiló, no se midió ni se corrió el juego para esto. Hay dos fuentes:*
- *la bitácora y `docs/techo-pasos.md`;*
- *el perfil de Chrome de la carrera que ya estaba guardado (§160: VS de 12, CPU en máximo, este PC, 26 s,
  `build/web/datos/medir-sitio/n13-carrera-pc-v1.cpuprofile`), **reagrupado aquí por partes del cuadro** (calcular /
  dibujar / presentar).*

*Cada número dice **[medido §N]**, **[medido, reagrupado del perfil de §160]** o **[estimado]** con lo que lo sostiene.
Este documento ve **la forma**: usar más núcleos y que el juego haga menos. **Lo que cuesta el código traducido** (dar
vuelta los bytes, las banderas, las llamadas indirectas) lo estudia otro trabajo y aquí no se repite.*

## La respuesta en seis líneas

1. **El dibujo del juego es un «sumidero»: la carrera nunca lee lo que el dibujo escribe.** R2 lo demostró: saltando la
   mitad o dos tercios de los dibujos, las huellas dan 75/75 y el fantasma sale igual byte por byte [medido §192]. Por eso
   el dibujo **entero**, también el código del juego que recorre la escena, puede ir a **otro núcleo, un cuadro atrás**.
   La carrera no cambia.
2. Hoy, por cuadro y en este PC, la carrera (calcular) es **~4,2 ms**. El dibujo del juego, con aurora adentro, es
   **~2,8 ms**, y presentar ~0,95 ms. El resto del hilo (sonido, Chrome, la página) es ~3,2 ms [medido, reagrupado].
3. **«El dibujo en otro núcleo» (A1)** saca del hilo del juego ~4,5–5 ms de 11. El hilo baja a **~6,2 ms (×1,5–1,9)**
   [estimado]. Es más que todo el paso 9 del plan (×1,15–1,30), porque además del trabajo de aurora se lleva **el código
   del juego que dibuja**. Dolphin no puede hacer eso: imita un solo procesador.
4. Con lo que solo se ve de la parte de calcular (efectos, sonido) también afuera, el hilo baja a **~5,2 ms (×2,1)**
   [estimado]. Ahí aparece el piso: **la carrera pura, ~3,4 ms en este PC**, que solo se reparte con mucho costo.
5. **Por escalón** (el hilo del juego, con S de `techo-pasos.md`), juntando esto con una mejora moderada del código
   traducido (otro trabajo):
   - **la gama media llega a ~22–25 ms**, o sea 40–45 cuadros de carrera por segundo. Si S real es ~4,2 y no 5,4 (lo
     sugieren los puntajes públicos de un solo núcleo), queda en ~17 ms: **justo en 60**;
   - **la gama baja queda en ~34–39 ms (~27 por segundo)**. **No llega a 60 de carrera con ninguna arquitectura que corra
     en la página**, salvo repartir la carrera misma entre núcleos (A6, meses y riesgo alto). Su camino honesto sigue
     siendo N11 en la sala.
6. **Los tres primeros que probar:**
   - **M0**: medir cuántas páginas de memoria escribe la carrera y cuántas lee el dibujo en cada cuadro, y la prueba del
     sumidero en varias pistas. Es una semana y decide todo lo demás.
   - **A1** en la versión sin memoria compartida, sobre el arnés del Worker que ya existe (§186).
   - **Las pruebas de «saltar» (como R2) de lo que solo se ve de la parte de calcular**: efectos, sonido y la interfaz.
     Son días.

---

## 0. Qué hay hoy en un cuadro, por partes

### Una comparación para todo el documento

Hoy el hilo del juego es **un solo operario con tres tareas en serie**: calcular la carrera, armar el dibujo y
presentarlo. Es como una línea de montaje con una sola persona: el cuadro dura la suma de las tres.

**Hacer un «pipeline» (una tubería)** es poner dos operarios con un depósito en el medio. Uno calcula el cuadro N+1
mientras el otro dibuja el N. El cuadro dura **la etapa más lenta**, no la suma.

En electricidad es pasar de dos resistencias **en serie** (se suman) a dos **en paralelo con una carga cada una**: cada
rama lleva lo suyo, y el que manda es el más cargado. El precio es un cuadro más de demora entre el botón y la imagen
(16,7 ms), como un filtro que retrasa la señal.

### El cuadro, reagrupado del perfil de §160

El perfil se tomó a 60 fps con el hilo principal ocupado 680 ms de cada segundo (~11,3 ms por cuadro). Se escaló a los
**11,1 ms** de §166.5, el número con el que trabaja `techo-pasos.md`. Las partes salen de sumar el tiempo bajo cada rama
del bucle principal del juego [medido, reagrupado]:

| Parte | Qué es | % del hilo ocupado | ms por cuadro (este PC) |
|---|---|---|---|
| **Calcular** | Todo el «paso de lógica» de la escena | 37,4 % | **4,15** |
| … la carrera: karts | La física, las ruedas, los choques con la pista, el kart de cada uno | 16,9 % | 1,88 |
| … de eso, la física del kart | — | 7,7 % | 0,86 |
| … de eso, las consultas de choques con la pista (KCL) | Todas juntas | ~2–3 % | ~0,3 |
| … de eso, la IA de las CPU | — | ~2 % | ~0,23 |
| … objetos, ítems, el reloj de la carrera | — | ~2 % | ~0,25 |
| … **la escena: matrices de los modelos** | La posición en el mundo y respecto de la cámara de cada modelo y cada hueso | 8,2 % | 0,91 |
| … **los efectos (partículas): calcularlos** | — | 3,1 % | 0,35 |
| … el sonido: decidir qué suena | — | 1,9 % | 0,21 |
| … las cámaras | — | 1,6 % | 0,18 |
| … la interfaz 2D: actualizarla | — | 1,4 % | 0,16 |
| … otros (fundidos, mandos) | — | 1,6 % | 0,17 |
| **Dibujar** | Recorrer la escena y mandar los comandos de dibujo | 25,2 % | **2,80** |
| … los modelos 3D (pista, karts, objetos, efectos) | — | 21,0 % | 2,33 |
| … el 2D (marcador, mapa) | — | 3,0 % | 0,34 |
| … la parte que la carrera sí lee (las marcas de los modelos, R2 la conserva) | — | 0,5 % | 0,05 |
| … de todo el dibujo: **aurora** (traducir los comandos de la Wii a WebGPU) | — | 43 % del dibujo | 1,21 |
| … de todo el dibujo: **el código traducido del juego** + su memoria y despacho | — | 57 % del dibujo | 1,59 |
| **Presentar** | Copiar la imagen al búfer de salida, el fin de cuadro de aurora, la espera del retrazado | 8,6 % | 0,95 |
| **El hilo de sonido del juego** | Mezclar las voces, en otro hilo de la Wii | 5,2 % | 0,57 |
| **`(program)` de Chrome** | JSPI, el recolector, Dawn, el compositor, Blink: lo que el perfil no nombra | 21,5 % | 2,39 |
| La página (JavaScript) | — | ~2 % | ~0,2 |
| **Total** | — | — | **~11,1** |

**Tres sorpresas de esta tabla:**

1. **La parte que la carrera lee del dibujo es diminuta**: el 0,5 % (0,05 ms). Es lo que R2 ya conserva en los cuadros
   saltados [medido §192]. Todo lo demás del dibujo, ~2,75 ms, es sumidero.
2. **«Calcular» trae ~0,7 ms de cosas que probablemente solo se ven**: calcular los efectos, decidir los sonidos, animar
   la interfaz. Hay que probarlo una por una (ver A2).
3. **Las matrices de la escena (0,91 ms) están en «calcular»** y la carrera sí las lee. §62 encontró a la IA leyendo la
   matriz del modelo de un kart. Se quedan en el hilo de la carrera. Se pueden repartir entre núcleos, pero no sacar
   (ver A5).

**Advertencia:** el perfil es por muestras. Las porciones de menos del 1 % tienen ±30 % de error. El `(program)` de 2,4 ms
es el número menos firme: no se sabe qué parte se va con el dibujo y qué parte se queda.

---

## 1. Dibujar en otro núcleo mientras se calcula el cuadro siguiente

### Qué lee el dibujo

En la Wii, el dibujo del cuadro N lee:
- las matrices de cada modelo y de cada hueso, que ya calculó la parte de calcular del cuadro N;
- los materiales y sus animaciones (el cuadro de la animación de las texturas);
- las partículas vivas de cada emisor;
- las cajas del 2D;
- las luces y la niebla;
- **los recursos fijos**: los modelos, las texturas y las listas de dibujo ya armadas que trae cada archivo de la pista.

Los recursos fijos son la mayor parte de los bytes y **no cambian en la carrera**. Lo que cambia por cuadro es el estado
de la escena, que vive repartido en los montones de memoria del juego.

### Las tres formas de darle al dibujo una foto del cuadro N

**(a) Copiar solo lo que el dibujo lee.** Habría que saber, objeto por objeto, qué lee el dibujo: cientos de clases y,
encima, lo que Retro Rewind cambia. **No**: es reescribir media biblioteca de dibujo para saber qué copiar.

**(b) La foto por páginas, con la tabla de páginas del runtime.** Esta es la buena. El runtime ya pasa cada acceso a la
memoria de la Wii por una tabla de páginas (1,1 millones de accesos por cuadro [medido §152]). Para las escrituras ya
tiene una **tabla aparte y una trampa por página de 4 KiB**: la usa para cuidar el código de la Wii, y la primera
escritura en una página vigilada va al camino lento. Con esa misma trampa se puede **marcar qué páginas escribió la
carrera en el cuadro**: las «páginas sucias». Es como un medidor de consumo por circuito: no mira cada electrón, solo
anota qué circuitos se usaron.

Al terminar de calcular el cuadro N, las páginas sucias se mandan al operario del dibujo, que las pega en **su** copia de
la memoria y dibuja. Lo que nunca se ensucia (los recursos fijos) ya lo tiene desde la carga: también le llegó como
páginas sucias mientras se leía el disco.

**(c) Dibujar un cuadro atrás.** No es una forma aparte: (b) ya lo hace. El operario del dibujo trabaja sobre el cuadro N
mientras la carrera calcula el N+1. La imagen sale un cuadro más tarde.

### Dos versiones de (b)

**A1-s, sin memoria compartida: dos copias del juego.** Hay dos instancias del mismo programa en dos Workers:
- la **A** corre la carrera;
- la **B** solo dibuja y presenta. Es dueña de WebGPU y del lienzo (OffscreenCanvas).

Al final de cada cuadro, A junta sus páginas sucias en una caja y la **transfiere** (se mueve, no se copia) por la
«cinta de cajas» de §188. B la pega en su memoria y llama a la misma función de dibujo de la escena que hoy llama el
bucle del juego. En A esa llamada se reemplaza por «mandar la caja» más la parte chica que la carrera lee (la de R2).

Lo que ya está probado para esto:
- el juego entero corre en un Worker con WebGPU sobre OffscreenCanvas, con la huella igual [medido §186];
- una caja de 1 MB va y vuelve en ~0,03 ms [medido §188];
- la cinta da exactamente la misma suma de control que en serie [medido §188].

**Funciona en cualquier Chrome, también en Android de hoy, sin Document-Isolation-Policy.**

Lo que cuesta:
- **Memoria.** Una segunda instancia son +250–400 MB [estimado: 88 MB de la Wii más el runtime y aurora]. En un teléfono
  de 4 GB es un riesgo real.
- **Copiar las páginas sucias.** No se sabe cuántas son; es lo primero que hay que medir (M0). Si son 0,5–2 MB por cuadro,
  copiar de un lado y pegar del otro cuesta ~0,1–0,4 ms en este PC [estimado a ~5–10 GB/s de copia].
- **Lo que no es memoria de la Wii y el dibujo usa.** Por ejemplo:
  - los avisos de «esta textura cambió», que hoy recibe aurora cuando el juego vacía la caché de datos (se ven en el
    perfil);
  - la hora de la carrera;
  - el estado propio de las imitaciones del sistema que lee el dibujo.

  Todo eso viaja en la caja.

**A1-h, con memoria compartida: un hilo dentro del mismo programa.** B es un hilo del mismo wasm y comparte la memoria de
la Wii: las páginas que nadie ensucia no se copian. Lo que B escribe va siempre a páginas propias (escribir y copiar en
la primera escritura). Gasta menos memoria y copia menos.

Pero necesita varias cosas:
- **SharedArrayBuffer**. Con Document-Isolation-Policy (§187) la página lo tiene en el escritorio; en Android, desde
  Chrome 146 según blink-dev, sin confirmar aquí.
- **Un programa armado con hilos**, que todavía no enlaza [§189].
- **Un runtime sin estado global compartido entre los dos hilos**: el estado del GX imitado, los memos de las
  indirectas.

**Es el destino; A1-s es el camino para llegar hoy.**

### Por qué no se separa la carrera

1. **A nunca lee nada de B.** La carrera corre igual que hoy, menos la llamada al dibujo, que R2 ya probó que se puede
   sacar [medido §192].
2. **Lo que B escribe no vuelve a A.** En A1-s está en otra memoria; en A1-h, en páginas propias.
3. **Si B mira una foto un poco mal**, por ejemplo una página que faltó en la caja, **se ve mal un cuadro**. Pero no
   cambia ninguna huella ni ningún fantasma. Es como un voltímetro mal conectado: marca mal, pero no cambia el circuito.

### Cuánto da

Cuentas sobre la tabla de §0 [todo estimado]:

| | ms por cuadro, este PC |
|---|---|
| Hoy | 11,1 |
| − dibujar (2,80, menos la parte de R2 que se queda) | −2,75 |
| − presentar | −0,95 |
| − la parte de `(program)` que va con WebGPU, el lienzo y el compositor (de 2,39 se suponen 0,8–1,6 restantes en A) | −0,8 a −1,6 |
| − la página (el juego ya no está en su hilo, paso 8) | −0,1 |
| + juntar y mandar las páginas sucias (0,2–0,8) | +0,2 a +0,8 |
| **Hilo de la carrera (A)** | **5,8–7,2 → central 6,2 (×1,5–1,9; central ×1,8)** |
| Hilo del dibujo (B): dibujar + presentar + su `(program)` + pegar las páginas | ~4,5–5,5 |

**Esto no se suma a los pasos 8–9 del plan: los contiene.** El paso 8 (el juego en un Worker) es la base de A1-s, y el
paso 9 (aurora en su hilo, ×1,15–1,30) queda adentro de A1: B se lleva aurora **y también** el código del juego que
dibuja. Esa segunda parte (~1,6 ms) es lo que A1 agrega sobre el plan.

**¿Se puede con hilos de wasm?** A1-h sí, con SharedArrayBuffer. A1-s no necesita hilos de wasm: son dos Workers que se
pasan cajas.

### La comparación con el «Dual Core» de Dolphin

Dolphin parte su trabajo en el mismo lugar que el paso 9: un hilo imita el procesador de la Wii y otro imita la tarjeta
leyendo la FIFO. El código del juego que dibuja corre en el procesador de la Wii, así que **se queda en el primer hilo**.
Dolphin no lo puede mover porque no sabe qué parte del programa es dibujo.

Nosotros sí: tenemos el programa traducido, función por función, y una prueba (R2) de que esa parte es sumidero. **A1 es
«Dual Core» cortado más arriba.**

En Dolphin el «Dual Core» es rápido pero inestable, porque los dos hilos se pisan los tiempos (el juego le pregunta cosas
a la tarjeta). En la versión 2509 lo dejaron apagado por omisión en el escritorio
([informe 2509](https://dolphin-emu.org/blog/2025/09/16/dolphin-progress-report-release-2509/)). A nosotros eso no nos
toca: nuestras respuestas de la tarjeta son inventadas por aurora y salen igual en todos los aparatos [§115, §192].

---

## 2. Repartir el dibujo mismo entre varios núcleos

Una vez que el dibujo está en B, ¿se puede repartir B entre 2–4 núcleos?

- **El recorrido de la escena** (2,33 ms con aurora) va modelo por modelo, en orden, escribiendo en **un solo** estado del
  GX: el material cargado, las matrices cargadas. Para repartirlo, cada núcleo tendría que recorrer su tajada de modelos
  con su propio estado del GX y su propio búfer de comandos, y después juntar los búferes en el orden original. Es lo que
  hacen los motores modernos con un búfer de comandos por hilo.
- **Aquí el problema es el estado global del GX.** La biblioteca de dibujo del juego recuerda «el último material
  cargado» y se saltea lo repetido. Eso hay que reconstruirlo al principio de cada tajada.

  Es posible, porque es sumidero: un error se ve, no separa la carrera. Pero **cuesta 4–8 semanas** y gana solo donde B
  es el cuello. Con A1 + N8, B tiene **dos cuadros** (33,3 ms) por imagen.
- **Las partículas y el 2D** son ~0,6 ms del dibujo: chico.

**Veredicto:** después de A1 y N8, y solo si en la gama baja B no entra en 33 ms (ver §7). Necesita SharedArrayBuffer.

---

## 3. Repartir partes de la carrera sin cambiar el resultado

La carrera es una sola fila de decisiones (la Wii tenía un procesador). Repartir **en orden distinto** cualquier cosa que
escriba estado compartido separa la sala y los fantasmas. Lo que se puede:

- **Las matrices de la escena** (0,91 ms). Cada modelo calcula las suyas desde las de su padre. Son cuentas
  independientes entre ramas del árbol y **cada cuenta da los mismos bits en cualquier núcleo**: el mismo código con los
  mismos datos, sin fast-math (M11). Repartidas en 4 núcleos con un punto de reunión al final ganan ~0,4–0,6 ms
  [estimado].

  Hay que probar con el vigía que ninguna rama escribe en la de otra. Necesita SharedArrayBuffer y el runtime sin estado
  global.
- **Las consultas de choques con la pista** (~0,3 ms). Leen la pista, que es fija, pero **anotan sus resultados en una
  lista común en el orden en que se piden**. Se podrían precalcular en paralelo y anotarlas después en el mismo orden,
  pero eso es escribir una versión propia, exacta al bit, de la consulta: N7.

  Gana ≤0,2 ms con mucho trabajo. **No.**
- **El kart de cada uno** (1,88 ms). Cada kart lee a los demás y escribe estado común: el azar, los ítems, los objetos de
  la pista, la lista de choques.

  La única forma de repartir los 12 es **especular**: correrlos a la vez, anotar qué leyó y escribió cada uno, y aceptar
  los resultados en el orden de siempre, repitiendo en serie el kart que leyó algo que otro anterior cambió. Eso pide
  anotar **cada** acceso a la memoria de los karts, que hoy son la mayor parte del millón por cuadro. Anotar duplica el
  costo de cada acceso, y los choques entre karts son seguidos en una carrera de 12.

  Ganancia estimada ×1,0–1,4 sobre esos 1,9 ms. Costo: meses. Riesgo: muy alto. **Solo como último recurso para la gama
  baja (A6).**
- **La IA de las CPU** (~0,23 ms). Es chica, y lee a todos.

**Lo que da la sección:** ~0,4–0,6 ms de 3,4 ms de carrera pura (×1,1–1,2 sobre el piso), casi todo de las matrices.

---

## 4. Hacer menos trabajo con la misma imagen

### (a) «Grabar y repetir» lo que se dibuja de lo fijo

La idea: el juego manda cada cuadro casi los mismos comandos de dibujo para la pista. Se graban una vez y se repiten
cambiando solo las matrices de la cámara.

**Mucho de esto ya existe:**
- los modelos de la Wii ya vienen como listas de dibujo armadas;
- aurora ya guarda cada lista ya leída (por huella) y no la vuelve a leer;
- G3/H12 ya no vuelven a subir los vértices que no cambiaron [medido §181].

**Lo que queda por grabar** es el trabajo del juego **alrededor** de cada lista: cargar el material, cargar las matrices,
preparar las texturas. Cargar materiales solo ya es el ~3 % del hilo; es lo más pesado del recorrido del 3D.

Para repetir sin correr el código del juego hay que asegurarse de que el juego iba a mandar lo mismo. La huella de las
entradas de ese modelo (cuadro de la animación, visibilidad, matrices, luces, niebla) tiene que ser igual a la del cuadro
anterior. Y hay que repetir también **lo que el código del juego escribía en su memoria** al dibujar, porque el modelo
siguiente puede leerlo.

Como es sumidero, un error se ve y no separa nada. Además puede haber un modo «verifica»: correr las dos cosas y
comparar los comandos, como `?anillo=verifica`.

- **Gana:** 30–50 % del dibujo del 3D (~0,7–1,2 ms) [estimado; depende de cuánto del 3D es pista quieta]. Ataca a B si A1
  está hecho, al hilo del juego si no.
- **Costo:** 3–5 semanas. **Riesgo:** medio (se ve, no separa). **No necesita SharedArrayBuffer.**

### (b) Recortar lo que no se ve

Ya está hecho donde importaba. G1 recorta el dibujo en la sala y llega al techo: −0,7 ms [medido §179.1]. Jugando solo,
el juego ya recorta con su cámara.

El recorte por oclusión (no dibujar lo tapado) necesitaría preguntarle a la tarjeta, que no frena (§164), o calcularlo
en la CPU, que es justo lo que falta. **No.**

### (c) Los modelos lejanos del juego

El juego ya usa los suyos donde los trae; no hay más que sacar sin cambiar la imagen. **No.**

### (d) Simular a 60, dibujar 30 y mostrar 60 (N8)

Ya está casi listo: R2 salta el dibujo con la carrera igual [medido §192]; falta que aurora no presente el cuadro saltado
y ponga la imagen intermedia.

**Cuánto da depende de dónde esté el dibujo:**

- **Sin A1 (el dibujo en el hilo del juego).** Por cuadro de carrera se paga calcular + la mitad de dibujar y presentar +
  la imagen intermedia. Sobre la tabla de §0:

  4,15 + (2,75 + 0,95) / 2 + ~1,0 (la intermedia en aurora) + 3,2 (lo demás) ≈ **10,2 ms**, contra 11,1.

  Es **×1,1, menos que el ×1,28 de `techo-pasos.md`**. Allá se usó la «dibujo = 6,7 ms» de §166.5, que mete en el dibujo
  todo lo que se paga por imagen. Lo cierto está entre los dos: el `(program)` también baja con menos imágenes, y no se
  sabe cuánto.
- **Con A1 (el dibujo en B).** N8 **ya no alivia al hilo de la carrera**, porque ahí no queda dibujo. **Alivia a B**: en
  33,3 ms dibuja una imagen y arma la intermedia. **En la gama media y en la baja es lo que hace que B entre** (§7).

**A1 y N8 se complementan:** A1 libera el hilo de la carrera y N8 libera el del dibujo. Precio: dos cuadros de demora en
total (A1 + N8 = ~33 ms más entre el botón y la imagen). La sala no cambia: la carrera va en A.

### (e) Reemplazar sistemas calientes por versiones propias

- **La matemática de matrices** ya se probó en N14 y dio ×1,00 [medido §181.2]. Lo más caro del perfil sin hijos es
  multiplicar matrices: ~1 % del hilo.
- **Los choques con la pista** son ~0,3 ms (ver §3).

Con el impuesto repartido parejo (§181.2), **esto es del otro trabajo y aquí no rinde**.

---

## 5. Pasar trabajo a la tarjeta de video (compute de WebGPU)

- **Los huesos («skinning»).** En el GX, deformar los vértices por los huesos **ya lo hace la tarjeta**: aurora lo pone
  en su sombreador de vértices. La CPU solo calcula las matrices de los huesos (dentro del 0,91 ms de la escena), y la
  carrera las lee. **No hay qué pasar.**
- **Las partículas.** Calcularlas cuesta 0,35 ms y escribir sus vértices al dibujar ~0,15 ms. Pasarlas a la tarjeta es
  reescribir el sistema de efectos para WebGPU. Ganaría ~0,4–0,5 ms (del hilo de la carrera, si se prueba que solo se ven)
  a cambio de semanas. Además, **con A2 se ganan casi igual sin reescribir nada**, mandando su cálculo a B.
- **El 2D**: ~0,3 ms. No vale.

**Veredicto:** la tarjeta no es la palanca. Lo que se podría pasar ya lo saca A2 más barato.

---

## 6. Precedentes

- **Dolphin en Android.** Dolphin corre con JIT a código ARM nativo y acceso rápido a la memoria, sin nuestro impuesto
  del navegador. Hay un informe de usuario de Mario Kart Wii **a velocidad completa en un Dimensity 1080**, de gama media
  de 2022 ([r/EmulationOnAndroid, dic. 2024](https://pol1.lr.ggtyler.dev/r/EmulationOnAndroid/comments/1hblcae/guide_how_to_run_zelda_twilight_on_vulkan_without)).
  No encontré una medida confiable para el Helio G99; las guías dicen que los Helio de gama baja «decepcionan» en lo
  pesado ([tech-insider](https://tech-insider.org/fr/dolphin-emulateur-android-gamecube-wii-2026/)).

  Si el informe es cierto, **un programa nativo con dos hilos llega a 60 en la gama media**. Lo que nos separa es el
  impuesto del navegador (×2,45–3,4, [§160, §166]), no la forma.

  Confianza: baja (informes de usuarios).
- **Los trucos de Dolphin, uno por uno:**
  - **«Dual Core»:** ver §1. Es nuestro paso 9; A1 corta más arriba.
  - **Saltar la espera ociosa** («idle skipping»): no girar cuando el juego espera en un bucle. **Ya lo tenemos**: el
    runtime duerme en las esperas del sistema imitado [§160, trampa 2].
  - **Saltar retrazados** («VBI skip»): Dolphin le hace creer al juego que pasaron menos cuadros. Eso **cambia la
    velocidad de la carrera** y en la sala la separaría. Lo parecido que sí sirve es R2 + N8.
  - **«Sync GPU thread»:** es para que el «Dual Core» sea estable. A nosotros no nos hace falta, por lo dicho en §1.
- **PPSSPP.** Su mayor salto en teléfonos de dos núcleos vino de **pasar el dibujo de OpenGL a otro hilo**
  ([notas de la 1.6](https://www.ppsspp.org/news/release-1.6)). Es el mismo principio que A1: lo que arma los comandos de
  la tarjeta, fuera del hilo que imita el procesador.
- **Los ports recompilados** (de N64 y de GameCube a PC) usan hilos nativos para el dibujo y el sonido. En la web, los
  ports con Emscripten suelen ir en un solo hilo. No encontré un port recompilado en la web que dibuje en otro núcleo.
  **A1-s sería el primero que conozco.**
- **Los puntajes públicos** (Geekbench 6, un solo núcleo) sirven para controlar S. 9800X3D ~3.000–3.300
  ([Notebookcheck](https://www.notebookcheck.net/AMD-Ryzen-7-9800X3D-makes-Geekbench-debut-with-decent-performance-gains-over-last-gen-counterpart.907384.0.html)).
  Snapdragon 7s Gen 2 ~1.026 ([HWPure](https://hwpure.com/benchmark/processors/geekbench-6-single-core)). Helio G99
  ~710–730 ([CPU-Monkey](https://www.cpu-monkey.com/en/compare_cpu-intel_core_i7_930-vs-mediatek_helio_g99)).

  Son ×3,2 y ×4,5 de diferencia en código nativo. El S que usa el plan (5,4 la media, 8,3 la baja) agrega ×1,7–1,8 por
  cachés chicas y el JIT en ARM. **Es razonable, pero puede estar inflado**: no hay un aparato real que lo confirme
  (riesgo ya anotado en `techo-pasos.md`).

---

## 7. El plan, ordenado

### Los ítems

| # | Qué | Gana en el hilo de la carrera (este PC) | Costo | Riesgo | Cómo se prueba que la carrera no cambia | ¿SharedArrayBuffer? |
|---|---|---|---|---|---|---|
| **M0** | Medir las páginas de 4 KiB que la carrera ensucia por cuadro y las que el dibujo lee (con la trampa de escritura y el vigía), en 5–10 pistas. Y **la prueba del sumidero**: ninguna dirección escrita por el dibujo es leída después por la carrera, salvo la parte de R2 | 0 (decide A1) | 1 semana | bajo | es la prueba misma | no |
| **A1-s** | El dibujo y la presentación en un segundo Worker (otra copia del juego), un cuadro atrás, con las páginas sucias en cajas | **−4,4 a −5,3 ms** (11,1 → ~6,2; **×1,5–1,9**) [estimado] | 4–6 semanas, sobre el arnés de §186 | medio. La memoria +250–400 MB; las páginas sucias pueden ser muchas; lo que no es memoria de la Wii (texturas avisadas, la hora) | huellas 75/75 con un programa A1 y uno de hoy en la misma sala (`--build-b`); `prueba-fantasma-igual` cuadro por cuadro; la prueba del sumidero de M0; fotos: el cuadro N de A1 igual al cuadro N de hoy | **no** |
| **A2** | Lo que solo se ve de la parte de calcular, a B: los efectos (0,35), los sonidos (0,21) y la interfaz (0,16). El hilo de sonido del juego (0,57) al worklet o a otro Worker | **−0,6 a −1,3 ms** [estimado] | 1 semana de pruebas de «saltar» + 2–3 semanas de moverlo | medio. Si uno de ellos usa el azar de la carrera, se queda; la interfaz puede mandar en la carrera (la pausa) | por cada uno, la prueba tipo R2: saltarlo y comparar huellas y fantasma; después, igual que A1 | no |
| **N8 en B** | Simular a 60 y que B dibuje 1 de cada 2 con la imagen intermedia | 0 en A (alivia a B: necesita la mitad) | 2–3 semanas (ya en el plan) | bajo para la carrera (R2 lo probó), medio para la vista (+1 cuadro de demora) | ya probado [§192]; con A1, otra vez las de A1 | no |
| **A3** | «Grabar y repetir» el dibujo de lo quieto (los materiales y las matrices alrededor de cada lista) | −0,7 a −1,2 ms, en B (o en A sin A1) | 3–5 semanas | medio (se ve, no separa); con modo «verifica» | sumidero: no hace falta la huella; comparar los comandos grabados contra los de verdad | no |
| **A1-h** | A1 con memoria compartida: un hilo, sin copia de la memoria fija | sobre A1-s: −0,1 a −0,5 ms (sin copiar) y −250 MB | +3–4 semanas (enlazar con hilos, §189; el runtime sin estado global) | alto en la plataforma (Android 146, sin confirmar) | igual que A1 | **sí** |
| **A5** | Las matrices de la escena repartidas en 4 núcleos | −0,4 a −0,6 ms | 3–4 semanas (después de A1-h) | medio. El vigía tiene que mostrar que ninguna rama escribe en otra | huellas, fantasmas, y la comparación bit a bit de las matrices contra el camino en serie en cada cuadro (modo verifica) | **sí** |
| **A4** | El dibujo de B repartido en varios núcleos | 0 en A (alivia a B ×1,5–2) | 4–8 semanas | medio (se ve, no separa) | sumidero; fotos iguales | **sí** |
| **A6** | Los 12 karts especulados en paralelo | ×1,0–1,4 sobre ~1,9 ms | meses | **muy alto** | huellas, fantasmas, y el modo «todo en serie» comparando cada cuadro | **sí** |

### La cuenta por escalón

Las cuentas usan:
- **el hilo de la carrera (A)**, que decide si se simulan 60;
- **el hilo del dibujo (B)**, que decide cuántas imágenes;
- S de `techo-pasos.md`;
- «código ×1,2»: el otro trabajo mejora un 20 % el código traducido, que es ~70 % de lo que queda en A [supuesto,
  moderado].

Todo estimado.

**Lo que queda en A después de cada paso (este PC):**

| Después de | A (ms) | Contra hoy |
|---|---|---|
| Hoy | 11,1 | ×1 |
| A1 | 6,2 | ×1,8 |
| + A2 | 5,2 | ×2,1 |
| + A5 | 4,7 | ×2,4 |
| + código ×1,2 | 4,1 | ×2,7 |
| Piso sin A6: la carrera pura con código ×1,2 | ~3,0 | ×3,7 |

**Gama media (S ≈ 5,4; meta 16,7 ms en A):**
- Hoy: 11,1 × 5,4 = **60 ms**.
- A1: 6,2 × 5,4 = **33 ms**.
- + A2: 5,2 × 5,4 = **28 ms**.
- + A5: 4,7 × 5,4 = **25 ms**.
- + código ×1,2: 4,1 × 5,4 = **22 ms** → ~45 cuadros de carrera por segundo. **No llega**: falta ×1,3.
- **Con S = 4,2** (lo que sugieren los puntajes públicos): 4,1 × 4,2 = **17 ms → 60, justo**.
- B: (4,5–5,5 − A3 ~1) × 5,4 ≈ **19–24 ms por imagen** → con N8 (una imagen cada 33 ms + la intermedia, ~5 ms) **entra**.

**Gama baja (S ≈ 8,3):**
- Hoy: **92 ms**.
- A1: 6,2 × 8,3 = **51 ms**.
- + A2: **43 ms**.
- + A5: **39 ms**.
- + código ×1,2: 4,1 × 8,3 = **34 ms** → ~29 cuadros de carrera por segundo. **No llega**: falta ×2.
- B: (4,5–5,5 − 1) × 8,3 ≈ 29–37 ms por imagen → con N8, **justo**; con A4 o dibujando 1 de cada 3, entra.
- **Para 60 de carrera faltaría bajar A a ~2 ms en este PC**, menos que la carrera pura (3,4 ms). Solo A6 (repartir los
  karts) ataca eso, y aun con su mejor caso (~−0,8 ms) quedaría ~26 ms. **Con lo que corre en la página, la gama baja
  queda en ~30–40 cuadros de carrera por segundo.** Su salida para la sala sigue siendo N11 (el video desde un PC).
  Jugando solo, el juego se salta imágenes como ya hace hoy.

**Gama media y baja, el resumen:**

| | Hoy | Lo de este documento (sin A6) | + código ×1,2 | Meta |
|---|---|---|---|---|
| Gama media (S 5,4) | 60 ms | 25 ms (×2,4) | **22 ms (×2,7)** | 16,7 (×3,6) |
| Gama media (S 4,2) | 47 ms | 20 ms | **17 ms (×2,7)** | 16,7 (×2,8) |
| Gama baja (S 8,3) | 92 ms | 39 ms (×2,4) | **34 ms (×2,7)** | 16,7 (×5,5) |

**Combinado:** ~×2,4 por la arquitectura sola, ~×2,7 con una mejora moderada del código. **No es el ×3+ para la media
con el S del plan; es el ×3 si el S real es ~4,2.** Hay que decirlo claro: el número de la media depende más de cuánto se
parece el aparato simulado a un teléfono real que de cualquier ítem de esta lista.

### Los tres primeros

1. **M0 (1 semana).**
   - Cuántas páginas ensucia la carrera por cuadro. Si son ≲2 MB, A1-s es barato; si son 10 MB, hay que ir a A1-h.
   - La prueba del sumidero en 5–10 pistas, también de Retro Rewind. Es la condición de todo lo demás.
2. **A1-s (4–6 semanas), sobre el arnés del Worker de §186.** Medirlo en el tramo fijo de la gama baja simulada y en este
   PC, intercalado, como pide el dueño. Probarlo con la sala de dos programas y los fantasmas iguales.
3. **Las pruebas de «saltar» de A2 (días):** saltar el cálculo de los efectos, los sonidos, la interfaz y el hilo de
   sonido, uno por vez. Si las huellas y el fantasma siguen iguales, cada uno se puede mover a B.

**Lo que no hacer:**
- pasar trabajo a la tarjeta (§5);
- el recorte por oclusión;
- reescribir las consultas de choques con la pista o la matemática (§3, §4e);
- A6, salvo que el dueño quiera pagar meses por la gama baja.

## Fuentes

- `docs/techo-pasos.md` (S por escalón, el 4,4/6,7 de §166.5, el techo de cada paso).
- `docs/bitacora.md`:
  - §62: la IA leía la matriz que escribía el dibujo; por eso R2 conserva esa parte;
  - §152: los contadores, 1,1 millones de accesos por cuadro;
  - §160, §165, §166: el impuesto, el reparto y el `(program)`;
  - §179.1: G1;
  - §181: G3/H12 y N14;
  - §186–§189: el juego en un Worker, Document-Isolation-Policy, la cinta de cajas y lo que falta del programa con hilos;
  - §191, §192: R1 y R2.
- `docs/plan-rendimiento.md`: G9, H3, H4, N4, N6, N7, N8, H10, M11, N11.
- El perfil `build/web/datos/medir-sitio/n13-carrera-pc-v1.cpuprofile` (§160), reagrupado para este documento por las
  ramas del bucle principal. Los nombres del juego no salen de la carpeta `build/`.
- El runtime de WiiCompiled, leído: la tabla de páginas con la tabla de escritura aparte y la trampa por página de 4 KiB
  (`runtime/include/memory_access.h`); el GX imitado, que llama a aurora dentro del dibujo (`runtime/src/hle/gx/`).
- Web, consultadas el 2026-10-31:
  - [Dolphin, informe de la versión 2509](https://dolphin-emu.org/blog/2025/09/16/dolphin-progress-report-release-2509/)
    (Dual Core rápido pero inestable, apagado por omisión en el escritorio);
  - [foro de Dolphin, «dual core doesn't provide a speedup»](https://forums.dolphin-emu.org/Thread-dual-core-doesn-t-provide-a-speedup)
    (solo gana si el lado de la tarjeta trabaja);
  - [foro de Dolphin, MKW en Android](https://forums.dolphin-emu.org/Thread-mkw-optimization-for-android?pid=476044);
  - [r/EmulationOnAndroid, MKW a velocidad completa en Dimensity 1080](https://pol1.lr.ggtyler.dev/r/EmulationOnAndroid/comments/1hblcae/guide_how_to_run_zelda_twilight_on_vulkan_without)
    (confianza baja);
  - [tech-insider, Dolphin en Android 2026](https://tech-insider.org/fr/dolphin-emulateur-android-gamecube-wii-2026/);
  - [PPSSPP 1.6](https://www.ppsspp.org/news/release-1.6) (el dibujo de OpenGL en otro hilo);
  - [Document Isolation Policy (Chrome)](https://developer.chrome.com/blog/document-isolation-policy) y
    [la nota sobre Android de poca memoria](https://lists.w3.org/Archives/Public/public-webapps-github/2025Apr/0625.html);
  - Geekbench 6 de un núcleo:
    [9800X3D](https://www.notebookcheck.net/AMD-Ryzen-7-9800X3D-makes-Geekbench-debut-with-decent-performance-gains-over-last-gen-counterpart.907384.0.html),
    [Snapdragon 7s Gen 2](https://hwpure.com/benchmark/processors/geekbench-6-single-core),
    [Helio G99](https://www.cpu-monkey.com/en/compare_cpu-intel_core_i7_930-vs-mediatek_helio_g99).
