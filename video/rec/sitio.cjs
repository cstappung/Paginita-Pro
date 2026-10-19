// Abre el sitio con el bundle del emulador y una sesión falsa.
const fs = require('fs'), path = require('path');
const S = require('path').resolve(__dirname, '..');
async function preparaContexto(ctx) {
  await ctx.route(/\/juegos-app\.js(\?.*)?$/, r => r.fulfill({ path: S + '/build/juegos-app.js', contentType: 'application/javascript' }));
  await ctx.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\//, r => {
    const m = r.request().url().match(/npm\/(@?[^@/]+)@[^/]+\/(.*)$/); const f = m && path.join(S, 'cdn/node_modules', m[1], m[2].split('?')[0]);
    if (f && fs.existsSync(f)) r.fulfill({ path: f, contentType: 'application/javascript' }); else r.abort();
  });
}
async function entra(pg, { sub, nombre, email }) {
  await pg.waitForFunction(() => window.__fb, null, { timeout: 30000 });
  return pg.evaluate(async ({ sub, nombre, email }) => {
    const { auth, GoogleAuthProvider, signInWithCredential } = window.__fb;
    const tok = JSON.stringify({ sub, email: email || sub + '@trailer.test', email_verified: true, name: nombre });
    const r = await signInWithCredential(auth, GoogleAuthProvider.credential(tok));
    return r.user.uid;
  }, { sub, nombre, email });
}
module.exports = { preparaContexto, entra };
