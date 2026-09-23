/* Original adaptive score: pads, bass, arpeggios and percussion, synthesized locally. */
(function(root){
'use strict';
class Soundtrack{
 constructor(){this.ctx=null;this.enabled=true;this.effects=true;this.volume=.42;this.step=0;this.next=0;this.mode='menu';this.paused=false;this.ready=false;this.failed=false;this.appliedGain=-1;}
 async unlock(){try{if(!this.ctx){const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio){this.failed=true;return false;}this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=.7;this.master.connect(this.ctx.destination);this.music=this.ctx.createGain();this.music.gain.value=this.volume;this.music.connect(this.master);this.fx=this.ctx.createGain();this.fx.gain.value=.62;this.fx.connect(this.master);
    this.reverb=this.ctx.createConvolver();const impulse=this.ctx.createBuffer(2,this.ctx.sampleRate*1.8,this.ctx.sampleRate);for(let ch=0;ch<2;ch++){const a=impulse.getChannelData(ch);let seed=43+ch;for(let i=0;i<a.length;i++){seed=(seed*16807)%2147483647;a[i]=(seed/2147483647*2-1)*Math.pow(1-i/a.length,3)*.35;}}this.reverb.buffer=impulse;this.wet=this.ctx.createGain();this.wet.gain.value=.2;this.reverb.connect(this.wet);this.wet.connect(this.music);
    this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   }await this.ctx.resume();this.ready=this.ctx.state==='running';this.next=this.ctx.currentTime+.05;return this.ready;
  }catch{this.failed=true;return false;}}
 frequency(note){return 440*2**((note-69)/12);}
 note(note,at,duration,volume,type='sine',bus=this.music,cutoff=3500,release=.2){if(!this.ctx)return;const o=this.ctx.createOscillator(),v=this.ctx.createGain(),f=this.ctx.createBiquadFilter();o.type=type;o.frequency.value=this.frequency(note);f.type='lowpass';f.frequency.value=cutoff;v.gain.setValueAtTime(.0001,at);v.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.025);v.gain.setValueAtTime(volume,at+Math.max(.03,duration*.58));v.gain.exponentialRampToValueAtTime(.0001,at+duration+release);o.connect(f);f.connect(v);v.connect(bus);if(bus===this.music&&type!=='triangle')v.connect(this.reverb);o.start(at);o.stop(at+duration+release+.02);o.onended=()=>{o.disconnect();f.disconnect();v.disconnect();};}
 noiseHit(at,dur,volume,cutoff=3000){const s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=this.noise;f.type='highpass';f.frequency.value=cutoff;g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.001,at+dur);s.connect(f);f.connect(g);g.connect(this.music);s.start(at);s.stop(at+dur);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};}
 kick(at){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.setValueAtTime(120,at);o.frequency.exponentialRampToValueAtTime(42,at+.13);g.gain.setValueAtTime(.22,at);g.gain.exponentialRampToValueAtTime(.001,at+.24);o.connect(g);g.connect(this.music);o.start(at);o.stop(at+.25);o.onended=()=>{o.disconnect();g.disconnect();};}
 tick(){if(!this.ready||!this.ctx)return;const t=this.ctx.currentTime,target=this.enabled&&!this.paused?this.volume:0;if(target!==this.appliedGain){this.music.gain.setTargetAtTime(target,t,.15);this.appliedGain=target;}if(this.next<t-.4)this.next=t+.04;if(!this.enabled||this.paused){this.next=t+.04;return;}const interval=60/104/4,progression=[[45,52,57,60,64],[41,48,53,57,60],[48,55,60,64,67],[43,50,55,59,62]];
  while(this.next<t+.16){const step=this.step%32,chord=progression[Math.floor(this.step/32)%4],at=this.next,combat=this.mode==='combat';
   if(step===0)for(let i=1;i<5;i++)this.note(chord[i],at,interval*30,.025,'sawtooth',this.music,600+i*140,.8);
   if(step%4===0)this.note(chord[0]-(step===12?0:12),at,interval*2.6,combat?.11:.07,'triangle',this.music,850,.06);
   const pattern=[0,2,1,3,2,1,3,4,0,2,4,3,2,4,1,3];if(step%2===0)this.note(chord[pattern[step/2]]+12,at,interval*.85,combat?.036:.027,'sine',this.music,3200,.28);
   if(combat){if(step%8===0||step===14||step===30)this.kick(at);if(step%8===4)this.noiseHit(at,.13,.07,1100);if(step%2===0)this.noiseHit(at,.028,.025+(step%4===0?.01:0),6500);}
   this.next+=interval;this.step++;
  }
 }
 setPause(value){this.paused=value;}
 setMusic(value){this.enabled=value;if(value&&!this.ready)this.unlock();}
 setVolume(value){this.volume=Math.max(0,Math.min(.7,value));}
 effect(kind,pitch=1){if(!this.ready||!this.effects)return;const at=this.ctx.currentTime;
  if(kind==='explosion'){const s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),v=this.ctx.createGain();s.buffer=this.noise;f.type='lowpass';f.frequency.setValueAtTime(2100,at);f.frequency.exponentialRampToValueAtTime(70,at+.5);v.gain.setValueAtTime(.28,at);v.gain.exponentialRampToValueAtTime(.001,at+.65);s.connect(f);f.connect(v);v.connect(this.fx);s.start(at);s.stop(at+.7);s.onended=()=>{s.disconnect();f.disconnect();v.disconnect();};this.note(29,at,.25,.2,'sine',this.fx,900,.3);}
  else if(kind==='shot'){this.note(65+pitch*2,at,.06,.095,'sawtooth',this.fx,2600,.1);this.note(36,at,.13,.1,'triangle',this.fx,900,.1);}
  else if(kind==='lightning'){for(let i=0;i<5;i++)this.note(68+i*3,at+i*.035,.04,.06,'sawtooth',this.fx,4500,.1);}
  else if(kind==='turn'){this.note(69,at,.11,.07,'sine',this.fx);this.note(76,at+.12,.19,.06,'sine',this.fx);}
  else if(kind==='heal'||kind==='pickup'){for(let i=0;i<4;i++)this.note([60,64,67,72][i],at+i*.09,.13,.075,'sine',this.fx);}
  else if(kind==='victory'){for(let i=0;i<8;i++)this.note([60,64,67,72,67,72,76,79][i],at+i*.14,.26,.08,'triangle',this.fx);}
  else if(kind==='jump')this.note(65,at,.1,.035,'triangle',this.fx);
  else if(kind==='splash')this.note(39,at,.2,.075,'sine',this.fx,700,.3);
  else if(kind==='bounce')this.note(51+Math.floor(pitch*5),at,.05,.035,'triangle',this.fx);
  else if(kind==='select')this.note(76,at,.025,.026,'sine',this.fx);
 }
}
root.CB.Soundtrack=Soundtrack;
})(globalThis);
