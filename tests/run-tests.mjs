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

/* ------------------------------------------------------------------ Report */

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failures.length) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
