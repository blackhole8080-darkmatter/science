#!/usr/bin/env python3
"""
Cross-language validation: run the JavaScript engines and the independent
Python reference over the same inputs, and diff the answers.

    python3 tools/validate/check.py

Exits non-zero on any disagreement. This catches a class of bug that
same-language unit tests cannot: a misremembered constant or a transcription
slip has to occur identically in two independent implementations, written in
two languages from the underlying science, to survive.

Requires node on PATH. No third-party Python packages.
"""

from __future__ import annotations

import json
import math
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import reference as ref  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]

# A single node process emits every JavaScript answer as JSON.
JS_PROBE = r"""
import { molarMass, balanceEquation } from './assets/js/lib/chemistry-core.js';
import { projectile, combineResistors, thinLens, decay } from './assets/js/lib/physics-core.js';
import { translate, punnettSquare, hardyWeinberg } from './assets/js/lib/biology-core.js';
import { airwayGeneration, simulateActionPotential } from './assets/js/lib/anatomy-core.js';
import { radialValue, ORBITALS_BY_ID } from './assets/js/lib/orbital-core.js';

const radialNorm = (id) => {
  const orbital = ORBITALS_BY_ID.get(id);
  let total = 0;
  const dr = 0.002;
  for (let r = dr; r < 120; r += dr) total += radialValue(orbital, r) ** 2 * r * r * dr;
  return total;
};

const flat = projectile({ speed: 20, angleDeg: 45, height: 0, gravity: 9.80665 });
const raised = projectile({ speed: 15, angleDeg: 30, height: 10, gravity: 9.80665 });
const lens = thinLens({ focalLength: 10, objectDistance: 15 });
const spike = simulateActionPotential({ stimulus: 10 });
const hw = hardyWeinberg({ recessivePhenotype: 0.09 });

console.log(JSON.stringify({
  molarMass_water: molarMass('H2O'),
  molarMass_hydrate: molarMass('CuSO4.5H2O'),
  molarMass_glucose: molarMass('C6H12O6'),
  balance_permanganate: balanceEquation('KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2').coefficients,
  balance_propane: balanceEquation('C3H8 + O2 -> CO2 + H2O').coefficients,
  projectile_range: flat.range,
  projectile_apex: flat.apex,
  projectile_raised_range: raised.range,
  projectile_raised_impact: raised.impactSpeed,
  parallel_resistance: combineResistors([4, 6, 12], 'parallel'),
  lens_image: lens.imageDistance,
  lens_magnification: lens.magnification,
  decay_remaining: decay({ initial: 1000, halfLife: 5730, time: 11460 }).remaining,
  translate_peptide: translate('ATGGCCATTGTAATGGGCCGCTGA').oneLetter,
  punnett_dihybrid: punnettSquare('AaBb', 'AaBb').phenotypes.map((p) => p.ratio),
  punnett_mono: punnettSquare('Aa', 'Aa').phenotypes.map((p) => p.ratio),
  hw_carriers: hw.heterozygous,
  airway16_diameter: airwayGeneration(16).diameter,
  airway16_area: airwayGeneration(16).totalCrossSection,
  hh_peak: spike.peak,
  radial_norm_1s: radialNorm('1s'),
  radial_norm_3d: radialNorm('3dz2'),
}));
"""


def javascript_results() -> dict:
    probe = ROOT / ".cross-check-probe.mjs"
    probe.write_text(JS_PROBE)
    try:
        output = subprocess.run(
            ["node", probe.name], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout
    finally:
        probe.unlink(missing_ok=True)
    return json.loads(output)


def python_results() -> dict:
    flat = ref.projectile(20, 45, 0)
    raised = ref.projectile(15, 30, 10)
    lens = ref.thin_lens(10, 15)
    hw = ref.hardy_weinberg(0.09)
    return {
        "molarMass_water": ref.molar_mass("H2O"),
        "molarMass_hydrate": ref.molar_mass("CuSO4.5H2O"),
        "molarMass_glucose": ref.molar_mass("C6H12O6"),
        "balance_permanganate": ref.balance_equation(["KMnO4", "HCl"], ["KCl", "MnCl2", "H2O", "Cl2"]),
        "balance_propane": ref.balance_equation(["C3H8", "O2"], ["CO2", "H2O"]),
        "projectile_range": flat["range"],
        "projectile_apex": flat["apex"],
        "projectile_raised_range": raised["range"],
        "projectile_raised_impact": raised["impactSpeed"],
        "parallel_resistance": ref.parallel_resistance([4, 6, 12]),
        "lens_image": lens["imageDistance"],
        "lens_magnification": lens["magnification"],
        "decay_remaining": ref.decay_remaining(1000, 5730, 11460),
        "translate_peptide": ref.translate("ATGGCCATTGTAATGGGCCGCTGA"),
        "punnett_dihybrid": ref.punnett_phenotype_ratio("AaBb", "AaBb"),
        "punnett_mono": ref.punnett_phenotype_ratio("Aa", "Aa"),
        "hw_carriers": hw["Aa"],
        "airway16_diameter": ref.weibel_airway(16)["diameter"],
        "airway16_area": ref.weibel_airway(16)["totalCrossSection"],
        "hh_peak": ref.hodgkin_huxley_peak(10),
        "radial_norm_1s": ref.hydrogenic_radial_norm(1, 0),
        "radial_norm_3d": ref.hydrogenic_radial_norm(3, 2),
    }


# Relative tolerance per check. Exact for integers and strings; loose only where
# an independent numerical method legitimately differs (quadrature, ODE steps).
TOLERANCES = {
    "hh_peak": 1e-6,
    "radial_norm_1s": 1e-9,
    "radial_norm_3d": 1e-9,
    "_default": 1e-12,
}


def agree(js, py, tolerance: float) -> bool:
    if isinstance(js, str) or isinstance(py, str):
        return js == py
    if isinstance(js, list) or isinstance(py, list):
        return list(js) == list(py)
    if js == py:
        return True
    scale = max(abs(js), abs(py), 1e-30)
    return abs(js - py) / scale <= tolerance


def main() -> int:
    js = javascript_results()
    py = python_results()

    keys = sorted(set(js) | set(py))
    width = max(len(k) for k in keys)
    failures = []

    print(f"\n  {'check'.ljust(width)}  {'javascript':>22}  {'python':>22}   ")
    print(f"  {'-' * width}  {'-' * 22}  {'-' * 22}")
    for key in keys:
        tolerance = TOLERANCES.get(key, TOLERANCES["_default"])
        a, b = js.get(key), py.get(key)
        ok = a is not None and b is not None and agree(a, b, tolerance)
        if not ok:
            failures.append(key)

        def show(value):
            if isinstance(value, float):
                return f"{value:.12g}"
            return str(value)

        mark = "ok " if ok else "MISMATCH"
        print(f"  {key.ljust(width)}  {show(a):>22}  {show(b):>22}  {mark}")

    print()
    if failures:
        print(f"  {len(failures)} disagreement(s): {', '.join(failures)}\n")
        return 1
    print(f"  all {len(keys)} checks agree across JavaScript and Python\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
