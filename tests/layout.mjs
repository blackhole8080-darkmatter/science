/**
 * Browser checks: every tool renders without errors, and the cell diagram's
 * labels never overlap each other.
 *
 *   node tests/layout.mjs
 *
 * Needs Playwright and a local server on http://localhost:8899 (see README).
 * Skips itself, rather than failing, when Playwright is not installed.
 */

const BASE = process.env.BASE_URL || "http://localhost:8899";

/**
 * Resolve Playwright from the project, from a path given in PLAYWRIGHT_MODULE,
 * or from a global install — whichever is present.
 */
async function loadPlaywright() {
  const candidates = ["playwright", process.env.PLAYWRIGHT_MODULE, "/opt/node22/lib/node_modules/playwright/index.mjs"];
  for (const candidate of candidates.filter(Boolean)) {
    try {
      return await import(candidate);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

const playwright = await loadPlaywright();
if (!playwright) {
  console.log("  skipped — Playwright not found (npm i -D playwright, then npx playwright install chromium)");
  process.exit(0);
}
const { chromium } = playwright;

const ROUTES = {
  physics: ["motion", "projectile", "dynamics", "circuits", "refraction", "lenses", "thermal", "nuclear", "reference"],
  chemistry: ["periodic", "molar", "balance", "stoichiometry", "empirical", "solutions", "gases", "ph", "reference"],
  biology: ["dna", "codons", "punnett", "populations", "cells", "microscopy", "sav", "reference"],
};

const problems = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console error: ${message.text()}`);
});
page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`));

let checked = 0;
for (const [subject, tools] of Object.entries(ROUTES)) {
  for (const toolId of tools) {
    const route = `${subject}/${toolId}`;
    await page.goto(`${BASE}/index.html#${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(100);
    checked += 1;

    const errors = await page.$$eval(".note-error", (nodes) => nodes.map((n) => n.textContent));
    if (errors.length) problems.push(`${route}: ${errors.join(" | ")}`);

    const emptyOutputs = await page.$$eval(".tool-output", (nodes) => nodes.filter((n) => !n.children.length).length);
    if (emptyOutputs) problems.push(`${route}: ${emptyOutputs} tool(s) produced no output`);

    if ((await page.$eval("#stage", (n) => n.children.length)) < 2) problems.push(`${route}: nothing rendered`);
  }
}

// Diagram labels must not collide in either cell type.
await page.goto(`${BASE}/index.html#biology/cells`, { waitUntil: "networkidle" });
for (const cellType of ["animal", "plant"]) {
  await page.selectOption("select.input", cellType);
  await page.waitForTimeout(100);
  const clashes = await page.$$eval(".figure svg .diagram-label", (nodes) => {
    const boxes = nodes.map((node) => ({ text: node.textContent, box: node.getBoundingClientRect() }));
    const found = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i].box;
        const b = boxes[j].box;
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
          found.push(`${boxes[i].text} ↔ ${boxes[j].text}`);
        }
      }
    }
    return found;
  });
  if (clashes.length) problems.push(`${cellType} cell: overlapping labels — ${clashes.join(", ")}`);
  checked += 1;
}

// The page must never scroll sideways on a phone-sized viewport.
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(`${BASE}/index.html#physics/motion`, { waitUntil: "networkidle" });
if (await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
  problems.push("mobile: page scrolls horizontally");
}
checked += 1;

await browser.close();

console.log(`\n  ${checked} checks run, ${problems.length} problem(s)\n`);
if (problems.length) {
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
