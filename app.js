/* Both white rays share a high off-screen apex. The visible shapes may be clipped. */
const hero = document.querySelector('.hero');
const portraitHero = matchMedia('(max-width: 767px) and (orientation: portrait)');
const landscapePhone = matchMedia('(orientation: landscape) and (max-width: 1050px) and (max-height: 500px)');
function updateBeams() {
  const stage = document.querySelector('.hero-stage');
  const bounds = stage && !portraitHero.matches && !landscapePhone.matches ? stage : hero;
  const w = bounds.clientWidth, h = bounds.clientHeight;
  const mobile = portraitHero.matches;
  const narrow = w < 768 && !landscapePhone.matches;
  const apex = {x:w/2, y:mobile ? -h*.12 : narrow ? -h*1.45 : -h*1.6};
  const baseY = h + 2;
  const leftInner = narrow ? w*.47 : w*.35;
  const rightInner = w-leftInner;
  const outerLeft = -w*1.35, outerRight=w*2.35;
  const polygons=mobile ? [[[apex.x,apex.y],[-w*.45,baseY],[w*1.45,baseY]],[]] : [[[apex.x,apex.y],[outerLeft,baseY],[leftInner,baseY]],[[apex.x,apex.y],[rightInner,baseY],[outerRight,baseY]]];
  document.querySelector('.hero-beams').setAttribute('viewBox',`0 0 ${w} ${h}`);
  ['beam-real','beam-manga'].forEach((id,i)=>document.getElementById(id).setAttribute('points',polygons[i].map(p=>p.join(',')).join(' ')));
  hero.dataset.geometry=JSON.stringify({w,h,apex,polygons});
}
const beamResizeObserver = new ResizeObserver(updateBeams);beamResizeObserver.observe(hero);beamResizeObserver.observe(document.querySelector('.hero-stage'));portraitHero.addEventListener('change',updateBeams);landscapePhone.addEventListener('change',updateBeams);updateBeams();

const englishUI=document.documentElement.lang==='en';
let instagramLoading;
function loadInstagram(){if(window.instgrm)return Promise.resolve();if(!instagramLoading)instagramLoading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://www.instagram.com/embed.js';s.async=true;s.onload=resolve;s.onerror=()=>{instagramLoading=undefined;s.remove();reject(new Error('Instagram embed unavailable'))};document.body.append(s)});return instagramLoading}
function embed(url){const q=document.createElement('blockquote');q.className='instagram-media';q.dataset.instgrmPermalink=url;q.dataset.instgrmVersion='14';const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=englishUI?'View this post on Instagram ↗':'Instagramで投稿を見る ↗';q.append(a);return q}
const details=document.getElementById('igAutoList');
details.addEventListener('toggle',async()=>{if(!details.open||details.dataset.loaded)return;details.dataset.loaded='true';const body=document.getElementById('igAutoListBody');body.replaceChildren(embed('https://www.instagram.com/justice__naomi/'));try{await loadInstagram();window.instgrm?.Embeds.process()}catch{details.dataset.loaded='';}});

