# Into the Book

A top-down dark-fantasy action game that runs entirely in the browser. No build step, no
dependencies, no asset files — every sprite is hand-authored pixel art stored as text and decoded at
boot.

**Play:** https://osnailcyargta-ctrl.github.io/cozy-gardenia/

## The game

You wake in a library with a single shelf holding three books. Each is a world, and each ends when
you carry the win back out through the door you came in by — killing the boss does not close the
book, walking home does.

### Book one — *Greedy Ass Dragon*

1. **The Cold Forge** — no enemies, three stations. A chest holds 1 coal and 3 iron ore. The smelter
   burns three ores per coal, ten seconds each. The anvil turns three iron bars into an iron sword.
   The exit is barred by a 72 HP wooden gate, and **fists deal no damage to anything at all**, so
   the forge is not optional — it is the only way to become able to hurt something.
2. **Hall of Coin** — three dragon's servants over piles of gold. Two tier I, one tier II that hits
   harder, dashes twice, and drops the key to the next gate.
3. **The Hoard** — the **Dragon King**, 300 HP across two phases. At half health his wings tear
   apart: no more dashing, but he starts vanishing and reappearing behind you.

### Book two — *The Drowned Queen*

Chained until the dragon falls, and written for the sword you made in book one.

1. **The Shallows** — flooded stone, two drowned thralls, and a 90 HP coral gate. A silt-choked
   chest by the entrance holds a spare blade, so the book is never a dead end.
2. **The Coral Vault** — three sirens. They do not dash at you the way the dragon's servants do;
   they **haul you in**, then spit water bolts. The tier II carries the coral key. A chest in the
   **top-right corner** holds the **wave gun**.
3. **The Tide Throne** — the **Drowned Queen**, 300 HP across two phases. Phase one is walls of
   water sweeping the room with a single gap, homing bubbles, and whirlpools that drag you off your
   footing. At 150 the room floods for good: you wade from then on, the tides come in pairs, and she
   can sink into the water and surface underneath you.

Book three is not written yet.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move |
| `E` | Interact (shelf, smelter, chest, anvil) |
| `Q` | Satchel (4×4) |
| `Space` or `F` | Dash (i-frames, 0.75s cooldown) |
| Scroll wheel / `1`–`4` | Switch hotbar slot |
| Left click | Attack with the selected slot |
| Right click | Interact |
| Left click *in inventory* | Move **one** item |
| Right click *in inventory* | Move the **whole stack** |
| `E`, `Q` or `Esc` | Close any panel |
| `F1` | Toggle post-processing (debug) |

Panels close with `E` and `Q`, not just `Esc` — one hand stays on QWEASD and the
other on the mouse, and `Esc` is a long reach from there.

The top row of the satchel is the hotbar, and **the selected slot is your
weapon**. There is no auto-equip: scroll to a slot holding coal and your swing
does nothing, because bare hands deal zero damage.

## Numbers

| | |
|---|---|
| Player | 100 HP (10 hearts) |
| Fists | **0 damage** — cannot hurt enemies, wood, or anything else |
| Iron sword | 18 damage · 2 blocks reach · 0.36s cooldown |
| Wave gun | 9 on the cast, then 8 every 0.2–0.7s for 1.5s · 4-block cone · 2s cooldown |
| Wooden gate | 72 HP → 4 sword hits |
| Coral gate | 90 HP → 5 sword hits |
| Dragon's Servant I / II | 45 HP / 90 HP (tier II has 3 armour) |
| Drowned Thrall | 30 HP |
| Siren I / II | 55 HP / 100 HP (tier II has 3 armour) |
| Dragon King · Drowned Queen | 300 HP each, phase 2 at 150 |
| Fireballs and bubbles | destructible — **2 sword swings** or **5 bare-handed** |
| Dash | ~60px burst, i-frames while dashing, 0.75s cooldown |

The wave gun is the first weapon that is not a swing. It plants a cone where you fired it and leaves
it there for a second and a half, slowing everything inside to 45% speed and chewing on it. The cone
does not follow you — walk out of it and you have given it away. Its ticks deliberately apply **no
knockback**: a field meant to hold enemies in the water must not punt them out of it.

Fireballs can be batted out of the air. That is not damage, which is why bare
hands can do it at all — it just takes five swings instead of two. A struck
fireball stalls in place for half a second: without that the feature is
impossible, because a fireball is only inside sword reach for 50-160ms while
the swing cooldown is 360ms, so a second hit could never land. The mouth laser
is a continuous beam and cannot be broken.

## How it looks the way it does

The scene is drawn to a 480×256 buffer with no smoothing, then upscaled with nearest-neighbour so
the pixels stay hard-edged. Post-processing runs *after* that upscale, so glow and fog are smooth
and cinematic over crisp pixel art rather than blocky.

Lighting is a **light map multiplied** over the scene, not an additive glow layer. That distinction
is what lets a room actually be dark and lit only where torches reach — an additive-only pass can
brighten but never darken, which flattens every room into uniform haze.

Bloom and fog are computed at fixed scene resolution and blurred with a downsample/upsample chain
rather than `ctx.filter`, and the renderer **adapts its backing-store resolution to measured frame
time**, stepping down when frames get expensive and back up when there's headroom. Post-processing
is pure fill rate, so this keeps it smooth on software rendering while a GPU still gets full
resolution.

## Running locally

Any static file server works — it is plain ES modules, so `file://` will not do:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Layout

```
index.html
css/     reset · ui · popups · animations
js/
  main.js          boot, game loop, combat glue, adaptive resolution
  engine/          canvas · postfx · sprite · input · camera · particles · audio
  data/            palette · sprites (all pixel art) · items · rooms
  world/           tilemap · collision · room
  entities/        player · servant · dragonking · drowned · drownedqueen
                   projectile · wave · gate · props
  systems/         inventory · smelting
  ui/              hud · inventoryUI · craftUI · shelfUI · icons
```

Sound is synthesised at runtime with WebAudio — oscillators and filtered noise bursts, no audio
files.

## Two notes on how it is built

The Dragon King and the Drowned Queen are not typed out pixel by pixel. At 40–48 pixels wide, a
hand-typed figure turns to mush; both are generated from shape primitives — ellipses, tapers,
triangles, wavering strands — under a top-lit shader, and the resulting rows are pasted into the
sprite table. Everything 16×16 is hand-drawn, because at that size primitives are worse than a
careful hand.

Room layout is guarded by a flood fill rather than by eye. For every room it asserts that the
forward exit is **unreachable** while its gate is shut, reachable once it opens, and that the way
back out is always reachable — with props included in the fill. Both progression-blocking bugs this
project has had were solid props sitting where nothing was checking for them.
