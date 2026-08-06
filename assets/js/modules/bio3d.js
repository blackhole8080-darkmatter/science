/**
 * 3D human biology: the beating heart, the airway tree, the action potential
 * and the DNA double helix.
 *
 * Every model is driven by anatomy-core.js — Weibel's airway morphometry, the
 * measured cardiac cycle, the Hodgkin–Huxley equations and B-form DNA
 * parameters. The animations are the models running, not looped keyframes: the
 * heart valves open because the pressure gradient reverses, and the spike
 * travels because the equations produce it.
 */

import { h, card, select, field, result, table, note, clear, fmt } from "../lib/ui.js";
import { createStage, atomMesh, tubeMesh, labelSprite, THREE } from "../lib/three-stage.js";
import { lineChart } from "../lib/chart.js";
import {
  airwayTable, bronchialTree, WEIBEL,
  cardiacState, haemodynamics, CARDIAC,
  simulateActionPotential, findThreshold, HH,
  dnaHelix, B_DNA,
} from "../lib/anatomy-core.js";

const ACCENT = "var(--bio)";
const OXYGENATED = "#e04b4b"; // arterial blood
const DEOXYGENATED = "#4a6fd4"; // venous blood

const num = (input) => {
  const raw = input.value.trim();
  return raw === "" ? NaN : Number(raw);
};

/* ================================================================== *
 * The beating heart
 * ================================================================== */

function heartViewer() {
  const stage = createStage({ height: 480, distance: 26, caption: "Drag to rotate · the cycle runs in real time", autoRotate: false });
  const readout = h("div.result-row");
  const chartHost = h("div");

  const rateField = field("Heart rate", { unit: "bpm", value: "75" });
  const speedChooser = select("Playback", [
    { value: "1", label: "Real time" },
    { value: "0.35", label: "Slow motion" },
    { value: "0", label: "Paused — scrub below" },
  ], { value: "1" });
  const scrub = field("Cycle position", { type: "range", value: "0" });
  scrub.input.min = 0;
  scrub.input.max = 1;
  scrub.input.step = 0.005;

  let phase = 0;

  const parts = buildHeart();
  if (!stage.unavailable) {
    stage.root.add(parts.group);
    stage.frame(1.25);
  }

  /** Push the model to the state at cycle position `t`. */
  function apply(t) {
    const state = cardiacState(t);
    const rate = num(rateField.input) || CARDIAC.restingRate;

    if (!stage.unavailable) {
      // Ventricles contract; atria contract a quarter-cycle earlier.
      // Systole shortens the ventricle along its long axis and narrows it —
      // the wringing motion of real myocardium, approximated.
      const squeeze = 1 - 0.2 * state.contraction;
      parts.leftVentricle.scale.set(squeeze, 1 - 0.1 * state.contraction, squeeze);
      parts.rightVentricle.scale.set(squeeze, 1 - 0.1 * state.contraction, squeeze);
      const atrialSqueeze = 1 - 0.16 * Math.max(0, Math.sin((state.phase / 0.125) * Math.PI) * (state.phase < 0.125 ? 1 : 0));
      parts.leftAtrium.scale.setScalar(atrialSqueeze);
      parts.rightAtrium.scale.setScalar(atrialSqueeze);

      // Valves are driven by the pressure gradient, not by a script.
      setValve(parts.mitralValve, state.mitralOpen);
      setValve(parts.aorticValve, state.aorticOpen);
      setValve(parts.tricuspidValve, state.mitralOpen);
      setValve(parts.pulmonaryValve, state.aorticOpen);

      // Blood only moves through an open valve.
      parts.flow.forEach((particle) => {
        const open = particle.side === "in" ? state.mitralOpen : state.aorticOpen;
        particle.mesh.visible = open;
        if (open) {
          particle.t = (particle.t + 0.014) % 1;
          const point = particle.curve.getPointAt(particle.t);
          particle.mesh.position.copy(point);
        }
      });
    }

    clear(readout).append(
      result("Phase", state.label, "", ACCENT),
      result("Ventricular pressure", fmt(state.ventricularPressure, 4), "mmHg", ACCENT),
      result("Aortic pressure", fmt(state.aorticPressure, 4), "mmHg", ACCENT),
      result("Ventricular volume", fmt(state.ventricularVolume, 4), "mL", ACCENT),
      result("Mitral valve", state.mitralOpen ? "Open" : "Shut", "", state.mitralOpen ? "var(--ok)" : "var(--danger)"),
      result("Aortic valve", state.aorticOpen ? "Open" : "Shut", "", state.aorticOpen ? "var(--ok)" : "var(--danger)")
    );
    return { state, rate };
  }

  /** Wiggers diagram: the three pressures and the volume over one cycle. */
  function drawChart(marker) {
    const samples = Array.from({ length: 240 }, (_, i) => {
      const t = i / 239;
      return { t, ...cardiacState(t) };
    });
    clear(chartHost).append(
      lineChart({
        points: samples.map((s) => ({ x: s.t, y: s.ventricularPressure })),
        color: OXYGENATED,
        xLabel: "cycle position",
        yLabel: "ventricular pressure / mmHg",
        area: true,
        markers: [{ x: marker.phase, y: marker.ventricularPressure, label: "now" }],
        readout: (p) => `${fmt(p.x * 100, 3)}% → ${fmt(p.y, 4)} mmHg`,
        caption: "Left ventricular pressure through one cycle. The valves open and shut where this curve crosses the atrial and aortic pressures.",
      }),
      lineChart({
        points: samples.map((s) => ({ x: s.t, y: s.ventricularVolume })),
        color: DEOXYGENATED,
        xLabel: "cycle position",
        yLabel: "ventricular volume / mL",
        area: true,
        markers: [{ x: marker.phase, y: marker.ventricularVolume, label: "now" }],
        readout: (p) => `${fmt(p.x * 100, 3)}% → ${fmt(p.y, 4)} mL`,
        caption: "The flat stretches are the isovolumetric phases — both valves shut, so the volume cannot change however hard the muscle squeezes.",
      })
    );
  }

  let chartDue = 0;
  stage.onFrame?.((delta) => {
    const speed = Number(speedChooser.input.value);
    if (speed > 0) {
      const rate = num(rateField.input) || CARDIAC.restingRate;
      phase = (phase + (delta * speed) / (60 / rate)) % 1;
      scrub.input.value = String(phase);
    } else {
      phase = Number(scrub.input.value);
    }
    const { state } = apply(phase);
    chartDue -= delta;
    if (chartDue <= 0) {
      drawChart(state);
      chartDue = 0.25; // redrawing the SVG every frame would be wasteful
    }
  });

  scrub.input.addEventListener("input", () => {
    if (Number(speedChooser.input.value) === 0) {
      phase = Number(scrub.input.value);
      drawChart(apply(phase).state);
    }
  });
  rateField.input.addEventListener("input", () => drawChart(apply(phase).state));

  const stats = haemodynamics();
  drawChart(apply(0).state);

  return h(
    "div",
    { style: { display: "grid", gap: "1.25rem" } },
    h(
      "section.card",
      { style: { "--card-accent": ACCENT } },
      h(
        "header.card-head",
        {},
        h("h3", {}, "The cardiac cycle"),
        h("p.card-sub", {}, "A beating heart driven by measured chamber pressures. The valves are not animated — they open and shut because the pressure gradient across them reverses.")
      ),
      h(
        "div.card-body",
        {},
        h("div.field-grid", {}, rateField, speedChooser, scrub),
        stage.element,
        readout,
        chartHost,
        h(
          "div.result-row",
          {},
          result("Stroke volume", fmt(stats.strokeVolume), "mL", ACCENT),
          result("Cardiac output", fmt(stats.cardiacOutput, 3), "L·min⁻¹", ACCENT),
          result("Ejection fraction", fmt(stats.ejectionFraction, 3), "%", ACCENT)
        ),
        note(
          "Ejection fraction is stroke volume ÷ end-diastolic volume. A healthy heart ejects a little under 60% of what it holds — it never empties completely.",
          "info"
        )
      )
    )
  );
}

/** Chambers, great vessels, valves and blood particles. */
function buildHeart() {
  const group = new THREE.Group();

  /**
   * A ventricle: a cone-tipped ellipsoid, thick at the base and tapering to the
   * apex, which is what gives a heart its shape. Built as a lathe so the wall
   * profile is a single smooth surface.
   */
  const ventricle = (color, position, width, height, tilt) => {
    const profile = [];
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps; // 0 at the base, 1 at the apex
      // Half-ellipse for the upper body, tapering cubically towards the apex.
      const radius = width * Math.sin(Math.PI * (0.5 + t * 0.5)) * (1 - t ** 3 * 0.55);
      profile.push(new THREE.Vector2(Math.max(radius, 0.02), height * (0.5 - t)));
    }
    const mesh = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 40),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.52, metalness: 0.04 })
    );
    mesh.position.set(...position);
    mesh.rotation.z = tilt;
    group.add(mesh);
    return mesh;
  };

  const atrium = (color, position, radius) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 36, 24),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.55, metalness: 0.04 })
    );
    mesh.position.set(...position);
    mesh.scale.set(1, 0.82, 1);
    group.add(mesh);
    return mesh;
  };

  // The heart sits tilted, apex down and towards the anatomical left — which is
  // the viewer's right when facing the patient, the convention used here.
  const rightAtrium = atrium(DEOXYGENATED, [-2.9, 4.6, 0.4], 2.3);
  const leftAtrium = atrium(OXYGENATED, [2.9, 4.8, -0.4], 2.1);
  const rightVentricle = ventricle(DEOXYGENATED, [-2.4, 0.4, 0.8], 3.0, 9.5, 0.16);
  const leftVentricle = ventricle(OXYGENATED, [2.2, 0.0, -0.3], 3.5, 11.0, -0.2);

  // Great vessels. The aorta leaves the left ventricle and arches over the top.
  group.add(
    tubeMesh([[2.0, 4.2, -0.4], [1.6, 8.2, -0.4], [-0.4, 11.2, -0.8], [-3.4, 10.4, -0.8], [-3.8, 7.6, -0.8]], {
      radius: 1.05, color: OXYGENATED,
    }),
    tubeMesh([[-2.6, 4.4, 0.8], [-2.2, 8.4, 1.2], [0.4, 10.0, 2.2]], { radius: 0.9, color: DEOXYGENATED }),
    tubeMesh([[-3.2, 6.4, 0.6], [-3.0, 9.8, 0.8]], { radius: 0.78, color: DEOXYGENATED }),
    tubeMesh([[3.6, 6.2, -0.6], [4.0, 9.2, -0.8]], { radius: 0.62, color: OXYGENATED })
  );

  const label = (text, position) => {
    const sprite = labelSprite(text, { size: 1.15 });
    sprite.position.set(...position);
    group.add(sprite);
    return sprite;
  };
  label("left atrium", [6.2, 5.6, 0]);
  label("left ventricle", [7.0, -4.2, 0]);
  label("right atrium", [-6.4, 5.8, 0]);
  label("right ventricle", [-7.0, -3.4, 0]);
  label("aorta", [-5.6, 11.8, -0.8]);
  label("pulmonary artery", [4.6, 10.2, 2.2]);

  const valve = (position, radius, color) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.3, 26),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3, metalness: 0.2, transparent: true })
    );
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  };
  const mitralValve = valve([2.6, 3.0, -0.4], 1.25, "#f0e6a0");
  const tricuspidValve = valve([-2.7, 3.0, 0.6], 1.25, "#f0e6a0");
  const aorticValve = valve([2.0, 4.4, -0.4], 0.92, "#ffd9a0");
  const pulmonaryValve = valve([-2.6, 4.6, 0.8], 0.86, "#ffd9a0");

  // Blood particles: mitral inflow, then ejection up the aortic arch.
  const inflowCurve = new THREE.CatmullRomCurve3(
    [[2.9, 5.6, -0.4], [2.7, 3.0, -0.4], [2.4, 0.4, -0.3], [2.2, -3.2, -0.3]].map((p) => new THREE.Vector3(...p))
  );
  const outflowCurve = new THREE.CatmullRomCurve3(
    [[2.2, -2.0, -0.3], [2.0, 2.0, -0.4], [1.6, 8.2, -0.4], [-0.4, 11.2, -0.8], [-3.4, 10.4, -0.8], [-3.8, 7.6, -0.8]].map((p) => new THREE.Vector3(...p))
  );

  const flow = [];
  for (let i = 0; i < 10; i += 1) {
    for (const [curve, side] of [[inflowCurve, "in"], [outflowCurve, "out"]]) {
      const mesh = atomMesh({ position: [0, 0, 0], radius: 0.3, color: OXYGENATED, segments: 12 });
      group.add(mesh);
      flow.push({ mesh, curve, side, t: i / 10 });
    }
  }

  return { group, leftAtrium, leftVentricle, rightAtrium, rightVentricle, mitralValve, aorticValve, tricuspidValve, pulmonaryValve, flow };
}

/** An open valve is thin and transparent; a shut one is a solid disc. */
function setValve(mesh, open) {
  mesh.scale.set(open ? 0.25 : 1, 1, open ? 0.25 : 1);
  mesh.material.opacity = open ? 0.35 : 1;
}

/* ================================================================== *
 * The airway tree
 * ================================================================== */

function airwayViewer() {
  const stage = createStage({ height: 460, distance: 30, caption: "Drag to rotate · scroll to zoom" });
  const details = h("div", { style: { display: "grid", gap: "1rem" } });

  const depthChooser = select(
    "Generations shown",
    [4, 6, 8, 10].map((d) => ({ value: String(d), label: `0 – ${d}  (${2 ** (d + 1) - 1} airways)` })),
    { value: "8" }
  );

  function render() {
    const depth = Number(depthChooser.input.value);
    const tree = bronchialTree({ depth });

    if (!stage.unavailable) {
      stage.clear();
      // One merged geometry per generation keeps the draw calls low.
      for (let generation = 0; generation <= depth; generation += 1) {
        const inThisGeneration = tree.segments.filter((s) => s.generation === generation);
        if (!inThisGeneration.length) continue;
        const shade = generation / Math.max(depth, 1);
        const color = new THREE.Color(DEOXYGENATED).lerp(new THREE.Color("#ff9ecb"), shade);
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.03 });
        for (const segment of inThisGeneration) {
          const from = new THREE.Vector3(...segment.from);
          const to = new THREE.Vector3(...segment.to);
          const direction = to.clone().sub(from);
          const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(segment.radius, segment.radius * 0.92, direction.length(), 10),
            material
          );
          mesh.position.copy(from).add(direction.clone().multiplyScalar(0.5));
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
          stage.root.add(mesh);
        }
      }
      stage.frame(1.15);
    }

    const rows = airwayTable(WEIBEL.generations);
    const shown = rows.slice(0, depth + 1);

    clear(details).append(
      h(
        "div.result-row",
        {},
        result("Airways drawn", 2 ** (depth + 1) - 1, "", ACCENT),
        result("Narrowest shown", fmt(shown.at(-1).diameter, 3), "cm", ACCENT),
        result("Cross-section here", fmt(shown.at(-1).totalCrossSection, 4), "cm²", ACCENT),
        result("At the alveoli", fmt(rows.at(-1).totalCrossSection, 4), "cm²", ACCENT)
      ),
      lineChart({
        points: rows.map((r) => ({ x: r.generation, y: r.totalCrossSection })),
        color: "var(--bio)",
        xLabel: "generation",
        yLabel: "total cross-sectional area / cm²",
        area: true,
        markers: [{ x: WEIBEL.terminalBronchiole, y: rows[WEIBEL.terminalBronchiole].totalCrossSection, label: "terminal bronchiole" }],
        readout: (p) => `generation ${fmt(p.x, 2)} → ${fmt(p.y, 4)} cm²`,
        caption:
          "Each airway is narrower than its parent, yet the total cross-section rises steeply — because the number of tubes doubles while the area of each falls by only 2^(−2/3).",
      }),
      note(
        "That rising area is what makes breathing possible. Air slows almost to a standstill by the terminal bronchioles, so the last few millimetres are crossed by diffusion alone — which is fast enough only because the area is enormous.",
        "info"
      ),
      card(
        "Weibel's morphometry",
        "Diameter and length both scale by 2^(−1/3) per generation — the ratio that minimises the work of moving air for a given volume of tissue.",
        table(
          ["Gen", "Name", "Count", "Diameter / cm", "Length / cm", "Total area / cm²", "Zone"],
          rows
            .filter((r) => r.generation <= 5 || r.generation % 4 === 0 || r.generation === WEIBEL.terminalBronchiole || r.generation === WEIBEL.generations)
            .map((r) => [
              r.generation,
              r.name,
              r.count.toLocaleString(),
              fmt(r.diameter, 3),
              fmt(r.length, 3),
              fmt(r.totalCrossSection, 4),
              h("span", { style: { color: r.zone === "conducting" ? "var(--phys)" : "var(--bio)" } }, r.zone),
            ])
        )
      )
    );
  }

  depthChooser.input.addEventListener("change", render);
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
        h("h3", {}, "The airway tree"),
        h("p.card-sub", {}, "Grown from Weibel's model: every branch's length and width come from the generation number, not from a drawing.")
      ),
      h("div.card-body", {}, h("div.field-grid", {}, depthChooser), stage.element, details)
    )
  );
}

/* ================================================================== *
 * The action potential
 * ================================================================== */

function actionPotentialViewer() {
  const stage = createStage({ height: 320, distance: 30, caption: "The spike travels as the equations produce it", autoRotate: false });
  const chartHost = h("div");
  const readout = h("div.result-row");

  const stimulusField = field("Stimulus current", { unit: "µA·cm⁻²", value: "10", hint: "threshold is about 6.9" });
  const speedChooser = select("Playback", [
    { value: "0.35", label: "Slow motion" },
    { value: "1", label: "Real time" },
    { value: "0", label: "Paused" },
  ], { value: "0.35" });

  const axon = buildAxon();
  if (!stage.unavailable) {
    stage.root.add(axon.group);
    stage.frame(1.1);
  }

  let simulation = simulateActionPotential({ stimulus: 10 });
  let clock = 0;
  const duration = 40; // ms simulated

  function recompute() {
    const stimulus = num(stimulusField.input);
    simulation = simulateActionPotential({ stimulus: Number.isFinite(stimulus) ? stimulus : 10 });
    clock = 0;
    drawChart();
  }

  function drawChart() {
    const threshold = findThreshold();
    clear(chartHost).append(
      lineChart({
        points: simulation.trace.map((s) => ({ x: s.t, y: s.v })),
        color: simulation.fired ? "var(--bio)" : "var(--muted)",
        xLabel: "time / ms",
        yLabel: "membrane potential / mV",
        readout: (p) => `${fmt(p.x, 3)} ms → ${fmt(p.y, 4)} mV`,
        caption: simulation.fired
          ? "A full spike: sodium channels open and the potential overshoots zero, then potassium repolarises it past rest into the refractory dip."
          : "Below threshold the membrane simply leaks back to rest — no spike. The response is all-or-nothing, never partial.",
      }),
      lineChart({
        points: simulation.trace.map((s) => ({ x: s.t, y: s.m })),
        color: "#e04b4b",
        xLabel: "time / ms",
        yLabel: "Na⁺ activation (m)",
        area: true,
        readout: (p) => `${fmt(p.x, 3)} ms → m = ${fmt(p.y, 3)}`,
        caption: "The sodium activation gate. It opens fast and then inactivates — which is what makes the spike brief and self-terminating.",
      })
    );
    clear(readout).append(
      result("Fired", simulation.fired ? "Yes" : "No", "", simulation.fired ? "var(--ok)" : "var(--muted)"),
      result("Peak potential", fmt(simulation.peak, 4), "mV", ACCENT),
      result("Resting potential", HH.restingPotential, "mV", ACCENT),
      result("Threshold current", fmt(threshold, 3), "µA·cm⁻²", ACCENT)
    );
  }

  stage.onFrame?.((delta) => {
    const speed = Number(speedChooser.input.value);
    if (speed > 0) clock = (clock + delta * 1000 * speed) % duration;
    if (stage.unavailable) return;

    // Each node of Ranvier lights up as the wavefront reaches it, and its colour
    // tracks the membrane potential the model computed for that moment.
    axon.nodes.forEach((node, index) => {
      const lag = index * 1.6; // ms of conduction delay between nodes
      const local = clock - lag;
      const sample = sampleTrace(simulation.trace, local);
      const excitation = Math.max(0, (sample - HH.restingPotential) / (simulation.peak - HH.restingPotential || 1));
      node.material.color.copy(new THREE.Color("#3b4a7a").lerp(new THREE.Color("#ffe066"), excitation));
      node.material.emissive.copy(new THREE.Color("#ffcc33").multiplyScalar(excitation * 0.8));
      node.scale.setScalar(1 + excitation * 0.5);
    });
  });

  stimulusField.input.addEventListener("input", recompute);
  drawChart();

  return h(
    "div",
    { style: { display: "grid", gap: "1.25rem" } },
    h(
      "section.card",
      { style: { "--card-accent": ACCENT } },
      h(
        "header.card-head",
        {},
        h("h3", {}, "The action potential"),
        h("p.card-sub", {}, "The Hodgkin–Huxley equations integrated live. Lower the stimulus below threshold and the spike disappears entirely — it does not shrink.")
      ),
      h(
        "div.card-body",
        {},
        h("div.field-grid", {}, stimulusField, speedChooser),
        stage.element,
        readout,
        chartHost,
        note(
          "Hodgkin and Huxley fitted these equations to the squid giant axon in 1952, before anyone had seen an ion channel. The gates in the model turned out to be real proteins.",
          "info"
        )
      )
    )
  );
}

/** Read the membrane potential at time `t` ms, or rest if outside the trace. */
function sampleTrace(trace, t) {
  if (t < 0 || t > trace.at(-1).t) return HH.restingPotential;
  const index = Math.min(trace.length - 1, Math.round((t / trace.at(-1).t) * (trace.length - 1)));
  return trace[index].v;
}

/** A myelinated axon: soma, dendrites, myelin segments and nodes of Ranvier. */
function buildAxon() {
  const group = new THREE.Group();
  const nodes = [];

  const soma = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 32, 20),
    new THREE.MeshStandardMaterial({ color: new THREE.Color("#9085e9"), roughness: 0.5 })
  );
  soma.position.set(-22, 0, 0);
  group.add(soma);

  // Dendrites: a small recursive tuft, so the cell reads as a neuron.
  const dendrite = (origin, direction, length, depth) => {
    if (depth === 0) return;
    const end = [origin[0] + direction[0] * length, origin[1] + direction[1] * length, origin[2] + direction[2] * length];
    group.add(tubeMesh([origin, end], { radius: 0.18 * depth, color: "#9085e9", radialSegments: 6 }));
    for (const spread of [-0.5, 0.5]) {
      dendrite(end, [direction[0] * Math.cos(spread) - direction[1] * Math.sin(spread), direction[0] * Math.sin(spread) + direction[1] * Math.cos(spread), direction[2] + spread * 0.2], length * 0.65, depth - 1);
    }
  };
  dendrite([-22, 0, 0], [-0.8, 0.6, 0], 4, 3);
  dendrite([-22, 0, 0], [-0.8, -0.6, 0], 4, 3);

  // Axon with alternating myelin sheaths and exposed nodes.
  const segments = 9;
  for (let i = 0; i < segments; i += 1) {
    const x = -18 + i * 4.4;
    group.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 3.4, 16),
        new THREE.MeshStandardMaterial({ color: new THREE.Color("#dfe3f5"), roughness: 0.6 })
      ).translateX(x).rotateZ(Math.PI / 2)
    );
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 18, 12),
      new THREE.MeshStandardMaterial({ color: new THREE.Color("#3b4a7a"), roughness: 0.4, emissive: new THREE.Color("#000000") })
    );
    node.position.set(x + 2.2, 0, 0);
    group.add(node);
    nodes.push(node);
  }
  group.add(tubeMesh([[-19.6, 0, 0], [22, 0, 0]], { radius: 0.42, color: "#6d78a8", radialSegments: 10 }));

  const terminal = labelSprite("axon terminal", { size: 3.4 });
  terminal.position.set(22, 2.4, 0);
  group.add(terminal);

  return { group, nodes };
}

/* ================================================================== *
 * The double helix
 * ================================================================== */

const BASE_COLORS = { A: "#e66767", T: "#3987e5", G: "#c98500", C: "#199e70" };

function dnaViewer() {
  const stage = createStage({ height: 480, distance: 90, caption: "Drag to rotate · scroll to zoom" });
  const details = h("div", { style: { display: "grid", gap: "1rem" } });

  const sequenceField = field("Sequence", {
    type: "text",
    value: "ATGCGCTAGCTAGGCATCGATCGTACGATCGAT",
    hint: "A, T, G and C — anything else is ignored",
  });

  function render() {
    let helix;
    try {
      helix = dnaHelix(sequenceField.input.value);
    } catch (error) {
      clear(details).append(note(error.message, "error"));
      return;
    }

    if (!stage.unavailable) {
      stage.clear();
      // Backbones as smooth tubes through the phosphate positions.
      stage.root.add(
        tubeMesh(helix.strandA.map((p) => p.position), { radius: 1.5, color: "#8b93b5", radialSegments: 10 }),
        tubeMesh(helix.strandB.map((p) => p.position), { radius: 1.5, color: "#5f6a94", radialSegments: 10 })
      );

      // Each base pair is a rod, split so both halves carry their own base colour.
      for (const pair of helix.pairs) {
        const from = new THREE.Vector3(...pair.from);
        const to = new THREE.Vector3(...pair.to);
        const middle = from.clone().add(to).multiplyScalar(0.5);
        for (const [a, b, base] of [
          [from, middle, pair.base],
          [middle, to, pair.partner],
        ]) {
          const direction = b.clone().sub(a);
          const rod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.62, 0.62, direction.length(), 10),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(BASE_COLORS[base]), roughness: 0.45 })
          );
          rod.position.copy(a).add(direction.clone().multiplyScalar(0.5));
          rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
          stage.root.add(rod);
        }
      }
      stage.frame(1.1);
    }

    const bondCount = helix.pairs.reduce((sum, p) => sum + p.hydrogenBonds, 0);
    clear(details).append(
      h(
        "div.result-row",
        {},
        result("Base pairs", helix.pairs.length, "", ACCENT),
        result("Length", fmt(helix.length, 4), "Å", ACCENT),
        result("Complete turns", fmt(helix.turns, 3), "", ACCENT),
        result("GC content", fmt(helix.gcContent, 3), "%", ACCENT),
        result("Hydrogen bonds", bondCount, "", ACCENT)
      ),
      h(
        "div.pt-legend",
        {},
        Object.entries(BASE_COLORS).map(([base, color]) =>
          h("span.legend-chip", {}, h("span.swatch", { style: { background: color } }), base)
        )
      ),
      note(
        `Built to B-form parameters: ${B_DNA.rise} Å rise per base pair, ${B_DNA.twist}° of twist, ${fmt(360 / B_DNA.twist, 3)} base pairs per turn and a ${B_DNA.radius * 2} Å diameter. The two backbones sit ${B_DNA.strandOffset}° apart rather than opposite each other, and that asymmetry is exactly why one groove is wide and the other narrow — the major groove is where most DNA-binding proteins read the sequence.`,
        "info"
      ),
      card(
        "Base pairing",
        "G–C pairs are held by three hydrogen bonds and A–T by two, which is why GC-rich DNA needs more heat to separate.",
        table(
          ["Pair", "Bonds", "Count"],
          ["A–T", "G–C"].map((label) => {
            const isGC = label === "G–C";
            const count = helix.pairs.filter((p) => (p.base === "G" || p.base === "C") === isGC).length;
            return [label, isGC ? 3 : 2, count];
          })
        )
      )
    );
  }

  sequenceField.input.addEventListener("input", render);
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
        h("h3", {}, "The DNA double helix"),
        h("p.card-sub", {}, "Your sequence built at crystallographic B-form dimensions — every ångström is the measured value.")
      ),
      h("div.card-body", {}, h("div.field-grid", {}, sequenceField), stage.element, details)
    )
  );
}

export const BIO3D_TOOLS = [
  { id: "heart", label: "Beating heart", glyph: "🫀", render: heartViewer },
  { id: "airways", label: "Airway tree", glyph: "🫁", render: airwayViewer },
  { id: "neuron", label: "Action potential", glyph: "⚡", render: actionPotentialViewer },
  { id: "helix", label: "DNA helix", glyph: "🧬", render: dnaViewer },
];
