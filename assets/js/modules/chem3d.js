/**
 * 3D chemistry: molecular shapes, crystal lattices and atomic orbitals.
 *
 * Every model is generated from the measured or calculated values in
 * molecule-core.js and orbital-core.js — nothing here is a decorative shape.
 * The numbers that produced each model are shown alongside it.
 */

import { h, card, select, result, table, note, clear, fmt, prettyFormula } from "../lib/ui.js";
import {
  createStage, atomMesh, bondMesh, labelSprite, dashedLine, THREE,
} from "../lib/three-stage.js";
import {
  MOLECULES, MOLECULES_BY_ID, buildMolecule, atomColor, vdwRadius,
  LATTICES, LATTICES_BY_ID, expandLattice, latticeBonds, length, sub, add, scale,
} from "../lib/molecule-core.js";
import {
  ORBITALS, ORBITALS_BY_ID, angularSurface, densityCloud, mostProbableRadius,
  radialNodes, radialProbability,
} from "../lib/orbital-core.js";
import { lineChart } from "../lib/chart.js";

const ACCENT = "var(--chem)";
const PHASE_POSITIVE = "#3987e5";
const PHASE_NEGATIVE = "#e66767";

/* ------------------------------------------------------------------ *
 * Molecule viewer
 * ------------------------------------------------------------------ */

/** Covalent-radius display sizes for ball-and-stick (Å, scaled down for clarity). */
const BALL_RADII = {
  H: 0.32, C: 0.44, N: 0.42, O: 0.40, F: 0.38, Cl: 0.52, Br: 0.58, I: 0.64,
  P: 0.56, S: 0.55, B: 0.48, Xe: 0.62,
};
const ballRadius = (element) => BALL_RADII[element] || 0.5;

function moleculeViewer() {
  const stage = createStage({ height: 440, distance: 8, caption: "Drag to rotate · scroll to zoom" });
  const details = h("div", { style: { display: "grid", gap: "1rem" } });

  const chooser = select(
    "Molecule",
    MOLECULES.map((m) => ({ value: m.id, label: `${m.name} — ${prettyFormula(m.formula)}` })),
    { value: "water", wide: true }
  );
  const styleChooser = select(
    "Model style",
    [
      { value: "ball", label: "Ball and stick" },
      { value: "space", label: "Space filling (van der Waals)" },
      { value: "wire", label: "Wireframe" },
    ],
    { value: "ball" }
  );
  const showLonePairs = select("Lone pairs", [
    { value: "on", label: "Show" },
    { value: "off", label: "Hide" },
  ], { value: "on" });
  const spin = select("Rotation", [
    { value: "on", label: "Auto-rotate" },
    { value: "off", label: "Still" },
  ], { value: "on" });

  function render() {
    const molecule = buildMolecule(MOLECULES_BY_ID.get(chooser.input.value));
    const style = styleChooser.input.value;
    const withLonePairs = showLonePairs.input.value === "on" && molecule.lonePairs.length > 0;

    if (!stage.unavailable) {
      stage.clear();
      stage.setAutoRotate(spin.input.value === "on");

      const radiusFor = (element) =>
        style === "space" ? vdwRadius(element) * 0.92 : style === "wire" ? 0.10 : ballRadius(element);

      molecule.atoms.forEach((atom) => {
        const mesh = atomMesh({
          position: atom.position,
          radius: radiusFor(atom.element),
          color: atomColor(atom.element),
        });
        stage.root.add(mesh);

        if (style !== "space") {
          const label = labelSprite(atom.element, { size: 0.62 });
          label.position.set(...add(atom.position, [0, radiusFor(atom.element) + 0.22, 0]));
          stage.root.add(label);
        }
      });

      if (style !== "space") {
        for (const bond of molecule.bonds) {
          const from = molecule.atoms[bond.a];
          const to = molecule.atoms[bond.b];
          // Multiple bonds are drawn as parallel rods, offset perpendicular to
          // the bond and to the view-neutral axis.
          const count = bond.aromatic ? 1 : Math.round(bond.order);
          const offsets = multipleBondOffsets(from.position, to.position, count, style === "wire" ? 0.10 : 0.13);
          for (const offset of offsets) {
            stage.root.add(
              bondMesh({
                from: add(from.position, offset),
                to: add(to.position, offset),
                radius: style === "wire" ? 0.035 : 0.085,
                colorFrom: atomColor(from.element),
                colorTo: atomColor(to.element),
              })
            );
          }
          if (bond.aromatic) {
            // Aromatic ring: a dashed inner contour rather than alternating bonds.
            stage.root.add(
              dashedLine([scale(from.position, 0.78), scale(to.position, 0.78)], { color: "#c98500", dashSize: 0.1, gapSize: 0.07 })
            );
          }
        }
      }

      if (withLonePairs) {
        for (const pair of molecule.lonePairs) {
          const cloud = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 20, 12),
            new THREE.MeshStandardMaterial({ color: new THREE.Color("#c56cf0"), transparent: true, opacity: 0.4, roughness: 0.6 })
          );
          cloud.position.set(...scale(pair.position, 1.35));
          stage.root.add(cloud);
        }
      }
      stage.frame(molecule.atoms.length > 8 ? 1.2 : 1.32);
    }

    clear(details).append(...moleculeFacts(molecule, withLonePairs));
  }

  for (const control of [chooser, styleChooser, showLonePairs, spin]) {
    control.input.addEventListener("change", render);
  }
  render();

  return h(
    "div",
    { style: { display: "grid", gap: "1.25rem" } },
    h(
      "section.card",
      { style: { "--card-accent": ACCENT } },
      h(
        "header.card-head",
        {},
        h("h3", {}, "Molecular shapes in 3D"),
        h("p.card-sub", {}, "Built from measured bond lengths and angles — the geometry you see is the geometry that was measured.")
      ),
      h(
        "div.card-body",
        {},
        h("div.field-grid", {}, chooser, styleChooser, showLonePairs, spin),
        stage.element,
        details
      )
    )
  );
}

/** Offsets for drawing a double or triple bond as parallel rods. */
function multipleBondOffsets(from, to, order, separation) {
  if (order <= 1) return [[0, 0, 0]];
  const axis = sub(to, from);
  // Any vector not parallel to the bond gives a usable perpendicular.
  const reference = Math.abs(axis[1]) < 0.9 * Math.hypot(...axis) ? [0, 1, 0] : [1, 0, 0];
  const perpendicular = normalizeVec(crossVec(axis, reference));
  if (order === 2) return [scale(perpendicular, separation), scale(perpendicular, -separation)];
  const second = normalizeVec(crossVec(axis, perpendicular));
  return [
    [0, 0, 0],
    scale(perpendicular, separation * 1.15),
    scale(second, separation * 1.15),
  ];
}

const crossVec = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalizeVec = (v) => {
  const l = Math.hypot(...v);
  return l === 0 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
};

function moleculeFacts(molecule, showingLonePairs) {
  const bondRows = [];
  const seen = new Set();
  for (const bond of molecule.bonds) {
    const from = molecule.atoms[bond.a].element;
    const to = molecule.atoms[bond.b].element;
    const key = `${from}-${to}-${bond.order}-${bond.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const count = molecule.bonds.filter(
      (other) =>
        molecule.atoms[other.a].element === from &&
        molecule.atoms[other.b].element === to &&
        other.order === bond.order &&
        other.length === bond.length
    ).length;
    bondRows.push([
      `${from}–${to}`,
      bond.aromatic ? "aromatic (1.5)" : bond.order === 2 ? "double" : bond.order === 3 ? "triple" : "single",
      `${fmt(bond.length, 4)} Å`,
      count,
    ]);
  }

  const angleRows = [];
  const seenAngles = new Set();
  for (const angle of molecule.angles) {
    const key = `${angle.label}-${angle.value.toFixed(2)}`;
    if (seenAngles.has(key)) continue;
    seenAngles.add(key);
    angleRows.push([angle.label, `${fmt(angle.value, 5)}°`]);
  }

  const measured = molecule.angle;

  return [
    h(
      "div.result-row",
      {},
      result("Shape", molecule.geometryLabel, "", ACCENT),
      result("Formula", prettyFormula(molecule.formula), "", ACCENT),
      result("Atoms", molecule.atoms.length, "", ACCENT),
      result("Polarity", molecule.polar ? "Polar" : "Non-polar", "", molecule.polar ? "var(--bio)" : ACCENT),
      showingLonePairs ? result("Lone pairs", molecule.lonePairs.length, "on the central atom", ACCENT) : null
    ),
    note(molecule.note, "info"),
    h("div.grid-2", {},
      card("Bond lengths", "Measured values used to place the atoms.", table(["Bond", "Order", "Length", "Count"], bondRows)),
      angleRows.length
        ? card(
            "Bond angles",
            measured
              ? `Measured at ${fmt(measured, 5)}° — read back off the built model, so the picture and the number agree.`
              : "Read back off the built model.",
            table(["Angle", "Value"], angleRows)
          )
        : null
    ),
  ].filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Crystal lattice viewer
 * ------------------------------------------------------------------ */

const LATTICE_BOND_CUTOFF = { diamond: 1.6, zincblende: 2.4 };

function latticeViewer() {
  const stage = createStage({ height: 440, distance: 16, caption: "Drag to rotate · scroll to zoom" });
  const details = h("div", { style: { display: "grid", gap: "1rem" } });

  const chooser = select(
    "Structure",
    LATTICES.map((l) => ({ value: l.id, label: `${l.name} — ${prettyFormula(l.formula)}` })),
    { value: "nacl", wide: true }
  );
  const repeatChooser = select("Cells", [
    { value: "1", label: "1 × 1 × 1 (unit cell)" },
    { value: "2", label: "2 × 2 × 2" },
    { value: "3", label: "3 × 3 × 3" },
  ], { value: "1" });
  const styleChooser = select("Radius", [
    { value: "small", label: "Ball and stick" },
    { value: "ionic", label: "Packed (relative sizes)" },
  ], { value: "small" });

  function render() {
    const lattice = LATTICES_BY_ID.get(chooser.input.value);
    const repeat = Number(repeatChooser.input.value);
    const atoms = expandLattice(lattice, repeat);
    const packed = styleChooser.input.value === "ionic";

    // Nearest-neighbour distance, measured from the generated positions.
    let nearest = Infinity;
    for (let i = 0; i < atoms.length; i += 1) {
      for (let j = i + 1; j < atoms.length; j += 1) {
        nearest = Math.min(nearest, length(sub(atoms[i].position, atoms[j].position)));
      }
    }

    if (!stage.unavailable) {
      stage.clear();
      const radiusOf = (element) => (packed ? vdwRadius(element) * 0.42 : Math.max(0.28, vdwRadius(element) * 0.2));

      for (const atom of atoms) {
        stage.root.add(
          atomMesh({
            position: atom.position,
            radius: radiusOf(atom.element),
            color: atomColor(atom.element),
            segments: atoms.length > 200 ? 16 : 28,
          })
        );
      }

      const cutoff = LATTICE_BOND_CUTOFF[lattice.id];
      if (cutoff && atoms.length <= 400) {
        for (const bond of latticeBonds(atoms, cutoff)) {
          stage.root.add(
            bondMesh({
              from: atoms[bond.a].position,
              to: atoms[bond.b].position,
              radius: 0.09,
              colorFrom: atomColor(atoms[bond.a].element),
              colorTo: atomColor(atoms[bond.b].element),
              segments: 12,
            })
          );
        }
      }

      // Unit-cell outline.
      const span = repeat * lattice.a;
      stage.root.add(...unitCellEdges(span));
      stage.frame(1.15);
    }

    clear(details).append(
      h(
        "div.result-row",
        {},
        result("Crystal system", lattice.system, "", ACCENT),
        result("Lattice parameter a", fmt(lattice.a, 5), "Å", ACCENT),
        result("Coordination", lattice.coordination, "", ACCENT),
        result("Nearest neighbour", fmt(nearest, 4), "Å", ACCENT),
        result("Atoms shown", atoms.length, "", ACCENT)
      ),
      note(lattice.note, "info"),
      card(
        "Basis",
        "Fractional coordinates of each site within the conventional cell — these, times a, give every atom position.",
        table(
          ["Element", "Sites per cell", "Fractional coordinates"],
          lattice.basis.map((entry) => [
            h("strong", { style: { color: atomColor(entry.element) } }, entry.element),
            entry.sites.length,
            h("span.mono", {}, entry.sites.map((s) => `(${s.join(", ")})`).join("  ")),
          ])
        )
      )
    );
  }

  for (const control of [chooser, repeatChooser, styleChooser]) {
    control.input.addEventListener("change", render);
  }
  render();

  return h(
    "div",
    { style: { display: "grid", gap: "1.25rem" } },
    h(
      "section.card",
      { style: { "--card-accent": ACCENT } },
      h(
        "header.card-head",
        {},
        h("h3", {}, "Crystal structures"),
        h("p.card-sub", {}, "Unit cells built from published lattice parameters. Nearest-neighbour distances are measured back off the generated positions.")
      ),
      h("div.card-body", {}, h("div.field-grid", {}, chooser, repeatChooser, styleChooser), stage.element, details)
    )
  );
}

function unitCellEdges(span) {
  const half = span / 2;
  const corners = [
    [-half, -half, -half], [half, -half, -half], [half, half, -half], [-half, half, -half],
    [-half, -half, half], [half, -half, half], [half, half, half], [-half, half, half],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return edges.map(([a, b]) => dashedLine([corners[a], corners[b]], { color: "#8b93b5", dashSize: 0.4, gapSize: 0.3 }));
}

/* ------------------------------------------------------------------ *
 * Orbital viewer
 * ------------------------------------------------------------------ */

function orbitalViewer() {
  const stage = createStage({ height: 460, distance: 14, caption: "Drag to rotate · scroll to zoom" });
  const details = h("div", { style: { display: "grid", gap: "1rem" } });

  const chooser = select(
    "Orbital",
    ORBITALS.map((o) => ({ value: o.id, label: o.label })),
    { value: "2pz", wide: true }
  );
  const modeChooser = select("View", [
    { value: "shape", label: "Angular shape |Y|" },
    { value: "density", label: "Probability cloud |ψ|²" },
  ], { value: "shape", wide: true });

  function render() {
    const orbital = ORBITALS_BY_ID.get(chooser.input.value);
    const mode = modeChooser.input.value;

    if (!stage.unavailable) {
      stage.clear();
      const object = mode === "shape" ? orbitalSurface(orbital) : orbitalCloud(orbital);
      stage.root.add(object);
      stage.frame(1.18, object);
      // Axes are added after framing so they do not pull the camera back.
      stage.root.add(...axisLines(mode === "shape" ? 1.5 : orbital.extent * 0.8));
    }

    const peak = mostProbableRadius(orbital);
    const nodes = radialNodes(orbital);
    const profile = Array.from({ length: 200 }, (_, i) => {
      const r = (orbital.extent * 1.1 * i) / 199;
      return { x: r, y: radialProbability(orbital, r) };
    });

    clear(details).append(
      h(
        "div.result-row",
        {},
        result("Quantum numbers", `n = ${orbital.n}, l = ${orbital.l}`, "", ACCENT),
        result("Most probable radius", fmt(peak, 4), "a₀", ACCENT),
        result("Radial nodes", nodes.length, `expected ${orbital.n - orbital.l - 1}`, ACCENT),
        result("Angular nodes", orbital.l, "", ACCENT),
        result("Max electrons", 2, "per orbital", ACCENT)
      ),
      note(orbital.note, "info"),
      lineChart({
        points: profile,
        color: "var(--chem)",
        xLabel: "distance from nucleus / a₀",
        yLabel: "radial probability r²|R|²",
        area: true,
        markers: [{ x: peak, y: radialProbability(orbital, peak), label: `peak ${fmt(peak, 3)} a₀` }],
        readout: (p) => `r ${fmt(p.x, 3)} a₀`,
        caption:
          nodes.length > 0
            ? `Radial probability. It falls to zero at ${nodes.map((n) => `${n} a₀`).join(" and ")} — the radial node${nodes.length > 1 ? "s" : ""}.`
            : "Radial probability distribution — the electron is most likely to be found at the peak.",
      }),
      h(
        "div.pt-legend",
        {},
        h("span.legend-chip", {}, h("span.swatch", { style: { background: PHASE_POSITIVE } }), "ψ positive"),
        h("span.legend-chip", {}, h("span.swatch", { style: { background: PHASE_NEGATIVE } }), "ψ negative"),
        h("span.legend-chip", {}, "The sign is the wavefunction's phase — it is what makes bonding and antibonding combinations possible")
      )
    );
  }

  for (const control of [chooser, modeChooser]) control.input.addEventListener("change", render);
  render();

  return h(
    "div",
    { style: { display: "grid", gap: "1.25rem" } },
    h(
      "section.card",
      { style: { "--card-accent": ACCENT } },
      h(
        "header.card-head",
        {},
        h("h3", {}, "Atomic orbitals"),
        h("p.card-sub", {}, "Exact hydrogenic wavefunctions: the shape view plots r = |Y(θ, φ)|, the cloud samples the real |ψ|² including its radial nodes.")
      ),
      h("div.card-body", {}, h("div.field-grid", {}, chooser, modeChooser), stage.element, details)
    )
  );
}

/** The angular shape r = |Y|, coloured by the sign of ψ. */
function orbitalSurface(orbital) {
  const { positions, phases, indices } = angularSurface(orbital, { segments: 96, scale: 2.6 });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  const colors = new Float32Array((positions.length / 3) * 3);
  const positive = new THREE.Color(PHASE_POSITIVE);
  const negative = new THREE.Color(PHASE_NEGATIVE);
  for (let i = 0; i < phases.length; i += 1) {
    const color = phases[i] > 0 ? positive : negative;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
    })
  );
}

/** Monte-Carlo sampled |ψ|² as a point cloud. */
function orbitalCloud(orbital) {
  const { points, phases } = densityCloud(orbital, { count: 14000, seed: 7 });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

  const colors = new Float32Array(phases.length * 3);
  const positive = new THREE.Color(PHASE_POSITIVE);
  const negative = new THREE.Color(PHASE_NEGATIVE);
  for (let i = 0; i < phases.length; i += 1) {
    const color = phases[i] > 0 ? positive : negative;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: orbital.extent * 0.03, vertexColors: true, transparent: true, opacity: 0.75, sizeAttenuation: true })
  );
}

function axisLines(extent) {
  return [
    dashedLine([[-extent, 0, 0], [extent, 0, 0]], { color: "#8b93b5", dashSize: extent * 0.08, gapSize: extent * 0.06 }),
    dashedLine([[0, -extent, 0], [0, extent, 0]], { color: "#8b93b5", dashSize: extent * 0.08, gapSize: extent * 0.06 }),
    dashedLine([[0, 0, -extent], [0, 0, extent]], { color: "#8b93b5", dashSize: extent * 0.08, gapSize: extent * 0.06 }),
  ];
}

export const CHEM3D_TOOLS = [
  { id: "molecules3d", label: "3D molecules", glyph: "🧊", render: moleculeViewer },
  { id: "lattices", label: "Crystal structures", glyph: "💎", render: latticeViewer },
  { id: "orbitals", label: "Atomic orbitals", glyph: "🌀", render: orbitalViewer },
];
