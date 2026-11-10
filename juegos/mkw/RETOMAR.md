# Retomar — dónde quedó el plan de rendimiento v4 (al día el 2026-11-08)

**2026-11-08 19:30 (Chile), la planilla sobre `build/web-e6-w29` (§246):** 706 bien, 29 mal en 10 pruebas; ninguna falla nueva de W29. Arreglado: `prueba-relevo` (miraba el árbitro al revés) y un error del árbitro en `lockstep.mjs` (sala de dos quieta 44 s si el otro cerraba en la cuenta): desconexion 95/0. Abierto: la caída del motor al salir de una sección (sala al volver a elegir, a veces la copa; §203, diagnóstico en §246: salto a 0 en `GroupContainer::__dt` desde el gancho de RR `rr_kamek_8185F920`), conviene antes de abrir salas; la espera de B con árbitro (hasta 9 ms por cuadro, §246.3); `sala-doce` (V7); `texturas-bc` no viene en ese programa; `w10-dos` es de E7.

**2026-11-08 15:20 (Chile), cierre de los ítems a medias (§241–§245):** R11, E1, E2, N2 y W29 hechos; N15 hecho y P9 descartado (ya lo estaban). El programa final más nuevo es `build/web-e6-w29` (W29 adoptada: `--final` = `--memoria-fija 768`); antes de subirlo falta `correr-todo.mjs`. Falta en el teléfono (lo hace el dueño al final): la escalera y la tarjeta en el Oppo, el calor en una copa (`?calor=1`), el ahorro de Android y la reserva de 768 MB. Abierto aparte: `prueba-sala --rapida` falla en M22 desde la línea del motor (§203). Solo quedan en curso W10 y la etapa 7 (`e7-combinado`).

**2026-11-08 04:20 (Chile):** E6 cerrada (§237.14). **W29 hecho** (§239, 4e2a0ef): memoria fija de 1024 MB = gama baja simulada +14,6 %, este PC igual; falta probar 512 MB y el teléfono real antes de adoptarla. **W10 parte B en curso** (§240): B con su propio bucle dibuja la carrera de A con la foto igual al píxel, pero con A sin dibujar el par se traba en el cuadro 263 (B colgado dentro del dibujo del juego). Siguen en E7: W26, V8, W27/W28, G11–G14 (`docs/plan-combinado.md`); R11 a medias. Teléfono real: `herramientas/telefono-seguro.mjs`.

## Qué está hecho

| Etapa | Estado |
|---|---|
| E0 (pilotos) | cerrada, §194–§206 |
| E1 (el dibujo en otro núcleo) | cerrada, §207–§210 (W11 +28 % gama baja) |
| E2 (el motor) | cerrada, §211–§218 (H6 + M7 adoptados) |
| E3 (N8: lógica a 60, dibujo a 30 + interpolación opcional) | cerrada, §219 y §221: N8 hecho, opcional y apagado por omisión (`?n8=1|2|auto`); gama baja +34–47 % de lógica |
| E4 (las islas) | cerrada, §222: ningún techo de dibujo pasa el 5 % (esconder todo ahorra solo 0,6–0,7 ms); W15/W16 bajan de prioridad, W17 y W18 descartados; no se construyó ninguna isla |
| E4b (lo ambicioso, agregada el 2026-11-04 por pedido del dueño) | cerrada el 2026-11-05 (§224–§226): W22 descartado (las llamadas a WebGPU son 0,17–0,19 ms de 10,7 por imagen: lo caro es aurora armando la lista y el dibujo del juego), W23 descartado (`call_ref` pierde 20–52 % en Chrome, que ya pone en línea `call_indirect`), W21 anda en el sitio local (8/8, `?aislar=sw`, apagado) y por sí solo no gana (−4,5 % / −3,4 %, ruido); seguir con W21 pide el PR del sitio y semanas de hilos (decisión del dueño); W24 matado por su puerta el 2026-11-05 (§227, «solo si es que sirve»: la caja achicada pide 20–27 Mbit/s por teléfono, la puerta era ~3; sin opción en Gráficos; queda el medidor y la parte B como parche) |
| E4c (las mejoras chicas juntas, agregada el 2026-11-05 por pedido del dueño) | medida el 2026-11-05 (§228): el paquete C2+C3+C4+C7 no gana (−0,3 % ± 9, no se adopta); PGO sobre la base: igualdad entera, `.wasm` −8,9 %, gama baja +7,5 % (intervalo −0,2 a +15,3), este PC +1,1 % → **adoptado** (§228.2): `--final` arma o reusa el perfil solo (`pgo_final.py`), el final 102,4 MB, 13/13, 75/75; **cerrada**; subir el `.wasm` a R2 es del dueño |
| E5 → E6 → ítems a medias (encadenadas el 2026-11-05 por el dueño) | **E5 cerrada** (8fd6d25, §229–§230): N11 matado por su puerta, R4 hecho (igual byte a byte; en Chrome no se nota). Para el dueño: ¿árbitro por omisión? E6 (`e6-final`) sigue; luego `a-medias` (W10, paso4.1, paso7.1) |
| E6 | **Cerrada el 2026-11-07** (§237.14): P5, N12, V6 y V7 hechos con lo medido. Host de doce: PC a 60, el teléfono simulado flojo sale sin frenar a nadie. La memoria de vídeo +1,36 GB/h pasa a W26 (E7). Para después: V7 con el teléfono calibrado al Oppo (`lastre=1.7`) y en PC separados |

## E2, ítem por ítem

| Ítem | Resultado |
|---|---|
| H6 (la RAM de la Wii en una ventana fija) | adoptado, gama baja +29 % (§211) |
| H7 | descartado (§212) |
| M6 (PGO) | descartado |
| M7 (ThinLTO) | hecho, gama baja +8,6 % (§213) |
| H11 (código frío pequeño) | descartado, −1,4 % (§214) |
| W12 (la pila de la Wii) | descartado: el techo no se distingue del ruido (§215) |
| W13 (el contexto en lugar fijo) | descartado por su techo (§216) |
| W14 (banderas CR perezosas) | descartado (§217): pierde 9–11 % en este PC aun en su techo |
| Cierre de E2 | hecho (§218): `build/web-e2` sala 75/75, fantasmas iguales, arranque 13/13; cómo juntar `e2-h6` con W10 en §218 |

## Cómo se sigue

1. Para seguir con E5, decírselo a la orquestadora. Idea para después, no en el plan: estudiar por qué W14 pierde en este PC.
2. N8 en «Automático» por omisión: lo permitió el dueño el 2026-11-04 (la sesión E3 lo está dejando así, con sus pruebas).
3. Las reglas de siempre siguen valiendo: 12 karts, nada del juego a git, sin el programa nativo, 2 pares de Chrome si el resultado es claro.

Las sesiones: E2 = «E2: el motor (plan de rendimiento v4)», E3 = «E3: lógica a 60, dibujo a 30», E4 = «E4: las islas decompiladas». E3 y E4 ya cerraron.
El plan publicado: https://claude.ai/artifact/Ra7WusxMirhWmobs7aNWSo
