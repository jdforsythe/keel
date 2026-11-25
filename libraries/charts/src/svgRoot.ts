import type { Frame } from "./Frame.ts";
import { svgNode } from "./svgNode.ts";

/**
 * The `svg` a chart draws into, appended to `node`: as wide as its container, its height from `frame`'s aspect, and
 * hidden from the accessibility tree (the `Host` is the picture and carries its name). Nothing in it moves, so a
 * person who asks for reduced motion sees the same chart as everyone else.
 */
export function svgRoot(node: HTMLElement, frame: Frame): Element {
  const svg = svgNode(node.ownerDocument, "svg", {
    viewBox: `0 0 ${frame.width} ${frame.height}`,
    width: "100%",
    "aria-hidden": "true",
    focusable: "false",
  });
  node.append(svg);
  return svg;
}
