import { made } from "./made.ts";

/** Stamp an element the runtime made (`made`); returns the stamp to compare placements against. */
export function stamp(el: Node): number {
  if (made.on) made.stamps.set(el, ++made.seq);
  return made.seq;
}
