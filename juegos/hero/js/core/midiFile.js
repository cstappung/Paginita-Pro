// Lector de archivos MIDI estándar (SMF) escrito desde cero.
// Devuelve por pista: nombre, notas (con inicio/fin en ticks), textos, tempos,
// compases y mensajes SysEx (usados por Phase Shift / Clone Hero para opens y taps).

const latin = new TextDecoder('utf-8');

export function parseMidi(bytes) {
  const len = bytes.length;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str4 = (p) => String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);

  if (len < 14 || str4(0) !== 'MThd') throw new Error('No es un archivo MIDI válido');
  const hlen = dv.getUint32(4);
  const format = dv.getUint16(8);
  const ntracks = dv.getUint16(10);
  const division = dv.getUint16(12);
  if (division & 0x8000) throw new Error('MIDI con división SMPTE no soportado');

  const tracks = [];
  let p = 8 + hlen;

  while (p + 8 <= len && tracks.length < ntracks) {
    const id = str4(p);
    const tlen = dv.getUint32(p + 4);
    p += 8;
    const end = Math.min(p + tlen, len);
    if (id !== 'MTrk') {
      p = end;
      continue;
    }

    const tr = { name: '', notes: [], texts: [], tempos: [], timeSigs: [], sysex: [] };
    const open = new Map();
    let tick = 0;
    let running = 0;

    const readVar = () => {
      let v = 0, b;
      do {
        b = bytes[p++];
        v = (v << 7) | (b & 0x7f);
      } while (b & 0x80 && p < end);
      return v;
    };

    while (p < end) {
      tick += readVar();
      if (p >= end) break;
      let status = bytes[p];
      if (status & 0x80) {
        p++;
        if (status < 0xf0) running = status;
      } else {
        status = running;
        if (!status) break; // datos corruptos
      }

      if (status === 0xff) {
        const type = bytes[p++];
        const l = readVar();
        const data = bytes.subarray(p, p + l);
        p += l;
        if (type >= 1 && type <= 7) {
          const text = latin.decode(data);
          if (type === 3 && !tr.name) tr.name = text.trim();
          else tr.texts.push({ tick, type, text });
        } else if (type === 0x51 && l >= 3) {
          tr.tempos.push({ tick, uspq: (data[0] << 16) | (data[1] << 8) | data[2] });
        } else if (type === 0x58 && l >= 2) {
          tr.timeSigs.push({ tick, num: data[0], den: 2 ** data[1] });
        } else if (type === 0x2f) {
          break; // fin de pista
        }
      } else if (status === 0xf0 || status === 0xf7) {
        const l = readVar();
        tr.sysex.push({ tick, data: bytes.subarray(p, p + l) });
        p += l;
      } else {
        const hi = status & 0xf0;
        if (hi === 0x80 || hi === 0x90) {
          const note = bytes[p++];
          const vel = bytes[p++];
          if (hi === 0x90 && vel > 0) {
            const prev = open.get(note);
            if (prev) tr.notes.push({ tick: prev.tick, end: tick, note, vel: prev.vel, ch: prev.ch });
            open.set(note, { tick, vel, ch: status & 0x0f });
          } else {
            const prev = open.get(note);
            if (prev) {
              tr.notes.push({ tick: prev.tick, end: tick, note, vel: prev.vel, ch: prev.ch });
              open.delete(note);
            }
          }
        } else if (hi === 0xa0 || hi === 0xb0 || hi === 0xe0) p += 2;
        else if (hi === 0xc0 || hi === 0xd0) p += 1;
        else p++;
      }
    }
    for (const [note, prev] of open) tr.notes.push({ tick: prev.tick, end: tick, note, vel: prev.vel, ch: prev.ch });
    tr.notes.sort((a, b) => a.tick - b.tick || a.note - b.note);
    tracks.push(tr);
    p = end;
  }

  return { format, division, tracks };
}
