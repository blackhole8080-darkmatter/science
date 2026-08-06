/**
 * Build a single self-contained HTML file: every module, three.js and the
 * stylesheet inlined, with no external requests.
 *
 *   npm run build:preview     ->  dist/science-lab.html
 *
 * The app itself still needs no build step — this exists so the whole workspace
 * can be handed over as one file, or hosted somewhere that only serves static
 * pages with a strict content-security policy.
 */

import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Two shapes of the same bundle:
 *  - the standalone page, a complete HTML document you can open from disk;
 *  - the artifact fragment, which omits the document scaffolding because the
 *    host wraps it in one, and so must not declare html/head/body itself.
 */
const outputs = [
  { file: resolve(root, "dist/science-lab.html"), standalone: true },
  { file: resolve(root, "dist/science-lab.artifact.html"), standalone: false },
];

/** Bundle the ES modules (three.js included) into one script. */
const result = await build({
  entryPoints: [resolve(root, "assets/js/app.js")],
  bundle: true,
  // OrbitControls imports the bare specifier "three"; in the browser that is
  // satisfied by the import map in index.html, so mirror it here.
  alias: { three: resolve(root, "vendor/three/three.module.js") },
  format: "iife",
  minify: true,
  legalComments: "none",
  target: ["chrome100", "firefox100", "safari15"],
  write: false,
  logLevel: "warning",
});

const script = result.outputFiles[0].text;
const css = await readFile(resolve(root, "assets/css/styles.css"), "utf8");
const html = await readFile(resolve(root, "index.html"), "utf8");

/** Pull the page body out of index.html so the markup stays in one place. */
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
  .trim();

const TITLE = "Science Lab — Biology, Physics &amp; Chemistry";

for (const { file, standalone } of outputs) {
  const page = standalone
    ? `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${TITLE}</title>
    <style>
${css}
    </style>
  </head>
  <body>
${body}
    <script>
${script}
    </script>
  </body>
</html>
`
    : `<title>${TITLE}</title>
<style>
${css}
</style>
${body}
<script>
${script}
</script>
`;

  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page, "utf8");
  console.log(`  wrote ${file}  (${(page.length / 1024 / 1024).toFixed(2)} MB)`);
}
