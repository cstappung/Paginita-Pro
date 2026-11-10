# 🏁 JloKart Wii v2.0

**Mario Kart Wii + Retro Rewind, entero en el navegador.** Sin emulador ni nada que instalar.
Corre en Chrome y Edge, en el escritorio y en Android.

> Versión **2.0** · commit nº **237** del motor MKW RETRO (`4937668`) · empezado el 2026-10-18

---

## Cómo funciona

```
 Disco de la Wii ──► traductor (PowerPC → C++) ──► WebAssembly ──► WebGPU ──► tu pantalla
   (privado, R2)        WiiCompiled + parches           13,7 MB comprimido     aurora
```

- **Traducción estática, no emulación.** Cada función del juego pasa de PowerPC a C++ una sola vez y se compila a
  WebAssembly. El navegador corre ese código directo.
- **60 cuadros de lógica por segundo, siempre 12 karts.** Nunca se quitan rivales ni efectos para ganar velocidad: el
  rendimiento se gana optimizando el motor y la página.
- **Lo de Nintendo y Retro Rewind no está en ningún repositorio.** Se sirve privado desde R2, detrás del Worker de
  amigos. Lo que se publica es solo nuestro código: la página, la sala y la red.

## En números

| | |
|---|---|
| Días de trabajo | ~3 semanas (2026-10-18 → 2026-11-10) |
| Commits | 237 |
| Bitácora | 263 secciones, 1,8 MB: cada paso explicado, con su comando y su resultado |
| Plan de rendimiento | 152 ítems y sus criterios: más de 100 hechos y ~85 descartados, cada uno con su porqué y su medición |
| Código propio | ~35.000 líneas (página y ganchos del juego) |
| Bancos de prueba | 78 páginas con ✓/✗ y datos de mentira |
| Pruebas con el juego | 45 (Playwright: una pestaña, la sala, 12 ventanas) |
| Herramientas | 162 (medir, compilar, publicar) |

## Lo que trae

**🌐 Salas de hasta 12** (las abre esta versión)
- Copa o playlist; 150cc, 100cc, espejo o azar; CPU fácil, normal, difícil, máximo, intenso o imposible.
- **Lockstep:** todas las consolas corren exactamente la misma carrera y lo comprueban con una huella cada 30 cuadros.
- **Largada pareja:** el «¡YA!» sale en el mismo cuadro en todas.
- **Un lento no frena a los demás:** el árbitro y el relevo lo sostienen y se pone al día solo.
- VR como en el juego original, puntos, descanso de 30 s, parrilla según la llegada, «Echar» y volver tras recargar.

**🎮 Para jugar cómodo**
- Bienvenida «Ajusta el juego a tu aparato» y la Ayuda de ajustes, con recetas por tipo de jugador.
- Teclado, varios mandos a la vez y el celular con mando táctil editable e inclinación.
- Reasignar todos los botones, el dibujo del mando, mandos de Switch 2 y genéricos.
- Imagen elegible en plena carrera: Automático, 30 parejas, 60 o con imagen intermedia.
- Gráficos livianos opcionales, la casilla de los avisos de lag y borrar por partes lo guardado en el navegador.
- Contrarreloj contra el mejor fantasma de la página, trofeos y los 6 Mii invitados.

## El rendimiento, medido

Todo se midió en el peor caso, la gama baja simulada en el «tramo fijo» de una carrera de 12 CPU, y en este PC como
control. Una mejora entra solo si gana con claridad y la carrera sigue idéntica.

| Qué | Resultado |
|---|---|
| W30: las cuentas de WebAssembly en vez de imitar la Wii al último bit | entre +3 y +8 % de CPU, la misma carrera en todas las consolas |
| N8: dibujar a 30 y mostrar 60 (automático) | gama baja +30–47 % de lógica |
| Memoria fija, anillos de subida, pipelines por pista, PGO | menos trabas, menos megas por imagen, menos espera al largar |
| Descargas | 1.ª visita 92 llamadas al Worker (eran ~1.400); 2.ª visita 16; **0 durante la carrera** |
| El 1 % más lento de las imágenes, a 60 | 87 → 92 % |
| Sonido | ~60 ms del juego al parlante (eran ~177) |

**Lo que se probó y se descartó** también queda escrito, con números. Algunos casos:
- la IA a 30 Hz: las CPU manejan peor;
- la caché de listas de dibujo: el techo es muy bajo;
- el dibujo en otro núcleo: salía más lento;
- el video desde un PC: demasiada demora.

## Probado antes de publicar

- La planilla completa contra el programa final: sincronía, fantasmas y desconexiones.
- **12 jugadores, cada uno en su Chrome con la caché vacía:** entran desde la página, largan en el mismo cuadro y corren
  con las huellas iguales. Con una ventana frenada a ×4, las otras 11 siguen a su ritmo.

## Falta

- La prueba en celulares reales. El dueño la hace al final.
- El mando de Switch 2 con un mando de verdad.
- Para la próxima: el panel de récords con buscador, menos llamadas a R2, el banner y las miniaturas.

---
*Hecho con [Claude Code](https://claude.com/claude-code). Detalle completo en `docs/bitacora.md` y `docs/plan-rendimiento.md`.*
