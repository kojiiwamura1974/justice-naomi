#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-games');
const stage = mkdtempSync(join(root, '.dist-games-'));
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
function write(path, content) {
  const dest=join(stage,path);
  mkdirSync(dirname(dest),{recursive:true});
  writeFileSync(dest,content);
}
try {
  for (const path of files) {
    const dest=join(stage,path);
    mkdirSync(dirname(dest),{recursive:true});
    cpSync(join(root,path),dest);
  }
  // No legacy game or catalog HTML: known old URLs redirect to Project Naomi.
  write('404.html',`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ページが見つかりません</title><h1>ページが見つかりません</h1><p><a href="${naomi}/games/">尚美とゲームへ</a></p></html>\n`);
  // Compatibility for existing video links; keep 302 so the independent domain may be reused.
  write('_redirects', [
    '/ https://naomi.kozo-club.com/games/ 302',
    '/index https://naomi.kozo-club.com/games/ 302',
    '/index.html https://naomi.kozo-club.com/games/ 302',
    '/games https://naomi.kozo-club.com/games/ 302',
    '/games/ https://naomi.kozo-club.com/games/ 302',
    '/games/index.html https://naomi.kozo-club.com/games/ 302',
    '/en https://naomi.kozo-club.com/en/games/ 302',
    '/en/ https://naomi.kozo-club.com/en/games/ 302',
    '/en/index https://naomi.kozo-club.com/en/games/ 302',
    '/en/index.html https://naomi.kozo-club.com/en/games/ 302',
    '/en/games https://naomi.kozo-club.com/en/games/ 302',
    '/en/games/ https://naomi.kozo-club.com/en/games/ 302',
    '/en/games/index.html https://naomi.kozo-club.com/en/games/ 302',
    '/games/submarine https://naomi.kozo-club.com/games/justice-submarine/ 302',
    '/games/submarine/ https://naomi.kozo-club.com/games/justice-submarine/ 302',
    '/games/submarine/index https://naomi.kozo-club.com/games/justice-submarine/ 302',
    '/games/submarine/index.html https://naomi.kozo-club.com/games/justice-submarine/ 302',
    '/games/justice-submarine https://naomi.kozo-club.com/games/justice-submarine/ 302',
    '/games/justice-submarine/ https://naomi.kozo-club.com/games/justice-submarine/ 302',
    '/games/race https://naomi.kozo-club.com/games/justice-rc/ 302',
    '/games/race/ https://naomi.kozo-club.com/games/justice-rc/ 302',
    '/games/race/index https://naomi.kozo-club.com/games/justice-rc/ 302',
    '/games/race/index.html https://naomi.kozo-club.com/games/justice-rc/ 302',
    '/games/justice-rc https://naomi.kozo-club.com/games/justice-rc/ 302',
    '/games/justice-rc/ https://naomi.kozo-club.com/games/justice-rc/ 302',
  ].join('\n')+'\n');
  if(existsSync(out)) rmSync(out,{recursive:true});
  renameSync(stage,out);
  console.log(`Games output ready: ${out} (${files.length} copied assets)`);
} catch(error) {
  rmSync(stage,{recursive:true,force:true});
  throw error;
}
