/* SUBMARINE v3 — ELE-MECHA. A long air-pressure hiss accompanies each single
   torpedo until impact; then a resonant boom and 5s of sinking afterglow.
   Small battleships, destroyers, and nearly-hidden submarines share the same
   deterministic fleet across all difficulties. Naomi assets are untouched. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const canvas=$("seaCanvas"),ctx=canvas.getContext("2d",{alpha:false});
  const W=960,H=600,CX=480,CY=300,SEA_HORIZON=285,WORLD=5600;
  const VIEW={x:102,y:62,w:756,h:476,r:32,zoom:1.17};
  const TORPEDO_SPEED=116;       // one long "プシューーー…" to the target
  const MISS_RELOAD=1.55;        // no firing while a shot is travelling
  const SINK_SECONDS=5.0;       // savor the split / burn / slow sinking
  const BANDS=[
    {y:398,scale:.65,speed:37,points:100,kind:"battleship"},
    {y:338,scale:.39,speed:-53,points:200,kind:"destroyer"},
    {y:290,scale:.205,speed:88,points:500,kind:"submarine"}
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
  let elapsed=0,timeLeft=60,checkpointIndex=0,holdDir=0,reloadTimer=0,sinkingHold=0,gameSec=0,wavePhase=0;
  let ships=[],shots=[],sparks=[],smoke=[],rings=[],boomWords=[];
  let frameLast=0,activePointer=null,lastPointerX=0;
  let reactionExpires=0,toastExpires=0,shakeTime=0,flash=0,voiceTimer=0,lastMiss=-99;
  let audio=null,flightAudio=null,pendingCheer=null,runNumber=0;
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
    stopFlightSound(.04);
    state="playing";runNumber++;score=0;bearing=0;holdDir=0;elapsed=0;timeLeft=60;checkpointIndex=0;
    reloadTimer=0;sinkingHold=0;pendingCheer=null;gameSec=0;wavePhase=0;flash=0;shakeTime=0;
    shots=[];sparks=[];smoke=[];rings=[];boomWords=[];lastMiss=-99;
    setupFleet();overlay.classList.remove("active");$toast.classList.remove("visible");
    updateHUD();updateFireControl();
    speak("いけー！　狙って，狙って！","happy",1.3);
    sound("start");
  }
  function endGame(reason){
    if(state!=="playing")return;
    state="over";holdDir=0;stopFlightSound(.12);pendingCheer=null;updateFireControl();
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
  function updateFireControl(){
    const travelling=shots.length>0;
    const aftermath=sinkingHold>0;
    const reloading=reloadTimer>0;
    fireBtn.disabled=state!=="playing"||travelling||aftermath||reloading;
    fireBtn.textContent=state!=="playing"?"FIRE":
      aftermath?"余韻…":travelling?"航走中…":reloading?"装填中…":"FIRE";
  }
  function fire(){
    // One torpedo at a time. Never interrupt the impact and sinking afterglow.
    if(state!=="playing"||shots.length>0||reloadTimer>0||sinkingHold>0)return;
    shots.push({wx:cameraWorld(),y:545,py:545,age:0});
    startFlightSound();
    updateFireControl();
  }
  function impact(ship){
    ship.dead=SINK_SECONDS;
    const band=BANDS[ship.lane],x=ship.wx;
    score+=band.points;
    if(score>best)best=score;
    shakeTime=.42;flash=.42;
    sinkingHold=SINK_SECONDS;
    reloadTimer=MISS_RELOAD;
    stopFlightSound(.06);
    const fx=band.kind==="battleship"?1:band.kind==="destroyer"?.77:.48;
    rings.push({wx:x,y:band.y,age:0,dur:1.45,fx});
    rings.push({wx:x,y:band.y,age:-.24,dur:1.6,fx});
    boomWords.push({wx:x,y:band.y-25*fx,age:0,dur:1.9,fx});
    for(let i=0;i<65;i++){
      const ang=rand(0,Math.PI*2),v=rand(25,185)*fx;
      sparks.push({wx:x,y:band.y,vx:Math.cos(ang)*v*1.4,vy:Math.sin(ang)*v-rand(12,76)*fx,
        age:0,dur:rand(.6,1.7),r:rand(1.5,4.7)*fx});
    }
    for(let i=0;i<24;i++){
      smoke.push({wx:x+rand(-22,22)*fx,y:band.y-rand(0,17)*fx,
        vx:rand(-19,19),vy:-rand(17,65)*fx,
        age:0,dur:rand(1.7,3.8),r:rand(10,22)*fx});
    }
    sound("boom"); // "ズガーンッ" starts only at the actual impact.
    const lines=[
      "やったー！　戦艦が沈む！",
      "命中！　駆逐艦が割れた！",
      "すごい！　潜水艦を見つけた！"
    ];
    // The explosion takes precedence over Naomi's speech for its first beat.
    naomi.setState("happy");
    naomi.speechText.textContent=lines[ship.lane];
    pendingCheer={at:elapsed+.85,line:lines[ship.lane],run:runNumber};
    naomi.addFever(ship.lane===2?28:ship.lane===1?17:10);
    updateHUD();updateFireControl();
  }
  function audioContext(){
    if(!prefs.isSeOn)return null;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return null;
      if(!audio)audio=new AC();
      if(audio.state==="suspended")audio.resume();
      return audio;
    }catch(err){return null;}
  }
  function noiseBuffer(ac,duration){
    const len=Math.floor(ac.sampleRate*duration);
    const b=ac.createBuffer(1,len,ac.sampleRate);
    const ch=b.getChannelData(0);
    let low=0;
    for(let i=0;i<len;i++){
      const white=Math.random()*2-1;
      low=low*.55+white*.45;
      ch[i]=white*.65+low*.35;
    }
    return b;
  }
  function startFlightSound(){
    stopFlightSound(.03);
    const ac=audioContext();
    if(!ac)return;
    try{
      const t=ac.currentTime;
      const noise=ac.createBufferSource(),f=ac.createBiquadFilter(),gain=ac.createGain();
      noise.buffer=noiseBuffer(ac,.75);noise.loop=true;
      f.type="bandpass";f.Q.value=.72;
      f.frequency.setValueAtTime(1180,t);
      f.frequency.exponentialRampToValueAtTime(580,t+2.5);
      gain.gain.setValueAtTime(.0001,t);
      gain.gain.linearRampToValueAtTime(.16,t+.12);
      noise.connect(f);f.connect(gain);gain.connect(ac.destination);
      noise.start(t);
      // A soft pressure tone underneath the drawn-out air hiss; no launch "pop".
      const osc=ac.createOscillator(),og=ac.createGain();
      osc.type="sine";osc.frequency.setValueAtTime(180,t);
      osc.frequency.exponentialRampToValueAtTime(90,t+2.6);
      og.gain.setValueAtTime(.0001,t);
      og.gain.linearRampToValueAtTime(.023,t+.1);
      osc.connect(og);og.connect(ac.destination);osc.start(t);
      flightAudio={noise,gain,osc,og,ac};
    }catch(e){flightAudio=null;}
  }
  function stopFlightSound(fade=.15){
    const s=flightAudio;
    if(!s)return;
    flightAudio=null;
    try{
      const t=s.ac.currentTime,end=t+fade;
      for(const g of [s.gain,s.og]){
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(.0001,g.gain.value),t);
        g.gain.linearRampToValueAtTime(.0001,end);
      }
      s.noise.stop(end+.02);s.osc.stop(end+.02);
    }catch(e){}
  }
  function sound(kind){
    const ac=audioContext();
    if(!ac)return;
    try{
      const t=ac.currentTime;
      const tone=(start,end,d,type="triangle",volume=.05,when=0)=>{
        const osc=ac.createOscillator(),g=ac.createGain(),at=t+when;
        osc.type=type;
        osc.frequency.setValueAtTime(start,at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(30,end),at+d);
        g.gain.setValueAtTime(.0001,at);
        g.gain.exponentialRampToValueAtTime(volume,at+.03);
        g.gain.exponentialRampToValueAtTime(.0001,at+d);
        osc.connect(g);g.connect(ac.destination);osc.start(at);osc.stop(at+d+.02);
      };
      if(kind==="boom"){
        // A deep, prolonged "ZUGAAN", then the low rumble keeps decaying.
        tone(156,38,1.65,"sawtooth",.105);
        tone(82,30,2.2,"sine",.18,.025);
        tone(360,84,1.1,"triangle",.07,.14);
        const duration=2.7;
        const src=ac.createBufferSource(),lp=ac.createBiquadFilter(),gain=ac.createGain();
        src.buffer=noiseBuffer(ac,duration);
        lp.type="lowpass";
        lp.frequency.setValueAtTime(1900,t);
        lp.frequency.exponentialRampToValueAtTime(180,t+duration);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(.23,t+.045);
        gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        src.connect(lp);lp.connect(gain);gain.connect(ac.destination);
        src.start(t);src.stop(t+duration);
      }else if(kind==="success"){
        tone(440,590,.19,"triangle",.047);tone(620,780,.21,"triangle",.06,.18);
      }else if(kind==="start"){
        tone(350,500,.12,"triangle",.04);
      }else if(kind==="end"){
        tone(260,110,.4,"triangle",.04);
      }
    }catch(err){}
  }
  function animate(dt,now){
    wavePhase+=dt;reloadTimer=Math.max(0,reloadTimer-dt);
    sinkingHold=Math.max(0,sinkingHold-dt);shakeTime=Math.max(0,shakeTime-dt);
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
    updateFireControl();
    // Sparks and smoke continue during the end state, but firing is disabled.
    if(state!=="playing"){
      if(now>=toastExpires)$toast.classList.remove("visible");
      return;
    }
    for(const ship of ships){
      if(ship.dead>0&&Math.random()<.35){
        const p=(SINK_SECONDS-ship.dead)/SINK_SECONDS;
        if(p<.88)smoke.push({wx:ship.wx+rand(-16,16),y:BANDS[ship.lane].y+p*88-18,
          vx:rand(-13,13),vy:-rand(25,68),age:0,dur:rand(1.0,2.1),r:rand(8,18)});
      }
    }
    shots=shots.filter(shot=>{
      shot.py=shot.y;shot.y-=TORPEDO_SPEED*dt;shot.age+=dt;
      let target=null;
      for(let lane=0;lane<BANDS.length&&!target;lane++){
        const band=BANDS[lane];
        if(shot.py>band.y&&shot.y<=band.y){
          for(const ship of ships){
            if(ship.lane!==lane||ship.dead>0)continue;
            const dx=Math.abs(shot.wx-ship.wx)*.57;
            const hitRadius=48*band.scale*LEVELS[difficulty].hitScale+2;
            if(dx<hitRadius){target=ship;break;}
          }
        }
      }
      if(target){impact(target);return false;}
      if(shot.y<SEA_HORIZON-14){
        stopFlightSound(.22);
        reloadTimer=MISS_RELOAD;
        if(now-lastMiss>3.1&&Math.random()<.65){lastMiss=now;speak("惜しい！　先を狙って！","sad",1.2);}
        return false;
      }
      return true;
    });
    elapsed=Math.min(60,elapsed+dt);timeLeft=Math.max(0,60-elapsed);
    if(pendingCheer&&elapsed>=pendingCheer.at){
      if(pendingCheer.run===runNumber&&state==="playing")speak(pendingCheer.line,"happy",2.7);
      pendingCheer=null;
    }
    if(elapsed >= (checkpointIndex+1)*20-1e-7)onCheckpoint();
    updateFireControl();
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
  function shipSilhouette(kind){
    if(kind==="submarine"){
      // The distant silhouette is almost swallowed by the horizon:
      // long narrow dark hull, tiny conning tower and a barely-visible periscope.
      ctx.fillStyle="#253d4a";
      ctx.beginPath();ctx.moveTo(-66,-1);ctx.quadraticCurveTo(-63,-8,-47,-7);
      ctx.lineTo(43,-7);ctx.quadraticCurveTo(62,-6,67,0);
      ctx.lineTo(58,7);ctx.lineTo(-56,7);ctx.closePath();ctx.fill();
      ctx.fillStyle="#263943";ctx.fillRect(-12,-21,21,16);
      ctx.fillRect(-2,-27,4,8);
      ctx.strokeStyle="#50606b";ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(-57,4);ctx.lineTo(60,4);ctx.stroke();
      ctx.strokeStyle="rgba(175,208,220,.45)";ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(-90,5);ctx.lineTo(-69,4);
      ctx.moveTo(64,4);ctx.lineTo(91,5);ctx.stroke();
      return;
    }
    if(kind==="destroyer"){
      // A low fast destroyer, sharp bow, small bridge, two thin smokestacks.
      ctx.fillStyle="#172a3a";ctx.beginPath();
      ctx.moveTo(-79,-6);ctx.lineTo(-66,10);ctx.lineTo(43,10);
      ctx.lineTo(76,-6);ctx.lineTo(69,-9);ctx.lineTo(-71,-9);ctx.closePath();ctx.fill();
      ctx.fillStyle="#203346";ctx.fillRect(-27,-20,52,13);
      ctx.fillRect(-17,-35,20,16);
      ctx.fillRect(22,-29,8,15);ctx.fillRect(36,-26,7,13);
      ctx.fillRect(-49,-22,12,12);ctx.fillRect(49,-20,12,11);
      ctx.strokeStyle="#6e7e85";ctx.lineWidth=2;ctx.beginPath();
      ctx.moveTo(-5,-36);ctx.lineTo(-5,-53);
      ctx.moveTo(-52,-11);ctx.lineTo(-59,-16);
      ctx.moveTo(56,-10);ctx.lineTo(67,-16);ctx.stroke();
      ctx.strokeStyle="#3b5666";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-69,-8);ctx.lineTo(68,-8);ctx.stroke();
      return;
    }
    // Battleship: multiple heavy gun turrets, twin masts, armored bridge.
    ctx.fillStyle="#182b3c";ctx.beginPath();
    ctx.moveTo(-80,-7);ctx.lineTo(-62,13);ctx.lineTo(49,13);
    ctx.lineTo(82,-9);ctx.lineTo(75,-13);ctx.lineTo(-72,-13);ctx.closePath();ctx.fill();
    ctx.fillStyle="#263c4e";ctx.fillRect(-38,-28,80,16);
    ctx.fillRect(-20,-50,31,23);ctx.fillRect(-14,-63,17,14);
    ctx.fillRect(-64,-27,21,15);ctx.fillRect(49,-27,19,14);
    ctx.fillRect(-48,-31,11,10);ctx.fillRect(39,-30,14,10);
    ctx.strokeStyle="#586978";ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(-60,-26);ctx.lineTo(-88,-28);
    ctx.moveTo(-60,-22);ctx.lineTo(-88,-24);
    ctx.moveTo(62,-25);ctx.lineTo(93,-29);
    ctx.moveTo(62,-22);ctx.lineTo(93,-25);
    ctx.stroke();
    ctx.strokeStyle="#506676";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-2,-62);ctx.lineTo(-2,-84);
    ctx.moveTo(22,-28);ctx.lineTo(22,-61);ctx.stroke();
    ctx.fillStyle="#415b6b";ctx.fillRect(-15,-45,9,5);ctx.fillRect(-2,-45,9,5);
    ctx.strokeStyle="#77909d";ctx.lineWidth=1.3;ctx.beginPath();
    ctx.moveTo(-69,-12);ctx.lineTo(73,-12);ctx.stroke();
  }
  function drawSplitShip(ship){
    const band=BANDS[ship.lane],sx=project(ship.wx);
    if(sx<-150||sx>W+150)return;
    const dir=band.speed>0?1:-1,scale=band.scale;
    const p=clamp((SINK_SECONDS-ship.dead)/SINK_SECONDS,0,1);
    const sinking=clamp((p-.17)/.83,0,1);
    const sink=Math.pow(sinking,1.23)*205;
    const separation=Math.pow(p,1.05)*34;
    const bob=Math.sin(wavePhase*2+ship.phase)*1.3;
    ctx.save();ctx.translate(sx,band.y+bob);ctx.scale(dir*scale,scale);
    // The first beat is a stationary rupture, then the two pieces roll apart.
    for(const side of [-1,1]){
      ctx.save();
      ctx.translate(side*separation,sink+Math.sin(p*8+side)*4*p);
      ctx.rotate(side*(.05+Math.pow(sinking,.9)*.66));
      ctx.beginPath();ctx.rect(side<0?-100:0,-110,100,150);ctx.clip();
      shipSilhouette(band.kind);
      ctx.restore();
    }
    if(sinking<.82){
      const light=clamp((.82-sinking)/.82,0,1)*.77;
      ctx.fillStyle="rgba(255,162,68,"+light+")";
      ctx.shadowColor="#ff9e40";ctx.shadowBlur=25;
      ctx.beginPath();ctx.ellipse(0,sink-16,16+12*p,22*(1-p)+3,0,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
    }
    // Surface boils longer than the initial explosion.
    ctx.strokeStyle="rgba(175,214,224,"+(1-p)*.38+")";
    ctx.lineWidth=3.4;ctx.beginPath();
    ctx.ellipse(0,12,28+92*p,6+12*p,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  function drawShip(ship){
    if(ship.dead>0){drawSplitShip(ship);return;}
    const band=BANDS[ship.lane],x=project(ship.wx);
    if(x<-150||x>W+150)return;
    ctx.save();
    ctx.globalAlpha=band.kind==="submarine"?.48:band.kind==="destroyer"?.80:.92;
    ctx.translate(x,band.y+Math.sin(wavePhase*2+ship.phase)*1.1);
    ctx.scale((band.speed>0?1:-1)*band.scale,band.scale);
    ctx.fillStyle="rgba(13,37,49,.2)";
    ctx.beginPath();ctx.ellipse(-4,11,92,5,0,0,Math.PI*2);ctx.fill();
    shipSilhouette(band.kind);
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
      if(p.age<0)return;
      const f=clamp(p.age/p.dur,0,1),x=project(p.wx);
      ctx.globalAlpha=(1-f)*.92;ctx.lineWidth=(5*(1-f)+1)*p.fx;
      ctx.strokeStyle="#ffe8bd";ctx.shadowColor="#ff9e58";ctx.shadowBlur=24;
      ctx.beginPath();ctx.ellipse(x,p.y,(16+108*f)*p.fx,(7+59*f)*p.fx,0,0,Math.PI*2);ctx.stroke();
    });
    sparks.forEach(p=>{
      const f=p.age/p.dur,x=project(p.wx);
      ctx.globalAlpha=Math.pow(1-f,.9)*.98;
      ctx.fillStyle=f<.5?"#fff0ad":"#e87c4c";
      ctx.shadowColor="#ff9c57";ctx.shadowBlur=16;
      ctx.beginPath();ctx.arc(x,p.y,p.r*(1-f*.6),0,Math.PI*2);ctx.fill();
    });
    smoke.forEach(p=>{
      const f=p.age/p.dur,x=project(p.wx);
      ctx.globalAlpha=(1-f)*.47;
      ctx.fillStyle=f<.25?"#ad8068":"#152735";
      ctx.shadowBlur=9;ctx.shadowColor="#111720";
      ctx.beginPath();ctx.arc(x,p.y,p.r*(1+f*1.2),0,Math.PI*2);ctx.fill();
    });
    boomWords.forEach(p=>{
      const f=clamp(p.age/p.dur,0,1),x=project(p.wx);
      ctx.globalAlpha=Math.pow(1-f,.8);
      ctx.font="900 "+Math.floor((32+f*13)*p.fx)+"px system-ui,sans-serif";
      ctx.textAlign="center";ctx.lineWidth=5*p.fx;ctx.strokeStyle="#4d2519";
      ctx.strokeText("ズガーンッ！",x,p.y-26*f);
      ctx.fillStyle="#ffe0ad";ctx.fillText("ズガーンッ！",x,p.y-26*f);
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
    if(!prefs.isSeOn)stopFlightSound(.08);
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
  setupFleet();setDifficulty("normal");updateFireControl();requestAnimationFrame(loop);
})();