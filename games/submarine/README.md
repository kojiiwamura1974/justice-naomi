# SUBMARINE / GAME 01

Official game path: /games/submarine/

## Design
- Existing photographic Naomi portraits and NaomiCharacter class remain unchanged.
- Rectangular softly rounded 1.17x periscope lens; the sea outside the lens remains visible, but dim.
- Steering with drag, left/right buttons, or arrow keys. The center reticle stays fixed.
- The three targets are a smaller near battleship (100), mid-distance destroyer (200), and tiny but outlined submarine against the far horizon (500). Fleet positions and speeds are identical across difficulty levels.
- Exactly one torpedo may travel at a time. A sustained air-pressure "pshuuuuu" hiss continues from launch until the shot hits or misses; there is no quick launch "pop".
- Torpedoes travel at 116 canvas units/sec, around 1.3–2.2 seconds to the three lanes. Misses require another 1.55 seconds to reload. The far submarine is deliberately hard to lead.
- Impact abruptly transitions the prolonged hiss into a deep, decaying "zugaan" boom (roughly 2.7s noise tail). A hit locks the gun through the entire 3.5-second split, fire, smoke and sinking animation. The next shot is not rushed. Naomi speaks after an initial 0.85s to let the explosion be heard.
- Stage notifications stay near the top, and fullscreen cut-ins do not cover the wreck. If the 20/40/60-second score gate arrives during a sinking sequence, gameplay stops on time and only the remaining aftermath runs before the final score overlay.
- Naomi uses the early loss line if the first gate is missed, the standard comment after one gate, and the high-score line after reaching stage three, whether or not the final quota is met.
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
- game-v3.js: small warship silhouettes, torpedo flight hiss, layered explosion, single-shot and 3.5s afterglow
- game-v3.css: scoped UI styles and FIRE disabled states
- cover.svg: thumbnail used on the official site and game archive

## Validation
- JS parsed successfully.
- State tests exercised sound order (hiss -> impact boom), one-shot-only, afterglow/reload, 20s fail and 20/40/60s success, differing thresholds, and deterministic same fleet across difficulties.
- Cloudflare preview serves the HTML, JS, CSS and cover. Human visual/audio testing is still recommended for tuning.
