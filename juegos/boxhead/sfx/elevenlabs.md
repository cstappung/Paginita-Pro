# Efectos grabados de Pro BoxHead (ElevenLabs)

Las tomas elegidas, todas del flow `kLpCB7wXxkzSQReCbM1P`
(`eleven_text_to_sound_v2`), ya descargadas como `<clave>-1.mp3`. Se
procesaron así:

- mono a 96 kbps;
- sin el silencio del comienzo;
- cortadas donde caen 45 dB bajo su máximo, con un fundido al final.

Algunas llevan además un corte a mano, para que no llenen las `VOCES`:

| clave | se usa | dura |
|---|---|---|
| dolor | solo el primer quejido | 0,15 s |
| chatarra | el primer tintineo | 0,45 s |
| escopeta | | 1,3 s |
| compra | | 1,5 s |
| lanza | | 0,35 s |
| pistola | | 0,55 s |
| uzi | | 0,25 s |
| impacto | | 0,3 s |
| baja | | 0,55 s |
| bajaDiablo | | 0,7 s |
| rebote | | 0,5 s |

Para rehacer un archivo, el original sale de
`creative_get_flow_run_status(flow, [sesión])`. Su `GAN` en `js/audio.js` se
vuelve a medir (ver `../CLAUDE.md`).

| clave | generación | sesión | nota |
|---|---|---|---|
| pistola | p5SL5n2xHwOcpXiKEwRg | | |
| uzi | uXNnLnErIb9TrXqETCKM | | |
| boom | WmV8GV9dXnjSFymcZhSN | | |
| escopeta | q9B0x8zZ4eunSRdDi5e0 | | |
| cohete | NG7N1DC1zRsMwhth3uxJ | | |
| lanza | XvSqZizbUjIyh472RyNX | | |
| rebote | pFaPxhFObznlBh4lDaAe | | |
| pon | MO9S3QOScb4Y47tlWeGK | | |
| impacto | 43SiXvrB2TRqYUBXPOl6 | | |
| baja | DFXiekjUX7PcAF7OCPNP | | |
| bajaDiablo | PQqXBzIyaKPbaXTmBThf | | |
| gemido | LqS1i71QnONsH5soEcbn | Tno2PR7A3kFzHbkO5Xn1 | |
| grunido | gVjheA8L7Mt30ofJF1cT | XhV0f2jjL16xXi5FsEp4 | |
| mordida | eTAoEzxrNbPXsAfNLrZJ | XtxuE9lyfLBxz9YvoEha | |
| dolor | NvTa0DUwluryvCEYibsy | h4Bis6yxF3MGDZgLIqU2 | |
| muere | 50QTjCGf7sONmJAXg9Ph | NL6NrcK0G5vuGiWekHnK | 0,48 s |
| recoge | LdsGtA6HirGI0so7Qd38 | S32Aada1UBNxuHyjO3xn | |
| fuego | UADdmPI95Kxl6XrEW8XS | PLnj4O307J1MP6uIFbCN | |
| acido | MUvhpRp2wgaXf0udreEi | kwtotQQEkkzvPkgDQjSB | |
| golpe | IVOGqXCPJLQzHgYxKajB | vUvpgmnIEXIfMnZEPcaS | |
| jefe | 2ZqKVyQpsOoTr1EdOtCy | Vw2wXAeFLlOW1YHli3cq | |
| premio | WepZpUzEzzT8yZCRwKa9 | 3RX3hxFH8I4EMVsExtMW | |
| compra | 8lfgKU1g9PUE8geuTKsC | 11Z99dnb72hupCtC7ZWk | 5 s, quizás recortar |
| mejora | ecuWNPBJLGcqKXQPXfBh | 7Xyoh0SfNb21dbZqTgju | |
| nivel | 0HdL5yu9YkPdaUZd1SHX | lMymoc5v7PY0qw1NIGLY | 0,48 s |
| chatarra | pZkB0A3NrzGY6aRKGm9r | DH7AFEBSc14saDkDEvvk | |
| racha | GcR13puSNSxnF7gJYsMr | G4MhUmWcOQhm4DZg0bqX | 0,48 s |
| avisoCombo | O7lhp6Ys13Bm3hzN5ToI | QPSkObQBszwW3cSjj6I5 | 2 s, segunda toma (la elegida) |
| quedan | lOKQFlRgGTXPjZ4BwbwZ | qQzipbDrDEpMpgs2CJXq | ~1 s, segunda toma (la elegida) |

Las primeras once se generaron antes de anotar la sesión. Su sesión se lee en
el flow (`creative_get_flow`) o con `creative_get_generations`.
