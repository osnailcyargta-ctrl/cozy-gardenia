// Axis-separated movement against the tilemap plus the room's solid props.
// Resolving X and Y independently is what lets the player slide along a wall
// instead of sticking to it.

export function moveAgainst(map, solids, ent, dx, dy) {
  const hw = ent.hw, hh = ent.hh;

  const blocked = (cx, cy) => {
    // tile corners
    const l = cx - hw, r = cx + hw - 0.01;
    const t = cy - hh, b = cy + hh - 0.01;
    if (map.solidPx(l, t) || map.solidPx(r, t) || map.solidPx(l, b) || map.solidPx(r, b)) return true;
    if (map.solidPx((l + r) / 2, t) || map.solidPx((l + r) / 2, b)) return true;
    if (map.solidPx(l, (t + b) / 2) || map.solidPx(r, (t + b) / 2)) return true;

    for (const s of solids) {
      if (!s.solid || s.dead) continue;
      if (Math.abs(cx - s.x) < hw + s.hw && Math.abs(cy - s.y) < hh + s.hh) return true;
    }
    return false;
  };

  let moved = false;

  if (dx) {
    const nx = ent.x + dx;
    if (!blocked(nx, ent.y)) { ent.x = nx; moved = true; }
    else {
      // step up to the wall face rather than stopping short of it
      const step = Math.sign(dx);
      let probe = ent.x;
      while (Math.abs(probe + step - ent.x) <= Math.abs(dx) && !blocked(probe + step, ent.y)) probe += step;
      if (probe !== ent.x) { ent.x = probe; moved = true; }
    }
  }

  if (dy) {
    const ny = ent.y + dy;
    if (!blocked(ent.x, ny)) { ent.y = ny; moved = true; }
    else {
      const step = Math.sign(dy);
      let probe = ent.y;
      while (Math.abs(probe + step - ent.y) <= Math.abs(dy) && !blocked(ent.x, probe + step)) probe += step;
      if (probe !== ent.y) { ent.y = probe; moved = true; }
    }
  }

  return moved;
}

/** Line-of-sight style check used by the boss laser. */
export function rayHitsWall(map, x0, y0, x1, y1, step = 4) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(d / step);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (map.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
  }
  return false;
}

export function circleHit(a, b, extra = 0) {
  return Math.hypot(a.x - b.x, a.y - b.y) < (a.radius || 6) + (b.radius || 6) + extra;
}

/** Cone test for melee swings: within range and within the swing arc. */
export function inArc(ax, ay, angle, arc, range, tx, ty) {
  const dx = tx - ax, dy = ty - ay;
  const d = Math.hypot(dx, dy);
  if (d > range) return false;
  let da = Math.atan2(dy, dx) - angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da) <= arc / 2;
}
