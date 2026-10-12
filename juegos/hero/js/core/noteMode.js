// Modificadores de notas (como los de Clone Hero): todo taps, todo HOPOs, todo strums.
import { NOTE_STRUM, NOTE_HOPO, NOTE_TAP } from './constants.js';

export const NOTE_MODES = {
  taps: 'Todo taps (sin rasgueo)',
  normal: 'Normal (como Clone Hero)',
  hopos: 'Todo HOPOs',
  strums: 'Todo rasgueo',
};

export function applyNoteMode(track, mode) {
  if (!track || track.kind !== 'guitar' || !mode || mode === 'normal') return track;
  const type = mode === 'taps' ? NOTE_TAP : mode === 'hopos' ? NOTE_HOPO : NOTE_STRUM;
  // En "todo taps" las notas abiertas se tocan soltando todos los trastes (o rasgueando)
  return { ...track, notes: track.notes.map((n) => ({ ...n, type })) };
}
