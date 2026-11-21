/* SUBMARINE v2 — rectangular magnifying periscope, fixed ship schedules,
   slower predictive torpedoes, split-sink explosions, three 20-second quotas.
   The original NaomiCharacter and portrait assets remain unchanged. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const canvas=$("seaCanvas"),ctx=canvas.getContext("2d",{alpha:false});
  const W=960,H=600,CX=480,CY=300,SEA_HORIZON=285,WORLD=5600;
  const VIEW={x:102,y:62,w:756,h:476,r:32,zoom:1.17};
  const POINTS=[100,200,500];
  const BANDS=[
    {y:372,scale:1.05,speed:37,points:100},
    {y:327,scale:.74,speed:-53,points:200},
    {y:290,scale:.46,speed:88,points:500}
  ];
  const LEVELS={
    easy:{label:"やさしい",quotas:[200,500,900],hitScale:1.28},
    normal:{label:"ふつう",quotas:[300,800,1500],hitScale:1},
    hard:{label:"むずかしい",quotas:[500,1300,2600],hitScale:.80}
  };
  const $score=$("scoreVal"),$time=$("timeVal"),$best=$("bestVal"),$bearing=$("bearingVal");
  const $stage=$("stageLabel"),$target=$("quotaLabel"),$progress=$("stageProgress"),$toast=$("checkpointToast");
  const overlay=$("overlayScreen"),overlayTitle=$("overlayTitle"),overlayDesc=$("overlayDesc"),startBtn=$("startBtn");
  const leftBtn=$("btnLeft"),rightBtn=$("btnRight"),fireBtn=$("btnFire");
  const seBtn=$("seToggleBtn"),voiceBtn=$("voiceToggleBtn");
  const diffButtons=[...document.querySelectorAll(".difficulty-btn")];
  const prefs={isVoiceOn:true,isSeOn:true};
  const naomi=new NaomiCharacter(prefs); // exact original NaomiCharacter class from gem-drop
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const rand=(a,b)=>a+(b-a)*Math.random();
  const project=(wx)=>CX+(wx-cameraWorld())*.57;
  const cameraWorld=()=>WORLD*.5+bearing*31;
  let state="ready",difficulty="normal",score=0,best=0,bearing=0;
  let elapsed=0,timeLeft=60,checkpointIndex=0,holdDir=0,cooldown=0,gameSec=0,wavePhase=0;
  let ships=[],shots=[],sparks=[],smoke=[],rings=[],boomWords=[];
  let frameLast=0,activePointer=null,lastPointerX=0;
  let reactionExpires=0,toastExpires=0,shakeTime=0,flash=0,voiceTimer=0,lastMiss=-99;
  let audio=null,runNumber=0;
  try{best=Number(localStorage.getItem("naomi-submarine-best-v4")||0);}catch(e){best=0;}

  /* A dedicated deterministic generator. Cosmetic randomness and player hits
     never alter the opening ship positions or movement for each difficulty. */
  function mulberry32(seed){
    return function(){
      seed|=0;seed=seed+0x6D2B79F5|0;
      let t=Math.imul(seed^seed>>>15,1|seed);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296;
    };
  }
  function setupFleet(){
    const random=mulberry32(1978);
    ships=[];
    BANDS.forEach((band,lane)=>{
      for(let i=0;i<11;i++){
        const slot=130+(WORLD-260)*(i+.45)/11;
        ships.push({
          lane,wx:slot+(random()-.5)*240+(lane-1)*55,
          phase:random()*Math.PI*2,
          dead:0,respawns:0,
          spawnIndex:i
        });
      }
    });
  }
  function resetShip(ship){
    const lane=BANDS[ship.lane];
    ship.dead=0;
    ship.respawns++;
    // Re-entry is fixed by lane and spawn slot, not by difficulty.
    ship.wx=lane.speed>0 ? -250-ship.spawnIndex*12 : WORLD+250+ship.spawnIndex*12;
  }
  function updateHUD(){
    $score.textContent=String(score).padStart(4,"0");
    $time.textContent=String(Math.max(0,Math.ceil(timeLeft))).padStart(2,"0");
    $best.textContent=String(best).padStart(4,"0");
    $bearing.textContent=String(((Math.round(bearing)%360)+360)%360).padStart(3,"0")+"°";
    const level=LEVELS[difficulty],index=Math.min(2,checkpointIndex);
    $stage.textContent="STAGE "+(index+1)+" / 3";
    $target.textContent=(index+1)*20+"秒まで：累計 "+level.quotas[index]+"点";
    $progress.style.width=(state==="over"?100:clamp((elapsed-index*20)/20*100,0,100))+"%";
    diffButtons.forEach(b=>{
      const selected=b.dataset.difficulty===difficulty;
      b.classList.toggle("selected",selected);
      b.setAttribute("aria-pressed",String(selected));
      b.disabled=state==="playing";
    });
  }
  function setDifficulty(mode){
    if(state==="playing"||!LEVELS[mode])return;
    difficulty=mode;
    checkpointIndex=0;elapsed=0;timeLeft=60;
    updateHUD();
    if(state==="ready"){
      overlayDesc.innerHTML="20秒ごとに得点ノルマをクリアして進もう．<br>最大60秒，難易度「"+LEVELS[mode].label+"」．";
    }
  }
  function speak(line,mood="normal",hold=1.7){
    naomi.setState(mood);
    naomi.say(line);
    reactionExpires=performance.now()/1000+hold;
  }
  function settleMood(now){
    if(state==="playing"&&now>=reactionExpires&&naomi.state!=="normal"){
      naomi.setState("normal");
      naomi.speechText.textContent="狙って，狙って！";
    }
  }
  function showStageMessage(message,hold=1.55){
    $toast.textContent=message;
    $toast.classList.add("visible");
    toastExpires=performance.now()/1000+hold;
  }
  function startGame(){
    state="playing";runNumber++;score=0;bearing=0;holdDir=0;elapsed=0;timeLeft=60;checkpointIndex=0;
    cooldown=0;gameSec=0;wavePhase=0;flash=0;shakeTime=0;
    shots=[];sparks=[];smoke=[];rings=[];boomWords=[];lastMiss=-99;
    setupFleet();overlay.classList.remove("active");$toast.classList.remove("visible");
    updateHUD();
    speak("いけー！　狙って，狙って！","happy",1.3);
    sound("start");
  }
  function endGame(reason){
    if(state!=="playing")return;
    state="over";holdDir=0;
    if(score>best){best=score;try{localStorage.setItem("naomi-submarine-best-v4",String(best));}catch(e){}}
    const completed=reason==="complete",qualified=reason==="complete";
    if(reason==="quota"){
      overlayTitle.textContent="ここまで！";
      overlayDesc.innerHTML="20秒ごとの得点ノルマに届かなかった．<br>獲得 "+score+"点．もう一回いこう！";
      speak("惜しい！　次はきっといけるよ！","sad",99);
    }else{
      overlayTitle.textContent=completed?"60秒，完全クリア！":"60秒終了！";
      overlayDesc.innerHTML="最終スコア："+score+"点<br>"+(qualified?"全ステージ達成！":"またチャレンジしよう！")+"";
      speak("60秒走りきったね！　すごーい！","happy",99);
    }
    startBtn.textContent="もう100円！";
    overlay.classList.add("active");
    showStageMessage("",0);
    $toast.classList.remove("visible");
    updateHUD();sound(completed?"success":"end");
  }
  function onCheckpoint(){
    const deadline=(checkpointIndex+1)*20,target=LEVELS[difficulty].quotas[checkpointIndex];
    if(score<target){
      showStageMessage("ノルマ未達！",.8);
      endGame("quota");
      return;
    }
    if(checkpointIndex===2){endGame("complete");return;}
    checkpointIndex++;
    const next=LEVELS[difficulty].quotas[checkpointIndex];
    showStageMessage("STAGE CLEAR!　次は "+next+"点",1.9);
    naomi.triggerCutin(checkpointIndex===1?1:3);
    speak("やった！　次の20秒もいけるよ！","happy",1.7);
    sound("success");updateHUD();
  }
  function fire(){
    if(state!=="playing"||cooldown>0)return;
    cooldown=.67;
    shots.push({wx:cameraWorld(),y:545,py:545,age:0});
    sound("fire");
    if(Math.random()<.20)speak("そこ！　いっけー！","panic",.8);
  }
  function impact(ship){
    ship.dead=3.45;
    const band=BANDS[ship.lane],x=ship.wx;
    score+=band.points;
    if(score>best)best=score;
    shakeTime=.32;flash=.3;
    rings.push({wx:x,y:band.y,age:0,dur:.68});
    boomWords.push({wx:x,y:band.y-31,age:0,dur:1.2});
    for(let i=0;i<58;i++){
      const ang=rand(0,Math.PI*2),v=rand(24,180);
      sparks.push({wx:x,y:band.y,vx:Math.cos(ang)*v*1.6,vy:Math.sin(ang)*v-rand(5,85),
        age:0,dur:rand(.45,1.2),r:rand(1.5,5)});
    }
    for(let i=0;i<18;i++){
      smoke.push({wx:x+rand(-15,15),y:band.y-rand(0,14),vx:rand(-17,17),vy:-rand(26,90),
        age:0,dur:rand(1.1,2.3),r:rand(9,20)});
    }
    sound("boom");
    if(ship.lane===2){
      naomi.triggerCutin(2);
      speak("ズガーンッ！　500点！","happy",2.15);
    }else if(ship.lane===1){
      speak("やったー！　真っ二つ！","happy",2.0);
    }else speak("命中！　沈んだ！","happy",1.9);
    naomi.addFever(ship.lane===2?28:ship.lane===1?17:10);
    updateHUD();
  }
  function sound(kind){
    if(!prefs.isSeOn)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      if(!audio)audio=new AC();
      if(audio.state==="suspended")audio.resume();
      const t=audio.currentTime;
      const tone=(start,end,d,type="triangle",volume=.05,when=0)=>{
        const osc=audio.createOscillator(),g=audio.createGain();
        const at=t+when;osc.type=type;
        osc.frequency.setValueAtTime(start,at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(30,end),at+d);
        g.gain.setValueAtTime(.0001,at);
        g.gain.exponentialRampToValueAtTime(volume,at+.015);
        g.gain.exponentialRampToValueAtTime(.0001,at+d);
        osc.connect(g);g.connect(audio.destination);osc.start(at);osc.stop(at+d+.01);
      };
      if(kind==="boom"){
        // Layered low explosion + filtered noise, not just a short score chime.
        tone(155,41,.68,"sawtooth",.13);
        tone(92,38,.9,"sine",.18,.04);
        tone(420,96,.36,"square",.035,.09);
        const dur=.72,len=Math.floor(audio.sampleRate*dur);
        const buffer=audio.createBuffer(1,len,audio.sampleRate),arr=buffer.getChannelData(0);
        for(let i=0;i<len;i++){const decay=Math.pow(1-i/len,1.35);arr[i]=(Math.random()*2-1)*decay;}
        const src=audio.createBufferSource(),lp=audio.createBiquadFilter(),gain=audio.createGain();
        src.buffer=buffer;lp.type="lowpass";lp.frequency.setValueAtTime(1600,t);
        lp.frequency.exponentialRampToValueAtTime(300,t+.66);
        gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.20,t+.02);
        gain.gain.exponentialRampToValueAtTime(.0001,t+.72);
        src.connect(lp);lp.connect(gain);gain.connect(audio.destination);src.start(t);src.stop(t+.72);
      }else if(kind==="fire"){
        tone(380,145,.31,"sawtooth",.07);tone(740,240,.19,"triangle",.05,.025);
      }else if(kind==="success"){
        tone(480,620,.2,"triangle",.06);tone(650,810,.22,"triangle",.08,.16);
      }else if(kind==="start"){
        tone(400,550,.13);tone(650,810,.2,"triangle",.07,.1);
      }else tone(310,120,.3,"triangle",.055);
    }catch(err){}
  }
  function animate(dt,now){
    wavePhase+=dt;cooldown=Math.max(0,cooldown-dt);shakeTime=Math.max(0,shakeTime-dt);
    flash=Math.max(0,flash-dt);
    if(holdDir&&state==="playing")bearing=clamp(bearing+holdDir*25*dt,-42,42);
    for(const ship of ships){
      const band=BANDS[ship.lane];
      if(ship.dead>0){ship.dead-=dt;if(ship.dead<=0)resetShip(ship);}
      else{ship.wx+=band.speed*dt;
        if(ship.wx>WORLD+280)ship.wx=-280;
        if(ship.wx< -280)ship.wx=WORLD+280;
      }
    }
    sparks=sparks.filter(p=>{p.age+=dt;p.wx+=p.vx*dt;p.y+=p.vy*dt;p.vy+=132*dt;return p.age<p.dur;});
    smoke=smoke.filter(p=>{p.age+=dt;p.wx+=p.vx*dt;p.y+=p.vy*dt;return p.age<p.dur;});
    rings=rings.filter(p=>(p.age+=dt)<p.dur);
    boomWords=boomWords.filter(p=>(p.age+=dt)<p.dur);
    // Sparks and smoke can continue in the ending animation, but do not fire after game over.
    if(state!=="playing"){
      if(now>=toastExpires)$toast.classList.remove("visible");
      return;
    }
    for(const ship of ships){
      if(ship.dead>0&&Math.random()<.35){
        const p=(3.45-ship.dead)/3.45;
        if(p<.78)smoke.push({wx:ship.wx+rand(-18,18),y:BANDS[ship.lane].y+p*85-18,
          vx:rand(-15,15),vy:-rand(35,70),age:0,dur:rand(.7,1.6),r:rand(10,18)});
      }
    }
    shots=shots.filter(shot=>{
      shot.py=shot.y;shot.y-=172*dt;shot.age+=dt;
      let target=null;
      for(let lane=0;lane<BANDS.length&&!target;lane++){
        const band=BANDS[lane];
        if(shot.py>band.y&&shot.y<=band.y){
          for(const ship of ships){
            if(ship.lane!==lane||ship.dead>0)continue;
            const dx=Math.abs(shot.wx-ship.wx)*.57;
            const hitRadius=64*band.scale*LEVELS[difficulty].hitScale+3;
            if(dx<hitRadius){target=ship;break;}
          }
        }
      }
      if(target){impact(target);return false;}
      if(shot.y<SEA_HORIZON-14){
        if(now-lastMiss>3.1&&Math.random()<.65){lastMiss=now;speak("惜しい！　先を狙って！","sad",1.2);}
        return false;
      }
      return true;
    });
    elapsed=Math.min(60,elapsed+dt);timeLeft=Math.max(0,60-elapsed);
    if(elapsed >= (checkpointIndex+1)*20-1e-7)onCheckpoint();
    settleMood(now);
    if(now>=toastExpires)$toast.classList.remove("visible");
    updateHUD();
  }
  function cloud(x,y,s,alpha){
    ctx.fillStyle="rgba(245,172,131,"+alpha+")";
    ctx.beginPath();
    ctx.ellipse(x,y,79*s,18*s,0,0,Math.PI*2);
    ctx.ellipse(x+23*s,y-11*s,44*s,24*s,0,0,Math.PI*2);
    ctx.ellipse(x-30*s,y-6*s,51*s,17*s,0,0,Math.PI*2);
    ctx.fill();
  }
  function drawSkyAndSea(){
    const sky=ctx.createLinearGradient(0,0,0,SEA_HORIZON);
    sky.addColorStop(0,"#0e1933");sky.addColorStop(.55,"#2c3853");
    sky.addColorStop(.82,"#ab685f");sky.addColorStop(1,"#efae77");
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,SEA_HORIZON);
    const cxOffset=-bearing*2.2;
    cloud(230+cxOffset,207,1.1,.42);cloud(733+cxOffset,188,.8,.35);cloud(575+cxOffset,239,.54,.27);
    ctx.fillStyle="#182b3d";ctx.fillRect(0,SEA_HORIZON,W,5);
    const sea=ctx.createLinearGradient(0,SEA_HORIZON,0,H);
    sea.addColorStop(0,"#15516c");sea.addColorStop(.48,"#165974");sea.addColorStop(1,"#0a2c4f");
    ctx.fillStyle=sea;ctx.fillRect(0,SEA_HORIZON+4,W,H-SEA_HORIZON);
    ctx.strokeStyle="rgba(244,192,134,.5)";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,SEA_HORIZON+3);ctx.lineTo(W,SEA_HORIZON+3);ctx.stroke();
    for(let row=0;row<51;row++){
      const f=row/51,y=SEA_HORIZON+10+f*f*(H-SEA_HORIZON-8),count=8+row*3,space=W/count;
      for(let n=0;n<count;n++){
        const x=(n*space+row*53+Math.sin(wavePhase*.69+row*.55+n*.72)*7)%W;
        const span=(12+f*43)*(1+Math.sin(n*2.2+row)*.19);
        ctx.strokeStyle=row%3===0?"rgba(255,206,145,"+(.11+f*.13)+")":"rgba(143,211,220,"+(.12+f*.10)+")";
        ctx.lineWidth=1+f*1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+span,y+Math.sin(wavePhase*2+row+n)*1.1);ctx.stroke();
      }
    }
  }
  function shipSilhouette(){
    ctx.fillStyle="#142333";ctx.beginPath();
    ctx.moveTo(-71,-6);ctx.lineTo(-59,12);ctx.lineTo(41,12);ctx.lineTo(69,-7);ctx.lineTo(65,-11);ctx.lineTo(-65,-12);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#546a74";ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-59,-10);ctx.lineTo(60,-10);ctx.stroke();
    ctx.fillStyle="#1f3040";ctx.fillRect(-38,-24,69,16);ctx.fillRect(-15,-42,26,19);
    ctx.fillRect(-42,-30,14,8);ctx.fillRect(16,-32,12,10);ctx.fillRect(35,-28,15,11);
    ctx.fillStyle="#405468";ctx.fillRect(-10,-36,5,5);ctx.fillRect(1,-36,5,5);
    ctx.strokeStyle="#324858";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-2,-42);ctx.lineTo(-2,-62);ctx.moveTo(35,-28);ctx.lineTo(35,-43);ctx.stroke();
  }
  function drawSplitShip(ship){
    const band=BANDS[ship.lane],sx=project(ship.wx);
    if(sx<-150||sx>W+150)return;
    const dir=band.speed>0?1:-1,scale=band.scale;
    const p=clamp((3.45-ship.dead)/3.45,0,1);
    const sink=Math.pow(p,1.5)*205,gap=p*29;
    const bob=Math.sin(wavePhase*2+ship.phase)*1.3;
    // Two separate hull pieces tilt, slide apart, and go under the surface.
    ctx.save();ctx.translate(sx,band.y+bob);ctx.scale(dir*scale,scale);
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side*gap,sink+(side<0?6:0)*p);
      ctx.rotate(side*(.08+p*.58));
      ctx.fillStyle="#192a38";
      ctx.beginPath();
      if(side<0){
        ctx.moveTo(-71,-6);ctx.lineTo(-59,12);ctx.lineTo(-8,12);ctx.lineTo(-10,-10);
        ctx.lineTo(-65,-12);ctx.closePath();ctx.fill();
        ctx.fillStyle="#243848";ctx.fillRect(-39,-23,26,14);
        ctx.fillRect(-34,-30,11,8);
      }else{
        ctx.moveTo(9,-11);ctx.lineTo(65,-11);ctx.lineTo(69,-7);ctx.lineTo(41,12);ctx.lineTo(10,12);
        ctx.closePath();ctx.fill();
        ctx.fillStyle="#243848";ctx.fillRect(14,-23,19,14);
        ctx.fillRect(35,-28,15,11);
      }
      ctx.strokeStyle="#a56c4f";ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(side<0?-10:9,-12);ctx.lineTo(side<0?-8:10,12);ctx.stroke();
      ctx.restore();
    }
    // Orange light remains in the split seam as it sinks.
    if(p<.68){
      ctx.fillStyle="rgba(255,174,64,"+(1-p/.68)*.8+")";
      ctx.beginPath();ctx.ellipse(0,sink-10,13+11*p,30*(1-p),0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function drawShip(ship){
    if(ship.dead>0){drawSplitShip(ship);return;}
    const band=BANDS[ship.lane],x=project(ship.wx);
    if(x<-150||x>W+150)return;
    ctx.save();ctx.translate(x,band.y+Math.sin(wavePhase*2+ship.phase)*1.5);
    ctx.scale((band.speed>0?1:-1)*band.scale,band.scale);
    ctx.fillStyle="#0a233137";ctx.beginPath();ctx.ellipse(-3,14,89,8,0,0,Math.PI*2);ctx.fill();
    shipSilhouette();
    ctx.restore();
  }
  function drawShot(t){
    const x=project(t.wx);ctx.save();ctx.shadowColor="#ffe8b0";ctx.shadowBlur=17;
    for(let i=0;i<15;i++){
      const y=t.y+i*8+6,opacity=(1-i/15)*.91;
      ctx.fillStyle="rgba(255,"+Math.floor(235-i*6)+","+Math.floor(160-i*8)+","+opacity+")";
      ctx.beginPath();ctx.ellipse(x,y,4+i*.48,3+i*.25,0,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=22;ctx.fillStyle="#fffeed";
    ctx.beginPath();ctx.ellipse(x,t.y,5.5,9,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawDestruction(){
    ctx.save();
    rings.forEach(p=>{
      const f=p.age/p.dur,x=project(p.wx);
      ctx.globalAlpha=(1-f)*.94;
      ctx.lineWidth=5*(1-f)+1.5;ctx.strokeStyle="#ffe5a6";
      ctx.shadowColor="#ff8e44";ctx.shadowBlur=23;
      ctx.beginPath();ctx.ellipse(x,p.y,18+80*f,10+47*f,0,0,Math.PI*2);ctx.stroke();
    });
    sparks.forEach(p=>{
      const f=p.age/p.dur,x=project(p.wx);
      ctx.globalAlpha=(1-f)*.99;ctx.fillStyle=Math.sin(p.age*20)>.2?"#fff1aa":"#ec7a42";
      ctx.shadowColor="#ff8e52";ctx.shadowBlur=15;
      ctx.beginPath();ctx.arc(x,p.y,p.r*(1-f*.6),0,Math.PI*2);ctx.fill();
    });
    smoke.forEach(p=>{
      const f=p.age/p.dur,x=project(p.wx);
      ctx.globalAlpha=(1-f)*.44;
      ctx.fillStyle=f<.27?"#ad7760":"#172331";
      ctx.shadowBlur=5;ctx.shadowColor="#0c1018";
      ctx.beginPath();ctx.arc(x,p.y,p.r*(1+f*.9),0,Math.PI*2);ctx.fill();
    });
    boomWords.forEach(p=>{
      const f=p.age/p.dur,x=project(p.wx);
      ctx.globalAlpha=(1-f)*.98;
      ctx.font="900 "+Math.floor(33+f*18)+"px system-ui,sans-serif";
      ctx.textAlign="center";ctx.lineWidth=5;ctx.strokeStyle="#501e0d";
      ctx.strokeText("ズガーンッ！",x,p.y-35*f);
      ctx.fillStyle="#ffe3a4";ctx.fillText("ズガーンッ！",x,p.y-35*f);
    });
    ctx.restore();
  }
  function reticle(){
    ctx.save();ctx.strokeStyle="rgba(253,243,198,.90)";ctx.lineWidth=2;
    ctx.shadowColor="#d9eed0";ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.moveTo(CX,CY-66);ctx.lineTo(CX,CY-16);
    ctx.moveTo(CX,CY+16);ctx.lineTo(CX,CY+66);
    ctx.moveTo(CX-68,CY);ctx.lineTo(CX-15,CY);
    ctx.moveTo(CX+15,CY);ctx.lineTo(CX+68,CY);ctx.stroke();
    ctx.beginPath();ctx.arc(CX,CY,15,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    ctx.save();ctx.strokeStyle="#e9d6a977";ctx.lineWidth=1;
    for(let d=-76;d<=76;d+=12){
      if(Math.abs(d)<22)continue;
      ctx.beginPath();ctx.moveTo(CX-7,CY+d);ctx.lineTo(CX+7,CY+d);ctx.stroke();
    }
    ctx.restore();
  }
  function rounded(x,y,w,h,r){
    r=Math.max(1,Math.min(r,w/2,h/2));
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  }
  function drawView(){
    // The scene OUTSIDE the rectangular viewing glass remains visible but dark.
    ctx.fillStyle="#070d15";ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.45;drawSkyAndSea();ships.forEach(drawShip);ctx.restore();
    const outerFade=ctx.createLinearGradient(0,0,0,H);
    outerFade.addColorStop(0,"rgba(0,0,0,.80)");outerFade.addColorStop(.5,"rgba(0,0,0,.60)");
    outerFade.addColorStop(1,"rgba(0,0,0,.86)");
    ctx.fillStyle=outerFade;ctx.fillRect(0,0,W,H);
    // Lens glass has softly rounded corners, zooms the world by 1.17x.
    ctx.save();rounded(VIEW.x,VIEW.y,VIEW.w,VIEW.h,VIEW.r);ctx.clip();
    ctx.translate(CX,CY);ctx.scale(VIEW.zoom,VIEW.zoom);ctx.translate(-CX,-CY);
    drawSkyAndSea();
    ships.forEach(drawShip);
    shots.forEach(drawShot);drawDestruction();
    ctx.restore();
    ctx.save();rounded(VIEW.x,VIEW.y,VIEW.w,VIEW.h,VIEW.r);ctx.clip();reticle();
    // Darker at edges of the magnifying glass, like looking down a physical periscope.
    const vg=ctx.createRadialGradient(CX,CY,120,CX,CY,470);
    vg.addColorStop(0,"rgba(0,0,0,0)");
    vg.addColorStop(.8,"rgba(0,0,0,.07)");
    vg.addColorStop(1,"rgba(0,0,0,.60)");
    ctx.fillStyle=vg;ctx.fillRect(VIEW.x,VIEW.y,VIEW.w,VIEW.h);
    if(flash>0){ctx.fillStyle="rgba(255,199,104,"+flash*.62+")";ctx.fillRect(VIEW.x,VIEW.y,VIEW.w,VIEW.h);}
    ctx.restore();
    ctx.save();
    ctx.shadowColor="#03070bbb";ctx.shadowBlur=24;
    rounded(VIEW.x,VIEW.y,VIEW.w,VIEW.h,VIEW.r);ctx.strokeStyle="#05090f";ctx.lineWidth=23;ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle="#52606b";ctx.lineWidth=7;ctx.stroke();
    rounded(VIEW.x+5,VIEW.y+5,VIEW.w-10,VIEW.h-10,VIEW.r-4);
    ctx.strokeStyle="rgba(232,211,166,.27)";ctx.lineWidth=1.6;ctx.stroke();
    // Corner fasteners: enough framing to suggest machinery without masking the sea.
    ctx.fillStyle="#819099";
    for(const [sx,sy] of [[VIEW.x-7,VIEW.y-8],[VIEW.x+VIEW.w+7,VIEW.y-8],
                           [VIEW.x-7,VIEW.y+VIEW.h+8],[VIEW.x+VIEW.w+7,VIEW.y+VIEW.h+8]]){
      ctx.beginPath();ctx.arc(sx,sy,5.2,0,Math.PI*2);ctx.fill();
    }
    ctx.font="700 13px ui-monospace,monospace";
    ctx.fillStyle="rgba(250,237,205,.76)";
    ctx.fillText("SCOPE  ×1.17",VIEW.x+23,VIEW.y+30);
    ctx.fillText("PERISCOPE / DEPTH 03",VIEW.x+23,VIEW.y+VIEW.h-20);
    ctx.textAlign="right";
    ctx.fillText("100  /  200  /  500 PTS",VIEW.x+VIEW.w-23,VIEW.y+VIEW.h-20);
    ctx.restore();
  }
  function draw(){
    ctx.save();
    if(shakeTime>0)ctx.translate(Math.sin(wavePhase*87)*shakeTime*22,Math.cos(wavePhase*107)*shakeTime*14);
    drawView();
    ctx.restore();
  }
  function loop(ms){
    const now=ms/1000,dt=Math.min(.045,Math.max(0,(ms-frameLast)/1000||.016));
    frameLast=ms;animate(dt,now);draw();requestAnimationFrame(loop);
  }
  function changeBearing(delta){
    if(state!=="playing")return;
    bearing=clamp(bearing+delta,-42,42);updateHUD();
  }
  function bindHold(button,dir){
    button.addEventListener("pointerdown",e=>{
      if(state!=="playing")return;
      holdDir=dir;changeBearing(dir*1.4);
      button.classList.add("held");
      try{button.setPointerCapture(e.pointerId);}catch(e){}
      e.preventDefault();
    });
    for(const ev of ["pointerup","pointercancel","lostpointercapture"]){
      button.addEventListener(ev,()=>{
        if(holdDir===dir)holdDir=0;
        button.classList.remove("held");
      });
    }
  }
  bindHold(leftBtn,-1);bindHold(rightBtn,1);
  canvas.addEventListener("pointerdown",e=>{
    if(state!=="playing")return;
    const box=canvas.getBoundingClientRect();
    const x=(e.clientX-box.left)/box.width*W,y=(e.clientY-box.top)/box.height*H;
    if(x<20||x>W-20||y<20||y>H-20)return;
    activePointer=e.pointerId;lastPointerX=e.clientX;
    canvas.classList.add("dragging");
    try{canvas.setPointerCapture(e.pointerId);}catch(err){}
    e.preventDefault();
  });
  canvas.addEventListener("pointermove",e=>{
    if(activePointer!==e.pointerId||state!=="playing")return;
    const dx=e.clientX-lastPointerX;lastPointerX=e.clientX;
    const box=canvas.getBoundingClientRect();
    changeBearing(dx/box.width*130);
  });
  for(const ev of ["pointercancel","pointerup","lostpointercapture"])
    canvas.addEventListener(ev,e=>{
      if(activePointer===e.pointerId){activePointer=null;canvas.classList.remove("dragging");}
    });
  window.addEventListener("keydown",e=>{
    if(["ArrowLeft","ArrowRight","Space","Enter","KeyR"].includes(e.code))e.preventDefault();
    if(e.code==="ArrowLeft")holdDir=-1;
    if(e.code==="ArrowRight")holdDir=1;
    if(e.code==="Space"&&!e.repeat){if(state==="playing")fire();else startGame();}
    if(e.code==="Enter"&&(state==="ready"||state==="over"))startGame();
    if(e.code==="KeyR"&&state==="over")startGame();
  });
  window.addEventListener("keyup",e=>{
    if(e.code==="ArrowLeft"&&holdDir===-1)holdDir=0;
    if(e.code==="ArrowRight"&&holdDir===1)holdDir=0;
  });
  window.addEventListener("blur",()=>holdDir=0);
  seBtn.addEventListener("click",()=>{
    prefs.isSeOn=!prefs.isSeOn;
    seBtn.textContent=prefs.isSeOn?"🔔 SE ON":"🔕 SE OFF";
    seBtn.classList.toggle("active",prefs.isSeOn);
  });
  voiceBtn.addEventListener("click",()=>{
    prefs.isVoiceOn=!prefs.isVoiceOn;
    voiceBtn.textContent=prefs.isVoiceOn?"🗣️ ボイス ON":"🤐 ボイス OFF";
    voiceBtn.classList.toggle("active",prefs.isVoiceOn);
    if(!prefs.isVoiceOn&&window.speechSynthesis)window.speechSynthesis.cancel();
  });
  diffButtons.forEach(b=>b.addEventListener("click",()=>setDifficulty(b.dataset.difficulty)));
  fireBtn.addEventListener("click",fire);
  startBtn.addEventListener("click",startGame);
  setupFleet();updateHUD();requestAnimationFrame(loop);
})();