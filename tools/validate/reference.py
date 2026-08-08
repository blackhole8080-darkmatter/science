"""
Independent reference implementations of the science in this repository.

The point is *independence*. These are written from the physics and chemistry
directly, in a different language, without importing or consulting the
JavaScript. `check.py` then runs both and diffs them. A bug that exists in one
implementation has to be reproduced identically in the other to escape notice,
which is a far higher bar than a unit test written by the same hand that wrote
the code.

Pure standard library on purpose: no numpy, no scipy. A shared dependency would
be a shared failure mode, and it keeps the harness runnable anywhere.
"""

from __future__ import annotations

import math
from fractions import Fraction
from typing import Dict, List, Sequence, Tuple

# --------------------------------------------------------------------------
# Chemistry
# --------------------------------------------------------------------------

# IUPAC standard atomic weights, only for the elements the checks exercise.
ATOMIC_WEIGHTS: Dict[str, float] = {
    "H": 1.008, "C": 12.011, "N": 14.007, "O": 15.999, "Na": 22.990,
    "S": 32.06, "Cl": 35.45, "K": 39.098, "Fe": 55.845, "Cu": 63.546,
}


def parse_formula(formula: str) -> Dict[str, int]:
    """Recursive-descent parse of a chemical formula into element counts."""
    formula = formula.replace(" ", "")
    units = [u for u in formula.replace("·", ".").split(".") if u]
    if len(units) > 1:
        total: Dict[str, int] = {}
        for unit in units:
            multiplier, body = 1, unit
            digits = ""
            while body and body[0].isdigit():
                digits, body = digits + body[0], body[1:]
            if digits:
                multiplier = int(digits)
            for element, count in parse_formula(body).items():
                total[element] = total.get(element, 0) + count * multiplier
        return total

    position = 0

    def read_number() -> int:
        nonlocal position
        digits = ""
        while position < len(formula) and formula[position].isdigit():
            digits += formula[position]
            position += 1
        return int(digits) if digits else 1

    def parse_group() -> Dict[str, int]:
        nonlocal position
        counts: Dict[str, int] = {}
        while position < len(formula):
            char = formula[position]
            if char in ")]":
                break
            if char in "([":
                position += 1
                inner = parse_group()
                position += 1  # closing bracket
                multiplier = read_number()
                for element, count in inner.items():
                    counts[element] = counts.get(element, 0) + count * multiplier
                continue
            symbol = char
            position += 1
            if position < len(formula) and formula[position].islower():
                symbol += formula[position]
                position += 1
            counts[symbol] = counts.get(symbol, 0) + read_number()
        return counts

    return parse_group()


def molar_mass(formula: str) -> float:
    return sum(ATOMIC_WEIGHTS[element] * count for element, count in parse_formula(formula).items())


def balance_equation(reactants: Sequence[str], products: Sequence[str]) -> List[int]:
    """
    Balance by finding the null space of the element-conservation matrix over
    exact rationals — Gaussian elimination with Fraction, so no floating point
    error can creep into an integer answer.
    """
    species = list(reactants) + list(products)
    parsed = [parse_formula(s) for s in species]
    elements = sorted({e for counts in parsed for e in counts})

    rows = [
        [
            Fraction(counts.get(element, 0) * (1 if index < len(reactants) else -1))
            for index, counts in enumerate(parsed)
        ]
        for element in elements
    ]

    columns = len(species)
    pivot_columns: List[int] = []
    pivot_row = 0
    for column in range(columns):
        target = next((r for r in range(pivot_row, len(rows)) if rows[r][column] != 0), None)
        if target is None:
            continue
        rows[pivot_row], rows[target] = rows[target], rows[pivot_row]
        pivot = rows[pivot_row][column]
        rows[pivot_row] = [value / pivot for value in rows[pivot_row]]
        for r in range(len(rows)):
            if r != pivot_row and rows[r][column] != 0:
                factor = rows[r][column]
                rows[r] = [a - factor * b for a, b in zip(rows[r], rows[pivot_row])]
        pivot_columns.append(column)
        pivot_row += 1

    free = next((c for c in range(columns) if c not in pivot_columns), None)
    if free is None:
        raise ValueError("no non-trivial solution — equation cannot be balanced")

    solution = [Fraction(0)] * columns
    solution[free] = Fraction(1)
    for row_index, column in enumerate(pivot_columns):
        solution[column] = -rows[row_index][free]

    denominator = 1
    for value in solution:
        denominator = denominator * value.denominator // math.gcd(denominator, value.denominator)
    integers = [int(value * denominator) for value in solution]
    if integers and integers[0] < 0:
        integers = [-v for v in integers]
    divisor = 0
    for value in integers:
        divisor = math.gcd(divisor, abs(value))
    return [value // divisor for value in integers]


def ph_of_strong_acid(concentration: float) -> float:
    return -math.log10(concentration)


def ph_of_weak_acid(concentration: float, ka: float) -> float:
    return -math.log10(math.sqrt(ka * concentration))


# --------------------------------------------------------------------------
# Physics
# --------------------------------------------------------------------------

def projectile(speed: float, angle_deg: float, height: float = 0.0, gravity: float = 9.80665) -> Dict[str, float]:
    theta = math.radians(angle_deg)
    ux, uy = speed * math.cos(theta), speed * math.sin(theta)
    flight = (uy + math.sqrt(uy * uy + 2 * gravity * height)) / gravity
    return {
        "range": ux * flight,
        "flightTime": flight,
        "apex": height + (uy * uy / (2 * gravity) if uy > 0 else 0.0),
        "impactSpeed": math.hypot(ux, uy - gravity * flight),
    }


def parallel_resistance(values: Sequence[float]) -> float:
    return 1.0 / sum(1.0 / v for v in values)


def thin_lens(focal_length: float, object_distance: float) -> Dict[str, float]:
    u = -object_distance
    v = 1.0 / (1.0 / focal_length + 1.0 / u)
    return {"imageDistance": v, "magnification": v / u}


def decay_remaining(initial: float, half_life: float, time: float) -> float:
    return initial * math.exp(-math.log(2) / half_life * time)


# --------------------------------------------------------------------------
# Biology
# --------------------------------------------------------------------------

CODON_TABLE = {
    "UUU": "F", "UUC": "F", "UUA": "L", "UUG": "L", "CUU": "L", "CUC": "L",
    "CUA": "L", "CUG": "L", "AUU": "I", "AUC": "I", "AUA": "I", "AUG": "M",
    "GUU": "V", "GUC": "V", "GUA": "V", "GUG": "V", "UCU": "S", "UCC": "S",
    "UCA": "S", "UCG": "S", "CCU": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACU": "T", "ACC": "T", "ACA": "T", "ACG": "T", "GCU": "A", "GCC": "A",
    "GCA": "A", "GCG": "A", "UAU": "Y", "UAC": "Y", "UAA": "*", "UAG": "*",
    "CAU": "H", "CAC": "H", "CAA": "Q", "CAG": "Q", "AAU": "N", "AAC": "N",
    "AAA": "K", "AAG": "K", "GAU": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "UGU": "C", "UGC": "C", "UGA": "*", "UGG": "W", "CGU": "R", "CGC": "R",
    "CGA": "R", "CGG": "R", "AGU": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGU": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}


def translate(dna: str) -> str:
    """Transcribe DNA to mRNA, then translate from the first AUG to a stop."""
    rna = dna.upper().replace("T", "U")
    start = rna.find("AUG")
    if start < 0:
        raise ValueError("no start codon")
    peptide = []
    for i in range(start, len(rna) - 2, 3):
        residue = CODON_TABLE[rna[i:i + 3]]
        if residue == "*":
            break
        peptide.append(residue)
    return "".join(peptide)


def punnett_phenotype_ratio(parent_a: str, parent_b: str) -> List[int]:
    """Phenotype ratio of a cross, computed by enumerating gametes."""
    def genes(genotype: str) -> List[str]:
        return [genotype[i:i + 2] for i in range(0, len(genotype), 2)]

    def gametes(genotype: str) -> List[str]:
        combos = [""]
        for pair in genes(genotype):
            combos = [combo + allele for combo in combos for allele in pair]
        return combos

    counts: Dict[Tuple[bool, ...], int] = {}
    for a in gametes(parent_a):
        for b in gametes(parent_b):
            phenotype = tuple(
                (a[i].isupper() or b[i].isupper()) for i in range(len(a))
            )
            counts[phenotype] = counts.get(phenotype, 0) + 1
    ordered = sorted(counts.values(), reverse=True)
    divisor = 0
    for value in ordered:
        divisor = math.gcd(divisor, value)
    return [value // divisor for value in ordered]


def hardy_weinberg(q_squared: float) -> Dict[str, float]:
    q = math.sqrt(q_squared)
    p = 1 - q
    return {"p": p, "q": q, "AA": p * p, "Aa": 2 * p * q, "aa": q * q}


def weibel_airway(generation: int, trachea_diameter: float = 1.8) -> Dict[str, float]:
    scale = (0.5 ** (1 / 3)) ** generation
    diameter = trachea_diameter * scale
    count = 2 ** generation
    return {
        "diameter": diameter,
        "count": count,
        "totalCrossSection": count * math.pi * (diameter / 2) ** 2,
    }


def hodgkin_huxley_peak(stimulus: float, duration: float = 40.0, dt: float = 0.01) -> float:
    """Integrate the 1952 equations and return the peak membrane potential."""
    v, c_m = -65.0, 1.0
    g_na, e_na, g_k, e_k, g_l, e_l = 120.0, 50.0, 36.0, -77.0, 0.3, -54.387

    def alpha_n(v): return 0.1 if abs(v + 55) < 1e-6 else 0.01 * (v + 55) / (1 - math.exp(-(v + 55) / 10))
    def beta_n(v): return 0.125 * math.exp(-(v + 65) / 80)
    def alpha_m(v): return 1.0 if abs(v + 40) < 1e-6 else 0.1 * (v + 40) / (1 - math.exp(-(v + 40) / 10))
    def beta_m(v): return 4 * math.exp(-(v + 65) / 18)
    def alpha_h(v): return 0.07 * math.exp(-(v + 65) / 20)
    def beta_h(v): return 1 / (1 + math.exp(-(v + 35) / 10))

    n = alpha_n(v) / (alpha_n(v) + beta_n(v))
    m = alpha_m(v) / (alpha_m(v) + beta_m(v))
    h = alpha_h(v) / (alpha_h(v) + beta_h(v))

    peak = v
    for step in range(int(duration / dt) + 1):
        t = step * dt
        injected = stimulus if 5.0 <= t < 6.0 else 0.0
        i_na = g_na * m ** 3 * h * (v - e_na)
        i_k = g_k * n ** 4 * (v - e_k)
        i_l = g_l * (v - e_l)
        dv = (injected - i_na - i_k - i_l) / c_m
        dn = alpha_n(v) * (1 - n) - beta_n(v) * n
        dm = alpha_m(v) * (1 - m) - beta_m(v) * m
        dh = alpha_h(v) * (1 - h) - beta_h(v) * h
        v += dv * dt
        n += dn * dt
        m += dm * dt
        h += dh * dt
        peak = max(peak, v)
    return peak


def hydrogenic_radial_norm(n: int, l: int, r_max: float = 120.0, dr: float = 0.002) -> float:
    """∫|R_nl|²r²dr — must be 1 for a correctly normalised radial function."""
    def radial(r: float) -> float:
        if (n, l) == (1, 0):
            return 2 * math.exp(-r)
        if (n, l) == (2, 0):
            return (1 / (2 * math.sqrt(2))) * (2 - r) * math.exp(-r / 2)
        if (n, l) == (2, 1):
            return (1 / (2 * math.sqrt(6))) * r * math.exp(-r / 2)
        if (n, l) == (3, 0):
            return (2 / (81 * math.sqrt(3))) * (27 - 18 * r + 2 * r * r) * math.exp(-r / 3)
        if (n, l) == (3, 1):
            return (4 / (81 * math.sqrt(6))) * (6 * r - r * r) * math.exp(-r / 3)
        if (n, l) == (3, 2):
            return (4 / (81 * math.sqrt(30))) * r * r * math.exp(-r / 3)
        raise ValueError(f"no radial function for n={n}, l={l}")

    total = 0.0
    r = dr
    while r < r_max:
        total += radial(r) ** 2 * r * r * dr
        r += dr
    return total
