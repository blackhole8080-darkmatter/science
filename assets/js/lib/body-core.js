/**
 * Whole-body anatomy: structures, systems and the geometry that places them.
 *
 * Positions and dimensions are in centimetres for a reference adult of 175 cm,
 * taken from standard anatomical references. The coordinate frame is the
 * anatomical one: +x towards the subject's left, +y superior (up), +z anterior
 * (towards the front). Note that the subject's left appears on the viewer's
 * right, which is why the heart sits at positive x yet looks right-of-centre
 * on screen — the same convention used in clinical imaging.
 *
 * Pure data and pure functions: no DOM, no three.js. The viewer turns these
 * specifications into meshes, so the anatomy can be tested independently and
 * swapped for scanned meshes without touching the model.
 */

export const BODY = {
  height: 175, // cm
  mass: 70, // kg
  vertebrae: 24, // cervical 7 + thoracic 12 + lumbar 5, excluding sacrum/coccyx
  ribPairs: 12,
};

/** Systems, in the order they are layered in the viewer. */
export const SYSTEMS = {
  skeletal: { label: "Skeletal", color: "#e8e2d0", description: "206 bones giving shape, protection and leverage; also the site of blood cell production." },
  nervous: { label: "Nervous", color: "#c9a0dc", description: "Brain, spinal cord and peripheral nerves — the body's signalling network." },
  cardiovascular: { label: "Cardiovascular", color: "#d94a4a", description: "Heart and vessels moving roughly 5 L of blood per minute at rest." },
  respiratory: { label: "Respiratory", color: "#5b9bd5", description: "Airways and lungs, exchanging oxygen and carbon dioxide across ~70 m² of alveolar surface." },
  digestive: { label: "Digestive", color: "#d9a441", description: "A ~9 m tube from mouth to anus, with the liver and pancreas supplying it." },
  urinary: { label: "Urinary", color: "#4aa88a", description: "Kidneys filtering ~180 L of plasma daily to produce 1–2 L of urine." },
  integumentary: { label: "Skin", color: "#d8a488", description: "The largest organ: ~1.8 m² and about 16% of body mass." },
};

/**
 * The spinal curve. A real spine is not a straight column — it carries a
 * cervical lordosis, a thoracic kyphosis and a lumbar lordosis, and those
 * curves are what let it absorb load. `z` is the anterior offset in cm.
 */
export function spineCurveOffset(y) {
  const cervical = 2.2 * Math.exp(-(((y - 142) / 9) ** 2)); // forward
  const thoracic = -3.0 * Math.exp(-(((y - 118) / 15) ** 2)); // backward
  const lumbar = 2.6 * Math.exp(-(((y - 90) / 9) ** 2)); // forward
  return cervical + thoracic + lumbar;
}

/**
 * The 24 presacral vertebrae from L5 up to C1, each with its own body size.
 * Lumbar vertebrae are much larger than cervical ones because they carry more
 * load — that size gradient is the single most visible fact about a spine.
 */
export function vertebrae() {
  const bottom = 84; // top of the sacrum
  const top = 149; // base of the skull
  const out = [];
  for (let i = 0; i < BODY.vertebrae; i += 1) {
    const t = i / (BODY.vertebrae - 1);
    const y = bottom + (top - bottom) * t;
    const region = i < 5 ? "lumbar" : i < 17 ? "thoracic" : "cervical";
    // Body radius shrinks going up: lumbar ~2.5 cm, cervical ~1.3 cm.
    const radius = 2.5 - 1.2 * t;
    out.push({
      index: i,
      name: region === "lumbar" ? `L${5 - i}` : region === "thoracic" ? `T${17 - i}` : `C${24 - i}`,
      region,
      position: [0, y, spineCurveOffset(y)],
      radius,
      height: 2.9 - 1.0 * t,
    });
  }
  return out;
}

/**
 * Rib pairs. Ribs 1–7 are "true" (joined to the sternum by their own
 * cartilage), 8–10 "false" (shared cartilage), 11–12 "floating".
 */
export function ribs() {
  const out = [];
  for (let i = 0; i < BODY.ribPairs; i += 1) {
    const t = i / (BODY.ribPairs - 1);
    const y = 143 - i * 3.1;
    // The cage is widest around ribs 7–8, so the radius peaks mid-way.
    const spread = 8.0 + 6.5 * Math.sin(Math.PI * Math.min(t * 1.15, 1));
    out.push({
      index: i,
      number: i + 1,
      type: i < 7 ? "true" : i < 10 ? "false" : "floating",
      // Floating ribs stop short and do not reach the sternum.
      sweep: i < 10 ? 165 : 105,
      radius: spread,
      position: [0, y, spineCurveOffset(y)],
      drop: 2.4 + 2.6 * t, // ribs angle downwards as they wrap forwards
    });
  }
  return out;
}

/**
 * The small intestine: about 6 m of tube packed into the central abdomen.
 * Modelled as a serpentine coil so the packing is visible.
 */
export function smallIntestinePath({ turns = 7, radius = 7.2, top = 104, bottom = 86 } = {}) {
  const points = [];
  const steps = turns * 24;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    // Radius pulses so successive loops nest rather than overlap exactly.
    const r = radius * (0.55 + 0.45 * Math.sin(t * Math.PI * 3.1));
    points.push([r * Math.cos(angle), top - (top - bottom) * t, 2 + r * 0.55 * Math.sin(angle)]);
  }
  return points;
}

/** The large intestine frames the small: ascending, transverse, descending, sigmoid. */
export function largeIntestinePath() {
  return [
    [-9.5, 84, 1], // caecum, lower right (subject's right = −x)
    [-10.5, 92, 1],
    [-10.8, 104, 1], // ascending
    [-9.5, 110, 2], // hepatic flexure
    [0, 112, 3], // transverse
    [9.5, 110, 2], // splenic flexure
    [10.6, 100, 1],
    [10.0, 90, 1], // descending
    [6.0, 84, 1], // sigmoid
    [1.5, 79, 0.5],
    [0, 74, 0], // rectum
  ];
}

/**
 * Every modelled structure. `shape` is a recipe the viewer knows how to build;
 * `asset` names an optional glTF file that replaces the procedural geometry
 * when present (see assets/anatomy/manifest.json).
 */
export const STRUCTURES = [
  /* ------------------------------------------------------ nervous ------- */
  {
    id: "brain", name: "Brain", latin: "Encephalon", system: "nervous",
    mass: 1.4, massUnit: "kg",
    shape: { type: "brain", position: [0, 160, 0.5], width: 14, height: 11.5, depth: 16.5 },
    asset: "brain.glb",
    function: "Processes sensory input, controls movement, and is the seat of memory, language and consciousness.",
    facts: [
      ["Mass", "≈1.4 kg (2% of body mass)"],
      ["Energy use", "≈20% of resting oxygen consumption"],
      ["Neurons", "≈86 billion"],
      ["Blood flow", "≈750 mL·min⁻¹"],
    ],
  },
  {
    id: "spinal-cord", name: "Spinal cord", latin: "Medulla spinalis", system: "nervous",
    shape: { type: "cord", from: 84, to: 150 },
    function: "Carries signals between brain and body, and closes reflex arcs without involving the brain at all.",
    facts: [["Length", "≈45 cm"], ["Ends at", "L1–L2 vertebra"], ["Conduction speed", "up to 120 m·s⁻¹"]],
  },

  /* ----------------------------------------------- cardiovascular ------- */
  {
    id: "heart", name: "Heart", latin: "Cor", system: "cardiovascular",
    mass: 300, massUnit: "g",
    shape: { type: "heart", position: [1.5, 124, 3.5] },
    asset: "heart.glb",
    function: "Two pumps in series: the right sends blood to the lungs, the left to the rest of the body.",
    facts: [
      ["Mass", "250–350 g"],
      ["Resting output", "5.25 L·min⁻¹"],
      ["Beats per day", "≈100,000"],
      ["Position", "two-thirds left of the midline"],
    ],
    linkTo: "biology/heart",
  },
  {
    id: "aorta", name: "Aorta", latin: "Aorta", system: "cardiovascular",
    shape: {
      type: "vessel", radius: 1.25,
      path: [[1, 127, 3], [0.5, 134, 2], [-2, 137, 0], [-4, 133, -1], [-3.5, 120, -2], [-2, 100, -3], [-1, 88, -3], [0, 82, -3]],
    },
    function: "The body's largest artery, carrying oxygenated blood from the left ventricle to every organ.",
    facts: [["Diameter", "≈2.5 cm at the root"], ["Peak velocity", "≈1.3 m·s⁻¹"], ["Wall", "three layers, highly elastic"]],
  },
  {
    id: "vena-cava", name: "Venae cavae", latin: "Vena cava", system: "cardiovascular",
    shape: {
      type: "vessel", radius: 1.4,
      path: [[-2, 82, -1], [-2.5, 100, -1.5], [-2.5, 118, -1], [-2, 126, 1], [-1.5, 132, 0], [-1.5, 142, -1]],
    },
    function: "Returns deoxygenated blood to the right atrium from the upper and lower body.",
    facts: [["Pressure", "≈3–8 mmHg"], ["Diameter", "≈2–3 cm"], ["Flow", "the whole cardiac output, every minute"]],
  },

  /* -------------------------------------------------- respiratory ------- */
  {
    id: "lungs", name: "Lungs", latin: "Pulmones", system: "respiratory",
    mass: 1.1, massUnit: "kg",
    shape: { type: "lungs" },
    asset: "lungs.glb",
    function: "Gas exchange. Oxygen crosses into blood and carbon dioxide crosses out, across a membrane under a micrometre thick.",
    facts: [
      ["Lobes", "3 right, 2 left (the left yields space to the heart)"],
      ["Alveoli", "≈300–480 million"],
      ["Exchange surface", "≈70 m²"],
      ["Tidal volume", "≈500 mL at rest"],
    ],
    linkTo: "biology/airways",
  },
  {
    id: "trachea", name: "Trachea & bronchi", latin: "Trachea", system: "respiratory",
    shape: { type: "airway", top: 148, bifurcation: 129 },
    function: "Conducts air to the lungs, held open by C-shaped cartilage rings so it cannot collapse on inhalation.",
    facts: [["Length", "≈12 cm"], ["Diameter", "≈1.8 cm"], ["Cartilage rings", "16–20, C-shaped"]],
    linkTo: "biology/airways",
  },
  {
    id: "diaphragm", name: "Diaphragm", latin: "Diaphragma", system: "respiratory",
    shape: { type: "dome", position: [0, 112, 0], radiusX: 13.5, radiusZ: 9.5, height: 5 },
    function: "The main muscle of breathing. It contracts downwards, lowering thoracic pressure so air is drawn in.",
    facts: [["Excursion", "1.5 cm quiet, up to 10 cm deep"], ["Nerve", "phrenic (C3–C5)"], ["Share of quiet breathing", "≈70%"]],
  },

  /* ----------------------------------------------------- digestive ------ */
  {
    id: "liver", name: "Liver", latin: "Hepar", system: "digestive",
    mass: 1.5, massUnit: "kg",
    shape: { type: "liver" },
    asset: "liver.glb",
    function: "Over 500 functions: detoxification, bile production, glycogen storage, and synthesis of most plasma proteins.",
    facts: [
      ["Mass", "1.4–1.6 kg — the largest internal organ"],
      ["Blood supply", "75% portal vein, 25% hepatic artery"],
      ["Regeneration", "can regrow from ~25% of its mass"],
      ["Lobes", "right, left, caudate, quadrate"],
    ],
  },
  {
    id: "stomach", name: "Stomach", latin: "Gaster", system: "digestive",
    shape: { type: "stomach" },
    function: "Stores and churns food, and secretes hydrochloric acid and pepsin to begin protein digestion.",
    facts: [["Empty volume", "≈50 mL"], ["Full volume", "1–4 L"], ["pH", "1.5–3.5"], ["Emptying time", "2–5 hours"]],
    linkTo: "chemistry/ph",
  },
  {
    id: "small-intestine", name: "Small intestine", latin: "Intestinum tenue", system: "digestive",
    shape: { type: "coil" },
    asset: "intestine.glb",
    function: "Where almost all nutrient absorption happens, across villi and microvilli that multiply the surface area enormously.",
    facts: [
      ["Length", "≈6 m"],
      ["Absorptive surface", "≈30 m² — 60× a bare tube"],
      ["Parts", "duodenum, jejunum, ileum"],
      ["Transit", "3–5 hours"],
    ],
    linkTo: "biology/sav",
  },
  {
    id: "large-intestine", name: "Large intestine", latin: "Intestinum crassum", system: "digestive",
    shape: { type: "colon" },
    function: "Reclaims water and electrolytes, and houses the gut microbiota.",
    facts: [["Length", "≈1.5 m"], ["Water reclaimed", "≈1.5 L daily"], ["Microbial cells", "≈10¹³–10¹⁴"], ["Transit", "12–48 hours"]],
  },
  {
    id: "pancreas", name: "Pancreas", latin: "Pancreas", system: "digestive",
    shape: { type: "tapered", from: [-2, 108, -2], to: [10, 111, -3], radius: 1.9 },
    asset: "pancreas.glb",
    function: "Both glands in one: digestive enzymes into the duodenum, and insulin and glucagon into the blood.",
    facts: [["Length", "≈15 cm"], ["Enzyme output", "≈1.5 L·day⁻¹"], ["Islets of Langerhans", "≈1 million"], ["Insulin cells", "β cells"]],
  },
  {
    id: "spleen", name: "Spleen", latin: "Splen", system: "digestive",
    shape: { type: "ellipsoid", position: [11, 114, -2], radii: [3.2, 5.5, 2.6] },
    function: "Filters old red blood cells and acts as a reservoir of immune cells — part of the lymphatic system.",
    facts: [["Size", "≈12 × 7 × 3 cm"], ["Blood filtered", "≈350 L·day⁻¹"], ["Not vital", "removable, at some infection cost"]],
  },
  {
    id: "gallbladder", name: "Gallbladder", latin: "Vesica biliaris", system: "digestive",
    shape: { type: "ellipsoid", position: [-5, 107, 4], radii: [1.5, 3.0, 1.5] },
    function: "Stores and concentrates bile from the liver, releasing it when fat reaches the duodenum.",
    facts: [["Capacity", "30–50 mL"], ["Concentrates bile", "up to 10×"]],
  },

  /* ------------------------------------------------------- urinary ------ */
  {
    id: "kidneys", name: "Kidneys", latin: "Renes", system: "urinary",
    shape: { type: "kidneys" },
    asset: "kidneys.glb",
    function: "Filter blood, regulate blood pressure, fluid balance and pH, and trigger red-cell production via erythropoietin.",
    facts: [
      ["Nephrons", "≈1 million per kidney"],
      ["Plasma filtered", "≈180 L·day⁻¹"],
      ["Urine produced", "1–2 L·day⁻¹ — 99% is reabsorbed"],
      ["Blood share", "≈20–25% of cardiac output"],
    ],
  },
  {
    id: "bladder", name: "Bladder", latin: "Vesica urinaria", system: "urinary",
    shape: { type: "ellipsoid", position: [0, 76, 2], radii: [4.5, 4.0, 4.0] },
    function: "Stores urine until voiding; its wall stretches enormously as it fills.",
    facts: [["First urge", "≈150–250 mL"], ["Capacity", "≈400–600 mL"], ["Muscle", "detrusor"]],
  },
];

export const STRUCTURES_BY_ID = new Map(STRUCTURES.map((s) => [s.id, s]));

/** Structures grouped by system, in the SYSTEMS declaration order. */
export function structuresBySystem() {
  const grouped = new Map(Object.keys(SYSTEMS).map((key) => [key, []]));
  for (const structure of STRUCTURES) grouped.get(structure.system)?.push(structure);
  return grouped;
}

/** Total mass of the structures that declare one, in kg. */
export function modelledMass() {
  return STRUCTURES.reduce((sum, s) => {
    if (!s.mass) return sum;
    return sum + (s.massUnit === "g" ? s.mass / 1000 : s.mass);
  }, 0);
}
