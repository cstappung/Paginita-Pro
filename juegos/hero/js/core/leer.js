// Lee una canción a partir de los bytes de su chart (.chart o .mid) y de su
// song.ini. Lo usan library.js al jugar y la página de Juegos al verificar un
// récord (colabtex/src/juegos/hero.js): tienen que leer exactamente lo mismo.
import { parseSongIni } from './ini.js';
import { decodeText } from './text.js';
import { parseSongFile } from './songParser.js';

export function leeCancion(chartFile, chartBytes, iniBytes) {
  const ini = iniBytes ? parseSongIni(decodeText(new Uint8Array(iniBytes))) : {};
  const song = parseSongFile(chartFile, new Uint8Array(chartBytes), ini);
  song.ini = ini;
  return song;
}
