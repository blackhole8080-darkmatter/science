/**
 * Biology workspace: the central dogma, Mendelian and population genetics,
 * cell structure, microscopy and the codon reference.
 */

import { h, svg, tool, card, field, select, textarea, result, table, note, steps, bar, clear, fmt } from "../lib/ui.js";
import { CODON_TABLE, AMINO_ACIDS, AMINO_TYPE_COLORS, ORGANELLES, FORMULA_SHEETS } from "../data/reference.js";
import {
  cleanSequence, transcribe, translate, sequenceStats, reverseComplement,
  punnettSquare, hardyWeinberg, magnification, surfaceAreaToVolume,
} from "../lib/biology-core.js";
import { BIO3D_TOOLS } from "./bio3d.js";
import { BODY3D_TOOLS } from "./body3d.js";

const ACCENT = "var(--bio)";
const num = (input) => {
  const raw = input.value.trim();
  return raw === "" ? NaN : Number(raw);
};

/* ------------------------------------------------------- Central dogma -- */

function dnaTool() {
  return tool({
    title: "Transcription & translation",
    subtitle: "Takes a DNA strand through mRNA to a polypeptide, codon by codon.",
    accent: ACCENT,
    action: "Run the central dogma",
    fields: {
      sequence: textarea("DNA sequence", {
        rows: 3,
        value: "ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG",
        placeholder: "Paste a DNA sequence (FASTA headers and spaces are ignored)",
      }),
      strand: select("The sequence above is the…", [
        { value: "coding", label: "Coding (sense) strand" },
        { value: "template", label: "Template (antisense) strand" },
      ], { value: "coding", wide: true }),
    },
    compute(inputs) {
      const raw = cleanSequence(inputs.sequence.value);
      if (!raw) throw new Error("Enter a DNA sequence");
      const strands = transcribe(raw, inputs.strand.value);
      const stats = sequenceStats(strands.codingStrand);
      const protein = translate(strands.mRNA);

      const baseColors = { A: "#e66767", T: "#3987e5", G: "#c98500", C: "#199e70", U: "#9085e9" };
      const colourise = (sequence) =>
        sequence.split("").map((base) => h("span", { style: { color: baseColors[base] || "inherit" } }, base));

      return [
        h(
          "div.result-row",
          {},
          result("Length", stats.length, "bases", ACCENT),
          result("GC content", fmt(stats.gcContent, 4), "%", ACCENT),
          result("Melting point (est.)", fmt(stats.meltingTemp, 4), "°C", ACCENT),
          result("Peptide length", protein.peptide.length, "residues", ACCENT)
        ),
        h(
          "div.seq-flow",
          {},
          h("div.seq-strand", {}, h("span.seq-tag", {}, "5′→3′ coding strand (DNA)"), colourise(strands.codingStrand)),
          h("div.seq-strand", {}, h("span.seq-tag", {}, "3′→5′ template strand (read by RNA polymerase)"), colourise(strands.templateStrand)),
          h("div.seq-strand", { style: { borderColor: "var(--bio)" } }, h("span.seq-tag", {}, "5′→3′ mRNA transcript"), colourise(strands.mRNA))
        ),
        h(
          "div",
          {},
          h("span.seq-tag", {}, `Codons read from the AUG at base ${protein.start + 1}`),
          h(
            "div.codon-track",
            {},
            protein.codons.map((codon) =>
              h(
                "div.codon-chip",
                { style: { background: AMINO_TYPE_COLORS[AMINO_ACIDS[codon.residue].type] }, title: AMINO_ACIDS[codon.residue].name },
                codon.codon,
                h("b", {}, codon.residue === "Stop" ? "STOP" : AMINO_ACIDS[codon.residue].letter)
              )
            )
          )
        ),
        h(
          "div.result-row",
          {},
          result("Polypeptide (1-letter)", protein.oneLetter || "—", "", ACCENT),
          result("Polypeptide (3-letter)", protein.threeLetter || "—", "", ACCENT)
        ),
        aminoLegend(),
        protein.stopped
          ? note("Translation terminated at an in-frame stop codon, as it would at the ribosome.", "ok")
          : note("No in-frame stop codon was reached — the reading frame runs off the end of the sequence.", "info"),
        note(`Reverse complement: ${reverseComplement(strands.codingStrand)}`, "info"),
      ];
    },
  });
}

function aminoLegend() {
  const types = [
    ["nonpolar", "Non-polar"],
    ["polar", "Polar"],
    ["basic", "Basic"],
    ["acidic", "Acidic"],
    ["stop", "Stop codon"],
  ];
  return h(
    "div.pt-legend",
    {},
    types.map(([key, label]) =>
      h("span.legend-chip", {}, h("span.swatch", { style: { background: AMINO_TYPE_COLORS[key] } }), label)
    )
  );
}

function codonTableCard() {
  const bases = ["U", "C", "A", "G"];
  const rows = [];
  for (const first of bases) {
    for (const third of bases) {
      const cells = bases.map((second) => {
        const codon = first + second + third;
        const residue = CODON_TABLE[codon];
        const meta = AMINO_ACIDS[residue];
        return h(
          "span",
          { style: { color: AMINO_TYPE_COLORS[meta.type], fontWeight: "600" }, title: meta.name },
          `${codon} ${residue === "Stop" ? "STOP" : `${residue} (${meta.letter})`}`
        );
      });
      rows.push([h("strong.mono", {}, first), h("strong.mono", {}, third), ...cells]);
    }
  }
  return card(
    "The genetic code",
    "All 64 mRNA codons, coloured by the chemistry of the amino acid they specify.",
    table(["1st base", "3rd base", "2nd = U", "2nd = C", "2nd = A", "2nd = G"], rows),
    aminoLegend()
  );
}

/* ------------------------------------------------------------- Genetics -- */

function punnettTool() {
  return tool({
    title: "Punnett square",
    subtitle: "Monohybrid or dihybrid crosses. Uppercase letters are dominant alleles.",
    accent: ACCENT,
    fields: {
      parent1: field("Parent 1 genotype", { type: "text", value: "AaBb" }),
      parent2: field("Parent 2 genotype", { type: "text", value: "AaBb" }),
    },
    compute(inputs) {
      const cross = punnettSquare(inputs.parent1.value, inputs.parent2.value);
      const size = cross.cols.length;

      const gridCells = [h("div.punnett-cell.punnett-corner", {}, "")];
      for (const col of cross.cols) gridCells.push(h("div.punnett-cell.punnett-head", {}, col.label));
      cross.grid.forEach((row, rowIndex) => {
        gridCells.push(h("div.punnett-cell.punnett-head", {}, cross.rows[rowIndex].label));
        for (const cell of row) {
          gridCells.push(
            h(
              "div.punnett-cell",
              { title: `${fmt(cell.probability * 100, 3)}% of offspring` },
              cell.genotype,
              h("small", {}, `${fmt(cell.probability * 100, 3)}%`)
            )
          );
        }
      });

      const phenotypeColors = ["#3f8f2f", "#b06ab0", "#c98500", "#d55181"];

      return [
        h("div.punnett", { style: { gridTemplateColumns: `repeat(${size + 1}, minmax(58px, 1fr))` } }, gridCells),
        h("h4", {}, "Phenotype ratio"),
        bar(
          cross.phenotypes.map((p, i) => ({ label: p.label.split(" ")[0], percent: p.percent, color: phenotypeColors[i % phenotypeColors.length] }))
        ),
        table(
          ["Phenotype", "Probability", "Ratio"],
          cross.phenotypes.map((p, i) => [
            h("span", { style: { color: phenotypeColors[i % phenotypeColors.length], fontWeight: "600" } }, p.label),
            `${fmt(p.percent, 4)} %`,
            p.ratio,
          ])
        ),
        h("h4", {}, "Genotype ratio"),
        table(
          ["Genotype", "Probability", "Ratio"],
          cross.genotypes.map((g) => [h("strong.mono", {}, g.label), `${fmt(g.percent, 4)} %`, g.ratio])
        ),
        note(
          `${cross.rows.length} × ${cross.cols.length} gamete combinations. Ratios assume independent assortment and complete dominance.`,
          "info"
        ),
      ];
    },
  });
}

function hardyWeinbergTool() {
  return tool({
    title: "Hardy–Weinberg equilibrium",
    subtitle: "Allele and genotype frequencies in a large, randomly mating population.",
    accent: ACCENT,
    fields: {
      recessive: field("Recessive phenotype frequency q²", { value: "0.04", hint: "e.g. 1 in 25 affected = 0.04" }),
      population: field("Population size (optional)", { value: "10000" }),
    },
    compute(inputs) {
      const data = hardyWeinberg({ recessivePhenotype: num(inputs.recessive) });
      const population = num(inputs.population);
      const counts = Number.isFinite(population)
        ? {
            AA: data.homozygousDominant * population,
            Aa: data.heterozygous * population,
            aa: data.homozygousRecessive * population,
          }
        : null;

      return [
        h(
          "div.result-row",
          {},
          result("p (dominant allele)", fmt(data.p, 4), "", ACCENT),
          result("q (recessive allele)", fmt(data.q, 4), "", ACCENT),
          result("Carriers 2pq", `${fmt(data.heterozygous * 100, 4)} %`, "", ACCENT),
          result("Carrier frequency", `1 in ${fmt(data.carrierRatio, 3)}`, "", ACCENT)
        ),
        bar([
          { label: "AA", percent: data.homozygousDominant * 100, color: "#3f8f2f" },
          { label: "Aa", percent: data.heterozygous * 100, color: "#c98500" },
          { label: "aa", percent: data.homozygousRecessive * 100, color: "#d55181" },
        ]),
        table(
          ["Genotype", "Frequency", "Percentage", counts ? "Individuals" : null].filter(Boolean),
          [
            ["AA (homozygous dominant)", fmt(data.homozygousDominant, 4), `${fmt(data.homozygousDominant * 100, 4)} %`, counts ? fmt(counts.AA, 5) : null],
            ["Aa (heterozygous carrier)", fmt(data.heterozygous, 4), `${fmt(data.heterozygous * 100, 4)} %`, counts ? fmt(counts.Aa, 5) : null],
            ["aa (homozygous recessive)", fmt(data.homozygousRecessive, 4), `${fmt(data.homozygousRecessive * 100, 4)} %`, counts ? fmt(counts.aa, 5) : null],
          ].map((row) => row.filter((cell) => cell !== null))
        ),
        steps([
          { text: "The recessive phenotype gives q² directly", math: `q = √${fmt(num(inputs.recessive), 4)} = ${fmt(data.q, 4)}` },
          { text: "Allele frequencies sum to one", math: `p = 1 − q = ${fmt(data.p, 4)}` },
          { text: "Genotypes follow the binomial expansion", math: `p² + 2pq + q² = ${fmt(data.homozygousDominant, 4)} + ${fmt(data.heterozygous, 4)} + ${fmt(data.homozygousRecessive, 4)} = 1` },
        ]),
      ];
    },
  });
}

/* ----------------------------------------------------------- Cell biology */

function cellExplorer() {
  const info = h("div.card-body");
  let cellType = "animal";
  let activeId = "nucleus";

  const chooser = select("Cell type", [
    { value: "animal", label: "Animal cell" },
    { value: "plant", label: "Plant cell" },
  ], { value: "animal" });

  const figureHost = h("div");

  function describe(id) {
    activeId = id;
    const organelle = ORGANELLES.find((o) => o.id === id);
    clear(info).append(
      h(
        "div",
        {},
        h("h4", { style: { color: organelle.color } }, organelle.name),
        h("p", { style: { color: "var(--muted)" } }, organelle.role),
        h(
          "p",
          { style: { fontSize: "0.82rem" } },
          organelle.found === "both"
            ? "Present in both plant and animal cells."
            : `Found in ${organelle.found} cells only.`
        )
      )
    );
    draw();
  }

  function draw() {
    clear(figureHost).append(cellDiagram(cellType, activeId, describe));
  }

  chooser.input.addEventListener("change", () => {
    cellType = chooser.input.value;
    const visible = ORGANELLES.filter((o) => o.found === "both" || o.found === cellType);
    if (!visible.some((o) => o.id === activeId)) activeId = "nucleus";
    describe(activeId);
  });

  describe(activeId);

  return h(
    "div",
    { style: { display: "grid", gap: "1.25rem" } },
    h(
      "section.card",
      { style: { "--card-accent": ACCENT } },
      h("header.card-head", {}, h("h3", {}, "Cell explorer"), h("p.card-sub", {}, "Click any labelled structure to read what it does.")),
      h("div.card-body", {}, chooser, figureHost, organelleKey(() => cellType, describe))
    ),
    h(
      "div.grid-2",
      {},
      h("section.card", { style: { "--card-accent": ACCENT } }, h("header.card-head", {}, h("h3", {}, "Structure & function")), info),
      card(
        "Plant vs animal cells",
        "The structures that separate the two.",
        table(
          ["Structure", "Plant", "Animal"],
          [
            ["Cell wall (cellulose)", "✓", "✗"],
            ["Chloroplasts", "✓", "✗"],
            ["Large permanent vacuole", "✓", "✗"],
            ["Cell-surface membrane", "✓", "✓"],
            ["Nucleus, mitochondria, ribosomes", "✓", "✓"],
            ["Lysosomes", "rare", "✓"],
            ["Centrioles", "✗", "✓"],
          ]
        )
      )
    )
  );
}

function organelleKey(getType, onSelect) {
  return h(
    "div.pt-legend",
    {},
    ORGANELLES.filter((o) => o.found === "both" || o.found === getType()).map((o) =>
      h(
        "button.legend-chip",
        { type: "button", onClick: () => onSelect(o.id) },
        h("span.swatch", { style: { background: o.color } }),
        o.name
      )
    )
  );
}

const CELL_WIDTH = 720;
const CELL_HEIGHT = 400;

/**
 * Positions for each labelled structure, laid out per cell type. Every caption
 * sits beside its own shape and clear of its neighbours — tests/layout.mjs
 * checks that no two label boxes intersect in either cell type.
 * `at` positions the shape; `label` anchors the caption.
 */
const CELL_LAYOUT = {
  animal: {
    membrane: { label: [360, 20] },
    nucleus: { at: [240, 200], r: 54, label: [240, 132] },
    mitochondrion: { at: [[500, 120], [450, 320]], label: [500, 88] },
    rer: { path: "M120,290 q46,-24 92,0 q46,24 92,0", label: [212, 330] },
    golgi: { at: [520, 220], label: [552, 196] },
    ribosome: { at: [[150, 170], [176, 150], [200, 176], [158, 202]], label: [150, 116] },
    lysosome: { at: [[320, 320], [366, 306]], label: [343, 350] },
  },
  plant: {
    wall: { label: [360, 20] },
    membrane: { label: [566, 60] },
    vacuole: { at: [380, 180], rx: 140, ry: 72, label: [380, 184] },
    nucleus: { at: [120, 190], r: 42, label: [120, 132] },
    chloroplast: { at: [[110, 82], [624, 96], [640, 262], [118, 282]], label: [110, 55] },
    mitochondrion: { at: [[330, 80], [430, 285]], label: [330, 48] },
    rer: { path: "M150,285 q40,-22 80,0 q40,22 80,0", label: [230, 308] },
    golgi: { at: [552, 176], label: [584, 152] },
    ribosome: { at: [[520, 288], [548, 302], [498, 306]], label: [524, 270] },
  },
};

/** Schematic cell. Each organelle is a clickable, directly-labelled hotspot. */
function cellDiagram(type, activeId, onSelect) {
  const isPlant = type === "plant";
  const layout = CELL_LAYOUT[type];
  const colorOf = (id) => ORGANELLES.find((o) => o.id === id).color;
  const nameOf = (id) => ORGANELLES.find((o) => o.id === id).name;

  const hotspot = (id, shape) => {
    const [labelX, labelY] = layout[id].label;
    const group = svg(
      "g",
      { class: "diagram-hotspot", onClick: () => onSelect(id), role: "button", tabindex: "0", "aria-label": nameOf(id) },
      shape(id === activeId),
      svg("text", { class: "diagram-label", x: labelX, y: labelY, "text-anchor": "middle" }, nameOf(id))
    );
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(id);
      }
    });
    return group;
  };

  const cytoplasm = isPlant
    ? svg("rect", { x: 46, y: 44, width: CELL_WIDTH - 92, height: CELL_HEIGHT - 98, rx: 12, fill: "var(--bio-soft)" })
    : svg("ellipse", { cx: CELL_WIDTH / 2, cy: CELL_HEIGHT / 2, rx: CELL_WIDTH / 2 - 54, ry: CELL_HEIGHT / 2 - 40, fill: "var(--bio-soft)" });

  const parts = [cytoplasm];

  if (isPlant) {
    parts.push(
      hotspot("wall", (active) =>
        svg("rect", { x: 32, y: 30, width: CELL_WIDTH - 64, height: CELL_HEIGHT - 70, rx: 16, fill: "none", stroke: colorOf("wall"), "stroke-width": active ? 8 : 5 })
      ),
      hotspot("membrane", (active) =>
        svg("rect", { x: 46, y: 44, width: CELL_WIDTH - 92, height: CELL_HEIGHT - 98, rx: 12, fill: "none", stroke: colorOf("membrane"), "stroke-width": active ? 5 : 3 })
      ),
      hotspot("vacuole", (active) => {
        const { at: [cx, cy], rx, ry } = layout.vacuole;
        return svg("ellipse", { cx, cy, rx, ry, fill: colorOf("vacuole"), opacity: active ? 0.5 : 0.28, stroke: colorOf("vacuole"), "stroke-width": active ? 3 : 2 });
      }),
      hotspot("chloroplast", (active) =>
        svg("g", {}, layout.chloroplast.at.map(([cx, cy]) =>
          svg("ellipse", { cx, cy, rx: 21, ry: 12, fill: colorOf("chloroplast"), opacity: active ? 1 : 0.82, transform: `rotate(-25 ${cx} ${cy})` })
        ))
      )
    );
  } else {
    parts.push(
      hotspot("membrane", (active) =>
        svg("ellipse", {
          cx: CELL_WIDTH / 2, cy: CELL_HEIGHT / 2, rx: CELL_WIDTH / 2 - 44, ry: CELL_HEIGHT / 2 - 30,
          fill: "none", stroke: colorOf("membrane"), "stroke-width": active ? 6 : 4,
        })
      ),
      hotspot("lysosome", (active) =>
        svg("g", {}, layout.lysosome.at.map(([cx, cy]) =>
          svg("circle", { cx, cy, r: active ? 15 : 12, fill: colorOf("lysosome"), opacity: 0.9 })
        ))
      )
    );
  }

  parts.push(
    hotspot("nucleus", (active) => {
      const [cx, cy] = layout.nucleus.at;
      return svg(
        "g",
        {},
        svg("circle", { cx, cy, r: layout.nucleus.r + (active ? 4 : 0), fill: colorOf("nucleus"), opacity: 0.85 }),
        svg("circle", { cx, cy, r: layout.nucleus.r * 0.34, fill: "var(--panel-solid)", opacity: 0.55 })
      );
    }),
    hotspot("mitochondrion", (active) =>
      svg("g", {}, layout.mitochondrion.at.map(([cx, cy]) =>
        svg(
          "g",
          {},
          svg("ellipse", { cx, cy, rx: 32, ry: 16, fill: colorOf("mitochondrion"), opacity: active ? 1 : 0.85 }),
          svg("path", { d: `M${cx - 22},${cy} q7,-10 15,0 q8,10 15,0`, fill: "none", stroke: "var(--panel-solid)", "stroke-width": 2.5 })
        )
      ))
    ),
    hotspot("rer", (active) =>
      svg("path", { d: layout.rer.path, fill: "none", stroke: colorOf("rer"), "stroke-width": active ? 8 : 5, "stroke-linecap": "round" })
    ),
    hotspot("golgi", (active) => {
      const [x, y] = layout.golgi.at;
      return svg("g", {}, [0, 1, 2].map((i) =>
        svg("path", { d: `M${x - i * 5},${y + i * 11} q34,-14 64,0`, fill: "none", stroke: colorOf("golgi"), "stroke-width": active ? 5 : 3.5, "stroke-linecap": "round" })
      ));
    }),
    hotspot("ribosome", (active) =>
      svg("g", {}, layout.ribosome.at.map(([cx, cy]) =>
        svg("circle", { cx, cy, r: active ? 6.5 : 4.5, fill: colorOf("ribosome") })
      ))
    )
  );

  return h(
    "figure.figure",
    {},
    svg("svg", { viewBox: `0 0 ${CELL_WIDTH} ${CELL_HEIGHT}`, role: "group", "aria-label": `${type} cell diagram` }, parts),
    h("figcaption", {}, `Schematic ${type} cell — not to scale. Click a structure for its function.`)
  );
}

/* --------------------------------------------------------- Practical bio */

function microscopyTool() {
  return tool({
    title: "Microscopy & magnification",
    subtitle: "magnification = image size ÷ actual size. Leave one box blank.",
    accent: ACCENT,
    fields: {
      imageSize: field("Image size", { unit: "mm", value: "45" }),
      actualSize: field("Actual size", { unit: "µm", value: "" }),
      factor: field("Magnification", { unit: "×", value: "1500" }),
    },
    compute(inputs) {
      const imageSize = num(inputs.imageSize) * 1000; // work in µm
      const actualSize = num(inputs.actualSize);
      const factor = num(inputs.factor);
      const solved = magnification({ imageSize, actualSize, factor });

      return [
        h(
          "div.result-row",
          {},
          result("Image size", fmt(solved.imageSize / 1000, 5), "mm", ACCENT),
          result("Actual size", fmt(solved.actualSize, 5), "µm", ACCENT),
          result("Magnification", `×${fmt(solved.factor, 5)}`, "", ACCENT)
        ),
        table(
          ["Instrument", "Typical maximum magnification", "Resolution"],
          [
            ["Light microscope", "×1500", "≈ 200 nm"],
            ["Transmission electron microscope", "×1,000,000", "≈ 0.1 nm"],
            ["Scanning electron microscope", "×500,000", "≈ 3 nm"],
          ]
        ),
        note("Magnification is how much larger the image is; resolution is how much detail can be distinguished. Only resolution is limited by wavelength.", "info"),
      ];
    },
  });
}

function savTool() {
  return tool({
    title: "Surface area : volume",
    subtitle: "Why large organisms need exchange surfaces and transport systems.",
    accent: ACCENT,
    fields: {
      shape: select("Shape", [
        { value: "cube", label: "Cube (side length)" },
        { value: "sphere", label: "Sphere (radius)" },
      ], { value: "cube" }),
      size: field("Size", { unit: "mm", value: "2" }),
    },
    compute(inputs) {
      const shape = inputs.shape.value;
      const size = num(inputs.size);
      const data = surfaceAreaToVolume(shape, size);
      const series = [0.5, 1, 2, 4, 8].map((s) => surfaceAreaToVolume(shape, s));

      return [
        h(
          "div.result-row",
          {},
          result("Surface area", fmt(data.area, 5), "mm²", ACCENT),
          result("Volume", fmt(data.volume, 5), "mm³", ACCENT),
          result("SA : V ratio", `${fmt(data.ratio, 4)} : 1`, "", ACCENT)
        ),
        table(
          ["Size / mm", "Surface area / mm²", "Volume / mm³", "SA : V"],
          series.map((s, i) => [[0.5, 1, 2, 4, 8][i], fmt(s.area, 4), fmt(s.volume, 4), `${fmt(s.ratio, 4)} : 1`])
        ),
        note("Doubling the size halves the SA:V ratio — diffusion alone can no longer supply the interior, which is why larger organisms evolve lungs, gills and circulatory systems.", "info"),
      ];
    },
  });
}

function biologyReference() {
  return h(
    "div.grid-2",
    {},
    FORMULA_SHEETS.biology.map((sheet) => card(sheet.topic, null, table(["Formula", "Meaning"], sheet.rows, { className: "formula-table" }))),
    card(
      "Levels of organisation",
      "From molecule to biosphere.",
      table(
        ["Level", "Example"],
        [
          ["Organelle", "Mitochondrion"],
          ["Cell", "Palisade mesophyll cell"],
          ["Tissue", "Xylem"],
          ["Organ", "Leaf"],
          ["Organ system", "Circulatory system"],
          ["Organism", "Oak tree"],
          ["Population → community → ecosystem", "Woodland"],
        ]
      )
    ),
    card(
      "Classification",
      "The taxonomic hierarchy, broadest first.",
      table(
        ["Rank", "Human"],
        [
          ["Domain", "Eukaryota"],
          ["Kingdom", "Animalia"],
          ["Phylum", "Chordata"],
          ["Class", "Mammalia"],
          ["Order", "Primates"],
          ["Family", "Hominidae"],
          ["Genus", "Homo"],
          ["Species", "sapiens"],
        ]
      )
    )
  );
}

export default {
  id: "biology",
  label: "Biology",
  icon: "🧬",
  accent: "var(--bio)",
  accentSoft: "var(--bio-soft)",
  hero: {
    title: "Biology workspace",
    blurb:
      "Explore the whole body system by system, watch a heart beat through its measured pressure cycle, grow the airway tree from Weibel's model, fire a Hodgkin–Huxley action potential, then work through the central dogma, inheritance and cell structure.",
    tags: ["Body explorer", "Beating heart", "Airways", "Action potential", "DNA in 3D", "Genetics", "Cells"],
  },
  tools: [
    ...BODY3D_TOOLS,
    ...BIO3D_TOOLS,
    { id: "dna", label: "DNA → protein", glyph: "🧬", render: dnaTool },
    { id: "codons", label: "Genetic code", glyph: "🔤", render: codonTableCard },
    { id: "punnett", label: "Punnett square", glyph: "🟩", render: punnettTool },
    { id: "populations", label: "Hardy–Weinberg", glyph: "📊", render: hardyWeinbergTool },
    { id: "cells", label: "Cell explorer", glyph: "🔬", render: cellExplorer },
    { id: "microscopy", label: "Microscopy", glyph: "🔎", render: microscopyTool },
    { id: "sav", label: "Surface area : volume", glyph: "📦", render: savTool },
    { id: "reference", label: "Reference tables", glyph: "📐", render: biologyReference },
  ],
};
