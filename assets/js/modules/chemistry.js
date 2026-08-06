/**
 * Chemistry workspace: the interactive periodic table, mole and solution
 * calculators, an equation balancer, gas laws, pH and the formula reference.
 */

import {
  h, svg, tool, card, field, select, result, table, note, steps, bar, clear,
  fmt, sci, prettyFormula,
} from "../lib/ui.js";
import { ELEMENTS, CATEGORIES, BY_SYMBOL, electronConfiguration, shellOccupancy, gridPosition } from "../data/elements.js";
import { CONSTANTS, FORMULA_SHEETS } from "../data/reference.js";
import { molarMass, composition, balanceEquation, atomTally, empiricalFormula, formatFormula } from "../lib/chemistry-core.js";
import { CHEM3D_TOOLS } from "./chem3d.js";

const ACCENT = "var(--chem)";
const R = 8.314462618;
const N_A = 6.02214076e23;
const num = (input) => {
  const raw = input.value.trim();
  return raw === "" ? NaN : Number(raw);
};

/* -------------------------------------------------- Periodic table ------ */

function periodicTable() {
  const detail = h("div.card-body");
  const grid = h("div.ptable");
  const hidden = new Set();
  let activeSymbol = "C";
  let query = "";

  const search = field("Search by name, symbol or number", { type: "text", placeholder: "e.g. iron, Fe, 26" });
  search.input.addEventListener("input", () => {
    query = search.input.value.trim().toLowerCase();
    const hit = ELEMENTS.find(
      (e) => e.symbol.toLowerCase() === query || e.name.toLowerCase() === query || String(e.number) === query
    );
    if (hit) selectElement(hit.symbol);
    paint();
  });

  const legend = h(
    "div.pt-legend",
    {},
    Object.entries(CATEGORIES).map(([key, meta]) =>
      h(
        "button.legend-chip",
        {
          type: "button",
          "aria-pressed": "true",
          title: `Show or hide ${meta.label}s`,
          onClick(event) {
            const pressed = event.currentTarget.getAttribute("aria-pressed") === "true";
            event.currentTarget.setAttribute("aria-pressed", String(!pressed));
            if (pressed) hidden.add(key);
            else hidden.delete(key);
            paint();
          },
        },
        h("span.swatch", { style: { background: meta.color } }),
        meta.label
      )
    )
  );

  const cells = new Map();
  for (const element of ELEMENTS) {
    const { row, col } = gridPosition(element);
    const cell = h(
      "button.pt-cell",
      {
        type: "button",
        style: { gridRow: row, gridColumn: col, background: element.color },
        title: `${element.name} — ${CATEGORIES[element.category].label}`,
        onClick: () => selectElement(element.symbol),
      },
      h("span.pt-num", {}, element.number),
      h("span.pt-sym", {}, element.symbol),
      h("span.pt-mass", {}, fmt(element.mass, 4))
    );
    cells.set(element.symbol, cell);
    grid.append(cell);
  }
  // Labels marking where the f-block strips belong.
  grid.append(
    h("div.pt-cell", { style: { gridRow: 6, gridColumn: 3, background: "var(--line-soft)", color: "var(--muted)", cursor: "default" } }, h("span.pt-sym", { style: { fontSize: "0.6rem" } }, "57–71")),
    h("div.pt-cell", { style: { gridRow: 7, gridColumn: 3, background: "var(--line-soft)", color: "var(--muted)", cursor: "default" } }, h("span.pt-sym", { style: { fontSize: "0.6rem" } }, "89–103"))
  );

  function paint() {
    for (const element of ELEMENTS) {
      const cell = cells.get(element.symbol);
      const matchesQuery =
        !query ||
        element.symbol.toLowerCase().includes(query) ||
        element.name.toLowerCase().includes(query) ||
        String(element.number).startsWith(query) ||
        CATEGORIES[element.category].label.toLowerCase().includes(query);
      const visible = !hidden.has(element.category) && matchesQuery;
      cell.classList.toggle("is-dim", !visible);
      cell.classList.toggle("is-active", element.symbol === activeSymbol);
    }
  }

  function selectElement(symbol) {
    activeSymbol = symbol;
    const element = BY_SYMBOL.get(symbol);
    clear(detail).append(elementDetail(element));
    paint();
  }

  selectElement(activeSymbol);
  paint();

  return h(
    "div.grid-2",
    { style: { gridTemplateColumns: "1fr" } },
    h(
      "section.card",
      { style: { "--card-accent": ACCENT } },
      h(
        "header.card-head",
        {},
        h("h3", {}, "Interactive periodic table"),
        h("p.card-sub", {}, "All 118 elements, coloured by category. Click a cell for its full profile, or filter with the legend.")
      ),
      h("div.card-body", {}, h("div.ptable-controls", {}, search), legend, h("div.ptable-scroll", {}, grid))
    ),
    h("section.card", { style: { "--card-accent": ACCENT } }, h("header.card-head", {}, h("h3", {}, "Element profile")), detail),
    elementTableCard()
  );
}

function elementDetail(element) {
  const shells = shellOccupancy(element.number);
  return h(
    "div.element-detail",
    {},
    h(
      "div.element-tile",
      { style: { background: element.color } },
      h("div.num", {}, element.number),
      h("div.sym", {}, element.symbol),
      h("div.mass", {}, fmt(element.mass, 5))
    ),
    h(
      "div",
      {},
      h("h4", { style: { marginBottom: "0.5rem" } }, `${element.name} · ${CATEGORIES[element.category].label}`),
      h(
        "dl.element-facts",
        {},
        fact("Atomic number", element.number),
        fact("Relative atomic mass", fmt(element.mass, 5)),
        fact("Group", element.group ?? "f-block"),
        fact("Period", element.period),
        fact("Block", `${element.block}-block`),
        fact("Shell occupancy", shells.join(", ")),
        fact("Configuration (predicted)", electronConfiguration(element.number)),
        fact("Mass of one atom", `${sci(element.mass / N_A, 4)} g`)
      ),
      bohrDiagram(element, shells)
    )
  );
}

function fact(label, value) {
  return h("div.fact", {}, h("dt", {}, label), h("dd", {}, String(value)));
}

/** Simple shell model — a teaching diagram, not an orbital picture. */
function bohrDiagram(element, shells) {
  const size = 210;
  const centre = size / 2;
  const maxRadius = centre - 14;
  const rings = shells.map((count, index) => {
    const radius = ((index + 1) / shells.length) * maxRadius;
    const electrons = Array.from({ length: Math.min(count, 32) }, (_, i) => {
      const angle = (i / Math.min(count, 32)) * Math.PI * 2 - Math.PI / 2;
      return svg("circle", { cx: centre + radius * Math.cos(angle), cy: centre + radius * Math.sin(angle), r: 2.6, fill: element.color });
    });
    return svg(
      "g",
      {},
      svg("circle", { cx: centre, cy: centre, r: radius, fill: "none", stroke: "var(--line)", "stroke-width": "1" }),
      electrons,
      svg("text", { class: "axis-text", x: centre + radius + 2, y: centre - 4 }, count)
    );
  });

  return h(
    "figure.figure",
    { style: { marginTop: "0.75rem" } },
    svg(
      "svg",
      { viewBox: `0 0 ${size} ${size}`, style: "max-width:230px;margin:0 auto", role: "img", "aria-label": `Shell model of ${element.name}` },
      rings,
      svg("circle", { cx: centre, cy: centre, r: 11, fill: element.color }),
      svg("text", { x: centre, y: centre + 4, "text-anchor": "middle", class: "diagram-label", style: "fill:#08101f;font-weight:700" }, element.symbol)
    ),
    h("figcaption", {}, `Shell model: ${shells.join(" · ")} electrons`)
  );
}

/** The same data as a sortable text table — the non-colour route into the dataset. */
function elementTableCard() {
  const body = h("div.card-body");
  let sortKey = "number";
  let ascending = true;

  const render = () => {
    const rows = [...ELEMENTS]
      .sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
        return ascending ? cmp : -cmp;
      })
      .map((e) => [
        e.number,
        h("strong.mono", { style: { color: e.color } }, e.symbol),
        e.name,
        fmt(e.mass, 5),
        CATEGORIES[e.category].label,
        e.group ?? "—",
        e.period,
        `${e.block}-block`,
      ]);

    const headers = [
      ["number", "Z"], ["symbol", "Symbol"], ["name", "Name"], ["mass", "Mass"],
      ["category", "Category"], ["group", "Group"], ["period", "Period"], ["block", "Block"],
    ].map(([key, label]) =>
      h(
        "button.legend-chip",
        {
          type: "button",
          onClick: () => {
            if (sortKey === key) ascending = !ascending;
            else {
              sortKey = key;
              ascending = true;
            }
            clear(body).append(render());
          },
        },
        label,
        sortKey === key ? (ascending ? " ▲" : " ▼") : ""
      )
    );

    return h("div", { style: { display: "grid", gap: "0.75rem" } }, h("div.pt-legend", {}, headers), table(
      ["Z", "Symbol", "Name", "Mass", "Category", "Group", "Period", "Block"],
      rows
    ));
  };

  body.append(render());
  return h(
    "section.card",
    { style: { "--card-accent": ACCENT } },
    h("header.card-head", {}, h("h3", {}, "Element data table"), h("p.card-sub", {}, "Every element as sortable text — click a header chip to sort.")),
    body
  );
}

/* ------------------------------------------------------ Mole calculator - */

function molarMassTool() {
  return tool({
    title: "Molar mass & composition",
    subtitle: "Handles brackets and hydrates: (NH4)2SO4, CuSO4·5H2O, [Cu(NH3)4]SO4.",
    accent: ACCENT,
    fields: {
      formula: field("Chemical formula", { type: "text", value: "CuSO4.5H2O" }),
      mass: field("Sample mass (optional)", { unit: "g", value: "25" }),
    },
    compute(inputs) {
      const formula = inputs.formula.value.trim();
      const M = molarMass(formula);
      const parts = composition(formula);
      const sample = num(inputs.mass);
      const moles = Number.isFinite(sample) ? sample / M : NaN;

      return [
        h(
          "div.result-row",
          {},
          result("Molar mass", fmt(M, 6), "g·mol⁻¹", ACCENT),
          result("Formula", prettyFormula(formula), "", ACCENT),
          Number.isFinite(moles) ? result("Moles in sample", fmt(moles, 5), "mol", ACCENT) : null,
          Number.isFinite(moles) ? result("Particles", sci(moles * N_A, 4), "", ACCENT) : null
        ),
        bar(parts.map((p) => ({ label: p.symbol, percent: p.percent, color: p.color }))),
        table(
          ["Element", "Atoms", "Aᵣ", "Mass contribution", "% by mass"],
          parts.map((p) => [
            h("span", { style: { color: p.color, fontWeight: "600" } }, `${p.symbol} — ${p.name}`),
            p.count,
            fmt(p.atomicMass, 5),
            `${fmt(p.mass, 5)} g·mol⁻¹`,
            `${fmt(p.percent, 4)} %`,
          ])
        ),
        Number.isFinite(moles)
          ? steps([
              { text: "Moles from mass and molar mass", math: `n = m / M = ${fmt(sample)} / ${fmt(M, 6)} = ${fmt(moles, 5)} mol` },
              { text: "Particles from the Avogadro constant", math: `N = n × N_A = ${sci(moles * N_A, 4)}` },
            ])
          : null,
      ];
    },
  });
}

function balancerTool() {
  return tool({
    title: "Equation balancer",
    subtitle: "Balances by solving the element-conservation matrix exactly — no trial and error.",
    accent: ACCENT,
    fields: {
      equation: field("Unbalanced equation", { type: "text", value: "KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2", hint: "Separate species with + and sides with ->" }),
    },
    compute(inputs) {
      const balanced = balanceEquation(inputs.equation.value);
      const { reactants, products, coefficients } = balanced;
      const side = (species, offset) =>
        species.map((formula, i) => {
          const c = coefficients[offset + i];
          return h("span", {}, i ? " + " : "", c === 1 ? "" : h("b", { style: { color: "var(--chem)" } }, c), prettyFormula(formula));
        });

      const tally = atomTally(balanced);
      const totalMassLeft = reactants.reduce((sum, f, i) => sum + molarMass(f) * coefficients[i], 0);
      const totalMassRight = products.reduce((sum, f, i) => sum + molarMass(f) * coefficients[reactants.length + i], 0);

      return [
        h(
          "div.result",
          { style: { "--result-accent": ACCENT } },
          h("div.result-label", {}, "Balanced equation"),
          h("div.result-value", { style: { fontSize: "1.05rem", lineHeight: "1.6" } }, side(reactants, 0), "  →  ", side(products, reactants.length))
        ),
        table(
          ["Element", "Atoms on the left", "Atoms on the right", "Balanced?"],
          tally.map((t) => [
            h("strong", { style: { color: BY_SYMBOL.get(t.symbol).color } }, t.symbol),
            t.left,
            t.right,
            t.left === t.right ? h("span", { style: { color: "var(--ok)" } }, "✓ yes") : h("span", { style: { color: "var(--danger)" } }, "✗ no"),
          ])
        ),
        note(
          `Mass is conserved: ${fmt(totalMassLeft, 6)} g·mol⁻¹ of reactants gives ${fmt(totalMassRight, 6)} g·mol⁻¹ of products.`,
          "ok"
        ),
      ];
    },
  });
}

function stoichiometryTool() {
  return tool({
    title: "Reacting masses",
    subtitle: "Balance a reaction, then scale one species to find the mass of another.",
    accent: ACCENT,
    fields: {
      equation: field("Equation", { type: "text", value: "CH4 + O2 -> CO2 + H2O" }),
      known: field("Known species", { type: "text", value: "CH4" }),
      knownMass: field("Mass of that species", { unit: "g", value: "16" }),
      target: field("Species to find", { type: "text", value: "CO2" }),
    },
    compute(inputs) {
      const balanced = balanceEquation(inputs.equation.value);
      const species = [...balanced.reactants, ...balanced.products];
      const normalise = (s) => s.replace(/\s+/g, "");
      const knownIndex = species.findIndex((s) => normalise(s) === normalise(inputs.known.value));
      const targetIndex = species.findIndex((s) => normalise(s) === normalise(inputs.target.value));
      if (knownIndex === -1) throw new Error(`"${inputs.known.value}" is not in the equation`);
      if (targetIndex === -1) throw new Error(`"${inputs.target.value}" is not in the equation`);

      const knownFormula = species[knownIndex];
      const targetFormula = species[targetIndex];
      const knownM = molarMass(knownFormula);
      const targetM = molarMass(targetFormula);
      const knownMoles = num(inputs.knownMass) / knownM;
      const ratio = balanced.coefficients[targetIndex] / balanced.coefficients[knownIndex];
      const targetMoles = knownMoles * ratio;
      const targetMass = targetMoles * targetM;

      return [
        h(
          "div.result-row",
          {},
          result(`Moles of ${prettyFormula(knownFormula)}`, fmt(knownMoles, 5), "mol", ACCENT),
          result("Mole ratio", `${balanced.coefficients[knownIndex]} : ${balanced.coefficients[targetIndex]}`, "", ACCENT),
          result(`Moles of ${prettyFormula(targetFormula)}`, fmt(targetMoles, 5), "mol", ACCENT),
          result(`Mass of ${prettyFormula(targetFormula)}`, fmt(targetMass, 5), "g", ACCENT)
        ),
        steps([
          { text: `Balanced equation`, math: balancedText(balanced) },
          { text: `Moles of the known species`, math: `n = m / M = ${fmt(num(inputs.knownMass))} / ${fmt(knownM, 5)} = ${fmt(knownMoles, 5)} mol` },
          { text: `Scale by the mole ratio from the equation`, math: `n(${targetFormula}) = ${fmt(knownMoles, 5)} × ${fmt(ratio, 4)} = ${fmt(targetMoles, 5)} mol` },
          { text: `Convert back to a mass`, math: `m = nM = ${fmt(targetMoles, 5)} × ${fmt(targetM, 5)} = ${fmt(targetMass, 5)} g` },
        ]),
      ];
    },
  });
}

function balancedText({ reactants, products, coefficients }) {
  const side = (species, offset) =>
    species.map((f, i) => `${coefficients[offset + i] === 1 ? "" : coefficients[offset + i]}${f}`).join(" + ");
  return `${side(reactants, 0)} → ${side(products, reactants.length)}`;
}

function empiricalTool() {
  return tool({
    title: "Empirical & molecular formula",
    subtitle: "From percentage composition (or masses) plus an optional relative molecular mass.",
    accent: ACCENT,
    fields: {
      data: field("Composition", { type: "text", value: "C 40.0, H 6.7, O 53.3", hint: "symbol then % or grams, comma separated" }),
      mr: field("Relative molecular mass (optional)", { value: "180" }),
    },
    compute(inputs) {
      const parts = inputs.data.value
        .split(",")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const [symbol, amount] = chunk.split(/[\s:]+/);
          const value = Number(amount);
          if (!symbol || !Number.isFinite(value)) throw new Error(`Could not read "${chunk}" — write it as "C 40.0"`);
          return { symbol, amount: value };
        });

      const empirical = empiricalFormula(parts);
      const formula = formatFormula(empirical);
      const empiricalMass = molarMass(formula);
      const mr = num(inputs.mr);
      const multiple = Number.isFinite(mr) ? Math.round(mr / empiricalMass) : null;
      const molecular = multiple && multiple > 1
        ? formatFormula(empirical.map((p) => ({ ...p, subscript: p.subscript * multiple })))
        : formula;

      return [
        h(
          "div.result-row",
          {},
          result("Empirical formula", prettyFormula(formula), "", ACCENT),
          result("Empirical mass", fmt(empiricalMass, 5), "g·mol⁻¹", ACCENT),
          multiple ? result("Molecular formula", prettyFormula(molecular), "", ACCENT) : null,
          multiple ? result("Units per molecule", multiple, "×", ACCENT) : null
        ),
        table(
          ["Element", "Amount", "÷ Aᵣ = moles", "Simplest ratio"],
          empirical.map((p, i) => [
            h("strong", { style: { color: BY_SYMBOL.get(p.symbol).color } }, p.symbol),
            fmt(parts[i].amount, 4),
            fmt(p.moles, 5),
            p.subscript,
          ])
        ),
      ];
    },
  });
}

/* ------------------------------------------------------------- Solutions - */

function solutionTool() {
  return tool({
    title: "Concentration & dilution",
    subtitle: "Convert between moles, concentration and volume, then dilute with c₁V₁ = c₂V₂.",
    accent: ACCENT,
    fields: {
      formula: field("Solute", { type: "text", value: "NaCl" }),
      mass: field("Mass of solute", { unit: "g", value: "5.85" }),
      volume: field("Solution volume", { unit: "cm³", value: "250" }),
      dilutedVolume: field("Diluted to (optional)", { unit: "cm³", value: "1000" }),
    },
    compute(inputs) {
      const M = molarMass(inputs.formula.value.trim());
      const mass = num(inputs.mass);
      const volume = num(inputs.volume) / 1000; // dm³
      if (!(volume > 0)) throw new Error("Volume must be positive");
      const moles = mass / M;
      const concentration = moles / volume;
      const dilutedVolume = num(inputs.dilutedVolume) / 1000;
      const dilutedConcentration = Number.isFinite(dilutedVolume) && dilutedVolume > 0 ? (concentration * volume) / dilutedVolume : NaN;

      return [
        h(
          "div.result-row",
          {},
          result("Molar mass", fmt(M, 5), "g·mol⁻¹", ACCENT),
          result("Moles of solute", fmt(moles, 5), "mol", ACCENT),
          result("Concentration", fmt(concentration, 5), "mol·dm⁻³", ACCENT),
          Number.isFinite(dilutedConcentration) ? result("After dilution", fmt(dilutedConcentration, 5), "mol·dm⁻³", ACCENT) : null
        ),
        steps([
          { text: "Moles of solute", math: `n = m / M = ${fmt(mass)} / ${fmt(M, 5)} = ${fmt(moles, 5)} mol` },
          { text: "Concentration in mol per dm³", math: `c = n / V = ${fmt(moles, 5)} / ${fmt(volume, 4)} = ${fmt(concentration, 5)} mol·dm⁻³` },
          Number.isFinite(dilutedConcentration)
            ? { text: "Dilution keeps the moles constant", math: `c₂ = c₁V₁ / V₂ = ${fmt(dilutedConcentration, 5)} mol·dm⁻³` }
            : null,
        ].filter(Boolean)),
        note(`That is ${fmt(concentration * M, 5)} g·dm⁻³ by mass concentration.`, "info"),
      ];
    },
  });
}

function gasTool() {
  return tool({
    title: "Ideal gas law",
    subtitle: "pV = nRT — leave one of pressure, volume, moles or temperature blank.",
    accent: ACCENT,
    fields: {
      pressure: field("Pressure p", { unit: "kPa", value: "101.3" }),
      volume: field("Volume V", { unit: "dm³", value: "24" }),
      moles: field("Amount n", { unit: "mol", value: "" }),
      temperature: field("Temperature T", { unit: "°C", value: "25" }),
    },
    compute(inputs) {
      const p = num(inputs.pressure) * 1000; // Pa
      const V = num(inputs.volume) / 1000; // m³
      const n = num(inputs.moles);
      const T = num(inputs.temperature) + 273.15; // K
      const blanks = [p, V, n, T].filter((value) => !Number.isFinite(value)).length;
      if (blanks !== 1) throw new Error("Leave exactly one of p, V, n and T blank");

      const solved = {
        p: Number.isFinite(p) ? p : (n * R * T) / V,
        V: Number.isFinite(V) ? V : (n * R * T) / p,
        n: Number.isFinite(n) ? n : (p * V) / (R * T),
        T: Number.isFinite(T) ? T : (p * V) / (n * R),
      };

      return [
        h(
          "div.result-row",
          {},
          result("Pressure", fmt(solved.p / 1000, 5), "kPa", ACCENT),
          result("Volume", fmt(solved.V * 1000, 5), "dm³", ACCENT),
          result("Amount", fmt(solved.n, 5), "mol", ACCENT),
          result("Temperature", fmt(solved.T - 273.15, 5), "°C", ACCENT),
          result("Molecules", sci(solved.n * N_A, 4), "", ACCENT)
        ),
        note(`Molar volume under these conditions: ${fmt((solved.V * 1000) / solved.n, 5)} dm³·mol⁻¹.`, "info"),
      ];
    },
  });
}

function phTool() {
  return tool({
    title: "pH, pOH and acid strength",
    subtitle: "Strong acids and bases dissociate fully; weak acids use K_a.",
    accent: ACCENT,
    fields: {
      kind: select("Solution", [
        { value: "strongAcid", label: "Strong acid" },
        { value: "strongBase", label: "Strong base" },
        { value: "weakAcid", label: "Weak acid (needs K_a)" },
      ], { value: "strongAcid" }),
      concentration: field("Concentration", { unit: "mol·dm⁻³", value: "0.01" }),
      ka: field("K_a (weak acids)", { value: "1.8e-5" }),
    },
    compute(inputs) {
      const c = num(inputs.concentration);
      if (!(c > 0)) throw new Error("Concentration must be positive");
      const kind = inputs.kind.value;
      let hydrogen;
      const workings = [];

      if (kind === "strongAcid") {
        hydrogen = c;
        workings.push({ text: "A strong acid dissociates completely", math: `[H⁺] = c = ${sci(c, 4)} mol·dm⁻³` });
      } else if (kind === "strongBase") {
        hydrogen = 1e-14 / c;
        workings.push({ text: "A strong base gives [OH⁻] = c", math: `[OH⁻] = ${sci(c, 4)} mol·dm⁻³` });
        workings.push({ text: "Use the ionic product of water", math: `[H⁺] = K_w / [OH⁻] = ${sci(hydrogen, 4)} mol·dm⁻³` });
      } else {
        const ka = num(inputs.ka);
        if (!(ka > 0)) throw new Error("Enter a positive K_a for a weak acid");
        hydrogen = Math.sqrt(ka * c);
        workings.push({ text: "Weak acid approximation", math: `[H⁺] = √(K_a × c) = √(${sci(ka, 3)} × ${sci(c, 3)}) = ${sci(hydrogen, 4)}` });
      }

      const pH = -Math.log10(hydrogen);
      const pOH = 14 - pH;
      const scaleColor = pH < 6 ? "var(--danger)" : pH > 8 ? "var(--phys)" : "var(--ok)";

      return [
        h(
          "div.result-row",
          {},
          result("pH", fmt(pH, 4), "", scaleColor),
          result("pOH", fmt(pOH, 4), "", scaleColor),
          result("[H⁺]", sci(hydrogen, 4), "mol·dm⁻³", ACCENT),
          result("[OH⁻]", sci(1e-14 / hydrogen, 4), "mol·dm⁻³", ACCENT)
        ),
        phScale(pH),
        steps(workings),
      ];
    },
  });
}

/** Universal-indicator style pH strip with a marker at the calculated pH. */
function phScale(pH) {
  const colors = ["#c0392b", "#e05a2b", "#e08b2b", "#d9c02b", "#9bc32b", "#3f8f2f", "#199e70", "#22a5b8", "#3987e5", "#4a53c9", "#6b3fa0", "#9085e9", "#b06ab0", "#d55181", "#e66767"];
  const clamped = Math.min(Math.max(pH, 0), 14);
  const width = 560;
  const cellWidth = width / 15;
  return h(
    "figure.figure",
    {},
    svg(
      "svg",
      { viewBox: `0 0 ${width} 74`, role: "img", "aria-label": `pH scale showing pH ${fmt(pH, 3)}` },
      colors.map((color, i) =>
        svg("rect", { x: i * cellWidth + 1, y: 20, width: cellWidth - 2, height: 26, fill: color, rx: 3 })
      ),
      colors.map((_, i) => svg("text", { class: "axis-text", x: i * cellWidth + cellWidth / 2, y: 60, "text-anchor": "middle" }, i)),
      svg("polygon", {
        points: `${(clamped + 0.5) * cellWidth - 7},12 ${(clamped + 0.5) * cellWidth + 7},12 ${(clamped + 0.5) * cellWidth},22`,
        fill: "var(--text)",
      }),
      svg("text", { class: "diagram-label", x: (clamped + 0.5) * cellWidth, y: 9, "text-anchor": "middle" }, `pH ${fmt(pH, 3)}`)
    ),
    h("figcaption", {}, pH < 7 ? "Acidic — excess H⁺" : pH > 7 ? "Alkaline — excess OH⁻" : "Neutral at 25 °C")
  );
}

/* ------------------------------------------------------------ Reference -- */

function chemistryReference() {
  const rows = CONSTANTS.filter((c) => c.subject === "chemistry").map((c) => [
    h("strong.mono", {}, c.symbol),
    c.name,
    h("span.mono", {}, sci(c.value, 6)),
    h("span.mono", {}, c.unit),
    c.exact ? h("span", { style: { color: "var(--chem)" } }, "exact") : "measured",
  ]);
  return h(
    "div.grid-2",
    {},
    card("Chemical constants", "Values used throughout the chemistry tools.", table(["Symbol", "Quantity", "Value", "Unit", "Status"], rows)),
    FORMULA_SHEETS.chemistry.map((sheet) => card(sheet.topic, null, table(["Formula", "Meaning"], sheet.rows, { className: "formula-table" })))
  );
}

export default {
  id: "chemistry",
  label: "Chemistry",
  icon: "🧪",
  accent: "var(--chem)",
  accentSoft: "var(--chem-soft)",
  hero: {
    title: "Chemistry workspace",
    blurb:
      "Explore all 118 elements, turn molecules and crystals in 3D, balance equations exactly, and work through moles, solutions, gases and pH with the reasoning laid out line by line.",
    tags: ["Periodic table", "3D molecules", "Crystals", "Orbitals", "Balancing", "Stoichiometry", "pH"],
  },
  tools: [
    { id: "periodic", label: "Periodic table", glyph: "🔬", render: periodicTable },
    ...CHEM3D_TOOLS,
    { id: "molar", label: "Molar mass", glyph: "⚖", render: molarMassTool },
    { id: "balance", label: "Equation balancer", glyph: "⚗", render: balancerTool },
    { id: "stoichiometry", label: "Reacting masses", glyph: "🧮", render: stoichiometryTool },
    { id: "empirical", label: "Empirical formula", glyph: "🧷", render: empiricalTool },
    { id: "solutions", label: "Concentration", glyph: "💧", render: solutionTool },
    { id: "gases", label: "Ideal gases", glyph: "🎈", render: gasTool },
    { id: "ph", label: "pH & acids", glyph: "🧫", render: phTool },
    { id: "reference", label: "Constants & formulae", glyph: "📐", render: chemistryReference },
  ],
};
