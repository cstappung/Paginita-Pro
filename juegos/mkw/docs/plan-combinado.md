# Plan combinado (2026-11-07): el de Codex + los gráficos opcionales

Junta la propuesta de Codex (W10, la preparación del cuadro, la traducción nueva, la memoria) con la decisión
del dueño del 2026-11-07: **ajustes gráficos opcionales del jugador** para los aparatos que frena la tarjeta
(«lo importante al final es el gameplay»). Por omisión todo prendido; **siempre 12 karts**. Se empieza
**después del reinicio semanal** (2026-11-08 12:59 UTC). Al retomarlo, pasarlo a `herramientas/plan-rendimiento/`
y al artifact.

**Corrección (2026-11-07, más tarde):** ya estaba medido que la tarjeta **no** frena: en el Oppo trabaja ≈3 ms por
imagen (§173: los 34 ms de §115 eran espera, no trabajo) y en la 3080 Ti 0,16 ms (§158). Lo que frena es la CPU, y
esconder todos los modelos y efectos ahorra solo 0,6–0,7 ms de CPU. Por eso W10 (etapa E) pasa adelante y los
gráficos opcionales (etapa D) quedan en prioridad baja, solo para un aparato que de verdad frene por la tarjeta.
**Orden nuevo:** A (E6) → B (R11) → **E (W10) y F (memoria)** → C (solo el reparto del lado CPU del dibujo) → G y H condicionadas → D (gráficos opcionales) al final. Lo de abajo es el razonamiento original.

**Por qué dos frentes.** Un aparato frena por el procesador (CPU) o por la tarjeta (GPU), como un circuito
limitado por la etapa más lenta. El plan de Codex acelera la CPU; en el teléfono probado frenaba la GPU
(~34 ms por imagen con la interna ya en 640×528, §115), donde ese plan da casi 0 %. Hacen falta los dos.
Los gráficos opcionales sirven igual a un **PC flojo con gráficos integrados** (Intel UHD, AMD Vega de
portátil), que también frena por la tarjeta (el dueño, 2026-11-07).

| Etapa | Qué | Frente | Ganancia esperada | Costo |
|---|---|---|---|---|
| A | ✅ Cerrar E6 (P5, N12, V6, V7) — hecho (§237.14) | — | — | chico |
| B | ✅ R11: la sala con 3 conexiones — hecho en local (§236; Oracle lo configura el dueño) | función | — | medio |
| C | **Medir antes de construir**: C1 qué pasada de la tarjeta pesa (`?perfilGpu=1`, teléfono simulado y, si el dueño puede, el real con «🔬 Perfilar la tarjeta»); C2 repartir los ~10 ms fijos del dibujo en la gama baja (Codex 2, solo la medición); C3 confirmar la proporción cálculo/dibujo (≈50/50) de la que cuelgan las cifras de W10 | diagnóstico | — (decide D, E y G) | días |
| D | **Gráficos opcionales**: D1 interruptores de brillo (bloom), efectos de pantalla (copias de imagen) y sombras simples; D2 texturas reducidas al subir (½, ¼; aurora); D3 menos partículas; D4 un preajuste «Celular liviano»; D5 low poly (mallas simplificadas en la página al cargar, nada del juego a git) **solo si C1 muestra que pesan los vértices** | GPU | depende de C1; cada interruptor se mide solo | medio |
| E | **W10 parte B**: cálculo y dibujo en núcleos distintos, el dibujante continuo; después W11 (efectos y sonido que no deciden la carrera, fuera del hilo) | CPU | +30–80 % sin N8, 0–40 % extra con N8 (Codex; supone CPU limitante) | grande |
| F | Memoria para horas (Codex 4): conservar lo común, preparar la siguiente pista, soltar lo anterior sin saltarse dibujos (sobre W8 `?soltarPipelines=2`); acompaña a D y E | estabilidad | sin fps; evita ~1,1 GB de crecimiento | medio |
| G | Reconstruir la preparación del cuadro (Codex 2) **solo si** C2 encuentra un bloque grande **y** tras E el dibujante es el cuello | CPU del dibujo | +12–29 % (hipótesis) | meses |
| H | Traducción de alto nivel (Codex 3): en la repisa salvo un piloto chico que gane claro (N14, W2, M8 y la FMA no ganaron) | CPU | +5–15 % (hipótesis) | muchos meses |

**Orden y por qué.** A y B primero (terminar lo empezado y las funciones antes que optimizar). C es barato y
decide qué vale la pena. D antes que E porque es más barato y apunta a donde frenó el teléfono. E es la
apuesta grande de CPU. G depende de C2 y de E (con W10 el cuadro dura lo del hilo más lento: recién cuando el
dibujante limita, acelerarlo rinde). H queda condicionada.

**Reglas que siguen:** 12 karts siempre; los ajustes son elección del jugador (por omisión el juego como es);
nada del juego a git; cada ganancia medida en la gama baja simulada y en este PC; veredictos en Chrome.

## Estado al 2026-11-07 17:40 y cómo arranca la etapa E

A y B están hechas. Lo siguiente es **E: W10 parte B** (el dibujo en otro Worker). No se empezó hoy: quedaba 4 % del
uso semanal (se reinicia el 2026-11-08 a las 10:00 de Chile). La arrancada, en orden (detalle en la bitácora §238):

1. **El bucle propio del Worker B** (§207.4, punto 1): B no corre `main()` ni el planificador; tras pegar cada caja llama
   solo a `EGG::SceneManager::draw`, a la copia a la pantalla (`XfbManager::copyEFB`) y a la presentación. Así B nunca
   espera colas ni mutex de hilos de A (lo que lo dejó quieto en la 3.ª vuelta, a los 14 cuadros).
2. **La foto igual**: `MKW_BUILD=build/web-w10c/navegador node web/navegador/prueba-w10-dos.mjs --alto 900,1500 --medir`
   (A y B en el cuadro 900 y 1500, misma imagen) y el tramo fijo con B dibujando al lado.
3. **El aislamiento en el sitio**: la memoria compartida necesita el marco aislado por el service worker de §225
   (`?aislar=sw`, 8/8); sin ella, la caja va por mensaje (83–125 KB y ~0,2 ms por cuadro, §207.2), que ya alcanza.
4. Recién con 1–3 verdes: la sala y los fantasmas con el par A+B, y medir en la gama baja simulada y en este PC.

La plata está ahí: el techo medido es ×2,1 en la gama baja y ×3,5 en este PC (§207.5).
