# Into the Book

A top-down dark-fantasy action game that runs entirely in the browser. No build step, no
dependencies, no asset files — every sprite is hand-authored pixel art stored as text and decoded at
boot.

**Play:** https://osnailcyargta-ctrl.github.io/cozy-gardenia/

## The game

You wake in a library with a single shelf holding four books. Each is a world, and each ends when
you carry the win back out through the door you came in by — killing the boss does not close the
book, walking home does. The fourth has no end at all.

### Book one — *Greedy Ass Dragon*

1. **The Cold Forge** — no enemies, three stations. A chest holds 1 coal and 3 iron ore. The smelter
   burns three ores per coal, ten seconds each. The anvil turns three iron bars into an iron sword.
   The exit is barred by a 72 HP wooden gate, and **fists deal no damage to anything at all**, so
   the forge is not optional — it is the only way to become able to hurt something.
2. **Hall of Coin** — three dragon's servants over piles of gold. Two tier I, one tier II that hits
   harder, dashes twice, and drops the key to the next gate.
3. **The Hoard** — the **Dragon King**, 450 HP across two phases. At half health his wings tear
   apart: no more dashing, but he starts vanishing and reappearing behind you.

### Book two — *Underwater Mommy*

Chained until the dragon falls, and written for the sword you made in book one — which the save
keeps for you, so arriving here without one is not possible.

1. **The Shallows** — flooded stone, two drowned thralls, and a 90 HP coral gate.
2. **The Coral Vault** — three sirens. They do not dash at you the way the dragon's servants do;
   they **haul you in**, then spit water bolts. The tier II carries the coral key, and a chest in the
   **top-right corner** holds the **wave gun**. Sirens and thralls both take their time between
   attacks — the telegraph and the pull are unchanged, only the pause before the next one.
3. **The Tide Throne** — the **Drowned Queen**, 600 HP across two phases. Phase one is walls of
   water sweeping the room with a single gap, homing bubbles, and whirlpools that drag you off your
   footing. At 300 the room floods for good: you wade from then on and the tides come in pairs.

Nothing here is hoarded and nothing drops coin. The queen is not greedy.

Book three is not written yet.

### Book four — *Infinite Dungeon*

Unchained when the dragon falls, and sitting after the sealed third book. There is no boss, no story
and no ending — only how far down you are willing to go.

- **The rooms do not exist until you reach them.** Each is generated from a seed, flood-filled to
  prove it can be crossed, and **released the moment you leave it**. There is no `B` tile anywhere in
  this book: the door behind you is not locked, it is gone.
- **Every tenth room is a landing** — no enemies, a portal home in the middle, a merchant, and often
  an anvil or a smelter. Entering the book puts you on the deepest landing you have reached, and so
  does dying. What a death costs you is the descent since the last landing, never the depth itself.
- **It gets worse every two rooms.** Three monsters at first, then one more every second room, and
  that "one" itself grows by one every ten. Past **25 alive** the surplus stops being more bodies and
  becomes more HP and damage instead — 25 is what stays both playable and drawable.
- **The way on is barred.** Every room with anything alive in it has a locked gate across its exit,
  and the last thing standing is carrying the **Crypt Key**. You do not get to walk past a room down
  here; you get to finish it. Landings are the exception — nothing to fight, so nothing to unlock.
- **Zombie crawlers, stray servants I and II, and sirens I.** The crawler is new: it chases and it
  bites, that is the whole of it, and it drops the coins everything down here is bought with. The
  strays are the dragon's servants down to the last number, but they have no master and carry no
  Dragon Key — there is no dragon here and nothing his key would open.

| Room | wanted | on screen | HP / damage |
|---|---|---|---|
| 1 | 3 | 3 | ×1 |
| 11 | 9 | 9 | ×1 |
| 21 | 20 | 20 | ×1 |
| 25 | 26 | 25 | ×1.06 |
| 41 | 57 | 25 | ×2.92 |

### Modifiers, and what coins are for

Weapons out of a chest, off an anvil, or off the merchant can carry a modifier. "Speed" is swing
speed — the cooldown between attacks — never how fast you walk.

| Modifier | Effect | Forging / reforging |
|---|---|---|
| — | — | 45% / 35% |
| Light | +30% swing speed, −25% damage | 22% / 22% |
| Heavy | −25% swing speed, +40% damage | 22% / 22% |
| Broken | −20% swing speed, −30% damage | never / 16% |
| Legendary | +15% speed, +35% damage, +25% crit | 11% / 5% |

There is no limit on how many swords you own. Every blade rolls its own modifier, so the only way to
chase a better one is to be allowed to make another — and `iron_sword` stacks to 1, so each takes its
own slot and no two ever merge.

Forging can come out plain but never broken — you only break a weapon by gambling with one you
already have. **Reforge** at any anvil costs **20 coins** and rerolls what you are holding, which is
the only way to get `broken` and the reason it is a gamble. A **critical** is one roll per swing, not
per target, and multiplies damage by **1.75**.

The merchant stocks two of these per landing, fixed for that room:

| | |
|---|---|
| Iron Sword *(random modifier)* | 20c |
| Wave Gun | 30c |
| Blackholian's Nest ×2 | 40c |
| Iron Bar ×2 | 15c |
| Iron Ore ×3 | 8c |
| Coal ×2 | 5c |

The sword is cheapest because you can forge one for free out of ore you find; the nest is dearest
because nothing else in the game does what it does.

### Blackholian's Nest

A block, not a weapon — left click puts it down within three blocks of you, and the item is spent
doing it. A placed nest throws **one black hole every five seconds**. Each hole drifts toward the
nearest enemy, hauls everything within about four blocks into itself, chews on what it catches, and
collapses after three seconds. Its damage carries **no knockback**, for the same reason the wave gun
does not: a thing meant to hold enemies in place must not punt them out.

The hole is the one thing in this game that **takes light away**. Because lighting is a light map
that gets multiplied over the scene, painting black into that buffer genuinely darkens the floor
around it — an additive glow layer can only ever add.

Nests and holes belong to the room, so when the dungeon throws a room away they go with it. Nothing
follows you down.

### Meeting a boss, and leaving one

Neither boss is standing there waiting. You find the Dragon King **asleep** — the camera pushes in,
he lifts his head, and only then does the fight start; the boss bar does not appear until he is
awake. You do not find the queen at all, only her crown floating on the water, and she rises out of
it. Both collapse the same way they arrived: he falls back into the pose you found him in, and what
is left of her is the crown, surfacing again.

The player is locked out for the length of both cutscenes, and a book is not marked finished until
the collapse has finished playing.

### Getting your health back

Somewhere you have never been is worth **three hearts**. Walking back through a door you already came
through is not — otherwise the nearest doorway is a health fountain you can pace in and out of. In
book four every room is new, so every room pays out; that is the only healing down there.

The hearts flash green when they fill, the same way they flash when they empty. Both flashes used to
be cut off after a single frame: `setHearts` runs every frame and rewrote `className`, stripping the
animation class off a heart that was still mid-animation. It now bails when nothing changed.

### Saving

Leaving a book writes it down: gates you broke stay broken, chests you emptied stay empty, **the
things you killed stay dead**, whatever you left lying on the floor is still lying there, the forge
is exactly as you left it, and your satchel comes with you across a page reload.

Enemies used to be left out on purpose, so a finished book was still a book you could play. That
stopped being tenable the moment coins had a use: book one's servants drop gold, book four's merchant
takes it, and a book whose guards come back every time you open the cover is a coin printer. So the
boss stays down too. A finished book is a quiet one.

Floor drops are saved for a less obvious reason. Kill the servant carrying the key, leave the key
where it fell, and walk out. The servant does not come back — so if the key is not saved either, it
exists nowhere and the book can never be finished again.

Dying is still a clean slate for the room you died in: the enemies you killed *this visit* get up
again. Only leaving the book writes them down. That does leave a slow way to farm coins by dying on
purpose; closing it is one line in `respawn()` if it ever becomes annoying.

Book four cannot store its rooms — there are infinitely many and it throws them away as you walk. It
stores **the seed they are generated from** instead, which is the same thing at a thousandth of the
size: the same seed rebuilds the same layouts, the same monsters, the same anvil on the same landing,
and the same two things in the merchant's hands. What it saves alongside that is the deepest landing
you reached and which rows you have already bought out.

The forge has to be in there. Lighting an ore takes it out of your satchel the moment you press the
button, so a save that dropped the smelter destroyed that ore outright — and book one hands you
exactly three, which is exactly one sword. Losing one meant the sword could never be made.

Press **R** to erase everything. It asks first.
`game.wipeSave()` does the same from the console; `game.unlockAll()` opens every written book.

### No animated page flips

Opening a book is a click, a short fade, and you are in. The 3D page sweep and the cover that swung
itself open are both gone. What is left of the effect is the shelf itself — the books have spines and
thickness and chains, and that is shape rather than animation.

### No popups

Killing a boss does not interrupt you and does not congratulate you. There is no victory screen
anywhere in the game. You find out a story ended by walking back to the library and seeing the chain
gone from the next book on the shelf.

### Developer mode

`Ctrl`+`M` moves you onto a save of its own, under the key `testdeveloperidkdktestperioddpr`. The
real save is not read, not written, and not touched — switching is a reload, which is the only way to
be sure nothing from one save is still sitting in memory while the other is being played. A small
`DEV` badge in the corner says which one you are on.

Once you are in, `M` opens the tools: spawn any enemy in the game, drop any item at your feet,
godmode, ×100 damage, and a move-speed multiplier up to 10×. **Outside developer mode `M` does
nothing at all** — no panel, no message, no hint the menu exists.

The cheats are not saved. Every one of them is something you switch on to look at one specific thing,
and having godmode survive a reload mostly means wondering for ten minutes why nothing can hurt you.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move |
| `E` | Interact (shelf, smelter, chest, anvil, merchant, portal) |
| `Q` | Satchel (4×4) |
| `Space` or `F` | Dash (i-frames, 0.75s cooldown) |
| Scroll wheel / `1`–`4` | Switch hotbar slot |
| Left click | Attack with the selected slot — or **place it**, if it is a block |
| Right click | Interact |
| Left click *in inventory* | Move **one** item |
| Right click *in inventory* | Move the **whole stack** |
| `E`, `Q` or `Esc` | Close any panel |
| `R` | Erase all saved progress (asks first) |
| `F1` | Toggle post-processing (debug) |
| `Ctrl`+`M` | Switch in and out of developer mode |
| `M` | Debug menu — **only in developer mode**; does nothing otherwise |

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
| Iron sword | 18 damage · 2 blocks reach · 0.36s cooldown (before any modifier) |
| Wave gun | 9 on the cast, then 8 every 0.2–0.7s for 1.5s · 4-block cone · 2s cooldown |
| Wooden gate | 72 HP → 4 sword hits |
| Coral gate | 90 HP → 5 sword hits |
| Dragon's Servant I / II | 45 HP / 90 HP (tier II has 3 armour) |
| Drowned Thrall | 30 HP |
| Siren I / II | 55 HP / 100 HP (tier II has 3 armour) |
| Dragon King | 450 HP, phase 2 at 225 |
| Drowned Queen | 600 HP, phase 2 at 300 |
| New room | +3 hearts, once per room |
| Siren I / II | ~5.2s between attacks |
| Drowned Thrall | ~2.6s between lunges |
| Fireballs and bubbles | destructible — **2 sword swings** or **5 bare-handed** |
| Zombie Crawler | 26 HP · 7 damage · drops 1–3 coins about 60% of the time |
| Black hole | 7 damage every 0.35s inside ~4 blocks · lives 3s · one per nest per 5s |
| Critical hit | ×1.75, one roll per swing |
| Crypt gate | locked — no amount of hitting it helps, only the Crypt Key |
| Dungeon cap | 25 enemies alive; past that the surplus becomes HP and damage |
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
  engine/          canvas · postfx · sprite · input · camera · particles · rng
  data/            palette · sprites (all pixel art) · items · rooms · modifiers
  world/           tilemap · collision · room · dungeon (book four's generator)
  entities/        player · servant · dragonking · drowned · drownedqueen
                   crawler · blackhole · projectile · wave · gate · props
  systems/         inventory · smelting · save · dev
  ui/              hud · inventoryUI · craftUI · shopUI · shelfUI · devUI · icons
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

Room layout is guarded by a flood fill rather than by eye. For every hand-authored room it asserts
that the forward exit is **unreachable** while its gate is shut, reachable once it opens, and that
the way back out is always reachable — with props included in the fill. Both progression-blocking
bugs this project has had were solid props sitting where nothing was checking for them.

Book four runs that same fill **inside the generator**, before a room is ever handed back: a layout
whose exit cannot be reached is thrown away and reseeded, and **every monster is placed inside the
reachable set**. That second part became load-bearing the moment the exit was gated. One crawler
sealed behind a pillar used to be a monster standing around doing nothing; now it is a room that can
never be cleared, in a book with no way back — a run you can neither finish nor walk away from.

The doorway column is walled off on every row but the two the door occupies, for the same reason book
one's is. An earlier version of book one left that column open, so its gate stood in a field and you
could stroll around the entire forge chain. A gate is only a gate if the wall beside it is real.

The tests walk generated rooms on real key presses rather than teleporting to the doorway — a
teleport proves the transition works and proves nothing at all about whether a body can get there.
