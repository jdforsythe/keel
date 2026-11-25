import type { Infer } from "@keel/schema";
import { hostCode } from "@keel/ui";
import { barLayout } from "./barLayout.ts";
import type { Frame } from "./Frame.ts";
import type { Series } from "./Series.schema.ts";
import { svgNode } from "./svgNode.ts";
import { svgRoot } from "./svgRoot.ts";

const FRAME: Frame = { width: 320, height: 180, left: 8, right: 8, top: 18, bottom: 22 };

/** Draws the bars, the zero line, each value's `shown` above its bar and its `name` below the plot. */
function draw(svg: Element, value: Infer<typeof Series>): void {
  const doc = svg.ownerDocument;
  const { base, bars } = barLayout(
    value.points.map((p) => p.value),
    FRAME,
  );
  const words = bars.length > 0 && bars.length <= 16;
  const marks = bars.flatMap((b, i) => {
    const point = value.points[i];
    if (point === undefined) return [];
    const rect = svgNode(doc, "rect", { x: b.x, y: b.y, width: b.width, height: b.height, fill: "currentColor" });
    if (!words) return [rect];
    const mid = b.x + b.width / 2;
    const above = point.value >= 0 ? b.y - 4 : b.y + b.height + 12;
    const shown = svgNode(doc, "text", {
      x: mid,
      y: above,
      "text-anchor": "middle",
      "font-size": 10,
      fill: "currentColor",
    });
    shown.textContent = point.shown;
    const name = svgNode(doc, "text", {
      x: mid,
      y: FRAME.height - 6,
      "text-anchor": "middle",
      "font-size": 10,
      fill: "currentColor",
    });
    name.textContent = point.name;
    return [rect, shown, name];
  });
  const axis = svgNode(doc, "line", {
    x1: FRAME.left,
    x2: FRAME.width - FRAME.right,
    y1: base,
    y2: base,
    stroke: "currentColor",
    "stroke-width": 1,
  });
  svg.replaceChildren(axis, ...marks);
}

/** The bar chart's drawing: an SVG the `Host` node holds, redrawn on each new series. */
export const barsCode = hostCode<Infer<typeof Series>, never, Element>({
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
