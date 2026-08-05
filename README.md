# Science Lab

An interactive **biology, physics and chemistry** workspace that runs entirely in the
browser. Every calculator shows its working, every dataset is colour-coded, and the
results are drawn as graphs, ray diagrams, circuit schematics and cell diagrams.

No build step, no dependencies, no network calls — open `index.html` and it runs.

## Running it

```bash
python3 -m http.server 8899     # or: npm start
# then open http://localhost:8899
```

A server is needed because the app is built from ES modules, which browsers refuse to
load over `file://`.

## What's inside

### ⚛ Physics
| Tool | What it does |
|---|---|
| Motion (SUVAT) | Enter any three of *u, v, a, s, t* — solves the rest, names the rearrangement used, and plots the velocity–time graph |
| Projectiles | Range, apex, flight time and impact speed, with the trajectory plotted and the apex/landing marked |
| Force & energy | *F = ma* plus work, kinetic and potential energy, momentum and average power |
| Circuits | Series/parallel resistor networks with a drawn schematic and a per-resistor current, p.d. and power table |
| Refraction | Snell's law, critical angle and total internal reflection, drawn to the calculated angles |
| Lenses | Thin lens equation with a real ray diagram (converging and diverging, real and virtual images) |
| Heat energy | *Q = mcΔθ*, solved for whichever quantity is left blank |
| Radioactivity | Decay constant, remaining quantity and half-lives elapsed, with the decay curve |
| Constants & formulae | SI constants (marked exact where fixed by definition) and six formula sheets |

### 🧪 Chemistry
| Tool | What it does |
|---|---|
| Periodic table | All 118 elements, filterable by category and searchable, with per-element profiles, shell models and a sortable data table |
| Molar mass | Handles brackets and hydrates — `(NH4)2SO4`, `CuSO4·5H2O`, `[Cu(NH3)4]SO4` — with percentage composition |
| Equation balancer | Balances exactly by solving the element-conservation matrix, then proves it with an atom tally |
| Reacting masses | Full stoichiometry: balance, convert to moles, scale by the mole ratio, convert back |
| Empirical formula | From percentage composition, plus the molecular formula when *Mᵣ* is known |
| Concentration | Moles, concentration and dilution via *c₁V₁ = c₂V₂* |
| Ideal gases | *pV = nRT*, solved for whichever quantity is left blank |
| pH & acids | Strong acids and bases plus weak acids from *Kₐ*, on a universal-indicator scale |

### 🧬 Biology
| Tool | What it does |
|---|---|
| DNA → protein | Transcription and translation with coloured strands, per-codon chips, GC content and melting temperature |
| Genetic code | All 64 codons, coloured by amino acid chemistry |
| Punnett square | Monohybrid and dihybrid crosses with genotype and phenotype ratios |
| Hardy–Weinberg | Allele and genotype frequencies, carrier rate and population counts |
| Cell explorer | Clickable plant and animal cell diagrams with structure/function notes |
| Microscopy | The magnification triangle plus instrument resolution limits |
| Surface area : volume | Why size limits diffusion |

## Design notes

- **Colour is never the only cue.** The element category palette was solved for maximum
  separation between neighbouring blocks and validated for colour-vision deficiency
  (worst adjacent pair ΔE 13.2 CVD / 19.3 normal vision, in both light and dark themes).
  Every cell still carries its symbol and number, the legend repeats the category in
  text, and a sortable text table holds the same data.
- **Both themes are deliberate.** The light theme is its own set of surface values, not
  an inverted dark theme; the toggle is remembered in `localStorage`.
- **Every view is linkable.** The URL hash is `#subject/tool`, so any tool can be
  bookmarked or shared and survives a reload.

## Layout

```
index.html
assets/
  css/styles.css            design system: themes, cards, tables, diagrams
  js/
    app.js                  shell: subject tabs, tool rail, routing, theme
    data/elements.js        118 elements + configuration and grid helpers
    data/reference.js       constants, formula sheets, genetic code, organelles
    lib/chemistry-core.js   formula parsing, molar mass, equation balancing
    lib/physics-core.js     SUVAT, projectiles, circuits, optics, decay
    lib/biology-core.js     central dogma, Mendelian and population genetics
    lib/chart.js            inline-SVG plotting with a crosshair readout
    lib/ui.js               DOM helpers, number formatting, tool scaffold
    modules/{physics,chemistry,biology}.js
tests/
  run-tests.mjs             engine tests (no dependencies)
  layout.mjs                browser checks (needs Playwright)
```

The calculation engines are deliberately DOM-free, so they can be tested under node and
reused elsewhere.

## Tests

```bash
npm test              # 34 engine tests, no dependencies
npm run test:browser  # renders all 26 tools, checks for errors and label collisions
```

The browser suite needs Playwright and a server running on port 8899; it skips itself if
Playwright isn't installed.

## Accuracy

Atomic weights follow IUPAC standard values, and physical constants use the 2019 SI
redefinition. The tools assume idealised conditions — no air resistance on projectiles,
ideal gas behaviour, complete dominance and independent assortment in genetics crosses —
and each tool says so where it matters. Predicted electron configurations follow the
aufbau order, so the handful of experimental exceptions (Cr, Cu, Pd…) are labelled as
predicted rather than measured.
