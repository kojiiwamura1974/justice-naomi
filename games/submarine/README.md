# SUBMARINE / GAME 01

Official game path: /games/submarine/

## Design
- Existing photographic Naomi portraits and NaomiCharacter class remain unchanged.
- Rectangular softly rounded 1.17x periscope lens; the sea outside the lens remains visible, but dim.
- Steering with drag, left/right buttons, or arrow keys. The center reticle stays fixed.
- Torpedoes travel at 172 canvas units/sec, roughly 1–1.5 seconds to the three ship lanes. Distant fast, small vessels require prediction.
- Hits produce layered booming sound, shockwave, smoke, splitting hull pieces, and sinking animation.
- No extra time. Three checkpoints at 20, 40, and 60 seconds, with early termination if a quota is missed. At 60 seconds the run always ends.

## Difficulty
The opening ship positions and travel directions/speeds are identical across difficulties. A fixed-seed generator (mulberry32 with seed 1978) controls the fleet, independent of cosmetic randomness. Difficulty affects only score quotas and horizontal hit tolerance.

| Difficulty | 20s total | 40s total | 60s total | Hit tolerance |
|---|---:|---:|---:|---:|
| やさしい | 200 | 500 | 900 | 1.28 |
| ふつう | 300 | 800 | 1500 | 1.00 |
| むずかしい | 500 | 1300 | 2600 | 0.80 |

## Files
- index.html: game and original Naomi portraits
- game-v2.js: controls, ships, projectile and stage logic
- game-v2.css: scoped UI styles
- cover.svg: thumbnail used on the official site and game archive

## Validation
- JS parsed successfully.
- State tests exercised 20s fail, 20s pass, 40s pass, 60s successful end, differing thresholds, and deterministic same fleet across difficulties.
- Cloudflare preview serves the HTML, JS, CSS and cover. Human visual/audio testing is still recommended for tuning.
