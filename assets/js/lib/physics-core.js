/**
 * Physics engine: SUVAT solving, projectile motion, circuit networks,
 * optics and thermal relations. Pure functions, no DOM.
 */

export const G = 9.80665;

/**
 * Solve the constant-acceleration (SUVAT) equations.
 * Supply exactly three of {u, v, a, s, t}; the other two are derived.
 * @returns {{values: object, workings: Array<{text: string, math: string}>}}
 */
export function solveSuvat(given) {
  const keys = ["u", "v", "a", "s", "t"];
  const known = keys.filter((k) => Number.isFinite(given[k]));
  if (known.length < 3) throw new Error("Enter any three of u, v, a, s and t");

  const out = { ...given };
  const workings = [];
  const has = (...ks) => ks.every((k) => Number.isFinite(out[k]));
  const set = (key, value, text, math) => {
    if (Number.isFinite(out[key]) || !Number.isFinite(value)) return;
    out[key] = value;
    workings.push({ text, math });
  };

  // Iterate: each pass may unlock another equation.
  for (let pass = 0; pass < 4; pass += 1) {
    if (has("u", "v", "a")) set("t", (out.v - out.u) / out.a, "Rearrange v = u + at for t", "t = (v − u) / a");
    if (has("u", "v", "t")) set("a", (out.v - out.u) / out.t, "Rearrange v = u + at for a", "a = (v − u) / t");
    if (has("u", "a", "t")) set("v", out.u + out.a * out.t, "Apply v = u + at", "v = u + at");
    if (has("u", "v", "t")) set("s", 0.5 * (out.u + out.v) * out.t, "Average velocity × time", "s = ½(u + v)t");
    if (has("u", "a", "t")) set("s", out.u * out.t + 0.5 * out.a * out.t ** 2, "Apply s = ut + ½at²", "s = ut + ½at²");
    if (has("u", "a", "s")) {
      const disc = out.u ** 2 + 2 * out.a * out.s;
      // The equation fixes speed, not direction; the positive root is reported.
      if (disc >= 0) set("v", Math.sqrt(disc), "Apply v² = u² + 2as", "v = √(u² + 2as)");
    }
    if (has("v", "a", "s")) {
      const disc = out.v ** 2 - 2 * out.a * out.s;
      if (disc >= 0) set("u", Math.sqrt(disc), "Rearrange v² = u² + 2as for u", "u = √(v² − 2as)");
    }
    if (has("u", "s", "t")) set("a", (2 * (out.s - out.u * out.t)) / out.t ** 2, "Rearrange s = ut + ½at² for a", "a = 2(s − ut) / t²");
    if (has("v", "s", "t")) set("u", (2 * out.s) / out.t - out.v, "Rearrange s = ½(u + v)t for u", "u = 2s/t − v");
    if (has("u", "v", "s") && !has("t")) {
      const a = (out.v ** 2 - out.u ** 2) / (2 * out.s);
      set("a", a, "Rearrange v² = u² + 2as for a", "a = (v² − u²) / 2s");
    }
    if (has("u", "a", "s") && out.a === 0 && out.u !== 0) {
      set("t", out.s / out.u, "Constant velocity, so time is displacement ÷ speed", "t = s / u");
    }
    if (has("u", "a", "s") && !Number.isFinite(out.t) && out.a !== 0) {
      const disc = out.u ** 2 + 2 * out.a * out.s;
      if (disc >= 0) {
        const roots = [(-out.u + Math.sqrt(disc)) / out.a, (-out.u - Math.sqrt(disc)) / out.a].filter((r) => r >= 0);
        if (roots.length) set("t", Math.min(...roots), "Solve ½at² + ut − s = 0 for t", "t = (−u + √(u² + 2as)) / a");
      }
    }
    if (keys.every((k) => Number.isFinite(out[k]))) break;
  }

  const missing = keys.filter((k) => !Number.isFinite(out[k]));
  if (missing.length) throw new Error(`Not enough information to find ${missing.join(", ")}`);
  return { values: out, workings };
}

/**
 * Projectile launched from a height with no air resistance.
 * @returns flight time, range, apex, and a sampled trajectory.
 */
export function projectile({ speed, angleDeg, height = 0, gravity = G }) {
  if (!(speed > 0)) throw new Error("Launch speed must be positive");
  if (!(gravity > 0)) throw new Error("Gravity must be positive");
  const theta = (angleDeg * Math.PI) / 180;
  const ux = speed * Math.cos(theta);
  const uy = speed * Math.sin(theta);

  // Solve height + uy·t − ½g·t² = 0 for the positive landing root.
  const disc = uy ** 2 + 2 * gravity * height;
  const flightTime = (uy + Math.sqrt(disc)) / gravity;
  const timeToApex = Math.max(uy / gravity, 0);
  const apex = height + (uy > 0 ? uy ** 2 / (2 * gravity) : 0);
  const range = ux * flightTime;

  const samples = 80;
  const trajectory = Array.from({ length: samples + 1 }, (_, i) => {
    const t = (flightTime * i) / samples;
    return { t, x: ux * t, y: height + uy * t - 0.5 * gravity * t ** 2 };
  });

  return {
    ux, uy, flightTime, timeToApex, apex, range,
    impactSpeed: Math.hypot(ux, uy - gravity * flightTime),
    trajectory,
  };
}

/** Equivalent resistance of a set of resistors. */
export function combineResistors(values, mode) {
  const resistors = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!resistors.length) throw new Error("Enter at least one positive resistance");
  if (mode === "series") return resistors.reduce((sum, r) => sum + r, 0);
  return 1 / resistors.reduce((sum, r) => sum + 1 / r, 0);
}

/** Solve V = IR plus power for whichever two quantities are supplied. */
export function ohmsLaw({ voltage, current, resistance }) {
  const supplied = [voltage, current, resistance].filter(Number.isFinite).length;
  if (supplied < 2) throw new Error("Enter any two of voltage, current and resistance");
  let V = voltage;
  let I = current;
  let R = resistance;
  if (!Number.isFinite(V)) V = I * R;
  else if (!Number.isFinite(I)) I = V / R;
  else if (!Number.isFinite(R)) R = V / I;
  return { voltage: V, current: I, resistance: R, power: V * I };
}

/**
 * Snell's law. Returns the refracted angle, or a total-internal-reflection flag
 * together with the critical angle when refraction is impossible.
 */
export function refract({ n1, n2, angleDeg }) {
  if (!(n1 > 0) || !(n2 > 0)) throw new Error("Refractive indices must be positive");
  const theta1 = (angleDeg * Math.PI) / 180;
  const ratio = (n1 * Math.sin(theta1)) / n2;
  const criticalAngle = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;
  if (Math.abs(ratio) > 1) {
    return { totalInternalReflection: true, criticalAngle, refractedDeg: null, speed1: 2.99792458e8 / n1, speed2: 2.99792458e8 / n2 };
  }
  return {
    totalInternalReflection: false,
    criticalAngle,
    refractedDeg: (Math.asin(ratio) * 180) / Math.PI,
    speed1: 2.99792458e8 / n1,
    speed2: 2.99792458e8 / n2,
  };
}

/**
 * Thin lens / curved mirror imaging using the real-is-positive convention
 * 1/f = 1/v − 1/u with the object distance u entered as a positive number.
 */
export function thinLens({ focalLength, objectDistance, objectHeight = 1 }) {
  if (!Number.isFinite(focalLength) || focalLength === 0) throw new Error("Enter a non-zero focal length");
  if (!(objectDistance > 0)) throw new Error("Object distance must be positive");
  const u = -objectDistance; // object on the incoming side
  const invV = 1 / focalLength + 1 / u;
  if (invV === 0) return { imageDistance: Infinity, magnification: Infinity, imageHeight: Infinity, nature: "Image at infinity (object at the focal point)" };
  const v = 1 / invV;
  const magnification = v / u;
  const real = v > 0;
  const upright = magnification > 0;
  return {
    imageDistance: v,
    magnification,
    imageHeight: objectHeight * magnification,
    real,
    upright,
    nature: `${real ? "Real" : "Virtual"}, ${upright ? "upright" : "inverted"}, ${
      Math.abs(magnification) > 1 ? "enlarged" : Math.abs(magnification) < 1 ? "diminished" : "same size"
    }`,
  };
}

/** Radioactive decay: activity and remaining nuclei after a time interval. */
export function decay({ initial, halfLife, time }) {
  if (!(halfLife > 0)) throw new Error("Half-life must be positive");
  const lambda = Math.LN2 / halfLife;
  const remaining = initial * Math.exp(-lambda * time);
  return {
    lambda,
    remaining,
    decayed: initial - remaining,
    halfLivesElapsed: time / halfLife,
    fraction: remaining / initial,
  };
}

/** Sensible heating: Q = mcΔθ, solved for whichever value is left blank. */
export function heatTransfer({ mass, specificHeat, deltaT, energy }) {
  const known = [mass, specificHeat, deltaT, energy].filter(Number.isFinite).length;
  if (known < 3) throw new Error("Leave exactly one of m, c, Δθ and Q blank");
  if (!Number.isFinite(energy)) return { ...{ mass, specificHeat, deltaT }, energy: mass * specificHeat * deltaT };
  if (!Number.isFinite(mass)) return { mass: energy / (specificHeat * deltaT), specificHeat, deltaT, energy };
  if (!Number.isFinite(specificHeat)) return { mass, specificHeat: energy / (mass * deltaT), deltaT, energy };
  return { mass, specificHeat, deltaT: energy / (mass * specificHeat), energy };
}
