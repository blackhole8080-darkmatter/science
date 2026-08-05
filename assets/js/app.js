/**
 * Application shell: subject tabs, the tool rail, theme handling and routing
 * through the URL hash (#subject/tool) so any view can be linked or reloaded.
 */

import { h, clear, note } from "./lib/ui.js";
import physics from "./modules/physics.js";
import chemistry from "./modules/chemistry.js";
import biology from "./modules/biology.js";

const SUBJECTS = [physics, chemistry, biology];

const nav = document.getElementById("subject-nav");
const rail = document.getElementById("tool-rail");
const stage = document.getElementById("stage");
const themeToggle = document.getElementById("theme-toggle");

let current = { subject: SUBJECTS[0], tool: SUBJECTS[0].tools[0] };

/* ------------------------------------------------------------- Theme ---- */

const storedTheme = localStorage.getItem("science-lab-theme");
if (storedTheme) document.documentElement.dataset.theme = storedTheme;
syncThemeButton();

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("science-lab-theme", next);
  syncThemeButton();
});

function syncThemeButton() {
  const light = document.documentElement.dataset.theme === "light";
  themeToggle.textContent = light ? "🌙" : "☀️";
  themeToggle.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
}

/* ------------------------------------------------------------ Routing --- */

function parseHash() {
  const [subjectId, toolId] = location.hash.replace(/^#\/?/, "").split("/");
  const subject = SUBJECTS.find((s) => s.id === subjectId) || SUBJECTS[0];
  const tool = subject.tools.find((t) => t.id === toolId) || subject.tools[0];
  return { subject, tool };
}

function navigate(subject, tool, { replace = false } = {}) {
  const hash = `#${subject.id}/${tool.id}`;
  if (location.hash !== hash) {
    if (replace) history.replaceState(null, "", hash);
    else location.hash = hash;
  }
  current = { subject, tool };
  render();
}

window.addEventListener("hashchange", () => {
  current = parseHash();
  render();
});

/* ------------------------------------------------------------ Rendering - */

function renderNav() {
  clear(nav);
  for (const subject of SUBJECTS) {
    nav.append(
      h(
        "button.subject-tab",
        {
          type: "button",
          role: "tab",
          "aria-selected": String(subject.id === current.subject.id),
          style: { "--tab-accent": subject.accent },
          onClick: () => navigate(subject, subject.tools[0]),
        },
        h("span.dot"),
        subject.icon,
        subject.label
      )
    );
  }
}

function renderRail() {
  clear(rail);
  rail.append(h("div.rail-title", {}, `${current.subject.label} tools`));
  for (const tool of current.subject.tools) {
    rail.append(
      h(
        "button.rail-link",
        {
          type: "button",
          "aria-current": String(tool.id === current.tool.id),
          onClick: () => navigate(current.subject, tool),
        },
        h("span.glyph", {}, tool.glyph),
        tool.label
      )
    );
  }
}

function renderStage() {
  clear(stage);
  const { subject, tool } = current;
  document.documentElement.style.setProperty("--accent", subject.accent);
  document.documentElement.style.setProperty("--accent-soft", subject.accentSoft);
  document.title = `${tool.label} · ${subject.label} — Science Lab`;

  stage.append(
    h(
      "section.hero",
      {},
      h("h2", {}, subject.hero.title),
      h("p", {}, subject.hero.blurb),
      h("div.hero-tags", {}, subject.hero.tags.map((tag) => h("span.tag", {}, tag)))
    )
  );

  try {
    stage.append(tool.render());
  } catch (error) {
    stage.append(note(`This tool failed to load: ${error.message}`, "error"));
    console.error(error);
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function render() {
  renderNav();
  renderRail();
  renderStage();
}

current = parseHash();
navigate(current.subject, current.tool, { replace: true });
