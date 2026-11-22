#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-games');
const stage = mkdtempSync(join(root, '.dist-games-'));
const origin = 'https://game.kozo-club.com';
const naomi = 'https://naomi.kozo-club.com';
const submarine = 'games/submarine';
const voices = [
  'endlost', 'endwon', 'high', 'hit_justice', 'hit_omigoto',
  'hit_rakushou', 'hit_touzen', 'hit_tsugi', 'hit_yatta',
  'miss_maji', 'miss_nai', 'miss_oshii', 'miss_tsugi', 'miss_uso'
];
const files = [
  'assets/favicon.svg',
  'games/race/cabinet.css',
  'games/race/cover.svg',
  'games/race/index.html',
  'games/race/rc.css',
  'games/race/rc.js',
  'games/race/audio/endwon.mp3',
  'games/race/audio/hit_justice.mp3',
  'games/race/audio/hit_yatta.mp3',
  'games/race/audio/miss_oshii.mp3',
  'games/race/audio/miss_uso.mp3',
  ...['game-v3.js', 'game-v3.css', 'cover.svg', 'portraits/justice-god03.jpg',
    ...['school', 'idol-peace', 'idol-ready', 'casual-wave', 'casual-cheer', 'idol-cry', 'school-cry', 'casual-cry'].map(p=>`portraits/${p}.webp`),
    ...voices.map(v=>`voice/${v}.mp3`)].map(f=>`${submarine}/${f}`)
];
const styles = `
:root{color-scheme:dark;--bg:#07151e;--panel:#102431;--text:#edf9fc;--muted:#acc5d0;--mint:#78e3ce;--rule:#294858}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse 100% 34rem at 50% 0,#163949,var(--bg));color:var(--text);font:1rem/1.65 system-ui,-apple-system,sans-serif}a{color:inherit}
.wrap{max-width:70rem;margin:auto;padding:0 1.25rem}.header,.footer{display:flex;gap:1rem;flex-wrap:wrap;align-items:center;justify-content:space-between}.header{min-height:4.25rem;border-bottom:1px solid var(--rule)}.brand{font-weight:800;letter-spacing:.16em}.small{font:700 .8rem/1.55 ui-monospace,monospace;letter-spacing:.12em;color:var(--mint);text-transform:uppercase}.header nav{display:flex;gap:1rem;align-items:center;font-size:.9rem}.hero{padding:4rem 0 2.25rem}.hero h1{font-size:clamp(2.8rem,7vw,6rem);letter-spacing:-.06em;line-height:1.05;margin:.3rem 0 .9rem}.hero p{color:var(--muted);margin:0}.games{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr));gap:1rem}.card{display:grid;grid-template-columns:minmax(10rem,48%) 1fr;grid-template-rows:auto;align-items:stretch;max-width:47rem;background:var(--panel);border:1px solid var(--rule);border-radius:1rem;overflow:hidden;text-decoration:none}.card:hover,.card:focus-visible{border-color:var(--mint);outline:2px solid var(--mint);outline-offset:3px}.visual{aspect-ratio:16/9;min-height:100%;width:100%;object-fit:cover;background:#0a2838}.copy{padding:1.25rem}.copy h2{font-size:clamp(1.05rem,2.8vw,1.58rem);line-height:1.25;margin:.35rem 0 .6rem}.copy p{font-size:.9rem;color:var(--muted);margin:0 0 .7rem}.play{color:var(--mint);font-weight:800}.notice{font-size:.87rem;color:var(--muted);max-width:47rem;margin:1.7rem 0 2.5rem}.footer{border-top:1px solid var(--rule);padding:1.3rem 0;font-size:.9rem;color:var(--muted)}.skip{position:absolute;left:1rem;top:-4rem;padding:.5rem;background:var(--bg)}.skip:focus{top:.5rem;z-index:1}
@media(max-width:36rem){.hero{padding:2.5rem 0 1.6rem}.card{grid-template-columns:1fr}.visual{min-height:0}.header nav{gap:.6rem}.copy{padding:1rem}}
`;
const t = {
  ja: { lang:'ja', localePath:'/', alternate:'/en/', swap:'English', name:'構想倶楽部 ゲームセンター', lead:'レトロな遊びを，ブラウザで．', game:'ジャスティスサブマリン', desc:'潜望鏡で狙いを定めて，一発ずつ．尚美と挑むエレメカ風の潜水艦ゲーム．', play:'遊ぶ', old:'旧サイトで遊ぶ', note:'自己ベストはブラウザにサイトごとに保存されます．以前の記録を使うときは，旧サイトで遊んでください．', skip:'ゲーム一覧へ' },
  en: { lang:'en', localePath:'/en/', alternate:'/', swap:'日本語', name:'Kozo Club Game Center', lead:'Retro games, right in your browser.', game:'Justice Submarine', desc:'Line up the periscope and make each shot count in this electromechanical-style game with Naomi.', play:'Play', old:'Play on the original site', note:'High scores are stored separately for each website. Visit the original site to use an existing score.', skip:'Skip to games' }
};
function portal(locale) {
  const x=t[locale];
  return `<!doctype html>
<html lang="${x.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${x.name}</title><meta name="description" content="${x.lead}"><meta name="theme-color" content="#07151e"><link rel="canonical" href="${origin}${x.localePath}"><link rel="alternate" hreflang="ja" href="${origin}/"><link rel="alternate" hreflang="en" href="${origin}/en/"><link rel="icon" href="/assets/favicon.svg"><style>${styles}</style></head>
<body><a class="skip" href="#games">${x.skip}</a><div class="wrap"><header class="header"><span class="brand">KOZO CLUB</span><nav aria-label="Navigation"><a href="${naomi}/">PROJECT NAOMI</a><a href="${x.alternate}" hreflang="${locale==='ja'?'en':'ja'}">${x.swap}</a></nav></header>
<main><section class="hero"><div class="small">KOZO CLUB ARCADE</div><h1>${x.name}</h1><p>${x.lead}</p></section>
<section id="games" class="games" aria-label="${x.skip}"><a class="card" href="/games/submarine/"><img class="visual" src="/games/submarine/cover.svg" alt=""><div class="copy"><div class="small">01 / SUBMARINE</div><h2>${x.game}</h2><p>${x.desc}</p><span class="play">${x.play} →</span></div></a><a class="card" href="/games/race/"><img class="visual" src="/games/race/cover.svg" alt=""><div class="copy"><div class="small">02 / RC RACING</div><h2>${locale==='ja'?'ジャスティスRC':'Justice RC'}</h2><p>${locale==='ja'?'上から見下ろすレトロなラジコンレース．3つのコースを駆け抜けよう．':'A top-down retro RC race with three courses.'}</p><span class="play">${x.play} →</span></div></a></section>
<p class="notice">${x.note} <a href="${naomi}/games/submarine/">${x.old}</a></p></main>
<footer class="footer"><a href="https://kozo-club.com/">KOZO CLUB</a><a href="${naomi}/">PROJECT NAOMI</a></footer></div></body></html>\n`;
}
function write(path, content) {
  const dest=join(stage,path);
  mkdirSync(dirname(dest),{recursive:true});
  writeFileSync(dest,content);
}
function replaceOne(content, from, to) {
  if(content.split(from).length!==2) throw new Error('Expected exactly one source marker: '+from);
  return content.replace(from,to);
}
try {
  for (const path of files) {
    const dest=join(stage,path);
    mkdirSync(dirname(dest),{recursive:true});
    cpSync(join(root,path),dest);
  }
  let html=readFileSync(join(root,submarine,'index.html'),'utf8');
  html=replaceOne(html, `href="${naomi}/${submarine}/"`,`href="${origin}/${submarine}/"`);
  html=replaceOne(html,'<a href="/games/">← GAME MENU</a>','<a href="/">← GAME MENU</a>');
  html=replaceOne(html,'<a href="/">PROJECT NAOMI</a>',`<a href="${naomi}/">PROJECT NAOMI</a>`);
  write(`${submarine}/index.html`,html);
  write('index.html',portal('ja'));
  write('en/index.html',portal('en'));
  write('404.html','<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ページが見つかりません</title><h1>ページが見つかりません</h1><p><a href="/">ゲーム一覧へ</a></p></html>\n');
  write('_redirects','/games / 302\n/games/ / 302\n/en/games /en/ 302\n/en/games/ /en/ 302\n');
  if(existsSync(out)) rmSync(out,{recursive:true});
  renameSync(stage,out);
  console.log(`Games output ready: ${out} (${files.length} copied assets)`);
} catch(error) {
  rmSync(stage,{recursive:true,force:true});
  throw error;
}
