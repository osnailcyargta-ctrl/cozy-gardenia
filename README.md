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

### Book two — *Underwater Mommy*

Chained until the dragon falls, and written for the sword you made in book one — which the save
keeps for you, so arriving here without one is not possible.

1. **The Shallows** — flooded stone, two drowned thralls, and a 90 HP coral gate.
2. **The Coral Vault** — three sirens. They do not dash at you the way the dragon's servants do;
   they **haul you in**, then spit water bolts. The tier II carries the coral key. A chest in the
   **top-right corner** holds the **wave gun**.
3. **The Tide Throne** — the **Drowned Queen**, 300 HP across two phases. Phase one is walls of
   water sweeping the room with a single gap, homing bubbles, and whirlpools that drag you off your
   footing. At 150 the room floods for good: you wade from then on and the tides come in pairs.

Nothing here is hoarded and nothing drops coin. The queen is not greedy.

Book three is not written yet.

### Meeting a boss, and leaving one

Neither boss is standing there waiting. You find the Dragon King **asleep** — the camera pushes in,
he lifts his head, and only then does the fight start; the boss bar does not appear until he is
awake. You do not find the queen at all, only her crown floating on the water, and she rises out of
it. Both collapse the same way they arrived: he falls back into the pose you found him in, and what
is left of her is the crown, surfacing again.

The player is locked out for the length of both cutscenes, and a book is not marked finished until
the collapse has finished playing.

### Saving

Leaving a book writes it down: gates you broke stay broken, chests you emptied stay empty, **the
forge is exactly as you left it**, and your satchel comes with you across a page reload. **Enemies
are not saved** — the things guarding a room come back, so a book you have already finished is still
a book you can play.

The forge has to be in there. Lighting an ore takes it out of your satchel the moment you press the
button, so a save that dropped the smelter destroyed that ore outright — and book one hands you
exactly three, which is exactly one sword. Losing one meant the sword could never be made.

Press **R** to erase everything. It asks first.
`game.wipeSave()` does the same from the console; `game.unlockAll()` opens every written book.

### No popups

Killing a boss does not interrupt you and does not congratulate you. There is no victory screen
anywhere in the game. You find out a story ended by walking back to the library and seeing the chain
gone from the next book on the shelf.

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
| `R` | Erase all saved progress (asks first) |
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
| Boss wake / collapse | ~3.5s and ~2.5s, player locked out for both |
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
assets/music/    two streamed tracks
tools/           the two boss sprite generators
css/             reset · ui · popups · animations
js/
  main.js          boot, game loop, combat glue, adaptive resolution
  engine/          canvas · postfx · sprite · input · camera · particles
                   audio (synthesised sfx) · music (streamed tracks)
  data/            palette · sprites (all pixel art) · items · rooms
  world/           tilemap · collision · room
  entities/        player · servant · dragonking · drowned · drownedqueen
                   projectile · wave · gate · props
  systems/         inventory · smelting · save
  ui/              hud · inventoryUI · craftUI · shelfUI · icons
```

Sound effects are synthesised at runtime with WebAudio — oscillators and filtered noise bursts, no
audio files. The two music tracks are the only assets in the repository, and they are **streamed
through `<audio>`**, never decoded into WebAudio: several minutes of 48kHz stereo would be hundreds
of megabytes as raw PCM. Nothing is fetched until a track is actually wanted, and the two-second
now-playing card doubles as the buffering window — the music starts one second in, by which time the
stream is ready.

Music: *Lanterns of Oakvale* (the library) and *Library Rush* (inside a book), by Osnail-ctrl.

## Three notes on how it is built

The Dragon King and the Drowned Queen are not typed out pixel by pixel. At 40–56 pixels wide, a
hand-typed figure turns to mush. The queen is generated from shape primitives — ellipses, tapers,
triangles, wavering strands — under a top-lit shader. The king's sleeping and waking poses are not
drawn at all: `tools/gen-king.mjs` takes his existing idle frame and **bends the neck**, dropping
each column past the shoulder a little further than the one before it, so the head curves to the
floor without coming off the body. Drawing him three times by hand would have produced three
different animals. Everything 16×16 is hand-drawn, because at that size primitives are worse than a
careful hand.

Zooming the camera is a **crop of the scene buffer**, not a transform — blowing up a source rect
with nearest-neighbour keeps the pixel grid exact where scaling the output would smear it. Every
pass that samples the scene shares that one rect, bloom and chromatic aberration included, or the
glow drifts off the thing that is glowing.

Room layout is guarded by a flood fill rather than by eye. For every room it asserts that the
forward exit is **unreachable** while its gate is shut, reachable once it opens, and that the way
back out is always reachable — with props included in the fill. Both progression-blocking bugs this
project has had were solid props sitting where nothing was checking for them.
