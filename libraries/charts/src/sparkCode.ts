import type { Infer } from "@keel/schema";
import { hostCode } from "@keel/ui";
import type { Frame } from "./Frame.ts";
import { lineLayout } from "./lineLayout.ts";
import type { Series } from "./Series.schema.ts";
import { svgNode } from "./svgNode.ts";
import { svgRoot } from "./svgRoot.ts";

const FRAME: Frame = { width: 100, height: 24, left: 3, right: 3, top: 3, bottom: 3 };

/** Draws the line through every point and a dot on the last: no axis, no words, sized to sit in a line of text. */
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
    "stroke-width": 1.5,
    "stroke-linejoin": "round",
  });
  const last = at[at.length - 1];
  const dot =
    last === undefined ? [] : [svgNode(doc, "circle", { cx: last.x, cy: last.y, r: 2, fill: "currentColor" })];
  svg.replaceChildren(line, ...dot);
}

/** The sparkline's drawing: an SVG the `Host` node holds, redrawn on each new series. */
export const sparkCode = hostCode<Infer<typeof Series>, never, Element>({
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
