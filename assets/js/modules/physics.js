/**
 * Physics workspace: motion, dynamics, electricity, optics, thermal and nuclear
 * tools plus the constant and formula references.
 */

import { h, svg, tool, card, field, select, result, table, note, steps, fmt, sci, subscript } from "../lib/ui.js";
import { lineChart } from "../lib/chart.js";
import {
  G, solveSuvat, projectile, combineResistors, ohmsLaw, refract, thinLens, decay, heatTransfer,
} from "../lib/physics-core.js";
import { CONSTANTS, FORMULA_SHEETS } from "../data/reference.js";

const ACCENT = "var(--phys)";
const num = (input) => {
  const raw = input.value.trim();
  return raw === "" ? NaN : Number(raw);
};

/* ------------------------------------------------------------ Motion ---- */

function suvatTool() {
  return tool({
    title: "SUVAT motion solver",
    subtitle: "Enter any three quantities — the other two are derived, with the rearrangement shown.",
    accent: ACCENT,
    fields: {
      u: field("Initial velocity u", { unit: "m·s⁻¹", value: "0" }),
      v: field("Final velocity v", { unit: "m·s⁻¹", value: "" }),
      a: field("Acceleration a", { unit: "m·s⁻²", value: "9.81" }),
      s: field("Displacement s", { unit: "m", value: "" }),
      t: field("Time t", { unit: "s", value: "3" }),
    },
    compute(inputs) {
      const { values, workings } = solveSuvat({
        u: num(inputs.u), v: num(inputs.v), a: num(inputs.a), s: num(inputs.s), t: num(inputs.t),
      });
      const labels = { u: ["Initial velocity", "m·s⁻¹"], v: ["Final velocity", "m·s⁻¹"], a: ["Acceleration", "m·s⁻²"], s: ["Displacement", "m"], t: ["Time", "s"] };

      const graph = lineChart({
        points: sampleVelocity(values),
        color: ACCENT,
        xLabel: "time / s",
        yLabel: "velocity / m·s⁻¹",
        area: true,
        readout: (p) => `t ${fmt(p.x, 3)} s → v ${fmt(p.y, 3)} m/s`,
        caption: "Velocity–time graph. The shaded area equals the displacement s.",
      });

      return [
        h("div.result-row", {}, Object.entries(labels).map(([key, [label, unit]]) => result(label, fmt(values[key]), unit, ACCENT))),
        workings.length ? steps(workings.map((w) => ({ text: w.text, math: w.math }))) : note("Nothing to derive — all five values were supplied.", "info"),
        graph,
      ];
    },
  });
}

function sampleVelocity({ u, a, t }) {
  const duration = Math.abs(t) < 1e-9 ? 1 : t;
  return Array.from({ length: 41 }, (_, i) => {
    const time = (duration * i) / 40;
    return { x: time, y: u + a * time };
  });
}

function projectileTool() {
  return tool({
    title: "Projectile motion",
    subtitle: "Drag-free trajectory from a launch speed, angle and release height.",
    accent: ACCENT,
    fields: {
      speed: field("Launch speed", { unit: "m·s⁻¹", value: "25" }),
      angle: field("Launch angle", { unit: "°", value: "40" }),
      height: field("Release height", { unit: "m", value: "1.5" }),
      gravity: field("Gravity g", { unit: "m·s⁻²", value: String(G) }),
    },
    compute(inputs) {
      const data = projectile({
        speed: num(inputs.speed),
        angleDeg: num(inputs.angle),
        height: num(inputs.height) || 0,
        gravity: num(inputs.gravity) || G,
      });

      const apexPoint = data.trajectory.reduce((best, p) => (p.y > best.y ? p : best));
      const plot = lineChart({
        points: data.trajectory.map((p) => ({ x: p.x, y: p.y })),
        color: ACCENT,
        xLabel: "horizontal distance / m",
        yLabel: "height / m",
        area: true,
        markers: [
          { x: apexPoint.x, y: apexPoint.y, label: `apex ${fmt(data.apex, 3)} m` },
          { x: data.range, y: 0, label: `range ${fmt(data.range, 3)} m` },
        ],
        readout: (p) => `x ${fmt(p.x, 3)} m, y ${fmt(p.y, 3)} m`,
        caption: "Parabolic path. Air resistance is neglected, so horizontal velocity stays constant.",
      });

      return [
        h(
          "div.result-row",
          {},
          result("Range", fmt(data.range), "m", ACCENT),
          result("Max height", fmt(data.apex), "m", ACCENT),
          result("Time of flight", fmt(data.flightTime), "s", ACCENT),
          result("Impact speed", fmt(data.impactSpeed), "m·s⁻¹", ACCENT)
        ),
        plot,
        table(
          ["Component", "Value", "Behaviour"],
          [
            ["Horizontal uₓ = u cos θ", `${fmt(data.ux)} m·s⁻¹`, "Constant — no horizontal force"],
            ["Vertical u_y = u sin θ", `${fmt(data.uy)} m·s⁻¹`, "Decreases at g until the apex, then reverses"],
            ["Time to apex", `${fmt(data.timeToApex)} s`, "u_y / g"],
          ]
        ),
      ];
    },
  });
}

/* ---------------------------------------------------- Dynamics & energy -- */

function dynamicsTool() {
  return tool({
    title: "Force, work and energy",
    subtitle: "Newton's second law with the work–energy and momentum quantities that follow from it.",
    accent: ACCENT,
    fields: {
      mass: field("Mass m", { unit: "kg", value: "1200" }),
      accel: field("Acceleration a", { unit: "m·s⁻²", value: "2.5" }),
      distance: field("Distance moved", { unit: "m", value: "80" }),
      velocity: field("Speed v", { unit: "m·s⁻¹", value: "20" }),
      heightGain: field("Height gained", { unit: "m", value: "0" }),
      time: field("Time taken", { unit: "s", value: "8" }),
    },
    compute(inputs) {
      const m = num(inputs.mass);
      const a = num(inputs.accel);
      const d = num(inputs.distance);
      const v = num(inputs.velocity);
      const dh = num(inputs.heightGain) || 0;
      const t = num(inputs.time);
      if (!(m > 0)) throw new Error("Mass must be positive");

      const force = m * a;
      const work = force * d;
      const kinetic = 0.5 * m * v ** 2;
      const potential = m * G * dh;
      const momentum = m * v;
      const power = t > 0 ? work / t : NaN;

      return [
        h(
          "div.result-row",
          {},
          result("Resultant force", fmt(force), "N", ACCENT),
          result("Work done", fmt(work), "J", ACCENT),
          result("Kinetic energy", fmt(kinetic), "J", ACCENT),
          result("Potential energy", fmt(potential), "J", ACCENT),
          result("Momentum", fmt(momentum), "kg·m·s⁻¹", ACCENT),
          result("Average power", fmt(power), "W", ACCENT)
        ),
        steps([
          { text: "Resultant force from Newton's second law", math: `F = ma = ${fmt(m)} × ${fmt(a)} = ${fmt(force)} N` },
          { text: "Work done by that force along the motion", math: `W = Fs = ${fmt(force)} × ${fmt(d)} = ${fmt(work)} J` },
          { text: "Kinetic energy at the stated speed", math: `Eₖ = ½mv² = ½ × ${fmt(m)} × ${fmt(v)}² = ${fmt(kinetic)} J` },
          { text: "Gravitational potential energy gained", math: `E_p = mgΔh = ${fmt(m)} × ${G} × ${fmt(dh)} = ${fmt(potential)} J` },
        ]),
      ];
    },
  });
}

/* -------------------------------------------------------------- Circuits - */

function circuitTool() {
  const resistors = field("Resistances (comma separated)", { type: "text", value: "220, 330, 470", unit: "Ω" });
  const mode = select("Arrangement", [
    { value: "series", label: "Series" },
    { value: "parallel", label: "Parallel" },
  ], { value: "series" });
  const supply = field("Supply voltage", { unit: "V", value: "12" });

  return tool({
    title: "Resistor network & Ohm's law",
    subtitle: "Combine resistors, then read off the current, power and per-resistor split.",
    accent: ACCENT,
    fields: { resistors, mode, supply },
    compute(inputs) {
      const values = inputs.resistors.value.split(/[,\s]+/).filter(Boolean).map(Number);
      if (values.some((v) => !Number.isFinite(v))) throw new Error("Resistances must be numbers separated by commas");
      const arrangement = inputs.mode.value;
      const total = combineResistors(values, arrangement);
      const V = num(inputs.supply);
      const { current, power } = ohmsLaw({ voltage: V, resistance: total });

      const rows = values.map((r, i) => {
        const branchCurrent = arrangement === "series" ? current : V / r;
        const branchVoltage = arrangement === "series" ? current * r : V;
        return [
          `R${subscript(i + 1)}`,
          `${fmt(r)} Ω`,
          `${fmt(branchVoltage)} V`,
          `${fmt(branchCurrent)} A`,
          `${fmt(branchVoltage * branchCurrent)} W`,
        ];
      });

      return [
        h(
          "div.result-row",
          {},
          result("Total resistance", fmt(total), "Ω", ACCENT),
          result("Supply current", fmt(current), "A", ACCENT),
          result("Total power", fmt(power), "W", ACCENT)
        ),
        circuitDiagram(values, arrangement, V),
        table(["Resistor", "Resistance", "p.d. across it", "Current through it", "Power"], rows),
        note(
          arrangement === "series"
            ? "In series the current is common and the p.d.s add up to the supply voltage."
            : "In parallel every branch sees the full supply voltage and the branch currents add up to the supply current.",
          "info"
        ),
      ];
    },
  });
}

/** Schematic of the resistor network, drawn to match the entered values. */
function circuitDiagram(values, mode, voltage) {
  const width = 520;
  const height = mode === "series" ? 150 : 60 + values.length * 46;
  const parts = [];
  const wire = (x1, y1, x2, y2) => svg("line", { x1, y1, x2, y2, stroke: "var(--phys)", "stroke-width": "2", "stroke-linecap": "round" });

  // Battery symbol on the left rail.
  parts.push(
    wire(40, 40, 40, height - 30),
    svg("line", { x1: 26, y1: height / 2 - 12, x2: 54, y2: height / 2 - 12, stroke: "var(--text)", "stroke-width": "3" }),
    svg("line", { x1: 34, y1: height / 2 + 2, x2: 46, y2: height / 2 + 2, stroke: "var(--text)", "stroke-width": "2" }),
    svg("text", { class: "diagram-label", x: 16, y: height / 2 + 22 }, `${fmt(voltage)} V`)
  );

  const resistorBox = (x, y, label) =>
    svg(
      "g",
      {},
      svg("rect", { x, y: y - 11, width: 54, height: 22, rx: 5, fill: "var(--phys-soft)", stroke: "var(--phys)", "stroke-width": "1.5" }),
      svg("text", { class: "diagram-label", x: x + 27, y: y + 4, "text-anchor": "middle" }, label)
    );

  if (mode === "series") {
    const y = 40;
    let x = 40;
    const gap = (width - 100) / values.length;
    values.forEach((r, i) => {
      parts.push(wire(x, y, x + gap - 54, y));
      parts.push(resistorBox(x + gap - 54, y, `${fmt(r)}Ω`));
      x += gap;
    });
    parts.push(wire(x, y, width - 30, y), wire(width - 30, y, width - 30, height - 30), wire(width - 30, height - 30, 40, height - 30));
  } else {
    values.forEach((r, i) => {
      const y = 46 + i * 46;
      parts.push(wire(40, y, 180, y), resistorBox(180, y, `${fmt(r)}Ω`), wire(234, y, width - 30, y));
    });
    parts.push(wire(width - 30, 46, width - 30, height - 30), wire(40, 46, 40, height - 30), wire(40, height - 30, width - 30, height - 30));
  }

  return h(
    "figure.figure",
    {},
    svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${mode} resistor network` }, parts),
    h("figcaption", {}, `${values.length} resistors in ${mode} across a ${fmt(voltage)} V supply.`)
  );
}

/* ---------------------------------------------------------------- Optics - */

function refractionTool() {
  return tool({
    title: "Refraction & total internal reflection",
    subtitle: "Snell's law with a ray diagram drawn to the calculated angles.",
    accent: ACCENT,
    fields: {
      n1: field("Refractive index n₁", { value: "1.00", hint: "air ≈ 1.00, water 1.33, glass 1.50" }),
      n2: field("Refractive index n₂", { value: "1.50" }),
      angle: field("Angle of incidence", { unit: "°", value: "35" }),
    },
    compute(inputs) {
      const n1 = num(inputs.n1);
      const n2 = num(inputs.n2);
      const angle = num(inputs.angle);
      const data = refract({ n1, n2, angleDeg: angle });

      return [
        h(
          "div.result-row",
          {},
          result("Refracted angle", data.totalInternalReflection ? "TIR" : `${fmt(data.refractedDeg)}°`, "", ACCENT),
          result("Critical angle", data.criticalAngle ? `${fmt(data.criticalAngle)}°` : "n/a", "", ACCENT),
          result("Speed in medium 1", sci(data.speed1), "m·s⁻¹", ACCENT),
          result("Speed in medium 2", sci(data.speed2), "m·s⁻¹", ACCENT)
        ),
        rayDiagram({ n1, n2, incident: angle, refracted: data.refractedDeg, tir: data.totalInternalReflection }),
        data.totalInternalReflection
          ? note(`Beyond the critical angle of ${fmt(data.criticalAngle)}° the ray is totally internally reflected — no light escapes into medium 2.`, "info")
          : note(
              n2 > n1
                ? "Entering the denser medium the ray slows and bends towards the normal."
                : "Entering the less dense medium the ray speeds up and bends away from the normal.",
              "info"
            ),
      ];
    },
  });
}

function rayDiagram({ n1, n2, incident, refracted, tir }) {
  const width = 520;
  const height = 260;
  const cx = width / 2;
  const cy = height / 2;
  const len = 130;
  const rad = (deg) => (deg * Math.PI) / 180;

  const incidentRay = { x: cx - len * Math.sin(rad(incident)), y: cy - len * Math.cos(rad(incident)) };
  const reflectRay = { x: cx + len * Math.sin(rad(incident)), y: cy - len * Math.cos(rad(incident)) };
  const outRay = tir
    ? reflectRay
    : { x: cx + len * Math.sin(rad(refracted)), y: cy + len * Math.cos(rad(refracted)) };

  return h(
    "figure.figure",
    {},
    svg(
      "svg",
      { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Ray diagram at the boundary" },
      svg("rect", { x: 0, y: cy, width, height: cy, fill: "var(--phys-soft)" }),
      svg("line", { x1: 0, y1: cy, x2: width, y2: cy, stroke: "var(--phys)", "stroke-width": "2" }),
      svg("line", { x1: cx, y1: 20, x2: cx, y2: height - 20, class: "grid-line", "stroke-dasharray": "5 5" }),
      svg("text", { class: "diagram-label", x: cx + 6, y: 30 }, "normal"),
      svg("text", { class: "diagram-label", x: 12, y: cy - 10 }, `medium 1 · n₁ = ${fmt(n1)}`),
      svg("text", { class: "diagram-label", x: 12, y: cy + 20 }, `medium 2 · n₂ = ${fmt(n2)}`),
      // incident ray
      svg("line", { x1: incidentRay.x, y1: incidentRay.y, x2: cx, y2: cy, stroke: "var(--ref)", "stroke-width": "2.5" }),
      svg("text", { class: "diagram-label", x: incidentRay.x, y: incidentRay.y - 6, "text-anchor": "middle" }, `θ₁ = ${fmt(incident)}°`),
      // refracted or reflected ray
      svg("line", {
        x1: cx, y1: cy, x2: outRay.x, y2: outRay.y,
        stroke: tir ? "var(--danger)" : "var(--chem)", "stroke-width": "2.5",
      }),
      svg(
        "text",
        { class: "diagram-label", x: outRay.x, y: outRay.y + (tir ? -8 : 16), "text-anchor": "middle" },
        tir ? "totally internally reflected" : `θ₂ = ${fmt(refracted)}°`
      ),
      // weak partial reflection when refraction happens
      !tir
        ? svg("line", { x1: cx, y1: cy, x2: reflectRay.x, y2: reflectRay.y, stroke: "var(--muted)", "stroke-width": "1.5", "stroke-dasharray": "4 4" })
        : null
    ),
    h("figcaption", {}, "Angles are measured from the normal and drawn to scale.")
  );
}

function lensTool() {
  return tool({
    title: "Thin lens imaging",
    subtitle: "Uses 1/f = 1/v − 1/u. A negative focal length describes a diverging lens.",
    accent: ACCENT,
    fields: {
      focalLength: field("Focal length f", { unit: "cm", value: "12" }),
      objectDistance: field("Object distance u", { unit: "cm", value: "30" }),
      objectHeight: field("Object height", { unit: "cm", value: "4" }),
    },
    compute(inputs) {
      const f = num(inputs.focalLength);
      const u = num(inputs.objectDistance);
      const hObject = num(inputs.objectHeight) || 1;
      const image = thinLens({ focalLength: f, objectDistance: u, objectHeight: hObject });

      return [
        h(
          "div.result-row",
          {},
          result("Image distance v", fmt(image.imageDistance), "cm", ACCENT),
          result("Magnification", fmt(image.magnification), "×", ACCENT),
          result("Image height", fmt(image.imageHeight), "cm", ACCENT),
          result("Nature", image.nature, "", ACCENT)
        ),
        lensDiagram({ f, u, hObject, image }),
        steps([
          { text: "Substitute into the thin lens equation", math: `1/v = 1/f + 1/u = 1/${fmt(f)} + 1/(−${fmt(u)})` },
          { text: "Invert to find the image distance", math: `v = ${fmt(image.imageDistance)} cm` },
          { text: "Magnification is the ratio of distances", math: `m = v/u = ${fmt(image.magnification)}` },
        ]),
      ];
    },
  });
}

function lensDiagram({ f, u, hObject, image }) {
  const width = 560;
  const height = 240;
  const axisY = height / 2;
  const lensX = width / 2;
  const span = Math.max(Math.abs(u), Math.abs(image.imageDistance), Math.abs(f) * 2) * 1.25;
  const scaleX = (width / 2 - 30) / span;
  const maxHeight = Math.max(Math.abs(hObject), Math.abs(image.imageHeight)) || 1;
  const scaleY = (height / 2 - 30) / maxHeight;

  const objectX = lensX - u * scaleX;
  const objectTop = axisY - hObject * scaleY;
  const imageX = lensX + image.imageDistance * scaleX;
  const imageTop = axisY - image.imageHeight * scaleY;
  const converging = f > 0;

  const arrow = (x, top, color, label) =>
    svg(
      "g",
      {},
      svg("line", { x1: x, y1: axisY, x2: x, y2: top, stroke: color, "stroke-width": "3", "stroke-linecap": "round" }),
      svg("polygon", {
        points: `${x - 5},${top + (top < axisY ? 8 : -8)} ${x + 5},${top + (top < axisY ? 8 : -8)} ${x},${top}`,
        fill: color,
      }),
      svg("text", { class: "diagram-label", x, y: top < axisY ? top - 6 : top + 14, "text-anchor": "middle" }, label)
    );

  const rays = Number.isFinite(imageX)
    ? [
        // parallel ray, refracted through the focal point
        svg("line", { x1: objectX, y1: objectTop, x2: lensX, y2: objectTop, stroke: "var(--ref)", "stroke-width": "1.6" }),
        svg("line", { x1: lensX, y1: objectTop, x2: imageX, y2: imageTop, stroke: "var(--ref)", "stroke-width": "1.6" }),
        // ray through the optical centre
        svg("line", { x1: objectX, y1: objectTop, x2: imageX, y2: imageTop, stroke: "var(--chem)", "stroke-width": "1.6", "stroke-dasharray": image.real ? "" : "5 4" }),
      ]
    : [];

  return h(
    "figure.figure",
    {},
    svg(
      "svg",
      { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Lens ray diagram" },
      svg("line", { x1: 10, y1: axisY, x2: width - 10, y2: axisY, class: "axis-line" }),
      // lens body
      svg("ellipse", {
        cx: lensX, cy: axisY, rx: converging ? 12 : 6, ry: height / 2 - 24,
        fill: "var(--phys-soft)", stroke: "var(--phys)", "stroke-width": "2",
      }),
      // focal points
      [-1, 1].map((sign) =>
        svg(
          "g",
          {},
          svg("circle", { cx: lensX + sign * Math.abs(f) * scaleX, cy: axisY, r: 3, fill: "var(--muted)" }),
          svg("text", { class: "diagram-label", x: lensX + sign * Math.abs(f) * scaleX, y: axisY + 16, "text-anchor": "middle" }, "F")
        )
      ),
      rays,
      arrow(objectX, objectTop, "var(--phys)", "object"),
      Number.isFinite(imageX) ? arrow(imageX, imageTop, image.real ? "var(--chem)" : "var(--bio)", image.real ? "real image" : "virtual image") : null
    ),
    h("figcaption", {}, `${converging ? "Converging" : "Diverging"} lens, f = ${fmt(f)} cm. Dashed rays are virtual (extrapolated backwards).`)
  );
}

/* --------------------------------------------------------------- Thermal - */

function thermalTool() {
  return tool({
    title: "Heat energy",
    subtitle: "Q = mcΔθ — leave exactly one box blank and it will be found.",
    accent: ACCENT,
    fields: {
      mass: field("Mass m", { unit: "kg", value: "0.5" }),
      specificHeat: field("Specific heat c", { unit: "J·kg⁻¹·K⁻¹", value: "4180", hint: "water 4180, aluminium 900, copper 385" }),
      deltaT: field("Temperature change Δθ", { unit: "K", value: "60" }),
      energy: field("Energy Q", { unit: "J", value: "" }),
    },
    compute(inputs) {
      const values = heatTransfer({
        mass: num(inputs.mass),
        specificHeat: num(inputs.specificHeat),
        deltaT: num(inputs.deltaT),
        energy: num(inputs.energy),
      });
      return [
        h(
          "div.result-row",
          {},
          result("Energy Q", fmt(values.energy), "J", ACCENT),
          result("Mass m", fmt(values.mass), "kg", ACCENT),
          result("Specific heat c", fmt(values.specificHeat), "J·kg⁻¹·K⁻¹", ACCENT),
          result("Δθ", fmt(values.deltaT), "K", ACCENT)
        ),
        note(`That is ${fmt(values.energy / 3.6e6, 3)} kW·h — a 2 kW kettle would take about ${fmt(values.energy / 2000, 3)} s to supply it.`, "info"),
      ];
    },
  });
}

function nuclearTool() {
  return tool({
    title: "Radioactive decay",
    subtitle: "Exponential decay N = N₀e^(−λt) with the decay curve.",
    accent: ACCENT,
    fields: {
      initial: field("Initial quantity N₀", { value: "1000" }),
      halfLife: field("Half-life", { unit: "s, min, yr…", value: "5730" }),
      time: field("Elapsed time", { unit: "same unit", value: "11460" }),
    },
    compute(inputs) {
      const initial = num(inputs.initial);
      const halfLife = num(inputs.halfLife);
      const time = num(inputs.time);
      const data = decay({ initial, halfLife, time });

      const span = Math.max(time, halfLife * 4);
      const points = Array.from({ length: 81 }, (_, i) => {
        const t = (span * i) / 80;
        return { x: t, y: initial * Math.exp(-data.lambda * t) };
      });

      return [
        h(
          "div.result-row",
          {},
          result("Remaining", fmt(data.remaining), "", ACCENT),
          result("Decayed", fmt(data.decayed), "", ACCENT),
          result("Half-lives elapsed", fmt(data.halfLivesElapsed), "", ACCENT),
          result("Decay constant λ", sci(data.lambda), "per unit time", ACCENT)
        ),
        lineChart({
          points,
          color: ACCENT,
          xLabel: "time",
          yLabel: "quantity remaining",
          area: true,
          markers: [{ x: time, y: data.remaining, label: `${fmt(data.fraction * 100, 3)}% left` }],
          readout: (p) => `t ${fmt(p.x, 3)} → N ${fmt(p.y, 4)}`,
          caption: "Each half-life halves whatever remains, so the curve never quite reaches zero.",
        }),
      ];
    },
  });
}

/* ------------------------------------------------------------ Reference -- */

function constantsCard() {
  const rows = CONSTANTS.filter((c) => c.subject === "physics").map((c) => [
    h("strong.mono", {}, c.symbol),
    c.name,
    h("span.mono", {}, sci(c.value, 6)),
    h("span.mono", {}, c.unit),
    c.exact ? h("span", { style: { color: "var(--chem)" } }, "exact") : "measured",
  ]);
  return card(
    "Physical constants",
    "SI values; 'exact' marks constants fixed by definition since the 2019 redefinition.",
    table(["Symbol", "Quantity", "Value", "Unit", "Status"], rows)
  );
}

function formulaCards() {
  return FORMULA_SHEETS.physics.map((sheet) =>
    card(sheet.topic, null, table(["Formula", "Meaning"], sheet.rows, { className: "formula-table" }))
  );
}

export default {
  id: "physics",
  label: "Physics",
  icon: "⚛",
  accent: "var(--phys)",
  accentSoft: "var(--phys-soft)",
  hero: {
    title: "Physics workspace",
    blurb:
      "Solve motion, electrical, optical, thermal and nuclear problems with the working shown at every step, and see the result drawn as a graph or ray diagram.",
    tags: ["SUVAT", "Projectiles", "Circuits", "Optics", "Thermal", "Decay"],
  },
  tools: [
    { id: "motion", label: "Motion (SUVAT)", glyph: "🚀", render: suvatTool },
    { id: "projectile", label: "Projectiles", glyph: "📈", render: projectileTool },
    { id: "dynamics", label: "Force & energy", glyph: "⚙", render: dynamicsTool },
    { id: "circuits", label: "Circuits", glyph: "🔌", render: circuitTool },
    { id: "refraction", label: "Refraction", glyph: "🔦", render: refractionTool },
    { id: "lenses", label: "Lenses", glyph: "🔍", render: lensTool },
    { id: "thermal", label: "Heat energy", glyph: "🔥", render: thermalTool },
    { id: "nuclear", label: "Radioactivity", glyph: "☢", render: nuclearTool },
    {
      id: "reference",
      label: "Constants & formulae",
      glyph: "📐",
      render: () => h("div.grid-2", {}, constantsCard(), formulaCards()),
    },
  ],
};
