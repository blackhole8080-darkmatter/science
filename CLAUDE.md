# Working on Science Lab

Interactive biology, physics and chemistry workspace. Vanilla ES modules, no
framework, no build step for the app itself. Open `index.html` through a server
and it runs.

## Commands

```bash
npm start              # static server on :8899 (ES modules need http, not file://)
npm test               # 70 engine tests, no dependencies
npm run test:cross     # 22 JavaScript-vs-Python cross-language checks (needs python3)
npm run test:browser   # renders all 34 tools in Chromium (needs Playwright + server)
npm run test:all       # all three
npm run build:preview  # single self-contained HTML in dist/
npm run build:wasm     # only when wasm/*.cpp changes; the .wasm is committed
```

## Architecture

```
assets/js/lib/*-core.js   calculation engines — pure, DOM-free, testable under node
assets/js/modules/*.js    the UI for each subject; imports engines, never duplicates them
assets/js/lib/ui.js       h() DOM helper, formatting, the `tool()` scaffold
assets/js/lib/three-stage.js  shared three.js scene: disposal, frame loop, theme
wasm/*.cpp                C++ kernels, freestanding wasm32 via clang (no Emscripten)
tools/validate/           independent Python reimplementation + cross-check runner
```

Engines are DOM-free **on purpose**. Anything that computes belongs in a
`*-core.js`; anything that renders belongs in a module. Keeping that line is what
makes the test suite possible.

## Rules that are load-bearing

These are not style preferences — breaking them has caused real bugs here.

1. **The renderer is downstream of the model.** Compute first, then draw what the
   numbers say. The heart's valves open because atrial pressure exceeds
   ventricular, not because a keyframe says so. Never animate a result.

2. **Derive geometry from measured data, then measure it back.** Molecules are
   built from experimental bond lengths and angles, and the app re-measures the
   angles off the generated coordinates so the picture and the printed number
   cannot drift apart. Do the same for anything new.

3. **State the fidelity.** Every tool says what it assumes (no air resistance,
   ideal gas, complete dominance). A model that looks quantitative but isn't must
   say so on screen.

4. **Colour is never the only cue.** The element palette was solved for
   colour-vision deficiency (worst adjacent pair ΔE 13.2 CVD / 19.3 normal, both
   themes). If you add a categorical palette, validate it and pair it with text.

5. **Dispose WebGL.** `three-stage.js` registers every stage and the shell calls
   `disposeAllStages()` before clearing a view. Without it each visit leaks a
   context until the browser starts dropping the oldest and canvases go black.

6. **The WASM kernel must stay bit-identical to its JS reference.** It imports
   `exp`/`sin`/`cos`/`acos`/`atan2` from the host's `Math` rather than linking a
   libm precisely so this holds. Do not add `-ffast-math` — it permits FP
   reassociation and breaks the equivalence the tests assert.

7. **Anatomy assets have a licence.** Before adding any mesh to
   `assets/anatomy/`, read that folder's README. CC BY-SA share-alike is viral,
   and a model with no stated licence is not free to use however public it looks.

## Testing expectations

New engine code ships with tests in `tests/run-tests.mjs`. Prefer assertions
against **published values** over self-consistency: NaCl's nearest neighbour is
2.820 Å, the 1s orbital peaks at one Bohr radius, ejection fraction is 58%. If a
result can be checked in a second language, add it to `tools/validate/`.

New 3D tools go in the `ROUTES` map in `tests/layout.mjs`, which asserts a WebGL
canvas actually appears rather than silently falling back.

## Style

Match the surrounding code. Comments explain *why*, not what — the codebase
leans on them to carry the science (why the cube root in Weibel's model, why the
lungs are asymmetric). British spelling in prose and UI copy. No emoji in code.

## Context

- `README.md` — what each tool does and why the models are trustworthy
- `docs/ARCHITECTURE.md` — the blueprint for scaling this into a research platform
- PR #1 tracks the `claude/science-ai-tool-multisubject-p3kmeb` branch
