/**
 * Test suite for the calculation engines. No dependencies:
 *   node tests/run-tests.mjs
 * The engines are DOM-free by design, so they run directly under node.
 */

import assert from "node:assert/strict";

import { ELEMENTS, BY_SYMBOL, electronConfiguration, shellOccupancy, gridPosition, CATEGORIES } from "../assets/js/data/elements.js";
import { parseFormula, molarMass, composition, balanceEquation, atomTally, empiricalFormula, formatFormula } from "../assets/js/lib/chemistry-core.js";
import { solveSuvat, projectile, combineResistors, ohmsLaw, refract, thinLens, decay, heatTransfer } from "../assets/js/lib/physics-core.js";
import { transcribe, translate, sequenceStats, reverseComplement, punnettSquare, hardyWeinberg, parseGenotype, magnification, surfaceAreaToVolume } from "../assets/js/lib/biology-core.js";
import { CODON_TABLE, AMINO_ACIDS } from "../assets/js/data/reference.js";
import {
  MOLECULES, MOLECULES_BY_ID, buildMolecule, angleBetween, length as vlength, sub as vsub,
  LATTICES, LATTICES_BY_ID, expandLattice, latticeBonds, atomColor, GEOMETRIES,
} from "../assets/js/lib/molecule-core.js";
import {
  ORBITALS, ORBITALS_BY_ID, radialValue, mostProbableRadius, radialNodes,
  angularValue, angularSurface, densityCloud,
} from "../assets/js/lib/orbital-core.js";
import {
  airwayGeneration, airwayTable, bronchialTree, WEIBEL,
  cardiacState, haemodynamics, CARDIAC,
  simulateActionPotential, findThreshold, restingGates, HH,
  dnaHelix, B_DNA,
} from "../assets/js/lib/anatomy-core.js";

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`${name}\n    ${error.message.split("\n")[0]}`);
  }
}

/** Assert two numbers agree to `places` decimal places. */
const close = (actual, expected, places = 6, message = "") =>
  assert.ok(
    Math.abs(actual - expected) < 10 ** -places,
    `${message} expected ${expected}, got ${actual}`
  );

/* ----------------------------------------------------------- Element data */

test("dataset covers all 118 elements with unique symbols", () => {
  assert.equal(ELEMENTS.length, 118);
  assert.equal(new Set(ELEMENTS.map((e) => e.symbol)).size, 118);
  assert.deepEqual(
    ELEMENTS.map((e) => e.number),
    Array.from({ length: 118 }, (_, i) => i + 1)
  );
});

test("every element has a known category and colour", () => {
  for (const element of ELEMENTS) {
    assert.ok(CATEGORIES[element.category], `unknown category ${element.category}`);
    assert.match(element.color, /^#[0-9a-f]{6}$/i);
  }
});

test("electron configuration follows the aufbau order", () => {
  assert.equal(electronConfiguration(1), "1s1");
  assert.equal(electronConfiguration(11), "1s2 2s2 2p6 3s1");
  assert.equal(electronConfiguration(26), "1s2 2s2 2p6 3s2 3p6 4s2 3d6");
  assert.deepEqual(shellOccupancy(11), [2, 8, 1]);
  assert.deepEqual(shellOccupancy(18), [2, 8, 8]);
});

test("f-block elements are placed in the detached strips", () => {
  assert.deepEqual(gridPosition(BY_SYMBOL.get("La")), { row: 8, col: 4 });
  assert.deepEqual(gridPosition(BY_SYMBOL.get("Lu")), { row: 8, col: 18 });
  assert.deepEqual(gridPosition(BY_SYMBOL.get("Ac")), { row: 9, col: 4 });
  assert.deepEqual(gridPosition(BY_SYMBOL.get("Lr")), { row: 9, col: 18 });
  assert.deepEqual(gridPosition(BY_SYMBOL.get("H")), { row: 1, col: 1 });
  assert.deepEqual(gridPosition(BY_SYMBOL.get("He")), { row: 1, col: 18 });
});

/* -------------------------------------------------------------- Chemistry */

test("formula parser handles brackets, hydrates and charges", () => {
  assert.deepEqual([...parseFormula("H2O")], [["H", 2], ["O", 1]]);
  assert.deepEqual([...parseFormula("(NH4)2SO4")], [["N", 2], ["H", 8], ["S", 1], ["O", 4]]);
  assert.deepEqual([...parseFormula("CuSO4.5H2O")], [["Cu", 1], ["S", 1], ["O", 9], ["H", 10]]);
  assert.deepEqual([...parseFormula("CuSO4·5H2O")], [["Cu", 1], ["S", 1], ["O", 9], ["H", 10]]);
  assert.deepEqual([...parseFormula("[Cu(NH3)4]SO4")], [["Cu", 1], ["N", 4], ["H", 12], ["S", 1], ["O", 4]]);
  assert.deepEqual([...parseFormula("SO4^2-")], [["S", 1], ["O", 4]]);
});

test("formula parser rejects nonsense", () => {
  assert.throws(() => parseFormula("Xx2"), /Unknown element/);
  assert.throws(() => parseFormula("(H2O"), /bracket/);
  assert.throws(() => parseFormula(""), /Empty/);
});

test("molar masses match published values", () => {
  close(molarMass("H2O"), 18.015, 3);
  close(molarMass("NaCl"), 58.44, 2);
  close(molarMass("C6H12O6"), 180.156, 3);
  close(molarMass("(NH4)2SO4"), 132.134, 3);
  close(molarMass("CuSO4.5H2O"), 249.677, 3);
});

test("percentage composition sums to 100", () => {
  const parts = composition("C6H12O6");
  close(parts.reduce((sum, p) => sum + p.percent, 0), 100, 6);
  const carbon = parts.find((p) => p.symbol === "C");
  close(carbon.percent, 40.0, 1);
});

test("balancer solves standard equations", () => {
  const cases = [
    ["H2 + O2 -> H2O", [2, 1, 2]],
    ["C3H8 + O2 -> CO2 + H2O", [1, 5, 3, 4]],
    ["Fe2(SO4)3 + KOH -> K2SO4 + Fe(OH)3", [1, 6, 3, 2]],
    ["C6H12O6 + O2 = CO2 + H2O", [1, 6, 6, 6]],
    ["N2 + H2 -> NH3", [1, 3, 2]],
    ["KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2", [2, 16, 2, 2, 8, 5]],
    ["Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O", [3, 2, 1, 6]],
  ];
  for (const [equation, expected] of cases) {
    assert.deepEqual(balanceEquation(equation).coefficients, expected, equation);
  }
});

test("balanced equations conserve every element", () => {
  for (const equation of ["C2H6 + O2 -> CO2 + H2O", "Al + HCl -> AlCl3 + H2", "Cu + HNO3 -> Cu(NO3)2 + NO + H2O"]) {
    for (const { symbol, left, right } of atomTally(balanceEquation(equation))) {
      assert.equal(left, right, `${symbol} unbalanced in ${equation}`);
    }
  }
});

test("balancer reports impossible equations", () => {
  assert.throws(() => balanceEquation("H2 + O2 -> NaCl"), /cannot be balanced/);
  assert.throws(() => balanceEquation("H2 + O2"), /arrow/);
});

test("empirical formula reduces to the simplest ratio", () => {
  assert.equal(formatFormula(empiricalFormula([{ symbol: "C", amount: 40 }, { symbol: "H", amount: 6.7 }, { symbol: "O", amount: 53.3 }])), "CH2O");
  assert.equal(formatFormula(empiricalFormula([{ symbol: "Fe", amount: 69.9 }, { symbol: "O", amount: 30.1 }])), "Fe2O3");
});

/* ---------------------------------------------------------------- Physics */

test("SUVAT derives the missing quantities", () => {
  const dropped = solveSuvat({ u: 0, a: 9.81, t: 3 }).values;
  close(dropped.v, 29.43, 6);
  close(dropped.s, 44.145, 6);

  const braking = solveSuvat({ u: 5, v: 25, s: 60 }).values;
  close(braking.a, 5, 9);
  close(braking.t, 4, 9);

  const constantSpeed = solveSuvat({ u: 10, a: 0, s: 100 }).values;
  close(constantSpeed.t, 10, 9);
});

test("SUVAT refuses under-specified problems", () => {
  assert.throws(() => solveSuvat({ u: 1, v: 2 }), /any three/);
});

test("projectile range matches the analytic result", () => {
  const flat = projectile({ speed: 20, angleDeg: 45, height: 0, gravity: 9.81 });
  close(flat.range, 20 ** 2 / 9.81, 6, "45° range is u²/g:");
  close(flat.apex, 20 ** 2 / (4 * 9.81), 6);
  close(flat.trajectory.at(-1).y, 0, 6, "lands at ground level:");

  const raised = projectile({ speed: 15, angleDeg: 30, height: 10, gravity: 9.81 });
  assert.ok(raised.range > 0 && raised.flightTime > 0);
  close(raised.trajectory.at(-1).y, 0, 6);
});

test("complementary launch angles give equal range", () => {
  const a = projectile({ speed: 30, angleDeg: 30, height: 0 });
  const b = projectile({ speed: 30, angleDeg: 60, height: 0 });
  close(a.range, b.range, 6);
});

test("resistor networks and Ohm's law", () => {
  close(combineResistors([100, 220, 330], "series"), 650, 9);
  close(combineResistors([4, 6], "parallel"), 2.4, 9);
  close(combineResistors([10, 10], "parallel"), 5, 9);
  const solved = ohmsLaw({ voltage: 12, resistance: 4 });
  close(solved.current, 3, 9);
  close(solved.power, 36, 9);
  assert.throws(() => ohmsLaw({ voltage: 12 }), /any two/);
});

test("Snell's law and total internal reflection", () => {
  const intoGlass = refract({ n1: 1, n2: 1.5, angleDeg: 30 });
  close(intoGlass.refractedDeg, 19.4712, 3);
  assert.equal(intoGlass.totalInternalReflection, false);

  const outOfGlass = refract({ n1: 1.5, n2: 1, angleDeg: 60 });
  assert.equal(outOfGlass.totalInternalReflection, true);
  close(outOfGlass.criticalAngle, 41.8103, 3);
});

test("thin lens imaging", () => {
  const real = thinLens({ focalLength: 10, objectDistance: 15, objectHeight: 2 });
  close(real.imageDistance, 30, 6);
  close(real.magnification, -2, 6);
  assert.equal(real.real, true);
  assert.match(real.nature, /Real, inverted, enlarged/);

  const magnifier = thinLens({ focalLength: 10, objectDistance: 5, objectHeight: 1 });
  assert.equal(magnifier.real, false);
  close(magnifier.imageDistance, -10, 6);

  assert.throws(() => thinLens({ focalLength: 0, objectDistance: 5 }), /focal length/);
});

test("radioactive decay halves each half-life", () => {
  const after2 = decay({ initial: 1000, halfLife: 5, time: 10 });
  close(after2.remaining, 250, 6);
  close(after2.halfLivesElapsed, 2, 9);
  close(decay({ initial: 1, halfLife: 1, time: 0 }).remaining, 1, 9);
});

test("heat transfer solves for the blank quantity", () => {
  close(heatTransfer({ mass: 0.5, specificHeat: 4180, deltaT: 60 }).energy, 125400, 6);
  close(heatTransfer({ mass: 0.5, specificHeat: 4180, energy: 125400 }).deltaT, 60, 6);
  close(heatTransfer({ specificHeat: 4180, deltaT: 60, energy: 125400 }).mass, 0.5, 6);
});

/* ---------------------------------------------------------------- Biology */

test("transcription produces the right strands", () => {
  const result = transcribe("ATGCGT");
  assert.equal(result.mRNA, "AUGCGU");
  assert.equal(result.templateStrand, "ACGCAT");
  assert.equal(reverseComplement("ATGC"), "GCAT");

  const fromTemplate = transcribe("ACGCAT", "template");
  assert.equal(fromTemplate.mRNA, "AUGCGU");
});

test("transcription rejects non-DNA input", () => {
  assert.throws(() => transcribe("ATGXYZ"), /unexpected base/i);
});

test("translation starts at AUG and stops at a stop codon", () => {
  const protein = translate("AUGGCCAUUGUAAUGGGCCGCUGAAAGGGUGCCCGAUAG");
  assert.equal(protein.oneLetter, "MAIVMGR");
  assert.equal(protein.threeLetter, "Met-Ala-Ile-Val-Met-Gly-Arg");
  assert.equal(protein.stopped, true);

  // A leading untranslated region is skipped.
  assert.equal(translate("CCCAUGUUUUAA").oneLetter, "MF");
  // T is accepted and read as U.
  assert.equal(translate("ATGTTTTAA").oneLetter, "MF");
  assert.throws(() => translate("CCCGGG"), /start codon/);
});

test("the codon table is complete and consistent", () => {
  assert.equal(Object.keys(CODON_TABLE).length, 64);
  for (const residue of Object.values(CODON_TABLE)) assert.ok(AMINO_ACIDS[residue], `missing amino acid ${residue}`);
  assert.equal(new Set(Object.values(CODON_TABLE)).size, 21); // 20 amino acids + Stop
  assert.equal(CODON_TABLE.AUG, "Met");
  assert.deepEqual(
    Object.entries(CODON_TABLE).filter(([, r]) => r === "Stop").map(([c]) => c).sort(),
    ["UAA", "UAG", "UGA"]
  );
});

test("sequence statistics", () => {
  const stats = sequenceStats("GGCCATAT");
  assert.equal(stats.length, 8);
  close(stats.gcContent, 50, 9);
  assert.equal(stats.codons, 2);
  assert.equal(sequenceStats("ATAT").gcContent, 0);
});

test("genotype parsing normalises and validates", () => {
  assert.deepEqual(parseGenotype("aA"), [["A", "a"]]);
  assert.deepEqual(parseGenotype("AaBb"), [["A", "a"], ["B", "b"]]);
  assert.throws(() => parseGenotype("Aab"), /pairs of alleles/);
  assert.throws(() => parseGenotype("Ab"), /different genes/);
  assert.throws(() => parseGenotype("AaAa"), /only once/);
});

test("monohybrid cross gives the 3:1 ratio", () => {
  const cross = punnettSquare("Aa", "Aa");
  assert.equal(cross.grid.length, 2);
  assert.deepEqual(cross.phenotypes.map((p) => p.ratio), [3, 1]);
  const heterozygous = cross.genotypes.find((g) => g.label === "Aa");
  close(heterozygous.probability, 0.5, 9);
  close(cross.genotypes.reduce((sum, g) => sum + g.probability, 0), 1, 9);
});

test("test cross gives the 1:1 ratio", () => {
  const cross = punnettSquare("Aa", "aa");
  assert.deepEqual(cross.phenotypes.map((p) => p.ratio), [1, 1]);
});

test("dihybrid cross gives the 9:3:3:1 ratio", () => {
  const cross = punnettSquare("AaBb", "AaBb");
  assert.equal(cross.grid.length, 4);
  assert.equal(cross.grid[0].length, 4);
  assert.deepEqual(cross.phenotypes.map((p) => p.ratio), [9, 3, 3, 1]);
  close(cross.phenotypes.reduce((sum, p) => sum + p.probability, 0), 1, 9);
});

test("mismatched parent genotypes are rejected", () => {
  assert.throws(() => punnettSquare("AaBb", "Aa"), /same genes/);
  assert.throws(() => punnettSquare("AaBb", "BbAa"), /same order/);
});

test("Hardy–Weinberg frequencies sum to one", () => {
  const population = hardyWeinberg({ recessivePhenotype: 0.09 });
  close(population.q, 0.3, 9);
  close(population.p, 0.7, 9);
  close(population.heterozygous, 0.42, 9);
  close(population.homozygousDominant + population.heterozygous + population.homozygousRecessive, 1, 9);
  assert.throws(() => hardyWeinberg({ recessivePhenotype: 1.4 }), /between 0 and 1/);
});

test("magnification triangle", () => {
  close(magnification({ imageSize: 45000, factor: 1500 }).actualSize, 30, 6);
  close(magnification({ imageSize: 45000, actualSize: 30 }).factor, 1500, 6);
  assert.throws(() => magnification({ imageSize: 10 }), /any two/);
});

test("surface area to volume falls as size rises", () => {
  const small = surfaceAreaToVolume("cube", 1);
  const large = surfaceAreaToVolume("cube", 2);
  close(small.ratio, 6, 9);
  close(large.ratio, 3, 9);
  close(surfaceAreaToVolume("sphere", 1).ratio, 3, 9);
});

/* --------------------------------------------------- Molecular geometry -- */

test("every molecule builds with the right atom and bond count", () => {
  for (const spec of MOLECULES) {
    const molecule = buildMolecule(spec);
    assert.ok(molecule.atoms.length >= 2, `${spec.formula} has too few atoms`);
    assert.ok(molecule.bonds.length >= 1, `${spec.formula} has no bonds`);
    for (const bond of molecule.bonds) {
      assert.ok(molecule.atoms[bond.a] && molecule.atoms[bond.b], `${spec.formula} has a dangling bond`);
    }
    for (const atom of molecule.atoms) {
      assert.ok(atom.position.every(Number.isFinite), `${spec.formula} produced a non-finite coordinate`);
      assert.match(atomColor(atom.element), /^#[0-9a-f]{6}$/i);
    }
  }
});

test("built geometry reproduces the measured bond angles", () => {
  // The angles are read back off the generated coordinates, so this fails if
  // the builder places atoms anywhere other than where the data says.
  const expected = {
    water: 104.45, ammonia: 106.7, methane: 109.47, "carbon-dioxide": 180,
    "sulfur-dioxide": 119.0, "boron-trifluoride": 120, "hydrogen-sulfide": 92.1,
  };
  for (const [id, angle] of Object.entries(expected)) {
    const molecule = buildMolecule(MOLECULES_BY_ID.get(id));
    close(molecule.angles[0].value, angle, 2, `${id} bond angle:`);
  }
});

test("bond lengths in the model equal the quoted values", () => {
  for (const spec of MOLECULES) {
    const molecule = buildMolecule(spec);
    for (const bond of molecule.bonds) {
      const measured = vlength(vsub(molecule.atoms[bond.a].position, molecule.atoms[bond.b].position));
      close(measured, bond.length, 6, `${spec.formula} ${bond.a}–${bond.b}:`);
    }
  }
});

test("octahedral and square planar geometries are exact", () => {
  const sf6 = buildMolecule(MOLECULES_BY_ID.get("sulfur-hexafluoride"));
  const angles = sf6.angles.map((a) => Math.round(a.value));
  assert.equal(angles.filter((a) => a === 90).length, 12);
  assert.equal(angles.filter((a) => a === 180).length, 3);

  const xef4 = buildMolecule(MOLECULES_BY_ID.get("xenon-tetrafluoride"));
  assert.ok(xef4.atoms.every((atom) => Math.abs(atom.position[2]) < 1e-9), "XeF4 should be planar");
});

test("hydrocarbon builders honour their H–C–C angles", () => {
  for (const [id, expected] of [["ethane", 111.2], ["ethene", 121.3], ["ethyne", 180]]) {
    const m = buildMolecule(MOLECULES_BY_ID.get(id));
    const p = m.atoms.map((a) => a.position);
    close(angleBetween(p[2], p[0], p[1]), expected, 6, `${id} H–C–C:`);
  }
  // Ethene must come out planar; ethane's hydrogens must be staggered.
  const ethene = buildMolecule(MOLECULES_BY_ID.get("ethene"));
  assert.ok(ethene.atoms.every((a) => Math.abs(a.position[1]) < 1e-9), "ethene should be planar");
});

test("benzene is a regular planar ring", () => {
  const benzene = buildMolecule(MOLECULES_BY_ID.get("benzene"));
  assert.equal(benzene.atoms.length, 12);
  assert.ok(benzene.atoms.every((a) => a.position[2] === 0), "benzene should be planar");
  const carbons = benzene.atoms.slice(0, 6).map((a) => a.position);
  for (let i = 0; i < 6; i += 1) {
    close(vlength(vsub(carbons[i], carbons[(i + 1) % 6])), 1.397, 6, "benzene C–C:");
    close(angleBetween(carbons[(i + 5) % 6], carbons[i], carbons[(i + 1) % 6]), 120, 6, "benzene C–C–C:");
  }
});

test("VSEPR direction sets are unit vectors", () => {
  for (const [name, geometry] of Object.entries(GEOMETRIES)) {
    for (const direction of geometry.directions(geometry.idealAngle)) {
      close(Math.hypot(...direction), 1, 9, `${name} direction:`);
    }
  }
});

/* --------------------------------------------------------- Crystal cells -- */

test("lattices reproduce their published nearest-neighbour distances", () => {
  const expected = {
    nacl: 2.8201,      // a/2
    cscl: 3.5706,      // a√3/2
    diamond: 1.5446,   // a√3/4
    copper: 2.5561,    // a/√2
    iron: 2.4825,      // a√3/2
    zincblende: 2.3423,
  };
  for (const [id, distance] of Object.entries(expected)) {
    const atoms = expandLattice(LATTICES_BY_ID.get(id), 1);
    let nearest = Infinity;
    for (let i = 0; i < atoms.length; i += 1) {
      for (let j = i + 1; j < atoms.length; j += 1) {
        nearest = Math.min(nearest, vlength(vsub(atoms[i].position, atoms[j].position)));
      }
    }
    close(nearest, distance, 3, `${id} nearest neighbour:`);
  }
});

test("lattice expansion grows and stays centred", () => {
  for (const lattice of LATTICES) {
    const one = expandLattice(lattice, 1);
    const two = expandLattice(lattice, 2);
    assert.ok(two.length > one.length, `${lattice.id} did not grow`);
    for (const atom of two) {
      assert.ok(atom.position.every(Number.isFinite), `${lattice.id} produced a bad coordinate`);
      assert.ok(Math.max(...atom.position.map(Math.abs)) <= lattice.a * 2, `${lattice.id} atom outside the block`);
    }
  }
});

test("diamond has four bonds per interior atom", () => {
  const atoms = expandLattice(LATTICES_BY_ID.get("diamond"), 2);
  const bonds = latticeBonds(atoms, 1.6);
  const degree = new Map();
  for (const bond of bonds) {
    degree.set(bond.a, (degree.get(bond.a) || 0) + 1);
    degree.set(bond.b, (degree.get(bond.b) || 0) + 1);
  }
  // Interior atoms reach the full coordination of four; surface atoms cannot.
  assert.equal(Math.max(...degree.values()), 4);
});

/* ------------------------------------------------------------- Orbitals -- */

test("radial functions are normalised", () => {
  for (const orbital of ORBITALS) {
    let integral = 0;
    const dr = 0.002;
    for (let r = dr; r < 120; r += dr) integral += radialValue(orbital, r) ** 2 * r * r * dr;
    close(integral, 1, 3, `${orbital.id} radial normalisation:`);
  }
});

test("orbital node counts follow the quantum numbers", () => {
  for (const orbital of ORBITALS) {
    assert.equal(
      radialNodes(orbital).length,
      orbital.n - orbital.l - 1,
      `${orbital.id} should have n − l − 1 radial nodes`
    );
  }
  assert.deepEqual(radialNodes(ORBITALS_BY_ID.get("2s")), [2]); // exactly 2a₀
});

test("most probable radius matches the analytic results", () => {
  close(mostProbableRadius(ORBITALS_BY_ID.get("1s")), 1, 2, "1s peaks at the Bohr radius:");
  close(mostProbableRadius(ORBITALS_BY_ID.get("2pz")), 4, 2, "2p peaks at 4a₀:");
  close(mostProbableRadius(ORBITALS_BY_ID.get("3dz2")), 9, 2, "3d peaks at 9a₀:");
});

test("angular functions have the right nodal structure", () => {
  const pz = ORBITALS_BY_ID.get("2pz");
  // p_z vanishes in the xy-plane and is antisymmetric about it.
  close(angularValue(pz, Math.PI / 2, 0), 0, 9);
  close(angularValue(pz, 0, 0), -angularValue(pz, Math.PI, 0), 9);
  // d_xy vanishes on both nodal planes.
  const dxy = ORBITALS_BY_ID.get("3dxy");
  close(angularValue(dxy, Math.PI / 2, 0), 0, 9);
  close(angularValue(dxy, Math.PI / 2, Math.PI / 2), 0, 9);
});

test("renderable geometry comes out well formed", () => {
  const surface = angularSurface(ORBITALS_BY_ID.get("2pz"), { segments: 24 });
  assert.ok(surface.positions.length > 0 && surface.positions.every(Number.isFinite));
  assert.equal(surface.positions.length / 3, surface.phases.length);
  assert.equal(surface.indices.length % 3, 0);
  assert.ok(Math.max(...surface.indices) < surface.positions.length / 3, "index out of range");

  const cloud = densityCloud(ORBITALS_BY_ID.get("2pz"), { count: 500 });
  assert.equal(cloud.points.length / 3, cloud.phases.length);
  assert.ok(cloud.points.every(Number.isFinite));
  // A p orbital's two lobes carry opposite phase, so both signs must appear.
  assert.ok(cloud.phases.some((p) => p > 0) && cloud.phases.some((p) => p < 0));
});

test("density sampling is deterministic", () => {
  const a = densityCloud(ORBITALS_BY_ID.get("1s"), { count: 200, seed: 3 });
  const b = densityCloud(ORBITALS_BY_ID.get("1s"), { count: 200, seed: 3 });
  assert.deepEqual(a.points, b.points);
});

/* ------------------------------------------------------------- Physiology - */

test("airway dimensions follow the 2^(-1/3) scaling", () => {
  const trachea = airwayGeneration(0);
  close(trachea.diameter, WEIBEL.trachealDiameter, 9);
  close(trachea.count, 1, 9);
  for (let n = 1; n <= 20; n += 1) {
    const parent = airwayGeneration(n - 1);
    const child = airwayGeneration(n);
    close(child.diameter / parent.diameter, Math.cbrt(0.5), 9, `generation ${n} diameter ratio:`);
    assert.equal(child.count, parent.count * 2, `generation ${n} count`);
  }
  // Published values: terminal bronchioles are about half a millimetre across.
  close(airwayGeneration(16).diameter, 0.0446, 3);
});

test("total airway cross-section grows with depth", () => {
  const rows = airwayTable(23);
  for (let n = 1; n < rows.length; n += 1) {
    assert.ok(
      rows[n].totalCrossSection > rows[n - 1].totalCrossSection,
      `cross-section should rise at generation ${n}`
    );
  }
  // Each generation multiplies the area by 2^(1/3).
  close(rows[1].totalCrossSection / rows[0].totalCrossSection, Math.cbrt(2), 6);
  assert.ok(rows.at(-1).totalCrossSection > 400, "alveolar cross-section should exceed 400 cm²");
});

test("the bronchial tree is a complete binary tree", () => {
  for (const depth of [3, 6, 8]) {
    const tree = bronchialTree({ depth });
    assert.equal(tree.segments.length, 2 ** (depth + 1) - 1, `depth ${depth} segment count`);
    for (const segment of tree.segments) {
      assert.ok(segment.from.every(Number.isFinite) && segment.to.every(Number.isFinite));
      // Each segment's drawn length must equal its Weibel length.
      const drawn = Math.hypot(...segment.to.map((v, i) => v - segment.from[i]));
      close(drawn, airwayGeneration(segment.generation).length, 6, `generation ${segment.generation} length:`);
    }
  }
});

test("cardiac valves follow the pressure gradients", () => {
  for (let i = 0; i <= 200; i += 1) {
    const state = cardiacState(i / 200);
    assert.equal(state.mitralOpen, state.atrialPressure > state.ventricularPressure, `mitral at ${i / 200}`);
    assert.equal(state.aorticOpen, state.ventricularPressure > state.aorticPressure, `aortic at ${i / 200}`);
    // Both valves shut during the isovolumetric phases.
    if (state.label.startsWith("Isovolumetric")) {
      assert.ok(!state.mitralOpen && !state.aorticOpen, `both valves should be shut during ${state.label}`);
    }
  }
});

test("ventricular volume stays within its physiological range", () => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i <= 400; i += 1) {
    const { ventricularVolume: v } = cardiacState(i / 400);
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  close(min, CARDIAC.endSystolicVolume, 6);
  close(max, CARDIAC.endDiastolicVolume, 6);
});

test("haemodynamics match the textbook figures", () => {
  const stats = haemodynamics(75);
  close(stats.strokeVolume, 70, 9);
  close(stats.cardiacOutput, 5.25, 6);
  close(stats.ejectionFraction, 58.333, 2);
  close(stats.cycleDuration, 0.8, 9);
  // Output scales with rate.
  close(haemodynamics(150).cardiacOutput, 10.5, 6);
});

test("the cardiac cycle wraps cleanly", () => {
  const start = cardiacState(0);
  const wrapped = cardiacState(1);
  close(wrapped.ventricularPressure, start.ventricularPressure, 6);
  close(cardiacState(-0.25).phase, 0.75, 9);
});

test("Hodgkin-Huxley gates rest between zero and one", () => {
  const gates = restingGates();
  for (const [name, value] of Object.entries(gates)) {
    assert.ok(value > 0 && value < 1, `${name} should rest in (0, 1), got ${value}`);
  }
  // At rest sodium is mostly shut and its inactivation gate mostly open.
  assert.ok(gates.m < 0.1, "m gate should rest nearly closed");
  assert.ok(gates.h > 0.5, "h gate should rest mostly open");
});

test("the action potential is all-or-nothing", () => {
  const threshold = findThreshold();
  assert.ok(threshold > 0 && threshold < 40, `threshold out of range: ${threshold}`);

  const below = simulateActionPotential({ stimulus: threshold * 0.9 });
  const above = simulateActionPotential({ stimulus: threshold * 1.1 });
  assert.equal(below.fired, false, "a subthreshold stimulus must not fire");
  assert.equal(above.fired, true, "a suprathreshold stimulus must fire");

  // A much larger stimulus gives essentially the same spike height, which is
  // what "all-or-nothing" means.
  const strong = simulateActionPotential({ stimulus: threshold * 3 });
  assert.ok(Math.abs(strong.peak - above.peak) < 12, "spike amplitude should not scale with stimulus");
  assert.ok(above.peak > 0, "a spike must overshoot 0 mV");
});

test("the membrane rests at the resting potential", () => {
  const quiet = simulateActionPotential({ stimulus: 0, duration: 20 });
  for (const sample of quiet.trace) {
    close(sample.v, HH.restingPotential, 1, "unstimulated membrane:");
  }
});

test("the action potential repolarises below rest", () => {
  const spike = simulateActionPotential({ stimulus: 15, duration: 40 });
  const afterSpike = spike.trace.filter((s) => s.t > 10);
  const trough = Math.min(...afterSpike.map((s) => s.v));
  assert.ok(trough < HH.restingPotential, "there should be an after-hyperpolarisation");
});

test("B-DNA is built to crystallographic dimensions", () => {
  const helix = dnaHelix("ATGCATGCATGCATGCATGCA");
  assert.equal(helix.pairs.length, 21);
  close(helix.length, 21 * B_DNA.rise, 6);

  for (let i = 1; i < helix.strandA.length; i += 1) {
    close(helix.strandA[i].position[1] - helix.strandA[i - 1].position[1], B_DNA.rise, 6, "rise per base pair:");
  }
  // Both backbones sit on a cylinder of the published radius.
  for (const point of [...helix.strandA, ...helix.strandB]) {
    close(Math.hypot(point.position[0], point.position[2]), B_DNA.radius, 6, "backbone radius:");
  }
  close(360 / B_DNA.twist, 10.5, 1, "base pairs per turn:");
});

test("DNA pairing and bond counts are correct", () => {
  const helix = dnaHelix("AATTGGCC");
  const pairing = { A: "T", T: "A", G: "C", C: "G" };
  for (const pair of helix.pairs) {
    assert.equal(pair.partner, pairing[pair.base], `${pair.base} should pair with ${pairing[pair.base]}`);
    assert.equal(pair.hydrogenBonds, pair.base === "G" || pair.base === "C" ? 3 : 2);
  }
  close(helix.gcContent, 50, 9);
  assert.throws(() => dnaHelix("XYZ"), /sequence/);
});

/* ------------------------------------------------------------------ Report */

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failures.length) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
