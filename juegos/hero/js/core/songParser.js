// Convierte notes.chart / notes.mid en un modelo de canción jugable,
// replicando las reglas de Clone Hero (HOPOs naturales, forzados, taps, opens,
// star power, solos, batería pro / 5 carriles).
import { TempoMap } from './tempoMap.js';
import { parseMidi } from './midiFile.js';
import { decodeText } from './text.js';
import { iniNum, iniBool } from './ini.js';
import { NOTE_STRUM, NOTE_HOPO, NOTE_TAP } from './constants.js';

export const popcount = (m) => {
  let c = 0;
  while (m) {
    c += m & 1;
    m >>= 1;
  }
  return c;
};

// ---------- Utilidades de rangos [start, end) en ticks ----------
function sortRanges(ranges) {
  return ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
}

function inRanges(ranges, tick) {
  if (!ranges || !ranges.length) return false;
  let lo = 0, hi = ranges.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ranges[mid].start <= tick) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  for (let i = idx; i >= 0 && i >= idx - 3; i--) if (tick >= ranges[i].start && tick < ranges[i].end) return true;
  return false;
}

function firstNoteAtOrAfter(notes, tick) {
  let lo = 0, hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].tick < tick) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Asigna a cada nota el índice de la frase (SP) o solo que la contiene
function assignRanges(notes, ranges, field, tempo) {
  const out = [];
  for (const r of sortRanges(ranges)) {
    let i = firstNoteAtOrAfter(notes, r.start);
    const first = i;
    let count = 0;
    const idx = out.length;
    for (; i < notes.length && notes[i].tick < r.end; i++) {
      if (notes[i][field] !== -1) continue;
      notes[i][field] = idx;
      count++;
    }
    if (count) out.push({ start: tempo.tickToSec(r.start), end: tempo.tickToSec(r.end), first, count });
  }
  return out;
}

// ---------- Construcción de pistas de 5 trastes ----------
export function buildGuitarTrack(src, tempo) {
  const gems = src.gems.slice().sort((a, b) => a.tick - b.tick || a.lane - b.lane);
  const groups = [];
  for (const g of gems) {
    if (!(g.lane === 7 || (g.lane >= 0 && g.lane < 5))) continue;
    let grp = groups[groups.length - 1];
    if (!grp || grp.tick !== g.tick) {
      grp = { tick: g.tick, frets: 0, open: false, lens: new Map() };
      groups.push(grp);
    }
    const len = g.len > src.susCutoff ? g.len : 0;
    if (g.lane === 7) grp.open = true;
    else grp.frets |= 1 << g.lane;
    grp.lens.set(g.lane, Math.max(len, grp.lens.get(g.lane) || 0));
  }

  const notes = [];
  let prev = null;
  for (const grp of groups) {
    if (grp.open && grp.frets) {
      grp.open = false;
      grp.lens.delete(7);
    }
    const tick = grp.tick;
    const isChord = popcount(grp.frets) > 1;
    let natural = false;
    if (prev && !isChord && tick - prev.tick <= src.hopoThreshold) {
      if (grp.open) natural = !prev.open;
      else natural = prev.open || (prev.frets & grp.frets) === 0;
    }
    let type = natural ? NOTE_HOPO : NOTE_STRUM;
    if (src.forceFlip?.has(tick)) type = type === NOTE_HOPO ? NOTE_STRUM : NOTE_HOPO;
    if (inRanges(src.forceHopo, tick)) type = NOTE_HOPO;
    if (inRanges(src.forceStrum, tick)) type = NOTE_STRUM;
    if (!grp.open && (src.tapTicks?.has(tick) || inRanges(src.tap, tick))) type = NOTE_TAP;

    // Sostenidos: agrupa trastes con la misma duración (permite "extended sustains")
    const byLen = new Map();
    for (const [lane, len] of grp.lens) {
      if (len <= 0) continue;
      const bit = lane === 7 ? 0 : 1 << lane;
      byLen.set(len, (byLen.get(len) || 0) | bit);
    }
    const time = tempo.tickToSec(tick);
    const sus = [...byLen].map(([len, mask]) => ({
      mask,
      endTick: tick + len,
      endTime: tempo.tickToSec(tick + len),
    }));
    const endTime = sus.reduce((m, s) => Math.max(m, s.endTime), time);
    notes.push({
      tick, time, frets: grp.frets, open: grp.open, type,
      gems: grp.open ? 1 : popcount(grp.frets),
      sus, endTime, sp: -1, solo: -1,
    });
    prev = grp;
  }

  const spPhrases = assignRanges(notes, src.sp || [], 'sp', tempo);
  const solos = assignRanges(notes, src.solos || [], 'solo', tempo);
  return { kind: 'guitar', notes, spPhrases, solos };
}

// ---------- Construcción de pistas de batería ----------
// pad: -1 = bombo, 0..lanes-1 = parches de izquierda a derecha
export function buildDrumTrack(src, tempo) {
  const seen = new Set();
  const notes = [];
  for (const g of src.gems.slice().sort((a, b) => a.tick - b.tick || a.pad - b.pad)) {
    const key = g.tick * 8 + g.pad + 1;
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push({
      tick: g.tick,
      time: tempo.tickToSec(g.tick),
      pad: g.pad,
      cymbal: !!g.cymbal,
      double: !!g.double,
      sp: -1,
      solo: -1,
    });
  }
  const spPhrases = assignRanges(notes, src.sp || [], 'sp', tempo);
  const solos = assignRanges(notes, src.solos || [], 'solo', tempo);
  return { kind: 'drums', lanes: src.lanes, pro: src.pro, notes, spPhrases, solos };
}

function hopoThresholdFor(ini, res, isMidi) {
  const freq = iniNum(ini, 'hopo_frequency', 0);
  if (freq > 0) return freq;
  if (iniBool(ini, 'eighthnote_hopo')) return Math.floor(res / 2);
  return isMidi ? Math.floor((170 * res) / 480) : Math.floor((65 * res) / 192);
}

function finishSong(song) {
  let end = 0;
  for (const part of Object.values(song.parts)) {
    for (const tr of Object.values(part)) {
      const last = tr.notes[tr.notes.length - 1];
      if (last) end = Math.max(end, last.endTime ?? last.time);
    }
  }
  song.endTime = end;
  song.beats = song.tempo.beatLines(Math.ceil(song.tempo.secToTick(end + 10)));
  // Marcadores de nácar en el mástil (patrón de guitarra real: 3, 5, 7, 9 y doble en 12)
  song.inlays = [];
  const measures = song.beats.filter((b) => b.measure);
  for (let m = 0; m + 1 < measures.length; m++) {
    const k = (m % 12) + 1;
    if (![3, 5, 7, 9, 12].includes(k)) continue;
    song.inlays.push({ time: (measures[m].time + measures[m + 1].time) / 2, double: k === 12 });
  }
  return song;
}

// ======================= .chart =======================
const CHART_DIFF = { Expert: 'expert', Hard: 'hard', Medium: 'medium', Easy: 'easy' };
const CHART_INST = {
  Single: 'guitar', DoubleGuitar: 'guitarcoop', DoubleBass: 'bass',
  DoubleRhythm: 'rhythm', Keyboard: 'keys', Drums: 'drums',
};

export function parseChartSections(text) {
  const sections = {};
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] === '[' && line.endsWith(']')) {
      cur = sections[line.slice(1, -1).trim()] = [];
      continue;
    }
    if (line === '{' || line === '}') continue;
    if (cur) cur.push(line);
  }
  return sections;
}

export function chartSongFields(sections) {
  const out = {};
  for (const line of sections.Song || []) {
    const m = line.match(/^(\w+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '').trim();
  }
  return out;
}

const TRACK_LINE = /^(\d+)\s*=\s*([A-Za-z]+)\s*(.*)$/;

export function parseChart(text, ini = {}) {
  const S = parseChartSections(text);
  const fields = chartSongFields(S);
  const res = Number(fields.Resolution) || 192;
  const offset = ini.delay !== undefined && ini.delay !== ''
    ? (iniNum(ini, 'delay', 0) / 1000)
    : Number(fields.Offset) || 0;

  const tempos = [];
  const timeSigs = [];
  for (const line of S.SyncTrack || []) {
    const m = line.match(TRACK_LINE);
    if (!m) continue;
    const tick = +m[1];
    const vals = m[3].trim().split(/\s+/).map(Number);
    if (m[2] === 'B' && vals[0] > 0) tempos.push({ tick, uspq: 6e10 / vals[0] });
    else if (m[2] === 'TS') timeSigs.push({ tick, num: vals[0], den: 2 ** (Number.isFinite(vals[1]) ? vals[1] : 2) });
  }
  const tempo = new TempoMap(res, tempos, timeSigs, offset);

  const sections = [];
  for (const line of S.Events || []) {
    const m = line.match(TRACK_LINE);
    if (!m || m[2] !== 'E') continue;
    const txt = m[3].replace(/^"|"$/g, '').trim();
    const sm = txt.match(/^section\s+(.*)$/);
    if (sm) sections.push({ time: tempo.tickToSec(+m[1]), name: sm[1].replace(/_/g, ' ') });
  }

  const hopoThreshold = hopoThresholdFor(ini, res, false);
  const susCutoff = Math.max(0, iniNum(ini, 'sustain_cutoff_threshold', 0));
  const parts = {};

  for (const [name, lines] of Object.entries(S)) {
    const m = name.match(/^(Expert|Hard|Medium|Easy)(Single|DoubleGuitar|DoubleBass|DoubleRhythm|Keyboard|Drums)$/);
    if (!m) continue;
    const diff = CHART_DIFF[m[1]];
    const inst = CHART_INST[m[2]];
    const sp = [];
    const solos = [];
    let soloStart = -1;
    let track;

    if (inst === 'drums') {
      const raw = [];
      const cym = new Map();
      let five = false;
      for (const line of lines) {
        const lm = line.match(TRACK_LINE);
        if (!lm) continue;
        const tick = +lm[1];
        const [a, b] = lm[3].trim().split(/\s+/).map(Number);
        if (lm[2] === 'N') {
          if (a === 0) raw.push({ tick, n: 0 });
          else if (a >= 1 && a <= 5) {
            raw.push({ tick, n: a });
            if (a === 5) five = true;
          } else if (a === 32) raw.push({ tick, n: 0, double: true });
          else if (a >= 66 && a <= 68) cym.set(tick * 8 + (a - 64), true);
        } else if (lm[2] === 'S' && a === 2) sp.push({ start: tick, end: tick + Math.max(1, b || 0) });
        else if (lm[2] === 'E') {
          const t = lm[3].trim();
          if (t === 'solo') soloStart = tick;
          else if (t === 'soloend' && soloStart >= 0) {
            solos.push({ start: soloStart, end: tick + 1 });
            soloStart = -1;
          }
        }
      }
      const lanes = five ? 5 : 4;
      const pro = cym.size > 0 && !five;
      const gems = raw.map((r) => ({
        tick: r.tick,
        pad: r.n === 0 ? -1 : r.n - 1,
        double: r.double,
        cymbal: pro && r.n >= 2 && r.n <= 4 && cym.has(r.tick * 8 + r.n),
      }));
      track = buildDrumTrack({ gems, lanes, pro, sp, solos }, tempo);
    } else {
      const gems = [];
      const forceFlip = new Set();
      const tapTicks = new Set();
      for (const line of lines) {
        const lm = line.match(TRACK_LINE);
        if (!lm) continue;
        const tick = +lm[1];
        const [a, b] = lm[3].trim().split(/\s+/).map(Number);
        if (lm[2] === 'N') {
          if ((a >= 0 && a <= 4) || a === 7) gems.push({ tick, lane: a, len: b || 0 });
          else if (a === 5) forceFlip.add(tick);
          else if (a === 6) tapTicks.add(tick);
        } else if (lm[2] === 'S' && a === 2) sp.push({ start: tick, end: tick + Math.max(1, b || 0) });
        else if (lm[2] === 'E') {
          const t = lm[3].trim();
          if (t === 'solo') soloStart = tick;
          else if (t === 'soloend' && soloStart >= 0) {
            solos.push({ start: soloStart, end: tick + 1 });
            soloStart = -1;
          }
        }
      }
      track = buildGuitarTrack({ gems, forceFlip, tapTicks, sp, solos, hopoThreshold, susCutoff }, tempo);
    }
    if (track.notes.length) (parts[inst] ??= {})[diff] = track;
  }

  return finishSong({ format: 'chart', resolution: res, tempo, sections, parts, chartFields: fields });
}

// ======================= .mid =======================
const MID_TRACKS = {
  'PART GUITAR': 'guitar', 'T1 GEMS': 'guitar', 'PART GUITAR COOP': 'guitarcoop',
  'PART BASS': 'bass', 'PART RHYTHM': 'rhythm', 'PART KEYS': 'keys',
  'PART DRUMS': 'drums', 'PART DRUM': 'drums',
};
const MID_BASE = { expert: 96, hard: 84, medium: 72, easy: 60 };
const SYSEX_DIFF = { 0: 'easy', 1: 'medium', 2: 'hard', 3: 'expert' };

function noteRanges(notes, num) {
  const out = [];
  for (const n of notes) if (n.note === num) out.push({ start: n.tick, end: Math.max(n.end, n.tick + 1) });
  return sortRanges(out);
}

// Rangos de SysEx de Phase Shift: F0 50 53 00 00 <dif> <tipo> <on/off> F7
function sysexRanges(track) {
  const out = {};
  const openAt = {};
  for (const s of track.sysex) {
    const d = s.data;
    if (d.length < 7 || d[0] !== 0x50 || d[1] !== 0x53 || d[2] !== 0 || d[3] !== 0) continue;
    const diffs = d[4] === 0xff ? ['easy', 'medium', 'hard', 'expert'] : [SYSEX_DIFF[d[4]]];
    for (const diff of diffs) {
      if (!diff) continue;
      const key = `${diff}:${d[5]}`;
      if (d[6]) openAt[key] = s.tick;
      else if (openAt[key] !== undefined) {
        (out[key] ??= []).push({ start: openAt[key], end: Math.max(s.tick, openAt[key] + 1) });
        delete openAt[key];
      }
    }
  }
  for (const k in out) out[k] = sortRanges(out[k]);
  return out;
}

export function parseMid(bytes, ini = {}) {
  const mid = parseMidi(bytes);
  const res = mid.division || 480;
  const offset = iniNum(ini, 'delay', 0) / 1000;

  const tempos = [];
  const timeSigs = [];
  for (const tr of mid.tracks) {
    tempos.push(...tr.tempos);
    timeSigs.push(...tr.timeSigs);
  }
  const tempo = new TempoMap(res, tempos, timeSigs, offset);

  const sections = [];
  const events = mid.tracks.find((t) => t.name === 'EVENTS');
  for (const t of events?.texts || []) {
    const m = t.text.trim().match(/^\[?(?:section|prc)[ _](.*?)\]?$/);
    if (m) sections.push({ time: tempo.tickToSec(t.tick), name: m[1].replace(/_/g, ' ') });
  }

  const hopoThreshold = hopoThresholdFor(ini, res, true);
  const susCutoff = ini.sustain_cutoff_threshold !== undefined && ini.sustain_cutoff_threshold !== ''
    ? Math.max(0, iniNum(ini, 'sustain_cutoff_threshold', 0))
    : Math.floor(res / 3);
  const spNote = iniNum(ini, 'multiplier_note', 116) === 103 ? 103 : 116;
  const parts = {};

  for (const tr of mid.tracks) {
    const inst = MID_TRACKS[tr.name.toUpperCase()];
    if (!inst || parts[inst]) continue;
    const sp = noteRanges(tr.notes, spNote);
    const solos = spNote === 103 ? [] : noteRanges(tr.notes, 103);

    if (inst === 'drums') {
      const five = iniBool(ini, 'five_lane_drums') || tr.notes.some((n) => n.note === 101);
      const lanes = five ? 5 : 4;
      const pro = !five && iniBool(ini, 'pro_drums');
      const toms = { 1: noteRanges(tr.notes, 110), 2: noteRanges(tr.notes, 111), 3: noteRanges(tr.notes, 112) };
      for (const [diff, base] of Object.entries(MID_BASE)) {
        const gems = [];
        for (const n of tr.notes) {
          const o = n.note - base;
          if (o === 0) gems.push({ tick: n.tick, pad: -1 });
          else if (diff === 'expert' && n.note === 95) gems.push({ tick: n.tick, pad: -1, double: true });
          else if (o >= 1 && o <= lanes) {
            const pad = o - 1;
            const cymbal = pro && pad >= 1 && pad <= 3 && !inRanges(toms[pad], n.tick);
            gems.push({ tick: n.tick, pad, cymbal });
          }
        }
        if (!gems.length) continue;
        const track = buildDrumTrack({ gems, lanes, pro, sp, solos }, tempo);
        if (track.notes.length) (parts.drums ??= {})[diff] = track;
      }
      continue;
    }

    const enhancedOpens = tr.texts.some((t) => /^\[?ENHANCED_OPENS\]?$/i.test(t.text.trim()));
    const sx = sysexRanges(tr);
    const tapNotes = noteRanges(tr.notes, 104);
    for (const [diff, base] of Object.entries(MID_BASE)) {
      const gems = [];
      for (const n of tr.notes) {
        const o = n.note - base;
        if (o >= 0 && o <= 4) gems.push({ tick: n.tick, lane: o, len: n.end - n.tick });
        else if (enhancedOpens && o === -1) gems.push({ tick: n.tick, lane: 7, len: n.end - n.tick });
      }
      if (!gems.length) continue;
      const openR = sx[`${diff}:1`];
      if (openR) for (const g of gems) if (g.lane === 0 && inRanges(openR, g.tick)) g.lane = 7;
      const tap = sortRanges([...tapNotes, ...(sx[`${diff}:4`] || [])]);
      const track = buildGuitarTrack({
        gems,
        forceHopo: noteRanges(tr.notes, base + 5),
        forceStrum: noteRanges(tr.notes, base + 6),
        tap, sp, solos, hopoThreshold, susCutoff,
      }, tempo);
      if (track.notes.length) (parts[inst] ??= {})[diff] = track;
    }
  }

  return finishSong({ format: 'mid', resolution: res, tempo, sections, parts, chartFields: {} });
}

// Punto de entrada: recibe los bytes del chart (y el song.ini ya parseado)
export function parseSongFile(fileName, bytes, ini = {}) {
  if (/\.mid$/i.test(fileName)) return parseMid(bytes, ini);
  return parseChart(decodeText(bytes), ini);
}
