/**
 * Molecular geometry engine.
 *
 * Coordinates are generated from *measured* structural data — bond lengths in
 * ångströms and bond angles in degrees taken from gas-phase spectroscopy and
 * diffraction studies — rather than typed in by hand. Each molecule declares its
 * VSEPR family plus its experimental parameters, and the builder places the
 * atoms. That keeps the geometry honest: the tetrahedral angle really is
 * 109.47°, and water really is 104.45°, not an idealised 109.47°.
 *
 * Pure functions, no DOM and no three.js — so the geometry can be tested.
 */

/* ------------------------------------------------------------------ *
 * Vector helpers (plain [x, y, z] arrays)
 * ------------------------------------------------------------------ */

export const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (v) => Math.sqrt(dot(v, v));
export const normalize = (v) => {
  const l = length(v);
  return l === 0 ? [0, 0, 0] : scale(v, 1 / l);
};

/** Angle a–b–c in degrees, where b is the vertex. */
export function angleBetween(a, b, c) {
  const u = normalize(sub(a, b));
  const v = normalize(sub(c, b));
  return (Math.acos(Math.min(1, Math.max(-1, dot(u, v)))) * 180) / Math.PI;
}

const rad = (deg) => (deg * Math.PI) / 180;

/* ------------------------------------------------------------------ *
 * Atom display data
 * ------------------------------------------------------------------ */

/**
 * Element colours in the Jmol/PyMOL convention — the CPK scheme as molecular
 * viewers actually implement it, where carbon is mid-grey rather than the
 * original black. That is both the de-facto standard readers recognise and the
 * legible choice: true-black carbon disappears against a dark background.
 *
 * This is deliberately separate from the app's periodic-table category palette,
 * which answers a different question. Every atom is also labelled with its
 * element symbol, so colour is never the only cue here either.
 */
export const CPK_COLORS = {
  H: "#ffffff", C: "#909090", N: "#3050f8", O: "#ff0d0d", F: "#90e050",
  Cl: "#1ff01f", Br: "#a62929", I: "#940094", He: "#d9ffff", Ne: "#b3e3f5",
  Ar: "#80d1e3", Kr: "#5cb8d1", Xe: "#429eb0", P: "#ff8000", S: "#ffff30",
  B: "#ffb5b5", Li: "#cc80ff", Na: "#ab5cf2", K: "#8f40d4", Cs: "#57178f",
  Mg: "#8aff00", Ca: "#3dff00", Zn: "#7d80b0", Cu: "#c88033", Fe: "#e06633",
  Ti: "#bfc2c7", Si: "#f0c8a0", Al: "#bfa6a6", Ni: "#50d050", Ag: "#c0c0c0",
  Au: "#ffd123",
};

/** Van der Waals radii (Å), used to size the space-filling view. */
export const VDW_RADII = {
  H: 1.20, C: 1.70, N: 1.55, O: 1.52, F: 1.47, Cl: 1.75, Br: 1.85, I: 1.98,
  P: 1.80, S: 1.80, B: 1.92, Si: 2.10, Xe: 2.16, Na: 2.27, Cl_: 1.75,
  K: 2.75, Cs: 3.43, Zn: 1.39, Cu: 1.40, Fe: 1.94, C_: 1.70,
};

export const atomColor = (symbol) => CPK_COLORS[symbol] || "#c56cf0";
export const vdwRadius = (symbol) => VDW_RADII[symbol] || 1.7;

/* ------------------------------------------------------------------ *
 * VSEPR direction sets
 * ------------------------------------------------------------------ */

/**
 * Unit direction vectors for each electron-domain geometry.
 * `angle` is the experimental X–A–X angle where the family allows it to vary
 * from the ideal (bent, trigonal pyramidal): lone-pair repulsion squeezes the
 * bonding pairs, which is exactly what the measured value captures.
 */
export const GEOMETRIES = {
  linear: {
    label: "Linear",
    idealAngle: 180,
    directions: () => [[0, 0, 1], [0, 0, -1]],
  },
  bent: {
    label: "Bent",
    idealAngle: 109.47,
    // Both bonds in the xz-plane, symmetric about +z, separated by `angle`.
    directions: (angle) => {
      const half = rad(angle) / 2;
      return [
        [Math.sin(half), 0, Math.cos(half)],
        [-Math.sin(half), 0, Math.cos(half)],
      ];
    },
  },
  trigonalPlanar: {
    label: "Trigonal planar",
    idealAngle: 120,
    directions: () => [0, 120, 240].map((phi) => [Math.cos(rad(phi)), Math.sin(rad(phi)), 0]),
  },
  trigonalPyramidal: {
    label: "Trigonal pyramidal",
    idealAngle: 109.47,
    /**
     * Three equivalent bonds at a mutual angle θ. For directions at polar angle
     * α from the C₃ axis, cos θ = cos²α − ½sin²α, so sin²α = (1 − cos θ) / 1.5.
     */
    directions: (angle) => {
      const sinSq = (1 - Math.cos(rad(angle))) / 1.5;
      const sinA = Math.sqrt(Math.max(0, Math.min(1, sinSq)));
      const cosA = Math.sqrt(Math.max(0, 1 - sinSq));
      return [0, 120, 240].map((phi) => [sinA * Math.cos(rad(phi)), sinA * Math.sin(rad(phi)), cosA]);
    },
  },
  tetrahedral: {
    label: "Tetrahedral",
    idealAngle: 109.47,
    directions: () => {
      const k = 1 / Math.sqrt(3);
      return [[k, k, k], [k, -k, -k], [-k, k, -k], [-k, -k, k]];
    },
  },
  trigonalBipyramidal: {
    label: "Trigonal bipyramidal",
    idealAngle: 120,
    // Equatorial trio first, then the two axial positions.
    directions: () => [
      ...[0, 120, 240].map((phi) => [Math.cos(rad(phi)), Math.sin(rad(phi)), 0]),
      [0, 0, 1],
      [0, 0, -1],
    ],
  },
  seesaw: {
    label: "Seesaw",
    idealAngle: 120,
    // Trigonal bipyramid with one equatorial site taken by a lone pair.
    directions: () => [
      [Math.cos(rad(120)), Math.sin(rad(120)), 0],
      [Math.cos(rad(240)), Math.sin(rad(240)), 0],
      [0, 0, 1],
      [0, 0, -1],
    ],
  },
  tShaped: {
    label: "T-shaped",
    idealAngle: 90,
    // Two equatorial sites hold lone pairs, leaving one equatorial + two axial.
    directions: () => [[1, 0, 0], [0, 0, 1], [0, 0, -1]],
  },
  octahedral: {
    label: "Octahedral",
    idealAngle: 90,
    directions: () => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  },
  squarePlanar: {
    label: "Square planar",
    idealAngle: 90,
    directions: () => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]],
  },
};

/** Where the lone pairs sit, so the viewer can show the full electron domain. */
const LONE_PAIR_DIRECTIONS = {
  bent: (angle) => {
    // The two lone pairs complete a distorted tetrahedron, opposite the bonds.
    const half = rad(angle) / 2;
    const z = -Math.cos(half) * 0.6;
    return [[0, Math.sin(half), z], [0, -Math.sin(half), z]];
  },
  trigonalPyramidal: () => [[0, 0, -1]],
  tShaped: () => [[Math.cos(rad(120)), Math.sin(rad(120)), 0], [Math.cos(rad(240)), Math.sin(rad(240)), 0]],
  seesaw: () => [[1, 0, 0]],
  squarePlanar: () => [[0, 0, 1], [0, 0, -1]],
};

/* ------------------------------------------------------------------ *
 * Builders
 * ------------------------------------------------------------------ */

/**
 * Build a single-centre molecule (AXnEm) from its VSEPR family and measured
 * parameters.
 * @param {object} spec
 * @returns {{atoms: Array, bonds: Array, lonePairs: Array}}
 */
function buildCentral(spec) {
  const geometry = GEOMETRIES[spec.geometry];
  if (!geometry) throw new Error(`Unknown geometry "${spec.geometry}"`);
  const angle = spec.angle ?? geometry.idealAngle;
  const directions = geometry.directions(angle);

  const atoms = [{ element: spec.center, position: [0, 0, 0] }];
  const bonds = [];

  spec.ligands.forEach((ligand, index) => {
    const direction = directions[index];
    if (!direction) throw new Error(`${spec.name}: more ligands than ${spec.geometry} positions`);
    atoms.push({ element: ligand.element, position: scale(normalize(direction), ligand.bondLength) });
    bonds.push({ a: 0, b: atoms.length - 1, order: ligand.order || 1, length: ligand.bondLength });
  });

  const lonePairDirections = LONE_PAIR_DIRECTIONS[spec.geometry]?.(angle) || [];
  const lonePairs = lonePairDirections.slice(0, spec.lonePairs || 0).map((direction) => ({
    position: scale(normalize(direction), 0.75),
  }));

  return { atoms, bonds, lonePairs };
}

/**
 * Build a molecule with two bonded heavy atoms and hydrogens on each
 * (ethane, ethene, ethyne), from the measured C–C, C–H and H–C–C values.
 */
function buildTwoCentre(spec) {
  const half = spec.coreLength / 2;
  const atoms = [
    { element: spec.core[0], position: [0, 0, -half] },
    { element: spec.core[1], position: [0, 0, half] },
  ];
  const bonds = [{ a: 0, b: 1, order: spec.coreOrder, length: spec.coreLength }];

  // Each hydrogen sits on a cone about the C→C axis, opening at the measured
  // H–C–C angle. `axisSign` points from this carbon towards the other one.
  const polar = rad(spec.hAngle);
  const perGroup = spec.hydrogensPerCarbon;

  for (const [centreIndex, axisSign] of [[0, 1], [1, -1]]) {
    for (let i = 0; i < perGroup; i += 1) {
      const twist = spec.stagger && centreIndex === 1 ? 180 / perGroup : 0;
      const phi = rad((360 / perGroup) * i + twist);
      const direction = [
        Math.sin(polar) * Math.cos(phi),
        Math.sin(polar) * Math.sin(phi),
        Math.cos(polar) * axisSign,
      ];
      atoms.push({
        element: "H",
        position: add(atoms[centreIndex].position, scale(normalize(direction), spec.hLength)),
      });
      bonds.push({ a: centreIndex, b: atoms.length - 1, order: 1, length: spec.hLength });
    }
  }
  return { atoms, bonds, lonePairs: [] };
}

/** Build a planar ring such as benzene from its measured C–C and C–H lengths. */
function buildRing(spec) {
  const n = spec.ringSize;
  // Ring radius from the side length of a regular n-gon.
  const radius = spec.ringBond / (2 * Math.sin(Math.PI / n));
  const atoms = [];
  const bonds = [];

  for (let i = 0; i < n; i += 1) {
    const phi = (2 * Math.PI * i) / n;
    atoms.push({ element: spec.ringElement, position: [radius * Math.cos(phi), radius * Math.sin(phi), 0] });
  }
  for (let i = 0; i < n; i += 1) {
    bonds.push({ a: i, b: (i + 1) % n, order: spec.ringOrder || 1, length: spec.ringBond, aromatic: Boolean(spec.aromatic) });
  }
  if (spec.substituent) {
    for (let i = 0; i < n; i += 1) {
      const outward = normalize(atoms[i].position);
      atoms.push({
        element: spec.substituent.element,
        position: add(atoms[i].position, scale(outward, spec.substituent.bondLength)),
      });
      bonds.push({ a: i, b: atoms.length - 1, order: 1, length: spec.substituent.bondLength });
    }
  }
  return { atoms, bonds, lonePairs: [] };
}

const BUILDERS = { central: buildCentral, twoCentre: buildTwoCentre, ring: buildRing };

/**
 * Build a molecule from its spec and attach derived facts: every bond length,
 * every bond angle at the central atom, and the geometry family.
 */
export function buildMolecule(spec) {
  const builder = BUILDERS[spec.type];
  if (!builder) throw new Error(`Unknown molecule type "${spec.type}"`);
  const built = builder(spec);

  // Measure the angles back off the built coordinates — if the builder is wrong,
  // these will not match the quoted experimental values.
  const angles = [];
  const centreIndex = spec.type === "central" ? 0 : null;
  if (centreIndex !== null) {
    const ligandIndices = built.bonds.map((bond) => bond.b);
    for (let i = 0; i < ligandIndices.length; i += 1) {
      for (let j = i + 1; j < ligandIndices.length; j += 1) {
        angles.push({
          atoms: [ligandIndices[i], centreIndex, ligandIndices[j]],
          label: `${built.atoms[ligandIndices[i]].element}–${spec.center}–${built.atoms[ligandIndices[j]].element}`,
          value: angleBetween(
            built.atoms[ligandIndices[i]].position,
            built.atoms[centreIndex].position,
            built.atoms[ligandIndices[j]].position
          ),
        });
      }
    }
  }

  return {
    ...spec,
    ...built,
    angles,
    geometryLabel: spec.type === "central" ? GEOMETRIES[spec.geometry].label : spec.geometryLabel,
  };
}

/* ------------------------------------------------------------------ *
 * Molecule library — experimental structural data
 * ------------------------------------------------------------------ */

const H = (bondLength, count = 1, order = 1) =>
  Array.from({ length: count }, () => ({ element: "H", bondLength, order }));
const X = (element, bondLength, count = 1, order = 1) =>
  Array.from({ length: count }, () => ({ element, bondLength, order }));

export const MOLECULES = [
  {
    id: "water", name: "Water", formula: "H2O", type: "central",
    center: "O", geometry: "bent", angle: 104.45, lonePairs: 2,
    ligands: H(0.9584, 2),
    polar: true,
    note: "The two lone pairs push the O–H bonds below the tetrahedral 109.47°. That bent shape is why water is polar — and why ice floats.",
  },
  {
    id: "ammonia", name: "Ammonia", formula: "NH3", type: "central",
    center: "N", geometry: "trigonalPyramidal", angle: 106.7, lonePairs: 1,
    ligands: H(1.012, 3),
    polar: true,
    note: "One lone pair on nitrogen compresses the ideal 109.47° to 106.7° and makes ammonia a base — that pair is what accepts a proton.",
  },
  {
    id: "methane", name: "Methane", formula: "CH4", type: "central",
    center: "C", geometry: "tetrahedral", lonePairs: 0,
    ligands: H(1.087, 4),
    polar: false,
    note: "Four identical bonds, no lone pairs: the angle is exactly the tetrahedral 109.47°, and the symmetry makes the molecule non-polar.",
  },
  {
    id: "carbon-dioxide", name: "Carbon dioxide", formula: "CO2", type: "central",
    center: "C", geometry: "linear", lonePairs: 0,
    ligands: X("O", 1.16, 2, 2),
    polar: false,
    note: "Two double bonds, no lone pairs on carbon. The bond dipoles are equal and opposite, so a molecule of polar bonds is itself non-polar.",
  },
  {
    id: "sulfur-dioxide", name: "Sulfur dioxide", formula: "SO2", type: "central",
    center: "S", geometry: "bent", angle: 119.0, lonePairs: 1,
    ligands: X("O", 1.4308, 2, 2),
    polar: true,
    note: "One lone pair on sulfur bends the molecule to 119°, just under the trigonal-planar 120°.",
  },
  {
    id: "boron-trifluoride", name: "Boron trifluoride", formula: "BF3", type: "central",
    center: "B", geometry: "trigonalPlanar", lonePairs: 0,
    ligands: X("F", 1.307, 3),
    polar: false,
    note: "Boron has only six electrons here — an incomplete octet, which is why BF₃ is a strong Lewis acid.",
  },
  {
    id: "hydrogen-sulfide", name: "Hydrogen sulfide", formula: "H2S", type: "central",
    center: "S", geometry: "bent", angle: 92.1, lonePairs: 2,
    ligands: H(1.336, 2),
    polar: true,
    note: "At 92.1° the bonds are close to the pure p-orbital angle of 90° — sulfur hybridises far less than oxygen does in water.",
  },
  {
    id: "phosphorus-pentachloride", name: "Phosphorus pentachloride", formula: "PCl5", type: "central",
    center: "P", geometry: "trigonalBipyramidal", lonePairs: 0,
    ligands: [...X("Cl", 2.02, 3), ...X("Cl", 2.14, 2)],
    polar: false,
    note: "Two inequivalent sites: the three equatorial bonds (2.02 Å) are shorter than the two axial ones (2.14 Å), which feel more repulsion.",
  },
  {
    id: "sulfur-hexafluoride", name: "Sulfur hexafluoride", formula: "SF6", type: "central",
    center: "S", geometry: "octahedral", lonePairs: 0,
    ligands: X("F", 1.564, 6),
    polar: false,
    note: "A perfectly symmetric octahedron. The fluorines shield the sulfur so well that SF₆ is inert enough to be used as an insulating gas.",
  },
  {
    id: "xenon-tetrafluoride", name: "Xenon tetrafluoride", formula: "XeF4", type: "central",
    center: "Xe", geometry: "squarePlanar", lonePairs: 2,
    ligands: X("F", 1.953, 4),
    polar: false,
    note: "A noble gas that does bond. The two lone pairs take the axial positions, flattening the molecule into a square plane.",
  },
  {
    id: "chlorine-trifluoride", name: "Chlorine trifluoride", formula: "ClF3", type: "central",
    center: "Cl", geometry: "tShaped", lonePairs: 2,
    ligands: [...X("F", 1.598, 1), ...X("F", 1.698, 2)],
    polar: true,
    note: "Two lone pairs take equatorial positions, bending the axial fluorines back into a T. The axial bonds are longer than the equatorial one.",
  },
  {
    id: "ethane", name: "Ethane", formula: "C2H6", type: "twoCentre",
    core: ["C", "C"], coreLength: 1.535, coreOrder: 1,
    hLength: 1.094, hAngle: 111.2, hydrogensPerCarbon: 3, stagger: true,
    geometryLabel: "Two tetrahedral centres (staggered)",
    polar: false,
    note: "Shown in the staggered conformation — the lowest-energy arrangement, about 12 kJ·mol⁻¹ below eclipsed.",
  },
  {
    id: "ethene", name: "Ethene", formula: "C2H4", type: "twoCentre",
    core: ["C", "C"], coreLength: 1.339, coreOrder: 2,
    hLength: 1.087, hAngle: 121.3, hydrogensPerCarbon: 2, stagger: false,
    geometryLabel: "Planar, trigonal at each carbon",
    polar: false,
    note: "The π bond locks the molecule flat — the two ends cannot rotate past each other, which is why alkenes have cis/trans isomers.",
  },
  {
    id: "ethyne", name: "Ethyne", formula: "C2H2", type: "twoCentre",
    core: ["C", "C"], coreLength: 1.203, coreOrder: 3,
    hLength: 1.063, hAngle: 180, hydrogensPerCarbon: 1, stagger: false,
    geometryLabel: "Linear",
    polar: false,
    note: "A triple bond pulls the carbons to just 1.203 Å apart — the shortest common carbon–carbon bond — and the molecule is perfectly straight.",
  },
  {
    id: "benzene", name: "Benzene", formula: "C6H6", type: "ring",
    ringSize: 6, ringElement: "C", ringBond: 1.397, ringOrder: 1.5, aromatic: true,
    substituent: { element: "H", bondLength: 1.084 },
    geometryLabel: "Planar aromatic ring",
    polar: false,
    note: "Every C–C bond is 1.397 Å — between a single (1.54) and a double (1.34) bond. The six π electrons are delocalised around the whole ring.",
  },
];

export const MOLECULES_BY_ID = new Map(MOLECULES.map((m) => [m.id, m]));

/* ------------------------------------------------------------------ *
 * Crystal lattices
 * ------------------------------------------------------------------ */

/** Fractional coordinates of each basis site within the conventional cell. */
export const LATTICES = [
  {
    id: "nacl", name: "Sodium chloride", formula: "NaCl", system: "Face-centred cubic",
    a: 5.6402, coordination: "6 : 6",
    basis: [
      { element: "Na", sites: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]] },
      { element: "Cl", sites: [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5], [0.5, 0.5, 0.5]] },
    ],
    note: "Rock salt: two interpenetrating face-centred cubic lattices. Every ion is surrounded by six of the other kind, which is why salt cleaves into cubes.",
  },
  {
    id: "cscl", name: "Caesium chloride", formula: "CsCl", system: "Simple cubic",
    a: 4.123, coordination: "8 : 8",
    basis: [
      { element: "Cs", sites: [[0, 0, 0]] },
      { element: "Cl", sites: [[0.5, 0.5, 0.5]] },
    ],
    note: "The larger caesium ion allows eight chlorides around it instead of six — the same formula type as NaCl, a different packing.",
  },
  {
    id: "diamond", name: "Diamond", formula: "C", system: "Diamond cubic",
    a: 3.5670, coordination: "4",
    basis: [
      {
        element: "C",
        sites: [
          [0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5],
          [0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75],
        ],
      },
    ],
    note: "Every carbon is covalently bonded to four others at 109.47°. One continuous covalent network — hence the hardness and the very high melting point.",
  },
  {
    id: "copper", name: "Copper", formula: "Cu", system: "Face-centred cubic",
    a: 3.6149, coordination: "12",
    basis: [{ element: "Cu", sites: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]] }],
    note: "Cubic close packing: 74% of space filled, twelve neighbours per atom. The close-packed planes slide easily, which makes copper ductile.",
  },
  {
    id: "iron", name: "Iron (α-ferrite)", formula: "Fe", system: "Body-centred cubic",
    a: 2.8665, coordination: "8",
    basis: [{ element: "Fe", sites: [[0, 0, 0], [0.5, 0.5, 0.5]] }],
    note: "Body-centred cubic packs to 68% — looser than copper. Above 912 °C iron rearranges into a face-centred structure, which is the basis of steel heat treatment.",
  },
  {
    id: "zincblende", name: "Zinc blende", formula: "ZnS", system: "Face-centred cubic",
    a: 5.4093, coordination: "4 : 4",
    basis: [
      { element: "Zn", sites: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]] },
      { element: "S", sites: [[0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75]] },
    ],
    note: "The diamond structure with alternating atoms. This arrangement underlies most semiconductors — GaAs and InP share it.",
  },
];

export const LATTICES_BY_ID = new Map(LATTICES.map((l) => [l.id, l]));

/**
 * Expand a lattice into cartesian atom positions over `repeat`³ unit cells.
 * Sites on a cell face or corner are repeated on the far side so the block
 * looks like a real crystal fragment rather than a cut-off cell.
 */
export function expandLattice(lattice, repeat = 1) {
  const atoms = [];
  const seen = new Set();
  const key = (p) => p.map((v) => v.toFixed(4)).join(",");

  for (let i = 0; i < repeat; i += 1) {
    for (let j = 0; j < repeat; j += 1) {
      for (let k = 0; k < repeat; k += 1) {
        for (const { element, sites } of lattice.basis) {
          for (const site of sites) {
            // Mirror boundary sites onto the closing faces of the block.
            const offsets = [[0, 0, 0]];
            if (i === repeat - 1 && site[0] === 0) offsets.push([1, 0, 0]);
            if (j === repeat - 1 && site[1] === 0) offsets.push([0, 1, 0]);
            if (k === repeat - 1 && site[2] === 0) offsets.push([0, 0, 1]);
            if (offsets.length === 4) offsets.push([1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]);
            else if (offsets.length === 3) {
              const [, u, v] = offsets;
              offsets.push(add(u, v));
            }

            for (const offset of offsets) {
              const position = [
                (i + site[0] + offset[0]) * lattice.a,
                (j + site[1] + offset[1]) * lattice.a,
                (k + site[2] + offset[2]) * lattice.a,
              ];
              const id = element + key(position);
              if (seen.has(id)) continue;
              seen.add(id);
              atoms.push({ element, position });
            }
          }
        }
      }
    }
  }

  // Centre the block on the origin.
  const span = repeat * lattice.a;
  return atoms.map((atom) => ({ ...atom, position: sub(atom.position, [span / 2, span / 2, span / 2]) }));
}

/**
 * Bonds between lattice sites closer than `cutoff` ångströms — used to draw the
 * covalent framework in diamond and zinc blende.
 */
export function latticeBonds(atoms, cutoff) {
  const bonds = [];
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const distance = length(sub(atoms[i].position, atoms[j].position));
      if (distance <= cutoff) bonds.push({ a: i, b: j, length: distance });
    }
  }
  return bonds;
}
