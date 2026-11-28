import { made } from "./made.ts";

/** An op that started at `start` places `nodes`: one made in this render at or before `start` was made before its parent. */
export function placed(start: number, nodes: Iterable<Node>): void {
  if (!made.on) return;
  for (const n of nodes) {
    const s = made.stamps.get(n);
    if (s !== undefined && s > made.from && s <= start) made.eager = true;
  }
}
