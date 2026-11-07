/* ColabTeX y ColabDraw, la parte que se prueba sin navegador:
   las pistas del registro, el resumen de la compilación, el autocompletado,
   el saneado de SVG (también al exportar) y el mapa de fuentes del motor.
   Las pruebas con navegador y motor real están en tests/colab-navegador/. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const esbuild = require('esbuild'), fs = require('fs'), path = require('path');

/* yjs queda fuera del bundle: con dos copias, `instanceof Y.XmlElement`
   falla entre la del módulo y la de la prueba (el aviso «Yjs was already
   imported»), y serialize no reconocía ningún nodo. */
const carga = entrada => {
  const codigo = esbuild.buildSync({ entryPoints: [entrada], bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent', external: ['yjs'] }).outputFiles[0].text;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', codigo)(mod, mod.exports, require);
  return mod.exports;
};
const texlog = carga('src/texlog.js');
const latex = carga('src/latex.js');
const tc = carga('src/tex-complete.js');
const svgio = carga('src/draw/svgio.js');
const Y = require('yjs');

test('Pistas: lo que no puede funcionar en el navegador dice qué poner', () => {
  const p = texlog.pistasDeError;
  assert.match(p('fontspec.sty:45: Fatal Package fontspec Error: The fontspec package requires either XeTeX or LuaTeX.')[0], /XeLaTeX/);
  assert.match(p('Package minted Error: You must invoke LaTeX with the -shell-escape flag.')[0], /listings/);
  assert.match(p('apa.bbx:14: Package biblatex Error: Biber backend required.')[0], /natbib/);
  const g = p('LaTeX Error: Unicode character α (U+03B1)\nLaTeX Error: Unicode character α (U+03B1)');
  assert.equal(g.length, 1, 'una pista por compilación, aunque el error se repita');
  assert.match(g[0], /\$\\alpha\$/);
  assert.match(p("! LaTeX Error: File `raro.cls' not found.")[0], /clase «raro»/);
  assert.match(p('Font bbm10 at 600 not found')[0], /dsfont/);
  assert.deepEqual(p('Output written on main.pdf (1 page).'), []);
});

test('Resumen: solo la última pasada y los errores «archivo:línea»', () => {
  const r = latex.summarizeLog({ pasadas: 2, logs: [
    { cmd: 'prefmt pdflatex -ini', log: '! esto es del volcado del preámbulo' },
    { cmd: 'pdflatex a', log: 'LaTeX Warning: Citation `k\' undefined\n./main.tex:5: Undefined control sequence.' },
    { cmd: 'bibtex8 main.aux', log: 'BibTeX ok' },
    { cmd: 'pdflatex b', log: './main.tex:5: Undefined control sequence.\nl.5 \\foo\nOutput written on main.pdf (2 pages, 100 bytes).' }
  ] });
  assert.equal(r.errors.length, 1, 'el error de la última pasada, una vez; ni el del volcado ni el de la primera');
  assert.match(r.errors[0], /main\.tex:5/);
  assert.equal(r.warnings.length, 0, 'el aviso de la primera pasada ya no cuenta');
  assert.equal(r.pages, 2);
  assert.equal(r.pasadas, 2);
});

test('Autocompletado: etiquetas y claves de todo el proyecto', () => {
  assert.deepEqual(tc.etiquetasDe(['\\label{a} % \\label{comentada}', '\\label{ b }']), ['a', 'b']);
  const claves = tc.clavesBib(['@book{knuth84, title={The {\\TeX}book}}\n@comment{no,}\n@article{l, title="LaTeX"}']);
  assert.deepEqual([...claves.keys()], ['knuth84', 'l']);
  assert.equal(claves.get('knuth84').titulo, 'The TeXbook');
});

test('Esquema y palabras', () => {
  const t = '\\documentclass{article}\n\\begin{document}\n\\section{Intro \\textbf{x}}\nHola mundo.\n\\subsection*{Más $a$}\n$$x$$ dos\n\\end{document}';
  assert.deepEqual(tc.esquemaDe(t).map(e => [e.nivel, e.titulo, e.linea]), [[2, 'Intro x', 3], [3, 'Más a', 5]]);
  assert.equal(tc.contarPalabras(t), 6);    // Intro x Hola mundo Más dos
});

test('SVG: lo que se exporta pasa el mismo saneado que lo que se importa', () => {
  assert.equal(svgio.isSafeTag('script'), false);
  assert.equal(svgio.isSafeTag('foreignObject'), false);
  assert.equal(svgio.isSafeTag('linearGradient'), true);
  assert.equal(svgio.isSafeAttr('onload', 'x'), false);
  assert.equal(svgio.isSafeAttr('href', 'javascript:alert(1)'), false);
  assert.equal(svgio.isSafeAttrName('x onload'), false);
  // un documento escrito a mano en Yjs, como lo haría alguien desde la consola
  const doc = new Y.Doc();
  const svg = new Y.XmlElement('svg'); doc.getXmlFragment('f').insert(0, [svg]);
  const g = new Y.XmlElement('g'), s = new Y.XmlElement('script'), r = new Y.XmlElement('rect');
  s.insert(0, [new Y.XmlText('alert(1)')]);
  r.setAttribute('width', '5'); r.setAttribute('onclick', 'alert(2)'); r.setAttribute('x" onload="alert(3)', '1');
  const st = new Y.XmlElement('style'); st.insert(0, [new Y.XmlText('@import url(https://mal.example/x.css); rect{fill:red}')]);
  g.insert(0, [s, r, st]); svg.insert(0, [g]);
  const out = svgio.serialize(svg);
  assert.doesNotMatch(out, /script|alert|onload|onclick|mal\.example/);
  assert.match(out, /<rect width="5"/);
  assert.match(out, /fill:red/);
});

test('Motor: el mapa de fuentes cubre T1 y TS1 sin cm-super', () => {
  const mapa = fs.readFileSync(path.join(__dirname, '../../vendor/busytex/extra/pdftex.map'), 'latin1');
  for (const f of ['ecrm1000', 'ecbx1200', 'eccc1000', 'ectt1000', 'tcrm1000'])
    assert.match(mapa, new RegExp('^' + f + ' LM\\S+ " encl', 'm'), f + ' debe apuntar a Latin Modern');
  assert.match(fs.readFileSync(path.join(__dirname, '../src/latex.js'), 'utf8'), /"texlive-revistas\.js"/);
});
