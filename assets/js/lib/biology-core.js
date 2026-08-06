/**
 * Biology engine: nucleic acid handling, the central dogma, Mendelian
 * inheritance and population genetics. Pure functions, no DOM.
 */

import { CODON_TABLE, AMINO_ACIDS } from "../data/reference.js";

const DNA_COMPLEMENT = { A: "T", T: "A", G: "C", C: "G" };

/** Strip whitespace, digits and FASTA headers, then uppercase. */
export function cleanSequence(input) {
  return String(input)
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("")
    .replace(/[\s\d]/g, "")
    .toUpperCase();
}

export function validateDna(sequence) {
  const invalid = [...new Set(sequence.split("").filter((base) => !(base in DNA_COMPLEMENT)))];
  if (invalid.length) throw new Error(`Not a DNA sequence — unexpected base(s): ${invalid.join(", ")}`);
  return sequence;
}

/** Base-pairing partner strand, written 3'→5' relative to the input. */
export function complement(sequence) {
  return sequence.split("").map((base) => DNA_COMPLEMENT[base]).join("");
}

export function reverseComplement(sequence) {
  return complement(sequence).split("").reverse().join("");
}

/**
 * Transcription. The template (antisense) strand is read by RNA polymerase, so
 * the mRNA matches the coding strand with U in place of T.
 */
export function transcribe(sequence, strand = "coding") {
  const dna = validateDna(sequence);
  const codingStrand = strand === "template" ? reverseComplement(dna) : dna;
  return {
    codingStrand,
    templateStrand: reverseComplement(codingStrand),
    mRNA: codingStrand.replace(/T/g, "U"),
  };
}

/**
 * Translate mRNA into a peptide. By default translation starts at the first
 * AUG and stops at the first in-frame stop codon.
 */
export function translate(mRNA, { requireStart = true } = {}) {
  const rna = cleanSequence(mRNA).replace(/T/g, "U");
  const invalid = [...new Set(rna.split("").filter((b) => !"AUGC".includes(b)))];
  if (invalid.length) throw new Error(`Not an RNA sequence — unexpected base(s): ${invalid.join(", ")}`);

  let start = 0;
  if (requireStart) {
    start = rna.indexOf("AUG");
    if (start === -1) throw new Error("No AUG start codon found in this sequence");
  }

  const codons = [];
  let stopped = false;
  for (let i = start; i + 3 <= rna.length; i += 3) {
    const codon = rna.slice(i, i + 3);
    const residue = CODON_TABLE[codon];
    codons.push({ codon, residue, position: i });
    if (residue === "Stop") {
      stopped = true;
      break;
    }
  }
  if (!codons.length) throw new Error("Sequence is too short to contain a codon");

  const peptide = codons.filter((c) => c.residue !== "Stop");
  return {
    start,
    codons,
    stopped,
    peptide,
    threeLetter: peptide.map((c) => c.residue).join("-"),
    oneLetter: peptide.map((c) => AMINO_ACIDS[c.residue].letter).join(""),
    trailingBases: (rna.length - start) % 3,
  };
}

/** Base counts, GC content and estimated melting temperature. */
export function sequenceStats(sequence) {
  const seq = cleanSequence(sequence);
  const counts = { A: 0, T: 0, G: 0, C: 0, U: 0 };
  for (const base of seq) if (base in counts) counts[base] += 1;
  const length = seq.length;
  const gc = counts.G + counts.C;
  const gcContent = length ? (gc / length) * 100 : 0;
  // Wallace rule below 14 nt, salt-adjusted approximation above it.
  const meltingTemp =
    length === 0
      ? null
      : length < 14
        ? 2 * (counts.A + counts.T + counts.U) + 4 * gc
        : 64.9 + 41 * ((gc - 16.4) / length);
  return { length, counts, gcContent, meltingTemp, codons: Math.floor(length / 3) };
}

/* ------------------------------------------------------------------ *
 * Mendelian genetics
 * ------------------------------------------------------------------ */

/** Split a genotype like "AaBb" into per-gene allele pairs. */
export function parseGenotype(genotype) {
  const clean = String(genotype).replace(/\s+/g, "");
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error(`"${genotype}" must be pairs of alleles, e.g. Aa or AaBb`);
  }
  const genes = [];
  for (let i = 0; i < clean.length; i += 2) {
    const pair = [clean[i], clean[i + 1]];
    if (!/^[A-Za-z]$/.test(pair[0]) || !/^[A-Za-z]$/.test(pair[1])) {
      throw new Error(`"${genotype}" must use letters only`);
    }
    if (pair[0].toLowerCase() !== pair[1].toLowerCase()) {
      throw new Error(`Alleles "${pair.join("")}" belong to different genes — pair them as e.g. Aa`);
    }
    genes.push(sortPair(pair));
  }
  const letters = genes.map((g) => g[0].toLowerCase());
  if (new Set(letters).size !== letters.length) throw new Error("Each gene may appear only once per genotype");
  return genes;
}

/** Dominant allele (uppercase) first, so genotypes are written consistently. */
function sortPair(pair) {
  return [...pair].sort((a, b) => {
    const upper = (ch) => (ch === ch.toUpperCase() ? 0 : 1);
    return upper(a) - upper(b) || a.localeCompare(b);
  });
}

/** All gametes a genotype can produce, with their probabilities. */
export function gametes(genes) {
  let combos = [{ alleles: [], probability: 1 }];
  for (const pair of genes) {
    const next = [];
    for (const combo of combos) {
      for (const allele of pair) {
        next.push({ alleles: [...combo.alleles, allele], probability: combo.probability / 2 });
      }
    }
    combos = next;
  }
  // Merge identical gametes (a homozygote produces one kind, not two).
  const merged = new Map();
  for (const combo of combos) {
    const key = combo.alleles.join("");
    merged.set(key, (merged.get(key) || 0) + combo.probability);
  }
  return [...merged.entries()].map(([label, probability]) => ({ label, probability }));
}

/** Phenotype label: uppercase allele present = dominant trait expressed. */
export function phenotypeOf(genotype) {
  const genes = parseGenotype(genotype);
  return genes
    .map((pair) => {
      const letter = pair[0].toLowerCase();
      const dominant = pair.some((allele) => allele === allele.toUpperCase());
      return dominant ? `${letter.toUpperCase()}_ (dominant)` : `${letter}${letter} (recessive)`;
    })
    .join(", ");
}

/**
 * Punnett square for any number of genes.
 * @returns grid, genotype ratios and phenotype ratios
 */
export function punnettSquare(parent1, parent2) {
  const genes1 = parseGenotype(parent1);
  const genes2 = parseGenotype(parent2);
  if (genes1.length !== genes2.length) throw new Error("Both parents must be written for the same genes");
  for (let i = 0; i < genes1.length; i += 1) {
    if (genes1[i][0].toLowerCase() !== genes2[i][0].toLowerCase()) {
      throw new Error("Parent genotypes must list their genes in the same order");
    }
  }

  const rows = gametes(genes1);
  const cols = gametes(genes2);
  const genotypeCounts = new Map();
  const phenotypeCounts = new Map();

  const grid = rows.map((row) =>
    cols.map((col) => {
      const offspring = combineGametes(row.label, col.label);
      const probability = row.probability * col.probability;
      genotypeCounts.set(offspring, (genotypeCounts.get(offspring) || 0) + probability);
      const phenotype = phenotypeOf(offspring);
      phenotypeCounts.set(phenotype, (phenotypeCounts.get(phenotype) || 0) + probability);
      return { genotype: offspring, probability };
    })
  );

  return {
    rows,
    cols,
    grid,
    genotypes: toRatioList(genotypeCounts),
    phenotypes: toRatioList(phenotypeCounts),
  };
}

function combineGametes(a, b) {
  let result = "";
  for (let i = 0; i < a.length; i += 1) result += sortPair([a[i], b[i]]).join("");
  return result;
}

function toRatioList(counts) {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const smallest = Math.min(...entries.map(([, p]) => p));
  return entries.map(([label, probability]) => ({
    label,
    probability,
    percent: probability * 100,
    ratio: Math.round(probability / smallest),
  }));
}

/**
 * Hardy–Weinberg equilibrium from the recessive phenotype frequency (q²)
 * or directly from an allele frequency.
 */
export function hardyWeinberg({ recessivePhenotype, p: givenP }) {
  let q;
  if (Number.isFinite(givenP)) {
    if (givenP < 0 || givenP > 1) throw new Error("Allele frequency p must lie between 0 and 1");
    q = 1 - givenP;
  } else {
    if (!Number.isFinite(recessivePhenotype) || recessivePhenotype < 0 || recessivePhenotype > 1) {
      throw new Error("Enter the recessive phenotype frequency q² between 0 and 1");
    }
    q = Math.sqrt(recessivePhenotype);
  }
  const p = 1 - q;
  return {
    p,
    q,
    homozygousDominant: p * p,
    heterozygous: 2 * p * q,
    homozygousRecessive: q * q,
    carrierRatio: 2 * p * q > 0 ? 1 / (2 * p * q) : Infinity,
  };
}

/** Microscope magnification triangle: any two of the three quantities. */
export function magnification({ imageSize, actualSize, factor }) {
  const known = [imageSize, actualSize, factor].filter(Number.isFinite).length;
  if (known < 2) throw new Error("Enter any two of image size, actual size and magnification");
  if (!Number.isFinite(factor)) return { imageSize, actualSize, factor: imageSize / actualSize };
  if (!Number.isFinite(actualSize)) return { imageSize, actualSize: imageSize / factor, factor };
  return { imageSize: actualSize * factor, actualSize, factor };
}

/** Surface-area-to-volume ratio for common body shapes. */
export function surfaceAreaToVolume(shape, size) {
  if (!(size > 0)) throw new Error("Size must be positive");
  if (shape === "cube") {
    const area = 6 * size ** 2;
    const volume = size ** 3;
    return { area, volume, ratio: area / volume, label: `Cube of side ${size}` };
  }
  const area = 4 * Math.PI * size ** 2;
  const volume = (4 / 3) * Math.PI * size ** 3;
  return { area, volume, ratio: area / volume, label: `Sphere of radius ${size}` };
}
