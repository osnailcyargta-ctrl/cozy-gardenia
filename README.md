# Into the Book

A top-down dark-fantasy action game that runs entirely in the browser. No build step, no
dependencies, no asset files — every sprite is hand-authored pixel art stored as text and decoded at
boot.

**Play:** https://osnailcyargta-ctrl.github.io/cozy-gardenia/

## The game

You wake in a library with a single shelf holding three books. Two are chained shut. The one you can
open is **Greedy Ass Dragon**, and it runs three rooms deep:

1. **The Cold Forge** — no enemies, three stations. A chest holds 1 coal and 3 iron ore. The smelter
   burns three ores per coal, ten seconds each. The anvil turns three iron bars into an iron sword.
   The exit is barred by a 72 HP wooden gate, and **fists deal no damage to anything at all**, so
   the forge is not optional — it is the only way to become able to hurt something.
2. **Hall of Coin** — three dragon's servants over piles of gold. Two tier I, one tier II that hits
   harder, dashes twice, and drops the key to the next gate.
3. **The Hoard** — the **Dragon King**, 300 HP across two phases. At half health his wings tear
   apart: no more dashing, but he starts vanishing and reappearing behind you.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move |
| `E` | Interact (shelf, smelter, chest, anvil) |
| `Q` | Satchel (4×4) |
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
| Iron sword | 18 damage · 2 blocks reach |
| Wooden gate | 72 HP → 4 sword hits |
| Dragon's Servant I / II | 45 HP / 90 HP (tier II has 3 armour) |
| Dragon King | 300 HP → 17 sword hits, phase 2 at 150 |
| Fireball | destructible — **2 sword swings** or **5 bare-handed** |

Fireballs can be batted out of the air. That is not damage, which is why bare
hands can do it at all — it just takes five swings instead of two. The mouth
laser is a continuous beam and cannot be broken. A volley fires three fireballs
0.3s apart while a sword swing costs 0.36s, so you can never clear a whole
volley — dodging is still the plan, swinging is the option.

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
  entities/        player · servant · dragonking · projectile · gate · props
  systems/         inventory · smelting
  ui/              hud · inventoryUI · craftUI · shelfUI · icons
```

Sound is synthesised at runtime with WebAudio — oscillators and filtered noise bursts, no audio
files.
