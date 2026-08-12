# Sprite generators

The two bosses are too large to type out pixel by pixel — at 48x40 and 56x40 a
hand-typed figure turns to mush. Both are produced by scripts and the resulting
rows are pasted into `js/data/sprites.js`. Keeping the scripts means the art can
be changed rather than only replaced.

```bash
node tools/gen-queen.mjs js   # the Drowned Queen's frames, as JS source
node tools/gen-king.mjs js    # the Dragon King's sleep / waking poses
```

`gen-queen.mjs` builds her out of shape primitives — ellipses, tapers,
triangles, wavering strands — under a top-lit shader.

`gen-king.mjs` does not draw a dragon. It takes the idle frame that already
exists and bends the neck: every column past the shoulder drops a little more
than the one before it, which curves the head to the floor without detaching
it. Redrawing him twice by hand would have produced three different animals.
