import { stripTags } from './text.js';

export function parseIni(text) {
  const out = {};
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === ';' || line[0] === '#' || line.startsWith('//')) continue;
    const m = line.match(/^\[(.+)\]$/);
    if (m) {
      section = m[1].trim().toLowerCase();
      out[section] ??= {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    (out[section] ??= {})[key] = value;
  }
  return out;
}

// Devuelve el bloque [song] (o el primero que exista) de un song.ini
export function parseSongIni(text) {
  const ini = parseIni(text);
  return ini.song || ini[Object.keys(ini)[0]] || {};
}

export function iniNum(fields, key, def = null) {
  const v = fields?.[key];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function iniBool(fields, key, def = false) {
  const v = fields?.[key];
  if (v === undefined || v === '') return def;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

// Metadatos normalizados a partir de song.ini y/o el bloque [Song] de un .chart
export function buildMeta(ini = {}, chartSong = {}, folderName = '') {
  const pick = (...vals) => {
    for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    return '';
  };
  let name = pick(ini.name, chartSong.Name);
  let artist = pick(ini.artist, chartSong.Artist);
  if (!name && folderName) {
    const parts = folderName.split(' - ');
    if (parts.length > 1) {
      artist ||= parts[0];
      name = parts.slice(1).join(' - ');
    } else name = folderName;
  }
  const year = pick(ini.year, chartSong.Year).replace(/^[,\s]+/, '');
  return {
    name: stripTags(name) || 'Sin título',
    artist: stripTags(artist) || 'Desconocido',
    album: stripTags(pick(ini.album, chartSong.Album)),
    genre: stripTags(pick(ini.genre, chartSong.Genre)),
    year,
    charter: stripTags(pick(ini.charter, ini.frets, chartSong.Charter)),
    loadingPhrase: stripTags(pick(ini.loading_phrase)),
    icon: pick(ini.icon),
    songLength: iniNum(ini, 'song_length', 0),
    previewStart: iniNum(ini, 'preview_start_time', -1),
    videoStart: iniNum(ini, 'video_start_time', 0),
    playlistTrack: iniNum(ini, 'playlist_track', null),
    diffs: {
      guitar: iniNum(ini, 'diff_guitar', -1),
      bass: iniNum(ini, 'diff_bass', -1),
      rhythm: iniNum(ini, 'diff_rhythm', -1),
      keys: iniNum(ini, 'diff_keys', -1),
      guitarcoop: iniNum(ini, 'diff_guitar_coop', -1),
      drums: iniNum(ini, 'diff_drums', -1),
      band: iniNum(ini, 'diff_band', -1),
    },
  };
}
