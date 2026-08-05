/**
 * Tiny DOM + formatting toolkit shared by every subject module.
 * No framework: elements are built with h() and returned as real nodes.
 */

/**
 * Create an element. Children may be nodes, strings, or nested arrays.
 * h("div.card", { title: "x" }, "hello")
 */
export function h(spec, props = {}, ...children) {
  const [tag, ...classes] = spec.split(".");
  const node = document.createElement(tag || "div");
  if (classes.length) node.className = classes.join(" ");

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = [node.className, value].filter(Boolean).join(" ");
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? "" : value);
  }

  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ------------------------------------------------------------------ *
 * Number formatting
 * ------------------------------------------------------------------ */

/** Format a number for display: fixed notation nearby, scientific when extreme. */
export function fmt(value, sigFigs = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude >= 1e6 || magnitude < 1e-4) return sci(value, sigFigs);
  const decimals = Math.max(0, sigFigs - 1 - Math.floor(Math.log10(magnitude)));
  return Number(value.toFixed(Math.min(decimals, 10))).toString();
}

/** Scientific notation with a real × 10ⁿ, e.g. 6.022 × 10²³. */
export function sci(value, sigFigs = 4) {
  if (value === 0) return "0";
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  return `${Number(mantissa.toFixed(sigFigs - 1))} × 10${superscript(exponent)}`;
}

const SUPERSCRIPTS = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export function superscript(n) {
  return String(n)
    .split("")
    .map((ch) => SUPERSCRIPTS[ch] ?? ch)
    .join("");
}

const SUBSCRIPTS = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
export function subscript(n) {
  return String(n)
    .split("")
    .map((ch) => SUBSCRIPTS[ch] ?? ch)
    .join("");
}

/** Render digits in a chemical formula as subscripts: H2O -> H₂O. */
export function prettyFormula(formula) {
  return String(formula).replace(/([A-Za-z\)\]])(\d+)/g, (_, prefix, digits) =>
    prefix + digits.split("").map((d) => SUBSCRIPTS[d]).join("")
  );
}

/* ------------------------------------------------------------------ *
 * Composite building blocks
 * ------------------------------------------------------------------ */

export function card(title, subtitle, ...children) {
  return h(
    "section.card",
    {},
    h("header.card-head", {}, h("h3", {}, title), subtitle ? h("p.card-sub", {}, subtitle) : null),
    h("div.card-body", {}, children)
  );
}

/**
 * Labelled input field. Returns the wrapper with a `.input` property pointing
 * at the control so callers can read values.
 */
export function field(label, { value = "", unit = "", type = "number", step = "any", placeholder = "", hint = "" } = {}) {
  const input = h("input.input", { type, step, value, placeholder, autocomplete: "off" });
  const wrapper = h(
    "label.field",
    {},
    h("span.field-label", {}, label),
    h("div.field-control", {}, input, unit ? h("span.field-unit", {}, unit) : null),
    hint ? h("small.field-hint", {}, hint) : null
  );
  wrapper.input = input;
  return wrapper;
}

export function select(label, options, { value = "", wide = false } = {}) {
  const control = h(
    "select.input",
    {},
    options.map((option) =>
      h("option", { value: option.value, selected: option.value === value || null }, option.label)
    )
  );
  const wrapper = h(
    "label.field",
    { class: wide ? "field-wide" : null },
    h("span.field-label", {}, label),
    h("div.field-control", {}, control)
  );
  wrapper.input = control;
  return wrapper;
}

export function textarea(label, { value = "", rows = 4, placeholder = "" } = {}) {
  const control = h("textarea.input.mono", { rows, placeholder, spellcheck: "false" });
  control.value = value;
  const wrapper = h("label.field.field-wide", {}, h("span.field-label", {}, label), control);
  wrapper.input = control;
  return wrapper;
}

export function button(label, onClick, variant = "primary") {
  return h("button.btn", { class: `btn-${variant}`, type: "button", onClick }, label);
}

/** Headline result chip: a big value with a caption. */
export function result(label, value, unit = "", accent = null) {
  return h(
    "div.result",
    accent ? { style: { "--result-accent": accent } } : {},
    h("div.result-label", {}, label),
    h("div.result-value", {}, value, unit ? h("span.result-unit", {}, unit) : null)
  );
}

export function table(headers, rows, { className = "" } = {}) {
  return h(
    "div.table-wrap",
    {},
    h(
      "table.data-table",
      { class: className },
      h("thead", {}, h("tr", {}, headers.map((head) => h("th", {}, head)))),
      h(
        "tbody",
        {},
        rows.map((row) =>
          h(
            "tr",
            {},
            row.map((cellValue) => {
              if (cellValue instanceof Node) return h("td", {}, cellValue);
              if (cellValue && typeof cellValue === "object" && "value" in cellValue) {
                return h("td", { style: cellValue.color ? { color: cellValue.color } : {} }, cellValue.value);
              }
              return h("td", {}, cellValue);
            })
          )
        )
      )
    )
  );
}

/** Horizontal proportion bar, used for composition and allele frequencies. */
export function bar(segments) {
  return h(
    "div.bar",
    {},
    segments.map((segment) =>
      h(
        "div.bar-seg",
        {
          style: { width: `${Math.max(segment.percent, 0)}%`, background: segment.color },
          title: `${segment.label}: ${fmt(segment.percent, 3)}%`,
        },
        segment.percent > 8 ? h("span.bar-label", {}, segment.label) : null
      )
    )
  );
}

export function note(text, tone = "info") {
  return h("p.note", { class: `note-${tone}` }, text);
}

export function steps(items) {
  return h(
    "ol.steps",
    {},
    items.map((item) =>
      h("li", {}, h("span.step-text", {}, item.text), item.math ? h("code.step-math", {}, item.math) : null)
    )
  );
}

/**
 * Standard tool scaffold: inputs on the left, live output on the right.
 * `compute` receives the field map and returns nodes to display.
 */
export function tool({ title, subtitle, fields, compute, action = "Calculate", accent }) {
  const output = h("div.tool-output");
  const inputs = Object.fromEntries(Object.entries(fields).map(([key, node]) => [key, node.input]));

  const run = () => {
    clear(output);
    try {
      const nodes = compute(inputs);
      append(output, [nodes]);
    } catch (error) {
      output.append(note(error.message, "error"));
    }
  };

  const form = h(
    "form.tool-form",
    {
      onSubmit: (event) => {
        event.preventDefault();
        run();
      },
    },
    h("div.field-grid", {}, Object.values(fields)),
    h("div.tool-actions", {}, h("button.btn.btn-primary", { type: "submit" }, action))
  );

  for (const node of Object.values(inputs)) {
    node.addEventListener("input", () => {
      if (output.dataset.live === "on") run();
    });
  }
  output.dataset.live = "on";
  queueMicrotask(run);

  return h(
    "section.card.tool",
    accent ? { style: { "--card-accent": accent } } : {},
    h("header.card-head", {}, h("h3", {}, title), subtitle ? h("p.card-sub", {}, subtitle) : null),
    h("div.card-body", {}, form, output)
  );
}
