// Rooms are exactly one screen, so the camera never pans — it only shakes and
// pushes. Both decay smoothly so hits feel weighty without making play hard.

export const cam = { shakeX: 0, shakeY: 0, _mag: 0, _t: 0, pushX: 0, pushY: 0 };

export function shake(magnitude, duration = 0.25) {
  cam._mag = Math.max(cam._mag, magnitude);
  cam._t = Math.max(cam._t, duration);
  cam._dur = cam._t;
}

/** A directional nudge, e.g. away from a dash impact. */
export function push(dx, dy, amount) {
  const l = Math.hypot(dx, dy) || 1;
  cam.pushX += (dx / l) * amount;
  cam.pushY += (dy / l) * amount;
}

export function update(dt) {
  if (cam._t > 0) {
    cam._t -= dt;
    const k = Math.max(0, cam._t / (cam._dur || 1));
    const m = cam._mag * k * k;
    cam.shakeX = (Math.random() - 0.5) * 2 * m;
    cam.shakeY = (Math.random() - 0.5) * 2 * m;
    if (cam._t <= 0) { cam._mag = 0; cam.shakeX = cam.shakeY = 0; }
  } else {
    cam.shakeX = cam.shakeY = 0;
  }

  const decay = Math.pow(0.001, dt);
  cam.pushX *= decay;
  cam.pushY *= decay;
}

export function totalX() { return cam.shakeX + cam.pushX; }
export function totalY() { return cam.shakeY + cam.pushY; }

export function reset() {
  cam.shakeX = cam.shakeY = cam.pushX = cam.pushY = cam._mag = cam._t = 0;
}
