# Science Lab

An interactive **biology, physics and chemistry** workspace that runs entirely in the
browser. Every calculator shows its working, every dataset is colour-coded, and the
results are drawn as graphs, ray diagrams, circuit schematics, cell diagrams and
real-time 3D models.

No build step and no network calls. The only dependency is three.js, vendored into
`vendor/three/` so the app still works offline — open `index.html` and it runs.

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
| 3D molecules | 15 molecules built from measured bond lengths and angles — ball-and-stick, space-filling or wireframe, with lone pairs shown |
| Crystal structures | Six lattices generated from published lattice parameters, 1–27 unit cells, with the covalent framework drawn |
| Atomic orbitals | Exact hydrogenic wavefunctions: the angular shape r = \|Y\|, or a Monte-Carlo \|ψ\|² cloud showing the radial nodes |
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
| Body explorer | The whole body: skeleton, brain, heart, lungs, liver, gut, kidneys and more, placed to scale on a 175 cm reference body. Toggle systems as layers, click any structure to inspect it, isolate or ghost the rest |
| Beating heart | A live cardiac cycle: chambers contract, valves open and shut on the pressure gradient, blood moves only through open valves, with the Wiggers pressure and volume curves alongside |
| Airway tree | The bronchial tree grown from Weibel's morphometry, 4–10 generations, with the total cross-sectional area curve that explains gas exchange |
| Action potential | The Hodgkin–Huxley equations integrated live, firing down a myelinated axon — drop below threshold and the spike vanishes rather than shrinking |
| DNA helix | Your sequence built at B-form crystallographic dimensions, base-paired and colour-coded |
| DNA → protein | Transcription and translation with coloured strands, per-codon chips, GC content and melting temperature |
| Genetic code | All 64 codons, coloured by amino acid chemistry |
| Punnett square | Monohybrid and dihybrid crosses with genotype and phenotype ratios |
| Hardy–Weinberg | Allele and genotype frequencies, carrier rate and population counts |
| Cell explorer | Clickable plant and animal cell diagrams with structure/function notes |
| Microscopy | The magnification triangle plus instrument resolution limits |
| Surface area : volume | Why size limits diffusion |

## The 3D models are computed, not drawn

Nothing in the 3D views is a hand-positioned art asset:

- **Molecules** are placed by a VSEPR builder from experimental bond lengths and
  angles. Water comes out at 104.45° and methane at 109.47° because those are the
  measured values fed in — and the app measures the angles *back off* the generated
  coordinates, so the picture and the printed number cannot drift apart. Ethene's
  planarity and ethane's staggered conformation fall out of the builder rather than
  being asserted.
- **Crystals** are expanded from fractional basis coordinates times the published
  lattice parameter. The nearest-neighbour distance shown is measured from the
  generated positions: NaCl gives 2.820 Å, diamond 1.545 Å, copper 2.556 Å.
- **Orbitals** are the real hydrogenic wavefunctions ψ = R_nl(r)·Y_lm(θ, φ), with
  radial functions exact for n ≤ 3 and normalised to 1. The 1s peak lands at exactly
  one Bohr radius, 2p at 4a₀, 3d at 9a₀, and node counts follow n − l − 1. The
  probability cloud is rejection-sampled from |ψ|² with a seeded PRNG, so a given
  orbital always renders identically.

Atom colours follow the Jmol/PyMOL convention that molecular viewers use, which is
also the legible choice — the original CPK black carbon vanishes on a dark
background. Every atom carries its element symbol as a label regardless.

## Anatomy is derived, not sculpted

The 3D human biology is generated from the quantitative models physiologists use,
which is why the numbers on screen are the numbers that built the picture:

- **The airway tree** follows Weibel's model A: each generation's diameter and length
  scale by 2^(−1/3) while the count doubles. That is why the total cross-section climbs
  from 2.5 cm² at the trachea to over 500 cm² at the alveoli — and why air slows almost
  to a stop, leaving the last millimetre to diffusion.
- **The heart** runs on measured chamber pressures. Nothing about the valves is
  keyframed: the mitral valve opens whenever atrial pressure exceeds ventricular, and
  the aortic valve opens when ventricular exceeds aortic. The isovolumetric phases fall
  out of that on their own — both valves shut, so the volume cannot change however hard
  the muscle squeezes. Stroke volume 70 mL, cardiac output 5.25 L·min⁻¹, ejection
  fraction 58%.
- **The action potential** is the 1952 Hodgkin–Huxley system integrated in the browser,
  with the original squid-axon conductances. The spike overshoots to about +40 mV,
  repolarises past rest into an after-hyperpolarisation, and is genuinely all-or-nothing
  — tripling the stimulus does not make it taller.
- **DNA** uses B-form parameters: 3.4 Å rise, 34.3° twist, 10.5 base pairs per turn,
  20 Å diameter, and the 140° offset between backbones that produces one wide groove
  and one narrow one.

- **The body explorer** places 17 structures across 7 systems on a 175 cm reference
  body. The spine carries its real cervical, thoracic and lumbar curves; the 24
  presacral vertebrae grow from cervical to lumbar because load does; ribs are
  classified true, false and floating and swept accordingly; the right lung has three
  lobes and the left two, because the left yields space to the heart.

What this deliberately is *not* is a photoreal, imaging-segmented atlas. It is
anatomically placed and correctly scaled, but schematic — it will not match an
individual patient and is not for clinical use.

Scanned meshes can replace any structure without touching code: drop a glTF into
`assets/anatomy/` and name it in `manifest.json`. **Read `assets/anatomy/README.md`
first** — it lists the open atlases (BodyParts3D, Z-Anatomy, OpenAnatomy) with their
licences, and explains two traps: CC BY-SA share-alike is viral, and a model with no
stated licence is not free to use, however public it looks.

## Engineering

Three things beyond the browser code, each earning its place rather than being
there for the badge:

**A C++ compute kernel.** `wasm/orbital.cpp` compiles freestanding for wasm32 with
clang — no Emscripten, no libc, 2 KB of output — and takes over the heaviest loop
in the app, rejection-sampling |ψ|² for the orbital clouds. It imports its
transcendental functions *from the host's Math object* rather than linking a libm,
which means the kernel and the JavaScript reference produce **bit-identical**
results. That equivalence is asserted in the tests, so the fast path can never
silently drift from the readable one. Measured speedup is a modest 1.36×; the real
win is a swappable, verifiable fast path. Loading fails soft: no WebAssembly, no
binary, or a blocked fetch all fall back to JavaScript and change nothing but the
timing.

```bash
npm run build:wasm     # only needed when the C++ changes; the .wasm is committed
```

**A Python cross-validation harness.** `tools/validate/reference.py` reimplements
the chemistry, physics and biology independently — different language, written from
the science, standard library only, no numpy — and `check.py` diffs it against the
JavaScript engines. This catches what same-language unit tests structurally cannot:
a misremembered constant or a transcription slip would have to occur *identically*
in two independent implementations to survive. Currently 22 checks, all agreeing,
including exact-rational equation balancing, Hodgkin–Huxley integration and
hydrogenic radial normalisation.

```bash
npm run test:cross
```

**A command palette.** ⌘K (or `/`) searches every tool, all 118 elements, the
constants, the formula sheets, molecules, crystals, orbitals and anatomical
structures in one box — so finding "iron" or "Planck constant" or "aorta" does not
require knowing which subject owns it.

## Design notes

- **Colour is never the only cue.** The element category palette was solved for maximum
  separation between neighbouring blocks and validated for colour-vision deficiency
  (worst adjacent pair ΔE 13.2 CVD / 19.3 normal vision, in both light and dark themes).
  Every cell still carries its symbol and number, the legend repeats the category in
  text, and a sortable text table holds the same data.
- **Glass surfaces, with legibility non-negotiable.** Panels are frosted — blurred,
  saturated backdrops with a lit top edge — but the translucency is kept low enough
  that text contrast never depends on what happens to sit behind a panel. Where a
  browser cannot blur, the fallback is an opaque panel rather than an unreadable
  transparent one.
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
    lib/molecule-core.js    VSEPR geometry builder, molecule and lattice data
    lib/orbital-core.js     hydrogenic wavefunctions and sampling
    lib/three-stage.js      shared three.js scene, controls and disposal
    lib/physics-core.js     SUVAT, projectiles, circuits, optics, decay
    lib/biology-core.js     central dogma, Mendelian and population genetics
    lib/anatomy-core.js     Weibel airways, cardiac cycle, Hodgkin-Huxley, B-DNA
    lib/body-core.js        whole-body structures, systems, spine and rib geometry
    lib/wasm-kernels.js     WebAssembly kernel loading, with JavaScript fallback
    lib/command-palette.js  the cross-workspace search index
    lib/chart.js            inline-SVG plotting with a crosshair readout
    lib/ui.js               DOM helpers, number formatting, tool scaffold
    modules/{physics,chemistry,biology}.js
    modules/chem3d.js       3D molecule, lattice and orbital viewers
    modules/bio3d.js        beating heart, airway tree, action potential, helix
    modules/body3d.js       whole-body explorer with system layers and picking
assets/anatomy/             optional scanned meshes (empty; see its README)
wasm/orbital.cpp            C++ compute kernel (freestanding wasm32)
assets/wasm/orbital.wasm    the compiled kernel, committed
tools/build-wasm.sh         clang build script
tools/validate/             Python reference implementation + cross-check runner
vendor/three/               three.js r185 + OrbitControls + GLTFLoader (vendored)
tests/
  run-tests.mjs             engine tests (no dependencies)
  layout.mjs                browser checks (needs Playwright)
```

The calculation engines are deliberately DOM-free, so they can be tested under node and
reused elsewhere.

## Tests

```bash
npm test              # 70 engine tests, no dependencies
npm run test:cross    # 22 JavaScript-vs-Python cross-language checks
npm run test:browser  # renders all 34 tools, checks errors, WebGL canvases and label collisions
```

The browser suite needs Playwright and a server running on port 8899; it skips itself if
Playwright isn't installed. It runs Chromium with SwiftShader so the WebGL views are
still tested on machines without a GPU.

## Accuracy

Atomic weights follow IUPAC standard values, and physical constants use the 2019 SI
redefinition. The tools assume idealised conditions — no air resistance on projectiles,
ideal gas behaviour, complete dominance and independent assortment in genetics crosses —
and each tool says so where it matters. Predicted electron configurations follow the
aufbau order, so the handful of experimental exceptions (Cr, Cu, Pd…) are labelled as
predicted rather than measured. The 3D views need WebGL; where it is unavailable the
tools say so and still show every measurement, since the numbers come from the engine
rather than the renderer.
