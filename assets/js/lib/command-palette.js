/**
 * Command palette — one search box over everything in the workspace.
 *
 * Indexes tools, the 118 elements, physical constants, formulae, molecules,
 * crystal structures, orbitals and anatomical structures, so a user who knows
 * what they want does not have to know which subject it lives under. Opened
 * with ⌘K / Ctrl-K, or "/" from anywhere outside a text field.
 *
 * Scoring is a small deterministic ranking: exact matches first, then prefix,
 * then substring, weighted by how important the field is. No fuzzy library —
 * the index is a few hundred entries and predictability beats cleverness when
 * someone is typing "Fe" and expects iron.
 */

import { h, clear } from "./ui.js";
import { ELEMENTS, CATEGORIES } from "../data/elements.js";
import { CONSTANTS, FORMULA_SHEETS } from "../data/reference.js";
import { MOLECULES, LATTICES } from "./molecule-core.js";
import { ORBITALS } from "./orbital-core.js";
import { STRUCTURES, SYSTEMS } from "./body-core.js";

const SUBJECT_ICONS = { physics: "⚛", chemistry: "🧪", biology: "🧬" };

/**
 * Build the searchable index once.
 * @param {Array} subjects the subject modules, for their tool lists
 */
export function buildIndex(subjects) {
  const entries = [];

  for (const subject of subjects) {
    for (const tool of subject.tools) {
      entries.push({
        kind: "Tool",
        title: tool.label,
        subtitle: `${subject.label} workspace`,
        keywords: [subject.label, subject.id, tool.id],
        icon: tool.glyph || SUBJECT_ICONS[subject.id],
        route: `${subject.id}/${tool.id}`,
        weight: 3,
      });
    }
  }

  for (const element of ELEMENTS) {
    entries.push({
      kind: "Element",
      title: `${element.symbol} — ${element.name}`,
      subtitle: `Z = ${element.number} · ${CATEGORIES[element.category].label} · ${element.mass} u`,
      keywords: [element.symbol, element.name, String(element.number), element.category],
      color: element.color,
      route: "chemistry/periodic",
      search: element.symbol,
      weight: 2,
    });
  }

  for (const constant of CONSTANTS) {
    entries.push({
      kind: "Constant",
      title: `${constant.symbol} — ${constant.name}`,
      subtitle: `${constant.value} ${constant.unit}${constant.exact ? " (exact)" : ""}`,
      keywords: [constant.symbol, constant.name, constant.unit],
      route: `${constant.subject}/reference`,
      weight: 2,
    });
  }

  for (const [subjectId, sheets] of Object.entries(FORMULA_SHEETS)) {
    for (const sheet of sheets) {
      for (const [formula, meaning] of sheet.rows) {
        entries.push({
          kind: "Formula",
          title: formula,
          subtitle: `${meaning} · ${sheet.topic}`,
          keywords: [sheet.topic, meaning],
          route: `${subjectId}/reference`,
          weight: 1,
        });
      }
    }
  }

  for (const molecule of MOLECULES) {
    entries.push({
      kind: "Molecule",
      title: `${molecule.name} — ${molecule.formula}`,
      subtitle: molecule.geometryLabel || "3D structure",
      keywords: [molecule.formula, molecule.id],
      route: "chemistry/molecules3d",
      weight: 2,
    });
  }

  for (const lattice of LATTICES) {
    entries.push({
      kind: "Crystal",
      title: `${lattice.name} — ${lattice.formula}`,
      subtitle: `${lattice.system} · a = ${lattice.a} Å`,
      keywords: [lattice.formula, lattice.system],
      route: "chemistry/lattices",
      weight: 2,
    });
  }

  for (const orbital of ORBITALS) {
    entries.push({
      kind: "Orbital",
      title: orbital.label,
      subtitle: `n = ${orbital.n}, l = ${orbital.l}`,
      keywords: ["orbital", "wavefunction", orbital.id],
      route: "chemistry/orbitals",
      weight: 2,
    });
  }

  for (const structure of STRUCTURES) {
    entries.push({
      kind: "Anatomy",
      title: structure.name,
      subtitle: `${SYSTEMS[structure.system].label} system · ${structure.latin}`,
      keywords: [structure.latin, structure.system, structure.id],
      color: SYSTEMS[structure.system].color,
      route: structure.linkTo || "biology/body",
      weight: 2,
    });
  }

  return entries;
}

/** Rank entries against a query. Returns the best `limit` matches. */
export function search(index, query, limit = 12) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return index.filter((entry) => entry.kind === "Tool").slice(0, limit);
  }

  const scored = [];
  for (const entry of index) {
    const title = entry.title.toLowerCase();
    const keywords = (entry.keywords || []).map((k) => String(k).toLowerCase());

    let score = 0;
    if (title === needle || keywords.includes(needle)) score = 100;
    else if (title.startsWith(needle)) score = 70;
    else if (keywords.some((k) => k.startsWith(needle))) score = 55;
    else if (title.includes(needle)) score = 35;
    else if (keywords.some((k) => k.includes(needle))) score = 25;
    else if ((entry.subtitle || "").toLowerCase().includes(needle)) score = 12;

    if (score) scored.push({ entry, score: score + entry.weight });
  }

  scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * Mount the palette. Returns { open, close }.
 * @param {Array} index from buildIndex
 * @param {(entry) => void} onChoose navigate to the chosen entry
 */
export function createPalette(index, onChoose) {
  let results = [];
  let active = 0;

  const input = h("input.palette-input", {
    type: "text",
    placeholder: "Search tools, elements, constants, formulae, anatomy…",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": "Search the workspace",
  });
  const list = h("div.palette-results", { role: "listbox" });
  const hint = h(
    "div.palette-hint",
    {},
    h("span", {}, h("kbd", {}, "↑"), h("kbd", {}, "↓"), " to move"),
    h("span", {}, h("kbd", {}, "↵"), " to open"),
    h("span", {}, h("kbd", {}, "esc"), " to close")
  );

  const panel = h("div.palette-panel", { role: "dialog", "aria-modal": "true", "aria-label": "Command palette" }, input, list, hint);
  const overlay = h("div.palette-overlay", { hidden: true }, panel);

  function render() {
    clear(list);
    if (!results.length) {
      list.append(h("div.palette-empty", {}, "Nothing matches that."));
      return;
    }
    results.forEach((entry, i) => {
      list.append(
        h(
          "button.palette-item",
          {
            type: "button",
            role: "option",
            "aria-selected": String(i === active),
            class: i === active ? "is-active" : null,
            onMouseenter: () => {
              active = i;
              render();
            },
            onClick: () => choose(entry),
          },
          h("span.palette-icon", { style: entry.color ? { color: entry.color } : {} }, entry.icon || "◆"),
          h(
            "span.palette-text",
            {},
            h("span.palette-title", {}, entry.title),
            h("span.palette-subtitle", {}, entry.subtitle)
          ),
          h("span.palette-kind", {}, entry.kind)
        )
      );
    });
  }

  function update() {
    results = search(index, input.value);
    active = 0;
    render();
  }

  function choose(entry) {
    close();
    onChoose(entry);
  }

  function open() {
    overlay.hidden = false;
    input.value = "";
    update();
    input.focus();
  }

  function close() {
    overlay.hidden = true;
  }

  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      active = Math.min(active + 1, results.length - 1);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      active = Math.max(active - 1, 0);
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (event.key === "Escape") {
      close();
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  // Global shortcuts. "/" only when the user is not already typing somewhere.
  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      overlay.hidden ? open() : close();
    } else if (event.key === "/" && !typing && overlay.hidden) {
      event.preventDefault();
      open();
    } else if (event.key === "Escape" && !overlay.hidden) {
      close();
    }
  });

  document.body.append(overlay);
  return { open, close, element: overlay };
}
