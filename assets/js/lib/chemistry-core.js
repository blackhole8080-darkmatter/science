/**
 * Chemistry engine: formula parsing, molar mass, percentage composition,
 * empirical formulae and equation balancing. Pure functions, no DOM.
 */

import { BY_SYMBOL } from "../data/elements.js";

/**
 * Parse a chemical formula into element counts.
 * Supports nested brackets — (NH4)2SO4, [Cu(NH3)4]SO4 — hydrate dots
 * (CuSO4.5H2O or CuSO4·5H2O) and trailing charges (SO4^2-).
 * @returns {Map<string, number>} element symbol -> atom count
 */
export function parseFormula(formula) {
  const cleaned = String(formula).replace(/\s+/g, "");
  if (!cleaned) throw new Error("Empty formula");

  // A hydrate dot splits the formula into independently multiplied units.
  const units = cleaned.split(/[.·*]/).filter(Boolean);
  if (units.length > 1) {
    const total = new Map();
    for (const unit of units) {
      const leading = unit.match(/^(\d+)(.*)$/);
      const multiplier = leading ? Number(leading[1]) : 1;
      const body = leading ? leading[2] : unit;
      for (const [symbol, count] of parseFormula(body)) {
        total.set(symbol, (total.get(symbol) || 0) + count * multiplier);
      }
    }
    return total;
  }

  const body = cleaned.replace(/\^?\d*[+-]$/, ""); // discard an ionic charge suffix
  let i = 0;

  function parseGroup() {
    const counts = new Map();
    while (i < body.length) {
      const ch = body[i];
      if (ch === ")" || ch === "]") break;
      if (ch === "(" || ch === "[") {
        i += 1;
        const inner = parseGroup();
        const closer = body[i];
        if (closer !== ")" && closer !== "]") throw new Error("Unbalanced bracket in formula");
        i += 1;
        const multiplier = readNumber();
        for (const [symbol, count] of inner) {
          counts.set(symbol, (counts.get(symbol) || 0) + count * multiplier);
        }
        continue;
      }
      const match = /^[A-Z][a-z]?/.exec(body.slice(i));
      if (!match) throw new Error(`Unexpected character "${ch}" in formula`);
      const symbol = match[0];
      if (!BY_SYMBOL.has(symbol)) throw new Error(`Unknown element "${symbol}"`);
      i += symbol.length;
      const count = readNumber();
      counts.set(symbol, (counts.get(symbol) || 0) + count);
    }
    return counts;
  }

  function readNumber() {
    const match = /^\d+/.exec(body.slice(i));
    if (!match) return 1;
    i += match[0].length;
    return Number(match[0]);
  }

  const result = parseGroup();
  if (i < body.length) throw new Error("Unbalanced bracket in formula");
  if (result.size === 0) throw new Error("No elements found in formula");
  return result;
}

/** Molar mass in g·mol⁻¹. */
export function molarMass(formula) {
  let total = 0;
  for (const [symbol, count] of parseFormula(formula)) {
    total += BY_SYMBOL.get(symbol).mass * count;
  }
  return total;
}

/** Per-element breakdown with mass contribution and percentage by mass. */
export function composition(formula) {
  const counts = parseFormula(formula);
  const total = molarMass(formula);
  return [...counts.entries()]
    .map(([symbol, count]) => {
      const element = BY_SYMBOL.get(symbol);
      const mass = element.mass * count;
      return {
        symbol,
        name: element.name,
        color: element.color,
        count,
        atomicMass: element.mass,
        mass,
        percent: (mass / total) * 100,
      };
    })
    .sort((a, b) => b.mass - a.mass);
}

/**
 * Empirical formula from percentage (or gram) composition.
 * @param {Array<{symbol: string, amount: number}>} parts
 */
export function empiricalFormula(parts) {
  const moles = parts.map(({ symbol, amount }) => {
    const element = BY_SYMBOL.get(symbol);
    if (!element) throw new Error(`Unknown element "${symbol}"`);
    return { symbol, moles: amount / element.mass };
  });
  const smallest = Math.min(...moles.map((m) => m.moles));
  if (!Number.isFinite(smallest) || smallest <= 0) throw new Error("Amounts must be positive");

  let ratios = moles.map((m) => m.moles / smallest);
  // Scale up until every ratio is close to a whole number (handles 1.5, 1.33, 1.25).
  let scale = 1;
  for (let s = 1; s <= 12; s += 1) {
    if (ratios.every((r) => Math.abs(r * s - Math.round(r * s)) < 0.08)) {
      scale = s;
      break;
    }
  }
  ratios = ratios.map((r) => Math.round(r * scale));
  const divisor = ratios.reduce(gcd);
  return moles
    .map((m, idx) => ({ symbol: m.symbol, moles: m.moles, subscript: ratios[idx] / divisor }))
    .filter((part) => part.subscript > 0);
}

export function formatFormula(parts) {
  return parts.map((p) => p.symbol + (p.subscript === 1 ? "" : p.subscript)).join("");
}

/* ------------------------------------------------------------------ *
 * Equation balancing
 * ------------------------------------------------------------------ */

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

/** Split "H2 + O2 -> H2O" into species lists. Accepts ->, =, →, ⟶. */
export function parseEquation(equation) {
  const sides = String(equation).split(/-+>|=+>?|→|⟶/);
  if (sides.length !== 2) throw new Error('Use a single arrow, e.g. "H2 + O2 -> H2O"');
  const split = (side) =>
    side
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);
  const reactants = split(sides[0]);
  const products = split(sides[1]);
  if (!reactants.length || !products.length) throw new Error("Both sides need at least one species");
  return { reactants, products };
}

/**
 * Balance a chemical equation by finding the null-space vector of the
 * element-conservation matrix using exact integer (fraction-free) elimination.
 * @returns {{reactants: string[], products: string[], coefficients: number[]}}
 */
export function balanceEquation(equation) {
  const { reactants, products } = parseEquation(equation);
  const species = [...reactants, ...products];
  const parsed = species.map(parseFormula);

  const elements = [...new Set(parsed.flatMap((m) => [...m.keys()]))];
  // Rows = elements, columns = species. Products carry a negative sign so that
  // a solution of the homogeneous system conserves every element.
  const matrix = elements.map((symbol) =>
    parsed.map((counts, col) => {
      const n = counts.get(symbol) || 0;
      return col < reactants.length ? n : -n;
    })
  );

  const n = species.length;
  const solution = nullSpaceVector(matrix, n);
  if (!solution) throw new Error("This equation cannot be balanced as written");

  // Clear denominators, then reduce to the smallest whole-number set.
  let denominator = 1;
  for (const value of solution) denominator = lcm(denominator, value.den);
  let coefficients = solution.map((value) => (value.num * denominator) / value.den);
  const sign = coefficients.find((c) => c !== 0) < 0 ? -1 : 1;
  coefficients = coefficients.map((c) => c * sign);
  const divisor = coefficients.reduce(gcd);
  coefficients = coefficients.map((c) => c / divisor);

  if (coefficients.some((c) => c <= 0 || !Number.isFinite(c))) {
    throw new Error("This equation cannot be balanced as written");
  }
  return { reactants, products, coefficients };
}

/**
 * One null-space basis vector of an integer matrix, as exact fractions.
 * Returns null when the only solution is trivial (unique zero vector).
 */
function nullSpaceVector(matrix, columns) {
  const rows = matrix.map((row) => row.map((v) => ({ num: v, den: 1 })));
  const pivotOf = [];
  let pivotRow = 0;

  for (let col = 0; col < columns && pivotRow < rows.length; col += 1) {
    let target = -1;
    for (let r = pivotRow; r < rows.length; r += 1) {
      if (rows[r][col].num !== 0) {
        target = r;
        break;
      }
    }
    if (target === -1) continue;
    [rows[pivotRow], rows[target]] = [rows[target], rows[pivotRow]];

    const pivot = rows[pivotRow][col];
    for (let c = 0; c < columns; c += 1) rows[pivotRow][c] = divide(rows[pivotRow][c], pivot);
    for (let r = 0; r < rows.length; r += 1) {
      if (r === pivotRow || rows[r][col].num === 0) continue;
      const factor = rows[r][col];
      for (let c = 0; c < columns; c += 1) {
        rows[r][c] = subtract(rows[r][c], multiply(factor, rows[pivotRow][c]));
      }
    }
    pivotOf[pivotRow] = col;
    pivotRow += 1;
  }

  const pivotCols = new Set(pivotOf.slice(0, pivotRow));
  const freeCol = [...Array(columns).keys()].find((c) => !pivotCols.has(c));
  if (freeCol === undefined) return null; // full rank: only the zero solution

  const solution = Array.from({ length: columns }, (_, c) =>
    c === freeCol ? fraction(1, 1) : fraction(0, 1)
  );
  for (let r = 0; r < pivotRow; r += 1) {
    solution[pivotOf[r]] = negate(rows[r][freeCol]);
  }
  return solution;
}

function fraction(num, den) {
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const d = gcd(num, den);
  return { num: num / d, den: den / d };
}
const multiply = (a, b) => fraction(a.num * b.num, a.den * b.den);
const divide = (a, b) => fraction(a.num * b.den, a.den * b.num);
const subtract = (a, b) => fraction(a.num * b.den - b.num * a.den, a.den * b.den);
const negate = (a) => fraction(-a.num, a.den);

/** Element-by-element atom tally for a balanced equation (used to prove the balance). */
export function atomTally({ reactants, products, coefficients }) {
  const tally = new Map();
  const add = (formula, coefficient, side) => {
    for (const [symbol, count] of parseFormula(formula)) {
      const entry = tally.get(symbol) || { left: 0, right: 0 };
      entry[side] += count * coefficient;
      tally.set(symbol, entry);
    }
  };
  reactants.forEach((f, i) => add(f, coefficients[i], "left"));
  products.forEach((f, i) => add(f, coefficients[reactants.length + i], "right"));
  return [...tally.entries()].map(([symbol, sides]) => ({ symbol, ...sides }));
}
