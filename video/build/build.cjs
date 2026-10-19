// Bundle de Juegos para grabar el tráiler: conecta al emulador y expone ayudas. No toca el repo.
const path = require('path'), fs = require('fs');
const C = require('path').resolve(__dirname, '../..') + '/colabtex';
const esbuild = require(C + '/node_modules/esbuild');
const parches = require('./parches.cjs');
const plugin = { name: 'trailer', setup(b) {
  b.onLoad({ filter: /colabtex[\/\\]src[\/\\].*\.js$/ }, a => {
    const rel = path.relative(C + '/src', a.path).replace(/\\/g, '/');
    let txt = fs.readFileSync(a.path, 'utf8');
    for (const [arch, de, a2] of parches) if (arch === rel) {
      if (!txt.includes(de)) throw new Error('parche no aplica en ' + rel + ': ' + de.slice(0, 60));
      txt = txt.replace(de, a2);
    }
    return { contents: txt, loader: 'js' };
  });
} };
esbuild.build({ entryPoints: [C + '/src/juegos-main.js'], bundle: true, format: 'iife', target: 'es2020',
  outfile: __dirname + '/juegos-app.js', plugins: [plugin], logLevel: 'warning', absWorkingDir: C, minify: false })
  .then(() => console.log('ok', fs.statSync(__dirname + '/juegos-app.js').size));
