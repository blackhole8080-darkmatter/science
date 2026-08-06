/**
 * Hydrogenic atomic orbitals.
 *
 * ψ(r, θ, φ) = R_nl(r) · Y_lm(θ, φ), using the real (cubic-harmonic) angular
 * functions chemists actually draw — pₓ, p_y, p_z, d_xy and so on — rather than
 * the complex m-eigenfunctions. Radial functions are exact for n ≤ 3, written
 * in units of the Bohr radius a₀ and normalised so ∫|R|²r² dr = 1.
 *
 * Two views come out of this: the angular shape r = |Y|, which is the familiar
 * orbital picture, and the true probability density |ψ|², which also shows the
 * radial nodes that the shape picture hides.
 *
 * Pure functions, no DOM and no three.js.
 */

const SQRT = Math.sqrt;
const PI = Math.PI;

/* ------------------------------------------------------------------ *
 * Real spherical harmonics
 * ------------------------------------------------------------------ */

/**
 * Real angular functions, indexed by the orbital's conventional name.
 * Each takes the polar angle θ and azimuth φ and returns a signed amplitude.
 */
export const ANGULAR = {
  s: () => 0.5 / SQRT(PI),

  pz: (t) => SQRT(3 / (4 * PI)) * Math.cos(t),
  px: (t, p) => SQRT(3 / (4 * PI)) * Math.sin(t) * Math.cos(p),
  py: (t, p) => SQRT(3 / (4 * PI)) * Math.sin(t) * Math.sin(p),

  dz2: (t) => SQRT(5 / (16 * PI)) * (3 * Math.cos(t) ** 2 - 1),
  dxz: (t, p) => SQRT(15 / (4 * PI)) * Math.sin(t) * Math.cos(t) * Math.cos(p),
  dyz: (t, p) => SQRT(15 / (4 * PI)) * Math.sin(t) * Math.cos(t) * Math.sin(p),
  dxy: (t, p) => SQRT(15 / (16 * PI)) * Math.sin(t) ** 2 * Math.sin(2 * p),
  "dx2-y2": (t, p) => SQRT(15 / (16 * PI)) * Math.sin(t) ** 2 * Math.cos(2 * p),

  fz3: (t) => SQRT(7 / (16 * PI)) * (5 * Math.cos(t) ** 3 - 3 * Math.cos(t)),
};

/* ------------------------------------------------------------------ *
 * Radial functions (exact, in units of a₀, for Z = 1)
 * ------------------------------------------------------------------ */

export const RADIAL = {
  "1,0": (r) => 2 * Math.exp(-r),
  "2,0": (r) => (1 / (2 * SQRT(2))) * (2 - r) * Math.exp(-r / 2),
  "2,1": (r) => (1 / (2 * SQRT(6))) * r * Math.exp(-r / 2),
  "3,0": (r) => (2 / (81 * SQRT(3))) * (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3),
  "3,1": (r) => (4 / (81 * SQRT(6))) * (6 * r - r * r) * Math.exp(-r / 3),
  "3,2": (r) => (4 / (81 * SQRT(30))) * r * r * Math.exp(-r / 3),
};

/** The orbitals offered by the viewer. */
export const ORBITALS = [
  { id: "1s", label: "1s", n: 1, l: 0, angular: "s", extent: 6, note: "Spherical, no nodes. The ground state of hydrogen — the electron is most likely to be found at exactly one Bohr radius." },
  { id: "2s", label: "2s", n: 2, l: 0, angular: "s", extent: 18, note: "Spherical with one radial node — a shell where the wavefunction changes sign and the probability falls to zero." },
  { id: "2px", label: "2pₓ", n: 2, l: 1, angular: "px", extent: 16, note: "Two lobes of opposite phase along x, separated by a nodal plane through the nucleus." },
  { id: "2pz", label: "2p_z", n: 2, l: 1, angular: "pz", extent: 16, note: "The same shape aligned along z. Three of these — pₓ, p_y, p_z — are degenerate in a free atom." },
  { id: "3s", label: "3s", n: 3, l: 0, angular: "s", extent: 34, note: "Two radial nodes. Each extra shell adds another node and pushes the density further out." },
  { id: "3pz", label: "3p_z", n: 3, l: 1, angular: "pz", extent: 34, note: "A p orbital with an extra radial node — the inner lobes are the give-away." },
  { id: "3dz2", label: "3d_z²", n: 3, l: 2, angular: "dz2", extent: 34, note: "The odd one out: two lobes along z plus a torus around the equator, from the (3cos²θ − 1) angular part." },
  { id: "3dxy", label: "3d_xy", n: 3, l: 2, angular: "dxy", extent: 34, note: "Four lobes between the x and y axes, alternating in phase — two nodal planes." },
  { id: "3dx2y2", label: "3d_x²₋y²", n: 3, l: 2, angular: "dx2-y2", extent: 34, note: "Four lobes along the axes. In an octahedral complex this one points straight at the ligands, which is why the d orbitals split." },
];

export const ORBITALS_BY_ID = new Map(ORBITALS.map((o) => [o.id, o]));

/** Angular amplitude for an orbital at (θ, φ). */
export function angularValue(orbital, theta, phi) {
  const fn = ANGULAR[orbital.angular];
  if (!fn) throw new Error(`Unknown angular function "${orbital.angular}"`);
  return fn(theta, phi);
}

/** Radial amplitude R_nl(r), r in Bohr radii. */
export function radialValue(orbital, r) {
  const fn = RADIAL[`${orbital.n},${orbital.l}`];
  if (!fn) throw new Error(`No radial function for n=${orbital.n}, l=${orbital.l}`);
  return fn(r);
}

/** Full wavefunction ψ at a point given in spherical coordinates. */
export function psi(orbital, r, theta, phi) {
  return radialValue(orbital, r) * angularValue(orbital, theta, phi);
}

/** Radial probability density P(r) = r²|R(r)|² — what "most likely distance" means. */
export function radialProbability(orbital, r) {
  const R = radialValue(orbital, r);
  return r * r * R * R;
}

/**
 * The radius at which the electron is most likely to be found, found by scanning
 * the radial probability. For 1s this returns 1.0 a₀, as it must.
 */
export function mostProbableRadius(orbital, { max = 60, steps = 6000 } = {}) {
  let best = 0;
  let bestValue = -1;
  for (let i = 1; i <= steps; i += 1) {
    const r = (max * i) / steps;
    const value = radialProbability(orbital, r);
    if (value > bestValue) {
      bestValue = value;
      best = r;
    }
  }
  return best;
}

/** Radial nodes: the r > 0 values where R_nl changes sign (n − l − 1 of them). */
export function radialNodes(orbital, { max = 60, steps = 12000 } = {}) {
  const nodes = [];
  let previous = radialValue(orbital, 1e-6);
  for (let i = 1; i <= steps; i += 1) {
    const r = (max * i) / steps;
    const value = radialValue(orbital, r);
    if (previous !== 0 && Math.sign(value) !== Math.sign(previous)) {
      nodes.push(Number(r.toFixed(3)));
    }
    previous = value;
  }
  return nodes;
}

/** Angular (planar/conical) node count = l. */
export const angularNodeCount = (orbital) => orbital.l;

/* ------------------------------------------------------------------ *
 * Sampling for rendering
 * ------------------------------------------------------------------ */

/**
 * The angular shape surface r = |Y(θ, φ)|, as a triangle mesh.
 * Returns flat arrays ready for a three.js BufferGeometry: positions, per-vertex
 * phase sign (+1/−1) so the two halves of a p orbital can be coloured
 * differently, and triangle indices.
 */
export function angularSurface(orbital, { segments = 96, scale: sizeScale = 1 } = {}) {
  const rings = segments;
  const sectors = segments * 2;
  const positions = [];
  const phases = [];
  const indices = [];

  for (let i = 0; i <= rings; i += 1) {
    const theta = (PI * i) / rings;
    for (let j = 0; j <= sectors; j += 1) {
      const phi = (2 * PI * j) / sectors;
      const amplitude = angularValue(orbital, theta, phi);
      const r = Math.abs(amplitude) * sizeScale;
      positions.push(
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.cos(theta),
        r * Math.sin(theta) * Math.sin(phi)
      );
      phases.push(amplitude >= 0 ? 1 : -1);
    }
  }

  const stride = sectors + 1;
  for (let i = 0; i < rings; i += 1) {
    for (let j = 0; j < sectors; j += 1) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, phases, indices };
}

/**
 * Point cloud of the probability density |ψ|², by rejection sampling.
 * Unlike the shape surface this shows the radial nodes — the empty shells
 * inside a 2s or 3s orbital are real, and visible here.
 * @returns {{points: number[], phases: number[]}} xyz triples in Bohr radii
 */
export function densityCloud(orbital, { count = 12000, seed = 1 } = {}) {
  const random = mulberry32(seed);
  const extent = orbital.extent;
  const points = [];
  const phases = [];

  // Find the peak of |ψ|² over the sampling box to normalise the rejection test.
  let peak = 0;
  for (let i = 0; i < 4000; i += 1) {
    const r = (extent * (i % 200)) / 200;
    const theta = PI * random();
    const phi = 2 * PI * random();
    peak = Math.max(peak, psi(orbital, r, theta, phi) ** 2);
  }
  if (peak <= 0) return { points, phases };

  let attempts = 0;
  const maxAttempts = count * 400;
  while (points.length < count * 3 && attempts < maxAttempts) {
    attempts += 1;
    // Uniform in the cube, then rejected against |ψ|².
    const x = (random() * 2 - 1) * extent;
    const y = (random() * 2 - 1) * extent;
    const z = (random() * 2 - 1) * extent;
    const r = Math.sqrt(x * x + y * y + z * z);
    if (r > extent || r === 0) continue;
    const theta = Math.acos(z / r);
    const phi = Math.atan2(y, x);
    const amplitude = psi(orbital, r, theta, phi);
    if (amplitude * amplitude > random() * peak) {
      // Rendered with y as the vertical axis, matching the surface view.
      points.push(x, z, y);
      phases.push(amplitude >= 0 ? 1 : -1);
    }
  }
  return { points, phases };
}

/** Small deterministic PRNG, so a given orbital always renders identically. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
