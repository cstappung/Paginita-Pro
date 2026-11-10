// Área W del plan de rendimiento (versión 4, 2026-10-31): los pilotos, el dibujo en otro núcleo, el motor y las islas.
// Sale de cinco documentos de ese día: docs/techo-pasos.md, soluciones-motor.md, soluciones-arquitectura.md,
// soluciones-decompilacion.md y kartpad.md. Cadenas con comillas simples: `código`, **negrita** y [[ID]] para citar.

const P = (...x) => x.join('\n\n');

export const W = {
  id: 'W', nombre: 'La versión 4: pilotos que deciden, el dibujo en otro núcleo, el motor y las islas',
  intro: P(
    'Esta sección es nueva (versión 4, 2026-10-31). Sale de que los resultados de la versión 3 fueron chicos (el dueño: «bien tristes»): con todo lo que quedaba del plan viejo, siendo realista, el hilo del juego bajaba solo **×1,5** (`docs/techo-pasos.md`). El dueño pidió soluciones más grandes y revisar KartPad, que corre el mismo traductor nativo en teléfonos de verdad.',
    'Cuatro ideas la ordenan. (1) **Pilotos con umbral antes de gastar meses**: cada uno tiene un número que lo aprueba y otro que lo mata ([[W1]]–[[W6]]). (2) **El dibujo en otro núcleo**: la carrera nunca lee lo que el dibujo escribe (es un «sumidero»), así que el dibujo entero, también el código del juego que recorre la escena, puede ir a un segundo Worker un cuadro atrás ([[W10]], [[W11]]). (3) **El motor donde de verdad cuesta**: la memoria de la Wii, la pila, el contexto y las banderas, sin copiar más código en línea ([[W12]]–[[W14]]). (4) **Islas decompiladas, solo si los pilotos pasan**: el dibujo en nativo primero (no toca la carrera), después la colisión y la física del kart ([[W15]]–[[W18]]).',
    'El código decompilado es derivado del de Nintendo, igual que el C++ traducido: vive en una carpeta ignorada, nunca va a git ni se publica, y sale solo dentro del `.wasm` privado que el Worker sirve desde R2. Los fantasmas tienen que seguir dando los mismos bits.'
  ),
  items: [
    // ---------- Etapa 0: los pilotos que deciden ----------
    {
      id: 'W1', titulo: 'M0: contar las páginas que ensucia la carrera y probar que el dibujo es un sumidero',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '1 semana', fuente: 'medido', banderas: ['medir', 'recompilar'],
      pasa: 'Toda la etapa 1 descansa en que el dibujo del juego es un **sumidero**: la carrera nunca lee lo que el dibujo escribe. [[R2]] lo mostró en una pista: saltando 1 de cada 2 o 2 de cada 3 dibujos, las huellas dieron 75/75 y el fantasma salió igual byte por byte (§192). Pero no se sabe cuántas páginas de 4 KiB de la memoria de la Wii escribe la carrera en cada cuadro, y de eso depende cuánto cuesta mandarle al dibujo una foto del cuadro (`docs/soluciones-arquitectura.md` §1).',
      arreglo: 'Con la trampa de escritura por página que el runtime ya tiene (la que cuida el código de la Wii) y el vigía (§62): anotar qué páginas escribe la carrera en cada cuadro y cuáles lee el dibujo, en 5–10 pistas (también de Retro Rewind) con 12 CPU. Y la prueba del sumidero: ninguna dirección que escribe el dibujo la lee después la carrera, salvo la parte que [[R2]] conserva (`ModelDirector::Update`, las marcas de «se ve»). Es como un medidor de consumo por circuito: no mira cada electrón, solo anota qué circuitos se usaron.',
      gana: 'decide la etapa 1: con ≲ 2 MB de páginas sucias por cuadro, [[W10]] (sin memoria compartida) es barato; con 10 MB o más, hace falta la versión con memoria compartida',
      comprueba: P(
        '**Éxito:** el sumidero se cumple en las 5–10 pistas (0 lecturas de la carrera a lo que escribió el dibujo, fuera de lo de [[R2]]) y las páginas sucias por cuadro quedan medidas (media y máximo por pista).',
        '**Se corta** [[W10]] tal como está si el sumidero falla en alguna pista (ahí se busca qué lee la carrera, como hizo R2) o si las páginas sucias pasan de 10 MB por cuadro (va la versión con memoria compartida).'
      ),
      refs: 'runtime (tabla de escritura por página); MKW_VIGIA; web/juego/lockstep_nativo.cpp (ScnMgr::DrawMain, R2); docs/soluciones-arquitectura.md §1 y §7',
    },
    {
      id: 'W2', titulo: 'Piloto: la colisión con la pista (KCL) como isla decompilada',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '1 semana', fuente: 'sospecha', banderas: ['decompilar', 'recompilar', 'medir'],
      pasa: 'No se sabe si la lógica escrita como C++ normal, con sus datos en el orden de la PC, gana de verdad dentro de wasm. Reescribir funciones de a una no ganó nada ([[N14]], §181.2): el impuesto está repartido parejo. La idea de `docs/soluciones-decompilacion.md` es otra: una **isla** entera (un grupo de funciones con sus datos en formato nativo) que solo habla con el resto del juego en su **borde**. La colisión contra el mapa de choques de la pista (KCL) es la isla más chica y cerrada: el mapa no cambia después de cargar; entra una posición y sale el contacto.',
      arreglo: P(
        'Día 1: con el perfil por funciones que ya existe, sumar lo que pesan las consultas de colisión; si es menos del 3 % de la lógica, elegir otra isla cerrada que pese más.',
        'Días 2–5: la IA escribe la isla en C++ propio (tipos de verdad, la multiplicación-suma explícita); el mapa de choques se copia al cargar en formato nativo y el borde convierte la posición que entra y el contacto que sale.',
        'Días 6–7: el comprobador en el borde (el de [[N14]]) en cada llamada, una carrera entera de 12 CPU en 3 pistas, los fantasmas y la sala con dos programas; medir con `medir-node-estable --fijo` intercalado y la gama baja en el tramo fijo, con el candado.',
        'Es código derivado del de Nintendo: carpeta ignorada, nunca a git; sale solo dentro del `.wasm` privado de R2.'
      ),
      gana: 'saber con un número si decompilar la lógica paga; si pasa, la colisión entra en la etapa 4 junto con la física del kart ([[W17]])',
      comprueba: P(
        '**Éxito:** 0 diferencias en el comprobador, los fantasmas iguales (`prueba-fantasma-igual`), la sala 75/75 (`prueba-sincro --directa --build-b`) y la consulta (con el borde) **×2,0 o más rápida**, con la ganancia del cuadro de acuerdo con su peso (al menos el 70 % de lo esperado).',
        '**Se mata** la idea de la lógica si la consulta gana **menos de ×1,4** (el impuesto sería de V8 y no de imitar la máquina). Entre ×1,4 y ×2,0: solo las islas de poca multiplicación-suma.'
      ),
      refs: 'build/web/datos/impuesto-perfil/ (perfil por funciones); web/juego/caliente_nativo.cpp (el comprobador); docs/soluciones-decompilacion.md §5 y §8.2',
    },
    {
      id: 'W3', titulo: 'Piloto: un modelo de la pista dibujado en nativo',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '1 semana', fuente: 'sospecha', banderas: ['decompilar', 'recompilar', 'medir'],
      pasa: 'Dibujar cuesta en la CPU más que la carrera misma: ~6,7 ms por imagen de 11 en este PC (§166.5). [[G3]] y [[H12]] sacaron las subidas repetidas y la CPU no se movió: lo caro no es mandar bytes, es que el juego decida y aurora traduzca cada orden de dibujo del GX, cada imagen. Eso solo se va si el juego deja de hablar GX en lo que se dibuja (`docs/soluciones-decompilacion.md` §2).',
      arreglo: 'El modelo fijo de **una** pista: sus vértices y materiales a la tarjeta al cargar (los materiales TEV ya convertidos en recetas de WebGPU), en un paquete de dibujo ya validado (render bundle), y el dibujo de ese modelo por el juego, apagado. Los karts y todo lo demás siguen por aurora. noclip.website (MIT) muestra que las pistas de Mario Kart Wii se pueden dibujar así en el navegador: sirve de referencia para los formatos, no se copia código.',
      gana: 'saber si el envío nativo ([[W15]]) gana de verdad, antes de meterle 6–10 semanas',
      comprueba: P(
        '**Éxito:** **−0,5 ms o más** de CPU por imagen en este PC (≥ 4,5 %) y ≥ −5 % en la gama baja simulada (tramo fijo, `perfilGpu=1`), con la misma foto (`foto-pantalla.mjs`: menos del 0,5 % de los píxeles con más de 2 niveles de diferencia).',
        '**Se mata** si baja **menos del 2 %**: el costo no estaba en el envío sino en el recorrido de la escena del juego, y habría que ir directo a [[W16]] (meses).'
      ),
      refs: 'aurora lib/gx (command_processor.cpp, shader.cpp); web/navegador/foto-pantalla.mjs; docs/soluciones-decompilacion.md §2.2 y §8.2',
    },
    {
      id: 'W4', titulo: 'Piloto de PGO: compilar guiado por un perfil del programa nativo',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '3–5 días', fuente: 'dato', banderas: ['recompilar', 'medir'],
      pasa: 'KartPad (el mismo traductor, nativo en Android) compiló guiado por un perfil (PGO) y ganó **−12 %** de CPU del hilo en una pista que el perfil no había visto y **−13 % de código** (`docs/kartpad.md` §3). Para nosotros vale sobre todo lo segundo: todo lo que agrandó el código perdió en la gama baja (§184, §193), y PGO lo achica. Ojo: con el perfil de una sola carrera, a ellos el código les creció un 9 %.',
      arreglo: 'El programa de Windows (`compilar-nativo.py`) con `-fprofile-instr-generate`, 3 carreras distintas (pistas de Nintendo y de RR), y el `.wasm` compilado con ese perfil (`-fprofile-instr-use`) más `-mllvm -hot-cold-split` (los bloques fríos fuera de las funciones calientes). Las sugerencias de salto de wasm, si LLVM ya las escribe. El perfil lleva nombres de funciones del juego: nunca a git.',
      gana: 'KartPad ×1,14 en nativo; para nosotros ×1,05–1,10 estimado, más en la gama baja; decide si [[M6]] entra completo en la etapa 2',
      comprueba: P(
        '**Éxito:** **5 % o más** menos CPU por cuadro en la gama baja simulada (tramo fijo, intercalado) en una pista que el perfil no vio, y el `.wasm` no más grande.',
        '**Se mata** si gana **menos de 2 %** en la gama baja o si el código crece. Siempre la sala 75/75 y los fantasmas iguales (con `-ffp-contract=off` el resultado es el mismo por construcción).'
      ),
      refs: 'herramientas/compilar-nativo.py, compilar-web.py (MKW_CFLAGS_EXTRA); docs/kartpad.md §3 y §5; docs/soluciones-motor.md punto 5',
    },
    {
      id: 'W5', titulo: 'La simulación del teléfono paga la revisión de límites de Android',
      prio: 'urgente', aparato: 'celular', modo: 'ambos', esfuerzo: '2–3 días', fuente: 'medido', banderas: ['medir'],
      pasa: 'Chrome en Android no tiene páginas de guarda para wasm: revisa los límites de la memoria en **cada** acceso (está en el código de V8, a propósito). En este PC eso no se paga, así que la gama media y la baja simuladas salen optimistas: forzar esa revisión aquí costó **+16 %** (§160; `docs/soluciones-motor.md` §1). Es como medir una fuente sin la resistencia del cable que va a tener instalada.',
      arreglo: 'Toda medida de un teléfono simulado va con `--js-flags=--wasm-enforce-bounds-checks`: en Chrome (`medir-sitio --chrome "…"`) y en Node (`medir-node-estable --v8 "…"`), dentro de las escaleras y de las tandas. Volver a medir con la bandera la escalera simulada ([[N2]]). Es solo para medir: una página no puede poner banderas de V8.',
      gana: 'medir los teléfonos como son de verdad, y poder medir lo que ataca ese costo ([[W13]])',
      comprueba: P(
        '**Éxito:** la escalera de los escalones de teléfono medida con y sin la bandera, 3 corridas por escalón dentro de ±3 %, y la diferencia anotada (se esperan +10–20 %).',
        '**Si sale menos de 5 %**, se anota y la bandera queda solo como control. Desde aquí, cada medida de un teléfono simulado la lleva.'
      ),
      refs: 'herramientas/medir-sitio.mjs (--chrome), medir-node-estable.mjs (--v8); bitácora §160',
    },
    {
      id: 'W6', titulo: 'Dos medidas del programa nativo en la carrera: dar vuelta los bytes y la memoria revisada',
      prio: 'urgente', aparato: 'pc', modo: 'ambos', esfuerzo: '2–3 días', fuente: 'sospecha', banderas: ['medir', 'recompilar'],
      pasa: 'Antes de meterle 6–9 semanas a la memoria de la Wii ([[H6]], [[H7]]) hay que saber cuánto pesa de verdad en la carrera. Dar vuelta los bytes sin la instrucción del procesador se estima en 15–25 % del impuesto y la tabla de páginas en 10–17 % (`docs/soluciones-motor.md` §1), pero el nativo «revisado» solo se midió en el título (§160).',
      arreglo: P(
        '(1) `compilar-nativo.py --bytes-lentos`: el nativo da vuelta los bytes con desplazamientos, como wasm, con una barrera vacía para que clang no los junte otra vez en una sola instrucción. La diferencia en el tramo fijo de la carrera es el costo exacto de dar vuelta los bytes (como `--sin-vector` en §165).',
        '(2) El nativo `--revisado` en la carrera (el guion de §165): el costo de la tabla de páginas.',
        'Las dos con `medir-node-estable --alternar` y el candado.'
      ),
      gana: 'el orden de la etapa 2 con números: si (1) + (2) suman menos del 15 % del nativo, [[H6]] y [[H7]] bajan de lugar; si suman 30 % o más, van primero sin discusión',
      comprueba: P(
        '**Éxito:** las dos razones medidas en 5 pares intercalados, ±2 %.',
        '**Se corta** la parte cara de [[H7]] (guardar la RAM dada vuelta, 4–6 semanas) si dar vuelta los bytes pesa menos del 5 % del nativo.'
      ),
      refs: 'herramientas/compilar-nativo.py (--sin-vector, --revisado), medir-node-estable.mjs; build/web/datos/impuesto-perfil/guion-165.txt; docs/soluciones-motor.md §4.0',
    },
    // ---------- Los arreglos de correctitud de KartPad (temprano, en la etapa 0) ----------
    {
      id: 'W7', titulo: 'Las escrituras parciales de las matrices XF',
      prio: 'media', aparato: 'ambos', modo: 'ambos', esfuerzo: '1–2 días', fuente: 'codigo', banderas: ['recompilar', 'r2'],
      pasa: 'KartPad adaptó un arreglo de la aurora de WiiCompiled (`998c456`): una carga de matriz que empieza a mitad de una matriz o cruza dos. Nuestra `copy_xf_data` la rechaza («sub-copy unsupported») y se salta esa carga: si Mario Kart la usa, algo se dibuja mal (`docs/kartpad.md` §4).',
      arreglo: 'Primero buscar el aviso en el registro de una carrera, en varias pistas (también de RR). Si nunca sale, se anota y no se toca. Si sale, el arreglo chico en `command_processor.cpp`, con atribución (GPL-3.0: autor, enlace y commit en el parche y en `herramientas/versiones.md`).',
      gana: 'la imagen correcta donde hoy podría faltar una matriz',
      comprueba: 'el aviso contado en 5 pistas; si se arregla, la foto antes y después y `prueba-navegador` en verde.',
      refs: 'aurora lib/gx/command_processor.cpp (copy_xf_data, ~línea 302); parches/aurora-n15a.diff',
    },
    {
      id: 'W8', titulo: 'Los pipelines que no se sueltan en una copa entera',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '2–3 días', fuente: 'sospecha', banderas: ['medir'],
      pasa: 'En KartPad los pipelines compilados nunca se sueltan: +233 MB al pasar por varias pistas, y un Galaxy S10 Lite llegó a 2 GB y bajó a 42 fps tras una hora (`docs/kartpad.md` §3). Nuestra aurora es de la misma familia, y una copa de la sala (o una hora de juego) es justo ese caso. Con dos copias del juego en la etapa 1 ([[W10]]) la memoria importa todavía más.',
      arreglo: 'Medir con `medir-memoria.mjs` la memoria de la pestaña y del proceso de GPU tras 4–8 pistas distintas. Si crece sin techo: soltar los pipelines de una pista al dejarla (con la etiqueta por pista de [[C2]], que ya existe), con un tope por memoria.',
      gana: 'que una copa entera y una hora de sala no crezcan en memoria (en un teléfono de 4 GB, que no se cierre la pestaña)',
      comprueba: 'la memoria tras 8 pistas distintas a menos de +50 MB de la que hay tras 1 (o lo que crezca, explicado); `prueba-sala` en verde.',
      refs: 'herramientas/medir-memoria.mjs; aurora (caché de pipelines); web/navegador/lista-pipelines.mjs',
    },
    {
      id: 'W9', titulo: 'Personajes invisibles en tarjetas Adreno 6xx/7xx: el chequeo',
      prio: 'media', aparato: 'celular', modo: 'ambos', esfuerzo: '2–3 días', fuente: 'dato', banderas: [],
      pasa: 'En KartPad los personajes salen invisibles en tarjetas Adreno 6xx/7xx (muy comunes en la gama media: Galaxy S24, Moto G85, OnePlus), por el controlador de Vulkan con las matrices de los huesos. Chrome en Android también dibuja con Vulkan (por Dawn), así que nos puede pasar. El Oppo es Mali: no lo habríamos visto. Sin un teléfono Adreno no se puede probar (la regla del dueño: solo este PC).',
      arreglo: P(
        '(1) El informe de rendimiento y el registro anotan la tarjeta (`GPUAdapterInfo`: fabricante y arquitectura) y avisan si es Adreno 6xx/7xx.',
        '(2) Un camino de reserva preparado y apagado: las matrices de los huesos en un búfer de uniformes, como lo esquiva KartPad, probado en este PC con la misma foto.',
        '(3) Se prende para Adreno recién cuando llegue el primer informe de un jugador.'
      ),
      gana: 'no enterarse por un jugador sin tener nada listo',
      comprueba: 'banco con un adaptador de mentira «Adreno 730»: el aviso sale; con el camino de reserva prendido, la foto en este PC igual (menos del 0,5 % de los píxeles con más de 2 niveles).',
      refs: 'web/navegador/perfil-gpu.mjs, mkw.mjs (mkwInformeRendimiento); aurora gx/shader.cpp; docs/kartpad.md §4',
    },
    {
      id: 'W19', titulo: 'El índice del memo de las llamadas indirectas (el arreglo `20ad85d` de KartPad)',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '1 día', fuente: 'codigo', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'El memo que recuerda adónde fue cada llamada indirecta elige su casillero con los bits bajos del hash de Fibonacci, que son los que peor se reparten: muchas llamadas caen en el mismo casillero y se pisan (`runtime/include/guest_abi/dispatch.h`, líneas ~339 y ~359). Lo encontró DriftDroid y KartPad lo arregló en una línea (`20ad85d`, GPL-3.0). Nosotros todavía lo tenemos (`docs/kartpad.md`).',
      arreglo: 'Tomar los bits altos del hash, como en `20ad85d`, con atribución en el parche y en `herramientas/versiones.md`.',
      gana: 'menos fallos del memo (estimado: poco, pero gratis); es un arreglo, no un experimento',
      comprueba: '`paridad` 28/0, huellas 75/75 con `--build-b`, `prueba-fantasma-igual`; el tramo fijo en la gama baja simulada y en este PC, intercalados.',
      refs: 'terceros/Wiicompiled-motor/runtime/include/guest_abi/dispatch.h; chrissotraidis/wiicompiled 20ad85d; docs/kartpad.md',
    },
    {
      id: 'W20', titulo: 'Soltar las texturas de copia que nadie usa (la mitad de `0cca4d2` de KartPad)',
      prio: 'media', aparato: 'ambos', modo: 'ambos', esfuerzo: '1–2 días', fuente: 'codigo', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'La aurora guarda una piscina de texturas para las copias del cuadro (EFB) y nunca suelta las que dejaron de usarse: la memoria de la tarjeta crece con las pistas. KartPad suelta las ociosas (`0cca4d2`, la parte de la piscina). Va junto con [[W8]].',
      arreglo: 'Portar solo la parte de la piscina de `0cca4d2` (soltar lo que lleva N cuadros sin usarse), con atribución.',
      gana: 'menos memoria de tarjeta en una copa entera (importa en teléfonos de 4 GB y con las dos copias de [[W10]])',
      comprueba: 'con `medir-memoria.mjs`, 8 pistas distintas: la memoria del proceso de GPU sin crecer de más; la foto igual; `prueba-navegador` en verde.',
      refs: 'aurora gfx (piscina de copias); chrissotraidis/wiicompiled 0cca4d2; docs/kartpad.md',
    },
    // ---------- Etapa 1: el dibujo en otro núcleo ----------
    {
      id: 'W10', titulo: 'A1-s: el dibujo y la presentación en un segundo Worker, sin memoria compartida',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '4–6 semanas', fuente: 'sospecha', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'Hoy un solo hilo calcula la carrera, arma el dibujo y lo presenta, en serie: el cuadro dura la suma (11,1 ms en este PC: la carrera ~4,2, el dibujo del juego con aurora ~2,8, presentar ~0,95 y el resto ~3,2; reagrupado del perfil de §160). Como el dibujo es un sumidero ([[R2]], [[W1]]), puede ir entero a otro núcleo, un cuadro atrás, sin cambiar la carrera. Es pasar de dos resistencias en serie a dos ramas en paralelo: manda la más cargada. Dolphin no puede hacerlo (imita un solo procesador y no sabe qué parte del programa dibuja); nosotros tenemos el programa traducido función por función.',
      arreglo: P(
        'Dos copias del mismo programa en dos Workers: **A** corre la carrera; **B** solo dibuja y presenta (es dueña de WebGPU y del lienzo, `OffscreenCanvas`). Al final de cada cuadro, A junta sus páginas sucias ([[W1]]) en una caja y la transfiere por la cinta de cajas (§188); B la pega en su memoria y llama a la misma función de dibujo que hoy llama el bucle del juego. En A esa llamada se cambia por «mandar la caja» más la parte chica que la carrera lee (la de [[R2]]).',
        'En la caja viaja también lo que no es memoria de la Wii y el dibujo usa (los avisos de texturas cambiadas, la hora de la carrera). Anda en cualquier Chrome, también en Android de hoy, sin Document-Isolation-Policy. Va sobre el arnés del Worker de §186 ([[N3]], [[P10]]). Con memoria compartida, más adelante, B puede ser un hilo del mismo programa y no copiar lo que nadie ensucia (si [[H5]] lo permite).',
        'Dos lecciones de KartPad (`docs/kartpad.md`): el trabajo pasa a B **de a un cuadro entero, nunca de a una primitiva** (DriftDroid cayó a ~20 fps mandando de a una); y A y B tienen que poder caer en núcleos distintos (su beta con los tres hilos en un núcleo dio 19–22 fps, sueltos 48–60). En el teléfono, un hilo que espera puede hacer que el sistema baje la velocidad del procesador: medirlo con el informe.'
      ),
      gana: 'el hilo de la carrera 11,1 → ~6,2 ms en este PC (×1,5–1,9, estimado); contiene a los pasos 8 y 9 viejos y va más lejos que el «dual core» de Dolphin',
      comprueba: 'la sala con un programa A1 y uno de hoy (`--build-b`): huellas 75/75; `prueba-fantasma-igual` cuadro por cuadro; la foto del cuadro N con A1 igual a la del cuadro N de hoy; el tramo fijo en la gama baja simulada (con [[W5]]) y en este PC, intercalados; la memoria de la segunda copia (+250–400 MB estimado) con `medir-memoria.mjs`.',
      refs: 'web/navegador/trabajador-dom.mjs, cajas.mjs (§186–§188); web/juego/lockstep_nativo.cpp (ScnMgr::DrawMain); docs/soluciones-arquitectura.md §1 y §7',
    },
    {
      id: 'W11', titulo: 'A2: lo que solo se ve de la parte de calcular, también al Worker del dibujo',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '3–4 semanas', fuente: 'sospecha', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'Con [[W10]], en el hilo de la carrera quedan cosas que no deciden la carrera: calcular los efectos (~0,35 ms), decidir qué suena (~0,21), actualizar la interfaz 2D (~0,16) y el hilo de sonido del juego (~0,57) (reagrupado del perfil de §160).',
      arreglo: 'Primero las pruebas de «saltar», como [[R2]]: saltar cada sistema por vez y mirar las huellas y el fantasma (días). Lo que pase la prueba se mueve a B (el sonido, al AudioWorklet o a otro Worker). Lo que use el azar de la carrera, o mande en ella (la pausa), se queda en A. Reemplaza a [[H10]].',
      gana: '−0,6 a −1,3 ms en el hilo de la carrera de este PC (estimado)',
      comprueba: 'por cada sistema, la prueba de saltar (huellas 75/75, el fantasma igual); después, las mismas pruebas que [[W10]].',
      refs: 'docs/soluciones-arquitectura.md §7 (A2); web/navegador/sonido-worklet.js',
    },
    // ---------- Etapa 2: el motor ----------
    {
      id: 'W12', titulo: 'La pila de la Wii en variables locales',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '3–4 semanas', fuente: 'codigo', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'En el código traducido ~23 % de los accesos directos a la memoria y ~35 % de los rangos son relativos a r1, la pila de la Wii (contado en 40 de los 202 archivos): guardar y reponer r14–r31 y LR, y variables temporales. Cada uno paga hoy la tabla de páginas, dar vuelta los bytes y, en Android, la revisión de límites ([[W5]]).',
      arreglo: 'Si el traductor demuestra que una función nunca pasa la dirección de su pila a otra (ningún `addi rX, r1, k` que escape), sus casilleros de la pila pasan a ser variables de C++ y el acceso desaparece entero, no solo se abarata. Quedan afuera las funciones con ganchos o continuaciones de RR (reponen r14–r31 de la pila de otra función, §178) y la cadena de marcos (0(r1)). Usa la maquinaria del modo seguro de [[M8]] y del vigía.',
      gana: 'el código traducido ×1,06–1,15 encima de [[H6]] (estimado); gana también contra el nativo, porque es trabajo de la traducción y no impuesto',
      comprueba: 'el vigía en modo «guardar igual y comparar al leer» (avisa si alguien lee desde afuera un casillero promovido); huellas 75/75; fantasmas iguales; el volcado de la RAM sin los casilleros muertos de la pila.',
      refs: 'docs/soluciones-motor.md punto 2; parches/traductor-m8.diff; MKW_VIGIA',
    },
    {
      id: 'W13', titulo: 'El contexto de la CPU en una dirección fija',
      prio: 'alta', aparato: 'celular', modo: 'ambos', esfuerzo: '1–2 semanas', fuente: 'codigo', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'Los registros que se guardan (`ctx->gpr[n]`) son ~12 mil escrituras y ~12 mil lecturas por cada 90 mil líneas traducidas, a través de un puntero que se pasa a cada función. En Android cada uno paga la revisión de límites ([[W5]]).',
      arreglo: 'La Wii tiene un solo procesador: un solo contexto global en una dirección constante de la memoria de wasm; al cambiar de hilo del juego (7–8 veces por cuadro, §152) se copia (~1 KB). Con la dirección constante, V8 puede saltarse la revisión de esos accesos (a verificar en V8) y queda libre un registro.',
      gana: 'este PC ×1,00–1,03; Android ×1,05–1,10 (estimado), medido con la bandera de [[W5]]',
      comprueba: '`paridad`, `prueba-arranque` y las huellas; el tramo fijo con y sin `--wasm-enforce-bounds-checks`.',
      refs: 'docs/soluciones-motor.md punto 3; runtime (ctx, fibras, HLE)',
    },
    {
      id: 'W14', titulo: 'Las banderas del CR «perezosas», y terminar el modo seguro de §193',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '2–3 semanas', fuente: 'medido', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'Cada comparación arma hoy 4 bits y los mete en el CR empaquetado de 32 bits, y el CR se guarda entero en cada llamada, así que se calcula siempre. El techo de guardar solo lo que se lee ya está medido en el juego entero: Node ×0,88 (§193). Pero el «techo» separaba la sala en el cuadro 270, porque RR no cumple la regla de la Wii; el «seguro» quedó a medias (§193.1: falta saber qué funciones pueden ser destino de una llamada indirecta).',
      arreglo: 'Como Dolphin: cada campo del CR es una variable aparte con el resultado de la comparación; un salto lee el bit con 1 operación; el CR empaquetado se arma solo para `mfcr`, `mtcrf` o al guardarlo; el acarreo (XER.CA), una variable de 1 bit. Encima, los 4 pasos que faltan del modo seguro (la indirecta lee solo la unión de lo que leen sus destinos, la regla justa para el mod, el punto fijo entre las dos pasadas): se guardan solo los campos que alguien lee y clang borra el resto. Lo útil de [[M8]] sigue aquí.',
      gana: 'el código traducido ×1,08–1,15 (estimado), y el código más chico',
      comprueba: 'la paridad de todas las operaciones del CR con un millón de casos contra la versión de hoy; **siempre** en la sala (huellas 75/75 con `--build-b`) y los fantasmas iguales.',
      refs: 'docs/soluciones-motor.md punto 4; bitácora §193 y §193.1; terceros/Wiicompiled-motor-seguro',
    },
    // ---------- Etapa 4: las islas decompiladas (solo si los pilotos de la etapa 0 pasan) ----------
    {
      id: 'W15', titulo: 'D-a: el envío del dibujo en nativo (el renderizador WebGPU propio, primer nivel)',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '6–10 semanas', fuente: 'sospecha', banderas: ['decompilar', 'recompilar', 'r2', 'medir'],
      pasa: 'Solo si [[W3]] pasó. Hoy, en cada imagen, el juego recorre la escena, calcula animaciones y matrices y manda órdenes GX que aurora convierte una por una a WebGPU (estados, formatos, recetas, subidas).',
      arreglo: P(
        'Al cargar cada modelo (pista, karts, personajes, objetos): sus vértices en búferes de la tarjeta y sus materiales TEV ya convertidos en recetas. En cada imagen: las matrices de todos en un solo búfer (leídas de la memoria del juego, que sigue haciendo las animaciones y el árbol de escena), lo repetido (cajas de objetos, monedas, árboles, público) instanciado, y lo fijo de la pista en un render bundle. Corre en el Worker del dibujo ([[W10]]).',
        'Tiene que seguir escribiendo las marcas de «se ve» que la lógica lee en la sala ([[G1]]). Es código derivado del de Nintendo: carpeta ignorada, nunca a git, solo dentro del `.wasm` privado de R2. Reemplaza a [[G7]] y [[H13]].'
      ),
      gana: '−1,5 a −2,5 ms de CPU por imagen en este PC (estimado, en el hilo del dibujo); probablemente también menos trabajo para la tarjeta (sin medir)',
      comprueba: 'la foto de cada pista igual (menos del 0,5 % de los píxeles con más de 2 niveles), en 10 pistas, también de RR; huellas 75/75 con un programa D-a y uno de hoy (por las marcas de «se ve»); el tramo fijo en la gama baja y en este PC.',
      refs: 'docs/soluciones-decompilacion.md §2.2 y §6.4; aurora; noclip.website (referencia de formatos, MIT)',
    },
    {
      id: 'W16', titulo: 'D-b: el dibujo entero en nativo',
      prio: 'media', aparato: 'ambos', modo: 'ambos', esfuerzo: '3–5 meses', fuente: 'sospecha', banderas: ['decompilar', 'recompilar', 'r2', 'medir'],
      pasa: 'Solo si [[W15]] mostró su ganancia. Con D-a siguen traducidas las animaciones de esqueleto y de materiales, el 2D (el marcador), los efectos de imagen (brillo, profundidad) y las copias del EFB.',
      arreglo: 'Todo eso en C++ propio, en el Worker del dibujo, entendido con lo decompilado y nunca copiado. El 2D de RR está muy parcheado: se rehace con sus cambios. Lo que la lógica lea (si [[W1]] encuentra algo, como huesos que chocan) se queda en la carrera. Con todos los efectos: ninguno se saca. Las partículas (`nw4r::ef`) van aquí también, si el vigía muestra que no usan el azar de la carrera (lo que era [[W18]], que la poda juntó con este). Reemplaza a [[N6]].',
      gana: 'el dibujo 6,7 → 2–3 ms de CPU por imagen en este PC (estimado)',
      comprueba: 'fotos iguales en 10 pistas y en el 2D (el marcador, el mapa, los menús de la carrera); huellas 75/75; fantasmas iguales; el tramo fijo.',
      refs: 'docs/soluciones-decompilacion.md §2.2 y §6.4',
    },
    {
      id: 'W17', titulo: 'Las islas de la lógica: la colisión y la física del kart',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '3–5 meses', fuente: 'sospecha', banderas: ['decompilar', 'recompilar', 'r2', 'medir'],
      pasa: 'Solo si [[W2]] pasó (×2,0 o más). La física del kart es ~25–35 % de la lógica (estimado), con un borde ancho (12 karts que leen la IA, los objetos, la cámara y el marcador) y mucha multiplicación-suma, y tiene que dar los mismos bits que la Wii: los fantasmas expertos de RR se grabaron en una Wii de verdad.',
      arreglo: P(
        'Por fases (`docs/soluciones-decompilacion.md` §5.2): el inventario de qué datos toca cada función y quién más los toca; la fuente con tipos sobre la memoria de la Wii, comprobada con el comprobador de [[N14]]; recién después, los datos de la isla a memoria propia en orden nativo, con el borde convertido una vez por cuadro.',
        'La colisión del piloto entra primero; después, la física. El traducido queda de «testigo» semanas (correr los dos en las pruebas y comparar), en muchas pistas, con todos los objetos y los niveles de CPU. Reemplaza a [[N7]]. La IA de la CPU y los objetos, solo si esto rinde y el dueño lo pide.'
      ),
      gana: 'la lógica ×2–2,5 en lo decompilado (realista, estimado); es lo que acerca la gama baja a 60 cuadros de carrera',
      comprueba: '0 diferencias en el comprobador del borde; `prueba-fantasma-igual` contra el experto; un juego de fantasmas grabados en una Wii de verdad; la sala 75/75; `correr-todo`.',
      refs: 'docs/soluciones-decompilacion.md §3, §5 y §6; web/juego/caliente_nativo.cpp',
    },
    {
      id: 'W18', titulo: 'Los efectos (partículas) en nativo',
      prio: 'media', aparato: 'ambos', modo: 'ambos', esfuerzo: '4–6 semanas', fuente: 'sospecha', banderas: ['decompilar', 'recompilar', 'r2', 'medir'],
      pasa: 'Los efectos se calculan dentro de la carrera (~0,35 ms en este PC) y se dibujan con el resto (`nw4r::ef`). Si no usan el azar de la carrera, son solo dibujo.',
      arreglo: 'Primero mirar con el vigía si usan el azar del juego: si lo usan, son lógica y se quedan donde están. Si no, en C++ propio, en el Worker del dibujo, con todos los efectos (ninguno se saca). Va junto con [[W16]] y después de la prueba de saltar de [[W11]].',
      gana: 'parte del −3,5 a −4,5 ms de D-b; sin medir aparte',
      comprueba: 'fotos iguales a simple vista en las escenas con más efectos; huellas 75/75; fantasmas iguales.',
      refs: 'generated/guest_symbol_table.cpp (nw4r::ef); MKW_VIGIA; docs/soluciones-decompilacion.md §5.3',
    },
    // ---------- Etapa 4b: lo ambicioso (hilos de verdad, el dibujo retenido, los saltos en línea) ----------
    {
      id: 'W21', titulo: 'Hilos de verdad: el sitio aislado con un service worker (COOP/COEP)',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '1–2 semanas (estimado)', fuente: 'sospecha', banderas: ['medir', 'dueno'],
      pasa: 'El sitio está en GitHub Pages, que no puede mandar las cabeceras COOP/COEP. Sin ellas no hay memoria compartida (`SharedArrayBuffer`): cada núcleo trabaja solo y los datos hay que copiarlos por mensaje. Por eso se atascó la parte B de [[W10]] y por eso se descartaron aurora y el sonido en hilos propios.',
      arreglo: P(
        'Un service worker que agrega esas cabeceras a cada respuesta dentro del navegador (técnica conocida; `credentialless` donde ayude). Con memoria compartida, el dibujo en otro núcleo ([[W10]]) va sin copias, y aurora y el sonido pueden tener hilo propio. Comparación: pasar de mandar cartas entre dos oficinas a trabajar en la misma mesa.',
        'Día 1: ponerlo en el sitio local (`herramientas/sitio-local.mjs`) y comprobar que siguen andando el ingreso con Firebase, los marcos (iframes) y el Worker de R2 (CORS). Riesgo: romper el sitio bajo aislamiento. Llega al sitio real solo por un PR en Paginita-Pro, que el dueño confirma antes (cada vez).'
      ),
      gana: 'abre la puerta a [[W10]] sin copias y a aurora y el sonido en hilos propios; no gana cuadros por sí solo (estimado, sin medir)',
      comprueba: 'el sitio local entero con aislamiento (login, marcos, Worker) y `crossOriginIsolated` en verdadero dentro del marco del juego; después, lo que se construya encima con su propia prueba.',
      refs: 'bitácora §222; herramientas/sitio-local.mjs; terceros/Paginita-Pro',
    },
    {
      id: 'W22', titulo: 'El dibujo retenido: aurora rehecha para la web',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '4–8 semanas (estimado)', fuente: 'sospecha', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'Del dibujo de la gama baja (~10 ms de ~20 por cuadro), esconder todos los modelos ahorra solo 0,6–0,7 ms (bitácora §222): ~9 ms son el esqueleto fijo de cada imagen (el 2D, las copias de imagen, el posproceso y el trabajo base de aurora). Sospecha: miles de órdenes por cuadro que cruzan wasm → JavaScript → Chrome, cada una con su costo, como muchos conectores en un circuito, cada uno con su pequeña caída de tensión.',
      arreglo: 'Que aurora detecte que el cuadro se parece al anterior y repita lo que ya grabó (render bundles de WebGPU), con menos órdenes (menos cambios de recursos, desplazamientos dinámicos en un solo búfer), en vez de armar todo otra vez. Día 1 (horas): medir el esqueleto por partes con los contadores que ya hay (`MKW_CONTADORES`; `perfil-gpu.mjs` cuenta pasadas y dibujos por cuadro) para confirmar la sospecha antes de construir.',
      gana: 'hasta una parte de los ~9 ms del esqueleto (estimado, sin medir; si la sospecha no se confirma, nada)',
      comprueba: 'el esqueleto medido por partes; si se construye, el costo del dibujo por cuadro más bajo en la gama baja simulada (tramo fijo §163, con `--wasm-enforce-bounds-checks`) y la foto igual.',
      refs: 'bitácora §222; web/navegador/perfil-gpu.mjs; mkw_contadores.h; aurora',
    },
    {
      id: 'W23', titulo: 'Los saltos indirectos en línea: `call_ref` y la inline especulativa de V8',
      prio: 'media', aparato: 'ambos', modo: 'ambos', esfuerzo: '2–4 semanas (estimado)', fuente: 'sospecha', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'El código traducido salta mucho por punteros a función. Cada llamada indirecta cuesta cerca del doble que una directa (medido en la prueba chica: 13 → 26 ns, `herramientas/micro-indirectas/`).',
      arreglo: 'El Chrome reciente puede adivinar el destino y ponerlo en línea, pero solo con `call_ref`, no con `call_indirect`. Cambiar cómo el traductor escribe esos saltos. Día 1: la prueba chica de hoy escrita de las dos formas, en Chrome. Tiene que dar la misma carrera (huellas y fantasmas).',
      gana: 'parte del costo de las llamadas indirectas del código traducido (estimado, sin medir)',
      comprueba: 'la prueba chica primero y después el juego, con huellas 75/75 y el fantasma igual; medido en la gama baja simulada y en este PC.',
      refs: 'herramientas/micro-indirectas/; bitácora §193 (las indirectas); parches/motor-w19.diff',
    },
    {
      id: 'W24', titulo: 'OPCIONAL: el teléfono solo dibuja y el PC de la sala calcula por él',
      prio: 'investigar', aparato: 'celular', modo: 'sala', esfuerzo: '3–6 semanas (estimado)', fuente: 'sospecha', banderas: ['medir'],
      pasa: 'Opcional (el dueño, 2026-11-04). En la sala, un teléfono de gama baja no alcanza a simular 60.',
      arreglo: 'En lugar del video ([[N11]]), el PC manda al teléfono la memoria que cambió en cada cuadro (la caja que [[W10]] ya arma, 85–99 KB por cuadro) y el teléfono solo dibuja, nítido a su propia resolución. Precio: mucha más subida que el video; hay que medir primero cuánto se comprime. Solo en la sala. Es una alternativa opcional a [[N11]]; la etapa no la necesita.',
      gana: 'el teléfono de gama baja en la sala a 60 y nítido (estimado, sin medir; depende de la subida)',
      comprueba: 'cuánto se comprime la caja por cuadro y cuánta subida pide; si se construye, un teléfono simulado a 60 en la sala con la huella igual.',
      refs: 'bitácora §207 (la caja de diferencias de W10); docs de N11',
    },
    // ---------- Etapa 4c: las mejoras chicas, juntas ----------
    {
      id: 'W25', titulo: 'Las mejoras chicas, juntas: un paquete medido de una vez y PGO como sello',
      prio: 'media', aparato: 'ambos', modo: 'ambos', esfuerzo: '1–2 semanas (estimado)', fuente: 'medido', banderas: ['recompilar', 'r2', 'medir'],
      pasa: P(
        'Varias mejoras dieron +1 a +6 % y se descartaron porque el ruido de la medición en la gama baja es del mismo tamaño (±5 %): sola, ninguna se distingue de cero. El dueño (2026-11-05): «si acumulas eso, ¿no sería un 30 % con 10 de esos?». Se multiplican (1,03¹⁰ = 1,34), pero hay que saber cuáles son reales.',
        'Las candidatas, todas exactas (la misma carrera): C1 PGO (gama baja +2,2 %, este PC +3,2 %, `.wasm` −8,3 %; §198), C2 texturas BC1 en los PC (gama baja ≈ +6 %; §190.2), C3 tres funciones calientes a mano (Node ×1,010; §181.2), C4 el memo ×4 (Node ×0,993; §193), C5 no releer r14–r31 (lecturas −47 %; §178), C6 el CR seguro (Node ×0,9928; §217) y C7 `wasm-opt -O3` (`.wasm` −2,4 %; §54). Las que perdieron en la gama baja (hojas, FMA, VUELTA32, H11, N3) no entran.'
      ),
      arreglo: P(
        'Medirlas juntas: una suma de +8 % sí sobresale del ruido, como una señal chica que aparece al promediar muchos barridos del osciloscopio. Paso 0: pasar cada una a la base que deje E4b, con su interruptor de compilación y su arranque y fantasma iguales. Paso 1: el paquete C2–C7 con la igualdad entera. Paso 2: el paquete contra la base en la gama baja simulada (tramo fijo §163, `--wasm-enforce-bounds-checks`, N8 apagado) y este PC; 2 pares deciden si ≥ +8 % o ≤ −2 %, hasta 6 en la zona gris, y como todas son exactas se adopta con la media de 6 pares positiva (intervalo del 95 % sobre cero) y este PC sin perder más de 1,5 %.',
        'Paso 3 (opcional): sacar de a una solo las que tienen costo propio (C2 cambia píxeles, C5 toca el traductor). Paso 4: PGO encima, como sello, con el perfil rehecho solo en cada `--final` desde el guion de §165 (así deja de atarse a mano a cada cambio). El detalle en `docs/evaluacion-chicas.md`. W8 modo 2 (la memoria de la tarjeta) va aparte, en el teléfono y la sala.'
      ),
      gana: '+3 a +8 % en la gama baja (estimado; la suma de lo medido daría +8 a +12 % si todo fuera real y no se pisara); seguro, el `.wasm` 8–10 % más chico',
      comprueba: 'arranque 13/13, sala 75/75 con los dos programas, fantasma y foto iguales (la foto con C2 apagado; C2 con `?texturasBc=verifica`); el paquete medido contra la base en la gama baja simulada y en este PC.',
      refs: 'docs/evaluacion-chicas.md; bitácora §54, §178, §181.2, §190.2, §193, §198, §213, §217',
    },
  ],
};
