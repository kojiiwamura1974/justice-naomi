(() => {
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('seaCanvas'),ctx=canvas.getContext('2d'), W=960,H=600;
const prefs={isSeOn:true,isVoiceOn:true}, naomi=new NaomiCharacter(prefs);
const courses={
 easy:{name:'OVAL',label:'01',half:65,ai:.85,points:[[485,494],[302,494],[195,465],[126,399],[107,300],[129,201],[199,132],[299,107],[650,107],[753,132],[829,201],[851,300],[829,398],[755,465],[654,494]]},
 normal:{name:'S-CURVE',label:'02',half:51,ai:1,points:[[485,500],[272,497],[157,452],[100,370],[107,256],[171,127],[292,92],[411,139],[529,155],[653,101],[776,126],[849,221],[852,354],[799,448],[654,494]]},
 hard:{name:'HAIRPIN',label:'03',half:42,ai:1.06,points:[[485,512],[290,510],[156,466],[96,374],[108,250],[154,123],[250,117],[299,196],[292,315],[346,367],[418,340],[448,232],[491,142],[592,98],[721,105],[816,168],[853,269],[843,378],[786,469],[649,507]]}
};
let mode='normal', ring=[], half=51, seg=[], total=0, milestones=[];

const clamp=(x,l,h)=>Math.min(h,Math.max(l,x)), mix=(a,b,t)=>a+(b-a)*t;
const mod=(x,n)=>(x%n+n)%n;
function configureCourse(){
const {points:shape,half:width}=courses[mode];
ring=[];half=width;
for(let i=0;i<shape.length;i++){
  const [a,b,c,d]=[-1,0,1,2].map(d=>shape[mod(i+d,shape.length)]);
  for(let j=0;j<14;j++){
    const t=j/14;
    ring.push([0,1].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));
  }
}
total=0;
seg=ring.map(([x,y],i)=>{
 const [x2,y2]=ring[(i+1)%ring.length], dx=x2-x,dy=y2-y,l=Math.hypot(dx,dy);
 const s={x,y,dx,dy,l,a:Math.atan2(dy,dx),s:total};total+=l;return s;
});
milestones=[.25,.5,.75,1,1.25,1.5,1.75,2].map(k=>k*total);
paintCourse();
}
function track(p,offset=0){
 p=mod(p,total);
 let a=0,b=seg.length-1;
 while(a<b){const m=Math.ceil((a+b)/2);if(seg[m].s<=p)a=m;else b=m-1;}
 const s=seg[a],t=(p-s.s)/s.l, nx=-s.dy/s.l,ny=s.dx/s.l;
 return {x:s.x+s.dx*t+nx*offset,y:s.y+s.dy*t+ny*offset,a:s.a};
}
function nearest(x,y){
 let best={r:Infinity};
 for(const s of seg){
  const t=clamp(((x-s.x)*s.dx+(y-s.y)*s.dy)/(s.l*s.l),0,1);
  const cx=s.x+s.dx*t,cy=s.y+s.dy*t,vx=x-cx,vy=y-cy,d=vx*vx+vy*vy;
  if(d<best.r)best={x:cx,y:cy,vx,vy,p:s.s+s.l*t,r:d,a:s.a};
 }
 best.r=Math.sqrt(best.r);return best;
}
const course=document.createElement('canvas');course.width=W;course.height=H;
const bg=course.getContext('2d');
const mini=document.createElement('canvas');mini.width=240;mini.height=150;
const map=mini.getContext('2d');
const miniScale=mini.width/W;
const zoom=1.9, viewW=W/zoom, viewH=H/zoom;
const camera={x:0,y:0};
let wallRecovery=null;
function label(x,y,t,col,size,align='left'){
 bg.fillStyle=col;bg.font='800 '+size+'px ui-monospace,monospace';bg.textAlign=align;bg.fillText(t,x,y);
}
function paintCourse(){
 const circuit=new Path2D(); ring.forEach(([x,y],i)=>i?circuit.lineTo(x,y):circuit.moveTo(x,y));circuit.closePath();
 // Prepare one simplified full-course layer; re-use it every frame.
 map.save();map.scale(miniScale,miniScale);
 map.fillStyle='#141a2c';map.fillRect(0,0,W,H);
 map.lineCap='round';map.lineJoin='round';
 for(const [width,color] of [[half*2+15,'#ae899b'],[half*2-1,'#5c6379']]){
  map.lineWidth=width;map.strokeStyle=color;map.stroke(circuit);
 }
 const gateA=track(0,-half+4),gateB=track(0,half-4);
 map.beginPath();map.moveTo(gateA.x,gateA.y);map.lineTo(gateB.x,gateB.y);
 map.strokeStyle='#fff1be';map.lineWidth=12;map.stroke();map.restore();
 const grad=bg.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#323a58');grad.addColorStop(1,'#1c253e');bg.fillStyle=grad;bg.fillRect(0,0,W,H);
 bg.strokeStyle='#b0c6ff11';bg.lineWidth=1;
 for(let x=0;x<W;x+=24){bg.beginPath();bg.moveTo(x,0);bg.lineTo(x,H);bg.stroke();}
 for(let y=0;y<H;y+=24){bg.beginPath();bg.moveTo(0,y);bg.lineTo(W,y);bg.stroke();}
 bg.lineJoin='round';bg.lineCap='round';
 for(const [width,color] of [[half*2+21,'#0e172c'],[half*2+13,'#867397'],[half*2+3,'#e6bf8f'],[half*2-5,'#54546b'],[half*2-19,'#414459']]){
   bg.strokeStyle=color;bg.lineWidth=width;bg.stroke(circuit);
 }
 // alternating painted curbs along both boundaries
 for(let p=0,i=0;p<total-13;p+=12,i++){
   for(const sign of [-1,1]){
     const a=track(p,sign*half),b=track(p+11,sign*half);bg.strokeStyle=i%2?'#dd798b':'#f8d7a8';bg.lineWidth=6;
     bg.beginPath();bg.moveTo(a.x,a.y);bg.lineTo(b.x,b.y);bg.stroke();
   }
 }
 bg.setLineDash([10,15]);bg.lineWidth=1.4;bg.strokeStyle='#daded33d';bg.stroke(circuit);bg.setLineDash([]);
 const start=track(0);
 bg.save();bg.translate(start.x,start.y);bg.rotate(start.a);
 for(let j=0;j<Math.floor(half*2/8);j++)for(let i=0;i<2;i++){bg.fillStyle=(i+j)%2?'#161b2d':'#fff5db';bg.fillRect(i*8-8,j*8-half+2,8,8);}
 bg.restore();
 for(let p of [total*.25,total*.5,total*.75]){
   const a=track(p,-half+6),b=track(p,half-6);bg.strokeStyle='#8de2cd6d';bg.lineWidth=2;bg.setLineDash([5,7]);bg.beginPath();bg.moveTo(a.x,a.y);bg.lineTo(b.x,b.y);bg.stroke();bg.setLineDash([]);
 }
 if(mode!=='hard'){label(480,288,'◆ JUSTICE RC ◆','#e9cb9e',38,'center');
 label(480,320,'RADIO CONTROL  /  CIRCUIT '+courses[mode].label,'#92a6be',15,'center');
 label(480,353,'TWO LAPS    •    FIVE CARS','#a8b6cb',12,'center');}
 label(480,588,courses[mode].label+'   //   '+courses[mode].name,'#a2bfcd',17,'center');
 label(28,40,'JUSTICE NAOMI   /   ARCADE','#a6bcce',14);
 label(932,40,'R/C CLUB','#e9cb9e',14,'right');
}
const colors=['#fd747f','#55d4d0','#ffbd57','#aab0fd','#84d875'];
const rivals=[{d:-18,lane:-27,v:148,id:1},{d:-18,lane:27,v:138,id:2},{d:-48,lane:-27,v:128,id:3},{d:-48,lane:27,v:118,id:4}];
const p0=-73;
let car, enemies, phase='ready', prev=0, accumulator=0, hudAt=0, toastTil=0, reactionTil=0, spin=0, immunity=0;
let ac, engine, engineGain, audioClip, at=0, voiceSeq=0, introTime=0;
const voiceData=new Map(), portraitCache=[];
const controls={left:new Set(),right:new Set(),gas:new Set(),brake:new Set()};
const has=k=>controls[k].size>0;
const resetInput=()=>{for(const s of Object.values(controls))s.clear();document.querySelectorAll('.held').forEach(x=>x.classList.remove('held'));};
function rig(){
 try{
   if(!ac){
     const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
     ac=new C(); engine=ac.createOscillator();engine.type='triangle';engineGain=ac.createGain();engineGain.gain.value=0;
     const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=230;engine.connect(f).connect(engineGain).connect(ac.destination);engine.start();
    }
    if(ac.state==='suspended')ac.resume().catch(()=>{});
 }catch{}
}
function warmVoice(){
 if(!prefs.isVoiceOn)return;
 rig();if(!ac)return;
 for(const id of ['hit_yatta','hit_justice','miss_oshii','miss_uso','endwon']){
  if(voiceData.has(id))continue;
  voiceData.set(id,fetch('./audio/'+id+'.mp3').then(r=>{if(!r.ok)throw Error(id);return r.arrayBuffer();}).then(buf=>ac.decodeAudioData(buf)).catch(()=>null));
 }
}
function stopVoice(){
 voiceSeq++;
 if(audioClip){try{audioClip.stop();}catch{} audioClip=null;}
}
function beep(freq,kind='triangle'){
 if(!ac||!prefs.isSeOn)return;
 const t=ac.currentTime, o=ac.createOscillator(),g=ac.createGain();o.type=kind;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.62,t+.17);g.gain.setValueAtTime(.055,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+.21);
}
function speak(line,mood='normal',clip,reaction){
 naomi.setState(mood,reaction);naomi.say(line);reactionTil=at+2.6;
 if(clip&&prefs.isVoiceOn){
   stopVoice();const seq=voiceSeq, expires=performance.now()+700;
   voiceData.get(clip)?.then(buffer=>{
    if(!buffer||seq!==voiceSeq||performance.now()>expires||!prefs.isVoiceOn||ac.state!=='running')return;
    const node=ac.createBufferSource(),g=ac.createGain();node.buffer=buffer;g.gain.value=.78;
    node.connect(g).connect(ac.destination);audioClip=node;node.onended=()=>{if(audioClip===node)audioClip=null;g.disconnect();node.disconnect();};node.start();
   });
 }
}
function toast(message,duration=1.7,coin=false){
 const e=$('checkpointToast');e.classList.toggle('coin-countdown',coin);e.textContent=message;e.classList.add('visible');toastTil=at+duration;
}
function playerRank(d=car.d, fraction=1){
 // Interpolate progress at the player’s crossing; an exact tie favors the rival.
 return 1+enemies.filter(e=>mix(e.previous??e.d,e.d,fraction)>=d-1e-7).length;
}
function queueStart(){
 if(phase!=='ready'&&phase!=='over')return;
 stopVoice();rig();warmVoice();
 if(!portraitCache.length)for(const file of new Set(Object.values(naomi.releasedPortraits).flatMap(Object.values))){
  const image=new Image();image.src='/games/submarine/portraits/'+file;portraitCache.push(image);
 }
 resetRace(false);
 phase='countdown';introTime=3;
 $('startBtn').disabled=true;$('overlayScreen').classList.remove('active');
 document.querySelectorAll('.difficulty-btn').forEach(b=>{b.disabled=true;});
 const e=$('checkpointToast');e.classList.add('coin-countdown','visible');e.textContent='3';
}
function advanceIntro(dt){
 introTime=Math.max(0,introTime-dt);
 if(introTime>1e-6){
  const e=$('checkpointToast'),next=String(Math.ceil(introTime-1e-6));
  if(e.textContent!==next)e.textContent=next;
  return;
 }
 $('startBtn').disabled=false;accumulator=0;resetRace(true);
}
function resetRace(start){
 const a=track(p0);
 car={...a,v:0,d:p0,near:mod(p0,total),laps:0,next:0};
 enemies=rivals.map(x=>({...x,pos:track(x.d,x.lane)}));
 phase=start?'playing':'ready'; spin=0;immunity=0;wallRecovery=null;toastTil=0;followCamera(0,true);resetInput(); $('checkpointToast').classList.remove('visible');
 if(start){
  $('overlayScreen').classList.remove('active');naomi.addFever(-100);
  speak('よーい、スタート！');toast('GO!',.70,true);beep(330);
 }
 document.querySelectorAll('.difficulty-btn').forEach(b=>{b.disabled=start;b.classList.toggle('selected',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
 hud();
}
function progress(next,quietLap=false){
 const raw=next.p-car.near, delta=raw-total*Math.round(raw/total);
 // Movement is checked at 120 Hz; any section jump is not physical travel.
 if(Math.abs(delta)>11)return false;
 car.near=next.p;
 const was=car.d;
 car.d+=delta;
 if(delta<=0)return true;
 const gate=milestones[car.next];
 if(!(was<gate&&car.d>=gate))return true;
 car.next++;
 if(car.next===4||car.next===8){
  const rank=playerRank(gate,clamp((gate-was)/delta,0,1));
  car.laps++;
  if(car.laps===1&&rank<=3){
   toast('1周目 '+rank+'位！　ファイナルラップ');beep(510);
   if(!quietLap)speak('やったやったー！','happy','hit_yatta');
   naomi.addFever(50);
  }else{
   phase='over';resetInput();document.querySelectorAll('.difficulty-btn').forEach(b=>b.disabled=false);
   const win=car.laps===2&&rank===1;
   $('overlayTitle').textContent=win?'CLEAR!':car.laps===1?'GAME OVER':'FINISH';
   $('overlayDesc').textContent=car.laps===1?'1周目 '+rank+'位。次は3位以内を目指そう。':win?'2周目 1位！ ジャスティスRCクリア！':'2周目 '+rank+'位。クリアは1位！';
   $('startBtn').textContent='もう100円！';
   $('overlayScreen').classList.add('active');
   if(win){speak('ジャスティスっ！','happy','hit_justice');beep(740);naomi.addFever(100);}
   else{speak(car.laps===2?'なかなかよかったよ．つぎもがんばって！':'おしいー。',car.laps===2?'happy':'sad',car.laps===2?'endwon':'miss_oshii');beep(155);}
  }
 }
 return true;
}
function hud(){
 $('speedVal').textContent=Math.round(Math.abs(car.v)*.23)+(car.v<-.5?' R':'');
 $('lapVal').textContent=Math.min(2,1+car.laps)+' / 2';
 $('placeVal').textContent=playerRank()+' / 5';
}
function update(dt){
 if(phase!=='playing')return;
 for(const e of enemies){
   e.previous=e.d;
   if(e.d<2*total)e.d=Math.min(2*total,e.d+dt*e.v*courses[mode].ai);
   else e.d+=dt*95;
   const wave=Math.sin(e.d*.005+e.id)*3;
   e.pos=track(e.d,e.lane+wave);
 }
 if(spin>0){
   const last=Math.min(spin,dt);
   car.a+=last*Math.PI*3;
   spin=Math.max(0,spin-dt);
   if(spin<=1e-8){
    spin=0;
    if(wallRecovery){
     const {x,y,vx,vy,r}=wallRecovery;
     const nx=vx/r,ny=vy/r;
     // Come to rest just inside the wall, pointed away from it if needed.
     car.x=x+nx*(half-11);car.y=y+ny*(half-11);
     const dx=Math.cos(car.a),dy=Math.sin(car.a),out=dx*nx+dy*ny;
     if(out>0)car.a=Math.atan2(dy-2*out*ny,dx-2*out*nx);
     wallRecovery=null;
    }
   }
   return;
 }
 immunity=Math.max(0,immunity-dt);
 const f=has('gas')&&!has('brake'),r=has('brake');
 let v=car.v;
 if(f)v+=dt*(v<0?340:191);
 else if(r)v-=dt*(v>0?440:114);
 else v*=Math.pow(.32,dt);
 car.v=clamp(v,-93,272);
 if(Math.abs(car.v)<.9&&!f&&!r)car.v=0;
 const dir=(has('right')?1:0)-(has('left')?1:0), av=Math.abs(car.v);
 car.a+=dir*Math.sign(car.v)*dt*(2.55*Math.min(1,av/38)-.52*av/272);
 const px=car.x,py=car.y;
 car.x+=Math.cos(car.a)*car.v*dt;car.y+=Math.sin(car.a)*car.v*dt;
 const n=nearest(car.x,car.y);
 // Boundary is the painted curb centerline. The sprite may graze it;
 // only its world-space center touching the line starts a spin.
 if(n.r>=half){
    const scale=half/n.r;
    car.x=n.x+n.vx*scale;car.y=n.y+n.vy*scale;
    wallRecovery=n;
    startSpin();
 }else if(immunity<=0&&enemies.some(e=>Math.hypot(car.x-e.pos.x,car.y-e.pos.y)<22)){
    startSpin();
 }
 const projected=nearest(car.x,car.y), raw=projected.p-car.near;
 const delta=raw-total*Math.round(raw/total);
 const before=playerRank(car.d,0);
 const after=playerRank(car.d+delta);
 // The player must actually move forward past a rival; an initial lead,
 // checkpoint reset, rival update alone or a wall projection cannot react.
 const pass=spin===0&&delta>0&&delta<=11&&after<before;
 if(progress(projected,pass)===false){car.x=px;car.y=py;car.v*=Math.pow(.025,dt);}
 else if(pass&&phase==='playing'){
   if(after===1)speak('ジャスティスっ！','happy','hit_justice','justice');
   else speak('やったやったー！','happy','hit_yatta','hit');
 }
}
function startSpin(){
 car.v=0;spin=2;immunity=.9;
 beep(125,'square');speak('うそー。','panic','miss_uso','miss');toast('スピン！',2);
}
function followCamera(dt,snap=false){
 // World remains north-up. Bias framing down the track, not toward the
 // car's spinning nose; clamp within the painted world and keep car in view.
 const lead=(32+Math.min(43,Math.abs(car.v)*.16))*(car.v<-.5?-1:1);
 const ahead=track(car.near+lead);
 const targetX=clamp(mix(car.x,ahead.x,.75)-viewW*.5,0,W-viewW);
 const targetY=clamp(mix(car.y,ahead.y,.75)-viewH*.5,0,H-viewH);
 const t=snap?1:1-Math.exp(-10*dt);
 camera.x=clamp(mix(camera.x,targetX,t),Math.max(0,car.x-viewW+30),Math.min(W-viewW,Math.max(0,car.x-30)));
 camera.y=clamp(mix(camera.y,targetY,t),Math.max(0,car.y-viewH+32),Math.min(H-viewH,Math.max(0,car.y-32)));
 // Reserve space for the fixed overlay if the car is approaching the
 // upper-left world boundary; a small amount of surrounding margin is OK.
 const overlayBias=clamp((340-(car.x-camera.x)*zoom)/86,0,1);
 camera.y=mix(camera.y,Math.min(camera.y,car.y-166/zoom),overlayBias);
}
function drawMiniMap(){
 const x=14,y=14,w=200,h=w*H/W,scale=w/W;
 ctx.save();
 ctx.fillStyle='#0b1122';ctx.strokeStyle='#eacf9c';ctx.lineWidth=2;
 ctx.beginPath();ctx.roundRect(x-4,y-4,w+8,h+8,5);ctx.fill();ctx.stroke();
 ctx.drawImage(mini,x,y,w,h);
 ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 ctx.strokeStyle='#ffe4b679';ctx.lineWidth=1.5;
 ctx.strokeRect(x+camera.x*scale,y+camera.y*scale,viewW*scale,viewH*scale);
 for(const e of enemies)dot(e.pos,colors[e.id],4.1,'#101727');
 dot(car,colors[0],5.7,'#fff0b1');
 function dot(p,fill,r,edge){
  ctx.beginPath();ctx.arc(x+p.x*scale,y+p.y*scale,r,0,Math.PI*2);
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=1.8;ctx.stroke();
 }
 ctx.restore();
}
// All cars are deliberately rendered high-contrast from directly overhead.
function drawCar(p,color,id,hero=false){
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);
 ctx.fillStyle='#10131f99';ctx.beginPath();ctx.ellipse(-2,3,20,12,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#141525';
 for(const x of [-11,7])for(const y of [-11,6])ctx.fillRect(x,y,7,5);
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-17,-8,34,16,5);ctx.fill();
 ctx.fillStyle='#161f35';ctx.beginPath();ctx.roundRect(-4,-6,12,12,4);ctx.fill();
 ctx.fillStyle='#d4f4fc';ctx.fillRect(2,-5,3,10);
 ctx.fillStyle='#fff5d3';ctx.fillRect(12,-6,4,3);ctx.fillRect(12,3,4,3);
 ctx.fillStyle='#983b52';ctx.fillRect(-16,-7,3,4);ctx.fillRect(-16,3,3,4);
 ctx.fillStyle='#faf0db';ctx.fillRect(-12,-5,5,10);
 ctx.restore();
 if(hero){
   ctx.fillStyle='#fff3ba';ctx.strokeStyle='#121626';ctx.lineWidth=3;
   ctx.beginPath();ctx.moveTo(p.x-5,p.y-24);ctx.lineTo(p.x+5,p.y-24);ctx.lineTo(p.x,p.y-17);ctx.closePath();ctx.stroke();ctx.fill();
 }else{
   ctx.fillStyle='#f3e7d1c0';ctx.font='700 11px ui-monospace';ctx.textAlign='center';ctx.fillText(id,p.x,p.y-15);
 }
}
function draw(){
 ctx.fillStyle='#22283f';ctx.fillRect(0,0,W,H);
 ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
 ctx.drawImage(course,0,0);
 for(const e of enemies)drawCar(e.pos,colors[e.id],e.id);
 drawCar(car,colors[0],0,true);
 ctx.restore();drawMiniMap();
}
function frame(ms){
 at=ms/1000;const dt=prev?Math.min(.05,at-prev):0;prev=at;
 if(phase==='countdown')advanceIntro(dt);
 else {accumulator+=dt;while(accumulator>=1/120){update(1/120);accumulator-=1/120;}}
 if(ac&&engineGain){
  const t=ac.currentTime;
  engine.frequency.setTargetAtTime(49+Math.abs(car.v)*.53,t,.06);
  engineGain.gain.setTargetAtTime(prefs.isSeOn&&phase==='playing'&&Math.abs(car.v)>1?.028:0,t,.06);
 }
 if(at>hudAt){hud();hudAt=at+.065;}
 if(toastTil&&at>toastTil){$('checkpointToast').classList.remove('visible');toastTil=0;}
 if(phase==='playing'&&reactionTil&&at>reactionTil){naomi.setState('normal');naomi.say('いけいけっ！');reactionTil=0;}
 followCamera(dt);draw();requestAnimationFrame(frame);
}
const key={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'gas',KeyW:'gas',ArrowDown:'brake',KeyS:'brake'};
function set(k,id,down){
 if(down) controls[k].add(id);else controls[k].delete(id);
 ({left:$('btnLeft'),right:$('btnRight'),gas:$('btnGas'),brake:$('btnBrake')})[k].classList.toggle('held',!!controls[k].size);
}
function home(){
 if(phase!=='playing'||spin>0)return;
 // Repair orientation at the current progress, without awarding gate or mileage.
 const pos=track(car.d,0);Object.assign(car,pos,{near:mod(car.d,total),v:0});
 speak('よし、ここからっ！');hud();
}
window.addEventListener('keydown',e=>{
 if(key[e.code]&&phase==='playing'){e.preventDefault();if(!e.repeat)set(key[e.code],e.code,true);}
 if(!e.repeat&&e.code==='KeyR'&&phase==='playing'){e.preventDefault();home();}
});
window.addEventListener('keyup',e=>{if(key[e.code])set(key[e.code],e.code,false);});
window.addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
for(const [dom,k] of [['btnLeft','left'],['btnRight','right'],['btnGas','gas'],['btnBrake','brake']]){
 const b=$(dom);
 b.addEventListener('pointerdown',e=>{if(phase!=='playing')return;e.preventDefault();b.setPointerCapture(e.pointerId);set(k,e.pointerId,true);});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>set(k,e.pointerId,false));
}
$('startBtn').addEventListener('click',queueStart);
$('resetBtn').addEventListener('click',home);
$('seToggleBtn').addEventListener('click',()=>{prefs.isSeOn=!prefs.isSeOn;const b=$('seToggleBtn');b.classList.toggle('active',prefs.isSeOn);b.textContent=prefs.isSeOn?'🔔 SE ON':'🔕 SE OFF';if(prefs.isSeOn)rig();});
$('voiceToggleBtn').addEventListener('click',()=>{prefs.isVoiceOn=!prefs.isVoiceOn;const b=$('voiceToggleBtn');b.classList.toggle('active',prefs.isVoiceOn);b.textContent=prefs.isVoiceOn?'🗣️ ボイス ON':'🤐 ボイス OFF';if(!prefs.isVoiceOn)stopVoice();else warmVoice();});
document.querySelectorAll('.difficulty-btn').forEach(b=>b.addEventListener('click',()=>{if(phase==='playing'||phase==='countdown') return;mode=b.dataset.mode;configureCourse();$('overlayTitle').textContent='ラジコンで遊ぼう。';$('overlayDesc').innerHTML='5台で2周。1周目は3位以内で通過。<br>2周目を1位でゴールするとクリア！<br><small>※画面の100円は演出です。無料で遊べます。</small>';$('startBtn').textContent='100円入れて遊ぶ';resetRace(false);}));
configureCourse();resetRace(false);requestAnimationFrame(frame);
})();
