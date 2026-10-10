/* Metro Rush — la voz del altavoz del andén.

   QUÉ REVISA, EN GLOBAL
   - Que cada anuncio de historia.js (ANUNCIOS: `proxima` y `eco` de cada
     estación) tiene su grabación en assets/voz/<estación>-<cual>.mp3, que
     no sobra ninguna, y que cada una es un MP3 de tamaño sensato (ni vacío
     ni una canción entera).
   - Que textos.json (lo que dice cada grabación, lo escribe
     colabtex/scripts/metrorush-voz.py) es idéntico a historia.js: un
     anuncio cambiado sin volver a grabar dejaría la voz diciendo otra cosa
     que la franja.
   - Que audio.js nombra los archivos igual que el script y que juego.js le
     pasa el texto del anuncio al terminar el ding-dong.
   Sin la carpeta assets/voz (todavía sin grabar) los dos primeros se saltan
   con un aviso: el juego funciona igual, solo que el altavoz se lee callado. */
'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const DIR = path.join(__dirname, '../../juegos/club/metrorush');
const VOZ = path.join(DIR, 'assets', 'voz');
const H = require(path.join(DIR, 'historia.js'));
const CUALES = ['proxima', 'eco'];
const lee = f => fs.readFileSync(path.join(DIR, f), 'utf8');
/** Los nombres esperados ('barrio-proxima'…) con su texto, en el orden de ANUNCIOS. */
const esperados = () => {
  const out = {};
  for (const id of Object.keys(H.ANUNCIOS)) for (const c of CUALES) out[id + '-' + c] = H.ANUNCIOS[id][c];
  return out;
};
const SIN_GRABAR = !fs.existsSync(VOZ) && 'falta assets/voz: correr colabtex/scripts/metrorush-voz.py';

test('cada anuncio tiene su MP3, ninguno sobra y los tamaños son sensatos', { skip: SIN_GRABAR }, () => {
  const nombres = Object.keys(esperados());
  assert.equal(nombres.length, 2 * Object.keys(H.ANUNCIOS).length);
  let total = 0;
  for (const n of nombres) {
    const f = path.join(VOZ, n + '.mp3');
    assert.ok(fs.existsSync(f), `falta ${n}.mp3`);
    const b = fs.readFileSync(f), kb = b.length / 1024;
    assert.ok(b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), `${n}.mp3 no parece un MP3`);
    assert.ok(kb > 6 && kb < 120, `${n}.mp3 pesa ${kb.toFixed(1)} kB (un anuncio de 2 a 12 s a 48 kbps son ~12 a 70 kB)`);
    total += kb;
  }
  assert.ok(total < 1536, `las grabaciones pesan ${total.toFixed(0)} kB: el tope es 1,5 MB`);
  const hay = fs.readdirSync(VOZ).filter(n => n.endsWith('.mp3')).map(n => n.slice(0, -4)).sort();
  assert.deepEqual(hay, [...nombres].sort(), 'sobra o falta alguna grabación');
});

test('lo grabado (textos.json) es lo que dice historia.js', { skip: SIN_GRABAR }, () => {
  const grabados = JSON.parse(fs.readFileSync(path.join(VOZ, 'textos.json'), 'utf8'));
  const e = esperados();
  for (const n of Object.keys(e)) assert.equal(grabados[n], e[n], `${n} cambió en historia.js: volver a grabarlo`);
  assert.deepEqual(Object.keys(grabados).sort(), Object.keys(e).sort());
});

test('audio.js y juego.js tocan la voz del anuncio que se muestra', () => {
  const audio = lee('audio.js'), juego = lee('juego.js');
  assert.match(audio, /const CUALES = \['proxima', 'eco'\]/, 'audio.js nombra los anuncios como el script');
  assert.match(audio, /'assets\/voz\/' \+ nombre \+ '\.mp3'/, 'audio.js busca los MP3 en assets/voz');
  assert.match(audio, /anuncio\(txt\)/);
  assert.match(audio, /g\.connect\(this\.efectos\)/, 'la voz va por los efectos (volumen, mudo, volumen.js)');
  const dice = juego.slice(juego.indexOf('function altavozDice'), juego.indexOf('function altavozCalla'));
  assert.ok(dice.indexOf('sonido.dingDong()') >= 0 && dice.indexOf('sonido.dingDong()') < dice.indexOf('sonido.anuncio(txt)'),
    'altavozDice toca el ding-dong y después la voz');
});
