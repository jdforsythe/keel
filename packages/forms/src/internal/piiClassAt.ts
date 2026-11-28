import type { PiiClass } from "@keel/schema";
import type { Node } from "./Node.ts";

const INDEX = /^(0|[1-9]\d*)$/;

/**
 * The class of field path `segs` in `root` (k.privacy), never less than `piiPaths` states for it. The path is
 * matched as `piiPaths` spells its entries: a declared field by name, an array index, a record key or an open
 * object's undeclared last key as `*`, through every union variant in declaration order. Of the matches that carry
 * a class, the one with the fewest `*` wins, the first in declaration order on a tie: the class `piiPaths` lists
 * for that spelling. A declared object so keeps its own mark, never its parent's `*`. A path no entry spells (a
 * non-leaf, an undeclared key of a closed object, any depth under an undeclared key) takes the class in force where
 * the match stops, over-masking rather than leaving it bare.
 */
export function piiClassAt(root: Node, segs: readonly string[]): PiiClass | undefined {
  const stop = segs.length + 1;
  let best: PiiClass | undefined;
  let rank = stop + 1;
  const hit = (cls: PiiClass | undefined, r: number): void => {
    if (cls !== undefined && r < rank) [best, rank] = [cls, r];
  };
  const walk = (node: Node, i: number, inherited: PiiClass | undefined, stars: number): void => {
    const cls = node.pii ?? inherited;
    const seg = segs[i];
    if (node.kind === "optional" || node.kind === "nullable") walk(node.inner, i, cls, stars);
    else if (node.kind === "format") walk(node.base, i, cls, stars);
    else if (node.kind === "union") for (const v of node.variants) walk(v, i, cls, stars);
    else if (node.kind === "anyOf") for (const m of node.members) walk(m, i, cls, stars);
    else if (seg === undefined)
      hit(cls, node.kind === "object" || node.kind === "array" || node.kind === "record" ? stop : stars);
    else if (node.kind === "object") {
      const field = Object.hasOwn(node.fields, seg) ? node.fields[seg] : undefined;
      if (field !== undefined) walk(field, i + 1, cls, stars);
      else hit(cls, node.closed !== true && i === segs.length - 1 ? stars + 1 : stop);
    } else if (node.kind === "array" && INDEX.test(seg)) walk(node.item, i + 1, cls, stars + 1);
    else if (node.kind === "record" && seg !== "") walk(node.value, i + 1, cls, stars + 1);
    else hit(cls, stop);
  };
  walk(root, 0, undefined, 0);
  return best;
}
