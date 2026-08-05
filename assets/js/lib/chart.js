/**
 * Minimal inline-SVG plotting for the physics tools.
 * Single-series function plots (trajectory, decay) with a recessive grid,
 * a 2px line, direct end labels and a crosshair readout on hover.
 * Colours come from CSS custom properties so both themes stay correct.
 */

import { svg, h, fmt } from "./ui.js";

const PAD = { top: 18, right: 22, bottom: 34, left: 52 };

/**
 * @param {object} options
 * @param {Array<{x:number,y:number}>} options.points sampled curve, x ascending
 * @param {string} options.color stroke colour
 * @param {string} options.xLabel axis caption
 * @param {string} options.yLabel axis caption
 * @param {(p:{x:number,y:number}) => string} [options.readout] tooltip text
 * @param {Array<{x:number,y:number,label:string}>} [options.markers] annotated points
 * @param {boolean} [options.area] fill under the curve
 */
export function lineChart({
  points,
  color = "var(--card-accent)",
  xLabel = "x",
  yLabel = "y",
  readout = (p) => `x ${fmt(p.x, 3)}, y ${fmt(p.y, 3)}`,
  markers = [],
  area = false,
  width = 560,
  height = 260,
  caption = "",
}) {
  if (!points || points.length < 2) throw new Error("Not enough points to plot");

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(...ys);
  const spanX = xMax - xMin || 1;
  const spanY = yMax - yMin || 1;

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const sx = (x) => PAD.left + ((x - xMin) / spanX) * plotW;
  const sy = (y) => PAD.top + plotH - ((y - yMin) / spanY) * plotH;

  const ticksX = niceTicks(xMin, xMax);
  const ticksY = niceTicks(yMin, yMax);

  const path = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(" ");
  const areaPath = `${path} L${sx(points.at(-1).x).toFixed(2)},${sy(yMin).toFixed(2)} L${sx(points[0].x).toFixed(2)},${sy(yMin).toFixed(2)} Z`;

  const crosshair = svg("g", { opacity: "0" });
  const vLine = svg("line", { class: "grid-line", y1: PAD.top, y2: PAD.top + plotH, stroke: color, "stroke-dasharray": "3 3" });
  const dot = svg("circle", { r: 4.5, fill: color, stroke: "var(--panel-solid)", "stroke-width": "2" });
  const labelBg = svg("rect", { rx: 5, fill: "var(--panel-solid)", stroke: "var(--line)", height: 20 });
  const labelText = svg("text", { class: "axis-text", "dominant-baseline": "middle" });
  crosshair.append(vLine, labelBg, dot, labelText);

  const chart = svg(
    "svg",
    { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${yLabel} against ${xLabel}` },
    // grid
    ticksY.map((t) =>
      svg("line", { class: "grid-line", x1: PAD.left, x2: PAD.left + plotW, y1: sy(t), y2: sy(t) })
    ),
    ticksY.map((t) =>
      svg("text", { class: "axis-text", x: PAD.left - 8, y: sy(t), "text-anchor": "end", "dominant-baseline": "middle" }, fmt(t, 3))
    ),
    ticksX.map((t) =>
      svg("text", { class: "axis-text", x: sx(t), y: PAD.top + plotH + 16, "text-anchor": "middle" }, fmt(t, 3))
    ),
    svg("line", { class: "axis-line", x1: PAD.left, x2: PAD.left + plotW, y1: sy(yMin), y2: sy(yMin) }),
    svg("line", { class: "axis-line", x1: PAD.left, x2: PAD.left, y1: PAD.top, y2: PAD.top + plotH }),
    // series
    area ? svg("path", { d: areaPath, fill: color, opacity: "0.14" }) : null,
    svg("path", { d: path, fill: "none", stroke: color, "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round" }),
    // annotated points
    markers.map((m) =>
      svg(
        "g",
        {},
        svg("circle", { cx: sx(m.x), cy: sy(m.y), r: 4, fill: color, stroke: "var(--panel-solid)", "stroke-width": "2" }),
        svg(
          "text",
          {
            class: "diagram-label",
            x: sx(m.x),
            y: sy(m.y) - 9,
            "text-anchor": sx(m.x) > PAD.left + plotW * 0.75 ? "end" : "middle",
          },
          m.label
        )
      )
    ),
    // axis captions
    svg("text", { class: "axis-text", x: PAD.left + plotW / 2, y: height - 4, "text-anchor": "middle" }, xLabel),
    svg(
      "text",
      { class: "axis-text", x: 12, y: PAD.top + plotH / 2, "text-anchor": "middle", transform: `rotate(-90 12 ${PAD.top + plotH / 2})` },
      yLabel
    ),
    crosshair
  );

  chart.addEventListener("pointerleave", () => crosshair.setAttribute("opacity", "0"));
  chart.addEventListener("pointermove", (event) => {
    const box = chart.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const value = xMin + ((px - PAD.left) / plotW) * spanX;
    const nearest = points.reduce((best, p) => (Math.abs(p.x - value) < Math.abs(best.x - value) ? p : best));
    const cx = sx(nearest.x);
    const cy = sy(nearest.y);
    vLine.setAttribute("x1", cx);
    vLine.setAttribute("x2", cx);
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    const text = readout(nearest);
    labelText.textContent = text;
    const boxWidth = text.length * 5.6 + 14;
    const flip = cx + boxWidth + 12 > width;
    const boxX = flip ? cx - boxWidth - 10 : cx + 10;
    labelBg.setAttribute("x", boxX);
    labelBg.setAttribute("y", Math.max(PAD.top, cy - 26));
    labelBg.setAttribute("width", boxWidth);
    labelText.setAttribute("x", boxX + 7);
    labelText.setAttribute("y", Math.max(PAD.top, cy - 26) + 10);
    crosshair.setAttribute("opacity", "1");
  });

  return h("figure.figure", {}, chart, caption ? h("figcaption", {}, caption) : null);
}

/** Roughly five human-friendly tick values spanning [min, max]. */
function niceTicks(min, max, count = 5) {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) || magnitude * 10;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let t = start; t <= max + step * 0.001; t += step) ticks.push(Number(t.toPrecision(12)));
  return ticks;
}
