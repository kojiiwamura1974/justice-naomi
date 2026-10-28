/* Both white rays share a high off-screen apex. The visible shapes may be clipped. */
const hero = document.querySelector('.hero');
const portraitHero = matchMedia('(max-width: 767px) and (orientation: portrait)');
const landscapePhone = matchMedia('(orientation: landscape) and (max-width: 1050px) and (max-height: 500px)');
function updateBeams() {
  const w = hero.clientWidth, h = hero.clientHeight;
  const mobile = portraitHero.matches;
  const narrow = w < 768 && !landscapePhone.matches;
  const apex = {x:w/2, y:mobile ? -h*.6 : narrow ? -h*1.45 : -h*1.6};
  const baseY = h + 2;
  const leftInner = narrow ? w*.47 : w*.35;
  const rightInner = w-leftInner;
  const outerLeft = -w*1.35, outerRight=w*2.35;
  const polygons=mobile ? [[[apex.x,apex.y],[-w*.45,baseY],[w*1.45,baseY]],[]] : [[[apex.x,apex.y],[outerLeft,baseY],[leftInner,baseY]],[[apex.x,apex.y],[rightInner,baseY],[outerRight,baseY]]];
  document.querySelector('.hero-beams').setAttribute('viewBox',`0 0 ${w} ${h}`);
  ['beam-real','beam-manga'].forEach((id,i)=>document.getElementById(id).setAttribute('points',polygons[i].map(p=>p.join(',')).join(' ')));
  hero.dataset.geometry=JSON.stringify({w,h,apex,polygons});
}
new ResizeObserver(updateBeams).observe(hero);portraitHero.addEventListener('change',updateBeams);landscapePhone.addEventListener('change',updateBeams);updateBeams();

const gallery=document.getElementById('igLargeViewport');
const slides=[...gallery.querySelectorAll('.igLargeSlide')];
const counter=document.getElementById('igSlideNumber');
const prev=document.getElementById('igSlidePrev');
const next=document.getElementById('igSlideNext');
function currentIndex(){return Math.min(slides.length-1,Math.max(0,Math.round(gallery.scrollLeft/Math.max(1,gallery.clientWidth))))}
function updateGallery(){const index=currentIndex();counter.textContent=`${index+1} / ${slides.length}`;prev.disabled=index===0;next.disabled=index===slides.length-1;slides.forEach((s,i)=>{s.inert=i!==index;s.setAttribute('aria-hidden',String(i!==index))})}
function go(n){gallery.scrollTo({left:gallery.clientWidth*Math.min(slides.length-1,Math.max(0,currentIndex()+n)),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
prev.addEventListener('click',()=>go(-1));next.addEventListener('click',()=>go(1));gallery.addEventListener('scroll',updateGallery,{passive:true});
window.addEventListener('resize',()=>{gallery.scrollTo({left:0,behavior:'instant'});updateGallery()});updateGallery();
let instagramLoading;
function loadInstagram(){if(window.instgrm)return Promise.resolve();if(!instagramLoading)instagramLoading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://www.instagram.com/embed.js';s.async=true;s.onload=resolve;s.onerror=reject;document.body.append(s)});return instagramLoading}
function embed(url){const q=document.createElement('blockquote');q.className='instagram-media';q.dataset.instgrmPermalink=url;q.dataset.instgrmVersion='14';const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Instagramで投稿を見る ↗';q.append(a);return q}
document.querySelectorAll('.load-post').forEach(button=>button.addEventListener('click',async()=>{const panel=button.closest('.post-preview');button.disabled=true;button.textContent='読み込み中…';try{await loadInstagram();panel.replaceWith(embed(button.dataset.post));window.instgrm?.Embeds.process()}catch{button.disabled=false;button.textContent='再読み込み';const note=document.createElement('p');note.textContent='Instagramで直接ご覧いただけます。';panel.append(note)}}));
const details=document.getElementById('igAutoList');
details.addEventListener('toggle',async()=>{if(!details.open||details.dataset.loaded)return;details.dataset.loaded='true';const body=document.getElementById('igAutoListBody');body.replaceChildren(embed('https://www.instagram.com/justice__naomi/'));try{await loadInstagram();window.instgrm?.Embeds.process()}catch{details.dataset.loaded='';}});
