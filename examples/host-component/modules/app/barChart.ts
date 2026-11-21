import type { Infer } from "@keel/schema";
import { hostCode } from "@keel/ui";
import type { Bars } from "./Bars.schema.ts";

const SVG = "http://www.w3.org/2000/svg";

/** Draws one SVG rect per bar, 20 px wide, its height the value; the outside code that owns the `Host` node. */
function draw(svg: SVGSVGElement, value: Infer<typeof Bars>) {
  svg.replaceChildren();
  value.bars.forEach((bar, i) => {
    const rect = svg.ownerDocument.createElementNS(SVG, "rect");
    rect.setAttribute("x", String(i * 30));
    rect.setAttribute("y", String(100 - bar.value));
    rect.setAttribute("width", "20");
    rect.setAttribute("height", String(bar.value));
    rect.setAttribute("fill", "currentColor");
    svg.append(rect);
  });
}

export const barChart = hostCode<Infer<typeof Bars>, never, SVGSVGElement>({
  mount(node, value) {
    const svg = node.ownerDocument.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 90 100");
    svg.setAttribute("width", "180");
    svg.setAttribute("height", "200");
    node.append(svg);
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
