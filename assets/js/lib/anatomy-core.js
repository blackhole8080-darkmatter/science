/**
 * Human physiology models.
 *
 * These are the quantitative models physiologists actually use, not sculpted
 * shapes: the airway tree follows Weibel's morphometry, the cardiac cycle uses
 * measured chamber pressures and phase durations, the action potential is the
 * Hodgkin–Huxley system integrated in real time, and the DNA helix is built from
 * B-form crystallographic parameters.
 *
 * Pure functions and plain data — no DOM, no three.js — so every model is
 * testable and the same numbers drive both the 3D view and the charts.
 */

/* ================================================================== *
 * Airways — Weibel's symmetric branching model
 * ================================================================== */

/**
 * Weibel's model A: at each generation the airway divides in two, and both
 * diameter and length scale by 2^(−1/3). The cube root is not arbitrary — it is
 * the ratio that keeps flow resistance minimal for a given volume of tissue
 * (Murray's law), and it means total cross-sectional area *grows* with depth
 * even as each tube narrows. That growth is why gas exchange works at all.
 */
export const WEIBEL = {
  trachealDiameter: 1.8, // cm, generation 0
  trachealLength: 12.0, // cm
  generations: 23, // trachea (0) through alveolar sacs (23)
  terminalBronchiole: 16, // conducting zone ends here
  respiratoryOnset: 17, // gas exchange begins
};

const CBRT_HALF = Math.cbrt(0.5);

/** Structural numbers for one airway generation. */
export function airwayGeneration(n) {
  const scale = CBRT_HALF ** n;
  const diameter = WEIBEL.trachealDiameter * scale;
  const length = WEIBEL.trachealLength * scale;
  const count = 2 ** n;
  const area = count * Math.PI * (diameter / 2) ** 2;
  return {
    generation: n,
    count,
    diameter,
    length,
    totalCrossSection: area,
    zone: n <= WEIBEL.terminalBronchiole ? "conducting" : "respiratory",
    name: airwayName(n),
  };
}

function airwayName(n) {
  if (n === 0) return "Trachea";
  if (n === 1) return "Main bronchi";
  if (n <= 3) return "Lobar bronchi";
  if (n <= 10) return "Segmental bronchi";
  if (n <= 15) return "Bronchioles";
  if (n === 16) return "Terminal bronchioles";
  if (n <= 19) return "Respiratory bronchioles";
  if (n <= 22) return "Alveolar ducts";
  return "Alveolar sacs";
}

/** Every generation, for the table and the cross-section chart. */
export function airwayTable(maxGeneration = WEIBEL.generations) {
  return Array.from({ length: maxGeneration + 1 }, (_, n) => airwayGeneration(n));
}

/**
 * A 3D bronchial tree. Each bifurcation rotates about the parent axis so the
 * daughters spread in space rather than collapsing into a plane, and every
 * segment's length and radius come from the Weibel numbers above.
 * @returns {{segments: Array, depth: number}}
 */
export function bronchialTree({ depth = 8, branchAngle = 35, spiral = 92 } = {}) {
  const segments = [];
  const angle = (branchAngle * Math.PI) / 180;

  /** Grow one segment, then two daughters rotated about its own axis. */
  function grow(origin, direction, up, generation) {
    if (generation > depth) return;
    const spec = airwayGeneration(generation);
    // Model centimetres map 1:1 to scene units; the trachea is ~12 units long.
    const end = [
      origin[0] + direction[0] * spec.length,
      origin[1] + direction[1] * spec.length,
      origin[2] + direction[2] * spec.length,
    ];
    segments.push({
      generation,
      from: origin,
      to: end,
      radius: spec.diameter / 2,
      zone: spec.zone,
    });
    if (generation === depth) return;

    // Rotate the branching plane a little each generation so the tree fills space.
    const twist = ((spiral * generation) * Math.PI) / 180;
    const axis = rotateAboutAxis(up, direction, twist);
    for (const sign of [1, -1]) {
      const daughter = normalize(rotateAboutAxis(direction, axis, sign * angle));
      grow(end, daughter, cross(daughter, axis), generation + 1);
    }
  }

  grow([0, 0, 0], [0, -1, 0], [1, 0, 0], 0);
  return { segments, depth };
}

/* --------------------------------------------------- vector helpers ---- */

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (v) => {
  const l = Math.hypot(...v);
  return l === 0 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
};

/** Rodrigues' rotation of `v` about unit `axis` by `angle` radians. */
function rotateAboutAxis(v, axis, angle) {
  const k = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const kdv = dot3(k, v);
  return [
    v[0] * c + kv[0] * s + k[0] * kdv * (1 - c),
    v[1] * c + kv[1] * s + k[1] * kdv * (1 - c),
    v[2] * c + kv[2] * s + k[2] * kdv * (1 - c),
  ];
}

/* ================================================================== *
 * The cardiac cycle
 * ================================================================== */

/**
 * Phase durations at 75 bpm (cycle = 0.8 s) and the chamber pressures that
 * open and close the valves. Valves are not scripted — they are opened and
 * closed by the pressure differences below, which is how they actually work.
 */
export const CARDIAC = {
  restingRate: 75, // beats per minute
  endDiastolicVolume: 120, // mL
  endSystolicVolume: 50, // mL
  phases: [
    { id: "atrial-systole", label: "Atrial systole", fraction: 0.125 },
    { id: "isovolumetric-contraction", label: "Isovolumetric contraction", fraction: 0.06 },
    { id: "ejection", label: "Ventricular ejection", fraction: 0.24 },
    { id: "isovolumetric-relaxation", label: "Isovolumetric relaxation", fraction: 0.075 },
    { id: "filling", label: "Ventricular filling", fraction: 0.5 },
  ],
};

/**
 * State of the heart at phase `t` of the cycle (0–1).
 * Pressures are in mmHg and volume in mL, tracking the classic Wiggers diagram.
 */
export function cardiacState(t) {
  const phase = ((t % 1) + 1) % 1;

  // Ventricular pressure: near zero while filling, a sharp systolic peak.
  const ventricular = ventricularPressure(phase);
  const aortic = aorticPressure(phase);
  const atrial = atrialPressure(phase);
  const volume = ventricularVolume(phase);

  // Valves follow the pressure gradients, as they do in life.
  const mitralOpen = atrial > ventricular;
  const aorticOpen = ventricular > aortic;

  return {
    phase,
    label: phaseLabel(phase),
    ventricularPressure: ventricular,
    aorticPressure: aortic,
    atrialPressure: atrial,
    ventricularVolume: volume,
    mitralOpen,
    aorticOpen,
    // Contraction fraction drives the 3D chamber deformation.
    contraction: (CARDIAC.endDiastolicVolume - volume) / (CARDIAC.endDiastolicVolume - CARDIAC.endSystolicVolume),
  };
}

function phaseLabel(phase) {
  let cumulative = 0;
  for (const entry of CARDIAC.phases) {
    cumulative += entry.fraction;
    if (phase < cumulative) return entry.label;
  }
  return CARDIAC.phases.at(-1).label;
}

function ventricularPressure(phase) {
  if (phase < 0.125) return 4 + 4 * Math.sin((phase / 0.125) * Math.PI); // atrial kick
  if (phase < 0.185) return 8 + 72 * ((phase - 0.125) / 0.06); // isovolumetric rise
  if (phase < 0.425) {
    const s = (phase - 0.185) / 0.24;
    return 80 + 45 * Math.sin(s * Math.PI); // ejection, peaking at ~125
  }
  if (phase < 0.5) return 80 * (1 - (phase - 0.425) / 0.075) + 2; // relaxation
  return 2 + 6 * ((phase - 0.5) / 0.5); // filling
}

function aorticPressure(phase) {
  if (phase < 0.185) return 80 - 2 * (phase / 0.185);
  if (phase < 0.425) {
    const s = (phase - 0.185) / 0.24;
    return 78 + 47 * Math.sin(s * Math.PI);
  }
  // Dicrotic notch as the aortic valve snaps shut, then elastic recoil decay.
  const decay = (phase - 0.425) / 0.575;
  return 95 - 15 * decay - 3 * Math.exp(-decay * 40) * Math.cos(decay * 60);
}

function atrialPressure(phase) {
  if (phase < 0.125) return 8 + 6 * Math.sin((phase / 0.125) * Math.PI);
  if (phase < 0.5) return 6 - 2 * ((phase - 0.125) / 0.375);
  return 4 + 5 * ((phase - 0.5) / 0.5);
}

function ventricularVolume(phase) {
  const { endDiastolicVolume: EDV, endSystolicVolume: ESV } = CARDIAC;
  if (phase < 0.125) return EDV - 20 + 20 * (phase / 0.125); // atrial kick tops it up
  if (phase < 0.185) return EDV; // isovolumetric: valves shut, nothing leaves
  if (phase < 0.425) {
    const s = (phase - 0.185) / 0.24;
    return EDV - (EDV - ESV) * Math.sin(s * (Math.PI / 2)) ** 1.4;
  }
  if (phase < 0.5) return ESV; // isovolumetric relaxation
  const s = (phase - 0.5) / 0.5;
  return ESV + (EDV - 20 - ESV) * (1 - Math.exp(-4 * s)); // rapid then slow filling
}

/** Derived haemodynamics — the numbers a clinician would quote. */
export function haemodynamics(rate = CARDIAC.restingRate) {
  const strokeVolume = CARDIAC.endDiastolicVolume - CARDIAC.endSystolicVolume;
  return {
    strokeVolume,
    cardiacOutput: (strokeVolume * rate) / 1000, // L/min
    ejectionFraction: (strokeVolume / CARDIAC.endDiastolicVolume) * 100,
    cycleDuration: 60 / rate,
  };
}

/* ================================================================== *
 * The action potential — Hodgkin & Huxley (1952)
 * ================================================================== */

/**
 * The original squid giant axon parameters. Voltages are in mV relative to
 * rest, conductances in mS/cm², capacitance in µF/cm².
 */
export const HH = {
  restingPotential: -65,
  capacitance: 1.0,
  gNa: 120, eNa: 50,
  gK: 36, eK: -77,
  gLeak: 0.3, eLeak: -54.387,
};

// Rate constants. The 1e-6 guards are for the removable singularities at the
// points where these expressions are 0/0.
const alphaN = (v) => (Math.abs(v + 55) < 1e-6 ? 0.1 : (0.01 * (v + 55)) / (1 - Math.exp(-(v + 55) / 10)));
const betaN = (v) => 0.125 * Math.exp(-(v + 65) / 80);
const alphaM = (v) => (Math.abs(v + 40) < 1e-6 ? 1 : (0.1 * (v + 40)) / (1 - Math.exp(-(v + 40) / 10)));
const betaM = (v) => 4 * Math.exp(-(v + 65) / 18);
const alphaH = (v) => 0.07 * Math.exp(-(v + 65) / 20);
const betaH = (v) => 1 / (1 + Math.exp(-(v + 35) / 10));

/** Steady-state gating variables at the resting potential. */
export function restingGates(v = HH.restingPotential) {
  return {
    n: alphaN(v) / (alphaN(v) + betaN(v)),
    m: alphaM(v) / (alphaM(v) + betaM(v)),
    h: alphaH(v) / (alphaH(v) + betaH(v)),
  };
}

/**
 * Integrate the Hodgkin–Huxley equations.
 * @param {object} options
 * @param {number} options.stimulus injected current density, µA/cm²
 * @param {number} options.stimulusStart ms
 * @param {number} options.stimulusDuration ms
 * @param {number} options.duration total simulated time, ms
 * @returns {{trace: Array, fired: boolean, peak: number, threshold: boolean}}
 */
export function simulateActionPotential({
  stimulus = 10,
  stimulusStart = 5,
  stimulusDuration = 1,
  duration = 40,
  dt = 0.01,
} = {}) {
  let v = HH.restingPotential;
  let { n, m, h } = restingGates();
  const trace = [];
  const steps = Math.round(duration / dt);
  const sampleEvery = Math.max(1, Math.round(0.05 / dt));

  let peak = v;
  for (let i = 0; i <= steps; i += 1) {
    const t = i * dt;
    const injected = t >= stimulusStart && t < stimulusStart + stimulusDuration ? stimulus : 0;

    const iNa = HH.gNa * m ** 3 * h * (v - HH.eNa);
    const iK = HH.gK * n ** 4 * (v - HH.eK);
    const iLeak = HH.gLeak * (v - HH.eLeak);

    const dv = (injected - iNa - iK - iLeak) / HH.capacitance;
    const dn = alphaN(v) * (1 - n) - betaN(v) * n;
    const dm = alphaM(v) * (1 - m) - betaM(v) * m;
    const dh = alphaH(v) * (1 - h) - betaH(v) * h;

    v += dv * dt;
    n += dn * dt;
    m += dm * dt;
    h += dh * dt;
    peak = Math.max(peak, v);

    if (i % sampleEvery === 0) {
      trace.push({ t, v, n, m, h, iNa: -iNa, iK: -iK, injected });
    }
  }

  return {
    trace,
    peak,
    // An all-or-nothing spike overshoots zero; a subthreshold nudge never does.
    fired: peak > 0,
    restingPotential: HH.restingPotential,
  };
}

/** The smallest stimulus that triggers a spike, found by bisection. */
export function findThreshold(options = {}) {
  let low = 0;
  let high = 40;
  for (let i = 0; i < 22; i += 1) {
    const mid = (low + high) / 2;
    if (simulateActionPotential({ ...options, stimulus: mid }).fired) high = mid;
    else low = mid;
  }
  return high;
}

/* ================================================================== *
 * B-DNA
 * ================================================================== */

/** Crystallographic parameters of the B-form double helix. */
export const B_DNA = {
  rise: 3.4, // Å per base pair
  twist: 34.3, // degrees per base pair (≈10.5 bp per turn)
  radius: 10.0, // Å, backbone from the axis
  majorGrooveWidth: 22, // Å
  minorGrooveWidth: 12, // Å
  // Angular offset between the two backbones — this asymmetry *is* the reason
  // one groove is wide and the other narrow.
  strandOffset: 140, // degrees
};

/**
 * Build a double helix for a sequence, in ångströms.
 * @returns {{strandA: Array, strandB: Array, pairs: Array, length: number, turns: number}}
 */
export function dnaHelix(sequence) {
  const bases = String(sequence).toUpperCase().replace(/[^ATGC]/g, "").split("");
  if (!bases.length) throw new Error("Enter a DNA sequence of A, T, G and C");
  const complement = { A: "T", T: "A", G: "C", C: "G" };

  const strandA = [];
  const strandB = [];
  const pairs = [];

  bases.forEach((base, index) => {
    const angle = (B_DNA.twist * index * Math.PI) / 180;
    const y = B_DNA.rise * index;
    const offset = (B_DNA.strandOffset * Math.PI) / 180;

    const a = [B_DNA.radius * Math.cos(angle), y, B_DNA.radius * Math.sin(angle)];
    const b = [B_DNA.radius * Math.cos(angle + offset), y, B_DNA.radius * Math.sin(angle + offset)];
    strandA.push({ position: a, base });
    strandB.push({ position: b, base: complement[base] });
    pairs.push({
      index,
      from: a,
      to: b,
      base,
      partner: complement[base],
      // G–C pairs are held by three hydrogen bonds, A–T by two.
      hydrogenBonds: base === "G" || base === "C" ? 3 : 2,
    });
  });

  return {
    strandA,
    strandB,
    pairs,
    length: bases.length * B_DNA.rise,
    turns: (bases.length * B_DNA.twist) / 360,
    gcContent: (bases.filter((b) => b === "G" || b === "C").length / bases.length) * 100,
  };
}
