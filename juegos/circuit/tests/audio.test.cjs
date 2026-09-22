/* Checks scheduling, mute and suspension without requiring an audio device. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const scheduled=[];
class Param{constructor(){this.value=0;}setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t));}exponentialRampToValueAtTime(v,t){assert.ok(v>0&&Number.isFinite(t));}setTargetAtTime(v,t,d){assert.ok(Number.isFinite(v)&&d>0);}}
class Node{constructor(){this.gain=new Param();this.frequency=new Param();}connect(){}disconnect(){}start(at){scheduled.push(at);assert.ok(Number.isFinite(at));}stop(at){assert.ok(Number.isFinite(at));}}
class AudioContext{constructor(){this.currentTime=0;this.sampleRate=8000;this.state='suspended';this.destination=new Node();}async resume(){this.state='running';}createGain(){return new Node();}createOscillator(){return new Node();}createBiquadFilter(){return new Node();}createBufferSource(){return new Node();}createConvolver(){return new Node();}createBuffer(channels,size){const data=Array.from({length:channels},()=>new Float32Array(Math.floor(size)));return{getChannelData:i=>data[i]};}}
const sandbox={CB:{},AudioContext,Math,Float32Array};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/audio.js'),'utf8'),sandbox);
(async()=>{
 const s=new sandbox.CB.Soundtrack();assert.ok(await s.unlock());assert.ok(s.ready);
 for(let i=0;i<100;i++){s.ctx.currentTime=i*.05;s.tick();}assert.ok(scheduled.length>20);console.log('PASS Music schedules layered notes with valid envelopes');
 s.enabled=false;const count=scheduled.length;for(let i=0;i<20;i++){s.ctx.currentTime+=.05;s.tick();}assert.equal(scheduled.length,count);console.log('PASS Music mute stops future note scheduling');
 s.enabled=true;s.setPause(true);s.ctx.currentTime+=20;s.tick();assert.equal(scheduled.length,count);s.setPause(false);s.tick();assert.ok(scheduled.length>count);assert.ok(scheduled.length<count+15);console.log('PASS Resume avoids a burst of overdue notes');
 s.mode='combat';for(let i=0;i<100;i++){s.ctx.currentTime+=.05;s.tick();}console.log('PASS Combat percussion schedules without invalid audio operations');
 s.effects=false;const muted=scheduled.length;s.effect('explosion');assert.equal(scheduled.length,muted);s.effects=true;for(const effect of ['explosion','shot','lightning','turn','heal','pickup','victory','jump','splash','bounce','select'])s.effect(effect);assert.ok(scheduled.length>muted);console.log('PASS Effects are independently mutable and every effect is valid');
 s.setVolume(0);assert.equal(s.volume,0);s.setVolume(10);assert.equal(s.volume,.7);console.log('PASS Volume is bounded and supports silence');
 console.log('\n6 audio checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
