# 🌿 Gardenia

A cozy gardening game. Buy seeds from the merchant, plant them, keep the soil damp, and harvest
blooms for coins — then spend those coins widening your plot, one pot at a time.

No build step, no dependencies, no bundler. Plain HTML, CSS and ES modules.

## Play it

**On GitHub Pages** — go to **Settings → Pages**, set *Source* to **Deploy from a branch**, pick this
branch and the **`/ (root)`** folder. The game will be live at
`https://<user>.github.io/cozy-gardenia/`.

**Locally** — ES modules need to be served over HTTP, so opening `index.html` straight off disk
won't work. Run any static server from the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## How it plays

**Merchant** — three seeds, reshuffled every 60 seconds. Buying one sells that slot out until the
next restock, so a rare seed on the board is a decision, not a certainty. Prices wobble ±15% between
restocks.

**Main Plot** — the tab you land on. Ten pots; three are yours from the start. Plant a seed, and it
moves through *seed → sprout → bud → bloom*. Watering isn't a chore you can fail: damp soil grows at
full speed, dry soil at half, and a plant left dry still gets there eventually. Harvest at bloom for
coins, with a chance of a free seed back.

**Phone** — coming soon.

### The 10 pots

| Pot | Unlocked by |
|---|---|
| 1–3 | Yours from the start |
| 4 | 150 coins |
| 5 | 400 coins |
| 6 | Boss — Thorn Wyrm *(coming soon)* |
| 7 | 900 coins |
| 8 | 1800 coins |
| 9 | Boss — Frost Bramble *(coming soon)* |
| 10 | Boss — Elder Root *(coming soon)* |

Boss battles aren't implemented yet. Coin-bought pots deliberately do **not** depend on them, so
pots 7 and 8 are reachable today — seven playable pots — and the three boss plates become fight
entry points when bosses land.

### Seeds

Twelve plants across four rarity tiers, from 30-second Marigolds up to the three-minute **Gardenia**
the garden is named for.

| Tier | Plants |
|---|---|
| Common | Marigold, Basil, Daisy, Tomato |
| Uncommon | Lavender, Sunflower, Strawberry, Mint |
| Rare | Blue Rose, Moonflower, Ghost Orchid |
| Legendary | Gardenia, Aurora Lily |

## Saving

Progress is kept in `localStorage` and written a moment after each change. Growth is resolved from
timestamps, so plants keep growing while the tab is closed — capped at 8 hours per visit, and
guarded against the system clock jumping backwards.

## Project layout

```
index.html          markup for all three tabs
css/
  reset.css         reset + focus rings
  theme.css         design tokens and buttons
  layout.css        shell, HUD, tab bar, modal, toasts
  garden.css        pot grid and growth states
  merchant.css      restock dial and stock cards
  phone.css         the Coming Soon component
js/
  main.js           bootstrap, offline catch-up, tick loop
  state.js          state shape, persistence, growth model
  time.js           clock, tick loop, duration formatting
  ui.js             tabs, HUD, toasts, modal, particles
  garden.js         pot rendering and interactions
  merchant.js       restock scheduling and purchases
  phone.js          placeholder panel
  sprites.js        generated SVG art
  data/plants.js    seed catalog
  data/pots.js      pot unlock table
```

## Poking at it

The console exposes a small handle:

```js
gardenia.state()     // read the live state object
gardenia.grant(1000) // add coins
gardenia.skip(120)   // fast-forward the game clock, in seconds
gardenia.reset()     // wipe the save and reload
```

## Not in yet

Boss battles, the phone, and music.
