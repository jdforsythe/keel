import type { Infer } from "@keel/schema";
import { hostCode } from "@keel/ui";
import type { Frame } from "./Frame.ts";
import { lineLayout } from "./lineLayout.ts";
import type { Series } from "./Series.schema.ts";
import { svgNode } from "./svgNode.ts";
import { svgRoot } from "./svgRoot.ts";

const FRAME: Frame = { width: 320, height: 180, left: 12, right: 12, top: 18, bottom: 22 };

/** Draws the line through every point, a dot on each when there are few, and the first and last `name` below. */
function draw(svg: Element, value: Infer<typeof Series>): void {
  const doc = svg.ownerDocument;
  const at = lineLayout(
    value.points.map((p) => p.value),
    FRAME,
  );
  const line = svgNode(doc, "polyline", {
    points: at.map((p) => `${p.x},${p.y}`).join(" "),
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linejoin": "round",
  });
  const dots =
    at.length <= 32 ? at.map((p) => svgNode(doc, "circle", { cx: p.x, cy: p.y, r: 3, fill: "currentColor" })) : [];
  const ends = [0, at.length - 1]
    .filter((i, n, all) => i >= 0 && all.indexOf(i) === n)
    .flatMap((i) => {
      const point = value.points[i];
      const p = at[i];
      if (point === undefined || p === undefined) return [];
      const anchor = at.length === 1 ? "middle" : i === 0 ? "start" : "end";
      const name = svgNode(doc, "text", {
        x: p.x,
        y: FRAME.height - 6,
        "text-anchor": anchor,
        "font-size": 10,
        fill: "currentColor",
      });
      name.textContent = point.name;
      const shown = svgNode(doc, "text", {
        x: p.x,
        y: p.y - 7,
        "text-anchor": anchor,
        "font-size": 10,
        fill: "currentColor",
      });
      shown.textContent = point.shown;
      return [name, shown];
    });
  svg.replaceChildren(line, ...dots, ...ends);
}

/** The line chart's drawing: an SVG the `Host` node holds, redrawn on each new series. */
export const lineCode = hostCode<Infer<typeof Series>, never, Element>({
  mount(node, value) {
    const svg = svgRoot(node, FRAME);
    draw(svg, value);
    return svg;
  },
  update(svg, value) {
    draw(svg, value);
  },
  dispose(svg) {
    svg.remove();
  },
});
