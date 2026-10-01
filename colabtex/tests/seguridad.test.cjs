const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/sano.js')+'\n;globalThis.__S={colorSano,fotoSana,sanea,saneaPartida};',ctx);
const S=ctx.__S;

test('un color solo pasa como #rrggbb',()=>{
 assert.equal(S.colorSano('#0d9488'),'#0d9488');
 for(const c of ['red','#fff','#0d9488" onclick="x','"><img src=x onerror=alert(1)>','',null,7]) assert.equal(S.colorSano(c),'',String(c));
});

test('una foto es https limpia o, en el perfil, una data URL de imagen',()=>{
 const g='https://lh3.googleusercontent.com/a/ACg8ocK=s96-c';
 assert.equal(S.fotoSana(g),g);
 assert.equal(S.fotoSana('javascript:alert(1)'),'');
 assert.equal(S.fotoSana('https://x.y/a" onerror="b'),'');
 assert.equal(S.fotoSana('https://x.y/a)b'),'','no cierra un url(...)');
 assert.equal(S.fotoSana('http://x.y/a.png'),'');
 const d='data:image/jpeg;base64,/9j/4AAQSkZJRg==';
 assert.equal(S.fotoSana(d),'','una ficha no lleva data URL');
 assert.equal(S.fotoSana(d,true),d);
 assert.equal(S.fotoSana('data:text/html;base64,PHNjcmlwdD4=',true),'');
 assert.equal(S.fotoSana('data:image/svg+xml;base64,PHN2Zz4=',true),'','un SVG puede llevar script');
});

test('sanea arregla en su sitio y borra lo que no sirve',()=>{
 const p={jugadores:{a:{nombre:'Ana',color:'"><b>',foto:'javascript:x',marco:'corona'},b:{nombre:'B',color:'#112233',marco:'x y'}}};
 S.saneaPartida(p);
 assert.equal('color' in p.jugadores.a,false);
 assert.equal(p.jugadores.a.foto,'');
 assert.equal(p.jugadores.a.marco,'corona');
 assert.equal(p.jugadores.b.color,'#112233');
 assert.equal('marco' in p.jugadores.b,false);
 assert.equal(S.sanea(null),null);
});

test('las reglas cierran lo que se abrió',()=>{
 const R=JSON.parse(fs.readFileSync('../firebase/database.rules.json','utf8')).rules;
 assert.match(R.tokenIndex.$token['.validate'],/'edit'/,'un enlace no puede dar rol de dueño');
 assert.doesNotMatch(R.tokenIndex.$token['.validate'],/owner/);
 assert.match(R.users.$uid['.read'],/auth.uid === \$uid/,'el registro de cada uno es privado');
 assert.equal(R.users.$uid.perfil['.read'],'auth != null','el perfil sigue siendo público');
 assert.equal(R.discord['.read'],'auth != null','toda sala se anuncia: el webhook lo lee cualquiera con sesión');
 assert.match(R.errors.$fp['.write'],/newData.exists\(\) \|\| root.child\('admins'\)/,'borrar errores es de admins');
 assert.equal(R.admins.$uid['.write'],false);
 const st=fs.readFileSync('../firebase/storage.rules','utf8');
 assert.match(st,/allow delete: if request.auth != null && esDueno\(\)/);
});
