# FANAL · trabajo a medias (rama `claude/fanal-sol-sinfin`)

Pedido: tipografía legible · una oleada entre jefes · el Sol como último jefe ·
3 jefes nuevos (Luna, Siete Hermanas/constelación, Sol) · un solo modo, sin fin,
siempre desde cero pero retomable si te desconectas · después del Sol, los jefes
vuelven en fase 2 y 3 · que los jefes no se teletransporten.

## Hecho

- **motor.js**: 20 jornadas (una oleada + un jefe por acto), actos 9–11
  (marea, firmamento, cenit), jefes `luna`, `constelacion`, `sol` en la tabla,
  sin fin cíclico desde la 21 (`CICLO_SINFIN`, `fase` 2 en la primera vuelta y
  3 después, `VIDA_FASE`), `prog.sol`, el punto guarda `perdidas`, `notas`, `u`.
- **prueba.js**: versión 4, un solo modo (`m:"t"`, `k:0`), `FP.nueva(id, u)`,
  `rehace` devuelve también `llamas, mej, brasas, notas` (para retomar).
- **musica.js**: etapas para los actos 9–11 y el Sol.
- **juego.js**: los jefes ya no se teletransportan (`vaivenX`/`objetivoX`).

## Falta (en orden)

1. **motor.js**: guardar `pt.ver` en `mezclaProgreso`
   (`if (r.punto.j > 0 && Number.isInteger(pt.ver)) r.punto.ver = pt.ver;`).
2. **juego.js · modo único y guardado**
   - `nuevaPartida()` sin `modo` ni `M.BRASAS_SINFIN` (ya no existe); agregar
     `llamasJ0, puntosJ0, notasJ0, lucesJ0, uJ, perdidasPend`.
   - `enHistoria()` = `P.jornada <= M.JORNADAS_HISTORIA`.
   - `guardaPunto(j)`: `prog.punto = {j, puntos, llamas, luces, mej, br,
     perdidas, notas, u, ver: FP.VERSION, at}` + `pr` (prueba) si no es legado.
     Llamarlo en `transito` (reemplaza el bloque del punto de control), al final
     de `iniciaJornada` (con `u = P.uJ` capturado antes de `regAbre`) y en
     `golpeFanal` tras perder llama (`perdidas = llamasJ0 − llamas`).
   - `iniciaJornada`: aplicar `P.perdidasPend` tras `regAbre` (`llamas--,
     notas=0, anota("g")`; si llega a 0, `apagaFanal()`).
   - `empieza(guardada)`: si hay guardada, rehacer su prueba (`FP.rehace`,
     J vacío = estado inicial), aplicar `punto.u` con `M.compra`, `P.tiempo =
     r.tiempo/1000`, luego `transito(j)`; si no cuadra → `P.legado`. Si no hay,
     la introducción.
   - `enviaResultados`: categoría siempre `club-fanal-travesia`, borrar
     `prog.punto` al morir o terminar.
   - `cierraGuardada()`: al elegir «Nueva travesía» con una guardada, mandar su
     resultado y borrarla.
   - Al arrancar, descartar `prog.punto` con `ver !== FP.VERSION`.
   - Portada: «Seguir la travesía · jornada N» / «Nueva travesía», sin botón
     sin fin. Fin: sin «Volver a encender» ni «sin fin». Pausa: «Salir (se
     guarda)» → `aPortada()` y «Terminar la travesía» → envía y `muestraFin()`.
   - `pintaHud`: «AL ALBA · N», luego «AL SOL · N», «EL SOL», después la fase.
   - `etapaMusical`: `/4` → `/2`. Fin «Lumbres acogidas» con `completadas >= 7`.
   - `__fanal.salta(n)` y `desbloquea` (con `prog.sol`).
3. **juego.js · jefes nuevos**: `luna`, `constelacion`, `sol` (inicio en
   `empiezaJefe`, caja, entrada, `actualizaJefe`, `dibujaJefe`, luces), y
   `finalSol()` (como `finalHoguera`) desde `muereJefe`; cartel `PARTE_TRES`
   en la 15 y `R.AVISO_SOL`.
4. **juego.js · fases 2/3**: jefe más grande (×1.2/×1.35), tinte carmesí, aura
   con púas; fase ≥2 escamas en eco espejado; fase 3 tres espinas orbitando
   (bloquean balas, `anota("V")`) y anillos de choque bajo 30 % de vida.
5. **juego.js · oleadas 9–11**: `j.marea` (la formación sube y baja) y
   `j.fugaces` (estrellas en diagonal); velocidades/nubes/motas de los actos.
6. **relato.js**: intro, bitácora de 20, `JEFES.luna/constelacion/sol`,
   `AVISO_SOL`, actos 9–11, `PARTE_TRES` («LO ALTO»), `FINAL_SOL`,
   reescribir `FINAL_HOGUERA` (ya no es «sin fin»), cartas de los actos 9–11.
7. **sprites.js**: paletas 9–11, sprites de los tres jefes, variantes de fase.
8. **estilo.css + index.html**: Atkinson Hyperlegible (`--pixel`) y Cinzel
   (`--gotica`) en lugar de Pixelify Sans / Jacquarda Bastarda 9; skins
   `data-acto` 9–11; botones; subir los `?v=fanal-N` de cada archivo tocado.
9. **Resto**: `colabtex/src/juegos/solo/club.js` `club-45` → `club-46` y
   `npm run build`; `colabtex/tests/fanal.test.cjs`; verificador
   `colabtex/src/juegos/solo/verifica/fanal.js` (PRUEBA 4, sin sin fin);
   `docs/antitrampas/fanal.md`; manual en `reglas.js`; sección FANAL de
   CLAUDE.md. Probar en `localhost:8123` con `window.__fanal`.

Borrar este archivo cuando esté todo.
