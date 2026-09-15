// Solo emuladores locales: prueba reglas y transacciones de récord.
for(const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy'])delete process.env[k];
const assert=require('node:assert/strict'),esbuild=require('esbuild');
const {initializeApp,deleteApp}=require('firebase/app');const {getAuth,connectAuthEmulator,signInAnonymously}=require('firebase/auth');const {getDatabase,connectDatabaseEmulator,goOffline,get,ref,set}=require('firebase/database');
const timeout=setTimeout(()=>{console.error('Tiempo agotado');process.exit(1);},45000);
(async()=>{
 const clientes=[];for(let i=0;i<2;i++){const app=initializeApp({projectId:'demo-solo',apiKey:'demo',databaseURL:'http://127.0.0.1:9000?ns=demo-solo-default-rtdb'},'solo-'+i);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const db=getDatabase(app);connectDatabaseEmulator(db,'127.0.0.1',9000);const {user}=await signInAnonymously(auth);clientes.push({app,db,uid:user.uid});}
 const c=clientes[0];const code=await esbuild.build({entryPoints:['src/fb-juegos.js'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'db-local',setup(b){b.onResolve({filter:/\/firebase\.js$/},()=>({path:'local',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const db=__db;',loader:'js'}));}}]});const mod={exports:{}};new Function('require','module','exports','__db',code.outputFiles[0].text)(require,mod,mod.exports,c.db);
 const api=mod.exports,key='snake-portal-media',dato={nombre:'Ana',puntos:100,tiempo:1000,partida:'a'};
 await api.guardarSolo(key,c.uid,dato);await Promise.all([api.guardarSolo(key,c.uid,{...dato,puntos:300,partida:'b'}),api.guardarSolo(key,c.uid,{...dato,puntos:200,partida:'c'})]);
 const path=`soloRanks/${key}/${c.uid}`;assert.equal((await get(ref(c.db,path))).val().puntos,300);
 await api.guardarSolo(key,c.uid,{...dato,puntos:300,tiempo:800,partida:'d'});await api.guardarSolo(key,c.uid,{...dato,puntos:300,tiempo:1200,partida:'e'});assert.equal((await get(ref(c.db,path))).val().tiempo,800);
 const deniega=async(fn)=>{let fallo=false;try{await fn()}catch{fallo=true}assert.ok(fallo);};
 await deniega(()=>set(ref(clientes[1].db,path),{...dato,puntos:999}));await deniega(()=>set(ref(c.db,path),{...dato,puntos:-1}));await deniega(()=>set(ref(c.db,`soloRanks/inventada/${c.uid}`),dato));await deniega(()=>set(ref(c.db,path),{...dato,puntos:999999}));
 const filas=await new Promise((resolve,reject)=>{let off;off=api.watchSolo(key,(f,e)=>{if(e)reject(e);else resolve(f);setTimeout(()=>off(),0);});});assert.equal(filas[0].puntos,300);
 console.log('Firebase: récord concurrente, desempate, lectura y aislamiento entre usuarios correctos.');for(const x of clientes){goOffline(x.db);await deleteApp(x.app);}clearTimeout(timeout);
 // El SDK mantiene temporizadores auxiliares en Node; todas las aserciones ya finalizaron.
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
