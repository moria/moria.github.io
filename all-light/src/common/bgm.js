// ======================== BGM 背景音乐（公共模块） ========================
const BGM = (() => {
  const _N={C2:65.41,D2:73.42,Eb2:77.78,F2:87.31,G2:98,Ab2:103.83,Bb2:116.54,C3:130.81,D3:146.83,Eb3:155.56,F3:174.61,G3:196,Ab3:207.65,Bb3:233.08,C4:261.63,D4:293.66,Eb4:311.13,F4:349.23,G4:392,Ab4:415.30,Bb4:466.16,C5:523.25,D5:587.33,Eb5:622.25,F5:698.46,G5:784,Ab5:830.61,Bb5:932.33,C6:1046.5,Eb6:1244.5,G6:1568};
  const STEP=60/128/4, BAR=60/128*4;
  const DR=[{k:[0,4,8,12],s:[4,12],h:[2,6,10,14],o:[]},{k:[0,3,8,11],s:[4,12],h:[2,6,10,14],o:[7]},{k:[0,4,6,8,12],s:[4,12],h:[1,3,5,9,11,13],o:[15]},{k:[0,8],s:[4,12],h:[2,6,10,14],o:[6,14]},{k:[0,3,6,8,11],s:[4,13],h:[1,5,9],o:[7,15]},{k:[0,4,8,10,12],s:[4,12,14],h:[2,6],o:[15]}];
  const BA=[[[ _N.C2,0,4],[_N.C2,6,2],[_N.Eb2,8,2],[_N.F2,10,2],[_N.G2,12,2]],[[_N.C2,0,2],[_N.C2,4,2],[_N.Eb2,6,2],[_N.F2,8,4],[_N.Eb2,14,2]],[[_N.Ab2,0,2],[_N.G2,2,2],[_N.F2,4,4],[_N.Eb2,10,2],[_N.F2,12,4]],[[_N.Bb2,0,2],[_N.Ab2,4,2],[_N.G2,6,2],[_N.F2,8,2],[_N.Eb2,10,2],[_N.C2,12,4]],[[_N.C2,0,4],[_N.Eb2,4,2],[_N.F2,6,2],[_N.G2,8,2],[_N.Ab2,10,2],[_N.G2,12,4]],[[_N.F2,0,4],[_N.Eb2,4,2],[_N.F2,6,2],[_N.Ab2,8,4],[_N.G2,12,2],[_N.F2,14,2]],[[_N.Eb2,0,2],[_N.F2,2,2],[_N.G2,4,4],[_N.C3,8,2],[_N.Bb2,10,2],[_N.Ab2,12,4]],[[_N.C2,0,2],[_N.G2,2,2],[_N.F2,4,2],[_N.Eb2,6,2],[_N.C2,8,4],[_N.Eb2,12,2],[_N.G2,14,2]]];
  const AR=[[_N.C4,_N.Eb4,_N.G4,_N.C5,_N.G4,_N.Eb4,_N.C4,_N.Eb4,_N.G4,_N.C5,_N.Eb5,_N.C5,_N.G4,_N.Eb4,_N.C4,_N.G4],[_N.C4,_N.D4,_N.Eb4,_N.G4,_N.C5,_N.Eb5,_N.D5,_N.C5,_N.G4,_N.Eb4,_N.G4,_N.C5,_N.D5,_N.C5,_N.G4,_N.Eb4],[_N.F4,_N.Ab4,_N.C5,_N.F5,_N.C5,_N.Ab4,_N.F4,_N.Ab4,_N.C5,_N.Eb5,_N.F5,_N.Eb5,_N.C5,_N.Ab4,_N.F4,_N.C5],[_N.Eb4,_N.G4,_N.Bb4,_N.Eb5,_N.G5,_N.Eb5,_N.Bb4,_N.G4,_N.Bb4,_N.Eb5,_N.G5,_N.Eb5,_N.Bb4,_N.G4,_N.Eb4,_N.Bb4],[_N.Ab4,_N.C5,_N.Eb5,_N.Ab5,_N.Eb5,_N.C5,_N.Ab4,_N.C5,_N.Eb5,_N.G5,_N.Ab5,_N.G5,_N.Eb5,_N.C5,_N.Ab4,_N.Eb5],[_N.Bb4,_N.D5,_N.F5,_N.Bb5,_N.F5,_N.D5,_N.Bb4,_N.D5,_N.F5,_N.Bb5,_N.D5,_N.Bb4,_N.F4,_N.Bb4,_N.D5,_N.F5],[_N.C4,_N.G4,_N.C5,_N.Eb5,_N.G5,_N.C6,_N.G5,_N.Eb5,_N.C5,_N.G4,_N.Eb4,_N.C4,_N.G4,_N.C5,_N.Eb5,_N.C5],[_N.Eb4,_N.F4,_N.G4,_N.Bb4,_N.C5,_N.D5,_N.Eb5,_N.G5,_N.Eb5,_N.D5,_N.C5,_N.Bb4,_N.G4,_N.F4,_N.Eb4,_N.G4]];
  const LE=[[0,0,_N.G5,0,_N.Eb5,0,_N.C5,0,0,_N.D5,0,_N.Eb5,0,_N.G5,_N.F5,0],[_N.Eb5,0,0,_N.C5,0,_N.D5,0,_N.Eb5,_N.G5,0,_N.F5,0,_N.Eb5,0,_N.C5,0],[0,_N.C5,0,_N.Eb5,_N.G5,0,_N.Ab5,0,_N.G5,0,_N.F5,0,_N.Eb5,_N.D5,_N.C5,0],[_N.G5,0,_N.Ab5,0,_N.G5,0,_N.Eb5,0,_N.D5,0,_N.C5,0,_N.D5,0,_N.Eb5,0],[0,0,_N.C5,_N.D5,_N.Eb5,0,_N.F5,0,_N.G5,0,_N.Ab5,0,_N.G5,_N.F5,_N.Eb5,0],[_N.Bb5,0,_N.G5,0,_N.Eb5,0,_N.C5,0,_N.D5,0,_N.F5,0,_N.Eb5,0,_N.G5,0],[0,_N.Eb5,_N.F5,_N.G5,0,0,_N.Ab5,_N.G5,_N.F5,0,0,_N.Eb5,_N.D5,_N.C5,0,0],[_N.C5,0,_N.Eb5,0,_N.G5,_N.Bb5,_N.G5,0,_N.Eb5,0,_N.C5,_N.D5,_N.Eb5,_N.F5,_N.G5,0]];
  const PD=[[_N.C4,_N.Eb4,_N.G4],[_N.F3,_N.Ab3,_N.C4],[_N.Ab3,_N.C4,_N.Eb4],[_N.Bb3,_N.D4,_N.F4],[_N.Eb3,_N.G3,_N.Bb3],[_N.G3,_N.Bb3,_N.D4]];
  let ax=null, ma=null, tids=[], bi=0, si=0, nT=0, bS=0, on=false;
  function mK(t){const o=ax.createOscillator(),g=ax.createGain();o.type='sine';o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(28,t+0.15);g.gain.setValueAtTime(0.75,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);o.connect(g).connect(ma);o.start(t);o.stop(t+0.35);const c=ax.createOscillator(),cg=ax.createGain();c.type='square';c.frequency.setValueAtTime(1000,t);c.frequency.exponentialRampToValueAtTime(60,t+0.015);cg.gain.setValueAtTime(0.25,t);cg.gain.exponentialRampToValueAtTime(0.001,t+0.03);c.connect(cg).connect(ma);c.start(t);c.stop(t+0.04);}
  function mS(t){const l=ax.sampleRate*0.12,b=ax.createBuffer(1,l,ax.sampleRate),d=b.getChannelData(0);for(let i=0;i<l;i++)d[i]=Math.random()*2-1;const n=ax.createBufferSource();n.buffer=b;const f=ax.createBiquadFilter();f.type='highpass';f.frequency.value=3500;const g=ax.createGain();g.gain.setValueAtTime(0.38,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);n.connect(f).connect(g).connect(ma);n.start(t);n.stop(t+0.12);const o=ax.createOscillator(),og=ax.createGain();o.type='triangle';o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(70,t+0.06);og.gain.setValueAtTime(0.35,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.08);o.connect(og).connect(ma);o.start(t);o.stop(t+0.09);}
  function mH(t,op){const du=op?0.14:0.04,l=ax.sampleRate*du,b=ax.createBuffer(1,l,ax.sampleRate),d=b.getChannelData(0);for(let i=0;i<l;i++)d[i]=Math.random()*2-1;const n=ax.createBufferSource();n.buffer=b;const f=ax.createBiquadFilter();f.type='bandpass';f.frequency.value=op?7500:10000;f.Q.value=1.5;const g=ax.createGain();g.gain.setValueAtTime(op?0.14:0.09,t);g.gain.exponentialRampToValueAtTime(0.001,t+du);n.connect(f).connect(g).connect(ma);n.start(t);n.stop(t+du+0.01);}
  function mSy(fr,t,du,w,v,cf){const o1=ax.createOscillator(),o2=ax.createOscillator(),f=ax.createBiquadFilter(),g=ax.createGain();o1.type=w;o1.frequency.setValueAtTime(fr,t);o2.type=w;o2.frequency.setValueAtTime(fr*1.006,t);o2.detune.setValueAtTime(8,t);f.type='lowpass';f.Q.value=5;f.frequency.setValueAtTime(cf,t);f.frequency.exponentialRampToValueAtTime(Math.max(cf*0.25,150),t+du);g.gain.setValueAtTime(v,t);g.gain.setValueAtTime(v*0.8,t+du*0.6);g.gain.exponentialRampToValueAtTime(0.001,t+du);o1.connect(f);o2.connect(f);f.connect(g).connect(ma);o1.start(t);o1.stop(t+du+0.05);o2.start(t);o2.stop(t+du+0.05);}
  function mP(fr,t,du,v){const o1=ax.createOscillator(),o2=ax.createOscillator(),f=ax.createBiquadFilter(),g=ax.createGain();o1.type='sine';o1.frequency.setValueAtTime(fr,t);o2.type='triangle';o2.frequency.setValueAtTime(fr*2.005,t);f.type='lowpass';f.frequency.value=1000;g.gain.setValueAtTime(0.001,t);g.gain.linearRampToValueAtTime(v,t+du*0.25);g.gain.setValueAtTime(v*0.9,t+du*0.65);g.gain.exponentialRampToValueAtTime(0.001,t+du);o1.connect(f);o2.connect(f);f.connect(g).connect(ma);o1.start(t);o1.stop(t+du+0.1);o2.start(t);o2.stop(t+du+0.1);}
  function mSB(fr,t,du){const o=ax.createOscillator(),g=ax.createGain();o.type='sine';o.frequency.setValueAtTime(fr,t);g.gain.setValueAtTime(0.18,t);g.gain.setValueAtTime(0.16,t+du*0.5);g.gain.exponentialRampToValueAtTime(0.001,t+du);o.connect(g).connect(ma);o.start(t);o.stop(t+du+0.05);}
  function doBar(t,bI,sI){const s3=sI%3,bM=bI%8;let di;if(s3===0)di=bM<4?0:1;else if(s3===1)di=bM<4?2:3;else di=bM<4?4:5;const dp=DR[di];for(let s=0;s<16;s++){const st=t+s*STEP;if(dp.k.indexOf(s)>=0)mK(st);if(dp.s.indexOf(s)>=0)mS(st);if(dp.h.indexOf(s)>=0)mH(st,false);if(dp.o.indexOf(s)>=0)mH(st,true);}const bp=BA[(bI+sI*3)%BA.length];for(let b=0;b<bp.length;b++){mSy(bp[b][0],t+bp[b][1]*STEP,bp[b][2]*STEP*0.85,'sawtooth',0.13,700);mSB(bp[b][0],t+bp[b][1]*STEP,bp[b][2]*STEP*0.9);}const aI=(bI+sI*2)%AR.length,aV=s3===1?0.035:0.05,aO=s3===2?2:1;for(let s=0;s<16;s++)mSy(AR[aI][s]*aO,t+s*STEP,STEP*0.65,'square',aV,2800);if(s3>=1){const lp=LE[(bI+sI)%LE.length],lV=s3===2?0.07:0.05;for(let s=0;s<16;s++)if(lp[s]>0)mSy(lp[s],t+s*STEP,STEP*1.4,'sawtooth',lV,2200);}const ch=PD[(bI+sI)%PD.length],pV=s3===0?0.05:0.035;for(let c=0;c<ch.length;c++)mP(ch[c],t,BAR*0.92,pV);if(bM===7){mS(t+12*STEP);mS(t+13*STEP);mS(t+14*STEP);mS(t+15*STEP);mH(t+14*STEP,true);mH(t+15*STEP,true);}}
  function loop(){if(!on)return;while(nT<ax.currentTime+4){if(bS>=8){si++;bS=0;}doBar(nT,bi,si);nT+=BAR;bi++;bS++;}tids.push(setTimeout(loop,200));}
  function initAudioGraph(){
    ma=ax.createGain();ma.gain.value=0.45;const cv=ax.createConvolver(),rl=ax.sampleRate*1.8,rb=ax.createBuffer(2,rl,ax.sampleRate);for(let c=0;c<2;c++){const d=rb.getChannelData(c);for(let i=0;i<rl;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/rl,2.8);}cv.buffer=rb;const rg=ax.createGain();rg.gain.value=0.12;const cp=ax.createDynamicsCompressor();cp.threshold.value=-20;cp.ratio.value=5;ma.connect(cp);ma.connect(cv);cv.connect(rg);rg.connect(cp);cp.connect(ax.destination);
  }
  function beginLoop(){bi=0;si=0;bS=0;nT=ax.currentTime+0.05;loop();}
  return {
    start(){
      if(on)return;
      ax=new(window.AudioContext||window.webkitAudioContext)();
      initAudioGraph();
      on=true;
      // 在用户手势调用栈中创建的 AudioContext 通常直接是 running 状态
      if(ax.state==='running'){beginLoop();}
      else{ax.resume().then(()=>{if(on)beginLoop();});}
    },
    stop(){on=false;tids.forEach(clearTimeout);tids=[];if(ax){ax.close();ax=null;}},
    get playing(){return on;}
  };
})();

function toggleBGM() {
  if (BGM.playing) { BGM.stop(); } else { BGM.start(); }
  localStorage.setItem('bgm_on', BGM.playing ? '1' : '0');
  updateMusicBtn();
}

function updateMusicBtn() {
  const btn = document.getElementById('btn-music-global');
  if (!btn) return;
  btn.textContent = BGM.playing ? '\uD83C\uDFB5' : '\uD83C\uDFB6';
  btn.style.opacity = BGM.playing ? '1' : '0.4';
}

// 页面加载自动播放（在首次用户交互时启动，确保 AudioContext 不被浏览器阻止）
(function initBGM() {
  const pref = localStorage.getItem('bgm_on');
  if (pref === null || pref === '1') {
    const startOnGesture = () => {
      if (!BGM.playing) { BGM.start(); updateMusicBtn(); }
      document.removeEventListener('click', startOnGesture);
      document.removeEventListener('touchstart', startOnGesture);
    };
    document.addEventListener('click', startOnGesture);
    document.addEventListener('touchstart', startOnGesture);
  }
})();
