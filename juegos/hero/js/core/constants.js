export const NOTE_STRUM = 0;
export const NOTE_HOPO = 1;
export const NOTE_TAP = 2;

export const DIFFS = ['expert', 'hard', 'medium', 'easy'];
export const DIFF_LABEL = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil', expert: 'Experto' };

// Instrumentos jugables. `stems` = pistas de audio que se silencian al fallar.
export const PARTS = {
  guitar: { label: 'Guitarra', kind: 'guitar', stems: ['guitar'] },
  bass: { label: 'Bajo', kind: 'guitar', stems: ['bass'] },
  rhythm: { label: 'Rítmica', kind: 'guitar', stems: ['rhythm'] },
  guitarcoop: { label: 'Guitarra Coop', kind: 'guitar', stems: ['guitar'] },
  keys: { label: 'Teclado', kind: 'guitar', stems: ['keys'] },
  drums: { label: 'Batería', kind: 'drums', stems: ['drums', 'drums_1', 'drums_2', 'drums_3', 'drums_4'] },
};
export const PART_ORDER = ['guitar', 'bass', 'rhythm', 'keys', 'drums', 'guitarcoop'];

// Nombres de archivo de audio que reconoce Clone Hero
export const STEM_NAMES = [
  'song', 'guitar', 'bass', 'rhythm', 'keys', 'vocals', 'vocals_1', 'vocals_2',
  'drums', 'drums_1', 'drums_2', 'drums_3', 'drums_4', 'crowd',
];
export const AUDIO_EXT = ['ogg', 'opus', 'mp3', 'wav', 'm4a'];

export const FRET_COLORS = ['#22c84a', '#e8312f', '#f5d21c', '#2f7bf0', '#f28a1c'];
export const OPEN_COLOR = '#b648e8';
export const SP_COLOR = '#53e7ff';
export const DRUM_COLORS4 = ['#e8312f', '#f5d21c', '#2f7bf0', '#22c84a'];
export const DRUM_COLORS5 = ['#e8312f', '#f5d21c', '#2f7bf0', '#f28a1c', '#22c84a'];
export const KICK_COLOR = '#f28a1c';
